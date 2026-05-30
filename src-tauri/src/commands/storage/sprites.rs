use super::images::{
    generate_image_with_options, image_generation_options, is_openai_gpt_image_model,
    prompt_override,
};
use super::shared::*;
use super::*;

use image::{DynamicImage, GenericImageView, ImageFormat, Rgba, RgbaImage};
use std::collections::VecDeque;
use std::env;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::Command;

const SPRITE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"];
const CLEANUP_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp"];

#[derive(Clone)]
struct SpritePlan {
    expressions: Vec<String>,
    appearance: String,
    cols: u32,
    rows: u32,
    sprite_type: String,
    generate_individually: bool,
    model: String,
    prompt: String,
    sheet_width: u32,
    sheet_height: u32,
}

struct SpriteCleanupOutput {
    bytes: Vec<u8>,
    engine: String,
}

#[derive(Clone, Copy, Eq, PartialEq)]
pub(crate) enum SpriteOwnerKind {
    Character,
    Persona,
}

impl SpriteOwnerKind {
    fn from_request(value: Option<&str>) -> AppResult<Self> {
        match value.map(str::trim) {
            None => Ok(Self::Character),
            Some("character") => Ok(Self::Character),
            Some("persona") => Ok(Self::Persona),
            _ => Err(AppError::invalid_input("Invalid sprite owner type")),
        }
    }

    fn owner_label(self) -> &'static str {
        match self {
            Self::Character => "character ID",
            Self::Persona => "persona ID",
        }
    }
}

#[derive(Clone)]
struct BackgroundRemoverCommand {
    command: PathBuf,
    args_prefix: Vec<String>,
    label: String,
    source: &'static str,
}

pub(crate) fn sprite_capabilities(state: &AppState) -> AppResult<Value> {
    let cleanup_engine = cleanup_engine_status(state);
    let background_remover = background_remover_status(state);
    Ok(json!({
        "imageProcessingAvailable": true,
        "spriteGenerationAvailable": true,
        "backgroundRemovalAvailable": true,
        "reason": Value::Null,
        "cleanupEngine": cleanup_engine,
        "backgroundRemover": background_remover
    }))
}

pub(crate) fn sprite_cleanup_status(state: &AppState) -> AppResult<Value> {
    let cleanup_engine = cleanup_engine_status(state);
    let background_remover = background_remover_status(state);
    Ok(json!({
        "available": true,
        "engine": cleanup_engine.get("engine").cloned().unwrap_or_else(|| json!("auto")),
        "installed": cleanup_engine.get("installed").and_then(Value::as_bool).unwrap_or(true),
        "source": cleanup_engine.get("source").cloned().unwrap_or(Value::Null),
        "reason": cleanup_engine.get("reason").cloned().unwrap_or(Value::Null),
        "cleanupEngine": cleanup_engine,
        "backgroundRemover": background_remover
    }))
}

pub(crate) async fn generate_sprite_sheet_preview(
    state: &AppState,
    body: Value,
) -> AppResult<Value> {
    validate_sprite_generation_body(state, &body)?;
    let connection_id = required_string(&body, "connectionId")?;
    let connection = get_required(state, "connections", connection_id)?;
    let plan = build_sprite_plan(&body, Some(&connection));
    if plan.should_generate_individually() {
        let items = plan
            .expressions
            .iter()
            .map(|expression| {
                let prompt = single_sprite_prompt(
                    &plan.sprite_type,
                    &plan.appearance,
                    expression,
                    &body,
                    &plan.model,
                );
                json!({
                    "id": sprite_prompt_review_id("expression", &plan.sprite_type, expression),
                    "kind": "sprite",
                    "title": format!("Expression: {}", expression.replace('_', " ")),
                    "prompt": prompt,
                    "width": 1024,
                    "height": 1024
                })
            })
            .collect::<Vec<_>>();
        return Ok(json!({ "items": items }));
    }
    Ok(json!({
        "items": [{
            "id": sprite_prompt_review_id("sheet", &plan.sprite_type, &format!("{}x{}-{}", plan.cols, plan.rows, plan.expressions.join(","))),
            "kind": "sprite",
            "title": if plan.sprite_type == "full-body" {
                format!("Full-body sprites: {}x{}", plan.cols, plan.rows)
            } else {
                format!("Expression sprites: {}x{}", plan.cols, plan.rows)
            },
            "prompt": plan.prompt,
            "width": plan.sheet_width,
            "height": plan.sheet_height
        }]
    }))
}

pub(crate) async fn generate_sprite_sheet(state: &AppState, body: Value) -> AppResult<Value> {
    validate_sprite_generation_body(state, &body)?;
    let connection_id = required_string(&body, "connectionId")?;
    let connection = get_required(state, "connections", connection_id)?;
    let image_options = image_generation_options(&body);
    let plan = build_sprite_plan(&body, Some(&connection));
    let reference_note = if image_options.reference_images.is_empty() {
        ""
    } else {
        " Use the provided reference image(s) to preserve face, hair, body, outfit, colors, and distinctive features."
    };

    if plan.should_generate_individually() {
        let mut cells = Vec::new();
        let mut failed = Vec::new();
        for expression in &plan.expressions {
            let prompt_id = sprite_prompt_review_id("expression", &plan.sprite_type, expression);
            let prompt = prompt_override(&body, &prompt_id).unwrap_or_else(|| {
                single_sprite_prompt(
                    &plan.sprite_type,
                    &plan.appearance,
                    expression,
                    &body,
                    &plan.model,
                )
            });
            match generate_image_with_options(
                &connection,
                &format!("{prompt}{reference_note}"),
                1024,
                1024,
                image_options.clone(),
            )
            .await
            {
                Ok((base64, _mime_type)) => {
                    let base64 = if body
                        .get("noBackground")
                        .and_then(Value::as_bool)
                        .unwrap_or(false)
                    {
                        general_purpose::STANDARD.encode(
                            cleanup_image_base64(
                                state,
                                &base64,
                                cleanup_strength(&body),
                                &cleanup_engine(&body),
                            )?
                            .bytes,
                        )
                    } else {
                        base64
                    };
                    cells.push(json!({ "expression": expression, "base64": base64 }));
                }
                Err(error) => {
                    failed.push(json!({ "expression": expression, "error": error.message }))
                }
            }
        }
        if cells.is_empty() {
            return Err(AppError::new(
                "sprite_generation_failed",
                "All expression generations failed",
            ));
        }
        return Ok(json!({
            "sheetBase64": "",
            "cells": cells,
            "failedExpressions": failed
        }));
    }

    let prompt_id = sprite_prompt_review_id(
        "sheet",
        &plan.sprite_type,
        &format!("{}x{}-{}", plan.cols, plan.rows, plan.expressions.join(",")),
    );
    let prompt = prompt_override(&body, &prompt_id).unwrap_or_else(|| plan.prompt.clone());
    let (sheet_base64, _mime_type) = generate_image_with_options(
        &connection,
        &format!("{prompt}{reference_note}"),
        plan.sheet_width as u64,
        plan.sheet_height as u64,
        image_options,
    )
    .await?;
    let sheet_base64 = if body
        .get("noBackground")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        general_purpose::STANDARD.encode(
            cleanup_image_base64(
                state,
                &sheet_base64,
                cleanup_strength(&body),
                &cleanup_engine(&body),
            )?
            .bytes,
        )
    } else {
        sheet_base64
    };
    let cells = slice_sprite_sheet(&sheet_base64, &plan)?;
    Ok(json!({ "sheetBase64": sheet_base64, "cells": cells }))
}

pub(crate) fn cleanup_generated_sprites(state: &AppState, body: Value) -> AppResult<Value> {
    let cells = body
        .get("cells")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| AppError::invalid_input("At least one cell is required"))?;
    let strength = cleanup_strength(&body);
    let requested_engine = cleanup_engine(&body);
    let mut processed = Vec::new();
    let mut background_remover_processed = 0usize;
    let mut builtin_processed = 0usize;
    for cell in cells {
        let expression = cell.get("expression").and_then(Value::as_str).unwrap_or("");
        let base64 = cell.get("base64").and_then(Value::as_str).ok_or_else(|| {
            AppError::invalid_input(format!("Invalid base64 image for expression: {expression}"))
        })?;
        let cleaned = cleanup_image_base64(state, base64, strength, &requested_engine)?;
        if cleaned.engine == "backgroundremover" {
            background_remover_processed += 1;
        } else {
            builtin_processed += 1;
        }
        processed.push(json!({
            "expression": expression,
            "base64": general_purpose::STANDARD.encode(cleaned.bytes)
        }));
    }
    Ok(json!({
        "cells": processed,
        "engine": requested_engine,
        "externalCleanupProcessed": background_remover_processed,
        "backgroundRemoverProcessed": background_remover_processed,
        "builtinProcessed": builtin_processed
    }))
}

pub(crate) fn list_sprites(
    state: &AppState,
    character_id: &str,
    owner_type: Option<&str>,
) -> AppResult<Value> {
    let owner_kind = SpriteOwnerKind::from_request(owner_type)?;
    let dir = sprites_dir(state, owner_kind, character_id)?;
    fs::create_dir_all(&dir)?;
    list_sprites_for_dir(&dir)
}

pub(crate) fn upload_sprite(
    state: &AppState,
    character_id: &str,
    body: Value,
    owner_type: Option<&str>,
) -> AppResult<Value> {
    let owner_kind = SpriteOwnerKind::from_request(owner_type)?;
    let dir = sprites_dir(state, owner_kind, character_id)?;
    let expression = body
        .get("expression")
        .and_then(Value::as_str)
        .map(normalize_sprite_expression)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::invalid_input("Expression label is required"))?;
    let image = body
        .get("image")
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::invalid_input("No image data provided"))?;
    let (bytes, ext) = decode_image_value(image)?;
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{expression}.{ext}"));
    fs::write(&path, bytes)?;
    sprite_info_from_path(&path)
}

