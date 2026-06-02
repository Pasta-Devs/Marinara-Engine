use super::http::{http_binary, http_json};
use super::images::percent_encode_component;
use super::shared::*;
use super::*;
use reqwest::StatusCode;

const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const JANNY_SEARCH_URL: &str = "https://search.jannyai.com/multi-search";
const JANNY_IMAGE_BASE: &str = "https://image.jannyai.com/bot-avatars";
const JANNY_SITE_BASE: &str = "https://jannyai.com";
const JANNY_FALLBACK_TOKEN: &str =
    "88a6463b66e04fb07ba87ee3db06af337f492ce511d93df6e2d2968cb2ff2b30";
const JANNY_TOKEN_KEY: &str = "bot-browser-janny-token";
const JANNY_FALLBACK_TOKEN_TTL_MS: u64 = 60_000;
const JANNY_SCRAPED_TOKEN_TTL_MS: u64 = 5 * 60_000;

const CT_API_BASE: &str = "https://character-tavern.com/api";
const CT_CARDS_CDN: &str = "https://cards.character-tavern.com";
const CT_COOKIE_KEY: &str = "bot-browser-chartavern-cookie";

const PYGMALION_API_BASE: &str = "https://server.pygmalion.chat/galatea.v1.PublicCharacterService";
const PYGMALION_ORIGIN: &str = "https://pygmalion.chat";
const PYGMALION_ASSETS_BASE: &str = "https://assets.pygmalion.chat";
const PYGMALION_TOKEN_KEY: &str = "bot-browser-pygmalion-token";

const WYVERN_API_BASE: &str = "https://api.wyvern.chat";
const WYVERN_IMAGE_BASE: &str = "https://imagedelivery.net";

const DATACAT_API_BASE: &str = "https://datacat.run";
const DATACAT_IMAGE_BASE: &str = "https://ella.janitorai.com/bot-avatars";
const DATACAT_SESSION_KEY: &str = "bot-browser-datacat-session-token";
const DATACAT_DEFAULT_MIN_TOTAL_TOKENS: &str = "889";

