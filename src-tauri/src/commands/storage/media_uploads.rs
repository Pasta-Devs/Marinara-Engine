use super::*;
use std::path::{Path, PathBuf};

pub(crate) struct StoredImageUpload {
    pub(crate) data_url: String,
    pub(crate) absolute_path: String,
    pub(crate) filename: String,
}

pub(crate) struct StoredManagedImage {
    pub(crate) asset_url: String,
    pub(crate) absolute_path: String,
    pub(crate) filename: String,
}

pub(crate) fn persist_image_upload(
    state: &AppState,
    folder: &str,
    id: &str,
    body: &Value,
    field_name: &str,
) -> AppResult<StoredImageUpload> {
    let image = body
        .get(field_name)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::invalid_input(format!("{field_name} is required")))?;
    let (mime, bytes) = decode_image_payload(image, field_name)?;
    let ext = extension_for_image_mime(&mime)
        .or_else(|| {
            body.get("filename")
                .and_then(Value::as_str)
                .and_then(extension_from_filename)
        })
        .unwrap_or("png");
    let filename = body
        .get("filename")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(safe_filename)
        .unwrap_or_else(|| format!("{}-{}.{}", safe_filename(id), now_millis(), ext));
    let dir = state.data_dir.join(folder);
    fs::create_dir_all(&dir)?;
    let target = unique_file_path(&dir.join(&filename))?;
    fs::write(&target, &bytes)?;
    Ok(StoredImageUpload {
        data_url: format!(
            "data:{mime};base64,{}",
            general_purpose::STANDARD.encode(bytes)
        ),
        absolute_path: target.to_string_lossy().to_string(),
        filename: target
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or(filename),
    })
}

pub(crate) fn persist_image_file_copy(
    state: &AppState,
    folder: &str,
    filename_hint: &str,
    source_path: &Path,
) -> AppResult<StoredManagedImage> {
    let ext = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .and_then(extension_from_filename)
        .unwrap_or("png");
    let dir = state.data_dir.join(folder);
    fs::create_dir_all(&dir)?;
    let filename = managed_image_filename(filename_hint, ext);
    let target = unique_file_path(&dir.join(filename))?;
    fs::copy(source_path, &target)?;
    stored_managed_image(target)
}

pub(crate) fn persist_image_bytes(
    state: &AppState,
    folder: &str,
    filename_hint: &str,
    bytes: &[u8],
    mime: &str,
) -> AppResult<StoredManagedImage> {
    let ext = extension_for_image_mime(mime).unwrap_or("png");
    let dir = state.data_dir.join(folder);
    fs::create_dir_all(&dir)?;
    let filename = managed_image_filename(filename_hint, ext);
    let target = unique_file_path(&dir.join(filename))?;
    fs::write(&target, bytes)?;
    stored_managed_image(target)
}

fn stored_managed_image(target: PathBuf) -> AppResult<StoredManagedImage> {
    let filename = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .ok_or_else(|| AppError::invalid_input("Managed image path is missing a filename"))?;
    Ok(StoredManagedImage {
        asset_url: file_path_asset_url(&target),
        absolute_path: target.to_string_lossy().to_string(),
        filename,
    })
}

fn managed_image_filename(filename_hint: &str, fallback_ext: &str) -> String {
    let filename = safe_filename(filename_hint);
    if Path::new(&filename).extension().is_some() {
        filename
    } else {
        format!("{filename}.{fallback_ext}")
    }
}

pub(crate) fn file_path_asset_url(path: &Path) -> String {
    let encoded = percent_encode_asset_path(&path.to_string_lossy());
    if cfg!(windows) {
        format!("http://asset.localhost/{encoded}")
    } else {
        format!("asset://localhost/{encoded}")
    }
}

