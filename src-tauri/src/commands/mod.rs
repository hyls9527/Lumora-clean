pub mod aesthetic;
pub mod ai;
pub mod backup;
pub mod clip;
pub mod comfyui;
pub mod dashboard;
pub mod embeddings;
pub mod export;
pub mod fs;
pub mod images;
pub mod rename;
pub mod settings;
pub mod smart_collections;
pub mod tags;
pub mod trash;

use crate::error::{AppError, AppResult};

/// Resolve a Python sidecar script path (shared by CLIP and aesthetic
/// sidecars; dev mode uses the Python script directly).
pub(crate) fn sidecar_path_for(name: &str) -> AppResult<String> {
    let sidecar_py = std::env::current_dir()
        .map_err(|e| AppError::External(format!("Failed to get current dir: {}", e)))?
        .join("src-tauri")
        .join("sidecar")
        .join(name);
    if sidecar_py.exists() {
        return Ok(sidecar_py.to_string_lossy().to_string());
    }
    Err(AppError::External(format!("Sidecar not found: {name}")))
}
