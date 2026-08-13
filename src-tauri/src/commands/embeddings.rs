use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::command;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};

/// Embedding status returned to frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmbeddingInfo {
    pub status: String, // "embedded" | "pending" | "error"
    pub dimensions: Option<i64>,
    pub generated_at: Option<String>,
}

/// Result from semantic search.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SemanticSearchResult {
    pub id: String,
    pub similarity: f64,
}

/// L2-normalize a vector so cosine similarity can be derived from the
/// sqlite-vec L2 distance (cos = 1 - d^2 / 2 for unit vectors). Zero vectors
/// are returned unchanged because they cannot be normalized.
pub fn normalize(v: &[f64]) -> Vec<f64> {
    let norm: f64 = v.iter().map(|x| x * x).sum::<f64>().sqrt();
    if norm <= f64::EPSILON {
        return v.to_vec();
    }
    v.iter().map(|x| x / norm).collect()
}

/// Validate that a query vector has the same dimensions as the stored
/// embeddings. Fails fast with a friendly message instead of letting
/// sqlite-vec report an opaque dimension mismatch.
pub(crate) fn validate_query_dimension(conn: &Connection, dim: usize) -> AppResult<()> {
    let stored: Option<i64> = conn
        .query_row("SELECT dimensions FROM embeddings LIMIT 1", [], |r| {
            r.get(0)
        })
        .ok();
    if let Some(d) = stored {
        if d as usize != dim {
            return Err(AppError::InvalidInput(format!(
                "嵌入维度不匹配：索引为 {d} 维，当前查询为 {dim} 维"
            )));
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Internal DB operations
// ---------------------------------------------------------------------------

/// Insert or update an embedding for an image.
///
/// Wraps the upsert in an explicit transaction so the regular `embeddings`
/// table and the `vec_embeddings` virtual table stay consistent — if either
/// write fails the whole operation rolls back (fixes #3).
pub fn upsert_embedding(
    conn: &Connection,
    image_id: &str,
    embedding: &[f64],
) -> Result<(), rusqlite::Error> {
    // Store normalized vectors so KNN distance maps to cosine similarity.
    let embedding = normalize(embedding);
    // Convert f64 slice to bytes (little-endian)
    let bytes: Vec<u8> = embedding
        .iter()
        .flat_map(|f| f.to_le_bytes().to_vec())
        .collect();
    let dims = embedding.len() as i64;

    let tx = conn.unchecked_transaction()?;

    // Upsert into regular embeddings table
    tx.execute(
        "INSERT OR REPLACE INTO embeddings (image_id, embedding, dimensions, status, generated_at)
         VALUES (?1, ?2, ?3, 'embedded', datetime('now'))",
        rusqlite::params![image_id, bytes, dims],
    )?;

    // For vec0 table: delete-then-insert (vec0 doesn't support INSERT OR REPLACE)
    let vec_json = serde_json::to_string(&embedding).unwrap_or_default();
    tx.execute(
        "DELETE FROM vec_embeddings WHERE image_id = ?1",
        rusqlite::params![image_id],
    )?;
    tx.execute(
        "INSERT INTO vec_embeddings (image_id, embedding)
         VALUES (?1, ?2)",
        rusqlite::params![image_id, vec_json],
    )?;

    tx.commit()?;
    Ok(())
}

/// Get embedding status for an image.
pub fn get_embedding_status_db(
    conn: &Connection,
    image_id: &str,
) -> Result<Option<EmbeddingInfo>, rusqlite::Error> {
    let mut stmt = conn
        .prepare("SELECT status, dimensions, generated_at FROM embeddings WHERE image_id = ?1")?;
    let mut rows = stmt.query_map(rusqlite::params![image_id], |row| {
        Ok(EmbeddingInfo {
            status: row.get(0)?,
            dimensions: row.get(1)?,
            generated_at: row.get(2)?,
        })
    })?;

    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

/// List images that have no embedding row yet (deleted excluded), newest
/// imports first. Returns (image_id, description) where description prefers
/// the stored prompt and falls back to the file name.
pub fn list_missing_embedding_images_db(
    conn: &Connection,
    limit: i64,
) -> Result<Vec<(String, String)>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT i.id, json_extract(i.metadata_json, '$.prompt') AS prompt, i.file_path
         FROM images i
         WHERE i.deleted = 0
           AND NOT EXISTS (SELECT 1 FROM embeddings e WHERE e.image_id = i.id)
         ORDER BY i.imported_at ASC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map(rusqlite::params![limit], |row| {
        let id: String = row.get(0)?;
        let prompt: Option<String> = row.get(1)?;
        let file_path: String = row.get(2)?;
        let file_name = std::path::Path::new(&file_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| id.clone());
        let description = prompt
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
            .unwrap_or(file_name);
        Ok((id, description))
    })?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

/// Perform KNN search using sqlite-vec.
pub fn search_semantic_db(
    conn: &Connection,
    query_embedding: &[f64],
    limit: i64,
    min_similarity: Option<f64>,
) -> Result<Vec<SemanticSearchResult>, rusqlite::Error> {
    // Normalize the query so distances are comparable to stored unit vectors.
    let query = normalize(query_embedding);
    let query_json = serde_json::to_string(&query).unwrap_or_default();
    let min_sim = min_similarity.unwrap_or(-1.0).clamp(-1.0, 1.0);

    let mut stmt = conn.prepare(
        "SELECT image_id, distance FROM vec_embeddings
         WHERE embedding MATCH ?1
         ORDER BY distance ASC
         LIMIT ?2",
    )?;

    let rows = stmt.query_map(rusqlite::params![query_json, limit], |row| {
        let distance: f64 = row.get(1)?;
        // For unit vectors: cosine similarity = 1 - d^2 / 2.
        let similarity = 1.0 - (distance * distance) / 2.0;
        Ok(SemanticSearchResult {
            id: row.get(0)?,
            similarity,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        let result = row?;
        if result.similarity >= min_sim {
            results.push(result);
        }
    }
    Ok(results)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[command]
pub async fn generate_embedding(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
    embedding: Vec<f64>,
) -> AppResult<()> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(upsert_embedding(&conn, &image_id, &embedding)?)
}

#[command]
pub async fn get_embedding_status_cmd(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
) -> AppResult<Option<EmbeddingInfo>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(get_embedding_status_db(&conn, &image_id)?)
}

#[command]
pub async fn search_semantic_cmd(
    db: tauri::State<'_, DbHandle>,
    query_embedding: Vec<f64>,
    limit: Option<i64>,
    min_similarity: Option<f64>,
) -> AppResult<Vec<SemanticSearchResult>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    validate_query_dimension(&conn, query_embedding.len())?;
    Ok(search_semantic_db(
        &conn,
        &query_embedding,
        limit.unwrap_or(20),
        min_similarity,
    )?)
}

/// Aggregate embedding statistics.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmbeddingStats {
    pub embedded: i64,
    pub pending: i64,
    pub error: i64,
    pub total: i64,
    pub missing: i64,
}

/// Get aggregate embedding stats from the database.
pub fn get_embedding_stats_db(conn: &Connection) -> Result<EmbeddingStats, rusqlite::Error> {
    let embedded: i64 = conn.query_row(
        "SELECT COUNT(*) FROM embeddings WHERE status = 'embedded'",
        [],
        |r| r.get(0),
    )?;
    let pending: i64 = conn.query_row(
        "SELECT COUNT(*) FROM embeddings WHERE status = 'pending'",
        [],
        |r| r.get(0),
    )?;
    let error: i64 = conn.query_row(
        "SELECT COUNT(*) FROM embeddings WHERE status = 'error'",
        [],
        |r| r.get(0),
    )?;
    // total = library size (non-deleted images); missing = images without any
    // embedding row, so semantic coverage is visible and trustworthy.
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
        r.get(0)
    })?;
    let missing: i64 = conn.query_row(
        "SELECT COUNT(*) FROM images i
         WHERE i.deleted = 0
           AND NOT EXISTS (SELECT 1 FROM embeddings e WHERE e.image_id = i.id)",
        [],
        |r| r.get(0),
    )?;
    Ok(EmbeddingStats {
        embedded,
        pending,
        error,
        total,
        missing,
    })
}

/// Rewrite stored embeddings that are not unit vectors (legacy data written
/// before normalization). Idempotent: already-normalized vectors are skipped.
pub fn normalize_embeddings_db(conn: &Connection) -> Result<usize, rusqlite::Error> {
    let mut stmt =
        conn.prepare("SELECT image_id, embedding FROM embeddings WHERE status = 'embedded'")?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Vec<u8>>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    drop(stmt);

    let mut rewritten = 0usize;
    for (image_id, bytes) in rows {
        let vec: Vec<f64> = bytes
            .chunks_exact(8)
            .map(|c| f64::from_le_bytes(c.try_into().unwrap()))
            .collect();
        let norm: f64 = vec.iter().map(|x| x * x).sum::<f64>().sqrt();
        if (norm - 1.0).abs() > 1e-6 {
            upsert_embedding(conn, &image_id, &vec)?;
            rewritten += 1;
        }
    }
    Ok(rewritten)
}

#[command]
pub async fn normalize_embeddings_cmd(db: tauri::State<'_, DbHandle>) -> AppResult<usize> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(normalize_embeddings_db(&conn)?)
}

#[command]
pub async fn get_embedding_stats_cmd(db: tauri::State<'_, DbHandle>) -> AppResult<EmbeddingStats> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(get_embedding_stats_db(&conn)?)
}

/// Generate text embedding using Ollama.
pub(crate) async fn embed_text_ollama(
    cfg: &crate::ollama::OllamaConfig,
    text: &str,
    model: &str,
) -> AppResult<Vec<f64>> {
    let response = cfg
        .client()
        .post(cfg.url("/api/embed"))
        .json(&serde_json::json!({
            "model": model,
            "input": text
        }))
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(AppError::External(format!(
            "Ollama returned status: {}",
            response.status()
        )));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    // Try multiple possible Ollama embedding response shapes (fallback chain).
    // Ollama v0.x: { "embeddings": [[...]] }
    // Some forks/versions: { "embeddings": [...] } or { "embedding": [...] }
    let vec = body["embeddings"]
        // Shape 1: [[...]] — standard Ollama embeddings API
        .get(0)
        .and_then(|v| v.as_array())
        // Shape 2: [...] — flat array under "embeddings"
        .or_else(|| body["embeddings"].as_array())
        // Shape 3: { "embedding": [...] } — single-vector shape
        .or_else(|| body["embedding"].as_array())
        .map(|arr| {
            arr.iter()
                .map(|v| v.as_f64().unwrap_or(0.0))
                .collect::<Vec<f64>>()
        })
        .ok_or_else(|| {
            AppError::External(format!(
                "Invalid embeddings response shape: {}",
                serde_json::to_string(&body).unwrap_or_default()
            ))
        })?;

    if vec.is_empty() {
        return Err(AppError::External("Empty embedding returned".to_string()));
    }

    Ok(vec)
}

#[command]
pub async fn embed_text_cmd(
    cfg: tauri::State<'_, crate::ollama::OllamaConfig>,
    text: String,
    model: Option<String>,
) -> AppResult<Vec<f64>> {
    let model_name = model.unwrap_or_else(|| "nomic-embed-text".to_string());
    embed_text_ollama(&cfg, &text, &model_name).await
}

#[command]
pub async fn generate_embedding_for_image_cmd(
    db: tauri::State<'_, DbHandle>,
    cfg: tauri::State<'_, crate::ollama::OllamaConfig>,
    image_id: String,
    description: String,
    model: Option<String>,
) -> AppResult<()> {
    let model_name = model.unwrap_or_else(|| "nomic-embed-text".to_string());
    let embedding = embed_text_ollama(&cfg, &description, &model_name).await?;

    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(upsert_embedding(&conn, &image_id, &embedding)?)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmbedMissingResult {
    pub processed: i64,
    pub remaining: i64,
}

/// Embed images that have no embedding row yet, in batches (default 10, max
/// 50). Fails fast if the embedding backend is unreachable; images processed
/// before the failure stay embedded.
#[command]
pub async fn embed_missing_cmd(
    db: tauri::State<'_, DbHandle>,
    cfg: tauri::State<'_, crate::ollama::OllamaConfig>,
    limit: Option<i64>,
    model: Option<String>,
) -> AppResult<EmbedMissingResult> {
    let model_name = model.unwrap_or_else(|| "nomic-embed-text".to_string());
    let batch = limit.unwrap_or(10).clamp(1, 50);

    let missing = {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        list_missing_embedding_images_db(&conn, batch)?
    };

    let mut processed = 0i64;
    for (image_id, description) in missing {
        let embedding = embed_text_ollama(&cfg, &description, &model_name).await?;
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        upsert_embedding(&conn, &image_id, &embedding)?;
        processed += 1;
    }

    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let remaining = list_missing_embedding_images_db(&conn, i64::MAX)?.len() as i64;
    Ok(EmbedMissingResult {
        processed,
        remaining,
    })
}

// ---------------------------------------------------------------------------
// CLIP (image) embedding space — dedicated 512-dim index for image-to-image
// search. Kept separate from the 768-dim Ollama text index: the two models
// emit different dimensions and cross-space similarity is meaningless.
// ---------------------------------------------------------------------------

/// Insert or update a CLIP image embedding (512-dim) in one transaction.
pub fn upsert_clip_embedding(
    conn: &Connection,
    image_id: &str,
    embedding: &[f64],
) -> Result<(), rusqlite::Error> {
    let embedding = normalize(embedding);
    let bytes: Vec<u8> = embedding
        .iter()
        .flat_map(|f| f.to_le_bytes().to_vec())
        .collect();
    let dims = embedding.len() as i64;

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT OR REPLACE INTO clip_embeddings (image_id, embedding, dimensions, status, generated_at)
         VALUES (?1, ?2, ?3, 'embedded', datetime('now'))",
        rusqlite::params![image_id, bytes, dims],
    )?;

    let vec_json = serde_json::to_string(&embedding).unwrap_or_default();
    tx.execute(
        "DELETE FROM vec_embeddings_clip WHERE image_id = ?1",
        rusqlite::params![image_id],
    )?;
    tx.execute(
        "INSERT INTO vec_embeddings_clip (image_id, embedding)
         VALUES (?1, ?2)",
        rusqlite::params![image_id, vec_json],
    )?;
    tx.commit()?;
    Ok(())
}

/// Record a failed CLIP embedding so it is excluded from the missing list
/// and shows up as `error` in the stats instead of being retried forever.
fn mark_clip_error(conn: &Connection, image_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO clip_embeddings (image_id, embedding, dimensions, status, generated_at)
         VALUES (?1, X'', 512, 'error', datetime('now'))",
        rusqlite::params![image_id],
    )?;
    Ok(())
}

/// Validate a CLIP query vector against the stored CLIP index dimension.
pub(crate) fn validate_clip_query_dimension(conn: &Connection, dim: usize) -> AppResult<()> {
    let stored: Option<i64> = conn
        .query_row("SELECT dimensions FROM clip_embeddings LIMIT 1", [], |r| {
            r.get(0)
        })
        .ok();
    if let Some(d) = stored {
        if d as usize != dim {
            return Err(AppError::InvalidInput(format!(
                "CLIP 嵌入维度不匹配：索引为 {d} 维，当前查询为 {dim} 维"
            )));
        }
    }
    Ok(())
}

/// List images missing from the CLIP index (deleted excluded), oldest
/// imports first. Returns (image_id, file_path).
pub fn list_missing_clip_db(
    conn: &Connection,
    limit: i64,
) -> Result<Vec<(String, String)>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT i.id, i.file_path
         FROM images i
         WHERE i.deleted = 0
           AND NOT EXISTS (SELECT 1 FROM clip_embeddings c WHERE c.image_id = i.id)
         ORDER BY i.imported_at ASC
         LIMIT ?1",
    )?;
    let rows = stmt.query_map(rusqlite::params![limit], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;
    let mut items = Vec::new();
    for row in rows {
        items.push(row?);
    }
    Ok(items)
}

