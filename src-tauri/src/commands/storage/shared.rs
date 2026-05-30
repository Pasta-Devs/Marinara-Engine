use super::*;

pub(crate) struct ParsedPath {
    pub(crate) parts: Vec<String>,
    pub(crate) query: HashMap<String, String>,
}

impl ParsedPath {
    pub(crate) fn new(path: &str) -> Self {
        let (path_part, query_part) = path.split_once('?').unwrap_or((path, ""));
        let parts = path_part
            .trim_matches('/')
            .split('/')
            .filter(|part| !part.is_empty())
            .map(|part| part.to_string())
            .collect();
        let query = query_part
            .split('&')
            .filter_map(|pair| {
                let (key, value) = pair.split_once('=')?;
                Some((key.to_string(), value.to_string()))
            })
            .collect();
        Self { parts, query }
    }
}

pub(crate) fn list_collection(
    state: &AppState,
    collection: &str,
    filter: Option<(&str, &str)>,
) -> AppResult<Value> {
    let mut rows = match filter {
        Some((key, value)) => {
            let mut filters = Map::new();
            filters.insert(key.to_string(), Value::String(value.to_string()));
            state.storage.list_where(collection, &filters)?
        }
        None => state.storage.list(collection)?,
    };
    rows.sort_by(|a, b| {
        let a_order = a
            .get("sortOrder")
            .or_else(|| a.get("order"))
            .and_then(Value::as_i64);
        let b_order = b
            .get("sortOrder")
            .or_else(|| b.get("order"))
            .and_then(Value::as_i64);
        match (a_order, b_order) {
            (Some(a_order), Some(b_order)) if a_order != b_order => a_order.cmp(&b_order),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            _ => {
                let a_time = a.get("createdAt").and_then(Value::as_str).unwrap_or("");
                let b_time = b.get("createdAt").and_then(Value::as_str).unwrap_or("");
                a_time.cmp(b_time)
            }
        }
    });
    Ok(Value::Array(rows))
}

pub(crate) fn get_required(state: &AppState, collection: &str, id: &str) -> AppResult<Value> {
    state
        .storage
        .get(collection, id)?
        .ok_or_else(|| AppError::not_found(format!("{collection}/{id} was not found")))
}

pub(crate) fn materialize_message_swipe_fields(message: &mut Value) {
    let Some(object) = message.as_object_mut() else {
        return;
    };
    let Some((swipe_count, active_index, active_content, active_extra)) = object
        .get("swipes")
        .and_then(Value::as_array)
        .map(|swipes| {
            let swipe_count = swipes.len();
            if swipe_count == 0 {
                return (0, 0, None, None);
            }

            let requested_index = object
                .get("activeSwipeIndex")
                .and_then(Value::as_u64)
                .map(|value| value as usize)
                .unwrap_or(0);
            let active_index = requested_index.min(swipe_count.saturating_sub(1));
            let active_swipe = swipes.get(active_index);
            let active_content = active_swipe
                .and_then(|swipe| swipe.get("content"))
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let active_extra = json_object_value(active_swipe.and_then(|swipe| swipe.get("extra")));
            (swipe_count, active_index, active_content, active_extra)
        })
    else {
        return;
    };
    object.insert("swipeCount".to_string(), json!(swipe_count));
    if swipe_count == 0 {
        object.insert("activeSwipeIndex".to_string(), json!(0));
        return;
    }

    object.insert("activeSwipeIndex".to_string(), json!(active_index));
    if let Some(content) = active_content {
        object.insert("content".to_string(), Value::String(content));
    }
    if let Some(extra) = active_extra {
        object.insert(
            "extra".to_string(),
            merge_active_swipe_extra(object.get("extra"), extra),
        );
    }
}

const SWIPE_SCOPED_EXTRA_KEYS: [&str; 15] = [
    "displayText",
    "isGenerated",
    "tokenCount",
    "generationInfo",
    "thinking",
    "spriteExpressions",
    "cyoaChoices",
    "contextInjections",
    "chatSummaryFingerprint",
    "cachedPrompt",
    "generationReplay",
    "generationPromptSnapshot",
    "attachments",
    "reasoning",
    "reasoning_content",
];

pub(crate) fn clear_swipe_scoped_extra(base: Option<&Value>) -> Value {
    let mut merged = json_object_value(base)
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    for key in SWIPE_SCOPED_EXTRA_KEYS {
        merged.remove(key);
    }
    Value::Object(merged)
}

pub(crate) fn swipe_scoped_extra(value: Option<&Value>) -> Option<Value> {
    let value = json_object_value(value)?;
    let object = value.as_object()?;
    let mut scoped = Map::new();
    for key in SWIPE_SCOPED_EXTRA_KEYS {
        if let Some(value) = object.get(key) {
            scoped.insert(key.to_string(), value.clone());
        }
    }
    (!scoped.is_empty()).then_some(Value::Object(scoped))
}

pub(crate) fn merge_active_swipe_extra(base: Option<&Value>, active_extra: Value) -> Value {
    let mut merged = clear_swipe_scoped_extra(base)
        .as_object()
        .cloned()
        .unwrap_or_default();
    if let Some(active_value) = json_object_value(Some(&active_extra)) {
        let Some(active) = active_value.as_object() else {
            return Value::Object(merged);
        };
        for key in SWIPE_SCOPED_EXTRA_KEYS {
            if let Some(value) = active.get(key) {
                merged.insert(key.to_string(), value.clone());
            }
        }
    }
    Value::Object(merged)
}

pub(crate) fn json_object_value(value: Option<&Value>) -> Option<Value> {
    match value? {
        Value::Object(_) => value.cloned(),
        Value::String(raw) => serde_json::from_str::<Value>(raw)
            .ok()
            .filter(Value::is_object),
        _ => None,
    }
}

pub(crate) fn non_negative_i64_value(value: Option<&Value>) -> Option<i64> {
    match value {
        Some(Value::Number(number)) => number
            .as_i64()
            .or_else(|| number.as_u64().map(|value| value as i64))
            .map(|value| value.max(0)),
        Some(Value::String(raw)) => raw.trim().parse::<i64>().ok().map(|value| value.max(0)),
        _ => None,
    }
}

pub(crate) fn swipe_index_value(message: &Value) -> i64 {
    let fallback = message
        .get("swipeCount")
        .and_then(Value::as_u64)
        .map(|count| count.saturating_sub(1) as i64)
        .unwrap_or(0);
    non_negative_i64_value(message.get("activeSwipeIndex")).unwrap_or(fallback)
}

pub(crate) fn collapse_excess_blank_lines(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut newline_run = 0usize;
    let mut pending_blank_space = String::new();

    for ch in input.chars() {
        if ch == '\r' {
            continue;
        }
        if ch == '\n' {
            newline_run += 1;
            if newline_run <= 2 {
                output.push_str(&pending_blank_space);
                output.push('\n');
            }
            pending_blank_space.clear();
            continue;
        }
        if newline_run > 0 && (ch == ' ' || ch == '\t') {
            pending_blank_space.push(ch);
            continue;
        }
        output.push_str(&pending_blank_space);
        pending_blank_space.clear();
        output.push(ch);
        newline_run = 0;
    }

    output
}

fn normalize_message_text_fields(object: &mut Map<String, Value>) {
    if let Some(Value::String(content)) = object.get_mut("content") {
        *content = collapse_excess_blank_lines(content);
    }
    let Some(swipes) = object.get_mut("swipes").and_then(Value::as_array_mut) else {
        return;
    };
    for swipe in swipes {
        let Some(swipe) = swipe.as_object_mut() else {
            continue;
        };
        if let Some(Value::String(content)) = swipe.get_mut("content") {
            *content = collapse_excess_blank_lines(content);
        }
    }
}

