use super::updates;
use marinara_core::AppError;
use serde_json::Value;

#[tauri::command]
pub async fn update_check() -> Result<Value, AppError> {
    updates::check_updates().await
}

#[tauri::command]
pub fn update_apply(input: Option<Value>) -> Result<Value, AppError> {
    updates::apply_update(input.unwrap_or(Value::Null))
}