type Header = (&'static str, String);

pub(crate) async fn bot_browser_call(
    state: &AppState,
    method: &str,
    rest: &[&str],
    route: &ParsedPath,
    body: Value,
) -> AppResult<Value> {
    match (method, rest) {
        ("GET", ["chub", "search"]) => {
            let q = query_param(route, "q", "");
            let page = query_param(route, "page", "1");
            let sort = query_param(route, "sort", "download_count");
            let nsfw = query_param(route, "nsfw", "true");
            let mut params = vec![
                ("search".to_string(), q),
                ("first".to_string(), "48".to_string()),
                ("page".to_string(), page),
                ("nsfw".to_string(), nsfw.clone()),
                ("nsfl".to_string(), nsfw),
                ("include_forks".to_string(), "true".to_string()),
                ("venus".to_string(), "false".to_string()),
                (
                    "min_tokens".to_string(),
                    query_param(route, "min_tokens", "50"),
                ),
            ];
            if sort != "default" {
                params.push(("sort".to_string(), sort));
            }
            for key in [
                "asc",
                "max_days_ago",
                "special_mode",
                "username",
                "max_tokens",
                "tags",
                "excludeTags",
            ] {
                if let Some(value) = query_param_opt(route, key) {
                    let upstream = match key {
                        "tags" => "topics",
                        "excludeTags" => "excludetopics",
                        _ => key,
                    };
                    params.push((upstream.to_string(), value));
                }
            }
            for key in [
                "require_images",
                "require_lore",
                "require_expressions",
                "require_alternate_greetings",
            ] {
                if query_param(route, key, "") == "true" {
                    params.push((key.to_string(), "true".to_string()));
                }
            }
            http_json(&format!(
                "https://api.chub.ai/search?{}",
                query_string_owned(&params)
            ))
            .await
        }
        ("GET", ["chub", "character", path @ ..]) if !path.is_empty() => {
            let full_path = path.join("/");
            http_json(&format!(
                "https://api.chub.ai/api/characters/{}?full=true&nocache={}",
                full_path,
                now_millis()
            ))
            .await
        }
        ("GET", ["chub", "avatar", path @ ..]) if !path.is_empty() => {
            let full_path = path.join("/");
            match http_binary(
                &format!("https://avatars.charhub.io/avatars/{full_path}/avatar.webp"),
                "image/webp",
            )
            .await
            {
                Ok(value) => Ok(value),
                Err(_) => {
                    http_binary(
                        &format!(
                            "https://avatars.charhub.io/avatars/{full_path}/chara_card_v2.png"
                        ),
                        "image/png",
                    )
                    .await
                }
            }
        }
        ("GET", ["chub", "download", path @ ..]) if !path.is_empty() => {
            let full_path = path.join("/");
            http_binary(
                &format!("https://avatars.charhub.io/avatars/{full_path}/chara_card_v2.png"),
                "image/png",
            )
            .await
        }

        ("GET", ["janny", "token"]) => {
            let force = truthy_query(route, "force");
            Ok(json!({ "token": get_janny_search_token(state, force).await? }))
        }
        ("GET", ["janny", "search"]) => {
            let payload = janny_search_payload_from_query(route);
            janny_search(state, None, &payload).await
        }
        ("POST", ["janny", "search"]) => {
            let token = body
                .get("token")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned);
            let payload = body.get("payload").cloned().unwrap_or_else(|| body.clone());
            janny_search(state, token, &payload).await
        }
        ("GET", ["janny", "character", char_id]) => {
            let slug = query_param(route, "slug", "character");
            janny_character(state, &percent_decode_path_component(char_id), &slug).await
        }
        ("GET", ["janny", "avatar", path @ ..]) if !path.is_empty() => {
            let avatar_path = encode_path_preserving_slashes(&decoded_path(path));
            image_binary(
                &format!("{JANNY_IMAGE_BASE}/{avatar_path}"),
                "image/webp",
                &[("image.jannyai.com", false)],
            )
            .await
        }

        ("GET", ["chartavern", "search"]) => chartavern_search(state, route).await,
        ("GET", ["chartavern", "character", author, slug]) => {
            let author = percent_decode_path_component(author);
            let slug = percent_decode_path_component(slug);
            ct_json_get(
                state,
                &format!(
                    "{CT_API_BASE}/character/{}/{}",
                    percent_encode_component(&author),
                    percent_encode_component(&slug)
                ),
            )
            .await
        }
        ("GET", ["chartavern", "download", path @ ..]) if !path.is_empty() => {
            let path = encode_path_preserving_slashes(&decoded_path(path));
            image_binary(
                &format!("{CT_CARDS_CDN}/{path}.png"),
                "image/png",
                &[("cards.character-tavern.com", false)],
            )
            .await
        }
        ("GET", ["chartavern", "avatar", path @ ..]) if !path.is_empty() => {
            let path = encode_path_preserving_slashes(&decoded_path(path));
            match image_binary(
                &format!(
                    "{CT_CARDS_CDN}/cdn-cgi/image/format=auto,width=320,quality=85/{path}.png"
                ),
                "image/png",
                &[("cards.character-tavern.com", false)],
            )
            .await
            {
                Ok(value) => Ok(value),
                Err(_) => {
                    image_binary(
                        &format!("{CT_CARDS_CDN}/{path}.png"),
                        "image/png",
                        &[("cards.character-tavern.com", false)],
                    )
                    .await
                }
            }
        }
        ("GET", ["chartavern", "top-tags"]) => {
            json_get(
                &format!("{CT_API_BASE}/catalog/top-tags"),
                vec![header("Accept", "application/json")],
            )
            .await
        }

        ("GET", ["wyvern", "search"]) => wyvern_search(route).await,
        ("GET", ["wyvern", "character", id]) => {
            let id = percent_decode_path_component(id);
            json_get(
                &format!(
                    "{WYVERN_API_BASE}/characters/{}",
                    percent_encode_component(&id)
                ),
                vec![header("Accept", "application/json")],
            )
            .await
        }
        ("GET", ["wyvern", "search-users"]) => wyvern_search_users(route).await,
        ("GET", ["wyvern", "characters", "user", uid]) => {
            let uid = percent_decode_path_component(uid);
            json_get(
                &format!(
                    "{WYVERN_API_BASE}/characters/user/{}",
                    percent_encode_component(&uid)
                ),
                vec![header("Accept", "application/json")],
            )
            .await
        }
        ("GET", ["wyvern", "avatar", path @ ..]) if !path.is_empty() => {
            let raw = decoded_path(path);
            let url = if raw.starts_with("http://") || raw.starts_with("https://") {
                raw
            } else if raw.contains("imagedelivery.net") {
                format!("https://{raw}")
            } else {
                format!("{WYVERN_IMAGE_BASE}/{raw}")
            };
            image_binary(&url, "image/webp", &[("imagedelivery.net", true)]).await
        }

        ("GET", ["pygmalion", "search"]) => pygmalion_search(state, route).await,
        ("GET", ["pygmalion", "character"]) => pygmalion_character(state, route).await,
        ("GET", ["pygmalion", "avatar", path @ ..]) if !path.is_empty() => {
            let raw = decoded_path(path);
            let url = if raw.starts_with("http://") || raw.starts_with("https://") {
                raw
            } else {
                format!(
                    "{PYGMALION_ASSETS_BASE}/{}",
                    encode_path_preserving_slashes(&raw)
                )
            };
            image_binary(&url, "image/webp", &[("assets.pygmalion.chat", false)]).await
        }

        ("GET", ["datacat", "recent"]) => datacat_recent(state, route).await,
        ("GET", ["datacat", "fresh"]) => datacat_fresh(state, route).await,
        ("GET", ["datacat", "tags"]) => datacat_tags(state, route).await,
        ("GET", ["datacat", "character", id]) => {
            let id = percent_decode_path_component(id);
            datacat_json_get(
                state,
                &format!("/api/characters/{}", percent_encode_component(&id)),
            )
            .await
        }
        ("GET", ["datacat", "download", id]) => {
            let id = percent_decode_path_component(id);
            datacat_json_get(
                state,
                &format!(
                    "/api/characters/{}/download?t={}",
                    percent_encode_component(&id),
                    now_millis()
                ),
            )
            .await
        }
        ("GET", ["datacat", "creator", id]) => {
            let id = percent_decode_path_component(id);
            datacat_json_get(
                state,
                &format!("/api/creators/{}", percent_encode_component(&id)),
            )
            .await
        }
        ("GET", ["datacat", "creator", id, "characters"]) => {
            datacat_creator_characters(state, route, id).await
        }
        ("GET", ["datacat", "avatar", path @ ..]) if !path.is_empty() => {
            let raw = decoded_path(path);
            let url = if raw.starts_with("http://") || raw.starts_with("https://") {
                raw
            } else {
                format!(
                    "{DATACAT_IMAGE_BASE}/{}",
                    encode_path_preserving_slashes(&raw)
                )
            };
            image_binary(&url, "image/webp", &[("ella.janitorai.com", false)]).await
        }

        ("GET", ["pygmalion", "session"]) | ("GET", ["chartavern", "session"]) => {
            let key = if rest.first() == Some(&"pygmalion") {
                PYGMALION_TOKEN_KEY
            } else {
                CT_COOKIE_KEY
            };
            let active = !provider_secret(state, key)?.is_empty();
            if rest.first() == Some(&"pygmalion") {
                Ok(json!({ "active": active, "hasToken": active }))
            } else {
                Ok(json!({ "active": active }))
            }
        }
        ("POST", ["pygmalion", "set-token"]) => set_pygmalion_token(state, &body),
        ("POST", ["chartavern", "set-cookie"]) => set_chartavern_cookie(state, &body),
        ("GET", ["pygmalion", "validate"]) | ("GET", ["chartavern", "validate"]) => {
            if rest.first() == Some(&"pygmalion") {
                validate_pygmalion_token(state).await
            } else {
                validate_chartavern_cookie(state).await
            }
        }
        ("POST", ["pygmalion", "logout"]) => {
            clear_setting(state, PYGMALION_TOKEN_KEY)?;
            Ok(json!({ "ok": true }))
        }
        ("POST", ["chartavern", "logout"]) => {
            clear_setting(state, CT_COOKIE_KEY)?;
            Ok(json!({ "ok": true }))
        }
        _ => Err(AppError::new(
            "route_not_found",
            format!("Unknown bot-browser route: {method} /{}", rest.join("/")),
        )),
    }
}

fn header(name: &'static str, value: impl Into<String>) -> Header {
    (name, value.into())
}

fn http_client(timeout_secs: u64) -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|error| AppError::new("http_client_error", error.to_string()))
}

fn apply_headers(
    mut request: reqwest::RequestBuilder,
    headers: &[Header],
) -> reqwest::RequestBuilder {
    request = request.header(reqwest::header::USER_AGENT, BROWSER_UA);
    for (key, value) in headers {
        if !value.is_empty() {
            request = request.header(*key, value);
        }
    }
    request
}

async fn json_get(url: &str, headers: Vec<Header>) -> AppResult<Value> {
    let response = apply_headers(http_client(30)?.get(url), &headers)
        .send()
        .await
        .map_err(|error| AppError::new("upstream_request_failed", error.to_string()))?;
    upstream_json(response).await
}

async fn json_post(url: &str, body: &Value, headers: Vec<Header>) -> AppResult<Value> {
    let response = apply_headers(http_client(30)?.post(url).json(body), &headers)
        .send()
        .await
        .map_err(|error| AppError::new("upstream_request_failed", error.to_string()))?;
    upstream_json(response).await
}

