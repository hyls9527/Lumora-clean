use rusqlite::params;

use crate::db::DbHandle;
use crate::error::AppResult;
use crate::schema::types::{row_to_record, ImageRecord};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Full-text search via FTS5 on file_path + metadata_json.
#[tauri::command]
pub fn search_images(
    db: tauri::State<'_, DbHandle>,
    query: String,
) -> AppResult<Vec<ImageRecord>> {
    let conn = db.conn().lock().map_err(|_| crate::error::AppError::Lock)?;
    let mut stmt = conn
        .prepare(
            "SELECT i.* FROM images i
             JOIN images_fts f ON f.rowid = i.rowid
             WHERE images_fts MATCH ?1 AND i.deleted = 0
             ORDER BY rank
             LIMIT 200",
        )
        ?;
    let escaped = escape_fts5(&query);
    let items = stmt
        .query_map(params![escaped], row_to_record)
        ?
        .collect::<Result<Vec<_>, _>>()
        ?;
    Ok(items)
}

/// Field-scoped search on metadata_json.
#[tauri::command]
pub fn search_images_advanced(
    db: tauri::State<'_, DbHandle>,
    query: String,
    field: Option<String>,
) -> AppResult<Vec<ImageRecord>> {
    let field = field.unwrap_or_else(|| "all".to_string());
    let conn = db.conn().lock().map_err(|_| crate::error::AppError::Lock)?;

    if field == "all" || field.is_empty() {
        let mut stmt = conn
            .prepare(
                "SELECT i.* FROM images i
                 JOIN images_fts f ON f.rowid = i.rowid
                 WHERE images_fts MATCH ?1 AND i.deleted = 0
                 ORDER BY rank
                 LIMIT 200",
            )?;
        let escaped = escape_fts5(&query);
        let items = stmt
            .query_map(params![escaped], row_to_record)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(items);
    }

    if field == "seed" {
        let seed_val: i64 = match query.trim().parse() {
            Ok(v) => v,
            Err(_) => return Ok(vec![]),
        };
        let mut stmt = conn.prepare(
            "SELECT * FROM images
             WHERE json_extract(metadata_json, '$.seed') = ?1 AND deleted = 0
             ORDER BY imported_at DESC LIMIT 200",
        )?;
        let items = stmt
            .query_map(params![seed_val], row_to_record)?
            .collect::<Result<Vec<_>, _>>()?;
        return Ok(items);
    }

    let json_path = match field.as_str() {
        "prompt" => "$.prompt",
        "negative_prompt" => "$.negative_prompt",
        "model" => "$.model",
        "sampler" => "$.sampler",
        "positive_prompt" => "$.positive_prompt",
        _ => return Ok(vec![]),
    };

    let escaped = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    let pattern = format!("%{}%", escaped);
    let mut stmt = conn.prepare(
        "SELECT * FROM images
         WHERE json_extract(metadata_json, ?1) LIKE ?2 AND deleted = 0
         ORDER BY imported_at DESC LIMIT 200",
    )?;
    let items = stmt
        .query_map(params![json_path, pattern], row_to_record)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Escape FTS5 special characters so user input doesn't break MATCH queries.
pub(super) fn escape_fts5(query: &str) -> String {
    let mut escaped = String::with_capacity(query.len());
    for ch in query.chars() {
        match ch {
            '"' | '*' | '+' | '-' | '(' | ')' | ':' | '^' => {
                escaped.push('"');
                escaped.push(ch);
                escaped.push('"');
            }
            _ => escaped.push(ch),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> crate::db::DbHandle {
        crate::db::DbHandle::open_memory().unwrap()
    }

    #[test]
    fn search_empty_query_returns_empty() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('s1','/search.png','h',1,'png','2025-01-01','{\"prompt\":\"test\"}')",
            [],
        )
        .unwrap();

        let mut stmt = conn
            .prepare("SELECT id FROM images WHERE metadata_json LIKE '%nonexistent%'")
            .unwrap();
        let rows: Vec<String> = stmt
            .query_map([], |row| Ok(row.get::<_, String>(0)?))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(rows.len(), 0);
    }

    #[test]
    fn search_advanced_by_seed() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('seed-1','/s1.png','h',1,'png','2025-01-01','{\"prompt\":\"a cat\",\"seed\":12345,\"model\":\"flux\"}')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('seed-2','/s2.png','h',1,'png','2025-01-01','{\"prompt\":\"a dog\",\"seed\":99999,\"model\":\"flux\"}')",
            [],
        ).unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT id FROM images
                 WHERE json_extract(metadata_json, '$.seed') = ?1 AND deleted = 0",
            )
            .unwrap();
        let rows: Vec<String> = stmt
            .query_map(rusqlite::params![12345i64], |row| Ok(row.get::<_, String>(0)?))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0], "seed-1");
    }

    #[test]
    fn search_advanced_by_prompt() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('p-1','/p1.png','h',1,'png','2025-01-01','{\"prompt\":\"sunset over mountains\",\"seed\":1}')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('p-2','/p2.png','h',1,'png','2025-01-01','{\"prompt\":\"ocean waves\",\"seed\":2}')",
            [],
        ).unwrap();

        let pattern = "%sunset%";
        let mut stmt = conn
            .prepare(
                "SELECT id FROM images
                 WHERE json_extract(metadata_json, '$.prompt') LIKE ?1 AND deleted = 0",
            )
            .unwrap();
        let rows: Vec<String> = stmt
            .query_map(rusqlite::params![pattern], |row| Ok(row.get::<_, String>(0)?))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0], "p-1");
    }

    #[test]
    fn search_advanced_by_model() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('m-1','/m1.png','h',1,'png','2025-01-01','{\"prompt\":\"test\",\"model\":\"flux-dev\"}')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('m-2','/m2.png','h',1,'png','2025-01-01','{\"prompt\":\"test\",\"model\":\"stable-diffusion\"}')",
            [],
        ).unwrap();

        let pattern = "%flux%";
        let mut stmt = conn
            .prepare(
                "SELECT id FROM images
                 WHERE json_extract(metadata_json, '$.model') LIKE ?1 AND deleted = 0",
            )
            .unwrap();
        let rows: Vec<String> = stmt
            .query_map(rusqlite::params![pattern], |row| Ok(row.get::<_, String>(0)?))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0], "m-1");
    }

    #[test]
    fn search_advanced_seed_invalid_returns_empty() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('sv-1','/sv1.png','h',1,'png','2025-01-01','{\"seed\":42}')",
            [],
        )
        .unwrap();

        let seed_val: Result<i64, _> = "not-a-number".trim().parse();
        assert!(seed_val.is_err());
    }
}
