use super::*;

const PROFILE_IMPORT_GUIDANCE: &str =
    "Full profile exports must be imported with Import Profile in Settings -> Import. Use Import Profile (JSON/ZIP) instead.";

pub(super) fn import_marinara_file(state: &AppState, body: Value) -> AppResult<Value> {
    let uploaded = decode_uploaded_file_value(
        body.get("file")
            .ok_or_else(|| AppError::invalid_input("file is required"))?,
    )?;
    if uploaded.bytes.len() < 4 || uploaded.bytes[0] != 0x50 || uploaded.bytes[1] != 0x4b {
        return Err(AppError::invalid_input(
            "Not a .marinara file (zip signature missing)",
        ));
    }

    let names = read_zip_entry_names(&uploaded.bytes)?;
    if zip_entry_name_case_insensitive(&names, "marinara-profile.json").is_some() {
        return Err(AppError::invalid_input(PROFILE_IMPORT_GUIDANCE));
    }
    const MAX_PACKAGE_ENTRIES: usize = 8;
    const MAX_DATA_JSON_BYTES: usize = 5 * 1024 * 1024;
    const MAX_AVATAR_BYTES: usize = 20 * 1024 * 1024;
    if names.len() > MAX_PACKAGE_ENTRIES {
        return Err(AppError::invalid_input(
            ".marinara file has too many entries",
        ));
    }

    let data_entry = zip_entry_name_case_insensitive(&names, "data.json")
        .ok_or_else(|| AppError::invalid_input(".marinara file is missing data.json"))?;
    let data_bytes = read_zip_entry(&uploaded.bytes, &data_entry)?
        .ok_or_else(|| AppError::invalid_input(".marinara file is missing data.json"))?;
    if data_bytes.len() > MAX_DATA_JSON_BYTES {
        return Err(AppError::invalid_input(
            "data.json in .marinara file is too large",
        ));
    }
    let mut envelope = parse_object(&data_bytes)?;

    let avatar_name = names
        .iter()
        .find(|name| {
            let lower = name.to_ascii_lowercase();
            Path::new(name)
                .file_name()
                .and_then(|value| value.to_str())
                .map(|filename| filename.to_ascii_lowercase().starts_with("avatar."))
                .unwrap_or(false)
                && matches!(
                    lower.rsplit('.').next(),
                    Some("png" | "jpg" | "jpeg" | "webp" | "gif" | "avif")
                )
        })
        .cloned();
    if let Some(avatar_name) = avatar_name {
        let avatar = read_zip_entry(&uploaded.bytes, &avatar_name)?
            .ok_or_else(|| AppError::invalid_input("Could not read .marinara avatar"))?;
        if avatar.len() > MAX_AVATAR_BYTES {
            return Err(AppError::invalid_input(
                "Avatar image in .marinara file is too large",
            ));
        }
        let mime = image_mime_from_path(&avatar_name);
        if let Some(data) = envelope.get_mut("data").and_then(Value::as_object_mut) {
            data.insert(
                "avatar".to_string(),
                Value::String(format!(
                    "data:{mime};base64,{}",
                    general_purpose::STANDARD.encode(avatar)
                )),
            );
        }
    }

    if let Some(timestamp_overrides) = body
        .get("timestampOverrides")
        .cloned()
        .or_else(|| body.get("__timestampOverrides").cloned())
    {
        if let Some(data) = envelope.get_mut("data").and_then(Value::as_object_mut) {
            let metadata = data
                .entry("metadata".to_string())
                .or_insert_with(|| json!({}));
            if let Some(metadata) = metadata.as_object_mut() {
                metadata.insert("timestamps".to_string(), timestamp_overrides);
            }
        }
    }

    import_marinara_envelope(state, envelope)
}

