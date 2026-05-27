use super::shared::*;
use super::*;

#[path = "images/providers.rs"]
mod providers;

pub(crate) use providers::{
    connection_base_url as image_connection_base_url, generate_image_with_connection,
    generate_image_with_options, image_model as image_generation_model,
    image_source as image_generation_source,
    is_openai_gpt_image_model, ImageGenerationOptions,
};

pub(crate) fn avatar_generation_prompt_id(name: &str) -> String {
    let slug: String = name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    format!("avatar-{}", slug.trim_matches('-'))
}

pub(crate) fn avatar_generation_prompt(body: &Value) -> String {
    let name = body
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Character");
    let appearance = body
        .get("appearance")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("distinctive character portrait");
    format!(
        "Portrait avatar of {name}. {appearance}. Centered bust portrait, expressive face, clean background, high detail, polished character art."
    )
}

pub(crate) fn image_dimension(body: &Value, key: &str, fallback: u64) -> u64 {
    body.get(key)
        .and_then(Value::as_u64)
        .filter(|value| (128..=2048).contains(value))
        .unwrap_or(fallback)
}

pub(crate) fn avatar_generation_preview(_state: &AppState, body: Value) -> AppResult<Value> {
    let name = body
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Character");
    let prompt = avatar_generation_prompt(&body);
    Ok(json!({
        "items": [{
            "id": avatar_generation_prompt_id(name),
            "kind": "avatar",
            "title": format!("Avatar: {}", name.trim().if_empty("Character")),
            "prompt": prompt,
            "width": image_dimension(&body, "width", 768),
            "height": image_dimension(&body, "height", 1024)
        }]
    }))
}

trait EmptyFallback {
    fn if_empty<'a>(&'a self, fallback: &'a str) -> &'a str;
}

impl EmptyFallback for str {
    fn if_empty<'a>(&'a self, fallback: &'a str) -> &'a str {
        if self.is_empty() {
            fallback
        } else {
            self
        }
    }
}

pub(crate) fn prompt_override(body: &Value, id: &str) -> Option<String> {
    body.get("promptOverrides")
        .and_then(Value::as_array)
        .and_then(|items| {
            items.iter().find_map(|item| {
                let item_id = item.get("id").and_then(Value::as_str)?;
                let prompt = item.get("prompt").and_then(Value::as_str)?.trim();
                if item_id == id && !prompt.is_empty() {
                    Some(prompt.to_string())
                } else {
                    None
                }
            })
        })
}

pub(crate) fn image_generation_options(body: &Value) -> ImageGenerationOptions {
    let negative_prompt = body
        .get("negativePrompt")
        .or_else(|| body.get("negative_prompt"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let mut reference_images = Vec::new();
    if let Some(value) = body.get("referenceImage").and_then(Value::as_str) {
        if !value.trim().is_empty() {
            reference_images.push(value.trim().to_string());
        }
    }
    if let Some(items) = body.get("referenceImages").and_then(Value::as_array) {
        reference_images.extend(
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string),
        );
    }
    ImageGenerationOptions {
        negative_prompt,
        reference_images,
        transparent_background: body
            .get("transparentBackground")
            .or_else(|| body.get("transparent_background"))
            .or_else(|| body.get("nativeTransparentPng"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
    }
}

pub(crate) fn percent_encode_component(value: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char)
            }
            _ => {
                encoded.push('%');
                encoded.push(HEX[(byte >> 4) as usize] as char);
                encoded.push(HEX[(byte & 0x0f) as usize] as char);
            }
        }
    }
    encoded
}

pub(crate) async fn avatar_generation(state: &AppState, body: Value) -> AppResult<Value> {
    let connection_id = required_string(&body, "connectionId")?;
    let connection = get_required(state, "connections", connection_id)?;
    if connection.get("provider").and_then(Value::as_str) != Some("image_generation") {
        return Err(AppError::invalid_input(
            "Selected connection is not an image-generation connection",
        ));
    }
    let name = body
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Character");
    let prompt_id = avatar_generation_prompt_id(name);
    let prompt =
        prompt_override(&body, &prompt_id).unwrap_or_else(|| avatar_generation_prompt(&body));
    let width = image_dimension(&body, "width", 768);
    let height = image_dimension(&body, "height", 1024);
    let (base64, mime_type) = generate_image_with_options(
        &connection,
        &prompt,
        width,
        height,
        image_generation_options(&body),
    )
    .await?;
    Ok(json!({
        "image": format!("data:{mime_type};base64,{base64}"),
        "prompt": prompt
    }))
}

pub(crate) async fn generate_image(state: &AppState, body: Value) -> AppResult<Value> {
    let connection_id = required_string(&body, "connectionId")?;
    let prompt = required_string(&body, "prompt")?;
    let width = image_dimension(&body, "width", 1024);
    let height = image_dimension(&body, "height", 1024);
    let connection = get_required(state, "connections", connection_id)?;
    let provider = image_generation_source(&connection);
    let model = image_generation_model(&connection, &provider);
    let (base64, mime_type) = generate_image_with_options(
        &connection,
        prompt,
        width,
        height,
        image_generation_options(&body),
    )
    .await?;
    Ok(json!({
        "base64": base64,
        "mimeType": mime_type,
        "image": format!("data:{mime_type};base64,{base64}"),
        "provider": provider,
        "model": model
    }))
}

pub(crate) async fn test_image_generation(state: &AppState, id: &str) -> AppResult<Value> {
    let connection = get_required(state, "connections", id)?;
    if connection.get("provider").and_then(Value::as_str) != Some("image_generation") {
        return Err(AppError::invalid_input(
            "Not an image-generation connection",
        ));
    }
    let prompt = "plate of spaghetti with marinara sauce";
    let start = now_millis();
    match generate_image_with_connection(&connection, prompt, 512, 512).await {
        Ok((base64, mime_type)) => Ok(json!({
            "success": true,
            "base64": base64,
            "mimeType": mime_type,
            "latencyMs": now_millis() - start,
            "prompt": prompt
        })),
        Err(error) => Ok(json!({
            "success": false,
            "base64": Value::Null,
            "mimeType": Value::Null,
            "latencyMs": now_millis() - start,
            "prompt": prompt,
            "error": error.message
        })),
    }
}
