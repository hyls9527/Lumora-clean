use crate::error::{AppError, AppResult};
use rusqlite;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ClipEmbeddingResponse {
    pub embedding: Vec<f64>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClipBatchResponse {
    /// One entry per requested path. A `null` entry means that image failed
    /// to embed (e.g. unreadable file) so the caller can mark it errored.
    pub embeddings: Vec<Option<Vec<f64>>>,
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
    let output = crate::commands::sidecar_command("clip_server.py")?
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
    let output = crate::commands::sidecar_command("clip_server.py")?
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

/// Generate embeddings for a batch of images in a single sidecar process so
/// the CLIP model is loaded only once (each one-shot invocation re-loads the
/// model, which costs tens of seconds on CPU). `None` marks unreadable files.
pub fn clip_embed_images(paths: &[String]) -> AppResult<Vec<Option<Vec<f64>>>> {
    let mut cmd = crate::commands::sidecar_command("clip_server.py")?;
    cmd.arg("embed-images");
    cmd.args(paths);

    let output = cmd
        .output()
        .map_err(|e| AppError::External(format!("Failed to run CLIP sidecar: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::External(format!(
            "CLIP sidecar failed: {}",
            stderr
        )));
    }

    let response: ClipBatchResponse = serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::External(format!("Failed to parse CLIP response: {}", e)))?;
    if response.embeddings.len() != paths.len() {
        return Err(AppError::External(
            "CLIP batch response length mismatch".to_string(),
        ));
    }
    Ok(response.embeddings)
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
    // Dimension validation happens in `search_semantic_image_cmd` against the
    // dedicated 512-dim CLIP index, not against the 768-dim text index.
    Ok(embedding)
}

/// Generate text embedding using CLIP sidecar.
#[tauri::command]
pub async fn clip_embed_text_cmd(text: String) -> AppResult<Vec<f64>> {
    clip_embed_text(&text)
}
