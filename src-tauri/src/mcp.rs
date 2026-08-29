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

#[derive(Debug, Serialize)]
struct ImageDetail {
    #[serde(flatten)]
    record: ImageRecord,
    latest_analysis: Option<AnalysisResult>,
    embedding: Option<EmbeddingInfo>,
}

#[derive(Debug, Serialize)]
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
    let offset = page.saturating_sub(1).saturating_mul(per_page);
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
            let thumb = if w > 1024 || h > 1024 {
                // Cap the larger dimension so portrait/panorama images stay bounded too.
                img.resize(1024, 1024, image::imageops::FilterType::Triangle)
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
            // Undecodable file: bound the raw passthrough so a huge file cannot
            // be slurped into memory and base64-encoded over the network.
            const MAX_RAW_BYTES: u64 = 20 * 1024 * 1024;
            let len = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
            if len > MAX_RAW_BYTES {
                return Err(format!(
                    "file too large to return raw: {len} bytes (max 20 MiB)"
                ));
            }
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
            "SELECT t.id, t.name, t.color, COUNT(i.id) AS cnt
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> DbHandle {
        DbHandle::open_memory().unwrap()
    }

    fn insert_image(conn: &Connection, id: &str, path: &str) {
        conn.execute(
            "INSERT INTO images
             (id, file_path, file_hash, file_size_kb, format, created_at, imported_at, rating, favorite)
             VALUES (?1, ?2, 'h', 1, 'png', '2025-01-01', '2025-01-01T00:00:00Z', 3, 0)",
            params![id, path],
        )
        .unwrap();
    }

    fn call_result_is_error(result: &CallToolResult) -> bool {
        let value = serde_json::to_value(result).unwrap();
        value
            .get("isError")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    }

    #[test]
    fn service_constructs_without_network() {
        let db = test_db();
        let _service = service(db);
    }

    #[test]
    fn list_images_paginates_and_attaches_tags() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "i1", "/a.png");
            insert_image(&conn, "i2", "/b.png");
            conn.execute("INSERT INTO tags (id, name) VALUES ('t1', 'nature')", [])
                .unwrap();
            conn.execute(
                "INSERT INTO image_tags (image_id, tag_id) VALUES ('i1', 't1')",
                [],
            )
            .unwrap();
        }

        let page = list_images_impl(&db, 1, 1).unwrap();
        assert_eq!(page.total, 2);
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].tags.len(), 1);
        assert_eq!(page.items[0].tags[0], "nature");

        let page2 = list_images_impl(&db, 2, 1).unwrap();
        assert_eq!(page2.items.len(), 1);
        assert_ne!(page2.items[0].id, page.items[0].id);
    }

    #[test]
    fn search_images_matches_fts_over_prompt() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            conn.execute(
                "INSERT INTO images
                 (id, file_path, file_hash, file_size_kb, format, created_at, metadata_json)
                 VALUES ('s1', '/sunset.png', 'h', 1, 'png', '2025-01-01', '{\"prompt\":\"golden sunset\"}')",
                [],
            )
            .unwrap();
            insert_image(&conn, "s2", "/plain.png");
        }
        let hits = search_images_impl(&db, "sunset", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, "s1");
    }

    #[test]
    fn get_image_returns_detail_and_reports_missing() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "d1", "/d.png");
        }
        let detail = get_image_impl(&db, "d1").unwrap();
        assert_eq!(detail.record.id, "d1");
        assert!(detail.latest_analysis.is_none());
        assert!(detail.embedding.is_none());

        let err = get_image_impl(&db, "ghost").unwrap_err();
        assert!(err.contains("not found"));
    }

    #[test]
    fn image_file_resizes_png_and_falls_back_on_undecodable() {
        let db = test_db();
        let dir = tempfile::tempdir().unwrap();

        let png_path = dir.path().join("ok.png");
        let img = image::RgbImage::from_pixel(8, 8, image::Rgb([200, 30, 30]));
        img.save(&png_path).unwrap();

        let bin_path = dir.path().join("raw.webp");
        std::fs::write(&bin_path, b"not a real image").unwrap();

        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "png1", png_path.to_str().unwrap());
            insert_image(&conn, "webp1", bin_path.to_str().unwrap());
        }

        let (data, mime) = image_file_impl(&db, "png1").unwrap();
        assert_eq!(mime, "image/png");
        assert!(image::load_from_memory(&data).is_ok());

        let (raw, mime) = image_file_impl(&db, "webp1").unwrap();
        assert_eq!(mime, "image/webp");
        assert_eq!(raw, b"not a real image");

        let err = image_file_impl(&db, "ghost").unwrap_err();
        assert!(err.contains("not found"));
    }

    #[test]
    fn image_file_rejects_oversize_undecodable_file() {
        let db = test_db();
        let dir = tempfile::tempdir().unwrap();
        let big_path = dir.path().join("big.webp");
        std::fs::write(&big_path, vec![0u8; 20 * 1024 * 1024 + 1]).unwrap();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "big1", big_path.to_str().unwrap());
        }
        let err = image_file_impl(&db, "big1").unwrap_err();
        assert!(err.contains("too large"), "err: {err}");
    }

    #[test]
    fn list_images_huge_page_does_not_overflow() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "i1", "/a.png");
        }
        let page = list_images_impl(&db, u32::MAX, 10).unwrap();
        assert!(page.items.is_empty());
        assert_eq!(page.total, 1);
    }

    #[test]
    fn list_tags_counts_and_excludes_deleted_images() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "i1", "/a.png");
            conn.execute(
                "INSERT INTO tags (id, name, color) VALUES ('t1', 'landscape', '#fff')",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO image_tags (image_id, tag_id) VALUES ('i1', 't1')",
                [],
            )
            .unwrap();
            conn.execute("UPDATE images SET deleted = 1 WHERE id = 'i1'", [])
                .unwrap();
        }
        let tags = list_tags_impl(&db).unwrap();
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "landscape");
        assert_eq!(tags[0].count, 0);
    }

    #[test]
    fn get_stats_returns_dashboard_stats() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "i1", "/a.png");
        }
        let stats = get_stats_impl(&db).unwrap();
        assert_eq!(stats.total_images, 1);
    }

    #[test]
    fn tool_wrappers_run_against_memory_db() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "i1", "/a.png");
            insert_image(&conn, "i2", "/b.png");
        }
        let handler = LumoraMcp::new(db, OllamaConfig::from_env());
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            // Read tools.
            let list = handler
                .list_images(Parameters(ListImagesParams {
                    page: Some(1),
                    per_page: Some(10),
                }))
                .await
                .unwrap();
            assert!(!call_result_is_error(&list));

            let search = handler
                .search_images(Parameters(SearchImagesParams {
                    query: "a".to_string(),
                    limit: None,
                }))
                .await
                .unwrap();
            assert!(!call_result_is_error(&search));

            let detail = handler
                .get_image(Parameters(ImageIdParams {
                    id: "i1".to_string(),
                }))
                .await
                .unwrap();
            assert!(!call_result_is_error(&detail));

            let tags = handler.list_tags().await.unwrap();
            assert!(!call_result_is_error(&tags));

            let stats = handler.get_stats().await.unwrap();
            assert!(!call_result_is_error(&stats));

            // Write tools.
            let created = handler
                .create_tag(Parameters(CreateTagParams {
                    name: "nature".to_string(),
                    color: Some("#0f0".to_string()),
                }))
                .await
                .unwrap();
            assert!(!call_result_is_error(&created));
            let tag_id: String = handler
                .db
                .conn()
                .lock()
                .unwrap()
                .query_row("SELECT id FROM tags WHERE name = 'nature'", [], |r| {
                    r.get(0)
                })
                .unwrap();

            let attached = handler
                .add_tag_to_image(Parameters(ImageTagParams {
                    image_id: "i1".to_string(),
                    tag_id: tag_id.clone(),
                }))
                .await
                .unwrap();
            assert!(!call_result_is_error(&attached));

            let detached = handler
                .remove_tag_from_image(Parameters(ImageTagParams {
                    image_id: "i1".to_string(),
                    tag_id,
                }))
                .await
                .unwrap();
            assert!(!call_result_is_error(&detached));

            let favored = handler
                .toggle_favorite(Parameters(ImageIdParams {
                    id: "i2".to_string(),
                }))
                .await
                .unwrap();
            assert!(!call_result_is_error(&favored));

            let trashed = handler
                .move_to_trash(Parameters(ImageIdParams {
                    id: "i2".to_string(),
                }))
                .await
                .unwrap();
            assert!(!call_result_is_error(&trashed));

            let restored = handler
                .restore_from_trash(Parameters(ImageIdParams {
                    id: "i2".to_string(),
                }))
                .await
                .unwrap();
            assert!(!call_result_is_error(&restored));
        });
    }

    #[test]
    fn tool_wrappers_surface_domain_errors() {
        let db = test_db();
        {
            let conn = db.conn().lock().unwrap();
            insert_image(&conn, "i1", "/a.png");
        }
        let handler = LumoraMcp::new(db, OllamaConfig::from_env());
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let missing = handler
                .get_image(Parameters(ImageIdParams {
                    id: "ghost".to_string(),
                }))
                .await
                .unwrap();
            assert!(call_result_is_error(&missing));

            let empty_tag = handler
                .create_tag(Parameters(CreateTagParams {
                    name: "   ".to_string(),
                    color: None,
                }))
                .await
                .unwrap();
            assert!(call_result_is_error(&empty_tag));

            let bad_trash = handler
                .move_to_trash(Parameters(ImageIdParams {
                    id: "ghost".to_string(),
                }))
                .await
                .unwrap();
            assert!(call_result_is_error(&bad_trash));
        });
    }
}
