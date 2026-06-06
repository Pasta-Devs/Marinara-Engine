use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, SecondsFormat, Utc};
use futures_util::StreamExt;
use marinara_core::{AppError, AppResult};
use marinara_security::{
    is_allowed_provider_url, is_forbidden_provider_resolved_ip, is_loopback_provider_host,
    redact_sensitive_json, redact_sensitive_text,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    env, fs,
    io::Write,
    net::{IpAddr, SocketAddr},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Mutex, OnceLock},
    time::Duration,
};
use uuid::Uuid;

const OPENAI_CHATGPT_CODEX_BASE_URL: &str = "https://chatgpt.com/backend-api/codex";
const OPENAI_CHATGPT_REFRESH_URL: &str = "https://auth.openai.com/oauth/token";
const OPENAI_CHATGPT_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_CHATGPT_TOKEN_REFRESH_INTERVAL_DAYS: i64 = 8;
const OPENAI_CHATGPT_EXPIRY_REFRESH_SKEW_SECONDS: i64 = 60;
const APP_VERSION: &str = "1.6.1";
const CLAUDE_SUBSCRIPTION_1M_SUFFIX: &str = "[1m]";
const CLAUDE_SUBSCRIPTION_1M_BETA: &str = "context-1m-2025-08-07";
const PROVIDER_LOCAL_URLS_ENABLED_FLAG: &str = "PROVIDER_LOCAL_URLS_ENABLED";
const PROVIDER_RESPONSE_MAX_BYTES: usize = 5 * 1024 * 1024;
const PROVIDER_RESPONSE_HEADERS_TIMEOUT_SECS: u64 = 5 * 60;
const GOOGLE_CLOUD_PLATFORM_SCOPE: &str = "https://www.googleapis.com/auth/cloud-platform";
const GOOGLE_OAUTH_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_JWT_BEARER_GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const GOOGLE_VERTEX_TOKEN_REFRESH_SKEW_SECONDS: i64 = 60;

#[derive(Debug, Clone)]
struct GoogleVertexCachedToken {
    access_token: String,
    expires_at: i64,
}

static GOOGLE_VERTEX_TOKEN_CACHE: OnceLock<Mutex<BTreeMap<String, GoogleVertexCachedToken>>> =
    OnceLock::new();

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SseBlockStatus {
    Continue,
    Complete,
}

#[derive(Default)]
struct Utf8StreamDecoder {
    pending: Vec<u8>,
}

impl Utf8StreamDecoder {
    fn push_chunk(&mut self, chunk: &[u8], output: &mut String) {
        let mut bytes = Vec::with_capacity(self.pending.len() + chunk.len());
        bytes.append(&mut self.pending);
        bytes.extend_from_slice(chunk);
        let mut offset = 0;
        while offset < bytes.len() {
            match std::str::from_utf8(&bytes[offset..]) {
                Ok(valid) => {
                    output.push_str(valid);
                    return;
                }
                Err(error) => {
                    let valid_end = offset + error.valid_up_to();
                    if valid_end > offset {
                        let valid = std::str::from_utf8(&bytes[offset..valid_end])
                            .expect("valid UTF-8 prefix reported by decoder");
                        output.push_str(valid);
                    }
                    if let Some(error_len) = error.error_len() {
                        output.push('\u{FFFD}');
                        offset = valid_end + error_len;
                    } else {
                        self.pending.extend_from_slice(&bytes[valid_end..]);
                        return;
                    }
                }
            }
        }
    }

    fn finish(&mut self, output: &mut String) {
        if !self.pending.is_empty() {
            output.push_str(&String::from_utf8_lossy(&self.pending));
            self.pending.clear();
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub images: Vec<String>,
    #[serde(default)]
    pub tool_call_id: Option<String>,
    #[serde(default)]
    pub tool_calls: Option<Value>,
    #[serde(
        rename = "providerMetadata",
        alias = "provider_metadata",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub provider_metadata: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LlmConnection {
    pub provider: String,
    pub model: String,
    #[serde(rename = "apiKey", default)]
    pub api_key: String,
    #[serde(rename = "baseUrl", default)]
    pub base_url: String,
    #[serde(rename = "openrouterProvider", default)]
    pub openrouter_provider: Option<String>,
    #[serde(rename = "enableCaching", default)]
    pub enable_caching: bool,
    #[serde(rename = "cachingAtDepth", default)]
    pub caching_at_depth: Option<u64>,
    #[serde(rename = "maxTokensOverride", default)]
    pub max_tokens_override: Option<u64>,
    #[serde(rename = "claudeFastMode", default)]
    pub claude_fast_mode: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LlmRequest {
    pub connection: LlmConnection,
    pub messages: Vec<LlmMessage>,
    #[serde(default)]
    pub parameters: Value,
    #[serde(default)]
    pub tools: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LlmCompletion {
    pub content: String,
    #[serde(rename = "toolCalls")]
    pub tool_calls: Vec<Value>,
    #[serde(
        rename = "finishReason",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub finish_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<Value>,
    #[serde(
        rename = "providerMetadata",
        alias = "provider_metadata",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub provider_metadata: Option<Value>,
}

pub async fn complete(request: LlmRequest) -> AppResult<String> {
    Ok(complete_rich(request).await?.content)
}

pub async fn complete_rich(request: LlmRequest) -> AppResult<LlmCompletion> {
    match request.connection.provider.as_str() {
        "anthropic" => complete_anthropic_rich(request).await,
        "google" | "google_vertex" => complete_google_rich(request).await,
        "claude_subscription" => complete_claude_subscription_rich(request).await,
        "cohere" if should_use_cohere_compatibility(&request) => {
            complete_openai_compatible_rich(request).await
        }
        "cohere" => complete_cohere_rich(request).await,
        _ => complete_openai_compatible_rich(request).await,
    }
}

pub async fn stream_events(
    request: LlmRequest,
    mut emit: impl FnMut(Value) -> AppResult<()> + Send,
) -> AppResult<()> {
    emit(json!({ "type": "start" }))?;
    if should_use_openai_responses(&request) || request.connection.provider == "openai_chatgpt" {
        stream_openai_responses(request, &mut emit).await?;
    } else if request.connection.provider == "google"
        || request.connection.provider == "google_vertex"
    {
        stream_google(request, &mut emit).await?;
    } else if request.connection.provider == "anthropic" {
        stream_anthropic(request, &mut emit).await?;
    } else if request.connection.provider == "cohere" && should_use_cohere_compatibility(&request) {
        stream_openai_compatible(request, &mut emit).await?;
    } else if request.connection.provider == "cohere" {
        stream_cohere(request, &mut emit).await?;
    } else if request.connection.provider != "claude_subscription" {
        stream_openai_compatible(request, &mut emit).await?;
    } else {
        let result = complete_rich(request).await?;
        if !result.content.is_empty() {
            emit(json!({ "type": "token", "text": result.content, "data": result.content }))?;
        }
        for tool_call in result.tool_calls {
            emit(json!({ "type": "tool_call", "data": tool_call }))?;
        }
        if let Some(provider_metadata) = result.provider_metadata {
            emit(json!({ "type": "provider_metadata", "data": provider_metadata }))?;
        }
    }
    emit(json!({ "type": "done" }))?;
    Ok(())
}

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

fn prompt_connection_diagnostics_enabled_values(
    log_preset: Option<&str>,
    explicit: Option<&str>,
) -> bool {
    is_prompt_connection_log_preset_value(log_preset) || explicit.is_some_and(enabled_env_flag)
}

fn prompt_connection_diagnostics_enabled() -> bool {
    let log_preset = normalize_env_value(env::var("LOG_PRESET").ok());
    let explicit = normalize_env_value(env::var("MARINARA_PROMPT_CONNECTION_DIAGNOSTICS").ok());
    prompt_connection_diagnostics_enabled_values(log_preset.as_deref(), explicit.as_deref())
}

fn redacted_endpoint(endpoint: &str) -> String {
    endpoint
        .split_once('?')
        .map(|(base, _)| format!("{base}?<redacted>"))
        .unwrap_or_else(|| endpoint.to_string())
}

fn compact_json(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "<unserializable>".to_string())
}

fn log_prompt_connection_request(kind: &str, endpoint: &str, request: &LlmRequest, body: &Value) {
    if !prompt_connection_diagnostics_enabled() {
        return;
    }
    let messages = request_messages(request);
    eprintln!(
        "[prompt-connections] {kind} provider={} model={} endpoint={} messages={} tools={} parameters={}",
        request.connection.provider,
        request.connection.model,
        redacted_endpoint(endpoint),
        messages.len(),
        request.tools.len(),
        compact_json(&redact_sensitive_json(request.parameters.clone())),
    );
    for (index, message) in messages.iter().enumerate() {
        eprintln!(
            "[prompt-connections] message[{index}] role={} images={} chars={}\n{}",
            message.role,
            message.images.len(),
            message.content.chars().count(),
            message.content
        );
    }
    if !request.tools.is_empty() {
        eprintln!(
            "[prompt-connections] tools={}",
            compact_json(&redact_sensitive_json(json!(&request.tools)))
        );
    }
    eprintln!(
        "[prompt-connections] body={}",
        compact_json(&redact_sensitive_json(body.clone()))
    );
}

pub fn unavailable_payload(message: impl Into<String>) -> Value {
    json!({ "type": "error", "error": message.into() })
}

fn base_url(provider: &str, configured: &str) -> String {
    if provider == "openai_chatgpt" {
        return OPENAI_CHATGPT_CODEX_BASE_URL.to_string();
    }
    let configured = configured.trim().trim_end_matches('/');
    if !configured.is_empty() {
        return configured.to_string();
    }
    match provider {
        "anthropic" => "https://api.anthropic.com".to_string(),
        "google" => "https://generativelanguage.googleapis.com".to_string(),
        "google_vertex" => {
            "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1"
                .to_string()
        }
        "mistral" => "https://api.mistral.ai/v1".to_string(),
        "cohere" => "https://api.cohere.com/compatibility/v1".to_string(),
        "openrouter" => "https://openrouter.ai/api/v1".to_string(),
        "nanogpt" => "https://nano-gpt.com/api/v1".to_string(),
        "xai" => "https://api.x.ai/v1".to_string(),
        _ => "https://api.openai.com/v1".to_string(),
    }
}

fn cohere_base_url(configured: &str) -> String {
    let base = base_url("cohere", configured);
    if base.ends_with("/v1") && base.contains("api.cohere.") {
        return format!("{}/v2", base.trim_end_matches("/v1"));
    }
    base
}

fn should_use_cohere_compatibility(request: &LlmRequest) -> bool {
    base_url("cohere", &request.connection.base_url).ends_with("/compatibility/v1")
}

fn openai_compatible_chat_endpoint(request: &LlmRequest) -> String {
    let base = base_url(&request.connection.provider, &request.connection.base_url);
    format!("{base}/chat/completions")
}

fn cohere_chat_endpoint(configured: &str) -> String {
    let base = cohere_base_url(configured)
        .trim_end_matches('/')
        .to_string();
    if base.ends_with("/v2/chat") {
        base
    } else if base.ends_with("/v2") {
        format!("{base}/chat")
    } else {
        format!("{base}/v2/chat")
    }
}

fn temperature(parameters: &Value) -> Option<f64> {
    parameters.get("temperature").and_then(Value::as_f64)
}

fn param_f64(parameters: &Value, keys: &[&str]) -> Option<f64> {
    keys.iter()
        .find_map(|key| parameters.get(*key).and_then(Value::as_f64))
}

fn param_i64(parameters: &Value, keys: &[&str]) -> Option<i64> {
    keys.iter()
        .find_map(|key| parameters.get(*key).and_then(Value::as_i64))
}

fn param_string(parameters: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        parameters
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    })
}

fn param_boolish(parameters: &Value, keys: &[&str], fallback: bool) -> Option<bool> {
    keys.iter().find_map(|key| {
        let value = parameters.get(*key)?;
        match value {
            Value::Bool(value) => Some(*value),
            Value::Number(value) => value.as_i64().map(|value| value != 0),
            Value::String(value) => {
                let normalized = value.trim().to_ascii_lowercase();
                match normalized.as_str() {
                    "" => Some(fallback),
                    "false" | "0" | "no" | "off" => Some(false),
                    "true" | "1" | "yes" | "on" => Some(true),
                    _ => Some(fallback),
                }
            }
            _ => Some(fallback),
        }
    })
}

fn param_i64_array(parameters: &Value, keys: &[&str]) -> Option<Vec<i64>> {
    keys.iter().find_map(|key| {
        let values = parameters.get(*key)?.as_array()?;
        values.iter().map(Value::as_i64).collect()
    })
}

fn stop_sequences(parameters: &Value) -> Option<Vec<String>> {
    let value = parameters
        .get("stop")
        .or_else(|| parameters.get("stopSequences"))
        .or_else(|| parameters.get("stop_sequences"))?;
    if let Some(stop) = value
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(vec![stop.to_string()]);
    }
    let stops = value
        .as_array()?
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    (!stops.is_empty()).then_some(stops)
}

fn data_url_image(value: &str) -> Option<(&str, &str)> {
    let (meta, data) = value.split_once(',')?;
    let mime = meta.strip_prefix("data:")?.split(';').next()?;
    if !meta.to_ascii_lowercase().contains(";base64")
        || !mime.starts_with("image/")
        || data.is_empty()
    {
        return None;
    }
    Some((mime, data))
}

fn max_tokens(parameters: &Value, fallback: u64) -> u64 {
    parameters
        .get("maxTokens")
        .or_else(|| parameters.get("max_tokens"))
        .and_then(Value::as_u64)
        .unwrap_or(fallback)
}

fn request_max_tokens(request: &LlmRequest, fallback: u64) -> u64 {
    let value = max_tokens(&request.parameters, fallback);
    request
        .connection
        .max_tokens_override
        .filter(|cap| *cap > 0)
        .map(|cap| value.min(cap))
        .unwrap_or(value)
}

fn provider_local_urls_enabled() -> bool {
    std::env::var(PROVIDER_LOCAL_URLS_ENABLED_FLAG).is_ok_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        )
    })
}

async fn provider_http_client_for_url(url: &str) -> AppResult<reqwest::Client> {
    let parsed = reqwest::Url::parse(url).map_err(|error| {
        AppError::invalid_input(format!(
            "Outbound URL is invalid: {}",
            redact_sensitive_text(&error.to_string())
        ))
    })?;
    let allow_private_or_reserved = provider_local_urls_enabled();
    if !is_allowed_provider_url(parsed.as_str(), allow_private_or_reserved) {
        return Err(provider_url_not_allowed_error(url));
    }
    let resolved = validate_provider_url_resolution(&parsed, allow_private_or_reserved).await?;
    provider_http_client(parsed.host_str(), resolved.as_deref())
}

async fn validate_provider_url_resolution(
    url: &reqwest::Url,
    allow_private_or_reserved: bool,
) -> AppResult<Option<Vec<SocketAddr>>> {
    if allow_private_or_reserved {
        return Ok(None);
    }
    let Some(host) = url.host_str() else {
        return Err(provider_url_not_allowed_error(url.as_str()));
    };
    if is_loopback_provider_host(host) {
        return Ok(None);
    }
    if let Some(address) = provider_host_ip(host) {
        if is_forbidden_provider_resolved_ip(address, allow_private_or_reserved) {
            return Err(provider_url_not_allowed_error(url.as_str()));
        }
        return Ok(None);
    }
    let port = url.port_or_known_default().unwrap_or(443);
    let addresses = tokio::net::lookup_host((host, port))
        .await
        .map_err(|error| {
            AppError::invalid_input(format!(
                "Outbound URL host '{}' did not resolve: {}",
                redact_sensitive_text(host),
                redact_sensitive_text(&error.to_string())
            ))
        })?
        .collect::<Vec<_>>();
    validate_provider_resolved_addresses(url, allow_private_or_reserved, addresses)
}

fn validate_provider_resolved_addresses(
    url: &reqwest::Url,
    allow_private_or_reserved: bool,
    addresses: Vec<SocketAddr>,
) -> AppResult<Option<Vec<SocketAddr>>> {
    if addresses.is_empty() {
        Err(AppError::invalid_input(format!(
            "Outbound URL host '{}' did not resolve",
            redact_sensitive_text(url.host_str().unwrap_or("<missing>"))
        )))
    } else if addresses
        .iter()
        .any(|address| is_forbidden_provider_resolved_ip(address.ip(), allow_private_or_reserved))
    {
        Err(provider_url_not_allowed_error(url.as_str()))
    } else {
        Ok(Some(addresses))
    }
}

fn provider_host_ip(host: &str) -> Option<IpAddr> {
    let unbracketed = host
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .unwrap_or(host);
    unbracketed.parse::<IpAddr>().ok()
}

fn provider_url_not_allowed_error(url: &str) -> AppError {
    AppError::invalid_input(format!(
        "Outbound URL points to a private, LAN, metadata, or reserved target: {}. Set {PROVIDER_LOCAL_URLS_ENABLED_FLAG}=true only if you trust that provider target.",
        redact_sensitive_text(url)
    ))
}

fn provider_http_client(
    host: Option<&str>,
    resolved_addresses: Option<&[SocketAddr]>,
) -> AppResult<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .connect_timeout(provider_response_headers_timeout())
        .redirect(reqwest::redirect::Policy::none());
    if let (Some(host), Some(addresses)) = (host, resolved_addresses) {
        builder = builder.resolve_to_addrs(host, addresses);
    }
    builder
        .build()
        .map_err(|error| AppError::new("llm_client_error", error.to_string()))
}

fn provider_response_headers_timeout() -> Duration {
    Duration::from_secs(PROVIDER_RESPONSE_HEADERS_TIMEOUT_SECS)
}

async fn send_provider_request(request: reqwest::RequestBuilder) -> AppResult<reqwest::Response> {
    send_provider_request_with_error_code(request, "llm_network_error").await
}

async fn send_provider_request_with_error_code(
    request: reqwest::RequestBuilder,
    error_code: &str,
) -> AppResult<reqwest::Response> {
    send_provider_request_with_timeout(request, error_code, provider_response_headers_timeout())
        .await
}

async fn send_provider_request_with_timeout(
    request: reqwest::RequestBuilder,
    error_code: &str,
    timeout: Duration,
) -> AppResult<reqwest::Response> {
    match tokio::time::timeout(timeout, request.send()).await {
        Ok(Ok(response)) => Ok(response),
        Ok(Err(error)) => Err(AppError::new(
            error_code,
            provider_transport_error_message(error),
        )),
        Err(_) => Err(AppError::new(
            error_code,
            format!(
                "LLM provider request timed out while waiting for response headers after {} ms",
                timeout.as_millis()
            ),
        )),
    }
}

fn provider_transport_error_message(error: impl std::fmt::Display) -> String {
    redact_sensitive_text(&error.to_string())
}

fn should_use_openai_responses(request: &LlmRequest) -> bool {
    if request.connection.provider == "openai_chatgpt" {
        return true;
    }
    if request.connection.provider != "openai" {
        return false;
    }
    let model = request.connection.model.to_ascii_lowercase();
    model.starts_with("gpt-5")
        || model.starts_with("o1")
        || model.starts_with("o3")
        || model.starts_with("o4")
        || model.contains("computer-use")
        || model.contains("codex")
}

fn openai_model_id(model: &str) -> String {
    model
        .to_ascii_lowercase()
        .rsplit('/')
        .next()
        .unwrap_or("")
        .to_string()
}

fn gpt5_minor_version(model: &str) -> Option<u32> {
    let model = openai_model_id(model);
    let tail = model.strip_prefix("gpt-5.")?;
    let digits = tail
        .chars()
        .take_while(|ch| ch.is_ascii_digit())
        .collect::<String>();
    if digits.is_empty() {
        return None;
    }
    digits.parse::<u32>().ok()
}

fn is_openai_legacy_gpt5_pro_model(model: &str) -> bool {
    let model = openai_model_id(model);
    model == "gpt-5-pro" || model.starts_with("gpt-5-pro-")
}

fn is_openai_versioned_gpt5_pro_model(model: &str) -> bool {
    let model = openai_model_id(model);
    let Some(tail) = model.strip_prefix("gpt-5.") else {
        return false;
    };
    let digit_count = tail.chars().take_while(|ch| ch.is_ascii_digit()).count();
    if digit_count == 0 {
        return false;
    }
    let rest = &tail[digit_count..];
    rest == "-pro" || rest.starts_with("-pro-")
}

fn supports_openai_none_reasoning_model(model: &str) -> bool {
    let model_id = openai_model_id(model);
    if model_id.contains("codex")
        || is_openai_legacy_gpt5_pro_model(&model_id)
        || is_openai_versioned_gpt5_pro_model(&model_id)
    {
        return false;
    }
    gpt5_minor_version(model)
        .map(|minor| minor >= 1)
        .unwrap_or(false)
}

fn supports_openai_minimal_reasoning_model(model: &str) -> bool {
    let model = openai_model_id(model);
    !model.contains("codex")
        && !is_openai_legacy_gpt5_pro_model(&model)
        && !is_openai_versioned_gpt5_pro_model(&model)
        && (model == "gpt-5" || model.starts_with("gpt-5-"))
}

fn supports_openai_xhigh_reasoning_model(model: &str) -> bool {
    let model = openai_model_id(model);
    if model == "gpt-5-pro" || model.starts_with("gpt-5-pro-") {
        return false;
    }
    if model == "gpt-5.1-codex-max" || model.starts_with("gpt-5.1-codex-max-") {
        return true;
    }
    gpt5_minor_version(&model)
        .map(|minor| minor >= 2)
        .unwrap_or(false)
}

fn openai_reasoning_effort(request: &LlmRequest) -> Option<String> {
    let effort = param_string(
        &request.parameters,
        &["reasoningEffort", "reasoning_effort"],
    )?
    .to_ascii_lowercase();
    if is_openai_legacy_gpt5_pro_model(&request.connection.model) {
        return Some("high".to_string());
    }
    if is_openai_versioned_gpt5_pro_model(&request.connection.model) {
        return Some(
            match effort.as_str() {
                "maximum" | "xhigh" => "xhigh",
                "high" => "high",
                _ => "medium",
            }
            .to_string(),
        );
    }
    match effort.as_str() {
        "none" if supports_openai_none_reasoning_model(&request.connection.model) => {
            Some("none".to_string())
        }
        "minimal" if supports_openai_minimal_reasoning_model(&request.connection.model) => {
            Some("minimal".to_string())
        }
        "low" | "medium" | "high" => Some(effort),
        "maximum" | "xhigh" if supports_openai_xhigh_reasoning_model(&request.connection.model) => {
            Some("xhigh".to_string())
        }
        "maximum" | "xhigh" => Some("high".to_string()),
        _ => None,
    }
}

fn supports_mistral_adjustable_reasoning(model: &str) -> bool {
    let model = model.to_ascii_lowercase();
    matches!(
        model.as_str(),
        "mistral-small-latest" | "mistral-small-2603" | "mistral-medium-3-5"
    )
}

fn mistral_reasoning_effort(request: &LlmRequest) -> Option<&'static str> {
    if !supports_mistral_adjustable_reasoning(&request.connection.model) {
        return None;
    }
    if let Some(effort) = param_string(
        &request.parameters,
        &["reasoningEffort", "reasoning_effort"],
    )
    .map(|value| value.to_ascii_lowercase())
    {
        return match effort.as_str() {
            "none" | "minimal" | "low" => Some("none"),
            "high" | "maximum" | "xhigh" => Some("high"),
            _ => None,
        };
    }
    param_boolish(
        &request.parameters,
        &["showThoughts", "show_thoughts"],
        false,
    )
    .map(|show| if show { "high" } else { "none" })
}

fn supports_cohere_thinking(model: &str) -> bool {
    let model = model.to_ascii_lowercase();
    model.contains("command-a-reasoning") || model.contains("command-a-plus")
}

fn cohere_thinking_config(request: &LlmRequest) -> Option<Value> {
    if let Some(thinking) = request
        .parameters
        .get("thinking")
        .filter(|value| value.as_object().is_some_and(|object| !object.is_empty()))
    {
        return Some(thinking.clone());
    }
    if !supports_cohere_thinking(&request.connection.model) {
        return None;
    }

    let effort = param_string(
        &request.parameters,
        &["reasoningEffort", "reasoning_effort"],
    )
    .map(|value| value.to_ascii_lowercase());
    if matches!(effort.as_deref(), Some("none" | "minimal" | "low")) {
        return Some(json!({ "type": "disabled" }));
    }

    let budget = param_i64(&request.parameters, &["thinkingBudget", "thinking_budget"])
        .filter(|value| *value > 0);
    let show_thoughts = param_boolish(
        &request.parameters,
        &["showThoughts", "show_thoughts"],
        true,
    );
    if let Some(budget) = budget {
        let mut thinking = json!({ "token_budget": budget });
        if show_thoughts.unwrap_or(true)
            || matches!(
                effort.as_deref(),
                Some("medium" | "high" | "maximum" | "xhigh")
            )
        {
            thinking["type"] = json!("enabled");
        }
        return Some(thinking);
    }
    if let Some(show) = show_thoughts {
        return Some(json!({ "type": if show { "enabled" } else { "disabled" } }));
    }
    if matches!(
        effort.as_deref(),
        Some("medium" | "high" | "maximum" | "xhigh")
    ) {
        return Some(json!({ "type": "enabled" }));
    }
    None
}

fn model_contains(request: &LlmRequest, needle: &str) -> bool {
    request
        .connection
        .model
        .to_ascii_lowercase()
        .contains(needle)
}

fn claude_version_parts(model: &str, family: &str) -> Option<(u32, u32)> {
    let normalized = model.to_ascii_lowercase();
    let marker = format!("claude-{family}-");
    let start = normalized.find(&marker)? + marker.len();
    let tail = &normalized[start..];
    let parts = tail
        .split(|ch: char| !ch.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.parse::<u32>().ok())
        .take(2)
        .collect::<Vec<_>>();
    let major = *parts.first()?;
    let minor = parts
        .get(1)
        .copied()
        .filter(|value| *value <= 99)
        .unwrap_or(0);
    Some((major, minor))
}

fn claude_version_at_least(model: &str, family: &str, major: u32, minor: u32) -> bool {
    let Some((model_major, model_minor)) = claude_version_parts(model, family) else {
        return false;
    };
    model_major > major || (model_major == major && model_minor >= minor)
}

fn is_claude_opus_adaptive_only_model(model: &str) -> bool {
    claude_version_at_least(model, "opus", 4, 7)
}

fn is_anthropic_sampling_restricted_model(model: &str) -> bool {
    claude_version_at_least(model, "opus", 4, 7)
        || claude_version_at_least(model, "sonnet", 4, 6)
        || claude_version_at_least(model, "haiku", 4, 5)
}

fn supports_anthropic_adaptive_thinking(model: &str) -> bool {
    claude_version_at_least(model, "opus", 4, 6) || claude_version_at_least(model, "sonnet", 4, 6)
}

fn should_send_openai_sampling_parameters(request: &LlmRequest) -> bool {
    !is_anthropic_sampling_restricted_model(&request.connection.model)
}

fn should_send_temperature(request: &LlmRequest) -> bool {
    should_send_openai_sampling_parameters(request)
}

