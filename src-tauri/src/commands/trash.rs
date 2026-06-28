use rusqlite::params;

use crate::db::DbHandle;
use crate::schema::types::PaginatedResult;

use super::images::row_to_record;

/// Soft-delete: set deleted=1 and record the deletion timestamp.
#[tauri::command]
pub fn soft_delete_image(db: tauri::State<'_, DbHandle>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let changed = conn
        .execute(
            "UPDATE images SET deleted = 1, deleted_at = datetime('now') WHERE id = ?1 AND deleted = 0",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("Image not found or already deleted".to_string());
    }
    Ok(())
}

/// Restore a soft-deleted image back to the library.
#[tauri::command]
pub fn restore_image(db: tauri::State<'_, DbHandle>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let changed = conn
        .execute(
            "UPDATE images SET deleted = 0, deleted_at = NULL WHERE id = ?1 AND deleted = 1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("Image not found in trash".to_string());
    }
    Ok(())
}

/// Permanently remove an image from the database.
#[tauri::command]
pub fn permanent_delete_image(db: tauri::State<'_, DbHandle>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let changed = conn
        .execute("DELETE FROM images WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("Image not found".to_string());
    }
    Ok(())
}

/// Paginated listing of soft-deleted images (trash), ordered by deleted_at DESC.
#[tauri::command]
pub fn list_trash(
    db: tauri::State<'_, DbHandle>,
    page: u32,
    per_page: u32,
) -> Result<PaginatedResult, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let offset = page.saturating_sub(1) * per_page;
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM images WHERE deleted = 1",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT * FROM images WHERE deleted = 1
             ORDER BY deleted_at DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![per_page, offset], row_to_record)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(PaginatedResult {
        items,
        total,
        page,
        per_page,
    })
}

/// Permanently delete ALL images currently in the trash.
#[tauri::command]
pub fn empty_trash(db: tauri::State<'_, DbHandle>) -> Result<u64, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let affected = conn
        .execute("DELETE FROM images WHERE deleted = 1", [])
        .map_err(|e| e.to_string())?;
    Ok(affected as u64)
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

/// Batch soft-delete: move multiple images to trash.
#[tauri::command]
pub fn batch_soft_delete(
    db: tauri::State<'_, DbHandle>,
    ids: Vec<String>,
) -> Result<u64, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let mut affected: u64 = 0;
    for id in &ids {
        let n = conn
            .execute(
                "UPDATE images SET deleted = 1, deleted_at = datetime('now') WHERE id = ?1 AND deleted = 0",
                rusqlite::params![id],
            )
            .map_err(|e| e.to_string())?;
        affected += n as u64;
    }
    Ok(affected)
}

/// Batch restore: restore multiple images from trash.
#[tauri::command]
pub fn batch_restore(
    db: tauri::State<'_, DbHandle>,
    ids: Vec<String>,
) -> Result<u64, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let mut affected: u64 = 0;
    for id in &ids {
        let n = conn
            .execute(
                "UPDATE images SET deleted = 0, deleted_at = NULL WHERE id = ?1 AND deleted = 1",
                rusqlite::params![id],
            )
            .map_err(|e| e.to_string())?;
        affected += n as u64;
    }
    Ok(affected)
}

/// Batch permanent delete: permanently delete multiple images.
#[tauri::command]
pub fn batch_permanent_delete(
    db: tauri::State<'_, DbHandle>,
    ids: Vec<String>,
) -> Result<u64, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let mut affected: u64 = 0;
    for id in &ids {
        let n = conn
            .execute("DELETE FROM images WHERE id = ?1", rusqlite::params![id])
            .map_err(|e| e.to_string())?;
        affected += n as u64;
    }
    Ok(affected)
}

/// Batch add tag: add a tag to multiple images.
#[tauri::command]
pub fn batch_add_tag(
    db: tauri::State<'_, DbHandle>,
    image_ids: Vec<String>,
    tag_id: String,
) -> Result<u64, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let mut affected: u64 = 0;
    for image_id in &image_ids {
        let n = conn
            .execute(
                "INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?1, ?2)",
                rusqlite::params![image_id, tag_id],
            )
            .map_err(|e| e.to_string())?;
        affected += n as u64;
    }
    Ok(affected)
}

/// Batch remove tag: remove a tag from multiple images.
#[tauri::command]
pub fn batch_remove_tag(
    db: tauri::State<'_, DbHandle>,
    image_ids: Vec<String>,
    tag_id: String,
) -> Result<u64, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let mut affected: u64 = 0;
    for image_id in &image_ids {
        let n = conn
            .execute(
                "DELETE FROM image_tags WHERE image_id = ?1 AND tag_id = ?2",
                rusqlite::params![image_id, tag_id],
            )
            .map_err(|e| e.to_string())?;
        affected += n as u64;
    }
    Ok(affected)
}
