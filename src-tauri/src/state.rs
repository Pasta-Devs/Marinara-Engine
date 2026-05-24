use marinara_assets::AssetService;
use marinara_core::{AppError, AppResult};
use marinara_storage::FileStorage;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use tokio::sync::watch;

use crate::seed_defaults::seed_bundled_defaults;

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
        for default_data in default_data_roots {
            if !default_data.exists() {
                continue;
            }
            seed_bundled_defaults(storage, &default_data)?;
            game_assets.seed_missing_from(&default_data.join("game-assets"))?;
            backgrounds.seed_missing_from(&default_data.join("backgrounds"))?;
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
