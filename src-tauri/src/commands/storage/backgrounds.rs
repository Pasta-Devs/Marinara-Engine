use super::shared::*;
use super::*;
use std::path::{Path, PathBuf};

pub(crate) fn backgrounds_call(
    state: &AppState,
    method: &str,
    rest: &[&str],
    body: Value,
) -> AppResult<Value> {
    match (method, rest) {
        ("GET", []) => list_backgrounds(state),
        ("GET", ["tags"]) => background_tags(state),
        ("GET", ["file-path", encoded]) => {
            Ok(json!({ "path": state.backgrounds.absolute_path_string(&decode_path(encoded))? }))
        }
        ("POST", ["upload"]) => {
            let uploaded = decode_uploaded_image_file(&body)?;
            let filename = write_background_file(state, &uploaded.name, &uploaded.bytes)?;
            let meta = upsert_background_meta(
                state,
                &filename,
                json!({
                    "filename": filename,
                    "originalName": uploaded.name,
                    "contentType": uploaded.content_type,
                    "tags": [],
                    "source": "user"
                }),
            )?;
            Ok(json!({
                "success": true,
                "filename": filename,
                "url": format!("marinara-background:{}", filename),
                "originalName": meta.get("originalName").and_then(Value::as_str).unwrap_or(&filename),
                "tags": [],
                "item": background_item(state, &filename, &meta)?
            }))
        }
        ("PATCH", [id, "rename"]) => rename_background(state, id, body),
        ("PATCH", [id, "tags"]) => patch_background_tags(state, id, body),
        ("DELETE", [id]) => delete_background(state, id),
        _ => Err(AppError::new(
            "route_not_found",
            format!("Unknown backgrounds route: {method} /{}", rest.join("/")),
        )),
    }
}

fn list_backgrounds(state: &AppState) -> AppResult<Value> {
    let meta_rows = state.storage.list("background-metadata")?;
    let mut rows = Vec::new();
    for item in state.backgrounds.list(None)? {
        if item.get("type").and_then(Value::as_str) == Some("folder")
            || item.get("isDirectory").and_then(Value::as_bool) == Some(true)
        {
            continue;
        }
        let filename = item
            .get("name")
            .or_else(|| item.get("path"))
            .and_then(Value::as_str)
            .unwrap_or("background")
            .to_string();
        let meta = meta_rows
            .iter()
            .find(|row| row.get("filename").and_then(Value::as_str) == Some(filename.as_str()))
            .cloned()
            .unwrap_or_else(|| json!({ "filename": filename, "originalName": filename, "tags": [], "source": "user" }));
        rows.push(background_item(state, &filename, &meta)?);
    }
    Ok(Value::Array(rows))
}

fn background_tags(state: &AppState) -> AppResult<Value> {
    let mut tags = std::collections::BTreeSet::new();
    for row in state.storage.list("background-metadata")? {
        for tag in string_array_from_value(row.get("tags")) {
            tags.insert(tag);
        }
    }
    Ok(Value::Array(tags.into_iter().map(Value::String).collect()))
}

fn patch_background_tags(state: &AppState, id: &str, body: Value) -> AppResult<Value> {
    let filename = decode_path(id);
    let tags = body.get("tags").cloned().unwrap_or_else(|| json!([]));
    let meta = upsert_background_meta(
        state,
        &filename,
        json!({
            "filename": filename,
            "tags": tags,
            "source": "user"
        }),
    )?;
    Ok(
        json!({ "tags": meta.get("tags").cloned().unwrap_or_else(|| json!([])), "item": background_item(state, &filename, &meta)? }),
    )
}

fn rename_background(state: &AppState, id: &str, body: Value) -> AppResult<Value> {
    let old_filename = decode_path(id);
    let requested = required_string(&body, "name")?;
    let new_filename = safe_background_filename(requested);
    if new_filename.is_empty() {
        return Err(AppError::invalid_input("Background name is invalid"));
    }
    let old_path = state.backgrounds.absolute_path(&old_filename)?;
    let new_path = unique_background_path(state.backgrounds.absolute_path(&new_filename)?)?;
    fs::rename(&old_path, &new_path)?;
    let actual_name = new_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or(new_filename);
    let old_meta = find_background_meta(state, &old_filename)?
        .unwrap_or_else(|| json!({ "filename": old_filename, "tags": [] }));
    if let Some(id) = old_meta.get("id").and_then(Value::as_str) {
        let _ = state.storage.delete("background-metadata", id);
    }
    let meta = upsert_background_meta(
        state,
        &actual_name,
        json!({
            "filename": actual_name,
            "originalName": old_meta.get("originalName").cloned().unwrap_or_else(|| json!(actual_name)),
            "tags": old_meta.get("tags").cloned().unwrap_or_else(|| json!([])),
            "source": "user"
        }),
    )?;
    Ok(json!({
        "success": true,
        "oldFilename": old_filename,
        "filename": actual_name,
        "url": format!("marinara-background:{}", actual_name),
        "item": background_item(state, &actual_name, &meta)?
    }))
}

