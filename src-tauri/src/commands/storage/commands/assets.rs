use super::{backgrounds, fonts, game_assets, http, lorebook_images, managed_thumbnails, shared};
use crate::state::AppState;
use marinara_core::AppError;
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub fn backgrounds_list(state: State<'_, AppState>) -> Result<Value, AppError> {
    backgrounds::backgrounds_call(&state, "GET", &[], Value::Null)
}

#[tauri::command]
pub fn backgrounds_tags(state: State<'_, AppState>) -> Result<Value, AppError> {
    backgrounds::backgrounds_call(&state, "GET", &["tags"], Value::Null)
}

#[tauri::command]
pub fn background_upload(state: State<'_, AppState>, body: Value) -> Result<Value, AppError> {
    backgrounds::backgrounds_call(&state, "POST", &["upload"], body)
}

#[tauri::command]
pub fn background_delete(state: State<'_, AppState>, filename: String) -> Result<Value, AppError> {
    backgrounds::backgrounds_call(&state, "DELETE", &[filename.as_str()], Value::Null)
}

#[tauri::command]
pub fn background_tags_update(
    state: State<'_, AppState>,
    filename: String,
    tags: Vec<String>,
) -> Result<Value, AppError> {
    backgrounds::backgrounds_call(
        &state,
        "PATCH",
        &[filename.as_str(), "tags"],
        json!({ "tags": tags }),
    )
}

#[tauri::command]
pub fn background_rename(
    state: State<'_, AppState>,
    filename: String,
    name: String,
) -> Result<Value, AppError> {
    backgrounds::backgrounds_call(
        &state,
        "PATCH",
        &[filename.as_str(), "rename"],
        json!({ "name": name }),
    )
}

#[tauri::command]
pub async fn fonts_list(state: State<'_, AppState>) -> Result<Value, AppError> {
    fonts::fonts_call(&state, "GET", &[], Value::Null).await
}

#[tauri::command]
pub async fn fonts_google_download(
    state: State<'_, AppState>,
    family: String,
) -> Result<Value, AppError> {
    fonts::fonts_call(
        &state,
        "POST",
        &["google", "download"],
        json!({ "family": family }),
    )
    .await
}

#[tauri::command]
pub async fn fonts_open_folder(state: State<'_, AppState>) -> Result<Value, AppError> {
    fonts::fonts_call(&state, "POST", &["open-folder"], Value::Null).await
}

#[tauri::command]
pub fn game_assets_list(
    state: State<'_, AppState>,
    path: Option<String>,
) -> Result<Value, AppError> {
    Ok(json!({
        "items": state.game_assets.list(path.as_deref())?,
        "root": state.game_assets.root().to_string_lossy()
    }))
}

#[tauri::command]
pub fn game_assets_manifest(state: State<'_, AppState>) -> Result<Value, AppError> {
    game_assets::game_assets_manifest(&state)
}

#[tauri::command]
pub fn game_assets_tree(state: State<'_, AppState>) -> Result<Value, AppError> {
    game_assets::game_assets_tree(&state)
}

#[tauri::command]
pub fn game_assets_rescan(state: State<'_, AppState>) -> Result<Value, AppError> {
    game_assets::game_assets_rescan(&state)
}

#[tauri::command]
pub fn game_assets_create_folder(
    state: State<'_, AppState>,
    path: String,
) -> Result<Value, AppError> {
    state.game_assets.create_folder(&path)?;
    Ok(json!({ "path": path }))
}

#[tauri::command]
pub fn game_assets_delete_folder(
    state: State<'_, AppState>,
    path: String,
    recursive: Option<bool>,
) -> Result<Value, AppError> {
    state
        .game_assets
        .remove(&path, recursive.unwrap_or(false))?;
    Ok(json!({ "deleted": true }))
}

#[tauri::command]
pub fn game_assets_delete_file(
    state: State<'_, AppState>,
    path: String,
) -> Result<Value, AppError> {
    managed_thumbnails::remove_managed_thumbnail_files(
        &state,
        managed_thumbnails::ManagedThumbnailKind::Game,
        &path,
    );
    state.game_assets.remove(&path, false)?;
    Ok(json!({ "deleted": true }))
}

#[tauri::command]
pub fn game_assets_file_path(state: State<'_, AppState>, path: String) -> Result<Value, AppError> {
    Ok(json!({ "path": state.game_assets.absolute_path_string(&path)? }))
}

#[tauri::command]
pub fn game_assets_read_text(state: State<'_, AppState>, path: String) -> Result<Value, AppError> {
    Ok(json!({ "content": state.game_assets.read_text(&path)? }))
}