fn is_sampling_parameter_key(key: &str) -> bool {
    matches!(
        key,
        "temperature"
            | "top_p"
            | "topP"
            | "top_k"
            | "topK"
            | "frequency_penalty"
            | "frequencyPenalty"
            | "presence_penalty"
            | "presencePenalty"
    )
}

fn is_stop_parameter_key(key: &str) -> bool {
    matches!(key, "stop" | "stopSequences" | "stop_sequences")
}

fn is_reserved_custom_parameter_key(key: &str) -> bool {
    matches!(
        key,
        "model" | "messages" | "input" | "contents" | "systemInstruction" | "stream" | "tools"
    )
}

const OPENAI_RESPONSES_UNSUPPORTED_CUSTOM_PARAMETER_KEYS: &[&str] = &[
    "top_k",
    "topK",
    "frequency_penalty",
    "frequencyPenalty",
    "presence_penalty",
    "presencePenalty",
    "stop",
    "stopSequences",
    "stop_sequences",
];

fn is_mistral_unsupported_custom_parameter_key(key: &str) -> bool {
    matches!(
        key,
        "seed"
            | "top_k"
            | "topK"
            | "safePrompt"
            | "randomSeed"
            | "promptCacheKey"
            | "promptMode"
            | "parallelToolCalls"
            | "reasoningEffort"
            | "responseFormat"
            | "service_tier"
            | "serviceTier"
    )
}

fn is_cohere_unsupported_body_parameter_key(key: &str) -> bool {
    matches!(
        key,
        "maxTokens"
            | "maxOutputTokens"
            | "max_output_tokens"
            | "topP"
            | "top_p"
            | "topK"
            | "top_k"
            | "stop"
            | "stopSequences"
            | "frequencyPenalty"
            | "presencePenalty"
            | "responseFormat"
            | "safetyMode"
            | "toolChoice"
            | "strictTools"
            | "reasoningEffort"
            | "reasoning_effort"
            | "showThoughts"
            | "show_thoughts"
            | "thinkingBudget"
            | "thinking_budget"
            | "random_seed"
            | "randomSeed"
            | "safe_prompt"
            | "safePrompt"
            | "prompt_cache_key"
            | "promptCacheKey"
            | "prompt_mode"
            | "promptMode"
            | "parallel_tool_calls"
            | "parallelToolCalls"
            | "service_tier"
            | "serviceTier"
            | "prediction"
    )
}

fn scrub_cohere_parameter_body(body: &mut Value, has_tools: bool) {
    let Some(body) = body.as_object_mut() else {
        return;
    };
    body.retain(|key, _| !is_cohere_unsupported_body_parameter_key(key));
    if has_tools {
        body.remove("response_format");
        body.remove("safety_mode");
    } else {
        body.remove("tool_choice");
        body.remove("strict_tools");
    }
}

fn xai_model_id(model: &str) -> String {
    model.trim().trim_start_matches("xai/").to_ascii_lowercase()
}

fn is_xai_grok_43_model(model: &str) -> bool {
    let id = xai_model_id(model);
    id == "latest" || id == "grok-4.3" || id.starts_with("grok-4.3-")
}

fn is_xai_multi_agent_model(model: &str) -> bool {
    xai_model_id(model).starts_with("grok-4.20-multi-agent")
}

fn is_xai_automatic_reasoning_model(model: &str) -> bool {
    let id = xai_model_id(model);
    if is_xai_grok_43_model(model) || is_xai_multi_agent_model(model) {
        return true;
    }
    if id.starts_with("grok-build") {
        return false;
    }
    id.starts_with("grok-4") && !id.contains("image")
}

fn xai_reasoning_effort(request: &LlmRequest) -> Option<&'static str> {
    if !is_xai_grok_43_model(&request.connection.model) {
        return None;
    }
    let effort = param_string(
        &request.parameters,
        &["reasoningEffort", "reasoning_effort"],
    )?
    .to_ascii_lowercase();
    match effort.as_str() {
        "none" => Some("none"),
        "minimal" => Some("low"),
        "low" => Some("low"),
        "medium" => Some("medium"),
        "high" | "maximum" | "xhigh" => Some("high"),
        _ => None,
    }
}

fn xai_reasoning_config(request: &LlmRequest) -> Option<Value> {
    if !is_xai_multi_agent_model(&request.connection.model) {
        return None;
    }
    if let Some(reasoning) = request
        .parameters
        .get("reasoning")
        .filter(|value| value.as_object().is_some())
    {
        return Some(reasoning.clone());
    }
    let effort = param_string(
        &request.parameters,
        &["reasoningEffort", "reasoning_effort"],
    )?
    .to_ascii_lowercase();
    match effort.as_str() {
        "low" | "minimal" => Some(json!({ "effort": "low" })),
        "medium" => Some(json!({ "effort": "medium" })),
        "high" => Some(json!({ "effort": "high" })),
        "xhigh" | "maximum" => Some(json!({ "effort": "xhigh" })),
        _ => None,
    }
}

fn xai_reasoning_active(request: &LlmRequest) -> bool {
    match xai_reasoning_effort(request) {
        Some("none") => false,
        Some(_) => true,
        None => is_xai_automatic_reasoning_model(&request.connection.model),
    }
}

fn is_xai_grok_420_or_newer_model(model: &str) -> bool {
    let id = xai_model_id(model);
    id.starts_with("grok-4.20") || id.starts_with("grok-4.3")
}

fn is_xai_unsupported_custom_parameter_key(key: &str, model: &str, reasoning_active: bool) -> bool {
    if matches!(
        key,
        "top_k"
            | "topK"
            | "reasoningEffort"
            | "reasoning_effort"
            | "serviceTier"
            | "service_tier"
            | "parallelToolCalls"
            | "parallel_tool_calls"
    ) {
        return true;
    }
    if reasoning_active
        && matches!(
            key,
            "frequencyPenalty"
                | "frequency_penalty"
                | "presencePenalty"
                | "presence_penalty"
                | "stop"
                | "stopSequences"
                | "stop_sequences"
        )
    {
        return true;
    }
    is_xai_grok_420_or_newer_model(model)
        && matches!(key, "logprobs" | "topLogprobs" | "top_logprobs")
}

fn apply_xai_custom_parameters_to_object(
    body: &mut Value,
    parameters: &Value,
    strip_sampling: bool,
    strip_stop: bool,
    model: &str,
    reasoning_active: bool,
) {
    let Some(entries) = parameters
        .get("customParameters")
        .or_else(|| parameters.get("custom_params"))
        .and_then(Value::as_object)
    else {
        return;
    };
    let Some(body) = body.as_object_mut() else {
        return;
    };
    for (key, value) in entries {
        if !should_apply_custom_parameter(key, strip_sampling, strip_stop, &[])
            || is_xai_unsupported_custom_parameter_key(key, model, reasoning_active)
        {
            continue;
        }
        if !body.contains_key(key) {
            body.insert(key.clone(), value.clone());
        }
    }
}

fn is_openai_service_tier(value: &str) -> bool {
    matches!(value, "auto" | "default" | "flex" | "scale" | "priority")
}

fn is_openrouter_service_tier(value: &str) -> bool {
    matches!(value, "flex" | "priority")
}

fn is_xai_service_tier(value: &str) -> bool {
    matches!(value, "default" | "priority")
}

fn is_anthropic_service_tier(value: &str) -> bool {
    matches!(value, "auto" | "standard_only")
}

fn is_cohere_safety_mode(value: &str) -> bool {
    matches!(value, "CONTEXTUAL" | "STRICT" | "OFF")
}

fn cohere_tool_choice(value: &str) -> Option<&'static str> {
    match value.trim().to_ascii_lowercase().as_str() {
        "required" | "any" => Some("REQUIRED"),
        "none" => Some("NONE"),
        _ => None,
    }
}

fn should_apply_custom_parameter(
    key: &str,
    strip_sampling: bool,
    strip_stop: bool,
    skip_keys: &[&str],
) -> bool {
    !(skip_keys.contains(&key)
        || is_reserved_custom_parameter_key(key)
        || strip_sampling && is_sampling_parameter_key(key)
        || strip_stop && is_stop_parameter_key(key))
}

fn apply_custom_parameters_to_object(
    body: &mut Value,
    parameters: &Value,
    strip_sampling: bool,
    strip_stop: bool,
    skip_keys: &[&str],
) {
    let Some(entries) = parameters
        .get("customParameters")
        .or_else(|| parameters.get("custom_params"))
        .and_then(Value::as_object)
    else {
        return;
    };
    let Some(body) = body.as_object_mut() else {
        return;
    };
    for (key, value) in entries {
        if !should_apply_custom_parameter(key, strip_sampling, strip_stop, skip_keys) {
            continue;
        }
        if !body.contains_key(key) {
            body.insert(key.clone(), value.clone());
        }
    }
}

fn is_gemini_3_model(model: &str) -> bool {
    let normalized = model.to_ascii_lowercase();
    normalized.starts_with("gemini-3")
        || normalized.starts_with("google/gemini-3")
        || normalized.contains("/gemini-3")
}

fn is_gemini_3_pro_model(model: &str) -> bool {
    is_gemini_3_model(model) && model.to_ascii_lowercase().contains("-pro")
}

fn is_gemini_25_model(model: &str) -> bool {
    let normalized = model.to_ascii_lowercase();
    normalized.starts_with("gemini-2.5")
        || normalized.starts_with("google/gemini-2.5")
        || normalized.contains("/gemini-2.5")
}

fn is_gemini_25_pro_model(model: &str) -> bool {
    is_gemini_25_model(model) && model.to_ascii_lowercase().contains("-pro")
}

fn google_thinking_level(model: &str, parameters: &Value) -> Option<&'static str> {
    let effort =
        param_string(parameters, &["reasoningEffort", "reasoning_effort"])?.to_ascii_lowercase();
    match effort.as_str() {
        "none" | "minimal" if is_gemini_3_pro_model(model) => Some("low"),
        "none" | "minimal" => Some("minimal"),
        "low" => Some("low"),
        "medium" => Some("medium"),
        "high" | "maximum" | "xhigh" => Some("high"),
        _ => None,
    }
}

fn google_thinking_budget(model: &str, parameters: &Value) -> Option<i64> {
    let effort =
        param_string(parameters, &["reasoningEffort", "reasoning_effort"])?.to_ascii_lowercase();
    let pro = is_gemini_25_pro_model(model);
    match effort.as_str() {
        "none" | "minimal" if pro => Some(128),
        "none" | "minimal" => Some(0),
        "low" => Some(1024),
        "medium" => Some(8192),
        "high" | "maximum" | "xhigh" if pro => Some(32768),
        "high" | "maximum" | "xhigh" => Some(24576),
        _ => None,
    }
}

fn google_thinking_config(model: &str, parameters: &Value) -> Option<Value> {
    if is_gemini_3_model(model) {
        return google_thinking_level(model, parameters)
            .map(|level| json!({ "thinkingLevel": level, "includeThoughts": true }));
    }

    if is_gemini_25_model(model) {
        let budget = google_thinking_budget(model, parameters)?;
        return Some(json!({ "thinkingBudget": budget, "includeThoughts": true }));
    }

    None
}

fn is_google_gemini_3_unsupported_generation_config_key(key: &str) -> bool {
    matches!(
        key,
        "temperature" | "topP" | "top_p" | "topK" | "top_k" | "candidateCount" | "candidate_count"
    )
}

fn is_google_generation_config_custom_parameter_key(key: &str) -> bool {
    matches!(
        key,
        "stopSequences"
            | "stop_sequences"
            | "responseMimeType"
            | "response_mime_type"
            | "responseModalities"
            | "response_modalities"
            | "thinkingConfig"
            | "thinking_config"
            | "modelConfig"
            | "model_config"
            | "temperature"
            | "topP"
            | "top_p"
            | "topK"
            | "top_k"
            | "candidateCount"
            | "candidate_count"
            | "maxOutputTokens"
            | "max_output_tokens"
            | "responseLogprobs"
            | "response_logprobs"
            | "logprobs"
            | "presencePenalty"
            | "presence_penalty"
            | "frequencyPenalty"
            | "frequency_penalty"
            | "seed"
            | "responseSchema"
            | "response_schema"
            | "responseJsonSchema"
            | "response_json_schema"
            | "routingConfig"
            | "routing_config"
            | "audioTimestamp"
            | "audio_timestamp"
            | "mediaResolution"
            | "media_resolution"
            | "speechConfig"
            | "speech_config"
            | "enableAffectiveDialog"
            | "enable_affective_dialog"
            | "enableEnhancedCivicAnswers"
            | "enable_enhanced_civic_answers"
            | "imageConfig"
            | "image_config"
            | "responseFormat"
            | "response_format"
    )
}

fn anthropic_thinking_effort(model: &str, parameters: &Value) -> Option<&'static str> {
    let effort = param_string(parameters, &["reasoningEffort", "reasoning_effort"])?;
    match effort.as_str() {
        "low" => Some("low"),
        "medium" => Some("medium"),
        "high" => Some("high"),
        "xhigh" if is_claude_opus_adaptive_only_model(model) => Some("xhigh"),
        "xhigh" => Some("high"),
        "maximum" | "max" => Some("max"),
        _ => None,
    }
}

fn anthropic_thinking_budget_tokens(effort: &str) -> u64 {
    match effort {
        "low" => 1024,
        "medium" => 8192,
        _ => 24576,
    }
}

fn should_use_anthropic_adaptive_thinking(
    model: &str,
    parameters: &Value,
    effort: Option<&str>,
) -> bool {
    if !supports_anthropic_adaptive_thinking(model) {
        return false;
    }
    if is_claude_opus_adaptive_only_model(model) {
        return true;
    }
    if effort.is_some() {
        return true;
    }
    param_boolish(parameters, &["showThoughts", "show_thoughts"], false).unwrap_or(false)
}

fn should_send_top_k(request: &LlmRequest) -> bool {
    if request.connection.provider == "openrouter" {
        return !is_openrouter_openai_model(&request.connection.model);
    }
    !matches!(
        request.connection.provider.as_str(),
        "openai" | "xai" | "mistral" | "cohere"
    )
}

fn is_openrouter_openai_model(model: &str) -> bool {
    let normalized = model.trim().trim_start_matches('~').to_ascii_lowercase();
    if normalized.starts_with("openai/") {
        return true;
    }
    if normalized.contains('/') {
        return false;
    }
    normalized.starts_with("gpt-")
        || normalized.starts_with("o1")
        || normalized.starts_with("o3")
        || normalized.starts_with("o4")
        || normalized.starts_with("codex")
}

fn openrouter_reasoning_effort(parameters: &Value) -> Option<&'static str> {
    let effort =
        param_string(parameters, &["reasoningEffort", "reasoning_effort"])?.to_ascii_lowercase();
    match effort.as_str() {
        "none" => Some("none"),
        "minimal" => Some("minimal"),
        "low" => Some("low"),
        "medium" => Some("medium"),
        "high" => Some("high"),
        "xhigh" | "maximum" => Some("xhigh"),
        _ => None,
    }
}

fn openrouter_reasoning_config(parameters: &Value) -> Option<Value> {
    if let Some(reasoning) = parameters
        .get("reasoning")
        .filter(|value| value.as_object().is_some())
    {
        return Some(reasoning.clone());
    }
    if parameters
        .get("customParameters")
        .or_else(|| parameters.get("custom_params"))
        .and_then(|value| value.get("reasoning"))
        .and_then(Value::as_object)
        .is_some()
    {
        return None;
    }
    if let Some(budget) = param_i64(
        parameters,
        &[
            "thinkingBudget",
            "thinking_budget",
            "reasoningMaxTokens",
            "reasoning_max_tokens",
        ],
    )
    .filter(|value| *value > 0)
    {
        return Some(json!({ "max_tokens": budget }));
    }
    openrouter_reasoning_effort(parameters).map(|effort| json!({ "effort": effort }))
}

fn is_openrouter_verbosity(value: &str) -> bool {
    matches!(value, "low" | "medium" | "high" | "xhigh" | "max")
}

fn nanogpt_reasoning_effort(parameters: &Value) -> Option<&'static str> {
    let effort =
        param_string(parameters, &["reasoningEffort", "reasoning_effort"])?.to_ascii_lowercase();
    match effort.as_str() {
        "none" => Some("none"),
        "minimal" => Some("minimal"),
        "low" => Some("low"),
        "medium" => Some("medium"),
        "high" => Some("high"),
        "xhigh" | "maximum" => Some("xhigh"),
        _ => None,
    }
}

fn nanogpt_prompt_caching_config(parameters: &Value) -> Option<Value> {
    let prompt_caching = parameters
        .get("promptCaching")
        .or_else(|| parameters.get("prompt_caching"))?;
    if prompt_caching.as_object().is_some() {
        return Some(prompt_caching.clone());
    }
    param_boolish(parameters, &["promptCaching", "prompt_caching"], false)
        .map(|enabled| json!({ "enabled": enabled }))
}

fn nanogpt_reasoning_config(parameters: &Value) -> Option<Value> {
    if let Some(reasoning) = parameters
        .get("reasoning")
        .filter(|value| value.as_object().is_some())
    {
        return Some(reasoning.clone());
    }
    if parameters
        .get("customParameters")
        .or_else(|| parameters.get("custom_params"))
        .and_then(|value| value.get("reasoning"))
        .and_then(Value::as_object)
        .is_some()
    {
        return None;
    }

    let mut reasoning = serde_json::Map::new();
    if let Some(show_thoughts) =
        param_boolish(parameters, &["showThoughts", "show_thoughts"], false)
    {
        reasoning.insert("exclude".to_string(), json!(!show_thoughts));
    }
    if reasoning.is_empty() {
        None
    } else {
        Some(Value::Object(reasoning))
    }
}

fn provider_error_text(details: &Value) -> Option<String> {
    [
        details.pointer("/error/message").and_then(Value::as_str),
        details.get("message").and_then(Value::as_str),
        details.pointer("/error").and_then(Value::as_str),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .find(|message| !message.is_empty())
    .map(|message| redact_sensitive_text(message).chars().take(500).collect())
}

fn provider_http_error(status: reqwest::StatusCode, details: Value) -> AppError {
    let details = redact_sensitive_json(details);
    let message = provider_error_text(&details)
        .map(|detail| format!("Provider returned HTTP {status}: {detail}"))
        .unwrap_or_else(|| format!("Provider returned HTTP {status}"));
    AppError::with_details("llm_provider_error", message, details)
}

fn sanitize_provider_error_text(text: &str) -> String {
    let trimmed = text.trim();
    let lower = trimmed.to_ascii_lowercase();
    if lower.contains("<html") || lower.contains("<!doctype") {
        return "Provider returned HTML instead of JSON".to_string();
    }
    redact_sensitive_text(trimmed).chars().take(500).collect()
}

fn provider_error_details_from_text(text: &str) -> Value {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return json!({});
    }
    serde_json::from_str::<Value>(trimmed)
        .map(redact_sensitive_json)
        .unwrap_or_else(|_| json!({ "message": sanitize_provider_error_text(trimmed) }))
}

fn assistant_prefill(parameters: &Value) -> Option<String> {
    param_string(parameters, &["assistantPrefill", "assistant_prefill"])
}

fn request_messages(request: &LlmRequest) -> Vec<LlmMessage> {
    let mut messages = request.messages.clone();
    if let Some(prefill) = assistant_prefill(&request.parameters) {
        messages.push(LlmMessage {
            role: "assistant".to_string(),
            content: prefill,
            name: None,
            images: Vec::new(),
            tool_call_id: None,
            tool_calls: None,
            provider_metadata: None,
        });
    }
    messages
}

#[derive(Debug, Clone)]
struct ChatGptAuth {
    access_token: String,
    account_id: Option<String>,
    is_fedramp: bool,
}

fn codex_auth_file_path() -> PathBuf {
    if let Ok(home) = env::var("CODEX_HOME") {
        let trimmed = home.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed).join("auth.json");
        }
    }
    let home = env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .unwrap_or_default();
    PathBuf::from(home).join(".codex").join("auth.json")
}

fn string_value(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn openai_chatgpt_auth_missing_message(error: &std::io::Error) -> String {
    format!(
        "No Codex ChatGPT login found in the local Codex auth.json credential file ({error}). Run `codex login` on this host."
    )
}

async fn load_openai_chatgpt_auth() -> AppResult<ChatGptAuth> {
    let path = codex_auth_file_path();
    let raw = fs::read_to_string(&path).map_err(|error| {
        AppError::new(
            "openai_chatgpt_auth_missing",
            openai_chatgpt_auth_missing_message(&error),
        )
    })?;
    let mut auth_json: Value = serde_json::from_str(&raw)
        .map_err(|error| AppError::new("openai_chatgpt_auth_error", error.to_string()))?;
    let tokens = auth_json
        .get("tokens")
        .and_then(Value::as_object)
        .ok_or_else(|| {
            AppError::new(
                "openai_chatgpt_auth_error",
                "Codex auth is not ChatGPT OAuth. Run `codex login`.",
            )
        })?;
    let mut access_token = string_value(tokens.get("access_token")).ok_or_else(|| {
        AppError::new(
            "openai_chatgpt_auth_error",
            "Codex ChatGPT auth does not contain an access token. Run `codex login`.",
        )
    })?;
    let account_id = string_value(tokens.get("account_id"));
    let should_refresh = openai_chatgpt_auth_should_refresh(&auth_json, &access_token);
    if should_refresh {
        let tokens = auth_json
            .get_mut("tokens")
            .and_then(Value::as_object_mut)
            .ok_or_else(|| {
                AppError::new(
                    "openai_chatgpt_auth_error",
                    "Codex auth is not ChatGPT OAuth. Run `codex login`.",
                )
            })?;
        let refresh_token = string_value(tokens.get("refresh_token"))
            .ok_or_else(openai_chatgpt_refresh_token_error)?;
        let refreshed = refresh_openai_chatgpt_auth(&refresh_token).await?;
        if let Some(next_access_token) = apply_openai_chatgpt_refreshed_tokens(tokens, &refreshed) {
            access_token = next_access_token;
        }
        auth_json["last_refresh"] = Value::String(chrono_like_now_iso());
        persist_openai_chatgpt_auth(&path, &auth_json)?;
    }
    Ok(ChatGptAuth {
        access_token,
        account_id,
        is_fedramp: auth_json
            .pointer("/tokens/id_token/chatgpt_account_is_fedramp")
            .and_then(Value::as_bool)
            .unwrap_or(false),
    })
}

pub async fn check_openai_chatgpt_auth() -> AppResult<String> {
    let auth = load_openai_chatgpt_auth().await?;
    let account = auth
        .account_id
        .as_deref()
        .map(|value| format!(" for account {value}"))
        .unwrap_or_default();
    Ok(format!(
        "ChatGPT login found via Codex auth{account}. Requests will use the local ChatGPT session."
    ))
}

fn decode_jwt_payload_json(token: &str) -> Option<Value> {
    let payload = token.split('.').nth(1).filter(|value| !value.is_empty())?;
    let decoded = general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .or_else(|_| general_purpose::URL_SAFE.decode(payload))
        .ok()?;
    serde_json::from_slice::<Value>(&decoded).ok()
}

fn openai_chatgpt_access_token_expires_soon(access_token: &str) -> bool {
    let Some(payload) = decode_jwt_payload_json(access_token) else {
        return false;
    };
    let Some(exp) = payload.get("exp").and_then(Value::as_f64) else {
        return false;
    };
    if !exp.is_finite() {
        return false;
    }
    let now = Utc::now().timestamp() as f64;
    exp <= now + OPENAI_CHATGPT_EXPIRY_REFRESH_SKEW_SECONDS as f64
}

fn openai_chatgpt_last_refresh_is_stale(last_refresh: Option<&Value>) -> bool {
    let Some(raw) = string_value(last_refresh) else {
        return false;
    };
    let Ok(parsed) = DateTime::parse_from_rfc3339(&raw) else {
        return false;
    };
    let age = Utc::now().signed_duration_since(parsed.with_timezone(&Utc));
    age > chrono::Duration::days(OPENAI_CHATGPT_TOKEN_REFRESH_INTERVAL_DAYS)
}

fn openai_chatgpt_auth_should_refresh(auth_json: &Value, access_token: &str) -> bool {
    openai_chatgpt_access_token_expires_soon(access_token)
        || openai_chatgpt_last_refresh_is_stale(auth_json.get("last_refresh"))
}

fn openai_chatgpt_refresh_token_error() -> AppError {
    AppError::new(
        "openai_chatgpt_auth_error",
        "Codex ChatGPT access token is stale, but no refresh token is available. Run `codex login`.",
    )
}

fn apply_openai_chatgpt_refreshed_tokens(
    tokens: &mut serde_json::Map<String, Value>,
    refreshed: &Value,
) -> Option<String> {
    let next_access_token = string_value(refreshed.get("access_token"));
    if let Some(next_access_token) = next_access_token.clone() {
        tokens.insert(
            "access_token".to_string(),
            Value::String(next_access_token.clone()),
        );
    }
    if let Some(next_refresh_token) = string_value(refreshed.get("refresh_token")) {
        tokens.insert(
            "refresh_token".to_string(),
            Value::String(next_refresh_token),
        );
    }
    if let Some(next_id_token) = string_value(refreshed.get("id_token")) {
        tokens.insert("id_token".to_string(), Value::String(next_id_token));
    }
    next_access_token
}

fn persist_openai_chatgpt_auth(path: &Path, auth_json: &Value) -> AppResult<()> {
    let serialized = serde_json::to_string_pretty(auth_json).map_err(|error| {
        AppError::new(
            "openai_chatgpt_auth_error",
            format!("Failed to serialize Codex ChatGPT auth refresh: {error}"),
        )
    })?;
    fs::write(path, format!("{serialized}\n")).map_err(|error| {
        AppError::new(
            "openai_chatgpt_auth_error",
            format!("Failed to update local Codex auth.json credential file: {error}"),
        )
    })
}

async fn refresh_openai_chatgpt_auth(refresh_token: &str) -> AppResult<Value> {
    let response = send_provider_request_with_error_code(
        provider_http_client_for_url(OPENAI_CHATGPT_REFRESH_URL)
            .await?
            .post(OPENAI_CHATGPT_REFRESH_URL)
            .json(&json!({
                "client_id": OPENAI_CHATGPT_CLIENT_ID,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            })),
        "openai_chatgpt_auth_refresh_error",
    )
    .await?;
    parse_json_response(response, |json| Some(json.to_string()))
        .await
        .and_then(|raw| {
            serde_json::from_str::<Value>(&raw).map_err(|error| {
                AppError::new("openai_chatgpt_auth_refresh_error", error.to_string())
            })
        })
}

fn chrono_like_now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn apply_openai_auth_headers(
    req: reqwest::RequestBuilder,
    request: &LlmRequest,
) -> reqwest::RequestBuilder {
    let mut req = req;
    if !request.connection.api_key.trim().is_empty() {
        req = req.bearer_auth(request.connection.api_key.trim());
    }
    if request.connection.provider == "openrouter" {
        req = req
            .header("HTTP-Referer", "https://marinara.local")
            .header("X-Title", "Marinara Engine");
    }
    req
}

async fn apply_chatgpt_auth_headers(
    req: reqwest::RequestBuilder,
) -> AppResult<reqwest::RequestBuilder> {
    let auth = load_openai_chatgpt_auth().await?;
    Ok(apply_chatgpt_auth_headers_with_auth(req, &auth))
}

fn apply_chatgpt_auth_headers_with_auth(
    req: reqwest::RequestBuilder,
    auth: &ChatGptAuth,
) -> reqwest::RequestBuilder {
    let mut req = req
        .bearer_auth(auth.access_token.as_str())
        .header("version", APP_VERSION)
        .header("originator", "Marinara-Engine")
        .header("User-Agent", format!("MarinaraEngine/{APP_VERSION}"));
    if let Some(account_id) = auth.account_id.as_deref() {
        req = req.header("ChatGPT-Account-ID", account_id);
    }
    if auth.is_fedramp {
        req = req.header("X-OpenAI-Fedramp", "true");
    }
    req
}

fn openai_chatgpt_models_url() -> String {
    format!("{OPENAI_CHATGPT_CODEX_BASE_URL}/models?client_version={APP_VERSION}")
}

fn normalize_openai_chatgpt_models(json: &Value) -> Vec<Value> {
    json.get("models")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let id = string_value(item.get("slug")).or_else(|| string_value(item.get("id")))?;
            let name = string_value(item.get("display_name"))
                .or_else(|| string_value(item.get("name")))
                .unwrap_or_else(|| id.clone());
            Some(json!({ "id": id, "name": name, "provider": "openai_chatgpt" }))
        })
        .collect()
}

