use super::super::{
    game_state_snapshots,
    shared::{
        materialize_message_swipe_fields, non_negative_i64_value,
        normalize_legacy_text_array_fields, normalize_legacy_text_bool_fields,
        normalize_typed_json_fields, string_array_from_value,
    },
};
use super::assets::{normalize_legacy_profile_asset_paths, restore_legacy_profile_json_assets};
use super::{
    finish_profile_import_assets, insert_profile_import_aliases, normalize_profile_prompt_overrides,
};
use crate::state::AppState;
use marinara_core::AppResult;
use serde_json::{json, Map, Value};
use std::path::Path;

const LEGACY_PROFILE_TABLES: &[(&str, &str)] = &[
    ("characters", "characters"),
    ("character_groups", "character-groups"),
    ("character_card_versions", "character-versions"),
    ("personas", "personas"),
    ("persona_groups", "persona-groups"),
    ("lorebooks", "lorebooks"),
    ("lorebook_entries", "lorebook-entries"),
    ("lorebook_folders", "lorebook-folders"),
    ("prompt_presets", "prompts"),
    ("prompt_groups", "prompt-groups"),
    ("prompt_sections", "prompt-sections"),
    ("choice_blocks", "prompt-variables"),
    ("prompt_overrides", "prompt-overrides"),
    ("chat_presets", "chat-presets"),
    ("agent_configs", "agents"),
    ("agent_runs", "agent-runs"),
    ("agent_memory", "agent-memory"),
    ("custom_themes", "themes"),
    ("installed_extensions", "extensions"),
    ("api_connections", "connections"),
    ("api_connection_folders", "connection-folders"),
    ("chats", "chats"),
    ("chat_folders", "chat-folders"),
    ("messages", "messages"),
    ("custom_tools", "custom-tools"),
    ("regex_scripts", "regex-scripts"),
    ("app_settings", "app-settings"),
    ("chat_images", "gallery"),
    ("character_images", "character-gallery"),
    ("background_metadata", "background-metadata"),
    ("knowledge_sources", "knowledge-sources"),
    ("game_state_snapshots", "game-state-snapshots"),
    ("game_checkpoints", "game-checkpoints"),
];

const LEGACY_GAME_STATE_ALIASES: &[(&str, &str)] = &[
    ("chatId", "chat_id"),
    ("messageId", "message_id"),
    ("swipeIndex", "swipe_index"),
    ("presentCharacters", "present_characters"),
    ("recentEvents", "recent_events"),
    ("playerStats", "player_stats"),
    ("personaStats", "persona_stats"),
    ("manualOverrides", "manual_overrides"),
    ("createdAt", "created_at"),
];

pub(super) fn import_legacy_profile_tables(
    state: &AppState,
    data: &Map<String, Value>,
    tables: &Map<String, Value>,
) -> AppResult<Value> {
    let files = data.get("fileStorage").and_then(|value| value.get("files"));
    let mut restored_assets = restore_legacy_profile_json_assets(state, files)?;
    let restored_count = restored_assets.restored();
    let staging_root = restored_assets.staging_root().map(Path::to_path_buf);
    let result = import_legacy_profile_tables_with_restored_assets(
        state,
        tables,
        restored_count,
        staging_root.as_deref(),
        || restored_assets.install(),
    );
    finish_profile_import_assets(restored_assets, result)
}

