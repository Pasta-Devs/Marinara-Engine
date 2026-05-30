use crate::state::AppState;
use crate::storage_commands::{
    admin, agents, avatars, backgrounds, backup, bot_browser, characters, chats, custom_tools,
    entity_commands, exports, fonts, game_assets, game_state_snapshots, generation, http, images,
    imports, integrations, knowledge, llm, lorebook_images, mari, profile, profile_commands,
    prompts, shared, sprites, translation, updates,
};
use marinara_core::{AppError, AppResult};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use std::collections::HashMap;

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

fn required_i64(args: &Map<String, Value>, key: &str) -> AppResult<i64> {
    args.get(key)
        .and_then(Value::as_i64)
        .ok_or_else(|| AppError::invalid_input(format!("{key} is required")))
}

fn optional_bool(args: &Map<String, Value>, key: &str) -> Option<bool> {
    args.get(key).and_then(Value::as_bool)
}

fn optional_u32(args: &Map<String, Value>, key: &str) -> Option<u32> {
    args.get(key)
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
}

fn required_string_vec(args: &Map<String, Value>, key: &str) -> AppResult<Vec<String>> {
    let values = args
        .get(key)
        .and_then(Value::as_array)
        .ok_or_else(|| AppError::invalid_input(format!("{key} is required")))?;
    values
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(ToOwned::to_owned)
                .ok_or_else(|| AppError::invalid_input(format!("{key} must contain strings")))
        })
        .collect()
}

