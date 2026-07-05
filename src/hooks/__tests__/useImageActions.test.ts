import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImageActions } from '../useImageActions';
import { useImageStore } from '../../stores/imageStore';
import * as api from '../../lib/api/images';

vi.mock('../../lib/api/images', () => ({
  toggleFavorite: vi.fn(),
  updateRating: vi.fn(),
}));

const mockImage = {
  id: '1',
  filePath: '/a.png',
  fileName: 'a.png',
  fileSizeKb: 100,
  width: 100,
  height: 100,
  format: 'png' as const,
  createdAt: '2024-01-01',
  rating: 0,
  favorite: false,
  model: '',
  prompt: '',
  tags: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useImageStore.setState({
    images: [mockImage],
  });
});

describe('useImageActions', () => {
  describe('toggleFavorite', () => {
    it('toggles immediately, then calls API', () => {
      const { result } = renderHook(() => useImageActions());
      vi.mocked(api.toggleFavorite).mockResolvedValue(undefined);

      act(() => {
        result.current.toggleFavorite('1');
      });

      expect(useImageStore.getState().images[0].favorite).toBe(true);
      expect(api.toggleFavorite).toHaveBeenCalledWith('1');
    });

    it('rolls back on API failure', async () => {
      const { result } = renderHook(() => useImageActions());
      vi.mocked(api.toggleFavorite).mockRejectedValue(new Error('network'));

      act(() => {
        result.current.toggleFavorite('1');
      });

      expect(useImageStore.getState().images[0].favorite).toBe(true);

      await vi.waitFor(() => {
        expect(useImageStore.getState().images[0].favorite).toBe(false);
      });
    });

    it('does not roll back when newer request is in flight (race protection)', async () => {
      const { result } = renderHook(() => useImageActions());
      
      // First call will fail, second call will succeed
      vi.mocked(api.toggleFavorite)
        .mockRejectedValueOnce(new Error('first fails'))
        .mockResolvedValueOnce(undefined);

      // Rapidly call twice
      act(() => {
        result.current.toggleFavorite('1');
      });
      
      // State should be true after first optimistic update
      expect(useImageStore.getState().images[0].favorite).toBe(true);

      act(() => {
        result.current.toggleFavorite('1');
      });
      
      // State should be false after second optimistic update
      expect(useImageStore.getState().images[0].favorite).toBe(false);

      // Wait for both API calls to settle
      await vi.waitFor(() => {
        expect(api.toggleFavorite).toHaveBeenCalledTimes(2);
      });

      // First call failed but should NOT roll back because second call is in flight
      // Second call succeeded, so final state should remain false
      expect(useImageStore.getState().images[0].favorite).toBe(false);
    });

    it('logs error with imageId context on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHook(() => useImageActions());
      vi.mocked(api.toggleFavorite).mockRejectedValue(new Error('network'));

      act(() => {
        result.current.toggleFavorite('1');
      });

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to toggle favorite:',
          expect.objectContaining({ id: '1' })
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('setRating', () => {
    it('updates immediately, then calls API', () => {
      const { result } = renderHook(() => useImageActions());
      vi.mocked(api.updateRating).mockResolvedValue(undefined);

      act(() => {
        result.current.setRating('1', 5);
      });

      expect(useImageStore.getState().images[0].rating).toBe(5);
      expect(api.updateRating).toHaveBeenCalledWith('1', 5);
    });

    it('rolls back on API failure', async () => {
      const { result } = renderHook(() => useImageActions());
      vi.mocked(api.updateRating).mockRejectedValue(new Error('network'));

      act(() => {
        result.current.setRating('1', 5);
      });

      expect(useImageStore.getState().images[0].rating).toBe(5);

      await vi.waitFor(() => {
        expect(useImageStore.getState().images[0].rating).toBe(0);
      });
    });
  });
});