pub(crate) fn normalize_character_data_for_storage(data: &Value) -> AppResult<Value> {
    match data {
        Value::Object(_) => Ok(data.clone()),
        _ => Err(AppError::invalid_input(
            "Character data must be a JSON object",
        )),
    }
}

pub(crate) fn normalize_update_patch(collection: &str, patch: Value) -> AppResult<Value> {
    let mut object = ensure_object(patch)?;
    normalize_typed_json_fields(collection, &mut object)?;
    Ok(Value::Object(object))
}

pub(crate) fn patch_message_update(
    state: &AppState,
    message_id: &str,
    patch: Value,
) -> AppResult<Value> {
    let normalized = normalize_update_patch("messages", patch)?;
    state
        .storage
        .patch_with("messages", message_id, normalized, |message, patch| {
            sync_message_patch_content_to_active_swipe(message, patch);
            Ok(())
        })
}

pub(crate) fn sync_message_patch_content_to_active_swipe(
    message: &mut Map<String, Value>,
    patch: &Map<String, Value>,
) {
    if patch.contains_key("swipes") {
        return;
    }
    let content = patch
        .get("content")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let extra = patch
        .get("extra")
        .filter(|value| value.is_object())
        .and_then(|value| swipe_scoped_extra(Some(value)));
    if content.is_none() && extra.is_none() {
        return;
    }
    let active_index = patch
        .get("activeSwipeIndex")
        .or_else(|| message.get("activeSwipeIndex"))
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(0);
    let Some(swipes) = message.get_mut("swipes").and_then(Value::as_array_mut) else {
        return;
    };
    if swipes.is_empty() {
        return;
    }
    let active_index = active_index.min(swipes.len().saturating_sub(1));
    match swipes.get_mut(active_index) {
        Some(Value::Object(swipe)) => {
            if let Some(content) = content {
                swipe.insert("content".to_string(), Value::String(content));
            }
            if let Some(extra) = extra {
                swipe.insert("extra".to_string(), extra);
            }
        }
        Some(swipe) => {
            let mut next = Map::new();
            if let Some(content) = content {
                next.insert("content".to_string(), Value::String(content));
            }
            if let Some(extra) = extra {
                next.insert("extra".to_string(), extra);
            }
            *swipe = Value::Object(next);
        }
        None => {}
    }
}

pub(crate) fn normalize_typed_json_fields(
    collection: &str,
    object: &mut Map<String, Value>,
) -> AppResult<()> {
    match collection {
        "characters" => {
            if let Some(data) = object.get("data") {
                object.insert(
                    "data".to_string(),
                    normalize_character_data_for_storage(data)?,
                );
            }
        }
        "chats" => {
            normalize_json_array_fields(
                object,
                &[
                    "characterIds",
                    "activeLorebookIds",
                    "activeAgentIds",
                    "activeToolIds",
                    "memories",
                    "notes",
                ],
            )?;
            normalize_nullable_json_object_fields(object, &["metadata", "gameState"])?;
        }
        "messages" => {
            normalize_json_array_fields(object, &["swipes", "images", "attachments"])?;
            normalize_nullable_json_object_fields(object, &["extra"])?;
            normalize_message_text_fields(object);
        }
        "character-groups" => {
            normalize_json_array_fields(object, &["characterIds"])?;
        }
        "persona-groups" => {
            normalize_json_array_fields(object, &["personaIds"])?;
        }
        "lorebooks" => {
            normalize_json_array_fields(object, &["tags", "characterIds", "personaIds"])?;
        }
        "lorebook-entries" => {
            normalize_json_array_fields(object, &["keys", "secondaryKeys"])?;
        }
        "connections" => {
            normalize_nullable_json_object_fields(
                object,
                &["defaultParameters", "capabilities", "providerMetadata"],
            )?;
        }
        "custom-tools" => {
            normalize_json_object_fields(object, &["parametersSchema"])?;
        }
        "game-state-snapshots" => {
            normalize_json_array_fields(object, &["presentCharacters", "recentEvents"])?;
            normalize_nullable_json_object_fields(object, &["playerStats", "metadata"])?;
            normalize_nullable_json_array_fields(object, &["personaStats"])?;
        }
        "game-checkpoints" => {
            normalize_nullable_json_object_fields(object, &["snapshot", "metadata"])?;
        }
        "chat-presets" => {
            normalize_json_object_fields(object, &["parameters"])?;
            normalize_boolish_fields(object, &["isDefault", "default", "isActive", "active"]);
        }
        "prompts" => {
            normalize_json_array_fields(object, &["sectionOrder", "groupOrder", "variableOrder"])?;
            normalize_json_object_fields(
                object,
                &["variableValues", "parameters", "defaultChoices"],
            )?;
            normalize_json_array_fields(object, &["variableGroups"])?;
        }
        "prompt-sections" => {
            normalize_nullable_json_object_fields(object, &["markerConfig"])?;
        }
        "prompt-variables" => {
            normalize_json_array_fields(object, &["options"])?;
        }
        "personas" => {
            normalize_json_array_fields(
                object,
                &["tags", "altDescriptions", "savedStatusOptions"],
            )?;
            normalize_nullable_json_object_fields(object, &["avatarCrop", "personaStats"])?;
        }
        "agents" => {
            normalize_json_object_fields(object, &["settings"])?;
        }
        "regex-scripts" => {
            normalize_json_array_fields(object, &["placement", "trimStrings"])?;
        }
        _ => {}
    }
    Ok(())
}

fn normalize_json_array_fields(object: &mut Map<String, Value>, fields: &[&str]) -> AppResult<()> {
    for field in fields {
        let Some(value) = object.get(*field) else {
            continue;
        };
        let normalized = normalize_json_field(value, Value::is_array, "array", field)?;
        object.insert((*field).to_string(), normalized);
    }
    Ok(())
}

fn normalize_nullable_json_array_fields(
    object: &mut Map<String, Value>,
    fields: &[&str],
) -> AppResult<()> {
    for field in fields {
        let Some(value) = object.get(*field) else {
            continue;
        };
        if value.is_null() {
            continue;
        }
        let normalized = normalize_json_field(value, Value::is_array, "array or null", field)?;
        object.insert((*field).to_string(), normalized);
    }
    Ok(())
}

fn normalize_json_object_fields(object: &mut Map<String, Value>, fields: &[&str]) -> AppResult<()> {
    for field in fields {
        let Some(value) = object.get(*field) else {
            continue;
        };
        let normalized = normalize_json_field(value, Value::is_object, "object", field)?;
        object.insert((*field).to_string(), normalized);
    }
    Ok(())
}

fn normalize_boolish_fields(object: &mut Map<String, Value>, fields: &[&str]) {
    for field in fields {
        let Some(value) = object.get_mut(*field) else {
            continue;
        };
        if value.is_boolean() {
            continue;
        }
        let normalized = match value.as_str().map(str::trim).map(str::to_ascii_lowercase) {
            Some(raw) if raw == "true" || raw == "1" || raw == "yes" || raw == "on" => true,
            Some(raw) if raw == "false" || raw == "0" || raw == "no" || raw == "off" => false,
            _ => value
                .as_i64()
                .map(|number| number != 0)
                .or_else(|| value.as_f64().map(|number| !number.is_nan() && number != 0.0))
                .unwrap_or(false),
        };
        *value = Value::Bool(normalized);
    }
}

fn normalize_nullable_json_object_fields(
    object: &mut Map<String, Value>,
    fields: &[&str],
) -> AppResult<()> {
    for field in fields {
        let Some(value) = object.get(*field) else {
            continue;
        };
        if value.is_null() {
            continue;
        }
        let normalized = normalize_json_field(value, Value::is_object, "object or null", field)?;
        object.insert((*field).to_string(), normalized);
    }
    Ok(())
}

