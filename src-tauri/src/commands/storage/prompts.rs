use super::shared::*;
use super::*;
use marinara_security::is_allowed_outbound_url;

pub(crate) async fn vectorize_lorebook(
    state: &AppState,
    lorebook_id: &str,
    body: Value,
) -> AppResult<Value> {
    let connection_id = required_string(&body, "connectionId")?;
    let (embedding_connection_id, mut connection) =
        resolve_embedding_connection_for_id(state, connection_id)?;
    let model = embedding_model(&connection, body.get("model").and_then(Value::as_str))?;
    if let Some(object) = connection.as_object_mut() {
        object.insert("model".to_string(), Value::String(model.clone()));
    }
    let only_missing = body
        .get("onlyMissing")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let mut entries =
        match list_collection(state, "lorebook-entries", Some(("lorebookId", lorebook_id)))? {
            Value::Array(rows) => rows,
            _ => Vec::new(),
        };
    for entry in &mut entries {
        normalize_legacy_text_bool_fields(entry, &["excludeFromVectorization"]);
    }
    let mut lorebook = get_required(state, "lorebooks", lorebook_id)?;
    normalize_legacy_text_bool_fields(&mut lorebook, &["excludeFromVectorization"]);
    let lorebook_excluded = lorebook_excludes_vectorization(Some(&lorebook));
    let total = if lorebook_excluded {
        0
    } else {
        entries
            .iter()
            .filter(|entry| !is_excluded_from_vectorization(entry))
            .count()
    };
    if lorebook_excluded {
        return Ok(json!({
            "success": true,
            "lorebookId": lorebook_id,
            "model": model,
            "total": total,
            "vectorized": 0,
            "skipped": entries.len()
        }));
    }
    let mut vectorized = 0usize;
    let mut skipped = 0usize;
    for entry in entries {
        if is_excluded_from_vectorization(&entry) {
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
                "embeddingConnectionId": embedding_connection_id,
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

pub(crate) fn resolve_embedding_connection_for_id(
    state: &AppState,
    connection_id: &str,
) -> AppResult<(String, Value)> {
    let connection = get_required(state, "connections", connection_id)?;
    if let Some(embedding_connection_id) = connection
        .get("embeddingConnectionId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let embedding_connection = get_required(state, "connections", embedding_connection_id)?;
        if is_openai_chatgpt_connection(&embedding_connection) {
            return Err(openai_chatgpt_embedding_error());
        }
        return Ok((embedding_connection_id.to_string(), embedding_connection));
    }
    if is_openai_chatgpt_connection(&connection) {
        return Err(openai_chatgpt_embedding_error());
    }
    Ok((connection_id.to_string(), connection))
}

pub(crate) fn resolve_default_embedding_connection(state: &AppState) -> AppResult<(String, Value)> {
    let connections = state.storage.list("connections")?;
    let selected = connections
        .iter()
        .find(|connection| {
            connection
                .get("isDefault")
                .and_then(Value::as_bool)
                .unwrap_or(false)
                && has_embedding_model(connection)
        })
        .or_else(|| {
            connections
                .iter()
                .find(|connection| has_embedding_model(connection))
        })
        .or_else(|| {
            connections.iter().find(|connection| {
                connection
                    .get("isDefault")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
            })
        })
        .or_else(|| connections.first())
        .ok_or_else(|| AppError::invalid_input("No embedding connection is configured"))?;
    let connection_id = selected
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("Embedding connection is missing an id"))?;
    resolve_embedding_connection_for_id(state, connection_id)
}

pub(crate) fn embedding_model(connection: &Value, explicit: Option<&str>) -> AppResult<String> {
    explicit
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| connection.get("embeddingModel").and_then(Value::as_str))
        .or_else(|| connection.get("model").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AppError::invalid_input("Embedding model is required"))
}

fn has_embedding_model(connection: &Value) -> bool {
    !is_openai_chatgpt_connection(connection)
        && connection
            .get("embeddingModel")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty())
}

