use std::fs;
use std::path::Path;

use rusqlite::params;

use crate::error::{AppError, AppResult};

use crate::db::DbHandle;
use crate::schema::types::row_to_record;
use crate::schema::types::ExportResult;

/// Export images to a destination folder with optional format conversion and renaming.
#[tauri::command]
pub fn export_images(
    db: tauri::State<'_, DbHandle>,
    ids: Vec<String>,
    dest_dir: String,
    format: String,
    rename_template: Option<String>,
) -> AppResult<ExportResult> {
    let dest = Path::new(&dest_dir);
    fs::create_dir_all(dest).map_err(|e| format!("创建目标文件夹失败: {e}"))?;

    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;

    let mut success = 0u32;
    let mut failed = 0u32;

    for id in &ids {
        let record = match conn.query_row(
            "SELECT * FROM images WHERE id = ?1",
            params![id],
            row_to_record,
        ) {
            Ok(r) => r,
            Err(_) => {
                failed += 1;
                continue;
            }
        };

        let tags = load_tags_for_image(&conn, id);

        let stem = build_filename(&record, &tags, rename_template.as_deref());
        let ext = resolve_extension(&record.format, &format);
        let out_path = dest.join(format!("{stem}.{ext}"));

        match export_single(&record.file_path, &out_path, &format) {
            Ok(_) => success += 1,
            Err(_) => failed += 1,
        }
    }

    Ok(ExportResult {
        success,
        failed,
        dest_dir: dest_dir.clone(),
    })
}

fn load_tags_for_image(conn: &rusqlite::Connection, image_id: &str) -> Vec<String> {
    let mut stmt = match conn.prepare(
        "SELECT t.name FROM tags t
         JOIN image_tags it ON it.tag_id = t.id
         WHERE it.image_id = ?1",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    stmt.query_map(params![image_id], |row| row.get(0))
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

fn build_filename(
    record: &crate::schema::types::ImageRecord,
    tags: &[String],
    template: Option<&str>,
) -> String {
    let tpl = template.unwrap_or("{name}");
    let stem = Path::new(&record.file_path)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| record.id.clone());

    let date = record
        .created_at
        .split('T')
        .next()
        .unwrap_or(&record.created_at);

    sanitize_filename(
        &tpl.replace("{name}", &stem)
            .replace("{id}", &record.id)
            .replace("{date}", date)
            .replace("{rating}", &record.rating.to_string())
            .replace("{tags}", &tags.join(",")),
    )
}

/// Strip path separators and traversal sequences from template-generated filenames.
fn sanitize_filename(name: &str) -> String {
    name.replace('/', "_")
        .replace('\\', "_")
        .replace("..", "_")
        .replace('\0', "")
}

fn resolve_extension<'a>(original_format: &'a str, target_format: &str) -> &'a str {
    match target_format {
        "original" => match original_format {
            "jpeg" => "jpg",
            f => f,
        },
        "png" => "png",
        "jpg" | "jpeg" => "jpg",
        "webp" => "webp",
        _ => match original_format {
            "jpeg" => "jpg",
            f => f,
        },
    }
}

fn export_single(src: &str, dest: &Path, format: &str) -> AppResult<()> {
    if format == "original" {
        fs::copy(src, dest).map_err(|e| AppError::Io(format!("复制失败: {e}")))?;
        return Ok(());
    }

    let img = image::open(src).map_err(|e| AppError::External(format!("读取图片失败: {e}")))?;
    let img_format = match format {
        "png" => image::ImageFormat::Png,
        "jpg" | "jpeg" => image::ImageFormat::Jpeg,
        "webp" => image::ImageFormat::WebP,
        _ => return Err(AppError::InvalidInput(format!("不支持的格式: {format}"))),
    };

    let mut cursor = std::io::Cursor::new(Vec::new());
    img.write_to(&mut cursor, img_format)
        .map_err(|e| AppError::External(format!("编码失败: {e}")))?;
    fs::write(dest, cursor.into_inner())
        .map_err(|e| AppError::Io(format!("写入文件失败: {e}")))
}