async fn upstream_json(response: reqwest::Response) -> AppResult<Value> {
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

async fn image_binary(
    url: &str,
    fallback_mime: &str,
    allowed_hosts: &[(&str, bool)],
) -> AppResult<Value> {
    let parsed = parse_allowed_https_url(url, allowed_hosts)?;
    let response = apply_headers(
        http_client(60)?.get(parsed),
        &[header("Accept", "image/*,*/*")],
    )
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
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or(fallback_mime)
        .to_string();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| AppError::new("upstream_body_error", error.to_string()))?;
    let detected = detect_image_mime(bytes.as_ref());
    if !content_type.to_ascii_lowercase().starts_with("image/") && detected.is_none() {
        return Err(AppError::new(
            "unsupported_media_type",
            "Upstream response was not an image",
        ));
    }
    Ok(json!({
        "base64": general_purpose::STANDARD.encode(bytes),
        "mimeType": if content_type.to_ascii_lowercase().starts_with("image/") {
            content_type
        } else {
            detected.unwrap_or(fallback_mime).to_string()
        }
    }))
}

fn parse_allowed_https_url(url: &str, allowed_hosts: &[(&str, bool)]) -> AppResult<reqwest::Url> {
    let parsed =
        reqwest::Url::parse(url).map_err(|_| AppError::invalid_input("Invalid upstream URL"))?;
    if parsed.scheme() != "https" {
        return Err(AppError::invalid_input(
            "Only HTTPS upstream URLs are allowed",
        ));
    }
    let Some(host) = parsed.host_str() else {
        return Err(AppError::invalid_input("Upstream URL is missing a host"));
    };
    let allowed = allowed_hosts
        .iter()
        .any(|(allowed_host, include_subdomains)| {
            host == *allowed_host
                || (*include_subdomains && host.ends_with(&format!(".{allowed_host}")))
        });
    if !allowed {
        return Err(AppError::invalid_input("Unsupported upstream asset host"));
    }
    Ok(parsed)
}

fn detect_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some("image/png");
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some("image/jpeg");
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }
    None
}

fn query_param(route: &ParsedPath, key: &str, fallback: &str) -> String {
    route
        .query
        .get(key)
        .map(|value| percent_decode_query_component(value))
        .unwrap_or_else(|| fallback.to_string())
}

fn query_param_opt(route: &ParsedPath, key: &str) -> Option<String> {
    route
        .query
        .get(key)
        .map(|value| percent_decode_query_component(value))
}

fn truthy_query(route: &ParsedPath, key: &str) -> bool {
    matches!(
        query_param(route, key, "").to_ascii_lowercase().as_str(),
        "1" | "true" | "yes"
    )
}

fn query_string_owned(params: &[(String, String)]) -> String {
    params
        .iter()
        .filter(|(_, value)| !value.is_empty())
        .map(|(key, value)| {
            format!(
                "{}={}",
                percent_encode_component(key),
                percent_encode_component(value)
            )
        })
        .collect::<Vec<_>>()
        .join("&")
}

fn decoded_path(path: &[&str]) -> String {
    path.iter()
        .map(|part| percent_decode_path_component(part))
        .collect::<Vec<_>>()
        .join("/")
}

fn encode_path_preserving_slashes(path: &str) -> String {
    path.split('/')
        .map(percent_encode_component)
        .collect::<Vec<_>>()
        .join("/")
}

fn percent_decode_query_component(value: &str) -> String {
    percent_decode(value, true)
}

fn percent_decode_path_component(value: &str) -> String {
    percent_decode(value, false)
}

