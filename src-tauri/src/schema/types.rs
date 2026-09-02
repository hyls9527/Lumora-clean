use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::AppResult;

/// Core image record stored in SQLite — matches `images` table 1:1.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRecord {
    pub id: String,
    pub file_path: String,
    pub file_hash: String,
    pub file_size_kb: i64,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub format: String,
    pub created_at: String,
    pub imported_at: String,
    pub deleted: bool,
    pub rating: i32,
    pub favorite: bool,
    pub metadata_json: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variant_group_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hps_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hps_style: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aesthetic_score: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scoring_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scored_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score_label: Option<String>,
    /// Tags associated via image_tags (display names). Empty when none.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

/// Paginated wrapper returned by list commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedResult {
    pub items: Vec<ImageRecord>,
    pub total: i64,
    pub page: u32,
    pub per_page: u32,
}

/// Tag record stored in SQLite — matches `tags` table 1:1.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub created_at: String,
}

/// Dashboard stats returned by get_dashboard_stats.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub total_images: i64,
    pub total_size_kb: i64,
    pub format_counts: Vec<FormatCount>,
    pub rating_counts: Vec<RatingCount>,
    pub top_tags: Vec<TagCount>,
    pub recent_imports: Vec<ImageRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatCount {
    pub format: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RatingCount {
    pub rating: i32,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagCount {
    pub name: String,
    pub count: i64,
}

/// Result returned by export_images command.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub success: u32,
    pub failed: u32,
    pub dest_dir: String,
}

/// Result for a single convert operation within batch_convert.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchConvertItem {
    pub id: String,
    pub old_format: String,
    pub new_format: String,
    pub status: String, // "ok" | "error"
    pub error: Option<String>,
}

/// Overall result of a batch_convert operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchConvertResult {
    pub items: Vec<BatchConvertItem>,
    pub converted: u32,
    pub skipped: u32,
    pub failed: u32,
}

/// Result returned by import_images command.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub items: Vec<ImageRecord>,
    pub imported: u32,
    pub skipped: u32,
    pub rejected: u32,
    pub total_scanned: u32,
}

/// Map a SQLite row to an `ImageRecord`.
/// Shared by images, trash, dashboard, and export commands.
pub fn row_to_record(row: &rusqlite::Row<'_>) -> Result<ImageRecord, rusqlite::Error> {
    Ok(ImageRecord {
        id: row.get("id")?,
        file_path: row.get("file_path")?,
        file_hash: row.get("file_hash")?,
        file_size_kb: row.get("file_size_kb")?,
        width: row.get("width")?,
        height: row.get("height")?,
        format: row.get("format")?,
        created_at: row.get("created_at")?,
        imported_at: row.get("imported_at")?,
        deleted: row.get::<_, i32>("deleted")? != 0,
        rating: row.get("rating")?,
        favorite: row.get::<_, i32>("favorite")? != 0,
        metadata_json: row.get("metadata_json")?,
        deleted_at: row.get("deleted_at").ok(),
        variant_group_id: row.get("variant_group_id").ok(),
        hps_score: row.get("hps_score").ok(),
        hps_style: row.get("hps_style").ok(),
        aesthetic_score: row.get("aesthetic_score").ok(),
        scoring_model: row.get("scoring_model").ok(),
        scored_at: row.get("scored_at").ok(),
        score_label: row.get("score_label").ok(),
        tags: Vec::new(),
    })
}

/// Batch-load tag names for a set of image records (one grouped query).
pub(crate) fn attach_tags(conn: &rusqlite::Connection, items: &mut [ImageRecord]) -> AppResult<()> {
    if items.is_empty() {
        return Ok(());
    }
    let placeholders = items.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT t.name, it.image_id FROM image_tags it \
         JOIN tags t ON t.id = it.tag_id \
         WHERE it.image_id IN ({placeholders}) ORDER BY t.name"
    );
    let mut stmt = conn.prepare(&sql)?;
    let ids: Vec<&str> = items.iter().map(|r| r.id.as_str()).collect();
    let rows = stmt.query_map(rusqlite::params_from_iter(ids), |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut by_image: HashMap<String, Vec<String>> = HashMap::new();
    for row in rows {
        let (name, image_id) = row?;
        by_image.entry(image_id).or_default().push(name);
    }
    for item in items.iter_mut() {
        if let Some(tags) = by_image.remove(&item.id) {
            item.tags = tags;
        }
    }
    Ok(())
}
