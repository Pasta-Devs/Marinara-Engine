use super::*;
use marinara_security::redact_sensitive_text;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{Cursor, Read};

const DEFAULT_OPENAI_IMAGE_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_STABILITY_BASE_URL: &str = "https://api.stability.ai/v2beta";
const DEFAULT_TOGETHER_BASE_URL: &str = "https://api.together.xyz/v1";
const DEFAULT_NOVELAI_BASE_URL: &str = "https://image.novelai.net";
const DEFAULT_OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";
const DEFAULT_XAI_BASE_URL: &str = "https://api.x.ai/v1";
const DEFAULT_POLLINATIONS_BASE_URL: &str = "https://image.pollinations.ai";
const DEFAULT_HORDE_BASE_URL: &str = "https://stablehorde.net/api/v2";
const DEFAULT_AUTOMATIC1111_BASE_URL: &str = "http://localhost:7860";
const DEFAULT_COMFYUI_BASE_URL: &str = "http://127.0.0.1:8188";
const DEFAULT_NANOGPT_BASE_URL: &str = "https://nano-gpt.com/api/v1";
const DEFAULT_BLOCKENTROPY_BASE_URL: &str = "https://api.blockentropy.ai";
const DEFAULT_RUNPOD_BASE_URL: &str = "https://api.runpod.ai/v2";
const DEFAULT_GOOGLE_IMAGE_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
const NOVELAI_V4_PROMPT_HINT: &str = "NovelAI V4/V4.5 prompts support roughly 512 T5 tokens and reject most Unicode prompt characters; try a shorter ASCII prompt without emoji or non-Latin text.";
const NOVELAI_V4_PROMPT_CHAR_LIMIT: usize = 1800;
const IMAGE_PROVIDER_ERROR_MAX_BYTES: usize = 256 * 1024;
const IMAGE_PROVIDER_JSON_ENVELOPE_MAX_BYTES: usize = 48 * 1024 * 1024;
const IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES: usize = 32 * 1024 * 1024;
const COMFYUI_PLACEHOLDER_REFERENCE_BASE64: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

#[derive(Clone, Debug, Default)]
pub(crate) struct ImageGenerationOptions {
    pub(crate) negative_prompt: Option<String>,
    pub(crate) reference_images: Vec<String>,
    pub(crate) transparent_background: bool,
}

pub(crate) async fn generate_image_with_connection(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
) -> AppResult<(String, String)> {
    generate_image_with_options(
        connection,
        prompt,
        width,
        height,
        ImageGenerationOptions::default(),
    )
    .await
}

pub(crate) async fn generate_image_with_options(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: ImageGenerationOptions,
) -> AppResult<(String, String)> {
    if connection.get("provider").and_then(Value::as_str) != Some("image_generation") {
        return Err(AppError::invalid_input(
            "Selected connection is not an image-generation connection",
        ));
    }
    let source = image_source(connection);
    match source.as_str() {
        "pollinations" => {
            generate_pollinations(
                connection,
                prompt,
                width,
                height,
                options.negative_prompt.as_deref(),
            )
            .await
        }
        "stability" => generate_stability(connection, prompt, width, height, &options).await,
        "automatic1111" | "drawthings" => {
            generate_automatic1111(connection, prompt, width, height, &options).await
        }
        "comfyui" => generate_comfyui(connection, prompt, width, height, &options).await,
        "runpod_comfyui" => {
            generate_runpod_comfyui(connection, prompt, width, height, &options).await
        }
        "horde" => generate_horde(connection, prompt, width, height, &options).await,
        "novelai" => generate_novelai(connection, prompt, width, height, &options).await,
        "openrouter" | "gemini_image" => {
            generate_chat_image(connection, prompt, width, height, &options).await
        }
        "google_image" => generate_google_image(connection, prompt, width, height, &options).await,
        "xai" => generate_xai(connection, prompt, width, height).await,
        "openai" | "togetherai" | "nanogpt" | "blockentropy" | "" => {
            generate_openai_compatible_image(connection, &source, prompt, width, height, &options)
                .await
        }
        other => Err(AppError::invalid_input(format!(
            "Unsupported image generation service: {other}"
        ))),
    }
}

pub(crate) fn image_source(connection: &Value) -> String {
    let explicit = connection
        .get("imageGenerationSource")
        .or_else(|| connection.get("imageService"))
        .and_then(Value::as_str)
        .or_else(|| connection.get("service").and_then(Value::as_str))
        .unwrap_or("")
        .trim();
    let model = connection
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    let base_url = connection
        .get("baseUrl")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    infer_image_source(if explicit.is_empty() { model } else { explicit }, base_url)
}

fn infer_image_source(model_or_source: &str, base_url: &str) -> String {
    let model = model_or_source.trim().to_ascii_lowercase();
    let url = base_url.trim().to_ascii_lowercase();
    let parsed_url = reqwest::Url::parse(base_url.trim()).ok();
    match model.as_str() {
        "openai" | "stability" | "togetherai" | "novelai" | "pollinations" | "horde"
        | "blockentropy" | "openrouter" | "xai" | "comfyui" | "automatic1111"
        | "runpod_comfyui" | "gemini_image" | "google_image" | "nanogpt" => return model,
        "drawthings" => return "automatic1111".to_string(),
        _ => {}
    }
    // Google's own image API (AI Studio "Nano Banana" / Imagen) is detected by host,
    // and must win over the generic gemini/imagen fallback below (which targets OpenRouter).
    if url.contains("generativelanguage.googleapis.com") {
        return "google_image".to_string();
    }
    if url.contains("nano-gpt.com") {
        return "nanogpt".to_string();
    }
    if url.contains("openrouter.ai") {
        return "openrouter".to_string();
    }
    if url.contains("api.x.ai") || url.contains("x.ai") {
        return "xai".to_string();
    }
    if (model.starts_with("grok-") && model.contains("image"))
        || (model.contains("grok") && model.contains("imagine"))
    {
        return "xai".to_string();
    }
    if model.starts_with("dall-e") || model.starts_with("gpt-image") || url.contains("openai.com") {
        return "openai".to_string();
    }
    if model.starts_with("sd3") || url.contains("stability.ai") {
        return "stability".to_string();
    }
    if model.contains("nai-diffusion") || url.contains("novelai.net") {
        return "novelai".to_string();
    }
    if model == "pollinations" || url.contains("pollinations.ai") {
        return "pollinations".to_string();
    }
    if model.contains("black-forest") || model.contains("flux") || url.contains("together.xyz") {
        return "togetherai".to_string();
    }
    if url.contains("stablehorde.net") {
        return "horde".to_string();
    }
    if url.contains("blockentropy") {
        return "blockentropy".to_string();
    }
    if url.contains(":8188") || url.contains("comfyui") {
        return "comfyui".to_string();
    }
    if url.contains("runpod.ai") {
        return "runpod_comfyui".to_string();
    }
    let is_arliai_host = parsed_url
        .as_ref()
        .and_then(|url| url.host_str())
        .map(|host| {
            let host = host.to_ascii_lowercase();
            host == "arliai.com" || host.ends_with(".arliai.com")
        })
        .unwrap_or(false);
    let has_sdapi_path = parsed_url
        .as_ref()
        .map(|url| url.path().to_ascii_lowercase().contains("/sdapi/v1"))
        .unwrap_or_else(|| url.contains("/sdapi/v1"));
    if is_arliai_host || has_sdapi_path {
        return "automatic1111".to_string();
    }
    if url.contains(":7860") && !url.contains("drawthings") {
        return "automatic1111".to_string();
    }
    if (model.contains("gemini") && model.contains("image")) || model.contains("imagen") {
        return "gemini_image".to_string();
    }
    "openai".to_string()
}

fn connection_model(connection: &Value, fallback: &str) -> String {
    connection
        .get("model")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn configured_model(connection: &Value) -> Option<String> {
    connection
        .get("model")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

pub(crate) fn image_model(connection: &Value, source: &str) -> Option<String> {
    let source = if source.is_empty() { "openai" } else { source };
    let model = match source {
        "pollinations" => None,
        "stability" => {
            let base = connection_base_url(connection, "stability");
            if is_stability_v1_base(&base) {
                Some(normalize_stability_v1_engine(
                    connection
                        .get("model")
                        .and_then(Value::as_str)
                        .unwrap_or(""),
                ))
            } else {
                Some(connection_model(connection, "stable-image-core"))
            }
        }
        "automatic1111" | "drawthings" | "horde" | "comfyui" | "runpod_comfyui" => {
            configured_model(connection)
        }
        "novelai" => {
            let base = connection_base_url(connection, "novelai");
            if base.to_ascii_lowercase().contains("novelai.net") {
                Some(connection_model(connection, "nai-diffusion-4-5-full"))
            } else {
                Some(connection_model(
                    connection,
                    "google/gemini-2.5-flash-image",
                ))
            }
        }
        "openrouter" | "gemini_image" => Some(connection_model(
            connection,
            "google/gemini-2.5-flash-image",
        )),
        "xai" => Some(connection_model(connection, "grok-2-image")),
        "togetherai" => Some(connection_model(
            connection,
            "black-forest-labs/FLUX.1-schnell-Free",
        )),
        "nanogpt" | "openai" | "blockentropy" => Some(connection_model(connection, "gpt-image-1")),
        _ => configured_model(connection),
    };

    model.filter(|value| !value.trim().is_empty())
}

fn connection_api_key(connection: &Value) -> String {
    connection
        .get("apiKey")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string()
}

pub(crate) fn connection_base_url(connection: &Value, source: &str) -> String {
    let fallback = match source {
        "stability" => DEFAULT_STABILITY_BASE_URL,
        "togetherai" => DEFAULT_TOGETHER_BASE_URL,
        "novelai" => DEFAULT_NOVELAI_BASE_URL,
        "openrouter" | "gemini_image" => DEFAULT_OPENROUTER_BASE_URL,
        "google_image" => DEFAULT_GOOGLE_IMAGE_BASE_URL,
        "xai" => DEFAULT_XAI_BASE_URL,
        "pollinations" => DEFAULT_POLLINATIONS_BASE_URL,
        "horde" => DEFAULT_HORDE_BASE_URL,
        "automatic1111" | "drawthings" => DEFAULT_AUTOMATIC1111_BASE_URL,
        "comfyui" => DEFAULT_COMFYUI_BASE_URL,
        "runpod_comfyui" => DEFAULT_RUNPOD_BASE_URL,
        "nanogpt" => DEFAULT_NANOGPT_BASE_URL,
        "blockentropy" => DEFAULT_BLOCKENTROPY_BASE_URL,
        _ => DEFAULT_OPENAI_IMAGE_BASE_URL,
    };
    connection
        .get("baseUrl")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback)
        .trim_end_matches('/')
        .to_string()
}

#[derive(Clone, Debug)]
struct ComfyDefaults {
    prompt_prefix: String,
    negative_prompt_prefix: String,
    sampler: String,
    scheduler: String,
    steps: u64,
    cfg_scale: f64,
    denoising_strength: f64,
    clip_skip: Option<u64>,
}

#[derive(Clone, Debug)]
struct NovelAiDefaults {
    prompt_prefix: String,
    negative_prompt_prefix: String,
    sampler: String,
    noise_schedule: String,
    steps: u64,
    prompt_guidance: f64,
    prompt_guidance_rescale: f64,
    undesired_content_preset: u64,
}

fn default_parameters_root(connection: &Value) -> Option<Value> {
    match connection.get("defaultParameters")? {
        Value::String(raw) => serde_json::from_str::<Value>(raw).ok(),
        Value::Object(_) => connection.get("defaultParameters").cloned(),
        _ => None,
    }
}

fn image_defaults_profile(connection: &Value, service: &str) -> Option<Value> {
    let profile = default_parameters_root(connection)?
        .get("imageGeneration")
        .cloned()?;
    profile
        .get("service")
        .and_then(Value::as_str)
        .filter(|value| *value == service)?;
    Some(profile)
}

fn read_string(value: Option<&Value>, fallback: &str) -> String {
    value
        .and_then(Value::as_str)
        .filter(|raw| !raw.trim().is_empty())
        .unwrap_or(fallback)
        .to_string()
}

fn read_u64(value: Option<&Value>, fallback: u64, min: u64, max: u64) -> u64 {
    value
        .and_then(Value::as_u64)
        .unwrap_or(fallback)
        .clamp(min, max)
}

fn read_f64(value: Option<&Value>, fallback: f64, min: f64, max: f64) -> f64 {
    value
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
        .unwrap_or(fallback)
        .clamp(min, max)
}

fn resolve_seed(connection: &Value) -> u64 {
    default_parameters_root(connection)
        .and_then(|root| {
            root.get("imageGeneration")
                .and_then(|profile| profile.get("seed"))
                .and_then(Value::as_i64)
        })
        .filter(|seed| *seed >= 0)
        .map(|seed| seed as u64)
        .unwrap_or_else(|| now_millis() as u64 % 4_294_967_295)
}

fn resolve_comfy_defaults(connection: &Value) -> ComfyDefaults {
    let defaults = image_defaults_profile(connection, "comfyui")
        .and_then(|profile| profile.get("comfyui").cloned())
        .unwrap_or(Value::Null);
    ComfyDefaults {
        prompt_prefix: read_string(defaults.get("promptPrefix"), ""),
        negative_prompt_prefix: read_string(defaults.get("negativePromptPrefix"), ""),
        sampler: read_string(defaults.get("sampler"), "euler_ancestral"),
        scheduler: read_string(defaults.get("scheduler"), "normal"),
        steps: read_u64(defaults.get("steps"), 20, 1, 150),
        cfg_scale: read_f64(defaults.get("cfgScale"), 7.0, 0.0, 30.0),
        denoising_strength: read_f64(defaults.get("denoisingStrength"), 1.0, 0.0, 1.0),
        clip_skip: defaults
            .get("clipSkip")
            .and_then(Value::as_u64)
            .filter(|value| (1..=12).contains(value)),
    }
}

fn resolve_novelai_defaults(connection: &Value) -> NovelAiDefaults {
    let defaults = image_defaults_profile(connection, "novelai")
        .and_then(|profile| profile.get("novelai").cloned())
        .unwrap_or(Value::Null);
    NovelAiDefaults {
        prompt_prefix: read_string(defaults.get("promptPrefix"), ""),
        negative_prompt_prefix: read_string(defaults.get("negativePromptPrefix"), ""),
        sampler: read_string(defaults.get("sampler"), "k_euler_ancestral"),
        noise_schedule: read_string(defaults.get("noiseSchedule"), "karras"),
        steps: read_u64(defaults.get("steps"), 28, 1, 150),
        prompt_guidance: read_f64(defaults.get("promptGuidance"), 6.0, 0.0, 30.0),
        prompt_guidance_rescale: read_f64(defaults.get("promptGuidanceRescale"), 0.0, 0.0, 1.0),
        undesired_content_preset: read_u64(defaults.get("undesiredContentPreset"), 0, 0, 4),
    }
}

fn merge_prompt(prefix: &str, prompt: &str) -> String {
    let prefix = prefix.trim();
    let prompt = prompt.trim();
    match (prefix.is_empty(), prompt.is_empty()) {
        (true, _) => prompt.to_string(),
        (_, true) => prefix.to_string(),
        _ => format!("{prefix}, {prompt}"),
    }
}

fn merge_negative_prompt(prefix: &str, prompt: Option<&str>) -> String {
    merge_prompt(prefix, prompt.unwrap_or(""))
}

fn http_client(timeout_secs: u64) -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|error| AppError::new("image_client_error", image_transport_error_message(error)))
}

