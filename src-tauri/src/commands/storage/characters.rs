use super::media_uploads::{managed_record_file_path, persist_image_file_copy};
use super::shared::*;
use super::*;

const VERSION_SOURCE_FIELD: &str = "versionSource";
const VERSION_REASON_FIELD: &str = "versionReason";
const SKIP_VERSION_SNAPSHOT_FIELD: &str = "skipVersionSnapshot";
const VERSIONED_CHARACTER_FIELDS: [&str; 6] = [
    "data",
    "comment",
    "avatarPath",
    "avatar",
    "avatarFilePath",
    "avatarFilename",
];

struct CharacterVersionSnapshotOptions {
    source: String,
    reason: String,
    skip: bool,
}

impl Default for CharacterVersionSnapshotOptions {
    fn default() -> Self {
        Self {
            source: "manual".to_string(),
            reason: String::new(),
            skip: false,
        }
    }
}

pub(crate) fn update_character(
    state: &AppState,
    character_id: &str,
    patch: Value,
) -> AppResult<Value> {
    let normalized = normalize_update_patch("characters", patch)?;
    let mut patch = ensure_object(normalized)?;
    let options = take_version_snapshot_options(&mut patch);
    let existing = get_required(state, "characters", character_id)?;
    merge_partial_character_data(&existing, &mut patch)?;

    if should_create_version_snapshot(&existing, &patch, &options) {
        create_character_version_snapshot_from_record(
            state,
            character_id,
            &existing,
            &options.source,
            &options.reason,
        )?;
    }

    state
        .storage
        .patch("characters", character_id, Value::Object(patch))
}

pub(crate) fn create_character_version_snapshot_from_record(
    state: &AppState,
    character_id: &str,
    record: &Value,
    source: &str,
    reason: &str,
) -> AppResult<Value> {
    let data = normalize_character_data_for_storage(
        &record.get("data").cloned().unwrap_or_else(|| json!({})),
    )?;
    let version = data
        .get("character_version")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let mut snapshot = Map::new();
    snapshot.insert(
        "characterId".to_string(),
        Value::String(character_id.to_string()),
    );
    snapshot.insert("data".to_string(), data);
    snapshot.insert("comment".to_string(), character_comment(record));
    for field in ["avatarPath", "avatar", "avatarFilePath", "avatarFilename"] {
        snapshot.insert(
            field.to_string(),
            record.get(field).cloned().unwrap_or(Value::Null),
        );
    }
    snapshot.insert("version".to_string(), Value::String(version));
    snapshot.insert(
        "source".to_string(),
        Value::String(non_empty_or_default(source, "manual")),
    );
    snapshot.insert("reason".to_string(), Value::String(reason.to_string()));

    state
        .storage
        .create("character-versions", Value::Object(snapshot))
}

pub(crate) fn restore_character_version(
    state: &AppState,
    character_id: &str,
    version_id: &str,
) -> AppResult<Value> {
    let version = get_required(state, "character-versions", version_id)?;
    if version.get("characterId").and_then(Value::as_str) != Some(character_id) {
        return Err(AppError::invalid_input(
            "Version does not belong to this character",
        ));
    }
    let mut patch = Map::new();
    if let Some(data) = version.get("data") {
        patch.insert(
            "data".to_string(),
            normalize_character_data_for_storage(data)?,
        );
    }
    if let Some(comment) = version.get("comment") {
        patch.insert("comment".to_string(), comment.clone());
    }
    patch.insert(
        "avatarPath".to_string(),
        version.get("avatarPath").cloned().unwrap_or(Value::Null),
    );
    for field in ["avatar", "avatarFilePath", "avatarFilename"] {
        patch.insert(
            field.to_string(),
            version.get(field).cloned().unwrap_or(Value::Null),
        );
    }
    let reason = format!(
        "Restored {}",
        version
            .get("version")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(version_id)
    );
    let existing = get_required(state, "characters", character_id)?;
    let options = CharacterVersionSnapshotOptions {
        source: "restore".to_string(),
        reason,
        skip: false,
    };
    if should_create_version_snapshot(&existing, &patch, &options) {
        create_character_version_snapshot_from_record(
            state,
            character_id,
            &existing,
            &options.source,
            &options.reason,
        )?;
    }
    state
        .storage
        .patch("characters", character_id, Value::Object(patch))
}