pub(crate) fn upload_sprites(
    state: &AppState,
    character_id: &str,
    body: Value,
    owner_type: Option<&str>,
) -> AppResult<Value> {
    let owner_kind = SpriteOwnerKind::from_request(owner_type)?;
    let dir = sprites_dir(state, owner_kind, character_id)?;
    let uploads = body
        .get("sprites")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| AppError::invalid_input("At least one sprite is required"))?;
    fs::create_dir_all(&dir)?;
    let mut imported = 0usize;
    let mut failed = Vec::new();

    for item in uploads {
        let raw_expression = item.get("expression").and_then(Value::as_str).unwrap_or("");
        let expression = normalize_sprite_expression(raw_expression);
        if expression.is_empty() {
            failed.push(json!({
                "expression": raw_expression,
                "error": "Expression label is required"
            }));
            continue;
        }
        let Some(image) = item.get("image").and_then(Value::as_str) else {
            failed.push(json!({
                "expression": expression,
                "error": "No image data provided"
            }));
            continue;
        };
        let (bytes, ext) = match decode_image_value(image) {
            Ok(value) => value,
            Err(error) => {
                failed.push(json!({
                    "expression": expression,
                    "error": error.message
                }));
                continue;
            }
        };
        let filename = format!("{expression}.{ext}");
        match fs::write(dir.join(&filename), bytes) {
            Ok(_) => imported += 1,
            Err(error) => failed.push(json!({
                "expression": expression,
                "filename": filename,
                "error": error.to_string()
            })),
        }
    }

    Ok(json!({
        "imported": imported,
        "failed": failed,
        "sprites": list_sprites_for_dir(&dir)?
    }))
}

pub(crate) fn clean_saved_sprites(
    state: &AppState,
    character_id: &str,
    body: Value,
    owner_type: Option<&str>,
) -> AppResult<Value> {
    let owner_kind = SpriteOwnerKind::from_request(owner_type)?;
    let dir = sprites_dir(state, owner_kind, character_id)?;
    if !dir.exists() {
        return Err(AppError::not_found("No sprites found"));
    }
    let requested = string_array_from_value(body.get("expressions"))
        .into_iter()
        .map(|expr| normalize_sprite_expression(&expr))
        .collect::<Vec<_>>();
    let targets = sprite_file_paths(&dir)?
        .into_iter()
        .filter(|path| {
            if requested.is_empty() {
                return true;
            }
            let expr = expression_from_path(path);
            requested.iter().any(|item| item == &expr)
        })
        .collect::<Vec<_>>();
    if targets.is_empty() {
        return Err(AppError::not_found("No matching sprites found"));
    }

    let restore_point_id = format!("{}-{}", now_millis(), new_id());
    let restore_point_dir = dir.join(".cleanup-restore-points").join(&restore_point_id);
    fs::create_dir_all(&restore_point_dir)?;
    let mut entries = Vec::new();
    let mut failed = Vec::new();
    let mut processed = 0usize;
    let mut background_remover_processed = 0usize;
    let mut builtin_processed = 0usize;
    let requested_engine = cleanup_engine(&body);
    for path in targets {
        let expression = expression_from_path(&path);
        let filename = file_name(&path)?;
        if !is_cleanup_file(&path) {
            failed.push(json!({ "expression": expression, "error": "Only PNG, JPEG, and WEBP sprites can be background-cleaned" }));
            continue;
        }
        match cleanup_file_to_png(state, &path, cleanup_strength(&body), &requested_engine) {
            Ok(cleaned) => {
                fs::copy(&path, restore_point_dir.join(&filename))?;
                let output_filename = format!("{expression}.png");
                let output_path = dir.join(&output_filename);
                fs::write(&output_path, cleaned.bytes)?;
                if path != output_path {
                    let _ = fs::remove_file(&path);
                }
                entries.push(json!({
                    "expression": expression,
                    "originalFilename": filename,
                    "cleanedFilename": output_filename,
                    "restorePointFilename": filename
                }));
                if cleaned.engine == "backgroundremover" {
                    background_remover_processed += 1;
                } else {
                    builtin_processed += 1;
                }
                processed += 1;
            }
            Err(error) => failed.push(json!({ "expression": expression, "error": error.message })),
        }
    }
    if entries.is_empty() {
        let _ = fs::remove_dir_all(&restore_point_dir);
    } else {
        fs::write(
            restore_point_dir.join("manifest.json"),
            serde_json::to_vec_pretty(&json!({
                "id": restore_point_id,
                "createdAt": now_iso(),
                "entries": entries
            }))?,
        )?;
    }
    Ok(json!({
        "processed": processed,
        "failed": failed,
        "restorePointId": if processed > 0 { json!(restore_point_id) } else { Value::Null },
        "engine": requested_engine,
        "externalCleanupProcessed": background_remover_processed,
        "backgroundRemoverProcessed": background_remover_processed,
        "builtinProcessed": builtin_processed,
        "sprites": list_sprites_for_dir(&dir)?
    }))
}

pub(crate) fn restore_sprite_cleanup_point(
    state: &AppState,
    character_id: &str,
    body: Value,
    owner_type: Option<&str>,
) -> AppResult<Value> {
    let owner_kind = SpriteOwnerKind::from_request(owner_type)?;
    let restore_point_id = body
        .get("restorePointId")
        .and_then(Value::as_str)
        .filter(|id| id.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-'))
        .ok_or_else(|| AppError::invalid_input("Invalid cleanup restore point ID"))?;
    let dir = sprites_dir(state, owner_kind, character_id)?;
    let restore_point_dir = dir.join(".cleanup-restore-points").join(restore_point_id);
    let manifest_path = restore_point_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Err(AppError::not_found("Cleanup restore point was not found"));
    }
    let manifest: Value = serde_json::from_slice(&fs::read(&manifest_path)?)?;
    let mut restored = 0usize;
    let mut failed = Vec::new();
    for entry in manifest
        .get("entries")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
    {
        let expression = entry
            .get("expression")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        let restore_point_filename = entry
            .get("restorePointFilename")
            .and_then(Value::as_str)
            .unwrap_or("");
        let original_filename = entry
            .get("originalFilename")
            .and_then(Value::as_str)
            .unwrap_or("");
        let cleaned_filename = entry
            .get("cleanedFilename")
            .and_then(Value::as_str)
            .unwrap_or("");
        if [restore_point_filename, original_filename, cleaned_filename]
            .iter()
            .any(|name| validate_safe_segment(name, "restore point filename").is_err())
        {
            failed.push(json!({ "expression": expression, "error": "Restore point entry has an invalid filename" }));
            continue;
        }
        match fs::copy(
            restore_point_dir.join(restore_point_filename),
            dir.join(original_filename),
        ) {
            Ok(_) => {
                if cleaned_filename != original_filename {
                    let _ = fs::remove_file(dir.join(cleaned_filename));
                }
                restored += 1;
            }
            Err(error) => {
                failed.push(json!({ "expression": expression, "error": error.to_string() }))
            }
        }
    }
    if restored > 0 && failed.is_empty() {
        let _ = fs::remove_dir_all(&restore_point_dir);
    }
    Ok(json!({ "restored": restored, "failed": failed, "sprites": list_sprites_for_dir(&dir)? }))
}

pub(crate) fn delete_sprite(
    state: &AppState,
    character_id: &str,
    expression: &str,
    owner_type: Option<&str>,
) -> AppResult<Value> {
    let owner_kind = SpriteOwnerKind::from_request(owner_type)?;
    let dir = sprites_dir(state, owner_kind, character_id)?;
    let normalized = normalize_sprite_expression(expression);
    let mut deleted = false;
    if dir.exists() {
        for path in sprite_file_paths(&dir)? {
            if expression_from_path(&path) == normalized {
                fs::remove_file(path)?;
                deleted = true;
            }
        }
    }
    if !deleted && owner_kind == SpriteOwnerKind::Character {
        for sprite in match list_collection(state, "sprites", Some(("characterId", character_id)))?
        {
            Value::Array(rows) => rows,
            _ => Vec::new(),
        } {
            if sprite
                .get("expression")
                .and_then(Value::as_str)
                .map(normalize_sprite_expression)
                == Some(normalized.clone())
            {
                if let Some(id) = sprite.get("id").and_then(Value::as_str) {
                    state.storage.delete("sprites", id)?;
                    deleted = true;
                }
            }
        }
    }
    Ok(json!({ "deleted": deleted }))
}

fn validate_sprite_generation_body(state: &AppState, body: &Value) -> AppResult<()> {
    let connection_id = required_string(body, "connectionId")?;
    let connection = get_required(state, "connections", connection_id)?;
    if connection.get("provider").and_then(Value::as_str) != Some("image_generation") {
        return Err(AppError::invalid_input(
            "Image generation connection not found or could not be decrypted",
        ));
    }
    required_string(body, "appearance")?;
    if string_array_from_value(body.get("expressions")).is_empty() {
        return Err(AppError::invalid_input(
            "At least one expression is required",
        ));
    }
    Ok(())
}

impl SpritePlan {
    fn should_generate_individually(&self) -> bool {
        self.generate_individually
    }
}

