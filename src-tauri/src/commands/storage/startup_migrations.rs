use super::{
    media_uploads::{
        decode_image_payload, extension_for_image_mime, file_path_asset_url, safe_filename,
        unique_file_path,
    },
    message_swipes,
};
use marinara_core::{new_id, now_iso, AppError, AppResult};
use marinara_storage::FileStorage;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

const INLINE_AVATAR_FIELDS: &[&str] = &["avatarPath", "avatar", "avatarUrl"];
const INLINE_NPC_AVATAR_FIELDS: &[&str] = &["avatarUrl", "avatarPath", "avatar", "image"];
const INLINE_TRACKER_AVATAR_FIELDS: &[&str] = &["avatarPath"];
const INLINE_ATTACHMENT_SOURCE_FIELDS: &[&str] = &["url", "imageUrl", "data"];
const INLINE_ATTACHMENT_URL_FIELDS: &[&str] = &["url", "imageUrl"];

struct MigratedInlineImageReference {
    stored_value: String,
    absolute_path: String,
    filename: String,
}

struct InlineAttachmentBackfillContext<'a> {
    data_dir: &'a Path,
    chat_id: &'a str,
    message_id: &'a str,
    gallery_rows: &'a mut Vec<Value>,
    gallery_urls: &'a mut HashMap<String, String>,
    created_files: &'a mut Vec<PathBuf>,
}

pub(crate) fn migrate_inline_image_references(
    storage: &FileStorage,
    data_dir: &Path,
) -> AppResult<()> {
    migrate_inline_avatar_collection(storage, data_dir, "characters", "avatars/characters")?;
    migrate_inline_avatar_collection(storage, data_dir, "personas", "avatars/personas")?;
    migrate_inline_gallery_collection(storage, data_dir, "gallery")?;
    migrate_inline_gallery_collection(storage, data_dir, "character-gallery")?;
    let mut gallery_urls = gallery_url_lookup(storage)?;
    migrate_inline_chat_hot_image_references(storage, data_dir)?;
    migrate_inline_snapshot_present_character_references(storage, data_dir)?;
    migrate_inline_message_attachment_references(storage, data_dir, &mut gallery_urls)?;
    migrate_inline_message_swipe_attachment_references(storage, data_dir, &mut gallery_urls)
}

fn migrate_inline_avatar_collection(
    storage: &FileStorage,
    data_dir: &Path,
    collection: &str,
    folder: &str,
) -> AppResult<()> {
    let mut created_files = Vec::new();
    let result = (|| -> AppResult<()> {
        let mut rows = storage.list(collection)?;
        let mut changed = false;
        for row in &mut rows {
            let Some(object) = row.as_object_mut() else {
                continue;
            };
            let Some(data_url) = inline_image_field(object, INLINE_AVATAR_FIELDS) else {
                continue;
            };
            let fallback = format!("{collection}-avatar");
            let hint = inline_image_filename_hint(object, &fallback);
            let Some(reference) = persist_inline_image_reference(
                data_dir,
                folder,
                &hint,
                &data_url,
                collection,
                &mut created_files,
            )?
            else {
                continue;
            };
            object.insert(
                "avatarPath".to_string(),
                Value::String(reference.stored_value.clone()),
            );
            for field in ["avatar", "avatarUrl"] {
                if object.contains_key(field) {
                    object.insert(
                        field.to_string(),
                        Value::String(reference.stored_value.clone()),
                    );
                }
            }
            object.insert(
                "avatarFilePath".to_string(),
                Value::String(reference.absolute_path),
            );
            object.insert(
                "avatarFilename".to_string(),
                Value::String(reference.filename),
            );
            changed = true;
        }
        if changed {
            storage.replace_all(collection, rows)?;
        }
        Ok(())
    })();
    if result.is_err() {
        rollback_created_files(&created_files);
    }
    result
}