pub(crate) fn duplicate_character(state: &AppState, character_id: &str) -> AppResult<Value> {
    let mut record = get_required(state, "characters", character_id)?;
    let duplicate_avatar = duplicate_managed_character_avatar(state, character_id, &record)?;
    let object = record
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Record is not an object"))?;
    object.remove("id");
    if let Some(data) = object.get_mut("data").and_then(Value::as_object_mut) {
        if let Some(name) = data.get("name").and_then(Value::as_str).map(str::to_string) {
            data.insert("name".to_string(), Value::String(format!("{name} (Copy)")));
        }
    }
    match duplicate_avatar {
        DuplicateAvatar::Copied {
            asset_url,
            absolute_path,
            filename,
        } => {
            if object.contains_key("avatar") {
                object.insert("avatar".to_string(), Value::String(asset_url.clone()));
            }
            object.insert("avatarPath".to_string(), Value::String(asset_url));
            object.insert("avatarFilePath".to_string(), Value::String(absolute_path));
            object.insert("avatarFilename".to_string(), Value::String(filename));
        }
        DuplicateAvatar::MissingManagedMetadata => {
            object.insert("avatarFilePath".to_string(), Value::Null);
            object.insert("avatarFilename".to_string(), Value::Null);
        }
        DuplicateAvatar::None => {}
    }
    state.storage.create("characters", record)
}

enum DuplicateAvatar {
    Copied {
        asset_url: String,
        absolute_path: String,
        filename: String,
    },
    MissingManagedMetadata,
    None,
}

fn duplicate_managed_character_avatar(
    state: &AppState,
    character_id: &str,
    record: &Value,
) -> AppResult<DuplicateAvatar> {
    let avatar_path = managed_record_file_path(
        state,
        "avatars/characters",
        record,
        "avatarFilePath",
        "avatarFilename",
    )?;
    let Some(avatar_path) = avatar_path else {
        return Ok(if has_managed_avatar_metadata(record) {
            DuplicateAvatar::MissingManagedMetadata
        } else {
            DuplicateAvatar::None
        });
    };

    let filename_hint = record
        .get("avatarFilename")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(character_id);
    let stored = persist_image_file_copy(state, "avatars/characters", filename_hint, &avatar_path)?;
    Ok(DuplicateAvatar::Copied {
        asset_url: stored.asset_url,
        absolute_path: stored.absolute_path,
        filename: stored.filename,
    })
}

fn has_managed_avatar_metadata(record: &Value) -> bool {
    ["avatarFilePath", "avatarFilename"]
        .iter()
        .any(|field| record.get(*field).is_some_and(|value| !value.is_null()))
}

fn take_version_snapshot_options(
    patch: &mut Map<String, Value>,
) -> CharacterVersionSnapshotOptions {
    let source = take_string(patch, VERSION_SOURCE_FIELD)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "manual".to_string());
    let reason = take_string(patch, VERSION_REASON_FIELD).unwrap_or_default();
    let skip = matches!(
        patch.remove(SKIP_VERSION_SNAPSHOT_FIELD),
        Some(Value::Bool(true))
    );
    CharacterVersionSnapshotOptions {
        source,
        reason,
        skip,
    }
}

fn take_string(patch: &mut Map<String, Value>, field: &str) -> Option<String> {
    match patch.remove(field) {
        Some(Value::String(value)) => Some(value),
        _ => None,
    }
}

fn merge_partial_character_data(existing: &Value, patch: &mut Map<String, Value>) -> AppResult<()> {
    let Some(next_data) = patch.remove("data") else {
        return Ok(());
    };
    let Value::Object(mut merged) = normalize_character_data_for_storage(
        &existing.get("data").cloned().unwrap_or_else(|| json!({})),
    )?
    else {
        unreachable!("character data normalizer only returns objects");
    };
    let Value::Object(next_data) = normalize_character_data_for_storage(&next_data)? else {
        unreachable!("character data normalizer only returns objects");
    };
    for (key, value) in next_data {
        merged.insert(key, value);
    }
    patch.insert("data".to_string(), Value::Object(merged));
    Ok(())
}

