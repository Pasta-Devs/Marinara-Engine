use super::{exports, http, profile, prompts, shared};
use crate::state::AppState;
use base64::{engine::general_purpose, Engine as _};
use marinara_core::AppError;
use serde_json::{json, Value};
use std::fs::{File, OpenOptions};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::State;

const MAX_LOCAL_BINARY_BYTES: u64 = 25 * 1024 * 1024;
const LOCAL_BINARY_ASSET_DIRS: &[&str] = &[
    "avatars",
    "backgrounds",
    "fonts",
    "gallery",
    "game-assets",
    "knowledge-sources",
    "lorebooks/images",
    "sprites",
];

#[tauri::command]
pub async fn load_url_binary(
    state: State<'_, AppState>,
    url: String,
    fallback_mime: Option<String>,
) -> Result<Value, AppError> {
    let fallback_mime = fallback_mime
        .as_deref()
        .unwrap_or("application/octet-stream");
    load_url_binary_for_state(&state, &url, fallback_mime).await
}

pub(crate) async fn load_url_binary_for_state(
    state: &AppState,
    url: &str,
    fallback_mime: &str,
) -> Result<Value, AppError> {
    if let Some(response) = load_local_asset_binary(state, url, fallback_mime)? {
        return Ok(response);
    }
    http::http_binary(url, fallback_mime).await
}

fn load_local_asset_binary(
    state: &AppState,
    url: &str,
    fallback_mime: &str,
) -> Result<Option<Value>, AppError> {
    let Some(path) = local_asset_path_from_url(url) else {
        return Ok(None);
    };
    let canonical_path = std::fs::canonicalize(&path).map_err(|error| {
        AppError::new(
            "local_asset_not_found",
            format!("Managed local asset could not be read: {error}"),
        )
    })?;
    let data_dir = std::fs::canonicalize(&state.data_dir).map_err(AppError::from)?;
    if !canonical_path.starts_with(&data_dir) {
        return Err(AppError::invalid_input(
            "Managed local asset URL is outside the app data directory",
        ));
    }
    if !is_managed_local_binary_asset(&data_dir, &canonical_path) {
        return Err(AppError::invalid_input(
            "Managed local asset URL is outside allowed media directories",
        ));
    }

    let file = open_local_binary_file(&path).map_err(AppError::from)?;
    let metadata = file.metadata().map_err(AppError::from)?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(AppError::invalid_input(
            "Managed local asset URL does not point to a file",
        ));
    }
    if metadata.len() > MAX_LOCAL_BINARY_BYTES {
        return Err(AppError::invalid_input("Local asset file is too large"));
    }

    let mut bytes = Vec::new();
    let mut reader = file.take(MAX_LOCAL_BINARY_BYTES + 1);
    reader.read_to_end(&mut bytes).map_err(AppError::from)?;
    if bytes.len() as u64 > MAX_LOCAL_BINARY_BYTES {
        return Err(AppError::invalid_input("Local asset file is too large"));
    }

    Ok(Some(json!({
        "base64": general_purpose::STANDARD.encode(bytes),
        "mimeType": local_binary_mime_type(&canonical_path, fallback_mime)
    })))
}

fn open_local_binary_file(path: &Path) -> std::io::Result<File> {
    let mut options = OpenOptions::new();
    options.read(true);
    configure_no_follow_open(&mut options);
    options.open(path)
}

#[cfg(unix)]
fn configure_no_follow_open(options: &mut OpenOptions) {
    use std::os::unix::fs::OpenOptionsExt;

    options.custom_flags(libc::O_NOFOLLOW);
}

#[cfg(windows)]
fn configure_no_follow_open(options: &mut OpenOptions) {
    use std::os::windows::fs::OpenOptionsExt;

    const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x0020_0000;
    options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
}

#[cfg(not(any(unix, windows)))]
fn configure_no_follow_open(_options: &mut OpenOptions) {}

fn local_asset_path_from_url(url: &str) -> Option<PathBuf> {
    let trimmed = url.trim();
    let encoded = trimmed
        .strip_prefix("asset://localhost/")
        .or_else(|| trimmed.strip_prefix("http://asset.localhost/"))?;
    let encoded = encoded
        .split(['?', '#'])
        .next()
        .filter(|value| !value.is_empty())?;
    Some(PathBuf::from(percent_decode(encoded)))
}

fn local_binary_mime_type(path: &Path, fallback_mime: &str) -> String {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "webm" => "video/webm",
        "mp4" => "video/mp4",
        _ => fallback_mime,
    }
    .to_string()
}

fn is_managed_local_binary_asset(data_dir: &Path, path: &Path) -> bool {
    LOCAL_BINARY_ASSET_DIRS.iter().any(|asset_dir| {
        std::fs::canonicalize(data_dir.join(asset_dir))
            .ok()
            .is_some_and(|allowed_root| path.starts_with(allowed_root))
    })
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' if index + 2 < bytes.len() => {
                if let (Some(hi), Some(lo)) =
                    (hex_value(bytes[index + 1]), hex_value(bytes[index + 2]))
                {
                    output.push((hi << 4) | lo);
                    index += 3;
                } else {
                    output.push(bytes[index]);
                    index += 1;
                }
            }
            byte => {
                output.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&output).to_string()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[tauri::command]
