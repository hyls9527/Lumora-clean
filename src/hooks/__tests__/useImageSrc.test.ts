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

  it('should fall back to convertFileSrc if base64 fails', async () => {
    mockInvoke.mockRejectedValue(new Error('no cmd'));
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
});
