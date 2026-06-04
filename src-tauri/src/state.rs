use marinara_assets::AssetService;
use marinara_core::{AppError, AppResult};
use marinara_storage::FileStorage;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};
use tokio::sync::watch;

use crate::seed_defaults::seed_bundled_defaults;
use crate::storage_commands::{
    contracts,
    images::percent_encode_component,
    media_uploads::{file_path_asset_url, safe_filename, unique_file_path},
    shared::{
        agent_run_config_info_from_rows, compact_message_legacy_prompt_snapshots,
        normalize_agent_run_row_fields, normalize_typed_json_fields,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub storage: FileStorage,
    pub game_assets: AssetService,
    pub backgrounds: AssetService,
    pub data_dir: PathBuf,
    pub resource_dir: Option<PathBuf>,
    llm_stream_cancellations: Arc<Mutex<LlmStreamCancellations>>,
}

#[derive(Default)]
struct LlmStreamCancellations {
    active: HashMap<String, watch::Sender<bool>>,
    pending: HashMap<String, Instant>,
}

const STARTUP_MIGRATIONS_SETTINGS_ID: &str = "startup-migrations";
const MESSAGE_PROMPT_SNAPSHOT_COMPACTION_KEY: &str = "messagePromptSnapshotCompactionV1";
const LLM_STREAM_PENDING_CANCEL_TTL: Duration = Duration::from_secs(60);

impl AppState {
    pub fn new(app: &AppHandle) -> AppResult<Self> {
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| AppError::new("data_dir_error", error.to_string()))?;
        let default_data_roots = Self::default_data_roots(app);
        let resource_dir = app.path().resource_dir().ok();
        Self::from_data_dir_with_resource_dir(data_dir, default_data_roots, resource_dir)
    }

    pub fn from_data_dir(
        data_dir: impl Into<PathBuf>,
        default_data_roots: Vec<PathBuf>,
    ) -> AppResult<Self> {
        Self::from_data_dir_with_resource_dir(data_dir, default_data_roots, None)
    }

    pub fn from_data_dir_with_resource_dir(
        data_dir: impl Into<PathBuf>,
        default_data_roots: Vec<PathBuf>,
        resource_dir: Option<PathBuf>,
    ) -> AppResult<Self> {
        let data_dir = data_dir.into();
        std::fs::create_dir_all(&data_dir)?;
        let storage = FileStorage::new(data_dir.join("data"))?;
        let game_assets = AssetService::new(data_dir.join("game-assets"))?;
        let backgrounds = AssetService::new(data_dir.join("backgrounds"))?;
        Self::seed_defaults(&storage, &game_assets, &backgrounds, default_data_roots)?;
        migrate_storage_json_fields(&storage)?;
        migrate_message_prompt_snapshots_once(&storage)?;
        crate::storage_commands::message_swipes::migrate_nested_message_swipes(&storage)?;
        migrate_agent_run_rows(&storage)?;
        migrate_legacy_chat_group_roots(&storage)?;
        migrate_local_media_references(&storage, &data_dir)?;
        recover_legacy_chat_gallery_files(&storage, &data_dir)?;
        crate::storage_commands::startup_migrations::migrate_inline_image_references(
            &storage, &data_dir,
        )?;

        Ok(Self {
            storage,
            game_assets,
            backgrounds,
            data_dir,
            resource_dir,
            llm_stream_cancellations: Arc::new(Mutex::new(LlmStreamCancellations::default())),
        })
    }

    pub fn server_default_roots() -> Vec<PathBuf> {
        vec![PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("default-data")]
    }

    fn default_data_roots(app: &AppHandle) -> Vec<PathBuf> {
        let mut default_data_roots = Vec::new();
        if let Ok(resource_dir) = app.path().resource_dir() {
            default_data_roots.push(resource_dir.join("resources").join("default-data"));
        }
        default_data_roots.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("resources")
                .join("default-data"),
        );
        default_data_roots
    }

    fn seed_defaults(
        storage: &FileStorage,
        game_assets: &AssetService,
        backgrounds: &AssetService,
        default_data_roots: Vec<PathBuf>,
    ) -> AppResult<()> {
        let mut seeded_database_defaults = false;
        for default_data in default_data_roots {
            if !default_data.exists() {
                continue;
            }
            seed_bundled_defaults(storage, &default_data)?;
            seeded_database_defaults = true;
            game_assets.seed_missing_from(&default_data.join("game-assets"))?;
            backgrounds.seed_missing_from(&default_data.join("backgrounds"))?;
        }
        if !seeded_database_defaults {
            seed_bundled_defaults(storage, Path::new(""))?;
        }
        Ok(())
    }

    pub fn register_llm_stream(&self, stream_id: &str) -> AppResult<watch::Receiver<bool>> {
        let mut cancellations = self.llm_stream_cancellations.lock().map_err(|_| {
            AppError::new(
                "llm_stream_cancel_error",
                "LLM stream cancellation registry is unavailable",
            )
        })?;
        prune_expired_llm_stream_cancellations(&mut cancellations);
        let starts_cancelled = cancellations.pending.remove(stream_id).is_some();
        let (tx, rx) = watch::channel(starts_cancelled);
        cancellations.active.insert(stream_id.to_string(), tx);
        Ok(rx)
    }

    pub fn unregister_llm_stream(&self, stream_id: &str) {
        if let Ok(mut cancellations) = self.llm_stream_cancellations.lock() {
            cancellations.active.remove(stream_id);
            cancellations.pending.remove(stream_id);
        }
    }

    pub fn cancel_llm_stream(&self, stream_id: &str) -> AppResult<bool> {
        let mut cancellations = self.llm_stream_cancellations.lock().map_err(|_| {
            AppError::new(
                "llm_stream_cancel_error",
                "LLM stream cancellation registry is unavailable",
            )
        })?;
        prune_expired_llm_stream_cancellations(&mut cancellations);
        if let Some(tx) = cancellations.active.get(stream_id) {
            let _ = tx.send(true);
            Ok(true)
        } else {
            cancellations
                .pending
                .insert(stream_id.to_string(), Instant::now());
            Ok(false)
        }
    }
}

fn prune_expired_llm_stream_cancellations(cancellations: &mut LlmStreamCancellations) {
    prune_expired_llm_stream_cancellations_with_now(cancellations, Instant::now());
}

fn prune_expired_llm_stream_cancellations_with_now(
    cancellations: &mut LlmStreamCancellations,
    now: Instant,
) {
    cancellations.pending.retain(|_, created_at| {
        now.saturating_duration_since(*created_at) < LLM_STREAM_PENDING_CANCEL_TTL
    });
}

fn migrate_storage_json_fields(storage: &FileStorage) -> AppResult<()> {
    for collection in contracts::startup_json_repair_collections() {
        migrate_collection_json_fields(storage, collection)?;
    }
    Ok(())
}

