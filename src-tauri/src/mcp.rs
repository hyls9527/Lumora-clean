//! MCP (Model Context Protocol) server exposing Lumora's library to AI agents.
//!
//! Mounted by `lan_server` at `/mcp` and protected by the same LAN token.

use std::path::Path;
use std::sync::{Arc, MutexGuard};

use base64::Engine;
use rmcp::{
    handler::server::wrapper::Parameters,
    model::{CallToolResult, ContentBlock},
    schemars, tool, tool_handler, tool_router,
    transport::streamable_http_server::{
        session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
    },
    ErrorData, ServerHandler,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::commands::ai::{get_latest_analysis, AnalysisResult};
use crate::commands::dashboard::get_dashboard_stats_inner;
use crate::commands::embeddings::{
    embed_text_ollama, get_embedding_status_db, search_semantic_db, validate_query_dimension,
    EmbeddingInfo, SemanticSearchResult,
};
use crate::commands::images::{escape_fts5, toggle_favorite_impl};
use crate::commands::tags::{add_tag_to_image_impl, create_tag_impl, remove_tag_from_image_impl};
use crate::commands::trash::{restore_impl, soft_delete_impl};
use crate::db::DbHandle;
use crate::ollama::OllamaConfig;
use crate::schema::types::{
    attach_tags, row_to_record, DashboardStats, ImageRecord, PaginatedResult,
};

/// MCP handler state: shared SQLite handle + Ollama config for semantic search.
#[derive(Clone)]
pub struct LumoraMcp {
    db: DbHandle,
    ollama: OllamaConfig,
}

impl LumoraMcp {
    pub fn new(db: DbHandle, ollama: OllamaConfig) -> Self {
        Self { db, ollama }
    }
}

/// Build the MCP service mounted at `/mcp`.
pub fn service(db: DbHandle) -> StreamableHttpService<LumoraMcp, LocalSessionManager> {
    let handler = LumoraMcp::new(db, OllamaConfig::from_env());
    StreamableHttpService::new(
        move || Ok(handler.clone()),
        Arc::new(LocalSessionManager::default()),
        StreamableHttpServerConfig::default(),
    )
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct ListImagesParams {
    #[schemars(description = "Page number, starting at 1")]
    page: Option<u32>,
    #[schemars(description = "Images per page (1-200, default 40)")]
    per_page: Option<u32>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct SearchImagesParams {
    #[schemars(description = "Full-text query over prompts, metadata and file paths")]
    query: String,
    #[schemars(description = "Maximum results (1-200, default 40)")]
    limit: Option<u32>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct ImageIdParams {
    #[schemars(description = "Lumora image id (from list/search tools)")]
    id: String,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct SemanticSearchParams {
    #[schemars(description = "Natural-language description of the image you want")]
    query: String,
    #[schemars(description = "Maximum results (1-100, default 20)")]
    limit: Option<i64>,
    #[schemars(description = "Minimum cosine similarity (0-1, default no threshold)")]
    min_similarity: Option<f64>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct CreateTagParams {
    #[schemars(description = "Tag name (unique; empty names are rejected)")]
    name: String,
    #[schemars(description = "Optional hex color, e.g. #ff8800")]
    color: Option<String>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
struct ImageTagParams {
    #[schemars(description = "Lumora image id (from list/search tools)")]
    image_id: String,
    #[schemars(description = "Tag id (from list_tags or create_tag)")]
    tag_id: String,
}

#[tool_router]
impl LumoraMcp {
    #[tool(description = "List images in the Lumora library, newest first")]
    async fn list_images(
        &self,
        Parameters(p): Parameters<ListImagesParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let page = p.page.unwrap_or(1).max(1);
        let per_page = p.per_page.unwrap_or(40).clamp(1, 200);
        match list_images_impl(&self.db, page, per_page) {
            Ok(value) => Ok(json_result(value)),
            Err(e) => Ok(tool_error(e)),
        }
    }

    #[tool(description = "Full-text search across prompts, metadata and file paths")]
    async fn search_images(
        &self,
        Parameters(p): Parameters<SearchImagesParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let limit = p.limit.unwrap_or(40).clamp(1, 200);
        match search_images_impl(&self.db, &p.query, limit) {
            Ok(value) => Ok(json_result(value)),
            Err(e) => Ok(tool_error(e)),
        }
    }

    #[tool(
        description = "Get one image with its full record, tags, latest AI analysis and embedding status"
    )]
    async fn get_image(
        &self,
        Parameters(p): Parameters<ImageIdParams>,
    ) -> Result<CallToolResult, ErrorData> {
        match get_image_impl(&self.db, &p.id) {
            Ok(value) => Ok(json_result(value)),
            Err(e) => Ok(tool_error(e)),
        }
    }

    #[tool(
        description = "Read an image file as a vision-capable image (auto-resized to max 1024px)"
    )]
    async fn get_image_file(
        &self,
        Parameters(p): Parameters<ImageIdParams>,
    ) -> Result<CallToolResult, ErrorData> {
        match image_file_impl(&self.db, &p.id) {
            Ok((data, mime)) => {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                Ok(CallToolResult::success(vec![ContentBlock::image(
                    b64, mime,
                )]))
            }
            Err(e) => Ok(tool_error(e)),
        }
    }

    #[tool(description = "List all tags with usage counts")]
    async fn list_tags(&self) -> Result<CallToolResult, ErrorData> {
        match list_tags_impl(&self.db) {
            Ok(value) => Ok(json_result(value)),
            Err(e) => Ok(tool_error(e)),
        }
    }

    #[tool(description = "Library statistics: totals, formats, ratings, top tags")]
    async fn get_stats(&self) -> Result<CallToolResult, ErrorData> {
        match get_stats_impl(&self.db) {
            Ok(value) => Ok(json_result(value)),
            Err(e) => Ok(tool_error(e)),
        }
    }

    #[tool(
        description = "Semantic search: find images by meaning, not keywords (requires Ollama + embedded images)"
    )]
    async fn semantic_search(
        &self,
        Parameters(p): Parameters<SemanticSearchParams>,
    ) -> Result<CallToolResult, ErrorData> {
        let limit = p.limit.unwrap_or(20).clamp(1, 100);
        match semantic_search_impl(&self.db, &self.ollama, &p.query, limit, p.min_similarity).await
        {
            Ok(value) => Ok(json_result(value)),
            Err(e) => Ok(tool_error(e)),
        }
    }

    #[tool(description = "Create a tag. AI can tag images; rating/scoring stays human-only")]
    async fn create_tag(
        &self,
        Parameters(p): Parameters<CreateTagParams>,
    ) -> Result<CallToolResult, ErrorData> {
        create_tag_result(&self.db, &p.name, p.color.as_deref())
    }

    #[tool(description = "Associate an existing tag with an image")]
    async fn add_tag_to_image(
        &self,
        Parameters(p): Parameters<ImageTagParams>,
    ) -> Result<CallToolResult, ErrorData> {
        write_result(&self.db, |conn| {
            add_tag_to_image_impl(conn, &p.image_id, &p.tag_id).map_err(|e| e.to_string())
        })
    }

    #[tool(description = "Remove a tag from an image (no-op when the association is absent)")]
    async fn remove_tag_from_image(
        &self,
        Parameters(p): Parameters<ImageTagParams>,
    ) -> Result<CallToolResult, ErrorData> {
        write_result(&self.db, |conn| {
            remove_tag_from_image_impl(conn, &p.image_id, &p.tag_id).map_err(|e| e.to_string())
        })
    }

    #[tool(description = "Toggle the favorite flag of an image")]
    async fn toggle_favorite(
        &self,
        Parameters(p): Parameters<ImageIdParams>,
    ) -> Result<CallToolResult, ErrorData> {
        write_result(&self.db, |conn| {
            toggle_favorite_impl(conn, &p.id).map_err(|e| e.to_string())
        })
    }

    #[tool(description = "Move an image to trash (soft delete, reversible)")]
    async fn move_to_trash(
        &self,
        Parameters(p): Parameters<ImageIdParams>,
    ) -> Result<CallToolResult, ErrorData> {
        write_result(&self.db, |conn| {
            soft_delete_impl(conn, &p.id).map_err(|e| e.to_string())
        })
    }

    #[tool(description = "Restore an image from trash back to the library")]
    async fn restore_from_trash(
        &self,
        Parameters(p): Parameters<ImageIdParams>,
    ) -> Result<CallToolResult, ErrorData> {
        write_result(&self.db, |conn| {
            restore_impl(conn, &p.id).map_err(|e| e.to_string())
        })
    }
}

#[tool_handler(
    name = "lumora-mcp",
    instructions = "Lumora AI image library: browse, search, read and organize images (tags, favorites, trash). Rating/scoring stays human-only."
)]
impl ServerHandler for LumoraMcp {}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ImageDetail {
    #[serde(flatten)]
    record: ImageRecord,
    latest_analysis: Option<AnalysisResult>,
    embedding: Option<EmbeddingInfo>,
}

