use super::shared::*;
use super::*;
use marinara_security::is_allowed_provider_url;
use std::collections::{HashMap, HashSet};

const LEGACY_LOCAL_SIDECAR_CONNECTION_ID: &str = "__local_sidecar__";

pub(crate) fn duplicate_prompt_preset(state: &AppState, preset_id: &str) -> AppResult<Value> {
    let mut preset = get_required(state, "prompts", preset_id)?;
    let preset_object = preset
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Prompt preset is not an object"))?;
    preset_object.remove("id");
    if let Some(name) = preset_object
        .get("name")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        preset_object.insert("name".to_string(), Value::String(format!("{name} Copy")));
    }
    preset_object.insert("isDefault".to_string(), Value::Bool(false));
    preset_object.insert("default".to_string(), Value::Bool(false));
    preset_object.insert("groupOrder".to_string(), json!([]));
    preset_object.insert("sectionOrder".to_string(), json!([]));
    preset_object.insert("variableOrder".to_string(), json!([]));

    let created_preset = state.storage.create("prompts", preset)?;
    let new_preset_id = value_id(&created_preset, "duplicated prompt preset")?;

    let (group_id_map, group_order) =
        duplicate_prompt_child_collection(state, "prompt-groups", preset_id, &new_preset_id, None)?;
    let (section_id_map, section_order) = duplicate_prompt_child_collection(
        state,
        "prompt-sections",
        preset_id,
        &new_preset_id,
        Some(&group_id_map),
    )?;
    let (variable_id_map, variable_order) = duplicate_prompt_child_collection(
        state,
        "prompt-variables",
        preset_id,
        &new_preset_id,
        None,
    )?;

    let source_preset = get_required(state, "prompts", preset_id)?;
    state.storage.patch(
        "prompts",
        &new_preset_id,
        json!({
            "groupOrder": remap_prompt_order(source_preset.get("groupOrder"), &group_id_map, &group_order),
            "sectionOrder": remap_prompt_order(source_preset.get("sectionOrder"), &section_id_map, &section_order),
            "variableOrder": remap_prompt_order(source_preset.get("variableOrder"), &variable_id_map, &variable_order)
        }),
    )
}

pub(crate) fn delete_prompt_preset_children(state: &AppState, preset_id: &str) -> AppResult<()> {
    let mut filters = Map::new();
    filters.insert("presetId".to_string(), Value::String(preset_id.to_string()));
    state.storage.delete_where("prompt-variables", &filters)?;
    state.storage.delete_where("prompt-sections", &filters)?;
    state.storage.delete_where("prompt-groups", &filters)?;
    Ok(())
}

fn duplicate_prompt_child_collection(
    state: &AppState,
    collection: &str,
    source_preset_id: &str,
    new_preset_id: &str,
    group_id_map: Option<&HashMap<String, String>>,
) -> AppResult<(HashMap<String, String>, Vec<String>)> {
    let Value::Array(rows) =
        list_collection(state, collection, Some(("presetId", source_preset_id)))?
    else {
        return Ok((HashMap::new(), Vec::new()));
    };
    let mut id_map = HashMap::new();
    let mut created_order = Vec::new();
    let mut pending_group_parents: Vec<(String, Option<String>)> = Vec::new();

    for row in rows {
        let old_id = value_id(&row, collection)?;
        let mut object = row.as_object().cloned().ok_or_else(|| {
            AppError::invalid_input(format!("{collection} child is not an object"))
        })?;
        object.remove("id");
        object.insert(
            "presetId".to_string(),
            Value::String(new_preset_id.to_string()),
        );

        if collection == "prompt-groups" {
            let old_parent = object
                .get("parentGroupId")
                .and_then(Value::as_str)
                .map(str::to_string);
            object.insert("parentGroupId".to_string(), Value::Null);
            let created = state.storage.create(collection, Value::Object(object))?;
            let new_id = value_id(&created, collection)?;
            pending_group_parents.push((new_id.clone(), old_parent));
            created_order.push(new_id.clone());
            id_map.insert(old_id, new_id);
            continue;
        }

        if collection == "prompt-sections" {
            if let Some(old_group_id) = object.get("groupId").and_then(Value::as_str) {
                let remapped = group_id_map
                    .and_then(|ids| ids.get(old_group_id))
                    .map(|id| Value::String(id.clone()))
                    .unwrap_or(Value::Null);
                object.insert("groupId".to_string(), remapped);
            }
        }

        let created = state.storage.create(collection, Value::Object(object))?;
        let new_id = value_id(&created, collection)?;
        created_order.push(new_id.clone());
        id_map.insert(old_id, new_id);
    }

    if collection == "prompt-groups" {
        for (new_id, old_parent) in pending_group_parents {
            let remapped = old_parent
                .and_then(|parent_id| id_map.get(&parent_id).cloned())
                .map(Value::String)
                .unwrap_or(Value::Null);
            state
                .storage
                .patch(collection, &new_id, json!({ "parentGroupId": remapped }))?;
        }
    }

    Ok((id_map, created_order))
}