fn percent_decode(value: &str, plus_as_space: bool) -> String {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'+' if plus_as_space => {
                output.push(b' ');
                index += 1;
            }
            b'%' if index + 2 < bytes.len() => {
                if let (Some(hi), Some(lo)) =
                    (hex_value(bytes[index + 1]), hex_value(bytes[index + 2]))
                {
                    output.push((hi << 4) | lo);
                    index += 3;
                } else {
                    output.push(bytes[index]);
                    index += 1;
                }
            }
            byte => {
                output.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&output).to_string()
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn provider_secret(state: &AppState, key: &str) -> AppResult<String> {
    Ok(state
        .storage
        .get("app-settings", key)?
        .and_then(|record| {
            record
                .get("value")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
        })
        .unwrap_or_default())
}

fn store_setting_value(state: &AppState, key: &str, value: Value) -> AppResult<Value> {
    state.storage.upsert_with_id("app-settings", key, value)
}

fn clear_setting(state: &AppState, key: &str) -> AppResult<()> {
    let _ = state.storage.delete("app-settings", key)?;
    Ok(())
}

fn now_millis_u64() -> u64 {
    now_millis().min(u64::MAX as u128) as u64
}

fn janny_search_headers(token: &str) -> Vec<Header> {
    vec![
        header("Accept", "*/*"),
        header("Accept-Language", "en-US,en;q=0.9"),
        header("Content-Type", "application/json"),
        header("Authorization", format!("Bearer {token}")),
        header("Origin", JANNY_SITE_BASE),
        header("Referer", format!("{JANNY_SITE_BASE}/")),
        header(
            "x-meilisearch-client",
            "Meilisearch instant-meilisearch (v0.19.0) ; Meilisearch JavaScript (v0.41.0)",
        ),
        header("Sec-Fetch-Site", "same-site"),
        header("Sec-Fetch-Mode", "cors"),
        header("Sec-Fetch-Dest", "empty"),
        header(
            "sec-ch-ua",
            "\"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\", \"Google Chrome\";v=\"131\"",
        ),
        header("sec-ch-ua-mobile", "?0"),
        header("sec-ch-ua-platform", "\"Windows\""),
    ]
}

fn janny_search_payload_from_query(route: &ParsedPath) -> Value {
    let q = query_param(route, "q", "");
    let page = query_param(route, "page", "1").parse::<u64>().unwrap_or(1);
    let limit = query_param(route, "limit", "80")
        .parse::<u64>()
        .unwrap_or(80);
    let min_tokens = query_param(route, "min_tokens", "29")
        .parse::<u64>()
        .unwrap_or(29);
    let max_tokens = query_param(route, "max_tokens", "100000")
        .parse::<u64>()
        .unwrap_or(100000);
    let sort = query_param(route, "sort", "newest");
    let nsfw = query_param(route, "nsfw", "true");
    let show_low_quality = query_param(route, "showLowQuality", "false");

    let mut filters = vec![
        format!("totalToken >= {min_tokens}"),
        format!("totalToken <= {max_tokens}"),
    ];
    if nsfw != "true" {
        filters.push("isNsfw = false".to_string());
    }
    if show_low_quality != "true" {
        filters.push("isLowQuality = false".to_string());
    }
    if let Some(tag_ids) = query_param_opt(route, "tagIds") {
        let clauses = tag_ids
            .split(',')
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .map(|id| format!("tagIds = {id}"))
            .collect::<Vec<_>>();
        if !clauses.is_empty() {
            filters.push(clauses.join(" AND "));
        }
    }

    let sort_arr = match sort.as_str() {
        "oldest" => vec!["createdAtStamp:asc"],
        "tokens_desc" => vec!["totalToken:desc"],
        "tokens_asc" => vec!["totalToken:asc"],
        "relevant" => Vec::new(),
        _ => vec!["createdAtStamp:desc"],
    };
    let mut query = json!({
        "indexUid": "janny-characters",
        "q": q,
        "facets": ["isLowQuality", "isNsfw", "tagIds", "totalToken"],
        "attributesToCrop": ["description:300"],
        "cropMarker": "...",
        "filter": filters,
        "attributesToHighlight": ["name", "description"],
        "highlightPreTag": "__ais-highlight__",
        "highlightPostTag": "__/ais-highlight__",
        "hitsPerPage": limit,
        "page": page
    });
    if !sort_arr.is_empty() {
        query["sort"] = json!(sort_arr);
    }
    json!({ "queries": [query] })
}

async fn janny_search(
    state: &AppState,
    explicit_token: Option<String>,
    payload: &Value,
) -> AppResult<Value> {
    let mut token = match explicit_token.as_ref() {
        Some(token) => token.clone(),
        None => get_janny_search_token(state, false).await?,
    };
    let mut force_refreshed = false;

    loop {
        let response = apply_headers(
            http_client(30)?.post(JANNY_SEARCH_URL).json(payload),
            &janny_search_headers(&token),
        )
        .send()
        .await
        .map_err(|error| AppError::new("upstream_request_failed", error.to_string()))?;

        if matches!(
            response.status(),
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
        ) && explicit_token.is_none()
            && !force_refreshed
        {
            clear_setting(state, JANNY_TOKEN_KEY)?;
            token = get_janny_search_token(state, true).await?;
            force_refreshed = true;
            continue;
        }

        if response.status() == StatusCode::FORBIDDEN {
            let cf_mitigated = response.headers().get("cf-mitigated").is_some();
            if cf_mitigated {
                clear_setting(state, JANNY_TOKEN_KEY)?;
                return Err(AppError::new(
                    "upstream_blocked",
                    "JannyAI is blocking this request with Cloudflare bot mitigation",
                ));
            }
        }

        if matches!(
            response.status(),
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
        ) {
            clear_setting(state, JANNY_TOKEN_KEY)?;
        }
        return upstream_json(response).await;
    }
}

async fn get_janny_search_token(state: &AppState, force: bool) -> AppResult<String> {
    if !force {
        if let Some((token, is_fallback, fetched_at)) = cached_janny_token(state)? {
            let ttl = if is_fallback {
                JANNY_FALLBACK_TOKEN_TTL_MS
            } else {
                JANNY_SCRAPED_TOKEN_TTL_MS
            };
            if now_millis_u64().saturating_sub(fetched_at) < ttl {
                return Ok(token);
            }
        }
    } else {
        clear_setting(state, JANNY_TOKEN_KEY)?;
    }

    let (token, is_fallback) = scrape_janny_token().await;
    store_setting_value(
        state,
        JANNY_TOKEN_KEY,
        json!({
            "value": token,
            "isFallback": is_fallback,
            "fetchedAt": now_millis_u64()
        }),
    )?;
    Ok(token)
}

fn cached_janny_token(state: &AppState) -> AppResult<Option<(String, bool, u64)>> {
    let Some(record) = state.storage.get("app-settings", JANNY_TOKEN_KEY)? else {
        return Ok(None);
    };
    let Some(token) = record
        .get("value")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(ToOwned::to_owned)
    else {
        return Ok(None);
    };
    let is_fallback = record
        .get("isFallback")
        .and_then(Value::as_bool)
        .unwrap_or(token == JANNY_FALLBACK_TOKEN);
    let fetched_at = record
        .get("fetchedAt")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    Ok(Some((token, is_fallback, fetched_at)))
}

async fn scrape_janny_token() -> (String, bool) {
    let Some(html) = fetch_janny_page("/characters/search").await else {
        return (JANNY_FALLBACK_TOKEN.to_string(), true);
    };

    let mut config_path = find_asset_js(&html, "client-config.");
    if config_path.is_none() {
        if let Some(search_page_path) = find_asset_js(&html, "SearchPage.") {
            if let Some(search_page_js) = fetch_janny_page(&search_page_path).await {
                config_path = find_asset_js(&search_page_js, "client-config.");
            }
        }
    }

    if let Some(config_path) = config_path {
        if let Some(config_js) = fetch_janny_page(&config_path).await {
            if let Some(token) = find_hex_token(&config_js) {
                return (token, false);
            }
        }
    }

    (JANNY_FALLBACK_TOKEN.to_string(), true)
}

fn find_asset_js(haystack: &str, prefix: &str) -> Option<String> {
    let start = haystack.find(prefix)?;
    let rest = &haystack[start..];
    let end = rest.find(".js")? + ".js".len();
    let file = &rest[..end];
    Some(format!("/_astro/{file}"))
}

fn find_hex_token(haystack: &str) -> Option<String> {
    let bytes = haystack.as_bytes();
    if bytes.len() < 64 {
        return None;
    }
    for window in bytes.windows(64) {
        if window.iter().all(|byte| byte.is_ascii_hexdigit()) {
            return Some(String::from_utf8_lossy(window).to_string());
        }
    }
    None
}

async fn fetch_janny_page(path: &str) -> Option<String> {
    let url = if path.starts_with("http://") || path.starts_with("https://") {
        path.to_string()
    } else {
        format!("{JANNY_SITE_BASE}{path}")
    };
    if let Some(html) = fetch_text_optional(
        &url,
        vec![header("Accept", "text/html,application/xhtml+xml,*/*")],
        15,
    )
    .await
    {
        return Some(html);
    }
    fetch_text_optional(
        &format!(
            "https://corsproxy.io/?url={}",
            percent_encode_component(&url)
        ),
        vec![
            header("Accept", "text/html,application/xhtml+xml,*/*"),
            header("Origin", JANNY_SITE_BASE),
        ],
        15,
    )
    .await
}

async fn fetch_text_optional(url: &str, headers: Vec<Header>, timeout_secs: u64) -> Option<String> {
    let client = http_client(timeout_secs).ok()?;
    let response = apply_headers(client.get(url), &headers).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    response.text().await.ok()
}

async fn janny_character(state: &AppState, char_id: &str, slug: &str) -> AppResult<Value> {
    let page_path = format!(
        "/characters/{}_{}",
        percent_encode_component(char_id),
        percent_encode_component(slug)
    );
    let html = fetch_janny_page(&page_path)
        .await
        .filter(|html| !is_janny_challenge_html(html))
        .ok_or_else(|| AppError::not_found("Could not fetch JannyAI character page"))?;

    let props = extract_janny_astro_props(&html)
        .ok_or_else(|| AppError::not_found("Could not parse character data from JannyAI page"))?;
    let props_decoded = html_unescape(&props);
    let props_json: Value = serde_json::from_str(&props_decoded)
        .map_err(|error| AppError::new("upstream_json_error", error.to_string()))?;
    let mut character = props_json
        .get("character")
        .map(decode_astro_value)
        .ok_or_else(|| AppError::not_found("No character data found in JannyAI page"))?;

    if let Some(username) = extract_janny_creator_username(&html) {
        if let Value::Object(object) = &mut character {
            object.insert("creatorUsername".to_string(), Value::String(username));
        }
    }

    let needs_backfill = character
        .get("tagIds")
        .and_then(Value::as_array)
        .is_none_or(Vec::is_empty)
        || character.get("creatorId").and_then(Value::as_str).is_none();
    if needs_backfill {
        let name = character
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        if let Some(hit) = backfill_janny_from_search(state, &name, char_id).await {
            if let Value::Object(object) = &mut character {
                let missing_tags = object
                    .get("tagIds")
                    .and_then(Value::as_array)
                    .is_none_or(Vec::is_empty);
                if missing_tags {
                    if let Some(tag_ids) = hit.get("tagIds") {
                        object.insert("tagIds".to_string(), tag_ids.clone());
                    }
                }
                if object.get("creatorId").and_then(Value::as_str).is_none() {
                    if let Some(creator_id) = hit.get("creatorId") {
                        object.insert("creatorId".to_string(), creator_id.clone());
                    }
                }
            }
        }
    }

    Ok(json!({ "character": character, "success": true }))
}

fn is_janny_challenge_html(html: &str) -> bool {
    html.len() < 1000
        || html.contains("Just a moment")
        || html.contains("cf-challenge")
        || html.contains("challenge-platform")
        || !html.contains("astro-island")
}

fn extract_janny_astro_props(html: &str) -> Option<String> {
    let mut offset = 0;
    let mut fallback = None;
    while let Some(relative) = html[offset..].find("astro-island") {
        let start = offset + relative;
        let end = start + html[start..].find('>')?;
        let tag = &html[start..=end];
        if let Some(props) = extract_attr(tag, "props") {
            if tag.contains("component-export=\"CharacterButtons\"") {
                return Some(props);
            }
            if fallback.is_none() && props.contains("character") {
                fallback = Some(props);
            }
        }
        offset = end + 1;
    }
    fallback
}

fn extract_attr(tag: &str, name: &str) -> Option<String> {
    let needle = format!("{name}=\"");
    let start = tag.find(&needle)? + needle.len();
    let rest = &tag[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn decode_astro_value(value: &Value) -> Value {
    match value {
        Value::Array(items) if items.len() == 2 && items[0].as_i64().is_some() => {
            let kind = items[0].as_i64().unwrap_or_default();
            let data = &items[1];
            match kind {
                0 => decode_astro_value(data),
                1 => Value::Array(
                    data.as_array()
                        .map(|items| items.iter().map(decode_astro_value).collect())
                        .unwrap_or_default(),
                ),
                _ => data.clone(),
            }
        }
        Value::Array(items) => Value::Array(items.iter().map(decode_astro_value).collect()),
        Value::Object(object) => {
            let decoded = object
                .iter()
                .map(|(key, value)| (key.clone(), decode_astro_value(value)))
                .collect();
            Value::Object(decoded)
        }
        _ => value.clone(),
    }
}

fn extract_janny_creator_username(html: &str) -> Option<String> {
    let creator_index = html.find("Creator:")?;
    let rest = &html[creator_index..];
    let anchor_index = rest.find("<a")?;
    let anchor = &rest[anchor_index..];
    let content_start = anchor.find('>')? + 1;
    let content_rest = &anchor[content_start..];
    let content_end = content_rest.find("</a>")?;
    let username = strip_html_tags(&html_unescape(&content_rest[..content_end]))
        .trim()
        .trim_start_matches('@')
        .to_string();
    (!username.is_empty()).then_some(username)
}

fn strip_html_tags(value: &str) -> String {
    let mut output = String::new();
    let mut inside_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => output.push(ch),
            _ => {}
        }
    }
    output
}

fn html_unescape(value: &str) -> String {
    value
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#39;", "'")
}

async fn backfill_janny_from_search(state: &AppState, name: &str, char_id: &str) -> Option<Value> {
    if name.trim().is_empty() {
        return None;
    }
    let payload = json!({
        "queries": [{
            "indexUid": "janny-characters",
            "q": name,
            "hitsPerPage": 20,
            "page": 1
        }]
    });
    let data = janny_search(state, None, &payload).await.ok()?;
    data.get("results")
        .and_then(Value::as_array)
        .and_then(|results| results.first())
        .and_then(|result| result.get("hits"))
        .and_then(Value::as_array)
        .and_then(|hits| {
            hits.iter()
                .find(|hit| hit.get("id").and_then(Value::as_str) == Some(char_id))
                .cloned()
        })
}

fn chartavern_search_params(route: &ParsedPath) -> Vec<(String, String)> {
    let mut params = vec![
        ("query".to_string(), query_param(route, "q", "")),
        (
            "sort".to_string(),
            query_param(route, "sort", "most_popular"),
        ),
        ("page".to_string(), query_param(route, "page", "1")),
        ("limit".to_string(), query_param(route, "limit", "60")),
    ];
    if let Some(tags) = query_param_opt(route, "tags") {
        params.push(("tags".to_string(), tags));
    }
    let mut exclude_list = query_param_opt(route, "excludeTags")
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if query_param(route, "nsfw", "true") != "true"
        && !exclude_list
            .iter()
            .any(|value| value.eq_ignore_ascii_case("nsfw"))
    {
        exclude_list.push("nsfw".to_string());
    }
    if !exclude_list.is_empty() {
        params.push(("exclude_tags".to_string(), exclude_list.join(",")));
    }
    for (local, upstream) in [
        ("min_tokens", "minimum_tokens"),
        ("max_tokens", "maximum_tokens"),
    ] {
        if let Some(value) = query_param_opt(route, local).filter(|value| value != "0") {
            params.push((upstream.to_string(), value));
        }
    }
    if truthy_query(route, "hasLorebook") {
        params.push(("hasLorebook".to_string(), "true".to_string()));
    }
    if truthy_query(route, "isOC") {
        params.push(("isOC".to_string(), "true".to_string()));
    }
    params
}

async fn chartavern_search(state: &AppState, route: &ParsedPath) -> AppResult<Value> {
    ct_json_get(
        state,
        &format!(
            "{CT_API_BASE}/search/cards?{}",
            query_string_owned(&chartavern_search_params(route))
        ),
    )
    .await
}

fn ct_headers(state: &AppState) -> AppResult<Vec<Header>> {
    let cookie = provider_secret(state, CT_COOKIE_KEY)?;
    Ok(vec![
        header("Accept", "application/json"),
        header("Cookie", cookie),
    ])
}

async fn ct_json_get(state: &AppState, url: &str) -> AppResult<Value> {
    let cookie = provider_secret(state, CT_COOKIE_KEY)?;
    let response = apply_headers(http_client(30)?.get(url), &ct_headers(state)?)
        .send()
        .await
        .map_err(|error| AppError::new("upstream_request_failed", error.to_string()))?;
    if response.status() == StatusCode::FORBIDDEN && !cookie.is_empty() {
        clear_setting(state, CT_COOKIE_KEY)?;
    }
    upstream_json(response).await
}

fn set_chartavern_cookie(state: &AppState, body: &Value) -> AppResult<Value> {
    let cookie = body
        .get("cookie")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::invalid_input("cookie is required"))?;
    let value = cookie.strip_prefix("session=").unwrap_or(cookie).trim();
    if value.is_empty()
        || value.len() > 4096
        || value.contains(';')
        || value.chars().any(char::is_whitespace)
    {
        return Err(AppError::invalid_input(
            "Invalid cookie value. Paste only the session cookie value.",
        ));
    }
    store_setting_value(
        state,
        CT_COOKIE_KEY,
        json!({ "value": format!("session={value}") }),
    )?;
    Ok(json!({ "ok": true, "stored": true }))
}

