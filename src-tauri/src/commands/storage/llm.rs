use super::prompts;
use super::*;
use marinara_security::{
    is_allowed_provider_url, is_forbidden_provider_resolved_ip, is_loopback_provider_host,
    redact_sensitive_text,
};
use std::net::{IpAddr, SocketAddr};

const PROVIDER_LOCAL_URLS_ENABLED_FLAG: &str = "PROVIDER_LOCAL_URLS_ENABLED";
const IMAGE_LOCAL_URLS_ENABLED_FLAG: &str = "IMAGE_LOCAL_URLS_ENABLED";
const PROVIDER_CONFIG_MAX_RESPONSE_BYTES: usize = 5 * 1024 * 1024;

pub(crate) fn resolve_llm_connection_for_request(
    state: &AppState,
    body: &Value,
) -> AppResult<Value> {
    if let Some(connection) = body.get("connection").filter(|value| value.is_object()) {
        return Ok(connection.clone());
    }
    if let Some(connection_id) = body
        .get("connectionId")
        .and_then(Value::as_str)
        .filter(|id| !id.is_empty())
    {
        return connection_secrets::connection_for_runtime(state, connection_id);
    }
    if body.get("provider").is_some() && body.get("model").is_some() {
        return Ok(body.clone());
    }
    let connections = connection_secrets::connections_for_runtime(state)?;
    if let Some(default) = connections
        .iter()
        .find(|connection| {
            connection
                .get("isDefault")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .cloned()
    {
        return Ok(default);
    }
    connections
        .into_iter()
        .next()
        .ok_or_else(|| AppError::invalid_input("No LLM connection is configured"))
}

pub(crate) fn llm_request_from_body(
    state: &AppState,
    body: Value,
) -> AppResult<marinara_llm::LlmRequest> {
    let connection = resolve_llm_connection_for_request(state, &body)?;
    let messages = body
        .get("messages")
        .and_then(Value::as_array)
        .ok_or_else(|| AppError::invalid_input("messages is required"))?
        .iter()
        .map(|message| {
            Ok(marinara_llm::LlmMessage {
                role: message
                    .get("role")
                    .and_then(Value::as_str)
                    .unwrap_or("user")
                    .to_string(),
                content: message
                    .get("content")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                name: message
                    .get("name")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                images: message
                    .get("images")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .filter_map(Value::as_str)
                            .filter(|value| !value.trim().is_empty())
                            .map(str::to_string)
                            .collect()
                    })
                    .unwrap_or_default(),
                tool_call_id: message
                    .get("tool_call_id")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                tool_calls: message.get("tool_calls").cloned(),
            })
        })
        .collect::<AppResult<Vec<_>>>()?;
    Ok(marinara_llm::LlmRequest {
        connection: llm_connection_from_value(&connection)?,
        messages,
        parameters: body.get("parameters").cloned().unwrap_or_else(|| json!({})),
        tools: body
            .get("tools")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default(),
    })
}

pub(crate) async fn llm_complete(state: &AppState, body: Value) -> AppResult<Value> {
    let content = marinara_llm::complete(llm_request_from_body(state, body)?).await?;
    Ok(Value::String(content))
}

pub(crate) async fn llm_embed(state: &AppState, body: Value) -> AppResult<Value> {
    let inputs = embedding_inputs(&body)?;
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
    let mut data = Vec::with_capacity(inputs.len());
    for (index, input) in inputs.iter().enumerate() {
        data.push(json!({
            "object": "embedding",
            "index": index,
            "embedding": prompts::embed_text(&connection, &model, input).await?
        }));
    }
    Ok(json!({
        "object": "list",
        "data": data,
        "model": model,
        "marinara": {
            "embeddingConnectionId": connection_id
        }
    }))
}

fn embedding_inputs(body: &Value) -> AppResult<Vec<String>> {
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
                .collect::<AppResult<Vec<_>>>()?;
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

pub(crate) async fn llm_stream_channel(
    state: &AppState,
    stream_id: String,
    body: Value,
    on_event: tauri::ipc::Channel<Value>,
) -> AppResult<()> {
    llm_stream_events(state, stream_id, body, |event| {
        on_event
            .send(event)
            .map_err(|error| AppError::new("stream_channel_error", error.to_string()))
    })
    .await
}

pub(crate) async fn llm_stream_events(
    state: &AppState,
    stream_id: String,
    body: Value,
    mut emit: impl FnMut(Value) -> AppResult<()> + Send,
) -> AppResult<()> {
    let request = llm_request_from_body(state, body)?;
    let mut cancellation = state.register_llm_stream(&stream_id)?;
    if *cancellation.borrow() {
        state.unregister_llm_stream(&stream_id);
        return Ok(());
    }
    let result = tokio::select! {
        result = marinara_llm::stream_events(request, &mut emit) => result,
        _ = cancellation.changed() => Ok(()),
    };
    state.unregister_llm_stream(&stream_id);
    result
}

pub(crate) fn llm_stream_cancel(state: &AppState, stream_id: &str) -> AppResult<Value> {
    Ok(json!({ "cancelled": state.cancel_llm_stream(stream_id)? }))
}

struct ModelLookupResult {
    models: Vec<Value>,
    from_provider: bool,
    fallback: bool,
    provider_error: Option<AppError>,
}

pub(crate) async fn llm_models(state: &AppState, connection_id: Option<&str>) -> AppResult<Value> {
    let lookup = lookup_llm_models(state, connection_id).await?;
    Ok(Value::Array(lookup.models))
}

async fn lookup_llm_models(
    state: &AppState,
    connection_id: Option<&str>,
) -> AppResult<ModelLookupResult> {
    let connection = if let Some(id) = connection_id {
        Some(connection_secrets::connection_for_runtime(state, id)?)
    } else {
        connection_secrets::connections_for_runtime(state)?
            .into_iter()
            .next()
    };
    let provider = connection
        .as_ref()
        .and_then(|value| value.get("provider"))
        .and_then(Value::as_str)
        .unwrap_or("openai");
    let mut from_provider = false;
    let mut fallback = false;
    let mut provider_error = None;
    let mut models = match connection.as_ref() {
        Some(connection) => match fetch_provider_models(connection).await {
            Ok(models) => {
                from_provider = true;
                models
            }
            Err(error) => {
                fallback = true;
                provider_error = Some(error);
                provider_model_catalog(provider)
            }
        },
        None => {
            fallback = true;
            provider_model_catalog(provider)
        }
    };
    if let Some(connection) = connection.as_ref() {
        for key in ["model", "embeddingModel", "imageModel"] {
            if let Some(model) = connection
                .get(key)
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
            {
                push_model(&mut models, model, provider);
            }
        }
    }
    if fallback {
        for model in &mut models {
            if let Some(object) = model.as_object_mut() {
                object.insert("fromProvider".to_string(), Value::Bool(false));
                object.insert("fallback".to_string(), Value::Bool(true));
                if let Some(error) = provider_error.as_ref() {
                    object.insert(
                        "providerError".to_string(),
                        Value::String(error.message.clone()),
                    );
                    object.insert(
                        "providerErrorCode".to_string(),
                        Value::String(error.code.clone()),
                    );
                }
            }
        }
    }
    Ok(ModelLookupResult {
        models,
        from_provider,
        fallback,
        provider_error,
    })
}
pub(crate) fn llm_connection_from_value(value: &Value) -> AppResult<marinara_llm::LlmConnection> {
    let provider = value
        .get("provider")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("Connection provider is required"))?
        .to_string();
    let model = value
        .get("model")
        .and_then(Value::as_str)
        .filter(|model| !model.trim().is_empty())
        .ok_or_else(|| AppError::invalid_input("Connection model is required"))?
        .to_string();
    let api_key = value
        .get("apiKey")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let base_url = value
        .get("baseUrl")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let openrouter_provider = value
        .get("openrouterProvider")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let enable_caching = match value.get("enableCaching") {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(value)) => value.eq_ignore_ascii_case("true"),
        _ => false,
    };
    let caching_at_depth = value.get("cachingAtDepth").and_then(|value| {
        value
            .as_u64()
            .or_else(|| value.as_str()?.parse::<u64>().ok())
    });
    let max_tokens_override = value
        .get("maxTokensOverride")
        .and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_str()?.parse::<u64>().ok())
        })
        .filter(|value| *value > 0);
    let claude_fast_mode = match value.get("claudeFastMode") {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(value)) => value.eq_ignore_ascii_case("true"),
        _ => false,
    };
    Ok(marinara_llm::LlmConnection {
        provider,
        model,
        api_key,
        base_url,
        openrouter_provider,
        enable_caching,
        caching_at_depth,
        max_tokens_override,
        claude_fast_mode,
    })
}

