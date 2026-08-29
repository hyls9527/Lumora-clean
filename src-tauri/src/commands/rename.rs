use std::path::Path;

use rusqlite::params;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};

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
    batch_rename_inner(&db, ids, template, dry_run)
}

fn batch_rename_inner(
    db: &DbHandle,
    ids: Vec<String>,
    template: String,
    dry_run: bool,
) -> AppResult<RenameResult> {
    // Phase 1: load all records and tags while holding the lock (DB only, no I/O)
    struct RenameTask {
        id: String,
        old_name: String,
        old_path: std::path::PathBuf,
        new_name: String,
        new_path: std::path::PathBuf,
        error: Option<String>,
    }

    let tasks: Vec<RenameTask> = {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        // Paths already registered in the DB for other records: claiming one
        // of them would violate the file_path UNIQUE constraint and force a
        // rollback after the file has already been renamed on disk.
        let mut db_used_paths: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        {
            let mut stmt = conn.prepare("SELECT file_path FROM images")?;
            let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
            for row in rows {
                db_used_paths.insert(row?);
            }
        }
        let mut used_new_paths: std::collections::HashSet<String> =
            std::collections::HashSet::new();

        ids.iter()
            .map(|id| {
                let record = match conn.query_row(
                    "SELECT * FROM images WHERE id = ?1",
                    params![id],
                    crate::schema::types::row_to_record,
                ) {
                    Ok(r) => r,
                    Err(_) => {
                        return RenameTask {
                            id: id.clone(),
                            old_name: String::new(),
                            old_path: std::path::PathBuf::new(),
                            new_name: String::new(),
                            new_path: std::path::PathBuf::new(),
                            error: Some(format!("图片不存在: {id}")),
                        };
                    }
                };

                let tags = load_tags_for_image(&conn, id);
                let old_path = std::path::PathBuf::from(&record.file_path);
                let old_name = old_path
                    .file_name()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_else(|| record.id.clone());

                let stem = build_filename(&record, &tags, Some(&template));
                let ext = old_path
                    .extension()
                    .map(|s| s.to_string_lossy().into_owned())
                    .unwrap_or_else(|| record.format.clone());

                let parent = old_path.parent().unwrap_or(std::path::Path::new(""));
                let desired_name = format!("{stem}.{ext}");
                let final_new_name = resolve_conflict(
                    parent,
                    &desired_name,
                    &used_new_paths,
                    &db_used_paths,
                    &old_path,
                );

                if final_new_name == old_name {
                    return RenameTask {
                        id: id.clone(),
                        old_name: old_name.clone(),
                        old_path,
                        new_name: old_name,
                        new_path: std::path::PathBuf::new(),
                        error: None,
                    };
                }

                used_new_paths.insert(final_new_name.clone());
                let new_path = parent.join(&final_new_name);

                RenameTask {
                    id: id.clone(),
                    old_name,
                    old_path,
                    new_name: final_new_name,
                    new_path,
                    error: None,
                }
            })
            .collect()
    };
    // Lock released — I/O below happens without holding the mutex

    // Phase 2: perform file renames without DB lock (I/O only)
    let mut outcomes: Vec<RenameOutcome> = tasks
        .into_iter()
        .map(|task| {
            if let Some(err) = task.error {
                return RenameOutcome {
                    id: task.id,
                    old_name: task.old_name,
                    old_path: task.old_path,
                    new_name: task.new_name,
                    new_path: None,
                    status: "error".into(),
                    error: Some(err),
                };
            }

            if task.new_name == task.old_name && !task.new_name.is_empty() {
                return RenameOutcome {
                    id: task.id,
                    old_name: task.old_name,
                    old_path: task.old_path,
                    new_name: task.new_name,
                    new_path: None,
                    status: "skipped".into(),
                    error: None,
                };
            }

            if dry_run {
                return RenameOutcome {
                    id: task.id,
                    old_name: task.old_name,
                    old_path: task.old_path,
                    new_name: task.new_name,
                    new_path: None,
                    status: "ok".into(),
                    error: None,
                };
            }

            match std::fs::rename(&task.old_path, &task.new_path) {
                Ok(_) => RenameOutcome {
                    id: task.id,
                    old_name: task.old_name,
                    old_path: task.old_path,
                    new_name: task.new_name,
                    new_path: Some(task.new_path),
                    status: "ok".into(),
                    error: None,
                },
                Err(e) => RenameOutcome {
                    id: task.id,
                    old_name: task.old_name,
                    old_path: task.old_path,
                    new_name: task.new_name,
                    new_path: None,
                    status: "error".into(),
                    error: Some(format!("文件重命名失败: {e}")),
                },
            }
        })
        .collect();

    // Phase 3: update DB for successfully renamed files (lock → DB → unlock)
    {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        commit_renames(&conn, &mut outcomes);
    }

    // Build result
    let mut items: Vec<RenameItem> = Vec::with_capacity(outcomes.len());
    let mut renamed = 0u32;
    let mut skipped = 0u32;
    let mut errors = 0u32;

    for outcome in &outcomes {
        match outcome.status.as_str() {
            "ok" => {
                renamed += 1;
                items.push(RenameItem {
                    id: outcome.id.clone(),
                    old_name: outcome.old_name.clone(),
                    new_name: outcome.new_name.clone(),
                    status: "ok".into(),
                    error: None,
                });
            }
            "skipped" => {
                skipped += 1;
                items.push(RenameItem {
                    id: outcome.id.clone(),
                    old_name: outcome.old_name.clone(),
                    new_name: outcome.new_name.clone(),
                    status: "ok".into(),
                    error: None,
                });
            }
            _ => {
                errors += 1;
                items.push(RenameItem {
                    id: outcome.id.clone(),
                    old_name: outcome.old_name.clone(),
                    new_name: outcome.new_name.clone(),
                    status: "error".into(),
                    error: outcome.error.clone(),
                });
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

/// Outcome of a single rename attempt (module-level so `commit_renames`
/// can mutate the phase-2 results in place).
struct RenameOutcome {
    id: String,
    old_name: String,
    old_path: std::path::PathBuf,
    new_name: String,
    new_path: Option<std::path::PathBuf>,
    status: String, // "ok" | "skipped" | "error"
    error: Option<String>,
}

/// Phase 3 of `batch_rename_inner`: persist renamed paths in the DB.
///
/// If any DB step fails, the file rename is rolled back (disk stays
/// consistent with the DB) and the outcome is demoted to "error" so the
/// caller is not told a rename succeeded that actually did not.
fn commit_renames(conn: &rusqlite::Connection, outcomes: &mut [RenameOutcome]) {
    for outcome in outcomes.iter_mut() {
        if outcome.status != "ok" {
            continue;
        }
        let Some(new_path) = outcome.new_path.clone() else {
            continue;
        };
        let result = (|| -> Result<(), String> {
            let tx = conn
                .unchecked_transaction()
                .map_err(|e| format!("数据库事务启动失败: {e}"))?;
            let new_path_str = new_path.to_string_lossy().into_owned();
            tx.execute(
                "UPDATE images SET file_path = ?1 WHERE id = ?2",
                params![new_path_str, outcome.id],
            )
            .map_err(|e| format!("数据库更新失败: {e}"))?;
            tx.commit().map_err(|e| format!("数据库提交失败: {e}"))?;
            Ok(())
        })();
        if let Err(msg) = result {
            rollback_rename(&new_path, &outcome.old_path);
            log::error!("rename {} rolled back: {}", outcome.id, msg);
            outcome.status = "error".into();
            outcome.error = Some(msg);
        }
    }
}

/// Undo a file rename after its DB update failed.
fn rollback_rename(new_path: &Path, old_path: &Path) {
    if let Err(e) = std::fs::rename(new_path, old_path) {
        log::error!(
            "Failed to roll back rename {} -> {}: {}",
            new_path.display(),
            old_path.display(),
            e
        );
    }
}

/// Resolve filename conflicts by appending `_1`, `_2`, etc.
/// Checks on-disk existence, names already used within the batch, and paths
/// registered in the DB for other records (which would violate the
/// `file_path` UNIQUE constraint). `own_old_path` is never treated as a
/// conflict so no-op renames keep their name.
fn resolve_conflict(
    parent: &Path,
    desired_name: &str,
    used_names: &std::collections::HashSet<String>,
    db_used_paths: &std::collections::HashSet<String>,
    own_old_path: &Path,
) -> String {
    fn taken(
        parent: &Path,
        candidate: &str,
        used_names: &std::collections::HashSet<String>,
        db_used_paths: &std::collections::HashSet<String>,
        own_old_path: &Path,
    ) -> bool {
        if used_names.contains(candidate) {
            return true;
        }
        let full = parent.join(candidate);
        if full.exists() {
            return true;
        }
        if db_used_paths.contains(full.to_string_lossy().as_ref()) && full != own_old_path {
            return true;
        }
        false
    }

    if !taken(parent, desired_name, used_names, db_used_paths, own_old_path) {
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
        if !taken(parent, &candidate, used_names, db_used_paths, own_old_path) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn used(names: &[&str]) -> HashSet<String> {
        names.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn resolve_conflict_returns_desired_name_when_free() {
        let dir = tempfile::tempdir().unwrap();
        let name = resolve_conflict(dir.path(), "photo.png", &used(&[]), &used(&[]), Path::new(""));
        assert_eq!(name, "photo.png");
    }

    #[test]
    fn resolve_conflict_appends_suffix_for_batch_duplicate() {
        let dir = tempfile::tempdir().unwrap();
        let used_names = used(&["photo.png"]);
        let name =
            resolve_conflict(dir.path(), "photo.png", &used_names, &used(&[]), Path::new(""));
        assert_eq!(name, "photo_1.png");
    }

    #[test]
    fn resolve_conflict_avoids_existing_file_on_disk() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("photo.png"), b"x").unwrap();
        let name = resolve_conflict(dir.path(), "photo.png", &used(&[]), &used(&[]), Path::new(""));
        assert_eq!(name, "photo_1.png");
    }

    #[test]
    fn resolve_conflict_avoids_path_registered_in_db_for_other_record() {
        let dir = tempfile::tempdir().unwrap();
        // Another DB row owns "<dir>/photo.png" even though no such file is
        // on disk (e.g. a reference-mode file that was moved away).
        let db_used = used(&[
            dir.path().join("photo.png").to_string_lossy().as_ref(),
        ]);
        let name = resolve_conflict(dir.path(), "photo.png", &used(&[]), &db_used, Path::new(""));
        assert_eq!(name, "photo_1.png");
    }

    #[test]
    fn resolve_conflict_allows_own_registered_path() {
        let dir = tempfile::tempdir().unwrap();
        // The record's own current path must not count as a conflict,
        // otherwise no-op renames would get spurious suffixes.
        let own = dir.path().join("photo.png");
        let db_used = used(&[own.to_string_lossy().as_ref()]);
        let name = resolve_conflict(dir.path(), "photo.png", &used(&[]), &db_used, &own);
        assert_eq!(name, "photo.png");
    }

    #[test]
    fn resolve_conflict_skips_names_used_by_both_sources() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("photo.png"), b"x").unwrap();
        let used_names = used(&["photo_1.png"]);
        let name =
            resolve_conflict(dir.path(), "photo.png", &used_names, &used(&[]), Path::new(""));
        assert_eq!(name, "photo_2.png");
    }

    #[test]
    fn resolve_conflict_falls_back_to_timestamp_after_exhaustion() {
        let dir = tempfile::tempdir().unwrap();
        let mut used_names: HashSet<String> = (1..999).map(|i| format!("photo_{i}.png")).collect();
        used_names.insert("photo.png".to_string());
        let name =
            resolve_conflict(dir.path(), "photo.png", &used_names, &used(&[]), Path::new(""));
        assert!(name.starts_with("photo_") && name.ends_with(".png"));
        assert!(!used_names.contains(&name));
    }

    fn test_db() -> crate::db::DbHandle {
        crate::db::DbHandle::open_memory().unwrap()
    }

    fn insert_image_at(conn: &rusqlite::Connection, id: &str, path: &str) {
        conn.execute(
            "INSERT INTO images (id, file_path, file_hash, file_size_kb, format, created_at)
             VALUES (?1, ?2, 'h', 1, 'png', '2025-01-01')",
            params![id, path],
        )
        .unwrap();
    }

    #[test]
    fn batch_rename_dry_run_does_not_touch_files() {
        let db = test_db();
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old_cat.png");
        std::fs::write(&old, b"x").unwrap();
        {
            let conn = db.conn().lock().unwrap();
            insert_image_at(&conn, "r1", old.to_str().unwrap());
        }

        let result = batch_rename_inner(&db, vec!["r1".into()], "{id}".into(), true).unwrap();

        assert_eq!(result.renamed, 1);
        assert_eq!(result.items[0].new_name, "r1.png");
        assert!(old.exists());
        assert!(!dir.path().join("r1.png").exists());
    }

    #[test]
    fn batch_rename_moves_file_and_updates_db() {
        let db = test_db();
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old_cat.png");
        std::fs::write(&old, b"x").unwrap();
        {
            let conn = db.conn().lock().unwrap();
            insert_image_at(&conn, "r1", old.to_str().unwrap());
        }

        let result = batch_rename_inner(&db, vec!["r1".into()], "{id}".into(), false).unwrap();

        assert_eq!(result.renamed, 1);
        assert!(!old.exists());
        assert!(dir.path().join("r1.png").exists());
        let conn = db.conn().lock().unwrap();
        let new_path: String = conn
            .query_row("SELECT file_path FROM images WHERE id = 'r1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert!(new_path.ends_with("r1.png"));
    }

    #[test]
    fn batch_rename_skips_when_name_unchanged() {
        let db = test_db();
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("r1.png");
        // No file on disk: desired name equals the old name, so the task is
        // skipped without any I/O (resolve_conflict would otherwise treat the
        // existing file itself as a conflict).
        {
            let conn = db.conn().lock().unwrap();
            insert_image_at(&conn, "r1", old.to_str().unwrap());
        }

        let result = batch_rename_inner(&db, vec!["r1".into()], "{id}".into(), false).unwrap();

        assert_eq!(result.skipped, 1);
        assert_eq!(result.renamed, 0);
    }

    #[test]
    fn batch_rename_reports_missing_image() {
        let db = test_db();
        let result = batch_rename_inner(&db, vec!["nope".into()], "{id}".into(), true).unwrap();
        assert_eq!(result.errors, 1);
        assert_eq!(result.items[0].status, "error");
    }

    #[test]
    fn batch_rename_resolves_conflicts_within_batch() {
        let db = test_db();
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.png");
        let b = dir.path().join("b.png");
        std::fs::write(&a, b"x").unwrap();
        std::fs::write(&b, b"y").unwrap();
        {
            let conn = db.conn().lock().unwrap();
            insert_image_at(&conn, "a", a.to_str().unwrap());
            insert_image_at(&conn, "b", b.to_str().unwrap());
        }

        let result =
            batch_rename_inner(&db, vec!["a".into(), "b".into()], "same".into(), true).unwrap();

        let names: Vec<String> = result.items.iter().map(|i| i.new_name.clone()).collect();
        assert!(names.contains(&"same.png".to_string()));
        assert!(names.contains(&"same_1.png".to_string()));
    }

    #[test]
    fn batch_rename_avoids_paths_registered_in_db() {
        let db = test_db();
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.png");
        std::fs::write(&old, b"x").unwrap();
        {
            let conn = db.conn().lock().unwrap();
            insert_image_at(&conn, "a", old.to_str().unwrap());
            // Another record already owns "<dir>/photo.png" in the DB while
            // the file itself is gone from disk (reference-mode leftover).
            let ghost = dir.path().join("photo.png");
            insert_image_at(&conn, "ghost", ghost.to_str().unwrap());
        }

        let result = batch_rename_inner(&db, vec!["a".into()], "photo".into(), false).unwrap();

        // Without DB-aware conflict resolution the rename would target
        // photo.png, fail the UNIQUE constraint and be rolled back.
        assert_eq!(result.errors, 0);
        assert_eq!(result.renamed, 1);
        assert!(dir.path().join("photo_1.png").exists());
        assert!(!dir.path().join("photo.png").exists());
        let conn = db.conn().lock().unwrap();
        let a_path: String = conn
            .query_row("SELECT file_path FROM images WHERE id = 'a'", [], |r| r.get(0))
            .unwrap();
        assert!(a_path.ends_with("photo_1.png"));
    }

    #[test]
    fn commit_renames_rolls_back_and_reports_error_on_db_failure() {
        let db = test_db();
        let dir = tempfile::tempdir().unwrap();
        let old = dir.path().join("old.png");
        let target = dir.path().join("taken.png");
        std::fs::write(&old, b"x").unwrap();
        std::fs::rename(&old, &target).unwrap(); // simulate phase-2 file rename
        {
            let conn = db.conn().lock().unwrap();
            insert_image_at(&conn, "a", old.to_str().unwrap());
            // Blocker row already holds the target path → UNIQUE violation.
            insert_image_at(&conn, "blocker", target.to_str().unwrap());
        }

        let mut outcomes = vec![RenameOutcome {
            id: "a".into(),
            old_name: "old.png".into(),
            old_path: old.clone(),
            new_name: "taken.png".into(),
            new_path: Some(target.clone()),
            status: "ok".into(),
            error: None,
        }];
        {
            let conn = db.conn().lock().unwrap();
            commit_renames(&conn, &mut outcomes);
        }

        // The outcome must not claim success.
        assert_eq!(outcomes[0].status, "error");
        assert!(outcomes[0].error.as_deref().unwrap().contains("数据库"));
        // The file rename was rolled back: disk matches the unchanged DB row.
        assert!(old.exists());
        assert!(!target.exists());
        let conn = db.conn().lock().unwrap();
        let a_path: String = conn
            .query_row("SELECT file_path FROM images WHERE id = 'a'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(a_path, old.to_string_lossy());
    }
}
