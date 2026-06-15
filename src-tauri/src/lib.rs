mod db;
mod import;

use db::Database;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

struct AppState {
    db: Mutex<Database>,
    app_handle: AppHandle,
}

#[tauri::command]
fn get_image_count(state: State<AppState>) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_image_count().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_images(
    state: State<AppState>,
    limit: i64,
    offset: i64,
) -> Result<Vec<db::ImageRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_images(limit, offset).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_folder(state: State<AppState>, folder_path: String) -> Result<import::ImportResult, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    import::import_folder(Path::new(&folder_path), &db)
}

#[tauri::command]
fn update_image_rating(state: State<AppState>, image_id: i64, rating: i32) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_rating(image_id, rating).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_image_favorite(state: State<AppState>, image_id: i64) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.toggle_favorite(image_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_image(state: State<AppState>, image_id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.soft_delete(image_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_images(state: State<AppState>, query: String) -> Result<Vec<db::ImageRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_images(&query).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_folder_dialog(state: State<'_, AppState>) -> Result<import::ImportResult, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = state
        .app_handle
        .dialog()
        .file()
        .blocking_pick_folder()
        .ok_or("No folder selected")?;

    let folder_path = folder
        .as_path()
        .ok_or("Invalid folder path")?
        .to_path_buf();

    let db = state.db.lock().map_err(|e| e.to_string())?;
    import::import_folder(&folder_path, &db)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("lumora")
        .join("lumora.db");

    std::fs::create_dir_all(db_path.parent().unwrap()).ok();

    let db = Database::new(&db_path).expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            app.manage(AppState {
                db: Mutex::new(db),
                app_handle,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_image_count,
            get_images,
            import_folder,
            update_image_rating,
            toggle_image_favorite,
            delete_image,
            get_setting,
            set_setting,
            search_images,
            open_folder_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
