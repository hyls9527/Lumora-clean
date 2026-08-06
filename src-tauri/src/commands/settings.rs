use crate::error::{AppError, AppResult};
use tauri::command;
use tauri_plugin_store::StoreExt;

/// Retrieve a setting value by key from the persistent store.
#[command]
pub async fn get_setting(app: tauri::AppHandle, key: String) -> AppResult<Option<String>> {
    let store = app
        .store("settings.json")
        .map_err(|e| AppError::External(format!("failed to open store: {e}")))?;
    let value = store.get(&key).and_then(|v| v.as_str().map(String::from));
    Ok(value)
}

/// Persist a setting value by key.
#[command]
pub async fn set_setting(app: tauri::AppHandle, key: String, value: String) -> AppResult<()> {
    let store = app
        .store("settings.json")
        .map_err(|e| AppError::External(format!("failed to open store: {e}")))?;
    store.set(&key, serde_json::Value::String(value));
    store
        .save()
        .map_err(|e| AppError::External(format!("failed to save store: {e}")))?;
    Ok(())
}

/// Return the app version from Cargo.toml (single source of truth for runtime).
#[command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_version_matches_cargo_manifest() {
        assert_eq!(get_app_version(), env!("CARGO_PKG_VERSION"));
        assert!(!get_app_version().is_empty());
    }
}