fn build_sprite_plan(body: &Value, connection: Option<&Value>) -> SpritePlan {
    let cols = body
        .get("cols")
        .and_then(Value::as_u64)
        .unwrap_or(2)
        .clamp(1, 6) as u32;
    let rows = body
        .get("rows")
        .and_then(Value::as_u64)
        .unwrap_or(3)
        .clamp(1, 6) as u32;
    let sprite_type = body
        .get("spriteType")
        .and_then(Value::as_str)
        .unwrap_or("expressions")
        .to_string();
    let full_body_expression_mode = body
        .get("fullBodyExpressionMode")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        && sprite_type == "full-body";
    let expressions = string_array_from_value(body.get("expressions"))
        .into_iter()
        .take((cols * rows) as usize)
        .collect::<Vec<_>>();
    let appearance = body
        .get("appearance")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    let model = connection
        .and_then(|value| value.get("model"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let single_portrait =
        sprite_type != "full-body" && expressions.len() == 1 && cols == 1 && rows == 1;
    let single_full_body =
        sprite_type == "full-body" && expressions.len() == 1 && cols == 1 && rows == 1;
    let generate_individually =
        sprite_type != "full-body" && !single_portrait && is_openai_gpt_image_model(model);
    let (sheet_width, sheet_height, cell_width, cell_height) =
        resolve_canvas(cols, rows, &sprite_type, model);
    let prompt = if full_body_expression_mode {
        full_body_expression_sheet_prompt(
            cols,
            rows,
            &expressions,
            &appearance,
            sheet_width,
            sheet_height,
            cell_width,
            cell_height,
        )
    } else if single_full_body {
        single_full_body_prompt(
            &appearance,
            expressions.first().map(String::as_str).unwrap_or("idle"),
            body,
            model,
        )
    } else if sprite_type == "full-body" {
        full_body_sheet_prompt(
            cols,
            rows,
            &expressions,
            &appearance,
            sheet_width,
            sheet_height,
            cell_width,
            cell_height,
        )
    } else if single_portrait {
        single_portrait_prompt(
            &appearance,
            expressions.first().map(String::as_str).unwrap_or("neutral"),
            body,
            model,
        )
    } else {
        expression_sheet_prompt(cols, rows, &expressions, &appearance, body, model)
    };
    let prompt = transparent_prompt(prompt, body, model);
    SpritePlan {
        expressions,
        appearance,
        cols,
        rows,
        sprite_type,
        generate_individually,
        model: model.to_string(),
        prompt,
        sheet_width,
        sheet_height,
    }
}

fn resolve_canvas(cols: u32, rows: u32, sprite_type: &str, model: &str) -> (u32, u32, u32, u32) {
    let cell_width = 512;
    let cell_height = if sprite_type == "full-body" { 768 } else { 512 };
    let requested_width = cols * cell_width;
    let requested_height = rows * cell_height;
    if is_openai_gpt_image_model(model) {
        let ratio = requested_width as f64 / requested_height.max(1) as f64;
        let (sheet_width, sheet_height) = if ratio > 1.12 {
            (1536, 1024)
        } else if ratio < 0.88 {
            (1024, 1536)
        } else {
            (1024, 1024)
        };
        return (
            sheet_width,
            sheet_height,
            sheet_width / cols.max(1),
            sheet_height / rows.max(1),
        );
    }
    (requested_width, requested_height, cell_width, cell_height)
}

fn format_sprite_label_for_prompt(label: &str) -> String {
    label.trim().replace(['_', '-'], " ")
}

fn is_gpt_image_2_model(model: &str) -> bool {
    let lower = model.trim().to_ascii_lowercase();
    lower == "gpt-image-2" || lower.starts_with("gpt-image-2-")
}

fn expression_sheet_prompt(
    cols: u32,
    rows: u32,
    expressions: &[String],
    appearance: &str,
    body: &Value,
    model: &str,
) -> String {
    let expression_list = expressions
        .iter()
        .map(|expression| format_sprite_label_for_prompt(expression))
        .collect::<Vec<_>>()
        .join(", ");
    let prompt = format!(
        "character expression sprite sheet source image, designed to be sliced into cells, EXACTLY {} total portrait cells and every cell must be filled, strict {cols} columns by {rows} rows grid, no extra rows, no extra columns, no extra panels, solid white background, thin straight borders or clean gutters separating every cell, same character in every cell, same outfit, same camera distance, same lighting, consistent art style, expressions left-to-right top-to-bottom, one cell per expression, no duplicates and none missing: {}, {appearance}, each cell shows one head-and-shoulders portrait with the requested facial expression, centered with no cropping, no text, no labels, no numbers, no captions, no watermark",
        expressions.len(),
        expression_list
    );
    transparent_prompt(prompt, body, model)
}

fn single_portrait_prompt(appearance: &str, expression: &str, body: &Value, model: &str) -> String {
    let expression = format_sprite_label_for_prompt(expression);
    transparent_prompt(format!("single character portrait sprite, one character only, head and shoulders portrait, centered in frame, no cropping, solid white studio background, {appearance}, facial expression: {expression}, anime/game sprite style, consistent character design, no grid, no panel borders, no text, no labels, no watermark"), body, model)
}

fn single_full_body_prompt(appearance: &str, pose: &str, body: &Value, model: &str) -> String {
    let pose = format_sprite_label_for_prompt(pose);
    transparent_prompt(format!("single full-body character sprite, one character only, entire body visible from head to toe, centered in frame, no cropping, solid white studio background, {appearance}, pose/action: {pose}, anime/game sprite style, consistent character design, no grid, no panel borders, no text, no labels, no watermark"), body, model)
}

#[allow(clippy::too_many_arguments)]
fn full_body_sheet_prompt(
    cols: u32,
    rows: u32,
    expressions: &[String],
    appearance: &str,
    sheet_width: u32,
    sheet_height: u32,
    cell_width: u32,
    cell_height: u32,
) -> String {
    let cell_count = cols * rows;
    let readable = expressions
        .iter()
        .map(|expression| format_sprite_label_for_prompt(expression))
        .collect::<Vec<_>>();
    let filler_count = cell_count.saturating_sub(readable.len() as u32);
    [
        "full-body character pose sprite sheet source image, designed to be sliced into cells,".to_string(),
        format!("target output canvas is {sheet_width}x{sheet_height} pixels, with each cell exactly {cell_width}x{cell_height} pixels,"),
        format!("EXACTLY {cell_count} total grid cells and every cell must be filled, strict {cols} columns by {rows} rows grid,"),
        "all vertical grid cuts are evenly spaced, solid white background, thin straight borders or clean gutters separating every cell,".to_string(),
        "same character in every cell, same outfit, same proportions, same scale, consistent art style,".to_string(),
        format!("first {} cells left-to-right top-to-bottom must match these poses: {},", readable.len(), readable.join(", ")),
        if filler_count > 0 {
            format!("fill the remaining {filler_count} cells with neutral idle filler sprites; filler cells are ignored after slicing,")
        } else {
            String::new()
        },
        format!("{appearance},"),
        "each cell shows one complete full-body character from head to toe, centered upright, feet visible, no cropping,".to_string(),
        "the character must use no more than 78% of the cell height; leave padding above the head and below the feet inside every cell,".to_string(),
        "keep every sprite fully inside its own cell; no hair, feet, clothing, weapons, shadows, or effects may cross into another cell,".to_string(),
        "do not make one single large full-body image, do not make a poster, comic page, collage, diagonal layout, or merged composition,".to_string(),
        "all cells same size, perfectly aligned, no overlapping, no merged cells, no blank cells, no text, no labels, no numbers, no captions, no watermark".to_string(),
    ]
    .into_iter()
    .filter(|part| !part.is_empty())
    .collect::<Vec<_>>()
    .join(" ")
}

#[allow(clippy::too_many_arguments)]
fn full_body_expression_sheet_prompt(
    cols: u32,
    rows: u32,
    expressions: &[String],
    appearance: &str,
    sheet_width: u32,
    sheet_height: u32,
    cell_width: u32,
    cell_height: u32,
) -> String {
    let cell_count = cols * rows;
    let readable = expressions
        .iter()
        .map(|expression| format_sprite_label_for_prompt(expression))
        .collect::<Vec<_>>();
    let filler_count = cell_count.saturating_sub(readable.len() as u32);
    [
        "full-body character expression sprite sheet source image, designed to be sliced into cells,".to_string(),
        format!("target output canvas is {sheet_width}x{sheet_height} pixels, with each cell exactly {cell_width}x{cell_height} pixels,"),
        format!("strict {cols} columns by {rows} rows grid, exactly {cell_count} equally sized tall rectangular cells,"),
        format!("all vertical grid cuts are evenly spaced every {cell_width} pixels and all horizontal grid cuts every {cell_height} pixels,"),
        "solid white background, thin straight borders or clean gutters separating every cell,".to_string(),
        "same character in every cell, same outfit, same proportions, same scale, consistent art style,".to_string(),
        format!("first {} cells left-to-right top-to-bottom must match these facial expressions while keeping the same relaxed standing idle pose: {},", readable.len(), readable.join(", ")),
        if filler_count > 0 {
            format!("fill the remaining {filler_count} cells with neutral relaxed standing idle filler sprites; filler cells are ignored after slicing,")
        } else {
            String::new()
        },
        format!("{appearance},"),
        "each cell shows one complete full-body character from head to toe, centered upright, feet visible, no cropping,".to_string(),
        "the character must use no more than 78% of the cell height; leave at least 10% empty padding above the head and 12% empty padding below the feet inside every cell,".to_string(),
        "feet and shoes must be clearly above the bottom border or gutter, especially in the final row, never touching or cut by the cell edge,".to_string(),
        "keep every sprite fully inside its own cell; no hair, feet, clothing, weapons, shadows, or effects may cross into another cell,".to_string(),
        "only the face and mood change between the expression cells; body pose stays idle and relaxed,".to_string(),
        "do not create action, walking, running, attack, casting, combat, jumping, sitting, or victory poses,".to_string(),
        "do not make one single large full-body image, do not make a poster, comic page, collage, diagonal layout, or merged composition,".to_string(),
        "all cells same size, perfectly aligned, no overlapping, no merged cells, no blank cells, no text, no labels, no numbers, no captions, no watermark".to_string(),
    ]
    .into_iter()
    .filter(|part| !part.is_empty())
    .collect::<Vec<_>>()
    .join(" ")
}

fn single_sprite_prompt(
    sprite_type: &str,
    appearance: &str,
    expression: &str,
    body: &Value,
    model: &str,
) -> String {
    if sprite_type == "full-body" {
        single_full_body_prompt(appearance, expression, body, model)
    } else {
        single_portrait_prompt(appearance, expression, body, model)
    }
}

fn transparent_prompt(prompt: String, body: &Value, model: &str) -> String {
    if !body
        .get("nativeTransparentPng")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return prompt;
    }
    let cleanup_friendly = is_gpt_image_2_model(model);
    let replacement = if cleanup_friendly {
        "no background, png format. If transparent output is unsupported, use a perfectly flat pure white #ffffff background with no shadows, gradients, scenery, floor line, or texture behind the character"
    } else {
        "no background, png format"
    };
    let mut updated = prompt
        .replace("solid white studio background", replacement)
        .replace("solid white background", replacement)
        .replace("plain white background", replacement)
        .replace("white studio background", replacement)
        .replace("white background", replacement);
    if updated == prompt && !updated.to_ascii_lowercase().contains("no background") {
        updated.push_str(", ");
        updated.push_str(replacement);
    } else if cleanup_friendly
        && !updated.to_ascii_lowercase().contains("flat pure white")
        && updated.to_ascii_lowercase().contains("no background")
    {
        updated.push_str(". If transparent output is unsupported, use a perfectly flat pure white #ffffff background with no shadows, gradients, scenery, floor line, or texture behind the character");
    }
    updated
}

fn sprite_prompt_review_id(kind: &str, sprite_type: &str, label: &str) -> String {
    let normalized = label
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, ',' | '_' | '-') {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(120)
        .collect::<String>();
    format!(
        "sprite:{}:{kind}:{}",
        if sprite_type.is_empty() {
            "expressions"
        } else {
            sprite_type
        },
        if normalized.is_empty() {
            "request"
        } else {
            &normalized
        }
    )
}

fn slice_sprite_sheet(sheet_base64: &str, plan: &SpritePlan) -> AppResult<Vec<Value>> {
    let bytes = general_purpose::STANDARD
        .decode(extract_base64_image_data(sheet_base64))
        .map_err(|error| {
            AppError::invalid_input(format!("Invalid generated sheet image: {error}"))
        })?;
    let image = image::load_from_memory(&bytes).map_err(image_error)?;
    let (width, height) = image.dimensions();
    let cell_width = width / plan.cols.max(1);
    let cell_height = height / plan.rows.max(1);
    let mut cells = Vec::new();
    for row in 0..plan.rows {
        for col in 0..plan.cols {
            let index = (row * plan.cols + col) as usize;
            if index >= plan.expressions.len() {
                break;
            }
            let crop = image.crop_imm(col * cell_width, row * cell_height, cell_width, cell_height);
            cells.push(json!({
                "expression": plan.expressions[index],
                "base64": encode_png_base64(crop)?
            }));
        }
    }
    Ok(cells)
}

fn cleanup_file_to_png(
    state: &AppState,
    path: &Path,
    strength: u8,
    requested_engine: &str,
) -> AppResult<SpriteCleanupOutput> {
    let bytes = fs::read(path)?;
    cleanup_image_bytes(state, &bytes, strength, requested_engine)
}

fn cleanup_image_base64(
    state: &AppState,
    value: &str,
    strength: u8,
    requested_engine: &str,
) -> AppResult<SpriteCleanupOutput> {
    let bytes = general_purpose::STANDARD
        .decode(extract_base64_image_data(value))
        .map_err(|error| AppError::invalid_input(format!("Invalid base64 image: {error}")))?;
    cleanup_image_bytes(state, &bytes, strength, requested_engine)
}

fn cleanup_image_bytes(
    state: &AppState,
    bytes: &[u8],
    strength: u8,
    requested_engine: &str,
) -> AppResult<SpriteCleanupOutput> {
    if requested_engine != "builtin" {
        if let Some(bytes) = try_remove_background_with_backgroundremover(
            state,
            bytes,
            requested_engine == "backgroundremover",
        )? {
            return Ok(SpriteCleanupOutput {
                bytes,
                engine: "backgroundremover".to_string(),
            });
        }
    }
    let image = image::load_from_memory(bytes).map_err(image_error)?;
    Ok(SpriteCleanupOutput {
        bytes: encode_png(cleanup_image(image, strength))?,
        engine: "builtin".to_string(),
    })
}

fn cleanup_image(image: DynamicImage, strength: u8) -> DynamicImage {
    let mut rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();
    if width == 0 || height == 0 {
        return DynamicImage::ImageRgba8(rgba);
    }

    let matte = estimate_border_matte(&rgba, strength);
    let pixel_count = (width as usize).saturating_mul(height as usize);
    let mut matte_mask = vec![false; pixel_count];
    let mut queue = VecDeque::new();
    let strength_f = strength.min(100) as f32;
    let hard_cutoff = 14.0 + (strength_f / 100.0) * 32.0;
    let soft_cutoff = hard_cutoff + 30.0 + (strength_f / 100.0) * 42.0;
    let halo_cutoff = soft_cutoff + 12.0 + (strength_f / 100.0) * 18.0;
    let matte_luma = rgb_luma(matte);
    let luma_floor = 178.0_f32.max(matte_luma - (30.0 + strength_f * 0.46));
    let spread_limit = 18.0 + (strength_f / 100.0) * 38.0;

    for x in 0..width {
        enqueue_matte_candidate(
            &rgba,
            &mut matte_mask,
            &mut queue,
            width,
            x,
            0,
            matte,
            soft_cutoff,
            luma_floor,
            spread_limit,
        );
        enqueue_matte_candidate(
            &rgba,
            &mut matte_mask,
            &mut queue,
            width,
            x,
            height - 1,
            matte,
            soft_cutoff,
            luma_floor,
            spread_limit,
        );
    }
    for y in 0..height {
        enqueue_matte_candidate(
            &rgba,
            &mut matte_mask,
            &mut queue,
            width,
            0,
            y,
            matte,
            soft_cutoff,
            luma_floor,
            spread_limit,
        );
        enqueue_matte_candidate(
            &rgba,
            &mut matte_mask,
            &mut queue,
            width,
            width - 1,
            y,
            matte,
            soft_cutoff,
            luma_floor,
            spread_limit,
        );
    }
    drain_matte_queue(
        &rgba,
        &mut matte_mask,
        &mut queue,
        width,
        height,
        matte,
        soft_cutoff,
        luma_floor,
        spread_limit,
    );

    let strict_cutoff = (hard_cutoff + 22.0).min(soft_cutoff * 0.88);
    let mut row_counts = vec![0u32; height as usize];
    let mut col_counts = vec![0u32; width as usize];
    for y in 0..height {
        for x in 0..width {
            let index = pixel_index(width, x, y);
            if matte_mask[index] {
                continue;
            }
            if is_matte_candidate(
                &rgba,
                x,
                y,
                matte,
                strict_cutoff,
                luma_floor + 10.0,
                spread_limit - 8.0,
            ) {
                row_counts[y as usize] += 1;
                col_counts[x as usize] += 1;
            }
        }
    }
    let broad_row_threshold = width as f32 * 0.34;
    let broad_col_threshold = height as f32 * 0.34;
    for y in 0..height {
        for x in 0..width {
            let index = pixel_index(width, x, y);
            if matte_mask[index] {
                continue;
            }
            let is_broad_axis = row_counts[y as usize] as f32 >= broad_row_threshold
                || col_counts[x as usize] as f32 >= broad_col_threshold;
            if is_broad_axis
                && is_matte_candidate(
                    &rgba,
                    x,
                    y,
                    matte,
                    strict_cutoff,
                    luma_floor + 10.0,
                    spread_limit - 8.0,
                )
            {
                matte_mask[index] = true;
                queue.push_back(index);
            }
        }
    }
    drain_matte_queue(
        &rgba,
        &mut matte_mask,
        &mut queue,
        width,
        height,
        matte,
        soft_cutoff,
        luma_floor,
        spread_limit,
    );

    let original = rgba.clone();
    for y in 0..height {
        for x in 0..width {
            let index = pixel_index(width, x, y);
            let pixel = rgba.get_pixel_mut(x, y);
            let Rgba([r, g, b, a]) = *pixel;
            if matte_mask[index] {
                *pixel = Rgba([r, g, b, 0]);
                continue;
            }
            let matte_neighbors = matte_neighbor_weight(&matte_mask, width, height, x, y);
            if matte_neighbors <= 0.0 {
                continue;
            }
            let distance = rgb_distance(read_rgb(&original, x, y), matte);
            if distance > halo_cutoff {
                continue;
            }
            let fade = 1.0
                - ((distance - hard_cutoff) / (halo_cutoff - hard_cutoff).max(1.0)).clamp(0.0, 1.0);
            let cleanup_weight = fade * (matte_neighbors / 3.2).clamp(0.0, 1.0);
            if cleanup_weight <= 0.0 {
                continue;
            }
            if let Some(neighbor) =
                foreground_neighbor_color(&original, &matte_mask, width, height, x, y)
            {
                let blend = (cleanup_weight * (0.55 + strength_f / 400.0)).clamp(0.0, 1.0);
                *pixel = Rgba([
                    lerp_u8(r, neighbor.0, blend),
                    lerp_u8(g, neighbor.1, blend),
                    lerp_u8(b, neighbor.2, blend),
                    ((a as f32) * (1.0 - cleanup_weight * (0.18 + strength_f / 280.0))).round()
                        as u8,
                ]);
            }
        }
    }
    DynamicImage::ImageRgba8(rgba)
}

fn pixel_index(width: u32, x: u32, y: u32) -> usize {
    (y as usize * width as usize) + x as usize
}

fn read_rgb(image: &RgbaImage, x: u32, y: u32) -> (u8, u8, u8) {
    let Rgba([r, g, b, _]) = *image.get_pixel(x, y);
    (r, g, b)
}

fn rgb_luma(color: (u8, u8, u8)) -> f32 {
    color.0 as f32 * 0.2126 + color.1 as f32 * 0.7152 + color.2 as f32 * 0.0722
}

fn rgb_spread(color: (u8, u8, u8)) -> f32 {
    let max = color.0.max(color.1).max(color.2) as f32;
    let min = color.0.min(color.1).min(color.2) as f32;
    max - min
}

fn rgb_distance(a: (u8, u8, u8), b: (u8, u8, u8)) -> f32 {
    ((a.0 as f32 - b.0 as f32).powi(2)
        + (a.1 as f32 - b.1 as f32).powi(2)
        + (a.2 as f32 - b.2 as f32).powi(2))
    .sqrt()
}

fn estimate_border_matte(image: &RgbaImage, strength: u8) -> (u8, u8, u8) {
    let (width, height) = image.dimensions();
    let step = (width.min(height) / 96).max(1);
    let mut red = Vec::new();
    let mut green = Vec::new();
    let mut blue = Vec::new();
    let mut accept = |x: u32, y: u32| {
        let Rgba([r, g, b, a]) = *image.get_pixel(x, y);
        if a <= 4 {
            return;
        }
        let color = (r, g, b);
        if rgb_luma(color) < 172.0 - strength as f32 * 0.18
            || rgb_spread(color) > 38.0 + strength as f32 * 0.3
        {
            return;
        }
        red.push(r);
        green.push(g);
        blue.push(b);
    };
    let mut x = 0;
    while x < width {
        accept(x, 0);
        accept(x, height - 1);
        x = x.saturating_add(step);
    }
    let mut y = 0;
    while y < height {
        accept(0, y);
        accept(width - 1, y);
        y = y.saturating_add(step);
    }
    (
        median_u8(red, 255),
        median_u8(green, 255),
        median_u8(blue, 255),
    )
}

fn median_u8(mut values: Vec<u8>, fallback: u8) -> u8 {
    if values.is_empty() {
        return fallback;
    }
    values.sort_unstable();
    values[values.len() / 2]
}

fn is_matte_candidate(
    image: &RgbaImage,
    x: u32,
    y: u32,
    matte: (u8, u8, u8),
    cutoff: f32,
    luma_floor: f32,
    spread_limit: f32,
) -> bool {
    let Rgba([r, g, b, a]) = *image.get_pixel(x, y);
    if a <= 4 {
        return true;
    }
    let color = (r, g, b);
    rgb_luma(color) >= luma_floor
        && rgb_spread(color) <= spread_limit.max(0.0)
        && rgb_distance(color, matte) <= cutoff
}

#[allow(clippy::too_many_arguments)]
fn enqueue_matte_candidate(
    image: &RgbaImage,
    matte_mask: &mut [bool],
    queue: &mut VecDeque<usize>,
    width: u32,
    x: u32,
    y: u32,
    matte: (u8, u8, u8),
    cutoff: f32,
    luma_floor: f32,
    spread_limit: f32,
) {
    let index = pixel_index(width, x, y);
    if matte_mask[index]
        || !is_matte_candidate(image, x, y, matte, cutoff, luma_floor, spread_limit)
    {
        return;
    }
    matte_mask[index] = true;
    queue.push_back(index);
}

#[allow(clippy::too_many_arguments)]
fn drain_matte_queue(
    image: &RgbaImage,
    matte_mask: &mut [bool],
    queue: &mut VecDeque<usize>,
    width: u32,
    height: u32,
    matte: (u8, u8, u8),
    cutoff: f32,
    luma_floor: f32,
    spread_limit: f32,
) {
    while let Some(index) = queue.pop_front() {
        let x = (index % width as usize) as u32;
        let y = (index / width as usize) as u32;
        if x > 0 {
            enqueue_matte_candidate(
                image,
                matte_mask,
                queue,
                width,
                x - 1,
                y,
                matte,
                cutoff,
                luma_floor,
                spread_limit,
            );
        }
        if x + 1 < width {
            enqueue_matte_candidate(
                image,
                matte_mask,
                queue,
                width,
                x + 1,
                y,
                matte,
                cutoff,
                luma_floor,
                spread_limit,
            );
        }
        if y > 0 {
            enqueue_matte_candidate(
                image,
                matte_mask,
                queue,
                width,
                x,
                y - 1,
                matte,
                cutoff,
                luma_floor,
                spread_limit,
            );
        }
        if y + 1 < height {
            enqueue_matte_candidate(
                image,
                matte_mask,
                queue,
                width,
                x,
                y + 1,
                matte,
                cutoff,
                luma_floor,
                spread_limit,
            );
        }
    }
}

fn matte_neighbor_weight(matte_mask: &[bool], width: u32, height: u32, x: u32, y: u32) -> f32 {
    let mut weight = 0.0;
    for y_offset in -1..=1 {
        for x_offset in -1..=1 {
            if x_offset == 0 && y_offset == 0 {
                continue;
            }
            let Some(sample_x) = x.checked_add_signed(x_offset) else {
                continue;
            };
            let Some(sample_y) = y.checked_add_signed(y_offset) else {
                continue;
            };
            if sample_x >= width || sample_y >= height {
                continue;
            }
            if matte_mask[pixel_index(width, sample_x, sample_y)] {
                weight += if x_offset == 0 || y_offset == 0 {
                    1.0
                } else {
                    0.7
                };
            }
        }
    }
    weight
}

fn foreground_neighbor_color(
    image: &RgbaImage,
    matte_mask: &[bool],
    width: u32,
    height: u32,
    x: u32,
    y: u32,
) -> Option<(u8, u8, u8)> {
    let mut red = 0.0;
    let mut green = 0.0;
    let mut blue = 0.0;
    let mut total = 0.0;
    for radius in 1..=4 {
        for y_offset in -radius..=radius {
            for x_offset in -radius..=radius {
                let Some(sample_x) = x.checked_add_signed(x_offset) else {
                    continue;
                };
                let Some(sample_y) = y.checked_add_signed(y_offset) else {
                    continue;
                };
                if sample_x >= width || sample_y >= height {
                    continue;
                }
                if matte_mask[pixel_index(width, sample_x, sample_y)] {
                    continue;
                }
                let Rgba([r, g, b, a]) = *image.get_pixel(sample_x, sample_y);
                if a <= 16 {
                    continue;
                }
                let distance = ((x_offset * x_offset + y_offset * y_offset) as f32)
                    .sqrt()
                    .max(1.0);
                let weight = (a as f32 / 255.0) / distance;
                red += r as f32 * weight;
                green += g as f32 * weight;
                blue += b as f32 * weight;
                total += weight;
            }
        }
        if total > 0.0 {
            break;
        }
    }
    (total > 0.0).then(|| {
        (
            (red / total).round().clamp(0.0, 255.0) as u8,
            (green / total).round().clamp(0.0, 255.0) as u8,
            (blue / total).round().clamp(0.0, 255.0) as u8,
        )
    })
}

fn lerp_u8(from: u8, to: u8, amount: f32) -> u8 {
    (from as f32 + (to as f32 - from as f32) * amount)
        .round()
        .clamp(0.0, 255.0) as u8
}

fn encode_png_base64(image: DynamicImage) -> AppResult<String> {
    Ok(general_purpose::STANDARD.encode(encode_png(image)?))
}

fn encode_png(image: DynamicImage) -> AppResult<Vec<u8>> {
    let mut cursor = Cursor::new(Vec::new());
    image
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(image_error)?;
    Ok(cursor.into_inner())
}

fn decode_image_value(value: &str) -> AppResult<(Vec<u8>, String)> {
    let (mime, base64) = if let Some((prefix, payload)) = value.split_once(',') {
        let mime = prefix
            .strip_prefix("data:")
            .and_then(|rest| rest.split(';').next())
            .unwrap_or("image/png");
        (mime, payload)
    } else {
        ("image/png", value)
    };
    let ext = match mime {
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/avif" => "avif",
        "image/svg+xml" => "svg",
        _ => "png",
    };
    let bytes = general_purpose::STANDARD
        .decode(base64.trim())
        .map_err(|error| AppError::invalid_input(format!("Invalid image data: {error}")))?;
    Ok((bytes, ext.to_string()))
}

fn extract_base64_image_data(value: &str) -> &str {
    value
        .split_once(',')
        .map(|(_, data)| data)
        .unwrap_or(value)
        .trim()
}

fn sprite_info_from_path(path: &Path) -> AppResult<Value> {
    let filename = file_name(path)?;
    let expression = expression_from_path(path);
    let bytes = fs::read(path)?;
    let mime = mime_for_path(path);
    Ok(json!({
        "expression": expression,
        "filename": filename,
        "url": format!("data:{mime};base64,{}", general_purpose::STANDARD.encode(bytes))
    }))
}

fn list_sprites_for_dir(dir: &Path) -> AppResult<Value> {
    let mut items = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || !is_sprite_file(&path) {
            continue;
        }
        items.push(sprite_info_from_path(&path)?);
    }
    items.sort_by(|a, b| {
        a.get("expression")
            .and_then(Value::as_str)
            .unwrap_or("")
            .cmp(b.get("expression").and_then(Value::as_str).unwrap_or(""))
    });
    Ok(Value::Array(items))
}

