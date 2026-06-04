use super::super::images::percent_encode_component;
use super::super::media_uploads::file_path_asset_url;
use crate::state::AppState;
use base64::{engine::general_purpose, Engine as _};
use marinara_core::{AppError, AppResult};
use serde_json::{json, Value};
use std::fs::{self, File};
use std::io::{Read, Seek, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const PROFILE_ASSET_DIRS: &[&str] = &[
    "avatars",
    "sprites",
    "backgrounds",
    "gallery",
    "game-assets",
    "fonts",
    "knowledge-sources",
    "lorebooks/images",
];
const MAX_PROFILE_ASSET_BYTES: u64 = 256 * 1024 * 1024;

const OLD_ASSET_MARKERS: &[&str] = &[
    "/api/avatars/file/",
    "api/avatars/file/",
    "avatars/file/",
    "/api/backgrounds/file/",
    "api/backgrounds/file/",
    "backgrounds/file/",
    "/api/gallery/file/",
    "api/gallery/file/",
    "gallery/file/",
    "/api/sprites/file/",
    "api/sprites/file/",
    "sprites/file/",
];

#[derive(Clone, Copy, PartialEq, Eq)]
enum LegacyProfileAssetKind {
    Avatar,
    Background,
    LorebookImage,
    FileDataUrl,
}

struct LegacyProfileAsset {
    value: String,
    absolute_path: String,
    filename: String,
    kind: LegacyProfileAssetKind,
}

pub(super) struct LegacyProfileGalleryAsset {
    pub(super) asset_url: String,
    pub(super) absolute_path: String,
    pub(super) filename: String,
}

enum ProfileAssetSource {
    Bytes(Vec<u8>),
    ZipEntry(String),
}

struct ProfileAssetRestore {
    relative: PathBuf,
    source: ProfileAssetSource,
}

type JsonProfileAssetPayload = (PathBuf, Vec<u8>);
type JsonProfileAssetDecode = (Vec<JsonProfileAssetPayload>, Vec<Value>);

pub(super) struct RestoredProfileAssets {
    restored: usize,
    transaction: Option<ProfileAssetTransaction>,
    warnings: Vec<Value>,
}

struct ProfileAssetTransaction {
    data_dir: PathBuf,
    staging_root: PathBuf,
    backup_root: PathBuf,
    backed_up: Vec<&'static str>,
    installed: Vec<&'static str>,
    finished: bool,
}

impl RestoredProfileAssets {
    pub(super) fn restored(&self) -> usize {
        self.restored
    }

    pub(super) fn warnings(&self) -> &[Value] {
        &self.warnings
    }

    /// Path where staged assets live before `install()` moves them into the
    /// live data dir. Callers that normalize legacy asset paths during the
    /// pre-install window need this so they can find the assets that have
    /// just been staged but are not yet at `state.data_dir`.
    pub(super) fn staging_root(&self) -> Option<&Path> {
        self.transaction
            .as_ref()
            .map(|transaction| transaction.staging_root.as_path())
    }

    pub(super) fn install(&mut self) -> AppResult<()> {
        if let Some(transaction) = self.transaction.as_mut() {
            transaction.install()?;
        }
        Ok(())
    }

    pub(super) fn commit(mut self) {
        if let Some(transaction) = self.transaction.take() {
            transaction.commit();
        }
    }

    pub(super) fn rollback(mut self) -> AppResult<()> {
        if let Some(mut transaction) = self.transaction.take() {
            transaction.rollback()?;
        }
        Ok(())
    }
}

impl Drop for RestoredProfileAssets {
    fn drop(&mut self) {
        if let Some(mut transaction) = self.transaction.take() {
            let _ = transaction.rollback();
        }
    }
}

impl ProfileAssetTransaction {
    fn new(data_dir: &Path) -> AppResult<Self> {
        fs::create_dir_all(data_dir)?;
        let staging_root = create_profile_import_temp_dir(data_dir, "staging")?;
        let backup_root = match create_profile_import_temp_dir(data_dir, "backup") {
            Ok(path) => path,
            Err(error) => {
                let _ = remove_path_if_exists(&staging_root);
                return Err(error);
            }
        };
        Ok(Self {
            data_dir: data_dir.to_path_buf(),
            staging_root,
            backup_root,
            backed_up: Vec::new(),
            installed: Vec::new(),
            finished: false,
        })
    }

    fn stage_bytes(&self, relative: &Path, bytes: &[u8]) -> AppResult<()> {
        write_profile_asset_in_root(&self.staging_root, relative, bytes)
    }

    fn install(&mut self) -> AppResult<()> {
        if let Err(error) = self.install_inner() {
            return match self.rollback() {
                Ok(()) => Err(error),
                Err(rollback_error) => Err(AppError::new(
                    "profile_asset_rollback_failed",
                    format!(
                        "{error}; additionally failed to roll back profile assets: {rollback_error}"
                    ),
                )),
            };
        }
        Ok(())
    }

    fn install_inner(&mut self) -> AppResult<()> {
        for dir in PROFILE_ASSET_DIRS {
            let target = self.data_dir.join(dir);
            if !path_exists_no_follow(&target)? {
                continue;
            }
            let backup = self.backup_root.join(dir);
            if let Some(parent) = backup.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::rename(&target, &backup)?;
            self.backed_up.push(*dir);
        }

        for dir in PROFILE_ASSET_DIRS {
            let source = self.staging_root.join(dir);
            if !path_exists_no_follow(&source)? {
                continue;
            }
            let target = self.data_dir.join(dir);
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::rename(&source, &target)?;
            self.installed.push(*dir);
        }

        remove_path_if_exists(&self.staging_root)?;
        Ok(())
    }

    fn commit(mut self) {
        self.finished = true;
        let _ = remove_path_if_exists(&self.staging_root);
        let _ = remove_path_if_exists(&self.backup_root);
    }

    fn rollback(&mut self) -> AppResult<()> {
        if self.finished {
            return Ok(());
        }
        self.finished = true;
        let mut first_error = None;
        for dir in self.installed.iter().rev() {
            let target = self.data_dir.join(dir);
            if let Err(error) = remove_path_if_exists(&target) {
                first_error.get_or_insert(error);
            }
        }
        for dir in self.backed_up.iter().rev() {
            let backup = self.backup_root.join(dir);
            match path_exists_no_follow(&backup) {
                Ok(true) => {}
                Ok(false) => continue,
                Err(error) => {
                    first_error.get_or_insert(error);
                    continue;
                }
            }
            let target = self.data_dir.join(dir);
            if let Some(parent) = target.parent() {
                if let Err(error) = fs::create_dir_all(parent) {
                    first_error.get_or_insert(AppError::from(error));
                    continue;
                }
            }
            if let Err(error) = fs::rename(&backup, &target) {
                first_error.get_or_insert(AppError::from(error));
            }
        }
        let _ = remove_path_if_exists(&self.staging_root);
        if let Some(error) = first_error {
            return Err(error);
        }
        let _ = remove_path_if_exists(&self.backup_root);
        Ok(())
    }
}

impl Drop for ProfileAssetTransaction {
    fn drop(&mut self) {
        if !self.finished {
            let _ = self.rollback();
        }
    }
}

pub(super) fn profile_assets(state: &AppState) -> AppResult<Vec<Value>> {
    let mut assets = Vec::new();
    for dir in PROFILE_ASSET_DIRS {
        let relative = Path::new(dir);
        collect_profile_assets(&state.data_dir, relative, &mut assets, true)?;
    }
    Ok(assets)
}

pub(super) fn profile_assets_manifest(state: &AppState) -> AppResult<Vec<Value>> {
    let mut assets = Vec::new();
    for dir in PROFILE_ASSET_DIRS {
        let relative = Path::new(dir);
        collect_profile_assets(&state.data_dir, relative, &mut assets, false)?;
    }
    Ok(assets)
}

fn collect_profile_assets(
    root: &Path,
    relative: &Path,
    assets: &mut Vec<Value>,
    inline_bytes: bool,
) -> AppResult<()> {
    let dir = root.join(relative);
    let dir_metadata = match fs::symlink_metadata(&dir) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    };
    if dir_metadata.file_type().is_symlink() || !dir_metadata.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(&dir)? {
        let path = entry?.path();
        let metadata = fs::symlink_metadata(&path)?;
        if metadata.file_type().is_symlink() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if name.starts_with('.') {
            continue;
        }
        let next_relative = relative.join(name);
        if metadata.is_dir() {
            collect_profile_assets(root, &next_relative, assets, inline_bytes)?;
        } else if metadata.is_file() {
            let mut asset = json!({
                "path": profile_relative_path(&next_relative),
            });
            let object = asset
                .as_object_mut()
                .expect("profile asset metadata should be an object");
            if inline_bytes {
                object.insert(
                    "base64".to_string(),
                    Value::String(general_purpose::STANDARD.encode(fs::read(path)?)),
                );
            } else {
                object.insert("size".to_string(), json!(metadata.len()));
            }
            assets.push(asset);
        }
    }
    Ok(())
}

