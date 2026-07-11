use rusqlite::params;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::command;
use uuid::Uuid;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisTag {
    pub name: String,
    pub confidence: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisResult {
    pub description: String,
    pub tags: Vec<AnalysisTag>,
    pub objects: Vec<String>,
    pub color_palette: Vec<String>,
    pub composition: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisHistoryItem {
    pub id: String,
    pub image_id: String,
    pub result: AnalysisResult,
    pub analyzed_at: String,
}

// ---------------------------------------------------------------------------
// Ollama API integration
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
struct OllamaMessage {
    role: String,
    content: String,
    images: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    message: OllamaMessage,
}

/// Check if Ollama is running and available.
async fn check_ollama_available(cfg: &crate::ollama::OllamaConfig) -> AppResult<()> {
    let client = reqwest::Client::new();
    let response = client
        .get(cfg.url("/api/tags"))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|_| {
            "Ollama is not running. Please start Ollama to use AI features.".to_string()
        })?;

    if !response.status().is_success() {
        return Err(AppError::External(
            "Ollama is not responding correctly.".to_string(),
        ));
    }

    Ok(())
}

/// Call Ollama API to analyze an image.
/// Expects Ollama to be running locally with a vision model (e.g., llava).
async fn call_ollama_analyze(
    cfg: &crate::ollama::OllamaConfig,
    image_path: &str,
    model: &str,
) -> AppResult<AnalysisResult> {
    // Check Ollama availability first
    check_ollama_available(cfg).await?;

    // Read image and encode as base64
    let image_bytes =
        std::fs::read(image_path).map_err(|e| format!("Failed to read image: {}", e))?;
    use base64::Engine;
    let image_base64 = base64::engine::general_purpose::STANDARD.encode(&image_bytes);

    let prompt = r#"Analyze this image and return a JSON object with these fields:
- description: A detailed description of the image (2-3 sentences)
- tags: An array of objects with "name" and "confidence" (0-1) for relevant tags
- objects: An array of main objects/subjects in the image
- color_palette: An array of 5 dominant hex colors
- composition: Description of the composition technique used

Return ONLY valid JSON, no other text."#;

    let request = OllamaRequest {
        model: model.to_string(),
        messages: vec![OllamaMessage {
            role: "user".to_string(),
            content: prompt.to_string(),
            images: Some(vec![image_base64]),
        }],
        stream: false,
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("failed to create HTTP client: {}", e))?;
    let response = client
        .post(cfg.url("/api/chat"))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(AppError::External(format!(
            "Ollama returned status: {}",
            response.status()
        )));
    }

    let ollama_resp: OllamaResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    // Parse the JSON content from the model's response
    let content = ollama_resp.message.content;
    let result: AnalysisResult = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse analysis result: {}", e))?;

    Ok(result)
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

/// Store an analysis result in the database.
pub fn store_analysis(
    conn: &Connection,
    image_id: &str,
    result: &AnalysisResult,
) -> Result<String, rusqlite::Error> {
    let id = format!("analysis-{}", chrono::Utc::now().timestamp_millis());
    let result_json = serde_json::to_string(result).unwrap_or_default();
    let analyzed_at = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO analysis_history (id, image_id, result_json, analyzed_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, image_id, result_json, analyzed_at],
    )?;

    Ok(id)
}

/// Auto-create tags from AI analysis and associate them with the image.
fn auto_tag_from_analysis(
    conn: &Connection,
    image_id: &str,
    tags: &[AnalysisTag],
) -> Result<(), rusqlite::Error> {
    for tag in tags {
        let tag_id = Uuid::new_v4().to_string();
        // Ensure tag exists (INSERT OR IGNORE for name uniqueness)
        conn.execute(
            "INSERT OR IGNORE INTO tags (id, name) VALUES (?1, ?2)",
            params![tag_id, tag.name.to_lowercase().trim()],
        )?;
        // Get the tag id (either newly created or existing)
        let existing_id: String = conn.query_row(
            "SELECT id FROM tags WHERE name = ?1",
            params![tag.name.to_lowercase().trim()],
            |r| r.get(0),
        )?;
        // Associate tag with image (INSERT OR IGNORE for idempotency)
        conn.execute(
            "INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?1, ?2)",
            params![image_id, existing_id],
        )?;
    }
    Ok(())
}

