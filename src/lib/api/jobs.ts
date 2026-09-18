import { invoke } from '../tauri';

/**
 * Long-running work exposed as a *job*.
 *
 * A job is started once and then polled; the Rust side owns the loop, so the work
 * keeps running while the user navigates, and `cancelJob` stops it at the next
 * checkpoint. This replaces the old pattern of a `for(;;)` loop living in a store,
 * which could not be observed, stopped, or survived a page change.
 */

/** Job kinds; mirrors `JobKind::as_str()` in `src-tauri/src/jobs.rs`. */
export type JobKind =
  | 'embed_missing'
  | 'embed_clip_missing'
  | 'score_missing'
  | 'export'
  | 'convert'
  | 'import';

export type JobState = 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface JobStatus {
  id: number;
  kind: JobKind;
  state: JobState;
  /** Items attempted so far (successes and failures both count). */
  processed: number;
  /** 0 when the total was unknown up front. */
  total: number;
  failed: number;
  message: string | null;
  startedAtMs: number;
  updatedAtMs: number;
  cancelRequested: boolean;
}

export interface JobStarted {
  id: number;
  kind: JobKind;
  /** False when an identical job was already running and this call joined it. */
  isNew: boolean;
}

/** True while the job still has work to do. */
export function isActive(job: JobStatus): boolean {
  return job.state === 'pending' || job.state === 'running';
}

/** Completion in percent, or null when the total is unknown. */
export function jobPercent(job: JobStatus): number | null {
  if (job.total <= 0) return null;
  return Math.min(100, Math.floor((job.processed * 100) / job.total));
}

/** Start (or join) the text-embedding backfill. */
export function startEmbedMissingJob(): Promise<JobStarted> {
  return invoke<JobStarted>('job_start_embed_missing');
}

/** Start (or join) the CLIP visual-index backfill. */
export function startEmbedClipMissingJob(): Promise<JobStarted> {
  return invoke<JobStarted>('job_start_embed_clip_missing');
}

/** Start (or join) the aesthetic-scoring backfill. */
export function startScoreMissingJob(): Promise<JobStarted> {
  return invoke<JobStarted>('job_start_score_missing');
}

/** Start (or join) an export job. */
export function startExportJob(params: {
  ids: string[];
  destDir: string;
  format: string;
  renameTemplate?: string;
}): Promise<JobStarted> {
  return invoke<JobStarted>('job_start_export', {
    ids: params.ids,
    destDir: params.destDir,
    format: params.format,
    renameTemplate: params.renameTemplate ?? null,
  });
}

/** Start (or join) an in-place batch-conversion job. */
export function startConvertJob(params: {
  ids: string[];
  format: string;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  destDir?: string;
}): Promise<JobStarted> {
  return invoke<JobStarted>('job_start_convert', {
    ids: params.ids,
    format: params.format,
    quality: params.quality ?? null,
    maxWidth: params.maxWidth ?? null,
    maxHeight: params.maxHeight ?? null,
    destDir: params.destDir ?? null,
  });
}

/** Start (or join) a folder-import job. */
export function startImportJob(path: string): Promise<JobStarted> {
  return invoke<JobStarted>('job_start_import', { path });
}

/** Current status of one job, or null once it has been reaped. */
export function getJobStatus(id: number): Promise<JobStatus | null> {
  return invoke<JobStatus | null>('job_status', { id });
}

/** Every job the backend still knows about. */
export function listJobs(): Promise<JobStatus[]> {
  return invoke<JobStatus[]>('job_list');
}

/** Ask a job to stop. False when the id is unknown. */
export function cancelJob(id: number): Promise<boolean> {
  return invoke<boolean>('job_cancel', { id });
}

/** The job kinds the backend supports. */
export function jobKinds(): Promise<string[]> {
  return invoke<string[]>('job_kinds');
}