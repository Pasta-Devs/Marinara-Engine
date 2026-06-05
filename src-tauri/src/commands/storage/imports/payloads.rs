use super::*;
use std::io::{Cursor, Read};

/// Decompressed-size cap for a .charx `card.json` entry (matches MAX_DATA_JSON_BYTES).
const MAX_CHARX_CARD_JSON_BYTES: usize = 5 * 1024 * 1024;
/// Decompressed-size cap for an embedded .charx image/icon asset.
const MAX_CHARX_ASSET_BYTES: usize = 50 * 1024 * 1024;

fn parse_chara_text(text: &str) -> Option<Value> {
    let trimmed = text.trim();
    parse_json_text(trimmed).ok().or_else(|| {
        general_purpose::STANDARD
            .decode(trimmed)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
    })
}

fn extract_chara_from_png(bytes: &[u8]) -> AppResult<Value> {
    const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
    if bytes.len() < 8 || &bytes[..8] != PNG_SIGNATURE {
        return Err(AppError::invalid_input("Not a PNG character card"));
    }

    let mut offset = 8usize;
    let mut chara: Option<Value> = None;
    let mut ccv3: Option<Value> = None;
    while offset + 12 <= bytes.len() {
        let length = u32::from_be_bytes(bytes[offset..offset + 4].try_into().unwrap()) as usize;
        let chunk_type = &bytes[offset + 4..offset + 8];
        let data_start = offset + 8;
        let data_end = data_start.saturating_add(length);
        if data_end + 4 > bytes.len() {
            break;
        }
        let payload = &bytes[data_start..data_end];
        if chunk_type == b"tEXt" {
            if let Some(null_index) = payload.iter().position(|byte| *byte == 0) {
                let keyword = String::from_utf8_lossy(&payload[..null_index]);
                if keyword == "chara" || keyword == "ccv3" {
                    let text = String::from_utf8_lossy(&payload[null_index + 1..]);
                    if let Some(parsed) = parse_chara_text(&text) {
                        if keyword == "ccv3" {
                            ccv3 = Some(parsed);
                        } else {
                            chara = Some(parsed);
                        }
                    }
                }
            }
        } else if chunk_type == b"iTXt" {
            if let Some(null_index) = payload.iter().position(|byte| *byte == 0) {
                let keyword = String::from_utf8_lossy(&payload[..null_index]);
                if (keyword == "chara" || keyword == "ccv3") && null_index + 3 < payload.len() {
                    let compression_flag = payload[null_index + 1];
                    if compression_flag == 0 {
                        let language_start = null_index + 3;
                        if let Some(language_end_rel) =
                            payload[language_start..].iter().position(|byte| *byte == 0)
                        {
                            let translated_start = language_start + language_end_rel + 1;
                            if let Some(translated_end_rel) = payload[translated_start..]
                                .iter()
                                .position(|byte| *byte == 0)
                            {
                                let text_start = translated_start + translated_end_rel + 1;
                                let text = String::from_utf8_lossy(&payload[text_start..]);
                                if let Some(parsed) = parse_chara_text(&text) {
                                    if keyword == "ccv3" {
                                        ccv3 = Some(parsed);
                                    } else {
                                        chara = Some(parsed);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        offset = data_end + 4;
        if chunk_type == b"IEND" {
            break;
        }
    }

    ccv3
        .or(chara)
        .ok_or_else(|| AppError::invalid_input("No character data found in PNG. Make sure this is a valid character card with embedded metadata."))
}

/// Read a single ZIP entry with a hard cap on its decompressed size. Rejects on the
/// declared uncompressed size before allocating, then streams with `take(limit + 1)`
/// so a high-compression-ratio (zip-bomb) entry can't exceed the cap even if the
/// header understates it. Mirrors copy_limited_profile_zip_asset_with_limit in
/// profile/assets.rs.
pub(super) fn read_zip_entry_with_limit(
    bytes: &[u8],
    name: &str,
    limit: usize,
) -> AppResult<Option<Vec<u8>>> {
    let cursor = Cursor::new(bytes);
    let mut zip_reader = zip::ZipArchive::new(cursor)
        .map_err(|error| AppError::invalid_input(format!("Could not read ZIP package: {error}")))?;
    let result = match zip_reader.by_name(name) {
        Ok(file) => {
            if file.size() > limit as u64 {
                return Err(zip_entry_too_large_error(name, file.size(), limit));
            }
            let mut contents = Vec::new();
            let mut limited = file.take((limit as u64).saturating_add(1));
            limited.read_to_end(&mut contents)?;
            if contents.len() > limit {
                return Err(zip_entry_too_large_error(name, contents.len() as u64, limit));
            }
            Ok(Some(contents))
        }
        Err(zip::result::ZipError::FileNotFound) => Ok(None),
        Err(error) => Err(AppError::invalid_input(format!(
            "Could not read zip entry {name}: {error}"
        ))),
    };
    result
}

fn zip_entry_too_large_error(name: &str, size: u64, limit: usize) -> AppError {
    AppError::invalid_input(format!(
        "ZIP entry {name} is too large ({size} bytes; limit is {limit} bytes)"
    ))
}

pub(super) fn read_zip_entry_names(bytes: &[u8]) -> AppResult<Vec<String>> {
    let cursor = Cursor::new(bytes);
    let mut zip_reader = zip::ZipArchive::new(cursor)
        .map_err(|error| AppError::invalid_input(format!("Could not read ZIP package: {error}")))?;
    let mut names = Vec::new();
    for index in 0..zip_reader.len() {
        let file = zip_reader.by_index(index).map_err(|error| {
            AppError::invalid_input(format!("Could not read zip entry: {error}"))
        })?;
        names.push(file.name().to_string());
    }
    Ok(names)
}

pub(super) fn zip_entry_name_case_insensitive(names: &[String], expected: &str) -> Option<String> {
    names
        .iter()
        .find(|name| name.eq_ignore_ascii_case(expected))
        .cloned()
}

pub(super) fn image_mime_from_path(path: &str) -> &'static str {
    match Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        _ => "image/png",
    }
}

fn resolve_charx_asset(bytes: &[u8], uri: &str, ext: Option<&str>) -> AppResult<Option<String>> {
    if is_inline_image_data_url(uri) {
        return Ok(Some(uri.to_string()));
    }
    let zip_path = if let Some(path) = uri.strip_prefix("embeded://") {
        Some(path)
    } else if let Some(path) = uri.strip_prefix("embedded://") {
        Some(path)
    } else if !uri.contains("://") && uri != "ccdefault:" {
        Some(uri)
    } else {
        None
    };
    let Some(zip_path) = zip_path else {
        return Ok(None);
    };
    let Some(asset) = read_zip_entry_with_limit(bytes, zip_path, MAX_CHARX_ASSET_BYTES)? else {
        return Ok(None);
    };
    let mime = ext
        .map(
            |value| match value.trim_start_matches('.').to_ascii_lowercase().as_str() {
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "gif" => "image/gif",
                "avif" => "image/avif",
                _ => "image/png",
            },
        )
        .unwrap_or_else(|| image_mime_from_path(zip_path));
    Ok(Some(format!(
        "data:{mime};base64,{}",
        general_purpose::STANDARD.encode(asset)
    )))
}

fn extract_charx(bytes: &[u8]) -> AppResult<Value> {
    let Some(card_bytes) = read_zip_entry_with_limit(bytes, "card.json", MAX_CHARX_CARD_JSON_BYTES)?
    else {
        return Err(AppError::invalid_input(
            "Invalid .charx file: missing card.json at root.",
        ));
    };
    let mut card = parse_object(&card_bytes)?;
    let card_data = card
        .get("data")
        .filter(|value| value.is_object())
        .unwrap_or(&card);
    let mut avatar: Option<String> = None;
    if let Some(assets) = card_data.get("assets").and_then(Value::as_array) {
        let selected = assets
            .iter()
            .find(|asset| {
                asset.get("type").and_then(Value::as_str) == Some("icon")
                    && asset.get("name").and_then(Value::as_str) == Some("main")
            })
            .or_else(|| {
                assets
                    .iter()
                    .find(|asset| asset.get("type").and_then(Value::as_str) == Some("icon"))
            });
        if let Some(asset) = selected {
            if let Some(uri) = asset.get("uri").and_then(Value::as_str) {
                avatar = resolve_charx_asset(bytes, uri, asset.get("ext").and_then(Value::as_str))?;
            }
        }
    }
    if avatar.is_none() {
        for fallback in [
            "assets/icon/images/main.png",
            "assets/icon/images/main.webp",
            "assets/icon/images/main.jpg",
        ] {
            if let Some(asset) = read_zip_entry_with_limit(bytes, fallback, MAX_CHARX_ASSET_BYTES)? {
                let mime = image_mime_from_path(fallback);
                avatar = Some(format!(
                    "data:{mime};base64,{}",
                    general_purpose::STANDARD.encode(asset)
                ));
                break;
            }
        }
    }
    if let Some(avatar) = avatar {
        let object = card
            .as_object_mut()
            .ok_or_else(|| AppError::invalid_input("card.json must contain an object"))?;
        object.insert("_avatarDataUrl".to_string(), Value::String(avatar));
    }
    Ok(card)
}

fn has_object_entries(value: &Value, key: &str) -> bool {
    matches!(
        value.get(key),
        Some(Value::Array(_)) | Some(Value::Object(_))
    )
}

fn has_character_specific_fields(value: &Value) -> bool {
    [
        "personality",
        "scenario",
        "first_mes",
        "mes_example",
        "char_persona",
        "char_greeting",
        "example_dialogue",
        "system_prompt",
        "post_history_instructions",
        "alternate_greetings",
        "character_book",
    ]
    .iter()
    .any(|key| value.get(*key).is_some())
}

fn is_explicit_character_payload(payload: &Value) -> bool {
    matches!(
        payload.get("spec").and_then(Value::as_str),
        Some("chara_card_v2" | "chara_card_v3")
    ) || payload.get("type").and_then(Value::as_str) == Some("character")
}

fn looks_like_top_level_lorebook(payload: &Value) -> bool {
    has_object_entries(payload, "entries")
        && !is_explicit_character_payload(payload)
        && !has_character_specific_fields(payload)
        && !payload
            .get("data")
            .is_some_and(has_character_specific_fields)
}

fn validate_character_json_payload(payload: Value) -> AppResult<Value> {
    if looks_like_top_level_lorebook(&payload) {
        return Err(AppError::invalid_input(
            "Invalid file format. Expected a JSON character card, PNG with embedded character data, or .charx file.",
        ));
    }
    Ok(payload)
}

pub(super) fn parse_character_file(filename: &str, bytes: &[u8]) -> AppResult<Value> {
    let lower = filename.to_ascii_lowercase();
    if lower.ends_with(".png") {
        let mut payload = extract_chara_from_png(bytes)?;
        let object = payload.as_object_mut().ok_or_else(|| {
            AppError::invalid_input("Embedded character data must be a JSON object")
        })?;
        object.insert(
            "_avatarDataUrl".to_string(),
            Value::String(format!(
                "data:image/png;base64,{}",
                general_purpose::STANDARD.encode(bytes)
            )),
        );
        return Ok(payload);
    }
    if lower.ends_with(".charx") {
        return extract_charx(bytes);
    }
    parse_object(bytes)
        .map_err(|_| {
            AppError::invalid_input("Invalid file format. Expected a JSON character card, PNG with embedded character data, or .charx file.")
        })
        .and_then(validate_character_json_payload)
}

pub(super) fn parse_character_file_from_path(
    filename: &str,
    _source_path: &Path,
    bytes: &[u8],
) -> AppResult<Value> {
    if filename.to_ascii_lowercase().ends_with(".png") {
        let payload = extract_chara_from_png(bytes)?;
        payload.as_object().ok_or_else(|| {
            AppError::invalid_input("Embedded character data must be a JSON object")
        })?;
        return Ok(payload);
    }
    parse_character_file(filename, bytes)
}

pub(super) fn import_payload(body: Value) -> AppResult<Value> {
    if body.get("file").is_some() {
        let (_name, _content_type, bytes) = decode_uploaded_file(&body)?;
        let mut payload = parse_object(&bytes)?;
        if let Some(fields) = body.get("fields").and_then(Value::as_object) {
            if let Some(object) = payload.as_object_mut() {
                for (key, value) in fields {
                    object.insert(key.clone(), value.clone());
                }
            }
        }
        return Ok(payload);
    }
    Ok(body)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;
    use zip::CompressionMethod;

    fn zip_with(name: &str, data: &[u8], method: CompressionMethod) -> Vec<u8> {
        let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
        writer
            .start_file(name, SimpleFileOptions::default().compression_method(method))
            .expect("start zip entry");
        writer.write_all(data).expect("write zip entry");
        writer.finish().expect("finish zip").into_inner()
    }

    #[test]
    fn read_zip_entry_with_limit_rejects_oversized_entry() {
        // 4 KiB of zeroes compresses to almost nothing but decompresses past the cap.
        let zip = zip_with("big.bin", &vec![0u8; 4096], CompressionMethod::Deflated);
        let error = read_zip_entry_with_limit(&zip, "big.bin", 1024)
            .expect_err("oversized entry must be rejected");
        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("too large"));
    }

    #[test]
    fn read_zip_entry_with_limit_accepts_within_limit() {
        let zip = zip_with("note.txt", b"hello world", CompressionMethod::Stored);
        let result = read_zip_entry_with_limit(&zip, "note.txt", 1024).expect("within-limit read");
        assert_eq!(result.as_deref(), Some(&b"hello world"[..]));
    }

    #[test]
    fn read_zip_entry_reads_full_entry_without_a_cap() {
        let zip = zip_with("data.json", b"{\"ok\":true}", CompressionMethod::Deflated);
        let result = read_zip_entry_with_limit(&zip, "data.json", usize::MAX).expect("uncapped read");
        assert_eq!(result.as_deref(), Some(&b"{\"ok\":true}"[..]));
    }

    #[test]
    fn read_zip_entry_with_limit_returns_none_for_missing_entry() {
        let zip = zip_with("present.txt", b"x", CompressionMethod::Stored);
        let result = read_zip_entry_with_limit(&zip, "absent.txt", 1024).expect("missing read");
        assert!(result.is_none());
    }
}
