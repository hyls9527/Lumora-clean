use std::net::TcpListener;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::db::DbHandle;

/// Managed state holding the LAN server port + auth token.
pub struct LanPort(pub u16);

/// Auth token generated at startup, shown in app UI for mobile access.
pub struct LanToken(pub String);

#[tauri::command]
pub fn get_lan_info(
    port: tauri::State<'_, LanPort>,
    token: tauri::State<'_, LanToken>,
) -> (String, u16, String) {
    (local_ip(), port.0, token.0.clone())
}

/// Server state including DB handle and auth token.
#[derive(Clone)]
pub struct ServerState {
    pub db: DbHandle,
    pub token: String,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
    pub local_ip: String,
    pub port: u16,
    pub requires_auth: bool,
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
    pub token: Option<String>,
}

/// Generate a random 8-character alphanumeric token.
pub fn generate_token() -> String {
    (0..8)
        .map(|_| {
            let idx = rand::random_range(0..62);
            if idx < 10 {
                (b'0' + idx) as char
            } else if idx < 36 {
                (b'A' + idx - 10) as char
            } else {
                (b'a' + idx - 36) as char
            }
        })
        .collect()
}

/// Start the LAN web server on an available port.
/// Returns the bound port on success.
pub fn start_server(db: DbHandle, token: String) -> u16 {
    let listener = match find_available_listener() {
        Ok(l) => l,
        Err(e) => {
            log::error!("LAN server failed to bind: {e}");
            return 0;
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(8079);
    let state = ServerState { db, token };
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/", get(mobile_ui_handler))
        .route("/api/images", get(images_handler))
        .route("/api/images/{id}/file", get(image_file_handler))
        .route("/api/tags", get(tags_handler))
        .with_state(state);

    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
        rt.block_on(async move {
            let listener = match tokio::net::TcpListener::from_std(listener) {
                Ok(l) => l,
                Err(e) => {
                    log::error!("LAN server failed to prepare listener: {e}");
                    return;
                }
            };
            log::info!("LAN server listening on {}:{}", local_ip(), port);
            if let Err(e) = axum::serve(listener, app).await {
                log::error!("LAN server error: {e}");
            }
        });
    });

    port
}

/// Bind a listener on the first available port starting from 8079.
/// The listener is returned bound, avoiding the bind-check-then-rebind race.
pub fn find_available_listener() -> std::io::Result<std::net::TcpListener> {
    for port in 8079..8090 {
        if let Ok(listener) = TcpListener::bind(("0.0.0.0", port)) {
            return Ok(listener);
        }
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::AddrInUse,
        "No available port found in 8079-8089",
    ))
}

/// Get the local IP address for LAN access.
pub fn local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "localhost".to_string())
}

// ── Auth helper ──────────────────────────────────────

/// Extract token from query params or Authorization header.
fn extract_token(headers: &HeaderMap, query_token: Option<&String>) -> Option<String> {
    // 1. Query param: ?token=xxx
    if let Some(t) = query_token {
        return Some(t.clone());
    }
    // 2. Authorization: Bearer xxx
    if let Some(auth) = headers.get("Authorization") {
        if let Ok(val) = auth.to_str() {
            if let Some(t) = val.strip_prefix("Bearer ") {
                return Some(t.to_string());
            }
        }
    }
    None
}

fn verify_auth(
    state: &ServerState,
    headers: &HeaderMap,
    query_token: Option<&String>,
) -> Result<(), StatusCode> {
    let provided = extract_token(headers, query_token);
    match provided {
        Some(t) if tokens_match(&t, &state.token) => Ok(()),
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

/// Constant-time string comparison (avoids timing side channels on the LAN).
fn tokens_match(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        diff |= x ^ y;
    }
    diff == 0
}

// ── Handlers ──────────────────────────────────────────

async fn health_handler(State(_state): State<ServerState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
        local_ip: local_ip(),
        port: 0, // will be filled by frontend from the URL used to reach it
        requires_auth: true,
    })
}

async fn mobile_ui_handler() -> axum::response::Html<&'static str> {
    axum::response::Html(include_str!("mobile.html"))
}

async fn images_handler(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Query(params): Query<PaginationParams>,
) -> Result<Json<ImageListResponse>, StatusCode> {
    verify_auth(&state, &headers, params.token.as_ref())?;

    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(40).min(200);
    let offset = (page - 1) * per_page;

    let conn = state
        .db
        .conn()
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
            r.get(0)
        })
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
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(params): Query<PaginationParams>,
) -> Result<impl IntoResponse, StatusCode> {
    verify_auth(&state, &headers, params.token.as_ref())?;

    let conn = state
        .db
        .conn()
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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
    headers: HeaderMap,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Vec<TagItem>>, StatusCode> {
    verify_auth(&state, &headers, params.token.as_ref())?;

    let conn = state
        .db
        .conn()
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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
    fn local_ip_returns_non_empty() {
        let ip = local_ip();
        assert!(!ip.is_empty());
    }

    #[test]
    fn generate_token_creates_8_char_string() {
        let token = generate_token();
        assert_eq!(token.len(), 8);
        assert!(token.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn tokens_match_compares_constant_time() {
        assert!(tokens_match("abc12345", "abc12345"));
        assert!(!tokens_match("abc12345", "abc12346"));
        assert!(!tokens_match("abc12345", "abc1234"));
        assert!(!tokens_match("", "x"));
    }

    #[test]
    fn verify_auth_accepts_query_token_and_bearer() {
        let state = ServerState {
            db: crate::db::DbHandle::open_memory().unwrap(),
            token: "token123".into(),
        };

        assert!(verify_auth(&state, &HeaderMap::new(), Some(&"token123".to_string())).is_ok());

        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::AUTHORIZATION,
            "Bearer token123".parse().unwrap(),
        );
        assert!(verify_auth(&state, &headers, None).is_ok());

        assert!(verify_auth(&state, &HeaderMap::new(), Some(&"wrongtok".to_string())).is_err());
        assert!(verify_auth(&state, &HeaderMap::new(), None).is_err());
    }

    #[test]
    fn find_available_listener_binds_a_port() {
        let listener = find_available_listener().unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!((8079..8090).contains(&port));
    }
}
