use super::media_uploads::{
    managed_record_file_path, persist_image_file_copy, remove_copied_file_path, safe_filename,
    StoredManagedImage,
};
use super::shared::*;
use super::*;
use std::path::{Path, PathBuf};

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

#[cfg(test)]
static FORCED_CHARACTER_VERSION_SNAPSHOT_ROLLBACK_FAILURES: std::sync::LazyLock<
    std::sync::Mutex<std::collections::HashSet<String>>,
> = std::sync::LazyLock::new(|| std::sync::Mutex::new(std::collections::HashSet::new()));

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
    update_character_inner(state, character_id, patch, || {})
}

fn update_character_inner<F>(
    state: &AppState,
    character_id: &str,
    patch: Value,
    before_live_patch: F,
) -> AppResult<Value>
where
    F: FnOnce(),
{
    let normalized = normalize_update_patch("characters", patch)?;
    let mut patch = ensure_object(normalized)?;
    let options = take_version_snapshot_options(&mut patch);
    let existing = get_required(state, "characters", character_id)?;
    merge_partial_character_data(&existing, &mut patch)?;

    let created_snapshot = if should_create_version_snapshot(&existing, &patch, &options) {
        Some(create_character_version_snapshot_from_record(
            state,
            character_id,
            &existing,
            &options.source,
            &options.reason,
        )?)
    } else {
        None
    };

    before_live_patch();

    match state
        .storage
        .patch("characters", character_id, Value::Object(patch))
    {
        Ok(updated) => Ok(updated),
        Err(error) => {
            rollback_character_version_snapshot(
                state,
                created_snapshot.as_ref(),
                "character update",
                &error,
            )?;
            Err(error)
        }
    }
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
    let copied_avatar_path =
        insert_version_avatar_fields(state, character_id, record, &mut snapshot)?;
    snapshot.insert("version".to_string(), Value::String(version));
    snapshot.insert(
        "source".to_string(),
        Value::String(non_empty_or_default(source, "manual")),
    );
    snapshot.insert("reason".to_string(), Value::String(reason.to_string()));

    match state
        .storage
        .create("character-versions", Value::Object(snapshot))
    {
        Ok(created) => Ok(created),
        Err(error) => {
            remove_copied_file_path(
                copied_avatar_path.as_deref(),
                "rolled-back character version avatar copy",
            );
            Err(error)
        }
    }
}

pub(crate) fn rollback_character_version_snapshot(
    state: &AppState,
    snapshot: Option<&Value>,
    operation: &str,
    live_error: &AppError,
) -> AppResult<()> {
    let Some(snapshot) = snapshot else {
        return Ok(());
    };
    let Some(snapshot_id) = snapshot.get("id").and_then(Value::as_str) else {
        return Err(character_version_snapshot_rollback_error(
            "<missing>",
            operation,
            live_error,
            None,
            "Character version snapshot could not be rolled back because it has no id",
        ));
    };
    #[cfg(test)]
    {
        let forced = FORCED_CHARACTER_VERSION_SNAPSHOT_ROLLBACK_FAILURES
            .lock()
            .expect("forced rollback failure set should lock")
            .remove(snapshot_id);
        if forced {
            return Err(character_version_snapshot_rollback_error(
                snapshot_id,
                operation,
                live_error,
                Some(&AppError::new(
                    "forced_rollback_error",
                    "forced character version snapshot rollback failure",
                )),
                "Character version snapshot rollback failed after the live character patch failed",
            ));
        }
    }
    match state.storage.delete("character-versions", snapshot_id) {
        Ok(true) => {
            remove_character_version_avatar_file(state, snapshot);
            Ok(())
        }
        Ok(false) => {
            remove_character_version_avatar_file(state, snapshot);
            Err(character_version_snapshot_rollback_error(
                snapshot_id,
                operation,
                live_error,
                None,
                "Character version snapshot rollback could not find the newly created snapshot row",
            ))
        }
        Err(error) => Err(character_version_snapshot_rollback_error(
            snapshot_id,
            operation,
            live_error,
            Some(&error),
            "Character version snapshot rollback failed after the live character patch failed",
        )),
    }
}

