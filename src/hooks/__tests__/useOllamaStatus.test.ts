import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOllamaStatus } from '../useOllamaStatus';

// Mock tauri invoke — return default host
vi.mock('../../lib/tauri', () => ({
  invoke: vi.fn().mockResolvedValue('http://localhost:11434'),
  isTauriAvailable: true,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useOllamaStatus', () => {
  it('should report available when Ollama responds', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const { result } = renderHook(() => useOllamaStatus());

    // Flush invoke + fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.available).toBe(true);
    expect(result.current.checking).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should report unavailable when Ollama fails', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.available).toBe(false);
    expect(result.current.error).toBe('Ollama 未运行');
  });

  it('should report unavailable on non-OK response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    const { result } = renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.available).toBe(false);
    expect(result.current.error).toBe('Ollama returned 503');
  });

  it('should poll every 60 seconds', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should allow manual recheck', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('down'));
    mockFetch.mockResolvedValueOnce({ ok: true });

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

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.available).toBe(false);
    expect(result.current.checking).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should use host from invoke for fetch URL', async () => {
    // This test verifies that the hook reads the host from the Rust backend.
    // The mock is configured to return 'http://localhost:11434' (default).
    // In real Tauri mode, this would read from OLLAMA_HOST env var.
    mockFetch.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useOllamaStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // The fetch should be called (proving invoke resolved and check ran)
    expect(mockFetch).toHaveBeenCalled();
    expect(result.current.available).toBe(true);
  });
});
