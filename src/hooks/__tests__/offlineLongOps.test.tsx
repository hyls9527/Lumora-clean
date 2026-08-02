import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { create } from 'zustand';
import { OfflineBanner } from '../../components/ui/OfflineBanner';
import { createImageStore, type ImageStore } from '../../stores/imageStore';
import type { ImageRecord } from '../../types/image';

const mockUseOnlineStatus = vi.fn();
vi.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));

describe('offline long operations (GA-16)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseOnlineStatus.mockReset();
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, recheck: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('import still works while the offline banner is visible', async () => {
    const importImages = vi.fn().mockResolvedValue({
      items: [] as ImageRecord[],
      imported: 3,
      skipped: 1,
      totalScanned: 4,
    });
    const store = create<ImageStore>()(createImageStore({
      listImages: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      searchImagesAdvanced: vi.fn().mockResolvedValue([]),
      importImages,
      exportImages: vi.fn().mockResolvedValue({
        success: 0,
        failed: 0,
        destDir: '/out',
      }),
    }));

    render(<OfflineBanner />);

    let result: Awaited<ReturnType<typeof importImages>> | undefined;
    await act(async () => {
      result = await store.getState().importImages('/photos');
    });
    expect(importImages).toHaveBeenCalledWith('/photos');
    expect(result?.imported).toBe(3);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('export still works while the offline banner is visible', async () => {
    const exportImages = vi.fn().mockResolvedValue({
      success: 2,
      failed: 0,
      destDir: '/out',
    });
    const store = create<ImageStore>()(createImageStore({
      listImages: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      searchImagesAdvanced: vi.fn().mockResolvedValue([]),
      importImages: vi.fn().mockResolvedValue({
        items: [] as ImageRecord[],
        imported: 0,
        skipped: 0,
        totalScanned: 0,
      }),
      exportImages,
    }));

    render(<OfflineBanner />);

    let result: Awaited<ReturnType<typeof exportImages>> | undefined;
    await act(async () => {
      result = await store.getState().exportImages(['a', 'b'], '/out', 'jpg', '{name}');
    });
    expect(exportImages).toHaveBeenCalledWith(['a', 'b'], '/out', 'jpg', '{name}');
    expect(result?.success).toBe(2);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });
});
