use super::*;
use crate::state::AppState;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

fn test_state(label: &str) -> AppState {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock should be after epoch")
        .as_nanos();
    let path = std::env::temp_dir().join(format!("marinara-import-{label}-{nonce}"));
    if path.exists() {
        std::fs::remove_dir_all(&path).expect("stale temp import dir should be removable");
    }
    AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
}

fn record_with_field<'a>(records: &'a [Value], field: &str, value: &str) -> &'a Value {
    records
        .iter()
        .find(|record| record.get(field).and_then(Value::as_str) == Some(value))
        .expect("expected imported record to exist")
}

fn test_string<'a>(record: &'a Value, field: &str) -> &'a str {
    record
        .get(field)
        .and_then(Value::as_str)
        .expect("expected record field to be a string")
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
        fs::remove_file(&collection_path).expect("seeded collection file should be removable");
    }
    fs::create_dir(collection_path).expect("collection path should block file writes");
}

fn embedded_avatar() -> String {
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==".to_string()
}

fn assert_managed_character_avatar(character: &Value) {
    let avatar_path = test_string(character, "avatarPath");
    assert!(
        !avatar_path.starts_with("data:image/"),
        "native character imports should store managed avatar asset URLs, not inline data"
    );
    let avatar_file_path = test_string(character, "avatarFilePath");
    assert!(
        avatar_file_path.contains("avatars") && avatar_file_path.contains("characters"),
        "managed avatar path should stay under character avatar storage"
    );
    assert!(
        Path::new(avatar_file_path).exists(),
        "managed avatar file should exist"
    );
    assert!(
        test_string(character, "avatarFilename").ends_with(".png"),
        "embedded PNG avatar should persist with a PNG filename"
    );
    assert!(
        character.get("avatar").is_none(),
        "native character import should not duplicate avatar bytes into the avatar field"
    );
}

#[test]
fn created_record_id_rejects_missing_or_blank_ids() {
    let missing = created_record_id(&json!({ "name": "No id" }), "record")
        .expect_err("missing id should be rejected");
    assert_eq!(missing.code, "storage_error");
    assert!(missing.message.contains("Created record is missing an id"));

    let blank = created_record_id(&json!({ "id": "   " }), "record")
        .expect_err("blank id should be rejected");
    assert_eq!(blank.code, "storage_error");
    assert!(blank.message.contains("Created record is missing an id"));
}

#[test]
fn generic_marinara_import_directs_profile_exports_to_profile_import() {
    let state = test_state("profile-envelope");
    let error = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_profile",
            "version": 1,
            "data": { "collections": {} }
        }),
    )
    .expect_err("profile export should not go through generic Marinara import");

    assert_eq!(error.code, "invalid_input");
    assert!(error.message.contains("Import Profile"));
    assert!(!error.message.contains("Unknown Marinara import type"));
}

#[test]
fn native_marinara_character_import_materializes_embedded_avatar() {
    let state = test_state("native-character-avatar");
    let imported = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_character",
            "version": 1,
            "data": {
                "spec": "chara_card_v2",
                "data": {
                    "name": "Native Avatar Character",
                    "description": "Has an embedded avatar"
                },
                "avatar": embedded_avatar()
            }
        }),
    )
    .expect("native character import should succeed");

    assert_managed_character_avatar(&imported["character"]);
}

#[test]
fn native_marinara_character_import_rolls_back_avatar_when_record_write_fails() {
    let state = test_state("native-character-avatar-rollback");
    block_collection_writes(&state, "characters");

    let error = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_character",
            "version": 1,
            "data": {
                "spec": "chara_card_v2",
                "data": {
                    "name": "Rollback Native Character Avatar",
                    "description": "Should be removed"
                },
                "avatar": embedded_avatar()
            }
        }),
    )
    .expect_err("character write failure should reject character import");

    assert_eq!(error.code, "io_error");
    assert!(
        state.storage.list("characters").unwrap().is_empty(),
        "failed native character import must remove the created character"
    );
    assert!(
        !state.data_dir.join("avatars").join("characters").exists(),
        "failed native character import must remove the managed avatar file"
    );
}

