use super::game_state_snapshots;
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
    let object = message
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
    let (active_index, swipe_count, active_content) = {
        let swipes = object
            .entry("swipes".to_string())
            .or_insert_with(|| json!([]))
            .as_array_mut()
            .ok_or_else(|| AppError::invalid_input("Message swipes is not an array"))?;
        swipes.push(json!({ "content": content, "createdAt": now_iso() }));
        let active_index = swipes.len().saturating_sub(1);
        (
            active_index,
            swipes.len(),
            swipes[active_index]["content"].clone(),
        )
    };
    object.insert("activeSwipeIndex".to_string(), json!(active_index));
    object.insert("swipeCount".to_string(), json!(swipe_count));
    object.insert("content".to_string(), active_content);
    let updated = state.storage.patch("messages", message_id, message)?;
    Ok(updated)
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
    let Some((active_index, swipe_count, active_content)) = object
        .get("swipes")
        .and_then(Value::as_array)
        .map(|swipes| {
            if swipes.is_empty() {
                (0, 0, None)
            } else {
                let active_index = requested_index.min(swipes.len().saturating_sub(1));
                (
                    active_index,
                    swipes.len(),
                    Some(swipes[active_index]["content"].clone()),
                )
            }
        })
    else {
        return state.storage.patch(
            "messages",
            message_id,
            json!({ "activeSwipeIndex": requested_index }),
        );
    };
    object.insert("activeSwipeIndex".to_string(), json!(active_index));
    object.insert("swipeCount".to_string(), json!(swipe_count));
    if let Some(content) = active_content {
        object.insert("content".to_string(), content);
    }
    state.storage.patch("messages", message_id, message)
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
        if let Some(swipes) = object.get_mut("swipes").and_then(Value::as_array_mut) {
            if index < swipes.len() {
                swipes.remove(index);
                removed_swipe = true;
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

pub(crate) fn refresh_chat_memories(state: &AppState, chat_id: &str) -> AppResult<Value> {
    get_required(state, "chats", chat_id)?;
    let visible_messages = messages_for_chat(state, chat_id)?
        .into_iter()
        .filter(|message| !is_hidden_from_ai(message) && !message_content(message).is_empty())
        .collect::<Vec<_>>();
    let now = now_iso();
    let chunks = visible_messages
        .chunks(MEMORY_CHUNK_SIZE)
        .map(|chunk| {
            let content = chunk
                .iter()
                .map(|message| {
                    let role = message.get("role").and_then(Value::as_str).unwrap_or("message");
                    format!("{role}: {}", message_content(message))
                })
                .collect::<Vec<_>>()
                .join("\n");
            let embedding = lexical_memory_embedding(&content);
            json!({
                "id": new_id(),
                "chatId": chat_id,
                "content": content,
                "embedding": embedding,
                "messageCount": chunk.len(),
                "firstMessageAt": chunk.first().and_then(|message| message.get("createdAt")).cloned().unwrap_or(Value::Null),
                "lastMessageAt": chunk.last().and_then(|message| message.get("createdAt")).cloned().unwrap_or(Value::Null),
                "createdAt": now,
                "hasEmbedding": true,
                "embeddingStatus": "vectorized"
            })
        })
        .collect::<Vec<_>>();
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

pub(crate) fn import_chat_memories(
    state: &AppState,
    chat_id: &str,
    body: Value,
) -> AppResult<Value> {
    get_required(state, "chats", chat_id)?;
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
            memory.insert(
                "embedding".to_string(),
                Value::Array(
                    lexical_memory_embedding(content)
                        .into_iter()
                        .map(|value| json!(value))
                        .collect(),
                ),
            );
        }
        memory.insert("hasEmbedding".to_string(), json!(true));
        memory.insert("embeddingStatus".to_string(), json!("vectorized"));
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
    for chat in chats {
        if let Some(id) = chat.get("id").and_then(Value::as_str) {
            if is_protected_record("chats", id) {
                continue;
            }
            delete_chat_with_messages(state, id)?;
            deleted += 1;
        }
    }
    Ok(json!({ "deleted": deleted }))
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
    let group_id = object
        .get("groupId")
        .and_then(Value::as_str)
        .unwrap_or(chat_id)
        .to_string();
    object.insert("id".to_string(), Value::String(new_chat_id.clone()));
    object.insert(
        "name".to_string(),
        Value::String(format!("{base_name} Branch")),
    );
    object.insert("groupId".to_string(), Value::String(group_id));
    let source_has_tracker_snapshots =
        game_state_snapshots::latest_tracker_snapshot(state, chat_id)?.is_some();
    let mut new_chat = state.storage.create("chats", chat)?;
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

pub(crate) fn delete_chat_with_messages(state: &AppState, chat_id: &str) -> AppResult<()> {
    if is_protected_record("chats", chat_id) {
        return Err(AppError::invalid_input(
            "Protected records cannot be deleted",
        ));
    }
    let Some(root_chat) = state.storage.get("chats", chat_id)? else {
        return Ok(());
    };
    let owned_scene_chat_ids = scene_delete_scope(state, chat_id, &root_chat)?;
    clear_character_scene_memories(state, &owned_scene_chat_ids)?;
    clear_deleted_scene_references(state, chat_id, &owned_scene_chat_ids)?;

    let mut delete_ids = owned_scene_chat_ids.clone();
    delete_ids.push(chat_id.to_string());
    delete_ids.sort_unstable();
    delete_ids.dedup();

    game_state_snapshots::delete_tracker_snapshots_for_chats(state, &delete_ids)?;
    let delete_id_set = delete_ids
        .iter()
        .map(String::as_str)
        .collect::<HashSet<_>>();
    state.storage.delete_where_matching("messages", |row| {
        row.get("chatId")
            .and_then(Value::as_str)
            .is_some_and(|chat_id| delete_id_set.contains(chat_id))
    })?;

    for delete_id in delete_ids {
        state.storage.delete("chats", &delete_id)?;
    }
    Ok(())
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
    if let Some(history) = meta.get("roleplaySceneHistory").and_then(Value::as_array) {
        for entry in history {
            let record = object_or_parse(Some(entry));
            insert_owned_scene_chat_id(state, &mut delete_ids, chat_id, record.get("sceneChatId"))?;
        }
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