/// Get the most recent analysis result for an image.
pub fn get_latest_analysis(
    conn: &Connection,
    image_id: &str,
) -> Result<Option<AnalysisResult>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT result_json FROM analysis_history
         WHERE image_id = ?1
         ORDER BY analyzed_at DESC
         LIMIT 1",
    )?;
    let mut rows = stmt.query_map(rusqlite::params![image_id], |row| {
        let json: String = row.get(0)?;
        Ok(json)
    })?;

    match rows.next() {
        Some(row) => {
            let json = row?;
            let result: AnalysisResult =
                serde_json::from_str(&json).map_err(|_| rusqlite::Error::InvalidQuery)?;
            Ok(Some(result))
        }
        None => Ok(None),
    }
}

/// Get analysis history for an image.
pub fn get_analysis_history_db(
    conn: &Connection,
    image_id: &str,
) -> Result<Vec<AnalysisHistoryItem>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, image_id, result_json, analyzed_at FROM analysis_history
         WHERE image_id = ?1
         ORDER BY analyzed_at DESC",
    )?;
    let rows = stmt.query_map(rusqlite::params![image_id], |row| {
        let id: String = row.get(0)?;
        let image_id: String = row.get(1)?;
        let json: String = row.get(2)?;
        let analyzed_at: String = row.get(3)?;
        Ok((id, image_id, json, analyzed_at))
    })?;

    let mut items = Vec::new();
    for row in rows {
        let (id, image_id, json, analyzed_at) = row?;
        let result: AnalysisResult =
            serde_json::from_str(&json).map_err(|_| rusqlite::Error::InvalidQuery)?;
        items.push(AnalysisHistoryItem {
            id,
            image_id,
            result,
            analyzed_at,
        });
    }
    Ok(items)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[command]
pub async fn analyze_image_cmd(
    db: tauri::State<'_, DbHandle>,
    cfg: tauri::State<'_, crate::ollama::OllamaConfig>,
    image_id: String,
    image_path: String,
    model: Option<String>,
) -> AppResult<AnalysisResult> {
    let model_name = model.unwrap_or_else(|| "llava:latest".to_string());

    // Validate that image_path belongs to image_id (prevents arbitrary file read)
    // NOTE: Lock scope is minimal — released before any network I/O (Ollama API call).
    // This prevents blocking other DB operations during the potentially slow AI analysis.
    {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        let stored_path: String = conn
            .query_row(
                "SELECT file_path FROM images WHERE id = ?1",
                rusqlite::params![image_id],
                |row| row.get(0),
            )
            .map_err(|_| AppError::NotFound("Image not found".into()))?;
        if stored_path != image_path {
            return Err(AppError::InvalidInput(
                "Path does not match image ID".into(),
            ));
        }
    }

    // Call Ollama to analyze the image
    let result = call_ollama_analyze(&cfg, &image_path, &model_name).await?;

    // Store the result in the database
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    store_analysis(&conn, &image_id, &result).map_err(|e| e.to_string())?;

    // Auto-create tags from AI analysis
    auto_tag_from_analysis(&conn, &image_id, &result.tags)
        .map_err(|e| format!("Failed to auto-tag: {}", e))?;

    Ok(result)
}

#[command]
pub async fn get_analysis_result_cmd(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
) -> AppResult<Option<AnalysisResult>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(get_latest_analysis(&conn, &image_id)?)
}

#[command]
pub async fn get_analysis_history_cmd(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
) -> AppResult<Vec<AnalysisHistoryItem>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    Ok(get_analysis_history_db(&conn, &image_id)?)
}

