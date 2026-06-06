use super::*;

#[path = "marinara_assets.rs"]
mod marinara_assets;
#[path = "marinara_chat_bulk.rs"]
mod marinara_chat_bulk;
#[path = "marinara_helpers.rs"]
mod marinara_helpers;
#[path = "marinara_rollback.rs"]
mod marinara_rollback;

use marinara_assets::*;
use marinara_chat_bulk::*;
use marinara_helpers::*;
use marinara_rollback::*;

const PROFILE_IMPORT_GUIDANCE: &str =
    "Full profile exports must be imported with Import Profile in Settings -> Import. Use Import Profile (JSON/ZIP) instead.";

pub(super) fn import_marinara_file(state: &AppState, body: Value) -> AppResult<Value> {
    let uploaded = decode_uploaded_file_value(
        body.get("file")
            .ok_or_else(|| AppError::invalid_input("file is required"))?,
    )?;
    if let Ok(text) = std::str::from_utf8(&uploaded.bytes) {
        if let Ok(payload) = parse_json_text(text) {
            if payload.get("format").and_then(Value::as_str) == Some("marinara-chat-bulk") {
                return import_marinara_chat_bulk(state, payload);
            }
        }
    }
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
    let data_bytes = read_zip_entry_with_limit(&uploaded.bytes, &data_entry, MAX_DATA_JSON_BYTES)?
        .ok_or_else(|| AppError::invalid_input(".marinara file is missing data.json"))?;
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
        let avatar = read_zip_entry_with_limit(&uploaded.bytes, &avatar_name, MAX_AVATAR_BYTES)?
            .ok_or_else(|| AppError::invalid_input("Could not read .marinara avatar"))?;
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

fn native_character_avatar_payload(data: &Value) -> Value {
    let mut payload = data.clone();
    let Some(avatar) = data_image_string(data.get("avatar")) else {
        return payload;
    };
    if let Some(object) = payload.as_object_mut() {
        object.insert("_avatarDataUrl".to_string(), Value::String(avatar));
    }
    payload
}

fn created_record_id(record: &Value, label: &str) -> AppResult<String> {
    record
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AppError::new("storage_error", format!("Created {label} is missing an id")))
}

fn apply_imported_character_avatar_metadata(
    record: &mut Value,
    avatar: ImportedAvatarReference,
) -> String {
    let absolute_path = avatar.absolute_path.clone();
    let object = record
        .as_object_mut()
        .expect("native character import record should be an object");
    object.insert("avatarPath".to_string(), Value::String(avatar.asset_url));
    object.insert(
        "avatarFilePath".to_string(),
        Value::String(absolute_path.clone()),
    );
    object.insert("avatarFilename".to_string(), Value::String(avatar.filename));
    absolute_path
}

