use super::shared::*;
use super::*;

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
    if version.get("avatarPath").is_some() {
        patch.insert(
            "avatarPath".to_string(),
            version.get("avatarPath").cloned().unwrap_or(Value::Null),
        );
    }
    patch.insert("versionSource".to_string(), json!("restore"));
    patch.insert(
        "versionReason".to_string(),
        json!(format!(
            "Restored {}",
            version
                .get("version")
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(version_id)
        )),
    );
    state
        .storage
        .patch("characters", character_id, Value::Object(patch))
}
