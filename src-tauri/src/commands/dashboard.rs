use crate::db::DbHandle;
use crate::error::{AppError, AppResult};
use crate::schema::types::{DashboardStats, FormatCount, RatingCount, TagCount};
use crate::commands::images::row_to_record;

/// Aggregate dashboard statistics from the database.
#[tauri::command]
pub fn get_dashboard_stats(db: tauri::State<'_, DbHandle>) -> AppResult<DashboardStats> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;

    // Total images (non-deleted)
    let total_images: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM images WHERE deleted = 0",
            [],
            |r| r.get(0),
        )
        ?;

    // Total storage (non-deleted)
    let total_size_kb: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(file_size_kb), 0) FROM images WHERE deleted = 0",
            [],
            |r| r.get(0),
        )
        ?;

    // Format distribution
    let mut stmt = conn
        .prepare(
            "SELECT format, COUNT(*) as cnt FROM images WHERE deleted = 0
             GROUP BY format ORDER BY cnt DESC",
        )
        ?;
    let format_counts: Vec<FormatCount> = stmt
        .query_map([], |row| {
            Ok(FormatCount {
                format: row.get(0)?,
                count: row.get(1)?,
            })
        })
        ?
        .collect::<Result<Vec<_>, _>>()
        ?;

    // Rating distribution (0-5)
    let mut stmt = conn
        .prepare(
            "SELECT rating, COUNT(*) as cnt FROM images WHERE deleted = 0
             GROUP BY rating ORDER BY rating",
        )
        ?;
    let rating_counts: Vec<RatingCount> = stmt
        .query_map([], |row| {
            Ok(RatingCount {
                rating: row.get(0)?,
                count: row.get(1)?,
            })
        })
        ?
        .collect::<Result<Vec<_>, _>>()
        ?;

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
        ?;
    let top_tags: Vec<TagCount> = stmt
        .query_map([], |row| {
            Ok(TagCount {
                name: row.get(0)?,
                count: row.get(1)?,
            })
        })
        ?
        .collect::<Result<Vec<_>, _>>()
        ?;

    // Recent 5 imports
    let mut stmt = conn
        .prepare(
            "SELECT * FROM images WHERE deleted = 0
             ORDER BY imported_at DESC LIMIT 5",
        )
        ?;
    let recent_imports = stmt
        .query_map([], row_to_record)
        ?
        .collect::<Result<Vec<_>, _>>()
        ?;

    Ok(DashboardStats {
        total_images,
        total_size_kb,
        format_counts,
        rating_counts,
        top_tags,
        recent_imports,
    })
}