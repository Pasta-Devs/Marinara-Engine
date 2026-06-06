use super::{connection_secrets, profile};
use crate::state::AppState;
use base64::{engine::general_purpose, Engine as _};
use marinara_core::{now_millis, AppError, AppResult};
use serde_json::{json, Value};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

const BACKUP_DIRS: &[&str] = &[
    "data",
    "avatars",
    "sprites",
    "backgrounds",
    "gallery",
    "game-assets",
    "fonts",
    "knowledge-sources",
    "lorebooks/images",
];

const RESTORE_NOTES: &str = "\
Marinara Engine backup

This archive contains a managed backup for Marinara Engine recovery.

Preferred restore path:
1. Open Marinara Settings -> Import.
2. Use Import Profile and select this zip archive, or select marinara-profile.json if the archive was extracted.

Manual recovery path:
1. Close Marinara before copying files.
2. Copy the archive folders into your Marinara app data directory.
3. In the refactor app layout, JSON collections live in data/collections. Keep companion files beside them, including *.json.bak collection backups.
4. Managed asset folders are avatars, sprites, backgrounds, gallery, game-assets, fonts, knowledge-sources, and lorebooks/images.
5. Legacy raw backups used storage/ for JSON data; current refactor backups use data/.
";

fn backups_root(state: &AppState) -> PathBuf {
    state.data_dir.join("backups")
}

fn timestamped_backup_name() -> String {
    let timestamp = chrono::Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    format!("marinara-backup-{timestamp}-{}", now_millis())
}

fn valid_backup_name(name: &str) -> bool {
    name.starts_with("marinara-backup-")
        && name.len() > "marinara-backup-".len()
        && name
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
}

fn backup_dir_for_name(state: &AppState, name: &str) -> AppResult<PathBuf> {
    if !valid_backup_name(name) {
        return Err(AppError::invalid_input("Invalid backup name"));
    }
    let root = backups_root(state);
    let candidate = root.join(name);
    let root_canonical = fs::canonicalize(&root)
        .map_err(|_| AppError::not_found("Managed backups directory was not found"))?;
    let candidate_canonical = fs::canonicalize(&candidate)
        .map_err(|_| AppError::not_found("Managed backup was not found"))?;
    if !candidate_canonical.starts_with(&root_canonical) {
        return Err(AppError::invalid_input("Invalid backup path"));
    }
    if !candidate_canonical.is_dir() {
        return Err(AppError::not_found("Managed backup was not found"));
    }
    Ok(candidate_canonical)
}

fn copy_dir_contents(source: &Path, target: &Path) -> AppResult<()> {
    if !source.exists() {
        return Ok(());
    }
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let metadata = fs::symlink_metadata(&source_path)?;
        if metadata.file_type().is_symlink() {
            continue;
        }
        if metadata.is_dir() {
            copy_dir_contents(&source_path, &target_path)?;
        } else if metadata.is_file() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            copy_backup_file(&source_path, &target_path)?;
        }
    }
    Ok(())
}

fn copy_backup_file(source_path: &Path, target_path: &Path) -> AppResult<()> {
    if is_connections_collection_file(source_path) {
        let mut value: Value = serde_json::from_slice(&fs::read(source_path)?)?;
        match &mut value {
            Value::Array(rows) => {
                for row in rows {
                    connection_secrets::mask_connection_for_read(row);
                }
            }
            Value::Object(_) => connection_secrets::mask_connection_for_read(&mut value),
            _ => {}
        }
        fs::write(target_path, serde_json::to_vec_pretty(&value)?)?;
    } else {
        fs::copy(source_path, target_path)?;
    }
    Ok(())
}

fn is_connections_collection_file(path: &Path) -> bool {
    path.file_name().and_then(|value| value.to_str()) == Some("connections.json")
        && path
            .parent()
            .and_then(Path::file_name)
            .and_then(|value| value.to_str())
            == Some("collections")
}

fn write_backup_payload(state: &AppState, target: &Path) -> AppResult<()> {
    state.storage.flush()?;
    fs::create_dir_all(target)?;
    let profile = profile::profile_backup_snapshot(state)?;
    fs::write(
        target.join("marinara-profile.json"),
        serde_json::to_vec_pretty(&profile)?,
    )?;
    fs::write(target.join("RESTORE.txt"), RESTORE_NOTES)?;
    for dir in BACKUP_DIRS {
        let source = state.data_dir.join(dir);
        if source.exists() {
            copy_dir_contents(&source, &target.join(dir))?;
        }
    }
    Ok(())
}

