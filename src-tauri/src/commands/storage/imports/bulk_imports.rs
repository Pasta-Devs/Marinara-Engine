use super::*;
use std::path::Component;

fn bool_option(value: Option<&Value>) -> Option<bool> {
    match value {
        Some(Value::Bool(value)) => Some(*value),
        Some(Value::Number(value)) => value.as_i64().map(|value| value != 0),
        Some(Value::String(raw)) => match raw.trim().to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" | "y" | "on" => Some(true),
            "false" | "0" | "no" | "n" | "off" => Some(false),
            _ => None,
        },
        _ => None,
    }
}

fn selected_ids(options: &Value, key: &str) -> Vec<String> {
    options
        .get(key)
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

fn selected_import_total(options: &Value) -> usize {
    [
        "characters",
        "chats",
        "groupChats",
        "presets",
        "lorebooks",
        "backgrounds",
        "personas",
    ]
    .iter()
    .map(|key| selected_ids(options, key).len())
    .sum()
}

fn imported_jsonl_message_role(row: &Value) -> &'static str {
    match row.get("role").and_then(Value::as_str).map(str::trim) {
        Some("user") => "user",
        Some("assistant") => "assistant",
        Some("system") => "system",
        Some("narrator") => "narrator",
        _ if row.get("is_user").and_then(Value::as_bool).unwrap_or(false) => "user",
        _ => "assistant",
    }
}

fn empty_import_counts() -> Value {
    json!({
        "characters": 0,
        "chats": 0,
        "groupChats": 0,
        "presets": 0,
        "lorebooks": 0,
        "backgrounds": 0,
        "personas": 0
    })
}

fn imported_count(imported: &Value, key: &str) -> i64 {
    imported.get(key).and_then(Value::as_i64).unwrap_or(0)
}

fn push_import_error(errors: &mut Vec<Value>, item: impl AsRef<str>, error: AppError) {
    errors.push(Value::String(format!(
        "{}: {}",
        item.as_ref(),
        error.message
    )));
}

fn push_path_import_error(errors: &mut Vec<Value>, path: &Path, error: AppError) {
    push_import_error(errors, path.to_string_lossy(), error);
}

fn selected_path(
    data_dir: &Path,
    category: &str,
    id: &str,
    errors: &mut Vec<Value>,
) -> Option<PathBuf> {
    match path_from_id(data_dir, category, id) {
        Ok(path) => Some(path),
        Err(error) => {
            push_import_error(errors, id, error);
            None
        }
    }
}

fn bump_imported(imported: &mut Value, key: &str) {
    if let Some(value) = imported.get_mut(key) {
        *value = json!(value.as_i64().unwrap_or(0) + 1);
    }
}

struct BulkImportProgress<'a> {
    emit: Option<&'a mut dyn FnMut(Value) -> AppResult<()>>,
    current: usize,
    total: usize,
}

impl<'a> BulkImportProgress<'a> {
    fn new(emit: Option<&'a mut dyn FnMut(Value) -> AppResult<()>>, total: usize) -> Self {
        Self {
            emit,
            current: 0,
            total,
        }
    }

    fn emit_item(&mut self, category: &str, item: &Path, imported: &Value) -> AppResult<()> {
        self.current += 1;
        self.emit_progress(category, &item.to_string_lossy(), imported)
    }

    fn emit_skipped(&mut self, category: &str, item: &str, imported: &Value) -> AppResult<()> {
        self.current += 1;
        self.emit_progress(category, item, imported)
    }

    fn emit_progress(&mut self, category: &str, item: &str, imported: &Value) -> AppResult<()> {
        if let Some(emit) = self.emit.as_deref_mut() {
            emit(json!({
                "type": "progress",
                "data": {
                    "category": category,
                    "item": item,
                    "current": self.current,
                    "total": self.total,
                    "imported": imported
                }
            }))?;
        }
        Ok(())
    }

    fn emit_done(&mut self, result: &Value) -> AppResult<()> {
        if let Some(emit) = self.emit.as_deref_mut() {
            emit(json!({ "type": "done", "data": result }))?;
        }
        Ok(())
    }
}

fn resolve_st_data_dir(root: &Path) -> Option<PathBuf> {
    let default_user = root.join("data").join("default-user");
    if default_user.join("characters").is_dir() {
        return Some(default_user);
    }
    let data_parent = root.join("data");
    if let Ok(entries) = fs::read_dir(&data_parent) {
        for entry in entries.filter_map(Result::ok) {
            let candidate = entry.path();
            if candidate.is_dir() && candidate.join("characters").is_dir() {
                return Some(candidate);
            }
        }
    }
    let public = root.join("public");
    if public.join("characters").is_dir() {
        return Some(public);
    }
    if root.join("characters").is_dir() {
        return Some(root.to_path_buf());
    }
    None
}

fn path_id(category: &str, data_dir: &Path, path: &Path) -> String {
    let relative = path
        .strip_prefix(data_dir)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    format!("{category}:{relative}")
}

fn path_from_id(data_dir: &Path, category: &str, id: &str) -> AppResult<PathBuf> {
    let prefix = format!("{category}:");
    let relative = id
        .strip_prefix(&prefix)
        .ok_or_else(|| AppError::invalid_input(format!("Invalid {category} import id")))?;
    let candidate = Path::new(relative);
    if candidate.is_absolute()
        || candidate.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(AppError::invalid_input(
            "Import id must not contain parent path segments",
        ));
    }
    let base = data_dir.canonicalize().map_err(AppError::from)?;
    let path = base
        .join(candidate)
        .canonicalize()
        .map_err(AppError::from)?;
    if path.starts_with(&base) {
        Ok(path)
    } else {
        Err(AppError::invalid_input(
            "Import id resolves outside the SillyTavern data directory",
        ))
    }
}

