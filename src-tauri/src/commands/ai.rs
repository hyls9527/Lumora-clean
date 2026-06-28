use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::command;

use crate::db::DbHandle;

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
async fn check_ollama_available() -> Result<(), String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|_| "Ollama is not running. Please start Ollama to use AI features.".to_string())?;

    if !response.status().is_success() {
        return Err("Ollama is not responding correctly.".to_string());
    }

    Ok(())
}

/// Call Ollama API to analyze an image.
/// Expects Ollama to be running locally with a vision model (e.g., llava).
async fn call_ollama_analyze(
    image_path: &str,
    model: &str,
) -> Result<AnalysisResult, String> {
    // Check Ollama availability first
    check_ollama_available().await?;

    // Read image and encode as base64
    let image_bytes = std::fs::read(image_path)
        .map_err(|e| format!("Failed to read image: {}", e))?;
    let image_base64 = base64_encode(&image_bytes);

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

    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:11434/api/chat")
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned status: {}", response.status()));
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

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };

        result.push(CHARS[(b0 >> 2) & 0x3F] as char);
        result.push(CHARS[((b0 << 4) | (b1 >> 4)) & 0x3F] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((b1 << 2) | (b2 >> 6)) & 0x3F] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[b2 & 0x3F] as char);
        } else {
            result.push('=');
        }
    }
    result
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
    image_id: String,
    image_path: String,
    model: Option<String>,
) -> Result<AnalysisResult, String> {
    let model_name = model.unwrap_or_else(|| "llava:latest".to_string());

    // Call Ollama to analyze the image
    let result = call_ollama_analyze(&image_path, &model_name).await?;

    // Store the result in the database
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    store_analysis(&conn, &image_id, &result).map_err(|e| e.to_string())?;

    Ok(result)
}

#[command]
pub async fn get_analysis_result_cmd(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
) -> Result<Option<AnalysisResult>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    get_latest_analysis(&conn, &image_id).map_err(|e| e.to_string())
}

#[command]
pub async fn get_analysis_history_cmd(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
) -> Result<Vec<AnalysisHistoryItem>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    get_analysis_history_db(&conn, &image_id).map_err(|e| e.to_string())
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
        assert_eq!(base64_encode(b"hello"), "aGVsbG8=");
        assert_eq!(base64_encode(b"world"), "d29ybGQ=");
        assert_eq!(base64_encode(b""), "");
    }
}
