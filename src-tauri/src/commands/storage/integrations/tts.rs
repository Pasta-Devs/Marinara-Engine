use super::super::images::percent_encode_component;
use super::super::shared::*;
use super::super::*;
use marinara_security::redact_sensitive_text;

const TTS_SETTINGS_KEY: &str = "tts";
const TTS_API_KEY_MASK: &str = "\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}\u{2022}";
const MAX_TTS_AUDIO_BYTES: usize = 20 * 1024 * 1024;

const OPENAI_FALLBACK_VOICES: &[&str] = &[
    "alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer",
];

const POCKET_TTS_VOICES: &[&str] = &[
    "alba",
    "anna",
    "azelma",
    "bill_boerst",
    "caro_davy",
    "charles",
    "cosette",
    "eponine",
    "eve",
    "fantine",
    "george",
    "jane",
    "jean",
    "javert",
    "marius",
    "mary",
    "michael",
    "paul",
    "peter_yearsley",
    "stuart_bell",
    "vera",
];

fn provider_error_detail(text: &str, max_chars: usize) -> String {
    redact_sensitive_text(text)
        .chars()
        .take(max_chars)
        .collect()
}

const NANOGPT_ELEVENLABS_VOICES: &[&str] = &[
    "Adam",
    "Alice",
    "Antoni",
    "Aria",
    "Arnold",
    "Bella",
    "Bill",
    "Brian",
    "Callum",
    "Charlie",
    "Charlotte",
    "Chris",
    "Daniel",
    "Domi",
    "Dorothy",
    "Drew",
    "Elli",
    "Emily",
    "Eric",
    "Ethan",
    "Fin",
    "Freya",
    "George",
    "Gigi",
    "Giovanni",
    "Grace",
    "James",
    "Jeremy",
    "Jessica",
    "Joseph",
    "Josh",
    "Laura",
    "Liam",
    "Lily",
    "Matilda",
    "Matthew",
    "Michael",
    "Nicole",
    "Rachel",
    "River",
    "Roger",
    "Ryan",
    "Sam",
    "Sarah",
    "Thomas",
    "Will",
];

pub(crate) async fn tts_call(
    state: &AppState,
    method: &str,
    rest: &[&str],
    body: Value,
) -> AppResult<Value> {
    match (method, rest) {
        ("GET", ["config"]) => get_config(state),
        ("PUT", ["config"]) => put_config(state, body),
        ("GET", ["voices"]) => voices(state).await,
        ("POST", ["speak"]) => speak(state, body).await,
        _ => Err(AppError::new(
            "route_not_found",
            format!("Unknown tts route: {method} /{}", rest.join("/")),
        )),
    }
}

fn default_config() -> Value {
    json!({
        "enabled": false,
        "source": "openai",
        "baseUrl": "https://api.openai.com/v1",
        "apiKey": "",
        "voice": "alloy",
        "model": "tts-1",
        "audioFormat": "mp3",
        "speed": 1.0,
        "elevenLabsStability": 0.5,
        "elevenLabsLanguageCode": "",
        "voiceMode": "single",
        "voiceAssignments": [],
        "npcDefaultVoicesEnabled": false,
        "npcDefaultMaleVoices": [],
        "npcDefaultFemaleVoices": [],
        "autoplayRP": false,
        "autoplayConvo": false,
        "autoplayGame": false,
        "autoplayStreaming": false,
        "dialogueOnly": false,
        "dialogueScope": "all",
        "dialogueCharacterName": ""
    })
}

fn config_with_defaults(mut config: Value) -> Value {
    let defaults = default_config();
    let Some(object) = config.as_object_mut() else {
        return defaults;
    };
    for (key, value) in defaults.as_object().expect("default config is an object") {
        object.entry(key.clone()).or_insert_with(|| value.clone());
    }
    config
}

fn load_config(state: &AppState) -> AppResult<Value> {
    let value = state
        .storage
        .get("app-settings", TTS_SETTINGS_KEY)?
        .and_then(|entry| entry.get("value").cloned().or(Some(entry)))
        .unwrap_or_else(default_config);
    Ok(config_with_defaults(value))
}

fn get_config(state: &AppState) -> AppResult<Value> {
    let mut config = load_config(state)?;
    if config
        .get("apiKey")
        .and_then(Value::as_str)
        .is_some_and(|key| !key.is_empty())
    {
        config["apiKey"] = Value::String(TTS_API_KEY_MASK.to_string());
    }
    Ok(config)
}

