use futures_util::StreamExt;
use marinara_core::{AppError, AppResult};
use marinara_security::is_allowed_outbound_url;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    env, fs,
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
};
use uuid::Uuid;

const OPENAI_CHATGPT_CODEX_BASE_URL: &str = "https://chatgpt.com/backend-api/codex";
const OPENAI_CHATGPT_REFRESH_URL: &str = "https://auth.openai.com/oauth/token";
const OPENAI_CHATGPT_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";
const APP_VERSION: &str = "1.6.1";

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
}

pub async fn complete(request: LlmRequest) -> AppResult<String> {
    Ok(complete_rich(request).await?.content)
}

pub async fn complete_rich(request: LlmRequest) -> AppResult<LlmCompletion> {
    match request.connection.provider.as_str() {
        "anthropic" => complete_anthropic(request)
            .await
            .map(|content| LlmCompletion {
                content,
                tool_calls: Vec::new(),
            }),
        "google" | "google_vertex" => complete_google(request).await.map(|content| LlmCompletion {
            content,
            tool_calls: Vec::new(),
        }),
        "claude_subscription" => {
            complete_claude_subscription(request)
                .await
                .map(|content| LlmCompletion {
                    content,
                    tool_calls: Vec::new(),
                })
        }
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
    } else if request.connection.provider != "anthropic"
        && request.connection.provider != "claude_subscription"
    {
        stream_openai_compatible(request, &mut emit).await?;
    } else {
        let result = complete_rich(request).await?;
        if !result.content.is_empty() {
            emit(json!({ "type": "token", "text": result.content, "data": result.content }))?;
        }
        for tool_call in result.tool_calls {
            emit(json!({ "type": "tool_call", "data": tool_call }))?;
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
        compact_json(&request.parameters),
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
            compact_json(&json!(&request.tools))
        );
    }
    eprintln!("[prompt-connections] body={}", compact_json(body));
}

pub fn unavailable_payload(message: impl Into<String>) -> Value {
    json!({ "type": "error", "error": message.into() })
}