fn delete_background(state: &AppState, id: &str) -> AppResult<Value> {
    let filename = decode_path(id);
    state.backgrounds.remove(&filename, false)?;
    if let Some(meta) = find_background_meta(state, &filename)? {
        if let Some(id) = meta.get("id").and_then(Value::as_str) {
            let _ = state.storage.delete("background-metadata", id);
        }
    }
    Ok(json!({ "deleted": true, "filename": filename }))
}

fn background_item(state: &AppState, filename: &str, meta: &Value) -> AppResult<Value> {
    let path = state.backgrounds.absolute_path(filename)?;
    let metadata = fs::metadata(&path)?;
    Ok(json!({
        "id": filename,
        "filename": filename,
        "name": filename,
        "path": filename,
        "absolutePath": path.to_string_lossy(),
        "url": format!("marinara-background:{}", filename),
        "originalName": meta.get("originalName").and_then(Value::as_str).unwrap_or(filename),
        "tags": meta.get("tags").cloned().unwrap_or_else(|| json!([])),
        "source": meta.get("source").and_then(Value::as_str).unwrap_or("user"),
        "type": "file",
        "isDirectory": false,
        "size": metadata.len(),
        "modified": now_iso()
    }))
}

fn write_background_file(state: &AppState, original_name: &str, bytes: &[u8]) -> AppResult<String> {
    let filename = safe_background_filename(original_name);
    if filename.is_empty() {
        return Err(AppError::invalid_input("Background filename is invalid"));
    }
    let path = unique_background_path(state.backgrounds.absolute_path(&filename)?)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, bytes)?;
    Ok(path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or(filename))
}

fn upsert_background_meta(state: &AppState, filename: &str, value: Value) -> AppResult<Value> {
    if let Some(existing) = find_background_meta(state, filename)? {
        if let Some(id) = existing
            .get("id")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
        {
            let mut patch = ensure_object(value)?;
            for (key, old_value) in ensure_object(existing)? {
                patch.entry(key).or_insert(old_value);
            }
            patch.insert("filename".to_string(), Value::String(filename.to_string()));
            return state
                .storage
                .patch("background-metadata", &id, Value::Object(patch));
        }
    }
    state.storage.create("background-metadata", value)
}

fn find_background_meta(state: &AppState, filename: &str) -> AppResult<Option<Value>> {
    let mut filters = Map::new();
    filters.insert("filename".to_string(), Value::String(filename.to_string()));
    Ok(state
        .storage
        .list_where("background-metadata", &filters)?
        .into_iter()
        .next())
}

fn safe_background_filename(name: &str) -> String {
    let path = Path::new(name);
    let stem = path
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_else(|| "background".to_string())
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | ' ') {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim()
        .trim_matches('.')
        .to_string();
    let ext = path
        .extension()
        .map(|ext| ext.to_string_lossy().to_ascii_lowercase())
        .filter(|ext| {
            matches!(
                ext.as_str(),
                "png" | "jpg" | "jpeg" | "webp" | "gif" | "avif"
            )
        })
        .unwrap_or_else(|| "png".to_string());
    format!(
        "{}.{}",
        if stem.is_empty() {
            "background"
        } else {
            stem.as_str()
        },
        ext
    )
}

fn unique_background_path(path: PathBuf) -> AppResult<PathBuf> {
    if !path.exists() {
        return Ok(path);
    }
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_else(|| "background".to_string());
    let ext = path
        .extension()
        .map(|ext| format!(".{}", ext.to_string_lossy()))
        .unwrap_or_default();
    for index in 1..10_000 {
        let candidate = parent.join(format!("{stem}-{index}{ext}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(AppError::invalid_input(
        "Could not find an available background filename",
    ))
}