fn put_config(state: &AppState, body: Value) -> AppResult<Value> {
    let mut config = config_with_defaults(body);
    if config.get("apiKey").and_then(Value::as_str) == Some(TTS_API_KEY_MASK) {
        let existing = load_config(state)?;
        config["apiKey"] = existing
            .get("apiKey")
            .cloned()
            .unwrap_or_else(|| Value::String(String::new()));
    }
    state
        .storage
        .upsert_with_id("app-settings", TTS_SETTINGS_KEY, json!({ "value": config }))?;
    Ok(Value::Null)
}

async fn voices(state: &AppState) -> AppResult<Value> {
    let config = load_config(state)?;
    let source = config
        .get("source")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    if !config
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return Ok(fallback_voices(source));
    }
    let base = configured_base_url(&config);
    if source == "elevenlabs" && is_nano_gpt_base_url(&base) {
        return Ok(voice_options_response(
            source,
            NANOGPT_ELEVENLABS_VOICES,
            Some("NanoGPT ElevenLabs"),
            true,
        ));
    }
    if source == "elevenlabs" {
        return Ok(elevenlabs_voices(&config, &base)
            .await
            .unwrap_or_else(|error| fallback_voices_with_error(source, &error)));
    }
    if source == "pockettts" {
        return Ok(fallback_voices(source));
    }
    let api_key = config.get("apiKey").and_then(Value::as_str).unwrap_or("");
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| AppError::new("tts_client_error", error.to_string()))?
        .get(openai_voices_url(
            &base,
            config.get("model").and_then(Value::as_str),
        ))
        .headers(openai_headers(api_key)?)
        .send()
        .await;
    match response {
        Ok(response) if response.status().is_success() => {
            let data = match response.json::<Value>().await {
                Ok(data) => data,
                Err(error) => {
                    return Ok(fallback_voices_with_error(
                        source,
                        &AppError::new("tts_response_error", error.to_string()),
                    ));
                }
            };
            let parsed = parse_voice_options(&data);
            if parsed.is_empty() {
                Ok(fallback_voices_with_error(
                    source,
                    &AppError::new("tts_provider_error", "TTS provider returned no voices"),
                ))
            } else {
                Ok(
                    json!({ "voices": parsed.iter().filter_map(|voice| voice.get("id").cloned()).collect::<Vec<_>>(), "voiceOptions": parsed, "fromProvider": true, "fallback": false, "source": source }),
                )
            }
        }
        Ok(response) => {
            let status = response.status();
            let raw_detail = response.text().await.unwrap_or_default();
            let detail = provider_error_detail(&raw_detail, 300);
            Ok(fallback_voices_with_error(
                source,
                &AppError::with_details(
                    "tts_provider_error",
                    format!("TTS provider returned HTTP {status}"),
                    json!({ "detail": detail }),
                ),
            ))
        }
        Err(error) => Ok(fallback_voices_with_error(
            source,
            &AppError::new("tts_provider_unreachable", error.to_string()),
        )),
    }
}

