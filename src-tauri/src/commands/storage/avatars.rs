use super::media_uploads::{
    decode_image_payload, managed_record_file_path, persist_image_upload, remove_copied_file_path,
    remove_managed_record_file, safe_filename,
};
use super::*;
use image::ImageFormat;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

const AVATAR_THUMBNAIL_SIZES: &[u32] = &[64, 96, 128, 256];
const MAX_INLINE_AVATAR_THUMBNAIL_BYTES: usize = 20 * 1024 * 1024;

pub(crate) fn update_character_avatar(
    state: &AppState,
    collection: &str,
    id: &str,
    body: Value,
) -> AppResult<Value> {
    update_character_avatar_inner(state, collection, id, body, || {})
}

fn update_character_avatar_inner<F>(
    state: &AppState,
    collection: &str,
    id: &str,
    body: Value,
    before_live_patch: F,
) -> AppResult<Value>
where
    F: FnOnce(),
{
    let previous = shared::get_required(state, collection, id)?;
    let stored = persist_image_upload(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        id,
        &body,
        "avatar",
    )?;
    let created_snapshot = if collection == "characters" {
        match super::characters::create_character_version_snapshot_from_record(
            state,
            id,
            &previous,
            "manual",
            "Avatar update",
        ) {
            Ok(snapshot) => Some(snapshot),
            Err(error) => {
                remove_copied_file_path(Some(&stored.absolute_path), "rolled-back avatar upload");
                return Err(error);
            }
        }
    } else {
        None
    };
    before_live_patch();
    let updated = match state.storage.patch(
        collection,
        id,
        json!({
            "avatar": stored.asset_url,
            "avatarPath": stored.asset_url,
            "avatarFilePath": stored.absolute_path,
            "avatarFilename": stored.filename,
            "avatarUpdatedAt": now_iso()
        }),
    ) {
        Ok(updated) => updated,
        Err(error) => {
            let rollback_error = super::characters::rollback_character_version_snapshot(
                state,
                created_snapshot.as_ref(),
                "character avatar update",
                &error,
            )
            .err();
            remove_copied_file_path(Some(&stored.absolute_path), "rolled-back avatar upload");
            return Err(rollback_error.unwrap_or(error));
        }
    };
    remove_avatar_file_preserving_persona_snapshots(state, collection, &previous);
    Ok(updated)
}

pub(crate) fn remove_character_avatar(state: &AppState, id: &str) -> AppResult<Value> {
    remove_character_avatar_inner(state, id, || {})
}

fn remove_character_avatar_inner<F>(
    state: &AppState,
    id: &str,
    before_live_patch: F,
) -> AppResult<Value>
where
    F: FnOnce(),
{
    let previous = shared::get_required(state, "characters", id)?;
    let patch = character_avatar_remove_patch(&previous)?;
    if patch.is_empty() {
        return Ok(previous);
    }

    let created_snapshot = super::characters::create_character_version_snapshot_from_record(
        state,
        id,
        &previous,
        "manual",
        "Avatar removal",
    )?;
    before_live_patch();
    let updated = match state.storage.patch("characters", id, Value::Object(patch)) {
        Ok(updated) => updated,
        Err(error) => {
            let rollback_error = super::characters::rollback_character_version_snapshot(
                state,
                Some(&created_snapshot),
                "character avatar removal",
                &error,
            )
            .err();
            return Err(rollback_error.unwrap_or(error));
        }
    };
    remove_avatar_file(state, "characters", &previous);
    Ok(updated)
}

fn character_avatar_remove_patch(record: &Value) -> AppResult<Map<String, Value>> {
    let mut patch = Map::new();
    for field in [
        "avatar",
        "avatarPath",
        "avatarFilePath",
        "avatarFilename",
        "avatarUpdatedAt",
    ] {
        if record.get(field).is_some_and(|value| !value.is_null()) {
            patch.insert(field.to_string(), Value::Null);
        }
    }
    if let Some(data) = character_data_without_avatar_crop(record)? {
        patch.insert("data".to_string(), data);
    }
    Ok(patch)
}

fn character_data_without_avatar_crop(record: &Value) -> AppResult<Option<Value>> {
    let Some(data) = record.get("data") else {
        return Ok(None);
    };
    let mut data = shared::normalize_character_data_for_storage(data)?;
    let Some(data_object) = data.as_object_mut() else {
        unreachable!("character data normalizer only returns objects");
    };
    let Some(extensions) = data_object
        .get_mut("extensions")
        .and_then(Value::as_object_mut)
    else {
        return Ok(None);
    };
    if extensions.remove("avatarCrop").is_some() {
        Ok(Some(data))
    } else {
        Ok(None)
    }
}

pub(crate) fn remove_avatar_file(state: &AppState, collection: &str, record: &Value) {
    remove_avatar_thumbnail_files(state, collection, record);
    remove_managed_record_file(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        record,
        "avatarFilePath",
        "avatarFilename",
    )
}

pub(crate) fn remove_avatar_file_preserving_persona_snapshots(
    state: &AppState,
    collection: &str,
    record: &Value,
) {
    if collection == "personas" {
        match persona_avatar_referenced_by_messages(state, record) {
            Ok(true) => return,
            Ok(false) => {}
            Err(error) => {
                log::warn!(
                    "skipping persona avatar cleanup because message snapshots could not be scanned: {error}"
                );
                return;
            }
        }
    }
    remove_avatar_file(state, collection, record);
}

