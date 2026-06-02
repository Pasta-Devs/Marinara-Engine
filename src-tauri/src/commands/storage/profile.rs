#[path = "profile/assets.rs"]
mod assets;
#[path = "profile/legacy.rs"]
mod legacy;
#[path = "profile/zip_import.rs"]
mod zip_import;

use self::assets::{
    profile_assets, profile_assets_manifest, restore_profile_assets, RestoredProfileAssets,
};
use self::legacy::import_legacy_profile_tables;
use self::zip_import::import_profile_zip;
use super::contracts;
use super::shared::*;
use super::*;
use base64::engine::general_purpose;
use std::collections::HashSet;
use std::fs::{self, File};
use std::path::{Path, PathBuf};

const PROFILE_EXPORT_JSON_LIMIT_BYTES: usize = 256 * 1024 * 1024;
const PROFILE_EXPORT_JSON_TOO_LARGE_CODE: &str = "PROFILE_EXPORT_JSON_TOO_LARGE";

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

pub(crate) fn profile_backup_snapshot(state: &AppState) -> AppResult<Value> {
    Ok(json!({
        "type": "marinara_profile",
        "version": 1,
        "exportedAt": now_iso(),
        "runtime": "tauri",
        "data": {
            "collections": profile_collections(state)?,
            "assets": profile_assets_manifest(state)?,
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

pub(crate) fn import_profile_upload(
    state: &AppState,
    filename: &str,
    base64: &str,
) -> AppResult<Value> {
    let extension = Path::new(filename)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .ok_or_else(|| AppError::invalid_input("Profile upload must be a .json or .zip file"))?;
    let bytes =
        base64::Engine::decode(&general_purpose::STANDARD, base64.trim()).map_err(|error| {
            AppError::invalid_input(format!("Invalid profile upload data: {error}"))
        })?;
    match extension.as_str() {
        "json" => import_profile(state, serde_json::from_slice(&bytes)?),
        "zip" => {
            let upload_dir = state.data_dir.join(".profile-upload-imports");
            fs::create_dir_all(&upload_dir)?;
            let path = upload_dir.join(format!("profile-import-{}.zip", now_millis()));
            fs::write(&path, bytes)?;
            let result = import_profile_zip(state, &path);
            let _ = fs::remove_file(path);
            result
        }
        _ => Err(AppError::invalid_input(
            "Profile upload must be a .json or .zip file",
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

pub(crate) fn export_profile(state: &AppState, format: Option<&str>) -> AppResult<Value> {
    match format {
        Some("native") | None => native_profile_export(state),
        Some("compatible") => super::exports::export_compatible_profile(state),
        Some("zip") => super::backup::download_profile_zip(state),
        Some(_) => Err(AppError::invalid_input(
            "Profile export format must be native, compatible, or zip.",
        )),
    }
}

fn native_profile_export(state: &AppState) -> AppResult<Value> {
    let snapshot = profile_snapshot(state)?;
    let estimated_bytes = serde_json::to_vec(&snapshot)?.len();
    if estimated_bytes > PROFILE_EXPORT_JSON_LIMIT_BYTES {
        return Err(AppError::with_details(
            PROFILE_EXPORT_JSON_TOO_LARGE_CODE,
            "This profile is too large for the JSON profile exporter. Export it as a profile ZIP instead.",
            json!({
                "fallbackFormat": "zip",
                "estimatedBytes": estimated_bytes,
                "limitBytes": PROFILE_EXPORT_JSON_LIMIT_BYTES,
            }),
        ));
    }
    Ok(snapshot)
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
    validate_native_profile_import(data, collections)?;
    let mut restored_assets = restore_profile_assets(state, data.get("assets"))?;
    let restored_count = restored_assets.restored();
    let result =
        import_profile_collections_with_restored_assets(state, collections, restored_count, || {
            restored_assets.install()
        });
    finish_profile_import_assets(restored_assets, result)
}

pub(super) fn validate_native_profile_import(
    data: &Map<String, Value>,
    collections: &Map<String, Value>,
) -> AppResult<()> {
    match data.get("assets") {
        Some(Value::Array(_)) => {}
        Some(_) => {
            return Err(AppError::invalid_input(
                "Profile export data.assets must be a JSON array",
            ));
        }
        None => {
            return Err(AppError::invalid_input(
                "Native profile export is missing data.assets",
            ));
        }
    }
    for collection in contracts::profile_collections() {
        match collections.get(collection) {
            Some(Value::Array(_)) => {}
            Some(_) => {
                return Err(AppError::invalid_input(format!(
                    "Profile collection `{collection}` must be a JSON array"
                )));
            }
            None => {
                return Err(AppError::invalid_input(format!(
                    "Native profile export is missing collection `{collection}`"
                )));
            }
        }
    }
    Ok(())
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
    for collection in contracts::profile_collections() {
        // A partial modern profile (a hand-built export, or a file missing a
        // collection) must not wipe collections it does not carry. Skipping the
        // replacement leaves the user's existing collection untouched; a
        // collection that is present but empty is still an explicit clear and
        // falls through to a normal empty replacement. Mirrors the legacy table
        // path guard added in #1518.
        let Some(collection_value) = collections.get(collection) else {
            continue;
        };
        // A present-but-non-array collection is malformed (e.g. `"characters": {}`).
        // Coercing it to an empty array would silently clear the collection - the
        // same data loss the absent-key skip above guards against. Reject the
        // import instead so nothing is replaced.
        if !collection_value.is_array() {
            return Err(AppError::invalid_input(format!(
                "Profile collection `{collection}` must be a JSON array"
            )));
        }
        let mut rows = collection_value.as_array().cloned().unwrap_or_default();
        if collection == "prompt-overrides" {
            unsupported_prompt_overrides = normalize_profile_prompt_overrides(&mut rows);
        }
        normalize_profile_json_fields(collection, &mut rows)?;
        if collection == "connections" {
            rows = rows
                .into_iter()
                .map(|row| connection_secrets::prepare_connection_for_create(state, row))
                .collect::<AppResult<Vec<_>>>()?;
        }
        imported.insert(collection.to_string(), json!(rows.len()));
        replacements.push((collection, rows));
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
        if !prompt_overrides::is_supported_prompt_override_key(&key) {
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
    let warnings = restored_assets.warnings().to_vec();
    match result {
        Ok(mut value) => {
            restored_assets.commit();
            if !warnings.is_empty() {
                if let Some(object) = value.as_object_mut() {
                    object.insert("warnings".to_string(), Value::Array(warnings));
                }
            }
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
    for collection in contracts::profile_collections() {
        let rows = if collection == "connections" {
            connection_secrets::connections_for_export(state)?
        } else {
            state.storage.list(collection)?
        };
        collections.insert(collection.to_string(), Value::Array(rows));
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
    fn native_profile_import_rejects_missing_assets_without_wiping_existing_assets() {
        let state = test_state("missing-assets-no-wipe");
        let avatar_dir = state.data_dir.join("avatars");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        std::fs::write(avatar_dir.join("keep.png"), b"keep").expect("avatar fixture should write");
        let collections = complete_empty_profile_collections();

        let error = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections
                }
            }),
        )
        .expect_err("native profile missing data.assets should be rejected");

        assert_eq!(error.code, "invalid_input");
        assert_eq!(
            std::fs::read(avatar_dir.join("keep.png")).expect("avatar should remain"),
            b"keep"
        );
    }

    #[test]
    fn native_profile_import_rejects_missing_collection_without_wiping_existing_rows() {
        let state = test_state("missing-collection-no-wipe");
        state
            .storage
            .upsert_with_id(
                "characters",
                "char-1",
                json!({ "name": "Keep Me", "data": { "name": "Keep Me" } }),
            )
            .expect("seeded character should write");
        let mut collections = complete_empty_profile_collections();
        collections.remove("characters");

        let error = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": []
                }
            }),
        )
        .expect_err("native profile missing a collection should be rejected");

        assert_eq!(error.code, "invalid_input");
        assert!(state
            .storage
            .get("characters", "char-1")
            .expect("character lookup should not fail")
            .is_some());
    }

    #[test]
    fn legacy_profile_import_without_files_preserves_existing_assets() {
        let state = test_state("legacy-missing-files-preserves-assets");
        let avatar_dir = state.data_dir.join("avatars");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        std::fs::write(avatar_dir.join("keep.png"), b"keep").expect("avatar fixture should write");

        import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "fileStorage": {
                        "tables": {
                            "chats": []
                        }
                    }
                }
            }),
        )
        .expect("legacy profile without files should import partial tables");

        assert_eq!(
            std::fs::read(avatar_dir.join("keep.png")).expect("avatar should remain"),
            b"keep"
        );
    }

    fn complete_empty_profile_collections() -> Map<String, Value> {
        contracts::profile_collections()
            .map(|collection| (collection.to_string(), json!([])))
            .collect()
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
                    "template": "Background ${defaultPrompt}",
                    "enabled": "true"
                },
                {
                    "id": "sprite.portraitSingle",
                    "key": "sprite.portraitSingle",
                    "template": "Sprite ${defaultPrompt}",
                    "enabled": "true"
                },
                {
                    "id": "game.unknown",
                    "key": "game.unknown",
                    "template": "Unknown ${defaultPrompt}",
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
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0]["id"], "conversation.selfie");
        assert_eq!(rows[0]["key"], "conversation.selfie");
        assert_eq!(rows[0]["template"], "Selfie ${charName}");
        assert_eq!(rows[0]["enabled"], true);
        assert_eq!(rows[1]["id"], "game.background");
        assert_eq!(rows[1]["key"], "game.background");
        assert_eq!(rows[1]["template"], "Background ${defaultPrompt}");
        assert_eq!(rows[2]["id"], "sprite.portraitSingle");
        assert_eq!(rows[2]["key"], "sprite.portraitSingle");
        assert_eq!(rows[2]["template"], "Sprite ${defaultPrompt}");
        assert_eq!(rows[2]["enabled"], true);
        assert_eq!(result["imported"]["prompt-overrides"], 3);
        assert_eq!(result["imported"]["unsupportedPromptOverrides"], 3);
    }

    #[test]
    fn profile_import_modern_skips_absent_collections() {
        let state = test_state("modern-skip-absent");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "existing-character" })])
            .unwrap();

        // A partial modern profile that only carries `lorebooks` must leave the
        // absent `characters` collection untouched instead of wiping it.
        let mut collections = Map::new();
        collections.insert(
            "lorebooks".to_string(),
            json!([{ "id": "imported-lorebook" }]),
        );

        let result =
            import_profile_collections_with_restored_assets(&state, &collections, 0, || Ok(()))
                .expect("partial modern profile import should succeed");

        let characters = state.storage.list("characters").unwrap();
        assert_eq!(characters.len(), 1);
        assert_eq!(characters[0]["id"], "existing-character");
        let lorebooks = state.storage.list("lorebooks").unwrap();
        assert_eq!(lorebooks.len(), 1);
        assert_eq!(lorebooks[0]["id"], "imported-lorebook");
        // Absent collections are not reported as imported.
        assert!(result["imported"].get("characters").is_none());
        assert_eq!(result["imported"]["lorebooks"], 1);
    }

    #[test]
    fn profile_import_modern_present_empty_collection_clears() {
        let state = test_state("modern-present-empty-clears");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "existing-character" })])
            .unwrap();

        // An explicitly present-but-empty collection is still a deliberate clear.
        let mut collections = Map::new();
        collections.insert("characters".to_string(), json!([]));

        import_profile_collections_with_restored_assets(&state, &collections, 0, || Ok(()))
            .expect("present-but-empty collection should clear");

        assert!(state.storage.list("characters").unwrap().is_empty());
    }

    #[test]
    fn profile_import_modern_rejects_non_array_collection() {
        let state = test_state("modern-reject-non-array");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "existing-character" })])
            .unwrap();

        // A present-but-non-array collection is malformed and must be rejected
        // before anything is replaced, so existing data is preserved.
        let mut collections = Map::new();
        collections.insert("characters".to_string(), json!({}));

        let error =
            import_profile_collections_with_restored_assets(&state, &collections, 0, || Ok(()))
                .expect_err("a non-array collection should be rejected");
        assert_eq!(error.code, "invalid_input");

        let characters = state.storage.list("characters").unwrap();
        assert_eq!(characters.len(), 1);
        assert_eq!(characters[0]["id"], "existing-character");
    }

    #[test]
    fn profile_export_import_preserves_connection_folders() {
        let source = test_state("connection-folders-export-source");
        source
            .storage
            .upsert_with_id(
                "connection-folders",
                "folder-1",
                json!({
                    "id": "folder-1",
                    "name": "Providers",
                    "color": "#38bdf8",
                    "sortOrder": 2,
                    "collapsed": true
                }),
            )
            .expect("connection folder should write");
        source
            .storage
            .upsert_with_id(
                "connections",
                "conn-1",
                connection_secrets::prepare_connection_for_create(
                    &source,
                    json!({
                        "id": "conn-1",
                        "name": "OpenAI",
                        "provider": "openai",
                        "model": "gpt-4.1",
                        "folderId": "folder-1",
                        "sortOrder": 7,
                        "apiKey": "sk-export-secret"
                    }),
                )
                .expect("connection secret should encrypt"),
            )
            .expect("connection should write");

        let snapshot = profile_snapshot(&source).expect("profile snapshot should export");
        assert_eq!(
            snapshot["data"]["collections"]["connection-folders"][0]["id"],
            "folder-1"
        );
        assert_eq!(
            snapshot["data"]["collections"]["connections"][0]["folderId"],
            "folder-1"
        );
        assert_eq!(
            snapshot["data"]["collections"]["connections"][0]["apiKey"],
            connection_secrets::API_KEY_MASK
        );
        assert_eq!(
            snapshot["data"]["collections"]["connections"][0]["hasApiKey"],
            true
        );
        assert!(snapshot["data"]["collections"]["connections"][0]
            .get("apiKeyEncrypted")
            .is_none());

        let target = test_state("connection-folders-export-target");
        import_profile(&target, snapshot).expect("native profile import should succeed");

        let folder = target
            .storage
            .get("connection-folders", "folder-1")
            .expect("connection folder lookup should not fail")
            .expect("imported connection folder should exist");
        assert_eq!(folder["name"], "Providers");
        assert_eq!(folder["collapsed"], true);

        let connection = target
            .storage
            .get("connections", "conn-1")
            .expect("connection lookup should not fail")
            .expect("imported connection should exist");
        assert_eq!(connection["folderId"], "folder-1");
        assert_eq!(connection["sortOrder"], 7);
        assert!(connection.get("apiKey").is_none());
        assert!(connection.get("apiKeyEncrypted").is_none());
    }

    #[test]
    fn profile_export_supports_compatible_and_zip_formats() {
        let state = test_state("profile-export-formats");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "character-1",
                    "data": {
                        "name": "Bundle Character"
                    }
                }),
            )
            .expect("fixture character should write");

        let compatible = profile_call(
            &state,
            "GET",
            &["export"],
            &ParsedPath::new("/profile/export?format=compatible"),
            Value::Null,
        )
        .expect("compatible profile export should succeed");
        assert_eq!(compatible["filename"], "marinara-compatible-export.zip");
        assert_eq!(compatible["contentType"], "application/zip");
        assert!(compatible["base64"].as_str().unwrap_or_default().len() > 16);

        let zip = profile_call(
            &state,
            "GET",
            &["export"],
            &ParsedPath::new("/profile/export?format=zip"),
            Value::Null,
        )
        .expect("profile ZIP export should succeed");
        assert_eq!(zip["filename"], "marinara-profile.zip");
        assert_eq!(zip["contentType"], "application/zip");
        assert!(zip["base64"].as_str().unwrap_or_default().len() > 16);
    }

    #[test]
    fn profile_upload_import_accepts_json_payloads() {
        let state = test_state("profile-upload-json");
        let envelope = json!({
            "type": "marinara_profile",
            "version": 1,
            "data": {
                "fileStorage": {
                    "tables": {
                        "chats": [
                            {
                                "id": "chat-1",
                                "name": "Uploaded Chat",
                                "mode": "conversation",
                                "metadata": {},
                                "characterIds": []
                            }
                        ]
                    }
                }
            }
        });
        let base64 = base64::Engine::encode(
            &general_purpose::STANDARD,
            serde_json::to_vec(&envelope).unwrap(),
        );

        let result = import_profile_upload(&state, "profile.json", &base64)
            .expect("uploaded profile JSON should import");

        assert_eq!(result["success"], true);
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat lookup should not fail")
            .expect("uploaded chat should import");
        assert_eq!(chat["name"], "Uploaded Chat");
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