fn apply_imported_avatar_metadata(record: &mut Value, avatar: ImportedAvatarReference) -> String {
    let absolute_path = avatar.absolute_path.clone();
    let object = record
        .as_object_mut()
        .expect("import record should be an object");
    object.insert(
        "avatar".to_string(),
        Value::String(avatar.asset_url.clone()),
    );
    object.insert("avatarPath".to_string(), Value::String(avatar.asset_url));
    object.insert(
        "avatarFilePath".to_string(),
        Value::String(absolute_path.clone()),
    );
    object.insert("avatarFilename".to_string(), Value::String(avatar.filename));
    absolute_path
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
            "avatarPath": null,
            "format": data.get("spec").and_then(Value::as_str).unwrap_or("chara_card_v2"),
        });
        let avatar_payload = native_character_avatar_payload(&data);
        let avatar_absolute_path = imported_avatar_reference(state, &avatar_payload, None, None)?
            .map(|avatar| apply_imported_character_avatar_metadata(&mut record, avatar));
        apply_import_timestamps(&mut record, &data);
        let name = character_data
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("Imported Character")
            .to_string();
        let mut created_character_id = None;
        let result = (|| -> AppResult<Value> {
            let character = state.storage.create("characters", record)?;
            let character_id = created_record_id(&character, "character")?;
            created_character_id = Some(character_id.clone());
            let sprites_imported = restore_sprites(state, &character_id, data.get("sprites"))?;
            let gallery_imported =
                restore_character_gallery(state, &character_id, data.get("gallery"))?;
            flush_import_writes(state)?;
            Ok(json!({
                "success": true,
                "type": "marinara_character",
                "id": character_id,
                "characterId": character_id,
                "name": name,
                "character": character,
                "spritesImported": sprites_imported,
                "galleryImported": gallery_imported
            }))
        })();
        return result.map_err(|error| {
            let mut rollback_errors = Vec::new();
            if let Some(character_id) = created_character_id.as_deref() {
                rollback_records_by_field_collect(
                    state,
                    "character-gallery",
                    "characterId",
                    character_id,
                    &mut rollback_errors,
                );
                rollback_managed_child_dir(state, "sprites", character_id, &mut rollback_errors);
                rollback_created_records_collect(
                    state,
                    "characters",
                    &[character_id.to_string()],
                    &mut rollback_errors,
                );
            }
            if let Some(path) = avatar_absolute_path.as_deref() {
                rollback_managed_file_path(state, "avatars/characters", path, &mut rollback_errors);
            }
            append_marinara_rollback_errors(error, "character import", rollback_errors)
        });
    }

    let looks_like_storage_record = data.get("data").is_some()
        || data.get("format").is_some()
        || data.get("avatarPath").is_some();
    if !looks_like_storage_record {
        return import_st_character_payload(state, data, None, &Value::Null, None);
    }

    let mut source = data.clone();
    remove_fields(
        &mut source,
        &["id", "sprites", "gallery", "metadata", "avatar"],
    );
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
    let avatar_payload = native_character_avatar_payload(&data);
    let avatar_absolute_path = imported_avatar_reference(state, &avatar_payload, None, None)?
        .map(|avatar| apply_imported_character_avatar_metadata(&mut record_value, avatar));
    if avatar_absolute_path.is_none() {
        if let Some(avatar) = data.get("avatar").and_then(Value::as_str) {
            if let Some(record) = record_value.as_object_mut() {
                record.insert("avatarPath".to_string(), Value::String(avatar.to_string()));
                record.insert("avatar".to_string(), Value::String(avatar.to_string()));
            }
        }
    }
    apply_import_timestamps(&mut record_value, &data);
    let mut created_character_id = None;
    let result = (|| -> AppResult<Value> {
        let record = state.storage.create("characters", record_value)?;
        let character_id = created_record_id(&record, "character")?;
        created_character_id = Some(character_id.clone());
        let sprites_imported = restore_sprites(state, &character_id, data.get("sprites"))?;
        let gallery_imported =
            restore_character_gallery(state, &character_id, data.get("gallery"))?;
        let name = data_string_name(&record)
            .or_else(|| {
                record
                    .get("name")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned)
            })
            .unwrap_or_else(|| "Imported Character".to_string());
        flush_import_writes(state)?;
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
    })();
    result.map_err(|error| {
        let mut rollback_errors = Vec::new();
        if let Some(character_id) = created_character_id.as_deref() {
            rollback_records_by_field_collect(
                state,
                "character-gallery",
                "characterId",
                character_id,
                &mut rollback_errors,
            );
            rollback_managed_child_dir(state, "sprites", character_id, &mut rollback_errors);
            rollback_created_records_collect(
                state,
                "characters",
                &[character_id.to_string()],
                &mut rollback_errors,
            );
        }
        if let Some(path) = avatar_absolute_path.as_deref() {
            rollback_managed_file_path(state, "avatars/characters", path, &mut rollback_errors);
        }
        append_marinara_rollback_errors(error, "character import", rollback_errors)
    })
}