/// KNN search over the CLIP image index.
pub fn search_clip_db(
    conn: &Connection,
    query_embedding: &[f64],
    limit: i64,
    min_similarity: Option<f64>,
) -> Result<Vec<SemanticSearchResult>, rusqlite::Error> {
    let query = normalize(query_embedding);
    let query_json = serde_json::to_string(&query).unwrap_or_default();
    let min_sim = min_similarity.unwrap_or(-1.0).clamp(-1.0, 1.0);

    let mut stmt = conn.prepare(
        "SELECT image_id, distance FROM vec_embeddings_clip
         WHERE embedding MATCH ?1
         ORDER BY distance ASC
         LIMIT ?2",
    )?;

    let rows = stmt.query_map(rusqlite::params![query_json, limit], |row| {
        let distance: f64 = row.get(1)?;
        let similarity = 1.0 - (distance * distance) / 2.0;
        Ok(SemanticSearchResult {
            id: row.get(0)?,
            similarity,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        let result = row?;
        if result.similarity >= min_sim {
            results.push(result);
        }
    }
    Ok(results)
}

/// Aggregate CLIP embedding statistics.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClipEmbeddingStats {
    pub embedded: i64,
    pub error: i64,
    pub total: i64,
    pub missing: i64,
}

/// Get aggregate CLIP embedding stats from the database.
pub fn get_clip_stats_db(conn: &Connection) -> Result<ClipEmbeddingStats, rusqlite::Error> {
    let embedded: i64 = conn.query_row(
        "SELECT COUNT(*) FROM clip_embeddings WHERE status = 'embedded'",
        [],
        |r| r.get(0),
    )?;
    let error: i64 = conn.query_row(
        "SELECT COUNT(*) FROM clip_embeddings WHERE status = 'error'",
        [],
        |r| r.get(0),
    )?;
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
        r.get(0)
    })?;
    let missing: i64 = conn.query_row(
        "SELECT COUNT(*) FROM images i
         WHERE i.deleted = 0
           AND NOT EXISTS (SELECT 1 FROM clip_embeddings c WHERE c.image_id = i.id)",
        [],
        |r| r.get(0),
    )?;
    Ok(ClipEmbeddingStats {
        embedded,
        error,
        total,
        missing,
    })
}

