use super::images::percent_encode_component;
use super::*;
use std::path::Path;

const FONT_EXTS: &[&str] = &["ttf", "otf", "woff", "woff2"];

pub(crate) async fn fonts_call(
    state: &AppState,
    method: &str,
    rest: &[&str],
    body: Value,
) -> AppResult<Value> {
    match (method, rest) {
        ("GET", []) => list_fonts(state),
        ("GET", ["file", filename]) => font_file(state, filename),
        ("POST", ["open-folder"]) => open_fonts_folder(state),
        ("POST", ["google", "download"]) => download_google_font(state, body).await,
        _ => Err(AppError::new(
            "route_not_found",
            format!("fonts route {method} /{} was not found", rest.join("/")),
        )),
    }
}

fn fonts_root(state: &AppState) -> AppResult<std::path::PathBuf> {
    let path = state.data_dir.join("fonts");
    fs::create_dir_all(&path)?;
    Ok(path)
}

fn list_fonts(state: &AppState) -> AppResult<Value> {
    let root = fonts_root(state)?;
    let metadata = read_font_metadata(&root);
    let mut fonts = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let filename = entry.file_name().to_string_lossy().to_string();
        let ext = path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !FONT_EXTS.contains(&ext.as_str()) {
            continue;
        }
        let meta = metadata
            .get(&filename)
            .cloned()
            .unwrap_or_else(|| json!({}));
        fonts.push(json!({
            "filename": filename,
            "family": meta.get("family").and_then(Value::as_str).map(ToOwned::to_owned).unwrap_or_else(|| font_display_name(&filename)),
            "url": format!("tauri-api:/fonts/file/{}", percent_encode_component(&filename)),
            "absolutePath": path.to_string_lossy(),
            "weight": meta.get("weight").and_then(Value::as_str).unwrap_or_else(|| infer_font_weight(&filename)),
            "style": meta.get("style").and_then(Value::as_str).unwrap_or_else(|| infer_font_style(&filename)),
            "unicodeRange": meta.get("unicodeRange").cloned().unwrap_or(Value::Null)
        }));
    }
    fonts.sort_by(|a, b| {
        let af = a.get("family").and_then(Value::as_str).unwrap_or("");
        let bf = b.get("family").and_then(Value::as_str).unwrap_or("");
        af.cmp(bf)
    });
    Ok(Value::Array(fonts))
}

pub(crate) fn font_file_path(state: &AppState, filename: &str) -> AppResult<std::path::PathBuf> {
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err(AppError::invalid_input("Invalid font filename"));
    }
    let root = fonts_root(state)?;
    let path = root.join(filename);
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !FONT_EXTS.contains(&ext.as_str()) {
        return Err(AppError::invalid_input("Not a supported font file"));
    }
    if !path.exists() {
        return Err(AppError::not_found("Font file not found"));
    }
    Ok(path)
}

fn font_file(state: &AppState, filename: &str) -> AppResult<Value> {
    let path = font_file_path(state, filename)?;
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let content_type = match ext.as_str() {
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    };
    Ok(json!({
        "base64": general_purpose::STANDARD.encode(fs::read(path)?),
        "contentType": content_type,
        "filename": filename
    }))
}

fn open_fonts_folder(state: &AppState) -> AppResult<Value> {
    let root = fonts_root(state)?;
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer").arg(&root).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&root).spawn();
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&root).spawn();
    }
    Ok(json!({ "ok": true, "path": root.to_string_lossy() }))
}

async fn download_google_font(state: &AppState, body: Value) -> AppResult<Value> {
    let family = body
        .get("family")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::invalid_input("Font family name is required"))?;
    if family.len() > 100
        || !family
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == ' ')
    {
        return Err(AppError::invalid_input(
            "Invalid font family name. Use only letters, numbers, and spaces.",
        ));
    }

    let root = fonts_root(state)?;
    let faces = fetch_google_font_faces(family).await?;
    let mut metadata = read_font_metadata(&root);
    let safe_name = family.replace(' ', "");
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::new("font_client_error", error.to_string()))?;
    let mut files = Vec::new();
    for (index, face) in faces.iter().enumerate() {
        let suffix = if faces.len() == 1 {
            String::new()
        } else {
            format!("-{:03}", index + 1)
        };
        let filename = format!("{safe_name}-Regular{suffix}.woff2");
        let response = client
            .get(face.url.as_str())
            .send()
            .await
            .map_err(|error| AppError::new("font_download_failed", error.to_string()))?;
        if !response.status().is_success() {
            return Err(AppError::new(
                "font_download_failed",
                format!("Google Fonts returned {}", response.status()),
            ));
        }
        let bytes = response
            .bytes()
            .await
            .map_err(|error| AppError::new("font_download_failed", error.to_string()))?;
        if bytes.len() > 10 * 1024 * 1024 || bytes.get(0..4) != Some(b"wOF2") {
            return Err(AppError::new(
                "font_download_failed",
                "Downloaded file was not a valid woff2 font",
            ));
        }
        fs::write(root.join(&filename), &bytes)?;
        metadata.insert(
            filename.clone(),
            json!({
                "family": family,
                "weight": face.weight,
                "style": face.style,
                "unicodeRange": face.unicode_range,
                "source": "google"
            }),
        );
        files.push(json!({
            "filename": filename,
            "family": family,
            "url": format!("tauri-api:/fonts/file/{}", percent_encode_component(&filename)),
            "weight": face.weight,
            "style": face.style,
            "unicodeRange": face.unicode_range
        }));
    }
    write_font_metadata(&root, &metadata)?;
    Ok(json!({
        "filename": files.first().and_then(|file| file.get("filename")).cloned().unwrap_or_else(|| json!(format!("{safe_name}-Regular.woff2"))),
        "family": family,
        "url": files.first().and_then(|file| file.get("url")).cloned().unwrap_or(Value::Null),
        "files": files
    }))
}

