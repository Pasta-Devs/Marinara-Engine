use super::media_uploads::{
    decode_image_payload, managed_record_file_path, persist_image_upload,
    remove_managed_record_file, safe_filename,
};
use super::*;
use image::ImageFormat;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

const AVATAR_THUMBNAIL_SIZES: &[u32] = &[64, 96, 128, 256];
const MAX_INLINE_AVATAR_THUMBNAIL_BYTES: usize = 20 * 1024 * 1024;

pub(crate) fn update_character_avatar(
    state: &AppState,
    collection: &str,
    id: &str,
    body: Value,
) -> AppResult<Value> {
    let previous = shared::get_required(state, collection, id)?;
    let stored = persist_image_upload(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        id,
        &body,
        "avatar",
    )?;
    if collection == "characters" {
        let snapshot_record = character_avatar_snapshot_record(state, collection, &previous);
        super::characters::create_character_version_snapshot_from_record(
            state,
            id,
            &snapshot_record,
            "manual",
            "Avatar update",
        )?;
    }
    let updated = state.storage.patch(
        collection,
        id,
        json!({
            "avatar": stored.data_url,
            "avatarPath": stored.data_url,
            "avatarFilePath": stored.absolute_path,
            "avatarFilename": stored.filename,
            "avatarUpdatedAt": now_iso()
        }),
    )?;
    remove_avatar_file(state, collection, &previous);
    Ok(updated)
}

pub(crate) fn remove_character_avatar(state: &AppState, id: &str) -> AppResult<Value> {
    let previous = shared::get_required(state, "characters", id)?;
    let patch = character_avatar_remove_patch(&previous)?;
    if patch.is_empty() {
        return Ok(previous);
    }

    let snapshot_record = character_avatar_snapshot_record(state, "characters", &previous);
    super::characters::create_character_version_snapshot_from_record(
        state,
        id,
        &snapshot_record,
        "manual",
        "Avatar removal",
    )?;
    let updated = state
        .storage
        .patch("characters", id, Value::Object(patch))?;
    remove_avatar_file(state, "characters", &previous);
    Ok(updated)
}

fn character_avatar_remove_patch(record: &Value) -> AppResult<Map<String, Value>> {
    let mut patch = Map::new();
    for field in [
        "avatar",
        "avatarPath",
        "avatarFilePath",
        "avatarFilename",
        "avatarUpdatedAt",
    ] {
        if record.get(field).is_some_and(|value| !value.is_null()) {
            patch.insert(field.to_string(), Value::Null);
        }
    }
    if let Some(data) = character_data_without_avatar_crop(record)? {
        patch.insert("data".to_string(), data);
    }
    Ok(patch)
}

fn character_data_without_avatar_crop(record: &Value) -> AppResult<Option<Value>> {
    let Some(data) = record.get("data") else {
        return Ok(None);
    };
    let mut data = shared::normalize_character_data_for_storage(data)?;
    let Some(data_object) = data.as_object_mut() else {
        unreachable!("character data normalizer only returns objects");
    };
    let Some(extensions) = data_object
        .get_mut("extensions")
        .and_then(Value::as_object_mut)
    else {
        return Ok(None);
    };
    if extensions.remove("avatarCrop").is_some() {
        Ok(Some(data))
    } else {
        Ok(None)
    }
}

fn character_avatar_snapshot_record(state: &AppState, collection: &str, record: &Value) -> Value {
    let mut snapshot = record.clone();
    if let Some(object) = snapshot.as_object_mut() {
        if let Some(data_url) = managed_avatar_data_url(state, collection, record) {
            object.insert("avatar".to_string(), Value::String(data_url.clone()));
            object.insert("avatarPath".to_string(), Value::String(data_url));
        }
        object.insert("avatarFilePath".to_string(), Value::Null);
        object.insert("avatarFilename".to_string(), Value::Null);
    }
    snapshot
}

