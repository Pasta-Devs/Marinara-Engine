use super::game_state_snapshots;
use crate::state::AppState;
use marinara_core::AppError;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn tracker_snapshot_latest(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        Ok(game_state_snapshots::latest_tracker_snapshot(&state, &chat_id)?.unwrap_or(Value::Null))
    })
    .await
    .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

#[tauri::command]
pub async fn tracker_snapshot_get(
    state: State<'_, AppState>,
    chat_id: String,
    message_id: String,
    swipe_index: i64,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        Ok(game_state_snapshots::tracker_snapshot_for_target(
            &state,
            &chat_id,
            &message_id,
            swipe_index,
        )?
        .unwrap_or(Value::Null))
    })
    .await
    .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

#[tauri::command]
pub async fn tracker_snapshot_save(
    state: State<'_, AppState>,
    chat_id: String,
    snapshot: Value,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        game_state_snapshots::save_tracker_snapshot(&state, &chat_id, snapshot)
    })
    .await
    .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}
