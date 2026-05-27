use super::shared::*;
use super::*;
use marinara_security::is_allowed_outbound_url;

pub(crate) fn custom_tool_capabilities() -> Value {
    json!({
        "staticResults": true,
        "webhooks": true,
        "scriptExecutionEnabled": false
    })
}

pub(crate) async fn execute_custom_tool(state: &AppState, body: Value) -> AppResult<Value> {
    let tool_name = required_string(&body, "toolName")?;
    let arguments = body.get("arguments").cloned().unwrap_or_else(|| json!({}));
    let tool = state
        .storage
        .list("custom-tools")?
        .into_iter()
        .find(|row| {
            row.get("name").and_then(Value::as_str) == Some(tool_name)
                && string_bool(row.get("enabled")).unwrap_or(true)
        })
        .ok_or_else(|| {
            AppError::invalid_input(format!("Custom tool not found or disabled: {tool_name}"))
        })?;

    match tool
        .get("executionType")
        .and_then(Value::as_str)
        .unwrap_or("static")
    {
        "static" => Ok(json!({
            "success": true,
            "result": tool
                .get("staticResult")
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .ok_or_else(|| AppError::invalid_input(format!("Static result is missing for custom tool: {tool_name}")))?
        })),
        "webhook" => execute_webhook_tool(&tool, tool_name, arguments).await,
        "script" => Err(AppError::with_details(
            "custom_tool_script_unsupported",
            format!(
                "Custom tool '{tool_name}' uses the legacy script executionType, which the refactor desktop runtime does not execute. Open the tool in the editor and convert it to a Webhook (recommended) or a Static result."
            ),
            json!({ "executionType": "script", "migration": "convert-to-webhook-or-static" }),
        )),
        other => Err(AppError::invalid_input(format!(
            "Unsupported custom tool execution type: {other}"
        ))),
    }
}

fn string_bool(value: Option<&Value>) -> Option<bool> {
    match value {
        Some(Value::Bool(value)) => Some(*value),
        Some(Value::String(value)) => match value.as_str() {
            "true" | "1" => Some(true),
            "false" | "0" => Some(false),
            _ => None,
        },
        Some(Value::Number(value)) => value.as_i64().map(|value| value != 0),
        _ => None,
    }
}

async fn execute_webhook_tool(tool: &Value, tool_name: &str, arguments: Value) -> AppResult<Value> {
    let url = tool
        .get("webhookUrl")
        .and_then(Value::as_str)
        .filter(|url| !url.trim().is_empty())
        .ok_or_else(|| {
            AppError::invalid_input(format!(
                "Webhook URL is missing for custom tool: {tool_name}"
            ))
        })?;
    if !is_allowed_outbound_url(url, true) {
        return Err(AppError::invalid_input(format!(
            "Custom tool webhook URL is not allowed: {url}"
        )));
    }

    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::new("custom_tool_client_error", error.to_string()))?
        .post(url)
        .json(&json!({ "tool": tool_name, "arguments": arguments }))
        .send()
        .await
        .map_err(|error| AppError::new("custom_tool_webhook_error", error.to_string()))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| AppError::new("custom_tool_response_error", error.to_string()))?;
    if !status.is_success() {
        return Err(AppError::with_details(
            "custom_tool_webhook_failed",
            format!("Custom tool webhook returned HTTP {status}"),
            json!({ "body": text.chars().take(1000).collect::<String>() }),
        ));
    }

    Ok(json!({
        "success": true,
        "result": text
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use serde_json::Map;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir()
            .join(format!("marinara-custom-tools-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn insert_tool(state: &AppState, row: Map<String, Value>) {
        state
            .storage
            .create("custom-tools", Value::Object(row))
            .expect("storage create should succeed");
    }

    #[tokio::test]
    async fn script_execution_type_returns_actionable_error() {
        let state = test_state("script-unsupported");
        let mut row = Map::new();
        row.insert("name".to_string(), json!("legacy_script_tool"));
        row.insert("description".to_string(), json!("legacy"));
        row.insert("executionType".to_string(), json!("script"));
        row.insert("scriptBody".to_string(), json!("return 1 + 1;"));
        row.insert("enabled".to_string(), json!(true));
        insert_tool(&state, row);

        let body = json!({ "toolName": "legacy_script_tool", "arguments": {} });
        let result = execute_custom_tool(&state, body).await;
        let error = result.expect_err("script tools must not execute in refactor runtime");
        assert_eq!(error.code, "custom_tool_script_unsupported");
        assert!(
            error.message.contains("legacy_script_tool"),
            "error should name the tool, got: {}",
            error.message
        );
        assert!(
            error.message.contains("legacy script") || error.message.contains("script executionType"),
            "error should identify the legacy script issue, got: {}",
            error.message
        );
        assert!(
            error.message.contains("Webhook") || error.message.contains("webhook"),
            "error should point at the webhook migration path, got: {}",
            error.message
        );
    }

    #[tokio::test]
    async fn unknown_execution_type_still_rejected() {
        let state = test_state("unknown-type");
        let mut row = Map::new();
        row.insert("name".to_string(), json!("alien_tool"));
        row.insert("description".to_string(), json!("?"));
        row.insert("executionType".to_string(), json!("quantum"));
        row.insert("enabled".to_string(), json!(true));
        insert_tool(&state, row);

        let body = json!({ "toolName": "alien_tool", "arguments": {} });
        let error = execute_custom_tool(&state, body)
            .await
            .expect_err("unknown executionType must reject");
        assert!(
            error.message.contains("Unsupported custom tool execution type"),
            "unknown types must keep the generic message, got: {}",
            error.message
        );
    }
}
