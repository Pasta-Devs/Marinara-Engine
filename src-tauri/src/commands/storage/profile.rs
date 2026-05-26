#[path = "profile/assets.rs"]
mod assets;
#[path = "profile/legacy.rs"]
mod legacy;
#[path = "profile/zip_import.rs"]
mod zip_import;

use self::assets::{profile_assets, restore_profile_assets, RestoredProfileAssets};
use self::legacy::import_legacy_profile_tables;
use self::zip_import::import_profile_zip;
use super::shared::*;
use super::*;
use std::collections::HashSet;
use std::fs::File;
use std::path::PathBuf;

const PROFILE_COLLECTIONS: &[&str] = &[
    "characters",
    "character-groups",
    "character-versions",
    "personas",
    "persona-groups",
    "lorebooks",
    "lorebook-entries",
    "lorebook-folders",
    "prompts",
    "prompt-groups",
    "prompt-sections",
    "prompt-variables",
    "prompt-overrides",
    "chat-presets",
    "agents",
    "agent-runs",
    "agent-memory",
    "themes",
    "extensions",
    "connections",
    "connection-folders",
    "chats",
    "chat-folders",
    "messages",
    "custom-tools",
    "regex-scripts",
    "app-settings",
    "gallery",
    "character-gallery",
    "background-metadata",
    "sprites",
    "knowledge-sources",
    "game-state-snapshots",
    "game-checkpoints",
];

const SUPPORTED_PROFILE_PROMPT_OVERRIDE_KEYS: &[&str] = &["conversation.selfie"];

pub(crate) fn profile_snapshot(state: &AppState) -> AppResult<Value> {
    Ok(json!({
        "type": "marinara_profile",
        "version": 1,
        "exportedAt": now_iso(),
        "runtime": "tauri",
        "data": {
            "collections": profile_collections(state)?,
            "assets": profile_assets(state)?,
        }
    }))
}

pub(crate) fn import_profile_file_path(state: &AppState, value: &str) -> AppResult<Value> {
    let path = PathBuf::from(value.trim());
    if path.as_os_str().is_empty() {
        return Err(AppError::invalid_input("Profile file path is required"));
    }
    if !path.is_file() {
        return Err(AppError::invalid_input("Profile import path is not a file"));
    }
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("json") => import_profile(state, serde_json::from_reader(File::open(path)?)?),
        Some("zip") => import_profile_zip(state, &path),
        _ => Err(AppError::invalid_input(
            "Profile import must be a .json or .zip file",
        )),
    }
}

pub(crate) fn profile_call(
    state: &AppState,
    method: &str,
    rest: &[&str],
    route: &ParsedPath,
    body: Value,
) -> AppResult<Value> {
    match (method, rest) {
        ("GET", ["export"]) => export_profile(state, route.query.get("format").map(String::as_str)),
        ("POST", ["import"]) => import_profile(state, body),
        _ => Err(AppError::new(
            "route_not_found",
            format!("Unknown profile route: {method} /{}", rest.join("/")),
        )),
    }
}

fn export_profile(state: &AppState, format: Option<&str>) -> AppResult<Value> {
    match format {
        Some("native") | None => profile_snapshot(state),
        Some(_) => Err(AppError::invalid_input(
            "Only native Marinara profile JSON export is supported.",
        )),
    }
}

fn import_profile(state: &AppState, body: Value) -> AppResult<Value> {
    let data = body
        .get("data")
        .and_then(Value::as_object)
        .filter(|_| body.get("type").and_then(Value::as_str) == Some("marinara_profile"))
        .ok_or_else(|| AppError::invalid_input("Invalid Marinara profile export"))?;
    if let Some(collections) = data.get("collections").and_then(Value::as_object) {
        return import_profile_collections(state, data, collections);
    }
    let tables = data
        .get("fileStorage")
        .and_then(|value| value.get("tables"))
        .and_then(Value::as_object)
        .ok_or_else(|| {
            AppError::invalid_input(
                "Profile export must contain data.collections or data.fileStorage.tables",
            )
        })?;
    import_legacy_profile_tables(state, data, tables)
}

fn import_profile_collections(
    state: &AppState,
    data: &Map<String, Value>,
    collections: &Map<String, Value>,
) -> AppResult<Value> {
    let mut restored_assets = restore_profile_assets(state, data.get("assets"))?;
    let restored_count = restored_assets.restored();
    let result =
        import_profile_collections_with_restored_assets(state, collections, restored_count, || {
            restored_assets.install()
        });
    finish_profile_import_assets(restored_assets, result)
}