#[derive(Clone)]
struct FontFace {
    url: String,
    weight: String,
    style: String,
    unicode_range: Value,
}

async fn fetch_google_font_faces(family: &str) -> AppResult<Vec<FontFace>> {
    let url = format!(
        "https://fonts.googleapis.com/css2?family={}:wght@400&display=swap",
        percent_encode_component(family)
    );
    let css = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| AppError::new("font_client_error", error.to_string()))?
        .get(url)
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        )
        .send()
        .await
        .map_err(|error| AppError::new("font_lookup_failed", error.to_string()))?;
    if !css.status().is_success() {
        return Err(AppError::new(
            "font_lookup_failed",
            format!("Google Fonts returned {}", css.status()),
        ));
    }
    parse_google_font_faces(
        &css.text()
            .await
            .map_err(|error| AppError::new("font_lookup_failed", error.to_string()))?,
    )
}

fn parse_google_font_faces(css: &str) -> AppResult<Vec<FontFace>> {
    let mut faces = Vec::new();
    for block in css.split("@font-face").skip(1) {
        let Some(start) = block.find('{') else {
            continue;
        };
        let Some(end) = block[start + 1..].find('}') else {
            continue;
        };
        let body = &block[start + 1..start + 1 + end];
        let Some(url_start) = body.find("https://fonts.gstatic.com/") else {
            continue;
        };
        let url_tail = &body[url_start..];
        let url_end = url_tail
            .find(|ch: char| ch == ')' || ch == '"' || ch == '\'' || ch.is_whitespace())
            .unwrap_or(url_tail.len());
        let url = url_tail[..url_end].to_string();
        faces.push(FontFace {
            url,
            weight: css_descriptor(body, "font-weight").unwrap_or_else(|| "400".to_string()),
            style: css_descriptor(body, "font-style").unwrap_or_else(|| "normal".to_string()),
            unicode_range: css_descriptor(body, "unicode-range")
                .map(Value::String)
                .unwrap_or(Value::Null),
        });
    }
    if faces.is_empty() {
        return Err(AppError::not_found("Font not found on Google Fonts"));
    }
    Ok(faces)
}

fn css_descriptor(body: &str, key: &str) -> Option<String> {
    let start = body.find(key)?;
    let rest = &body[start + key.len()..];
    let colon = rest.find(':')?;
    let value = &rest[colon + 1..];
    let semicolon = value.find(';')?;
    Some(
        value[..semicolon]
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .to_string(),
    )
}

fn read_font_metadata(root: &Path) -> Map<String, Value> {
    let path = root.join("font-metadata.json");
    fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

fn write_font_metadata(root: &Path, metadata: &Map<String, Value>) -> AppResult<()> {
    fs::write(
        root.join("font-metadata.json"),
        serde_json::to_vec_pretty(metadata)?,
    )?;
    Ok(())
}

fn font_display_name(filename: &str) -> String {
    Path::new(filename)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(filename)
        .replace(['-', '_'], " ")
        .split_whitespace()
        .filter(|part| {
            !matches!(
                part.to_ascii_lowercase().as_str(),
                "regular" | "bold" | "italic" | "light" | "medium" | "semibold" | "black" | "thin"
            )
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn infer_font_weight(filename: &str) -> &'static str {
    let lower = filename.to_ascii_lowercase();
    if lower.contains("thin") {
        "100"
    } else if lower.contains("light") {
        "300"
    } else if lower.contains("medium") {
        "500"
    } else if lower.contains("semibold") {
        "600"
    } else if lower.contains("bold") {
        "700"
    } else if lower.contains("black") {
        "900"
    } else {
        "400"
    }
}

fn infer_font_style(filename: &str) -> &'static str {
    if filename.to_ascii_lowercase().contains("italic") {
        "italic"
    } else {
        "normal"
    }
}