fn migrate_inline_gallery_collection(
    storage: &FileStorage,
    data_dir: &Path,
    collection: &str,
) -> AppResult<()> {
    let mut created_files = Vec::new();
    let result = (|| -> AppResult<()> {
        let mut rows = storage.list(collection)?;
        let mut changed = false;
        for row in &mut rows {
            let Some(object) = row.as_object_mut() else {
                continue;
            };
            let Some(data_url) = inline_image_string(object.get("url")) else {
                continue;
            };
            let hint = inline_image_filename_hint(object, "gallery-image");
            let Some(reference) = persist_inline_image_reference(
                data_dir,
                "gallery",
                &hint,
                &data_url,
                collection,
                &mut created_files,
            )?
            else {
                continue;
            };
            object.insert("url".to_string(), Value::String(reference.stored_value));
            object.insert(
                "filePath".to_string(),
                Value::String(reference.absolute_path),
            );
            object.insert("filename".to_string(), Value::String(reference.filename));
            changed = true;
        }
        if changed {
            storage.replace_all(collection, rows)?;
        }
        Ok(())
    })();
    if result.is_err() {
        rollback_created_files(&created_files);
    }
    result
}

fn gallery_url_lookup(storage: &FileStorage) -> AppResult<HashMap<String, String>> {
    let mut urls = HashMap::new();
    for row in storage.list("gallery")? {
        let Some(id) = row
            .get("id")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        let Some(url) = row
            .get("url")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .filter(|value| !is_inline_image_data_url(value))
        else {
            continue;
        };
        urls.insert(id.to_string(), url.to_string());
    }
    Ok(urls)
}

fn migrate_inline_chat_hot_image_references(
    storage: &FileStorage,
    data_dir: &Path,
) -> AppResult<()> {
    let mut created_files = Vec::new();
    let result = (|| -> AppResult<()> {
        let mut rows = storage.list("chats")?;
        let mut changed = false;
        for row in &mut rows {
            let Some(object) = row.as_object_mut() else {
                continue;
            };
            let mut row_changed = false;
            if let Some(game_state) = object.get_mut("gameState") {
                row_changed |=
                    migrate_inline_present_characters(data_dir, game_state, &mut created_files)?;
            }
            if let Some(metadata) = object.get_mut("metadata").and_then(Value::as_object_mut) {
                if let Some(game_npcs) = metadata.get_mut("gameNpcs") {
                    row_changed |= migrate_inline_avatar_array(
                        data_dir,
                        "avatars/npc",
                        game_npcs,
                        INLINE_NPC_AVATAR_FIELDS,
                        "game-npc",
                        &mut created_files,
                    )?;
                }
                if let Some(game_state) = metadata.get_mut("gameState") {
                    row_changed |= migrate_inline_present_characters(
                        data_dir,
                        game_state,
                        &mut created_files,
                    )?;
                }
            }
            changed |= row_changed;
        }
        if changed {
            storage.replace_all("chats", rows)?;
        }
        Ok(())
    })();
    if result.is_err() {
        rollback_created_files(&created_files);
    }
    result
}

fn migrate_inline_snapshot_present_character_references(
    storage: &FileStorage,
    data_dir: &Path,
) -> AppResult<()> {
    let mut created_files = Vec::new();
    let result = (|| -> AppResult<()> {
        let mut rows = storage.list("game-state-snapshots")?;
        let mut changed = false;
        for row in &mut rows {
            changed |= migrate_inline_present_characters(data_dir, row, &mut created_files)?;
        }
        if changed {
            storage.replace_all("game-state-snapshots", rows)?;
        }
        Ok(())
    })();
    if result.is_err() {
        rollback_created_files(&created_files);
    }
    result
}

fn migrate_inline_present_characters(
    data_dir: &Path,
    value: &mut Value,
    created_files: &mut Vec<PathBuf>,
) -> AppResult<bool> {
    let Some(object) = value.as_object_mut() else {
        return Ok(false);
    };
    let Some(present_characters) = object.get_mut("presentCharacters") else {
        return Ok(false);
    };
    migrate_inline_avatar_array(
        data_dir,
        "avatars/npc",
        present_characters,
        INLINE_TRACKER_AVATAR_FIELDS,
        "tracker-character",
        created_files,
    )
}

