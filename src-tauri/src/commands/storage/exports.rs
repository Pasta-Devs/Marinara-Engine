use super::imports::{lorebook_entries, normalize_lorebook_entry};
use super::shared::*;
use super::*;
use serde_json::Map;
use std::io::{Cursor, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;

#[derive(Clone, Copy)]
enum SpriteExportOwnerKind {
    Character,
    Persona,
}

pub(crate) fn export_record(
    state: &AppState,
    kind: &str,
    collection: &str,
    id: &str,
    format: Option<&str>,
) -> AppResult<Value> {
    let mut record = get_required(state, collection, id)?;
    if collection == "messages" {
        message_swipes::materialize_message(state, &mut record, true)?;
    }
    if format == Some("compatible") {
        return compatible_record(collection, &record);
    }
    native_record_export(state, kind, collection, &record)
}

pub(crate) fn export_records(
    state: &AppState,
    kind: &str,
    collection: &str,
    body: Value,
) -> AppResult<Value> {
    let ids = string_array_from_value(body.get("ids"));
    let format = body.get("format").and_then(Value::as_str);
    if matches!(collection, "characters" | "personas" | "prompts") {
        return export_named_records(state, kind, collection, ids, format);
    }

    let mut items = Vec::new();
    for id in ids {
        if let Some(mut record) = state.storage.get(collection, &id)? {
            if collection == "messages" {
                message_swipes::materialize_message(state, &mut record, true)?;
            }
            items.push(if format == Some("compatible") {
                compatible_record(collection, &record)?
            } else {
                record
            });
        }
    }
    let mut zip = ExportZip::new();
    zip.add_json(
        "manifest.json",
        &json!({
            "type": kind,
            "version": 1,
            "exportedAt": now_iso(),
            "collection": collection,
            "count": items.len()
        }),
    )?;
    for item in &items {
        let id = item.get("id").and_then(Value::as_str).unwrap_or("record");
        let name = item_export_name(collection, item).unwrap_or_else(|| id.to_string());
        zip.add_json(
            &format!(
                "{}/{}-{}.json",
                collection,
                safe_export_name(&name, "record"),
                safe_export_name(id, "id")
            ),
            item,
        )?;
    }
    Ok(binary_download(
        zip.finish()?,
        "application/zip",
        &format!("{kind}.zip"),
    ))
}

pub(crate) fn export_character_png(state: &AppState, id: &str) -> AppResult<Value> {
    let character = get_required(state, "characters", id)?;
    let card = compatible_character_export(&character);
    let name = card
        .get("data")
        .and_then(|data| data.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("character");
    let avatar_png =
        avatar_data_url(state, &character).and_then(|value| png_data_url_bytes(&value));
    Ok(binary_download(
        character_card_png(&card, avatar_png.as_deref())?,
        "image/png",
        &format!("{}.png", safe_export_name(name, "character")),
    ))
}

pub(crate) fn import_character_embedded_lorebook(
    state: &AppState,
    character_id: &str,
) -> AppResult<Value> {
    let character = get_required(state, "characters", character_id)?;
    let data = character_data_value(&character);
    let book = data
        .get("character_book")
        .or_else(|| {
            data.get("data")
                .and_then(|inner| inner.get("character_book"))
        })
        .cloned()
        .unwrap_or(Value::Null);
    let entries = lorebook_entries(&book);
    if entries.is_empty() {
        return Err(AppError::invalid_input(
            "Character does not contain an embedded lorebook",
        ));
    }
    let name = character
        .get("name")
        .and_then(Value::as_str)
        .or_else(|| data.get("name").and_then(Value::as_str))
        .unwrap_or("Character");
    let existing_lorebook_id = linked_embedded_lorebook_id(state, character_id, &data)?;
    let (lorebook, reimported) = if let Some(lorebook_id) = existing_lorebook_id {
        let patched = state.storage.patch(
            "lorebooks",
            &lorebook_id,
            json!({
                "name": format!("{name} Lorebook"),
                "description": "Imported from embedded character book",
                "category": "character",
                "characterId": character_id,
                "sourceCharacterId": character_id
            }),
        )?;
        remove_lorebook_child_rows(state, &lorebook_id)?;
        remove_duplicate_embedded_lorebooks(state, character_id, &lorebook_id)?;
        (patched, true)
    } else {
        let created = state.storage.create(
            "lorebooks",
            with_entity_defaults(
                "lorebooks",
                json!({
                    "name": format!("{name} Lorebook"),
                    "description": "Imported from embedded character book",
                    "category": "character",
                    "characterId": character_id,
                    "sourceCharacterId": character_id
                }),
            )?,
        )?;
        (created, false)
    };
    let lorebook_id = lorebook
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("storage_error", "Created lorebook is missing an id"))?
        .to_string();
    let mut imported = 0;
    for (index, entry) in entries.into_iter().enumerate() {
        let normalized = normalize_lorebook_entry(&lorebook_id, &entry, index);
        state.storage.create("lorebook-entries", normalized)?;
        imported += 1;
    }
    patch_character_embedded_lorebook_pointer(state, character_id, &lorebook_id, imported)?;
    Ok(json!({
        "success": true,
        "lorebookId": lorebook_id,
        "entriesImported": imported,
        "reimported": reimported
    }))
}

pub(crate) fn export_prompt(state: &AppState, preset_id: &str) -> AppResult<Value> {
    let preset = get_required(state, "prompts", preset_id)?;
    preset_export_envelope(state, &preset)
}

pub(crate) fn export_lorebook(
    state: &AppState,
    lorebook_id: &str,
    format: Option<&str>,
) -> AppResult<Value> {
    let lorebook = get_required(state, "lorebooks", lorebook_id)?;
    let entries = list_collection(state, "lorebook-entries", Some(("lorebookId", lorebook_id)))?;
    if format == Some("compatible") {
        return Ok(compatible_lorebook_export(&lorebook, &entries));
    }
    Ok(json!({
        "type": "marinara_lorebook",
        "version": 1,
        "exportedAt": now_iso(),
        "data": {
            "lorebook": lorebook,
            "entries": entries,
            "folders": list_collection(state, "lorebook-folders", Some(("lorebookId", lorebook_id)))?
        }
    }))
}

pub(crate) fn export_lorebooks(state: &AppState, body: Value) -> AppResult<Value> {
    let ids = string_array_from_value(body.get("ids"));
    let format = body.get("format").and_then(Value::as_str);
    let mut zip = ExportZip::new();
    let mut exported_count = 0usize;
    for id in ids {
        let Some(lorebook) = state.storage.get("lorebooks", &id)? else {
            continue;
        };
        let item = export_lorebook(state, &id, format)?;
        let name = lorebook
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("lorebook");
        let fallback = format!("lorebook-{}", exported_count + 1);
        zip.add_json(
            &format!(
                "{}.{}",
                safe_export_name(name, &fallback),
                if format == Some("compatible") {
                    "json"
                } else {
                    "marinara.json"
                }
            ),
            &item,
        )?;
        exported_count += 1;
    }
    Ok(binary_download(
        zip.finish()?,
        "application/zip",
        if format == Some("compatible") {
            "compatible-lorebooks.zip"
        } else {
            "marinara-lorebooks.zip"
        },
    ))
}

pub(crate) fn export_compatible_profile(state: &AppState) -> AppResult<Value> {
    Ok(binary_download(
        export_compatible_profile_bytes(state)?,
        "application/zip",
        "marinara-compatible-export.zip",
    ))
}

pub(crate) fn export_compatible_profile_bytes(state: &AppState) -> AppResult<Vec<u8>> {
    let mut zip = ExportZip::new();
    let characters = state.storage.list("characters")?;
    let personas = state.storage.list("personas")?;
    let lorebooks = state.storage.list("lorebooks")?;

    for (index, character) in characters.iter().enumerate() {
        let fallback = format!("character-{}", index + 1);
        let name = item_export_name("characters", character).unwrap_or_else(|| fallback.clone());
        zip.add_json(
            &format!("characters/{}.json", safe_export_name(&name, &fallback)),
            &compatible_character_export(character),
        )?;
    }

    for (index, persona) in personas.iter().enumerate() {
        let fallback = format!("persona-{}", index + 1);
        let name = item_export_name("personas", persona).unwrap_or_else(|| fallback.clone());
        zip.add_json(
            &format!("personas/{}.json", safe_export_name(&name, &fallback)),
            &compatible_persona_export(persona),
        )?;
    }

    for (index, lorebook) in lorebooks.iter().enumerate() {
        let id = record_id(lorebook, "lorebook")?;
        let entries = list_collection(state, "lorebook-entries", Some(("lorebookId", id)))?;
        let fallback = format!("lorebook-{}", index + 1);
        let name = item_export_name("lorebooks", lorebook).unwrap_or_else(|| fallback.clone());
        zip.add_json(
            &format!("lorebooks/{}.json", safe_export_name(&name, &fallback)),
            &compatible_lorebook_export(lorebook, &entries),
        )?;
    }

    zip.finish()
}

fn native_record_export(
    state: &AppState,
    kind: &str,
    collection: &str,
    record: &Value,
) -> AppResult<Value> {
    match collection {
        "characters" => character_export_envelope(state, record),
        "personas" => persona_export_envelope(state, record),
        "prompts" => preset_export_envelope(state, record),
        _ => Ok(json!({
            "type": kind,
            "version": 1,
            "exportedAt": now_iso(),
            "data": record
        })),
    }
}

fn export_named_records(
    state: &AppState,
    kind: &str,
    collection: &str,
    ids: Vec<String>,
    format: Option<&str>,
) -> AppResult<Value> {
    let compatible = format == Some("compatible") && collection != "prompts";
    let mut zip = ExportZip::new();
    let mut exported_count = 0usize;
    for id in ids {
        let Some(record) = state.storage.get(collection, &id)? else {
            continue;
        };
        let item = if compatible {
            compatible_record(collection, &record)?
        } else {
            native_record_export(state, kind, collection, &record)?
        };
        let fallback = format!(
            "{}-{}",
            singular_export_name(collection),
            exported_count + 1
        );
        let name = item_export_name(collection, &record).unwrap_or_else(|| fallback.clone());
        zip.add_json(
            &format!(
                "{}.{}",
                safe_export_name(&name, &fallback),
                if compatible { "json" } else { "marinara.json" }
            ),
            &item,
        )?;
        exported_count += 1;
    }
    Ok(binary_download(
        zip.finish()?,
        "application/zip",
        named_zip_filename(collection, compatible),
    ))
}

fn compatible_record(collection: &str, record: &Value) -> AppResult<Value> {
    Ok(match collection {
        "characters" => compatible_character_export(record),
        "personas" => compatible_persona_export(record),
        _ => record.clone(),
    })
}

fn character_export_envelope(state: &AppState, character: &Value) -> AppResult<Value> {
    let id = record_id(character, "character")?;
    let data = character_data_value(character);
    let mut exported = Map::new();
    exported.insert(
        "spec".to_string(),
        Value::String("chara_card_v2".to_string()),
    );
    exported.insert("spec_version".to_string(), Value::String("2.0".to_string()));
    exported.insert("data".to_string(), data);
    if let Some(avatar) = avatar_data_url(state, character) {
        exported.insert("avatar".to_string(), Value::String(avatar));
    }
    let sprites = sprites_for_owner(state, id, SpriteExportOwnerKind::Character)?;
    if !sprites.is_empty() {
        exported.insert("sprites".to_string(), Value::Array(sprites));
    }
    let gallery = gallery_for_character(state, id)?;
    if !gallery.is_empty() {
        exported.insert("gallery".to_string(), Value::Array(gallery));
    }
    exported.insert(
        "metadata".to_string(),
        json!({
            "createdAt": character.get("createdAt").cloned().unwrap_or(Value::Null),
            "updatedAt": character.get("updatedAt").cloned().unwrap_or(Value::Null),
            "comment": character.get("comment").cloned().unwrap_or_else(|| json!(""))
        }),
    );
    Ok(json!({
        "type": "marinara_character",
        "version": 1,
        "exportedAt": now_iso(),
        "data": Value::Object(exported)
    }))
}

fn compatible_character_export(character: &Value) -> Value {
    json!({
        "spec": "chara_card_v2",
        "spec_version": "2.0",
        "data": character_data_value(character)
    })
}

fn persona_export_envelope(state: &AppState, persona: &Value) -> AppResult<Value> {
    let id = record_id(persona, "persona").unwrap_or("");
    let mut data = persona_data_object(persona);
    if let Some(avatar) = avatar_data_url(state, persona) {
        data.insert("avatar".to_string(), Value::String(avatar));
    }
    if !id.is_empty() {
        let sprites = sprites_for_owner(state, id, SpriteExportOwnerKind::Persona)?;
        if !sprites.is_empty() {
            data.insert("sprites".to_string(), Value::Array(sprites));
        }
    }
    data.insert(
        "metadata".to_string(),
        json!({
            "createdAt": persona.get("createdAt").cloned().unwrap_or(Value::Null),
            "updatedAt": persona.get("updatedAt").cloned().unwrap_or(Value::Null)
        }),
    );
    Ok(json!({
        "type": "marinara_persona",
        "version": 1,
        "exportedAt": now_iso(),
        "data": Value::Object(data)
    }))
}

fn compatible_persona_export(persona: &Value) -> Value {
    let mut data = persona_data_object(persona);
    data.insert(
        "extensions".to_string(),
        json!({
            "marinara": {
                "exportedAt": now_iso(),
                "source": "Marinara Engine compatibility export"
            }
        }),
    );
    Value::Object(data)
}

fn persona_data_object(persona: &Value) -> Map<String, Value> {
    let mut data = persona.as_object().cloned().unwrap_or_default();
    for key in [
        "id",
        "createdAt",
        "updatedAt",
        "avatar",
        "avatarPath",
        "avatarFilePath",
        "avatarFilename",
        "avatarUpdatedAt",
        "isActive",
    ] {
        data.remove(key);
    }
    data
}

fn preset_export_envelope(state: &AppState, preset: &Value) -> AppResult<Value> {
    let preset_id = record_id(preset, "preset")?;
    Ok(json!({
        "type": "marinara_preset",
        "version": 1,
        "exportedAt": now_iso(),
        "data": {
            "preset": preset,
            "sections": list_collection(state, "prompt-sections", Some(("presetId", preset_id)))?,
            "groups": list_collection(state, "prompt-groups", Some(("presetId", preset_id)))?,
            "choiceBlocks": list_collection(state, "prompt-variables", Some(("presetId", preset_id)))?
        }
    }))
}

fn compatible_lorebook_export(lorebook: &Value, entries: &Value) -> Value {
    let mut exported_entries = Map::new();
    for (index, entry) in entries.as_array().into_iter().flatten().enumerate() {
        exported_entries.insert(
            index.to_string(),
            json!({
                "uid": index as i64,
                "key": string_array_for_export(entry.get("keys")),
                "keysecondary": string_array_for_export(entry.get("secondaryKeys")),
                "comment": entry.get("name").and_then(Value::as_str).unwrap_or(&format!("Entry {}", index + 1)),
                "content": entry.get("content").and_then(Value::as_str).unwrap_or(""),
                "disable": entry.get("enabled").and_then(Value::as_bool).map(|enabled| !enabled).unwrap_or(false),
                "constant": entry.get("constant").and_then(Value::as_bool).unwrap_or(false),
                "selective": entry.get("selective").and_then(Value::as_bool).unwrap_or(false),
                "selectiveLogic": st_selective_logic(entry.get("selectiveLogic")),
                "order": numeric_value(entry.get("order"), 100),
                "position": numeric_value(entry.get("position"), 0),
                "depth": numeric_value(entry.get("depth"), 4),
                "probability": entry.get("probability").cloned().unwrap_or(Value::Null),
                "scanDepth": entry.get("scanDepth").cloned().unwrap_or(Value::Null),
                "matchWholeWords": entry.get("matchWholeWords").and_then(Value::as_bool).unwrap_or(false),
                "caseSensitive": entry.get("caseSensitive").and_then(Value::as_bool).unwrap_or(false),
                "role": st_role(entry.get("role")),
                "group": entry.get("group").and_then(Value::as_str).unwrap_or(""),
                "groupWeight": entry.get("groupWeight").cloned().unwrap_or(Value::Null),
                "sticky": entry.get("sticky").cloned().unwrap_or(Value::Null),
                "cooldown": entry.get("cooldown").cloned().unwrap_or(Value::Null),
                "delay": entry.get("delay").cloned().unwrap_or(Value::Null)
            }),
        );
    }

    json!({
        "name": lorebook.get("name").and_then(Value::as_str).unwrap_or("Lorebook"),
        "extensions": {
            "marinara": {
                "exportedAt": now_iso(),
                "source": "Marinara Engine compatibility export"
            }
        },
        "entries": Value::Object(exported_entries)
    })
}

fn character_data_value(character: &Value) -> Value {
    character.get("data").cloned().unwrap_or_else(|| json!({}))
}

fn embedded_lorebook_pointer(data: &Value) -> Option<&str> {
    data.get("extensions")?
        .get("importMetadata")?
        .get("embeddedLorebook")?
        .get("lorebookId")?
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

fn lorebook_linked_to_character(lorebook: &Value, character_id: &str) -> bool {
    lorebook.get("characterId").and_then(Value::as_str) == Some(character_id)
        || lorebook.get("sourceCharacterId").and_then(Value::as_str) == Some(character_id)
}

fn linked_embedded_lorebook_id(
    state: &AppState,
    character_id: &str,
    data: &Value,
) -> AppResult<Option<String>> {
    if let Some(pointer_id) = embedded_lorebook_pointer(data) {
        if let Some(lorebook) = state.storage.get("lorebooks", pointer_id)? {
            if lorebook_linked_to_character(&lorebook, character_id) {
                return Ok(Some(pointer_id.to_string()));
            }
        }
    }

    let candidates = list_collection(
        state,
        "lorebooks",
        Some(("sourceCharacterId", character_id)),
    )?;
    let fallback = candidates
        .as_array()
        .into_iter()
        .flatten()
        .find(|lorebook| lorebook_linked_to_character(lorebook, character_id))
        .and_then(|lorebook| lorebook.get("id").and_then(Value::as_str))
        .map(str::to_string);
    Ok(fallback)
}

fn remove_lorebook_child_rows(state: &AppState, lorebook_id: &str) -> AppResult<()> {
    let mut filters = Map::new();
    filters.insert(
        "lorebookId".to_string(),
        Value::String(lorebook_id.to_string()),
    );
    state.storage.delete_where("lorebook-entries", &filters)?;
    state.storage.delete_where("lorebook-folders", &filters)?;
    Ok(())
}

fn is_embedded_lorebook_import_record(lorebook: &Value, character_id: &str) -> bool {
    lorebook_linked_to_character(lorebook, character_id)
        && lorebook.get("category").and_then(Value::as_str) == Some("character")
        && lorebook.get("description").and_then(Value::as_str)
            == Some("Imported from embedded character book")
}

fn remove_duplicate_embedded_lorebooks(
    state: &AppState,
    character_id: &str,
    keep_lorebook_id: &str,
) -> AppResult<()> {
    let candidates = list_collection(
        state,
        "lorebooks",
        Some(("sourceCharacterId", character_id)),
    )?;
    for lorebook in candidates.as_array().into_iter().flatten() {
        let Some(id) = lorebook.get("id").and_then(Value::as_str) else {
            continue;
        };
        if id == keep_lorebook_id || !is_embedded_lorebook_import_record(lorebook, character_id) {
            continue;
        }
        remove_lorebook_child_rows(state, id)?;
        state.storage.delete("lorebooks", id)?;
    }
    Ok(())
}

fn patch_character_embedded_lorebook_pointer(
    state: &AppState,
    character_id: &str,
    lorebook_id: &str,
    entries_imported: usize,
) -> AppResult<()> {
    let character = get_required(state, "characters", character_id)?;
    let mut data = character_data_value(&character);
    let data_object = data
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Character data is not an object"))?;
    let extensions = data_object
        .entry("extensions".to_string())
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Character extensions are not an object"))?;
    let import_metadata = extensions
        .entry("importMetadata".to_string())
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(|| AppError::invalid_input("Character import metadata is not an object"))?;
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

fn record_id<'a>(record: &'a Value, kind: &str) -> AppResult<&'a str> {
    record
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::new("storage_error", format!("{kind} record is missing an id")))
}

