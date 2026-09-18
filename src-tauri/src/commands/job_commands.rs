//! Tauri commands that expose [`crate::jobs`] to the frontend.
//!
//! The frontend never runs a long loop itself any more. It asks for a job, then
//! polls `job_status` — which is what makes the work observable, cancellable and
//! survivable across a page change.
//!
//! Two shapes live here:
//! - **Async workers** (embeddings, scoring) await network I/O, so they run on
//!   tauri's async runtime via [`run_job_async`].
//! - **Sync workers** (export, convert, import) are pure filesystem/CPU work, so
//!   they are moved to a blocking thread and reported through a bridge thread.
//!   That is what [`spawn_sync_job`] is for.
//!
//! Cancellation semantics differ per job and are documented on each command —
//! the invariant everywhere is that **cancelling never leaves partial state that
//! the user cannot see or cannot retry**.

use tauri::Manager;

use crate::db::DbHandle;
use crate::error::{AppError, AppResult};
use crate::jobs::{JobHandle, JobKind, JobRegistry, JobStatus};

/// Cap on how many images one backfill round processes.
const BACKFILL_BATCH: i64 = 10;

/// Register a job type and hand back the job the caller should follow.
///
/// camelCase on the wire, matching `JobStarted` in `src/lib/api/jobs.ts`.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStarted {
    pub id: u64,
    pub kind: JobKind,
    /// False when an identical job was already running and this call joined it.
    pub is_new: bool,
}

/// What a module-private worker returns, so tests and callers can assert on it.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct JobOutcome {
    pub processed: u64,
    pub failed: u64,
    /// True when the worker stopped early because a cancel was requested.
    pub cancelled: bool,
}

// ---------------------------------------------------------------------------
// start-or-join plumbing
// ---------------------------------------------------------------------------

/// Resolve the item count *before* registering the job, so the progress bar has
/// a real denominator from the first poll instead of "unknown".
fn start_with_total(
    registry: &JobRegistry,
    kind: JobKind,
    count: impl FnOnce() -> AppResult<u64>,
) -> AppResult<(JobHandle, bool)> {
    // A running job already has a total; asking the DB again would be wasted
    // work and could report a different number mid-flight.
    if let Some(existing) = registry
        .list()
        .into_iter()
        .find(|s| s.kind == kind && !s.state.is_terminal())
    {
        if let Some(handle) = registry.handle(existing.id) {
            return Ok((handle, false));
        }
    }
    let total = count().unwrap_or(0);
    let started = registry.start(kind, total)?;
    Ok((started.handle, started.is_new))
}

/// Run a blocking worker on a dedicated thread and mirror its cancel flag.
///
/// The worker is `FnOnce(&JobHandle)`, so it can report progress and check
/// `is_cancelled()` at its own checkpoints. The bridge thread exists so the
/// cancellation *request* is observable while the worker is still running:
/// without it, a cancel that arrives mid-worker would only be seen by the
/// registry after the worker returned.
fn spawn_sync_job<F>(registry: &JobRegistry, kind: JobKind, handle: JobHandle, work: F)
where
    F: FnOnce(&JobHandle) -> AppResult<JobOutcome> + Send + 'static,
{
    let registry = registry.clone();
    let worker_handle = handle.clone();
    let join = std::thread::spawn(move || {
        let outcome =
            std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| work(&worker_handle)));
        match outcome {
            Ok(Ok(o)) => {
                worker_handle.set_progress(o.processed, o.failed);
                if o.cancelled || worker_handle.is_cancelled() {
                    worker_handle.finish_cancelled();
                } else {
                    worker_handle.finish(None);
                }
            }
            Ok(Err(e)) => {
                if worker_handle.is_cancelled() {
                    worker_handle.finish_cancelled();
                } else {
                    worker_handle.fail(e.to_string());
                }
            }
            Err(_) => worker_handle.fail("任务内部错误（已捕获 panic）".to_string()),
        }
    });
    // The kind stays reserved until the bridge settles; parking the join here
    // keeps the registry honest without blocking the command that started it.
    std::thread::spawn(move || {
        let _ = join.join();
        registry.release_kind_if_finished(kind, handle.id());
    });
}

/// Common tail for the two "shape C" entry points.
fn started_result(handle: &JobHandle, is_new: bool) -> JobStarted {
    JobStarted {
        id: handle.id(),
        kind: handle.kind(),
        is_new,
    }
}