fn should_create_version_snapshot(
    existing: &Value,
    patch: &Map<String, Value>,
    options: &CharacterVersionSnapshotOptions,
) -> bool {
    !options.skip
        && VERSIONED_CHARACTER_FIELDS.iter().any(|field| {
            patch
                .get(*field)
                .is_some_and(|next| next != &comparable_character_field(existing, field))
        })
}

fn comparable_character_field(record: &Value, field: &str) -> Value {
    match field {
        "comment" => character_comment(record),
        "avatarPath" | "avatar" | "avatarFilePath" | "avatarFilename" => {
            record.get(field).cloned().unwrap_or(Value::Null)
        }
        _ => record.get(field).cloned().unwrap_or_else(|| json!({})),
    }
}

fn character_comment(record: &Value) -> Value {
    Value::String(
        record
            .get("comment")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
    )
}

fn non_empty_or_default(value: &str, fallback: &str) -> String {
    if value.trim().is_empty() {
        fallback.to_string()
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-characters-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn create_character(state: &AppState) {
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": {
                        "name": "Rina",
                        "description": "Original description",
                        "tags": ["ice"],
                        "character_version": "1.0"
                    },
                    "comment": "Original title",
                    "avatar": "old-avatar",
                    "avatarPath": "old-avatar",
                    "avatarFilePath": "C:\\Marinara\\avatars\\characters\\old.png",
                    "avatarFilename": "old.png"
                }),
            )
            .expect("character should be created");
    }

    fn character_versions(state: &AppState) -> Vec<Value> {
        state
            .storage
            .list("character-versions")
            .expect("versions should list")
    }

    #[test]
    fn duplicate_character_copies_managed_avatar_file() {
        let state = test_state("duplicate-avatar");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let source_path = avatar_dir.join("rina.png");
        std::fs::write(&source_path, b"avatar bytes").expect("source avatar should be written");
        let source_path_string = source_path.to_string_lossy().to_string();

        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": {
                        "name": "Rina",
                        "description": "Original description",
                        "tags": [],
                        "character_version": "1.0"
                    },
                    "comment": "Original title",
                    "avatar": "http://asset.localhost/rina.png",
                    "avatarPath": "http://asset.localhost/rina.png",
                    "avatarFilePath": source_path_string,
                    "avatarFilename": "rina.png"
                }),
            )
            .expect("character should be created");

        let duplicate = duplicate_character(&state, "char-1").expect("character should duplicate");
        let duplicate_path = PathBuf::from(
            duplicate
                .get("avatarFilePath")
                .and_then(Value::as_str)
                .expect("duplicate should have cloned avatar path"),
        );

        assert_ne!(duplicate["id"], "char-1");
        assert_eq!(duplicate["data"]["name"], "Rina (Copy)");
        assert_ne!(duplicate_path, source_path);
        assert_eq!(
            std::fs::read(&duplicate_path).expect("duplicate avatar should exist"),
            b"avatar bytes".to_vec()
        );
        assert_eq!(
            std::fs::read(&source_path).expect("source avatar should still exist"),
            b"avatar bytes".to_vec()
        );

        super::super::avatars::remove_avatar_file(&state, "characters", &duplicate);

        assert!(
            !duplicate_path.exists(),
            "removing the duplicate avatar should delete only the duplicate file"
        );
        assert!(
            source_path.exists(),
            "removing the duplicate avatar must not delete the original file"
        );
    }

    #[test]
    fn update_character_creates_previous_state_snapshot_with_source_reason() {
        let state = test_state("snapshot-source-reason");
        create_character(&state);

        let updated = update_character(
            &state,
            "char-1",
            json!({
                "data": { "tags": ["ice", "archive"] },
                "comment": "Updated title",
                "avatarPath": "new-avatar",
                "avatarFilePath": "C:\\Marinara\\avatars\\characters\\new.png",
                "avatarFilename": "new.png",
                "versionSource": "agent",
                "versionReason": "Professor Mari card update"
            }),
        )
        .expect("character should update");

        assert_eq!(updated["data"]["name"], "Rina");
        assert_eq!(updated["data"]["description"], "Original description");
        assert_eq!(updated["data"]["tags"], json!(["ice", "archive"]));
        assert!(updated.get("versionSource").is_none());
        assert!(updated.get("versionReason").is_none());

        let versions = character_versions(&state);
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0]["characterId"], "char-1");
        assert_eq!(versions[0]["data"]["name"], "Rina");
        assert_eq!(versions[0]["data"]["tags"], json!(["ice"]));
        assert_eq!(versions[0]["comment"], "Original title");
        assert_eq!(versions[0]["avatarPath"], "old-avatar");
        assert_eq!(
            versions[0]["avatarFilePath"],
            "C:\\Marinara\\avatars\\characters\\old.png"
        );
        assert_eq!(versions[0]["avatarFilename"], "old.png");
        assert_eq!(versions[0]["version"], "1.0");
        assert_eq!(versions[0]["source"], "agent");
        assert_eq!(versions[0]["reason"], "Professor Mari card update");
    }

    #[test]
    fn update_character_skips_snapshot_when_requested() {
        let state = test_state("snapshot-skip");
        create_character(&state);

        let updated = update_character(
            &state,
            "char-1",
            json!({
                "data": { "name": "Rina Prime" },
                "skipVersionSnapshot": true,
                "versionSource": "agent",
                "versionReason": "Skipped update"
            }),
        )
        .expect("character should update");

        assert_eq!(updated["data"]["name"], "Rina Prime");
        assert!(updated.get("skipVersionSnapshot").is_none());
        assert!(updated.get("versionSource").is_none());
        assert!(character_versions(&state).is_empty());
    }

    #[test]
    fn update_character_does_not_snapshot_noop_patch() {
        let state = test_state("snapshot-noop");
        create_character(&state);

        update_character(
            &state,
            "char-1",
            json!({
                "data": { "name": "Rina" },
                "comment": "Original title",
                "avatarPath": "old-avatar"
            }),
        )
        .expect("noop character update should succeed");

        assert!(character_versions(&state).is_empty());
    }

    #[test]
    fn restore_character_version_snapshots_current_state_and_restores_avatar_metadata() {
        let state = test_state("restore-snapshot");
        create_character(&state);
        state
            .storage
            .create(
                "character-versions",
                json!({
                    "id": "version-old",
                    "characterId": "char-1",
                    "data": {
                        "name": "Old Rina",
                        "description": "Old description",
                        "character_version": "0.9"
                    },
                    "comment": "Old title",
                    "avatarPath": "old-restored-avatar",
                    "avatarFilePath": "C:\\Marinara\\avatars\\characters\\restored.png",
                    "avatarFilename": "restored.png",
                    "version": "0.9",
                    "source": "manual",
                    "reason": "Before edit"
                }),
            )
            .expect("version should be created");

        let restored = restore_character_version(&state, "char-1", "version-old")
            .expect("version should restore");

        assert_eq!(restored["data"]["name"], "Old Rina");
        assert_eq!(restored["comment"], "Old title");
        assert_eq!(restored["avatarPath"], "old-restored-avatar");
        assert_eq!(
            restored["avatarFilePath"],
            "C:\\Marinara\\avatars\\characters\\restored.png"
        );
        assert_eq!(restored["avatarFilename"], "restored.png");
        assert!(restored.get("versionSource").is_none());
        assert!(restored.get("versionReason").is_none());

        let versions = character_versions(&state);
        assert_eq!(versions.len(), 2);
        let restore_snapshot = versions
            .iter()
            .find(|version| version.get("source").and_then(Value::as_str) == Some("restore"))
            .expect("restore snapshot should exist");
        assert_eq!(restore_snapshot["data"]["name"], "Rina");
        assert_eq!(restore_snapshot["reason"], "Restored 0.9");
    }
}