#[command]
pub async fn get_clip_embedding_stats_cmd(
    db: tauri::State<'_, DbHandle>,
) -> AppResult<ClipEmbeddingStats> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(get_clip_stats_db(&conn)?)
}

/// Image-to-image semantic search over the CLIP index.
#[command]
pub async fn search_semantic_image_cmd(
    db: tauri::State<'_, DbHandle>,
    query_embedding: Vec<f64>,
    limit: Option<i64>,
    min_similarity: Option<f64>,
) -> AppResult<Vec<SemanticSearchResult>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    validate_clip_query_dimension(&conn, query_embedding.len())?;
    Ok(search_clip_db(
        &conn,
        &query_embedding,
        limit.unwrap_or(20),
        min_similarity,
    )?)
}

/// Generate CLIP embeddings for images missing from the CLIP index, in
/// batches (default 10, max 50). One sidecar process per batch so the model
/// is loaded once; unreadable images are marked `error` rather than retried.
#[command]
pub async fn embed_clip_missing_cmd(
    db: tauri::State<'_, DbHandle>,
    limit: Option<i64>,
) -> AppResult<EmbedMissingResult> {
    let batch = limit.unwrap_or(10).clamp(1, 50);

    let missing = {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        list_missing_clip_db(&conn, batch)?
    };

    let paths: Vec<String> = missing.iter().map(|(_, p)| p.clone()).collect();
    // CLIP inference is CPU-bound; run it off the async executor thread.
    let embeddings = tauri::async_runtime::spawn_blocking(move || {
        crate::commands::clip::clip_embed_images(&paths)
    })
    .await
    .map_err(|e| AppError::External(format!("CLIP task failed: {e}")))??;

    let mut processed = 0i64;
    for ((image_id, _), embedding) in missing.iter().zip(embeddings) {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        match embedding {
            Some(vec) => upsert_clip_embedding(&conn, image_id, &vec)?,
            None => mark_clip_error(&conn, image_id)?,
        }
        processed += 1;
    }

    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let remaining = list_missing_clip_db(&conn, i64::MAX)?.len() as i64;
    Ok(EmbedMissingResult {
        processed,
        remaining,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upsert_and_get_embedding() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        // First insert an image (FK constraint)
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('img-1', '/test.png', 'hash1', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        // Create a 768-dim embedding (zeros for test)
        let embedding: Vec<f64> = vec![0.0; 768];
        upsert_embedding(&conn, "img-1", &embedding).unwrap();

        // Verify status
        let info = get_embedding_status_db(&conn, "img-1").unwrap().unwrap();
        assert_eq!(info.status, "embedded");
        assert_eq!(info.dimensions, Some(768));
        assert!(info.generated_at.is_some());
    }

    #[test]
    fn get_status_returns_none_for_missing() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        let info = get_embedding_status_db(&conn, "nonexistent").unwrap();
        assert!(info.is_none());
    }

    #[test]
    fn upsert_updates_existing() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('img-1', '/test.png', 'hash1', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        // First insert with one set of values
        let mut embedding1: Vec<f64> = vec![0.0; 768];
        embedding1[0] = 0.1;
        upsert_embedding(&conn, "img-1", &embedding1).unwrap();

        let info = get_embedding_status_db(&conn, "img-1").unwrap().unwrap();
        assert_eq!(info.status, "embedded");
        assert_eq!(info.dimensions, Some(768));

        // Update with different values (same 768 dimensions for vec0)
        let mut embedding2: Vec<f64> = vec![0.0; 768];
        embedding2[0] = 0.9;
        upsert_embedding(&conn, "img-1", &embedding2).unwrap();

        let info = get_embedding_status_db(&conn, "img-1").unwrap().unwrap();
        assert_eq!(info.status, "embedded");
        assert_eq!(info.dimensions, Some(768));
    }

    #[test]
    fn semantic_search_returns_results() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        // Insert test images and embeddings
        for i in 0..3 {
            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
                 VALUES (?1, ?2, ?3, 100, 'png', '2025-01-01')",
                rusqlite::params![
                    format!("img-{}", i),
                    format!("/test{}.png", i),
                    format!("hash{}", i)
                ],
            )
            .unwrap();

            // Create embeddings with slight variations
            let mut embedding: Vec<f64> = vec![0.0; 768];
            embedding[0] = i as f64 * 0.1; // Small variation
            upsert_embedding(&conn, &format!("img-{}", i), &embedding).unwrap();
        }

        // Search with a query embedding close to img-0
        let mut query: Vec<f64> = vec![0.0; 768];
        query[0] = 0.05; // Close to img-0's first dimension (0.0)
        let results = search_semantic_db(&conn, &query, 10, None).unwrap();

        assert!(!results.is_empty());
        assert!(results.len() <= 3);
        // First result should be most similar (closest to query)
        assert!(results[0].similarity >= results.last().unwrap().similarity);
    }

    #[test]
    fn semantic_search_respects_limit() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        // Insert 5 test images
        for i in 0..5 {
            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
                 VALUES (?1, ?2, ?3, 100, 'png', '2025-01-01')",
                rusqlite::params![
                    format!("img-{}", i),
                    format!("/test{}.png", i),
                    format!("hash{}", i)
                ],
            )
            .unwrap();

            let embedding: Vec<f64> = vec![0.0; 768];
            upsert_embedding(&conn, &format!("img-{}", i), &embedding).unwrap();
        }

        let query: Vec<f64> = vec![0.0; 768];
        let results = search_semantic_db(&conn, &query, 2, None).unwrap();
        assert!(results.len() <= 2);
    }

    #[test]
    fn normalize_makes_unit_vectors_and_keeps_zero() {
        let v = vec![3.0, 4.0];
        let n = normalize(&v);
        assert!((n[0] - 0.6).abs() < 1e-9);
        assert!((n[1] - 0.8).abs() < 1e-9);

        let zero = vec![0.0, 0.0];
        assert_eq!(normalize(&zero), zero);
    }

    #[test]
    fn upsert_stores_normalized_embedding() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('img-1', '/test.png', 'hash1', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        let mut embedding = vec![0.0; 768];
        embedding[0] = 3.0;
        embedding[1] = 4.0;
        upsert_embedding(&conn, "img-1", &embedding).unwrap();

        let bytes: Vec<u8> = conn
            .query_row(
                "SELECT embedding FROM embeddings WHERE image_id = 'img-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let stored: Vec<f64> = bytes
            .chunks_exact(8)
            .map(|c| f64::from_le_bytes(c.try_into().unwrap()))
            .collect();
        let norm: f64 = stored.iter().map(|x| x * x).sum::<f64>().sqrt();
        assert!((norm - 1.0).abs() < 1e-9);
        assert!((stored[0] - 0.6).abs() < 1e-9);
        assert!((stored[1] - 0.8).abs() < 1e-9);
    }

    #[test]
    fn cosine_similarity_from_normalized_distance() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('img-a', '/a.png', 'h1', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        // Query [1,0,...] vs stored [0.6,0.8,...] => cosine 0.6.
        let mut stored = vec![0.0; 768];
        stored[0] = 0.6;
        stored[1] = 0.8;
        upsert_embedding(&conn, "img-a", &stored).unwrap();

        let mut query = vec![0.0; 768];
        query[0] = 1.0;
        let results = search_semantic_db(&conn, &query, 10, None).unwrap();
        assert_eq!(results.len(), 1);
        assert!((results[0].similarity - 0.6).abs() < 1e-6);
    }

    #[test]
    fn min_similarity_filters_low_matches() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        for (id, x, y) in [("a", 1.0, 0.0), ("b", 0.5, 0.5), ("c", 0.0, -1.0)] {
            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
                 VALUES (?1, ?2, 'h', 100, 'png', '2025-01-01')",
                rusqlite::params![id, format!("/{id}.png")],
            )
            .unwrap();
            let mut emb = vec![0.0; 768];
            emb[0] = x;
            emb[1] = y;
            upsert_embedding(&conn, id, &emb).unwrap();
        }

        let mut query = vec![0.0; 768];
        query[0] = 1.0;
        let results = search_semantic_db(&conn, &query, 10, Some(0.5)).unwrap();
        // a: cos 1.0, b: cos 0.707, c: cos 0.0 -> c filtered out.
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|r| r.similarity >= 0.5));
    }

    #[test]
    fn dimension_mismatch_returns_friendly_error() {
        let db = DbHandle::open_memory().unwrap();
        {
            let conn = db.conn().lock().unwrap();
            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
                 VALUES ('img-1', '/test.png', 'hash1', 100, 'png', '2025-01-01')",
                [],
            )
            .unwrap();
            upsert_embedding(&conn, "img-1", &vec![0.0; 768]).unwrap();
        }

        let conn = db.conn().lock().unwrap();
        let err = validate_query_dimension(&conn, 512).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
        assert!(err.to_string().contains("768"));
    }

    #[test]
    fn normalize_embeddings_rewrites_legacy_vectors() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('img-1', '/test.png', 'hash1', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        // Insert a legacy (non-normalized) vector directly, bypassing upsert.
        let legacy: Vec<f64> = vec![3.0, 4.0, 0.0]; // dims don't matter for the test helper
        let padded: Vec<f64> = legacy
            .iter()
            .copied()
            .chain(std::iter::repeat(0.0).take(768 - 3))
            .collect();
        let bytes: Vec<u8> = padded
            .iter()
            .flat_map(|f| f.to_le_bytes().to_vec())
            .collect();
        conn.execute(
            "INSERT INTO embeddings (image_id, embedding, dimensions, status)
             VALUES ('img-1', ?1, 768, 'embedded')",
            rusqlite::params![bytes],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO vec_embeddings (image_id, embedding) VALUES ('img-1', ?1)",
            rusqlite::params![serde_json::to_string(&padded).unwrap()],
        )
        .unwrap();

        let rewritten = normalize_embeddings_db(&conn).unwrap();
        assert_eq!(rewritten, 1);

        // Second pass is idempotent.
        let rewritten = normalize_embeddings_db(&conn).unwrap();
        assert_eq!(rewritten, 0);

        // Stored vector is now a unit vector.
        let stored_bytes: Vec<u8> = conn
            .query_row(
                "SELECT embedding FROM embeddings WHERE image_id = 'img-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let stored: Vec<f64> = stored_bytes
            .chunks_exact(8)
            .map(|c| f64::from_le_bytes(c.try_into().unwrap()))
            .collect();
        let norm: f64 = stored.iter().map(|x| x * x).sum::<f64>().sqrt();
        assert!((norm - 1.0).abs() < 1e-9);
    }

    #[test]
    fn embedding_stats_counts_correctly() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        // Insert test images
        for i in 0..3 {
            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
                 VALUES (?1, ?2, ?3, 100, 'png', '2025-01-01')",
                rusqlite::params![
                    format!("img-{}", i),
                    format!("/test{}.png", i),
                    format!("hash{}", i)
                ],
            )
            .unwrap();
        }

        // Insert 2 embedded, 0 pending, 0 error
        let embedding: Vec<f64> = vec![0.0; 768];
        upsert_embedding(&conn, "img-0", &embedding).unwrap();
        upsert_embedding(&conn, "img-1", &embedding).unwrap();

        let stats = get_embedding_stats_db(&conn).unwrap();
        assert_eq!(stats.embedded, 2);
        assert_eq!(stats.pending, 0);
        assert_eq!(stats.error, 0);
        assert_eq!(stats.total, 3);
        assert_eq!(stats.missing, 1);
    }

    #[test]
    fn stats_and_missing_count_library_gaps() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        for i in 0..3 {
            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at, metadata_json, imported_at)
                 VALUES (?1, ?2, ?3, 100, 'png', '2025-01-01', ?4, ?5)",
                rusqlite::params![
                    format!("img-{}", i),
                    format!("/t{}.png", i),
                    format!("h{}", i),
                    if i == 0 { "{\"prompt\":\"a cat\"}" } else { "{}" },
                    format!("2025-01-01 00:00:0{}", i)
                ],
            )
            .unwrap();
        }

        let missing = list_missing_embedding_images_db(&conn, 10).unwrap();
        assert_eq!(missing.len(), 3);
        assert_eq!(missing[0].0, "img-0");
        assert_eq!(missing[0].1, "a cat");
        assert!(missing[1].1.ends_with(".png"));

        upsert_embedding(&conn, "img-0", &vec![0.0; 768]).unwrap();

        let one = list_missing_embedding_images_db(&conn, 1).unwrap();
        assert_eq!(one.len(), 1);

        let stats = get_embedding_stats_db(&conn).unwrap();
        assert_eq!(stats.total, 3);
        assert_eq!(stats.embedded, 1);
        assert_eq!(stats.missing, 2);
    }

    #[test]
    fn upsert_and_search_clip_embedding() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('img-c', '/c.png', 'hc', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        let mut embedding = vec![0.0; 512];
        embedding[0] = 1.0;
        upsert_clip_embedding(&conn, "img-c", &embedding).unwrap();

        let stats = get_clip_stats_db(&conn).unwrap();
        assert_eq!(stats.embedded, 1);
        assert_eq!(stats.total, 1);
        assert_eq!(stats.missing, 0);

        let mut query = vec![0.0; 512];
        query[0] = 1.0;
        let results = search_clip_db(&conn, &query, 10, None).unwrap();
        assert_eq!(results.len(), 1);
        assert!((results[0].similarity - 1.0).abs() < 1e-6);
    }

    #[test]
    fn clip_dimension_mismatch_returns_friendly_error() {
        let db = DbHandle::open_memory().unwrap();
        {
            let conn = db.conn().lock().unwrap();
            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
                 VALUES ('img-c', '/c.png', 'hc', 100, 'png', '2025-01-01')",
                [],
            )
            .unwrap();
            upsert_clip_embedding(&conn, "img-c", &vec![0.0; 512]).unwrap();
        }

        let conn = db.conn().lock().unwrap();
        let err = validate_clip_query_dimension(&conn, 768).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
        assert!(err.to_string().contains("512"));
    }

    #[test]
    fn clip_missing_list_and_error_marking() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        for i in 0..2 {
            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at, imported_at)
                 VALUES (?1, ?2, ?3, 100, 'png', '2025-01-01', '2025-01-01 00:00:00')",
                rusqlite::params![format!("img-{i}"), format!("/c{i}.png"), format!("h{i}")],
            )
            .unwrap();
        }

        let missing = list_missing_clip_db(&conn, 10).unwrap();
        assert_eq!(missing.len(), 2);

        upsert_clip_embedding(&conn, "img-0", &vec![0.0; 512]).unwrap();
        mark_clip_error(&conn, "img-1").unwrap();

        let stats = get_clip_stats_db(&conn).unwrap();
        assert_eq!(stats.embedded, 1);
        assert_eq!(stats.error, 1);
        assert_eq!(stats.missing, 0);
    }

    #[test]
    fn clip_upsert_stores_normalized_embedding() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('img-c', '/c.png', 'hc', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        let mut embedding = vec![0.0; 512];
        embedding[0] = 3.0;
        embedding[1] = 4.0;
        upsert_clip_embedding(&conn, "img-c", &embedding).unwrap();

        let bytes: Vec<u8> = conn
            .query_row(
                "SELECT embedding FROM clip_embeddings WHERE image_id = 'img-c'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let stored: Vec<f64> = bytes
            .chunks_exact(8)
            .map(|c| f64::from_le_bytes(c.try_into().unwrap()))
            .collect();
        let norm: f64 = stored.iter().map(|x| x * x).sum::<f64>().sqrt();
        assert!((norm - 1.0).abs() < 1e-9);
    }

    // -----------------------------------------------------------------------
    // Real-environment E2E + performance budget. Ignored by default (CI has
    // no Ollama/CLIP); run locally with:
    //   cargo test --lib real_ -- --ignored --nocapture
    // -----------------------------------------------------------------------

    #[test]
    #[ignore = "requires Ollama with nomic-embed-text running locally"]
    fn real_semantic_search_ollama_e2e() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let cfg = crate::ollama::OllamaConfig::from_env();
        let db = DbHandle::open_memory().unwrap();

        let prompts = [
            ("car", "a red sports car on an empty road"),
            ("lake", "a calm mountain lake at sunset"),
        ];
        {
            let conn = db.conn().lock().unwrap();
            for (id, prompt) in prompts {
                conn.execute(
                    "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at, metadata_json)
                     VALUES (?1, ?2, 'h', 100, 'png', '2025-01-01', ?3)",
                    rusqlite::params![
                        id,
                        format!("/{id}.png"),
                        serde_json::json!({ "prompt": prompt }).to_string()
                    ],
                )
                .unwrap();
            }
        }

        for (id, prompt) in prompts {
            let embedding = rt
                .block_on(embed_text_ollama(&cfg, prompt, "nomic-embed-text"))
                .unwrap();
            let conn = db.conn().lock().unwrap();
            upsert_embedding(&conn, id, &embedding).unwrap();
        }

        let query = rt
            .block_on(embed_text_ollama(&cfg, "automobile", "nomic-embed-text"))
            .unwrap();
        let conn = db.conn().lock().unwrap();
        let results = search_semantic_db(&conn, &query, 5, None).unwrap();

        assert!(!results.is_empty(), "semantic search returned nothing");
        assert_eq!(
            results[0].id, "car",
            "expected the car image to rank first, got {:?}",
            results
        );
    }

    #[test]
    #[ignore = "requires CLIP weights cached and torch installed"]
    fn real_image_search_clip_e2e() {
        let db = DbHandle::open_memory().unwrap();
        let assets = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../assets");
        let files = [
            "photo-cat-01.jpg",
            "photo-sunset-01.jpg",
            "photo-cafe-01.jpg",
            "ai-landscape-01.jpg",
            "ai-architecture-01.jpg",
        ];
        let ids = ["cat", "sunset", "cafe", "landscape", "architecture"];

        {
            let conn = db.conn().lock().unwrap();
            for (id, f) in ids.iter().zip(files) {
                let path = assets.join(f).to_string_lossy().to_string();
                conn.execute(
                    "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
                     VALUES (?1, ?2, 'h', 100, 'jpg', '2025-01-01')",
                    rusqlite::params![id, path],
                )
                .unwrap();
            }
        }

        let paths: Vec<String> = files
            .iter()
            .map(|f| assets.join(f).to_string_lossy().to_string())
            .collect();
        let embeddings = crate::commands::clip::clip_embed_images(&paths).unwrap();
        let mut cat_embedding = None;
        {
            let conn = db.conn().lock().unwrap();
            for ((id, _), embedding) in ids.iter().zip(files).zip(embeddings) {
                let embedding = embedding.expect("asset should embed");
                if *id == "cat" {
                    cat_embedding = Some(embedding.clone());
                }
                upsert_clip_embedding(&conn, id, &embedding).unwrap();
            }
            let stats = get_clip_stats_db(&conn).unwrap();
            assert_eq!(stats.embedded, 5);
            assert_eq!(stats.missing, 0);
        }

        let conn = db.conn().lock().unwrap();
        let results = search_clip_db(&conn, cat_embedding.as_ref().unwrap(), 5, None).unwrap();
        assert!(!results.is_empty(), "image search returned nothing");
        assert_eq!(results[0].id, "cat");
        assert!(
            results[0].similarity > 0.9,
            "self-similarity too low: {}",
            results[0].similarity
        );
    }

    #[test]
    #[ignore = "requires Ollama with nomic-embed-text running locally"]
    fn ten_k_semantic_search_latency_budget() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let db = DbHandle::open_memory().unwrap();

        // Deterministic pseudo-random unit-ish vectors (LCG, no rand dep).
        let mut seed: u64 = 0x9E37_79B9_7F4A_7C15;
        let mut rand = move || {
            seed = seed
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            ((seed >> 11) as f64) / ((1u64 << 53) as f64)
        };

        {
            let conn = db.conn().lock().unwrap();
            for i in 0..10_000 {
                conn.execute(
                    "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
                     VALUES (?1, ?2, ?3, 100, 'png', '2025-01-01')",
                    rusqlite::params![format!("img-{i}"), format!("/img{i}.png"), format!("h{i}")],
                )
                .unwrap();
                let mut vector = Vec::with_capacity(768);
                for _ in 0..768 {
                    vector.push(rand() - 0.5);
                }
                upsert_embedding(&conn, &format!("img-{i}"), &vector).unwrap();
            }
        }

        let cfg = crate::ollama::OllamaConfig::from_env();
        // Warm-up call excluded from the budget (model load is a cold-start).
        rt.block_on(embed_text_ollama(&cfg, "warmup", "nomic-embed-text"))
            .unwrap();

        let mut embed_ms = u128::MAX;
        for _ in 0..3 {
            let started = std::time::Instant::now();
            rt.block_on(embed_text_ollama(
                &cfg,
                "a red sports car",
                "nomic-embed-text",
            ))
            .unwrap();
            embed_ms = embed_ms.min(started.elapsed().as_millis());
        }

        let query = rt
            .block_on(embed_text_ollama(
                &cfg,
                "a red sports car",
                "nomic-embed-text",
            ))
            .unwrap();
        let conn = db.conn().lock().unwrap();
        let started = std::time::Instant::now();
        let results = search_semantic_db(&conn, &query, 20, None).unwrap();
        let knn_ms = started.elapsed().as_millis();
        assert_eq!(results.len(), 20);

        let total_ms = embed_ms + knn_ms;
        eprintln!(
            "semantic 10K: embed {embed_ms}ms + KNN {knn_ms}ms = {total_ms}ms (budget 1500ms)"
        );
        assert!(
            total_ms < 1500,
            "10K semantic search budget exceeded: {total_ms}ms"
        );
    }
}