fn persona_avatar_referenced_by_messages(state: &AppState, record: &Value) -> AppResult<bool> {
    let Some(record_id) = record.get("id").and_then(Value::as_str) else {
        return Ok(false);
    };
    let persona_id = record_id.trim();
    if persona_id.is_empty() {
        return Ok(false);
    }

    let url_candidates: HashSet<String> = ["avatar", "avatarPath", "avatarUrl"]
        .into_iter()
        .filter_map(|field| record.get(field).and_then(Value::as_str))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect();
    let file_path = record
        .get("avatarFilePath")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let messages = state.storage.list("messages")?;
    Ok(messages.iter().any(|message| {
        let Some(snapshot) = message
            .get("extra")
            .and_then(message_persona_snapshot_object)
        else {
            return false;
        };
        if snapshot
            .get("personaId")
            .and_then(Value::as_str)
            .is_none_or(|value| value.trim() != persona_id)
        {
            return false;
        }
        // A snapshot may carry the avatar reference under any of the URL-like fields the persona
        // contract emits, not just `avatarUrl`. Checking only one let a still-referenced avatar
        // look unused (and risk having its file cleaned up).
        if ["avatarUrl", "avatarPath", "avatar"]
            .iter()
            .filter_map(|field| snapshot.get(*field).and_then(Value::as_str))
            .map(str::trim)
            .any(|value| !value.is_empty() && url_candidates.contains(value))
        {
            return true;
        }
        if file_path.is_some_and(|path| {
            snapshot
                .get("avatarFilePath")
                .and_then(Value::as_str)
                .map(str::trim)
                == Some(path)
        }) {
            return true;
        }
        false
    }))
}

fn message_persona_snapshot_object(value: &Value) -> Option<Map<String, Value>> {
    match value {
        Value::Object(object) => object
            .get("personaSnapshot")
            .and_then(Value::as_object)
            .cloned(),
        Value::String(text) => serde_json::from_str::<Value>(text).ok().and_then(|parsed| {
            parsed
                .get("personaSnapshot")
                .and_then(Value::as_object)
                .cloned()
        }),
        _ => None,
    }
}

fn remove_avatar_thumbnail_files(state: &AppState, collection: &str, record: &Value) {
    let Ok(Some(path)) = managed_record_file_path(
        state,
        &format!("avatars/{}", safe_filename(collection)),
        record,
        "avatarFilePath",
        "avatarFilename",
    ) else {
        return;
    };
    let Ok(source) = fs::canonicalize(path) else {
        return;
    };
    let Ok(avatars_root) = canonical_avatar_root(state) else {
        return;
    };
    let Ok(relative) = source.strip_prefix(avatars_root) else {
        return;
    };
    for size in AVATAR_THUMBNAIL_SIZES {
        for target in avatar_thumbnail_removal_targets(state, *size, relative) {
            if target.is_file() {
                let _ = fs::remove_file(target);
            }
        }
    }
}

pub(crate) fn avatar_thumbnail_file_path(
    state: &AppState,
    filename: Option<&str>,
    absolute_path: Option<&str>,
    source_url: Option<&str>,
    size: Option<u32>,
) -> AppResult<Value> {
    let thumbnail = if filename.is_some_and(|value| !value.trim().is_empty())
        || absolute_path.is_some_and(|value| !value.trim().is_empty())
    {
        let source = avatar_source_path(state, filename, absolute_path)?;
        avatar_thumbnail_path_for_source(state, &source, size.unwrap_or(128))?
    } else if let Some(source_url) = source_url.filter(|value| !value.trim().is_empty()) {
        avatar_thumbnail_path_for_inline_source(state, source_url, size.unwrap_or(128))?
    } else {
        return Err(AppError::invalid_input(
            "Avatar filename or path is required",
        ));
    };
    Ok(json!({ "path": thumbnail.to_string_lossy() }))
}

pub(crate) fn avatar_thumbnail_path_for_source(
    state: &AppState,
    source: &Path,
    size: u32,
) -> AppResult<PathBuf> {
    if !AVATAR_THUMBNAIL_SIZES.contains(&size) {
        return Err(AppError::invalid_input("Unsupported avatar thumbnail size"));
    }
    let source = fs::canonicalize(source).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => AppError::not_found("Avatar asset was not found"),
        _ => AppError::from(error),
    })?;
    let avatars_root = canonical_avatar_root(state)?;
    if !source.starts_with(&avatars_root) {
        return Err(AppError::invalid_input(
            "Avatar thumbnail source is outside managed avatars",
        ));
    }
    if !is_resizable_avatar_file(&source) {
        return Ok(source);
    }

    let relative = source.strip_prefix(&avatars_root).map_err(|_| {
        AppError::invalid_input("Avatar thumbnail source is outside managed avatars")
    })?;
    let target = avatar_thumbnail_target_path(state, size, relative);

    if avatar_thumbnail_is_fresh(&source, &target)? {
        return Ok(target);
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    write_avatar_thumbnail(&source, &target, size)?;
    Ok(target)
}

fn avatar_thumbnail_target_path(state: &AppState, size: u32, relative: &Path) -> PathBuf {
    let mut target = state
        .data_dir
        .join(".avatar-thumbnails")
        .join(size.to_string())
        .join(relative);
    let filename = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "avatar".to_string());
    target.set_file_name(format!("{filename}.thumb.png"));
    target
}

fn legacy_avatar_thumbnail_target_path(state: &AppState, size: u32, relative: &Path) -> PathBuf {
    let mut target = state
        .data_dir
        .join(".avatar-thumbnails")
        .join(size.to_string())
        .join(relative);
    target.set_extension("png");
    target
}

fn avatar_thumbnail_removal_targets(state: &AppState, size: u32, relative: &Path) -> [PathBuf; 2] {
    [
        avatar_thumbnail_target_path(state, size, relative),
        legacy_avatar_thumbnail_target_path(state, size, relative),
    ]
}

fn write_avatar_thumbnail(source: &Path, target: &Path, size: u32) -> AppResult<()> {
    let image = image::open(source).map_err(|error| {
        AppError::invalid_input(format!("Avatar thumbnail could not be decoded: {error}"))
    })?;
    write_avatar_thumbnail_image(image, target, size)
}

fn write_avatar_thumbnail_image(
    image: image::DynamicImage,
    target: &Path,
    size: u32,
) -> AppResult<()> {
    let temp = avatar_thumbnail_temp_path(target);
    image
        .thumbnail(size, size)
        .save_with_format(&temp, ImageFormat::Png)
        .map_err(|error| {
            let _ = fs::remove_file(&temp);
            AppError::new("avatar_thumbnail_error", error.to_string())
        })?;
    replace_avatar_thumbnail_file(&temp, target).map_err(|error| {
        let _ = fs::remove_file(&temp);
        AppError::from(error)
    })
}

