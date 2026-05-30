use super::{avatars, chats, game_state_snapshots, lorebook_images, shared};
use crate::builtins::is_protected_record;
use crate::state::AppState;
use marinara_core::AppError;
use serde_json::{json, Map, Value};
use tauri::State;

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

fn storage_list_inner(
    state: &AppState,
    entity: String,
    options: Option<Value>,
) -> Result<Value, AppError> {
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
                    state
                        .storage
                        .list_messages_for_chat_page(chat_id, limit, before.as_deref())?
                } else if message_id_projection_only(options.as_ref()) {
                    state.storage.list_message_ids_for_chat(chat_id)?
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
        for row in &mut rows {
            shared::materialize_message_swipe_fields(row);
        }
        return Ok(Value::Array(shared::project_list_rows(
            rows,
            options.as_ref(),
        )));
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

fn storage_get_inner(
    state: &AppState,
    entity: String,
    id: String,
    options: Option<Value>,
) -> Result<Value, AppError> {
    let mut value = state.storage.get(&entity, &id)?.unwrap_or(Value::Null);
    if entity == "messages" {
        shared::materialize_message_swipe_fields(&mut value);
    }
    Ok(shared::project_record(value, options.as_ref()))
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

fn storage_create_inner(state: &AppState, entity: String, value: Value) -> Result<Value, AppError> {
    state
        .storage
        .create(&entity, shared::with_entity_defaults(&entity, value)?)
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

fn storage_update_inner(
    state: &AppState,
    entity: String,
    id: String,
    patch: Value,
) -> Result<Value, AppError> {
    if entity == "messages" {
        return shared::patch_message_update(state, &id, patch);
    }
    state.storage.patch(
        &entity,
        &id,
        shared::normalize_update_patch(&entity, patch)?,
    )
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
    if entity == "connections" {
        return crate::connection_refs::delete_connection(state, id, force);
    }
    if entity == "chats" {
        let existed = state.storage.get("chats", id)?.is_some();
        if existed {
            chats::delete_chat_with_messages(state, id)?;
        }
        return Ok(json!({ "deleted": existed }));
    }
    if is_protected_record(entity, id) {
        return Err(AppError::invalid_input(
            "Protected records cannot be deleted",
        ));
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
    let deleted = state.storage.delete(entity, id)?;
    if deleted {
        if entity == "lorebooks" {
            delete_lorebook_children(state, id)?;
        }
        if let Some(record) = existing.as_ref() {
            remove_owned_media(state, entity, record);
        }
        if let Some(chat_id) = message_chat_id {
            game_state_snapshots::delete_tracker_snapshots_for_message(state, &chat_id, id)?;
            game_state_snapshots::sync_chat_game_state_to_visible_tracker(state, &chat_id)?;
        }
    }
    Ok(json!({ "deleted": deleted }))
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

fn owned_record_for_delete(
    state: &AppState,
    entity: &str,
    id: &str,
) -> Result<Option<Value>, AppError> {
    match entity {
        "characters" | "personas" | "lorebooks" | "messages" => state.storage.get(entity, id),
        _ => Ok(None),
    }
}

fn remove_owned_media(state: &AppState, entity: &str, record: &Value) {
    match entity {
        "characters" | "personas" => avatars::remove_avatar_file(state, entity, record),
        "lorebooks" => lorebook_images::remove_lorebook_image_file(state, record),
        _ => {}
    }
}

#[tauri::command]
pub async fn storage_duplicate(
    state: State<'_, AppState>,
    entity: String,
    id: String,
) -> Result<Value, AppError> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || shared::duplicate_record(&state, &entity, &id))
        .await
        .map_err(|error| AppError::new("task_join_error", error.to_string()))?
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

    #[test]
    fn deleting_lorebook_cascades_entries_and_folders_only_for_that_lorebook() {
        let state = test_state("lorebook-delete-cascade");
        state
            .storage
            .create("lorebooks", json!({ "id": "book-delete", "name": "Delete me" }))
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
}