pub async fn dispatch(state: &AppState, request: InvokeRequest) -> AppResult<Value> {
    let command = request.command.as_str();
    let args = args_object(request.args)?;
    match command {
        "load_url_binary" => load_url_binary(state, &args).await,
        "profile_export" => profile::profile_snapshot(state),
        "profile_import" => profile::profile_call(
            state,
            "POST",
            &["import"],
            &shared::ParsedPath::new("/profile/import"),
            optional_value(&args, "envelope"),
        ),
        "backup_create" => backup::create_backup(state),
        "backup_list" => backup::list_backups(state),
        "backup_delete" => backup::delete_backup(state, required_string(&args, "name")?),
        "backup_download" => {
            backup::download_backup(state, optional_string(&args, "name").as_deref())
        }
        "prompt_export" => exports::export_prompt(state, required_string(&args, "presetId")?),
        "prompts_export_bulk" => exports::export_records(
            state,
            "marinara_presets",
            "prompts",
            json!({ "ids": required_string_vec(&args, "ids")? }),
        ),
        "character_export" => exports::export_record(
            state,
            "marinara_character",
            "characters",
            required_string(&args, "id")?,
            optional_string(&args, "format").as_deref(),
        ),
        "character_export_png" => {
            exports::export_character_png(state, required_string(&args, "id")?)
        }
        "character_embedded_lorebook_import" => {
            exports::import_character_embedded_lorebook(state, required_string(&args, "id")?)
        }
        "characters_export_bulk" => exports::export_records(
            state,
            "marinara_characters",
            "characters",
            json!({
                "ids": required_string_vec(&args, "ids")?,
                "format": optional_value(&args, "format"),
            }),
        ),
        "persona_export" => exports::export_record(
            state,
            "marinara_persona",
            "personas",
            required_string(&args, "id")?,
            optional_string(&args, "format").as_deref(),
        ),
        "personas_export_bulk" => exports::export_records(
            state,
            "marinara_personas",
            "personas",
            json!({
                "ids": required_string_vec(&args, "ids")?,
                "format": optional_value(&args, "format"),
            }),
        ),
        "lorebook_export" => exports::export_lorebook(
            state,
            required_string(&args, "id")?,
            optional_string(&args, "format").as_deref(),
        ),
        "lorebooks_export_bulk" => exports::export_lorebooks(
            state,
            json!({
                "ids": required_string_vec(&args, "ids")?,
                "format": optional_value(&args, "format"),
            }),
        ),
        "lorebook_vectorize" => {
            prompts::vectorize_lorebook(
                state,
                required_string(&args, "id")?,
                optional_value(&args, "body"),
            )
            .await
        }
        "backgrounds_list" => backgrounds::backgrounds_call(state, "GET", &[], Value::Null),
        "backgrounds_tags" => backgrounds::backgrounds_call(state, "GET", &["tags"], Value::Null),
        "background_upload" => background_upload(state, &args),
        "background_delete" => backgrounds::backgrounds_call(
            state,
            "DELETE",
            &[required_string(&args, "filename")?],
            Value::Null,
        ),
        "background_tags_update" => backgrounds::backgrounds_call(
            state,
            "PATCH",
            &[required_string(&args, "filename")?, "tags"],
            json!({ "tags": required_string_vec(&args, "tags")? }),
        ),
        "background_rename" => backgrounds::backgrounds_call(
            state,
            "PATCH",
            &[required_string(&args, "filename")?, "rename"],
            json!({ "name": required_string(&args, "name")? }),
        ),
        "fonts_list" => fonts::fonts_call(state, "GET", &[], Value::Null).await,
        "fonts_google_download" => {
            fonts::fonts_call(
                state,
                "POST",
                &["google", "download"],
                json!({ "family": required_string(&args, "family")? }),
            )
            .await
        }
        "bot_browser_get" => bot_browser_get(state, &args).await,
        "bot_browser_post" => bot_browser_post(state, &args).await,
        "game_assets_list" => game_assets_list(state, &args),
        "game_assets_manifest" => game_assets::game_assets_manifest(state),
        "game_assets_tree" => game_assets::game_assets_tree(state),
        "game_assets_rescan" => game_assets::game_assets_rescan(state),
        "game_assets_create_folder" => {
            let path = required_string(&args, "path")?;
            state.game_assets.create_folder(path)?;
            Ok(json!({ "path": path }))
        }
        "game_assets_delete_folder" => {
            let path = required_string(&args, "path")?;
            state
                .game_assets
                .remove(path, optional_bool(&args, "recursive").unwrap_or(false))?;
            Ok(json!({ "deleted": true }))
        }
        "game_assets_delete_file" => {
            state
                .game_assets
                .remove(required_string(&args, "path")?, false)?;
            Ok(json!({ "deleted": true }))
        }
        "game_assets_file_path" => Ok(json!({
            "path": state.game_assets.absolute_path_string(required_string(&args, "path")?)?
        })),
        "game_assets_read_text" => Ok(json!({
            "content": state.game_assets.read_text(required_string(&args, "path")?)?
        })),
        "game_assets_write_text" => {
            state.game_assets.write_text(
                required_string(&args, "path")?,
                required_string(&args, "content")?,
            )?;
            Ok(json!({ "saved": true }))
        }
        "game_assets_rename" => state.game_assets.rename(
            required_string(&args, "path")?,
            required_string(&args, "newName")?,
        ),
        "game_assets_move" => state.game_assets.move_to_folder(
            required_string(&args, "path")?,
            optional_string(&args, "targetFolder")
                .as_deref()
                .unwrap_or(""),
        ),
        "game_assets_copy" => state.game_assets.copy_to_folder(
            required_string(&args, "path")?,
            optional_string(&args, "targetFolder")
                .as_deref()
                .unwrap_or(""),
        ),
        "game_assets_move_bulk" => Ok(state.game_assets.move_many(
            &required_string_vec(&args, "paths")?,
            optional_string(&args, "targetFolder")
                .as_deref()
                .unwrap_or(""),
        )),
        "game_assets_copy_bulk" => Ok(state.game_assets.copy_many(
            &required_string_vec(&args, "paths")?,
            optional_string(&args, "targetFolder")
                .as_deref()
                .unwrap_or(""),
        )),
        "game_assets_delete_bulk" => Ok(state
            .game_assets
            .delete_many(&required_string_vec(&args, "paths")?)),
        "game_assets_file_info" => state.game_assets.file_info(required_string(&args, "path")?),
        "game_assets_folder_description" => game_assets::game_assets_folder_description(
            state,
            json!({
                "path": required_string(&args, "path")?,
                "description": required_string(&args, "description")?,
            }),
        ),
        "game_assets_upload" => {
            game_assets::game_assets_upload(state, optional_value(&args, "body"))
        }
        "background_file_path" => Ok(json!({
            "path": state.backgrounds.absolute_path_string(required_string(&args, "filename")?)?
        })),
        "lorebook_image_file_path" => {
            lorebook_images::lorebook_image_file_path(state, required_string(&args, "filename")?)
        }
        "gif_search" => gif_search(&args).await,
        "tts_config" => integrations::tts_call(state, "GET", &["config"], Value::Null).await,
        "tts_update_config" => {
            integrations::tts_call(state, "PUT", &["config"], optional_value(&args, "config")).await
        }
        "tts_voices" => integrations::tts_call(state, "GET", &["voices"], Value::Null).await,
        "tts_speak" => {
            integrations::tts_call(state, "POST", &["speak"], optional_value(&args, "input")).await
        }
        "translate_text_command" => {
            translation::translate_text(state, optional_value(&args, "input")).await
        }
        "discord_webhook_send" => {
            integrations::discord_webhook_send(optional_value(&args, "body")).await
        }
        "spotify_status" => {
            spotify_direct(state, "POST", &["status"], optional_value(&args, "body")).await
        }
        "spotify_authorize" => {
            spotify_direct(
                state,
                "POST",
                &["authorize"],
                optional_value(&args, "input"),
            )
            .await
        }
        "spotify_exchange" => {
            spotify_direct(
                state,
                "POST",
                &["exchange"],
                json!({ "callbackUrl": required_string(&args, "callbackUrl")? }),
            )
            .await
        }
        "spotify_disconnect" => {
            spotify_direct(
                state,
                "POST",
                &["disconnect"],
                optional_value(&args, "body"),
            )
            .await
        }
        "spotify_player" => {
            spotify_direct(state, "GET", &["player"], optional_value(&args, "body")).await
        }
        "spotify_devices" => {
            spotify_direct(state, "GET", &["devices"], optional_value(&args, "body")).await
        }
        "spotify_access_token" => {
            spotify_direct(
                state,
                "GET",
                &["access-token"],
                optional_value(&args, "body"),
            )
            .await
        }
        "spotify_playlists" => spotify_playlists(state, &args).await,
        "spotify_playlist_tracks" => {
            spotify_direct(
                state,
                "POST",
                &["playlist-tracks"],
                optional_value(&args, "input"),
            )
            .await
        }
        "spotify_search_tracks" => {
            spotify_direct(
                state,
                "POST",
                &["search-tracks"],
                optional_value(&args, "input"),
            )
            .await
        }
        "spotify_play_track" => {
            spotify_direct(
                state,
                "POST",
                &["play-track"],
                optional_value(&args, "input"),
            )
            .await
        }
        "spotify_dj_mari_playlist" => {
            spotify_direct(
                state,
                "POST",
                &["dj-mari-playlist"],
                optional_value(&args, "input"),
            )
            .await
        }
        "spotify_player_play" => {
            spotify_direct(
                state,
                "PUT",
                &["player", "play"],
                optional_value(&args, "body"),
            )
            .await
        }
        "spotify_player_pause" => {
            spotify_direct(
                state,
                "PUT",
                &["player", "pause"],
                optional_value(&args, "body"),
            )
            .await
        }
        "spotify_player_next" => {
            spotify_direct(
                state,
                "POST",
                &["player", "next"],
                optional_value(&args, "body"),
            )
            .await
        }
        "spotify_player_previous" => {
            spotify_direct(
                state,
                "POST",
                &["player", "previous"],
                optional_value(&args, "body"),
            )
            .await
        }
        "spotify_player_transfer" => {
            spotify_direct(
                state,
                "PUT",
                &["player", "transfer"],
                optional_value(&args, "body"),
            )
            .await
        }
        "spotify_player_volume" => {
            spotify_direct(
                state,
                "PUT",
                &["player", "volume"],
                optional_value(&args, "body"),
            )
            .await
        }
        "spotify_player_shuffle" => {
            spotify_direct(
                state,
                "PUT",
                &["player", "shuffle"],
                optional_value(&args, "body"),
            )
            .await
        }
        "spotify_player_repeat" => {
            spotify_direct(
                state,
                "PUT",
                &["player", "repeat"],
                optional_value(&args, "body"),
            )
            .await
        }
        "knowledge_sources_list" => {
            knowledge::knowledge_sources_call(state, "GET", &[], Value::Null)
        }
        "knowledge_source_upload" => knowledge::knowledge_sources_call(
            state,
            "POST",
            &["upload"],
            optional_value(&args, "body"),
        ),
        "knowledge_source_delete" => knowledge::knowledge_sources_call(
            state,
            "DELETE",
            &[required_string(&args, "id")?],
            Value::Null,
        ),
        "knowledge_source_text" => knowledge::knowledge_sources_call(
            state,
            "GET",
            &[required_string(&args, "id")?, "text"],
            Value::Null,
        ),
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
        "import_list_directory" => imports::import_call(
            state,
            &["list-directory"],
            json!({
                "path": optional_string(&args, "path").unwrap_or_default(),
                "pickerSelected": optional_bool(&args, "pickerSelected").unwrap_or(false),
            }),
        ),
        "import_st_bulk_scan" => import_call(state, &args, &["st-bulk", "scan"], "payload"),
        "import_st_bulk_run" => import_call(state, &args, &["st-bulk", "run"], "payload"),
        "custom_tool_execute" => {
            custom_tools::execute_custom_tool(state, optional_value(&args, "body")).await
        }
        "custom_tool_capabilities" => Ok(custom_tools::custom_tool_capabilities()),
        "agent_patch_by_type" => agents::patch_agent_type(
            state,
            required_string(&args, "agentType")?,
            optional_value(&args, "patch"),
        ),
        "agent_toggle_by_type" => {
            agents::toggle_agent_type(state, required_string(&args, "agentType")?)
        }
        "agent_cadence_status" => agents::agent_cadence_status(
            state,
            required_string(&args, "agentType")?,
            required_string(&args, "chatId")?,
        ),
        "storage_list" => storage_list(state, &args),
        "storage_get" => storage_get(state, &args),
        "storage_create" => storage_create(state, &args),
        "storage_update" => storage_update(state, &args),
        "storage_delete" => storage_delete(state, &args),
        "storage_duplicate" => storage_duplicate(state, &args),
        "chat_message_add_swipe" => chat_message_add_swipe(state, &args),
        "chat_message_update_content_if_unchanged" => {
            chat_message_update_content_if_unchanged(state, &args)
        }
        "chat_message_set_active_swipe" => chat_message_set_active_swipe(state, &args),
        "chat_message_delete_swipe" => chat_message_delete_swipe(state, &args),
        "chat_autonomous_unread_mark" => chat_autonomous_unread_mark(state, &args),
        "chat_autonomous_unread_clear" => chat_autonomous_unread_clear(state, &args),
        "tracker_snapshot_latest" => tracker_snapshot_latest(state, &args).await,
        "tracker_snapshot_get" => tracker_snapshot_get(state, &args).await,
        "tracker_snapshot_save" => tracker_snapshot_save(state, &args).await,
        "chat_memories_list" => {
            chats::chat_array_field(state, required_string(&args, "chatId")?, "memories")
        }
        "chat_memory_delete" => chats::delete_chat_array_item(
            state,
            required_string(&args, "chatId")?,
            "memories",
            required_string(&args, "memoryId")?,
        ),
        "chat_memories_clear" => chats::set_chat_array_field(
            state,
            required_string(&args, "chatId")?,
            "memories",
            Vec::new(),
        ),
        "chat_memories_refresh" => {
            chats::refresh_chat_memories(state, required_string(&args, "chatId")?).await
        }
        "chat_memories_export" => {
            chats::export_chat_memories(state, required_string(&args, "chatId")?)
        }
        "chat_memories_import" => {
            chats::import_chat_memories(
                state,
                required_string(&args, "chatId")?,
                optional_value(&args, "body"),
            )
            .await
        }
        "chat_notes_list" => {
            chats::chat_array_field(state, required_string(&args, "chatId")?, "notes")
        }
        "chat_note_delete" => chats::delete_chat_array_item(
            state,
            required_string(&args, "chatId")?,
            "notes",
            required_string(&args, "noteId")?,
        ),
        "chat_notes_clear" => chats::set_chat_array_field(
            state,
            required_string(&args, "chatId")?,
            "notes",
            Vec::new(),
        ),
        "chat_group_delete" => chats::delete_chat_group(state, required_string(&args, "groupId")?),
        "chat_messages_bulk_delete" => chats::bulk_delete_messages(
            state,
            required_string(&args, "chatId")?,
            json!({ "messageIds": required_string_vec(&args, "messageIds")? }),
        ),
        "chat_message_count" => Ok(json!({
            "count": state
                .storage
                .count_messages_for_chat(required_string(&args, "chatId")?)?
        })),
        "chat_branch" => chats::branch_chat(
            state,
            required_string(&args, "chatId")?,
            json!({ "upToMessageId": optional_value(&args, "upToMessageId") }),
        ),
        "chat_message_swipes" => chats::message_swipes(
            state,
            "GET",
            required_string(&args, "chatId")?,
            required_string(&args, "messageId")?,
            Value::Null,
        ),
        "chat_connect" => chat_connect(state, &args),
        "chat_disconnect" => chat_disconnect(state, &args),
        "admin_expunge_command" => admin::admin_expunge(
            state,
            json!({ "confirm": true, "scopes": required_string_vec(&args, "scopes")? }),
        ),
        "admin_clear_all_command" => admin::admin_clear_all(state),
        "agent_memory_get" => agents::agent_memory(
            state,
            "GET",
            required_string(&args, "agentType")?,
            required_string(&args, "chatId")?,
            Value::Null,
        ),
        "agent_memory_patch" => agents::agent_memory(
            state,
            "PATCH",
            required_string(&args, "agentType")?,
            required_string(&args, "chatId")?,
            json!({ "patch": optional_value(&args, "patch") }),
        ),
        "agent_memory_clear" => agents::agent_memory(
            state,
            "DELETE",
            required_string(&args, "agentType")?,
            required_string(&args, "chatId")?,
            Value::Null,
        ),
        "agent_runs_clear_for_chat" => {
            agents::clear_agent_runs_and_memory_for_chat(state, required_string(&args, "chatId")?)
        }
        "agent_echo_messages_clear" => {
            agents::echo_messages(state, "DELETE", required_string(&args, "chatId")?)
        }
        "connection_test" => connection_test(state, &args).await,
        "connection_test_message" => connection_test_message(state, &args).await,
        "connection_test_image" => connection_test_image(state, &args).await,
        "connection_diagnose_claude_subscription" => {
            connection_diagnose_claude_subscription(state, &args).await
        }
        "connection_models" => connection_models(state, &args).await,
        "connection_save_default_parameters" => connection_save_default_parameters(state, &args),
        "character_gallery_upload" => character_gallery_upload(state, &args),
        "chat_gallery_upload" => chat_gallery_upload(state, &args),
        "sprite_capabilities_command" => sprites::sprite_capabilities(state),
        "sprite_cleanup_status_command" => sprites::sprite_cleanup_status(state),
        "image_generate" => image_generate(state, &args).await,
        "avatar_generation_preview_command" => {
            images::avatar_generation_preview(state, optional_value(&args, "body"))
        }
        "avatar_generation_command" => avatar_generation_command(state, &args).await,
        "sprite_generate_sheet" => sprite_generate_sheet(state, &args).await,
        "sprite_generate_sheet_preview" => sprite_generate_sheet_preview(state, &args).await,
        "sprite_cleanup" => {
            sprites::cleanup_generated_sprites(state, optional_value(&args, "body"))
        }
        "sprite_list" => sprites::list_sprites(
            state,
            required_string(&args, "characterId")?,
            optional_string(&args, "ownerType").as_deref(),
        ),
        "sprite_upload" => sprites::upload_sprite(
            state,
            required_string(&args, "characterId")?,
            optional_value(&args, "body"),
            optional_string(&args, "ownerType").as_deref(),
        ),
        "sprite_upload_bulk" => sprites::upload_sprites(
            state,
            required_string(&args, "characterId")?,
            optional_value(&args, "body"),
            optional_string(&args, "ownerType").as_deref(),
        ),
        "sprite_delete" => sprites::delete_sprite(
            state,
            required_string(&args, "characterId")?,
            required_string(&args, "expression")?,
            optional_string(&args, "ownerType").as_deref(),
        ),
        "sprite_cleanup_saved" => sprites::clean_saved_sprites(
            state,
            required_string(&args, "characterId")?,
            optional_value(&args, "body"),
            optional_string(&args, "ownerType").as_deref(),
        ),
        "sprite_cleanup_restore" => sprites::restore_sprite_cleanup_point(
            state,
            required_string(&args, "characterId")?,
            optional_value(&args, "body"),
            optional_string(&args, "ownerType").as_deref(),
        ),
        "persona_activate" => characters::activate_persona(state, required_string(&args, "id")?),
        "character_avatar_upload" => avatars::update_character_avatar(
            state,
            "characters",
            required_string(&args, "id")?,
            optional_value(&args, "body"),
        ),
        "character_restore_version" => characters::restore_character_version(
            state,
            required_string(&args, "characterId")?,
            required_string(&args, "versionId")?,
        ),
        "persona_avatar_upload" => avatars::update_character_avatar(
            state,
            "personas",
            required_string(&args, "id")?,
            optional_value(&args, "body"),
        ),
        "npc_avatar_upload" => avatars::update_npc_avatar(
            state,
            required_string(&args, "chatId")?,
            optional_value(&args, "body"),
        ),
        "lorebook_image_upload" => lorebook_images::update_lorebook_image(
            state,
            required_string(&args, "id")?,
            optional_value(&args, "body"),
        ),
        "llm_complete" => llm::llm_complete(state, optional_value(&args, "request")).await,
        "llm_embed" => llm::llm_embed(state, optional_value(&args, "body")).await,
        "llm_list_models" => {
            llm::llm_models(state, optional_string(&args, "connectionId").as_deref()).await
        }
        "llm_stream_cancel" => llm_stream_cancel(state, &args),
        "professor_mari_prompt" => {
            mari::professor_mari_prompt(state, optional_value(&args, "request")).await
        }
        "update_check" => updates::check_updates().await,
        "update_apply" => updates::apply_update(optional_value(&args, "input")),
        _ => Err(AppError::new(
            "unsupported_command",
            format!("{command} is not exposed by the remote runtime"),
        )),
    }
}

