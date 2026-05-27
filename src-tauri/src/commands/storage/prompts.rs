use super::shared::*;
use super::*;
use marinara_security::is_allowed_outbound_url;

pub(crate) struct EmbeddingTarget {
    pub(crate) connection: Value,
    pub(crate) connection_id: String,
    pub(crate) model: String,
}

pub(crate) async fn vectorize_lorebook(
    state: &AppState,
    lorebook_id: &str,
    body: Value,
) -> AppResult<Value> {
    let connection_id = required_string(&body, "connectionId")?;
    let mut connection = get_required(state, "connections", connection_id)?;
    let model = body
        .get("model")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .or_else(|| connection.get("embeddingModel").and_then(Value::as_str))
        .ok_or_else(|| AppError::invalid_input("Embedding model is required"))?
        .to_string();
    if let Some(object) = connection.as_object_mut() {
        object.insert("model".to_string(), Value::String(model.clone()));
    }
    let only_missing = body
        .get("onlyMissing")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let entries =
        match list_collection(state, "lorebook-entries", Some(("lorebookId", lorebook_id)))? {
            Value::Array(rows) => rows,
            _ => Vec::new(),
        };
    let total = entries
        .iter()
        .filter(|entry| {
            !entry
                .get("excludeFromVectorization")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .count();
    let mut vectorized = 0usize;
    let mut skipped = 0usize;
    for entry in entries {
        if entry
            .get("excludeFromVectorization")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            skipped += 1;
            continue;
        }
        if only_missing
            && entry
                .get("embedding")
                .and_then(Value::as_array)
                .is_some_and(|embedding| !embedding.is_empty())
        {
            skipped += 1;
            continue;
        }
        let Some(entry_id) = entry.get("id").and_then(Value::as_str) else {
            skipped += 1;
            continue;
        };
        let text = lorebook_entry_embedding_text(&entry);
        if text.trim().is_empty() {
            skipped += 1;
            continue;
        }
        let embedding = embed_text(&connection, &model, &text).await?;
        state.storage.patch(
            "lorebook-entries",
            entry_id,
            json!({
                "embedding": embedding,
                "embeddingModel": model,
                "embeddingConnectionId": connection_id,
                "embeddingUpdatedAt": now_iso()
            }),
        )?;
        vectorized += 1;
    }
    Ok(json!({
        "success": true,
        "lorebookId": lorebook_id,
        "model": model,
        "total": total,
        "vectorized": vectorized,
        "skipped": skipped
    }))
}

pub(crate) fn value_string_array(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(Value::as_str)
            .map(ToOwned::to_owned)
            .collect(),
        Some(Value::String(raw)) => serde_json::from_str::<Vec<String>>(raw).unwrap_or_else(|_| {
            raw.split(',')
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(ToOwned::to_owned)
                .collect()
        }),
        _ => Vec::new(),
    }
}

fn lorebook_entry_embedding_text(entry: &Value) -> String {
    let keys = value_string_array(entry.get("keys")).join(", ");
    [
        entry.get("name").and_then(Value::as_str).unwrap_or(""),
        keys.as_str(),
        entry
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or(""),
        entry.get("content").and_then(Value::as_str).unwrap_or(""),
    ]
    .into_iter()
    .filter(|part| !part.trim().is_empty())
    .collect::<Vec<_>>()
    .join("\n")
}

pub(crate) fn resolve_embedding_target(
    state: &AppState,
    active_connection: &Value,
) -> AppResult<Option<EmbeddingTarget>> {
    let active_connection_id = active_connection
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    let embedding_connection_id = active_connection
        .get("embeddingConnectionId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let mut embedding_connection = match embedding_connection_id {
        Some(id) => get_required(state, "connections", id)?,
        None => active_connection.clone(),
    };
    let embedding_model = embedding_connection
        .get("embeddingModel")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            active_connection
                .get("embeddingModel")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .map(str::to_string);
    let Some(model) = embedding_model else {
        return Ok(None);
    };
    let connection_id = embedding_connection
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or(active_connection_id);
    if let Some(object) = embedding_connection.as_object_mut() {
        object.insert("model".to_string(), Value::String(model.clone()));
    }
    Ok(Some(EmbeddingTarget {
        connection: embedding_connection,
        connection_id,
        model,
    }))
}

pub(crate) fn resolve_embedding_target_for_chat(
    state: &AppState,
    chat: &Value,
    active_connection: &Value,
) -> AppResult<Option<EmbeddingTarget>> {
    let mut connection = active_connection.clone();
    let metadata = metadata_map(chat);
    if let Some(embedding_connection_id) = metadata
        .get("embeddingConnectionId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if let Some(object) = connection.as_object_mut() {
            object.insert(
                "embeddingConnectionId".to_string(),
                Value::String(embedding_connection_id.to_string()),
            );
        }
    }
    resolve_embedding_target(state, &connection)
}