async fn fetch_openai_chatgpt_models_from_url(
    url: &str,
    auth: &ChatGptAuth,
) -> AppResult<Vec<Value>> {
    let response = send_provider_request_with_error_code(
        apply_chatgpt_auth_headers_with_auth(
            provider_http_client_for_url(url).await?.get(url),
            auth,
        ),
        "models_network_error",
    )
    .await?;
    let (status, json) = read_json_response(response).await?;
    if !status.is_success() {
        let details = redact_sensitive_json(json);
        let message = provider_error_text(&details)
            .map(|detail| format!("ChatGPT model catalog returned HTTP {status}: {detail}"))
            .unwrap_or_else(|| format!("ChatGPT model catalog returned HTTP {status}"));
        return Err(AppError::with_details(
            "models_provider_error",
            message,
            details,
        ));
    }
    let models = normalize_openai_chatgpt_models(&json);
    if models.is_empty() {
        return Err(AppError::new(
            "models_provider_error",
            "ChatGPT model catalog returned no models",
        ));
    }
    Ok(models)
}

pub async fn list_openai_chatgpt_models() -> AppResult<Vec<Value>> {
    let auth = load_openai_chatgpt_auth().await?;
    fetch_openai_chatgpt_models_from_url(&openai_chatgpt_models_url(), &auth).await
}

fn cohere_message(message: &LlmMessage) -> Value {
    let mut object = serde_json::Map::new();
    object.insert("role".to_string(), json!(message.role));
    if message.images.is_empty() {
        object.insert("content".to_string(), json!(message.content));
    } else {
        let mut content = Vec::new();
        if !message.content.is_empty() {
            content.push(json!({ "type": "text", "text": message.content }));
        }
        for image in &message.images {
            content.push(json!({ "type": "image_url", "image_url": { "url": image } }));
        }
        object.insert("content".to_string(), Value::Array(content));
    }
    if let Some(tool_call_id) = message
        .tool_call_id
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        object.insert("tool_call_id".to_string(), json!(tool_call_id));
    }
    if let Some(tool_calls) = message.tool_calls.as_ref() {
        object.insert("tool_calls".to_string(), tool_calls.clone());
    }
    Value::Object(object)
}

fn cohere_response_format(parameters: &Value) -> Option<Value> {
    let value = parameters
        .get("response_format")
        .or_else(|| parameters.get("responseFormat"))?;
    if let Some(format) = value
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Some(json!({ "type": format }));
    }
    value.as_object().map(|_| value.clone())
}

fn apply_cohere_parameters(body: &mut Value, request: &LlmRequest) {
    let parameters = &request.parameters;
    if let Some(temp) = temperature(parameters) {
        body["temperature"] = json!(temp);
    }
    if let Some(top_p) = param_f64(parameters, &["topP", "top_p", "p"]) {
        body["p"] = json!(top_p);
    }
    if let Some(top_k) = param_i64(parameters, &["topK", "top_k", "k"]).filter(|value| *value >= 0)
    {
        body["k"] = json!(top_k);
    }
    if let Some(frequency_penalty) =
        param_f64(parameters, &["frequencyPenalty", "frequency_penalty"])
    {
        body["frequency_penalty"] = json!(frequency_penalty);
    }
    if let Some(presence_penalty) = param_f64(parameters, &["presencePenalty", "presence_penalty"])
    {
        body["presence_penalty"] = json!(presence_penalty);
    }
    if let Some(seed) = param_i64(parameters, &["seed"]) {
        body["seed"] = json!(seed);
    }
    if let Some(stop) = stop_sequences(parameters) {
        body["stop_sequences"] = json!(stop);
    }
    if request.tools.is_empty() {
        if let Some(response_format) = cohere_response_format(parameters) {
            body["response_format"] = response_format;
        }
    }
    if request.tools.is_empty() {
        if let Some(safety_mode) = param_string(parameters, &["safetyMode", "safety_mode"])
            .map(|value| value.to_ascii_uppercase())
            .filter(|value| is_cohere_safety_mode(value))
        {
            body["safety_mode"] = json!(safety_mode);
        }
    }
    if let Some(logprobs) = param_boolish(parameters, &["logprobs", "logProbs"], false) {
        body["logprobs"] = json!(logprobs);
    }
    if !request.tools.is_empty() {
        if let Some(tool_choice) = param_string(parameters, &["toolChoice", "tool_choice"])
            .and_then(|value| cohere_tool_choice(&value))
        {
            body["tool_choice"] = json!(tool_choice);
        }
    }
    if let Some(priority) =
        param_i64(parameters, &["priority"]).filter(|value| (0..=999).contains(value))
    {
        body["priority"] = json!(priority);
    }
    if !request.tools.is_empty() {
        if let Some(strict_tools) =
            param_boolish(parameters, &["strictTools", "strict_tools"], false)
        {
            body["strict_tools"] = json!(strict_tools);
        }
    }
    if let Some(thinking) = cohere_thinking_config(request) {
        body["thinking"] = thinking;
    }
    apply_custom_parameters_to_object(body, parameters, false, false, &[]);
    scrub_cohere_parameter_body(body, !request.tools.is_empty());
}

fn build_cohere_body(request: &LlmRequest, stream: bool) -> Value {
    let messages: Vec<Value> = request_messages(request)
        .iter()
        .map(cohere_message)
        .collect();
    let mut body = json!({
        "model": request.connection.model,
        "messages": messages,
        "stream": stream,
        "max_tokens": request_max_tokens(request, 1024),
    });
    if !request.tools.is_empty() {
        body["tools"] = Value::Array(
            request
                .tools
                .iter()
                .map(|tool| json!({ "type": "function", "function": tool }))
                .collect(),
        );
    }
    apply_cohere_parameters(&mut body, request);
    body
}

async fn complete_cohere_rich(request: LlmRequest) -> AppResult<LlmCompletion> {
    let url = cohere_chat_endpoint(&request.connection.base_url);
    let body = build_cohere_body(&request, false);
    log_prompt_connection_request("cohere.v2.chat", &url, &request, &body);
    let client = provider_http_client_for_url(&url).await?;
    let mut req = client.post(url).json(&body);
    if !request.connection.api_key.trim().is_empty() {
        req = req.bearer_auth(request.connection.api_key.trim());
    }
    let response = send_provider_request(req).await?;
    parse_cohere_response_rich(response).await
}