fn backup_entry(path: &Path) -> AppResult<Value> {
    let metadata = fs::metadata(path)?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::invalid_input("Managed backup path is missing a folder name"))?;
    let created_at = metadata
        .created()
        .or_else(|_| metadata.modified())
        .ok()
        .map(chrono::DateTime::<chrono::Utc>::from)
        .map(|time| time.to_rfc3339())
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    Ok(json!({
        "name": name,
        "createdAt": created_at,
    }))
}

pub(crate) fn create_backup(state: &AppState) -> AppResult<Value> {
    let backup_name = timestamped_backup_name();
    let backup_dir = backups_root(state).join(&backup_name);
    write_backup_payload(state, &backup_dir)?;
    Ok(json!({
        "success": true,
        "backupName": backup_name,
    }))
}

pub(crate) fn list_backups(state: &AppState) -> AppResult<Value> {
    let root = backups_root(state);
    if !root.exists() {
        return Ok(Value::Array(Vec::new()));
    }
    let mut backups = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let metadata = fs::symlink_metadata(&path)?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() || !valid_backup_name(&name) {
            continue;
        }
        backups.push(backup_entry(&path)?);
    }
    backups.sort_by(|a, b| {
        let a_created = a.get("createdAt").and_then(Value::as_str).unwrap_or("");
        let b_created = b.get("createdAt").and_then(Value::as_str).unwrap_or("");
        b_created.cmp(a_created)
    });
    Ok(Value::Array(backups))
}

pub(crate) fn delete_backup(state: &AppState, name: &str) -> AppResult<Value> {
    let backup_dir = backup_dir_for_name(state, name)?;
    fs::remove_dir_all(backup_dir)?;
    Ok(json!({ "success": true, "deleted": true }))
}

fn zip_error(error: zip::result::ZipError) -> AppError {
    AppError::new("backup_zip_error", error.to_string())
}

fn zip_io_error(error: std::io::Error) -> AppError {
    AppError::new("backup_zip_error", error.to_string())
}

fn zip_dir_contents(
    zip: &mut ZipWriter<Cursor<Vec<u8>>>,
    source: &Path,
    entry_root: &str,
    options: SimpleFileOptions,
) -> AppResult<()> {
    if !source.exists() {
        return Ok(());
    }
    let mut stack = vec![(source.to_path_buf(), entry_root.to_string())];
    while let Some((current, current_entry)) = stack.pop() {
        zip.add_directory(format!("{current_entry}/"), options)
            .map_err(zip_error)?;
        for entry in fs::read_dir(&current)? {
            let entry = entry?;
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path)?;
            if metadata.file_type().is_symlink() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().replace('\\', "/");
            let zip_entry = format!("{current_entry}/{name}");
            if metadata.is_dir() {
                stack.push((path, zip_entry));
            } else if metadata.is_file() {
                zip.start_file(zip_entry, options).map_err(zip_error)?;
                let mut file = fs::File::open(path)?;
                std::io::copy(&mut file, zip).map_err(zip_io_error)?;
            }
        }
    }
    Ok(())
}

fn zip_backup_folder(folder: &Path, backup_name: &str) -> AppResult<Vec<u8>> {
    let cursor = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    zip_dir_contents(&mut zip, folder, backup_name, options)?;
    let cursor = zip.finish().map_err(zip_error)?;
    Ok(cursor.into_inner())
}