fn sprites_dir(
    state: &AppState,
    owner_kind: SpriteOwnerKind,
    owner_id: &str,
) -> AppResult<PathBuf> {
    validate_safe_segment(owner_id, owner_kind.owner_label())?;
    match owner_kind {
        SpriteOwnerKind::Character => Ok(state.data_dir.join("sprites").join(owner_id)),
        SpriteOwnerKind::Persona => {
            migrate_legacy_persona_sprites_if_unambiguous(state, owner_id)?;
            Ok(persona_sprites_dir(state, owner_id))
        }
    }
}

fn persona_sprites_dir(state: &AppState, persona_id: &str) -> PathBuf {
    state
        .data_dir
        .join("sprites")
        .join("personas")
        .join(persona_id)
}

fn legacy_persona_sprites_dir(state: &AppState, persona_id: &str) -> PathBuf {
    state.data_dir.join("sprites").join(persona_id)
}

fn migrate_legacy_persona_sprites_if_unambiguous(
    state: &AppState,
    persona_id: &str,
) -> AppResult<()> {
    let legacy_dir = legacy_persona_sprites_dir(state, persona_id);
    let persona_namespace_dir = state.data_dir.join("sprites").join("personas");
    if legacy_dir == persona_namespace_dir
        || !legacy_dir.exists()
        || state.storage.get("characters", persona_id)?.is_some()
    {
        return Ok(());
    }

    let next_dir = persona_sprites_dir(state, persona_id);
    if next_dir.exists() {
        move_directory_contents_without_overwrite(&legacy_dir, &next_dir)?;
    } else {
        if let Some(parent) = next_dir.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(&legacy_dir, &next_dir)?;
    }
    Ok(())
}

