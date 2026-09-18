import { create, type StateCreator } from 'zustand';
import {
  cancelJob,
  getJobStatus,
  listJobs,
  startEmbedClipMissingJob,
  startEmbedMissingJob,
  startScoreMissingJob,
  isActive,
  type JobStarted,
  type JobStatus,
} from '../lib/api/jobs';

/**
 * Tracks long-running backend jobs so a page can show progress and offer Cancel.
 *
 * The loop lives in Rust (see `src-tauri/src/jobs.rs`); this store only polls and
 * relays intent. That split is the whole point: the work survives navigation, and
 * closing a modal or switching pages cannot silently abandon it.
 *
 * Polling rules, deliberately conservative:
 * - only while at least one job is active, so an idle app makes no IPC calls;
 * - one timer for all jobs, not one per job;
 * - cleared whenever nothing is active, so no interval outlives its usefulness.
 */

/** How often active jobs are re-read. Jobs report progress per batch, not per
 * frame; 500ms keeps the bar honest without flooding IPC. */
export const POLL_INTERVAL_MS = 500;

export interface JobStoreDeps {
  startEmbedMissing: () => Promise<JobStarted>;
  startEmbedClipMissing: () => Promise<JobStarted>;
  startScoreMissing: () => Promise<JobStarted>;
  getStatus: (id: number) => Promise<JobStatus | null>;
  list: () => Promise<JobStatus[]>;
  cancel: (id: number) => Promise<boolean>;
}

const defaultDeps: JobStoreDeps = {
  startEmbedMissing: startEmbedMissingJob,
  startEmbedClipMissing: startEmbedClipMissingJob,
  startScoreMissing: startScoreMissingJob,
  getStatus: getJobStatus,
  list: listJobs,
  cancel: cancelJob,
};

interface JobStore {
  /** Jobs still doing work (pending or running). */
  active: JobStatus[];
  /** Jobs that just ended, kept briefly so the user sees how they ended. */
  recent: JobStatus[];
  error: string | null;
  startEmbedMissing: () => Promise<void>;
  startEmbedClipMissing: () => Promise<void>;
  startScoreMissing: () => Promise<void>;
  cancel: (id: number) => Promise<void>;
  /** One poll tick; exported for tests so they need not wait on a timer. */
  refresh: () => Promise<void>;
  /** Stop polling and forget everything (unmount / test teardown). */
  reset: () => void;
}

/**
 * Re-attach to jobs that were already running before this page load.
 *
 * The registry lives in the backend, so a reload (or a return to a page) does not
 * stop the work — but without this the UI would show nothing and the user would
 * assume it died. Call once on mount.
 */
export async function resumeJobTracking(): Promise<void> {
  const store = useJobStore.getState();
  await store.refresh();
  if (useJobStore.getState().active.length > 0) {
    // `refresh` already started the poll loop; nothing else to do.
    return;
  }
}

export function createJobStore(deps: JobStoreDeps = defaultDeps): StateCreator<JobStore, [], []> {
  // Module-scoped so every action shares one timer; a per-call interval would
  // multiply IPC traffic with each click.
  let timer: ReturnType<typeof setInterval> | null = null;

  return (set, get) => {
    const stopPolling = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const poll = async () => {
      try {
        const all = await deps.list();
        const active = all.filter(isActive);
        const recent = all.filter((j) => !isActive(j));
        set({ active, recent, error: null });
        if (active.length === 0) {
          stopPolling();
        } else {
          // A poll that discovers running work must keep watching it: this is the
          // path that re-attaches to jobs started before a reload.
          startPolling();
        }
      } catch (err) {
        // A failed poll must not leave a spinner running forever: surface it and
        // stop, so the user can retry instead of watching a frozen bar.
        set({ error: err instanceof Error ? err.message : '读取任务状态失败' });
        stopPolling();
      }
    };

    const startPolling = () => {
      if (timer !== null) return;
      timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    };

    const begin = async (start: () => Promise<JobStarted>) => {
      try {
        const started = await start();
        set({ error: null });
        // Read once immediately so the bar appears without waiting a tick.
        const status = await deps.getStatus(started.id);
        if (status) {
          set((s) => ({
            active: [...s.active.filter((j) => j.id !== status.id), status],
          }));
        }
        startPolling();
        if (!started.isNew) {
          // Joining an existing job is not an error, but the user should know
          // their click did not start a second run.
          set({ error: null });
        }
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '无法启动任务' });
      }
    };

    return {
      active: [],
      recent: [],
      error: null,

      startEmbedMissing: () => begin(deps.startEmbedMissing),
      startEmbedClipMissing: () => begin(deps.startEmbedClipMissing),
      startScoreMissing: () => begin(deps.startScoreMissing),

      cancel: async (id: number) => {
        try {
          await deps.cancel(id);
          // Keep polling: the flag is set immediately but the worker stops at
          // its next checkpoint, and the UI must show that gap honestly.
          await get().refresh();
          startPolling();
        } catch (err) {
          set({ error: err instanceof Error ? err.message : '取消失败' });
        }
      },

      refresh: poll,

      reset: () => {
        stopPolling();
        set({ active: [], recent: [], error: null });
      },
    };
  };
}

export const useJobStore = create<JobStore>()(createJobStore(defaultDeps));

// Dev-only handle for the end-to-end suite. Playwright runs against the dev
// server because the app has no browser-mode backend, and a store instance
// imported by a test resolves to a *different* module instance than the one the
// app renders from — so the test cannot reach the live store any other way.
// The `import.meta.env.DEV` guard strips this from production builds entirely.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__jobStore = useJobStore;
}