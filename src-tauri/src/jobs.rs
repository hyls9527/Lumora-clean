//! Background jobs: cancellation and progress for long-running work.
//!
//! Long operations (embedding backfill, aesthetic scoring, export, convert,
//! import) used to be plain Tauri commands that ran to completion with no way
//! to observe or interrupt them. On a 10k-image library that means a misclick
//! costs tens of minutes with no escape hatch, the UI can only show "busy",
//! and closing the window throws the remaining work away.
//!
//! This module is the process-side half of the fix, modelled on the session
//! discipline of the `bsk` browser daemon:
//!
//! - **Explicit lifecycle** — a job is started, reports progress, and ends in a
//!   terminal state. Nothing runs detached and unobservable.
//! - **Cancellation is cooperative and immediate** — a worker checks its token
//!   between items and stops at the next boundary, keeping what it finished.
//! - **One job per kind** — a second start of the same kind returns the running
//!   job instead of launching a competing one (the daemon's "previous session
//!   command is still running" rule).
//! - **Terminal jobs are reaped** — finished jobs are evicted from the registry
//!   after a grace period so a long-lived process cannot accumulate them.
//!
//! The registry only coordinates; it never performs work itself. Workers receive
//! a [`JobHandle`] and are responsible for calling `set_progress`/`finish`.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::error::AppResult;

/// How long a finished job stays readable after it ends.
///
/// The frontend needs to read the final state (counts, "cancelled" vs
/// "completed") after the worker stops, so eviction cannot be immediate; but it
/// must not be unbounded either.
pub const TERMINAL_GRACE: Duration = Duration::from_secs(60);

/// Identifies what a job is doing. One job per kind may run at a time.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobKind {
    EmbedMissing,
    EmbedClipMissing,
    ScoreMissing,
    Export,
    Convert,
    Import,
}

impl JobKind {
    /// Stable identifier used by the frontend and in logs.
    pub fn as_str(self) -> &'static str {
        match self {
            JobKind::EmbedMissing => "embed_missing",
            JobKind::EmbedClipMissing => "embed_clip_missing",
            JobKind::ScoreMissing => "score_missing",
            JobKind::Export => "export",
            JobKind::Convert => "convert",
            JobKind::Import => "import",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobState {
    /// Registered, worker not yet scheduled.
    #[default]
    Pending,
    Running,
    Completed,
    /// Stopped by request; whatever finished before the cancel point is kept.
    Cancelled,
    Failed,
}

impl JobState {
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            JobState::Completed | JobState::Cancelled | JobState::Failed
        )
    }
}

/// A point-in-time view of a job, handed to the frontend.
///
/// camelCase on the wire: it mirrors the TypeScript `JobStatus` in
/// `src/lib/api/jobs.ts`, and the repo's convention for multi-word fields
/// (`#[serde(rename_all = "camelCase")]` on the other FFI types).
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStatus {
    pub id: u64,
    pub kind: JobKind,
    pub state: JobState,
    /// Items attempted so far (successes and failures both count).
    pub processed: u64,
    /// Item count the job set out to do; 0 when unknown up front.
    pub total: u64,
    /// Items that failed and were skipped.
    pub failed: u64,
    /// Last human-readable note (error message, or the final summary).
    pub message: Option<String>,
    pub started_at_ms: u64,
    pub updated_at_ms: u64,
    /// True once a cancel request has been observed by the registry, whether or
    /// not the worker has stopped yet.
    pub cancel_requested: bool,
}

impl JobStatus {
    /// Completion in percent, or None when the total is not yet known.
    ///
    /// Part of the payload the frontend renders; the UI is wired separately, so
    /// the compiler cannot see a caller yet.
    #[allow(dead_code)]
    pub fn percent(&self) -> Option<u8> {
        if self.total == 0 {
            return None;
        }
        // Saturating: a worker must never be able to report >100%.
        let pct = (self.processed.saturating_mul(100)) / self.total;
        Some(pct.min(100) as u8)
    }
}

/// Shared slot between the registry and one worker.
#[derive(Debug, Default)]
struct SlotInner {
    state: JobState,
    processed: u64,
    failed: u64,
    message: Option<String>,
    updated_at_ms: u64,
}

