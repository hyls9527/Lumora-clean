use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// Shared database connection for the LAN server.
pub type SharedConn = Arc<Mutex<Connection>>;

/// Managed state holding the LAN server port.
pub struct LanPort(pub u16);

#[tauri::command]
pub fn get_lan_info(port: tauri::State<'_, LanPort>) -> (String, u16) {
    (local_ip(), port.0)
}

/// Server state including DB connection and app data dir.
#[derive(Clone)]
pub struct ServerState {
    pub conn: SharedConn,
    pub app_dir: PathBuf,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
    pub local_ip: String,
    pub port: u16,
}

#[derive(Serialize)]
pub struct ImageItem {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub format: String,
    pub rating: i32,
    pub favorite: bool,
}

#[derive(Serialize)]
pub struct ImageListResponse {
    pub items: Vec<ImageItem>,
    pub total: i64,
    pub page: u32,
    pub per_page: u32,
}

#[derive(Serialize)]
pub struct TagItem {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Deserialize)]
pub struct PaginationParams {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

/// Start the LAN web server on an available port.
/// Returns the bound port on success.
pub fn start_server(conn: SharedConn, app_dir: PathBuf) -> u16 {
    let port = find_available_port();
    let state = ServerState { conn, app_dir };
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/", get(mobile_ui_handler))
        .route("/api/images", get(images_handler))
        .route("/api/images/{id}/file", get(image_file_handler))
        .route("/api/tags", get(tags_handler))
        .with_state(state);

    tokio::spawn(async move {
        let addr = format!("0.0.0.0:{}", port);
        let listener = tokio::net::TcpListener::bind(&addr)
            .await
            .expect("Failed to bind LAN server");
        log::info!("LAN server listening on {}:{}", local_ip(), port);
        axum::serve(listener, app)
            .await
            .expect("LAN server error");
    });

    port
}

/// Find an available port starting from 8079.
pub fn find_available_port() -> u16 {
    for port in 8079..8090 {
        if TcpListener::bind(("0.0.0.0", port)).is_ok() {
            return port;
        }
    }
    panic!("No available port found in 8079-8089");
}

/// Get the local IP address for LAN access.
pub fn local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "localhost".to_string())
}

// ── Handlers ──────────────────────────────────────────

async fn health_handler(State(_state): State<ServerState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
        local_ip: local_ip(),
        port: 0,
    })
}

async fn mobile_ui_handler() -> axum::response::Html<&'static str> {
    axum::response::Html(include_str!("mobile.html"))
}

async fn images_handler(
    State(state): State<ServerState>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<ImageListResponse>, StatusCode> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(40).min(200);
    let offset = (page - 1) * per_page;

    let conn = state.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| r.get(0))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, file_path, width, height, format, rating, favorite
             FROM images WHERE deleted = 0
             ORDER BY imported_at DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let items: Vec<ImageItem> = stmt
        .query_map(rusqlite::params![per_page, offset], |row| {
            let file_path: String = row.get(1)?;
            let file_name = std::path::Path::new(&file_path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            Ok(ImageItem {
                id: row.get(0)?,
                file_path,
                file_name,
                width: row.get(2)?,
                height: row.get(3)?,
                format: row.get(4)?,
                rating: row.get(5)?,
                favorite: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(Json(ImageListResponse {
        items,
        total,
        page,
        per_page,
    }))
}

async fn image_file_handler(
    State(state): State<ServerState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let conn = state.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let file_path: String = conn
        .query_row(
            "SELECT file_path FROM images WHERE id = ?1 AND deleted = 0",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .map_err(|_| StatusCode::NOT_FOUND)?;

    drop(conn);

    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(StatusCode::NOT_FOUND);
    }

    let data = std::fs::read(path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
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

    Ok(([(axum::http::header::CONTENT_TYPE, mime)], data))
}

async fn tags_handler(
    State(state): State<ServerState>,
) -> Result<Json<Vec<TagItem>>, StatusCode> {
    let conn = state.conn.lock().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut stmt = conn
        .prepare("SELECT id, name, color FROM tags ORDER BY name")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let tags: Vec<TagItem> = stmt
        .query_map([], |row| {
            Ok(TagItem {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(Json(tags))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_available_port_returns_valid_port() {
        let port = find_available_port();
        assert!(port >= 8079 && port < 8090);
    }

    #[test]
    fn local_ip_returns_non_empty() {
        let ip = local_ip();
        assert!(!ip.is_empty());
    }
}
