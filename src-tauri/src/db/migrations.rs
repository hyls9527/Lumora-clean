use rusqlite::Connection;

use super::schema;

/// Current schema version — bump when adding migrations.
pub const SCHEMA_VERSION: i64 = 5;

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

/// Roll back migrations from the current version down to `target`.
/// Each revert runs inside its own transaction so partial progress is
/// preserved if an intermediate step fails.
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
        _ => Err(rusqlite::Error::InvalidQuery),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_db_starts_at_version_1() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let v = current_version(&conn).unwrap();
        assert_eq!(v, 5);
    }

    #[test]
    fn idempotent_migration() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let v = current_version(&conn).unwrap();
        assert_eq!(v, 5);
    }

    #[test]
    fn images_table_exists_after_migration() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn downgrade_from_v5_to_v1() {
        let conn = Connection::open_in_memory().unwrap();
        // Migrate all the way up.
        run_migrations(&conn).unwrap();
        assert_eq!(current_version(&conn).unwrap(), 5);

        // Downgrade back to v1.
        downgrade_to(&conn, 1).unwrap();
        assert_eq!(current_version(&conn).unwrap(), 1);

        // v5 tables should be gone.
        let exists =
            |sql: &str| -> bool { conn.query_row(sql, [], |r| r.get::<_, i64>(0)).unwrap() > 0 };
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
        assert_eq!(current_version(&conn).unwrap(), 5);
    }
}