fn bearer(request: reqwest::RequestBuilder, api_key: &str) -> reqwest::RequestBuilder {
    if api_key.trim().is_empty() {
        request
    } else {
        request.bearer_auth(api_key)
    }
}

async fn response_json(response: reqwest::Response, provider: &str) -> AppResult<Value> {
    let status = response.status();
    if !status.is_success() {
        let text = read_capped_error_body(response).await?;
        return Err(AppError::new(
            "image_provider_error",
            format!(
                "{provider} returned HTTP {status}: {}",
                sanitize_error(&text)
            ),
        ));
    }
    let bytes =
        read_limited_response_bytes(response, IMAGE_PROVIDER_JSON_ENVELOPE_MAX_BYTES).await?;
    serde_json::from_slice::<Value>(&bytes).map_err(|error| {
        AppError::new(
            "image_response_error",
            format!("{provider} returned invalid JSON: {error}"),
        )
    })
}

async fn image_response_base64(
    response: reqwest::Response,
    provider: &str,
) -> AppResult<(String, String)> {
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("image/png")
        .to_string();
    if !status.is_success() {
        let text = read_capped_error_body(response).await?;
        return Err(AppError::new(
            "image_provider_error",
            format!(
                "{provider} returned HTTP {status}: {}",
                sanitize_error(&text)
            ),
        ));
    }
    let bytes = read_limited_response_bytes(response, IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES).await?;
    Ok((general_purpose::STANDARD.encode(bytes), content_type))
}

fn sanitize_error(text: &str) -> String {
    redact_sensitive_text(text)
        .replace(['\n', '\r', '\t'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(300)
        .collect()
}

fn image_transport_error_message(error: impl std::fmt::Display) -> String {
    sanitize_error(&error.to_string())
}

fn strip_data_url(value: &str) -> (&str, &str) {
    if let Some((meta, base64)) = value.split_once(',') {
        if meta.starts_with("data:") {
            let mime = meta
                .strip_prefix("data:")
                .and_then(|rest| rest.split(';').next())
                .unwrap_or("image/png");
            return (base64, mime);
        }
    }
    (value, "image/png")
}

fn ensure_base64_image_within_limit(base64: &str) -> AppResult<()> {
    let normalized_len = base64
        .as_bytes()
        .iter()
        .filter(|byte| !byte.is_ascii_whitespace())
        .count();
    let padding = base64
        .trim_end()
        .as_bytes()
        .iter()
        .rev()
        .take_while(|byte| **byte == b'=')
        .count()
        .min(2);
    let decoded_len = normalized_len.saturating_mul(3) / 4;
    let decoded_len = decoded_len.saturating_sub(padding);
    if decoded_len > IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES {
        return Err(image_response_too_large_error(
            IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES,
        ));
    }
    Ok(())
}

fn validated_base64_image(base64: &str, mime: &str) -> AppResult<(String, String)> {
    ensure_base64_image_within_limit(base64)?;
    Ok((base64.to_string(), mime.to_string()))
}

fn detect_image_mime_type(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        return "image/png";
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return "image/jpeg";
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return "image/webp";
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return "image/gif";
    }
    "image/png"
}

fn detect_base64_mime_type(base64: &str) -> String {
    let sample = base64.trim().chars().take(96).collect::<String>();
    general_purpose::STANDARD
        .decode(sample)
        .ok()
        .map(|bytes| detect_image_mime_type(&bytes).to_string())
        .unwrap_or_else(|| "image/png".to_string())
}

#[derive(Clone, Debug)]
struct DecodedReferenceImage {
    base64: String,
    mime_type: String,
    extension: &'static str,
    bytes: Vec<u8>,
}

fn image_extension_from_mime_type(mime_type: &str) -> &'static str {
    if mime_type.contains("jpeg") || mime_type.contains("jpg") {
        "jpg"
    } else if mime_type.contains("webp") {
        "webp"
    } else if mime_type.contains("gif") {
        "gif"
    } else {
        "png"
    }
}

fn decode_reference_image(reference: &str) -> AppResult<DecodedReferenceImage> {
    let trimmed = reference.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return Err(AppError::invalid_input(
            "Reference images for this provider must be base64 image data",
        ));
    }
    let has_declared_mime = trimmed.starts_with("data:");
    let (base64, declared_mime) = strip_data_url(trimmed);
    let normalized = base64.split_whitespace().collect::<String>();
    if normalized.is_empty() {
        return Err(AppError::invalid_input("Reference image is empty"));
    }
    let bytes = general_purpose::STANDARD
        .decode(&normalized)
        .map_err(|error| {
            AppError::invalid_input(format!("Invalid reference image data: {error}"))
        })?;
    if bytes.is_empty() {
        return Err(AppError::invalid_input("Reference image is empty"));
    }
    let detected = detect_image_mime_type(&bytes);
    let mime_type = if has_declared_mime && declared_mime.starts_with("image/") {
        declared_mime.to_string()
    } else {
        detected.to_string()
    };
    Ok(DecodedReferenceImage {
        base64: normalized,
        extension: image_extension_from_mime_type(&mime_type),
        mime_type,
        bytes,
    })
}

fn reference_base64(reference: &str) -> AppResult<String> {
    Ok(decode_reference_image(reference)?.base64)
}

async fn response_bytes(
    response: reqwest::Response,
    provider: &str,
) -> AppResult<(Vec<u8>, String)> {
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    if !status.is_success() {
        let text = read_capped_error_body(response).await?;
        return Err(AppError::new(
            "image_provider_error",
            format!(
                "{provider} returned HTTP {status}: {}",
                sanitize_error(&text)
            ),
        ));
    }
    let bytes = read_limited_response_bytes(response, IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES).await?;
    Ok((bytes, content_type))
}

