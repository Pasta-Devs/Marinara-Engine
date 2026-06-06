use super::{chats, shared};
use crate::state::AppState;
use marinara_core::AppError;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub fn chat_memories_list(
    state: State<'_, AppState>,
    chat_id: String,
    limit: Option<u32>,
    order: Option<String>,
    exclude_recent_message_ids: Option<Vec<String>>,
    exclude_recent_start_at: Option<String>,
) -> Result<Value, AppError> {
    let exclude_recent_message_ids = exclude_recent_message_ids.unwrap_or_default();
    chats::list_chat_memories_excluding_recent(
        &state,
        &chat_id,
        limit.map(|value| value as usize),
        order.as_deref(),
        &exclude_recent_message_ids,
        exclude_recent_start_at.as_deref(),
    )
}

#[tauri::command]
pub fn chat_memory_delete(
    state: State<'_, AppState>,
    chat_id: String,
    memory_id: String,
) -> Result<Value, AppError> {
    chats::delete_chat_memory(&state, &chat_id, &memory_id)
}

#[tauri::command]
pub fn chat_memories_clear(state: State<'_, AppState>, chat_id: String) -> Result<Value, AppError> {
    chats::set_chat_array_field(&state, &chat_id, "memories", Vec::new())
}

#[tauri::command]
pub async fn chat_memories_refresh(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<Value, AppError> {
    chats::refresh_chat_memories(&state, &chat_id).await
}

#[tauri::command]
pub fn chat_memories_export(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<Value, AppError> {
    chats::export_chat_memories(&state, &chat_id)
}

#[tauri::command]
pub async fn chat_memories_import(
    state: State<'_, AppState>,
    chat_id: String,
    body: Value,
) -> Result<Value, AppError> {
    chats::import_chat_memories(&state, &chat_id, body).await
}

#[tauri::command]
pub fn chat_notes_list(state: State<'_, AppState>, chat_id: String) -> Result<Value, AppError> {
    chats::chat_array_field(&state, &chat_id, "notes")
}

#[tauri::command]
pub fn chat_note_delete(
    state: State<'_, AppState>,
    chat_id: String,
    note_id: String,
) -> Result<Value, AppError> {
    chats::delete_chat_array_item(&state, &chat_id, "notes", &note_id)
}

#[tauri::command]
pub fn chat_notes_clear(state: State<'_, AppState>, chat_id: String) -> Result<Value, AppError> {
    chats::set_chat_array_field(&state, &chat_id, "notes", Vec::new())
}

#[tauri::command]
pub async fn chat_group_delete(
    state: State<'_, AppState>,
    group_id: String,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || chats::delete_chat_group(&state, &group_id))
        .await
        .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

#[tauri::command]
pub fn chat_autonomous_unread_mark(
    state: State<'_, AppState>,
    chat_id: String,
    body: Value,
) -> Result<Value, AppError> {
    chats::mark_autonomous_unread(&state, &chat_id, body)
}

#[tauri::command]
pub fn chat_autonomous_unread_clear(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<Value, AppError> {
    chats::clear_autonomous_unread(&state, &chat_id)
}

#[tauri::command]
pub fn chat_messages_bulk_delete(
    state: State<'_, AppState>,
    chat_id: String,
    message_ids: Vec<String>,
) -> Result<Value, AppError> {
    chats::bulk_delete_messages(&state, &chat_id, json!({ "messageIds": message_ids }))
}

#[tauri::command]
pub fn chat_message_count(state: State<'_, AppState>, chat_id: String) -> Result<Value, AppError> {
    Ok(json!({ "count": state.storage.count_messages_for_chat(&chat_id)? }))
}

#[tauri::command]
pub fn chat_branch(
    state: State<'_, AppState>,
    chat_id: String,
    up_to_message_id: Option<String>,
) -> Result<Value, AppError> {
    chats::branch_chat(
        &state,
        &chat_id,
        json!({ "upToMessageId": up_to_message_id }),
    )
}

#[tauri::command]
pub fn chat_message_swipes(
    state: State<'_, AppState>,
    chat_id: String,
    message_id: String,
) -> Result<Value, AppError> {
    chats::message_swipes(&state, "GET", &chat_id, &message_id, Value::Null)
}

#[tauri::command]
pub fn chat_message_add_swipe(
    state: State<'_, AppState>,
    chat_id: String,
    message_id: String,
    body: Value,
) -> Result<Value, AppError> {
    Ok(shared::project_timeline_message(chats::message_swipes(
        &state,
        "POST",
        &chat_id,
        &message_id,
        body,
    )?))
}

#[tauri::command]
pub fn chat_message_update_content_if_unchanged(
    state: State<'_, AppState>,
    chat_id: String,
    message_id: String,
    expected_content: String,
    content: String,
) -> Result<Value, AppError> {
    chats::update_message_content_if_unchanged(
        &state,
        &chat_id,
        &message_id,
        &expected_content,
        &content,
    )
}

#[tauri::command]
pub async fn chat_message_set_active_swipe(
    state: State<'_, AppState>,
    chat_id: String,
    message_id: String,
    index: i64,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        Ok(shared::project_timeline_message(chats::set_active_swipe(
            &state,
            &chat_id,
            &message_id,
            json!({ "index": index }),
        )?))
    })
    .await
    .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

#[tauri::command]
pub fn chat_message_delete_swipe(
    state: State<'_, AppState>,
    chat_id: String,
    message_id: String,
    index: String,
) -> Result<Value, AppError> {
    Ok(shared::project_timeline_message(chats::delete_swipe(
        &state,
        &chat_id,
        &message_id,
        &index,
    )?))
}

#[tauri::command]
pub async fn chat_evict_prompt_snapshots(
    state: State<'_, AppState>,
    chat_id: String,
    keep_last: Option<i64>,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let keep_last = keep_last.unwrap_or(2).max(0) as usize;
        chats::evict_prompt_snapshots(&state, &chat_id, keep_last)
    })
    .await
    .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

#[tauri::command]
pub fn chat_connect(
    state: State<'_, AppState>,
    chat_id: String,
    target_chat_id: String,
) -> Result<Value, AppError> {
    state.storage.patch(
        "chats",
        &chat_id,
        json!({ "connectedChatId": target_chat_id.clone() }),
    )?;
    state.storage.patch(
        "chats",
        &target_chat_id,
        json!({ "connectedChatId": chat_id }),
    )?;
    Ok(json!({ "connected": true }))
}

#[tauri::command]
pub fn chat_disconnect(state: State<'_, AppState>, chat_id: String) -> Result<Value, AppError> {
    chats::disconnect_connected_chat(&state, &chat_id)
}