async fn load_url_binary(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    profile_commands::load_url_binary_for_state(
        state,
        required_string(args, "url")?,
        optional_string(args, "fallbackMime")
            .as_deref()
            .unwrap_or("application/octet-stream"),
    )
    .await
}

fn bot_browser_route(path: &str) -> shared::ParsedPath {
    let trimmed = path.trim_start_matches('/');
    let local = trimmed.strip_prefix("bot-browser/").unwrap_or(trimmed);
    shared::ParsedPath::new(local)
}

async fn bot_browser_get(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let route = bot_browser_route(required_string(args, "path")?);
    let rest = route.parts.iter().map(String::as_str).collect::<Vec<_>>();
    bot_browser::bot_browser_call(state, "GET", &rest, &route, Value::Null).await
}

async fn bot_browser_post(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let route = bot_browser_route(required_string(args, "path")?);
    let rest = route.parts.iter().map(String::as_str).collect::<Vec<_>>();
    bot_browser::bot_browser_call(state, "POST", &rest, &route, optional_value(args, "body")).await
}

fn game_assets_list(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    Ok(json!({
        "items": state.game_assets.list(optional_string(args, "path").as_deref())?,
        "root": state.game_assets.root().to_string_lossy()
    }))
}

async fn gif_search(args: &Map<String, Value>) -> AppResult<Value> {
    let mut query = HashMap::new();
    if let Some(q) = optional_string(args, "q") {
        query.insert("q".to_string(), q);
    }
    if let Some(limit) = optional_u32(args, "limit") {
        query.insert("limit".to_string(), limit.to_string());
    }
    if let Some(pos) = optional_string(args, "pos") {
        query.insert("pos".to_string(), pos);
    }
    http::gifs_search(&shared::ParsedPath {
        parts: Vec::new(),
        query,
    })
    .await
}

