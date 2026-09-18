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
            let mut done: u64 = 0;
            loop {
                if h.is_cancelled() {
                    return Ok(());
                }
                let batch = {
                    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
                    crate::commands::embeddings::list_missing_embedding_images_db(
                        &conn,
                        BACKFILL_BATCH,
                    )?
                };
                if batch.is_empty() {
                    h.set_message(format!("全部完成，共处理 {done} 张"));
                    return Ok(());
                }
                let mut progressed = 0u64;
                for (image_id, description) in batch {
                    if h.is_cancelled() {
                        return Ok(());
                    }
                    let embedding =
                        crate::provider::embed_text(&app, &cfg, &description, None).await?;
                    let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
                    crate::commands::embeddings::upsert_embedding(&conn, &image_id, &embedding)?;
                    drop(conn);
                    progressed += 1;
                    done += 1;
                    h.set_progress(done, 0);
                }
                // A round that advanced nothing would spin forever on the same
                // batch; stop and say why instead of silently burning CPU.
                if progressed == 0 {
                    return Err(AppError::External(
                        "没有可嵌入的图片（可能嵌入失败）".to_string(),
                    ));
                }
            }
        })
        .await;
    });
    Ok(started_result(&handle, true))
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
    let (handle, is_new) = start_with_total(&registry, JobKind::ScoreMissing, || {
        let conn = db.conn().lock().map_err(|_| AppError::Lock)?;
        let n: i64 = conn.query_row(
            "SELECT COUNT(*) FROM images WHERE deleted = 0 AND score_label IS NULL",
            [],
            |r| r.get(0),
        )?;
        Ok(n as u64)
    })?;
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
    registry.status(id)
}

/// Every job the registry still knows about (running plus recently finished).
#[tauri::command]
pub fn job_list(registry: tauri::State<'_, JobRegistry>) -> Vec<JobStatus> {
    registry.list()
}

/// Ask a job to stop. Returns false when the id is unknown.
///
/// The flag is set immediately; the worker stops at its next checkpoint, so the
/// caller polls `job_status` until the state turns terminal.
#[tauri::command]
pub fn job_cancel(registry: tauri::State<'_, JobRegistry>, id: u64) -> bool {
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
