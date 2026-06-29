use crate::error::{AppError, AppResult};
use tauri::command;
use tauri_plugin_store::StoreExt;

/// Retrieve a setting value by key from the persistent store.
#[command]
pub async fn get_setting(
    app: tauri::AppHandle,
    key: String,
) -> AppResult<Option<String>> {
    let store = app
        .store("settings.json")
        .map_err(|e| AppError::External(format!("failed to open store: {e}")))?;
    let value = store.get(&key).and_then(|v| v.as_str().map(String::from));
    Ok(value)
}

/// Persist a setting value by key.
#[command]
pub async fn set_setting(
    app: tauri::AppHandle,
    key: String,
    value: String,
) -> AppResult<()> {
    let store = app
        .store("settings.json")
        .map_err(|e| AppError::External(format!("failed to open store: {e}")))?;
    store.set(&key, serde_json::Value::String(value));
    store.save().map_err(|e| AppError::External(format!("failed to save store: {e}")))?;
    Ok(())
}