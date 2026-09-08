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
///
/// Uses SQLite's Online Backup API *inside the live connection* instead of
/// overwriting the file on disk: replacing the main file under an active
/// connection leaves the old connection pointing at stale pages (and its WAL
/// would replay on top of the imported data), which is how an import used to
/// corrupt the library. The backup API writes through the destination
/// connection, so the handle stays valid and subsequent reads/writes see the
/// imported data. Older schema versions are upgraded by the migration runner.
#[tauri::command]
pub async fn import_database(db: State<'_, DbHandle>, source: String) -> AppResult<String> {
    import_database_inner(&db, Path::new(&source))
}

fn import_database_inner(db: &DbHandle, src: &Path) -> AppResult<String> {
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

    // Open the source so sqlite-vec (auto-registered process-wide) can parse
    // the vec0 virtual table schemas; fall back to read-only for files on
    // read-only media.
    use rusqlite::OpenFlags;
    let src_conn = rusqlite::Connection::open_with_flags(
        src,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .or_else(|_| {
        rusqlite::Connection::open_with_flags(
            src,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
    })
    .map_err(|e| AppError::Io(format!("Failed to open source database: {e}")))?;

    // Validate the source actually is a Lumora library and not newer than the
    // running app supports (importing a newer schema would leave the app
    // unable to read it, silently corrupting the session).
    let has_images: i64 = src_conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='images'",
            [],
            |r| r.get(0),
        )
        .map_err(|_| AppError::InvalidInput("Source is not a Lumora database".to_string()))?;
    if has_images == 0 {
        return Err(AppError::InvalidInput(
            "Source is not a Lumora database (missing images table)".to_string(),
        ));
    }
    // `app_config.value` is TEXT (see migrations::current_version).
    let src_version: i64 = src_conn
        .query_row(
            "SELECT value FROM app_config WHERE key = 'schema_version'",
            [],
            |r| r.get::<_, String>(0),
        )
        .map_err(|_| AppError::InvalidInput("Source is not a Lumora database".to_string()))?
        .parse()
        .map_err(|_| AppError::InvalidInput("Source is not a Lumora database".to_string()))?;
    if src_version > crate::db::migrations::SCHEMA_VERSION {
        return Err(AppError::InvalidInput(format!(
            "Source database schema v{src_version} is newer than this app supports (v{})",
            crate::db::migrations::SCHEMA_VERSION
        )));
    }

    // Online backup into the live connection: the destination must not be in
    // use by another thread while the copy runs, so hold the mutex the whole
    // time. This pages the data through the destination's own journal, so the
    // connection (and its WAL) stays coherent — no file swap, no stale WAL.
    let mut dst_conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let backup = rusqlite::backup::Backup::new(&src_conn, &mut dst_conn)
        .map_err(|e| AppError::Io(format!("Failed to start import: {e}")))?;
    backup
        .run_to_completion(128, std::time::Duration::from_millis(5), None)
        .map_err(|e| AppError::Io(format!("Failed to import database: {e}")))?;
    drop(backup);

    // Bring an older imported schema forward (e.g. a v7 backup on a v9 app).
    crate::db::migrations::run_migrations(&dst_conn)
        .map_err(|e| AppError::External(format!("Failed to upgrade imported schema: {e}")))?;
    drop(dst_conn);

    Ok("Database imported successfully. Please restart the application.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Create a real, migrated Lumora database at `dir/lumora.db` with one
    /// image row, returning its path. Uses `DbHandle` so migrations run.
    fn make_source_db(dir: &Path, extra_row: bool) -> std::path::PathBuf {
        let db_path = dir.join("src-lumora.db");
        let db = DbHandle::open(&db_path).unwrap();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('src-1', '/src.png', 'hash1', 1, 'png', '2025-01-01')",
            [],
        )
        .unwrap();
        if extra_row {
            conn.execute(
                "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
                 VALUES ('src-2', '/src2.png', 'hash2', 1, 'png', '2025-01-01')",
                [],
            )
            .unwrap();
        }
        drop(conn);
        // Flush WAL so a plain file copy also carries the data.
        db.checkpoint_wal().unwrap();
        db_path
    }

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
        let db = DbHandle::open(&dir.path().join("lumora.db")).unwrap();
        let err = import_database_inner(&db, Path::new("C:/definitely/missing.db")).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn import_rejects_non_sqlite_header() {
        let dir = tempfile::tempdir().unwrap();
        let db = DbHandle::open(&dir.path().join("lumora.db")).unwrap();
        let src = dir.path().join("bad.db");
        std::fs::write(&src, b"not sqlite").unwrap();

        let err = import_database_inner(&db, &src).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn import_rejects_non_lumora_sqlite() {
        let dir = tempfile::tempdir().unwrap();
        let db = DbHandle::open(&dir.path().join("lumora.db")).unwrap();
        // A valid SQLite file that is not a Lumora library.
        let src = dir.path().join("foreign.db");
        {
            let c = rusqlite::Connection::open(&src).unwrap();
            c.execute_batch("CREATE TABLE other (id INTEGER);").unwrap();
        }

        let err = import_database_inner(&db, &src).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn import_rejects_newer_schema() {
        let dir = tempfile::tempdir().unwrap();
        let db = DbHandle::open(&dir.path().join("lumora.db")).unwrap();
        let src = dir.path().join("future.db");
        {
            let c = rusqlite::Connection::open(&src).unwrap();
            c.execute_batch(
                "CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                 INSERT INTO app_config VALUES ('schema_version', '9999');
                 CREATE TABLE images (id TEXT PRIMARY KEY);",
            )
            .unwrap();
        }

        let err = import_database_inner(&db, &src).unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn import_into_live_connection_is_readable_and_writable() {
        let dir = tempfile::tempdir().unwrap();
        // Destination: a live, already-open DbHandle (the risky case the old
        // file-swap failed: the active connection stayed valid AND sees the
        // imported rows, then can keep writing).
        let dest_dir = dir.path().join("dest");
        std::fs::create_dir_all(&dest_dir).unwrap();
        let db = DbHandle::open(&dest_dir.join("lumora.db")).unwrap();

        let src = make_source_db(dir.path(), true);
        let msg = import_database_inner(&db, &src).unwrap();
        assert!(msg.contains("restart"));

        let conn = db.conn().lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2, "live connection must see the imported rows");

        // The live connection must still be writable after the import
        // (regression: an old WAL or stale schema would reject this).
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES ('after-1', '/after.png', 'h', 1, 'png', '2025-01-01')",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn import_upgrades_older_schema() {
        let dir = tempfile::tempdir().unwrap();
        // v1-only source database (pre-tags, pre-embeddings) — the import must
        // bring it up to the current schema so the live connection can read it.
        let src_path = dir.path().join("old.db");
        {
            let c = rusqlite::Connection::open(&src_path).unwrap();
            c.execute_batch(
                "CREATE TABLE app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                 INSERT INTO app_config VALUES ('schema_version', '1');
                 CREATE TABLE images (
                     id TEXT PRIMARY KEY,
                     file_path TEXT NOT NULL,
                     file_hash TEXT NOT NULL UNIQUE,
                     file_size_kb INTEGER NOT NULL DEFAULT 0,
                     width INTEGER,
                     height INTEGER,
                     format TEXT NOT NULL DEFAULT 'png',
                     created_at TEXT NOT NULL,
                     imported_at TEXT NOT NULL DEFAULT (datetime('now')),
                     deleted INTEGER NOT NULL DEFAULT 0,
                     deleted_at TEXT,
                     rating INTEGER NOT NULL DEFAULT 0,
                     favorite INTEGER NOT NULL DEFAULT 0,
                     metadata_json TEXT,
                     variant_group_id TEXT,
                     hps_score REAL, hps_style TEXT,
                     aesthetic_score REAL, scoring_model TEXT,
                     scored_at TEXT, score_label TEXT
                 );
                 CREATE TABLE images_fts (
                     rowid INTEGER PRIMARY KEY,
                     file_path TEXT,
                     metadata_json TEXT
                 );
                 INSERT INTO images (id, file_path, file_hash, format, created_at)
                 VALUES ('old-1', '/old.png', 'oldhash', 'png', '2025-01-01');",
            )
            .unwrap();
        }

        let dest_dir = dir.path().join("dest2");
        std::fs::create_dir_all(&dest_dir).unwrap();
        let db = DbHandle::open(&dest_dir.join("lumora.db")).unwrap();
        import_database_inner(&db, &src_path).unwrap();

        let conn = db.conn().lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        // Migrations must have run (v9 creates the clip tables).
        let clip_tables: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name = 'clip_embeddings'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(clip_tables, 1);
    }
}
