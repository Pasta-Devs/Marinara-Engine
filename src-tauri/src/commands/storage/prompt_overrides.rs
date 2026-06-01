use super::*;
use serde::Deserialize;
use std::collections::HashSet;
use std::sync::OnceLock;

const PROMPT_OVERRIDE_COLLECTION: &str = "prompt-overrides";
const PROMPT_OVERRIDE_MANIFEST: &str =
    include_str!("../../../../src/engine/generation/prompt-overrides.manifest.json");

#[derive(Debug, Deserialize)]
struct PromptOverrideVariable {
    name: String,
}

#[derive(Debug, Deserialize)]
struct PromptOverrideDefinition {
    key: String,
    variables: Vec<PromptOverrideVariable>,
}

static PROMPT_OVERRIDE_DEFINITIONS: OnceLock<Vec<PromptOverrideDefinition>> = OnceLock::new();

fn definitions() -> &'static [PromptOverrideDefinition] {
    PROMPT_OVERRIDE_DEFINITIONS
        .get_or_init(|| {
            serde_json::from_str(PROMPT_OVERRIDE_MANIFEST)
                .expect("prompt override manifest must be valid JSON")
        })
        .as_slice()
}

pub(crate) fn is_supported_prompt_override_key(key: &str) -> bool {
    definitions().iter().any(|definition| definition.key == key)
}

fn definition_for_key(key: &str) -> Option<&'static PromptOverrideDefinition> {
    definitions()
        .iter()
        .find(|definition| definition.key == key)
}

fn template_variables(template: &str, declared: &HashSet<&str>) -> Vec<String> {
    let mut unknown = Vec::new();
    let mut seen = HashSet::new();
    let mut search_index = 0usize;
    while search_index < template.len() {
        let Some(start_relative) = template[search_index..].find("${") else {
            break;
        };
        let start = search_index + start_relative;
        let name_start = start + 2;
        let Some(end_relative) = template[name_start..].find('}') else {
            let name = &template[name_start..];
            let reported = if name.is_empty() { "<empty>" } else { name };
            if seen.insert(reported.to_string()) {
                unknown.push(reported.to_string());
            }
            break;
        };
        let end = name_start + end_relative;
        let name = &template[name_start..end];
        let valid_name = name.chars().enumerate().all(|(index, ch)| {
            ch == '_' || ch.is_ascii_alphabetic() || (index > 0 && ch.is_ascii_digit())
        }) && name
            .chars()
            .next()
            .is_some_and(|ch| ch == '_' || ch.is_ascii_alphabetic());
        let reported = if name.is_empty() { "<empty>" } else { name };
        if (!valid_name || !declared.contains(name)) && seen.insert(reported.to_string()) {
            unknown.push(reported.to_string());
        }
        search_index = end + 1;
    }
    unknown
}

fn referenced_declared_variables(template: &str, declared: &HashSet<&str>) -> Vec<String> {
    let mut referenced = Vec::new();
    let mut seen = HashSet::new();
    let mut search_index = 0usize;
    while search_index < template.len() {
        let Some(start_relative) = template[search_index..].find("${") else {
            break;
        };
        let start = search_index + start_relative;
        let name_start = start + 2;
        let Some(end_relative) = template[name_start..].find('}') else {
            break;
        };
        let end = name_start + end_relative;
        let name = &template[name_start..end];
        if declared.contains(name) && seen.insert(name.to_string()) {
            referenced.push(name.to_string());
        }
        search_index = end + 1;
    }
    referenced
}

fn is_missing_context_value(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => true,
        Some(Value::String(value)) => value.trim().is_empty(),
        _ => false,
    }
}

fn context_value(context: &Map<String, Value>, name: &str) -> String {
    match context.get(name) {
        Some(Value::String(value)) => value.clone(),
        Some(Value::Number(value)) => value.to_string(),
        Some(Value::Bool(value)) => value.to_string(),
        Some(value) if !value.is_null() => value.to_string(),
        _ => String::new(),
    }
}

fn render_template(
    template: &str,
    context: &Map<String, Value>,
    declared: &HashSet<&str>,
) -> String {
    let mut rendered = String::with_capacity(template.len());
    let mut search_index = 0usize;
    while search_index < template.len() {
        let Some(start_relative) = template[search_index..].find("${") else {
            rendered.push_str(&template[search_index..]);
            break;
        };
        let start = search_index + start_relative;
        rendered.push_str(&template[search_index..start]);
        let name_start = start + 2;
        let Some(end_relative) = template[name_start..].find('}') else {
            rendered.push_str(&template[start..]);
            break;
        };
        let end = name_start + end_relative;
        let name = &template[name_start..end];
        if declared.contains(name) {
            rendered.push_str(&context_value(context, name));
        } else {
            rendered.push_str(&template[start..=end]);
        }
        search_index = end + 1;
    }
    rendered
}