fn normalize_json_field(
    value: &Value,
    predicate: fn(&Value) -> bool,
    expected: &str,
    field: &str,
) -> AppResult<Value> {
    if predicate(value) {
        return Ok(value.clone());
    }
    if let Some(raw) = value.as_str() {
        if raw.trim().is_empty() {
            return Ok(match expected {
                "array" => json!([]),
                "array or null" | "object or null" => Value::Null,
                _ => json!({}),
            });
        }
        let parsed: Value = serde_json::from_str(raw).map_err(|_| {
            AppError::invalid_input(format!(
                "{field} must be a JSON {expected}, not a JSON string"
            ))
        })?;
        if predicate(&parsed) {
            return Ok(parsed);
        }
    }
    Err(AppError::invalid_input(format!(
        "{field} must be a JSON {expected}"
    )))
}

pub(crate) fn with_entity_defaults(collection: &str, body: Value) -> AppResult<Value> {
    let mut object = ensure_object(body)?;
    match collection {
        "chats" => {
            object
                .entry("metadata".to_string())
                .or_insert_with(|| json!({}));
            object
                .entry("gameState".to_string())
                .or_insert_with(|| json!({}));
            object
                .entry("characterIds".to_string())
                .or_insert_with(|| json!([]));
        }
        "connections" => {
            object
                .entry("enabled".to_string())
                .or_insert(Value::Bool(true));
        }
        "characters" => {
            if let Some(data) = object.get("data") {
                normalize_character_data_for_storage(data)?;
            } else {
                let mut data = Map::new();
                let name = object
                    .get("name")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or("New Character");
                data.insert("name".to_string(), Value::String(name.to_string()));
                data.insert("description".to_string(), Value::String(String::new()));
                data.insert("personality".to_string(), Value::String(String::new()));
                data.insert("scenario".to_string(), Value::String(String::new()));
                data.insert("first_mes".to_string(), Value::String(String::new()));
                data.insert("mes_example".to_string(), Value::String(String::new()));
                data.insert("creator_notes".to_string(), Value::String(String::new()));
                data.insert("system_prompt".to_string(), Value::String(String::new()));
                data.insert(
                    "post_history_instructions".to_string(),
                    Value::String(String::new()),
                );
                data.insert("tags".to_string(), json!([]));
                data.insert("creator".to_string(), Value::String(String::new()));
                data.insert(
                    "character_version".to_string(),
                    Value::String("1.0".to_string()),
                );
                data.insert("alternate_greetings".to_string(), json!([]));
                data.insert("extensions".to_string(), json!({ "altDescriptions": [] }));
                data.insert("character_book".to_string(), Value::Null);
                object.insert("data".to_string(), Value::Object(data));
            }
            object
                .entry("comment".to_string())
                .or_insert(Value::String(String::new()));
            object
                .entry("avatarPath".to_string())
                .or_insert(Value::Null);
        }
        "lorebooks" => {
            object
                .entry("description".to_string())
                .or_insert(Value::String(String::new()));
            object
                .entry("category".to_string())
                .or_insert(Value::String("uncategorized".to_string()));
            object.entry("imagePath".to_string()).or_insert(Value::Null);
            object.entry("scanDepth".to_string()).or_insert(json!(2));
            object
                .entry("tokenBudget".to_string())
                .or_insert(json!(2048));
            object
                .entry("recursiveScanning".to_string())
                .or_insert(Value::Bool(false));
            object
                .entry("maxRecursionDepth".to_string())
                .or_insert(json!(3));
            object
                .entry("characterId".to_string())
                .or_insert(Value::Null);
            object
                .entry("characterIds".to_string())
                .or_insert(json!([]));
            object.entry("personaId".to_string()).or_insert(Value::Null);
            object.entry("personaIds".to_string()).or_insert(json!([]));
            object.entry("chatId".to_string()).or_insert(Value::Null);
            object
                .entry("isGlobal".to_string())
                .or_insert(Value::Bool(false));
            object
                .entry("enabled".to_string())
                .or_insert(Value::Bool(true));
            object
                .entry("excludeFromVectorization".to_string())
                .or_insert(Value::Bool(false));
            object.entry("tags".to_string()).or_insert(json!([]));
            object
                .entry("generatedBy".to_string())
                .or_insert(Value::Null);
            object
                .entry("sourceAgentId".to_string())
                .or_insert(Value::Null);
        }
        "personas" => {
            normalize_typed_json_fields(collection, &mut object)?;
            object
                .entry("description".to_string())
                .or_insert(Value::String(String::new()));
            object
                .entry("comment".to_string())
                .or_insert(Value::String(String::new()));
            object
                .entry("personality".to_string())
                .or_insert(Value::String(String::new()));
            object
                .entry("scenario".to_string())
                .or_insert(Value::String(String::new()));
            object
                .entry("backstory".to_string())
                .or_insert(Value::String(String::new()));
            object
                .entry("appearance".to_string())
                .or_insert(Value::String(String::new()));
            object
                .entry("avatarPath".to_string())
                .or_insert(Value::Null);
            object
                .entry("isActive".to_string())
                .or_insert(Value::Bool(false));
            object
                .entry("tags".to_string())
                .or_insert_with(|| json!([]));
            object
                .entry("altDescriptions".to_string())
                .or_insert_with(|| json!([]));
            object
                .entry("avatarCrop".to_string())
                .or_insert(Value::Null);
        }
        "prompts" => {
            normalize_typed_json_fields(collection, &mut object)?;
            object
                .entry("description".to_string())
                .or_insert(Value::String(String::new()));
            object
                .entry("sectionOrder".to_string())
                .or_insert_with(|| json!([]));
            object
                .entry("groupOrder".to_string())
                .or_insert_with(|| json!([]));
            object
                .entry("variableGroups".to_string())
                .or_insert_with(|| json!([]));
            object
                .entry("variableValues".to_string())
                .or_insert_with(|| json!({}));
            object
                .entry("parameters".to_string())
                .or_insert_with(|| json!({}));
            object
                .entry("defaultChoices".to_string())
                .or_insert_with(|| json!({}));
            object
                .entry("isDefault".to_string())
                .or_insert(Value::Bool(false));
        }
        "prompt-sections" | "prompt-variables" => {
            normalize_typed_json_fields(collection, &mut object)?;
        }
        "agents" => {
            normalize_typed_json_fields(collection, &mut object)?;
            object
                .entry("enabled".to_string())
                .or_insert(Value::Bool(true));
        }
        _ => {}
    }
    normalize_typed_json_fields(collection, &mut object)?;
    Ok(Value::Object(object))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempRoot(PathBuf);

    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn temp_root(test_name: &str) -> TempRoot {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        TempRoot(std::env::temp_dir().join(format!("marinara-storage-{test_name}-{suffix}")))
    }

    #[test]
    fn character_update_patch_preserves_object_data() {
        let patch = normalize_update_patch(
            "characters",
            json!({
                "data": {
                    "name": "Professor Mari",
                    "tags": ["guide"]
                }
            }),
        )
        .expect("patch should normalize");

        assert_eq!(patch["data"]["name"], "Professor Mari");
        assert_eq!(patch["data"]["tags"], json!(["guide"]));
    }

    #[test]
    fn apply_storage_search_matches_character_summary_fields() {
        let mut rows = vec![
            json!({
                "id": "char-rina",
                "comment": "ice mage",
                "avatarPath": "data:image/png;base64,needle",
                "data": {
                    "name": "Rina",
                    "creator": "Xel",
                    "creator_notes": "Frost academy rival",
                    "tags": ["Mage", "Winter"]
                }
            }),
            json!({
                "id": "char-mari",
                "comment": "assistant",
                "avatarPath": "data:image/png;base64,very-large-avatar",
                "data": {
                    "name": "Professor Mari",
                    "creator": "Pasta",
                    "creator_notes": "Codebase helper",
                    "tags": ["Guide"]
                }
            }),
        ];

        apply_storage_search(&mut rows, Some(&json!({ "search": "winter rina" })));

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "char-rina");
    }

    #[test]
    fn apply_storage_search_matches_non_ascii_case() {
        let mut rows = vec![json!({
            "id": "char-elodie",
            "data": {
                "name": "Élodie",
                "description": "Archivist"
            }
        })];

        apply_storage_search(&mut rows, Some(&json!({ "search": "élodie" })));

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "char-elodie");
    }

    #[test]
    fn apply_storage_search_matches_character_prompt_fields() {
        let rows = vec![
            json!({
                "id": "char-rina",
                "comment": "ice mage",
                "data": {
                    "name": "Rina",
                    "description": "Frost academy rival",
                    "personality": "Dry humor",
                    "scenario": "Hidden winter archive",
                    "first_mes": "The gate is frozen shut.",
                    "mes_example": "Rina: Keep up.",
                    "system_prompt": "Protect the archive.",
                    "post_history_instructions": "Stay wary.",
                    "alternate_greetings": ["The lantern sigil glows."],
                    "extensions": {
                        "backstory": "Raised by the north library.",
                        "appearance": "Silver cloak.",
                        "altDescriptions": [{ "content": "Carries an aurora lantern." }],
                        "depth_prompt": { "prompt": "The moon sigil matters." }
                    },
                    "tags": ["Mage"]
                }
            }),
            json!({
                "id": "char-mari",
                "comment": "assistant",
                "data": {
                    "name": "Professor Mari",
                    "description": "Codebase helper",
                    "tags": ["Guide"]
                }
            }),
        ];

        let mut prompt_rows = rows.clone();
        apply_storage_search(&mut prompt_rows, Some(&json!({ "search": "winter sigil" })));

        assert_eq!(prompt_rows.len(), 1);
        assert_eq!(prompt_rows[0]["id"], "char-rina");

        let mut alternate_rows = rows;
        apply_storage_search(
            &mut alternate_rows,
            Some(&json!({ "search": "aurora lantern" })),
        );

        assert_eq!(alternate_rows.len(), 1);
        assert_eq!(alternate_rows[0]["id"], "char-rina");
    }

    #[test]
    fn apply_storage_search_ignores_avatar_payload_text() {
        let mut rows = vec![json!({
            "id": "char-rina",
            "avatarPath": "data:image/png;base64,hidden-needle",
            "data": {
                "name": "Rina",
                "tags": []
            }
        })];

        apply_storage_search(&mut rows, Some(&json!({ "search": "hidden-needle" })));

        assert!(rows.is_empty());
    }

    #[test]
    fn apply_storage_search_matches_message_content_and_swipes() {
        let mut rows = vec![
            json!({
                "id": "message-direct",
                "content": "The party finds a silver key."
            }),
            json!({
                "id": "message-swipe",
                "content": "No match here.",
                "swipes": [
                    { "content": "Alternate route through the moonlit archive." }
                ]
            }),
            json!({
                "id": "message-miss",
                "content": "Plain campfire chatter."
            }),
        ];

        apply_storage_search(&mut rows, Some(&json!({ "search": "moonlit" })));

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "message-swipe");
    }

    #[test]
    fn apply_storage_search_matches_string_encoded_character_data() {
        let mut rows = vec![json!({
            "id": "char-legacy",
            "data": r#"{"name":"Legacy Rin","creator_notes":"Imported archive"}"#
        })];

        apply_storage_search(&mut rows, Some(&json!({ "search": "archive" })));

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "char-legacy");
    }

    #[test]
    fn project_list_rows_applies_field_selections_to_string_encoded_data() {
        let rows = vec![json!({
            "id": "char-legacy",
            "data": r#"{"name":"Legacy Rin","description":"large prompt","creator_notes":"Imported archive"}"#
        })];

        let projected = project_list_rows(
            rows,
            Some(&json!({
                "fields": ["id", "data"],
                "fieldSelections": { "data": ["name", "creator_notes"] }
            })),
        );

        assert_eq!(
            projected,
            vec![json!({
                "id": "char-legacy",
                "data": {
                    "name": "Legacy Rin",
                    "creator_notes": "Imported archive"
                }
            })],
        );
    }

    #[test]
    fn project_list_rows_keeps_only_legacy_avatar_path_for_summary_projection() {
        let rows = vec![
            json!({
                "id": "managed",
                "avatarPath": "data:image/png;base64,large",
                "avatarFilePath": "C:\\Marinara\\avatars\\managed.png",
                "avatarFilename": "managed.png"
            }),
            json!({
                "id": "legacy",
                "avatarPath": "data:image/png;base64,legacy"
            }),
        ];

        let projected = project_list_rows(
            rows,
            Some(&json!({
                "fields": ["id", "avatarPath", "avatarFilePath", "avatarFilename"]
            })),
        );

        assert_eq!(
            projected,
            vec![
                json!({
                    "id": "managed",
                    "avatarFilePath": "C:\\Marinara\\avatars\\managed.png",
                    "avatarFilename": "managed.png"
                }),
                json!({
                    "id": "legacy",
                    "avatarPath": "data:image/png;base64,legacy"
                })
            ],
        );
    }

    #[test]
    fn has_storage_search_ignores_empty_terms() {
        assert!(!has_storage_search(Some(&json!({ "search": "   " }))));
        assert!(!has_storage_search(Some(&json!({ "search": null }))));
        assert!(has_storage_search(Some(&json!({ "search": "rina" }))));
    }

    #[test]
    fn character_update_patch_rejects_invalid_data_shape() {
        for invalid in [
            json!(true),
            json!("{\"name\":\"Professor Mari\"}"),
            json!([]),
            Value::Null,
        ] {
            let error = normalize_update_patch("characters", json!({ "data": invalid }))
                .expect_err("invalid character data should fail");
            assert_eq!(error.code, "invalid_input");
        }
    }

    #[test]
    fn message_content_update_patch_updates_active_swipe_content() {
        let root = temp_root("message-edit-active-swipe");
        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        state
            .storage
            .create(
                "messages",
                with_entity_defaults(
                    "messages",
                    json!({
                        "id": "message-1",
                        "chatId": "chat-1",
                        "role": "user",
                        "content": "original active",
                        "activeSwipeIndex": 1,
                        "swipes": [
                            { "content": "first swipe" },
                            { "content": "original active" }
                        ]
                    }),
                )
                .expect("message defaults should apply"),
            )
            .expect("message should be created");

        let mut updated =
            patch_message_update(&state, "message-1", json!({ "content": "edited active" }))
                .expect("message should update");
        materialize_message_swipe_fields(&mut updated);

        assert_eq!(updated["content"], json!("edited active"));
        assert_eq!(updated["activeSwipeIndex"], json!(1));
        assert_eq!(updated["swipes"][0]["content"], json!("first swipe"));
        assert_eq!(updated["swipes"][1]["content"], json!("edited active"));
    }

    #[test]
    fn materialize_message_swipe_fields_uses_active_swipe_extra() {
        let mut message = json!({
            "content": "old visible",
            "activeSwipeIndex": 1,
            "extra": {
                "hiddenFromAI": true,
                "reasoning_content": "old reasoning",
                "cachedPrompt": [{ "role": "system", "content": "old prompt" }],
                "generationInfo": { "model": "old-model" }
            },
            "swipes": [
                {
                    "content": "first",
                    "extra": { "generationInfo": { "model": "first-model" } }
                },
                {
                    "content": "second",
                    "extra": {
                        "generationInfo": { "model": "second-model" },
                        "reasoning_content": "second reasoning"
                    }
                }
            ]
        });

        materialize_message_swipe_fields(&mut message);

        assert_eq!(message["content"], json!("second"));
        assert_eq!(message["extra"]["hiddenFromAI"], json!(true));
        assert_eq!(
            message["extra"]["generationInfo"]["model"],
            json!("second-model")
        );
        assert_eq!(
            message["extra"]["reasoning_content"],
            json!("second reasoning")
        );
        assert!(message["extra"]["cachedPrompt"].is_null());
    }

    #[test]
    fn materialize_message_swipe_fields_preserves_legacy_parent_extra_without_swipe_extra() {
        let mut message = json!({
            "content": "old visible",
            "activeSwipeIndex": 1,
            "extra": {
                "hiddenFromAI": true,
                "reasoning_content": "stale reasoning",
                "cachedPrompt": [{ "role": "system", "content": "old prompt" }],
                "generationInfo": { "model": "old-model" }
            },
            "swipes": [
                { "content": "first" },
                { "content": "second" }
            ]
        });

        materialize_message_swipe_fields(&mut message);

        assert_eq!(message["content"], json!("second"));
        assert_eq!(message["extra"]["hiddenFromAI"], json!(true));
        assert_eq!(
            message["extra"]["generationInfo"]["model"],
            json!("old-model")
        );
        assert_eq!(
            message["extra"]["reasoning_content"],
            json!("stale reasoning")
        );
        assert_eq!(
            message["extra"]["cachedPrompt"][0]["content"],
            json!("old prompt")
        );
    }

    #[test]
    fn message_content_update_patch_collapses_excess_blank_lines() {
        let root = temp_root("message-edit-collapse-blank-lines");
        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        state
            .storage
            .create(
                "messages",
                with_entity_defaults(
                    "messages",
                    json!({
                        "id": "message-1",
                        "chatId": "chat-1",
                        "role": "user",
                        "content": "original",
                        "activeSwipeIndex": 0,
                        "swipes": [{ "content": "original" }]
                    }),
                )
                .expect("message defaults should apply"),
            )
            .expect("message should be created");

        let mut updated = patch_message_update(
            &state,
            "message-1",
            json!({ "content": "first\n\n\n\nsecond" }),
        )
        .expect("message should update");
        materialize_message_swipe_fields(&mut updated);

        assert_eq!(updated["content"], json!("first\n\nsecond"));
        assert_eq!(updated["swipes"][0]["content"], json!("first\n\nsecond"));
    }

    #[test]
    fn message_content_update_patch_does_not_invent_missing_swipes() {
        let root = temp_root("message-edit-no-swipes");
        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "user",
                    "content": "legacy content",
                    "extra": {}
                }),
            )
            .expect("message should be created");

        let mut updated =
            patch_message_update(&state, "message-1", json!({ "content": "edited legacy" }))
                .expect("message should update");
        materialize_message_swipe_fields(&mut updated);

        assert_eq!(updated["content"], json!("edited legacy"));
        assert!(updated.get("swipes").is_none());
    }

    #[test]
    fn game_state_snapshot_normalizes_persona_stats_as_nullable_array() {
        let mut row = json!({
            "presentCharacters": "[{\"name\":\"Mari\"}]",
            "recentEvents": "[\"arrived\"]",
            "playerStats": "{\"status\":\"ready\"}",
            "personaStats": "[{\"name\":\"Energy\",\"value\":5,\"max\":10}]",
            "metadata": "{\"source\":\"qa\"}"
        });
        let object = row.as_object_mut().expect("row should be an object");

        normalize_typed_json_fields("game-state-snapshots", object)
            .expect("snapshot row should normalize");

        assert!(object["presentCharacters"].is_array());
        assert!(object["recentEvents"].is_array());
        assert!(object["playerStats"].is_object());
        assert!(object["personaStats"].is_array());
        assert!(object["metadata"].is_object());

        let mut null_row = json!({ "personaStats": null });
        let null_object = null_row.as_object_mut().expect("row should be an object");
        normalize_typed_json_fields("game-state-snapshots", null_object)
            .expect("null personaStats should normalize");
        assert!(null_object["personaStats"].is_null());

        let mut empty_row = json!({ "personaStats": "  " });
        let empty_object = empty_row.as_object_mut().expect("row should be an object");
        normalize_typed_json_fields("game-state-snapshots", empty_object)
            .expect("empty personaStats should normalize");
        assert!(empty_object["personaStats"].is_null());
    }

    #[test]
    fn lorebook_defaults_include_vectorization_enabled() {
        let row = with_entity_defaults("lorebooks", json!({ "name": "World Book" }))
            .expect("lorebook defaults should apply");

        assert_eq!(row["excludeFromVectorization"], json!(false));
    }

    #[test]
    fn game_state_snapshot_rejects_malformed_persona_stats_string() {
        let mut row = json!({ "personaStats": "{\"not\":\"an array\"}" });
        let object = row.as_object_mut().expect("row should be an object");

        let error = normalize_typed_json_fields("game-state-snapshots", object)
            .expect_err("object-shaped personaStats should fail");

        assert_eq!(error.code, "invalid_input");
        assert_eq!(error.message, "personaStats must be a JSON array or null");
    }

    #[test]
    fn normalize_legacy_text_array_fields_preserves_existing_arrays() {
        let mut record = json!({ "tags": ["a", "b"] });
        normalize_legacy_text_array_fields(&mut record, &["tags"]);
        assert_eq!(record["tags"], json!(["a", "b"]));
    }

    #[test]
    fn normalize_legacy_text_array_fields_parses_text_encoded_json_arrays() {
        let mut record = json!({ "tags": "[\"a\",\"b\"]" });
        normalize_legacy_text_array_fields(&mut record, &["tags"]);
        assert_eq!(record["tags"], json!(["a", "b"]));
    }

    #[test]
    fn normalize_legacy_text_array_fields_replaces_unparseable_string_with_empty() {
        let mut record = json!({ "tags": "not-json" });
        normalize_legacy_text_array_fields(&mut record, &["tags"]);
        assert_eq!(record["tags"], json!([]));
    }

    #[test]
    fn normalize_legacy_text_array_fields_replaces_non_array_json_string_with_empty() {
        let mut record = json!({ "tags": "{\"oops\":true}" });
        normalize_legacy_text_array_fields(&mut record, &["tags"]);
        assert_eq!(record["tags"], json!([]));
    }

    #[test]
    fn normalize_legacy_text_array_fields_replaces_scalar_with_empty() {
        let mut record = json!({ "tags": 7 });
        normalize_legacy_text_array_fields(&mut record, &["tags"]);
        assert_eq!(record["tags"], json!([]));
    }

    #[test]
    fn normalize_legacy_text_array_fields_replaces_null_with_empty() {
        let mut record = json!({ "tags": null });
        normalize_legacy_text_array_fields(&mut record, &["tags"]);
        assert_eq!(record["tags"], json!([]));
    }

    #[test]
    fn normalize_legacy_text_array_fields_leaves_missing_keys_alone() {
        let mut record = json!({ "other": "value" });
        normalize_legacy_text_array_fields(&mut record, &["tags"]);
        assert!(!record.as_object().unwrap().contains_key("tags"));
    }

    #[test]
    fn normalize_legacy_text_array_fields_ignores_non_object_records() {
        let mut record = json!("scalar");
        normalize_legacy_text_array_fields(&mut record, &["tags"]);
        assert_eq!(record, json!("scalar"));
    }

    #[test]
    fn normalize_legacy_text_bool_fields_preserves_existing_bools() {
        let mut record = json!({ "isGlobal": true, "enabled": false });
        normalize_legacy_text_bool_fields(&mut record, &["isGlobal", "enabled"]);
        assert_eq!(record["isGlobal"], json!(true));
        assert_eq!(record["enabled"], json!(false));
    }

    #[test]
    fn normalize_legacy_text_bool_fields_coerces_text_true_and_false() {
        let mut record = json!({ "isGlobal": "true", "enabled": "false" });
        normalize_legacy_text_bool_fields(&mut record, &["isGlobal", "enabled"]);
        assert_eq!(record["isGlobal"], json!(true));
        assert_eq!(record["enabled"], json!(false));
    }

    #[test]
    fn normalize_legacy_text_bool_fields_coerces_truthy_text_aliases() {
        for alias in ["1", "yes", "on", "TRUE", "  Yes  "] {
            let mut record = json!({ "flag": alias });
            normalize_legacy_text_bool_fields(&mut record, &["flag"]);
            assert_eq!(
                record["flag"],
                json!(true),
                "alias {alias:?} should be true"
            );
        }
    }

    #[test]
    fn normalize_legacy_text_bool_fields_coerces_falsy_text_aliases() {
        for alias in ["0", "no", "off", "FALSE", "  No  "] {
            let mut record = json!({ "flag": alias });
            normalize_legacy_text_bool_fields(&mut record, &["flag"]);
            assert_eq!(
                record["flag"],
                json!(false),
                "alias {alias:?} should be false"
            );
        }
    }

    #[test]
    fn normalize_legacy_text_bool_fields_defaults_unknown_string_to_false() {
        let mut record = json!({ "flag": "maybe" });
        normalize_legacy_text_bool_fields(&mut record, &["flag"]);
        assert_eq!(record["flag"], json!(false));
    }

    #[test]
    fn normalize_legacy_text_bool_fields_coerces_zero_and_non_zero_numbers() {
        let mut record = json!({ "off": 0, "on": 1, "neg": -3 });
        normalize_legacy_text_bool_fields(&mut record, &["off", "on", "neg"]);
        assert_eq!(record["off"], json!(false));
        assert_eq!(record["on"], json!(true));
        assert_eq!(record["neg"], json!(true));
    }

    #[test]
    fn normalize_legacy_text_bool_fields_coerces_float_zero_and_non_zero() {
        let mut record = json!({ "off": 0.0, "on": 1.5 });
        normalize_legacy_text_bool_fields(&mut record, &["off", "on"]);
        assert_eq!(record["off"], json!(false));
        assert_eq!(record["on"], json!(true));
    }

    #[test]
    fn normalize_legacy_text_bool_fields_defaults_null_to_false() {
        let mut record = json!({ "flag": null });
        normalize_legacy_text_bool_fields(&mut record, &["flag"]);
        assert_eq!(record["flag"], json!(false));
    }

    #[test]
    fn normalize_legacy_text_bool_fields_leaves_missing_keys_alone() {
        let mut record = json!({ "other": "value" });
        normalize_legacy_text_bool_fields(&mut record, &["flag"]);
        assert!(!record.as_object().unwrap().contains_key("flag"));
    }

    #[test]
    fn normalize_legacy_text_bool_fields_ignores_non_object_records() {
        let mut record = json!("scalar");
        normalize_legacy_text_bool_fields(&mut record, &["flag"]);
        assert_eq!(record, json!("scalar"));
    }

    #[test]
    fn chat_preset_defaults_normalize_boolish_flags() {
        let row = with_entity_defaults(
            "chat-presets",
            json!({
                "name": "Imported Preset",
                "mode": "roleplay",
                "parameters": {},
                "isDefault": "false",
                "default": "0",
                "isActive": "true",
                "active": "yes"
            }),
        )
        .expect("chat preset defaults should normalize");

        assert_eq!(row["isDefault"], json!(false));
        assert_eq!(row["default"], json!(false));
        assert_eq!(row["isActive"], json!(true));
        assert_eq!(row["active"], json!(true));
    }

    #[test]
    fn decode_uploaded_image_file_rejects_declared_oversized_upload() {
        let result = decode_uploaded_image_file(&json!({
            "file": {
                "name": "huge.png",
                "type": "image/png",
                "size": MAX_IMAGE_UPLOAD_BYTES + 1,
                "base64": ""
            }
        }));

        let Err(error) = result else {
            panic!("declared oversized image upload should fail before decode");
        };
        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("20 MB"));
    }

    #[test]
    fn decode_uploaded_image_file_rejects_non_image_content_type() {
        let result = decode_uploaded_image_file(&json!({
            "file": {
                "name": "notes.txt",
                "type": "text/plain",
                "size": 4,
                "base64": "bm9wZQ=="
            }
        }));

        let Err(error) = result else {
            panic!("non-image upload should fail before storage");
        };
        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("Only image uploads"));
    }
}