pub(super) fn import_legacy_profile_tables_with_restored_assets<F>(
    state: &AppState,
    tables: &Map<String, Value>,
    restored_assets: usize,
    staging_root: Option<&Path>,
    install_assets: F,
) -> AppResult<Value>
where
    F: FnOnce() -> AppResult<()>,
{
    let mut imported = Map::new();
    let mut replacements = Vec::new();
    let mut unsupported_prompt_overrides = 0usize;
    for (table, collection) in LEGACY_PROFILE_TABLES {
        let mut rows = table_rows(tables, table);
        match *collection {
            "app-settings" => normalize_legacy_app_settings(&mut rows),
            "characters" => normalize_legacy_character_data(&mut rows),
            "prompt-overrides" => {
                unsupported_prompt_overrides = normalize_profile_prompt_overrides(&mut rows)
            }
            "lorebooks" => add_legacy_lorebook_links(&mut rows, tables),
            "chats" => add_legacy_chat_memories(&mut rows, tables),
            "messages" => add_legacy_message_swipes(&mut rows, tables),
            "game-state-snapshots" => normalize_legacy_game_state_snapshots(&mut rows),
            _ => {}
        }
        normalize_legacy_profile_json_fields(collection, &mut rows)?;
        for row in &mut rows {
            normalize_legacy_profile_asset_paths(state, staging_root, row);
        }
        imported.insert((*collection).to_string(), json!(rows.len()));
        replacements.push((*collection, rows));
    }
    state
        .storage
        .replace_all_many_and_then(replacements, install_assets)?;
    imported.insert("files".to_string(), json!(restored_assets));
    if unsupported_prompt_overrides > 0 {
        imported.insert(
            "unsupportedPromptOverrides".to_string(),
            json!(unsupported_prompt_overrides),
        );
    }
    insert_profile_import_aliases(&mut imported);
    Ok(json!({ "success": true, "imported": imported }))
}

fn table_rows(tables: &Map<String, Value>, table: &str) -> Vec<Value> {
    tables
        .get(table)
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn normalize_legacy_profile_json_fields(collection: &str, rows: &mut [Value]) -> AppResult<()> {
    if collection == "characters" {
        normalize_legacy_character_data(rows);
        return Ok(());
    }
    for row in rows {
        if let Some(object) = row.as_object_mut() {
            normalize_typed_json_fields(collection, object)?;
        }
    }
    Ok(())
}

fn normalize_legacy_character_data(rows: &mut [Value]) {
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        match object.get("data") {
            Some(Value::Object(_)) => {}
            Some(Value::String(raw)) => {
                let parsed = serde_json::from_str::<Value>(raw)
                    .ok()
                    .filter(Value::is_object)
                    .unwrap_or_else(|| json!({}));
                object.insert("data".to_string(), parsed);
            }
            Some(_) | None => {
                object.insert("data".to_string(), json!({}));
            }
        }
    }
}

fn normalize_legacy_app_settings(rows: &mut [Value]) {
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let legacy_key = trimmed_string(object.get("key"));
        if trimmed_string(object.get("id")).is_none() {
            if let Some(key) = legacy_key {
                object.insert("id".to_string(), Value::String(key));
            }
        }
        object.remove("key");
    }
}

fn add_legacy_lorebook_links(rows: &mut [Value], tables: &Map<String, Value>) {
    let character_links = table_rows(tables, "lorebook_character_links");
    let persona_links = table_rows(tables, "lorebook_persona_links");
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let Some(lorebook_id) = object.get("id").and_then(Value::as_str) else {
            continue;
        };
        let mut linked_character_ids =
            linked_ids(&character_links, "lorebookId", lorebook_id, "characterId");
        let mut linked_persona_ids =
            linked_ids(&persona_links, "lorebookId", lorebook_id, "personaId");
        if let Some(character_id) = object
            .get("characterId")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
        {
            push_unique(&mut linked_character_ids, character_id);
        }
        if let Some(persona_id) = object
            .get("personaId")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
        {
            push_unique(&mut linked_persona_ids, persona_id);
        }
        // Normalize first - pre-refactor stored `tags`/`characterIds`/`personaIds`
        // as TEXT columns (JSON-stringified arrays). Without this the lorebook
        // editor crashes on `formTags.map is not a function`, and the junction
        // links computed above would be discarded by `or_insert_with` whenever
        // the row carried a text-encoded `"[]"` placeholder.
        normalize_legacy_text_array_fields(row, &["tags", "characterIds", "personaIds"]);
        // Pre-refactor also stored bool columns as TEXT (`"false"` / `"true"`).
        // Without coercion, the frontend reads `lorebook.isGlobal === "false"`
        // as truthy and renders every scoped lorebook as global in the editor.
        normalize_legacy_text_bool_fields(
            row,
            &[
                "isGlobal",
                "enabled",
                "recursiveScanning",
                "excludeFromVectorization",
            ],
        );
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        // Then union the (now array-shaped) row values with the link-table
        // results so neither source is dropped.
        let mut merged_character_ids = string_array_from_value(object.get("characterIds"));
        for id in linked_character_ids {
            push_unique(&mut merged_character_ids, &id);
        }
        object.insert("characterIds".to_string(), json!(merged_character_ids));
        let mut merged_persona_ids = string_array_from_value(object.get("personaIds"));
        for id in linked_persona_ids {
            push_unique(&mut merged_persona_ids, &id);
        }
        object.insert("personaIds".to_string(), json!(merged_persona_ids));
    }
}

