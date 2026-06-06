use super::agents;
use super::game_state_snapshots;
use super::media_uploads::remove_managed_record_file;
use super::message_swipes as message_swipe_storage;
use super::prompts;
use super::shared::*;
use super::*;
use crate::builtins::is_protected_record;
use marinara_storage::AtomicCollectionRows;
use std::collections::{HashMap, HashSet};

const MEMORY_CHUNK_SIZE: usize = 5;
const MEMORY_EMBEDDING_DIMS: usize = 512;

pub(crate) fn messages_for_chat(state: &AppState, chat_id: &str) -> AppResult<Vec<Value>> {
    let mut rows = state.storage.list_messages_for_chat(chat_id)?;
    rows.sort_by(|a, b| {
        let a_time = a.get("createdAt").and_then(Value::as_str).unwrap_or("");
        let b_time = b.get("createdAt").and_then(Value::as_str).unwrap_or("");
        a_time.cmp(b_time)
    });
    message_swipe_storage::materialize_messages(state, &mut rows, true)?;
    Ok(rows)
}

const PROMPT_SNAPSHOT_KEYS: [&str; 2] = [
    "generationPromptSnapshot",
    "generationPromptSnapshotsBySwipe",
];

/// Drop saved prompt snapshots from an `extra` object, returning the rewritten
/// object only when something was actually removed. Leaves every other field
/// (including legacy `cachedPrompt`) untouched.
fn strip_snapshot_from_extra(extra: Option<&Value>) -> Option<Value> {
    let object = json_object_value(extra)?;
    let mut next = object.as_object()?.clone();
    let mut changed = false;
    for key in PROMPT_SNAPSHOT_KEYS {
        if next.remove(key).is_some() {
            changed = true;
        }
    }
    changed.then_some(Value::Object(next))
}

/// Build a minimal patch that clears prompt snapshots from a raw message record
/// and from each of its embedded swipes. Returns `None` when the message holds
/// no snapshot to evict.
fn strip_prompt_snapshot_patch(message: &Value) -> Option<Value> {
    let mut patch = Map::new();
    if let Some(next_extra) = strip_snapshot_from_extra(message.get("extra")) {
        patch.insert("extra".to_string(), next_extra);
    }
    if let Some(swipes) = message.get("swipes").and_then(Value::as_array) {
        let mut next_swipes = swipes.clone();
        let mut swipes_changed = false;
        for swipe in next_swipes.iter_mut() {
            if let Some(next_extra) = strip_snapshot_from_extra(swipe.get("extra")) {
                if let Some(object) = swipe.as_object_mut() {
                    object.insert("extra".to_string(), next_extra);
                    swipes_changed = true;
                }
            }
        }
        if swipes_changed {
            patch.insert("swipes".to_string(), Value::Array(next_swipes));
        }
    }
    (!patch.is_empty()).then_some(Value::Object(patch))
}

