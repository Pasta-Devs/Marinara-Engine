use super::super::{
    game_state_snapshots, new_id, now_iso,
    shared::{
        materialize_message_swipe_fields, non_negative_i64_value,
        normalize_legacy_text_array_fields, normalize_legacy_text_bool_fields,
        normalize_typed_json_fields, string_array_from_value,
    },
};
use super::assets::{
    legacy_profile_asset_url_for_path, normalize_legacy_profile_asset_paths,
    restore_legacy_profile_json_assets,
};
use super::{
    finish_profile_import_assets, insert_profile_import_aliases, normalize_profile_prompt_overrides,
};
use crate::state::AppState;
use marinara_core::{AppError, AppResult};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
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
    let mut imported_conversation_notes = 0usize;
    let mut imported_ooc_influences = 0usize;
    for (table, collection) in LEGACY_PROFILE_TABLES {
        // A partial profile (an older backup, a hand-built export, or a file
        // missing a table) must not wipe collections it does not carry.
        // Skipping the replacement leaves the user's existing collection
        // untouched; a table that is present but empty is still an explicit
        // clear and falls through to a normal empty replacement.
        let Some(table_value) = tables.get(*table) else {
            continue;
        };
        // A present-but-non-array table is malformed (e.g. `"characters": {}`).
        // `table_rows` would coerce it to an empty array, which silently clears
        // the collection - the same data loss the absent-key skip above guards
        // against. Reject the import instead so nothing is replaced.
        if !table_value.is_array() {
            return Err(AppError::invalid_input(format!(
                "Legacy profile table `{table}` must be a JSON array"
            )));
        }
        let mut rows = table_rows(tables, table);
        match *collection {
            "app-settings" => normalize_legacy_app_settings(&mut rows),
            "characters" => normalize_legacy_character_data(&mut rows),
            "prompt-overrides" => {
                unsupported_prompt_overrides = normalize_profile_prompt_overrides(&mut rows)
            }
            "lorebooks" => add_legacy_lorebook_links(&mut rows, tables),
            "lorebook-entries" => normalize_legacy_lorebook_entries(&mut rows),
            "chats" => {
                add_legacy_chat_memories(&mut rows, tables);
                let counts = add_legacy_connected_notes(&mut rows, tables);
                imported_conversation_notes = counts.notes;
                imported_ooc_influences = counts.influences;
            }
            "messages" => add_legacy_message_swipes(&mut rows, tables),
            "game-state-snapshots" => normalize_legacy_game_state_snapshots(&mut rows),
            "gallery" | "character-gallery" => {
                normalize_legacy_gallery_rows(state, staging_root, &mut rows)
            }
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
    if imported_conversation_notes > 0 {
        imported.insert(
            "conversation-notes".to_string(),
            json!(imported_conversation_notes),
        );
    }
    if imported_ooc_influences > 0 {
        imported.insert("ooc-influences".to_string(), json!(imported_ooc_influences));
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

fn normalize_legacy_gallery_rows(
    state: &AppState,
    staging_root: Option<&Path>,
    rows: &mut [Value],
) {
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let has_url = object
            .get("url")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty());
        if !has_url {
            if let Some(url) = gallery_image_url_from_legacy_row(state, staging_root, object) {
                object.insert("url".to_string(), Value::String(url));
            }
        }
        if object
            .get("filename")
            .and_then(Value::as_str)
            .is_none_or(|value| value.trim().is_empty())
        {
            if let Some(filename) = gallery_filename_from_legacy_row(object) {
                object.insert("filename".to_string(), Value::String(filename));
            }
        }
    }
}

fn gallery_image_url_from_legacy_row(
    state: &AppState,
    staging_root: Option<&Path>,
    object: &Map<String, Value>,
) -> Option<String> {
    for field in ["filePath", "path", "filename"] {
        let Some(raw) = object.get(field).and_then(Value::as_str) else {
            continue;
        };
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(url) = legacy_profile_asset_url_for_path(state, staging_root, trimmed) {
            return Some(url);
        }
        if !trimmed.contains('/')
            && !trimmed.contains('\\')
            && !trimmed.starts_with("data:")
            && !trimmed.starts_with("http://")
            && !trimmed.starts_with("https://")
        {
            let gallery_path = format!("gallery/{trimmed}");
            if let Some(url) = legacy_profile_asset_url_for_path(state, staging_root, &gallery_path)
            {
                return Some(url);
            }
        }
    }
    None
}

fn gallery_filename_from_legacy_row(object: &Map<String, Value>) -> Option<String> {
    for field in ["filePath", "path", "url"] {
        let Some(raw) = object.get(field).and_then(Value::as_str) else {
            continue;
        };
        if raw.trim_start().starts_with("data:") {
            continue;
        }
        let normalized = raw
            .trim()
            .split(['?', '#'])
            .next()
            .unwrap_or("")
            .replace('\\', "/");
        let filename = normalized
            .rsplit('/')
            .next()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let Some(filename) = filename {
            return Some(filename.to_string());
        }
    }
    None
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

/// Pre-refactor stored lorebook-entry bool columns (`caseSensitive`,
/// `constant`, `locked`, ...) as TEXT (`"true"` / `"false"`) and the
/// multi-value filter columns as TEXT-encoded JSON arrays (`"[]"`). The
/// refactor frontend reads these directly, so `"false"` evaluates truthy in
/// the entry editor and the keyword scanner's raw-truthiness checks misread
/// `constant` / `preventRecursion`; a string `"[]"` also crashes the editor on
/// `.map`. Coerce them to native types, matching the treatment the
/// character-card import path (`normalize_lorebook_entry`) already applies.
/// `keys` / `secondaryKeys` are handled separately by the generic
/// `normalize_typed_json_fields` pass.
fn normalize_legacy_lorebook_entries(rows: &mut [Value]) {
    for row in rows {
        normalize_legacy_text_bool_fields(
            row,
            &[
                "enabled",
                "constant",
                "selective",
                "matchWholeWords",
                "caseSensitive",
                "useRegex",
                "preventRecursion",
                "locked",
                "excludeFromVectorization",
            ],
        );
        normalize_legacy_text_array_fields(
            row,
            &[
                "characterFilterIds",
                "characterTagFilters",
                "generationTriggerFilters",
                "additionalMatchingSources",
                "activationConditions",
            ],
        );
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
    let mut memories_by_chat: HashMap<String, Vec<Value>> = HashMap::new();
    for chunk in memory_chunks {
        let Some(chat_id) = chunk
            .get("chatId")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
        else {
            continue;
        };
        memories_by_chat
            .entry(chat_id.to_string())
            .or_default()
            .push(normalize_legacy_memory_chunk(chunk));
    }
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let Some(chat_id) = object.get("id").and_then(Value::as_str) else {
            continue;
        };
        let Some(memories) = memories_by_chat.remove(chat_id) else {
            continue;
        };
        object.insert("memories".to_string(), Value::Array(memories));
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

#[derive(Default)]
struct LegacyConnectedNoteCounts {
    notes: usize,
    influences: usize,
}

fn add_legacy_connected_notes(
    rows: &mut [Value],
    tables: &Map<String, Value>,
) -> LegacyConnectedNoteCounts {
    let mut counts = LegacyConnectedNoteCounts::default();
    let mut notes_by_chat: HashMap<String, Vec<Value>> = HashMap::new();
    for row in table_rows(tables, "conversation_notes") {
        if let Some((target_chat_id, note)) = normalize_legacy_connected_note(row, "note") {
            counts.notes += 1;
            notes_by_chat.entry(target_chat_id).or_default().push(note);
        }
    }
    for row in table_rows(tables, "ooc_influences") {
        if let Some((target_chat_id, note)) = normalize_legacy_connected_note(row, "influence") {
            counts.influences += 1;
            notes_by_chat.entry(target_chat_id).or_default().push(note);
        }
    }
    if notes_by_chat.is_empty() {
        return counts;
    }
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let Some(chat_id) = object.get("id").and_then(Value::as_str) else {
            continue;
        };
        let Some(mut imported_notes) = notes_by_chat.remove(chat_id) else {
            continue;
        };
        let mut notes = object
            .get("notes")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        notes.append(&mut imported_notes);
        object.insert("notes".to_string(), Value::Array(notes));
    }
    counts
}

fn normalize_legacy_connected_note(row: Value, note_type: &str) -> Option<(String, Value)> {
    let object = row.as_object()?;
    let target_chat_id = legacy_string(object, &["targetChatId", "target_chat_id"])?;
    let content = legacy_string(object, &["content"])?;
    let source_chat_id = legacy_string(object, &["sourceChatId", "source_chat_id"]);
    let anchor_message_id = legacy_string(object, &["anchorMessageId", "anchor_message_id"]);
    let mut note = Map::new();
    note.insert(
        "id".to_string(),
        Value::String(legacy_string(object, &["id"]).unwrap_or_else(new_id)),
    );
    note.insert("type".to_string(), Value::String(note_type.to_string()));
    note.insert("content".to_string(), Value::String(content));
    note.insert(
        "sourceChatId".to_string(),
        source_chat_id.map(Value::String).unwrap_or(Value::Null),
    );
    note.insert(
        "targetChatId".to_string(),
        Value::String(target_chat_id.clone()),
    );
    note.insert(
        "anchorMessageId".to_string(),
        anchor_message_id.map(Value::String).unwrap_or(Value::Null),
    );
    note.insert(
        "createdAt".to_string(),
        Value::String(legacy_string(object, &["createdAt", "created_at"]).unwrap_or_else(now_iso)),
    );
    if note_type == "influence" {
        note.insert(
            "consumed".to_string(),
            Value::Bool(legacy_bool(object.get("consumed"), false)),
        );
    }
    Some((target_chat_id, Value::Object(note)))
}

fn legacy_string(object: &Map<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| object.get(*key))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn legacy_bool(value: Option<&Value>, fallback: bool) -> bool {
    match value {
        Some(Value::Bool(value)) => *value,
        Some(Value::Number(value)) => value.as_i64().map(|number| number != 0).unwrap_or(fallback),
        Some(Value::String(value)) => match value.trim().to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" | "on" => true,
            "false" | "0" | "no" | "off" => false,
            _ => fallback,
        },
        _ => fallback,
    }
}

fn add_legacy_message_swipes(rows: &mut [Value], tables: &Map<String, Value>) {
    let swipes = table_rows(tables, "message_swipes");
    if swipes.is_empty() {
        return;
    }
    let mut swipes_by_message: HashMap<String, Vec<Value>> = HashMap::new();
    for swipe in swipes {
        let Some(message_id) = swipe
            .get("messageId")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
        else {
            continue;
        };
        swipes_by_message
            .entry(message_id.to_string())
            .or_default()
            .push(swipe);
    }
    for message_swipes in swipes_by_message.values_mut() {
        message_swipes.sort_by_key(|swipe| swipe.get("index").and_then(Value::as_i64).unwrap_or(0));
    }
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let Some(message_id) = object.get("id").and_then(Value::as_str) else {
            continue;
        };
        let Some(message_swipes) = swipes_by_message.remove(message_id) else {
            continue;
        };
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
    fn legacy_gallery_rows_gain_renderable_urls_from_file_paths() {
        let state = test_state("gallery-file-paths");
        let gallery_dir = state.data_dir.join("gallery");
        std::fs::create_dir_all(&gallery_dir).expect("gallery dir should be created");
        std::fs::write(gallery_dir.join("legacy-chat.png"), b"chat-image")
            .expect("chat gallery asset should be written");
        std::fs::write(
            gallery_dir.join("legacy-character.webp"),
            b"character-image",
        )
        .expect("character gallery asset should be written");
        let mut tables = Map::new();
        tables.insert(
            "chat_images".to_string(),
            json!([
                {
                    "id": "chat-image-1",
                    "chatId": "chat-1",
                    "filePath": "/api/gallery/file/legacy-chat.png"
                }
            ]),
        );
        tables.insert(
            "character_images".to_string(),
            json!([
                {
                    "id": "character-image-1",
                    "characterId": "character-1",
                    "filePath": "legacy-character.webp"
                }
            ]),
        );

        import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
            .expect("legacy profile import should succeed");

        let chat_image = state
            .storage
            .get("gallery", "chat-image-1")
            .expect("chat gallery lookup should not fail")
            .expect("chat gallery row should import");
        assert!(
            chat_image["url"]
                .as_str()
                .unwrap_or_default()
                .starts_with("data:image/png;base64,"),
            "chat gallery row should have a renderable data URL"
        );
        assert_eq!(chat_image["filename"], "legacy-chat.png");

        let character_image = state
            .storage
            .get("character-gallery", "character-image-1")
            .expect("character gallery lookup should not fail")
            .expect("character gallery row should import");
        assert!(
            character_image["url"]
                .as_str()
                .unwrap_or_default()
                .starts_with("data:image/webp;base64,"),
            "character gallery row should have a renderable data URL"
        );
        assert_eq!(character_image["filename"], "legacy-character.webp");
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
                    "template": "Background ${defaultPrompt}",
                    "enabled": "true"
                },
                {
                    "key": "game.unknown",
                    "template": "Unknown ${defaultPrompt}",
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
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0]["id"], "conversation.selfie");
        assert_eq!(rows[0]["key"], "conversation.selfie");
        assert_eq!(rows[0]["template"], "Selfie ${charName}");
        assert_eq!(rows[0]["enabled"], true);
        assert_eq!(rows[1]["id"], "game.background");
        assert_eq!(rows[1]["key"], "game.background");
        assert_eq!(rows[1]["template"], "Background ${defaultPrompt}");
        assert!(state
            .storage
            .get("prompt-overrides", "game.unknown")
            .expect("unsupported prompt override lookup should not fail")
            .is_none());
        assert_eq!(result["imported"]["unsupportedPromptOverrides"], 2);
    }

    #[test]
    fn legacy_connected_notes_import_onto_target_chat_notes() {
        let state = test_state("connected-notes");
        let mut tables = Map::new();
        tables.insert(
            "chats".to_string(),
            json!([
                {
                    "id": "conversation-1",
                    "name": "OOC",
                    "mode": "conversation",
                    "connectedChatId": "roleplay-1"
                },
                {
                    "id": "roleplay-1",
                    "name": "Scene",
                    "mode": "roleplay",
                    "connectedChatId": "conversation-1"
                }
            ]),
        );
        tables.insert(
            "conversation_notes".to_string(),
            json!([
                {
                    "id": "note-1",
                    "source_chat_id": "conversation-1",
                    "target_chat_id": "roleplay-1",
                    "content": "Remember the locked door.",
                    "anchor_message_id": "message-1",
                    "created_at": "2026-05-20T12:00:00Z"
                }
            ]),
        );
        tables.insert(
            "ooc_influences".to_string(),
            json!([
                {
                    "id": "influence-1",
                    "source_chat_id": "conversation-1",
                    "target_chat_id": "roleplay-1",
                    "content": "Trigger the alarm next turn.",
                    "consumed": "false",
                    "created_at": "2026-05-20T12:01:00Z"
                }
            ]),
        );

        let result =
            import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
                .expect("legacy profile import should carry connected notes");

        let roleplay = state
            .storage
            .get("chats", "roleplay-1")
            .expect("chat lookup should not fail")
            .expect("roleplay chat should import");
        let notes = roleplay["notes"]
            .as_array()
            .expect("connected notes should live on target chat");
        assert_eq!(notes.len(), 2);
        assert_eq!(notes[0]["type"], "note");
        assert_eq!(notes[0]["content"], "Remember the locked door.");
        assert_eq!(notes[0]["sourceChatId"], "conversation-1");
        assert_eq!(notes[0]["targetChatId"], "roleplay-1");
        assert_eq!(notes[1]["type"], "influence");
        assert_eq!(notes[1]["content"], "Trigger the alarm next turn.");
        assert_eq!(notes[1]["consumed"], false);
        assert_eq!(result["imported"]["conversation-notes"], 1);
        assert_eq!(result["imported"]["ooc-influences"], 1);
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

    #[test]
    fn legacy_chat_import_preserves_folder_assignment() {
        let state = test_state("chat-folder-id");
        let mut tables = Map::new();
        tables.insert(
            "chat_folders".to_string(),
            json!([
                {
                    "id": "folder-1",
                    "name": "My Folder",
                    "mode": "conversation",
                    "color": "#abc",
                    "sortOrder": 0,
                    "collapsed": false
                }
            ]),
        );
        tables.insert(
            "chats".to_string(),
            json!([
                {
                    "id": "chat-1",
                    "name": "Imported Chat",
                    "mode": "conversation",
                    "characterIds": [],
                    "groupId": null,
                    "personaId": null,
                    "promptPresetId": null,
                    "connectionId": null,
                    "connectedChatId": null,
                    "folderId": "folder-1",
                    "sortOrder": 0,
                    "metadata": {}
                }
            ]),
        );

        import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
            .expect("legacy profile import should succeed");

        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat lookup should not fail")
            .expect("imported chat should be addressable by id");
        assert_eq!(chat["folderId"], "folder-1");

        let folder = state
            .storage
            .get("chat-folders", "folder-1")
            .expect("chat-folders lookup should not fail")
            .expect("imported folder should be addressable by id");
        assert_eq!(folder["id"], "folder-1");
        assert_eq!(folder["name"], "My Folder");
    }

    #[test]
    fn legacy_connection_import_preserves_folder_assignment() {
        let state = test_state("connection-folder-id");
        let mut tables = Map::new();
        tables.insert(
            "api_connection_folders".to_string(),
            json!([
                {
                    "id": "folder-1",
                    "name": "Provider Folder",
                    "color": "#22c55e",
                    "sortOrder": 3,
                    "collapsed": true
                }
            ]),
        );
        tables.insert(
            "api_connections".to_string(),
            json!([
                {
                    "id": "conn-1",
                    "name": "Imported Provider",
                    "provider": "openai",
                    "model": "gpt-4.1",
                    "folderId": "folder-1",
                    "sortOrder": 9
                }
            ]),
        );

        import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
            .expect("legacy profile import should succeed");

        let connection = state
            .storage
            .get("connections", "conn-1")
            .expect("connection lookup should not fail")
            .expect("imported connection should be addressable by id");
        assert_eq!(connection["folderId"], "folder-1");
        assert_eq!(connection["sortOrder"], 9);

        let folder = state
            .storage
            .get("connection-folders", "folder-1")
            .expect("connection-folders lookup should not fail")
            .expect("imported folder should be addressable by id");
        assert_eq!(folder["id"], "folder-1");
        assert_eq!(folder["name"], "Provider Folder");
        assert_eq!(folder["collapsed"], true);
    }

    #[test]
    fn legacy_lorebook_entries_coerce_text_bools_and_arrays() {
        let state = test_state("lorebook-entry-coercion");
        let mut tables = Map::new();
        tables.insert(
            "lorebook_entries".to_string(),
            json!([
                {
                    "id": "entry-1",
                    "lorebookId": "lore-1",
                    "name": "NPC: Kafka",
                    "keys": ["Kafka"],
                    "secondaryKeys": [],
                    "caseSensitive": "false",
                    "constant": "false",
                    "locked": "false",
                    "preventRecursion": "false",
                    "excludeFromVectorization": "false",
                    "selective": "true",
                    "enabled": "true",
                    "matchWholeWords": true,
                    "characterFilterIds": "[]",
                    "characterTagFilters": "[]",
                    "additionalMatchingSources": "[]",
                    "activationConditions": "[]"
                }
            ]),
        );

        import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
            .expect("legacy lorebook-entry import should succeed");

        let entry = state
            .storage
            .get("lorebook-entries", "entry-1")
            .expect("entry lookup should not fail")
            .expect("imported entry should be addressable by id");

        for field in [
            "caseSensitive",
            "constant",
            "locked",
            "preventRecursion",
            "excludeFromVectorization",
            "selective",
            "enabled",
            "matchWholeWords",
        ] {
            assert!(
                entry[field].is_boolean(),
                "{field} should be a native boolean, got {:?}",
                entry[field]
            );
        }
        assert_eq!(entry["caseSensitive"], false);
        assert_eq!(entry["constant"], false);
        assert_eq!(entry["locked"], false);
        assert_eq!(entry["preventRecursion"], false);
        assert_eq!(entry["excludeFromVectorization"], false);
        assert_eq!(entry["selective"], true);
        assert_eq!(entry["enabled"], true);

        for field in [
            "characterFilterIds",
            "characterTagFilters",
            "additionalMatchingSources",
            "activationConditions",
        ] {
            assert!(
                entry[field].is_array(),
                "{field} should be a native array, got {:?}",
                entry[field]
            );
        }
    }

    #[test]
    fn legacy_partial_profile_does_not_wipe_absent_collections() {
        let state = test_state("partial-no-wipe");
        state
            .storage
            .upsert_with_id(
                "characters",
                "char-1",
                json!({ "name": "Keep Me", "data": { "name": "Keep Me" } }),
            )
            .expect("seeded character should write");
        state
            .storage
            .upsert_with_id("lorebooks", "lore-1", json!({ "name": "Keep Me Too" }))
            .expect("seeded lorebook should write");

        let mut tables = Map::new();
        tables.insert(
            "chats".to_string(),
            json!([
                {
                    "id": "chat-1",
                    "name": "Imported Chat",
                    "mode": "conversation",
                    "metadata": {},
                    "characterIds": []
                }
            ]),
        );

        import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
            .expect("partial legacy profile import should succeed");

        // The table present in the file is replaced as expected...
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat lookup should not fail")
            .expect("imported chat should be present");
        assert_eq!(chat["name"], "Imported Chat");

        // ...but collections absent from the file are left untouched, not wiped.
        assert!(state
            .storage
            .get("characters", "char-1")
            .expect("character lookup should not fail")
            .is_some());
        assert!(state
            .storage
            .get("lorebooks", "lore-1")
            .expect("lorebook lookup should not fail")
            .is_some());
    }

    #[test]
    fn legacy_present_but_malformed_table_is_rejected_without_wiping() {
        let state = test_state("malformed-table-no-wipe");
        state
            .storage
            .upsert_with_id(
                "characters",
                "char-1",
                json!({ "name": "Keep Me", "data": { "name": "Keep Me" } }),
            )
            .expect("seeded character should write");

        let mut tables = Map::new();
        // Object instead of array: malformed, must not be treated as a clear.
        tables.insert("characters".to_string(), json!({}));

        let error =
            import_legacy_profile_tables_with_restored_assets(&state, &tables, 0, None, || Ok(()))
                .expect_err("a present-but-non-array table should be rejected");
        assert_eq!(error.code, "invalid_input");

        // The rejected import must not have wiped the existing collection.
        assert!(state
            .storage
            .get("characters", "char-1")
            .expect("character lookup should not fail")
            .is_some());
    }
}