pub(crate) fn duplicate_record(state: &AppState, collection: &str, id: &str) -> AppResult<Value> {
    let mut record = get_required(state, collection, id)?;
    let object = record
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Record is not an object"))?;
    object.remove("id");
    if let Some(name) = object
        .get("name")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        object.insert("name".to_string(), Value::String(format!("{name} Copy")));
    }
    state.storage.create(collection, record)
}

pub(crate) fn find_by_field(
    state: &AppState,
    collection: &str,
    field: &str,
    value: &str,
) -> AppResult<Option<Value>> {
    let mut filters = Map::new();
    filters.insert(field.to_string(), Value::String(value.to_string()));
    Ok(state
        .storage
        .list_where(collection, &filters)?
        .into_iter()
        .next())
}

pub(crate) fn decode_path(value: &str) -> String {
    value
        .replace("%2F", "/")
        .replace("%5C", "\\")
        .replace("%20", " ")
}

pub(crate) fn required_string<'a>(body: &'a Value, key: &str) -> AppResult<&'a str> {
    body.get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::invalid_input(format!("{key} is required")))
}

pub(crate) fn string_array_from_value(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(Value::as_str)
            .filter(|item| !item.trim().is_empty())
            .map(ToOwned::to_owned)
            .collect(),
        Some(Value::String(raw)) => serde_json::from_str::<Vec<String>>(raw).unwrap_or_default(),
        _ => Vec::new(),
    }
}

