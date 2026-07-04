import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOllamaStatus } from '../useOllamaStatus';

// Mock tauri invoke
const mockInvoke = vi.fn();
vi.mock('../../lib/tauri', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  isTauriAvailable: true,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useOllamaStatus', () => {
  it('should report available when Ollama responds OK', async () => {
    mockInvoke.mockResolvedValue([true, null]);

    const { result } = renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.available).toBe(true);
    expect(result.current.checking).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should report unavailable when Ollama fails', async () => {
    mockInvoke.mockResolvedValue([false, 'Ollama 未运行']);

    const { result } = renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.available).toBe(false);
    expect(result.current.error).toBe('Ollama 未运行');
  });

  it('should report unavailable on invoke exception', async () => {
    mockInvoke.mockRejectedValue(new Error('invoke failed'));

    const { result } = renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.available).toBe(false);
    expect(result.current.error).toBe('Ollama 未运行');
  });

  it('should poll every 60 seconds', async () => {
    mockInvoke.mockResolvedValue([true, null]);
    renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });

  it('should allow manual recheck', async () => {
    mockInvoke.mockResolvedValueOnce([false, 'Ollama 未运行']);
    mockInvoke.mockResolvedValueOnce([true, null]);

    const { result } = renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.available).toBe(false);

    await act(async () => {
      result.current.recheck();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.available).toBe(true);
  });

  it('should skip polling when enabled=false', async () => {
    const { result } = renderHook(() => useOllamaStatus({ enabled: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.available).toBe(false);
    expect(result.current.checking).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should call check_ollama_status command', async () => {
    mockInvoke.mockResolvedValue([true, null]);

    const { result } = renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mockInvoke).toHaveBeenCalledWith('check_ollama_status');
    expect(result.current.available).toBe(true);
  });
});