fn list_files(dir: &Path, extensions: &[&str], recursive: bool) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if !dir.is_dir() {
        return files;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return files;
    };
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() && recursive {
            files.extend(list_files(&path, extensions, true));
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| format!(".{}", ext.to_ascii_lowercase()))
            .unwrap_or_default();
        if extensions.iter().any(|allowed| *allowed == ext) {
            files.push(path);
        }
    }
    files.sort();
    files
}

fn read_st_persona_settings(data_dir: &Path) -> (HashMap<String, String>, HashMap<String, String>) {
    let settings_path = data_dir.join("settings.json");
    let Ok(raw) = fs::read_to_string(settings_path) else {
        return (HashMap::new(), HashMap::new());
    };
    let Ok(settings) = serde_json::from_str::<Value>(&raw) else {
        return (HashMap::new(), HashMap::new());
    };
    let power_user = settings
        .get("power_user")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let names = power_user
        .get("personas")
        .and_then(Value::as_object)
        .map(|values| {
            values
                .iter()
                .filter_map(|(key, value)| {
                    value
                        .as_str()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(|value| (key.to_string(), value.to_string()))
                })
                .collect()
        })
        .unwrap_or_default();
    let descriptions = power_user
        .get("persona_descriptions")
        .and_then(Value::as_object)
        .map(|values| {
            values
                .iter()
                .filter_map(|(key, value)| {
                    let description = value
                        .as_str()
                        .map(str::to_string)
                        .or_else(|| {
                            value
                                .get("description")
                                .and_then(Value::as_str)
                                .map(str::to_string)
                        })
                        .unwrap_or_default();
                    (!description.trim().is_empty()).then(|| (key.to_string(), description))
                })
                .collect()
        })
        .unwrap_or_default();
    (names, descriptions)
}

fn st_persona_scan_item(
    data_dir: &Path,
    path: &Path,
    names: &HashMap<String, String>,
    descriptions: &HashMap<String, String>,
) -> Value {
    let filename = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();
    json!({
        "id": path_id("personas", data_dir, path),
        "path": path.to_string_lossy(),
        "name": names.get(&filename).cloned().unwrap_or_else(|| file_stem(path)),
        "description": descriptions.get(&filename).cloned().unwrap_or_default(),
        "modifiedAt": modified_at(path),
        "media": true,
    })
}

fn scan_item(category: &str, data_dir: &Path, path: &Path) -> Value {
    json!({
        "id": path_id(category, data_dir, path),
        "path": path.to_string_lossy(),
        "name": file_stem(path),
        "modifiedAt": modified_at(path),
    })
}

pub(super) fn scan_st_folder(body: Value) -> AppResult<Value> {
    let root = match resolve_import_folder(&body) {
        Ok(root) => root,
        Err(error) => {
            return Ok(json!({
                "success": false,
                "error": error.message,
                "characters": [],
                "chats": [],
                "groupChats": [],
                "presets": [],
                "lorebooks": [],
                "backgrounds": [],
                "personas": []
            }));
        }
    };
    let Some(data_dir) = resolve_st_data_dir(&root) else {
        return Ok(json!({
            "success": false,
            "error": "Could not find SillyTavern data directory. Make sure the path points to your SillyTavern installation folder.",
            "characters": [],
            "chats": [],
            "groupChats": [],
            "presets": [],
            "lorebooks": [],
            "backgrounds": [],
            "personas": []
        }));
    };

    let characters: Vec<Value> = list_files(
        &data_dir.join("characters"),
        &[".json", ".png", ".charx"],
        false,
    )
    .into_iter()
    .map(|path| {
        let mut item = scan_item("characters", &data_dir, &path);
        if let Some(object) = item.as_object_mut() {
            object.insert(
                "format".to_string(),
                Value::String(
                    path.extension()
                        .and_then(|ext| ext.to_str())
                        .unwrap_or("json")
                        .to_ascii_lowercase(),
                ),
            );
        }
        item
    })
    .collect();
    let chats: Vec<Value> = list_files(&data_dir.join("chats"), &[".jsonl"], true)
        .into_iter()
        .map(|path| {
            let mut item = scan_item("chats", &data_dir, &path);
            if let Some(object) = item.as_object_mut() {
                let folder_name = path
                    .parent()
                    .and_then(|path| path.file_name())
                    .map(|name| name.to_string_lossy().to_string())
                    .unwrap_or_default();
                object.insert("folderName".to_string(), Value::String(folder_name.clone()));
                object.insert("characterName".to_string(), Value::String(folder_name));
                object.insert("chatName".to_string(), Value::String(file_stem(&path)));
            }
            item
        })
        .collect();
    let group_chats: Vec<Value> =
        list_files(&data_dir.join("group chats"), &[".jsonl", ".json"], true)
            .into_iter()
            .map(|path| {
                let mut item = scan_item("groupChats", &data_dir, &path);
                if let Some(object) = item.as_object_mut() {
                    object.insert("groupName".to_string(), Value::String(file_stem(&path)));
                    object.insert("members".to_string(), json!([]));
                }
                item
            })
            .collect();
    let presets: Vec<Value> = list_files(&data_dir.join("presets"), &[".json"], false)
        .into_iter()
        .map(|path| {
            let mut item = scan_item("presets", &data_dir, &path);
            if let Some(object) = item.as_object_mut() {
                let name = file_stem(&path).to_ascii_lowercase();
                object.insert(
                    "isBuiltin".to_string(),
                    Value::Bool(matches!(
                        name.as_str(),
                        "default"
                            | "deterministic"
                            | "neutral"
                            | "universal-creative"
                            | "universal-light"
                            | "universal-super-creative"
                    )),
                );
            }
            item
        })
        .collect();
    let mut lorebook_files = list_files(&data_dir.join("worlds"), &[".json"], false);
    lorebook_files.extend(list_files(&data_dir.join("world-info"), &[".json"], false));
    lorebook_files.sort();
    lorebook_files.dedup();
    let lorebooks: Vec<Value> = lorebook_files
        .into_iter()
        .map(|path| scan_item("lorebooks", &data_dir, &path))
        .collect();
    let backgrounds: Vec<Value> = list_files(
        &data_dir.join("backgrounds"),
        &[".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"],
        true,
    )
    .into_iter()
    .map(|path| scan_item("backgrounds", &data_dir, &path))
    .collect();
    let (persona_names, persona_descriptions) = read_st_persona_settings(&data_dir);
    let mut persona_files = Vec::new();
    for folder in ["User Avatars", "user avatars"] {
        let avatar_dir = data_dir.join(folder);
        if avatar_dir.is_dir() {
            persona_files.extend(list_files(
                &avatar_dir,
                &[".png", ".jpg", ".jpeg", ".webp"],
                false,
            ));
            break;
        }
    }
    persona_files.extend(list_files(
        &data_dir.join("personas"),
        &[".json", ".txt"],
        false,
    ));
    persona_files.sort();
    persona_files.dedup();
    let personas: Vec<Value> = persona_files
        .into_iter()
        .map(|path| {
            let is_media = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| {
                    matches!(
                        ext.to_ascii_lowercase().as_str(),
                        "png" | "jpg" | "jpeg" | "webp"
                    )
                })
                .unwrap_or(false);
            if is_media {
                st_persona_scan_item(&data_dir, &path, &persona_names, &persona_descriptions)
            } else {
                let mut item = scan_item("personas", &data_dir, &path);
                if let Some(object) = item.as_object_mut() {
                    object.insert("description".to_string(), Value::String(String::new()));
                    object.insert("media".to_string(), Value::Bool(false));
                }
                item
            }
        })
        .collect();

    Ok(json!({
        "success": true,
        "dataDir": data_dir.to_string_lossy(),
        "characters": characters,
        "chats": chats,
        "groupChats": group_chats,
        "presets": presets,
        "lorebooks": lorebooks,
        "backgrounds": backgrounds,
        "personas": personas,
    }))
}

