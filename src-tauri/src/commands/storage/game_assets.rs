use super::*;

pub(crate) fn game_assets_manifest(state: &AppState) -> AppResult<Value> {
    state
        .game_assets
        .manifest_with_backgrounds(&state.backgrounds)
}

pub(crate) fn game_assets_tree(state: &AppState) -> AppResult<Value> {
    state.game_assets.tree()
}

pub(crate) fn game_assets_rescan(state: &AppState) -> AppResult<Value> {
    let manifest = state
        .game_assets
        .manifest_with_backgrounds(&state.backgrounds)?;
    Ok(json!({ "ok": true, "manifest": manifest }))
}

pub(crate) fn game_assets_open_folder(state: &AppState, body: Value) -> AppResult<Value> {
    let subfolder = body.get("subfolder").and_then(Value::as_str).unwrap_or("");
    let path = state.game_assets.absolute_path(subfolder)?;
    if !path.exists() {
        fs::create_dir_all(&path)?;
    }
    tauri_plugin_opener::open_path(&path, None::<&str>)
        .map_err(|error| AppError::new("open_folder_failed", error.to_string()))?;
    Ok(json!({ "ok": true, "path": path.to_string_lossy() }))
}

pub(crate) fn game_assets_folder_description(state: &AppState, body: Value) -> AppResult<Value> {
    let path = body.get("path").and_then(Value::as_str).unwrap_or("");
    let description = body
        .get("description")
        .and_then(Value::as_str)
        .unwrap_or("");
    state.game_assets.set_folder_description(path, description)
}

pub(crate) fn game_assets_upload(state: &AppState, body: Value) -> AppResult<Value> {
    let category = body
        .get("category")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("category is required"))?;
    let subcategory = body.get("subcategory").and_then(Value::as_str);
    let file = body
        .get("file")
        .ok_or_else(|| AppError::invalid_input("file is required"))?;
    state.game_assets.write_upload(category, subcategory, file)
}