fn move_directory_contents_without_overwrite(src_dir: &Path, dst_dir: &Path) -> AppResult<()> {
    fs::create_dir_all(dst_dir)?;
    ensure_directory_merge_has_no_conflicts(src_dir, dst_dir)?;

    for entry in fs::read_dir(src_dir)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst_dir.join(entry.file_name());

        if dst_path.exists() {
            return Err(AppError::invalid_input(format!(
                "Persona sprite migration destination already exists: {}",
                dst_path.display()
            )));
        }

        if entry.file_type()?.is_dir() {
            fs::create_dir_all(&dst_path)?;
            move_directory_contents_without_overwrite(&src_path, &dst_path)?;
        } else {
            fs::rename(&src_path, &dst_path)?;
        }
    }

    fs::remove_dir_all(src_dir)?;
    Ok(())
}

fn ensure_directory_merge_has_no_conflicts(src_dir: &Path, dst_dir: &Path) -> AppResult<()> {
    for entry in fs::read_dir(src_dir)? {
        let entry = entry?;
        let dst_path = dst_dir.join(entry.file_name());

        if dst_path.exists() {
            return Err(AppError::invalid_input(format!(
                "Persona sprite migration destination already exists: {}",
                dst_path.display()
            )));
        }
    }

    Ok(())
}