async fn validate_chartavern_cookie(state: &AppState) -> AppResult<Value> {
    let cookie = provider_secret(state, CT_COOKIE_KEY)?;
    if cookie.is_empty() {
        return Ok(json!({ "valid": false, "reason": "no cookies stored" }));
    }
    let response = apply_headers(
        http_client(15)?.get(format!("{CT_API_BASE}/search/cards?query=test&limit=5")),
        &ct_headers(state)?,
    )
    .send()
    .await
    .map_err(|error| AppError::new("bot_browser_http_error", error.to_string()))?;
    if response.status().is_success() {
        let rejected = response
            .headers()
            .get("set-cookie")
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.contains("session=;") || value.contains("Max-Age=0"));
        let json: Value = response.json().await.unwrap_or_else(|_| json!({}));
        if rejected {
            clear_setting(state, CT_COOKIE_KEY)?;
            return Ok(json!({ "valid": false, "reason": "Session rejected/expired by server" }));
        }
        let has_nsfw = json
            .get("hits")
            .and_then(Value::as_array)
            .is_some_and(|hits| {
                hits.iter()
                    .any(|hit| hit.get("isNSFW").and_then(Value::as_bool).unwrap_or(false))
            });
        return Ok(json!({ "valid": true, "hasNsfw": has_nsfw }));
    }
    if response.status() == StatusCode::FORBIDDEN {
        clear_setting(state, CT_COOKIE_KEY)?;
        return Ok(json!({ "valid": false, "reason": "rejected (cookies expired or invalid)" }));
    }
    Ok(json!({ "valid": false, "reason": format!("HTTP {}", response.status()) }))
}

