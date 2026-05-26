use crate::builtins::is_protected_record;
use crate::state::AppState;
use crate::storage_commands::{
    avatars, backgrounds, chats, generation, images, imports, llm, lorebook_images, profile,
    shared, sprites,
};
use marinara_core::{AppError, AppResult};
use serde::Deserialize;
use serde_json::{json, Map, Value};

#[derive(Debug, Deserialize)]
pub struct InvokeRequest {
    pub command: String,
    #[serde(default)]
    pub args: Option<Value>,
}

fn args_object(args: Option<Value>) -> AppResult<Map<String, Value>> {
    match args.unwrap_or(Value::Null) {
        Value::Null => Ok(Map::new()),
        Value::Object(object) => Ok(object),
        _ => Err(AppError::invalid_input("Invoke args must be an object")),
    }
}

fn required_string<'a>(args: &'a Map<String, Value>, key: &str) -> AppResult<&'a str> {
    args.get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::invalid_input(format!("{key} is required")))
}

fn optional_value(args: &Map<String, Value>, key: &str) -> Value {
    args.get(key).cloned().unwrap_or(Value::Null)
}

fn optional_string(args: &Map<String, Value>, key: &str) -> Option<String> {
    args.get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
}

pub async fn dispatch(state: &AppState, request: InvokeRequest) -> AppResult<Value> {
    let command = request.command.as_str();
    let args = args_object(request.args)?;
    match command {
        "storage_list" => storage_list(state, &args),
        "storage_get" => storage_get(state, &args),
        "storage_create" => storage_create(state, &args),
        "storage_update" => storage_update(state, &args),
        "storage_delete" => storage_delete(state, &args),
        "storage_duplicate" => storage_duplicate(state, &args),
        "chat_message_add_swipe" => chat_message_add_swipe(state, &args),
        "chat_message_set_active_swipe" => chat_message_set_active_swipe(state, &args),
        "chat_message_delete_swipe" => chat_message_delete_swipe(state, &args),
        "chat_autonomous_unread_mark" => chat_autonomous_unread_mark(state, &args),
        "chat_autonomous_unread_clear" => chat_autonomous_unread_clear(state, &args),
        "connection_test" => connection_test(state, &args).await,
        "connection_test_message" => connection_test_message(state, &args).await,
        "connection_test_image" => connection_test_image(state, &args).await,
        "connection_models" => connection_models(state, &args).await,
        "connection_save_default_parameters" => connection_save_default_parameters(state, &args),
        "background_upload" => background_upload(state, &args),
        "character_gallery_upload" => character_gallery_upload(state, &args),
        "chat_gallery_upload" => chat_gallery_upload(state, &args),
        "image_generate" => image_generate(state, &args).await,
        "avatar_generation_command" => avatar_generation_command(state, &args).await,
        "sprite_generate_sheet" => sprite_generate_sheet(state, &args).await,
        "sprite_generate_sheet_preview" => sprite_generate_sheet_preview(state, &args).await,
        "profile_export" => profile::profile_snapshot(state),
        "profile_import" => profile::profile_call(
            state,
            "POST",
            &["import"],
            &shared::ParsedPath::new("/profile/import"),
            optional_value(&args, "envelope"),
        ),
        "profile_import_file" => {
            let path = required_string(&args, "path")?;
            profile::import_profile_file_path(state, path)
        }
        "import_marinara" => import_call(state, &args, &["marinara"], "envelope"),
        "import_marinara_file" => import_call(state, &args, &["marinara-file"], "body"),
        "import_st_character" => import_call(state, &args, &["st-character"], "body"),
        "import_st_character_batch" => {
            import_call(state, &args, &["st-character", "batch"], "body")
        }
        "import_st_character_inspect" => {
            import_call(state, &args, &["st-character", "inspect"], "body")
        }
        "import_st_chat" => import_call(state, &args, &["st-chat"], "body"),
        "import_st_chat_into_group" => import_call(state, &args, &["st-chat-into-group"], "body"),
        "import_st_preset" => import_call(state, &args, &["st-preset"], "payload"),
        "import_st_lorebook" => import_call(state, &args, &["st-lorebook"], "payload"),
        "import_st_bulk_scan" => import_call(state, &args, &["st-bulk", "scan"], "payload"),
        "import_st_bulk_run" => import_call(state, &args, &["st-bulk", "run"], "payload"),
        "llm_complete" => llm::llm_complete(state, optional_value(&args, "request")).await,
        "llm_list_models" => {
            llm::llm_models(state, optional_string(&args, "connectionId").as_deref()).await
        }
        "llm_stream_cancel" => llm_stream_cancel(state, &args),
        _ => Err(AppError::new(
            "unsupported_command",
            format!("{command} is not exposed by the remote runtime"),
        )),
    }
}