// ---------------------------------------------------------------------------
// Async backfills: embeddings and scoring (network-bound)
// ---------------------------------------------------------------------------

/// Start (or join) the text-embedding backfill job.
///
/// Cancellation: checked before every batch and before every item. Images already
/// embedded keep their rows, so stopping early leaves a consistent, resumable
/// library — starting the job again continues where it stopped.
#[tauri::command]
pub async fn job_start_embed_missing(
    app: tauri::AppHandle,
    registry: tauri::State<'_, JobRegistry>,
) -> AppResult<JobStarted> {
    let db = app.state::<DbHandle>().inner().clone();
    let (handle, is_new) = start_with_total(&registry, JobKind::EmbedMissing, || {
        count_missing(&db, "embeddings")
    })?;
    if !is_new {
        return Ok(started_result(&handle, false));
    }

    let cfg = app.state::<crate::ollama::OllamaConfig>().inner().clone();
    // The worker owns a clone; `handle` stays here for the reply, because a
    // `move` block would otherwise take the only handle with it.
    let worker = handle.clone();
    tauri::async_runtime::spawn(async move {
        crate::jobs::run_job_async(&worker, |h| async move {
            backfill_embeddings(
                &h,
                || {
                    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
                    Ok(
                        crate::commands::embeddings::list_missing_embedding_images_db(
                            &conn,
                            BACKFILL_BATCH,
                        )?,
                    )
                },
                |description| {
                    let app = app.clone();
                    let cfg = cfg.clone();
                    async move { crate::provider::embed_text(&app, &cfg, &description, None).await }
                },
                |image_id, embedding| {
                    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
                    crate::commands::embeddings::upsert_embedding(&conn, image_id, embedding)?;
                    Ok(())
                },
            )
            .await
        })
        .await;
    });
    Ok(started_result(&handle, true))
}

/// The text-embedding backfill loop, with its three I/O steps injected.
///
/// Split out from the command so the loop's real behaviour — checkpointing,
/// progress reporting and the stalled-round guard — can be exercised without a
/// Tauri app or a live Ollama (neither of which a unit test can construct).
async fn backfill_embeddings<L, E, Ef, S>(
    handle: &JobHandle,
    mut list_batch: L,
    embed: E,
    mut store: S,
) -> AppResult<()>
where
    L: FnMut() -> AppResult<Vec<(String, String)>>,
    E: Fn(String) -> Ef,
    Ef: std::future::Future<Output = AppResult<Vec<f64>>>,
    S: FnMut(&str, &[f64]) -> AppResult<()>,
{
    let mut done: u64 = 0;
    loop {
        // Checkpoint before doing any work for this round.
        if handle.is_cancelled() {
            return Ok(());
        }
        let batch = list_batch()?;
        if batch.is_empty() {
            handle.set_message(format!("全部完成，共处理 {done} 张"));
            return Ok(());
        }
        let mut progressed = 0u64;
        for (image_id, description) in batch {
            if handle.is_cancelled() {
                return Ok(());
            }
            let embedding = embed(description).await?;
            store(&image_id, &embedding)?;
            progressed += 1;
            done += 1;
            handle.set_progress(done, 0);
        }
        // A round that advanced nothing would spin forever on the same batch;
        // stop and say why instead of silently burning CPU.
        if progressed == 0 {
            return Err(AppError::External(
                "没有可嵌入的图片（可能嵌入失败）".to_string(),
            ));
        }
    }
}