/// Replace any text-encoded boolean field on a record object with a real
/// JSON boolean. The pre-refactor server stored bool columns as TEXT
/// (`"true"` / `"false"` strings); the refactor frontend reads these
/// directly, so `lorebook.isGlobal === "false"` evaluates truthy and every
/// scoped lorebook renders as a global one. Called from the migration
/// import paths to bridge that schema gap.
pub(crate) fn normalize_legacy_text_bool_fields(record: &mut Value, fields: &[&str]) {
    let Some(object) = record.as_object_mut() else {
        return;
    };
    for field in fields {
        let Some(entry) = object.get_mut(*field) else {
            continue;
        };
        if entry.is_boolean() {
            continue;
        }
        let coerced = match entry.as_str().map(str::trim).map(str::to_ascii_lowercase) {
            Some(raw) if raw == "true" || raw == "1" || raw == "yes" || raw == "on" => true,
            Some(raw) if raw == "false" || raw == "0" || raw == "no" || raw == "off" => false,
            _ => match entry.as_i64() {
                Some(n) => n != 0,
                // NaN is unordered against 0.0, so the naive `n != 0.0` check
                // would treat it as truthy. Short-circuit to false.
                None => match entry.as_f64() {
                    Some(n) if n.is_nan() => false,
                    Some(n) => n != 0.0,
                    None => false,
                },
            },
        };
        *entry = Value::Bool(coerced);
    }
}

