use crate::state::AppState;
use crate::storage_commands::backup;
use marinara_core::AppError;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub fn backup_create(state: State<'_, AppState>) -> Result<Value, AppError> {
    backup::create_backup(&state)
}

#[tauri::command]
pub fn backup_list(state: State<'_, AppState>) -> Result<Value, AppError> {
    backup::list_backups(&state)
}

#[tauri::command]
pub fn backup_delete(state: State<'_, AppState>, name: String) -> Result<Value, AppError> {
    backup::delete_backup(&state, &name)
}

#[tauri::command]
pub fn backup_download(
    state: State<'_, AppState>,
    name: Option<String>,
) -> Result<Value, AppError> {
    backup::download_backup(&state, name.as_deref())
}