fn remap_prompt_order(
    value: Option<&Value>,
    id_map: &HashMap<String, String>,
    fallback: &[String],
) -> Vec<String> {
    let mut ordered = Vec::new();
    if let Some(items) = value.and_then(Value::as_array) {
        for item in items {
            let Some(old_id) = item.as_str() else {
                continue;
            };
            let Some(new_id) = id_map.get(old_id) else {
                continue;
            };
            if !ordered.iter().any(|id| id == new_id) {
                ordered.push(new_id.clone());
            }
        }
    }
    for new_id in fallback {
        if !ordered.iter().any(|id| id == new_id) {
            ordered.push(new_id.clone());
        }
    }
    ordered
}

fn value_id(value: &Value, label: &str) -> AppResult<String> {
    value
        .get("id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| AppError::invalid_input(format!("{label} is missing an id")))
}

pub(crate) async fn vectorize_lorebook(
    state: &AppState,
    lorebook_id: &str,
    body: Value,
) -> AppResult<Value> {
    let (embedding_connection_id, mut connection) =
        if let Some(connection_id) = optional_body_string(&body, "connectionId") {
            resolve_embedding_connection_for_id(state, connection_id)?
        } else {
            resolve_default_configured_embedding_connection(state)?
        };
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
    if let Some(entry_ids) = optional_body_string_set(&body, "entryIds") {
        entries.retain(|entry| {
            entry
                .get("id")
                .and_then(Value::as_str)
                .is_some_and(|id| entry_ids.contains(id))
        });
    }
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
    // Collect the entries that actually need embedding so we can batch the
    // provider calls instead of firing one HTTP round-trip per entry (#2285).
    let mut pending: Vec<(String, String)> = Vec::new();
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
        pending.push((entry_id.to_string(), text));
    }
    for chunk in pending.chunks(EMBEDDING_BATCH_SIZE) {
        let texts = chunk
            .iter()
            .map(|(_, text)| text.as_str())
            .collect::<Vec<_>>();
        let embeddings = embed_texts(&connection, &model, &texts).await?;
        for ((entry_id, _), embedding) in chunk.iter().zip(embeddings) {
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

fn optional_body_string<'a>(body: &'a Value, key: &str) -> Option<&'a str> {
    body.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn optional_body_string_set(body: &Value, key: &str) -> Option<HashSet<String>> {
    let ids = body
        .get(key)
        .and_then(Value::as_array)?
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect::<HashSet<_>>();
    (!ids.is_empty()).then_some(ids)
}

fn resolve_default_configured_embedding_connection(state: &AppState) -> AppResult<(String, Value)> {
    let connections = connection_secrets::connections_for_runtime(state)?;
    let embedding_candidates = connections
        .iter()
        .filter(|connection| !is_legacy_local_sidecar_connection(connection))
        .collect::<Vec<_>>();
    let mut ranked = embedding_candidates
        .iter()
        .copied()
        .filter(|connection| {
            connection
                .get("isDefault")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        })
        .chain(embedding_candidates.iter().copied().filter(|connection| {
            !connection
                .get("isDefault")
                .and_then(Value::as_bool)
                .unwrap_or(false)
        }));

    for candidate in ranked.by_ref() {
        let Some(connection_id) = candidate.get("id").and_then(Value::as_str) else {
            continue;
        };
        let Ok((embedding_connection_id, embedding_connection)) =
            resolve_embedding_connection_for_id(state, connection_id)
        else {
            continue;
        };
        if has_embedding_model(&embedding_connection) {
            return Ok((embedding_connection_id, embedding_connection));
        }
    }

    Err(AppError::invalid_input(
        "No embedding connection with an embedding model is configured",
    ))
}

pub(crate) fn resolve_embedding_connection_for_id(
    state: &AppState,
    connection_id: &str,
) -> AppResult<(String, Value)> {
    if is_legacy_local_sidecar_connection_id(connection_id) {
        return Err(legacy_local_sidecar_embedding_error());
    }
    let connection = connection_secrets::connection_for_runtime(state, connection_id)?;
    if let Some(embedding_connection_id) = connection
        .get("embeddingConnectionId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if is_legacy_local_sidecar_connection_id(embedding_connection_id) {
            return Err(legacy_local_sidecar_embedding_error());
        }
        let embedding_connection =
            connection_secrets::connection_for_runtime(state, embedding_connection_id)?;
        if is_openai_chatgpt_connection(&embedding_connection) {
            return Err(openai_chatgpt_embedding_error());
        }
        if is_claude_subscription_connection(&embedding_connection) {
            return Err(claude_subscription_embedding_error());
        }
        return Ok((embedding_connection_id.to_string(), embedding_connection));
    }
    if is_openai_chatgpt_connection(&connection) {
        return Err(openai_chatgpt_embedding_error());
    }
    if is_claude_subscription_connection(&connection) {
        return Err(claude_subscription_embedding_error());
    }
    Ok((connection_id.to_string(), connection))
}

pub(crate) fn resolve_default_embedding_connection(state: &AppState) -> AppResult<(String, Value)> {
    let connections = connection_secrets::connections_for_runtime(state)?;
    let embedding_candidates = connections
        .iter()
        .filter(|connection| !is_legacy_local_sidecar_connection(connection))
        .collect::<Vec<_>>();
    let selected = embedding_candidates
        .iter()
        .copied()
        .find(|connection| {
            connection
                .get("isDefault")
                .and_then(Value::as_bool)
                .unwrap_or(false)
                && has_embedding_model(connection)
        })
        .or_else(|| {
            embedding_candidates
                .iter()
                .copied()
                .find(|connection| has_embedding_model(connection))
        })
        .or_else(|| {
            embedding_candidates.iter().copied().find(|connection| {
                connection
                    .get("isDefault")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
            })
        })
        .or_else(|| embedding_candidates.first().copied())
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
        && !is_claude_subscription_connection(connection)
        && !is_legacy_local_sidecar_connection(connection)
        && connection
            .get("embeddingModel")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty())
}