#[derive(Debug, Default)]
struct Slot {
    inner: Mutex<SlotInner>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// The worker's handle to its own job.
///
/// Cheap to clone (Arc inside) so it can be moved into the closure that does the
/// work. Every method is safe to call from any thread.
#[derive(Clone)]
pub struct JobHandle {
    id: u64,
    kind: JobKind,
    total: u64,
    started_at_ms: u64,
    cancelled: Arc<AtomicBool>,
    slot: Arc<Slot>,
    /// Clears this job's entry in the registry's kind map when the job ends.
    ///
    /// Behind a shared cell rather than a `OnceLock` because the callback is
    /// installed *after* the handle exists (it has to know the job's id) and the
    /// handle must stay `Clone`. `None` on handles that never registered.
    #[allow(clippy::type_complexity)]
    release: Arc<Mutex<Option<Arc<dyn Fn() + Send + Sync>>>>,
}

impl JobHandle {
    pub fn id(&self) -> u64 {
        self.id
    }

    pub fn kind(&self) -> JobKind {
        self.kind
    }

    /// True once the user asked to cancel. Workers call this between items.
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    /// Mark the job as actively running (called by the worker on entry).
    pub fn mark_running(&self) {
        self.update(|s| s.state = JobState::Running);
    }

    /// Report progress. `processed` is absolute, not a delta.
    pub fn set_progress(&self, processed: u64, failed: u64) {
        self.update(|s| {
            s.processed = processed;
            s.failed = failed;
        });
    }

    /// Attach a human-readable note (kept until replaced or finished).
    pub fn set_message(&self, message: impl Into<String>) {
        let m = message.into();
        self.update(|s| s.message = Some(m));
    }

    /// End the job as completed, with an optional summary note.
    pub fn finish(&self, message: Option<String>) {
        self.update(|s| {
            s.state = JobState::Completed;
            if message.is_some() {
                s.message = message;
            }
        });
        self.on_terminal();
    }

    /// End the job as cancelled. Progress made so far is preserved.
    pub fn finish_cancelled(&self) {
        self.update(|s| {
            s.state = JobState::Cancelled;
            s.message = Some("已取消".to_string());
        });
        self.on_terminal();
    }

    /// End the job as failed and record why.
    pub fn fail(&self, message: impl Into<String>) {
        let m = message.into();
        self.update(|s| {
            s.state = JobState::Failed;
            s.message = Some(m);
        });
        self.on_terminal();
    }

    /// Release this job's kind so the next job of the same kind can start.
    ///
    /// Without this a finished job kept its kind reserved forever and the next
    /// `start` of that kind silently joined a dead job instead of running — the
    /// retry-after-failure path, which is exactly when a user retries.
    fn on_terminal(&self) {
        let release = self
            .release
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        if let Some(release) = release {
            release();
        }
    }

    /// Set the cancel flag directly.
    ///
    /// The registry's `cancel` is the production path; this seam exists so tests
    /// can model "the user cancelled while the worker held the handle" without
    /// also holding the registry the worker needs.
    #[cfg(test)]
    pub fn request_cancel_for_test(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }

    /// Borrow the registry-side status described by this handle.
    pub fn status(&self) -> JobStatus {
        let inner = self.slot.inner.lock().unwrap_or_else(|e| e.into_inner());
        JobStatus {
            id: self.id,
            kind: self.kind,
            state: inner.state,
            processed: inner.processed,
            total: self.total,
            failed: inner.failed,
            message: inner.message.clone(),
            started_at_ms: self.started_at_ms,
            updated_at_ms: inner.updated_at_ms,
            cancel_requested: self.is_cancelled(),
        }
    }

    fn update(&self, f: impl FnOnce(&mut SlotInner)) {
        let mut inner = self.slot.inner.lock().unwrap_or_else(|e| e.into_inner());
        f(&mut inner);
        inner.updated_at_ms = now_ms();
    }
}

/// Process-wide job registry. Cheap to clone; share one via Tauri managed state.
#[derive(Clone, Default)]
pub struct JobRegistry {
    inner: Arc<RegistryInner>,
}

#[derive(Default)]
struct RegistryInner {
    next_id: AtomicU64,
    slots: Mutex<HashMap<u64, Arc<Slot>>>,
    handles: Mutex<HashMap<u64, JobHandle>>,
    /// One running job per kind.
    active: Mutex<HashMap<JobKind, u64>>,
}

impl std::fmt::Debug for JobRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JobRegistry")
            .field("active", &self.active_count())
            .finish()
    }
}

