import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageSrc } from './useImageSrc';

// Mock ../lib/tauri
const mockInvoke = vi.fn();
const mockConvertFileSrc = vi.fn();

vi.mock('../lib/tauri', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  convertFileSrc: (...args: unknown[]) => mockConvertFileSrc(...args),
}));

describe('useImageSrc', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockReset();
    mockConvertFileSrc.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when filePath is null', () => {
    const { result } = renderHook(() => useImageSrc(null));
    expect(result.current).toBeNull();
  });

  it('loads full image via base64 and sets data URI', async () => {
    mockInvoke.mockResolvedValueOnce('abc123');

    const { result } = renderHook(() => useImageSrc('/path/to/photo.png'));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockInvoke).toHaveBeenCalledWith('get_image_base64_cmd', {
      filePath: '/path/to/photo.png',
    });
    expect(result.current).toBe('data:image/png;base64,abc123');
  });

  it('loads thumbnail via get_thumbnail_base64_cmd', async () => {
    mockInvoke.mockResolvedValueOnce('thumb123');

    const { result } = renderHook(() =>
      useImageSrc('/path/to/photo.jpg', { thumbnailMaxWidth: 200 }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockInvoke).toHaveBeenCalledWith('get_thumbnail_base64_cmd', {
      filePath: '/path/to/photo.jpg',
      maxWidth: 200,
    });
    expect(result.current).toBe('data:image/jpeg;base64,thumb123');
  });

  it('falls back to convertFileSrc when base64 fails for full image', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('base64 failed'));
    mockConvertFileSrc.mockResolvedValueOnce('asset://photo.png');

    const { result } = renderHook(() => useImageSrc('/path/to/photo.png'));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockInvoke).toHaveBeenCalled();
    expect(mockConvertFileSrc).toHaveBeenCalledWith('/path/to/photo.png');
    expect(result.current).toBe('asset://photo.png');
  });

  it('does NOT fall back to convertFileSrc for thumbnails', async () => {
    mockInvoke.mockRejectedValue(new Error('thumbnail base64 failed'));

    const { result } = renderHook(() =>
      useImageSrc('/path/to/photo.png', { thumbnailMaxWidth: 100 }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockConvertFileSrc).not.toHaveBeenCalled();
    // Should still retry (exponential backoff) — after all retries, src remains null
    expect(result.current).toBeNull();
  });

  describe('exponential backoff', () => {
    it('retries with delays: 500ms, 1000ms, 2000ms', async () => {
      // All attempts fail
      mockInvoke.mockRejectedValue(new Error('fail'));
      mockConvertFileSrc.mockRejectedValue(new Error('also fail'));

      renderHook(() => useImageSrc('/path/to/photo.png'));

      // Initial call happens immediately
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Retry 1: after 500ms (BASE_DELAY_MS * 2^0)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(mockInvoke).toHaveBeenCalledTimes(2);

      // Retry 2: after another 1000ms (BASE_DELAY_MS * 2^1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(mockInvoke).toHaveBeenCalledTimes(3);

      // Retry 3: after another 2000ms (BASE_DELAY_MS * 2^2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(mockInvoke).toHaveBeenCalledTimes(4);

      // No more retries (MAX_RETRIES = 3)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
      });
      expect(mockInvoke).toHaveBeenCalledTimes(4);
    });

    it('stops retrying on success during backoff', async () => {
      mockInvoke
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success-at-retry-2');
      mockConvertFileSrc.mockRejectedValue(new Error('fallback fail'));

      const { result } = renderHook(() => useImageSrc('/path/to/photo.png'));

      // Initial call already fired synchronously
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Let microtasks settle (catch handler runs, schedules 500ms retry)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Retry 1 after 500ms — fails
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(mockInvoke).toHaveBeenCalledTimes(2);

      // Retry 2 after 1000ms — succeeds
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockInvoke).toHaveBeenCalledTimes(3);
      expect(result.current).toBe('data:image/png;base64,success-at-retry-2');
    });
  });

  it('cancels pending retries on unmount', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));
    mockConvertFileSrc.mockRejectedValue(new Error('fail'));

    const { unmount } = renderHook(() => useImageSrc('/path/to/photo.png'));

    expect(mockInvoke).toHaveBeenCalledTimes(1);

    // Unmount before first retry timer fires
    unmount();

    // Advance past all retry delays
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    // No additional calls — retry was cancelled
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('resets state and retry count when filePath changes', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));
    mockConvertFileSrc.mockRejectedValue(new Error('fail'));

    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useImageSrc(path),
      { initialProps: { path: '/old/path.png' } },
    );

    // Initial call fired synchronously
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    // Change filePath — useEffect reset fires, cancels old retries
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue('new-b64');
    rerender({ path: '/new/path.jpg' });

    // Let microtasks + timers settle
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Fresh single call for new path (old retries cancelled)
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('get_image_base64_cmd', {
      filePath: '/new/path.jpg',
    });
    expect(result.current).toBe('data:image/jpeg;base64,new-b64');
  });

  it('preserves src across re-renders with same filePath', async () => {
    mockInvoke.mockResolvedValueOnce('persistent');

    const { result, rerender } = renderHook(
      ({ path, opts }: { path: string | null; opts?: { thumbnailMaxWidth?: number } }) =>
        useImageSrc(path, opts),
      {
        initialProps: {
          path: '/same/path.png',
          opts: undefined,
        } as { path: string | null; opts?: { thumbnailMaxWidth?: number } },
      },
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current).toBe('data:image/png;base64,persistent');

    // Re-render with different options but same path — src should persist
    rerender({ path: '/same/path.png', opts: { thumbnailMaxWidth: 50 } });

    expect(result.current).toBe('data:image/png;base64,persistent');
  });
});