async fn speak(state: &AppState, body: Value) -> AppResult<Value> {
    let text = required_string(&body, "text")?;
    if text.chars().count() > 4096 {
        return Err(AppError::invalid_input("TTS text is too long"));
    }
    let config = load_config(state)?;
    if !config
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return Err(AppError::invalid_input("TTS is not enabled"));
    }
    let source = config
        .get("source")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    let base = configured_base_url(&config);
    let api_key = config.get("apiKey").and_then(Value::as_str).unwrap_or("");
    let configured_voice = config
        .get("voice")
        .and_then(Value::as_str)
        .unwrap_or("alloy");
    let voice = body
        .get("voice")
        .and_then(Value::as_str)
        .filter(|voice| !voice.trim().is_empty())
        .unwrap_or(configured_voice);
    if source == "elevenlabs" && api_key.is_empty() {
        return Err(AppError::invalid_input(
            "ElevenLabs API key is not configured",
        ));
    }
    if source == "elevenlabs" && voice.trim().is_empty() {
        return Err(AppError::invalid_input("ElevenLabs voice is not selected"));
    }

    let model = normalized_model(
        source,
        &base,
        config.get("model").and_then(Value::as_str).unwrap_or(""),
    );
    let speed = config
        .get("speed")
        .and_then(Value::as_f64)
        .unwrap_or(1.0)
        .clamp(0.25, 4.0);
    let tone = body.get("tone").and_then(Value::as_str);
    let speaker = body.get("speaker").and_then(Value::as_str);
    let use_nano_gpt = is_nano_gpt_base_url(&base);
    let audio_format = if source == "elevenlabs" {
        "mp3"
    } else {
        normalized_audio_format(&config)
    };
    let fallback_content_type = audio_format_content_type(audio_format);
    let url = if use_nano_gpt {
        format!("{}/audio/speech", nano_gpt_v1_base_url(&base))
    } else if source == "pockettts" {
        format!("{base}/tts")
    } else if source == "elevenlabs" {
        format!(
            "{}/v1/text-to-speech/{}?output_format=mp3_44100_128",
            elevenlabs_api_root(&base),
            percent_encode_component(voice)
        )
    } else {
        format!("{base}/audio/speech")
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| AppError::new("tts_client_error", error.to_string()))?;
    let provider_text = if source == "elevenlabs" {
        build_elevenlabs_text_input(text, tone)
    } else {
        text.to_string()
    };
    let request = if source == "pockettts" {
        let form = reqwest::multipart::Form::new()
            .text("text", provider_text)
            .text("voice_url", voice.to_string())
            .text("output_format", audio_format.to_string());
        client
            .post(url)
            .headers(optional_bearer_headers(api_key)?)
            .multipart(form)
    } else if source == "elevenlabs" && !use_nano_gpt {
        let language = config
            .get("elevenLabsLanguageCode")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();
        let mut payload = json!({
            "text": provider_text,
            "model_id": model,
            "voice_settings": {
                "stability": config.get("elevenLabsStability").and_then(Value::as_f64).unwrap_or(0.5),
                "speed": speed
            }
        });
        if !language.is_empty() {
            payload["language_code"] = json!(language);
        }
        client
            .post(url)
            .headers(elevenlabs_headers(api_key)?)
            .json(&payload)
    } else {
        let instructions = build_speech_instructions(speaker, tone);
        let mut payload = json!({
            "model": model,
            "input": provider_text,
            "voice": if voice.trim().is_empty() { "alloy" } else { voice },
            "speed": speed,
            "response_format": audio_format
        });
        if let Some(instructions) = instructions {
            payload["instructions"] = json!(instructions);
        }
        let headers = if use_nano_gpt {
            nano_gpt_headers(api_key)?
        } else {
            openai_headers(api_key)?
        };
        client.post(url).headers(headers).json(&payload)
    };

    let response = request
        .send()
        .await
        .map_err(|error| AppError::new("tts_provider_unreachable", error.to_string()))?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or(fallback_content_type)
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| AppError::new("tts_response_error", error.to_string()))?;
    if !status.is_success() {
        let detail = provider_error_detail(&String::from_utf8_lossy(&bytes), 500);
        return Err(AppError::with_details(
            "tts_provider_error",
            format!("TTS provider returned HTTP {status}"),
            json!({ "detail": detail }),
        ));
    }
    if !is_allowed_audio_content_type(&content_type) {
        let detail = provider_error_detail(&String::from_utf8_lossy(&bytes), 500);
        return Err(AppError::with_details(
            "tts_provider_error",
            "TTS provider returned a non-audio response",
            json!({ "contentType": content_type, "detail": detail }),
        ));
    }
    if bytes.len() > MAX_TTS_AUDIO_BYTES {
        return Err(AppError::invalid_input("TTS audio response is too large"));
    }
    Ok(json!({
        "audioBase64": general_purpose::STANDARD.encode(bytes),
        "contentType": if content_type.starts_with("audio/") { content_type } else { fallback_content_type.to_string() }
    }))
}

fn normalized_audio_format(config: &Value) -> &'static str {
    match config
        .get("audioFormat")
        .and_then(Value::as_str)
        .unwrap_or("mp3")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "wav" => "wav",
        _ => "mp3",
    }
}

fn audio_format_content_type(format: &str) -> &'static str {
    match format {
        "wav" => "audio/wav",
        _ => "audio/mpeg",
    }
}