async fn stream_cohere(
    request: LlmRequest,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    let url = cohere_chat_endpoint(&request.connection.base_url);
    let body = build_cohere_body(&request, true);
    log_prompt_connection_request("cohere.v2.chat.stream", &url, &request, &body);
    let client = provider_http_client_for_url(&url).await?;
    let mut req = client.post(url).json(&body);
    if !request.connection.api_key.trim().is_empty() {
        req = req.bearer_auth(request.connection.api_key.trim());
    }
    let response = send_provider_request(req).await?;
    let status = response.status();
    if !status.is_success() {
        let error_body = read_error_response_details(response).await?;
        return Err(provider_http_error(status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut decoder = Utf8StreamDecoder::default();
    let mut tool_calls = OpenAiToolCallAccumulator::default();
    let mut completed = false;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| {
            AppError::new("llm_stream_error", provider_transport_error_message(error))
        })?;
        decoder.push_chunk(&chunk, &mut buffer);
        while let Some(block) = take_sse_block(&mut buffer) {
            if process_cohere_sse_block(&block, emit, &mut tool_calls)? == SseBlockStatus::Complete
            {
                completed = true;
                break;
            }
        }
        if completed {
            break;
        }
    }
    if !completed {
        decoder.finish(&mut buffer);
    }
    if !completed && !buffer.trim().is_empty() {
        process_cohere_sse_block(&buffer, emit, &mut tool_calls)?;
    }
    for tool_call in tool_calls.into_tool_calls() {
        emit(json!({ "type": "tool_call", "data": tool_call }))?;
    }
    Ok(())
}

async fn complete_openai_compatible_rich(request: LlmRequest) -> AppResult<LlmCompletion> {
    if should_use_openai_responses(&request) {
        return complete_openai_responses_rich(request).await;
    }
    let url = openai_compatible_chat_endpoint(&request);
    let messages: Vec<Value> = request_messages(&request)
        .iter()
        .map(openai_message)
        .collect();
    let mut body = json!({
        "model": request.connection.model,
        "messages": messages,
        "stream": false,
        "max_tokens": request_max_tokens(&request, 1024),
    });
    if !request.tools.is_empty() {
        body["tools"] = Value::Array(
            request
                .tools
                .iter()
                .map(|tool| json!({ "type": "function", "function": tool }))
                .collect(),
        );
        body["tool_choice"] = json!("auto");
    }
    if should_send_temperature(&request) {
        if let Some(temp) = temperature(&request.parameters) {
            body["temperature"] = json!(temp);
        }
    }
    apply_openai_parameters(&mut body, &request);
    log_prompt_connection_request("openai.chat.completions", &url, &request, &body);
    let client = provider_http_client_for_url(&url).await?;
    let mut req = client.post(url).json(&body);
    if !request.connection.api_key.trim().is_empty() {
        req = req.bearer_auth(request.connection.api_key.trim());
    }
    if request.connection.provider == "openrouter" {
        req = req
            .header("HTTP-Referer", "https://marinara.local")
            .header("X-Title", "Marinara Engine");
    }
    let response = send_provider_request(req).await?;
    parse_json_response_rich(response).await
}

async fn stream_openai_compatible(
    request: LlmRequest,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    let url = openai_compatible_chat_endpoint(&request);
    let messages: Vec<Value> = request_messages(&request)
        .iter()
        .map(openai_message)
        .collect();
    let mut body = json!({
        "model": request.connection.model,
        "messages": messages,
        "stream": true,
        "max_tokens": request_max_tokens(&request, 1024),
    });
    if !request.tools.is_empty() {
        body["tools"] = Value::Array(
            request
                .tools
                .iter()
                .map(|tool| json!({ "type": "function", "function": tool }))
                .collect(),
        );
        body["tool_choice"] = json!("auto");
    }
    if should_send_temperature(&request) {
        if let Some(temp) = temperature(&request.parameters) {
            body["temperature"] = json!(temp);
        }
    }
    apply_openai_parameters(&mut body, &request);
    log_prompt_connection_request("openai.chat.completions.stream", &url, &request, &body);
    let client = provider_http_client_for_url(&url).await?;
    let mut req = client.post(url).json(&body);
    if !request.connection.api_key.trim().is_empty() {
        req = req.bearer_auth(request.connection.api_key.trim());
    }
    if request.connection.provider == "openrouter" {
        req = req
            .header("HTTP-Referer", "https://marinara.local")
            .header("X-Title", "Marinara Engine");
    }
    let response = send_provider_request(req).await?;
    let status = response.status();
    if !status.is_success() {
        let error_body = read_error_response_details(response).await?;
        return Err(provider_http_error(status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut decoder = Utf8StreamDecoder::default();
    let mut tool_calls = OpenAiToolCallAccumulator::default();
    let mut completed = false;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| {
            AppError::new("llm_stream_error", provider_transport_error_message(error))
        })?;
        decoder.push_chunk(&chunk, &mut buffer);
        while let Some(block) = take_sse_block(&mut buffer) {
            if process_openai_sse_block(&block, emit, &mut tool_calls)? == SseBlockStatus::Complete
            {
                completed = true;
                break;
            }
        }
        if completed {
            break;
        }
    }
    if !completed {
        decoder.finish(&mut buffer);
    }
    if !completed && !buffer.trim().is_empty() {
        process_openai_sse_block(&buffer, emit, &mut tool_calls)?;
    }
    for tool_call in tool_calls.into_tool_calls() {
        emit(json!({ "type": "tool_call", "data": tool_call }))?;
    }
    Ok(())
}

fn take_sse_block(buffer: &mut String) -> Option<String> {
    let lf_boundary = buffer.find("\n\n").map(|index| (index, 2));
    let crlf_boundary = buffer.find("\r\n\r\n").map(|index| (index, 4));
    let (index, delimiter_len) = match (lf_boundary, crlf_boundary) {
        (Some(left), Some(right)) => {
            if left.0 <= right.0 {
                left
            } else {
                right
            }
        }
        (Some(boundary), None) | (None, Some(boundary)) => boundary,
        (None, None) => return None,
    };
    let block = buffer[..index].to_string();
    buffer.drain(..index + delimiter_len);
    Some(block)
}

const OPENAI_RESPONSES_ENCRYPTED_REASONING_INCLUDE: &str = "reasoning.encrypted_content";

fn openai_responses_preserve_encrypted_reasoning(request: &LlmRequest) -> bool {
    request.connection.provider != "openai_chatgpt"
}

fn encrypted_reasoning_items_from_metadata(metadata: &Value) -> Vec<Value> {
    [
        "encryptedReasoningItems",
        "openaiResponsesEncryptedReasoningItems",
    ]
    .into_iter()
    .filter_map(|key| metadata.get(key).and_then(Value::as_array))
    .flat_map(|items| items.iter())
    .filter(|item| {
        item.get("type").and_then(Value::as_str) == Some("reasoning")
            && item
                .get("encrypted_content")
                .and_then(Value::as_str)
                .is_some_and(|value| !value.trim().is_empty())
    })
    .cloned()
    .collect()
}

fn encrypted_reasoning_items_from_messages(messages: &[LlmMessage]) -> Vec<Value> {
    messages
        .iter()
        .filter(|message| message.role == "assistant")
        .filter_map(|message| message.provider_metadata.as_ref())
        .flat_map(encrypted_reasoning_items_from_metadata)
        .collect()
}

fn encrypted_reasoning_items_from_responses_output(json: &Value) -> Vec<Value> {
    json.get("output")
        .or_else(|| json.pointer("/response/output"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|item| {
            item.get("type").and_then(Value::as_str) == Some("reasoning")
                && item
                    .get("encrypted_content")
                    .and_then(Value::as_str)
                    .is_some_and(|value| !value.trim().is_empty())
        })
        .cloned()
        .collect()
}

fn openai_responses_provider_metadata(json: &Value) -> Option<Value> {
    let encrypted_reasoning_items = encrypted_reasoning_items_from_responses_output(json);
    if encrypted_reasoning_items.is_empty() {
        None
    } else {
        Some(json!({ "encryptedReasoningItems": encrypted_reasoning_items }))
    }
}

fn ensure_openai_responses_include(body: &mut Value, include: &str) {
    if let Some(items) = body.get_mut("include").and_then(Value::as_array_mut) {
        if !items
            .iter()
            .any(|item| item.as_str().is_some_and(|value| value == include))
        {
            items.push(Value::String(include.to_string()));
        }
        return;
    }
    body["include"] = json!([include]);
}

#[derive(Default)]
struct ResponsesToolCallIdMapper {
    ids: BTreeMap<String, String>,
    counter: usize,
}

impl ResponsesToolCallIdMapper {
    fn ensure(&mut self, id: &str) -> String {
        if id.starts_with("fc_") {
            return id.to_string();
        }
        if let Some(mapped) = self.ids.get(id) {
            return mapped.clone();
        }
        self.counter += 1;
        let mapped = format!("fc_mapped_{}", self.counter);
        self.ids.insert(id.to_string(), mapped.clone());
        mapped
    }
}

fn tool_call_raw_id(call: &Value) -> Option<&str> {
    call.get("id")
        .or_else(|| call.get("call_id"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn tool_call_function_name(call: &Value) -> Option<&str> {
    call.pointer("/function/name")
        .or_else(|| call.get("name"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn tool_call_arguments(call: &Value) -> String {
    let value = call
        .pointer("/function/arguments")
        .or_else(|| call.get("arguments"));
    match value {
        Some(Value::String(arguments)) => arguments.clone(),
        Some(value) => compact_json(value),
        None => "{}".to_string(),
    }
}

fn responses_tool_call_input_items(
    message: &LlmMessage,
    id_mapper: &mut ResponsesToolCallIdMapper,
) -> Vec<Value> {
    let Some(tool_calls) = message.tool_calls.as_ref().and_then(Value::as_array) else {
        return Vec::new();
    };
    tool_calls
        .iter()
        .enumerate()
        .map(|(index, call)| {
            let raw_id = tool_call_raw_id(call)
                .map(str::to_string)
                .unwrap_or_else(|| format!("call_{}", index + 1));
            let fc_id = id_mapper.ensure(&raw_id);
            json!({
                "type": "function_call",
                "id": fc_id,
                "call_id": fc_id,
                "name": tool_call_function_name(call).unwrap_or(""),
                "arguments": tool_call_arguments(call),
            })
        })
        .collect()
}

fn responses_message_input(
    message: &LlmMessage,
    id_mapper: &mut ResponsesToolCallIdMapper,
) -> Vec<Value> {
    if message.role == "tool" {
        let call_id = message
            .tool_call_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|id| id_mapper.ensure(id))
            .unwrap_or_default();
        return vec![json!({
            "type": "function_call_output",
            "call_id": call_id,
            "output": message.content,
        })];
    }

    let role = if message.role == "assistant" {
        "assistant"
    } else if message.role == "system" {
        "system"
    } else {
        "user"
    };
    let mut items = Vec::new();
    if message.images.is_empty() {
        if !message.content.trim().is_empty() || message.role != "assistant" {
            items.push(json!({ "role": role, "content": message.content }));
        }
    } else {
        let mut content = Vec::new();
        if !message.content.is_empty() {
            content.push(json!({ "type": "input_text", "text": message.content }));
        }
        for image in &message.images {
            content.push(json!({ "type": "input_image", "image_url": image }));
        }
        items.push(json!({ "role": role, "content": content }));
    }
    if message.role == "assistant" {
        items.extend(responses_tool_call_input_items(message, id_mapper));
    }
    items
}

fn is_responses_assistant_input_item(item: &Value) -> bool {
    item.get("role").and_then(Value::as_str) == Some("assistant")
        || item.get("type").and_then(Value::as_str) == Some("function_call")
}

fn responses_input(messages: &[LlmMessage], replay_encrypted_reasoning: bool) -> Value {
    let mut id_mapper = ResponsesToolCallIdMapper::default();
    let mut input = messages
        .iter()
        .flat_map(|message| responses_message_input(message, &mut id_mapper))
        .collect::<Vec<_>>();
    if replay_encrypted_reasoning {
        let encrypted_reasoning_items = encrypted_reasoning_items_from_messages(messages);
        if !encrypted_reasoning_items.is_empty() {
            if let Some(index) = input.iter().rposition(is_responses_assistant_input_item) {
                input.splice(index..index, encrypted_reasoning_items);
            }
        }
    }
    Value::Array(input)
}

fn build_openai_responses_body(request: &LlmRequest, stream: bool) -> Value {
    let messages = request_messages(request);
    let preserve_encrypted_reasoning = openai_responses_preserve_encrypted_reasoning(request);
    let mut body = json!({
        "model": request.connection.model,
        "input": responses_input(&messages, preserve_encrypted_reasoning),
        "stream": stream,
        "max_output_tokens": request_max_tokens(request, 1024),
    });
    if let Some(effort) = openai_reasoning_effort(request) {
        body["reasoning"] = json!({ "effort": effort, "summary": "auto" });
    }
    if let Some(temperature) = param_f64(&request.parameters, &["temperature"]) {
        body["temperature"] = json!(temperature);
    }
    if let Some(top_p) = param_f64(&request.parameters, &["topP", "top_p"]) {
        body["top_p"] = json!(top_p);
    }
    if let Some(service_tier) = param_string(&request.parameters, &["serviceTier", "service_tier"])
        .filter(|value| is_openai_service_tier(value))
    {
        body["service_tier"] = json!(service_tier);
    }
    if let Some(format) = param_string(&request.parameters, &["responseFormat", "response_format"])
    {
        if format == "json_object" {
            body["text"] = json!({ "format": { "type": "json_object" } });
        }
    }
    if let Some(verbosity) = param_string(&request.parameters, &["verbosity"]) {
        let mut text = body
            .get("text")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        text.insert("verbosity".to_string(), json!(verbosity));
        body["text"] = Value::Object(text);
    }
    if !request.tools.is_empty() {
        body["tools"] = Value::Array(
            request
                .tools
                .iter()
                .map(|tool| json!({ "type": "function", "name": tool.get("name").cloned().unwrap_or(Value::String("tool".to_string())), "description": tool.get("description").cloned().unwrap_or(Value::Null), "parameters": tool.get("parameters").cloned().unwrap_or_else(|| json!({ "type": "object", "properties": {} })) }))
                .collect(),
        );
        body["tool_choice"] = json!("auto");
    }
    apply_custom_parameters_to_object(
        &mut body,
        &request.parameters,
        false,
        false,
        OPENAI_RESPONSES_UNSUPPORTED_CUSTOM_PARAMETER_KEYS,
    );
    if preserve_encrypted_reasoning {
        ensure_openai_responses_include(&mut body, OPENAI_RESPONSES_ENCRYPTED_REASONING_INCLUDE);
    }
    body
}

async fn openai_responses_request(
    request: &LlmRequest,
    body: &Value,
) -> AppResult<reqwest::Response> {
    let base = base_url(&request.connection.provider, &request.connection.base_url);
    let url = format!("{base}/responses");
    log_prompt_connection_request("openai.responses", &url, request, body);
    let req = provider_http_client_for_url(&url)
        .await?
        .post(url)
        .json(body);
    let req = if request.connection.provider == "openai_chatgpt" {
        apply_chatgpt_auth_headers(req).await?
    } else {
        apply_openai_auth_headers(req, request)
    };
    send_provider_request(req).await
}

async fn complete_openai_responses_rich(request: LlmRequest) -> AppResult<LlmCompletion> {
    let body = build_openai_responses_body(&request, false);
    let response = openai_responses_request(&request, &body).await?;
    let (status, json) = read_json_response(response).await?;
    if !status.is_success() {
        return Err(provider_http_error(status, json));
    }
    let mut content = String::new();
    if let Some(text) = json.get("output_text").and_then(Value::as_str) {
        content.push_str(text);
    }
    if content.is_empty() {
        if let Some(output) = json.get("output").and_then(Value::as_array) {
            for item in output {
                if let Some(parts) = item.get("content").and_then(Value::as_array) {
                    for part in parts {
                        if let Some(text) = part.get("text").and_then(Value::as_str) {
                            content.push_str(text);
                        }
                    }
                }
            }
        }
    }
    let tool_calls = responses_tool_calls(&json);
    let provider_metadata = openai_responses_provider_metadata(&json);
    let usage = json.get("usage").cloned();
    let finish_reason = if !tool_calls.is_empty() {
        Some("tool_calls".to_string())
    } else {
        json.get("status").and_then(Value::as_str).map(|status| {
            if status.eq_ignore_ascii_case("incomplete") {
                "length".to_string()
            } else {
                status.to_string()
            }
        })
    };
    if content.trim().is_empty() && tool_calls.is_empty() {
        return Err(AppError::with_details(
            "llm_response_error",
            "Responses API result did not contain assistant text or tool calls",
            redact_sensitive_json(json),
        ));
    }
    Ok(LlmCompletion {
        content,
        tool_calls,
        finish_reason,
        usage,
        provider_metadata,
    })
}

fn responses_tool_calls(json: &Value) -> Vec<Value> {
    json.get("output")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|item| item.get("type").and_then(Value::as_str) == Some("function_call"))
        .map(|item| {
            json!({
                "id": item.get("call_id").or_else(|| item.get("id")).and_then(Value::as_str).unwrap_or(""),
                "name": item.get("name").and_then(Value::as_str).unwrap_or(""),
                "arguments": item.get("arguments").and_then(Value::as_str).unwrap_or("{}"),
                "function": {
                    "name": item.get("name").and_then(Value::as_str).unwrap_or(""),
                    "arguments": item.get("arguments").and_then(Value::as_str).unwrap_or("{}")
                }
            })
        })
        .collect()
}

async fn stream_openai_responses(
    request: LlmRequest,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    let body = build_openai_responses_body(&request, true);
    let response = openai_responses_request(&request, &body).await?;
    let status = response.status();
    if !status.is_success() {
        let error_body = read_error_response_details(response).await?;
        return Err(provider_http_error(status, error_body));
    }
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut decoder = Utf8StreamDecoder::default();
    let mut tool_calls = ResponsesToolCallAccumulator::default();
    let mut completed = false;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| {
            AppError::new("llm_stream_error", provider_transport_error_message(error))
        })?;
        decoder.push_chunk(&chunk, &mut buffer);
        while let Some(block) = take_sse_block(&mut buffer) {
            if process_openai_responses_sse_block(&block, emit, &mut tool_calls)?
                == SseBlockStatus::Complete
            {
                completed = true;
                break;
            }
        }
        if completed {
            break;
        }
    }
    if !completed {
        decoder.finish(&mut buffer);
    }
    if !completed && !buffer.trim().is_empty() {
        process_openai_responses_sse_block(&buffer, emit, &mut tool_calls)?;
    }
    for tool_call in tool_calls.into_tool_calls() {
        emit(json!({ "type": "tool_call", "data": tool_call }))?;
    }
    Ok(())
}

fn process_openai_responses_sse_block(
    block: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
    tool_calls: &mut ResponsesToolCallAccumulator,
) -> AppResult<SseBlockStatus> {
    let event_name = block
        .lines()
        .find_map(|line| line.trim_start().strip_prefix("event:"))
        .map(str::trim)
        .unwrap_or("");
    let payload = block
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix("data:"))
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n");
    if payload.is_empty() {
        return Ok(SseBlockStatus::Continue);
    }
    if payload == "[DONE]" {
        return Ok(SseBlockStatus::Complete);
    }
    let value: Value = serde_json::from_str(&payload)
        .map_err(|error| AppError::new("llm_stream_parse_error", error.to_string()))?;
    let event_type = value
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or(event_name);
    match event_type {
        "response.output_text.delta" => {
            if let Some(delta) = value
                .get("delta")
                .and_then(Value::as_str)
                .filter(|delta| !delta.is_empty())
            {
                emit(json!({ "type": "token", "text": delta, "data": delta }))?;
            }
        }
        "response.reasoning_summary_text.delta" | "response.reasoning_text.delta" => {
            if let Some(delta) = value
                .get("delta")
                .and_then(Value::as_str)
                .filter(|delta| !delta.is_empty())
            {
                emit(json!({ "type": "thinking", "text": delta, "data": delta }))?;
            }
        }
        "response.output_item.added" => {
            if let Some(item) = value.get("item") {
                tool_calls.ingest_output_item(item);
            }
        }
        "response.function_call_arguments.delta" => {
            tool_calls.ingest_arguments_delta(&value);
        }
        "response.function_call_arguments.done" => {
            tool_calls.ingest_arguments_done(&value);
        }
        "response.output_item.done" => {
            if let Some(item) = value.get("item") {
                tool_calls.ingest_output_item(item);
            }
        }
        "response.completed" => {
            if let Some(output) = value
                .pointer("/response/output")
                .or_else(|| value.get("output"))
                .and_then(Value::as_array)
            {
                for item in output {
                    tool_calls.ingest_output_item(item);
                }
            }
            if let Some(usage) = value
                .pointer("/response/usage")
                .or_else(|| value.get("usage"))
            {
                emit(json!({ "type": "usage", "data": usage }))?;
            }
            if let Some(provider_metadata) = openai_responses_provider_metadata(&value) {
                emit(json!({ "type": "provider_metadata", "data": provider_metadata }))?;
            }
            return Ok(SseBlockStatus::Complete);
        }
        "response.failed" | "response.incomplete" | "error" => {
            return Err(AppError::with_details(
                "llm_provider_error",
                format!("Responses API stream event {event_type}"),
                redact_sensitive_json(value),
            ));
        }
        _ => {}
    }
    Ok(SseBlockStatus::Continue)
}

#[derive(Default)]
struct OpenAiToolCallAccumulator {
    calls: BTreeMap<u64, OpenAiToolCallParts>,
}

#[derive(Default)]
struct OpenAiToolCallParts {
    id: Option<String>,
    name: Option<String>,
    arguments: String,
}

impl OpenAiToolCallAccumulator {
    fn ingest_delta(&mut self, delta: &Value) {
        let Some(tool_calls) = delta.get("tool_calls").and_then(Value::as_array) else {
            return;
        };
        for tool_call in tool_calls {
            let index = tool_call
                .get("index")
                .and_then(Value::as_u64)
                .unwrap_or(self.calls.len() as u64);
            let parts = self.calls.entry(index).or_default();
            if let Some(id) = tool_call
                .get("id")
                .and_then(Value::as_str)
                .filter(|id| !id.is_empty())
            {
                parts.id = Some(id.to_string());
            }
            let Some(function) = tool_call.get("function").and_then(Value::as_object) else {
                continue;
            };
            if let Some(name) = function
                .get("name")
                .and_then(Value::as_str)
                .filter(|name| !name.is_empty())
            {
                parts.name.get_or_insert_with(String::new).push_str(name);
            }
            if let Some(arguments) = function.get("arguments").and_then(Value::as_str) {
                parts.arguments.push_str(arguments);
            }
        }
    }

    fn into_tool_calls(self) -> Vec<Value> {
        self.calls
            .into_iter()
            .filter_map(|(index, parts)| {
                let name = parts.name.unwrap_or_default();
                if name.trim().is_empty() && parts.arguments.trim().is_empty() {
                    return None;
                }
                let arguments = if parts.arguments.trim().is_empty() {
                    "{}".to_string()
                } else {
                    parts.arguments
                };
                Some(json!({
                    "id": parts.id.unwrap_or_else(|| format!("call-{index}")),
                    "name": name.clone(),
                    "arguments": arguments.clone(),
                    "function": {
                        "name": name,
                        "arguments": arguments
                    }
                }))
            })
            .collect()
    }
}

#[derive(Default)]
struct ResponsesToolCallAccumulator {
    calls: BTreeMap<String, ResponsesToolCallParts>,
}

#[derive(Default)]
struct ResponsesToolCallParts {
    name: Option<String>,
    arguments: String,
}

impl ResponsesToolCallAccumulator {
    fn call_id(value: &Value) -> Option<String> {
        value
            .get("call_id")
            .or_else(|| value.get("id"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    }

    fn entry_mut(&mut self, call_id: String) -> &mut ResponsesToolCallParts {
        self.calls.entry(call_id).or_default()
    }

    fn ingest_output_item(&mut self, item: &Value) {
        if item.get("type").and_then(Value::as_str) != Some("function_call") {
            return;
        }
        let Some(call_id) = Self::call_id(item) else {
            return;
        };
        let entry = self.entry_mut(call_id);
        if let Some(name) = item
            .get("name")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
        {
            entry.name = Some(name.to_string());
        }
        if let Some(arguments) = item.get("arguments").and_then(Value::as_str) {
            entry.arguments = arguments.to_string();
        }
    }

    fn ingest_arguments_delta(&mut self, value: &Value) {
        let Some(call_id) = Self::call_id(value) else {
            return;
        };
        let Some(delta) = value.get("delta").and_then(Value::as_str) else {
            return;
        };
        self.entry_mut(call_id).arguments.push_str(delta);
    }

    fn ingest_arguments_done(&mut self, value: &Value) {
        let Some(call_id) = Self::call_id(value) else {
            return;
        };
        if let Some(arguments) = value.get("arguments").and_then(Value::as_str) {
            self.entry_mut(call_id).arguments = arguments.to_string();
        }
    }

    fn into_tool_calls(self) -> Vec<Value> {
        self.calls
            .into_iter()
            .filter_map(|(call_id, parts)| {
                let name = parts.name.unwrap_or_default();
                if name.trim().is_empty() && parts.arguments.trim().is_empty() {
                    return None;
                }
                let arguments = if parts.arguments.trim().is_empty() {
                    "{}".to_string()
                } else {
                    parts.arguments
                };
                Some(json!({
                    "id": call_id,
                    "name": name.clone(),
                    "arguments": arguments.clone(),
                    "function": {
                        "name": name,
                        "arguments": arguments
                    }
                }))
            })
            .collect()
    }
}

fn emit_openai_content_delta(
    content: &Value,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    match content {
        Value::String(text) if !text.is_empty() => {
            emit(json!({ "type": "token", "text": text, "data": text }))?;
        }
        Value::Array(parts) => {
            for part in parts {
                emit_openai_content_delta(part, emit)?;
            }
        }
        Value::Object(_) if content.get("type").and_then(Value::as_str) == Some("thinking") => {
            let thinking = content
                .get("thinking")
                .map(content_text)
                .filter(|text| !text.trim().is_empty())
                .or_else(|| {
                    content
                        .get("text")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                })
                .unwrap_or_default();
            if !thinking.is_empty() {
                emit(json!({ "type": "thinking", "text": thinking, "data": thinking }))?;
            }
        }
        Value::Object(_) => {
            if let Some(text) = content_part_text(content).filter(|text| !text.is_empty()) {
                emit(json!({ "type": "token", "text": text, "data": text }))?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn cohere_delta_text(value: &Value) -> Option<String> {
    value
        .pointer("/delta/message/content/text")
        .or_else(|| value.pointer("/delta/message/content/thinking"))
        .or_else(|| value.pointer("/delta/message/content"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn cohere_event_thinking_text(value: &Value) -> Option<String> {
    value
        .pointer("/delta/message/content/thinking")
        .or_else(|| value.pointer("/delta/message/thinking"))
        .or_else(|| value.pointer("/delta/message/content/text"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn cohere_tool_call_delta(value: &Value) -> Option<Value> {
    let index = value.get("index").and_then(Value::as_u64).unwrap_or(0);
    let tool_call = value
        .pointer("/delta/message/tool_calls")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .or_else(|| value.pointer("/delta/message/tool_calls"))?;
    let id = tool_call
        .get("id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string);
    let function = tool_call.get("function").unwrap_or(tool_call);
    let name = function
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string);
    let arguments = function
        .get("arguments")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let mut call = json!({
        "index": index,
        "type": "function",
        "function": {
            "arguments": arguments,
        }
    });
    if let Some(id) = id {
        call["id"] = json!(id);
    }
    if let Some(name) = name {
        call["function"]["name"] = json!(name);
    }
    Some(json!({ "tool_calls": [call] }))
}

fn process_cohere_sse_block(
    block: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
    tool_calls: &mut OpenAiToolCallAccumulator,
) -> AppResult<SseBlockStatus> {
    let payload = block
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix("data:"))
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n");
    if payload.is_empty() {
        return Ok(SseBlockStatus::Continue);
    }
    let value: Value = serde_json::from_str(&payload)
        .map_err(|error| AppError::new("llm_stream_parse_error", error.to_string()))?;
    let event_type = value.get("type").and_then(Value::as_str).unwrap_or("");
    match event_type {
        "content-delta" => {
            if value
                .pointer("/delta/message/content/type")
                .and_then(Value::as_str)
                == Some("thinking")
            {
                if let Some(thinking) =
                    cohere_event_thinking_text(&value).filter(|text| !text.is_empty())
                {
                    emit(json!({ "type": "thinking", "text": thinking, "data": thinking }))?;
                }
            } else if let Some(text) = cohere_delta_text(&value).filter(|text| !text.is_empty()) {
                emit(json!({ "type": "token", "text": text, "data": text }))?;
            }
        }
        "tool-plan-delta" => {
            if let Some(plan) = value
                .pointer("/delta/message/tool_plan")
                .and_then(Value::as_str)
                .filter(|text| !text.is_empty())
            {
                emit(json!({ "type": "thinking", "text": plan, "data": plan }))?;
            }
        }
        "tool-call-start" | "tool-call-delta" => {
            if let Some(delta) = cohere_tool_call_delta(&value) {
                tool_calls.ingest_delta(&delta);
            }
        }
        "message-end" => {
            if let Some(usage) = value
                .pointer("/delta/usage")
                .or_else(|| value.get("usage"))
                .filter(|usage| !usage.is_null())
            {
                emit(json!({ "type": "usage", "data": usage }))?;
            }
            return Ok(SseBlockStatus::Complete);
        }
        _ => {}
    }
    Ok(SseBlockStatus::Continue)
}

fn process_openai_sse_block(
    block: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
    tool_calls: &mut OpenAiToolCallAccumulator,
) -> AppResult<SseBlockStatus> {
    let payload = block
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix("data:"))
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n");
    if payload.is_empty() {
        return Ok(SseBlockStatus::Continue);
    }
    if payload == "[DONE]" {
        return Ok(SseBlockStatus::Complete);
    }
    let value: Value = serde_json::from_str(&payload)
        .map_err(|error| AppError::new("llm_stream_parse_error", error.to_string()))?;
    if let Some(usage) = value.get("usage").filter(|usage| !usage.is_null()) {
        emit(json!({ "type": "usage", "data": usage }))?;
    }
    let Some(choices) = value.get("choices").and_then(Value::as_array) else {
        return Ok(SseBlockStatus::Continue);
    };
    for choice in choices {
        let delta = choice.get("delta").unwrap_or(choice);
        tool_calls.ingest_delta(delta);
        for key in ["reasoning_content", "reasoning", "thinking"] {
            if let Some(thinking) = delta.get(key).and_then(Value::as_str) {
                if !thinking.is_empty() {
                    emit(json!({ "type": "thinking", "text": thinking, "data": thinking }))?;
                }
            }
        }
        if let Some(content) = delta.get("content") {
            emit_openai_content_delta(content, emit)?;
        }
        if choice
            .get("finish_reason")
            .and_then(Value::as_str)
            .filter(|reason| !reason.is_empty())
            .is_some()
        {
            return Ok(SseBlockStatus::Complete);
        }
    }
    Ok(SseBlockStatus::Continue)
}

fn openai_message(message: &LlmMessage) -> Value {
    let mut object = serde_json::Map::new();
    object.insert("role".to_string(), json!(message.role));
    if message.images.is_empty() {
        object.insert("content".to_string(), json!(message.content));
    } else {
        let mut content = Vec::new();
        if !message.content.is_empty() {
            content.push(json!({ "type": "text", "text": message.content }));
        }
        for image in &message.images {
            content.push(json!({ "type": "image_url", "image_url": { "url": image } }));
        }
        object.insert("content".to_string(), Value::Array(content));
    }
    if let Some(name) = message
        .name
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        object.insert("name".to_string(), json!(name));
    }
    if let Some(tool_call_id) = message
        .tool_call_id
        .as_ref()
        .filter(|value| !value.trim().is_empty())
    {
        object.insert("tool_call_id".to_string(), json!(tool_call_id));
    }
    if let Some(tool_calls) = message.tool_calls.as_ref() {
        object.insert("tool_calls".to_string(), tool_calls.clone());
    }
    Value::Object(object)
}

fn apply_openai_parameters(body: &mut Value, request: &LlmRequest) {
    let parameters = &request.parameters;
    let xai_reasoning_active =
        request.connection.provider == "xai" && xai_reasoning_active(request);
    if should_send_openai_sampling_parameters(request) {
        if let Some(top_p) = param_f64(parameters, &["topP", "top_p"]) {
            body["top_p"] = json!(top_p);
        }
        if should_send_top_k(request) {
            if let Some(top_k) =
                param_i64(parameters, &["topK", "top_k"]).filter(|value| *value > 0)
            {
                body["top_k"] = json!(top_k);
            }
        }
        if let Some(frequency_penalty) =
            param_f64(parameters, &["frequencyPenalty", "frequency_penalty"])
                .filter(|_| !xai_reasoning_active)
        {
            body["frequency_penalty"] = json!(frequency_penalty);
        }
        if let Some(presence_penalty) =
            param_f64(parameters, &["presencePenalty", "presence_penalty"])
                .filter(|_| !xai_reasoning_active)
        {
            body["presence_penalty"] = json!(presence_penalty);
        }
        if request.connection.provider == "openrouter" || request.connection.provider == "nanogpt" {
            if let Some(min_p) = param_f64(parameters, &["minP", "min_p"])
                .filter(|value| (0.0..=1.0).contains(value))
            {
                body["min_p"] = json!(min_p);
            }
            if let Some(top_a) = param_f64(parameters, &["topA", "top_a"])
                .filter(|value| (0.0..=1.0).contains(value))
            {
                body["top_a"] = json!(top_a);
            }
            if let Some(repetition_penalty) =
                param_f64(parameters, &["repetitionPenalty", "repetition_penalty"])
                    .filter(|value| (0.0..=2.0).contains(value))
            {
                body["repetition_penalty"] = json!(repetition_penalty);
            }
            if request.connection.provider == "nanogpt" {
                if let Some(tfs) =
                    param_f64(parameters, &["tfs"]).filter(|value| (0.0..=1.0).contains(value))
                {
                    body["tfs"] = json!(tfs);
                }
                if let Some(eta_cutoff) = param_f64(parameters, &["etaCutoff", "eta_cutoff"]) {
                    body["eta_cutoff"] = json!(eta_cutoff);
                }
                if let Some(epsilon_cutoff) =
                    param_f64(parameters, &["epsilonCutoff", "epsilon_cutoff"])
                {
                    body["epsilon_cutoff"] = json!(epsilon_cutoff);
                }
                if let Some(typical_p) = param_f64(parameters, &["typicalP", "typical_p"])
                    .filter(|value| (0.0..=1.0).contains(value))
                {
                    body["typical_p"] = json!(typical_p);
                }
                if let Some(mirostat_mode) =
                    param_i64(parameters, &["mirostatMode", "mirostat_mode"])
                        .filter(|value| (0..=2).contains(value))
                {
                    body["mirostat_mode"] = json!(mirostat_mode);
                }
                if let Some(mirostat_tau) = param_f64(parameters, &["mirostatTau", "mirostat_tau"])
                {
                    body["mirostat_tau"] = json!(mirostat_tau);
                }
                if let Some(mirostat_eta) = param_f64(parameters, &["mirostatEta", "mirostat_eta"])
                {
                    body["mirostat_eta"] = json!(mirostat_eta);
                }
            }
        }
    }
    if let Some(seed) = param_i64(parameters, &["seed"]) {
        if request.connection.provider == "mistral" {
            body["random_seed"] = json!(seed);
        } else {
            body["seed"] = json!(seed);
        }
    }
    let send_sampling = should_send_openai_sampling_parameters(request);
    if send_sampling {
        if let Some(stop) = stop_sequences(parameters).filter(|_| !xai_reasoning_active) {
            body["stop"] = json!(stop);
        }
    }
    if let Some(format) = param_string(parameters, &["responseFormat", "response_format"]) {
        body["response_format"] = json!({ "type": format });
    }
    if request.connection.provider == "openrouter" {
        if let Some(reasoning) = openrouter_reasoning_config(parameters) {
            body["reasoning"] = reasoning;
        }
        if let Some(openrouter_provider) = request
            .connection
            .openrouter_provider
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            body["provider"] = json!({ "order": [openrouter_provider] });
        }
        if request.connection.enable_caching && model_contains(request, "claude") {
            body["cache_control"] = json!({ "type": "ephemeral" });
        }
        if let Some(service_tier) = param_string(parameters, &["serviceTier", "service_tier"])
            .filter(|value| is_openrouter_service_tier(value))
        {
            body["service_tier"] = json!(service_tier);
        }
        if let Some(verbosity) =
            param_string(parameters, &["verbosity"]).filter(|value| is_openrouter_verbosity(value))
        {
            body["verbosity"] = json!(verbosity);
        }
        if !request.tools.is_empty() {
            if let Some(parallel_tool_calls) = param_boolish(
                parameters,
                &["parallelToolCalls", "parallel_tool_calls"],
                true,
            ) {
                body["parallel_tool_calls"] = json!(parallel_tool_calls);
            }
        }
    } else if request.connection.provider == "xai" {
        if let Some(effort) = xai_reasoning_effort(request) {
            body["reasoning_effort"] = json!(effort);
        }
        if let Some(reasoning) = xai_reasoning_config(request) {
            body["reasoning"] = reasoning;
        }
        if let Some(service_tier) = param_string(parameters, &["serviceTier", "service_tier"])
            .filter(|value| is_xai_service_tier(value))
        {
            body["service_tier"] = json!(service_tier);
        }
        if !request.tools.is_empty() {
            if let Some(parallel_tool_calls) = param_boolish(
                parameters,
                &["parallelToolCalls", "parallel_tool_calls"],
                true,
            ) {
                body["parallel_tool_calls"] = json!(parallel_tool_calls);
            }
        }
    } else if request.connection.provider == "nanogpt" {
        if let Some(effort) = nanogpt_reasoning_effort(parameters) {
            body["reasoning_effort"] = json!(effort);
        }
        if let Some(reasoning) = nanogpt_reasoning_config(parameters) {
            body["reasoning"] = reasoning;
        }
        if let Some(prompt_caching) = nanogpt_prompt_caching_config(parameters) {
            body["prompt_caching"] = prompt_caching;
        }
        if let Some(caching) = param_boolish(parameters, &["caching"], false)
            .or(request.connection.enable_caching.then_some(true))
        {
            body["caching"] = json!(caching);
        }
        if let Some(sticky_provider) =
            param_boolish(parameters, &["stickyProvider", "stickyprovider"], true)
        {
            body["stickyProvider"] = json!(sticky_provider);
        }
        if let Some(provider) = parameters
            .get("nanoGptProvider")
            .or_else(|| parameters.get("nano_gpt_provider"))
            .or_else(|| parameters.get("provider"))
            .filter(|value| !value.is_null())
        {
            body["provider"] = provider.clone();
        }
        if let Some(billing_mode) = param_string(parameters, &["billingMode", "billing_mode"]) {
            body["billing_mode"] = json!(billing_mode);
        }
        if let Some(min_tokens) =
            param_i64(parameters, &["minTokens", "min_tokens"]).filter(|value| *value >= 0)
        {
            body["min_tokens"] = json!(min_tokens);
        }
        if let Some(include_stop) = param_boolish(
            parameters,
            &["includeStopStrInOutput", "include_stop_str_in_output"],
            false,
        ) {
            body["include_stop_str_in_output"] = json!(include_stop);
        }
        if let Some(ignore_eos) = param_boolish(parameters, &["ignoreEos", "ignore_eos"], false) {
            body["ignore_eos"] = json!(ignore_eos);
        }
        if let Some(no_repeat_ngram_size) =
            param_i64(parameters, &["noRepeatNgramSize", "no_repeat_ngram_size"])
                .filter(|value| *value >= 0)
        {
            body["no_repeat_ngram_size"] = json!(no_repeat_ngram_size);
        }
        if let Some(stop_token_ids) =
            param_i64_array(parameters, &["stopTokenIds", "stop_token_ids"])
        {
            body["stop_token_ids"] = json!(stop_token_ids);
        }
        if let Some(custom_token_bans) =
            param_i64_array(parameters, &["customTokenBans", "custom_token_bans"])
        {
            body["custom_token_bans"] = json!(custom_token_bans);
        }
        if let Some(logit_bias) = parameters
            .get("logitBias")
            .or_else(|| parameters.get("logit_bias"))
            .filter(|value| value.as_object().is_some())
        {
            body["logit_bias"] = logit_bias.clone();
        }
        if let Some(logprobs) = parameters.get("logprobs").filter(|value| !value.is_null()) {
            body["logprobs"] = logprobs.clone();
        }
        if let Some(prompt_logprobs) =
            param_boolish(parameters, &["promptLogprobs", "prompt_logprobs"], false)
        {
            body["prompt_logprobs"] = json!(prompt_logprobs);
        }
        if let Some(reasoning_delta_field) = param_string(
            parameters,
            &["reasoningDeltaField", "reasoning_delta_field"],
        )
        .filter(|value| value == "reasoning_content")
        {
            body["reasoning_delta_field"] = json!(reasoning_delta_field);
        }
        if let Some(reasoning_content_compat) = param_boolish(
            parameters,
            &["reasoningContentCompat", "reasoning_content_compat"],
            false,
        ) {
            body["reasoning_content_compat"] = json!(reasoning_content_compat);
        }
    } else if request.connection.provider == "openai" {
        if let Some(service_tier) = param_string(parameters, &["serviceTier", "service_tier"])
            .filter(|value| is_openai_service_tier(value))
        {
            body["service_tier"] = json!(service_tier);
        }
    } else if request.connection.provider == "mistral" {
        if let Some(effort) = mistral_reasoning_effort(request) {
            body["reasoning_effort"] = json!(effort);
        }
        if let Some(safe_prompt) = param_boolish(parameters, &["safePrompt", "safe_prompt"], false)
        {
            body["safe_prompt"] = json!(safe_prompt);
        }
        if let Some(prompt_cache_key) =
            param_string(parameters, &["promptCacheKey", "prompt_cache_key"])
        {
            body["prompt_cache_key"] = json!(prompt_cache_key);
        }
        if let Some(prompt_mode) = param_string(parameters, &["promptMode", "prompt_mode"])
            .filter(|value| value == "reasoning")
        {
            body["prompt_mode"] = json!(prompt_mode);
        }
        if let Some(parallel_tool_calls) = param_boolish(
            parameters,
            &["parallelToolCalls", "parallel_tool_calls"],
            true,
        ) {
            body["parallel_tool_calls"] = json!(parallel_tool_calls);
        }
        if let Some(prediction) = parameters
            .get("prediction")
            .filter(|value| !value.is_null())
        {
            body["prediction"] = prediction.clone();
        }
    }
    if request.connection.provider == "xai" {
        apply_xai_custom_parameters_to_object(
            body,
            parameters,
            !send_sampling,
            !send_sampling,
            &request.connection.model,
            xai_reasoning_active,
        );
    } else {
        apply_custom_parameters_to_object(body, parameters, !send_sampling, !send_sampling, &[]);
    }
    if request.connection.provider == "mistral" {
        if let Some(body) = body.as_object_mut() {
            body.retain(|key, _| !is_mistral_unsupported_custom_parameter_key(key));
        }
    }
    if let Some(openrouter) = parameters
        .get("openrouter")
        .or_else(|| parameters.get("openRouter"))
    {
        if !openrouter.is_null() {
            body["provider"] = openrouter.clone();
        }
    }
    if let Some(tool_choice) = parameters
        .get("toolChoice")
        .or_else(|| parameters.get("tool_choice"))
        .filter(|value| !value.is_null())
    {
        body["tool_choice"] = tool_choice.clone();
    }
}

fn render_claude_subscription_transcript(messages: &[LlmMessage]) -> (Option<String>, String) {
    let mut system = Vec::new();
    let mut turns = Vec::new();
    for message in messages {
        let content = message.content.trim();
        if content.is_empty() {
            continue;
        }
        if message.role == "system" {
            system.push(content.to_string());
            continue;
        }
        let label = if message.role == "assistant" {
            "Assistant"
        } else {
            "User"
        };
        turns.push(format!("{label}: {content}"));
    }
    if turns.is_empty() {
        turns.push("User: [Start]".to_string());
    }
    (
        (!system.is_empty()).then(|| system.join("\n\n")),
        turns.join("\n\n"),
    )
}

struct ClaudeSubscriptionPrompt {
    system_prompt: Option<String>,
    prompt: String,
    session_id: Option<String>,
    prompt_shape: &'static str,
}

fn disabled_env_flag(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "0" | "false" | "no" | "off"
    )
}

fn claude_subscription_resume_enabled() -> bool {
    normalize_env_value(env::var("CLAUDE_SUBSCRIPTION_USE_RESUME").ok())
        .as_deref()
        .map(|value| !disabled_env_flag(value))
        .unwrap_or(true)
}

fn marinara_runtime_metadata(parameters: &Value) -> Option<&serde_json::Map<String, Value>> {
    parameters.get("_marinara")?.as_object()
}

fn claude_subscription_chat_id(parameters: &Value) -> Option<String> {
    marinara_runtime_metadata(parameters)?
        .get("chatId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn claude_subscription_should_use_session(parameters: &Value) -> bool {
    let Some(metadata) = marinara_runtime_metadata(parameters) else {
        return false;
    };
    let regenerate = metadata
        .get("regenerateMessageId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some();
    let impersonate = metadata
        .get("impersonate")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    claude_subscription_resume_enabled() && !regenerate && !impersonate
}

fn claude_subscription_session_id(chat_id: &str) -> String {
    Uuid::new_v5(
        &Uuid::NAMESPACE_URL,
        format!("marinara-engine:claude-subscription:{chat_id}").as_bytes(),
    )
    .to_string()
}

fn claude_subscription_scratch_cwd() -> Option<PathBuf> {
    let dir = env::temp_dir().join("marinara-claude-subscription-scratch");
    fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn render_claude_subscription_history_turn(message: &LlmMessage) -> Option<String> {
    let content = message.content.trim();
    if content.is_empty() && message.images.is_empty() {
        return None;
    }
    let content = if content.is_empty() {
        format!("[{} image attachment(s)]", message.images.len())
    } else {
        content.to_string()
    };
    let label = match message.role.as_str() {
        "assistant" => "Assistant",
        "tool" => "Tool result",
        _ => "User",
    };
    Some(format!("{label}: {content}"))
}

fn render_claude_subscription_history_context(history: &[&LlmMessage]) -> Option<String> {
    let turns = history
        .iter()
        .filter_map(|message| render_claude_subscription_history_turn(message))
        .collect::<Vec<_>>();
    (!turns.is_empty()).then(|| turns.join("\n\n"))
}

fn claude_subscription_session_prompt_with_history(
    history: &[&LlmMessage],
    current_prompt: &str,
    current_label: Option<&str>,
) -> String {
    let Some(history) = render_claude_subscription_history_context(history) else {
        return current_prompt.to_string();
    };
    let current = current_label
        .map(|label| format!("{label}: {current_prompt}"))
        .unwrap_or_else(|| current_prompt.to_string());
    format!("Previous Marinara conversation:\n{history}\n\nCurrent turn:\n{current}")
}

fn render_claude_subscription_current_prompt(
    messages: &[LlmMessage],
) -> (Option<String>, String, &'static str) {
    let mut system = Vec::new();
    let mut non_system = Vec::new();
    for message in messages {
        let content = message.content.trim();
        if content.is_empty() && message.images.is_empty() {
            continue;
        }
        if message.role == "system" {
            if !content.is_empty() {
                system.push(content.to_string());
            }
        } else {
            non_system.push(message);
        }
    }

    let Some(trailing) = non_system.last() else {
        return (
            (!system.is_empty()).then(|| system.join("\n\n")),
            "[Start]".to_string(),
            "synthetic-start",
        );
    };
    if trailing.role == "assistant" {
        let prompt =
            claude_subscription_session_prompt_with_history(&non_system, "(continue)", None);
        return (
            (!system.is_empty()).then(|| system.join("\n\n")),
            prompt,
            "trailing-assistant-continue",
        );
    }
    let history = &non_system[..non_system.len().saturating_sub(1)];
    let current_prompt = if trailing.role == "tool" {
        format!("Tool result: {}", trailing.content.trim())
    } else {
        trailing.content.trim().to_string()
    };
    let prompt = claude_subscription_session_prompt_with_history(
        history,
        &current_prompt,
        (trailing.role != "tool").then_some("User"),
    );
    (
        (!system.is_empty()).then(|| system.join("\n\n")),
        prompt,
        if trailing.role == "tool" {
            "trailing-tool"
        } else {
            "trailing-user"
        },
    )
}

fn claude_subscription_prompt(request: &LlmRequest) -> ClaudeSubscriptionPrompt {
    let messages = request_messages(request);
    if claude_subscription_should_use_session(&request.parameters) {
        if let Some(chat_id) = claude_subscription_chat_id(&request.parameters) {
            let (system_prompt, prompt, prompt_shape) =
                render_claude_subscription_current_prompt(&messages);
            return ClaudeSubscriptionPrompt {
                system_prompt,
                prompt,
                session_id: Some(claude_subscription_session_id(&chat_id)),
                prompt_shape,
            };
        }
    }
    let (system_prompt, prompt) = render_claude_subscription_transcript(&messages);
    ClaudeSubscriptionPrompt {
        system_prompt,
        prompt,
        session_id: None,
        prompt_shape: "transcript-fold",
    }
}

fn claude_subscription_command() -> String {
    env::var("CLAUDE_CODE_COMMAND")
        .or_else(|_| env::var("CLAUDE_COMMAND"))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "claude".to_string())
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ClaudeSubscriptionModelSelection {
    configured_model: String,
    cli_model: String,
    long_context_beta: bool,
}

fn claude_subscription_model_selection(model: &str) -> ClaudeSubscriptionModelSelection {
    let configured_model = model.trim().to_string();
    let Some(base_model) = configured_model
        .strip_suffix(CLAUDE_SUBSCRIPTION_1M_SUFFIX)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return ClaudeSubscriptionModelSelection {
            cli_model: configured_model.clone(),
            configured_model,
            long_context_beta: false,
        };
    };
    let cli_model = base_model.to_string();
    ClaudeSubscriptionModelSelection {
        configured_model,
        cli_model,
        long_context_beta: true,
    }
}

fn claude_subscription_model_args(selection: &ClaudeSubscriptionModelSelection) -> Vec<String> {
    let mut args = vec!["--model".to_string(), selection.cli_model.clone()];
    if selection.long_context_beta {
        args.push("--betas".to_string());
        args.push(CLAUDE_SUBSCRIPTION_1M_BETA.to_string());
    }
    args
}

pub fn check_claude_subscription_available() -> AppResult<String> {
    let command_name = claude_subscription_command();
    let mut command = Command::new(&command_name);
    command
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let output = command.output().map_err(|error| {
        AppError::new(
            "claude_subscription_unavailable",
            format!(
                "Failed to start Claude Code. Install @anthropic-ai/claude-code, run `claude login`, or set CLAUDE_CODE_COMMAND. Underlying error: {error}"
            ),
        )
    })?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::new(
            "claude_subscription_unavailable",
            if stderr.trim().is_empty() {
                "Claude Code is installed but did not respond to --version.".to_string()
            } else {
                stderr.trim().to_string()
            },
        ));
    }
    let session_state = if claude_subscription_resume_enabled() {
        "chat-scoped Claude Code sessions are enabled"
    } else {
        "chat-scoped Claude Code sessions are disabled by CLAUDE_SUBSCRIPTION_USE_RESUME"
    };
    Ok(format!(
        "Claude Code command is available; {session_state}. The first chat will fail if `claude login` has not been run on this host."
    ))
}

fn claude_subscription_text_from_json(value: &Value) -> Option<String> {
    if let Some(text) = value
        .get("result")
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
    {
        return Some(text.to_string());
    }
    if let Some(text) = value
        .get("response")
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
    {
        return Some(text.to_string());
    }
    if let Some(text) = value
        .get("text")
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
    {
        return Some(text.to_string());
    }
    if let Some(message) = value.get("message") {
        if let Some(content) = message.get("content").and_then(Value::as_array) {
            let text = content
                .iter()
                .filter_map(|block| block.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("");
            if !text.trim().is_empty() {
                return Some(text);
            }
        }
    }
    if let Some(content) = value.get("content").and_then(Value::as_array) {
        let text = content
            .iter()
            .filter_map(|block| block.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join("");
        if !text.trim().is_empty() {
            return Some(text);
        }
    }
    None
}

fn claude_subscription_output_diagnostic(value: &Value) -> Option<String> {
    let mut parts = Vec::new();
    if let Some(subtype) = value.get("subtype").and_then(Value::as_str) {
        parts.push(format!("subtype={subtype}"));
    }
    if let Some(fast_mode_state) = value.get("fast_mode_state").and_then(Value::as_str) {
        parts.push(format!("fast_mode_state={fast_mode_state}"));
    }
    if let Some(usage) = value.get("usage").and_then(Value::as_object) {
        if let Some(input_tokens) = usage.get("input_tokens").and_then(Value::as_u64) {
            parts.push(format!("input_tokens={input_tokens}"));
        }
        if let Some(output_tokens) = usage.get("output_tokens").and_then(Value::as_u64) {
            parts.push(format!("output_tokens={output_tokens}"));
        }
    }
    if let Some(model_usage) = value.get("modelUsage").and_then(Value::as_object) {
        let models = model_usage.keys().cloned().collect::<Vec<_>>();
        if !models.is_empty() {
            parts.push(format!("billed_models={}", models.join(",")));
        }
    }
    (!parts.is_empty()).then(|| parts.join(", "))
}

fn claude_subscription_json_declares_empty_result(value: &Value) -> bool {
    let has_result_shape = value.get("result").is_some()
        || value.get("response").is_some()
        || value.get("text").is_some()
        || value.get("message").is_some()
        || value.get("content").is_some();
    has_result_shape && claude_subscription_text_from_json(value).is_none()
}

fn log_claude_subscription_status(value: &Value, requested_model: &str) {
    let used_models = value
        .get("modelUsage")
        .and_then(Value::as_object)
        .map(|models| models.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    let fast_mode_state = value.get("fast_mode_state").and_then(Value::as_str);
    if !used_models.is_empty() && !used_models.iter().any(|model| model == requested_model) {
        eprintln!(
            "[claude-subscription] requested {requested_model} but Claude Code reported billed models {} (fast_mode_state={})",
            used_models.join(","),
            fast_mode_state.unwrap_or("unknown")
        );
    } else if fast_mode_state.is_some_and(|state| state != "off") {
        eprintln!(
            "[claude-subscription] fast_mode_state={} for {requested_model}; output may come from fast-mode routing",
            fast_mode_state.unwrap_or("unknown")
        );
    }
}

fn claude_subscription_usage_from_json(value: &Value) -> Option<Value> {
    let mut usage = value.get("usage").cloned().unwrap_or_else(|| json!({}));
    let Some(usage_object) = usage.as_object_mut() else {
        return Some(usage);
    };
    if let Some(model_usage) = value.get("modelUsage") {
        usage_object.insert("modelUsage".to_string(), model_usage.clone());
    }
    if let Some(fast_mode_state) = value.get("fast_mode_state") {
        usage_object.insert("fastModeState".to_string(), fast_mode_state.clone());
    }
    (!usage_object.is_empty()).then_some(usage)
}

fn claude_subscription_completion_from_json(
    value: &Value,
    requested_model: &str,
) -> Option<LlmCompletion> {
    let content = claude_subscription_text_from_json(value)?;
    log_claude_subscription_status(value, requested_model);
    Some(LlmCompletion {
        content,
        tool_calls: Vec::new(),
        finish_reason: value
            .get("subtype")
            .or_else(|| value.get("finish_reason"))
            .and_then(Value::as_str)
            .map(str::to_string),
        usage: claude_subscription_usage_from_json(value),
        provider_metadata: None,
    })
}

fn parse_claude_subscription_output_rich(
    raw: &str,
    requested_model: &str,
) -> AppResult<LlmCompletion> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(AppError::new(
            "claude_subscription_empty",
            "Claude Code returned an empty response.",
        ));
    }
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if let Some(completion) = claude_subscription_completion_from_json(&value, requested_model)
        {
            return Ok(completion);
        }
        if claude_subscription_json_declares_empty_result(&value) {
            let diagnostic = claude_subscription_output_diagnostic(&value)
                .unwrap_or_else(|| "no diagnostic fields returned".to_string());
            return Err(AppError::with_details(
                "claude_subscription_empty",
                format!("Claude Code returned no content ({diagnostic})."),
                redact_sensitive_json(value),
            ));
        }
    }
    let mut completion = LlmCompletion {
        content: String::new(),
        tool_calls: Vec::new(),
        finish_reason: None,
        usage: None,
        provider_metadata: None,
    };
    let mut empty_result_diagnostic: Option<Value> = None;
    for line in trimmed.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<Value>(line) {
            if let Some(piece) = claude_subscription_completion_from_json(&value, requested_model) {
                completion.content.push_str(&piece.content);
                if piece.finish_reason.is_some() {
                    completion.finish_reason = piece.finish_reason;
                }
                if piece.usage.is_some() {
                    completion.usage = piece.usage;
                }
            } else if claude_subscription_json_declares_empty_result(&value) {
                empty_result_diagnostic = Some(value);
            }
        }
    }
    if !completion.content.trim().is_empty() {
        return Ok(completion);
    }
    if let Some(value) = empty_result_diagnostic {
        let diagnostic = claude_subscription_output_diagnostic(&value)
            .unwrap_or_else(|| "no diagnostic fields returned".to_string());
        return Err(AppError::with_details(
            "claude_subscription_empty",
            format!("Claude Code returned no content ({diagnostic})."),
            redact_sensitive_json(value),
        ));
    }
    Ok(LlmCompletion {
        content: trimmed.to_string(),
        tool_calls: Vec::new(),
        finish_reason: None,
        usage: None,
        provider_metadata: None,
    })
}

fn parse_claude_subscription_json_output(raw: &str) -> Option<Value> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        return Some(value);
    }
    trimmed
        .lines()
        .filter_map(|line| serde_json::from_str::<Value>(line.trim()).ok())
        .next_back()
}

pub fn diagnose_claude_subscription_model(model: &str, fast_mode: bool) -> AppResult<Value> {
    let selection = claude_subscription_model_selection(model);
    if selection.configured_model.is_empty() {
        return Err(AppError::invalid_input(
            "No model configured. Pick a model first.",
        ));
    }
    let started = std::time::Instant::now();
    let mut command = Command::new(claude_subscription_command());
    command
        .arg("-p")
        .arg("--output-format")
        .arg("json")
        .arg("--permission-mode")
        .arg("bypassPermissions")
        .arg("--settings")
        .arg(json!({ "fastMode": fast_mode }).to_string())
        .arg("--tools")
        .arg("")
        .arg("--disable-slash-commands")
        .arg("--no-session-persistence")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    command.args(claude_subscription_model_args(&selection));
    command.env("ENABLE_CLAUDEAI_MCP_SERVERS", "false");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|error| {
        AppError::new(
            "claude_subscription_unavailable",
            format!(
                "Failed to start Claude Code. Install @anthropic-ai/claude-code, run `claude login`, or set CLAUDE_CODE_COMMAND. Underlying error: {error}"
            ),
        )
    })?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(b"Reply with exactly: OK")
            .map_err(|error| AppError::new("claude_subscription_io_error", error.to_string()))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|error| AppError::new("claude_subscription_io_error", error.to_string()))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if !output.status.success() {
        return Err(AppError::with_details(
            "claude_subscription_failed",
            if stderr.trim().is_empty() {
                "Claude Code routing diagnosis failed.".to_string()
            } else {
                redact_sensitive_text(stderr.trim())
            },
            redact_sensitive_json(json!({
                "status": output.status.code(),
                "stdout": stdout.chars().take(1000).collect::<String>(),
            })),
        ));
    }
    let value = parse_claude_subscription_json_output(&stdout).ok_or_else(|| {
        AppError::with_details(
            "claude_subscription_response_error",
            "Claude Code did not return diagnostic JSON.",
            redact_sensitive_json(
                json!({ "stdout": stdout.chars().take(1000).collect::<String>() }),
            ),
        )
    })?;
    let model_usage = value
        .get("modelUsage")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let models_billed = model_usage.keys().cloned().collect::<Vec<_>>();
    let model_usage_detail = model_usage
        .iter()
        .map(|(model, usage)| {
            json!({
                "model": model,
                "inputTokens": usage.get("input_tokens").and_then(Value::as_u64),
                "outputTokens": usage.get("output_tokens").and_then(Value::as_u64),
                "role": if model == &selection.cli_model { "requested" } else { "auxiliary" },
            })
        })
        .collect::<Vec<_>>();
    let response = claude_subscription_text_from_json(&value).unwrap_or_default();
    let downgraded = !model_usage.is_empty() && !model_usage.contains_key(&selection.cli_model);
    Ok(json!({
        "success": !downgraded,
        "requestedModel": selection.cli_model,
        "configuredModel": selection.configured_model,
        "longContextBeta": selection.long_context_beta,
        "modelsBilled": models_billed,
        "modelUsageDetail": model_usage_detail,
        "fastModeState": value.get("fast_mode_state").and_then(Value::as_str),
        "downgraded": downgraded,
        "response": response,
        "latencyMs": started.elapsed().as_millis(),
    }))
}

async fn complete_claude_subscription_rich(request: LlmRequest) -> AppResult<LlmCompletion> {
    let prompt_selection = claude_subscription_prompt(&request);
    let model_selection = claude_subscription_model_selection(&request.connection.model);
    let mut command = Command::new(claude_subscription_command());
    command
        .arg("-p")
        .arg("--output-format")
        .arg("json")
        .arg("--permission-mode")
        .arg("bypassPermissions")
        .arg("--settings")
        .arg(json!({ "fastMode": request.connection.claude_fast_mode }).to_string())
        .arg("--tools")
        .arg("")
        .arg("--disable-slash-commands")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    command.args(claude_subscription_model_args(&model_selection));
    if let Some(system_prompt) = prompt_selection.system_prompt.as_ref() {
        command.arg("--append-system-prompt").arg(system_prompt);
    }
    if let Some(session_id) = prompt_selection.session_id.as_ref() {
        if let Some(cwd) = claude_subscription_scratch_cwd() {
            command.arg("--session-id").arg(session_id);
            command.current_dir(cwd);
        }
    } else {
        command.arg("--no-session-persistence");
    }
    if !request.connection.api_key.trim().is_empty() {
        command.env("ANTHROPIC_API_KEY", request.connection.api_key.trim());
    }
    command.env("ENABLE_CLAUDEAI_MCP_SERVERS", "false");
    log_prompt_connection_request(
        "claude_subscription",
        "claude-code://local",
        &request,
        &json!({
            "model": model_selection.cli_model.clone(),
            "configuredModel": model_selection.configured_model.clone(),
            "longContextBeta": model_selection.long_context_beta,
            "outputFormat": "json",
            "permissionMode": "bypassPermissions",
            "fastMode": request.connection.claude_fast_mode,
            "sessionId": prompt_selection.session_id.as_deref(),
            "promptShape": prompt_selection.prompt_shape
        }),
    );
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command
        .spawn()
        .map_err(|error| {
            AppError::new(
                "claude_subscription_unavailable",
                format!(
                    "Failed to start Claude Code. Install @anthropic-ai/claude-code, run `claude login`, or set CLAUDE_CODE_COMMAND. Underlying error: {error}"
                ),
            )
        })?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt_selection.prompt.as_bytes())
            .map_err(|error| AppError::new("claude_subscription_io_error", error.to_string()))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|error| AppError::new("claude_subscription_io_error", error.to_string()))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if !output.status.success() {
        return Err(AppError::with_details(
            "claude_subscription_failed",
            if stderr.trim().is_empty() {
                "Claude Code request failed.".to_string()
            } else {
                redact_sensitive_text(stderr.trim())
            },
            redact_sensitive_json(json!({
                "status": output.status.code(),
                "stdout": stdout.chars().take(1000).collect::<String>(),
            })),
        ));
    }
    parse_claude_subscription_output_rich(&stdout, &model_selection.cli_model)
}

fn build_anthropic_body(request: &LlmRequest, stream: bool) -> Value {
    let mut system = Vec::new();
    let mut anthropic_messages = Vec::new();
    let messages = request_messages(request);
    for message in messages {
        if message.role == "system" {
            system.push(message.content);
        } else {
            let role = if message.role == "assistant" {
                "assistant"
            } else {
                "user"
            };
            if message.images.is_empty() {
                anthropic_messages.push(json!({ "role": role, "content": message.content }));
            } else {
                let mut content = Vec::new();
                if !message.content.is_empty() {
                    content.push(json!({ "type": "text", "text": message.content }));
                }
                for image in &message.images {
                    if let Some((media_type, data)) = data_url_image(image) {
                        content.push(json!({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": data
                            }
                        }));
                    }
                }
                anthropic_messages.push(json!({ "role": role, "content": content }));
            }
        }
    }
    let mut body = json!({
        "model": request.connection.model,
        "messages": anthropic_messages,
        "max_tokens": request_max_tokens(request, 1024),
    });
    if stream {
        body["stream"] = json!(true);
    }
    if !system.is_empty() {
        body["system"] = json!(system.join("\n\n"));
    }
    let sampling_restricted = is_anthropic_sampling_restricted_model(&request.connection.model);
    let thinking_effort = anthropic_thinking_effort(&request.connection.model, &request.parameters);
    let adaptive_thinking = should_use_anthropic_adaptive_thinking(
        &request.connection.model,
        &request.parameters,
        thinking_effort,
    );
    let send_temperature_and_top_k = !sampling_restricted && !adaptive_thinking;
    if send_temperature_and_top_k {
        if let Some(temp) = temperature(&request.parameters) {
            body["temperature"] = json!(temp);
        }
    }
    if !sampling_restricted {
        if let Some(top_p) = param_f64(&request.parameters, &["topP", "top_p"]) {
            if !adaptive_thinking || top_p >= 0.95 {
                body["top_p"] = json!(top_p);
            }
        }
    }
    if send_temperature_and_top_k {
        if let Some(top_k) = param_i64(&request.parameters, &["topK", "top_k"]) {
            body["top_k"] = json!(top_k);
        }
    }
    if adaptive_thinking {
        body["thinking"] = json!({ "type": "adaptive", "display": "summarized" });
        if let Some(effort) = thinking_effort {
            body["output_config"] = json!({ "effort": effort });
        }
    } else if let Some(effort) = thinking_effort {
        let budget_tokens = anthropic_thinking_budget_tokens(effort);
        body["thinking"] = json!({ "type": "enabled", "budget_tokens": budget_tokens });
        body["max_tokens"] = json!(request_max_tokens(request, 1024) + budget_tokens);
    }
    if let Some(service_tier) = param_string(&request.parameters, &["serviceTier", "service_tier"])
        .filter(|value| is_anthropic_service_tier(value))
    {
        body["service_tier"] = json!(service_tier);
    }
    if let Some(stop) = stop_sequences(&request.parameters) {
        body["stop_sequences"] = json!(stop);
    }
    apply_custom_parameters_to_object(
        &mut body,
        &request.parameters,
        sampling_restricted || adaptive_thinking,
        false,
        &[],
    );
    body
}

async fn anthropic_request(
    request: &LlmRequest,
    body: &Value,
    kind: &str,
) -> AppResult<reqwest::Response> {
    let base = base_url(&request.connection.provider, &request.connection.base_url);
    let url = anthropic_endpoint(&base, "messages");
    log_prompt_connection_request(kind, &url, request, body);
    send_provider_request(
        provider_http_client_for_url(&url)
            .await?
            .post(url)
            .header("x-api-key", request.connection.api_key.trim())
            .header("anthropic-version", "2023-06-01")
            .json(body),
    )
    .await
}

async fn complete_anthropic_rich(request: LlmRequest) -> AppResult<LlmCompletion> {
    let body = build_anthropic_body(&request, false);
    let response = anthropic_request(&request, &body, "anthropic.messages").await?;
    let (status, json) = read_json_response(response).await?;
    if !status.is_success() {
        return Err(provider_http_error(status, json));
    }
    let content = json
        .get("content")
        .and_then(Value::as_array)
        .and_then(|items| {
            items
                .iter()
                .filter_map(|item| item.get("text").and_then(Value::as_str))
                .find(|text| !text.trim().is_empty())
        })
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            AppError::with_details(
                "llm_response_error",
                "Provider response did not contain assistant text",
                redact_sensitive_json(json.clone()),
            )
        })?;
    Ok(LlmCompletion {
        content,
        tool_calls: Vec::new(),
        finish_reason: json
            .get("stop_reason")
            .and_then(Value::as_str)
            .map(str::to_string),
        usage: json.get("usage").cloned(),
        provider_metadata: None,
    })
}

async fn stream_anthropic(
    request: LlmRequest,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    let body = build_anthropic_body(&request, true);
    let response = anthropic_request(&request, &body, "anthropic.messages.stream").await?;
    let status = response.status();
    if !status.is_success() {
        let error_body = read_error_response_details(response).await?;
        return Err(provider_http_error(status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut decoder = Utf8StreamDecoder::default();
    let mut completed = false;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| {
            AppError::new("llm_stream_error", provider_transport_error_message(error))
        })?;
        decoder.push_chunk(&chunk, &mut buffer);
        while let Some(block) = take_sse_block(&mut buffer) {
            if process_anthropic_sse_block(&block, emit)? == SseBlockStatus::Complete {
                completed = true;
                break;
            }
        }
        if completed {
            break;
        }
    }
    if !completed {
        decoder.finish(&mut buffer);
    }
    if !completed && !buffer.trim().is_empty() {
        process_anthropic_sse_block(&buffer, emit)?;
    }
    Ok(())
}

fn emit_anthropic_usage(
    value: &Value,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    if let Some(usage) = value
        .get("usage")
        .or_else(|| value.pointer("/message/usage"))
        .or_else(|| value.pointer("/delta/usage"))
    {
        emit(json!({ "type": "usage", "data": usage }))?;
    }
    Ok(())
}

fn emit_anthropic_token(
    text: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    if !text.is_empty() {
        emit(json!({ "type": "token", "text": text, "data": text }))?;
    }
    Ok(())
}

fn emit_anthropic_thinking(
    thinking: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    if !thinking.is_empty() {
        emit(json!({ "type": "thinking", "text": thinking, "data": thinking }))?;
    }
    Ok(())
}

fn process_anthropic_sse_block(
    block: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<SseBlockStatus> {
    let event_name = block
        .lines()
        .find_map(|line| line.trim_start().strip_prefix("event:"))
        .map(str::trim)
        .unwrap_or("");
    let payload = block
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix("data:"))
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n");
    if payload.is_empty() {
        return Ok(SseBlockStatus::Continue);
    }
    if payload == "[DONE]" {
        return Ok(SseBlockStatus::Complete);
    }
    let value: Value = serde_json::from_str(&payload)
        .map_err(|error| AppError::new("llm_stream_parse_error", error.to_string()))?;
    let event_type = value
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or(event_name);
    match event_type {
        "message_start" | "message_delta" => {
            emit_anthropic_usage(&value, emit)?;
        }
        "content_block_start" => {
            if let Some(block) = value.get("content_block") {
                match block.get("type").and_then(Value::as_str) {
                    Some("text") => {
                        if let Some(text) = block.get("text").and_then(Value::as_str) {
                            emit_anthropic_token(text, emit)?;
                        }
                    }
                    Some("thinking") => {
                        if let Some(thinking) = block.get("thinking").and_then(Value::as_str) {
                            emit_anthropic_thinking(thinking, emit)?;
                        }
                    }
                    _ => {}
                }
            }
        }
        "content_block_delta" => {
            if let Some(delta) = value.get("delta") {
                match delta.get("type").and_then(Value::as_str) {
                    Some("text_delta") => {
                        if let Some(text) = delta.get("text").and_then(Value::as_str) {
                            emit_anthropic_token(text, emit)?;
                        }
                    }
                    Some("thinking_delta") => {
                        if let Some(thinking) = delta
                            .get("thinking")
                            .or_else(|| delta.get("text"))
                            .and_then(Value::as_str)
                        {
                            emit_anthropic_thinking(thinking, emit)?;
                        }
                    }
                    _ => {
                        if let Some(thinking) = delta.get("thinking").and_then(Value::as_str) {
                            emit_anthropic_thinking(thinking, emit)?;
                        }
                    }
                }
            }
        }
        "error" => {
            let error = value.get("error").cloned().unwrap_or(value);
            return Err(AppError::with_details(
                "llm_provider_error",
                "Anthropic stream error",
                redact_sensitive_json(error),
            ));
        }
        "message_stop" => return Ok(SseBlockStatus::Complete),
        _ => {}
    }
    Ok(SseBlockStatus::Continue)
}

fn anthropic_endpoint(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    if base.ends_with("/v1") {
        format!("{base}/{path}")
    } else {
        format!("{base}/v1/{path}")
    }
}

fn google_vertex_endpoint(base: &str, model: &str, endpoint: &str) -> String {
    let base = base
        .trim_end_matches('/')
        .trim_end_matches("/publishers/google/models")
        .to_string();
    format!("{base}/publishers/google/models/{model}:{endpoint}")
}

#[derive(Debug, Clone)]
struct GoogleServiceAccountKey {
    client_email: String,
    private_key: String,
    private_key_id: Option<String>,
    token_uri: String,
}

fn google_vertex_token_cache() -> &'static Mutex<BTreeMap<String, GoogleVertexCachedToken>> {
    GOOGLE_VERTEX_TOKEN_CACHE.get_or_init(|| Mutex::new(BTreeMap::new()))
}

fn parse_google_service_account_key(
    credential: &str,
) -> AppResult<Option<GoogleServiceAccountKey>> {
    let trimmed = credential.trim();
    if !trimmed.starts_with('{') {
        return Ok(None);
    }
    let value = serde_json::from_str::<Value>(trimmed).map_err(|error| {
        AppError::invalid_input(format!(
            "Google Vertex service account credential is invalid JSON: {error}"
        ))
    })?;
    let client_email = value
        .get("client_email")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            AppError::invalid_input(
                "Google Vertex service account credential is missing client_email",
            )
        })?
        .to_string();
    let private_key = value
        .get("private_key")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            AppError::invalid_input(
                "Google Vertex service account credential is missing private_key",
            )
        })?
        .replace("\\n", "\n");
    let private_key_id = value
        .get("private_key_id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let token_uri = value
        .get("token_uri")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(GOOGLE_OAUTH_TOKEN_URL)
        .to_string();
    Ok(Some(GoogleServiceAccountKey {
        client_email,
        private_key,
        private_key_id,
        token_uri,
    }))
}

