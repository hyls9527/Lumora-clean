use crate::error::AppResult;

/// True when the path exists and is a directory; false for files and missing paths.
#[tauri::command]
pub fn is_directory(path: String) -> AppResult<bool> {
    Ok(std::fs::metadata(&path)
        .map(|m| m.is_dir())
        .unwrap_or(false))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn existing_directory_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        let result = is_directory(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(result);
    }

    #[test]
    fn existing_file_returns_false() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.png");
        std::fs::write(&file, b"x").unwrap();
        let result = is_directory(file.to_string_lossy().to_string()).unwrap();
        assert!(!result);
    }

    #[test]
    fn missing_path_returns_false() {
        let result = is_directory("C:/definitely/not/a/real/path".into()).unwrap();
        assert!(!result);
    }
}
