use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};

use rusqlite::params;
use uuid::Uuid;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};
use crate::metadata;
use crate::schema::types::{ImageRecord, ImportResult};

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
) -> AppResult<ImportResult> {
    let entries = scan_folder(&path)?;
    let total_scanned = entries.len() as u32;
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let tx = conn.unchecked_transaction()?;
    let mut imported = Vec::with_capacity(entries.len());
    let mut skipped: u32 = 0;
    for entry in &entries {
        if insert_image(&tx, entry)? {
            imported.push(load_record(&tx, &entry.id)?);
        } else {
            skipped += 1;
        }
    }
    tx.commit()?;
    Ok(ImportResult {
        imported: imported.len() as u32,
        skipped,
        total_scanned,
        items: imported,
    })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

pub(crate) struct ImportEntry {
    pub(crate) id: String,
    pub(crate) file_path: String,
    pub(crate) file_hash: String,
    pub(crate) file_size_kb: i64,
    pub(crate) width: Option<i32>,
    pub(crate) height: Option<i32>,
    pub(crate) format: String,
    pub(crate) created_at: String,
    pub(crate) metadata_json: Option<String>,
}

pub(crate) fn scan_folder(root: &str) -> std::io::Result<Vec<ImportEntry>> {
    let root_path = std::path::Path::new(root);
    if root_path.is_file() {
        let ext = root.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
        if !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            return Ok(vec![]);
        }
        let meta = fs::metadata(root)?;
        let hash = file_hash(root, meta.len());
        let (w, h, meta_json) = if ext == "gif" {
            let (w, h) = probe_gif(root);
            (w, h, None)
        } else {
            let mut buf = vec![0u8; 65536];
            let n = std::fs::File::open(root)
                .and_then(|f| {
                    use std::io::Read;
                    let mut r = std::io::BufReader::new(f);
                    r.read(&mut buf)
                })
                .unwrap_or(0);
            buf.truncate(n);
            let (w, h) = probe_dimensions_from_bytes(&buf, &ext);
            let meta_json = metadata::probe_metadata_from_bytes(&buf, &ext);
            (w, h, meta_json)
        };
        let created = chrono::DateTime::<chrono::Utc>::from(
            meta.modified().unwrap_or(meta.created().unwrap()),
        )
        .to_rfc3339();
        return Ok(vec![ImportEntry {
            id: Uuid::new_v4().to_string(),
            file_path: root.to_string(),
            file_hash: hash,
            width: w,
            height: h,
            file_size_kb: meta.len() as i64,
            format: ext,
            created_at: created,
            metadata_json: meta_json,
        }]);
    }

    let mut entries = Vec::new();
    for entry in walk_dir(root)? {
        let ext = entry.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
        if !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }
        let meta = fs::metadata(&entry)?;
        let hash = file_hash(&entry, meta.len());

        let (w, h, meta_json) = if ext == "gif" {
            let (w, h) = probe_gif(&entry);
            (w, h, None)
        } else {
            let mut buf = vec![0u8; 65536];
            let n = std::fs::File::open(&entry)
                .and_then(|f| {
                    use std::io::Read;
                    let mut r = std::io::BufReader::new(f);
                    r.read(&mut buf)
                })
                .unwrap_or(0);
            buf.truncate(n);
            let (w, h) = probe_dimensions_from_bytes(&buf, &ext);
            let meta_json = metadata::probe_metadata_from_bytes(&buf, &ext);
            (w, h, meta_json)
        };

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
            metadata_json: meta_json,
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

/// Extract dimensions from an already-loaded byte buffer.
pub fn probe_dimensions_from_bytes(bytes: &[u8], ext: &str) -> (Option<i32>, Option<i32>) {
    if bytes.len() < 32 {
        return (None, None);
    }
    match ext {
        "png" => probe_png(bytes),
        "jpg" | "jpeg" => probe_jpeg(bytes),
        "webp" => probe_webp(bytes),
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
    let mut buf = vec![0u8; 10];
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        _ => return (None, None),
    };
    use std::io::Read;
    let mut reader = std::io::BufReader::new(file);
    let n = reader.read(&mut buf).unwrap_or(0);
    buf.truncate(n);
    if buf.len() < 10 {
        return (None, None);
    }
    let bytes = buf;
    if &bytes[..3] != b"GIF" {
        return (None, None);
    }
    let w = u16::from_le_bytes([bytes[6], bytes[7]]) as i32;
    let h = u16::from_le_bytes([bytes[8], bytes[9]]) as i32;
    (Some(w), Some(h))
}

/// Find an existing variant group for the given prompt, or create a new one.
pub(crate) fn find_or_create_variant_group(
    conn: &rusqlite::Connection,
    prompt: &str,
) -> Result<String, rusqlite::Error> {
    if let Ok(group_id) = conn.query_row(
        "SELECT id FROM variant_groups WHERE prompt = ?1",
        params![prompt],
        |r| r.get::<_, String>(0),
    ) {
        return Ok(group_id);
    }
    let group_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO variant_groups (id, prompt) VALUES (?1, ?2)",
        params![group_id, prompt],
    )?;
    Ok(group_id)
}