fn item_export_name(collection: &str, record: &Value) -> Option<String> {
    if collection == "characters" {
        return character_data_value(record)
            .get("name")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned);
    }
    record
        .get("name")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

fn singular_export_name(collection: &str) -> &'static str {
    match collection {
        "characters" => "character",
        "personas" => "persona",
        "prompts" => "preset",
        _ => "record",
    }
}

fn named_zip_filename(collection: &str, compatible: bool) -> &'static str {
    match (collection, compatible) {
        ("characters", true) => "compatible-characters.zip",
        ("characters", false) => "marinara-characters.zip",
        ("personas", true) => "compatible-personas.zip",
        ("personas", false) => "marinara-personas.zip",
        ("prompts", _) => "marinara-presets.zip",
        _ => "marinara-records.zip",
    }
}

fn avatar_data_url(state: &AppState, record: &Value) -> Option<String> {
    for key in ["avatar", "avatarPath"] {
        let Some(value) = record.get(key).and_then(Value::as_str) else {
            continue;
        };
        if value.starts_with("data:image/") {
            return Some(value.to_string());
        }
    }
    record
        .get("avatarFilePath")
        .and_then(Value::as_str)
        .and_then(|path| data_url_from_current_file(state, path))
}

fn data_url_from_current_file(state: &AppState, path: &str) -> Option<String> {
    let path = PathBuf::from(path);
    let canonical_data_dir = fs::canonicalize(&state.data_dir).ok()?;
    let canonical_path = fs::canonicalize(path).ok()?;
    if !canonical_path.starts_with(canonical_data_dir) {
        return None;
    }
    let bytes = fs::read(&canonical_path).ok()?;
    Some(format!(
        "data:{};base64,{}",
        image_mime_from_path(&canonical_path),
        general_purpose::STANDARD.encode(bytes)
    ))
}