fn storage_list(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let entity = required_string(args, "entity")?;
    let options = args.get("options").filter(|value| !value.is_null());
    let filters = options
        .and_then(|value| value.get("filters"))
        .and_then(Value::as_object);
    let mut rows = match (entity, filters) {
        ("messages", Some(filters))
            if filters.len() == 1 && filters.get("chatId").and_then(Value::as_str).is_some() =>
        {
            filters
                .get("chatId")
                .and_then(Value::as_str)
                .map(|chat_id| state.storage.list_messages_for_chat(chat_id))
                .transpose()?
                .unwrap_or_else(Vec::new)
        }
        (_, Some(filters)) if !filters.is_empty() => state.storage.list_where(entity, filters)?,
        _ => state.storage.list(entity)?,
    };

    let order_by = options
        .and_then(|value| value.get("orderBy"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty());
    let descending = options
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
        apply_message_pagination(&mut rows, options);
        for row in &mut rows {
            shared::materialize_message_swipe_fields(row);
        }
        return Ok(Value::Array(shared::project_list_rows(rows, options)));
    }

    if let Some(limit) = options
        .and_then(|value| value.get("limit"))
        .and_then(Value::as_u64)
        .map(|value| value as usize)
    {
        rows.truncate(limit);
    }

    Ok(Value::Array(shared::project_list_rows(rows, options)))
}

fn storage_get(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let entity = required_string(args, "entity")?;
    let id = required_string(args, "id")?;
    let mut value = state.storage.get(entity, id)?.unwrap_or(Value::Null);
    if entity == "messages" {
        shared::materialize_message_swipe_fields(&mut value);
    }
    Ok(shared::project_record(value, args.get("options")))
}

fn storage_create(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let entity = required_string(args, "entity")?;
    state.storage.create(
        entity,
        shared::with_entity_defaults(entity, optional_value(args, "value"))?,
    )
}

fn storage_update(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let entity = required_string(args, "entity")?;
    let id = required_string(args, "id")?;
    state.storage.patch(
        entity,
        id,
        shared::normalize_update_patch(entity, optional_value(args, "patch"))?,
    )
}

