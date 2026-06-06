#[path = "profile/assets.rs"]
mod assets;
#[path = "profile/legacy.rs"]
mod legacy;
#[path = "profile/zip_import.rs"]
mod zip_import;

use self::assets::{
    preview_legacy_profile_json_assets, preview_profile_assets, profile_assets,
    profile_assets_manifest, restore_profile_assets, RestoredProfileAssets,
};
use self::legacy::{
    import_legacy_profile_tables_with_progress, legacy_array_profile_tables,
    preview_legacy_profile_tables,
};
use self::zip_import::{import_profile_zip, import_profile_zip_with_progress, preview_profile_zip};
use super::contracts;
use super::shared::*;
use super::*;
use base64::engine::general_purpose;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const PROFILE_EXPORT_JSON_LIMIT_BYTES: usize = 256 * 1024 * 1024;
const PROFILE_EXPORT_JSON_TOO_LARGE_CODE: &str = "PROFILE_EXPORT_JSON_TOO_LARGE";

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum ProfileImportMode {
    Preview,
    Commit,
}

#[derive(Clone, Copy)]
pub(super) enum ProfileImportSourceFormat {
    RefactorNative,
    LegacyFileStorage,
    LegacyArray,
}

impl ProfileImportSourceFormat {
    fn as_str(self) -> &'static str {
        match self {
            Self::RefactorNative => "refactor-native",
            Self::LegacyFileStorage => "legacy-modern-fileStorage",
            Self::LegacyArray => "legacy-array",
        }
    }

    fn converted_from(self) -> Option<&'static str> {
        match self {
            Self::RefactorNative => None,
            Self::LegacyFileStorage => Some("legacy-modern-fileStorage"),
            Self::LegacyArray => Some("legacy-array"),
        }
    }
}

struct ProfileCollectionsImportPlan {
    imported: Map<String, Value>,
    replacements: Vec<(&'static str, Vec<Value>)>,
}

struct ProfileFileSnapshot {
    path: PathBuf,
    fingerprint: String,
}

pub(super) struct ProfileImportProgress<'a> {
    emit: Option<Box<dyn FnMut(Value) -> AppResult<()> + 'a>>,
    current: usize,
    total: usize,
    imported: Map<String, Value>,
}

impl<'a> ProfileImportProgress<'a> {
    pub(super) fn disabled() -> Self {
        Self {
            emit: None,
            current: 0,
            total: 1,
            imported: Map::new(),
        }
    }

    fn new(emit: impl FnMut(Value) -> AppResult<()> + 'a) -> Self {
        Self {
            emit: Some(Box::new(emit)),
            current: 0,
            total: 1,
            imported: Map::new(),
        }
    }

    pub(super) fn prepare(
        &mut self,
        phase: &'static str,
        label: impl Into<String>,
    ) -> AppResult<()> {
        if self.emit.is_none() {
            return Ok(());
        }
        self.total = self.total.max(1);
        self.emit_event(phase, None, label.into())
    }

    pub(super) fn begin(
        &mut self,
        total: usize,
        phase: &'static str,
        label: impl Into<String>,
    ) -> AppResult<()> {
        if self.emit.is_none() {
            return Ok(());
        }
        self.current = 0;
        self.total = total.max(1);
        self.imported.clear();
        self.emit_event(phase, None, label.into())
    }

    pub(super) fn advance(
        &mut self,
        phase: &'static str,
        item: impl Into<String>,
        label: impl Into<String>,
        count: usize,
    ) -> AppResult<()> {
        self.advance_counted(phase, item, label, count, Some(count))
    }

    pub(super) fn advance_untracked(
        &mut self,
        phase: &'static str,
        item: impl Into<String>,
        label: impl Into<String>,
        count: usize,
    ) -> AppResult<()> {
        self.advance_counted(phase, item, label, count, None)
    }

    pub(super) fn advance_untracked_after_commit(
        &mut self,
        phase: &'static str,
        item: impl Into<String>,
        label: impl Into<String>,
        count: usize,
    ) {
        if let Err(error) = self.advance_untracked(phase, item, label, count) {
            log::warn!(
                "profile import completed but progress delivery failed code={} message={}",
                error.code,
                error.message
            );
        }
    }

    pub(super) fn advance_counted(
        &mut self,
        phase: &'static str,
        item: impl Into<String>,
        label: impl Into<String>,
        processed_count: usize,
        imported_count: Option<usize>,
    ) -> AppResult<()> {
        if self.emit.is_none() {
            return Ok(());
        }
        let item = item.into();
        self.current = self.current.saturating_add(processed_count).min(self.total);
        if let Some(imported_count) = imported_count {
            self.imported.insert(item.clone(), json!(imported_count));
        }
        self.emit_event(phase, Some(item), label.into())
    }

    fn emit_event(
        &mut self,
        phase: &'static str,
        item: Option<String>,
        label: String,
    ) -> AppResult<()> {
        let Some(emit) = self.emit.as_mut() else {
            return Ok(());
        };
        let mut data = Map::new();
        data.insert("phase".to_string(), Value::String(phase.to_string()));
        data.insert("label".to_string(), Value::String(label));
        data.insert("current".to_string(), json!(self.current));
        data.insert("total".to_string(), json!(self.total));
        data.insert("imported".to_string(), Value::Object(self.imported.clone()));
        if let Some(item) = item {
            data.insert("item".to_string(), Value::String(item));
        }
        emit(json!({
            "type": "progress",
            "data": Value::Object(data),
        }))
    }
}

pub(crate) struct ProfileExportDownload {
    pub(crate) bytes: Vec<u8>,
    pub(crate) filename: &'static str,
    pub(crate) content_type: &'static str,
}

pub(crate) fn profile_snapshot(state: &AppState) -> AppResult<Value> {
    Ok(json!({
        "type": "marinara_profile",
        "version": 1,
        "exportedAt": now_iso(),
        "runtime": "tauri",
        "data": {
            "collections": profile_collections(state)?,
            "assets": profile_assets(state)?,
        }
    }))
}

pub(crate) fn profile_backup_snapshot(state: &AppState) -> AppResult<Value> {
    Ok(json!({
        "type": "marinara_profile",
        "version": 1,
        "exportedAt": now_iso(),
        "runtime": "tauri",
        "data": {
            "collections": profile_collections(state)?,
            "assets": profile_assets_manifest(state)?,
        }
    }))
}

pub(crate) fn import_profile_file_path(
    state: &AppState,
    value: &str,
    preview_fingerprint: Option<&str>,
) -> AppResult<Value> {
    let path = PathBuf::from(value.trim());
    import_profile_file_with_preview_fingerprint(state, &path, preview_fingerprint)
}

pub(crate) fn import_profile_file_path_with_progress(
    state: &AppState,
    value: &str,
    preview_fingerprint: Option<&str>,
    emit: impl FnMut(Value) -> AppResult<()>,
) -> AppResult<Value> {
    let path = PathBuf::from(value.trim());
    import_profile_file_with_preview_fingerprint_and_progress(
        state,
        &path,
        preview_fingerprint,
        emit,
    )
}

pub(crate) fn preview_profile_file_path(state: &AppState, value: &str) -> AppResult<Value> {
    let path = PathBuf::from(value.trim());
    preview_profile_file(state, &path)
}

pub(crate) fn import_profile_file(state: &AppState, path: &Path) -> AppResult<Value> {
    import_profile_file_with_preview_fingerprint(state, path, None)
}

pub(crate) fn import_profile_file_with_preview_fingerprint(
    state: &AppState,
    path: &Path,
    preview_fingerprint: Option<&str>,
) -> AppResult<Value> {
    let mut progress = ProfileImportProgress::disabled();
    import_profile_file_with_preview_fingerprint_inner(
        state,
        path,
        preview_fingerprint,
        &mut progress,
    )
}

pub(crate) fn import_profile_file_with_preview_fingerprint_and_progress(
    state: &AppState,
    path: &Path,
    preview_fingerprint: Option<&str>,
    emit: impl FnMut(Value) -> AppResult<()>,
) -> AppResult<Value> {
    let mut progress = ProfileImportProgress::new(emit);
    import_profile_file_with_preview_fingerprint_inner(
        state,
        path,
        preview_fingerprint,
        &mut progress,
    )
}

fn import_profile_file_with_preview_fingerprint_inner(
    state: &AppState,
    path: &Path,
    preview_fingerprint: Option<&str>,
    progress: &mut ProfileImportProgress<'_>,
) -> AppResult<Value> {
    with_profile_file_snapshot(state, path, |snapshot_path, extension, fingerprint| {
        if let Some(expected) = preview_fingerprint
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            if fingerprint != expected {
                return Err(AppError::with_details(
                    "profile_file_changed",
                    "Profile file changed after preview. Select the file again before importing.",
                    json!({
                        "expectedFingerprint": expected,
                        "actualFingerprint": fingerprint,
                    }),
                ));
            }
        }
        match extension {
            "json" => import_profile_with_progress(
                state,
                serde_json::from_reader(File::open(snapshot_path)?)
                    .map_err(invalid_profile_json_error)?,
                progress,
            ),
            "zip" => import_profile_zip_with_progress(state, snapshot_path, progress),
            _ => unreachable!("profile_file_extension only returns json or zip"),
        }
    })
}

pub(crate) fn preview_profile_file(state: &AppState, path: &Path) -> AppResult<Value> {
    with_profile_file_snapshot(state, path, |snapshot_path, extension, fingerprint| {
        let result = match extension {
            "json" => preview_profile(
                state,
                serde_json::from_reader(File::open(snapshot_path)?)
                    .map_err(invalid_profile_json_error)?,
            ),
            "zip" => preview_profile_zip(state, snapshot_path),
            _ => unreachable!("profile_file_extension only returns json or zip"),
        }?;
        Ok(with_profile_import_file_fingerprint(
            result,
            fingerprint.to_string(),
        ))
    })
}

pub(crate) fn import_profile_upload(
    state: &AppState,
    filename: &str,
    base64: &str,
) -> AppResult<Value> {
    let (extension, bytes) = profile_upload_bytes(filename, base64)?;
    match extension.as_str() {
        "json" => import_profile(
            state,
            serde_json::from_slice(&bytes).map_err(invalid_profile_json_error)?,
        ),
        "zip" => {
            let upload_dir = state.data_dir.join(".profile-upload-imports");
            fs::create_dir_all(&upload_dir)?;
            let path = write_profile_temp_file(&upload_dir, "profile-import", "zip", &bytes)?;
            let result = import_profile_zip(state, &path);
            let _ = fs::remove_file(path);
            result
        }
        _ => Err(AppError::invalid_input(
            "Profile upload must be a .json or .zip file",
        )),
    }
}