fn looks_like_google_bearer_token(credential: &str) -> bool {
    let credential = credential.trim();
    credential.starts_with("ya29.")
        || credential.split('.').count() == 3
            && credential
                .chars()
                .all(|item| item.is_ascii_alphanumeric() || matches!(item, '-' | '_' | '.'))
}

fn google_vertex_cache_key(service_account: &GoogleServiceAccountKey) -> String {
    format!(
        "{}:{}:{}",
        service_account.client_email,
        service_account.token_uri,
        service_account.private_key_id.as_deref().unwrap_or("")
    )
}

fn cached_google_vertex_access_token(cache_key: &str) -> Option<String> {
    let now = Utc::now().timestamp();
    let cache = google_vertex_token_cache().lock().ok()?;
    cache
        .get(cache_key)
        .filter(|token| token.expires_at - now > GOOGLE_VERTEX_TOKEN_REFRESH_SKEW_SECONDS)
        .map(|token| token.access_token.clone())
}

fn store_google_vertex_access_token(cache_key: String, access_token: String, expires_in: i64) {
    let expires_in = expires_in.max(60);
    let token = GoogleVertexCachedToken {
        access_token,
        expires_at: Utc::now().timestamp() + expires_in,
    };
    if let Ok(mut cache) = google_vertex_token_cache().lock() {
        cache.insert(cache_key, token);
    }
}

