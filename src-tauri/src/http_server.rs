use crate::http_dispatch::{dispatch, InvokeRequest};
use crate::state::AppState;
use crate::storage_commands::{fonts, llm, lorebook_images, prompts};
use axum::body::Body;
use axum::extract::{ConnectInfo, Path, State};
use axum::http::{header, HeaderMap, HeaderName, HeaderValue, Method, Request, StatusCode};
use axum::middleware::{self, Next};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::{engine::general_purpose, Engine as _};
use marinara_core::AppError;
use serde::Deserialize;
use serde_json::{json, Value};
use std::convert::Infallible;
use std::env;
use std::io::ErrorKind;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use std::path::{Path as FsPath, PathBuf};
use std::time::Instant;
use tokio::io::AsyncReadExt;
use tokio::sync::mpsc;
use tokio_stream::wrappers::{ReceiverStream, UnboundedReceiverStream};
use tower_http::cors::{AllowOrigin, CorsLayer};

const CSRF_HEADER_NAME: &str = "x-marinara-csrf";
const CSRF_HEADER_VALUE: &str = "1";
const DEFAULT_CORS_ORIGINS: [&str; 7] = [
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
];

fn normalize_env_value(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn enabled_env_flag(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

fn is_prompt_connection_log_preset_value(value: Option<&str>) -> bool {
    value
        .map(|item| item.trim().to_ascii_lowercase().replace('_', "-"))
        .as_deref()
        == Some("prompt-connections")
}

fn is_request_logging_disabled_values(log_preset: Option<&str>, disabled: Option<&str>) -> bool {
    if is_prompt_connection_log_preset_value(log_preset) {
        return true;
    }
    disabled.is_some_and(enabled_env_flag)
}

fn is_request_logging_disabled() -> bool {
    let log_preset = normalize_env_value(env::var("LOG_PRESET").ok());
    let disabled = normalize_env_value(env::var("LOG_DISABLE_REQUEST_LOGGING").ok());
    is_request_logging_disabled_values(log_preset.as_deref(), disabled.as_deref())
}

fn request_log(message: impl AsRef<str>) {
    if !is_request_logging_disabled() {
        println!("{}", message.as_ref());
    }
}

#[derive(Clone)]
pub struct HttpState {
    app: AppState,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmStreamRequest {
    stream_id: String,
    request: Value,
}

pub async fn serve(state: AppState, addr: SocketAddr) -> Result<(), std::io::Error> {
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        router(state).into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
}

pub fn router(state: AppState) -> Router {
    let security = SecurityConfig::from_env();
    let cors_security = security.clone();
    let middleware_security = security.clone();
    Router::new()
        .route("/health", get(health))
        .route("/api/invoke", post(invoke))
        .route("/api/sidecar/v1/embeddings", post(sidecar_embeddings))
        .route("/api/assets/:kind/*path", get(managed_asset))
        .route("/api/llm/stream", post(llm_stream))
        .route("/api/llm/stream/:stream_id/cancel", post(llm_stream_cancel))
        .layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::predicate(move |origin, _parts| {
                    origin
                        .to_str()
                        .ok()
                        .is_some_and(|value| cors_security.is_cors_origin_allowed(value))
                }))
                .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                .allow_headers([
                    header::AUTHORIZATION,
                    header::CONTENT_TYPE,
                    header::ACCEPT,
                    HeaderName::from_static(CSRF_HEADER_NAME),
                ])
                .allow_credentials(true),
        )
        .layer(middleware::from_fn_with_state(
            middleware_security,
            security_middleware,
        ))
        .with_state(HttpState { app: state })
}

async fn health() -> Json<Value> {
    Json(json!({ "ok": true, "runtime": "marinara-server" }))
}

async fn managed_asset(
    State(state): State<HttpState>,
    Path((kind, path)): Path<(String, String)>,
) -> Result<Response, HttpError> {
    let path = managed_asset_path(&state.app, &kind, &path)?;
    let mut file = tokio::fs::File::open(&path)
        .await
        .map_err(|error| match error.kind() {
            ErrorKind::NotFound => AppError::not_found("Managed asset was not found"),
            _ => AppError::from(error),
        })?;
    let (tx, rx) = mpsc::channel::<Result<Vec<u8>, std::io::Error>>(2);
    tokio::spawn(async move {
        let mut buffer = vec![0; 64 * 1024];
        loop {
            match file.read(&mut buffer).await {
                Ok(0) => break,
                Ok(count) => {
                    if tx.send(Ok(buffer[..count].to_vec())).await.is_err() {
                        break;
                    }
                }
                Err(error) => {
                    let _ = tx.send(Err(error)).await;
                    break;
                }
            }
        }
    });
    Ok((
        [(header::CONTENT_TYPE, content_type_for_path(&path))],
        Body::from_stream(ReceiverStream::new(rx)),
    )
        .into_response())
}

fn managed_asset_path(state: &AppState, kind: &str, path: &str) -> Result<PathBuf, AppError> {
    match kind {
        "background" => Ok(PathBuf::from(state.backgrounds.absolute_path_string(path)?)),
        "font" => fonts::font_file_path(state, path),
        "game" => Ok(PathBuf::from(state.game_assets.absolute_path_string(path)?)),
        "lorebook" => {
            let response = lorebook_images::lorebook_image_file_path(state, path)?;
            response
                .get("path")
                .and_then(Value::as_str)
                .map(PathBuf::from)
                .ok_or_else(|| AppError::not_found("Lorebook image was not found"))
        }
        _ => Err(AppError::not_found("Managed asset type was not found")),
    }
}

fn content_type_for_path(path: &FsPath) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "avif" => "image/avif",
        "gif" => "image/gif",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "otf" => "font/otf",
        "ttf" => "font/ttf",
        "wav" => "audio/wav",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "webm" => "video/webm",
        _ => "application/octet-stream",
    }
}