/// Replace any text-encoded JSON-array field on a record object with a real
/// JSON array. The pre-refactor server stored `tags`, `characterIds`,
/// `personaIds`, etc. as TEXT columns (a JSON-stringified array); the
/// refactor expects an actual JSON array on every row, and the frontend
/// crashes (`.map is not a function`) when it sees a string. Called from the
/// migration import paths to bridge that schema gap.
pub(crate) fn normalize_legacy_text_array_fields(record: &mut Value, fields: &[&str]) {
    let Some(object) = record.as_object_mut() else {
        return;
    };
    for field in fields {
        let Some(entry) = object.get_mut(*field) else {
            continue;
        };
        if entry.is_array() {
            continue;
        }
        // String -> parse as JSON array, fall back to empty.
        // Anything else (null, number, bool, object) -> empty array. Pre-refactor
        // should only emit array or text-encoded array here; any other shape is a
        // malformed legacy value that must not reach the editor as-is.
        if let Some(raw) = entry.as_str() {
            *entry = serde_json::from_str::<Value>(raw)
                .ok()
                .filter(Value::is_array)
                .unwrap_or_else(|| json!([]));
        } else {
            *entry = json!([]);
        }
    }
}

#[derive(Clone)]
pub(crate) struct UploadedFile {
    pub(crate) name: String,
    pub(crate) content_type: String,
    pub(crate) bytes: Vec<u8>,
}