#[derive(Serialize)]
struct TagWithCount {
    id: String,
    name: String,
    color: Option<String>,
    count: i64,
}

#[derive(Serialize)]
struct SemanticHitDetail {
    id: String,
    similarity: f64,
    file_name: String,
    prompt: Option<String>,
    rating: i32,
    favorite: bool,
}

fn lock_db(db: &DbHandle) -> Result<MutexGuard<'_, Connection>, String> {
    db.conn()
        .lock()
        .map_err(|_| "database lock is poisoned".to_string())
}

fn json_result<T: Serialize>(value: T) -> CallToolResult {
    match ContentBlock::json(&value) {
        Ok(block) => CallToolResult::success(vec![block]),
        Err(e) => CallToolResult::error(vec![ContentBlock::text(format!(
            "serialization failed: {e}"
        ))]),
    }
}

fn tool_error(message: impl Into<String>) -> CallToolResult {
    CallToolResult::error(vec![ContentBlock::text(message.into())])
}

/// Run a write against the database; failures surface as tool-level errors.
fn write_result(
    db: &DbHandle,
    run: impl FnOnce(&Connection) -> Result<(), String>,
) -> Result<CallToolResult, ErrorData> {
    let conn = match lock_db(db) {
        Ok(conn) => conn,
        Err(e) => return Ok(tool_error(e)),
    };
    match run(&conn) {
        Ok(()) => Ok(json_result(serde_json::json!({ "ok": true }))),
        Err(e) => Ok(tool_error(e)),
    }
}