fn configured_base_url(config: &Value) -> String {
    let source = config
        .get("source")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    let configured = config
        .get("baseUrl")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .trim_end_matches('/');
    if !configured.is_empty() {
        return configured.to_string();
    }
    match source {
        "elevenlabs" => "https://api.elevenlabs.io".to_string(),
        "pockettts" => "http://localhost:8000".to_string(),
        _ => "https://api.openai.com/v1".to_string(),
    }
}

/// Builds the OpenAI-compatible voice discovery endpoint.
///
/// Nonblank model values are trimmed and sent as `model` so multi-model
/// providers can return the right catalog. If URL parsing fails, return the
/// raw legacy endpoint and let the provider request fail through the existing
/// fallback path.
fn openai_voices_url(base: &str, model: Option<&str>) -> String {
    let raw_url = format!("{base}/audio/voices");
    let Ok(mut url) = reqwest::Url::parse(&raw_url) else {
        return raw_url;
    };

    if let Some(model) = model.map(str::trim).filter(|value| !value.is_empty()) {
        url.query_pairs_mut().append_pair("model", model);
    }

    url.to_string()
}

fn normalized_model(source: &str, base: &str, configured: &str) -> String {
    let fallback = match source {
        "elevenlabs" => "eleven_multilingual_v2",
        "pockettts" => "pocket-tts",
        _ => "tts-1",
    };
    let model = configured.trim();
    let model = if model.is_empty() { fallback } else { model };
    if is_nano_gpt_base_url(base) {
        match model.to_ascii_lowercase().as_str() {
            "eleven_v3" | "elevenlabs-v3" | "elevenlabs_v3" | "elevenlabs_tts_v3" => {
                "Elevenlabs-V3".to_string()
            }
            "eleven_turbo_v2_5" | "eleven_flash_v2_5" => "Elevenlabs-Turbo-V2.5".to_string(),
            _ => model.to_string(),
        }
    } else if source == "elevenlabs" {
        match model.to_ascii_lowercase().as_str() {
            "tts_v3" | "elevenlabs_v3" | "elevenlabs_tts_v3" => "eleven_v3".to_string(),
            _ => model.to_string(),
        }
    } else {
        model.to_string()
    }
}

fn fallback_voices(source: &str) -> Value {
    match source {
        "elevenlabs" => voice_options_response(source, &[], None, false),
        "pockettts" => {
            voice_options_response(source, POCKET_TTS_VOICES, Some("PocketTTS built-in"), false)
        }
        _ => voice_options_response(source, OPENAI_FALLBACK_VOICES, None, false),
    }
}

fn fallback_voices_with_error(source: &str, error: &AppError) -> Value {
    let mut response = fallback_voices(source);
    response["fallback"] = json!(true);
    response["providerError"] = json!(error.message.clone());
    response["providerErrorCode"] = json!(error.code.clone());
    if let Some(details) = error.details.clone() {
        response["providerErrorDetails"] = details;
    }
    response
}

fn voice_options_response(
    source: &str,
    voices: &[&str],
    category: Option<&str>,
    from_provider: bool,
) -> Value {
    let options = voices
        .iter()
        .map(|voice| {
            let mut item = json!({ "id": voice, "name": voice });
            if let Some(category) = category {
                item["category"] = json!(category);
            }
            item
        })
        .collect::<Vec<_>>();
    json!({
        "voices": voices,
        "voiceOptions": options,
        "fromProvider": from_provider,
        "fallback": !from_provider,
        "source": source
    })
}

async fn elevenlabs_voices(config: &Value, base: &str) -> AppResult<Value> {
    let api_key = config.get("apiKey").and_then(Value::as_str).unwrap_or("");
    if api_key.is_empty() {
        return Ok(fallback_voices("elevenlabs"));
    }
    let url = format!(
        "{}/v2/voices?page_size=100&include_total_count=false",
        elevenlabs_api_root(base)
    );
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| AppError::new("tts_client_error", error.to_string()))?
        .get(url)
        .headers(elevenlabs_headers(api_key)?)
        .send()
        .await
        .map_err(|error| AppError::new("tts_provider_unreachable", error.to_string()))?;
    if !response.status().is_success() {
        let status = response.status();
        let raw_detail = response.text().await.unwrap_or_default();
        let detail = provider_error_detail(&raw_detail, 300);
        return Err(AppError::with_details(
            "tts_provider_error",
            format!("TTS provider returned HTTP {status}"),
            json!({ "detail": detail }),
        ));
    }
    let data = response
        .json::<Value>()
        .await
        .map_err(|error| AppError::new("tts_response_error", error.to_string()))?;
    let parsed = parse_voice_options(&data);
    if parsed.is_empty() {
        Err(AppError::new(
            "tts_provider_error",
            "TTS provider returned no voices",
        ))
    } else {
        Ok(
            json!({ "voices": parsed.iter().filter_map(|voice| voice.get("id").cloned()).collect::<Vec<_>>(), "voiceOptions": parsed, "fromProvider": true, "fallback": false, "source": "elevenlabs" }),
        )
    }
}

