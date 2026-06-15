mod db;

use db::Database;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

struct AppState {
    db: Mutex<Database>,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("lumora")
        .join("lumora.db");

    std::fs::create_dir_all(db_path.parent().unwrap()).ok();

    let db = Database::new(&db_path).expect("Failed to initialize database");

    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(db),
        })
        .invoke_handler(tauri::generate_handler![get_image_count, get_images])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