fn is_legacy_local_sidecar_connection(connection: &Value) -> bool {
    connection
        .get("id")
        .and_then(Value::as_str)
        .is_some_and(is_legacy_local_sidecar_connection_id)
}

fn is_legacy_local_sidecar_connection_id(connection_id: &str) -> bool {
    connection_id.trim() == LEGACY_LOCAL_SIDECAR_CONNECTION_ID
}

fn is_openai_chatgpt_connection(connection: &Value) -> bool {
    connection
        .get("provider")
        .and_then(Value::as_str)
        .is_some_and(|provider| provider == "openai_chatgpt")
}

fn is_claude_subscription_connection(connection: &Value) -> bool {
    connection
        .get("provider")
        .and_then(Value::as_str)
        .is_some_and(|provider| provider == "claude_subscription")
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
        "claude_subscription" => Err(claude_subscription_embedding_error()),
        "google" | "google_vertex" => embed_google(connection, model, text).await,
        "ollama" => embed_ollama(connection, model, text).await,
        _ => embed_openai_compatible(connection, model, text).await,
    }
}

/// Maximum number of texts sent in a single embeddings request, mirroring the
/// web build's batch size so a large lorebook needs one HTTP round-trip per 50
/// entries instead of one per entry (#2285).
const EMBEDDING_BATCH_SIZE: usize = 50;