fn percent_encode_asset_path(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.as_bytes() {
        match *byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')' => encoded.push(*byte as char),
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

pub(crate) fn remove_managed_record_file(
    state: &AppState,
    folder: &str,
    record: &Value,
    path_key: &str,
    filename_key: &str,
) {
    let Ok(Some(path)) = managed_record_file_path(state, folder, record, path_key, filename_key)
    else {
        return;
    };
    if path.exists() && path.is_file() {
        if let Err(error) = fs::remove_file(&path) {
            let record_id = record
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or("<unknown>");
            eprintln!(
                "warn: failed to remove managed file for {folder}/{record_id} at {}: {error}",
                path.display()
            );
        }
    }
}

pub(crate) fn managed_record_file_path(
    state: &AppState,
    folder: &str,
    record: &Value,
    path_key: &str,
    filename_key: &str,
) -> AppResult<Option<PathBuf>> {
    let managed_dir = state.data_dir.join(folder);
    if let Some(path) = record
        .get(path_key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        let raw_path = PathBuf::from(path);
        if let Some(candidate) = managed_file_candidate(raw_path.clone(), &managed_dir)? {
            return Ok(Some(candidate));
        }
        if raw_path.is_relative() {
            if let Some(candidate) =
                managed_file_candidate(managed_dir.join(safe_filename(path)), &managed_dir)?
            {
                return Ok(Some(candidate));
            }
        }
    }
    let Some(filename) = record
        .get(filename_key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    else {
        return Ok(None);
    };
    managed_file_candidate(managed_dir.join(safe_filename(filename)), &managed_dir)
}

fn managed_file_candidate(candidate: PathBuf, managed_dir: &Path) -> AppResult<Option<PathBuf>> {
    if !candidate.exists() {
        return Ok(None);
    }
    if !is_path_inside_dir(&candidate, managed_dir)? {
        return Ok(None);
    }
    Ok(Some(candidate))
}

fn is_path_inside_dir(path: &Path, dir: &Path) -> AppResult<bool> {
    let dir = match fs::canonicalize(dir) {
        Ok(dir) => dir,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(AppError::from(error)),
    };
    let path = match fs::canonicalize(path) {
        Ok(path) => path,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(AppError::from(error)),
    };
    Ok(path.starts_with(dir))
}

pub(crate) fn decode_image_payload(value: &str, field_name: &str) -> AppResult<(String, Vec<u8>)> {
    if let Some((header, payload)) = value.split_once(',') {
        if header.starts_with("data:") {
            let mime = header
                .trim_start_matches("data:")
                .split(';')
                .next()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("image/png")
                .to_string();
            let bytes = general_purpose::STANDARD.decode(payload).map_err(|error| {
                AppError::invalid_input(format!("Invalid {field_name} data: {error}"))
            })?;
            return Ok((mime, bytes));
        }
    }
    let bytes = general_purpose::STANDARD
        .decode(value)
        .map_err(|error| AppError::invalid_input(format!("Invalid {field_name} data: {error}")))?;
    Ok(("image/png".to_string(), bytes))
}

pub(crate) fn extension_for_image_mime(mime: &str) -> Option<&'static str> {
    match mime.to_ascii_lowercase().as_str() {
        "image/jpeg" | "image/jpg" => Some("jpg"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        "image/avif" => Some("avif"),
        "image/png" => Some("png"),
        "image/svg+xml" => Some("svg"),
        _ => None,
    }
}

pub(crate) fn extension_from_filename(filename: &str) -> Option<&'static str> {
    match Path::new(filename)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => Some("jpg"),
        "webp" => Some("webp"),
        "gif" => Some("gif"),
        "avif" => Some("avif"),
        "png" => Some("png"),
        "svg" => Some("svg"),
        _ => None,
    }
}

pub(crate) fn safe_filename(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    if sanitized.is_empty() {
        new_id()
    } else {
        sanitized
    }
}

pub(crate) fn unique_file_path(target: &Path) -> AppResult<PathBuf> {
    if !target.exists() {
        return Ok(target.to_path_buf());
    }
    let parent = target.parent().unwrap_or_else(|| Path::new(""));
    let stem = target
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(new_id);
    let ext = target
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .unwrap_or_default();
    for index in 1..10_000 {
        let candidate = parent.join(format!("{stem}-{index}{ext}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(AppError::invalid_input("Could not allocate image filename"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_path_asset_url_matches_tauri_encoding_on_windows() {
        let path = Path::new(r"C:\Users\Mari\My Avatar.png");

        let url = file_path_asset_url(path);

        if cfg!(windows) {
            assert_eq!(
                url,
                "http://asset.localhost/C%3A%5CUsers%5CMari%5CMy%20Avatar.png"
            );
        } else {
            assert_eq!(
                url,
                "asset://localhost/C%3A%5CUsers%5CMari%5CMy%20Avatar.png"
            );
        }
    }
}
