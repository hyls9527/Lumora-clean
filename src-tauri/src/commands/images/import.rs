use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

use image::GenericImageView;
use rusqlite::params;
use tauri::Manager;
use tauri_plugin_store::StoreExt;
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
///
/// Import mode comes from the `store_mode` setting:
/// - `"copy"` — copy each image into the managed library directory
///   (`<app_data>/library`); the app owns those files.
/// - anything else (default) — reference files in place; the app only records paths.
#[tauri::command]
pub fn import_images(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbHandle>,
    path: String,
) -> AppResult<ImportResult> {
    let entries = scan_folder(&path)?;
    let copy_mode = app
        .store("settings.json")
        .ok()
        .and_then(|s| {
            s.get("store_mode")
                .and_then(|v| v.as_str().map(String::from))
        })
        .is_some_and(|m| m == "copy");
    let library_dir = if copy_mode {
        Some(
            app.path()
                .app_data_dir()
                .map_err(|e| AppError::External(format!("failed to resolve app data dir: {e}")))?
                .join("library"),
        )
    } else {
        None
    };
    let total_scanned = entries.len() as u32;
    let (accepted, rejected) = partition_grids(&entries);
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let tx = conn.unchecked_transaction()?;
    let mut copied: Vec<PathBuf> = Vec::new();
    let result = run_import(&tx, &accepted, library_dir.as_deref(), &mut copied);
    match result {
        Ok((imported, skipped)) => {
            if let Err(e) = tx.commit() {
                // The rows are rolled back — the library copies made for them
                // would be orphaned files, so remove them again.
                remove_files_quietly(&copied);
                return Err(e.into());
            }
            Ok(ImportResult {
                imported: imported.len() as u32,
                skipped,
                rejected,
                total_scanned,
                items: imported,
            })
        }
        Err(e) => {
            remove_files_quietly(&copied);
            Err(e)
        }
    }
}

/// Reference-mode import for AI agents via MCP: scans `root`, applies the same
/// grid gate, inserts rows without moving/copying files.
pub fn import_folder_gated(db: &DbHandle, root: &str) -> AppResult<ImportResult> {
    let entries = scan_folder(root)?;
    let (accepted, rejected) = partition_grids(&entries);
    let total_scanned = entries.len() as u32;
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let tx = conn.unchecked_transaction()?;
    let (imported, skipped) = run_import(&tx, &accepted, None, &mut Vec::new())?;
    if let Err(e) = tx.commit() {
        return Err(e.into());
    }
    Ok(ImportResult {
        imported: imported.len() as u32,
        skipped,
        rejected,
        total_scanned,
        items: imported,
    })
}

/// Split scanned entries into (accepted singles, count of rejected 2x2 grids).
fn partition_grids(entries: &[ImportEntry]) -> (Vec<ImportEntry>, u32) {
    let mut accepted = Vec::with_capacity(entries.len());
    let mut rejected = 0u32;
    for e in entries {
        if looks_like_grid(Path::new(&e.file_path)) {
            rejected += 1;
        } else {
            accepted.push(e.clone());
        }
    }
    (accepted, rejected)
}