fn managed_avatar_data_url(state: &AppState, collection: &str, record: &Value) -> Option<String> {
    let path = managed_record_file_path(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        record,
        "avatarFilePath",
        "avatarFilename",
    )
    .ok()
    .flatten()?;
    let bytes = fs::read(&path).ok()?;
    let mime = avatar_mime_type(
        record
            .get("avatarFilename")
            .and_then(Value::as_str)
            .or_else(|| path.file_name().and_then(|value| value.to_str())),
    );
    Some(format!(
        "data:{mime};base64,{}",
        general_purpose::STANDARD.encode(bytes)
    ))
}

fn avatar_mime_type(filename: Option<&str>) -> &'static str {
    let Some(filename) = filename else {
        return "image/png";
    };
    match filename
        .rsplit_once('.')
        .map(|(_, ext)| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("avif") => "image/avif",
        Some("svg") => "image/svg+xml",
        _ => "image/png",
    }
}

pub(crate) fn remove_avatar_file(state: &AppState, collection: &str, record: &Value) {
    remove_avatar_thumbnail_files(state, collection, record);
    remove_managed_record_file(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        record,
        "avatarFilePath",
        "avatarFilename",
    )
}

fn remove_avatar_thumbnail_files(state: &AppState, collection: &str, record: &Value) {
    let Ok(Some(path)) = managed_record_file_path(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        record,
        "avatarFilePath",
        "avatarFilename",
    ) else {
        return;
    };
    let Ok(source) = fs::canonicalize(path) else {
        return;
    };
    let Ok(avatars_root) = canonical_avatar_root(state) else {
        return;
    };
    let Ok(relative) = source.strip_prefix(avatars_root) else {
        return;
    };
    for size in AVATAR_THUMBNAIL_SIZES {
        for target in avatar_thumbnail_removal_targets(state, *size, relative) {
            if target.is_file() {
                let _ = fs::remove_file(target);
            }
        }
    }
}

pub(crate) fn avatar_thumbnail_file_path(
    state: &AppState,
    filename: Option<&str>,
    absolute_path: Option<&str>,
    source_url: Option<&str>,
    size: Option<u32>,
) -> AppResult<Value> {
    let thumbnail = if filename.is_some_and(|value| !value.trim().is_empty())
        || absolute_path.is_some_and(|value| !value.trim().is_empty())
    {
        let source = avatar_source_path(state, filename, absolute_path)?;
        avatar_thumbnail_path_for_source(state, &source, size.unwrap_or(128))?
    } else if let Some(source_url) = source_url.filter(|value| !value.trim().is_empty()) {
        avatar_thumbnail_path_for_inline_source(state, source_url, size.unwrap_or(128))?
    } else {
        return Err(AppError::invalid_input(
            "Avatar filename or path is required",
        ));
    };
    Ok(json!({ "path": thumbnail.to_string_lossy() }))
}

pub(crate) fn avatar_thumbnail_path_for_source(
    state: &AppState,
    source: &Path,
    size: u32,
) -> AppResult<PathBuf> {
    if !AVATAR_THUMBNAIL_SIZES.contains(&size) {
        return Err(AppError::invalid_input("Unsupported avatar thumbnail size"));
    }
    let source = fs::canonicalize(source).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => AppError::not_found("Avatar asset was not found"),
        _ => AppError::from(error),
    })?;
    let avatars_root = canonical_avatar_root(state)?;
    if !source.starts_with(&avatars_root) {
        return Err(AppError::invalid_input(
            "Avatar thumbnail source is outside managed avatars",
        ));
    }
    if !is_resizable_avatar_file(&source) {
        return Ok(source);
    }

    let relative = source.strip_prefix(&avatars_root).map_err(|_| {
        AppError::invalid_input("Avatar thumbnail source is outside managed avatars")
    })?;
    let target = avatar_thumbnail_target_path(state, size, relative);

    if avatar_thumbnail_is_fresh(&source, &target)? {
        return Ok(target);
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    write_avatar_thumbnail(&source, &target, size)?;
    Ok(target)
}

