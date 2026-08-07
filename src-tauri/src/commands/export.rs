use std::fs;
use std::path::Path;

use rusqlite::params;

use crate::error::{AppError, AppResult};

use crate::db::DbHandle;
use crate::schema::types::{row_to_record, BatchConvertItem, BatchConvertResult, ExportResult};

/// Options passed to `export_single` for format conversion.
pub struct ConvertOptions {
    pub format: String,
    pub quality: Option<u8>, // 1..=100 for JPEG/WebP
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
}

/// Export images to a destination folder with optional format conversion and renaming.
#[tauri::command]
pub fn export_images(
    db: tauri::State<'_, DbHandle>,
    ids: Vec<String>,
    dest_dir: String,
    format: String,
    rename_template: Option<String>,
) -> AppResult<ExportResult> {
    export_images_inner(&db, ids, dest_dir, format, rename_template)
}

fn export_images_inner(
    db: &DbHandle,
    ids: Vec<String>,
    dest_dir: String,
    format: String,
    rename_template: Option<String>,
) -> AppResult<ExportResult> {
    // Validate format early (fixes #10)
    let allowed = [
        "original", "png", "jpg", "jpeg", "webp", "avif", "bmp", "gif", "tiff", "tif",
    ];
    if !allowed.contains(&format.as_str()) {
        return Err(AppError::InvalidInput(format!("不支持的格式: {format}")));
    }

    let dest = Path::new(&dest_dir);
    fs::create_dir_all(dest).map_err(|e| AppError::Io(format!("创建目标文件夹失败: {e}")))?;

    // Phase 1: collect all records and tags while holding the lock (DB only, no I/O)
    struct ExportTask {
        file_path: String,
        stem: String,
        ext: String,
    }
    let tasks: Vec<Result<ExportTask, String>> = {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        ids.iter()
            .map(|id| {
                let record = match conn.query_row(
                    "SELECT * FROM images WHERE id = ?1",
                    params![id],
                    row_to_record,
                ) {
                    Ok(r) => r,
                    Err(_) => return Err(id.clone()),
                };
                let tags = load_tags_for_image(&conn, id);
                let stem = build_filename(&record, &tags, rename_template.as_deref());
                let ext = resolve_extension(&record.format, &format);
                Ok(ExportTask {
                    file_path: record.file_path,
                    stem,
                    ext: ext.to_string(),
                })
            })
            .collect()
    };
    // Lock released here — all I/O below happens without holding the mutex

    // Phase 2: perform export I/O without holding the DB lock
    let opts = ConvertOptions {
        format,
        quality: None,
        max_width: None,
        max_height: None,
    };

    let mut success = 0u32;
    let mut failed = 0u32;

    for task in &tasks {
        let task = match task {
            Ok(t) => t,
            Err(_) => {
                failed += 1;
                continue;
            }
        };
        let out_path = dest.join(format!("{}.{}", task.stem, task.ext));
        match export_single(&task.file_path, &out_path, &opts) {
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

/// Batch-convert images to a new format in-place (updates file + DB).
///
/// When `dry_run` is true, only reports what would happen without modifying anything.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn batch_convert(
    db: tauri::State<'_, DbHandle>,
    ids: Vec<String>,
    format: String,
    quality: Option<u8>,
    max_width: Option<u32>,
    max_height: Option<u32>,
    dest_dir: Option<String>,
    dry_run: bool,
) -> AppResult<BatchConvertResult> {
    batch_convert_inner(
        &db, ids, format, quality, max_width, max_height, dest_dir, dry_run,
    )
}

#[allow(clippy::too_many_arguments)]
fn batch_convert_inner(
    db: &DbHandle,
    ids: Vec<String>,
    format: String,
    quality: Option<u8>,
    max_width: Option<u32>,
    max_height: Option<u32>,
    dest_dir: Option<String>,
    dry_run: bool,
) -> AppResult<BatchConvertResult> {
    // Validate format early
    if format != "original"
        && format != "png"
        && format != "jpg"
        && format != "jpeg"
        && format != "webp"
        && format != "avif"
        && format != "bmp"
        && format != "gif"
        && format != "tiff"
        && format != "tif"
    {
        return Err(AppError::InvalidInput(format!("不支持的格式: {format}")));
    }
    if let Some(q) = quality {
        if q == 0 || q > 100 {
            return Err(AppError::InvalidInput("质量参数必须在 1-100 之间".into()));
        }
    }

    let opts = ConvertOptions {
        format: format.clone(),
        quality,
        max_width,
        max_height,
    };

    // Phase 1: load all records while holding the lock (DB only, no I/O)
    struct ConvertTask {
        id: String,
        old_format: String,
        file_path: String,
        new_ext: String,
        new_path: std::path::PathBuf,
        old_path: std::path::PathBuf,
        no_work: bool, // skip — format unchanged and no resize
        error: Option<String>,
    }

    let tasks: Vec<ConvertTask> = {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        ids.iter()
            .map(|id| {
                let record = match conn.query_row(
                    "SELECT * FROM images WHERE id = ?1",
                    params![id],
                    row_to_record,
                ) {
                    Ok(r) => r,
                    Err(_) => {
                        return ConvertTask {
                            id: id.clone(),
                            old_format: String::new(),
                            file_path: String::new(),
                            new_ext: opts.format.clone(),
                            new_path: std::path::PathBuf::new(),
                            old_path: std::path::PathBuf::new(),
                            no_work: false,
                            error: Some(format!("图片不存在: {id}")),
                        };
                    }
                };

                let new_ext = resolve_extension(&record.format, &opts.format);
                let no_resize = opts.max_width.is_none() && opts.max_height.is_none();

                if opts.format == "original" && no_resize {
                    return ConvertTask {
                        id: id.clone(),
                        old_format: record.format.clone(),
                        file_path: record.file_path.clone(),
                        new_ext: record.format.clone(),
                        new_path: std::path::PathBuf::new(),
                        old_path: std::path::PathBuf::new(),
                        no_work: true,
                        error: None,
                    };
                }

                let old_path = std::path::PathBuf::from(&record.file_path);
                let new_path = if let Some(ref dir) = dest_dir {
                    let dest = std::path::Path::new(dir);
                    let stem = old_path
                        .file_stem()
                        .map(|s| s.to_string_lossy().into_owned())
                        .unwrap_or_else(|| record.id.clone());
                    dest.join(format!("{stem}.{new_ext}"))
                } else {
                    old_path.with_extension(new_ext)
                };

                // In-place same format, no resize → skip
                if dest_dir.is_none() && opts.format == "original" && old_path == new_path {
                    return ConvertTask {
                        id: id.clone(),
                        old_format: record.format.clone(),
                        file_path: record.file_path.clone(),
                        new_ext: record.format.clone(),
                        new_path: std::path::PathBuf::new(),
                        old_path,
                        no_work: true,
                        error: None,
                    };
                }

                ConvertTask {
                    id: id.clone(),
                    old_format: record.format.clone(),
                    file_path: record.file_path,
                    new_ext: new_ext.to_string(),
                    new_path,
                    old_path,
                    no_work: false,
                    error: None,
                }
            })
            .collect()
    };
    // Lock released — I/O below happens without holding the mutex

    // Phase 2: perform conversion I/O and collect results
    struct ConvertOutcome {
        id: String,
        old_format: String,
        new_format: String,
        status: String, // "ok" | "skipped" | "error"
        error: Option<String>,
        new_path_str: Option<String>,
    }

    let outcomes: Vec<ConvertOutcome> = tasks
        .into_iter()
        .map(|task| {
            if let Some(err) = task.error {
                return ConvertOutcome {
                    id: task.id,
                    old_format: task.old_format,
                    new_format: task.new_ext,
                    status: "error".into(),
                    error: Some(err),
                    new_path_str: None,
                };
            }

            if task.no_work {
                return ConvertOutcome {
                    id: task.id,
                    old_format: task.old_format.clone(),
                    new_format: task.old_format,
                    status: "skipped".into(),
                    error: None,
                    new_path_str: None,
                };
            }

            if dry_run {
                return ConvertOutcome {
                    id: task.id,
                    old_format: task.old_format,
                    new_format: task.new_ext,
                    status: "ok".into(),
                    error: None,
                    new_path_str: None,
                };
            }

            // Ensure parent dir exists (for dest_dir mode)
            if let Some(parent) = task.new_path.parent() {
                if let Err(e) = fs::create_dir_all(parent) {
                    return ConvertOutcome {
                        id: task.id,
                        old_format: task.old_format,
                        new_format: task.new_ext,
                        status: "error".into(),
                        error: Some(format!("创建目录失败: {e}")),
                        new_path_str: None,
                    };
                }
            }

            match export_single(&task.file_path, &task.new_path, &opts) {
                Ok(_) => {
                    // Remove old file if path changed
                    if task.new_path != task.old_path {
                        let _ = fs::remove_file(&task.old_path);
                    }
                    ConvertOutcome {
                        id: task.id,
                        old_format: task.old_format,
                        new_format: task.new_ext,
                        status: "ok".into(),
                        error: None,
                        new_path_str: Some(task.new_path.to_string_lossy().into_owned()),
                    }
                }
                Err(e) => ConvertOutcome {
                    id: task.id,
                    old_format: task.old_format,
                    new_format: task.new_ext,
                    status: "error".into(),
                    error: Some(format!("转换失败: {e}")),
                    new_path_str: None,
                },
            }
        })
        .collect();

    // Phase 3: update DB for successfully converted images (lock → DB writes → unlock)
    {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        for outcome in &outcomes {
            if outcome.status == "ok" && outcome.new_path_str.is_some() && !dry_run {
                let new_path_str = outcome.new_path_str.as_deref().unwrap();
                let new_format_str = if opts.format == "original" {
                    outcome.old_format.clone()
                } else if opts.format == "jpg" || opts.format == "jpeg" {
                    "jpeg".to_string()
                } else {
                    opts.format.clone()
                };
                // If DB update fails, log but don't fail the whole batch — file is already converted
                if let Err(e) = conn.execute(
                    "UPDATE images SET file_path = ?1, format = ?2 WHERE id = ?3",
                    params![new_path_str, new_format_str, outcome.id],
                ) {
                    log::error!(
                        "DB update failed for {} after conversion: {}",
                        outcome.id,
                        e
                    );
                }
            }
        }
    }

    // Build result
    let mut items: Vec<BatchConvertItem> = Vec::with_capacity(outcomes.len());
    let mut converted = 0u32;
    let mut skipped = 0u32;
    let mut failed = 0u32;

    for outcome in &outcomes {
        match outcome.status.as_str() {
            "ok" => {
                converted += 1;
                items.push(BatchConvertItem {
                    id: outcome.id.clone(),
                    old_format: outcome.old_format.clone(),
                    new_format: outcome.new_format.clone(),
                    status: "ok".into(),
                    error: None,
                });
            }
            "skipped" => {
                skipped += 1;
                items.push(BatchConvertItem {
                    id: outcome.id.clone(),
                    old_format: outcome.old_format.clone(),
                    new_format: outcome.new_format.clone(),
                    status: "ok".into(),
                    error: None,
                });
            }
            _ => {
                failed += 1;
                items.push(BatchConvertItem {
                    id: outcome.id.clone(),
                    old_format: outcome.old_format.clone(),
                    new_format: outcome.new_format.clone(),
                    status: "error".into(),
                    error: outcome.error.clone(),
                });
            }
        }
    }

    Ok(BatchConvertResult {
        items,
        converted,
        skipped,
        failed,
    })
}

pub(crate) fn load_tags_for_image(conn: &rusqlite::Connection, image_id: &str) -> Vec<String> {
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

pub(crate) fn build_filename(
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

    // Parse metadata for template variables
    let (model, prompt, seed) = parse_metadata_fields(record.metadata_json.as_deref());
    let w = record.width.map(|v| v.to_string()).unwrap_or_default();
    let h = record.height.map(|v| v.to_string()).unwrap_or_default();

    sanitize_filename(
        &tpl.replace("{name}", &stem)
            .replace("{id}", &record.id)
            .replace("{date}", date)
            .replace("{rating}", &record.rating.to_string())
            .replace("{tags}", &tags.join(","))
            .replace("{model}", &model)
            .replace("{prompt}", &prompt)
            .replace("{seed}", &seed)
            .replace("{width}", &w)
            .replace("{height}", &h)
            .replace("{format}", &record.format),
    )
}

/// Extract model, prompt, seed from metadata_json.
fn parse_metadata_fields(json: Option<&str>) -> (String, String, String) {
    let Some(raw) = json else {
        return (String::new(), String::new(), String::new());
    };
    let Ok(obj) = serde_json::from_str::<serde_json::Value>(raw) else {
        return (String::new(), String::new(), String::new());
    };
    let model = obj
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let prompt = obj
        .get("prompt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let seed = obj.get("seed").map(|v| v.to_string()).unwrap_or_default();
    (model, prompt, seed)
}

/// Strip path separators and traversal sequences from template-generated filenames.
fn sanitize_filename(name: &str) -> String {
    let mut s: String = name
        .replace("..", "_")
        .chars()
        .filter(|c| *c != '\0')
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .collect();
    while s.ends_with('.') || s.ends_with(' ') {
        s.pop();
    }
    if s.is_empty() {
        s.push('_');
    }
    s
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
        "avif" => "avif",
        "bmp" => "bmp",
        "gif" => "gif",
        "tiff" | "tif" => "tiff",
        _ => match original_format {
            "jpeg" => "jpg",
            f => f,
        },
    }
}

fn export_single(src: &str, dest: &Path, opts: &ConvertOptions) -> AppResult<()> {
    let img = image::open(src).map_err(|e| AppError::External(format!("读取图片失败: {e}")))?;

    // Resize if requested
    let img = if opts.max_width.is_some() || opts.max_height.is_some() {
        let (iw, ih) = (img.width(), img.height());
        let mw = opts.max_width.unwrap_or(iw);
        let mh = opts.max_height.unwrap_or(ih);
        // Only resize down, never up
        let (mw, mh) = if mw < iw || mh < ih {
            (mw.min(iw), mh.min(ih))
        } else {
            (iw, ih)
        };
        if mw < iw || mh < ih {
            img.resize(mw, mh, image::imageops::FilterType::Lanczos3)
        } else {
            img
        }
    } else {
        img
    };

    if opts.format == "original" {
        // Still re-encode through image crate to apply resize
        if opts.max_width.is_some() || opts.max_height.is_some() {
            let ext = dest.extension().and_then(|e| e.to_str()).unwrap_or("png");
            let fmt = extension_to_image_format(ext)?;
            let mut cursor = std::io::Cursor::new(Vec::new());
            encode_with_quality(&img, fmt, opts.quality, &mut cursor)?;
            fs::write(dest, cursor.into_inner())
                .map_err(|e| AppError::Io(format!("写入文件失败: {e}")))?;
            return Ok(());
        }
        fs::copy(src, dest).map_err(|e| AppError::Io(format!("复制失败: {e}")))?;
        return Ok(());
    }

    let img_format = extension_to_image_format(&opts.format)?;

    let mut cursor = std::io::Cursor::new(Vec::new());
    encode_with_quality(&img, img_format, opts.quality, &mut cursor)?;
    fs::write(dest, cursor.into_inner()).map_err(|e| AppError::Io(format!("写入文件失败: {e}")))
}

/// Map a format string to `image::ImageFormat`.
fn extension_to_image_format(ext: &str) -> AppResult<image::ImageFormat> {
    match ext {
        "png" => Ok(image::ImageFormat::Png),
        "jpg" | "jpeg" => Ok(image::ImageFormat::Jpeg),
        "webp" => Ok(image::ImageFormat::WebP),
        "avif" => Ok(image::ImageFormat::Avif),
        "bmp" => Ok(image::ImageFormat::Bmp),
        "gif" => Ok(image::ImageFormat::Gif),
        "tiff" | "tif" => Ok(image::ImageFormat::Tiff),
        _ => Err(AppError::InvalidInput(format!("不支持的格式: {ext}"))),
    }
}

/// Encode an image with optional quality setting.
fn encode_with_quality(
    img: &image::DynamicImage,
    fmt: image::ImageFormat,
    quality: Option<u8>,
    writer: &mut (impl std::io::Write + std::io::Seek),
) -> AppResult<()> {
    match (fmt, quality) {
        (image::ImageFormat::Jpeg, Some(q)) => {
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(writer, q);
            encoder
                .encode_image(img)
                .map_err(|e| AppError::External(format!("JPEG 编码失败: {e}")))?;
        }
        _ => {
            img.write_to(writer, fmt)
                .map_err(|e| AppError::External(format!("编码失败: {e}")))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DbHandle;
    use crate::schema::types::ImageRecord;
    use tempfile::{tempdir, TempDir};

    // ---------------------------------------------------------------------------
    // resolve_extension
    // ---------------------------------------------------------------------------

    #[test]
    fn resolve_extension_original_jpeg_gives_jpg() {
        assert_eq!(resolve_extension("jpeg", "original"), "jpg");
    }

    #[test]
    fn resolve_extension_original_png_gives_png() {
        assert_eq!(resolve_extension("png", "original"), "png");
    }

    #[test]
    fn resolve_extension_png_target() {
        assert_eq!(resolve_extension("jpeg", "png"), "png");
    }

    #[test]
    fn resolve_extension_jpg_target() {
        assert_eq!(resolve_extension("png", "jpg"), "jpg");
    }

    #[test]
    fn resolve_extension_webp_target() {
        assert_eq!(resolve_extension("png", "webp"), "webp");
    }

    #[test]
    fn resolve_extension_unknown_falls_back_to_original() {
        assert_eq!(resolve_extension("png", "ico"), "png");
    }

    // ---------------------------------------------------------------------------
    // sanitize_filename
    // ---------------------------------------------------------------------------

    #[test]
    fn sanitize_replaces_slashes() {
        assert_eq!(sanitize_filename("a/b/c"), "a_b_c");
        assert_eq!(sanitize_filename("a\\b\\c"), "a_b_c");
    }

    #[test]
    fn sanitize_replaces_dotdot() {
        assert_eq!(sanitize_filename("foo..bar"), "foo_bar");
        assert_eq!(sanitize_filename("..etc"), "_etc");
    }

    #[test]
    fn sanitize_removes_null() {
        assert_eq!(sanitize_filename("foo\0bar"), "foobar");
    }

    #[test]
    fn sanitize_normal_name_unchanged() {
        assert_eq!(sanitize_filename("my_image"), "my_image");
    }

    // ---------------------------------------------------------------------------
    // parse_metadata_fields
    // ---------------------------------------------------------------------------

    #[test]
    fn parse_metadata_ok() {
        let json = r#"{"model":"SDXL","prompt":"a cat","seed":12345}"#;
        let (model, prompt, seed) = parse_metadata_fields(Some(json));
        assert_eq!(model, "SDXL");
        assert_eq!(prompt, "a cat");
        assert_eq!(seed, "12345");
    }

    #[test]
    fn parse_metadata_missing_fields() {
        let json = r#"{"model":"Foo"}"#;
        let (model, prompt, seed) = parse_metadata_fields(Some(json));
        assert_eq!(model, "Foo");
        assert_eq!(prompt, "");
        assert_eq!(seed, "");
    }

    #[test]
    fn parse_metadata_none() {
        let (model, prompt, seed) = parse_metadata_fields(None);
        assert_eq!(model, "");
        assert_eq!(prompt, "");
        assert_eq!(seed, "");
    }

    #[test]
    fn parse_metadata_invalid_json() {
        let (model, prompt, seed) = parse_metadata_fields(Some("not json"));
        assert_eq!(model, "");
        assert_eq!(prompt, "");
        assert_eq!(seed, "");
    }

    // ---------------------------------------------------------------------------
    // build_filename
    // ---------------------------------------------------------------------------

    fn make_record(
        path: &str,
        id: &str,
        rating: i32,
        width: Option<i32>,
        height: Option<i32>,
        metadata: Option<&str>,
    ) -> ImageRecord {
        let (w, h) = if let Some(_md) = metadata {
            if path.contains("photo-sunset") {
                (Some(1920), Some(1080))
            } else {
                (width, height)
            }
        } else {
            (width, height)
        };

        ImageRecord {
            id: id.to_string(),
            file_path: path.to_string(),
            file_hash: "abc".into(),
            file_size_kb: 100,
            width: w,
            height: h,
            format: "jpeg".to_string(),
            created_at: "2025-01-15T10:30:00".into(),
            imported_at: "2025-01-15T10:30:00".into(),
            deleted: false,
            rating,
            favorite: false,
            metadata_json: metadata.map(|s| s.to_string()),
            deleted_at: None,
            variant_group_id: None,
            hps_score: None,
            hps_style: None,
            aesthetic_score: None,
            scoring_model: None,
            scored_at: None,
            score_label: None,
        }
    }

    #[test]
    fn build_filename_default_template_uses_stem() {
        let rec = make_record("/images/photo.jpg", "id123", 0, Some(800), Some(600), None);
        let name = build_filename(&rec, &[], None);
        assert!(name.starts_with("photo"));
        assert!(!name.contains("{"));
    }

    #[test]
    fn build_filename_custom_template() {
        let rec = make_record("/images/photo.jpg", "id123", 4, Some(800), Some(600), None);
        let name = build_filename(
            &rec,
            &["cat".into(), "cute".into()],
            Some("{name}_{rating}"),
        );
        assert!(name.starts_with("photo_4"));
    }

    #[test]
    fn build_filename_with_tags() {
        let rec = make_record("/images/img.jpg", "id123", 0, Some(800), Some(600), None);
        let name = build_filename(&rec, &["cat".into()], Some("{tags}"));
        assert_eq!(name, "cat");
    }

    #[test]
    fn build_filename_with_date() {
        let rec = make_record("/images/img.jpg", "id123", 0, None, None, None);
        let name = build_filename(&rec, &[], Some("{date}"));
        assert_eq!(name, "2025-01-15");
    }

    #[test]
    fn build_filename_with_dimensions() {
        let rec = make_record("/images/img.jpg", "id123", 0, Some(800), Some(600), None);
        let name = build_filename(&rec, &[], Some("{width}x{height}"));
        assert_eq!(name, "800x600");
    }

    #[test]
    fn build_filename_with_metadata_template() {
        let meta = r#"{"model":"SDXL","prompt":"a beautiful sunset","seed":42}"#;
        let rec = make_record(
            "/images/sunset.jpg",
            "id99",
            5,
            Some(1920),
            Some(1080),
            Some(meta),
        );
        let name = build_filename(&rec, &[], Some("{model}_{seed}"));
        assert_eq!(name, "SDXL_42");
    }

    #[test]
    fn sanitize_filename_removes_windows_invalid_chars() {
        assert_eq!(sanitize_filename("cat: portrait*?"), "cat_ portrait__");
        assert_eq!(sanitize_filename("a<b>c|d"), "a_b_c_d");
        assert_eq!(sanitize_filename("quote\"name"), "quote_name");
    }

    #[test]
    fn sanitize_filename_handles_separators_and_dots() {
        assert_eq!(sanitize_filename("a/b\\c"), "a_b_c");
        assert_eq!(sanitize_filename(".."), "_");
        assert_eq!(sanitize_filename("name."), "name");
        assert_eq!(sanitize_filename("name.."), "name_");
        assert_eq!(sanitize_filename("name "), "name");
    }

    #[test]
    fn sanitize_filename_empty_or_dots_falls_back() {
        assert_eq!(sanitize_filename(""), "_");
        assert_eq!(sanitize_filename("..."), "_");
        assert_eq!(sanitize_filename("///"), "___");
    }

    // ---------------------------------------------------------------------------
    // extension_to_image_format
    // ---------------------------------------------------------------------------

    #[test]
    fn extension_png_format() {
        assert!(matches!(
            extension_to_image_format("png"),
            Ok(image::ImageFormat::Png)
        ));
    }

    #[test]
    fn extension_jpg_format() {
        assert!(matches!(
            extension_to_image_format("jpg"),
            Ok(image::ImageFormat::Jpeg)
        ));
        assert!(matches!(
            extension_to_image_format("jpeg"),
            Ok(image::ImageFormat::Jpeg)
        ));
    }

    #[test]
    fn extension_webp_format() {
        assert!(matches!(
            extension_to_image_format("webp"),
            Ok(image::ImageFormat::WebP)
        ));
    }

    #[test]
    fn extension_unknown_is_error() {
        assert!(extension_to_image_format("ico").is_err());
    }

    // ---------------------------------------------------------------------------
    // export_single — integration-style tests with real files
    // ---------------------------------------------------------------------------

    /// Create a small 2x2 PNG test image in a temp file.
    fn create_test_png() -> (TempDir, String) {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.png");
        let img = image::DynamicImage::new_rgba8(2, 2);
        img.save(&path).unwrap();
        let path_str = path.to_string_lossy().into_owned();
        (dir, path_str)
    }

    #[test]
    fn export_single_original_copies() {
        let (_src_file, src_path) = create_test_png();
        let dir = tempdir().unwrap();
        let dest = dir.path().join("copy.png");

        let opts = ConvertOptions {
            format: "original".into(),
            quality: None,
            max_width: None,
            max_height: None,
        };
        export_single(&src_path, &dest, &opts).unwrap();
        assert!(dest.exists());
        assert!(dest.metadata().unwrap().len() > 0);
    }

    #[test]
    fn export_single_png_to_jpg() {
        let (_src_file, src_path) = create_test_png();
        let dir = tempdir().unwrap();
        let dest = dir.path().join("out.jpg");

        let opts = ConvertOptions {
            format: "jpg".into(),
            quality: Some(90),
            max_width: None,
            max_height: None,
        };
        export_single(&src_path, &dest, &opts).unwrap();
        assert!(dest.exists());
        assert!(dest.metadata().unwrap().len() > 0);
    }

    #[test]
    fn export_single_png_to_webp() {
        let (_src_file, src_path) = create_test_png();
        let dir = tempdir().unwrap();
        let dest = dir.path().join("out.webp");

        let opts = ConvertOptions {
            format: "webp".into(),
            quality: None,
            max_width: None,
            max_height: None,
        };
        export_single(&src_path, &dest, &opts).unwrap();
        assert!(dest.exists());
        assert!(dest.metadata().unwrap().len() > 0);
    }

    #[test]
    fn export_single_with_resize() {
        // Create a 16x16 RGB image
        let dir_src = tempdir().unwrap();
        let src_path = dir_src.path().join("input.png");
        let img = image::DynamicImage::new_rgb8(16, 16);
        img.save(&src_path).unwrap();
        let src_path_str = src_path.to_string_lossy().into_owned();

        let dir = tempdir().unwrap();
        let dest = dir.path().join("resized.png");

        let opts = ConvertOptions {
            format: "png".into(),
            quality: None,
            max_width: Some(8),
            max_height: Some(8),
        };
        export_single(&src_path_str, &dest, &opts).unwrap();
        assert!(dest.exists());

        // Verify it's actually 8x8
        let result = image::open(&dest).unwrap();
        assert_eq!(result.width(), 8);
        assert_eq!(result.height(), 8);
    }

    #[test]
    fn export_single_unsupported_format() {
        let (_src_file, src_path) = create_test_png();
        let dir = tempdir().unwrap();
        let dest = dir.path().join("out.ico");

        let opts = ConvertOptions {
            format: "ico".into(),
            quality: None,
            max_width: None,
            max_height: None,
        };
        let result = export_single(&src_path, &dest, &opts);
        assert!(result.is_err());
    }

    #[test]
    fn export_single_nonexistent_src() {
        let dir = tempdir().unwrap();
        let dest = dir.path().join("out.png");
        let opts = ConvertOptions {
            format: "png".into(),
            quality: None,
            max_width: None,
            max_height: None,
        };
        let result = export_single("/nonexistent/image.png", &dest, &opts);
        assert!(result.is_err());
    }

    // ---------------------------------------------------------------------------
    // batch_convert — dry_run tests with in-memory DB
    // ---------------------------------------------------------------------------

    fn setup_test_db() -> (DbHandle, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let db = DbHandle::open(&db_path).unwrap();

        // Also create tags table for load_tags_for_image
        let conn = db.conn().lock().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS images (
                id            TEXT PRIMARY KEY,
                file_path     TEXT NOT NULL UNIQUE,
                file_hash     TEXT NOT NULL,
                file_size_kb  INTEGER NOT NULL,
                width         INTEGER,
                height        INTEGER,
                format        TEXT NOT NULL,
                created_at    TEXT NOT NULL,
                imported_at   TEXT NOT NULL DEFAULT (datetime('now')),
                deleted       INTEGER DEFAULT 0,
                rating        INTEGER DEFAULT 0,
                favorite      INTEGER DEFAULT 0,
                metadata_json TEXT
            );
            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS image_tags (
                image_id TEXT NOT NULL REFERENCES images(id),
                tag_id TEXT NOT NULL REFERENCES tags(id),
                PRIMARY KEY (image_id, tag_id)
            );",
        )
        .unwrap();
        drop(conn);

        (db, dir)
    }

    fn insert_test_image(conn: &rusqlite::Connection, id: &str, path: &str, format: &str) {
        use std::path::Path;
        // Create the actual file on disk
        let p = Path::new(path);
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let img = image::DynamicImage::new_rgb8(4, 4);
        let mut buf = Vec::new();
        let fmt = match format {
            "jpeg" | "jpg" => image::ImageFormat::Jpeg,
            "webp" => image::ImageFormat::WebP,
            _ => image::ImageFormat::Png,
        };
        img.write_to(&mut std::io::Cursor::new(&mut buf), fmt)
            .unwrap();
        std::fs::write(path, &buf).unwrap();

        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES (?1, ?2, 'fakehash', 10, ?3, '2025-01-01T00:00:00')",
            params![id, path, format],
        )
        .unwrap();
    }

    #[test]
    fn batch_convert_dry_run_ok() {
        let (db, _dir) = setup_test_db();
        let conn = db.conn().lock().unwrap();
        let img_dir = tempdir().unwrap();
        let p1 = img_dir.path().join("img1.png");
        let p2 = img_dir.path().join("img2.png");
        insert_test_image(&conn, "id1", &p1.to_string_lossy(), "png");
        insert_test_image(&conn, "id2", &p2.to_string_lossy(), "png");
        drop(conn);

        // We can't use tauri::State in tests — test the logic without Tauri
        // by constructing a helper that takes &DbHandle directly
        let result = batch_convert_inner(
            &db,
            vec!["id1".into(), "id2".into()],
            "jpg".into(),
            Some(85),
            None,
            None,
            None,
            true,
        )
        .unwrap();

        assert_eq!(result.converted, 2);
        assert_eq!(result.skipped, 0);
        assert_eq!(result.failed, 0);
        assert_eq!(result.items.len(), 2);
        for item in &result.items {
            assert_eq!(item.status, "ok");
            assert_eq!(item.new_format, "jpg");
        }
    }

    #[test]
    fn batch_convert_dry_run_original_skips() {
        let (db, _dir) = setup_test_db();
        let conn = db.conn().lock().unwrap();
        let img_dir = tempdir().unwrap();
        let p = img_dir.path().join("img.png");
        insert_test_image(&conn, "id1", &p.to_string_lossy(), "png");
        drop(conn);

        let result = batch_convert_inner(
            &db,
            vec!["id1".into()],
            "original".into(),
            None,
            None,
            None,
            None,
            true,
        )
        .unwrap();

        assert_eq!(result.skipped, 1);
        assert_eq!(result.converted, 0);
    }

    #[test]
    fn batch_convert_avif_accepted() {
        let (db, _dir) = setup_test_db();
        let result = batch_convert_inner(
            &db,
            vec!["id1".into()],
            "avif".into(),
            None,
            None,
            None,
            None,
            true,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn batch_convert_invalid_quality_rejected() {
        let (db, _dir) = setup_test_db();
        let result = batch_convert_inner(
            &db,
            vec!["id1".into()],
            "jpg".into(),
            Some(0),
            None,
            None,
            None,
            false,
        );
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("1-100"));
    }

    #[test]
    fn batch_convert_nonexistent_image_reported() {
        let (db, _dir) = setup_test_db();
        let result = batch_convert_inner(
            &db,
            vec!["nonexistent".into()],
            "jpg".into(),
            None,
            None,
            None,
            None,
            false,
        )
        .unwrap();

        assert_eq!(result.failed, 1);
        assert_eq!(result.items[0].status, "error");
        assert!(result.items[0].error.as_deref().unwrap().contains("不存在"));
    }

    #[test]
    fn export_images_copies_original() {
        let (db, _dir) = setup_test_db();
        let conn = db.conn().lock().unwrap();
        let img_dir = tempdir().unwrap();
        let p = img_dir.path().join("img.png");
        insert_test_image(&conn, "id1", &p.to_string_lossy(), "png");
        drop(conn);

        let out_dir = tempdir().unwrap();
        let result = export_images_inner(
            &db,
            vec!["id1".into()],
            out_dir.path().to_string_lossy().into_owned(),
            "original".into(),
            None,
        )
        .unwrap();

        assert_eq!(result.success, 1);
        assert_eq!(result.failed, 0);
        assert!(out_dir.path().join("img.png").exists());
    }

    #[test]
    fn export_images_converts_format() {
        let (db, _dir) = setup_test_db();
        let conn = db.conn().lock().unwrap();
        let img_dir = tempdir().unwrap();
        let p = img_dir.path().join("img.png");
        insert_test_image(&conn, "id1", &p.to_string_lossy(), "png");
        drop(conn);

        let out_dir = tempdir().unwrap();
        let result = export_images_inner(
            &db,
            vec!["id1".into()],
            out_dir.path().to_string_lossy().into_owned(),
            "jpg".into(),
            None,
        )
        .unwrap();

        assert_eq!(result.success, 1);
        assert!(out_dir.path().join("img.jpg").exists());
    }

    #[test]
    fn export_images_rejects_unknown_format() {
        let (db, _dir) = setup_test_db();
        let out_dir = tempdir().unwrap();
        let err = export_images_inner(
            &db,
            vec!["id1".into()],
            out_dir.path().to_string_lossy().into_owned(),
            "heic".into(),
            None,
        )
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn export_images_counts_missing_images_as_failed() {
        let (db, _dir) = setup_test_db();
        let out_dir = tempdir().unwrap();
        let result = export_images_inner(
            &db,
            vec!["missing".into()],
            out_dir.path().to_string_lossy().into_owned(),
            "original".into(),
            None,
        )
        .unwrap();

        assert_eq!(result.success, 0);
        assert_eq!(result.failed, 1);
    }
}
