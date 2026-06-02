use super::{
    avatars, characters, generation, images, llm, lorebook_images, personas, shared, sprites,
};
use crate::state::AppState;
use marinara_core::AppError;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub fn sprite_capabilities_command(state: State<'_, AppState>) -> Result<Value, AppError> {
    sprites::sprite_capabilities(&state)
}

#[tauri::command]
pub fn sprite_cleanup_status_command(state: State<'_, AppState>) -> Result<Value, AppError> {
    sprites::sprite_cleanup_status(&state)
}

#[tauri::command]
pub async fn sprite_generate_sheet_preview(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    sprites::generate_sprite_sheet_preview(&state, body).await
}

#[tauri::command]
pub async fn sprite_generate_sheet(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    sprites::generate_sprite_sheet(&state, body).await
}

#[tauri::command]
pub fn sprite_cleanup(state: State<'_, AppState>, body: Value) -> Result<Value, AppError> {
    sprites::cleanup_generated_sprites(&state, body)
}

#[tauri::command]
pub fn sprite_list(
    state: State<'_, AppState>,
    character_id: String,
    owner_type: Option<String>,
) -> Result<Value, AppError> {
    sprites::list_sprites(&state, &character_id, owner_type.as_deref())
}

#[tauri::command]
pub fn sprite_upload(
    state: State<'_, AppState>,
    character_id: String,
    owner_type: Option<String>,
    body: Value,
) -> Result<Value, AppError> {
    sprites::upload_sprite(&state, &character_id, body, owner_type.as_deref())
}

#[tauri::command]
pub fn sprite_upload_bulk(
    state: State<'_, AppState>,
    character_id: String,
    owner_type: Option<String>,
    body: Value,
) -> Result<Value, AppError> {
    sprites::upload_sprites(&state, &character_id, body, owner_type.as_deref())
}

#[tauri::command]
pub fn sprite_delete(
    state: State<'_, AppState>,
    character_id: String,
    owner_type: Option<String>,
    expression: String,
) -> Result<Value, AppError> {
    sprites::delete_sprite(&state, &character_id, &expression, owner_type.as_deref())
}

#[tauri::command]
pub fn sprite_cleanup_saved(
    state: State<'_, AppState>,
    character_id: String,
    owner_type: Option<String>,
    body: Value,
) -> Result<Value, AppError> {
    sprites::clean_saved_sprites(&state, &character_id, body, owner_type.as_deref())
}

#[tauri::command]
pub fn sprite_cleanup_restore(
    state: State<'_, AppState>,
    character_id: String,
    owner_type: Option<String>,
    body: Value,
) -> Result<Value, AppError> {
    sprites::restore_sprite_cleanup_point(&state, &character_id, body, owner_type.as_deref())
}

#[tauri::command]
pub fn avatar_generation_preview_command(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    images::avatar_generation_preview(&state, body)
}

#[tauri::command]
pub async fn avatar_generation_command(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    images::avatar_generation(&state, body).await
}

#[tauri::command]
pub async fn image_generate(state: State<'_, AppState>, body: Value) -> Result<Value, AppError> {
    images::generate_image(&state, body).await
}

#[tauri::command]
pub fn character_gallery_upload(
    state: State<'_, AppState>,
    character_id: String,
    body: Value,
) -> Result<Value, AppError> {
    shared::upload_gallery_image(
        &state,
        "character-gallery",
        "characterId",
        &character_id,
        body,
    )
}

#[tauri::command]
pub fn chat_gallery_upload(
    state: State<'_, AppState>,
    chat_id: String,
    body: Value,
) -> Result<Value, AppError> {
    shared::upload_gallery_image(&state, "gallery", "chatId", &chat_id, body)
}

#[tauri::command]
pub async fn connection_test(state: State<'_, AppState>, id: String) -> Result<Value, AppError> {
    generation::test_connection(&state, &id).await
}

#[tauri::command]
pub async fn connection_test_message(
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    generation::test_message(&state, &id).await
}

#[tauri::command]
pub async fn connection_test_image(
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    images::test_image_generation(&state, &id).await
}

#[tauri::command]
pub async fn connection_models(state: State<'_, AppState>, id: String) -> Result<Value, AppError> {
    llm::connection_models(&state, &id).await
}

#[tauri::command]
pub async fn connection_diagnose_claude_subscription(
    state: State<'_, AppState>,
    id: String,
) -> Result<Value, AppError> {
    llm::connection_diagnose_claude_subscription(&state, &id).await
}

#[tauri::command]
pub fn connection_save_default_parameters(
    state: State<'_, AppState>,
    id: String,
    params: Value,
) -> Result<Value, AppError> {
    state
        .storage
        .patch("connections", &id, json!({ "defaultParameters": params }))
}

#[tauri::command]
pub fn persona_activate(state: State<'_, AppState>, id: String) -> Result<Value, AppError> {
    personas::activate_persona(&state, &id)
}

#[tauri::command]
pub fn character_avatar_upload(
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    avatars::update_character_avatar(&state, "characters", &id, body)
}

#[tauri::command]
pub fn character_avatar_remove(state: State<'_, AppState>, id: String) -> Result<Value, AppError> {
    avatars::remove_character_avatar(&state, &id)
}

#[tauri::command]
pub fn avatar_thumbnail_file_path(
    state: State<'_, AppState>,
    filename: Option<String>,
    absolute_path: Option<String>,
    source_url: Option<String>,
    size: Option<u32>,
) -> Result<Value, AppError> {
    avatars::avatar_thumbnail_file_path(
        &state,
        filename.as_deref(),
        absolute_path.as_deref(),
        source_url.as_deref(),
        size,
    )
}

#[tauri::command]
pub fn character_restore_version(
    state: State<'_, AppState>,
    character_id: String,
    version_id: String,
) -> Result<Value, AppError> {
    characters::restore_character_version(&state, &character_id, &version_id)
}

#[tauri::command]
pub fn persona_avatar_upload(
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    avatars::update_character_avatar(&state, "personas", &id, body)
}

#[tauri::command]
pub fn npc_avatar_upload(
    state: State<'_, AppState>,
    chat_id: String,
    body: Value,
) -> Result<Value, AppError> {
    avatars::update_npc_avatar(&state, &chat_id, body)
}

#[tauri::command]
pub fn lorebook_image_upload(
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, AppError> {
    lorebook_images::update_lorebook_image(&state, &id, body)
}

#[tauri::command]
pub async fn llm_complete(state: State<'_, AppState>, request: Value) -> Result<Value, AppError> {
    llm::llm_complete(&state, request).await
}

#[tauri::command]
pub async fn llm_embed(state: State<'_, AppState>, body: Value) -> Result<Value, AppError> {
    llm::llm_embed(&state, body).await
}

#[tauri::command]
pub async fn llm_stream_channel(
    state: State<'_, AppState>,
    stream_id: String,
    request: Value,
    on_event: tauri::ipc::Channel<Value>,
) -> Result<(), AppError> {
    llm::llm_stream_channel(&state, stream_id, request, on_event).await
}

#[tauri::command]
pub fn llm_stream_cancel(state: State<'_, AppState>, stream_id: String) -> Result<Value, AppError> {
    llm::llm_stream_cancel(&state, &stream_id)
}

#[tauri::command]
pub async fn llm_list_models(
    state: State<'_, AppState>,
    connection_id: Option<String>,
) -> Result<Value, AppError> {
    llm::llm_models(&state, connection_id.as_deref()).await
}