async fn read_limited_response_bytes(
    mut response: reqwest::Response,
    max_bytes: usize,
) -> AppResult<Vec<u8>> {
    if response
        .content_length()
        .is_some_and(|length| length > max_bytes as u64)
    {
        return Err(image_response_too_large_error(max_bytes));
    }

    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| {
        AppError::new("image_response_error", image_transport_error_message(error))
    })? {
        if body.len().saturating_add(chunk.len()) > max_bytes {
            return Err(image_response_too_large_error(max_bytes));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

async fn read_capped_error_body(mut response: reqwest::Response) -> AppResult<String> {
    let mut body = Vec::new();
    let mut truncated = false;

    while let Some(chunk) = response.chunk().await.map_err(|error| {
        AppError::new("image_response_error", image_transport_error_message(error))
    })? {
        let remaining = IMAGE_PROVIDER_ERROR_MAX_BYTES.saturating_sub(body.len());
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

fn image_response_too_large_error(max_bytes: usize) -> AppError {
    AppError::new(
        "image_response_error",
        format!("Image provider response exceeds {max_bytes} bytes"),
    )
}

async fn fetch_image_url(client: &reqwest::Client, url: &str) -> AppResult<(String, String)> {
    let response = client.get(url).send().await.map_err(|error| {
        AppError::new("image_network_error", image_transport_error_message(error))
    })?;
    image_response_base64(response, "image URL").await
}

async fn generate_pollinations(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    negative_prompt: Option<&str>,
) -> AppResult<(String, String)> {
    let base = connection
        .get("baseUrl")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("https://image.pollinations.ai")
        .trim_end_matches('/');
    let encoded_prompt = percent_encode_component(prompt);
    let seed = now_millis() % 1_000_000_000;
    let mut url = format!(
        "{base}/prompt/{encoded_prompt}?width={width}&height={height}&nologo=true&seed={seed}"
    );
    if let Some(negative) = negative_prompt
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        url.push_str("&negative=");
        url.push_str(&percent_encode_component(negative));
    }
    fetch_image_url(&http_client(120)?, &url).await
}

async fn generate_openai_compatible_image(
    connection: &Value,
    source: &str,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let source = if source.is_empty() { "openai" } else { source };
    if source == "nanogpt" {
        return generate_nanogpt_image(connection, prompt, width, height, options).await;
    }
    if source == "togetherai" {
        return generate_together_image(connection, prompt, width, height, options).await;
    }

    let base = connection_base_url(connection, source);
    let model = connection_model(connection, "gpt-image-1");
    let client = http_client(180)?;
    let uses_gpt_image_api = is_openai_gpt_image_model(&model);
    if uses_gpt_image_api && !options.reference_images.is_empty() {
        let mut form = reqwest::multipart::Form::new()
            .text("prompt", prompt.to_string())
            .text("n", "1")
            .text("size", openai_image_size(&model, width, height))
            .text("output_format", "png");
        if options.transparent_background && supports_openai_transparent_background(&model) {
            form = form.text("background", "transparent");
        }
        if !model.trim().is_empty() {
            form = form.text("model", model.clone());
        }
        for (index, reference) in options.reference_images.iter().take(16).enumerate() {
            let decoded = decode_reference_image(reference)?;
            let part = reqwest::multipart::Part::bytes(decoded.bytes)
                .mime_str(&decoded.mime_type)
                .map_err(|error| {
                    AppError::invalid_input(format!("Invalid reference image MIME type: {error}"))
                })?
                .file_name(format!("reference-{}.{}", index + 1, decoded.extension));
            form = form.part("image[]", part);
        }
        let response = bearer(
            client
                .post(openai_images_url(&base, "edits"))
                .multipart(form),
            &connection_api_key(connection),
        )
        .send()
        .await
        .map_err(|error| {
            AppError::new("image_network_error", image_transport_error_message(error))
        })?;
        let json = response_json(response, source).await?;
        return parse_image_json(&client, &json).await?.ok_or_else(|| {
            AppError::new(
                "image_response_error",
                format!("{source} returned no image data"),
            )
        });
    }

    let mut payload = Map::new();
    payload.insert("model".to_string(), Value::String(model.clone()));
    payload.insert("prompt".to_string(), Value::String(prompt.to_string()));
    payload.insert("n".to_string(), json!(1));
    payload.insert(
        "size".to_string(),
        Value::String(openai_image_size(&model, width, height)),
    );
    if uses_gpt_image_api {
        payload.insert(
            "output_format".to_string(),
            Value::String("png".to_string()),
        );
        if options.transparent_background && supports_openai_transparent_background(&model) {
            payload.insert(
                "background".to_string(),
                Value::String("transparent".to_string()),
            );
        }
    } else {
        payload.insert(
            "response_format".to_string(),
            Value::String("b64_json".to_string()),
        );
    }
    let response = bearer(
        client
            .post(openai_images_url(&base, "generations"))
            .json(&Value::Object(payload)),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", image_transport_error_message(error)))?;
    let json = response_json(response, source).await?;
    parse_image_json(&client, &json).await?.ok_or_else(|| {
        AppError::new(
            "image_response_error",
            format!("{source} returned no image data"),
        )
    })
}

pub(crate) fn is_openai_gpt_image_model(model: &str) -> bool {
    let lower = model.trim().to_ascii_lowercase();
    lower == "gpt-image-1"
        || lower.starts_with("gpt-image-1-")
        || lower == "gpt-image-1.5"
        || lower.starts_with("gpt-image-1.5-")
        || lower == "gpt-image-2"
        || lower.starts_with("gpt-image-2-")
}

fn supports_openai_transparent_background(model: &str) -> bool {
    let lower = model.trim().to_ascii_lowercase();
    lower == "gpt-image-1"
        || lower.starts_with("gpt-image-1-")
        || lower == "gpt-image-1.5"
        || lower.starts_with("gpt-image-1.5-")
}

fn openai_image_size(model: &str, width: u64, height: u64) -> String {
    let requested = format!("{width}x{height}");
    let lower = model.trim().to_ascii_lowercase();
    let ratio = width as f64 / height.max(1) as f64;
    if lower.contains("dall-e-2") {
        return if width == height && matches!(width, 256 | 512 | 1024) {
            requested
        } else {
            "1024x1024".to_string()
        };
    }
    if lower.contains("dall-e-3") {
        return if ratio > 1.12 {
            "1792x1024".to_string()
        } else if ratio < 0.88 {
            "1024x1792".to_string()
        } else {
            "1024x1024".to_string()
        };
    }
    if is_openai_gpt_image_model(model) {
        return if ratio > 1.12 {
            "1536x1024".to_string()
        } else if ratio < 0.88 {
            "1024x1536".to_string()
        } else {
            "1024x1024".to_string()
        };
    }
    requested
}

fn openai_images_url(base: &str, endpoint: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    let target_path = format!("/images/{endpoint}");
    if let Ok(mut parsed) = reqwest::Url::parse(trimmed) {
        let path = parsed.path().trim_end_matches('/');
        let next_path = if path.ends_with("/images/generations")
            || path.ends_with("/images/edits")
            || path.ends_with("/images/variations")
        {
            let base_path = path
                .rsplit_once("/images/")
                .map(|(prefix, _)| prefix)
                .unwrap_or("");
            format!("{base_path}{target_path}")
        } else if path.is_empty() || path == "/" {
            format!("/v1{target_path}")
        } else if path.ends_with("/api/v1") {
            format!("{}/v1{target_path}", path.trim_end_matches("/api/v1"))
        } else if path.ends_with("/api") {
            format!("{}/v1{target_path}", path.trim_end_matches("/api"))
        } else {
            format!("{path}{target_path}")
        };
        parsed.set_path(&next_path);
        parsed.set_query(None);
        parsed.set_fragment(None);
        return parsed.to_string().trim_end_matches('/').to_string();
    }
    format!("{trimmed}{target_path}")
}

async fn generate_xai(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "xai");
    let model = connection_model(connection, "grok-2-image");
    let client = http_client(180)?;
    let payload = json!({
        "model": model,
        "prompt": prompt,
        "n": 1,
        "aspect_ratio": closest_xai_aspect_ratio(width, height),
        "response_format": "b64_json"
    });
    let response = bearer(
        client.post(xai_images_url(&base)).json(&payload),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", image_transport_error_message(error)))?;
    let json = response_json(response, "xai").await?;
    parse_image_json(&client, &json)
        .await?
        .ok_or_else(|| AppError::new("image_response_error", "xAI returned no image data"))
}

fn closest_xai_aspect_ratio(width: u64, height: u64) -> &'static str {
    let ratio = width as f64 / height.max(1) as f64;
    [
        ("1:1", 1.0),
        ("16:9", 16.0 / 9.0),
        ("9:16", 9.0 / 16.0),
        ("4:3", 4.0 / 3.0),
        ("3:4", 3.0 / 4.0),
        ("3:2", 3.0 / 2.0),
        ("2:3", 2.0 / 3.0),
        ("2:1", 2.0),
        ("1:2", 0.5),
        ("19.5:9", 19.5 / 9.0),
        ("9:19.5", 9.0 / 19.5),
        ("20:9", 20.0 / 9.0),
        ("9:20", 9.0 / 20.0),
    ]
    .into_iter()
    .min_by(|a, b| {
        (a.1 - ratio)
            .abs()
            .partial_cmp(&(b.1 - ratio).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    })
    .map(|item| item.0)
    .unwrap_or("1:1")
}

fn xai_images_url(base: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    if trimmed.ends_with("/images/generations") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/images/generations")
    } else {
        format!("{trimmed}/v1/images/generations")
    }
}

fn nanogpt_images_url(base: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    if trimmed.ends_with("/images/generations") {
        return trimmed.to_string();
    }
    if trimmed.ends_with("/api/v1") {
        return format!(
            "{}/v1/images/generations",
            trimmed.trim_end_matches("/api/v1")
        );
    }
    if trimmed.ends_with("/v1") {
        return format!("{trimmed}/images/generations");
    }
    if trimmed.ends_with("/api") {
        return format!("{}/v1/images/generations", trimmed.trim_end_matches("/api"));
    }
    format!("{trimmed}/images/generations")
}

async fn generate_nanogpt_image(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "nanogpt");
    let model = connection_model(connection, "gpt-image-1");
    let size = if is_openai_gpt_image_model(&model) {
        openai_image_size(&model, width, height)
    } else {
        format!("{width}x{height}")
    };
    let mut payload = Map::new();
    payload.insert("prompt".to_string(), Value::String(prompt.to_string()));
    payload.insert("model".to_string(), Value::String(model.clone()));
    payload.insert("n".to_string(), json!(1));
    payload.insert("size".to_string(), Value::String(size));
    payload.insert(
        "response_format".to_string(),
        Value::String("b64_json".to_string()),
    );
    if let Some(negative) = options
        .negative_prompt
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        payload.insert(
            "negative_prompt".to_string(),
            Value::String(negative.to_string()),
        );
    }
    if model.to_ascii_lowercase().contains("flux-kontext") {
        payload.insert("kontext_max_mode".to_string(), Value::Bool(true));
    }
    match options.reference_images.as_slice() {
        [reference] => {
            payload.insert(
                "imageDataUrl".to_string(),
                Value::String(image_data_url(reference)),
            );
        }
        references if !references.is_empty() => {
            payload.insert(
                "imageDataUrls".to_string(),
                Value::Array(
                    references
                        .iter()
                        .map(|reference| Value::String(image_data_url(reference)))
                        .collect(),
                ),
            );
        }
        _ => {}
    }

    let client = http_client(180)?;
    let response = bearer(
        client
            .post(nanogpt_images_url(&base))
            .json(&Value::Object(payload)),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", image_transport_error_message(error)))?;
    let json = response_json(response, "nanogpt").await?;
    parse_image_json(&client, &json)
        .await?
        .ok_or_else(|| AppError::new("image_response_error", "NanoGPT returned no image data"))
}

async fn generate_together_image(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "togetherai");
    let model = connection_model(connection, "black-forest-labs/FLUX.1-schnell-Free");
    let mut payload = Map::new();
    payload.insert("prompt".to_string(), Value::String(prompt.to_string()));
    payload.insert("model".to_string(), Value::String(model));
    payload.insert("n".to_string(), json!(1));
    payload.insert("width".to_string(), json!(width));
    payload.insert("height".to_string(), json!(height));
    payload.insert(
        "response_format".to_string(),
        Value::String("b64_json".to_string()),
    );
    if let Some(negative) = options
        .negative_prompt
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        payload.insert(
            "negative_prompt".to_string(),
            Value::String(negative.to_string()),
        );
    }
    let client = http_client(180)?;
    let response = bearer(
        client
            .post(format!("{base}/images/generations"))
            .json(&Value::Object(payload)),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", image_transport_error_message(error)))?;
    let json = response_json(response, "togetherai").await?;
    parse_image_json(&client, &json)
        .await?
        .ok_or_else(|| AppError::new("image_response_error", "Together AI returned no image data"))
}

async fn generate_chat_image(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let source = image_source(connection);
    let base = connection_base_url(connection, &source);
    let model = connection_model(connection, "google/gemini-2.5-flash-image");
    let client = http_client(180)?;
    let prompt = match options
        .negative_prompt
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        Some(negative) => format!("{prompt}\n\nAvoid in the image: {negative}"),
        None => prompt.to_string(),
    };
    let content = if options.reference_images.is_empty() {
        Value::String(prompt)
    } else {
        let mut parts = options
            .reference_images
            .iter()
            .map(|image| json!({ "type": "image_url", "image_url": { "url": image_data_url(image) } }))
            .collect::<Vec<_>>();
        parts.push(json!({ "type": "text", "text": prompt }));
        Value::Array(parts)
    };
    let payload = json!({
        "model": model,
        "messages": [{ "role": "user", "content": content }],
        "modalities": chat_image_modalities(&model),
        "stream": false,
        "image_config": { "aspect_ratio": closest_openrouter_aspect_ratio(width, height) }
    });
    let response = bearer(
        client.post(chat_completions_url(&base)).json(&payload),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", image_transport_error_message(error)))?;
    let json = response_json(response, &source).await?;
    parse_image_json(&client, &json).await?.ok_or_else(|| {
        AppError::new(
            "image_response_error",
            format!("{source} returned no image data"),
        )
    })
}

const GOOGLE_IMAGE_PROVIDER: &str = "google_image";

/// Generates images via Google's *native* Generative Language API (AI Studio),
/// distinct from the OpenRouter-proxied `gemini_image` path.
///
/// Two protocols live behind one Google connection:
/// - Gemini image models ("Nano Banana", e.g. `gemini-2.5-flash-image`) use
///   `models/{model}:generateContent` with `responseModalities` and return the
///   image as an inline base64 part.
/// - Imagen models (e.g. `imagen-4.0-generate-001`) use `models/{model}:predict`
///   and return `bytesBase64Encoded`.
///
/// Google authenticates with an `x-goog-api-key` header — not bearer auth — which
/// is why the generic OpenAI-style path could never work against this host.
async fn generate_google_image(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, GOOGLE_IMAGE_PROVIDER);
    let base = base.trim_end_matches('/');
    let model = google_image_model(connection);
    let api_key = connection_api_key(connection);
    // Gemini 3 image models ("Nano Banana Pro/2") run a thinking pass before
    // rendering and can take well over a minute, so allow more headroom than the
    // 180s used by faster providers.
    let client = http_client(300)?;

    let prompt = match options
        .negative_prompt
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        Some(negative) => format!("{prompt}\n\nAvoid in the image: {negative}"),
        None => prompt.to_string(),
    };

    if is_imagen_model(&model) {
        if !options.reference_images.is_empty() {
            eprintln!(
                "Google Imagen model {model} does not support reference images; ignoring {} reference image(s).",
                options.reference_images.len()
            );
        }
        let payload = json!({
            "instances": [{ "prompt": prompt }],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": closest_imagen_aspect_ratio(width, height),
            }
        });
        let response = client
            .post(format!("{base}/models/{model}:predict"))
            .header("x-goog-api-key", api_key.as_str())
            .json(&payload)
            .send()
            .await
            .map_err(|error| {
                AppError::new("image_network_error", image_transport_error_message(error))
            })?;
        let json = response_json(response, GOOGLE_IMAGE_PROVIDER).await?;
        return parse_google_predict_image(&json)?.ok_or_else(|| {
            AppError::new(
                "image_response_error",
                "Google Imagen returned no image data",
            )
        });
    }

    let mut parts: Vec<Value> = Vec::new();
    for reference in &options.reference_images {
        let decoded = decode_reference_image(reference)?;
        parts.push(json!({
            "inlineData": { "mimeType": decoded.mime_type, "data": decoded.base64 }
        }));
    }
    parts.push(json!({ "text": prompt }));

    let mut generation_config = json!({ "responseModalities": ["TEXT", "IMAGE"] });
    if is_gemini3_image_model(&model) {
        // Gemini 3 image models default to a high output resolution; pin 1K so
        // generation finishes in a reasonable time, and honour the requested
        // aspect ratio. (Left off the proven 2.5 path, which works without it.)
        generation_config["imageConfig"] = json!({
            "aspectRatio": closest_google_aspect_ratio(width, height),
            "imageSize": "1K",
        });
    }
    let payload = json!({
        "contents": [{ "role": "user", "parts": parts }],
        "generationConfig": generation_config,
    });
    let response = client
        .post(format!("{base}/models/{model}:generateContent"))
        .header("x-goog-api-key", api_key.as_str())
        .json(&payload)
        .send()
        .await
        .map_err(|error| {
            AppError::new("image_network_error", image_transport_error_message(error))
        })?;
    let json = response_json(response, GOOGLE_IMAGE_PROVIDER).await?;
    parse_google_generate_content_image(&json)?.ok_or_else(|| {
        // No inline image part — surface why (e.g. a SAFETY block or a text-only reply)
        // instead of a generic message, since Gemini returns 200 OK in these cases.
        let reason = json
            .pointer("/candidates/0/finishReason")
            .and_then(Value::as_str)
            .or_else(|| json.pointer("/promptFeedback/blockReason").and_then(Value::as_str))
            .unwrap_or("none");
        let text = json
            .pointer("/candidates/0/content/parts/0/text")
            .and_then(Value::as_str)
            .map(|value| format!(" Model said: {}", sanitize_error(value)))
            .unwrap_or_default();
        AppError::new(
            "image_response_error",
            format!(
                "Gemini returned no image (finishReason: {reason}). The model may have refused the prompt or replied with text only.{text}"
            ),
        )
    })
}

