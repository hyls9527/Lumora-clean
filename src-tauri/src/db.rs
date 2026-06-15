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
