use rusqlite::params;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};
use crate::schema::types::{row_to_record, ImageRecord, PaginatedResult};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Paginated listing of non-deleted images, ordered by imported_at DESC.
#[tauri::command]
pub fn list_images(
    db: tauri::State<'_, DbHandle>,
    page: u32,
    per_page: u32,
) -> AppResult<PaginatedResult> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let offset = page.saturating_sub(1) * per_page;
    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
            r.get(0)
        })
        ?;
    let mut stmt = conn
        .prepare(
            "SELECT * FROM images WHERE deleted = 0
             ORDER BY imported_at DESC LIMIT ?1 OFFSET ?2",
        )
        ?;
    let items = stmt
        .query_map(params![per_page, offset], row_to_record)
        ?
        .collect::<Result<Vec<_>, _>>()
        ?;
    Ok(PaginatedResult {
        items,
        total,
        page,
        per_page,
    })
}

/// Set rating (0-5) for an image.
#[tauri::command]
pub fn update_rating(
    db: tauri::State<'_, DbHandle>,
    id: String,
    rating: u32,
) -> AppResult<()> {
    let clamped = rating.min(5);
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    conn.execute(
        "UPDATE images SET rating = ?1 WHERE id = ?2",
        params![clamped, id],
    )
    ?;
    Ok(())
}

/// Toggle the favorite flag for an image.
#[tauri::command]
pub fn toggle_favorite(db: tauri::State<'_, DbHandle>, id: String) -> AppResult<()> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    conn.execute(
        "UPDATE images SET favorite = CASE WHEN favorite = 0 THEN 1 ELSE 0 END WHERE id = ?1",
        params![id],
    )
    ?;
    Ok(())
}

/// List all favorited (non-deleted) images, ordered by imported_at DESC.
#[tauri::command]
pub fn list_favorites(db: tauri::State<'_, DbHandle>) -> AppResult<Vec<ImageRecord>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let mut stmt = conn.prepare(
        "SELECT * FROM images WHERE favorite = 1 AND deleted = 0 ORDER BY imported_at DESC",
    )?;
    let items = stmt
        .query_map([], row_to_record)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

/// Rebuild FTS5 index from current images table data.
#[tauri::command]
pub fn rebuild_fts_index(db: tauri::State<'_, DbHandle>) -> AppResult<()> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    conn.execute("INSERT INTO images_fts(images_fts) VALUES('rebuild')", [])?;
    Ok(())
}

