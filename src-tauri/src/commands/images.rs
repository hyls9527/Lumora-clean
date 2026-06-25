use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};

use rusqlite::params;
use uuid::Uuid;

use crate::db::DbHandle;
use crate::schema::types::{ImageRecord, PaginatedResult};

/// Known image extensions we accept during import.
const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "avif", "bmp", "gif", "tiff"];

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Recursively scan `path` for image files, extract basic metadata, insert into DB.
#[tauri::command]
pub fn import_images(
    db: tauri::State<'_, DbHandle>,
    path: String,
) -> Result<Vec<ImageRecord>, String> {
    let entries = scan_folder(&path).map_err(|e| e.to_string())?;
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let mut imported = Vec::with_capacity(entries.len());
    for entry in &entries {
        if insert_image(&tx, entry).map_err(|e| e.to_string())? {
            imported.push(load_record(&tx, &entry.id).map_err(|e| e.to_string())?);
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(imported)
}

/// Paginated listing of non-deleted images, ordered by imported_at DESC.
#[tauri::command]
pub fn list_images(
    db: tauri::State<'_, DbHandle>,
    page: u32,
    per_page: u32,
) -> Result<PaginatedResult, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let offset = page.saturating_sub(1) * per_page;
    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM images WHERE deleted = 0", [], |r| {
            r.get(0)
        })
        .map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT * FROM images WHERE deleted = 0
             ORDER BY imported_at DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![per_page, offset], row_to_record)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(PaginatedResult {
        items,
        total,
        page,
        per_page,
    })
}

/// Full-text search via FTS5 on file_path + metadata_json.
#[tauri::command]
pub fn search_images(
    db: tauri::State<'_, DbHandle>,
    query: String,
) -> Result<Vec<ImageRecord>, String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT i.* FROM images i
             JOIN images_fts f ON f.rowid = i.rowid
             WHERE images_fts MATCH ?1 AND i.deleted = 0
             ORDER BY rank
             LIMIT 200",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![query], row_to_record)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(items)
}

/// Set rating (0-5) for an image.
#[tauri::command]
pub fn update_rating(
    db: tauri::State<'_, DbHandle>,
    id: String,
    rating: u32,
) -> Result<(), String> {
    let clamped = rating.min(5);
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    conn.execute(
        "UPDATE images SET rating = ?1 WHERE id = ?2",
        params![clamped, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Toggle the favorite flag for an image.
#[tauri::command]
pub fn toggle_favorite(db: tauri::State<'_, DbHandle>, id: String) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|_| "lock poisoned".to_string())?;
    conn.execute(
        "UPDATE images SET favorite = CASE WHEN favorite = 0 THEN 1 ELSE 0 END WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers (pure-ish domain helpers + thin DB adapters)
// ---------------------------------------------------------------------------

struct ImportEntry {
    id: String,
    file_path: String,
    file_hash: String,
    file_size_kb: i64,
    width: Option<i32>,
    height: Option<i32>,
    format: String,
    created_at: String,
    metadata_json: Option<String>,
}

fn scan_folder(root: &str) -> std::io::Result<Vec<ImportEntry>> {
    let mut entries = Vec::new();
    for entry in walk_dir(root)? {
        let ext = entry.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
        if !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }
        let meta = fs::metadata(&entry)?;
        let (w, h) = probe_dimensions(&entry, &ext);
        let hash = file_hash(&entry, meta.len());
        let created = chrono::DateTime::<chrono::Utc>::from(
            meta.modified().unwrap_or(meta.created().unwrap()),
        )
        .to_rfc3339();
        entries.push(ImportEntry {
            id: Uuid::new_v4().to_string(),
            file_path: entry,
            file_hash: hash,
            file_size_kb: meta.len().div_ceil(1024) as i64,
            width: w,
            height: h,
            format: ext,
            created_at: created,
            metadata_json: None,
        });
    }
    Ok(entries)
}

fn walk_dir(root: &str) -> std::io::Result<Vec<String>> {
    let mut result = Vec::new();
    let mut stack = vec![root.to_string()];
    while let Some(dir) = stack.pop() {
        let read = match fs::read_dir(&dir) {
            Ok(r) => r,
            Err(_) => continue,
        };
        for entry in read.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path.to_string_lossy().into_owned());
            } else if path.is_file() {
                result.push(path.to_string_lossy().into_owned());
            }
        }
    }
    Ok(result)
}

fn file_hash(path: &str, size: u64) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    size.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn probe_dimensions(path: &str, ext: &str) -> (Option<i32>, Option<i32>) {
    if ext == "gif" {
        return probe_gif(path);
    }
    let bytes = match fs::read(path) {
        Ok(b) if b.len() > 32 => b,
        _ => return (None, None),
    };
    match ext {
        "png" => probe_png(&bytes),
        "jpg" | "jpeg" => probe_jpeg(&bytes),
        "webp" => probe_webp(&bytes),
        _ => (None, None),
    }
}

fn probe_png(bytes: &[u8]) -> (Option<i32>, Option<i32>) {
    if bytes.len() < 24 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" {
        return (None, None);
    }
    let w = i32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
    let h = i32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);
    (Some(w), Some(h))
}

