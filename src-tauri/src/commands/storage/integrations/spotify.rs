use super::super::connection_secrets;
use super::super::images::percent_encode_component;
use super::super::shared::*;
use super::super::*;
use super::spotify_callback::start_callback_listener;
use super::spotify_query::parse_query;
use sha2::{Digest, Sha256};
use std::sync::{Mutex, OnceLock};

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
const SPOTIFY_TRACK_INDEX_TTL_MS: u128 = 20 * 60_000;
const SPOTIFY_TRACK_INDEX_CACHE_MAX: usize = 24;
const SPOTIFY_TRACK_INDEX_MAX_TRACKS: u32 = 2_500;

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

#[derive(Clone)]
struct SpotifyTrackIndexCacheEntry {
    tracks: Vec<Value>,
    total: u64,
    fetched_at: u128,
    expires_at: u128,
    truncated: bool,
}

static SPOTIFY_TRACK_INDEX_CACHE: OnceLock<
    Mutex<std::collections::HashMap<String, SpotifyTrackIndexCacheEntry>>,
> = OnceLock::new();

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
        return spotify_indexed_candidate_response(
            &credentials,
            "liked",
            "liked",
            body.get("playlistName").cloned().unwrap_or(Value::Null),
            spotify_candidate_query(&body, query),
            limit.min(80),
            &recent,
        )
        .await;
    }
    if source_type == "playlist" {
        let playlist_id = body
            .get("playlistId")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| {
                AppError::invalid_input("Spotify playlist source requires playlistId")
            })?;
        return spotify_indexed_candidate_response(
            &credentials,
            playlist_id,
            "playlist",
            body.get("playlistName").cloned().unwrap_or(Value::Null),
            spotify_candidate_query(&body, query),
            limit.min(80),
            &recent,
        )
        .await;
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

fn spotify_track_index_cache(
) -> &'static Mutex<std::collections::HashMap<String, SpotifyTrackIndexCacheEntry>> {
    SPOTIFY_TRACK_INDEX_CACHE.get_or_init(|| Mutex::new(std::collections::HashMap::new()))
}

fn spotify_cache_secret_digest(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    let mut out = String::with_capacity(12);
    for byte in digest.iter().take(6) {
        out.push_str(&format!("{:02x}", *byte));
    }
    out
}

fn spotify_track_cache_key(credentials: &SpotifyCredentials, playlist_id: &str) -> String {
    format!("{}:{playlist_id}", credentials.cache_key)
}

fn clear_spotify_track_index_cache_for_agent(agent_id: &str) {
    if agent_id.trim().is_empty() {
        return;
    }
    let cache = spotify_track_index_cache();
    let Ok(mut guard) = cache.lock() else {
        return;
    };
    let prefix = format!("{agent_id}:");
    guard.retain(|key, _| !key.starts_with(&prefix));
}

fn cached_spotify_track_index(
    credentials: &SpotifyCredentials,
    playlist_id: &str,
) -> Option<SpotifyTrackIndexCacheEntry> {
    let cache = spotify_track_index_cache();
    let guard = cache.lock().ok()?;
    let entry = guard.get(&spotify_track_cache_key(credentials, playlist_id))?;
    if entry.expires_at > now_millis() {
        Some(entry.clone())
    } else {
        None
    }
}

fn store_spotify_track_index(
    credentials: &SpotifyCredentials,
    playlist_id: &str,
    entry: SpotifyTrackIndexCacheEntry,
) {
    let cache = spotify_track_index_cache();
    let Ok(mut guard) = cache.lock() else {
        return;
    };
    guard.insert(spotify_track_cache_key(credentials, playlist_id), entry);
    if guard.len() <= SPOTIFY_TRACK_INDEX_CACHE_MAX {
        return;
    }
    let mut entries = guard
        .iter()
        .map(|(key, value)| (key.clone(), value.fetched_at))
        .collect::<Vec<_>>();
    entries.sort_by_key(|(_, fetched_at)| *fetched_at);
    while guard.len() > SPOTIFY_TRACK_INDEX_CACHE_MAX {
        let Some((key, _)) = entries.first().cloned() else {
            break;
        };
        guard.remove(&key);
        entries.remove(0);
    }
}

