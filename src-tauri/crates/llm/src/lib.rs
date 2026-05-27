use futures_util::StreamExt;
use marinara_core::{AppError, AppResult};
use marinara_security::is_allowed_outbound_url;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    env, fs,
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
};

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
    } else if request.connection.provider != "anthropic"
        && request.connection.provider != "google"
        && request.connection.provider != "google_vertex"
        && request.connection.provider != "claude_subscription"
        && request.tools.is_empty()
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
        "google" | "google_vertex" => "https://generativelanguage.googleapis.com".to_string(),
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
        "maximum" => Some("high".to_string()),
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
        return google_thinking_level(parameters).map(|level| json!({ "thinkingLevel": level }));
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
    if let Some(temp) = temperature(&request.parameters) {
        body["temperature"] = json!(temp);
    }
    apply_openai_parameters(&mut body, &request);
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
    if let Some(temp) = temperature(&request.parameters) {
        body["temperature"] = json!(temp);
    }
    apply_openai_parameters(&mut body, &request);
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
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| AppError::new("llm_stream_error", error.to_string()))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(index) = buffer.find("\n\n") {
            let block = buffer[..index].to_string();
            buffer = buffer[index + 2..].to_string();
            process_openai_sse_block(&block, emit)?;
        }
    }
    if !buffer.trim().is_empty() {
        process_openai_sse_block(&buffer, emit)?;
    }
    Ok(())
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
    let status = response.status();
    let json: Value = response
        .json()
        .await
        .map_err(|error| AppError::new("llm_response_error", error.to_string()))?;
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
        let error_body = response.json::<Value>().await.unwrap_or_else(|_| json!({}));
        return Err(provider_http_error(status, error_body));
    }
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| AppError::new("llm_stream_error", error.to_string()))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(index) = buffer.find("\n\n") {
            let block = buffer[..index].to_string();
            buffer = buffer[index + 2..].to_string();
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

fn process_openai_sse_block(
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
    if let Some(usage) = value.get("usage").filter(|usage| !usage.is_null()) {
        emit(json!({ "type": "usage", "data": usage }))?;
    }
    let Some(choices) = value.get("choices").and_then(Value::as_array) else {
        return Ok(());
    };
    for choice in choices {
        let delta = choice.get("delta").unwrap_or(choice);
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
    if let Some(top_p) = param_f64(parameters, &["topP", "top_p"]) {
        body["top_p"] = json!(top_p);
    }
    if should_send_top_k(request) {
        if let Some(top_k) = param_i64(parameters, &["topK", "top_k"]).filter(|value| *value > 0) {
            body["top_k"] = json!(top_k);
        }
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
    }
    if let Some(extra) = parameters
        .get("customParameters")
        .or_else(|| parameters.get("custom_params"))
    {
        if let Some(entries) = extra.as_object() {
            for (key, value) in entries {
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
    Ok("Claude Code command is available. The first chat will fail if `claude login` has not been run on this host.".to_string())
}

fn claude_subscription_text_from_json(value: &Value) -> Option<String> {
    if let Some(text) = value.get("result").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    if let Some(text) = value.get("response").and_then(Value::as_str) {
        return Some(text.to_string());
    }
    if let Some(text) = value.get("text").and_then(Value::as_str) {
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

fn parse_claude_subscription_output(raw: &str) -> AppResult<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(AppError::new(
            "claude_subscription_empty",
            "Claude Code returned an empty response.",
        ));
    }
    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if let Some(text) = claude_subscription_text_from_json(&value) {
            return Ok(text);
        }
    }
    let mut text = String::new();
    for line in trimmed.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<Value>(line) {
            if let Some(piece) = claude_subscription_text_from_json(&value) {
                text.push_str(&piece);
            }
        }
    }
    if !text.trim().is_empty() {
        return Ok(text);
    }
    Ok(trimmed.to_string())
}

async fn complete_claude_subscription(request: LlmRequest) -> AppResult<String> {
    let messages = request_messages(&request);
    let (system_prompt, prompt) = render_claude_subscription_transcript(&messages);
    let mut command = Command::new(claude_subscription_command());
    command
        .arg("-p")
        .arg("--model")
        .arg(&request.connection.model)
        .arg("--output-format")
        .arg("json")
        .arg("--permission-mode")
        .arg("bypassPermissions")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(system_prompt) = system_prompt.as_ref() {
        command.arg("--append-system-prompt").arg(system_prompt);
    }
    if !request.connection.api_key.trim().is_empty() {
        command.env("ANTHROPIC_API_KEY", request.connection.api_key.trim());
    }
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
            .write_all(prompt.as_bytes())
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
    parse_claude_subscription_output(&stdout)
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
    if let Some(temp) = temperature(&request.parameters) {
        body["temperature"] = json!(temp);
    }
    if let Some(top_p) = param_f64(&request.parameters, &["topP", "top_p"]) {
        body["top_p"] = json!(top_p);
    }
    if let Some(top_k) = param_i64(&request.parameters, &["topK", "top_k"]) {
        body["top_k"] = json!(top_k);
    }
    if let Some(stop) = stop_sequences(&request.parameters) {
        body["stop_sequences"] = json!(stop);
    }
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
                    .find_map(|item| item.get("text").and_then(Value::as_str))
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

async fn complete_google(request: LlmRequest) -> AppResult<String> {
    let base = base_url(&request.connection.provider, &request.connection.base_url);
    let base = if request.connection.provider == "google"
        && (base.ends_with("/v1beta") || base.ends_with("/v1"))
    {
        base
    } else if request.connection.provider == "google" {
        format!("{base}/v1beta")
    } else {
        base
    };
    let url = if request.connection.provider == "google_vertex" {
        google_vertex_endpoint(&base, &request.connection.model, "generateContent")
    } else {
        format!(
            "{base}/models/{}:generateContent?key={}",
            request.connection.model,
            request.connection.api_key.trim()
        )
    };
    ensure_url_allowed(&url)?;
    let contents: Vec<Value> = request_messages(&request)
        .into_iter()
        .filter(|message| message.role != "system")
        .map(|message| {
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
            json!({ "role": role, "parts": parts })
        })
        .collect();
    let is_gemini_3 = is_gemini_3_model(&request.connection.model);
    let mut body = json!({
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": request_max_tokens(&request, 1024),
        }
    });
    if !is_gemini_3 {
        body["generationConfig"]["temperature"] = json!(temperature(&request.parameters).unwrap_or(0.7));
        if let Some(top_p) = param_f64(&request.parameters, &["topP", "top_p"]) {
            body["generationConfig"]["topP"] = json!(top_p);
        }
        if let Some(top_k) = param_i64(&request.parameters, &["topK", "top_k"]).filter(|value| *value > 0) {
            body["generationConfig"]["topK"] = json!(top_k);
        }
    }
    if let Some(thinking_config) = google_thinking_config(&request.connection.model, &request.parameters) {
        body["generationConfig"]["thinkingConfig"] = thinking_config;
    }
    if let Some(stop) = stop_sequences(&request.parameters) {
        body["generationConfig"]["stopSequences"] = json!(stop);
    }
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
                parts
                    .iter()
                    .find_map(|part| part.get("text").and_then(Value::as_str))
            })
            .map(ToOwned::to_owned)
    })
    .await
}

async fn parse_json_response<F>(response: reqwest::Response, extract: F) -> AppResult<String>
where
    F: Fn(&Value) -> Option<String>,
{
    let status = response.status();
    let json: Value = response
        .json()
        .await
        .map_err(|error| AppError::new("llm_response_error", error.to_string()))?;
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
    let status = response.status();
    let json: Value = response
        .json()
        .await
        .map_err(|error| AppError::new("llm_response_error", error.to_string()))?;
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
