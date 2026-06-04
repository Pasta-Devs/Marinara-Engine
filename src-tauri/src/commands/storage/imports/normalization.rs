use super::*;

pub(super) fn string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}
pub(super) fn string_array(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(Value::as_str)
            .map(ToOwned::to_owned)
            .collect(),
        Some(Value::String(raw)) if !raw.trim().is_empty() => {
            serde_json::from_str::<Vec<String>>(raw).unwrap_or_else(|_| vec![raw.to_string()])
        }
        _ => Vec::new(),
    }
}
pub(super) fn first_string(values: Vec<Option<&Value>>) -> String {
    values
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .map(str::trim)
        .find(|value| !value.is_empty())
        .unwrap_or("")
        .to_string()
}
pub(super) fn source_character_data(payload: &Value) -> Value {
    if matches!(
        payload.get("spec").and_then(Value::as_str),
        Some("chara_card_v2" | "chara_card_v3")
    ) {
        return payload
            .get("data")
            .filter(|value| value.is_object())
            .cloned()
            .unwrap_or_else(|| payload.clone());
    }
    if payload.get("type").and_then(Value::as_str) == Some("character") {
        return payload
            .get("data")
            .filter(|value| value.is_object())
            .cloned()
            .unwrap_or_else(|| payload.clone());
    }
    payload.clone()
}
pub(super) fn embedded_lorebook(payload: &Value) -> Option<Value> {
    let wrapped = source_character_data(payload);
    let mut candidates = Vec::new();
    if let Some(book) = payload.get("character_book") {
        candidates.push(book);
    }
    if let Some(book) = wrapped.get("character_book") {
        candidates.push(book);
    }
    if let Some(book) = payload
        .get("data")
        .and_then(|data| data.get("character_book"))
    {
        candidates.push(book);
    }
    candidates
        .into_iter()
        .filter(|book| lorebook_entry_count(book) > 0)
        .max_by_key(|book| lorebook_entry_count(book))
        .cloned()
}

pub(super) fn alt_descriptions(data: &Value) -> Value {
    data.get("extensions")
        .and_then(|extensions| extensions.get("altDescriptions"))
        .or_else(|| {
            data.get("extensions")
                .and_then(|extensions| extensions.get("alt_descriptions"))
        })
        .or_else(|| data.get("altDescriptions"))
        .or_else(|| data.get("alternate_descriptions"))
        .filter(|value| value.is_array())
        .cloned()
        .unwrap_or_else(|| json!([]))
}

pub(super) fn strip_stale_embedded_lorebook_pointer(data: &mut Value) {
    if let Some(book) = data.pointer_mut("/extensions/importMetadata/embeddedLorebook") {
        if let Some(object) = book.as_object_mut() {
            object.remove("lorebookId");
        }
    }
}

pub(super) fn character_import_extensions(
    payload: &Value,
    data: &Value,
    embedded: Option<&Value>,
) -> Value {
    let mut extensions = data
        .get("extensions")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    extensions
        .entry("altDescriptions".to_string())
        .or_insert_with(|| alt_descriptions(data));
    let bot_browser_source = string_field(payload, "_botBrowserSource");
    if !bot_browser_source.trim().is_empty() {
        extensions.insert("botBrowserSource".to_string(), json!(bot_browser_source));
    }
    let import_metadata = extensions
        .entry("importMetadata".to_string())
        .or_insert_with(|| json!({}));
    if let Some(import_metadata) = import_metadata.as_object_mut() {
        import_metadata.insert(
            "card".to_string(),
            json!({
                "spec": payload.get("spec").and_then(Value::as_str).unwrap_or("chara_card_v2"),
                "specVersion": payload.get("spec_version").and_then(Value::as_str).unwrap_or("2.0"),
                "format": payload.get("spec").and_then(Value::as_str).unwrap_or("chara_card_v2")
            }),
        );
        if let Some(book) = embedded {
            import_metadata.insert(
                "embeddedLorebook".to_string(),
                json!({
                    "hasEmbeddedLorebook": true,
                    "entries": lorebook_entry_count(book)
                }),
            );
        }
    }
    Value::Object(extensions)
}