fn character_version_snapshot_rollback_error(
    snapshot_id: &str,
    operation: &str,
    live_error: &AppError,
    rollback_error: Option<&AppError>,
    message: &str,
) -> AppError {
    let mut details = Map::new();
    details.insert(
        "snapshotId".to_string(),
        Value::String(snapshot_id.to_string()),
    );
    details.insert(
        "operation".to_string(),
        Value::String(operation.to_string()),
    );
    details.insert("livePatchError".to_string(), app_error_value(live_error));
    if let Some(rollback_error) = rollback_error {
        details.insert("rollbackError".to_string(), app_error_value(rollback_error));
    }
    AppError::with_details(
        "character_version_snapshot_rollback_error",
        message,
        Value::Object(details),
    )
}

fn app_error_value(error: &AppError) -> Value {
    let mut value = Map::new();
    value.insert("code".to_string(), Value::String(error.code.clone()));
    value.insert("message".to_string(), Value::String(error.message.clone()));
    if let Some(details) = &error.details {
        value.insert("details".to_string(), details.clone());
    }
    Value::Object(value)
}

#[cfg(test)]
pub(crate) fn force_character_version_snapshot_rollback_failure(snapshot_id: &str) {
    FORCED_CHARACTER_VERSION_SNAPSHOT_ROLLBACK_FAILURES
        .lock()
        .expect("forced rollback failure set should lock")
        .insert(snapshot_id.to_string());
}

fn insert_version_avatar_fields(
    state: &AppState,
    character_id: &str,
    record: &Value,
    snapshot: &mut Map<String, Value>,
) -> AppResult<Option<String>> {
    for field in ["avatarPath", "avatar", "avatarFilePath", "avatarFilename"] {
        snapshot.insert(
            field.to_string(),
            record.get(field).cloned().unwrap_or(Value::Null),
        );
    }

    let Some(avatar_path) = managed_character_avatar_path(state, record)? else {
        return Ok(None);
    };
    let filename_hint = version_avatar_filename_hint(character_id, record, &avatar_path);
    let stored = persist_image_file_copy(state, "avatars/characters", &filename_hint, &avatar_path)
        .map_err(|error| {
            AppError::new(
                "character_version_avatar_copy_error",
                format!("Character avatar could not be copied into version snapshot: {error}"),
            )
        })?;

    // Legacy version rows kept `avatarPath` as a file-backed URL. Keep that row shape, but point
    // at a snapshot-owned managed copy instead of embedding base64 in the hot storage record.
    Ok(Some(apply_stored_avatar_fields(snapshot, stored)))
}

fn version_avatar_filename_hint(character_id: &str, record: &Value, avatar_path: &Path) -> String {
    let filename = record
        .get("avatarFilename")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .or_else(|| avatar_path.file_name().and_then(|value| value.to_str()))
        .unwrap_or("avatar");
    format!(
        "version-{}-{}",
        safe_filename(character_id),
        safe_filename(filename)
    )
}

fn insert_restored_avatar_fields(
    state: &AppState,
    character_id: &str,
    version: &Value,
    patch: &mut Map<String, Value>,
) -> AppResult<Option<String>> {
    let Some(avatar_path) = managed_character_avatar_path(state, version)? else {
        return Ok(None);
    };
    let filename_hint = restored_avatar_filename_hint(character_id, version, &avatar_path);
    let stored = persist_image_file_copy(state, "avatars/characters", &filename_hint, &avatar_path)
        .map_err(|error| {
            AppError::new(
                "character_restore_avatar_copy_error",
                format!("Character version avatar could not be copied for restore: {error}"),
            )
        })?;
    Ok(Some(apply_stored_avatar_fields(patch, stored)))
}

fn restored_avatar_filename_hint(character_id: &str, record: &Value, avatar_path: &Path) -> String {
    let filename = record
        .get("avatarFilename")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .or_else(|| avatar_path.file_name().and_then(|value| value.to_str()))
        .unwrap_or("avatar");
    format!(
        "restored-{}-{}",
        safe_filename(character_id),
        safe_filename(filename)
    )
}

