use super::*;
use std::collections::HashMap;

fn imported_string_id(value: Option<&Value>, field: &str) -> AppResult<Option<String>> {
    match value {
        Some(Value::String(id)) => {
            let id = id.trim();
            if id.is_empty() {
                Ok(None)
            } else {
                Ok(Some(id.to_string()))
            }
        }
        Some(Value::Null) | None => Ok(None),
        _ => Err(AppError::invalid_input(format!(
            "Chat bulk entry {field} must be a string or null"
        ))),
    }
}

fn chat_bulk_identity_maps(
    chats: &[Value],
) -> AppResult<(HashMap<String, String>, HashMap<String, String>)> {
    let mut chat_id_map = HashMap::new();
    for entry in chats {
        let entry = entry
            .as_object()
            .ok_or_else(|| AppError::invalid_input("Chat bulk entry must be an object"))?;
        let chat = entry
            .get("chat")
            .and_then(Value::as_object)
            .ok_or_else(|| AppError::invalid_input("Chat bulk entry is missing chat"))?;
        if let Some(old_chat_id) = imported_string_id(chat.get("id"), "chat.id")? {
            chat_id_map.entry(old_chat_id).or_insert_with(new_id);
        }
    }

    let mut group_id_map = HashMap::new();
    for entry in chats {
        let entry = entry
            .as_object()
            .ok_or_else(|| AppError::invalid_input("Chat bulk entry must be an object"))?;
        let chat = entry
            .get("chat")
            .and_then(Value::as_object)
            .ok_or_else(|| AppError::invalid_input("Chat bulk entry is missing chat"))?;
        let Some(old_group_id) = imported_string_id(chat.get("groupId"), "chat.groupId")? else {
            continue;
        };
        if let Some(mapped_chat_id) = chat_id_map.get(&old_group_id) {
            group_id_map
                .entry(old_group_id)
                .or_insert_with(|| mapped_chat_id.clone());
        } else {
            group_id_map.entry(old_group_id).or_insert_with(new_id);
        }
    }

    Ok((chat_id_map, group_id_map))
}

pub(super) fn import_marinara_chat_bulk(state: &AppState, payload: Value) -> AppResult<Value> {
    let object = payload
        .as_object()
        .ok_or_else(|| AppError::invalid_input("Invalid Marinara chat bulk export"))?;
    if object.get("version").and_then(Value::as_i64) != Some(1) {
        return Err(AppError::invalid_input(
            "Unsupported Marinara chat bulk export version",
        ));
    }
    let chats = object
        .get("chats")
        .and_then(Value::as_array)
        .ok_or_else(|| AppError::invalid_input("Marinara chat bulk export is missing chats"))?;
    if chats.is_empty() {
        return Err(AppError::invalid_input(
            "Marinara chat bulk export must contain at least one chat",
        ));
    }

    let mut created_chat_ids = Vec::new();
    let mut created_message_ids = Vec::new();
    let (chat_id_map, group_id_map) = chat_bulk_identity_maps(chats)?;
    let result = (|| -> AppResult<Value> {
        let mut imported = Vec::new();
        let mut messages_imported = 0usize;
        for entry in chats {
            let entry = entry
                .as_object()
                .ok_or_else(|| AppError::invalid_input("Chat bulk entry must be an object"))?;
            let mut chat = ensure_object(
                entry
                    .get("chat")
                    .cloned()
                    .ok_or_else(|| AppError::invalid_input("Chat bulk entry is missing chat"))?,
            )?;
            let old_chat_id = imported_string_id(chat.get("id"), "chat.id")?;
            if let Some(old_chat_id) = old_chat_id.as_deref() {
                if let Some(new_chat_id) = chat_id_map.get(old_chat_id) {
                    chat.insert("id".to_string(), Value::String(new_chat_id.clone()));
                } else {
                    chat.remove("id");
                }
            } else {
                chat.remove("id");
            }
            chat.remove("rowid");
            if let Some(old_group_id) = imported_string_id(chat.get("groupId"), "chat.groupId")? {
                if let Some(new_group_id) = group_id_map.get(&old_group_id) {
                    chat.insert("groupId".to_string(), Value::String(new_group_id.clone()));
                } else {
                    chat.insert("groupId".to_string(), Value::Null);
                }
            } else {
                chat.insert("groupId".to_string(), Value::Null);
            }
            chat.insert("folderId".to_string(), Value::Null);
            let chat = with_entity_defaults("chats", Value::Object(chat))?;
            let chat_record = state.storage.create("chats", chat)?;
            let chat_id = created_record_id(&chat_record, "chat")?;
            created_chat_ids.push(chat_id.clone());

            let messages = entry
                .get("messages")
                .and_then(Value::as_array)
                .ok_or_else(|| AppError::invalid_input("Chat bulk entry is missing messages"))?;
            for message in messages {
                let mut message = ensure_object(message.clone())?;
                message.remove("id");
                message.remove("rowid");
                message.insert("chatId".to_string(), Value::String(chat_id.clone()));
                let role = super::super::bulk_imports::imported_jsonl_message_role(&Value::Object(
                    message.clone(),
                ));
                message.insert("role".to_string(), Value::String(role.to_string()));
                let created = crate::storage_commands::message_swipes::create_message(
                    state,
                    Value::Object(message),
                )?;
                created_message_ids.push(created_record_id(&created, "message")?);
                messages_imported += 1;
            }
            imported.push(json!({
                "chatId": chat_id,
                "name": chat_record.get("name").cloned().unwrap_or(Value::Null),
                "messagesImported": messages.len(),
                "chat": chat_record
            }));
        }
        flush_import_writes(state)?;
        Ok(json!({
            "success": true,
            "format": "marinara-chat-bulk",
            "count": imported.len(),
            "messagesImported": messages_imported,
            "chats": imported
        }))
    })();

    result.map_err(|error| {
        let mut rollback_errors = Vec::new();
        rollback_created_records_collect(
            state,
            "messages",
            &created_message_ids,
            &mut rollback_errors,
        );
        rollback_created_records_collect(state, "chats", &created_chat_ids, &mut rollback_errors);
        append_marinara_rollback_errors(error, "chat bulk import", rollback_errors)
    })
}
