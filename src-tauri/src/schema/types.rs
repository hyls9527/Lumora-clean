use serde::{Deserialize, Serialize};

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