async fn spotify_direct(
    state: &AppState,
    method: &str,
    rest: &[&str],
    body: Value,
) -> AppResult<Value> {
    integrations::spotify_call(
        state,
        method,
        rest,
        &shared::ParsedPath::new("/spotify"),
        body,
    )
    .await
}

async fn spotify_playlists(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let route = shared::ParsedPath::new(&format!(
        "/spotify/playlists?limit={}",
        optional_u32(args, "limit").unwrap_or(50)
    ));
    integrations::spotify_call(
        state,
        "GET",
        &["playlists"],
        &route,
        json!({ "agentId": optional_value(args, "agentId") }),
    )
    .await
}

async fn tracker_snapshot_latest(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    Ok(
        game_state_snapshots::latest_tracker_snapshot(state, required_string(args, "chatId")?)?
            .unwrap_or(Value::Null),
    )
}

async fn tracker_snapshot_get(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    Ok(game_state_snapshots::tracker_snapshot_for_target(
        state,
        required_string(args, "chatId")?,
        required_string(args, "messageId")?,
        required_i64(args, "swipeIndex")?,
    )?
    .unwrap_or(Value::Null))
}

async fn tracker_snapshot_save(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    game_state_snapshots::save_tracker_snapshot(
        state,
        required_string(args, "chatId")?,
        optional_value(args, "snapshot"),
    )
}