const MAX_IMAGE_UPLOAD_BYTES: usize = 20 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_BASE64_CHARS: usize = MAX_IMAGE_UPLOAD_BYTES.div_ceil(3) * 4;

fn image_upload_too_large_error() -> AppError {
    AppError::invalid_input("Image uploads must be 20 MB or smaller")
}

fn image_upload_invalid_type_error() -> AppError {
    AppError::invalid_input("Only image uploads are allowed")
}

pub(crate) fn decode_uploaded_file_value(file: &Value) -> AppResult<UploadedFile> {
    let name = file
        .get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| AppError::invalid_input("uploaded file is missing a name"))?
        .to_string();
    let content_type = file
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("application/octet-stream")
        .to_string();
    let base64 = file
        .get("base64")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("uploaded file is missing base64 data"))?;
    let bytes = general_purpose::STANDARD
        .decode(base64)
        .map_err(|error| AppError::invalid_input(format!("Invalid upload encoding: {error}")))?;
    Ok(UploadedFile {
        name,
        content_type,
        bytes,
    })
}

pub(crate) fn decode_uploaded_file(body: &Value) -> AppResult<(String, String, Vec<u8>)> {
    let file = body
        .get("file")
        .ok_or_else(|| AppError::invalid_input("file is required"))?;
    let uploaded = decode_uploaded_file_value(file)?;
    Ok((uploaded.name, uploaded.content_type, uploaded.bytes))
}

pub(crate) fn decode_uploaded_image_file(body: &Value) -> AppResult<UploadedFile> {
    let file = body
        .get("file")
        .ok_or_else(|| AppError::invalid_input("file is required"))?;
    let content_type = file
        .get("type")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|content_type| !content_type.is_empty())
        .ok_or_else(image_upload_invalid_type_error)?;
    if !content_type.to_ascii_lowercase().starts_with("image/") {
        return Err(image_upload_invalid_type_error());
    }
    if let Some(size) = file.get("size").and_then(Value::as_u64) {
        if size > MAX_IMAGE_UPLOAD_BYTES as u64 {
            return Err(image_upload_too_large_error());
        }
    }
    if file
        .get("base64")
        .and_then(Value::as_str)
        .is_some_and(|base64| base64.len() > MAX_IMAGE_UPLOAD_BASE64_CHARS)
    {
        return Err(image_upload_too_large_error());
    }
    let uploaded = decode_uploaded_file_value(file)?;
    if uploaded.bytes.len() > MAX_IMAGE_UPLOAD_BYTES {
        return Err(image_upload_too_large_error());
    }
    Ok(uploaded)
}

pub(crate) fn decode_uploaded_files(body: &Value, field: &str) -> AppResult<Vec<UploadedFile>> {
    let Some(value) = body.get(field) else {
        return Ok(Vec::new());
    };
    match value {
        Value::Array(items) => items.iter().map(decode_uploaded_file_value).collect(),
        Value::Object(_) => decode_uploaded_file_value(value).map(|file| vec![file]),
        _ => Err(AppError::invalid_input(format!(
            "{field} must contain uploaded file objects"
        ))),
    }
}

pub(crate) fn upload_gallery_image(
    state: &AppState,
    collection: &str,
    parent_field: &str,
    parent_id: &str,
    body: Value,
) -> AppResult<Value> {
    let uploaded = decode_uploaded_image_file(&body)?;
    let encoded = general_purpose::STANDARD.encode(&uploaded.bytes);
    let data_url = format!("data:{};base64,{encoded}", uploaded.content_type);
    let mut record = Map::new();
    record.insert(
        parent_field.to_string(),
        Value::String(parent_id.to_string()),
    );
    record.insert("filePath".to_string(), Value::String(uploaded.name.clone()));
    record.insert("filename".to_string(), Value::String(uploaded.name));
    record.insert("url".to_string(), Value::String(data_url));
    record.insert("prompt".to_string(), Value::Null);
    record.insert("provider".to_string(), Value::Null);
    record.insert("model".to_string(), Value::Null);
    record.insert("width".to_string(), Value::Null);
    record.insert("height".to_string(), Value::Null);
    state.storage.create(collection, Value::Object(record))
}

pub(crate) fn project_list_rows(rows: Vec<Value>, options: Option<&Value>) -> Vec<Value> {
    let Some(fields) = option_string_array(options, "fields") else {
        return rows;
    };
    if fields.is_empty() {
        return rows;
    }

    rows.into_iter()
        .map(|row| project_row(row, &fields, options))
        .collect()
}

pub(crate) fn project_record(row: Value, options: Option<&Value>) -> Value {
    let Some(fields) = option_string_array(options, "fields") else {
        return row;
    };
    if fields.is_empty() {
        return row;
    }
    project_row(row, &fields, options)
}

pub(crate) fn projection_fields(options: Option<&Value>) -> Option<Vec<String>> {
    option_string_array(options, "fields").map(|fields| {
        fields
            .into_iter()
            .map(|field| field.trim().to_string())
            .filter(|field| !field.is_empty())
            .collect()
    })
}

pub(crate) fn projection_field_selections(
    options: Option<&Value>,
) -> &serde_json::Map<String, Value> {
    if let Some(selections) = options
        .and_then(|value| value.get("fieldSelections"))
        .and_then(Value::as_object)
    {
        selections
    } else {
        empty_projection_field_selections()
    }
}

fn empty_projection_field_selections() -> &'static serde_json::Map<String, Value> {
    static EMPTY: std::sync::OnceLock<serde_json::Map<String, Value>> = std::sync::OnceLock::new();
    EMPTY.get_or_init(serde_json::Map::new)
}

/// Character data subfields added to projected rows so storage search can
/// match card metadata and prompt text without returning embedded avatars.
const CHARACTER_DATA_SEARCH_FIELDS: &[&str] = &[
    "name",
    "creator",
    "creator_notes",
    "tags",
    "description",
    "personality",
    "scenario",
    "first_mes",
    "mes_example",
    "system_prompt",
    "post_history_instructions",
    "alternate_greetings",
    "extensions",
];