fn import_st_chat_text(
    state: &AppState,
    text: &str,
    chat_name: String,
    inherited: Option<Value>,
) -> AppResult<Value> {
    let mut character_name = String::new();
    let mut character_ids = Vec::new();
    let mut parsed_rows = Vec::new();
    for line in text.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let parsed = match parse_json_text(line) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if character_name.is_empty() {
            if let Some(name) = parsed.get("character_name").and_then(Value::as_str) {
                character_name = name.to_string();
            }
        }
        if let Some(character_id) = parsed
            .get("characterId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            if !character_ids.iter().any(|id| id == character_id) {
                character_ids.push(character_id.to_string());
            }
        }
        parsed_rows.push(parsed);
    }
    let mut chat = ensure_object(inherited.unwrap_or_else(|| json!({})))?;
    chat.remove("id");
    chat.insert("name".to_string(), Value::String(chat_name));
    chat.entry("mode".to_string())
        .or_insert(Value::String("conversation".to_string()));
    if character_ids.is_empty() {
        chat.entry("characterIds".to_string())
            .or_insert_with(|| json!([]));
    } else {
        let mut merged_character_ids = shared::string_array_from_value(chat.get("characterIds"));
        for character_id in character_ids {
            if !merged_character_ids.iter().any(|id| id == &character_id) {
                merged_character_ids.push(character_id);
            }
        }
        chat.insert("characterIds".to_string(), json!(merged_character_ids));
    }
    chat.entry("metadata".to_string())
        .or_insert_with(|| json!({}));
    if !character_name.is_empty() {
        chat.entry("importedCharacterName".to_string())
            .or_insert(Value::String(character_name));
    }
    let mut created_chat_id = None;
    let mut created_message_ids = Vec::new();
    let result = (|| -> AppResult<Value> {
        let chat_record = state.storage.create("chats", Value::Object(chat))?;
        let chat_id = created_record_id(&chat_record, "chat")?;
        created_chat_id = Some(chat_id.clone());
        let mut imported = 0usize;
        for row in parsed_rows {
            if row
                .get("is_system")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                continue;
            }
            let content = row
                .get("mes")
                .or_else(|| row.get("content"))
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            if content.trim().is_empty() {
                continue;
            }
            let role = imported_jsonl_message_role(&row);
            let character_id = row
                .get("characterId")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| Value::String(value.to_string()))
                .unwrap_or(Value::Null);
            let message = state.storage.create(
                "messages",
                json!({
                    "chatId": chat_id,
                    "role": role,
                    "content": content,
                    "characterId": character_id,
                    "extra": {},
                    "activeSwipeIndex": 0,
                    "swipes": [{ "content": content }]
                }),
            )?;
            created_message_ids.push(created_record_id(&message, "message")?);
            imported += 1;
        }
        Ok(
            json!({ "success": true, "chatId": chat_id, "chat": chat_record, "messagesImported": imported }),
        )
    })();

    result.map_err(|error| {
        let mut rollback_errors = Vec::new();
        rollback_created_records(
            state,
            "messages",
            &created_message_ids,
            &mut rollback_errors,
        );
        if let Some(chat_id) = created_chat_id.as_deref() {
            rollback_created_records(state, "chats", &[chat_id.to_string()], &mut rollback_errors);
        }
        append_rollback_errors(error, "chat import", rollback_errors)
    })
}