fn create_tag_result(
    db: &DbHandle,
    name: &str,
    color: Option<&str>,
) -> Result<CallToolResult, ErrorData> {
    let conn = match lock_db(db) {
        Ok(conn) => conn,
        Err(e) => return Ok(tool_error(e)),
    };
    match create_tag_impl(&conn, name, color) {
        Ok(id) => Ok(json_result(serde_json::json!({
            "id": id,
            "name": name.trim(),
            "color": color,
        }))),
        Err(e) => Ok(tool_error(e.to_string())),
    }
}

fn list_images_impl(db: &DbHandle, page: u32, per_page: u32) -> Result<PaginatedResult, String> {
    let conn = lock_db(db)?;
    let offset = page.saturating_sub(1) * per_page;
    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT * FROM images WHERE deleted = 0
             ORDER BY imported_at DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;
    let mut items: Vec<ImageRecord> = stmt
        .query_map(params![per_page, offset], row_to_record)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    attach_tags(&conn, &mut items).map_err(|e| e.to_string())?;
    Ok(PaginatedResult {
        items,
        total,
        page,
        per_page,
    })
}

fn search_images_impl(db: &DbHandle, query: &str, limit: u32) -> Result<Vec<ImageRecord>, String> {
    let conn = lock_db(db)?;
    let mut stmt = conn
        .prepare(
            "SELECT i.* FROM images i
             JOIN images_fts f ON f.rowid = i.rowid
             WHERE images_fts MATCH ?1 AND i.deleted = 0
             ORDER BY rank
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let escaped = escape_fts5(query);
    let mut items: Vec<ImageRecord> = stmt
        .query_map(params![escaped, limit], row_to_record)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    attach_tags(&conn, &mut items).map_err(|e| e.to_string())?;
    Ok(items)
}

fn get_image_impl(db: &DbHandle, id: &str) -> Result<ImageDetail, String> {
    let conn = lock_db(db)?;
    let mut stmt = conn
        .prepare("SELECT * FROM images WHERE id = ?1 AND deleted = 0")
        .map_err(|e| e.to_string())?;
    let mut record: ImageRecord = stmt
        .query_row(params![id], row_to_record)
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("image not found: {id}"))?;
    attach_tags(&conn, std::slice::from_mut(&mut record)).map_err(|e| e.to_string())?;
    let latest_analysis = get_latest_analysis(&conn, id).map_err(|e| e.to_string())?;
    let embedding = get_embedding_status_db(&conn, id).map_err(|e| e.to_string())?;
    Ok(ImageDetail {
        record,
        latest_analysis,
        embedding,
    })
}

