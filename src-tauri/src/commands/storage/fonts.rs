use super::images::percent_encode_component;
use super::*;
use std::collections::HashSet;
use std::path::Path;
use std::sync::{LazyLock, Mutex};

const FONT_EXTS: &[&str] = &["ttf", "otf", "woff", "woff2"];
const MAX_FONT_BYTES: usize = 10 * 1024 * 1024;
const GOOGLE_FONTS_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
static DOWNLOADING_GOOGLE_FONTS: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));
static GOOGLE_FONT_METADATA_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));
#[cfg(test)]
static FAIL_NEXT_FONT_METADATA_WRITE: Mutex<bool> = Mutex::new(false);

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

    let safe_name = family.replace(' ', "");
    let _download_guard = GoogleFontDownloadGuard::acquire(&safe_name, family)?;

    download_google_font_inner(state, family, &safe_name).await
}

#[derive(Debug)]
struct GoogleFontDownloadGuard {
    safe_name: String,
}

impl GoogleFontDownloadGuard {
    fn acquire(safe_name: &str, family: &str) -> AppResult<Self> {
        let mut downloading = DOWNLOADING_GOOGLE_FONTS.lock().map_err(|_| {
            AppError::new("font_download_failed", "Font download lock was poisoned")
        })?;
        if !downloading.insert(safe_name.to_string()) {
            return Err(AppError::new(
                "font_download_conflict",
                format!("\"{family}\" is already being downloaded"),
            ));
        }
        Ok(Self {
            safe_name: safe_name.to_string(),
        })
    }
}

impl Drop for GoogleFontDownloadGuard {
    fn drop(&mut self) {
        if let Ok(mut downloading) = DOWNLOADING_GOOGLE_FONTS.lock() {
            downloading.remove(&self.safe_name);
        }
    }
}

async fn download_google_font_inner(
    state: &AppState,
    family: &str,
    safe_name: &str,
) -> AppResult<Value> {
    let root = fonts_root(state)?;
    let faces = fetch_google_font_faces(family).await?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::new("font_client_error", error.to_string()))?;
    let mut downloaded = Vec::new();
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
        if bytes.len() > MAX_FONT_BYTES || bytes.get(0..4) != Some(b"wOF2") {
            return Err(AppError::new(
                "font_download_failed",
                "Downloaded file was not a valid woff2 font",
            ));
        }
        downloaded.push(DownloadedFontFile {
            filename,
            face: face.clone(),
            bytes: bytes.to_vec(),
        });
    }
    replace_managed_google_font_files(&root, safe_name, family, &downloaded)?;
    let files = downloaded
        .iter()
        .map(|download| {
            json!({
                "filename": download.filename,
                "family": family,
                "url": format!("tauri-api:/fonts/file/{}", percent_encode_component(&download.filename)),
                "weight": download.face.weight,
                "style": download.face.style,
                "unicodeRange": download.face.unicode_range
            })
        })
        .collect::<Vec<_>>();
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

struct DownloadedFontFile {
    filename: String,
    face: FontFace,
    bytes: Vec<u8>,
}

async fn fetch_google_font_faces(family: &str) -> AppResult<Vec<FontFace>> {
    let encoded_family = percent_encode_component(family);
    let css2_url = format!(
        "https://fonts.googleapis.com/css2?family={}:wght@400&display=swap",
        encoded_family
    );
    let legacy_url = format!(
        "https://fonts.googleapis.com/css?family={}:400&display=swap",
        encoded_family
    );
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|error| AppError::new("font_client_error", error.to_string()))?;
    let css2 = fetch_google_css(&client, &css2_url).await?;
    let legacy = fetch_google_css(&client, &legacy_url).await?;
    google_font_faces_from_css_results(family, css2, legacy)
}

fn google_font_faces_from_css_results(
    family: &str,
    css2: GoogleCssResult,
    legacy: GoogleCssResult,
) -> AppResult<Vec<FontFace>> {
    let css2_faces = css2
        .css
        .as_deref()
        .map(parse_google_font_faces)
        .transpose()?
        .unwrap_or_default();
    let legacy_faces = legacy
        .css
        .as_deref()
        .map(parse_google_font_faces)
        .transpose()?
        .unwrap_or_default();
    let faces = if legacy_faces.len() > css2_faces.len() {
        legacy_faces
    } else {
        css2_faces
    };
    if !faces.is_empty() {
        return Ok(faces);
    }
    if let Some(error) = [
        css2.request_error.as_deref(),
        legacy.request_error.as_deref(),
    ]
    .into_iter()
    .flatten()
    .next()
    {
        return Err(AppError::new(
            "font_lookup_failed",
            format!("Could not reach Google Fonts. Check your internet connection. {error}"),
        ));
    }
    if !css2.reached_google && !legacy.reached_google {
        return Err(AppError::new(
            "font_lookup_failed",
            "Could not reach Google Fonts. Check your internet connection.",
        ));
    }
    if let Some(status) = [css2.non_success_status, legacy.non_success_status]
        .into_iter()
        .flatten()
        .find(|status| is_retryable_google_status(*status))
    {
        return Err(AppError::new(
            "font_lookup_failed",
            format!("Google Fonts returned {status}"),
        ));
    }
    Err(AppError::not_found(format!(
        "Font \"{family}\" not found on Google Fonts, or has no regular (400) weight available"
    )))
}

