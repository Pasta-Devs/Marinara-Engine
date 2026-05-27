use super::{integrations, shared, translation};
use crate::state::AppState;
use marinara_core::AppError;
use serde_json::{json, Value};
use tauri::State;

#[tauri::command]
pub async fn tts_config(state: State<'_, AppState>) -> Result<Value, AppError> {
    integrations::tts_call(&state, "GET", &["config"], Value::Null).await
}

#[tauri::command]
pub async fn tts_update_config(
    state: State<'_, AppState>,
    config: Value,
) -> Result<Value, AppError> {
    integrations::tts_call(&state, "PUT", &["config"], config).await
}

#[tauri::command]
pub async fn tts_voices(state: State<'_, AppState>) -> Result<Value, AppError> {
    integrations::tts_call(&state, "GET", &["voices"], Value::Null).await
}

#[tauri::command]
pub async fn tts_speak(state: State<'_, AppState>, input: Value) -> Result<Value, AppError> {
    integrations::tts_call(&state, "POST", &["speak"], input).await
}

#[tauri::command]
pub async fn translate_text_command(
    state: State<'_, AppState>,
    input: Value,
) -> Result<Value, AppError> {
    translation::translate_text(&state, input).await
}

#[tauri::command]
pub async fn discord_webhook_send(body: Value) -> Result<Value, AppError> {
    integrations::discord_webhook_send(body).await
}

#[tauri::command]
pub async fn haptic_status() -> Result<Value, AppError> {
    integrations::haptic_call(&["status"], Value::Null).await
}

#[tauri::command]
pub async fn haptic_connect(body: Option<Value>) -> Result<Value, AppError> {
    integrations::haptic_call(&["connect"], body.unwrap_or(Value::Null)).await
}

#[tauri::command]
pub async fn haptic_disconnect() -> Result<Value, AppError> {
    integrations::haptic_call(&["disconnect"], Value::Null).await
}

#[tauri::command]
pub async fn haptic_start_scan() -> Result<Value, AppError> {
    integrations::haptic_call(&["scan", "start"], Value::Null).await
}

#[tauri::command]
pub async fn haptic_stop_scan() -> Result<Value, AppError> {
    integrations::haptic_call(&["scan", "stop"], Value::Null).await
}

#[tauri::command]
pub async fn haptic_command(command: Value) -> Result<Value, AppError> {
    integrations::haptic_call(&["command"], command).await
}

#[tauri::command]
pub async fn haptic_stop_all() -> Result<Value, AppError> {
    integrations::haptic_call(&["stop-all"], Value::Null).await
}

async fn spotify_direct(
    state: State<'_, AppState>,
    method: &str,
    rest: &[&str],
    body: Value,
) -> Result<Value, AppError> {
    integrations::spotify_call(
        &state,
        method,
        rest,
        &shared::ParsedPath::new("/spotify"),
        body,
    )
    .await
}

#[tauri::command]
pub async fn spotify_status(
    state: State<'_, AppState>,
    body: Option<Value>,
) -> Result<Value, AppError> {
    spotify_direct(state, "POST", &["status"], body.unwrap_or(Value::Null)).await
}

#[tauri::command]
pub async fn spotify_authorize(
    state: State<'_, AppState>,
    input: Value,
) -> Result<Value, AppError> {
    let response = spotify_direct(state, "POST", &["authorize"], input).await?;
    let auth_url = response
        .get("authUrl")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            AppError::new(
                "spotify_authorize_failed",
                "Authorize request did not return an auth URL",
            )
        })?;
    tauri_plugin_opener::open_url(auth_url, None::<&str>)
        .map_err(|error| AppError::new("spotify_authorize_open_failed", error.to_string()))?;
    Ok(response)
}

#[tauri::command]
pub async fn spotify_exchange(
    state: State<'_, AppState>,
    callback_url: String,
) -> Result<Value, AppError> {
    spotify_direct(
        state,
        "POST",
        &["exchange"],
        json!({ "callbackUrl": callback_url }),
    )
    .await
}

#[tauri::command]
pub async fn spotify_disconnect(
    state: State<'_, AppState>,
    body: Option<Value>,
) -> Result<Value, AppError> {
    spotify_direct(state, "POST", &["disconnect"], body.unwrap_or(Value::Null)).await
}