pub(super) fn restore_profile_assets(
    state: &AppState,
    raw_assets: Option<&Value>,
) -> AppResult<RestoredProfileAssets> {
    restore_profile_json_assets(state, raw_assets, false)
}

pub(super) fn preview_profile_assets(raw_assets: Option<&Value>) -> AppResult<(usize, Vec<Value>)> {
    preview_profile_json_assets(raw_assets, false)
}

pub(super) fn preview_legacy_profile_json_assets(
    raw_assets: Option<&Value>,
) -> AppResult<(usize, Vec<Value>)> {
    preview_profile_json_assets(raw_assets, true)
}

pub(super) fn restore_legacy_profile_json_assets(
    state: &AppState,
    raw_assets: Option<&Value>,
) -> AppResult<RestoredProfileAssets> {
    restore_profile_json_assets(state, raw_assets, true)
}

fn restore_profile_json_assets(
    state: &AppState,
    raw_assets: Option<&Value>,
    allow_legacy_data_field: bool,
) -> AppResult<RestoredProfileAssets> {
    restore_profile_json_assets_in_root(&state.data_dir, raw_assets, allow_legacy_data_field)
}

fn restore_profile_json_assets_in_root(
    data_dir: &Path,
    raw_assets: Option<&Value>,
    allow_legacy_data_field: bool,
) -> AppResult<RestoredProfileAssets> {
    if raw_assets.is_none() {
        return Ok(RestoredProfileAssets {
            restored: 0,
            transaction: None,
            warnings: Vec::new(),
        });
    }
    let (assets, warnings) = decoded_profile_json_assets(raw_assets, allow_legacy_data_field)?;
    let restored = assets.len();
    let transaction = ProfileAssetTransaction::new(data_dir)?;
    for (relative, bytes) in assets {
        transaction.stage_bytes(&relative, &bytes)?;
    }
    Ok(RestoredProfileAssets {
        restored,
        transaction: Some(transaction),
        warnings,
    })
}