pub(crate) async fn connection_models(state: &AppState, id: &str) -> AppResult<Value> {
    let lookup = lookup_llm_models(state, Some(id)).await?;
    let mut response = json!({
        "models": lookup.models,
        "fromProvider": lookup.from_provider,
        "fallback": lookup.fallback
    });
    if let Some(error) = lookup.provider_error {
        response["providerError"] = json!(error.message);
        response["providerErrorCode"] = json!(error.code);
    }
    Ok(response)
}

pub(crate) async fn connection_auth_check(state: &AppState, id: &str) -> AppResult<Value> {
    let started = std::time::Instant::now();
    let connection = connection_secrets::connection_for_runtime(state, id)?;
    let model_name = connection
        .get("model")
        .and_then(Value::as_str)
        .map(str::to_string);
    match check_connection_without_generation(&connection).await {
        Ok(outcome) => Ok(json!({
            "success": !outcome.warning,
            "warning": outcome.warning,
            "message": outcome.message,
            "latencyMs": started.elapsed().as_millis(),
            "modelName": model_name,
        })),
        Err(error) => {
            let mut response = json!({
                "success": false,
                "message": error.message,
                "latencyMs": started.elapsed().as_millis(),
                "modelName": Value::Null,
                "code": error.code,
            });
            if let Some(details) = error.details {
                response["details"] = details;
            }
            Ok(response)
        }
    }
}

pub(crate) async fn connection_diagnose_claude_subscription(
    state: &AppState,
    id: &str,
) -> AppResult<Value> {
    let connection = connection_secrets::connection_for_runtime(state, id)?;
    if connection.get("provider").and_then(Value::as_str) != Some("claude_subscription") {
        return Err(AppError::invalid_input(
            "Not a Claude (Subscription) connection",
        ));
    }
    let model = connection
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let fast_mode = connection
        .get("claudeFastMode")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    marinara_llm::diagnose_claude_subscription_model(model, fast_mode)
}

#[derive(Debug)]
struct ConnectionCheckOutcome {
    message: String,
    warning: bool,
}

impl ConnectionCheckOutcome {
    fn success(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            warning: false,
        }
    }

    fn warning(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            warning: true,
        }
    }
}

async fn check_connection_without_generation(
    connection: &Value,
) -> AppResult<ConnectionCheckOutcome> {
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    match provider {
        "openai_chatgpt" => marinara_llm::check_openai_chatgpt_auth()
            .await
            .map(ConnectionCheckOutcome::success),
        "claude_subscription" => {
            marinara_llm::check_claude_subscription_available().map(ConnectionCheckOutcome::success)
        }
        "openrouter" => check_openrouter_key(connection)
            .await
            .map(ConnectionCheckOutcome::success),
        "nanogpt" => check_nanogpt_connection(connection).await,
        "image_generation" => check_image_generation_connection(connection)
            .await
            .map(ConnectionCheckOutcome::success),
        _ => {
            let models = fetch_provider_models(connection).await?;
            if models.is_empty() {
                Ok(ConnectionCheckOutcome::success("Connection successful."))
            } else {
                Ok(ConnectionCheckOutcome::success(format!(
                    "Connection successful. {} model{} available.",
                    models.len(),
                    if models.len() == 1 { "" } else { "s" }
                )))
            }
        }
    }
}

async fn check_nanogpt_connection(connection: &Value) -> AppResult<ConnectionCheckOutcome> {
    let _api_key = connection_api_key(connection)?;
    let models = fetch_provider_models(connection).await?;
    let count = models.len();
    let suffix = if count == 1 { "" } else { "s" };
    Ok(ConnectionCheckOutcome::warning(format!(
        "NanoGPT model list is reachable ({count} model{suffix} available), but this does not verify generation auth/payment. Use Send Test Message to verify the saved key can generate."
    )))
}

async fn check_openrouter_key(connection: &Value) -> AppResult<String> {
    let api_key = connection_api_key(connection)?;
    let base = connection_base_url(connection);
    let url = format!("{}/key", base.trim_end_matches('/'));
    let policy = provider_url_policy_for_connection(connection);
    let json = send_connection_test_get(&url, policy, "OpenRouter", |request| {
        request
            .header("accept", "application/json")
            .bearer_auth(&api_key)
            .header("HTTP-Referer", "https://marinara.local")
            .header("X-Title", "Marinara Engine")
    })
    .await?;
    let remaining = json
        .pointer("/data/limit_remaining")
        .and_then(Value::as_f64)
        .map(|value| format!(" Limit remaining: {value}."))
        .unwrap_or_default();
    Ok(format!("OpenRouter API key is valid.{remaining}"))
}

async fn check_image_generation_connection(connection: &Value) -> AppResult<String> {
    let source = super::images::image_generation_source(connection);
    let base = super::images::image_connection_base_url(connection, &source);
    let source = if source.trim().is_empty() {
        "openai"
    } else {
        source.as_str()
    };
    match source {
        "runpod_comfyui" => Ok(
            "RunPod endpoint is configured. Use Test Image to verify generation because RunPod has no lightweight validation endpoint."
                .to_string(),
        ),
        "openrouter" | "gemini_image" => check_openrouter_key_for_base(connection, &base).await,
        "google_image" => {
            // Google's native API authenticates with x-goog-api-key, not bearer auth.
            // Listing models is a lightweight way to validate the AI Studio key.
            let url = format!("{}/models", base.trim_end_matches('/'));
            check_google_api_key_get(&url, connection, "Google").await?;
            Ok("Google AI Studio API key is valid.".to_string())
        }
        "novelai" => {
            check_bearer_get("https://api.novelai.net/user/subscription", connection, "NovelAI")
                .await?;
            Ok("NovelAI API key is valid.".to_string())
        }
        "horde" => {
            let url = build_horde_url(&base, "status/heartbeat");
            let policy = provider_url_policy_for_connection(connection);
            let api_key = connection_api_key_optional(connection);
            send_connection_test_get(&url, policy, "Stable Horde", |request| {
                request
                    .header("accept", "application/json")
                    .header(
                        "apikey",
                        if api_key.trim().is_empty() {
                            "0000000000"
                        } else {
                            api_key.trim()
                        },
                    )
                    .header("Client-Agent", "Marinara-Engine")
            })
            .await?;
            Ok("Stable Horde endpoint is reachable.".to_string())
        }
        "stability" => {
            let url = stability_url(&base, "v1/user/account");
            check_bearer_get(&url, connection, "Stability").await?;
            Ok("Stability API key is valid.".to_string())
        }
        "comfyui" => {
            let url = format!("{base}/system_stats");
            check_optional_bearer_get(&url, connection, "ComfyUI").await?;
            Ok("ComfyUI endpoint is reachable.".to_string())
        }
        "automatic1111" | "drawthings" => {
            let url = super::images::image_sdapi_url(&base, "options");
            check_optional_bearer_get(&url, connection, "Stable Diffusion Web UI").await?;
            Ok("Stable Diffusion Web UI endpoint is reachable.".to_string())
        }
        "pollinations" => {
            let url = format!("{base}/models");
            check_optional_bearer_get(&url, connection, "Pollinations").await?;
            Ok("Pollinations endpoint is reachable.".to_string())
        }
        _ => {
            let url = format!("{base}/models");
            check_bearer_get(&url, connection, "Image provider").await?;
            Ok("Image provider API key is valid.".to_string())
        }
    }
}

async fn check_openrouter_key_for_base(connection: &Value, base: &str) -> AppResult<String> {
    let api_key = connection_api_key(connection)?;
    let url = format!("{}/key", base.trim_end_matches('/'));
    let policy = provider_url_policy_for_connection(connection);
    send_connection_test_get(&url, policy, "OpenRouter", |request| {
        request
            .header("accept", "application/json")
            .bearer_auth(&api_key)
            .header("HTTP-Referer", "https://marinara.local")
            .header("X-Title", "Marinara Engine")
    })
    .await?;
    Ok("OpenRouter API key is valid.".to_string())
}

async fn check_bearer_get(url: &str, connection: &Value, label: &str) -> AppResult<Value> {
    let api_key = connection_api_key(connection)?;
    let policy = provider_url_policy_for_connection(connection);
    send_connection_test_get(url, policy, label, |request| {
        request
            .header("accept", "application/json")
            .bearer_auth(&api_key)
    })
    .await
}

/// Like `check_bearer_get`, but authenticates with Google's `x-goog-api-key`
/// header. Google rejects bearer auth on the Generative Language API with a 401
/// "Expected OAuth 2 access token" error, so the API key must travel this way.
async fn check_google_api_key_get(url: &str, connection: &Value, label: &str) -> AppResult<Value> {
    let api_key = connection_api_key(connection)?;
    let policy = provider_url_policy_for_connection(connection);
    send_connection_test_get(url, policy, label, |request| {
        request
            .header("accept", "application/json")
            .header("x-goog-api-key", &api_key)
    })
    .await
}

