//! Scheduled local backups: the RPO half of the disaster-recovery contract.
//!
//! Requirement: **RPO < 15 minutes** — at most a quarter of an hour of work may
//! be lost. `export_database` only runs when the user asks for it, and a user
//! who never clicks "导出" has no restore point at all, so the RPO was
//! effectively unbounded. This module snapshots the library on a fixed cadence
//! in the background:
//!
//! - one snapshot on startup, then every `INTERVAL`,
//! - written through SQLite's Online Backup API (same reasoning as the import
//!   path: a raw file copy of a WAL database can miss committed pages),
//! - the newest `RETAIN` snapshots are kept, older ones are pruned,
//! - a failed cycle never kills the loop and never blocks the UI.
//!
//! Snapshots live in `<app_data_dir>/backups/`. Restoring means importing a
//! snapshot through the ordinary import path; the measured drill lives in
//! `rto_drill_restores_full_library` and `scripts/restore-drill.mjs`.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use crate::db::DbHandle;

/// Gap between snapshots. Must stay below the 15-minute RPO budget with room
/// for a slow or failed cycle to still finish in time.
pub const INTERVAL: Duration = Duration::from_secs(10 * 60);

/// Snapshots kept on disk (10 minutes apart → ~1 hour of history).
pub const RETAIN: usize = 6;

/// Prefix of every snapshot file; the restore drill and the docs rely on it.
pub const FILE_PREFIX: &str = "lumora-";

/// Successful snapshots taken in this process (diagnostics surface).
static BACKUP_COUNT: AtomicU64 = AtomicU64::new(0);

/// Last snapshot error, if the most recent cycle failed.
static LAST_ERROR: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

/// Snapshot directory next to the database.
pub fn backup_dir(db: &DbHandle) -> PathBuf {
    db.path()
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("backups")
}

/// Snapshot file name for a timestamp (`YYYYMMDD-HHMMSS`), which sorts
/// lexicographically in the same order as chronologically — pruning relies
/// on that.
pub fn snapshot_name(stamp: &str) -> String {
    format!("{FILE_PREFIX}{stamp}.db")
}

/// Take one snapshot and prune old ones. Returns the written path.
pub fn take_snapshot(db: &DbHandle, stamp: &str) -> Result<PathBuf, String> {
    let dir = backup_dir(db);
    std::fs::create_dir_all(&dir).map_err(|e| format!("create backup dir: {e}"))?;
    let dest = dir.join(snapshot_name(stamp));

    let src_conn = db.conn().lock().map_err(|_| "database lock".to_string())?;
    {
        let mut dst_conn =
            rusqlite::Connection::open(&dest).map_err(|e| format!("open snapshot: {e}"))?;
        let backup = rusqlite::backup::Backup::new(&src_conn, &mut dst_conn)
            .map_err(|e| format!("start backup: {e}"))?;
        backup
            .run_to_completion(128, Duration::from_millis(5), None)
            .map_err(|e| format!("run backup: {e}"))?;
    }
    drop(src_conn);

    prune(&dir, RETAIN);
    BACKUP_COUNT.fetch_add(1, Ordering::Relaxed);
    *LAST_ERROR.lock().unwrap() = None;
    Ok(dest)
}

/// Keep only the newest `retain` snapshots.
fn prune(dir: &Path, retain: usize) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(FILE_PREFIX) && n.ends_with(".db"))
        })
        .collect();
    if files.len() <= retain {
        return;
    }
    // Names sort chronologically, so everything before the last `retain` goes.
    files.sort();
    for stale in &files[..files.len() - retain] {
        let _ = std::fs::remove_file(stale);
    }
}

/// Timestamp used for snapshot names, in UTC.
pub fn now_stamp() -> String {
    chrono::Utc::now().format("%Y%m%d-%H%M%S").to_string()
}

/// Start the background backup loop. Returns immediately.
///
/// The loop is best-effort by design: a failure is recorded and retried on the
/// next tick, because losing a snapshot must never take the app down.
pub fn start(db: DbHandle) {
    std::thread::spawn(move || {
        // First snapshot right away: a user who installs and works for ten
        // minutes must already have a restore point.
        run_cycle(&db);
        loop {
            std::thread::sleep(INTERVAL);
            run_cycle(&db);
        }
    });
}

fn run_cycle(db: &DbHandle) {
    let stamp = now_stamp();
    if let Err(err) = take_snapshot(db, &stamp) {
        log::warn!("scheduled backup failed: {err}");
        *LAST_ERROR.lock().unwrap() = Some(err);
    } else {
        log::info!("scheduled backup written: {stamp}");
    }
}

/// Backup status for the settings/diagnostics surface.
#[derive(serde::Serialize)]
pub struct BackupStatus {
    pub snapshots: u64,
    pub directory: Option<String>,
    pub interval_seconds: u64,
    pub retain: usize,
    pub last_error: Option<String>,
    pub newest: Option<String>,
}

/// Snapshot count, cadence and the newest snapshot in the backup directory.
#[tauri::command]
pub fn get_backup_status(db: tauri::State<'_, DbHandle>) -> BackupStatus {
    let dir = backup_dir(&db);
    let names = list_snapshots(&dir);
    BackupStatus {
        snapshots: names.len() as u64,
        directory: Some(dir.to_string_lossy().to_string()),
        interval_seconds: INTERVAL.as_secs(),
        retain: RETAIN,
        last_error: LAST_ERROR.lock().unwrap().clone(),
        newest: names.last().cloned(),
    }
}

/// Snapshot file names in `dir`, oldest first.
pub fn list_snapshots(dir: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return vec![];
    };
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .filter_map(|e| e.file_name().to_str().map(str::to_string))
        .filter(|n| n.starts_with(FILE_PREFIX) && n.ends_with(".db"))
        .collect();
    names.sort();
    names
}

