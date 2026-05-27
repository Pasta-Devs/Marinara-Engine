use crate::storage_commands::shared::required_string;
use marinara_core::{AppError, AppResult};
use marinara_security::is_allowed_outbound_url;
use serde_json::{json, Map, Value};
use std::time::Duration;

const DISCORD_CONTENT_LIMIT: usize = 2_000;
const DISCORD_USERNAME_LIMIT: usize = 80;

pub(crate) async fn discord_webhook_send(body: Value) -> AppResult<Value> {
    let webhook_url = required_string(&body, "webhookUrl")?.trim();
    if !is_valid_discord_webhook_url(webhook_url) || !is_allowed_outbound_url(webhook_url, false) {
        return Err(AppError::invalid_input("Invalid Discord webhook URL"));
    }

    let content = required_string(&body, "content")?.trim();
    let mut payload = Map::new();
    payload.insert(
        "content".to_string(),
        Value::String(truncate_for_discord(content, DISCORD_CONTENT_LIMIT)),
    );

    if let Some(username) = optional_trimmed_string(&body, "username") {
        payload.insert(
            "username".to_string(),
            Value::String(truncate_chars(&username, DISCORD_USERNAME_LIMIT)),
        );
    }
    if let Some(avatar_url) = optional_trimmed_string(&body, "avatarUrl") {
        if !is_allowed_outbound_url(&avatar_url, false) {
            return Err(AppError::invalid_input("Invalid Discord avatar URL"));
        }
        payload.insert("avatar_url".to_string(), Value::String(avatar_url));
    }

    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::new("discord_webhook_client_error", error.to_string()))?
        .post(webhook_url)
        .json(&Value::Object(payload))
        .send()
        .await
        .map_err(|error| AppError::new("discord_webhook_request_error", error.to_string()))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::with_details(
            "discord_webhook_failed",
            format!("Discord webhook returned HTTP {status}"),
            json!({ "body": body.chars().take(500).collect::<String>() }),
        ));
    }

    Ok(json!({ "success": true }))
}

fn optional_trimmed_string(body: &Value, key: &str) -> Option<String> {
    body.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn truncate_for_discord(value: &str, limit: usize) -> String {
    if value.chars().count() <= limit {
        return value.to_string();
    }
    let prefix = value.chars().take(limit.saturating_sub(3)).collect::<String>();
    format!("{prefix}...")
}

fn truncate_chars(value: &str, limit: usize) -> String {
    value.chars().take(limit).collect()
}

fn is_valid_discord_webhook_url(raw: &str) -> bool {
    let trimmed = raw.trim();
    let Some(rest) = trimmed
        .strip_prefix("https://discord.com/api/webhooks/")
        .or_else(|| trimmed.strip_prefix("https://discordapp.com/api/webhooks/"))
    else {
        return false;
    };
    let mut parts = rest.split('/');
    let id = parts.next().unwrap_or_default();
    let token = parts.next().unwrap_or_default();
    if parts.next().is_some() {
        return false;
    }
    !id.is_empty()
        && id.chars().all(|character| character.is_ascii_digit())
        && !token.is_empty()
        && token
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_legacy_discord_webhook_shapes() {
        assert!(is_valid_discord_webhook_url(
            "https://discord.com/api/webhooks/123456789/token_AB-12"
        ));
        assert!(is_valid_discord_webhook_url(
            "https://discordapp.com/api/webhooks/123456789/token_AB-12"
        ));
        assert!(!is_valid_discord_webhook_url("http://discord.com/api/webhooks/123/token"));
        assert!(!is_valid_discord_webhook_url("https://example.com/api/webhooks/123/token"));
        assert!(!is_valid_discord_webhook_url("https://discord.com/api/webhooks/notnumeric/token"));
    }

    #[test]
    fn truncates_content_with_ellipsis_inside_discord_limit() {
        let value = "x".repeat(DISCORD_CONTENT_LIMIT + 20);
        let truncated = truncate_for_discord(&value, DISCORD_CONTENT_LIMIT);
        assert_eq!(truncated.chars().count(), DISCORD_CONTENT_LIMIT);
        assert!(truncated.ends_with("..."));
    }
}
