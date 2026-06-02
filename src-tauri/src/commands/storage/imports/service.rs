use super::super::media_uploads::{
    decode_image_payload, extension_for_image_mime, persist_image_bytes, persist_image_file_copy,
    safe_filename, unique_file_path,
};
use super::super::shared::*;
use super::super::*;
#[path = "access.rs"]
mod access;
#[path = "bulk_imports.rs"]
mod bulk_imports;
#[path = "marinara.rs"]
mod marinara;
#[path = "normalization.rs"]
mod normalization;
#[path = "payloads.rs"]
mod payloads;
#[path = "rollback.rs"]
mod rollback;
#[path = "st_preset.rs"]
mod st_preset;
#[path = "timestamps.rs"]
mod timestamps;
use access::*;
use marinara::*;
use normalization::*;
use payloads::*;
use rollback::*;
use st_preset::*;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use timestamps::{apply_timestamp_overrides, timestamp_overrides_from_value};

fn create_lorebook_from_payload(
    state: &AppState,
    payload: &Value,
    fallback_name: &str,
    character_id: Option<&str>,
) -> AppResult<Value> {
    let (mut lorebook, entries) = normalize_lorebook(payload, fallback_name, character_id);
    apply_timestamp_overrides(&mut lorebook, &Value::Null, payload);
    let mut created_lorebook_id = None;
    let mut created_entry_ids = Vec::new();
    let result = (|| -> AppResult<Value> {
        let record = state.storage.create("lorebooks", lorebook)?;
        let lorebook_id = created_record_id(&record, "lorebook")?;
        created_lorebook_id = Some(lorebook_id.clone());
        for (index, entry) in entries.iter().enumerate() {
            let entry = state.storage.create(
                "lorebook-entries",
                normalize_lorebook_entry(&lorebook_id, entry, index),
            )?;
            created_entry_ids.push(created_record_id(&entry, "lorebook entry")?);
        }
        flush_import_writes(state)?;
        Ok(json!({
            "success": true,
            "lorebookId": lorebook_id,
            "name": record.get("name").cloned().unwrap_or(Value::Null),
            "entriesImported": entries.len(),
            "lorebook": record
        }))
    })();

    result.map_err(|error| {
        let mut rollback_errors = Vec::new();
        rollback_created_records(
            state,
            "lorebook-entries",
            &created_entry_ids,
            &mut rollback_errors,
        );
        if let Some(lorebook_id) = created_lorebook_id.as_deref() {
            rollback_created_records(
                state,
                "lorebooks",
                &[lorebook_id.to_string()],
                &mut rollback_errors,
            );
        }
        append_rollback_errors(error, "lorebook import", rollback_errors)
    })
}

fn patch_imported_character_lorebook_pointer(
    state: &AppState,
    character_id: &str,
    lorebook_id: &str,
    entries_imported: usize,
) -> AppResult<()> {
    let character = get_required(state, "characters", character_id)?;
    let mut data = character.get("data").cloned().unwrap_or_else(|| json!({}));
    let Some(data_object) = data.as_object_mut() else {
        return Ok(());
    };
    let extensions = data_object
        .entry("extensions".to_string())
        .or_insert_with(|| json!({}));
    let Some(extensions) = extensions.as_object_mut() else {
        return Ok(());
    };
    let import_metadata = extensions
        .entry("importMetadata".to_string())
        .or_insert_with(|| json!({}));
    let Some(import_metadata) = import_metadata.as_object_mut() else {
        return Ok(());
    };
    import_metadata.insert(
        "embeddedLorebook".to_string(),
        json!({
            "hasEmbeddedLorebook": true,
            "lorebookId": lorebook_id,
            "entriesImported": entries_imported
        }),
    );
    state
        .storage
        .patch("characters", character_id, json!({ "data": data }))?;
    Ok(())
}

