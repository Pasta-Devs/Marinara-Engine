use super::media_uploads::{
    managed_record_file_path, persist_image_upload, remove_managed_record_file, safe_filename,
};
use super::*;

pub(crate) fn update_character_avatar(
    state: &AppState,
    collection: &str,
    id: &str,
    body: Value,
) -> AppResult<Value> {
    let previous = shared::get_required(state, collection, id)?;
    let stored = persist_image_upload(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        id,
        &body,
        "avatar",
    )?;
    if collection == "characters" {
        let snapshot_record = character_avatar_snapshot_record(state, collection, &previous);
        super::characters::create_character_version_snapshot_from_record(
            state,
            id,
            &snapshot_record,
            "manual",
            "Avatar update",
        )?;
    }
    let updated = state.storage.patch(
        collection,
        id,
        json!({
            "avatar": stored.data_url,
            "avatarPath": stored.data_url,
            "avatarFilePath": stored.absolute_path,
            "avatarFilename": stored.filename,
            "avatarUpdatedAt": now_iso()
        }),
    )?;
    remove_avatar_file(state, collection, &previous);
    Ok(updated)
}

pub(crate) fn remove_character_avatar(state: &AppState, id: &str) -> AppResult<Value> {
    let previous = shared::get_required(state, "characters", id)?;
    let patch = character_avatar_remove_patch(&previous)?;
    if patch.is_empty() {
        return Ok(previous);
    }

    let snapshot_record = character_avatar_snapshot_record(state, "characters", &previous);
    super::characters::create_character_version_snapshot_from_record(
        state,
        id,
        &snapshot_record,
        "manual",
        "Avatar removal",
    )?;
    let updated = state
        .storage
        .patch("characters", id, Value::Object(patch))?;
    remove_avatar_file(state, "characters", &previous);
    Ok(updated)
}

fn character_avatar_remove_patch(record: &Value) -> AppResult<Map<String, Value>> {
    let mut patch = Map::new();
    for field in [
        "avatar",
        "avatarPath",
        "avatarFilePath",
        "avatarFilename",
        "avatarUpdatedAt",
    ] {
        if record.get(field).is_some_and(|value| !value.is_null()) {
            patch.insert(field.to_string(), Value::Null);
        }
    }
    if let Some(data) = character_data_without_avatar_crop(record)? {
        patch.insert("data".to_string(), data);
    }
    Ok(patch)
}

fn character_data_without_avatar_crop(record: &Value) -> AppResult<Option<Value>> {
    let Some(data) = record.get("data") else {
        return Ok(None);
    };
    let mut data = shared::normalize_character_data_for_storage(data)?;
    let Some(data_object) = data.as_object_mut() else {
        unreachable!("character data normalizer only returns objects");
    };
    let Some(extensions) = data_object
        .get_mut("extensions")
        .and_then(Value::as_object_mut)
    else {
        return Ok(None);
    };
    if extensions.remove("avatarCrop").is_some() {
        Ok(Some(data))
    } else {
        Ok(None)
    }
}

fn character_avatar_snapshot_record(state: &AppState, collection: &str, record: &Value) -> Value {
    let mut snapshot = record.clone();
    if let Some(object) = snapshot.as_object_mut() {
        if let Some(data_url) = managed_avatar_data_url(state, collection, record) {
            object.insert("avatar".to_string(), Value::String(data_url.clone()));
            object.insert("avatarPath".to_string(), Value::String(data_url));
        }
        object.insert("avatarFilePath".to_string(), Value::Null);
        object.insert("avatarFilename".to_string(), Value::Null);
    }
    snapshot
}

fn managed_avatar_data_url(state: &AppState, collection: &str, record: &Value) -> Option<String> {
    let path = managed_record_file_path(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        record,
        "avatarFilePath",
        "avatarFilename",
    )
    .ok()
    .flatten()?;
    let bytes = fs::read(&path).ok()?;
    let mime = avatar_mime_type(
        record
            .get("avatarFilename")
            .and_then(Value::as_str)
            .or_else(|| path.file_name().and_then(|value| value.to_str())),
    );
    Some(format!(
        "data:{mime};base64,{}",
        general_purpose::STANDARD.encode(bytes)
    ))
}

fn avatar_mime_type(filename: Option<&str>) -> &'static str {
    let Some(filename) = filename else {
        return "image/png";
    };
    match filename
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("avif") => "image/avif",
        Some("svg") => "image/svg+xml",
        _ => "image/png",
    }
}

pub(crate) fn remove_avatar_file(state: &AppState, collection: &str, record: &Value) {
    remove_managed_record_file(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        record,
        "avatarFilePath",
        "avatarFilename",
    )
}

pub(crate) fn update_npc_avatar(state: &AppState, chat_id: &str, body: Value) -> AppResult<Value> {
    let name = body
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("npc")
        .to_string();
    let stored = persist_image_upload(
        state,
        "avatars/npc",
        &format!("{chat_id}-{name}"),
        &body,
        "avatar",
    )?;
    Ok(json!({
        "chatId": chat_id,
        "name": name,
        "avatarPath": stored.data_url,
        "avatarFilePath": stored.absolute_path,
        "avatarFilename": stored.filename
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-avatars-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    #[test]
    fn character_avatar_update_snapshot_does_not_restore_deleted_file_metadata() {
        let state = test_state("character-avatar-version");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let old_avatar_path = avatar_dir.join("old.png");
        std::fs::write(&old_avatar_path, b"old").expect("old avatar should be written");
        let old_avatar_path = old_avatar_path.to_string_lossy().to_string();

        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": {
                        "name": "Rina",
                        "description": "Original",
                        "character_version": "1.0"
                    },
                    "comment": "Original title",
                    "avatar": "http://asset.localhost/old.png",
                    "avatarPath": "http://asset.localhost/old.png",
                    "avatarFilePath": old_avatar_path,
                    "avatarFilename": "old.png"
                }),
            )
            .expect("character should be created");

        update_character_avatar(
            &state,
            "characters",
            "char-1",
            json!({ "avatar": "data:image/png;base64,bmV3" }),
        )
        .expect("avatar should update");

        let versions = state
            .storage
            .list("character-versions")
            .expect("versions should list");
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0]["avatarPath"], "data:image/png;base64,b2xk");
        assert_eq!(versions[0]["avatarFilePath"], Value::Null);
        assert_eq!(versions[0]["avatarFilename"], Value::Null);

        let version_id = versions[0]
            .get("id")
            .and_then(Value::as_str)
            .expect("version should have id");
        let restored =
            super::super::characters::restore_character_version(&state, "char-1", version_id)
                .expect("version should restore");

        assert_eq!(restored["avatarPath"], "data:image/png;base64,b2xk");
        assert_eq!(restored["avatarFilePath"], Value::Null);
        assert_eq!(restored["avatarFilename"], Value::Null);
    }
}