fn decoded_profile_json_assets(
    raw_assets: Option<&Value>,
    allow_legacy_data_field: bool,
) -> AppResult<JsonProfileAssetDecode> {
    let Some(assets) = profile_asset_manifest(raw_assets)? else {
        return Ok((Vec::new(), Vec::new()));
    };
    let mut decoded = Vec::new();
    let mut warnings = Vec::new();
    for (index, asset) in assets.iter().enumerate() {
        let path = profile_asset_manifest_path(asset, index)?;
        if is_legacy_cleanup_backup_asset_path(path) {
            continue;
        }
        let relative = safe_profile_asset_path(path)?;
        let raw_data = if allow_legacy_data_field {
            asset
                .get("base64")
                .or_else(|| asset.get("data"))
                .and_then(Value::as_str)
        } else {
            asset.get("base64").and_then(Value::as_str)
        };
        let Some(raw_data) = raw_data else {
            warnings.push(json!({
                "type": "missing_asset",
                "path": path,
                "message": format!("Profile asset {path} is missing base64 data. Imported the rest of the profile without that asset."),
            }));
            continue;
        };
        let bytes = decode_profile_asset_data(path, raw_data)?;
        decoded.push((relative, bytes));
    }
    Ok((decoded, warnings))
}

fn preview_profile_json_assets(
    raw_assets: Option<&Value>,
    allow_legacy_data_field: bool,
) -> AppResult<(usize, Vec<Value>)> {
    let (assets, warnings) = decoded_profile_json_assets(raw_assets, allow_legacy_data_field)?;
    Ok((assets.len(), warnings))
}

pub(super) fn restore_profile_zip_assets<R: Read + Seek>(
    state: &AppState,
    archive: &mut zip::ZipArchive<R>,
    names: &[String],
    profile_prefix: &str,
    raw_assets: Option<&Value>,
) -> AppResult<RestoredProfileAssets> {
    if raw_assets.is_none() {
        return Ok(RestoredProfileAssets {
            restored: 0,
            transaction: None,
            warnings: Vec::new(),
        });
    }
    let (assets, warnings) = decoded_profile_zip_assets(raw_assets, names, profile_prefix)?;
    let restored = assets.len();
    let transaction = ProfileAssetTransaction::new(&state.data_dir)?;
    for asset in assets {
        match asset.source {
            ProfileAssetSource::Bytes(bytes) => {
                transaction.stage_bytes(&asset.relative, &bytes)?;
            }
            ProfileAssetSource::ZipEntry(entry_name) => {
                let target = transaction.staging_root.join(asset.relative);
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent)?;
                }
                let mut entry = archive.by_name(&entry_name).map_err(|error| {
                    AppError::invalid_input(format!(
                        "Could not read profile asset {entry_name}: {error}"
                    ))
                })?;
                validate_profile_zip_asset_declared_size(&entry_name, entry.size())?;
                let mut output = File::create(target)?;
                copy_limited_profile_zip_asset(&entry_name, &mut entry, &mut output)?;
                output.flush()?;
            }
        }
    }
    Ok(RestoredProfileAssets {
        restored,
        transaction: Some(transaction),
        warnings,
    })
}

pub(super) fn preview_profile_zip_assets<R: Read + Seek>(
    archive: &mut zip::ZipArchive<R>,
    raw_assets: Option<&Value>,
    names: &[String],
    profile_prefix: &str,
) -> AppResult<(usize, Vec<Value>)> {
    let (assets, warnings) = decoded_profile_zip_assets(raw_assets, names, profile_prefix)?;
    for asset in &assets {
        let ProfileAssetSource::ZipEntry(entry_name) = &asset.source else {
            continue;
        };
        let mut entry = archive.by_name(entry_name).map_err(|error| {
            AppError::invalid_input(format!(
                "Could not read profile asset {entry_name}: {error}"
            ))
        })?;
        validate_profile_zip_asset_declared_size(entry_name, entry.size())?;
        copy_limited_profile_zip_asset(entry_name, &mut entry, std::io::sink())?;
    }
    Ok((assets.len(), warnings))
}

fn decoded_profile_zip_assets(
    raw_assets: Option<&Value>,
    names: &[String],
    profile_prefix: &str,
) -> AppResult<(Vec<ProfileAssetRestore>, Vec<Value>)> {
    let Some(assets) = profile_asset_manifest(raw_assets)? else {
        return Ok((Vec::new(), Vec::new()));
    };
    let mut decoded = Vec::new();
    let mut warnings = Vec::new();
    for (index, asset) in assets.iter().enumerate() {
        let path = profile_asset_manifest_path(asset, index)?;
        if is_legacy_cleanup_backup_asset_path(path) {
            continue;
        }
        let relative = safe_profile_asset_path(path)?;
        let source = if let Some(raw_data) = asset
            .get("base64")
            .or_else(|| asset.get("data"))
            .and_then(Value::as_str)
        {
            ProfileAssetSource::Bytes(decode_profile_asset_data(path, raw_data)?)
        } else if let Some(entry_name) = zip_asset_entry_name(names, profile_prefix, path) {
            ProfileAssetSource::ZipEntry(entry_name)
        } else {
            warnings.push(json!({
                "type": "missing_asset",
                "path": path,
                "message": format!("Profile ZIP is missing {path}. Imported the rest of the profile without that asset."),
            }));
            continue;
        };
        decoded.push(ProfileAssetRestore { relative, source });
    }
    Ok((decoded, warnings))
}

