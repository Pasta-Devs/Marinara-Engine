use super::assets::{normalize_zip_entry_name, restore_profile_zip_assets};
use super::{
    finish_profile_import_assets, import_profile_collections_with_restored_assets,
    legacy::import_legacy_profile_tables_with_restored_assets, validate_native_profile_import,
};
use crate::state::AppState;
use marinara_core::{AppError, AppResult};
use serde_json::Value;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

const PROFILE_JSON_ENTRY: &str = "marinara-profile.json";
// Heavy real-world profiles inline their chat/message tables (and large
// fields like `chats.memories`) into marinara-profile.json, so the file scales
// with history size and can reach hundreds of MB. Keep a generous sanity cap
// to guard against a pathological multi-GB entry while still allowing real
// migrations through.
const MAX_PROFILE_JSON_BYTES: u64 = 1024 * 1024 * 1024;

pub(super) fn import_profile_zip(state: &AppState, path: &Path) -> AppResult<Value> {
    let file = File::open(path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| AppError::invalid_input(format!("Could not read profile ZIP: {error}")))?;
    let names = zip_entry_names(&mut archive)?;
    let (profile_entry, profile_prefix) = profile_json_entry(&names)?;
    let envelope = read_profile_zip_json(&mut archive, &profile_entry)?;
    let data = envelope
        .get("data")
        .and_then(Value::as_object)
        .filter(|_| envelope.get("type").and_then(Value::as_str) == Some("marinara_profile"))
        .ok_or_else(|| AppError::invalid_input("Invalid Marinara profile export"))?;
    let files = data
        .get("fileStorage")
        .and_then(|value| value.get("files"))
        .or_else(|| data.get("assets"));
    if let Some(collections) = data.get("collections").and_then(Value::as_object) {
        validate_native_profile_import(data, collections)?;
        let mut restored_assets =
            restore_profile_zip_assets(state, &mut archive, &names, &profile_prefix, files)?;
        let restored_count = restored_assets.restored();
        let result = import_profile_collections_with_restored_assets(
            state,
            collections,
            restored_count,
            || restored_assets.install(),
        );
        finish_profile_import_assets(restored_assets, result)
    } else {
        let tables = data
            .get("fileStorage")
            .and_then(|value| value.get("tables"))
            .and_then(Value::as_object)
            .ok_or_else(|| {
                AppError::invalid_input(
                    "Profile ZIP must contain data.collections or data.fileStorage.tables",
                )
            })?;
        let mut restored_assets =
            restore_profile_zip_assets(state, &mut archive, &names, &profile_prefix, files)?;
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
}

fn zip_entry_names<R: Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
) -> AppResult<Vec<String>> {
    let mut names = Vec::new();
    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(|error| {
            AppError::invalid_input(format!("Could not read profile ZIP entry: {error}"))
        })?;
        names.push(file.name().to_string());
    }
    Ok(names)
}

fn profile_json_entry(names: &[String]) -> AppResult<(String, String)> {
    for name in names {
        let normalized = normalize_zip_entry_name(name);
        if normalized == PROFILE_JSON_ENTRY
            || normalized.ends_with(&format!("/{PROFILE_JSON_ENTRY}"))
        {
            let prefix = normalized
                .strip_suffix(PROFILE_JSON_ENTRY)
                .unwrap_or("")
                .trim_end_matches('/')
                .to_string();
            return Ok((name.clone(), prefix));
        }
    }
    Err(AppError::invalid_input(
        "Profile ZIP is missing marinara-profile.json",
    ))
}

fn read_profile_zip_json<R: Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    entry_name: &str,
) -> AppResult<Value> {
    let entry = archive.by_name(entry_name).map_err(|error| {
        AppError::invalid_input(format!("Could not read marinara-profile.json: {error}"))
    })?;
    // Reject early on the declared uncompressed size so a pathological entry
    // never starts streaming. The `.take` below still bounds the read in case
    // the zip header understates the real size.
    if entry.size() > MAX_PROFILE_JSON_BYTES {
        return Err(AppError::invalid_input(
            "marinara-profile.json in profile ZIP is too large",
        ));
    }
    // Stream the parse straight off the zip entry instead of buffering the
    // whole file into a Vec first. serde still materializes the Value tree, but
    // dropping the intermediate byte buffer keeps peak memory lower on the
    // hundreds-of-MB profiles this path has to handle.
    let reader = BufReader::new(entry.take(MAX_PROFILE_JSON_BYTES));
    Ok(serde_json::from_reader(reader)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use serde_json::json;
    use std::io::Write;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};
    use zip::write::SimpleFileOptions;

    fn nonce() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos()
    }

    fn test_state(label: &str) -> AppState {
        let path = std::env::temp_dir().join(format!("marinara-zip-import-{label}-{}", nonce()));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn write_profile_zip(label: &str, profile_json: &str) -> PathBuf {
        let zip_path =
            std::env::temp_dir().join(format!("marinara-zip-import-{label}-{}.zip", nonce()));
        let file = File::create(&zip_path).expect("zip file should be creatable");
        let mut writer = zip::ZipWriter::new(file);
        writer
            .start_file(
                PROFILE_JSON_ENTRY,
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored),
            )
            .expect("zip entry should start");
        writer
            .write_all(profile_json.as_bytes())
            .expect("zip entry should write");
        writer.finish().expect("zip should finalize");
        zip_path
    }

    #[test]
    fn import_profile_zip_streams_legacy_tables_from_entry() {
        let state = test_state("legacy-stream");
        let profile_json = json!({
            "type": "marinara_profile",
            "data": {
                "fileStorage": {
                    "tables": {
                        "chats": [
                            {
                                "id": "chat-1",
                                "name": "Imported Chat",
                                "mode": "conversation",
                                "metadata": {},
                                "characterIds": []
                            }
                        ]
                    }
                }
            }
        })
        .to_string();
        let zip_path = write_profile_zip("legacy-stream", &profile_json);

        let result = import_profile_zip(&state, &zip_path).expect("zip import should succeed");
        assert_eq!(result["success"], true);

        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat lookup should not fail")
            .expect("imported chat should be present");
        assert_eq!(chat["name"], "Imported Chat");

        let _ = std::fs::remove_file(&zip_path);
    }
}