fn sprite_file_paths(dir: &Path) -> AppResult<Vec<PathBuf>> {
    let mut paths = Vec::new();
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_file() && is_sprite_file(&path) {
            paths.push(path);
        }
    }
    Ok(paths)
}

fn file_name(path: &Path) -> AppResult<String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AppError::invalid_input("Invalid sprite filename"))
}

fn expression_from_path(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_string()
}

fn is_sprite_file(path: &Path) -> bool {
    extension(path).is_some_and(|ext| SPRITE_EXTENSIONS.contains(&ext.as_str()))
}

fn is_cleanup_file(path: &Path) -> bool {
    extension(path).is_some_and(|ext| CLEANUP_EXTENSIONS.contains(&ext.as_str()))
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
}

fn mime_for_path(path: &Path) -> &'static str {
    match extension(path).as_deref() {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("avif") => "image/avif",
        Some("svg") => "image/svg+xml",
        _ => "image/png",
    }
}

fn normalize_sprite_expression(raw: &str) -> String {
    raw.trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn cleanup_strength(body: &Value) -> u8 {
    body.get("cleanupStrength")
        .and_then(Value::as_u64)
        .unwrap_or(35)
        .min(100) as u8
}

fn cleanup_engine(body: &Value) -> String {
    match body
        .get("engine")
        .and_then(Value::as_str)
        .unwrap_or("auto")
        .to_ascii_lowercase()
        .as_str()
    {
        "backgroundremover" | "background-remover" | "ai" => "backgroundremover".to_string(),
        "builtin" | "built-in" | "matte" | "white" => "builtin".to_string(),
        _ => "auto".to_string(),
    }
}

fn env_bool(name: &str) -> bool {
    env::var(name)
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

fn preferred_background_removal_engine() -> String {
    let raw = env::var("SPRITE_BACKGROUND_REMOVAL_ENGINE")
        .or_else(|_| env::var("BACKGROUND_REMOVAL_ENGINE"))
        .unwrap_or_else(|_| "auto".to_string())
        .trim()
        .to_ascii_lowercase();
    match raw.as_str() {
        "backgroundremover" | "background-remover" | "ai" => "backgroundremover".to_string(),
        "builtin" | "built-in" | "sharp" | "matte" | "white" => "builtin".to_string(),
        _ => "auto".to_string(),
    }
}

fn background_remover_runtime_dir(state: &AppState) -> PathBuf {
    state.data_dir.join("background-remover")
}

fn bundled_background_remover_roots(state: &AppState) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(resource_dir) = &state.resource_dir {
        roots.push(resource_dir.join("resources").join("background-remover"));
        roots.push(resource_dir.join("background-remover"));
    }
    roots.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("background-remover"),
    );
    roots
}

fn platform_runtime_dirs(root: &Path) -> Vec<PathBuf> {
    let os = if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "unknown"
    };
    let arch = if cfg!(target_arch = "x86_64") {
        "x64"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "generic"
    };
    vec![
        root.join(format!("{os}-{arch}")),
        root.join(os),
        root.join("common"),
        root.to_path_buf(),
    ]
}

fn executable_exists(path: &Path) -> bool {
    path.is_file()
}

fn local_venv_executable(state: &AppState, name: &str) -> PathBuf {
    let venv = background_remover_runtime_dir(state).join(".venv");
    if cfg!(windows) {
        venv.join("Scripts").join(if name == "python" {
            "python.exe"
        } else {
            "backgroundremover.exe"
        })
    } else {
        venv.join("bin").join(name)
    }
}

fn path_executable_names(name: &str) -> Vec<String> {
    if !cfg!(windows) {
        return vec![name.to_string()];
    }
    env::var("PATHEXT")
        .unwrap_or_else(|_| ".EXE;.CMD;.BAT;.COM".to_string())
        .split(';')
        .filter_map(|ext| {
            let ext = ext.trim();
            (!ext.is_empty()).then(|| format!("{name}{}", ext.to_ascii_lowercase()))
        })
        .collect()
}

fn find_executable_on_path(name: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    for entry in env::split_paths(&path) {
        for executable in path_executable_names(name) {
            let candidate = entry.join(executable);
            if executable_exists(&candidate) {
                return Some(candidate);
            }
        }
    }
    None
}

fn bundled_runtime_executable(dir: &Path, name: &str) -> Option<PathBuf> {
    for executable in path_executable_names(name) {
        for parent in [dir.to_path_buf(), dir.join("bin"), dir.join("Scripts")] {
            let candidate = parent.join(&executable);
            if executable_exists(&candidate) {
                return Some(candidate);
            }
        }
    }
    None
}

fn resolve_bundled_backgroundremover_command(state: &AppState) -> Option<BackgroundRemoverCommand> {
    for root in bundled_background_remover_roots(state) {
        for dir in platform_runtime_dirs(&root) {
            if let Some(command) = bundled_runtime_executable(&dir, "backgroundremover") {
                return Some(BackgroundRemoverCommand {
                    label: command.to_string_lossy().to_string(),
                    command,
                    args_prefix: Vec::new(),
                    source: "bundled",
                });
            }
            if let Some(command) = bundled_runtime_executable(&dir, "python") {
                return Some(BackgroundRemoverCommand {
                    label: format!("{} -m backgroundremover.cmd.cli", command.to_string_lossy()),
                    command,
                    args_prefix: vec!["-m".to_string(), "backgroundremover.cmd.cli".to_string()],
                    source: "bundled",
                });
            }
        }
    }
    None
}

fn resolve_backgroundremover_command(state: &AppState) -> Option<BackgroundRemoverCommand> {
    if let Some(command) = resolve_bundled_backgroundremover_command(state) {
        return Some(command);
    }
    if let Ok(command) = env::var("BACKGROUNDREMOVER_COMMAND") {
        let command = command.trim();
        if !command.is_empty() {
            return Some(BackgroundRemoverCommand {
                command: PathBuf::from(command),
                args_prefix: Vec::new(),
                label: command.to_string(),
                source: "env",
            });
        }
    }
    if let Ok(python) = env::var("BACKGROUNDREMOVER_PYTHON") {
        let python = python.trim();
        if !python.is_empty() {
            return Some(BackgroundRemoverCommand {
                command: PathBuf::from(python),
                args_prefix: vec!["-m".to_string(), "backgroundremover.cmd.cli".to_string()],
                label: format!("{python} -m backgroundremover.cmd.cli"),
                source: "env",
            });
        }
    }
    let local_cli = local_venv_executable(state, "backgroundremover");
    if executable_exists(&local_cli) {
        return Some(BackgroundRemoverCommand {
            label: local_cli.to_string_lossy().to_string(),
            command: local_cli,
            args_prefix: Vec::new(),
            source: "local",
        });
    }
    let local_python = local_venv_executable(state, "python");
    if executable_exists(&local_python) {
        return Some(BackgroundRemoverCommand {
            label: format!(
                "{} -m backgroundremover.cmd.cli",
                local_python.to_string_lossy()
            ),
            command: local_python,
            args_prefix: vec!["-m".to_string(), "backgroundremover.cmd.cli".to_string()],
            source: "local",
        });
    }
    find_executable_on_path("backgroundremover").map(|command| BackgroundRemoverCommand {
        label: command.to_string_lossy().to_string(),
        command,
        args_prefix: Vec::new(),
        source: "path",
    })
}