async fn check_optional_bearer_get(url: &str, connection: &Value, label: &str) -> AppResult<Value> {
    let policy = provider_url_policy_for_connection(connection);
    let api_key = connection_api_key_optional(connection);
    send_connection_test_get(url, policy, label, |request| {
        let request = request.header("accept", "application/json");
        if api_key.trim().is_empty() {
            request
        } else {
            request.bearer_auth(api_key.trim())
        }
    })
    .await
}

async fn send_connection_test_get(
    url: &str,
    policy: ProviderUrlPolicy,
    label: &str,
    configure: impl Fn(reqwest::RequestBuilder) -> reqwest::RequestBuilder,
) -> AppResult<Value> {
    let response = send_provider_get(
        url,
        policy,
        Duration::from_secs(30),
        "connection_client_error",
        "connection_network_error",
        "connection_redirect_error",
        configure,
    )
    .await?;
    read_connection_test_response(response, label).await
}

async fn read_connection_test_response(
    response: reqwest::Response,
    label: &str,
) -> AppResult<Value> {
    let status = response.status();
    if !status.is_success() {
        let text = read_capped_provider_error_text(response, "connection_response_error").await?;
        return Err(AppError::new(
            "connection_provider_error",
            format!(
                "{label} returned HTTP {status}: {}",
                sanitize_provider_body(&text)
            ),
        ));
    }
    let text = read_limited_provider_text(response, "connection_response_error").await?;
    Ok(serde_json::from_str::<Value>(&text).unwrap_or(Value::Null))
}

async fn send_provider_get(
    url: &str,
    policy: ProviderUrlPolicy,
    timeout: Duration,
    client_error_code: &str,
    network_error_code: &str,
    redirect_error_code: &str,
    configure: impl Fn(reqwest::RequestBuilder) -> reqwest::RequestBuilder,
) -> AppResult<reqwest::Response> {
    let mut current_url = reqwest::Url::parse(url).map_err(|error| {
        AppError::invalid_input(format!("Outbound model URL is invalid: {error}"))
    })?;
    let original_url = current_url.clone();
    for redirect_count in 0..=10 {
        let allow_loopback = redirect_count == 0 || same_origin(&original_url, &current_url);
        let resolved =
            ensure_model_url_allowed(current_url.as_str(), policy, allow_loopback).await?;
        let client = provider_http_client(
            timeout,
            client_error_code,
            current_url.host_str(),
            resolved.as_deref(),
        )?;
        let request = client.get(current_url.clone());
        let request = if same_origin(&original_url, &current_url) {
            configure(request)
        } else {
            request
        };
        let response = request.send().await.map_err(|error| {
            AppError::new(network_error_code, provider_transport_error_message(error))
        })?;
        let status = response.status();
        if !(status.is_redirection() && response.headers().contains_key(reqwest::header::LOCATION))
        {
            return Ok(response);
        }
        if redirect_count == 10 {
            return Err(AppError::new(
                redirect_error_code,
                "Outbound request exceeded redirect limit",
            ));
        }
        let location = response
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| AppError::new(redirect_error_code, "Provider redirect is invalid"))?;
        current_url = current_url
            .join(location)
            .map_err(|error| AppError::new(redirect_error_code, error.to_string()))?;
    }
    Err(AppError::new(
        redirect_error_code,
        "Outbound request exceeded redirect limit",
    ))
}

fn connection_api_key(connection: &Value) -> AppResult<String> {
    let api_key = connection_api_key_optional(connection);
    if api_key.trim().is_empty() {
        Err(AppError::invalid_input(
            "API key is required for this provider.",
        ))
    } else {
        Ok(api_key)
    }
}

fn connection_api_key_optional(connection: &Value) -> String {
    connection
        .get("apiKey")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string()
}

fn stability_url(base: &str, target_path: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    if let Ok(mut parsed) = reqwest::Url::parse(trimmed) {
        let parts = parsed
            .path()
            .split('/')
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>();
        let version_index = parts
            .iter()
            .position(|part| *part == "v1" || *part == "v2beta");
        let prefix = version_index
            .map(|index| parts[..index].to_vec())
            .unwrap_or(parts);
        let path = prefix
            .into_iter()
            .chain(target_path.split('/').filter(|part| !part.is_empty()))
            .collect::<Vec<_>>()
            .join("/");
        parsed.set_path(&format!("/{path}"));
        parsed.set_query(None);
        parsed.set_fragment(None);
        return parsed.to_string().trim_end_matches('/').to_string();
    }
    format!("{}/{}", trimmed, target_path.trim_start_matches('/'))
}

fn build_horde_url(base: &str, target_path: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    if let Ok(mut parsed) = reqwest::Url::parse(trimmed) {
        let parts = parsed
            .path()
            .split('/')
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>();
        let version_index = parts
            .windows(2)
            .position(|window| window[0] == "api" && window[1] == "v2");
        let mut prefix = version_index
            .map(|index| parts[..index + 2].to_vec())
            .unwrap_or(parts);
        if prefix.is_empty()
            || !prefix
                .windows(2)
                .any(|window| window[0] == "api" && window[1] == "v2")
        {
            prefix.extend(["api", "v2"]);
        }
        let path = prefix
            .into_iter()
            .chain(target_path.split('/').filter(|part| !part.is_empty()))
            .collect::<Vec<_>>()
            .join("/");
        parsed.set_path(&format!("/{path}"));
        parsed.set_query(None);
        parsed.set_fragment(None);
        return parsed.to_string().trim_end_matches('/').to_string();
    }
    format!("{}/api/v2/{}", trimmed, target_path.trim_start_matches('/'))
}

fn provider_model_catalog(provider: &str) -> Vec<Value> {
    let ids: &[&str] = match provider {
        "openai_chatgpt" => &[
            "chat-latest",
            "gpt-5.3",
            "gpt-5.3-chat-latest",
            "gpt-5.2",
            "gpt-5.1",
            "gpt-5",
            "gpt-5.3-codex",
            "gpt-5.2-codex",
            "gpt-5.1-codex",
            "gpt-5-codex",
            "gpt-4o",
            "chatgpt-4o-latest",
        ],
        "anthropic" => &[
            "claude-opus-4-8",
            "claude-opus-4-7",
            "claude-opus-4-6",
            "claude-sonnet-4-6",
            "claude-haiku-4-5",
            "claude-opus-4-5",
            "claude-sonnet-4-5",
            "claude-3-5-sonnet-latest",
            "claude-3-5-haiku-latest",
            "claude-3-opus-latest",
        ],
        "claude_subscription" => &[
            "claude-opus-4-8",
            "claude-opus-4-8[1m]",
            "claude-sonnet-4-6",
            "claude-haiku-4-5",
            "claude-opus-4-7",
            "claude-opus-4-7[1m]",
            "claude-opus-4-6",
        ],
        "google" | "google_vertex" => &[
            "gemini-3.5-flash",
            "gemini-3.1-pro-preview",
            "gemini-3.1-pro-preview-customtools",
            "gemini-3.1-flash-lite",
            "gemini-3-flash-preview",
            "gemini-2.5-pro",
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "text-embedding-004",
        ],
        "openrouter" => &[
            "openai/gpt-4o-mini",
            "anthropic/claude-3.5-sonnet",
            "google/gemini-flash-1.5",
        ],
        "mistral" => &[
            "mistral-medium-3-5",
            "mistral-medium-latest",
            "mistral-small-latest",
            "mistral-small-2603",
            "mistral-large-latest",
            "mistral-large-2512",
            "mistral-medium-2508",
            "ministral-14b-2512",
            "ministral-8b-2512",
            "ministral-3b-2512",
            "magistral-medium-latest",
            "magistral-medium-2509",
            "magistral-small-latest",
            "magistral-small-2509",
            "codestral-latest",
            "codestral-2508",
            "devstral-2512",
        ],
        "cohere" => &[
            "command-a-plus-05-2026",
            "command-a-03-2025",
            "command-a-reasoning-08-2025",
            "command-a-vision-07-2025",
            "command-a-translate-08-2025",
            "command-r7b-12-2024",
            "command-r-08-2024",
            "command-r-plus-08-2024",
            "tiny-aya-global",
            "tiny-aya-earth",
            "tiny-aya-fire",
            "tiny-aya-water",
            "c4ai-aya-expanse-32b",
            "c4ai-aya-vision-32b",
        ],
        "ollama" => &["llama3.1", "mistral", "nomic-embed-text"],
        "xai" => &[
            "grok-4.3",
            "grok-build-0.1",
            "grok-4-1-fast",
            "grok-4.20-multi-agent",
        ],
        _ => &[
            "gpt-4o",
            "gpt-4o-mini",
            "text-embedding-3-small",
            "text-embedding-3-large",
        ],
    };
    ids.iter()
        .map(|id| json!({ "id": id, "name": id, "provider": provider }))
        .collect()
}