fn sprites_for_owner(
    state: &AppState,
    id: &str,
    owner_kind: SpriteExportOwnerKind,
) -> AppResult<Vec<Value>> {
    if id.contains('/') || id.contains('\\') {
        return Ok(Vec::new());
    }
    let dirs = sprite_dirs_for_owner(state, id, owner_kind);
    let mut sprites = Vec::new();
    let mut seen_filenames = std::collections::HashSet::new();
    for dir in dirs {
        if !dir.is_dir() {
            continue;
        }
        for entry in fs::read_dir(&dir)? {
            let path = entry?.path();
            if !path.is_file() || !is_export_image_file(&path) {
                continue;
            }
            let Some(filename) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !seen_filenames.insert(filename.to_ascii_lowercase()) {
                continue;
            }
            let Some(data) = data_url_from_file(&path) else {
                continue;
            };
            sprites.push(json!({
                "filename": filename,
                "data": data
            }));
        }
    }
    sprites.sort_by(|a, b| {
        a.get("filename")
            .and_then(Value::as_str)
            .unwrap_or("")
            .cmp(b.get("filename").and_then(Value::as_str).unwrap_or(""))
    });
    Ok(sprites)
}

fn sprite_dirs_for_owner(
    state: &AppState,
    id: &str,
    owner_kind: SpriteExportOwnerKind,
) -> Vec<PathBuf> {
    match owner_kind {
        SpriteExportOwnerKind::Character => vec![state.data_dir.join("sprites").join(id)],
        SpriteExportOwnerKind::Persona => {
            let mut dirs = vec![state.data_dir.join("sprites").join("personas").join(id)];
            if id != "personas" {
                dirs.push(state.data_dir.join("sprites").join(id));
            }
            dirs
        }
    }
}

