use super::*;
use crate::state::AppState;
use base64::engine::general_purpose;
use std::time::{SystemTime, UNIX_EPOCH};

fn temp_path(label: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock should be after epoch")
        .as_nanos();
    std::env::temp_dir().join(format!(
        "marinara-st-character-import-{label}-{}-{nonce}",
        std::process::id()
    ))
}

fn block_collection_writes(state: &AppState, collection: &str) {
    let collection_path = state
        .storage
        .root()
        .join("collections")
        .join(format!("{collection}.json"));
    if let Some(parent) = collection_path.parent() {
        fs::create_dir_all(parent).expect("collection parent should be created");
    }
    if collection_path.is_file() {
        fs::remove_file(&collection_path).expect("collection file should be removed before block");
    } else if collection_path.exists() {
        fs::remove_dir_all(&collection_path)
            .expect("collection directory should be reset before block");
    }
    fs::create_dir(collection_path).expect("collection path should block file writes");
}

fn uploaded_json(name: &str, payload: Value) -> Value {
    let bytes = serde_json::to_vec(&payload).expect("fixture payload should serialize");
    uploaded_bytes(name, "application/json", bytes)
}

fn uploaded_bytes(name: &str, content_type: &str, bytes: Vec<u8>) -> Value {
    json!({
        "name": name,
        "type": content_type,
        "base64": general_purpose::STANDARD.encode(bytes),
    })
}