fn avatar_thumbnail_temp_path(target: &Path) -> PathBuf {
    let filename = target
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "avatar.thumb.png".to_string());
    target.with_file_name(format!(".{filename}.{}.tmp", new_id()))
}

fn replace_avatar_thumbnail_file(temp: &Path, target: &Path) -> std::io::Result<()> {
    match fs::rename(temp, target) {
        Ok(()) => Ok(()),
        Err(_) if target.exists() => {
            let _ = fs::remove_file(target);
            fs::rename(temp, target)
        }
        Err(error) => Err(error),
    }
}

fn avatar_thumbnail_path_for_inline_source(
    state: &AppState,
    source_url: &str,
    size: u32,
) -> AppResult<PathBuf> {
    if !AVATAR_THUMBNAIL_SIZES.contains(&size) {
        return Err(AppError::invalid_input("Unsupported avatar thumbnail size"));
    }
    let source_url = inline_avatar_data_url(source_url).ok_or_else(|| {
        AppError::invalid_input("Avatar thumbnail source must be inline image data")
    })?;
    let (mime, bytes) = decode_image_payload(source_url, "avatarPath")?;
    if !is_resizable_avatar_mime(&mime) {
        return Err(AppError::invalid_input(
            "Avatar thumbnail source uses an unsupported image type",
        ));
    }
    if bytes.len() > MAX_INLINE_AVATAR_THUMBNAIL_BYTES {
        return Err(AppError::invalid_input(
            "Avatar thumbnail source is too large",
        ));
    }

    let hash = inline_avatar_thumbnail_hash(source_url);
    let target = state
        .data_dir
        .join(".avatar-thumbnails")
        .join(size.to_string())
        .join("inline")
        .join(format!("{hash}.thumb.png"));
    if target.is_file() {
        return Ok(target);
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let image = image::load_from_memory(&bytes).map_err(|error| {
        AppError::invalid_input(format!("Avatar thumbnail could not be decoded: {error}"))
    })?;
    write_avatar_thumbnail_image(image, &target, size)?;
    Ok(target)
}

fn inline_avatar_data_url(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    if trimmed.to_ascii_lowercase().starts_with("data:image/") {
        return Some(trimmed);
    }
    let (_, rest) = trimmed.split_once("://")?;
    if rest.to_ascii_lowercase().starts_with("data:image/") {
        return Some(rest);
    }
    None
}

fn inline_avatar_thumbnail_hash(source_url: &str) -> String {
    let digest = Sha256::digest(source_url.as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn avatar_source_path(
    state: &AppState,
    filename: Option<&str>,
    absolute_path: Option<&str>,
) -> AppResult<PathBuf> {
    if let Some(path) = absolute_path.filter(|value| !value.trim().is_empty()) {
        return avatar_source_candidate(state, PathBuf::from(path));
    }
    let filename = filename
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::invalid_input("Avatar filename or path is required"))?;
    avatar_source_candidate(
        state,
        state
            .data_dir
            .join("avatars")
            .join("characters")
            .join(safe_filename(filename)),
    )
}

fn avatar_source_candidate(state: &AppState, candidate: PathBuf) -> AppResult<PathBuf> {
    let source = fs::canonicalize(candidate).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => AppError::not_found("Avatar asset was not found"),
        _ => AppError::from(error),
    })?;
    let avatars_root = canonical_avatar_root(state)?;
    if !source.starts_with(avatars_root) {
        return Err(AppError::invalid_input(
            "Avatar asset path is outside managed avatars",
        ));
    }
    Ok(source)
}

fn canonical_avatar_root(state: &AppState) -> AppResult<PathBuf> {
    let root = state.data_dir.join("avatars");
    fs::create_dir_all(&root)?;
    fs::canonicalize(root).map_err(AppError::from)
}

fn is_resizable_avatar_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "png" | "jpg" | "jpeg" | "webp" | "gif"
    )
}

fn is_resizable_avatar_mime(mime: &str) -> bool {
    matches!(
        mime.to_ascii_lowercase().as_str(),
        "image/png" | "image/jpeg" | "image/jpg" | "image/webp" | "image/gif"
    )
}

fn avatar_thumbnail_is_fresh(source: &Path, target: &Path) -> AppResult<bool> {
    let source_modified = fs::metadata(source)?.modified()?;
    let Ok(target_modified) = fs::metadata(target).and_then(|metadata| metadata.modified()) else {
        return Ok(false);
    };
    Ok(target_modified >= source_modified)
}

pub(crate) fn update_npc_avatar(state: &AppState, chat_id: &str, body: Value) -> AppResult<Value> {
    let name = body
        .get("name")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("npc")
        .to_string();
    let stored = persist_image_upload(
        state,
        "avatars/npc",
        &format!("{chat_id}-{name}"),
        &body,
        "avatar",
    )?;
    // Mirror update_character_avatar_inner's prior-file cleanup: NPC avatars are not
    // tracked records, so there is no `previous` to read. Instead remove any older files
    // for this chat+name that the regen just superseded (every regen writes a new
    // timestamped filename and never overwrites), keeping only the file just written.
    remove_superseded_npc_avatar_files(state, chat_id, &name, &stored.filename);
    Ok(json!({
        "chatId": chat_id,
        "name": name,
        "avatarPath": stored.asset_url,
        "avatarFilePath": stored.absolute_path,
        "avatarFilename": stored.filename
    }))
}

/// Best-effort cleanup of older NPC avatar files for one chat+name, preserving the
/// freshly written `keep_filename`. Stored NPC filenames are
/// `{safe_filename(chat_id-name)}-{millis}[-N].{ext}`, so the same-name prefix is
/// `safe_filename("{chat_id}-{name}")` followed by the `-` millis delimiter (which keeps
/// "Rin" from matching "Rina"). Failures are logged and ignored — this is disk hygiene.
fn remove_superseded_npc_avatar_files(
    state: &AppState,
    chat_id: &str,
    name: &str,
    keep_filename: &str,
) {
    let prefix = format!("{}-", safe_filename(&format!("{chat_id}-{name}")));
    remove_npc_avatar_files_matching(state, |filename| {
        filename != keep_filename && filename.starts_with(&prefix)
    });
}

