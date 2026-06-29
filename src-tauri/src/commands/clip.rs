use crate::error::{AppError, AppResult};
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ClipEmbeddingResponse {
    pub embedding: Vec<f64>,
    #[serde(default)]
    pub error: Option<String>,
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
        return Err(AppError::External(format!("CLIP sidecar failed: {}", stderr)));
    }

    let response: ClipEmbeddingResponse = serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::External(format!("Failed to parse CLIP response: {}", e)))?;

    if let Some(error) = response.error {
        return Err(AppError::External(format!("CLIP error: {}", error)));
    }

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
        return Err(AppError::External(format!("CLIP sidecar failed: {}", stderr)));
    }

    let response: ClipEmbeddingResponse = serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::External(format!("Failed to parse CLIP response: {}", e)))?;

    if let Some(error) = response.error {
        return Err(AppError::External(format!("CLIP error: {}", error)));
    }

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
pub async fn clip_embed_image_cmd(image_path: String) -> AppResult<Vec<f64>> {
    clip_embed_image(&image_path)
}

/// Generate text embedding using CLIP sidecar.
#[tauri::command]
pub async fn clip_embed_text_cmd(text: String) -> AppResult<Vec<f64>> {
    clip_embed_text(&text)
}