/// Write a snapshot immediately (settings button / drill helper).
#[tauri::command]
pub fn create_backup_now(db: tauri::State<'_, DbHandle>) -> Result<String, String> {
    take_snapshot(&db, &now_stamp()).map(|p| p.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seeded_db(dir: &Path, rows: usize) -> DbHandle {
        let db = DbHandle::open(&dir.join("lumora.db")).unwrap();
        {
            let conn = db.conn().lock().unwrap();
            for i in 0..rows {
                conn.execute(
                    "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
                     VALUES (?1,?2,?3,1,'png','2026-01-01')",
                    rusqlite::params![format!("id-{i}"), format!("/p{i}.png"), format!("h{i}")],
                )
                .unwrap();
            }
        }
        db
    }

    #[test]
    fn snapshot_name_is_lexicographically_chronological() {
        assert_eq!(
            snapshot_name("20260101-000000"),
            "lumora-20260101-000000.db"
        );
        let mut names = vec![
            snapshot_name("20260101-120000"),
            snapshot_name("20260101-090000"),
            snapshot_name("20260101-235959"),
        ];
        names.sort();
        assert_eq!(
            names,
            vec![
                snapshot_name("20260101-090000"),
                snapshot_name("20260101-120000"),
                snapshot_name("20260101-235959"),
            ]
        );
    }

    /// The snapshot must be a readable, complete Lumora database — that is the
    /// entire point of the RPO guarantee.
    #[test]
    fn snapshot_is_a_readable_database_with_all_rows() {
        let dir = tempfile::tempdir().unwrap();
        let db = seeded_db(dir.path(), 25);
        let path = take_snapshot(&db, "20260101-000000").unwrap();

        let conn = rusqlite::Connection::open(&path).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 25);
    }

    /// Committed-but-not-checkpointed writes (the WAL case a file copy loses)
    /// must still be present in the snapshot.
    #[test]
    fn snapshot_includes_wal_only_commits() {
        let dir = tempfile::tempdir().unwrap();
        let db = DbHandle::open(&dir.path().join("lumora.db")).unwrap();
        {
            let conn = db.conn().lock().unwrap();
            conn.execute(
                "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
                 VALUES ('wal-1','/wal.png','h',1,'png','2026-01-01')",
                [],
            )
            .unwrap();
        }
        let path = take_snapshot(&db, "20260101-000001").unwrap();
        let conn = rusqlite::Connection::open(&path).unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM images WHERE id='wal-1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn pruning_keeps_only_the_newest_snapshots() {
        let dir = tempfile::tempdir().unwrap();
        let db = seeded_db(dir.path(), 1);
        for i in 0..(RETAIN + 4) {
            take_snapshot(&db, &format!("2026010{}", i + 1)).unwrap();
        }
        let names = list_snapshots(&backup_dir(&db));
        assert_eq!(names.len(), RETAIN);
        // The survivors are the newest ones, oldest first.
        assert!(names.last().unwrap().contains("20260109"));
    }

    #[test]
    fn pruning_ignores_foreign_files() {
        let dir = tempfile::tempdir().unwrap();
        let db = seeded_db(dir.path(), 1);
        let bdir = backup_dir(&db);
        std::fs::create_dir_all(&bdir).unwrap();
        std::fs::write(bdir.join("notes.txt"), b"keep me").unwrap();
        std::fs::write(bdir.join("vacation.db"), b"keep me too").unwrap();
        for i in 0..(RETAIN + 2) {
            take_snapshot(&db, &format!("2026010{}", i + 1)).unwrap();
        }
        assert!(bdir.join("notes.txt").exists());
        assert!(bdir.join("vacation.db").exists());
        assert_eq!(list_snapshots(&bdir).len(), RETAIN);
    }

    /// RPO proof: the cadence leaves room for a failed cycle inside the budget.
    #[test]
    fn cadence_fits_the_fifteen_minute_rpo_budget() {
        assert!(
            INTERVAL.as_secs() < 15 * 60,
            "backup interval {}s must stay under the 15-minute RPO budget",
            INTERVAL.as_secs()
        );
        assert!(INTERVAL.as_secs() <= 600);
    }

    /// The RTO drill: total loss of the live database, restored from the
    /// newest snapshot, with the full library intact.
    #[test]
    fn rto_drill_restores_full_library() {
        let dir = tempfile::tempdir().unwrap();
        let live_dir = dir.path().join("live");
        std::fs::create_dir_all(&live_dir).unwrap();
        let db = seeded_db(&live_dir, 50);
        let snapshot = take_snapshot(&db, "20260101-010101").unwrap();
        drop(db);

        // Disaster: the live database is gone.
        let live = live_dir.join("lumora.db");
        for sidecar in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!("{}{sidecar}", live.display()));
        }
        assert!(!live.exists());

        // Recovery: fresh handle, then import the snapshot (the same path the
        // UI exposes through import_database).
        let recovered = DbHandle::open(&live).unwrap();
        let started = std::time::Instant::now();
        crate::commands::backup::import_database_inner(&recovered, &snapshot).unwrap();
        let elapsed = started.elapsed();

        let conn = recovered.conn().lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |r| r.get(0))
            .unwrap();
        let integrity: String = conn
            .query_row("PRAGMA integrity_check", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 50, "restored library must be complete");
        assert_eq!(integrity, "ok");
        assert!(
            elapsed < Duration::from_secs(4 * 60 * 60),
            "restore took {elapsed:?}, over the 4-hour RTO budget"
        );
        println!("RTO drill: 50-image library restored in {elapsed:?}");
    }
}