pub(super) fn import_st_chat(state: &AppState, body: Value) -> AppResult<Value> {
    let uploaded = decode_uploaded_file_value(
        body.get("file")
            .ok_or_else(|| AppError::invalid_input("file is required"))?,
    )?;
    let text = String::from_utf8(uploaded.bytes)
        .map_err(|_| AppError::invalid_input("Chat import file must be UTF-8 JSONL"))?;
    let chat_name = Path::new(&uploaded.name)
        .file_stem()
        .map(|name| name.to_string_lossy().replace('_', " "))
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "Imported Chat".to_string());
    import_st_chat_text(state, &text, chat_name, None)
}

pub(super) fn import_st_chat_into_group(state: &AppState, body: Value) -> AppResult<Value> {
    let target_chat_id = required_string(&body, "chatId")?;
    let target = get_required(state, "chats", target_chat_id)?;
    let uploaded = decode_uploaded_file_value(
        body.get("file")
            .ok_or_else(|| AppError::invalid_input("file is required"))?,
    )?;
    let text = String::from_utf8(uploaded.bytes)
        .map_err(|_| AppError::invalid_input("Chat import file must be UTF-8 JSONL"))?;
    let mut inherited = target.clone();
    if let Some(object) = inherited.as_object_mut() {
        let group_id = object
            .get("groupId")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .unwrap_or_else(new_id);
        object.insert("groupId".to_string(), Value::String(group_id.clone()));
        state
            .storage
            .patch("chats", target_chat_id, json!({ "groupId": group_id }))?;
    }
    let branch_name = Path::new(&uploaded.name)
        .file_stem()
        .map(|name| name.to_string_lossy().replace('_', " "))
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "Imported".to_string());
    import_st_chat_text(state, &text, branch_name, Some(inherited)).map_err(|error| {
        let mut rollback_errors = Vec::new();
        restore_record(state, "chats", &target, &mut rollback_errors);
        append_rollback_errors(error, "chat branch import", rollback_errors)
    })
}

fn import_persona_payload(
    state: &AppState,
    payload: Value,
    fallback_name: &str,
) -> AppResult<Value> {
    let mut object = ensure_object(payload).unwrap_or_default();
    object
        .entry("name".to_string())
        .or_insert(Value::String(fallback_name.to_string()));
    if !object.contains_key("description") {
        if let Some(persona) = object
            .get("persona")
            .or_else(|| object.get("content"))
            .and_then(Value::as_str)
        {
            object.insert(
                "description".to_string(),
                Value::String(persona.to_string()),
            );
        }
    }
    state
        .storage
        .create("personas", with_entity_defaults("personas", Value::Object(object))?)
        .map(|record| json!({ "success": true, "id": record.get("id").cloned().unwrap_or(Value::Null), "name": record.get("name").cloned().unwrap_or(Value::Null), "persona": record }))
}

fn import_persona_file(state: &AppState, path: &Path) -> AppResult<Value> {
    let raw = fs::read_to_string(path)?;
    let fallback_name = file_stem(path);
    let payload = parse_json_text(&raw)
        .unwrap_or_else(|_| json!({ "name": fallback_name, "description": raw }));
    import_persona_payload(state, payload, &fallback_name)
}

fn import_persona_avatar_file(
    state: &AppState,
    path: &Path,
    name: String,
    description: String,
) -> AppResult<Value> {
    let stored = super::super::media_uploads::persist_image_file_copy(
        state,
        "avatars/personas",
        &path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| file_stem(path)),
        path,
    )?;
    let modified = modified_at(path);
    let avatar_path = stored.absolute_path.clone();
    let payload = json!({
        "name": name,
        "description": description,
        "avatarPath": stored.asset_url,
        "avatarFilePath": stored.absolute_path,
        "avatarFilename": stored.filename,
        "importedModifiedAt": modified,
    });
    import_persona_payload(state, payload, &file_stem(path)).map_err(|error| {
        let mut rollback_errors = Vec::new();
        rollback_managed_file_path(
            state,
            "avatars/personas",
            &avatar_path,
            &mut rollback_errors,
        );
        append_rollback_errors(error, "persona import", rollback_errors)
    })
}

fn restore_record(
    state: &AppState,
    collection: &str,
    original: &Value,
    rollback_errors: &mut Vec<String>,
) {
    let Some(id) = original.get("id").and_then(Value::as_str) else {
        rollback_errors.push(format!("{collection}: original record is missing an id"));
        return;
    };
    let rows = match state.storage.list(collection) {
        Ok(rows) => rows,
        Err(error) => {
            rollback_errors.push(format!("{collection}/{id}: {error}"));
            return;
        }
    };
    let mut replaced = false;
    let restored = rows
        .into_iter()
        .map(|row| {
            if row.get("id").and_then(Value::as_str) == Some(id) {
                replaced = true;
                original.clone()
            } else {
                row
            }
        })
        .collect::<Vec<_>>();
    if !replaced {
        rollback_errors.push(format!(
            "{collection}/{id}: record was not found for restore"
        ));
        return;
    }
    if let Err(error) = state.storage.replace_all(collection, restored) {
        rollback_errors.push(format!("{collection}/{id}: {error}"));
    }
}

