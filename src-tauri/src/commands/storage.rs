use crate::state::AppState;
use base64::{engine::general_purpose, Engine as _};
use marinara_core::{ensure_object, new_id, now_iso, now_millis, AppError, AppResult};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::fs;
use std::time::Duration;

#[path = "storage/admin.rs"]
pub(crate) mod admin;
#[path = "storage/agents.rs"]
pub(crate) mod agents;
#[path = "storage/avatars.rs"]
pub(crate) mod avatars;
#[path = "storage/backgrounds.rs"]
pub(crate) mod backgrounds;
#[path = "storage/backup.rs"]
pub(crate) mod backup;
#[path = "storage/bot_browser.rs"]
pub(crate) mod bot_browser;
#[path = "storage/characters.rs"]
pub(crate) mod characters;
#[path = "storage/chats.rs"]
pub(crate) mod chats;
#[path = "storage/custom_tools.rs"]
pub(crate) mod custom_tools;
#[path = "storage/exports.rs"]
pub(crate) mod exports;
#[path = "storage/fonts.rs"]
pub(crate) mod fonts;
#[path = "storage/game_assets.rs"]
pub(crate) mod game_assets;
#[path = "storage/game_state_snapshots.rs"]
pub(crate) mod game_state_snapshots;
#[path = "storage/generation.rs"]
pub(crate) mod generation;
#[path = "storage/http.rs"]
pub(crate) mod http;
#[path = "storage/images.rs"]
pub(crate) mod images;
#[path = "storage/imports.rs"]
pub(crate) mod imports;
#[path = "storage/integrations.rs"]
pub(crate) mod integrations;
#[path = "storage/knowledge.rs"]
pub(crate) mod knowledge;
#[path = "storage/llm.rs"]
pub(crate) mod llm;
#[path = "storage/lorebook_images.rs"]
pub(crate) mod lorebook_images;
#[path = "storage/mari.rs"]
pub(crate) mod mari;
#[path = "storage/media_uploads.rs"]
mod media_uploads;
#[path = "storage/profile.rs"]
pub(crate) mod profile;
#[path = "storage/prompts.rs"]
pub(crate) mod prompts;
#[path = "storage/shared.rs"]
pub(crate) mod shared;
#[path = "storage/sprites.rs"]
pub(crate) mod sprites;
#[path = "storage/translation.rs"]
pub(crate) mod translation;
#[path = "storage/updates.rs"]
pub(crate) mod updates;

#[path = "storage/commands/agents.rs"]
pub mod agent_commands;
#[path = "storage/commands/assets.rs"]
pub mod asset_commands;
#[path = "storage/commands/backup.rs"]
pub mod backup_commands;
#[path = "storage/commands/bot_browser.rs"]
pub mod bot_browser_commands;
#[path = "storage/commands/chats.rs"]
pub mod chat_commands;
#[path = "storage/commands/entities.rs"]
pub mod entity_commands;
#[path = "storage/commands/game_state_snapshots.rs"]
pub mod game_state_snapshot_commands;
#[path = "storage/commands/imports.rs"]
pub mod import_commands;
#[path = "storage/commands/integrations.rs"]
pub mod integration_commands;
#[path = "storage/commands/mari.rs"]
pub mod mari_commands;
#[path = "storage/commands/media.rs"]
pub mod media_commands;
#[path = "storage/commands/profile.rs"]
pub mod profile_commands;
#[path = "storage/commands/updates.rs"]
pub mod update_commands;
