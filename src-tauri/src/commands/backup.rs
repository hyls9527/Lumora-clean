use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::State;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};

/// Export database to a user-selected location.
#[tauri::command]
pub async fn export_database(db: State<'_, DbHandle>, destination: String) -> AppResult<String> {
    // The DB runs in WAL mode: committed transactions may still live in
    // `<db>-wal` and a plain file copy of the main file would lose them.
    db.checkpoint_wal()?;
    export_database_inner(db.path(), Path::new(&destination))
}

fn export_database_inner(db_path: &Path, dest: &Path) -> AppResult<String> {
    // Ensure destination directory exists
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Io(format!("Failed to create directory: {e}")))?;
    }

    fs::copy(db_path, dest).map_err(|e| AppError::Io(format!("Failed to export database: {e}")))?;

    Ok(dest.to_string_lossy().to_string())
}

/// Import database from a file, replacing the current one.
/// Writes to a staging file first, then replaces on restart.
#[tauri::command]
pub async fn import_database(db: State<'_, DbHandle>, source: String) -> AppResult<String> {
    import_database_inner(db.path(), Path::new(&source))
}

fn import_database_inner(db_path: &Path, src: &Path) -> AppResult<String> {
    if !src.exists() {
        return Err(AppError::InvalidInput(
            "Source file does not exist".to_string(),
        ));
    }

    // Validate it's a SQLite file (magic bytes) — read the header only, the
    // database itself can be hundreds of MB.
    let mut header = Vec::new();
    fs::File::open(src)
        .and_then(|f| f.take(16).read_to_end(&mut header))
        .map_err(|e| AppError::Io(format!("Failed to read source file: {e}")))?;
    if header.len() < 16 || header[..16] != *b"SQLite format 3\0" {
        return Err(AppError::InvalidInput(
            "Source file is not a valid SQLite database".to_string(),
        ));
    }

    // Write to staging file first to avoid corrupting active DB
    let staging = db_path.with_extension("db.import");
    fs::copy(src, &staging).map_err(|e| AppError::Io(format!("Failed to stage import: {e}")))?;

    // Replace original — connection may hold WAL, but staging is safe
    fs::copy(&staging, db_path)
        .map_err(|e| AppError::Io(format!("Failed to import database: {e}")))?;
    let _ = fs::remove_file(&staging);

    // Drop the old WAL sidecars: after the replacement, replaying a stale
    // `<db>-wal` on top of the new main file would corrupt the imported data.
    for suffix in ["-wal", "-shm", "-journal"] {
        let mut sidecar = db_path.as_os_str().to_owned();
        sidecar.push(suffix);
        let sidecar = Path::new(&sidecar);
        if let Err(e) = fs::remove_file(sidecar) {
            if e.kind() != std::io::ErrorKind::NotFound {
                log::warn!(
                    "failed to remove stale sidecar {}: {}",
                    sidecar.display(),
                    e
                );
            }
        }
    }

    Ok("Database imported successfully. Please restart the application.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_copies_db_file() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("lumora.db");
        std::fs::write(&db_path, b"SQLite format 3\0test-data").unwrap();
        let dest = dir.path().join("backup").join("lumora.db");

        let result = export_database_inner(&db_path, &dest).unwrap();

        assert!(dest.exists());
        assert_eq!(std::fs::read(&dest).unwrap(), b"SQLite format 3\0test-data");
        assert!(result.ends_with("lumora.db"));
    }

    #[test]
    fn import_rejects_missing_source() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("lumora.db");
        let err =
            import_database_inner(&db_path, Path::new("C:/definitely/missing.db")).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn import_rejects_non_sqlite_header() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("lumora.db");
        let src = dir.path().join("bad.db");
        std::fs::write(&src, b"not sqlite").unwrap();

        let err = import_database_inner(&db_path, &src).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn import_stages_and_replaces_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("lumora.db");
        std::fs::write(&db_path, b"old").unwrap();
        let src = dir.path().join("new.db");
        std::fs::write(&src, b"SQLite format 3\0new-data").unwrap();

        let msg = import_database_inner(&db_path, &src).unwrap();

        assert!(msg.contains("restart"));
        assert_eq!(
            std::fs::read(&db_path).unwrap(),
            b"SQLite format 3\0new-data"
        );
        assert!(!db_path.with_extension("db.import").exists());
    }

    #[test]
    fn import_removes_stale_wal_sidecars() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("lumora.db");
        std::fs::write(&db_path, b"old").unwrap();
        // Stale sidecars from the replaced database would be replayed on top
        // of the imported main file on restart — they must be removed.
        let wal = dir.path().join("lumora.db-wal");
        let shm = dir.path().join("lumora.db-shm");
        let journal = dir.path().join("lumora.db-journal");
        std::fs::write(&wal, b"stale-wal").unwrap();
        std::fs::write(&shm, b"stale-shm").unwrap();
        std::fs::write(&journal, b"stale-journal").unwrap();
        let src = dir.path().join("new.db");
        std::fs::write(&src, b"SQLite format 3\0new-data").unwrap();

        import_database_inner(&db_path, &src).unwrap();

        assert!(!wal.exists());
        assert!(!shm.exists());
        assert!(!journal.exists());
        assert_eq!(
            std::fs::read(&db_path).unwrap(),
            b"SQLite format 3\0new-data"
        );
    }
}
