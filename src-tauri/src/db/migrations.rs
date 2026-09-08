use rusqlite::Connection;

use super::schema;

/// Current schema version — bump when adding migrations.
pub const SCHEMA_VERSION: i64 = 9;

/// Run all pending migrations inside a single transaction.
pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    let current = current_version(conn)?;
    if current >= SCHEMA_VERSION {
        return Ok(());
    }
    let tx = conn.unchecked_transaction()?;
    for v in current..SCHEMA_VERSION {
        apply_migration(&tx, v + 1)?;
        set_version(&tx, v + 1)?;
    }
    tx.commit()
}

fn current_version(conn: &Connection) -> Result<i64, rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS app_config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
    )?;
    let s: String = conn
        .query_row(
            "SELECT value FROM app_config WHERE key = 'schema_version'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "0".to_string());
    s.parse::<i64>().map_err(|_| rusqlite::Error::InvalidQuery)
}

fn set_version(conn: &Connection, version: i64) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES ('schema_version', ?1)",
        [version.to_string()],
    )?;
    Ok(())
}

fn apply_migration(conn: &Connection, version: i64) -> Result<(), rusqlite::Error> {
    match version {
        1 => apply_v1(conn),
        2 => apply_v2(conn),
        3 => apply_v3(conn),
        4 => apply_v4(conn),
        5 => apply_v5(conn),
        6 => apply_v6(conn),
        7 => apply_v7(conn),
        8 => apply_v8(conn),
        9 => apply_v9(conn),
        _ => Err(rusqlite::Error::InvalidQuery),
    }
}

fn apply_v1(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(schema::V1_CREATE_IMAGES)?;
    conn.execute_batch(schema::V1_INDEX_HASH)?;
    conn.execute_batch(schema::V1_INDEX_RATING)?;
    conn.execute_batch(schema::V1_INDEX_CREATED)?;
    conn.execute_batch(schema::V1_FTS5)?;
    conn.execute_batch(schema::V1_TRIGGER_INSERT)?;
    conn.execute_batch(schema::V1_TRIGGER_DELETE)?;
    conn.execute_batch(schema::V1_TRIGGER_UPDATE)?;
    Ok(())
}

fn apply_v2(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(schema::V2_CREATE_TAGS)?;
    conn.execute_batch(schema::V2_CREATE_IMAGE_TAGS)?;
    conn.execute_batch(schema::V2_INDEX_IMAGE_TAGS_IMAGE)?;
    conn.execute_batch(schema::V2_INDEX_IMAGE_TAGS_TAG)?;
    Ok(())
}

fn apply_v3(conn: &Connection) -> Result<(), rusqlite::Error> {
    // ALTER TABLE ADD COLUMN fails if the column already exists (e.g. after
    // a downgrade+re-upgrade cycle since SQLite can't drop columns).
    // Ignore the "duplicate column" error to make this idempotent.
    match conn.execute_batch(schema::V3_ADD_DELETED_AT) {
        Ok(()) => {}
        Err(rusqlite::Error::SqliteFailure(e, Some(msg)))
            if e.code == rusqlite::ErrorCode::Unknown && msg.contains("duplicate column") => {}
        Err(e) => return Err(e),
    }
    conn.execute_batch(schema::V3_INDEX_DELETED_AT)?;
    Ok(())
}

fn apply_v4(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(schema::V4_CREATE_EMBEDDINGS)?;
    // Create vec0 virtual table for KNN search
    // vec0 requires the sqlite-vec extension to be loaded (done in db/mod.rs)
    conn.execute_batch(schema::V4_CREATE_VEC_TABLE)?;
    Ok(())
}

fn apply_v5(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(schema::V5_CREATE_ANALYSIS_HISTORY)?;
    conn.execute_batch(schema::V5_INDEX_ANALYSIS_IMAGE)?;
    Ok(())
}