/// Native Google model ids are unprefixed; tolerate an OpenRouter-style `google/`
/// prefix or a leading `models/` so a pasted id still resolves to a valid path.
fn google_image_model(connection: &Value) -> String {
    connection_model(connection, "gemini-2.5-flash-image")
        .trim()
        .trim_start_matches("models/")
        .trim_start_matches("google/")
        .to_string()
}

fn is_imagen_model(model: &str) -> bool {
    model.to_ascii_lowercase().contains("imagen")
}

/// Gemini 3 image models ("Nano Banana Pro" / "Nano Banana 2") accept an
/// `imageConfig` block that earlier models do not need.
fn is_gemini3_image_model(model: &str) -> bool {
    model.to_ascii_lowercase().contains("gemini-3")
}

/// Snap requested dimensions to one of Google's supported `imageConfig` aspect ratios.
fn closest_google_aspect_ratio(width: u64, height: u64) -> &'static str {
    let ratio = width as f64 / height.max(1) as f64;
    [
        ("21:9", 21.0 / 9.0),
        ("16:9", 16.0 / 9.0),
        ("3:2", 3.0 / 2.0),
        ("4:3", 4.0 / 3.0),
        ("5:4", 5.0 / 4.0),
        ("1:1", 1.0),
        ("4:5", 4.0 / 5.0),
        ("3:4", 3.0 / 4.0),
        ("2:3", 2.0 / 3.0),
        ("9:16", 9.0 / 16.0),
    ]
    .into_iter()
    .min_by(|a, b| {
        (a.1 - ratio)
            .abs()
            .partial_cmp(&(b.1 - ratio).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    })
    .map(|item| item.0)
    .unwrap_or("1:1")
}

fn parse_google_generate_content_image(json: &Value) -> AppResult<Option<(String, String)>> {
    let Some(parts) = json
        .pointer("/candidates/0/content/parts")
        .and_then(Value::as_array)
    else {
        return Ok(None);
    };
    for part in parts {
        // v1beta REST emits camelCase, but accept snake_case defensively.
        for key in ["inlineData", "inline_data"] {
            let Some(inline) = part.get(key) else {
                continue;
            };
            let data = inline
                .get("data")
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty());
            if let Some(data) = data {
                let mime = inline
                    .get("mimeType")
                    .or_else(|| inline.get("mime_type"))
                    .and_then(Value::as_str)
                    .unwrap_or("image/png")
                    .to_string();
                return validated_base64_image(data, &mime).map(Some);
            }
        }
    }
    Ok(None)
}

fn parse_google_predict_image(json: &Value) -> AppResult<Option<(String, String)>> {
    let Some(prediction) = json.pointer("/predictions/0") else {
        return Ok(None);
    };
    let Some(data) = prediction
        .get("bytesBase64Encoded")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };
    let mime = prediction
        .get("mimeType")
        .and_then(Value::as_str)
        .unwrap_or("image/png")
        .to_string();
    validated_base64_image(data, &mime).map(Some)
}

/// Imagen only accepts a fixed set of aspect ratios; snap the requested
/// dimensions to the nearest supported one.
fn closest_imagen_aspect_ratio(width: u64, height: u64) -> &'static str {
    let ratio = width as f64 / height.max(1) as f64;
    [
        ("1:1", 1.0),
        ("16:9", 16.0 / 9.0),
        ("9:16", 9.0 / 16.0),
        ("4:3", 4.0 / 3.0),
        ("3:4", 3.0 / 4.0),
    ]
    .into_iter()
    .min_by(|a, b| {
        (a.1 - ratio)
            .abs()
            .partial_cmp(&(b.1 - ratio).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    })
    .map(|item| item.0)
    .unwrap_or("1:1")
}

fn chat_image_modalities(model: &str) -> Vec<&'static str> {
    let lower = model.trim().to_ascii_lowercase();
    if lower.starts_with("black-forest-labs/")
        || lower.starts_with("sourceful/")
        || lower.starts_with("recraft/")
    {
        vec!["image"]
    } else {
        vec!["image", "text"]
    }
}

fn chat_completions_url(base: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    if let Ok(mut parsed) = reqwest::Url::parse(trimmed) {
        let path = parsed.path().trim_end_matches('/');
        if !path.ends_with("/chat/completions") {
            parsed.set_path(&format!("{path}/chat/completions"));
        }
        parsed.set_query(None);
        parsed.set_fragment(None);
        return parsed.to_string().trim_end_matches('/').to_string();
    }
    format!("{trimmed}/chat/completions")
}

async fn parse_image_json(
    client: &reqwest::Client,
    json: &Value,
) -> AppResult<Option<(String, String)>> {
    if let Some(base64) = json
        .pointer("/data/0/b64_json")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
    {
        return validated_base64_image(base64, "image/png").map(Some);
    }
    if let Some(url) = json
        .pointer("/data/0/url")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
    {
        if url.starts_with("data:image/") {
            let (base64, mime) = strip_data_url(url);
            return validated_base64_image(base64, mime).map(Some);
        }
        return fetch_image_url(client, url).await.map(Some);
    }
    if let Some(value) = find_image_string(json) {
        if value.starts_with("data:image/") {
            let (base64, mime) = strip_data_url(value);
            return validated_base64_image(base64, mime).map(Some);
        }
        if is_http_image_url(value) {
            return fetch_image_url(client, value).await.map(Some);
        }
    }
    Ok(None)
}

fn find_image_string(value: &Value) -> Option<&str> {
    match value {
        Value::String(raw) if raw.starts_with("data:image/") => Some(raw),
        Value::String(raw) => find_image_reference_in_text(raw),
        Value::Array(items) => items.iter().find_map(find_image_string),
        Value::Object(map) => map.values().find_map(find_image_string),
        _ => None,
    }
}

fn find_image_reference_in_text(raw: &str) -> Option<&str> {
    if let Some(start) = raw.find("data:image/") {
        let rest = &raw[start..];
        let end = rest
            .find(|ch: char| ch.is_whitespace() || ch == ')' || ch == '"' || ch == '\'')
            .unwrap_or(rest.len());
        return Some(&rest[..end]);
    }
    if let Some(start) = raw.find("http://").or_else(|| raw.find("https://")) {
        let rest = &raw[start..];
        let end = rest
            .find(|ch: char| {
                ch.is_whitespace() || ch == ')' || ch == '"' || ch == '\'' || ch == '<'
            })
            .unwrap_or(rest.len());
        let candidate = &rest[..end];
        if is_http_image_url(candidate) {
            return Some(candidate);
        }
    }
    None
}

fn is_http_image_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    (lower.starts_with("http://") || lower.starts_with("https://"))
        && [".png", ".jpg", ".jpeg", ".webp", ".gif"]
            .iter()
            .any(|ext| lower.contains(ext))
}

fn closest_openrouter_aspect_ratio(width: u64, height: u64) -> &'static str {
    let ratio = width as f64 / height.max(1) as f64;
    [
        ("21:9", 21.0 / 9.0),
        ("16:9", 16.0 / 9.0),
        ("3:2", 3.0 / 2.0),
        ("5:4", 5.0 / 4.0),
        ("4:3", 4.0 / 3.0),
        ("1:1", 1.0),
        ("3:4", 3.0 / 4.0),
        ("4:5", 4.0 / 5.0),
        ("2:3", 2.0 / 3.0),
        ("9:16", 9.0 / 16.0),
    ]
    .into_iter()
    .min_by(|a, b| {
        (a.1 - ratio)
            .abs()
            .partial_cmp(&(b.1 - ratio).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    })
    .map(|item| item.0)
    .unwrap_or("1:1")
}

fn image_data_url(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.starts_with("data:")
        || trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
    {
        return trimmed.to_string();
    }
    format!(
        "data:{};base64,{}",
        detect_base64_mime_type(trimmed),
        trimmed
    )
}

fn comfy_reference_name_tokens(workflow: &Value) -> Vec<(String, usize)> {
    let mut tokens = HashMap::new();
    collect_comfy_reference_name_tokens(workflow, &mut tokens);
    let mut tokens = tokens.into_iter().collect::<Vec<_>>();
    tokens.sort_by(|(left_token, left_index), (right_token, right_index)| {
        left_index
            .cmp(right_index)
            .then_with(|| left_token.cmp(right_token))
    });
    tokens
}

fn collect_comfy_reference_name_tokens(workflow: &Value, tokens: &mut HashMap<String, usize>) {
    match workflow {
        Value::String(raw) => collect_comfy_reference_name_tokens_from_str(raw, tokens),
        Value::Array(items) => {
            for item in items {
                collect_comfy_reference_name_tokens(item, tokens);
            }
        }
        Value::Object(map) => {
            for item in map.values() {
                collect_comfy_reference_name_tokens(item, tokens);
            }
        }
        _ => {}
    }
}

fn collect_comfy_reference_name_tokens_from_str(raw: &str, tokens: &mut HashMap<String, usize>) {
    const PREFIX: &str = "%reference_image_name";
    let mut offset = 0;
    while let Some(relative_start) = raw[offset..].find(PREFIX) {
        let start = offset + relative_start;
        let suffix_start = start + PREFIX.len();
        let Some(suffix) = raw.get(suffix_start..) else {
            break;
        };
        if suffix.starts_with('%') {
            tokens.insert("%reference_image_name%".to_string(), 0);
            offset = suffix_start + 1;
            continue;
        }
        if !suffix.starts_with('_') {
            offset = suffix_start;
            continue;
        }
        let digits_start = suffix_start + 1;
        let Some(rest) = raw.get(digits_start..) else {
            break;
        };
        let digits_len = rest
            .bytes()
            .take_while(|byte| byte.is_ascii_digit())
            .count();
        if digits_len == 0 {
            offset = digits_start;
            continue;
        }
        let percent_index = digits_start + digits_len;
        if raw.as_bytes().get(percent_index) != Some(&b'%') {
            offset = percent_index;
            continue;
        }
        let Some(index) = raw[digits_start..percent_index].parse::<usize>().ok() else {
            offset = percent_index + 1;
            continue;
        };
        if index > 0 {
            let token = raw[start..=percent_index].to_string();
            tokens.insert(token, index - 1);
        }
        offset = percent_index + 1;
    }
}

async fn upload_comfy_reference_image(base: &str, reference: &str) -> AppResult<String> {
    let decoded = decode_reference_image(reference)?;
    let hash = Sha256::digest(&decoded.bytes);
    let hash_id = general_purpose::URL_SAFE_NO_PAD.encode(&hash[..]);
    let filename = format!("marinara-ref-{}.{}", &hash_id[..16], decoded.extension);
    let part = reqwest::multipart::Part::bytes(decoded.bytes)
        .mime_str(&decoded.mime_type)
        .map_err(|error| {
            AppError::invalid_input(format!("Invalid reference image MIME type: {error}"))
        })?
        .file_name(filename);
    let form = reqwest::multipart::Form::new()
        .part("image", part)
        .text("overwrite", "true");
    let response = http_client(180)?
        .post(format!("{}/upload/image", base.trim_end_matches('/')))
        .multipart(form)
        .send()
        .await
        .map_err(|error| {
            AppError::new("image_network_error", image_transport_error_message(error))
        })?;
    let json = response_json(response, "comfyui").await?;
    json.get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| {
            AppError::new(
                "image_response_error",
                "ComfyUI did not return a filename for the uploaded reference image",
            )
        })
}

