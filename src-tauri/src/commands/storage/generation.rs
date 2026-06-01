use super::llm::{connection_auth_check, llm_connection_from_value};
use super::*;

fn stored_generation_parameters(connection: &Value) -> Value {
    match connection.get("defaultParameters") {
        Some(Value::Object(map)) => Value::Object(map.clone()),
        Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
            .ok()
            .filter(Value::is_object)
            .unwrap_or_else(|| json!({})),
        _ => json!({}),
    }
}

pub(crate) async fn test_connection(state: &AppState, id: &str) -> AppResult<Value> {
    connection_auth_check(state, id).await
}

pub(crate) async fn test_message(state: &AppState, id: &str) -> AppResult<Value> {
    let started = std::time::Instant::now();
    let connection = connection_secrets::connection_for_runtime(state, id)?;
    let request = marinara_llm::LlmRequest {
        connection: llm_connection_from_value(&connection)?,
        messages: vec![marinara_llm::LlmMessage {
            role: "user".to_string(),
            content: "hi".to_string(),
            name: None,
            images: Vec::new(),
            tool_call_id: None,
            tool_calls: None,
        }],
        parameters: stored_generation_parameters(&connection),
        tools: Vec::new(),
    };
    let response = marinara_llm::complete(request).await?;
    Ok(json!({
        "success": true,
        "response": response,
        "latencyMs": started.elapsed().as_millis()
    }))
}