fn profile_asset_manifest(raw_assets: Option<&Value>) -> AppResult<Option<&Vec<Value>>> {
    match raw_assets {
        None => Ok(None),
        Some(Value::Array(assets)) => Ok(Some(assets)),
        Some(_) => Err(AppError::invalid_input(
            "Profile assets manifest must be an array",
        )),
    }
}

fn profile_asset_manifest_path(asset: &Value, index: usize) -> AppResult<&str> {
    asset
        .get("path")
        .and_then(Value::as_str)
        .filter(|path| !path.trim().is_empty())
        .ok_or_else(|| {
            AppError::invalid_input(format!("Profile asset entry {index} is missing path"))
        })
}

fn validate_profile_zip_asset_declared_size(entry_name: &str, size: u64) -> AppResult<()> {
    validate_profile_zip_asset_declared_size_with_limit(entry_name, size, MAX_PROFILE_ASSET_BYTES)
}

fn validate_profile_zip_asset_declared_size_with_limit(
    entry_name: &str,
    size: u64,
    limit: u64,
) -> AppResult<()> {
    if size > limit {
        return Err(profile_asset_too_large_error(entry_name, size, limit));
    }
    Ok(())
}

fn copy_limited_profile_zip_asset<R: Read, W: Write>(
    entry_name: &str,
    reader: R,
    writer: W,
) -> AppResult<u64> {
    copy_limited_profile_zip_asset_with_limit(entry_name, reader, writer, MAX_PROFILE_ASSET_BYTES)
}

fn copy_limited_profile_zip_asset_with_limit<R: Read, W: Write>(
    entry_name: &str,
    reader: R,
    mut writer: W,
    limit: u64,
) -> AppResult<u64> {
    let mut limited = reader.take(limit.saturating_add(1));
    let copied = std::io::copy(&mut limited, &mut writer).map_err(|error| {
        AppError::invalid_input(format!(
            "Could not read profile asset {entry_name}: {error}"
        ))
    })?;
    if copied > limit {
        return Err(profile_asset_too_large_error(entry_name, copied, limit));
    }
    Ok(copied)
}

fn profile_asset_too_large_error(entry_name: &str, size: u64, limit: u64) -> AppError {
    AppError::invalid_input(format!(
        "Profile asset {entry_name} is too large ({size} bytes; limit is {limit} bytes)"
    ))
}

pub(super) fn normalize_legacy_profile_asset_paths(
    state: &AppState,
    staging_root: Option<&Path>,
    value: &mut Value,
) {
    match value {
        Value::Object(object) => {
            for nested in object.values_mut() {
                normalize_legacy_profile_asset_paths(state, staging_root, nested);
            }
            for field in [
                "avatar",
                "avatarPath",
                "avatarUrl",
                "imagePath",
                "imageUrl",
                "background",
                "backgroundUrl",
                "sprite",
                "spritePath",
                "spriteUrl",
            ] {
                let Some(raw) = object.get(field).and_then(Value::as_str) else {
                    continue;
                };
                let Some(asset) = legacy_profile_asset_for_path(state, staging_root, raw) else {
                    continue;
                };
                object.insert(field.to_string(), Value::String(asset.value));
                if matches!(field, "avatar" | "avatarPath" | "avatarUrl")
                    && asset.kind == LegacyProfileAssetKind::Avatar
                {
                    object
                        .entry("avatarFilePath".to_string())
                        .or_insert_with(|| Value::String(asset.absolute_path.clone()));
                    object
                        .entry("avatarFilename".to_string())
                        .or_insert_with(|| Value::String(asset.filename.clone()));
                }
                if matches!(field, "imagePath" | "imageUrl")
                    && asset.kind == LegacyProfileAssetKind::LorebookImage
                {
                    object
                        .entry("imageFilePath".to_string())
                        .or_insert_with(|| Value::String(asset.absolute_path.clone()));
                    object
                        .entry("imageFilename".to_string())
                        .or_insert_with(|| Value::String(asset.filename.clone()));
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                normalize_legacy_profile_asset_paths(state, staging_root, item);
            }
        }
        Value::String(raw) => {
            if !OLD_ASSET_MARKERS.iter().any(|marker| raw.contains(marker)) {
                return;
            }
            let trimmed = raw.trim_start();
            if !(trimmed.starts_with('{') || trimmed.starts_with('[')) {
                return;
            }
            if let Ok(mut parsed) = serde_json::from_str::<Value>(raw) {
                normalize_legacy_profile_asset_paths(state, staging_root, &mut parsed);
                if let Ok(serialized) = serde_json::to_string(&parsed) {
                    *raw = serialized;
                }
            }
        }
        _ => {}
    }
}

pub(super) fn legacy_profile_gallery_asset_for_path(
    state: &AppState,
    staging_root: Option<&Path>,
    value: &str,
) -> Option<LegacyProfileGalleryAsset> {
    let relative = legacy_profile_asset_relative_path(value)?;
    if !relative.starts_with(Path::new("gallery")) {
        return None;
    }
    let staged_path = staging_root.map(|root| root.join(&relative));
    let staged_present = staged_path
        .as_ref()
        .map(|path| path.is_file())
        .unwrap_or(false);
    let installed_path = state.data_dir.join(&relative);
    if !staged_present && !installed_path.is_file() {
        return None;
    }
    let filename = relative
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.trim().is_empty())?;
    Some(LegacyProfileGalleryAsset {
        asset_url: file_path_asset_url(&installed_path),
        absolute_path: installed_path.to_string_lossy().to_string(),
        filename,
    })
}