fn data_string_name(record: &Value) -> Option<String> {
    record
        .get("data")
        .and_then(|data| data.get("name"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

fn data_image_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .filter(|value| value.starts_with("data:image/"))
        .map(ToOwned::to_owned)
}

fn remove_fields(value: &mut Value, fields: &[&str]) {
    if let Some(object) = value.as_object_mut() {
        for field in fields {
            object.remove(*field);
        }
    }
}

fn hydrate_metadata_timestamps(value: &mut Value) {
    let Some(metadata) = value.get_mut("metadata").and_then(Value::as_object_mut) else {
        return;
    };
    if metadata.contains_key("timestamps") {
        return;
    }
    let created_at = metadata.get("createdAt").cloned();
    let updated_at = metadata.get("updatedAt").cloned();
    if created_at.is_none() && updated_at.is_none() {
        return;
    }
    metadata.insert(
        "timestamps".to_string(),
        json!({
            "createdAt": created_at.unwrap_or(Value::Null),
            "updatedAt": updated_at.unwrap_or(Value::Null)
        }),
    );
}

fn inherit_wrapper_timestamps(record: &mut Value, wrapper: &Value) {
    let Some(timestamps) = wrapper
        .get("metadata")
        .and_then(|metadata| metadata.get("timestamps"))
        .cloned()
    else {
        return;
    };
    let Some(object) = record.as_object_mut() else {
        return;
    };
    let metadata = object
        .entry("metadata".to_string())
        .or_insert_with(|| json!({}));
    if let Some(metadata) = metadata.as_object_mut() {
        metadata
            .entry("timestamps".to_string())
            .or_insert(timestamps);
    }
}

fn apply_import_timestamps(record: &mut Value, payload: &Value) {
    let mut timestamp_payload = payload.clone();
    hydrate_metadata_timestamps(&mut timestamp_payload);
    apply_timestamp_overrides(record, &Value::Null, &timestamp_payload);
}

fn created_record_id(record: &Value, label: &str) -> AppResult<String> {
    record
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AppError::new("storage_error", format!("Created {label} is missing an id")))
}

fn array_from_envelope(data: &Value, envelope: &Map<String, Value>, key: &str) -> Vec<Value> {
    data.get(key)
        .or_else(|| envelope.get(key))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn import_parented_records(
    state: &AppState,
    items: Vec<Value>,
    collection: &str,
    owner_field: &str,
    owner_id: &str,
    parent_field: &str,
    label: &str,
) -> AppResult<HashMap<String, String>> {
    let mut created_ids = Vec::new();
    let result = (|| -> AppResult<HashMap<String, String>> {
        let mut id_map = HashMap::new();
        let mut pending_parents = Vec::new();
        for item in items {
            let old_id = item
                .get("id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let old_parent_id = item
                .get(parent_field)
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let mut record = ensure_object(item)?;
            record.remove("id");
            record.remove(owner_field);
            record.insert(owner_field.to_string(), Value::String(owner_id.to_string()));
            if old_parent_id.is_some() {
                record.insert(parent_field.to_string(), Value::Null);
            }
            let created = state.storage.create(collection, Value::Object(record))?;
            let new_id = created_record_id(&created, label)?;
            created_ids.push(new_id.clone());
            if let Some(old_id) = old_id {
                id_map.insert(old_id, new_id.clone());
            }
            if let Some(old_parent_id) = old_parent_id {
                pending_parents.push((new_id, old_parent_id));
            }
        }
        for (record_id, old_parent_id) in pending_parents {
            if let Some(new_parent_id) = id_map.get(&old_parent_id) {
                let mut patch = Map::new();
                patch.insert(
                    parent_field.to_string(),
                    Value::String(new_parent_id.clone()),
                );
                state
                    .storage
                    .patch(collection, &record_id, Value::Object(patch))?;
            }
        }
        Ok(id_map)
    })();

    result.map_err(|error| rollback_created_records(state, collection, &created_ids, error))
}

fn rollback_created_records(
    state: &AppState,
    collection: &str,
    record_ids: &[String],
    error: AppError,
) -> AppError {
    let mut rollback_errors = Vec::new();
    for record_id in record_ids.iter().rev() {
        if let Err(rollback_error) = state.storage.delete(collection, record_id) {
            rollback_errors.push(format!("{record_id}: {rollback_error}"));
        }
    }
    if rollback_errors.is_empty() {
        error
    } else {
        AppError::new(
            "storage_rollback_failed",
            format!(
                "{error}; additionally failed to roll back imported {collection} records: {}",
                rollback_errors.join("; ")
            ),
        )
    }
}

fn extension_from_filename(filename: &str) -> Option<&'static str> {
    match Path::new(filename)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => Some("jpg"),
        "webp" => Some("webp"),
        "gif" => Some("gif"),
        "avif" => Some("avif"),
        "png" => Some("png"),
        "svg" => Some("svg"),
        _ => None,
    }
}

fn import_image_filename(raw: Option<&str>, fallback: &str, ext: &str) -> String {
    let mut filename = raw
        .filter(|value| !value.trim().is_empty())
        .map(safe_filename)
        .unwrap_or_else(|| format!("{}.{}", safe_filename(fallback), ext));
    if Path::new(&filename).extension().is_none() {
        filename.push('.');
        filename.push_str(ext);
    }
    filename
}

fn restore_sprites(state: &AppState, target_id: &str, sprites: Option<&Value>) -> AppResult<usize> {
    let Some(items) = sprites.and_then(Value::as_array) else {
        return Ok(0);
    };
    if items.is_empty() || target_id.contains('/') || target_id.contains('\\') {
        return Ok(0);
    }
    let dir = state.data_dir.join("sprites").join(target_id);
    fs::create_dir_all(&dir)?;
    let mut imported = 0usize;
    for (index, sprite) in items.iter().enumerate() {
        let Some(image) = sprite
            .get("data")
            .or_else(|| sprite.get("url"))
            .and_then(Value::as_str)
            .filter(|value| value.starts_with("data:image/"))
        else {
            continue;
        };
        let (mime, bytes) = decode_image_payload(image, "sprite")?;
        let ext = extension_for_image_mime(&mime)
            .or_else(|| {
                sprite
                    .get("filename")
                    .and_then(Value::as_str)
                    .and_then(extension_from_filename)
            })
            .unwrap_or("png");
        let fallback = sprite
            .get("expression")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| format!("sprite-{}", index + 1));
        let filename = import_image_filename(
            sprite.get("filename").and_then(Value::as_str),
            &fallback,
            ext,
        );
        let target = unique_file_path(&dir.join(filename))?;
        fs::write(target, bytes)?;
        imported += 1;
    }
    Ok(imported)
}

