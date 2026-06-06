use super::images::percent_encode_component;
use super::media_uploads::{persist_image_upload, remove_managed_record_file, safe_filename};
use super::shared::decode_path;
use super::*;

const LOREBOOK_IMAGE_PREFIX: &str = "marinara-lorebook-image:";

pub(crate) fn update_lorebook_image(
    state: &AppState,
    lorebook_id: &str,
    body: Value,
) -> AppResult<Value> {
    let previous = get_required_lorebook(state, lorebook_id)?;
    let stored = persist_image_upload(state, "lorebooks/images", lorebook_id, &body, "image")?;
    let updated = state.storage.patch(
        "lorebooks",
        lorebook_id,
        json!({
            "imagePath": format!("{LOREBOOK_IMAGE_PREFIX}{}", percent_encode_component(&stored.filename)),
            "imageFilePath": stored.absolute_path,
            "imageFilename": stored.filename,
            "imageUpdatedAt": now_iso()
        }),
    )?;
    remove_lorebook_image_file(state, &previous);
    Ok(updated)
}

pub(crate) fn remove_lorebook_image_file(state: &AppState, record: &Value) {
    if let Some(filename) = record.get("imageFilename").and_then(Value::as_str) {
        managed_thumbnails::remove_managed_thumbnail_files(
            state,
            managed_thumbnails::ManagedThumbnailKind::Lorebook,
            filename,
        );
    }
    remove_managed_record_file(
        state,
        "lorebooks/images",
        record,
        "imageFilePath",
        "imageFilename",
    )
}

pub(crate) fn lorebook_image_file_path(
    state: &AppState,
    encoded_filename: &str,
) -> AppResult<Value> {
    let filename = safe_filename(&decode_path(encoded_filename));
    let path = state
        .data_dir
        .join("lorebooks")
        .join("images")
        .join(filename);
    if !path.exists() || !path.is_file() {
        return Err(AppError::not_found("Lorebook image was not found"));
    }
    Ok(json!({ "path": path.to_string_lossy() }))
}

fn get_required_lorebook(state: &AppState, lorebook_id: &str) -> AppResult<Value> {
    state
        .storage
        .get("lorebooks", lorebook_id)?
        .ok_or_else(|| AppError::not_found(format!("lorebooks/{lorebook_id} was not found")))
}
