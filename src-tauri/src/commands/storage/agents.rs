use super::chats::messages_for_chat;
use super::shared::*;
use super::*;
use std::collections::HashSet;

const MAX_ASSISTANT_RUN_INTERVAL: i64 = 100;

fn parse_settings(value: Option<&Value>) -> Map<String, Value> {
    match value {
        Some(Value::Object(object)) => object.clone(),
        Some(Value::String(raw)) => serde_json::from_str::<Value>(raw)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}

fn default_run_interval(agent_type: &str) -> i64 {
    match agent_type {
        "director" | "illustrator" => 5,
        "lorebook-keeper" | "card-evolution-auditor" => 8,
        "chat-summary" => 5,
        _ => 1,
    }
}

fn positive_run_interval(value: Option<&Value>, fallback: i64, max: i64) -> i64 {
    let parsed = match value {
        Some(Value::Number(number)) => number.as_i64(),
        Some(Value::String(raw)) => raw.trim().parse::<i64>().ok(),
        _ => None,
    };
    parsed
        .filter(|value| *value >= 1)
        .unwrap_or(fallback)
        .clamp(1, max)
}

fn boolish(value: Option<&Value>, fallback: bool) -> bool {
    match value {
        Some(Value::Bool(value)) => *value,
        Some(Value::Number(number)) => number.as_i64().map(|value| value != 0).unwrap_or(fallback),
        Some(Value::String(raw)) => match raw.trim().to_ascii_lowercase().as_str() {
            "true" | "1" | "yes" | "on" => true,
            "false" | "0" | "no" | "off" => false,
            _ => fallback,
        },
        _ => fallback,
    }
}

fn find_agent_config(state: &AppState, agent_type: &str) -> AppResult<Option<Value>> {
    if let Some(agent) = find_by_field(state, "agents", "type", agent_type)? {
        return Ok(Some(agent));
    }
    find_by_field(state, "agents", "agentType", agent_type)
}

fn get_or_create_agent_config(state: &AppState, agent_type: &str) -> AppResult<Value> {
    if let Some(agent) = find_agent_config(state, agent_type)? {
        return Ok(agent);
    }
    state.storage.create(
        "agents",
        json!({
            "type": agent_type,
            "name": agent_type,
            "enabled": true,
            "settings": {}
        }),
    )
}

fn agent_config_id(state: &AppState, agent_type: &str, create: bool) -> AppResult<Option<String>> {
    let agent = if create {
        Some(get_or_create_agent_config(state, agent_type)?)
    } else {
        find_agent_config(state, agent_type)?
    };
    Ok(agent.and_then(|agent| agent.get("id").and_then(Value::as_str).map(str::to_string)))
}

fn run_agent_type(run: &Value) -> Option<&str> {
    run.get("agentType")
        .or_else(|| run.get("agent_type"))
        .or_else(|| run.get("type"))
        .and_then(Value::as_str)
}

fn run_chat_id(run: &Value) -> Option<&str> {
    run.get("chatId")
        .or_else(|| run.get("chat_id"))
        .and_then(Value::as_str)
}

fn run_agent_config_id(run: &Value) -> Option<&str> {
    run.get("agentConfigId")
        .or_else(|| run.get("agent_config_id"))
        .and_then(Value::as_str)
}

fn run_result_type(run: &Value) -> Option<&str> {
    run.get("resultType")
        .or_else(|| run.get("result_type"))
        .and_then(Value::as_str)
}

fn list_agent_runs_for_chat(state: &AppState, chat_id: &str) -> AppResult<Vec<Value>> {
    let mut rows = state.storage.list_where("agent-runs", &{
        let mut filters = Map::new();
        filters.insert("chatId".to_string(), Value::String(chat_id.to_string()));
        filters
    })?;
    let mut seen_ids = rows
        .iter()
        .filter_map(|row| row.get("id").and_then(Value::as_str).map(ToOwned::to_owned))
        .collect::<HashSet<_>>();
    let legacy_rows = state.storage.list_where("agent-runs", &{
        let mut filters = Map::new();
        filters.insert("chat_id".to_string(), Value::String(chat_id.to_string()));
        filters
    })?;
    for row in legacy_rows {
        let id = row.get("id").and_then(Value::as_str);
        if id.is_some_and(|id| !seen_ids.insert(id.to_string())) {
            continue;
        }
        rows.push(row);
    }
    Ok(rows)
}

fn agent_config_ids_for_type(state: &AppState, agent_type: &str) -> AppResult<HashSet<String>> {
    let mut ids = HashSet::new();
    ids.insert(format!("builtin:{agent_type}"));
    for row in state.storage.list("agents")? {
        let row_type = row
            .get("type")
            .or_else(|| row.get("agentType"))
            .and_then(Value::as_str);
        if row_type != Some(agent_type) {
            continue;
        }
        if let Some(id) = row.get("id").and_then(Value::as_str) {
            ids.insert(id.to_string());
        }
    }
    Ok(ids)
}

fn run_matches_agent(run: &Value, agent_type: &str, agent_config_ids: &HashSet<String>) -> bool {
    if let Some(run_type) = run_agent_type(run) {
        return run_type == agent_type;
    }
    run_agent_config_id(run).is_some_and(|id| agent_config_ids.contains(id))
}

fn run_successful(run: &Value) -> bool {
    boolish(run.get("success"), false)
}

fn run_message_id(run: &Value) -> Option<&str> {
    run.get("messageId")
        .or_else(|| run.get("message_id"))
        .and_then(Value::as_str)
}

fn run_created_at(run: &Value) -> Option<&str> {
    run.get("created_at")
        .or_else(|| run.get("createdAt"))
        .and_then(Value::as_str)
}

pub(crate) fn toggle_agent_type(state: &AppState, agent_type: &str) -> AppResult<Value> {
    if let Some(agent) = find_agent_config(state, agent_type)? {
        let id = agent
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or(agent_type);
        let enabled = !agent
            .get("enabled")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        state
            .storage
            .patch("agents", id, json!({ "enabled": enabled }))
    } else {
        state
            .storage
            .create("agents", json!({ "type": agent_type, "enabled": true }))
    }
}

pub(crate) fn patch_agent_type(
    state: &AppState,
    agent_type: &str,
    body: Value,
) -> AppResult<Value> {
    if let Some(agent) = find_agent_config(state, agent_type)? {
        let id = agent
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or(agent_type);
        state.storage.patch("agents", id, body)
    } else {
        let mut object = ensure_object(body)?;
        object.insert("type".to_string(), Value::String(agent_type.to_string()));
        state.storage.create("agents", Value::Object(object))
    }
}

pub(crate) fn agent_cadence_status(
    state: &AppState,
    agent_type: &str,
    chat_id: &str,
) -> AppResult<Value> {
    let config = find_agent_config(state, agent_type)?;
    let settings = parse_settings(config.as_ref().and_then(|agent| agent.get("settings")));
    let fallback_interval = default_run_interval(agent_type);
    let run_interval = positive_run_interval(
        settings.get("runInterval"),
        fallback_interval,
        MAX_ASSISTANT_RUN_INTERVAL,
    );
    let messages = messages_for_chat(state, chat_id)?;
    let agent_config_ids = agent_config_ids_for_type(state, agent_type)?;
    let runs = list_agent_runs_for_chat(state, chat_id)?
        .into_iter()
        .filter(|run| run_matches_agent(run, agent_type, &agent_config_ids))
        .collect::<Vec<_>>();
    let last_run = runs
        .iter()
        .filter(|run| run_successful(run))
        .max_by(|a, b| {
            let a_time = run_created_at(a).unwrap_or("");
            let b_time = run_created_at(b).unwrap_or("");
            a_time.cmp(b_time)
        });
    let mut assistant_messages_since_last_run = None;
    let mut last_run_message_found = None;
    if let Some(run) = last_run {
        if let Some(message_id) = run_message_id(run) {
            if let Some(index) = messages
                .iter()
                .position(|message| message.get("id").and_then(Value::as_str) == Some(message_id))
            {
                last_run_message_found = Some(true);
                let count = messages[index + 1..]
                    .iter()
                    .filter(|message| {
                        message.get("role").and_then(Value::as_str) == Some("assistant")
                    })
                    .count() as i64;
                assistant_messages_since_last_run = Some(count);
            } else {
                last_run_message_found = Some(false);
                assistant_messages_since_last_run = Some(run_interval);
            }
        }
    }
    let remaining = if last_run.is_none() || run_interval <= 1 {
        0
    } else {
        (run_interval - (assistant_messages_since_last_run.unwrap_or(0) + 1)).max(0)
    };
    Ok(json!({
        "agentType": agent_type,
        "runInterval": run_interval,
        "lastSuccessfulRun": last_run.map(|run| json!({
            "messageId": run_message_id(run).map(|value| Value::String(value.to_string())).unwrap_or(Value::Null),
            "createdAt": run_created_at(run).map(|value| Value::String(value.to_string())).unwrap_or(Value::Null)
        })),
        "assistantMessagesSinceLastRun": assistant_messages_since_last_run,
        "remainingAssistantMessages": remaining,
        "runsNextAssistantMessage": remaining == 0,
        "lastRunMessageFound": last_run_message_found
    }))
}

pub(crate) fn agent_memory(
    state: &AppState,
    method: &str,
    agent_type: &str,
    chat_id: &str,
    body: Value,
) -> AppResult<Value> {
    match method {
        "GET" => {
            let Some(agent_config_id) = agent_config_id(state, agent_type, false)? else {
                return Err(AppError::not_found("Agent is not configured"));
            };
            Ok(json!({
                "agentConfigId": agent_config_id,
                "memory": read_agent_memory(state, &agent_config_id, chat_id)?
            }))
        }
        "PATCH" => {
            let agent_config_id = agent_config_id(state, agent_type, true)?
                .ok_or_else(|| AppError::not_found("Agent is not configured"))?;
            let patch = body
                .get("patch")
                .and_then(Value::as_object)
                .cloned()
                .ok_or_else(|| {
                    AppError::invalid_input("Body must be { patch: { key: value, ... } }")
                })?;
            for (key, value) in patch {
                set_agent_memory_value(state, &agent_config_id, chat_id, &key, value)?;
            }
            Ok(json!({
                "agentConfigId": agent_config_id,
                "memory": read_agent_memory(state, &agent_config_id, chat_id)?
            }))
        }
        "DELETE" => {
            if let Some(agent_config_id) = agent_config_id(state, agent_type, false)? {
                clear_agent_memory(state, &agent_config_id, chat_id)?;
            }
            Ok(json!({ "deleted": true }))
        }
        _ => Err(AppError::new(
            "method_not_allowed",
            "Unsupported agent memory method",
        )),
    }
}

pub(crate) fn clear_agent_runs_and_memory_for_chat(
    state: &AppState,
    chat_id: &str,
) -> AppResult<Value> {
    let mut preserved_arc: Option<Value> = None;
    let mut secret_plot_config_id: Option<String> = None;

    if let Some(secret_plot_config) = find_agent_config(state, "secret-plot-driver")? {
        if let Some(config_id) = secret_plot_config
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string)
        {
            let memory = read_agent_memory(state, &config_id, chat_id).unwrap_or_default();
            if let Some(arc) = memory.get("overarchingArc") {
                preserved_arc = Some(arc.clone());
                secret_plot_config_id = Some(config_id);
            }
        }
    }

    let deleted_runs = state
        .storage
        .delete_where_matching("agent-runs", |row| run_chat_id(row) == Some(chat_id))?;

    let deleted_memory = state.storage.delete_where_matching("agent-memory", |row| {
        row.get("chatId").and_then(Value::as_str) == Some(chat_id)
    })?;

    let preserved_secret_plot_arc = secret_plot_config_id.is_some() && preserved_arc.is_some();
    if let (Some(config_id), Some(arc)) = (secret_plot_config_id, preserved_arc) {
        set_agent_memory_value(state, &config_id, chat_id, "overarchingArc", arc)?;
    }

    Ok(json!({
        "deletedRuns": deleted_runs,
        "deletedMemory": deleted_memory,
        "preservedSecretPlotArc": preserved_secret_plot_arc
    }))
}

