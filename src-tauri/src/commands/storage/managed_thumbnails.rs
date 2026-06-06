use super::media_uploads::safe_filename;
use super::*;
use image::ImageFormat;
use std::path::{Path, PathBuf};

const MANAGED_THUMBNAIL_SIZES: &[u32] = &[64, 128, 256, 512];

#[derive(Clone, Copy)]
pub(crate) enum ManagedThumbnailKind {
    Background,
    Gallery,
    Game,
    Lorebook,
}

impl ManagedThumbnailKind {
    pub(crate) fn parse(value: &str) -> AppResult<Self> {
        match value {
            "background" => Ok(Self::Background),
            "gallery" => Ok(Self::Gallery),
            "game" => Ok(Self::Game),
            "lorebook" => Ok(Self::Lorebook),
            _ => Err(AppError::not_found("Managed thumbnail type was not found")),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Background => "background",
            Self::Gallery => "gallery",
            Self::Game => "game",
            Self::Lorebook => "lorebook",
        }
    }

    fn root(self, state: &AppState) -> PathBuf {
        match self {
            Self::Background => state.data_dir.join("backgrounds"),
            Self::Gallery => state.data_dir.join("gallery"),
            Self::Game => state.data_dir.join("game-assets"),
            Self::Lorebook => state.data_dir.join("lorebooks").join("images"),
        }
    }

    fn source(self, state: &AppState, path: &str) -> AppResult<PathBuf> {
        match self {
            Self::Background => Ok(PathBuf::from(state.backgrounds.absolute_path_string(path)?)),
            Self::Gallery => Ok(state.data_dir.join("gallery").join(safe_filename(path))),
            Self::Game => Ok(PathBuf::from(state.game_assets.absolute_path_string(path)?)),
            Self::Lorebook => {
                let response = super::lorebook_images::lorebook_image_file_path(state, path)?;
                response
                    .get("path")
                    .and_then(Value::as_str)
                    .map(PathBuf::from)
                    .ok_or_else(|| AppError::not_found("Lorebook image was not found"))
            }
        }
    }
}

pub(crate) fn managed_asset_thumbnail_file_path(
    state: &AppState,
    kind: &str,
    path: &str,
    size: Option<u32>,
) -> AppResult<Value> {
    let kind = ManagedThumbnailKind::parse(kind)?;
    let path = managed_thumbnail_path(state, kind, path, size.unwrap_or(256))?;
    Ok(json!({ "path": path.to_string_lossy() }))
}

pub(crate) fn managed_thumbnail_path(
    state: &AppState,
    kind: ManagedThumbnailKind,
    path: &str,
    size: u32,
) -> AppResult<PathBuf> {
    if !MANAGED_THUMBNAIL_SIZES.contains(&size) {
        return Err(AppError::invalid_input(
            "Unsupported managed thumbnail size",
        ));
    }

    let source = canonical_source(state, kind, path)?;
    if !is_resizable_image_file(&source) {
        return Ok(source);
    }
    if is_unsupported_thumbnail_file(&source) {
        return Err(AppError::invalid_input(
            "AVIF managed thumbnails are unsupported by the current image decoder",
        ));
    }

    let root = canonical_root(state, kind)?;
    let relative = source.strip_prefix(&root).map_err(|_| {
        AppError::invalid_input("Managed thumbnail source is outside managed assets")
    })?;
    let target = thumbnail_target_path(state, kind, size, relative);
    if thumbnail_is_fresh(&source, &target)? {
        return Ok(target);
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    write_thumbnail(&source, &target, size)?;
    Ok(target)
}

pub(crate) fn remove_managed_thumbnail_files(
    state: &AppState,
    kind: ManagedThumbnailKind,
    path: &str,
) {
    let Ok(source) = canonical_source(state, kind, path) else {
        return;
    };
    let Ok(root) = canonical_root(state, kind) else {
        return;
    };
    let Ok(relative) = source.strip_prefix(&root) else {
        return;
    };
    for size in MANAGED_THUMBNAIL_SIZES {
        let target = thumbnail_target_path(state, kind, *size, relative);
        if target.is_file() {
            if let Err(error) = fs::remove_file(&target) {
                log::warn!(
                    "could not remove managed thumbnail {}: {error}",
                    target.display()
                );
            }
        }
    }
}

fn canonical_source(
    state: &AppState,
    kind: ManagedThumbnailKind,
    path: &str,
) -> AppResult<PathBuf> {
    let source = kind.source(state, path)?;
    let source = fs::canonicalize(source).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => {
            AppError::not_found("Managed thumbnail source was not found")
        }
        _ => AppError::from(error),
    })?;
    let root = canonical_root(state, kind)?;
    if !source.starts_with(root) {
        return Err(AppError::invalid_input(
            "Managed thumbnail source is outside managed assets",
        ));
    }
    Ok(source)
}