fn base64_url_json(value: &Value) -> AppResult<String> {
    let serialized = serde_json::to_vec(value)
        .map_err(|error| AppError::new("google_vertex_auth_error", error.to_string()))?;
    Ok(general_purpose::URL_SAFE_NO_PAD.encode(serialized))
}

fn google_service_account_private_key_der(private_key: &str) -> AppResult<Vec<u8>> {
    let pem_body = private_key
        .replace("\\n", "\n")
        .lines()
        .map(str::trim)
        .filter(|line| !line.starts_with("-----"))
        .collect::<String>();
    general_purpose::STANDARD.decode(pem_body).map_err(|_| {
        AppError::invalid_input(
            "Google Vertex service account private_key is not a valid PEM private key",
        )
    })
}

fn sign_google_service_account_jwt(service_account: &GoogleServiceAccountKey) -> AppResult<String> {
    let mut header = json!({ "alg": "RS256", "typ": "JWT" });
    if let Some(private_key_id) = service_account.private_key_id.as_deref() {
        header["kid"] = json!(private_key_id);
    }
    let now = Utc::now().timestamp();
    let claims = json!({
        "iss": service_account.client_email,
        "scope": GOOGLE_CLOUD_PLATFORM_SCOPE,
        "aud": service_account.token_uri,
        "exp": now + 3600,
        "iat": now,
    });
    let unsigned_jwt = format!(
        "{}.{}",
        base64_url_json(&header)?,
        base64_url_json(&claims)?
    );
    let der = google_service_account_private_key_der(&service_account.private_key)?;
    let key_pair = ring::rsa::KeyPair::from_pkcs8(&der)
        .or_else(|_| ring::rsa::KeyPair::from_der(&der))
        .map_err(|_| {
            AppError::invalid_input(
                "Google Vertex service account private_key could not be used for RS256 signing",
            )
        })?;
    let rng = ring::rand::SystemRandom::new();
    let mut signature_bytes = vec![0; key_pair.public().modulus_len()];
    key_pair
        .sign(
            &ring::signature::RSA_PKCS1_SHA256,
            &rng,
            unsigned_jwt.as_bytes(),
            &mut signature_bytes,
        )
        .map_err(|_| {
            AppError::new(
                "google_vertex_auth_error",
                "Failed to sign Google Vertex service account JWT",
            )
        })?;
    Ok(format!(
        "{unsigned_jwt}.{}",
        general_purpose::URL_SAFE_NO_PAD.encode(signature_bytes)
    ))
}

fn google_vertex_auth_error(status: reqwest::StatusCode, details: Value) -> AppError {
    let details = redact_sensitive_json(details);
    let message = provider_error_text(&details)
        .map(|detail| format!("Google Vertex service account auth failed HTTP {status}: {detail}"))
        .unwrap_or_else(|| format!("Google Vertex service account auth failed HTTP {status}"));
    AppError::with_details("google_vertex_auth_error", message, details)
}

async fn fetch_google_vertex_access_token(
    service_account: &GoogleServiceAccountKey,
) -> AppResult<String> {
    let cache_key = google_vertex_cache_key(service_account);
    if let Some(access_token) = cached_google_vertex_access_token(&cache_key) {
        return Ok(access_token);
    }
    let assertion = sign_google_service_account_jwt(service_account)?;
    let response = send_provider_request_with_error_code(
        provider_http_client_for_url(&service_account.token_uri)
            .await?
            .post(&service_account.token_uri)
            .form(&[
                ("grant_type", GOOGLE_JWT_BEARER_GRANT_TYPE),
                ("assertion", assertion.as_str()),
            ]),
        "google_vertex_auth_network_error",
    )
    .await?;
    let (status, json) = read_json_response(response).await?;
    if !status.is_success() {
        return Err(google_vertex_auth_error(status, json));
    }
    let access_token = json
        .get("access_token")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            AppError::with_details(
                "google_vertex_auth_error",
                "Google Vertex service account auth response did not contain access_token",
                redact_sensitive_json(json.clone()),
            )
        })?
        .to_string();
    let expires_in = json
        .get("expires_in")
        .and_then(Value::as_i64)
        .unwrap_or(3600);
    store_google_vertex_access_token(cache_key, access_token.clone(), expires_in);
    Ok(access_token)
}

pub async fn google_vertex_auth_headers_for_credential(
    credential: &str,
) -> AppResult<BTreeMap<String, String>> {
    let credential = credential.trim();
    let mut headers = BTreeMap::new();
    if credential.is_empty() {
        return Ok(headers);
    }
    if let Some(service_account) = parse_google_service_account_key(credential)? {
        let access_token = fetch_google_vertex_access_token(&service_account).await?;
        headers.insert(
            "Authorization".to_string(),
            format!("Bearer {access_token}"),
        );
    } else if looks_like_google_bearer_token(credential) {
        headers.insert("Authorization".to_string(), format!("Bearer {credential}"));
    } else {
        headers.insert("x-goog-api-key".to_string(), credential.to_string());
    }
    Ok(headers)
}

async fn apply_google_vertex_auth_headers(
    mut request: reqwest::RequestBuilder,
    credential: &str,
) -> AppResult<reqwest::RequestBuilder> {
    for (name, value) in google_vertex_auth_headers_for_credential(credential).await? {
        request = request.header(name, value);
    }
    Ok(request)
}

fn normalize_google_base_url(base: String) -> String {
    let trimmed = base.trim_end_matches('/').to_string();
    let Ok(mut url) = reqwest::Url::parse(&trimmed) else {
        return trimmed;
    };
    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
    if matches!(
        host.as_str(),
        "linkapi.ai" | "www.linkapi.ai" | "home.linkapi.ai"
    ) && url.set_host(Some("api.linkapi.ai")).is_ok()
    {
        return url.to_string().trim_end_matches('/').to_string();
    }
    trimmed
}

fn google_api_base(request: &LlmRequest) -> String {
    let base = normalize_google_base_url(base_url(
        &request.connection.provider,
        &request.connection.base_url,
    ));
    if request.connection.provider == "google"
        && (base.ends_with("/v1beta") || base.ends_with("/v1"))
    {
        base
    } else if request.connection.provider == "google" {
        format!("{base}/v1beta")
    } else {
        base
    }
}

fn google_endpoint(request: &LlmRequest, endpoint: &str, streaming: bool) -> String {
    let base = google_api_base(request);
    let url = if request.connection.provider == "google_vertex" {
        google_vertex_endpoint(&base, &request.connection.model, endpoint)
    } else {
        format!(
            "{base}/models/{}:{}?key={}",
            request.connection.model,
            endpoint,
            request.connection.api_key.trim()
        )
    };
    if streaming {
        let separator = if url.contains('?') { '&' } else { '?' };
        format!("{url}{separator}alt=sse")
    } else {
        url
    }
}

fn google_contents(request: &LlmRequest) -> Vec<Value> {
    let contents: Vec<Value> = request_messages(request)
        .into_iter()
        .filter(|message| message.role != "system")
        .filter_map(|message| {
            let role = if message.role == "assistant" {
                "model"
            } else {
                "user"
            };
            let mut parts = Vec::new();
            if !message.content.is_empty() {
                parts.push(json!({ "text": message.content }));
            }
            for image in &message.images {
                if let Some((mime_type, data)) = data_url_image(image) {
                    parts.push(json!({ "inlineData": { "mimeType": mime_type, "data": data } }));
                }
            }
            (!parts.is_empty()).then(|| json!({ "role": role, "parts": parts }))
        })
        .collect();
    if contents.is_empty() {
        vec![json!({ "role": "user", "parts": [{ "text": "Continue." }] })]
    } else {
        contents
    }
}

fn google_system_instruction(request: &LlmRequest) -> Option<Value> {
    let system = request_messages(request)
        .into_iter()
        .filter(|message| message.role == "system")
        .map(|message| message.content.trim().to_string())
        .filter(|content| !content.is_empty())
        .collect::<Vec<_>>();
    (!system.is_empty()).then(|| json!({ "parts": [{ "text": system.join("\n\n") }] }))
}

fn google_generation_config(request: &LlmRequest) -> Value {
    let is_gemini_3 = is_gemini_3_model(&request.connection.model);
    let mut generation_config = json!({
        "maxOutputTokens": request_max_tokens(request, 1024),
    });
    if !is_gemini_3 {
        generation_config["temperature"] = json!(temperature(&request.parameters).unwrap_or(0.7));
        if let Some(top_p) = param_f64(&request.parameters, &["topP", "top_p"]) {
            generation_config["topP"] = json!(top_p);
        }
        if let Some(top_k) =
            param_i64(&request.parameters, &["topK", "top_k"]).filter(|value| *value > 0)
        {
            generation_config["topK"] = json!(top_k);
        }
    }
    if let Some(frequency_penalty) = param_f64(
        &request.parameters,
        &["frequencyPenalty", "frequency_penalty"],
    ) {
        generation_config["frequencyPenalty"] = json!(frequency_penalty);
    }
    if let Some(presence_penalty) = param_f64(
        &request.parameters,
        &["presencePenalty", "presence_penalty"],
    ) {
        generation_config["presencePenalty"] = json!(presence_penalty);
    }
    if let Some(thinking_config) =
        google_thinking_config(&request.connection.model, &request.parameters)
    {
        generation_config["thinkingConfig"] = thinking_config;
    }
    if let Some(stop) = stop_sequences(&request.parameters) {
        generation_config["stopSequences"] = json!(stop);
    }
    if let Some(entries) = request
        .parameters
        .get("customParameters")
        .or_else(|| request.parameters.get("custom_params"))
        .and_then(Value::as_object)
    {
        if let Some(custom_generation_config) =
            entries.get("generationConfig").and_then(Value::as_object)
        {
            for (key, value) in custom_generation_config {
                if should_apply_custom_parameter(key, false, false, &[])
                    && !(is_gemini_3 && is_google_gemini_3_unsupported_generation_config_key(key))
                {
                    if let Some(config) = generation_config.as_object_mut() {
                        if !config.contains_key(key) {
                            config.insert(key.clone(), value.clone());
                        }
                    }
                }
            }
        }
        for (key, value) in entries {
            if key == "generationConfig"
                || !is_google_generation_config_custom_parameter_key(key)
                || !should_apply_custom_parameter(key, false, false, &[])
                || is_gemini_3 && is_google_gemini_3_unsupported_generation_config_key(key)
            {
                continue;
            }
            if let Some(config) = generation_config.as_object_mut() {
                if !config.contains_key(key) {
                    config.insert(key.clone(), value.clone());
                }
            }
        }
    }
    if is_gemini_3 {
        if let Some(config) = generation_config.as_object_mut() {
            config.retain(|key, _| !is_google_gemini_3_unsupported_generation_config_key(key));
        }
    }
    generation_config
}

fn apply_google_custom_parameters_to_body(body: &mut Value, request: &LlmRequest) {
    let Some(entries) = request
        .parameters
        .get("customParameters")
        .or_else(|| request.parameters.get("custom_params"))
        .and_then(Value::as_object)
    else {
        return;
    };
    let Some(body) = body.as_object_mut() else {
        return;
    };
    for (key, value) in entries {
        if key == "generationConfig"
            || is_google_generation_config_custom_parameter_key(key)
            || !should_apply_custom_parameter(key, false, false, &[])
        {
            continue;
        }
        if !body.contains_key(key) {
            body.insert(key.clone(), value.clone());
        }
    }
}

fn google_generate_body(request: &LlmRequest) -> Value {
    let mut body = json!({
        "contents": google_contents(request),
        "generationConfig": google_generation_config(request),
    });
    if let Some(system_instruction) = google_system_instruction(request) {
        body["systemInstruction"] = system_instruction;
    }
    apply_google_custom_parameters_to_body(&mut body, request);
    body
}

async fn complete_google_rich(request: LlmRequest) -> AppResult<LlmCompletion> {
    let url = google_endpoint(&request, "generateContent", false);
    let body = google_generate_body(&request);
    log_prompt_connection_request("google.generateContent", &url, &request, &body);
    let mut request_builder = provider_http_client_for_url(&url)
        .await?
        .post(url)
        .json(&body);
    if request.connection.provider == "google_vertex" {
        request_builder =
            apply_google_vertex_auth_headers(request_builder, &request.connection.api_key).await?;
    }
    let response = send_provider_request(request_builder).await?;
    let (status, json) = read_json_response(response).await?;
    if !status.is_success() {
        return Err(provider_http_error(status, json));
    }
    let candidate = json
        .get("candidates")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .ok_or_else(|| {
            AppError::with_details(
                "llm_response_error",
                "Provider response did not contain a completion candidate",
                redact_sensitive_json(json.clone()),
            )
        })?;
    let content = candidate
        .get("content")
        .and_then(|content| content.get("parts"))
        .and_then(Value::as_array)
        .and_then(|parts| {
            parts.iter().find_map(|part| {
                if part
                    .get("thought")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                {
                    None
                } else {
                    part.get("text").and_then(Value::as_str)
                }
            })
        })
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            AppError::with_details(
                "llm_response_error",
                "Provider response did not contain assistant text",
                redact_sensitive_json(json.clone()),
            )
        })?;
    Ok(LlmCompletion {
        content,
        tool_calls: Vec::new(),
        finish_reason: candidate
            .get("finishReason")
            .and_then(Value::as_str)
            .map(str::to_string),
        usage: json.get("usageMetadata").cloned(),
        provider_metadata: None,
    })
}

async fn stream_google(
    request: LlmRequest,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    let url = google_endpoint(&request, "streamGenerateContent", true);
    let body = google_generate_body(&request);
    log_prompt_connection_request("google.streamGenerateContent", &url, &request, &body);
    let mut request_builder = provider_http_client_for_url(&url)
        .await?
        .post(url)
        .json(&body);
    if request.connection.provider == "google_vertex" {
        request_builder =
            apply_google_vertex_auth_headers(request_builder, &request.connection.api_key).await?;
    }
    let response = send_provider_request(request_builder).await?;
    let status = response.status();
    if !status.is_success() {
        let error_body = read_error_response_details(response).await?;
        return Err(provider_http_error(status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut decoder = Utf8StreamDecoder::default();
    let mut completed = false;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| {
            AppError::new("llm_stream_error", provider_transport_error_message(error))
        })?;
        decoder.push_chunk(&chunk, &mut buffer);
        while let Some(block) = take_sse_block(&mut buffer) {
            if process_google_sse_block(&block, emit)? == SseBlockStatus::Complete {
                completed = true;
                break;
            }
        }
        if completed {
            break;
        }
    }
    if !completed {
        decoder.finish(&mut buffer);
    }
    if !completed
        && !buffer.trim().is_empty()
        && process_google_sse_block(&buffer, emit)? == SseBlockStatus::Complete
    {
        completed = true;
    }
    ensure_google_stream_completed(completed)
}

fn ensure_google_stream_completed(completed: bool) -> AppResult<()> {
    if completed {
        return Ok(());
    }
    Err(AppError::new(
        "llm_stream_incomplete",
        "Google/Gemini stream ended before Gemini sent a finish reason. The provider response may be incomplete; retry the request.",
    ))
}

fn process_google_sse_block(
    block: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<SseBlockStatus> {
    let payload = block
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix("data:"))
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n");
    if payload.is_empty() {
        return Ok(SseBlockStatus::Continue);
    }
    if payload == "[DONE]" {
        return Ok(SseBlockStatus::Complete);
    }
    let value: Value = serde_json::from_str(&payload)
        .map_err(|error| AppError::new("llm_stream_parse_error", error.to_string()))?;
    if let Some(error) = value.get("error") {
        return Err(AppError::with_details(
            "llm_provider_error",
            "Gemini API stream error",
            redact_sensitive_json(error.clone()),
        ));
    }
    if let Some(usage) = value.get("usageMetadata") {
        emit(json!({ "type": "usage", "data": usage }))?;
    }
    let Some(candidates) = value.get("candidates").and_then(Value::as_array) else {
        return Ok(SseBlockStatus::Continue);
    };
    for candidate in candidates {
        if let Some(parts) = candidate
            .get("content")
            .and_then(|content| content.get("parts"))
            .and_then(Value::as_array)
        {
            for part in parts {
                let Some(text) = part
                    .get("text")
                    .and_then(Value::as_str)
                    .filter(|text| !text.is_empty())
                else {
                    continue;
                };
                if part
                    .get("thought")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                {
                    emit(json!({ "type": "thinking", "text": text, "data": text }))?;
                } else {
                    emit(json!({ "type": "token", "text": text, "data": text }))?;
                }
            }
        }
        if let Some(reason) = candidate
            .get("finishReason")
            .and_then(Value::as_str)
            .filter(|reason| !reason.is_empty())
        {
            ensure_google_finish_reason_allows_complete(reason)?;
            return Ok(SseBlockStatus::Complete);
        }
    }
    Ok(SseBlockStatus::Continue)
}

fn ensure_google_finish_reason_allows_complete(reason: &str) -> AppResult<()> {
    if reason.eq_ignore_ascii_case("STOP") {
        return Ok(());
    }
    Err(AppError::new(
        "llm_stream_incomplete",
        format!(
            "Google/Gemini stopped before completing the response (finishReason: {reason}). The provider response may be incomplete; retry the request."
        ),
    ))
}

async fn read_error_response_details(response: reqwest::Response) -> AppResult<Value> {
    let text = read_capped_provider_error_text(response).await?;
    Ok(provider_error_details_from_text(&text))
}

async fn read_json_response(
    response: reqwest::Response,
) -> AppResult<(reqwest::StatusCode, Value)> {
    let status = response.status();
    if !status.is_success() {
        let text = read_capped_provider_error_text(response).await?;
        return Ok((status, provider_error_details_from_text(&text)));
    }
    let text = read_limited_provider_text(response).await?;
    let json = serde_json::from_str::<Value>(&text).map_err(|error| {
        AppError::with_details(
            "llm_response_error",
            format!("Provider response was not valid JSON: {error}"),
            json!({ "body": sanitize_provider_error_text(&text) }),
        )
    })?;
    Ok((status, json))
}

async fn read_limited_provider_text(mut response: reqwest::Response) -> AppResult<String> {
    if response
        .content_length()
        .is_some_and(|length| length > PROVIDER_RESPONSE_MAX_BYTES as u64)
    {
        return Err(provider_response_too_large_error());
    }

    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| {
        AppError::new(
            "llm_response_error",
            provider_transport_error_message(error),
        )
    })? {
        if body.len().saturating_add(chunk.len()) > PROVIDER_RESPONSE_MAX_BYTES {
            return Err(provider_response_too_large_error());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&body).into_owned())
}

async fn read_capped_provider_error_text(mut response: reqwest::Response) -> AppResult<String> {
    let mut body = Vec::new();
    let mut truncated = false;

    while let Some(chunk) = response.chunk().await.map_err(|error| {
        AppError::new(
            "llm_response_error",
            provider_transport_error_message(error),
        )
    })? {
        let remaining = PROVIDER_RESPONSE_MAX_BYTES.saturating_sub(body.len());
        if chunk.len() > remaining {
            body.extend_from_slice(&chunk[..remaining]);
            truncated = true;
            break;
        }
        body.extend_from_slice(&chunk);
    }

    let mut text = String::from_utf8_lossy(&body).into_owned();
    if truncated {
        text.push_str(" [truncated]");
    }
    Ok(text)
}

fn provider_response_too_large_error() -> AppError {
    AppError::new(
        "llm_response_error",
        format!("Provider response exceeds {PROVIDER_RESPONSE_MAX_BYTES} bytes"),
    )
}

async fn parse_json_response<F>(response: reqwest::Response, extract: F) -> AppResult<String>
where
    F: Fn(&Value) -> Option<String>,
{
    let (status, json) = read_json_response(response).await?;
    if !status.is_success() {
        return Err(provider_http_error(status, json));
    }
    extract(&json).ok_or_else(|| {
        AppError::with_details(
            "llm_response_error",
            "Provider response did not contain assistant text",
            redact_sensitive_json(json),
        )
    })
}

fn content_part_text(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }
    if value.get("type").and_then(Value::as_str) == Some("thinking") {
        return None;
    }
    value
        .get("text")
        .and_then(Value::as_str)
        .or_else(|| value.get("content").and_then(Value::as_str))
        .map(str::to_string)
}

fn content_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Array(parts) => parts
            .iter()
            .filter_map(content_part_text)
            .collect::<Vec<_>>()
            .join(""),
        Value::Object(_) => content_part_text(value).unwrap_or_default(),
        _ => String::new(),
    }
}