async fn wyvern_search(route: &ParsedPath) -> AppResult<Value> {
    let mut params = vec![
        ("limit".to_string(), query_param(route, "limit", "48")),
        ("page".to_string(), query_param(route, "page", "1")),
    ];
    if let Some(tags) = query_param_opt(route, "tags") {
        params.push(("tags".to_string(), tags));
    }
    if let Some(rating) = query_param_opt(route, "rating") {
        params.push(("rating".to_string(), rating));
    }
    let q = query_param(route, "q", "");
    if q.is_empty() {
        params.push(("sort".to_string(), query_param(route, "sort", "popular")));
        params.push(("order".to_string(), query_param(route, "order", "DESC")));
    } else {
        params.push(("q".to_string(), q));
    }
    json_get(
        &format!(
            "{WYVERN_API_BASE}/exploreSearch/characters?{}",
            query_string_owned(&params)
        ),
        vec![header("Accept", "application/json")],
    )
    .await
}

async fn wyvern_search_users(route: &ParsedPath) -> AppResult<Value> {
    let q = query_param(route, "q", "");
    if q.is_empty() {
        return Err(AppError::invalid_input("Missing query"));
    }
    let params = vec![
        ("q".to_string(), q),
        ("page".to_string(), query_param(route, "page", "1")),
        ("limit".to_string(), query_param(route, "limit", "10")),
    ];
    json_get(
        &format!(
            "{WYVERN_API_BASE}/exploreSearch/users?{}",
            query_string_owned(&params)
        ),
        vec![header("Accept", "application/json")],
    )
    .await
}

fn pygmalion_message(route: &ParsedPath) -> Value {
    let mut message = Map::new();
    message.insert("query".to_string(), json!(query_param(route, "q", "")));
    message.insert(
        "orderBy".to_string(),
        json!(query_param(route, "orderBy", "downloads")),
    );
    message.insert(
        "orderDescending".to_string(),
        json!(query_param(route, "orderDescending", "true") == "true"),
    );
    message.insert(
        "pageSize".to_string(),
        json!(query_param(route, "pageSize", "48")
            .parse::<u64>()
            .unwrap_or(48)),
    );
    message.insert(
        "page".to_string(),
        json!(query_param(route, "page", "0").parse::<u64>().unwrap_or(0)),
    );
    if let Some(tags) = query_param_opt(route, "tagsInclude") {
        let tags = split_csv(&tags);
        if !tags.is_empty() {
            message.insert("tagsNamesInclude".to_string(), json!(tags));
        }
    }
    if let Some(tags) = query_param_opt(route, "tagsExclude") {
        let tags = split_csv(&tags);
        if !tags.is_empty() {
            message.insert("tagsNamesExclude".to_string(), json!(tags));
        }
    }
    Value::Object(message)
}

async fn pygmalion_search(state: &AppState, route: &ParsedPath) -> AppResult<Value> {
    let mut message = pygmalion_message(route);
    let token = provider_secret(state, PYGMALION_TOKEN_KEY)?;
    if !token.is_empty() && truthy_query(route, "includeSensitive") {
        message["includeSensitive"] = Value::Bool(true);
        pygmalion_authenticated_post(state, "CharacterSearch", &message).await
    } else {
        pygmalion_public_get("CharacterSearch", &message).await
    }
}