pub fn profile_export(
    state: State<'_, AppState>,
    format: Option<String>,
) -> Result<Value, AppError> {
    profile::export_profile(&state, format.as_deref())
}

#[tauri::command]
pub fn profile_import(state: State<'_, AppState>, envelope: Value) -> Result<Value, AppError> {
    profile::profile_call(
        &state,
        "POST",
        &["import"],
        &shared::ParsedPath::new("/profile/import"),
        envelope,
    )
}

#[tauri::command]
pub fn profile_import_preview_file(
    state: State<'_, AppState>,
    path: String,
) -> Result<Value, AppError> {
    profile::preview_profile_file_path(&state, &path)
}

#[tauri::command]
pub fn profile_import_file(
    state: State<'_, AppState>,
    path: String,
    preview_fingerprint: Option<String>,
) -> Result<Value, AppError> {
    profile::import_profile_file_path(&state, &path, preview_fingerprint.as_deref())
}

#[tauri::command]
pub fn profile_import_file_events(
    state: State<'_, AppState>,
    path: String,
    preview_fingerprint: Option<String>,
    on_event: tauri::ipc::Channel<Value>,
) -> Result<Value, AppError> {
    let result = profile::import_profile_file_path_with_progress(
        &state,
        &path,
        preview_fingerprint.as_deref(),
        |event| {
            on_event
                .send(event)
                .map_err(|error| AppError::new("profile_import_event_error", error.to_string()))
        },
    );
    match result {
        Ok(value) => {
            if let Err(error) = on_event.send(json!({ "type": "done", "data": value.clone() })) {
                log::warn!("profile import completed but final event delivery failed: {error}");
            }
            Ok(value)
        }
        Err(error) => {
            let payload = profile_import_error_event(&error);
            let _ = on_event.send(payload);
            Err(error)
        }
    }
}

fn profile_import_error_event(error: &AppError) -> Value {
    json!({
        "type": "error",
        "data": {
            "code": error.code.clone(),
            "message": error.message.clone(),
            "details": error.details.clone(),
        },
    })
}

#[tauri::command]
pub fn profile_import_preview_upload(
    state: State<'_, AppState>,
    filename: String,
    base64: String,
) -> Result<Value, AppError> {
    profile::preview_profile_upload(&state, &filename, &base64)
}

#[tauri::command]
pub fn profile_import_upload(
    state: State<'_, AppState>,
    filename: String,
    base64: String,
) -> Result<Value, AppError> {
    profile::import_profile_upload(&state, &filename, &base64)
}

#[tauri::command]
pub fn prompt_export(state: State<'_, AppState>, preset_id: String) -> Result<Value, AppError> {
    exports::export_prompt(&state, &preset_id)
}