fn legacy_profile_asset_for_path(
    state: &AppState,
    staging_root: Option<&Path>,
    value: &str,
) -> Option<LegacyProfileAsset> {
    let relative = legacy_profile_asset_relative_path(value)?;
    // Profile imports stage the asset files under a temporary `staging_root`
    // and only move them into `state.data_dir` at install time, which happens
    // AFTER row normalization. Read from whichever location currently holds
    // the file so legacy paths (e.g. `/api/avatars/file/<hash>.png`) get
    // rewritten - and, for avatars, embedded as data URLs - during this pass
    // instead of being left as broken URLs.
    let staged_path = staging_root.map(|root| root.join(&relative));
    let staged_present = staged_path
        .as_ref()
        .map(|path| path.is_file())
        .unwrap_or(false);
    let installed_path = state.data_dir.join(&relative);
    let read_path = if staged_present {
        staged_path
            .as_ref()
            .expect("staged_present implies staging_root is Some")
            .clone()
    } else if installed_path.is_file() {
        installed_path.clone()
    } else {
        return None;
    };
    // `absolute` is the post-install location stored on the row, so the
    // reference stays valid after the staging transaction commits.
    let absolute = installed_path;
    let filename = relative
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_default();
    let kind = legacy_profile_asset_kind(&relative);
    let value = match kind {
        LegacyProfileAssetKind::Avatar | LegacyProfileAssetKind::FileDataUrl => {
            // Read from `read_path` (staging or installed, whichever holds the
            // bytes right now) - avatars are inlined as data URLs at this
            // point, so the bytes need to actually be available.
            data_url_from_file(&read_path)?
        }
        LegacyProfileAssetKind::Background => managed_asset_url(
            "marinara-background:",
            &relative_asset_tail(&relative, Path::new("backgrounds")),
        ),
        LegacyProfileAssetKind::LorebookImage => managed_asset_url(
            "marinara-lorebook-image:",
            &relative_asset_tail(&relative, Path::new("lorebooks/images")),
        ),
    };
    Some(LegacyProfileAsset {
        value,
        absolute_path: absolute.to_string_lossy().to_string(),
        filename,
        kind,
    })
}

fn legacy_profile_asset_relative_path(value: &str) -> Option<PathBuf> {
    let normalized = normalize_profile_path(value.trim());
    if normalized.starts_with("data:")
        || normalized.starts_with("http://")
        || normalized.starts_with("https://")
        || normalized.starts_with("asset:")
        || normalized.starts_with("marinara-")
    {
        return None;
    }
    let path = normalized
        .split(['?', '#'])
        .next()
        .unwrap_or("")
        .trim_start_matches('/');
    for (prefix, root) in [
        ("api/avatars/file/", "avatars"),
        ("avatars/file/", "avatars"),
        ("avatars/", "avatars"),
        ("api/backgrounds/file/", "backgrounds"),
        ("backgrounds/file/", "backgrounds"),
        ("backgrounds/", "backgrounds"),
        ("api/gallery/file/", "gallery"),
        ("gallery/file/", "gallery"),
        ("gallery/", "gallery"),
        ("api/sprites/file/", "sprites"),
        ("sprites/file/", "sprites"),
        ("sprites/", "sprites"),
        ("api/lorebook-images/file/", "lorebooks/images"),
        ("lorebooks/images/file/", "lorebooks/images"),
        ("lorebooks/images/", "lorebooks/images"),
    ] {
        let Some(tail) = path.strip_prefix(prefix) else {
            continue;
        };
        if tail.is_empty() || should_skip_profile_asset_path(tail) {
            return None;
        }
        return Some(Path::new(root).join(tail));
    }
    None
}

fn legacy_profile_asset_kind(relative: &Path) -> LegacyProfileAssetKind {
    if relative.starts_with(Path::new("avatars")) {
        LegacyProfileAssetKind::Avatar
    } else if relative.starts_with(Path::new("backgrounds")) {
        LegacyProfileAssetKind::Background
    } else if relative.starts_with(Path::new("lorebooks/images")) {
        LegacyProfileAssetKind::LorebookImage
    } else {
        LegacyProfileAssetKind::FileDataUrl
    }
}

fn managed_asset_url(prefix: &str, path: &str) -> String {
    format!("{prefix}{}", percent_encode_component(path))
}

fn data_url_from_file(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    Some(format!(
        "data:{};base64,{}",
        image_mime_from_path(path),
        general_purpose::STANDARD.encode(bytes)
    ))
}

