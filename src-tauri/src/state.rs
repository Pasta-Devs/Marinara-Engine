use marinara_assets::AssetService;
use marinara_core::{AppError, AppResult};
use marinara_storage::FileStorage;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tokio::sync::watch;

use crate::seed_defaults::seed_bundled_defaults;
use crate::storage_commands::shared::normalize_typed_json_fields;

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
    pending: HashSet<String>,
}

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
        let starts_cancelled = cancellations.pending.remove(stream_id);
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
        let cancellations = self.llm_stream_cancellations.lock().map_err(|_| {
            AppError::new(
                "llm_stream_cancel_error",
                "LLM stream cancellation registry is unavailable",
            )
        })?;
        if let Some(tx) = cancellations.active.get(stream_id) {
            let _ = tx.send(true);
            Ok(true)
        } else {
            drop(cancellations);
            let mut cancellations = self.llm_stream_cancellations.lock().map_err(|_| {
                AppError::new(
                    "llm_stream_cancel_error",
                    "LLM stream cancellation registry is unavailable",
                )
            })?;
            cancellations.pending.insert(stream_id.to_string());
            Ok(false)
        }
    }
}

fn migrate_storage_json_fields(storage: &FileStorage) -> AppResult<()> {
    for collection in [
        "characters",
        "character-groups",
        "personas",
        "persona-groups",
        "lorebooks",
        "lorebook-entries",
        "prompts",
        "prompt-sections",
        "prompt-variables",
        "chat-presets",
        "agents",
        "connections",
        "chats",
        "messages",
        "custom-tools",
        "regex-scripts",
        "game-state-snapshots",
        "game-checkpoints",
    ] {
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