fn import_st_character_payload(
    state: &AppState,
    mut payload: Value,
    filename: Option<String>,
    body: &Value,
    trusted_avatar_source: Option<&Path>,
) -> AppResult<Value> {
    strip_reserved_avatar_source_fields(&mut payload);
    let tag_mode = body
        .get("tagImportMode")
        .and_then(Value::as_str)
        .unwrap_or("all");
    let existing_tags: Vec<String> = state
        .storage
        .list("characters")?
        .into_iter()
        .flat_map(|row| {
            row.get("data")
                .and_then(|data| data.get("tags"))
                .map(|tags| string_array(Some(tags)))
                .unwrap_or_default()
        })
        .collect();
    let data = normalize_character_data(&payload, tag_mode, &existing_tags);
    let name = data
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("Imported Character")
        .to_string();
    let mut record = json!({
        "data": data,
        "comment": data.get("creator_notes").and_then(Value::as_str).unwrap_or(""),
        "avatarPath": null,
        "format": payload.get("spec").and_then(Value::as_str).unwrap_or("chara_card_v2"),
    });
    if let Some(avatar) =
        imported_avatar_reference(state, &payload, filename.as_deref(), trusted_avatar_source)?
    {
        let avatar_absolute_path = avatar.absolute_path.clone();
        let object = record
            .as_object_mut()
            .expect("character import record should be an object");
        object.insert("avatarPath".to_string(), Value::String(avatar.asset_url));
        object.insert(
            "avatarFilePath".to_string(),
            Value::String(avatar_absolute_path.clone()),
        );
        object.insert("avatarFilename".to_string(), Value::String(avatar.filename));
    }
    apply_timestamp_overrides(&mut record, body, &payload);

    let avatar_absolute_path = record
        .get("avatarFilePath")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let mut created_character_id = None;
    let mut created_lorebook_id = None;
    let result = (|| -> AppResult<Value> {
        let character = state.storage.create("characters", record)?;
        let character_id = created_record_id(&character, "character")?;
        created_character_id = Some(character_id.clone());

        let import_embedded = body
            .get("importEmbeddedLorebook")
            .and_then(Value::as_str)
            .map(|raw| raw != "false")
            .unwrap_or_else(|| {
                body.get("importEmbeddedLorebook")
                    .and_then(Value::as_bool)
                    .unwrap_or(true)
            });
        let embedded = embedded_lorebook(&payload);
        let mut lorebook_result = Value::Null;
        if import_embedded {
            if let Some(book) = embedded.as_ref() {
                lorebook_result = create_lorebook_from_payload(
                    state,
                    book,
                    &format!("{name}'s Lorebook"),
                    Some(&character_id),
                )?;
                if let Some(lorebook_id) = lorebook_result.get("lorebookId").and_then(Value::as_str)
                {
                    created_lorebook_id = Some(lorebook_id.to_string());
                    patch_imported_character_lorebook_pointer(
                        state,
                        &character_id,
                        lorebook_id,
                        lorebook_entry_count(book),
                    )?;
                }
            }
        }

        flush_import_writes(state)?;
        Ok(json!({
            "success": true,
            "characterId": character.get("id").cloned().unwrap_or(Value::Null),
            "character": character,
            "name": name,
            "filename": filename,
            "embeddedLorebook": {
                "hasEmbeddedLorebook": embedded.as_ref().map(lorebook_entry_count).unwrap_or(0) > 0,
                "entries": embedded.as_ref().map(lorebook_entry_count).unwrap_or(0),
                "imported": lorebook_result.get("lorebookId").is_some(),
                "skipped": embedded.is_some() && !import_embedded
            },
            "lorebook": lorebook_result
        }))
    })();

    result.map_err(|error| {
        let mut rollback_errors = Vec::new();
        if let Some(lorebook_id) = created_lorebook_id.as_deref() {
            rollback_lorebook_tree(state, lorebook_id, &mut rollback_errors);
        }
        if let Some(character_id) = created_character_id.as_deref() {
            rollback_created_records(
                state,
                "characters",
                &[character_id.to_string()],
                &mut rollback_errors,
            );
        }
        if let Some(path) = avatar_absolute_path.as_deref() {
            rollback_managed_file_path(state, "avatars/characters", path, &mut rollback_errors);
        }
        append_rollback_errors(error, "character import", rollback_errors)
    })
}