async fn generate_stability(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "stability");
    if is_stability_v1_base(&base) {
        return generate_stability_v1(connection, prompt, width, height, options).await;
    }
    let model = connection_model(connection, "stable-image-core");
    let has_reference = !options.reference_images.is_empty();
    let lower_model = model.trim().to_ascii_lowercase();
    let (endpoint, model_field) =
        if !has_reference && matches!(lower_model.as_str(), "stable-image-ultra" | "ultra") {
            ("v2beta/stable-image/generate/ultra".to_string(), None)
        } else if !has_reference && matches!(lower_model.as_str(), "stable-image-core" | "core") {
            ("v2beta/stable-image/generate/core".to_string(), None)
        } else {
            (
                "v2beta/stable-image/generate/sd3".to_string(),
                Some(normalize_stability_sd3_model(&model)),
            )
        };
    let mut form = reqwest::multipart::Form::new()
        .text("prompt", prompt.to_string())
        .text("output_format", "png".to_string());
    if let Some(negative) = options
        .negative_prompt
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        form = form.text("negative_prompt", negative.to_string());
    }
    if let Some(model_field) = model_field {
        form = form
            .text("model", model_field)
            .text("mode", "text-to-image".to_string());
    }
    form = form.text(
        "aspect_ratio",
        closest_stability_aspect_ratio(width, height).to_string(),
    );
    if let Some(reference) = options.reference_images.first() {
        let decoded = decode_reference_image(reference)?;
        let part = reqwest::multipart::Part::bytes(decoded.bytes)
            .mime_str(&decoded.mime_type)
            .map_err(|error| {
                AppError::invalid_input(format!("Invalid reference image MIME type: {error}"))
            })?
            .file_name(format!("reference.{}", decoded.extension));
        form = form
            .part("image", part)
            .text("strength", "0.5".to_string())
            .text("mode", "image-to-image".to_string());
    }
    let response = bearer(
        http_client(180)?
            .post(stability_url(&base, &endpoint))
            .header(reqwest::header::ACCEPT, "image/*")
            .multipart(form),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", image_transport_error_message(error)))?;
    image_response_base64(response, "stability").await
}

async fn generate_stability_v1(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "stability");
    let engine = normalize_stability_v1_engine(
        connection
            .get("model")
            .and_then(Value::as_str)
            .unwrap_or(""),
    );
    let mut text_prompts = vec![json!({ "text": prompt, "weight": 1 })];
    if let Some(negative) = options
        .negative_prompt
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        text_prompts.push(json!({ "text": negative, "weight": -1 }));
    }
    let payload = json!({
        "text_prompts": text_prompts,
        "cfg_scale": 7,
        "height": height,
        "width": width,
        "samples": 1,
        "steps": 30
    });
    let client = http_client(180)?;
    let response = bearer(
        client
            .post(stability_url(
                &base,
                &format!("v1/generation/{engine}/text-to-image"),
            ))
            .header(reqwest::header::ACCEPT, "application/json")
            .json(&payload),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", image_transport_error_message(error)))?;
    let json = response_json(response, "stability").await?;
    let base64 = json
        .get("artifacts")
        .and_then(Value::as_array)
        .and_then(|items| {
            items
                .iter()
                .find_map(|item| item.get("base64").and_then(Value::as_str))
        })
        .ok_or_else(|| AppError::new("image_response_error", "Stability returned no image data"))?;
    validated_base64_image(base64, "image/png")
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

fn is_stability_v1_base(base: &str) -> bool {
    if let Ok(parsed) = reqwest::Url::parse(base) {
        let parts = parsed.path().split('/').collect::<Vec<_>>();
        return parts.contains(&"v1") && !parts.contains(&"v2beta");
    }
    base.contains("/v1") && !base.contains("/v2beta")
}

fn normalize_stability_sd3_model(model: &str) -> String {
    let raw = if model.trim().is_empty() {
        "sd3.5-large"
    } else {
        model.trim()
    };
    match raw.to_ascii_lowercase().as_str() {
        "sd3-large" => "sd3.5-large".to_string(),
        "sd3-large-turbo" => "sd3.5-large-turbo".to_string(),
        "sd3-medium" => "sd3.5-medium".to_string(),
        _ => raw.to_string(),
    }
}

fn normalize_stability_v1_engine(model: &str) -> String {
    let raw = model.trim();
    let lower = raw.to_ascii_lowercase();
    if raw.is_empty()
        || lower.starts_with("sd3")
        || lower.starts_with("stable-image")
        || lower.contains('/')
    {
        "stable-diffusion-xl-1024-v1-0".to_string()
    } else {
        raw.to_string()
    }
}

fn closest_stability_aspect_ratio(width: u64, height: u64) -> &'static str {
    let ratio = width as f64 / height.max(1) as f64;
    [
        ("21:9", 21.0 / 9.0),
        ("16:9", 16.0 / 9.0),
        ("3:2", 3.0 / 2.0),
        ("5:4", 5.0 / 4.0),
        ("1:1", 1.0),
        ("4:5", 4.0 / 5.0),
        ("2:3", 2.0 / 3.0),
        ("9:16", 9.0 / 16.0),
        ("9:21", 9.0 / 21.0),
    ]
    .into_iter()
    .min_by(|a, b| {
        (a.1 - ratio)
            .abs()
            .partial_cmp(&(b.1 - ratio).abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    })
    .map(|item| item.0)
    .unwrap_or("1:1")
}

async fn generate_automatic1111(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "automatic1111");
    let model = connection
        .get("model")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty());
    let defaults = image_defaults_profile(connection, "automatic1111")
        .and_then(|profile| profile.get("automatic1111").cloned())
        .unwrap_or(Value::Null);
    let prompt = merge_prompt(&read_string(defaults.get("promptPrefix"), ""), prompt);
    let negative_prompt = merge_negative_prompt(
        &read_string(defaults.get("negativePromptPrefix"), ""),
        options.negative_prompt.as_deref(),
    );
    let steps = read_u64(defaults.get("steps"), 20, 1, 150);
    let cfg_scale = read_f64(defaults.get("cfgScale"), 7.0, 0.0, 30.0);
    let sampler = read_string(defaults.get("sampler"), "Euler a");
    let scheduler = read_string(defaults.get("scheduler"), "");
    let restore_faces = defaults
        .get("restoreFaces")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let seed = resolve_seed(connection);
    let use_img2img = !options.reference_images.is_empty();
    let mut payload = json!({
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "width": width,
        "height": height,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "sampler_name": sampler,
        "restore_faces": restore_faces,
        "seed": seed,
        "batch_size": 1,
        "n_iter": 1
    });
    if use_img2img {
        payload["init_images"] = json!([reference_base64(&options.reference_images[0])?]);
        payload["denoising_strength"] =
            json!(read_f64(defaults.get("denoisingStrength"), 0.55, 0.0, 1.0));
    }
    if !scheduler.trim().is_empty() {
        payload["scheduler"] = Value::String(scheduler);
    }
    if let Some(clip_skip) = defaults.get("clipSkip").and_then(Value::as_u64) {
        payload["override_settings"] = json!({ "CLIP_stop_at_last_layers": clip_skip });
    }
    if let Some(model) = model {
        payload["sd_model_checkpoint"] = Value::String(model.to_string());
        if payload
            .get("override_settings")
            .and_then(Value::as_object)
            .is_none()
        {
            payload["override_settings"] = json!({});
        }
        let settings = payload
            .get_mut("override_settings")
            .and_then(Value::as_object_mut)
            .expect("override_settings is object when present");
        settings.insert(
            "sd_model_checkpoint".to_string(),
            Value::String(model.to_string()),
        );
    }
    let endpoint = if use_img2img { "img2img" } else { "txt2img" };
    let response = bearer(
        http_client(180)?
            .post(automatic1111_sdapi_url(&base, endpoint))
            .json(&payload),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", image_transport_error_message(error)))?;
    let json = response_json(response, "automatic1111").await?;
    let image = json
        .get("images")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("image_response_error", "AUTOMATIC1111 returned no image"))?;
    let (base64, mime) = strip_data_url(image);
    Ok((base64.to_string(), mime.to_string()))
}

pub(crate) fn automatic1111_sdapi_url(base: &str, endpoint: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    let target_endpoint = endpoint.trim_matches('/');
    if let Ok(mut parsed) = reqwest::Url::parse(trimmed) {
        let parts = parsed
            .path()
            .split('/')
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>();
        let sdapi_index = parts.windows(2).position(|parts| parts == ["sdapi", "v1"]);
        let prefix = sdapi_index
            .map(|index| parts[..index].to_vec())
            .unwrap_or(parts);
        let path = prefix
            .into_iter()
            .chain(["sdapi", "v1", target_endpoint])
            .collect::<Vec<_>>()
            .join("/");
        parsed.set_path(&format!("/{path}"));
        parsed.set_query(None);
        parsed.set_fragment(None);
        return parsed.to_string().trim_end_matches('/').to_string();
    }
    if let Some((prefix, _)) = trimmed.split_once("/sdapi/v1") {
        return format!("{prefix}/sdapi/v1/{target_endpoint}");
    }
    format!("{trimmed}/sdapi/v1/{target_endpoint}")
}

async fn generate_horde(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "horde");
    let api_key = connection_api_key(connection);
    let client = http_client(240)?;
    let horde_prompt = match options
        .negative_prompt
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(negative) => format!("{prompt} ### {negative}"),
        None => prompt.to_string(),
    };
    let mut body = json!({
        "prompt": horde_prompt,
        "params": { "width": width, "height": height, "n": 1 },
        "nsfw": true,
        "trusted_workers": false,
        "slow_workers": true
    });
    if let Some(model) = connection
        .get("model")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        body["models"] = json!([model]);
    }
    let mut request = client.post(format!("{base}/generate/async")).json(&body);
    request = request.header(
        "apikey",
        if api_key.trim().is_empty() {
            "0000000000"
        } else {
            &api_key
        },
    );
    let submit = response_json(
        request.send().await.map_err(|error| {
            AppError::new("image_network_error", image_transport_error_message(error))
        })?,
        "horde",
    )
    .await?;
    let id = submit
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            AppError::new(
                "image_response_error",
                "Stable Horde did not return a request id",
            )
        })?
        .to_string();
    for _ in 0..120 {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let status = response_json(
            client
                .get(format!("{base}/generate/status/{id}"))
                .header(
                    "apikey",
                    if api_key.trim().is_empty() {
                        "0000000000"
                    } else {
                        &api_key
                    },
                )
                .send()
                .await
                .map_err(|error| {
                    AppError::new("image_network_error", image_transport_error_message(error))
                })?,
            "horde",
        )
        .await?;
        if let Some(img) = status
            .get("generations")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("img"))
            .and_then(Value::as_str)
        {
            if img.starts_with("http://") || img.starts_with("https://") {
                return fetch_image_url(&client, img).await;
            }
            let (base64, mime) = strip_data_url(img);
            return Ok((base64.to_string(), mime.to_string()));
        }
        if status.get("done").and_then(Value::as_bool).unwrap_or(false) {
            break;
        }
    }
    Err(AppError::new(
        "image_timeout",
        "Stable Horde did not finish image generation before the timeout",
    ))
}

async fn generate_comfyui(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let defaults = resolve_comfy_defaults(connection);
    let prompt = merge_prompt(&defaults.prompt_prefix, prompt);
    let negative_prompt = merge_negative_prompt(
        &defaults.negative_prompt_prefix,
        options.negative_prompt.as_deref(),
    );
    let workflow = connection
        .get("comfyuiWorkflow")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(|raw| {
            serde_json::from_str::<Value>(raw).map_err(|error| {
                AppError::invalid_input(format!("Invalid ComfyUI workflow JSON: {error}"))
            })
        })
        .transpose()?
        .unwrap_or_else(|| default_comfyui_workflow(&defaults));
    let base = connection_base_url(connection, "comfyui");
    let mut replacements = comfy_replacements(
        connection,
        &defaults,
        &prompt,
        &negative_prompt,
        width,
        height,
        options.reference_images.first().map(String::as_str),
    );
    let reference_name_tokens = comfy_reference_name_tokens(&workflow);
    if !reference_name_tokens.is_empty() {
        let mut uploaded_by_slot: HashMap<usize, String> = HashMap::new();
        for (_, index) in &reference_name_tokens {
            if uploaded_by_slot.contains_key(index) {
                continue;
            }
            let reference = options
                .reference_images
                .get(*index)
                .map(String::as_str)
                .unwrap_or(COMFYUI_PLACEHOLDER_REFERENCE_BASE64);
            uploaded_by_slot.insert(
                *index,
                upload_comfy_reference_image(&base, reference).await?,
            );
        }
        for (token, index) in reference_name_tokens {
            if let Some(filename) = uploaded_by_slot.get(&index) {
                replacements.insert(token, Value::String(filename.clone()));
            }
        }
    }
    let prompt_json = replace_workflow_placeholders(workflow, &replacements);
    let client = http_client(240)?;
    let response = response_json(
        client
            .post(format!("{base}/prompt"))
            .json(&json!({ "prompt": prompt_json }))
            .send()
            .await
            .map_err(|error| {
                AppError::new("image_network_error", image_transport_error_message(error))
            })?,
        "comfyui",
    )
    .await?;
    let prompt_id = response
        .get("prompt_id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("image_response_error", "ComfyUI did not return a prompt id"))?
        .to_string();
    for _ in 0..120 {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let history = response_json(
            client
                .get(format!("{base}/history/{prompt_id}"))
                .send()
                .await
                .map_err(|error| {
                    AppError::new("image_network_error", image_transport_error_message(error))
                })?,
            "comfyui",
        )
        .await?;
        if let Some(image) = find_comfyui_image(&history, &prompt_id) {
            let filename = image.get("filename").and_then(Value::as_str).unwrap_or("");
            let subfolder = image.get("subfolder").and_then(Value::as_str).unwrap_or("");
            let kind = image
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("output");
            if !filename.is_empty() {
                let url = format!(
                    "{base}/view?filename={}&subfolder={}&type={}",
                    percent_encode_component(filename),
                    percent_encode_component(subfolder),
                    percent_encode_component(kind)
                );
                return fetch_image_url(&client, &url).await;
            }
        }
    }
    Err(AppError::new(
        "image_timeout",
        "ComfyUI did not finish image generation before the timeout",
    ))
}

fn default_comfyui_workflow(defaults: &ComfyDefaults) -> Value {
    json!({
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": "%seed%",
                "steps": defaults.steps,
                "cfg": defaults.cfg_scale,
                "sampler_name": defaults.sampler,
                "scheduler": defaults.scheduler,
                "denoise": defaults.denoising_strength,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            }
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": { "ckpt_name": "%model%" }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": { "width": "%width%", "height": "%height%", "batch_size": 1 }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": { "text": "%prompt%", "clip": ["4", 1] }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": { "text": "%negative_prompt%", "clip": ["4", 1] }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": { "filename_prefix": "marinara", "images": ["8", 0] }
        }
    })
}