fn image_mime_from_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        _ => "image/png",
    }
}

fn decode_profile_asset_data(asset_name: &str, value: &str) -> AppResult<Vec<u8>> {
    decode_profile_asset_data_with_limit(asset_name, value, MAX_PROFILE_ASSET_BYTES)
}

fn decode_profile_asset_data_with_limit(
    asset_name: &str,
    value: &str,
    limit: u64,
) -> AppResult<Vec<u8>> {
    let payload = profile_asset_data_payload(value);
    validate_profile_inline_asset_encoded_size(asset_name, payload, limit)?;
    let bytes = general_purpose::STANDARD
        .decode(payload)
        .map_err(|error| AppError::invalid_input(format!("Invalid profile asset data: {error}")))?;
    let decoded_size = u64::try_from(bytes.len()).unwrap_or(u64::MAX);
    if decoded_size > limit {
        return Err(profile_asset_too_large_error(
            asset_name,
            decoded_size,
            limit,
        ));
    }
    Ok(bytes)
}

fn profile_asset_data_payload(value: &str) -> &str {
    value
        .split_once(',')
        .filter(|(header, _)| header.starts_with("data:"))
        .map(|(_, payload)| payload)
        .unwrap_or(value)
        .trim()
}

fn validate_profile_inline_asset_encoded_size(
    asset_name: &str,
    payload: &str,
    limit: u64,
) -> AppResult<()> {
    let encoded_len = u64::try_from(payload.len()).unwrap_or(u64::MAX);
    let max_encoded_len = max_base64_encoded_len_for_decoded_limit(limit);
    if encoded_len > max_encoded_len {
        return Err(AppError::invalid_input(format!(
            "Profile asset {asset_name} is too large (encoded payload is {encoded_len} bytes; decoded limit is {limit} bytes)"
        )));
    }
    Ok(())
}

fn max_base64_encoded_len_for_decoded_limit(limit: u64) -> u64 {
    let full_groups = limit / 3;
    let remainder = limit % 3;
    full_groups
        .saturating_mul(4)
        .saturating_add(if remainder == 0 { 0 } else { 4 })
}

fn write_profile_asset_in_root(data_dir: &Path, relative: &Path, bytes: &[u8]) -> AppResult<()> {
    let target = data_dir.join(relative);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(target, bytes)?;
    Ok(())
}

fn create_profile_import_temp_dir(data_dir: &Path, kind: &str) -> AppResult<PathBuf> {
    for attempt in 0..100 {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        let path = data_dir.join(format!(
            ".profile-import-{kind}-{}-{nonce}-{attempt}",
            std::process::id()
        ));
        match fs::create_dir(&path) {
            Ok(()) => return Ok(path),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }
    Err(AppError::new(
        "profile_import_temp_error",
        "Could not create a unique profile import staging directory",
    ))
}

fn path_exists_no_follow(path: &Path) -> AppResult<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

fn remove_path_if_exists(path: &Path) -> AppResult<()> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error.into()),
    };
    if metadata.is_dir() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }
    Ok(())
}

pub(super) fn normalize_profile_path(value: &str) -> String {
    value.replace('\\', "/")
}

pub(super) fn should_skip_profile_asset_path(value: &str) -> bool {
    let normalized = normalize_profile_path(value);
    normalized
        .split('/')
        .any(|segment| segment.is_empty() || segment.starts_with('.'))
}

fn is_legacy_cleanup_backup_asset_path(value: &str) -> bool {
    let normalized = normalize_profile_path(value);
    let parts = normalized.split('/').collect::<Vec<_>>();
    if parts
        .iter()
        .any(|segment| segment.is_empty() || *segment == "..")
    {
        return false;
    }
    PROFILE_ASSET_DIRS
        .iter()
        .any(|allowed| normalized == *allowed || normalized.starts_with(&format!("{allowed}/")))
        && parts.contains(&".cleanup-backups")
}

pub(super) fn safe_profile_asset_path(value: &str) -> AppResult<PathBuf> {
    let normalized = normalize_profile_path(value);
    let path = Path::new(&normalized);
    if path.is_absolute() {
        return Err(AppError::invalid_input("Invalid profile asset path"));
    }
    let mut output = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(segment) => {
                let segment = segment
                    .to_str()
                    .ok_or_else(|| AppError::invalid_input("Invalid profile asset path"))?;
                if segment.is_empty() || segment.starts_with('.') {
                    return Err(AppError::invalid_input("Invalid profile asset path"));
                }
                output.push(segment);
            }
            _ => return Err(AppError::invalid_input("Invalid profile asset path")),
        }
    }
    if output.as_os_str().is_empty()
        || !PROFILE_ASSET_DIRS
            .iter()
            .any(|allowed| output.starts_with(Path::new(allowed)))
    {
        return Err(AppError::invalid_input("Invalid profile asset path"));
    }
    Ok(output)
}

fn zip_asset_entry_name(
    names: &[String],
    profile_prefix: &str,
    asset_path: &str,
) -> Option<String> {
    let normalized_asset = normalize_profile_path(asset_path);
    let prefixed = if profile_prefix.is_empty() {
        normalized_asset.clone()
    } else {
        format!("{}/{}", profile_prefix.trim_matches('/'), normalized_asset)
    };
    names
        .iter()
        .find(|name| normalize_zip_entry_name(name).eq_ignore_ascii_case(&prefixed))
        .cloned()
        .or_else(|| {
            names
                .iter()
                .find(|name| normalize_zip_entry_name(name).eq_ignore_ascii_case(&normalized_asset))
                .cloned()
        })
}