fn canonical_root(state: &AppState, kind: ManagedThumbnailKind) -> AppResult<PathBuf> {
    let root = kind.root(state);
    fs::create_dir_all(&root)?;
    fs::canonicalize(root).map_err(AppError::from)
}

fn thumbnail_target_path(
    state: &AppState,
    kind: ManagedThumbnailKind,
    size: u32,
    relative: &Path,
) -> PathBuf {
    let mut target = state
        .data_dir
        .join(".managed-thumbnails")
        .join(kind.as_str())
        .join(size.to_string())
        .join(relative);
    let filename = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "asset".to_string());
    target.set_file_name(format!("{filename}.thumb.png"));
    target
}

fn is_resizable_image_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "avif"
    )
}

fn is_unsupported_thumbnail_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "avif"
    )
}

fn thumbnail_is_fresh(source: &Path, target: &Path) -> AppResult<bool> {
    let source_modified = fs::metadata(source)?.modified()?;
    let Ok(target_modified) = fs::metadata(target).and_then(|metadata| metadata.modified()) else {
        return Ok(false);
    };
    Ok(target_modified >= source_modified)
}

fn write_thumbnail(source: &Path, target: &Path, size: u32) -> AppResult<()> {
    let image = image::open(source).map_err(|error| {
        AppError::invalid_input(format!("Managed thumbnail could not be decoded: {error}"))
    })?;
    let temp = thumbnail_temp_path(target);
    image
        .thumbnail(size, size)
        .save_with_format(&temp, ImageFormat::Png)
        .map_err(|error| {
            let _ = fs::remove_file(&temp);
            AppError::new("managed_thumbnail_error", error.to_string())
        })?;
    replace_thumbnail_file(&temp, target).map_err(|error| {
        let _ = fs::remove_file(&temp);
        AppError::from(error)
    })
}

fn thumbnail_temp_path(target: &Path) -> PathBuf {
    let filename = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "asset.thumb.png".to_string());
    target.with_file_name(format!(".{filename}.{}.tmp", new_id()))
}

fn replace_thumbnail_file(temp: &Path, target: &Path) -> std::io::Result<()> {
    match fs::rename(temp, target) {
        Ok(()) => Ok(()),
        Err(_) if target.exists() => {
            let _ = fs::remove_file(target);
            fs::rename(temp, target)
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-thumbnails-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn write_png(path: &Path, width: u32, height: u32) {
        let image = ImageBuffer::from_pixel(width, height, Rgba([40u8, 80u8, 120u8, 255u8]));
        image.save(path).expect("test image should be saved");
    }

    #[test]
    fn managed_thumbnail_creates_cache_without_overwriting_source() {
        let state = test_state("background-cache");
        let source = state.data_dir.join("backgrounds").join("wide.png");
        write_png(&source, 640, 320);

        let response =
            managed_asset_thumbnail_file_path(&state, "background", "wide.png", Some(128))
                .expect("thumbnail should be created");
        let thumbnail = PathBuf::from(response["path"].as_str().expect("path should be returned"));

        assert!(thumbnail.starts_with(state.data_dir.join(".managed-thumbnails")));
        assert!(thumbnail.is_file());
        assert!(source.is_file());
        assert_ne!(thumbnail, source);
    }

    #[test]
    fn managed_thumbnail_rejects_sources_outside_managed_assets() {
        let state = test_state("outside");
        let outside = state.data_dir.join("outside.png");
        write_png(&outside, 64, 64);
        let error =
            managed_thumbnail_path(&state, ManagedThumbnailKind::Gallery, "../outside.png", 128)
                .expect_err("path traversal should be rejected");

        assert_eq!(error.code, "not_found");
    }

    #[test]
    fn managed_thumbnail_rejects_avif_sources_until_decoder_support_exists() {
        let state = test_state("avif");
        let source = state.data_dir.join("backgrounds").join("still.avif");
        std::fs::write(&source, b"not-an-avif").expect("avif fixture should be written");

        let error =
            managed_asset_thumbnail_file_path(&state, "background", "still.avif", Some(128))
                .expect_err("avif thumbnails should currently reject");

        assert_eq!(error.code, "invalid_input");
        assert!(
            error.message.contains("AVIF"),
            "error should explain current avif thumbnail contract"
        );
    }
}