impl JobRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a job and return its handle, or the already-running job of the
    /// same kind.
    ///
    /// Starting a second job of a kind that is already running is not an error —
    /// it is the common case of a user double-clicking. The caller gets the
    /// handle it should follow, and `is_new` tells it whether it now owns the
    /// worker (and therefore must spawn it) or is merely observing.
    pub fn start(&self, kind: JobKind, total: u64) -> AppResult<StartedJob> {
        self.reap_expired();
        {
            let active = self.inner.active.lock().unwrap_or_else(|e| e.into_inner());
            if let Some(existing_id) = active.get(&kind) {
                let handles = self.inner.handles.lock().unwrap_or_else(|e| e.into_inner());
                // Only a *running* job blocks a new one. A finished job stays
                // readable for a while (the UI reads its final counts) but must
                // not wedge the kind: "start again after it finished" is the
                // normal retry path.
                if let Some(handle) = handles
                    .get(existing_id)
                    .filter(|h| !h.status().state.is_terminal())
                {
                    return Ok(StartedJob {
                        handle: handle.clone(),
                        is_new: false,
                    });
                }
            }
        }

        let id = self.inner.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let slot = Arc::new(Slot::default());
        let handle = JobHandle {
            id,
            kind,
            total,
            started_at_ms: now_ms(),
            cancelled: Arc::new(AtomicBool::new(false)),
            slot: slot.clone(),
            release: Arc::new(Mutex::new(None)),
        };
        {
            let mut slots = self.inner.slots.lock().unwrap_or_else(|e| e.into_inner());
            slots.insert(id, slot);
        }
        {
            let mut handles = self.inner.handles.lock().unwrap_or_else(|e| e.into_inner());
            handles.insert(id, handle.clone());
        }
        {
            let mut active = self.inner.active.lock().unwrap_or_else(|e| e.into_inner());
            active.insert(kind, id);
        }
        // The handle must be able to release its own kind when it ends. A Weak
        // back-reference keeps the closure from creating a reference cycle with
        // the handle the registry is storing.
        let weak = Arc::downgrade(&self.inner);
        let release: Arc<dyn Fn() + Send + Sync> = Arc::new(move || {
            let Some(inner) = weak.upgrade() else {
                return;
            };
            let mut active = inner.active.lock().unwrap_or_else(|e| e.into_inner());
            if active.get(&kind) == Some(&id) {
                active.remove(&kind);
            }
        });
        *handle.release.lock().unwrap_or_else(|e| e.into_inner()) = Some(release);
        Ok(StartedJob {
            handle,
            is_new: true,
        })
    }

    /// Request cancellation of a job. Returns false when the id is unknown.
    ///
    /// The flag is set immediately; the worker observes it at its next
    /// checkpoint, so a caller must poll the status to know when it stopped.
    pub fn cancel(&self, id: u64) -> bool {
        let handles = self.inner.handles.lock().unwrap_or_else(|e| e.into_inner());
        match handles.get(&id) {
            Some(handle) => {
                handle.cancelled.store(true, Ordering::Relaxed);
                handle.update(|s| {
                    if !s.state.is_terminal() {
                        s.message = Some("正在取消…".to_string());
                    }
                });
                true
            }
            None => false,
        }
    }

    /// Current status of one job, or None when the id is unknown/expired.
    pub fn status(&self, id: u64) -> Option<JobStatus> {
        let handles = self.inner.handles.lock().unwrap_or_else(|e| e.into_inner());
        handles.get(&id).map(JobHandle::status)
    }

    /// The handle for a job that is already registered.
    ///
    /// Lets a caller *join* a running job (same kind) and follow it without
    /// registering anything new — the double-click path.
    pub fn handle(&self, id: u64) -> Option<JobHandle> {
        let handles = self.inner.handles.lock().unwrap_or_else(|e| e.into_inner());
        handles.get(&id).cloned()
    }

    /// Release a job's kind if that job has finished.
    ///
    /// Used by workers that run on their own thread and settle the job from
    /// outside `run_job`. A no-op while the job is still running, so calling it
    /// too early can never free a kind that is still in use.
    pub fn release_kind_if_finished(&self, kind: JobKind, id: u64) {
        let finished = self
            .status(id)
            .map(|s| s.state.is_terminal())
            .unwrap_or(false);
        if !finished {
            return;
        }
        let mut active = self.inner.active.lock().unwrap_or_else(|e| e.into_inner());
        if active.get(&kind) == Some(&id) {
            active.remove(&kind);
        }
    }

    /// Every job still in the registry (running plus recently finished).
    pub fn list(&self) -> Vec<JobStatus> {
        let handles = self.inner.handles.lock().unwrap_or_else(|e| e.into_inner());
        let mut out: Vec<JobStatus> = handles.values().map(JobHandle::status).collect();
        out.sort_by_key(|s| s.id);
        out
    }

    /// Number of jobs that have not reached a terminal state.
    ///
    /// Deliberately counted from the handles rather than the `active` map: the
    /// map keeps an entry after a job ends so the kind stays discoverable, so its
    /// length would report finished work as active.
    pub fn active_count(&self) -> usize {
        let handles = self.inner.handles.lock().unwrap_or_else(|e| e.into_inner());
        handles
            .values()
            .filter(|h| !h.status().state.is_terminal())
            .count()
    }

    /// Drop jobs that finished more than [`TERMINAL_GRACE`] ago.
    ///
    /// Called opportunistically from `start`; a long-lived process must not grow
    /// its registry forever just because it ran many jobs.
    pub fn reap_expired(&self) -> usize {
        let cutoff = now_ms().saturating_sub(TERMINAL_GRACE.as_millis() as u64);
        let mut expired: Vec<(u64, JobKind)> = Vec::new();
        {
            let handles = self.inner.handles.lock().unwrap_or_else(|e| e.into_inner());
            for (id, handle) in handles.iter() {
                let status = handle.status();
                if status.state.is_terminal() && status.updated_at_ms < cutoff {
                    expired.push((*id, status.kind));
                }
            }
        }
        if expired.is_empty() {
            return 0;
        }
        {
            let mut handles = self.inner.handles.lock().unwrap_or_else(|e| e.into_inner());
            let mut slots = self.inner.slots.lock().unwrap_or_else(|e| e.into_inner());
            for (id, _) in &expired {
                handles.remove(id);
                slots.remove(id);
            }
        }
        {
            let mut active = self.inner.active.lock().unwrap_or_else(|e| e.into_inner());
            for (id, kind) in &expired {
                // Only clear the slot if it still points at the job we reaped; a
                // newer job of the same kind must not be unregistered by an old
                // one's eviction.
                if active.get(kind) == Some(id) {
                    active.remove(kind);
                }
            }
        }
        expired.len()
    }
}

