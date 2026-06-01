use super::game_state_snapshots;
use super::media_uploads::remove_managed_record_file;
use super::prompts;
use super::shared::*;
use super::*;
use crate::builtins::is_protected_record;
use std::collections::HashSet;

const MEMORY_CHUNK_SIZE: usize = 5;
const MEMORY_EMBEDDING_DIMS: usize = 256;

pub(crate) fn messages_for_chat(state: &AppState, chat_id: &str) -> AppResult<Vec<Value>> {
    let mut filters = Map::new();
    filters.insert("chatId".to_string(), Value::String(chat_id.to_string()));
    let mut rows = state.storage.list_where("messages", &filters)?;
    rows.sort_by(|a, b| {
        let a_time = a.get("createdAt").and_then(Value::as_str).unwrap_or("");
        let b_time = b.get("createdAt").and_then(Value::as_str).unwrap_or("");
        a_time.cmp(b_time)
    });
    for row in &mut rows {
        materialize_message_swipe_fields(row);
    }
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

fn lexical_memory_embedding(text: &str) -> Vec<f64> {
    let mut vector = vec![0.0_f64; MEMORY_EMBEDDING_DIMS];
    for token in text
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|token| token.len() > 1)
    {
        let mut hash = 2166136261_u32;
        for byte in token.to_ascii_lowercase().bytes() {
            hash ^= byte as u32;
            hash = hash.wrapping_mul(16777619);
        }
        let index = (hash as usize) % MEMORY_EMBEDDING_DIMS;
        vector[index] += 1.0;
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
    if let Some(context) = context {
        return Ok(MemoryEmbeddingResult {
            embedding: prompts::embed_text(&context.connection, &context.model, content).await?,
            source: "provider",
            connection_id: Some(context.connection_id.clone()),
            model: Some(context.model.clone()),
        });
    }
    Ok(MemoryEmbeddingResult {
        embedding: lexical_memory_embedding(content),
        source: "lexical",
        connection_id: None,
        model: None,
    })
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

fn is_hidden_from_ai(message: &Value) -> bool {
    let extra = match message.get("extra") {
        Some(Value::Object(object)) => Some(object.clone()),
        Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
            .ok()
            .and_then(|value| value.as_object().cloned()),
        _ => None,
    };
    extra
        .as_ref()
        .and_then(|object| object.get("hiddenFromAi"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn active_swipe_index(message: &Value) -> i64 {
    swipe_index_value(message)
}

fn active_swipe_update_response(message: &Value) -> Value {
    let mut response = Map::new();
    for field in [
        "id",
        "content",
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

fn merge_chat_metadata(
    state: &AppState,
    chat_id: &str,
    patch: Map<String, Value>,
) -> AppResult<Value> {
    let mut chat = get_required(state, "chats", chat_id)?;
    let mut metadata = metadata_map(&chat);
    for (key, value) in patch {
        metadata.insert(key, value);
    }
    chat.as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Chat is not an object"))?
        .insert("metadata".to_string(), Value::Object(metadata));
    state.storage.patch("chats", chat_id, chat)
}

pub(crate) fn message_swipes(
    state: &AppState,
    _method: &str,
    _chat_id: &str,
    message_id: &str,
    body: Value,
) -> AppResult<Value> {
    let mut message = get_required(state, "messages", message_id)?;
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
    let current_extra = object_extra(object.get("extra"));
    let current_active_index = object
        .get("activeSwipeIndex")
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(0);
    let activate_new_swipe = should_activate_new_swipe(&body);
    let (active_index, swipe_count, active_content, active_extra) = {
        let swipes = object
            .entry("swipes".to_string())
            .or_insert_with(|| json!([]))
            .as_array_mut()
            .ok_or_else(|| AppError::invalid_input("Message swipes is not an array"))?;
        if swipes.is_empty() && !activate_new_swipe {
            swipes.push(json!({ "content": current_content, "createdAt": now_iso() }));
        }
        let previous_swipe_count = swipes.len();
        if !swipes.is_empty() {
            let preserve_index = current_active_index.min(swipes.len().saturating_sub(1));
            preserve_active_swipe_extra(swipes, preserve_index, current_extra.clone());
        }
        swipes.push(json!({ "content": content, "createdAt": now_iso(), "extra": new_extra }));
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
        )
    };
    object.insert("activeSwipeIndex".to_string(), json!(active_index));
    object.insert("swipeCount".to_string(), json!(swipe_count));
    object.insert("content".to_string(), active_content);
    object.insert(
        "extra".to_string(),
        merge_active_swipe_extra(object.get("extra"), active_extra),
    );
    let updated = state.storage.patch("messages", message_id, message)?;
    Ok(updated)
}

pub(crate) fn update_message_content_if_unchanged(
    state: &AppState,
    chat_id: &str,
    message_id: &str,
    expected_content: &str,
    content: &str,
) -> AppResult<Value> {
    let content = collapse_excess_blank_lines(content);
    let updated = state.storage.patch_if("messages", message_id, |message| {
        let current_chat_id = message.get("chatId").and_then(Value::as_str).unwrap_or("");
        if current_chat_id != chat_id {
            return Ok(false);
        }
        let current_content = message.get("content").and_then(Value::as_str).unwrap_or("");
        if current_content != expected_content {
            return Ok(false);
        }
        message.insert("content".to_string(), Value::String(content.clone()));
        let mut patch = Map::new();
        patch.insert("content".to_string(), Value::String(content.clone()));
        sync_message_patch_content_to_active_swipe(message, &patch);
        Ok(true)
    })?;
    Ok(match updated {
        Some(message) => json!({ "updated": true, "message": message }),
        None => json!({ "updated": false }),
    })
}

pub(crate) fn set_active_swipe(
    state: &AppState,
    _chat_id: &str,
    message_id: &str,
    body: Value,
) -> AppResult<Value> {
    let requested_index = body
        .get("index")
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(0);
    let mut message = get_required(state, "messages", message_id)?;
    let object = message
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
    let current_extra = object_extra(object.get("extra"));
    let current_active_index = object
        .get("activeSwipeIndex")
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .unwrap_or(0);
    let Some((active_index, swipe_count, active_content, active_extra)) = object
        .get_mut("swipes")
        .and_then(Value::as_array_mut)
        .map(|swipes| {
            if swipes.is_empty() {
                (0, 0, None, None)
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
                )
            }
        })
    else {
        let updated = state.storage.patch(
            "messages",
            message_id,
            json!({ "activeSwipeIndex": requested_index }),
        )?;
        return Ok(active_swipe_update_response(&updated));
    };
    object.insert("activeSwipeIndex".to_string(), json!(active_index));
    object.insert("swipeCount".to_string(), json!(swipe_count));
    if let Some(content) = active_content {
        object.insert("content".to_string(), content);
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
    let updated = state.storage.patch("messages", message_id, message)?;
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
    let mut removed_swipe = false;
    {
        let object = message
            .as_object_mut()
            .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
        let current_active_index = object
            .get("activeSwipeIndex")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(0);
        if let Some(swipes) = object.get_mut("swipes").and_then(Value::as_array_mut) {
            if index < swipes.len() {
                swipes.remove(index);
                removed_swipe = true;
                let next_active_index = if swipes.is_empty() {
                    0
                } else if current_active_index > index {
                    current_active_index - 1
                } else if current_active_index == index {
                    index.min(swipes.len().saturating_sub(1))
                } else {
                    current_active_index.min(swipes.len().saturating_sub(1))
                };
                object.insert("activeSwipeIndex".to_string(), json!(next_active_index));
            }
        }
    }
    materialize_message_swipe_fields(&mut message);
    let updated = state.storage.patch("messages", message_id, message)?;
    if removed_swipe {
        game_state_snapshots::delete_tracker_snapshot_swipe(
            state,
            chat_id,
            message_id,
            index as i64,
        )?;
        game_state_snapshots::sync_chat_game_state_to_visible_tracker(state, chat_id)?;
    }
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
        .cloned()
        .unwrap_or_default();
    let mut deleted = 0;
    for id in ids.iter().filter_map(Value::as_str) {
        if state.storage.delete("messages", id)? {
            game_state_snapshots::delete_tracker_snapshots_for_message(state, chat_id, id)?;
            deleted += 1;
        }
    }
    if deleted > 0 {
        game_state_snapshots::sync_chat_game_state_to_visible_tracker(state, chat_id)?;
    }
    touch_chat(state, chat_id)?;
    Ok(json!({ "deleted": deleted }))
}

pub(crate) fn mark_autonomous_unread(
    state: &AppState,
    chat_id: &str,
    body: Value,
) -> AppResult<Value> {
    get_required(state, "chats", chat_id)?;
    let mut patch = Map::new();
    let count = body
        .get("count")
        .and_then(Value::as_i64)
        .unwrap_or(1)
        .max(1);
    let character_id = body
        .get("characterId")
        .and_then(Value::as_str)
        .map(str::to_string);
    let mut character_ids = Vec::new();
    if let Some(id) = character_id {
        character_ids.push(Value::String(id));
    }
    patch.insert("autonomousUnreadCount".to_string(), json!(count));
    patch.insert(
        "autonomousUnreadCharacterIds".to_string(),
        Value::Array(character_ids),
    );
    patch.insert("autonomousUnreadAt".to_string(), Value::String(now_iso()));
    merge_chat_metadata(state, chat_id, patch)
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

pub(crate) async fn refresh_chat_memories(state: &AppState, chat_id: &str) -> AppResult<Value> {
    let chat = get_required(state, "chats", chat_id)?;
    let embedding_context = memory_embedding_context(state, &chat);
    let visible_messages = messages_for_chat(state, chat_id)?
        .into_iter()
        .filter(|message| !is_hidden_from_ai(message) && !message_content(message).is_empty())
        .collect::<Vec<_>>();
    let now = now_iso();
    let mut chunks = Vec::new();
    for chunk in visible_messages.chunks(MEMORY_CHUNK_SIZE) {
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
        memory.insert("id".to_string(), Value::String(new_id()));
        memory.insert("chatId".to_string(), Value::String(chat_id.to_string()));
        memory.insert("content".to_string(), Value::String(content.clone()));
        memory.insert("messageCount".to_string(), json!(chunk.len()));
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
        insert_memory_embedding_fields(
            &mut memory,
            embed_memory_content(embedding_context.as_ref(), &content).await?,
        );
        chunks.push(Value::Object(memory));
    }
    state
        .storage
        .patch("chats", chat_id, json!({ "memories": chunks }))?;
    Ok(json!({ "rebuilt": chunks.len(), "chunks": chunks }))
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

pub(crate) fn touch_chat(state: &AppState, chat_id: &str) -> AppResult<()> {
    if state.storage.get("chats", chat_id)?.is_some() {
        state
            .storage
            .patch("chats", chat_id, json!({ "lastMessageAt": now_iso() }))?;
    }
    Ok(())
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
    object.insert(
        "name".to_string(),
        Value::String(format!("{base_name} Branch")),
    );
    object.insert("groupId".to_string(), Value::String(group_id.clone()));
    prune_branch_summary_metadata(&mut chat);
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
        let created = state.storage.create("messages", message)?;
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
        } else if !chat_game_state_is_bootstrap(&new_chat) {
            new_chat =
                state
                    .storage
                    .patch("chats", &new_chat_id, json!({ "gameState": Value::Null }))?;
        } else if let Some(bootstrap_game_state) =
            game_state_snapshots::copy_bootstrap_tracker_snapshot(state, chat_id, &new_chat_id)?
        {
            new_chat = state.storage.patch(
                "chats",
                &new_chat_id,
                json!({ "gameState": bootstrap_game_state }),
            )?;
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
    state.storage.delete_messages_for_chats(&delete_id_set)?;

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
        assert_eq!(
            persisted["extra"]["generationInfo"]["model"],
            json!("first-model")
        );
        assert_eq!(
            persisted["extra"]["reasoning_content"],
            json!("first reasoning")
        );
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
        assert_eq!(
            persisted["swipes"][0]["extra"]["attachments"][0]["galleryId"],
            json!("gallery-1")
        );
        assert_eq!(
            persisted["swipes"][0]["extra"]["generationInfo"]["model"],
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
    fn message_swipes_keep_prompt_snapshot_map_global_while_switching_active_snapshot() {
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
        assert_eq!(
            persisted["extra"]["generationPromptSnapshot"]["promptPresetId"],
            json!("preset-first")
        );
        assert_eq!(
            persisted["extra"]["generationPromptSnapshotsBySwipe"]["0"]["promptPresetId"],
            json!("preset-first")
        );
        assert_eq!(
            persisted["extra"]["generationPromptSnapshotsBySwipe"]["1"]["promptPresetId"],
            json!("preset-second")
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
    async fn embed_memory_content_uses_lexical_fallback_without_context() {
        let result = embed_memory_content(None, "alpha beta").await.unwrap();

        assert_eq!(result.source, "lexical");
        assert_eq!(result.embedding.len(), MEMORY_EMBEDDING_DIMS);
        assert!(result.connection_id.is_none());
        assert!(result.model.is_none());
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
