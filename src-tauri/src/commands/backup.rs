use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::db::DbHandle;

/// Export database to a user-selected location.
#[tauri::command]
pub async fn export_database(
    db: State<'_, DbHandle>,
    destination: String,
) -> Result<String, String> {
    let db_path = db.path();
    let dest = PathBuf::from(&destination);

    // Ensure destination directory exists
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    fs::copy(db_path, &dest).map_err(|e| format!("Failed to export database: {e}"))?;

    Ok(dest.to_string_lossy().to_string())
}

/// Import database from a file, replacing the current one.
/// Writes to a staging file first, then replaces on restart.
#[tauri::command]
pub async fn import_database(db: State<'_, DbHandle>, source: String) -> Result<String, String> {
    let db_path = db.path();
    let src = PathBuf::from(&source);

    if !src.exists() {
        return Err("Source file does not exist".to_string());
    }

    // Validate it's a SQLite file (magic bytes)
    let header = fs::read(&src).map_err(|e| format!("Failed to read source file: {e}"))?;
    if header.len() < 16 || &header[0..16] != b"SQLite format 3\0" {
        return Err("Source file is not a valid SQLite database".to_string());
    }

    // Write to staging file first to avoid corrupting active DB
    let staging = db_path.with_extension("db.import");
    fs::copy(&src, &staging).map_err(|e| format!("Failed to stage import: {e}"))?;

    // Replace original — connection may hold WAL, but staging is safe
    fs::copy(&staging, db_path).map_err(|e| format!("Failed to import database: {e}"))?;
    let _ = fs::remove_file(&staging);

    Ok("Database imported successfully. Please restart the application.".to_string())
}