/// Start (or join) the CLIP visual-index backfill job.
///
/// Cancellation: checked between batches. Unreadable images are marked `error`
/// rather than retried, and already-embedded rows are kept, so an interrupted run
/// is resumable.
#[tauri::command]
pub async fn job_start_embed_clip_missing(
    registry: tauri::State<'_, JobRegistry>,
    app: tauri::AppHandle,
) -> AppResult<JobStarted> {
    let db = app.state::<DbHandle>().inner().clone();
    let (handle, is_new) = start_with_total(&registry, JobKind::EmbedClipMissing, || {
        count_missing(&db, "clip_embeddings")
    })?;
    if !is_new {
        return Ok(started_result(&handle, false));
    }

    let worker = handle.clone();
    tauri::async_runtime::spawn(async move {
        crate::jobs::run_job_async(&worker, |h| async move {
            let mut done: u64 = 0;
            let mut failed: u64 = 0;
            loop {
                if h.is_cancelled() {
                    return Ok(());
                }
                let batch = {
                    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
                    crate::commands::embeddings::list_missing_clip_db(&conn, BACKFILL_BATCH)?
                };
                if batch.is_empty() {
                    h.set_message(format!("视觉索引补齐完成，共处理 {done} 张"));
                    return Ok(());
                }
                let paths: Vec<String> = batch.iter().map(|(_, p)| p.clone()).collect();
                // CLIP inference is CPU-bound; keep it off the async executor.
                let embeddings = match tauri::async_runtime::spawn_blocking(move || {
                    crate::commands::clip::clip_embed_images(&paths)
                })
                .await
                {
                    Ok(Ok(v)) => v,
                    Ok(Err(e)) => return Err(e),
                    Err(e) => return Err(AppError::External(format!("CLIP 任务失败: {e}"))),
                };
                for ((image_id, _), embedding) in batch.iter().zip(embeddings) {
                    if h.is_cancelled() {
                        return Ok(());
                    }
                    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
                    match embedding {
                        Some(vec) => crate::commands::embeddings::upsert_clip_embedding(
                            &conn, image_id, &vec,
                        )?,
                        None => {
                            crate::commands::embeddings::mark_clip_error(&conn, image_id)?;
                            failed += 1;
                        }
                    }
                    drop(conn);
                    done += 1;
                    h.set_progress(done, failed);
                }
            }
        })
        .await;
    });
    Ok(started_result(&handle, true))
}

/// Start (or join) the aesthetic-scoring backfill job.
///
/// Cancellation: checked between batches. One sidecar process scores a whole
/// batch (the model loads once), so a cancel lands at the batch boundary;
/// images already scored are persisted and the next run resumes.
#[tauri::command]
pub async fn job_start_score_missing(
    registry: tauri::State<'_, JobRegistry>,
    app: tauri::AppHandle,
) -> AppResult<JobStarted> {
    let db = app.state::<DbHandle>().inner().clone();
    let (handle, is_new) =
        start_with_total(&registry, JobKind::ScoreMissing, || count_unscored(&db))?;
    if !is_new {
        return Ok(started_result(&handle, false));
    }

    // Scoring is a few images per sidecar call: the model load dominates, so a
    // small batch keeps the progress bar honest without re-loading constantly.
    const SCORE_BATCH: i64 = 5;
    let worker = handle.clone();
    tauri::async_runtime::spawn(async move {
        crate::jobs::run_job_async(&worker, |h| async move {
            let mut done: u64 = 0;
            let mut failed: u64 = 0;
            loop {
                if h.is_cancelled() {
                    return Ok(());
                }
                let batch = {
                    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
                    crate::commands::aesthetic::list_missing_score_images_db(&conn, SCORE_BATCH)?
                };
                if batch.is_empty() {
                    h.set_message(format!("审美评审完成，共处理 {done} 张"));
                    return Ok(());
                }
                let items: Vec<(String, String)> = batch
                    .iter()
                    .map(|(_, path, prompt)| (path.clone(), prompt.clone().unwrap_or_default()))
                    .collect();
                let scored = match tauri::async_runtime::spawn_blocking(move || {
                    crate::commands::aesthetic::score_images(&items)
                })
                .await
                {
                    Ok(Ok(v)) => v,
                    Ok(Err(e)) => return Err(e),
                    Err(e) => return Err(AppError::External(format!("审美评审任务失败: {e}"))),
                };
                for ((image_id, _, _), response) in batch.iter().zip(scored) {
                    if h.is_cancelled() {
                        return Ok(());
                    }
                    let usable = response.aesthetic_score.is_some() || response.hps_score.is_some();
                    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
                    crate::commands::aesthetic::save_score(&conn, image_id, &response)?;
                    drop(conn);
                    done += 1;
                    if !usable {
                        failed += 1;
                    }
                    h.set_progress(done, failed);
                }
            }
        })
        .await;
    });
    Ok(started_result(&handle, true))
}

// ---------------------------------------------------------------------------
// Sync jobs: export, convert, import (filesystem-bound)
// ---------------------------------------------------------------------------