fn background_remover_status(state: &AppState) -> Value {
    let engine = preferred_background_removal_engine();
    let disabled = env_bool("BACKGROUNDREMOVER_DISABLED");
    let command = if disabled || engine == "builtin" {
        None
    } else {
        resolve_backgroundremover_command(state)
    };
    json!({
        "engine": engine,
        "installed": command.is_some(),
        "command": command.as_ref().map(|command| command.label.clone()),
        "source": command.as_ref().map(|command| command.source),
        "runtimeDir": background_remover_runtime_dir(state).to_string_lossy(),
        "reason": if disabled {
            Value::String("backgroundremover is disabled by BACKGROUNDREMOVER_DISABLED".to_string())
        } else if engine == "builtin" {
            Value::String("Built-in matte cleanup is forced by SPRITE_BACKGROUND_REMOVAL_ENGINE".to_string())
        } else if command.is_some() {
            Value::Null
        } else {
            Value::String("No bundled backgroundremover runtime was found for this platform. Marinara will use built-in matte cleanup unless BACKGROUNDREMOVER_COMMAND/BACKGROUNDREMOVER_PYTHON or PATH provides backgroundremover.".to_string())
        }
    })
}

fn cleanup_engine_status(state: &AppState) -> Value {
    let engine = preferred_background_removal_engine();
    let background_remover = background_remover_status(state);
    let background_remover_installed = background_remover
        .get("installed")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let background_remover_reason = background_remover
        .get("reason")
        .cloned()
        .unwrap_or(Value::Null);
    let forced_background_remover = engine == "backgroundremover";
    let installed = !forced_background_remover || background_remover_installed;
    json!({
        "engine": engine,
        "installed": installed,
        "command": background_remover.get("command").cloned().unwrap_or(Value::Null),
        "source": if background_remover_installed {
            background_remover.get("source").cloned().unwrap_or(Value::Null)
        } else if installed {
            json!("builtin")
        } else {
            Value::Null
        },
        "runtimeDir": background_remover_runtime_dir(state).to_string_lossy(),
        "reason": if installed {
            if engine == "builtin" {
                background_remover_reason.clone().as_str().map_or_else(|| {
                    Value::String("Built-in matte cleanup is forced by SPRITE_BACKGROUND_REMOVAL_ENGINE".to_string())
                }, |_| background_remover_reason.clone())
            } else if background_remover_installed {
                Value::Null
            } else if background_remover_reason
                .as_str()
                .map(|reason| reason.contains("disabled"))
                .unwrap_or(false)
            {
                background_remover_reason.clone()
            } else {
                Value::String("Using built-in matte cleanup; no bundled or external backgroundremover runtime is available.".to_string())
            }
        } else {
            background_remover_reason.as_str().map_or_else(|| {
                Value::String("backgroundremover is required but unavailable.".to_string())
            }, |_| background_remover_reason.clone())
        }
    })
}

fn try_remove_background_with_backgroundremover(
    state: &AppState,
    input: &[u8],
    required: bool,
) -> AppResult<Option<Vec<u8>>> {
    let engine = preferred_background_removal_engine();
    let disabled = env_bool("BACKGROUNDREMOVER_DISABLED");
    if engine == "builtin" || disabled {
        if required {
            return Err(AppError::new(
                "backgroundremover_unavailable",
                if disabled {
                    "backgroundremover is disabled by BACKGROUNDREMOVER_DISABLED."
                } else {
                    "backgroundremover cannot run while SPRITE_BACKGROUND_REMOVAL_ENGINE is set to builtin."
                },
            ));
        }
        return Ok(None);
    }
    let Some(command) = resolve_backgroundremover_command(state) else {
        if required || engine == "backgroundremover" {
            return Err(AppError::new(
                "backgroundremover_unavailable",
                "backgroundremover is not available. Add a bundled runtime or set BACKGROUNDREMOVER_COMMAND/BACKGROUNDREMOVER_PYTHON.",
            ));
        }
        return Ok(None);
    };
    let runtime_dir = background_remover_runtime_dir(state);
    let model_dir = runtime_dir.join("models");
    fs::create_dir_all(&model_dir)?;
    let work_dir = env::temp_dir().join(format!("marinara-bgrem-{}-{}", now_millis(), new_id()));
    fs::create_dir_all(&work_dir)?;
    let input_path = work_dir.join("input.png");
    let output_path = work_dir.join("output.png");
    let png_input = encode_png(image::load_from_memory(input).map_err(image_error)?)?;
    fs::write(&input_path, png_input)?;

    let mut args = command.args_prefix.clone();
    args.push("-i".to_string());
    args.push(input_path.to_string_lossy().to_string());
    args.push("-o".to_string());
    args.push(output_path.to_string_lossy().to_string());

    let mut process = Command::new(&command.command);
    process.args(args).env(
        "KMP_DUPLICATE_LIB_OK",
        env::var("KMP_DUPLICATE_LIB_OK").unwrap_or_else(|_| "TRUE".to_string()),
    );
    process.env(
        "U2NET_HOME",
        env::var("U2NET_HOME").unwrap_or_else(|_| model_dir.to_string_lossy().to_string()),
    );
    process.env(
        "U2NET_PATH",
        env::var("U2NET_PATH")
            .unwrap_or_else(|_| model_dir.join("u2net.pth").to_string_lossy().to_string()),
    );
    process.env(
        "U2NETP_PATH",
        env::var("U2NETP_PATH")
            .unwrap_or_else(|_| model_dir.join("u2netp.pth").to_string_lossy().to_string()),
    );
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        process.creation_flags(0x08000000);
    }
    let output = process.output();
    let result = match output {
        Ok(output) if output.status.success() && output_path.exists() => {
            fs::read(&output_path).map(Some).map_err(AppError::from)
        }
        Ok(output) => {
            let detail = [
                String::from_utf8_lossy(&output.stdout).to_string(),
                String::from_utf8_lossy(&output.stderr).to_string(),
            ]
            .into_iter()
            .filter(|value| !value.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n");
            if required || engine == "backgroundremover" {
                Err(AppError::new(
                    "backgroundremover_failed",
                    if detail.trim().is_empty() {
                        "backgroundremover did not write an output image".to_string()
                    } else {
                        detail
                    },
                ))
            } else {
                Ok(None)
            }
        }
        Err(error) => {
            if required || engine == "backgroundremover" {
                Err(AppError::new("backgroundremover_failed", error.to_string()))
            } else {
                Ok(None)
            }
        }
    };
    let _ = fs::remove_file(&input_path);
    let _ = fs::remove_file(&output_path);
    let _ = fs::remove_dir_all(&work_dir);
    result
}

fn validate_safe_segment(value: &str, label: &str) -> AppResult<()> {
    if value.is_empty() || value.contains("..") || value.contains('/') || value.contains('\\') {
        Err(AppError::invalid_input(format!("Invalid {label}")))
    } else {
        Ok(())
    }
}

fn image_error(error: image::ImageError) -> AppError {
    AppError::new("image_processing_error", error.to_string())
}

#[cfg(test)]
mod sprite_upload_tests {
    use super::*;
    use std::fs;

    fn test_state(label: &str) -> (AppState, PathBuf) {
        let root = env::temp_dir().join(format!("marinara-sprite-upload-{label}-{}", now_millis()));
        let data_dir = root.join("data");
        let state = AppState::from_data_dir_with_resource_dir(data_dir, Vec::new(), None)
            .expect("test state should initialize");
        (state, root)
    }