fn gallery_for_character(state: &AppState, character_id: &str) -> AppResult<Vec<Value>> {
    let records = list_collection(
        state,
        "character-gallery",
        Some(("characterId", character_id)),
    )?;
    let mut gallery = Vec::new();
    for record in records.as_array().into_iter().flatten() {
        let Some((data, image_path)) = gallery_record_data_url(state, record)? else {
            continue;
        };
        let filename = gallery_record_filename(record, image_path.as_deref());
        gallery.push(json!({
            "filename": filename,
            "data": data,
            "prompt": record.get("prompt").cloned().unwrap_or_else(|| json!("")),
            "provider": record.get("provider").cloned().unwrap_or_else(|| json!("")),
            "model": record.get("model").cloned().unwrap_or_else(|| json!("")),
            "width": record.get("width").cloned().unwrap_or(Value::Null),
            "height": record.get("height").cloned().unwrap_or(Value::Null)
        }));
    }
    Ok(gallery)
}

fn gallery_record_data_url(
    state: &AppState,
    record: &Value,
) -> AppResult<Option<(String, Option<PathBuf>)>> {
    if let Some(data) = record
        .get("url")
        .and_then(Value::as_str)
        .filter(|value| media_uploads::is_inline_image_data_url(value))
    {
        return Ok(Some((data.to_string(), None)));
    }
    let Some(path) =
        media_uploads::managed_record_file_path(state, "gallery", record, "filePath", "filename")?
    else {
        return Ok(None);
    };
    if !is_export_image_file(&path) {
        return Ok(None);
    }
    Ok(data_url_from_file(&path).map(|data| (data, Some(path))))
}