#[test]
fn native_marinara_storage_record_import_materializes_embedded_avatar() {
    let state = test_state("native-storage-avatar");
    let imported = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_character",
            "version": 1,
            "data": {
                "data": {
                    "name": "Native Storage Avatar Character",
                    "description": "Has an embedded avatar"
                },
                "format": "chara_card_v2",
                "avatar": embedded_avatar()
            }
        }),
    )
    .expect("native storage-record import should succeed");

    assert_managed_character_avatar(&imported["character"]);
}

#[test]
fn native_marinara_storage_record_import_preserves_plain_avatar_string() {
    let state = test_state("native-storage-plain-avatar");
    let avatar = "/assets/imported/native-avatar.png";
    let imported = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_character",
            "version": 1,
            "data": {
                "data": {
                    "name": "Native Plain Avatar Character",
                    "description": "Has a legacy avatar reference"
                },
                "format": "chara_card_v2",
                "avatar": avatar
            }
        }),
    )
    .expect("native storage-record import with plain avatar should succeed");

    let character = &imported["character"];
    assert_eq!(test_string(character, "avatarPath"), avatar);
    assert_eq!(test_string(character, "avatar"), avatar);
    assert!(
        character.get("avatarFilePath").is_none(),
        "plain avatar strings should not be materialized as managed files"
    );
}

#[test]
fn native_marinara_character_import_skips_malformed_optional_sprite() {
    let state = test_state("native-character-invalid-sprite");

    let imported = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_character",
            "version": 1,
            "data": {
                "spec": "chara_card_v2",
                "data": {
                    "name": "Rollback Native Avatar Character",
                    "description": "Should be removed"
                },
                "avatar": embedded_avatar(),
                "sprites": [
                    { "data": "data:image/png;base64,not-valid-base64!" }
                ]
            }
        }),
    )
    .expect("malformed optional sprites should be skipped");

    assert_managed_character_avatar(&imported["character"]);
    assert_eq!(imported["spritesImported"], json!(0));
}

#[test]
fn native_marinara_persona_import_materializes_embedded_avatar() {
    let state = test_state("native-persona-avatar");

    let imported = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_persona",
            "version": 1,
            "data": {
                "name": "Native Persona Avatar",
                "avatar": embedded_avatar()
            }
        }),
    )
    .expect("native persona import should succeed");

    let persona = &imported["persona"];
    assert!(
        test_string(persona, "avatarPath").starts_with("asset://localhost/")
            || test_string(persona, "avatarPath").starts_with("http://asset.localhost/"),
        "persona avatar should be stored as a managed asset URL"
    );
    assert!(
        test_string(persona, "avatarFilePath").contains("avatars")
            && test_string(persona, "avatarFilePath").contains("personas"),
        "persona avatar should stay under persona avatar storage"
    );
    assert!(
        Path::new(test_string(persona, "avatarFilePath")).exists(),
        "managed persona avatar file should exist"
    );
    assert_eq!(
        persona.get("avatar").and_then(Value::as_str),
        persona.get("avatarPath").and_then(Value::as_str),
        "persona avatar aliases should both point at the managed asset URL"
    );
    assert!(
        !test_string(persona, "avatar").starts_with("data:image/"),
        "native persona imports should not keep embedded avatar bytes inline"
    );
}

#[test]
fn native_marinara_persona_import_rolls_back_avatar_when_record_write_fails() {
    let state = test_state("native-persona-avatar-rollback");
    block_collection_writes(&state, "personas");

    let error = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_persona",
            "version": 1,
            "data": {
                "name": "Rollback Native Persona Avatar",
                "avatar": embedded_avatar()
            }
        }),
    )
    .expect_err("persona write failure should reject persona import");

    assert_eq!(error.code, "io_error");
    assert!(
        state.storage.list("personas").unwrap().is_empty(),
        "failed native persona import must remove the created persona"
    );
    assert!(
        !state.data_dir.join("avatars").join("personas").exists(),
        "failed native persona import must remove the managed avatar file"
    );
}