fn avatar_thumbnail_target_path(state: &AppState, size: u32, relative: &Path) -> PathBuf {
    let mut target = state
        .data_dir
        .join(".avatar-thumbnails")
        .join(size.to_string())
        .join(relative);
    let filename = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "avatar".to_string());
    target.set_file_name(format!("{filename}.thumb.png"));
    target
}

fn legacy_avatar_thumbnail_target_path(state: &AppState, size: u32, relative: &Path) -> PathBuf {
    let mut target = state
        .data_dir
        .join(".avatar-thumbnails")
        .join(size.to_string())
        .join(relative);
    target.set_extension("png");
    target
}

fn avatar_thumbnail_removal_targets(state: &AppState, size: u32, relative: &Path) -> [PathBuf; 2] {
    [
        avatar_thumbnail_target_path(state, size, relative),
        legacy_avatar_thumbnail_target_path(state, size, relative),
    ]
}

fn write_avatar_thumbnail(source: &Path, target: &Path, size: u32) -> AppResult<()> {
    let image = image::open(source).map_err(|error| {
        AppError::invalid_input(format!("Avatar thumbnail could not be decoded: {error}"))
    })?;
    write_avatar_thumbnail_image(image, target, size)
}

fn write_avatar_thumbnail_image(
    image: image::DynamicImage,
    target: &Path,
    size: u32,
) -> AppResult<()> {
    let temp = avatar_thumbnail_temp_path(target);
    image
        .thumbnail(size, size)
        .save_with_format(&temp, ImageFormat::Png)
        .map_err(|error| {
            let _ = fs::remove_file(&temp);
            AppError::new("avatar_thumbnail_error", error.to_string())
        })?;
    replace_avatar_thumbnail_file(&temp, target).map_err(|error| {
        let _ = fs::remove_file(&temp);
        AppError::from(error)
    })
}

fn avatar_thumbnail_temp_path(target: &Path) -> PathBuf {
    let filename = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "avatar.thumb.png".to_string());
    target.with_file_name(format!(".{filename}.{}.tmp", new_id()))
}

fn replace_avatar_thumbnail_file(temp: &Path, target: &Path) -> std::io::Result<()> {
    match fs::rename(temp, target) {
        Ok(()) => Ok(()),
        Err(_) if target.exists() => {
            let _ = fs::remove_file(target);
            fs::rename(temp, target)
        }
        Err(error) => Err(error),
    }
}