fn gallery_record_filename(record: &Value, image_path: Option<&Path>) -> String {
    record
        .get("filename")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            record
                .get("filePath")
                .and_then(Value::as_str)
                .and_then(|value| Path::new(value).file_name())
                .map(|value| value.to_string_lossy().to_string())
        })
        .or_else(|| {
            image_path
                .and_then(Path::file_name)
                .map(|value| value.to_string_lossy().to_string())
        })
        .unwrap_or_else(|| "image.png".to_string())
}

fn data_url_from_file(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    Some(format!(
        "data:{};base64,{}",
        image_mime_from_path(path),
        general_purpose::STANDARD.encode(bytes)
    ))
}

fn is_export_image_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("png" | "jpg" | "jpeg" | "webp" | "gif" | "avif" | "svg")
    )
}

fn image_mime_from_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        _ => "image/png",
    }
}

fn string_array_for_export(value: Option<&Value>) -> Vec<String> {
    match value {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(Value::as_str)
            .map(ToOwned::to_owned)
            .collect(),
        Some(Value::String(raw)) => {
            serde_json::from_str::<Vec<String>>(raw).unwrap_or_else(|_| vec![raw.to_string()])
        }
        _ => Vec::new(),
    }
}

fn numeric_value(value: Option<&Value>, fallback: i64) -> i64 {
    value
        .and_then(|value| {
            value
                .as_i64()
                .or_else(|| value.as_str().and_then(|raw| raw.parse::<i64>().ok()))
        })
        .unwrap_or(fallback)
}