fn base_url(provider: &str, configured: &str) -> String {
    let configured = configured.trim().trim_end_matches('/');
    if !configured.is_empty() {
        return configured.to_string();
    }
    match provider {
        "openai_chatgpt" => OPENAI_CHATGPT_CODEX_BASE_URL.to_string(),
        "anthropic" => "https://api.anthropic.com".to_string(),
        "google" => "https://generativelanguage.googleapis.com".to_string(),
        "google_vertex" => {
            "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1"
                .to_string()
        }
        "mistral" => "https://api.mistral.ai/v1".to_string(),
        "cohere" => "https://api.cohere.ai/compatibility/v1".to_string(),
        "openrouter" => "https://openrouter.ai/api/v1".to_string(),
        "nanogpt" => "https://nano-gpt.com/api/v1".to_string(),
        "xai" => "https://api.x.ai/v1".to_string(),
        _ => "https://api.openai.com/v1".to_string(),
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

fn ensure_url_allowed(url: &str) -> AppResult<()> {
    if is_allowed_outbound_url(url, true) {
        Ok(())
    } else {
        Err(AppError::invalid_input(format!(
            "Outbound URL is not allowed: {url}"
        )))
    }
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

fn reasoning_effort(parameters: &Value) -> Option<String> {
    let effort = param_string(parameters, &["reasoningEffort", "reasoning_effort"])?;
    match effort.as_str() {
        "low" | "medium" | "high" => Some(effort),
        "maximum" | "xhigh" => Some("high".to_string()),
        _ => None,
    }
}

fn model_contains(request: &LlmRequest, needle: &str) -> bool {
    request
        .connection
        .model
        .to_ascii_lowercase()
        .contains(needle)
}

fn is_openrouter_claude_reasoning_model(request: &LlmRequest) -> bool {
    if request.connection.provider != "openrouter" {
        return false;
    }
    let model = request.connection.model.to_ascii_lowercase();
    model.contains("claude-3.7")
        || model.contains("claude-3-7")
        || model.contains("claude-opus-4")
        || model.contains("claude-sonnet-4")
        || model.contains("claude-haiku-4")
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

fn supports_anthropic_adaptive_thinking(model: &str) -> bool {
    is_claude_opus_adaptive_only_model(model) || claude_version_at_least(model, "sonnet", 4, 5)
}

fn should_send_openai_sampling_parameters(request: &LlmRequest) -> bool {
    !is_claude_opus_adaptive_only_model(&request.connection.model)
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

fn is_gemini_3_model(model: &str) -> bool {
    let normalized = model.to_ascii_lowercase();
    normalized.starts_with("gemini-3")
        || normalized.starts_with("google/gemini-3")
        || normalized.contains("/gemini-3")
}

fn is_gemini_25_model(model: &str) -> bool {
    let normalized = model.to_ascii_lowercase();
    normalized.starts_with("gemini-2.5")
        || normalized.starts_with("google/gemini-2.5")
        || normalized.contains("/gemini-2.5")
}

fn google_thinking_level(parameters: &Value) -> Option<&'static str> {
    let effort = param_string(parameters, &["reasoningEffort", "reasoning_effort"])?;
    match effort.as_str() {
        "low" => Some("low"),
        "medium" => Some("medium"),
        "high" | "maximum" | "xhigh" => Some("high"),
        _ => None,
    }
}

fn google_thinking_config(model: &str, parameters: &Value) -> Option<Value> {
    if is_gemini_3_model(model) {
        return google_thinking_level(parameters)
            .map(|level| json!({ "thinkingLevel": level, "includeThoughts": true }));
    }

    if is_gemini_25_model(model) {
        let effort = param_string(parameters, &["reasoningEffort", "reasoning_effort"])?;
        let budget = match effort.as_str() {
            "low" => 1024,
            "medium" => 8192,
            "high" | "maximum" | "xhigh" => 24576,
            _ => return None,
        };
        return Some(json!({ "thinkingBudget": budget, "includeThoughts": true }));
    }

    None
}

fn anthropic_thinking_effort(parameters: &Value) -> Option<&'static str> {
    let effort = param_string(parameters, &["reasoningEffort", "reasoning_effort"])?;
    match effort.as_str() {
        "low" => Some("low"),
        "medium" => Some("medium"),
        "high" | "maximum" | "xhigh" => Some("high"),
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

fn should_send_top_k(request: &LlmRequest) -> bool {
    !matches!(
        request.connection.provider.as_str(),
        "openai" | "openrouter" | "xai" | "mistral" | "cohere" | "nanogpt"
    )
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
    .map(|message| message.chars().take(500).collect())
}

fn provider_http_error(status: reqwest::StatusCode, details: Value) -> AppError {
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
    trimmed.chars().take(500).collect()
}

fn provider_error_details_from_text(text: &str) -> Value {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return json!({});
    }
    serde_json::from_str::<Value>(trimmed)
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

async fn load_openai_chatgpt_auth() -> AppResult<ChatGptAuth> {
    let path = codex_auth_file_path();
    let raw = fs::read_to_string(&path).map_err(|error| {
        AppError::new(
            "openai_chatgpt_auth_missing",
            format!(
                "No Codex ChatGPT login found at {} ({error}). Run `codex login` on this host.",
                path.display()
            ),
        )
    })?;
    let mut auth_json: Value = serde_json::from_str(&raw)
        .map_err(|error| AppError::new("openai_chatgpt_auth_error", error.to_string()))?;
    let should_refresh = openai_chatgpt_auth_is_stale(&auth_json);
    let tokens = auth_json
        .get_mut("tokens")
        .and_then(Value::as_object_mut)
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
    if should_refresh {
        if let Some(refresh_token) = string_value(tokens.get("refresh_token")) {
            let refreshed = refresh_openai_chatgpt_auth(&refresh_token).await?;
            if let Some(next_access_token) = string_value(refreshed.get("access_token")) {
                tokens.insert(
                    "access_token".to_string(),
                    Value::String(next_access_token.clone()),
                );
                access_token = next_access_token;
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
            auth_json["last_refresh"] = Value::String(chrono_like_now_iso());
            let _ = fs::write(
                &path,
                format!(
                    "{}\n",
                    serde_json::to_string_pretty(&auth_json).unwrap_or(raw)
                ),
            );
        }
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

fn openai_chatgpt_auth_is_stale(auth_json: &Value) -> bool {
    let Some(last_refresh) = auth_json.get("last_refresh").and_then(Value::as_str) else {
        return false;
    };
    // Keep the same refresh cadence as the original provider without pulling in a date crate:
    // if the timestamp string is present but old parsing is unavailable, provider requests will
    // still work until the access token expires and the user can refresh through `codex login`.
    last_refresh.trim().is_empty()
}

async fn refresh_openai_chatgpt_auth(refresh_token: &str) -> AppResult<Value> {
    ensure_url_allowed(OPENAI_CHATGPT_REFRESH_URL)?;
    let response = reqwest::Client::new()
        .post(OPENAI_CHATGPT_REFRESH_URL)
        .json(&json!({
            "client_id": OPENAI_CHATGPT_CLIENT_ID,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }))
        .send()
        .await
        .map_err(|error| AppError::new("openai_chatgpt_auth_refresh_error", error.to_string()))?;
    parse_json_response(response, |json| Some(json.to_string()))
        .await
        .and_then(|raw| {
            serde_json::from_str::<Value>(&raw).map_err(|error| {
                AppError::new("openai_chatgpt_auth_refresh_error", error.to_string())
            })
        })
}

fn chrono_like_now_iso() -> String {
    format!("{:?}", std::time::SystemTime::now())
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
    let mut req = req
        .bearer_auth(auth.access_token)
        .header("version", APP_VERSION)
        .header("originator", "Marinara-Engine")
        .header("User-Agent", format!("MarinaraEngine/{APP_VERSION}"));
    if let Some(account_id) = auth.account_id {
        req = req.header("ChatGPT-Account-ID", account_id);
    }
    if auth.is_fedramp {
        req = req.header("X-OpenAI-Fedramp", "true");
    }
    Ok(req)
}

async fn complete_openai_compatible_rich(request: LlmRequest) -> AppResult<LlmCompletion> {
    if should_use_openai_responses(&request) {
        return complete_openai_responses_rich(request).await;
    }
    let base = base_url(&request.connection.provider, &request.connection.base_url);
    let url = format!("{base}/chat/completions");
    ensure_url_allowed(&url)?;
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
    let client = reqwest::Client::new();
    let mut req = client.post(url).json(&body);
    if !request.connection.api_key.trim().is_empty() {
        req = req.bearer_auth(request.connection.api_key.trim());
    }
    if request.connection.provider == "openrouter" {
        req = req
            .header("HTTP-Referer", "https://marinara.local")
            .header("X-Title", "Marinara Engine");
    }
    let response = req
        .send()
        .await
        .map_err(|error| AppError::new("llm_network_error", error.to_string()))?;
    parse_json_response_rich(response).await
}

async fn stream_openai_compatible(
    request: LlmRequest,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    let base = base_url(&request.connection.provider, &request.connection.base_url);
    let url = format!("{base}/chat/completions");
    ensure_url_allowed(&url)?;
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
    let client = reqwest::Client::new();
    let mut req = client.post(url).json(&body);
    if !request.connection.api_key.trim().is_empty() {
        req = req.bearer_auth(request.connection.api_key.trim());
    }
    if request.connection.provider == "openrouter" {
        req = req
            .header("HTTP-Referer", "https://marinara.local")
            .header("X-Title", "Marinara Engine");
    }
    let response = req
        .send()
        .await
        .map_err(|error| AppError::new("llm_network_error", error.to_string()))?;
    let status = response.status();
    if !status.is_success() {
        let error_body = response.json::<Value>().await.unwrap_or_else(|_| json!({}));
        return Err(provider_http_error(status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut tool_calls = OpenAiToolCallAccumulator::default();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| AppError::new("llm_stream_error", error.to_string()))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(block) = take_sse_block(&mut buffer) {
            process_openai_sse_block(&block, emit, &mut tool_calls)?;
        }
    }
    if !buffer.trim().is_empty() {
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

fn responses_input(messages: &[LlmMessage]) -> Value {
    Value::Array(
        messages
            .iter()
            .map(|message| {
                let role = if message.role == "assistant" {
                    "assistant"
                } else if message.role == "system" {
                    "system"
                } else {
                    "user"
                };
                if message.images.is_empty() {
                    json!({ "role": role, "content": message.content })
                } else {
                    let mut content = Vec::new();
                    if !message.content.is_empty() {
                        content.push(json!({ "type": "input_text", "text": message.content }));
                    }
                    for image in &message.images {
                        content.push(json!({ "type": "input_image", "image_url": image }));
                    }
                    json!({ "role": role, "content": content })
                }
            })
            .collect(),
    )
}

fn build_openai_responses_body(request: &LlmRequest, stream: bool) -> Value {
    let messages = request_messages(request);
    let mut body = json!({
        "model": request.connection.model,
        "input": responses_input(&messages),
        "stream": stream,
        "max_output_tokens": request_max_tokens(request, 1024),
    });
    if let Some(effort) = reasoning_effort(&request.parameters) {
        body["reasoning"] = json!({ "effort": effort, "summary": "auto" });
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
    if let Some(extra) = request
        .parameters
        .get("customParameters")
        .or_else(|| request.parameters.get("custom_params"))
    {
        if let Some(entries) = extra.as_object() {
            for (key, value) in entries {
                if !should_send_openai_sampling_parameters(request)
                    && is_sampling_parameter_key(key)
                {
                    continue;
                }
                if body.get(key).is_none() {
                    body[key] = value.clone();
                }
            }
        }
    }
    body
}

async fn openai_responses_request(
    request: &LlmRequest,
    body: &Value,
) -> AppResult<reqwest::Response> {
    let base = base_url(&request.connection.provider, &request.connection.base_url);
    let url = format!("{base}/responses");
    ensure_url_allowed(&url)?;
    log_prompt_connection_request("openai.responses", &url, request, body);
    let req = reqwest::Client::new().post(url).json(body);
    let req = if request.connection.provider == "openai_chatgpt" {
        apply_chatgpt_auth_headers(req).await?
    } else {
        apply_openai_auth_headers(req, request)
    };
    req.send()
        .await
        .map_err(|error| AppError::new("llm_network_error", error.to_string()))
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
    if content.trim().is_empty() && tool_calls.is_empty() {
        return Err(AppError::with_details(
            "llm_response_error",
            "Responses API result did not contain assistant text or tool calls",
            json,
        ));
    }
    Ok(LlmCompletion {
        content,
        tool_calls,
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
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| AppError::new("llm_stream_error", error.to_string()))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(block) = take_sse_block(&mut buffer) {
            process_openai_responses_sse_block(&block, emit)?;
        }
    }
    if !buffer.trim().is_empty() {
        process_openai_responses_sse_block(&buffer, emit)?;
    }
    Ok(())
}

fn process_openai_responses_sse_block(
    block: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
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
    if payload.is_empty() || payload == "[DONE]" {
        return Ok(());
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
        "response.function_call_arguments.delta" => {
            emit(json!({ "type": "tool_call", "data": value }))?;
        }
        "response.completed" => {
            if let Some(usage) = value
                .pointer("/response/usage")
                .or_else(|| value.get("usage"))
            {
                emit(json!({ "type": "usage", "data": usage }))?;
            }
        }
        "response.failed" | "response.incomplete" | "error" => {
            return Err(AppError::with_details(
                "llm_provider_error",
                format!("Responses API stream event {event_type}"),
                value,
            ));
        }
        _ => {}
    }
    Ok(())
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

fn process_openai_sse_block(
    block: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
    tool_calls: &mut OpenAiToolCallAccumulator,
) -> AppResult<()> {
    let payload = block
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix("data:"))
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n");
    if payload.is_empty() || payload == "[DONE]" {
        return Ok(());
    }
    let value: Value = serde_json::from_str(&payload)
        .map_err(|error| AppError::new("llm_stream_parse_error", error.to_string()))?;
    if let Some(usage) = value.get("usage").filter(|usage| !usage.is_null()) {
        emit(json!({ "type": "usage", "data": usage }))?;
    }
    let Some(choices) = value.get("choices").and_then(Value::as_array) else {
        return Ok(());
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
        if let Some(content) = delta.get("content").and_then(Value::as_str) {
            if !content.is_empty() {
                emit(json!({ "type": "token", "text": content, "data": content }))?;
            }
        }
    }
    Ok(())
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
        {
            body["frequency_penalty"] = json!(frequency_penalty);
        }
        if let Some(presence_penalty) =
            param_f64(parameters, &["presencePenalty", "presence_penalty"])
        {
            body["presence_penalty"] = json!(presence_penalty);
        }
    }
    if let Some(seed) = param_i64(parameters, &["seed"]) {
        body["seed"] = json!(seed);
    }
    if let Some(stop) = stop_sequences(parameters) {
        body["stop"] = json!(stop);
    }
    if let Some(format) = param_string(parameters, &["responseFormat", "response_format"]) {
        body["response_format"] = json!({ "type": format });
    }
    if request.connection.provider == "openrouter" {
        if is_openrouter_claude_reasoning_model(request) {
            if let Some(effort) = reasoning_effort(parameters) {
                body["reasoning"] = json!({ "effort": effort });
            }
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
            .filter(|value| value == "flex" || value == "priority")
        {
            body["service_tier"] = json!(service_tier);
        }
    }
    if let Some(extra) = parameters
        .get("customParameters")
        .or_else(|| parameters.get("custom_params"))
    {
        if let Some(entries) = extra.as_object() {
            for (key, value) in entries {
                if !should_send_openai_sampling_parameters(request)
                    && is_sampling_parameter_key(key)
                {
                    continue;
                }
                if body.get(key).is_none() {
                    body[key] = value.clone();
                }
            }
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
        return (
            (!system.is_empty()).then(|| system.join("\n\n")),
            "(continue)".to_string(),
            "trailing-assistant-continue",
        );
    }
    (
        (!system.is_empty()).then(|| system.join("\n\n")),
        if trailing.role == "tool" {
            format!("Tool result: {}", trailing.content.trim())
        } else {
            trailing.content.trim().to_string()
        },
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

fn parse_claude_subscription_output(raw: &str, requested_model: &str) -> AppResult<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(AppError::new(
            "claude_subscription_empty",
            "Claude Code returned an empty response.",
        ));
    }
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if let Some(text) = claude_subscription_text_from_json(&value) {
            log_claude_subscription_status(&value, requested_model);
            return Ok(text);
        }
        if claude_subscription_json_declares_empty_result(&value) {
            let diagnostic = claude_subscription_output_diagnostic(&value)
                .unwrap_or_else(|| "no diagnostic fields returned".to_string());
            return Err(AppError::with_details(
                "claude_subscription_empty",
                format!("Claude Code returned no content ({diagnostic})."),
                value,
            ));
        }
    }
    let mut text = String::new();
    let mut empty_result_diagnostic: Option<Value> = None;
    for line in trimmed.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<Value>(line) {
            if let Some(piece) = claude_subscription_text_from_json(&value) {
                log_claude_subscription_status(&value, requested_model);
                text.push_str(&piece);
            } else if claude_subscription_json_declares_empty_result(&value) {
                empty_result_diagnostic = Some(value);
            }
        }
    }
    if !text.trim().is_empty() {
        return Ok(text);
    }
    if let Some(value) = empty_result_diagnostic {
        let diagnostic = claude_subscription_output_diagnostic(&value)
            .unwrap_or_else(|| "no diagnostic fields returned".to_string());
        return Err(AppError::with_details(
            "claude_subscription_empty",
            format!("Claude Code returned no content ({diagnostic})."),
            value,
        ));
    }
    Ok(trimmed.to_string())
}

async fn complete_claude_subscription(request: LlmRequest) -> AppResult<String> {
    let prompt_selection = claude_subscription_prompt(&request);
    let mut command = Command::new(claude_subscription_command());
    command
        .arg("-p")
        .arg("--model")
        .arg(&request.connection.model)
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
            "model": request.connection.model.clone(),
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
                stderr.trim().to_string()
            },
            json!({
                "status": output.status.code(),
                "stdout": stdout.chars().take(1000).collect::<String>(),
            }),
        ));
    }
    parse_claude_subscription_output(&stdout, &request.connection.model)
}

async fn complete_anthropic(request: LlmRequest) -> AppResult<String> {
    let base = base_url(&request.connection.provider, &request.connection.base_url);
    let url = anthropic_endpoint(&base, "messages");
    ensure_url_allowed(&url)?;
    let mut system = Vec::new();
    let mut anthropic_messages = Vec::new();
    let messages = request_messages(&request);
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
        "max_tokens": request_max_tokens(&request, 1024),
    });
    if !system.is_empty() {
        body["system"] = json!(system.join("\n\n"));
    }
    let adaptive_only = is_claude_opus_adaptive_only_model(&request.connection.model);
    let thinking_effort = anthropic_thinking_effort(&request.parameters);
    let adaptive_thinking = thinking_effort.is_some()
        && supports_anthropic_adaptive_thinking(&request.connection.model);
    if !adaptive_only && !adaptive_thinking {
        if let Some(temp) = temperature(&request.parameters) {
            body["temperature"] = json!(temp);
        }
    }
    if !adaptive_only {
        if let Some(top_k) = param_i64(&request.parameters, &["topK", "top_k"]) {
            body["top_k"] = json!(top_k);
        }
    }
    if let Some(effort) = thinking_effort {
        if adaptive_thinking {
            body["thinking"] = json!({ "type": "adaptive" });
            body["output_config"] = json!({ "effort": effort });
        } else {
            let budget_tokens = anthropic_thinking_budget_tokens(effort);
            body["thinking"] = json!({ "type": "enabled", "budget_tokens": budget_tokens });
            body["max_tokens"] = json!(request_max_tokens(&request, 1024) + budget_tokens);
        }
    }
    if let Some(stop) = stop_sequences(&request.parameters) {
        body["stop_sequences"] = json!(stop);
    }
    log_prompt_connection_request("anthropic.messages", &url, &request, &body);
    let response = reqwest::Client::new()
        .post(url)
        .header("x-api-key", request.connection.api_key.trim())
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|error| AppError::new("llm_network_error", error.to_string()))?;
    parse_json_response(response, |json| {
        json.get("content")
            .and_then(Value::as_array)
            .and_then(|items| {
                items
                    .iter()
                    .filter_map(|item| item.get("text").and_then(Value::as_str))
                    .find(|text| !text.trim().is_empty())
            })
            .map(ToOwned::to_owned)
    })
    .await
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
    if let Some(thinking_config) =
        google_thinking_config(&request.connection.model, &request.parameters)
    {
        generation_config["thinkingConfig"] = thinking_config;
    }
    if !is_gemini_3 {
        if let Some(stop) = stop_sequences(&request.parameters) {
            generation_config["stopSequences"] = json!(stop);
        }
    }
    generation_config
}

fn google_generate_body(request: &LlmRequest) -> Value {
    let mut body = json!({
        "contents": google_contents(request),
        "generationConfig": google_generation_config(request),
    });
    if let Some(system_instruction) = google_system_instruction(request) {
        body["systemInstruction"] = system_instruction;
    }
    body
}

async fn complete_google(request: LlmRequest) -> AppResult<String> {
    let url = google_endpoint(&request, "generateContent", false);
    ensure_url_allowed(&url)?;
    let body = google_generate_body(&request);
    log_prompt_connection_request("google.generateContent", &url, &request, &body);
    let response = reqwest::Client::new()
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|error| AppError::new("llm_network_error", error.to_string()))?;
    parse_json_response(response, |json| {
        json.get("candidates")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|candidate| candidate.get("content"))
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
    })
    .await
}

async fn stream_google(
    request: LlmRequest,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    let url = google_endpoint(&request, "streamGenerateContent", true);
    ensure_url_allowed(&url)?;
    let body = google_generate_body(&request);
    log_prompt_connection_request("google.streamGenerateContent", &url, &request, &body);
    let response = reqwest::Client::new()
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|error| AppError::new("llm_network_error", error.to_string()))?;
    let status = response.status();
    if !status.is_success() {
        let error_body = read_error_response_details(response).await?;
        return Err(provider_http_error(status, error_body));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| AppError::new("llm_stream_error", error.to_string()))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(block) = take_sse_block(&mut buffer) {
            process_google_sse_block(&block, emit)?;
        }
    }
    if !buffer.trim().is_empty() {
        process_google_sse_block(&buffer, emit)?;
    }
    Ok(())
}

