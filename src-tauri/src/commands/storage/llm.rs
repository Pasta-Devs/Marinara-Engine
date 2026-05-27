use super::shared::*;
use super::*;
use marinara_security::is_allowed_outbound_url;

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
        return get_required(state, "connections", connection_id);
    }
    if body.get("provider").is_some() && body.get("model").is_some() {
        return Ok(body.clone());
    }
    let connections = state.storage.list("connections")?;
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
    let connection = connection_id
        .and_then(|id| state.storage.get("connections", id).ok().flatten())
        .or_else(|| {
            state
                .storage
                .list("connections")
                .ok()
                .and_then(|rows| rows.into_iter().next())
        });
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
    Ok(marinara_llm::LlmConnection {
        provider,
        model,
        api_key,
        base_url,
        openrouter_provider,
        enable_caching,
        caching_at_depth,
        max_tokens_override,
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
    let connection = get_required(state, "connections", id)?;
    let model_name = connection
        .get("model")
        .and_then(Value::as_str)
        .map(str::to_string);
    match check_connection_without_generation(&connection).await {
        Ok(message) => Ok(json!({
            "success": true,
            "message": message,
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

async fn check_connection_without_generation(connection: &Value) -> AppResult<String> {
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    match provider {
        "openai_chatgpt" => marinara_llm::check_openai_chatgpt_auth().await,
        "claude_subscription" => marinara_llm::check_claude_subscription_available(),
        "openrouter" => check_openrouter_key(connection).await,
        "image_generation" => check_image_generation_connection(connection).await,
        _ => {
            let models = fetch_provider_models(connection).await?;
            if models.is_empty() {
                Ok("Connection successful.".to_string())
            } else {
                Ok(format!(
                    "Connection successful. {} model{} available.",
                    models.len(),
                    if models.len() == 1 { "" } else { "s" }
                ))
            }
        }
    }
}

async fn check_openrouter_key(connection: &Value) -> AppResult<String> {
    let api_key = connection_api_key(connection)?;
    let base = connection_base_url(connection);
    let url = format!("{}/key", base.trim_end_matches('/'));
    ensure_model_url_allowed(&url)?;
    let client = connection_test_client()?;
    let request = client
        .get(&url)
        .header("accept", "application/json")
        .bearer_auth(api_key)
        .header("HTTP-Referer", "https://marinara.local")
        .header("X-Title", "Marinara Engine");
    let json = send_connection_test_request(request, "OpenRouter").await?;
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
        "novelai" => {
            check_bearer_get("https://api.novelai.net/user/subscription", connection, "NovelAI")
                .await?;
            Ok("NovelAI API key is valid.".to_string())
        }
        "horde" => {
            let url = build_horde_url(&base, "status/heartbeat");
            ensure_model_url_allowed(&url)?;
            let api_key = connection_api_key_optional(connection);
            let request = connection_test_client()?
                .get(&url)
                .header("accept", "application/json")
                .header(
                    "apikey",
                    if api_key.trim().is_empty() {
                        "0000000000"
                    } else {
                        api_key.trim()
                    },
                )
                .header("Client-Agent", "Marinara-Engine");
            send_connection_test_request(request, "Stable Horde").await?;
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
            let url = format!("{base}/sdapi/v1/options");
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
    ensure_model_url_allowed(&url)?;
    let request = connection_test_client()?
        .get(&url)
        .header("accept", "application/json")
        .bearer_auth(api_key)
        .header("HTTP-Referer", "https://marinara.local")
        .header("X-Title", "Marinara Engine");
    send_connection_test_request(request, "OpenRouter").await?;
    Ok("OpenRouter API key is valid.".to_string())
}

async fn check_bearer_get(url: &str, connection: &Value, label: &str) -> AppResult<Value> {
    let api_key = connection_api_key(connection)?;
    ensure_model_url_allowed(url)?;
    let request = connection_test_client()?
        .get(url)
        .header("accept", "application/json")
        .bearer_auth(api_key);
    send_connection_test_request(request, label).await
}

async fn check_optional_bearer_get(url: &str, connection: &Value, label: &str) -> AppResult<Value> {
    ensure_model_url_allowed(url)?;
    let mut request = connection_test_client()?
        .get(url)
        .header("accept", "application/json");
    let api_key = connection_api_key_optional(connection);
    if !api_key.trim().is_empty() {
        request = request.bearer_auth(api_key.trim().to_string());
    }
    send_connection_test_request(request, label).await
}

async fn send_connection_test_request(
    request: reqwest::RequestBuilder,
    label: &str,
) -> AppResult<Value> {
    let response = request
        .send()
        .await
        .map_err(|error| AppError::new("connection_network_error", error.to_string()))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| AppError::new("connection_response_error", error.to_string()))?;
    if !status.is_success() {
        return Err(AppError::new(
            "connection_provider_error",
            format!(
                "{label} returned HTTP {status}: {}",
                sanitize_provider_body(&text)
            ),
        ));
    }
    Ok(serde_json::from_str::<Value>(&text).unwrap_or(Value::Null))
}

fn connection_test_client() -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::new("connection_client_error", error.to_string()))
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
            "claude-3-5-sonnet-latest",
            "claude-3-5-haiku-latest",
            "claude-3-opus-latest",
        ],
        "claude_subscription" => &[
            "claude-opus-4-7",
            "claude-opus-4-6",
            "claude-sonnet-4-6",
            "claude-opus-4-5",
            "claude-sonnet-4-5",
            "claude-haiku-4-5",
        ],
        "google" | "google_vertex" => &["gemini-1.5-pro", "gemini-1.5-flash", "text-embedding-004"],
        "openrouter" => &[
            "openai/gpt-4o-mini",
            "anthropic/claude-3.5-sonnet",
            "google/gemini-flash-1.5",
        ],
        "ollama" => &["llama3.1", "mistral", "nomic-embed-text"],
        "xai" => &["grok-2-latest", "grok-2-mini-latest"],
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
    ensure_model_url_allowed(&url)?;
    let mut request = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::new("models_client_error", error.to_string()))?
        .get(url)
        .header("accept", "application/json");
    let api_key = connection
        .get("apiKey")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if provider == "anthropic" {
        request = request
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01");
    } else if !api_key.is_empty() && provider != "google" {
        request = request.bearer_auth(api_key);
    }
    let response = request
        .send()
        .await
        .map_err(|error| AppError::new("models_network_error", error.to_string()))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| AppError::new("models_response_error", error.to_string()))?;
    if !status.is_success() {
        return Err(AppError::new(
            "models_provider_error",
            format!(
                "Provider returned HTTP {status}: {}",
                sanitize_provider_body(&text)
            ),
        ));
    }
    let json = serde_json::from_str::<Value>(&text)
        .map_err(|error| AppError::new("models_json_error", error.to_string()))?;
    Ok(normalize_models_response(provider, &json))
}

async fn fetch_ollama_models(connection: &Value) -> AppResult<Vec<Value>> {
    let base = connection_base_url(connection);
    let url = format!("{base}/api/tags");
    ensure_model_url_allowed(&url)?;
    let json = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| AppError::new("models_client_error", error.to_string()))?
        .get(url)
        .send()
        .await
        .map_err(|error| AppError::new("models_network_error", error.to_string()))?
        .json::<Value>()
        .await
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
                &format!("{base}/sdapi/v1/sd-models"),
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
    ensure_model_url_allowed(url)?;
    let mut request = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::new("models_client_error", error.to_string()))?
        .get(url)
        .header("accept", "application/json");
    if let Some(api_key) = connection
        .get("apiKey")
        .and_then(Value::as_str)
        .filter(|key| !key.trim().is_empty())
    {
        request = request.bearer_auth(api_key.trim());
    }
    let response = request
        .send()
        .await
        .map_err(|error| AppError::new("models_network_error", error.to_string()))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| AppError::new("models_response_error", error.to_string()))?;
    if !status.is_success() {
        return Err(AppError::new(
            "models_provider_error",
            format!(
                "{provider} returned HTTP {status}: {}",
                sanitize_provider_body(&text)
            ),
        ));
    }
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
                        methods.iter().any(|method| method.as_str() == Some("generateContent"))
                    })
            })
            .filter_map(|model| {
                let id = model
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .trim_start_matches("models/");
                (!id.is_empty()).then(|| {
                    json!({ "id": id, "name": model.get("displayName").and_then(Value::as_str).unwrap_or(id), "provider": provider })
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
                    json!({ "id": id, "name": model.get("displayName").and_then(Value::as_str).unwrap_or(id), "provider": provider })
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
                json!({ "id": id, "name": model.get("display_name").and_then(Value::as_str).unwrap_or(id), "provider": provider })
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
            json!({ "id": id, "name": model.get("name").and_then(Value::as_str).unwrap_or(id), "provider": provider })
        })
        .collect()
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
        "google_vertex" => format!("{base}/models"),
        _ => format!("{base}/models"),
    }
}