#[tauri::command]
pub async fn spotify_player(
    state: State<'_, AppState>,
    body: Option<Value>,
) -> Result<Value, AppError> {
    spotify_direct(state, "GET", &["player"], body.unwrap_or(Value::Null)).await
}

#[tauri::command]
pub async fn spotify_devices(
    state: State<'_, AppState>,
    body: Option<Value>,
) -> Result<Value, AppError> {
    spotify_direct(state, "GET", &["devices"], body.unwrap_or(Value::Null)).await
}

#[tauri::command]
pub async fn spotify_access_token(
    state: State<'_, AppState>,
    body: Option<Value>,
) -> Result<Value, AppError> {
    spotify_direct(state, "GET", &["access-token"], body.unwrap_or(Value::Null)).await
}

#[tauri::command]
pub async fn spotify_playlists(
    state: State<'_, AppState>,
    agent_id: Option<String>,
    limit: Option<u32>,
) -> Result<Value, AppError> {
    let route =
        shared::ParsedPath::new(&format!("/spotify/playlists?limit={}", limit.unwrap_or(50)));
    integrations::spotify_call(
        &state,
        "GET",
        &["playlists"],
        &route,
        json!({ "agentId": agent_id }),
    )
    .await
}

#[tauri::command]
pub async fn spotify_playlist_tracks(
    state: State<'_, AppState>,
    input: Value,
) -> Result<Value, AppError> {
    spotify_direct(state, "POST", &["playlist-tracks"], input).await
}

#[tauri::command]
pub async fn spotify_search_tracks(
    state: State<'_, AppState>,
    input: Value,
) -> Result<Value, AppError> {
    spotify_direct(state, "POST", &["search-tracks"], input).await
}

#[tauri::command]
pub async fn spotify_play_track(
    state: State<'_, AppState>,
    input: Value,
) -> Result<Value, AppError> {
    spotify_direct(state, "POST", &["play-track"], input).await
}

#[tauri::command]
pub async fn spotify_dj_mari_playlist(
    state: State<'_, AppState>,
    input: Value,
) -> Result<Value, AppError> {
    spotify_direct(state, "POST", &["dj-mari-playlist"], input).await
}

#[tauri::command]
pub async fn spotify_player_play(
    state: State<'_, AppState>,
    body: Option<Value>,
) -> Result<Value, AppError> {
    spotify_direct(
        state,
        "PUT",
        &["player", "play"],
        body.unwrap_or(Value::Null),
    )
    .await
}

#[tauri::command]
pub async fn spotify_player_pause(
    state: State<'_, AppState>,
    body: Option<Value>,
) -> Result<Value, AppError> {
    spotify_direct(
        state,
        "PUT",
        &["player", "pause"],
        body.unwrap_or(Value::Null),
    )
    .await
}

#[tauri::command]
pub async fn spotify_player_next(
    state: State<'_, AppState>,
    body: Option<Value>,
) -> Result<Value, AppError> {
    spotify_direct(
        state,
        "POST",
        &["player", "next"],
        body.unwrap_or(Value::Null),
    )
    .await
}

#[tauri::command]
pub async fn spotify_player_previous(
    state: State<'_, AppState>,
    body: Option<Value>,
) -> Result<Value, AppError> {
    spotify_direct(
        state,
        "POST",
        &["player", "previous"],
        body.unwrap_or(Value::Null),
    )
    .await
}

#[tauri::command]
pub async fn spotify_player_transfer(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    spotify_direct(state, "PUT", &["player", "transfer"], body).await
}

#[tauri::command]
pub async fn spotify_player_volume(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    spotify_direct(state, "PUT", &["player", "volume"], body).await
}

#[tauri::command]
pub async fn spotify_player_shuffle(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    spotify_direct(state, "PUT", &["player", "shuffle"], body).await
}

#[tauri::command]
pub async fn spotify_player_repeat(
    state: State<'_, AppState>,
    body: Value,
) -> Result<Value, AppError> {
    spotify_direct(state, "PUT", &["player", "repeat"], body).await
}