fn apply_stored_avatar_fields(
    fields: &mut Map<String, Value>,
    stored: StoredManagedImage,
) -> String {
    fields.insert(
        "avatarPath".to_string(),
        Value::String(stored.asset_url.clone()),
    );
    if fields.contains_key("avatar") {
        fields.insert("avatar".to_string(), Value::String(stored.asset_url));
    }
    let absolute_path = stored.absolute_path.clone();
    fields.insert(
        "avatarFilePath".to_string(),
        Value::String(stored.absolute_path),
    );
    fields.insert("avatarFilename".to_string(), Value::String(stored.filename));
    absolute_path
}

fn managed_character_avatar_path(state: &AppState, record: &Value) -> AppResult<Option<PathBuf>> {
    managed_record_file_path(
        state,
        "avatars/characters",
        record,
        "avatarFilePath",
        "avatarFilename",
    )
}

fn remove_previous_character_avatar_after_restore(
    state: &AppState,
    previous: &Value,
    updated: &Value,
) {
    let previous_path = match managed_character_avatar_path(state, previous) {
        Ok(path) => path,
        Err(error) => {
            log::warn!("could not resolve previous character avatar for restore cleanup: {error}");
            return;
        }
    };
    let Some(previous_path) = previous_path else {
        return;
    };
    let updated_path = match managed_character_avatar_path(state, updated) {
        Ok(path) => path,
        Err(error) => {
            log::warn!("could not resolve restored character avatar for cleanup: {error}");
            return;
        }
    };
    if updated_path.as_ref() != Some(&previous_path) {
        super::avatars::remove_avatar_file(state, "characters", previous);
    }
}

pub(crate) fn remove_character_version_avatar_file(state: &AppState, record: &Value) {
    match character_version_avatar_referenced_elsewhere(state, record) {
        Ok(true) => (),
        Ok(false) => super::avatars::remove_avatar_file(state, "characters", record),
        Err(error) => log::warn!(
            "skipping character version avatar cleanup because references could not be scanned: {error}"
        ),
    }
}

fn character_version_avatar_referenced_elsewhere(
    state: &AppState,
    record: &Value,
) -> AppResult<bool> {
    let Some(path) = record_managed_avatar_canonical_path(state, record)? else {
        return Ok(false);
    };
    for character in state.storage.list("characters")? {
        if record_managed_avatar_matches_path(state, &character, &path)? {
            return Ok(true);
        }
    }
    let deleted_version_id = record.get("id").and_then(Value::as_str);
    for version in state.storage.list("character-versions")? {
        if deleted_version_id.is_some()
            && version.get("id").and_then(Value::as_str) == deleted_version_id
        {
            continue;
        }
        if record_managed_avatar_matches_path(state, &version, &path)? {
            return Ok(true);
        }
    }
    Ok(false)
}

fn record_managed_avatar_matches_path(
    state: &AppState,
    record: &Value,
    path: &Path,
) -> AppResult<bool> {
    Ok(record_managed_avatar_canonical_path(state, record)?.as_deref() == Some(path))
}

