use super::{
    avatars, characters, chats, connection_secrets, contracts, game_state_snapshots,
    lorebook_images, media_uploads, message_swipes, personas, prompts, shared,
};
use crate::builtins::is_protected_record;
use crate::state::AppState;
use marinara_core::{ensure_object, new_id, now_iso, AppError};
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use tauri::State;

fn validate_storage_entity(entity: &str) -> Result<(), AppError> {
    if contracts::collection_contract(entity).is_some() {
        Ok(())
    } else {
        Err(AppError::invalid_input(format!(
            "Unsupported storage entity: {entity}"
        )))
    }
}

fn reject_message_swipe_mutation(entity: &str) -> Result<(), AppError> {
    if entity == message_swipes::COLLECTION {
        return Err(AppError::invalid_input(
            "message-swipes is internal sidecar storage; mutate swipes through message commands",
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn storage_list(
    state: State<'_, AppState>,
    entity: String,
    options: Option<Value>,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || storage_list_inner(&state, entity, options))
        .await
        .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

pub(crate) fn storage_list_inner(
    state: &AppState,
    entity: String,
    options: Option<Value>,
) -> Result<Value, AppError> {
    validate_storage_entity(&entity)?;
    let filters = options
        .as_ref()
        .and_then(|value| value.get("filters"))
        .and_then(Value::as_object);
    let projection_fields = shared::projection_fields(options.as_ref());
    let empty_filters = filters.is_none_or(|filters| filters.is_empty());
    let has_search = shared::has_storage_search(options.as_ref());
    let mut rows = match (entity.as_str(), filters) {
        ("messages", Some(filters))
            if filters.len() == 1 && filters.get("chatId").and_then(Value::as_str).is_some() =>
        {
            let chat_id = filters
                .get("chatId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if !has_search {
                if let Some((limit, before)) = message_page_options(options.as_ref()) {
                    if let Some(fields) = projection_fields
                        .as_ref()
                        .filter(|fields| !fields.is_empty())
                    {
                        state.storage.list_messages_for_chat_page_projected(
                            chat_id,
                            limit,
                            before.as_deref(),
                            &message_projection_fields_for_materialization(
                                fields,
                                options.as_ref(),
                            ),
                            shared::projection_field_selections(options.as_ref()),
                        )?
                    } else {
                        state.storage.list_messages_for_chat_page(
                            chat_id,
                            limit,
                            before.as_deref(),
                        )?
                    }
                } else if message_id_projection_only(options.as_ref()) {
                    state.storage.list_message_ids_for_chat(chat_id)?
                } else if let Some(fields) = projection_fields
                    .as_ref()
                    .filter(|fields| !fields.is_empty())
                {
                    state.storage.list_messages_for_chat_projected(
                        chat_id,
                        &message_projection_fields_for_materialization(fields, options.as_ref()),
                        shared::projection_field_selections(options.as_ref()),
                    )?
                } else {
                    state.storage.list_messages_for_chat(chat_id)?
                }
            } else {
                state.storage.list_messages_for_chat(chat_id)?
            }
        }
        (_, _)
            if empty_filters
                && has_search
                && projection_fields
                    .as_ref()
                    .is_some_and(|fields| !fields.is_empty()) =>
        {
            let search_projection_fields = shared::search_projection_fields(options.as_ref());
            let search_projection_field_selections =
                shared::search_projection_field_selections(options.as_ref());
            state.storage.list_projected(
                &entity,
                &search_projection_fields,
                &search_projection_field_selections,
            )?
        }
        (_, _)
            if empty_filters
                && !has_search
                && projection_fields
                    .as_ref()
                    .is_some_and(|fields| !fields.is_empty()) =>
        {
            state.storage.list_projected(
                &entity,
                projection_fields.as_deref().unwrap_or(&[]),
                shared::projection_field_selections(options.as_ref()),
            )?
        }
        (_, Some(filters)) if !filters.is_empty() => state.storage.list_where(&entity, filters)?,
        _ => state.storage.list(&entity)?,
    };
    let message_materialization = message_swipes::MessageSwipeMaterialization::for_message_output(
        options.as_ref(),
        has_search,
    );
    let materialized_message_swipes_for_search = entity == "messages" && has_search;
    if materialized_message_swipes_for_search {
        message_swipes::materialize_messages_for_output(state, &mut rows, message_materialization)?;
    }
    shared::apply_storage_search(&mut rows, options.as_ref());

    let order_by = options
        .as_ref()
        .and_then(|value| value.get("orderBy"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty());
    let descending = options
        .as_ref()
        .and_then(|value| value.get("descending"))
        .and_then(Value::as_bool)
        .unwrap_or(false);

    rows.sort_by(|a, b| {
        let ordering = match order_by {
            Some(field) => compare_json_values(a.get(field), b.get(field)),
            None => compare_json_values(
                a.get("sortOrder")
                    .or_else(|| a.get("order"))
                    .or_else(|| a.get("createdAt")),
                b.get("sortOrder")
                    .or_else(|| b.get("order"))
                    .or_else(|| b.get("createdAt")),
            ),
        };
        if descending {
            ordering.reverse()
        } else {
            ordering
        }
    });

    if entity == "messages" {
        apply_message_pagination(&mut rows, options.as_ref());
        if !materialized_message_swipes_for_search {
            message_swipes::materialize_messages_for_output(
                state,
                &mut rows,
                message_materialization,
            )?;
        }
        for row in &mut rows {
            if !message_materialization.include_swipes {
                if let Some(object) = row.as_object_mut() {
                    object.remove("swipes");
                }
            }
            shared::synthesize_legacy_prompt_snapshot(row);
        }
        return Ok(Value::Array(shared::project_list_rows(
            rows,
            options.as_ref(),
        )));
    }

    if entity == "connections" {
        connection_secrets::mask_connection_rows_for_read(&mut rows);
    }

    if let Some(limit) = options
        .as_ref()
        .and_then(|value| value.get("limit"))
        .and_then(Value::as_u64)
        .map(|value| value as usize)
    {
        rows.truncate(limit);
    }

    Ok(Value::Array(shared::project_list_rows(
        rows,
        options.as_ref(),
    )))
}

#[tauri::command]
pub async fn lorebook_entries_list_by_lorebook_ids(
    state: State<'_, AppState>,
    lorebook_ids: Vec<String>,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        lorebook_entries_list_by_lorebook_ids_inner(&state, lorebook_ids)
    })
    .await
    .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

pub(crate) fn lorebook_entries_list_by_lorebook_ids_inner(
    state: &AppState,
    lorebook_ids: Vec<String>,
) -> Result<Value, AppError> {
    let lorebook_ids: HashSet<String> = lorebook_ids
        .into_iter()
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
        .collect();
    if lorebook_ids.is_empty() {
        return Ok(Value::Array(Vec::new()));
    }
    let mut rows = state
        .storage
        .list_where_in("lorebook-entries", "lorebookId", &lorebook_ids)?;
    rows.sort_by(|a, b| {
        compare_json_values(
            a.get("sortOrder")
                .or_else(|| a.get("order"))
                .or_else(|| a.get("createdAt")),
            b.get("sortOrder")
                .or_else(|| b.get("order"))
                .or_else(|| b.get("createdAt")),
        )
    });
    Ok(Value::Array(rows))
}

fn message_id_projection_only(options: Option<&Value>) -> bool {
    let Some(options) = options else {
        return false;
    };
    if options.get("limit").is_some()
        || options.get("before").is_some()
        || options.get("orderBy").is_some()
        || options.get("fieldSelections").is_some()
    {
        return false;
    }
    let Some(fields) = options.get("fields").and_then(Value::as_array) else {
        return false;
    };
    fields.len() == 1 && fields.first().and_then(Value::as_str) == Some("id")
}

fn message_projection_fields_for_materialization(
    fields: &[String],
    options: Option<&Value>,
) -> Vec<String> {
    let mut projection = fields.to_vec();
    for field in ["id", "sortOrder", "order", "createdAt"] {
        if !projection.iter().any(|existing| existing == field) {
            projection.push(field.to_string());
        }
    }
    if let Some(order_by) = options
        .and_then(|value| value.get("orderBy"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if !projection.iter().any(|existing| existing == order_by) {
            projection.push(order_by.to_string());
        }
    }
    if fields
        .iter()
        .any(|field| matches!(field.as_str(), "extra" | "swipes"))
        && !projection
            .iter()
            .any(|existing| existing == "activeSwipeIndex")
    {
        projection.push("activeSwipeIndex".to_string());
    }
    projection
}

fn message_page_options(options: Option<&Value>) -> Option<(usize, Option<String>)> {
    let options = options?;
    let limit = options.get("limit").and_then(Value::as_u64)? as usize;
    let before = options
        .get("before")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    Some((limit, before))
}

#[tauri::command]
pub async fn storage_get(
    state: State<'_, AppState>,
    entity: String,
    id: String,
    options: Option<Value>,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || storage_get_inner(&state, entity, id, options))
        .await
        .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

pub(crate) fn storage_get_inner(
    state: &AppState,
    entity: String,
    id: String,
    options: Option<Value>,
) -> Result<Value, AppError> {
    validate_storage_entity(&entity)?;
    let projection_fields = shared::projection_fields(options.as_ref());
    let mut value = if let Some(fields) = projection_fields
        .as_ref()
        .filter(|fields| !fields.is_empty())
    {
        let read_fields = storage_get_projection_fields_for_read(&entity, fields, options.as_ref());
        state
            .storage
            .get_projected(
                &entity,
                &id,
                &read_fields,
                shared::projection_field_selections(options.as_ref()),
            )?
            .unwrap_or(Value::Null)
    } else {
        state.storage.get(&entity, &id)?.unwrap_or(Value::Null)
    };
    if entity == "messages" {
        message_swipes::materialize_message_for_output(
            state,
            &mut value,
            message_swipes::MessageSwipeMaterialization::for_message_output(
                options.as_ref(),
                false,
            ),
        )?;
    }
    if entity == "connections" {
        connection_secrets::mask_connection_for_read(&mut value);
    }
    Ok(shared::project_record(value, options.as_ref()))
}

fn storage_get_projection_fields_for_read(
    entity: &str,
    fields: &[String],
    options: Option<&Value>,
) -> Vec<String> {
    let mut projection = if entity == "messages" {
        message_projection_fields_for_materialization(fields, options)
    } else {
        fields.to_vec()
    };

    if entity == "connections"
        && fields
            .iter()
            .any(|field| matches!(field.as_str(), "apiKey" | "hasApiKey"))
    {
        for field in ["apiKey", "apiKeyEncrypted"] {
            if !projection.iter().any(|existing| existing == field) {
                projection.push(field.to_string());
            }
        }
    }

    projection
}

#[tauri::command]
pub async fn storage_create(
    state: State<'_, AppState>,
    entity: String,
    value: Value,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || storage_create_inner(&state, entity, value))
        .await
        .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

pub(crate) fn storage_create_inner(
    state: &AppState,
    entity: String,
    value: Value,
) -> Result<Value, AppError> {
    validate_storage_entity(&entity)?;
    reject_message_swipe_mutation(&entity)?;
    validate_connection_folder_for_create(state, &entity, &value)?;
    if entity == "messages" {
        return Ok(shared::project_timeline_message(
            message_swipes::create_message(
                state,
                prepare_entity_for_create(state, &entity, value)?,
            )?,
        ));
    }
    let should_remove_prepared_gallery_file = gallery_create_persists_inline_image(&entity, &value);
    let prepared = prepare_entity_for_create(state, &entity, value)?;
    if entity == "lorebook-entries" {
        return create_lorebook_entry_with_character_book_sync(state, prepared);
    }
    let create_result = if should_remove_prepared_gallery_file {
        state.storage.create_immediate(&entity, prepared.clone())
    } else {
        state.storage.create(&entity, prepared.clone())
    };
    let created = match create_result {
        Ok(created) => created,
        Err(error) => {
            if should_remove_prepared_gallery_file {
                remove_gallery_file(state, &prepared);
            }
            return Err(error);
        }
    };
    if entity == "connections" {
        clear_other_default_agent_connections(state, &created)?;
        let mut masked = created;
        connection_secrets::mask_connection_for_read(&mut masked);
        return Ok(masked);
    }
    Ok(created)
}

#[tauri::command]
pub async fn storage_update(
    state: State<'_, AppState>,
    entity: String,
    id: String,
    patch: Value,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || storage_update_inner(&state, entity, id, patch))
        .await
        .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

pub(crate) fn storage_update_inner(
    state: &AppState,
    entity: String,
    id: String,
    patch: Value,
) -> Result<Value, AppError> {
    validate_storage_entity(&entity)?;
    reject_message_swipe_mutation(&entity)?;
    if entity == "messages" {
        return Ok(shared::project_timeline_message(
            message_swipes::patch_message_update(state, &id, patch)?,
        ));
    }
    if entity == "characters" {
        return characters::update_character(state, &id, patch);
    }
    if entity == "chat-presets" {
        return patch_chat_preset(state, &id, patch);
    }
    validate_connection_folder_for_patch(state, &entity, &patch)?;
    let normalized_patch = shared::normalize_update_patch(&entity, patch)?;
    if entity == "lorebook-entries" {
        return update_lorebook_entry_with_character_book_sync(state, &id, normalized_patch);
    }
    let updated = if entity == "connections" {
        connection_secrets::patch_connection(state, &id, normalized_patch)?
    } else {
        state.storage.patch(&entity, &id, normalized_patch)?
    };
    if entity == "connections" {
        clear_other_default_agent_connections(state, &updated)?;
    }
    Ok(updated)
}

pub(crate) fn prepare_entity_for_create(
    state: &AppState,
    entity: &str,
    value: Value,
) -> Result<Value, AppError> {
    let value = shared::with_entity_defaults(entity, value)?;
    match entity {
        "connections" => connection_secrets::prepare_connection_for_create(state, value),
        "connection-folders" => connection_folder_defaults_for_create(state, value),
        "gallery" | "character-gallery" => gallery_defaults_for_create(state, value),
        _ => Ok(value),
    }
}

fn gallery_defaults_for_create(state: &AppState, value: Value) -> Result<Value, AppError> {
    let mut object = ensure_object(value)?;
    let Some(url) = object
        .get("url")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| value.starts_with("data:image/"))
        .map(str::to_string)
    else {
        return Ok(Value::Object(object));
    };

    let (mime, bytes) = media_uploads::decode_image_payload(&url, "url")?;
    let filename_hint = object
        .get("filename")
        .or_else(|| object.get("filePath"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("gallery-image");
    let stored =
        media_uploads::persist_image_bytes(state, "gallery", filename_hint, &bytes, &mime)?;

    object.insert("url".to_string(), Value::String(stored.asset_url));
    object.insert("filePath".to_string(), Value::String(stored.absolute_path));
    object.insert("filename".to_string(), Value::String(stored.filename));
    Ok(Value::Object(object))
}

fn gallery_create_persists_inline_image(entity: &str, value: &Value) -> bool {
    matches!(entity, "gallery" | "character-gallery")
        && value
            .get("url")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_some_and(|value| value.starts_with("data:image/"))
}

fn connection_folder_defaults_for_create(
    state: &AppState,
    value: Value,
) -> Result<Value, AppError> {
    let mut object = ensure_object(value)?;
    if object
        .get("sortOrder")
        .and_then(Value::as_i64)
        .is_none_or(|value| value <= 0)
    {
        let next_order = state
            .storage
            .list("connection-folders")?
            .into_iter()
            .filter_map(|folder| {
                folder
                    .get("sortOrder")
                    .or_else(|| folder.get("order"))
                    .and_then(Value::as_i64)
            })
            .max()
            .map(|value| value + 1)
            .unwrap_or(0);
        object.insert("sortOrder".to_string(), json!(next_order));
        object.insert("order".to_string(), json!(next_order));
    }
    Ok(Value::Object(object))
}

pub(crate) fn validate_connection_folder_for_create(
    state: &AppState,
    entity: &str,
    value: &Value,
) -> Result<(), AppError> {
    if entity != "connections" {
        return Ok(());
    }
    validate_connection_folder_id(state, value.get("folderId"))
}

pub(crate) fn validate_connection_folder_for_patch(
    state: &AppState,
    entity: &str,
    patch: &Value,
) -> Result<(), AppError> {
    if entity != "connections"
        || !patch
            .as_object()
            .is_some_and(|object| object.contains_key("folderId"))
    {
        return Ok(());
    }
    validate_connection_folder_id(state, patch.get("folderId"))
}

fn validate_connection_folder_id(
    state: &AppState,
    folder_id: Option<&Value>,
) -> Result<(), AppError> {
    let Some(folder_id) = folder_id else {
        return Ok(());
    };
    if folder_id.is_null() {
        return Ok(());
    }
    let Some(folder_id) = folder_id
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    else {
        return Err(AppError::invalid_input(
            "folderId must be a folder id or null",
        ));
    };
    if state
        .storage
        .get("connection-folders", folder_id)?
        .is_none()
    {
        return Err(AppError::invalid_input(format!(
            "Connection folder {folder_id} does not exist"
        )));
    }
    Ok(())
}

fn connection_default_agent_scope(connection: &Value) -> Option<&'static str> {
    let provider = connection.get("provider").and_then(Value::as_str)?.trim();
    Some(if provider == "image_generation" {
        "image"
    } else {
        "language"
    })
}

fn connection_default_for_agents_enabled(connection: &Value) -> bool {
    connection
        .get("defaultForAgents")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn clear_other_default_agent_connections(
    state: &AppState,
    selected_connection: &Value,
) -> Result<(), AppError> {
    if !connection_default_for_agents_enabled(selected_connection) {
        return Ok(());
    }
    let Some(selected_id) = selected_connection
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
    else {
        return Ok(());
    };
    let Some(selected_scope) = connection_default_agent_scope(selected_connection) else {
        return Ok(());
    };
    for connection in state.storage.list("connections")? {
        let Some(id) = connection
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| *id != selected_id)
        else {
            continue;
        };
        if !connection_default_for_agents_enabled(&connection) {
            continue;
        }
        if connection_default_agent_scope(&connection) != Some(selected_scope) {
            continue;
        }
        state
            .storage
            .patch("connections", id, json!({ "defaultForAgents": false }))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn storage_delete(
    state: State<'_, AppState>,
    entity: String,
    id: String,
    force: Option<bool>,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        delete_entity(&state, &entity, &id, force.unwrap_or(false))
    })
    .await
    .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

pub(crate) fn delete_entity(
    state: &AppState,
    entity: &str,
    id: &str,
    force: bool,
) -> Result<Value, AppError> {
    validate_storage_entity(entity)?;
    reject_message_swipe_mutation(entity)?;
    if entity == "connections" {
        return crate::connection_refs::delete_connection(state, id, force);
    }
    if entity == "chats" {
        let existed = state.storage.get("chats", id)?.is_some();
        let mut deleted_chat_ids = Vec::new();
        if existed {
            deleted_chat_ids = chats::delete_chat_with_messages(state, id)?;
        }
        return Ok(json!({ "deleted": existed, "deletedChatIds": deleted_chat_ids }));
    }
    if is_protected_record(entity, id) {
        return Err(AppError::invalid_input(
            "Protected records cannot be deleted",
        ));
    }
    if entity == "chat-presets" && chat_preset_is_default_id(state, id)? {
        return Err(AppError::invalid_input(
            "Default chat presets cannot be deleted",
        ));
    }
    if entity == "lorebook-entries" {
        let deleted = delete_lorebook_entry_with_character_book_sync(state, id)?;
        return Ok(json!({ "deleted": deleted }));
    }
    let existing = owned_record_for_delete(state, entity, id)?;
    let message_chat_id = if entity == "messages" {
        existing
            .as_ref()
            .and_then(|record| record.get("chatId"))
            .and_then(Value::as_str)
            .map(str::to_string)
    } else {
        None
    };
    let deleted = if entity == "messages" {
        message_swipes::delete_message_rows_with_swipes(state, &[id.to_string()])? > 0
    } else {
        state.storage.delete(entity, id)?
    };
    if deleted {
        apply_delete_cleanup(
            state,
            entity,
            id,
            existing.as_ref(),
            message_chat_id.as_deref(),
        )?;
    }
    Ok(json!({ "deleted": deleted }))
}

fn apply_delete_cleanup(
    state: &AppState,
    entity: &str,
    id: &str,
    existing: Option<&Value>,
    message_chat_id: Option<&str>,
) -> Result<(), AppError> {
    let Some(contract) = contracts::collection_contract(entity) else {
        return Ok(());
    };
    for cleanup in contract.delete_cleanup {
        match cleanup {
            contracts::DeleteCleanup::ActivateDefaultChatPreset => {
                if let Some(record) = existing {
                    activate_default_chat_preset_if_needed(state, record)?;
                }
            }
            contracts::DeleteCleanup::ClearConnectionFolder => {
                unfile_connections_in_folder(state, id)?
            }
            contracts::DeleteCleanup::ClearLorebookReferences => {
                clear_deleted_lorebook_references(state, id)?;
            }
            contracts::DeleteCleanup::DeleteCharacterGallery => {
                delete_character_gallery(state, id)?
            }
            contracts::DeleteCleanup::DeleteLorebookChildren => {
                delete_lorebook_children(state, id)?
            }
            contracts::DeleteCleanup::DeleteMessageTrackerSnapshots => {
                if let Some(chat_id) = message_chat_id {
                    game_state_snapshots::delete_tracker_snapshots_for_message(state, chat_id, id)?;
                    game_state_snapshots::sync_chat_game_state_to_visible_tracker(state, chat_id)?;
                }
            }
            contracts::DeleteCleanup::DeletePromptChildren => {
                prompts::delete_prompt_preset_children(state, id)?;
            }
            contracts::DeleteCleanup::RemoveOwnedMedia => {
                if let Some(record) = existing {
                    remove_owned_media(state, entity, record);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn connection_folder_reorder(
    state: State<'_, AppState>,
    ordered_ids: Vec<String>,
) -> Result<Value, AppError> {
    connection_folder_reorder_inner(&state, ordered_ids)
}

pub(crate) fn connection_folder_reorder_inner(
    state: &AppState,
    ordered_ids: Vec<String>,
) -> Result<Value, AppError> {
    validate_connection_folder_reorder(state, &ordered_ids)?;
    let patches = ordered_ids
        .into_iter()
        .enumerate()
        .map(|(index, id)| (id, json!({ "sortOrder": index, "order": index })))
        .collect::<Vec<_>>();
    let rows = state.storage.patch_many("connection-folders", patches)?;
    Ok(Value::Array(rows))
}

fn validate_connection_folder_reorder(
    state: &AppState,
    ordered_ids: &[String],
) -> Result<(), AppError> {
    let mut seen = HashSet::with_capacity(ordered_ids.len());
    if ordered_ids
        .iter()
        .any(|id| id.trim().is_empty() || !seen.insert(id.as_str()))
    {
        return Err(AppError::invalid_input(
            "Connection folder reorder must include each folder id exactly once",
        ));
    }

    let existing_ids = state
        .storage
        .list("connection-folders")?
        .into_iter()
        .filter_map(|folder| {
            folder
                .get("id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .collect::<HashSet<_>>();
    let ordered_ids = ordered_ids.iter().cloned().collect::<HashSet<_>>();
    if existing_ids != ordered_ids {
        return Err(AppError::invalid_input(
            "Connection folder reorder must include every existing folder exactly once",
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn connection_move(
    state: State<'_, AppState>,
    connection_id: String,
    folder_id: Option<String>,
) -> Result<Value, AppError> {
    connection_move_inner(&state, &connection_id, folder_id)
}

pub(crate) fn connection_move_inner(
    state: &AppState,
    connection_id: &str,
    folder_id: Option<String>,
) -> Result<Value, AppError> {
    let folder_value = folder_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| Value::String(value.to_string()))
        .unwrap_or(Value::Null);
    validate_connection_folder_id(state, Some(&folder_value))?;
    connection_secrets::patch_connection(state, connection_id, json!({ "folderId": folder_value }))
}

fn unfile_connections_in_folder(state: &AppState, folder_id: &str) -> Result<(), AppError> {
    let mut filters = Map::new();
    filters.insert("folderId".to_string(), Value::String(folder_id.to_string()));
    let rows = state.storage.list_where("connections", &filters)?;
    let patches = rows
        .into_iter()
        .filter_map(|row| row.get("id").and_then(Value::as_str).map(str::to_string))
        .map(|id| (id, json!({ "folderId": Value::Null })))
        .collect::<Vec<_>>();
    if !patches.is_empty() {
        state.storage.patch_many("connections", patches)?;
    }
    Ok(())
}

fn delete_character_gallery(state: &AppState, character_id: &str) -> Result<(), AppError> {
    let mut filters = Map::new();
    filters.insert(
        "characterId".to_string(),
        Value::String(character_id.to_string()),
    );
    let rows = state.storage.list_where("character-gallery", &filters)?;
    for row in &rows {
        remove_gallery_file(state, row);
    }
    state.storage.delete_where("character-gallery", &filters)?;
    Ok(())
}

fn delete_lorebook_children(state: &AppState, lorebook_id: &str) -> Result<(), AppError> {
    let mut filters = Map::new();
    filters.insert(
        "lorebookId".to_string(),
        Value::String(lorebook_id.to_string()),
    );
    state.storage.delete_where("lorebook-entries", &filters)?;
    state.storage.delete_where("lorebook-folders", &filters)?;
    Ok(())
}

fn lorebook_entry_lorebook_id(entry: &Value) -> Option<&str> {
    entry
        .get("lorebookId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn create_lorebook_entry_with_character_book_sync(
    state: &AppState,
    value: Value,
) -> Result<Value, AppError> {
    let mut object = ensure_object(value)?;
    let had_id = object
        .get("id")
        .and_then(Value::as_str)
        .is_some_and(|id| !id.trim().is_empty());
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(new_id);
    let now = now_iso();
    object.insert("id".to_string(), Value::String(id.clone()));
    object
        .entry("createdAt".to_string())
        .or_insert_with(|| Value::String(now.clone()));
    object
        .entry("updatedAt".to_string())
        .or_insert_with(|| Value::String(now));
    let record = Value::Object(object);
    let created = record.clone();
    state.storage.update_collections_atomically(
        vec!["lorebook-entries", "characters"],
        move |collections| {
            let (entry_rows, character_rows) = lorebook_entry_atomic_rows(collections)?;
            if had_id
                && entry_rows
                    .iter()
                    .any(|row| row.get("id").and_then(Value::as_str) == Some(id.as_str()))
            {
                return Err(AppError::invalid_input(format!(
                    "lorebook-entries/{id} already exists"
                )));
            }
            entry_rows.retain(|row| row.get("id").and_then(Value::as_str) != Some(id.as_str()));
            entry_rows.push(record);
            sync_linked_character_books_for_entry_rows_in_place(
                character_rows,
                entry_rows,
                &[&created],
            )?;
            Ok(created)
        },
    )
}

fn update_lorebook_entry_with_character_book_sync(
    state: &AppState,
    id: &str,
    patch: Value,
) -> Result<Value, AppError> {
    let patch = ensure_object(patch)?;
    state.storage.update_collections_atomically(
        vec!["lorebook-entries", "characters"],
        move |collections| {
            let (entry_rows, character_rows) = lorebook_entry_atomic_rows(collections)?;
            let previous = entry_rows
                .iter()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(id))
                .cloned()
                .ok_or_else(|| {
                    AppError::not_found(format!("lorebook-entries/{id} was not found"))
                })?;
            let row = entry_rows
                .iter_mut()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(id))
                .ok_or_else(|| {
                    AppError::not_found(format!("lorebook-entries/{id} was not found"))
                })?;
            let Some(object) = row.as_object_mut() else {
                return Err(AppError::invalid_input("Stored record is not an object"));
            };
            for (key, value) in patch {
                object.insert(key, value);
            }
            object.insert("updatedAt".to_string(), Value::String(now_iso()));
            let updated = Value::Object(object.clone());
            sync_linked_character_books_for_entry_rows_in_place(
                character_rows,
                entry_rows,
                &[&previous, &updated],
            )?;
            Ok(updated)
        },
    )
}

fn delete_lorebook_entry_with_character_book_sync(
    state: &AppState,
    id: &str,
) -> Result<bool, AppError> {
    state.storage.update_collections_atomically(
        vec!["lorebook-entries", "characters"],
        move |collections| {
            let (entry_rows, character_rows) = lorebook_entry_atomic_rows(collections)?;
            let previous = entry_rows
                .iter()
                .find(|row| row.get("id").and_then(Value::as_str) == Some(id))
                .cloned();
            let before = entry_rows.len();
            entry_rows.retain(|row| row.get("id").and_then(Value::as_str) != Some(id));
            let deleted = entry_rows.len() != before;
            if let Some(previous) = previous.as_ref().filter(|_| deleted) {
                sync_linked_character_books_for_entry_rows_in_place(
                    character_rows,
                    entry_rows,
                    &[previous],
                )?;
            }
            Ok(deleted)
        },
    )
}

fn lorebook_entry_atomic_rows(
    collections: &mut [marinara_storage::AtomicCollectionRows],
) -> Result<(&mut Vec<Value>, &mut Vec<Value>), AppError> {
    let [left, right] = collections else {
        return Err(AppError::new(
            "storage_error",
            "Lorebook entry sync expected lorebook and character collections",
        ));
    };
    match (left.collection(), right.collection()) {
        ("lorebook-entries", "characters") => Ok((left.rows_mut(), right.rows_mut())),
        _ => Err(AppError::new(
            "storage_error",
            "Lorebook entry sync received unexpected collections",
        )),
    }
}

fn sync_linked_character_books_for_entry_rows_in_place(
    character_rows: &mut [Value],
    all_entry_rows: &[Value],
    entries: &[&Value],
) -> Result<(), AppError> {
    let lorebook_ids = entries
        .iter()
        .filter_map(|entry| lorebook_entry_lorebook_id(entry))
        .collect::<HashSet<_>>();
    for lorebook_id in lorebook_ids {
        sync_linked_character_books_for_lorebook_in_place(
            character_rows,
            all_entry_rows,
            lorebook_id,
        )?;
    }
    Ok(())
}

fn sync_linked_character_books_for_lorebook_in_place(
    character_rows: &mut [Value],
    all_entry_rows: &[Value],
    lorebook_id: &str,
) -> Result<(), AppError> {
    let mut entries = all_entry_rows
        .iter()
        .filter(|entry| lorebook_entry_lorebook_id(entry) == Some(lorebook_id))
        .cloned()
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| {
        compare_json_values(
            left.get("sortOrder").or_else(|| left.get("order")),
            right.get("sortOrder").or_else(|| right.get("order")),
        )
        .then_with(|| compare_json_values(left.get("createdAt"), right.get("createdAt")))
    });

    for character in character_rows {
        let Some(character_id) = character.get("id").and_then(Value::as_str) else {
            continue;
        };
        let mut data = character.get("data").cloned().unwrap_or_else(|| json!({}));
        if embedded_lorebook_id(&data) != Some(lorebook_id) {
            continue;
        }
        let Some(data_object) = data.as_object_mut() else {
            continue;
        };
        let mut book = match data_object.get("character_book") {
            Some(Value::Null) | None => Map::new(),
            Some(Value::Object(book)) => book.clone(),
            Some(_) => {
                return Err(AppError::invalid_input(format!(
                    "Character {character_id} has a malformed embedded lorebook"
                )));
            }
        };
        book.insert(
            "entries".to_string(),
            Value::Array(
                entries
                    .iter()
                    .enumerate()
                    .map(|(index, entry)| linked_character_book_entry(entry, index))
                    .collect(),
            ),
        );
        data_object.insert("character_book".to_string(), Value::Object(book));

        if let Some(import_metadata) = data
            .pointer_mut("/extensions/importMetadata/embeddedLorebook")
            .and_then(Value::as_object_mut)
        {
            import_metadata.insert("entriesImported".to_string(), json!(entries.len()));
            import_metadata.insert("hasEmbeddedLorebook".to_string(), Value::Bool(true));
        }
        let Some(character_object) = character.as_object_mut() else {
            return Err(AppError::invalid_input(
                "Stored character record is not an object",
            ));
        };
        character_object.insert("data".to_string(), data);
        character_object.insert("updatedAt".to_string(), Value::String(now_iso()));
    }
    Ok(())
}

fn linked_character_book_entry(entry: &Value, index: usize) -> Value {
    let name = entry
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Entry");
    json!({
        "keys": shared::string_array_from_value(entry.get("keys")),
        "content": entry.get("content").and_then(Value::as_str).unwrap_or(""),
        "extensions": entry.get("extensions").cloned().unwrap_or_else(|| json!({})),
        "enabled": entry.get("enabled").and_then(Value::as_bool).unwrap_or(true),
        "insertion_order": entry.get("order").or_else(|| entry.get("sortOrder")).and_then(Value::as_i64).unwrap_or(index as i64),
        "case_sensitive": entry.get("caseSensitive").and_then(Value::as_bool).unwrap_or(false),
        "name": name,
        "priority": entry.get("priority").and_then(Value::as_i64).unwrap_or(100),
        "id": index as i64,
        "comment": entry.get("comment").and_then(Value::as_str).unwrap_or(name),
        "selective": entry.get("selective").and_then(Value::as_bool).unwrap_or(false),
        "secondary_keys": shared::string_array_from_value(entry.get("secondaryKeys")),
        "constant": entry.get("constant").and_then(Value::as_bool).unwrap_or(false),
        "position": linked_character_book_position(entry.get("position")),
    })
}

fn linked_character_book_position(value: Option<&Value>) -> &'static str {
    match value {
        Some(Value::String(raw)) if raw == "after_char" => "after_char",
        Some(Value::Number(raw)) if raw.as_i64() == Some(1) => "after_char",
        _ => "before_char",
    }
}

fn remove_string_from_json_array(value: Option<&Value>, removed_id: &str) -> Option<Value> {
    let array = value?.as_array()?;
    let filtered = array
        .iter()
        .filter_map(Value::as_str)
        .filter(|id| *id != removed_id)
        .map(|id| Value::String(id.to_string()))
        .collect::<Vec<_>>();
    (filtered.len() != array.len()).then_some(Value::Array(filtered))
}

fn clear_deleted_lorebook_from_chats(state: &AppState, lorebook_id: &str) -> Result<(), AppError> {
    for chat in state.storage.list("chats")? {
        let Some(chat_id) = chat.get("id").and_then(Value::as_str) else {
            continue;
        };
        let mut patch = Map::new();
        if let Some(active_ids) =
            remove_string_from_json_array(chat.get("activeLorebookIds"), lorebook_id)
        {
            patch.insert("activeLorebookIds".to_string(), active_ids);
        }

        let mut metadata = chat
            .get("metadata")
            .and_then(|value| shared::json_object_value(Some(value)))
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default();
        if let Some(active_ids) =
            remove_string_from_json_array(metadata.get("activeLorebookIds"), lorebook_id)
        {
            metadata.insert("activeLorebookIds".to_string(), active_ids);
            patch.insert("metadata".to_string(), Value::Object(metadata));
        }

        if !patch.is_empty() {
            state
                .storage
                .patch("chats", chat_id, Value::Object(patch))?;
        }
    }
    Ok(())
}

fn embedded_lorebook_id(data: &Value) -> Option<&str> {
    data.pointer("/extensions/importMetadata/embeddedLorebook/lorebookId")
        .and_then(Value::as_str)
}

fn clear_deleted_lorebook_from_characters(
    state: &AppState,
    lorebook_id: &str,
) -> Result<(), AppError> {
    for character in state.storage.list("characters")? {
        let Some(character_id) = character.get("id").and_then(Value::as_str) else {
            continue;
        };
        let mut data = character.get("data").cloned().unwrap_or_else(|| json!({}));
        if embedded_lorebook_id(&data) != Some(lorebook_id) {
            continue;
        }
        let Some(data_object) = data.as_object_mut() else {
            continue;
        };
        data_object.insert("character_book".to_string(), Value::Null);
        if let Some(import_metadata) = data
            .pointer_mut("/extensions/importMetadata")
            .and_then(Value::as_object_mut)
        {
            import_metadata.remove("embeddedLorebook");
        }
        state
            .storage
            .patch("characters", character_id, json!({ "data": data }))?;
    }
    Ok(())
}

fn clear_deleted_lorebook_references(state: &AppState, lorebook_id: &str) -> Result<(), AppError> {
    clear_deleted_lorebook_from_chats(state, lorebook_id)?;
    clear_deleted_lorebook_from_characters(state, lorebook_id)?;
    Ok(())
}

fn owned_record_for_delete(
    state: &AppState,
    entity: &str,
    id: &str,
) -> Result<Option<Value>, AppError> {
    let Some(contract) = contracts::collection_contract(entity) else {
        return Ok(None);
    };
    if contract
        .delete_cleanup
        .iter()
        .any(delete_cleanup_needs_existing_record)
    {
        state.storage.get(entity, id)
    } else {
        Ok(None)
    }
}

fn delete_cleanup_needs_existing_record(cleanup: &contracts::DeleteCleanup) -> bool {
    matches!(
        cleanup,
        contracts::DeleteCleanup::ActivateDefaultChatPreset
            | contracts::DeleteCleanup::DeleteMessageTrackerSnapshots
            | contracts::DeleteCleanup::RemoveOwnedMedia
    )
}

fn remove_owned_media(state: &AppState, entity: &str, record: &Value) {
    match entity {
        "characters" => avatars::remove_avatar_file(state, entity, record),
        "personas" => {
            avatars::remove_avatar_file_preserving_persona_snapshots(state, entity, record)
        }
        "lorebooks" => lorebook_images::remove_lorebook_image_file(state, record),
        "gallery" | "character-gallery" => remove_gallery_file(state, record),
        _ => {}
    }
}

fn remove_gallery_file(state: &AppState, record: &Value) {
    media_uploads::remove_managed_record_file(state, "gallery", record, "filePath", "filename");
}

#[tauri::command]
pub async fn storage_duplicate(
    state: State<'_, AppState>,
    entity: String,
    id: String,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || duplicate_entity(&state, &entity, &id))
        .await
        .map_err(|error| AppError::new("task_join_error", error.to_string()))?
}

pub(crate) fn duplicate_entity(
    state: &AppState,
    entity: &str,
    id: &str,
) -> Result<Value, AppError> {
    validate_storage_entity(entity)?;
    reject_message_swipe_mutation(entity)?;
    if entity == "characters" {
        return characters::duplicate_character(state, id);
    }
    if entity == "personas" {
        return personas::duplicate_persona(state, id);
    }
    if entity == "prompts" {
        return prompts::duplicate_prompt_preset(state, id);
    }
    if entity == "chat-presets" {
        return duplicate_chat_preset(state, id);
    }
    if entity == "connections" {
        return duplicate_connection(state, id);
    }
    if entity == "messages" {
        return duplicate_message(state, id);
    }
    let duplicated = shared::duplicate_record(state, entity, id)?;
    Ok(duplicated)
}

fn duplicate_message(state: &AppState, id: &str) -> Result<Value, AppError> {
    let mut record = shared::get_required(state, "messages", id)?;
    message_swipes::materialize_message(state, &mut record, true)?;
    let object = record
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Message is not an object"))?;
    object.remove("id");
    let duplicated = message_swipes::create_message(state, record)?;
    Ok(shared::project_timeline_message(duplicated))
}

fn duplicate_connection(state: &AppState, id: &str) -> Result<Value, AppError> {
    let mut record = shared::get_required(state, "connections", id)?;
    let object = record
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Connection is not an object"))?;
    object.remove("id");
    if let Some(name) = object
        .get("name")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        object.insert("name".to_string(), Value::String(format!("{name} Copy")));
    }
    object.insert("isDefault".to_string(), Value::Bool(false));
    object.insert("default".to_string(), Value::Bool(false));
    object.insert("defaultForAgents".to_string(), Value::Bool(false));

    let prepared = connection_secrets::prepare_connection_for_create(state, record)?;
    let mut duplicated = state.storage.create("connections", prepared)?;
    connection_secrets::mask_connection_for_read(&mut duplicated);
    Ok(duplicated)
}

fn patch_chat_preset(state: &AppState, id: &str, patch: Value) -> Result<Value, AppError> {
    let existing = shared::get_required(state, "chat-presets", id)?;
    let normalized = shared::normalize_update_patch("chat-presets", patch)?;
    if chat_preset_is_default(&existing) && chat_preset_patch_mutates_default_fields(&normalized) {
        return Err(AppError::invalid_input(
            "Default chat presets cannot be updated",
        ));
    }
    state.storage.patch("chat-presets", id, normalized)
}

fn duplicate_chat_preset(state: &AppState, id: &str) -> Result<Value, AppError> {
    let mut record = shared::get_required(state, "chat-presets", id)?;
    let object = record
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Chat preset is not an object"))?;
    object.remove("id");
    if let Some(name) = object
        .get("name")
        .and_then(Value::as_str)
        .map(str::to_string)
    {
        object.insert("name".to_string(), Value::String(format!("{name} Copy")));
    }
    object.insert("isDefault".to_string(), Value::Bool(false));
    object.insert("default".to_string(), Value::Bool(false));
    object.insert("isActive".to_string(), Value::Bool(false));
    object.insert("active".to_string(), Value::Bool(false));
    state.storage.create("chat-presets", record)
}

fn chat_preset_patch_mutates_default_fields(patch: &Value) -> bool {
    let Some(object) = patch.as_object() else {
        return true;
    };
    object
        .keys()
        .any(|key| !matches!(key.as_str(), "isActive" | "active" | "updatedAt"))
}

fn chat_preset_is_default_id(state: &AppState, id: &str) -> Result<bool, AppError> {
    Ok(state
        .storage
        .get("chat-presets", id)?
        .as_ref()
        .is_some_and(chat_preset_is_default))
}

fn chat_preset_is_default(record: &Value) -> bool {
    value_truthy(record.get("isDefault")) || value_truthy(record.get("default"))
}

fn chat_preset_is_active(record: &Value) -> bool {
    value_truthy(record.get("isActive")) || value_truthy(record.get("active"))
}

fn value_truthy(value: Option<&Value>) -> bool {
    match value {
        Some(Value::Bool(value)) => *value,
        Some(Value::String(value)) => {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "true" | "1" | "yes" | "on"
            )
        }
        Some(Value::Number(value)) => value.as_i64().is_some_and(|number| number != 0),
        _ => false,
    }
}

fn activate_default_chat_preset_if_needed(
    state: &AppState,
    deleted: &Value,
) -> Result<(), AppError> {
    if !chat_preset_is_active(deleted) {
        return Ok(());
    }
    let Some(mode) = deleted.get("mode").and_then(Value::as_str) else {
        return Ok(());
    };
    let default = state.storage.list("chat-presets")?.into_iter().find(|row| {
        row.get("mode").and_then(Value::as_str) == Some(mode) && chat_preset_is_default(row)
    });
    let Some(default_id) = default
        .as_ref()
        .and_then(|row| row.get("id"))
        .and_then(Value::as_str)
    else {
        return Ok(());
    };
    state.storage.patch(
        "chat-presets",
        default_id,
        json!({
            "isActive": true,
            "active": true
        }),
    )?;
    Ok(())
}

fn compare_json_values(left: Option<&Value>, right: Option<&Value>) -> std::cmp::Ordering {
    match (left, right) {
        (Some(Value::Number(a)), Some(Value::Number(b))) => a
            .as_f64()
            .partial_cmp(&b.as_f64())
            .unwrap_or(std::cmp::Ordering::Equal),
        (Some(Value::String(a)), Some(Value::String(b))) => a.cmp(b),
        (Some(Value::Bool(a)), Some(Value::Bool(b))) => a.cmp(b),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        _ => std::cmp::Ordering::Equal,
    }
}

fn apply_message_pagination(rows: &mut Vec<Value>, options: Option<&Value>) {
    rows.sort_by(|a, b| {
        let (a_created_at, a_id) = message_cursor(a);
        let (b_created_at, b_id) = message_cursor(b);
        a_created_at.cmp(b_created_at).then_with(|| a_id.cmp(b_id))
    });

    let before = options
        .and_then(|value| value.get("before"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(parse_message_cursor);

    if let Some((before_created_at, before_id)) = before {
        rows.retain(|row| {
            let (created_at, id) = message_cursor(row);
            created_at < before_created_at.as_str()
                || (created_at == before_created_at.as_str()
                    && before_id.as_deref().is_some_and(|cursor_id| id < cursor_id))
        });
    }

    let Some(limit) = options
        .and_then(|value| value.get("limit"))
        .and_then(Value::as_u64)
        .map(|value| value as usize)
    else {
        return;
    };

    if rows.len() > limit {
        let keep_from = rows.len() - limit;
        rows.drain(0..keep_from);
    }
}

fn parse_message_cursor(cursor: &str) -> (String, Option<String>) {
    let mut parts = cursor.splitn(2, '|');
    let created_at = parts.next().unwrap_or_default().to_string();
    let id = parts
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    (created_at, id)
}

fn message_cursor(row: &Value) -> (&str, &str) {
    (
        row.get("createdAt").and_then(Value::as_str).unwrap_or(""),
        row.get("id").and_then(Value::as_str).unwrap_or(""),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-entities-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn ids_for_lorebook(state: &AppState, collection: &str, lorebook_id: &str) -> Vec<String> {
        let mut filters = Map::new();
        filters.insert(
            "lorebookId".to_string(),
            Value::String(lorebook_id.to_string()),
        );
        state
            .storage
            .list_where(collection, &filters)
            .expect("collection should be readable")
            .into_iter()
            .filter_map(|row| row.get("id").and_then(Value::as_str).map(str::to_string))
            .collect()
    }

    fn default_for_agents(state: &AppState, id: &str) -> bool {
        state
            .storage
            .get("connections", id)
            .expect("connection should read")
            .and_then(|row| row.get("defaultForAgents").and_then(Value::as_bool))
            .unwrap_or(false)
    }

    fn seed_linked_character_book(state: &AppState) {
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "character-1",
                    "name": "Mira",
                    "data": {
                        "name": "Mira",
                        "character_book": {
                            "entries": [
                                {
                                    "name": "Old",
                                    "comment": "Old",
                                    "content": "old text",
                                    "keys": ["old"],
                                    "secondary_keys": []
                                }
                            ]
                        },
                        "extensions": {
                            "importMetadata": {
                                "embeddedLorebook": {
                                    "hasEmbeddedLorebook": true,
                                    "lorebookId": "linked-book",
                                    "entriesImported": 1
                                }
                            }
                        }
                    }
                }),
            )
            .expect("character should seed");
        state
            .storage
            .create(
                "lorebooks",
                json!({
                    "id": "linked-book",
                    "name": "Mira Lorebook",
                    "category": "character",
                    "sourceCharacterId": "character-1"
                }),
            )
            .expect("lorebook should seed");
    }

    fn character_book_entries(state: &AppState) -> Vec<Value> {
        state
            .storage
            .get("characters", "character-1")
            .expect("character should read")
            .and_then(|character| {
                character
                    .pointer("/data/character_book/entries")
                    .and_then(Value::as_array)
                    .cloned()
            })
            .unwrap_or_default()
    }

    fn first_character_book_entry(state: &AppState) -> Value {
        character_book_entries(state)
            .into_iter()
            .next()
            .expect("character book should have an entry")
    }

    fn entry_exists(state: &AppState, id: &str) -> bool {
        state
            .storage
            .get("lorebook-entries", id)
            .expect("entry lookup should not fail")
            .is_some()
    }

    fn cleanup_registered(collection: &str, cleanup: contracts::DeleteCleanup) -> bool {
        contracts::collection_contract(collection)
            .expect("collection should be registered")
            .delete_cleanup
            .contains(&cleanup)
    }

    #[test]
    fn creating_linked_lorebook_entry_syncs_character_book() {
        let state = test_state("linked-character-book-entry-create");
        seed_linked_character_book(&state);

        storage_create_inner(
            &state,
            "lorebook-entries".to_string(),
            json!({
                "lorebookId": "linked-book",
                "name": "Moon",
                "content": "moon text",
                "keys": ["moon"],
                "secondaryKeys": ["silver"],
                "order": 4,
                "position": "after_char"
            }),
        )
        .expect("entry create should sync");

        let entry = first_character_book_entry(&state);
        assert_eq!(entry.get("name").and_then(Value::as_str), Some("Moon"));
        assert_eq!(
            entry.get("content").and_then(Value::as_str),
            Some("moon text")
        );
        assert_eq!(entry["keys"], json!(["moon"]));
        assert_eq!(entry["secondary_keys"], json!(["silver"]));
        assert_eq!(
            entry.get("insertion_order").and_then(Value::as_i64),
            Some(4)
        );
        assert_eq!(
            entry.get("position").and_then(Value::as_str),
            Some("after_char")
        );
    }

    #[test]
    fn numeric_after_char_position_syncs_to_character_book() {
        let state = test_state("linked-character-book-numeric-position");
        seed_linked_character_book(&state);

        storage_create_inner(
            &state,
            "lorebook-entries".to_string(),
            json!({
                "lorebookId": "linked-book",
                "name": "Depth",
                "content": "numeric position",
                "keys": ["depth"],
                "position": 1
            }),
        )
        .expect("entry create should sync numeric position");

        let entry = first_character_book_entry(&state);
        assert_eq!(
            entry.get("position").and_then(Value::as_str),
            Some("after_char")
        );
    }

    #[test]
    fn linked_lorebook_entry_create_is_atomic_when_character_book_sync_fails() {
        let state = test_state("linked-character-book-entry-create-atomic");
        seed_linked_character_book(&state);
        state
            .storage
            .patch(
                "characters",
                "character-1",
                json!({
                    "data": {
                        "name": "Mira",
                        "character_book": "malformed",
                        "extensions": {
                            "importMetadata": {
                                "embeddedLorebook": {
                                    "hasEmbeddedLorebook": true,
                                    "lorebookId": "linked-book",
                                    "entriesImported": 1
                                }
                            }
                        }
                    }
                }),
            )
            .expect("malformed linked character book should seed");

        let error = storage_create_inner(
            &state,
            "lorebook-entries".to_string(),
            json!({
                "id": "entry-atomic",
                "lorebookId": "linked-book",
                "name": "Atomic",
                "content": "should not persist",
                "keys": ["atomic"]
            }),
        )
        .expect_err("malformed linked character book should reject the entry create");

        assert_eq!(error.code, "invalid_input");
        assert!(!entry_exists(&state, "entry-atomic"));
    }

    #[test]
    fn updating_linked_lorebook_entry_syncs_character_book() {
        let state = test_state("linked-character-book-entry-update");
        seed_linked_character_book(&state);
        storage_create_inner(
            &state,
            "lorebook-entries".to_string(),
            json!({
                "id": "entry-1",
                "lorebookId": "linked-book",
                "name": "Moon",
                "content": "moon text",
                "keys": ["moon"]
            }),
        )
        .expect("entry should seed through create");

        storage_update_inner(
            &state,
            "lorebook-entries".to_string(),
            "entry-1".to_string(),
            json!({
                "name": "Sun",
                "content": "sun text",
                "keys": ["sun"],
                "enabled": false
            }),
        )
        .expect("entry update should sync");

        let entry = first_character_book_entry(&state);
        assert_eq!(entry.get("name").and_then(Value::as_str), Some("Sun"));
        assert_eq!(
            entry.get("content").and_then(Value::as_str),
            Some("sun text")
        );
        assert_eq!(entry["keys"], json!(["sun"]));
        assert_eq!(entry.get("enabled").and_then(Value::as_bool), Some(false));
    }

    #[test]
    fn moving_entry_out_of_linked_lorebook_removes_it_from_character_book() {
        let state = test_state("linked-character-book-entry-move");
        seed_linked_character_book(&state);
        state
            .storage
            .create("lorebooks", json!({ "id": "other-book", "name": "Other" }))
            .expect("target lorebook should seed");
        storage_create_inner(
            &state,
            "lorebook-entries".to_string(),
            json!({
                "id": "entry-1",
                "lorebookId": "linked-book",
                "name": "Moon",
                "content": "moon text",
                "keys": ["moon"]
            }),
        )
        .expect("entry should seed through create");

        storage_update_inner(
            &state,
            "lorebook-entries".to_string(),
            "entry-1".to_string(),
            json!({ "lorebookId": "other-book" }),
        )
        .expect("moving entry should sync source lorebook");

        assert!(character_book_entries(&state).is_empty());
    }

    #[test]
    fn deleting_linked_lorebook_entry_syncs_character_book() {
        let state = test_state("linked-character-book-entry-delete");
        seed_linked_character_book(&state);
        storage_create_inner(
            &state,
            "lorebook-entries".to_string(),
            json!({
                "id": "entry-1",
                "lorebookId": "linked-book",
                "name": "Moon",
                "content": "moon text",
                "keys": ["moon"]
            }),
        )
        .expect("entry should seed through create");

        delete_entity(&state, "lorebook-entries", "entry-1", false)
            .expect("entry delete should sync");

        assert!(character_book_entries(&state).is_empty());
    }

    #[test]
    fn generic_storage_commands_reject_unsupported_entities() {
        let state = test_state("unsupported-entity");

        let create_error = storage_create_inner(
            &state,
            "typo-collection".to_string(),
            json!({ "id": "row-1" }),
        )
        .expect_err("unsupported create should be rejected");
        assert_eq!(create_error.code, "invalid_input");
        assert!(create_error
            .message
            .contains("Unsupported storage entity: typo-collection"));
        assert!(!state
            .data_dir
            .join("data")
            .join("collections")
            .join("typo-collection.json")
            .exists());

        storage_list_inner(&state, "typo-collection".to_string(), None)
            .expect_err("unsupported list should be rejected");
        storage_get_inner(
            &state,
            "typo-collection".to_string(),
            "row-1".to_string(),
            None,
        )
        .expect_err("unsupported get should be rejected");
        storage_update_inner(
            &state,
            "typo-collection".to_string(),
            "row-1".to_string(),
            json!({ "name": "Nope" }),
        )
        .expect_err("unsupported update should be rejected");
        delete_entity(&state, "typo-collection", "row-1", false)
            .expect_err("unsupported delete should be rejected");
    }

    #[test]
    fn generic_storage_commands_still_accept_supported_entities() {
        let state = test_state("supported-entity");

        storage_create_inner(
            &state,
            "characters".to_string(),
            json!({ "id": "char-1", "data": { "name": "Rina" } }),
        )
        .expect("supported create should succeed");

        let read = storage_get_inner(&state, "characters".to_string(), "char-1".to_string(), None)
            .expect("supported get should succeed");
        assert_eq!(read["id"], "char-1");
    }

    #[test]
    fn lorebook_entries_list_by_lorebook_ids_reads_matching_books_once() {
        let state = test_state("lorebook-entries-where-in");
        state
            .storage
            .replace_all(
                "lorebook-entries",
                vec![
                    json!({ "id": "entry-b", "lorebookId": "book-b", "content": "B", "order": 2 }),
                    json!({ "id": "entry-a", "lorebookId": "book-a", "content": "A", "order": 1 }),
                    json!({ "id": "entry-c", "lorebookId": "book-c", "content": "C", "order": 3 }),
                ],
            )
            .expect("entries should seed");

        let result = lorebook_entries_list_by_lorebook_ids_inner(
            &state,
            vec!["book-b".to_string(), "book-a".to_string()],
        )
        .expect("batched lorebook entries should read");

        let ids: Vec<_> = result
            .as_array()
            .expect("result should be an array")
            .iter()
            .filter_map(|row| row.get("id").and_then(Value::as_str))
            .collect();
        assert_eq!(ids, vec!["entry-a", "entry-b"]);
    }

    #[test]
    fn gallery_create_persists_data_url_as_managed_file() {
        let state = test_state("gallery-create-managed-file");
        let image =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lTmZsgAAAABJRU5ErkJggg==";

        let created = storage_create_inner(
            &state,
            "gallery".to_string(),
            json!({
                "chatId": "chat-1",
                "filePath": "generated.png",
                "filename": "generated.png",
                "url": image,
                "prompt": "scene",
            }),
        )
        .expect("gallery row should be created");

        let url = created
            .get("url")
            .and_then(Value::as_str)
            .expect("gallery url should be present");
        assert!(
            !url.starts_with("data:image/"),
            "gallery rows should not store inline image data"
        );
        let filename = created
            .get("filename")
            .and_then(Value::as_str)
            .expect("managed filename should be present");
        assert!(
            state.data_dir.join("gallery").join(filename).exists(),
            "managed gallery file should exist"
        );
    }

    #[test]
    fn gallery_create_removes_managed_file_when_row_create_fails() {
        let state = test_state("gallery-create-managed-file-rollback");
        let image =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lTmZsgAAAABJRU5ErkJggg==";

        storage_create_inner(
            &state,
            "gallery".to_string(),
            json!({ "id": "image-1", "chatId": "chat-1", "url": "tauri-api:/gallery/existing.png" }),
        )
        .expect("seed gallery row should be created");

        storage_create_inner(
            &state,
            "gallery".to_string(),
            json!({
                "id": "image-1",
                "chatId": "chat-1",
                "filename": "rollback.png",
                "url": image,
            }),
        )
        .expect_err("duplicate gallery row should fail after persisting the image");

        assert!(
            !state.data_dir.join("gallery").join("rollback.png").exists(),
            "failed gallery create should remove the managed file it wrote"
        );
    }

    #[test]
    fn gallery_create_removes_managed_file_when_collection_write_fails() {
        let state = test_state("gallery-create-managed-file-write-rollback");
        let image =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lTmZsgAAAABJRU5ErkJggg==";
        std::fs::create_dir_all(
            state
                .data_dir
                .join("data")
                .join("collections")
                .join("gallery.json"),
        )
        .expect("collection path should be made unwritable as a file");

        storage_create_inner(
            &state,
            "gallery".to_string(),
            json!({
                "chatId": "chat-1",
                "filename": "rollback.png",
                "url": image,
            }),
        )
        .expect_err("gallery collection write should fail after persisting the image");

        assert!(
            !state.data_dir.join("gallery").join("rollback.png").exists(),
            "failed gallery create should remove the managed file it wrote"
        );
    }

    #[test]
    fn generic_storage_mutations_reject_message_swipe_sidecars() {
        let state = test_state("message-swipe-sidecar-generic-mutation");
        state
            .storage
            .replace_all(
                message_swipes::COLLECTION,
                vec![json!({
                    "id": "message-1::swipe::0",
                    "chatId": "chat-1",
                    "messageId": "message-1",
                    "index": 0,
                    "content": "keep sidecar"
                })],
            )
            .expect("sidecar should seed");

        let create_error = storage_create_inner(
            &state,
            message_swipes::COLLECTION.to_string(),
            json!({
                "id": "message-2::swipe::0",
                "chatId": "chat-1",
                "messageId": "message-2",
                "index": 0,
                "content": "raw create"
            }),
        )
        .expect_err("direct sidecar create should be rejected");
        assert_eq!(create_error.code, "invalid_input");
        assert!(create_error.message.contains("internal sidecar storage"));

        let update_error = storage_update_inner(
            &state,
            message_swipes::COLLECTION.to_string(),
            "message-1::swipe::0".to_string(),
            json!({ "content": "raw update" }),
        )
        .expect_err("direct sidecar update should be rejected");
        assert_eq!(update_error.code, "invalid_input");

        let delete_error = delete_entity(
            &state,
            message_swipes::COLLECTION,
            "message-1::swipe::0",
            false,
        )
        .expect_err("direct sidecar delete should be rejected");
        assert_eq!(delete_error.code, "invalid_input");

        let duplicate_error =
            duplicate_entity(&state, message_swipes::COLLECTION, "message-1::swipe::0")
                .expect_err("direct sidecar duplicate should be rejected");
        assert_eq!(duplicate_error.code, "invalid_input");

        let sidecars = state
            .storage
            .list(message_swipes::COLLECTION)
            .expect("sidecars should list");
        assert_eq!(sidecars.len(), 1);
        assert_eq!(sidecars[0]["content"], "keep sidecar");
    }

    #[test]
    fn generic_message_create_normalizes_parent_contract_fields() {
        let state = test_state("message-create-normalizes-parent-fields");

        storage_create_inner(
            &state,
            "messages".to_string(),
            json!({
                "id": "message-1",
                "chatId": "chat-1",
                "role": "assistant",
                "content": "first",
                "images": "[]",
                "attachments": "[]",
                "extra": "{\"thinking\":\"parent thought\"}",
                "swipes": [{
                    "content": "first",
                    "extra": "{\"thinking\":\"swipe thought\"}"
                }]
            }),
        )
        .expect("message create should normalize parent fields");

        let stored = state
            .storage
            .get("messages", "message-1")
            .expect("message lookup should not fail")
            .expect("message should be stored");
        assert_eq!(stored["images"], json!([]));
        assert_eq!(stored["attachments"], json!([]));
        assert_eq!(stored["extra"], json!({}));
        assert!(stored.get("swipes").is_none());

        let sidecars = message_swipes::swipes_for_message(&state, "message-1")
            .expect("message sidecars should read");
        assert_eq!(sidecars.len(), 1);
        assert_eq!(
            sidecars[0]["extra"],
            json!({ "thinking": "parent thought" })
        );
    }

    #[test]
    fn generic_storage_duplicate_rejects_unsupported_entities() {
        let state = test_state("unsupported-duplicate-entity");

        let error = duplicate_entity(&state, "typo-collection", "row-1")
            .expect_err("unsupported duplicate should be rejected");

        assert_eq!(error.code, "invalid_input");
        assert!(error
            .message
            .contains("Unsupported storage entity: typo-collection"));
        assert!(!state
            .data_dir
            .join("data")
            .join("collections")
            .join("typo-collection.json")
            .exists());
    }

    #[test]
    fn duplicating_active_persona_resets_active_flags() {
        let state = test_state("persona-duplicate-active-flags");
        storage_create_inner(
            &state,
            "personas".to_string(),
            json!({
                "id": "active-persona",
                "name": "Active Persona",
                "isActive": true,
                "active": true
            }),
        )
        .expect("persona should be created");

        let duplicated = duplicate_entity(&state, "personas", "active-persona")
            .expect("persona duplicate should succeed");

        assert_ne!(duplicated["id"], "active-persona");
        assert_eq!(duplicated["name"], "Active Persona Copy");
        assert_eq!(duplicated["isActive"], false);
        assert_eq!(duplicated["active"], false);

        let original = state
            .storage
            .get("personas", "active-persona")
            .expect("original persona should read")
            .expect("original persona should still exist");
        assert_eq!(original["isActive"], true);
        assert_eq!(original["active"], true);
    }

    #[test]
    fn duplicating_inactive_persona_keeps_duplicate_inactive() {
        let state = test_state("persona-duplicate-inactive-flags");
        storage_create_inner(
            &state,
            "personas".to_string(),
            json!({
                "id": "inactive-persona",
                "name": "Inactive Persona",
                "isActive": false,
                "active": false
            }),
        )
        .expect("persona should be created");

        let duplicated = duplicate_entity(&state, "personas", "inactive-persona")
            .expect("persona duplicate should succeed");

        assert_eq!(duplicated["name"], "Inactive Persona Copy");
        assert_eq!(duplicated["isActive"], false);
        assert_eq!(duplicated["active"], false);
    }

    #[test]
    fn deleting_character_removes_character_gallery_records_and_managed_files() {
        let state = test_state("character-gallery-delete");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "character-1",
                    "data": { "name": "Gallery Character" }
                }),
            )
            .expect("character should be created");
        let gallery_dir = state.data_dir.join("gallery");
        std::fs::create_dir_all(&gallery_dir).expect("gallery dir should be created");
        let image_path = gallery_dir.join("character.png");
        std::fs::write(&image_path, b"managed").expect("managed image should be written");
        state
            .storage
            .create(
                "character-gallery",
                json!({
                    "id": "character-image-1",
                    "characterId": "character-1",
                    "filePath": "character.png",
                    "filename": "character.png",
                    "url": "data:image/png;base64,bWFuYWdlZA=="
                }),
            )
            .expect("character gallery row should be created");

        delete_entity(&state, "characters", "character-1", false)
            .expect("character delete should succeed");

        let mut filters = Map::new();
        filters.insert(
            "characterId".to_string(),
            Value::String("character-1".to_string()),
        );
        assert!(
            state
                .storage
                .list_where("character-gallery", &filters)
                .expect("character gallery should be readable")
                .is_empty(),
            "character gallery rows should be removed"
        );
        assert!(
            !image_path.exists(),
            "managed gallery file should be removed"
        );
    }

    #[test]
    fn deleting_chat_reports_cascade_deleted_chat_ids() {
        let state = test_state("chat-delete-ids");
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

        let result = delete_entity(&state, "chats", "origin-chat", false)
            .expect("chat delete should succeed");
        let deleted_chat_ids: Vec<&str> = result["deletedChatIds"]
            .as_array()
            .expect("deleted chat ids should be returned")
            .iter()
            .map(|id| id.as_str().expect("deleted chat id should be a string"))
            .collect();

        assert_eq!(result.get("deleted").and_then(Value::as_bool), Some(true));
        assert_eq!(deleted_chat_ids, vec!["origin-chat", "scene-chat"]);
        assert!(state.storage.get("chats", "origin-chat").unwrap().is_none());
        assert!(state.storage.get("chats", "scene-chat").unwrap().is_none());
    }

    #[test]
    fn deleting_lorebook_cascades_entries_and_folders_only_for_that_lorebook() {
        let state = test_state("lorebook-delete-cascade");
        state
            .storage
            .create(
                "lorebooks",
                json!({ "id": "book-delete", "name": "Delete me" }),
            )
            .expect("lorebook should be created");
        state
            .storage
            .create("lorebooks", json!({ "id": "book-keep", "name": "Keep me" }))
            .expect("other lorebook should be created");
        state
            .storage
            .create(
                "lorebook-entries",
                json!({ "id": "entry-delete", "lorebookId": "book-delete", "name": "Delete", "content": "x" }),
            )
            .expect("entry should be created");
        state
            .storage
            .create(
                "lorebook-folders",
                json!({ "id": "folder-delete", "lorebookId": "book-delete", "name": "Delete" }),
            )
            .expect("folder should be created");
        state
            .storage
            .create(
                "lorebook-entries",
                json!({ "id": "entry-keep", "lorebookId": "book-keep", "name": "Keep", "content": "x" }),
            )
            .expect("other entry should be created");
        state
            .storage
            .create(
                "lorebook-folders",
                json!({ "id": "folder-keep", "lorebookId": "book-keep", "name": "Keep" }),
            )
            .expect("other folder should be created");

        let result = delete_entity(&state, "lorebooks", "book-delete", false)
            .expect("delete should succeed");

        assert_eq!(result.get("deleted").and_then(Value::as_bool), Some(true));
        assert!(ids_for_lorebook(&state, "lorebook-entries", "book-delete").is_empty());
        assert!(ids_for_lorebook(&state, "lorebook-folders", "book-delete").is_empty());
        assert_eq!(
            ids_for_lorebook(&state, "lorebook-entries", "book-keep"),
            vec!["entry-keep".to_string()]
        );
        assert_eq!(
            ids_for_lorebook(&state, "lorebook-folders", "book-keep"),
            vec!["folder-keep".to_string()]
        );
    }

    #[test]
    fn deleting_lorebook_clears_chat_and_embedded_character_refs() {
        let state = test_state("lorebook-delete-refs");
        state
            .storage
            .create(
                "lorebooks",
                json!({ "id": "book-delete", "name": "Delete me" }),
            )
            .expect("lorebook should be created");
        state
            .storage
            .create("lorebooks", json!({ "id": "book-keep", "name": "Keep me" }))
            .expect("other lorebook should be created");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Chat",
                    "activeLorebookIds": ["book-delete", "book-keep"],
                    "metadata": { "activeLorebookIds": ["book-delete", "book-keep"] }
                }),
            )
            .expect("chat should be created");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": {
                        "name": "Character",
                        "character_book": { "entries": [{ "content": "legacy" }] },
                        "extensions": {
                            "importMetadata": {
                                "embeddedLorebook": {
                                    "hasEmbeddedLorebook": true,
                                    "lorebookId": "book-delete"
                                }
                            }
                        }
                    }
                }),
            )
            .expect("character should be created");

        delete_entity(&state, "lorebooks", "book-delete", false).expect("delete should succeed");

        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should remain");
        assert_eq!(chat["activeLorebookIds"], json!(["book-keep"]));
        assert_eq!(chat["metadata"]["activeLorebookIds"], json!(["book-keep"]));

        let character = state
            .storage
            .get("characters", "char-1")
            .expect("character should read")
            .expect("character should remain");
        assert!(character["data"]["character_book"].is_null());
        assert!(character
            .pointer("/data/extensions/importMetadata/embeddedLorebook")
            .is_none());
    }

    #[test]
    fn deleting_prompt_uses_registered_child_cleanup() {
        assert!(cleanup_registered(
            "prompts",
            contracts::DeleteCleanup::DeletePromptChildren
        ));
        let state = test_state("prompt-delete-children");
        state
            .storage
            .create(
                "prompts",
                json!({ "id": "prompt-delete", "name": "Delete me" }),
            )
            .expect("prompt should be created");
        state
            .storage
            .create("prompts", json!({ "id": "prompt-keep", "name": "Keep me" }))
            .expect("other prompt should be created");
        for (collection, delete_id, keep_id) in [
            ("prompt-groups", "group-delete", "group-keep"),
            ("prompt-sections", "section-delete", "section-keep"),
            ("prompt-variables", "variable-delete", "variable-keep"),
        ] {
            state
                .storage
                .create(
                    collection,
                    json!({ "id": delete_id, "presetId": "prompt-delete", "name": "Delete" }),
                )
                .expect("prompt child should be created");
            state
                .storage
                .create(
                    collection,
                    json!({ "id": keep_id, "presetId": "prompt-keep", "name": "Keep" }),
                )
                .expect("other prompt child should be created");
        }

        delete_entity(&state, "prompts", "prompt-delete", false).expect("delete should succeed");

        for (collection, keep_id) in [
            ("prompt-groups", "group-keep"),
            ("prompt-sections", "section-keep"),
            ("prompt-variables", "variable-keep"),
        ] {
            let mut delete_filters = Map::new();
            delete_filters.insert(
                "presetId".to_string(),
                Value::String("prompt-delete".to_string()),
            );
            assert!(
                state
                    .storage
                    .list_where(collection, &delete_filters)
                    .expect("prompt child collection should be readable")
                    .is_empty(),
                "{collection} rows for deleted prompt should be removed"
            );
            assert!(state
                .storage
                .get(collection, keep_id)
                .expect("kept prompt child should read")
                .is_some());
        }
    }

    #[test]
    fn deleting_active_chat_preset_uses_registered_default_activation() {
        assert!(cleanup_registered(
            "chat-presets",
            contracts::DeleteCleanup::ActivateDefaultChatPreset
        ));
        let state = test_state("chat-preset-delete-activate-default");
        state
            .storage
            .patch(
                "chat-presets",
                "default-chat-preset-roleplay",
                json!({ "isActive": false, "active": false }),
            )
            .expect("seeded default preset should be deactivated");
        state
            .storage
            .create(
                "chat-presets",
                json!({
                    "id": "custom-roleplay",
                    "name": "Custom Roleplay",
                    "mode": "roleplay",
                    "isDefault": false,
                    "default": false,
                    "isActive": true,
                    "active": true
                }),
            )
            .expect("active preset should be created");

        delete_entity(&state, "chat-presets", "custom-roleplay", false)
            .expect("active preset delete should succeed");

        let default = state
            .storage
            .get("chat-presets", "default-chat-preset-roleplay")
            .expect("default preset should read")
            .expect("default preset should remain");
        assert_eq!(default["isActive"], json!(true));
        assert_eq!(default["active"], json!(true));
    }

    #[test]
    fn deleting_gallery_row_uses_registered_managed_media_cleanup() {
        assert!(cleanup_registered(
            "gallery",
            contracts::DeleteCleanup::RemoveOwnedMedia
        ));
        let state = test_state("gallery-delete-managed-file");
        let gallery_dir = state.data_dir.join("gallery");
        std::fs::create_dir_all(&gallery_dir).expect("gallery dir should be created");
        let image_path = gallery_dir.join("gallery.png");
        std::fs::write(&image_path, b"managed").expect("managed image should be written");
        state
            .storage
            .create(
                "gallery",
                json!({
                    "id": "gallery-image",
                    "chatId": "chat-1",
                    "filePath": "gallery.png",
                    "filename": "gallery.png",
                    "url": "tauri-api:/gallery/gallery.png"
                }),
            )
            .expect("gallery row should be created");

        delete_entity(&state, "gallery", "gallery-image", false).expect("delete should succeed");

        assert!(
            !image_path.exists(),
            "managed gallery file should be removed"
        );
    }

    #[test]
    fn deleting_message_uses_registered_tracker_snapshot_cleanup() {
        assert!(cleanup_registered(
            "messages",
            contracts::DeleteCleanup::DeleteMessageTrackerSnapshots
        ));
        let state = test_state("message-delete-tracker-snapshots");
        state
            .storage
            .create("chats", json!({ "id": "chat-1", "name": "Chat" }))
            .expect("chat should be created");
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "tracked"
                }),
            )
            .expect("message should be created");
        game_state_snapshots::save_tracker_snapshot(
            &state,
            "chat-1",
            json!({
                "messageId": "message-1",
                "location": "Harbor"
            }),
        )
        .expect("tracker snapshot should save");

        delete_entity(&state, "messages", "message-1", false).expect("delete should succeed");

        let mut filters = Map::new();
        filters.insert("chatId".to_string(), Value::String("chat-1".to_string()));
        filters.insert(
            "messageId".to_string(),
            Value::String("message-1".to_string()),
        );
        assert!(state
            .storage
            .list_where("game-state-snapshots", &filters)
            .expect("snapshots should be readable")
            .is_empty());
        let chat = state
            .storage
            .get("chats", "chat-1")
            .expect("chat should read")
            .expect("chat should remain");
        assert!(chat["gameState"].is_null());
    }

    #[test]
    fn storage_list_searches_projected_character_fields_without_returning_avatar_payloads() {
        let state = test_state("character-search-projection");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-match",
                    "comment": "summary",
                    "avatarPath": "data:image/png;base64,large-avatar",
                    "avatarFilePath": "C:\\Marinara\\avatars\\characters\\match.png",
                    "avatarFilename": "match.png",
                    "data": {
                        "name": "Rina",
                        "description": "Frost archive keeper",
                        "personality": "Dry humor",
                        "tags": ["Mage"],
                        "favorite_color": "violet",
                        "extensions": { "fav": true }
                    }
                }),
            )
            .expect("matching character should be created");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-avatar-only",
                    "avatarPath": "data:image/png;base64,frost-hidden-in-avatar",
                    "data": {
                        "name": "Mira",
                        "description": "No matching text",
                        "tags": []
                    }
                }),
            )
            .expect("non-matching character should be created");

        let result = storage_list_inner(
            &state,
            "characters".to_string(),
            Some(json!({
                "fields": ["id", "data", "comment", "avatarFilePath", "avatarFilename"],
                "fieldSelections": { "data": ["name", "tags", "extensions"] },
                "search": "frost archive"
            })),
        )
        .expect("search list should succeed");
        let rows = result.as_array().expect("storage_list returns an array");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "char-match");
        assert_eq!(
            rows[0],
            json!({
                "id": "char-match",
                "data": {
                    "name": "Rina",
                    "tags": ["Mage"],
                    "extensions": { "fav": true }
                },
                "comment": "summary",
                "avatarFilePath": "C:\\Marinara\\avatars\\characters\\match.png",
                "avatarFilename": "match.png"
            })
        );

        let avatar_payload_result = storage_list_inner(
            &state,
            "characters".to_string(),
            Some(json!({
                "fields": ["id", "data", "comment", "avatarFilePath", "avatarFilename"],
                "fieldSelections": { "data": ["name", "tags", "extensions"] },
                "search": "frost-hidden-in-avatar"
            })),
        )
        .expect("avatar payload search should succeed");

        assert!(
            avatar_payload_result
                .as_array()
                .expect("storage_list returns an array")
                .is_empty(),
            "search should not match embedded avatar payload text"
        );

        let full_data_result = storage_list_inner(
            &state,
            "characters".to_string(),
            Some(json!({
                "fields": ["id", "data"],
                "search": "frost archive"
            })),
        )
        .expect("full data search list should succeed");
        let full_data_rows = full_data_result
            .as_array()
            .expect("storage_list returns an array");
        assert_eq!(full_data_rows.len(), 1);
        assert_eq!(full_data_rows[0]["data"]["favorite_color"], "violet");
    }

    #[test]
    fn storage_list_projected_messages_keeps_default_created_at_order() {
        let state = test_state("message-projection-default-sort");
        state
            .storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "new", "chatId": "chat-1", "createdAt": "2026-01-03T00:00:00Z", "content": "new" }),
                    json!({ "id": "old", "chatId": "chat-1", "createdAt": "2026-01-01T00:00:00Z", "content": "old" }),
                    json!({ "id": "other", "chatId": "chat-2", "createdAt": "2026-01-02T00:00:00Z", "content": "other" }),
                ],
            )
            .expect("messages should be seeded");

        let result = storage_list_inner(
            &state,
            "messages".to_string(),
            Some(json!({
                "filters": { "chatId": "chat-1" },
                "fields": ["id", "content"]
            })),
        )
        .expect("projected message list should succeed");

        assert_eq!(
            result,
            json!([
                { "id": "old", "content": "old" },
                { "id": "new", "content": "new" }
            ])
        );
    }

    #[test]
    fn storage_list_projected_messages_keeps_before_cursor_filter() {
        let state = test_state("message-projection-before-cursor");
        state
            .storage
            .replace_all(
                "messages",
                vec![
                    json!({ "id": "older", "chatId": "chat-1", "createdAt": "2026-01-01T00:00:00Z", "content": "older" }),
                    json!({ "id": "cursor", "chatId": "chat-1", "createdAt": "2026-01-02T00:00:00Z", "content": "cursor" }),
                    json!({ "id": "newer", "chatId": "chat-1", "createdAt": "2026-01-03T00:00:00Z", "content": "newer" }),
                ],
            )
            .expect("messages should be seeded");

        let result = storage_list_inner(
            &state,
            "messages".to_string(),
            Some(json!({
                "filters": { "chatId": "chat-1" },
                "fields": ["id", "content"],
                "before": "2026-01-02T00:00:00Z|cursor"
            })),
        )
        .expect("projected message list should succeed");

        assert_eq!(result, json!([{ "id": "older", "content": "older" }]));
    }

    #[test]
    fn storage_list_projected_paged_messages_skips_unrequested_payloads_before_parsing() {
        let state = test_state("message-projection-paged-skips-payloads");
        state
            .storage
            .clear_all()
            .expect("storage cache should be cleared");
        let collection = state
            .data_dir
            .join("data")
            .join("collections")
            .join("messages.json");
        let sidecar_collection = state
            .data_dir
            .join("data")
            .join("collections")
            .join(format!("{}.json", message_swipes::COLLECTION));
        std::fs::write(
            &collection,
            r#"[
  {
    "id": "older",
    "chatId": "chat-1",
    "createdAt": "2026-01-01T00:00:01Z",
    "content": "stored older",
    "extra": {
      "thinking": "parent older",
      "large": {
        "unrequested": invalid
      }
    },
    "attachments": [
      {
        "unrequested": invalid
      }
    ]
  },
  {
    "id": "target",
    "chatId": "chat-1",
    "createdAt": "2026-01-01T00:00:02Z",
    "content": "stored target",
    "extra": {
      "thinking": "parent target",
      "large": {
        "unrequested": invalid
      }
    },
    "promptSnapshot": {
      "unrequested": invalid
    }
  },
  {
    "id": "newer",
    "chatId": "chat-1",
    "createdAt": "2026-01-01T00:00:03Z",
    "content": "stored newer",
    "extra": {
      "thinking": "newer",
      "large": {
        "unrequested": invalid
      }
    }
  }
]"#,
        )
        .expect("messages should be written");
        std::fs::write(
            &sidecar_collection,
            r#"[
  {
    "id": "older::swipe::0",
    "chatId": "chat-1",
    "messageId": "older",
    "index": 0,
    "content": "older swipe",
    "extra": {
      "thinking": "older thought",
      "unrequested": "ignored"
    }
  },
  {
    "id": "target::swipe::0",
    "chatId": "chat-1",
    "messageId": "target",
    "index": 0,
    "content": "target swipe",
    "extra": {
      "thinking": "target thought",
      "unrequested": "ignored"
    }
  },
  {
    "id": "newer::swipe::0",
    "chatId": "chat-1",
    "messageId": "newer",
    "index": 0,
    "content": "newer swipe",
    "extra": {
      "unrequested": "ignored"
    }
  }
]"#,
        )
        .expect("message swipe sidecars should be written");

        let result = storage_list_inner(
            &state,
            "messages".to_string(),
            Some(json!({
                "filters": { "chatId": "chat-1" },
                "fields": ["id", "content", "extra", "swipeCount", "swipePreviews"],
                "fieldSelections": { "extra": ["thinking"] },
                "limit": 2,
                "before": "2026-01-01T00:00:03Z|newer"
            })),
        )
        .expect("projected paged message list should skip unrequested payload fields");

        assert_eq!(
            result,
            json!([
                {
                    "id": "older",
                    "content": "stored older",
                    "extra": { "thinking": "parent older" },
                    "swipeCount": 1,
                    "swipePreviews": [{ "content": "older swipe" }]
                },
                {
                    "id": "target",
                    "content": "stored target",
                    "extra": { "thinking": "parent target" },
                    "swipeCount": 1,
                    "swipePreviews": [{ "content": "target swipe" }]
                }
            ])
        );
    }

    #[test]
    fn storage_list_projected_embedded_swipes_materializes_without_swipes_field() {
        let state = test_state("message-projection-embedded-swipe-materialization");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "createdAt": "2026-01-01T00:00:00Z",
                    "content": "parent content",
                    "activeSwipeIndex": 1,
                    "extra": { "thinking": "parent thought" },
                    "swipes": [
                        { "content": "first swipe", "extra": { "thinking": "first thought" } },
                        { "content": "active swipe", "extra": { "thinking": "active thought" } }
                    ]
                })],
            )
            .expect("message should be seeded");
        message_swipes::migrate_nested_message_swipes(&state.storage)
            .expect("embedded message swipes should migrate before projected reads");

        let result = storage_list_inner(
            &state,
            "messages".to_string(),
            Some(json!({
                "filters": { "chatId": "chat-1" },
                "fields": ["id", "content", "extra", "swipeCount", "swipePreviews"],
                "fieldSelections": { "extra": ["thinking"] }
            })),
        )
        .expect("projected message list should materialize embedded swipes");

        assert_eq!(
            result,
            json!([
                {
                    "id": "message-1",
                    "content": "active swipe",
                    "extra": { "thinking": "active thought" },
                    "swipeCount": 2,
                    "swipePreviews": [
                        { "content": "first swipe" },
                        { "content": "active swipe" }
                    ]
                }
            ])
        );
    }

    #[test]
    fn message_projection_materialization_includes_internal_sort_fields() {
        let fields = vec!["content".to_string()];
        let projection = message_projection_fields_for_materialization(
            &fields,
            Some(&json!({ "orderBy": "score" })),
        );

        for field in ["content", "id", "sortOrder", "order", "createdAt", "score"] {
            assert!(
                projection.iter().any(|existing| existing == field),
                "projection should include {field}"
            );
        }
        for field in ["activeSwipeIndex", "swipes"] {
            assert!(
                !projection.iter().any(|existing| existing == field),
                "projection should not include sidecar field {field}"
            );
        }
    }

    #[test]
    fn projected_message_get_materializes_swipe_summary_without_swipes_field() {
        let state = test_state("message-projection-get-swipe-materialization");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "content": "stored parent content",
                    "activeSwipeIndex": 1,
                    "extra": { "thinking": "parent thought", "large": "parent payload" },
                    "swipes": [
                        { "content": "first swipe", "extra": { "thinking": "first thought" } },
                        { "content": "active swipe", "extra": { "thinking": "active thought", "large": "ignored" } }
                    ],
                    "largePayload": "ignored"
                })],
            )
            .expect("message should be seeded");
        message_swipes::migrate_nested_message_swipes(&state.storage)
            .expect("nested message swipes should migrate");

        let read = storage_get_inner(
            &state,
            "messages".to_string(),
            "message-1".to_string(),
            Some(json!({
                "fields": ["id", "content", "extra", "swipeCount", "swipePreviews"],
                "fieldSelections": { "extra": ["thinking"] }
            })),
        )
        .expect("projected message should read");

        assert_eq!(read["id"], "message-1");
        assert_eq!(read["content"], "active swipe");
        assert_eq!(read["swipeCount"], 2);
        assert_eq!(
            read["swipePreviews"],
            json!([{ "content": "first swipe" }, { "content": "active swipe" }])
        );
        assert_eq!(read["extra"], json!({ "thinking": "active thought" }));
        assert!(read.get("swipes").is_none());
        assert!(read.get("activeSwipeIndex").is_none());
        assert!(read.get("largePayload").is_none());
    }

    #[test]
    fn projected_message_get_reads_parent_active_fields_without_sidecar_payload() {
        let state = test_state("message-projection-parent-active-fields");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "content": "parent active content",
                    "activeSwipeIndex": 1,
                    "extra": { "thinking": "parent active thought", "large": "parent payload" }
                })],
            )
            .expect("message should be seeded");
        state
            .storage
            .replace_all(
                message_swipes::COLLECTION,
                vec![
                    json!({
                        "id": "message-1::swipe::0",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 0,
                        "content": "first sidecar",
                        "extra": { "thinking": "first sidecar thought" }
                    }),
                    json!({
                        "id": "message-1::swipe::1",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 1,
                        "content": "stale active sidecar",
                        "extra": { "thinking": "stale sidecar thought" }
                    }),
                ],
            )
            .expect("sidecars should be seeded");

        let read = storage_get_inner(
            &state,
            "messages".to_string(),
            "message-1".to_string(),
            Some(json!({
                "fields": ["id", "content", "extra"],
                "fieldSelections": { "extra": ["thinking"] }
            })),
        )
        .expect("projected message should read");

        assert_eq!(
            read,
            json!({
                "id": "message-1",
                "content": "parent active content",
                "extra": { "thinking": "parent active thought" }
            })
        );
    }

    #[test]
    fn projected_message_list_materializes_swipe_summary_without_sidecar_extra() {
        let state = test_state("message-projection-sidecar-summary");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "createdAt": "2026-01-01T00:00:00Z",
                    "content": "parent active content",
                    "activeSwipeIndex": 1,
                    "extra": { "thinking": "parent active thought", "large": "parent payload" }
                })],
            )
            .expect("message should be seeded");
        state
            .storage
            .replace_all(
                message_swipes::COLLECTION,
                vec![
                    json!({
                        "id": "message-1::swipe::0",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 0,
                        "content": "first sidecar",
                        "extra": { "thinking": "first sidecar thought", "large": "ignored" }
                    }),
                    json!({
                        "id": "message-1::swipe::1",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 1,
                        "content": "second sidecar",
                        "characterId": "character-1",
                        "extra": { "thinking": "second sidecar thought", "large": "ignored" }
                    }),
                ],
            )
            .expect("sidecars should be seeded");

        let result = storage_list_inner(
            &state,
            "messages".to_string(),
            Some(json!({
                "filters": { "chatId": "chat-1" },
                "fields": ["id", "content", "extra", "swipeCount", "swipePreviews"],
                "fieldSelections": { "extra": ["thinking"] }
            })),
        )
        .expect("projected message list should read");

        assert_eq!(
            result,
            json!([
                {
                    "id": "message-1",
                    "content": "parent active content",
                    "extra": { "thinking": "parent active thought" },
                    "swipeCount": 2,
                    "swipePreviews": [
                        { "content": "first sidecar" },
                        { "content": "second sidecar", "characterId": "character-1" }
                    ]
                }
            ])
        );
    }

    #[test]
    fn storage_list_searches_sidecar_message_swipes_without_returning_unrequested_swipes() {
        let state = test_state("message-search-sidecar-swipes");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "Visible active message.",
                    "activeSwipeIndex": 0,
                    "createdAt": "2026-01-01T00:00:00Z"
                })],
            )
            .expect("message should seed");
        state
            .storage
            .replace_all(
                message_swipes::COLLECTION,
                vec![json!({
                    "id": "message-1::swipe::0",
                    "chatId": "chat-1",
                    "messageId": "message-1",
                    "index": 0,
                    "content": "Alternate route through the moonlit archive."
                })],
            )
            .expect("sidecar swipe should seed");

        let result = storage_list_inner(
            &state,
            "messages".to_string(),
            Some(json!({
                "filters": { "chatId": "chat-1" },
                "fields": ["id", "content", "swipeCount"],
                "search": "moonlit"
            })),
        )
        .expect("message search should succeed");

        assert_eq!(
            result,
            json!([
                {
                    "id": "message-1",
                    "content": "Visible active message.",
                    "swipeCount": 1
                }
            ])
        );
    }

    #[test]
    fn storage_list_search_materializes_active_sidecar_extra_without_returning_swipes() {
        let state = test_state("message-search-sidecar-active-extra");
        state
            .storage
            .replace_all(
                "messages",
                vec![json!({
                    "id": "message-1",
                    "chatId": "chat-1",
                    "role": "assistant",
                    "content": "Visible active message.",
                    "activeSwipeIndex": 1,
                    "extra": { "hiddenFromAI": true },
                    "createdAt": "2026-01-01T00:00:00Z"
                })],
            )
            .expect("message should seed");
        state
            .storage
            .replace_all(
                message_swipes::COLLECTION,
                vec![
                    json!({
                        "id": "message-1::swipe::0",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 0,
                        "content": "Search-only moonlit sidecar.",
                        "extra": { "thinking": "inactive thought" }
                    }),
                    json!({
                        "id": "message-1::swipe::1",
                        "chatId": "chat-1",
                        "messageId": "message-1",
                        "index": 1,
                        "content": "Visible active message.",
                        "extra": { "thinking": "active sidecar thought" }
                    }),
                ],
            )
            .expect("sidecar swipes should seed");

        let result = storage_list_inner(
            &state,
            "messages".to_string(),
            Some(json!({
                "filters": { "chatId": "chat-1" },
                "fields": ["id", "content", "extra", "swipeCount", "swipePreviews"],
                "fieldSelections": { "extra": ["hiddenFromAI", "thinking"] },
                "search": "moonlit"
            })),
        )
        .expect("message search should succeed");

        assert_eq!(
            result,
            json!([
                {
                    "id": "message-1",
                    "content": "Visible active message.",
                    "extra": { "hiddenFromAI": true, "thinking": "active sidecar thought" },
                    "swipeCount": 2,
                    "swipePreviews": [
                        { "content": "Search-only moonlit sidecar." },
                        { "content": "Visible active message." }
                    ]
                }
            ])
        );
    }

    #[test]
    fn enabling_agent_default_connection_clears_previous_language_default() {
        let state = test_state("agent-default-exclusive-update");
        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "language-a",
                "name": "Language A",
                "provider": "anthropic",
                "defaultForAgents": true
            }),
        )
        .expect("first language connection should be created");
        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "image-a",
                "name": "Image A",
                "provider": "image_generation",
                "defaultForAgents": true
            }),
        )
        .expect("image connection should be created");
        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "language-b",
                "name": "Language B",
                "provider": "openai",
                "defaultForAgents": false
            }),
        )
        .expect("second language connection should be created");

        storage_update_inner(
            &state,
            "connections".to_string(),
            "language-b".to_string(),
            json!({ "defaultForAgents": true }),
        )
        .expect("second language connection should become default");

        assert!(!default_for_agents(&state, "language-a"));
        assert!(default_for_agents(&state, "language-b"));
        assert!(default_for_agents(&state, "image-a"));
    }

    #[test]
    fn creating_agent_default_connection_clears_previous_same_scope_default() {
        let state = test_state("agent-default-exclusive-create");
        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "image-a",
                "name": "Image A",
                "provider": "image_generation",
                "defaultForAgents": true
            }),
        )
        .expect("first image connection should be created");

        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "image-b",
                "name": "Image B",
                "provider": "image_generation",
                "defaultForAgents": "true"
            }),
        )
        .expect("second image connection should be created");

        assert!(!default_for_agents(&state, "image-a"));
        assert!(default_for_agents(&state, "image-b"));
    }

    #[test]
    fn connection_api_key_is_encrypted_masked_and_runtime_decrypted() {
        let state = test_state("connection-secret");
        let created = storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "secure-connection",
                "name": "Secure",
                "provider": "anthropic",
                "model": "claude-opus-4-8",
                "apiKey": "sk-secret"
            }),
        )
        .expect("connection should be created");
        assert_eq!(created["apiKey"], connection_secrets::API_KEY_MASK);
        assert_eq!(created["hasApiKey"], true);

        let raw = state
            .storage
            .get("connections", "secure-connection")
            .expect("connection should read")
            .expect("connection should exist");
        assert!(raw.get("apiKey").is_none());
        assert_ne!(
            raw.get("apiKeyEncrypted").and_then(Value::as_str),
            Some("sk-secret")
        );

        let read = storage_get_inner(
            &state,
            "connections".to_string(),
            "secure-connection".to_string(),
            None,
        )
        .expect("masked connection should read");
        assert_eq!(read["apiKey"], connection_secrets::API_KEY_MASK);
        assert!(read.get("apiKeyEncrypted").is_none());

        let runtime = connection_secrets::connection_for_runtime(&state, "secure-connection")
            .expect("runtime connection should decrypt");
        assert_eq!(runtime["apiKey"], "sk-secret");
    }

    #[test]
    fn projected_connection_get_preserves_secret_mask_fields() {
        let state = test_state("connection-secret-projected-get");
        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "secure-connection",
                "name": "Secure",
                "provider": "anthropic",
                "model": "claude-opus-4-8",
                "apiKey": "sk-secret"
            }),
        )
        .expect("connection should be created");

        let read = storage_get_inner(
            &state,
            "connections".to_string(),
            "secure-connection".to_string(),
            Some(json!({
                "fields": ["id", "hasApiKey", "apiKey", "apiKeyEncrypted"]
            })),
        )
        .expect("projected masked connection should read");

        assert_eq!(read["id"], "secure-connection");
        assert_eq!(read["hasApiKey"], true);
        assert_eq!(read["apiKey"], connection_secrets::API_KEY_MASK);
        assert!(read.get("apiKeyEncrypted").is_none());
    }

    #[test]
    fn blank_connection_api_key_update_preserves_existing_secret() {
        let state = test_state("connection-secret-preserve");
        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "secure-connection",
                "name": "Secure",
                "provider": "anthropic",
                "model": "claude-opus-4-8",
                "apiKey": "sk-secret"
            }),
        )
        .expect("connection should be created");

        storage_update_inner(
            &state,
            "connections".to_string(),
            "secure-connection".to_string(),
            json!({ "apiKey": "", "name": "Still Secure" }),
        )
        .expect("blank update should preserve key");
        let runtime = connection_secrets::connection_for_runtime(&state, "secure-connection")
            .expect("runtime connection should decrypt");
        assert_eq!(runtime["apiKey"], "sk-secret");
    }

    #[test]
    fn duplicating_connection_resets_default_flags_and_keeps_secret_masked() {
        let state = test_state("connection-duplicate-defaults");
        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "default-connection",
                "name": "Default Connection",
                "provider": "anthropic",
                "model": "claude-opus-4-8",
                "isDefault": true,
                "default": true,
                "defaultForAgents": true,
                "apiKey": "sk-secret"
            }),
        )
        .expect("connection should be created");

        let duplicated = duplicate_entity(&state, "connections", "default-connection")
            .expect("connection duplicate should succeed");

        assert_ne!(duplicated["id"], "default-connection");
        assert_eq!(duplicated["name"], "Default Connection Copy");
        assert_eq!(duplicated["isDefault"], false);
        assert_eq!(duplicated["default"], false);
        assert_eq!(duplicated["defaultForAgents"], false);
        assert_eq!(duplicated["apiKey"], connection_secrets::API_KEY_MASK);

        let raw = state
            .storage
            .get("connections", duplicated["id"].as_str().unwrap())
            .expect("duplicate should read")
            .expect("duplicate should exist");
        assert!(raw.get("apiKey").is_none());
        assert!(raw.get("apiKeyEncrypted").is_some());
    }

    #[test]
    fn deleting_connection_folder_unfiles_child_connections() {
        let state = test_state("connection-folder-delete");
        storage_create_inner(
            &state,
            "connection-folders".to_string(),
            json!({ "id": "folder-a", "name": "Folder A" }),
        )
        .expect("folder should be created");
        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "connection-a",
                "name": "Connection A",
                "provider": "openai",
                "model": "gpt-4o",
                "folderId": "folder-a"
            }),
        )
        .expect("connection should be created");

        delete_entity(&state, "connection-folders", "folder-a", false)
            .expect("folder delete should succeed");

        let connection = state
            .storage
            .get("connections", "connection-a")
            .expect("connection should read")
            .expect("connection should remain");
        assert!(connection.get("folderId").is_none_or(Value::is_null));
    }

    #[test]
    fn moving_connection_rejects_missing_folder() {
        let state = test_state("connection-folder-missing");
        storage_create_inner(
            &state,
            "connections".to_string(),
            json!({
                "id": "connection-a",
                "name": "Connection A",
                "provider": "openai",
                "model": "gpt-4o"
            }),
        )
        .expect("connection should be created");

        let error =
            connection_move_inner(&state, "connection-a", Some("missing-folder".to_string()))
                .expect_err("missing folders should be rejected");
        assert_eq!(error.code, "invalid_input");
    }

    #[test]
    fn reordering_connection_folders_requires_each_folder_once() {
        let state = test_state("connection-folder-reorder-validate");
        storage_create_inner(
            &state,
            "connection-folders".to_string(),
            json!({ "id": "folder-a", "name": "Folder A" }),
        )
        .expect("first folder should be created");
        storage_create_inner(
            &state,
            "connection-folders".to_string(),
            json!({ "id": "folder-b", "name": "Folder B" }),
        )
        .expect("second folder should be created");

        let duplicate_error = connection_folder_reorder_inner(
            &state,
            vec!["folder-a".to_string(), "folder-a".to_string()],
        )
        .expect_err("duplicate folder ids should reject the reorder");
        assert_eq!(duplicate_error.code, "invalid_input");

        let missing_error = connection_folder_reorder_inner(&state, vec!["folder-a".to_string()])
            .expect_err("omitted folders should reject the reorder");
        assert_eq!(missing_error.code, "invalid_input");

        let folder_b = state
            .storage
            .get("connection-folders", "folder-b")
            .expect("folder should read")
            .expect("folder should exist");
        assert_eq!(folder_b["sortOrder"], 1);
    }
}