fn st_selective_logic(value: Option<&Value>) -> i64 {
    match value.and_then(Value::as_str) {
        Some("or") => 1,
        Some("not") => 2,
        _ => 0,
    }
}

fn st_role(value: Option<&Value>) -> i64 {
    match value.and_then(Value::as_str) {
        Some("user") => 1,
        Some("assistant") => 2,
        _ => 0,
    }
}

struct ExportZip {
    writer: zip::ZipWriter<Cursor<Vec<u8>>>,
    options: SimpleFileOptions,
}

impl ExportZip {
    fn new() -> Self {
        Self {
            writer: zip::ZipWriter::new(Cursor::new(Vec::new())),
            options: SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated),
        }
    }

    fn add_json(&mut self, path: &str, value: &Value) -> AppResult<()> {
        self.writer
            .start_file(path.replace('\\', "/"), self.options)
            .map_err(zip_error)?;
        self.writer.write_all(&serde_json::to_vec_pretty(value)?)?;
        Ok(())
    }

    fn finish(self) -> AppResult<Vec<u8>> {
        Ok(self.writer.finish().map_err(zip_error)?.into_inner())
    }
}

fn character_card_png(card: &Value, png_bytes: Option<&[u8]>) -> AppResult<Vec<u8>> {
    let chara = general_purpose::STANDARD.encode(serde_json::to_vec(card)?);
    if let Some(png_bytes) = png_bytes {
        return inject_text_chunk(png_bytes, "chara", &chara);
    }

    let mut bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut bytes, 1, 1);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder
            .add_text_chunk("chara".to_string(), chara)
            .map_err(|error| AppError::new("png_export_error", error.to_string()))?;
        let mut writer = encoder
            .write_header()
            .map_err(|error| AppError::new("png_export_error", error.to_string()))?;
        writer
            .write_image_data(&[0, 0, 0, 0])
            .map_err(|error| AppError::new("png_export_error", error.to_string()))?;
    }
    Ok(bytes)
}

fn png_data_url_bytes(value: &str) -> Option<Vec<u8>> {
    let (header, payload) = value.split_once(',')?;
    if !header.to_ascii_lowercase().starts_with("data:image/png") {
        return None;
    }
    general_purpose::STANDARD.decode(payload).ok()
}

fn inject_text_chunk(png: &[u8], keyword: &str, text: &str) -> AppResult<Vec<u8>> {
    const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
    if png.len() < PNG_SIGNATURE.len() || &png[..PNG_SIGNATURE.len()] != PNG_SIGNATURE {
        return Err(AppError::new("png_export_error", "Invalid PNG signature"));
    }

    let text_chunk = build_png_chunk(
        b"tEXt",
        &[keyword.as_bytes(), &[0], text.as_bytes()].concat(),
    );
    let mut parts = Vec::new();
    parts.extend_from_slice(PNG_SIGNATURE);
    let mut offset = PNG_SIGNATURE.len();
    let mut inserted = false;
    while offset + 12 <= png.len() {
        let length = u32::from_be_bytes(png[offset..offset + 4].try_into().unwrap()) as usize;
        let chunk_start = offset;
        let chunk_type_start = offset + 4;
        let data_start = offset + 8;
        let data_end = data_start.saturating_add(length);
        let chunk_end = data_end.saturating_add(4);
        if chunk_end > png.len() {
            return Err(AppError::new(
                "png_export_error",
                "Invalid PNG chunk bounds",
            ));
        }
        let chunk_type = &png[chunk_type_start..chunk_type_start + 4];
        let chunk_data = &png[data_start..data_end];
        let is_card_text = png_text_keyword(chunk_type, chunk_data)
            .is_some_and(|value| value == "chara" || value == "ccv3");
        if is_card_text {
            offset = chunk_end;
            continue;
        }
        if !inserted && (chunk_type == b"IDAT" || chunk_type == b"IEND") {
            parts.extend_from_slice(&text_chunk);
            inserted = true;
        }
        parts.extend_from_slice(&png[chunk_start..chunk_end]);
        offset = chunk_end;
        if chunk_type == b"IEND" {
            break;
        }
    }
    if !inserted {
        parts.extend_from_slice(&text_chunk);
    }
    Ok(parts)
}

fn png_text_keyword<'a>(chunk_type: &[u8], chunk_data: &'a [u8]) -> Option<&'a str> {
    if chunk_type != b"tEXt" && chunk_type != b"iTXt" {
        return None;
    }
    let end = chunk_data.iter().position(|byte| *byte == 0)?;
    std::str::from_utf8(&chunk_data[..end]).ok()
}

fn build_png_chunk(chunk_type: &[u8; 4], data: &[u8]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(12 + data.len());
    bytes.extend_from_slice(&(data.len() as u32).to_be_bytes());
    bytes.extend_from_slice(chunk_type);
    bytes.extend_from_slice(data);
    let crc_input = [chunk_type.as_slice(), data].concat();
    bytes.extend_from_slice(&crc32(&crc_input).to_be_bytes());
    bytes
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffffu32;
    for byte in bytes {
        crc ^= *byte as u32;
        for _ in 0..8 {
            crc = (crc >> 1) ^ if crc & 1 == 1 { 0xedb8_8320 } else { 0 };
        }
    }
    crc ^ 0xffff_ffff
}