#[tauri::command]
pub fn prompts_export_bulk(
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> Result<Value, AppError> {
    exports::export_records(&state, "marinara_presets", "prompts", json!({ "ids": ids }))
}

#[tauri::command]
pub fn character_export(
    state: State<'_, AppState>,
    id: String,
    format: Option<String>,
) -> Result<Value, AppError> {
    exports::export_record(
        &state,
        "marinara_character",
        "characters",
        &id,
        format.as_deref(),
    )
}

#[tauri::command]
pub fn character_export_png(state: State<'_, AppState>, id: String) -> Result<Value, AppError> {
    exports::export_character_png(&state, &id)
}

#[tauri::command]
pub fn character_embedded_lorebook_import(
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    exports::import_character_embedded_lorebook(&state, &id)
}

#[tauri::command]
pub fn characters_export_bulk(
    state: State<'_, AppState>,
    ids: Vec<String>,
    format: Option<String>,
) -> Result<Value, AppError> {
    exports::export_records(
        &state,
        "marinara_characters",
        "characters",
        json!({ "ids": ids, "format": format }),
    )
}

#[tauri::command]
pub fn persona_export(
    state: State<'_, AppState>,
    id: String,
    format: Option<String>,
) -> Result<Value, AppError> {
    exports::export_record(
        &state,
        "marinara_persona",
        "personas",
        &id,
        format.as_deref(),
    )
}

#[tauri::command]
pub fn personas_export_bulk(
    state: State<'_, AppState>,
    ids: Vec<String>,
    format: Option<String>,
) -> Result<Value, AppError> {
    exports::export_records(
        &state,
        "marinara_personas",
        "personas",
        json!({ "ids": ids, "format": format }),
    )
}

#[tauri::command]
pub fn lorebook_export(
    state: State<'_, AppState>,
    id: String,
    format: Option<String>,
) -> Result<Value, AppError> {
    exports::export_lorebook(&state, &id, format.as_deref())
}

#[tauri::command]
pub fn lorebooks_export_bulk(
    state: State<'_, AppState>,
    ids: Vec<String>,
    format: Option<String>,
) -> Result<Value, AppError> {
    exports::export_lorebooks(&state, json!({ "ids": ids, "format": format }))
}

#[tauri::command]
pub async fn lorebook_vectorize(
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    prompts::vectorize_lorebook(&state, &id, body).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage_commands::media_uploads::file_path_asset_url;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempRoot(PathBuf);

    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn temp_root(test_name: &str) -> TempRoot {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        TempRoot(std::env::temp_dir().join(format!("marinara-profile-command-{test_name}-{nonce}")))
    }

    #[cfg(unix)]
    fn symlink_file(source: &Path, target: &Path) -> bool {
        std::os::unix::fs::symlink(source, target).expect("file symlink should be created");
        true
    }

    #[cfg(windows)]
    fn symlink_file(source: &Path, target: &Path) -> bool {
        match std::os::windows::fs::symlink_file(source, target) {
            Ok(()) => true,
            Err(error)
                if error.kind() == std::io::ErrorKind::PermissionDenied
                    || error.raw_os_error() == Some(1314) =>
            {
                false
            }
            Err(error) => panic!("file symlink should be created: {error}"),
        }
    }

    #[cfg(not(any(unix, windows)))]
    fn symlink_file(_source: &Path, _target: &Path) -> bool {
        false
    }

    #[test]
    fn local_asset_binary_reads_managed_app_data_asset_urls() {
        let root = temp_root("local-asset");
        let state =
            AppState::from_data_dir(&root.0, Vec::new()).expect("test state should initialize");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let avatar_path = avatar_dir.join("Avatar One.png");
        std::fs::write(&avatar_path, b"avatar-bytes").expect("avatar should be written");

        let response = load_local_asset_binary(
            &state,
            &file_path_asset_url(&avatar_path),
            "application/octet-stream",
        )
        .expect("managed local asset should load")
        .expect("asset url should be handled locally");

        let base64 = response
            .get("base64")
            .and_then(Value::as_str)
            .expect("response should include base64");
        let bytes = general_purpose::STANDARD
            .decode(base64)
            .expect("base64 should decode");
        assert_eq!(bytes, b"avatar-bytes");
        assert_eq!(
            response.get("mimeType"),
            Some(&Value::String("image/png".into()))
        );
    }

    #[test]
    fn local_asset_binary_rejects_asset_urls_outside_app_data() {
        let root = temp_root("local-asset-state");
        let state =
            AppState::from_data_dir(&root.0, Vec::new()).expect("test state should initialize");
        let outside = temp_root("local-asset-outside");
        std::fs::create_dir_all(&outside.0).expect("outside dir should be created");
        let outside_path = outside.0.join("Outside.png");
        std::fs::write(&outside_path, b"outside").expect("outside asset should be written");

        let result = load_local_asset_binary(
            &state,
            &file_path_asset_url(&outside_path),
            "application/octet-stream",
        );

        assert!(result.is_err());
    }

    #[test]
    fn local_asset_binary_rejects_symlinked_asset_files() {
        let root = temp_root("local-asset-symlink");
        let state =
            AppState::from_data_dir(&root.0, Vec::new()).expect("test state should initialize");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let target_path = avatar_dir.join("Target.png");
        std::fs::write(&target_path, b"avatar-bytes").expect("target avatar should be written");
        let symlink_path = avatar_dir.join("Alias.png");
        if !symlink_file(&target_path, &symlink_path) {
            return;
        }

        let result = load_local_asset_binary(
            &state,
            &file_path_asset_url(&symlink_path),
            "application/octet-stream",
        );

        assert!(result.is_err());
    }

    #[test]
    fn local_asset_binary_rejects_non_media_files_inside_app_data() {
        let root = temp_root("local-asset-data");
        let state =
            AppState::from_data_dir(&root.0, Vec::new()).expect("test state should initialize");
        let collection_dir = state.data_dir.join("data").join("collections");
        std::fs::create_dir_all(&collection_dir).expect("collection dir should be created");
        let collection_path = collection_dir.join("characters.json");
        std::fs::write(&collection_path, b"[]").expect("collection should be written");

        let result = load_local_asset_binary(
            &state,
            &file_path_asset_url(&collection_path),
            "application/octet-stream",
        );

        assert!(result.is_err());
    }

    #[test]
    fn local_asset_binary_ignores_non_asset_urls() {
        let root = temp_root("remote-url");
        let state =
            AppState::from_data_dir(&root.0, Vec::new()).expect("test state should initialize");

        let response = load_local_asset_binary(
            &state,
            "https://example.com/avatar.png",
            "application/octet-stream",
        )
        .expect("non-local urls should not error");

        assert!(response.is_none());
    }
}
