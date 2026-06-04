use super::*;

#[path = "imports/service.rs"]
mod service;

pub(crate) use service::{lorebook_entries, normalize_lorebook_entry};

pub(crate) fn import_call(state: &AppState, rest: &[&str], body: Value) -> AppResult<Value> {
    service::import_call(state, rest, body)
}

pub(crate) fn import_stream_channel(
    state: &AppState,
    rest: &[&str],
    body: Value,
    on_event: tauri::ipc::Channel<Value>,
) -> AppResult<()> {
    service::import_stream_channel(state, rest, body, on_event)
}

pub(crate) fn import_stream_callback(
    state: &AppState,
    rest: &[&str],
    body: Value,
    emit: impl FnMut(Value) -> AppResult<()>,
) -> AppResult<()> {
    service::import_stream_callback(state, rest, body, emit)
}