async fn invoke(
    State(state): State<HttpState>,
    Json(request): Json<InvokeRequest>,
) -> Result<Json<Value>, HttpError> {
    let command = request.command.clone();
    let started = Instant::now();
    request_log(format!("invoke {command} started"));
    match dispatch(&state.app, request).await {
        Ok(value) => {
            request_log(format!(
                "invoke {command} ok in {}ms",
                started.elapsed().as_millis()
            ));
            Ok(Json(value))
        }
        Err(error) => {
            request_log(format!(
                "invoke {command} error code={} message={} in {}ms",
                error.code,
                error.message,
                started.elapsed().as_millis()
            ));
            Err(error.into())
        }
    }
}

async fn sidecar_embeddings(
    State(state): State<HttpState>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, HttpError> {
    let started = Instant::now();
    request_log("sidecar_embeddings started");
    let result = sidecar_embeddings_inner(&state.app, body).await;
    match result {
        Ok(value) => {
            request_log(format!(
                "sidecar_embeddings ok in {}ms",
                started.elapsed().as_millis()
            ));
            Ok(Json(value))
        }
        Err(error) => {
            request_log(format!(
                "sidecar_embeddings error code={} message={} in {}ms",
                error.code,
                error.message,
                started.elapsed().as_millis()
            ));
            Err(error.into())
        }
    }
}

async fn sidecar_embeddings_inner(state: &AppState, body: Value) -> Result<Value, AppError> {
    let inputs = sidecar_embedding_inputs(&body)?;
    let (connection_id, mut connection) =
        if let Some(connection) = body.get("connection").filter(|value| value.is_object()) {
            ("request".to_string(), connection.clone())
        } else if body.get("provider").is_some() {
            ("request".to_string(), body.clone())
        } else if let Some(connection_id) = body
            .get("connectionId")
            .or_else(|| body.get("connection_id"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            prompts::resolve_embedding_connection_for_id(state, connection_id)?
        } else {
            prompts::resolve_default_embedding_connection(state)?
        };
    let model = prompts::embedding_model(&connection, body.get("model").and_then(Value::as_str))?;
    if let Some(object) = connection.as_object_mut() {
        object.insert("model".to_string(), Value::String(model.clone()));
    }

    let mut prompt_tokens = 0usize;
    let mut data = Vec::with_capacity(inputs.len());
    for (index, input) in inputs.iter().enumerate() {
        prompt_tokens += approximate_embedding_tokens(input);
        let embedding = prompts::embed_text(&connection, &model, input).await?;
        data.push(json!({
            "object": "embedding",
            "index": index,
            "embedding": embedding
        }));
    }

    Ok(json!({
        "object": "list",
        "data": data,
        "model": model,
        "usage": {
            "prompt_tokens": prompt_tokens,
            "total_tokens": prompt_tokens
        },
        "marinara": {
            "runtime": "marinara-server",
            "replacementFor": "/api/sidecar/v1/embeddings",
            "embeddingConnectionId": connection_id
        }
    }))
}

fn sidecar_embedding_inputs(body: &Value) -> Result<Vec<String>, AppError> {
    let input = body
        .get("input")
        .ok_or_else(|| AppError::invalid_input("input is required"))?;
    match input {
        Value::String(value) => Ok(vec![value.clone()]),
        Value::Array(items) => {
            let values = items
                .iter()
                .map(|item| {
                    item.as_str()
                        .map(ToOwned::to_owned)
                        .ok_or_else(|| AppError::invalid_input("input array must contain strings"))
                })
                .collect::<Result<Vec<_>, _>>()?;
            if values.is_empty() {
                Err(AppError::invalid_input("input must not be empty"))
            } else {
                Ok(values)
            }
        }
        _ => Err(AppError::invalid_input(
            "input must be a string or an array of strings",
        )),
    }
}

fn approximate_embedding_tokens(input: &str) -> usize {
    input.split_whitespace().count().max(1)
}

async fn llm_stream(
    State(state): State<HttpState>,
    Json(body): Json<LlmStreamRequest>,
) -> Sse<UnboundedReceiverStream<Result<Event, Infallible>>> {
    let (tx, rx) = mpsc::unbounded_channel::<Result<Event, Infallible>>();
    tokio::spawn(async move {
        let stream_id = body.stream_id.clone();
        let started = Instant::now();
        request_log(format!("llm_stream {stream_id} started"));
        let result = llm::llm_stream_events(&state.app, body.stream_id, body.request, |event| {
            let data = serde_json::to_string(&event)?;
            tx.send(Ok(Event::default().data(data)))
                .map_err(|error| AppError::new("sse_stream_error", error.to_string()))
        })
        .await;

        match result {
            Ok(()) => {
                request_log(format!(
                    "llm_stream {stream_id} ok in {}ms",
                    started.elapsed().as_millis()
                ));
            }
            Err(error) => {
                request_log(format!(
                    "llm_stream {stream_id} error code={} message={} in {}ms",
                    error.code,
                    error.message,
                    started.elapsed().as_millis()
                ));
                let payload = json!({
                    "type": "error",
                    "code": error.code,
                    "message": error.message,
                    "data": error.details,
                });
                let _ = tx.send(Ok(Event::default().data(payload.to_string())));
            }
        }
    });

    Sse::new(UnboundedReceiverStream::new(rx)).keep_alive(KeepAlive::default())
}

async fn llm_stream_cancel(
    State(state): State<HttpState>,
    Path(stream_id): Path<String>,
) -> Result<Json<Value>, HttpError> {
    let started = Instant::now();
    request_log(format!("llm_stream_cancel {stream_id} started"));
    match llm::llm_stream_cancel(&state.app, &stream_id) {
        Ok(value) => {
            request_log(format!(
                "llm_stream_cancel {stream_id} ok in {}ms",
                started.elapsed().as_millis()
            ));
            Ok(Json(value))
        }
        Err(error) => {
            request_log(format!(
                "llm_stream_cancel {stream_id} error code={} message={} in {}ms",
                error.code,
                error.message,
                started.elapsed().as_millis()
            ));
            Err(error.into())
        }
    }
}

struct HttpError(AppError);

impl From<AppError> for HttpError {
    fn from(value: AppError) -> Self {
        Self(value)
    }
}

impl IntoResponse for HttpError {
    fn into_response(self) -> Response {
        let status = match self.0.code.as_str() {
            "not_found" => StatusCode::NOT_FOUND,
            "invalid_input" => StatusCode::BAD_REQUEST,
            "custom_tool_script_unsupported" => StatusCode::UNPROCESSABLE_ENTITY,
            "embedding_network_error" | "embedding_provider_error" | "embedding_response_error" => {
                StatusCode::BAD_GATEWAY
            }
            "unsupported_command" => StatusCode::NOT_IMPLEMENTED,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let payload = json!({
            "code": self.0.code,
            "message": self.0.message,
            "details": self.0.details,
        });
        (status, Json(payload)).into_response()
    }
}

#[derive(Debug, Clone)]
struct SecurityConfig {
    cors_wildcard: bool,
    cors_origins: Vec<String>,
    basic_auth: Option<BasicAuthConfig>,
    basic_auth_realm: String,
    ip_allowlist: Option<Vec<CidrEntry>>,
    trusted_private_networks: Vec<CidrEntry>,
    allow_unauthenticated_private_network: bool,
    allow_unauthenticated_remote: bool,
    bypass_tailscale: bool,
    bypass_docker: bool,
    require_auth_for_docker_proxy: bool,
    csrf_trusted_origins: Vec<String>,
}

#[derive(Debug, Clone)]
struct BasicAuthConfig {
    expected_header: Vec<u8>,
}

#[derive(Debug, Clone)]
struct CidrEntry {
    network: IpAddr,
    prefix: u8,
}

#[derive(Debug)]
struct SecurityRejection {
    status: StatusCode,
    code: &'static str,
    message: String,
    www_authenticate: Option<String>,
}

async fn security_middleware(
    State(security): State<SecurityConfig>,
    request: Request<Body>,
    next: Next,
) -> Response {
    match security.evaluate_request(&request) {
        Ok(()) => {
            let mut response = next.run(request).await;
            apply_security_headers(response.headers_mut());
            response
        }
        Err(rejection) => rejection.into_response(&security),
    }
}

impl SecurityConfig {
    fn from_env() -> Self {
        let cors_origins = parse_origin_list("CORS_ORIGINS").unwrap_or_else(|| {
            DEFAULT_CORS_ORIGINS
                .iter()
                .map(|value| value.to_string())
                .collect()
        });
        let cors_wildcard = cors_origins.iter().any(|origin| origin == "*");
        let csrf_trusted_origins = parse_origin_list("CSRF_TRUSTED_ORIGINS").unwrap_or_default();
        let user = env_value("BASIC_AUTH_USER");
        let pass = env_value("BASIC_AUTH_PASS");
        let basic_auth_realm =
            env_value("BASIC_AUTH_REALM").unwrap_or_else(|| "Marinara Engine".to_string());
        let basic_auth = match (user, pass) {
            (Some(user), Some(pass)) => Some(BasicAuthConfig {
                expected_header: format!(
                    "Basic {}",
                    general_purpose::STANDARD.encode(format!("{user}:{pass}"))
                )
                .into_bytes(),
            }),
            _ => None,
        };

        Self {
            cors_wildcard,
            cors_origins,
            basic_auth,
            basic_auth_realm,
            ip_allowlist: if env_flag_disabled("IP_ALLOWLIST_ENABLED") {
                None
            } else {
                parse_cidr_list("IP_ALLOWLIST")
            },
            trusted_private_networks: parse_cidr_list("TRUSTED_PRIVATE_NETWORKS")
                .unwrap_or_else(default_private_networks),
            allow_unauthenticated_private_network: env_flag_enabled(
                "ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK",
            ),
            allow_unauthenticated_remote: env_flag_enabled("ALLOW_UNAUTHENTICATED_REMOTE"),
            bypass_tailscale: env_flag_enabled("BYPASS_AUTH_TAILSCALE"),
            bypass_docker: env_flag_enabled("BYPASS_AUTH_DOCKER"),
            require_auth_for_docker_proxy: env_flag_enabled("REQUIRE_AUTH_FOR_DOCKER_PROXY"),
            csrf_trusted_origins,
        }
    }

    fn evaluate_request(&self, request: &Request<Body>) -> Result<(), SecurityRejection> {
        let path = request.uri().path();
        let method = request.method();
        if method == Method::OPTIONS || path == "/health" {
            return Ok(());
        }

        let ip = remote_ip(request);
        self.enforce_ip_allowlist(ip)?;
        self.enforce_basic_auth(ip, request.headers())?;
        self.enforce_csrf(method, path, request.headers())?;
        Ok(())
    }

    fn enforce_ip_allowlist(&self, ip: IpAddr) -> Result<(), SecurityRejection> {
        let Some(allowlist) = &self.ip_allowlist else {
            return Ok(());
        };
        if is_loopback(ip) || self.is_trusted_interface_ip(ip) || cidr_list_contains(allowlist, ip)
        {
            Ok(())
        } else {
            Err(SecurityRejection::forbidden(
                "ip_not_allowed",
                "Client IP is not allowed to access this runtime",
            ))
        }
    }

    fn enforce_basic_auth(&self, ip: IpAddr, headers: &HeaderMap) -> Result<(), SecurityRejection> {
        if is_loopback(ip) || self.is_trusted_interface_ip(ip) {
            return Ok(());
        }

        let Some(config) = &self.basic_auth else {
            if self.is_ip_allowlisted(ip) {
                return Ok(());
            }
            if self.allow_unauthenticated_remote {
                return Ok(());
            }
            if self.allow_unauthenticated_private_network
                && cidr_list_contains(&self.trusted_private_networks, ip)
            {
                return Ok(());
            }
            return Err(SecurityRejection::forbidden(
                "remote_auth_required",
                "Non-loopback access requires BASIC_AUTH_USER and BASIC_AUTH_PASS, IP_ALLOWLIST, or an explicit unauthenticated remote opt-in",
            ));
        };

        let Some(header_value) = headers.get(header::AUTHORIZATION) else {
            return Err(SecurityRejection::challenge("Authentication required"));
        };
        let Ok(provided) = header_value.to_str() else {
            return Err(SecurityRejection::challenge("Authentication required"));
        };
        if constant_time_eq(provided.as_bytes(), &config.expected_header) {
            Ok(())
        } else {
            Err(SecurityRejection::challenge("Authentication required"))
        }
    }

    fn enforce_csrf(
        &self,
        method: &Method,
        path: &str,
        headers: &HeaderMap,
    ) -> Result<(), SecurityRejection> {
        if !is_unsafe_method(method) || !path.starts_with("/api/") {
            return Ok(());
        }

        let origin = first_header(headers, header::ORIGIN);
        let referer = first_header(headers, header::REFERER);
        let sec_fetch_site = first_header(headers, HeaderName::from_static("sec-fetch-site"));
        let browser_signal_present =
            origin.is_some() || referer.is_some() || sec_fetch_site.is_some();

        if let Some(site) = sec_fetch_site.as_deref().map(str::to_ascii_lowercase) {
            let safe_fetch_site = matches!(site.as_str(), "same-origin" | "same-site" | "none");
            if !safe_fetch_site
                && !origin
                    .as_deref()
                    .is_some_and(|value| self.is_origin_trusted(value))
            {
                return Err(SecurityRejection::forbidden(
                    "csrf_cross_site",
                    "Cross-site unsafe requests are not allowed",
                ));
            }
        }

        if let Some(origin) = origin.as_deref() {
            if !self.is_origin_trusted(origin) {
                return Err(SecurityRejection::forbidden(
                    "csrf_origin_not_trusted",
                    format!("Origin '{origin}' is not trusted for remote runtime requests"),
                ));
            }
        } else if let Some(referer) = referer.as_deref() {
            if !self.is_origin_trusted(referer) {
                return Err(SecurityRejection::forbidden(
                    "csrf_referer_not_trusted",
                    format!("Referer '{referer}' is not trusted for remote runtime requests"),
                ));
            }
        }

        if browser_signal_present
            && first_header(headers, HeaderName::from_static(CSRF_HEADER_NAME)).as_deref()
                != Some(CSRF_HEADER_VALUE)
        {
            return Err(SecurityRejection::forbidden(
                "csrf_missing_header",
                format!("Missing {CSRF_HEADER_NAME} header"),
            ));
        }

        Ok(())
    }

    fn is_ip_allowlisted(&self, ip: IpAddr) -> bool {
        self.ip_allowlist
            .as_ref()
            .is_some_and(|entries| cidr_list_contains(entries, ip))
    }

    fn is_trusted_interface_ip(&self, ip: IpAddr) -> bool {
        (self.bypass_tailscale
            && parse_cidr("100.64.0.0/10").is_some_and(|entry| cidr_contains(&entry, ip)))
            || (self.bypass_docker
                && !self.require_auth_for_docker_proxy
                && parse_cidr("172.16.0.0/12").is_some_and(|entry| cidr_contains(&entry, ip)))
    }

    fn is_cors_origin_allowed(&self, origin: &str) -> bool {
        self.cors_wildcard || self.cors_origins.iter().any(|allowed| allowed == origin)
    }

    fn is_exact_cors_origin_allowed(&self, origin: &str) -> bool {
        self.cors_origins.iter().any(|allowed| {
            allowed != "*" && normalize_origin(allowed).as_deref() == Some(origin)
        })
    }

    fn is_origin_trusted(&self, origin_or_referer: &str) -> bool {
        let Some(origin) = normalize_origin(origin_or_referer) else {
            return false;
        };
        self.is_exact_cors_origin_allowed(&origin)
            || self.csrf_trusted_origins.iter().any(|trusted| {
                trusted == "*" || normalize_origin(trusted).as_deref() == Some(origin.as_str())
            })
    }
}

impl SecurityRejection {
    fn forbidden(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::FORBIDDEN,
            code,
            message: message.into(),
            www_authenticate: None,
        }
    }

    fn challenge(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            code: "authentication_required",
            message: message.into(),
            www_authenticate: None,
        }
    }

    fn into_response(mut self, security: &SecurityConfig) -> Response {
        if self.status == StatusCode::UNAUTHORIZED {
            self.www_authenticate = Some(format!(
                "Basic realm=\"{}\", charset=\"UTF-8\"",
                security
                    .basic_auth_realm
                    .replace('\\', "\\\\")
                    .replace('"', "\\\"")
            ));
        }
        let mut response = (
            self.status,
            Json(json!({
                "code": self.code,
                "message": self.message,
            })),
        )
            .into_response();
        if let Some(value) = self.www_authenticate {
            if let Ok(header_value) = HeaderValue::from_str(&value) {
                response
                    .headers_mut()
                    .insert(header::WWW_AUTHENTICATE, header_value);
            }
        }
        apply_security_headers(response.headers_mut());
        response
    }
}

fn apply_security_headers(headers: &mut HeaderMap) {
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        HeaderName::from_static("referrer-policy"),
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        HeaderName::from_static("x-frame-options"),
        HeaderValue::from_static("DENY"),
    );
    headers.insert(
        HeaderName::from_static("x-permitted-cross-domain-policies"),
        HeaderValue::from_static("none"),
    );
    headers.insert(
        HeaderName::from_static("origin-agent-cluster"),
        HeaderValue::from_static("?1"),
    );
    headers.insert(
        HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static(
            "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), xr-spatial-tracking=()",
        ),
    );
}