fn migrate_collection_json_fields(storage: &FileStorage, collection: &str) -> AppResult<()> {
    let rows = storage.list(collection)?;
    let mut changed = false;
    let mut normalized_rows = Vec::with_capacity(rows.len());
    for mut row in rows {
        let before = row.clone();
        if let Some(object) = row.as_object_mut() {
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
                if collection == "game-state-snapshots" {
                    repair_snapshot_persona_stats_for_startup(object);
                }
                normalize_typed_json_fields(collection, object)?;
            }
        }
        changed = changed || row != before;
        normalized_rows.push(row);
    }
    if changed {
        storage.replace_all(collection, normalized_rows)?;
    }
    Ok(())
}

fn migrate_message_prompt_snapshots_once(storage: &FileStorage) -> AppResult<()> {
    if startup_migration_applied(storage, MESSAGE_PROMPT_SNAPSHOT_COMPACTION_KEY)? {
        return Ok(());
    }
    compact_message_prompt_snapshots(storage)?;
    mark_startup_migration_applied(storage, MESSAGE_PROMPT_SNAPSHOT_COMPACTION_KEY)
}

fn compact_message_prompt_snapshots(storage: &FileStorage) -> AppResult<()> {
    let rows = storage.list("messages")?;
    let mut changed = false;
    let mut compacted_rows = Vec::with_capacity(rows.len());
    for mut row in rows {
        let before = row.clone();
        if let Some(object) = row.as_object_mut() {
            normalize_typed_json_fields("messages", object)?;
            compact_message_legacy_prompt_snapshots(object);
        }
        changed = changed || row != before;
        compacted_rows.push(row);
    }
    if changed {
        storage.replace_all("messages", compacted_rows)?;
    }
    Ok(())
}

fn startup_migration_applied(storage: &FileStorage, key: &str) -> AppResult<bool> {
    Ok(startup_migration_flags(storage)?
        .get(key)
        .and_then(Value::as_bool)
        == Some(true))
}

fn mark_startup_migration_applied(storage: &FileStorage, key: &str) -> AppResult<()> {
    let mut flags = startup_migration_flags(storage)?;
    flags.insert(key.to_string(), Value::Bool(true));
    storage.upsert_with_id(
        "app-settings",
        STARTUP_MIGRATIONS_SETTINGS_ID,
        json!({ "value": Value::Object(flags) }),
    )?;
    Ok(())
}

fn startup_migration_flags(storage: &FileStorage) -> AppResult<Map<String, Value>> {
    let Some(record) = storage.get("app-settings", STARTUP_MIGRATIONS_SETTINGS_ID)? else {
        return Ok(Map::new());
    };
    Ok(record
        .get("value")
        .and_then(json_object_from_value)
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default())
}

fn json_object_from_value(value: &Value) -> Option<Value> {
    match value {
        Value::Object(_) => Some(value.clone()),
        Value::String(raw) => serde_json::from_str::<Value>(raw)
            .ok()
            .filter(Value::is_object),
        _ => None,
    }
}

fn migrate_agent_run_rows(storage: &FileStorage) -> AppResult<()> {
    let configs = agent_run_config_info_from_rows(storage.list("agents")?);
    let rows = storage.list("agent-runs")?;
    let mut changed = false;
    let mut normalized_rows = Vec::with_capacity(rows.len());
    for mut row in rows {
        let before = row.clone();
        normalize_agent_run_row_fields(&mut row, &configs);
        changed = changed || row != before;
        normalized_rows.push(row);
    }
    if changed {
        storage.replace_all("agent-runs", normalized_rows)?;
    }
    Ok(())
}

fn migrate_legacy_chat_group_roots(storage: &FileStorage) -> AppResult<()> {
    let mut rows = storage.list("chats")?;
    let referenced_group_ids: HashSet<String> = rows
        .iter()
        .filter_map(|row| {
            row.get("groupId")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|group_id| !group_id.is_empty())
                .map(ToOwned::to_owned)
        })
        .collect();
    if referenced_group_ids.is_empty() {
        return Ok(());
    }

    let mut changed = false;
    for row in &mut rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let Some(id) = object
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .map(ToOwned::to_owned)
        else {
            continue;
        };
        if !referenced_group_ids.contains(&id) {
            continue;
        }
        let has_group_id = object
            .get("groupId")
            .and_then(Value::as_str)
            .is_some_and(|group_id| !group_id.trim().is_empty());
        if has_group_id {
            continue;
        }
        object.insert("groupId".to_string(), Value::String(id));
        changed = true;
    }

    if changed {
        storage.replace_all("chats", rows)?;
    }
    Ok(())
}

#[derive(Clone, Copy)]
enum StoredMediaValue {
    AssetUrl,
    ManagedPrefix(&'static str),
    Filename,
}

#[derive(Clone, Copy)]
struct MediaReferenceMigration {
    collection: &'static str,
    folder: &'static str,
    primary_field: &'static str,
    mirror_fields: &'static [&'static str],
    file_path_field: &'static str,
    filename_field: &'static str,
    value: StoredMediaValue,
}

struct MigratedMediaReference {
    stored_value: String,
    absolute_path: String,
    filename: String,
}

fn migrate_local_media_references(storage: &FileStorage, data_dir: &Path) -> AppResult<()> {
    for migration in [
        MediaReferenceMigration {
            collection: "characters",
            folder: "avatars/characters",
            primary_field: "avatarPath",
            mirror_fields: &["avatar", "avatarUrl"],
            file_path_field: "avatarFilePath",
            filename_field: "avatarFilename",
            value: StoredMediaValue::AssetUrl,
        },
        MediaReferenceMigration {
            collection: "character-versions",
            folder: "avatars/characters",
            primary_field: "avatarPath",
            mirror_fields: &["avatar", "avatarUrl"],
            file_path_field: "avatarFilePath",
            filename_field: "avatarFilename",
            value: StoredMediaValue::AssetUrl,
        },
        MediaReferenceMigration {
            collection: "personas",
            folder: "avatars/personas",
            primary_field: "avatarPath",
            mirror_fields: &["avatar", "avatarUrl"],
            file_path_field: "avatarFilePath",
            filename_field: "avatarFilename",
            value: StoredMediaValue::AssetUrl,
        },
        MediaReferenceMigration {
            collection: "character-groups",
            folder: "avatars/character-groups",
            primary_field: "avatarPath",
            mirror_fields: &["avatar", "avatarUrl"],
            file_path_field: "avatarFilePath",
            filename_field: "avatarFilename",
            value: StoredMediaValue::AssetUrl,
        },
        MediaReferenceMigration {
            collection: "persona-groups",
            folder: "avatars/persona-groups",
            primary_field: "avatarPath",
            mirror_fields: &["avatar", "avatarUrl"],
            file_path_field: "avatarFilePath",
            filename_field: "avatarFilename",
            value: StoredMediaValue::AssetUrl,
        },
        MediaReferenceMigration {
            collection: "lorebooks",
            folder: "lorebooks/images",
            primary_field: "imagePath",
            mirror_fields: &["imageUrl"],
            file_path_field: "imageFilePath",
            filename_field: "imageFilename",
            value: StoredMediaValue::ManagedPrefix("marinara-lorebook-image:"),
        },
    ] {
        migrate_collection_media_references(storage, data_dir, migration)?;
    }
    migrate_chat_background_references(storage, data_dir)
}