fn strip_reserved_avatar_source_fields(payload: &mut Value) {
    let Some(object) = payload.as_object_mut() else {
        return;
    };
    object.remove("_avatarSourcePath");
    object.remove("_avatarFileCopySourcePath");
}

struct ImportedAvatarReference {
    asset_url: String,
    absolute_path: String,
    filename: String,
}

fn imported_avatar_reference(
    state: &AppState,
    payload: &Value,
    filename: Option<&str>,
    trusted_avatar_source: Option<&Path>,
) -> AppResult<Option<ImportedAvatarReference>> {
    if let Some(source) = trusted_avatar_source {
        let filename_hint = source
            .file_name()
            .and_then(|value| value.to_str())
            .or(filename)
            .unwrap_or("avatar.png");
        let stored = persist_image_file_copy(state, "avatars/characters", filename_hint, source)?;
        return Ok(Some(ImportedAvatarReference {
            asset_url: stored.asset_url,
            absolute_path: stored.absolute_path,
            filename: stored.filename,
        }));
    }
    let Some(value) = payload.get("_avatarDataUrl").and_then(Value::as_str) else {
        return Ok(None);
    };
    if !value.starts_with("data:image/") {
        return Ok(None);
    }
    let (mime, bytes) = decode_image_payload(value, "avatar")?;
    let fallback = payload
        .get("data")
        .and_then(|data| data.get("name"))
        .or_else(|| payload.get("name"))
        .and_then(Value::as_str)
        .or(filename)
        .unwrap_or("avatar");
    let stored = persist_image_bytes(
        state,
        "avatars/characters",
        &safe_filename(fallback),
        &bytes,
        &mime,
    )?;
    Ok(Some(ImportedAvatarReference {
        asset_url: stored.asset_url,
        absolute_path: stored.absolute_path,
        filename: stored.filename,
    }))
}

pub(crate) fn import_st_character(state: &AppState, body: Value) -> AppResult<Value> {
    let payload = if body.get("file").is_some() {
        let uploaded = decode_uploaded_file_value(
            body.get("file")
                .ok_or_else(|| AppError::invalid_input("file is required"))?,
        )?;
        parse_character_file(&uploaded.name, &uploaded.bytes)?
    } else {
        body.clone()
    };
    import_st_character_payload(state, payload, None, &body, None)
}

fn import_st_character_batch(state: &AppState, body: Value) -> AppResult<Value> {
    let files = decode_uploaded_files(&body, "files")?;
    let mut timestamps_by_name: HashMap<String, Vec<Value>> = HashMap::new();
    if let Some(raw_timestamps) = body.get("fileTimestamps").and_then(Value::as_str) {
        if let Ok(Value::Array(entries)) = serde_json::from_str::<Value>(raw_timestamps) {
            for entry in entries {
                let Some(name) = entry.get("name").and_then(Value::as_str) else {
                    continue;
                };
                timestamps_by_name
                    .entry(name.to_string())
                    .or_default()
                    .push(entry.clone());
            }
        }
    }
    let mut results = Vec::new();
    for file in files {
        let filename = file.name.clone();
        let mut file_body = body.clone();
        if let Some(entry) = timestamps_by_name.get_mut(&filename).and_then(|entries| {
            if entries.is_empty() {
                None
            } else {
                Some(entries.remove(0))
            }
        }) {
            if let Some(last_modified) = entry.get("lastModified").cloned() {
                if let Some(object) = file_body.as_object_mut() {
                    object.insert(
                        "timestampOverrides".to_string(),
                        json!({ "createdAt": last_modified, "updatedAt": last_modified }),
                    );
                }
            }
        }
        let result = parse_character_file(&file.name, &file.bytes).and_then(|payload| {
            import_st_character_payload(state, payload, Some(filename.clone()), &file_body, None)
        });
        match result {
            Ok(mut value) => {
                if let Some(object) = value.as_object_mut() {
                    object.insert("filename".to_string(), Value::String(filename));
                }
                results.push(value);
            }
            Err(error) => results
                .push(json!({ "filename": filename, "success": false, "error": error.message })),
        }
    }
    Ok(json!({ "success": true, "results": results }))
}