fn read_agent_memory(
    state: &AppState,
    agent_config_id: &str,
    chat_id: &str,
) -> AppResult<Map<String, Value>> {
    let mut filters = Map::new();
    filters.insert(
        "agentConfigId".to_string(),
        Value::String(agent_config_id.to_string()),
    );
    filters.insert("chatId".to_string(), Value::String(chat_id.to_string()));
    let mut memory = Map::new();
    for row in state.storage.list_where("agent-memory", &filters)? {
        let Some(key) = row.get("key").and_then(Value::as_str) else {
            continue;
        };
        let value = row.get("value").cloned().unwrap_or(Value::Null);
        let parsed = match value {
            Value::String(raw) => serde_json::from_str::<Value>(&raw).unwrap_or(Value::String(raw)),
            other => other,
        };
        memory.insert(key.to_string(), parsed);
    }
    Ok(memory)
}

fn set_agent_memory_value(
    state: &AppState,
    agent_config_id: &str,
    chat_id: &str,
    key: &str,
    value: Value,
) -> AppResult<()> {
    let mut filters = Map::new();
    filters.insert(
        "agentConfigId".to_string(),
        Value::String(agent_config_id.to_string()),
    );
    filters.insert("chatId".to_string(), Value::String(chat_id.to_string()));
    filters.insert("key".to_string(), Value::String(key.to_string()));
    let stored_value = match value {
        Value::String(raw) => Value::String(raw),
        other => Value::String(serde_json::to_string(&other)?),
    };
    if let Some(existing) = state
        .storage
        .list_where("agent-memory", &filters)?
        .into_iter()
        .next()
    {
        let id = existing
            .get("id")
            .and_then(Value::as_str)
            .ok_or_else(|| AppError::invalid_input("Agent memory row is missing id"))?;
        state
            .storage
            .patch("agent-memory", id, json!({ "value": stored_value }))?;
    } else {
        state.storage.create(
            "agent-memory",
            json!({
                "agentConfigId": agent_config_id,
                "chatId": chat_id,
                "key": key,
                "value": stored_value
            }),
        )?;
    }
    Ok(())
}