fn avatar_thumbnail_path_for_inline_source(
    state: &AppState,
    source_url: &str,
    size: u32,
) -> AppResult<PathBuf> {
    if !AVATAR_THUMBNAIL_SIZES.contains(&size) {
        return Err(AppError::invalid_input("Unsupported avatar thumbnail size"));
    }
    let source_url = inline_avatar_data_url(source_url).ok_or_else(|| {
        AppError::invalid_input("Avatar thumbnail source must be inline image data")
    })?;
    let (mime, bytes) = decode_image_payload(source_url, "avatarPath")?;
    if !is_resizable_avatar_mime(&mime) {
        return Err(AppError::invalid_input(
            "Avatar thumbnail source uses an unsupported image type",
        ));
    }
    if bytes.len() > MAX_INLINE_AVATAR_THUMBNAIL_BYTES {
        return Err(AppError::invalid_input(
            "Avatar thumbnail source is too large",
        ));
    }

    let hash = inline_avatar_thumbnail_hash(source_url);
    let target = state
        .data_dir
        .join(".avatar-thumbnails")
        .join(size.to_string())
        .join("inline")
        .join(format!("{hash}.thumb.png"));
    if target.is_file() {
        return Ok(target);
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let image = image::load_from_memory(&bytes).map_err(|error| {
        AppError::invalid_input(format!("Avatar thumbnail could not be decoded: {error}"))
    })?;
    write_avatar_thumbnail_image(image, &target, size)?;
    Ok(target)
}

fn inline_avatar_data_url(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if trimmed.to_ascii_lowercase().starts_with("data:image/") {
        return Some(trimmed);
    }
    let (_, rest) = trimmed.split_once("://")?;
    if rest.to_ascii_lowercase().starts_with("data:image/") {
        return Some(rest);
    }
    None
}

fn inline_avatar_thumbnail_hash(source_url: &str) -> String {
    let digest = Sha256::digest(source_url.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn avatar_source_path(
    state: &AppState,
    filename: Option<&str>,
    absolute_path: Option<&str>,
) -> AppResult<PathBuf> {
    if let Some(path) = absolute_path.filter(|value| !value.trim().is_empty()) {
        return avatar_source_candidate(state, PathBuf::from(path));
    }
    let filename = filename
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::invalid_input("Avatar filename or path is required"))?;
    avatar_source_candidate(
        state,
        state
            .data_dir
            .join("avatars")
            .join("characters")
            .join(safe_filename(filename)),
    )
}

fn avatar_source_candidate(state: &AppState, candidate: PathBuf) -> AppResult<PathBuf> {
    let source = fs::canonicalize(candidate).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => AppError::not_found("Avatar asset was not found"),
        _ => AppError::from(error),
    })?;
    let avatars_root = canonical_avatar_root(state)?;
    if !source.starts_with(avatars_root) {
        return Err(AppError::invalid_input(
            "Avatar asset path is outside managed avatars",
        ));
    }
    Ok(source)
}

fn canonical_avatar_root(state: &AppState) -> AppResult<PathBuf> {
    let root = state.data_dir.join("avatars");
    fs::create_dir_all(&root)?;
    fs::canonicalize(root).map_err(AppError::from)
}

fn is_resizable_avatar_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif"
    )
}

fn is_resizable_avatar_mime(mime: &str) -> bool {
    matches!(
        mime.to_ascii_lowercase().as_str(),
        "image/png" | "image/jpeg" | "image/jpg" | "image/webp" | "image/gif"
    )
}

fn avatar_thumbnail_is_fresh(source: &Path, target: &Path) -> AppResult<bool> {
    let source_modified = fs::metadata(source)?.modified()?;
    let Ok(target_modified) = fs::metadata(target).and_then(|metadata| metadata.modified()) else {
        return Ok(false);
    };
    Ok(target_modified >= source_modified)
}