/// Expands top-level projection fields for searchable list queries.
///
/// The returned field set preserves the caller's requested projection, then
/// adds fields searched by `apply_storage_search` plus default/orderBy sort
/// fields needed before the final caller-facing projection is applied.
pub(crate) fn search_projection_fields(options: Option<&Value>) -> Vec<String> {
    let mut fields = projection_fields(options).unwrap_or_default();
    for field in [
        "id",
        "name",
        "comment",
        "content",
        "swipes",
        "data",
        "sortOrder",
        "order",
        "createdAt",
        "updatedAt",
    ] {
        if !fields.iter().any(|existing| existing == field) {
            fields.push(field.to_string());
        }
    }
    if let Some(order_by) = options
        .and_then(|value| value.get("orderBy"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if !fields.iter().any(|existing| existing == order_by) {
            fields.push(order_by.to_string());
        }
    }
    fields
}

/// Expands nested projection selections for searchable character data.
///
/// When callers request a subset of `data`, this adds the character fields that
/// search needs for matching, then final projection narrows the response again.
pub(crate) fn search_projection_field_selections(
    options: Option<&Value>,
) -> serde_json::Map<String, Value> {
    let mut selections = projection_field_selections(options).clone();
    let original_fields = projection_fields(options).unwrap_or_default();
    let original_requests_data = original_fields.iter().any(|field| field == "data");
    let original_data_fields = selections.get("data").and_then(string_array_from_json);
    // Preserve explicit full-data projections. If the caller requested `data`
    // and `original_data_fields` is absent or empty, returning the original
    // `selections` lets storage return complete data for search and response.
    if original_requests_data
        && original_data_fields
            .as_ref()
            .is_none_or(|fields| fields.is_empty())
    {
        return selections;
    }

    let mut data_fields = original_data_fields.unwrap_or_default();
    for field in CHARACTER_DATA_SEARCH_FIELDS {
        if !data_fields.iter().any(|existing| existing == field) {
            data_fields.push(field.to_string());
        }
    }
    selections.insert(
        "data".to_string(),
        Value::Array(data_fields.into_iter().map(Value::String).collect()),
    );
    selections
}

pub(crate) fn apply_storage_search(rows: &mut Vec<Value>, options: Option<&Value>) {
    let Some(query) = storage_search_query(options) else {
        return;
    };
    let terms = query
        .split_whitespace()
        .map(|term| term.to_lowercase())
        .filter(|term| !term.is_empty())
        .collect::<Vec<_>>();
    if terms.is_empty() {
        return;
    }
    rows.retain(|row| terms.iter().all(|term| row_matches_search_term(row, term)));
}

pub(crate) fn has_storage_search(options: Option<&Value>) -> bool {
    storage_search_query(options).is_some()
}

fn storage_search_query(options: Option<&Value>) -> Option<&str> {
    options
        .and_then(|value| value.get("search"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn row_matches_search_term(row: &Value, term: &str) -> bool {
    let Some(object) = row.as_object() else {
        return false;
    };
    value_matches_search_term(object.get("id"), term)
        || value_matches_search_term(object.get("name"), term)
        || value_matches_search_term(object.get("comment"), term)
        || value_matches_search_term(object.get("content"), term)
        || swipe_content_matches_search_term(object.get("swipes"), term)
        || json_object_value(object.get("data")).is_some_and(|data| {
            let Some(data) = data.as_object() else {
                return false;
            };
            value_matches_search_term(data.get("name"), term)
                || value_matches_search_term(data.get("creator"), term)
                || value_matches_search_term(data.get("creator_notes"), term)
                || value_matches_search_term(data.get("tags"), term)
                || value_matches_search_term(data.get("description"), term)
                || value_matches_search_term(data.get("personality"), term)
                || value_matches_search_term(data.get("scenario"), term)
                || value_matches_search_term(data.get("first_mes"), term)
                || value_matches_search_term(data.get("mes_example"), term)
                || value_matches_search_term(data.get("system_prompt"), term)
                || value_matches_search_term(data.get("post_history_instructions"), term)
                || value_matches_search_term(data.get("alternate_greetings"), term)
                || character_extension_matches_search_term(data.get("extensions"), term)
        })
}

fn value_matches_search_term(value: Option<&Value>, term: &str) -> bool {
    match value {
        Some(Value::String(value)) => value.to_lowercase().contains(term),
        Some(Value::Array(values)) => values
            .iter()
            .any(|value| value_matches_search_term(Some(value), term)),
        _ => false,
    }
}

fn character_extension_matches_search_term(value: Option<&Value>, term: &str) -> bool {
    let Some(extensions) = json_object_value(value) else {
        return false;
    };
    let Some(extensions) = extensions.as_object() else {
        return false;
    };
    value_matches_search_term(extensions.get("backstory"), term)
        || value_matches_search_term(extensions.get("appearance"), term)
        || value_matches_search_term(extensions.get("world"), term)
        || character_alt_description_matches_search_term(extensions.get("altDescriptions"), term)
        || json_object_value(extensions.get("depth_prompt")).is_some_and(|depth_prompt| {
            depth_prompt.as_object().is_some_and(|depth_prompt| {
                value_matches_search_term(depth_prompt.get("prompt"), term)
            })
        })
}

fn character_alt_description_matches_search_term(value: Option<&Value>, term: &str) -> bool {
    let Some(Value::Array(alt_descriptions)) = value else {
        return false;
    };
    alt_descriptions.iter().any(|entry| {
        json_object_value(Some(entry)).is_some_and(|entry| {
            entry.as_object().is_some_and(|entry| {
                value_matches_search_term(entry.get("label"), term)
                    || value_matches_search_term(entry.get("content"), term)
            })
        })
    })
}

fn swipe_content_matches_search_term(value: Option<&Value>, term: &str) -> bool {
    let Some(Value::Array(swipes)) = value else {
        return false;
    };
    swipes
        .iter()
        .any(|swipe| value_matches_search_term(swipe.get("content"), term))
}

fn project_row(row: Value, fields: &[String], options: Option<&Value>) -> Value {
    let Value::Object(object) = row else {
        return row;
    };
    let mut projected = Map::new();
    let omit_redundant_avatar_path = fields
        .iter()
        .any(|field| field == "avatarFilePath" || field == "avatarFilename")
        && [object.get("avatarFilePath"), object.get("avatarFilename")]
            .into_iter()
            .flatten()
            .any(|value| value.as_str().is_some_and(|value| !value.trim().is_empty()));
    for field in fields {
        if field == "avatarPath" && omit_redundant_avatar_path {
            continue;
        }
        let Some(value) = object.get(field) else {
            continue;
        };
        projected.insert(
            field.clone(),
            project_nested_field(field, value.clone(), options),
        );
    }
    Value::Object(projected)
}

fn project_nested_field(field: &str, value: Value, options: Option<&Value>) -> Value {
    let Some(nested_fields) = options
        .and_then(|value| value.get("fieldSelections"))
        .and_then(Value::as_object)
        .and_then(|selections| selections.get(field))
        .and_then(string_array_from_json)
    else {
        return value;
    };
    if nested_fields.is_empty() {
        return value;
    }
    match value {
        Value::String(raw) => match serde_json::from_str::<Value>(&raw) {
            Ok(Value::Object(object)) => project_object_nested_fields(&object, &nested_fields),
            _ => Value::String(raw),
        },
        Value::Object(object) => project_object_nested_fields(&object, &nested_fields),
        other => other,
    }
}

fn project_object_nested_fields(object: &Map<String, Value>, nested_fields: &[String]) -> Value {
    let mut projected = Map::new();
    for nested_field in nested_fields {
        if let Some(nested_value) = object.get(nested_field) {
            projected.insert(nested_field.clone(), nested_value.clone());
        }
    }
    Value::Object(projected)
}

fn option_string_array(options: Option<&Value>, key: &str) -> Option<Vec<String>> {
    options
        .and_then(|value| value.get(key))
        .and_then(string_array_from_json)
}

fn string_array_from_json(value: &Value) -> Option<Vec<String>> {
    value.as_array().map(|items| {
        items
            .iter()
            .filter_map(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .map(ToOwned::to_owned)
            .collect()
    })
}

pub(crate) fn metadata_map(chat: &Value) -> Map<String, Value> {
    match chat.get("metadata") {
        Some(Value::Object(object)) => object.clone(),
        Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}