fn recover_legacy_chat_gallery_files(storage: &FileStorage, data_dir: &Path) -> AppResult<()> {
    let gallery_dir = data_dir.join("gallery");
    if !gallery_dir.is_dir() {
        return Ok(());
    }

    let chat_ids: HashSet<String> = storage
        .list("chats")?
        .into_iter()
        .filter_map(|row| {
            row.get("id")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|id| !id.is_empty())
                .map(ToOwned::to_owned)
        })
        .collect();
    if chat_ids.is_empty() {
        return Ok(());
    }

    let entries = match fs::read_dir(&gallery_dir) {
        Ok(entries) => entries,
        Err(error) => {
            log::warn!(
                "failed to scan legacy chat gallery directory {}: {error}",
                gallery_dir.display()
            );
            return Ok(());
        }
    };

    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }
        let chat_id = entry.file_name().to_string_lossy().trim().to_string();
        if !chat_ids.contains(&chat_id) {
            continue;
        }
        recover_legacy_chat_gallery_dir(storage, &gallery_dir, &chat_id, &entry.path())?;
    }

    storage.flush()?;
    Ok(())
}

fn recover_legacy_chat_gallery_dir(
    storage: &FileStorage,
    gallery_dir: &Path,
    chat_id: &str,
    chat_gallery_dir: &Path,
) -> AppResult<()> {
    let mut filters = Map::new();
    filters.insert("chatId".to_string(), Value::String(chat_id.to_string()));
    let existing = storage.list_where("gallery", &filters)?;
    let entries = match fs::read_dir(chat_gallery_dir) {
        Ok(entries) => entries,
        Err(error) => {
            log::warn!(
                "failed to scan legacy gallery directory {}: {error}",
                chat_gallery_dir.display()
            );
            return Ok(());
        }
    };

    for entry in entries {
        let Ok(entry) = entry else {
            continue;
        };
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let source = entry.path();
        if !file_type.is_file() || !is_supported_media_file(&source) {
            continue;
        }
        let Some(filename) = source
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .filter(|value| !value.trim().is_empty())
        else {
            continue;
        };
        let legacy_path = format!("{chat_id}/{filename}");
        let source_path = source.to_string_lossy().to_string();
        if existing
            .iter()
            .any(|row| gallery_row_references_legacy_file(row, &legacy_path, &source_path))
        {
            continue;
        }

        let target_filename = safe_filename(&format!("{chat_id}-{filename}"));
        let target = unique_file_path(&gallery_dir.join(target_filename))?;
        fs::copy(&source, &target)?;
        let recovered_filename = target
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .ok_or_else(|| {
                AppError::invalid_input("Recovered gallery file is missing a filename")
            })?;
        let recovered_path = target.to_string_lossy().to_string();
        let record = json!({
            "chatId": chat_id,
            "filePath": recovered_path,
            "filename": recovered_filename,
            "url": file_path_asset_url(&target),
            "legacyFilePath": legacy_path,
            "prompt": null,
            "provider": null,
            "model": null,
            "width": null,
            "height": null,
        });
        if let Err(error) = storage.create("gallery", record) {
            let _ = fs::remove_file(&target);
            return Err(error);
        }
        if let Err(error) = fs::remove_file(&source) {
            log::warn!(
                "failed to remove recovered legacy gallery file {}: {error}",
                source.display()
            );
        }
    }

    let _ = fs::remove_dir(chat_gallery_dir);
    Ok(())
}

fn gallery_row_references_legacy_file(row: &Value, legacy_path: &str, source_path: &str) -> bool {
    ["legacyFilePath", "filePath"]
        .into_iter()
        .filter_map(|field| row.get(field).and_then(Value::as_str))
        .any(|value| {
            let normalized = value.trim().replace('\\', "/");
            normalized == legacy_path || value.trim() == source_path
        })
}

fn migrate_collection_media_references(
    storage: &FileStorage,
    data_dir: &Path,
    migration: MediaReferenceMigration,
) -> AppResult<()> {
    let mut rows = storage.list(migration.collection)?;
    let mut changed = false;
    for row in &mut rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let reference = std::iter::once(migration.primary_field)
            .chain(migration.mirror_fields.iter().copied())
            .filter_map(|field| object.get(field).and_then(Value::as_str))
            .find_map(local_path_from_media_reference)
            .and_then(|path| {
                migrate_media_file(
                    data_dir,
                    migration.folder,
                    &path,
                    &media_filename_hint(migration.collection, object, &path),
                    migration.value,
                )
                .transpose()
            })
            .transpose()?;
        let Some(reference) = reference else {
            continue;
        };
        object.insert(
            migration.primary_field.to_string(),
            Value::String(reference.stored_value.clone()),
        );
        for field in migration.mirror_fields {
            if object.contains_key(*field) {
                object.insert(
                    field.to_string(),
                    Value::String(reference.stored_value.clone()),
                );
            }
        }
        object.insert(
            migration.file_path_field.to_string(),
            Value::String(reference.absolute_path),
        );
        object.insert(
            migration.filename_field.to_string(),
            Value::String(reference.filename),
        );
        changed = true;
    }
    if changed {
        storage.replace_all(migration.collection, rows)?;
    }
    Ok(())
}

fn migrate_chat_background_references(storage: &FileStorage, data_dir: &Path) -> AppResult<()> {
    let mut rows = storage.list("chats")?;
    let mut changed = false;
    for row in &mut rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let Some(path) = object
            .get("metadata")
            .and_then(Value::as_object)
            .and_then(|metadata| metadata.get("background"))
            .and_then(Value::as_str)
            .and_then(local_path_from_media_reference)
        else {
            continue;
        };
        let filename_hint = media_filename_hint("chats", object, &path);
        let Some(reference) = migrate_media_file(
            data_dir,
            "backgrounds",
            &path,
            &filename_hint,
            StoredMediaValue::Filename,
        )?
        else {
            continue;
        };
        let Some(metadata) = object.get_mut("metadata").and_then(Value::as_object_mut) else {
            continue;
        };
        metadata.insert(
            "background".to_string(),
            Value::String(reference.stored_value),
        );
        changed = true;
    }
    if changed {
        storage.replace_all("chats", rows)?;
    }
    Ok(())
}