    #[test]
    fn bulk_upload_reports_partial_failures_and_returns_refreshed_list() {
        let (state, root) = test_state("bulk");
        let result = upload_sprites(
            &state,
            "character-1",
            json!({
                "sprites": [
                    { "expression": "Happy Face", "image": "data:image/png;base64,aGVsbG8=" },
                    { "expression": "missing-image" },
                    { "expression": "bad-image", "image": "not base64!" }
                ]
            }),
            None,
        )
        .expect("bulk upload should keep partial failures in the result");

        assert_eq!(result.get("imported").and_then(Value::as_u64), Some(1));
        assert_eq!(
            result.get("failed").and_then(Value::as_array).map(Vec::len),
            Some(2)
        );
        let sprites = result
            .get("sprites")
            .and_then(Value::as_array)
            .expect("sprites list should be returned");
        assert_eq!(sprites.len(), 1);
        assert_eq!(
            sprites[0].get("expression").and_then(Value::as_str),
            Some("happy_face")
        );
        assert_eq!(
            sprites[0].get("filename").and_then(Value::as_str),
            Some("happy_face.png")
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn bulk_upload_rejects_unsafe_character_id() {
        let (state, root) = test_state("unsafe-id");
        let error = upload_sprites(
            &state,
            "../character-1",
            json!({ "sprites": [{ "expression": "happy", "image": "data:image/png;base64,aGVsbG8=" }] }),
            None,
        )
        .expect_err("unsafe character IDs should be rejected");

        assert_eq!(error.code, "invalid_input");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn blank_sprite_owner_type_is_rejected() {
        let (state, root) = test_state("blank-owner-type");
        let error = list_sprites(&state, "character-1", Some(" "))
            .expect_err("blank owner types should be rejected");

        assert_eq!(error.code, "invalid_input");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn persona_sprite_owner_is_namespaced_from_character_with_same_id() {
        let (state, root) = test_state("owner-namespace");
        state
            .storage
            .create(
                "characters",
                json!({
                    "id": "shared-id",
                    "data": { "name": "Shared Character" }
                }),
            )
            .expect("character should be created");

        upload_sprite(
            &state,
            "shared-id",
            json!({ "expression": "neutral", "image": "data:image/png;base64,Y2hhcmFjdGVy" }),
            None,
        )
        .expect("character sprite upload should succeed");
        upload_sprite(
            &state,
            "shared-id",
            json!({ "expression": "neutral", "image": "data:image/png;base64,cGVyc29uYQ==" }),
            Some("persona"),
        )
        .expect("persona sprite upload should succeed");

        let character_path = state
            .data_dir
            .join("sprites")
            .join("shared-id")
            .join("neutral.png");
        let persona_path = state
            .data_dir
            .join("sprites")
            .join("personas")
            .join("shared-id")
            .join("neutral.png");
        assert!(character_path.exists());
        assert!(persona_path.exists());

        delete_sprite(&state, "shared-id", "neutral", Some("persona"))
            .expect("persona sprite delete should succeed");

        assert!(character_path.exists());
        assert!(!persona_path.exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn persona_sprite_owner_migrates_legacy_dir_when_no_character_conflicts() {
        let (state, root) = test_state("legacy-persona");
        let legacy_dir = state.data_dir.join("sprites").join("persona-legacy");
        fs::create_dir_all(&legacy_dir).expect("legacy dir should be created");
        fs::write(legacy_dir.join("happy.png"), b"legacy")
            .expect("legacy sprite should be written");

        let sprites = list_sprites(&state, "persona-legacy", Some("persona"))
            .expect("legacy persona sprites should list");

        assert_eq!(
            sprites
                .as_array()
                .and_then(|items| items.first())
                .and_then(|item| item.get("expression"))
                .and_then(Value::as_str),
            Some("happy"),
        );
        assert!(!legacy_dir.exists());
        assert!(state
            .data_dir
            .join("sprites")
            .join("personas")
            .join("persona-legacy")
            .join("happy.png")
            .exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn persona_sprite_owner_merges_legacy_dir_when_target_exists() {
        let (state, root) = test_state("legacy-persona-merge");
        let legacy_dir = state.data_dir.join("sprites").join("persona-merge");
        let next_dir = state
            .data_dir
            .join("sprites")
            .join("personas")
            .join("persona-merge");
        fs::create_dir_all(&legacy_dir).expect("legacy dir should be created");
        fs::create_dir_all(&next_dir).expect("target dir should be created");
        fs::write(legacy_dir.join("happy.png"), b"legacy")
            .expect("legacy sprite should be written");
        fs::write(next_dir.join("sad.png"), b"target").expect("target sprite should be written");

        let sprites = list_sprites(&state, "persona-merge", Some("persona"))
            .expect("legacy persona sprites should merge into existing target");

        let expressions: Vec<_> = sprites
            .as_array()
            .expect("sprites should be an array")
            .iter()
            .filter_map(|item| item.get("expression").and_then(Value::as_str))
            .collect();
        assert_eq!(expressions, vec!["happy", "sad"]);
        assert!(!legacy_dir.exists());
        assert!(next_dir.join("happy.png").exists());
        assert!(next_dir.join("sad.png").exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn persona_sprite_owner_rejects_legacy_merge_conflicts() {
        let (state, root) = test_state("legacy-persona-conflict");
        let legacy_dir = state.data_dir.join("sprites").join("persona-conflict");
        let next_dir = state
            .data_dir
            .join("sprites")
            .join("personas")
            .join("persona-conflict");
        fs::create_dir_all(&legacy_dir).expect("legacy dir should be created");
        fs::create_dir_all(&next_dir).expect("target dir should be created");
        fs::write(legacy_dir.join("happy.png"), b"legacy")
            .expect("legacy sprite should be written");
        fs::write(next_dir.join("happy.png"), b"target").expect("target sprite should be written");

        let error = list_sprites(&state, "persona-conflict", Some("persona"))
            .expect_err("conflicting legacy persona sprites should fail");

        assert_eq!(error.code, "invalid_input");
        assert!(legacy_dir.join("happy.png").exists());
        assert_eq!(
            fs::read(next_dir.join("happy.png")).expect("target sprite should remain readable"),
            b"target"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn persona_sprite_owner_does_not_migrate_namespace_root() {
        let (state, root) = test_state("namespace-root");
        let namespace_dir = state.data_dir.join("sprites").join("personas");
        fs::create_dir_all(&namespace_dir).expect("namespace dir should be created");

        let sprites = list_sprites(&state, "personas", Some("persona"))
            .expect("persona namespace ID should list safely");

        assert!(sprites.as_array().is_some_and(Vec::is_empty));
        assert!(namespace_dir.exists());
        assert!(namespace_dir.join("personas").exists());

        let _ = fs::remove_dir_all(root);
    }
}

#[cfg(test)]
mod background_remover_runtime_tests {
    use super::*;
    use std::fs;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn temp_path(label: &str) -> PathBuf {
        env::temp_dir().join(format!("marinara-bgrem-{label}-{}", now_millis()))
    }

    fn test_state(data_dir: PathBuf, resource_dir: Option<PathBuf>) -> AppState {
        AppState::from_data_dir_with_resource_dir(data_dir, Vec::new(), resource_dir)
            .expect("test state should initialize")
    }

    #[test]
    fn bundled_backgroundremover_is_preferred_before_env_and_path() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|error| error.into_inner());
        let old_command = env::var_os("BACKGROUNDREMOVER_COMMAND");
        env::set_var("BACKGROUNDREMOVER_COMMAND", "external-backgroundremover");

        let root = temp_path("bundled");
        let data_dir = root.join("data");
        let resource_dir = root.join("resources-root");
        let bundled_dir = resource_dir
            .join("resources")
            .join("background-remover")
            .join(
                platform_runtime_dirs(Path::new(""))
                    .into_iter()
                    .next()
                    .expect("platform dir"),
            );
        fs::create_dir_all(&bundled_dir).expect("runtime dir");
        let command_path = bundled_dir.join(if cfg!(windows) {
            "backgroundremover.exe"
        } else {
            "backgroundremover"
        });
        fs::write(&command_path, b"fake").expect("fake command");

        let state = test_state(data_dir, Some(resource_dir));
        let command = resolve_backgroundremover_command(&state).expect("bundled runtime");

        assert_eq!(command.source, "bundled");
        assert_eq!(command.command, command_path);

        if let Some(value) = old_command {
            env::set_var("BACKGROUNDREMOVER_COMMAND", value);
        } else {
            env::remove_var("BACKGROUNDREMOVER_COMMAND");
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn builtin_fallback_reports_builtin_source() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|error| error.into_inner());
        let old_engine = env::var_os("SPRITE_BACKGROUND_REMOVAL_ENGINE");
        env::set_var("SPRITE_BACKGROUND_REMOVAL_ENGINE", "builtin");

        let root = temp_path("builtin");
        let state = test_state(root.join("data"), Some(root.join("resources-root")));
        let status = cleanup_engine_status(&state);

        assert_eq!(
            status.get("source").and_then(Value::as_str),
            Some("builtin")
        );
        assert!(status
            .get("reason")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .contains("Built-in matte cleanup is forced"));

        if let Some(value) = old_engine {
            env::set_var("SPRITE_BACKGROUND_REMOVAL_ENGINE", value);
        } else {
            env::remove_var("SPRITE_BACKGROUND_REMOVAL_ENGINE");
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn forced_backgroundremover_unavailable_does_not_claim_builtin_source() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|error| error.into_inner());
        let old_engine = env::var_os("SPRITE_BACKGROUND_REMOVAL_ENGINE");
        let old_command = env::var_os("BACKGROUNDREMOVER_COMMAND");
        let old_python = env::var_os("BACKGROUNDREMOVER_PYTHON");
        let old_path = env::var_os("PATH");
        env::set_var("SPRITE_BACKGROUND_REMOVAL_ENGINE", "backgroundremover");
        env::remove_var("BACKGROUNDREMOVER_COMMAND");
        env::remove_var("BACKGROUNDREMOVER_PYTHON");
        env::set_var("PATH", "");

        let root = temp_path("required-missing");
        let state = test_state(root.join("data"), Some(root.join("resources-root")));
        let status = cleanup_engine_status(&state);

        assert_eq!(
            status.get("installed").and_then(Value::as_bool),
            Some(false)
        );
        assert_eq!(status.get("source").and_then(Value::as_str), None);
        assert!(status
            .get("reason")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .contains("No bundled backgroundremover runtime"));

        if let Some(value) = old_engine {
            env::set_var("SPRITE_BACKGROUND_REMOVAL_ENGINE", value);
        } else {
            env::remove_var("SPRITE_BACKGROUND_REMOVAL_ENGINE");
        }
        if let Some(value) = old_command {
            env::set_var("BACKGROUNDREMOVER_COMMAND", value);
        } else {
            env::remove_var("BACKGROUNDREMOVER_COMMAND");
        }
        if let Some(value) = old_python {
            env::set_var("BACKGROUNDREMOVER_PYTHON", value);
        } else {
            env::remove_var("BACKGROUNDREMOVER_PYTHON");
        }
        if let Some(value) = old_path {
            env::set_var("PATH", value);
        } else {
            env::remove_var("PATH");
        }
        let _ = fs::remove_dir_all(root);
    }
}