fn restore_character_gallery(
    state: &AppState,
    character_id: &str,
    gallery: Option<&Value>,
) -> AppResult<usize> {
    let Some(items) = gallery.and_then(Value::as_array) else {
        return Ok(0);
    };
    let mut imported = 0usize;
    for (index, item) in items.iter().enumerate() {
        let Some(data_url) = item
            .get("data")
            .or_else(|| item.get("url"))
            .and_then(Value::as_str)
            .filter(|value| value.starts_with("data:image/"))
        else {
            continue;
        };
        let (mime, _) = decode_image_payload(data_url, "gallery image")?;
        let ext = extension_for_image_mime(&mime).unwrap_or("png");
        let filename = import_image_filename(
            item.get("filename").and_then(Value::as_str),
            &format!("gallery-{}", index + 1),
            ext,
        );
        state.storage.create(
            "character-gallery",
            json!({
                "characterId": character_id,
                "filePath": filename,
                "filename": filename,
                "url": data_url,
                "prompt": item.get("prompt").cloned().unwrap_or_else(|| json!("")),
                "provider": item.get("provider").cloned().unwrap_or_else(|| json!("")),
                "model": item.get("model").cloned().unwrap_or_else(|| json!("")),
                "width": item.get("width").cloned().unwrap_or(Value::Null),
                "height": item.get("height").cloned().unwrap_or(Value::Null)
            }),
        )?;
        imported += 1;
    }
    Ok(imported)
}