/// Embed a batch of texts, returning one embedding per input in the same order.
///
/// OpenAI-compatible providers accept an `input` array and return `data[]`
/// ordered by `index`, so they are batched in a single request. Google and
/// Ollama embedding endpoints are single-input by protocol, so they fall back
/// to one call per text.
pub(crate) async fn embed_texts(
    connection: &Value,
    model: &str,
    texts: &[&str],
) -> AppResult<Vec<Vec<f64>>> {
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("openai");
    match provider {
        "openai_chatgpt" => Err(openai_chatgpt_embedding_error()),
        "google" | "google_vertex" | "ollama" => {
            let mut out = Vec::with_capacity(texts.len());
            for text in texts {
                out.push(embed_text(connection, model, text).await?);
            }
            Ok(out)
        }
        _ => embed_openai_compatible_batch(connection, model, texts).await,
    }
}

fn openai_chatgpt_embedding_error() -> AppError {
    AppError::invalid_input(
        "OpenAI (ChatGPT) does not support embeddings through Codex auth. Configure a separate embedding connection.",
    )
}

fn claude_subscription_embedding_error() -> AppError {
    AppError::invalid_input(
        "Claude Subscription does not support embeddings through local subscription auth. Configure a separate embedding connection.",
    )
}

fn legacy_local_sidecar_embedding_error() -> AppError {
    AppError::invalid_input(
        "Local Model (sidecar) embeddings are retired in the refactor. Configure a normal embedding-capable connection.",
    )
}

async fn embed_openai_compatible(
    connection: &Value,
    model: &str,
    text: &str,
) -> AppResult<Vec<f64>> {
    let mut embeddings = embed_openai_compatible_batch(connection, model, &[text]).await?;
    embeddings.pop().ok_or_else(|| {
        AppError::new(
            "embedding_response_error",
            "Embedding response did not contain a numeric embedding",
        )
    })
}

async fn embed_openai_compatible_batch(
    connection: &Value,
    model: &str,
    texts: &[&str],
) -> AppResult<Vec<Vec<f64>>> {
    let base = embedding_base_url(connection, "https://api.openai.com/v1");
    let url = format!("{base}/embeddings");
    ensure_embedding_url_allowed(&url)?;
    let mut request = reqwest::Client::new()
        .post(url)
        .json(&json!({ "model": model, "input": texts }));
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
    let expected = texts.len();
    parse_embedding_batch_response(response, expected).await
}