fn push_model(models: &mut Vec<Value>, id: &str, provider: &str) {
    if models
        .iter()
        .any(|model| model.get("id").and_then(Value::as_str) == Some(id))
    {
        return;
    }
    models.insert(0, json!({ "id": id, "name": id, "provider": provider }));
}

async fn fetch_provider_models(connection: &Value) -> AppResult<Vec<Value>> {
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    if provider == "image_generation" {
        return fetch_image_models(connection).await;
    }
    if provider == "openai_chatgpt" || provider == "claude_subscription" {
        return Ok(provider_model_catalog(provider));
    }
    if provider == "ollama" {
        return fetch_ollama_models(connection).await;
    }
    let base = connection_base_url(connection);
    if base.is_empty() {
        return Ok(provider_model_catalog(provider));
    }
    let url = model_endpoint(provider, &base, connection);
    let policy = provider_url_policy_for_connection(connection);
    let api_key = connection
        .get("apiKey")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    let response = send_provider_get(
        &url,
        policy,
        Duration::from_secs(30),
        "models_client_error",
        "models_network_error",
        "models_redirect_error",
        |request| {
            let request = request.header("accept", "application/json");
            if provider == "anthropic" {
                request
                    .header("x-api-key", &api_key)
                    .header("anthropic-version", "2023-06-01")
            } else if !api_key.is_empty() && provider != "google" {
                request.bearer_auth(&api_key)
            } else {
                request
            }
        },
    )
    .await?;
    let status = response.status();
    if !status.is_success() {
        let text = read_capped_provider_error_text(response, "models_response_error").await?;
        return Err(AppError::new(
            "models_provider_error",
            format!(
                "Provider returned HTTP {status}: {}",
                sanitize_provider_body(&text)
            ),
        ));
    }
    let text = read_limited_provider_text(response, "models_response_error").await?;
    let json = serde_json::from_str::<Value>(&text)
        .map_err(|error| AppError::new("models_json_error", error.to_string()))?;
    Ok(normalize_models_response(provider, &json))
}

async fn fetch_ollama_models(connection: &Value) -> AppResult<Vec<Value>> {
    let base = connection_base_url(connection);
    let url = format!("{base}/api/tags");
    let policy = provider_url_policy_for_connection(connection);
    let response = send_provider_get(
        &url,
        policy,
        Duration::from_secs(15),
        "models_client_error",
        "models_network_error",
        "models_redirect_error",
        |request| request,
    )
    .await?;
    let status = response.status();
    if !status.is_success() {
        let text = read_capped_provider_error_text(response, "models_response_error").await?;
        return Err(AppError::new(
            "models_provider_error",
            format!(
                "Ollama returned HTTP {status}: {}",
                sanitize_provider_body(&text)
            ),
        ));
    }
    let text = read_limited_provider_text(response, "models_response_error").await?;
    let json = serde_json::from_str::<Value>(&text)
        .map_err(|error| AppError::new("models_json_error", error.to_string()))?;
    Ok(json
        .get("models")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|model| model.get("name").and_then(Value::as_str))
        .map(|id| json!({ "id": id, "name": id, "provider": "ollama" }))
        .collect())
}

async fn fetch_image_models(connection: &Value) -> AppResult<Vec<Value>> {
    let source = super::images::image_generation_source(connection);
    let base = super::images::image_connection_base_url(connection, &source);
    if source == "stability" {
        return Ok(vec![
            json!({ "id": "stable-image-core", "name": "Stable Image Core", "provider": "image_generation" }),
            json!({ "id": "stable-image-ultra", "name": "Stable Image Ultra", "provider": "image_generation" }),
            json!({ "id": "sd3.5-large", "name": "Stable Diffusion 3.5 Large", "provider": "image_generation" }),
            json!({ "id": "sd3.5-medium", "name": "Stable Diffusion 3.5 Medium", "provider": "image_generation" }),
        ]);
    }
    if base.is_empty() {
        return Ok(provider_model_catalog("image_generation"));
    }
    match source.as_str() {
        "comfyui" => {
            fetch_json_models(
                &format!("{base}/object_info/CheckpointLoaderSimple"),
                connection,
                "image_generation",
                |json| {
                    json.get("CheckpointLoaderSimple")
                        .and_then(|value| value.get("input"))
                        .and_then(|value| value.get("required"))
                        .and_then(|value| value.get("ckpt_name"))
                        .and_then(Value::as_array)
                        .and_then(|items| items.first())
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten()
                        .filter_map(Value::as_str)
                        .map(|id| json!({ "id": id, "name": id, "provider": "image_generation" }))
                        .collect()
                },
            )
            .await
        }
        "automatic1111" | "drawthings" => {
            fetch_json_models(
                &super::images::image_sdapi_url(&base, "sd-models"),
                connection,
                "image_generation",
                |json| {
                    json.as_array()
                        .into_iter()
                        .flatten()
                        .filter_map(|model| {
                            model
                                .get("title")
                                .or_else(|| model.get("model_name"))
                                .and_then(Value::as_str)
                        })
                        .map(|id| json!({ "id": id, "name": id, "provider": "image_generation" }))
                        .collect()
                },
            )
            .await
        }
        "horde" => {
            let url = format!(
                "{}/api/v2/status/models?type=image",
                base.trim_end_matches('/')
            );
            fetch_json_models(&url, connection, "image_generation", |json| {
                json.as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|model| {
                        model
                            .get("name")
                            .or_else(|| model.get("id"))
                            .and_then(Value::as_str)
                    })
                    .map(|id| json!({ "id": id, "name": id, "provider": "image_generation" }))
                    .collect()
            })
            .await
        }
        "nanogpt" => {
            fetch_json_models(
                &format!("{base}/image-models"),
                connection,
                "image_generation",
                |json| normalize_openai_data_models(json, "image_generation"),
            )
            .await
        }
        "openrouter" => {
            fetch_json_models(
                &format!("{base}/models?output_modalities=image"),
                connection,
                "image_generation",
                |json| normalize_openai_data_models(json, "image_generation"),
            )
            .await
        }
        _ => Ok(provider_model_catalog("image_generation")),
    }
}

async fn fetch_json_models<F>(
    url: &str,
    connection: &Value,
    provider: &str,
    normalize: F,
) -> AppResult<Vec<Value>>
where
    F: Fn(&Value) -> Vec<Value>,
{
    let policy = provider_url_policy_for_connection(connection);
    let api_key = connection
        .get("apiKey")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|key| !key.is_empty())
        .map(str::to_string);
    let response = send_provider_get(
        url,
        policy,
        Duration::from_secs(30),
        "models_client_error",
        "models_network_error",
        "models_redirect_error",
        |request| {
            let request = request.header("accept", "application/json");
            if let Some(api_key) = api_key.as_deref() {
                request.bearer_auth(api_key)
            } else {
                request
            }
        },
    )
    .await?;
    let status = response.status();
    if !status.is_success() {
        let text = read_capped_provider_error_text(response, "models_response_error").await?;
        return Err(AppError::new(
            "models_provider_error",
            format!(
                "{provider} returned HTTP {status}: {}",
                sanitize_provider_body(&text)
            ),
        ));
    }
    let text = read_limited_provider_text(response, "models_response_error").await?;
    let json = serde_json::from_str::<Value>(&text)
        .map_err(|error| AppError::new("models_json_error", error.to_string()))?;
    Ok(normalize(&json))
}

fn normalize_models_response(provider: &str, json: &Value) -> Vec<Value> {
    match provider {
        "google" => json
            .get("models")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter(|model| {
                model
                    .get("supportedGenerationMethods")
                    .and_then(Value::as_array)
                    .is_none_or(|methods| {
                        methods
                            .iter()
                            .any(|method| method.as_str() == Some("generateContent"))
                    })
            })
            .filter_map(|model| {
                let id = model
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .trim_start_matches("models/");
                (!id.is_empty()).then(|| {
                    model_info(
                        id,
                        model
                            .get("displayName")
                            .and_then(Value::as_str)
                            .unwrap_or(id),
                        provider,
                        model,
                    )
                })
            })
            .collect(),
        "google_vertex" => json
            .get("publisherModels")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|model| {
                let id = model
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .rsplit("/models/")
                    .next()
                    .unwrap_or("");
                (!id.is_empty()).then(|| {
                    model_info(
                        id,
                        model
                            .get("displayName")
                            .and_then(Value::as_str)
                            .unwrap_or(id),
                        provider,
                        model,
                    )
                })
            })
            .collect(),
        "anthropic" => json
            .get("data")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(|model| model_id(model).map(|id| (id, model)))
            .map(|(id, model)| {
                model_info(
                    id,
                    model
                        .get("display_name")
                        .and_then(Value::as_str)
                        .unwrap_or(id),
                    provider,
                    model,
                )
            })
            .collect(),
        "cohere" => {
            let data_models = normalize_openai_data_models(json, provider);
            if !data_models.is_empty() {
                return data_models;
            }
            json.get("models")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter(|model| {
                    model
                        .get("endpoints")
                        .and_then(Value::as_array)
                        .is_none_or(|items| items.iter().any(|item| item.as_str() == Some("chat")))
                })
                .filter_map(|model| model.get("name").and_then(Value::as_str))
                .map(|id| json!({ "id": id, "name": id, "provider": provider }))
                .collect()
        }
        _ => normalize_openai_data_models(json, provider),
    }
}