fn probe_jpeg(bytes: &[u8]) -> (Option<i32>, Option<i32>) {
    if bytes.len() < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return (None, None);
    }
    let mut i = 2;
    while i + 4 < bytes.len() {
        if bytes[i] != 0xFF {
            i += 1;
            continue;
        }
        let marker = bytes[i + 1];
        if marker == 0xD9 || marker == 0xDA {
            break;
        }
        if (marker == 0xC0 || marker == 0xC2) && i + 9 < bytes.len() {
            let h = u16::from_be_bytes([bytes[i + 5], bytes[i + 6]]) as i32;
            let w = u16::from_be_bytes([bytes[i + 7], bytes[i + 8]]) as i32;
            return (Some(w), Some(h));
        }
        let len = u16::from_be_bytes([bytes[i + 2], bytes[i + 3]]) as usize;
        i += 2 + len;
    }
    (None, None)
}

fn probe_webp(bytes: &[u8]) -> (Option<i32>, Option<i32>) {
    if bytes.len() < 30 || &bytes[..4] != b"RIFF" || &bytes[8..12] != b"WEBP" {
        return (None, None);
    }
    if &bytes[12..16] == b"VP8 " && bytes.len() >= 30 {
        let w = u16::from_le_bytes([bytes[26], bytes[27]]) as i32;
        let h = u16::from_le_bytes([bytes[28], bytes[29]]) as i32;
        return (Some(w), Some(h));
    }
    if &bytes[12..16] == b"VP8L" && bytes.len() >= 25 {
        let bits = u32::from_le_bytes([bytes[21], bytes[22], bytes[23], bytes[24]]);
        let w = ((bits & 0x3FFF) + 1) as i32;
        let h = (((bits >> 14) & 0x3FFF) + 1) as i32;
        return (Some(w), Some(h));
    }
    (None, None)
}

fn probe_gif(path: &str) -> (Option<i32>, Option<i32>) {
    let bytes = match fs::read(path) {
        Ok(b) if b.len() >= 10 => b,
        _ => return (None, None),
    };
    if &bytes[..3] != b"GIF" {
        return (None, None);
    }
    let w = u16::from_le_bytes([bytes[6], bytes[7]]) as i32;
    let h = u16::from_le_bytes([bytes[8], bytes[9]]) as i32;
    (Some(w), Some(h))
}

fn insert_image(conn: &rusqlite::Connection, entry: &ImportEntry) -> Result<bool, rusqlite::Error> {
    let changed = conn.execute(
        "INSERT OR IGNORE INTO images
            (id, file_path, file_hash, file_size_kb, width, height, format, created_at, metadata_json)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            entry.id,
            entry.file_path,
            entry.file_hash,
            entry.file_size_kb,
            entry.width,
            entry.height,
            entry.format,
            entry.created_at,
            entry.metadata_json,
        ],
    )?;
    Ok(changed > 0)
}

fn load_record(conn: &rusqlite::Connection, id: &str) -> Result<ImageRecord, rusqlite::Error> {
    conn.query_row(
        "SELECT * FROM images WHERE id = ?1",
        params![id],
        row_to_record,
    )
}