fn copy_background_file(state: &AppState, path: &Path) -> AppResult<Value> {
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| AppError::invalid_input("Background file is missing a filename"))?;
    let target = state.backgrounds.root().join(&name);
    let mut final_target = target.clone();
    if final_target.exists() {
        let stem = Path::new(&name)
            .file_stem()
            .map(|stem| stem.to_string_lossy().to_string())
            .unwrap_or_else(|| "background".to_string());
        let ext = Path::new(&name)
            .extension()
            .map(|ext| format!(".{}", ext.to_string_lossy()))
            .unwrap_or_default();
        for index in 1..10_000 {
            let candidate = state
                .backgrounds
                .root()
                .join(format!("{stem}-{index}{ext}"));
            if !candidate.exists() {
                final_target = candidate;
                break;
            }
        }
    }
    fs::copy(path, &final_target)?;
    Ok(json!({ "success": true, "path": final_target.to_string_lossy() }))
}

fn run_st_bulk_import_inner(
    state: &AppState,
    body: Value,
    event_sink: Option<&mut dyn FnMut(Value) -> AppResult<()>>,
) -> AppResult<Value> {
    let root = resolve_import_folder(&body)?;
    let data_dir = resolve_st_data_dir(&root)
        .ok_or_else(|| AppError::invalid_input("Could not find SillyTavern data directory"))?;
    let options = body.get("options").cloned().unwrap_or_else(|| json!({}));
    let mut progress = BulkImportProgress::new(event_sink, selected_import_total(&options));
    let mut imported = empty_import_counts();
    let mut errors: Vec<Value> = Vec::new();
    let tag_mode = options
        .get("characterTagImportMode")
        .and_then(Value::as_str)
        .unwrap_or("all");
    let import_embedded = bool_option(options.get("importEmbeddedLorebook")).unwrap_or(true);
    let (persona_names, persona_descriptions) = read_st_persona_settings(&data_dir);

    for id in selected_ids(&options, "characters") {
        let Some(path) = selected_path(&data_dir, "characters", &id, &mut errors) else {
            progress.emit_skipped("Characters", &id, &imported)?;
            continue;
        };
        progress.emit_item("Characters", &path, &imported)?;
        let filename = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();
        let result = fs::read(&path)
            .map_err(AppError::from)
            .and_then(|bytes| parse_character_file_from_path(&filename, &path, &bytes))
            .and_then(|payload| {
                let trusted_avatar_source = filename
                    .to_ascii_lowercase()
                    .ends_with(".png")
                    .then_some(path.as_path());
                import_st_character_payload(
                    state,
                    payload,
                    Some(filename.clone()),
                    &json!({ "tagImportMode": tag_mode, "importEmbeddedLorebook": import_embedded }),
                    trusted_avatar_source,
                )
            });
        match result {
            Ok(_) => bump_imported(&mut imported, "characters"),
            Err(error) => push_path_import_error(&mut errors, &path, error),
        }
    }

    for id in selected_ids(&options, "lorebooks") {
        let Some(path) = selected_path(&data_dir, "lorebooks", &id, &mut errors) else {
            progress.emit_skipped("Lorebooks", &id, &imported)?;
            continue;
        };
        progress.emit_item("Lorebooks", &path, &imported)?;
        let result = fs::read(&path)
            .map_err(AppError::from)
            .and_then(|bytes| parse_object(&bytes))
            .and_then(|payload| {
                create_lorebook_from_payload(state, &payload, &file_stem(&path), None)
            });
        match result {
            Ok(_) => bump_imported(&mut imported, "lorebooks"),
            Err(error) => push_path_import_error(&mut errors, &path, error),
        }
    }

    for id in selected_ids(&options, "presets") {
        let Some(path) = selected_path(&data_dir, "presets", &id, &mut errors) else {
            progress.emit_skipped("Presets", &id, &imported)?;
            continue;
        };
        progress.emit_item("Presets", &path, &imported)?;
        let result = fs::read(&path)
            .map_err(AppError::from)
            .and_then(|bytes| parse_object(&bytes))
            .and_then(|payload| import_st_preset_payload(state, payload, Some(&file_stem(&path))));
        match result {
            Ok(_) => bump_imported(&mut imported, "presets"),
            Err(error) => push_path_import_error(&mut errors, &path, error),
        }
    }

    for id in selected_ids(&options, "personas") {
        let Some(path) = selected_path(&data_dir, "personas", &id, &mut errors) else {
            progress.emit_skipped("Personas", &id, &imported)?;
            continue;
        };
        progress.emit_item("Personas", &path, &imported)?;
        let is_media = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| {
                matches!(
                    ext.to_ascii_lowercase().as_str(),
                    "png" | "jpg" | "jpeg" | "webp"
                )
            })
            .unwrap_or(false);
        let result = if is_media {
            let filename = path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_default();
            import_persona_avatar_file(
                state,
                &path,
                persona_names
                    .get(&filename)
                    .cloned()
                    .unwrap_or_else(|| file_stem(&path)),
                persona_descriptions
                    .get(&filename)
                    .cloned()
                    .unwrap_or_default(),
            )
        } else {
            import_persona_file(state, &path)
        };
        match result {
            Ok(_) => bump_imported(&mut imported, "personas"),
            Err(error) => push_path_import_error(&mut errors, &path, error),
        }
    }

    for id in selected_ids(&options, "backgrounds") {
        let Some(path) = selected_path(&data_dir, "backgrounds", &id, &mut errors) else {
            progress.emit_skipped("Backgrounds", &id, &imported)?;
            continue;
        };
        progress.emit_item("Backgrounds", &path, &imported)?;
        match copy_background_file(state, &path) {
            Ok(_) => bump_imported(&mut imported, "backgrounds"),
            Err(error) => push_path_import_error(&mut errors, &path, error),
        }
    }

    for id in selected_ids(&options, "chats") {
        let Some(path) = selected_path(&data_dir, "chats", &id, &mut errors) else {
            progress.emit_skipped("Chats", &id, &imported)?;
            continue;
        };
        progress.emit_item("Chats", &path, &imported)?;
        let result = fs::read_to_string(&path)
            .map_err(AppError::from)
            .and_then(|text| {
                import_st_chat_text(state, &text, file_stem(&path).replace('_', " "), None)
            });
        match result {
            Ok(_) => bump_imported(&mut imported, "chats"),
            Err(error) => push_path_import_error(&mut errors, &path, error),
        }
    }

    for id in selected_ids(&options, "groupChats") {
        let Some(path) = selected_path(&data_dir, "groupChats", &id, &mut errors) else {
            progress.emit_skipped("Group chats", &id, &imported)?;
            continue;
        };
        progress.emit_item("Group chats", &path, &imported)?;
        let result = fs::read_to_string(&path)
            .map_err(AppError::from)
            .and_then(|text| {
                import_st_chat_text(state, &text, file_stem(&path).replace('_', " "), None)
            });
        match result {
            Ok(_) => bump_imported(&mut imported, "groupChats"),
            Err(error) => push_path_import_error(&mut errors, &path, error),
        }
    }

    let imported_total = [
        "characters",
        "chats",
        "groupChats",
        "presets",
        "lorebooks",
        "backgrounds",
        "personas",
    ]
    .iter()
    .map(|key| imported_count(&imported, key))
    .sum::<i64>();
    let result = json!({
        "success": imported_total > 0 || errors.is_empty(),
        "imported": imported,
        "errors": errors
    });
    progress.emit_done(&result)?;
    Ok(result)
}