fn normalize_openai_data_models(json: &Value, provider: &str) -> Vec<Value> {
    json.get("data")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|model| model_id(model).map(|id| (id, model)))
        .map(|(id, model)| {
            model_info(
                id,
                model.get("name").and_then(Value::as_str).unwrap_or(id),
                provider,
                model,
            )
        })
        .collect()
}

fn model_info(id: &str, name: &str, provider: &str, source: &Value) -> Value {
    let mut model = json!({ "id": id, "name": name, "provider": provider });
    if let Some(context) = model_number(
        source,
        &[
            "context",
            "context_length",
            "contextLength",
            "context_window",
            "contextWindow",
            "maxContext",
            "max_context",
            "inputTokenLimit",
            "input_token_limit",
        ],
    ) {
        model["context"] = json!(context);
    }
    if let Some(max_output) = model_number(
        source,
        &[
            "maxOutput",
            "max_output",
            "maxOutputTokens",
            "max_output_tokens",
            "maxCompletionTokens",
            "max_completion_tokens",
            "outputTokenLimit",
            "output_token_limit",
            "max_tokens",
        ],
    )
    .or_else(|| {
        source.get("top_provider").and_then(|value| {
            model_number(
                value,
                &[
                    "max_completion_tokens",
                    "maxCompletionTokens",
                    "max_output_tokens",
                    "maxOutputTokens",
                ],
            )
        })
    }) {
        model["maxOutput"] = json!(max_output);
    }
    model
}

fn model_number(source: &Value, keys: &[&str]) -> Option<u64> {
    keys.iter().find_map(|key| {
        source.get(*key).and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_i64().and_then(|value| u64::try_from(value).ok()))
                .or_else(|| value.as_str()?.trim().parse::<u64>().ok())
        })
    })
}

fn model_id(model: &Value) -> Option<&str> {
    model
        .get("id")
        .or_else(|| model.get("name"))
        .and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
}

fn model_endpoint(provider: &str, base: &str, connection: &Value) -> String {
    let base = base.trim_end_matches('/');
    match provider {
        "anthropic" if base.ends_with("/v1") => format!("{base}/models"),
        "anthropic" => format!("{base}/v1/models"),
        "google" if base.ends_with("/v1beta") || base.ends_with("/v1") => {
            format!(
                "{base}/models?key={}",
                connection
                    .get("apiKey")
                    .and_then(Value::as_str)
                    .unwrap_or("")
            )
        }
        "google" => format!(
            "{base}/v1beta/models?key={}",
            connection
                .get("apiKey")
                .and_then(Value::as_str)
                .unwrap_or("")
        ),
        "google_vertex" => {
            let base = base.trim_end_matches("/publishers/google/models");
            format!("{base}/publishers/google/models")
        }
        "cohere" if base.ends_with("/compatibility/v1") => format!("{base}/models"),
        "cohere" if base.ends_with("/v2") => {
            format!("{}/v1/models", base.trim_end_matches("/v2"))
        }
        "cohere" if base.ends_with("/v1") => format!("{base}/models"),
        "cohere" => format!("{base}/v1/models"),
        _ => format!("{base}/models"),
    }
}

fn connection_base_url(connection: &Value) -> String {
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    let base = connection
        .get("baseUrl")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| provider_default_base_url(provider))
        .trim_end_matches('/')
        .to_string();
    if provider == "google" {
        normalize_google_base_url(base)
    } else {
        base
    }
}

fn normalize_google_base_url(base: String) -> String {
    let lower = base.to_ascii_lowercase();
    let prefix = [
        "https://home.linkapi.ai",
        "https://www.linkapi.ai",
        "https://linkapi.ai",
    ]
    .into_iter()
    .find(|prefix| lower == *prefix || lower.starts_with(&format!("{prefix}/")));
    if let Some(prefix) = prefix {
        let suffix = &base[prefix.len()..];
        format!("https://api.linkapi.ai{suffix}")
    } else {
        base
    }
}

fn provider_default_base_url(provider: &str) -> &'static str {
    match provider {
        "anthropic" => "https://api.anthropic.com",
        "google" => "https://generativelanguage.googleapis.com",
        "google_vertex" => {
            "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1"
        }
        "openrouter" => "https://openrouter.ai/api/v1",
        "xai" => "https://api.x.ai/v1",
        "nanogpt" => "https://nano-gpt.com/api/v1",
        "ollama" => "http://127.0.0.1:11434",
        "mistral" => "https://api.mistral.ai/v1",
        "cohere" => "https://api.cohere.com/compatibility/v1",
        "togetherai" => "https://api.together.xyz/v1",
        _ => "https://api.openai.com/v1",
    }
}

#[derive(Clone, Copy)]
struct ProviderUrlPolicy {
    allow_private_or_reserved: bool,
    flag_name: &'static str,
}

fn provider_url_policy_for_connection(connection: &Value) -> ProviderUrlPolicy {
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    if provider == "image_generation" {
        let source = super::images::image_generation_source(connection);
        let is_local_image_backend =
            matches!(source.as_str(), "comfyui" | "automatic1111" | "drawthings");
        return ProviderUrlPolicy {
            allow_private_or_reserved: is_local_image_backend
                || local_url_flag_enabled(IMAGE_LOCAL_URLS_ENABLED_FLAG),
            flag_name: IMAGE_LOCAL_URLS_ENABLED_FLAG,
        };
    }
    ProviderUrlPolicy {
        allow_private_or_reserved: local_url_flag_enabled(PROVIDER_LOCAL_URLS_ENABLED_FLAG),
        flag_name: PROVIDER_LOCAL_URLS_ENABLED_FLAG,
    }
}

fn local_url_flag_enabled(flag_name: &str) -> bool {
    std::env::var(flag_name).is_ok_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        )
    })
}

async fn ensure_model_url_allowed(
    url: &str,
    policy: ProviderUrlPolicy,
    allow_loopback: bool,
) -> AppResult<Option<Vec<SocketAddr>>> {
    let parsed = reqwest::Url::parse(url).map_err(|error| {
        AppError::invalid_input(format!(
            "Outbound model URL is invalid: {}",
            redact_sensitive_text(&error.to_string())
        ))
    })?;
    if !is_allowed_provider_url(parsed.as_str(), policy.allow_private_or_reserved) {
        return Err(provider_url_not_allowed_error(url, policy.flag_name));
    }
    validate_model_url_resolution(&parsed, policy, allow_loopback).await
}

async fn validate_model_url_resolution(
    url: &reqwest::Url,
    policy: ProviderUrlPolicy,
    allow_loopback: bool,
) -> AppResult<Option<Vec<SocketAddr>>> {
    if policy.allow_private_or_reserved {
        return Ok(None);
    }
    let Some(host) = url.host_str() else {
        return Err(provider_url_not_allowed_error(
            url.as_str(),
            policy.flag_name,
        ));
    };
    if allow_loopback && is_loopback_provider_host(host) {
        return Ok(None);
    }
    if let Some(address) = provider_host_ip(host) {
        if is_forbidden_provider_resolved_ip(address, policy.allow_private_or_reserved) {
            return Err(provider_url_not_allowed_error(
                url.as_str(),
                policy.flag_name,
            ));
        }
        return Ok(None);
    }
    let port = url.port_or_known_default().unwrap_or(443);
    let addresses = tokio::net::lookup_host((host, port))
        .await
        .map_err(|error| {
            AppError::invalid_input(format!(
                "Outbound model URL host '{}' did not resolve: {}",
                redact_sensitive_text(host),
                redact_sensitive_text(&error.to_string())
            ))
        })?;
    let validated_addresses = addresses.collect::<Vec<_>>();
    validate_provider_resolved_addresses(url, policy, validated_addresses)
}

