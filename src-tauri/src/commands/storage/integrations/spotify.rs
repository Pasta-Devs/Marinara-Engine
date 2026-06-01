use super::super::connection_secrets;
use super::super::images::percent_encode_component;
use super::super::shared::*;
use super::super::*;
use super::spotify_callback::start_callback_listener;

const SPOTIFY_SCOPES: &str = "streaming user-modify-playback-state user-read-playback-state user-read-currently-playing user-read-private playlist-read-private playlist-modify-public playlist-modify-private user-library-read";
const SPOTIFY_REDIRECT_URI: &str = "http://127.0.0.1:8754/spotify/callback";
const AUTH_TTL_MS: u128 = 10 * 60_000;
const DJ_MARI_MIN_TRACKS: usize = 25;
const DJ_MARI_MAX_TRACKS: usize = 50;
const DJ_MARI_OUTPUT_TOKENS: u64 = 8192;
const RECENT_CHAT_MESSAGE_LIMIT: usize = 8;
const LIKED_SONG_EXAMPLE_LIMIT: u32 = 50;
const SPOTIFY_MIN_TITLE_SIMILARITY: f64 = 0.7;
const SPOTIFY_MIN_ARTIST_SIMILARITY: f64 = 0.2;
const SPOTIFY_MIN_MATCH_SCORE: f64 = 70.0;
const SPOTIFY_ACCESS_TOKEN_ENCRYPTED_KEY: &str = "spotifyAccessTokenEncrypted";
const SPOTIFY_REFRESH_TOKEN_ENCRYPTED_KEY: &str = "spotifyRefreshTokenEncrypted";

#[derive(Clone)]
struct SpotifyTrack {
    uri: String,
    name: String,
    artist: String,
    album: Option<String>,
    image_url: Option<String>,
    duration_ms: Option<Value>,
}

#[derive(Clone)]
struct GeneratedTrack {
    title: String,
    artist: String,
    reason: Option<String>,
}

#[derive(Clone)]
struct MatchedTrack {
    track: SpotifyTrack,
    requested_title: String,
    requested_artist: String,
    reason: Option<String>,
}

pub(crate) async fn spotify_call(
    state: &AppState,
    method: &str,
    rest: &[&str],
    route: &ParsedPath,
    body: Value,
) -> AppResult<Value> {
    match (method, rest) {
        ("GET", ["authorize"]) | ("POST", ["authorize"]) => authorize(state, route, &body),
        ("POST", ["exchange"]) => exchange(state, body).await,
        ("POST", ["refresh"]) => {
            let agent_id = string_param(route, &body, "agentId")
                .ok_or_else(|| AppError::invalid_input("agentId is required"))?;
            refresh_agent_token(state, &agent_id)
                .await
                .map(|_| json!({ "success": true }))
        }
        ("GET", ["status"]) | ("POST", ["status"]) => status(state, route, &body),
        ("GET", ["access-token"]) => access_token(state, route, &body).await,
        ("GET", ["player"]) => player(state, route, &body).await,
        ("GET", ["devices"]) => devices(state, route, &body).await,
        ("GET", ["playlists"]) => playlists(state, route, &body).await,
        ("POST", ["playlist-tracks"]) => playlist_tracks(state, body).await,
        ("POST", ["search-tracks"]) => search_tracks(state, body).await,
        ("POST", ["play-track"]) => play_track(state, body).await,
        ("POST", ["dj-mari-playlist"]) => dj_mari_playlist(state, body).await,
        ("PUT", ["player", "play"]) => {
            player_control(state, route, body, "/me/player/play", "PUT").await
        }
        ("PUT", ["player", "pause"]) => {
            player_control(state, route, body, "/me/player/pause", "PUT").await
        }
        ("POST", ["player", "next"]) => {
            player_control(state, route, body, "/me/player/next", "POST").await
        }
        ("POST", ["player", "previous"]) => {
            player_control(state, route, body, "/me/player/previous", "POST").await
        }
        ("PUT", ["player", "volume"]) => player_volume(state, route, body).await,
        ("PUT", ["player", "shuffle"]) => player_shuffle(state, route, body).await,
        ("PUT", ["player", "repeat"]) => player_repeat(state, route, body).await,
        ("PUT", ["player", "transfer"]) => player_transfer(state, route, body).await,
        ("POST", ["disconnect"]) => disconnect(state, body),
        _ => Err(AppError::new(
            "route_not_found",
            format!("Unknown spotify route: {method} /{}", rest.join("/")),
        )),
    }
}