fn linked_ids(rows: &[Value], source_key: &str, source_id: &str, target_key: &str) -> Vec<String> {
    rows.iter()
        .filter(|row| row.get(source_key).and_then(Value::as_str) == Some(source_id))
        .filter_map(|row| row.get(target_key).and_then(Value::as_str))
        .map(ToOwned::to_owned)
        .collect()
}

fn push_unique(values: &mut Vec<String>, value: &str) {
    if !values.iter().any(|item| item == value) {
        values.push(value.to_string());
    }
}

fn add_legacy_chat_memories(rows: &mut [Value], tables: &Map<String, Value>) {
    let memory_chunks = table_rows(tables, "memory_chunks");
    if memory_chunks.is_empty() {
        return;
    }
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let Some(chat_id) = object.get("id").and_then(Value::as_str) else {
            continue;
        };
        let memories = memory_chunks
            .iter()
            .filter(|chunk| chunk.get("chatId").and_then(Value::as_str) == Some(chat_id))
            .cloned()
            .map(normalize_legacy_memory_chunk)
            .collect::<Vec<_>>();
        if !memories.is_empty() {
            object.insert("memories".to_string(), Value::Array(memories));
        }
    }
}

fn normalize_legacy_memory_chunk(mut chunk: Value) -> Value {
    let has_embedding = chunk
        .get("embedding")
        .and_then(Value::as_array)
        .map(|values| !values.is_empty())
        .unwrap_or(false);
    if let Some(object) = chunk.as_object_mut() {
        object.insert("hasEmbedding".to_string(), json!(has_embedding));
        object.insert(
            "embeddingStatus".to_string(),
            Value::String(
                if has_embedding {
                    "vectorized"
                } else {
                    "unavailable"
                }
                .to_string(),
            ),
        );
    }
    chunk
}

fn add_legacy_message_swipes(rows: &mut [Value], tables: &Map<String, Value>) {
    let swipes = table_rows(tables, "message_swipes");
    if swipes.is_empty() {
        return;
    }
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let Some(message_id) = object.get("id").and_then(Value::as_str) else {
            continue;
        };
        let mut message_swipes = swipes
            .iter()
            .filter(|swipe| swipe.get("messageId").and_then(Value::as_str) == Some(message_id))
            .cloned()
            .collect::<Vec<_>>();
        if message_swipes.is_empty() {
            continue;
        }
        message_swipes.sort_by_key(|swipe| swipe.get("index").and_then(Value::as_i64).unwrap_or(0));
        object.insert("swipes".to_string(), Value::Array(message_swipes));
        materialize_message_swipe_fields(row);
    }
}

fn normalize_legacy_game_state_snapshots(rows: &mut Vec<Value>) {
    let normalized = rows
        .iter()
        .filter_map(normalize_legacy_game_state_snapshot)
        .collect::<Vec<_>>();
    *rows = normalized;
}