fn spotify_candidate_query(body: &Value, fallback: &str) -> String {
    let mut parts = [body.get("query"), body.get("mood"), body.get("scene")]
        .into_iter()
        .filter_map(|value| value.and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    if parts.is_empty() && !fallback.trim().is_empty() {
        parts.push(fallback.trim());
    }
    parts.join(" ")
}

fn spotify_stop_word(token: &str) -> bool {
    matches!(
        token,
        "a" | "an"
            | "and"
            | "are"
            | "as"
            | "at"
            | "for"
            | "from"
            | "in"
            | "into"
            | "is"
            | "it"
            | "of"
            | "on"
            | "or"
            | "the"
            | "to"
            | "with"
    )
}

fn spotify_tokens_contain_any(tokens: &std::collections::HashSet<String>, terms: &[&str]) -> bool {
    terms.iter().any(|term| tokens.contains(*term))
}

fn spotify_text_contains_any(normalized: &str, terms: &[&str]) -> bool {
    terms.iter().any(|term| normalized.contains(term))
}

fn spotify_insert_terms(tokens: &mut std::collections::HashSet<String>, terms: &[&str]) {
    for term in terms {
        tokens.insert((*term).to_string());
    }
}

fn spotify_candidate_tokens(query: &str) -> Vec<String> {
    let normalized = normalize_spotify_text(query);
    let mut tokens = normalized
        .split_whitespace()
        .filter(|token| token.len() > 1 && !spotify_stop_word(token))
        .map(ToOwned::to_owned)
        .collect::<std::collections::HashSet<_>>();

    if spotify_tokens_contain_any(
        &tokens,
        &[
            "action", "battle", "boss", "chase", "combat", "danger", "duel", "fight", "war",
        ],
    ) || spotify_text_contains_any(&normalized, &["battle", "combat", "fight"])
    {
        spotify_insert_terms(
            &mut tokens,
            &["battle", "combat", "fight", "boss", "war", "intense"],
        );
    }
    if spotify_tokens_contain_any(
        &tokens,
        &[
            "calm", "cozy", "gentle", "peace", "peaceful", "rest", "safe", "soft",
        ],
    ) || spotify_text_contains_any(&normalized, &["peace", "rest", "calm"])
    {
        spotify_insert_terms(
            &mut tokens,
            &["calm", "peace", "gentle", "soft", "rest", "serene"],
        );
    }
    if spotify_tokens_contain_any(
        &tokens,
        &[
            "dark", "dread", "fear", "horror", "ominous", "scary", "shadow", "terror",
        ],
    ) {
        spotify_insert_terms(
            &mut tokens,
            &["dark", "ominous", "shadow", "night", "horror"],
        );
    }
    if spotify_tokens_contain_any(
        &tokens,
        &[
            "grief",
            "lonely",
            "melancholy",
            "sad",
            "sorrow",
            "tragic",
            "tears",
        ],
    ) || spotify_text_contains_any(&normalized, &["sad", "grief", "melancholy"])
    {
        spotify_insert_terms(
            &mut tokens,
            &["sad", "sorrow", "melancholy", "lament", "lonely"],
        );
    }
    if spotify_tokens_contain_any(&tokens, &["love", "romance", "romantic", "tender", "warm"]) {
        spotify_insert_terms(&mut tokens, &["love", "romance", "tender", "heart", "warm"]);
    }
    if spotify_tokens_contain_any(
        &tokens,
        &["mystery", "secret", "sneak", "stealth", "suspense", "tense"],
    ) || spotify_text_contains_any(&normalized, &["tense", "suspense"])
    {
        spotify_insert_terms(
            &mut tokens,
            &["mystery", "secret", "stealth", "tension", "suspense"],
        );
    }
    if spotify_tokens_contain_any(&tokens, &["epic", "heroic", "triumph", "victory"]) {
        spotify_insert_terms(
            &mut tokens,
            &["epic", "hero", "triumph", "victory", "theme"],
        );
    }

    let mut tokens = tokens.into_iter().collect::<Vec<_>>();
    tokens.sort();
    tokens
}

fn hash_fraction(value: &str) -> f64 {
    let digest = Sha256::digest(value.as_bytes());
    let bytes = [digest[0], digest[1], digest[2], digest[3]];
    u32::from_be_bytes(bytes) as f64 / u32::MAX as f64
}

fn spotify_candidate_field(track: &Value, key: &str) -> String {
    track
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn score_spotify_candidate(track: &Value, phrase: &str, tokens: &[String]) -> f64 {
    let name = normalize_spotify_text(&spotify_candidate_field(track, "name"));
    let artist = normalize_spotify_text(&spotify_candidate_field(track, "artist"));
    let album = normalize_spotify_text(&spotify_candidate_field(track, "album"));
    let haystack = format!("{name} {artist} {album}");
    let mut score = 0.0;
    if !phrase.is_empty() && haystack.contains(phrase) {
        score += 35.0;
    }
    for token in tokens {
        if name.contains(token) {
            score += 8.0;
        }
        if album.contains(token) {
            score += 4.0;
        }
        if artist.contains(token) {
            score += 2.0;
        }
    }
    let uri = spotify_candidate_field(track, "uri");
    score + hash_fraction(&format!("{uri}:{phrase}")) * 0.01
}

fn candidate_with_score(track: &Value, score: f64) -> Value {
    let mut next = track.clone();
    if let Value::Object(object) = &mut next {
        object.insert("score".to_string(), Value::from(score));
    }
    next
}

fn sample_spotify_tracks_evenly(tracks: &[Value], count: usize, seed: &str) -> Vec<Value> {
    if tracks.len() <= count {
        return tracks.to_vec();
    }
    let start_window = tracks.len().saturating_div(count).max(1);
    let start = (hash_fraction(seed) * start_window as f64).floor() as usize;
    let step = tracks.len() as f64 / count as f64;
    let mut selected = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for index in 0..count * 3 {
        if selected.len() >= count {
            break;
        }
        let track_index = ((start as f64 + index as f64 * step).floor() as usize) % tracks.len();
        let track = &tracks[track_index];
        let uri = spotify_candidate_field(track, "uri");
        if !uri.is_empty() && seen.insert(uri) {
            selected.push(track.clone());
        }
    }
    for track in tracks {
        if selected.len() >= count {
            break;
        }
        let uri = spotify_candidate_field(track, "uri");
        if !uri.is_empty() && seen.insert(uri) {
            selected.push(track.clone());
        }
    }
    selected
}

fn select_spotify_track_candidates(
    tracks: &[Value],
    query: &str,
    limit: usize,
    playlist_id: &str,
) -> (Vec<Value>, &'static str, Vec<String>) {
    let phrase = normalize_spotify_text(query);
    let tokens = spotify_candidate_tokens(query);
    if tokens.is_empty() {
        return (
            sample_spotify_tracks_evenly(tracks, limit, &format!("{playlist_id}:balanced")),
            "balanced_sample",
            tokens,
        );
    }

    let mut scored = tracks
        .iter()
        .map(|track| {
            let score = score_spotify_candidate(track, &phrase, &tokens);
            (candidate_with_score(track, score), score)
        })
        .collect::<Vec<_>>();
    scored.sort_by(|(_, a), (_, b)| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
    let strong = scored
        .iter()
        .filter(|(_, score)| *score >= 2.0)
        .map(|(track, _)| track.clone())
        .collect::<Vec<_>>();
    let mut selected = strong
        .iter()
        .take((limit as f64 * 0.8).floor() as usize)
        .cloned()
        .collect::<Vec<_>>();
    let mut seen = selected
        .iter()
        .map(|track| spotify_candidate_field(track, "uri"))
        .collect::<std::collections::HashSet<_>>();
    let reserve = limit.saturating_sub(selected.len());
    if reserve > 0 {
        let fallback_source = scored
            .iter()
            .map(|(track, _)| track.clone())
            .filter(|track| !seen.contains(&spotify_candidate_field(track, "uri")))
            .collect::<Vec<_>>();
        for track in sample_spotify_tracks_evenly(
            &fallback_source,
            reserve,
            &format!("{playlist_id}:{phrase}:fallback"),
        ) {
            let uri = spotify_candidate_field(&track, "uri");
            if seen.insert(uri) {
                selected.push(track);
            }
        }
    }

    (
        selected.into_iter().take(limit).collect(),
        if strong.is_empty() {
            "balanced_sample"
        } else {
            "scored_candidates"
        },
        tokens,
    )
}

fn playlist_item_candidate(item: Value, position: u32) -> Option<Value> {
    let track = item
        .get("track")
        .cloned()
        .or_else(|| item.get("item").cloned())
        .unwrap_or(item);
    let mut candidate = map_track_candidate(track)?;
    if let Value::Object(object) = &mut candidate {
        object.insert("position".to_string(), Value::from(position));
    }
    Some(candidate)
}

async fn fetch_spotify_track_index(
    credentials: &SpotifyCredentials,
    playlist_id: &str,
) -> AppResult<(SpotifyTrackIndexCacheEntry, &'static str)> {
    if let Some(entry) = cached_spotify_track_index(credentials, playlist_id) {
        return Ok((entry, "hit"));
    }

    let mut tracks = Vec::new();
    let mut offset = 0_u32;
    let mut total = 0_u64;
    let mut fetched_items = 0_u32;
    let batch_size = 50_u32;

    while offset < SPOTIFY_TRACK_INDEX_MAX_TRACKS {
        let page_size = batch_size.min(SPOTIFY_TRACK_INDEX_MAX_TRACKS - offset);
        let path = if playlist_id == "liked" {
            format!("/me/tracks?limit={page_size}&offset={offset}")
        } else {
            format!(
                "/playlists/{}/items?limit={page_size}&offset={offset}",
                percent_encode_component(playlist_id)
            )
        };
        let response = spotify_api(credentials, &path, "GET", None).await?;
        if !(200..300).contains(&response.status) {
            let message = if response.status == 403 && playlist_id != "liked" {
                "Spotify rejected that playlist read. Reconnect Spotify, confirm playlist-read-private scope, or choose a playlist owned by this account."
            } else {
                "Spotify source tracks failed"
            };
            return Err(AppError::with_details(
                "spotify_api_error",
                message,
                json!({
                    "status": response.status,
                    "body": response.body,
                    "endpoint": if playlist_id == "liked" { "/me/tracks" } else { "/playlists/{id}/items" }
                }),
            ));
        }
        let items = response
            .json
            .get("items")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let item_count = items.len() as u32;
        total = response
            .json
            .get("total")
            .and_then(Value::as_u64)
            .unwrap_or_else(|| total.max(u64::from(offset + item_count)));
        fetched_items = offset + item_count;
        for (index, item) in items.into_iter().enumerate() {
            if let Some(candidate) = playlist_item_candidate(item, offset + index as u32 + 1) {
                tracks.push(candidate);
            }
        }
        let has_next = response
            .json
            .get("next")
            .and_then(Value::as_str)
            .is_some_and(|next| !next.trim().is_empty());
        if !has_next || item_count == 0 || item_count < page_size {
            break;
        }
        offset += item_count;
    }

    let entry = SpotifyTrackIndexCacheEntry {
        total: if total == 0 {
            tracks.len() as u64
        } else {
            total
        },
        truncated: fetched_items >= SPOTIFY_TRACK_INDEX_MAX_TRACKS
            && u64::from(fetched_items) < total,
        tracks,
        fetched_at: now_millis(),
        expires_at: now_millis() + SPOTIFY_TRACK_INDEX_TTL_MS,
    };
    store_spotify_track_index(credentials, playlist_id, entry.clone());
    Ok((entry, "miss"))
}

async fn spotify_indexed_candidate_response(
    credentials: &SpotifyCredentials,
    playlist_id: &str,
    source: &str,
    playlist_name: Value,
    query: String,
    limit: u32,
    recent: &[String],
) -> AppResult<Value> {
    let (index, cache_status) = fetch_spotify_track_index(credentials, playlist_id).await?;
    let recent = recent
        .iter()
        .map(|uri| uri.as_str())
        .collect::<std::collections::HashSet<_>>();
    let filtered = index
        .tracks
        .iter()
        .filter(|track| {
            track
                .get("uri")
                .and_then(Value::as_str)
                .is_some_and(|uri| !recent.contains(uri))
        })
        .cloned()
        .collect::<Vec<_>>();
    let source_tracks = if filtered.is_empty() {
        index.tracks.as_slice()
    } else {
        filtered.as_slice()
    };
    let candidate_limit = limit.clamp(1, 80) as usize;
    let (tracks, candidate_mode, matched_tokens) =
        select_spotify_track_candidates(source_tracks, &query, candidate_limit, playlist_id);
    let count = tracks.len();

    Ok(json!({
        "enabled": true,
        "playlistId": playlist_id,
        "playlistName": playlist_name,
        "tracks": tracks,
        "count": count,
        "total": index.total,
        "indexedTrackCount": index.tracks.len(),
        "cacheStatus": cache_status,
        "candidateMode": candidate_mode,
        "source": source,
        "query": if query.trim().is_empty() { Value::Null } else { Value::String(query) },
        "matchedTokens": matched_tokens,
        "truncated": index.truncated,
        "hint": "Spotify source was indexed and only scored candidates were returned. Pick from this shortlist; do not manually page unless you need raw browsing."
    }))
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
    let has_explicit_offset = body.get("offset").is_some();
    if !has_explicit_offset {
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
        return spotify_indexed_candidate_response(
            &credentials,
            playlist_id,
            if playlist_id == "liked" {
                "liked"
            } else {
                "playlist"
            },
            body.get("playlistName").cloned().unwrap_or(Value::Null),
            spotify_candidate_query(&body, ""),
            body.get("candidateLimit")
                .and_then(Value::as_u64)
                .unwrap_or(u64::from(limit))
                .clamp(1, 80) as u32,
            &recent,
        )
        .await;
    }
    let path = if playlist_id == "liked" {
        format!("/me/tracks?limit={limit}&offset={offset}")
    } else {
        format!(
            "/playlists/{}/items?limit={limit}&offset={offset}",
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
    let repeat =
        spotify_set_repeat_with_retries(&credentials, "track", device_id.as_deref(), 3).await?;
    let playback = spotify_current_playback_summary(&credentials).await?;
    Ok(json!({
        "played": true,
        "track": track,
        "currentUri": playback.get("currentUri").cloned().unwrap_or(Value::Null),
        "repeatState": repeat
            .or_else(|| playback.get("repeatState").cloned())
            .unwrap_or(Value::Null),
        "device": playback.get("device").cloned().unwrap_or(Value::Null)
    }))
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
    Ok(spotify_available_device(credentials, mobile_device_only)
        .await?
        .and_then(|device| {
            device
                .get("id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        }))
}

async fn spotify_available_device(
    credentials: &SpotifyCredentials,
    mobile_device_only: bool,
) -> AppResult<Option<Value>> {
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
    Ok(selected.cloned())
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

async fn spotify_set_repeat_with_retries(
    credentials: &SpotifyCredentials,
    repeat: &str,
    device_id: Option<&str>,
    attempts: usize,
) -> AppResult<Option<Value>> {
    let attempts = attempts.max(1);
    let mut latest_state = None;
    for attempt in 0..attempts {
        if attempt > 0 {
            tokio::time::sleep(Duration::from_millis(250 * attempt as u64)).await;
        }
        let response = spotify_player_repeat_command(credentials, repeat, device_id).await?;
        if !spotify_response_ok(&response) {
            continue;
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
        let playback = spotify_current_playback_summary(credentials).await?;
        latest_state = playback.get("repeatState").cloned();
        if latest_state.as_ref().and_then(Value::as_str) == Some(repeat) {
            return Ok(latest_state);
        }
    }
    Ok(latest_state)
}

async fn spotify_current_playback_summary(credentials: &SpotifyCredentials) -> AppResult<Value> {
    let response = spotify_api(credentials, "/me/player", "GET", None).await?;
    if response.status == 204 {
        return Ok(json!({
            "currentUri": Value::Null,
            "repeatState": Value::Null,
            "device": Value::Null,
            "display": Value::Null
        }));
    }
    if !(200..300).contains(&response.status) {
        return Ok(json!({
            "currentUri": Value::Null,
            "repeatState": Value::Null,
            "device": Value::Null,
            "display": Value::Null
        }));
    }
    let playback = map_playback(&response.json);
    let item = playback.get("item").cloned().unwrap_or(Value::Null);
    let name = item.get("name").and_then(Value::as_str).unwrap_or("");
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
    let display = if name.is_empty() {
        Value::Null
    } else if artists.is_empty() {
        Value::String(name.to_string())
    } else {
        Value::String(format!("{name} - {artists}"))
    };
    Ok(json!({
        "currentUri": item.get("uri").cloned().unwrap_or(Value::Null),
        "repeatState": playback.get("repeat").cloned().unwrap_or(Value::Null),
        "device": playback.get("device").cloned().unwrap_or(Value::Null),
        "display": display
    }))
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
    clear_spotify_track_index_cache_for_agent(&agent_id);
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
        let device = spotify_available_device(&credentials, false)
            .await?
            .map(map_spotify_device)
            .unwrap_or(Value::Null);
        let note = if device.is_null() {
            "No active Spotify playback. Open Spotify on a device, then call spotify_play with a fitting track."
        } else {
            "No active Spotify playback, but a Spotify device is available. Call spotify_play with a fitting track."
        };
        return Ok(json!({
            "connected": true,
            "active": false,
            "isPlaying": false,
            "item": Value::Null,
            "track": Value::Null,
            "device": device,
            "note": note
        }));
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

fn spotify_fold_latin_char(ch: char) -> char {
    match ch {
        'á' | 'à' | 'â' | 'ä' | 'ã' | 'å' | 'ā' | 'ă' | 'ą' | 'ǎ' | 'ạ' | 'ả' | 'ấ' | 'ầ' | 'ẩ'
        | 'ẫ' | 'ậ' | 'ắ' | 'ằ' | 'ẳ' | 'ẵ' | 'ặ' | 'æ' => 'a',
        'ç' | 'ć' | 'ĉ' | 'ċ' | 'č' => 'c',
        'ď' | 'đ' | 'ð' => 'd',
        'é' | 'è' | 'ê' | 'ë' | 'ē' | 'ĕ' | 'ė' | 'ę' | 'ě' | 'ȅ' | 'ȇ' | 'ẹ' | 'ẻ' | 'ẽ' | 'ế'
        | 'ề' | 'ể' | 'ễ' | 'ệ' => 'e',
        'ĝ' | 'ğ' | 'ġ' | 'ģ' => 'g',
        'ĥ' | 'ħ' => 'h',
        'í' | 'ì' | 'î' | 'ï' | 'ĩ' | 'ī' | 'ĭ' | 'į' | 'ı' | 'ǐ' | 'ị' | 'ỉ' => 'i',
        'ĵ' => 'j',
        'ķ' => 'k',
        'ĺ' | 'ļ' | 'ľ' | 'ł' => 'l',
        'ñ' | 'ń' | 'ņ' | 'ň' => 'n',
        'ó' | 'ò' | 'ô' | 'ö' | 'õ' | 'ø' | 'ō' | 'ŏ' | 'ő' | 'ǒ' | 'ǫ' | 'ǭ' | 'ȍ' | 'ȏ' | 'ọ'
        | 'ỏ' | 'ố' | 'ồ' | 'ổ' | 'ỗ' | 'ộ' | 'ớ' | 'ờ' | 'ở' | 'ỡ' | 'ợ' | 'œ' => {
            'o'
        }
        'ŕ' | 'ŗ' | 'ř' => 'r',
        'ś' | 'ŝ' | 'ş' | 'š' | 'ß' => 's',
        'ţ' | 'ť' | 'ŧ' => 't',
        'ú' | 'ù' | 'û' | 'ü' | 'ũ' | 'ū' | 'ŭ' | 'ů' | 'ű' | 'ų' | 'ǔ' | 'ụ' | 'ủ' | 'ứ' | 'ừ'
        | 'ử' | 'ữ' | 'ự' => 'u',
        'ý' | 'ÿ' | 'ŷ' | 'ỳ' | 'ỵ' | 'ỷ' | 'ỹ' => 'y',
        'ź' | 'ż' | 'ž' => 'z',
        _ => ch,
    }
}

fn normalize_spotify_text(value: &str) -> String {
    value
        .chars()
        .flat_map(char::to_lowercase)
        .map(spotify_fold_latin_char)
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
    let is_play = path.ends_with("/play");
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
    let requested_uris = payload
        .as_ref()
        .and_then(|value| value.get("uris"))
        .and_then(Value::as_array)
        .map(|uris| {
            Value::Array(
                uris.iter()
                    .filter_map(Value::as_str)
                    .map(|uri| Value::String(uri.to_string()))
                    .collect(),
            )
        })
        .unwrap_or(Value::Null);
    let requested_context_uri = payload
        .as_ref()
        .and_then(|value| value.get("context_uri"))
        .cloned()
        .unwrap_or(Value::Null);
    let response =
        spotify_api_with_device_retry(&credentials, path, device_id, method, payload).await?;
    if !(200..300).contains(&response.status) && response.status != 204 {
        return Err(AppError::with_details(
            "spotify_api_error",
            "Spotify playback command failed",
            json!({ "status": response.status, "body": response.body }),
        ));
    }
    if is_play {
        let requested_repeat = body
            .get("repeatAfterPlay")
            .and_then(Value::as_str)
            .filter(|repeat| matches!(*repeat, "track" | "context" | "off"));
        let repeat_state = if let Some(repeat) = requested_repeat {
            spotify_set_repeat_with_retries(&credentials, repeat, device_id, 3).await?
        } else {
            None
        };
        let playback = spotify_current_playback_summary(&credentials).await?;
        return Ok(json!({
            "success": true,
            "applied": true,
            "uris": requested_uris,
            "contextUri": requested_context_uri,
            "currentUri": playback.get("currentUri").cloned().unwrap_or(Value::Null),
            "repeatState": repeat_state
                .or_else(|| playback.get("repeatState").cloned())
                .unwrap_or(Value::Null),
            "device": playback.get("device").cloned().unwrap_or(Value::Null),
            "display": playback.get("display").cloned().unwrap_or(Value::Null),
            "queued": requested_uris.clone()
        }));
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
    clear_spotify_track_index_cache_for_agent(agent_id);
    Ok(json!({ "success": true }))
}

#[derive(Clone)]
struct SpotifyCredentials {
    access_token: String,
    agent_id: String,
    cache_key: String,
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
        cache_key: format!(
            "{}:{}",
            agent_id,
            spotify_cache_secret_digest(&access_token)
        ),
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

fn map_spotify_device(device: Value) -> Value {
    if device.is_null() {
        return Value::Null;
    }
    json!({
        "id": device.get("id").cloned().unwrap_or(Value::Null),
        "name": device.get("name").and_then(Value::as_str).unwrap_or("Spotify device"),
        "type": device.get("type").cloned().unwrap_or(Value::Null),
        "volume": device.get("volume_percent").cloned().unwrap_or(Value::Null),
        "isActive": device.get("is_active").and_then(Value::as_bool).unwrap_or(false)
    })
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
    let mapped_item = if item.is_null() {
        Value::Null
    } else {
        json!({
            "id": item.get("id").cloned().unwrap_or(Value::Null),
            "uri": item.get("uri").cloned().unwrap_or(Value::Null),
            "name": item.get("name").and_then(Value::as_str).unwrap_or("Unknown track"),
            "type": item.get("type").and_then(Value::as_str).unwrap_or("track"),
            "artists": artists,
            "album": item.get("album").and_then(|album| album.get("name")).cloned().unwrap_or(Value::Null),
            "imageUrl": item.get("album").and_then(|album| album.get("images")).and_then(Value::as_array).and_then(|images| images.first()).and_then(|image| image.get("url")).cloned().unwrap_or(Value::Null)
        })
    };
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
        "item": mapped_item.clone(),
        "track": mapped_item,
        "device": map_spotify_device(device)
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
    fn spotify_track_cache_key_changes_with_access_token_digest() {
        let mut credentials = SpotifyCredentials {
            access_token: "access-one".to_string(),
            agent_id: "spotify".to_string(),
            cache_key: format!("spotify:{}", spotify_cache_secret_digest("access-one")),
            expires_at: 0,
            scopes: Vec::new(),
        };
        let first = spotify_track_cache_key(&credentials, "playlist-1");

        credentials.access_token = "access-two".to_string();
        credentials.cache_key = format!(
            "spotify:{}",
            spotify_cache_secret_digest(&credentials.access_token)
        );
        let second = spotify_track_cache_key(&credentials, "playlist-1");

        assert_ne!(first, second);
        assert!(first.starts_with("spotify:"));
        assert!(first.ends_with(":playlist-1"));
    }

    #[test]
    fn spotify_candidate_tokens_fold_accents_and_expand_legacy_moods() {
        assert_eq!(normalize_spotify_text("Beyoncé Déjà Vu"), "beyonce deja vu");

        let tokens = spotify_candidate_tokens("Beyoncé tragic romance");
        assert!(tokens.contains(&"beyonce".to_string()));
        assert!(tokens.contains(&"sorrow".to_string()));
        assert!(tokens.contains(&"heart".to_string()));

        let battlefield = spotify_candidate_tokens("battlefield fighting");
        assert!(battlefield.contains(&"intense".to_string()));

        let suspenseful = spotify_candidate_tokens("suspenseful corridor");
        assert!(suspenseful.contains(&"suspense".to_string()));

        let peaceful = spotify_candidate_tokens("peacefully resting");
        assert!(peaceful.contains(&"serene".to_string()));
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
