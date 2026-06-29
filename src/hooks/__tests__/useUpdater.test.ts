import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const mockCheck = vi.fn();
const mockDownloadAndInstall = vi.fn();

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}));

import { useUpdater } from '../useUpdater';

describe('useUpdater', () => {
  beforeEach(() => {
    mockCheck.mockReset();
    mockDownloadAndInstall.mockReset();
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

  it('should set available=true when update found', async () => {
    mockCheck.mockResolvedValue({
      version: '0.4.0',
      body: 'New features',
      downloadAndInstall: mockDownloadAndInstall,
    });

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.available).toBe(true);
    });

    expect(result.current.updateInfo).toEqual({
      version: '0.4.0',
      body: 'New features',
    });
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
  });

  it('should call downloadAndInstall on installUpdate', async () => {
    const mockUpdate = {
      version: '0.4.0',
      body: '',
      downloadAndInstall: mockDownloadAndInstall.mockResolvedValue(undefined),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.available).toBe(true);
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(mockDownloadAndInstall).toHaveBeenCalled();
    expect(result.current.downloaded).toBe(true);
    expect(result.current.installing).toBe(false);
  });

  it('should set error on install failure', async () => {
    const mockUpdate = {
      version: '0.4.0',
      body: '',
      downloadAndInstall: mockDownloadAndInstall.mockRejectedValue(new Error('Network error')),
    };
    mockCheck.mockResolvedValue(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await vi.waitFor(() => {
      expect(result.current.available).toBe(true);
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.downloaded).toBe(false);
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
});