pub(super) fn normalize_zip_entry_name(value: &str) -> String {
    normalize_profile_path(value)
        .trim_start_matches('/')
        .to_string()
}

fn relative_asset_tail(relative: &Path, root: &Path) -> String {
    relative
        .strip_prefix(root)
        .ok()
        .map(profile_relative_path)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            relative
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_string()
        })
}

fn profile_relative_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(value) => value.to_str().map(ToOwned::to_owned),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_data_dir(test_name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "marinara-profile-{test_name}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("temporary profile data dir should be created");
        path
    }

    #[test]
    fn profile_asset_restore_replaces_managed_asset_dirs() {
        let data_dir = temp_data_dir("replace-assets");
        fs::create_dir_all(data_dir.join("avatars")).unwrap();
        fs::create_dir_all(data_dir.join("backgrounds/nested")).unwrap();
        fs::create_dir_all(data_dir.join("lorebooks/images/old")).unwrap();
        fs::create_dir_all(data_dir.join("unrelated")).unwrap();
        fs::write(data_dir.join("avatars/stale.png"), b"stale").unwrap();
        fs::write(data_dir.join("backgrounds/nested/stale.jpg"), b"stale").unwrap();
        fs::write(data_dir.join("lorebooks/images/old/stale.webp"), b"stale").unwrap();
        fs::write(data_dir.join("lorebooks/notes.txt"), b"keep").unwrap();
        fs::write(data_dir.join("unrelated/keep.txt"), b"keep").unwrap();

        let assets = json!([
            {
                "path": "avatars/new.png",
                "base64": general_purpose::STANDARD.encode(b"new avatar"),
            },
            {
                "path": "lorebooks/images/book/new.webp",
                "base64": general_purpose::STANDARD.encode(b"new lorebook image"),
            }
        ]);

        let restored =
            restore_profile_json_assets_in_root(&data_dir, Some(&assets), false).unwrap();

        assert_eq!(restored.restored(), 2);
        assert_eq!(
            fs::read(data_dir.join("avatars/stale.png")).unwrap(),
            b"stale"
        );
        assert!(!data_dir.join("avatars/new.png").exists());

        let mut restored = restored;
        restored.install().unwrap();

        assert_eq!(
            fs::read(data_dir.join("avatars/new.png")).unwrap(),
            b"new avatar"
        );
        assert_eq!(
            fs::read(data_dir.join("lorebooks/images/book/new.webp")).unwrap(),
            b"new lorebook image"
        );
        assert!(!data_dir.join("avatars/stale.png").exists());
        assert!(!data_dir.join("backgrounds/nested/stale.jpg").exists());
        assert!(!data_dir.join("lorebooks/images/old/stale.webp").exists());
        assert_eq!(
            fs::read(data_dir.join("lorebooks/notes.txt")).unwrap(),
            b"keep"
        );
        assert_eq!(
            fs::read(data_dir.join("unrelated/keep.txt")).unwrap(),
            b"keep"
        );

        restored.commit();
        fs::remove_dir_all(data_dir).unwrap();
    }

    #[test]
    fn invalid_profile_asset_payload_does_not_clear_existing_assets() {
        let data_dir = temp_data_dir("invalid-keeps-assets");
        fs::create_dir_all(data_dir.join("avatars")).unwrap();
        fs::write(data_dir.join("avatars/stale.png"), b"stale").unwrap();
        let assets = json!([
            {
                "path": "../escape.png",
                "base64": general_purpose::STANDARD.encode(b"escape"),
            }
        ]);

        let result = restore_profile_json_assets_in_root(&data_dir, Some(&assets), false);

        assert!(result.is_err());
        assert_eq!(
            fs::read(data_dir.join("avatars/stale.png")).unwrap(),
            b"stale"
        );

        fs::remove_dir_all(data_dir).unwrap();
    }

    #[test]
    fn profile_asset_restore_rolls_back_when_import_fails_later() {
        let data_dir = temp_data_dir("rollback-assets");
        fs::create_dir_all(data_dir.join("avatars")).unwrap();
        fs::write(data_dir.join("avatars/stale.png"), b"stale").unwrap();
        let assets = json!([
            {
                "path": "avatars/new.png",
                "base64": general_purpose::STANDARD.encode(b"new avatar"),
            }
        ]);

        let restored =
            restore_profile_json_assets_in_root(&data_dir, Some(&assets), false).unwrap();
        assert!(!data_dir.join("avatars/new.png").exists());
        assert_eq!(
            fs::read(data_dir.join("avatars/stale.png")).unwrap(),
            b"stale"
        );

        let mut restored = restored;
        restored.install().unwrap();
        assert_eq!(
            fs::read(data_dir.join("avatars/new.png")).unwrap(),
            b"new avatar"
        );
        assert!(!data_dir.join("avatars/stale.png").exists());

        restored.rollback().unwrap();

        assert_eq!(
            fs::read(data_dir.join("avatars/stale.png")).unwrap(),
            b"stale"
        );
        assert!(!data_dir.join("avatars/new.png").exists());

        fs::remove_dir_all(data_dir).unwrap();
    }

    #[test]
    fn unfinished_profile_asset_transaction_cleans_staging_on_drop() {
        let data_dir = temp_data_dir("drop-cleans-staging");
        let staging_root;
        let backup_root;
        {
            let transaction = ProfileAssetTransaction::new(&data_dir).unwrap();
            staging_root = transaction.staging_root.clone();
            backup_root = transaction.backup_root.clone();
            transaction
                .stage_bytes(Path::new("avatars/staged.png"), b"staged")
                .unwrap();
        }

        assert!(!staging_root.exists());
        assert!(!backup_root.exists());

        fs::remove_dir_all(data_dir).unwrap();
    }

    #[test]
    fn legacy_cleanup_backup_asset_paths_do_not_reject_profile_assets() {
        let assets = json!([
            {
                "path": "sprites/character-1/.cleanup-backups/backup-1/neutral.png",
                "base64": general_purpose::STANDARD.encode(b"backup sprite"),
            },
            {
                "path": "sprites/character-1/neutral.png",
                "base64": general_purpose::STANDARD.encode(b"live sprite"),
            }
        ]);

        let (decoded, warnings) = decoded_profile_json_assets(Some(&assets), true)
            .expect("legacy cleanup backups should be skipped, not reject the profile");

        assert!(warnings.is_empty());
        assert_eq!(decoded.len(), 1);
        assert_eq!(
            decoded[0].0,
            PathBuf::from("sprites/character-1/neutral.png")
        );
        assert_eq!(decoded[0].1, b"live sprite");
    }

    #[test]
    fn legacy_cleanup_backup_zip_paths_do_not_reject_profile_assets() {
        let assets = json!([
            {
                "path": "sprites/character-1/.cleanup-backups/backup-1/neutral.png",
            },
            {
                "path": "sprites/character-1/neutral.png",
            }
        ]);
        let names = vec!["sprites/character-1/neutral.png".to_string()];

        let (decoded, warnings) = decoded_profile_zip_assets(Some(&assets), &names, "")
            .expect("legacy cleanup backups should be skipped, not reject the profile zip");

        assert!(warnings.is_empty());
        assert_eq!(decoded.len(), 1);
        assert_eq!(
            decoded[0].relative,
            PathBuf::from("sprites/character-1/neutral.png")
        );
        match &decoded[0].source {
            ProfileAssetSource::ZipEntry(entry) => {
                assert_eq!(entry, "sprites/character-1/neutral.png");
            }
            ProfileAssetSource::Bytes(_) => panic!("zip manifest should resolve to an entry"),
        }
    }

    #[test]
    fn profile_json_assets_warn_manifest_entries_without_payload() {
        let assets = json!([
            {
                "path": "avatars/missing-data.png",
            }
        ]);

        let (decoded, warnings) = decoded_profile_json_assets(Some(&assets), false)
            .expect("missing JSON asset payload should warn without rejecting the import");

        assert!(decoded.is_empty());
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0]["type"], "missing_asset");
        assert_eq!(warnings[0]["path"], "avatars/missing-data.png");
    }

    #[test]
    fn profile_zip_assets_warn_manifest_entries_without_matching_file() {
        let assets = json!([
            {
                "path": "avatars/missing-from-zip.png",
            }
        ]);
        let names = Vec::new();

        let (decoded, warnings) = decoded_profile_zip_assets(Some(&assets), &names, "")
            .expect("missing ZIP asset entries should warn without rejecting the import");

        assert!(decoded.is_empty());
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0]["type"], "missing_asset");
        assert_eq!(warnings[0]["path"], "avatars/missing-from-zip.png");
    }

    #[test]
    fn profile_zip_asset_declared_size_over_limit_is_rejected() {
        let error = validate_profile_zip_asset_declared_size_with_limit("avatars/huge.png", 6, 5)
            .expect_err("declared oversized ZIP asset should reject");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("avatars/huge.png"));
        assert!(error.message.contains("too large"));
    }

    #[test]
    fn profile_zip_asset_stream_over_limit_is_rejected() {
        let reader = std::io::repeat(0).take(6);
        let error = copy_limited_profile_zip_asset_with_limit(
            "avatars/huge.png",
            reader,
            std::io::sink(),
            5,
        )
        .expect_err("streamed oversized ZIP asset should reject");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("avatars/huge.png"));
        assert!(error.message.contains("too large"));
    }

    #[test]
    fn profile_inline_asset_encoded_size_over_limit_is_rejected_before_decode() {
        let error = decode_profile_asset_data_with_limit("avatars/huge.png", "!!!!!!!!!!!!", 5)
            .expect_err("encoded oversized inline asset should reject before base64 decode");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("avatars/huge.png"));
        assert!(error.message.contains("too large"));
        assert!(!error.message.contains("Invalid profile asset data"));
    }

    #[test]
    fn profile_inline_asset_decoded_size_over_limit_is_rejected() {
        let payload = format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(vec![0_u8; 6])
        );
        let error = decode_profile_asset_data_with_limit("avatars/huge.png", &payload, 5)
            .expect_err("decoded oversized inline asset should reject");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("avatars/huge.png"));
        assert!(error.message.contains("too large"));
    }
}
