use super::*;

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

#[derive(Clone, Copy)]
enum SpriteRestoreOwnerKind {
    Character,
    Persona,
}

pub(super) fn restore_sprites(
    state: &AppState,
    target_id: &str,
    sprites: Option<&Value>,
) -> AppResult<usize> {
    restore_sprites_for_owner(state, target_id, sprites, SpriteRestoreOwnerKind::Character)
}

pub(super) fn restore_persona_sprites(
    state: &AppState,
    target_id: &str,
    sprites: Option<&Value>,
) -> AppResult<usize> {
    restore_sprites_for_owner(state, target_id, sprites, SpriteRestoreOwnerKind::Persona)
}

fn restore_sprites_for_owner(
    state: &AppState,
    target_id: &str,
    sprites: Option<&Value>,
    owner_kind: SpriteRestoreOwnerKind,
) -> AppResult<usize> {
    let Some(items) = sprites.and_then(Value::as_array) else {
        return Ok(0);
    };
    if items.is_empty() || target_id.contains('/') || target_id.contains('\\') {
        return Ok(0);
    }
    let dir = match owner_kind {
        SpriteRestoreOwnerKind::Character => state.data_dir.join("sprites").join(target_id),
        SpriteRestoreOwnerKind::Persona => state
            .data_dir
            .join("sprites")
            .join("personas")
            .join(target_id),
    };
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
        let Ok((mime, bytes)) = decode_image_payload(image, "sprite") else {
            continue;
        };
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

pub(super) fn restore_character_gallery(
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
        crate::storage_commands::entity_commands::storage_create_inner(
            state,
            "character-gallery".to_string(),
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