fn process_google_sse_block(
    block: &str,
    emit: &mut (impl FnMut(Value) -> AppResult<()> + Send),
) -> AppResult<()> {
    let payload = block
        .lines()
        .filter_map(|line| line.trim_start().strip_prefix("data:"))
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n");
    if payload.is_empty() || payload == "[DONE]" {
        return Ok(());
    }
    let value: Value = serde_json::from_str(&payload)
        .map_err(|error| AppError::new("llm_stream_parse_error", error.to_string()))?;
    if let Some(error) = value.get("error") {
        return Err(AppError::with_details(
            "llm_provider_error",
            "Gemini API stream error",
            error.clone(),
        ));
    }
    if let Some(usage) = value.get("usageMetadata") {
        emit(json!({ "type": "usage", "data": usage }))?;
    }
    let Some(candidates) = value.get("candidates").and_then(Value::as_array) else {
        return Ok(());
    };
    for candidate in candidates {
        let Some(parts) = candidate
            .get("content")
            .and_then(|content| content.get("parts"))
            .and_then(Value::as_array)
        else {
            continue;
        };
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
    Ok(())
}

async fn read_error_response_details(response: reqwest::Response) -> AppResult<Value> {
    let text = response
        .text()
        .await
        .map_err(|error| AppError::new("llm_response_error", error.to_string()))?;
    Ok(provider_error_details_from_text(&text))
}

async fn read_json_response(
    response: reqwest::Response,
) -> AppResult<(reqwest::StatusCode, Value)> {
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| AppError::new("llm_response_error", error.to_string()))?;
    if !status.is_success() {
        return Ok((status, provider_error_details_from_text(&text)));
    }
    let json = serde_json::from_str::<Value>(&text).map_err(|error| {
        AppError::with_details(
            "llm_response_error",
            format!("Provider response was not valid JSON: {error}"),
            json!({ "body": sanitize_provider_error_text(&text) }),
        )
    })?;
    Ok((status, json))
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
            json,
        )
    })
}

