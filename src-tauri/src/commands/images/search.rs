use rusqlite::params;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};
use crate::schema::types::{attach_tags, row_to_record, ImageRecord};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Full-text search via FTS5 on file_path + metadata_json.
#[tauri::command]
pub fn search_images(db: tauri::State<'_, DbHandle>, query: String) -> AppResult<Vec<ImageRecord>> {
    search_images_inner(&db, &query)
}

fn search_images_inner(db: &DbHandle, query: &str) -> AppResult<Vec<ImageRecord>> {
    // An empty/whitespace query must yield no results: an empty MATCH string
    // is an FTS5 syntax error, not "match nothing".
    let escaped = escape_fts5(query);
    if escaped.is_empty() {
        return Ok(vec![]);
    }
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    fts_query(&conn, &escaped)
}

/// Shared FTS5 query body (also used by the "all" branch of advanced search).
fn fts_query(conn: &rusqlite::Connection, escaped: &str) -> AppResult<Vec<ImageRecord>> {
    let mut stmt = conn.prepare(
        "SELECT i.* FROM images i
             JOIN images_fts f ON f.rowid = i.rowid
             WHERE images_fts MATCH ?1 AND i.deleted = 0
             ORDER BY rank
             LIMIT 200",
    )?;
    let mut items = stmt
        .query_map(params![escaped], row_to_record)?
        .collect::<Result<Vec<_>, _>>()?;
    attach_tags(conn, &mut items)?;
    Ok(items)
}

/// Field-scoped search on metadata_json.
#[tauri::command]
pub fn search_images_advanced(
    db: tauri::State<'_, DbHandle>,
    query: String,
    field: Option<String>,
) -> AppResult<Vec<ImageRecord>> {
    search_images_advanced_inner(&db, &query, field)
}

fn search_images_advanced_inner(
    db: &DbHandle,
    query: &str,
    field: Option<String>,
) -> AppResult<Vec<ImageRecord>> {
    // Empty query means "no results" for every field — not "match all rows".
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let field = field.unwrap_or_else(|| "all".to_string());
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;

    if field == "all" || field.is_empty() {
        let escaped = escape_fts5(query);
        if escaped.is_empty() {
            return Ok(vec![]);
        }
        return fts_query(&conn, &escaped);
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
        let mut items = items;
        attach_tags(&conn, &mut items)?;
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

    // LIKE wildcards in the user query must match literally: escape with a
    // backslash AND declare it via ESCAPE — without the clause the escapes
    // are inert and a lone '%' would match every row.
    let escaped = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    let pattern = format!("%{escaped}%");
    let mut stmt = conn.prepare(
        "SELECT * FROM images
         WHERE json_extract(metadata_json, ?1) LIKE ?2 ESCAPE '\\' AND deleted = 0
         ORDER BY imported_at DESC LIMIT 200",
    )?;
    let items = stmt
        .query_map(params![json_path, pattern], row_to_record)?
        .collect::<Result<Vec<_>, _>>()?;
    let mut items = items;
    attach_tags(&conn, &mut items)?;
    Ok(items)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Escape FTS5 special characters so user input doesn't break MATCH queries.
///
/// Each whitespace-separated token is wrapped in double quotes (inner quotes
/// doubled), so operators like `- : ( ) * ^` and stray `"` lose their special
/// meaning instead of corrupting the query. Tokens without any alphanumeric
/// character are dropped: they tokenize to nothing and would otherwise turn
/// into empty-phrase syntax errors. Returns an empty string for an
/// empty/operator-only query, which callers must treat as "no results".
pub(crate) fn escape_fts5(query: &str) -> String {
    query
        .split_whitespace()
        .filter(|token| token.chars().any(|c| c.is_alphanumeric()))
        .map(|token| format!("\"{}\"", token.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" ")
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
            .query_map([], |row| row.get::<_, String>(0))
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
            .query_map(rusqlite::params![12345i64], |row| row.get::<_, String>(0))
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
            .query_map(rusqlite::params![pattern], |row| row.get::<_, String>(0))
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
            .query_map(rusqlite::params![pattern], |row| row.get::<_, String>(0))
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

    #[test]
    fn escape_fts5_wraps_tokens_and_doubles_inner_quotes() {
        assert_eq!(escape_fts5("a\"b"), "\"a\"\"b\"");
        assert_eq!(escape_fts5("cat -dog"), "\"cat\" \"-dog\"");
        assert_eq!(escape_fts5("(test):1*"), "\"(test):1*\"");
        // Operator-only input has no searchable tokens → empty output.
        assert_eq!(escape_fts5("-*():"), "");
        assert_eq!(escape_fts5("  "), "");
    }

    #[test]
    fn search_empty_query_returns_empty_vec() {
        let db = test_db();
        assert!(search_images_inner(&db, "").unwrap().is_empty());
        assert!(search_images_inner(&db, "   ").unwrap().is_empty());
        assert!(search_images_advanced_inner(&db, "", None)
            .unwrap()
            .is_empty());
        assert!(search_images_advanced_inner(&db, " ", Some("all".into()))
            .unwrap()
            .is_empty());
    }

    #[test]
    fn search_fts_special_characters_do_not_error() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('ft1','/cat & dog.png','h',1,'png','2025-01-01','{\"prompt\":\"a (test):1* image\"}')",
            [],
        )
        .unwrap();
        drop(conn);

        // Operators and quotes in the query must not raise FTS5 syntax errors.
        let items = search_images_inner(&db, "a\"b (test):1*").unwrap();
        assert!(items.is_empty());
        // Plain token still matches the file path via FTS.
        let items = search_images_inner(&db, "cat").unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].id, "ft1");
    }

    #[test]
    fn search_advanced_like_escapes_wildcards() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('w1','/w1.png','h1',1,'png','2025-01-01','{\"prompt\":\"100% sunset\"}')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at,metadata_json)
             VALUES ('w2','/w2.png','h2',1,'png','2025-01-01','{\"prompt\":\"abc sunset\"}')",
            [],
        )
        .unwrap();
        drop(conn);

        // A lone '%' is the user's data, not a wildcard: only the literal
        // percent row may match.
        let hits = search_images_advanced_inner(&db, "%", Some("prompt".into())).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, "w1");

        // '_' must not act as a single-char wildcard either.
        let hits = search_images_advanced_inner(&db, "a_c", Some("prompt".into())).unwrap();
        assert!(hits.is_empty());

        // Plain text still matches both rows.
        let hits = search_images_advanced_inner(&db, "sunset", Some("prompt".into())).unwrap();
        assert_eq!(hits.len(), 2);
    }

    #[test]
    fn search_advanced_unknown_field_returns_empty() {
        let db = test_db();
        let hits = search_images_advanced_inner(&db, "x", Some("nope".into())).unwrap();
        assert!(hits.is_empty());
    }
}