fn comfy_replacements(
    connection: &Value,
    defaults: &ComfyDefaults,
    prompt: &str,
    negative_prompt: &str,
    width: u64,
    height: u64,
    reference_image: Option<&str>,
) -> HashMap<String, Value> {
    let mut replacements = HashMap::from([
        ("%prompt%".to_string(), Value::String(prompt.to_string())),
        (
            "%negative_prompt%".to_string(),
            Value::String(negative_prompt.to_string()),
        ),
        ("%width%".to_string(), json!(width)),
        ("%height%".to_string(), json!(height)),
        ("%seed%".to_string(), json!(resolve_seed(connection))),
        ("%steps%".to_string(), json!(defaults.steps)),
        ("%cfg%".to_string(), json!(defaults.cfg_scale)),
        ("%cfg_scale%".to_string(), json!(defaults.cfg_scale)),
        ("%scale%".to_string(), json!(defaults.cfg_scale)),
        (
            "%sampler%".to_string(),
            Value::String(defaults.sampler.clone()),
        ),
        (
            "%scheduler%".to_string(),
            Value::String(defaults.scheduler.clone()),
        ),
        ("%denoise%".to_string(), json!(defaults.denoising_strength)),
        (
            "%denoising_strength%".to_string(),
            json!(defaults.denoising_strength),
        ),
        (
            "%clip_skip%".to_string(),
            json!(defaults.clip_skip.unwrap_or(0)),
        ),
    ]);
    if let Some(model) = connection
        .get("model")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        replacements.insert("%model%".to_string(), Value::String(model.to_string()));
    }
    if let Some(reference) = reference_image {
        replacements.insert(
            "%reference_image%".to_string(),
            Value::String(
                reference_base64(reference).unwrap_or_else(|_| image_data_url(reference)),
            ),
        );
    }
    replacements
}

fn replace_workflow_placeholders(value: Value, replacements: &HashMap<String, Value>) -> Value {
    match value {
        Value::String(raw) => {
            if let Some(exact) = replacements.get(&raw) {
                return exact.clone();
            }
            let replaced = replacements
                .iter()
                .fold(raw, |current, (token, replacement)| {
                    let replacement = replacement
                        .as_str()
                        .map(str::to_string)
                        .unwrap_or_else(|| replacement.to_string());
                    current.replace(token, &replacement)
                });
            Value::String(replaced)
        }
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .map(|item| replace_workflow_placeholders(item, replacements))
                .collect(),
        ),
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, item)| (key, replace_workflow_placeholders(item, replacements)))
                .collect(),
        ),
        other => other,
    }
}

async fn generate_runpod_comfyui(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let endpoint_id = connection
        .get("imageEndpointId")
        .or_else(|| connection.get("image_endpoint_id"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            AppError::invalid_input(
                "RunPod ComfyUI requires an endpoint ID on the image connection",
            )
        })?;
    let endpoint_id = normalize_runpod_endpoint_id(endpoint_id)?;
    let workflow = connection
        .get("comfyuiWorkflow")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            AppError::invalid_input(
                "RunPod ComfyUI requires a workflow JSON on the image connection",
            )
        })?;
    let defaults = resolve_comfy_defaults(connection);
    let prompt = merge_prompt(&defaults.prompt_prefix, prompt);
    let negative_prompt = merge_negative_prompt(
        &defaults.negative_prompt_prefix,
        options.negative_prompt.as_deref(),
    );
    let workflow = serde_json::from_str::<Value>(workflow).map_err(|error| {
        AppError::invalid_input(format!("Invalid ComfyUI workflow JSON: {error}"))
    })?;
    let workflow = replace_workflow_placeholders(
        workflow,
        &comfy_replacements(
            connection,
            &defaults,
            &prompt,
            &negative_prompt,
            width,
            height,
            options.reference_images.first().map(String::as_str),
        ),
    );
    let base = connection_base_url(connection, "runpod_comfyui");
    let client = http_client(30)?;
    let api_key = connection_api_key(connection);
    let submit = response_json(
        bearer(
            client
                .post(runpod_url(&base, &endpoint_id, &["run"]))
                .json(&json!({ "input": { "workflow": workflow } })),
            &api_key,
        )
        .send()
        .await
        .map_err(|error| {
            AppError::new("image_network_error", image_transport_error_message(error))
        })?,
        "runpod",
    )
    .await?;
    let job_id = submit
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("image_response_error", "RunPod did not return a job id"))?
        .to_string();
    let poll_client = http_client(210)?;
    for _ in 0..90 {
        tokio::time::sleep(Duration::from_secs(2)).await;
        let status = response_json(
            bearer(
                poll_client.get(runpod_url(&base, &endpoint_id, &["status", &job_id])),
                &api_key,
            )
            .send()
            .await
            .map_err(|error| {
                AppError::new("image_network_error", image_transport_error_message(error))
            })?,
            "runpod",
        )
        .await?;
        match status.get("status").and_then(Value::as_str).unwrap_or("") {
            "COMPLETED" => return extract_runpod_image(&status),
            "FAILED" => {
                return Err(AppError::new(
                    "image_provider_error",
                    format!(
                        "RunPod generation failed: {}",
                        status
                            .get("error")
                            .and_then(Value::as_str)
                            .unwrap_or("Unknown error")
                    ),
                ));
            }
            "CANCELLED" => {
                return Err(AppError::new(
                    "image_provider_error",
                    "RunPod generation was cancelled",
                ));
            }
            _ => {}
        }
    }
    Err(AppError::new(
        "image_timeout",
        "RunPod generation timed out after 3 minutes",
    ))
}

fn normalize_runpod_endpoint_id(value: &str) -> AppResult<String> {
    let trimmed = value.trim();
    if trimmed.is_empty()
        || !trimmed
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err(AppError::invalid_input(
            "RunPod endpoint ID may only contain letters, numbers, underscores, and dashes",
        ));
    }
    Ok(trimmed.to_string())
}

fn runpod_url(base: &str, endpoint_id: &str, path: &[&str]) -> String {
    let mut url = format!("{}/{}", base.trim_end_matches('/'), endpoint_id);
    for segment in path {
        url.push('/');
        url.push_str(&percent_encode_component(segment));
    }
    url
}

fn extract_runpod_image(status: &Value) -> AppResult<(String, String)> {
    let images = status
        .pointer("/output/images")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            AppError::new(
                "image_response_error",
                "RunPod returned COMPLETED but output.images was empty or missing",
            )
        })?;
    for image in images {
        let candidate = image
            .get("data")
            .or_else(|| image.get("base64"))
            .or_else(|| image.get("image"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let Some(value) = candidate {
            if value.starts_with("data:") {
                let (base64, mime) = strip_data_url(value);
                return validated_base64_image(base64, mime);
            }
            return validated_base64_image(value, &detect_base64_mime_type(value));
        }
    }
    Err(AppError::new(
        "image_response_error",
        "Could not extract image data from RunPod output",
    ))
}

async fn generate_novelai(
    connection: &Value,
    prompt: &str,
    width: u64,
    height: u64,
    options: &ImageGenerationOptions,
) -> AppResult<(String, String)> {
    let base = connection_base_url(connection, "novelai");
    if !base.to_ascii_lowercase().contains("novelai.net") {
        return generate_chat_image(connection, prompt, width, height, options).await;
    }
    let model = connection_model(connection, "nai-diffusion-4-5-full");
    let is_v4 = is_novelai_v4_model(&model);
    let defaults = resolve_novelai_defaults(connection);
    let prompt = prepare_novelai_prompt(
        &merge_prompt(&defaults.prompt_prefix, prompt),
        "prompt",
        &model,
    )?;
    let negative_prompt = prepare_novelai_prompt(
        &merge_negative_prompt(
            &defaults.negative_prompt_prefix,
            options.negative_prompt.as_deref(),
        ),
        "negative prompt",
        &model,
    )?;
    let mut parameters = json!({
        "width": width,
        "height": height,
        "n_samples": 1,
        "ucPreset": defaults.undesired_content_preset,
        "negative_prompt": negative_prompt,
        "seed": resolve_seed(connection),
        "scale": defaults.prompt_guidance,
        "steps": defaults.steps,
        "sampler": defaults.sampler
    });
    if !defaults.noise_schedule.trim().is_empty() {
        parameters["noise_schedule"] = Value::String(defaults.noise_schedule);
    }
    if is_v4 {
        parameters["cfg_rescale"] = json!(defaults.prompt_guidance_rescale);
        parameters["params_version"] = json!(3);
        parameters["v4_prompt"] = json!({
            "caption": { "base_caption": prompt, "char_captions": [] },
            "use_coords": false,
            "use_order": true
        });
        parameters["v4_negative_prompt"] = json!({
            "caption": { "base_caption": negative_prompt, "char_captions": [] },
            "use_coords": false,
            "use_order": true
        });
        apply_novelai_reference_images(&mut parameters, &model, options)?;
    }
    let body = json!({
        "input": prompt,
        "model": model,
        "action": "generate",
        "parameters": parameters
    });
    let client = http_client(300)?;
    let response = bearer(
        client.post(format!("{base}/ai/generate-image")).json(&body),
        &connection_api_key(connection),
    )
    .send()
    .await
    .map_err(|error| AppError::new("image_network_error", image_transport_error_message(error)))?;
    let (bytes, content_type) = response_bytes(response, "novelai").await?;
    parse_novelai_image_response(&client, bytes, &content_type).await
}

fn is_novelai_v4_model(model: &str) -> bool {
    let model = model.trim().to_ascii_lowercase();
    model.starts_with("nai-diffusion-4")
}

fn is_novelai_v45_model(model: &str) -> bool {
    let model = model.trim().to_ascii_lowercase();
    model.starts_with("nai-diffusion-4-5")
}

fn apply_novelai_reference_images(
    parameters: &mut Value,
    model: &str,
    options: &ImageGenerationOptions,
) -> AppResult<()> {
    let refs = options
        .reference_images
        .iter()
        .map(|image| reference_base64(image))
        .collect::<AppResult<Vec<_>>>()?;

    if is_novelai_v45_model(model) {
        if refs.is_empty() {
            return Ok(());
        }
        let descriptions = refs
            .iter()
            .map(|_| {
                json!({
                    "caption": { "base_caption": "character&style", "char_captions": [] },
                    "legacy_uc": false
                })
            })
            .collect::<Vec<_>>();
        parameters["director_reference_images"] = json!(refs);
        parameters["director_reference_descriptions"] = json!(descriptions);
        parameters["director_reference_information_extracted"] = json!(vec![1.0; refs.len()]);
        parameters["director_reference_strength_values"] = json!(vec![0.6; refs.len()]);
        parameters["director_reference_secondary_strength_values"] = json!(vec![0.0; refs.len()]);
        return Ok(());
    }

    parameters["reference_image_multiple"] = json!(refs);
    parameters["reference_information_extracted_multiple"] =
        json!(vec![1; options.reference_images.len()]);
    parameters["reference_strength_multiple"] = json!(vec![0.6; options.reference_images.len()]);
    Ok(())
}

fn prepare_novelai_prompt(value: &str, field_name: &str, model: &str) -> AppResult<String> {
    if !is_novelai_v4_model(model) {
        return Ok(value.to_string());
    }
    let sanitized = sanitize_novelai_v4_prompt(value);
    if !value.trim().is_empty() && sanitized.is_empty() {
        return Err(AppError::invalid_input(format!(
            "NovelAI {field_name} contains only unsupported V4/V4.5 prompt characters. {NOVELAI_V4_PROMPT_HINT}"
        )));
    }
    Ok(truncate_novelai_v4_prompt(&sanitized))
}

fn sanitize_novelai_v4_prompt(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            '\u{2018}' | '\u{2019}' | '\u{201A}' | '\u{201B}' => '\'',
            '\u{201C}' | '\u{201D}' | '\u{201E}' | '\u{201F}' => '"',
            '\u{2010}'..='\u{2015}' | '\u{2212}' => '-',
            '\u{00A0}' => ' ',
            '\u{2026}' => '.',
            '\t' | '\n' | '\r' => ch,
            '\u{20}'..='\u{7E}' => ch,
            _ => ' ',
        })
        .collect::<String>()
        .split('\n')
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn truncate_novelai_v4_prompt(value: &str) -> String {
    let mut chars = value.chars();
    let truncated: String = chars.by_ref().take(NOVELAI_V4_PROMPT_CHAR_LIMIT).collect();
    if chars.next().is_none() {
        return value.to_string();
    }
    truncated
        .trim_end_matches(&[',', ' ', '\n', '\r', '\t'][..])
        .to_string()
}

