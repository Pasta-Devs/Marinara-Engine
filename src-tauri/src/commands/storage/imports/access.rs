use super::*;
use std::path::Path;
use std::sync::{LazyLock, Mutex};

const FOLDER_TOKEN_TTL_MS: u128 = 15 * 60 * 1000;

#[derive(Clone)]
struct FolderTokenEntry {
    path: PathBuf,
    expires_at: u128,
}

static FOLDER_TOKENS: LazyLock<Mutex<HashMap<String, FolderTokenEntry>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub(super) fn parse_object(raw: &[u8]) -> AppResult<Value> {
    Ok(serde_json::from_slice(raw)?)
}

pub(super) fn parse_json_text(raw: &str) -> AppResult<Value> {
    Ok(serde_json::from_str(raw)?)
}

pub(super) fn file_stem(path: &Path) -> String {
    path.file_stem()
        .map(|name| name.to_string_lossy().to_string())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "Imported".to_string())
}

pub(super) fn modified_at(path: &Path) -> Value {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| Value::String(format!("{}", duration.as_millis())))
        .unwrap_or(Value::Null)
}

pub(super) fn home_dir() -> PathBuf {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn canonical_directory(path: &Path) -> AppResult<PathBuf> {
    let resolved = if path.as_os_str().is_empty() {
        home_dir()
    } else {
        path.to_path_buf()
    };
    let canonical = resolved.canonicalize().map_err(AppError::from)?;
    if canonical.is_dir() {
        Ok(canonical)
    } else {
        Err(AppError::invalid_input("Not a directory"))
    }
}

fn canonical_allowed_roots() -> Vec<PathBuf> {
    std::env::var("IMPORT_ALLOWED_ROOTS")
        .ok()
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|path| !path.is_empty())
                .filter_map(|path| {
                    let candidate = PathBuf::from(path);
                    let resolved = if candidate.is_absolute() {
                        candidate
                    } else {
                        std::env::current_dir().ok()?.join(candidate)
                    };
                    resolved.canonicalize().ok()
                })
                .filter(|path| path.is_dir())
                .collect()
        })
        .unwrap_or_default()
}

fn is_inside_dir(path: &Path, root: &Path) -> bool {
    let Ok(canonical_path) = path.canonicalize() else {
        return false;
    };
    let Ok(canonical_root) = root.canonicalize() else {
        return false;
    };
    canonical_path.starts_with(canonical_root)
}

fn is_home_contained(path: &Path) -> bool {
    is_inside_dir(path, &home_dir())
}

fn is_allowed_import_root(path: &Path) -> bool {
    canonical_allowed_roots()
        .iter()
        .any(|root| is_inside_dir(path, root))
}

fn has_configured_import_roots() -> bool {
    !canonical_allowed_roots().is_empty()
}

fn cleanup_folder_tokens(tokens: &mut HashMap<String, FolderTokenEntry>) {
    let now = now_millis();
    tokens.retain(|_, entry| entry.expires_at >= now);
}

fn issue_folder_token(path: &Path) -> AppResult<String> {
    let canonical = canonical_directory(path)?;
    let token = new_id();
    let mut tokens = FOLDER_TOKENS.lock().map_err(|_| {
        AppError::new(
            "folder_token_lock_error",
            "Could not access import folder token state",
        )
    })?;
    cleanup_folder_tokens(&mut tokens);
    tokens.insert(
        token.clone(),
        FolderTokenEntry {
            path: canonical,
            expires_at: now_millis() + FOLDER_TOKEN_TTL_MS,
        },
    );
    Ok(token)
}

pub(super) fn resolve_import_folder(body: &Value) -> AppResult<PathBuf> {
    let raw_path = body
        .get("folderPath")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("");
    let folder_token = body
        .get("folderToken")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("");

    if !folder_token.is_empty() {
        let mut tokens = FOLDER_TOKENS.lock().map_err(|_| {
            AppError::new(
                "folder_token_lock_error",
                "Could not access import folder token state",
            )
        })?;
        cleanup_folder_tokens(&mut tokens);
        let Some(entry) = tokens.get(folder_token).cloned() else {
            return Err(AppError::invalid_input(
                "Folder token is missing or expired",
            ));
        };
        if !raw_path.is_empty() {
            let provided = canonical_directory(Path::new(raw_path))?;
            if provided != entry.path {
                return Err(AppError::invalid_input(
                    "Folder token does not match folderPath",
                ));
            }
        }
        if has_configured_import_roots() && !is_allowed_import_root(&entry.path) {
            return Err(AppError::invalid_input(
                "folderPath is not allowed. Use the folder picker/browser or set IMPORT_ALLOWED_ROOTS.",
            ));
        }
        return Ok(entry.path);
    }

    if raw_path.is_empty() {
        return Err(AppError::invalid_input(
            "folderPath or folderToken is required",
        ));
    }
    let resolved = canonical_directory(Path::new(raw_path))?;
    if !is_allowed_import_root(&resolved) {
        return Err(AppError::invalid_input(
            "folderPath is not allowed. Use the folder picker/browser or set IMPORT_ALLOWED_ROOTS.",
        ));
    }
    Ok(resolved)
}

pub(super) fn directory_listing(path: PathBuf, _picker_selected: bool) -> AppResult<Value> {
    let path = canonical_directory(&path)?;
    if !is_home_contained(&path) && !is_allowed_import_root(&path) {
        return Ok(json!({
            "success": false,
            "error": "Access denied: path outside home directory"
        }));
    }
    if !path.is_dir() {
        return Ok(json!({ "success": false, "error": "Not a directory" }));
    }
    let folder_token = issue_folder_token(&path)?;
    let mut folders: Vec<String> = fs::read_dir(&path)
        .map(|rows| {
            rows.filter_map(Result::ok)
                .filter(|entry| entry.path().is_dir())
                .filter_map(|entry| entry.file_name().to_str().map(ToOwned::to_owned))
                .filter(|name| !name.starts_with('.'))
                .collect()
        })
        .unwrap_or_default();
    folders.sort_by_key(|name| name.to_ascii_lowercase());
    Ok(json!({
        "success": true,
        "path": path.to_string_lossy(),
        "folderToken": folder_token,
        "folders": folders
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn directory_listing_does_not_treat_picker_selected_as_unrestricted_access() {
        let path = std::env::current_dir().expect("current dir should be available");
        if is_home_contained(&path) || is_allowed_import_root(&path) {
            return;
        }

        let result = directory_listing(path, true).expect("directory listing should return JSON");

        assert_eq!(result["success"], false);
        assert_eq!(
            result["error"],
            "Access denied: path outside home directory"
        );
        assert!(result.get("folderToken").is_none());
    }
}