pub(super) fn normalize_character_data(
    payload: &Value,
    tag_mode: &str,
    existing_tags: &[String],
) -> Value {
    let data = source_character_data(payload);
    let embedded = embedded_lorebook(payload);
    let mut tags = string_array(data.get("tags"));
    if tag_mode == "none" {
        tags.clear();
    } else if tag_mode == "existing" {
        let keys: Vec<String> = existing_tags.iter().map(|tag| tag.to_lowercase()).collect();
        tags.retain(|tag| keys.contains(&tag.to_lowercase()));
    }
    let mut normalized = json!({
        "name": first_string(vec![data.get("name"), payload.get("char_name"), payload.get("name")]).if_empty("Imported Character"),
        "description": first_string(vec![data.get("description"), payload.get("char_persona")]),
        "personality": first_string(vec![data.get("personality"), payload.get("personality")]),
        "scenario": first_string(vec![data.get("scenario"), payload.get("world_scenario")]),
        "first_mes": first_string(vec![data.get("first_mes"), payload.get("char_greeting"), payload.get("first_mes")]),
        "mes_example": first_string(vec![data.get("mes_example"), payload.get("example_dialogue")]),
        "creator_notes": first_string(vec![data.get("creator_notes"), payload.get("creatorcomment"), payload.get("comment")]),
        "system_prompt": first_string(vec![data.get("system_prompt"), payload.get("system_prompt")]),
        "post_history_instructions": first_string(vec![data.get("post_history_instructions"), payload.get("post_history_instructions")]),
        "tags": tags,
        "creator": first_string(vec![data.get("creator"), payload.get("creator")]),
        "character_version": first_string(vec![data.get("character_version"), payload.get("character_version")]).if_empty("1.0"),
        "alternate_greetings": string_array(data.get("alternate_greetings")),
        "extensions": character_import_extensions(payload, &data, embedded.as_ref()),
        "character_book": embedded.unwrap_or(Value::Null),
    });
    strip_stale_embedded_lorebook_pointer(&mut normalized);
    normalized
}

trait ImportStringFallback {
    fn if_empty(self, fallback: &str) -> String;
}

impl ImportStringFallback for String {
    fn if_empty(self, fallback: &str) -> String {
        if self.trim().is_empty() {
            fallback.to_string()
        } else {
            self
        }
    }
}

pub(crate) fn lorebook_entries(value: &Value) -> Vec<Value> {
    match value.get("entries") {
        Some(Value::Array(items)) => items.clone(),
        Some(Value::Object(map)) => map.values().cloned().collect(),
        _ => Vec::new(),
    }
}

pub(crate) fn lorebook_entry_count(value: &Value) -> usize {
    lorebook_entries(value).len()
}

pub(super) fn number(value: Option<&Value>, fallback: i64) -> i64 {
    value
        .and_then(|value| {
            value
                .as_i64()
                .or_else(|| value.as_str().and_then(|raw| raw.parse::<i64>().ok()))
        })
        .unwrap_or(fallback)
}

pub(super) fn optional_number(value: Option<&Value>) -> Value {
    value
        .and_then(|value| {
            value
                .as_i64()
                .or_else(|| value.as_str().and_then(|raw| raw.parse::<i64>().ok()))
        })
        .map_or(Value::Null, |value| json!(value))
}

pub(super) fn bool_field(value: Option<&Value>, fallback: bool) -> bool {
    value.and_then(Value::as_bool).unwrap_or(fallback)
}

fn selective_logic_value(value: Option<&Value>) -> &'static str {
    let raw = match value {
        Some(Value::String(raw)) => raw.trim().to_ascii_lowercase(),
        Some(Value::Number(raw)) => raw.as_i64().unwrap_or(0).to_string(),
        _ => String::new(),
    };
    match raw.as_str() {
        "1" | "or" => "or",
        "2" | "not" => "not",
        _ => "and",
    }
}