fn record_managed_avatar_canonical_path(
    state: &AppState,
    record: &Value,
) -> AppResult<Option<PathBuf>> {
    let Some(path) = managed_character_avatar_path(state, record)? else {
        return Ok(None);
    };
    match fs::canonicalize(path) {
        Ok(path) => Ok(Some(path)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(AppError::from(error)),
    }
}

pub(crate) fn restore_character_version(
    state: &AppState,
    character_id: &str,
    version_id: &str,
) -> AppResult<Value> {
    restore_character_version_inner(state, character_id, version_id, || {})
}

fn restore_character_version_inner<F>(
    state: &AppState,
    character_id: &str,
    version_id: &str,
    before_live_patch: F,
) -> AppResult<Value>
where
    F: FnOnce(),
{
    let version = get_required(state, "character-versions", version_id)?;
    if version.get("characterId").and_then(Value::as_str) != Some(character_id) {
        return Err(AppError::invalid_input(
            "Version does not belong to this character",
        ));
    }
    let existing = get_required(state, "characters", character_id)?;
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
    let restored_avatar_path =
        insert_restored_avatar_fields(state, character_id, &version, &mut patch)?;
    let reason = format!(
        "Restored {}",
        version
            .get("version")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(version_id)
    );
    let options = CharacterVersionSnapshotOptions {
        source: "restore".to_string(),
        reason,
        skip: false,
    };
    let should_snapshot = should_create_version_snapshot(&existing, &patch, &options);
    let created_snapshot = if should_snapshot {
        match create_character_version_snapshot_from_record(
            state,
            character_id,
            &existing,
            &options.source,
            &options.reason,
        ) {
            Ok(snapshot) => Some(snapshot),
            Err(error) => {
                remove_copied_file_path(
                    restored_avatar_path.as_deref(),
                    "rolled-back restored character avatar copy",
                );
                return Err(error);
            }
        }
    } else {
        None
    };
    before_live_patch();
    let updated = match state
        .storage
        .patch("characters", character_id, Value::Object(patch))
    {
        Ok(updated) => updated,
        Err(error) => {
            let rollback_error = rollback_character_version_snapshot(
                state,
                created_snapshot.as_ref(),
                "character restore",
                &error,
            )
            .err();
            remove_copied_file_path(
                restored_avatar_path.as_deref(),
                "rolled-back restored character avatar copy",
            );
            return Err(rollback_error.unwrap_or(error));
        }
    };
    remove_previous_character_avatar_after_restore(state, &existing, &updated);
    Ok(updated)
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

    const TINY_PNG_BYTES: &[u8] = &[
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 4,
        0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 100, 96, 248, 95, 15,
        0, 2, 135, 1, 128, 235, 71, 186, 146, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ];

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

    fn create_character_with_managed_avatar(state: &AppState, filename: &str) -> PathBuf {
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let avatar_path = avatar_dir.join(filename);
        std::fs::write(&avatar_path, TINY_PNG_BYTES).expect("avatar should be written");
        let avatar_path_string = avatar_path.to_string_lossy().to_string();

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
                    "avatar": format!("http://asset.localhost/{filename}"),
                    "avatarPath": format!("http://asset.localhost/{filename}"),
                    "avatarFilePath": avatar_path_string,
                    "avatarFilename": filename
                }),
            )
            .expect("character should be created");

        avatar_path
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
        std::fs::write(&source_path, TINY_PNG_BYTES).expect("source avatar should be written");
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
            TINY_PNG_BYTES.to_vec()
        );
        assert_eq!(
            std::fs::read(&source_path).expect("source avatar should still exist"),
            TINY_PNG_BYTES.to_vec()
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
    fn update_character_rolls_back_snapshot_when_live_patch_fails() {
        let state = test_state("update-patch-failure-rollback");
        create_character(&state);

        let error = update_character_inner(
            &state,
            "char-1",
            json!({
                "comment": "Updated title",
                "versionReason": "Patch failure proof"
            }),
            || {
                state
                    .storage
                    .delete("characters", "char-1")
                    .expect("live character should delete before final patch");
            },
        )
        .expect_err("update should fail when the live patch misses");

        assert_eq!(error.code, "not_found");
        assert!(
            character_versions(&state).is_empty(),
            "failed character update must not leave a version row"
        );
    }

    #[test]
    fn update_character_reports_rollback_error_when_snapshot_delete_fails() {
        let state = test_state("update-rollback-failure-contract");
        let live_avatar_path = create_character_with_managed_avatar(&state, "old.png");
        let snapshot_avatar_path = std::cell::RefCell::new(None::<String>);

        let error = update_character_inner(
            &state,
            "char-1",
            json!({
                "comment": "Updated title",
                "versionReason": "Forced rollback failure proof"
            }),
            || {
                let snapshot_id = character_versions(&state)
                    .into_iter()
                    .find(|version| {
                        version.get("reason").and_then(Value::as_str)
                            == Some("Forced rollback failure proof")
                    })
                    .and_then(|version| {
                        version
                            .get("id")
                            .and_then(Value::as_str)
                            .map(ToOwned::to_owned)
                    })
                    .expect("snapshot should exist before final patch");
                let snapshot_avatar = character_versions(&state)
                    .into_iter()
                    .find(|version| {
                        version.get("reason").and_then(Value::as_str)
                            == Some("Forced rollback failure proof")
                    })
                    .and_then(|version| {
                        version
                            .get("avatarFilePath")
                            .and_then(Value::as_str)
                            .map(ToOwned::to_owned)
                    })
                    .expect("snapshot should capture an avatar copy");
                *snapshot_avatar_path.borrow_mut() = Some(snapshot_avatar);
                force_character_version_snapshot_rollback_failure(&snapshot_id);
                state
                    .storage
                    .delete("characters", "char-1")
                    .expect("live character should delete before final patch");
            },
        )
        .expect_err("update should surface rollback failure");

        assert_eq!(error.code, "character_version_snapshot_rollback_error");
        let details = error
            .details
            .as_ref()
            .and_then(Value::as_object)
            .expect("rollback error should include details");
        assert_eq!(
            details.get("operation").and_then(Value::as_str),
            Some("character update")
        );
        assert_eq!(
            details
                .get("livePatchError")
                .and_then(|value| value.get("code"))
                .and_then(Value::as_str),
            Some("not_found")
        );
        assert_eq!(
            details
                .get("rollbackError")
                .and_then(|value| value.get("code"))
                .and_then(Value::as_str),
            Some("forced_rollback_error")
        );
        assert_eq!(
            character_versions(&state).len(),
            1,
            "forced rollback failure leaves the row visible while surfacing a hard error"
        );
        let snapshot_avatar_path = snapshot_avatar_path
            .into_inner()
            .expect("snapshot avatar path should be captured");
        assert!(
            PathBuf::from(&snapshot_avatar_path).is_file(),
            "forced rollback failure keeps the snapshot avatar because the row still references it"
        );
        assert!(
            live_avatar_path.is_file(),
            "failed update must leave the previous live avatar file in place"
        );
    }

    #[test]
    fn update_character_cleans_snapshot_avatar_when_snapshot_row_is_already_missing() {
        let state = test_state("update-missing-row-rollback-avatar-cleanup");
        let live_avatar_path = create_character_with_managed_avatar(&state, "old.png");
        let snapshot_avatar_path = std::cell::RefCell::new(None::<String>);

        let error = update_character_inner(
            &state,
            "char-1",
            json!({
                "comment": "Updated title",
                "versionReason": "Missing rollback row proof"
            }),
            || {
                let snapshot = character_versions(&state)
                    .into_iter()
                    .find(|version| {
                        version.get("reason").and_then(Value::as_str)
                            == Some("Missing rollback row proof")
                    })
                    .expect("snapshot should exist before final patch");
                let snapshot_id = snapshot
                    .get("id")
                    .and_then(Value::as_str)
                    .expect("snapshot should have id")
                    .to_string();
                *snapshot_avatar_path.borrow_mut() = snapshot
                    .get("avatarFilePath")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned);
                state
                    .storage
                    .delete("character-versions", &snapshot_id)
                    .expect("snapshot row should delete before rollback");
                state
                    .storage
                    .delete("characters", "char-1")
                    .expect("live character should delete before final patch");
            },
        )
        .expect_err("update should surface missing-row rollback failure");

        assert_eq!(error.code, "character_version_snapshot_rollback_error");
        let details = error
            .details
            .as_ref()
            .and_then(Value::as_object)
            .expect("rollback error should include details");
        assert_eq!(
            details.get("operation").and_then(Value::as_str),
            Some("character update")
        );
        assert_eq!(
            details
                .get("livePatchError")
                .and_then(|value| value.get("code"))
                .and_then(Value::as_str),
            Some("not_found")
        );
        assert!(
            details.get("rollbackError").is_none(),
            "missing-row rollback has no secondary delete error"
        );
        assert!(
            character_versions(&state).is_empty(),
            "missing-row rollback should leave no version rows"
        );
        let snapshot_avatar_path = snapshot_avatar_path
            .into_inner()
            .expect("snapshot avatar path should be captured");
        assert!(
            !PathBuf::from(&snapshot_avatar_path).exists(),
            "missing-row rollback should remove the orphaned snapshot avatar"
        );
        assert!(
            live_avatar_path.is_file(),
            "failed update must leave the previous live avatar file in place"
        );
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

    #[test]
    fn restore_character_version_rolls_back_snapshot_and_avatar_when_live_patch_fails() {
        let state = test_state("restore-patch-failure-rollback");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let live_avatar_path = avatar_dir.join("live.png");
        std::fs::write(&live_avatar_path, TINY_PNG_BYTES).expect("live avatar should write");
        let version_avatar_path = avatar_dir.join("version.png");
        std::fs::write(&version_avatar_path, TINY_PNG_BYTES).expect("version avatar should write");

        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": {
                        "name": "Rina",
                        "description": "Current description",
                        "character_version": "1.0"
                    },
                    "comment": "Current title",
                    "avatar": "http://asset.localhost/live.png",
                    "avatarPath": "http://asset.localhost/live.png",
                    "avatarFilePath": live_avatar_path.to_string_lossy().to_string(),
                    "avatarFilename": "live.png"
                }),
            )
            .expect("character should be created");
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
                    "avatar": "http://asset.localhost/version.png",
                    "avatarPath": "http://asset.localhost/version.png",
                    "avatarFilePath": version_avatar_path.to_string_lossy().to_string(),
                    "avatarFilename": "version.png",
                    "version": "0.9"
                }),
            )
            .expect("version should be created");

        let error = restore_character_version_inner(&state, "char-1", "version-old", || {
            state
                .storage
                .delete("characters", "char-1")
                .expect("live character should delete before final patch");
        })
        .expect_err("restore should fail when the live patch misses");

        assert_eq!(error.code, "not_found");
        let versions = character_versions(&state);
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0]["id"], "version-old");
        assert!(
            live_avatar_path.is_file(),
            "failed restore must leave the previous live avatar file in place"
        );
        assert!(
            version_avatar_path.is_file(),
            "failed restore must leave the saved version avatar in place"
        );
        let copied_files = std::fs::read_dir(&avatar_dir)
            .expect("avatar dir should list")
            .filter_map(Result::ok)
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter(|name| {
                name.starts_with("restored-char-1-version")
                    || name.starts_with("version-char-1-live")
            })
            .collect::<Vec<_>>();
        assert!(
            copied_files.is_empty(),
            "failed restore should remove copied rollback files: {copied_files:?}"
        );
    }

    #[test]
    fn restore_character_version_missing_character_does_not_copy_avatar() {
        let state = test_state("restore-missing-character-no-copy");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let version_avatar_path = avatar_dir.join("version.png");
        std::fs::write(&version_avatar_path, TINY_PNG_BYTES).expect("version avatar should write");
        state
            .storage
            .create(
                "character-versions",
                json!({
                    "id": "version-old",
                    "characterId": "missing-char",
                    "data": { "name": "Old Rina" },
                    "avatarPath": "http://asset.localhost/version.png",
                    "avatarFilePath": version_avatar_path.to_string_lossy().to_string(),
                    "avatarFilename": "version.png"
                }),
            )
            .expect("version should be created");

        restore_character_version(&state, "missing-char", "version-old")
            .expect_err("restore should fail when live character is missing");

        let copied_restores = std::fs::read_dir(&avatar_dir)
            .expect("avatar dir should list")
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| name.starts_with("restored-missing-char-"))
            })
            .count();
        assert_eq!(
            copied_restores, 0,
            "missing live character should be checked before copying a restored avatar"
        );
        assert!(
            version_avatar_path.is_file(),
            "failed restore must leave the saved version avatar in place"
        );
    }
}
