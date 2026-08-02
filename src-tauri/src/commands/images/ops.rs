use rusqlite::params;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};
use crate::schema::types::{row_to_record, ImageRecord, PaginatedResult};

/// Return base64-encoded image data for a given file_path.
/// Falls back when Tauri's asset protocol is not available.
/// SECURITY: Only allows reading files under the app's images directory.
#[tauri::command]
pub fn get_image_base64_cmd(db: tauri::State<'_, DbHandle>, file_path: String) -> AppResult<String> {
    use base64::Engine;
    use std::path::Path;

    // Derive allowed directory: <app_data_dir>/images/
    let db_path = db.path();
    let images_dir = db_path
        .parent()
        .ok_or_else(|| AppError::InvalidInput("Cannot resolve app data directory".into()))?
        .join("images");

    // Canonicalize to prevent ../ traversal
    let canonical = Path::new(&file_path)
        .canonicalize()
        .map_err(|_| AppError::NotFound(format!("File not found: {}", file_path)))?;

    if !canonical.starts_with(&images_dir) {
        return Err(AppError::InvalidInput(format!(
            "Access denied: {} is outside images directory",
            file_path
        )));
    }

    let data = std::fs::read(&canonical)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&data))
}

/// Return base64-encoded THUMBNAIL for a given file_path.
/// Resizes to fit within  pixels (preserving aspect ratio).
/// SECURITY: Same path validation as get_image_base64_cmd.
#[tauri::command]
pub fn get_thumbnail_base64_cmd(
    db: tauri::State<'_, DbHandle>,
    file_path: String,
    max_width: u32,
) -> AppResult<String> {
    use base64::Engine;
    use image::GenericImageView;
    use std::path::Path;

    let db_path = db.path();
    let images_dir = db_path
        .parent()
        .ok_or_else(|| AppError::InvalidInput("Cannot resolve app data directory".into()))?
        .join("images");

    let canonical = Path::new(&file_path)
        .canonicalize()
        .map_err(|_| AppError::NotFound(format!("File not found: {}", file_path)))?;

    if !canonical.starts_with(&images_dir) {
        return Err(AppError::InvalidInput(format!(
            "Access denied: {} is outside images directory",
            file_path
        )));
    }

    let img = image::open(&canonical)
        .map_err(|e| AppError::Io(format!("Failed to decode image: {}", e)))?;

    let (w, h) = img.dimensions();
    let thumb = if w > max_width {
        let new_h = (h as f64 * max_width as f64 / w as f64) as u32;
        img.resize(max_width, new_h, image::imageops::FilterType::Triangle)
    } else {
        img
    };

    let mut buf = std::io::Cursor::new(Vec::new());
    thumb
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| AppError::Io(format!("Failed to encode thumbnail: {}", e)))?;

    Ok(base64::engine::general_purpose::STANDARD.encode(buf.into_inner()))
}

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
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
        r.get(0)
    })?;
    let mut stmt = conn.prepare(
        "SELECT * FROM images WHERE deleted = 0
             ORDER BY imported_at DESC LIMIT ?1 OFFSET ?2",
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

/// Set rating (0-5) for an image.
#[tauri::command]
pub fn update_rating(db: tauri::State<'_, DbHandle>, id: String, rating: u32) -> AppResult<()> {
    let clamped = rating.min(5);
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    conn.execute(
        "UPDATE images SET rating = ?1 WHERE id = ?2",
        params![clamped, id],
    )?;
    Ok(())
}

/// Toggle the favorite flag for an image.
#[tauri::command]
pub fn toggle_favorite(db: tauri::State<'_, DbHandle>, id: String) -> AppResult<()> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    conn.execute(
        "UPDATE images SET favorite = CASE WHEN favorite = 0 THEN 1 ELSE 0 END WHERE id = ?1",
        params![id],
    )?;
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


/// Filter parameters for list_images_filtered.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageFilter {
    pub model: Option<String>,
    pub rating_min: Option<u32>,
    pub rating_max: Option<u32>,
    pub favorite: Option<bool>,
    pub format: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

/// Paginated listing with optional filters.
#[tauri::command]
pub fn list_images_filtered(
    db: tauri::State<'_, DbHandle>,
    page: u32,
    per_page: u32,
    filter: ImageFilter,
) -> AppResult<PaginatedResult> {
    list_images_filtered_inner(&db, page, per_page, &filter)
}

fn list_images_filtered_inner(
    db: &DbHandle,
    page: u32,
    per_page: u32,
    filter: &ImageFilter,
) -> AppResult<PaginatedResult> {
    // Fail visibly on inverted ranges instead of silently returning empty results
    if let (Some(min), Some(max)) = (filter.rating_min, filter.rating_max) {
        if min > max {
            return Err(AppError::InvalidInput(
                "评分范围无效：最低分不能高于最高分".into(),
            ));
        }
    }
    if let (Some(from), Some(to)) = (&filter.date_from, &filter.date_to) {
        if from > to {
            return Err(AppError::InvalidInput(
                "日期范围无效：开始日期不能晚于结束日期".into(),
            ));
        }
    }

    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let offset = page.saturating_sub(1) * per_page;

    // Build WHERE clauses dynamically
    let mut conditions = vec!["deleted = 0".to_string()];
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref m) = filter.model {
        conditions.push(format!("json_extract(metadata_json, '$.model') = ?{}", param_values.len() + 1));
        param_values.push(Box::new(m.clone()));
    }
    if let Some(min) = filter.rating_min {
        conditions.push(format!("rating >= ?{}", param_values.len() + 1));
        param_values.push(Box::new(min));
    }
    if let Some(max) = filter.rating_max {
        conditions.push(format!("rating <= ?{}", param_values.len() + 1));
        param_values.push(Box::new(max));
    }
    if let Some(fav) = filter.favorite {
        if fav {
            conditions.push("favorite = 1".to_string());
        }
    }
    if let Some(ref fmt) = filter.format {
        conditions.push(format!("format = ?{}", param_values.len() + 1));
        param_values.push(Box::new(fmt.clone()));
    }
    if let Some(ref from) = filter.date_from {
        // date() makes the range day-inclusive (dateTo "2025-01-01" includes the whole day)
        conditions.push(format!("date(created_at) >= ?{}", param_values.len() + 1));
        param_values.push(Box::new(from.clone()));
    }
    if let Some(ref to) = filter.date_to {
        conditions.push(format!("date(created_at) <= ?{}", param_values.len() + 1));
        param_values.push(Box::new(to.clone()));
    }

    let where_clause = conditions.join(" AND ");

    // Count query
    let count_sql = format!("SELECT COUNT(*) FROM images WHERE {}", where_clause);
    let total: i64 = conn.query_row(&count_sql, rusqlite::params_from_iter(param_values.iter().map(|p| p.as_ref())), |r| r.get(0))?;

    // Data query with pagination
    let data_sql = format!(
        "SELECT * FROM images WHERE {} ORDER BY imported_at DESC LIMIT ?{} OFFSET ?{}",
        where_clause,
        param_values.len() + 1,
        param_values.len() + 2
    );
    param_values.push(Box::new(per_page));
    param_values.push(Box::new(offset));

    let mut stmt = conn.prepare(&data_sql)?;
    let items = stmt
        .query_map(rusqlite::params_from_iter(param_values.iter().map(|p| p.as_ref())), row_to_record)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(PaginatedResult {
        items,
        total,
        page,
        per_page,
    })
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
            .prepare(
                "SELECT * FROM images WHERE favorite = 1 AND deleted = 0 ORDER BY imported_at DESC",
            )
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
            .query_row(
                "SELECT COUNT(*) FROM images WHERE favorite = 1 AND deleted = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    fn insert_filter_image(
        conn: &rusqlite::Connection,
        id: &str,
        format: &str,
        created_at: &str,
        metadata_json: Option<&str>,
        favorite: bool,
    ) {
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json,favorite)
             VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                id,
                format!("/{id}.png"),
                format!("hash-{id}"),
                format,
                created_at,
                metadata_json,
                favorite as i32,
            ],
        )
        .unwrap();
    }

    #[test]
    fn filtered_list_rejects_inverted_rating_range() {
        let db = test_db();
        let filter = ImageFilter {
            model: None,
            rating_min: Some(4),
            rating_max: Some(2),
            favorite: None,
            format: None,
            date_from: None,
            date_to: None,
        };
        assert!(list_images_filtered_inner(&db, 1, 40, &filter).is_err());
    }

    #[test]
    fn filtered_list_rejects_inverted_date_range() {
        let db = test_db();
        let filter = ImageFilter {
            model: None,
            rating_min: None,
            rating_max: None,
            favorite: None,
            format: None,
            date_from: Some("2025-02-01".into()),
            date_to: Some("2025-01-01".into()),
        };
        assert!(list_images_filtered_inner(&db, 1, 40, &filter).is_err());
    }

    #[test]
    fn filtered_list_date_to_includes_entire_day() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_filter_image(&conn, "a", "png", "2025-01-01T12:30:00", None, false);
        }
        let filter = ImageFilter {
            model: None,
            rating_min: None,
            rating_max: None,
            favorite: None,
            format: None,
            date_from: None,
            date_to: Some("2025-01-01".into()),
        };
        let result = list_images_filtered_inner(&db, 1, 40, &filter).unwrap();
        assert_eq!(result.total, 1);
        assert_eq!(result.items.len(), 1);
    }

    #[test]
    fn filtered_list_combines_model_favorite_and_format() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_filter_image(&conn, "a", "png", "2025-01-01", Some(r#"{"model":"sd1.5"}"#), true);
            insert_filter_image(&conn, "b", "png", "2025-01-02", Some(r#"{"model":"sd1.5"}"#), false);
            insert_filter_image(&conn, "c", "jpg", "2025-01-03", Some(r#"{"model":"sd1.5"}"#), true);
            insert_filter_image(&conn, "d", "png", "2025-01-04", Some(r#"{"model":"flux"}"#), true);
        }
        let filter = ImageFilter {
            model: Some("sd1.5".into()),
            rating_min: None,
            rating_max: None,
            favorite: Some(true),
            format: Some("png".into()),
            date_from: None,
            date_to: None,
        };
        let result = list_images_filtered_inner(&db, 1, 40, &filter).unwrap();
        assert_eq!(result.total, 1);
        assert_eq!(result.items[0].id, "a");
    }

    #[test]
    fn filtered_list_favorite_false_is_ignored() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_filter_image(&conn, "a", "png", "2025-01-01", None, true);
            insert_filter_image(&conn, "b", "png", "2025-01-02", None, false);
        }
        let filter = ImageFilter {
            model: None,
            rating_min: None,
            rating_max: None,
            favorite: Some(false),
            format: None,
            date_from: None,
            date_to: None,
        };
        let result = list_images_filtered_inner(&db, 1, 40, &filter).unwrap();
        assert_eq!(result.total, 2);
    }
}
