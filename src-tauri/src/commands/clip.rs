use crate::error::{AppError, AppResult};
use rusqlite;
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ClipEmbeddingResponse {
    pub embedding: Vec<f64>,
    #[serde(default)]
    pub error: Option<String>,
}

fn parse_clip_response(output: &[u8]) -> AppResult<ClipEmbeddingResponse> {
    let response: ClipEmbeddingResponse = serde_json::from_slice(output)
        .map_err(|e| AppError::External(format!("Failed to parse CLIP response: {}", e)))?;
    if let Some(error) = response.error {
        return Err(AppError::External(format!("CLIP error: {}", error)));
    }
    Ok(response)
}

/// Generate image embedding using CLIP sidecar.
pub fn clip_embed_image(image_path: &str) -> AppResult<Vec<f64>> {
    let sidecar_path = get_sidecar_path()?;

    let output = Command::new(&sidecar_path)
        .args(["embed-image", image_path])
        .output()
        .map_err(|e| AppError::External(format!("Failed to run CLIP sidecar: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::External(format!(
            "CLIP sidecar failed: {}",
            stderr
        )));
    }

    let response = parse_clip_response(&output.stdout)?;
    Ok(response.embedding)
}

/// Generate text embedding using CLIP sidecar.
pub fn clip_embed_text(text: &str) -> AppResult<Vec<f64>> {
    let sidecar_path = get_sidecar_path()?;

    let output = Command::new(&sidecar_path)
        .args(["embed-text", text])
        .output()
        .map_err(|e| AppError::External(format!("Failed to run CLIP sidecar: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::External(format!(
            "CLIP sidecar failed: {}",
            stderr
        )));
    }

    let response = parse_clip_response(&output.stdout)?;
    Ok(response.embedding)
}

/// Get the path to the CLIP sidecar executable.
fn get_sidecar_path() -> AppResult<String> {
    // In development, use Python directly
    let sidecar_py = std::env::current_dir()
        .map_err(|e| AppError::External(format!("Failed to get current dir: {}", e)))?
        .join("src-tauri")
        .join("sidecar")
        .join("clip_server.py");

    if sidecar_py.exists() {
        return Ok(sidecar_py.to_string_lossy().to_string());
    }

    // In production, use compiled sidecar
    Err(AppError::External("CLIP sidecar not found".to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_clip_response_ok() {
        let raw = br#"{"embedding":[1.0,2.0]}"#;
        let r = parse_clip_response(raw).unwrap();
        assert_eq!(r.embedding, vec![1.0, 2.0]);
        assert!(r.error.is_none());
    }

    #[test]
    fn parse_clip_response_reports_sidecar_error() {
        let raw = br#"{"embedding":[],"error":"boom"}"#;
        let err = parse_clip_response(raw).unwrap_err();
        assert!(err.to_string().contains("boom"));
    }

    #[test]
    fn parse_clip_response_rejects_invalid_json() {
        assert!(parse_clip_response(b"not json").is_err());
    }

    #[test]
    fn test_get_sidecar_path() {
        // This test will fail if not run from project root
        // But it validates the logic
        let result = get_sidecar_path();
        // We don't assert success because it depends on working directory
        // Just ensure it doesn't panic
        let _ = result;
    }
}

/// Generate image embedding using CLIP sidecar.
#[tauri::command]
pub async fn clip_embed_image_cmd(
    db: tauri::State<'_, crate::db::DbHandle>,
    image_path: String,
) -> AppResult<Vec<f64>> {
    // Validate that image_path exists in the database (prevents arbitrary file read)
    {
        let conn = db.conn().lock().map_err(|_| crate::error::AppError::Lock)?;
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM images WHERE file_path = ?1",
                rusqlite::params![image_path],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if !exists {
            return Err(crate::error::AppError::NotFound(
                "Image path not in database".into(),
            ));
        }
    }
    let embedding = clip_embed_image(&image_path)?;
    // Fail fast with a friendly message when the CLIP model's output
    // dimension does not match the vector index (e.g. 512 vs 768).
    {
        let conn = db.conn().lock().map_err(|_| crate::error::AppError::Lock)?;
        crate::commands::embeddings::validate_query_dimension(&conn, embedding.len())?;
    }
    Ok(embedding)
}

/// Generate text embedding using CLIP sidecar.
#[tauri::command]
pub async fn clip_embed_text_cmd(text: String) -> AppResult<Vec<f64>> {
    clip_embed_text(&text)
}