pub(crate) fn normalize_lorebook_entry(lorebook_id: &str, entry: &Value, index: usize) -> Value {
    let keys = entry.get("key").or_else(|| entry.get("keys"));
    let secondary = entry
        .get("keysecondary")
        .or_else(|| entry.get("secondary_keys"))
        .or_else(|| entry.get("secondaryKeys"));
    let enabled = entry
        .get("disable")
        .and_then(Value::as_bool)
        .map(|disabled| !disabled)
        .unwrap_or_else(|| bool_field(entry.get("enabled"), true));
    let role = entry
        .get("role")
        .and_then(Value::as_str)
        .filter(|role| matches!(*role, "user" | "assistant" | "system"))
        .unwrap_or("system");
    let position = match entry.get("position") {
        Some(Value::String(raw)) if raw == "after_char" => 1,
        Some(Value::String(raw)) if raw == "at_depth" || raw == "depth" => 2,
        Some(Value::Number(raw)) => raw.as_i64().unwrap_or(0),
        _ => 0,
    };
    let probability = match entry
        .get("useProbability")
        .or_else(|| entry.get("use_probability"))
        .and_then(Value::as_bool)
    {
        Some(false) => Value::Null,
        _ => optional_number(entry.get("probability")),
    };
    json!({
        "lorebookId": lorebook_id,
        "name": entry.get("comment").or_else(|| entry.get("name")).and_then(Value::as_str).unwrap_or(&format!("Entry {}", index + 1)),
        "content": string_field(entry, "content"),
        "description": string_field(entry, "description"),
        "keys": string_array(keys),
        "secondaryKeys": string_array(secondary),
        "enabled": enabled,
        "constant": bool_field(entry.get("constant"), false),
        "selective": bool_field(entry.get("selective"), false),
        "selectiveLogic": selective_logic_value(entry.get("selectiveLogic").or_else(|| entry.get("selective_logic"))),
        "probability": probability,
        "scanDepth": optional_number(entry.get("scanDepth").or_else(|| entry.get("scan_depth"))),
        "matchWholeWords": bool_field(entry.get("matchWholeWords").or_else(|| entry.get("match_whole_words")), false),
        "caseSensitive": bool_field(entry.get("caseSensitive").or_else(|| entry.get("case_sensitive")), false),
        "useRegex": bool_field(entry.get("useRegex").or_else(|| entry.get("regex")), false),
        "characterFilterMode": "any",
        "characterFilterIds": [],
        "characterTagFilterMode": "any",
        "characterTagFilters": [],
        "generationTriggerFilterMode": "any",
        "generationTriggerFilters": [],
        "additionalMatchingSources": [],
        "position": position,
        "depth": number(entry.get("depth"), 4),
        "order": number(entry.get("order").or_else(|| entry.get("insertion_order")).or_else(|| entry.get("uid")).or_else(|| entry.get("id")), index as i64),
        "role": role,
        "sticky": optional_number(entry.get("sticky")),
        "cooldown": optional_number(entry.get("cooldown")),
        "delay": optional_number(entry.get("delay")),
        "ephemeral": optional_number(entry.get("ephemeral")),
        "group": string_field(entry, "group"),
        "groupWeight": optional_number(entry.get("groupWeight")),
        "folderId": Value::Null,
        "preventRecursion": bool_field(entry.get("preventRecursion").or_else(|| entry.get("excludeRecursion")), false),
        "locked": bool_field(entry.get("locked"), false),
        "tag": "",
        "relationships": {},
        "dynamicState": {},
        "activationConditions": [],
        "schedule": Value::Null,
        "excludeFromVectorization": false,
    })
}

