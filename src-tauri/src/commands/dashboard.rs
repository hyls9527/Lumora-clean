use crate::db::DbHandle;
use crate::schema::types::{DashboardStats, FormatCount, RatingCount, TagCount};
use crate::commands::images::row_to_record;

/// Aggregate dashboard statistics from the database.
#[tauri::command]
pub fn get_dashboard_stats(db: tauri::State<'_, DbHandle>) -> Result<DashboardStats, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;

    // Total images (non-deleted)
    let total_images: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM images WHERE deleted = 0",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Total storage (non-deleted)
    let total_size_kb: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(file_size_kb), 0) FROM images WHERE deleted = 0",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Format distribution
    let mut stmt = conn
        .prepare(
            "SELECT format, COUNT(*) as cnt FROM images WHERE deleted = 0
             GROUP BY format ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;
    let format_counts: Vec<FormatCount> = stmt
        .query_map([], |row| {
            Ok(FormatCount {
                format: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Rating distribution (0-5)
    let mut stmt = conn
        .prepare(
            "SELECT rating, COUNT(*) as cnt FROM images WHERE deleted = 0
             GROUP BY rating ORDER BY rating",
        )
        .map_err(|e| e.to_string())?;
    let rating_counts: Vec<RatingCount> = stmt
        .query_map([], |row| {
            Ok(RatingCount {
                rating: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Top 10 tags by usage
    let mut stmt = conn
        .prepare(
            "SELECT t.name, COUNT(it.image_id) as cnt
             FROM tags t
             JOIN image_tags it ON it.tag_id = t.id
             JOIN images i ON i.id = it.image_id AND i.deleted = 0
             GROUP BY t.id
             ORDER BY cnt DESC
             LIMIT 10",
        )
        .map_err(|e| e.to_string())?;
    let top_tags: Vec<TagCount> = stmt
        .query_map([], |row| {
            Ok(TagCount {
                name: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Recent 5 imports
    let mut stmt = conn
        .prepare(
            "SELECT * FROM images WHERE deleted = 0
             ORDER BY imported_at DESC LIMIT 5",
        )
        .map_err(|e| e.to_string())?;
    let recent_imports = stmt
        .query_map([], row_to_record)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(DashboardStats {
        total_images,
        total_size_kb,
        format_counts,
        rating_counts,
        top_tags,
        recent_imports,
    })
}
