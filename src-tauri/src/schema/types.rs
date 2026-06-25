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