#[test]
fn parented_record_import_rolls_back_created_records_on_failure() {
    let state = test_state("parented-rollback");
    let owner_id = "preset-rollback";
    let error = import_parented_records(
        &state,
        vec![
            json!({ "id": "old-root", "name": "Root", "presetId": "old-preset" }),
            json!("not an object"),
        ],
        "prompt-groups",
        "presetId",
        owner_id,
        "parentGroupId",
        "prompt group",
    )
    .expect_err("invalid imported record should fail the batch");

    assert_eq!(error.code, "invalid_input");
    let remaining = state
        .storage
        .list("prompt-groups")
        .expect("prompt groups should be readable")
        .into_iter()
        .filter(|group| group.get("presetId").and_then(Value::as_str) == Some(owner_id))
        .collect::<Vec<_>>();
    assert!(remaining.is_empty());
}

#[test]
fn generic_marinara_lorebook_import_rolls_back_outer_records_on_entry_failure() {
    let state = test_state("generic-lorebook-outer-rollback");
    block_collection_writes(&state, "lorebook-entries");

    let error = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_lorebook",
            "version": 1,
            "data": {
                "lorebook": { "id": "old-book", "name": "Rollback Lorebook" },
                "folders": [
                    { "id": "old-root", "name": "Root", "lorebookId": "old-book" }
                ],
                "entries": [
                    { "id": "old-entry", "name": "Entry", "content": "body", "keys": ["rollback"] }
                ]
            }
        }),
    )
    .expect_err("entry storage failure should reject lorebook import");

    assert_eq!(error.code, "io_error");
    assert!(state.storage.list("lorebooks").unwrap().is_empty());
    assert!(state.storage.list("lorebook-folders").unwrap().is_empty());
}

#[test]
fn generic_marinara_preset_import_rolls_back_outer_records_on_section_failure() {
    let state = test_state("generic-preset-outer-rollback");
    block_collection_writes(&state, "prompt-sections");

    let error = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_preset",
            "version": 1,
            "data": {
                "preset": { "id": "old-preset", "name": "Rollback Preset" },
                "groups": [
                    { "id": "old-root", "name": "Root", "presetId": "old-preset" }
                ],
                "sections": [
                    { "id": "old-section", "name": "Section", "content": "hello", "presetId": "old-preset" }
                ]
            }
        }),
    )
    .expect_err("section storage failure should reject preset import");

    assert_eq!(error.code, "io_error");
    assert!(state
        .storage
        .list("prompts")
        .unwrap()
        .iter()
        .all(|prompt| prompt.get("name").and_then(Value::as_str) != Some("Rollback Preset")));
    assert!(state
        .storage
        .list("prompt-groups")
        .unwrap()
        .iter()
        .all(|group| group.get("name").and_then(Value::as_str) != Some("Root")));
}