pub(crate) fn preview_profile_upload(
    state: &AppState,
    filename: &str,
    base64: &str,
) -> AppResult<Value> {
    let (extension, bytes) = profile_upload_bytes(filename, base64)?;
    match extension.as_str() {
        "json" => preview_profile(
            state,
            serde_json::from_slice(&bytes).map_err(invalid_profile_json_error)?,
        ),
        "zip" => {
            let upload_dir = state.data_dir.join(".profile-upload-imports");
            fs::create_dir_all(&upload_dir)?;
            let path = write_profile_temp_file(&upload_dir, "profile-preview", "zip", &bytes)?;
            let result = preview_profile_zip(state, &path);
            let _ = fs::remove_file(path);
            result
        }
        _ => Err(AppError::invalid_input(
            "Profile upload must be a .json or .zip file",
        )),
    }
}

fn profile_upload_bytes(filename: &str, base64: &str) -> AppResult<(String, Vec<u8>)> {
    let extension = Path::new(filename)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .ok_or_else(|| AppError::invalid_input("Profile upload must be a .json or .zip file"))?;
    let bytes =
        base64::Engine::decode(&general_purpose::STANDARD, base64.trim()).map_err(|error| {
            AppError::invalid_input(format!("Invalid profile upload data: {error}"))
        })?;
    Ok((extension, bytes))
}

fn with_profile_file_snapshot<T>(
    state: &AppState,
    path: &Path,
    operation: impl FnOnce(&Path, &str, &str) -> AppResult<T>,
) -> AppResult<T> {
    validate_profile_file_path(path)?;
    let extension = profile_file_extension(path)?;
    let upload_dir = state.data_dir.join(".profile-upload-imports");
    fs::create_dir_all(&upload_dir)?;
    let snapshot = copy_profile_file_snapshot(path, &upload_dir, &extension)?;
    let result = operation(&snapshot.path, &extension, &snapshot.fingerprint);
    let _ = fs::remove_file(snapshot.path);
    result
}

fn validate_profile_file_path(path: &Path) -> AppResult<()> {
    if path.as_os_str().is_empty() {
        return Err(AppError::invalid_input("Profile file path is required"));
    }
    if !path.is_file() {
        return Err(AppError::invalid_input("Profile import path is not a file"));
    }
    Ok(())
}

fn profile_file_extension(path: &Path) -> AppResult<String> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("json") => Ok("json".to_string()),
        Some("zip") => Ok("zip".to_string()),
        _ => Err(AppError::invalid_input(
            "Profile import must be a .json or .zip file",
        )),
    }
}

fn copy_profile_file_snapshot(
    source_path: &Path,
    upload_dir: &Path,
    extension: &str,
) -> AppResult<ProfileFileSnapshot> {
    let mut source = File::open(source_path)?;
    let (path, mut output) =
        create_profile_temp_file(upload_dir, "profile-file-snapshot", extension)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    let copy_result: AppResult<()> = (|| {
        loop {
            let read = source.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
            output.write_all(&buffer[..read])?;
        }
        output.flush()?;
        Ok(())
    })();
    drop(output);
    if let Err(error) = copy_result {
        let _ = fs::remove_file(&path);
        return Err(error);
    }
    Ok(ProfileFileSnapshot {
        path,
        fingerprint: format!("sha256:{}", hex_bytes(&hasher.finalize())),
    })
}

fn write_profile_temp_file(
    upload_dir: &Path,
    prefix: &str,
    extension: &str,
    bytes: &[u8],
) -> AppResult<PathBuf> {
    let (path, mut file) = create_profile_temp_file(upload_dir, prefix, extension)?;
    let write_result: AppResult<()> = (|| {
        file.write_all(bytes)?;
        file.flush()?;
        Ok(())
    })();
    drop(file);
    if let Err(error) = write_result {
        let _ = fs::remove_file(&path);
        return Err(error);
    }
    Ok(path)
}

fn create_profile_temp_file(
    upload_dir: &Path,
    prefix: &str,
    extension: &str,
) -> AppResult<(PathBuf, File)> {
    for attempt in 0..1000 {
        let path = upload_dir.join(format!(
            "{prefix}-{}-{}-{attempt}.{extension}",
            now_millis(),
            std::process::id()
        ));
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }
    Err(AppError::new(
        "profile_temp_file_unavailable",
        "Could not create a unique temporary profile import file",
    ))
}

