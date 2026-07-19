use std::path::Path;

use rusqlite::params;

use crate::error::{AppError, AppResult};
use crate::db::DbHandle;

use super::export::{build_filename, load_tags_for_image};

/// Result for a single rename operation.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameItem {
    pub id: String,
    pub old_name: String,
    pub new_name: String,
    pub status: String, // "ok" | "conflict" | "error"
    pub error: Option<String>,
}

/// Overall result of a batch rename operation.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameResult {
    pub items: Vec<RenameItem>,
    pub renamed: u32,
    pub skipped: u32,
    pub errors: u32,
}

/// Batch-rename image files using a naming template.
///
/// When `dry_run` is true, only computes new names without modifying anything.
/// When false, renames actual files on disk and updates the DB.
#[tauri::command]
pub fn batch_rename(
    db: tauri::State<'_, DbHandle>,
    ids: Vec<String>,
    template: String,
    dry_run: bool,
) -> AppResult<RenameResult> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;

    let mut items: Vec<RenameItem> = Vec::with_capacity(ids.len());
    let mut renamed = 0u32;
    let mut skipped = 0u32;
    let mut errors = 0u32;

    // Track used filenames to detect inter-image conflicts within the batch
    let mut used_new_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    for id in &ids {
        let record = match conn.query_row(
            "SELECT * FROM images WHERE id = ?1",
            params![id],
            crate::schema::types::row_to_record,
        ) {
            Ok(r) => r,
            Err(_) => {
                items.push(RenameItem {
                    id: id.clone(),
                    old_name: String::new(),
                    new_name: String::new(),
                    status: "error".into(),
                    error: Some(format!("图片不存在: {id}")),
                });
                errors += 1;
                continue;
            }
        };

        let tags = load_tags_for_image(&conn, id);
        let old_path = Path::new(&record.file_path);
        let old_name = old_path
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| record.id.clone());

        let stem = build_filename(&record, &tags, Some(&template));
        let ext = old_path
            .extension()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_else(|| record.format.clone());

        let parent = old_path.parent().unwrap_or(Path::new(""));
        let new_name = format!("{stem}.{ext}");

        // Resolve conflict: if new_name already used (by another image in this batch
        // or already exists on disk), append _1, _2, etc.
        let final_new_name = resolve_conflict(&parent, &new_name, &used_new_paths);

        if final_new_name == old_name {
            // Name unchanged — skip
            items.push(RenameItem {
                id: id.clone(),
                old_name: old_name.clone(),
                new_name: old_name,
                status: "ok".into(),
                error: None,
            });
            skipped += 1;
            continue;
        }

        used_new_paths.insert(final_new_name.clone());
        let new_path = parent.join(&final_new_name);

        if dry_run {
            items.push(RenameItem {
                id: id.clone(),
                old_name,
                new_name: final_new_name,
                status: "ok".into(),
                error: None,
            });
            renamed += 1;
            continue;
        }

        // Perform actual rename
        match std::fs::rename(&record.file_path, &new_path) {
            Ok(_) => {
                // Update DB
                let new_path_str = new_path.to_string_lossy().into_owned();
                if let Err(e) = conn.execute(
                    "UPDATE images SET file_path = ?1 WHERE id = ?2",
                    params![new_path_str, id],
                ) {
                    // DB update failed — try to revert file rename
                    let _ = std::fs::rename(&new_path, &record.file_path);
                    items.push(RenameItem {
                        id: id.clone(),
                        old_name,
                        new_name: final_new_name,
                        status: "error".into(),
                        error: Some(format!("数据库更新失败: {e}")),
                    });
                    errors += 1;
                    continue;
                }
                items.push(RenameItem {
                    id: id.clone(),
                    old_name,
                    new_name: final_new_name,
                    status: "ok".into(),
                    error: None,
                });
                renamed += 1;
            }
            Err(e) => {
                items.push(RenameItem {
                    id: id.clone(),
                    old_name,
                    new_name: final_new_name,
                    status: "error".into(),
                    error: Some(format!("文件重命名失败: {e}")),
                });
                errors += 1;
            }
        }
    }

    Ok(RenameResult {
        items,
        renamed,
        skipped,
        errors,
    })
}

/// Resolve filename conflicts by appending `_1`, `_2`, etc.
/// Checks both on-disk existence and already-used names within the batch.
fn resolve_conflict(
    parent: &Path,
    desired_name: &str,
    used_names: &std::collections::HashSet<String>,
) -> String {
    if !used_names.contains(desired_name) && !parent.join(desired_name).exists() {
        return desired_name.to_string();
    }

    let stem = Path::new(desired_name)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| desired_name.to_string());
    let ext = Path::new(desired_name)
        .extension()
        .map(|s| format!(".{}", s.to_string_lossy()))
        .unwrap_or_default();

    for i in 1..999 {
        let candidate = format!("{stem}_{i}{ext}");
        if !used_names.contains(&candidate) && !parent.join(&candidate).exists() {
            return candidate;
        }
    }

    // Fallback: append timestamp
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{stem}_{ts}{ext}")
}
