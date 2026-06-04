pub mod app;
pub(crate) mod builtins;
pub(crate) mod connection_refs;
pub mod http_dispatch;
pub mod http_server;
mod seed_defaults;
pub mod state;
#[path = "commands/storage.rs"]
pub(crate) mod storage_commands;

use tauri::Manager;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn center_main_window_on_primary_monitor(app: &tauri::App) {
    use tauri::{PhysicalPosition, Position};

    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_maximized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false) {
        return;
    }
    let Ok(Some(monitor)) = window.primary_monitor() else {
        return;
    };
    let Ok(window_size) = window.outer_size() else {
        return;
    };

    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let x =
        monitor_position.x + ((monitor_size.width as i32 - window_size.width as i32) / 2).max(0);
    let y =
        monitor_position.y + ((monitor_size.height as i32 - window_size.height as i32) / 2).max(0);
    if let Err(error) = window.set_position(Position::Physical(PhysicalPosition { x, y })) {
        eprintln!("failed to center main window on primary monitor: {error}");
    }
}

#[cfg(all(debug_assertions, not(any(target_os = "android", target_os = "ios"))))]
fn open_main_window_devtools_if_requested(app: &tauri::App) {
    if std::env::var("MARINARA_TAURI_AUTO_DEVTOOLS").as_deref() != Ok("1") {
        return;
    }
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    window.open_devtools();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(feature = "devtools")]
    let builder = builder.plugin(tauri_plugin_devtools::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(
        tauri_plugin_window_state::Builder::new()
            .with_state_flags(
                tauri_plugin_window_state::StateFlags::SIZE
                    | tauri_plugin_window_state::StateFlags::MAXIMIZED
                    | tauri_plugin_window_state::StateFlags::VISIBLE
                    | tauri_plugin_window_state::StateFlags::DECORATIONS
                    | tauri_plugin_window_state::StateFlags::FULLSCREEN,
            )
            .build(),
    );

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = app::build_state(app.handle())
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            app.manage(state);
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            center_main_window_on_primary_monitor(app);
            #[cfg(all(debug_assertions, not(any(target_os = "android", target_os = "ios"))))]
            open_main_window_devtools_if_requested(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage_commands::profile_commands::load_url_binary,
            storage_commands::profile_commands::profile_export,
            storage_commands::profile_commands::profile_import,
            storage_commands::profile_commands::profile_import_preview_file,
            storage_commands::profile_commands::profile_import_preview_upload,
            storage_commands::profile_commands::profile_import_file,
            storage_commands::profile_commands::profile_import_file_events,
            storage_commands::profile_commands::profile_import_upload,
            storage_commands::backup_commands::backup_create,
            storage_commands::backup_commands::backup_list,
            storage_commands::backup_commands::backup_delete,
            storage_commands::backup_commands::backup_download,
            storage_commands::profile_commands::prompt_export,
            storage_commands::profile_commands::prompts_export_bulk,
            storage_commands::profile_commands::character_export,
            storage_commands::profile_commands::character_export_png,
            storage_commands::profile_commands::character_embedded_lorebook_import,
            storage_commands::profile_commands::characters_export_bulk,
            storage_commands::profile_commands::persona_export,
            storage_commands::profile_commands::personas_export_bulk,
            storage_commands::profile_commands::lorebook_export,
            storage_commands::profile_commands::lorebooks_export_bulk,
            storage_commands::profile_commands::lorebook_vectorize,
            storage_commands::asset_commands::backgrounds_list,
            storage_commands::asset_commands::backgrounds_tags,
            storage_commands::asset_commands::background_upload,
            storage_commands::asset_commands::background_delete,
            storage_commands::asset_commands::background_tags_update,
            storage_commands::asset_commands::background_rename,
            storage_commands::asset_commands::fonts_list,
            storage_commands::asset_commands::fonts_google_download,
            storage_commands::asset_commands::fonts_open_folder,
            storage_commands::bot_browser_commands::bot_browser_get,
            storage_commands::bot_browser_commands::bot_browser_post,
            storage_commands::asset_commands::game_assets_list,
            storage_commands::asset_commands::game_assets_manifest,
            storage_commands::asset_commands::game_assets_tree,
            storage_commands::asset_commands::game_assets_rescan,
            storage_commands::asset_commands::game_assets_create_folder,
            storage_commands::asset_commands::game_assets_delete_folder,
            storage_commands::asset_commands::game_assets_delete_file,
            storage_commands::asset_commands::game_assets_file_path,
            storage_commands::asset_commands::game_assets_read_text,
            storage_commands::asset_commands::game_assets_write_text,
            storage_commands::asset_commands::game_assets_rename,
            storage_commands::asset_commands::game_assets_move,
            storage_commands::asset_commands::game_assets_copy,
            storage_commands::asset_commands::game_assets_move_bulk,
            storage_commands::asset_commands::game_assets_copy_bulk,
            storage_commands::asset_commands::game_assets_delete_bulk,
            storage_commands::asset_commands::game_assets_file_info,
            storage_commands::asset_commands::game_assets_folder_description,
            storage_commands::asset_commands::game_assets_upload,
            storage_commands::asset_commands::game_assets_open_folder,
            storage_commands::asset_commands::background_file_path,
            storage_commands::asset_commands::lorebook_image_file_path,
            storage_commands::asset_commands::managed_asset_thumbnail_file_path,
            storage_commands::asset_commands::gif_search,
            storage_commands::integration_commands::tts_config,
            storage_commands::integration_commands::tts_update_config,
            storage_commands::integration_commands::tts_voices,
            storage_commands::integration_commands::tts_speak,
            storage_commands::integration_commands::translate_text_command,
            storage_commands::integration_commands::discord_webhook_send,
            storage_commands::integration_commands::haptic_status,
            storage_commands::integration_commands::haptic_connect,
            storage_commands::integration_commands::haptic_disconnect,
            storage_commands::integration_commands::haptic_start_scan,
            storage_commands::integration_commands::haptic_stop_scan,
            storage_commands::integration_commands::haptic_command,
            storage_commands::integration_commands::haptic_stop_all,
            storage_commands::integration_commands::spotify_status,
            storage_commands::integration_commands::spotify_authorize,
            storage_commands::integration_commands::spotify_exchange,
            storage_commands::integration_commands::spotify_disconnect,
            storage_commands::integration_commands::spotify_player,
            storage_commands::integration_commands::spotify_devices,
            storage_commands::integration_commands::spotify_access_token,
            storage_commands::integration_commands::spotify_playlists,
            storage_commands::integration_commands::spotify_playlist_tracks,
            storage_commands::integration_commands::spotify_search_tracks,
            storage_commands::integration_commands::spotify_play_track,
            storage_commands::integration_commands::spotify_dj_mari_playlist,
            storage_commands::integration_commands::spotify_player_play,
            storage_commands::integration_commands::spotify_player_pause,
            storage_commands::integration_commands::spotify_player_next,
            storage_commands::integration_commands::spotify_player_previous,
            storage_commands::integration_commands::spotify_player_transfer,
            storage_commands::integration_commands::spotify_player_volume,
            storage_commands::integration_commands::spotify_player_shuffle,
            storage_commands::integration_commands::spotify_player_repeat,
            storage_commands::import_commands::knowledge_sources_list,
            storage_commands::import_commands::knowledge_source_upload,
            storage_commands::import_commands::knowledge_source_delete,
            storage_commands::import_commands::knowledge_source_text,
            storage_commands::import_commands::import_marinara,
            storage_commands::import_commands::import_marinara_file,
            storage_commands::import_commands::import_st_character,
            storage_commands::import_commands::import_st_character_batch,
            storage_commands::import_commands::import_st_character_inspect,
            storage_commands::import_commands::import_st_chat,
            storage_commands::import_commands::import_st_chat_into_group,
            storage_commands::import_commands::import_st_preset,
            storage_commands::import_commands::import_st_lorebook,
            storage_commands::import_commands::import_list_directory,
            storage_commands::import_commands::import_st_bulk_scan,
            storage_commands::import_commands::import_st_bulk_run,
            storage_commands::import_commands::import_st_bulk_run_events,
            storage_commands::agent_commands::custom_tool_execute,
            storage_commands::agent_commands::custom_tool_capabilities,
            storage_commands::agent_commands::agent_patch_by_type,
            storage_commands::agent_commands::agent_toggle_by_type,
            storage_commands::agent_commands::agent_cadence_status,
            storage_commands::entity_commands::storage_list,
            storage_commands::entity_commands::lorebook_entries_list_by_lorebook_ids,
            storage_commands::entity_commands::storage_get,
            storage_commands::entity_commands::storage_create,
            storage_commands::entity_commands::storage_update,
            storage_commands::entity_commands::storage_delete,
            storage_commands::entity_commands::storage_duplicate,
            storage_commands::entity_commands::connection_folder_reorder,
            storage_commands::entity_commands::connection_move,
            storage_commands::game_state_snapshot_commands::tracker_snapshot_latest,
            storage_commands::game_state_snapshot_commands::tracker_snapshot_get,
            storage_commands::game_state_snapshot_commands::tracker_snapshot_save,
            storage_commands::chat_commands::chat_memories_list,
            storage_commands::chat_commands::chat_memory_delete,
            storage_commands::chat_commands::chat_memories_clear,
            storage_commands::chat_commands::chat_memories_refresh,
            storage_commands::chat_commands::chat_memories_export,
            storage_commands::chat_commands::chat_memories_import,
            storage_commands::chat_commands::chat_notes_list,
            storage_commands::chat_commands::chat_note_delete,
            storage_commands::chat_commands::chat_notes_clear,
            storage_commands::chat_commands::chat_group_delete,
            storage_commands::chat_commands::chat_autonomous_unread_mark,
            storage_commands::chat_commands::chat_autonomous_unread_clear,
            storage_commands::chat_commands::chat_messages_bulk_delete,
            storage_commands::chat_commands::chat_message_count,
            storage_commands::chat_commands::chat_branch,
            storage_commands::chat_commands::chat_message_swipes,
            storage_commands::chat_commands::chat_message_add_swipe,
            storage_commands::chat_commands::chat_message_update_content_if_unchanged,
            storage_commands::chat_commands::chat_message_set_active_swipe,
            storage_commands::chat_commands::chat_message_delete_swipe,
            storage_commands::chat_commands::chat_evict_prompt_snapshots,
            storage_commands::chat_commands::chat_connect,
            storage_commands::chat_commands::chat_disconnect,
            storage_commands::agent_commands::admin_expunge_command,
            storage_commands::agent_commands::admin_clear_all_command,
            storage_commands::agent_commands::agent_memory_get,
            storage_commands::agent_commands::agent_memory_patch,
            storage_commands::agent_commands::agent_memory_clear,
            storage_commands::agent_commands::agent_runs_clear_for_chat,
            storage_commands::agent_commands::agent_echo_messages_clear,
            storage_commands::media_commands::sprite_capabilities_command,
            storage_commands::media_commands::sprite_cleanup_status_command,
            storage_commands::media_commands::sprite_generate_sheet_preview,
            storage_commands::media_commands::sprite_generate_sheet,
            storage_commands::media_commands::sprite_cleanup,
            storage_commands::media_commands::sprite_list,
            storage_commands::media_commands::sprite_upload,
            storage_commands::media_commands::sprite_upload_bulk,
            storage_commands::media_commands::sprite_delete,
            storage_commands::media_commands::sprite_cleanup_saved,
            storage_commands::media_commands::sprite_cleanup_restore,
            storage_commands::media_commands::avatar_generation_preview_command,
            storage_commands::media_commands::avatar_generation_command,
            storage_commands::media_commands::image_generate,
            storage_commands::media_commands::character_gallery_upload,
            storage_commands::media_commands::chat_gallery_upload,
            storage_commands::media_commands::connection_test,
            storage_commands::media_commands::connection_test_message,
            storage_commands::media_commands::connection_test_image,
            storage_commands::media_commands::connection_models,
            storage_commands::media_commands::connection_diagnose_claude_subscription,
            storage_commands::media_commands::connection_save_default_parameters,
            storage_commands::media_commands::persona_activate,
            storage_commands::media_commands::character_avatar_upload,
            storage_commands::media_commands::character_avatar_remove,
            storage_commands::media_commands::avatar_thumbnail_file_path,
            storage_commands::media_commands::character_restore_version,
            storage_commands::media_commands::persona_avatar_upload,
            storage_commands::media_commands::npc_avatar_upload,
            storage_commands::media_commands::lorebook_image_upload,
            storage_commands::media_commands::llm_complete,
            storage_commands::media_commands::llm_embed,
            storage_commands::media_commands::llm_stream_channel,
            storage_commands::media_commands::llm_stream_cancel,
            storage_commands::media_commands::llm_list_models,
            storage_commands::mari_commands::professor_mari_prompt,
            storage_commands::update_commands::update_check,
            storage_commands::update_commands::update_apply,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