pub(super) fn normalize_imported_lorebook_entry(
    lorebook_id: &str,
    entry: &Value,
    index: usize,
) -> Value {
    let mut object =
        ensure_object(normalize_lorebook_entry(lorebook_id, entry, index)).unwrap_or_default();
    if let Some(source) = entry.as_object() {
        for (key, value) in source {
            if key != "id" && key != "lorebookId" {
                object.insert(key.clone(), value.clone());
            }
        }
    }

    if !object.contains_key("keys") {
        if let Some(keys) = entry.get("key").or_else(|| entry.get("keys")) {
            object.insert(
                "keys".to_string(),
                Value::Array(
                    string_array(Some(keys))
                        .into_iter()
                        .map(Value::String)
                        .collect(),
                ),
            );
        }
    }
    if !object.contains_key("secondaryKeys") {
        if let Some(keys) = entry
            .get("keysecondary")
            .or_else(|| entry.get("secondary_keys"))
            .or_else(|| entry.get("secondaryKeys"))
        {
            object.insert(
                "secondaryKeys".to_string(),
                Value::Array(
                    string_array(Some(keys))
                        .into_iter()
                        .map(Value::String)
                        .collect(),
                ),
            );
        }
    }
    if let Some(disabled) = entry.get("disable").and_then(Value::as_bool) {
        object.insert("enabled".to_string(), Value::Bool(!disabled));
    }
    if let Some(position) = object.get("position").cloned() {
        let normalized_position = match position {
            Value::String(raw) if raw == "after_char" => Some(1),
            Value::String(raw) if raw == "at_depth" || raw == "depth" => Some(2),
            Value::String(raw) => raw.parse::<i64>().ok(),
            Value::Number(number) => number.as_i64(),
            _ => None,
        };
        if let Some(position) = normalized_position {
            object.insert("position".to_string(), json!(position));
        }
    }
    if !matches!(
        object.get("role").and_then(Value::as_str),
        Some("user" | "assistant" | "system")
    ) {
        object.insert("role".to_string(), Value::String("system".to_string()));
    }
    object.insert(
        "selectiveLogic".to_string(),
        Value::String(
            selective_logic_value(
                object
                    .get("selectiveLogic")
                    .or_else(|| object.get("selective_logic")),
            )
            .to_string(),
        ),
    );
    if object
        .get("useProbability")
        .or_else(|| object.get("use_probability"))
        .and_then(Value::as_bool)
        == Some(false)
    {
        object.insert("probability".to_string(), Value::Null);
    }
    object.insert(
        "lorebookId".to_string(),
        Value::String(lorebook_id.to_string()),
    );
    for key in [
        "id",
        "key",
        "keysecondary",
        "secondary_keys",
        "selective_logic",
        "disable",
        "uid",
        "useProbability",
        "use_probability",
    ] {
        object.remove(key);
    }
    Value::Object(object)
}

pub(super) fn normalize_lorebook(
    payload: &Value,
    fallback_name: &str,
    character_id: Option<&str>,
) -> (Value, Vec<Value>) {
    let name = payload
        .get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
        .unwrap_or(fallback_name);
    let lorebook = json!({
        "name": name,
        "description": payload.get("description").and_then(Value::as_str).unwrap_or("Imported from SillyTavern"),
        "category": "uncategorized",
        "imagePath": Value::Null,
        "scanDepth": number(payload.get("scan_depth").or_else(|| payload.get("scanDepth")), 2),
        "tokenBudget": number(payload.get("token_budget").or_else(|| payload.get("tokenBudget")), 2048),
        "recursiveScanning": bool_field(payload.get("recursive_scanning").or_else(|| payload.get("recursiveScanning")), false),
        "maxRecursionDepth": number(payload.get("max_recursion_depth").or_else(|| payload.get("maxRecursionDepth")), 3),
        "characterId": Value::Null,
        "characterIds": character_id.map(|id| json!([id])).unwrap_or_else(|| json!([])),
        "personaId": Value::Null,
        "personaIds": [],
        "chatId": Value::Null,
        "isGlobal": false,
        "enabled": true,
        "tags": [],
        "generatedBy": "import",
        "sourceAgentId": Value::Null,
    });
    let entries = lorebook_entries(payload);
    (lorebook, entries)
}