/// Result of [`JobRegistry::start`].
pub struct StartedJob {
    pub handle: JobHandle,
    /// True when this call created the job and must run the worker.
    pub is_new: bool,
}

/// Async sibling of [`run_job`] for workers that await I/O (LLM calls, HTTP).
///
/// Same guarantees, expressed differently: a cancel request or an error is
/// mapped to the matching terminal state, and the job always leaves `Running`.
/// Async sibling of [`run_job`] for workers that await I/O (embeddings, HTTP).
///
/// Same guarantees, expressed differently: a cancel or an error maps to the
/// matching terminal state, so a job never stays `Running` after its work ended.
pub async fn run_job_async<F, Fut>(handle: &JobHandle, work: F)
where
    F: FnOnce(JobHandle) -> Fut,
    Fut: std::future::Future<Output = AppResult<()>>,
{
    handle.mark_running();
    match work(handle.clone()).await {
        Ok(()) => {
            if handle.is_cancelled() {
                handle.finish_cancelled();
            } else {
                handle.finish(None);
            }
        }
        Err(e) => {
            if handle.is_cancelled() {
                handle.finish_cancelled();
            } else {
                handle.fail(e.to_string());
            }
        }
    }
}

/// Synchronous sibling of [`run_job_async`].
///
/// Every shipping worker is either async (embeddings, scoring) or wrapped by the
/// command layer's thread bridge (export, convert, import), so this exists for
/// callers that own their own thread — and it keeps the terminal-state
/// guarantees covered by tests.
#[cfg(test)]
pub fn run_job<F>(handle: &JobHandle, work: F)
where
    F: FnOnce(&JobHandle) -> AppResult<()>,
{
    handle.mark_running();
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| work(handle)));
    match outcome {
        Ok(Ok(())) => {
            if handle.is_cancelled() {
                handle.finish_cancelled();
            } else {
                handle.finish(None);
            }
        }
        Ok(Err(e)) => {
            if handle.is_cancelled() {
                handle.finish_cancelled();
            } else {
                handle.fail(e.to_string());
            }
        }
        Err(_) => {
            handle.fail("任务内部错误（已捕获 panic）".to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_returns_a_new_job_and_marks_it_active() {
        let reg = JobRegistry::new();
        let started = reg.start(JobKind::EmbedMissing, 10).unwrap();
        assert!(started.is_new);
        assert_eq!(started.handle.kind(), JobKind::EmbedMissing);
        assert_eq!(reg.active_count(), 1);
        let status = reg.status(started.handle.id()).unwrap();
        assert_eq!(status.state, JobState::Pending);
        assert_eq!(status.total, 10);
        assert!(!status.cancel_requested);
    }

    /// Double-clicking must not launch a second competing worker: the caller
    /// gets the running job back and is told it does not own the worker.
    #[test]
    fn second_start_of_same_kind_joins_the_running_job() {
        let reg = JobRegistry::new();
        let first = reg.start(JobKind::Export, 5).unwrap();
        let second = reg.start(JobKind::Export, 5).unwrap();
        assert!(first.is_new);
        assert!(!second.is_new, "second start must not create a job");
        assert_eq!(second.handle.id(), first.handle.id());
        assert_eq!(reg.active_count(), 1);
        assert_eq!(reg.list().len(), 1);
    }

    /// Different kinds are independent: an export may run while embeddings fill.
    #[test]
    fn different_kinds_run_concurrently() {
        let reg = JobRegistry::new();
        let a = reg.start(JobKind::Export, 1).unwrap();
        let b = reg.start(JobKind::Import, 1).unwrap();
        assert!(a.is_new && b.is_new);
        assert_ne!(a.handle.id(), b.handle.id());
        assert_eq!(reg.active_count(), 2);
    }

    #[test]
    fn progress_and_failures_are_reported() {
        let reg = JobRegistry::new();
        let h = reg.start(JobKind::ScoreMissing, 200).unwrap().handle;
        h.mark_running();
        h.set_progress(50, 3);
        let s = reg.status(h.id()).unwrap();
        assert_eq!(s.state, JobState::Running);
        assert_eq!(s.processed, 50);
        assert_eq!(s.failed, 3);
        assert_eq!(s.percent(), Some(25));
        // Rounded down, never up: 199/200 must not read as "done".
        h.set_progress(199, 0);
        assert_eq!(reg.status(h.id()).unwrap().percent(), Some(99));
        h.set_progress(200, 0);
        assert_eq!(reg.status(h.id()).unwrap().percent(), Some(100));
    }

    #[test]
    fn percent_is_none_without_a_known_total_and_caps_at_100() {
        let reg = JobRegistry::new();
        let h = reg.start(JobKind::Import, 0).unwrap().handle;
        assert_eq!(reg.status(h.id()).unwrap().percent(), None);

        // A worker must never be able to render more than 100%.
        let h2 = reg.start(JobKind::Export, 10).unwrap().handle;
        h2.set_progress(99, 0);
        assert_eq!(reg.status(h2.id()).unwrap().percent(), Some(100));
    }

    #[test]
    fn cancel_sets_the_flag_and_is_visible_before_the_worker_stops() {
        let reg = JobRegistry::new();
        let h = reg.start(JobKind::EmbedMissing, 100).unwrap().handle;
        h.mark_running();
        assert!(!h.is_cancelled());
        assert!(reg.cancel(h.id()));
        assert!(h.is_cancelled(), "worker must observe the cancel flag");
        let s = reg.status(h.id()).unwrap();
        assert!(s.cancel_requested);
        assert_eq!(
            s.state,
            JobState::Running,
            "flag alone must not end the job"
        );
    }

    #[test]
    fn cancel_of_unknown_id_is_false_not_an_error() {
        let reg = JobRegistry::new();
        assert!(!reg.cancel(4242));
        assert!(reg.status(4242).is_none());
    }

    #[test]
    fn finished_jobs_preserve_the_work_they_completed() {
        let reg = JobRegistry::new();
        let h = reg.start(JobKind::EmbedMissing, 100).unwrap().handle;
        h.mark_running();
        h.set_progress(40, 0);
        h.finish_cancelled();
        let s = reg.status(h.id()).unwrap();
        assert_eq!(s.state, JobState::Cancelled);
        assert_eq!(s.processed, 40, "partial progress must survive a cancel");
        assert_eq!(reg.active_count(), 0, "a terminal job frees its kind");
    }

    #[test]
    fn a_terminal_job_frees_its_kind_for_the_next_start() {
        let reg = JobRegistry::new();
        let first = reg.start(JobKind::Export, 1).unwrap().handle;
        first.finish(None);
        let second = reg.start(JobKind::Export, 1).unwrap();
        assert!(second.is_new, "a finished job must not block a new one");
        assert_ne!(second.handle.id(), first.id());
    }

    #[test]
    fn terminal_jobs_are_reaped_after_the_grace_period() {
        let reg = JobRegistry::new();
        let h = reg.start(JobKind::Convert, 1).unwrap().handle;
        h.finish(None);
        assert_eq!(
            reg.reap_expired(),
            0,
            "fresh terminal job must stay readable"
        );
        {
            let mut inner = h.slot.inner.lock().unwrap();
            inner.updated_at_ms = now_ms().saturating_sub(TERMINAL_GRACE.as_millis() as u64 + 1);
        }
        assert_eq!(reg.reap_expired(), 1);
        assert!(reg.status(h.id()).is_none());
        assert!(reg.list().is_empty());
    }

    /// An ended job must release its kind immediately, so the very next start
    /// of that kind runs instead of silently joining a job that is already
    /// over. This is the retry-after-failure path.
    #[test]
    fn an_ended_job_releases_its_kind_immediately() {
        let reg = JobRegistry::new();
        let old = reg.start(JobKind::Export, 1).unwrap().handle;
        old.mark_running();
        old.fail("导出失败");
        assert_eq!(reg.active_count(), 0);

        let retry = reg.start(JobKind::Export, 1).unwrap();
        assert!(retry.is_new, "retry after failure must run a new worker");
        assert_ne!(retry.handle.id(), old.id());

        // The failed job stays readable (the UI shows why), and reaping it must
        // not disturb the job that replaced it.
        assert!(reg.status(old.id()).is_some());
        {
            let mut inner = old.slot.inner.lock().unwrap();
            inner.updated_at_ms = now_ms().saturating_sub(TERMINAL_GRACE.as_millis() as u64 + 1);
        }
        assert_eq!(reg.reap_expired(), 1, "only the finished job is evicted");
        assert!(reg.status(old.id()).is_none());
        assert!(reg.status(retry.handle.id()).is_some());
        assert_eq!(reg.active_count(), 1, "the replacement keeps running");
    }

    #[test]
    fn run_job_marks_success_and_failure() {
        let reg = JobRegistry::new();
        let ok = reg.start(JobKind::Export, 1).unwrap().handle;
        run_job(&ok, |h| {
            assert!(!h.is_cancelled());
            Ok(())
        });
        assert_eq!(reg.status(ok.id()).unwrap().state, JobState::Completed);

        let bad = reg.start(JobKind::Import, 1).unwrap().handle;
        run_job(&bad, |_| {
            Err(crate::error::AppError::External("磁盘满了".into()))
        });
        let s = reg.status(bad.id()).unwrap();
        assert_eq!(s.state, JobState::Failed);
        assert!(s.message.unwrap().contains("磁盘满了"));
    }

    /// A cancel that lands while the worker is unwinding an error must be
    /// reported as cancelled, not as a failure — the user asked it to stop.
    #[test]
    fn run_job_reports_cancelled_even_when_the_worker_errored() {
        let reg = JobRegistry::new();
        let h = reg.start(JobKind::EmbedMissing, 5).unwrap().handle;
        let target = h.clone();
        run_job(&h, move |_| {
            target.cancelled.store(true, Ordering::Relaxed);
            Err(crate::error::AppError::External("interrupted".into()))
        });
        assert_eq!(reg.status(h.id()).unwrap().state, JobState::Cancelled);
    }

    /// A panicking worker must not leave the job Running forever.
    #[test]
    fn run_job_turns_a_panic_into_a_failed_state() {
        let reg = JobRegistry::new();
        let h = reg.start(JobKind::ScoreMissing, 3).unwrap().handle;
        let previous = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        run_job(&h, |_| panic!("worker exploded"));
        std::panic::set_hook(previous);
        let s = reg.status(h.id()).unwrap();
        assert_eq!(s.state, JobState::Failed);
        assert_eq!(reg.active_count(), 0);
    }

    #[test]
    fn kind_identifiers_are_stable() {
        // The frontend switches on these strings; renaming breaks it silently.
        assert_eq!(JobKind::EmbedMissing.as_str(), "embed_missing");
        assert_eq!(JobKind::EmbedClipMissing.as_str(), "embed_clip_missing");
        assert_eq!(JobKind::ScoreMissing.as_str(), "score_missing");
        assert_eq!(JobKind::Export.as_str(), "export");
        assert_eq!(JobKind::Convert.as_str(), "convert");
        assert_eq!(JobKind::Import.as_str(), "import");
    }

    #[test]
    fn state_terminality() {
        assert!(!JobState::Pending.is_terminal());
        assert!(!JobState::Running.is_terminal());
        assert!(JobState::Completed.is_terminal());
        assert!(JobState::Cancelled.is_terminal());
        assert!(JobState::Failed.is_terminal());
    }

    /// The registry is shared across Tauri command threads; a clone must see the
    /// same jobs.
    #[test]
    fn clones_share_one_registry() {
        let reg = JobRegistry::new();
        let clone = reg.clone();
        let h = reg.start(JobKind::Export, 1).unwrap().handle;
        h.set_progress(1, 0);
        assert_eq!(clone.status(h.id()).unwrap().processed, 1);
        assert!(clone.cancel(h.id()));
        assert!(h.is_cancelled());
    }

    /// Drives an async job body to completion without pulling in tokio's `macro`
    /// feature: tauri's runtime is already a dependency of the crate.
    fn block_on<F: std::future::Future>(f: F) -> F::Output {
        tauri::async_runtime::block_on(f)
    }

    #[test]
    fn run_job_async_completes_and_fails() {
        let reg = JobRegistry::new();
        let ok = reg.start(JobKind::EmbedMissing, 1).unwrap().handle;
        block_on(run_job_async(&ok, |h| async move {
            h.set_progress(1, 0);
            Ok(())
        }));
        assert_eq!(reg.status(ok.id()).unwrap().state, JobState::Completed);
        assert_eq!(reg.status(ok.id()).unwrap().processed, 1);

        let bad = reg.start(JobKind::ScoreMissing, 1).unwrap().handle;
        block_on(run_job_async(&bad, |_| async move {
            Err(crate::error::AppError::External("上游超时".into()))
        }));
        let s = reg.status(bad.id()).unwrap();
        assert_eq!(s.state, JobState::Failed);
        assert!(s.message.unwrap().contains("上游超时"));
    }

    /// The user's cancel must win over whatever error the aborted work reports:
    /// the abort path usually surfaces as an error, and reporting it as a
    /// failure would tell the user their cancel did not work.
    #[test]
    fn run_job_async_reports_cancelled_when_the_worker_was_stopped() {
        let reg = JobRegistry::new();
        let h = reg.start(JobKind::EmbedClipMissing, 5).unwrap().handle;
        // The user presses Cancel before the worker reaches its first checkpoint.
        assert!(reg.cancel(h.id()));
        block_on(run_job_async(&h, move |handle| async move {
            // The worker notices at its checkpoint, stops, and the abort surfaces
            // as an error — which must not be reported as a failure.
            assert!(handle.is_cancelled());
            Err(crate::error::AppError::External("aborted".into()))
        }));
        assert_eq!(reg.status(h.id()).unwrap().state, JobState::Cancelled);
    }

    /// Same, but where the cancel arrives from another thread mid-flight — the
    /// real shape of a user pressing Cancel while a batch is running.
    #[test]
    fn run_job_async_sees_a_cancel_requested_from_elsewhere() {
        let reg = JobRegistry::new();
        let h = reg.start(JobKind::Export, 2).unwrap().handle;
        let id = h.id();
        let canceller = reg.clone();
        block_on(run_job_async(&h, move |_| async move {
            // The command handler runs on another thread and requests the stop.
            std::thread::spawn(move || canceller.cancel(id))
                .join()
                .unwrap();
            Ok(())
        }));
        assert_eq!(reg.status(id).unwrap().state, JobState::Cancelled);
        assert_eq!(reg.active_count(), 0);
    }
}