fn chat_connect(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let chat_id = required_string(args, "chatId")?;
    let target_chat_id = required_string(args, "targetChatId")?;
    state.storage.patch(
        "chats",
        chat_id,
        json!({ "connectedChatId": target_chat_id.to_string() }),
    )?;
    state.storage.patch(
        "chats",
        target_chat_id,
        json!({ "connectedChatId": chat_id.to_string() }),
    )?;
    Ok(json!({ "connected": true }))
}

fn chat_disconnect(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    state.storage.patch(
        "chats",
        required_string(args, "chatId")?,
        json!({ "connectedChatId": Value::Null }),
    )?;
    Ok(json!({ "disconnected": true }))
}

fn storage_list(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let entity = required_string(args, "entity")?;
    let options = args.get("options").filter(|value| !value.is_null());
    let filters = options
        .and_then(|value| value.get("filters"))
        .and_then(Value::as_object);
    let projection_fields = shared::projection_fields(options);
    let empty_filters = filters.is_none_or(|filters| filters.is_empty());
    let has_search = shared::has_storage_search(options);
    let mut rows = match (entity, filters) {
        ("messages", Some(filters))
            if filters.len() == 1 && filters.get("chatId").and_then(Value::as_str).is_some() =>
        {
            let chat_id = filters
                .get("chatId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if !has_search {
                if let Some((limit, before)) = message_page_options(options) {
                    state
                        .storage
                        .list_messages_for_chat_page(chat_id, limit, before.as_deref())?
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
            let search_projection_fields = shared::search_projection_fields(options);
            let search_projection_field_selections =
                shared::search_projection_field_selections(options);
            state.storage.list_projected(
                entity,
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
                entity,
                projection_fields.as_deref().unwrap_or(&[]),
                shared::projection_field_selections(options),
            )?
        }
        (_, Some(filters)) if !filters.is_empty() => state.storage.list_where(entity, filters)?,
        _ => state.storage.list(entity)?,
    };
    shared::apply_storage_search(&mut rows, options);

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
    let created = state.storage.create(
        entity,
        shared::with_entity_defaults(entity, optional_value(args, "value"))?,
    )?;
    if entity == "messages" {
        return Ok(shared::project_timeline_message(created));
    }
    Ok(created)
}

fn storage_update(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let entity = required_string(args, "entity")?;
    let id = required_string(args, "id")?;
    if entity == "messages" {
        return Ok(shared::project_timeline_message(shared::patch_message_update(
            state,
            id,
            optional_value(args, "patch"),
        )?));
    }
    state.storage.patch(
        entity,
        id,
        shared::normalize_update_patch(entity, optional_value(args, "patch"))?,
    )
}

fn storage_delete(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    let entity = required_string(args, "entity")?;
    let id = required_string(args, "id")?;
    entity_commands::delete_entity(
        state,
        entity,
        id,
        args.get("force").and_then(Value::as_bool).unwrap_or(false),
    )
}

fn storage_duplicate(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    shared::duplicate_record(
        state,
        required_string(args, "entity")?,
        required_string(args, "id")?,
    )
}

fn chat_message_add_swipe(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    Ok(shared::project_timeline_message(chats::message_swipes(
        state,
        "POST",
        required_string(args, "chatId")?,
        required_string(args, "messageId")?,
        optional_value(args, "body"),
    )?))
}

fn chat_message_update_content_if_unchanged(
    state: &AppState,
    args: &Map<String, Value>,
) -> AppResult<Value> {
    chats::update_message_content_if_unchanged(
        state,
        required_string(args, "chatId")?,
        required_string(args, "messageId")?,
        required_string(args, "expectedContent")?,
        required_string(args, "content")?,
    )
}

fn chat_message_set_active_swipe(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    Ok(shared::project_timeline_message(chats::set_active_swipe(
        state,
        required_string(args, "chatId")?,
        required_string(args, "messageId")?,
        json!({ "index": optional_value(args, "index") }),
    )?))
}

fn chat_message_delete_swipe(state: &AppState, args: &Map<String, Value>) -> AppResult<Value> {
    Ok(shared::project_timeline_message(chats::delete_swipe(
        state,
        required_string(args, "chatId")?,
        required_string(args, "messageId")?,
        required_string(args, "index")?,
    )?))
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

async fn connection_diagnose_claude_subscription(
    state: &AppState,
    args: &Map<String, Value>,
) -> AppResult<Value> {
    llm::connection_diagnose_claude_subscription(state, required_string(args, "id")?).await
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
    use crate::storage_commands::media_uploads::file_path_asset_url;
    use base64::{engine::general_purpose, Engine as _};
    use std::collections::BTreeSet;
    use std::time::{SystemTime, UNIX_EPOCH};

    // Commands that stay out of /api/invoke because they require the client shell,
    // local filesystem paths, Tauri IPC channels, or user-machine devices.
    const NON_REMOTE_COMMANDS: &[&str] = &[
        "fonts_open_folder",
        "game_assets_open_folder",
        "haptic_command",
        "haptic_connect",
        "haptic_disconnect",
        "haptic_start_scan",
        "haptic_status",
        "haptic_stop_all",
        "haptic_stop_scan",
        "import_st_bulk_run_events",
        "llm_stream_channel",
        "profile_import_file",
    ];

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
        // Full 8-byte PNG signature so the image-byte validation in
        // decode_uploaded_image_file recognizes the fixture as a real image.
        let bytes = [137_u8, 80, 78, 71, 13, 10, 26, 10];
        json!({
            "file": {
                "name": name,
                "type": "image/png",
                "size": bytes.len(),
                "base64": general_purpose::STANDARD.encode(bytes)
            }
        })
    }

    fn quoted_commands(source: &str) -> BTreeSet<String> {
        source
            .split('"')
            .skip(1)
            .step_by(2)
            .filter(|value| {
                value
                    .chars()
                    .all(|character| character.is_ascii_lowercase() || character == '_')
            })
            .map(ToOwned::to_owned)
            .collect()
    }

    fn dispatch_arm_commands(source: &str) -> BTreeSet<String> {
        source
            .lines()
            .filter_map(|line| {
                let trimmed = line.trim_start();
                if !trimmed.starts_with('"') || !trimmed.contains("=>") {
                    return None;
                }
                trimmed.split('"').nth(1).map(ToOwned::to_owned)
            })
            .collect()
    }

    fn desktop_commands() -> BTreeSet<String> {
        let source = include_str!("lib.rs");
        source
            .split("storage_commands::")
            .skip(1)
            .filter_map(|rest| rest.split("::").nth(1))
            .filter_map(|rest| {
                let command = rest
                    .chars()
                    .take_while(|character| character.is_ascii_alphanumeric() || *character == '_')
                    .collect::<String>();
                (!command.is_empty()).then_some(command)
            })
            .collect()
    }

    #[test]
    fn remote_runtime_command_surfaces_match_desktop_minus_documented_non_remote_commands() {
        let mut expected_remote = desktop_commands();
        for command in NON_REMOTE_COMMANDS {
            assert!(
                expected_remote.remove(*command),
                "{command} should still exist in the desktop command surface"
            );
        }

        let remote_runtime = include_str!("../../src/shared/api/remote-runtime.ts");
        let remote_allowlist_source = remote_runtime
            .split("const REMOTE_COMMANDS = new Set([")
            .nth(1)
            .and_then(|rest| rest.split("]);").next())
            .expect("remote command allowlist should be parseable");
        let remote_allowlist = quoted_commands(remote_allowlist_source);

        let dispatch_source = include_str!("http_dispatch.rs");
        let dispatch_match_source = dispatch_source
            .split("match command {")
            .nth(1)
            .and_then(|rest| rest.split("_ => Err").next())
            .expect("http dispatch match should be parseable");
        let dispatch_commands = dispatch_arm_commands(dispatch_match_source);

        assert_eq!(remote_allowlist, expected_remote);
        assert_eq!(dispatch_commands, remote_allowlist);
    }

    #[tokio::test]
    async fn dispatch_load_url_binary_reads_managed_asset_urls() {
        let state = test_state("load-url-binary-local-asset");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let avatar_path = avatar_dir.join("Avatar One.png");
        std::fs::write(&avatar_path, b"avatar-bytes").expect("avatar should be written");

        let result = dispatch(
            &state,
            InvokeRequest {
                command: "load_url_binary".to_string(),
                args: Some(json!({
                    "url": file_path_asset_url(&avatar_path),
                    "fallbackMime": "application/octet-stream"
                })),
            },
        )
        .await
        .expect("remote load_url_binary should load managed local assets");

        let base64 = result
            .get("base64")
            .and_then(Value::as_str)
            .expect("response should include base64");
        let bytes = general_purpose::STANDARD
            .decode(base64)
            .expect("base64 should decode");
        assert_eq!(bytes, b"avatar-bytes");
        assert_eq!(
            result.get("mimeType"),
            Some(&Value::String("image/png".into()))
        );
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

    #[tokio::test]
    async fn dispatch_storage_delete_message_cleans_tracker_snapshots() {
        let state = test_state("message-delete-tracker-cleanup");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "chat-1",
                    "name": "Tracker chat",
                    "gameState": { "kind": "tracker", "chatId": "chat-1", "messageId": "message-2", "swipeIndex": 0 }
                }),
            )
            .unwrap();
        for (message_id, created_at) in [
            ("message-1", "2026-05-26T10:00:00Z"),
            ("message-2", "2026-05-26T10:01:00Z"),
        ] {
            state
                .storage
                .create(
                    "messages",
                    json!({
                        "id": message_id,
                        "chatId": "chat-1",
                        "role": "assistant",
                        "content": "turn",
                        "createdAt": created_at
                    }),
                )
                .unwrap();
            state
                .storage
                .create(
                    "game-state-snapshots",
                    json!({
                        "id": format!("snapshot-{message_id}"),
                        "kind": "tracker",
                        "chatId": "chat-1",
                        "messageId": message_id,
                        "swipeIndex": 0,
                        "createdAt": created_at,
                        "location": message_id
                    }),
                )
                .unwrap();
        }

        let result = dispatch(
            &state,
            InvokeRequest {
                command: "storage_delete".to_string(),
                args: Some(json!({ "entity": "messages", "id": "message-2" })),
            },
        )
        .await
        .expect("remote message delete should dispatch");

        assert_eq!(result["deleted"], true);
        assert!(state
            .storage
            .get("messages", "message-2")
            .unwrap()
            .is_none());
        assert!(state
            .storage
            .get("game-state-snapshots", "snapshot-message-2")
            .unwrap()
            .is_none());
        assert!(state
            .storage
            .get("game-state-snapshots", "snapshot-message-1")
            .unwrap()
            .is_some());
        let chat = state.storage.get("chats", "chat-1").unwrap().unwrap();
        assert_eq!(
            chat["gameState"].get("messageId").and_then(Value::as_str),
            Some("message-1")
        );
    }

    #[tokio::test]
    async fn dispatch_storage_delete_non_message_keeps_tracker_snapshots() {
        let state = test_state("non-message-delete-tracker-control");
        state
            .storage
            .create(
                "personas",
                json!({ "id": "persona-1", "name": "Keep tracker snapshots" }),
            )
            .unwrap();
        state
            .storage
            .create(
                "game-state-snapshots",
                json!({
                    "id": "snapshot-message-1",
                    "kind": "tracker",
                    "chatId": "chat-1",
                    "messageId": "message-1",
                    "swipeIndex": 0
                }),
            )
            .unwrap();

        let result = dispatch(
            &state,
            InvokeRequest {
                command: "storage_delete".to_string(),
                args: Some(json!({ "entity": "personas", "id": "persona-1" })),
            },
        )
        .await
        .expect("remote non-message delete should dispatch");

        assert_eq!(result["deleted"], true);
        assert!(state
            .storage
            .get("game-state-snapshots", "snapshot-message-1")
            .unwrap()
            .is_some());
    }

    #[tokio::test]
    async fn dispatch_supports_remote_update_apply_manual_path() {
        let state = test_state("update-apply");
        let result = dispatch(
            &state,
            InvokeRequest {
                command: "update_apply".to_string(),
                args: Some(json!({
                    "input": {
                        "confirm": true,
                        "latestVersion": "1.6.2",
                        "releaseTag": "v1.6.2",
                        "releaseUrl": "https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v1.6.2"
                    }
                })),
            },
        )
        .await
        .expect("remote update apply should dispatch into manual release instructions");

        assert_eq!(result["status"], "manual_update_required");
        assert_eq!(result["applyAvailable"], false);
        assert_eq!(
            result["applyUnavailableReason"],
            "tauri-updater-not-configured"
        );
    }
}