fn row_enabled(row: &Map<String, Value>) -> bool {
    match row.get("enabled") {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(value)) => !matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "false" | "0" | "no" | "off"
        ),
        _ => true,
    }
}

#[cfg(test)]
fn render_registered_prompt_template(
    key: &str,
    template: &str,
    context: &Map<String, Value>,
) -> Option<String> {
    let definition = definition_for_key(key)?;
    let declared = definition
        .variables
        .iter()
        .map(|variable| variable.name.as_str())
        .collect::<HashSet<_>>();
    if !template_variables(template, &declared).is_empty() {
        return None;
    }
    Some(render_template(template, context, &declared))
}

pub(crate) fn resolve_registered_prompt_override(
    state: &AppState,
    key: &str,
    context: &Map<String, Value>,
    default_prompt: String,
) -> String {
    let Some(definition) = definition_for_key(key) else {
        return default_prompt;
    };
    let declared = definition
        .variables
        .iter()
        .map(|variable| variable.name.as_str())
        .collect::<HashSet<_>>();

    let row = match state.storage.get(PROMPT_OVERRIDE_COLLECTION, key) {
        Ok(Some(Value::Object(row))) => row,
        Ok(_) => return default_prompt,
        Err(error) => {
            log::warn!("[prompt-overrides] Falling back to default for {key}: {error}");
            return default_prompt;
        }
    };
    if !row_enabled(&row) {
        return default_prompt;
    }
    let Some(template) = row
        .get("template")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return default_prompt;
    };
    let unknown = template_variables(template, &declared);
    if !unknown.is_empty() {
        log::warn!(
            "[prompt-overrides] Falling back to default for {key}; unknown variables: {}",
            unknown.join(", ")
        );
        return default_prompt;
    }
    let missing = referenced_declared_variables(template, &declared)
        .into_iter()
        .filter(|name| is_missing_context_value(context.get(name)))
        .collect::<Vec<_>>();
    if !missing.is_empty() {
        log::warn!(
            "[prompt-overrides] Falling back to default for {key}; missing context values: {}",
            missing.join(", ")
        );
        return default_prompt;
    }
    render_template(template, context, &declared)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn context() -> Map<String, Value> {
        HashMap::from([
            ("defaultPrompt".to_string(), json!("built-in prompt")),
            ("appearance".to_string(), json!("silver hair")),
            ("expression".to_string(), json!("happy")),
        ])
        .into_iter()
        .collect()
    }

    #[test]
    fn manifest_supports_sprite_and_game_keys() {
        for key in [
            "conversation.selfie",
            "sprite.portraitSingle",
            "sprite.expressionSheet",
            "sprite.fullBodySingle",
            "sprite.fullBodySheet",
            "sprite.fullBodyExpressionSheet",
            "game.background",
            "game.illustration",
            "game.portrait",
        ] {
            assert!(
                is_supported_prompt_override_key(key),
                "{key} should be registered"
            );
        }
    }

    #[test]
    fn render_registered_prompt_template_rejects_unknown_variables() {
        assert_eq!(
            render_registered_prompt_template(
                "sprite.portraitSingle",
                "Custom ${defaultPrompt} ${missing}",
                &context(),
            ),
            None
        );
    }

    #[test]
    fn render_registered_prompt_template_expands_known_variables() {
        assert_eq!(
            render_registered_prompt_template(
                "sprite.portraitSingle",
                "Custom ${defaultPrompt} for ${appearance} ${expression}",
                &context(),
            ),
            Some("Custom built-in prompt for silver hair happy".to_string())
        );
    }

    #[test]
    fn resolve_registered_prompt_override_falls_back_when_referenced_context_is_missing() {
        use crate::state::AppState;
        use std::time::{SystemTime, UNIX_EPOCH};

        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-prompt-override-missing-{nonce}"));
        let state =
            AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize");
        state
            .storage
            .upsert_with_id(
                PROMPT_OVERRIDE_COLLECTION,
                "game.background",
                json!({
                    "id": "game.background",
                    "key": "game.background",
                    "template": "Custom ${label}: ${defaultPrompt}",
                    "enabled": true
                }),
            )
            .expect("prompt override should write");

        let sparse_context = HashMap::from([(
            "defaultPrompt".to_string(),
            json!("built-in background prompt"),
        )])
        .into_iter()
        .collect();

        assert_eq!(
            resolve_registered_prompt_override(
                &state,
                "game.background",
                &sparse_context,
                "built-in background prompt".to_string(),
            ),
            "built-in background prompt"
        );
    }
}