fn validate_provider_resolved_addresses(
    url: &reqwest::Url,
    policy: ProviderUrlPolicy,
    addresses: Vec<SocketAddr>,
) -> AppResult<Option<Vec<SocketAddr>>> {
    if addresses.is_empty() {
        Err(AppError::invalid_input(format!(
            "Outbound model URL host '{}' did not resolve",
            redact_sensitive_text(url.host_str().unwrap_or("<missing>"))
        )))
    } else if addresses.iter().any(|address| {
        is_forbidden_provider_resolved_ip(address.ip(), policy.allow_private_or_reserved)
    }) {
        Err(provider_url_not_allowed_error(
            url.as_str(),
            policy.flag_name,
        ))
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

fn same_origin(left: &reqwest::Url, right: &reqwest::Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str().map(str::to_ascii_lowercase)
            == right.host_str().map(str::to_ascii_lowercase)
        && left.port_or_known_default() == right.port_or_known_default()
}

fn provider_url_not_allowed_error(url: &str, flag_name: &str) -> AppError {
    AppError::invalid_input(format!(
        "Outbound model URL points to a private, LAN, metadata, or reserved target: {}. Set {flag_name}=true only if you trust that provider target.",
        redact_sensitive_text(url)
    ))
}

fn provider_http_client(
    timeout: Duration,
    error_code: &str,
    host: Option<&str>,
    resolved_addresses: Option<&[SocketAddr]>,
) -> AppResult<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .timeout(timeout)
        .redirect(reqwest::redirect::Policy::none());
    if let (Some(host), Some(addresses)) = (host, resolved_addresses) {
        builder = builder.resolve_to_addrs(host, addresses);
    }
    builder
        .build()
        .map_err(|error| AppError::new(error_code, error.to_string()))
}

async fn read_limited_provider_text(
    mut response: reqwest::Response,
    error_code: &str,
) -> AppResult<String> {
    if response
        .content_length()
        .is_some_and(|length| length > PROVIDER_CONFIG_MAX_RESPONSE_BYTES as u64)
    {
        return Err(provider_response_too_large_error(error_code));
    }

    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| AppError::new(error_code, provider_transport_error_message(error)))?
    {
        if body.len().saturating_add(chunk.len()) > PROVIDER_CONFIG_MAX_RESPONSE_BYTES {
            return Err(provider_response_too_large_error(error_code));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(String::from_utf8_lossy(&body).into_owned())
}

async fn read_capped_provider_error_text(
    mut response: reqwest::Response,
    error_code: &str,
) -> AppResult<String> {
    let mut body = Vec::new();
    let mut truncated = false;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| AppError::new(error_code, provider_transport_error_message(error)))?
    {
        let remaining = PROVIDER_CONFIG_MAX_RESPONSE_BYTES.saturating_sub(body.len());
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

fn provider_response_too_large_error(error_code: &str) -> AppError {
    AppError::new(
        error_code,
        format!(
            "Provider response exceeds {} bytes",
            PROVIDER_CONFIG_MAX_RESPONSE_BYTES
        ),
    )
}

fn provider_transport_error_message(error: impl std::fmt::Display) -> String {
    redact_sensitive_text(&error.to_string())
}

fn sanitize_provider_body(body: &str) -> String {
    let lower = body.to_ascii_lowercase();
    if lower.contains("<html") || lower.contains("<!doctype") {
        "Provider returned HTML instead of JSON".to_string()
    } else {
        redact_sensitive_text(body).chars().take(300).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use std::time::{SystemTime, UNIX_EPOCH};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-llm-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp LLM dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    async fn serve_model_failure(status: &'static str, body: impl Into<String>) -> String {
        let body = body.into();
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test model server should bind");
        let address = listener
            .local_addr()
            .expect("test model server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test model server should accept one request");
            let mut buffer = [0_u8; 2048];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test model server should read request");
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test model server should write response");
        });
        format!("http://{address}/v1")
    }

    async fn serve_chunked_failure(status: &'static str, chunks: Vec<Vec<u8>>) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test model server should bind");
        let address = listener
            .local_addr()
            .expect("test model server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test model server should accept one request");
            let mut buffer = [0_u8; 2048];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test model server should read request");
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: text/plain\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n",
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test model server should write response headers");
            for chunk in chunks {
                let header = format!("{:x}\r\n", chunk.len());
                stream
                    .write_all(header.as_bytes())
                    .await
                    .expect("test model server should write chunk header");
                stream
                    .write_all(&chunk)
                    .await
                    .expect("test model server should write chunk body");
                stream
                    .write_all(b"\r\n")
                    .await
                    .expect("test model server should write chunk terminator");
            }
            stream
                .write_all(b"0\r\n\r\n")
                .await
                .expect("test model server should write final chunk");
        });
        format!("http://{address}/v1")
    }

    async fn serve_redirect_loop(location: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test model server should bind");
        let address = listener
            .local_addr()
            .expect("test model server address should be readable");
        tokio::spawn(async move {
            loop {
                let Ok((mut stream, _)) = listener.accept().await else {
                    break;
                };
                tokio::spawn(async move {
                    let mut buffer = [0_u8; 2048];
                    let _ = stream.read(&mut buffer).await;
                    let response = format!(
                        "HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                });
            }
        });
        format!("http://{address}/v1")
    }

    async fn serve_models_asserting_request(
        expected_path: &'static str,
        expected_auth: &'static str,
        body: &'static str,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test model server should bind");
        let address = listener
            .local_addr()
            .expect("test model server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test model server should accept one request");
            let mut buffer = [0_u8; 4096];
            let read = stream
                .read(&mut buffer)
                .await
                .expect("test model server should read request");
            let request = String::from_utf8_lossy(&buffer[..read]);
            assert!(request.starts_with(&format!("GET {expected_path} HTTP/1.1")));
            assert!(request.to_ascii_lowercase().contains(&format!(
                "\r\nauthorization: {}\r\n",
                expected_auth.to_ascii_lowercase()
            )));
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test model server should write response");
        });
        format!("http://{address}")
    }

    async fn serve_model_redirect(location: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test model server should bind");
        let address = listener
            .local_addr()
            .expect("test model server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test model server should accept one request");
            let mut buffer = [0_u8; 2048];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test model server should read request");
            let response = format!(
                "HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test model server should write response");
        });
        format!("http://{address}/v1")
    }

    async fn serve_model_success(body: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test model server should bind");
        let address = listener
            .local_addr()
            .expect("test model server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test model server should accept one request");
            let mut buffer = [0_u8; 2048];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test model server should read request");
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test model server should write response");
        });
        format!("http://{address}/v1")
    }

    async fn serve_recording_target() -> (String, Arc<AtomicBool>) {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test model server should bind");
        let address = listener
            .local_addr()
            .expect("test model server address should be readable");
        let contacted = Arc::new(AtomicBool::new(false));
        let contacted_for_task = Arc::clone(&contacted);
        tokio::spawn(async move {
            if let Ok((mut stream, _)) = listener.accept().await {
                contacted_for_task.store(true, Ordering::SeqCst);
                let response =
                    "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
                let _ = stream.write_all(response.as_bytes()).await;
            }
        });
        (format!("http://{address}/blocked"), contacted)
    }

    async fn serve_request_recording_target() -> (String, tokio::task::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test model server should bind");
        let address = listener
            .local_addr()
            .expect("test model server address should be readable");
        let handle = tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test model server should accept one request");
            let mut buffer = [0_u8; 4096];
            let read = stream
                .read(&mut buffer)
                .await
                .expect("test model server should read request");
            let response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test model server should write response");
            String::from_utf8_lossy(&buffer[..read]).to_string()
        });
        (format!("http://{address}/redirected"), handle)
    }

    async fn serve_same_origin_authenticated_redirect() -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test model server should bind");
        let address = listener
            .local_addr()
            .expect("test model server address should be readable");
        tokio::spawn(async move {
            let (mut first, _) = listener
                .accept()
                .await
                .expect("test model server should accept redirect request");
            let mut buffer = [0_u8; 2048];
            let _ = first
                .read(&mut buffer)
                .await
                .expect("test model server should read redirect request");
            first
                .write_all(
                    b"HTTP/1.1 302 Found\r\nLocation: /v1/models2\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                )
                .await
                .expect("test model server should write redirect");

            let (mut second, _) = listener
                .accept()
                .await
                .expect("test model server should accept follow-up request");
            let mut buffer = [0_u8; 4096];
            let read = second
                .read(&mut buffer)
                .await
                .expect("test model server should read follow-up request");
            let request = String::from_utf8_lossy(&buffer[..read]).to_ascii_lowercase();
            assert!(request.contains("\r\nauthorization: bearer sk-test-key\r\n"));
            let body = r#"{"data":[{"id":"same-origin-model"}]}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            second
                .write_all(response.as_bytes())
                .await
                .expect("test model server should write model body");
        });
        format!("http://{address}/v1/models")
    }

    #[test]
    fn google_vertex_model_lookup_uses_aiplatform_endpoint() {
        assert_eq!(
            provider_default_base_url("google_vertex"),
            "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1"
        );
        assert_eq!(
            model_endpoint(
                "google_vertex",
                "https://us-central1-aiplatform.googleapis.com/v1/projects/demo/locations/us-central1",
                &json!({}),
            ),
            "https://us-central1-aiplatform.googleapis.com/v1/projects/demo/locations/us-central1/publishers/google/models"
        );
        assert_eq!(
            model_endpoint(
                "google_vertex",
                "https://us-central1-aiplatform.googleapis.com/v1/projects/demo/locations/us-central1/publishers/google/models",
                &json!({}),
            ),
            "https://us-central1-aiplatform.googleapis.com/v1/projects/demo/locations/us-central1/publishers/google/models"
        );
    }

    #[test]
    fn cohere_model_lookup_uses_compatibility_models_path() {
        assert_eq!(
            provider_default_base_url("cohere"),
            "https://api.cohere.com/compatibility/v1"
        );
        assert_eq!(
            model_endpoint(
                "cohere",
                "https://api.cohere.com/compatibility/v1",
                &json!({ "apiKey": "sk-test-key" })
            ),
            "https://api.cohere.com/compatibility/v1/models"
        );
    }

    #[tokio::test]
    async fn cohere_connection_models_compatibility_endpoint_sends_authorization() {
        let state = test_state("cohere-compat-models");
        let base_url = format!(
            "{}/compatibility/v1",
            serve_models_asserting_request(
                "/compatibility/v1/models",
                "Bearer sk-test-key",
                r#"{"data":[{"id":"command-a"}]}"#
            )
            .await
        );
        state
            .storage
            .upsert_with_id(
                "connections",
                "cohere-compat",
                json!({
                    "provider": "cohere",
                    "baseUrl": base_url,
                    "apiKey": "sk-test-key",
                    "model": "command-a"
                }),
            )
            .expect("connection should be stored");

        let result = connection_models(&state, "cohere-compat")
            .await
            .expect("Cohere model lookup should use compatibility endpoint");

        assert_eq!(result["fromProvider"], true);
        assert_eq!(result["fallback"], false);
        assert_eq!(result["models"][0]["id"], "command-a");
    }

    #[test]
    fn google_connection_base_normalizes_linkapi_console_hosts() {
        assert_eq!(
            connection_base_url(&json!({
                "provider": "google",
                "baseUrl": "https://home.linkapi.ai"
            })),
            "https://api.linkapi.ai"
        );
        assert_eq!(
            connection_base_url(&json!({
                "provider": "google",
                "baseUrl": "https://www.linkapi.ai/v1beta"
            })),
            "https://api.linkapi.ai/v1beta"
        );
        assert_eq!(
            connection_base_url(&json!({
                "provider": "openai",
                "baseUrl": "https://home.linkapi.ai"
            })),
            "https://home.linkapi.ai"
        );
    }

    #[tokio::test]
    async fn model_url_rejection_redacts_query_secret() {
        let error = ensure_model_url_allowed(
            "ftp://example.test/v1beta/models?key=AIzaSecretValue123",
            ProviderUrlPolicy {
                allow_private_or_reserved: false,
                flag_name: PROVIDER_LOCAL_URLS_ENABLED_FLAG,
            },
            true,
        )
        .await
        .expect_err("disallowed model URL should fail");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("[REDACTED]"));
        assert!(!error.message.contains("AIzaSecretValue123"));
    }

    #[tokio::test]
    async fn provider_model_url_policy_allows_loopback_but_blocks_private_targets() {
        let policy = ProviderUrlPolicy {
            allow_private_or_reserved: false,
            flag_name: PROVIDER_LOCAL_URLS_ENABLED_FLAG,
        };

        for url in [
            "http://127.0.0.1:11434/api/tags",
            "http://localhost:11434/api/tags",
            "http://[::ffff:127.0.0.1]:11434/api/tags",
        ] {
            ensure_model_url_allowed(url, policy, true)
                .await
                .expect("loopback provider URL should remain allowed");
        }
        let error =
            ensure_model_url_allowed("http://169.254.169.254/latest/meta-data", policy, true)
                .await
                .expect_err("metadata target should be blocked without provider opt-in");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains(PROVIDER_LOCAL_URLS_ENABLED_FLAG));
        assert!(error.message.contains("private"));
    }

    #[tokio::test]
    async fn provider_model_url_policy_blocks_private_dns_answers() {
        let policy = ProviderUrlPolicy {
            allow_private_or_reserved: false,
            flag_name: PROVIDER_LOCAL_URLS_ENABLED_FLAG,
        };
        let url = reqwest::Url::parse("https://public-looking.example.test/v1/models")
            .expect("test URL should parse");
        let error = validate_provider_resolved_addresses(
            &url,
            policy,
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

    #[tokio::test]
    async fn provider_model_url_policy_blocks_public_host_resolving_to_loopback() {
        let policy = ProviderUrlPolicy {
            allow_private_or_reserved: false,
            flag_name: PROVIDER_LOCAL_URLS_ENABLED_FLAG,
        };
        let url = reqwest::Url::parse("https://public-looking.example.test/v1/models")
            .expect("test URL should parse");
        let error = validate_provider_resolved_addresses(
            &url,
            policy,
            vec![
                "127.0.0.1:443".parse().expect("loopback address parses"),
                "[::1]:443".parse().expect("IPv6 loopback address parses"),
                "[::ffff:127.0.0.1]:443"
                    .parse()
                    .expect("mapped loopback address parses"),
            ],
        )
        .expect_err("loopback DNS answers should be rejected for public-looking hosts");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains(PROVIDER_LOCAL_URLS_ENABLED_FLAG));
    }

    #[tokio::test]
    async fn provider_config_success_response_body_is_capped() {
        let body = "x".repeat(PROVIDER_CONFIG_MAX_RESPONSE_BYTES + 1);
        let base_url = serve_model_failure("200 OK", body).await;
        let error = fetch_provider_models(&json!({
            "provider": "openai",
            "baseUrl": base_url,
            "apiKey": "sk-test-key",
            "model": "gpt-custom"
        }))
        .await
        .expect_err("oversized successful model lookup response should fail");

        assert_eq!(error.code, "models_response_error");
        assert!(error.message.contains("exceeds"));
    }

    #[tokio::test]
    async fn oversized_provider_config_error_preserves_status() {
        let body = "x".repeat(PROVIDER_CONFIG_MAX_RESPONSE_BYTES + 1024);
        let base_url = serve_model_failure("500 Internal Server Error", body).await;
        let error = fetch_provider_models(&json!({
            "provider": "openai",
            "baseUrl": base_url,
            "apiKey": "sk-test-key",
            "model": "gpt-custom"
        }))
        .await
        .expect_err("oversized model lookup error should stay status-bearing");

        assert_eq!(error.code, "models_provider_error");
        assert!(error
            .message
            .contains("Provider returned HTTP 500 Internal Server Error"));
        assert!(!error.message.contains("exceeds"));
        assert!(error.message.len() < 600);
    }

    #[tokio::test]
    async fn chunked_connection_error_is_bounded_sanitized_and_status_bearing() {
        let base_url = serve_chunked_failure(
            "429 Too Many Requests",
            vec![
                b"rate limited sk-test-secret ".to_vec(),
                vec![b'x'; PROVIDER_CONFIG_MAX_RESPONSE_BYTES + 1024],
            ],
        )
        .await;
        let error = check_connection_without_generation(&json!({
            "provider": "image_generation",
            "baseUrl": base_url,
            "imageGenerationSource": "pollinations",
            "apiKey": "sk-test-key",
            "model": "test-image-model"
        }))
        .await
        .expect_err("chunked connection error should stay status-bearing");

        assert_eq!(error.code, "connection_provider_error");
        assert!(error
            .message
            .contains("Pollinations returned HTTP 429 Too Many Requests"));
        assert!(error.message.contains("[REDACTED]"));
        assert!(!error.message.contains("sk-test-secret"));
        assert!(!error.message.contains("exceeds"));
        assert!(error.message.len() < 600);
    }

    #[tokio::test]
    async fn connection_redirect_limit_uses_connection_error_code() {
        let base_url = serve_redirect_loop("/v1/key").await;
        let error = check_connection_without_generation(&json!({
            "provider": "openrouter",
            "baseUrl": base_url,
            "apiKey": "sk-test-key",
            "model": "openai/gpt-4o-mini"
        }))
        .await
        .expect_err("connection redirect loop should fail");

        assert_eq!(error.code, "connection_redirect_error");
        assert!(error.message.contains("redirect limit"));
    }

    #[tokio::test]
    async fn model_redirect_limit_keeps_models_error_code() {
        let base_url = serve_redirect_loop("/v1/models").await;
        let error = fetch_provider_models(&json!({
            "provider": "openai",
            "baseUrl": base_url,
            "apiKey": "sk-test-key",
            "model": "gpt-custom"
        }))
        .await
        .expect_err("model redirect loop should fail");

        assert_eq!(error.code, "models_redirect_error");
        assert!(error.message.contains("redirect limit"));
    }

    #[tokio::test]
    async fn provider_model_redirect_revalidates_private_target() {
        let base_url = serve_model_redirect("http://169.254.169.254/latest/meta-data").await;
        let error = fetch_provider_models(&json!({
            "provider": "openai",
            "baseUrl": base_url,
            "apiKey": "sk-test-key",
            "model": "gpt-custom"
        }))
        .await
        .expect_err("private redirect target should be blocked before follow");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains(PROVIDER_LOCAL_URLS_ENABLED_FLAG));
    }

    #[tokio::test]
    async fn provider_model_redirect_rejects_loopback_before_contacting_target() {
        let (target_url, contacted) = serve_recording_target().await;
        let target_url: &'static str = Box::leak(target_url.into_boxed_str());
        let base_url = serve_model_redirect(target_url).await;
        let error = fetch_provider_models(&json!({
            "provider": "openai",
            "baseUrl": base_url,
            "apiKey": "sk-test-key",
            "model": "gpt-custom"
        }))
        .await
        .expect_err("loopback redirect target should be blocked before follow");

        assert_eq!(error.code, "invalid_input");
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        assert!(!contacted.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn provider_model_redirect_allows_loopback_when_local_opt_in_allows_it() {
        let target_url = serve_model_success(r#"{"data":[{"id":"redirected-model"}]}"#).await;
        let target_url: &'static str = Box::leak(target_url.into_boxed_str());
        let base_url = serve_model_redirect(target_url).await;
        let response = send_provider_get(
            &base_url,
            ProviderUrlPolicy {
                allow_private_or_reserved: true,
                flag_name: PROVIDER_LOCAL_URLS_ENABLED_FLAG,
            },
            Duration::from_secs(5),
            "models_client_error",
            "models_network_error",
            "models_redirect_error",
            |request| request,
        )
        .await
        .expect("local image provider opt-in should allow redirect through manual loop");

        assert!(response.status().is_success());
        let text = read_limited_provider_text(response, "models_response_error")
            .await
            .expect("redirect response body should read");
        assert!(text.contains("redirected-model"));
    }

    #[tokio::test]
    async fn provider_model_redirect_strips_credentials_on_cross_origin_follow() {
        let (target_url, target_request) = serve_request_recording_target().await;
        let target_url: &'static str = Box::leak(target_url.into_boxed_str());
        let base_url = serve_model_redirect(target_url).await;
        let response = send_provider_get(
            &base_url,
            ProviderUrlPolicy {
                allow_private_or_reserved: true,
                flag_name: PROVIDER_LOCAL_URLS_ENABLED_FLAG,
            },
            Duration::from_secs(5),
            "models_client_error",
            "models_network_error",
            "models_redirect_error",
            |request| {
                request
                    .header("accept", "application/json")
                    .header("authorization", "Bearer sk-test-key")
                    .header("x-api-key", "sk-test-key")
                    .header("x-goog-api-key", "AIzaSecretValue")
                    .header("apikey", "horde-secret")
            },
        )
        .await
        .expect("cross-origin redirect target is network-allowed");

        assert!(response.status().is_success());
        let request = target_request
            .await
            .expect("target request should be captured")
            .to_ascii_lowercase();
        assert!(!request.contains("\r\nauthorization:"));
        assert!(!request.contains("\r\nx-api-key:"));
        assert!(!request.contains("\r\nx-goog-api-key:"));
        assert!(!request.contains("\r\napikey:"));
    }

    #[tokio::test]
    async fn provider_model_redirect_keeps_credentials_on_same_origin_follow() {
        let base_url = serve_same_origin_authenticated_redirect().await;
        let models = fetch_provider_models(&json!({
            "provider": "openai",
            "baseUrl": base_url.trim_end_matches("/v1/models"),
            "apiKey": "sk-test-key",
            "model": "same-origin-model"
        }))
        .await
        .expect("same-origin redirect should retain model auth");

        assert_eq!(models[0]["id"], "same-origin-model");
    }

    #[test]
    fn openai_compatible_model_metadata_preserves_context_and_output_limits() {
        let models = normalize_openai_data_models(
            &json!({
                "data": [{
                    "id": "remote-model",
                    "name": "Remote Model",
                    "context_length": 1048576,
                    "top_provider": { "max_completion_tokens": 65536 }
                }]
            }),
            "openrouter",
        );

        assert_eq!(models[0]["id"], "remote-model");
        assert_eq!(models[0]["context"], 1048576);
        assert_eq!(models[0]["maxOutput"], 65536);
    }

    #[tokio::test]
    async fn connection_models_marks_fallback_when_provider_lookup_fails() {
        let state = test_state("provider-error");
        let base_url = serve_model_failure(
            "500 Internal Server Error",
            r#"{"error":"bad key sk-test-secret","api_key":"sk-test-secret"}"#,
        )
        .await;
        state
            .storage
            .upsert_with_id(
                "connections",
                "bad-openai",
                json!({
                    "provider": "openai",
                    "baseUrl": base_url,
                    "apiKey": "bad-key",
                    "model": "gpt-custom"
                }),
            )
            .expect("connection should be stored");

        let result = connection_models(&state, "bad-openai")
            .await
            .expect("model lookup should return fallback metadata");

        assert_eq!(result["fromProvider"], false);
        assert_eq!(result["fallback"], true);
        assert!(result["providerError"]
            .as_str()
            .is_some_and(|message| message.contains("Provider returned HTTP")));
        assert!(!result["providerError"]
            .as_str()
            .unwrap_or_default()
            .contains("sk-test-secret"));
        assert!(result["models"]
            .as_array()
            .is_some_and(|models| models.iter().any(|model| model["id"] == "gpt-custom")));
    }

    #[tokio::test]
    async fn nanogpt_connection_test_requires_api_key_before_model_lookup() {
        let base_url = serve_model_failure("200 OK", r#"{"data":[{"id":"model-a"}]}"#).await;

        let error = check_connection_without_generation(&json!({
            "provider": "nanogpt",
            "baseUrl": base_url,
            "apiKey": "",
            "model": "model-a"
        }))
        .await
        .expect_err("NanoGPT test should reject missing generation credentials");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("API key is required"));
    }

    #[tokio::test]
    async fn nanogpt_connection_test_labels_model_lookup_as_generation_unverified() {
        let base_url = serve_model_failure("200 OK", r#"{"data":[{"id":"model-a"}]}"#).await;

        let outcome = check_connection_without_generation(&json!({
            "provider": "nanogpt",
            "baseUrl": base_url,
            "apiKey": "sk-test-key",
            "model": "model-a"
        }))
        .await
        .expect("NanoGPT model lookup should remain usable");

        assert!(outcome.warning);
        assert!(outcome
            .message
            .contains("does not verify generation auth/payment"));
    }

    #[tokio::test]
    async fn nanogpt_connection_auth_check_returns_warning_state() {
        let state = test_state("nanogpt-warning");
        let base_url = serve_model_failure("200 OK", r#"{"data":[{"id":"model-a"}]}"#).await;
        state
            .storage
            .upsert_with_id(
                "connections",
                "nanogpt-warning",
                json!({
                    "provider": "nanogpt",
                    "baseUrl": base_url,
                    "apiKey": "sk-test-key",
                    "model": "model-a"
                }),
            )
            .expect("connection should be stored");

        let result = connection_auth_check(&state, "nanogpt-warning")
            .await
            .expect("NanoGPT connection check should return model-list result");

        assert_eq!(result["success"], false);
        assert_eq!(result["warning"], true);
        assert!(result["message"]
            .as_str()
            .is_some_and(|message| message.contains("does not verify generation auth/payment")));
    }

    #[tokio::test]
    async fn connection_models_keep_provider_success_distinct_from_fallback() {
        let state = test_state("provider-success");
        let base_url = serve_model_failure("200 OK", r#"{"data":[{"id":"live-model"}]}"#).await;
        state
            .storage
            .upsert_with_id(
                "connections",
                "good-openai",
                json!({
                    "provider": "openai",
                    "baseUrl": base_url,
                    "apiKey": "valid-key",
                    "model": "live-model"
                }),
            )
            .expect("connection should be stored");

        let result = connection_models(&state, "good-openai")
            .await
            .expect("model lookup should return provider metadata");

        assert_eq!(result["fromProvider"], true);
        assert_eq!(result["fallback"], false);
        assert!(result.get("providerError").is_none());
        assert_eq!(result["models"][0]["id"], "live-model");
    }
}
