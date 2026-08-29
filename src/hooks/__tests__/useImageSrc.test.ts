import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageSrc } from '../useImageSrc';

vi.mock('../../lib/tauri', () => ({
  convertFileSrc: vi.fn(),
  invoke: vi.fn(),
}));

import { convertFileSrc, invoke } from '../../lib/tauri';
const mockConvert = vi.mocked(convertFileSrc);
const mockInvoke = vi.mocked(invoke);

describe('useImageSrc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should return data URL via base64 command', async () => {
    mockInvoke.mockResolvedValue('iVBORw0KGgo=');
    const { result } = renderHook(() => useImageSrc('/path/img.png'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(mockInvoke).toHaveBeenCalledWith('get_image_base64_cmd', { filePath: '/path/img.png' });
  });

  it('should use thumbnail command when thumbnailMaxWidth is set', async () => {
    mockInvoke.mockResolvedValue('thumbData');
    const { result } = renderHook(() =>
      useImageSrc('/path/img.png', { thumbnailMaxWidth: 128 }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('data:image/png;base64,thumbData');
    expect(mockInvoke).toHaveBeenCalledWith('get_thumbnail_base64_cmd', {
      filePath: '/path/img.png',
      maxWidth: 128,
    });
  });

  it('should fall back to convertFileSrc if base64 fails (full-size)', async () => {
    mockInvoke.mockRejectedValue(new Error('no cmd'));
    mockConvert.mockResolvedValue('asset://img.png');
    const { result } = renderHook(() => useImageSrc('/path/img.png'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('asset://img.png');
  });

  it('should NOT fall back to convertFileSrc for thumbnails', async () => {
    mockInvoke.mockRejectedValue(new Error('no cmd'));
    mockConvert.mockResolvedValue('asset://img.png');
    const { result } = renderHook(() =>
      useImageSrc('/path/img.png', { thumbnailMaxWidth: 128 }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Thumbnails should NOT fall back to asset protocol (would be full-size)
    expect(result.current).toBeNull();
    expect(mockConvert).not.toHaveBeenCalled();
  });

  it('falls back to convertFileSrc when the base64 command resolves empty (full-size)', async () => {
    mockInvoke.mockResolvedValue('');
    mockConvert.mockResolvedValue('asset://img.png');
    const { result } = renderHook(() => useImageSrc('/path/img.png'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('asset://img.png');
  });

  it('retries without asset fallback when a thumbnail base64 resolves empty', async () => {
    vi.useFakeTimers();
    mockInvoke.mockResolvedValue('');
    mockConvert.mockResolvedValue('asset://img.png');

    renderHook(() => useImageSrc('/path/img.png', { thumbnailMaxWidth: 128 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockConvert).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('should return null for null filePath', () => {
    const { result } = renderHook(() => useImageSrc(null));
    expect(result.current).toBeNull();
  });

  it('should retry on failure', async () => {
    vi.useFakeTimers();
    mockInvoke
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('iVBORw0KGgo=');
    mockConvert.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useImageSrc('/path/img.png'));

    // First attempt fails
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Retry after delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current).toBe('data:image/png;base64,iVBORw0KGgo=');
    vi.useRealTimers();
  });

  it('should return null after max retries exhausted', async () => {
    vi.useFakeTimers();
    mockInvoke.mockRejectedValue(new Error('fail'));
    mockConvert.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useImageSrc('/path/img.png'));

    // First attempt
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Retry 1
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    // Retry 2
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current).toBeNull();
    vi.useRealTimers();
  });

  it('should update src when filePath changes', async () => {
    mockInvoke
      .mockResolvedValueOnce('aaaa')
      .mockResolvedValueOnce('bbbb');

    const { result, rerender } = renderHook(
      (props) => useImageSrc(props),
      { initialProps: '/path/first.png' },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toBe('data:image/png;base64,aaaa');

    rerender('/path/second.png');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toBe('data:image/png;base64,bbbb');
  });

  it('maps jpg to image/jpeg MIME', async () => {
    mockInvoke.mockResolvedValue('data');
    const { result } = renderHook(() => useImageSrc('/path/photo.jpg'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('data:image/jpeg;base64,data');
  });

  it('lowercases uppercase extensions', async () => {
    mockInvoke.mockResolvedValue('data');
    const { result } = renderHook(() => useImageSrc('/path/PHOTO.PNG'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('data:image/png;base64,data');
  });

  it('keeps image/<ext> fallback for unknown but valid extensions', async () => {
    mockInvoke.mockResolvedValue('data');
    const { result } = renderHook(() => useImageSrc('/path/photo.jfif'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('data:image/jfif;base64,data');
  });

  it('uses a safe default MIME for extensionless paths', async () => {
    mockInvoke.mockResolvedValue('data');
    const { result } = renderHook(() => useImageSrc('/path/photo'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('data:image/png;base64,data');
  });

  it('retries with 500ms, 1000ms, 2000ms backoff and stops at MAX_RETRIES', async () => {
    vi.useFakeTimers();
    mockInvoke.mockRejectedValue(new Error('fail'));
    mockConvert.mockRejectedValue(new Error('fail'));

    renderHook(() => useImageSrc('/path/img.png'));

    expect(mockInvoke).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it('stops retrying once a retry succeeds', async () => {
    vi.useFakeTimers();
    mockInvoke
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('success-at-retry-2');
    mockConvert.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useImageSrc('/path/img.png'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(3);
    expect(result.current).toBe('data:image/png;base64,success-at-retry-2');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(mockInvoke).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('cancels pending retries on unmount', async () => {
    vi.useFakeTimers();
    mockInvoke.mockRejectedValue(new Error('fail'));
    mockConvert.mockRejectedValue(new Error('fail'));

    const { unmount } = renderHook(() => useImageSrc('/path/img.png'));
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('discards a stale response when filePath changes before the load resolves', async () => {
    let resolveFirst!: (value: string) => void;
    mockInvoke
      .mockImplementationOnce(
        () => new Promise<string>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockResolvedValueOnce('second');

    const { result, rerender } = renderHook(
      (path: string) => useImageSrc(path),
      { initialProps: '/path/first.png' },
    );

    rerender('/path/second.png');

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe('data:image/png;base64,second');

    await act(async () => {
      resolveFirst('stale');
    });
    expect(result.current).toBe('data:image/png;base64,second');
  });
});