fn image_provider_json_error(json: &Value) -> Option<String> {
    let direct = [
        json.pointer("/error/message").and_then(Value::as_str),
        json.pointer("/error").and_then(Value::as_str),
        json.pointer("/message").and_then(Value::as_str),
        json.pointer("/detail").and_then(Value::as_str),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .find(|value| !value.is_empty());
    if let Some(message) = direct {
        return Some(message.to_string());
    }
    json.get("errors")
        .and_then(Value::as_array)
        .and_then(|errors| {
            errors.iter().find_map(|entry| {
                entry
                    .get("message")
                    .and_then(Value::as_str)
                    .or_else(|| entry.as_str())
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
            })
        })
        .map(str::to_string)
}

async fn parse_novelai_image_response(
    client: &reqwest::Client,
    bytes: Vec<u8>,
    content_type: &str,
) -> AppResult<(String, String)> {
    if bytes.starts_with(b"PK") || content_type.to_ascii_lowercase().contains("zip") {
        let mut zip_reader = zip::ZipArchive::new(Cursor::new(bytes.clone()))
            .map_err(|error| AppError::new("image_response_error", error.to_string()))?;
        for index in 0..zip_reader.len() {
            let mut file = zip_reader
                .by_index(index)
                .map_err(|error| AppError::new("image_response_error", error.to_string()))?;
            if file.is_dir() {
                continue;
            }
            let mut image = Vec::new();
            if file.size() > IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES as u64 {
                return Err(image_response_too_large_error(
                    IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES,
                ));
            }
            let mut limited = (&mut file).take((IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES as u64) + 1);
            limited
                .read_to_end(&mut image)
                .map_err(|error| AppError::new("image_response_error", error.to_string()))?;
            if image.len() > IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES {
                return Err(image_response_too_large_error(
                    IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES,
                ));
            }
            let mime = detect_image_mime_type(&image).to_string();
            return Ok((general_purpose::STANDARD.encode(image), mime));
        }
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G'])
        || bytes.starts_with(&[0xff, 0xd8, 0xff])
        || (bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP")
    {
        let mime = detect_image_mime_type(&bytes).to_string();
        return Ok((general_purpose::STANDARD.encode(bytes), mime));
    }
    if let Ok(json) = serde_json::from_slice::<Value>(&bytes) {
        if let Some(result) = parse_image_json(client, &json).await? {
            return Ok(result);
        }
        if let Some(error) = image_provider_json_error(&json) {
            return Err(AppError::new(
                "image_provider_error",
                format!("NovelAI returned no image data: {}", sanitize_error(&error)),
            ));
        }
    }
    Err(AppError::new(
        "image_response_error",
        "Could not parse NovelAI image response",
    ))
}

fn find_comfyui_image<'a>(history: &'a Value, prompt_id: &str) -> Option<&'a Value> {
    history
        .get(prompt_id)
        .and_then(|value| value.get("outputs"))
        .and_then(Value::as_object)
        .and_then(|outputs| {
            outputs.values().find_map(|output| {
                output
                    .get("images")
                    .and_then(Value::as_array)
                    .and_then(|images| images.first())
            })
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    fn find_header_end(bytes: &[u8]) -> Option<usize> {
        bytes.windows(4).position(|window| window == b"\r\n\r\n")
    }

    fn content_length(headers: &str) -> usize {
        headers
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                if name.eq_ignore_ascii_case("content-length") {
                    value.trim().parse::<usize>().ok()
                } else {
                    None
                }
            })
            .unwrap_or(0)
    }

    async fn serve_single_image_response() -> (String, tokio::task::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test image server should bind");
        let address = listener
            .local_addr()
            .expect("test image server address should be readable");
        let handle = tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test image server should accept one request");
            let mut request = Vec::new();
            let mut buffer = [0_u8; 1024];
            loop {
                let read = stream
                    .read(&mut buffer)
                    .await
                    .expect("test image server should read request");
                if read == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..read]);
                if let Some(header_end) = find_header_end(&request) {
                    let headers = String::from_utf8_lossy(&request[..header_end]);
                    let expected_len = header_end + 4 + content_length(&headers);
                    if request.len() >= expected_len {
                        break;
                    }
                }
            }
            let body = r#"{"images":["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="],"info":"{}"}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test image server should write response");
            String::from_utf8_lossy(&request).to_string()
        });
        (format!("http://{address}"), handle)
    }

    async fn serve_single_png_response() -> (String, tokio::task::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test image server should bind");
        let address = listener
            .local_addr()
            .expect("test image server address should be readable");
        let handle = tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test image server should accept one request");
            let mut request = Vec::new();
            let mut buffer = [0_u8; 1024];
            loop {
                let read = stream
                    .read(&mut buffer)
                    .await
                    .expect("test image server should read request");
                if read == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..read]);
                if let Some(header_end) = find_header_end(&request) {
                    let headers = String::from_utf8_lossy(&request[..header_end]);
                    let expected_len = header_end + 4 + content_length(&headers);
                    if request.len() >= expected_len {
                        break;
                    }
                }
            }
            let body = general_purpose::STANDARD
                .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=")
                .expect("test png should decode");
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test image server should write headers");
            stream
                .write_all(&body)
                .await
                .expect("test image server should write body");
            String::from_utf8_lossy(&request).to_string()
        });
        (format!("http://{address}"), handle)
    }

    async fn serve_bytes_response(
        status: &'static str,
        content_type: &'static str,
        body: Vec<u8>,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test image server should bind");
        let address = listener
            .local_addr()
            .expect("test image server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test image server should accept one request");
            let mut buffer = [0_u8; 1024];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test image server should read request");
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test image server should write response headers");
            stream
                .write_all(&body)
                .await
                .expect("test image server should write response body");
        });
        format!("http://{address}")
    }

    async fn serve_chunked_response(
        status: &'static str,
        content_type: &'static str,
        chunks: Vec<Vec<u8>>,
    ) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test image server should bind");
        let address = listener
            .local_addr()
            .expect("test image server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test image server should accept one request");
            let mut buffer = [0_u8; 1024];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test image server should read request");
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n",
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test image server should write response headers");
            for chunk in chunks {
                let header = format!("{:x}\r\n", chunk.len());
                stream
                    .write_all(header.as_bytes())
                    .await
                    .expect("test image server should write chunk header");
                stream
                    .write_all(&chunk)
                    .await
                    .expect("test image server should write chunk body");
                stream
                    .write_all(b"\r\n")
                    .await
                    .expect("test image server should write chunk terminator");
            }
            stream
                .write_all(b"0\r\n\r\n")
                .await
                .expect("test image server should write final chunk");
        });
        format!("http://{address}")
    }

    async fn response_from_body(
        status: &'static str,
        content_type: &'static str,
        body: Vec<u8>,
    ) -> reqwest::Response {
        let url = serve_bytes_response(status, content_type, body).await;
        http_client(1)
            .expect("client should build")
            .get(url)
            .send()
            .await
            .expect("test image response should arrive")
    }

    fn zip_with_image(name: &str, image: &[u8]) -> Vec<u8> {
        let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
        writer
            .start_file(
                name,
                zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Deflated),
            )
            .expect("zip entry should start");
        writer.write_all(image).expect("zip image should write");
        writer.finish().expect("zip should finish").into_inner()
    }

    #[test]
    fn image_provider_error_sanitizer_redacts_secrets() {
        let sanitized = sanitize_error(
            r#"{"error":"bad key sk-test-secret","payment":"https://pay.example.test/retrieve/session"}"#,
        );

        assert!(sanitized.contains("[REDACTED]"));
        assert!(sanitized.contains("[REDACTED_URL]"));
        assert!(!sanitized.contains("sk-test-secret"));
        assert!(!sanitized.contains("retrieve/session"));
    }

    #[tokio::test]
    async fn image_provider_response_body_is_capped() {
        let response = response_from_body(
            "500 Internal Server Error",
            "text/plain",
            vec![b'x'; IMAGE_PROVIDER_ERROR_MAX_BYTES + 1024],
        )
        .await;

        let error = response_json(response, "test-provider")
            .await
            .expect_err("oversized image provider error should stay status-bearing");

        assert_eq!(error.code, "image_provider_error");
        assert!(error
            .message
            .contains("test-provider returned HTTP 500 Internal Server Error"));
        assert!(!error.message.contains("exceeds"));
        assert!(error.message.len() < 600);
    }

    #[tokio::test]
    async fn image_provider_chunked_error_body_is_bounded_status_bearing() {
        let url = serve_chunked_response(
            "502 Bad Gateway",
            "text/html",
            vec![
                b"<html>bad upstream sk-test-secret ".to_vec(),
                vec![b'x'; IMAGE_PROVIDER_ERROR_MAX_BYTES + 1024],
            ],
        )
        .await;
        let response = http_client(1)
            .expect("client should build")
            .get(url)
            .send()
            .await
            .expect("chunked test image response should arrive");
        let error = image_response_base64(response, "chunked-provider")
            .await
            .expect_err("chunked oversized error should stay status-bearing");

        assert_eq!(error.code, "image_provider_error");
        assert!(error
            .message
            .contains("chunked-provider returned HTTP 502 Bad Gateway"));
        assert!(error.message.contains("[REDACTED]"));
        assert!(!error.message.contains("sk-test-secret"));
        assert!(!error.message.contains("exceeds"));
        assert!(error.message.len() < 600);
    }

    #[tokio::test]
    async fn image_json_base64_envelope_can_exceed_legacy_five_mib_cap() {
        let mut image = vec![0_u8; 6 * 1024 * 1024];
        image[..8].copy_from_slice(&[0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n']);
        let base64 = general_purpose::STANDARD.encode(&image);
        let body = format!(r#"{{"data":[{{"b64_json":"{base64}"}}]}}"#);
        assert!(body.len() > 5 * 1024 * 1024);
        let response = response_from_body("200 OK", "application/json", body.into_bytes()).await;
        let json = response_json(response, "test-provider")
            .await
            .expect("large JSON envelope should parse within envelope cap");
        let result = parse_image_json(&http_client(1).expect("client should build"), &json)
            .await
            .expect("decoded image should be within raw image cap")
            .expect("image data should be found");

        assert_eq!(result.0, base64);
    }

    #[tokio::test]
    async fn direct_binary_image_can_exceed_legacy_five_mib_cap() {
        let mut image = vec![0_u8; 6 * 1024 * 1024];
        image[..8].copy_from_slice(&[0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n']);
        let response = response_from_body("200 OK", "image/png", image).await;
        let (base64, mime) = image_response_base64(response, "test-provider")
            .await
            .expect("raw image within product cap should succeed");

        assert_eq!(mime, "image/png");
        assert!(base64.len() > 5 * 1024 * 1024);
    }

    #[tokio::test]
    async fn image_json_decoded_image_over_raw_cap_is_rejected() {
        let image = vec![0_u8; IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES + 1];
        let base64 = general_purpose::STANDARD.encode(&image);
        let json = json!({ "data": [{ "b64_json": base64 }] });

        let error = parse_image_json(&http_client(1).expect("client should build"), &json)
            .await
            .expect_err("decoded image above raw cap should fail");

        assert_eq!(error.code, "image_response_error");
        assert!(error.message.contains("exceeds"));
    }

    #[test]
    fn google_inline_data_rejects_decoded_image_over_raw_cap() {
        let base64 =
            general_purpose::STANDARD.encode(vec![0_u8; IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES + 1]);
        let json = json!({
            "candidates": [{
                "content": {
                    "parts": [{
                        "inlineData": { "mimeType": "image/png", "data": base64 }
                    }]
                }
            }]
        });
        let error = parse_google_generate_content_image(&json)
            .expect_err("oversized Gemini inline data should fail");

        assert_eq!(error.code, "image_response_error");
        assert!(error.message.contains("exceeds"));
    }

    #[test]
    fn google_inline_data_accepts_image_within_raw_cap() {
        let base64 = general_purpose::STANDARD.encode(vec![0_u8; 1024]);
        let json = json!({
            "candidates": [{
                "content": {
                    "parts": [{
                        "inlineData": { "mimeType": "image/png", "data": base64 }
                    }]
                }
            }]
        });
        let result = parse_google_generate_content_image(&json)
            .expect("Gemini inline data should parse")
            .expect("Gemini inline image should exist");

        assert_eq!(result.1, "image/png");
    }

    #[test]
    fn google_predict_rejects_decoded_image_over_raw_cap() {
        let base64 =
            general_purpose::STANDARD.encode(vec![0_u8; IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES + 1]);
        let json = json!({
            "predictions": [{
                "bytesBase64Encoded": base64,
                "mimeType": "image/png"
            }]
        });
        let error = parse_google_predict_image(&json)
            .expect_err("oversized Imagen inline data should fail");

        assert_eq!(error.code, "image_response_error");
        assert!(error.message.contains("exceeds"));
    }

    #[tokio::test]
    async fn image_json_explicit_url_reports_oversized_fetch_error() {
        let url = serve_bytes_response(
            "200 OK",
            "image/png",
            vec![0_u8; IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES + 1],
        )
        .await;
        let json = json!({ "data": [{ "url": url }] });
        let error = parse_image_json(&http_client(1).expect("client should build"), &json)
            .await
            .expect_err("oversized fetched image should surface");

        assert_eq!(error.code, "image_response_error");
        assert!(error.message.contains("exceeds"));
    }

    #[tokio::test]
    async fn image_json_nested_url_reports_oversized_fetch_error() {
        let url = format!(
            "{}/image.png",
            serve_bytes_response(
                "200 OK",
                "image/png",
                vec![0_u8; IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES + 1],
            )
            .await
        );
        let json = json!({ "message": format!("image at {url}") });
        let error = parse_image_json(&http_client(1).expect("client should build"), &json)
            .await
            .expect_err("oversized nested fetched image should surface");

        assert_eq!(error.code, "image_response_error");
        assert!(error.message.contains("exceeds"));
    }

    #[tokio::test]
    async fn image_json_explicit_url_success_still_returns_image() {
        let mut image = vec![0_u8; 1024];
        image[..8].copy_from_slice(&[0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n']);
        let url = serve_bytes_response("200 OK", "image/png", image).await;
        let json = json!({ "data": [{ "url": url }] });
        let result = parse_image_json(&http_client(1).expect("client should build"), &json)
            .await
            .expect("image URL fetch should succeed")
            .expect("image URL should return image data");

        assert_eq!(result.1, "image/png");
    }

    #[tokio::test]
    async fn novelai_zip_entry_over_raw_cap_is_rejected_before_base64() {
        let client = http_client(1).expect("client should build");
        let archive = zip_with_image(
            "image.png",
            &vec![0_u8; IMAGE_PROVIDER_RAW_IMAGE_MAX_BYTES + 1],
        );
        assert!(archive.len() < IMAGE_PROVIDER_JSON_ENVELOPE_MAX_BYTES);
        let error = parse_novelai_image_response(&client, archive, "application/zip")
            .await
            .expect_err("oversized zipped image should fail");

        assert_eq!(error.code, "image_response_error");
        assert!(error.message.contains("exceeds"));
    }

    #[tokio::test]
    async fn novelai_zip_small_png_still_parses() {
        let client = http_client(1).expect("client should build");
        let mut image = vec![0_u8; 1024];
        image[..8].copy_from_slice(&[0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n']);
        let archive = zip_with_image("image.png", &image);
        let (_base64, mime) = parse_novelai_image_response(&client, archive, "application/zip")
            .await
            .expect("small zipped image should parse");

        assert_eq!(mime, "image/png");
    }

    #[test]
    fn comfy_reference_name_tokens_collect_default_and_indexed_slots() {
        let workflow = json!({
            "1": { "inputs": { "image": "%reference_image_name%" } },
            "2": { "inputs": { "image": "%reference_image_name_01%" } },
            "3": { "inputs": { "image": "left %reference_image_name_02% right %reference_image_name_10%" } },
            "4": { "inputs": { "image": "%reference_image_name_00%" } },
            "5": { "inputs": { "image": "%reference_image_name_abc%" } }
        });

        assert_eq!(
            comfy_reference_name_tokens(&workflow),
            vec![
                ("%reference_image_name%".to_string(), 0),
                ("%reference_image_name_01%".to_string(), 0),
                ("%reference_image_name_02%".to_string(), 1),
                ("%reference_image_name_10%".to_string(), 9),
            ]
        );
    }

    #[test]
    fn replace_workflow_placeholders_resolves_all_comfy_reference_name_slots() {
        let workflow = json!({
            "first": "%reference_image_name%",
            "first_indexed": "%reference_image_name_01%",
            "second": "%reference_image_name_02%",
            "missing": "%reference_image_name_03%",
            "embedded": "refs: %reference_image_name_01%, %reference_image_name_02%, %reference_image_name_03%",
            "invalid": "%reference_image_name_00%"
        });
        let mut replacements = HashMap::new();
        for (token, index) in comfy_reference_name_tokens(&workflow) {
            let filename = match index {
                0 => "first.png",
                1 => "second.png",
                _ => "placeholder.png",
            };
            replacements.insert(token, Value::String(filename.to_string()));
        }

        let resolved = replace_workflow_placeholders(workflow, &replacements);

        assert_eq!(resolved["first"], json!("first.png"));
        assert_eq!(resolved["first_indexed"], json!("first.png"));
        assert_eq!(resolved["second"], json!("second.png"));
        assert_eq!(resolved["missing"], json!("placeholder.png"));
        assert_eq!(
            resolved["embedded"],
            json!("refs: first.png, second.png, placeholder.png")
        );
        assert_eq!(resolved["invalid"], json!("%reference_image_name_00%"));
    }

    #[test]
    fn novelai_v4_prompt_sanitization_trims_unicode_and_caps_length() {
        let prompt = format!(
            "{} {}",
            "夜".repeat(20),
            "beautiful cinematic portrait, ".repeat(200)
        );
        let sanitized = prepare_novelai_prompt(&prompt, "prompt", "nai-diffusion-4-5-full")
            .expect("mixed prompt should sanitize");

        assert!(sanitized.is_ascii());
        assert!(sanitized.chars().count() <= NOVELAI_V4_PROMPT_CHAR_LIMIT);
        assert!(!sanitized.ends_with(','));
    }

    #[tokio::test]
    async fn novelai_json_error_is_reported() {
        let client = http_client(1).expect("client should build");
        let error = parse_novelai_image_response(
            &client,
            br#"{"error":{"message":"prompt is too long"}}"#.to_vec(),
            "application/json",
        )
        .await
        .expect_err("json error payload should fail");

        assert_eq!(error.code, "image_provider_error");
        assert!(error.message.contains("prompt is too long"));
    }

    #[tokio::test]
    async fn novelai_v45_reference_images_use_director_reference_fields() {
        let reference_image =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
        let (base_url, request_handle) = serve_single_png_response().await;
        let connection = json!({
            "provider": "image_generation",
            "imageGenerationSource": "novelai",
            "baseUrl": format!("{base_url}/novelai.net"),
            "model": "nai-diffusion-4-5-full"
        });

        generate_novelai(
            &connection,
            "solo character portrait",
            1024,
            1024,
            &ImageGenerationOptions {
                reference_images: vec![reference_image.to_string()],
                ..ImageGenerationOptions::default()
            },
        )
        .await
        .expect("NovelAI response should parse");

        let request = request_handle
            .await
            .expect("test image server should return captured request");
        let body = request
            .split_once("\r\n\r\n")
            .map(|(_, body)| body)
            .expect("request should contain a JSON body");
        let payload: Value = serde_json::from_str(body).expect("request body should be JSON");
        let parameters = &payload["parameters"];

        assert_eq!(payload["model"], json!("nai-diffusion-4-5-full"));
        assert_eq!(
            parameters["director_reference_images"],
            json!([reference_image])
        );
        assert_eq!(
            parameters["director_reference_descriptions"],
            json!([{
                "caption": { "base_caption": "character&style", "char_captions": [] },
                "legacy_uc": false
            }])
        );
        assert_eq!(
            parameters["director_reference_information_extracted"],
            json!([1.0])
        );
        assert_eq!(
            parameters["director_reference_strength_values"],
            json!([0.6])
        );
        assert_eq!(
            parameters["director_reference_secondary_strength_values"],
            json!([0.0])
        );
        assert!(parameters.get("reference_image_multiple").is_none());
        assert!(parameters
            .get("reference_information_extracted_multiple")
            .is_none());
        assert!(parameters.get("reference_strength_multiple").is_none());
    }

    #[test]
    fn novelai_v45_without_references_omits_reference_parameters() {
        let mut parameters = json!({});

        apply_novelai_reference_images(
            &mut parameters,
            "nai-diffusion-4-5-full",
            &ImageGenerationOptions::default(),
        )
        .expect("empty reference list should be valid");

        assert!(parameters.get("director_reference_images").is_none());
        assert!(parameters.get("reference_image_multiple").is_none());
    }

    #[test]
    fn novelai_v4_reference_images_keep_legacy_vibe_fields() {
        let reference_image =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
        let mut parameters = json!({});

        apply_novelai_reference_images(
            &mut parameters,
            "nai-diffusion-4-full",
            &ImageGenerationOptions {
                reference_images: vec![reference_image.to_string()],
                ..ImageGenerationOptions::default()
            },
        )
        .expect("V4 reference image should be valid");

        assert_eq!(
            parameters["reference_image_multiple"],
            json!([reference_image])
        );
        assert_eq!(
            parameters["reference_information_extracted_multiple"],
            json!([1])
        );
        assert_eq!(parameters["reference_strength_multiple"], json!([0.6]));
        assert!(parameters.get("director_reference_images").is_none());
    }

    #[tokio::test]
    async fn automatic1111_sends_arliai_required_auth_and_model_checkpoint() {
        let (base_url, request_handle) = serve_single_image_response().await;
        let connection = json!({
            "provider": "image_generation",
            "imageGenerationSource": "automatic1111",
            "baseUrl": format!("{base_url}/sdapi/v1/txt2img"),
            "apiKey": "arliai-secret",
            "model": "arliai-image-model",
            "defaultParameters": {
                "imageGeneration": {
                    "service": "automatic1111",
                    "automatic1111": { "steps": 30, "sampler": "DPM++ 2M Karras" },
                    "seed": -1
                }
            }
        });

        let result = generate_automatic1111(
            &connection,
            "A photo of an astronaut riding a horse on the moon",
            1024,
            1024,
            &ImageGenerationOptions {
                negative_prompt: Some("ugly, blurry, low quality".to_string()),
                ..ImageGenerationOptions::default()
            },
        )
        .await
        .expect("ArliAI-compatible SD API response should parse");

        assert_eq!(result.1, "image/png");
        let request = request_handle
            .await
            .expect("test image server should return captured request");
        let lower_request = request.to_ascii_lowercase();
        assert!(request.starts_with("POST /sdapi/v1/txt2img "));
        assert!(lower_request.contains("authorization: bearer arliai-secret"));

        let body = request
            .split_once("\r\n\r\n")
            .map(|(_, body)| body)
            .expect("request should contain a JSON body");
        let payload: Value = serde_json::from_str(body).expect("request body should be JSON");
        assert_eq!(
            payload["prompt"],
            json!("A photo of an astronaut riding a horse on the moon")
        );
        assert_eq!(payload["sd_model_checkpoint"], json!("arliai-image-model"));
        assert_eq!(payload["steps"], json!(30));
        assert_eq!(payload["sampler_name"], json!("DPM++ 2M Karras"));
    }

    #[test]
    fn automatic1111_sdapi_url_accepts_roots_and_endpoint_urls() {
        assert_eq!(
            automatic1111_sdapi_url("https://api.arliai.com", "txt2img"),
            "https://api.arliai.com/sdapi/v1/txt2img"
        );
        assert_eq!(
            automatic1111_sdapi_url("https://api.arliai.com/sdapi/v1", "txt2img"),
            "https://api.arliai.com/sdapi/v1/txt2img"
        );
        assert_eq!(
            automatic1111_sdapi_url("https://api.arliai.com/sdapi/v1/txt2img", "img2img"),
            "https://api.arliai.com/sdapi/v1/img2img"
        );
    }

    #[test]
    fn arliai_and_sdapi_urls_infer_automatic1111_image_source() {
        assert_eq!(
            infer_image_source("", "https://api.arliai.com"),
            "automatic1111"
        );
        assert_eq!(
            infer_image_source("", "https://api.example.test/sdapi/v1/txt2img"),
            "automatic1111"
        );
        assert_eq!(infer_image_source("", "https://notarliai.com"), "openai");
        assert_eq!(infer_image_source("", "https://evilarliai.com"), "openai");
    }
}
