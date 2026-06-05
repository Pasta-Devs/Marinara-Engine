use super::shared::*;
use super::*;
use marinara_security::is_allowed_outbound_url;

const MAX_BINARY_RESPONSE_BYTES: u64 = 25 * 1024 * 1024;

pub(crate) async fn http_json(url: &str) -> AppResult<Value> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::new("http_client_error", error.to_string()))?;
    let response = client
        .get(url)
        .header("accept", "application/json")
        .send()
        .await
        .map_err(|error| AppError::new("upstream_request_failed", error.to_string()))?;
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::with_details(
            "upstream_request_failed",
            format!("Upstream returned {status}"),
            json!({ "body": text.chars().take(500).collect::<String>() }),
        ));
    }
    response
        .json::<Value>()
        .await
        .map_err(|error| AppError::new("upstream_json_error", error.to_string()))
}

pub(crate) async fn http_binary(url: &str, fallback_mime: &str) -> AppResult<Value> {
    // Enforce the internal-host/IMDS guard: http_binary fetches content-supplied URLs
    // (avatar/background/image references from imported cards and lorebooks), so local and
    // reserved hosts must be blocked. Managed local assets are resolved by
    // load_local_asset_binary (asset://localhost) before this is ever reached.
    if !is_allowed_outbound_url(url, false) {
        return Err(AppError::invalid_input(format!(
            "Outbound URL is not allowed: {url}"
        )));
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| AppError::new("http_client_error", error.to_string()))?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| AppError::new("upstream_request_failed", error.to_string()))?;
    let status = response.status();
    if !status.is_success() {
        return Err(AppError::new(
            "upstream_request_failed",
            format!("Upstream returned {status}"),
        ));
    }
    let mime_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or(fallback_mime)
        .to_string();
    let normalized_mime = mime_type
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if !allowed_binary_mime(&normalized_mime) {
        return Err(AppError::invalid_input(format!(
            "Unsupported remote content type: {mime_type}"
        )));
    }
    if response.content_length().unwrap_or(0) > MAX_BINARY_RESPONSE_BYTES {
        return Err(AppError::invalid_input("Remote file is too large"));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|error| AppError::new("upstream_body_error", error.to_string()))?;
    if bytes.len() as u64 > MAX_BINARY_RESPONSE_BYTES {
        return Err(AppError::invalid_input("Remote file is too large"));
    }
    Ok(json!({
        "base64": general_purpose::STANDARD.encode(bytes),
        "mimeType": mime_type
    }))
}

fn allowed_binary_mime(mime_type: &str) -> bool {
    mime_type.starts_with("image/")
        || mime_type.starts_with("audio/")
        || mime_type.starts_with("video/")
        || matches!(
            mime_type,
            "application/octet-stream" | "binary/octet-stream"
        )
}

pub(crate) async fn gifs_search(route: &ParsedPath) -> AppResult<Value> {
    let api_key = std::env::var("GIPHY_API_KEY")
        .or_else(|_| std::env::var("VITE_GIPHY_API_KEY"))
        .map_err(|_| {
            AppError::new(
                "external_service_unavailable",
                "GIF search requires GIPHY_API_KEY",
            )
        })?;
    let query = route.query.get("q").cloned().unwrap_or_default();
    let limit = route
        .query
        .get("limit")
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(20)
        .min(50);
    let offset = route
        .query
        .get("pos")
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0);
    let endpoint = if query.trim().is_empty() {
        "trending"
    } else {
        "search"
    };
    let client = reqwest::Client::new();
    let mut request = client
        .get(format!("https://api.giphy.com/v1/gifs/{endpoint}"))
        .query(&[
            ("api_key", api_key.as_str()),
            ("limit", &limit.to_string()),
            ("offset", &offset.to_string()),
            ("rating", "r"),
        ]);
    if !query.trim().is_empty() {
        request = request.query(&[("q", query.as_str())]);
    }
    let data = request
        .send()
        .await
        .map_err(|error| AppError::new("gif_request_failed", error.to_string()))?
        .json::<Value>()
        .await
        .map_err(|error| AppError::new("gif_response_error", error.to_string()))?;
    let items = data
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let pagination = data.get("pagination").cloned().unwrap_or_else(|| json!({}));
    let current_offset = pagination
        .get("offset")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let count = pagination.get("count").and_then(Value::as_u64).unwrap_or(0);
    let total = pagination
        .get("total_count")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let next_offset = current_offset + count;
    let results = items
        .into_iter()
        .map(|item| {
            let images = item.get("images").cloned().unwrap_or_else(|| json!({}));
            let fixed_height = images.get("fixed_height").cloned().unwrap_or_else(|| json!({}));
            let preview = images
                .get("fixed_height_small")
                .and_then(|value| value.get("url"))
                .or_else(|| fixed_height.get("url"))
                .and_then(Value::as_str)
                .unwrap_or("");
            let original = images
                .get("original")
                .and_then(|value| value.get("url"))
                .or_else(|| fixed_height.get("url"))
                .and_then(Value::as_str)
                .unwrap_or("");
            json!({
                "id": item.get("id").and_then(Value::as_str).unwrap_or(""),
                "title": item.get("title").and_then(Value::as_str).unwrap_or(""),
                "preview": preview,
                "url": original,
                "width": fixed_height.get("width").and_then(Value::as_str).and_then(|value| value.parse::<u32>().ok()).unwrap_or(200),
                "height": fixed_height.get("height").and_then(Value::as_str).and_then(|value| value.parse::<u32>().ok()).unwrap_or(200)
            })
        })
        .collect::<Vec<_>>();
    Ok(
        json!({ "results": results, "next": if next_offset < total { next_offset.to_string() } else { String::new() } }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn http_binary_blocks_local_and_reserved_hosts() {
        // The internal-host guard runs before any network request, so these all fail fast.
        for url in [
            "http://169.254.169.254/latest/meta-data/",
            "http://localhost:3000/secret",
            "http://127.0.0.1/",
            "http://10.0.0.5/",
            "http://192.168.1.1/",
            "http://[::1]/",
        ] {
            let error = http_binary(url, "image/png")
                .await
                .expect_err("local/reserved host must be rejected");
            assert_eq!(error.code, "invalid_input", "url {url} should be blocked");
            assert!(error.message.contains("Outbound URL is not allowed"));
        }
    }
}