fn remote_ip(request: &Request<Body>) -> IpAddr {
    request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(addr)| addr.ip())
        .unwrap_or(IpAddr::V4(Ipv4Addr::LOCALHOST))
}

fn env_value(key: &str) -> Option<String> {
    std::env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn env_flag_enabled(key: &str) -> bool {
    env_value(key).is_some_and(|value| {
        matches!(
            value.to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        )
    })
}

fn env_flag_disabled(key: &str) -> bool {
    env_value(key).is_some_and(|value| {
        matches!(
            value.to_ascii_lowercase().as_str(),
            "0" | "false" | "no" | "off"
        )
    })
}

fn parse_origin_list(key: &str) -> Option<Vec<String>> {
    let values: Vec<String> = env_value(key)?
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
        .collect();
    if values.is_empty() {
        None
    } else {
        Some(values)
    }
}

fn parse_cidr_list(key: &str) -> Option<Vec<CidrEntry>> {
    let entries: Vec<CidrEntry> = env_value(key)?
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .filter_map(parse_cidr)
        .collect();
    if entries.is_empty() {
        None
    } else {
        Some(entries)
    }
}

fn default_private_networks() -> Vec<CidrEntry> {
    [
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "169.254.0.0/16",
        "100.64.0.0/10",
        "fc00::/7",
        "fe80::/10",
    ]
    .iter()
    .filter_map(|entry| parse_cidr(entry))
    .collect()
}

fn parse_cidr(raw: &str) -> Option<CidrEntry> {
    let (addr, prefix) = raw
        .split_once('/')
        .map_or((raw, None), |(addr, prefix)| (addr, Some(prefix)));
    let network: IpAddr = addr.parse().ok()?;
    let max_prefix = match network {
        IpAddr::V4(_) => 32,
        IpAddr::V6(_) => 128,
    };
    let prefix = match prefix {
        Some(value) => value.parse::<u8>().ok()?,
        None => max_prefix,
    };
    if prefix > max_prefix {
        return None;
    }
    Some(CidrEntry { network, prefix })
}

fn cidr_list_contains(entries: &[CidrEntry], ip: IpAddr) -> bool {
    entries.iter().any(|entry| cidr_contains(entry, ip))
}

fn cidr_contains(entry: &CidrEntry, ip: IpAddr) -> bool {
    match (entry.network, ip) {
        (IpAddr::V4(network), IpAddr::V4(candidate)) => {
            masked_v4(network, entry.prefix) == masked_v4(candidate, entry.prefix)
        }
        (IpAddr::V6(network), IpAddr::V6(candidate)) => {
            masked_v6(network, entry.prefix) == masked_v6(candidate, entry.prefix)
        }
        _ => false,
    }
}

fn masked_v4(ip: Ipv4Addr, prefix: u8) -> u32 {
    let value = u32::from(ip);
    if prefix == 0 {
        0
    } else {
        value & (!0u32 << (32 - prefix))
    }
}

fn masked_v6(ip: Ipv6Addr, prefix: u8) -> u128 {
    let value = u128::from(ip);
    if prefix == 0 {
        0
    } else {
        value & (!0u128 << (128 - prefix))
    }
}

fn is_loopback(ip: IpAddr) -> bool {
    ip.is_loopback()
}

fn is_unsafe_method(method: &Method) -> bool {
    matches!(
        *method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    )
}

fn first_header(headers: &HeaderMap, name: HeaderName) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
}