fn binary_download(bytes: Vec<u8>, content_type: &str, filename: &str) -> Value {
    json!({
        "base64": general_purpose::STANDARD.encode(bytes),
        "contentType": content_type,
        "filename": filename
    })
}

fn zip_error(error: zip::result::ZipError) -> AppError {
    AppError::new("zip_error", error.to_string())
}

fn safe_export_name(name: &str, fallback: &str) -> String {
    let sanitized = name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    if sanitized.is_empty() {
        fallback.to_string()
    } else {
        sanitized
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-exports-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn entries_for_lorebook(state: &AppState, lorebook_id: &str) -> Vec<Value> {
        list_collection(state, "lorebook-entries", Some(("lorebookId", lorebook_id)))
            .expect("entries should be readable")
            .as_array()
            .cloned()
            .unwrap_or_default()
    }

    fn tiny_png_bytes() -> Vec<u8> {
        general_purpose::STANDARD
            .decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
            .expect("embedded test PNG should decode")
    }

    #[test]
    fn native_character_export_embeds_managed_gallery_assets() {
        let state = test_state("managed-character-gallery-export");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "character-1",
                    "data": { "name": "Gallery Character" }
                }),
            )
            .expect("character should be created");
        let gallery_dir = state.data_dir.join("gallery");
        fs::create_dir_all(&gallery_dir).expect("gallery directory should be created");
        let image_path = gallery_dir.join("managed-gallery.png");
        fs::write(&image_path, tiny_png_bytes()).expect("managed gallery image should be written");
        let asset_url = media_uploads::file_path_asset_url(&image_path);
        state
            .storage
            .create(
                "character-gallery",
                json!({
                    "id": "gallery-1",
                    "characterId": "character-1",
                    "filePath": image_path.to_string_lossy(),
                    "filename": "managed-gallery.png",
                    "url": asset_url,
                    "prompt": "pose reference",
                    "provider": "local",
                    "model": "test",
                    "width": 1,
                    "height": 1
                }),
            )
            .expect("managed gallery row should be created");

        let gallery =
            gallery_for_character(&state, "character-1").expect("character gallery should export");

        assert_eq!(gallery.len(), 1);
        assert_eq!(
            gallery[0].get("filename").and_then(Value::as_str),
            Some("managed-gallery.png")
        );
        assert!(
            gallery[0]
                .get("data")
                .and_then(Value::as_str)
                .is_some_and(|value| value.starts_with("data:image/png;base64,")),
            "managed gallery export should embed image data"
        );
        assert_eq!(
            gallery[0].get("prompt").and_then(Value::as_str),
            Some("pose reference")
        );
    }

    #[test]
    fn native_character_export_keeps_inline_gallery_and_skips_missing_files() {
        let state = test_state("inline-character-gallery-export");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "character-1",
                    "data": { "name": "Inline Gallery Character" }
                }),
            )
            .expect("character should be created");
        let inline_data =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
        state
            .storage
            .create(
                "character-gallery",
                json!({
                    "id": "gallery-inline",
                    "characterId": "character-1",
                    "filename": "inline.png",
                    "url": inline_data
                }),
            )
            .expect("inline gallery row should be created");
        state
            .storage
            .create(
                "character-gallery",
                json!({
                    "id": "gallery-missing",
                    "characterId": "character-1",
                    "filename": "missing.png",
                    "url": media_uploads::file_path_asset_url(&state.data_dir.join("gallery").join("missing.png"))
                }),
            )
            .expect("missing gallery row should be created");

        let gallery =
            gallery_for_character(&state, "character-1").expect("character gallery should export");

        assert_eq!(gallery.len(), 1);
        assert_eq!(
            gallery[0].get("filename").and_then(Value::as_str),
            Some("inline.png")
        );
        assert_eq!(
            gallery[0].get("data").and_then(Value::as_str),
            Some(inline_data)
        );
    }

    #[test]
    fn embedded_lorebook_import_preserves_st_character_book_fields() {
        let state = test_state("embedded-lorebook-st-fields");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "character-1",
                    "name": "Mira",
                    "data": {
                        "name": "Mira",
                        "character_book": {
                            "entries": [
                                {
                                    "comment": "Moon Memory",
                                    "content": "moon lore",
                                    "key": ["moon"],
                                    "keysecondary": ["tide"],
                                    "disable": true,
                                    "order": 12,
                                    "position": "at_depth",
                                    "role": "assistant",
                                    "depth": 7,
                                    "scan_depth": 9,
                                    "probability": 45,
                                    "useProbability": true,
                                    "match_whole_words": true,
                                    "case_sensitive": true,
                                    "regex": true,
                                    "sticky": 2,
                                    "cooldown": 3,
                                    "delay": 4,
                                    "ephemeral": 5,
                                    "group": "memory",
                                    "groupWeight": 6,
                                    "excludeRecursion": true,
                                    "locked": true
                                },
                                {
                                    "comment": "Sun Signal",
                                    "content": "sun lore",
                                    "keys": ["sun"],
                                    "secondaryKeys": ["flare"]
                                }
                            ]
                        }
                    }
                }),
            )
            .expect("character should be created");

        let imported = import_character_embedded_lorebook(&state, "character-1")
            .expect("embedded lorebook should import");
        let lorebook_id = imported
            .get("lorebookId")
            .and_then(Value::as_str)
            .expect("import should return lorebook id");
        let entries = entries_for_lorebook(&state, lorebook_id);

        assert_eq!(entries.len(), 2);
        let entry = entries
            .iter()
            .find(|entry| entry.get("name").and_then(Value::as_str) == Some("Moon Memory"))
            .expect("moon entry should import");
        assert_eq!(entry["name"], "Moon Memory");
        assert_eq!(entry["content"], "moon lore");
        assert_eq!(entry["keys"], json!(["moon"]));
        assert_eq!(entry["secondaryKeys"], json!(["tide"]));
        assert_eq!(entry["enabled"], false);
        assert_eq!(entry["order"], 12);
        assert_eq!(entry["position"], 2);
        assert_eq!(entry["role"], "assistant");
        assert_eq!(entry["depth"], 7);
        assert_eq!(entry["scanDepth"], 9);
        assert_eq!(entry["probability"], 45);
        assert_eq!(entry["matchWholeWords"], true);
        assert_eq!(entry["caseSensitive"], true);
        assert_eq!(entry["useRegex"], true);
        assert_eq!(entry["sticky"], 2);
        assert_eq!(entry["cooldown"], 3);
        assert_eq!(entry["delay"], 4);
        assert_eq!(entry["ephemeral"], 5);
        assert_eq!(entry["group"], "memory");
        assert_eq!(entry["groupWeight"], 6);
        assert_eq!(entry["preventRecursion"], true);
        assert_eq!(entry["locked"], true);

        let camel_case_entry = entries
            .iter()
            .find(|entry| entry.get("name").and_then(Value::as_str) == Some("Sun Signal"))
            .expect("camelCase secondary key entry should import");
        assert_eq!(camel_case_entry["secondaryKeys"], json!(["flare"]));
        assert_eq!(camel_case_entry["order"], 1);
    }

    #[test]
    fn embedded_lorebook_reimport_reuses_linked_lorebook_and_replaces_entries() {
        let state = test_state("embedded-lorebook-reimport");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "character-1",
                    "name": "Mira",
                    "data": {
                        "name": "Mira",
                        "character_book": {
                            "entries": [
                                { "comment": "First", "content": "first moon", "key": ["moon"] }
                            ]
                        }
                    }
                }),
            )
            .expect("character should be created");

        let first = import_character_embedded_lorebook(&state, "character-1")
            .expect("first import should succeed");
        let lorebook_id = first
            .get("lorebookId")
            .and_then(Value::as_str)
            .expect("first import should return lorebook id")
            .to_string();
        assert_eq!(
            first.get("reimported").and_then(Value::as_bool),
            Some(false)
        );

        state
            .storage
            .patch(
                "characters",
                "character-1",
                json!({
                    "data": {
                        "name": "Mira",
                        "character_book": {
                            "entries": [
                                { "comment": "Second", "content": "second sun", "key": ["sun"] },
                                { "comment": "Third", "content": "third star", "key": ["star"] }
                            ]
                        },
                        "extensions": {
                            "importMetadata": {
                                "embeddedLorebook": {
                                    "hasEmbeddedLorebook": true,
                                    "lorebookId": lorebook_id,
                                    "entriesImported": 1
                                }
                            }
                        }
                    }
                }),
            )
            .expect("character should update");
        state
            .storage
            .create(
                "lorebooks",
                json!({
                    "id": "stale-linked-book",
                    "name": "Stale duplicate",
                    "description": "Imported from embedded character book",
                    "category": "character",
                    "characterId": "character-1",
                    "sourceCharacterId": "character-1"
                }),
            )
            .expect("stale linked lorebook should be created");
        state
            .storage
            .create(
                "lorebook-entries",
                json!({
                    "id": "stale-entry",
                    "lorebookId": "stale-linked-book",
                    "name": "Stale",
                    "content": "stale duplicate"
                }),
            )
            .expect("stale entry should be created");
        state
            .storage
            .create(
                "lorebooks",
                json!({
                    "id": "manual-character-book",
                    "name": "Manual character book",
                    "category": "character",
                    "characterId": "character-1",
                    "sourceCharacterId": "character-1"
                }),
            )
            .expect("manual linked lorebook should be created");

        let second = import_character_embedded_lorebook(&state, "character-1")
            .expect("reimport should succeed");

        assert_eq!(
            second.get("lorebookId").and_then(Value::as_str),
            Some(lorebook_id.as_str())
        );
        assert_eq!(
            second.get("reimported").and_then(Value::as_bool),
            Some(true)
        );
        let lorebook_ids = state
            .storage
            .list("lorebooks")
            .unwrap()
            .into_iter()
            .filter_map(|lorebook| {
                lorebook
                    .get("id")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
            .collect::<Vec<_>>();
        assert!(lorebook_ids.contains(&lorebook_id));
        assert!(lorebook_ids.contains(&"manual-character-book".to_string()));
        assert!(!lorebook_ids.contains(&"stale-linked-book".to_string()));
        assert!(entries_for_lorebook(&state, "stale-linked-book").is_empty());

        let entries = entries_for_lorebook(&state, &lorebook_id);
        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .any(|entry| { entry.get("content").and_then(Value::as_str) == Some("second sun") }));
        assert!(!entries
            .iter()
            .any(|entry| { entry.get("content").and_then(Value::as_str) == Some("first moon") }));
    }
}