fn normalize_legacy_game_state_snapshot(row: &Value) -> Option<Value> {
    let Some(object) = row.as_object() else {
        log::trace!("skipping legacy game_state_snapshots row because it is not an object");
        return None;
    };
    let mut incoming = object.clone();
    for (target, legacy) in LEGACY_GAME_STATE_ALIASES {
        move_legacy_alias(&mut incoming, target, legacy);
    }
    incoming
        .entry("messageId".to_string())
        .or_insert_with(|| Value::String(String::new()));
    incoming.insert(
        "swipeIndex".to_string(),
        json!(non_negative_i64_value(incoming.get("swipeIndex")).unwrap_or(0)),
    );

    let id = incoming.get("id").cloned();
    let row_id = diagnostic_string(id.as_ref());
    let Some(chat_id) = trimmed_string(incoming.get("chatId")) else {
        log::trace!(
            "skipping legacy game_state_snapshots row id={row_id} because chatId is missing"
        );
        return None;
    };

    match game_state_snapshots::normalize_tracker_snapshot(&chat_id, Value::Object(incoming)) {
        Ok(mut snapshot) => {
            if let Some(id) = id {
                snapshot.insert("id".to_string(), id);
            }
            Some(Value::Object(snapshot))
        }
        Err(error) => {
            log::trace!(
                "skipping legacy game_state_snapshots row id={row_id} chatId={chat_id} because tracker snapshot normalization failed: {error}"
            );
            None
        }
    }
}

fn move_legacy_alias(object: &mut Map<String, Value>, target: &str, legacy: &str) {
    let legacy_value = object.remove(legacy);
    if !object.contains_key(target) {
        if let Some(value) = legacy_value {
            object.insert(target.to_string(), value);
        }
    }
}

