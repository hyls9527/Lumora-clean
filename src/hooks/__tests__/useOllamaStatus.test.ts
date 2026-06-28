import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOllamaStatus } from '../useOllamaStatus';

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
});