/// Start (or join) an export job.
///
/// Cancellation: checked before each item. Export only reads sources, so stopping
/// early needs no rollback — the files already written to `dest_dir` are the
/// user's partial result and stay.
#[tauri::command]
pub async fn job_start_export(
    registry: tauri::State<'_, JobRegistry>,
    app: tauri::AppHandle,
    ids: Vec<String>,
    dest_dir: String,
    format: String,
    rename_template: Option<String>,
) -> AppResult<JobStarted> {
    let db = app.state::<DbHandle>().inner().clone();
    let registry = registry.inner().clone();
    let total = ids.len() as u64;
    let (handle, is_new) = start_with_total(&registry, JobKind::Export, || Ok(total))?;
    if !is_new {
        return Ok(started_result(&handle, false));
    }
    // Clone before the closure: referring to `handle` inside a `move` closure
    // would capture the original and leave nothing to return.
    let worker = handle.clone();
    spawn_sync_job(&registry, JobKind::Export, worker, move |h| {
        let result = crate::commands::export::export_images_inner(
            &db,
            ids,
            dest_dir,
            format,
            rename_template,
            Some(h),
        )?;
        Ok(JobOutcome {
            processed: (result.success + result.failed) as u64,
            failed: result.failed as u64,
            cancelled: h.is_cancelled(),
        })
    });
    Ok(started_result(&handle, true))
}

/// Start (or join) an in-place batch-conversion job.
///
/// Cancellation: checked between items only. The final DB-update phase is
/// deliberately *not* interruptible — at that point new files exist and the
/// database must be moved to point at them as one atomic step. Interrupting
/// inside it would leave the library referencing files that were renamed away.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn job_start_convert(
    registry: tauri::State<'_, JobRegistry>,
    app: tauri::AppHandle,
    ids: Vec<String>,
    format: String,
    quality: Option<u8>,
    max_width: Option<u32>,
    max_height: Option<u32>,
    dest_dir: Option<String>,
) -> AppResult<JobStarted> {
    let db = app.state::<DbHandle>().inner().clone();
    let registry = registry.inner().clone();
    let total = ids.len() as u64;
    let (handle, is_new) = start_with_total(&registry, JobKind::Convert, || Ok(total))?;
    if !is_new {
        return Ok(started_result(&handle, false));
    }
    let worker = handle.clone();
    spawn_sync_job(&registry, JobKind::Convert, worker, move |h| {
        let result = crate::commands::export::batch_convert_inner(
            &db,
            ids,
            format,
            quality,
            max_width,
            max_height,
            dest_dir,
            false, // dry_run: a job that changes nothing would be pointless
            Some(h),
        )?;
        Ok(JobOutcome {
            processed: (result.converted + result.failed + result.skipped) as u64,
            failed: result.failed as u64,
            cancelled: h.is_cancelled(),
        })
    });
    Ok(started_result(&handle, true))
}

/// Start (or join) a folder-import job.
///
/// Cancellation is deliberately limited to the point **before** the import
/// transaction opens. Import is a single all-or-nothing transaction, and copy
/// mode also writes files into the managed library; a cancel in the middle would
/// have to unwind both, and every attempt to make that interruptible risks the
/// one outcome that is not acceptable — a library with half a batch in it and no
/// record of which half. So the scan (which is where the time actually goes on a
/// large folder, because it decodes every candidate) is cancellable, and the
/// commit is not.
#[tauri::command]
pub async fn job_start_import(
    registry: tauri::State<'_, JobRegistry>,
    app: tauri::AppHandle,
    path: String,
) -> AppResult<JobStarted> {
    let registry = registry.inner().clone();
    let (handle, is_new) = start_with_total(&registry, JobKind::Import, || Ok(0))?;
    if !is_new {
        return Ok(started_result(&handle, false));
    }
    let app_clone = app.clone();
    let worker = handle.clone();
    spawn_sync_job(&registry, JobKind::Import, worker, move |h| {
        if h.is_cancelled() {
            return Ok(JobOutcome {
                processed: 0,
                failed: 0,
                cancelled: true,
            });
        }
        let db = app_clone.state::<DbHandle>().inner().clone();
        // The command itself carries the transaction, the grid gate and the
        // copy-mode cleanup; reusing it keeps exactly one import code path.
        let result = crate::commands::images::import_images_at(&app_clone, &db, &path)?;
        Ok(JobOutcome {
            processed: (result.imported + result.skipped + result.rejected) as u64,
            failed: result.rejected as u64,
            cancelled: false,
        })
    });
    Ok(started_result(&handle, true))
}

