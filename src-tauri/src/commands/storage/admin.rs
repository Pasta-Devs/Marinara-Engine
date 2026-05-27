use super::shared::*;
use super::*;

pub(crate) fn admin_clear_all(state: &AppState) -> AppResult<Value> {
    state.storage.clear_all()?;
    clear_runtime_media(state)?;
    Ok(json!({ "success": true, "cleared": "all" }))
}

pub(crate) fn admin_expunge(state: &AppState, body: Value) -> AppResult<Value> {
    if body.get("confirm").and_then(Value::as_bool) != Some(true) {
        return Err(AppError::invalid_input("confirm must be true"));
    }
    let scopes = string_array_from_value(body.get("scopes"));
    if scopes.is_empty() {
        return Err(AppError::invalid_input(
            "At least one expunge scope is required",
        ));
    }
    let mut cleared_collections = Vec::new();
    for scope in scopes {
        match scope.as_str() {
            "chats" => clear_collections(
                state,
                &[
                    "chats",
                    "chat-folders",
                    "messages",
                    "gallery",
                    "agent-runs",
                    "knowledge-sources",
                ],
                &mut cleared_collections,
            )?,
            "characters" => {
                clear_collections(
                    state,
                    &[
                        "characters",
                        "character-groups",
                        "character-versions",
                        "character-gallery",
                        "sprites",
                    ],
                    &mut cleared_collections,
                )?;
            }
            "personas" => clear_collections(
                state,
                &["personas", "persona-groups"],
                &mut cleared_collections,
            )?,
            "lorebooks" => clear_collections(
                state,
                &["lorebooks", "lorebook-entries", "lorebook-folders"],
                &mut cleared_collections,
            )?,
            "presets" => clear_collections(
                state,
                &[
                    "prompts",
                    "prompt-groups",
                    "prompt-sections",
                    "prompt-variables",
                    "chat-presets",
                ],
                &mut cleared_collections,
            )?,
            "connections" => clear_collections(
                state,
                &["connections", "connection-folders"],
                &mut cleared_collections,
            )?,
            "automation" => clear_collections(
                state,
                &[
                    "agents",
                    "custom-tools",
                    "regex-scripts",
                    "themes",
                    "extensions",
                ],
                &mut cleared_collections,
            )?,
            "media" => {
                clear_collections(
                    state,
                    &[
                        "gallery",
                        "character-gallery",
                        "background-metadata",
                        "sprites",
                        "knowledge-sources",
                    ],
                    &mut cleared_collections,
                )?;
                clear_runtime_media(state)?;
            }
            other => {
                return Err(AppError::invalid_input(format!(
                    "Unknown expunge scope: {other}"
                )))
            }
        }
    }
    cleared_collections.sort();
    cleared_collections.dedup();
    Ok(json!({ "success": true, "clearedCollections": cleared_collections }))
}

fn clear_collections(
    state: &AppState,
    collections: &[&str],
    cleared: &mut Vec<String>,
) -> AppResult<()> {
    for collection in collections {
        state.storage.replace_all(collection, Vec::new())?;
        cleared.push((*collection).to_string());
    }
    Ok(())
}

fn clear_runtime_media(state: &AppState) -> AppResult<()> {
    for path in [
        state.data_dir.join("avatars"),
        state.data_dir.join("fonts"),
        state.data_dir.join("knowledge-sources"),
        state.game_assets.root().to_path_buf(),
        state.backgrounds.root().to_path_buf(),
    ] {
        if path.exists() {
            fs::remove_dir_all(&path)?;
        }
        fs::create_dir_all(&path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-admin-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp admin dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    #[test]
    fn admin_expunge_connections_clears_connection_folders() {
        let state = test_state("connection-folders");
        state
            .storage
            .upsert_with_id(
                "connection-folders",
                "folder-1",
                json!({
                    "id": "folder-1",
                    "name": "Providers",
                    "color": "#38bdf8",
                    "sortOrder": 1,
                    "collapsed": false
                }),
            )
            .expect("connection folder should write");
        state
            .storage
            .upsert_with_id(
                "connections",
                "conn-1",
                json!({
                    "id": "conn-1",
                    "name": "Provider",
                    "provider": "openai",
                    "model": "gpt-4.1",
                    "folderId": "folder-1"
                }),
            )
            .expect("connection should write");

        let result = admin_expunge(&state, json!({ "confirm": true, "scopes": ["connections"] }))
            .expect("connection expunge should succeed");

        assert_eq!(
            result["clearedCollections"],
            json!(["connection-folders", "connections"])
        );
        assert!(state
            .storage
            .list("connection-folders")
            .expect("connection folders should be readable")
            .is_empty());
        assert!(state
            .storage
            .list("connections")
            .expect("connections should be readable")
            .is_empty());
    }
}
