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
/// Cascades: image_tags, embeddings, vec_embeddings, analysis_history.
#[tauri::command]
pub fn permanent_delete_image(db: tauri::State<'_, DbHandle>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    permanent_delete_impl(&conn, &id)
}

/// Internal: cascade delete an image and all related records.
fn permanent_delete_impl(conn: &rusqlite::Connection, id: &str) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    // Cascade delete related records first
    tx.execute("DELETE FROM image_tags WHERE image_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM analysis_history WHERE image_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    // vec0 virtual table may not support standard DELETE; failure is non-fatal
    let _ = tx.execute("DELETE FROM vec_embeddings WHERE image_id = ?1", params![id]);
    tx.execute("DELETE FROM embeddings WHERE image_id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    // Finally delete the image itself
    let changed = tx
        .execute("DELETE FROM images WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if changed == 0 {
        return Err("Image not found".to_string());
    }

    tx.commit().map_err(|e| e.to_string())?;
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn insert_test_image(conn: &rusqlite::Connection, id: &str) {
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES (?1, '/test.png', 'h1', 100, 'png', '2025-01-01')",
            params![id],
        )
        .unwrap();
    }

    #[test]
    fn soft_delete_sets_deleted_flag() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        insert_test_image(&conn, "img-1");

        conn.execute(
            "UPDATE images SET deleted = 1, deleted_at = datetime('now') WHERE id = 'img-1'",
            [],
        )
        .unwrap();

        let deleted: i64 = conn
            .query_row("SELECT deleted FROM images WHERE id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(deleted, 1);

        // Restore
        conn.execute("UPDATE images SET deleted = 0, deleted_at = NULL WHERE id = 'img-1'", [])
            .unwrap();
        let deleted: i64 = conn
            .query_row("SELECT deleted FROM images WHERE id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(deleted, 0);
    }

    #[test]
    fn permanent_delete_cascades() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        insert_test_image(&conn, "img-1");

        conn.execute("INSERT INTO tags (id, name) VALUES ('tag-1', 'nature')", [])
            .unwrap();
        conn.execute("INSERT INTO image_tags (image_id, tag_id) VALUES ('img-1', 'tag-1')", [])
            .unwrap();
        conn.execute(
            "INSERT INTO embeddings (image_id, embedding, dimensions) VALUES ('img-1', X'0000', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO analysis_history (id, image_id, result_json) VALUES ('a-1', 'img-1', '{}')",
            [],
        )
        .unwrap();

        let tag_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM image_tags WHERE image_id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(tag_count, 1);

        permanent_delete_impl(&conn, "img-1").unwrap();

        let tag_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM image_tags WHERE image_id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(tag_count, 0);

        let emb_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM embeddings WHERE image_id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(emb_count, 0);

        let analysis_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM analysis_history WHERE image_id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(analysis_count, 0);

        let img_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images WHERE id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(img_count, 0);
    }

    #[test]
    fn permanent_delete_nonexistent_fails() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        let result = permanent_delete_impl(&conn, "nonexistent");
        assert!(result.is_err());
    }
}
