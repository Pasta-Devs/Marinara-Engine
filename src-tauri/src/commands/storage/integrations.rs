use super::shared::ParsedPath;
use super::*;

#[path = "integrations/discord.rs"]
mod discord;
#[path = "integrations/haptic.rs"]
mod haptic;
#[path = "integrations/spotify.rs"]
mod spotify;
#[path = "integrations/spotify_callback.rs"]
mod spotify_callback;
#[path = "integrations/spotify_query.rs"]
mod spotify_query;
#[path = "integrations/tts.rs"]
mod tts;

pub(crate) async fn tts_call(
    state: &AppState,
    method: &str,
    rest: &[&str],
    body: Value,
) -> AppResult<Value> {
    tts::tts_call(state, method, rest, body).await
}

pub(crate) async fn spotify_call(
    state: &AppState,
    method: &str,
    rest: &[&str],
    route: &ParsedPath,
    body: Value,
) -> AppResult<Value> {
    spotify::spotify_call(state, method, rest, route, body).await
}

pub(crate) async fn haptic_call(rest: &[&str], body: Value) -> AppResult<Value> {
    haptic::haptic_call(rest, body).await
}

pub(crate) async fn discord_webhook_send(body: Value) -> AppResult<Value> {
    discord::discord_webhook_send(body).await
}