async fn pygmalion_character(state: &AppState, route: &ParsedPath) -> AppResult<Value> {
    let id = query_param_opt(route, "id")
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::invalid_input("Missing character id"))?;
    let mut message = Map::new();
    message.insert("characterMetaId".to_string(), Value::String(id));
    if let Some(version_id) = query_param_opt(route, "versionId").filter(|value| !value.is_empty())
    {
        message.insert("characterVersionId".to_string(), Value::String(version_id));
    }
    let message = Value::Object(message);
    if provider_secret(state, PYGMALION_TOKEN_KEY)?.is_empty() {
        pygmalion_public_get("Character", &message).await
    } else {
        pygmalion_authenticated_post(state, "Character", &message).await
    }
}

async fn pygmalion_public_get(endpoint: &str, message: &Value) -> AppResult<Value> {
    let params = vec![
        ("connect".to_string(), "v1".to_string()),
        ("encoding".to_string(), "json".to_string()),
        ("message".to_string(), message.to_string()),
    ];
    json_get(
        &format!(
            "{PYGMALION_API_BASE}/{endpoint}?{}",
            query_string_owned(&params)
        ),
        vec![header("Accept", "application/json")],
    )
    .await
}

async fn pygmalion_authenticated_post(
    state: &AppState,
    endpoint: &str,
    message: &Value,
) -> AppResult<Value> {
    let token = provider_secret(state, PYGMALION_TOKEN_KEY)?;
    if token.is_empty() {
        return Err(AppError::invalid_input("No Pygmalion token stored"));
    }
    let response = apply_headers(
        http_client(30)?
            .post(format!("{PYGMALION_API_BASE}/{endpoint}"))
            .json(message),
        &[
            header("Content-Type", "application/json"),
            header("Accept", "application/json"),
            header("Authorization", format!("Bearer {token}")),
            header("Origin", PYGMALION_ORIGIN),
            header("Referer", format!("{PYGMALION_ORIGIN}/")),
        ],
    )
    .send()
    .await
    .map_err(|error| AppError::new("upstream_request_failed", error.to_string()))?;
    if matches!(
        response.status(),
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
    ) {
        clear_setting(state, PYGMALION_TOKEN_KEY)?;
    }
    upstream_json(response).await
}

fn set_pygmalion_token(state: &AppState, body: &Value) -> AppResult<Value> {
    let token = body
        .get("token")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::invalid_input("token is required"))?;
    let value = token
        .strip_prefix("Bearer ")
        .or_else(|| token.strip_prefix("bearer "))
        .unwrap_or(token)
        .trim();
    if value.is_empty() || value.len() > 8192 || value.chars().any(char::is_whitespace) {
        return Err(AppError::invalid_input(
            "Invalid token value. Paste only the token string.",
        ));
    }
    store_setting_value(state, PYGMALION_TOKEN_KEY, json!({ "value": value }))?;
    Ok(json!({ "ok": true, "stored": true }))
}

async fn validate_pygmalion_token(state: &AppState) -> AppResult<Value> {
    let token = provider_secret(state, PYGMALION_TOKEN_KEY)?;
    if token.is_empty() {
        return Ok(json!({ "valid": false, "reason": "no token stored" }));
    }
    let response = apply_headers(
        http_client(15)?
            .post(format!("{PYGMALION_API_BASE}/CharacterSearch"))
            .json(&json!({
                "query": "",
                "orderBy": "downloads",
                "orderDescending": true,
                "pageSize": 1,
                "page": 0,
                "includeSensitive": true
            })),
        &[
            header("Content-Type", "application/json"),
            header("Accept", "application/json"),
            header("Authorization", format!("Bearer {token}")),
            header("Origin", PYGMALION_ORIGIN),
            header("Referer", format!("{PYGMALION_ORIGIN}/")),
        ],
    )
    .send()
    .await
    .map_err(|error| AppError::new("bot_browser_http_error", error.to_string()))?;
    if response.status().is_success() {
        return Ok(json!({ "valid": true }));
    }
    if matches!(
        response.status(),
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
    ) {
        clear_setting(state, PYGMALION_TOKEN_KEY)?;
        return Ok(json!({ "valid": false, "reason": "Token rejected (expired or invalid)" }));
    }
    Ok(json!({ "valid": false, "reason": format!("HTTP {}", response.status()) }))
}