fn migrate_media_file(
    data_dir: &Path,
    folder: &str,
    source: &Path,
    filename_hint: &str,
    value: StoredMediaValue,
) -> AppResult<Option<MigratedMediaReference>> {
    if !source.is_file() || !is_supported_media_file(source) {
        return Ok(None);
    }
    let target_dir = data_dir.join(folder);
    fs::create_dir_all(&target_dir)?;
    let target = if is_path_inside_dir(source, &target_dir) {
        source.to_path_buf()
    } else {
        let filename = managed_media_filename(filename_hint, source);
        let target = unique_file_path(&target_dir.join(filename))?;
        fs::copy(source, &target)?;
        target
    };
    let filename = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .ok_or_else(|| AppError::invalid_input("Managed media path is missing a filename"))?;
    let stored_value = match value {
        StoredMediaValue::AssetUrl => file_path_asset_url(&target),
        StoredMediaValue::ManagedPrefix(prefix) => {
            format!("{prefix}{}", percent_encode_component(&filename))
        }
        StoredMediaValue::Filename => filename.clone(),
    };
    Ok(Some(MigratedMediaReference {
        stored_value,
        absolute_path: target.to_string_lossy().to_string(),
        filename,
    }))
}

fn local_path_from_media_reference(value: &str) -> Option<PathBuf> {
    let trimmed = value.trim();
    if (trimmed.is_empty()
        || trimmed.starts_with("data:")
        || trimmed.starts_with("blob:")
        || trimmed.starts_with("tauri-api:")
        || trimmed.starts_with("marinara-")
        || trimmed.starts_with("http://")
        || trimmed.starts_with("https://"))
        && !trimmed.starts_with("http://asset.localhost/")
    {
        return None;
    }

    let path = if let Some(encoded) = trimmed.strip_prefix("asset://localhost/") {
        percent_decode(encoded)
    } else if let Some(encoded) = trimmed.strip_prefix("http://asset.localhost/") {
        percent_decode(encoded)
    } else if let Some(encoded) = trimmed.strip_prefix("file://") {
        let decoded = percent_decode(encoded);
        if cfg!(windows) {
            decoded
                .strip_prefix('/')
                .filter(|path| path.as_bytes().get(1) == Some(&b':'))
                .unwrap_or(&decoded)
                .to_string()
        } else {
            decoded
        }
    } else if is_absolute_filesystem_path(trimmed) {
        trimmed.to_string()
    } else {
        return None;
    };

    Some(PathBuf::from(path))
}

fn is_absolute_filesystem_path(value: &str) -> bool {
    value.starts_with('/')
        || value.starts_with("\\\\")
        || (value.len() >= 3
            && value.as_bytes()[1] == b':'
            && matches!(value.as_bytes()[2], b'\\' | b'/')
            && value.as_bytes()[0].is_ascii_alphabetic())
}

fn is_supported_media_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "avif" | "svg"
    )
}

fn managed_media_filename(filename_hint: &str, source: &Path) -> String {
    let ext = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png");
    let mut filename = safe_filename(filename_hint);
    if Path::new(&filename).extension().is_none() {
        filename.push('.');
        filename.push_str(ext);
    }
    filename
}

fn media_filename_hint(collection: &str, object: &Map<String, Value>, source: &Path) -> String {
    object
        .get("data")
        .and_then(|data| data.get("name"))
        .or_else(|| object.get("name"))
        .or_else(|| object.get("id"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            source
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
        })
        .unwrap_or_else(|| collection.to_string())
}