fn is_openai_chatgpt_connection(connection: &Value) -> bool {
    connection
        .get("provider")
        .and_then(Value::as_str)
        .is_some_and(|provider| provider == "openai_chatgpt")
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

fn lorebook_entry_secondary_keys(entry: &Value) -> Vec<String> {
    let mut keys = Vec::new();
    for field in ["secondaryKeys", "secondary_keys", "keysecondary"] {
        for key in value_string_array(entry.get(field)) {
            if !keys.iter().any(|existing| existing == &key) {
                keys.push(key);
            }
        }
    }
    keys
}

fn lorebook_entry_embedding_text(entry: &Value) -> String {
    let keys = value_string_array(entry.get("keys"))
        .into_iter()
        .chain(lorebook_entry_secondary_keys(entry))
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

fn is_excluded_from_vectorization(row: &Value) -> bool {
    row.get("excludeFromVectorization")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

pub(crate) async fn embed_text(connection: &Value, model: &str, text: &str) -> AppResult<Vec<f64>> {
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    match provider {
        "openai_chatgpt" => Err(openai_chatgpt_embedding_error()),
        "google" | "google_vertex" => embed_google(connection, model, text).await,
        "ollama" => embed_ollama(connection, model, text).await,
        _ => embed_openai_compatible(connection, model, text).await,
    }
}

fn openai_chatgpt_embedding_error() -> AppError {
    AppError::invalid_input(
        "OpenAI (ChatGPT) does not support embeddings through Codex auth. Configure a separate embedding connection.",
    )
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-prompts-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn create_connection(state: &AppState) -> String {
        let connection = state
            .storage
            .create(
                "connections",
                json!({
                    "name": "Embeddings",
                    "provider": "openai",
                    "embeddingModel": "text-embedding-3-small"
                }),
            )
            .expect("connection should be created");
        connection
            .get("id")
            .and_then(Value::as_str)
            .expect("connection id should be assigned")
            .to_string()
    }

    fn create_lorebook(state: &AppState, exclude: Value) -> String {
        let lorebook = state
            .storage
            .create(
                "lorebooks",
                json!({
                    "name": "Vector Test",
                    "excludeFromVectorization": exclude
                }),
            )
            .expect("lorebook should be created");
        lorebook
            .get("id")
            .and_then(Value::as_str)
            .expect("lorebook id should be assigned")
            .to_string()
    }

    fn create_entry(state: &AppState, lorebook_id: &str, exclude: Value, embedding: Value) {
        state
            .storage
            .create(
                "lorebook-entries",
                json!({
                    "lorebookId": lorebook_id,
                    "name": "Entry",
                    "keys": ["key"],
                    "content": "entry content",
                    "enabled": true,
                    "excludeFromVectorization": exclude,
                    "embedding": embedding
                }),
            )
            .expect("entry should be created");
    }

    #[test]
    fn embedding_base_url_prefers_embedding_specific_url() {
        let connection = json!({
            "baseUrl": "https://chat.example/v1/",
            "embeddingBaseUrl": "https://embeddings.example/v1/"
        });

        assert_eq!(
            embedding_base_url(&connection, "https://fallback.example/v1"),
            "https://embeddings.example/v1"
        );
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
        let state = test_state("excluded-book");
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
        state
            .storage
            .create(
                "lorebook-entries",
                json!({
                    "id": "entry-2",
                    "lorebookId": "lorebook-1",
                    "name": "Entry excluded at entry level",
                    "excludeFromVectorization": true,
                    "content": "This still counts in the book-level total."
                }),
            )
            .expect("excluded entry should be stored");

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
        assert_eq!(result["total"], json!(0));
        assert_eq!(result["vectorized"], json!(0));
        assert_eq!(result["skipped"], json!(2));
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
    fn lorebook_entry_embedding_text_uses_legacy_secondary_key_aliases() {
        for (field, alias_value, expected_keys) in [
            ("secondary_keys", "snake case", "primary, snake case"),
            ("keysecondary", "silly tavern", "primary, silly tavern"),
        ] {
            let mut entry = json!({
                "name": "Alias entry",
                "keys": ["primary"],
                "content": "Alias content."
            });
            entry
                .as_object_mut()
                .expect("entry should be an object")
                .insert(field.to_string(), json!([alias_value]));

            assert_eq!(
                lorebook_entry_embedding_text(&entry),
                format!("Alias entry\n{expected_keys}\nAlias content.")
            );
        }
    }

    #[test]
    fn lorebook_entry_embedding_text_merges_secondary_key_aliases() {
        let entry = json!({
            "name": "Merged aliases",
            "keys": ["primary"],
            "secondaryKeys": ["canonical", "shared"],
            "secondary_keys": ["snake case", "shared"],
            "keysecondary": ["silly tavern"],
            "content": "Alias content."
        });

        assert_eq!(
            lorebook_entry_embedding_text(&entry),
            "Merged aliases\nprimary, canonical, shared, snake case, silly tavern\nAlias content."
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

    #[test]
    fn resolve_embedding_connection_follows_dedicated_connection() {
        let state = test_state("dedicated-embedding-connection");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "chat-connection",
                    "name": "Chat",
                    "provider": "openai",
                    "model": "gpt-4o",
                    "embeddingConnectionId": "embedding-connection"
                }),
            )
            .expect("chat connection should insert");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "embedding-connection",
                    "name": "Embeddings",
                    "provider": "custom",
                    "model": "chat-model",
                    "embeddingModel": "text-embedding-3-small"
                }),
            )
            .expect("embedding connection should insert");

        let (id, connection) =
            resolve_embedding_connection_for_id(&state, "chat-connection").unwrap();

        assert_eq!(id, "embedding-connection");
        assert_eq!(
            embedding_model(&connection, None).unwrap(),
            "text-embedding-3-small"
        );
    }

    #[test]
    fn resolve_embedding_connection_rejects_openai_chatgpt_without_dedicated_connection() {
        let state = test_state("chatgpt-embedding-rejected");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "chatgpt-connection",
                    "name": "ChatGPT",
                    "provider": "openai_chatgpt",
                    "model": "gpt-5",
                    "embeddingModel": "text-embedding-3-small"
                }),
            )
            .expect("chatgpt connection should insert");

        let error = resolve_embedding_connection_for_id(&state, "chatgpt-connection")
            .expect_err("chatgpt connection should not be used for embeddings");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("does not support embeddings"));
    }

    #[test]
    fn resolve_embedding_connection_rejects_openai_chatgpt_as_dedicated_connection() {
        let state = test_state("chatgpt-dedicated-embedding-rejected");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "chat-connection",
                    "name": "Chat",
                    "provider": "openai",
                    "model": "gpt-4o",
                    "embeddingConnectionId": "chatgpt-connection"
                }),
            )
            .expect("chat connection should insert");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "chatgpt-connection",
                    "name": "ChatGPT",
                    "provider": "openai_chatgpt",
                    "model": "gpt-5",
                    "embeddingModel": "text-embedding-3-small"
                }),
            )
            .expect("chatgpt connection should insert");

        let error = resolve_embedding_connection_for_id(&state, "chat-connection")
            .expect_err("chatgpt dedicated connection should not be used for embeddings");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("does not support embeddings"));
    }

    #[tokio::test]
    async fn embed_text_rejects_openai_chatgpt_before_provider_call() {
        let connection = json!({
            "provider": "openai_chatgpt",
            "baseUrl": "https://api.example.com/v1",
            "apiKey": "stale-key"
        });

        let error = embed_text(&connection, "text-embedding-3-small", "hello")
            .await
            .expect_err("chatgpt embedding should be rejected");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("does not support embeddings"));
    }

    #[test]
    fn resolve_embedding_connection_allows_openai_chatgpt_with_dedicated_embedding_connection() {
        let state = test_state("chatgpt-dedicated-embedding-allowed");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "chatgpt-connection",
                    "name": "ChatGPT",
                    "provider": "openai_chatgpt",
                    "model": "gpt-5",
                    "embeddingConnectionId": "embedding-connection"
                }),
            )
            .expect("chatgpt connection should insert");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "embedding-connection",
                    "name": "Embeddings",
                    "provider": "custom",
                    "model": "chat-model",
                    "embeddingModel": "text-embedding-3-small"
                }),
            )
            .expect("embedding connection should insert");

        let (id, connection) =
            resolve_embedding_connection_for_id(&state, "chatgpt-connection").unwrap();

        assert_eq!(id, "embedding-connection");
        assert_eq!(
            embedding_model(&connection, None).unwrap(),
            "text-embedding-3-small"
        );
    }

    #[test]
    fn resolve_default_embedding_connection_prefers_default_embedding_model() {
        let state = test_state("default-embedding-connection");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "chat-connection",
                    "name": "Chat",
                    "provider": "openai",
                    "model": "gpt-4o",
                    "isDefault": true
                }),
            )
            .expect("chat connection should insert");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "embedding-connection",
                    "name": "Embeddings",
                    "provider": "custom",
                    "model": "chat-model",
                    "embeddingModel": "local-embedding"
                }),
            )
            .expect("embedding connection should insert");

        let (id, connection) = resolve_default_embedding_connection(&state).unwrap();

        assert_eq!(id, "embedding-connection");
        assert_eq!(
            embedding_model(&connection, None).unwrap(),
            "local-embedding"
        );
    }

    #[tokio::test]
    async fn vectorize_lorebook_no_vector_reports_all_entries_skipped() {
        let state = test_state("no-vector");
        let connection_id = create_connection(&state);
        let lorebook_id = create_lorebook(&state, json!("true"));
        create_entry(&state, &lorebook_id, json!(false), Value::Null);
        create_entry(&state, &lorebook_id, json!(false), Value::Null);

        let result = vectorize_lorebook(
            &state,
            &lorebook_id,
            json!({ "connectionId": connection_id, "model": "text-embedding-3-small" }),
        )
        .await
        .expect("no-vector lorebook should short-circuit before provider calls");

        assert_eq!(result["total"], json!(0));
        assert_eq!(result["vectorized"], json!(0));
        assert_eq!(result["skipped"], json!(2));
    }

    #[tokio::test]
    async fn vectorize_lorebook_total_counts_only_vectorizable_entries() {
        let state = test_state("entry-exclusions");
        let connection_id = create_connection(&state);
        let lorebook_id = create_lorebook(&state, json!(false));
        create_entry(&state, &lorebook_id, json!("true"), Value::Null);
        create_entry(&state, &lorebook_id, json!("false"), json!([0.1, 0.2]));

        let result = vectorize_lorebook(
            &state,
            &lorebook_id,
            json!({ "connectionId": connection_id, "model": "text-embedding-3-small", "onlyMissing": true }),
        )
        .await
        .expect("existing embeddings should avoid provider calls");

        assert_eq!(result["total"], json!(1));
        assert_eq!(result["vectorized"], json!(0));
        assert_eq!(result["skipped"], json!(2));
    }
}