fn hex_bytes(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

fn invalid_profile_json_error(error: serde_json::Error) -> AppError {
    AppError::invalid_input(format!("Invalid profile JSON: {error}"))
}

pub(crate) fn profile_call(
    state: &AppState,
    method: &str,
    rest: &[&str],
    route: &ParsedPath,
    body: Value,
) -> AppResult<Value> {
    match (method, rest) {
        ("GET", ["export"]) => export_profile(state, route.query.get("format").map(String::as_str)),
        ("POST", ["import", "preview"]) => preview_profile(state, body),
        ("POST", ["import"]) => import_profile(state, body),
        _ => Err(AppError::new(
            "route_not_found",
            format!("Unknown profile route: {method} /{}", rest.join("/")),
        )),
    }
}

pub(crate) fn export_profile(state: &AppState, format: Option<&str>) -> AppResult<Value> {
    match format {
        Some("native") | None => native_profile_export(state),
        Some("compatible") => super::exports::export_compatible_profile(state),
        Some("zip") => super::backup::download_profile_zip(state),
        Some(_) => Err(AppError::invalid_input(
            "Profile export format must be native, compatible, or zip.",
        )),
    }
}

pub(crate) fn export_profile_download(
    state: &AppState,
    format: Option<&str>,
) -> AppResult<ProfileExportDownload> {
    match format {
        Some("native") | None => {
            let snapshot = native_profile_export(state)?;
            Ok(ProfileExportDownload {
                bytes: serde_json::to_vec(&snapshot)?,
                filename: "marinara-profile.json",
                content_type: "application/json",
            })
        }
        Some("compatible") => Ok(ProfileExportDownload {
            bytes: super::exports::export_compatible_profile_bytes(state)?,
            filename: "marinara-compatible-export.zip",
            content_type: "application/zip",
        }),
        Some("zip") => Ok(ProfileExportDownload {
            bytes: super::backup::download_profile_zip_bytes(state)?,
            filename: "marinara-profile.zip",
            content_type: "application/zip",
        }),
        Some(_) => Err(AppError::invalid_input(
            "Profile export format must be native, compatible, or zip.",
        )),
    }
}

fn native_profile_export(state: &AppState) -> AppResult<Value> {
    let snapshot = profile_snapshot(state)?;
    let estimated_bytes = serde_json::to_vec(&snapshot)?.len();
    if estimated_bytes > PROFILE_EXPORT_JSON_LIMIT_BYTES {
        return Err(AppError::with_details(
            PROFILE_EXPORT_JSON_TOO_LARGE_CODE,
            "This profile is too large for the JSON profile exporter. Export it as a profile ZIP instead.",
            json!({
                "fallbackFormat": "zip",
                "estimatedBytes": estimated_bytes,
                "limitBytes": PROFILE_EXPORT_JSON_LIMIT_BYTES,
            }),
        ));
    }
    Ok(snapshot)
}

fn import_profile(state: &AppState, body: Value) -> AppResult<Value> {
    let mut progress = ProfileImportProgress::disabled();
    import_profile_with_progress(state, body, &mut progress)
}

fn import_profile_with_progress(
    state: &AppState,
    body: Value,
    progress: &mut ProfileImportProgress<'_>,
) -> AppResult<Value> {
    run_profile_import(state, body, ProfileImportMode::Commit, progress)
}

fn preview_profile(state: &AppState, body: Value) -> AppResult<Value> {
    let mut progress = ProfileImportProgress::disabled();
    run_profile_import(state, body, ProfileImportMode::Preview, &mut progress)
}

fn run_profile_import(
    state: &AppState,
    body: Value,
    mode: ProfileImportMode,
    progress: &mut ProfileImportProgress<'_>,
) -> AppResult<Value> {
    let data = body
        .get("data")
        .and_then(Value::as_object)
        .filter(|_| body.get("type").and_then(Value::as_str) == Some("marinara_profile"))
        .ok_or_else(|| AppError::invalid_input("Invalid Marinara profile export"))?;
    if let Some(collections_value) = data.get("collections") {
        let collections = collections_value.as_object().ok_or_else(|| {
            profile_format_error(
                "Profile export data.collections must be an object",
                "invalid-refactor-native",
            )
        })?;
        return run_profile_collections(state, data, collections, mode, progress);
    }
    if let Some(tables_value) = data
        .get("fileStorage")
        .and_then(|file_storage| file_storage.get("tables"))
    {
        let tables = tables_value.as_object().ok_or_else(|| {
            profile_format_error(
                "Profile export data.fileStorage.tables must be an object",
                "invalid-legacy-modern-fileStorage",
            )
        })?;
        let files = data.get("fileStorage").and_then(|value| value.get("files"));
        return run_profile_legacy_tables(
            state,
            tables,
            files,
            ProfileImportSourceFormat::LegacyFileStorage,
            mode,
            progress,
        );
    }
    if let Some(tables) = legacy_array_profile_tables(data)? {
        let files = data
            .get("fileStorage")
            .and_then(|value| value.get("files"))
            .or_else(|| data.get("assets"));
        return run_profile_legacy_tables(
            state,
            &tables,
            files,
            ProfileImportSourceFormat::LegacyArray,
            mode,
            progress,
        );
    }
    Err(profile_format_error(
        "Profile export must contain data.collections, data.fileStorage.tables, or legacy profile arrays",
        "unknown",
    ))
}

fn run_profile_collections(
    state: &AppState,
    data: &Map<String, Value>,
    collections: &Map<String, Value>,
    mode: ProfileImportMode,
    progress: &mut ProfileImportProgress<'_>,
) -> AppResult<Value> {
    validate_native_profile_import(data, collections)?;
    match mode {
        ProfileImportMode::Preview => {
            let (restored_assets, warnings) = preview_profile_assets(data.get("assets"))?;
            let result = preview_profile_collections_with_restored_assets(
                state,
                collections,
                restored_assets,
            )?;
            Ok(with_profile_import_warnings(
                with_profile_import_metadata(result, ProfileImportSourceFormat::RefactorNative),
                warnings,
            ))
        }
        ProfileImportMode::Commit => {
            progress.prepare("assets", "Preparing profile assets")?;
            let mut restored_assets = restore_profile_assets(state, data.get("assets"))?;
            let restored_count = restored_assets.restored();
            let result = import_profile_collections_with_restored_assets_with_progress(
                state,
                collections,
                restored_count,
                progress,
                || restored_assets.install(),
            );
            finish_profile_import_assets(restored_assets, result).map(|value| {
                with_profile_import_metadata(value, ProfileImportSourceFormat::RefactorNative)
            })
        }
    }
}

fn run_profile_legacy_tables(
    state: &AppState,
    tables: &Map<String, Value>,
    raw_assets: Option<&Value>,
    source_format: ProfileImportSourceFormat,
    mode: ProfileImportMode,
    progress: &mut ProfileImportProgress<'_>,
) -> AppResult<Value> {
    match mode {
        ProfileImportMode::Preview => {
            let (restored_assets, warnings) = preview_legacy_profile_json_assets(raw_assets)?;
            let result = preview_legacy_profile_tables(state, tables, restored_assets)?;
            Ok(with_profile_import_warnings(
                with_profile_import_metadata(result, source_format),
                warnings,
            ))
        }
        ProfileImportMode::Commit => {
            progress.prepare("assets", "Preparing profile assets")?;
            import_legacy_profile_tables_with_progress(state, tables, raw_assets, progress)
                .map(|value| with_profile_import_metadata(value, source_format))
        }
    }
}

pub(super) fn preview_profile_collections_with_restored_assets(
    state: &AppState,
    collections: &Map<String, Value>,
    restored_assets: usize,
) -> AppResult<Value> {
    let mut progress = ProfileImportProgress::disabled();
    let plan = profile_collections_import_plan(
        state,
        collections,
        restored_assets,
        ProfileImportMode::Preview,
        &mut progress,
    )?;
    Ok(json!({ "success": true, "preview": true, "imported": plan.imported }))
}

pub(super) fn with_profile_import_metadata(
    mut value: Value,
    source_format: ProfileImportSourceFormat,
) -> Value {
    if let Some(object) = value.as_object_mut() {
        object.insert(
            "sourceFormat".to_string(),
            Value::String(source_format.as_str().to_string()),
        );
        let converted = match source_format.converted_from() {
            Some(from) => json!({
                "applied": true,
                "from": from,
                "to": "refactor-collections",
            }),
            None => json!({
                "applied": false,
            }),
        };
        object.insert("converted".to_string(), converted);
    }
    value
}

pub(super) fn with_profile_import_warnings(mut value: Value, warnings: Vec<Value>) -> Value {
    if !warnings.is_empty() {
        if let Some(object) = value.as_object_mut() {
            object.insert("warnings".to_string(), Value::Array(warnings));
        }
    }
    value
}

fn with_profile_import_file_fingerprint(mut value: Value, fingerprint: String) -> Value {
    if let Some(object) = value.as_object_mut() {
        object.insert("fileFingerprint".to_string(), Value::String(fingerprint));
    }
    value
}

pub(super) fn profile_format_error(
    message: impl Into<String>,
    source_format: &'static str,
) -> AppError {
    AppError::with_details(
        "invalid_input",
        message,
        json!({
            "sourceFormat": source_format,
            "expectedFormats": [
                "refactor-native",
                "legacy-modern-fileStorage",
                "legacy-array",
            ],
        }),
    )
}

pub(super) fn validate_native_profile_import(
    data: &Map<String, Value>,
    collections: &Map<String, Value>,
) -> AppResult<()> {
    match data.get("assets") {
        Some(Value::Array(_)) => {}
        Some(_) => {
            return Err(AppError::invalid_input(
                "Profile export data.assets must be a JSON array",
            ));
        }
        None => {
            return Err(AppError::invalid_input(
                "Native profile export is missing data.assets",
            ));
        }
    }
    for collection in contracts::profile_collections() {
        match collections.get(collection) {
            Some(Value::Array(_)) => {}
            Some(_) => {
                return Err(AppError::invalid_input(format!(
                    "Profile collection `{collection}` must be a JSON array"
                )));
            }
            None => {
                if collection == message_swipes::COLLECTION {
                    continue;
                }
                return Err(AppError::invalid_input(format!(
                    "Native profile export is missing collection `{collection}`"
                )));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
pub(super) fn import_profile_collections_with_restored_assets<F>(
    state: &AppState,
    collections: &Map<String, Value>,
    restored_assets: usize,
    install_assets: F,
) -> AppResult<Value>
where
    F: FnOnce() -> AppResult<()>,
{
    let mut progress = ProfileImportProgress::disabled();
    import_profile_collections_with_restored_assets_with_progress(
        state,
        collections,
        restored_assets,
        &mut progress,
        install_assets,
    )
}

pub(super) fn import_profile_collections_with_restored_assets_with_progress<F>(
    state: &AppState,
    collections: &Map<String, Value>,
    restored_assets: usize,
    progress: &mut ProfileImportProgress<'_>,
    install_assets: F,
) -> AppResult<Value>
where
    F: FnOnce() -> AppResult<()>,
{
    let plan = profile_collections_import_plan(
        state,
        collections,
        restored_assets,
        ProfileImportMode::Commit,
        progress,
    )?;
    progress.prepare("write", "Writing profile data")?;
    state
        .storage
        .replace_all_many_and_then(plan.replacements, install_assets)?;
    progress.advance_untracked_after_commit("write", "write", "Profile data written", 1);
    Ok(json!({ "success": true, "imported": plan.imported }))
}

fn profile_collections_import_plan(
    state: &AppState,
    collections: &Map<String, Value>,
    restored_assets: usize,
    mode: ProfileImportMode,
    progress: &mut ProfileImportProgress<'_>,
) -> AppResult<ProfileCollectionsImportPlan> {
    let mut imported = Map::new();
    let mut replacements = Vec::new();
    let mut unsupported_prompt_overrides = 0usize;
    if mode == ProfileImportMode::Commit {
        progress.begin(
            profile_collections_progress_total(collections, restored_assets),
            "collections",
            "Importing profile collections",
        )?;
        if restored_assets > 0 {
            progress.advance(
                "assets",
                "files",
                "Prepared profile assets",
                restored_assets,
            )?;
        }
    }
    for collection in contracts::profile_collections() {
        // A partial modern profile (a hand-built export, or a file missing a
        // collection) must not wipe collections it does not carry. Skipping the
        // replacement leaves the user's existing collection untouched; a
        // collection that is present but empty is still an explicit clear and
        // falls through to a normal empty replacement. Mirrors the legacy table
        // path guard added in #1518.
        let Some(collection_value) = collections.get(collection) else {
            continue;
        };
        // A present-but-non-array collection is malformed (e.g. `"characters": {}`).
        // Coercing it to an empty array would silently clear the collection - the
        // same data loss the absent-key skip above guards against. Reject the
        // import instead so nothing is replaced.
        if !collection_value.is_array() {
            return Err(AppError::invalid_input(format!(
                "Profile collection `{collection}` must be a JSON array"
            )));
        }
        let mut rows = collection_value.as_array().cloned().unwrap_or_default();
        let processed_rows = rows.len();
        if collection == "prompt-overrides" {
            unsupported_prompt_overrides = normalize_profile_prompt_overrides(&mut rows);
        }
        normalize_profile_json_fields(collection, &mut rows)?;
        if collection == "connections" {
            rows = normalize_profile_connection_rows(state, rows, mode)?;
        }
        if collection == "extensions" {
            disable_imported_extension_rows(&mut rows);
        }
        if collection == "regex-scripts" {
            drop_unsafe_regex_scripts(&mut rows);
        }
        imported.insert(collection.to_string(), json!(rows.len()));
        if mode == ProfileImportMode::Commit {
            progress.advance_counted(
                "collections",
                collection,
                profile_import_progress_label("Importing", collection),
                processed_rows,
                Some(rows.len()),
            )?;
        }
        replacements.push((collection, rows));
    }
    if collections.get("messages").is_some()
        && collections.get(message_swipes::COLLECTION).is_none()
    {
        imported.insert(message_swipes::COLLECTION.to_string(), json!(0));
        replacements.push((message_swipes::COLLECTION, Vec::new()));
    }
    normalize_message_swipe_replacements(&mut replacements, &mut imported)?;
    imported.insert("files".to_string(), json!(restored_assets));
    if unsupported_prompt_overrides > 0 {
        imported.insert(
            "unsupportedPromptOverrides".to_string(),
            json!(unsupported_prompt_overrides),
        );
    }
    insert_profile_import_aliases(&mut imported);
    Ok(ProfileCollectionsImportPlan {
        imported,
        replacements,
    })
}

fn profile_collections_progress_total(
    collections: &Map<String, Value>,
    restored_assets: usize,
) -> usize {
    let row_count = contracts::profile_collections()
        .filter_map(|collection| collections.get(collection).and_then(Value::as_array))
        .map(Vec::len)
        .sum::<usize>();
    restored_assets.saturating_add(row_count).saturating_add(1)
}

pub(super) fn profile_import_progress_label(prefix: &str, item: &str) -> String {
    format!("{prefix} {}", item.replace('-', " "))
}

fn normalize_profile_connection_rows(
    state: &AppState,
    rows: Vec<Value>,
    mode: ProfileImportMode,
) -> AppResult<Vec<Value>> {
    match mode {
        ProfileImportMode::Commit => rows
            .into_iter()
            .map(|row| connection_secrets::prepare_connection_for_create(state, row))
            .collect(),
        ProfileImportMode::Preview => {
            for row in &rows {
                if !row.is_object() {
                    return Err(AppError::invalid_input(
                        "Profile collection `connections` rows must be JSON objects",
                    ));
                }
            }
            Ok(rows)
        }
    }
}

pub(super) fn normalize_message_swipe_replacements(
    replacements: &mut Vec<(&'static str, Vec<Value>)>,
    imported: &mut Map<String, Value>,
) -> AppResult<()> {
    let Some(message_index) = replacements
        .iter()
        .position(|(collection, _)| *collection == "messages")
    else {
        return Ok(());
    };
    let sidecar_index = match replacements
        .iter()
        .position(|(collection, _)| *collection == message_swipes::COLLECTION)
    {
        Some(index) => index,
        None => {
            imported.insert(message_swipes::COLLECTION.to_string(), json!(0));
            replacements.push((message_swipes::COLLECTION, Vec::new()));
            replacements.len() - 1
        }
    };

    let messages = std::mem::take(&mut replacements[message_index].1);
    let sidecars = std::mem::take(&mut replacements[sidecar_index].1);
    let (messages, sidecars) =
        message_swipes::normalize_message_rows_and_sidecars(messages, sidecars)?;
    let sidecar_count = sidecars.len();
    replacements[message_index].1 = messages;
    replacements[sidecar_index].1 = sidecars;
    imported.insert(message_swipes::COLLECTION.to_string(), json!(sidecar_count));
    Ok(())
}

fn normalize_profile_json_fields(collection: &str, rows: &mut [Value]) -> AppResult<()> {
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        if collection == "characters" {
            match object.get("data") {
                Some(Value::Object(_)) => {}
                Some(Value::String(raw)) => {
                    let parsed = serde_json::from_str::<Value>(raw)
                        .ok()
                        .filter(Value::is_object)
                        .unwrap_or_else(|| json!({}));
                    object.insert("data".to_string(), parsed);
                }
                Some(_) | None => {
                    object.insert("data".to_string(), json!({}));
                }
            }
        } else {
            normalize_typed_json_fields(collection, object)?;
        }
    }
    Ok(())
}

/// Imported extensions must never auto-run their JavaScript. `CustomThemeInjector`
/// gates CSS/JS execution on the row's `enabled` flag, so an exported extension
/// carrying `enabled: true` would execute arbitrary JS on the next render with no
/// user opt-in. Force every imported extension row disabled so the JS/CSS only
/// runs after the user explicitly re-enables it in settings. Mirrors the
/// connection-secret redaction special-case in this same import loop (#2366).
pub(super) fn disable_imported_extension_rows(rows: &mut [Value]) {
    for row in rows {
        if let Some(object) = row.as_object_mut() {
            object.insert("enabled".to_string(), Value::Bool(false));
        }
    }
}

/// Drop regex-script rows whose `findRegex` is prone to catastrophic backtracking
/// (ReDoS). The profile-import path (modern `.marinara` envelopes and the legacy
/// SQLite path) writes rows verbatim, so this is the only guard before they reach
/// the runtime executors. Mirrors the TypeScript `isPatternSafe` chokepoint in
/// `regex-script-import.ts` (which already protects the ST character-card path).
pub(super) fn drop_unsafe_regex_scripts(rows: &mut Vec<Value>) {
    rows.retain(|row| match row.get("findRegex") {
        // Non-string or absent findRegex: leave the row alone; downstream
        // normalization / the editor handles malformed scripts. Only reject
        // string patterns that fail the safety heuristic.
        Some(Value::String(pattern)) => is_pattern_safe(pattern),
        _ => true,
    });
}

// Static ReDoS safety heuristic for user-supplied regex sources, ported from
// `src/engine/shared/regex/regex-safety.ts`. Catches the common catastrophic
// backtracking shapes — nested quantifiers like `(a+)+`, pathological `{n,m}`
// counts, and oversized sources — before the pattern is ever compiled.
const REGEX_SAFETY_MAX_LENGTH: usize = 1000;
const REGEX_SAFETY_MAX_STAR_HEIGHT: u32 = 1;
const REGEX_SAFETY_MAX_REPETITION: f64 = 100.0;

fn is_pattern_safe(source: &str) -> bool {
    if source.is_empty() {
        return true;
    }
    let chars: Vec<char> = source.chars().collect();
    if chars.len() > REGEX_SAFETY_MAX_LENGTH {
        return false;
    }

    let mut i = 0usize;
    let mut group_depth = 0i32;
    let mut group_inner_height: Vec<u32> = Vec::new();
    let mut top_level_height = 0u32;

    let record_atom_height = |height: u32,
                              group_depth: i32,
                              group_inner_height: &mut Vec<u32>,
                              top_level_height: &mut u32| {
        if group_depth > 0 {
            if let Some(last) = group_inner_height.last_mut() {
                if height > *last {
                    *last = height;
                }
            }
        } else if height > *top_level_height {
            *top_level_height = height;
        }
    };

    while i < chars.len() {
        let c = chars[i];

        if c == '\\' {
            // Escape: skip the next char (counts as one atom).
            if i + 1 >= chars.len() {
                return false; // Trailing backslash.
            }
            let after = chars.get(i + 2).copied();
            let quant_height = if is_quantifier_start(after) { 1 } else { 0 };
            record_atom_height(
                quant_height,
                group_depth,
                &mut group_inner_height,
                &mut top_level_height,
            );
            i += 2;
            if quant_height > 0 {
                match consume_quantifier(&chars, i) {
                    Some(next) => i = next,
                    None => return false,
                }
            }
            continue;
        }

        if c == '[' {
            let close_idx = match find_char_class_close(&chars, i) {
                Some(idx) => idx,
                None => return false,
            };
            let after = chars.get(close_idx + 1).copied();
            let quant_height = if is_quantifier_start(after) { 1 } else { 0 };
            record_atom_height(
                quant_height,
                group_depth,
                &mut group_inner_height,
                &mut top_level_height,
            );
            i = close_idx + 1;
            if quant_height > 0 {
                match consume_quantifier(&chars, i) {
                    Some(next) => i = next,
                    None => return false,
                }
            }
            continue;
        }

        if c == '(' {
            group_depth += 1;
            group_inner_height.push(0);
            if chars.get(i + 1).copied() == Some('?') {
                if chars.get(i + 2).copied() == Some('<')
                    && chars.get(i + 3).copied() != Some('=')
                    && chars.get(i + 3).copied() != Some('!')
                {
                    // Named capture (?<name>...).
                    match char_index_of(&chars, '>', i + 3) {
                        Some(close) => i = close + 1,
                        None => return false,
                    }
                } else {
                    i += 3; // (?: (?= (?! (?<= (?<!
                    if chars.get(i.wrapping_sub(1)).copied() == Some('<') {
                        i += 1;
                    }
                }
            } else {
                i += 1;
            }
            continue;
        }

        if c == ')' {
            let inner_height = group_inner_height.pop().unwrap_or(0);
            group_depth -= 1;
            let after = chars.get(i + 1).copied();
            let quantified = is_quantifier_start(after);
            let group_height = inner_height + if quantified { 1 } else { 0 };
            if group_height > REGEX_SAFETY_MAX_STAR_HEIGHT {
                return false;
            }
            record_atom_height(
                group_height,
                group_depth,
                &mut group_inner_height,
                &mut top_level_height,
            );
            i += 1;
            if quantified {
                match consume_quantifier(&chars, i) {
                    Some(next) => i = next,
                    None => return false,
                }
            }
            continue;
        }

        // Plain literal character: atom of height 0 unless quantified, then 1.
        let after = chars.get(i + 1).copied();
        let quant_height = if is_quantifier_start(after) { 1 } else { 0 };
        record_atom_height(
            quant_height,
            group_depth,
            &mut group_inner_height,
            &mut top_level_height,
        );
        i += 1;
        if quant_height > 0 {
            match consume_quantifier(&chars, i) {
                Some(next) => i = next,
                None => return false,
            }
        }
    }

    if group_depth != 0 {
        return false; // Unbalanced.
    }
    if top_level_height > REGEX_SAFETY_MAX_STAR_HEIGHT {
        return false;
    }
    true
}

fn is_quantifier_start(ch: Option<char>) -> bool {
    matches!(ch, Some('*') | Some('+') | Some('?') | Some('{'))
}

fn char_index_of(chars: &[char], needle: char, from: usize) -> Option<usize> {
    chars
        .iter()
        .enumerate()
        .skip(from)
        .find(|(_, c)| **c == needle)
        .map(|(idx, _)| idx)
}

/// Advance past a quantifier starting at `i`, validating `{n,m}` bounds.
/// Returns the new index, or `None` if invalid / over budget.
fn consume_quantifier(chars: &[char], i: usize) -> Option<usize> {
    match chars.get(i).copied() {
        Some('*') | Some('+') | Some('?') => {
            let next = chars.get(i + 1).copied();
            if next == Some('?') || next == Some('+') {
                Some(i + 2)
            } else {
                Some(i + 1)
            }
        }
        Some('{') => {
            let close = char_index_of(chars, '}', i + 1)?;
            let body: String = chars[i + 1..close].iter().collect();
            let (lo_str, upper_part) = match body.split_once(',') {
                Some((lo, hi)) => (lo, Some(hi)),
                None => (body.as_str(), None),
            };
            if lo_str.is_empty() || !lo_str.chars().all(|c| c.is_ascii_digit()) {
                return None;
            }
            let lo: f64 = lo_str.parse().ok()?;
            let hi: f64 = match upper_part {
                None => lo,
                Some("") => f64::INFINITY,
                Some(upper) => {
                    if !upper.chars().all(|c| c.is_ascii_digit()) {
                        return None;
                    }
                    upper.parse().ok()?
                }
            };
            if !lo.is_finite() || lo > REGEX_SAFETY_MAX_REPETITION {
                return None;
            }
            if !hi.is_finite() || hi > REGEX_SAFETY_MAX_REPETITION {
                return None;
            }
            let mut next = close + 1;
            if matches!(chars.get(next).copied(), Some('?') | Some('+')) {
                next += 1;
            }
            Some(next)
        }
        _ => Some(i),
    }
}

fn find_char_class_close(chars: &[char], open_idx: usize) -> Option<usize> {
    let mut j = open_idx + 1;
    if chars.get(j).copied() == Some('^') {
        j += 1;
    }
    if chars.get(j).copied() == Some(']') {
        j += 1; // Leading ] is literal.
    }
    while j < chars.len() {
        match chars[j] {
            '\\' => {
                j += 2;
                continue;
            }
            ']' => return Some(j),
            _ => j += 1,
        }
    }
    None
}

pub(super) fn normalize_profile_prompt_overrides(rows: &mut Vec<Value>) -> usize {
    let mut normalized = Vec::with_capacity(rows.len());
    let mut seen_keys = HashSet::new();
    let mut unsupported = 0usize;
    for mut row in rows.drain(..) {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let key = trimmed_profile_string(object.get("key"))
            .or_else(|| trimmed_profile_string(object.get("id")));
        let Some(key) = key else {
            continue;
        };
        if !prompt_overrides::is_supported_prompt_override_key(&key) {
            unsupported += 1;
            log::trace!("skipping unsupported prompt override key={key}");
            continue;
        }
        if trimmed_profile_string(object.get("template")).is_none() {
            unsupported += 1;
            log::trace!("skipping empty prompt override key={key}");
            continue;
        }
        if !seen_keys.insert(key.clone()) {
            unsupported += 1;
            log::trace!("skipping duplicate prompt override key={key}");
            continue;
        }
        object.insert("id".to_string(), Value::String(key.clone()));
        object.insert("key".to_string(), Value::String(key));
        normalize_legacy_text_bool_fields(&mut row, &["enabled"]);
        normalized.push(row);
    }
    *rows = normalized;
    unsupported
}

fn trimmed_profile_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn finish_profile_import_assets(
    restored_assets: RestoredProfileAssets,
    result: AppResult<Value>,
) -> AppResult<Value> {
    let warnings = restored_assets.warnings().to_vec();
    match result {
        Ok(mut value) => {
            restored_assets.commit();
            if !warnings.is_empty() {
                if let Some(object) = value.as_object_mut() {
                    object.insert("warnings".to_string(), Value::Array(warnings));
                }
            }
            Ok(value)
        }
        Err(error) => {
            if let Err(rollback_error) = restored_assets.rollback() {
                return Err(AppError::new(
                    "profile_import_rollback_failed",
                    format!(
                        "{error}; additionally failed to roll back profile assets: {rollback_error}"
                    ),
                ));
            }
            Err(error)
        }
    }
}

fn insert_profile_import_aliases(imported: &mut Map<String, Value>) {
    if let Some(value) = imported.get("prompts").cloned() {
        imported.insert("presets".to_string(), value);
    }
}

fn profile_collections(state: &AppState) -> AppResult<Map<String, Value>> {
    let mut collections = Map::new();
    for collection in contracts::profile_collections() {
        let rows = if collection == "connections" {
            connection_secrets::connections_for_export(state)?
        } else {
            state.storage.list(collection)?
        };
        collections.insert(collection.to_string(), Value::Array(rows));
    }
    Ok(collections)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-profile-import-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp profile dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    #[test]
    fn profile_file_import_emits_progress_events() {
        let state = test_state("progress-events");
        let path = state.data_dir.join("progress-profile.json");
        let mut collections = complete_empty_profile_collections();
        collections.insert(
            "characters".to_string(),
            json!([
                { "id": "progress-character-1", "name": "Progress 1" },
                { "id": "progress-character-2", "name": "Progress 2" }
            ]),
        );
        std::fs::write(
            &path,
            serde_json::to_vec(&json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": []
                }
            }))
            .expect("profile fixture should serialize"),
        )
        .expect("profile fixture should write");

        let mut events = Vec::new();
        let result = import_profile_file_with_preview_fingerprint_and_progress(
            &state,
            &path,
            None,
            |event| {
                events.push(event);
                Ok(())
            },
        )
        .expect("profile import should succeed");

        assert_eq!(result["success"], true);
        assert_eq!(result["imported"]["characters"], 2);
        let progress_events = events
            .iter()
            .filter(|event| event["type"].as_str() == Some("progress"))
            .collect::<Vec<_>>();
        assert!(
            progress_events.iter().any(|event| {
                event["data"]["item"].as_str() == Some("characters")
                    && event["data"]["imported"]["characters"].as_u64() == Some(2)
            }),
            "character progress event should include imported count"
        );
        let last = progress_events
            .last()
            .expect("profile import should emit progress events");
        assert_eq!(last["data"]["phase"], "write");
        assert_eq!(last["data"]["current"], last["data"]["total"]);
    }

    #[test]
    fn native_profile_import_ignores_post_commit_progress_delivery_failure() {
        let state = test_state("post-commit-progress-failure");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "old-character" })])
            .expect("old character fixture should write");

        let mut collections = complete_empty_profile_collections();
        collections.insert(
            "characters".to_string(),
            json!([{ "id": "post-commit-character", "name": "Post Commit" }]),
        );

        let mut saw_post_commit_write = false;
        let mut install_called = false;
        let mut progress = ProfileImportProgress::new(|event| {
            let data = &event["data"];
            if data["phase"].as_str() == Some("write") && data["item"].as_str() == Some("write") {
                saw_post_commit_write = true;
                return Err(AppError::new(
                    "profile_import_event_error",
                    "progress receiver closed",
                ));
            }
            Ok(())
        });

        let result = import_profile_collections_with_restored_assets_with_progress(
            &state,
            &collections,
            0,
            &mut progress,
            || {
                install_called = true;
                Ok(())
            },
        )
        .expect("post-commit progress failure should not fail import");
        drop(progress);

        assert!(install_called);
        assert!(saw_post_commit_write);
        assert_eq!(result["success"], true);
        assert_eq!(
            state.storage.list("characters").unwrap()[0]["id"],
            "post-commit-character"
        );
    }

    #[test]
    fn profile_import_rolls_back_collections_when_asset_install_fails() {
        let state = test_state("asset-install-fails");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "old-character" })])
            .unwrap();

        let mut collections = Map::new();
        collections.insert("characters".to_string(), json!([{ "id": "new-character" }]));

        let error =
            import_profile_collections_with_restored_assets(&state, &collections, 0, || {
                Err(AppError::new(
                    "asset_install_failed",
                    "asset install failed",
                ))
            })
            .expect_err("asset install failure should reject the import");

        assert_eq!(error.code, "asset_install_failed");
        assert_eq!(
            state.storage.list("characters").unwrap()[0]["id"],
            "old-character"
        );
    }

    #[test]
    fn native_profile_import_rejects_missing_assets_without_wiping_existing_assets() {
        let state = test_state("missing-assets-no-wipe");
        let avatar_dir = state.data_dir.join("avatars");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        std::fs::write(avatar_dir.join("keep.png"), b"keep").expect("avatar fixture should write");
        let collections = complete_empty_profile_collections();

        let error = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections
                }
            }),
        )
        .expect_err("native profile missing data.assets should be rejected");

        assert_eq!(error.code, "invalid_input");
        assert_eq!(
            std::fs::read(avatar_dir.join("keep.png")).expect("avatar should remain"),
            b"keep"
        );
    }

    #[test]
    fn native_profile_import_rejects_missing_collection_without_wiping_existing_rows() {
        let state = test_state("missing-collection-no-wipe");
        state
            .storage
            .upsert_with_id(
                "characters",
                "char-1",
                json!({ "name": "Keep Me", "data": { "name": "Keep Me" } }),
            )
            .expect("seeded character should write");
        let mut collections = complete_empty_profile_collections();
        collections.remove("characters");

        let error = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": []
                }
            }),
        )
        .expect_err("native profile missing a collection should be rejected");

        assert_eq!(error.code, "invalid_input");
        assert!(state
            .storage
            .get("characters", "char-1")
            .expect("character lookup should not fail")
            .is_some());
    }

    #[test]
    fn native_profile_import_rejects_bad_swipes_without_wiping_existing_rows() {
        let state = test_state("bad-message-swipes-no-wipe");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "old-message",
                    "chatId": "old-chat",
                    "content": "old content"
                })],
            )
            .expect("old message should seed");
        let mut collections = complete_empty_profile_collections();
        collections.insert(
            "messages".to_string(),
            json!([{
                "id": "new-message",
                "chatId": "new-chat",
                "role": "assistant",
                "content": "fresh import",
                "activeSwipeIndex": 0,
                "swipes": [{ "content": "bad swipe", "extra": "not json" }]
            }]),
        );

        let error = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": []
                }
            }),
        )
        .expect_err("bad nested swipe should reject before import commit");

        assert_eq!(error.code, "invalid_input");
        assert!(state
            .storage
            .get("messages", "old-message")
            .expect("old message lookup should not fail")
            .is_some());
        assert!(state
            .storage
            .get("messages", "new-message")
            .expect("new message lookup should not fail")
            .is_none());
    }

    #[test]
    fn native_profile_import_warns_for_json_manifest_assets_without_payload() {
        let state = test_state("json-manifest-missing-assets");
        let avatar_dir = state.data_dir.join("avatars");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        std::fs::write(avatar_dir.join("keep.png"), b"keep").expect("avatar fixture should write");
        let mut collections = complete_empty_profile_collections();
        collections.insert(
            "characters".to_string(),
            json!([{ "id": "char-1", "name": "Hero", "data": {} }]),
        );

        let result = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": [{ "path": "avatars/char-1.png", "size": 12 }]
                }
            }),
        )
        .expect("JSON-only profile should import data and warn about missing assets");

        assert_eq!(result["success"], true);
        assert_eq!(result["imported"]["characters"], 1);
        assert_eq!(result["imported"]["files"], 0);
        assert_eq!(result["warnings"][0]["type"], "missing_asset");
        assert_eq!(result["warnings"][0]["path"], "avatars/char-1.png");
        assert!(state
            .storage
            .get("characters", "char-1")
            .expect("character lookup should not fail")
            .is_some());
        assert!(!avatar_dir.join("keep.png").exists());
    }

    #[test]
    fn native_profile_import_without_message_swipes_clears_stale_sidecars() {
        let state = test_state("missing-message-swipes-clears-stale");
        state
            .storage
            .replace_all(
                message_swipes::COLLECTION,
                vec![json!({
                    "id": "message-1::swipe::0",
                    "chatId": "old-chat",
                    "messageId": "message-1",
                    "index": 0,
                    "content": "stale private sidecar"
                })],
            )
            .expect("stale sidecar should seed");
        let mut collections = complete_empty_profile_collections();
        collections.remove(message_swipes::COLLECTION);
        collections.insert(
            "messages".to_string(),
            json!([{
                "id": "message-1",
                "chatId": "new-chat",
                "role": "assistant",
                "content": "fresh import",
                "activeSwipeIndex": 0
            }]),
        );

        import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": []
                }
            }),
        )
        .expect("old native profile without message-swipes should import");

        assert!(state
            .storage
            .list(message_swipes::COLLECTION)
            .expect("message swipes should list")
            .is_empty());
        let mut message = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should not fail")
            .expect("message should import");
        message_swipes::materialize_message(&state, &mut message, true)
            .expect("message should materialize");
        assert_eq!(message["content"], "fresh import");
        assert!(message.get("swipes").is_none());
    }

    #[test]
    fn legacy_profile_import_without_message_swipes_clears_stale_sidecars() {
        let state = test_state("legacy-missing-message-swipes-clears-stale");
        state
            .storage
            .replace_all(
                message_swipes::COLLECTION,
                vec![json!({
                    "id": "message-1::swipe::0",
                    "chatId": "old-chat",
                    "messageId": "message-1",
                    "index": 0,
                    "content": "stale legacy sidecar"
                })],
            )
            .expect("stale sidecar should seed");

        import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "fileStorage": {
                        "tables": {
                            "messages": [{
                                "id": "message-1",
                                "chatId": "new-chat",
                                "role": "assistant",
                                "content": "fresh legacy import",
                                "activeSwipeIndex": 0
                            }]
                        }
                    }
                }
            }),
        )
        .expect("legacy profile without message_swipes should import");

        assert!(state
            .storage
            .list(message_swipes::COLLECTION)
            .expect("message swipes should list")
            .is_empty());
        let mut message = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should not fail")
            .expect("message should import");
        message_swipes::materialize_message(&state, &mut message, true)
            .expect("message should materialize");
        assert_eq!(message["content"], "fresh legacy import");
        assert!(message.get("swipes").is_none());
    }

    #[test]
    fn legacy_profile_import_rejects_bad_swipes_without_wiping_existing_rows() {
        let state = test_state("legacy-bad-message-swipes-no-wipe");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "old-message",
                    "chatId": "old-chat",
                    "content": "old content"
                })],
            )
            .expect("old message should seed");

        let error = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "fileStorage": {
                        "tables": {
                            "messages": [{
                                "id": "new-message",
                                "chatId": "new-chat",
                                "role": "assistant",
                                "content": "fresh legacy import",
                                "activeSwipeIndex": 0
                            }],
                            "message_swipes": [{
                                "messageId": "new-message",
                                "index": 0,
                                "content": "bad legacy swipe",
                                "extra": "not json"
                            }]
                        }
                    }
                }
            }),
        )
        .expect_err("bad legacy swipe should reject before import commit");

        assert_eq!(error.code, "invalid_input");
        assert!(state
            .storage
            .get("messages", "old-message")
            .expect("old message lookup should not fail")
            .is_some());
        assert!(state
            .storage
            .get("messages", "new-message")
            .expect("new message lookup should not fail")
            .is_none());
    }

    #[test]
    fn legacy_profile_import_without_files_preserves_existing_assets() {
        let state = test_state("legacy-missing-files-preserves-assets");
        let avatar_dir = state.data_dir.join("avatars");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        std::fs::write(avatar_dir.join("keep.png"), b"keep").expect("avatar fixture should write");

        import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "fileStorage": {
                        "tables": {
                            "chats": []
                        }
                    }
                }
            }),
        )
        .expect("legacy profile without files should import partial tables");

        assert_eq!(
            std::fs::read(avatar_dir.join("keep.png")).expect("avatar should remain"),
            b"keep"
        );
    }

    #[test]
    fn profile_import_native_reports_source_format_metadata() {
        let state = test_state("native-source-format");
        let result = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": complete_empty_profile_collections(),
                    "assets": []
                }
            }),
        )
        .expect("native profile import should succeed");

        assert_eq!(result["success"], true);
        assert_eq!(result["sourceFormat"], "refactor-native");
        assert_eq!(result["converted"]["applied"], false);
    }

    #[test]
    fn profile_import_legacy_file_storage_reports_source_format_metadata() {
        let state = test_state("legacy-file-storage-source-format");
        let result = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "fileStorage": {
                        "tables": {
                            "chats": []
                        }
                    }
                }
            }),
        )
        .expect("legacy fileStorage profile import should succeed");

        assert_eq!(result["success"], true);
        assert_eq!(result["sourceFormat"], "legacy-modern-fileStorage");
        assert_eq!(result["converted"]["applied"], true);
        assert_eq!(result["converted"]["from"], "legacy-modern-fileStorage");
        assert_eq!(result["converted"]["to"], "refactor-collections");
    }

    #[test]
    fn profile_import_legacy_array_imports_direct_arrays() {
        let state = test_state("legacy-array-direct");
        let result = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "characters": [{
                        "id": "char-1",
                        "name": "Hero",
                        "data": "{\"name\":\"Hero\"}",
                        "avatarBase64": "aGVybw=="
                    }],
                    "personas": [{
                        "id": "persona-1",
                        "name": "Player",
                        "avatarBase64": "cGxheWVy"
                    }],
                    "lorebooks": [{
                        "id": "lorebook-1",
                        "name": "Book",
                        "entries": [{
                            "id": "entry-1",
                            "keys": "[\"key\"]",
                            "enabled": "true"
                        }],
                        "folders": [{
                            "id": "folder-1",
                            "name": "Folder"
                        }]
                    }],
                    "presets": [{
                        "id": "preset-1",
                        "name": "Preset",
                        "groups": [{
                            "id": "group-1",
                            "name": "Group"
                        }],
                        "sections": [{
                            "id": "section-1",
                            "name": "Section"
                        }],
                        "choices": [{
                            "id": "choice-1",
                            "name": "Choice"
                        }]
                    }],
                    "agents": [{
                        "id": "agent-1",
                        "name": "Agent",
                        "type": "custom-agent",
                        "settings": {}
                    }],
                    "themes": [{
                        "id": "theme-1",
                        "name": "Theme"
                    }]
                }
            }),
        )
        .expect("legacy array profile import should succeed");

        assert_eq!(result["success"], true);
        assert_eq!(result["sourceFormat"], "legacy-array");
        assert_eq!(result["converted"]["applied"], true);
        assert_eq!(result["converted"]["from"], "legacy-array");
        assert_eq!(result["imported"]["characters"], 1);
        assert_eq!(result["imported"]["personas"], 1);
        assert_eq!(result["imported"]["lorebooks"], 1);
        assert_eq!(result["imported"]["lorebook-entries"], 1);
        assert_eq!(result["imported"]["lorebook-folders"], 1);
        assert_eq!(result["imported"]["presets"], 1);
        assert_eq!(result["imported"]["prompt-groups"], 1);
        assert_eq!(result["imported"]["prompt-sections"], 1);
        assert_eq!(result["imported"]["prompt-variables"], 1);
        assert_eq!(result["imported"]["agents"], 1);
        assert_eq!(result["imported"]["themes"], 1);

        let character = state
            .storage
            .get("characters", "char-1")
            .expect("character lookup should not fail")
            .expect("character should import");
        assert_eq!(character["data"]["name"], "Hero");
        assert!(character["avatarPath"]
            .as_str()
            .expect("avatar path should be a string")
            .starts_with("data:image/png;base64,"));
        let entry = state
            .storage
            .get("lorebook-entries", "entry-1")
            .expect("entry lookup should not fail")
            .expect("entry should import");
        assert_eq!(entry["lorebookId"], "lorebook-1");
        assert_eq!(entry["keys"][0], "key");
        let section = state
            .storage
            .get("prompt-sections", "section-1")
            .expect("section lookup should not fail")
            .expect("section should import");
        assert_eq!(section["presetId"], "preset-1");
    }

    #[test]
    fn profile_import_legacy_array_restores_top_level_assets_manifest() {
        let state = test_state("legacy-array-top-level-assets");
        let result = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "characters": [],
                    "assets": [{
                        "path": "avatars/legacy-array-asset.png",
                        "base64": "aGVybw=="
                    }]
                }
            }),
        )
        .expect("legacy array import should restore data.assets payloads");

        assert_eq!(result["success"], true);
        assert_eq!(result["sourceFormat"], "legacy-array");
        assert_eq!(result["imported"]["files"], 1);
        assert_eq!(
            std::fs::read(
                state
                    .data_dir
                    .join("avatars")
                    .join("legacy-array-asset.png")
            )
            .expect("restored legacy array asset should exist"),
            b"hero"
        );
    }

    #[test]
    fn profile_import_legacy_array_rejects_non_array_without_wiping() {
        let state = test_state("legacy-array-reject-no-wipe");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "existing-character" })])
            .expect("existing character should seed");

        let error = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "characters": {}
                }
            }),
        )
        .expect_err("non-array legacy field should reject");

        assert_eq!(error.code, "invalid_input");
        let details = error
            .details
            .expect("legacy array error should include details");
        assert_eq!(details["sourceFormat"], "invalid-legacy-array");
        assert_eq!(details["field"], "characters");
        assert!(state
            .storage
            .get("characters", "existing-character")
            .expect("character lookup should not fail")
            .is_some());
    }

    #[test]
    fn profile_import_legacy_array_generates_parent_ids_for_nested_children() {
        let state = test_state("legacy-array-generated-parent-ids");
        let result = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "lorebooks": [{
                        "id": "",
                        "name": "Generated Book",
                        "entries": [{
                            "id": "entry-generated",
                            "keys": "[\"generated\"]",
                            "enabled": "true"
                        }],
                        "folders": [{
                            "id": "folder-generated",
                            "name": "Generated Folder"
                        }]
                    }],
                    "presets": [{
                        "name": "Generated Preset",
                        "groups": [{
                            "id": "group-generated",
                            "name": "Generated Group"
                        }],
                        "sections": [{
                            "id": "section-generated",
                            "name": "Generated Section"
                        }],
                        "choices": [{
                            "id": "choice-generated",
                            "name": "Generated Choice"
                        }]
                    }]
                }
            }),
        )
        .expect("legacy array profile import should generate parent ids");

        assert_eq!(result["success"], true);
        let lorebook = state
            .storage
            .list("lorebooks")
            .expect("lorebooks should list")
            .pop()
            .expect("lorebook should import");
        let lorebook_id = lorebook["id"]
            .as_str()
            .filter(|id| !id.trim().is_empty())
            .expect("lorebook should receive an id");
        let entry = state
            .storage
            .get("lorebook-entries", "entry-generated")
            .expect("entry lookup should not fail")
            .expect("entry should import");
        assert_eq!(entry["lorebookId"], lorebook_id);
        let folder = state
            .storage
            .get("lorebook-folders", "folder-generated")
            .expect("folder lookup should not fail")
            .expect("folder should import");
        assert_eq!(folder["lorebookId"], lorebook_id);

        let preset = state
            .storage
            .list("prompts")
            .expect("prompts should list")
            .pop()
            .expect("preset should import");
        let preset_id = preset["id"]
            .as_str()
            .filter(|id| !id.trim().is_empty())
            .expect("preset should receive an id");
        let group = state
            .storage
            .get("prompt-groups", "group-generated")
            .expect("group lookup should not fail")
            .expect("group should import");
        assert_eq!(group["presetId"], preset_id);
        let section = state
            .storage
            .get("prompt-sections", "section-generated")
            .expect("section lookup should not fail")
            .expect("section should import");
        assert_eq!(section["presetId"], preset_id);
        let choice = state
            .storage
            .get("prompt-variables", "choice-generated")
            .expect("choice lookup should not fail")
            .expect("choice should import");
        assert_eq!(choice["presetId"], preset_id);
    }

    #[test]
    fn profile_import_legacy_array_empty_parents_clear_nested_tables() {
        let state = test_state("legacy-array-clear-nested");
        state
            .storage
            .replace_all(
                "lorebook-entries",
                vec![json!({ "id": "stale-entry", "lorebookId": "old-book" })],
            )
            .expect("stale lorebook entry should seed");
        state
            .storage
            .replace_all(
                "prompt-sections",
                vec![json!({ "id": "stale-section", "presetId": "old-preset" })],
            )
            .expect("stale prompt section should seed");

        let result = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "lorebooks": [],
                    "presets": []
                }
            }),
        )
        .expect("empty legacy parent arrays should import");

        assert_eq!(result["success"], true);
        assert_eq!(result["imported"]["lorebooks"], 0);
        assert_eq!(result["imported"]["lorebook-entries"], 0);
        assert_eq!(result["imported"]["presets"], 0);
        assert_eq!(result["imported"]["prompt-sections"], 0);
        assert!(state
            .storage
            .list("lorebook-entries")
            .expect("lorebook entries should list")
            .is_empty());
        assert!(state
            .storage
            .list("prompt-sections")
            .expect("prompt sections should list")
            .is_empty());
    }

    #[test]
    fn profile_import_unknown_reports_expected_formats() {
        let state = test_state("unknown-source-format");
        let error = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {}
            }),
        )
        .expect_err("unknown profile shape should reject");

        assert_eq!(error.code, "invalid_input");
        let details = error
            .details
            .expect("unknown profile error should include details");
        assert_eq!(details["sourceFormat"], "unknown");
        assert_eq!(details["expectedFormats"][0], "refactor-native");
        assert_eq!(details["expectedFormats"][1], "legacy-modern-fileStorage");
        assert_eq!(details["expectedFormats"][2], "legacy-array");
    }

    fn complete_empty_profile_collections() -> Map<String, Value> {
        contracts::profile_collections()
            .map(|collection| (collection.to_string(), json!([])))
            .collect()
    }

    #[test]
    fn profile_import_prompts_normalizes_default_alias() {
        let state = test_state("profile-prompt-default-alias");
        let mut collections = complete_empty_profile_collections();
        collections.insert(
            "prompts".to_string(),
            json!([{
                "id": "profile-preset",
                "name": "Profile Default Alias Preset",
                "default": "true"
            }]),
        );

        import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": []
                }
            }),
        )
        .expect("profile import should normalize prompt default aliases");

        let preset = state
            .storage
            .get("prompts", "profile-preset")
            .expect("prompt preset should be readable")
            .expect("prompt preset should import");
        assert_eq!(preset["isDefault"], json!(true));
        assert!(preset.get("default").is_none());
    }

    #[test]
    fn profile_import_prompts_rejects_conflicting_default_flags_without_wiping() {
        let state = test_state("profile-prompt-default-conflict");
        state
            .storage
            .create(
                "prompts",
                json!({
                    "id": "existing-preset",
                    "name": "Existing Preset"
                }),
            )
            .expect("existing prompt preset should write");
        let mut collections = complete_empty_profile_collections();
        collections.insert(
            "prompts".to_string(),
            json!([{
                "id": "conflicting-preset",
                "name": "Conflicting Profile Preset",
                "isDefault": false,
                "default": true
            }]),
        );

        let error = import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": []
                }
            }),
        )
        .expect_err("conflicting prompt default flags should reject profile import");

        assert_eq!(error.code, "invalid_input");
        assert!(
            error.message.contains("default") && error.message.contains("isDefault"),
            "unexpected error message: {}",
            error.message
        );
        assert!(state
            .storage
            .get("prompts", "existing-preset")
            .expect("existing prompt preset should be readable")
            .is_some());
        assert!(state
            .storage
            .get("prompts", "conflicting-preset")
            .expect("conflicting prompt preset lookup should not fail")
            .is_none());
    }

    #[test]
    fn profile_import_collections_normalizes_prompt_overrides() {
        let state = test_state("prompt-overrides-normalize");
        let mut collections = Map::new();
        collections.insert(
            "prompt-overrides".to_string(),
            json!([
                {
                    "id": "conversation.selfie.blank",
                    "key": "conversation.selfie",
                    "template": "   ",
                    "enabled": "true"
                },
                {
                    "id": "conversation.selfie",
                    "key": "conversation.selfie",
                    "template": "Selfie ${charName}",
                    "enabled": "true"
                },
                {
                    "id": "conversation.selfie",
                    "key": "conversation.selfie",
                    "template": "Duplicate ${charName}",
                    "enabled": "true"
                },
                {
                    "id": "game.background",
                    "key": "game.background",
                    "template": "Background ${defaultPrompt}",
                    "enabled": "true"
                },
                {
                    "id": "sprite.portraitSingle",
                    "key": "sprite.portraitSingle",
                    "template": "Sprite ${defaultPrompt}",
                    "enabled": "true"
                },
                {
                    "id": "game.unknown",
                    "key": "game.unknown",
                    "template": "Unknown ${defaultPrompt}",
                    "enabled": "true"
                }
            ]),
        );

        let result =
            import_profile_collections_with_restored_assets(&state, &collections, 0, || Ok(()))
                .expect("native profile import should normalize prompt overrides");

        let rows = state
            .storage
            .list("prompt-overrides")
            .expect("prompt overrides should be readable");
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0]["id"], "conversation.selfie");
        assert_eq!(rows[0]["key"], "conversation.selfie");
        assert_eq!(rows[0]["template"], "Selfie ${charName}");
        assert_eq!(rows[0]["enabled"], true);
        assert_eq!(rows[1]["id"], "game.background");
        assert_eq!(rows[1]["key"], "game.background");
        assert_eq!(rows[1]["template"], "Background ${defaultPrompt}");
        assert_eq!(rows[2]["id"], "sprite.portraitSingle");
        assert_eq!(rows[2]["key"], "sprite.portraitSingle");
        assert_eq!(rows[2]["template"], "Sprite ${defaultPrompt}");
        assert_eq!(rows[2]["enabled"], true);
        assert_eq!(result["imported"]["prompt-overrides"], 3);
        assert_eq!(result["imported"]["unsupportedPromptOverrides"], 3);
    }

    #[test]
    fn profile_import_modern_skips_absent_collections() {
        let state = test_state("modern-skip-absent");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "existing-character" })])
            .unwrap();

        // A partial modern profile that only carries `lorebooks` must leave the
        // absent `characters` collection untouched instead of wiping it.
        let mut collections = Map::new();
        collections.insert(
            "lorebooks".to_string(),
            json!([{ "id": "imported-lorebook" }]),
        );

        let result =
            import_profile_collections_with_restored_assets(&state, &collections, 0, || Ok(()))
                .expect("partial modern profile import should succeed");

        let characters = state.storage.list("characters").unwrap();
        assert_eq!(characters.len(), 1);
        assert_eq!(characters[0]["id"], "existing-character");
        let lorebooks = state.storage.list("lorebooks").unwrap();
        assert_eq!(lorebooks.len(), 1);
        assert_eq!(lorebooks[0]["id"], "imported-lorebook");
        // Absent collections are not reported as imported.
        assert!(result["imported"].get("characters").is_none());
        assert_eq!(result["imported"]["lorebooks"], 1);
    }

    #[test]
    fn profile_import_modern_present_empty_collection_clears() {
        let state = test_state("modern-present-empty-clears");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "existing-character" })])
            .unwrap();

        // An explicitly present-but-empty collection is still a deliberate clear.
        let mut collections = Map::new();
        collections.insert("characters".to_string(), json!([]));

        import_profile_collections_with_restored_assets(&state, &collections, 0, || Ok(()))
            .expect("present-but-empty collection should clear");

        assert!(state.storage.list("characters").unwrap().is_empty());
    }

    #[test]
    fn profile_import_modern_rejects_non_array_collection() {
        let state = test_state("modern-reject-non-array");
        state
            .storage
            .replace_all("characters", vec![json!({ "id": "existing-character" })])
            .unwrap();

        // A present-but-non-array collection is malformed and must be rejected
        // before anything is replaced, so existing data is preserved.
        let mut collections = Map::new();
        collections.insert("characters".to_string(), json!({}));

        let error =
            import_profile_collections_with_restored_assets(&state, &collections, 0, || Ok(()))
                .expect_err("a non-array collection should be rejected");
        assert_eq!(error.code, "invalid_input");

        let characters = state.storage.list("characters").unwrap();
        assert_eq!(characters.len(), 1);
        assert_eq!(characters[0]["id"], "existing-character");
    }

    #[test]
    fn profile_export_import_preserves_connection_folders() {
        let source = test_state("connection-folders-export-source");
        source
            .storage
            .upsert_with_id(
                "connection-folders",
                "folder-1",
                json!({
                    "id": "folder-1",
                    "name": "Providers",
                    "color": "#38bdf8",
                    "sortOrder": 2,
                    "collapsed": true
                }),
            )
            .expect("connection folder should write");
        source
            .storage
            .upsert_with_id(
                "connections",
                "conn-1",
                connection_secrets::prepare_connection_for_create(
                    &source,
                    json!({
                        "id": "conn-1",
                        "name": "OpenAI",
                        "provider": "openai",
                        "model": "gpt-4.1",
                        "folderId": "folder-1",
                        "sortOrder": 7,
                        "apiKey": "sk-export-secret"
                    }),
                )
                .expect("connection secret should encrypt"),
            )
            .expect("connection should write");

        let snapshot = profile_snapshot(&source).expect("profile snapshot should export");
        assert_eq!(
            snapshot["data"]["collections"]["connection-folders"][0]["id"],
            "folder-1"
        );
        assert_eq!(
            snapshot["data"]["collections"]["connections"][0]["folderId"],
            "folder-1"
        );
        assert_eq!(
            snapshot["data"]["collections"]["connections"][0]["apiKey"],
            connection_secrets::API_KEY_MASK
        );
        assert_eq!(
            snapshot["data"]["collections"]["connections"][0]["hasApiKey"],
            true
        );
        assert!(snapshot["data"]["collections"]["connections"][0]
            .get("apiKeyEncrypted")
            .is_none());

        let target = test_state("connection-folders-export-target");
        import_profile(&target, snapshot).expect("native profile import should succeed");

        let folder = target
            .storage
            .get("connection-folders", "folder-1")
            .expect("connection folder lookup should not fail")
            .expect("imported connection folder should exist");
        assert_eq!(folder["name"], "Providers");
        assert_eq!(folder["collapsed"], true);

        let connection = target
            .storage
            .get("connections", "conn-1")
            .expect("connection lookup should not fail")
            .expect("imported connection should exist");
        assert_eq!(connection["folderId"], "folder-1");
        assert_eq!(connection["sortOrder"], 7);
        assert!(connection.get("apiKey").is_none());
        assert!(connection.get("apiKeyEncrypted").is_none());
    }

    #[test]
    fn profile_export_supports_compatible_and_zip_formats() {
        let state = test_state("profile-export-formats");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "character-1",
                    "data": {
                        "name": "Bundle Character"
                    }
                }),
            )
            .expect("fixture character should write");

        let compatible = profile_call(
            &state,
            "GET",
            &["export"],
            &ParsedPath::new("/profile/export?format=compatible"),
            Value::Null,
        )
        .expect("compatible profile export should succeed");
        assert_eq!(compatible["filename"], "marinara-compatible-export.zip");
        assert_eq!(compatible["contentType"], "application/zip");
        assert!(compatible["base64"].as_str().unwrap_or_default().len() > 16);

        let zip = profile_call(
            &state,
            "GET",
            &["export"],
            &ParsedPath::new("/profile/export?format=zip"),
            Value::Null,
        )
        .expect("profile ZIP export should succeed");
        assert_eq!(zip["filename"], "marinara-profile.zip");
        assert_eq!(zip["contentType"], "application/zip");
        assert!(zip["base64"].as_str().unwrap_or_default().len() > 16);
    }

    #[test]
    fn profile_upload_import_accepts_json_payloads() {
        let state = test_state("profile-upload-json");
        let envelope = json!({
            "type": "marinara_profile",
            "version": 1,
            "data": {
                "fileStorage": {
                    "tables": {
                        "chats": [
                            {
                                "id": "chat-1",
                                "name": "Uploaded Chat",
                                "mode": "conversation",
                                "metadata": {},
                                "characterIds": []
                            }
                        ]
                    }
                }
            }
        });
        let base64 = base64::Engine::encode(
            &general_purpose::STANDARD,
            serde_json::to_vec(&envelope).unwrap(),
        );

        let result = import_profile_upload(&state, "profile.json", &base64)
            .expect("uploaded profile JSON should import");

        assert_eq!(result["success"], true);
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat lookup should not fail")
            .expect("uploaded chat should import");
        assert_eq!(chat["name"], "Uploaded Chat");
    }

    #[test]
    fn profile_import_preview_reports_counts_without_writing() {
        let state = test_state("profile-preview-no-write");
        let preview = preview_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "characters": [{
                        "id": "preview-char",
                        "name": "Preview Character",
                        "data": "{\"name\":\"Preview Character\"}"
                    }],
                    "presets": [{
                        "id": "preview-preset",
                        "name": "Preview Preset",
                        "sections": [{
                            "id": "preview-section",
                            "name": "Section"
                        }]
                    }]
                }
            }),
        )
        .expect("legacy array preview should succeed");

        assert_eq!(preview["success"], true);
        assert_eq!(preview["preview"], true);
        assert_eq!(preview["sourceFormat"], "legacy-array");
        assert_eq!(preview["converted"]["applied"], true);
        assert_eq!(preview["imported"]["characters"], 1);
        assert_eq!(preview["imported"]["presets"], 1);
        assert_eq!(preview["imported"]["prompt-sections"], 1);
        assert!(state
            .storage
            .get("characters", "preview-char")
            .expect("character lookup should not fail")
            .is_none());
    }

    #[test]
    fn profile_import_preview_warns_for_json_manifest_assets_without_payload() {
        let state = test_state("profile-preview-missing-json-asset");
        let mut collections = complete_empty_profile_collections();
        collections.insert(
            "characters".to_string(),
            json!([{ "id": "char-1", "name": "Hero", "data": {} }]),
        );

        let preview = preview_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": [{ "path": "avatars/char-1.png", "size": 12 }]
                }
            }),
        )
        .expect("preview should preserve profile data and warn about missing asset data");

        assert_eq!(preview["success"], true);
        assert_eq!(preview["preview"], true);
        assert_eq!(preview["sourceFormat"], "refactor-native");
        assert_eq!(preview["imported"]["characters"], 1);
        assert_eq!(preview["imported"]["files"], 0);
        assert_eq!(preview["warnings"][0]["type"], "missing_asset");
        assert_eq!(preview["warnings"][0]["path"], "avatars/char-1.png");
        assert!(state
            .storage
            .get("characters", "char-1")
            .expect("character lookup should not fail")
            .is_none());
    }

    #[test]
    fn profile_import_preview_rejects_invalid_inline_asset_data_without_writing() {
        let state = test_state("profile-preview-invalid-asset-data");
        let collections = complete_empty_profile_collections();

        let error = preview_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": [{
                        "path": "avatars/bad-inline.png",
                        "base64": "not valid base64"
                    }]
                }
            }),
        )
        .expect_err("preview should reject invalid inline profile asset data");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("Invalid profile asset data"));
        assert!(!state
            .data_dir
            .join("avatars")
            .join("bad-inline.png")
            .exists());
    }

    #[test]
    fn profile_import_preview_counts_connections_without_creating_secret_key() {
        let state = test_state("profile-preview-connection-no-secret-write");
        let mut collections = complete_empty_profile_collections();
        collections.insert(
            "connections".to_string(),
            json!([{
                "id": "preview-connection",
                "name": "Preview Connection",
                "provider": "openai",
                "apiKey": "preview-secret"
            }]),
        );

        let preview = preview_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "collections": collections,
                    "assets": []
                }
            }),
        )
        .expect("preview should count connection rows without committing secrets");

        assert_eq!(preview["success"], true);
        assert_eq!(preview["preview"], true);
        assert_eq!(preview["imported"]["connections"], 1);
        assert!(state
            .storage
            .get("connections", "preview-connection")
            .expect("connection lookup should not fail")
            .is_none());
        assert!(!state
            .data_dir
            .join("secrets")
            .join("connection-master.key")
            .exists());
    }

    #[test]
    fn profile_upload_preview_accepts_json_payloads_without_writing() {
        let state = test_state("profile-upload-preview-json");
        let envelope = json!({
            "type": "marinara_profile",
            "version": 1,
            "data": {
                "fileStorage": {
                    "tables": {
                        "chats": [
                            {
                                "id": "chat-preview",
                                "name": "Preview Chat",
                                "mode": "conversation",
                                "metadata": {},
                                "characterIds": []
                            }
                        ]
                    }
                }
            }
        });
        let base64 = base64::Engine::encode(
            &general_purpose::STANDARD,
            serde_json::to_vec(&envelope).unwrap(),
        );

        let preview = preview_profile_upload(&state, "profile.json", &base64)
            .expect("uploaded profile JSON preview should succeed");

        assert_eq!(preview["success"], true);
        assert_eq!(preview["preview"], true);
        assert_eq!(preview["sourceFormat"], "legacy-modern-fileStorage");
        assert_eq!(preview["imported"]["chats"], 1);
        assert!(state
            .storage
            .get("chats", "chat-preview")
            .expect("chat lookup should not fail")
            .is_none());
    }

    #[test]
    fn profile_file_import_rejects_file_changed_after_preview() {
        let state = test_state("profile-file-preview-changed");
        let path = state.data_dir.join("profile.json");
        std::fs::write(
            &path,
            serde_json::to_vec(&json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "characters": [{
                        "id": "preview-character",
                        "name": "Preview Character"
                    }]
                }
            }))
            .expect("profile fixture should serialize"),
        )
        .expect("profile fixture should write");

        let preview = preview_profile_file(&state, &path).expect("preview should succeed");
        let fingerprint = preview["fileFingerprint"]
            .as_str()
            .expect("preview should include a file fingerprint")
            .to_string();

        std::fs::write(
            &path,
            serde_json::to_vec(&json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "characters": [{
                        "id": "changed-character",
                        "name": "Changed Character"
                    }]
                }
            }))
            .expect("changed profile fixture should serialize"),
        )
        .expect("changed profile fixture should write");

        let error = import_profile_file_with_preview_fingerprint(&state, &path, Some(&fingerprint))
            .expect_err("changed file should be rejected before import");

        assert_eq!(error.code, "profile_file_changed");
        assert!(state
            .storage
            .get("characters", "changed-character")
            .expect("character lookup should not fail")
            .is_none());
        assert!(state
            .storage
            .get("characters", "preview-character")
            .expect("character lookup should not fail")
            .is_none());
    }

    #[test]
    fn profile_upload_import_rejects_invalid_json_as_invalid_input() {
        let state = test_state("profile-upload-invalid-json");
        let base64 = base64::Engine::encode(&general_purpose::STANDARD, b"{ nope");

        let error = import_profile_upload(&state, "profile.json", &base64)
            .expect_err("invalid uploaded profile JSON should reject as invalid input");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("Invalid profile JSON"));
    }

    #[test]
    fn profile_file_import_rejects_invalid_json_as_invalid_input() {
        let state = test_state("profile-file-invalid-json");
        let path = state.data_dir.join("profile.json");
        std::fs::write(&path, b"{ nope").expect("invalid profile fixture should write");

        let error = import_profile_file(&state, &path)
            .expect_err("invalid profile JSON file should reject as invalid input");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("Invalid profile JSON"));
    }

    #[test]
    fn profile_import_legacy_file_storage_app_settings_key_sets_ui_id() {
        let state = test_state("legacy-file-storage-app-settings");
        state
            .storage
            .upsert_with_id(
                "app-settings",
                "ui",
                json!({ "value": { "theme": "seeded" } }),
            )
            .expect("seeded ui settings should write");

        import_profile(
            &state,
            json!({
                "type": "marinara_profile",
                "version": 1,
                "data": {
                    "fileStorage": {
                        "tables": {
                            "app_settings": [
                                {
                                    "key": "ui",
                                    "value": { "theme": "imported" }
                                }
                            ]
                        }
                    }
                }
            }),
        )
        .expect("legacy file-storage profile import should succeed");

        let ui = state
            .storage
            .get("app-settings", "ui")
            .expect("ui settings lookup should not fail")
            .expect("imported ui settings should be addressable by id");
        assert_eq!(ui["id"], "ui");
        assert_eq!(ui["value"]["theme"], "imported");
    }
}