/// Evict saved prompt snapshots from older assistant messages, retaining only
/// the most recent `keep_last`. Mirrors v1.6.1, which kept `cachedPrompt` for
/// just the last 2 assistant messages to bound storage growth; the refactor
/// renamed the field to `generationPromptSnapshot` but never ported the
/// eviction, so native chats accumulate a full snapshot per message/swipe.
///
/// Non-destructive to every other field, including legacy `cachedPrompt` (so
/// imported v1.6.1 chats keep inspector fidelity via synthesis). Operates on raw
/// message records (with embedded swipes), patching only messages that actually
/// carry a snapshot.
pub(crate) fn evict_prompt_snapshots(
    state: &AppState,
    chat_id: &str,
    keep_last: usize,
) -> AppResult<Value> {
    let mut messages = state.storage.list_messages_for_chat(chat_id)?;
    message_swipe_storage::materialize_messages(state, &mut messages, true)?;
    messages.sort_by(|a, b| {
        let a_time = a.get("createdAt").and_then(Value::as_str).unwrap_or("");
        let b_time = b.get("createdAt").and_then(Value::as_str).unwrap_or("");
        a_time.cmp(b_time).then_with(|| {
            let a_id = a.get("id").and_then(Value::as_str).unwrap_or("");
            let b_id = b.get("id").and_then(Value::as_str).unwrap_or("");
            a_id.cmp(b_id)
        })
    });
    let assistant_ids: Vec<String> = messages
        .iter()
        .filter(|message| message.get("role").and_then(Value::as_str) == Some("assistant"))
        .filter_map(|message| {
            message
                .get("id")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .collect();
    let stale_cutoff = assistant_ids.len().saturating_sub(keep_last);
    let stale: HashSet<&str> = assistant_ids[..stale_cutoff]
        .iter()
        .map(String::as_str)
        .collect();
    let mut evicted: u64 = 0;
    for message in &messages {
        let Some(id) = message.get("id").and_then(Value::as_str) else {
            continue;
        };
        if !stale.contains(id) {
            continue;
        }
        if let Some(patch) = strip_prompt_snapshot_patch(message) {
            state.storage.patch("messages", id, patch)?;
            evicted += 1;
        }
    }
    if evicted > 0 {
        message_swipe_storage::migrate_nested_message_swipes(&state.storage)?;
    }
    Ok(json!({ "evicted": evicted }))
}

fn message_content(message: &Value) -> String {
    message
        .get("content")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string()
}

fn memory_recall_is_stopword(token: &str) -> bool {
    matches!(
        token,
        "about"
            | "and"
            | "are"
            | "been"
            | "but"
            | "did"
            | "does"
            | "find"
            | "for"
            | "from"
            | "had"
            | "has"
            | "have"
            | "her"
            | "him"
            | "his"
            | "how"
            | "its"
            | "know"
            | "like"
            | "look"
            | "make"
            | "more"
            | "our"
            | "out"
            | "remember"
            | "said"
            | "say"
            | "she"
            | "show"
            | "tell"
            | "that"
            | "the"
            | "their"
            | "them"
            | "then"
            | "there"
            | "they"
            | "this"
            | "was"
            | "what"
            | "when"
            | "where"
            | "which"
            | "who"
            | "why"
            | "with"
            | "you"
            | "your"
    )
}

fn lexical_memory_tokens(text: &str) -> Vec<String> {
    text.split(|ch: char| !ch.is_alphanumeric())
        .map(|token| token.trim().to_lowercase())
        .filter(|token| token.chars().count() > 1)
        .collect()
}

fn lexical_feature_hash(feature: &str) -> u32 {
    let mut hash = 2166136261_u32;
    for ch in feature.chars() {
        hash ^= ch as u32;
        hash = hash.wrapping_mul(16777619);
    }
    hash
}

fn add_lexical_feature(vector: &mut [f64], feature: &str, weight: f64) {
    if feature.is_empty() || weight <= 0.0 {
        return;
    }
    let hash = lexical_feature_hash(feature);
    let sign = if hash & 0x80000000 == 0 { 1.0 } else { -1.0 };
    let index = (hash as usize) % MEMORY_EMBEDDING_DIMS;
    vector[index] += weight * sign;
}

fn memory_recall_meaningful_token(token: &str) -> bool {
    !memory_recall_is_stopword(token)
}

fn memory_recall_token_weight(token: &str) -> f64 {
    if !memory_recall_meaningful_token(token) {
        return 0.0;
    }
    1.0 + ((token.chars().count().saturating_sub(4)) as f64 * 0.05).min(0.75)
}

fn add_memory_recall_token_features(vector: &mut [f64], token: &str) {
    let weight = memory_recall_token_weight(token);
    if weight <= 0.0 {
        return;
    }
    let chars = token.chars().collect::<Vec<_>>();
    add_lexical_feature(vector, &format!("w:{token}"), weight);
    if chars.len() >= 5 {
        add_lexical_feature(
            vector,
            &format!("p:{}", chars[..4].iter().copied().collect::<String>()),
            0.25,
        );
        add_lexical_feature(
            vector,
            &format!(
                "s:{}",
                chars[chars.len() - 4..].iter().copied().collect::<String>()
            ),
            0.25,
        );
    }
    for index in 0..chars.len().saturating_sub(2) {
        add_lexical_feature(
            vector,
            &format!(
                "g:{}",
                chars[index..index + 3].iter().copied().collect::<String>()
            ),
            0.15,
        );
    }
}

fn lexical_memory_embedding(text: &str) -> Vec<f64> {
    let mut vector = vec![0.0_f64; MEMORY_EMBEDDING_DIMS];
    let mut meaningful_tokens = Vec::new();
    for token in lexical_memory_tokens(text) {
        add_memory_recall_token_features(&mut vector, &token);
        if memory_recall_meaningful_token(&token) {
            meaningful_tokens.push(token);
        }
    }
    for pair in meaningful_tokens.windows(2) {
        if let [left, right] = pair {
            add_lexical_feature(&mut vector, &format!("b:{left} {right}"), 1.4);
        }
    }
    let magnitude = vector.iter().map(|value| value * value).sum::<f64>().sqrt();
    if magnitude > 0.0 {
        for value in &mut vector {
            *value /= magnitude;
        }
    }
    vector
}

struct MemoryEmbeddingContext {
    connection_id: String,
    connection: Value,
    model: String,
}

struct MemoryEmbeddingResult {
    embedding: Vec<f64>,
    source: &'static str,
    connection_id: Option<String>,
    model: Option<String>,
}

fn configured_embedding_model(connection: &Value) -> Option<String> {
    connection
        .get("embeddingModel")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn memory_embedding_context_from_connection(
    connection_id: String,
    mut connection: Value,
) -> Option<MemoryEmbeddingContext> {
    let model = configured_embedding_model(&connection)?;
    if let Some(object) = connection.as_object_mut() {
        object.insert("model".to_string(), Value::String(model.clone()));
    }
    Some(MemoryEmbeddingContext {
        connection_id,
        connection,
        model,
    })
}

fn memory_embedding_context(state: &AppState, chat: &Value) -> Option<MemoryEmbeddingContext> {
    if let Some(connection_id) = chat
        .get("connectionId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if let Ok((embedding_connection_id, connection)) =
            prompts::resolve_embedding_connection_for_id(state, connection_id)
        {
            if let Some(context) =
                memory_embedding_context_from_connection(embedding_connection_id, connection)
            {
                return Some(context);
            }
        }
    }

    prompts::resolve_default_embedding_connection(state)
        .ok()
        .and_then(|(connection_id, connection)| {
            memory_embedding_context_from_connection(connection_id, connection)
        })
}

async fn embed_memory_content(
    context: Option<&MemoryEmbeddingContext>,
    content: &str,
) -> AppResult<MemoryEmbeddingResult> {
    let mut results = embed_memory_contents(context, &[content]).await?;
    results
        .pop()
        .ok_or_else(|| AppError::new("embedding_error", "Embedding provider returned no vectors"))
}

async fn embed_memory_contents(
    context: Option<&MemoryEmbeddingContext>,
    contents: &[&str],
) -> AppResult<Vec<MemoryEmbeddingResult>> {
    if let Some(context) = context {
        let embeddings =
            prompts::embed_texts(&context.connection, &context.model, contents).await?;
        if embeddings.len() != contents.len() {
            return Err(AppError::new(
                "embedding_error",
                "Embedding provider returned a mismatched vector count",
            ));
        }
        return Ok(embeddings
            .into_iter()
            .map(|embedding| MemoryEmbeddingResult {
                embedding,
                source: "provider",
                connection_id: Some(context.connection_id.clone()),
                model: Some(context.model.clone()),
            })
            .collect());
    }
    Ok(contents
        .iter()
        .map(|content| MemoryEmbeddingResult {
            embedding: lexical_memory_embedding(content),
            source: "lexical",
            connection_id: None,
            model: None,
        })
        .collect())
}

fn insert_memory_embedding_fields(memory: &mut Map<String, Value>, result: MemoryEmbeddingResult) {
    memory.insert("embedding".to_string(), json!(result.embedding));
    memory.insert("hasEmbedding".to_string(), json!(true));
    memory.insert("embeddingStatus".to_string(), json!("vectorized"));
    memory.insert("embeddingSource".to_string(), json!(result.source));
    if let Some(connection_id) = result.connection_id {
        memory.insert(
            "embeddingConnectionId".to_string(),
            Value::String(connection_id),
        );
    }
    if let Some(model) = result.model {
        memory.insert("embeddingModel".to_string(), Value::String(model));
    }
}

fn memory_has_numeric_embedding(memory: &Value) -> bool {
    memory
        .get("embedding")
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().any(Value::is_number))
}

fn memory_has_current_embedding(memory: &Value, context: Option<&MemoryEmbeddingContext>) -> bool {
    if !memory_has_numeric_embedding(memory) {
        return false;
    }
    match context {
        Some(context) => {
            memory.get("embeddingSource").and_then(Value::as_str) == Some("provider")
                && memory.get("embeddingConnectionId").and_then(Value::as_str)
                    == Some(context.connection_id.as_str())
                && memory.get("embeddingModel").and_then(Value::as_str)
                    == Some(context.model.as_str())
        }
        None => {
            memory.get("embeddingSource").and_then(Value::as_str) == Some("lexical")
                && memory
                    .get("embedding")
                    .and_then(Value::as_array)
                    .is_some_and(|items| items.len() == MEMORY_EMBEDDING_DIMS)
        }
    }
}

fn memory_message_ids(memory: &Value) -> Vec<String> {
    memory
        .get("messageIds")
        .and_then(Value::as_array)
        .map(|ids| {
            ids.iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|id| !id.is_empty())
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn memory_chunk_key(message_ids: &[String]) -> String {
    message_ids.join("\u{1f}")
}

fn reusable_chat_memory<'a>(
    existing: &'a HashMap<String, Value>,
    message_ids: &[String],
    content: &str,
    context: Option<&MemoryEmbeddingContext>,
) -> Option<&'a Value> {
    let memory = existing.get(&memory_chunk_key(message_ids))?;
    if memory.get("content").and_then(Value::as_str) != Some(content) {
        return None;
    }
    memory_has_current_embedding(memory, context).then_some(memory)
}

fn is_hidden_from_ai(message: &Value) -> bool {
    let extra = object_or_parse(message.get("extra"));
    ["hiddenFromAI", "hiddenFromAi"]
        .iter()
        .any(|key| extra.get(*key).and_then(Value::as_bool).unwrap_or(false))
}

fn active_swipe_index(message: &Value) -> i64 {
    swipe_index_value(message)
}

fn active_swipe_update_response(message: &Value) -> Value {
    let mut response = Map::new();
    for field in [
        "id",
        "content",
        "characterId",
        "activeSwipeIndex",
        "swipeCount",
        "extra",
        "updatedAt",
    ] {
        if let Some(value) = message.get(field) {
            response.insert(field.to_string(), value.clone());
        }
    }
    Value::Object(response)
}

fn prune_branch_summary_metadata(chat: &mut Value) {
    let Some(metadata) = chat.get_mut("metadata").and_then(Value::as_object_mut) else {
        return;
    };
    for key in ["summary", "summaryEntries", "daySummaries", "weekSummaries"] {
        metadata.remove(key);
    }
}

fn initialize_branch_display_name(chat: &mut Value) {
    let Some(object) = chat.as_object_mut() else {
        return;
    };
    let metadata = object
        .entry("metadata".to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !metadata.is_object() {
        *metadata = Value::Object(Map::new());
    }
    let Some(metadata) = metadata.as_object_mut() else {
        return;
    };
    metadata.insert(
        "branchName".to_string(),
        Value::String("New Branch".to_string()),
    );
}

fn object_extra(value: Option<&Value>) -> Option<Value> {
    json_object_value(value)
}

fn preserve_active_swipe_extra(swipes: &mut [Value], active_index: usize, extra: Option<Value>) {
    let Some(extra) = swipe_scoped_extra(extra.as_ref()) else {
        return;
    };
    let Some(Value::Object(swipe)) = swipes.get_mut(active_index) else {
        return;
    };
    let merged = merge_active_swipe_extra(swipe.get("extra"), extra);
    swipe.insert("extra".to_string(), merged);
}

fn should_activate_new_swipe(body: &Value) -> bool {
    if let Some(activate) = body.get("activate").and_then(Value::as_bool) {
        return activate;
    }
    !body.get("silent").and_then(Value::as_bool).unwrap_or(false)
}

fn owned_message_chat_id(message: &Value, route_chat_id: &str) -> AppResult<String> {
    let message_chat_id = message
        .get("chatId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .ok_or_else(|| AppError::invalid_input("Message is missing a chat id"))?;
    if message_chat_id != route_chat_id {
        return Err(AppError::invalid_input(
            "Message does not belong to the requested chat",
        ));
    }
    Ok(message_chat_id.to_string())
}

fn update_chat_metadata(
    state: &AppState,
    chat_id: &str,
    update: impl FnOnce(&mut Map<String, Value>),
) -> AppResult<Value> {
    let mut update = Some(update);
    state
        .storage
        .patch_if("chats", chat_id, |chat| {
            let mut metadata = metadata_map(&Value::Object(chat.clone()));
            let update = update.take().ok_or_else(|| {
                AppError::new("storage_error", "Chat metadata update already ran")
            })?;
            update(&mut metadata);
            chat.insert("metadata".to_string(), Value::Object(metadata));
            Ok(true)
        })?
        .ok_or_else(|| AppError::not_found(format!("chats/{chat_id} was not found")))
}

fn merge_chat_metadata(
    state: &AppState,
    chat_id: &str,
    patch: Map<String, Value>,
) -> AppResult<Value> {
    update_chat_metadata(state, chat_id, |metadata| {
        for (key, value) in patch {
            metadata.insert(key, value);
        }
    })
}

fn apply_deleted_swipe_tracker_cleanup_in_collections(
    collections: &mut [AtomicCollectionRows],
    chat_id: &str,
    message_id: &str,
    deleted_swipe_index: i64,
) -> AppResult<()> {
    let deleted_swipe_index = deleted_swipe_index.max(0);
    {
        let snapshots = collections
            .get_mut(3)
            .ok_or_else(|| AppError::new("storage_error", "Snapshot collection missing"))?
            .rows_mut();
        let mut retained = Vec::with_capacity(snapshots.len());
        for mut row in std::mem::take(snapshots) {
            if game_state_snapshots::row_matches_tracker_message(&row, chat_id, message_id) {
                let Some(swipe_index) = non_negative_i64_value(row.get("swipeIndex")) else {
                    retained.push(row);
                    continue;
                };
                if swipe_index == deleted_swipe_index {
                    continue;
                }
                if swipe_index > deleted_swipe_index {
                    if let Some(object) = row.as_object_mut() {
                        object.insert("swipeIndex".to_string(), json!(swipe_index - 1));
                    }
                }
            }
            retained.push(row);
        }
        #[cfg(test)]
        if retained.iter().any(|row| {
            row.get("id").and_then(Value::as_str) == Some("__fail_after_swipe_tracker_mutation__")
        }) {
            return Err(AppError::invalid_input(
                "injected swipe tracker cleanup failure",
            ));
        }
        *snapshots = retained;
    }

    let visible_tracker = {
        let messages = collections
            .first()
            .ok_or_else(|| AppError::new("storage_error", "Message collection missing"))?
            .rows();
        let snapshots = collections
            .get(3)
            .ok_or_else(|| AppError::new("storage_error", "Snapshot collection missing"))?
            .rows();
        game_state_snapshots::visible_tracker_snapshot_from_rows(messages, snapshots, chat_id)
            .unwrap_or(Value::Null)
    };
    let chat = collections
        .get_mut(2)
        .and_then(|collection| {
            collection
                .rows_mut()
                .iter_mut()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(chat_id))
        })
        .ok_or_else(|| AppError::not_found(format!("chats/{chat_id} was not found")))?;
    if let Some(object) = chat.as_object_mut() {
        object.insert("gameState".to_string(), visible_tracker);
    }
    Ok(())
}

fn replace_message_with_swipes_and_chat_cleanup(
    state: &AppState,
    chat_id: &str,
    message_id: &str,
    message: Value,
    swipes: Vec<Value>,
    prune_memories: bool,
    deleted_swipe_index: Option<i64>,
) -> AppResult<Value> {
    let mut updated = if prune_memories || deleted_swipe_index.is_some() {
        let mut extra_collections = vec!["chats"];
        if deleted_swipe_index.is_some() {
            extra_collections.push("game-state-snapshots");
        }
        message_swipe_storage::replace_message_with_swipes_and_update_collections(
            state,
            message,
            swipes,
            extra_collections,
            |collections, written_message| {
                if prune_memories {
                    apply_message_memory_invalidation_in_collections(
                        collections,
                        chat_id,
                        written_message,
                    )?;
                }
                if let Some(index) = deleted_swipe_index {
                    apply_deleted_swipe_tracker_cleanup_in_collections(
                        collections,
                        chat_id,
                        message_id,
                        index,
                    )?;
                }
                Ok(())
            },
        )?
    } else {
        message_swipe_storage::replace_message_with_swipes(state, message, swipes)?
    };
    message_swipe_storage::materialize_message(state, &mut updated, true)?;
    Ok(updated)
}

pub(crate) fn message_swipes(
    state: &AppState,
    _method: &str,
    chat_id: &str,
    message_id: &str,
    body: Value,
) -> AppResult<Value> {
    let mut message = get_required(state, "messages", message_id)?;
    message_swipe_storage::materialize_message(state, &mut message, true)?;
    let owner_chat_id = owned_message_chat_id(&message, chat_id)?;
    if body.is_null() {
        return Ok(message.get("swipes").cloned().unwrap_or_else(|| json!([])));
    }
    let content = body
        .get("content")
        .cloned()
        .unwrap_or_else(|| Value::String(String::new()));
    let content = match content {
        Value::String(content) => Value::String(collapse_excess_blank_lines(&content)),
        value => value,
    };
    let new_extra = object_extra(body.get("extra")).unwrap_or_else(|| json!({}));
    let object = message
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
    let current_content = object
        .get("content")
        .cloned()
        .unwrap_or_else(|| Value::String(String::new()));
    let previous_visible_content = current_content.as_str().unwrap_or("").to_string();
    let current_extra = object_extra(object.get("extra"));
    let current_character_id = object.get("characterId").cloned();
    let new_character_id = if body
        .as_object()
        .map(|body| body.contains_key("characterId"))
        .unwrap_or(false)
    {
        body.get("characterId").cloned()
    } else {
        current_character_id.clone()
    };
    let current_active_index = object
        .get("activeSwipeIndex")
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(0);
    let activate_new_swipe = should_activate_new_swipe(&body);
    let (active_index, swipe_count, active_content, active_extra, active_character_id) = {
        let swipes = object
            .entry("swipes".to_string())
            .or_insert_with(|| json!([]))
            .as_array_mut()
            .ok_or_else(|| AppError::invalid_input("Message swipes is not an array"))?;
        if swipes.is_empty() && !activate_new_swipe {
            let mut original_swipe = Map::new();
            original_swipe.insert("content".to_string(), current_content);
            original_swipe.insert("createdAt".to_string(), Value::String(now_iso()));
            if let Some(character_id) = current_character_id.clone() {
                original_swipe.insert("characterId".to_string(), character_id);
            }
            swipes.push(Value::Object(original_swipe));
        }
        let previous_swipe_count = swipes.len();
        if !swipes.is_empty() {
            let preserve_index = current_active_index.min(swipes.len().saturating_sub(1));
            preserve_active_swipe_extra(swipes, preserve_index, current_extra.clone());
            if let Some(Value::Object(swipe)) = swipes.get_mut(preserve_index) {
                if let Some(character_id) = current_character_id.clone() {
                    swipe
                        .entry("characterId".to_string())
                        .or_insert(character_id);
                }
            }
        }
        let mut new_swipe = Map::new();
        new_swipe.insert("content".to_string(), content);
        new_swipe.insert("createdAt".to_string(), Value::String(now_iso()));
        new_swipe.insert("extra".to_string(), new_extra);
        if let Some(character_id) = new_character_id {
            new_swipe.insert("characterId".to_string(), character_id);
        }
        swipes.push(Value::Object(new_swipe));
        let appended_index = swipes.len().saturating_sub(1);
        let active_index = if activate_new_swipe || previous_swipe_count == 0 {
            appended_index
        } else {
            current_active_index.min(previous_swipe_count.saturating_sub(1))
        };
        (
            active_index,
            swipes.len(),
            swipes[active_index]["content"].clone(),
            swipes[active_index]["extra"].clone(),
            swipes[active_index].get("characterId").cloned(),
        )
    };
    let visible_content_changed =
        active_content.as_str() != Some(previous_visible_content.as_str());
    object.insert("activeSwipeIndex".to_string(), json!(active_index));
    object.insert("swipeCount".to_string(), json!(swipe_count));
    object.insert("content".to_string(), active_content);
    object.insert(
        "extra".to_string(),
        merge_active_swipe_extra(object.get("extra"), active_extra),
    );
    if let Some(character_id) = active_character_id {
        object.insert("characterId".to_string(), character_id);
    }
    let swipes = message_swipe_storage::take_swipes_for_storage(&mut message)?.unwrap_or_default();
    let updated = replace_message_with_swipes_and_chat_cleanup(
        state,
        &owner_chat_id,
        message_id,
        message,
        swipes,
        visible_content_changed,
        None,
    )?;
    Ok(updated)
}

pub(crate) fn update_message_content_if_unchanged(
    state: &AppState,
    chat_id: &str,
    message_id: &str,
    expected_content: &str,
    content: &str,
) -> AppResult<Value> {
    let normalized_content = collapse_excess_blank_lines(content);
    let Some(mut message) =
        message_swipe_storage::update_message_content_if_current_and_update_collections(
            state,
            message_id,
            vec!["chats"],
            chat_id,
            expected_content,
            &normalized_content,
            |collections, written_message, visible_content_changed| {
                if visible_content_changed {
                    apply_message_memory_invalidation_in_collections(
                        collections,
                        chat_id,
                        written_message,
                    )?;
                }
                Ok(())
            },
        )?
    else {
        return Ok(json!({ "updated": false }));
    };
    message_swipe_storage::materialize_message(state, &mut message, true)?;
    Ok(json!({ "updated": true, "message": message }))
}

pub(crate) fn patch_message_update_with_memory_prune(
    state: &AppState,
    message_id: &str,
    patch: Value,
) -> AppResult<Value> {
    let normalized = normalize_update_patch("messages", patch)?;
    let patch_object = normalized.as_object().cloned().unwrap_or_default();
    let mut message = get_required(state, "messages", message_id)?;
    message_swipe_storage::materialize_message(state, &mut message, true)?;
    let previous_visible_content = message
        .get("content")
        .and_then(Value::as_str)
        .map(str::to_string);
    {
        let object = message
            .as_object_mut()
            .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
        for (key, value) in patch_object.clone() {
            object.insert(key, value);
        }
        sync_message_patch_content_to_active_swipe(object, &patch_object);
    }
    materialize_message_swipe_fields(&mut message);
    let next_visible_content = message
        .get("content")
        .and_then(Value::as_str)
        .map(str::to_string);
    let owner_chat_id = message
        .get("chatId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(ToOwned::to_owned);
    let swipes = message_swipe_storage::take_swipes_for_storage(&mut message)?.unwrap_or_default();
    if let Some(chat_id) = owner_chat_id {
        return replace_message_with_swipes_and_chat_cleanup(
            state,
            &chat_id,
            message_id,
            message,
            swipes,
            previous_visible_content != next_visible_content,
            None,
        );
    }
    let mut updated = message_swipe_storage::replace_message_with_swipes(state, message, swipes)?;
    message_swipe_storage::materialize_message(state, &mut updated, true)?;
    Ok(updated)
}

pub(crate) fn set_active_swipe(
    state: &AppState,
    chat_id: &str,
    message_id: &str,
    body: Value,
) -> AppResult<Value> {
    let requested_index = body
        .get("index")
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(0);
    let mut message = get_required(state, "messages", message_id)?;
    message_swipe_storage::materialize_message(state, &mut message, true)?;
    let owner_chat_id = owned_message_chat_id(&message, chat_id)?;
    let object = message
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
    let current_extra = object_extra(object.get("extra"));
    let current_active_index = object
        .get("activeSwipeIndex")
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(0);
    let previous_visible_content = object
        .get("content")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let Some((active_index, swipe_count, active_content, active_extra, active_character_id)) =
        object
            .get_mut("swipes")
            .and_then(Value::as_array_mut)
            .map(|swipes| {
                if swipes.is_empty() {
                    (0, 0, None, None, None)
                } else {
                    let preserve_index = current_active_index.min(swipes.len().saturating_sub(1));
                    preserve_active_swipe_extra(swipes, preserve_index, current_extra);
                    let active_index = requested_index.min(swipes.len().saturating_sub(1));
                    let active_swipe = swipes.get(active_index);
                    (
                        active_index,
                        swipes.len(),
                        active_swipe.and_then(|swipe| swipe.get("content")).cloned(),
                        active_swipe
                            .and_then(|swipe| swipe.get("extra"))
                            .filter(|extra| extra.is_object())
                            .cloned(),
                        active_swipe
                            .and_then(|swipe| swipe.get("characterId"))
                            .cloned(),
                    )
                }
            })
    else {
        let mut updated = state.storage.patch(
            "messages",
            message_id,
            json!({ "activeSwipeIndex": requested_index }),
        )?;
        materialize_message_swipe_fields(&mut updated);
        return Ok(active_swipe_update_response(&updated));
    };
    object.insert("activeSwipeIndex".to_string(), json!(active_index));
    object.insert("swipeCount".to_string(), json!(swipe_count));
    if let Some(content) = active_content {
        object.insert("content".to_string(), content);
    }
    if let Some(character_id) = active_character_id {
        object.insert("characterId".to_string(), character_id);
    }
    if let Some(extra) = active_extra {
        object.insert(
            "extra".to_string(),
            merge_active_swipe_extra(object.get("extra"), extra),
        );
    } else if swipe_count > 1 {
        object.insert(
            "extra".to_string(),
            clear_swipe_scoped_extra(object.get("extra")),
        );
    }
    let visible_content_changed =
        object.get("content").and_then(Value::as_str) != Some(previous_visible_content.as_str());
    let swipes = message_swipe_storage::take_swipes_for_storage(&mut message)?.unwrap_or_default();
    let updated = replace_message_with_swipes_and_chat_cleanup(
        state,
        &owner_chat_id,
        message_id,
        message,
        swipes,
        visible_content_changed,
        None,
    )?;
    Ok(active_swipe_update_response(&updated))
}

pub(crate) fn delete_swipe(
    state: &AppState,
    chat_id: &str,
    message_id: &str,
    index: &str,
) -> AppResult<Value> {
    let index = index
        .parse::<usize>()
        .map_err(|_| AppError::invalid_input("Invalid swipe index"))?;
    let mut message = get_required(state, "messages", message_id)?;
    message_swipe_storage::materialize_message(state, &mut message, true)?;
    let owner_chat_id = owned_message_chat_id(&message, chat_id)?;
    let previous_visible_content = message
        .get("content")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    {
        let object = message
            .as_object_mut()
            .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
        let current_active_index = object
            .get("activeSwipeIndex")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(0);
        let Some(swipes) = object.get_mut("swipes").and_then(Value::as_array_mut) else {
            return Err(AppError::invalid_input(
                "Cannot delete the last remaining swipe",
            ));
        };
        if swipes.len() <= 1 {
            return Err(AppError::invalid_input(
                "Cannot delete the last remaining swipe",
            ));
        }
        if index >= swipes.len() {
            return Err(AppError::not_found("Swipe not found"));
        }
        swipes.remove(index);
        let next_active_index = if current_active_index > index {
            current_active_index - 1
        } else if current_active_index == index {
            index.min(swipes.len().saturating_sub(1))
        } else {
            current_active_index.min(swipes.len().saturating_sub(1))
        };
        object.insert("activeSwipeIndex".to_string(), json!(next_active_index));
    }
    materialize_message_swipe_fields(&mut message);
    let visible_content_changed =
        message.get("content").and_then(Value::as_str) != Some(previous_visible_content.as_str());
    let swipes = message_swipe_storage::take_swipes_for_storage(&mut message)?.unwrap_or_default();
    let updated = replace_message_with_swipes_and_chat_cleanup(
        state,
        &owner_chat_id,
        message_id,
        message,
        swipes,
        visible_content_changed,
        Some(index as i64),
    )?;
    Ok(updated)
}

pub(crate) fn bulk_delete_messages(
    state: &AppState,
    chat_id: &str,
    body: Value,
) -> AppResult<Value> {
    let ids = body
        .get("messageIds")
        .and_then(Value::as_array)
        .ok_or_else(|| AppError::invalid_input("messageIds must be an array of strings"))?;
    if ids.iter().any(|id| !id.is_string()) {
        return Err(AppError::invalid_input(
            "messageIds must be an array of strings",
        ));
    }
    let mut deleted_messages = Vec::new();
    let requested_ids: Vec<&str> = ids
        .iter()
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .collect();
    if requested_ids.is_empty() {
        return Err(AppError::invalid_input(
            "Deleting messages requires at least one message",
        ));
    }
    for id in requested_ids {
        // Only delete messages that actually belong to this chat. Without the chatId check a
        // caller could pass message ids from another chat and destroy that chat's messages
        // (and their swipe sidecars) — the pre-scan must gate on parentage, not mere existence.
        if let Some(message) = state.storage.get("messages", id)? {
            if message.get("chatId").and_then(Value::as_str) == Some(chat_id) {
                deleted_messages.push(message);
            }
        }
    }
    deleted_messages.sort_by(|a, b| {
        let a_id = a.get("id").and_then(Value::as_str).unwrap_or("");
        let b_id = b.get("id").and_then(Value::as_str).unwrap_or("");
        a_id.cmp(b_id)
    });
    deleted_messages.dedup_by(|a, b| {
        a.get("id").and_then(Value::as_str) == b.get("id").and_then(Value::as_str)
    });
    let (deleted, _) = delete_message_rows_with_memory_prune(state, chat_id, &deleted_messages)?;
    Ok(json!({ "deleted": deleted }))
}

fn autonomous_unread_increment(body: &Value) -> AppResult<i64> {
    match body.get("count") {
        None | Some(Value::Null) => Ok(1),
        Some(value) => {
            let Some(count) = value.as_i64() else {
                return Err(AppError::invalid_input(
                    "Autonomous unread count must be an integer",
                ));
            };
            if !(1..=100).contains(&count) {
                return Err(AppError::invalid_input(
                    "Autonomous unread count must be between 1 and 100",
                ));
            }
            Ok(count)
        }
    }
}

fn autonomous_unread_character_id(body: &Value) -> AppResult<Option<String>> {
    match body.get("characterId") {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(id)) => {
            let id = id.trim();
            if id.is_empty() {
                return Err(AppError::invalid_input(
                    "Autonomous unread characterId must be non-empty",
                ));
            }
            Ok(Some(id.to_string()))
        }
        Some(_) => Err(AppError::invalid_input(
            "Autonomous unread characterId must be a string",
        )),
    }
}

fn current_autonomous_unread_count(metadata: &Map<String, Value>) -> i64 {
    metadata
        .get("autonomousUnreadCount")
        .and_then(Value::as_i64)
        .filter(|count| *count > 0)
        .unwrap_or(0)
}

fn current_autonomous_unread_character_ids(metadata: &Map<String, Value>) -> Vec<String> {
    let mut ids = Vec::new();
    let Some(values) = metadata
        .get("autonomousUnreadCharacterIds")
        .and_then(Value::as_array)
    else {
        return ids;
    };
    for value in values {
        let Some(id) = value.as_str().map(str::trim).filter(|id| !id.is_empty()) else {
            continue;
        };
        if !ids.iter().any(|existing| existing == id) {
            ids.push(id.to_string());
        }
    }
    ids
}

pub(crate) fn mark_autonomous_unread(
    state: &AppState,
    chat_id: &str,
    body: Value,
) -> AppResult<Value> {
    let increment = autonomous_unread_increment(&body)?;
    let character_id = autonomous_unread_character_id(&body)?;
    let timestamp = now_iso();
    update_chat_metadata(state, chat_id, |metadata| {
        let count = current_autonomous_unread_count(metadata).saturating_add(increment);
        let mut character_ids = current_autonomous_unread_character_ids(metadata);
        if let Some(id) = character_id {
            if !character_ids.iter().any(|existing| existing == &id) {
                character_ids.push(id);
            }
        }
        metadata.insert("autonomousUnreadCount".to_string(), json!(count));
        metadata.insert(
            "autonomousUnreadCharacterIds".to_string(),
            json!(character_ids),
        );
        metadata.insert("autonomousUnreadAt".to_string(), Value::String(timestamp));
    })
}

pub(crate) fn clear_autonomous_unread(state: &AppState, chat_id: &str) -> AppResult<Value> {
    let mut patch = Map::new();
    patch.insert("autonomousUnreadCount".to_string(), json!(0));
    patch.insert("autonomousUnreadCharacterIds".to_string(), json!([]));
    patch.insert("autonomousUnreadAt".to_string(), Value::Null);
    merge_chat_metadata(state, chat_id, patch)
}

pub(crate) fn chat_array_field(state: &AppState, chat_id: &str, field: &str) -> AppResult<Value> {
    let chat = get_required(state, "chats", chat_id)?;
    Ok(chat.get(field).cloned().unwrap_or_else(|| json!([])))
}

fn chat_memory_recency_key(memory: &Value) -> &str {
    chat_memory_timestamp(memory).unwrap_or("")
}

fn chat_memory_values(chat: &Value) -> Vec<Value> {
    match chat.get("memories") {
        Some(Value::Array(values)) => values.clone(),
        Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
            .ok()
            .and_then(|parsed| parsed.as_array().cloned())
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

fn chat_memory_values_for_mutation(chat: &Value) -> AppResult<Vec<Value>> {
    match chat.get("memories") {
        Some(Value::Array(values)) => Ok(values.clone()),
        Some(Value::String(raw)) => {
            let parsed = serde_json::from_str::<Value>(raw).map_err(|_| {
                AppError::invalid_input("Chat memories are not a valid serialized array")
            })?;
            match parsed {
                Value::Array(values) => Ok(values),
                _ => Err(AppError::invalid_input(
                    "Chat memories are not a valid serialized array",
                )),
            }
        }
        Some(Value::Null) | None => Ok(Vec::new()),
        _ => Err(AppError::invalid_input("Chat memories must be an array")),
    }
}

fn chat_memory_message_ids(memory: &Value) -> HashSet<String> {
    let mut ids = HashSet::new();
    if let Some(message_ids) = memory.get("messageIds").and_then(Value::as_array) {
        for value in message_ids {
            if let Some(id) = value
                .as_str()
                .map(str::trim)
                .filter(|value| !value.is_empty())
            {
                ids.insert(id.to_string());
            }
        }
    }
    for field in ["firstMessageId", "lastMessageId"] {
        if let Some(id) = memory
            .get(field)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            ids.insert(id.to_string());
        }
    }
    ids
}

fn chat_memory_timestamp(memory: &Value) -> Option<&str> {
    memory
        .get("lastMessageAt")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            memory
                .get("createdAt")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .or_else(|| {
            memory
                .get("firstMessageAt")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
}

fn memory_overlaps_deleted_messages(
    memory: &Value,
    deleted_ids: &HashSet<String>,
    deleted_start_at: Option<&str>,
) -> bool {
    let chunk_ids = chat_memory_message_ids(memory);
    if !chunk_ids.is_empty() && chunk_ids.iter().any(|id| deleted_ids.contains(id)) {
        return true;
    }
    let Some(deleted_start_at) = deleted_start_at else {
        return false;
    };
    chat_memory_timestamp(memory).is_some_and(|timestamp| timestamp >= deleted_start_at)
}

fn prune_chat_memory_values_for_deleted_messages(
    values: Vec<Value>,
    deleted_messages: &[Value],
) -> Option<Vec<Value>> {
    let deleted_ids = deleted_messages
        .iter()
        .filter_map(|message| message.get("id").and_then(Value::as_str))
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(ToOwned::to_owned)
        .collect::<HashSet<_>>();
    if deleted_ids.is_empty() {
        return None;
    }

    let deleted_start_at = deleted_messages
        .iter()
        .filter_map(|message| message.get("createdAt").and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .min();
    let original_len = values.len();
    let retained = values
        .into_iter()
        .filter(|memory| !memory_overlaps_deleted_messages(memory, &deleted_ids, deleted_start_at))
        .collect::<Vec<_>>();
    (retained.len() != original_len).then_some(retained)
}

pub(crate) fn delete_message_rows_with_memory_prune(
    state: &AppState,
    chat_id: &str,
    candidate_messages: &[Value],
) -> AppResult<(usize, Vec<String>)> {
    let requested_ids = candidate_messages
        .iter()
        .filter_map(|message| message.get("id").and_then(Value::as_str))
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(ToOwned::to_owned)
        .collect::<HashSet<_>>();
    if requested_ids.is_empty() {
        return Ok((0, Vec::new()));
    }

    let now = now_iso();
    state.storage.update_collections_atomically(
        vec![
            "messages",
            message_swipe_storage::COLLECTION,
            "chats",
            "game-state-snapshots",
        ],
        move |collections| {
            let messages = collections[0].rows_mut();
            let mut deleted_messages = Vec::new();
            messages.retain(|row| {
                let should_delete = row
                    .get("id")
                    .and_then(Value::as_str)
                    .is_some_and(|id| requested_ids.contains(id))
                    && row.get("chatId").and_then(Value::as_str) == Some(chat_id);
                if should_delete {
                    deleted_messages.push(row.clone());
                }
                !should_delete
            });

            let deleted_ids = deleted_messages
                .iter()
                .filter_map(|message| message.get("id").and_then(Value::as_str))
                .map(str::to_string)
                .collect::<HashSet<_>>();
            if deleted_ids.is_empty() {
                return Ok((0, Vec::new()));
            }

            let remaining_messages = messages.clone();
            collections[1].rows_mut().retain(|row| {
                row.get("messageId")
                    .and_then(Value::as_str)
                    .is_none_or(|message_id| !deleted_ids.contains(message_id))
            });

            let snapshots = collections[3].rows_mut();
            snapshots.retain(|row| {
                !deleted_ids.iter().any(|message_id| {
                    game_state_snapshots::row_matches_tracker_message(row, chat_id, message_id)
                })
            });
            let visible_tracker = game_state_snapshots::visible_tracker_snapshot_from_rows(
                &remaining_messages,
                snapshots,
                chat_id,
            )
            .unwrap_or(Value::Null);

            let Some(chat) = collections[2]
                .rows_mut()
                .iter_mut()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(chat_id))
            else {
                let mut ids = deleted_ids.into_iter().collect::<Vec<_>>();
                ids.sort();
                return Ok((deleted_messages.len(), ids));
            };
            let memories = chat_memory_values_for_mutation(chat)?;
            if let Some(retained) =
                prune_chat_memory_values_for_deleted_messages(memories, &deleted_messages)
            {
                #[cfg(test)]
                if retained.iter().any(|memory| {
                    memory.get("id").and_then(Value::as_str)
                        == Some("__fail_after_delete_mutation__")
                }) {
                    return Err(AppError::invalid_input(
                        "injected message delete cleanup failure",
                    ));
                }
                let object = chat
                    .as_object_mut()
                    .ok_or_else(|| AppError::invalid_input("Chat is not an object"))?;
                object.insert("memories".to_string(), Value::Array(retained));
            }
            if let Some(object) = chat.as_object_mut() {
                object.insert("lastMessageAt".to_string(), Value::String(now.clone()));
                object.insert("gameState".to_string(), visible_tracker);
            }

            let mut ids = deleted_ids.into_iter().collect::<Vec<_>>();
            ids.sort();
            Ok((deleted_messages.len(), ids))
        },
    )
}

fn memory_overlaps_excluded_recent(
    memory: &Value,
    recent_ids: &HashSet<String>,
    recent_start_at: &str,
) -> bool {
    if recent_ids.is_empty() {
        return false;
    }
    let chunk_ids = chat_memory_message_ids(memory);
    if !chunk_ids.is_empty() {
        return chunk_ids.iter().any(|id| recent_ids.contains(id));
    }

    memory
        .get("lastMessageAt")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some_and(|last_message_at| {
            !recent_start_at.is_empty() && last_message_at >= recent_start_at
        })
}

fn exclude_recent_chat_memories(
    values: Vec<Value>,
    exclude_recent_message_ids: &[String],
    exclude_recent_start_at: Option<&str>,
) -> Vec<Value> {
    let recent_ids = exclude_recent_message_ids
        .iter()
        .map(|id| id.trim())
        .filter(|id| !id.is_empty())
        .map(ToOwned::to_owned)
        .collect::<HashSet<_>>();
    let recent_start_at = exclude_recent_start_at.unwrap_or("").trim();
    if recent_ids.is_empty() {
        return values;
    }
    values
        .into_iter()
        .filter(|memory| !memory_overlaps_excluded_recent(memory, &recent_ids, recent_start_at))
        .collect()
}

fn memory_at_or_after_message(
    memory: &Value,
    message_ids: &HashSet<String>,
    created_at: &str,
) -> bool {
    if !message_ids.is_empty() {
        let chunk_ids = chat_memory_message_ids(memory);
        if chunk_ids.iter().any(|id| message_ids.contains(id)) {
            return true;
        }
    }

    chat_memory_timestamp(memory)
        .is_some_and(|timestamp| !created_at.is_empty() && timestamp >= created_at)
}

fn retained_chat_memories_after_message_change(
    chat: &Value,
    message_id: &str,
    created_at: &str,
) -> AppResult<Option<Vec<Value>>> {
    let values = chat_memory_values_for_mutation(chat)?;
    if values.is_empty() {
        return Ok(None);
    }
    let message_ids = message_id
        .trim()
        .is_empty()
        .then(HashSet::new)
        .unwrap_or_else(|| HashSet::from([message_id.trim().to_string()]));
    let before = values.len();
    let retained = values
        .into_iter()
        .filter(|memory| !memory_at_or_after_message(memory, &message_ids, created_at.trim()))
        .collect::<Vec<_>>();
    if retained.len() == before {
        return Ok(None);
    }
    #[cfg(test)]
    if retained.iter().any(|memory| {
        memory.get("id").and_then(Value::as_str) == Some("__fail_after_message_mutation__")
    }) {
        return Err(AppError::invalid_input(
            "injected message memory cleanup failure",
        ));
    }
    Ok(Some(retained))
}

fn apply_chat_memory_invalidation_from_message(chat: &mut Value, message: &Value) -> AppResult<()> {
    let message_id = message
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .unwrap_or("");
    let created_at = message
        .get("createdAt")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("");
    if let Some(retained) =
        retained_chat_memories_after_message_change(chat, message_id, created_at)?
    {
        let object = chat
            .as_object_mut()
            .ok_or_else(|| AppError::invalid_input("Chat is not an object"))?;
        object.insert("memories".to_string(), Value::Array(retained));
    }
    Ok(())
}

fn apply_message_memory_invalidation_in_collections(
    collections: &mut [AtomicCollectionRows],
    chat_id: &str,
    message: &Value,
) -> AppResult<()> {
    let Some(chat) = collections.get_mut(2).and_then(|collection| {
        collection
            .rows_mut()
            .iter_mut()
            .find(|row| row.get("id").and_then(Value::as_str) == Some(chat_id))
    }) else {
        return Ok(());
    };
    apply_chat_memory_invalidation_from_message(chat, message)
}

#[cfg(test)]
fn list_chat_memories(
    state: &AppState,
    chat_id: &str,
    limit: Option<usize>,
    order: Option<&str>,
) -> AppResult<Value> {
    list_chat_memories_excluding_recent(state, chat_id, limit, order, &[], None)
}

pub(crate) fn list_chat_memories_excluding_recent(
    state: &AppState,
    chat_id: &str,
    limit: Option<usize>,
    order: Option<&str>,
    exclude_recent_message_ids: &[String],
    exclude_recent_start_at: Option<&str>,
) -> AppResult<Value> {
    let chat = get_required(state, "chats", chat_id)?;
    let mut values = exclude_recent_chat_memories(
        chat_memory_values(&chat),
        exclude_recent_message_ids,
        exclude_recent_start_at,
    );

    match order
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("stored")
    {
        "stored" => {}
        "recent" => values.sort_by(|a, b| {
            chat_memory_recency_key(b)
                .cmp(chat_memory_recency_key(a))
                .then_with(|| {
                    let a_id = a.get("id").and_then(Value::as_str).unwrap_or("");
                    let b_id = b.get("id").and_then(Value::as_str).unwrap_or("");
                    b_id.cmp(a_id)
                })
        }),
        other => {
            return Err(AppError::invalid_input(format!(
                "Unsupported chat memory order: {other}"
            )));
        }
    }

    if let Some(limit) = limit {
        values.truncate(limit);
    }

    Ok(Value::Array(values))
}

pub(crate) fn set_chat_array_field(
    state: &AppState,
    chat_id: &str,
    field: &str,
    values: Vec<Value>,
) -> AppResult<Value> {
    state
        .storage
        .patch("chats", chat_id, json!({ field: values }))
}

fn chat_connected_note_values(chat: &Value) -> Vec<Value> {
    match chat.get("notes") {
        Some(Value::Array(values)) => values.clone(),
        Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
            .ok()
            .and_then(|parsed| parsed.as_array().cloned())
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

fn string_field(value: &Value, field: &str) -> Option<String> {
    value
        .get(field)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn connected_note_belongs_to_pair(
    note: &Value,
    chat_id: &str,
    partner_ids: &HashSet<String>,
) -> bool {
    let note_type = note.get("type").and_then(Value::as_str).unwrap_or("");
    if note_type != "note" && note_type != "influence" {
        return false;
    }
    let Some(source_chat_id) = string_field(note, "sourceChatId") else {
        return false;
    };
    let Some(target_chat_id) = string_field(note, "targetChatId") else {
        return false;
    };
    (source_chat_id == chat_id && partner_ids.contains(&target_chat_id))
        || (target_chat_id == chat_id && partner_ids.contains(&source_chat_id))
}

pub(crate) fn disconnect_connected_chat(state: &AppState, chat_id: &str) -> AppResult<Value> {
    let chat_id = chat_id.trim();
    state
        .storage
        .update_collections_atomically(vec!["chats"], move |collections| {
            let chats = collections[0].rows_mut();
            let requested_chat = chats
                .iter()
                .find(|chat| chat.get("id").and_then(Value::as_str) == Some(chat_id))
                .ok_or_else(|| AppError::not_found(format!("chats/{chat_id} was not found")))?;

            let mut note_partner_ids = HashSet::new();
            let mut link_partner_ids = HashSet::new();
            if let Some(connected_chat_id) = string_field(requested_chat, "connectedChatId") {
                note_partner_ids.insert(connected_chat_id);
            }

            for chat in chats.iter() {
                let Some(id) = string_field(chat, "id") else {
                    continue;
                };
                if string_field(chat, "connectedChatId").as_deref() == Some(chat_id) {
                    note_partner_ids.insert(id.clone());
                    link_partner_ids.insert(id);
                }
            }

            let mut link_clear_chat_ids = link_partner_ids.clone();
            link_clear_chat_ids.insert(chat_id.to_string());
            let mut affected_chat_ids = link_clear_chat_ids.iter().cloned().collect::<Vec<_>>();
            affected_chat_ids.sort();
            let now = now_iso();

            for chat in chats.iter_mut() {
                let Some(id) = string_field(chat, "id") else {
                    continue;
                };
                let Some(object) = chat.as_object_mut() else {
                    return Err(AppError::invalid_input(
                        "Stored chat record is not an object",
                    ));
                };
                if link_clear_chat_ids.contains(&id) {
                    object.insert("connectedChatId".to_string(), Value::Null);
                    object.insert("updatedAt".to_string(), Value::String(now.clone()));
                }
            }

            for chat in chats.iter_mut() {
                let Some(id) = string_field(chat, "id") else {
                    continue;
                };
                let notes = chat_connected_note_values(chat);
                if notes.is_empty() {
                    continue;
                }
                let before_len = notes.len();
                let next_notes = notes
                    .into_iter()
                    .filter(|note| {
                        !connected_note_belongs_to_pair(note, chat_id, &note_partner_ids)
                    })
                    .collect::<Vec<_>>();
                if next_notes.len() != before_len {
                    let Some(object) = chat.as_object_mut() else {
                        return Err(AppError::invalid_input(
                            "Stored chat record is not an object",
                        ));
                    };
                    object.insert("notes".to_string(), Value::Array(next_notes));
                    object.insert("updatedAt".to_string(), Value::String(now.clone()));
                    if !affected_chat_ids
                        .iter()
                        .any(|affected_id| affected_id == &id)
                    {
                        affected_chat_ids.push(id);
                    }
                }
            }

            affected_chat_ids.sort();
            affected_chat_ids.dedup();
            Ok(json!({
                "disconnected": true,
                "chatIds": affected_chat_ids,
            }))
        })
}

pub(crate) fn delete_chat_array_item(
    state: &AppState,
    chat_id: &str,
    field: &str,
    item_id: &str,
) -> AppResult<Value> {
    let chat = get_required(state, "chats", chat_id)?;
    let values = chat
        .get(field)
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|item| item.get("id").and_then(Value::as_str) != Some(item_id))
        .collect::<Vec<_>>();
    set_chat_array_field(state, chat_id, field, values)
}

pub(crate) fn delete_chat_memory(
    state: &AppState,
    chat_id: &str,
    memory_id: &str,
) -> AppResult<Value> {
    let chat = get_required(state, "chats", chat_id)?;
    let values = chat_memory_values_for_mutation(&chat)?
        .into_iter()
        .filter(|item| item.get("id").and_then(Value::as_str) != Some(memory_id))
        .collect::<Vec<_>>();
    set_chat_array_field(state, chat_id, "memories", values)
}

pub(crate) async fn refresh_chat_memories(state: &AppState, chat_id: &str) -> AppResult<Value> {
    let chat = get_required(state, "chats", chat_id)?;
    let embedding_context = memory_embedding_context(state, &chat);
    let existing_memories = chat_memory_values_for_mutation(&chat)?;
    let existing_by_chunk = existing_memories
        .into_iter()
        .filter_map(|memory| {
            let ids = memory_message_ids(&memory);
            if ids.is_empty() {
                None
            } else {
                Some((memory_chunk_key(&ids), memory))
            }
        })
        .collect::<HashMap<_, _>>();
    let visible_messages = messages_for_chat(state, chat_id)?
        .into_iter()
        .filter(|message| !is_hidden_from_ai(message) && !message_content(message).is_empty())
        .collect::<Vec<_>>();
    let now = now_iso();
    let mut chunks: Vec<Value> = Vec::new();
    let mut pending = Vec::new();
    let mut reused = 0usize;
    for chunk in visible_messages.chunks(MEMORY_CHUNK_SIZE) {
        if chunk.len() < MEMORY_CHUNK_SIZE {
            continue;
        }
        let content = chunk
            .iter()
            .map(|message| {
                let role = message
                    .get("role")
                    .and_then(Value::as_str)
                    .unwrap_or("message");
                format!("{role}: {}", message_content(message))
            })
            .collect::<Vec<_>>()
            .join("\n");
        let mut memory = Map::new();
        let message_ids = chunk
            .iter()
            .filter_map(|message| message.get("id").and_then(Value::as_str))
            .filter(|id| !id.trim().is_empty())
            .map(str::to_string)
            .collect::<Vec<_>>();
        if let Some(memory) = reusable_chat_memory(
            &existing_by_chunk,
            &message_ids,
            &content,
            embedding_context.as_ref(),
        ) {
            chunks.push(memory.clone());
            reused += 1;
            continue;
        }
        memory.insert("id".to_string(), Value::String(new_id()));
        memory.insert("chatId".to_string(), Value::String(chat_id.to_string()));
        memory.insert("content".to_string(), Value::String(content.clone()));
        memory.insert("messageCount".to_string(), json!(chunk.len()));
        memory.insert("messageIds".to_string(), json!(message_ids));
        memory.insert(
            "firstMessageId".to_string(),
            chunk
                .first()
                .and_then(|message| message.get("id"))
                .cloned()
                .unwrap_or(Value::Null),
        );
        memory.insert(
            "lastMessageId".to_string(),
            chunk
                .last()
                .and_then(|message| message.get("id"))
                .cloned()
                .unwrap_or(Value::Null),
        );
        memory.insert(
            "firstMessageAt".to_string(),
            chunk
                .first()
                .and_then(|message| message.get("createdAt"))
                .cloned()
                .unwrap_or(Value::Null),
        );
        memory.insert(
            "lastMessageAt".to_string(),
            chunk
                .last()
                .and_then(|message| message.get("createdAt"))
                .cloned()
                .unwrap_or(Value::Null),
        );
        memory.insert("createdAt".to_string(), Value::String(now.clone()));
        pending.push((chunks.len(), content, memory));
        chunks.push(Value::Null);
    }
    let embedded = pending.len();
    if !pending.is_empty() {
        let texts = pending
            .iter()
            .map(|(_, content, _)| content.as_str())
            .collect::<Vec<_>>();
        let embeddings = embed_memory_contents(embedding_context.as_ref(), &texts).await?;
        for ((index, _, mut memory), embedding) in pending.into_iter().zip(embeddings) {
            insert_memory_embedding_fields(&mut memory, embedding);
            chunks[index] = Value::Object(memory);
        }
    }
    state
        .storage
        .patch("chats", chat_id, json!({ "memories": chunks }))?;
    Ok(json!({ "rebuilt": chunks.len(), "embedded": embedded, "reused": reused, "chunks": chunks }))
}

pub(crate) fn export_chat_memories(state: &AppState, chat_id: &str) -> AppResult<Value> {
    let chat = get_required(state, "chats", chat_id)?;
    let memories = chat_array_field(state, chat_id, "memories")?;
    let memory_count = memories.as_array().map(Vec::len).unwrap_or(0);
    Ok(json!({
        "type": "marinara_memory_recall",
        "version": 1,
        "exportedAt": now_iso(),
        "data": {
            "sourceChat": {
                "id": chat_id,
                "name": chat.get("name").and_then(Value::as_str).unwrap_or("Untitled Chat"),
                "mode": chat.get("mode").and_then(Value::as_str).unwrap_or("conversation"),
                "memoryCount": memory_count
            },
            "chunks": memories
        }
    }))
}

pub(crate) async fn import_chat_memories(
    state: &AppState,
    chat_id: &str,
    body: Value,
) -> AppResult<Value> {
    let chat = get_required(state, "chats", chat_id)?;
    let embedding_context = memory_embedding_context(state, &chat);
    let incoming = body
        .get("data")
        .and_then(|data| data.get("chunks"))
        .or_else(|| body.get("chunks"))
        .and_then(Value::as_array)
        .ok_or_else(|| {
            AppError::invalid_input("Memory Recall import must contain a data.chunks array")
        })?;
    let mut memories = chat_array_field(state, chat_id, "memories")?
        .as_array()
        .cloned()
        .unwrap_or_default();
    let mut seen = memories
        .iter()
        .filter_map(|memory| {
            memory
                .get("content")
                .and_then(Value::as_str)
                .map(|content| content.trim().to_string())
        })
        .collect::<std::collections::HashSet<_>>();
    let now = now_iso();
    let mut imported = 0usize;
    let mut skipped = 0usize;
    for value in incoming {
        let Some(content) = value.get("content").and_then(Value::as_str).map(str::trim) else {
            skipped += 1;
            continue;
        };
        if content.is_empty() || !seen.insert(content.to_string()) {
            skipped += 1;
            continue;
        }
        let mut memory = value.as_object().cloned().unwrap_or_default();
        memory.insert(
            "id".to_string(),
            memory
                .get("id")
                .and_then(Value::as_str)
                .filter(|id| !id.trim().is_empty())
                .map(|id| Value::String(id.to_string()))
                .unwrap_or_else(|| Value::String(new_id())),
        );
        memory.insert("chatId".to_string(), Value::String(chat_id.to_string()));
        memory.insert("content".to_string(), Value::String(content.to_string()));
        memory
            .entry("createdAt".to_string())
            .or_insert_with(|| Value::String(now.clone()));
        memory
            .entry("messageCount".to_string())
            .or_insert_with(|| json!(1));
        let has_embedding = memory
            .get("embedding")
            .and_then(Value::as_array)
            .is_some_and(|items| items.iter().any(Value::is_number));
        if !has_embedding {
            insert_memory_embedding_fields(
                &mut memory,
                embed_memory_content(embedding_context.as_ref(), content).await?,
            );
        } else {
            memory.insert("hasEmbedding".to_string(), json!(true));
            memory.insert("embeddingStatus".to_string(), json!("vectorized"));
        }
        memories.push(Value::Object(memory));
        imported += 1;
    }
    set_chat_array_field(state, chat_id, "memories", memories)?;
    Ok(json!({ "imported": imported, "skipped": skipped }))
}

pub(crate) fn delete_chat_group(state: &AppState, group_id: &str) -> AppResult<Value> {
    let chats = match list_collection(state, "chats", Some(("groupId", group_id)))? {
        Value::Array(rows) => rows,
        _ => Vec::new(),
    };
    let mut deleted = 0;
    let mut deleted_chat_ids = Vec::new();
    for chat in chats {
        if let Some(id) = chat.get("id").and_then(Value::as_str) {
            if is_protected_record("chats", id) {
                continue;
            }
            let chat_delete_ids = delete_chat_with_messages(state, id)?;
            if chat_delete_ids.iter().any(|deleted_id| deleted_id == id) {
                deleted += 1;
            }
            deleted_chat_ids.extend(chat_delete_ids);
        }
    }
    deleted_chat_ids.sort_unstable();
    deleted_chat_ids.dedup();
    Ok(json!({ "deleted": deleted, "deletedChatIds": deleted_chat_ids }))
}

pub(crate) fn branch_chat(state: &AppState, chat_id: &str, body: Value) -> AppResult<Value> {
    let mut chat = get_required(state, "chats", chat_id)?;
    let new_chat_id = new_id();
    let object = chat
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Chat is not an object"))?;
    let base_name = object
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Chat")
        .to_string();
    let source_group_id = object
        .get("groupId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let group_id = source_group_id
        .clone()
        .unwrap_or_else(|| chat_id.to_string());
    object.insert("id".to_string(), Value::String(new_chat_id.clone()));
    object.insert("name".to_string(), Value::String(base_name));
    object.insert("groupId".to_string(), Value::String(group_id.clone()));
    object.insert("connectedChatId".to_string(), Value::Null);
    prune_branch_summary_metadata(&mut chat);
    initialize_branch_display_name(&mut chat);
    let source_has_tracker_snapshots =
        game_state_snapshots::latest_tracker_snapshot(state, chat_id)?.is_some();
    let mut new_chat = state.storage.create("chats", chat)?;
    // The first branch turns the source chat into a group root. Enroll the
    // source chat into the new group too, otherwise it keeps `groupId: null`
    // and Manage Chat Files / the branch selector (which key off the active
    // chat's groupId) cannot discover the branches when opened from the
    // original chat. This mirrors the intent of the ST-chat-into-group import
    // path (promote the root into the group); it does not copy that path's
    // patch-then-rollback ordering. The branch is created first on purpose: if
    // this enroll patch fails, the state is exactly the pre-fix one (branch
    // grouped, root ungrouped) which a later branch attempt re-converges,
    // rather than leaving a root enrolled in a group that has no branches.
    if source_group_id.is_none() {
        state
            .storage
            .patch("chats", chat_id, json!({ "groupId": group_id }))?;
    }
    let up_to = body.get("upToMessageId").and_then(Value::as_str);
    let mut visible_tracker_target: Option<(String, i64)> = None;
    for mut message in messages_for_chat(state, chat_id)? {
        let source_message_id = message
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .map(ToOwned::to_owned);
        let source_role = message
            .get("role")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned);
        let stop = up_to.is_some_and(|id| message.get("id").and_then(Value::as_str) == Some(id));
        if let Some(obj) = message.as_object_mut() {
            obj.remove("id");
            obj.insert("chatId".to_string(), Value::String(new_chat_id.clone()));
        }
        let created = message_swipe_storage::create_message(state, message)?;
        let target_message_id = created
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .map(ToOwned::to_owned);
        if let (Some(source_message_id), Some(target_message_id)) =
            (source_message_id, target_message_id)
        {
            game_state_snapshots::copy_tracker_snapshots_for_message(
                state,
                chat_id,
                &new_chat_id,
                &source_message_id,
                &target_message_id,
            )?;
            if source_role.as_deref() == Some("assistant") {
                let swipe_index = active_swipe_index(&created);
                if game_state_snapshots::tracker_snapshot_for_target(
                    state,
                    &new_chat_id,
                    &target_message_id,
                    swipe_index,
                )?
                .is_some()
                {
                    visible_tracker_target = Some((target_message_id, swipe_index));
                }
            }
        }
        if stop {
            break;
        }
    }
    if source_has_tracker_snapshots {
        if let Some((message_id, swipe_index)) = visible_tracker_target {
            let visible_game_state = game_state_snapshots::tracker_snapshot_for_target(
                state,
                &new_chat_id,
                &message_id,
                swipe_index,
            )?
            .unwrap_or(Value::Null);
            new_chat = state.storage.patch(
                "chats",
                &new_chat_id,
                json!({ "gameState": visible_game_state }),
            )?;
        } else if let Some(bootstrap_game_state) =
            game_state_snapshots::copy_bootstrap_tracker_snapshot(state, chat_id, &new_chat_id)?
        {
            new_chat = state.storage.patch(
                "chats",
                &new_chat_id,
                json!({ "gameState": bootstrap_game_state }),
            )?;
        } else if !chat_game_state_is_bootstrap(&new_chat) {
            new_chat =
                state
                    .storage
                    .patch("chats", &new_chat_id, json!({ "gameState": Value::Null }))?;
        }
    }
    Ok(new_chat)
}

pub(crate) fn delete_chat_with_messages(state: &AppState, chat_id: &str) -> AppResult<Vec<String>> {
    if is_protected_record("chats", chat_id) {
        return Err(AppError::invalid_input(
            "Protected records cannot be deleted",
        ));
    }
    let Some(root_chat) = state.storage.get("chats", chat_id)? else {
        return Ok(Vec::new());
    };
    let owned_scene_chat_ids = scene_delete_scope(state, chat_id, &root_chat)?;
    clear_character_scene_memories(state, &owned_scene_chat_ids)?;
    clear_deleted_scene_references(state, chat_id, &owned_scene_chat_ids)?;

    let mut delete_ids = owned_scene_chat_ids.clone();
    delete_ids.push(chat_id.to_string());
    delete_ids.sort_unstable();
    delete_ids.dedup();

    game_state_snapshots::delete_tracker_snapshots_for_chats(state, &delete_ids)?;
    let delete_id_set = delete_ids.iter().cloned().collect::<HashSet<_>>();
    delete_gallery_for_chats(state, &delete_id_set)?;
    // NPC avatars live inline in chat metadata (gameNpcs / presentCharacters), not as
    // tracked records, so they have no managed-file cleanup hook. Best-effort prefix scan
    // of avatars/npc by deleted chat id (mirrors delete_gallery_for_chats) to avoid orphans.
    super::avatars::remove_npc_avatar_files_for_chats(state, &delete_id_set);
    message_swipe_storage::delete_message_rows_for_chats_with_swipes(state, &delete_id_set)?;
    for delete_id in &delete_ids {
        agents::delete_agent_bookkeeping_for_chat(state, delete_id)?;
    }

    for delete_id in &delete_ids {
        state.storage.delete("chats", delete_id)?;
    }
    Ok(delete_ids)
}

fn delete_gallery_for_chats(state: &AppState, chat_ids: &HashSet<String>) -> AppResult<usize> {
    if chat_ids.is_empty() {
        return Ok(0);
    }
    let rows = state.storage.list("gallery")?;
    for row in rows.iter().filter(|row| {
        row.get("chatId")
            .and_then(Value::as_str)
            .is_some_and(|chat_id| chat_ids.contains(chat_id))
    }) {
        remove_managed_record_file(state, "gallery", row, "filePath", "filename");
    }
    state.storage.delete_where_matching("gallery", |row| {
        row.get("chatId")
            .and_then(Value::as_str)
            .is_some_and(|chat_id| chat_ids.contains(chat_id))
    })
}

fn chat_game_state_is_bootstrap(chat: &Value) -> bool {
    chat.get("gameState")
        .and_then(Value::as_object)
        .and_then(|game_state| game_state.get("messageId"))
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
}

fn scene_delete_scope(
    state: &AppState,
    chat_id: &str,
    root_chat: &Value,
) -> AppResult<Vec<String>> {
    let mut delete_ids = std::collections::BTreeSet::new();

    let meta = metadata_map(root_chat);
    if meta
        .get("sceneOriginChatId")
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|origin_id| !origin_id.is_empty())
    {
        delete_ids.insert(chat_id.to_string());
    }
    insert_owned_scene_chat_id(
        state,
        &mut delete_ids,
        chat_id,
        meta.get("activeSceneChatId"),
    )?;
    let mut has_declared_scene_children = meta
        .get("activeSceneChatId")
        .and_then(Value::as_str)
        .map(str::trim)
        .is_some_and(|id| !id.is_empty());
    if let Some(history) = meta.get("roleplaySceneHistory").and_then(Value::as_array) {
        has_declared_scene_children = has_declared_scene_children || !history.is_empty();
        for entry in history {
            let record = object_or_parse(Some(entry));
            insert_owned_scene_chat_id(state, &mut delete_ids, chat_id, record.get("sceneChatId"))?;
        }
    }
    if !has_declared_scene_children {
        return Ok(delete_ids.into_iter().collect());
    }

    for chat in state.storage.list("chats")? {
        let meta = metadata_map(&chat);
        if meta
            .get("sceneOriginChatId")
            .and_then(Value::as_str)
            .map(str::trim)
            == Some(chat_id)
        {
            if let Some(id) = chat.get("id").and_then(Value::as_str) {
                delete_ids.insert(id.to_string());
            }
        }
    }

    Ok(delete_ids.into_iter().collect())
}

fn insert_owned_scene_chat_id(
    state: &AppState,
    ids: &mut std::collections::BTreeSet<String>,
    origin_chat_id: &str,
    value: Option<&Value>,
) -> AppResult<()> {
    let Some(id) = value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|id| !id.is_empty())
    else {
        return Ok(());
    };
    let Some(chat) = state.storage.get("chats", id)? else {
        return Ok(());
    };
    let meta = metadata_map(&chat);
    if meta
        .get("sceneOriginChatId")
        .and_then(Value::as_str)
        .map(str::trim)
        == Some(origin_chat_id)
    {
        ids.insert(id.to_string());
    }
    Ok(())
}

fn clear_character_scene_memories(state: &AppState, scene_chat_ids: &[String]) -> AppResult<()> {
    if scene_chat_ids.is_empty() {
        return Ok(());
    }
    let scene_ids = scene_chat_ids
        .iter()
        .map(String::as_str)
        .collect::<std::collections::BTreeSet<_>>();
    for character in state.storage.list("characters")? {
        let Some(character_id) = character.get("id").and_then(Value::as_str) else {
            continue;
        };
        let mut data = object_or_parse(character.get("data"));
        let mut extensions = object_or_parse(data.get("extensions"));
        let Some(memories) = extensions
            .get("characterMemories")
            .and_then(Value::as_array)
        else {
            continue;
        };
        let retained = memories
            .iter()
            .filter(|memory| {
                object_or_parse(Some(memory))
                    .get("sceneChatId")
                    .and_then(Value::as_str)
                    .is_none_or(|scene_chat_id| !scene_ids.contains(scene_chat_id))
            })
            .cloned()
            .collect::<Vec<_>>();
        if retained.len() == memories.len() {
            continue;
        }
        extensions.insert("characterMemories".to_string(), Value::Array(retained));
        data.insert("extensions".to_string(), Value::Object(extensions));
        state
            .storage
            .patch("characters", character_id, json!({ "data": data }))?;
    }
    Ok(())
}

fn clear_deleted_scene_references(
    state: &AppState,
    deleted_chat_id: &str,
    scene_chat_ids: &[String],
) -> AppResult<()> {
    if scene_chat_ids.is_empty() {
        return Ok(());
    }
    let scene_ids = scene_chat_ids
        .iter()
        .map(String::as_str)
        .collect::<std::collections::BTreeSet<_>>();
    for scene_id in scene_chat_ids {
        let Some(scene_chat) = state.storage.get("chats", scene_id)? else {
            continue;
        };
        let origin_id = metadata_map(&scene_chat)
            .get("sceneOriginChatId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|id| !id.is_empty() && *id != deleted_chat_id)
            .map(str::to_string);
        let Some(origin_id) = origin_id else {
            continue;
        };
        let Some(origin_chat) = state.storage.get("chats", &origin_id)? else {
            continue;
        };
        let mut meta = metadata_map(&origin_chat);
        if meta
            .get("activeSceneChatId")
            .and_then(Value::as_str)
            .is_some_and(|id| scene_ids.contains(id))
        {
            meta.insert("activeSceneChatId".to_string(), Value::Null);
            meta.insert("sceneBusyCharIds".to_string(), Value::Null);
        }
        if let Some(history) = meta.get("roleplaySceneHistory").and_then(Value::as_array) {
            let retained = history
                .iter()
                .filter(|entry| {
                    object_or_parse(Some(entry))
                        .get("sceneChatId")
                        .and_then(Value::as_str)
                        .is_none_or(|scene_chat_id| !scene_ids.contains(scene_chat_id))
                })
                .cloned()
                .collect::<Vec<_>>();
            if retained.len() != history.len() {
                let next_summary = retained
                    .last()
                    .and_then(|entry| {
                        object_or_parse(Some(entry))
                            .get("summary")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                    })
                    .filter(|summary| !summary.trim().is_empty());
                meta.insert("roleplaySceneHistory".to_string(), Value::Array(retained));
                meta.insert(
                    "lastRoleplaySceneSummary".to_string(),
                    next_summary.map(Value::String).unwrap_or(Value::Null),
                );
            }
        }
        let mut patch = Map::new();
        patch.insert("metadata".to_string(), Value::Object(meta));
        if origin_chat
            .get("connectedChatId")
            .and_then(Value::as_str)
            .is_some_and(|id| scene_ids.contains(id))
        {
            patch.insert("connectedChatId".to_string(), Value::Null);
        }
        state
            .storage
            .patch("chats", &origin_id, Value::Object(patch))?;
    }
    Ok(())
}

fn object_or_parse(value: Option<&Value>) -> Map<String, Value> {
    match value {
        Some(Value::Object(object)) => object.clone(),
        Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use std::sync::{Arc, Barrier};
    use std::thread;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-chat-delete-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp chat delete dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn memory_ids(value: &Value) -> Vec<String> {
        value
            .as_array()
            .expect("memory list should be an array")
            .iter()
            .filter_map(|memory| {
                memory
                    .get("id")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
            })
            .collect()
    }

    fn seed_memory_cleanup_failure_chat(
        state: &AppState,
        content: &str,
        active_swipe_index: usize,
        swipes: Value,
    ) {
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory failure chat",
                    "memories": [
                        {
                            "id": "keep-before",
                            "messageIds": ["message-before"],
                            "lastMessageAt": "2026-06-01T09:00:00.000Z"
                        },
                        {
                            "id": "__fail_after_message_mutation__",
                            "messageIds": ["message-before"],
                            "lastMessageAt": "2026-06-01T09:30:00.000Z"
                        },
                        {
                            "id": "drop-edited",
                            "messageIds": ["message-1"],
                            "lastMessageAt": "2026-06-01T10:00:00.000Z"
                        },
                        {
                            "id": "drop-newer",
                            "lastMessageAt": "2026-06-01T10:01:00.000Z"
                        }
                    ]
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": content,
                "createdAt": "2026-06-01T10:00:00.000Z",
                "activeSwipeIndex": active_swipe_index,
                "swipes": swipes
            }),
        )
        .expect("message should seed");
    }

    fn stored_chat(state: &AppState) -> Value {
        state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist")
    }

    fn stored_message(state: &AppState) -> Value {
        state
            .storage
            .get("messages", "message-1")
            .expect("message should read")
            .expect("message should exist")
    }

    fn memory_cleanup_failure_ids() -> Vec<String> {
        vec![
            "keep-before".to_string(),
            "__fail_after_message_mutation__".to_string(),
            "drop-edited".to_string(),
            "drop-newer".to_string(),
        ]
    }

    #[test]
    fn list_chat_memories_accepts_string_serialized_chunks() {
        let state = test_state("chat-memory-list-string");
        let memories = serde_json::to_string(&json!([
            { "id": "stored-old", "lastMessageAt": "2026-01-01T00:00:00.000Z" },
            { "id": "stored-new", "lastMessageAt": "2026-01-02T00:00:00.000Z" }
        ]))
        .expect("memory fixture should serialize");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Serialized memory chat",
                    "memories": memories
                }),
            )
            .expect("chat should be created");

        let stored = list_chat_memories(&state, "chat-1", None, None)
            .expect("serialized memories should list in stored order");
        assert_eq!(memory_ids(&stored), vec!["stored-old", "stored-new"]);

        let recent = list_chat_memories(&state, "chat-1", Some(1), Some("recent"))
            .expect("serialized memories should sort by recency");
        assert_eq!(memory_ids(&recent), vec!["stored-new"]);
    }

    #[test]
    fn delete_chat_memory_preserves_serialized_non_target_chunks() {
        let state = test_state("chat-memory-delete-serialized");
        let memories = serde_json::to_string(&json!([
            { "id": "delete-me", "lastMessageAt": "2026-01-01T00:00:00.000Z" },
            { "id": "keep-me", "lastMessageAt": "2026-01-02T00:00:00.000Z" }
        ]))
        .expect("memory fixture should serialize");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Serialized memory delete chat",
                    "memories": memories
                }),
            )
            .expect("chat should be created");

        let listed = list_chat_memories(&state, "chat-1", None, None)
            .expect("serialized memories should be visible before deletion");
        assert_eq!(memory_ids(&listed), vec!["delete-me", "keep-me"]);

        delete_chat_memory(&state, "chat-1", "delete-me")
            .expect("serialized memory deletion should preserve non-target chunks");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        assert_eq!(memory_ids(&chat["memories"]), vec!["keep-me"]);
    }

    #[test]
    fn delete_chat_memory_preserves_array_non_target_chunks() {
        let state = test_state("chat-memory-delete-array");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Array memory delete chat",
                    "memories": [
                        { "id": "delete-me", "lastMessageAt": "2026-01-01T00:00:00.000Z" },
                        { "id": "keep-me", "lastMessageAt": "2026-01-02T00:00:00.000Z" }
                    ]
                }),
            )
            .expect("chat should be created");

        delete_chat_memory(&state, "chat-1", "delete-me")
            .expect("array memory deletion should preserve non-target chunks");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        assert_eq!(memory_ids(&chat["memories"]), vec!["keep-me"]);
    }

    #[test]
    fn delete_chat_memory_rejects_malformed_serialized_chunks() {
        let state = test_state("chat-memory-delete-malformed");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Malformed memory delete chat",
                    "memories": "{not valid json"
                }),
            )
            .expect("chat should be created");

        let error = delete_chat_memory(&state, "chat-1", "delete-me")
            .expect_err("malformed serialized memory deletion should be rejected");
        assert_eq!(error.code, "invalid_input");

        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        assert_eq!(chat["memories"], json!("{not valid json"));
    }

    #[test]
    fn list_chat_memories_excludes_recent_overlap_before_limit() {
        let state = test_state("chat-memory-list-filter-before-limit");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Filtered memory chat",
                    "memories": [
                        { "id": "recent-legacy-a", "lastMessageAt": "2026-01-10T00:00:00.000Z" },
                        { "id": "recent-legacy-b", "lastMessageAt": "2026-01-10T00:01:00.000Z" },
                        { "id": "older-eligible", "lastMessageAt": "2026-01-01T00:00:00.000Z" }
                    ]
                }),
            )
            .expect("chat should be created");
        let exclude_recent_message_ids = vec!["recent-message".to_string()];

        let filtered = list_chat_memories_excluding_recent(
            &state,
            "chat-1",
            Some(1),
            Some("recent"),
            &exclude_recent_message_ids,
            Some("2026-01-10T00:00:00.000Z"),
        )
        .expect("recent overlap should filter before limit");

        assert_eq!(memory_ids(&filtered), vec!["older-eligible"]);
    }

    #[test]
    fn list_chat_memories_can_return_recent_limited_chunks() {
        let state = test_state("chat-memory-list-limit");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": [
                        { "id": "old", "lastMessageAt": "2026-01-01T00:00:00.000Z" },
                        { "id": "new", "lastMessageAt": "2026-01-04T00:00:00.000Z" },
                        { "id": "created-only", "createdAt": "2026-01-03T00:00:00.000Z" },
                        { "id": "first-only", "firstMessageAt": "2026-01-02T00:00:00.000Z" },
                        { "id": "missing-date" }
                    ]
                }),
            )
            .expect("chat should be created");

        let recent = list_chat_memories(&state, "chat-1", Some(3), Some("recent"))
            .expect("recent limited memories should list");
        assert_eq!(
            memory_ids(&recent),
            vec!["new", "created-only", "first-only"]
        );

        let stored = list_chat_memories(&state, "chat-1", None, None)
            .expect("default memories should list in stored order");
        assert_eq!(
            memory_ids(&stored),
            vec!["old", "new", "created-only", "first-only", "missing-date"]
        );

        let invalid = list_chat_memories(&state, "chat-1", None, Some("popular"))
            .expect_err("unsupported ordering should be rejected");
        assert_eq!(invalid.code, "invalid_input");
    }

    #[test]
    fn chat_memory_timestamp_order_matches_recency_and_pruning() {
        let memory = json!({
            "lastMessageAt": "   ",
            "createdAt": "2026-01-03T00:00:00.000Z",
            "firstMessageAt": "2026-01-01T00:00:00.000Z"
        });

        assert_eq!(
            chat_memory_recency_key(&memory),
            chat_memory_timestamp(&memory).expect("timestamp should resolve")
        );
        assert_eq!(chat_memory_recency_key(&memory), "2026-01-03T00:00:00.000Z");
        assert!(memory_overlaps_deleted_messages(
            &memory,
            &HashSet::new(),
            Some("2026-01-02T00:00:00.000Z")
        ));
    }

    #[test]
    fn update_message_content_if_unchanged_prunes_stale_and_newer_memories() {
        let state = test_state("chat-memory-edit-prune");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": [
                        {
                            "id": "old",
                            "messageIds": ["message-old"],
                            "lastMessageAt": "2026-06-01T09:00:00.000Z"
                        },
                        {
                            "id": "edited",
                            "messageIds": ["message-2"],
                            "lastMessageAt": "2026-06-01T10:01:00.000Z"
                        },
                        {
                            "id": "newer",
                            "lastMessageAt": "2026-06-01T10:02:00.000Z"
                        },
                        {
                            "id": "created-only-newer",
                            "createdAt": "2026-06-01T10:03:00.000Z"
                        }
                    ]
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-2",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "old visible text",
                "createdAt": "2026-06-01T10:01:00.000Z",
                "swipes": [{ "content": "old visible text" }]
            }),
        )
        .expect("message should seed");

        update_message_content_if_unchanged(
            &state,
            "chat-1",
            "message-2",
            "old visible text",
            "new visible text",
        )
        .expect("matching edit should update");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");

        assert_eq!(memory_ids(&chat["memories"]), vec!["old"]);
    }

    #[test]
    fn update_message_content_if_unchanged_noop_preserves_memories() {
        let state = test_state("chat-memory-edit-noop");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": [
                        {
                            "id": "existing",
                            "messageIds": ["message-1"],
                            "lastMessageAt": "2026-06-01T10:00:00.000Z"
                        }
                    ]
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "same visible text",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "swipes": [{ "content": "same visible text" }]
            }),
        )
        .expect("message should seed");

        let result = update_message_content_if_unchanged(
            &state,
            "chat-1",
            "message-1",
            "same visible text",
            "same visible text",
        )
        .expect("no-op edit should still return updated");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");

        assert_eq!(result["updated"], json!(true));
        assert_eq!(memory_ids(&chat["memories"]), vec!["existing"]);
    }

    #[test]
    fn update_message_content_if_unchanged_failed_match_preserves_memories() {
        let state = test_state("chat-memory-edit-failed-match");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": "{not valid json"
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "current text",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "swipes": [{ "content": "current text" }]
            }),
        )
        .expect("message should seed");

        let result = update_message_content_if_unchanged(
            &state,
            "chat-1",
            "message-1",
            "stale text",
            "new text",
        )
        .expect("failed expected-content check should not touch malformed memories");
        let message = state
            .storage
            .get("messages", "message-1")
            .expect("message should read")
            .expect("message should exist");

        assert_eq!(result["updated"], json!(false));
        assert_eq!(message["content"], json!("current text"));
    }

    #[test]
    fn update_message_content_if_unchanged_missing_message_returns_false() {
        let state = test_state("chat-memory-edit-missing");

        let result = update_message_content_if_unchanged(
            &state,
            "chat-1",
            "missing-message",
            "old text",
            "new text",
        )
        .expect("missing conditional target should not fail transport");

        assert_eq!(result, json!({ "updated": false }));
    }

    #[test]
    fn conditional_message_write_rechecks_content_inside_atomic_update() {
        let state = test_state("chat-memory-edit-atomic-recheck");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": "{not valid json"
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "swipes": [{ "content": "first" }]
            }),
        )
        .expect("message should seed");
        state
            .storage
            .patch("messages", "message-1", json!({ "content": "third" }))
            .expect("message row should be patched");
        state
            .storage
            .patch(
                message_swipe_storage::COLLECTION,
                "message-1::swipe::0",
                json!({ "content": "third" }),
            )
            .expect("message sidecar should be patched");

        let result =
            update_message_content_if_unchanged(&state, "chat-1", "message-1", "first", "second")
                .expect("stale conditional write should return a false result");
        let mut current = stored_message(&state);
        message_swipe_storage::materialize_message(&state, &mut current, true)
            .expect("current message should materialize");
        let chat = stored_chat(&state);

        assert_eq!(result["updated"], json!(false));
        assert_eq!(current["content"], json!("third"));
        assert_eq!(current["swipes"][0]["content"], json!("third"));
        assert_eq!(chat["memories"], json!("{not valid json"));
    }

    #[test]
    fn conditional_message_write_does_not_resurrect_deleted_message() {
        let state = test_state("chat-memory-edit-no-resurrect");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": []
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "swipes": [{ "content": "first" }]
            }),
        )
        .expect("message should seed");
        message_swipe_storage::delete_message_rows_with_swipes(&state, &["message-1".to_string()])
            .expect("message delete should succeed");

        let result =
            update_message_content_if_unchanged(&state, "chat-1", "message-1", "first", "second")
                .expect("deleted conditional target should return a false result");
        let sidecars = state
            .storage
            .list(message_swipe_storage::COLLECTION)
            .expect("sidecars should read");

        assert_eq!(result["updated"], json!(false));
        assert!(state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should not fail")
            .is_none());
        assert!(sidecars.is_empty());
    }

    #[test]
    fn update_message_content_if_unchanged_preserves_fresh_non_content_fields() {
        let state = test_state("chat-memory-edit-preserve-row-fields");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": []
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [
                    { "content": "first" },
                    { "content": "first" }
                ]
            }),
        )
        .expect("message should seed");
        state
            .storage
            .patch(
                "messages",
                "message-1",
                json!({
                    "activeSwipeIndex": 1,
                    "characterId": "char-fresh",
                    "extra": { "fresh": true }
                }),
            )
            .expect("fresh parent fields should patch");

        let result =
            update_message_content_if_unchanged(&state, "chat-1", "message-1", "first", "second")
                .expect("matching conditional update should succeed");
        let message = &result["message"];

        assert_eq!(result["updated"], json!(true));
        assert_eq!(message["content"], json!("second"));
        assert_eq!(message["activeSwipeIndex"], json!(1));
        assert_eq!(message["characterId"], json!("char-fresh"));
        assert_eq!(message["extra"]["fresh"], json!(true));
        assert_eq!(message["swipes"][0]["content"], json!("first"));
        assert_eq!(message["swipes"][1]["content"], json!("second"));
    }

    #[test]
    fn update_message_content_if_unchanged_preserves_fresh_inactive_swipe_sidecar() {
        let state = test_state("chat-memory-edit-preserve-sidecar");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": []
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [
                    { "content": "first" },
                    { "content": "old inactive" }
                ]
            }),
        )
        .expect("message should seed");
        state
            .storage
            .patch(
                message_swipe_storage::COLLECTION,
                "message-1::swipe::1",
                json!({
                    "content": "fresh inactive",
                    "extra": { "side": "fresh" },
                    "characterId": "char-side"
                }),
            )
            .expect("fresh inactive sidecar should patch");

        let result =
            update_message_content_if_unchanged(&state, "chat-1", "message-1", "first", "second")
                .expect("matching conditional update should succeed");
        let message = &result["message"];

        assert_eq!(result["updated"], json!(true));
        assert_eq!(message["content"], json!("second"));
        assert_eq!(message["swipes"][0]["content"], json!("second"));
        assert_eq!(message["swipes"][1]["content"], json!("fresh inactive"));
        assert_eq!(message["swipes"][1]["extra"]["side"], json!("fresh"));
        assert_eq!(message["swipes"][1]["characterId"], json!("char-side"));
    }

    #[test]
    fn update_message_content_if_unchanged_malformed_memories_fail_before_message_write() {
        let state = test_state("chat-memory-edit-malformed-preflight");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": "{not valid json"
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "old visible text",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "swipes": [{ "content": "old visible text" }]
            }),
        )
        .expect("message should seed");

        let error = update_message_content_if_unchanged(
            &state,
            "chat-1",
            "message-1",
            "old visible text",
            "new visible text",
        )
        .expect_err("malformed memories should fail before message write");
        let message = state
            .storage
            .get("messages", "message-1")
            .expect("message should read")
            .expect("message should exist");

        assert_eq!(error.code, "invalid_input");
        assert_eq!(message["content"], json!("old visible text"));
    }

    #[test]
    fn update_message_content_if_unchanged_rolls_back_when_memory_cleanup_fails() {
        let state = test_state("chat-memory-edit-atomic-failure");
        seed_memory_cleanup_failure_chat(
            &state,
            "old visible text",
            0,
            json!([
                { "content": "old visible text" }
            ]),
        );

        let error = update_message_content_if_unchanged(
            &state,
            "chat-1",
            "message-1",
            "old visible text",
            "new visible text",
        )
        .expect_err("cleanup failure should abort the conditional edit");
        let message = stored_message(&state);
        let chat = stored_chat(&state);

        assert_eq!(error.code, "invalid_input");
        assert_eq!(message["content"], json!("old visible text"));
        assert_eq!(memory_ids(&chat["memories"]), memory_cleanup_failure_ids());
    }

    #[test]
    fn mark_autonomous_unread_accumulates_count_and_character_ids() {
        let state = test_state("autonomous-unread-accumulates");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Autonomous chat",
                    "metadata": {
                        "autonomousUnreadCount": 2,
                        "autonomousUnreadCharacterIds": [" char-a ", "char-a", "   ", "", 7],
                        "autonomousUnreadAt": "2026-06-01T00:00:00.000Z"
                    }
                }),
            )
            .expect("chat should be created");

        let updated = mark_autonomous_unread(
            &state,
            "chat-1",
            json!({ "characterId": "char-b", "count": 3 }),
        )
        .expect("unread mark should succeed");

        let metadata = updated
            .get("metadata")
            .and_then(Value::as_object)
            .expect("metadata should remain an object");
        assert_eq!(metadata.get("autonomousUnreadCount"), Some(&json!(5)));
        assert_eq!(
            metadata.get("autonomousUnreadCharacterIds"),
            Some(&json!(["char-a", "char-b"]))
        );
        assert_ne!(
            metadata.get("autonomousUnreadAt").and_then(Value::as_str),
            Some("2026-06-01T00:00:00.000Z")
        );

        let updated = mark_autonomous_unread(&state, "chat-1", json!({ "characterId": "char-b" }))
            .expect("default unread mark should succeed");
        let metadata = updated
            .get("metadata")
            .and_then(Value::as_object)
            .expect("metadata should remain an object");
        assert_eq!(metadata.get("autonomousUnreadCount"), Some(&json!(6)));
        assert_eq!(
            metadata.get("autonomousUnreadCharacterIds"),
            Some(&json!(["char-a", "char-b"]))
        );
    }

    #[test]
    fn mark_autonomous_unread_preserves_concurrent_marks() {
        let state = test_state("autonomous-unread-concurrent");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Autonomous chat",
                    "metadata": {
                        "autonomousUnreadCount": 0,
                        "autonomousUnreadCharacterIds": []
                    }
                }),
            )
            .expect("chat should be created");

        const WORKERS: usize = 12;
        let barrier = Arc::new(Barrier::new(WORKERS));
        let mut handles = Vec::with_capacity(WORKERS);
        for index in 0..WORKERS {
            let state = state.clone();
            let barrier = Arc::clone(&barrier);
            handles.push(thread::spawn(move || {
                barrier.wait();
                mark_autonomous_unread(
                    &state,
                    "chat-1",
                    json!({ "characterId": format!("char-{index}") }),
                )
                .expect("concurrent unread mark should succeed");
            }));
        }
        for handle in handles {
            handle.join().expect("worker should not panic");
        }

        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat lookup should succeed")
            .expect("chat should still exist");
        let metadata = chat
            .get("metadata")
            .and_then(Value::as_object)
            .expect("metadata should remain an object");
        assert_eq!(
            metadata.get("autonomousUnreadCount"),
            Some(&json!(WORKERS as i64))
        );
        let ids = metadata
            .get("autonomousUnreadCharacterIds")
            .and_then(Value::as_array)
            .expect("character ids should remain an array")
            .iter()
            .filter_map(Value::as_str)
            .collect::<HashSet<_>>();
        assert_eq!(ids.len(), WORKERS);
        for index in 0..WORKERS {
            assert!(ids.contains(format!("char-{index}").as_str()));
        }
    }

    #[test]
    fn mark_autonomous_unread_trims_and_rejects_blank_character_ids() {
        let state = test_state("autonomous-unread-character-id-normalization");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Autonomous chat",
                    "metadata": {
                        "autonomousUnreadCount": 1,
                        "autonomousUnreadCharacterIds": ["char-a"]
                    }
                }),
            )
            .expect("chat should be created");

        let updated =
            mark_autonomous_unread(&state, "chat-1", json!({ "characterId": "  char-b  " }))
                .expect("trimmed character id should succeed");
        let metadata = updated
            .get("metadata")
            .and_then(Value::as_object)
            .expect("metadata should remain an object");
        assert_eq!(
            metadata.get("autonomousUnreadCharacterIds"),
            Some(&json!(["char-a", "char-b"]))
        );

        let result = mark_autonomous_unread(&state, "chat-1", json!({ "characterId": "   " }));

        assert!(result.is_err(), "blank character id should be rejected");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat lookup should succeed")
            .expect("chat should still exist");
        let metadata = chat
            .get("metadata")
            .and_then(Value::as_object)
            .expect("metadata should remain an object");
        assert_eq!(metadata.get("autonomousUnreadCount"), Some(&json!(2)));
        assert_eq!(
            metadata.get("autonomousUnreadCharacterIds"),
            Some(&json!(["char-a", "char-b"]))
        );
    }

    #[test]
    fn mark_autonomous_unread_rejects_invalid_count() {
        let state = test_state("autonomous-unread-invalid-count");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Autonomous chat",
                    "metadata": {
                        "autonomousUnreadCount": 2,
                        "autonomousUnreadCharacterIds": ["char-a"]
                    }
                }),
            )
            .expect("chat should be created");

        let result = mark_autonomous_unread(&state, "chat-1", json!({ "count": 101 }));

        assert!(result.is_err(), "oversized count should be rejected");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat lookup should succeed")
            .expect("chat should still exist");
        let metadata = chat
            .get("metadata")
            .and_then(Value::as_object)
            .expect("metadata should remain an object");
        assert_eq!(metadata.get("autonomousUnreadCount"), Some(&json!(2)));
        assert_eq!(
            metadata.get("autonomousUnreadCharacterIds"),
            Some(&json!(["char-a"]))
        );
    }

    #[test]
    fn delete_chat_removes_gallery_records_and_managed_files() {
        let state = test_state("gallery-delete");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Gallery chat"
                }),
            )
            .expect("chat should be created");
        let gallery_dir = state.data_dir.join("gallery");
        std::fs::create_dir_all(&gallery_dir).expect("gallery dir should be created");
        let image_path = gallery_dir.join("managed.png");
        std::fs::write(&image_path, b"managed").expect("managed image should be written");
        state
            .storage
            .create(
                "gallery",
                json!({
                    "id": "image-1",
                    "chatId": "chat-1",
                    "filePath": "managed.png",
                    "filename": "managed.png",
                    "url": "data:image/png;base64,bWFuYWdlZA=="
                }),
            )
            .expect("gallery row should be created");

        delete_chat_with_messages(&state, "chat-1").expect("chat delete should succeed");

        let mut filters = Map::new();
        filters.insert("chatId".to_string(), Value::String("chat-1".to_string()));
        assert!(
            state
                .storage
                .list_where("gallery", &filters)
                .expect("gallery should be readable")
                .is_empty(),
            "chat gallery rows should be removed"
        );
        assert!(
            !image_path.exists(),
            "managed gallery file should be removed"
        );
    }

    #[test]
    fn delete_chat_removes_agent_bookkeeping_for_deleted_chat_scope() {
        let state = test_state("agent-bookkeeping-delete");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "origin-chat",
                    "name": "Origin",
                    "metadata": { "activeSceneChatId": "scene-chat" }
                }),
            )
            .expect("origin chat should be created");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "scene-chat",
                    "name": "Scene",
                    "metadata": { "sceneOriginChatId": "origin-chat" }
                }),
            )
            .expect("scene chat should be created");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "other-chat",
                    "name": "Other"
                }),
            )
            .expect("other chat should be created");
        state
            .storage
            .upsert_with_id(
                "agents",
                "secret-plot-agent",
                json!({
                    "id": "secret-plot-agent",
                    "type": "secret-plot-driver",
                    "name": "Secret Plot Driver",
                    "settings": {}
                }),
            )
            .expect("secret plot agent should write");
        for (id, chat_id) in [
            ("run-origin", "origin-chat"),
            ("run-scene", "scene-chat"),
            ("run-other", "other-chat"),
        ] {
            state
                .storage
                .upsert_with_id(
                    "agent-runs",
                    id,
                    json!({
                        "id": id,
                        "agentConfigId": "agent-director",
                        "chatId": chat_id,
                        "success": true
                    }),
                )
                .expect("agent run should write");
        }
        for (id, chat_id) in [
            ("memory-origin", "origin-chat"),
            ("memory-scene", "scene-chat"),
            ("memory-other", "other-chat"),
        ] {
            state
                .storage
                .upsert_with_id(
                    "agent-memory",
                    id,
                    json!({
                        "id": id,
                        "agentConfigId": "agent-director",
                        "chatId": chat_id,
                        "key": "note",
                        "value": "kept"
                    }),
                )
                .expect("agent memory should write");
        }
        state
            .storage
            .upsert_with_id(
                "agent-memory",
                "memory-origin-arc",
                json!({
                    "id": "memory-origin-arc",
                    "agentConfigId": "secret-plot-agent",
                    "chatId": "origin-chat",
                    "key": "overarchingArc",
                    "value": "delete me too"
                }),
            )
            .expect("secret plot memory should write");
        state
            .storage
            .upsert_with_id(
                "agent-memory",
                "memory-scene-legacy",
                json!({
                    "id": "memory-scene-legacy",
                    "agent_config_id": "agent-director",
                    "chat_id": "scene-chat",
                    "key": "legacy-note",
                    "value": "delete legacy row too"
                }),
            )
            .expect("legacy agent memory should write");

        delete_chat_with_messages(&state, "origin-chat").expect("chat delete should succeed");

        let mut remaining_run_ids = state
            .storage
            .list("agent-runs")
            .expect("agent runs should be readable")
            .iter()
            .filter_map(|run| run.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
            .collect::<Vec<_>>();
        remaining_run_ids.sort();
        assert_eq!(
            remaining_run_ids,
            vec!["run-other"],
            "agent runs should only remain for chats outside the delete scope"
        );

        let mut remaining_memory_ids = state
            .storage
            .list("agent-memory")
            .expect("agent memory should be readable")
            .iter()
            .filter_map(|memory| {
                memory
                    .get("id")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
            })
            .collect::<Vec<_>>();
        remaining_memory_ids.sort();
        assert_eq!(
            remaining_memory_ids,
            vec!["memory-other"],
            "agent memory should only remain for chats outside the delete scope"
        );
    }

    #[test]
    fn delete_chat_group_reports_exact_deleted_chat_ids_including_scene_children() {
        let state = test_state("group-delete-ids");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "origin-chat",
                    "name": "Origin",
                    "groupId": "group-1",
                    "metadata": { "activeSceneChatId": "scene-chat" }
                }),
            )
            .expect("origin chat should be created");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "scene-chat",
                    "name": "Scene",
                    "metadata": { "sceneOriginChatId": "origin-chat" }
                }),
            )
            .expect("scene chat should be created");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "sibling-chat",
                    "name": "Sibling",
                    "groupId": "group-1",
                    "metadata": {}
                }),
            )
            .expect("sibling chat should be created");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "other-chat",
                    "name": "Other",
                    "groupId": "group-other",
                    "metadata": {}
                }),
            )
            .expect("other chat should be created");

        let result = delete_chat_group(&state, "group-1").expect("group delete should succeed");
        let deleted_chat_ids: Vec<&str> = result["deletedChatIds"]
            .as_array()
            .expect("deleted chat ids should be returned")
            .iter()
            .map(|id| id.as_str().expect("deleted chat id should be a string"))
            .collect();

        assert_eq!(result.get("deleted").and_then(Value::as_i64), Some(2));
        assert_eq!(
            deleted_chat_ids,
            vec!["origin-chat", "scene-chat", "sibling-chat"]
        );
        assert!(state.storage.get("chats", "origin-chat").unwrap().is_none());
        assert!(state.storage.get("chats", "scene-chat").unwrap().is_none());
        assert!(state
            .storage
            .get("chats", "sibling-chat")
            .unwrap()
            .is_none());
        assert!(state.storage.get("chats", "other-chat").unwrap().is_some());
    }

    #[test]
    fn branch_chat_enrolls_ungrouped_source_chat_into_the_new_group() {
        let state = test_state("branch-enroll-root");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "root-1",
                    "name": "New Roleplay",
                    "mode": "roleplay",
                    "characterIds": [],
                    "metadata": {}
                }),
            )
            .expect("source chat should be created");

        let branch = branch_chat(&state, "root-1", json!({})).expect("branch should be created");

        // The new branch joins a group keyed on the source chat id...
        assert_eq!(branch["groupId"], "root-1");

        // ...and the source/root chat is enrolled into that same group instead
        // of keeping groupId: null, so Manage Chat Files finds the branches
        // when opened from the original chat.
        let source = state
            .storage
            .get("chats", "root-1")
            .expect("source lookup should not fail")
            .expect("source chat should still exist");
        assert_eq!(source["groupId"], "root-1");

        let mut filters = Map::new();
        filters.insert("groupId".to_string(), Value::String("root-1".to_string()));
        let group_members = state
            .storage
            .list_where("chats", &filters)
            .expect("group listing should not fail");
        assert_eq!(group_members.len(), 2);
    }

    #[test]
    fn branch_chat_preserves_stable_name_and_sets_branch_display_name() {
        let state = test_state("branch-display-name");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "root-1",
                    "name": "Stable Chat Name",
                    "mode": "conversation",
                    "characterIds": [],
                    "folderId": "folder-1",
                    "metadata": {
                        "tags": ["ongoing"]
                    }
                }),
            )
            .expect("source chat should be created");

        let branch = branch_chat(&state, "root-1", json!({})).expect("branch should be created");

        assert_eq!(branch["name"], "Stable Chat Name");
        assert_eq!(branch["metadata"]["branchName"], "New Branch");
        assert_eq!(branch["metadata"]["tags"], json!(["ongoing"]));
        assert_eq!(branch["folderId"], "folder-1");

        let source = state
            .storage
            .get("chats", "root-1")
            .expect("source lookup should not fail")
            .expect("source chat should still exist");
        assert_eq!(source["name"], "Stable Chat Name");
        assert_eq!(source["metadata"].get("branchName"), None);

        let mut filters = Map::new();
        filters.insert("groupId".to_string(), Value::String("root-1".to_string()));
        let group_members = state
            .storage
            .list_where("chats", &filters)
            .expect("group listing should not fail");
        let grouped_branch = group_members
            .iter()
            .find(|chat| {
                chat.get("id").and_then(Value::as_str) == branch.get("id").and_then(Value::as_str)
            })
            .expect("new branch should be visible in group list");
        assert_eq!(grouped_branch["name"], "Stable Chat Name");
        assert_eq!(grouped_branch["metadata"]["branchName"], "New Branch");
    }

    #[test]
    fn branch_chat_preserves_existing_group_without_repatching_source() {
        let state = test_state("branch-existing-group");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "root-1",
                    "name": "Grouped Roleplay",
                    "mode": "roleplay",
                    "groupId": "existing-group",
                    "characterIds": [],
                    "metadata": {}
                }),
            )
            .expect("source chat should be created");

        let branch = branch_chat(&state, "root-1", json!({})).expect("branch should be created");

        assert_eq!(branch["groupId"], "existing-group");
        let source = state
            .storage
            .get("chats", "root-1")
            .expect("source lookup should not fail")
            .expect("source chat should still exist");
        assert_eq!(source["groupId"], "existing-group");
    }

    #[test]
    fn branch_chat_prunes_future_summary_metadata_from_new_branch() {
        let state = test_state("branch-summary-prune");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "root-1",
                    "name": "Summarized Chat",
                    "mode": "conversation",
                    "characterIds": [],
                    "metadata": {
                        "summary": "Future rolling summary",
                        "summaryEntries": [{ "id": "summary-1", "content": "Future entry" }],
                        "summaryContextSize": 42,
                        "summaryPromptTemplates": [{ "id": "template-1", "name": "Short", "prompt": "Summarize." }],
                        "activeSummaryPromptTemplateId": "template-1",
                        "daySummaries": { "01.06.2026": { "summary": "Future day", "keyDetails": [] } },
                        "weekSummaries": { "25.05.2026": { "summary": "Future week", "keyDetails": [] } }
                    }
                }),
            )
            .expect("source chat should be created");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "root-1",
                    "role": "user",
                    "content": "hello"
                }),
            )
            .expect("message should be created");

        let branch = branch_chat(&state, "root-1", json!({ "upToMessageId": "message-1" }))
            .expect("branch should be created");
        let metadata = branch
            .get("metadata")
            .and_then(Value::as_object)
            .expect("branch metadata should remain an object");

        for key in ["summary", "summaryEntries", "daySummaries", "weekSummaries"] {
            assert!(
                !metadata.contains_key(key),
                "branch should not inherit {key}"
            );
        }
        assert_eq!(metadata.get("summaryContextSize"), Some(&json!(42)));
        assert_eq!(
            metadata.get("activeSummaryPromptTemplateId"),
            Some(&json!("template-1"))
        );

        let source = state
            .storage
            .get("chats", "root-1")
            .expect("source lookup should not fail")
            .expect("source chat should still exist");
        assert_eq!(source["metadata"]["summary"], "Future rolling summary");
    }

    #[test]
    fn branch_chat_sets_game_state_to_selected_tracker_snapshot() {
        let state = test_state("branch-game-tracker-state");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "game-root",
                    "name": "Game Run",
                    "mode": "game",
                    "characterIds": [],
                    "gameState": { "location": "future", "recentEvents": ["future turn"] },
                    "metadata": {}
                }),
            )
            .expect("source game chat should be created");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "user-1",
                    "chatId": "game-root",
                    "role": "user",
                    "content": "go north",
                    "createdAt": "2026-06-01T10:00:00.000Z"
                }),
            )
            .expect("first user message should be created");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "assistant-1",
                    "chatId": "game-root",
                    "role": "assistant",
                    "content": "You reach the fork.",
                    "createdAt": "2026-06-01T10:01:00.000Z"
                }),
            )
            .expect("selected assistant message should be created");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "assistant-2",
                    "chatId": "game-root",
                    "role": "assistant",
                    "content": "You enter the future.",
                    "createdAt": "2026-06-01T10:02:00.000Z"
                }),
            )
            .expect("future assistant message should be created");
        game_state_snapshots::save_tracker_snapshot(
            &state,
            "game-root",
            json!({
                "messageId": "assistant-1",
                "swipeIndex": 0,
                "location": "Fork point",
                "recentEvents": ["fork reached"],
                "committed": true
            }),
        )
        .expect("selected tracker snapshot should be saved");
        game_state_snapshots::save_tracker_snapshot(
            &state,
            "game-root",
            json!({
                "messageId": "assistant-2",
                "swipeIndex": 0,
                "location": "Future path",
                "recentEvents": ["future reached"],
                "committed": true
            }),
        )
        .expect("future tracker snapshot should be saved");

        let branch = branch_chat(
            &state,
            "game-root",
            json!({ "upToMessageId": "assistant-1" }),
        )
        .expect("branch should be created");

        assert_eq!(branch["gameState"]["location"], "Fork point");
        assert_eq!(branch["gameState"]["recentEvents"], json!(["fork reached"]));

        let branch_id = branch["id"].as_str().expect("branch id should be a string");
        let mut filters = Map::new();
        filters.insert("chatId".to_string(), Value::String(branch_id.to_string()));
        let branch_messages = state
            .storage
            .list_where("messages", &filters)
            .expect("branch messages should be readable");
        assert_eq!(branch_messages.len(), 2);
        assert!(
            branch_messages
                .iter()
                .all(|message| message.get("content").and_then(Value::as_str)
                    != Some("You enter the future.")),
            "branch should not copy messages after the selected turn"
        );
    }

    #[test]
    fn branch_chat_preserves_bootstrap_game_state_when_no_message_snapshot_is_copied() {
        let state = test_state("branch-game-bootstrap-tracker-state");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "game-root",
                    "name": "Game Run",
                    "mode": "game",
                    "characterIds": [],
                    "gameState": {
                        "messageId": "assistant-2",
                        "swipeIndex": 0,
                        "location": "Future path",
                        "recentEvents": ["future reached"]
                    },
                    "metadata": {}
                }),
            )
            .expect("source game chat should be created");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "greeting-1",
                    "chatId": "game-root",
                    "role": "assistant",
                    "content": "You wake at camp.",
                    "createdAt": "2026-06-01T09:00:00.000Z"
                }),
            )
            .expect("greeting message should be created");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "assistant-2",
                    "chatId": "game-root",
                    "role": "assistant",
                    "content": "You reach the pass.",
                    "createdAt": "2026-06-01T10:00:00.000Z"
                }),
            )
            .expect("future assistant message should be created");
        game_state_snapshots::save_tracker_snapshot(
            &state,
            "game-root",
            json!({
                "messageId": "",
                "swipeIndex": 0,
                "location": "Camp",
                "recentEvents": ["camp established"],
                "committed": true
            }),
        )
        .expect("bootstrap tracker snapshot should be saved");
        game_state_snapshots::save_tracker_snapshot(
            &state,
            "game-root",
            json!({
                "messageId": "assistant-2",
                "swipeIndex": 0,
                "location": "Future path",
                "recentEvents": ["future reached"],
                "committed": true
            }),
        )
        .expect("future tracker snapshot should be saved");

        let branch = branch_chat(
            &state,
            "game-root",
            json!({ "upToMessageId": "greeting-1" }),
        )
        .expect("branch should be created");

        assert_eq!(branch["gameState"]["location"], "Camp");
        assert_eq!(
            branch["gameState"]["recentEvents"],
            json!(["camp established"])
        );
        let branch_id = branch["id"].as_str().expect("branch id should be a string");
        assert!(
            game_state_snapshots::bootstrap_tracker_snapshot(&state, branch_id)
                .expect("branch bootstrap snapshot lookup should not fail")
                .is_some(),
            "branch should copy the bootstrap tracker snapshot"
        );
    }

    #[test]
    fn update_message_content_if_unchanged_updates_only_matching_content() {
        let state = test_state("conditional-content");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "first",
                    "activeSwipeIndex": 0,
                    "swipes": [{ "content": "first" }]
                }),
            )
            .expect("message should be created");

        let stale =
            update_message_content_if_unchanged(&state, "chat-1", "message-1", "stale", "second")
                .expect("stale conditional update should not fail");
        assert_eq!(stale["updated"], false);
        let unchanged = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should not fail")
            .expect("message should still exist");
        assert_eq!(unchanged["content"], "first");
        assert_eq!(unchanged["swipes"][0]["content"], "first");

        let updated =
            update_message_content_if_unchanged(&state, "chat-1", "message-1", "first", "second")
                .expect("matching conditional update should not fail");
        assert_eq!(updated["updated"], true);
        let message = updated["message"].clone();
        assert_eq!(message["content"], "second");
        assert_eq!(message["swipes"][0]["content"], "second");
    }

    #[test]
    fn message_swipes_store_per_swipe_extra_and_preserve_previous_active_extra() {
        let state = test_state("swipe-extra");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "first",
                    "activeSwipeIndex": 0,
                    "extra": {
                        "hiddenFromAI": true,
                        "reasoning_content": "first reasoning",
                        "cachedPrompt": [{ "role": "system", "content": "first prompt" }],
                        "generationInfo": { "model": "first-model" }
                    },
                    "swipes": [{ "content": "first" }]
                }),
            )
            .expect("message should be created");

        let updated = message_swipes(
            &state,
            "POST",
            "chat-1",
            "message-1",
            json!({
                "content": "second",
                "extra": {
                    "cachedPrompt": [{ "role": "system", "content": "second prompt" }],
                    "reasoning_content": "second reasoning",
                    "generationInfo": { "model": "second-model" }
                }
            }),
        )
        .expect("swipe should be added");

        assert_eq!(updated["activeSwipeIndex"], json!(1));
        assert_eq!(updated["extra"]["hiddenFromAI"], json!(true));
        assert_eq!(
            updated["extra"]["generationInfo"]["model"],
            json!("second-model")
        );
        assert_eq!(
            updated["extra"]["reasoning_content"],
            json!("second reasoning")
        );
        assert_eq!(
            updated["swipes"][0]["extra"]["generationInfo"]["model"],
            json!("first-model")
        );
        assert_eq!(
            updated["swipes"][0]["extra"]["reasoning_content"],
            json!("first reasoning")
        );
        assert_eq!(
            updated["swipes"][1]["extra"]["generationInfo"]["model"],
            json!("second-model")
        );

        let switched = set_active_swipe(&state, "chat-1", "message-1", json!({ "index": 0 }))
            .expect("swipe should switch");

        assert_eq!(switched["content"], json!("first"));
        let persisted = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should succeed")
            .expect("message should exist");
        assert_eq!(persisted["extra"]["hiddenFromAI"], json!(true));
        assert!(persisted["extra"].get("generationInfo").is_none());
        assert!(persisted["extra"].get("reasoning_content").is_none());
        assert!(persisted.get("swipes").is_none());
        let persisted_swipes = message_swipe_storage::swipes_for_message(&state, "message-1")
            .expect("message sidecar swipes should read");
        assert_eq!(
            persisted_swipes[0]["extra"]["generationInfo"]["model"],
            json!("first-model")
        );
        assert_eq!(
            persisted_swipes[0]["extra"]["reasoning_content"],
            json!("first reasoning")
        );

        let mut materialized = persisted.clone();
        message_swipe_storage::materialize_message(&state, &mut materialized, true)
            .expect("message should materialize from sidecar swipes");
        assert_eq!(
            materialized["extra"]["generationInfo"]["model"],
            json!("first-model")
        );
        assert_eq!(
            materialized["extra"]["reasoning_content"],
            json!("first reasoning")
        );
    }

    #[test]
    fn message_swipes_read_rejects_message_from_another_chat() {
        let state = test_state("swipe-read-cross-chat-owner");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "activeSwipeIndex": 0,
                "swipes": [
                    { "content": "first" },
                    { "content": "second" }
                ]
            }),
        )
        .expect("message should seed");

        let error = message_swipes(&state, "GET", "chat-2", "message-1", Value::Null)
            .expect_err("cross-chat swipe read should reject");

        assert_eq!(error.code, "invalid_input");
        assert!(error
            .message
            .contains("Message does not belong to the requested chat"));
    }

    #[test]
    fn message_swipes_merge_late_active_attachments_into_existing_swipe_extra() {
        let state = test_state("swipe-late-attachments");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "first",
                    "activeSwipeIndex": 0,
                    "extra": {
                        "hiddenFromAI": true,
                        "generationInfo": { "model": "first-model" },
                        "attachments": [{ "type": "image", "galleryId": "gallery-1" }]
                    },
                    "swipes": [
                        {
                            "content": "first",
                            "extra": {
                                "generationInfo": { "model": "first-model" }
                            }
                        },
                        {
                            "content": "second",
                            "extra": {
                                "generationInfo": { "model": "second-model" }
                            }
                        }
                    ]
                }),
            )
            .expect("message should be created");

        set_active_swipe(&state, "chat-1", "message-1", json!({ "index": 1 }))
            .expect("swipe should switch away");
        let persisted = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should succeed")
            .expect("message should exist");
        assert!(persisted.get("swipes").is_none());
        let persisted_swipes = message_swipe_storage::swipes_for_message(&state, "message-1")
            .expect("message sidecar swipes should read");
        assert_eq!(
            persisted_swipes[0]["extra"]["attachments"][0]["galleryId"],
            json!("gallery-1")
        );
        assert_eq!(
            persisted_swipes[0]["extra"]["generationInfo"]["model"],
            json!("first-model")
        );

        let restored = set_active_swipe(&state, "chat-1", "message-1", json!({ "index": 0 }))
            .expect("swipe should switch back");

        assert_eq!(restored["content"], json!("first"));
        assert_eq!(
            restored["extra"]["attachments"][0]["galleryId"],
            json!("gallery-1")
        );
    }

    #[test]
    fn message_swipes_store_prompt_snapshots_on_swipes_while_switching_active_snapshot() {
        let state = test_state("swipe-prompt-snapshots");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "second",
                    "activeSwipeIndex": 1,
                    "swipeCount": 2,
                    "extra": {
                        "hiddenFromAI": true,
                        "generationPromptSnapshot": { "promptPresetId": "preset-second" },
                        "generationPromptSnapshotsBySwipe": {
                            "0": { "promptPresetId": "preset-first" },
                            "1": { "promptPresetId": "preset-second" }
                        }
                    },
                    "swipes": [
                        {
                            "content": "first",
                            "extra": {
                                "generationPromptSnapshot": { "promptPresetId": "preset-first" }
                            }
                        },
                        {
                            "content": "second",
                            "extra": {
                                "generationPromptSnapshot": { "promptPresetId": "preset-second" }
                            }
                        }
                    ]
                }),
            )
            .expect("message should be created");

        set_active_swipe(&state, "chat-1", "message-1", json!({ "index": 0 }))
            .expect("swipe should switch");

        let persisted = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should succeed")
            .expect("message should exist");

        assert_eq!(persisted["content"], json!("first"));
        assert_eq!(persisted["extra"]["hiddenFromAI"], json!(true));
        assert!(persisted["extra"].get("generationPromptSnapshot").is_none());
        assert!(persisted["extra"]
            .get("generationPromptSnapshotsBySwipe")
            .is_none());
        assert!(persisted.get("swipes").is_none());
        let persisted_swipes = message_swipe_storage::swipes_for_message(&state, "message-1")
            .expect("message sidecar swipes should read");
        assert_eq!(
            persisted_swipes[0]["extra"]["generationPromptSnapshot"]["promptPresetId"],
            json!("preset-first")
        );
        assert_eq!(
            persisted_swipes[1]["extra"]["generationPromptSnapshot"]["promptPresetId"],
            json!("preset-second")
        );

        let mut materialized = persisted.clone();
        message_swipe_storage::materialize_message(&state, &mut materialized, true)
            .expect("message should materialize from sidecar swipes");
        assert_eq!(
            materialized["extra"]["generationPromptSnapshot"]["promptPresetId"],
            json!("preset-first")
        );
    }

    #[test]
    fn evict_prompt_snapshots_keeps_last_two_assistant_messages_and_spares_legacy_and_user_data() {
        let state = test_state("evict-prompt-snapshots");
        let snap = || json!({ "messages": [{ "role": "user", "content": "hi" }] });
        for (id, role, created_at, extra) in [
            (
                "assistant-old",
                "assistant",
                "2024-01-01T00:00:00.000Z",
                json!({
                    "generationPromptSnapshot": snap(),
                    "generationPromptSnapshotsBySwipe": { "0": snap() },
                }),
            ),
            (
                "user-1",
                "user",
                "2024-01-01T00:00:01.000Z",
                json!({ "cachedPrompt": [{ "role": "user", "content": "hi" }] }),
            ),
            (
                "assistant-mid",
                "assistant",
                "2024-01-01T00:00:02.000Z",
                json!({ "generationPromptSnapshot": snap() }),
            ),
            (
                "assistant-new",
                "assistant",
                "2024-01-01T00:00:03.000Z",
                json!({ "generationPromptSnapshot": snap() }),
            ),
        ] {
            state
                .storage
                .create(
                    "messages",
                    json!({
                        "id": id,
                        "chatId": "chat-1",
                        "role": role,
                        "content": "x",
                        "createdAt": created_at,
                        "extra": extra,
                    }),
                )
                .expect("message should be created");
        }
        // Oldest assistant message also carries a swipe with its own snapshot.
        state
            .storage
            .patch(
                "messages",
                "assistant-old",
                json!({
                    "swipes": [
                        { "content": "x", "extra": { "generationPromptSnapshot": snap() } }
                    ]
                }),
            )
            .expect("swipe should be added");

        let result = evict_prompt_snapshots(&state, "chat-1", 2).expect("eviction should succeed");
        assert_eq!(result["evicted"], json!(1));

        let get = |id: &str| {
            state
                .storage
                .get("messages", id)
                .expect("lookup should succeed")
                .expect("message should exist")
        };

        // Oldest assistant message: snapshot, by-swipe map, and swipe snapshot cleared.
        let old = get("assistant-old");
        assert!(old["extra"].get("generationPromptSnapshot").is_none());
        assert!(old["extra"]
            .get("generationPromptSnapshotsBySwipe")
            .is_none());
        assert!(old["swipes"][0]["extra"]
            .get("generationPromptSnapshot")
            .is_none());

        // The two most recent assistant messages keep their snapshots.
        assert!(get("assistant-mid")["extra"]
            .get("generationPromptSnapshot")
            .is_some());
        assert!(get("assistant-new")["extra"]
            .get("generationPromptSnapshot")
            .is_some());

        // User message and its legacy cached prompt are untouched (negative control).
        assert_eq!(
            get("user-1")["extra"]["cachedPrompt"][0]["content"],
            json!("hi")
        );
    }

    #[test]
    fn message_swipes_parse_stringified_parent_extra_before_preserving_active_extra() {
        let state = test_state("swipe-string-extra");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "first",
                    "activeSwipeIndex": 0,
                    "extra": r#"{"hiddenFromAI":true,"generationInfo":{"model":"first-model"},"reasoning_content":"first reasoning"}"#,
                    "swipes": [{ "content": "first" }]
                }),
            )
            .expect("message should be created");

        let updated = message_swipes(
            &state,
            "POST",
            "chat-1",
            "message-1",
            json!({
                "content": "second",
                "extra": { "generationInfo": { "model": "second-model" } }
            }),
        )
        .expect("swipe should be added");

        assert_eq!(updated["extra"]["hiddenFromAI"], json!(true));
        assert_eq!(
            updated["extra"]["generationInfo"]["model"],
            json!("second-model")
        );
        assert_eq!(
            updated["swipes"][0]["extra"]["generationInfo"]["model"],
            json!("first-model")
        );
        assert_eq!(
            updated["swipes"][0]["extra"]["reasoning_content"],
            json!("first reasoning")
        );
    }

    #[test]
    fn message_swipes_can_append_inactive_swipe_with_activate_false() {
        let state = test_state("swipe-inactive-activate-false");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "first",
                    "activeSwipeIndex": 0,
                    "extra": {
                        "hiddenFromAI": true,
                        "generationInfo": { "model": "first-model" }
                    },
                    "swipes": [{ "content": "first" }]
                }),
            )
            .expect("message should be created");

        let updated = message_swipes(
            &state,
            "POST",
            "chat-1",
            "message-1",
            json!({
                "content": "second",
                "activate": false,
                "extra": { "generationInfo": { "model": "second-model" } }
            }),
        )
        .expect("swipe should be added");

        assert_eq!(updated["activeSwipeIndex"], json!(0));
        assert_eq!(updated["swipeCount"], json!(2));
        assert_eq!(updated["content"], json!("first"));
        assert_eq!(
            updated["extra"]["generationInfo"]["model"],
            json!("first-model")
        );
        assert_eq!(
            updated["swipes"][0]["extra"]["generationInfo"]["model"],
            json!("first-model")
        );
        assert_eq!(
            updated["swipes"][1]["extra"]["generationInfo"]["model"],
            json!("second-model")
        );
    }

    #[test]
    fn message_swipes_inactive_append_clamps_stale_active_index_to_previous_swipes() {
        let state = test_state("swipe-inactive-stale-active");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "second",
                    "activeSwipeIndex": 99,
                    "extra": {
                        "hiddenFromAI": true,
                        "generationInfo": { "model": "second-model" }
                    },
                    "swipes": [
                        { "content": "first" },
                        { "content": "second" }
                    ]
                }),
            )
            .expect("message should be created");

        let updated = message_swipes(
            &state,
            "POST",
            "chat-1",
            "message-1",
            json!({
                "content": "third",
                "activate": false,
                "extra": { "generationInfo": { "model": "third-model" } }
            }),
        )
        .expect("swipe should be added");

        assert_eq!(updated["activeSwipeIndex"], json!(1));
        assert_eq!(updated["swipeCount"], json!(3));
        assert_eq!(updated["content"], json!("second"));
        assert_eq!(
            updated["extra"]["generationInfo"]["model"],
            json!("second-model")
        );
        assert_eq!(
            updated["swipes"][1]["extra"]["generationInfo"]["model"],
            json!("second-model")
        );
        assert_eq!(
            updated["swipes"][2]["extra"]["generationInfo"]["model"],
            json!("third-model")
        );
    }

    #[test]
    fn message_swipes_inactive_append_seeds_missing_swipes_from_current_message() {
        let state = test_state("swipe-inactive-missing-swipes");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "first",
                    "activeSwipeIndex": 0,
                    "extra": {
                        "hiddenFromAI": true,
                        "generationInfo": { "model": "first-model" }
                    }
                }),
            )
            .expect("message should be created");

        let updated = message_swipes(
            &state,
            "POST",
            "chat-1",
            "message-1",
            json!({
                "content": "second",
                "activate": false,
                "extra": { "generationInfo": { "model": "second-model" } }
            }),
        )
        .expect("swipe should be added");

        assert_eq!(updated["activeSwipeIndex"], json!(0));
        assert_eq!(updated["swipeCount"], json!(2));
        assert_eq!(updated["content"], json!("first"));
        assert_eq!(updated["extra"]["hiddenFromAI"], json!(true));
        assert_eq!(
            updated["extra"]["generationInfo"]["model"],
            json!("first-model")
        );
        assert_eq!(updated["swipes"][0]["content"], json!("first"));
        assert_eq!(
            updated["swipes"][0]["extra"]["generationInfo"]["model"],
            json!("first-model")
        );
        assert_eq!(updated["swipes"][1]["content"], json!("second"));
        assert_eq!(
            updated["swipes"][1]["extra"]["generationInfo"]["model"],
            json!("second-model")
        );
    }

    #[test]
    fn message_swipes_respects_legacy_silent_flag_for_inactive_swipes() {
        let state = test_state("swipe-inactive-silent");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "first",
                    "activeSwipeIndex": 0,
                    "swipes": [{ "content": "first" }]
                }),
            )
            .expect("message should be created");

        let updated = message_swipes(
            &state,
            "POST",
            "chat-1",
            "message-1",
            json!({
                "content": "second",
                "silent": true
            }),
        )
        .expect("swipe should be added");

        assert_eq!(updated["activeSwipeIndex"], json!(0));
        assert_eq!(updated["swipeCount"], json!(2));
        assert_eq!(updated["content"], json!("first"));
        assert_eq!(updated["swipes"][1]["content"], json!("second"));
    }

    #[test]
    fn bulk_delete_messages_rejects_empty_or_invalid_id_payloads() {
        let state = test_state("bulk-delete-empty-invalid");
        state
            .storage
            .create("chats", json!({ "id": "chat-1", "name": "Chat" }))
            .expect("chat should seed");

        for body in [
            json!({ "messageIds": [] }),
            json!({ "messageIds": [" ", ""] }),
            json!({ "messageIds": ["message-1", 3] }),
            json!({}),
        ] {
            let error = bulk_delete_messages(&state, "chat-1", body)
                .expect_err("invalid bulk delete payload should reject");
            assert_eq!(error.code, "invalid_input");
        }
    }

    #[test]
    fn bulk_delete_messages_ignores_ids_from_another_chat() {
        let state = test_state("bulk-delete-foreign-ids");
        for chat_id in ["chat-1", "chat-2"] {
            state
                .storage
                .create("chats", json!({ "id": chat_id, "name": chat_id }))
                .expect("chat should seed");
        }
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "own-message",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "mine",
                "activeSwipeIndex": 0,
                "swipes": [{ "content": "mine" }]
            }),
        )
        .expect("own message should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "foreign-message",
                "chatId": "chat-2",
                "role": "assistant",
                "content": "theirs",
                "activeSwipeIndex": 0,
                "swipes": [{ "content": "theirs" }]
            }),
        )
        .expect("foreign message should seed");

        let result = bulk_delete_messages(
            &state,
            "chat-1",
            json!({ "messageIds": ["own-message", "foreign-message"] }),
        )
        .expect("bulk delete should succeed");

        assert_eq!(
            result["deleted"],
            json!(1),
            "only the target chat's own message should be deleted"
        );
        assert!(
            state
                .storage
                .get("messages", "own-message")
                .expect("storage should read")
                .is_none(),
            "the chat's own message should be deleted"
        );
        assert!(
            state
                .storage
                .get("messages", "foreign-message")
                .expect("storage should read")
                .is_some(),
            "a message belonging to another chat must not be deleted by this chat's bulk delete"
        );
    }

    #[test]
    fn bulk_delete_messages_prunes_overlapping_chat_memories() {
        let state = test_state("bulk-delete-memory-prune");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory prune chat",
                    "memories": [
                        {
                            "id": "keep-older",
                            "messageIds": ["message-old"],
                            "lastMessageAt": "2026-01-01T00:00:00.000Z"
                        },
                        {
                            "id": "drop-by-id",
                            "messageIds": ["message-delete"],
                            "lastMessageAt": "2026-01-02T00:00:00.000Z"
                        },
                        {
                            "id": "drop-later-window",
                            "messageIds": ["message-later"],
                            "lastMessageAt": "2026-01-03T00:00:00.000Z"
                        }
                    ]
                }),
            )
            .expect("chat should seed");
        for (id, created_at) in [
            ("message-old", "2026-01-01T00:00:00.000Z"),
            ("message-delete", "2026-01-02T00:00:00.000Z"),
            ("message-later", "2026-01-03T00:00:00.000Z"),
        ] {
            message_swipe_storage::create_message(
                &state,
                json!({
                    "id": id,
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": id,
                    "createdAt": created_at,
                    "activeSwipeIndex": 0,
                    "swipes": [{ "content": id }]
                }),
            )
            .expect("message should seed");
        }

        bulk_delete_messages(
            &state,
            "chat-1",
            json!({ "messageIds": ["message-delete"] }),
        )
        .expect("bulk delete should prune memory recall");

        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        assert_eq!(memory_ids(&chat["memories"]), vec!["keep-older"]);
    }

    #[test]
    fn bulk_delete_messages_prunes_created_at_only_memory_window() {
        let state = test_state("bulk-delete-created-at-memory-prune");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Created-at memory prune chat",
                    "memories": [
                        { "id": "keep-created-at-old", "createdAt": "2026-01-01T00:00:00.000Z" },
                        { "id": "drop-created-at-new", "createdAt": "2026-01-03T00:00:00.000Z" }
                    ]
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-delete",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "delete me",
                "createdAt": "2026-01-02T00:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [{ "content": "delete me" }]
            }),
        )
        .expect("message should seed");

        bulk_delete_messages(
            &state,
            "chat-1",
            json!({ "messageIds": ["message-delete"] }),
        )
        .expect("bulk delete should prune created-at memory recall");

        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        assert_eq!(memory_ids(&chat["memories"]), vec!["keep-created-at-old"]);
    }

    #[test]
    fn bulk_delete_messages_prunes_mixed_timestamp_memory_by_shared_precedence() {
        let state = test_state("bulk-delete-mixed-timestamp-memory-prune");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Mixed timestamp memory prune chat",
                    "memories": [
                        {
                            "id": "drop-created-inside-window",
                            "createdAt": "2026-01-03T00:00:00.000Z",
                            "firstMessageAt": "2026-01-01T00:00:00.000Z"
                        },
                        {
                            "id": "keep-created-before-window",
                            "createdAt": "2026-01-01T00:00:00.000Z",
                            "firstMessageAt": "2026-01-04T00:00:00.000Z"
                        },
                        {
                            "id": "keep-last-message-before-window",
                            "lastMessageAt": "2026-01-01T00:00:00.000Z",
                            "createdAt": "2026-01-04T00:00:00.000Z"
                        }
                    ]
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-delete",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "delete me",
                "createdAt": "2026-01-02T00:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [{ "content": "delete me" }]
            }),
        )
        .expect("message should seed");

        bulk_delete_messages(
            &state,
            "chat-1",
            json!({ "messageIds": ["message-delete"] }),
        )
        .expect("bulk delete should use shared memory timestamp precedence");

        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        assert_eq!(
            memory_ids(&chat["memories"]),
            vec![
                "keep-created-before-window",
                "keep-last-message-before-window"
            ]
        );
    }

    #[test]
    fn bulk_delete_messages_prunes_only_confirmed_deleted_rows() {
        let state = test_state("bulk-delete-confirmed-memory-prune");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Confirmed memory prune chat",
                    "memories": [
                        {
                            "id": "drop-own",
                            "messageIds": ["own-message"],
                            "lastMessageAt": "2026-01-02T00:00:00.000Z"
                        },
                        {
                            "id": "keep-foreign",
                            "messageIds": ["foreign-message"],
                            "lastMessageAt": "2026-01-01T00:00:00.000Z"
                        }
                    ]
                }),
            )
            .expect("chat should seed");
        for (chat_id, message_id) in [("chat-1", "own-message"), ("chat-2", "foreign-message")] {
            state
                .storage
                .create("chats", json!({ "id": chat_id, "name": chat_id }))
                .ok();
            message_swipe_storage::create_message(
                &state,
                json!({
                    "id": message_id,
                    "chatId": chat_id,
                    "role": "assistant",
                    "content": message_id,
                    "createdAt": "2026-01-02T00:00:00.000Z",
                    "activeSwipeIndex": 0,
                    "swipes": [{ "content": message_id }]
                }),
            )
            .expect("message should seed");
        }

        bulk_delete_messages(
            &state,
            "chat-1",
            json!({ "messageIds": ["own-message", "foreign-message"] }),
        )
        .expect("bulk delete should only prune confirmed rows");

        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        assert_eq!(memory_ids(&chat["memories"]), vec!["keep-foreign"]);
    }

    #[test]
    fn bulk_delete_messages_keeps_rows_and_memories_when_memory_prune_fails() {
        let state = test_state("bulk-delete-prune-fails");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Prune failure chat",
                    "memories": "{not valid json"
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-delete",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "delete me",
                "createdAt": "2026-01-02T00:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [{ "content": "delete me" }]
            }),
        )
        .expect("message should seed");

        let error = bulk_delete_messages(
            &state,
            "chat-1",
            json!({ "messageIds": ["message-delete"] }),
        )
        .expect_err("malformed memories should abort atomic delete");
        assert_eq!(error.code, "invalid_input");
        assert!(state
            .storage
            .get("messages", "message-delete")
            .expect("message should read")
            .is_some());
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        assert_eq!(chat["memories"], json!("{not valid json"));
    }

    #[test]
    fn bulk_delete_messages_rolls_back_rows_memories_and_trackers_when_cleanup_fails() {
        let state = test_state("bulk-delete-tracker-cleanup-fails");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Tracker rollback chat",
                    "gameState": { "location": "before" },
                    "memories": [
                        {
                            "id": "drop-memory",
                            "messageIds": ["message-delete"],
                            "lastMessageAt": "2026-01-02T00:00:00.000Z"
                        },
                        {
                            "id": "__fail_after_delete_mutation__",
                            "lastMessageAt": "2026-01-01T00:00:00.000Z"
                        }
                    ]
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-delete",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "delete me",
                "createdAt": "2026-01-02T00:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [{ "content": "delete me" }]
            }),
        )
        .expect("message should seed");
        game_state_snapshots::save_tracker_snapshot(
            &state,
            "chat-1",
            json!({
                "messageId": "message-delete",
                "location": "delete target"
            }),
        )
        .expect("tracker snapshot should seed");

        let error = bulk_delete_messages(
            &state,
            "chat-1",
            json!({ "messageIds": ["message-delete"] }),
        )
        .expect_err("injected cleanup failure should abort atomic delete");
        assert_eq!(error.code, "invalid_input");
        assert!(state
            .storage
            .get("messages", "message-delete")
            .expect("message should read")
            .is_some());
        assert_eq!(
            message_swipe_storage::swipes_for_message(&state, "message-delete")
                .expect("swipes should read")
                .len(),
            1
        );
        let snapshots = state
            .storage
            .list("game-state-snapshots")
            .expect("snapshots should read");
        assert_eq!(snapshots.len(), 1);
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        assert_eq!(
            memory_ids(&chat["memories"]),
            vec!["drop-memory", "__fail_after_delete_mutation__"]
        );
        assert_eq!(chat["gameState"]["location"], "before");
    }

    #[test]
    fn set_active_swipe_clamps_invalid_index() {
        let state = test_state("set-active-invalid-index");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "activeSwipeIndex": 0,
                "swipes": [
                    { "content": "first" },
                    { "content": "second" }
                ]
            }),
        )
        .expect("message should seed");

        let missing = set_active_swipe(&state, "chat-1", "message-1", json!({ "index": 4 }))
            .expect("missing swipe target should not fail transport");
        let negative = set_active_swipe(&state, "chat-1", "message-1", json!({ "index": -1 }))
            .expect("negative swipe target should not fail transport");

        assert_eq!(missing["activeSwipeIndex"], json!(1));
        assert_eq!(missing["content"], json!("second"));
        assert_eq!(negative["activeSwipeIndex"], json!(0));
        assert_eq!(negative["content"], json!("first"));
        let persisted = state
            .storage
            .get("messages", "message-1")
            .expect("message should read")
            .expect("message should exist");
        assert_eq!(persisted["activeSwipeIndex"], json!(0));
        assert_eq!(persisted["content"], json!("first"));
    }

    #[test]
    fn delete_swipe_rejects_last_and_missing_swipes() {
        let state = test_state("delete-swipe-guards");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "single-message",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "only",
                "swipes": [{ "content": "only" }]
            }),
        )
        .expect("single-swipe message should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "multi-message",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "swipes": [
                    { "content": "first" },
                    { "content": "second" }
                ]
            }),
        )
        .expect("multi-swipe message should seed");

        let last_error = delete_swipe(&state, "chat-1", "single-message", "0")
            .expect_err("last swipe delete should fail");
        let missing_error = delete_swipe(&state, "chat-1", "multi-message", "9")
            .expect_err("missing swipe delete should fail");

        assert_eq!(last_error.code, "invalid_input");
        assert!(last_error
            .message
            .contains("Cannot delete the last remaining swipe"));
        assert_eq!(missing_error.code, "not_found");
        assert!(missing_error.message.contains("Swipe not found"));
        assert_eq!(
            message_swipe_storage::swipes_for_message(&state, "single-message")
                .expect("single-message swipes should read")
                .len(),
            1
        );
        assert_eq!(
            message_swipe_storage::swipes_for_message(&state, "multi-message")
                .expect("multi-message swipes should read")
                .len(),
            2
        );
    }

    #[test]
    fn delete_swipe_preserves_shifted_active_swipe() {
        let state = test_state("delete-before-active-swipe");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Chat",
                    "gameState": {}
                }),
            )
            .expect("chat should be created");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "second",
                    "activeSwipeIndex": 1,
                    "extra": {
                        "hiddenFromAI": true,
                        "generationInfo": { "model": "second-model" }
                    },
                    "swipes": [
                        {
                            "content": "first",
                            "extra": { "generationInfo": { "model": "first-model" } }
                        },
                        {
                            "content": "second",
                            "extra": { "generationInfo": { "model": "second-model" } }
                        },
                        {
                            "content": "third",
                            "extra": { "generationInfo": { "model": "third-model" } }
                        }
                    ]
                }),
            )
            .expect("message should be created");

        let updated =
            delete_swipe(&state, "chat-1", "message-1", "0").expect("swipe should delete");

        assert_eq!(updated["activeSwipeIndex"], json!(0));
        assert_eq!(updated["content"], json!("second"));
        assert_eq!(updated["extra"]["hiddenFromAI"], json!(true));
        assert_eq!(
            updated["extra"]["generationInfo"]["model"],
            json!("second-model")
        );
    }

    #[test]
    fn active_swipe_content_change_prunes_affected_chat_memories() {
        let state = test_state("chat-memory-swipe-prune");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": [
                        {
                            "id": "keep-before",
                            "messageIds": ["message-before"],
                            "lastMessageAt": "2026-06-01T09:00:00.000Z"
                        },
                        {
                            "id": "drop-active",
                            "messageIds": ["message-1"],
                            "lastMessageAt": "2026-06-01T10:00:00.000Z"
                        },
                        {
                            "id": "drop-newer",
                            "lastMessageAt": "2026-06-01T10:01:00.000Z"
                        }
                    ]
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [
                    { "content": "first" },
                    { "content": "second" }
                ]
            }),
        )
        .expect("message should seed");

        set_active_swipe(&state, "chat-1", "message-1", json!({ "index": 1 }))
            .expect("swipe switch should update visible content");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");

        assert_eq!(memory_ids(&chat["memories"]), vec!["keep-before"]);
    }

    #[test]
    fn message_swipes_rolls_back_when_memory_cleanup_fails() {
        let state = test_state("chat-memory-append-swipe-atomic-failure");
        seed_memory_cleanup_failure_chat(
            &state,
            "first",
            0,
            json!([
                { "content": "first" }
            ]),
        );

        let error = message_swipes(
            &state,
            "POST",
            "chat-1",
            "message-1",
            json!({ "content": "second" }),
        )
        .expect_err("cleanup failure should abort swipe append");
        let message = stored_message(&state);
        let swipes = message_swipe_storage::swipes_for_message(&state, "message-1")
            .expect("swipes should read");
        let chat = stored_chat(&state);

        assert_eq!(error.code, "invalid_input");
        assert_eq!(message["content"], json!("first"));
        assert_eq!(swipes.len(), 1);
        assert_eq!(memory_ids(&chat["memories"]), memory_cleanup_failure_ids());
    }

    #[test]
    fn set_active_swipe_rolls_back_when_memory_cleanup_fails() {
        let state = test_state("chat-memory-set-active-atomic-failure");
        seed_memory_cleanup_failure_chat(
            &state,
            "first",
            0,
            json!([
                { "content": "first" },
                { "content": "second" }
            ]),
        );

        let error = set_active_swipe(&state, "chat-1", "message-1", json!({ "index": 1 }))
            .expect_err("cleanup failure should abort active swipe switch");
        let message = stored_message(&state);
        let swipes = message_swipe_storage::swipes_for_message(&state, "message-1")
            .expect("swipes should read");
        let chat = stored_chat(&state);

        assert_eq!(error.code, "invalid_input");
        assert_eq!(message["content"], json!("first"));
        assert_eq!(message["activeSwipeIndex"], json!(0));
        assert_eq!(swipes.len(), 2);
        assert_eq!(memory_ids(&chat["memories"]), memory_cleanup_failure_ids());
    }

    #[test]
    fn delete_swipe_rolls_back_when_memory_cleanup_fails() {
        let state = test_state("chat-memory-delete-swipe-atomic-failure");
        seed_memory_cleanup_failure_chat(
            &state,
            "first",
            0,
            json!([
                { "content": "first" },
                { "content": "second" }
            ]),
        );

        let error = delete_swipe(&state, "chat-1", "message-1", "0")
            .expect_err("cleanup failure should abort active swipe delete");
        let message = stored_message(&state);
        let swipes = message_swipe_storage::swipes_for_message(&state, "message-1")
            .expect("swipes should read");
        let chat = stored_chat(&state);

        assert_eq!(error.code, "invalid_input");
        assert_eq!(message["content"], json!("first"));
        assert_eq!(message["activeSwipeIndex"], json!(0));
        assert_eq!(swipes.len(), 2);
        assert_eq!(memory_ids(&chat["memories"]), memory_cleanup_failure_ids());
    }

    #[test]
    fn delete_swipe_rolls_back_when_tracker_cleanup_fails() {
        let state = test_state("chat-memory-delete-swipe-tracker-failure");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Tracker failure chat",
                    "gameState": { "id": "visible-before" },
                    "memories": [
                        {
                            "id": "drop-active",
                            "messageIds": ["message-1"],
                            "lastMessageAt": "2026-06-01T10:00:00.000Z"
                        }
                    ]
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [
                    { "content": "first" },
                    { "content": "second" }
                ]
            }),
        )
        .expect("message should seed");
        state
            .storage
            .create(
                "game-state-snapshots",
                json!({
                    "id": "__fail_after_swipe_tracker_mutation__",
                    "kind": "tracker",
                    "chatId": "chat-1",
                    "messageId": "message-1",
                    "swipeIndex": 1,
                    "createdAt": "2026-06-01T10:01:00.000Z"
                }),
            )
            .expect("tracker snapshot should seed");

        let error = delete_swipe(&state, "chat-1", "message-1", "0")
            .expect_err("tracker cleanup failure should abort active swipe delete");
        let message = stored_message(&state);
        let swipes = message_swipe_storage::swipes_for_message(&state, "message-1")
            .expect("swipes should read");
        let chat = stored_chat(&state);
        let snapshots = state
            .storage
            .list("game-state-snapshots")
            .expect("snapshots should read");

        assert_eq!(error.code, "invalid_input");
        assert_eq!(message["content"], json!("first"));
        assert_eq!(message["activeSwipeIndex"], json!(0));
        assert_eq!(swipes.len(), 2);
        assert_eq!(memory_ids(&chat["memories"]), vec!["drop-active"]);
        assert_eq!(chat["gameState"], json!({ "id": "visible-before" }));
        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0]["swipeIndex"], json!(1));
    }

    #[test]
    fn swipe_mutations_reject_cross_chat_route_before_pruning_memories() {
        let state = test_state("chat-memory-swipe-cross-chat");
        for chat_id in ["chat-1", "chat-2"] {
            state
                .storage
                .create(
                    "chats",
                    json!({
                        "id": chat_id,
                        "name": chat_id,
                        "memories": [
                            {
                                "id": format!("{chat_id}-memory"),
                                "messageIds": ["message-1"],
                                "lastMessageAt": "2026-06-01T10:00:00.000Z"
                            }
                        ]
                    }),
                )
                .expect("chat should seed");
        }
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [
                    { "content": "first" },
                    { "content": "second" }
                ]
            }),
        )
        .expect("message should seed");

        for error in [
            message_swipes(
                &state,
                "POST",
                "chat-2",
                "message-1",
                json!({ "content": "third" }),
            )
            .expect_err("add swipe should reject mismatched chat"),
            set_active_swipe(&state, "chat-2", "message-1", json!({ "index": 1 }))
                .expect_err("active swipe should reject mismatched chat"),
            delete_swipe(&state, "chat-2", "message-1", "1")
                .expect_err("delete swipe should reject mismatched chat"),
        ] {
            assert_eq!(error.code, "invalid_input");
        }

        let chat_1 = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        let chat_2 = state
            .storage
            .get("chats", "chat-2")
            .expect("chat should read")
            .expect("chat should exist");
        let message = state
            .storage
            .get("messages", "message-1")
            .expect("message should read")
            .expect("message should exist");

        assert_eq!(memory_ids(&chat_1["memories"]), vec!["chat-1-memory"]);
        assert_eq!(memory_ids(&chat_2["memories"]), vec!["chat-2-memory"]);
        assert_eq!(message["content"], json!("first"));
    }

    #[test]
    fn active_swipe_malformed_memories_fail_before_message_write() {
        let state = test_state("chat-memory-swipe-malformed-preflight");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat",
                    "memories": "{not valid json"
                }),
            )
            .expect("chat should seed");
        message_swipe_storage::create_message(
            &state,
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "createdAt": "2026-06-01T10:00:00.000Z",
                "activeSwipeIndex": 0,
                "swipes": [
                    { "content": "first" },
                    { "content": "second" }
                ]
            }),
        )
        .expect("message should seed");

        let error = set_active_swipe(&state, "chat-1", "message-1", json!({ "index": 1 }))
            .expect_err("malformed memories should fail before swipe write");
        let message = state
            .storage
            .get("messages", "message-1")
            .expect("message should read")
            .expect("message should exist");

        assert_eq!(error.code, "invalid_input");
        assert_eq!(message["content"], json!("first"));
        assert_eq!(message["activeSwipeIndex"], json!(0));
    }

    #[test]
    fn memory_embedding_context_prefers_dedicated_embedding_connection() {
        let state = test_state("memory-embedding-context");
        let chat = state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-a",
                    "name": "Chat",
                    "connectionId": "chat-connection"
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "connections",
                json!({
                    "id": "chat-connection",
                    "name": "Chat connection",
                    "provider": "openai",
                    "model": "gpt-4o",
                    "embeddingConnectionId": "embedding-connection"
                }),
            )
            .unwrap();
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
            .unwrap();

        let context = memory_embedding_context(&state, &chat).unwrap();

        assert_eq!(context.connection_id, "embedding-connection");
        assert_eq!(context.model, "text-embedding-3-small");
    }

    #[tokio::test]
    async fn refresh_chat_memories_skips_legacy_and_current_hidden_flags() {
        let state = test_state("memory-hidden-flags");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat"
                }),
            )
            .expect("chat should be created");

        for message in [
            json!({
                "id": "visible-1",
                "chatId": "chat-1",
                "role": "user",
                "content": "visible memory",
                "createdAt": "2026-06-01T10:00:00.000Z"
            }),
            json!({
                "id": "visible-2",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "visible reply",
                "createdAt": "2026-06-01T10:00:30.000Z"
            }),
            json!({
                "id": "legacy-hidden-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "legacy hidden memory",
                "createdAt": "2026-06-01T10:01:00.000Z",
                "extra": { "hiddenFromAI": true }
            }),
            json!({
                "id": "legacy-hidden-string-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "string hidden memory",
                "createdAt": "2026-06-01T10:02:00.000Z",
                "extra": r#"{"hiddenFromAI":true}"#
            }),
            json!({
                "id": "current-hidden-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "current hidden memory",
                "createdAt": "2026-06-01T10:03:00.000Z",
                "extra": { "hiddenFromAi": true }
            }),
            json!({
                "id": "visible-3",
                "chatId": "chat-1",
                "role": "user",
                "content": "visible followup",
                "createdAt": "2026-06-01T10:04:00.000Z"
            }),
            json!({
                "id": "visible-4",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "visible answer",
                "createdAt": "2026-06-01T10:05:00.000Z"
            }),
            json!({
                "id": "visible-5",
                "chatId": "chat-1",
                "role": "user",
                "content": "visible close",
                "createdAt": "2026-06-01T10:06:00.000Z"
            }),
        ] {
            state
                .storage
                .create("messages", message)
                .expect("message should be created");
        }

        refresh_chat_memories(&state, "chat-1")
            .await
            .expect("memory refresh should succeed");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat lookup should succeed")
            .expect("chat should exist");
        let memories = chat["memories"]
            .as_array()
            .expect("memories should be an array");

        assert_eq!(memories.len(), 1);
        assert_eq!(
            memories[0]["messageIds"],
            json!([
                "visible-1",
                "visible-2",
                "visible-3",
                "visible-4",
                "visible-5"
            ])
        );
        assert_eq!(memories[0]["firstMessageId"], json!("visible-1"));
        assert_eq!(memories[0]["lastMessageId"], json!("visible-5"));
        let content = memories[0]["content"]
            .as_str()
            .expect("memory content should be a string");
        assert!(content.contains("user: visible memory"));
        assert!(content.contains("assistant: visible reply"));
        assert!(!content.contains("hidden memory"));
    }

    #[tokio::test]
    async fn refresh_chat_memories_stores_only_complete_five_message_chunks() {
        let state = test_state("memory-complete-chunks-only");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat"
                }),
            )
            .expect("chat should seed");
        for index in 0..6 {
            state
                .storage
                .create(
                    "messages",
                    json!({
                        "id": format!("message-{index}"),
                        "chatId": "chat-1",
                        "role": if index % 2 == 0 { "user" } else { "assistant" },
                        "content": format!("visible memory {index}"),
                        "createdAt": format!("2026-06-01T10:0{index}:00.000Z")
                    }),
                )
                .expect("message should seed");
        }

        let result = refresh_chat_memories(&state, "chat-1")
            .await
            .expect("memory refresh should succeed");
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        let memories = chat["memories"]
            .as_array()
            .expect("memories should be an array");

        assert_eq!(result["rebuilt"], json!(1));
        assert_eq!(memories.len(), 1);
        assert_eq!(memories[0]["messageCount"], json!(5));
        assert_eq!(
            memories[0]["messageIds"],
            json!([
                "message-0",
                "message-1",
                "message-2",
                "message-3",
                "message-4"
            ])
        );
        assert!(!memories[0]["content"]
            .as_str()
            .expect("content should be a string")
            .contains("visible memory 5"));
    }

    #[tokio::test]
    async fn refresh_chat_memories_reuses_existing_complete_chunks() {
        let state = test_state("memory-incremental-chunks");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Memory chat"
                }),
            )
            .expect("chat should seed");
        for index in 0..5 {
            state
                .storage
                .create(
                    "messages",
                    json!({
                        "id": format!("message-{index}"),
                        "chatId": "chat-1",
                        "role": if index % 2 == 0 { "user" } else { "assistant" },
                        "content": format!("visible memory {index}"),
                        "createdAt": format!("2026-06-01T10:0{index}:00.000Z")
                    }),
                )
                .expect("message should seed");
        }

        let first_result = refresh_chat_memories(&state, "chat-1")
            .await
            .expect("first refresh should succeed");
        let first_chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        let first_memory_id = first_chat["memories"][0]["id"]
            .as_str()
            .expect("memory id should exist")
            .to_string();
        assert_eq!(first_result["embedded"], json!(1));
        assert_eq!(first_result["reused"], json!(0));

        for index in 5..10 {
            state
                .storage
                .create(
                    "messages",
                    json!({
                        "id": format!("message-{index}"),
                        "chatId": "chat-1",
                        "role": if index % 2 == 0 { "user" } else { "assistant" },
                        "content": format!("visible memory {index}"),
                        "createdAt": format!("2026-06-01T10:{index}:00.000Z")
                    }),
                )
                .expect("message should seed");
        }

        let second_result = refresh_chat_memories(&state, "chat-1")
            .await
            .expect("second refresh should succeed");
        let second_chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should exist");
        let memories = second_chat["memories"]
            .as_array()
            .expect("memories should be an array");

        assert_eq!(second_result["embedded"], json!(1));
        assert_eq!(second_result["reused"], json!(1));
        assert_eq!(memories.len(), 2);
        assert_eq!(memories[0]["id"], json!(first_memory_id));
        assert_eq!(
            memories[1]["messageIds"],
            json!([
                "message-5",
                "message-6",
                "message-7",
                "message-8",
                "message-9"
            ])
        );
    }

    #[tokio::test]
    async fn embed_memory_content_uses_lexical_fallback_without_context() {
        let result = embed_memory_content(None, "alpha beta").await.unwrap();

        assert_eq!(result.source, "lexical");
        assert_eq!(result.embedding.len(), MEMORY_EMBEDDING_DIMS);
        assert!(result.connection_id.is_none());
        assert!(result.model.is_none());
    }

    #[test]
    fn lexical_memory_embedding_rewards_related_and_unicode_features() {
        fn cosine(left: &[f64], right: &[f64]) -> f64 {
            let dot = left.iter().zip(right).map(|(a, b)| a * b).sum::<f64>();
            let left_mag = left.iter().map(|value| value * value).sum::<f64>().sqrt();
            let right_mag = right.iter().map(|value| value * value).sum::<f64>().sqrt();
            if left_mag > 0.0 && right_mag > 0.0 {
                dot / (left_mag * right_mag)
            } else {
                0.0
            }
        }

        let query = lexical_memory_embedding("Dottore remembered the freezing Snezhnaya facility");
        let related =
            lexical_memory_embedding("The Snezhnaya facility stayed frozen while Dottore observed");
        let unrelated = lexical_memory_embedding("Sunny beach playlist for a cheerful picnic");
        let polish = lexical_memory_embedding("Zażółć gęślą jaźń and Snezhnaya");

        assert!(cosine(&query, &related) > cosine(&query, &unrelated));
        assert!(polish.iter().any(|value| value.abs() > 0.0));
    }

    #[test]
    fn disconnect_connected_chat_clears_both_sides_and_pair_notes() {
        let state = test_state("disconnect-connected-notes");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "conversation-1",
                    "name": "Conversation",
                    "connectedChatId": "roleplay-1"
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "roleplay-1",
                    "name": "Roleplay",
                    "connectedChatId": "conversation-1",
                    "notes": [
                        {
                            "id": "connected-note",
                            "type": "note",
                            "content": "Stale durable note",
                            "sourceChatId": "conversation-1",
                            "targetChatId": "roleplay-1"
                        },
                        {
                            "id": "connected-influence",
                            "type": "influence",
                            "content": "Stale influence",
                            "sourceChatId": "conversation-1",
                            "targetChatId": "roleplay-1",
                            "consumed": false
                        },
                        {
                            "id": "ordinary-memory",
                            "type": "memory",
                            "content": "Keep memory from this chat",
                            "sourceChatId": "roleplay-1",
                            "targetChatId": null
                        },
                        {
                            "id": "unrelated-note",
                            "type": "note",
                            "content": "Keep unrelated note",
                            "sourceChatId": "other-chat",
                            "targetChatId": "other-target"
                        },
                        {
                            "id": "adjacent-source-note",
                            "type": "note",
                            "content": "Keep note from disconnected source to another target",
                            "sourceChatId": "conversation-1",
                            "targetChatId": "other-target"
                        },
                        {
                            "id": "adjacent-target-note",
                            "type": "influence",
                            "content": "Keep note from another source to disconnected target",
                            "sourceChatId": "other-chat",
                            "targetChatId": "roleplay-1",
                            "consumed": false
                        }
                    ]
                }),
            )
            .unwrap();

        let result = disconnect_connected_chat(&state, "conversation-1").unwrap();

        assert_eq!(result["disconnected"], true);
        assert_eq!(result["chatIds"], json!(["conversation-1", "roleplay-1"]));
        let conversation = state
            .storage
            .get("chats", "conversation-1")
            .unwrap()
            .unwrap();
        let roleplay = state.storage.get("chats", "roleplay-1").unwrap().unwrap();
        assert!(conversation
            .get("connectedChatId")
            .is_some_and(Value::is_null));
        assert!(roleplay.get("connectedChatId").is_some_and(Value::is_null));
        let notes = roleplay["notes"].as_array().unwrap();
        assert_eq!(notes.len(), 4);
        assert!(notes.iter().all(|note| {
            let id = note.get("id").and_then(Value::as_str);
            id != Some("connected-note") && id != Some("connected-influence")
        }));
        assert!(notes
            .iter()
            .any(|note| note.get("id").and_then(Value::as_str) == Some("ordinary-memory")));
        assert!(notes
            .iter()
            .any(|note| note.get("id").and_then(Value::as_str) == Some("unrelated-note")));
        assert!(notes
            .iter()
            .any(|note| note.get("id").and_then(Value::as_str) == Some("adjacent-source-note")));
        assert!(notes
            .iter()
            .any(|note| note.get("id").and_then(Value::as_str) == Some("adjacent-target-note")));
    }

    #[test]
    fn disconnect_connected_chat_finds_partner_with_reverse_only_link() {
        let state = test_state("disconnect-reverse-only-link");
        state
            .storage
            .create(
                "chats",
                json!({ "id": "conversation-1", "name": "Conversation" }),
            )
            .unwrap();
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "game-1",
                    "name": "Game",
                    "connectedChatId": "conversation-1",
                    "notes": [
                        {
                            "id": "stale-note",
                            "type": "note",
                            "content": "Remove stale note",
                            "sourceChatId": "conversation-1",
                            "targetChatId": "game-1"
                        }
                    ]
                }),
            )
            .unwrap();

        let result = disconnect_connected_chat(&state, "conversation-1").unwrap();

        assert_eq!(result["chatIds"], json!(["conversation-1", "game-1"]));
        let game = state.storage.get("chats", "game-1").unwrap().unwrap();
        assert!(game.get("connectedChatId").is_some_and(Value::is_null));
        assert!(game["notes"].as_array().unwrap().is_empty());
    }

    #[test]
    fn disconnect_connected_chat_preserves_forward_partner_live_link() {
        let state = test_state("disconnect-stale-forward-live-link");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "conversation-1",
                    "name": "Conversation",
                    "connectedChatId": "game-1"
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "game-1",
                    "name": "Game",
                    "connectedChatId": "scene-2",
                    "notes": [
                        {
                            "id": "stale-forward-note",
                            "type": "note",
                            "content": "Remove stale requested-chat note",
                            "sourceChatId": "conversation-1",
                            "targetChatId": "game-1"
                        },
                        {
                            "id": "live-scene-note",
                            "type": "note",
                            "content": "Keep live scene note",
                            "sourceChatId": "scene-2",
                            "targetChatId": "game-1"
                        }
                    ]
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "scene-2",
                    "name": "Scene",
                    "connectedChatId": "game-1"
                }),
            )
            .unwrap();

        let result = disconnect_connected_chat(&state, "conversation-1").unwrap();

        assert_eq!(result["chatIds"], json!(["conversation-1", "game-1"]));
        let conversation = state
            .storage
            .get("chats", "conversation-1")
            .unwrap()
            .unwrap();
        let game = state.storage.get("chats", "game-1").unwrap().unwrap();
        let scene = state.storage.get("chats", "scene-2").unwrap().unwrap();
        assert!(conversation
            .get("connectedChatId")
            .is_some_and(Value::is_null));
        assert_eq!(
            game.get("connectedChatId").and_then(Value::as_str),
            Some("scene-2")
        );
        assert_eq!(
            scene.get("connectedChatId").and_then(Value::as_str),
            Some("game-1")
        );
        let notes = game["notes"].as_array().unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(
            notes[0].get("id").and_then(Value::as_str),
            Some("live-scene-note")
        );
    }

    #[test]
    fn delete_origin_chat_removes_scene_chats_and_character_scene_memories() {
        let state = test_state("origin-scene-memory");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "origin-chat",
                    "name": "Origin",
                    "metadata": {
                        "roleplaySceneHistory": [
                            { "sceneChatId": "scene-chat", "summary": "The moonlit duel happened." },
                            { "sceneChatId": "linked-non-scene-chat", "summary": "Corrupted non-scene reference." }
                        ],
                        "lastRoleplaySceneSummary": "The moonlit duel happened."
                    },
                    "connectedChatId": "linked-non-scene-chat"
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "scene-chat",
                    "name": "Scene: Moonlit duel",
                    "metadata": { "sceneOriginChatId": "origin-chat", "sceneStatus": "concluded" },
                    "characterIds": ["char-a"]
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "linked-non-scene-chat",
                    "name": "Linked non-scene chat",
                    "metadata": {}
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "messages",
                json!({ "id": "origin-message", "chatId": "origin-chat", "content": "start" }),
            )
            .unwrap();
        state
            .storage
            .create(
                "messages",
                json!({ "id": "scene-message", "chatId": "scene-chat", "content": "duel" }),
            )
            .unwrap();
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-a",
                    "data": {
                        "extensions": {
                            "characterMemories": [
                                "{\"sceneChatId\":\"scene-chat\",\"summary\":\"The moonlit duel happened.\"}",
                                { "sceneChatId": "other-scene", "summary": "Keep this unrelated memory." },
                                { "summary": "Keep this older unscoped memory." }
                            ]
                        }
                    }
                }),
            )
            .unwrap();

        delete_chat_with_messages(&state, "origin-chat").unwrap();

        assert!(state.storage.get("chats", "origin-chat").unwrap().is_none());
        assert!(state.storage.get("chats", "scene-chat").unwrap().is_none());
        assert!(state
            .storage
            .get("chats", "linked-non-scene-chat")
            .unwrap()
            .is_some());
        assert!(state
            .storage
            .get("messages", "origin-message")
            .unwrap()
            .is_none());
        assert!(state
            .storage
            .get("messages", "scene-message")
            .unwrap()
            .is_none());
        let character = state.storage.get("characters", "char-a").unwrap().unwrap();
        let memories = character["data"]["extensions"]["characterMemories"]
            .as_array()
            .expect("character memories should remain an array");
        assert_eq!(memories.len(), 2);
        assert!(memories.iter().all(|memory| object_or_parse(Some(memory))
            .get("sceneChatId")
            .and_then(Value::as_str)
            != Some("scene-chat")));
        assert!(memories.iter().any(|memory| object_or_parse(Some(memory))
            .get("sceneChatId")
            .and_then(Value::as_str)
            == Some("other-scene")));
        assert!(memories
            .iter()
            .any(|memory| memory.get("summary").and_then(Value::as_str)
                == Some("Keep this older unscoped memory.")));
    }

    #[test]
    fn delete_scene_chat_prunes_origin_scene_state_without_breaking_unrelated_link() {
        let state = test_state("scene-origin-reference");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "origin-chat",
                    "name": "Origin",
                    "metadata": {
                        "activeSceneChatId": "scene-chat",
                        "sceneBusyCharIds": ["char-a"],
                        "roleplaySceneHistory": [
                            { "sceneChatId": "other-scene", "summary": "Keep this other scene." },
                            "{\"sceneChatId\":\"scene-chat\",\"summary\":\"Remove this deleted scene.\"}"
                        ],
                        "lastRoleplaySceneSummary": "Remove this deleted scene."
                    },
                    "connectedChatId": "linked-non-scene-chat"
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "scene-chat",
                    "name": "Scene: Moonlit duel",
                    "metadata": { "sceneOriginChatId": "origin-chat", "sceneStatus": "concluded" },
                    "characterIds": ["char-a"]
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "linked-non-scene-chat",
                    "name": "Linked non-scene chat",
                    "metadata": {}
                }),
            )
            .unwrap();
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-a",
                    "data": {
                        "extensions": {
                            "characterMemories": [
                                "{\"sceneChatId\":\"scene-chat\",\"summary\":\"Remove this deleted scene.\"}",
                                { "sceneChatId": "other-scene", "summary": "Keep this other scene." }
                            ]
                        }
                    }
                }),
            )
            .unwrap();

        delete_chat_with_messages(&state, "scene-chat").unwrap();

        assert!(state.storage.get("chats", "scene-chat").unwrap().is_none());
        let origin = state.storage.get("chats", "origin-chat").unwrap().unwrap();
        assert_eq!(
            origin.get("connectedChatId").and_then(Value::as_str),
            Some("linked-non-scene-chat")
        );
        let meta = metadata_map(&origin);
        assert!(meta.get("activeSceneChatId").is_some_and(Value::is_null));
        assert!(meta.get("sceneBusyCharIds").is_some_and(Value::is_null));
        assert_eq!(
            meta.get("lastRoleplaySceneSummary").and_then(Value::as_str),
            Some("Keep this other scene.")
        );
        let history = meta
            .get("roleplaySceneHistory")
            .and_then(Value::as_array)
            .expect("origin scene history should remain an array");
        assert_eq!(history.len(), 1);
        assert_eq!(
            object_or_parse(history.first())
                .get("sceneChatId")
                .and_then(Value::as_str),
            Some("other-scene")
        );

        let character = state.storage.get("characters", "char-a").unwrap().unwrap();
        let memories = character["data"]["extensions"]["characterMemories"]
            .as_array()
            .expect("character memories should remain an array");
        assert_eq!(memories.len(), 1);
        assert_eq!(
            object_or_parse(memories.first())
                .get("sceneChatId")
                .and_then(Value::as_str),
            Some("other-scene")
        );
    }
}