fn clear_agent_memory(state: &AppState, agent_config_id: &str, chat_id: &str) -> AppResult<()> {
    let mut filters = Map::new();
    filters.insert(
        "agentConfigId".to_string(),
        Value::String(agent_config_id.to_string()),
    );
    filters.insert("chatId".to_string(), Value::String(chat_id.to_string()));
    for row in state.storage.list_where("agent-memory", &filters)? {
        if let Some(id) = row.get("id").and_then(Value::as_str) {
            state.storage.delete("agent-memory", id)?;
        }
    }
    Ok(())
}

pub(crate) fn echo_messages(state: &AppState, method: &str, chat_id: &str) -> AppResult<Value> {
    match method {
        "GET" => {
            let rows = list_agent_runs_for_chat(state, chat_id)?;
            Ok(Value::Array(
                rows.into_iter()
                    .filter(|run| run_result_type(run) == Some("echo_message"))
                    .collect(),
            ))
        }
        "DELETE" => {
            let deleted = state.storage.delete_where_matching("agent-runs", |run| {
                run_chat_id(run) == Some(chat_id) && run_result_type(run) == Some("echo_message")
            })?;
            Ok(json!({ "deleted": deleted }))
        }
        _ => Err(AppError::new(
            "method_not_allowed",
            "Unsupported echo messages method",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_state(label: &str) -> AppState {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("marinara-agent-storage-{label}-{nonce}"));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("stale temp agent dir should be removable");
        }
        AppState::from_data_dir(path, Vec::new()).expect("test app state should initialize")
    }

    fn seed_message(state: &AppState, id: &str, role: &str, created_at: &str) {
        state
            .storage
            .upsert_with_id(
                "messages",
                id,
                json!({
                    "id": id,
                    "chatId": "chat-1",
                    "role": role,
                    "content": "",
                    "createdAt": created_at
                }),
            )
            .expect("message should write");
    }

    #[test]
    fn cadence_status_uses_default_interval_and_successful_runs() {
        let state = test_state("cadence-success");
        state
            .storage
            .upsert_with_id(
                "agents",
                "agent-director",
                json!({
                    "id": "agent-director",
                    "type": "director",
                    "name": "Narrative Director",
                    "settings": {}
                }),
            )
            .expect("agent config should write");
        seed_message(&state, "m1", "assistant", "2026-05-20T00:00:00Z");
        seed_message(&state, "m2", "assistant", "2026-05-20T00:01:00Z");
        seed_message(&state, "m3", "assistant", "2026-05-20T00:02:00Z");
        state
            .storage
            .upsert_with_id(
                "agent-runs",
                "run-success",
                json!({
                    "id": "run-success",
                    "agentConfigId": "agent-director",
                    "chatId": "chat-1",
                    "messageId": "m1",
                    "success": true,
                    "createdAt": "2026-05-20T00:00:30Z"
                }),
            )
            .expect("successful run should write");
        state
            .storage
            .upsert_with_id(
                "agent-runs",
                "run-failed-newer",
                json!({
                    "id": "run-failed-newer",
                    "agentConfigId": "agent-director",
                    "agentType": "director",
                    "chatId": "chat-1",
                    "messageId": "m3",
                    "success": false,
                    "createdAt": "2026-05-20T00:02:30Z"
                }),
            )
            .expect("failed run should write");

        let status = agent_cadence_status(&state, "director", "chat-1")
            .expect("cadence status should be calculated");

        assert_eq!(status["runInterval"], 5);
        assert_eq!(status["lastSuccessfulRun"]["messageId"], "m1");
        assert_eq!(status["assistantMessagesSinceLastRun"], 2);
        assert_eq!(status["remainingAssistantMessages"], 2);
        assert_eq!(status["runsNextAssistantMessage"], false);
        assert_eq!(status["lastRunMessageFound"], true);
    }

    #[test]
    fn cadence_status_matches_imported_runs_by_agent_config_id() {
        let state = test_state("cadence-imported-config-id");
        state
            .storage
            .upsert_with_id(
                "agents",
                "custom-agent-1",
                json!({
                    "id": "custom-agent-1",
                    "type": "custom-prophet",
                    "name": "Custom Prophet",
                    "settings": { "runInterval": 3 }
                }),
            )
            .expect("agent config should write");
        seed_message(&state, "m1", "user", "2026-05-20T00:00:00Z");
        seed_message(&state, "m2", "assistant", "2026-05-20T00:01:00Z");
        state
            .storage
            .upsert_with_id(
                "agent-runs",
                "run-imported-newer",
                json!({
                    "id": "run-imported-newer",
                    "agent_config_id": "custom-agent-1",
                    "chat_id": "chat-1",
                    "message_id": "m1",
                    "success": "true",
                    "created_at": "2026-05-20T00:00:30Z"
                }),
            )
            .expect("newer import-style run should write");
        state
            .storage
            .upsert_with_id(
                "agent-runs",
                "run-imported-older",
                json!({
                    "id": "run-imported-older",
                    "agent_config_id": "custom-agent-1",
                    "chat_id": "chat-1",
                    "message_id": "m2",
                    "success": "true",
                    "created_at": "2026-05-19T23:59:30Z"
                }),
            )
            .expect("older import-style run should write");

        let status = agent_cadence_status(&state, "custom-prophet", "chat-1")
            .expect("cadence status should match by config id");

        assert_eq!(status["runInterval"], 3);
        assert_eq!(status["lastSuccessfulRun"]["messageId"], "m1");
        assert_eq!(status["assistantMessagesSinceLastRun"], 1);
        assert_eq!(status["remainingAssistantMessages"], 1);
    }
}
