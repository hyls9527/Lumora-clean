use crate::db::DbHandle;
use crate::error::{AppError, AppResult};
use crate::schema::types::row_to_record;
use crate::schema::types::{DashboardStats, FormatCount, RatingCount, TagCount};

/// Aggregate dashboard statistics from the database.
#[tauri::command]
pub fn get_dashboard_stats(db: tauri::State<'_, DbHandle>) -> AppResult<DashboardStats> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    get_dashboard_stats_inner(&conn)
}

pub(crate) fn get_dashboard_stats_inner(conn: &rusqlite::Connection) -> AppResult<DashboardStats> {
    // Total images (non-deleted)
    let total_images: i64 =
        conn.query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
            r.get(0)
        })?;

    // Total storage (non-deleted)
    let total_size_kb: i64 = conn.query_row(
        "SELECT COALESCE(SUM(file_size_kb), 0) FROM images WHERE deleted = 0",
        [],
        |r| r.get(0),
    )?;

    // Format distribution
    let mut stmt = conn.prepare(
        "SELECT format, COUNT(*) as cnt FROM images WHERE deleted = 0
             GROUP BY format ORDER BY cnt DESC",
    )?;
    let format_counts: Vec<FormatCount> = stmt
        .query_map([], |row| {
            Ok(FormatCount {
                format: row.get(0)?,
                count: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Rating distribution (0-5)
    let mut stmt = conn.prepare(
        "SELECT rating, COUNT(*) as cnt FROM images WHERE deleted = 0
             GROUP BY rating ORDER BY rating",
    )?;
    let rating_counts: Vec<RatingCount> = stmt
        .query_map([], |row| {
            Ok(RatingCount {
                rating: row.get(0)?,
                count: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Top 10 tags by usage
    let mut stmt = conn.prepare(
        "SELECT t.name, COUNT(it.image_id) as cnt
             FROM tags t
             JOIN image_tags it ON it.tag_id = t.id
             JOIN images i ON i.id = it.image_id AND i.deleted = 0
             GROUP BY t.id
             ORDER BY cnt DESC
             LIMIT 10",
    )?;
    let top_tags: Vec<TagCount> = stmt
        .query_map([], |row| {
            Ok(TagCount {
                name: row.get(0)?,
                count: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Recent 5 imports
    let mut stmt = conn.prepare(
        "SELECT * FROM images WHERE deleted = 0
             ORDER BY imported_at DESC LIMIT 5",
    )?;
    let recent_imports = stmt
        .query_map([], row_to_record)?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(DashboardStats {
        total_images,
        total_size_kb,
        format_counts,
        rating_counts,
        top_tags,
        recent_imports,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;
    use rusqlite::params;

    #[test]
    fn dashboard_stats_aggregate_correctly() {
        let db = DbHandle::open_memory().unwrap();
        {
            let conn = db.conn().lock().unwrap();
            for i in 0..7 {
                conn.execute(
                    "INSERT INTO images
                     (id, file_path, file_hash, file_size_kb, format, created_at, imported_at, rating)
                     VALUES (?1, ?2, 'h', 100, 'png', '2025-01-01', ?3, ?4)",
                    params![
                        format!("img-{i}"),
                        format!("/{i}.png"),
                        format!("2025-01-0{}T00:00:00Z", (i % 9) + 1),
                        i % 5,
                    ],
                )
                .unwrap();
            }
            // Deleted images are excluded from every aggregate.
            conn.execute(
                "INSERT INTO images
                 (id, file_path, file_hash, file_size_kb, format, created_at, rating, deleted)
                 VALUES ('del', '/del.png', 'h', 999, 'jpg', '2025-01-01', 0, 1)",
                [],
            )
            .unwrap();
            conn.execute("INSERT INTO tags (id, name) VALUES ('t1', 'landscape')", [])
                .unwrap();
            conn.execute(
                "INSERT INTO image_tags (image_id, tag_id) VALUES ('img-0', 't1')",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO image_tags (image_id, tag_id) VALUES ('img-1', 't1')",
                [],
            )
            .unwrap();
        }

        let conn = db.conn().lock().unwrap();
        let stats = get_dashboard_stats_inner(&conn).unwrap();
        assert_eq!(stats.total_images, 7);
        assert_eq!(stats.total_size_kb, 700);
        assert_eq!(stats.format_counts[0].format, "png");
        assert_eq!(stats.format_counts[0].count, 7);
        assert_eq!(stats.rating_counts.len(), 5);
        assert_eq!(stats.top_tags[0].name, "landscape");
        assert_eq!(stats.top_tags[0].count, 2);
        assert_eq!(stats.recent_imports.len(), 5);
    }
}
