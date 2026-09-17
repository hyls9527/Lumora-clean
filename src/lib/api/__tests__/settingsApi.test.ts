import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAppVersion, getSetting, setSetting } from '../settings';

vi.mock('../../tauri', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '../../tauri';
const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('settings API', () => {
  it('reads the app version reported by the backend', async () => {
    mockInvoke.mockResolvedValueOnce('0.10.1');

    await expect(getAppVersion()).resolves.toBe('0.10.1');
    expect(mockInvoke).toHaveBeenCalledWith('get_app_version');
  });

  it('reads a settings value by key', async () => {
    mockInvoke.mockResolvedValueOnce('dark');

    await expect(getSetting('theme')).resolves.toBe('dark');
    expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'theme' });
  });

  it('returns null for an unset key', async () => {
    mockInvoke.mockResolvedValueOnce(null);

    await expect(getSetting('missing')).resolves.toBeNull();
  });

  it('persists a value through set_setting', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await setSetting('language', 'en');

    expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'language', value: 'en' });
  });
});