fn apply_v6(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(schema::V6_CREATE_VARIANT_GROUPS)?;
    // ALTER TABLE ADD COLUMN may fail if the column already exists after
    // a downgrade+re-upgrade cycle. Ignore "duplicate column" like v3.
    match conn.execute_batch(schema::V6_ADD_VARIANT_GROUP_ID) {
        Ok(()) => {}
        Err(rusqlite::Error::SqliteFailure(e, Some(msg)))
            if e.code == rusqlite::ErrorCode::Unknown && msg.contains("duplicate column") => {}
        Err(e) => return Err(e),
    }
    Ok(())
}

fn apply_v7(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(schema::V7_CREATE_SMART_COLLECTIONS)?;
    Ok(())
}

fn apply_v8(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Each ALTER runs separately: SQLite aborts an execute_batch at the first
    // "duplicate column" error, so a DB that already has *some* v8 columns
    // (after a downgrade+re-upgrade cycle) would silently keep the rest
    // missing. Tolerate the duplicate error per column and continue.
    for stmt in schema::V8_ADD_SCORE_COLUMNS {
        match conn.execute_batch(stmt) {
            Ok(()) => {}
            Err(rusqlite::Error::SqliteFailure(e, Some(msg)))
                if e.code == rusqlite::ErrorCode::Unknown && msg.contains("duplicate column") => {}
            Err(e) => return Err(e),
        }
    }
    conn.execute_batch(schema::V8_INDEX_SCORE_LABEL)?;
    Ok(())
}

fn apply_v9(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(schema::V9_CREATE_CLIP_EMBEDDINGS)?;
    conn.execute_batch(schema::V9_CREATE_VEC_CLIP_TABLE)?;
    Ok(())
}

/// Roll back migrations from the current version down to `target`.
/// Each revert runs inside its own transaction so partial progress is
/// preserved if an intermediate step fails.
#[allow(dead_code)]
pub fn downgrade_to(conn: &Connection, target: i64) -> Result<(), rusqlite::Error> {
    let current = current_version(conn)?;
    if current <= target {
        return Ok(());
    }
    for v in (target + 1..=current).rev() {
        let tx = conn.unchecked_transaction()?;
        revert_migration(&tx, v)?;
        set_version(&tx, v - 1)?;
        tx.commit()?;
    }
    Ok(())
}