pub(crate) async fn embed_texts(
    connection: &Value,
    model: &str,
    texts: &[String],
) -> AppResult<Vec<Vec<f64>>> {
    let mut embeddings = Vec::with_capacity(texts.len());
    for text in texts {
        embeddings.push(embed_text(connection, model, text).await?);
    }
    Ok(embeddings)
}

pub(crate) async fn embed_text(connection: &Value, model: &str, text: &str) -> AppResult<Vec<f64>> {
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    match provider {
        "google" | "google_vertex" => embed_google(connection, model, text).await,
        "ollama" => embed_ollama(connection, model, text).await,
        _ => embed_openai_compatible(connection, model, text).await,
    }
}

async fn embed_openai_compatible(
    connection: &Value,
    model: &str,
    text: &str,
) -> AppResult<Vec<f64>> {
    let base = embedding_base_url(connection, "https://api.openai.com/v1");
    let url = format!("{base}/embeddings");
    ensure_embedding_url_allowed(&url)?;
    let mut request = reqwest::Client::new()
        .post(url)
        .json(&json!({ "model": model, "input": text }));
    if let Some(api_key) = connection
        .get("apiKey")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        request = request.bearer_auth(api_key.trim());
    }
    let response = request
        .send()
        .await
        .map_err(|error| AppError::new("embedding_network_error", error.to_string()))?;
    parse_embedding_response(response, |json| {
        json.get("data")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("embedding"))
            .and_then(json_embedding_array)
    })
    .await
}

async fn embed_google(connection: &Value, model: &str, text: &str) -> AppResult<Vec<f64>> {
    let api_key = connection
        .get("apiKey")
        .and_then(Value::as_str)
        .unwrap_or("");
    let base = embedding_base_url(connection, "https://generativelanguage.googleapis.com");
    let url = format!("{base}/v1beta/models/{model}:embedContent?key={api_key}");
    ensure_embedding_url_allowed(&url)?;
    let response = reqwest::Client::new()
        .post(url)
        .json(&json!({ "content": { "parts": [{ "text": text }] } }))
        .send()
        .await
        .map_err(|error| AppError::new("embedding_network_error", error.to_string()))?;
    parse_embedding_response(response, |json| {
        json.get("embedding")
            .and_then(|embedding| embedding.get("values"))
            .and_then(json_embedding_array)
    })
    .await
}

async fn embed_ollama(connection: &Value, model: &str, text: &str) -> AppResult<Vec<f64>> {
    let base = embedding_base_url(connection, "http://127.0.0.1:11434");
    let url = format!("{base}/api/embeddings");
    ensure_embedding_url_allowed(&url)?;
    let response = reqwest::Client::new()
        .post(url)
        .json(&json!({ "model": model, "prompt": text }))
        .send()
        .await
        .map_err(|error| AppError::new("embedding_network_error", error.to_string()))?;
    parse_embedding_response(response, |json| {
        json.get("embedding").and_then(json_embedding_array)
    })
    .await
}

async fn parse_embedding_response<F>(
    response: reqwest::Response,
    extractor: F,
) -> AppResult<Vec<f64>>
where
    F: Fn(&Value) -> Option<Vec<f64>>,
{
    let status = response.status();
    let json: Value = response
        .json()
        .await
        .map_err(|error| AppError::new("embedding_response_error", error.to_string()))?;
    if !status.is_success() {
        return Err(AppError::with_details(
            "embedding_provider_error",
            format!("Embedding provider returned HTTP {status}"),
            json,
        ));
    }
    extractor(&json)
        .filter(|embedding| !embedding.is_empty())
        .ok_or_else(|| {
            AppError::with_details(
                "embedding_response_error",
                "Embedding response did not contain a numeric embedding",
                json,
            )
        })
}

fn json_embedding_array(value: &Value) -> Option<Vec<f64>> {
    Some(
        value
            .as_array()?
            .iter()
            .filter_map(Value::as_f64)
            .collect::<Vec<_>>(),
    )
}

fn embedding_base_url(connection: &Value, fallback: &str) -> String {
    connection
        .get("embeddingBaseUrl")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            connection
                .get("baseUrl")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or(fallback)
        .trim_end_matches('/')
        .to_string()
}

fn ensure_embedding_url_allowed(url: &str) -> AppResult<()> {
    if is_allowed_outbound_url(url, true) {
        Ok(())
    } else {
        Err(AppError::invalid_input(format!(
            "Outbound embedding URL is not allowed: {url}"
        )))
    }
}