fn import_marinara_persona(state: &AppState, data: Value) -> AppResult<Value> {
    let mut source = data.clone();
    remove_fields(&mut source, &["id", "metadata", "avatar", "sprites"]);
    let mut record_value = with_entity_defaults("personas", source)?;
    let avatar_absolute_path = data_image_string(data.get("avatar"))
        .map(|avatar| {
            let mut payload = data.clone();
            if let Some(object) = payload.as_object_mut() {
                object.insert("_avatarDataUrl".to_string(), Value::String(avatar));
            }
            imported_avatar_reference_in_folder(state, &payload, None, None, "avatars/personas")
        })
        .transpose()?
        .flatten()
        .map(|avatar| apply_imported_avatar_metadata(&mut record_value, avatar));
    if avatar_absolute_path.is_none() {
        if let Some(avatar) = data.get("avatar").and_then(Value::as_str) {
            if let Some(record) = record_value.as_object_mut() {
                record.insert("avatarPath".to_string(), Value::String(avatar.to_string()));
                record.insert("avatar".to_string(), Value::String(avatar.to_string()));
            }
        }
    }
    apply_import_timestamps(&mut record_value, &data);
    let mut created_persona_id = None;
    let result = (|| -> AppResult<Value> {
        let record = state.storage.create("personas", record_value)?;
        let persona_id = created_record_id(&record, "persona")?;
        created_persona_id = Some(persona_id.clone());
        let sprites_imported = restore_persona_sprites(state, &persona_id, data.get("sprites"))?;
        flush_import_writes(state)?;
        Ok(json!({
            "success": true,
            "type": "marinara_persona",
            "id": record.get("id").cloned().unwrap_or(Value::Null),
            "name": record.get("name").cloned().unwrap_or(Value::Null),
            "persona": record,
            "spritesImported": sprites_imported
        }))
    })();
    result.map_err(|error| {
        let mut rollback_errors = Vec::new();
        if let Some(persona_id) = created_persona_id.as_deref() {
            rollback_managed_child_dir(state, "sprites/personas", persona_id, &mut rollback_errors);
            rollback_created_records_collect(
                state,
                "personas",
                &[persona_id.to_string()],
                &mut rollback_errors,
            );
        }
        if let Some(path) = avatar_absolute_path.as_deref() {
            rollback_managed_file_path(state, "avatars/personas", path, &mut rollback_errors);
        }
        append_marinara_rollback_errors(error, "persona import", rollback_errors)
    })
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
    // Pre-refactor stored `tags`/`characterIds`/`personaIds` as JSON-stringified TEXT columns.
    // Refactor expects real arrays; otherwise the lorebook editor crashes on `formTags.map is not a function`.
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
    let mut created_lorebook_id = None;
    let mut created_folder_ids = Vec::new();
    let mut created_entry_ids = Vec::new();
    let result = (|| -> AppResult<Value> {
        let record = state.storage.create("lorebooks", lorebook)?;
        let lorebook_id = created_record_id(&record, "lorebook")?;
        created_lorebook_id = Some(lorebook_id.clone());
        let (folder_id_map, folder_order) = import_parented_records(
            state,
            array_from_envelope(&data, envelope, "folders"),
            "lorebook-folders",
            "lorebookId",
            &lorebook_id,
            "parentFolderId",
            "lorebook folder",
        )?;
        created_folder_ids.extend(folder_order);

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
            let entry_record = state.storage.create("lorebook-entries", normalized)?;
            created_entry_ids.push(created_record_id(&entry_record, "lorebook entry")?);
        }

        flush_import_writes(state)?;
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
    })();

    result.map_err(|error| {
        let mut rollback_errors = Vec::new();
        rollback_created_records_collect(
            state,
            "lorebook-entries",
            &created_entry_ids,
            &mut rollback_errors,
        );
        rollback_created_records_collect(
            state,
            "lorebook-folders",
            &created_folder_ids,
            &mut rollback_errors,
        );
        if let Some(lorebook_id) = created_lorebook_id.as_deref() {
            rollback_created_records_collect(
                state,
                "lorebooks",
                &[lorebook_id.to_string()],
                &mut rollback_errors,
            );
        }
        append_marinara_rollback_errors(error, "lorebook import", rollback_errors)
    })
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
    let mut created_preset_id = None;
    let mut created_group_ids = Vec::new();
    let mut created_section_ids = Vec::new();
    let mut created_variable_ids = Vec::new();
    let result = (|| -> AppResult<Value> {
        let record = state.storage.create("prompts", record_value)?;
        let preset_id = created_record_id(&record, "preset")?;
        created_preset_id = Some(preset_id.clone());
        let (group_id_map, group_order) = import_parented_records(
            state,
            array_from_envelope(&data, envelope, "groups"),
            "prompt-groups",
            "presetId",
            &preset_id,
            "parentGroupId",
            "prompt group",
        )?;
        created_group_ids.extend(group_order.iter().cloned());

        let mut sections_imported = 0usize;
        let mut section_id_map = HashMap::new();
        let mut section_order = Vec::new();
        for section in array_from_envelope(&data, envelope, "sections") {
            let old_section_id = section
                .get("id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
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
            let section = state
                .storage
                .create("prompt-sections", Value::Object(section_record))?;
            let section_id = created_record_id(&section, "prompt section")?;
            created_section_ids.push(section_id.clone());
            section_order.push(section_id.clone());
            if let Some(old_section_id) = old_section_id {
                section_id_map.insert(old_section_id, section_id);
            }
            sections_imported += 1;
        }

        let mut variables_imported = 0usize;
        let mut variable_id_map = HashMap::new();
        let mut variable_order = Vec::new();
        let mut variables = array_from_envelope(&data, envelope, "choiceBlocks");
        if variables.is_empty() {
            variables = array_from_envelope(&data, envelope, "variables");
        }
        for variable in variables {
            let old_variable_id = variable
                .get("id")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            let mut variable_record = ensure_object(variable)?;
            variable_record.remove("id");
            variable_record.remove("presetId");
            variable_record.insert("presetId".to_string(), Value::String(preset_id.clone()));
            let variable = state
                .storage
                .create("prompt-variables", Value::Object(variable_record))?;
            let variable_id = created_record_id(&variable, "prompt variable")?;
            created_variable_ids.push(variable_id.clone());
            variable_order.push(variable_id.clone());
            if let Some(old_variable_id) = old_variable_id {
                variable_id_map.insert(old_variable_id, variable_id);
            }
            variables_imported += 1;
        }

        let record = state.storage.patch(
            "prompts",
            &preset_id,
            json!({
                "groupOrder": remap_imported_child_order(preset_data.get("groupOrder"), &group_id_map, &group_order),
                "sectionOrder": remap_imported_child_order(preset_data.get("sectionOrder"), &section_id_map, &section_order),
                "variableOrder": remap_imported_child_order(preset_data.get("variableOrder"), &variable_id_map, &variable_order)
            }),
        )?;

        flush_import_writes(state)?;
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
    })();

    result.map_err(|error| {
        let mut rollback_errors = Vec::new();
        rollback_created_records_collect(
            state,
            "prompt-variables",
            &created_variable_ids,
            &mut rollback_errors,
        );
        rollback_created_records_collect(
            state,
            "prompt-sections",
            &created_section_ids,
            &mut rollback_errors,
        );
        rollback_created_records_collect(
            state,
            "prompt-groups",
            &created_group_ids,
            &mut rollback_errors,
        );
        if let Some(preset_id) = created_preset_id.as_deref() {
            rollback_created_records_collect(
                state,
                "prompts",
                &[preset_id.to_string()],
                &mut rollback_errors,
            );
        }
        append_marinara_rollback_errors(error, "preset import", rollback_errors)
    })
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
