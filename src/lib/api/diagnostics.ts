import { invoke } from '../tauri';

/** Rust-side crash counters (panics recorded by the panic hook). */
export interface CrashStats {
  panics: number;
  logPath: string | null;
}

/** Scheduled-backup state (RPO guard). */
export interface BackupStatus {
  snapshots: number;
  directory: string | null;
  intervalSeconds: number;
  retain: number;
  lastError: string | null;
  newest: string | null;
}

/** Panics recorded in this process plus the crash-log location. */
export function getCrashStats(): Promise<CrashStats> {
  return invoke<CrashStats>('get_crash_stats');
}

/** Scheduled-backup state: how many restore points exist and where. */
export function getBackupStatus(): Promise<BackupStatus> {
  return invoke<BackupStatus>('get_backup_status');
}

/** Write a snapshot right now instead of waiting for the next cycle. */
export function createBackupNow(): Promise<string> {
  return invoke<string>('create_backup_now');
}
