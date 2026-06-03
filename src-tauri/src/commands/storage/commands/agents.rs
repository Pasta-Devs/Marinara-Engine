use super::{admin, agents, custom_tools};
use crate::state::AppState;
use marinara_core::AppError;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub async fn custom_tool_execute(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    custom_tools::execute_custom_tool(&state, body).await
}

#[tauri::command]
pub fn custom_tool_capabilities() -> Result<Value, AppError> {
    Ok(custom_tools::custom_tool_capabilities())
}

#[tauri::command]
pub fn agent_patch_by_type(
    state: State<'_, AppState>,
    agent_type: String,
    patch: Value,
) -> Result<Value, AppError> {
    agents::patch_agent_type(&state, &agent_type, patch)
}

#[tauri::command]
pub fn agent_toggle_by_type(
    state: State<'_, AppState>,
    agent_type: String,
) -> Result<Value, AppError> {
    agents::toggle_agent_type(&state, &agent_type)
}

#[tauri::command]
pub fn agent_cadence_status(
    state: State<'_, AppState>,
    agent_type: String,
    chat_id: String,
) -> Result<Value, AppError> {
    agents::agent_cadence_status(&state, &agent_type, &chat_id)
}

#[tauri::command]
pub fn admin_expunge_command(
    state: State<'_, AppState>,
    scopes: Vec<String>,
) -> Result<Value, AppError> {
    admin::admin_expunge(&state, json!({ "confirm": true, "scopes": scopes }))
}

#[tauri::command]
pub fn admin_clear_all_command(
    state: State<'_, AppState>,
    confirm: Option<bool>,
) -> Result<Value, AppError> {
    admin::admin_clear_all(&state, json!({ "confirm": confirm }))
}

#[tauri::command]
pub fn agent_memory_get(
    state: State<'_, AppState>,
    agent_type: String,
    chat_id: String,
) -> Result<Value, AppError> {
    agents::agent_memory(&state, "GET", &agent_type, &chat_id, Value::Null)
}

#[tauri::command]
pub fn agent_memory_patch(
    state: State<'_, AppState>,
    agent_type: String,
    chat_id: String,
    patch: Value,
) -> Result<Value, AppError> {
    agents::agent_memory(
        &state,
        "PATCH",
        &agent_type,
        &chat_id,
        json!({ "patch": patch }),
    )
}

#[tauri::command]
pub fn agent_memory_clear(
    state: State<'_, AppState>,
    agent_type: String,
    chat_id: String,
) -> Result<Value, AppError> {
    agents::agent_memory(&state, "DELETE", &agent_type, &chat_id, Value::Null)
}

#[tauri::command]
pub fn agent_runs_clear_for_chat(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<Value, AppError> {
    agents::clear_agent_runs_and_memory_for_chat(&state, &chat_id)
}

#[tauri::command]
pub fn agent_echo_messages_clear(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<Value, AppError> {
    agents::echo_messages(&state, "DELETE", &chat_id)
}