fn migrate_inline_avatar_array(
    data_dir: &Path,
    folder: &str,
    value: &mut Value,
    fields: &[&str],
    fallback_prefix: &str,
    created_files: &mut Vec<PathBuf>,
) -> AppResult<bool> {
    let Some(items) = value.as_array_mut() else {
        return Ok(false);
    };
    let mut changed = false;
    for (index, item) in items.iter_mut().enumerate() {
        let Some(object) = item.as_object_mut() else {
            continue;
        };
        let Some(data_url) = inline_image_field(object, fields) else {
            continue;
        };
        let fallback = format!("{fallback_prefix}-{}", index + 1);
        let hint = inline_image_filename_hint(object, &fallback);
        let Some(reference) = persist_inline_image_reference(
            data_dir,
            folder,
            &hint,
            &data_url,
            fallback_prefix,
            created_files,
        )?
        else {
            continue;
        };
        object.insert(
            fields[0].to_string(),
            Value::String(reference.stored_value.clone()),
        );
        for field in fields.iter().skip(1) {
            if object.contains_key(*field) {
                object.insert(
                    field.to_string(),
                    Value::String(reference.stored_value.clone()),
                );
            }
        }
        object.insert(
            "avatarFilePath".to_string(),
            Value::String(reference.absolute_path),
        );
        object.insert(
            "avatarFilename".to_string(),
            Value::String(reference.filename),
        );
        changed = true;
    }
    Ok(changed)
}

fn migrate_inline_message_attachment_references(
    storage: &FileStorage,
    data_dir: &Path,
    gallery_urls: &mut HashMap<String, String>,
) -> AppResult<()> {
    let mut created_files = Vec::new();
    let mut local_gallery_urls = gallery_urls.clone();
    let result = (|| -> AppResult<()> {
        let mut rows = storage.list("messages")?;
        let mut gallery_rows = storage.list("gallery")?;
        let mut changed = false;
        for row in &mut rows {
            let Some(object) = row.as_object_mut() else {
                continue;
            };
            let chat_id = object
                .get("chatId")
                .and_then(Value::as_str)
                .map(str::trim)
                .unwrap_or_default()
                .to_string();
            let message_id = object
                .get("id")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("message")
                .to_string();
            let mut row_changed = false;
            if let Some(attachments) = object.get_mut("attachments") {
                let mut context = InlineAttachmentBackfillContext {
                    data_dir,
                    chat_id: &chat_id,
                    message_id: &message_id,
                    gallery_rows: &mut gallery_rows,
                    gallery_urls: &mut local_gallery_urls,
                    created_files: &mut created_files,
                };
                row_changed |= migrate_inline_attachment_array(&mut context, attachments)?;
            }
            if let Some(extra) = object.get_mut("extra").and_then(Value::as_object_mut) {
                if let Some(attachments) = extra.get_mut("attachments") {
                    let mut context = InlineAttachmentBackfillContext {
                        data_dir,
                        chat_id: &chat_id,
                        message_id: &message_id,
                        gallery_rows: &mut gallery_rows,
                        gallery_urls: &mut local_gallery_urls,
                        created_files: &mut created_files,
                    };
                    row_changed |= migrate_inline_attachment_array(&mut context, attachments)?;
                }
            }
            if let Some(swipes) = object.get_mut("swipes").and_then(Value::as_array_mut) {
                for swipe in swipes {
                    let Some(swipe_object) = swipe.as_object_mut() else {
                        continue;
                    };
                    let Some(extra) = swipe_object.get_mut("extra").and_then(Value::as_object_mut)
                    else {
                        continue;
                    };
                    if let Some(attachments) = extra.get_mut("attachments") {
                        let mut context = InlineAttachmentBackfillContext {
                            data_dir,
                            chat_id: &chat_id,
                            message_id: &message_id,
                            gallery_rows: &mut gallery_rows,
                            gallery_urls: &mut local_gallery_urls,
                            created_files: &mut created_files,
                        };
                        row_changed |= migrate_inline_attachment_array(&mut context, attachments)?;
                    }
                }
            }
            changed |= row_changed;
        }
        if changed {
            storage.replace_all_many(vec![("messages", rows), ("gallery", gallery_rows)])?;
            *gallery_urls = local_gallery_urls;
        }
        Ok(())
    })();
    if result.is_err() {
        rollback_created_files(&created_files);
    }
    result
}