fn inspect_st_character_batch(body: Value) -> AppResult<Value> {
    let files = decode_uploaded_files(&body, "files")?;
    let mut results = Vec::new();
    for file in files {
        let filename = file.name.clone();
        match parse_character_file(&file.name, &file.bytes) {
            Ok(payload) => {
                let data = normalize_character_data(&payload, "all", &[]);
                let embedded = embedded_lorebook(&payload);
                results.push(json!({
                    "filename": filename,
                    "success": true,
                    "name": data.get("name").cloned().unwrap_or(Value::Null),
                    "hasEmbeddedLorebook": embedded.as_ref().map(lorebook_entry_count).unwrap_or(0) > 0,
                    "embeddedLorebookEntries": embedded.as_ref().map(lorebook_entry_count).unwrap_or(0)
                }));
            }
            Err(error) => results.push(json!({
                "filename": filename,
                "success": false,
                "hasEmbeddedLorebook": false,
                "embeddedLorebookEntries": 0,
                "error": error.message
            })),
        }
    }
    Ok(json!({ "success": true, "results": results }))
}

pub(crate) fn import_call(state: &AppState, rest: &[&str], body: Value) -> AppResult<Value> {
    match rest {
        ["marinara"] => {
            let payload = import_payload(body)?;
            import_marinara_envelope(state, payload)
        }
        ["marinara-file"] => import_marinara_file(state, body),
        ["st-character"] => import_st_character(state, body),
        ["st-character", "batch"] => import_st_character_batch(state, body),
        ["st-character", "inspect"] => inspect_st_character_batch(body),
        ["st-chat"] => bulk_imports::import_st_chat(state, body),
        ["st-chat-into-group"] => bulk_imports::import_st_chat_into_group(state, body),
        ["st-preset"] => {
            let payload = import_payload(body)?;
            let filename = payload
                .get("__filename")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            import_st_preset_payload(state, payload, filename.as_deref())
        }
        ["st-lorebook"] => {
            let payload = import_payload(body)?;
            create_lorebook_from_payload(
                state,
                &payload,
                payload
                    .get("__filename")
                    .and_then(Value::as_str)
                    .unwrap_or("Imported Lorebook"),
                None,
            )
        }
        ["list-directory"] => {
            let path = body.get("path").and_then(Value::as_str).unwrap_or("");
            let picker_selected = body
                .get("pickerSelected")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            let base = if path.trim().is_empty() {
                home_dir()
            } else {
                PathBuf::from(path)
            };
            directory_listing(base, picker_selected).or_else(|error| {
                Ok(json!({
                    "success": false,
                    "error": error.message
                }))
            })
        }
        ["st-bulk", "scan"] => bulk_imports::scan_st_folder(body),
        ["st-bulk", "run"] => bulk_imports::run_st_bulk_import(state, body),
        _ => Err(AppError::new(
            "route_not_found",
            format!("Unknown import route: /{}", rest.join("/")),
        )),
    }
}

pub(crate) fn import_stream_channel(
    state: &AppState,
    rest: &[&str],
    body: Value,
    on_event: tauri::ipc::Channel<Value>,
) -> AppResult<()> {
    match rest {
        ["st-bulk", "run"] | ["st-bulk", "run-stream"] => {
            bulk_imports::run_st_bulk_import_channel(state, body, |event| {
                on_event.send(event).map_err(|error| {
                    AppError::new("import_stream_channel_error", error.to_string())
                })
            })
        }
        _ => Err(AppError::new(
            "stream_not_supported",
            format!("Streaming is not supported for /import/{}", rest.join("/")),
        )),
    }
}

pub(crate) fn import_stream_callback(
    state: &AppState,
    rest: &[&str],
    body: Value,
    mut emit: impl FnMut(Value) -> AppResult<()>,
) -> AppResult<()> {
    match rest {
        ["st-bulk", "run"] | ["st-bulk", "run-stream"] => {
            bulk_imports::run_st_bulk_import_channel(state, body, &mut emit)
        }
        _ => Err(AppError::new(
            "stream_not_supported",
            format!("Streaming is not supported for /import/{}", rest.join("/")),
        )),
    }
}

#[cfg(test)]
#[path = "service_tests.rs"]
mod tests;