fn collection_ids(state: &AppState, collection: &str) -> Vec<String> {
    let mut ids = state
        .storage
        .list(collection)
        .expect("collection should be readable")
        .into_iter()
        .filter_map(|row| row.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
        .collect::<Vec<_>>();
    ids.sort();
    ids
}

#[test]
fn normalizes_sillytavern_selective_logic_numbers() {
    let entry = normalize_lorebook_entry(
        "book-1",
        &json!({
            "content": "Lore",
            "key": ["moon"],
            "selectiveLogic": 1
        }),
        0,
    );

    assert_eq!(entry["selectiveLogic"], "or");
}

#[test]
fn normalizes_imported_lorebook_entry_after_raw_field_merge() {
    let entry = normalize_imported_lorebook_entry(
        "book-1",
        &json!({
            "content": "Lore",
            "key": ["moon"],
            "selectiveLogic": 2,
            "useProbability": false,
            "probability": 25
        }),
        0,
    );

    assert_eq!(entry["selectiveLogic"], "not");
    assert!(entry["probability"].is_null());
    assert!(entry.get("useProbability").is_none());
}

#[test]
fn import_st_character_batch_rejects_wrong_route_lorebook_json() {
    let app_root = temp_path("wrong-route-lorebook");
    let state =
        AppState::from_data_dir(&app_root, Vec::new()).expect("test app state should initialize");
    let lorebook_payload = json!({
        "name": "Scout Wrong Route Lorebook",
        "entries": {
            "0": {
                "key": ["scout"],
                "content": "This belongs to a lorebook, not a character."
            }
        }
    });

    let result = import_st_character_batch(
        &state,
        json!({
            "files": [
                uploaded_json(
                    "valid-character.json",
                    json!({
                        "spec": "chara_card_v2",
                        "data": {
                            "name": "Valid Character",
                            "description": "A real character card."
                        }
                    })
                ),
                uploaded_bytes(
                    "invalid.json",
                    "application/json",
                    b"{ this is not json".to_vec()
                ),
                uploaded_json(
                    "world-info.json",
                    lorebook_payload.clone()
                )
            ]
        }),
    )
    .expect("batch import should return per-file results");

    let file_results = result
        .get("results")
        .and_then(Value::as_array)
        .expect("batch import should include file results");
    assert_eq!(file_results.len(), 3);
    assert_eq!(file_results[0].get("success"), Some(&Value::Bool(true)));
    assert_eq!(
        file_results[0].get("name").and_then(Value::as_str),
        Some("Valid Character")
    );
    assert_eq!(file_results[1].get("success"), Some(&Value::Bool(false)));
    assert_eq!(
        file_results[1].get("error").and_then(Value::as_str),
        Some("Invalid file format. Expected a JSON character card, PNG with embedded character data, or .charx file.")
    );
    let file_result = file_results
        .get(2)
        .expect("batch import should include a file result");
    assert_eq!(file_result.get("success"), Some(&Value::Bool(false)));
    assert_eq!(
        file_result.get("error").and_then(Value::as_str),
        Some("Invalid file format. Expected a JSON character card, PNG with embedded character data, or .charx file.")
    );
    assert_eq!(
        state.storage.list("characters").unwrap().len(),
        1,
        "wrong-route lorebook imports must not create an extra blank character"
    );
    let lorebook_result = import_call(&state, &["st-lorebook"], lorebook_payload)
        .expect("the same payload should still import through the lorebook route");
    assert_eq!(
        lorebook_result
            .get("entriesImported")
            .and_then(Value::as_u64),
        Some(1)
    );

    let _ = fs::remove_dir_all(app_root);
}

#[test]
fn create_lorebook_rolls_back_parent_when_entry_write_fails() {
    let app_root = temp_path("lorebook-rollback");
    let state =
        AppState::from_data_dir(&app_root, Vec::new()).expect("test app state should initialize");
    block_collection_writes(&state, "lorebook-entries");

    let error = create_lorebook_from_payload(
        &state,
        &json!({
            "name": "Rollback Lorebook",
            "entries": [{ "content": "entry", "keys": ["rollback"] }]
        }),
        "Rollback Lorebook",
        None,
    )
    .expect_err("entry storage failure should reject lorebook import");

    assert_eq!(error.code, "io_error");
    assert!(
        state.storage.list("lorebooks").unwrap().is_empty(),
        "failed lorebook import must remove the created parent row"
    );

    let _ = fs::remove_dir_all(app_root);
}

#[test]
fn import_st_character_rolls_back_character_and_avatar_when_embedded_lorebook_fails() {
    let app_root = temp_path("character-rollback");
    let state =
        AppState::from_data_dir(&app_root, Vec::new()).expect("test app state should initialize");
    block_collection_writes(&state, "lorebook-entries");

    let avatar = general_purpose::STANDARD.encode(b"avatar-bytes");
    let error = import_st_character(
        &state,
        json!({
            "spec": "chara_card_v2",
            "data": {
                "name": "Rollback Character",
                "description": "Should be removed",
                "character_book": {
                    "name": "Embedded Book",
                    "entries": [{ "content": "entry", "keys": ["rollback"] }]
                }
            },
            "_avatarDataUrl": format!("data:image/png;base64,{avatar}")
        }),
    )
    .expect_err("embedded lorebook storage failure should reject character import");

    assert_eq!(error.code, "io_error");
    assert!(
        state.storage.list("characters").unwrap().is_empty(),
        "failed embedded-lorebook import must remove the created character"
    );
    assert!(
        state.storage.list("lorebooks").unwrap().is_empty(),
        "failed embedded-lorebook import must remove the created lorebook"
    );
    assert!(
        !app_root.join("avatars").join("characters").exists(),
        "failed character import must remove the managed avatar file"
    );

    let _ = fs::remove_dir_all(app_root);
}

#[test]
fn import_st_preset_rolls_back_prompt_tree_when_section_flush_fails() {
    let app_root = temp_path("st-preset-rollback");
    let state =
        AppState::from_data_dir(&app_root, Vec::new()).expect("test app state should initialize");
    let baseline_prompt_ids = collection_ids(&state, "prompts");
    let baseline_group_ids = collection_ids(&state, "prompt-groups");
    let baseline_section_ids = collection_ids(&state, "prompt-sections");
    block_collection_writes(&state, "prompt-sections");

    let error = import_call(
        &state,
        &["st-preset"],
        json!({
            "name": "Rollback Preset",
            "prompts": [
                { "identifier": "group-start", "name": "┌ Rollback Group", "content": "" },
                { "identifier": "main", "name": "Main", "content": "hello", "role": "system" },
                { "identifier": "group-end", "name": "└ Rollback Group", "content": "" }
            ],
            "prompt_order": [{
                "character_id": 100001,
                "order": [
                    { "identifier": "group-start", "enabled": true },
                    { "identifier": "main", "enabled": true },
                    { "identifier": "group-end", "enabled": true }
                ]
            }]
        }),
    )
    .expect_err("section flush failure should reject ST preset import");

    assert_eq!(error.code, "io_error");
    assert_eq!(
        collection_ids(&state, "prompts"),
        baseline_prompt_ids,
        "failed preset import must remove the created prompt"
    );
    assert_eq!(
        collection_ids(&state, "prompt-groups"),
        baseline_group_ids,
        "failed preset import must remove created prompt groups"
    );
    assert_eq!(
        collection_ids(&state, "prompt-sections"),
        baseline_section_ids,
        "failed preset import must remove created prompt sections from the cache"
    );

    let _ = fs::remove_dir_all(app_root);
}

#[test]
fn import_st_character_ignores_untrusted_avatar_source_fields() {
    let app_root = temp_path("app");
    let source_root = temp_path("source");
    fs::create_dir_all(&source_root).expect("source dir should be created");
    let source = source_root.join("not-an-avatar.txt");
    fs::write(&source, b"do not copy me").expect("source fixture should be written");
    let state =
        AppState::from_data_dir(&app_root, Vec::new()).expect("test app state should initialize");

    let result = import_st_character(
        &state,
        json!({
            "spec": "chara_card_v2",
            "data": {
                "name": "Reserved Field Probe",
                "description": "Should not copy arbitrary files"
            },
            "_avatarSourcePath": source.to_string_lossy(),
            "_avatarFileCopySourcePath": source.to_string_lossy()
        }),
    )
    .expect("reserved avatar source fields should be ignored");

    let character = result
        .get("character")
        .and_then(Value::as_object)
        .expect("import should return a character record");
    assert!(
        character
            .get("avatarFilePath")
            .and_then(Value::as_str)
            .is_none(),
        "external payload fields must not create managed avatar file paths"
    );
    assert_eq!(character.get("avatarPath"), Some(&Value::Null));
    assert!(
        !app_root.join("avatars").join("characters").exists(),
        "untrusted local file paths should not be copied into managed avatars"
    );

    let _ = fs::remove_dir_all(app_root);
    let _ = fs::remove_dir_all(source_root);
}

#[test]
fn import_st_character_uses_trusted_avatar_source_path() {
    let app_root = temp_path("app");
    let source_root = temp_path("source");
    fs::create_dir_all(&source_root).expect("source dir should be created");
    let source = source_root.join("trusted-avatar.png");
    fs::write(&source, b"trusted-avatar-bytes").expect("source fixture should be written");
    let state =
        AppState::from_data_dir(&app_root, Vec::new()).expect("test app state should initialize");

    let result = import_st_character_payload(
        &state,
        json!({
            "spec": "chara_card_v2",
            "data": {
                "name": "Trusted Source",
                "description": "Trusted bulk import source path"
            }
        }),
        Some("trusted-avatar.png".to_string()),
        &Value::Null,
        Some(&source),
    )
    .expect("trusted avatar source should import");

    let character = result
        .get("character")
        .and_then(Value::as_object)
        .expect("import should return a character record");
    let avatar_file_path = character
        .get("avatarFilePath")
        .and_then(Value::as_str)
        .expect("trusted source should create a managed avatar file");
    assert!(
        avatar_file_path.contains("avatars")
            && avatar_file_path.contains("characters")
            && avatar_file_path.ends_with("trusted-avatar.png"),
        "managed avatar path should stay under the character avatar folder"
    );
    assert!(
        Path::new(avatar_file_path).exists(),
        "managed avatar file should exist"
    );

    let _ = fs::remove_dir_all(app_root);
    let _ = fs::remove_dir_all(source_root);
}

#[test]
fn import_st_character_preserves_bot_browser_source_marker() {
    let app_root = temp_path("bot-browser-source");
    let state =
        AppState::from_data_dir(&app_root, Vec::new()).expect("test app state should initialize");

    let result = import_st_character(
        &state,
        json!({
            "spec": "chara_card_v2",
            "data": {
                "name": "Browser Import",
                "extensions": {
                    "chub": { "id": "creator/browser-import" }
                }
            },
            "_botBrowserSource": "chub:creator/browser-import"
        }),
    )
    .expect("bot browser source marker should import");

    let extensions = result
        .pointer("/character/data/extensions")
        .and_then(Value::as_object)
        .expect("imported character extensions should be an object");
    assert_eq!(
        extensions.get("botBrowserSource").and_then(Value::as_str),
        Some("chub:creator/browser-import")
    );
    assert!(
        extensions.get("chub").is_some(),
        "existing provider extension metadata should be preserved"
    );

    let _ = fs::remove_dir_all(app_root);
}
