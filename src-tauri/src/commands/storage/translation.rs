use super::images::percent_encode_component;
use super::llm::llm_connection_from_value;
use super::shared::*;
use super::*;

pub(crate) async fn translate_text(state: &AppState, body: Value) -> AppResult<Value> {
    let text = required_string(&body, "text")?;
    let provider = body
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("google");
    let target_language = body
        .get("targetLanguage")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("en");
    let translated = match provider {
        "ai" => translate_with_ai(state, text, target_language, &body).await?,
        "deeplx" => translate_with_deeplx(text, target_language, &body).await?,
        "deepl" => translate_with_deepl(text, target_language, &body).await?,
        "google" => translate_with_google(text, target_language).await?,
        _ => translate_with_google(text, target_language).await?,
    };
    Ok(json!({ "translatedText": translated }))
}

async fn translate_with_ai(
    state: &AppState,
    text: &str,
    target_language: &str,
    body: &Value,
) -> AppResult<String> {
    let connection_id = required_string(body, "connectionId")?;
    let connection = connection_secrets::connection_for_runtime(state, connection_id)?;
    let request = marinara_llm::LlmRequest {
        connection: llm_connection_from_value(&connection)?,
        messages: vec![
            marinara_llm::LlmMessage {
                role: "system".to_string(),
                content: "You are a translator. Translate accurately, preserving markdown, formatting, names, and action asterisks. Output only the translated text.".to_string(),
                name: None,
                images: Vec::new(),
                tool_call_id: None,
                tool_calls: None,
            },
            marinara_llm::LlmMessage {
                role: "user".to_string(),
                content: format!("Translate the following text to {target_language}:\n\n{text}"),
                name: None,
                images: Vec::new(),
                tool_call_id: None,
                tool_calls: None,
            },
        ],
        parameters: json!({ "temperature": 0.3 }),
        tools: Vec::new(),
    };
    marinara_llm::complete(request)
        .await
        .map(|value| value.trim().to_string())
}

async fn translate_with_deeplx(
    text: &str,
    target_language: &str,
    body: &Value,
) -> AppResult<String> {
    let base_url = required_string(body, "deeplxUrl")?.trim_end_matches('/');
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| AppError::new("translation_client_error", error.to_string()))?
        .post(format!("{base_url}/translate"))
        .json(&json!({
            "text": text,
            "source_lang": "auto",
            "target_lang": target_language.to_ascii_uppercase()
        }))
        .send()
        .await
        .map_err(|error| AppError::new("translation_failed", error.to_string()))?;
    if !response.status().is_success() {
        return Err(AppError::new(
            "translation_failed",
            format!("DeepLX returned {}", response.status()),
        ));
    }
    let data = response
        .json::<Value>()
        .await
        .map_err(|error| AppError::new("translation_failed", error.to_string()))?;
    Ok(data
        .get("data")
        .or_else(|| {
            data.get("alternatives")
                .and_then(|value| value.as_array())
                .and_then(|items| items.first())
        })
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string())
}

async fn translate_with_deepl(
    text: &str,
    target_language: &str,
    body: &Value,
) -> AppResult<String> {
    let api_key = required_string(body, "deeplApiKey")?;
    let endpoint = if api_key.ends_with(":fx") {
        "https://api-free.deepl.com/v2/translate"
    } else {
        "https://api.deepl.com/v2/translate"
    };
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| AppError::new("translation_client_error", error.to_string()))?
        .post(endpoint)
        .header(
            reqwest::header::AUTHORIZATION,
            format!("DeepL-Auth-Key {api_key}"),
        )
        .json(&json!({
            "text": [text],
            "target_lang": target_language.to_ascii_uppercase()
        }))
        .send()
        .await
        .map_err(|error| AppError::new("translation_failed", error.to_string()))?;
    if !response.status().is_success() {
        return Err(AppError::new(
            "translation_failed",
            format!("DeepL returned {}", response.status()),
        ));
    }
    let data = response
        .json::<Value>()
        .await
        .map_err(|error| AppError::new("translation_failed", error.to_string()))?;
    Ok(data
        .get("translations")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(|item| item.get("text"))
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string())
}

async fn translate_with_google(text: &str, target_language: &str) -> AppResult<String> {
    if text.len() > 5000 {
        return Err(AppError::invalid_input(
            "Text too long for Google Translate. Use DeepL or AI translation for longer text.",
        ));
    }
    let url = format!(
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={}&dt=t&q={}",
        percent_encode_component(target_language),
        percent_encode_component(text)
    );
    let data = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| AppError::new("translation_client_error", error.to_string()))?
        .get(url)
        .send()
        .await
        .map_err(|error| AppError::new("translation_failed", error.to_string()))?;
    if !data.status().is_success() {
        return Err(AppError::new(
            "translation_failed",
            format!("Google Translate returned {}", data.status()),
        ));
    }
    let data = data
        .json::<Value>()
        .await
        .map_err(|error| AppError::new("translation_failed", error.to_string()))?;
    let mut translated = String::new();
    if let Some(segments) = data.get(0).and_then(Value::as_array) {
        for segment in segments {
            if let Some(text) = segment.get(0).and_then(Value::as_str) {
                translated.push_str(text);
            }
        }
    }
    Ok(translated)
}