pub(super) fn run_st_bulk_import(state: &AppState, body: Value) -> AppResult<Value> {
    run_st_bulk_import_inner(state, body, None)
}

pub(super) fn run_st_bulk_import_channel(
    state: &AppState,
    body: Value,
    mut emit: impl FnMut(Value) -> AppResult<()>,
) -> AppResult<()> {
    match run_st_bulk_import_inner(state, body, Some(&mut emit)) {
        Ok(_) => Ok(()),
        Err(error) => emit(json!({
            "type": "error",
            "data": {
                "error": error.message,
                "code": error.code
            }
        })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use base64::engine::general_purpose;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_path(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "marinara-st-bulk-import-{label}-{}-{nonce}",
            std::process::id()
        ))
    }

    fn write_json(path: &Path, value: &Value) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("fixture parent should be created");
        }
        fs::write(
            path,
            serde_json::to_vec(value).expect("fixture JSON should serialize"),
        )
        .expect("fixture JSON should be written");
    }

    fn write_bytes(path: &Path, bytes: &[u8]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("fixture parent should be created");
        }
        fs::write(path, bytes).expect("fixture file should be written");
    }

    fn block_collection_writes(state: &AppState, collection: &str) {
        let collection_path = state
            .storage
            .root()
            .join("collections")
            .join(format!("{collection}.json"));
        if let Some(parent) = collection_path.parent() {
            fs::create_dir_all(parent).expect("collection parent should be created");
        }
        fs::create_dir(collection_path).expect("collection path should block file writes");
    }

    fn uploaded_jsonl_file(name: &str, text: &str) -> Value {
        json!({
            "name": name,
            "type": "application/jsonl",
            "base64": general_purpose::STANDARD.encode(text.as_bytes())
        })
    }

    fn build_sillytavern_fixture(root: &Path) {
        let data_dir = root.join("data").join("default-user");
        for index in 0..80 {
            write_json(
                &data_dir
                    .join("characters")
                    .join(format!("character-{index:02}.json")),
                &json!({
                    "spec": "chara_card_v2",
                    "data": {
                        "name": format!("Character {index:02}"),
                        "description": "Imported test character"
                    }
                }),
            );
        }
        for index in 0..48 {
            write_bytes(
                &data_dir
                    .join("backgrounds")
                    .join(format!("background-{index:02}.png")),
                b"background-bytes",
            );
        }
        for index in 0..2 {
            write_bytes(
                &data_dir
                    .join("User Avatars")
                    .join(format!("persona-{index:02}.png")),
                b"persona-avatar-bytes",
            );
        }
    }

    fn folder_access(root: &Path) -> (String, String) {
        let listing = directory_listing(root.to_path_buf(), true)
            .expect("fixture folder should receive an import token");
        let path = listing
            .get("path")
            .and_then(Value::as_str)
            .expect("listing should include canonical path")
            .to_string();
        let token = listing
            .get("folderToken")
            .and_then(Value::as_str)
            .expect("listing should include folder token")
            .to_string();
        (path, token)
    }

    fn scan_ids(scan: &Value, key: &str) -> Vec<String> {
        scan.get(key)
            .and_then(Value::as_array)
            .expect("scan category should be an array")
            .iter()
            .filter_map(|item| item.get("id").and_then(Value::as_str))
            .map(ToOwned::to_owned)
            .collect()
    }

    #[test]
    fn import_st_chat_text_rolls_back_chat_when_message_write_fails() {
        let app_root = temp_path("chat-rollback");
        let state = AppState::from_data_dir(&app_root, Vec::new())
            .expect("test app state should initialize");
        block_collection_writes(&state, "messages");

        let error = import_st_chat_text(
            &state,
            r#"{"character_name":"Bot","mes":"hello"}"#,
            "Rollback Chat".to_string(),
            None,
        )
        .expect_err("message storage failure should reject chat import");

        assert_eq!(error.code, "io_error");
        assert!(
            state.storage.list("chats").unwrap().is_empty(),
            "failed chat import must remove the created chat"
        );

        let _ = fs::remove_dir_all(app_root);
    }

    #[test]
    fn import_st_chat_text_preserves_marinara_jsonl_character_ids() {
        let app_root = temp_path("chat-character-ids");
        let state = AppState::from_data_dir(&app_root, Vec::new())
            .expect("test app state should initialize");

        let result = import_st_chat_text(
            &state,
            r#"{"role":"assistant","characterId":"char-a","content":"hello"}"#,
            "Imported Chat".to_string(),
            None,
        )
        .expect("chat import should succeed");

        let chat_id = result
            .get("chatId")
            .and_then(Value::as_str)
            .expect("import result should include chat id");
        let chat = state
            .storage
            .get("chats", chat_id)
            .expect("chat should be readable")
            .expect("chat should exist");
        assert_eq!(
            shared::string_array_from_value(chat.get("characterIds")),
            vec!["char-a".to_string()],
            "chat should link character ids from Marinara JSONL rows"
        );

        let messages = state
            .storage
            .list("messages")
            .expect("messages should list");
        assert_eq!(messages.len(), 1);
        assert_eq!(
            messages[0].get("characterId").and_then(Value::as_str),
            Some("char-a"),
            "message should retain its row-level character id"
        );

        let _ = fs::remove_dir_all(app_root);
    }

    #[test]
    fn import_st_chat_text_preserves_marinara_jsonl_roles() {
        let app_root = temp_path("chat-message-roles");
        let state = AppState::from_data_dir(&app_root, Vec::new())
            .expect("test app state should initialize");

        import_st_chat_text(
            &state,
            concat!(
                r#"{"role":"user","content":"hello"}"#,
                "\n",
                r#"{"role":"assistant","content":"hi"}"#,
                "\n",
                r#"{"role":"system","content":"note"}"#,
                "\n",
                r#"{"role":"narrator","content":"scene"}"#,
            ),
            "Imported Chat".to_string(),
            None,
        )
        .expect("chat import should succeed");

        let roles = state
            .storage
            .list("messages")
            .expect("messages should list")
            .into_iter()
            .map(|message| {
                message
                    .get("role")
                    .and_then(Value::as_str)
                    .expect("message should include a role")
                    .to_string()
            })
            .collect::<Vec<_>>();
        assert_eq!(
            roles,
            vec![
                "user".to_string(),
                "assistant".to_string(),
                "system".to_string(),
                "narrator".to_string()
            ],
            "Marinara JSONL roles should round-trip without ST is_user flags"
        );

        let _ = fs::remove_dir_all(app_root);
    }

    #[test]
    fn import_st_chat_text_falls_back_for_unknown_marinara_jsonl_roles() {
        let app_root = temp_path("chat-unknown-message-role");
        let state = AppState::from_data_dir(&app_root, Vec::new())
            .expect("test app state should initialize");

        import_st_chat_text(
            &state,
            r#"{"role":"tool","content":"internal"}"#,
            "Imported Chat".to_string(),
            None,
        )
        .expect("chat import should succeed");

        let messages = state
            .storage
            .list("messages")
            .expect("messages should list");
        assert_eq!(messages.len(), 1);
        assert_eq!(
            messages[0].get("role").and_then(Value::as_str),
            Some("assistant"),
            "unknown JSONL roles should not be persisted verbatim"
        );

        let _ = fs::remove_dir_all(app_root);
    }

    #[test]
    fn import_st_chat_text_does_not_link_character_name_only_rows() {
        let app_root = temp_path("chat-character-name-only");
        let state = AppState::from_data_dir(&app_root, Vec::new())
            .expect("test app state should initialize");

        let result = import_st_chat_text(
            &state,
            r#"{"character_name":"Bot","mes":"hello"}"#,
            "Imported Chat".to_string(),
            None,
        )
        .expect("chat import should succeed");

        let chat_id = result
            .get("chatId")
            .and_then(Value::as_str)
            .expect("import result should include chat id");
        let chat = state
            .storage
            .get("chats", chat_id)
            .expect("chat should be readable")
            .expect("chat should exist");
        assert!(
            shared::string_array_from_value(chat.get("characterIds")).is_empty(),
            "ST character_name alone is not a stable local character link"
        );

        let messages = state
            .storage
            .list("messages")
            .expect("messages should list");
        assert_eq!(messages.len(), 1);
        assert!(
            messages[0].get("characterId").is_none_or(Value::is_null),
            "ST character_name alone should keep transcript messages unlinked"
        );

        let _ = fs::remove_dir_all(app_root);
    }

    #[test]
    fn import_st_chat_into_group_restores_target_when_branch_import_fails() {
        let app_root = temp_path("branch-rollback");
        let state = AppState::from_data_dir(&app_root, Vec::new())
            .expect("test app state should initialize");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "target-chat",
                    "name": "Target Chat",
                    "mode": "conversation",
                    "metadata": {},
                    "characterIds": []
                }),
            )
            .expect("target chat should be created");
        block_collection_writes(&state, "messages");

        let error = import_st_chat_into_group(
            &state,
            json!({
                "chatId": "target-chat",
                "file": uploaded_jsonl_file(
                    "branch.jsonl",
                    r#"{"character_name":"Bot","mes":"hello"}"#
                )
            }),
        )
        .expect_err("message storage failure should reject branch import");

        assert_eq!(error.code, "io_error");
        let target = state
            .storage
            .get("chats", "target-chat")
            .expect("target chat should be readable")
            .expect("target chat should remain");
        assert!(
            target.get("groupId").is_none(),
            "failed branch import must restore the target chat without a generated groupId"
        );
        assert_eq!(
            state.storage.list("chats").unwrap().len(),
            1,
            "failed branch import must remove the created branch chat"
        );

        let _ = fs::remove_dir_all(app_root);
    }

    #[test]
    fn import_st_chat_into_existing_group_preserves_group_id_when_branch_import_fails() {
        let app_root = temp_path("branch-existing-group-rollback");
        let state = AppState::from_data_dir(&app_root, Vec::new())
            .expect("test app state should initialize");
        state
            .storage
            .create(
                "chats",
                json!({
                    "id": "target-chat",
                    "name": "Target Chat",
                    "mode": "conversation",
                    "groupId": "existing-group",
                    "metadata": {},
                    "characterIds": []
                }),
            )
            .expect("target chat should be created");
        block_collection_writes(&state, "messages");

        let error = import_st_chat_into_group(
            &state,
            json!({
                "chatId": "target-chat",
                "file": uploaded_jsonl_file(
                    "branch.jsonl",
                    r#"{"character_name":"Bot","mes":"hello"}"#
                )
            }),
        )
        .expect_err("message storage failure should reject branch import");

        assert_eq!(error.code, "io_error");
        let target = state
            .storage
            .get("chats", "target-chat")
            .expect("target chat should be readable")
            .expect("target chat should remain");
        assert_eq!(
            target.get("groupId").and_then(Value::as_str),
            Some("existing-group"),
            "failed branch import must preserve the existing group id"
        );

        let _ = fs::remove_dir_all(app_root);
    }

    #[test]
    fn import_persona_avatar_file_rolls_back_avatar_when_persona_write_fails() {
        let app_root = temp_path("persona-avatar-rollback");
        let source_root = temp_path("persona-source");
        fs::create_dir_all(&source_root).expect("source dir should be created");
        let source = source_root.join("persona.png");
        fs::write(&source, b"persona-avatar-bytes").expect("source fixture should be written");
        let state = AppState::from_data_dir(&app_root, Vec::new())
            .expect("test app state should initialize");
        block_collection_writes(&state, "personas");

        let error = import_persona_avatar_file(
            &state,
            &source,
            "Persona".to_string(),
            "description".to_string(),
        )
        .expect_err("persona storage failure should reject persona avatar import");

        assert_eq!(error.code, "io_error");
        assert!(
            !app_root.join("avatars").join("personas").exists(),
            "failed persona avatar import must remove the managed avatar file"
        );

        let _ = fs::remove_dir_all(app_root);
        let _ = fs::remove_dir_all(source_root);
    }

    #[test]
    fn run_st_bulk_import_continues_after_stale_selected_items() {
        let app_root = temp_path("app");
        let st_root = temp_path("source");
        build_sillytavern_fixture(&st_root);
        let state = AppState::from_data_dir(&app_root, Vec::new())
            .expect("test app state should initialize");
        let (folder_path, folder_token) = folder_access(&st_root);
        let scan = scan_st_folder(json!({
            "folderPath": folder_path,
            "folderToken": folder_token,
        }))
        .expect("fixture scan should succeed");
        let mut characters = scan_ids(&scan, "characters");
        let mut backgrounds = scan_ids(&scan, "backgrounds");
        let mut personas = scan_ids(&scan, "personas");
        characters.push("characters:characters/missing.json".to_string());
        backgrounds.push("backgrounds:backgrounds/missing.png".to_string());
        personas.push("personas:User Avatars/missing.png".to_string());

        let mut events = Vec::new();
        let mut emit = |event| {
            events.push(event);
            Ok(())
        };
        let result = run_st_bulk_import_inner(
            &state,
            json!({
                "folderPath": folder_path,
                "folderToken": folder_token,
                "options": {
                    "characters": characters,
                    "backgrounds": backgrounds,
                    "personas": personas,
                }
            }),
            Some(&mut emit),
        )
        .expect("stale selected items should not abort the import");

        assert_eq!(result["success"], Value::Bool(true));
        assert_eq!(result["imported"]["characters"], json!(80));
        assert_eq!(result["imported"]["backgrounds"], json!(48));
        assert_eq!(result["imported"]["personas"], json!(2));
        assert_eq!(result["errors"].as_array().map(Vec::len), Some(3));
        let progress_events = events
            .iter()
            .filter(|event| event.get("type") == Some(&json!("progress")))
            .collect::<Vec<_>>();
        assert_eq!(progress_events.len(), 133);
        let last_progress = progress_events
            .last()
            .expect("bulk import should emit progress events");
        assert_eq!(last_progress["data"]["current"], json!(133));
        assert_eq!(last_progress["data"]["total"], json!(133));
        let personas = state
            .storage
            .list("personas")
            .expect("personas should be readable");
        let persona = personas.first().expect("a persona should be imported");
        let expected_asset_url_prefix = if cfg!(windows) {
            "http://asset.localhost/"
        } else {
            "asset://localhost/"
        };
        assert!(
            persona
                .get("avatarPath")
                .and_then(Value::as_str)
                .is_some_and(|value| value.starts_with(expected_asset_url_prefix)),
            "persona avatars should be stored as managed asset URLs"
        );
        assert!(
            persona.get("avatar").and_then(Value::as_str).is_none(),
            "persona imports should not duplicate avatar bytes into the avatar field"
        );

        let _ = fs::remove_dir_all(app_root);
        let _ = fs::remove_dir_all(st_root);
    }
}
