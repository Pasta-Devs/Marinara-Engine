use super::shared::*;
use super::*;
use marinara_security::is_allowed_outbound_url;

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
    if lorebook_excludes_vectorization(state.storage.get("lorebooks", lorebook_id)?.as_ref()) {
        let skipped = entries.len();
        return Ok(json!({
            "success": true,
            "lorebookId": lorebook_id,
            "model": model,
            "total": skipped,
            "vectorized": 0,
            "skipped": skipped
        }));
    }
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

fn lorebook_excludes_vectorization(lorebook: Option<&Value>) -> bool {
    lorebook
        .and_then(|book| book.get("excludeFromVectorization"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn lorebook_entry_embedding_text(entry: &Value) -> String {
    let keys = value_string_array(entry.get("keys"))
        .into_iter()
        .chain(value_string_array(entry.get("secondaryKeys")))
        .collect::<Vec<_>>()
        .join(", ");
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

async fn embed_text(connection: &Value, model: &str, text: &str) -> AppResult<Vec<f64>> {
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
        .get("baseUrl")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempRoot(PathBuf);

    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn temp_state(label: &str) -> (TempRoot, AppState) {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after unix epoch")
            .as_nanos();
        let root = TempRoot(
            std::env::temp_dir().join(format!("marinara-lorebook-vectorize-{label}-{nonce}")),
        );
        let state = AppState::from_data_dir(&root.0, Vec::new()).expect("state should initialize");
        (root, state)
    }

    #[test]
    fn lorebook_excludes_vectorization_only_for_boolean_true() {
        assert!(lorebook_excludes_vectorization(Some(&json!({
            "excludeFromVectorization": true
        }))));
        assert!(!lorebook_excludes_vectorization(Some(&json!({
            "excludeFromVectorization": false
        }))));
        assert!(!lorebook_excludes_vectorization(Some(&json!({
            "excludeFromVectorization": "true"
        }))));
        assert!(!lorebook_excludes_vectorization(None));
    }

    #[tokio::test]
    async fn vectorize_lorebook_skips_lorebook_level_exclusion_without_provider_call() {
        let (_root, state) = temp_state("excluded-book");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "connection-1",
                    "provider": "openai",
                    "embeddingModel": "text-embedding-test"
                }),
            )
            .expect("connection should be stored");
        state
            .storage
            .create(
                "lorebooks",
                json!({
                    "id": "lorebook-1",
                    "name": "Excluded book",
                    "excludeFromVectorization": true
                }),
            )
            .expect("lorebook should be stored");
        state
            .storage
            .create(
                "lorebook-entries",
                json!({
                    "id": "entry-1",
                    "lorebookId": "lorebook-1",
                    "name": "Entry that would call the provider",
                    "keys": ["dragon"],
                    "secondaryKeys": ["wyrm"],
                    "content": "Provider calls must be skipped."
                }),
            )
            .expect("entry should be stored");

        let result = vectorize_lorebook(
            &state,
            "lorebook-1",
            json!({
                "connectionId": "connection-1",
                "model": "text-embedding-test",
                "onlyMissing": false
            }),
        )
        .await
        .expect("excluded lorebook should return a successful no-op");

        assert_eq!(result["success"], json!(true));
        assert_eq!(result["total"], json!(1));
        assert_eq!(result["vectorized"], json!(0));
        assert_eq!(result["skipped"], json!(1));
        let entry = state
            .storage
            .get("lorebook-entries", "entry-1")
            .expect("entry lookup should succeed")
            .expect("entry should still exist");
        assert!(entry.get("embedding").is_none());
    }

    #[test]
    fn lorebook_entry_embedding_text_includes_secondary_keys() {
        let entry = json!({
            "name": "Ancient beast",
            "keys": ["dragon"],
            "secondaryKeys": ["wyrm", "drake"],
            "description": "Mythic creature",
            "content": "Breathes fire."
        });

        assert_eq!(
            lorebook_entry_embedding_text(&entry),
            "Ancient beast\ndragon, wyrm, drake\nMythic creature\nBreathes fire."
        );
    }

    #[test]
    fn lorebook_entry_embedding_text_parses_secondary_key_string() {
        let entry = json!({
            "name": "Hidden city",
            "keys": "ruins",
            "secondaryKeys": "[\"lost capital\", \"old empire\"]",
            "content": "Buried below the salt flats."
        });

        assert_eq!(
            lorebook_entry_embedding_text(&entry),
            "Hidden city\nruins, lost capital, old empire\nBuried below the salt flats."
        );
    }

    #[test]
    fn lorebook_entry_embedding_text_omits_empty_key_section() {
        let entry = json!({
            "name": "Empty trigger entry",
            "keys": [],
            "secondaryKeys": [],
            "content": "Constant lore content."
        });

        assert_eq!(
            lorebook_entry_embedding_text(&entry),
            "Empty trigger entry\nConstant lore content."
        );
    }
}