fn import_marinara_character(state: &AppState, data: Value) -> AppResult<Value> {
    if data.get("spec").is_some() && data.get("data").is_some_and(Value::is_object) {
        let mut character_data = data.get("data").cloned().unwrap_or_else(|| json!({}));
        strip_stale_embedded_lorebook_pointer(&mut character_data);
        let mut record = json!({
            "data": character_data,
            "comment": data
                .get("metadata")
                .and_then(|metadata| metadata.get("comment"))
                .and_then(Value::as_str)
                .unwrap_or(""),
            "avatarPath": data_image_string(data.get("avatar")).map(Value::String).unwrap_or(Value::Null),
            "format": data.get("spec").and_then(Value::as_str).unwrap_or("chara_card_v2"),
        });
        if let Some(avatar) = data_image_string(data.get("avatar")) {
            if let Some(object) = record.as_object_mut() {
                object.insert("avatar".to_string(), Value::String(avatar));
            }
        }
        apply_import_timestamps(&mut record, &data);
        let character = state.storage.create("characters", record)?;
        let character_id = created_record_id(&character, "character")?;
        let sprites_imported = restore_sprites(state, &character_id, data.get("sprites"))?;
        let gallery_imported =
            restore_character_gallery(state, &character_id, data.get("gallery"))?;
        let name = character_data
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("Imported Character")
            .to_string();
        return Ok(json!({
            "success": true,
            "type": "marinara_character",
            "id": character_id,
            "characterId": character_id,
            "name": name,
            "character": character,
            "spritesImported": sprites_imported,
            "galleryImported": gallery_imported
        }));
    }

    let looks_like_storage_record = data.get("data").is_some()
        || data.get("format").is_some()
        || data.get("avatarPath").is_some();
    if !looks_like_storage_record {
        return import_st_character_payload(state, data, None, &Value::Null, None);
    }

    let mut source = data.clone();
    remove_fields(&mut source, &["id", "sprites", "gallery", "metadata"]);
    if let Some(object) = source.as_object_mut() {
        if let Some(Value::String(raw)) = object.get("data") {
            let parsed = serde_json::from_str::<Value>(raw)
                .ok()
                .filter(Value::is_object)
                .unwrap_or_else(|| json!({}));
            object.insert("data".to_string(), parsed);
        }
    }
    let mut record_value = with_entity_defaults("characters", source)?;
    if let Some(avatar) = data.get("avatar").and_then(Value::as_str) {
        if let Some(record) = record_value.as_object_mut() {
            record.insert("avatarPath".to_string(), Value::String(avatar.to_string()));
            record.insert("avatar".to_string(), Value::String(avatar.to_string()));
        }
    }
    apply_import_timestamps(&mut record_value, &data);
    let record = state.storage.create("characters", record_value)?;
    let character_id = created_record_id(&record, "character")?;
    let sprites_imported = restore_sprites(state, &character_id, data.get("sprites"))?;
    let gallery_imported = restore_character_gallery(state, &character_id, data.get("gallery"))?;
    let name = data_string_name(&record)
        .or_else(|| {
            record
                .get("name")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| "Imported Character".to_string());
    Ok(json!({
        "success": true,
        "type": "marinara_character",
        "id": record.get("id").cloned().unwrap_or(Value::Null),
        "characterId": record.get("id").cloned().unwrap_or(Value::Null),
        "name": name,
        "character": record,
        "spritesImported": sprites_imported,
        "galleryImported": gallery_imported
    }))
}

fn import_marinara_persona(state: &AppState, data: Value) -> AppResult<Value> {
    let mut source = data.clone();
    remove_fields(&mut source, &["id", "metadata", "avatar", "sprites"]);
    let mut record_value = with_entity_defaults("personas", source)?;
    if let Some(avatar) = data.get("avatar").and_then(Value::as_str) {
        if let Some(record) = record_value.as_object_mut() {
            record.insert("avatarPath".to_string(), Value::String(avatar.to_string()));
            record.insert("avatar".to_string(), Value::String(avatar.to_string()));
        }
    }
    apply_import_timestamps(&mut record_value, &data);
    let record = state.storage.create("personas", record_value)?;
    let persona_id = created_record_id(&record, "persona")?;
    let sprites_imported = restore_sprites(state, &persona_id, data.get("sprites"))?;
    Ok(json!({
        "success": true,
        "type": "marinara_persona",
        "id": record.get("id").cloned().unwrap_or(Value::Null),
        "name": record.get("name").cloned().unwrap_or(Value::Null),
        "spritesImported": sprites_imported
    }))
}

fn import_marinara_lorebook(
    state: &AppState,
    envelope: &Map<String, Value>,
    data: Value,
) -> AppResult<Value> {
    let mut lorebook_data = data
        .get("lorebook")
        .cloned()
        .unwrap_or_else(|| data.clone());
    inherit_wrapper_timestamps(&mut lorebook_data, &data);
    remove_fields(&mut lorebook_data, &["id", "entries", "folders"]);
    // Pre-refactor stored `tags`/`characterIds`/`personaIds` as TEXT columns
    // (JSON-stringified arrays). Refactor expects real arrays — without this
    // normalize step the lorebook editor crashes on `formTags.map is not a function`.
    normalize_legacy_text_array_fields(&mut lorebook_data, &["tags", "characterIds", "personaIds"]);
    // Pre-refactor also stored bool columns as TEXT (`"false"` / `"true"`).
    // Refactor reads these directly, so `lorebook.isGlobal === "false"` is
    // truthy and the editor shows every scoped lorebook as global.
    normalize_legacy_text_bool_fields(
        &mut lorebook_data,
        &[
            "isGlobal",
            "enabled",
            "recursiveScanning",
            "excludeFromVectorization",
        ],
    );
    let mut lorebook = with_entity_defaults("lorebooks", lorebook_data.clone())?;
    if let Some(image) = data
        .get("avatar")
        .or_else(|| data.get("image"))
        .and_then(Value::as_str)
    {
        if let Some(record) = lorebook.as_object_mut() {
            record.insert("imagePath".to_string(), Value::String(image.to_string()));
        }
    }
    apply_import_timestamps(&mut lorebook, &lorebook_data);
    let record = state.storage.create("lorebooks", lorebook)?;
    let lorebook_id = created_record_id(&record, "lorebook")?;
    let folder_id_map = import_parented_records(
        state,
        array_from_envelope(&data, envelope, "folders"),
        "lorebook-folders",
        "lorebookId",
        &lorebook_id,
        "parentFolderId",
        "lorebook folder",
    )?;

    let mut exported_entries = array_from_envelope(&data, envelope, "entries");
    if exported_entries.is_empty() {
        exported_entries = lorebook_entries(&data);
    }
    for (index, entry) in exported_entries.iter().enumerate() {
        let mut normalized = normalize_imported_lorebook_entry(&lorebook_id, entry, index);
        if let Some(old_folder_id) = entry.get("folderId").and_then(Value::as_str) {
            if let Some(object) = normalized.as_object_mut() {
                object.insert(
                    "folderId".to_string(),
                    folder_id_map
                        .get(old_folder_id)
                        .map(|id| Value::String(id.clone()))
                        .unwrap_or(Value::Null),
                );
            }
        }
        state.storage.create("lorebook-entries", normalized)?;
    }

    Ok(json!({
        "success": true,
        "type": "marinara_lorebook",
        "id": lorebook_id,
        "lorebookId": lorebook_id,
        "name": record.get("name").cloned().unwrap_or(Value::Null),
        "entriesImported": exported_entries.len(),
        "foldersImported": folder_id_map.len(),
        "lorebook": record
    }))
}

fn import_marinara_preset(
    state: &AppState,
    envelope: &Map<String, Value>,
    data: Value,
) -> AppResult<Value> {
    let mut preset_data = data.get("preset").cloned().unwrap_or_else(|| data.clone());
    inherit_wrapper_timestamps(&mut preset_data, &data);
    remove_fields(
        &mut preset_data,
        &["id", "sections", "groups", "choiceBlocks", "variables"],
    );
    let mut record_value = with_entity_defaults("prompts", preset_data.clone())?;
    apply_import_timestamps(&mut record_value, &preset_data);
    let record = state.storage.create("prompts", record_value)?;
    let preset_id = created_record_id(&record, "preset")?;
    let group_id_map = import_parented_records(
        state,
        array_from_envelope(&data, envelope, "groups"),
        "prompt-groups",
        "presetId",
        &preset_id,
        "parentGroupId",
        "prompt group",
    )?;

    let mut sections_imported = 0usize;
    for section in array_from_envelope(&data, envelope, "sections") {
        let mut section_record = ensure_object(section)?;
        section_record.remove("id");
        section_record.remove("presetId");
        section_record.insert("presetId".to_string(), Value::String(preset_id.clone()));
        if section_record.contains_key("groupId") {
            let group_id = section_record
                .get("groupId")
                .and_then(Value::as_str)
                .and_then(|old_group_id| group_id_map.get(old_group_id))
                .map(|id| Value::String(id.clone()))
                .unwrap_or(Value::Null);
            section_record.insert("groupId".to_string(), group_id);
        }
        state
            .storage
            .create("prompt-sections", Value::Object(section_record))?;
        sections_imported += 1;
    }

    let mut variables_imported = 0usize;
    let mut variables = array_from_envelope(&data, envelope, "choiceBlocks");
    if variables.is_empty() {
        variables = array_from_envelope(&data, envelope, "variables");
    }
    for variable in variables {
        let mut variable_record = ensure_object(variable)?;
        variable_record.remove("id");
        variable_record.remove("presetId");
        variable_record.insert("presetId".to_string(), Value::String(preset_id.clone()));
        state
            .storage
            .create("prompt-variables", Value::Object(variable_record))?;
        variables_imported += 1;
    }

    Ok(json!({
        "success": true,
        "type": "marinara_preset",
        "id": preset_id,
        "name": record.get("name").cloned().unwrap_or(Value::Null),
        "preset": record,
        "groupsImported": group_id_map.len(),
        "sectionsImported": sections_imported,
        "variablesImported": variables_imported
    }))
}

pub(super) fn import_marinara_envelope(state: &AppState, envelope: Value) -> AppResult<Value> {
    let object = envelope
        .as_object()
        .ok_or_else(|| AppError::invalid_input("Invalid Marinara import envelope"))?;
    if object.get("version").and_then(Value::as_i64) != Some(1) {
        return Err(AppError::invalid_input(
            "Unsupported Marinara import version",
        ));
    }
    let import_type = object.get("type").and_then(Value::as_str).unwrap_or("");
    let mut data = object.get("data").cloned().unwrap_or(Value::Null);
    hydrate_metadata_timestamps(&mut data);
    if let Some((created_at, updated_at)) = timestamp_overrides_from_value(
        object
            .get("timestampOverrides")
            .or_else(|| object.get("__timestampOverrides")),
    ) {
        if let Some(data_object) = data.as_object_mut() {
            let metadata = data_object
                .entry("metadata".to_string())
                .or_insert_with(|| json!({}));
            if let Some(metadata_object) = metadata.as_object_mut() {
                metadata_object.insert(
                    "timestamps".to_string(),
                    json!({ "createdAt": created_at, "updatedAt": updated_at }),
                );
            }
        }
    }
    match import_type {
        "marinara_character" => import_marinara_character(state, data),
        "marinara_persona" => import_marinara_persona(state, data),
        "marinara_lorebook" => import_marinara_lorebook(state, object, data),
        "marinara_preset" => import_marinara_preset(state, object, data),
        "marinara_profile" => Err(AppError::invalid_input(PROFILE_IMPORT_GUIDANCE)),
        _ => Err(AppError::invalid_input(format!(
            "Unknown Marinara import type: {import_type}"
        ))),
    }
}

#[cfg(test)]
#[path = "marinara_tests.rs"]
mod tests;