#[allow(dead_code)]
fn revert_migration(conn: &Connection, version: i64) -> Result<(), rusqlite::Error> {
    match version {
        1 => {
            conn.execute_batch("DROP TRIGGER IF EXISTS images_au;")?;
            conn.execute_batch("DROP TRIGGER IF EXISTS images_ad;")?;
            conn.execute_batch("DROP TRIGGER IF EXISTS images_ai;")?;
            conn.execute_batch("DROP TABLE IF EXISTS images_fts;")?;
            conn.execute_batch("DROP TABLE IF EXISTS images;")?;
            conn.execute_batch("DROP INDEX IF EXISTS idx_images_file_hash;")?;
            conn.execute_batch("DROP INDEX IF EXISTS idx_images_rating;")?;
            conn.execute_batch("DROP INDEX IF EXISTS idx_images_created;")?;
            // Also remove the schema_version row so the DB looks fresh.
            conn.execute_batch("DELETE FROM app_config WHERE key = 'schema_version';")?;
            Ok(())
        }
        2 => {
            conn.execute_batch("DROP TABLE IF EXISTS image_tags;")?;
            conn.execute_batch("DROP TABLE IF EXISTS tags;")?;
            Ok(())
        }
        3 => {
            // SQLite cannot drop columns — no-op.
            Ok(())
        }
        4 => {
            conn.execute_batch("DROP TABLE IF EXISTS vec_embeddings;")?;
            conn.execute_batch("DROP TABLE IF EXISTS embeddings;")?;
            Ok(())
        }
        5 => {
            conn.execute_batch("DROP INDEX IF EXISTS idx_analysis_history_image;")?;
            conn.execute_batch("DROP TABLE IF EXISTS analysis_history;")?;
            Ok(())
        }
        8 => {
            // SQLite cannot drop the score columns (no-op).
            Ok(())
        }
        9 => {
            conn.execute_batch("DROP TABLE IF EXISTS vec_embeddings_clip;")?;
            conn.execute_batch("DROP TABLE IF EXISTS clip_embeddings;")?;
            Ok(())
        }
        7 => {
            conn.execute_batch("DROP TABLE IF EXISTS smart_collections;")?;
            Ok(())
        }
        6 => {
            conn.execute_batch("DROP TABLE IF EXISTS variant_groups;")?;
            // SQLite cannot drop the variant_group_id column — no-op.
            Ok(())
        }
        _ => Err(rusqlite::Error::InvalidQuery),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::ffi::sqlite3_auto_extension;

    /// Open an in-memory connection with sqlite-vec registered.
    /// Migrations create a `vec0` virtual table, which requires the extension.
    fn open_conn() -> Connection {
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
        Connection::open_in_memory().unwrap()
    }

    #[test]
    fn fresh_db_starts_at_version_1() {
        let conn = open_conn();
        run_migrations(&conn).unwrap();
        let v = current_version(&conn).unwrap();
        assert_eq!(v, 9);
    }

    #[test]
    fn idempotent_migration() {
        let conn = open_conn();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let v = current_version(&conn).unwrap();
        assert_eq!(v, 9);
    }

    #[test]
    fn images_table_exists_after_migration() {
        let conn = open_conn();
        run_migrations(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn v8_partial_columns_still_upgrade_all_columns() {
        // Regression (R-5): a database that already has *some* v8 score
        // columns (downgrade+re-upgrade cycle) used to keep the rest missing
        // because execute_batch aborts at the first "duplicate column" error.
        let conn = open_conn();
        // Build a v7 database: migrate, then reset the version marker.
        run_migrations(&conn).unwrap();
        conn.execute_batch(
            "DELETE FROM app_config WHERE key = 'schema_version';
             INSERT INTO app_config VALUES ('schema_version', '7');
             ALTER TABLE images DROP COLUMN hps_score;",
        )
        .unwrap();
        // Simulate a partial downgrade state: only one column survives.
        let dropped = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('images')
                 WHERE name = 'hps_score'",
                [],
                |r| r.get::<_, i64>(0),
            )
            .unwrap();
        assert_eq!(dropped, 0, "test setup: hps_score must be absent");

        run_migrations(&conn).unwrap();
        assert_eq!(current_version(&conn).unwrap(), 9);

        // Every v8 column must be present after the re-migration.
        for col in [
            "hps_score",
            "hps_style",
            "aesthetic_score",
            "scoring_model",
            "scored_at",
            "score_label",
        ] {
            let n: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM pragma_table_info('images') WHERE name = ?1",
                    [col],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(n, 1, "column {col} must exist after re-migration");
        }
    }

    #[test]
    fn downgrade_from_v6_to_v1() {
        let conn = open_conn();
        // Migrate all the way up.
        run_migrations(&conn).unwrap();
        assert_eq!(current_version(&conn).unwrap(), 9);

        // Downgrade back to v1.
        downgrade_to(&conn, 1).unwrap();
        assert_eq!(current_version(&conn).unwrap(), 1);

        let exists =
            |sql: &str| -> bool { conn.query_row(sql, [], |r| r.get::<_, i64>(0)).unwrap() > 0 };
        // v7 tables should be gone.
        assert!(!exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='smart_collections'"
        ));
        // v6 tables should be gone.
        assert!(!exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='variant_groups'"
        ));
        // v5 tables should be gone.
        // analysis_history (v5) dropped
        assert!(!exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='analysis_history'"
        ));
        // embeddings / vec_embeddings (v4) dropped
        assert!(!exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='embeddings'"
        ));
        assert!(!exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='vec_embeddings'"
        ));
        // clip_embeddings / vec_embeddings_clip (v9) dropped
        assert!(!exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='clip_embeddings'"
        ));
        assert!(!exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='vec_embeddings_clip'"
        ));
        // tags / image_tags (v2) dropped
        assert!(!exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tags'"
        ));
        assert!(!exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='image_tags'"
        ));
        // images & images_fts (v1) still present — we downgraded *to* v1
        assert!(exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='images'"
        ));
        assert!(exists(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='images_fts'"
        ));

        // Verify we can re-migrate back up.
        run_migrations(&conn).unwrap();
        assert_eq!(current_version(&conn).unwrap(), 9);
    }
}