#[tauri::command]
pub fn game_assets_write_text(
    state: State<'_, AppState>,
    path: String,
    content: String,
) -> Result<Value, AppError> {
    state.game_assets.write_text(&path, &content)?;
    Ok(json!({ "saved": true }))
}

#[tauri::command]
pub fn game_assets_rename(
    state: State<'_, AppState>,
    path: String,
    new_name: String,
) -> Result<Value, AppError> {
    managed_thumbnails::remove_managed_thumbnail_files(
        &state,
        managed_thumbnails::ManagedThumbnailKind::Game,
        &path,
    );
    state.game_assets.rename(&path, &new_name)
}

#[tauri::command]
pub fn game_assets_move(
    state: State<'_, AppState>,
    path: String,
    target_folder: Option<String>,
) -> Result<Value, AppError> {
    managed_thumbnails::remove_managed_thumbnail_files(
        &state,
        managed_thumbnails::ManagedThumbnailKind::Game,
        &path,
    );
    state
        .game_assets
        .move_to_folder(&path, target_folder.as_deref().unwrap_or(""))
}

#[tauri::command]
pub fn game_assets_copy(
    state: State<'_, AppState>,
    path: String,
    target_folder: Option<String>,
) -> Result<Value, AppError> {
    state
        .game_assets
        .copy_to_folder(&path, target_folder.as_deref().unwrap_or(""))
}

#[tauri::command]
pub fn game_assets_move_bulk(
    state: State<'_, AppState>,
    paths: Vec<String>,
    target_folder: Option<String>,
) -> Result<Value, AppError> {
    for path in &paths {
        managed_thumbnails::remove_managed_thumbnail_files(
            &state,
            managed_thumbnails::ManagedThumbnailKind::Game,
            path,
        );
    }
    Ok(state
        .game_assets
        .move_many(&paths, target_folder.as_deref().unwrap_or("")))
}

#[tauri::command]
pub fn game_assets_copy_bulk(
    state: State<'_, AppState>,
    paths: Vec<String>,
    target_folder: Option<String>,
) -> Result<Value, AppError> {
    Ok(state
        .game_assets
        .copy_many(&paths, target_folder.as_deref().unwrap_or("")))
}

#[tauri::command]
pub fn game_assets_delete_bulk(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<Value, AppError> {
    for path in &paths {
        managed_thumbnails::remove_managed_thumbnail_files(
            &state,
            managed_thumbnails::ManagedThumbnailKind::Game,
            path,
        );
    }
    Ok(state.game_assets.delete_many(&paths))
}

#[tauri::command]
pub fn game_assets_file_info(state: State<'_, AppState>, path: String) -> Result<Value, AppError> {
    state.game_assets.file_info(&path)
}

#[tauri::command]
pub fn game_assets_folder_description(
    state: State<'_, AppState>,
    path: String,
    description: String,
) -> Result<Value, AppError> {
    game_assets::game_assets_folder_description(
        &state,
        json!({ "path": path, "description": description }),
    )
}

#[tauri::command]
pub fn game_assets_upload(state: State<'_, AppState>, body: Value) -> Result<Value, AppError> {
    game_assets::game_assets_upload(&state, body)
}

#[tauri::command]
pub fn game_assets_open_folder(
    state: State<'_, AppState>,
    subfolder: Option<String>,
) -> Result<Value, AppError> {
    game_assets::game_assets_open_folder(&state, json!({ "subfolder": subfolder }))
}

#[tauri::command]
pub fn background_file_path(
    state: State<'_, AppState>,
    filename: String,
) -> Result<Value, AppError> {
    Ok(json!({ "path": state.backgrounds.absolute_path_string(&filename)? }))
}

#[tauri::command]
pub fn lorebook_image_file_path(
    state: State<'_, AppState>,
    filename: String,
) -> Result<Value, AppError> {
    lorebook_images::lorebook_image_file_path(&state, &filename)
}

#[tauri::command]
pub fn managed_asset_thumbnail_file_path(
    state: State<'_, AppState>,
    kind: String,
    path: String,
    size: Option<u32>,
) -> Result<Value, AppError> {
    managed_thumbnails::managed_asset_thumbnail_file_path(&state, &kind, &path, size)
}

#[tauri::command]
pub async fn gif_search(
    q: Option<String>,
    limit: Option<u32>,
    pos: Option<String>,
) -> Result<Value, AppError> {
    let mut query = HashMap::new();
    if let Some(q) = q {
        query.insert("q".to_string(), q);
    }
    if let Some(limit) = limit {
        query.insert("limit".to_string(), limit.to_string());
    }
    if let Some(pos) = pos {
        query.insert("pos".to_string(), pos);
    }
    http::gifs_search(&shared::ParsedPath {
        parts: Vec::new(),
        query,
    })
    .await
}