#[test]
fn marinara_lorebook_import_remaps_nested_folders_and_entry_folders() {
    let state = test_state("lorebook-folders");
    let imported = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_lorebook",
            "version": 1,
            "data": {
                "lorebook": { "id": "old-book", "name": "Foldered Lorebook" },
                "folders": [
                    { "id": "old-root", "name": "Root", "lorebookId": "old-book" },
                    { "id": "old-child", "name": "Child", "parentFolderId": "old-root", "lorebookId": "old-book" }
                ],
                "entries": [
                    { "id": "old-entry", "name": "Entry", "content": "body", "keys": ["key"], "folderId": "old-child" },
                    { "id": "old-orphan", "name": "Orphan Entry", "content": "body", "keys": ["missing"], "folderId": "missing-folder" }
                ]
            }
        }),
    )
    .expect("lorebook import should succeed");
    let lorebook_id = test_string(&imported, "lorebookId");

    let folders = state
        .storage
        .list("lorebook-folders")
        .expect("folders should be readable")
        .into_iter()
        .filter(|folder| folder.get("lorebookId").and_then(Value::as_str) == Some(lorebook_id))
        .collect::<Vec<_>>();
    assert_eq!(folders.len(), 2);
    let root = record_with_field(&folders, "name", "Root");
    let child = record_with_field(&folders, "name", "Child");
    let root_id = test_string(root, "id");
    let child_id = test_string(child, "id");
    assert_eq!(
        root.get("lorebookId").and_then(Value::as_str),
        Some(lorebook_id)
    );
    assert_eq!(
        child.get("lorebookId").and_then(Value::as_str),
        Some(lorebook_id)
    );
    assert_eq!(
        child.get("parentFolderId").and_then(Value::as_str),
        Some(root_id)
    );
    assert_ne!(
        child.get("parentFolderId").and_then(Value::as_str),
        Some("old-root")
    );

    let entries = state
        .storage
        .list("lorebook-entries")
        .expect("entries should be readable")
        .into_iter()
        .filter(|entry| entry.get("lorebookId").and_then(Value::as_str) == Some(lorebook_id))
        .collect::<Vec<_>>();
    assert_eq!(entries.len(), 2);
    let entry = record_with_field(&entries, "name", "Entry");
    let orphan = record_with_field(&entries, "name", "Orphan Entry");
    assert_eq!(
        entry.get("folderId").and_then(Value::as_str),
        Some(child_id)
    );
    assert_ne!(
        entry.get("folderId").and_then(Value::as_str),
        Some("old-child")
    );
    assert_eq!(orphan.get("folderId"), Some(&Value::Null));
}

#[test]
fn marinara_preset_import_remaps_nested_groups_and_section_groups() {
    let state = test_state("preset-groups");
    let imported = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_preset",
            "version": 1,
            "data": {
                "preset": { "id": "old-preset", "name": "Grouped Preset" },
                "groups": [
                    { "id": "old-root", "name": "Root", "presetId": "old-preset" },
                    { "id": "old-child", "name": "Child", "parentGroupId": "old-root", "presetId": "old-preset" }
                ],
                "sections": [
                    { "id": "old-section", "name": "Section", "content": "hello", "groupId": "old-child", "presetId": "old-preset" },
                    { "id": "old-orphan", "name": "Orphan Section", "content": "hello", "groupId": "missing-group", "presetId": "old-preset" },
                    { "id": "old-malformed", "name": "Malformed Section", "content": "hello", "groupId": { "bad": true }, "presetId": "old-preset" }
                ]
            }
        }),
    )
    .expect("preset import should succeed");
    let preset_id = test_string(&imported, "id");

    let groups = state
        .storage
        .list("prompt-groups")
        .expect("groups should be readable")
        .into_iter()
        .filter(|group| group.get("presetId").and_then(Value::as_str) == Some(preset_id))
        .collect::<Vec<_>>();
    assert_eq!(groups.len(), 2);
    let root = record_with_field(&groups, "name", "Root");
    let child = record_with_field(&groups, "name", "Child");
    let root_id = test_string(root, "id");
    let child_id = test_string(child, "id");
    assert_eq!(
        root.get("presetId").and_then(Value::as_str),
        Some(preset_id)
    );
    assert_eq!(
        child.get("presetId").and_then(Value::as_str),
        Some(preset_id)
    );
    assert_eq!(
        child.get("parentGroupId").and_then(Value::as_str),
        Some(root_id)
    );
    assert_ne!(
        child.get("parentGroupId").and_then(Value::as_str),
        Some("old-root")
    );

    let sections = state
        .storage
        .list("prompt-sections")
        .expect("sections should be readable")
        .into_iter()
        .filter(|section| section.get("presetId").and_then(Value::as_str) == Some(preset_id))
        .collect::<Vec<_>>();
    assert_eq!(sections.len(), 3);
    let section = record_with_field(&sections, "name", "Section");
    let orphan = record_with_field(&sections, "name", "Orphan Section");
    let malformed = record_with_field(&sections, "name", "Malformed Section");
    assert_eq!(
        section.get("presetId").and_then(Value::as_str),
        Some(preset_id)
    );
    assert_eq!(
        section.get("groupId").and_then(Value::as_str),
        Some(child_id)
    );
    assert_ne!(
        section.get("groupId").and_then(Value::as_str),
        Some("old-child")
    );
    assert_eq!(orphan.get("groupId"), Some(&Value::Null));
    assert_eq!(malformed.get("groupId"), Some(&Value::Null));
}