fn parse_voice_options(data: &Value) -> Vec<Value> {
    let list = data
        .as_array()
        .cloned()
        .or_else(|| data.get("voices").and_then(Value::as_array).cloned())
        .or_else(|| data.get("data").and_then(Value::as_array).cloned())
        .unwrap_or_default();
    list.into_iter()
        .filter_map(|item| {
            if let Some(raw) = item.as_str().filter(|value| !value.trim().is_empty()) {
                return Some(json!({ "id": raw, "name": raw }));
            }
            let id = item
                .get("voice_id")
                .or_else(|| item.get("voiceId"))
                .or_else(|| item.get("id"))
                .or_else(|| item.get("name"))
                .and_then(Value::as_str)?
                .to_string();
            let name = item.get("name").and_then(Value::as_str).unwrap_or(&id).to_string();
            Some(json!({
                "id": id,
                "name": name,
                "description": item.get("description").cloned().unwrap_or(Value::Null),
                "previewUrl": item.get("preview_url").or_else(|| item.get("previewUrl")).cloned().unwrap_or(Value::Null),
                "category": item.get("category").cloned().unwrap_or(Value::Null),
                "labels": item.get("labels").cloned().unwrap_or(Value::Null)
            }))
        })
        .collect()
}

fn elevenlabs_api_root(base: &str) -> String {
    strip_version_suffix(base)
}

fn nano_gpt_v1_base_url(base: &str) -> String {
    let root = strip_version_suffix(base);
    if root.ends_with("/v1") {
        root
    } else {
        format!("{root}/v1")
    }
}

fn strip_version_suffix(base: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    let lower = trimmed.to_ascii_lowercase();
    if lower.ends_with("/v1") || lower.ends_with("/v2") || lower.ends_with("/v3") {
        trimmed
            .rsplit_once('/')
            .map(|(root, _)| root.to_string())
            .unwrap_or_else(|| trimmed.to_string())
    } else {
        trimmed.to_string()
    }
}

fn is_nano_gpt_base_url(base: &str) -> bool {
    base.to_ascii_lowercase().contains("nano-gpt.com")
}

fn build_speech_instructions(speaker: Option<&str>, tone: Option<&str>) -> Option<String> {
    let mut parts = Vec::new();
    if let Some(speaker) = speaker.map(str::trim).filter(|value| !value.is_empty()) {
        parts.push(format!("Voice the line as {speaker}."));
    }
    if let Some(tone) = tone.map(str::trim).filter(|value| !value.is_empty()) {
        let article = if tone
            .chars()
            .next()
            .is_some_and(|ch| "aeiouAEIOU".contains(ch))
        {
            "an"
        } else {
            "a"
        };
        parts.push(format!("Use {article} {tone} tone."));
    }
    if parts.is_empty() {
        None
    } else {
        parts.push(
            "Do not read speaker names, brackets, markup, or stage directions aloud.".to_string(),
        );
        Some(parts.join(" "))
    }
}

fn build_elevenlabs_text_input(text: &str, tone: Option<&str>) -> String {
    let tags = tone
        .unwrap_or("")
        .split(',')
        .filter_map(|part| {
            let tag = part
                .trim()
                .trim_matches(|ch| matches!(ch, '[' | ']' | '"' | '\''))
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            if tag.is_empty() || tag.contains('<') || tag.contains('>') {
                return None;
            }
            let normalized = tag.to_ascii_lowercase();
            if matches!(
                normalized.as_str(),
                "main" | "side" | "extra" | "action" | "thought"
            ) || normalized.starts_with("whisper")
            {
                return None;
            }
            Some(format!("[{tag}]"))
        })
        .collect::<Vec<_>>();
    if tags.is_empty() {
        text.to_string()
    } else {
        format!("{} {text}", tags.join(" "))
    }
}

