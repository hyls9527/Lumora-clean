use crate::db::Database;
use image::ImageFormat;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(serde::Serialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

pub fn import_folder(folder_path: &Path, db: &Database) -> Result<ImportResult, String> {
    let mut result = ImportResult {
        imported: 0,
        skipped: 0,
        errors: Vec::new(),
    };

    for entry in WalkDir::new(folder_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !is_image_file(path) {
            continue;
        }

        match import_single_image(path, db) {
            Ok(true) => result.imported += 1,
            Ok(false) => result.skipped += 1,
            Err(e) => result
                .errors
                .push(format!("{}: {}", path.display(), e)),
        }
    }

    Ok(result)
}

fn is_image_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("jpg" | "jpeg" | "png" | "webp" | "avif" | "gif" | "bmp")
    )
}

fn import_single_image(path: &Path, db: &Database) -> Result<bool, String> {
    let file_path_str = path.to_str().ok_or("Invalid file path")?;
    if db.image_exists(file_path_str).map_err(|e| e.to_string())? {
        return Ok(false);
    }

    let data = fs::read(path).map_err(|e| e.to_string())?;
    let hash = compute_hash(&data);

    if db.hash_exists(&hash).map_err(|e| e.to_string())? {
        return Ok(false);
    }

    let (width, height) = get_image_dimensions(path)?;

    let thumbnail_path = generate_thumbnail(path, &hash)?;

    db.insert_image(
        file_path_str,
        &hash,
        data.len() as i64 / 1024,
        width,
        height,
        get_format(path),
        &thumbnail_path.to_string_lossy(),
    )
    .map_err(|e| e.to_string())?;

    Ok(true)
}

fn compute_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn get_image_dimensions(path: &Path) -> Result<(i32, i32), String> {
    let img = image::open(path).map_err(|e| e.to_string())?;
    Ok((img.width() as i32, img.height() as i32))
}

fn get_format(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("jpg" | "jpeg") => "jpg",
        Some("png") => "png",
        Some("webp") => "webp",
        Some("avif") => "avif",
        Some("gif") => "gif",
        Some("bmp") => "bmp",
        _ => "unknown",
    }
}

fn generate_thumbnail(path: &Path, hash: &str) -> Result<PathBuf, String> {
    let thumbnail_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("lumora")
        .join("thumbnails");

    fs::create_dir_all(&thumbnail_dir).map_err(|e| e.to_string())?;

    let thumbnail_path = thumbnail_dir.join(format!("{}.jpg", hash));

    if thumbnail_path.exists() {
        return Ok(thumbnail_path);
    }

    let img = image::open(path).map_err(|e| e.to_string())?;
    let thumbnail = img.resize(300, 300, image::imageops::FilterType::Lanczos3);
    thumbnail
        .save_with_format(&thumbnail_path, ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    Ok(thumbnail_path)
}