struct GoogleCssResult {
    css: Option<String>,
    reached_google: bool,
    non_success_status: Option<reqwest::StatusCode>,
    request_error: Option<String>,
}

async fn fetch_google_css(client: &reqwest::Client, url: &str) -> AppResult<GoogleCssResult> {
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, GOOGLE_FONTS_USER_AGENT)
        .send()
        .await;
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            return Ok(GoogleCssResult {
                css: None,
                reached_google: false,
                non_success_status: None,
                request_error: Some(error.to_string()),
            });
        }
    };
    if !response.status().is_success() {
        return Ok(GoogleCssResult {
            css: None,
            reached_google: true,
            non_success_status: Some(response.status()),
            request_error: None,
        });
    }
    let text = match response.text().await {
        Ok(text) => text,
        Err(error) => {
            return Ok(GoogleCssResult {
                css: None,
                reached_google: true,
                non_success_status: None,
                request_error: Some(error.to_string()),
            });
        }
    };
    Ok(GoogleCssResult {
        css: Some(text),
        reached_google: true,
        non_success_status: None,
        request_error: None,
    })
}

fn is_retryable_google_status(status: reqwest::StatusCode) -> bool {
    status.is_server_error()
        || status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || status == reqwest::StatusCode::REQUEST_TIMEOUT
}

fn parse_google_font_faces(css: &str) -> AppResult<Vec<FontFace>> {
    let mut faces = Vec::new();
    let mut seen = HashSet::new();
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
        let weight = css_descriptor(body, "font-weight").unwrap_or_else(|| "400".to_string());
        let style = css_descriptor(body, "font-style").unwrap_or_else(|| "normal".to_string());
        let unicode_range = css_descriptor(body, "unicode-range")
            .map(Value::String)
            .unwrap_or(Value::Null);
        let key = format!("{url}|{weight}|{style}|{unicode_range}");
        if seen.insert(key) {
            faces.push(FontFace {
                url,
                weight,
                style,
                unicode_range,
            });
        }
    }
    Ok(faces)
}

fn replace_managed_google_font_files(
    root: &Path,
    safe_name: &str,
    family: &str,
    downloaded: &[DownloadedFontFile],
) -> AppResult<()> {
    let _metadata_guard = GOOGLE_FONT_METADATA_LOCK
        .lock()
        .map_err(|_| AppError::new("font_download_failed", "Font metadata lock was poisoned"))?;
    let metadata = read_font_metadata(root);
    for target in downloaded {
        if root.join(&target.filename).exists()
            && metadata
                .get(&target.filename)
                .and_then(|meta| meta.get("source"))
                .and_then(Value::as_str)
                != Some("google")
        {
            return Err(AppError::new(
                "font_download_conflict",
                format!("\"{family}\" is already installed"),
            ));
        }
    }
    let operation_id = format!("{}-{}", now_millis(), std::process::id(),);
    let mut temp_files = Vec::new();
    let mut backups = Vec::new();
    let mut installed_targets = Vec::new();
    let result = (|| -> AppResult<()> {
        for target in downloaded {
            let temp_filename = format!("{}.{}.tmp", target.filename, operation_id);
            fs::write(root.join(&temp_filename), &target.bytes)?;
            temp_files.push(temp_filename);
        }
        for entry in fs::read_dir(root)? {
            let entry = entry?;
            if !entry.path().is_file() {
                continue;
            }
            let filename = entry.file_name().to_string_lossy().to_string();
            if !is_managed_google_family_file(&filename, safe_name, &metadata) {
                continue;
            }
            let backup_filename = format!("{filename}.{operation_id}.bak");
            fs::rename(root.join(&filename), root.join(&backup_filename))?;
            backups.push((filename, backup_filename));
        }
        for target in downloaded {
            let temp_filename = format!("{}.{}.tmp", target.filename, operation_id);
            fs::rename(root.join(&temp_filename), root.join(&target.filename))?;
            temp_files.retain(|filename| filename != &temp_filename);
            installed_targets.push(target.filename.clone());
        }
        let mut next_metadata = metadata;
        for (filename, _) in &backups {
            next_metadata.remove(filename);
        }
        for target in downloaded {
            next_metadata.insert(
                target.filename.clone(),
                json!({
                    "family": family,
                    "weight": target.face.weight,
                    "style": target.face.style,
                    "unicodeRange": target.face.unicode_range,
                    "source": "google"
                }),
            );
        }
        write_font_metadata(root, &next_metadata)?;
        for (_, backup_filename) in &backups {
            let _ = fs::remove_file(root.join(backup_filename));
        }
        Ok(())
    })();
    if result.is_err() {
        for filename in installed_targets {
            let _ = fs::remove_file(root.join(filename));
        }
        for (filename, backup_filename) in backups {
            let _ = fs::rename(root.join(backup_filename), root.join(filename));
        }
        for temp_filename in temp_files {
            let _ = fs::remove_file(root.join(temp_filename));
        }
    }
    result
}

