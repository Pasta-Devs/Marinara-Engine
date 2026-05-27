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
    fs::create_dir(collection_path).expect("collection path should block file writes");
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
