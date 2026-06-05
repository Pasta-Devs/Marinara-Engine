use super::*;
use std::path::{Path, PathBuf};

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
) -> AppResult<StoredManagedImage> {
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
    stored_managed_image(target)
}

pub(crate) fn persist_image_file_copy(
    state: &AppState,
    folder: &str,
    filename_hint: &str,
    source_path: &Path,
) -> AppResult<StoredManagedImage> {
    let bytes = fs::read(source_path)?;
    let ext = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .and_then(extension_from_filename)
        .unwrap_or("png");
    let mime = (ext == "svg").then_some("image/svg+xml");
    validate_image_bytes_for_mime(mime, &bytes)?;
    let dir = state.data_dir.join(folder);
    fs::create_dir_all(&dir)?;
    let filename = managed_image_filename(filename_hint, ext);
    let target = unique_file_path(&dir.join(filename))?;
    fs::write(&target, bytes)?;
    stored_managed_image(target)
}

pub(crate) fn persist_image_bytes(
    state: &AppState,
    folder: &str,
    filename_hint: &str,
    bytes: &[u8],
    mime: &str,
) -> AppResult<StoredManagedImage> {
    validate_image_bytes_for_mime(Some(mime), bytes)?;
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

pub(crate) fn is_inline_image_data_url(value: &str) -> bool {
    const DATA_IMAGE_PREFIX: &[u8] = b"data:image/";
    value
        .trim_start()
        .as_bytes()
        .get(..DATA_IMAGE_PREFIX.len())
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case(DATA_IMAGE_PREFIX))
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

pub(crate) fn remove_copied_file_path(path: Option<&str>, context: &str) {
    let Some(path) = path else {
        return;
    };
    if let Err(error) = fs::remove_file(path) {
        log::warn!("could not remove {context} at {path}: {error}");
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
        let header = header.trim_start();
        if header
            .get(..5)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("data:"))
        {
            let mime = header[5..]
                .split(';')
                .next()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("image/png")
                .to_string();
            let bytes = general_purpose::STANDARD.decode(payload).map_err(|error| {
                AppError::invalid_input(format!("Invalid {field_name} data: {error}"))
            })?;
            validate_image_bytes_for_mime(Some(&mime), &bytes)?;
            return Ok((mime, bytes));
        }
    }
    let bytes = general_purpose::STANDARD
        .decode(value)
        .map_err(|error| AppError::invalid_input(format!("Invalid {field_name} data: {error}")))?;
    validate_image_bytes_for_mime(Some("image/png"), &bytes)?;
    Ok(("image/png".to_string(), bytes))
}

pub(crate) fn validate_image_bytes_for_mime(mime: Option<&str>, bytes: &[u8]) -> AppResult<()> {
    if bytes.is_empty() {
        return Err(AppError::invalid_input("Invalid image data"));
    }
    if mime.is_some_and(|value| value.eq_ignore_ascii_case("image/svg+xml")) {
        if bytes_have_svg_root(bytes) {
            return Ok(());
        }
        return Err(AppError::invalid_input("Invalid image data"));
    }
    image::guess_format(bytes)
        .map(|_| ())
        .map_err(|_| AppError::invalid_input("Invalid image data"))
}

fn bytes_have_svg_root(bytes: &[u8]) -> bool {
    let Ok(text) = std::str::from_utf8(bytes) else {
        return false;
    };
    let mut rest = text.trim_start_matches('\u{feff}').trim_start();
    loop {
        if let Some(after) = rest.strip_prefix("<?") {
            let Some(end) = after.find("?>") else {
                return false;
            };
            rest = after[end + 2..].trim_start();
        } else if let Some(after) = rest.strip_prefix("<!--") {
            let Some(end) = after.find("-->") else {
                return false;
            };
            rest = after[end + 3..].trim_start();
        } else if rest.starts_with("<!") {
            let Some(end) = rest.find('>') else {
                return false;
            };
            rest = rest[end + 1..].trim_start();
        } else {
            break;
        }
    }
    let Some(after) = rest
        .get(..4)
        .filter(|head| head.eq_ignore_ascii_case("<svg"))
        .map(|_| &rest[4..])
    else {
        return false;
    };
    after.is_empty() || after.starts_with(['>', '/']) || after.starts_with(char::is_whitespace)
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
    use std::time::{SystemTime, UNIX_EPOCH};

    const TINY_PNG: &str =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

    fn temp_dir(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("marinara-media-upload-{label}-{nonce}"))
    }

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

    #[test]
    fn decode_image_payload_rejects_declared_image_with_non_image_bytes() {
        let result = decode_image_payload("data:image/png;base64,bm9wZQ==", "avatar");

        let Err(error) = result else {
            panic!("fake PNG payload should be rejected");
        };
        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("Invalid image data"));
    }

    #[test]
    fn decode_image_payload_accepts_valid_png_bytes() {
        let (mime, bytes) =
            decode_image_payload(&format!("data:image/png;base64,{TINY_PNG}"), "avatar")
                .expect("valid PNG payload should decode");

        assert_eq!(mime, "image/png");
        assert!(!bytes.is_empty());
    }

    #[test]
    fn decode_image_payload_accepts_case_variant_data_header() {
        let (mime, bytes) =
            decode_image_payload(&format!("DaTa:Image/PNG;BaSe64,{TINY_PNG}"), "avatar")
                .expect("case-variant data URL payload should decode");

        assert_eq!(mime, "Image/PNG");
        assert!(!bytes.is_empty());
        assert!(is_inline_image_data_url("DaTa:Image/PNG;BaSe64,abc"));
    }

    #[test]
    fn persist_image_file_copy_rejects_extension_with_non_image_bytes() {
        let root = temp_dir("file-copy-invalid");
        let state = AppState::from_data_dir(root.join("data"), Vec::new())
            .expect("test app state should initialize");
        let source = root.join("source.png");
        fs::create_dir_all(&root).expect("source root should be created");
        fs::write(&source, b"not an image").expect("source fixture should be written");

        let Err(error) = persist_image_file_copy(&state, "avatars/personas", "avatar.png", &source)
        else {
            panic!("fake image source should be rejected");
        };

        assert_eq!(error.code, "invalid_input");
        assert!(!state.data_dir.join("avatars").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn persist_image_file_copy_accepts_svg_source_extension() {
        let root = temp_dir("file-copy-svg");
        let state = AppState::from_data_dir(root.join("data"), Vec::new())
            .expect("test app state should initialize");
        let source = root.join("source.svg");
        fs::create_dir_all(&root).expect("source root should be created");
        fs::write(
            &source,
            br#"<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>"#,
        )
        .expect("source fixture should be written");

        let stored = persist_image_file_copy(&state, "avatars/personas", "avatar", &source)
            .expect("valid SVG source should be copied");

        assert_eq!(stored.filename, "avatar.svg");
        assert_eq!(
            fs::read_to_string(&stored.absolute_path).expect("stored SVG should be readable"),
            r#"<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>"#
        );

        let _ = fs::remove_dir_all(root);
    }
}