/// Apply AI tags from the latest analysis to an image.
/// Re-reads the latest analysis and creates/associates tags.
#[command]
pub async fn apply_ai_tags_cmd(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
) -> AppResult<Vec<String>> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let analysis = get_latest_analysis(&conn, &image_id)?;
    match analysis {
        Some(result) => {
            let tag_names: Vec<String> = result.tags.iter().map(|t| t.name.clone()).collect();
            auto_tag_from_analysis(&conn, &image_id, &result.tags)?;
            Ok(tag_names)
        }
        None => Err(AppError::NotFound(
            "No analysis found for this image".into(),
        )),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_and_get_analysis() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        // Insert an image first (FK constraint)
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('img-1', '/test.png', 'hash1', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        let result = AnalysisResult {
            description: "A beautiful landscape".to_string(),
            tags: vec![
                AnalysisTag {
                    name: "nature".to_string(),
                    confidence: 0.95,
                },
                AnalysisTag {
                    name: "landscape".to_string(),
                    confidence: 0.90,
                },
            ],
            objects: vec!["mountain".to_string(), "river".to_string()],
            color_palette: vec!["#2d4a3e".to_string(), "#5c7a5e".to_string()],
            composition: "Rule of thirds".to_string(),
        };

        // Store
        let id = store_analysis(&conn, "img-1", &result).unwrap();
        assert!(!id.is_empty());

        // Get latest
        let loaded = get_latest_analysis(&conn, "img-1").unwrap();
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.description, "A beautiful landscape");
        assert_eq!(loaded.tags.len(), 2);
        assert_eq!(loaded.tags[0].name, "nature");
    }

    #[test]
    fn get_history_returns_all_items() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        // Insert an image first (FK constraint)
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('img-1', '/test.png', 'hash1', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        let result1 = AnalysisResult {
            description: "First analysis".to_string(),
            tags: vec![],
            objects: vec![],
            color_palette: vec![],
            composition: String::new(),
        };
        let result2 = AnalysisResult {
            description: "Second analysis".to_string(),
            tags: vec![],
            objects: vec![],
            color_palette: vec![],
            composition: String::new(),
        };

        store_analysis(&conn, "img-1", &result1).unwrap();
        // Small delay to ensure different timestamp
        std::thread::sleep(std::time::Duration::from_millis(10));
        store_analysis(&conn, "img-1", &result2).unwrap();

        let history = get_analysis_history_db(&conn, "img-1").unwrap();
        assert_eq!(history.len(), 2);
        // Most recent first
        assert_eq!(history[0].result.description, "Second analysis");
        assert_eq!(history[1].result.description, "First analysis");
    }

    #[test]
    fn get_analysis_returns_none_for_missing() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        let result = get_latest_analysis(&conn, "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn base64_encode_works() {
        use base64::Engine;
        let encode = |data: &[u8]| base64::engine::general_purpose::STANDARD.encode(data);
        assert_eq!(encode(b"hello"), "aGVsbG8=");
        assert_eq!(encode(b"world"), "d29ybGQ=");
        assert_eq!(encode(b""), "");
    }

    #[test]
    fn auto_tag_creates_and_associates_tags() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        // Insert an image
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('tag-img', '/test.png', 'hash1', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        let tags = vec![
            AnalysisTag {
                name: "Nature".to_string(),
                confidence: 0.9,
            },
            AnalysisTag {
                name: "Landscape".to_string(),
                confidence: 0.8,
            },
        ];

        auto_tag_from_analysis(&conn, "tag-img", &tags).unwrap();

        // Verify tags were created (lowercased)
        let tag_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tags WHERE name IN ('nature', 'landscape')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(tag_count, 2);

        // Verify associations
        let assoc_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM image_tags WHERE image_id = 'tag-img'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(assoc_count, 2);
    }

    #[test]
    fn auto_tag_idempotent_on_duplicate_call() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('tag-img2', '/test2.png', 'hash2', 100, 'png', '2025-01-01')",
            [],
        )
        .unwrap();

        let tags = vec![AnalysisTag {
            name: "cat".to_string(),
            confidence: 0.95,
        }];

        // Call twice
        auto_tag_from_analysis(&conn, "tag-img2", &tags).unwrap();
        auto_tag_from_analysis(&conn, "tag-img2", &tags).unwrap();

        // Should still be 1 tag and 1 association (idempotent)
        let tag_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM tags WHERE name = 'cat'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(tag_count, 1);

        let assoc_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM image_tags WHERE image_id = 'tag-img2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(assoc_count, 1);
    }
}
