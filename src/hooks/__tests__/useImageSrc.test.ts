import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageSrc } from '../useImageSrc';

vi.mock('../../lib/tauri', () => ({
  convertFileSrc: vi.fn(),
}));

import { convertFileSrc } from '../../lib/tauri';
const mockConvert = vi.mocked(convertFileSrc);

describe('useImageSrc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should return src on success', async () => {
    mockConvert.mockResolvedValue('asset://img.png');
    const { result } = renderHook(() => useImageSrc('/path/img.png'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('asset://img.png');
  });

  it('should return null for null filePath', () => {
    const { result } = renderHook(() => useImageSrc(null));
    expect(result.current).toBeNull();
  });

  it('should retry on failure', async () => {
    vi.useFakeTimers();
    mockConvert
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('asset://retried.png');

    const { result } = renderHook(() => useImageSrc('/path/img.png'));

    // First attempt fails
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Retry after delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current).toBe('asset://retried.png');
    expect(mockConvert).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should return null after max retries exhausted', async () => {
    vi.useFakeTimers();
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

    // Should still be null (not crash)
    expect(result.current).toBeNull();
    expect(mockConvert).toHaveBeenCalledTimes(3); // 1 + 2 retries

    vi.useRealTimers();
  });

  it('should update src when filePath changes', async () => {
    mockConvert
      .mockResolvedValueOnce('asset://first.png')
      .mockResolvedValueOnce('asset://second.png');

    const { result, rerender } = renderHook(
      (props) => useImageSrc(props),
      { initialProps: '/path/first.png' },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toBe('asset://first.png');

    rerender('/path/second.png');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toBe('asset://second.png');
  });
});