/// Remove every file directly under `avatars/npc` whose filename satisfies `keep`.
/// Best-effort: a missing directory or per-file removal error is logged and skipped so
/// callers (re-upload cleanup, chat delete) never fail on disk hygiene.
pub(crate) fn remove_npc_avatar_files_matching<F>(state: &AppState, matches: F)
where
    F: Fn(&str) -> bool,
{
    let dir = state.data_dir.join("avatars").join("npc");
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => {
            log::warn!("could not scan {} for NPC avatar cleanup: {error}", dir.display());
            return;
        }
    };
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(filename) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !matches(filename) {
            continue;
        }
        if let Err(error) = fs::remove_file(&path) {
            log::warn!("could not remove NPC avatar {}: {error}", path.display());
        }
    }
}

/// Remove all NPC avatar files belonging to the given chat ids. NPC filenames are
/// prefixed with `{chat_id}-` (chat ids are UUIDs, so no chat id is a prefix of another),
/// letting chat deletion clean files that are referenced only inline in chat metadata.
pub(crate) fn remove_npc_avatar_files_for_chats(state: &AppState, chat_ids: &HashSet<String>) {
    if chat_ids.is_empty() {
        return;
    }
    let prefixes: Vec<String> = chat_ids.iter().map(|id| format!("{id}-")).collect();
    remove_npc_avatar_files_matching(state, |filename| {
        prefixes.iter().any(|prefix| filename.starts_with(prefix))
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-avatars-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn small_png_data_url() -> &'static str {
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lTmZsgAAAABJRU5ErkJggg=="
    }

    fn create_character_with_managed_avatar(state: &AppState, filename: &str) -> PathBuf {
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let avatar_path = avatar_dir.join(filename);
        let (_, avatar_bytes) =
            decode_image_payload(small_png_data_url(), "avatar").expect("tiny png should decode");
        std::fs::write(&avatar_path, &avatar_bytes).expect("avatar should be written");
        let avatar_path_string = avatar_path.to_string_lossy().to_string();

        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": {
                        "name": "Rina",
                        "description": "Original",
                        "character_version": "1.0"
                    },
                    "comment": "Original title",
                    "avatar": format!("http://asset.localhost/{filename}"),
                    "avatarPath": format!("http://asset.localhost/{filename}"),
                    "avatarFilePath": avatar_path_string,
                    "avatarFilename": filename
                }),
            )
            .expect("character should be created");

        avatar_path
    }

    fn assert_managed_avatar_upload(value: &Value, collection: &str) {
        let avatar_path = value
            .get("avatarPath")
            .and_then(Value::as_str)
            .expect("avatarPath should be present");
        assert!(
            !avatar_path.starts_with("data:image/"),
            "avatarPath should be a managed asset URL, not inline data"
        );
        assert_eq!(
            value.get("avatar").and_then(Value::as_str),
            value.get("avatarPath").and_then(Value::as_str)
        );
        let avatar_file_path = value
            .get("avatarFilePath")
            .and_then(Value::as_str)
            .expect("avatarFilePath should be present");
        let normalized_file_path = avatar_file_path.replace('\\', "/");
        assert!(
            normalized_file_path.contains(&format!("avatars/{collection}")),
            "avatar file should be stored under managed {collection} avatars"
        );
        assert!(
            Path::new(avatar_file_path).is_file(),
            "managed avatar file should exist"
        );
        assert!(
            value
                .get("avatarFilename")
                .and_then(Value::as_str)
                .is_some_and(|filename| !filename.trim().is_empty()),
            "avatarFilename should be present"
        );
    }

    #[test]
    fn character_avatar_upload_stores_managed_asset_url() {
        let state = test_state("character-avatar-upload-managed");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": { "name": "Rina" }
                }),
            )
            .expect("character should be created");

        let updated = update_character_avatar(
            &state,
            "characters",
            "char-1",
            json!({ "avatar": small_png_data_url() }),
        )
        .expect("avatar should update");

        assert_managed_avatar_upload(&updated, "characters");
    }

    #[test]
    fn persona_avatar_upload_stores_managed_asset_url() {
        let state = test_state("persona-avatar-upload-managed");
        state
            .storage
            .create(
                "personas",
                json!({
                    "id": "persona-1",
                    "name": "Xel"
                }),
            )
            .expect("persona should be created");

        let updated = update_character_avatar(
            &state,
            "personas",
            "persona-1",
            json!({ "avatar": small_png_data_url() }),
        )
        .expect("avatar should update");

        assert_managed_avatar_upload(&updated, "personas");
    }

    #[test]
    fn npc_avatar_upload_returns_managed_asset_url() {
        let state = test_state("npc-avatar-upload-managed");

        let updated = update_npc_avatar(
            &state,
            "chat-1",
            json!({
                "name": "Rina",
                "avatar": small_png_data_url()
            }),
        )
        .expect("npc avatar should update");

        let avatar_path = updated
            .get("avatarPath")
            .and_then(Value::as_str)
            .expect("avatarPath should be present");
        assert!(
            !avatar_path.starts_with("data:image/"),
            "NPC avatarPath should be a managed asset URL, not inline data"
        );
        assert!(
            avatar_path.starts_with("asset://localhost")
                || avatar_path.starts_with("http://asset.localhost"),
            "NPC avatarPath should point at the managed asset file"
        );
        let avatar_file_path = updated
            .get("avatarFilePath")
            .and_then(Value::as_str)
            .expect("avatarFilePath should be present");
        assert!(Path::new(avatar_file_path).is_file());
    }

    #[test]
    fn persona_avatar_update_removes_unreferenced_previous_file() {
        let state = test_state("persona-avatar-unreferenced-cleanup");
        state
            .storage
            .create(
                "personas",
                json!({
                    "id": "persona-1",
                    "name": "Xel"
                }),
            )
            .expect("persona should be created");

        let first = update_character_avatar(
            &state,
            "personas",
            "persona-1",
            json!({ "avatar": small_png_data_url(), "filename": "first.png" }),
        )
        .expect("first avatar should update");
        let old_path = first
            .get("avatarFilePath")
            .and_then(Value::as_str)
            .expect("first avatar path should be stored")
            .to_string();

        update_character_avatar(
            &state,
            "personas",
            "persona-1",
            json!({ "avatar": small_png_data_url(), "filename": "second.png" }),
        )
        .expect("second avatar should update");

        assert!(
            !Path::new(&old_path).exists(),
            "unreferenced previous persona avatar should still be cleaned up"
        );
    }

    #[test]
    fn persona_avatar_update_preserves_message_snapshot_file() {
        let state = test_state("persona-avatar-snapshot-preserve");
        state
            .storage
            .create(
                "personas",
                json!({
                    "id": "persona-1",
                    "name": "Xel"
                }),
            )
            .expect("persona should be created");

        let first = update_character_avatar(
            &state,
            "personas",
            "persona-1",
            json!({ "avatar": small_png_data_url(), "filename": "first.png" }),
        )
        .expect("first avatar should update");
        let old_path = first
            .get("avatarFilePath")
            .and_then(Value::as_str)
            .expect("first avatar path should be stored")
            .to_string();
        let old_filename = first
            .get("avatarFilename")
            .and_then(Value::as_str)
            .expect("first avatar filename should be stored")
            .to_string();
        let old_url = first
            .get("avatarPath")
            .and_then(Value::as_str)
            .expect("first avatar URL should be stored")
            .to_string();
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "msg-1",
                    "chatId": "chat-1",
                    "role": "user",
                    "content": "hello",
                    "extra": {
                        "personaSnapshot": {
                            "personaId": "persona-1",
                            "name": "Xel",
                            "avatarUrl": old_url,
                            "avatarFilePath": old_path,
                            "avatarFilename": old_filename
                        }
                    }
                }),
            )
            .expect("message snapshot should be created");

        update_character_avatar(
            &state,
            "personas",
            "persona-1",
            json!({ "avatar": small_png_data_url(), "filename": "second.png" }),
        )
        .expect("second avatar should update");

        assert!(
            Path::new(&old_path).is_file(),
            "persona avatar referenced by a message snapshot should remain available"
        );
    }

    #[test]
    fn persona_avatar_update_ignores_filename_only_snapshot_match() {
        let state = test_state("persona-avatar-filename-only");
        state
            .storage
            .create(
                "personas",
                json!({
                    "id": "persona-1",
                    "name": "Xel"
                }),
            )
            .expect("persona should be created");

        let first = update_character_avatar(
            &state,
            "personas",
            "persona-1",
            json!({ "avatar": small_png_data_url(), "filename": "same-name.png" }),
        )
        .expect("first avatar should update");
        let old_path = first
            .get("avatarFilePath")
            .and_then(Value::as_str)
            .expect("first avatar path should be stored")
            .to_string();
        let old_filename = first
            .get("avatarFilename")
            .and_then(Value::as_str)
            .expect("first avatar filename should be stored")
            .to_string();
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "msg-1",
                    "chatId": "chat-1",
                    "role": "user",
                    "content": "hello",
                    "extra": {
                        "personaSnapshot": {
                            "personaId": "persona-1",
                            "name": "Xel",
                            "avatarFilename": old_filename
                        }
                    }
                }),
            )
            .expect("message snapshot should be created");

        update_character_avatar(
            &state,
            "personas",
            "persona-1",
            json!({ "avatar": small_png_data_url(), "filename": "second.png" }),
        )
        .expect("second avatar should update");

        assert!(
            !Path::new(&old_path).exists(),
            "filename-only snapshot matches should not preserve unrelated avatar files"
        );
    }

    #[test]
    fn persona_avatar_update_preserves_snapshot_referenced_by_avatar_path() {
        let state = test_state("persona-avatar-snapshot-avatar-path");
        state
            .storage
            .create(
                "personas",
                json!({
                    "id": "persona-1",
                    "name": "Xel"
                }),
            )
            .expect("persona should be created");

        let first = update_character_avatar(
            &state,
            "personas",
            "persona-1",
            json!({ "avatar": small_png_data_url(), "filename": "first.png" }),
        )
        .expect("first avatar should update");
        let old_path = first
            .get("avatarFilePath")
            .and_then(Value::as_str)
            .expect("first avatar path should be stored")
            .to_string();
        let old_url = first
            .get("avatarPath")
            .and_then(Value::as_str)
            .expect("first avatar URL should be stored")
            .to_string();
        // The snapshot references the avatar only through `avatarPath` — no `avatarUrl` and no
        // matching `avatarFilePath` — so preservation must come from the broadened URL-field scan
        // rather than the file-path fallback. Before that broadening this snapshot looked unused
        // and the still-referenced file was cleaned up.
        state
            .storage
            .create(
                "messages",
                json!({
                    "id": "msg-1",
                    "chatId": "chat-1",
                    "role": "user",
                    "content": "hello",
                    "extra": {
                        "personaSnapshot": {
                            "personaId": "persona-1",
                            "name": "Xel",
                            "avatarPath": old_url
                        }
                    }
                }),
            )
            .expect("message snapshot should be created");

        update_character_avatar(
            &state,
            "personas",
            "persona-1",
            json!({ "avatar": small_png_data_url(), "filename": "second.png" }),
        )
        .expect("second avatar should update");

        assert!(
            Path::new(&old_path).is_file(),
            "persona avatar referenced by a snapshot's avatarPath should remain available"
        );
    }

    #[test]
    fn character_avatar_update_snapshot_copies_previous_managed_avatar() {
        let state = test_state("character-avatar-version");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let old_avatar_path = avatar_dir.join("old.png");
        let (_, old_avatar_bytes) =
            decode_image_payload(small_png_data_url(), "avatar").expect("tiny png should decode");
        std::fs::write(&old_avatar_path, &old_avatar_bytes).expect("old avatar should be written");
        let old_avatar_path = old_avatar_path.to_string_lossy().to_string();

        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": {
                        "name": "Rina",
                        "description": "Original",
                        "character_version": "1.0"
                    },
                    "comment": "Original title",
                    "avatar": "http://asset.localhost/old.png",
                    "avatarPath": "http://asset.localhost/old.png",
                    "avatarFilePath": old_avatar_path,
                    "avatarFilename": "old.png"
                }),
            )
            .expect("character should be created");

        update_character_avatar(
            &state,
            "characters",
            "char-1",
            json!({ "avatar": small_png_data_url() }),
        )
        .expect("avatar should update");

        let versions = state
            .storage
            .list("character-versions")
            .expect("versions should list");
        assert_eq!(versions.len(), 1);
        let version_avatar_url = versions[0]["avatarPath"]
            .as_str()
            .expect("version avatar URL should be stored");
        assert!(
            !version_avatar_url.starts_with("data:image/"),
            "version snapshots should not store inline avatar data"
        );
        assert!(
            version_avatar_url.starts_with("asset://localhost")
                || version_avatar_url.starts_with("http://asset.localhost"),
            "version snapshots should store a managed asset URL"
        );
        let version_avatar_path = versions[0]["avatarFilePath"]
            .as_str()
            .expect("version avatar file path should be stored");
        assert_ne!(
            version_avatar_path, old_avatar_path,
            "version snapshot should own a copied avatar file"
        );
        assert!(
            !Path::new(&old_avatar_path).exists(),
            "replaced character avatar file should still be cleaned up"
        );
        assert_eq!(
            std::fs::read(version_avatar_path).expect("version avatar copy should exist"),
            old_avatar_bytes
        );

        let version_id = versions[0]
            .get("id")
            .and_then(Value::as_str)
            .expect("version should have id");
        let restored =
            super::super::characters::restore_character_version(&state, "char-1", version_id)
                .expect("version should restore");

        let restored_avatar_path = restored["avatarFilePath"]
            .as_str()
            .expect("restored live avatar file path should be stored");
        assert_ne!(
            restored_avatar_path, version_avatar_path,
            "restoring a version should copy the version avatar into a live-owned file"
        );
        assert_eq!(
            std::fs::read(restored_avatar_path).expect("restored live avatar copy should exist"),
            old_avatar_bytes
        );
        assert!(
            restored["avatarFilename"]
                .as_str()
                .is_some_and(|value| value.starts_with("restored-char-1-")),
            "restored live avatar should have a distinct live-owned filename"
        );
        assert!(
            Path::new(version_avatar_path).is_file(),
            "version avatar copy should remain available after restore"
        );

        update_character_avatar(
            &state,
            "characters",
            "char-1",
            json!({ "avatar": small_png_data_url(), "filename": "latest.png" }),
        )
        .expect("replacing restored avatar should update");

        assert!(
            !Path::new(restored_avatar_path).exists(),
            "replacing the restored live avatar should clean up only the live-owned copy"
        );
        assert!(
            Path::new(version_avatar_path).is_file(),
            "replacing the restored live avatar must not delete the saved version avatar copy"
        );
    }

    #[test]
    fn character_avatar_snapshot_preserves_metadata_when_managed_copy_is_missing() {
        let state = test_state("character-avatar-version-missing-file");
        let missing_path = state
            .data_dir
            .join("avatars")
            .join("characters")
            .join("missing.png")
            .to_string_lossy()
            .to_string();
        let record = json!({
            "id": "char-1",
            "data": { "name": "Rina" },
            "avatar": "http://asset.localhost/missing.png",
            "avatarPath": "http://asset.localhost/missing.png",
            "avatarFilePath": missing_path,
            "avatarFilename": "missing.png"
        });

        let snapshot = super::super::characters::create_character_version_snapshot_from_record(
            &state,
            "char-1",
            &record,
            "manual",
            "Avatar update",
        )
        .expect("version snapshot should still be created");

        assert_eq!(snapshot["avatarPath"], "http://asset.localhost/missing.png");
        assert_eq!(snapshot["avatarFilePath"], record["avatarFilePath"]);
        assert_eq!(snapshot["avatarFilename"], "missing.png");
    }

    #[test]
    fn character_avatar_update_fails_before_cleanup_when_snapshot_copy_is_invalid() {
        let state = test_state("character-avatar-version-invalid-file");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let corrupt_avatar_path = avatar_dir.join("corrupt.png");
        std::fs::write(&corrupt_avatar_path, b"not an image").expect("corrupt avatar should write");
        let corrupt_avatar_path = corrupt_avatar_path.to_string_lossy().to_string();

        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": { "name": "Rina" },
                    "avatar": "http://asset.localhost/corrupt.png",
                    "avatarPath": "http://asset.localhost/corrupt.png",
                    "avatarFilePath": corrupt_avatar_path,
                    "avatarFilename": "corrupt.png"
                }),
            )
            .expect("character should be created");

        let error = update_character_avatar(
            &state,
            "characters",
            "char-1",
            json!({ "avatar": small_png_data_url(), "filename": "new.png" }),
        )
        .expect_err("invalid previous avatar should fail snapshot creation");

        assert_eq!(error.code, "character_version_avatar_copy_error");
        assert!(
            Path::new(&corrupt_avatar_path).is_file(),
            "failed snapshot copy must leave the previous avatar file in place"
        );
        assert!(
            state
                .storage
                .list("character-versions")
                .expect("versions should list")
                .is_empty(),
            "failed snapshot copy must not create a broken version row"
        );
        let remaining_files = std::fs::read_dir(&avatar_dir)
            .expect("avatar dir should list")
            .filter_map(Result::ok)
            .filter(|entry| entry.path().is_file())
            .count();
        assert_eq!(
            remaining_files, 1,
            "failed snapshot copy should roll back the newly uploaded avatar file"
        );
    }

    #[test]
    fn character_avatar_update_rolls_back_snapshot_when_live_patch_fails() {
        let state = test_state("character-avatar-patch-failure-rollback");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let old_avatar_path = avatar_dir.join("old.png");
        let (_, old_avatar_bytes) =
            decode_image_payload(small_png_data_url(), "avatar").expect("tiny png should decode");
        std::fs::write(&old_avatar_path, &old_avatar_bytes).expect("old avatar should be written");
        let old_avatar_path_string = old_avatar_path.to_string_lossy().to_string();

        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "char-1",
                    "data": {
                        "name": "Rina",
                        "description": "Original",
                        "character_version": "1.0"
                    },
                    "comment": "Original title",
                    "avatar": "http://asset.localhost/old.png",
                    "avatarPath": "http://asset.localhost/old.png",
                    "avatarFilePath": old_avatar_path_string,
                    "avatarFilename": "old.png"
                }),
            )
            .expect("character should be created");

        let error = update_character_avatar_inner(
            &state,
            "characters",
            "char-1",
            json!({ "avatar": small_png_data_url(), "filename": "new.png" }),
            || {
                state
                    .storage
                    .delete("characters", "char-1")
                    .expect("live character should delete before final patch");
            },
        )
        .expect_err("avatar update should fail when the live patch misses");

        assert_eq!(error.code, "not_found");
        assert!(
            state
                .storage
                .list("character-versions")
                .expect("versions should list")
                .is_empty(),
            "failed avatar update must not leave a version row"
        );
        assert!(
            old_avatar_path.is_file(),
            "failed avatar update must leave the previous avatar file in place"
        );
        let remaining_files = std::fs::read_dir(&avatar_dir)
            .expect("avatar dir should list")
            .filter_map(Result::ok)
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter(|name| name != "old.png")
            .collect::<Vec<_>>();
        assert!(
            remaining_files.is_empty(),
            "failed avatar update should remove uploaded and snapshot files: {remaining_files:?}"
        );
    }

    #[test]
    fn character_avatar_removal_rolls_back_snapshot_when_live_patch_fails() {
        let state = test_state("character-avatar-removal-patch-failure-rollback");
        let old_avatar_path = create_character_with_managed_avatar(&state, "old.png");
        let avatar_dir = old_avatar_path
            .parent()
            .expect("managed avatar should have a parent")
            .to_path_buf();

        let error = remove_character_avatar_inner(&state, "char-1", || {
            state
                .storage
                .delete("characters", "char-1")
                .expect("live character should delete before final patch");
        })
        .expect_err("avatar removal should fail when the live patch misses");

        assert_eq!(error.code, "not_found");
        assert!(
            state
                .storage
                .list("character-versions")
                .expect("versions should list")
                .is_empty(),
            "failed avatar removal must not leave a version row"
        );
        assert!(
            old_avatar_path.is_file(),
            "failed avatar removal must leave the previous live avatar file in place"
        );
        let remaining_files = std::fs::read_dir(&avatar_dir)
            .expect("avatar dir should list")
            .filter_map(Result::ok)
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter(|name| name != "old.png")
            .collect::<Vec<_>>();
        assert!(
            remaining_files.is_empty(),
            "failed avatar removal should remove the snapshot copy: {remaining_files:?}"
        );
    }

    #[test]
    fn character_avatar_removal_reports_rollback_error_when_snapshot_delete_fails() {
        let state = test_state("character-avatar-removal-rollback-failure-contract");
        let old_avatar_path = create_character_with_managed_avatar(&state, "old.png");
        let snapshot_avatar_path = std::cell::RefCell::new(None::<String>);

        let error = remove_character_avatar_inner(&state, "char-1", || {
            let snapshot = state
                .storage
                .list("character-versions")
                .expect("versions should list")
                .into_iter()
                .find(|version| {
                    version.get("reason").and_then(Value::as_str) == Some("Avatar removal")
                })
                .expect("snapshot should exist before final patch");
            let snapshot_id = snapshot
                .get("id")
                .and_then(Value::as_str)
                .expect("snapshot should have id")
                .to_string();
            *snapshot_avatar_path.borrow_mut() = snapshot
                .get("avatarFilePath")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned);
            super::super::characters::force_character_version_snapshot_rollback_failure(
                &snapshot_id,
            );
            state
                .storage
                .delete("characters", "char-1")
                .expect("live character should delete before final patch");
        })
        .expect_err("avatar removal should surface rollback failure");

        assert_eq!(error.code, "character_version_snapshot_rollback_error");
        let details = error
            .details
            .as_ref()
            .and_then(Value::as_object)
            .expect("rollback error should include details");
        assert_eq!(
            details.get("operation").and_then(Value::as_str),
            Some("character avatar removal")
        );
        assert_eq!(
            details
                .get("livePatchError")
                .and_then(|value| value.get("code"))
                .and_then(Value::as_str),
            Some("not_found")
        );
        assert_eq!(
            details
                .get("rollbackError")
                .and_then(|value| value.get("code"))
                .and_then(Value::as_str),
            Some("forced_rollback_error")
        );
        assert_eq!(
            state
                .storage
                .list("character-versions")
                .expect("versions should list")
                .len(),
            1,
            "forced rollback failure leaves the row visible while surfacing a hard error"
        );
        let snapshot_avatar_path = snapshot_avatar_path
            .into_inner()
            .expect("snapshot avatar path should be captured");
        assert!(
            Path::new(&snapshot_avatar_path).is_file(),
            "forced rollback failure keeps the snapshot avatar because the row still references it"
        );
        assert!(
            old_avatar_path.is_file(),
            "failed avatar removal must leave the previous live avatar file in place"
        );
    }

    #[test]
    fn avatar_thumbnail_file_path_creates_managed_cache_without_overwriting_source() {
        let state = test_state("thumbnail");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let avatar_path = avatar_dir.join("large.png");
        let image = image::RgbaImage::from_pixel(320, 240, image::Rgba([255, 0, 0, 255]));
        image
            .save(&avatar_path)
            .expect("avatar fixture should write");

        let response = avatar_thumbnail_file_path(
            &state,
            Some("large.png"),
            Some(&avatar_path.to_string_lossy()),
            None,
            Some(128),
        )
        .expect("thumbnail should be generated");
        let thumbnail = PathBuf::from(response["path"].as_str().expect("path should be returned"));

        assert!(thumbnail.starts_with(state.data_dir.join(".avatar-thumbnails/128/characters")));
        assert!(thumbnail.is_file());
        assert_eq!(
            image::image_dimensions(&thumbnail).expect("thumbnail should decode"),
            (128, 96)
        );
        assert_eq!(
            image::image_dimensions(&avatar_path).expect("source should decode"),
            (320, 240)
        );
    }

    #[test]
    fn avatar_thumbnail_file_path_keeps_source_extension_in_cache_key() {
        let state = test_state("thumbnail-extension-key");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let png_path = avatar_dir.join("same-name.png");
        let jpg_path = avatar_dir.join("same-name.jpg");
        image::RgbImage::from_pixel(320, 240, image::Rgb([255, 0, 0]))
            .save(&png_path)
            .expect("png fixture should write");
        image::RgbImage::from_pixel(240, 320, image::Rgb([0, 0, 255]))
            .save(&jpg_path)
            .expect("jpg fixture should write");

        let png_response = avatar_thumbnail_file_path(
            &state,
            Some("same-name.png"),
            Some(&png_path.to_string_lossy()),
            None,
            Some(128),
        )
        .expect("png thumbnail should be generated");
        let jpg_response = avatar_thumbnail_file_path(
            &state,
            Some("same-name.jpg"),
            Some(&jpg_path.to_string_lossy()),
            None,
            Some(128),
        )
        .expect("jpg thumbnail should be generated");
        let png_thumbnail = PathBuf::from(
            png_response["path"]
                .as_str()
                .expect("png path should be returned"),
        );
        let jpg_thumbnail = PathBuf::from(
            jpg_response["path"]
                .as_str()
                .expect("jpg path should be returned"),
        );

        assert_ne!(png_thumbnail, jpg_thumbnail);
        assert_eq!(
            png_thumbnail.file_name().and_then(|value| value.to_str()),
            Some("same-name.png.thumb.png")
        );
        assert_eq!(
            jpg_thumbnail.file_name().and_then(|value| value.to_str()),
            Some("same-name.jpg.thumb.png")
        );
        assert_eq!(
            image::image_dimensions(&png_thumbnail).expect("png thumbnail should decode"),
            (128, 96)
        );
        assert_eq!(
            image::image_dimensions(&jpg_thumbnail).expect("jpg thumbnail should decode"),
            (96, 128)
        );
    }

    #[test]
    fn avatar_thumbnail_file_path_resizes_gif_avatar() {
        let state = test_state("thumbnail-gif");
        let avatar_dir = state.data_dir.join("avatars").join("characters");
        std::fs::create_dir_all(&avatar_dir).expect("avatar dir should be created");
        let avatar_path = avatar_dir.join("animated.gif");
        image::RgbaImage::from_pixel(320, 240, image::Rgba([255, 0, 255, 255]))
            .save(&avatar_path)
            .expect("gif fixture should write");

        let response = avatar_thumbnail_file_path(
            &state,
            Some("animated.gif"),
            Some(&avatar_path.to_string_lossy()),
            None,
            Some(128),
        )
        .expect("gif thumbnail should be generated");
        let thumbnail = PathBuf::from(response["path"].as_str().expect("path should be returned"));

        assert_ne!(thumbnail, avatar_path);
        assert_eq!(
            thumbnail.file_name().and_then(|value| value.to_str()),
            Some("animated.gif.thumb.png")
        );
        assert_eq!(
            image::image_dimensions(&thumbnail).expect("gif thumbnail should decode"),
            (128, 96)
        );
    }

    #[test]
    fn avatar_thumbnail_file_path_rejects_sources_outside_managed_avatars() {
        let state = test_state("thumbnail-outside");
        let outside = state.data_dir.join("outside.png");
        let image = image::RgbaImage::from_pixel(1, 1, image::Rgba([0, 0, 0, 255]));
        image.save(&outside).expect("outside fixture should write");

        let error = avatar_thumbnail_file_path(
            &state,
            None,
            Some(&outside.to_string_lossy()),
            None,
            Some(128),
        )
        .expect_err("outside source should be rejected");

        assert_eq!(error.code, "invalid_input");
    }

    #[test]
    fn avatar_thumbnail_file_path_resizes_inline_data_url_avatar() {
        let state = test_state("thumbnail-inline");
        let image = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            320,
            240,
            image::Rgba([0, 255, 0, 255]),
        ));
        let mut buffer = Cursor::new(Vec::new());
        image
            .write_to(&mut buffer, ImageFormat::Png)
            .expect("inline fixture should encode");
        let data_url = format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(buffer.into_inner())
        );

        let response = avatar_thumbnail_file_path(&state, None, None, Some(&data_url), Some(128))
            .expect("inline thumbnail should be generated");
        let thumbnail = PathBuf::from(response["path"].as_str().expect("path should be returned"));

        assert!(thumbnail.starts_with(state.data_dir.join(".avatar-thumbnails/128/inline")));
        assert!(thumbnail.is_file());
        assert_eq!(
            image::image_dimensions(&thumbnail).expect("thumbnail should decode"),
            (128, 96)
        );
    }

    #[test]
    fn avatar_thumbnail_file_path_accepts_scheme_wrapped_inline_data_url_avatar() {
        let state = test_state("thumbnail-wrapped-inline");
        let image = image::DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            240,
            320,
            image::Rgba([0, 0, 255, 255]),
        ));
        let mut buffer = Cursor::new(Vec::new());
        image
            .write_to(&mut buffer, ImageFormat::Png)
            .expect("inline fixture should encode");
        let data_url = format!(
            "asset://data:image/png;base64,{}",
            general_purpose::STANDARD.encode(buffer.into_inner())
        );

        let response = avatar_thumbnail_file_path(&state, None, None, Some(&data_url), Some(128))
            .expect("wrapped inline thumbnail should be generated");
        let thumbnail = PathBuf::from(response["path"].as_str().expect("path should be returned"));

        assert!(thumbnail.starts_with(state.data_dir.join(".avatar-thumbnails/128/inline")));
        assert_eq!(
            image::image_dimensions(&thumbnail).expect("thumbnail should decode"),
            (96, 128)
        );
    }
}