pub(crate) fn download_backup(state: &AppState, name: Option<&str>) -> AppResult<Value> {
    let (backup_dir, backup_name, temp_dir) =
        if let Some(name) = name.filter(|value| !value.trim().is_empty()) {
            (backup_dir_for_name(state, name)?, name.to_string(), None)
        } else {
            let backup_name = timestamped_backup_name();
            let temp_dir = state
                .data_dir
                .join(".backup-downloads")
                .join(format!("{backup_name}-staging"));
            if temp_dir.exists() {
                fs::remove_dir_all(&temp_dir)?;
            }
            write_backup_payload(state, &temp_dir)?;
            (temp_dir.clone(), backup_name, Some(temp_dir))
        };

    let bytes = zip_backup_folder(&backup_dir, &backup_name)?;
    if let Some(temp_dir) = temp_dir {
        let _ = fs::remove_dir_all(temp_dir);
    }
    Ok(json!({
        "base64": general_purpose::STANDARD.encode(bytes),
        "filename": format!("{backup_name}.zip"),
        "contentType": "application/zip",
    }))
}

pub(crate) fn download_profile_zip(state: &AppState) -> AppResult<Value> {
    let bytes = download_profile_zip_bytes(state)?;
    Ok(json!({
        "base64": general_purpose::STANDARD.encode(bytes),
        "filename": "marinara-profile.zip",
        "contentType": "application/zip",
    }))
}

pub(crate) fn download_profile_zip_bytes(state: &AppState) -> AppResult<Vec<u8>> {
    let temp_dir = state
        .data_dir
        .join(".profile-export-downloads")
        .join(format!("marinara-profile-{}-staging", now_millis()));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir)?;
    }
    let result = (|| {
        write_backup_payload(state, &temp_dir)?;
        zip_backup_folder(&temp_dir, "marinara-profile")
    })();
    let _ = fs::remove_dir_all(&temp_dir);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-managed-backup-{label}-{nonce}"));
        if path.exists() {
            fs::remove_dir_all(&path).expect("stale temp backup dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    #[test]
    fn create_list_download_delete_managed_backup() {
        let state = test_state("roundtrip");
        state
            .storage
            .create(
                "characters",
                json!({ "id": "character-1", "data": { "name": "Backup Character" } }),
            )
            .expect("fixture character should write");
        fs::create_dir_all(state.data_dir.join("avatars/characters"))
            .expect("avatar dir should be created");
        fs::write(
            state.data_dir.join("avatars/characters/avatar.png"),
            b"avatar-bytes",
        )
        .expect("avatar fixture should write");

        let created = create_backup(&state).expect("managed backup should be created");
        let name = created["backupName"]
            .as_str()
            .expect("backup name should be returned");
        let backup_dir = state.data_dir.join("backups").join(name);
        assert!(backup_dir.join("marinara-profile.json").is_file());
        assert!(backup_dir.join("RESTORE.txt").is_file());
        assert!(backup_dir
            .join("data/collections/characters.json")
            .is_file());
        assert!(backup_dir.join("avatars/characters/avatar.png").is_file());
        let profile_json: Value = serde_json::from_slice(
            &fs::read(backup_dir.join("marinara-profile.json")).expect("profile json should read"),
        )
        .expect("profile json should parse");
        let asset = profile_json["data"]["assets"]
            .as_array()
            .expect("asset manifest should be an array")
            .iter()
            .find(|asset| asset["path"] == "avatars/characters/avatar.png")
            .expect("avatar asset should be listed");
        assert!(asset.get("base64").is_none());
        assert_eq!(asset["size"], 12);

        let backups = list_backups(&state)
            .expect("managed backups should list")
            .as_array()
            .expect("backup list should be an array")
            .clone();
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0]["name"], name);
        assert!(backups[0].get("path").is_none());

        let downloaded =
            download_backup(&state, Some(name)).expect("managed backup should download");
        assert_eq!(downloaded["filename"], format!("{name}.zip"));
        assert_eq!(downloaded["contentType"], "application/zip");
        assert!(downloaded["base64"].as_str().unwrap_or_default().len() > 16);

        let deleted = delete_backup(&state, name).expect("managed backup should delete");
        assert_eq!(deleted["deleted"], true);
        assert!(!backup_dir.exists());
    }

    #[test]
    fn invalid_backup_names_do_not_escape_backups_root() {
        let state = test_state("invalid-name");
        fs::create_dir_all(state.data_dir.join("backups")).expect("backups dir should be created");

        for name in [
            "../marinara-backup-escape",
            "marinara-backup-../escape",
            "not-a-backup",
        ] {
            let error = delete_backup(&state, name).expect_err("invalid backup name should fail");
            assert_eq!(error.code, "invalid_input");
        }
    }
}