fn trimmed_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn diagnostic_string(value: Option<&Value>) -> String {
    trimmed_string(value).unwrap_or_else(|| "<missing>".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-profile-legacy-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp profile dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    #[test]
    fn legacy_app_settings_key_rows_import_as_settings_ids() {
        let state = test_state("app-settings-key");
        state
            .storage
            .upsert_with_id(
                "app-settings",
                "ui",
                json!({ "value": { "theme": "seeded" } }),
            )
            .expect("seeded ui settings should write");
        let mut tables = Map::new();
        tables.insert(
            "app_settings".to_string(),
            json!([
                {
                    "key": "ui",
                    "value": { "theme": "imported" },
                    "updatedAt": "2026-05-24T00:00:00Z"
                }
            ]),
        );

        import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
            .expect("legacy profile import should succeed");

        let ui = state
            .storage
            .get("app-settings", "ui")
            .expect("ui settings lookup should not fail")
            .expect("imported ui settings should be addressable by id");
        assert_eq!(ui["id"], "ui");
        assert_eq!(ui["value"]["theme"], "imported");
        assert!(!ui.as_object().unwrap().contains_key("key"));
    }

    #[test]
    fn legacy_app_settings_blank_key_does_not_create_ui_id() {
        let state = test_state("app-settings-blank-key");
        let mut tables = Map::new();
        tables.insert(
            "app_settings".to_string(),
            json!([
                {
                    "key": "  ",
                    "value": { "theme": "not-ui" }
                }
            ]),
        );

        import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
            .expect("legacy profile import should preserve malformed rows without matching ui");

        assert!(state
            .storage
            .get("app-settings", "ui")
            .expect("ui settings lookup should not fail")
            .is_none());
    }

    #[test]
    fn legacy_prompt_overrides_import_only_supported_registered_keys() {
        let state = test_state("prompt-overrides-supported");
        let mut tables = Map::new();
        tables.insert(
            "prompt_overrides".to_string(),
            json!([
                {
                    "key": "conversation.selfie",
                    "template": "Selfie ${charName}",
                    "enabled": "true"
                },
                {
                    "key": "conversation.selfie",
                    "template": "Duplicate ${charName}",
                    "enabled": "true"
                },
                {
                    "key": "game.background",
                    "template": "Background ${location}",
                    "enabled": "true"
                }
            ]),
        );

        let result =
            import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
                .expect("legacy profile import should keep supported prompt overrides");

        let rows = state
            .storage
            .list("prompt-overrides")
            .expect("prompt overrides should be readable");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "conversation.selfie");
        assert_eq!(rows[0]["key"], "conversation.selfie");
        assert_eq!(rows[0]["template"], "Selfie ${charName}");
        assert_eq!(rows[0]["enabled"], true);
        assert!(state
            .storage
            .get("prompt-overrides", "game.background")
            .expect("unsupported prompt override lookup should not fail")
            .is_none());
        assert_eq!(result["imported"]["unsupportedPromptOverrides"], 2);
    }

    #[test]
    fn legacy_game_state_snapshot_maps_sqlite_field_names_to_tracker_rows() {
        let snapshot = normalize_legacy_game_state_snapshot(&json!({
            "id": "snapshot-1",
            "chat_id": "chat-1",
            "message_id": "message-1",
            "swipe_index": "2",
            "created_at": "2026-05-20T08:30:00-04:00",
            "location": { "name": "Harbor" },
            "present_characters": "[{\"name\":\"Mari\"}]",
            "recent_events": "[\"Arrived at the harbor\"]",
            "player_stats": "{\"status\":\"ready\"}",
            "persona_stats": "[{\"name\":\"Focus\",\"value\":4}]",
            "manual_overrides": "{\"location\":\"Harbor\"}",
            "committed": 1
        }))
        .expect("legacy tracker snapshot should normalize");

        let object = snapshot.as_object().expect("snapshot should be an object");
        assert_eq!(object["id"], "snapshot-1");
        assert_eq!(object["kind"], "tracker");
        assert_eq!(object["chatId"], "chat-1");
        assert_eq!(object["messageId"], "message-1");
        assert_eq!(object["swipeIndex"], json!(2));
        assert_eq!(object["createdAt"], "2026-05-20T12:30:00+00:00");
        assert_eq!(object["location"], "Harbor");
        assert!(object["presentCharacters"].is_array());
        assert!(object["recentEvents"].is_array());
        assert!(object["playerStats"].is_object());
        assert!(object["personaStats"].is_array());
        assert!(object["manualOverrides"].is_object());
        assert_eq!(object["committed"], true);
        assert!(!object.contains_key("chat_id"));
        assert!(!object.contains_key("present_characters"));
    }

    #[test]
    fn legacy_game_state_snapshot_defaults_missing_target_to_bootstrap() {
        let snapshot = normalize_legacy_game_state_snapshot(&json!({
            "id": "snapshot-1",
            "chatId": "chat-1",
            "swipeIndex": "not-a-number",
            "presentCharacters": [{ "name": "Mari" }]
        }))
        .expect("bootstrap tracker snapshot should normalize");

        assert_eq!(snapshot["kind"], "tracker");
        assert_eq!(snapshot["chatId"], "chat-1");
        assert_eq!(snapshot["messageId"], "");
        assert_eq!(snapshot["swipeIndex"], json!(0));
        assert!(snapshot["presentCharacters"].is_array());
    }

    #[test]
    fn legacy_game_state_snapshot_skips_rows_without_chat_id() {
        let snapshot = normalize_legacy_game_state_snapshot(&json!({
            "id": "snapshot-1",
            "messageId": "message-1"
        }));

        assert!(snapshot.is_none());
    }

    #[test]
    fn legacy_game_state_snapshot_batch_filters_invalid_rows() {
        let mut rows = vec![
            json!({
                "id": "snapshot-1",
                "chatId": "chat-1",
                "presentCharacters": [{ "name": "Mari" }]
            }),
            json!({
                "id": "snapshot-2",
                "messageId": "message-1",
                "presentCharacters": [{ "name": "Dropped" }]
            }),
        ];

        normalize_legacy_game_state_snapshots(&mut rows);

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "snapshot-1");
        assert_eq!(rows[0]["chatId"], "chat-1");
    }
}