/// Cheap local heuristic gate: a Midjourney-style 2x2 grid shows a light gutter
/// seam down the vertical AND horizontal centre, brighter than the four
/// quadrant centres. Used to refuse 4-in-one images at the library boundary.
/// (Free, no external vision call; our free GLM pipeline does the stronger check.)
fn looks_like_grid(path: &Path) -> bool {
    let img = match image::open(path) {
        Ok(i) => i,
        Err(_) => return false,
    };
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 {
        return false;
    }
    let small = img.resize(64, 64, image::imageops::FilterType::Triangle).to_luma8();
    let avg = |x0: u32, y0: u32, x1: u32, y1: u32| -> f64 {
        let (mut s, mut n) = (0.0f64, 0u32);
        for y in y0..y1 {
            for x in x0..x1 {
                s += small.get_pixel(x, y)[0] as f64;
                n += 1;
            }
        }
        if n == 0 { 0.0 } else { s / n as f64 }
    };
    let quad = (avg(8, 8, 24, 24) + avg(40, 8, 56, 24) + avg(8, 40, 24, 56) + avg(40, 40, 56, 56)) / 4.0;
    let seam = (avg(31, 8, 33, 56) + avg(8, 31, 56, 33)) / 2.0;
    seam > quad + 12.0
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Core import loop, decoupled from the Tauri app handle so tests can drive it.
///
/// `library_dir` enables copy-mode (files are copied into the managed library
/// before insertion). Every copied file is pushed onto `copied` so the caller
/// can remove them again if the import fails — otherwise they would linger as
/// orphaned files that no DB row references.
fn run_import(
    tx: &rusqlite::Transaction<'_>,
    entries: &[ImportEntry],
    library_dir: Option<&Path>,
    copied: &mut Vec<PathBuf>,
) -> AppResult<(Vec<ImageRecord>, u32)> {
    let mut imported = Vec::with_capacity(entries.len());
    let mut skipped: u32 = 0;
    for entry in entries {
        let mut file_path = entry.file_path.clone();
        let mut copied_path: Option<PathBuf> = None;
        if let Some(dir) = library_dir {
            // Copy-mode dedup: identical content is already registered.
            // Checked inside the open transaction, so duplicates within one
            // batch are caught too — re-importing the same library must not
            // pile up duplicated copies.
            let exists: i64 = tx.query_row(
                "SELECT COUNT(*) FROM images WHERE file_hash = ?1",
                params![entry.file_hash],
                |r| r.get(0),
            )?;
            if exists > 0 {
                skipped += 1;
                continue;
            }
            match copy_into_library_dir(dir, &entry.file_path, &entry.format) {
                Ok(stored) => {
                    copied_path = Some(PathBuf::from(&stored));
                    file_path = stored;
                }
                Err(e) => {
                    log::warn!("copy import failed for {}: {}", entry.file_path, e);
                    skipped += 1;
                    continue;
                }
            }
        }
        let entry = ImportEntry {
            file_path,
            ..entry.clone()
        };
        match insert_image(tx, &entry) {
            Ok(true) => {
                imported.push(load_record(tx, &entry.id)?);
                // Hand ownership of the copy to the caller, which removes it
                // if the surrounding transaction later fails to commit.
                if let Some(p) = copied_path {
                    copied.push(p);
                }
            }
            Ok(false) => {
                // INSERT OR IGNORE skipped the row (path/hash already
                // registered) — the fresh copy would be orphaned.
                if let Some(p) = copied_path {
                    remove_files_quietly(std::slice::from_ref(&p));
                }
                skipped += 1;
            }
            Err(e) => {
                if let Some(p) = copied_path {
                    remove_files_quietly(std::slice::from_ref(&p));
                }
                return Err(e.into());
            }
        }
    }
    Ok((imported, skipped))
}

/// Best-effort cleanup of library copies made for a failed import.
fn remove_files_quietly(paths: &[PathBuf]) {
    for p in paths {
        if let Err(e) = fs::remove_file(p) {
            log::warn!("failed to clean up imported copy {}: {}", p.display(), e);
        }
    }
}

#[derive(Clone)]
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

/// Pick a unique destination path inside `dir` for `src`, appending a
/// numeric suffix when the basename is already taken.
fn resolve_library_path(dir: &Path, src: &str, format: &str) -> PathBuf {
    let base = Path::new(src)
        .file_stem()
        .and_then(|s| s.to_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("image");
    let mut target = dir.join(format!("{base}.{format}"));
    let mut n = 1;
    while target.exists() {
        target = dir.join(format!("{base}-{n}.{format}"));
        n += 1;
    }
    target
}

/// Copy an image into the managed library directory, picking a unique
/// destination name when the basename is already taken on disk.
fn copy_into_library_dir(dir: &Path, src: &str, format: &str) -> AppResult<String> {
    fs::create_dir_all(dir)
        .map_err(|e| AppError::Io(format!("failed to create library dir: {e}")))?;
    let target = resolve_library_path(dir, src, format);
    fs::copy(src, &target).map_err(|e| AppError::Io(format!("failed to copy {src}: {e}")))?;
    Ok(target.to_string_lossy().into_owned())
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
        let created = file_created_at(&meta);
        return Ok(vec![ImportEntry {
            id: Uuid::new_v4().to_string(),
            file_path: root.to_string(),
            file_hash: hash,
            width: w,
            height: h,
            file_size_kb: meta.len().div_ceil(1024) as i64,
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
        // The file may vanish (or be unreadable) between listing and stat:
        // skip it rather than aborting the whole directory import.
        let meta = match fs::metadata(&entry) {
            Ok(m) => m,
            Err(e) => {
                log::warn!("skipping {}: {}", entry, e);
                continue;
            }
        };
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

        let created = file_created_at(&meta);
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
            let file_type = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };
            // Never follow symlinks: a link cycle would recurse forever.
            if file_type.is_symlink() {
                continue;
            }
            let path = entry.path();
            if file_type.is_dir() {
                stack.push(path.to_string_lossy().into_owned());
            } else if file_type.is_file() {
                result.push(path.to_string_lossy().into_owned());
            }
        }
    }
    Ok(result)
}

/// Best available file timestamp as an RFC 3339 string.
///
/// Prefers `modified` (universally available), falls back to `created`
/// (unavailable on some filesystems), then to the current time. Never
/// panics — note that `a.unwrap_or(b.unwrap())` evaluates `b.unwrap()`
/// eagerly even when `a` succeeded.
fn file_created_at(meta: &fs::Metadata) -> String {
    meta.modified()
        .or_else(|_| meta.created())
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339())
        .unwrap_or_else(|_| chrono::Utc::now().to_rfc3339())
}

fn file_hash(path: &str, size: u64) -> String {
    let mut hasher = DefaultHasher::new();
    size.hash(&mut hasher);
    // Content-based: hash the first 64KB so identical files deduplicate
    // regardless of path, while different content is not collapsed.
    let mut buf = [0u8; 65536];
    let n = std::fs::File::open(path)
        .and_then(|mut f| {
            use std::io::Read;
            f.read(&mut buf)
        })
        .unwrap_or(0);
    buf[..n].hash(&mut hasher);
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
    fn library_path_resolves_conflicts_with_suffix() {
        let dir = tempfile::tempdir().unwrap();
        let p1 = resolve_library_path(dir.path(), "/src/photo.png", "png");
        assert_eq!(p1.file_name().unwrap().to_string_lossy(), "photo.png");
        std::fs::write(&p1, b"1").unwrap();
        let p2 = resolve_library_path(dir.path(), "/src/photo.png", "png");
        assert_eq!(p2.file_name().unwrap().to_string_lossy(), "photo-1.png");
        std::fs::write(&p2, b"2").unwrap();
        let p3 = resolve_library_path(dir.path(), "/src/photo.png", "png");
        assert_eq!(p3.file_name().unwrap().to_string_lossy(), "photo-2.png");
        // different format keeps its own name namespace
        let jpg = resolve_library_path(dir.path(), "/src/photo.jpg", "jpg");
        assert_eq!(jpg.file_name().unwrap().to_string_lossy(), "photo.jpg");
        // extensionless source keeps its name as the base
        let fallback = resolve_library_path(dir.path(), "/src/unknown", "png");
        assert_eq!(
            fallback.file_name().unwrap().to_string_lossy(),
            "unknown.png"
        );
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
    fn probe_jpeg_dimensions() {
        let mut bytes = vec![0u8; 64];
        bytes[0] = 0xFF;
        bytes[1] = 0xD8;
        bytes[2] = 0xFF;
        bytes[3] = 0xE0;
        bytes[4] = 0x00;
        bytes[5] = 0x10; // APP0 segment length 16 -> SOF0 at offset 20
        let sof = 20;
        bytes[sof] = 0xFF;
        bytes[sof + 1] = 0xC0;
        bytes[sof + 2] = 0x00;
        bytes[sof + 3] = 0x11;
        bytes[sof + 4] = 0x08;
        let h = 1080u16;
        let w = 1920u16;
        bytes[sof + 5] = (h >> 8) as u8;
        bytes[sof + 6] = h as u8;
        bytes[sof + 7] = (w >> 8) as u8;
        bytes[sof + 8] = w as u8;

        let (w2, h2) = probe_jpeg(&bytes);
        assert_eq!(w2, Some(1920));
        assert_eq!(h2, Some(1080));
    }

    #[test]
    fn probe_webp_dimensions() {
        let mut bytes = vec![0u8; 64];
        bytes[..4].copy_from_slice(b"RIFF");
        bytes[8..12].copy_from_slice(b"WEBP");
        bytes[12..16].copy_from_slice(b"VP8 ");
        let w = 640u16;
        let h = 480u16;
        bytes[26] = w as u8;
        bytes[27] = (w >> 8) as u8;
        bytes[28] = h as u8;
        bytes[29] = (h >> 8) as u8;

        let (w2, h2) = probe_webp(&bytes);
        assert_eq!(w2, Some(640));
        assert_eq!(h2, Some(480));
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
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
            0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
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

    #[test]
    fn file_hash_is_content_based() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.png");
        let b = dir.path().join("sub").join("b.png");
        std::fs::create_dir_all(dir.path().join("sub")).unwrap();
        std::fs::write(&a, b"same-content-12345").unwrap();
        std::fs::write(&b, b"same-content-12345").unwrap();

        assert_eq!(
            file_hash(a.to_str().unwrap(), 17),
            file_hash(b.to_str().unwrap(), 17)
        );

        let c = dir.path().join("c.png");
        std::fs::write(&c, b"different-content").unwrap();
        assert_ne!(
            file_hash(a.to_str().unwrap(), 17),
            file_hash(c.to_str().unwrap(), 17)
        );
    }

    #[test]
    fn walk_dir_skips_symlinked_directories() {
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("real");
        std::fs::create_dir_all(&real).unwrap();
        std::fs::write(real.join("img.png"), b"x").unwrap();

        // Create a symlink back to the root. If creation is unsupported
        // (e.g. Windows without developer mode), skip gracefully.
        let link = dir.path().join("loop");
        #[cfg(windows)]
        let created = std::os::windows::fs::symlink_dir(&real, &link).is_ok();
        #[cfg(not(windows))]
        let created = std::os::unix::fs::symlink(&real, &link).is_ok();

        if !created {
            eprintln!("symlink creation unsupported; skipping walk_dir cycle test");
            return;
        }

        let files = walk_dir(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(files.len(), 1);
        assert!(files[0].contains("real"));
        assert!(!files[0].contains("loop"));
    }

    fn make_entry(id: &str, path: &str, hash: &str) -> ImportEntry {
        ImportEntry {
            id: id.into(),
            file_path: path.into(),
            file_hash: hash.into(),
            file_size_kb: 1,
            width: None,
            height: None,
            format: "png".into(),
            created_at: "2025-01-01T00:00:00Z".into(),
            metadata_json: None,
        }
    }

    #[test]
    fn copy_into_library_dir_copies_content_and_resolves_conflicts() {
        let dir = tempfile::tempdir().unwrap();
        let src_dir = tempfile::tempdir().unwrap();
        let src = src_dir.path().join("cat.png");
        std::fs::write(&src, b"image-bytes").unwrap();

        let stored = copy_into_library_dir(dir.path(), src.to_str().unwrap(), "png").unwrap();
        assert!(Path::new(&stored).exists());
        assert_eq!(std::fs::read(&stored).unwrap(), b"image-bytes");

        // Same basename again → suffixed copy, never an overwrite.
        let stored2 = copy_into_library_dir(dir.path(), src.to_str().unwrap(), "png").unwrap();
        assert_ne!(Path::new(&stored), Path::new(&stored2));
        assert!(Path::new(&stored2).exists());
        assert_eq!(std::fs::read(&stored2).unwrap(), b"image-bytes");
    }

    #[test]
    fn run_import_copy_mode_dedupes_by_hash_within_batch() {
        let dir = tempfile::tempdir().unwrap();
        let lib = dir.path().join("library");
        let a = dir.path().join("a.png");
        let b = dir.path().join("b.png");
        std::fs::write(&a, b"same-bytes").unwrap();
        std::fs::write(&b, b"same-bytes").unwrap();

        let meta = fs::metadata(&a).unwrap();
        let hash = file_hash(a.to_str().unwrap(), meta.len());
        let entries = vec![
            make_entry("e1", a.to_str().unwrap(), &hash),
            make_entry("e2", b.to_str().unwrap(), &hash),
        ];

        let db = test_db();
        let conn = db.conn().lock().unwrap();
        let tx = conn.unchecked_transaction().unwrap();
        let mut copied = Vec::new();
        let (imported, skipped) = run_import(&tx, &entries, Some(&lib), &mut copied).unwrap();

        // Identical content must import exactly once — no duplicated copies.
        assert_eq!(imported.len(), 1);
        assert_eq!(skipped, 1);
        assert_eq!(copied.len(), 1);
        assert!(fs::read_dir(&lib).unwrap().count() == 1);
        assert!(imported[0].file_path.starts_with(lib.to_str().unwrap()));
        tx.commit().unwrap();
    }

    #[test]
    fn run_import_copy_mode_cleans_up_copy_when_row_is_ignored() {
        let dir = tempfile::tempdir().unwrap();
        let lib = dir.path().join("library");
        let src_dir = tempfile::tempdir().unwrap();
        let src = src_dir.path().join("cat.png");
        std::fs::write(&src, b"fresh-content").unwrap();

        let db = test_db();
        let conn = db.conn().lock().unwrap();
        let tx = conn.unchecked_transaction().unwrap();

        // A previous registration points at the target name, but the file
        // behind it is gone from disk — the resolver will reuse that name.
        let phantom = lib.join("cat.png");
        insert_image(
            &tx,
            &make_entry("pre", phantom.to_str().unwrap(), "old-hash"),
        )
        .unwrap();

        let entries = vec![make_entry("e1", src.to_str().unwrap(), "brand-new-hash")];
        let mut copied = Vec::new();
        let (imported, skipped) = run_import(&tx, &entries, Some(&lib), &mut copied).unwrap();

        // Row ignored (UNIQUE file_path) → the fresh copy must be removed
        // instead of lingering as an orphan.
        assert!(imported.is_empty());
        assert_eq!(skipped, 1);
        assert!(copied.is_empty());
        assert!(!phantom.exists());
        assert!(fs::read_dir(&lib).unwrap().count() == 0);
    }

    #[test]
    fn run_import_reference_mode_ignores_duplicate_paths() {
        let db = test_db();
        let conn = db.conn().lock().unwrap();
        let tx = conn.unchecked_transaction().unwrap();
        let entries = vec![
            make_entry("r1", "/tmp/ref.png", "hash-r1"),
            make_entry("r2", "/tmp/ref.png", "hash-r1"),
        ];
        let mut copied = Vec::new();
        let (imported, skipped) = run_import(&tx, &entries, None, &mut copied).unwrap();
        assert_eq!(imported.len(), 1);
        assert_eq!(skipped, 1);
        assert!(copied.is_empty());
    }

    #[test]
    fn remove_files_quietly_removes_and_tolerates_missing() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.bin");
        let missing = dir.path().join("missing.bin");
        std::fs::write(&a, b"x").unwrap();

        remove_files_quietly(&[a.clone(), missing]);
        assert!(!a.exists()); // removed…
                              // …and no panic despite `missing` never existing.
    }

    #[test]
    fn file_created_at_returns_parseable_rfc3339() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("f.png");
        std::fs::write(&f, b"x").unwrap();
        let meta = fs::metadata(&f).unwrap();
        let ts = file_created_at(&meta);
        assert!(chrono::DateTime::parse_from_rfc3339(&ts).is_ok());
    }

    #[test]
    fn grid_gate_rejects_two_by_two_grid() {
        use image::{Rgb, RgbImage};
        let mut img = RgbImage::from_fn(128, 128, |_, _| Rgb([40u8, 40, 40]));
        // light gutter down the vertical + horizontal centre
        for y in 0..128u32 {
            for x in 62..66u32 { img.put_pixel(x, y, Rgb([240u8, 240, 240])); }
        }
        for y in 62..66u32 {
            for x in 0..128u32 { img.put_pixel(x, y, Rgb([240u8, 240, 240])); }
        }
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("grid.png");
        img.save(&p).unwrap();
        assert!(looks_like_grid(&p));
    }

    #[test]
    fn grid_gate_accepts_single_image() {
        use image::{Rgb, RgbImage};
        let img = RgbImage::from_fn(128, 128, |_, _| Rgb([120u8, 120, 120]));
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("single.png");
        img.save(&p).unwrap();
        assert!(!looks_like_grid(&p));
    }
}