fn migrate_inline_message_swipe_attachment_references(
    storage: &FileStorage,
    data_dir: &Path,
    gallery_urls: &mut HashMap<String, String>,
) -> AppResult<()> {
    let mut created_files = Vec::new();
    let mut local_gallery_urls = gallery_urls.clone();
    let result = (|| -> AppResult<()> {
        let mut rows = storage.list(message_swipes::COLLECTION)?;
        let mut gallery_rows = storage.list("gallery")?;
        let mut changed = false;
        for row in &mut rows {
            let Some(object) = row.as_object_mut() else {
                continue;
            };
            let chat_id = object
                .get("chatId")
                .and_then(Value::as_str)
                .map(str::trim)
                .unwrap_or_default()
                .to_string();
            let message_id = object
                .get("messageId")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("message")
                .to_string();
            let Some(extra) = object.get_mut("extra").and_then(Value::as_object_mut) else {
                continue;
            };
            let Some(attachments) = extra.get_mut("attachments") else {
                continue;
            };
            let mut context = InlineAttachmentBackfillContext {
                data_dir,
                chat_id: &chat_id,
                message_id: &message_id,
                gallery_rows: &mut gallery_rows,
                gallery_urls: &mut local_gallery_urls,
                created_files: &mut created_files,
            };
            changed |= migrate_inline_attachment_array(&mut context, attachments)?;
        }
        if changed {
            storage.replace_all_many(vec![
                (message_swipes::COLLECTION, rows),
                ("gallery", gallery_rows),
            ])?;
            *gallery_urls = local_gallery_urls;
        }
        Ok(())
    })();
    if result.is_err() {
        rollback_created_files(&created_files);
    }
    result
}

fn migrate_inline_attachment_array(
    context: &mut InlineAttachmentBackfillContext<'_>,
    value: &mut Value,
) -> AppResult<bool> {
    let Some(attachments) = value.as_array_mut() else {
        return Ok(false);
    };
    let mut changed = false;
    for (index, attachment) in attachments.iter_mut().enumerate() {
        let Some(object) = attachment.as_object_mut() else {
            continue;
        };
        let Some(data_url) = inline_image_field(object, INLINE_ATTACHMENT_SOURCE_FIELDS) else {
            continue;
        };
        let stored = if let Some(url) = attachment_gallery_url(object, context.gallery_urls) {
            Some(url)
        } else {
            stage_gallery_row_for_inline_attachment(context, index, object, &data_url)?
        };
        let Some(stored_url) = stored else {
            continue;
        };
        object.insert("url".to_string(), Value::String(stored_url.clone()));
        for field in INLINE_ATTACHMENT_URL_FIELDS {
            if object
                .get(*field)
                .and_then(Value::as_str)
                .is_some_and(|value| value.trim() == data_url)
            {
                object.insert(field.to_string(), Value::String(stored_url.clone()));
            }
        }
        if object
            .get("data")
            .and_then(Value::as_str)
            .is_some_and(|value| value.trim() == data_url)
        {
            object.insert("data".to_string(), Value::Null);
        }
        changed = true;
    }
    Ok(changed)
}

