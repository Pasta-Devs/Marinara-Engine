use super::super::*;
use super::spotify::exchange;
use super::spotify_query::parse_query;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const SPOTIFY_CALLBACK_HOST: &str = "127.0.0.1";
const SPOTIFY_CALLBACK_PORT: u16 = 8754;
const SPOTIFY_CALLBACK_PATH: &str = "/spotify/callback";
const AUTH_TTL_MS: u128 = 10 * 60_000;

pub(super) fn start_callback_listener(state: AppState) -> bool {
    let Ok(listener) = std::net::TcpListener::bind((SPOTIFY_CALLBACK_HOST, SPOTIFY_CALLBACK_PORT))
    else {
        return false;
    };
    if listener.set_nonblocking(true).is_err() {
        return false;
    }
    let Ok(listener) = tokio::net::TcpListener::from_std(listener) else {
        return false;
    };
    tauri::async_runtime::spawn(async move {
        let _ = run_callback_listener(state, listener).await;
    });
    true
}

async fn run_callback_listener(
    state: AppState,
    listener: tokio::net::TcpListener,
) -> AppResult<()> {
    let timeout = Duration::from_millis(AUTH_TTL_MS as u64);
    let Ok(accepted) = tokio::time::timeout(timeout, listener.accept()).await else {
        return Ok(());
    };
    let (mut stream, _) = accepted?;
    let mut buffer = vec![0_u8; 8192];
    let read = stream.read(&mut buffer).await?;
    let request = String::from_utf8_lossy(&buffer[..read]).to_string();
    let result = handle_callback_request(&state, &request).await;
    let (status, title, body) = match result {
        Ok(()) => (
            "200 OK",
            "Spotify connected",
            "Spotify is connected. You can close this browser tab and return to Marinara."
                .to_string(),
        ),
        Err(message) => ("400 Bad Request", "Spotify connection failed", message),
    };
    let body = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{}</title></head><body><h1>{}</h1><p>{}</p></body></html>",
        html_escape(title),
        html_escape(title),
        html_escape(&body),
    );
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    stream.write_all(response.as_bytes()).await?;
    stream.shutdown().await?;
    Ok(())
}

async fn handle_callback_request(state: &AppState, request: &str) -> Result<(), String> {
    let line = request
        .lines()
        .next()
        .ok_or_else(|| "Spotify callback request was empty.".to_string())?;
    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("");
    if method != "GET" {
        return Err("Spotify callback must be a GET request.".to_string());
    }
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    if path != SPOTIFY_CALLBACK_PATH {
        return Err("Spotify callback path did not match Marinara's redirect URL.".to_string());
    }
    let params = parse_query(query);
    if let Some(error) = params.get("error") {
        return Err(format!("Spotify returned an error: {error}"));
    }
    let code = params
        .get("code")
        .cloned()
        .ok_or_else(|| "Spotify callback did not include a code.".to_string())?;
    let auth_state = params
        .get("state")
        .cloned()
        .ok_or_else(|| "Spotify callback did not include a state.".to_string())?;
    exchange(state, json!({ "code": code, "state": auth_state }))
        .await
        .map(|_| ())
        .map_err(|error| error.message)
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
