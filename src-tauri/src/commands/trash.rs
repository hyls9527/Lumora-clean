use rusqlite::params;

use crate::error::{AppError, AppResult};

use crate::db::DbHandle;
use crate::schema::types::PaginatedResult;

use crate::schema::types::row_to_record;

/// Soft-delete: set deleted=1 and record the deletion timestamp.
#[tauri::command]
pub fn soft_delete_image(db: tauri::State<'_, DbHandle>, id: String) -> AppResult<()> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let changed = conn.execute(
        "UPDATE images SET deleted = 1, deleted_at = datetime('now') WHERE id = ?1 AND deleted = 0",
        params![id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound(
            "Image not found or already deleted".to_string(),
        ));
    }
    Ok(())
}

/// Restore a soft-deleted image back to the library.
#[tauri::command]
pub fn restore_image(db: tauri::State<'_, DbHandle>, id: String) -> AppResult<()> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let changed = conn.execute(
        "UPDATE images SET deleted = 0, deleted_at = NULL WHERE id = ?1 AND deleted = 1",
        params![id],
    )?;
    if changed == 0 {
        return Err(AppError::NotFound("Image not found in trash".to_string()));
    }
    Ok(())
}

/// Permanently remove an image from the database.
///
/// Cascade delete order (must match schema relationships):
/// 1. image_tags      — FK: image_id → images.id
/// 2. analysis_history — FK: image_id → images.id
/// 3. vec_embeddings   — FK: image_id → images.id (virtual table, may fail if extension not loaded)
/// 4. embeddings       — FK: image_id → images.id
/// 5. images           — primary record
///
/// NOT deleted:
/// - variant_groups — shared across images, orphan groups are harmless
/// - tags           — shared across images, only junction rows removed
#[tauri::command]
pub fn permanent_delete_image(db: tauri::State<'_, DbHandle>, id: String) -> AppResult<()> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    permanent_delete_impl(&conn, &id)
}

/// Internal: cascade delete using an existing transaction.
fn permanent_delete_tx(tx: &rusqlite::Transaction<'_>, id: &str) -> Result<(), AppError> {
    // 1. Remove tag associations
    tx.execute("DELETE FROM image_tags WHERE image_id = ?1", params![id])?;
    // 2. Remove analysis history
    tx.execute(
        "DELETE FROM analysis_history WHERE image_id = ?1",
        params![id],
    )?;
    // vec0 is a virtual table loaded via sqlite-vec extension.
    // Assert it exists at dev-time; in production the extension is always loaded.
    debug_assert!(
        tx.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='vec_embeddings'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .unwrap_or(0)
            > 0,
        "vec_embeddings table missing — sqlite-vec extension not loaded"
    );
    if let Err(e) = tx.execute(
        "DELETE FROM vec_embeddings WHERE image_id = ?1",
        params![id],
    ) {
        log::warn!("Failed to delete vec_embeddings for image {}: {}", id, e);
    }
    tx.execute("DELETE FROM embeddings WHERE image_id = ?1", params![id])?;
    let changed = tx.execute("DELETE FROM images WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(AppError::NotFound(format!("图片 {} 不存在", id)));
    }
    Ok(())
}

/// Internal: cascade delete an image and all related records.
fn permanent_delete_impl(conn: &rusqlite::Connection, id: &str) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    permanent_delete_tx(&tx, id)?;
    tx.commit()?;
    Ok(())
}

/// Paginated listing of soft-deleted images (trash), ordered by deleted_at DESC.
#[tauri::command]
pub fn list_trash(
    db: tauri::State<'_, DbHandle>,
    page: u32,
    per_page: u32,
) -> AppResult<PaginatedResult> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let offset = page.saturating_sub(1) * per_page;
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM images WHERE deleted = 1", [], |r| {
        r.get(0)
    })?;
    let mut stmt = conn.prepare(
        "SELECT * FROM images WHERE deleted = 1
             ORDER BY deleted_at DESC LIMIT ?1 OFFSET ?2",
    )?;
    let items = stmt
        .query_map(params![per_page, offset], row_to_record)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(PaginatedResult {
        items,
        total,
        page,
        per_page,
    })
}