fn image_file_impl(db: &DbHandle, id: &str) -> Result<(Vec<u8>, &'static str), String> {
    let conn = lock_db(db)?;
    let file_path: Option<String> = conn
        .query_row(
            "SELECT file_path FROM images WHERE id = ?1 AND deleted = 0",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    drop(conn);

    let file_path = file_path.ok_or_else(|| format!("image not found: {id}"))?;
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("file missing: {}", path.display()));
    }

    // Prefer a resized PNG so AI clients get a bounded, uniformly-encoded image.
    match image::open(path) {
        Ok(img) => {
            use image::GenericImageView;
            let (w, h) = img.dimensions();
            let thumb = if w > 1024 {
                let new_h = (h as f64 * 1024.0 / w as f64) as u32;
                img.resize(1024, new_h, image::imageops::FilterType::Triangle)
            } else {
                img
            };
            let mut buf = std::io::Cursor::new(Vec::new());
            thumb
                .write_to(&mut buf, image::ImageFormat::Png)
                .map_err(|e| format!("failed to encode thumbnail: {e}"))?;
            Ok((buf.into_inner(), "image/png"))
        }
        Err(_) => {
            let data = std::fs::read(path).map_err(|e| format!("failed to read file: {e}"))?;
            let mime = match path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase()
                .as_str()
            {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "gif" => "image/gif",
                "avif" => "image/avif",
                "bmp" => "image/bmp",
                _ => "application/octet-stream",
            };
            Ok((data, mime))
        }
    }
}

fn list_tags_impl(db: &DbHandle) -> Result<Vec<TagWithCount>, String> {
    let conn = lock_db(db)?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.color, COUNT(it.image_id) AS cnt
             FROM tags t
             LEFT JOIN image_tags it ON it.tag_id = t.id
             LEFT JOIN images i ON i.id = it.image_id AND i.deleted = 0
             GROUP BY t.id
             ORDER BY cnt DESC, t.name",
        )
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map([], |row| {
            Ok(TagWithCount {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(tags)
}

fn get_stats_impl(db: &DbHandle) -> Result<DashboardStats, String> {
    let conn = lock_db(db)?;
    get_dashboard_stats_inner(&conn).map_err(|e| e.to_string())
}

async fn semantic_search_impl(
    db: &DbHandle,
    ollama: &OllamaConfig,
    query: &str,
    limit: i64,
    min_similarity: Option<f64>,
) -> Result<Vec<SemanticHitDetail>, String> {
    let embedding = embed_text_ollama(ollama, query, "nomic-embed-text")
        .await
        .map_err(|e| format!("Ollama embedding failed: {e}"))?;

    let conn = lock_db(db)?;
    validate_query_dimension(&conn, embedding.len()).map_err(|e| e.to_string())?;
    let hits: Vec<SemanticSearchResult> =
        search_semantic_db(&conn, &embedding, limit, min_similarity).map_err(|e| e.to_string())?;

    let mut items = Vec::with_capacity(hits.len());
    for hit in hits {
        let row = conn
            .query_row(
                "SELECT file_path, json_extract(metadata_json, '$.prompt'), rating, favorite
                 FROM images WHERE id = ?1 AND deleted = 0",
                params![hit.id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, i32>(2)?,
                        row.get::<_, i32>(3)? != 0,
                    ))
                },
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some((file_path, prompt, rating, favorite)) = row {
            let file_name = Path::new(&file_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| hit.id.clone());
            items.push(SemanticHitDetail {
                id: hit.id,
                similarity: hit.similarity,
                file_name,
                prompt,
                rating,
                favorite,
            });
        }
    }
    Ok(items)
}