// ---------------------------------------------------------------------------
// Lifecycle queries
// ---------------------------------------------------------------------------

/// Status of one job, or None once it has been reaped.
#[tauri::command]
pub fn job_status(registry: tauri::State<'_, JobRegistry>, id: u64) -> Option<JobStatus> {
    status_of(&registry, id)
}

/// Every job the registry still knows about (running plus recently finished).
#[tauri::command]
pub fn job_list(registry: tauri::State<'_, JobRegistry>) -> Vec<JobStatus> {
    list_of(&registry)
}

/// Ask a job to stop. Returns false when the id is unknown.
///
/// The flag is set immediately; the worker stops at its next checkpoint, so the
/// caller polls `job_status` until the state turns terminal.
#[tauri::command]
pub fn job_cancel(registry: tauri::State<'_, JobRegistry>, id: u64) -> bool {
    cancel_of(&registry, id)
}

// The bodies take a plain `&JobRegistry` so they can be exercised without a
// Tauri app; the commands above are thin adapters.

fn status_of(registry: &JobRegistry, id: u64) -> Option<JobStatus> {
    registry.status(id)
}

fn list_of(registry: &JobRegistry) -> Vec<JobStatus> {
    registry.list()
}

fn cancel_of(registry: &JobRegistry, id: u64) -> bool {
    registry.cancel(id)
}

/// The kinds a job may have; used by the frontend's type mirror.
#[tauri::command]
pub fn job_kinds() -> Vec<&'static str> {
    [
        JobKind::EmbedMissing,
        JobKind::EmbedClipMissing,
        JobKind::ScoreMissing,
        JobKind::Export,
        JobKind::Convert,
        JobKind::Import,
    ]
    .iter()
    .map(|k| k.as_str())
    .collect()
}

/// Images that have never been judged — the scoring job's progress denominator.
fn count_unscored(db: &DbHandle) -> AppResult<u64> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM images WHERE deleted = 0 AND score_label IS NULL",
        [],
        |r| r.get(0),
    )?;
    Ok(n as u64)
}