async fn embed_google(connection: &Value, model: &str, text: &str) -> AppResult<Vec<f64>> {
    let api_key = connection
        .get("apiKey")
        .and_then(Value::as_str)
        .unwrap_or("");
    let provider = connection
        .get("provider")
        .and_then(Value::as_str)
        .unwrap_or("google");
    let base = embedding_base_url(
        connection,
        if provider == "google_vertex" {
            "https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1"
        } else {
            "https://generativelanguage.googleapis.com"
        },
    );
    let url = if provider == "google_vertex" {
        let base = base.trim_end_matches("/publishers/google/models");
        format!("{base}/publishers/google/models/{model}:embedContent")
    } else {
        format!("{base}/v1beta/models/{model}:embedContent?key={api_key}")
    };
    ensure_embedding_url_allowed(&url)?;
    let mut request = reqwest::Client::new()
        .post(url)
        .json(&json!({ "content": { "parts": [{ "text": text }] } }));
    if provider == "google_vertex" {
        for (name, value) in marinara_llm::google_vertex_auth_headers_for_credential(api_key).await?
        {
            request = request.header(name, value);
        }
    }
    let response = request
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

/// Parse an OpenAI-compatible batch embeddings response, returning embeddings
/// ordered by each item's `index` (the API does not guarantee response order).
async fn parse_embedding_batch_response(
    response: reqwest::Response,
    expected: usize,
) -> AppResult<Vec<Vec<f64>>> {
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
    order_embeddings_by_index(&json, expected)
}

/// Order the `data[]` embeddings of an OpenAI-compatible response by each
/// item's `index` field, falling back to array position when `index` is
/// absent. Errors loudly if any input slot ends up unfilled, so a misordered
/// or truncated provider response can never silently write the wrong vector to
/// an entry.
fn order_embeddings_by_index(json: &Value, expected: usize) -> AppResult<Vec<Vec<f64>>> {
    let items = json
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            AppError::with_details(
                "embedding_response_error",
                "Embedding response did not contain a data array",
                json.clone(),
            )
        })?;
    let mut ordered: Vec<Option<Vec<f64>>> = vec![None; expected];
    let mut fallback = Vec::with_capacity(items.len());
    for (position, item) in items.iter().enumerate() {
        let embedding = item
            .get("embedding")
            .and_then(json_embedding_array)
            .filter(|embedding| !embedding.is_empty())
            .ok_or_else(|| {
                AppError::with_details(
                    "embedding_response_error",
                    "Embedding response did not contain a numeric embedding",
                    json.clone(),
                )
            })?;
        let index = item.get("index").and_then(Value::as_u64).map(|n| n as usize);
        match index {
            // An explicit index is authoritative: an out-of-range or duplicate
            // index is a malformed response, not a positional fallback. Treating
            // it as positional would write the wrong input's vector to an entry,
            // so fail loudly instead.
            Some(index) if index >= expected => {
                return Err(AppError::with_details(
                    "embedding_response_error",
                    format!("Embedding response returned an out-of-range index {index} for {expected} inputs"),
                    json.clone(),
                ));
            }
            Some(index) if ordered[index].is_some() => {
                return Err(AppError::with_details(
                    "embedding_response_error",
                    format!("Embedding response returned a duplicate index {index}"),
                    json.clone(),
                ));
            }
            Some(index) => ordered[index] = Some(embedding),
            // Only wholly-unindexed items fall back to array position.
            None => fallback.push((position, embedding)),
        }
    }
    for (position, embedding) in fallback {
        if position < expected {
            ordered[position].get_or_insert(embedding);
        }
    }
    ordered
        .into_iter()
        .collect::<Option<Vec<_>>>()
        .filter(|all| all.len() == expected)
        .ok_or_else(|| {
            AppError::with_details(
                "embedding_response_error",
                format!(
                    "Embedding response returned fewer embeddings than the {expected} requested inputs"
                ),
                json.clone(),
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
    if is_allowed_provider_url(url, false) {
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

    #[test]
    fn claude_subscription_embedding_connection_rejects_without_dedicated_connection() {
        let state = test_state("claude-subscription-embedding-rejected");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "claude-subscription-connection",
                    "name": "Claude Subscription",
                    "provider": "claude_subscription",
                    "model": "claude-sonnet-4-6",
                    "embeddingModel": "text-embedding-3-small"
                }),
            )
            .expect("claude subscription connection should insert");

        let error = resolve_embedding_connection_for_id(&state, "claude-subscription-connection")
            .expect_err("claude subscription connection should not be used for embeddings");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("does not support embeddings"));
        assert!(error.message.contains("separate embedding"));
    }

    #[test]
    fn claude_subscription_embedding_connection_rejects_as_dedicated_connection() {
        let state = test_state("claude-subscription-dedicated-embedding-rejected");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "chat-connection",
                    "name": "Chat",
                    "provider": "openai",
                    "model": "gpt-4o",
                    "embeddingConnectionId": "claude-subscription-connection"
                }),
            )
            .expect("chat connection should insert");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "claude-subscription-connection",
                    "name": "Claude Subscription",
                    "provider": "claude_subscription",
                    "model": "claude-sonnet-4-6",
                    "embeddingModel": "text-embedding-3-small"
                }),
            )
            .expect("claude subscription connection should insert");

        let error = resolve_embedding_connection_for_id(&state, "chat-connection").expect_err(
            "claude subscription dedicated connection should not be used for embeddings",
        );

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("does not support embeddings"));
        assert!(error.message.contains("separate embedding"));
    }

    #[test]
    fn resolve_embedding_connection_rejects_legacy_local_sidecar_id() {
        let state = test_state("legacy-sidecar-embedding-rejected");

        let error = resolve_embedding_connection_for_id(&state, LEGACY_LOCAL_SIDECAR_CONNECTION_ID)
            .expect_err("legacy sidecar should not be used for embeddings");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("retired in the refactor"));
    }

    #[test]
    fn resolve_embedding_connection_rejects_legacy_local_sidecar_as_dedicated_connection() {
        let state = test_state("legacy-sidecar-dedicated-embedding-rejected");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "chat-connection",
                    "name": "Chat",
                    "provider": "openai",
                    "model": "gpt-4o",
                    "embeddingConnectionId": LEGACY_LOCAL_SIDECAR_CONNECTION_ID
                }),
            )
            .expect("chat connection should insert");

        let error = resolve_embedding_connection_for_id(&state, "chat-connection")
            .expect_err("legacy sidecar dedicated connection should not be used for embeddings");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("retired in the refactor"));
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

    #[tokio::test]
    async fn claude_subscription_embedding_text_rejects_before_provider_call() {
        let connection = json!({
            "provider": "claude_subscription",
            "embeddingBaseUrl": "http://127.0.0.1:9/v1",
            "apiKey": "unused"
        });

        let error = embed_text(&connection, "text-embedding-3-small", "hello")
            .await
            .expect_err("claude subscription embedding should be rejected");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("does not support embeddings"));
        assert!(error.message.contains("separate embedding"));
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

    #[test]
    fn resolve_default_embedding_connection_skips_legacy_local_sidecar_candidate() {
        let state = test_state("default-skips-legacy-sidecar");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": LEGACY_LOCAL_SIDECAR_CONNECTION_ID,
                    "name": "Local Model (sidecar)",
                    "provider": "custom",
                    "model": "local-sidecar",
                    "embeddingModel": "local-sidecar",
                    "isDefault": true
                }),
            )
            .expect("legacy sidecar connection should insert");
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

        let (id, connection) = resolve_default_embedding_connection(&state).unwrap();

        assert_eq!(id, "embedding-connection");
        assert_eq!(
            embedding_model(&connection, None).unwrap(),
            "text-embedding-3-small"
        );
    }

    #[test]
    fn resolve_default_embedding_connection_rejects_only_legacy_local_sidecar() {
        let state = test_state("default-only-legacy-sidecar");
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": LEGACY_LOCAL_SIDECAR_CONNECTION_ID,
                    "name": "Local Model (sidecar)",
                    "provider": "custom",
                    "model": "local-sidecar",
                    "embeddingModel": "local-sidecar",
                    "isDefault": true
                }),
            )
            .expect("legacy sidecar connection should insert");

        let error = resolve_default_embedding_connection(&state)
            .expect_err("legacy sidecar should not be selected as default embedding connection");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("No embedding connection"));
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

    #[tokio::test]
    async fn vectorize_lorebook_can_target_entry_ids_with_default_connection() {
        let state = test_state("targeted-default-connection");
        create_connection(&state);
        let lorebook_id = create_lorebook(&state, json!(false));
        state
            .storage
            .create(
                "lorebook-entries",
                json!({
                    "id": "target-entry",
                    "lorebookId": lorebook_id,
                    "name": "Already vectorized target",
                    "keys": ["target"],
                    "content": "This should be counted and skipped.",
                    "embedding": [0.1, 0.2]
                }),
            )
            .expect("target entry should be stored");
        state
            .storage
            .create(
                "lorebook-entries",
                json!({
                    "id": "untouched-entry",
                    "lorebookId": lorebook_id,
                    "name": "Missing embedding outside target set",
                    "keys": ["outside"],
                    "content": "This would call the provider if not filtered.",
                    "embedding": null
                }),
            )
            .expect("untouched entry should be stored");

        let result = vectorize_lorebook(
            &state,
            &lorebook_id,
            json!({
                "onlyMissing": true,
                "entryIds": ["target-entry"]
            }),
        )
        .await
        .expect("targeted vectorization should use the configured default connection");

        assert_eq!(result["total"], json!(1));
        assert_eq!(result["vectorized"], json!(0));
        assert_eq!(result["skipped"], json!(1));
    }

    #[tokio::test]
    async fn vectorize_lorebook_default_connection_requires_embedding_model() {
        let state = test_state("default-connection-without-embedding-model");
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
            .expect("chat connection should be stored");
        let lorebook_id = create_lorebook(&state, json!(false));
        create_entry(&state, &lorebook_id, json!(false), Value::Null);

        let error = vectorize_lorebook(
            &state,
            &lorebook_id,
            json!({
                "onlyMissing": true
            }),
        )
        .await
        .expect_err("auto/default vectorization should require an embedding model");

        assert_eq!(error.code, "invalid_input");
        assert!(error.message.contains("embedding model is configured"));
    }
}
