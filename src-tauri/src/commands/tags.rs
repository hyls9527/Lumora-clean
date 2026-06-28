use rusqlite::params;
use uuid::Uuid;

use crate::db::DbHandle;
use crate::schema::types::Tag;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Create a new tag.
#[tauri::command]
pub fn create_tag(
    db: tauri::State<'_, DbHandle>,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let id = create_tag_impl(&conn, &name, color.as_deref())?;
    let tag = conn
        .query_row(
            "SELECT id, name, color, created_at FROM tags WHERE id = ?1",
            params![id],
            row_to_tag,
        )
        .map_err(|e| e.to_string())?;
    Ok(tag)
}

/// List all tags, ordered by name.
#[tauri::command]
pub fn list_tags(db: tauri::State<'_, DbHandle>) -> Result<Vec<Tag>, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, color, created_at FROM tags ORDER BY name")
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map([], row_to_tag)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(tags)
}

/// Delete a tag and its image associations.
#[tauri::command]
pub fn delete_tag(db: tauri::State<'_, DbHandle>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    conn.execute("DELETE FROM image_tags WHERE tag_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Associate a tag with an image.
#[tauri::command]
pub fn add_tag_to_image(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
    tag_id: String,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?1, ?2)",
        params![image_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove a tag from an image.
#[tauri::command]
pub fn remove_tag_from_image(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
    tag_id: String,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    conn.execute(
        "DELETE FROM image_tags WHERE image_id = ?1 AND tag_id = ?2",
        params![image_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get all tags associated with an image.
#[tauri::command]
pub fn get_image_tags(
    db: tauri::State<'_, DbHandle>,
    image_id: String,
) -> Result<Vec<Tag>, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, t.color, t.created_at
             FROM tags t
             JOIN image_tags it ON it.tag_id = t.id
             WHERE it.image_id = ?1
             ORDER BY t.name",
        )
        .map_err(|e| e.to_string())?;
    let tags = stmt
        .query_map(params![image_id], row_to_tag)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(tags)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn row_to_tag(row: &rusqlite::Row<'_>) -> Result<Tag, rusqlite::Error> {
    Ok(Tag {
        id: row.get("id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        created_at: row.get("created_at")?,
    })
}

// ---------------------------------------------------------------------------
// Internal helpers (for testing and cross-module use)
// ---------------------------------------------------------------------------

/// Internal: create a tag and return its ID.
pub fn create_tag_impl(
    conn: &rusqlite::Connection,
    name: &str,
    color: Option<&str>,
) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
        params![id, trimmed, color],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

/// Internal: associate a tag with an image.
pub fn add_tag_to_image_impl(
    conn: &rusqlite::Connection,
    image_id: &str,
    tag_id: &str,
) -> Result<(), String> {
    // Fix #7: use INSERT instead of INSERT OR IGNORE to surface FK violations
    conn.execute(
        "INSERT INTO image_tags (image_id, tag_id) VALUES (?1, ?2)",
        params![image_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;

    fn insert_test_image(conn: &rusqlite::Connection, id: &str) {
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES (?1, '/test.png', 'h1', 100, 'png', '2025-01-01')",
            params![id],
        )
        .unwrap();
    }

    #[test]
    fn create_and_list_tags() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        let id1 = create_tag_impl(&conn, "nature", Some("#4a7a3a")).unwrap();
        let id2 = create_tag_impl(&conn, "art", None).unwrap();

        let mut stmt = conn
            .prepare("SELECT id, name, color, created_at FROM tags ORDER BY name")
            .unwrap();
        let tags: Vec<Tag> = stmt.query_map([], row_to_tag).unwrap().filter_map(|r| r.ok()).collect();

        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].name, "art"); // sorted by name
        assert_eq!(tags[1].name, "nature");
        assert_eq!(tags[1].color.as_deref(), Some("#4a7a3a"));
    }

    #[test]
    fn tag_image_association() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        insert_test_image(&conn, "img-1");
        let tag_id = create_tag_impl(&conn, "test-tag", None).unwrap();
        add_tag_to_image_impl(&conn, "img-1", &tag_id).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM image_tags WHERE image_id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);

        // Remove
        conn.execute("DELETE FROM image_tags WHERE image_id = 'img-1' AND tag_id = ?1", params![tag_id])
            .unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM image_tags WHERE image_id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn empty_tag_name_fails() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        let result = create_tag_impl(&conn, "", None);
        assert!(result.is_err());

        let result = create_tag_impl(&conn, "   ", None);
        assert!(result.is_err());
    }

    #[test]
    fn duplicate_tag_association_fails() {
        let db = DbHandle::open_memory().unwrap();
        let conn = db.conn().lock().unwrap();

        insert_test_image(&conn, "img-1");
        let tag_id = create_tag_impl(&conn, "dup-tag", None).unwrap();

        add_tag_to_image_impl(&conn, "img-1", &tag_id).unwrap();
        let result = add_tag_to_image_impl(&conn, "img-1", &tag_id);
        assert!(result.is_err()); // UNIQUE constraint violation

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM image_tags WHERE image_id = 'img-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }
}