fn is_managed_google_family_file(
    filename: &str,
    safe_name: &str,
    metadata: &Map<String, Value>,
) -> bool {
    let extension = Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !FONT_EXTS.contains(&extension.as_str())
        || !is_legacy_managed_google_filename(filename, safe_name)
    {
        return false;
    }
    metadata
        .get(filename)
        .and_then(|meta| meta.get("source"))
        .and_then(Value::as_str)
        == Some("google")
}

fn is_legacy_managed_google_filename(filename: &str, safe_name: &str) -> bool {
    let Some(stem) = Path::new(filename)
        .file_stem()
        .and_then(|stem| stem.to_str())
    else {
        return false;
    };
    let extension = Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if extension != "woff2" {
        return false;
    }
    let stem = stem.to_ascii_lowercase();
    let legacy_stem = format!("{safe_name}-Regular").to_ascii_lowercase();
    if stem == legacy_stem {
        return true;
    }
    let Some(suffix) = stem.strip_prefix(&format!("{legacy_stem}-")) else {
        return false;
    };
    suffix.len() == 3 && suffix.chars().all(|ch| ch.is_ascii_digit())
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
    #[cfg(test)]
    if let Ok(mut fail_next) = FAIL_NEXT_FONT_METADATA_WRITE.lock() {
        if *fail_next {
            *fail_next = false;
            return Err(AppError::new(
                "font_metadata_write_failed",
                "Injected font metadata write failure",
            ));
        }
    }

    let metadata_path = root.join("font-metadata.json");
    let temp_path = root.join(format!(
        "font-metadata.json.{}-{}.tmp",
        now_millis(),
        std::process::id()
    ));
    let result = (|| -> AppResult<()> {
        fs::write(&temp_path, serde_json::to_vec_pretty(metadata)?)?;
        replace_existing_file(&temp_path, &metadata_path)?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temp_path);
    }
    result
}