fn content_thinking_text(value: &Value) -> String {
    match value {
        Value::Array(parts) => parts
            .iter()
            .map(content_thinking_text)
            .filter(|text| !text.trim().is_empty())
            .collect::<Vec<_>>()
            .join(""),
        Value::Object(_) if value.get("type").and_then(Value::as_str) == Some("thinking") => value
            .get("thinking")
            .map(content_text)
            .filter(|text| !text.trim().is_empty())
            .or_else(|| {
                value
                    .get("text")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .unwrap_or_default(),
        _ => String::new(),
    }
}

fn assistant_message_text(message: &Value) -> String {
    let content = message.get("content").map(content_text).unwrap_or_default();
    if !content.trim().is_empty() {
        return content;
    }
    message
        .get("refusal")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

fn response_reasoning_text(choice: &Value, message: &Value) -> String {
    if let Some(content_reasoning) = message
        .get("content")
        .map(content_thinking_text)
        .filter(|text| !text.trim().is_empty())
    {
        return content_reasoning;
    }
    [
        message.get("reasoning"),
        message.get("reasoning_content"),
        message.get("thinking"),
        choice.get("reasoning"),
        choice.get("reasoning_content"),
    ]
    .into_iter()
    .flatten()
    .map(content_text)
    .find(|text| !text.trim().is_empty())
    .unwrap_or_default()
}

async fn parse_cohere_response_rich(response: reqwest::Response) -> AppResult<LlmCompletion> {
    let (status, json) = read_json_response(response).await?;
    if !status.is_success() {
        return Err(provider_http_error(status, json));
    }
    let message = json.get("message").unwrap_or(&json);
    let content = assistant_message_text(message);
    let tool_calls = message
        .get("tool_calls")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(normalize_tool_call)
        .collect::<Vec<_>>();
    if content.trim().is_empty() && tool_calls.is_empty() {
        let reasoning = message
            .get("content")
            .map(content_thinking_text)
            .filter(|text| !text.trim().is_empty())
            .unwrap_or_default();
        if !reasoning.trim().is_empty() {
            return Err(AppError::with_details(
                "llm_response_error",
                "Provider returned reasoning but no final assistant text. Increase Max Output Tokens or lower Reasoning Effort in this connection's generation controls.",
                redact_sensitive_json(json),
            ));
        }
        return Err(AppError::with_details(
            "llm_response_error",
            "Provider response did not contain assistant text or tool calls",
            redact_sensitive_json(json),
        ));
    }
    Ok(LlmCompletion {
        content,
        tool_calls,
        finish_reason: message
            .get("finish_reason")
            .or_else(|| json.get("finish_reason"))
            .and_then(Value::as_str)
            .map(str::to_string),
        usage: json.get("usage").cloned(),
        provider_metadata: None,
    })
}

async fn parse_json_response_rich(response: reqwest::Response) -> AppResult<LlmCompletion> {
    let (status, json) = read_json_response(response).await?;
    if !status.is_success() {
        return Err(provider_http_error(status, json));
    }
    let choice = json
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
        .ok_or_else(|| {
            AppError::with_details(
                "llm_response_error",
                "Provider response did not contain a completion choice",
                redact_sensitive_json(json.clone()),
            )
        })?;
    let message = choice.get("message").unwrap_or(choice);
    let mut content = assistant_message_text(message);
    if content.trim().is_empty() {
        content = choice.get("text").map(content_text).unwrap_or_default();
    }
    let tool_calls = message
        .get("tool_calls")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(normalize_tool_call)
        .collect::<Vec<_>>();
    let tool_calls = if tool_calls.is_empty() {
        message
            .get("function_call")
            .filter(|value| value.is_object())
            .cloned()
            .map(normalize_tool_call)
            .into_iter()
            .collect::<Vec<_>>()
    } else {
        tool_calls
    };
    if content.trim().is_empty() && tool_calls.is_empty() {
        let reasoning = response_reasoning_text(choice, message);
        if !reasoning.trim().is_empty() {
            return Err(AppError::with_details(
                "llm_response_error",
                "Provider returned reasoning but no final assistant text. Increase Max Output Tokens or lower Reasoning Effort in this connection's generation controls.",
                redact_sensitive_json(json),
            ));
        }
        return Err(AppError::with_details(
            "llm_response_error",
            "Provider response did not contain assistant text or tool calls",
            redact_sensitive_json(json),
        ));
    }
    Ok(LlmCompletion {
        content,
        tool_calls,
        finish_reason: choice
            .get("finish_reason")
            .or_else(|| message.get("finish_reason"))
            .and_then(Value::as_str)
            .map(str::to_string),
        usage: json.get("usage").cloned(),
        provider_metadata: None,
    })
}

fn normalize_tool_call(call: Value) -> Value {
    let function = call.get("function").cloned().unwrap_or_else(|| json!({}));
    let name = function
        .get("name")
        .or_else(|| call.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let arguments = function
        .get("arguments")
        .or_else(|| call.get("arguments"))
        .and_then(Value::as_str)
        .unwrap_or("{}")
        .to_string();
    json!({
        "id": call.get("id").and_then(Value::as_str).unwrap_or("").to_string(),
        "name": name,
        "arguments": arguments,
        "function": {
            "name": name,
            "arguments": arguments
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    fn test_connection() -> LlmConnection {
        LlmConnection {
            provider: "claude_subscription".to_string(),
            model: "claude-sonnet-4-5".to_string(),
            api_key: String::new(),
            base_url: String::new(),
            openrouter_provider: None,
            enable_caching: false,
            caching_at_depth: None,
            max_tokens_override: None,
            claude_fast_mode: false,
        }
    }

    fn request_for(provider: &str, model: &str, parameters: Value) -> LlmRequest {
        LlmRequest {
            connection: LlmConnection {
                provider: provider.to_string(),
                model: model.to_string(),
                api_key: String::new(),
                base_url: String::new(),
                openrouter_provider: None,
                enable_caching: false,
                caching_at_depth: None,
                max_tokens_override: None,
                claude_fast_mode: false,
            },
            messages: Vec::new(),
            parameters,
            tools: Vec::new(),
        }
    }

    fn test_message(role: &str, content: &str) -> LlmMessage {
        LlmMessage {
            role: role.to_string(),
            content: content.to_string(),
            name: None,
            images: Vec::new(),
            tool_call_id: None,
            tool_calls: None,
            provider_metadata: None,
        }
    }

    fn unsigned_jwt_with_exp(exp: i64) -> String {
        let header = general_purpose::URL_SAFE_NO_PAD.encode(r#"{"alg":"none","typ":"JWT"}"#);
        let payload = general_purpose::URL_SAFE_NO_PAD.encode(format!(r#"{{"exp":{exp}}}"#));
        format!("{header}.{payload}.signature")
    }

    async fn serve_response(
        status: &'static str,
        content_type: &'static str,
        body: Vec<u8>,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test LLM server should bind");
        let address = listener
            .local_addr()
            .expect("test LLM server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test LLM server should accept one request");
            let mut buffer = [0_u8; 1024];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test LLM server should read request");
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test LLM server should write response headers");
            stream
                .write_all(&body)
                .await
                .expect("test LLM server should write response body");
        });
        format!("http://{address}")
    }

    async fn serve_chatgpt_models_response(
        status: &'static str,
        body: &'static str,
        assert_headers: bool,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test ChatGPT model server should bind");
        let address = listener
            .local_addr()
            .expect("test ChatGPT model server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test ChatGPT model server should accept one request");
            let mut buffer = [0_u8; 4096];
            let bytes = stream
                .read(&mut buffer)
                .await
                .expect("test ChatGPT model server should read request");
            let request = String::from_utf8_lossy(&buffer[..bytes]);
            assert!(request
                .lines()
                .next()
                .is_some_and(|line| line.starts_with("GET /models?client_version=1.6.1 ")));
            if assert_headers {
                let headers = request.to_ascii_lowercase();
                assert!(headers.contains("authorization: bearer access-secret"));
                assert!(headers.contains("chatgpt-account-id: account-1"));
                assert!(headers.contains("x-openai-fedramp: true"));
                assert!(headers.contains("originator: marinara-engine"));
            }
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test ChatGPT model server should write response");
        });
        format!("http://{address}/models?client_version=1.6.1")
    }

    async fn serve_chunked_response(
        status: &'static str,
        content_type: &'static str,
        chunks: Vec<Vec<u8>>,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test LLM server should bind");
        let address = listener
            .local_addr()
            .expect("test LLM server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test LLM server should accept one request");
            let mut buffer = [0_u8; 1024];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test LLM server should read request");
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n",
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test LLM server should write response headers");
            for chunk in chunks {
                let header = format!("{:x}\r\n", chunk.len());
                stream
                    .write_all(header.as_bytes())
                    .await
                    .expect("test LLM server should write chunk header");
                stream
                    .write_all(&chunk)
                    .await
                    .expect("test LLM server should write chunk body");
                stream
                    .write_all(b"\r\n")
                    .await
                    .expect("test LLM server should write chunk terminator");
            }
            stream
                .write_all(b"0\r\n\r\n")
                .await
                .expect("test LLM server should write final chunk");
        });
        format!("http://{address}")
    }

    async fn serve_delayed_response_headers(delay: Duration) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test LLM server should bind");
        let address = listener
            .local_addr()
            .expect("test LLM server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test LLM server should accept one request");
            let mut buffer = [0_u8; 1024];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test LLM server should read request");
            tokio::time::sleep(delay).await;
            let _ = stream
                .write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
                )
                .await;
        });
        format!("http://{address}")
    }

    async fn response_from_url(url: String) -> reqwest::Response {
        reqwest::Client::new()
            .get(url)
            .send()
            .await
            .expect("test LLM response should arrive")
    }

    #[test]
    fn prompt_connection_diagnostics_follow_legacy_preset_and_explicit_flag() {
        assert!(is_prompt_connection_log_preset_value(Some(
            "prompt-connections"
        )));
        assert!(is_prompt_connection_log_preset_value(Some(
            "prompt_connections"
        )));
        assert!(prompt_connection_diagnostics_enabled_values(
            Some("prompt-connections"),
            None
        ));
        assert!(prompt_connection_diagnostics_enabled_values(
            None,
            Some("true")
        ));
        assert!(prompt_connection_diagnostics_enabled_values(
            None,
            Some("1")
        ));
        assert!(!prompt_connection_diagnostics_enabled_values(
            Some("default"),
            Some("false")
        ));
        assert!(!prompt_connection_diagnostics_enabled_values(None, None));
    }

    #[test]
    fn prompt_connection_endpoint_redaction_removes_query_secrets() {
        assert_eq!(
            redacted_endpoint("https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent?key=secret"),
            "https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent?<redacted>"
        );
        assert_eq!(
            redacted_endpoint("https://api.openai.com/v1/chat/completions"),
            "https://api.openai.com/v1/chat/completions"
        );
    }

    #[test]
    fn openai_chat_stream_accumulates_tool_call_deltas() {
        let mut emitted = Vec::new();
        let mut tool_calls = OpenAiToolCallAccumulator::default();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let first_status = process_openai_sse_block(
            r#"data: {"choices":[{"delta":{"content":"Rolling...","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"roll_dice","arguments":"{\"notation\""}}]}}]}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("first chunk should parse");
        let status = process_openai_sse_block(
            r#"data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\"1d20\"}"}}]}}]}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("second chunk should parse");

        let calls = tool_calls.into_tool_calls();
        assert_eq!(emitted[0]["type"], "token");
        assert_eq!(emitted[0]["text"], "Rolling...");
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0]["id"], "call_1");
        assert_eq!(calls[0]["function"]["name"], "roll_dice");
        assert_eq!(calls[0]["function"]["arguments"], r#"{"notation":"1d20"}"#);
        assert_eq!(first_status, SseBlockStatus::Continue);
        assert_eq!(status, SseBlockStatus::Continue);
    }

    #[test]
    fn openai_chat_stream_done_block_is_terminal() {
        let mut emitted = Vec::new();
        let mut tool_calls = OpenAiToolCallAccumulator::default();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let status = process_openai_sse_block("data: [DONE]", &mut emit, &mut tool_calls)
            .expect("DONE chunk should parse");

        assert_eq!(status, SseBlockStatus::Complete);
        assert!(emitted.is_empty());
    }

    #[test]
    fn openai_chat_stream_finish_reason_is_terminal() {
        let mut emitted = Vec::new();
        let mut tool_calls = OpenAiToolCallAccumulator::default();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let status = process_openai_sse_block(
            r#"data: {"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("finish_reason chunk should parse");

        assert_eq!(status, SseBlockStatus::Complete);
        assert_eq!(
            emitted[0],
            json!({ "type": "token", "text": "done", "data": "done" })
        );
    }

    #[test]
    fn openai_responses_completed_event_is_terminal() {
        let mut emitted = Vec::new();
        let mut tool_calls = ResponsesToolCallAccumulator::default();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let status = process_openai_responses_sse_block(
            r#"event: response.completed
data: {"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":2}}}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("response.completed should parse");

        assert_eq!(status, SseBlockStatus::Complete);
        assert_eq!(emitted[0]["type"], json!("usage"));
    }

    #[test]
    fn openai_responses_completed_event_emits_encrypted_reasoning_metadata() {
        let mut emitted = Vec::new();
        let mut tool_calls = ResponsesToolCallAccumulator::default();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let status = process_openai_responses_sse_block(
            r#"event: response.completed
data: {"type":"response.completed","response":{"usage":{"input_tokens":1,"output_tokens":2},"output":[{"type":"reasoning","id":"rs_1","encrypted_content":"encrypted-payload"},{"type":"message","content":[{"type":"output_text","text":"done"}]}]}}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("response.completed should parse");

        assert_eq!(status, SseBlockStatus::Complete);
        assert_eq!(
            emitted[0],
            json!({ "type": "usage", "data": { "input_tokens": 1, "output_tokens": 2 } })
        );
        assert_eq!(emitted[1]["type"], json!("provider_metadata"));
        assert_eq!(
            emitted[1]["data"]["encryptedReasoningItems"][0],
            json!({ "type": "reasoning", "id": "rs_1", "encrypted_content": "encrypted-payload" })
        );
    }

    #[test]
    fn openai_responses_body_requests_and_replays_encrypted_reasoning() {
        let mut request = request_for(
            "openai",
            "gpt-5",
            json!({ "customParameters": { "include": ["web_search_call.action.sources"] } }),
        );
        let mut assistant = test_message("assistant", "Earlier answer.");
        assistant.provider_metadata = Some(json!({
            "encryptedReasoningItems": [
                { "type": "reasoning", "id": "rs_1", "encrypted_content": "encrypted-payload" }
            ]
        }));
        request.messages = vec![
            test_message("user", "Earlier question."),
            assistant,
            test_message("user", "Next question."),
        ];

        let body = build_openai_responses_body(&request, false);
        let includes = body["include"]
            .as_array()
            .expect("include should be an array");
        assert!(includes
            .iter()
            .any(|item| item.as_str() == Some("web_search_call.action.sources")));
        assert!(includes
            .iter()
            .any(|item| { item.as_str() == Some(OPENAI_RESPONSES_ENCRYPTED_REASONING_INCLUDE) }));
        let input = body["input"].as_array().expect("input should be an array");
        assert_eq!(input[0]["role"], json!("user"));
        assert_eq!(
            input[1],
            json!({ "type": "reasoning", "id": "rs_1", "encrypted_content": "encrypted-payload" })
        );
        assert_eq!(input[2]["role"], json!("assistant"));
        assert_eq!(input[3]["role"], json!("user"));
    }

    #[test]
    fn openai_responses_body_preserves_tool_roundtrip_shape() {
        let mut request = request_for("openai", "gpt-5", json!({}));
        let mut assistant = test_message("assistant", "I should use a tool.");
        assistant.tool_calls = Some(json!([
            {
                "id": "call_roll",
                "function": {
                    "name": "roll_dice",
                    "arguments": "{\"notation\":\"1d20\"}"
                }
            }
        ]));
        let mut tool = test_message("tool", "17");
        tool.tool_call_id = Some("call_roll".to_string());
        request.messages = vec![
            test_message("user", "Roll please."),
            assistant,
            tool,
            test_message("user", "What happened?"),
        ];

        let body = build_openai_responses_body(&request, false);
        let input = body["input"].as_array().expect("input should be an array");

        assert_eq!(
            input[0],
            json!({ "role": "user", "content": "Roll please." })
        );
        assert_eq!(
            input[1],
            json!({ "role": "assistant", "content": "I should use a tool." })
        );
        assert_eq!(
            input[2],
            json!({
                "type": "function_call",
                "id": "fc_mapped_1",
                "call_id": "fc_mapped_1",
                "name": "roll_dice",
                "arguments": "{\"notation\":\"1d20\"}"
            })
        );
        assert_eq!(
            input[3],
            json!({ "type": "function_call_output", "call_id": "fc_mapped_1", "output": "17" })
        );
        assert_eq!(
            input[4],
            json!({ "role": "user", "content": "What happened?" })
        );
    }

    #[test]
    fn openai_responses_stream_accumulates_function_call_deltas() {
        let mut emitted = Vec::new();
        let mut tool_calls = ResponsesToolCallAccumulator::default();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        process_openai_responses_sse_block(
            r#"event: response.output_item.added
data: {"type":"response.output_item.added","item":{"type":"function_call","call_id":"fc_1","name":"roll_dice","arguments":""}}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("function_call item should parse");
        process_openai_responses_sse_block(
            r#"event: response.function_call_arguments.delta
data: {"type":"response.function_call_arguments.delta","call_id":"fc_1","delta":"{\"notation\""}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("function_call argument delta should parse");
        process_openai_responses_sse_block(
            r#"event: response.function_call_arguments.delta
data: {"type":"response.function_call_arguments.delta","call_id":"fc_1","delta":":\"1d20\"}"}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("function_call argument delta should parse");
        process_openai_responses_sse_block(
            r#"event: response.function_call_arguments.done
data: {"type":"response.function_call_arguments.done","call_id":"fc_1","arguments":"{\"notation\":\"1d20\"}"}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("function_call arguments done should parse");
        process_openai_responses_sse_block(
            r#"event: response.output_item.done
data: {"type":"response.output_item.done","item":{"type":"function_call","call_id":"fc_1","name":"roll_dice"}}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("function_call item done should parse");

        assert!(emitted.is_empty());
        assert_eq!(
            tool_calls.into_tool_calls(),
            vec![json!({
                "id": "fc_1",
                "name": "roll_dice",
                "arguments": "{\"notation\":\"1d20\"}",
                "function": {
                    "name": "roll_dice",
                    "arguments": "{\"notation\":\"1d20\"}"
                }
            })]
        );
    }

    #[test]
    fn openai_chatgpt_responses_body_does_not_replay_encrypted_reasoning() {
        let mut request = request_for("openai_chatgpt", "gpt-5-codex", json!({}));
        let mut assistant = test_message("assistant", "Earlier answer.");
        assistant.provider_metadata = Some(json!({
            "encryptedReasoningItems": [
                { "type": "reasoning", "encrypted_content": "encrypted-payload" }
            ]
        }));
        request.messages = vec![test_message("user", "Earlier question."), assistant];

        let body = build_openai_responses_body(&request, false);
        assert!(body.get("include").is_none());
        let input = body["input"].as_array().expect("input should be an array");
        assert!(input
            .iter()
            .all(|item| item.get("encrypted_content").is_none()));
    }

    #[test]
    fn openai_chatgpt_base_url_ignores_configured_endpoint() {
        assert_eq!(
            base_url("openai_chatgpt", "https://api.example.com/v1"),
            OPENAI_CHATGPT_CODEX_BASE_URL
        );
    }

    #[tokio::test]
    async fn openai_chatgpt_models_live_success_normalizes_slug_and_name() {
        let url = serve_chatgpt_models_response(
            "200 OK",
            r#"{"models":[{"slug":"gpt-5-codex","display_name":"GPT-5 Codex"},{"id":"o3","name":"o3"}]}"#,
            true,
        )
        .await;
        let auth = ChatGptAuth {
            access_token: "access-secret".to_string(),
            account_id: Some("account-1".to_string()),
            is_fedramp: true,
        };

        let models = fetch_openai_chatgpt_models_from_url(&url, &auth)
            .await
            .expect("live ChatGPT model discovery should succeed");

        assert_eq!(models.len(), 2);
        assert_eq!(models[0]["id"], "gpt-5-codex");
        assert_eq!(models[0]["name"], "GPT-5 Codex");
        assert_eq!(models[0]["provider"], "openai_chatgpt");
        assert_eq!(models[1]["id"], "o3");
        assert_eq!(models[1]["name"], "o3");
    }

    #[tokio::test]
    async fn openai_chatgpt_models_empty_live_result_returns_fallback_error() {
        let url = serve_chatgpt_models_response("200 OK", r#"{"models":[]}"#, false).await;
        let auth = ChatGptAuth {
            access_token: "access-secret".to_string(),
            account_id: None,
            is_fedramp: false,
        };

        let error = fetch_openai_chatgpt_models_from_url(&url, &auth)
            .await
            .expect_err("empty live ChatGPT catalog should trigger curated fallback");

        assert_eq!(error.code, "models_provider_error");
        assert!(error.message.contains("returned no models"));
    }

    #[tokio::test]
    async fn openai_chatgpt_models_provider_error_returns_fallback_error() {
        let url = serve_chatgpt_models_response(
            "401 Unauthorized",
            r#"{"error":{"message":"bad key sk-test-secret"}}"#,
            false,
        )
        .await;
        let auth = ChatGptAuth {
            access_token: "access-secret".to_string(),
            account_id: None,
            is_fedramp: false,
        };

        let error = fetch_openai_chatgpt_models_from_url(&url, &auth)
            .await
            .expect_err("provider error should trigger curated fallback");

        assert_eq!(error.code, "models_provider_error");
        assert!(error
            .message
            .contains("ChatGPT model catalog returned HTTP 401 Unauthorized"));
        assert!(!error.message.contains("sk-test-secret"));
        let details = serde_json::to_string(&error.details).expect("details should serialize");
        assert!(!details.contains("sk-test-secret"));
    }

    #[test]
    fn openai_chatgpt_auth_skips_fresh_recent_token() {
        let token = unsigned_jwt_with_exp(Utc::now().timestamp() + 3600);
        let auth = json!({
            "tokens": { "access_token": token },
            "last_refresh": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
        });

        assert!(!openai_chatgpt_auth_should_refresh(
            &auth,
            auth.pointer("/tokens/access_token")
                .and_then(Value::as_str)
                .expect("token should be present")
        ));
    }

    #[test]
    fn openai_chatgpt_auth_refreshes_for_near_expiry_token() {
        let token = unsigned_jwt_with_exp(
            Utc::now().timestamp() + OPENAI_CHATGPT_EXPIRY_REFRESH_SKEW_SECONDS,
        );
        let auth = json!({
            "tokens": { "access_token": token },
            "last_refresh": Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
        });

        assert!(openai_chatgpt_auth_should_refresh(
            &auth,
            auth.pointer("/tokens/access_token")
                .and_then(Value::as_str)
                .expect("token should be present")
        ));
    }

    #[test]
    fn openai_chatgpt_auth_refreshes_for_stale_last_refresh() {
        let token = unsigned_jwt_with_exp(Utc::now().timestamp() + 3600);
        let auth = json!({
            "tokens": { "access_token": token },
            "last_refresh": (Utc::now()
                - chrono::Duration::days(OPENAI_CHATGPT_TOKEN_REFRESH_INTERVAL_DAYS + 1))
            .to_rfc3339_opts(SecondsFormat::Millis, true)
        });

        assert!(openai_chatgpt_auth_should_refresh(
            &auth,
            auth.pointer("/tokens/access_token")
                .and_then(Value::as_str)
                .expect("token should be present")
        ));
    }

    #[test]
    fn openai_chatgpt_missing_refresh_token_error_is_secret_safe() {
        let error = openai_chatgpt_refresh_token_error();

        assert_eq!(error.code, "openai_chatgpt_auth_error");
        assert!(error.message.contains("no refresh token is available"));
        assert!(!error.message.contains("sk-"));
        assert!(!error.message.contains("refresh-secret"));
    }

    #[test]
    fn openai_chatgpt_refresh_response_updates_tokens_for_persistence() {
        let mut auth = json!({
            "tokens": {
                "access_token": "old-access-secret",
                "refresh_token": "old-refresh-secret",
                "id_token": "old-id-secret"
            },
            "last_refresh": "2026-01-01T00:00:00.000Z"
        });
        let tokens = auth
            .get_mut("tokens")
            .and_then(Value::as_object_mut)
            .expect("tokens should be mutable");

        let access = apply_openai_chatgpt_refreshed_tokens(
            tokens,
            &json!({
                "access_token": "new-access-secret",
                "refresh_token": "new-refresh-secret",
                "id_token": "new-id-secret"
            }),
        )
        .expect("refreshed access token should be returned");
        auth["last_refresh"] = Value::String("2026-06-06T00:00:00.000Z".to_string());
        let serialized = serde_json::to_string_pretty(&auth).expect("auth should serialize");

        assert_eq!(access, "new-access-secret");
        assert!(serialized.contains("new-access-secret"));
        assert!(serialized.contains("new-refresh-secret"));
        assert!(serialized.contains("new-id-secret"));
        assert!(!serialized.contains("old-access-secret"));
        assert!(!serialized.contains("old-refresh-secret"));
        assert!(!serialized.contains("old-id-secret"));
    }

    #[test]
    fn cohere_default_base_uses_openai_compatible_endpoint() {
        let mut request = request_for("cohere", "command-a", json!({}));

        assert_eq!(
            base_url("cohere", ""),
            "https://api.cohere.com/compatibility/v1"
        );
        assert!(should_use_cohere_compatibility(&request));
        assert_eq!(
            openai_compatible_chat_endpoint(&request),
            "https://api.cohere.com/compatibility/v1/chat/completions"
        );

        request.connection.base_url = "https://api.cohere.com/v2".to_string();
        assert!(!should_use_cohere_compatibility(&request));
        assert_eq!(
            cohere_chat_endpoint(&request.connection.base_url),
            "https://api.cohere.com/v2/chat"
        );
    }

    #[test]
    fn openai_chatgpt_missing_auth_message_hides_local_path() {
        let error = std::io::Error::new(std::io::ErrorKind::NotFound, "missing");
        let message = openai_chatgpt_auth_missing_message(&error);

        assert!(message.contains("local Codex auth.json credential file"));
        assert!(!message.contains(":\\"));
        assert!(!message.contains("/Users/"));
        assert!(!message.contains("/home/"));
    }

    #[test]
    fn openai_responses_body_preserves_xhigh_for_supported_models() {
        let request = request_for(
            "openai",
            "gpt-5.2",
            json!({
                "reasoningEffort": "xhigh",
                "responseFormat": "json_object",
                "verbosity": "high",
                "customParameters": {
                    "metadata": { "surface": "preset-proof" }
                }
            }),
        );
        let body = build_openai_responses_body(&request, false);

        assert_eq!(
            body["reasoning"],
            json!({ "effort": "xhigh", "summary": "auto" })
        );
        assert_eq!(
            body["text"],
            json!({ "format": { "type": "json_object" }, "verbosity": "high" })
        );
        assert_eq!(body["metadata"], json!({ "surface": "preset-proof" }));
    }

    #[test]
    fn openai_responses_body_resolves_maximum_to_supported_xhigh() {
        let request = request_for(
            "openai",
            "gpt-5.2-codex",
            json!({ "reasoningEffort": "maximum" }),
        );
        let body = build_openai_responses_body(&request, false);

        assert_eq!(body["reasoning"]["effort"], json!("xhigh"));
    }

    #[test]
    fn openai_responses_body_preserves_xhigh_aliases_for_gpt51_codex_max() {
        let xhigh_request = request_for(
            "openai",
            "gpt-5.1-codex-max",
            json!({ "reasoningEffort": "xhigh" }),
        );
        let maximum_request = request_for(
            "openai",
            "gpt-5.1-codex-max",
            json!({ "reasoningEffort": "maximum" }),
        );

        assert_eq!(
            build_openai_responses_body(&xhigh_request, false)["reasoning"]["effort"],
            json!("xhigh")
        );
        assert_eq!(
            build_openai_responses_body(&maximum_request, false)["reasoning"]["effort"],
            json!("xhigh")
        );
    }

    #[test]
    fn openai_responses_body_downgrades_xhigh_for_unsupported_models() {
        let xhigh_request = request_for("openai", "gpt-5.1", json!({ "reasoningEffort": "xhigh" }));
        let maximum_request = request_for(
            "openai",
            "gpt-5-pro",
            json!({ "reasoningEffort": "maximum" }),
        );

        assert_eq!(
            build_openai_responses_body(&xhigh_request, false)["reasoning"]["effort"],
            json!("high")
        );
        assert_eq!(
            build_openai_responses_body(&maximum_request, false)["reasoning"]["effort"],
            json!("high")
        );
    }

    #[test]
    fn openrouter_reasoning_uses_unified_xhigh_effort() {
        let request = request_for(
            "openrouter",
            "anthropic/claude-3.7-sonnet",
            json!({ "reasoningEffort": "xhigh" }),
        );
        let mut body = json!({});
        apply_openai_parameters(&mut body, &request);

        assert_eq!(body["reasoning"], json!({ "effort": "xhigh" }));
    }

    #[tokio::test]
    async fn provider_http_client_redacts_query_secret() {
        let error = provider_http_client_for_url("ftp://example.test/models?key=sk-test-secret")
            .await
            .expect_err("disallowed URL should fail");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("[REDACTED]"));
        assert!(!error.message.contains("sk-test-secret"));
    }

    #[test]
    fn provider_http_client_policy_blocks_private_dns_answers() {
        let url = reqwest::Url::parse("https://public-looking.example.test/v1/chat/completions")
            .expect("test URL should parse");
        let error = validate_provider_resolved_addresses(
            &url,
            false,
            vec![
                "10.0.0.1:443".parse().expect("private address parses"),
                "[::ffff:10.0.0.1]:443"
                    .parse()
                    .expect("mapped private address parses"),
            ],
        )
        .expect_err("private DNS answers should be rejected");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains(PROVIDER_LOCAL_URLS_ENABLED_FLAG));
    }

    #[test]
    fn provider_http_client_policy_blocks_loopback_dns_answers() {
        let url = reqwest::Url::parse("https://public-looking.example.test/v1/chat/completions")
            .expect("test URL should parse");
        let error = validate_provider_resolved_addresses(
            &url,
            false,
            vec![
                "127.0.0.1:443".parse().expect("loopback address parses"),
                "[::1]:443".parse().expect("IPv6 loopback address parses"),
                "[::ffff:127.0.0.1]:443"
                    .parse()
                    .expect("mapped loopback address parses"),
            ],
        )
        .expect_err("loopback DNS answers should be rejected");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains(PROVIDER_LOCAL_URLS_ENABLED_FLAG));
    }

    #[tokio::test]
    async fn provider_http_client_policy_keeps_literal_loopback_allowed() {
        for url in [
            "http://127.0.0.1:11434/api/chat",
            "http://localhost:11434/api/chat",
            "http://[::ffff:127.0.0.1]:11434/api/chat",
        ] {
            let url = reqwest::Url::parse(url).expect("test URL should parse");
            let allowed = validate_provider_url_resolution(&url, false)
                .await
                .expect("literal loopback host should keep local provider allowance");

            assert!(allowed.is_none());
        }
    }

    #[tokio::test]
    async fn provider_request_times_out_waiting_for_response_headers() {
        let url = serve_delayed_response_headers(Duration::from_millis(250)).await;
        let request = provider_http_client_for_url(&url)
            .await
            .expect("loopback test provider URL should be allowed")
            .get(&url);

        let error = send_provider_request_with_timeout(
            request,
            "llm_network_error",
            Duration::from_millis(25),
        )
        .await
        .expect_err("slow provider headers should time out");

        assert_eq!(error.code, "llm_network_error");
        assert!(error.message.contains("timed out"));
        assert!(error.message.contains("response headers"));
    }

    #[tokio::test]
    async fn openai_compatible_complete_rich_preserves_result_metadata() {
        let url = serve_response(
            "200 OK",
            "application/json",
            br#"{"choices":[{"finish_reason":"tool_calls","message":{"content":"Need a roll.","tool_calls":[{"id":"call_1","function":{"name":"roll_dice","arguments":"{\"notation\":\"1d20\"}"}}]}}],"usage":{"prompt_tokens":11,"completion_tokens":7}}"#.to_vec(),
        )
        .await;
        let mut request = request_for("openai", "gpt-4o", json!({}));
        request.connection.base_url = url;
        request.messages = vec![test_message("user", "Roll.")];

        let completion = complete_openai_compatible_rich(request)
            .await
            .expect("rich completion should parse");

        assert_eq!(completion.content, "Need a roll.");
        assert_eq!(completion.finish_reason.as_deref(), Some("tool_calls"));
        assert_eq!(
            completion.usage.as_ref().unwrap()["prompt_tokens"],
            json!(11)
        );
        assert_eq!(completion.tool_calls[0]["id"], json!("call_1"));
        assert_eq!(
            completion.tool_calls[0]["function"]["name"],
            json!("roll_dice")
        );
    }

    #[test]
    fn claude_subscription_output_rich_preserves_usage_metadata() {
        let completion = parse_claude_subscription_output_rich(
            r#"{"type":"result","subtype":"success","result":"OK","usage":{"input_tokens":10,"output_tokens":2},"fast_mode_state":"off","modelUsage":{"claude-sonnet-4-5":{"input_tokens":10,"output_tokens":2}}}"#,
            "claude-sonnet-4-5",
        )
        .expect("Claude subscription result should parse");

        assert_eq!(completion.content, "OK");
        assert_eq!(completion.finish_reason.as_deref(), Some("success"));
        let usage = completion.usage.expect("usage should be preserved");
        assert_eq!(usage["input_tokens"], json!(10));
        assert_eq!(
            usage["modelUsage"]["claude-sonnet-4-5"]["output_tokens"],
            json!(2)
        );
        assert_eq!(usage["fastModeState"], json!("off"));
    }

    #[test]
    fn google_vertex_default_base_uses_aiplatform_endpoint() {
        assert_eq!(
            base_url("google_vertex", ""),
            "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1"
        );
        assert_eq!(
            google_vertex_endpoint(
                "https://us-central1-aiplatform.googleapis.com/v1/projects/demo/locations/us-central1/publishers/google/models",
                "gemini-2.5-pro",
                "generateContent",
            ),
            "https://us-central1-aiplatform.googleapis.com/v1/projects/demo/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent"
        );
    }

    #[test]
    fn google_linkapi_console_hosts_normalize_to_api_host() {
        assert_eq!(
            normalize_google_base_url("https://home.linkapi.ai".to_string()),
            "https://api.linkapi.ai"
        );
        assert_eq!(
            normalize_google_base_url("https://www.linkapi.ai/v1beta".to_string()),
            "https://api.linkapi.ai/v1beta"
        );
    }

    #[test]
    fn google_stream_endpoint_uses_sse_stream_generate_content() {
        let request = request_for("google", "gemini-3.5-flash", json!({}));

        assert_eq!(
            google_endpoint(&request, "streamGenerateContent", true),
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?key=&alt=sse"
        );
    }

    #[test]
    fn google_linkapi_stream_endpoint_uses_api_host_and_sse() {
        let mut request = request_for("google", "gemini-3.5-flash", json!({}));
        request.connection.base_url = "https://home.linkapi.ai".to_string();

        assert_eq!(
            google_endpoint(&request, "streamGenerateContent", true),
            "https://api.linkapi.ai/v1beta/models/gemini-3.5-flash:streamGenerateContent?key=&alt=sse"
        );
    }

    #[test]
    fn provider_http_error_preserves_text_error_body() {
        let details = provider_error_details_from_text("error code: 1033");
        let error = provider_http_error(
            reqwest::StatusCode::from_u16(530).expect("530 should be a valid status"),
            details,
        );

        assert_eq!(error.code, "llm_provider_error");
        assert!(error.message.contains("error code: 1033"));
    }

    #[test]
    fn provider_http_error_redacts_sensitive_error_body() {
        let details = provider_error_details_from_text(
            r#"{"error":{"message":"Invalid API key sk-test-secret"},"api_key":"sk-test-secret","usage":{"input_tokens":12}}"#,
        );
        let error = provider_http_error(reqwest::StatusCode::UNAUTHORIZED, details);

        assert_eq!(error.code, "llm_provider_error");
        assert!(error.message.contains("[REDACTED]"));
        assert!(!error.message.contains("sk-test-secret"));
        let details = error.details.expect("provider details should be attached");
        assert_eq!(details["api_key"], "[REDACTED]");
        assert_eq!(details["usage"]["input_tokens"], 12);
        assert!(!details.to_string().contains("sk-test-secret"));
    }

    #[tokio::test]
    async fn oversized_llm_error_body_preserves_provider_status() {
        let url = serve_response(
            "429 Too Many Requests",
            "text/plain",
            vec![b'x'; PROVIDER_RESPONSE_MAX_BYTES + 1024],
        )
        .await;
        let response = response_from_url(url).await;
        let error = parse_json_response(response, |json| Some(json.to_string()))
            .await
            .expect_err("oversized provider error should stay status-bearing");

        assert_eq!(error.code, "llm_provider_error");
        assert!(error
            .message
            .contains("Provider returned HTTP 429 Too Many Requests"));
        assert!(!error.message.contains("exceeds"));
        assert!(error.message.len() < 700);
    }

    #[tokio::test]
    async fn chunked_llm_error_body_is_bounded_redacted_and_status_bearing() {
        let url = serve_chunked_response(
            "401 Unauthorized",
            "text/plain",
            vec![
                b"bad key sk-test-secret ".to_vec(),
                vec![b'x'; PROVIDER_RESPONSE_MAX_BYTES + 1024],
            ],
        )
        .await;
        let response = response_from_url(url).await;
        let error_body = read_error_response_details(response)
            .await
            .expect("chunked provider error details should read bounded diagnostic");
        let error = provider_http_error(reqwest::StatusCode::UNAUTHORIZED, error_body);

        assert_eq!(error.code, "llm_provider_error");
        assert!(error
            .message
            .contains("Provider returned HTTP 401 Unauthorized"));
        assert!(error.message.contains("[REDACTED]"));
        assert!(!error.message.contains("sk-test-secret"));
        assert!(!error.message.contains("exceeds"));
        assert!(error.message.len() < 700);
    }

    #[test]
    fn google_top_k_zero_is_not_sent() {
        let mut request = request_for("google", "gemini-2.5-flash", json!({ "topK": 0 }));
        assert!(should_send_top_k(&request));
        assert!(param_i64(&request.parameters, &["topK", "top_k"])
            .filter(|value| *value > 0)
            .is_none());
        request.parameters = json!({ "topK": 40 });
        assert_eq!(
            param_i64(&request.parameters, &["topK", "top_k"]).filter(|value| *value > 0),
            Some(40)
        );
    }

    #[test]
    fn gemini_3_thinking_config_sends_thinking_only_shape() {
        let config =
            google_thinking_config("gemini-3-pro", &json!({ "reasoningEffort": "medium" }))
                .expect("Gemini 3 reasoning effort should create thinking config");
        assert_eq!(config["thinkingLevel"], json!("medium"));
        assert_eq!(config["includeThoughts"], json!(true));

        let flash_config =
            google_thinking_config("gemini-3.5-flash", &json!({ "reasoningEffort": "minimal" }))
                .expect("Gemini 3.5 Flash minimal effort should create thinking config");
        assert_eq!(flash_config["thinkingLevel"], json!("minimal"));

        let pro_config = google_thinking_config(
            "gemini-3.1-pro-preview",
            &json!({ "reasoningEffort": "minimal" }),
        )
        .expect("Gemini 3.1 Pro should clamp minimal effort to a supported level");
        assert_eq!(pro_config["thinkingLevel"], json!("low"));
    }

    #[test]
    fn gemini_35_flash_uses_gemini_3_rules() {
        assert!(is_gemini_3_model("gemini-3.5-flash"));
        assert!(is_gemini_3_model("google/gemini-3.5-flash"));
    }

    #[test]
    fn google_gemini_3_generation_config_keeps_max_tokens_and_strips_sampling() {
        let request = request_for(
            "google",
            "gemini-3.5-flash",
            json!({
                "maxTokens": 4096,
                "reasoningEffort": "high",
                "temperature": 0.8,
                "topP": 0.9,
                "topK": 40,
                "frequencyPenalty": 0.2,
                "presencePenalty": 0.3,
                "stop": ["</END>"],
                "customParameters": {
                    "generationConfig": {
                        "candidateCount": 2,
                        "topP": 0.4,
                        "responseMimeType": "application/json"
                    },
                    "safetySettings": [
                        {
                            "category": "HARM_CATEGORY_HARASSMENT",
                            "threshold": "BLOCK_ONLY_HIGH"
                        }
                    ]
                }
            }),
        );
        let body = google_generate_body(&request);
        let config = &body["generationConfig"];

        assert_eq!(config["maxOutputTokens"], json!(4096));
        assert_eq!(config["thinkingConfig"]["thinkingLevel"], json!("high"));
        assert_eq!(config["thinkingConfig"]["includeThoughts"], json!(true));
        assert!(config.get("temperature").is_none());
        assert!(config.get("topP").is_none());
        assert!(config.get("topK").is_none());
        assert!(config.get("candidateCount").is_none());
        assert_eq!(config["frequencyPenalty"], json!(0.2));
        assert_eq!(config["presencePenalty"], json!(0.3));
        assert_eq!(config["stopSequences"], json!(["</END>"]));
        assert_eq!(config["responseMimeType"], json!("application/json"));
        assert_eq!(
            body["safetySettings"][0]["category"],
            json!("HARM_CATEGORY_HARASSMENT")
        );
    }

    #[test]
    fn google_stream_sse_emits_thinking_tokens_and_usage() {
        let mut emitted = Vec::new();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let status = process_google_sse_block(
            r#"data: {"candidates":[{"content":{"parts":[{"text":"pondering","thought":true},{"text":"hello"}]}}],"usageMetadata":{"promptTokenCount":1,"candidatesTokenCount":2,"totalTokenCount":3}}"#,
            &mut emit,
        )
        .expect("Gemini stream block should parse");

        assert_eq!(emitted[0]["type"], json!("usage"));
        assert_eq!(
            emitted[1],
            json!({ "type": "thinking", "text": "pondering", "data": "pondering" })
        );
        assert_eq!(
            emitted[2],
            json!({ "type": "token", "text": "hello", "data": "hello" })
        );
        assert_eq!(status, SseBlockStatus::Continue);
    }

    #[test]
    fn google_stream_finish_reason_is_terminal_after_tokens() {
        let mut emitted = Vec::new();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let status = process_google_sse_block(
            r#"data: {"candidates":[{"content":{"parts":[{"text":"hello"}]},"finishReason":"STOP"}]}"#,
            &mut emit,
        )
        .expect("Gemini terminal block should parse");

        assert_eq!(status, SseBlockStatus::Complete);
        assert_eq!(
            emitted[0],
            json!({ "type": "token", "text": "hello", "data": "hello" })
        );
    }

    #[test]
    fn google_stream_finish_reason_is_terminal_without_parts() {
        let mut emitted = Vec::new();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let status = process_google_sse_block(
            r#"data: {"candidates":[{"finishReason":"STOP"}],"usageMetadata":{"totalTokenCount":3}}"#,
            &mut emit,
        )
        .expect("Gemini terminal metadata block should parse");

        assert_eq!(status, SseBlockStatus::Complete);
        assert_eq!(
            emitted[0],
            json!({ "type": "usage", "data": { "totalTokenCount": 3 } })
        );
    }

    #[test]
    fn google_stream_max_tokens_finish_reason_is_incomplete() {
        let mut emitted = Vec::new();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let error = process_google_sse_block(
            r#"data: {"candidates":[{"content":{"parts":[{"text":"Above the Skyport, the great brass heating lens lets out a wet,"}]},"finishReason":"MAX_TOKENS"}]}"#,
            &mut emit,
        )
        .expect_err("Gemini MAX_TOKENS finish reason should not be treated as complete");

        assert_eq!(error.code, "llm_stream_incomplete");
        assert!(error.message.contains("finishReason: MAX_TOKENS"));
        assert_eq!(
            emitted[0],
            json!({ "type": "token", "text": "Above the Skyport, the great brass heating lens lets out a wet,", "data": "Above the Skyport, the great brass heating lens lets out a wet," })
        );
    }

    #[test]
    fn google_stream_requires_terminal_event() {
        let error = ensure_google_stream_completed(false)
            .expect_err("abrupt Gemini stream close should fail");

        assert_eq!(error.code, "llm_stream_incomplete");
        assert!(error
            .message
            .contains("ended before Gemini sent a finish reason"));
    }

    #[test]
    fn sse_block_splitter_handles_lf_and_crlf_boundaries() {
        let mut buffer = "data: {\"a\":1}\r\n\r\ndata: {\"b\":2}\n\npartial".to_string();

        assert_eq!(
            take_sse_block(&mut buffer),
            Some("data: {\"a\":1}".to_string())
        );
        assert_eq!(
            take_sse_block(&mut buffer),
            Some("data: {\"b\":2}".to_string())
        );
        assert_eq!(take_sse_block(&mut buffer), None);
        assert_eq!(buffer, "partial");
    }

    #[test]
    fn openrouter_claude_opus_adaptive_model_strips_sampling_parameters() {
        let request = request_for(
            "openrouter",
            "anthropic/claude-opus-4-7",
            json!({
                "temperature": 0.8,
                "topP": 0.9,
                "topK": 40,
                "frequencyPenalty": 0.2,
                "presencePenalty": 0.3,
                "customParameters": { "top_p": 0.5, "temperature": 0.4 }
            }),
        );
        let mut body = json!({});
        apply_openai_parameters(&mut body, &request);

        assert!(!should_send_temperature(&request));
        assert!(body.get("top_p").is_none());
        assert!(body.get("top_k").is_none());
        assert!(body.get("frequency_penalty").is_none());
        assert!(body.get("presence_penalty").is_none());
        assert!(body.get("temperature").is_none());
    }

    #[test]
    fn anthropic_adaptive_thinking_model_detection_matches_main_branch_rules() {
        assert!(supports_anthropic_adaptive_thinking("claude-opus-4-8"));
        assert!(supports_anthropic_adaptive_thinking("claude-opus-4-7"));
        assert!(supports_anthropic_adaptive_thinking("claude-opus-4-6"));
        assert!(supports_anthropic_adaptive_thinking("claude-opus-5-6"));
        assert!(supports_anthropic_adaptive_thinking("claude-sonnet-4-6"));
        assert!(!supports_anthropic_adaptive_thinking("claude-sonnet-4-5"));
        assert!(!supports_anthropic_adaptive_thinking(
            "claude-opus-4-20250514"
        ));
    }

    #[test]
    fn anthropic_opus_48_body_uses_adaptive_maximum_and_strips_sampling() {
        let request = request_for(
            "anthropic",
            "claude-opus-4-8",
            json!({
                "maxTokens": 64000,
                "reasoningEffort": "maximum",
                "temperature": 0.8,
                "topP": 0.9,
                "topK": 40,
                "showThoughts": true
            }),
        );
        let body = build_anthropic_body(&request, false);

        assert_eq!(body["model"], json!("claude-opus-4-8"));
        assert_eq!(body["max_tokens"], json!(64000));
        assert_eq!(
            body["thinking"],
            json!({ "type": "adaptive", "display": "summarized" })
        );
        assert_eq!(body["output_config"]["effort"], json!("max"));
        assert!(body.get("temperature").is_none());
        assert!(body.get("top_p").is_none());
        assert!(body.get("top_k").is_none());
    }

    #[test]
    fn anthropic_opus_48_body_requests_adaptive_thinking_without_effort() {
        let request = request_for(
            "anthropic",
            "claude-opus-4-8",
            json!({
                "maxTokens": 16000
            }),
        );
        let body = build_anthropic_body(&request, false);

        assert_eq!(body["max_tokens"], json!(16000));
        assert_eq!(
            body["thinking"],
            json!({ "type": "adaptive", "display": "summarized" })
        );
        assert!(body.get("output_config").is_none());
    }

    #[test]
    fn anthropic_opus_48_body_ignores_stale_show_thoughts_false() {
        let request = request_for(
            "anthropic",
            "claude-opus-4-8",
            json!({
                "maxTokens": 16000,
                "showThoughts": false
            }),
        );
        let body = build_anthropic_body(&request, false);

        assert_eq!(
            body["thinking"],
            json!({ "type": "adaptive", "display": "summarized" })
        );
        assert!(body.get("output_config").is_none());
    }

    #[test]
    fn anthropic_opus_48_stream_body_sets_stream_true() {
        let request = request_for(
            "anthropic",
            "claude-opus-4-8",
            json!({
                "reasoningEffort": "xhigh",
                "showThoughts": false
            }),
        );
        let body = build_anthropic_body(&request, true);

        assert_eq!(body["stream"], json!(true));
        assert_eq!(
            body["thinking"],
            json!({ "type": "adaptive", "display": "summarized" })
        );
        assert_eq!(body["output_config"]["effort"], json!("xhigh"));
    }

    #[test]
    fn anthropic_opus_48_stream_body_requests_summarized_thinking_by_default() {
        let request = request_for(
            "anthropic",
            "claude-opus-4-8",
            json!({
                "reasoningEffort": "high"
            }),
        );
        let body = build_anthropic_body(&request, true);

        assert_eq!(
            body["thinking"],
            json!({ "type": "adaptive", "display": "summarized" })
        );
    }

    #[test]
    fn anthropic_stream_sse_emits_usage_thinking_and_text_tokens() {
        let mut emitted = Vec::new();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        process_anthropic_sse_block(
            r#"event: message_start
data: {"type":"message_start","message":{"usage":{"input_tokens":3,"output_tokens":0}}}"#,
            &mut emit,
        )
        .expect("message_start should parse");
        process_anthropic_sse_block(
            r#"event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"pondering"}}"#,
            &mut emit,
        )
        .expect("thinking delta should parse");
        let status = process_anthropic_sse_block(
            r#"event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"hello"}}"#,
            &mut emit,
        )
        .expect("text delta should parse");

        assert_eq!(emitted[0]["type"], json!("usage"));
        assert_eq!(
            emitted[1],
            json!({ "type": "thinking", "text": "pondering", "data": "pondering" })
        );
        assert_eq!(
            emitted[2],
            json!({ "type": "token", "text": "hello", "data": "hello" })
        );
        assert_eq!(status, SseBlockStatus::Continue);
    }

    #[test]
    fn anthropic_stream_message_stop_is_terminal() {
        let mut emitted = Vec::new();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        let status = process_anthropic_sse_block(
            r#"event: message_stop
data: {"type":"message_stop"}"#,
            &mut emit,
        )
        .expect("message_stop should parse");

        assert_eq!(status, SseBlockStatus::Complete);
        assert!(emitted.is_empty());
    }

    #[test]
    fn anthropic_stream_sse_emits_summarized_thinking_shape() {
        let mut emitted = Vec::new();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        process_anthropic_sse_block(
            r#"event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":"","signature":""}}"#,
            &mut emit,
        )
        .expect("empty thinking block start should parse");
        process_anthropic_sse_block(
            r#"event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"summary chunk"}}"#,
            &mut emit,
        )
        .expect("summarized thinking delta should parse");
        process_anthropic_sse_block(
            r#"event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"opaque"}}"#,
            &mut emit,
        )
        .expect("signature delta should parse");
        process_anthropic_sse_block(
            r#"event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"answer"}}"#,
            &mut emit,
        )
        .expect("text delta should parse");

        assert_eq!(emitted.len(), 2);
        assert_eq!(
            emitted[0],
            json!({ "type": "thinking", "text": "summary chunk", "data": "summary chunk" })
        );
        assert_eq!(
            emitted[1],
            json!({ "type": "token", "text": "answer", "data": "answer" })
        );
    }

    #[test]
    fn anthropic_stream_sse_emits_thinking_when_delta_text_shape_varies() {
        let mut emitted = Vec::new();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        process_anthropic_sse_block(
            r#"event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","text":"summary fallback"}}"#,
            &mut emit,
        )
        .expect("thinking delta text fallback should parse");
        process_anthropic_sse_block(
            r#"event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"thinking":"summary without type"}}"#,
            &mut emit,
        )
        .expect("thinking field without delta type should parse");

        assert_eq!(
            emitted,
            vec![
                json!({ "type": "thinking", "text": "summary fallback", "data": "summary fallback" }),
                json!({ "type": "thinking", "text": "summary without type", "data": "summary without type" })
            ]
        );
    }

    #[test]
    fn claude_subscription_without_runtime_chat_uses_transcript_fold() {
        let request = LlmRequest {
            connection: test_connection(),
            messages: vec![
                LlmMessage {
                    role: "system".to_string(),
                    content: "Rules.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
                    provider_metadata: None,
                },
                LlmMessage {
                    role: "user".to_string(),
                    content: "Hello.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
                    provider_metadata: None,
                },
            ],
            parameters: json!({}),
            tools: Vec::new(),
        };
        let prompt = claude_subscription_prompt(&request);
        assert_eq!(prompt.system_prompt.as_deref(), Some("Rules."));
        assert_eq!(prompt.prompt, "User: Hello.");
        assert_eq!(prompt.session_id, None);
        assert_eq!(prompt.prompt_shape, "transcript-fold");
    }

    #[test]
    fn claude_subscription_runtime_chat_uses_stable_session_prompt() {
        let request = LlmRequest {
            connection: test_connection(),
            messages: vec![
                LlmMessage {
                    role: "system".to_string(),
                    content: "Rules.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
                    provider_metadata: None,
                },
                LlmMessage {
                    role: "assistant".to_string(),
                    content: "Earlier reply.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
                    provider_metadata: None,
                },
                LlmMessage {
                    role: "user".to_string(),
                    content: "Next turn.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
                    provider_metadata: None,
                },
            ],
            parameters: json!({ "_marinara": { "chatId": "chat-1", "mode": "roleplay" } }),
            tools: Vec::new(),
        };
        let prompt = claude_subscription_prompt(&request);
        assert_eq!(prompt.system_prompt.as_deref(), Some("Rules."));
        assert!(prompt
            .prompt
            .contains("Previous Marinara conversation:\nAssistant: Earlier reply."));
        assert!(prompt.prompt.contains("Current turn:\nUser: Next turn."));
        assert_eq!(prompt.prompt_shape, "trailing-user");
        let expected_session_id = claude_subscription_session_id("chat-1");
        assert_eq!(
            prompt.session_id.as_deref(),
            Some(expected_session_id.as_str())
        );
        assert!(Uuid::parse_str(prompt.session_id.as_deref().unwrap()).is_ok());
    }

    #[test]
    fn claude_subscription_regeneration_uses_transcript_fold() {
        let request = LlmRequest {
            connection: test_connection(),
            messages: vec![LlmMessage {
                role: "user".to_string(),
                content: "Regenerate from here.".to_string(),
                name: None,
                images: Vec::new(),
                tool_call_id: None,
                tool_calls: None,
                provider_metadata: None,
            }],
            parameters: json!({
                "_marinara": {
                    "chatId": "chat-1",
                    "regenerateMessageId": "message-1"
                }
            }),
            tools: Vec::new(),
        };
        let prompt = claude_subscription_prompt(&request);
        assert_eq!(prompt.prompt, "User: Regenerate from here.");
        assert_eq!(prompt.session_id, None);
        assert_eq!(prompt.prompt_shape, "transcript-fold");
    }

    #[test]
    fn claude_subscription_impersonation_uses_transcript_fold() {
        let request = LlmRequest {
            connection: test_connection(),
            messages: vec![
                LlmMessage {
                    role: "assistant".to_string(),
                    content: "Existing reply.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
                    provider_metadata: None,
                },
                LlmMessage {
                    role: "user".to_string(),
                    content: "Impersonated turn.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
                    provider_metadata: None,
                },
            ],
            parameters: json!({
                "_marinara": {
                    "chatId": "chat-1",
                    "impersonate": true
                }
            }),
            tools: Vec::new(),
        };
        let prompt = claude_subscription_prompt(&request);
        assert!(prompt.prompt.contains("Assistant: Existing reply."));
        assert!(prompt.prompt.contains("User: Impersonated turn."));
        assert_eq!(prompt.session_id, None);
        assert_eq!(prompt.prompt_shape, "transcript-fold");
    }

    #[test]
    fn claude_subscription_1m_suffix_maps_to_beta_arg_and_base_model() {
        let selection = claude_subscription_model_selection("claude-opus-4-8[1m]");

        assert_eq!(selection.configured_model, "claude-opus-4-8[1m]");
        assert_eq!(selection.cli_model, "claude-opus-4-8");
        assert!(selection.long_context_beta);
        assert_eq!(
            claude_subscription_model_args(&selection),
            vec![
                "--model".to_string(),
                "claude-opus-4-8".to_string(),
                "--betas".to_string(),
                "context-1m-2025-08-07".to_string(),
            ]
        );
    }

    #[test]
    fn claude_subscription_plain_model_does_not_add_beta_arg() {
        let selection = claude_subscription_model_selection("claude-sonnet-4-6");

        assert_eq!(selection.cli_model, "claude-sonnet-4-6");
        assert!(!selection.long_context_beta);
        assert_eq!(
            claude_subscription_model_args(&selection),
            vec!["--model".to_string(), "claude-sonnet-4-6".to_string()]
        );
    }

    #[test]
    fn claude_subscription_empty_json_result_is_an_error() {
        let error = parse_claude_subscription_output_rich(
            r#"{"type":"result","subtype":"success","result":"","usage":{"input_tokens":10,"output_tokens":0},"fast_mode_state":"off","modelUsage":{"claude-sonnet-4-5":{}}}"#,
            "claude-sonnet-4-5",
        )
        .expect_err("empty result JSON should fail");
        assert_eq!(error.code, "claude_subscription_empty");
        assert!(error.message.contains("output_tokens=0"));
        assert!(error.details.is_some());
    }
}
