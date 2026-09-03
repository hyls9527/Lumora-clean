import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const mockCheck = vi.fn();
const mockDownload = vi.fn();
const mockInstall = vi.fn();
const mockRelaunch = vi.fn();
const mockClose = vi.fn();

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: () => mockRelaunch(),
}));

import { useUpdater } from '../useUpdater';
import { useUpdateStore } from '../../stores/updateStore';

function makeUpdate(overrides: Record<string, unknown> = {}) {
  return {
    version: '0.4.0',
    body: 'New features',
    download: mockDownload,
    install: mockInstall,
    close: mockClose,
    ...overrides,
  };
}

describe('useUpdater', () => {
  beforeEach(() => {
    useUpdateStore.getState().reset();
    mockCheck.mockReset();
    mockDownload.mockReset();
    mockInstall.mockReset();
    mockRelaunch.mockReset();
    mockDownload.mockResolvedValue(undefined);
    mockInstall.mockResolvedValue(undefined);
    mockRelaunch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('should check for updates on mount', async () => {
    mockCheck.mockResolvedValue(null);

    renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(mockCheck).toHaveBeenCalled();
    });
  });

  it('should set available=true and auto-download when update found', async () => {
    mockCheck.mockResolvedValue(makeUpdate());

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.available).toBe(true);
    });

    expect(result.current.updateInfo).toEqual({
      version: '0.4.0',
      body: 'New features',
    });
    expect(mockDownload).toHaveBeenCalled();
    expect(result.current.checking).toBe(false);
  });

  it('should set available=false when no update', async () => {
    mockCheck.mockResolvedValue(null);

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    expect(result.current.available).toBe(false);
    expect(result.current.updateInfo).toBeNull();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('should report download progress from updater events', async () => {
    mockCheck.mockResolvedValue(makeUpdate());
    mockDownload.mockImplementation((onEvent: (e: unknown) => void) => {
      onEvent({ event: 'Started', data: { contentLength: 100 } });
      onEvent({ event: 'Progress', data: { chunkLength: 25 } });
      onEvent({ event: 'Progress', data: { chunkLength: 25 } });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.downloaded).toBe(true);
    });

    expect(result.current.downloading).toBe(false);
    expect(result.current.downloadProgress).toBe(50);
  });

  it('should set downloaded=true when download finishes', async () => {
    mockCheck.mockResolvedValue(makeUpdate());

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.downloaded).toBe(true);
    });

    expect(result.current.downloading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not mark downloaded before the download promise settles', async () => {
    // The Finished event fires while the download() promise is still pending
    // (the plugin has not yet populated its downloadedBytes handle). install()
    // would throw "Update.install called before Update.download" if clicked
    // here — so downloaded must stay false until the promise resolves.
    let resolveDownload!: () => void;
    mockCheck.mockResolvedValue(makeUpdate());
    mockDownload.mockImplementation((onEvent: (e: unknown) => void) => {
      onEvent({ event: 'Finished', data: {} });
      return new Promise<void>((resolve) => {
        resolveDownload = resolve;
      });
    });

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(mockDownload).toHaveBeenCalled();
    });
    // Let the Finished event callback run; downloaded must still be false.
    await Promise.resolve();
    expect(result.current.downloaded).toBe(false);
    expect(result.current.downloadProgress).toBe(100);

    // Once the download promise settles, the handle is ready to install.
    await act(async () => {
      resolveDownload();
    });
    expect(result.current.downloaded).toBe(true);

    // install() must only be reachable after downloaded becomes true.
    await act(async () => {
      await result.current.installNow();
    });
    expect(mockInstall).toHaveBeenCalled();
  });

  it('should set error on download failure', async () => {
    mockCheck.mockResolvedValue(makeUpdate());
    mockDownload.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    expect(result.current.downloading).toBe(false);
    expect(result.current.downloaded).toBe(false);
  });

  it('should call install and relaunch on installNow', async () => {
    mockCheck.mockResolvedValue(makeUpdate());

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.downloaded).toBe(true);
    });

    await act(async () => {
      await result.current.installNow();
    });

    expect(mockInstall).toHaveBeenCalled();
    expect(mockRelaunch).toHaveBeenCalled();
    expect(result.current.installing).toBe(false);
  });

  it('should set error on install failure', async () => {
    mockCheck.mockResolvedValue(makeUpdate());
    mockInstall.mockRejectedValue(new Error('Install error'));

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.downloaded).toBe(true);
    });

    await act(async () => {
      await result.current.installNow();
    });

    expect(result.current.error).toBe('Install error');
    expect(mockRelaunch).not.toHaveBeenCalled();
  });

  it('should dismiss without clearing the downloaded update', async () => {
    mockCheck.mockResolvedValue(makeUpdate());

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.downloaded).toBe(true);
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.dismissed).toBe(true);
    expect(result.current.downloaded).toBe(true);
  });

  it('should not set state after unmount', async () => {
    let resolveFn: ((value: unknown) => void) | null = null;
    mockCheck.mockImplementation(
      () => new Promise((resolve) => { resolveFn = resolve; }),
    );

    const { unmount } = renderHook(() => useUpdater());

    // Wait for the effect to fire and mockCheck to be called
    await vi.waitFor(() => {
      expect(mockCheck).toHaveBeenCalled();
    });

    unmount();

    // Resolve after unmount — should not throw
    await act(async () => {
      resolveFn!(null);
    });

    expect(true).toBe(true);
  });

  it('should check and download only once when two components mount', async () => {
    mockCheck.mockResolvedValue(makeUpdate());
    mockDownload.mockImplementation((onEvent: (e: unknown) => void) => {
      onEvent({ event: 'Started', data: { contentLength: 100 } });
      onEvent({ event: 'Finished', data: {} });
      return Promise.resolve();
    });

    // Sidebar banner + settings page mount at the same time.
    const first = renderHook(() => useUpdater());
    const second = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(first.result.current.downloaded).toBe(true);
      expect(second.result.current.downloaded).toBe(true);
    });

    // One shared session: a single check, a single download, identical state.
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(first.result.current.downloadProgress).toBe(100);
    expect(second.result.current.downloadProgress).toBe(100);
  });

  it('should not re-download when downloadUpdate is called after finishing', async () => {
    mockCheck.mockResolvedValue(makeUpdate());

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.downloaded).toBe(true);
    });

    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it('should reuse the handle and skip download when re-checking the same version', async () => {
    mockCheck.mockResolvedValue(makeUpdate());

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.downloaded).toBe(true);
    });

    // Manual re-check finds the same version: keep the downloaded handle.
    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(mockCheck).toHaveBeenCalledTimes(2);
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(result.current.available).toBe(true);
    expect(result.current.downloaded).toBe(true);
  });

  it('should reset stale progress when a download is retried after failure', async () => {
    mockCheck.mockResolvedValue(makeUpdate());
    mockDownload.mockImplementationOnce((onEvent: (e: unknown) => void) => {
      onEvent({ event: 'Started', data: { contentLength: 100 } });
      onEvent({ event: 'Progress', data: { chunkLength: 40 } });
      return Promise.reject(new Error('Network error'));
    });

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    // No leftover percent from the failed attempt may show on retry.
    expect(result.current.downloadProgress).toBeNull();
    expect(result.current.downloading).toBe(false);

    mockDownload.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.downloadUpdate();
    });

    expect(result.current.downloaded).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