fn replace_existing_file(temp: &Path, target: &Path) -> std::io::Result<()> {
    match fs::rename(temp, target) {
        Ok(()) => Ok(()),
        Err(_) if target.exists() => {
            let backup = target.with_file_name(format!(
                "{}.{}-{}.bak",
                target
                    .file_name()
                    .map(|value| value.to_string_lossy())
                    .unwrap_or_else(|| "font-metadata.json".into()),
                now_millis(),
                std::process::id()
            ));
            fs::rename(target, &backup)?;
            match fs::rename(temp, target) {
                Ok(()) => {
                    let _ = fs::remove_file(backup);
                    Ok(())
                }
                Err(error) => {
                    let _ = fs::rename(&backup, target);
                    Err(error)
                }
            }
        }
        Err(error) => Err(error),
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    struct TempFontRoot {
        path: PathBuf,
    }

    impl TempFontRoot {
        fn new(label: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "marinara-fonts-{label}-{}-{}",
                now_millis(),
                new_id()
            ));
            fs::create_dir_all(&path).expect("temp font root should be created");
            Self { path }
        }
    }

    impl Drop for TempFontRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn regular_face() -> FontFace {
        FontFace {
            url: "https://fonts.gstatic.com/s/example/v1/example.woff2".to_string(),
            weight: "400".to_string(),
            style: "normal".to_string(),
            unicode_range: Value::Null,
        }
    }

    fn downloaded_font(filename: &str, bytes: &[u8]) -> DownloadedFontFile {
        DownloadedFontFile {
            filename: filename.to_string(),
            face: regular_face(),
            bytes: bytes.to_vec(),
        }
    }

    fn google_css_result(
        css: Option<&str>,
        reached_google: bool,
        non_success_status: Option<reqwest::StatusCode>,
        request_error: Option<&str>,
    ) -> GoogleCssResult {
        GoogleCssResult {
            css: css.map(ToOwned::to_owned),
            reached_google,
            non_success_status,
            request_error: request_error.map(ToOwned::to_owned),
        }
    }

    #[test]
    fn google_font_lookup_keeps_partial_request_error_when_other_endpoint_is_empty() {
        let result = google_font_faces_from_css_results(
            "Missing Font",
            google_css_result(Some("/* no faces */"), true, None, None),
            google_css_result(None, false, None, Some("connection reset")),
        );
        let error = match result {
            Ok(_) => panic!("partial request failure must not become not found"),
            Err(error) => error,
        };

        assert_eq!(error.code, "font_lookup_failed");
        assert!(
            error.message.contains("connection reset"),
            "transport detail should stay visible"
        );
    }

    #[test]
    fn google_font_lookup_accepts_successful_endpoint_despite_other_request_error() {
        let css = r#"
            @font-face {
                font-family: 'Example';
                font-style: normal;
                font-weight: 400;
                src: url(https://fonts.gstatic.com/s/example/v1/example.woff2) format('woff2');
            }
        "#;

        let faces = google_font_faces_from_css_results(
            "Example",
            google_css_result(Some(css), true, None, None),
            google_css_result(None, false, None, Some("connection reset")),
        )
        .expect("successful endpoint should produce faces");

        assert_eq!(faces.len(), 1);
        assert_eq!(
            faces[0].url,
            "https://fonts.gstatic.com/s/example/v1/example.woff2"
        );
    }

    #[test]
    fn google_font_download_guard_drop_releases_family() {
        let safe_name = format!("GuardedFont{}", new_id().replace('-', ""));
        let first =
            GoogleFontDownloadGuard::acquire(&safe_name, "Guarded Font").expect("first guard");
        let conflict = GoogleFontDownloadGuard::acquire(&safe_name, "Guarded Font")
            .expect_err("second guard should conflict");
        assert_eq!(conflict.code, "font_download_conflict");

        drop(first);

        let second =
            GoogleFontDownloadGuard::acquire(&safe_name, "Guarded Font").expect("guard released");
        drop(second);
    }

    #[test]
    fn replace_managed_google_font_files_rejects_non_google_filename_conflict() {
        let root = TempFontRoot::new("non-google-conflict");
        let filename = "OpenSans-Regular.woff2";
        fs::write(root.path.join(filename), b"custom font").expect("custom font should be written");

        let error = replace_managed_google_font_files(
            &root.path,
            "OpenSans",
            "Open Sans",
            &[downloaded_font(filename, b"new google font")],
        )
        .expect_err("custom filename conflict should be rejected");

        assert_eq!(error.code, "font_download_conflict");
        assert_eq!(
            fs::read(root.path.join(filename)).expect("custom font should remain"),
            b"custom font"
        );
        assert!(
            !root.path.join("font-metadata.json").exists(),
            "metadata should not be created for rejected custom conflict"
        );
    }

    #[test]
    fn replace_managed_google_font_files_restores_prior_file_after_metadata_failure() {
        let root = TempFontRoot::new("metadata-rollback");
        let filename = "Roboto-Regular.woff2";
        fs::write(root.path.join(filename), b"old managed font")
            .expect("old managed font should be written");
        fs::write(
            root.path.join("font-metadata.json"),
            serde_json::to_vec_pretty(&json!({
                filename: {
                    "family": "Roboto",
                    "weight": "400",
                    "style": "normal",
                    "source": "google"
                }
            }))
            .expect("metadata should serialize"),
        )
        .expect("old metadata should be written");

        *FAIL_NEXT_FONT_METADATA_WRITE
            .lock()
            .expect("failure hook lock") = true;
        let error = replace_managed_google_font_files(
            &root.path,
            "Roboto",
            "Roboto",
            &[downloaded_font(filename, b"new managed font")],
        )
        .expect_err("metadata failure should roll back installed font files");

        assert_eq!(error.code, "font_metadata_write_failed");
        assert_eq!(
            fs::read(root.path.join(filename)).expect("old managed font should be restored"),
            b"old managed font"
        );
        let metadata = read_font_metadata(&root.path);
        assert_eq!(
            metadata
                .get(filename)
                .and_then(|entry| entry.get("source"))
                .and_then(Value::as_str),
            Some("google")
        );
        let leftovers = fs::read_dir(&root.path)
            .expect("font root should be readable")
            .filter_map(Result::ok)
            .map(|entry| entry.file_name().to_string_lossy().to_string())
            .filter(|name| name.ends_with(".tmp") || name.ends_with(".bak"))
            .collect::<Vec<_>>();
        assert!(leftovers.is_empty(), "rollback should clean temp files");
    }
}