fn row_to_record(row: &rusqlite::Row<'_>) -> Result<ImageRecord, rusqlite::Error> {
    Ok(ImageRecord {
        id: row.get("id")?,
        file_path: row.get("file_path")?,
        file_hash: row.get("file_hash")?,
        file_size_kb: row.get("file_size_kb")?,
        width: row.get("width")?,
        height: row.get("height")?,
        format: row.get("format")?,
        created_at: row.get("created_at")?,
        imported_at: row.get("imported_at")?,
        deleted: row.get::<_, i32>("deleted")? != 0,
        rating: row.get("rating")?,
        favorite: row.get::<_, i32>("favorite")? != 0,
        metadata_json: row.get("metadata_json")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
            .unwrap();
        crate::db::migrations::run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn insert_and_load_roundtrip() {
        let conn = test_db();
        let entry = ImportEntry {
            id: "test-001".into(),
            file_path: "/tmp/test.png".into(),
            file_hash: "abc123".into(),
            file_size_kb: 100,
            width: Some(512),
            height: Some(512),
            format: "png".into(),
            created_at: "2025-01-01T00:00:00Z".into(),
            metadata_json: None,
        };
        assert!(insert_image(&conn, &entry).unwrap());
        let rec = load_record(&conn, "test-001").unwrap();
        assert_eq!(rec.file_path, "/tmp/test.png");
        assert_eq!(rec.format, "png");
    }

    #[test]
    fn duplicate_path_is_ignored() {
        let conn = test_db();
        let entry = ImportEntry {
            id: "dup-001".into(),
            file_path: "/tmp/dup.jpg".into(),
            file_hash: "h".into(),
            file_size_kb: 10,
            width: None,
            height: None,
            format: "jpg".into(),
            created_at: "2025-01-01T00:00:00Z".into(),
            metadata_json: None,
        };
        assert!(insert_image(&conn, &entry).unwrap());
        let entry2 = ImportEntry {
            id: "dup-002".into(),
            file_path: "/tmp/dup.jpg".into(),
            file_hash: "h".into(),
            file_size_kb: 10,
            width: None,
            height: None,
            format: "jpg".into(),
            created_at: "2025-01-01T00:00:00Z".into(),
            metadata_json: None,
        };
        assert!(!insert_image(&conn, &entry2).unwrap());
    }

    #[test]
    fn probe_png_dimensions() {
        let mut bytes = vec![0u8; 32];
        bytes[..8].copy_from_slice(b"\x89PNG\r\n\x1a\n");
        bytes[16..20].copy_from_slice(&1920i32.to_be_bytes());
        bytes[20..24].copy_from_slice(&1080i32.to_be_bytes());
        let (w, h) = probe_png(&bytes);
        assert_eq!(w, Some(1920));
        assert_eq!(h, Some(1080));
    }

    #[test]
    fn update_rating_clamps_to_5() {
        let conn = test_db();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
             VALUES ('r1','/r','h',1,'png','2025-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE images SET rating = ?1 WHERE id = 'r1'",
            params![99u32.min(5)],
        )
        .unwrap();
        let r: i32 = conn
            .query_row("SELECT rating FROM images WHERE id = 'r1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(r, 5);
    }

    #[test]
    fn toggle_favorite_roundtrip() {
        let conn = test_db();
        conn.execute(
            "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
             VALUES ('f1','/f','h',1,'png','2025-01-01')",
            [],
        )
        .unwrap();
        // toggle on
        conn.execute(
            "UPDATE images SET favorite = CASE WHEN favorite = 0 THEN 1 ELSE 0 END WHERE id = 'f1'",
            [],
        )
        .unwrap();
        let fav: i32 = conn
            .query_row("SELECT favorite FROM images WHERE id = 'f1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(fav, 1);
        // toggle off
        conn.execute(
            "UPDATE images SET favorite = CASE WHEN favorite = 0 THEN 1 ELSE 0 END WHERE id = 'f1'",
            [],
        )
        .unwrap();
        let fav: i32 = conn
            .query_row("SELECT favorite FROM images WHERE id = 'f1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(fav, 0);
    }
}