fn split_csv(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

async fn datacat_recent(state: &AppState, route: &ParsedPath) -> AppResult<Value> {
    let mut params = vec![
        ("limit".to_string(), query_param(route, "limit", "80")),
        ("offset".to_string(), query_param(route, "offset", "0")),
        ("summary".to_string(), "1".to_string()),
        (
            "minTotalTokens".to_string(),
            query_param(route, "min_tokens", DATACAT_DEFAULT_MIN_TOTAL_TOKENS),
        ),
    ];
    if let Some(tag_ids) = query_param_opt(route, "tagIds") {
        let ids = split_csv(&tag_ids);
        if !ids.is_empty() {
            params.push(("tagIds".to_string(), ids.join(",")));
        }
    }
    if let Some(search) = query_param_opt(route, "q").filter(|value| !value.trim().is_empty()) {
        params.push(("search".to_string(), search.trim().to_string()));
    }
    datacat_json_get(
        state,
        &format!(
            "/api/characters/recent-public?{}",
            query_string_owned(&params)
        ),
    )
    .await
}

async fn datacat_fresh(state: &AppState, route: &ParsedPath) -> AppResult<Value> {
    let params = vec![
        ("summary".to_string(), "1".to_string()),
        ("sortBy".to_string(), query_param(route, "sortBy", "score")),
        ("limit24".to_string(), query_param(route, "limit24", "80")),
        (
            "limitWeek".to_string(),
            query_param(route, "limitWeek", "20"),
        ),
    ];
    let fresh = datacat_json_get(
        state,
        &format!("/api/characters/fresh?{}", query_string_owned(&params)),
    )
    .await;

    match fresh {
        Ok(value) => Ok(value),
        Err(error) if error.code == "upstream_json_error" => {
            datacat_fresh_recent_fallback(state, route).await
        }
        Err(error) => Err(error),
    }
}

async fn datacat_fresh_recent_fallback(state: &AppState, route: &ParsedPath) -> AppResult<Value> {
    let params = vec![
        ("limit".to_string(), query_param(route, "limit24", "80")),
        ("offset".to_string(), "0".to_string()),
        ("summary".to_string(), "1".to_string()),
        (
            "minTotalTokens".to_string(),
            query_param(route, "min_tokens", DATACAT_DEFAULT_MIN_TOTAL_TOKENS),
        ),
    ];
    let recent = datacat_json_get(
        state,
        &format!(
            "/api/characters/recent-public?{}",
            query_string_owned(&params)
        ),
    )
    .await?;
    datacat_recent_as_fresh_response(recent)
}

fn datacat_recent_as_fresh_response(mut recent: Value) -> AppResult<Value> {
    if recent.get("success").and_then(Value::as_bool) != Some(true) {
        return Err(AppError::new(
            "upstream_response_error",
            "DataCat recent fallback did not report success",
        ));
    }
    let characters = recent
        .get_mut("characters")
        .and_then(Value::as_array_mut)
        .map(|items| Value::Array(std::mem::take(items)))
        .ok_or_else(|| {
            AppError::new(
                "upstream_response_error",
                "DataCat recent fallback did not include characters",
            )
        })?;
    let count = characters.as_array().map(Vec::len).unwrap_or_default();
    let unavailable_week = json!({
        "count": 0,
        "characters": [],
        "available": false,
        "unavailable": true,
        "reason": "fresh endpoint returned invalid JSON; recent-public fallback cannot provide thisWeek"
    });
    Ok(json!({
        "success": true,
        "sortBy": "recent-public",
        "fallback": {
            "source": "recent-public",
            "reason": "fresh endpoint returned invalid JSON",
            "partial": true,
            "unavailableWindows": ["thisWeek"]
        },
        "windows": {
            "last24h": {
                "count": count,
                "characters": characters
            },
            "thisWeek": unavailable_week.clone()
        },
        "last24h": {
            "count": count,
            "characters": characters
        },
        "thisWeek": unavailable_week
    }))
}

async fn datacat_tags(state: &AppState, route: &ParsedPath) -> AppResult<Value> {
    let mut params = vec![
        ("mode".to_string(), "recent".to_string()),
        (
            "minTotalTokens".to_string(),
            query_param(route, "min_tokens", DATACAT_DEFAULT_MIN_TOTAL_TOKENS),
        ),
    ];
    if let Some(active) = query_param_opt(route, "activeTagIds") {
        let ids = split_csv(&active);
        if !ids.is_empty() {
            params.push(("activeTagIds".to_string(), ids.join(",")));
        }
    }
    datacat_json_get(
        state,
        &format!("/api/tags/faceted?{}", query_string_owned(&params)),
    )
    .await
}

async fn datacat_creator_characters(
    state: &AppState,
    route: &ParsedPath,
    id: &str,
) -> AppResult<Value> {
    let id = percent_decode_path_component(id);
    let params = vec![
        ("limit".to_string(), query_param(route, "limit", "24")),
        ("offset".to_string(), query_param(route, "offset", "0")),
        (
            "sortBy".to_string(),
            query_param(route, "sortBy", "chat_count"),
        ),
    ];
    datacat_json_get(
        state,
        &format!(
            "/api/creators/{}/characters?{}",
            percent_encode_component(&id),
            query_string_owned(&params)
        ),
    )
    .await
}

async fn datacat_json_get(state: &AppState, path: &str) -> AppResult<Value> {
    let client = http_client(30)?;
    let mut token = get_datacat_session_token(state).await?;
    for attempt in 0..2 {
        let response = apply_headers(
            client.get(format!("{DATACAT_API_BASE}{path}")),
            &datacat_headers(&token),
        )
        .send()
        .await
        .map_err(|error| AppError::new("upstream_request_failed", error.to_string()))?;
        if response.status() == StatusCode::UNAUTHORIZED && attempt == 0 {
            clear_setting(state, DATACAT_SESSION_KEY)?;
            token = mint_datacat_session_token().await?;
            store_setting_value(state, DATACAT_SESSION_KEY, json!({ "value": token }))?;
            continue;
        }
        return upstream_json(response).await;
    }
    Err(AppError::new(
        "upstream_request_failed",
        "DataCat request failed after session refresh",
    ))
}

async fn get_datacat_session_token(state: &AppState) -> AppResult<String> {
    let token = provider_secret(state, DATACAT_SESSION_KEY)?;
    if !token.is_empty() {
        return Ok(token);
    }
    let token = mint_datacat_session_token().await?;
    store_setting_value(state, DATACAT_SESSION_KEY, json!({ "value": token }))?;
    Ok(token)
}

async fn mint_datacat_session_token() -> AppResult<String> {
    let data = json_post(
        &format!("{DATACAT_API_BASE}/api/liberator/identify"),
        &json!({ "deviceToken": new_id() }),
        vec![
            header("Content-Type", "application/json"),
            header("Accept", "application/json"),
            header("Origin", DATACAT_API_BASE),
            header("Referer", format!("{DATACAT_API_BASE}/")),
        ],
    )
    .await?;
    data.get("sessionToken")
        .and_then(Value::as_str)
        .filter(|token| !token.trim().is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| {
            AppError::new(
                "upstream_response_error",
                "DataCat identify response did not include a session token",
            )
        })
}

fn datacat_headers(token: &str) -> Vec<Header> {
    vec![
        header("Accept", "application/json"),
        header("Origin", DATACAT_API_BASE),
        header("Referer", format!("{DATACAT_API_BASE}/")),
        header("X-Session-Token", token),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn datacat_recent_fallback_matches_fresh_shape() {
        let fallback = datacat_recent_as_fresh_response(json!({
            "success": true,
            "totalCount": 2,
            "characters": [
                { "characterId": "alpha", "chatName": "Alpha" },
                { "characterId": "beta", "chatName": "Beta" }
            ]
        }))
        .expect("valid recent data should become a fresh fallback");

        let last24h = &fallback["windows"]["last24h"];
        assert_eq!(last24h["count"], 2);
        assert_eq!(last24h["characters"][0]["characterId"], "alpha");
        assert_eq!(fallback["last24h"]["characters"][1]["characterId"], "beta");
        assert_eq!(fallback["windows"]["thisWeek"]["count"], 0);
        assert!(fallback["windows"]["thisWeek"]["characters"]
            .as_array()
            .is_some_and(Vec::is_empty));
        assert_eq!(fallback["windows"]["thisWeek"]["available"], false);
        assert_eq!(fallback["windows"]["thisWeek"]["unavailable"], true);
        assert_eq!(fallback["fallback"]["source"], "recent-public");
        assert_eq!(fallback["fallback"]["partial"], true);
        assert_eq!(fallback["fallback"]["unavailableWindows"][0], "thisWeek");
    }

    #[test]
    fn datacat_recent_fallback_rejects_unsuccessful_recent_payload() {
        let error = datacat_recent_as_fresh_response(json!({
            "success": false,
            "characters": []
        }))
        .expect_err("unsuccessful recent payload should not become a success");

        assert_eq!(error.code, "upstream_response_error");
    }

    #[test]
    fn datacat_recent_fallback_rejects_missing_characters() {
        let error = datacat_recent_as_fresh_response(json!({
            "success": true,
            "items": []
        }))
        .expect_err("missing character array should stay an upstream error");

        assert_eq!(error.code, "upstream_response_error");
    }

    #[test]
    fn datacat_recent_fallback_rejects_missing_success_flag() {
        let error = datacat_recent_as_fresh_response(json!({
            "characters": []
        }))
        .expect_err("missing success flag should stay an upstream error");

        assert_eq!(error.code, "upstream_response_error");
    }
}