async fn search_tracks(state: &AppState, body: Value) -> AppResult<Value> {
    let query = body
        .get("query")
        .and_then(Value::as_str)
        .unwrap_or("cinematic adventure soundtrack");
    let limit = body
        .get("limit")
        .and_then(Value::as_u64)
        .unwrap_or(50)
        .clamp(1, 50) as u32;
    let recent = body
        .get("recentTrackUris")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .filter(|uri| uri.starts_with("spotify:track:"))
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let route = ParsedPath::new("");
    let credentials = resolve_credentials(state, &route, &body).await?;
    let source_type = spotify_source_type(&body);
    if source_type == "liked" {
        let tracks = spotify_candidate_tracks_from_path(
            &credentials,
            &format!("/me/tracks?limit={limit}&offset=0"),
            &recent,
        )
        .await?;
        return Ok(json!({
            "enabled": true,
            "tracks": tracks,
            "candidateMode": "liked",
            "source": "liked"
        }));
    }
    if source_type == "playlist" {
        let playlist_id = body
            .get("playlistId")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| {
                AppError::invalid_input("Spotify playlist source requires playlistId")
            })?;
        let tracks = spotify_candidate_tracks_from_path(
            &credentials,
            &format!(
                "/playlists/{}/tracks?limit={limit}&offset=0",
                percent_encode_component(playlist_id)
            ),
            &recent,
        )
        .await?;
        return Ok(json!({
            "enabled": true,
            "tracks": tracks,
            "candidateMode": "playlist",
            "source": "playlist",
            "playlistId": playlist_id,
            "playlistName": body.get("playlistName").cloned().unwrap_or(Value::Null)
        }));
    }
    let query = if source_type == "artist" {
        let artist = body
            .get("artist")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| AppError::invalid_input("Spotify artist source requires artist"))?;
        format!("artist:\"{artist}\" {query}")
    } else {
        query.to_string()
    };
    let params = form_urlencoded(&[
        ("q", &query),
        ("type", "track"),
        ("limit", &limit.to_string()),
    ]);
    let response = spotify_api(&credentials, &format!("/search?{params}"), "GET", None).await?;
    if !(200..300).contains(&response.status) {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify track search failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    let recent = recent
        .iter()
        .map(|uri| uri.as_str())
        .collect::<std::collections::HashSet<_>>();
    let mut tracks = response
        .json
        .get("tracks")
        .and_then(|tracks| tracks.get("items"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(map_track_candidate)
        .filter(|track| {
            track
                .get("uri")
                .and_then(Value::as_str)
                .is_some_and(|uri| !recent.contains(uri))
        })
        .collect::<Vec<_>>();
    if tracks.is_empty() {
        tracks = response
            .json
            .get("tracks")
            .and_then(|tracks| tracks.get("items"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(map_track_candidate)
            .collect();
    }
    Ok(json!({
        "enabled": true,
        "tracks": tracks,
        "candidateMode": if source_type == "artist" { "artist" } else { "spotify_search" },
        "source": if source_type == "artist" { "artist" } else { "spotify" },
        "artist": body.get("artist").cloned().unwrap_or(Value::Null)
    }))
}

fn spotify_source_type(body: &Value) -> &str {
    match body
        .get("sourceType")
        .and_then(Value::as_str)
        .unwrap_or("any")
        .trim()
    {
        "liked" => "liked",
        "playlist" => "playlist",
        "artist" => "artist",
        _ => "any",
    }
}

async fn spotify_candidate_tracks_from_path(
    credentials: &SpotifyCredentials,
    path: &str,
    recent: &[String],
) -> AppResult<Vec<Value>> {
    let response = spotify_api(credentials, path, "GET", None).await?;
    if !(200..300).contains(&response.status) {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify source tracks failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    let recent = recent
        .iter()
        .map(|uri| uri.as_str())
        .collect::<std::collections::HashSet<_>>();
    let all_tracks = response
        .json
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| item.get("track").cloned().or(Some(item)))
        .filter_map(map_track_candidate)
        .collect::<Vec<_>>();
    let filtered = all_tracks
        .iter()
        .filter(|track| {
            track
                .get("uri")
                .and_then(Value::as_str)
                .is_some_and(|uri| !recent.contains(uri))
        })
        .cloned()
        .collect::<Vec<_>>();
    Ok(if filtered.is_empty() {
        all_tracks
    } else {
        filtered
    })
}

async fn play_track(state: &AppState, body: Value) -> AppResult<Value> {
    let track = body
        .get("track")
        .ok_or_else(|| AppError::invalid_input("track is required"))?;
    let device_id = body.get("deviceId").and_then(Value::as_str);
    let mobile_device_only = body
        .get("mobileDeviceOnly")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    game_spotify_play(state, track, device_id, mobile_device_only).await
}

async fn playlist_tracks(state: &AppState, body: Value) -> AppResult<Value> {
    let playlist_id = body
        .get("playlistId")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::invalid_input("playlistId is required"))?;
    let limit = body
        .get("limit")
        .and_then(Value::as_u64)
        .unwrap_or(50)
        .clamp(1, 50) as u32;
    let offset = body
        .get("offset")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .min(10_000) as u32;
    let route = ParsedPath::new("");
    let credentials = resolve_credentials(state, &route, &body).await?;
    let path = if playlist_id == "liked" {
        format!("/me/tracks?limit={limit}&offset={offset}")
    } else {
        format!(
            "/playlists/{}/tracks?limit={limit}&offset={offset}",
            percent_encode_component(playlist_id)
        )
    };
    let response = spotify_api(&credentials, &path, "GET", None).await?;
    if !(200..300).contains(&response.status) {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify playlist tracks failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    let tracks = response
        .json
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| item.get("track").cloned().or(Some(item)))
        .filter_map(map_track_candidate)
        .collect::<Vec<_>>();
    Ok(json!({
        "tracks": tracks,
        "next": response.json.get("next").cloned().unwrap_or(Value::Null),
        "total": response.json.get("total").cloned().unwrap_or(Value::Null),
        "offset": offset,
        "limit": limit
    }))
}

pub(crate) async fn game_spotify_play(
    state: &AppState,
    track: &Value,
    device_id: Option<&str>,
    mobile_device_only: bool,
) -> AppResult<Value> {
    let uri = track
        .get("uri")
        .and_then(Value::as_str)
        .filter(|uri| uri.starts_with("spotify:track:"))
        .ok_or_else(|| AppError::invalid_input("A valid Spotify track URI is required"))?;
    let route = ParsedPath::new("");
    let body = Value::Null;
    let credentials = resolve_credentials(state, &route, &body).await?;
    let device_id = spotify_scene_device_id(&credentials, device_id, mobile_device_only).await?;
    let _ = spotify_player_repeat_command(&credentials, "off", device_id.as_deref()).await;
    let response = spotify_api_with_device_retry(
        &credentials,
        "/me/player/play",
        device_id.as_deref(),
        "PUT",
        Some(json!({ "uris": [uri] })),
    )
    .await?;
    if !(200..300).contains(&response.status) && response.status != 204 {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify scene music playback failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    tokio::time::sleep(Duration::from_millis(250)).await;
    let _ = spotify_player_repeat_command(&credentials, "track", device_id.as_deref()).await;
    Ok(json!({ "played": true, "track": track }))
}

async fn spotify_scene_device_id(
    credentials: &SpotifyCredentials,
    requested_device_id: Option<&str>,
    mobile_device_only: bool,
) -> AppResult<Option<String>> {
    if requested_device_id.is_some_and(|value| !value.trim().is_empty()) {
        return Ok(requested_device_id.map(ToOwned::to_owned));
    }
    if !mobile_device_only {
        if let Some(active) = spotify_active_device_id(credentials).await? {
            return Ok(Some(active));
        }
    }
    spotify_available_device_id(credentials, mobile_device_only)
        .await?
        .map(Some)
        .ok_or_else(|| {
            AppError::new(
                "spotify_no_device",
                if mobile_device_only {
                    "No available personal Spotify device was found. Open Spotify on your phone or tablet and try again."
                } else {
                    "No available Spotify playback device was found. Open Spotify on a device and try again."
                },
            )
        })
}

async fn spotify_active_device_id(credentials: &SpotifyCredentials) -> AppResult<Option<String>> {
    let response = spotify_api(credentials, "/me/player", "GET", None).await?;
    if response.status == 204 || !(200..300).contains(&response.status) {
        return Ok(None);
    }
    Ok(response
        .json
        .get("device")
        .and_then(|device| device.get("id"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned))
}

async fn spotify_available_device_id(
    credentials: &SpotifyCredentials,
    mobile_device_only: bool,
) -> AppResult<Option<String>> {
    let response = spotify_api(credentials, "/me/player/devices", "GET", None).await?;
    if !(200..300).contains(&response.status) {
        return Ok(None);
    }
    let devices = response
        .json
        .get("devices")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let candidates = devices
        .into_iter()
        .filter(|device| spotify_device_is_usable(device, mobile_device_only))
        .collect::<Vec<_>>();
    let selected = candidates
        .iter()
        .find(|device| {
            device
                .get("is_active")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .or_else(|| candidates.first());
    Ok(selected.and_then(|device| {
        device
            .get("id")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
    }))
}

fn spotify_device_is_usable(device: &Value, mobile_device_only: bool) -> bool {
    let has_id = device
        .get("id")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty());
    let is_restricted = device
        .get("is_restricted")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let is_mobile =
        is_personal_mobile_spotify_device_type(device.get("type").and_then(Value::as_str));
    has_id && !is_restricted && (!mobile_device_only || is_mobile)
}

fn is_personal_mobile_spotify_device_type(device_type: Option<&str>) -> bool {
    matches!(
        device_type
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase()
            .as_str(),
        "smartphone" | "tablet"
    )
}

async fn spotify_api_with_device_retry(
    credentials: &SpotifyCredentials,
    base_path: &str,
    device_id: Option<&str>,
    method: &str,
    payload: Option<Value>,
) -> AppResult<SpotifyResponse> {
    let path = spotify_control_path(base_path, device_id);
    let response = spotify_api(credentials, &path, method, payload.clone()).await?;
    if spotify_response_ok(&response) || !spotify_should_retry_device(&response, device_id) {
        return Ok(response);
    }
    if let Some(active_device_id) = spotify_active_device_id(credentials).await? {
        if Some(active_device_id.as_str()) != device_id {
            let path = spotify_control_path(base_path, Some(&active_device_id));
            let retry = spotify_api(credentials, &path, method, payload.clone()).await?;
            if spotify_response_ok(&retry)
                || !spotify_should_retry_device(&retry, Some(&active_device_id))
            {
                return Ok(retry);
            }
        }
    }
    let fallback = spotify_available_device_id(credentials, false).await?;
    if let Some(fallback_device_id) = fallback.filter(|id| Some(id.as_str()) != device_id) {
        let path = spotify_control_path(base_path, Some(&fallback_device_id));
        return spotify_api(credentials, &path, method, payload).await;
    }
    Ok(response)
}

async fn spotify_player_repeat_command(
    credentials: &SpotifyCredentials,
    repeat: &str,
    device_id: Option<&str>,
) -> AppResult<SpotifyResponse> {
    spotify_api_with_device_retry(
        credentials,
        &format!("/me/player/repeat?state={repeat}"),
        device_id,
        "PUT",
        None,
    )
    .await
}

fn spotify_response_ok(response: &SpotifyResponse) -> bool {
    (200..300).contains(&response.status) || response.status == 204
}

fn spotify_should_retry_device(response: &SpotifyResponse, device_id: Option<&str>) -> bool {
    if device_id.map(str::trim).unwrap_or_default().is_empty() {
        return response.status == 404
            && response
                .body
                .to_ascii_lowercase()
                .contains("no active device");
    }
    if !matches!(response.status, 403 | 404) {
        return false;
    }
    let body = response.body.to_ascii_lowercase();
    body.contains("device")
        || body.contains("restriction")
        || body.contains("not found")
        || body.contains("no active")
}

fn authorize(state: &AppState, route: &ParsedPath, body: &Value) -> AppResult<Value> {
    let client_id = string_param(route, body, "clientId")
        .ok_or_else(|| AppError::invalid_input("clientId is required"))?;
    let agent_id = string_param(route, body, "agentId")
        .ok_or_else(|| AppError::invalid_input("agentId is required"))?;
    let code_verifier = random_token(64);
    let code_challenge = code_challenge(&code_verifier);
    let auth_state = random_token(32);
    state.storage.upsert_with_id(
        "app-settings",
        &format!("spotify-pending-{auth_state}"),
        json!({
            "value": {
                "codeVerifier": code_verifier,
                "clientId": client_id,
                "agentId": agent_id,
                "redirectUri": SPOTIFY_REDIRECT_URI,
                "createdAt": now_millis()
            }
        }),
    )?;
    let callback_listener_started = start_callback_listener(state.clone());
    let params = form_urlencoded(&[
        ("response_type", "code"),
        ("client_id", &client_id),
        ("scope", SPOTIFY_SCOPES),
        ("code_challenge_method", "S256"),
        ("code_challenge", &code_challenge),
        ("redirect_uri", SPOTIFY_REDIRECT_URI),
        ("state", &auth_state),
    ]);
    Ok(json!({
        "authUrl": format!("https://accounts.spotify.com/authorize?{params}"),
        "redirectUri": SPOTIFY_REDIRECT_URI,
        "callbackListenerStarted": callback_listener_started
    }))
}

pub(super) async fn exchange(state: &AppState, body: Value) -> AppResult<Value> {
    let (code, auth_state) = spotify_code_and_state(&body)?;
    let key = format!("spotify-pending-{auth_state}");
    let pending_record = state.storage.get("app-settings", &key)?.ok_or_else(|| {
        AppError::invalid_input("Authorization session expired or was already used.")
    })?;
    let pending = pending_record
        .get("value")
        .cloned()
        .unwrap_or(pending_record);
    let created_at = pending
        .get("createdAt")
        .and_then(Value::as_u64)
        .unwrap_or(0) as u128;
    if created_at > 0 && now_millis().saturating_sub(created_at) > AUTH_TTL_MS {
        let _ = state.storage.delete("app-settings", &key);
        return Err(AppError::invalid_input(
            "Authorization session expired or was already used.",
        ));
    }
    let code_verifier = pending
        .get("codeVerifier")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("Spotify authorization verifier is missing"))?
        .to_string();
    let client_id = pending
        .get("clientId")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("Spotify client id is missing"))?
        .to_string();
    let agent_id = pending
        .get("agentId")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("Spotify agent id is missing"))?
        .to_string();
    let redirect_uri = pending
        .get("redirectUri")
        .and_then(Value::as_str)
        .unwrap_or(SPOTIFY_REDIRECT_URI)
        .to_string();
    let token = spotify_token_request(&[
        ("client_id", client_id.as_str()),
        ("grant_type", "authorization_code"),
        ("code", code.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("code_verifier", code_verifier.as_str()),
    ])
    .await?;
    let _ = state.storage.delete("app-settings", &key);
    save_spotify_tokens(state, &agent_id, &client_id, &token)?;
    Ok(json!({ "success": true }))
}

fn status(state: &AppState, route: &ParsedPath, body: &Value) -> AppResult<Value> {
    let agent_id = string_param(route, body, "agentId")
        .ok_or_else(|| AppError::invalid_input("agentId is required"))?;
    let agent = get_required(state, "agents", &agent_id)?;
    let mut settings = agent_settings(&agent);
    migrate_legacy_spotify_tokens(state, &agent_id, &mut settings)?;
    let has_token = spotify_stored_token(
        state,
        &settings,
        "spotifyAccessToken",
        SPOTIFY_ACCESS_TOKEN_ENCRYPTED_KEY,
    )?
    .is_some_and(|value| !value.is_empty());
    let has_refresh = spotify_stored_token(
        state,
        &settings,
        "spotifyRefreshToken",
        SPOTIFY_REFRESH_TOKEN_ENCRYPTED_KEY,
    )?
    .is_some_and(|value| !value.is_empty());
    let expires_at = settings
        .get("spotifyExpiresAt")
        .and_then(Value::as_u64)
        .unwrap_or(0) as u128;
    let scopes = scope_list(
        settings
            .get("spotifyScope")
            .and_then(Value::as_str)
            .unwrap_or(""),
    );
    let missing_scopes = SPOTIFY_SCOPES
        .split_whitespace()
        .filter(|scope| !scopes.iter().any(|existing| existing == scope))
        .collect::<Vec<_>>();
    Ok(json!({
        "connected": has_token && has_refresh,
        "expired": expires_at > 0 && now_millis() > expires_at,
        "clientId": settings.get("spotifyClientId").cloned().unwrap_or(Value::Null),
        "redirectUri": SPOTIFY_REDIRECT_URI,
        "scopes": scopes,
        "missingScopes": missing_scopes
    }))
}

async fn access_token(state: &AppState, route: &ParsedPath, body: &Value) -> AppResult<Value> {
    let credentials = resolve_credentials(state, route, body).await?;
    Ok(json!({
        "accessToken": credentials.access_token,
        "expiresAt": credentials.expires_at,
        "agentId": credentials.agent_id,
        "scopes": credentials.scopes,
        "hasStreamingScope": credentials.scopes.iter().any(|scope| scope == "streaming")
    }))
}

async fn player(state: &AppState, route: &ParsedPath, body: &Value) -> AppResult<Value> {
    let credentials = resolve_credentials(state, route, body).await?;
    let response = spotify_api(&credentials, "/me/player", "GET", None).await?;
    if response.status == 204 {
        return Ok(json!({ "connected": true, "active": false }));
    }
    if !(200..300).contains(&response.status) {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify playback state failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    Ok(map_playback(&response.json))
}

async fn devices(state: &AppState, route: &ParsedPath, body: &Value) -> AppResult<Value> {
    let credentials = resolve_credentials(state, route, body).await?;
    let response = spotify_api(&credentials, "/me/player/devices", "GET", None).await?;
    if !(200..300).contains(&response.status) {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify devices failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    let devices = response
        .json
        .get("devices")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|device| {
            json!({
                "id": device.get("id").cloned().unwrap_or(Value::Null),
                "name": device.get("name").and_then(Value::as_str).unwrap_or("Spotify device"),
                "type": device.get("type").cloned().unwrap_or(Value::Null),
                "isActive": device.get("is_active").and_then(Value::as_bool).unwrap_or(false),
                "volume": device.get("volume_percent").cloned().unwrap_or(Value::Null)
            })
        })
        .collect::<Vec<_>>();
    Ok(json!({ "devices": devices }))
}

async fn playlists(state: &AppState, route: &ParsedPath, body: &Value) -> AppResult<Value> {
    let credentials = resolve_credentials(state, route, body).await?;
    let limit = route
        .query
        .get("limit")
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(50)
        .clamp(1, 50);
    let response = spotify_api(
        &credentials,
        &format!("/me/playlists?limit={limit}"),
        "GET",
        None,
    )
    .await?;
    if !(200..300).contains(&response.status) {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify playlists failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    let user = spotify_api(&credentials, "/me", "GET", None).await.ok();
    let my_id = user
        .as_ref()
        .filter(|response| (200..300).contains(&response.status))
        .and_then(|response| response.json.get("id"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);

    let mut playlists = Vec::new();
    for playlist in response
        .json
        .get("items")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
    {
        let id = playlist.get("id").and_then(Value::as_str).unwrap_or("");
        let owned = my_id.as_ref().and_then(|my_id| {
            playlist
                .get("owner")
                .and_then(|owner| owner.get("id"))
                .and_then(Value::as_str)
                .map(|owner_id| owner_id == my_id)
        });
        let mut track_count = playlist
            .get("tracks")
            .and_then(|tracks| tracks.get("total"))
            .and_then(Value::as_i64)
            .map(Value::from)
            .unwrap_or(Value::Null);
        if track_count.is_null() && owned == Some(true) && !id.is_empty() {
            if let Ok(items) = spotify_api(
                &credentials,
                &format!("/playlists/{}/items?limit=1", percent_encode_component(id)),
                "GET",
                None,
            )
            .await
            {
                if (200..300).contains(&items.status) {
                    if let Some(total) = items.json.get("total").and_then(Value::as_i64) {
                        track_count = Value::from(total);
                    }
                }
            }
        }
        playlists.push(json!({
            "id": id,
            "name": playlist.get("name").and_then(Value::as_str).unwrap_or("Untitled playlist"),
            "uri": playlist.get("uri").and_then(Value::as_str).unwrap_or(""),
            "trackCount": track_count,
            "owned": owned.map(Value::from).unwrap_or(Value::Null)
        }));
    }
    Ok(json!({ "playlists": playlists }))
}

async fn dj_mari_playlist(state: &AppState, body: Value) -> AppResult<Value> {
    let route = ParsedPath {
        parts: Vec::new(),
        query: HashMap::new(),
    };
    let credentials = resolve_credentials(state, &route, &body).await?;
    let playlist_name = format!("DJ Mari {}", today_label());
    let liked_songs = fetch_liked_song_examples(&credentials).await?;
    let context = build_dj_mari_context(state, &playlist_name, &liked_songs)?;
    let generated_tracks = generate_dj_mari_playlist_plan(state, &playlist_name, context).await?;
    let matched_tracks =
        match_generated_tracks(&credentials, &generated_tracks, &liked_songs).await?;
    if matched_tracks.len() < DJ_MARI_MIN_TRACKS {
        return Err(AppError::with_details(
            "spotify_dj_mari_match_error",
            format!(
                "DJ Mari only matched {} Spotify tracks. Need at least {DJ_MARI_MIN_TRACKS}; try again after adding more Liked Songs or using a broader model prompt.",
                matched_tracks.len()
            ),
            json!({
                "requestedTrackCount": generated_tracks.len(),
                "matchedTrackCount": matched_tracks.len(),
            }),
        ));
    }
    let playlist =
        create_dj_mari_spotify_playlist(&credentials, &playlist_name, &matched_tracks).await?;
    let playback = start_dj_mari_playlist_playback(
        &credentials,
        playlist
            .get("playlistUri")
            .and_then(Value::as_str)
            .unwrap_or(""),
        body.get("deviceId").and_then(Value::as_str),
    )
    .await;
    let (playback_started, playback_error) = match playback {
        Ok(value) => (
            value
                .get("started")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            value.get("error").cloned().unwrap_or(Value::Null),
        ),
        Err(error) => (false, Value::String(error.message)),
    };
    Ok(json!({
        "success": true,
        "name": playlist.get("name").cloned().unwrap_or_else(|| json!(playlist_name)),
        "playlistId": playlist.get("playlistId").cloned().unwrap_or(Value::Null),
        "playlistUri": playlist.get("playlistUri").cloned().unwrap_or(Value::Null),
        "playlistUrl": playlist.get("playlistUrl").cloned().unwrap_or(Value::Null),
        "requestedTrackCount": generated_tracks.len(),
        "trackCount": matched_tracks.len(),
        "playbackStarted": playback_started,
        "playbackError": playback_error,
        "tracks": matched_tracks.iter().map(matched_track_json).collect::<Vec<_>>()
    }))
}

fn today_label() -> String {
    now_iso().chars().take(10).collect()
}

fn track_from_spotify_value(item: &Value) -> Option<SpotifyTrack> {
    let uri = item.get("uri").and_then(Value::as_str)?.to_string();
    if !uri.starts_with("spotify:track:") {
        return None;
    }
    let artist = item
        .get("artists")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|artist| artist.get("name").and_then(Value::as_str))
                .filter(|name| !name.trim().is_empty())
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Unknown artist".to_string());
    Some(SpotifyTrack {
        uri,
        name: item
            .get("name")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("Unknown track")
            .to_string(),
        artist,
        album: item
            .get("album")
            .and_then(|album| album.get("name"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        image_url: item
            .get("album")
            .and_then(|album| album.get("images"))
            .and_then(Value::as_array)
            .and_then(|images| images.first())
            .and_then(|image| image.get("url"))
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        duration_ms: item.get("duration_ms").cloned(),
    })
}

async fn fetch_liked_song_examples(
    credentials: &SpotifyCredentials,
) -> AppResult<Vec<SpotifyTrack>> {
    let response = spotify_api(
        credentials,
        &format!("/me/tracks?limit={LIKED_SONG_EXAMPLE_LIMIT}"),
        "GET",
        None,
    )
    .await?;
    if !(200..300).contains(&response.status) {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify liked songs failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    Ok(response
        .json
        .get("items")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("track").and_then(track_from_spotify_value))
        .collect())
}

fn parse_json_object(value: &Value) -> Map<String, Value> {
    match value {
        Value::Object(object) => object.clone(),
        Value::String(raw) => serde_json::from_str::<Value>(raw)
            .ok()
            .and_then(|parsed| parsed.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}

fn short_text(value: &str, max_chars: usize) -> String {
    let trimmed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if trimmed.len() <= max_chars {
        return trimmed;
    }
    let end = max_chars.saturating_sub(16);
    format!(
        "{} [truncated]",
        trimmed.chars().take(end).collect::<String>().trim_end()
    )
}

fn record_string(record: &Value, key: &str) -> String {
    record
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string()
}

fn character_profile(row: &Value) -> Value {
    let data = parse_json_object(row.get("data").unwrap_or(&Value::Null));
    let name = data
        .get("name")
        .and_then(Value::as_str)
        .or_else(|| row.get("name").and_then(Value::as_str))
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Unnamed character");
    json!({
        "id": row.get("id").and_then(Value::as_str).unwrap_or(""),
        "name": name,
        "description": short_text(data.get("description").and_then(Value::as_str).unwrap_or(""), 1200),
        "personality": short_text(data.get("personality").and_then(Value::as_str).unwrap_or(""), 800)
    })
}

fn persona_profile(row: &Value) -> Value {
    json!({
        "name": record_string(row, "name"),
        "description": short_text(&record_string(row, "description"), 1600),
        "personality": short_text(&record_string(row, "personality"), 900),
        "appearance": short_text(&record_string(row, "appearance"), 700)
    })
}

fn summarize_chat_metadata(chat: &Value) -> Value {
    let metadata = parse_json_object(chat.get("metadata").unwrap_or(&Value::Null));
    let mut out = Map::new();
    for key in [
        "summary",
        "tags",
        "gameActiveState",
        "gameStoryArc",
        "gameSpotifySourceType",
    ] {
        if let Some(value) = metadata.get(key).filter(|value| !value.is_null()) {
            out.insert(key.to_string(), value.clone());
        }
    }
    let setup = metadata
        .get("gameSetupConfig")
        .map(parse_json_object)
        .unwrap_or_default();
    for key in [
        "setting",
        "genre",
        "tone",
        "premise",
        "playerGoals",
        "additionalPreferences",
    ] {
        if let Some(value) = setup.get(key).filter(|value| !value.is_null()) {
            out.insert(format!("setup.{key}"), value.clone());
        }
    }
    Value::Object(out)
}

fn most_recent_persona(chats: &[Value], personas: &[Value]) -> Option<Value> {
    for chat in chats {
        let persona_id = chat
            .get("personaId")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty());
        if let Some(persona_id) = persona_id {
            if let Some(persona) = personas
                .iter()
                .find(|persona| persona.get("id").and_then(Value::as_str) == Some(persona_id))
            {
                return Some(persona.clone());
            }
        }
    }
    personas
        .iter()
        .find(|persona| {
            persona
                .get("isActive")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .cloned()
        .or_else(|| personas.first().cloned())
}

fn build_recent_chat_context(
    state: &AppState,
    chats: &[Value],
    character_names: &HashMap<String, String>,
    persona_name: Option<&str>,
) -> AppResult<Vec<Value>> {
    let mut contexts = Vec::new();
    for mode in ["conversation", "roleplay", "game"] {
        let Some(chat) = chats
            .iter()
            .filter(|chat| chat.get("mode").and_then(Value::as_str) == Some(mode))
            .max_by_key(|chat| chat.get("updatedAt").and_then(Value::as_str).unwrap_or(""))
        else {
            continue;
        };
        let chat_id = chat.get("id").and_then(Value::as_str).unwrap_or("");
        let mut messages = super::super::chats::messages_for_chat(state, chat_id)?;
        let skip = messages.len().saturating_sub(RECENT_CHAT_MESSAGE_LIMIT);
        messages = messages.into_iter().skip(skip).collect();
        contexts.push(json!({
            "mode": mode,
            "chatName": record_string(chat, "name"),
            "updatedAt": chat.get("updatedAt").cloned().unwrap_or(Value::Null),
            "characterNames": string_array_from_value(chat.get("characterIds"))
                .into_iter()
                .map(|id| character_names.get(&id).cloned().unwrap_or(id))
                .collect::<Vec<_>>(),
            "context": summarize_chat_metadata(chat),
            "latestMessages": messages.into_iter().map(|message| {
                let character_id = message.get("characterId").and_then(Value::as_str);
                let speaker = character_id
                    .and_then(|id| character_names.get(id).cloned())
                    .unwrap_or_else(|| {
                        if message.get("role").and_then(Value::as_str) == Some("user") {
                            persona_name.unwrap_or("User").to_string()
                        } else {
                            record_string(&message, "role")
                        }
                    });
                json!({
                    "role": message.get("role").and_then(Value::as_str).unwrap_or("assistant"),
                    "speaker": speaker,
                    "text": short_text(message.get("content").and_then(Value::as_str).unwrap_or(""), 900)
                })
            }).collect::<Vec<_>>()
        }));
    }
    Ok(contexts)
}

fn most_used_character(chats: &[Value], characters: &[Value]) -> Value {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for chat in chats {
        for id in string_array_from_value(chat.get("characterIds")) {
            *counts.entry(id).or_insert(0) += 1;
        }
    }
    let Some((id, count)) = counts.into_iter().max_by_key(|(_, count)| *count) else {
        return Value::Null;
    };
    let Some(character) = characters
        .iter()
        .find(|character| character.get("id").and_then(Value::as_str) == Some(id.as_str()))
        .map(character_profile)
    else {
        return Value::Null;
    };
    let mut object = character.as_object().cloned().unwrap_or_default();
    object.insert("chatCount".to_string(), json!(count));
    Value::Object(object)
}

fn build_dj_mari_context(
    state: &AppState,
    playlist_name: &str,
    liked_songs: &[SpotifyTrack],
) -> AppResult<Value> {
    let mut chats = state.storage.list("chats")?;
    chats.sort_by(|a, b| {
        b.get("updatedAt")
            .and_then(Value::as_str)
            .unwrap_or("")
            .cmp(a.get("updatedAt").and_then(Value::as_str).unwrap_or(""))
    });
    let characters = state.storage.list("characters")?;
    let personas = state.storage.list("personas")?;
    let character_profiles = characters.iter().map(character_profile).collect::<Vec<_>>();
    let character_names = character_profiles
        .iter()
        .filter_map(|character| {
            Some((
                character.get("id").and_then(Value::as_str)?.to_string(),
                character.get("name").and_then(Value::as_str)?.to_string(),
            ))
        })
        .collect::<HashMap<_, _>>();
    let persona = most_recent_persona(&chats, &personas).map(|row| persona_profile(&row));
    let persona_name = persona
        .as_ref()
        .and_then(|persona| persona.get("name"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    Ok(json!({
        "playlistName": playlist_name,
        "desiredTrackCount": format!("{DJ_MARI_MIN_TRACKS}-{DJ_MARI_MAX_TRACKS}"),
        "persona": persona.unwrap_or(Value::Null),
        "characterNames": character_profiles.iter()
            .filter_map(|character| character.get("name").and_then(Value::as_str))
            .collect::<Vec<_>>(),
        "recentChats": build_recent_chat_context(state, &chats, &character_names, persona_name.as_deref())?,
        "likedSongExamples": liked_songs.iter().map(|song| json!({
            "name": song.name,
            "artist": song.artist,
            "album": song.album,
        })).collect::<Vec<_>>(),
        "optionalSuggestionSeed": most_used_character(&chats, &characters)
    }))
}

fn resolve_dj_mari_llm_connection(state: &AppState) -> AppResult<Value> {
    let spotify_agent = find_spotify_agent(state, None).ok();
    if let Some(connection_id) = spotify_agent
        .as_ref()
        .and_then(|agent| agent.get("connectionId"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        return connection_secrets::connection_for_runtime(state, connection_id);
    }
    let connections = connection_secrets::connections_for_runtime(state)?;
    connections
        .iter()
        .find(|connection| {
            connection
                .get("defaultForAgents")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .cloned()
        .or_else(|| {
            connections
                .iter()
                .find(|connection| {
                    connection
                        .get("isDefault")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
                })
                .cloned()
        })
        .or_else(|| connections.into_iter().next())
        .ok_or_else(|| {
            AppError::invalid_input(
                "Configure a model connection for the Spotify DJ agent, or set a default agent connection.",
            )
        })
}

async fn generate_dj_mari_playlist_plan(
    state: &AppState,
    playlist_name: &str,
    context: Value,
) -> AppResult<Vec<GeneratedTrack>> {
    let connection = resolve_dj_mari_llm_connection(state)?;
    let request = marinara_llm::LlmRequest {
        connection: super::super::llm::llm_connection_from_value(&connection)?,
        messages: vec![
            marinara_llm::LlmMessage {
                role: "system".to_string(),
                content: [
                    "You are DJ Mari, a taste-aware Spotify playlist curator for Marinara Engine.",
                    "Compose a private Spotify playlist for the user from their persona, characters, freshest chat context, and liked-song taste samples.",
                    "Pick 25-50 specific real songs that are likely to exist in Spotify's catalogue. Prefer strong emotional fit, roleplay/game atmosphere, repeat-listening value, and a coherent flow.",
                    "Do not include podcasts, local files, playlists, albums, duplicate songs, or fictional track names.",
                    "Return strict JSON only: {\"tracks\":[{\"title\":\"Song title\",\"artist\":\"Primary artist\",\"reason\":\"short reason\"}]}."
                ].join("\n"),
                name: None,
                images: Vec::new(),
                tool_call_id: None,
                tool_calls: None,
            },
            marinara_llm::LlmMessage {
                role: "user".to_string(),
                content: serde_json::to_string(&context).unwrap_or_else(|_| {
                    format!("Create playlist plan for {playlist_name}.")
                }),
                name: None,
                images: Vec::new(),
                tool_call_id: None,
                tool_calls: None,
            },
        ],
        parameters: json!({
            "temperature": 0.75,
            "maxTokens": DJ_MARI_OUTPUT_TOKENS
        }),
        tools: Vec::new(),
    };
    let result = marinara_llm::complete(request).await?;
    let tracks = parse_generated_tracks(&result)?;
    if tracks.is_empty() {
        return Err(AppError::new(
            "spotify_dj_mari_plan_error",
            "DJ Mari returned no usable tracks.",
        ));
    }
    Ok(tracks)
}

fn extract_json_text(text: &str) -> &str {
    let trimmed = text.trim();
    if let Some(start) = trimmed.find("```") {
        if let Some(end) = trimmed[start + 3..].find("```") {
            let block = &trimmed[start + 3..start + 3 + end];
            return block
                .strip_prefix("json")
                .map(str::trim)
                .unwrap_or_else(|| block.trim());
        }
    }
    if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
        if start <= end {
            return &trimmed[start..=end];
        }
    }
    trimmed
}

fn parse_generated_tracks(raw: &str) -> AppResult<Vec<GeneratedTrack>> {
    let parsed: Value = serde_json::from_str(extract_json_text(raw)).map_err(|error| {
        AppError::new(
            "spotify_dj_mari_plan_error",
            format!("DJ Mari returned a playlist plan that could not be parsed: {error}"),
        )
    })?;
    let tracks = parsed
        .get("tracks")
        .and_then(Value::as_array)
        .cloned()
        .or_else(|| parsed.as_array().cloned())
        .unwrap_or_default();
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for item in tracks {
        let object = parse_json_object(&item);
        let title = object
            .get("title")
            .or_else(|| object.get("name"))
            .or_else(|| object.get("track"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
        let artist = object
            .get("artist")
            .or_else(|| object.get("artists"))
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
        if title.is_empty() || artist.is_empty() {
            continue;
        }
        let key = format!(
            "{}:{}",
            normalize_spotify_text(&title),
            normalize_spotify_text(&artist)
        );
        if !seen.insert(key) {
            continue;
        }
        out.push(GeneratedTrack {
            title,
            artist,
            reason: object
                .get("reason")
                .and_then(Value::as_str)
                .map(|value| short_text(value, 180)),
        });
        if out.len() >= DJ_MARI_MAX_TRACKS {
            break;
        }
    }
    Ok(out)
}

fn normalize_spotify_text(value: &str) -> String {
    value
        .to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn token_overlap_score(left: &str, right: &str) -> f64 {
    let left_tokens = normalize_spotify_text(left)
        .split_whitespace()
        .map(ToOwned::to_owned)
        .collect::<std::collections::HashSet<_>>();
    if left_tokens.is_empty() {
        return 0.0;
    }
    let right_tokens = normalize_spotify_text(right)
        .split_whitespace()
        .map(ToOwned::to_owned)
        .collect::<std::collections::HashSet<_>>();
    let matches = left_tokens
        .iter()
        .filter(|token| right_tokens.contains(*token))
        .count();
    matches as f64 / left_tokens.len() as f64
}

fn spotify_text_similarity(wanted: &str, actual: &str) -> f64 {
    let wanted = normalize_spotify_text(wanted);
    let actual = normalize_spotify_text(actual);
    if wanted.is_empty() || actual.is_empty() {
        return 0.0;
    }
    if wanted == actual {
        return 1.0;
    }
    if actual.contains(&wanted) || wanted.contains(&actual) {
        return 0.85;
    }
    token_overlap_score(&wanted, &actual)
}

fn spotify_match_quality(track: &SpotifyTrack, desired: &GeneratedTrack) -> (f64, f64, f64) {
    let title_similarity = spotify_text_similarity(&desired.title, &track.name);
    let artist_similarity = spotify_text_similarity(&desired.artist, &track.artist);
    (
        title_similarity * 60.0 + artist_similarity * 34.0,
        title_similarity,
        artist_similarity,
    )
}

fn is_strong_spotify_match(track: &SpotifyTrack, desired: &GeneratedTrack) -> bool {
    let (score, title_similarity, artist_similarity) = spotify_match_quality(track, desired);
    title_similarity >= SPOTIFY_MIN_TITLE_SIMILARITY
        && (artist_similarity >= SPOTIFY_MIN_ARTIST_SIMILARITY || score >= SPOTIFY_MIN_MATCH_SCORE)
}

fn normalize_spotify_search_query(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(240)
        .collect()
}

async fn search_spotify_track(
    credentials: &SpotifyCredentials,
    desired: &GeneratedTrack,
) -> AppResult<Option<SpotifyTrack>> {
    let compact_title = desired
        .title
        .replace('"', "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let compact_artist = desired
        .artist
        .replace('"', "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let queries = [
        format!("track:\"{compact_title}\" artist:\"{compact_artist}\""),
        format!("\"{compact_title}\" \"{compact_artist}\""),
        format!("{compact_title} {compact_artist}"),
    ];
    let mut candidates_by_uri: HashMap<String, SpotifyTrack> = HashMap::new();
    for query in queries {
        let query = normalize_spotify_search_query(&query);
        let params = form_urlencoded(&[("q", &query), ("type", "track"), ("limit", "5")]);
        let response = spotify_api(credentials, &format!("/search?{params}"), "GET", None).await?;
        if !(200..300).contains(&response.status) {
            continue;
        }
        for item in response
            .json
            .get("tracks")
            .and_then(|tracks| tracks.get("items"))
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(track) = track_from_spotify_value(item) {
                candidates_by_uri.insert(track.uri.clone(), track);
            }
        }
        let mut matches = candidates_by_uri
            .values()
            .filter(|track| is_strong_spotify_match(track, desired))
            .cloned()
            .collect::<Vec<_>>();
        matches.sort_by(|a, b| {
            spotify_match_quality(b, desired)
                .0
                .partial_cmp(&spotify_match_quality(a, desired).0)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        if let Some(best) = matches.into_iter().next() {
            return Ok(Some(best));
        }
    }
    Ok(None)
}

async fn match_generated_tracks(
    credentials: &SpotifyCredentials,
    generated: &[GeneratedTrack],
    liked_fallbacks: &[SpotifyTrack],
) -> AppResult<Vec<MatchedTrack>> {
    let mut matched = Vec::new();
    let mut seen_uris = std::collections::HashSet::new();
    for desired in generated {
        if matched.len() >= DJ_MARI_MAX_TRACKS {
            break;
        }
        if let Some(track) = search_spotify_track(credentials, desired).await? {
            if seen_uris.insert(track.uri.clone()) {
                matched.push(MatchedTrack {
                    track,
                    requested_title: desired.title.clone(),
                    requested_artist: desired.artist.clone(),
                    reason: desired.reason.clone(),
                });
            }
        }
    }
    for liked in liked_fallbacks {
        if matched.len() >= DJ_MARI_MIN_TRACKS {
            break;
        }
        if seen_uris.insert(liked.uri.clone()) {
            matched.push(MatchedTrack {
                track: liked.clone(),
                requested_title: liked.name.clone(),
                requested_artist: liked.artist.clone(),
                reason: Some(
                    "Fallback from the user's Liked Songs to keep the playlist full.".to_string(),
                ),
            });
        }
    }
    Ok(matched.into_iter().take(DJ_MARI_MAX_TRACKS).collect())
}

async fn create_dj_mari_spotify_playlist(
    credentials: &SpotifyCredentials,
    name: &str,
    tracks: &[MatchedTrack],
) -> AppResult<Value> {
    let created = spotify_api(
        credentials,
        "/me/playlists",
        "POST",
        Some(json!({
            "name": name,
            "public": false,
            "collaborative": false,
            "description": "Created by DJ Mari in Marinara Engine."
        })),
    )
    .await?;
    if !(200..300).contains(&created.status) {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify playlist creation failed",
            json!({ "status": created.status, "body": created.body }),
        ));
    }
    let playlist_id = created
        .json
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("spotify_api_error", "Spotify playlist id missing"))?;
    let playlist_uri = created
        .json
        .get("uri")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("spotify_api_error", "Spotify playlist uri missing"))?;
    let uris = tracks
        .iter()
        .map(|track| Value::String(track.track.uri.clone()))
        .collect::<Vec<_>>();
    let added = spotify_api(
        credentials,
        &format!("/playlists/{}/items", percent_encode_component(playlist_id)),
        "POST",
        Some(json!({ "uris": uris })),
    )
    .await?;
    if !(200..300).contains(&added.status) {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify add tracks failed",
            json!({ "status": added.status, "body": added.body }),
        ));
    }
    Ok(json!({
        "name": name,
        "playlistId": playlist_id,
        "playlistUri": playlist_uri,
        "playlistUrl": created.json.get("external_urls").and_then(|urls| urls.get("spotify")).cloned().unwrap_or(Value::Null),
        "trackCount": tracks.len()
    }))
}

async fn start_dj_mari_playlist_playback(
    credentials: &SpotifyCredentials,
    playlist_uri: &str,
    device_id: Option<&str>,
) -> AppResult<Value> {
    let device_id = device_id.filter(|value| !value.trim().is_empty());
    if let Some(device_id) = device_id {
        let _ = spotify_api(
            credentials,
            "/me/player",
            "PUT",
            Some(json!({ "device_ids": [device_id], "play": false })),
        )
        .await;
    }
    let path = spotify_control_path("/me/player/play", device_id);
    let response = spotify_api(
        credentials,
        &path,
        "PUT",
        Some(json!({ "context_uri": playlist_uri })),
    )
    .await?;
    if !(200..300).contains(&response.status) && response.status != 204 {
        return Ok(json!({
            "started": false,
            "error": spotify_error_message(&response.body, "Spotify could not start the new playlist.")
        }));
    }
    Ok(json!({ "started": true, "error": Value::Null }))
}

fn spotify_error_message(body: &str, fallback: &str) -> String {
    if body.trim().is_empty() {
        return fallback.to_string();
    }
    if let Ok(json) = serde_json::from_str::<Value>(body) {
        if let Some(message) = json
            .get("error")
            .and_then(|error| {
                error
                    .get("message")
                    .or_else(|| error.as_str().map(|_| error))
            })
            .and_then(Value::as_str)
            .or_else(|| json.get("message").and_then(Value::as_str))
        {
            return message.to_string();
        }
    }
    body.chars().take(300).collect()
}

fn matched_track_json(track: &MatchedTrack) -> Value {
    json!({
        "uri": track.track.uri,
        "name": track.track.name,
        "artist": track.track.artist,
        "album": track.track.album,
        "imageUrl": track.track.image_url,
        "durationMs": track.track.duration_ms,
        "requestedTitle": track.requested_title,
        "requestedArtist": track.requested_artist,
        "reason": track.reason
    })
}

async fn player_control(
    state: &AppState,
    route: &ParsedPath,
    body: Value,
    path: &str,
    method: &str,
) -> AppResult<Value> {
    let credentials = resolve_credentials(state, route, &body).await?;
    let device_id = body.get("deviceId").and_then(Value::as_str);
    let payload = if path.ends_with("/play") {
        let mut object = Map::new();
        if let Some(context_uri) = body
            .get("contextUri")
            .and_then(Value::as_str)
            .filter(|value| value.starts_with("spotify:"))
        {
            object.insert(
                "context_uri".to_string(),
                Value::String(context_uri.to_string()),
            );
        } else if let Some(uris) = body.get("uris").and_then(Value::as_array) {
            object.insert(
                "uris".to_string(),
                Value::Array(
                    uris.iter()
                        .filter_map(Value::as_str)
                        .filter(|uri| uri.starts_with("spotify:"))
                        .map(|uri| Value::String(uri.to_string()))
                        .collect(),
                ),
            );
        } else if let Some(uri) = body
            .get("uri")
            .and_then(Value::as_str)
            .filter(|value| value.starts_with("spotify:"))
        {
            object.insert("uris".to_string(), json!([uri]));
        }
        if object.is_empty() {
            None
        } else {
            Some(Value::Object(object))
        }
    } else {
        None
    };
    let response =
        spotify_api_with_device_retry(&credentials, path, device_id, method, payload).await?;
    if !(200..300).contains(&response.status) && response.status != 204 {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify playback command failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    Ok(json!({ "success": true }))
}

async fn player_volume(state: &AppState, route: &ParsedPath, body: Value) -> AppResult<Value> {
    let credentials = resolve_credentials(state, route, &body).await?;
    let volume = body
        .get("volume")
        .and_then(Value::as_i64)
        .unwrap_or(50)
        .clamp(0, 100);
    let base = format!("/me/player/volume?volume_percent={volume}");
    let response = spotify_api_with_device_retry(
        &credentials,
        &base,
        body.get("deviceId").and_then(Value::as_str),
        "PUT",
        None,
    )
    .await?;
    if !(200..300).contains(&response.status) && response.status != 204 {
        let body_text = response.body.to_ascii_lowercase();
        if body_text.contains("cannot control device volume") {
            return Err(AppError::with_details(
                "SPOTIFY_VOLUME_UNSUPPORTED",
                "This Spotify device does not allow remote volume control. Use the device volume buttons instead.",
                json!({ "status": response.status }),
            ));
        }
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify volume failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    Ok(json!({ "success": true, "volume": volume }))
}

async fn player_shuffle(state: &AppState, route: &ParsedPath, body: Value) -> AppResult<Value> {
    let credentials = resolve_credentials(state, route, &body).await?;
    let enabled = body
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let base = format!("/me/player/shuffle?state={enabled}");
    let response = spotify_api_with_device_retry(
        &credentials,
        &base,
        body.get("deviceId").and_then(Value::as_str),
        "PUT",
        None,
    )
    .await?;
    if !(200..300).contains(&response.status) && response.status != 204 {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify shuffle failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    Ok(json!({ "success": true, "shuffle": enabled }))
}

async fn player_repeat(state: &AppState, route: &ParsedPath, body: Value) -> AppResult<Value> {
    let credentials = resolve_credentials(state, route, &body).await?;
    let repeat = body.get("state").and_then(Value::as_str).unwrap_or("off");
    if !matches!(repeat, "off" | "track" | "context") {
        return Err(AppError::invalid_input(
            "repeat state must be off, track, or context",
        ));
    }
    let base = format!("/me/player/repeat?state={repeat}");
    let response = spotify_api_with_device_retry(
        &credentials,
        &base,
        body.get("deviceId").and_then(Value::as_str),
        "PUT",
        None,
    )
    .await?;
    if !(200..300).contains(&response.status) && response.status != 204 {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify repeat failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    Ok(json!({ "success": true, "repeat": repeat }))
}

async fn player_transfer(state: &AppState, route: &ParsedPath, body: Value) -> AppResult<Value> {
    let credentials = resolve_credentials(state, route, &body).await?;
    let device_id = required_string(&body, "deviceId")?;
    let response = spotify_api(
        &credentials,
        "/me/player",
        "PUT",
        Some(json!({ "device_ids": [device_id], "play": body.get("play").and_then(Value::as_bool).unwrap_or(false) })),
    )
    .await?;
    if !(200..300).contains(&response.status) && response.status != 204 {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify transfer failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    Ok(json!({ "success": true }))
}

fn disconnect(state: &AppState, body: Value) -> AppResult<Value> {
    let agent_id = body
        .get("agentId")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("agentId is required"))?;
    let agent = get_required(state, "agents", agent_id)?;
    let mut settings = agent_settings(&agent);
    for key in [
        "spotifyAccessToken",
        SPOTIFY_ACCESS_TOKEN_ENCRYPTED_KEY,
        "spotifyRefreshToken",
        SPOTIFY_REFRESH_TOKEN_ENCRYPTED_KEY,
        "spotifyExpiresAt",
        "spotifyScope",
    ] {
        settings.remove(key);
    }
    state.storage.patch(
        "agents",
        agent_id,
        json!({ "settings": Value::Object(settings) }),
    )?;
    Ok(json!({ "success": true }))
}

#[derive(Clone)]
struct SpotifyCredentials {
    access_token: String,
    agent_id: String,
    expires_at: u128,
    scopes: Vec<String>,
}

async fn resolve_credentials(
    state: &AppState,
    route: &ParsedPath,
    body: &Value,
) -> AppResult<SpotifyCredentials> {
    let agent = find_spotify_agent(state, string_param(route, body, "agentId").as_deref())?;
    let agent_id = agent
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let mut settings = agent_settings(&agent);
    migrate_legacy_spotify_tokens(state, &agent_id, &mut settings)?;
    let refresh_token = spotify_stored_token(
        state,
        &settings,
        "spotifyRefreshToken",
        SPOTIFY_REFRESH_TOKEN_ENCRYPTED_KEY,
    )?
    .unwrap_or_default();
    let client_id = settings
        .get("spotifyClientId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if refresh_token.is_empty() || client_id.is_empty() {
        return Err(AppError::invalid_input(
            "Spotify is not connected. Open the Spotify DJ agent and connect your account.",
        ));
    }
    let mut access_token = spotify_stored_token(
        state,
        &settings,
        "spotifyAccessToken",
        SPOTIFY_ACCESS_TOKEN_ENCRYPTED_KEY,
    )?
    .unwrap_or_default();
    let mut expires_at = settings
        .get("spotifyExpiresAt")
        .and_then(Value::as_u64)
        .unwrap_or(0) as u128;
    let mut scopes = scope_list(
        settings
            .get("spotifyScope")
            .and_then(Value::as_str)
            .unwrap_or(""),
    );
    if access_token.is_empty()
        || (expires_at > 0 && now_millis() > expires_at.saturating_sub(60_000))
    {
        let token = refresh_agent_token(state, &agent_id).await?;
        access_token = token
            .get("access_token")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        expires_at = token
            .get("expiresAt")
            .and_then(Value::as_u64)
            .map(u128::from)
            .or_else(|| {
                token
                    .get("expires_in")
                    .and_then(Value::as_u64)
                    .map(|expires_in| now_millis() + (u128::from(expires_in) * 1000))
            })
            .unwrap_or(0);
        scopes = scope_list(token.get("scope").and_then(Value::as_str).unwrap_or(""));
    }
    if access_token.is_empty() || (expires_at > 0 && now_millis() > expires_at) {
        return Err(AppError::new(
            "spotify_token_expired",
            "Spotify token expired. Reconnect Spotify and try again.",
        ));
    }
    Ok(SpotifyCredentials {
        access_token,
        agent_id,
        expires_at,
        scopes,
    })
}

fn find_spotify_agent(state: &AppState, preferred_agent_id: Option<&str>) -> AppResult<Value> {
    if let Some(id) = preferred_agent_id.filter(|id| !id.is_empty()) {
        let agent = get_required(state, "agents", id)?;
        if agent.get("type").and_then(Value::as_str) == Some("spotify") || id == "spotify" {
            return Ok(agent);
        }
    }
    find_by_field(state, "agents", "type", "spotify")?
        .ok_or_else(|| AppError::not_found("Spotify DJ agent is not configured."))
}

async fn refresh_agent_token(state: &AppState, agent_id: &str) -> AppResult<Value> {
    let agent = get_required(state, "agents", agent_id)?;
    let mut settings = agent_settings(&agent);
    migrate_legacy_spotify_tokens(state, agent_id, &mut settings)?;
    let refresh_token = spotify_stored_token(
        state,
        &settings,
        "spotifyRefreshToken",
        SPOTIFY_REFRESH_TOKEN_ENCRYPTED_KEY,
    )?
    .ok_or_else(|| AppError::invalid_input("No Spotify refresh token configured"))?;
    let client_id = settings
        .get("spotifyClientId")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("No Spotify client ID configured"))?;
    let token = spotify_token_request(&[
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token.as_str()),
        ("client_id", client_id),
    ])
    .await?;
    save_spotify_tokens(state, agent_id, client_id, &token)?;
    Ok(token)
}

fn save_spotify_tokens(
    state: &AppState,
    agent_id: &str,
    client_id: &str,
    token: &Value,
) -> AppResult<()> {
    let agent = get_required(state, "agents", agent_id)?;
    let mut settings = agent_settings(&agent);
    let access_token = token
        .get("access_token")
        .and_then(Value::as_str)
        .unwrap_or("");
    let refresh_token = token
        .get("refresh_token")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            spotify_stored_token(
                state,
                &settings,
                "spotifyRefreshToken",
                SPOTIFY_REFRESH_TOKEN_ENCRYPTED_KEY,
            )
            .ok()
            .flatten()
        })
        .unwrap_or_default();
    let expires_in = token
        .get("expires_in")
        .and_then(Value::as_u64)
        .unwrap_or(3600);
    let scope = token
        .get("scope")
        .and_then(Value::as_str)
        .or_else(|| settings.get("spotifyScope").and_then(Value::as_str))
        .unwrap_or("")
        .to_string();
    settings.insert(
        SPOTIFY_ACCESS_TOKEN_ENCRYPTED_KEY.to_string(),
        Value::String(connection_secrets::encrypt_secret(state, access_token)?),
    );
    settings.remove("spotifyAccessToken");
    settings.insert(
        SPOTIFY_REFRESH_TOKEN_ENCRYPTED_KEY.to_string(),
        Value::String(connection_secrets::encrypt_secret(state, &refresh_token)?),
    );
    settings.remove("spotifyRefreshToken");
    settings.insert(
        "spotifyExpiresAt".to_string(),
        json!(now_millis() + (expires_in as u128 * 1000)),
    );
    settings.insert(
        "spotifyClientId".to_string(),
        Value::String(client_id.to_string()),
    );
    settings.insert("spotifyScope".to_string(), Value::String(scope));
    state.storage.patch(
        "agents",
        agent_id,
        json!({ "settings": Value::Object(settings) }),
    )?;
    Ok(())
}

fn spotify_stored_token(
    state: &AppState,
    settings: &Map<String, Value>,
    plain_key: &str,
    encrypted_key: &str,
) -> AppResult<Option<String>> {
    if let Some(encrypted) = settings
        .get(encrypted_key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return connection_secrets::decrypt_secret(state, encrypted).map(Some);
    }
    Ok(settings
        .get(plain_key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned))
}

fn migrate_legacy_spotify_tokens(
    state: &AppState,
    agent_id: &str,
    settings: &mut Map<String, Value>,
) -> AppResult<()> {
    let mut changed = false;
    for (plain_key, encrypted_key) in [
        ("spotifyAccessToken", SPOTIFY_ACCESS_TOKEN_ENCRYPTED_KEY),
        ("spotifyRefreshToken", SPOTIFY_REFRESH_TOKEN_ENCRYPTED_KEY),
    ] {
        let has_encrypted = settings
            .get(encrypted_key)
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty());
        if has_encrypted {
            if settings.remove(plain_key).is_some() {
                changed = true;
            }
            continue;
        }
        let Some(plain) = settings
            .get(plain_key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
        else {
            continue;
        };
        settings.insert(
            encrypted_key.to_string(),
            Value::String(connection_secrets::encrypt_secret(state, &plain)?),
        );
        settings.remove(plain_key);
        changed = true;
    }
    if changed {
        state.storage.patch(
            "agents",
            agent_id,
            json!({ "settings": Value::Object(settings.clone()) }),
        )?;
    }
    Ok(())
}

async fn spotify_token_request(params: &[(&str, &str)]) -> AppResult<Value> {
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| AppError::new("spotify_client_error", error.to_string()))?
        .post("https://accounts.spotify.com/api/token")
        .header(
            reqwest::header::CONTENT_TYPE,
            "application/x-www-form-urlencoded",
        )
        .body(form_urlencoded(params))
        .send()
        .await
        .map_err(|error| AppError::new("spotify_network_error", error.to_string()))?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    let json = serde_json::from_str::<Value>(&text).unwrap_or_else(|_| json!({ "raw": text }));
    if !status.is_success() {
        return Err(AppError::with_details(
            "spotify_token_error",
            format!("Spotify token request failed with HTTP {status}"),
            json,
        ));
    }
    Ok(json)
}

struct SpotifyResponse {
    status: u16,
    body: String,
    json: Value,
}

async fn spotify_api(
    credentials: &SpotifyCredentials,
    path: &str,
    method: &str,
    body: Option<Value>,
) -> AppResult<SpotifyResponse> {
    let url = format!("https://api.spotify.com/v1{path}");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| AppError::new("spotify_client_error", error.to_string()))?;
    let method = method
        .parse::<reqwest::Method>()
        .map_err(|error| AppError::invalid_input(error.to_string()))?;
    let mut request = client
        .request(method, url)
        .bearer_auth(&credentials.access_token);
    if let Some(body) = body {
        request = request.json(&body);
    }
    let response = request
        .send()
        .await
        .map_err(|error| AppError::new("spotify_network_error", error.to_string()))?;
    let status = response.status().as_u16();
    let body = response.text().await.unwrap_or_default();
    let json = serde_json::from_str::<Value>(&body).unwrap_or(Value::Null);
    Ok(SpotifyResponse { status, body, json })
}

fn map_playback(data: &Value) -> Value {
    if data.is_null() {
        return json!({ "connected": true, "active": false });
    }
    let item = data.get("item").cloned().unwrap_or(Value::Null);
    let device = data.get("device").cloned().unwrap_or(Value::Null);
    let artists = item
        .get("artists")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|artist| artist.get("name").and_then(Value::as_str))
                .map(|name| Value::String(name.to_string()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    json!({
        "connected": true,
        "active": true,
        "isPlaying": data.get("is_playing").and_then(Value::as_bool).unwrap_or(false),
        "shuffle": data.get("shuffle_state").and_then(Value::as_bool).unwrap_or(false),
        "smartShuffle": data.get("smart_shuffle").and_then(Value::as_bool).unwrap_or(false),
        "repeat": match data.get("repeat_state").and_then(Value::as_str).unwrap_or("off") {
            "track" => "track",
            "context" => "context",
            _ => "off",
        },
        "progressMs": data.get("progress_ms").cloned().unwrap_or(Value::Null),
        "durationMs": item.get("duration_ms").cloned().unwrap_or(Value::Null),
        "item": if item.is_null() { Value::Null } else { json!({
            "id": item.get("id").cloned().unwrap_or(Value::Null),
            "uri": item.get("uri").cloned().unwrap_or(Value::Null),
            "name": item.get("name").and_then(Value::as_str).unwrap_or("Unknown track"),
            "type": item.get("type").and_then(Value::as_str).unwrap_or("track"),
            "artists": artists,
            "album": item.get("album").and_then(|album| album.get("name")).cloned().unwrap_or(Value::Null),
            "imageUrl": item.get("album").and_then(|album| album.get("images")).and_then(Value::as_array).and_then(|images| images.first()).and_then(|image| image.get("url")).cloned().unwrap_or(Value::Null)
        }) },
        "device": if device.is_null() { Value::Null } else { json!({
            "id": device.get("id").cloned().unwrap_or(Value::Null),
            "name": device.get("name").and_then(Value::as_str).unwrap_or("Spotify device"),
            "type": device.get("type").cloned().unwrap_or(Value::Null),
            "volume": device.get("volume_percent").cloned().unwrap_or(Value::Null),
            "isActive": device.get("is_active").and_then(Value::as_bool).unwrap_or(false)
        }) }
    })
}

fn agent_settings(agent: &Value) -> Map<String, Value> {
    match agent.get("settings") {
        Some(Value::Object(object)) => object.clone(),
        Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}

fn string_param(route: &ParsedPath, body: &Value, key: &str) -> Option<String> {
    body.get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            route
                .query
                .get(key)
                .filter(|value| !value.trim().is_empty())
                .cloned()
        })
}

fn spotify_code_and_state(body: &Value) -> AppResult<(String, String)> {
    if let (Some(code), Some(state)) = (
        body.get("code")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty()),
        body.get("state")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty()),
    ) {
        return Ok((code.to_string(), state.to_string()));
    }
    let callback_url = body
        .get("callbackUrl")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            AppError::invalid_input(
                "Missing code or state. Paste the full URL Spotify redirected your browser to.",
            )
        })?;
    let query = callback_url
        .split_once('?')
        .map(|(_, query)| query)
        .unwrap_or(callback_url);
    let params = parse_query(query);
    if let Some(error) = params.get("error") {
        return Err(AppError::invalid_input(format!(
            "Spotify returned an error: {error}"
        )));
    }
    let code = params
        .get("code")
        .cloned()
        .ok_or_else(|| AppError::invalid_input("Pasted URL did not include a Spotify code"))?;
    let state = params
        .get("state")
        .cloned()
        .ok_or_else(|| AppError::invalid_input("Pasted URL did not include a Spotify state"))?;
    Ok((code, state))
}

fn scope_list(scope: &str) -> Vec<String> {
    scope.split_whitespace().map(ToOwned::to_owned).collect()
}

fn spotify_control_path(path: &str, device_id: Option<&str>) -> String {
    match device_id.filter(|value| !value.is_empty()) {
        Some(device_id) => {
            let separator = if path.contains('?') { '&' } else { '?' };
            format!(
                "{path}{separator}device_id={}",
                percent_encode_component(device_id)
            )
        }
        None => path.to_string(),
    }
}

fn map_track_candidate(item: Value) -> Option<Value> {
    let uri = item.get("uri").and_then(Value::as_str)?.to_string();
    if !uri.starts_with("spotify:track:") {
        return None;
    }
    let artists = item
        .get("artists")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|artist| artist.get("name").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default();
    Some(json!({
        "uri": uri,
        "name": item.get("name").and_then(Value::as_str).unwrap_or("Unknown track"),
        "artist": artists,
        "album": item.get("album").and_then(|album| album.get("name")).cloned().unwrap_or(Value::Null),
        "imageUrl": item.get("album").and_then(|album| album.get("images")).and_then(Value::as_array).and_then(|images| images.first()).and_then(|image| image.get("url")).cloned().unwrap_or(Value::Null),
        "durationMs": item.get("duration_ms").cloned().unwrap_or(Value::Null),
        "score": Value::Null
    }))
}

fn random_token(length: usize) -> String {
    let raw = new_id().replace('-', "");
    raw.chars().cycle().take(length).collect()
}

fn code_challenge(verifier: &str) -> String {
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine as _;
    use sha2::{Digest, Sha256};
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

fn form_urlencoded(params: &[(&str, &str)]) -> String {
    params
        .iter()
        .map(|(key, value)| {
            format!(
                "{}={}",
                percent_encode_component(key),
                percent_encode_component(value)
            )
        })
        .collect::<Vec<_>>()
        .join("&")
}

fn parse_query(query: &str) -> HashMap<String, String> {
    query
        .split('&')
        .filter_map(|pair| {
            let (key, value) = pair.split_once('=')?;
            Some((key.to_string(), percent_decode_component(value)))
        })
        .collect()
}

fn percent_decode_component(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'+' => {
                output.push(b' ');
                index += 1;
            }
            b'%' if index + 2 < bytes.len() => {
                let hex = &value[index + 1..index + 3];
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    output.push(byte);
                    index += 3;
                } else {
                    output.push(bytes[index]);
                    index += 1;
                }
            }
            byte => {
                output.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&output).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempRoot(PathBuf);

    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn test_state(label: &str) -> (TempRoot, AppState) {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let root = TempRoot(std::env::temp_dir().join(format!("marinara-spotify-{label}-{nonce}")));
        let state =
            AppState::from_data_dir(&root.0, Vec::new()).expect("test app state should initialize");
        (root, state)
    }

    #[test]
    fn spotify_source_type_accepts_supported_sources_only() {
        assert_eq!(
            spotify_source_type(&json!({ "sourceType": "liked" })),
            "liked"
        );
        assert_eq!(
            spotify_source_type(&json!({ "sourceType": "playlist" })),
            "playlist"
        );
        assert_eq!(
            spotify_source_type(&json!({ "sourceType": "artist" })),
            "artist"
        );
        assert_eq!(
            spotify_source_type(&json!({ "sourceType": "unexpected" })),
            "any"
        );
        assert_eq!(spotify_source_type(&json!({})), "any");
    }

    #[test]
    fn spotify_device_retry_is_limited_to_device_failures() {
        let stale_device = SpotifyResponse {
            status: 404,
            body: r#"{"error":{"message":"Device not found"}}"#.to_string(),
            json: json!({}),
        };
        assert!(spotify_should_retry_device(
            &stale_device,
            Some("stale-device")
        ));

        let no_active_device = SpotifyResponse {
            status: 404,
            body: r#"{"error":{"message":"No active device found"}}"#.to_string(),
            json: json!({}),
        };
        assert!(spotify_should_retry_device(&no_active_device, None));

        let auth_error = SpotifyResponse {
            status: 401,
            body: r#"{"error":{"message":"The access token expired"}}"#.to_string(),
            json: json!({}),
        };
        assert!(!spotify_should_retry_device(&auth_error, Some("device")));
    }

    #[test]
    fn spotify_legacy_plaintext_tokens_migrate_to_encrypted_settings() {
        let (_root, state) = test_state("token-migration");
        state
            .storage
            .upsert_with_id(
                "agents",
                "spotify",
                json!({
                    "id": "spotify",
                    "type": "spotify",
                    "settings": {
                        "spotifyAccessToken": "access-secret",
                        "spotifyRefreshToken": "refresh-secret",
                        "spotifyClientId": "client-id"
                    }
                }),
            )
            .expect("spotify agent should be stored");

        let agent = get_required(&state, "agents", "spotify").expect("spotify agent should read");
        let mut settings = agent_settings(&agent);
        migrate_legacy_spotify_tokens(&state, "spotify", &mut settings)
            .expect("legacy tokens should migrate");

        let raw = state
            .storage
            .get("agents", "spotify")
            .expect("agent read should succeed")
            .expect("agent should exist");
        let migrated = agent_settings(&raw);
        assert!(migrated.get("spotifyAccessToken").is_none());
        assert!(migrated.get("spotifyRefreshToken").is_none());
        assert_ne!(
            migrated
                .get(SPOTIFY_ACCESS_TOKEN_ENCRYPTED_KEY)
                .and_then(Value::as_str),
            Some("access-secret")
        );
        assert_eq!(
            spotify_stored_token(
                &state,
                &migrated,
                "spotifyAccessToken",
                SPOTIFY_ACCESS_TOKEN_ENCRYPTED_KEY,
            )
            .expect("access token should decrypt"),
            Some("access-secret".to_string())
        );
        assert_eq!(
            spotify_stored_token(
                &state,
                &migrated,
                "spotifyRefreshToken",
                SPOTIFY_REFRESH_TOKEN_ENCRYPTED_KEY,
            )
            .expect("refresh token should decrypt"),
            Some("refresh-secret".to_string())
        );
    }
}
