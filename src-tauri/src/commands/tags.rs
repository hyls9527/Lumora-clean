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
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
        params![id, name, color],
    )
    .map_err(|e| e.to_string())?;
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