/// Images with no row in one of the embedding tables.
///
/// `table` is a trusted literal chosen by the caller (never user input), which is
/// why it can be interpolated into the SQL.
fn count_missing(db: &DbHandle, table: &str) -> AppResult<u64> {
    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
    let sql = format!(
        "SELECT COUNT(*) FROM images i WHERE i.deleted = 0
           AND NOT EXISTS (SELECT 1 FROM {table} t WHERE t.image_id = i.id)"
    );
    let n: i64 = conn
        .query_row(&sql, [], |r| r.get(0))
        .map_err(AppError::from)?;
    Ok(n as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jobs::JobState;

    /// Seed a library where `missing_embed` / `missing_clip` images have no row in
    /// the respective embedding table.
    /// Drive an async worker body without pulling in tokio's `macros` feature.
    fn block_on<F: std::future::Future>(f: F) -> F::Output {
        tauri::async_runtime::block_on(f)
    }

    fn seeded_db(missing_embed: usize, missing_clip: usize, total: usize) -> DbHandle {
        let db = DbHandle::open_memory().unwrap();
        {
            let conn = db.conn().lock().unwrap();
            for i in 0..total {
                conn.execute(
                    "INSERT INTO images (id,file_path,file_hash,file_size_kb,format,created_at)
                     VALUES (?1,?2,?3,1,'png','2026-01-01')",
                    rusqlite::params![format!("img-{i}"), format!("/p{i}.png"), format!("h{i}")],
                )
                .unwrap();
                if i >= missing_embed {
                    conn.execute(
                        "INSERT INTO embeddings (image_id, embedding, dimensions)
                         VALUES (?1, X'00', 512)",
                        rusqlite::params![format!("img-{i}")],
                    )
                    .unwrap();
                }
                if i >= missing_clip {
                    conn.execute(
                        "INSERT INTO clip_embeddings (image_id, embedding, dimensions)
                         VALUES (?1, X'00', 512)",
                        rusqlite::params![format!("img-{i}")],
                    )
                    .unwrap();
                }
            }
        }
        db
    }

    /// Poll until the job leaves a non-terminal state: the sync bridge runs on its
    /// own thread, so a test cannot assume it finished synchronously.
    fn wait_for_terminal(registry: &JobRegistry, id: u64) {
        for _ in 0..500 {
            if registry
                .status(id)
                .map(|s| s.state.is_terminal())
                .unwrap_or(true)
            {
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        panic!("job {id} never reached a terminal state");
    }

    /// The progress denominator must count images with *no* embedding row, not the
    /// library size — otherwise the bar promises work that does not exist.
    #[test]
    fn count_missing_counts_only_images_without_an_embedding_row() {
        let db = seeded_db(3, 5, 10);
        assert_eq!(count_missing(&db, "embeddings").unwrap(), 3);
        assert_eq!(count_missing(&db, "clip_embeddings").unwrap(), 5);
    }

    /// Scoring counts images with no judgment, and must ignore the trash and any
    /// image that already carries a label.
    #[test]
    fn count_unscored_counts_only_unjudged_images() {
        let db = seeded_db(0, 0, 6);
        assert_eq!(count_unscored(&db).unwrap(), 6, "none are judged yet");

        {
            let conn = db.conn().lock().unwrap();
            conn.execute(
                "UPDATE images SET score_label = '夯' WHERE id IN ('img-0','img-1')",
                [],
            )
            .unwrap();
            conn.execute("UPDATE images SET deleted = 1 WHERE id = 'img-2'", [])
                .unwrap();
        }

        // Two judged + one trashed are excluded from the remaining work.
        assert_eq!(count_unscored(&db).unwrap(), 3);
    }

    #[test]
    fn count_missing_ignores_trashed_images() {
        let db = seeded_db(2, 2, 4);
        {
            let conn = db.conn().lock().unwrap();
            conn.execute("UPDATE images SET deleted = 1 WHERE id = 'img-0'", [])
                .unwrap();
        }
        // Seeded with exactly two unscored images; trashing img-0 leaves one, so
        // the counter must exclude deleted rows rather than count the library.
        assert_eq!(count_missing(&db, "embeddings").unwrap(), 1);
    }

    /// Starting the same kind twice hands back the running job instead of making a
    /// second one: this is what makes a double-click safe.
    #[test]
    fn start_with_total_joins_a_running_job_instead_of_duplicating_it() {
        let registry = JobRegistry::new();
        let (first, first_is_new) = start_with_total(&registry, JobKind::Export, || Ok(4)).unwrap();
        assert!(first_is_new);

        let mut recounted = false;
        let (second, second_is_new) = start_with_total(&registry, JobKind::Export, || {
            recounted = true;
            Ok(4)
        })
        .unwrap();

        assert!(!second_is_new, "the second call must join, not start");
        assert_eq!(second.id(), first.id());
        assert!(
            !recounted,
            "a running job already knows its total; re-counting is wasted work"
        );
    }

    /// Once a job ends its kind must be startable again — that is the retry path.
    #[test]
    fn start_with_total_starts_fresh_after_the_previous_job_ended() {
        let registry = JobRegistry::new();
        let (first, _) = start_with_total(&registry, JobKind::Convert, || Ok(2)).unwrap();
        first.fail("转换失败");

        let (second, is_new) = start_with_total(&registry, JobKind::Convert, || Ok(2)).unwrap();
        assert!(is_new, "retry after failure must run a new worker");
        assert_ne!(second.id(), first.id());
    }

    #[test]
    fn start_with_total_still_registers_when_the_count_fails() {
        let registry = JobRegistry::new();
        // An unknown total is not a reason to refuse the work; the UI shows an
        // indeterminate bar instead.
        let (handle, is_new) = start_with_total(&registry, JobKind::Import, || {
            Err(AppError::External("count failed".into()))
        })
        .unwrap();
        assert!(is_new);
        assert_eq!(registry.status(handle.id()).unwrap().total, 0);
    }

    #[test]
    fn started_result_mirrors_the_handle() {
        let registry = JobRegistry::new();
        let (handle, _) = start_with_total(&registry, JobKind::ScoreMissing, || Ok(1)).unwrap();
        let started = started_result(&handle, true);
        assert_eq!(started.id, handle.id());
        assert_eq!(started.kind, JobKind::ScoreMissing);
        assert!(started.is_new);
    }

    /// The sync bridge is what makes export/convert/import observable: it must
    /// settle the job from the worker's outcome, including the cancel case.
    #[test]
    fn spawn_sync_job_settles_success_failure_and_cancel() {
        let registry = JobRegistry::new();

        let (ok, _) = start_with_total(&registry, JobKind::Export, || Ok(2)).unwrap();
        let ok_id = ok.id();
        spawn_sync_job(&registry, JobKind::Export, ok, |h| {
            h.set_progress(2, 0);
            Ok(JobOutcome {
                processed: 2,
                failed: 0,
                cancelled: false,
            })
        });
        wait_for_terminal(&registry, ok_id);
        let s = registry.status(ok_id).unwrap();
        assert_eq!(s.state, JobState::Completed);
        assert_eq!(s.processed, 2);

        let (bad, _) = start_with_total(&registry, JobKind::Convert, || Ok(1)).unwrap();
        let bad_id = bad.id();
        spawn_sync_job(&registry, JobKind::Convert, bad, |_| {
            Err(AppError::External("磁盘满了".into()))
        });
        wait_for_terminal(&registry, bad_id);
        let s = registry.status(bad_id).unwrap();
        assert_eq!(s.state, JobState::Failed);
        assert!(s.message.unwrap().contains("磁盘满了"));

        // A worker stopped by a cancel reports Cancelled even though it unwound
        // through the error path.
        let (stopped, _) = start_with_total(&registry, JobKind::Import, || Ok(1)).unwrap();
        let stopped_id = stopped.id();
        assert!(registry.cancel(stopped_id));
        spawn_sync_job(&registry, JobKind::Import, stopped, |_| {
            Err(AppError::External("aborted".into()))
        });
        wait_for_terminal(&registry, stopped_id);
        assert_eq!(
            registry.status(stopped_id).unwrap().state,
            JobState::Cancelled
        );
    }

    #[test]
    fn spawn_sync_job_honours_a_cancel_reported_by_the_worker_itself() {
        let registry = JobRegistry::new();
        let (handle, _) = start_with_total(&registry, JobKind::Export, || Ok(5)).unwrap();
        let id = handle.id();
        spawn_sync_job(&registry, JobKind::Export, handle, |_| {
            // The worker stopped early and says so, without an error.
            Ok(JobOutcome {
                processed: 2,
                failed: 0,
                cancelled: true,
            })
        });
        wait_for_terminal(&registry, id);
        let s = registry.status(id).unwrap();
        assert_eq!(s.state, JobState::Cancelled);
        // Partial progress is the user's to keep.
        assert_eq!(s.processed, 2);
    }

    /// A panicking worker must not leave the job Running forever.
    #[test]
    fn spawn_sync_job_turns_a_panic_into_a_failure() {
        let registry = JobRegistry::new();
        let (handle, _) = start_with_total(&registry, JobKind::Export, || Ok(1)).unwrap();
        let id = handle.id();
        let previous = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        spawn_sync_job(&registry, JobKind::Export, handle, |_| {
            panic!("worker exploded")
        });
        wait_for_terminal(&registry, id);
        std::panic::set_hook(previous);
        assert_eq!(registry.status(id).unwrap().state, JobState::Failed);
        assert_eq!(registry.active_count(), 0);
    }

    /// The lifecycle queries the frontend polls. `tauri::State` is a wrapper around
    /// a borrowed value, so these can be driven with a plain registry — the same
    /// path the commands take.
    #[test]
    fn status_list_and_cancel_delegate_to_the_registry() {
        let registry = JobRegistry::new();
        let (handle, _) = start_with_total(&registry, JobKind::EmbedMissing, || Ok(9)).unwrap();
        let id = handle.id();

        let status = status_of(&registry, id).expect("job must be visible");
        assert_eq!(status.id, id);
        assert_eq!(status.total, 9);

        let listed = list_of(&registry);
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, id);

        assert!(cancel_of(&registry, id));
        assert!(
            status_of(&registry, id).unwrap().cancel_requested,
            "the cancel must be visible to the next poll"
        );

        // Unknown ids are answered, not panicked on.
        assert!(status_of(&registry, 404).is_none());
        assert!(!cancel_of(&registry, 404));
    }

    /// The embed loop, with its I/O faked: this is where checkpointing, progress
    /// and the stalled-round guard actually live.
    #[test]
    fn backfill_embeddings_processes_rounds_and_reports_progress() {
        let registry = JobRegistry::new();
        let (handle, _) = start_with_total(&registry, JobKind::EmbedMissing, || Ok(3)).unwrap();
        let id = handle.id();
        // Called directly rather than through run_job_async, so the test also owns
        // the state transition the runner would normally make.
        handle.mark_running();

        // Two rounds: three items, then empty.
        let mut rounds: Vec<AppResult<Vec<(String, String)>>> = vec![
            Ok(vec![
                ("img-0".to_string(), "a cat".to_string()),
                ("img-1".to_string(), "a dog".to_string()),
                ("img-2".to_string(), "a bird".to_string()),
            ]),
            Ok(vec![]),
        ];
        let stored = std::cell::RefCell::new(Vec::new());

        block_on(backfill_embeddings(
            &handle,
            || rounds.remove(0),
            |description| async move { Ok(vec![description.len() as f64]) },
            |image_id, embedding| {
                stored
                    .borrow_mut()
                    .push((image_id.to_string(), embedding[0]));
                Ok(())
            },
        ))
        .unwrap();

        let s = registry.status(id).unwrap();
        // The worker only reports; turning its return value into a terminal state is
        // `run_job_async`'s job (covered in jobs.rs). What this test owns is the
        // progress and the completion message.
        assert_eq!(s.processed, 3);
        assert!(
            s.message.as_deref().unwrap_or("").contains("全部完成"),
            "a finished backfill must say so: {:?}",
            s.message
        );
        let stored = stored.into_inner();
        assert_eq!(stored.len(), 3);
        assert_eq!(stored[0].0, "img-0");
        assert_eq!(stored[0].1, 5.0, "the stub embeds by description length");
    }

    /// A cancel must stop the loop at the next checkpoint and keep what is done.
    #[test]
    fn backfill_embeddings_stops_at_a_checkpoint_when_cancelled() {
        let registry = JobRegistry::new();
        let (handle, _) = start_with_total(&registry, JobKind::EmbedMissing, || Ok(2)).unwrap();
        let id = handle.id();
        handle.mark_running();
        let cancel_on_second = handle.clone();
        let seen = std::cell::Cell::new(0u32);

        block_on(backfill_embeddings(
            &handle,
            || {
                Ok(vec![
                    ("img-0".to_string(), "one".to_string()),
                    ("img-1".to_string(), "two".to_string()),
                ])
            },
            |_| async move { Ok(vec![0.0]) },
            |_, _| {
                let n = seen.get() + 1;
                seen.set(n);
                if n == 1 {
                    // The user presses Cancel while the first item is stored.
                    cancel_on_second.request_cancel_for_test();
                }
                Ok(())
            },
        ))
        .unwrap();

        assert_eq!(seen.get(), 1, "the loop must stop before the second item");
        let s = registry.status(id).unwrap();
        assert_eq!(s.processed, 1, "the finished item is kept");
    }

    /// A round where every item failed would otherwise spin forever on the same
    /// batch; it must surface an error instead.
    #[test]
    fn backfill_embeddings_gives_up_when_a_round_advances_nothing() {
        let registry = JobRegistry::new();
        let (handle, _) = start_with_total(&registry, JobKind::EmbedMissing, || Ok(1)).unwrap();

        let err = block_on(backfill_embeddings(
            &handle,
            || Ok(vec![("img-0".to_string(), "x".to_string())]),
            |_| async move { Err(AppError::External("ollama offline".into())) },
            |_, _| Ok(()),
        ));

        // The error propagates; what matters is that it does NOT loop.
        assert!(err.is_err());
    }

    #[test]
    fn backfill_embeddings_stops_immediately_when_already_cancelled() {
        let registry = JobRegistry::new();
        let (handle, _) = start_with_total(&registry, JobKind::EmbedMissing, || Ok(1)).unwrap();
        assert!(registry.cancel(handle.id()));
        let mut listed = false;

        block_on(backfill_embeddings(
            &handle,
            || {
                listed = true;
                Ok(vec![])
            },
            |_| async move { Ok(vec![]) },
            |_, _| Ok(()),
        ))
        .unwrap();

        assert!(!listed, "a cancelled job must not even read a batch");
    }

    #[test]
    fn job_kinds_lists_every_supported_kind() {
        assert_eq!(
            job_kinds(),
            vec![
                "embed_missing",
                "embed_clip_missing",
                "score_missing",
                "export",
                "convert",
                "import"
            ]
        );
    }
}
