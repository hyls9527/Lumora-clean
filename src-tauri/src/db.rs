use rusqlite::{Connection, Result};
use std::path::Path;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        let schema = include_str!("schema.sql");
        self.conn.execute_batch(schema)?;
        Ok(())
    }

    pub fn get_image_count(&self) -> Result<i64> {
        self.conn.query_row(
            "SELECT COUNT(*) FROM images WHERE deleted = 0",
            [],
            |row| row.get(0),
        )
    }

    pub fn image_exists(&self, file_path: &str) -> Result<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM images WHERE file_path = ?1 AND deleted = 0",
            [file_path],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn hash_exists(&self, hash: &str) -> Result<bool> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM images WHERE file_hash = ?1 AND deleted = 0",
            [hash],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn insert_image(
        &self,
        file_path: &str,
        file_hash: &str,
        file_size_kb: i64,
        width: i32,
        height: i32,
        format: &str,
        _thumbnail_path: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO images (file_path, file_hash, file_size_kb, width, height, format)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![file_path, file_hash, file_size_kb, width, height, format],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn update_rating(&self, image_id: i64, rating: i32) -> Result<()> {
        self.conn.execute(
            "UPDATE images SET rating = ?1 WHERE id = ?2",
            rusqlite::params![rating, image_id],
        )?;
        Ok(())
    }

    pub fn toggle_favorite(&self, image_id: i64) -> Result<bool> {
        let current: i32 = self.conn.query_row(
            "SELECT favorite FROM images WHERE id = ?1",
            [image_id],
            |row| row.get(0),
        )?;
        let new_val = if current == 0 { 1 } else { 0 };
        self.conn.execute(
            "UPDATE images SET favorite = ?1 WHERE id = ?2",
            rusqlite::params![new_val, image_id],
        )?;
        Ok(new_val != 0)
    }

    pub fn soft_delete(&self, image_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE images SET deleted = 1, deleted_at = datetime('now') WHERE id = ?1",
            [image_id],
        )?;
        Ok(())
    }

    pub fn search_images(&self, query: &str) -> Result<Vec<ImageRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, file_path, file_hash, file_size_kb, width, height, format,
                    created_at, rating, favorite, metadata_json
             FROM images WHERE deleted = 0 AND (
               file_path LIKE '%' || ?1 || '%'
               OR metadata_json LIKE '%' || ?1 || '%'
             )
             ORDER BY created_at DESC LIMIT 100",
        )?;

        let images = stmt
            .query_map([query], |row| {
                Ok(ImageRecord {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    file_hash: row.get(2)?,
                    file_size_kb: row.get(3)?,
                    width: row.get(4)?,
                    height: row.get(5)?,
                    format: row.get(6)?,
                    created_at: row.get(7)?,
                    rating: row.get(8)?,
                    favorite: row.get::<_, i32>(9)? != 0,
                    metadata_json: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(images)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT value FROM app_config WHERE key = ?1")?;
        let mut rows = stmt.query_map([key], |row| row.get(0))?;
        match rows.next() {
            Some(Ok(value)) => Ok(Some(value)),
            _ => Ok(None),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO app_config (key, value) VALUES (?1, ?2)",
            [key, value],
        )?;
        Ok(())
    }

    pub fn get_images(&self, limit: i64, offset: i64) -> Result<Vec<ImageRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, file_path, file_hash, file_size_kb, width, height, format,
                    created_at, rating, favorite, metadata_json
             FROM images WHERE deleted = 0
             ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )?;

        let images = stmt
            .query_map([limit, offset], |row| {
                Ok(ImageRecord {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    file_hash: row.get(2)?,
                    file_size_kb: row.get(3)?,
                    width: row.get(4)?,
                    height: row.get(5)?,
                    format: row.get(6)?,
                    created_at: row.get(7)?,
                    rating: row.get(8)?,
                    favorite: row.get::<_, i32>(9)? != 0,
                    metadata_json: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(images)
    }
}

#[derive(Debug, serde::Serialize)]
pub struct ImageRecord {
    pub id: i64,
    pub file_path: String,
    pub file_hash: String,
    pub file_size_kb: i64,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub format: String,
    pub created_at: String,
    pub rating: i32,
    pub favorite: bool,
    pub metadata_json: Option<String>,
}