/// Permanently delete ALL images currently in the trash.
/// Cascades: image_tags, embeddings, vec_embeddings, analysis_history.
#[tauri::command]
pub fn empty_trash(db: tauri::State<'_, DbHandle>) -> AppResult<u64> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let mut stmt = conn.prepare("SELECT id FROM images WHERE deleted = 1")?;
    let ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);
    let affected = ids.len() as u64;
    let tx = conn.unchecked_transaction()?;
    for id in &ids {
        permanent_delete_tx(&tx, id)?;
    }
    tx.commit()?;
    Ok(affected)
}

// ---------------------------------------------------------------------------
// Batch operations
// ---------------------------------------------------------------------------

/// Batch soft-delete: move multiple images to trash.
#[tauri::command]
pub fn batch_soft_delete(db: tauri::State<'_, DbHandle>, ids: Vec<String>) -> AppResult<u64> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let tx = conn.unchecked_transaction()?;
    let mut affected: u64 = 0;
    for id in &ids {
        let n = tx
            .execute(
                "UPDATE images SET deleted = 1, deleted_at = datetime('now') WHERE id = ?1 AND deleted = 0",
                rusqlite::params![id],
            )
            ?;
        affected += n as u64;
    }
    tx.commit()?;
    Ok(affected)
}

/// Batch restore: restore multiple images from trash.
#[tauri::command]
pub fn batch_restore(db: tauri::State<'_, DbHandle>, ids: Vec<String>) -> AppResult<u64> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let tx = conn.unchecked_transaction()?;
    let mut affected: u64 = 0;
    for id in &ids {
        let n = tx.execute(
            "UPDATE images SET deleted = 0, deleted_at = NULL WHERE id = ?1 AND deleted = 1",
            rusqlite::params![id],
        )?;
        affected += n as u64;
    }
    tx.commit()?;
    Ok(affected)
}

/// Batch permanent delete: permanently delete multiple images.
/// Cascades: image_tags, embeddings, vec_embeddings, analysis_history.
#[tauri::command]
pub fn batch_permanent_delete(db: tauri::State<'_, DbHandle>, ids: Vec<String>) -> AppResult<u64> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let affected = ids.len() as u64;
    let tx = conn.unchecked_transaction()?;
    for id in &ids {
        permanent_delete_tx(&tx, id)?;
    }
    tx.commit()?;
    Ok(affected)
}

/// Batch add tag: add a tag to multiple images.
#[tauri::command]
pub fn batch_add_tag(
    db: tauri::State<'_, DbHandle>,
    image_ids: Vec<String>,
    tag_id: String,
) -> AppResult<u64> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let mut affected: u64 = 0;
    for image_id in &image_ids {
        let n = conn.execute(
            "INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?1, ?2)",
            rusqlite::params![image_id, tag_id],
        )?;
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
) -> AppResult<u64> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let mut affected: u64 = 0;
    for image_id in &image_ids {
        let n = conn.execute(
            "DELETE FROM image_tags WHERE image_id = ?1 AND tag_id = ?2",
            rusqlite::params![image_id, tag_id],
        )?;
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
            .query_row("SELECT deleted FROM images WHERE id = 'img-1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(deleted, 1);

        // Restore
        conn.execute(
            "UPDATE images SET deleted = 0, deleted_at = NULL WHERE id = 'img-1'",
            [],
        )
        .unwrap();
        let deleted: i64 = conn
            .query_row("SELECT deleted FROM images WHERE id = 'img-1'", [], |r| {
                r.get(0)
            })
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
        conn.execute(
            "INSERT INTO image_tags (image_id, tag_id) VALUES ('img-1', 'tag-1')",
            [],
        )
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
            .query_row(
                "SELECT COUNT(*) FROM image_tags WHERE image_id = 'img-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(tag_count, 1);

        permanent_delete_impl(&conn, "img-1").unwrap();

        let tag_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM image_tags WHERE image_id = 'img-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(tag_count, 0);

        let emb_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM embeddings WHERE image_id = 'img-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(emb_count, 0);

        let analysis_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM analysis_history WHERE image_id = 'img-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(analysis_count, 0);

        let img_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images WHERE id = 'img-1'", [], |r| {
                r.get(0)
            })
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
