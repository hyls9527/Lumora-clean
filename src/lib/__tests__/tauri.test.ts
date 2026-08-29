import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ── Shared mock for the real Tauri invoke ──
const mockRealInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockRealInvoke(...args),
  convertFileSrc: (p: string) => p,
}));

// ── Dynamic imports after setting __TAURI_INTERNALS__ ──
// Static import hoisting means window.__TAURI_INTERNALS__ must be set
// before the module evaluates, so we use dynamic import in beforeAll.
type TauriMod = typeof import('../tauri');

let mod: TauriMod;

beforeAll(async () => {
  // Set Tauri env flag before module loads
  vi.stubGlobal('__TAURI_INTERNALS__', {});
  vi.resetModules();
  mod = await import('../tauri');
});

beforeEach(() => {
  vi.clearAllMocks();
  mockRealInvoke.mockReset();
});

describe('invoke (tauri.ts)', () => {
  // ── Basic behavior ──
  it('returns result from real invoke when in Tauri context', async () => {
    mockRealInvoke.mockResolvedValueOnce({ items: [1, 2, 3], total: 3, page: 1, perPage: 40 });

    const result = await mod.invoke('list_images', { page: 1, perPage: 40 });
    expect(result).toEqual({ items: [1, 2, 3], total: 3, page: 1, perPage: 40 });
    expect(mockRealInvoke).toHaveBeenCalledTimes(1);
    expect(mockRealInvoke).toHaveBeenCalledWith('list_images', { page: 1, perPage: 40 });
  });

  it('isTauriAvailable is true when __TAURI_INTERNALS__ present', () => {
    expect(mod.isTauriAvailable).toBe(true);
  });

  // ── Write commands: NOT retried ──
  describe('write commands — no retry', () => {
    it('throws immediately on first failure for write commands', async () => {
      mockRealInvoke.mockRejectedValueOnce(new Error('DB locked'));

      await expect(mod.invoke('update_rating', { id: 'x', rating: 5 })).rejects.toThrow('DB locked');
      expect(mockRealInvoke).toHaveBeenCalledTimes(1);
    });

    it('throws immediately for soft_delete_image on first failure', async () => {
      mockRealInvoke.mockRejectedValueOnce(new Error('IO error'));

      await expect(mod.invoke('soft_delete_image', { id: 'x' })).rejects.toThrow('IO error');
      expect(mockRealInvoke).toHaveBeenCalledTimes(1);
    });

    it('throws immediately for import_images on first failure', async () => {
      mockRealInvoke.mockRejectedValueOnce(new Error('disk full'));

      await expect(mod.invoke('import_images', { path: '/x' })).rejects.toThrow('disk full');
      expect(mockRealInvoke).toHaveBeenCalledTimes(1);
    });

    it('throws immediately for batch_rename on first failure (filesystem write)', async () => {
      mockRealInvoke.mockRejectedValueOnce(new Error('fs busy'));

      await expect(
        mod.invoke('batch_rename', { ids: ['a'], template: 't', dryRun: false }),
      ).rejects.toThrow('fs busy');
      expect(mockRealInvoke).toHaveBeenCalledTimes(1);
    });

    it('throws immediately for export_images on first failure (filesystem write)', async () => {
      mockRealInvoke.mockRejectedValueOnce(new Error('dest missing'));

      await expect(
        mod.invoke('export_images', { ids: ['a'], destDir: '/o', format: 'png' }),
      ).rejects.toThrow('dest missing');
      expect(mockRealInvoke).toHaveBeenCalledTimes(1);
    });
  });

  // ── Read commands: retried up to READ_RETRY_MAX (3) ──
  describe('read commands — retry on failure', () => {
    it('retries on failure and succeeds on 2nd attempt', async () => {
      mockRealInvoke
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ items: [], total: 0, page: 1, perPage: 40 });

      const result = await mod.invoke('list_images', { page: 1, perPage: 40 });
      expect(result).toEqual({ items: [], total: 0, page: 1, perPage: 40 });
      expect(mockRealInvoke).toHaveBeenCalledTimes(2);
    });

    it('retries on failure and succeeds on 3rd attempt', async () => {
      mockRealInvoke
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ items: [], total: 0, page: 1, perPage: 40 });

      const result = await mod.invoke('list_images', { page: 1, perPage: 40 });
      expect(result).toEqual({ items: [], total: 0, page: 1, perPage: 40 });
      expect(mockRealInvoke).toHaveBeenCalledTimes(3);
    });

    it('retries on failure and succeeds on 4th (last) attempt', async () => {
      mockRealInvoke
        .mockRejectedValueOnce(new Error('t1'))
        .mockRejectedValueOnce(new Error('t2'))
        .mockRejectedValueOnce(new Error('t3'))
        .mockResolvedValueOnce({ items: [], total: 0, page: 1, perPage: 40 });

      const result = await mod.invoke('list_images', { page: 1, perPage: 40 });
      expect(result).toEqual({ items: [], total: 0, page: 1, perPage: 40 });
      expect(mockRealInvoke).toHaveBeenCalledTimes(4); // 3 retries + final attempt
    });

    it('throws after exhausting all retries (4 total attempts)', async () => {
      mockRealInvoke.mockRejectedValue(new Error('persistent error'));

      await expect(mod.invoke('list_images', { page: 1, perPage: 40 })).rejects.toThrow('persistent error');
      // 1 initial + 3 retries = 4 total
      expect(mockRealInvoke).toHaveBeenCalledTimes(4);
    });

    it('throws last error after exhausting retries', async () => {
      mockRealInvoke
        .mockRejectedValueOnce(new Error('error-1'))
        .mockRejectedValueOnce(new Error('error-2'))
        .mockRejectedValueOnce(new Error('error-3'))
        .mockRejectedValueOnce(new Error('error-final'));

      await expect(mod.invoke('list_images')).rejects.toThrow('error-final');
      expect(mockRealInvoke).toHaveBeenCalledTimes(4);
    });

    it('retries read commands like search_images', async () => {
      mockRealInvoke
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce([{ id: 'img-1', filePath: '/a.png' }]);

      const result = await mod.invoke('search_images', { query: 'cat' });
      expect(result).toEqual([{ id: 'img-1', filePath: '/a.png' }]);
      expect(mockRealInvoke).toHaveBeenCalledTimes(2);
    });

    it('retries read commands like get_dashboard_stats', async () => {
      mockRealInvoke
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ totalImages: 5, totalSizeKb: 1000 });

      const result = await mod.invoke('get_dashboard_stats');
      expect(result).toEqual({ totalImages: 5, totalSizeKb: 1000 });
      expect(mockRealInvoke).toHaveBeenCalledTimes(2);
    });

    it('does not retry on success (single call)', async () => {
      mockRealInvoke.mockResolvedValueOnce([{ id: 'x' }]);

      const result = await mod.invoke('list_favorites');
      expect(result).toEqual([{ id: 'x' }]);
      expect(mockRealInvoke).toHaveBeenCalledTimes(1);
    });
  });

  // ── Write listener notification ──
  describe('write listeners', () => {
    it('notifies listeners after a successful write command', async () => {
      mockRealInvoke.mockResolvedValueOnce(undefined);
      const listener = vi.fn();
      const unsub = mod.onWriteCommand(listener);

      await mod.invoke('update_rating', { id: 'x', rating: 3 });

      // Let microtasks flush
      await Promise.resolve();
      expect(listener).toHaveBeenCalledTimes(1);
      unsub();
    });

    it('does not notify listeners after a read command', async () => {
      mockRealInvoke.mockResolvedValueOnce({ items: [], total: 0, page: 1, perPage: 40 });
      const listener = vi.fn();
      const unsub = mod.onWriteCommand(listener);

      await mod.invoke('list_images', { page: 1, perPage: 40 });

      await Promise.resolve();
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });

    it('does not notify listeners after a failed write command', async () => {
      mockRealInvoke.mockRejectedValueOnce(new Error('write failed'));
      const listener = vi.fn();
      const unsub = mod.onWriteCommand(listener);

      await expect(mod.invoke('update_rating', { id: 'x', rating: 3 })).rejects.toThrow();
      await Promise.resolve();
      expect(listener).not.toHaveBeenCalled();
      unsub();
    });
  });

  // ── Error wrapping ──
  describe('error wrapping', () => {
    it('wraps error with user-friendly message for known commands', async () => {
      mockRealInvoke.mockRejectedValue(new Error('raw error'));

      await expect(mod.invoke('update_rating', { id: 'x', rating: 3 })).rejects.toThrow('更新评分失败');
    });

    it('includes original error detail in wrapped message', async () => {
      mockRealInvoke.mockRejectedValue(new Error('disk full'));

      await expect(mod.invoke('update_rating', { id: 'x', rating: 3 })).rejects.toThrow('disk full');
    });

    it('wraps unknown commands with generic message', async () => {
      mockRealInvoke.mockRejectedValue(new Error('boom'));

      await expect(mod.invoke('unknown_cmd')).rejects.toThrow('操作失败: unknown_cmd');
    });

    it('wraps image search failures with a friendly message', async () => {
      mockRealInvoke.mockRejectedValue(new Error('sidecar missing'));

      await expect(
        mod.invoke('clip_embed_image_cmd', { imagePath: '/x.png' }),
      ).rejects.toThrow('以图搜图失败（CLIP 不可用）');
    });
  });
});
