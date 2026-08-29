pub mod migrations;
pub mod schema;

use rusqlite::{ffi::sqlite3_auto_extension, Connection};
use std::path::Path;
use std::sync::{Arc, Mutex};

/// Thread-safe database handle wrapping a single SQLite connection.
///
/// Tauri commands receive `&DbHandle` via managed state.
/// WAL mode + internal `Arc<Mutex<Connection>>` allows cheap cloning
/// for LAN server sharing without opening a second connection.
#[derive(Clone)]
pub struct DbHandle {
    conn: Arc<Mutex<Connection>>,
    path: std::path::PathBuf,
}

impl DbHandle {
    /// Open (or create) a database at `path`, run migrations, enable WAL.
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        // Register sqlite-vec extension globally (must be done before any connection)
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute::<
                *const (),
                unsafe extern "C" fn(
                    *mut rusqlite::ffi::sqlite3,
                    *mut *mut i8,
                    *const rusqlite::ffi::sqlite3_api_routines,
                ) -> i32,
            >(
                sqlite_vec::sqlite3_vec_init as *const ()
            )));
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous  = NORMAL;
             PRAGMA foreign_keys = ON;",
        )?;
        migrations::run_migrations(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            path: path.to_path_buf(),
        })
    }

    /// Open an in-memory database (useful for tests).
    #[cfg(test)]
    pub fn open_memory() -> Result<Self, rusqlite::Error> {
        // Register sqlite-vec extension globally
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute::<
                *const (),
                unsafe extern "C" fn(
                    *mut rusqlite::ffi::sqlite3,
                    *mut *mut i8,
                    *const rusqlite::ffi::sqlite3_api_routines,
                ) -> i32,
            >(
                sqlite_vec::sqlite3_vec_init as *const ()
            )));
        }
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous  = NORMAL;
             PRAGMA foreign_keys = ON;",
        )?;
        migrations::run_migrations(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            path: std::path::PathBuf::from(":memory:"),
        })
    }

    pub fn conn(&self) -> &Mutex<Connection> {
        &self.conn
    }

    pub fn path(&self) -> &std::path::Path {
        &self.path
    }

    /// Flush the WAL back into the main database file (`TRUNCATE` mode).
    ///
    /// The database runs in WAL mode, so a plain `fs::copy` of `path()`
    /// only captures what has already been checkpointed — committed
    /// transactions still sitting in `<path>-wal` would be silently lost.
    /// Call this before file-level copies of the database (e.g. exports).
    pub fn checkpoint_wal(&self) -> Result<(), crate::error::AppError> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| crate::error::AppError::Lock)?;
        // Returns (busy, log, checkpointed) — a non-zero busy column is not
        // an error here; best effort is enough before a read-only copy.
        conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |r| r.get::<_, i64>(0))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_runs_migrations_on_fresh_database() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = DbHandle::open(&db_path).unwrap();
        let conn = db.conn().lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn checkpoint_flushes_wal_into_main_file() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("wal.db");
        let db = DbHandle::open(&db_path).unwrap();
        {
            let conn = db.conn().lock().unwrap();
            conn.execute(
                "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
                 VALUES ('w1','/w.png','h',1,'png','2025-01-01')",
                [],
            )
            .unwrap();
        }

        // Simulate the export path: flush WAL, then copy ONLY the main file.
        db.checkpoint_wal().unwrap();
        let copy_path = dir.path().join("wal-copy.db");
        std::fs::copy(&db_path, &copy_path).unwrap();

        let copy = Connection::open(&copy_path).unwrap();
        let count: i64 = copy
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        // Without the checkpoint this copy would be missing the new row.
        assert_eq!(count, 1);
    }
}