pub(crate) fn update_npc_avatar(state: &AppState, chat_id: &str, body: Value) -> AppResult<Value> {
    let name = body
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("npc")
        .to_string();
    let stored = persist_image_upload(
        state,
        "avatars/npc",
        &format!("{chat_id}-{name}"),
        &body,
        "avatar",
    )?;
    Ok(json!({
        "chatId": chat_id,
        "name": name,
        "avatarPath": stored.data_url,
        "avatarFilePath": stored.absolute_path,
        "avatarFilename": stored.filename
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-avatars-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    #[test]
    fn character_avatar_update_snapshot_does_not_restore_deleted_file_metadata() {
        let state = test_state("character-avatar-version");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let old_avatar_path = avatar_dir.join("old.png");
        std::fs::write(&old_avatar_path, b"old").expect("old avatar should be written");
        let old_avatar_path = old_avatar_path.to_string_lossy().to_string();

        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": {
                        "name": "Rina",
                        "description": "Original",
                        "character_version": "1.0"
                    },
                    "comment": "Original title",
                    "avatar": "http://asset.localhost/old.png",
                    "avatarPath": "http://asset.localhost/old.png",
                    "avatarFilePath": old_avatar_path,
                    "avatarFilename": "old.png"
                }),
            )
            .expect("character should be created");

        update_character_avatar(
            &state,
            "characters",
            "char-1",
            json!({ "avatar": "data:image/png;base64,bmV3" }),
        )
        .expect("avatar should update");

        let versions = state
            .storage
            .list("character-versions")
            .expect("versions should list");
        assert_eq!(versions.len(), 1);
        assert_eq!(versions[0]["avatarPath"], "data:image/png;base64,b2xk");
        assert_eq!(versions[0]["avatarFilePath"], Value::Null);
        assert_eq!(versions[0]["avatarFilename"], Value::Null);

        let version_id = versions[0]
            .get("id")
            .and_then(Value::as_str)
            .expect("version should have id");
        let restored =
            super::super::characters::restore_character_version(&state, "char-1", version_id)
                .expect("version should restore");

        assert_eq!(restored["avatarPath"], "data:image/png;base64,b2xk");
        assert_eq!(restored["avatarFilePath"], Value::Null);
        assert_eq!(restored["avatarFilename"], Value::Null);
    }

    #[test]
    fn avatar_thumbnail_file_path_creates_managed_cache_without_overwriting_source() {
        let state = test_state("thumbnail");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let avatar_path = avatar_dir.join("large.png");
        let image = image::RgbaImage::from_pixel(320, 240, image::Rgba([255, 0, 0, 255]));
        image
            .save(&avatar_path)
            .expect("avatar fixture should write");

        let response = avatar_thumbnail_file_path(
            &state,
            Some("large.png"),
            Some(&avatar_path.to_string_lossy()),
            None,
            Some(128),
        )
        .expect("thumbnail should be generated");
        let thumbnail = PathBuf::from(response["path"].as_str().expect("path should be returned"));

        assert!(thumbnail.starts_with(state.data_dir.join(".avatar-thumbnails/128/characters")));
        assert!(thumbnail.is_file());
        assert_eq!(
            image::image_dimensions(&thumbnail).expect("thumbnail should decode"),
            (128, 96)
        );
        assert_eq!(
            image::image_dimensions(&avatar_path).expect("source should decode"),
            (320, 240)
        );
    }

    #[test]
    fn avatar_thumbnail_file_path_keeps_source_extension_in_cache_key() {
        let state = test_state("thumbnail-extension-key");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let png_path = avatar_dir.join("same-name.png");
        let jpg_path = avatar_dir.join("same-name.jpg");
        image::RgbImage::from_pixel(320, 240, image::Rgb([255, 0, 0]))
            .save(&png_path)
            .expect("png fixture should write");
        image::RgbImage::from_pixel(240, 320, image::Rgb([0, 0, 255]))
            .save(&jpg_path)
            .expect("jpg fixture should write");

        let png_response = avatar_thumbnail_file_path(
            &state,
            Some("same-name.png"),
            Some(&png_path.to_string_lossy()),
            None,
            Some(128),
        )
        .expect("png thumbnail should be generated");
        let jpg_response = avatar_thumbnail_file_path(
            &state,
            Some("same-name.jpg"),
            Some(&jpg_path.to_string_lossy()),
            None,
            Some(128),
        )
        .expect("jpg thumbnail should be generated");
        let png_thumbnail = PathBuf::from(
            png_response["path"]
                .as_str()
                .expect("png path should be returned"),
        );
        let jpg_thumbnail = PathBuf::from(
            jpg_response["path"]
                .as_str()
                .expect("jpg path should be returned"),
        );

        assert_ne!(png_thumbnail, jpg_thumbnail);
        assert_eq!(
            png_thumbnail.file_name().and_then(|value| value.to_str()),
            Some("same-name.png.thumb.png")
        );
        assert_eq!(
            jpg_thumbnail.file_name().and_then(|value| value.to_str()),
            Some("same-name.jpg.thumb.png")
        );
        assert_eq!(
            image::image_dimensions(&png_thumbnail).expect("png thumbnail should decode"),
            (128, 96)
        );
        assert_eq!(
            image::image_dimensions(&jpg_thumbnail).expect("jpg thumbnail should decode"),
            (96, 128)
        );
    }

    #[test]
    fn avatar_thumbnail_file_path_resizes_gif_avatar() {
        let state = test_state("thumbnail-gif");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let avatar_path = avatar_dir.join("animated.gif");
        image::RgbaImage::from_pixel(320, 240, image::Rgba([255, 0, 255, 255]))
            .save(&avatar_path)
            .expect("gif fixture should write");

        let response = avatar_thumbnail_file_path(
            &state,
            Some("animated.gif"),
            Some(&avatar_path.to_string_lossy()),
            None,
            Some(128),
        )
        .expect("gif thumbnail should be generated");
        let thumbnail = PathBuf::from(response["path"].as_str().expect("path should be returned"));

        assert_ne!(thumbnail, avatar_path);
        assert_eq!(
            thumbnail.file_name().and_then(|value| value.to_str()),
            Some("animated.gif.thumb.png")
        );
        assert_eq!(
            image::image_dimensions(&thumbnail).expect("gif thumbnail should decode"),
            (128, 96)
        );
    }

    #[test]
    fn avatar_thumbnail_file_path_rejects_sources_outside_managed_avatars() {
        let state = test_state("thumbnail-outside");
        let outside = state.data_dir.join("outside.png");
        let image = image::RgbaImage::from_pixel(1, 1, image::Rgba([0, 0, 0, 255]));
        image.save(&outside).expect("outside fixture should write");

        let error = avatar_thumbnail_file_path(
            &state,
            None,
            Some(&outside.to_string_lossy()),
            None,
            Some(128),
        )
        .expect_err("outside source should be rejected");

        assert_eq!(error.code, "invalid_input");
    }

    #[test]
    fn avatar_thumbnail_file_path_resizes_inline_data_url_avatar() {
        let state = test_state("thumbnail-inline");
        let image = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            320,
            240,
            image::Rgba([0, 255, 0, 255]),
        ));
        let mut buffer = Cursor::new(Vec::new());
        image
            .write_to(&mut buffer, ImageFormat::Png)
            .expect("inline fixture should encode");
        let data_url = format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(buffer.into_inner())
        );

        let response = avatar_thumbnail_file_path(&state, None, None, Some(&data_url), Some(128))
            .expect("inline thumbnail should be generated");
        let thumbnail = PathBuf::from(response["path"].as_str().expect("path should be returned"));

        assert!(thumbnail.starts_with(state.data_dir.join(".avatar-thumbnails/128/inline")));
        assert!(thumbnail.is_file());
        assert_eq!(
            image::image_dimensions(&thumbnail).expect("thumbnail should decode"),
            (128, 96)
        );
    }

    #[test]
    fn avatar_thumbnail_file_path_accepts_scheme_wrapped_inline_data_url_avatar() {
        let state = test_state("thumbnail-wrapped-inline");
        let image = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            240,
            320,
            image::Rgba([0, 0, 255, 255]),
        ));
        let mut buffer = Cursor::new(Vec::new());
        image
            .write_to(&mut buffer, ImageFormat::Png)
            .expect("inline fixture should encode");
        let data_url = format!(
            "asset://data:image/png;base64,{}",
            general_purpose::STANDARD.encode(buffer.into_inner())
        );

        let response = avatar_thumbnail_file_path(&state, None, None, Some(&data_url), Some(128))
            .expect("wrapped inline thumbnail should be generated");
        let thumbnail = PathBuf::from(response["path"].as_str().expect("path should be returned"));

        assert!(thumbnail.starts_with(state.data_dir.join(".avatar-thumbnails/128/inline")));
        assert_eq!(
            image::image_dimensions(&thumbnail).expect("thumbnail should decode"),
            (96, 128)
        );
    }
}