pub(super) fn import_profile_collections_with_restored_assets<F>(
    state: &AppState,
    collections: &Map<String, Value>,
    restored_assets: usize,
    install_assets: F,
) -> AppResult<Value>
where
    F: FnOnce() -> AppResult<()>,
{
    let mut imported = Map::new();
    let mut replacements = Vec::new();
    let mut unsupported_prompt_overrides = 0usize;
    for collection in PROFILE_COLLECTIONS {
        let mut rows = collections
            .get(*collection)
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        if *collection == "prompt-overrides" {
            unsupported_prompt_overrides = normalize_profile_prompt_overrides(&mut rows);
        }
        normalize_profile_json_fields(collection, &mut rows)?;
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

fn normalize_profile_json_fields(collection: &str, rows: &mut [Value]) -> AppResult<()> {
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        if collection == "characters" {
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
        } else {
            normalize_typed_json_fields(collection, object)?;
        }
    }
    Ok(())
}

pub(super) fn normalize_profile_prompt_overrides(rows: &mut Vec<Value>) -> usize {
    let mut normalized = Vec::with_capacity(rows.len());
    let mut seen_keys = HashSet::new();
    let mut unsupported = 0usize;
    for mut row in rows.drain(..) {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let key = trimmed_profile_string(object.get("key"))
            .or_else(|| trimmed_profile_string(object.get("id")));
        let Some(key) = key else {
            continue;
        };
        if !SUPPORTED_PROFILE_PROMPT_OVERRIDE_KEYS.contains(&key.as_str()) {
            unsupported += 1;
            log::trace!("skipping unsupported prompt override key={key}");
            continue;
        }
        if trimmed_profile_string(object.get("template")).is_none() {
            unsupported += 1;
            log::trace!("skipping empty prompt override key={key}");
            continue;
        }
        if !seen_keys.insert(key.clone()) {
            unsupported += 1;
            log::trace!("skipping duplicate prompt override key={key}");
            continue;
        }
        object.insert("id".to_string(), Value::String(key.clone()));
        object.insert("key".to_string(), Value::String(key));
        normalize_legacy_text_bool_fields(&mut row, &["enabled"]);
        normalized.push(row);
    }
    *rows = normalized;
    unsupported
}

fn trimmed_profile_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn finish_profile_import_assets(
    restored_assets: RestoredProfileAssets,
    result: AppResult<Value>,
) -> AppResult<Value> {
    match result {
        Ok(value) => {
            restored_assets.commit();
            Ok(value)
        }
        Err(error) => {
            if let Err(rollback_error) = restored_assets.rollback() {
                return Err(AppError::new(
                    "profile_import_rollback_failed",
                    format!(
                        "{error}; additionally failed to roll back profile assets: {rollback_error}"
                    ),
                ));
            }
            Err(error)
        }
    }
}

fn insert_profile_import_aliases(imported: &mut Map<String, Value>) {
    if let Some(value) = imported.get("prompts").cloned() {
        imported.insert("presets".to_string(), value);
    }
}

fn profile_collections(state: &AppState) -> AppResult<Map<String, Value>> {
    let mut collections = Map::new();
    for collection in PROFILE_COLLECTIONS {
        collections.insert(
            (*collection).to_string(),
            Value::Array(state.storage.list(collection)?),
        );
    }
    Ok(collections)
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
        let path = std::env::temp_dir().join(format!("marinara-profile-import-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp profile dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    #[test]
    fn profile_import_rolls_back_collections_when_asset_install_fails() {
        let state = test_state("asset-install-fails");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "old-character" })])
            .unwrap();

        let mut collections = Map::new();
        collections.insert("characters".to_string(), json!([{ "id": "new-character" }]));

        let error =
            import_profile_collections_with_restored_assets(&state, &collections, 0, || {
                Err(AppError::new(
                    "asset_install_failed",
                    "asset install failed",
                ))
            })
            .expect_err("asset install failure should reject the import");

        assert_eq!(error.code, "asset_install_failed");
        assert_eq!(
            state.storage.list("characters").unwrap()[0]["id"],
            "old-character"
        );
    }

    #[test]
    fn profile_import_collections_normalizes_prompt_overrides() {
        let state = test_state("prompt-overrides-normalize");
        let mut collections = Map::new();
        collections.insert(
            "prompt-overrides".to_string(),
            json!([
                {
                    "id": "conversation.selfie.blank",
                    "key": "conversation.selfie",
                    "template": "   ",
                    "enabled": "true"
                },
                {
                    "id": "conversation.selfie",
                    "key": "conversation.selfie",
                    "template": "Selfie ${charName}",
                    "enabled": "true"
                },
                {
                    "id": "conversation.selfie",
                    "key": "conversation.selfie",
                    "template": "Duplicate ${charName}",
                    "enabled": "true"
                },
                {
                    "id": "game.background",
                    "key": "game.background",
                    "template": "Background ${location}",
                    "enabled": "true"
                }
            ]),
        );

        let result =
            import_profile_collections_with_restored_assets(&state, &collections, 0, || Ok(()))
                .expect("native profile import should normalize prompt overrides");

        let rows = state
            .storage
            .list("prompt-overrides")
            .expect("prompt overrides should be readable");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "conversation.selfie");
        assert_eq!(rows[0]["key"], "conversation.selfie");
        assert_eq!(rows[0]["template"], "Selfie ${charName}");
        assert_eq!(rows[0]["enabled"], true);
        assert_eq!(result["imported"]["prompt-overrides"], 1);
        assert_eq!(result["imported"]["unsupportedPromptOverrides"], 3);
    }

    #[test]
    fn profile_import_legacy_file_storage_app_settings_key_sets_ui_id() {
        let state = test_state("legacy-file-storage-app-settings");
        state
            .storage
            .upsert_with_id(
                "app-settings",
                "ui",
                json!({ "value": { "theme": "seeded" } }),
            )
            .expect("seeded ui settings should write");

        import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "fileStorage": {
                        "tables": {
                            "app_settings": [
                                {
                                    "key": "ui",
                                    "value": { "theme": "imported" }
                                }
                            ]
                        }
                    }
                }
            }),
        )
        .expect("legacy file-storage profile import should succeed");

        let ui = state
            .storage
            .get("app-settings", "ui")
            .expect("ui settings lookup should not fail")
            .expect("imported ui settings should be addressable by id");
        assert_eq!(ui["id"], "ui");
        assert_eq!(ui["value"]["theme"], "imported");
    }
}