fn storage_delete(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let entity = required_string(args, "entity")?;
    let id = required_string(args, "id")?;
    if entity == "connections" {
        return crate::connection_refs::delete_connection(
            state,
            id,
            args.get("force").and_then(Value::as_bool).unwrap_or(false),
        );
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
    let existing = media_owned_record(state, entity, id)?;
    let deleted = state.storage.delete(entity, id)?;
    if deleted {
        if let Some(record) = existing.as_ref() {
            remove_owned_media(state, entity, record);
        }
    }
    Ok(json!({ "deleted": deleted }))
}

fn storage_duplicate(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    shared::duplicate_record(
        state,
        required_string(args, "entity")?,
        required_string(args, "id")?,
    )
}

fn chat_message_add_swipe(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    chats::message_swipes(
        state,
        "POST",
        required_string(args, "chatId")?,
        required_string(args, "messageId")?,
        optional_value(args, "body"),
    )
}

fn chat_message_set_active_swipe(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    chats::set_active_swipe(
        state,
        required_string(args, "chatId")?,
        required_string(args, "messageId")?,
        json!({ "index": optional_value(args, "index") }),
    )
}

fn chat_message_delete_swipe(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    chats::delete_swipe(
        state,
        required_string(args, "chatId")?,
        required_string(args, "messageId")?,
        required_string(args, "index")?,
    )
}

fn chat_autonomous_unread_mark(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    chats::mark_autonomous_unread(
        state,
        required_string(args, "chatId")?,
        optional_value(args, "body"),
    )
}

fn chat_autonomous_unread_clear(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    chats::clear_autonomous_unread(state, required_string(args, "chatId")?)
}

async fn connection_test(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    generation::test_connection(state, required_string(args, "id")?).await
}

async fn connection_test_message(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    generation::test_message(state, required_string(args, "id")?).await
}

async fn connection_test_image(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    images::test_image_generation(state, required_string(args, "id")?).await
}

async fn connection_models(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    llm::connection_models(state, required_string(args, "id")?).await
}

fn connection_save_default_parameters(
    state: &AppState,
    args: &Map<String, Value>,
) -> AppResult<Value> {
    state.storage.patch(
        "connections",
        required_string(args, "id")?,
        json!({ "defaultParameters": optional_value(args, "params") }),
    )
}

fn import_call(
    state: &AppState,
    args: &Map<String, Value>,
    rest: &[&str],
    payload_key: &str,
) -> AppResult<Value> {
    imports::import_call(state, rest, optional_value(args, payload_key))
}

fn background_upload(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    backgrounds::backgrounds_call(state, "POST", &["upload"], optional_value(args, "body"))
}

fn character_gallery_upload(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    shared::upload_gallery_image(
        state,
        "character-gallery",
        "characterId",
        required_string(args, "characterId")?,
        optional_value(args, "body"),
    )
}

fn chat_gallery_upload(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    shared::upload_gallery_image(
        state,
        "gallery",
        "chatId",
        required_string(args, "chatId")?,
        optional_value(args, "body"),
    )
}

async fn image_generate(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    images::generate_image(state, optional_value(args, "body")).await
}

async fn avatar_generation_command(
    state: &AppState,
    args: &Map<String, Value>,
) -> AppResult<Value> {
    images::avatar_generation(state, optional_value(args, "body")).await
}

async fn sprite_generate_sheet(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    sprites::generate_sprite_sheet(state, optional_value(args, "body")).await
}

async fn sprite_generate_sheet_preview(
    state: &AppState,
    args: &Map<String, Value>,
) -> AppResult<Value> {
    sprites::generate_sprite_sheet_preview(state, optional_value(args, "body")).await
}

fn llm_stream_cancel(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    llm::llm_stream_cancel(state, required_string(args, "streamId")?)
}

fn media_owned_record(state: &AppState, entity: &str, id: &str) -> AppResult<Option<Value>> {
    match entity {
        "characters" | "personas" | "lorebooks" => state.storage.get(entity, id),
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
    use base64::{engine::general_purpose, Engine as _};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-http-dispatch-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dispatch dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn upload_body(name: &str) -> Value {
        let bytes = [137_u8, 80, 78, 71];
        json!({
            "file": {
                "name": name,
                "type": "image/png",
                "size": bytes.len(),
                "base64": general_purpose::STANDARD.encode(bytes)
            }
        })
    }

    #[tokio::test]
    async fn dispatch_supports_remote_chat_gallery_upload() {
        let state = test_state("chat-gallery-upload");
        let result = dispatch(
            &state,
            InvokeRequest {
                command: "chat_gallery_upload".to_string(),
                args: Some(json!({
                    "chatId": "chat-1",
                    "body": upload_body("chat-image.png")
                })),
            },
        )
        .await
        .expect("remote chat gallery upload should dispatch");

        assert_eq!(result.get("chatId").and_then(Value::as_str), Some("chat-1"));
        assert_eq!(
            result.get("filename").and_then(Value::as_str),
            Some("chat-image.png")
        );
        assert!(result
            .get("url")
            .and_then(Value::as_str)
            .is_some_and(|url| url.starts_with("data:image/png;base64,")));
    }

    #[tokio::test]
    async fn dispatch_supports_remote_character_gallery_upload() {
        let state = test_state("character-gallery-upload");
        let result = dispatch(
            &state,
            InvokeRequest {
                command: "character_gallery_upload".to_string(),
                args: Some(json!({
                    "characterId": "character-1",
                    "body": upload_body("character-image.png")
                })),
            },
        )
        .await
        .expect("remote character gallery upload should dispatch");

        assert_eq!(
            result.get("characterId").and_then(Value::as_str),
            Some("character-1")
        );
        assert_eq!(
            result.get("filename").and_then(Value::as_str),
            Some("character-image.png")
        );
        assert!(result
            .get("url")
            .and_then(Value::as_str)
            .is_some_and(|url| url.starts_with("data:image/png;base64,")));
    }

    #[tokio::test]
    async fn dispatch_exposes_real_remote_image_generation_commands() {
        for command in [
            "image_generate",
            "avatar_generation_command",
            "sprite_generate_sheet",
            "sprite_generate_sheet_preview",
        ] {
            let state = test_state(command);
            let error = dispatch(
                &state,
                InvokeRequest {
                    command: command.to_string(),
                    args: Some(json!({ "body": {} })),
                },
            )
            .await
            .expect_err("command should dispatch into validation, not remote unsupported");

            assert_ne!(
                error.code, "unsupported_command",
                "{command} was not dispatched"
            );
            assert_eq!(
                error.code, "invalid_input",
                "{command} should reject the empty body"
            );
        }
    }

    #[tokio::test]
    async fn dispatch_supports_remote_background_upload() {
        let state = test_state("background-upload");
        let result = dispatch(
            &state,
            InvokeRequest {
                command: "background_upload".to_string(),
                args: Some(json!({ "body": upload_body("background.png") })),
            },
        )
        .await
        .expect("remote background upload should dispatch");

        assert_eq!(result.get("success").and_then(Value::as_bool), Some(true));
        assert_eq!(
            result.get("originalName").and_then(Value::as_str),
            Some("background.png")
        );
    }
}
