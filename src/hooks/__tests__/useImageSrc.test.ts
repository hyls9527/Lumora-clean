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
  });

  it('should return null initially', () => {
    mockConvert.mockResolvedValue('asset://converted');
    const { result } = renderHook(() => useImageSrc('/path/to/image.png'));
    expect(result.current).toBeNull();
  });

  it('should return converted src after resolution', async () => {
    mockConvert.mockResolvedValue('asset://converted-path');
    const { result } = renderHook(() => useImageSrc('/path/to/image.png'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBe('asset://converted-path');
  });

  it('should return null on conversion error', async () => {
    mockConvert.mockRejectedValue(new Error('conversion failed'));
    const { result } = renderHook(() => useImageSrc('/bad/path.png'));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current).toBeNull();
  });

  it('should return null when filePath is null', () => {
    const { result } = renderHook(() => useImageSrc(null));
    expect(result.current).toBeNull();
  });

  it('should update src when filePath changes', async () => {
    mockConvert.mockResolvedValue('asset://first');
    const { result, rerender } = renderHook(
      ({ path }) => useImageSrc(path),
      { initialProps: { path: '/first.png' } },
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toBe('asset://first');

    mockConvert.mockResolvedValue('asset://second');
    rerender({ path: '/second.png' });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current).toBe('asset://second');
  });
});