fn connection_base_url(connection: &Value) -> String {
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    connection
        .get("baseUrl")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| provider_default_base_url(provider))
        .trim_end_matches('/')
        .to_string()
}

fn provider_default_base_url(provider: &str) -> &'static str {
    match provider {
        "anthropic" => "https://api.anthropic.com",
        "google" | "google_vertex" => "https://generativelanguage.googleapis.com",
        "openrouter" => "https://openrouter.ai/api/v1",
        "xai" => "https://api.x.ai/v1",
        "ollama" => "http://127.0.0.1:11434",
        "mistral" => "https://api.mistral.ai/v1",
        "cohere" => "https://api.cohere.ai/v2",
        "togetherai" => "https://api.together.xyz/v1",
        _ => "https://api.openai.com/v1",
    }
}

fn ensure_model_url_allowed(url: &str) -> AppResult<()> {
    if is_allowed_outbound_url(url, true) {
        Ok(())
    } else {
        Err(AppError::invalid_input(format!(
            "Outbound model URL is not allowed: {url}"
        )))
    }
}

fn sanitize_provider_body(body: &str) -> String {
    if body.contains("<html") || body.contains("<!DOCTYPE") {
        "Provider returned HTML instead of JSON".to_string()
    } else {
        body.chars().take(300).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
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

    async fn serve_model_failure(status: &'static str, body: &'static str) -> String {
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

    #[tokio::test]
    async fn connection_models_marks_fallback_when_provider_lookup_fails() {
        let state = test_state("provider-error");
        let base_url =
            serve_model_failure("500 Internal Server Error", r#"{"error":"bad key"}"#).await;
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
        assert!(result["models"]
            .as_array()
            .is_some_and(|models| models.iter().any(|model| model["id"] == "gpt-custom")));
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
