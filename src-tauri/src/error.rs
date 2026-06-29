use std::fmt;

/// Structured error type for all Tauri commands.
/// Replaces scattered `.map_err(|e| e.to_string())` with typed errors.
#[derive(Debug, serde::Serialize)]
pub enum AppError {
    /// Database errors (rusqlite)
    Db(String),
    /// File I/O errors
    Io(String),
    /// Record not found
    NotFound(String),
    /// Input validation failure
    InvalidInput(String),
    /// External service errors (Ollama, etc.)
    External(String),
    /// Lock poisoned
    Lock,
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Db(msg) => write!(f, "数据库错误: {}", msg),
            AppError::Io(msg) => write!(f, "文件操作失败: {}", msg),
            AppError::NotFound(msg) => write!(f, "{}", msg),
            AppError::InvalidInput(msg) => write!(f, "{}", msg),
            AppError::External(msg) => write!(f, "{}", msg),
            AppError::Lock => write!(f, "数据库锁定失败"),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Db(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::External(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::External(e.to_string())
    }
}

/// Allow String to be used as AppError (for legacy .map_err(|e| format!(...)) patterns).
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::External(s)
    }
}

/// Allow AppError to be used with `?` in functions returning `Result<T, String>`.
impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        e.to_string()
    }
}

/// Convenience alias for command return types.
pub type AppResult<T> = Result<T, AppError>;