fn is_path_inside_dir(path: &Path, dir: &Path) -> bool {
    let Ok(path) = fs::canonicalize(path) else {
        return false;
    };
    let Ok(dir) = fs::canonicalize(dir) else {
        return false;
    };
    path.starts_with(dir)
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

fn repair_snapshot_persona_stats_for_startup(object: &mut Map<String, Value>) {
    let Some(value) = object.get("personaStats") else {
        return;
    };
    if value.is_null() || value.is_array() {
        return;
    }

    let (next, repaired_invalid) = match value.as_str() {
        Some(raw) if raw.trim().is_empty() => (Value::Null, false),
        Some(raw) => match serde_json::from_str::<Value>(raw) {
            Ok(parsed) if parsed.is_array() => (parsed, false),
            Ok(parsed) if parsed.is_null() => (Value::Null, false),
            Ok(_) | Err(_) => (Value::Null, true),
        },
        None => (Value::Null, true),
    };

    if repaired_invalid {
        let row_id = object
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("<unknown>");
        log::trace!(
            "repairing game-state-snapshots row id={row_id} personaStats to null because it is not a JSON array or null"
        );
    }

    object.insert("personaStats".to_string(), next);
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempRoot(PathBuf);

    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn temp_root(test_name: &str) -> TempRoot {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        TempRoot(std::env::temp_dir().join(format!("marinara-state-{test_name}-{suffix}")))
    }

    fn persist_fixture_storage(storage: &FileStorage) {
        storage.flush().expect("fixture writes should persist");
    }

    const INLINE_PNG_DATA_URL: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lTmZsgAAAABJRU5ErkJggg==";

    fn assert_managed_image_url(value: &str) {
        assert!(
            !value.starts_with("data:image/"),
            "inline image data should not remain in hot storage"
        );
        assert!(
            value.starts_with("asset://localhost") || value.starts_with("http://asset.localhost"),
            "migrated image should be served as a managed asset URL"
        );
    }

    #[test]
    fn llm_stream_pending_cancellations_inside_ttl_are_retained() {
        let now = Instant::now();
        let mut cancellations = LlmStreamCancellations::default();
        cancellations.pending.insert(
            "recent".to_string(),
            now - LLM_STREAM_PENDING_CANCEL_TTL + Duration::from_millis(1),
        );

        prune_expired_llm_stream_cancellations_with_now(&mut cancellations, now);

        assert!(cancellations.pending.contains_key("recent"));
    }

    #[test]
    fn llm_stream_pending_cancellations_older_than_ttl_are_pruned() {
        let now = Instant::now();
        let mut cancellations = LlmStreamCancellations::default();
        cancellations.pending.insert(
            "expired".to_string(),
            now - LLM_STREAM_PENDING_CANCEL_TTL - Duration::from_millis(1),
        );

        prune_expired_llm_stream_cancellations_with_now(&mut cancellations, now);

        assert!(!cancellations.pending.contains_key("expired"));
    }

    #[test]
    fn llm_stream_pending_cancellations_with_future_timestamps_do_not_panic() {
        let now = Instant::now();
        let mut cancellations = LlmStreamCancellations::default();
        cancellations
            .pending
            .insert("future".to_string(), now + Duration::from_secs(1));

        prune_expired_llm_stream_cancellations_with_now(&mut cancellations, now);

        assert!(cancellations.pending.contains_key("future"));
    }

    #[test]
    fn register_llm_stream_starts_cancelled_for_recent_pending_entry() {
        let root = temp_root("llm-stream-pending-cancel");
        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");

        assert!(!state
            .cancel_llm_stream("stream-1")
            .expect("cancel should register pending"));

        let cancellation = state
            .register_llm_stream("stream-1")
            .expect("stream should register");

        assert!(*cancellation.borrow());
        state.unregister_llm_stream("stream-1");
    }

    #[test]
    fn app_state_startup_accepts_snapshot_persona_stats_arrays() {
        let root = temp_root("snapshot-persona-stats");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .create(
                "game-state-snapshots",
                json!({
                    "kind": "tracker",
                    "chatId": "chat-1",
                    "messageId": "message-1",
                    "presentCharacters": [],
                    "recentEvents": [],
                    "playerStats": null,
                    "personaStats": [{ "name": "Energy", "value": 5, "max": 10 }],
                    "metadata": null
                }),
            )
            .expect("snapshot should be inserted");
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let rows = state
            .storage
            .list("game-state-snapshots")
            .expect("snapshots should list");

        assert_eq!(rows.len(), 1);
        assert!(rows[0]["personaStats"].is_array());
    }

    #[test]
    fn app_state_startup_repairs_malformed_snapshot_persona_stats_to_null() {
        let root = temp_root("snapshot-persona-stats-repair");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        for (id, persona_stats) in [
            ("bad-string", json!("{\"not\":\"an array\"}")),
            ("bad-object", json!({ "not": "an array" })),
        ] {
            storage
                .create(
                    "game-state-snapshots",
                    json!({
                        "id": id,
                        "kind": "tracker",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "presentCharacters": [],
                        "recentEvents": [],
                        "playerStats": null,
                        "personaStats": persona_stats,
                        "metadata": null
                    }),
                )
                .expect("snapshot should be inserted");
        }
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let rows = state
            .storage
            .list("game-state-snapshots")
            .expect("snapshots should list");

        assert_eq!(rows.len(), 2);
        for row in rows {
            assert!(row["personaStats"].is_null());
        }
    }

    #[test]
    fn app_state_startup_normalizes_legacy_agent_run_rows() {
        let root = temp_root("agent-run-normalization");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .replace_all(
                "agents",
                vec![json!({
                    "id": "custom-agent-1",
                    "type": "custom-prophet",
                    "name": "Custom Prophet",
                    "settings": "{}"
                })],
            )
            .expect("agent config should be seeded");
        storage
            .replace_all(
                "agent-runs",
                vec![
                    json!({
                        "id": "agent-run-1",
                        "agent_config_id": "custom-agent-1",
                        "agentType": "stale-agent-type",
                        "agentName": "Stale Agent Name",
                        "chat_id": "chat-1",
                        "message_id": "message-1",
                        "result_type": "context_injection",
                        "result_data": "{\"text\":\"Imported guidance\"}",
                        "tokens_used": "42",
                        "duration_ms": "1200",
                        "success": "true",
                        "createdAt": "storage-row-created-at",
                        "created_at": "2026-05-20T00:01:00Z"
                    }),
                    json!({
                        "id": "agent-run-invalid-created-at",
                        "agent_config_id": "custom-agent-1",
                        "chat_id": "chat-1",
                        "message_id": "message-2",
                        "result_type": "context_injection",
                        "result_data": "{}",
                        "tokens_used": "0",
                        "duration_ms": "0",
                        "success": "true",
                        "createdAt": "2026-05-20T00:02:00Z",
                        "created_at": "not-a-date"
                    }),
                ],
            )
            .expect("legacy agent run should be seeded");

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let run = state
            .storage
            .get("agent-runs", "agent-run-1")
            .expect("agent run lookup should not fail")
            .expect("agent run should still exist");
        assert_eq!(run["agentConfigId"], "custom-agent-1");
        assert_eq!(run["agentType"], "custom-prophet");
        assert_eq!(run["agentName"], "Custom Prophet");
        assert_eq!(run["chatId"], "chat-1");
        assert_eq!(run["messageId"], "message-1");
        assert_eq!(run["resultType"], "context_injection");
        assert_eq!(run["resultData"]["text"], "Imported guidance");
        assert_eq!(run["tokensUsed"], 42);
        assert_eq!(run["durationMs"], 1200);
        assert_eq!(run["success"], true);
        assert_eq!(run["createdAt"], "2026-05-20T00:01:00+00:00");

        let invalid_created_at_run = state
            .storage
            .get("agent-runs", "agent-run-invalid-created-at")
            .expect("agent run lookup should not fail")
            .expect("agent run should still exist");
        assert_eq!(invalid_created_at_run["createdAt"], "2026-05-20T00:02:00Z");

        let mut filters = Map::new();
        filters.insert("chatId".to_string(), Value::String("chat-1".to_string()));
        assert_eq!(
            state
                .storage
                .list_where("agent-runs", &filters)
                .expect("normalized agent run should be queryable by chatId")
                .len(),
            2
        );
    }

    #[test]
    fn app_state_startup_copies_stale_local_avatar_references_into_managed_storage() {
        let root = temp_root("local-avatar-repair");
        let source_root = temp_root("local-avatar-source");
        let source = source_root.0.join("Old Avatar.png");
        std::fs::create_dir_all(&source_root.0).expect("source dir should exist");
        std::fs::write(&source, b"image-bytes").expect("source image should be written");
        let old_asset_url = file_path_asset_url(&source);
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": { "name": "Dottore" },
                    "comment": "",
                    "avatarPath": old_asset_url,
                    "avatar": source.to_string_lossy()
                }),
            )
            .expect("character should be inserted");
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let character = state
            .storage
            .get("characters", "char-1")
            .expect("character should load")
            .expect("character should exist");
        let avatar_path = character["avatarPath"]
            .as_str()
            .expect("avatar path should be a string");
        let avatar_file_path = PathBuf::from(
            character["avatarFilePath"]
                .as_str()
                .expect("avatar file path should be stored"),
        );

        assert_ne!(avatar_path, old_asset_url);
        assert!(
            avatar_path.starts_with("asset://localhost")
                || avatar_path.starts_with("http://asset.localhost")
        );
        assert!(avatar_file_path.starts_with(root.0.join("avatars/characters")));
        assert!(avatar_file_path.is_file());
        assert_eq!(character["avatar"], character["avatarPath"]);
    }

    #[test]
    fn app_state_startup_persists_inline_character_and_persona_avatars() {
        let root = temp_root("inline-avatar-repair");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .create(
                "characters",
                json!({
                    "id": "char-inline",
                    "data": { "name": "Inline Character" },
                    "comment": "",
                    "avatarPath": INLINE_PNG_DATA_URL,
                    "avatar": INLINE_PNG_DATA_URL
                }),
            )
            .expect("character should be inserted");
        storage
            .create(
                "personas",
                json!({
                    "id": "persona-inline",
                    "name": "Inline Persona",
                    "avatarPath": INLINE_PNG_DATA_URL,
                    "avatarUrl": INLINE_PNG_DATA_URL
                }),
            )
            .expect("persona should be inserted");
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let character = state
            .storage
            .get("characters", "char-inline")
            .expect("character should load")
            .expect("character should exist");
        let persona = state
            .storage
            .get("personas", "persona-inline")
            .expect("persona should load")
            .expect("persona should exist");

        let character_avatar = character["avatarPath"]
            .as_str()
            .expect("character avatar path should be stored");
        let character_file = PathBuf::from(
            character["avatarFilePath"]
                .as_str()
                .expect("character avatar file path should be stored"),
        );
        assert_managed_image_url(character_avatar);
        assert_eq!(character["avatar"], character["avatarPath"]);
        assert!(character_file.starts_with(root.0.join("avatars/characters")));
        assert!(character_file.is_file());

        let persona_avatar = persona["avatarPath"]
            .as_str()
            .expect("persona avatar path should be stored");
        let persona_file = PathBuf::from(
            persona["avatarFilePath"]
                .as_str()
                .expect("persona avatar file path should be stored"),
        );
        assert_managed_image_url(persona_avatar);
        assert_eq!(persona["avatarUrl"], persona["avatarPath"]);
        assert!(persona_file.starts_with(root.0.join("avatars/personas")));
        assert!(persona_file.is_file());
    }

    #[test]
    fn app_state_startup_persists_inline_game_avatar_state() {
        let root = temp_root("inline-game-avatar-repair");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "mode": "game",
                    "characterIds": [],
                    "gameState": {
                        "presentCharacters": [
                            { "name": "Tracker NPC", "avatarPath": INLINE_PNG_DATA_URL }
                        ]
                    },
                    "metadata": {
                        "gameNpcs": [
                            {
                                "id": "npc-1",
                                "name": "Generated NPC",
                                "avatarUrl": INLINE_PNG_DATA_URL,
                                "avatarPath": INLINE_PNG_DATA_URL
                            }
                        ],
                        "gameState": {
                            "presentCharacters": [
                                { "name": "Metadata Tracker NPC", "avatarPath": INLINE_PNG_DATA_URL }
                            ]
                        }
                    }
                }),
            )
            .expect("chat should be inserted");
        storage
            .create(
                "game-state-snapshots",
                json!({
                    "id": "snapshot-1",
                    "chatId": "chat-1",
                    "messageId": "message-1",
                    "kind": "tracker",
                    "presentCharacters": [
                        { "name": "Snapshot NPC", "avatarPath": INLINE_PNG_DATA_URL }
                    ],
                    "recentEvents": [],
                    "metadata": null
                }),
            )
            .expect("snapshot should be inserted");
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should load")
            .expect("chat should exist");
        let snapshot = state
            .storage
            .get("game-state-snapshots", "snapshot-1")
            .expect("snapshot should load")
            .expect("snapshot should exist");

        let tracker_avatar = chat["gameState"]["presentCharacters"][0]["avatarPath"]
            .as_str()
            .expect("tracker avatar path should be stored");
        let npc_avatar = chat["metadata"]["gameNpcs"][0]["avatarUrl"]
            .as_str()
            .expect("npc avatar url should be stored");
        let metadata_tracker_avatar = chat["metadata"]["gameState"]["presentCharacters"][0]
            ["avatarPath"]
            .as_str()
            .expect("metadata tracker avatar path should be stored");
        let snapshot_avatar = snapshot["presentCharacters"][0]["avatarPath"]
            .as_str()
            .expect("snapshot avatar path should be stored");

        assert_managed_image_url(tracker_avatar);
        assert_managed_image_url(npc_avatar);
        assert_eq!(
            chat["metadata"]["gameNpcs"][0]["avatarPath"],
            chat["metadata"]["gameNpcs"][0]["avatarUrl"]
        );
        assert_managed_image_url(metadata_tracker_avatar);
        assert_managed_image_url(snapshot_avatar);
        assert!(
            std::fs::read_dir(root.0.join("avatars/npc"))
                .expect("npc avatar directory should exist")
                .filter_map(Result::ok)
                .count()
                >= 4
        );
    }

    #[test]
    fn app_state_startup_persists_inline_message_attachment_urls() {
        let root = temp_root("inline-message-attachment-repair");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .create(
                "gallery",
                json!({
                    "id": "gallery-existing",
                    "chatId": "chat-1",
                    "filename": "existing-inline.png",
                    "url": INLINE_PNG_DATA_URL,
                    "prompt": "existing prompt"
                }),
            )
            .expect("gallery row should be inserted");
        storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "generated images",
                    "attachments": [
                        {
                            "type": "image",
                            "galleryId": "gallery-existing",
                            "url": INLINE_PNG_DATA_URL,
                            "data": INLINE_PNG_DATA_URL,
                            "prompt": "existing prompt"
                        },
                        {
                            "type": "image",
                            "imageUrl": INLINE_PNG_DATA_URL,
                            "data": INLINE_PNG_DATA_URL,
                            "prompt": "new prompt",
                            "provider": "test-provider",
                            "model": "test-model",
                            "width": 512,
                            "height": 768
                        },
                        {
                            "type": "image",
                            "data": INLINE_PNG_DATA_URL,
                            "filename": "data-only.png",
                            "prompt": "data-only prompt"
                        }
                    ],
                    "extra": {
                        "attachments": [
                            {
                                "type": "image",
                                "url": INLINE_PNG_DATA_URL,
                                "data": INLINE_PNG_DATA_URL,
                                "prompt": "extra prompt"
                            }
                        ]
                    }
                }),
            )
            .expect("message should be inserted");
        storage
            .replace_all(
                crate::storage_commands::message_swipes::COLLECTION,
                vec![json!({
                    "id": "message-1::swipe::0",
                    "chatId": "chat-1",
                    "messageId": "message-1",
                    "index": 0,
                    "content": "alternate generated images",
                    "extra": {
                        "attachments": [
                            {
                                "type": "image",
                                "data": INLINE_PNG_DATA_URL,
                                "filename": "sidecar.png",
                                "prompt": "sidecar prompt"
                            }
                        ]
                    }
                })],
            )
            .expect("sidecar swipe should be inserted");
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let gallery_existing = state
            .storage
            .get("gallery", "gallery-existing")
            .expect("gallery row should load")
            .expect("gallery row should exist");
        let existing_url = gallery_existing["url"]
            .as_str()
            .expect("gallery url should be stored");
        let message = state
            .storage
            .get("messages", "message-1")
            .expect("message should load")
            .expect("message should exist");
        let attachments = message["attachments"]
            .as_array()
            .expect("attachments should remain an array");
        let extra_attachments = message["extra"]["attachments"]
            .as_array()
            .expect("extra attachments should remain an array");

        assert_managed_image_url(existing_url);
        assert_eq!(attachments[0]["url"], gallery_existing["url"]);
        assert!(attachments[0]["data"].is_null());

        let new_url = attachments[1]["url"]
            .as_str()
            .expect("new attachment url should be stored");
        assert_managed_image_url(new_url);
        assert_eq!(attachments[1]["imageUrl"], attachments[1]["url"]);
        assert!(attachments[1]["galleryId"].as_str().is_some());
        assert!(attachments[1]["data"].is_null());
        let new_gallery_id = attachments[1]["galleryId"]
            .as_str()
            .expect("new attachment gallery id should be stored");
        let new_gallery = state
            .storage
            .get("gallery", new_gallery_id)
            .expect("new gallery row should load")
            .expect("new gallery row should exist");
        assert_eq!(new_gallery["provider"].as_str(), Some("test-provider"));
        assert_eq!(new_gallery["model"].as_str(), Some("test-model"));
        assert_eq!(new_gallery["width"].as_u64(), Some(512));
        assert_eq!(new_gallery["height"].as_u64(), Some(768));

        let data_only_url = attachments[2]["url"]
            .as_str()
            .expect("data-only attachment url should be stored");
        assert_managed_image_url(data_only_url);
        assert!(attachments[2]["galleryId"].as_str().is_some());
        assert!(attachments[2]["filePath"].as_str().is_some());
        assert!(attachments[2]["filename"].as_str().is_some());
        assert!(attachments[2]["data"].is_null());

        let extra_url = extra_attachments[0]["url"]
            .as_str()
            .expect("extra attachment url should be stored");
        assert_managed_image_url(extra_url);
        assert!(extra_attachments[0]["galleryId"].as_str().is_some());
        assert!(extra_attachments[0]["data"].is_null());

        let sidecars = state
            .storage
            .list(crate::storage_commands::message_swipes::COLLECTION)
            .expect("sidecar rows should list");
        let sidecar_attachment = &sidecars[0]["extra"]["attachments"][0];
        let sidecar_url = sidecar_attachment["url"]
            .as_str()
            .expect("sidecar attachment url should be stored");
        assert_managed_image_url(sidecar_url);
        assert!(sidecar_attachment["galleryId"].as_str().is_some());
        assert!(sidecar_attachment["data"].is_null());
        assert_eq!(
            state
                .storage
                .list("gallery")
                .expect("gallery rows should list")
                .len(),
            5
        );
    }

    #[test]
    fn app_state_startup_copies_stale_chat_background_references_into_managed_storage() {
        let root = temp_root("local-background-repair");
        let source_root = temp_root("local-background-source");
        let source = source_root.0.join("Old Backdrop.webp");
        std::fs::create_dir_all(&source_root.0).expect("source dir should exist");
        std::fs::write(&source, b"image-bytes").expect("source image should be written");
        let old_asset_url = file_path_asset_url(&source);
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "mode": "roleplay",
                    "characterIds": [],
                    "metadata": { "background": old_asset_url }
                }),
            )
            .expect("chat should be inserted");
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should load")
            .expect("chat should exist");
        let background = chat["metadata"]["background"]
            .as_str()
            .expect("background should be a string");

        assert_ne!(background, old_asset_url);
        assert_eq!(background, "chat-1.webp");
        assert!(root.0.join("backgrounds/chat-1.webp").is_file());
    }

    #[test]
    fn app_state_startup_recovers_legacy_chat_gallery_files() {
        let root = temp_root("legacy-chat-gallery-recovery");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "mode": "roleplay",
                    "characterIds": [],
                    "metadata": {}
                }),
            )
            .expect("chat should be inserted");
        persist_fixture_storage(&storage);
        let legacy_gallery_dir = root.0.join("gallery").join("chat-1");
        std::fs::create_dir_all(&legacy_gallery_dir).expect("gallery dir should exist");
        std::fs::write(legacy_gallery_dir.join("orphan.png"), b"image-bytes")
            .expect("legacy gallery image should be written");
        std::fs::write(legacy_gallery_dir.join("notes.txt"), b"not an image")
            .expect("unsupported gallery file should be written");
        let missing_chat_gallery_dir = root.0.join("gallery").join("missing-chat");
        std::fs::create_dir_all(&missing_chat_gallery_dir)
            .expect("missing chat gallery dir should exist");
        std::fs::write(
            missing_chat_gallery_dir.join("orphan.png"),
            b"missing chat image",
        )
        .expect("missing chat gallery image should be written");

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let rows = state
            .storage
            .list("gallery")
            .expect("gallery rows should list");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["chatId"], "chat-1");
        assert!(rows[0]["filename"]
            .as_str()
            .is_some_and(|value| value.ends_with(".png")));
        assert!(
            rows[0]["url"]
                .as_str()
                .is_some_and(|value| value.starts_with("asset://localhost")
                    || value.starts_with("http://asset.localhost")),
            "recovered gallery row should point at a managed asset URL"
        );
        let recovered_path = PathBuf::from(
            rows[0]["filePath"]
                .as_str()
                .expect("recovered file path should be stored"),
        );
        assert!(recovered_path.is_file());
        assert!(recovered_path.starts_with(root.0.join("gallery")));
        assert!(!legacy_gallery_dir.join("orphan.png").exists());
        assert!(legacy_gallery_dir.join("notes.txt").exists());
        assert!(missing_chat_gallery_dir.join("orphan.png").exists());

        let restarted = AppState::from_data_dir(&root.0, Vec::new()).expect("state should restart");
        assert_eq!(
            restarted
                .storage
                .list("gallery")
                .expect("gallery rows should list")
                .len(),
            1,
            "startup recovery should be idempotent"
        );
    }

    #[test]
    fn app_state_startup_enrolls_legacy_ungrouped_chat_roots() {
        let root = temp_root("legacy-chat-root-groups");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        for chat in [
            json!({
                "id": "root-1",
                "mode": "roleplay",
                "groupId": null,
                "characterIds": [],
                "metadata": {}
            }),
            json!({
                "id": "branch-1",
                "mode": "roleplay",
                "groupId": "root-1",
                "characterIds": [],
                "metadata": {}
            }),
            json!({
                "id": "unrelated-root",
                "mode": "conversation",
                "groupId": null,
                "characterIds": [],
                "metadata": {}
            }),
            json!({
                "id": "already-grouped-root",
                "mode": "roleplay",
                "groupId": "existing-group",
                "characterIds": [],
                "metadata": {}
            }),
            json!({
                "id": "existing-branch",
                "mode": "roleplay",
                "groupId": "already-grouped-root",
                "characterIds": [],
                "metadata": {}
            }),
        ] {
            storage
                .create("chats", chat)
                .expect("chat row should be inserted");
        }
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let root_chat = state
            .storage
            .get("chats", "root-1")
            .expect("root lookup should not fail")
            .expect("root should still exist");
        let unrelated = state
            .storage
            .get("chats", "unrelated-root")
            .expect("unrelated lookup should not fail")
            .expect("unrelated chat should still exist");
        let already_grouped = state
            .storage
            .get("chats", "already-grouped-root")
            .expect("grouped root lookup should not fail")
            .expect("grouped root should still exist");

        assert_eq!(root_chat["groupId"], "root-1");
        assert_eq!(unrelated.get("groupId"), Some(&Value::Null));
        assert_eq!(already_grouped["groupId"], "existing-group");
    }

    #[test]
    fn app_state_startup_compacts_legacy_message_prompt_snapshots_once() {
        let root = temp_root("message-prompt-snapshot-compaction");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "second",
                    "activeSwipeIndex": 1,
                    "extra": {
                        "hiddenFromAI": true,
                        "generationPromptSnapshot": { "promptPresetId": "preset-second" },
                        "generationPromptSnapshotsBySwipe": {
                            "0": { "promptPresetId": "preset-first" },
                            "1": { "promptPresetId": "preset-second" }
                        }
                    },
                    "swipes": [
                        { "content": "first", "extra": {} },
                        { "content": "second", "extra": {} }
                    ]
                }),
            )
            .expect("message should be inserted");
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let persisted = state
            .storage
            .get("messages", "message-1")
            .expect("message should load")
            .expect("message should exist");

        assert_eq!(persisted["extra"]["hiddenFromAI"], json!(true));
        assert!(persisted["extra"].get("generationPromptSnapshot").is_none());
        assert!(persisted["extra"]
            .get("generationPromptSnapshotsBySwipe")
            .is_none());
        assert!(persisted.get("swipes").is_none());
        let sidecar_swipes =
            crate::storage_commands::message_swipes::swipes_for_message(&state, "message-1")
                .expect("sidecar swipes should load");
        assert_eq!(
            sidecar_swipes[0]["extra"]["generationPromptSnapshot"]["promptPresetId"],
            json!("preset-first")
        );
        assert_eq!(
            sidecar_swipes[1]["extra"]["generationPromptSnapshot"]["promptPresetId"],
            json!("preset-second")
        );

        let flags = state
            .storage
            .get("app-settings", STARTUP_MIGRATIONS_SETTINGS_ID)
            .expect("migration marker should load")
            .expect("migration marker should exist");
        assert_eq!(
            flags["value"][MESSAGE_PROMPT_SNAPSHOT_COMPACTION_KEY],
            json!(true)
        );
    }

    #[test]
    fn app_state_startup_preserves_legacy_no_swipe_message_prompt_snapshots() {
        let root = temp_root("message-prompt-snapshot-no-swipes");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "legacy",
                    "extra": {
                        "generationPromptSnapshot": { "promptPresetId": "preset-legacy" },
                        "generationPromptSnapshotsBySwipe": {
                            "0": { "promptPresetId": "preset-legacy" }
                        }
                    }
                }),
            )
            .expect("message should be inserted");
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let persisted = state
            .storage
            .get("messages", "message-1")
            .expect("message should load")
            .expect("message should exist");

        assert!(persisted.get("swipes").is_none());
        assert_eq!(
            persisted["extra"]["generationPromptSnapshot"]["promptPresetId"],
            json!("preset-legacy")
        );
        assert_eq!(
            persisted["extra"]["generationPromptSnapshotsBySwipe"]["0"]["promptPresetId"],
            json!("preset-legacy")
        );
    }

    #[test]
    fn app_state_startup_compacts_embedded_swipes_after_message_compaction_marker() {
        let root = temp_root("message-prompt-snapshot-marker");
        let storage = FileStorage::new(root.0.join("data")).expect("storage should initialize");
        let mut marker = Map::new();
        marker.insert(
            MESSAGE_PROMPT_SNAPSHOT_COMPACTION_KEY.to_string(),
            Value::Bool(true),
        );
        storage
            .upsert_with_id(
                "app-settings",
                STARTUP_MIGRATIONS_SETTINGS_ID,
                json!({ "value": Value::Object(marker) }),
            )
            .expect("marker should be inserted");
        storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "first",
                    "activeSwipeIndex": 0,
                    "extra": {
                        "generationPromptSnapshot": { "promptPresetId": "preset-first" },
                        "generationPromptSnapshotsBySwipe": {
                            "0": { "promptPresetId": "preset-first" }
                        }
                    },
                    "swipes": [{ "content": "first", "extra": {} }]
                }),
            )
            .expect("message should be inserted");
        persist_fixture_storage(&storage);

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        let persisted = state
            .storage
            .get("messages", "message-1")
            .expect("message should load")
            .expect("message should exist");

        assert!(persisted["extra"].get("generationPromptSnapshot").is_none());
        assert!(persisted["extra"]
            .get("generationPromptSnapshotsBySwipe")
            .is_none());
        assert!(persisted.get("swipes").is_none());
        let sidecar_swipes =
            crate::storage_commands::message_swipes::swipes_for_message(&state, "message-1")
                .expect("sidecar swipes should load");
        assert_eq!(
            sidecar_swipes[0]["extra"]["generationPromptSnapshot"]["promptPresetId"],
            json!("preset-first")
        );
    }

    #[test]
    fn app_state_startup_recovers_when_collection_and_backup_are_corrupt() {
        let root = temp_root("corrupt-storage-startup");
        let collections = root.0.join("data").join("collections");
        std::fs::create_dir_all(&collections).expect("collections directory should exist");
        std::fs::write(collections.join("messages.json"), b"\0\0\0")
            .expect("corrupt primary should be written");
        std::fs::write(collections.join("messages.json.bak"), b"{ bad backup")
            .expect("corrupt backup should be written");

        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");

        assert!(state.storage.list("messages").unwrap().is_empty());
        assert_eq!(
            std::fs::read_to_string(collections.join("messages.json")).unwrap(),
            "[]"
        );
        assert_eq!(
            std::fs::read_dir(collections)
                .unwrap()
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name().to_string_lossy().contains(".corrupted-"))
                .count(),
            2
        );
    }
}