fn normalize_origin(value: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(value).ok()?;
    let scheme = parsed.scheme();
    let host = parsed.host_str()?;
    let port = parsed
        .port()
        .map(|port| format!(":{port}"))
        .unwrap_or_default();
    Some(format!("{scheme}://{host}{port}"))
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right.iter())
        .fold(0u8, |acc, (left, right)| acc | (left ^ right))
        == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_security() -> SecurityConfig {
        SecurityConfig {
            cors_wildcard: false,
            cors_origins: DEFAULT_CORS_ORIGINS
                .iter()
                .map(|value| value.to_string())
                .collect(),
            basic_auth: None,
            basic_auth_realm: "Marinara Engine".to_string(),
            ip_allowlist: None,
            trusted_private_networks: default_private_networks(),
            allow_unauthenticated_private_network: false,
            allow_unauthenticated_remote: false,
            bypass_tailscale: false,
            bypass_docker: false,
            require_auth_for_docker_proxy: true,
            csrf_trusted_origins: Vec::new(),
        }
    }

    fn request(method: Method, path: &str, ip: IpAddr, headers: &[(&str, &str)]) -> Request<Body> {
        let mut builder = Request::builder().method(method).uri(path);
        for (name, value) in headers {
            builder = builder.header(*name, *value);
        }
        let mut request = builder.body(Body::empty()).expect("request should build");
        request
            .extensions_mut()
            .insert(ConnectInfo(SocketAddr::new(ip, 54321)));
        request
    }

    fn basic_auth(user: &str, pass: &str) -> BasicAuthConfig {
        BasicAuthConfig {
            expected_header: format!(
                "Basic {}",
                general_purpose::STANDARD.encode(format!("{user}:{pass}"))
            )
            .into_bytes(),
        }
    }

    #[test]
    fn request_logging_disable_values_match_legacy_env_knobs() {
        assert!(is_prompt_connection_log_preset_value(Some(
            "prompt-connections"
        )));
        assert!(is_prompt_connection_log_preset_value(Some(
            "prompt_connections"
        )));
        assert!(is_request_logging_disabled_values(
            Some("prompt-connections"),
            None
        ));
        assert!(is_request_logging_disabled_values(
            Some("default"),
            Some("true")
        ));
        assert!(is_request_logging_disabled_values(None, Some("1")));
        assert!(!is_request_logging_disabled_values(
            Some("default"),
            Some("false")
        ));
        assert!(!is_request_logging_disabled_values(None, None));
    }

    #[test]
    fn sidecar_embedding_inputs_accept_openai_style_inputs() {
        assert_eq!(
            sidecar_embedding_inputs(&json!({ "input": "hello world" })).unwrap(),
            vec!["hello world".to_string()]
        );
        assert_eq!(
            sidecar_embedding_inputs(&json!({ "input": ["one", "two"] })).unwrap(),
            vec!["one".to_string(), "two".to_string()]
        );
        assert!(sidecar_embedding_inputs(&json!({ "input": [] })).is_err());
        assert!(sidecar_embedding_inputs(&json!({ "input": [1] })).is_err());
    }

    #[test]
    fn hostable_security_allows_loopback_without_auth() {
        let security = test_security();
        let request = request(
            Method::POST,
            "/api/invoke",
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            &[],
        );

        assert!(security.evaluate_request(&request).is_ok());
    }

    #[test]
    fn hostable_security_fails_closed_for_non_loopback_without_auth() {
        let security = test_security();
        let request = request(
            Method::POST,
            "/api/invoke",
            IpAddr::V4(Ipv4Addr::new(203, 0, 113, 10)),
            &[],
        );

        let rejection = security
            .evaluate_request(&request)
            .expect_err("public remote IP should require auth");
        assert_eq!(rejection.status, StatusCode::FORBIDDEN);
        assert_eq!(rejection.code, "remote_auth_required");
    }

    #[test]
    fn hostable_security_requires_basic_auth_when_configured() {
        let mut security = test_security();
        security.basic_auth = Some(basic_auth("user", "pass"));
        let ip = IpAddr::V4(Ipv4Addr::new(203, 0, 113, 10));

        let missing = request(Method::POST, "/api/invoke", ip, &[]);
        assert_eq!(
            security
                .evaluate_request(&missing)
                .expect_err("missing auth should challenge")
                .status,
            StatusCode::UNAUTHORIZED
        );

        let wrong = request(
            Method::POST,
            "/api/invoke",
            ip,
            &[("authorization", "Basic bm90OnRoZS1wYXNz")],
        );
        assert_eq!(
            security
                .evaluate_request(&wrong)
                .expect_err("wrong auth should challenge")
                .status,
            StatusCode::UNAUTHORIZED
        );

        let correct = request(
            Method::POST,
            "/api/invoke",
            ip,
            &[("authorization", "Basic dXNlcjpwYXNz")],
        );
        assert!(security.evaluate_request(&correct).is_ok());
    }

    #[test]
    fn hostable_security_requires_basic_auth_for_allowlisted_ip_when_auth_is_configured() {
        let mut security = test_security();
        security.basic_auth = Some(basic_auth("user", "pass"));
        security.ip_allowlist = Some(vec![parse_cidr("192.168.1.5").unwrap()]);
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 5));

        let missing = request(Method::POST, "/api/invoke", ip, &[]);
        assert_eq!(
            security
                .evaluate_request(&missing)
                .expect_err(
                    "allowlisted IP should still authenticate when Basic Auth is configured"
                )
                .status,
            StatusCode::UNAUTHORIZED
        );

        let correct = request(
            Method::POST,
            "/api/invoke",
            ip,
            &[("authorization", "Basic dXNlcjpwYXNz")],
        );
        assert!(security.evaluate_request(&correct).is_ok());
    }

    #[test]
    fn hostable_security_enforces_ip_allowlist_with_negative_control() {
        let mut security = test_security();
        security.ip_allowlist = Some(vec![parse_cidr("192.168.1.5").unwrap()]);

        let denied = request(
            Method::POST,
            "/api/invoke",
            IpAddr::V4(Ipv4Addr::new(192, 168, 1, 6)),
            &[],
        );
        let allowed = request(
            Method::POST,
            "/api/invoke",
            IpAddr::V4(Ipv4Addr::new(192, 168, 1, 5)),
            &[],
        );

        assert_eq!(
            security
                .evaluate_request(&denied)
                .expect_err("nearby IP should not match the allowlist")
                .code,
            "ip_not_allowed"
        );
        assert!(security.evaluate_request(&allowed).is_ok());
    }

    #[test]
    fn hostable_security_requires_explicit_trusted_interface_bypass() {
        let mut security = test_security();
        let tailscale = request(
            Method::POST,
            "/api/invoke",
            IpAddr::V4(Ipv4Addr::new(100, 64, 0, 2)),
            &[],
        );
        assert_eq!(
            security
                .evaluate_request(&tailscale)
                .expect_err("trusted-interface bypass should fail closed by default")
                .code,
            "remote_auth_required"
        );

        security.bypass_tailscale = true;
        assert!(security.evaluate_request(&tailscale).is_ok());
    }

    #[test]
    fn hostable_security_requires_csrf_header_for_trusted_browser_origins() {
        let security = test_security();
        let ip = IpAddr::V4(Ipv4Addr::LOCALHOST);

        let missing = request(
            Method::POST,
            "/api/invoke",
            ip,
            &[("origin", "http://localhost:1420")],
        );
        assert_eq!(
            security
                .evaluate_request(&missing)
                .expect_err("browser-origin unsafe request should need CSRF proof")
                .code,
            "csrf_missing_header"
        );

        let present = request(
            Method::POST,
            "/api/invoke",
            ip,
            &[
                ("origin", "http://localhost:1420"),
                (CSRF_HEADER_NAME, CSRF_HEADER_VALUE),
            ],
        );
        assert!(security.evaluate_request(&present).is_ok());
    }

    #[test]
    fn hostable_security_rejects_untrusted_origin_with_negative_control() {
        let security = test_security();
        let request = request(
            Method::POST,
            "/api/invoke",
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            &[
                ("origin", "https://evil.example"),
                (CSRF_HEADER_NAME, CSRF_HEADER_VALUE),
            ],
        );

        let rejection = security
            .evaluate_request(&request)
            .expect_err("untrusted browser origin should not pass with only the header");
        assert_eq!(rejection.status, StatusCode::FORBIDDEN);
        assert_eq!(rejection.code, "csrf_origin_not_trusted");
    }

    #[test]
    fn hostable_security_requires_exact_origin_for_browser_write_trust() {
        let mut security = test_security();
        security.cors_wildcard = true;
        security.cors_origins = vec!["*".to_string()];

        let request = request(
            Method::POST,
            "/api/invoke",
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            &[
                ("origin", "https://untrusted.example"),
                (CSRF_HEADER_NAME, CSRF_HEADER_VALUE),
            ],
        );

        let rejection = security
            .evaluate_request(&request)
            .expect_err("wildcard CORS should not grant browser-origin trust");
        assert_eq!(rejection.status, StatusCode::FORBIDDEN);
        assert_eq!(rejection.code, "csrf_origin_not_trusted");
    }

    #[test]
    fn hostable_security_adds_core_security_headers() {
        let mut headers = HeaderMap::new();
        apply_security_headers(&mut headers);

        assert_eq!(
            headers.get(header::X_CONTENT_TYPE_OPTIONS).unwrap(),
            "nosniff"
        );
        assert_eq!(headers.get("x-frame-options").unwrap(), "DENY");
        assert!(headers.get("permissions-policy").is_some());
    }
}
