use rusqlite::Connection;

use super::schema;

/// Current schema version — bump when adding migrations.
pub const SCHEMA_VERSION: i64 = 4;

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
    conn.execute_batch(schema::V3_ADD_DELETED_AT)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_db_starts_at_version_1() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let v = current_version(&conn).unwrap();
        assert_eq!(v, 4);
    }

    #[test]
    fn idempotent_migration() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let v = current_version(&conn).unwrap();
        assert_eq!(v, 4);
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
}