pub(crate) fn insert_image(
    conn: &rusqlite::Connection,
    entry: &ImportEntry,
) -> Result<bool, rusqlite::Error> {
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
    if changed > 0 {
        if let Some(ref json) = entry.metadata_json {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json) {
                if let Some(prompt) = parsed.get("prompt").and_then(|v| v.as_str()) {
                    if !prompt.is_empty() {
                        if let Ok(group_id) = find_or_create_variant_group(conn, prompt) {
                            if let Err(e) = conn.execute(
                                "UPDATE images SET variant_group_id = ?1 WHERE id = ?2",
                                params![group_id, entry.id],
                            ) {
                                log::warn!(
                                    "Failed to assign variant group for image {}: {}",
                                    entry.id,
                                    e
                                );
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(changed > 0)
}

pub(crate) fn load_record(
    conn: &rusqlite::Connection,
    id: &str,
) -> Result<ImageRecord, rusqlite::Error> {
    conn.query_row(
        "SELECT * FROM images WHERE id = ?1",
        params![id],
        crate::schema::types::row_to_record,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> crate::db::DbHandle {
        crate::db::DbHandle::open_memory().unwrap()
    }

    #[test]
    fn insert_and_load_roundtrip() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
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
        let db = test_db();
        let conn = db.conn().lock().unwrap();
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
    fn variant_groups_created_for_same_prompt() {
        use crate::db::migrations::run_migrations;
        use rusqlite::Connection;

        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let tx = conn.unchecked_transaction().unwrap();

        let e1 = ImportEntry {
            id: "v1".into(),
            file_path: "/a.png".into(),
            file_hash: "h1".into(),
            file_size_kb: 100,
            width: Some(512),
            height: Some(512),
            format: "png".into(),
            created_at: "2024-01-01".into(),
            metadata_json: Some(r#"{"prompt":"a cat","seed":1,"source":"a1111"}"#.into()),
        };
        let e2 = ImportEntry {
            id: "v2".into(),
            file_path: "/b.png".into(),
            file_hash: "h2".into(),
            file_size_kb: 100,
            width: Some(512),
            height: Some(512),
            format: "png".into(),
            created_at: "2024-01-01".into(),
            metadata_json: Some(r#"{"prompt":"a cat","seed":2,"source":"a1111"}"#.into()),
        };

        insert_image(&tx, &e1).unwrap();
        insert_image(&tx, &e2).unwrap();
        tx.commit().unwrap();

        let vg1: Option<String> = conn
            .query_row(
                "SELECT variant_group_id FROM images WHERE id='v1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let vg2: Option<String> = conn
            .query_row(
                "SELECT variant_group_id FROM images WHERE id='v2'",
                [],
                |r| r.get(0),
            )
            .unwrap();

        assert!(vg1.is_some());
        assert_eq!(vg1, vg2);
    }

    #[test]
    fn different_prompts_get_different_variant_groups() {
        use crate::db::migrations::run_migrations;
        use rusqlite::Connection;

        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let tx = conn.unchecked_transaction().unwrap();

        let e1 = ImportEntry {
            id: "d1".into(),
            file_path: "/d1.png".into(),
            file_hash: "dh1".into(),
            file_size_kb: 100,
            width: Some(512),
            height: Some(512),
            format: "png".into(),
            created_at: "2024-01-01".into(),
            metadata_json: Some(r#"{"prompt":"a dog","seed":1}"#.into()),
        };
        let e2 = ImportEntry {
            id: "d2".into(),
            file_path: "/d2.png".into(),
            file_hash: "dh2".into(),
            file_size_kb: 100,
            width: Some(512),
            height: Some(512),
            format: "png".into(),
            created_at: "2024-01-01".into(),
            metadata_json: Some(r#"{"prompt":"a cat","seed":1}"#.into()),
        };

        insert_image(&tx, &e1).unwrap();
        insert_image(&tx, &e2).unwrap();
        tx.commit().unwrap();

        let vg1: Option<String> = conn
            .query_row(
                "SELECT variant_group_id FROM images WHERE id='d1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let vg2: Option<String> = conn
            .query_row(
                "SELECT variant_group_id FROM images WHERE id='d2'",
                [],
                |r| r.get(0),
            )
            .unwrap();

        assert!(vg1.is_some());
        assert!(vg2.is_some());
        assert_ne!(vg1, vg2);
    }

    #[test]
    fn no_prompt_means_no_variant_group() {
        use crate::db::migrations::run_migrations;
        use rusqlite::Connection;

        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let tx = conn.unchecked_transaction().unwrap();

        let e1 = ImportEntry {
            id: "np1".into(),
            file_path: "/np1.png".into(),
            file_hash: "nh1".into(),
            file_size_kb: 100,
            width: Some(512),
            height: Some(512),
            format: "png".into(),
            created_at: "2024-01-01".into(),
            metadata_json: None,
        };

        insert_image(&tx, &e1).unwrap();
        tx.commit().unwrap();

        let vg: Option<String> = conn
            .query_row(
                "SELECT variant_group_id FROM images WHERE id='np1'",
                [],
                |r| r.get(0),
            )
            .unwrap();

        assert!(vg.is_none());
    }

    #[test]
    fn scan_folder_handles_single_file() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("lumora_test_single.png");

        let png_data: Vec<u8> = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49,
            0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00,
            0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54,
            0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21,
            0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        std::fs::write(&test_file, &png_data).unwrap();

        let result = scan_folder(test_file.to_str().unwrap());
        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].format, "png");
        assert!(entries[0].file_path.contains("lumora_test_single.png"));

        let _ = std::fs::remove_file(test_file);
    }

    #[test]
    fn scan_folder_rejects_non_image_file() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("lumora_test_invalid.txt");
        std::fs::write(&test_file, "not an image").unwrap();

        let result = scan_folder(test_file.to_str().unwrap());
        assert!(result.is_ok());
        let entries = result.unwrap();
        assert_eq!(entries.len(), 0);

        let _ = std::fs::remove_file(test_file);
    }
}