/// Get all images in a variant group (images sharing the same prompt).
#[tauri::command]
pub fn get_variant_group_images(
    db: tauri::State<'_, DbHandle>,
    variant_group_id: String,
) -> AppResult<Vec<ImageRecord>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let mut stmt = conn.prepare(
        "SELECT * FROM images WHERE variant_group_id = ?1 AND deleted = 0 ORDER BY created_at",
    )?;
    let items = stmt
        .query_map(params![variant_group_id], row_to_record)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> crate::db::DbHandle {
        crate::db::DbHandle::open_memory().unwrap()
    }

    #[test]
    fn update_rating_clamps_to_5() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
             VALUES ('r1','/r','h',1,'png','2025-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE images SET rating = ?1 WHERE id = 'r1'",
            params![99u32.min(5)],
        )
        .unwrap();
        let r: i32 = conn
            .query_row("SELECT rating FROM images WHERE id = 'r1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(r, 5);
    }

    #[test]
    fn toggle_favorite_roundtrip() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
             VALUES ('f1','/f','h',1,'png','2025-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE images SET favorite = CASE WHEN favorite = 0 THEN 1 ELSE 0 END WHERE id = 'f1'",
            [],
        )
        .unwrap();
        let fav: i32 = conn
            .query_row("SELECT favorite FROM images WHERE id = 'f1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(fav, 1);
        conn.execute(
            "UPDATE images SET favorite = CASE WHEN favorite = 0 THEN 1 ELSE 0 END WHERE id = 'f1'",
            [],
        )
        .unwrap();
        let fav: i32 = conn
            .query_row("SELECT favorite FROM images WHERE id = 'f1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(fav, 0);
    }

    #[test]
    fn bulk_insert_1000_images_performance() {
        use std::time::Instant;

        let db = test_db();
        let conn = db.conn().lock().unwrap();
        let start = Instant::now();

        for i in 0..1000 {
            let id = format!("img-{:04}", i);
            let file_path = format!("/path/to/image-{:04}.png", i);
            let file_hash = format!("hash-{:04}", i);
            let file_size_kb = 100 + (i % 500);
            let width = 512 + (i % 512);
            let height = 512 + (i % 512);

            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, width, height, format, created_at, metadata_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'png', '2026-06-27T00:00:00Z', ?7)",
                rusqlite::params![
                    id,
                    file_path,
                    file_hash,
                    file_size_kb,
                    width,
                    height,
                    format!(r#"{{"prompt":"Test image {}","model":"stable-diffusion"}}"#, i)
                ],
            )
            .unwrap();
        }

        let duration = start.elapsed();
        println!("Bulk insert 1000 images: {:?}", duration);

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1000);

        let start = Instant::now();
        let mut stmt = conn
            .prepare("SELECT id FROM images WHERE deleted = 0 ORDER BY imported_at DESC LIMIT 40")
            .unwrap();
        let rows: Vec<String> = stmt
            .query_map([], |row| Ok(row.get::<_, String>(0)?))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        let duration = start.elapsed();
        println!("Query 40 images from 1000: {:?}", duration);
        assert_eq!(rows.len(), 40);

        let start = Instant::now();
        let mut stmt = conn
            .prepare("SELECT id FROM images WHERE metadata_json LIKE '%Test image 500%'")
            .unwrap();
        let rows: Vec<String> = stmt
            .query_map([], |row| Ok(row.get::<_, String>(0)?))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        let duration = start.elapsed();
        println!("Search by metadata in 1000 images: {:?}", duration);
        assert_eq!(rows.len(), 1);
    }

    #[test]
    fn pagination_beyond_total_returns_empty() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();

        for i in 0..3 {
            conn.execute(
                "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
                 VALUES (?1,?2,'h',1,'png','2025-01-01')",
                rusqlite::params![format!("p-{}", i), format!("/p-{}.png", i)],
            )
            .unwrap();
        }

        let per_page = 40u32;
        let page = 2u32;
        let offset = (page - 1) * per_page;
        let mut stmt = conn
            .prepare("SELECT id FROM images WHERE deleted = 0 ORDER BY imported_at DESC LIMIT ?1 OFFSET ?2")
            .unwrap();
        let rows: Vec<String> = stmt
            .query_map(rusqlite::params![per_page, offset], |row| {
                Ok(row.get::<_, String>(0)?)
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(rows.len(), 0);
    }

    #[test]
    fn count_reflects_actual_inserts() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();

        for i in 0..5 {
            conn.execute(
                "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
                 VALUES (?1,?2,'h',1,'png','2025-01-01')",
                rusqlite::params![format!("c-{}", i), format!("/c-{}.png", i)],
            )
            .unwrap();
        }

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 5);

        conn.execute("UPDATE images SET deleted = 1 WHERE id = 'c-0'", [])
            .unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 4);
    }

    #[test]
    fn rebuild_fts_index_works() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at) VALUES ('fts-1', '/test.png', 'h1', 100, 'png', '2025-01-01')",
            [],
        ).unwrap();
        conn.execute("INSERT INTO images_fts(images_fts) VALUES('rebuild')", [])
            .unwrap();
    }

    #[test]
    fn list_favorites_returns_only_favorited_images() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,imported_at,favorite)
             VALUES ('lf1','/lf1.png','h',1,'png','2025-01-01','2025-01-01T00:00:00Z',1)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,imported_at,favorite)
             VALUES ('lf2','/lf2.png','h',1,'png','2025-01-02','2025-01-02T00:00:00Z',1)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,imported_at,favorite)
             VALUES ('lf3','/lf3.png','h',1,'png','2025-01-03','2025-01-03T00:00:00Z',0)",
            [],
        ).unwrap();

        let mut stmt = conn
            .prepare("SELECT * FROM images WHERE favorite = 1 AND deleted = 0 ORDER BY imported_at DESC")
            .unwrap();
        let items: Vec<crate::schema::types::ImageRecord> = stmt
            .query_map([], crate::schema::types::row_to_record)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, "lf2");
        assert_eq!(items[1].id, "lf1");
    }

    #[test]
    fn list_favorites_excludes_deleted() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,favorite,deleted)
             VALUES ('lfd1','/lfd1.png','h',1,'png','2025-01-01',1,1)",
            [],
        ).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images WHERE favorite = 1 AND deleted = 0", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