fn is_allowed_audio_content_type(content_type: &str) -> bool {
    let normalized = content_type.to_ascii_lowercase();
    normalized.contains("audio/") || normalized.contains("application/octet-stream")
}

fn openai_headers(api_key: &str) -> AppResult<reqwest::header::HeaderMap> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );
    if !api_key.trim().is_empty() {
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
                .map_err(|error| AppError::invalid_input(error.to_string()))?,
        );
    }
    Ok(headers)
}

fn elevenlabs_headers(api_key: &str) -> AppResult<reqwest::header::HeaderMap> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );
    if !api_key.trim().is_empty() {
        headers.insert(
            "xi-api-key",
            reqwest::header::HeaderValue::from_str(api_key.trim())
                .map_err(|error| AppError::invalid_input(error.to_string()))?,
        );
    }
    Ok(headers)
}

fn nano_gpt_headers(api_key: &str) -> AppResult<reqwest::header::HeaderMap> {
    let mut headers = openai_headers(api_key)?;
    if !api_key.trim().is_empty() {
        headers.insert(
            "x-api-key",
            reqwest::header::HeaderValue::from_str(api_key.trim())
                .map_err(|error| AppError::invalid_input(error.to_string()))?,
        );
    }
    Ok(headers)
}

fn optional_bearer_headers(api_key: &str) -> AppResult<reqwest::header::HeaderMap> {
    let mut headers = reqwest::header::HeaderMap::new();
    if !api_key.trim().is_empty() {
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&format!("Bearer {}", api_key.trim()))
                .map_err(|error| AppError::invalid_input(error.to_string()))?,
        );
    }
    Ok(headers)
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
        let path = std::env::temp_dir().join(format!("marinara-tts-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp TTS dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    async fn serve_model_gated_voices(expected_model: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test voice server should bind");
        let address = listener
            .local_addr()
            .expect("test voice server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test voice server should accept one request");
            let mut buffer = [0_u8; 2048];
            let bytes = stream
                .read(&mut buffer)
                .await
                .expect("test voice server should read request");
            let request = String::from_utf8_lossy(&buffer[..bytes]);
            let path = request.lines().next().unwrap_or_default();
            let encoded_model = expected_model.replace('/', "%2F");
            let has_model = path.contains(&format!("model={encoded_model}"));
            let (status, body) = if has_model {
                ("200 OK", r#"{"voices":["af_heart"]}"#)
            } else {
                ("400 Bad Request", r#"{"error":"missing model"}"#)
            };
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test voice server should write response");
        });
        format!("http://{address}/v1")
    }

    async fn serve_voice_failure(status: &'static str, body: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test voice server should bind");
        let address = listener
            .local_addr()
            .expect("test voice server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test voice server should accept one request");
            let mut buffer = [0_u8; 2048];
            let _ = stream
                .read(&mut buffer)
                .await
                .expect("test voice server should read request");
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream
                .write_all(response.as_bytes())
                .await
                .expect("test voice server should write response");
        });
        format!("http://{address}/v1")
    }

    async fn serve_pockettts_audio() -> String {
        const WAV_BYTES: &[u8] = &[
            82, 73, 70, 70, 38, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32, 16, 0, 0, 0, 1, 0, 1,
            0, 64, 31, 0, 0, 64, 31, 0, 0, 1, 0, 8, 0, 100, 97, 116, 97, 2, 0, 0, 0, 128, 128,
        ];

        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test TTS server should bind");
        let address = listener
            .local_addr()
            .expect("test TTS server address should be readable");
        tokio::spawn(async move {
            let (mut stream, _) = listener
                .accept()
                .await
                .expect("test TTS server should accept one request");
            let mut buffer = [0_u8; 8192];
            let bytes = stream
                .read(&mut buffer)
                .await
                .expect("test TTS server should read request");
            let request = String::from_utf8_lossy(&buffer[..bytes]);
            assert!(request.starts_with("POST /tts "));
            assert!(request.contains("name=\"text\""));
            assert!(request.contains("name=\"voice_url\""));

            let header = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: audio/wav\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                WAV_BYTES.len()
            );
            stream
                .write_all(header.as_bytes())
                .await
                .expect("test TTS server should write response header");
            stream
                .write_all(WAV_BYTES)
                .await
                .expect("test TTS server should write response body");
        });
        format!("http://{address}")
    }

    #[tokio::test]
    async fn openai_compatible_voice_lookup_passes_configured_model() {
        let state = test_state("openai-voices-model");
        let model = "mlx-community/Kokoro-82M-bf16";
        let base_url = serve_model_gated_voices(model).await;
        state
            .storage
            .upsert_with_id(
                "app-settings",
                TTS_SETTINGS_KEY,
                json!({
                    "value": {
                        "enabled": true,
                        "source": "openai",
                        "baseUrl": base_url,
                        "apiKey": "",
                        "model": model
                    }
                }),
            )
            .expect("TTS settings should be stored");

        let result = voices(&state).await.expect("voice lookup should complete");

        assert_eq!(result["fromProvider"], true);
        assert_eq!(result["fallback"], false);
        assert!(result.get("providerError").is_none());
        assert_eq!(result["voices"], json!(["af_heart"]));
    }

    #[tokio::test]
    async fn openai_voice_lookup_marks_fallback_when_provider_fails() {
        let state = test_state("openai-voices-provider-error");
        let base_url =
            serve_voice_failure("401 Unauthorized", r#"{"error":"bad key sk-test-secret"}"#).await;
        state
            .storage
            .upsert_with_id(
                "app-settings",
                TTS_SETTINGS_KEY,
                json!({
                    "value": {
                        "enabled": true,
                        "source": "openai",
                        "baseUrl": base_url,
                        "apiKey": "bad-key",
                        "model": "tts-1"
                    }
                }),
            )
            .expect("TTS settings should be stored");

        let result = voices(&state)
            .await
            .expect("voice lookup should return fallback metadata");

        assert_eq!(result["fromProvider"], false);
        assert_eq!(result["fallback"], true);
        assert!(result["providerError"]
            .as_str()
            .is_some_and(|message| message.contains("TTS provider returned HTTP")));
        assert!(!result.to_string().contains("sk-test-secret"));
        assert_eq!(result["voices"], json!(OPENAI_FALLBACK_VOICES));
    }

    #[tokio::test]
    async fn disabled_voice_lookup_uses_fallback_without_provider_error() {
        let state = test_state("openai-voices-disabled");
        state
            .storage
            .upsert_with_id(
                "app-settings",
                TTS_SETTINGS_KEY,
                json!({
                    "value": {
                        "enabled": false,
                        "source": "openai",
                        "apiKey": "bad-key",
                        "model": "tts-1"
                    }
                }),
            )
            .expect("TTS settings should be stored");

        let result = voices(&state)
            .await
            .expect("disabled voice lookup should use fallback");

        assert_eq!(result["fromProvider"], false);
        assert_eq!(result["fallback"], true);
        assert!(result.get("providerError").is_none());
        assert_eq!(result["voices"], json!(OPENAI_FALLBACK_VOICES));
    }

    #[tokio::test]
    async fn pockettts_speak_returns_provider_audio() {
        let state = test_state("pockettts-speak");
        let base_url = serve_pockettts_audio().await;
        state
            .storage
            .upsert_with_id(
                "app-settings",
                TTS_SETTINGS_KEY,
                json!({
                    "value": {
                        "enabled": true,
                        "source": "pockettts",
                        "baseUrl": base_url,
                        "voice": "alba"
                    }
                }),
            )
            .expect("TTS settings should be stored");

        let result = speak(&state, json!({ "text": "Hello from streaming TTS." }))
            .await
            .expect("TTS speak should return provider audio");

        assert_eq!(result["contentType"], "audio/wav");
        assert!(result["audioBase64"]
            .as_str()
            .is_some_and(|audio| !audio.is_empty()));
    }

    #[test]
    fn openai_voices_url_encodes_configured_model() {
        assert_eq!(
            openai_voices_url(
                "http://127.0.0.1:8081/v1",
                Some(" mlx-community/Kokoro-82M-bf16 ")
            ),
            "http://127.0.0.1:8081/v1/audio/voices?model=mlx-community%2FKokoro-82M-bf16"
        );
    }

    #[test]
    fn openai_voices_url_omits_blank_model() {
        assert_eq!(
            openai_voices_url("http://127.0.0.1:8081/v1", Some("  ")),
            "http://127.0.0.1:8081/v1/audio/voices"
        );
    }
}