fn attachment_gallery_url(
    attachment: &Map<String, Value>,
    gallery_urls: &HashMap<String, String>,
) -> Option<String> {
    attachment
        .get("galleryId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .and_then(|id| gallery_urls.get(id))
        .filter(|url| !is_inline_image_data_url(url))
        .cloned()
}

fn stage_gallery_row_for_inline_attachment(
    context: &mut InlineAttachmentBackfillContext<'_>,
    index: usize,
    attachment: &mut Map<String, Value>,
    data_url: &str,
) -> AppResult<Option<String>> {
    if context.chat_id.trim().is_empty() {
        return Ok(None);
    }
    let hint = attachment_filename_hint(attachment, context.message_id, index);
    let Some(reference) = persist_inline_image_reference(
        context.data_dir,
        "gallery",
        &hint,
        data_url,
        "message attachment",
        context.created_files,
    )?
    else {
        return Ok(None);
    };
    let gallery_id = unique_gallery_id(context.gallery_rows);
    let now = now_iso();
    let record = json!({
        "id": gallery_id,
        "chatId": context.chat_id,
        "filePath": reference.absolute_path.clone(),
        "filename": reference.filename.clone(),
        "url": reference.stored_value.clone(),
        "prompt": attachment.get("prompt").cloned().unwrap_or(Value::Null),
        "provider": attachment.get("provider").cloned().unwrap_or(Value::Null),
        "model": attachment.get("model").cloned().unwrap_or(Value::Null),
        "width": attachment.get("width").cloned().unwrap_or(Value::Null),
        "height": attachment.get("height").cloned().unwrap_or(Value::Null),
        "createdAt": now.clone(),
        "updatedAt": now,
        "kind": "attachment-backfill"
    });
    context.gallery_rows.push(record);
    attachment.insert("galleryId".to_string(), Value::String(gallery_id.clone()));
    context
        .gallery_urls
        .insert(gallery_id, reference.stored_value.clone());
    attachment.insert(
        "filePath".to_string(),
        Value::String(reference.absolute_path.clone()),
    );
    attachment.insert(
        "filename".to_string(),
        Value::String(reference.filename.clone()),
    );
    Ok(Some(reference.stored_value))
}

fn unique_gallery_id(gallery_rows: &[Value]) -> String {
    loop {
        let id = new_id();
        if !gallery_rows
            .iter()
            .any(|row| row.get("id").and_then(Value::as_str) == Some(id.as_str()))
        {
            return id;
        }
    }
}

fn inline_image_field(object: &Map<String, Value>, fields: &[&str]) -> Option<String> {
    for field in fields {
        if let Some(data_url) = inline_image_string(object.get(*field)) {
            return Some(data_url);
        }
    }
    None
}

fn inline_image_string(value: Option<&Value>) -> Option<String> {
    let trimmed = value?.as_str()?.trim();
    if is_inline_image_data_url(trimmed) {
        Some(trimmed.to_string())
    } else {
        None
    }
}

fn is_inline_image_data_url(value: &str) -> bool {
    value
        .trim_start()
        .to_ascii_lowercase()
        .starts_with("data:image/")
}

fn persist_inline_image_reference(
    data_dir: &Path,
    folder: &str,
    filename_hint: &str,
    data_url: &str,
    context: &str,
    created_files: &mut Vec<PathBuf>,
) -> AppResult<Option<MigratedInlineImageReference>> {
    let (mime, bytes) = match decode_image_payload(data_url, context) {
        Ok(decoded) => decoded,
        Err(error) => {
            log::warn!(
                "skipping invalid inline image during startup migration for {context}: {error}"
            );
            return Ok(None);
        }
    };
    let ext = extension_for_image_mime(&mime).unwrap_or("png");
    let dir = data_dir.join(folder);
    fs::create_dir_all(&dir)?;
    let filename = inline_image_filename(filename_hint, ext);
    let target = unique_file_path(&dir.join(filename))?;
    fs::write(&target, bytes)?;
    created_files.push(target.clone());
    let filename = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .ok_or_else(|| AppError::invalid_input("Inline image path is missing a filename"))?;
    Ok(Some(MigratedInlineImageReference {
        stored_value: file_path_asset_url(&target),
        absolute_path: target.to_string_lossy().to_string(),
        filename,
    }))
}

fn rollback_created_files(paths: &[PathBuf]) {
    for path in paths.iter().rev() {
        match fs::remove_file(path) {
            Ok(()) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => log::warn!(
                "failed to remove staged inline image migration file {}: {error}",
                path.display()
            ),
        }
    }
}

fn inline_image_filename(filename_hint: &str, ext: &str) -> String {
    let filename = safe_filename(filename_hint);
    if Path::new(&filename).extension().is_some() {
        filename
    } else {
        format!("{filename}.{ext}")
    }
}

fn inline_image_filename_hint(object: &Map<String, Value>, fallback: &str) -> String {
    for field in ["filename", "name", "id", "characterId", "chatId"] {
        if let Some(value) = object
            .get(field)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return value.to_string();
        }
    }
    if let Some(value) = object
        .get("data")
        .and_then(Value::as_object)
        .and_then(|data| data.get("name"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return value.to_string();
    }
    fallback.to_string()
}

fn attachment_filename_hint(
    attachment: &Map<String, Value>,
    message_id: &str,
    index: usize,
) -> String {
    for field in ["filename", "name"] {
        if let Some(value) = attachment
            .get(field)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return value.to_string();
        }
    }
    format!("{message_id}-attachment-{}", index + 1)
}
