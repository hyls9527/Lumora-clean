import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCrashStats, getBackupStatus, createBackupNow } from '../diagnostics';
import { invoke } from '../../tauri';

vi.mock('../../tauri', () => ({ invoke: vi.fn() }));

const mockedInvoke = vi.mocked(invoke);

describe('diagnostics api', () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it('reads crash stats through get_crash_stats', async () => {
    mockedInvoke.mockResolvedValue({ panics: 2, logPath: 'C:/logs/crash.log' });
    await expect(getCrashStats()).resolves.toEqual({ panics: 2, logPath: 'C:/logs/crash.log' });
    expect(mockedInvoke).toHaveBeenCalledWith('get_crash_stats');
  });

  it('reads backup status through get_backup_status', async () => {
    mockedInvoke.mockResolvedValue({
      snapshots: 6,
      directory: 'C:/data/backups',
      intervalSeconds: 600,
      retain: 6,
      lastError: null,
      newest: 'lumora-20260101-120000.db',
    });
    const status = await getBackupStatus();
    expect(status.intervalSeconds).toBe(600);
    expect(mockedInvoke).toHaveBeenCalledWith('get_backup_status');
  });

  it('requests an immediate snapshot', async () => {
    mockedInvoke.mockResolvedValue('C:/data/backups/lumora-now.db');
    await expect(createBackupNow()).resolves.toContain('lumora-now.db');
    expect(mockedInvoke).toHaveBeenCalledWith('create_backup_now');
  });

  it('propagates backend errors instead of hiding them', async () => {
    mockedInvoke.mockRejectedValue(new Error('db locked'));
    await expect(createBackupNow()).rejects.toThrow(/db locked/);
  });
});
