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
    let vec_json = serde_json::to_string(embedding).unwrap_or_default();
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
) -> Result<Vec<SemanticSearchResult>, rusqlite::Error> {
    let query_json = serde_json::to_string(query_embedding).unwrap_or_default();

    let mut stmt = conn.prepare(
        "SELECT image_id, distance FROM vec_embeddings
         WHERE embedding MATCH ?1
         ORDER BY distance ASC
         LIMIT ?2",
    )?;

    let rows = stmt.query_map(rusqlite::params![query_json, limit], |row| {
        Ok(SemanticSearchResult {
            id: row.get(0)?,
            similarity: 1.0 - row.get::<_, f64>(1)?, // Convert distance to similarity
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
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
) -> AppResult<Vec<SemanticSearchResult>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(search_semantic_db(
        &conn,
        &query_embedding,
        limit.unwrap_or(20),
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

#[command]
pub async fn get_embedding_stats_cmd(db: tauri::State<'_, DbHandle>) -> AppResult<EmbeddingStats> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(get_embedding_stats_db(&conn)?)
}

/// Generate text embedding using Ollama.
async fn embed_text_ollama(
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
        let results = search_semantic_db(&conn, &query, 10).unwrap();

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
        let results = search_semantic_db(&conn, &query, 2).unwrap();
        assert!(results.len() <= 2);
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
}