fn content_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Array(parts) => parts
            .iter()
            .filter_map(|part| {
                if let Some(text) = part.as_str() {
                    return Some(text.to_string());
                }
                part.get("text")
                    .and_then(Value::as_str)
                    .or_else(|| part.get("content").and_then(Value::as_str))
                    .map(str::to_string)
            })
            .collect::<Vec<_>>()
            .join(""),
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
                json.clone(),
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
                json,
            ));
        }
        return Err(AppError::with_details(
            "llm_response_error",
            "Provider response did not contain assistant text or tool calls",
            json,
        ));
    }
    Ok(LlmCompletion {
        content,
        tool_calls,
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

        process_openai_sse_block(
            r#"data: {"choices":[{"delta":{"content":"Rolling...","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"roll_dice","arguments":"{\"notation\""}}]}}]}"#,
            &mut emit,
            &mut tool_calls,
        )
        .expect("first chunk should parse");
        process_openai_sse_block(
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
                "stop": ["</END>"]
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
        assert!(config.get("stopSequences").is_none());
    }

    #[test]
    fn google_stream_sse_emits_thinking_tokens_and_usage() {
        let mut emitted = Vec::new();
        let mut emit = |value: Value| {
            emitted.push(value);
            Ok(())
        };

        process_google_sse_block(
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
        assert!(supports_anthropic_adaptive_thinking("claude-opus-4-7"));
        assert!(supports_anthropic_adaptive_thinking("claude-opus-5-6"));
        assert!(supports_anthropic_adaptive_thinking("claude-sonnet-4-5"));
        assert!(!supports_anthropic_adaptive_thinking(
            "claude-opus-4-20250514"
        ));
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
                },
                LlmMessage {
                    role: "user".to_string(),
                    content: "Hello.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
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
                },
                LlmMessage {
                    role: "assistant".to_string(),
                    content: "Earlier reply.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
                },
                LlmMessage {
                    role: "user".to_string(),
                    content: "Next turn.".to_string(),
                    name: None,
                    images: Vec::new(),
                    tool_call_id: None,
                    tool_calls: None,
                },
            ],
            parameters: json!({ "_marinara": { "chatId": "chat-1", "mode": "roleplay" } }),
            tools: Vec::new(),
        };
        let prompt = claude_subscription_prompt(&request);
        assert_eq!(prompt.system_prompt.as_deref(), Some("Rules."));
        assert_eq!(prompt.prompt, "Next turn.");
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
    fn claude_subscription_empty_json_result_is_an_error() {
        let error = parse_claude_subscription_output(
            r#"{"type":"result","subtype":"success","result":"","usage":{"input_tokens":10,"output_tokens":0},"fast_mode_state":"off","modelUsage":{"claude-sonnet-4-5":{}}}"#,
            "claude-sonnet-4-5",
        )
        .expect_err("empty result JSON should fail");
        assert_eq!(error.code, "claude_subscription_empty");
        assert!(error.message.contains("output_tokens=0"));
        assert!(error.details.is_some());
    }
}