#[test]
fn marinara_preset_import_remaps_root_child_order_arrays() {
    let state = test_state("preset-order");
    let imported = import_marinara_envelope(
        &state,
        json!({
            "type": "marinara_preset",
            "version": 1,
            "data": {
                "preset": {
                    "id": "old-preset",
                    "name": "Ordered Preset",
                    "groupOrder": ["old-child", "missing-group", "old-child"],
                    "sectionOrder": ["old-second", "missing-section", "old-first", "old-second"],
                    "variableOrder": ["old-variable-b", "missing-variable", "old-variable-a"]
                },
                "groups": [
                    { "id": "old-root", "name": "Root", "presetId": "old-preset" },
                    { "id": "old-child", "name": "Child", "parentGroupId": "old-root", "presetId": "old-preset" }
                ],
                "sections": [
                    { "id": "old-first", "name": "First", "content": "first", "groupId": "old-root", "presetId": "old-preset" },
                    { "id": "old-second", "name": "Second", "content": "second", "groupId": "old-child", "presetId": "old-preset" }
                ],
                "variables": [
                    { "id": "old-variable-a", "name": "Tone", "presetId": "old-preset" },
                    { "id": "old-variable-b", "name": "Style", "presetId": "old-preset" }
                ]
            }
        }),
    )
    .expect("preset import should succeed");
    let preset_id = test_string(&imported, "id");

    let preset = state
        .storage
        .get("prompts", preset_id)
        .expect("preset should be readable")
        .expect("preset should exist");
    let groups = state
        .storage
        .list("prompt-groups")
        .expect("groups should be readable")
        .into_iter()
        .filter(|group| group.get("presetId").and_then(Value::as_str) == Some(preset_id))
        .collect::<Vec<_>>();
    let sections = state
        .storage
        .list("prompt-sections")
        .expect("sections should be readable")
        .into_iter()
        .filter(|section| section.get("presetId").and_then(Value::as_str) == Some(preset_id))
        .collect::<Vec<_>>();
    let variables = state
        .storage
        .list("prompt-variables")
        .expect("variables should be readable")
        .into_iter()
        .filter(|variable| variable.get("presetId").and_then(Value::as_str) == Some(preset_id))
        .collect::<Vec<_>>();

    let root_group_id = test_string(record_with_field(&groups, "name", "Root"), "id");
    let child_group_id = test_string(record_with_field(&groups, "name", "Child"), "id");
    let first_section_id = test_string(record_with_field(&sections, "name", "First"), "id");
    let second_section_id = test_string(record_with_field(&sections, "name", "Second"), "id");
    let tone_variable_id = test_string(record_with_field(&variables, "name", "Tone"), "id");
    let style_variable_id = test_string(record_with_field(&variables, "name", "Style"), "id");

    assert_eq!(
        preset.get("groupOrder"),
        Some(&json!([child_group_id, root_group_id]))
    );
    assert_eq!(
        preset.get("sectionOrder"),
        Some(&json!([second_section_id, first_section_id]))
    );
    assert_eq!(
        preset.get("variableOrder"),
        Some(&json!([style_variable_id, tone_variable_id]))
    );
    for stale_id in [
        "old-root",
        "old-child",
        "old-first",
        "old-second",
        "old-variable-a",
        "old-variable-b",
        "missing-group",
        "missing-section",
        "missing-variable",
    ] {
        assert!(
            !preset
                .get("groupOrder")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .chain(
                    preset
                        .get("sectionOrder")
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten(),
                )
                .chain(
                    preset
                        .get("variableOrder")
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten(),
                )
                .any(|id| id.as_str() == Some(stale_id)),
            "preset order arrays should not keep stale id {stale_id}"
        );
    }
}
