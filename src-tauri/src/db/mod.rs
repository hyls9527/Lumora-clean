pub mod migrations;
pub mod schema;

use rusqlite::{ffi::sqlite3_auto_extension, Connection};
use std::path::Path;
use std::sync::Mutex;

/// Thread-safe database handle wrapping a single SQLite connection.
///
/// Tauri commands receive `&DbHandle` via managed state.
/// WAL mode + `Mutex` keeps it safe under concurrent Tauri command calls.
pub struct DbHandle {
    conn: Mutex<Connection>,
}

impl DbHandle {
    /// Open (or create) a database at `path`, run migrations, enable WAL.
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        // Register sqlite-vec extension globally (must be done before any connection)
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite_vec::sqlite3_vec_init as *const (),
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
            conn: Mutex::new(conn),
        })
    }

    /// Open an in-memory database (useful for tests).
    #[cfg(test)]
    pub fn open_memory() -> Result<Self, rusqlite::Error> {
        // Register sqlite-vec extension globally
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite_vec::sqlite3_vec_init as *const (),
            )));
        }
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;",
        )?;
        migrations::run_migrations(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Access the underlying connection behind the mutex.
    pub fn conn(&self) -> &Mutex<Connection> {
        &self.conn
    }
}
