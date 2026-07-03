import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/api/images', () => ({
  listImages: vi.fn(),
  searchImagesAdvanced: vi.fn(),
  importImages: vi.fn(),
  exportImages: vi.fn(),
  toggleFavorite: vi.fn(),
  updateRating: vi.fn(),
  getImageTags: vi.fn(),
  addTagToImage: vi.fn(),
  removeTagFromImage: vi.fn(),
}));

import { useImageStore } from '../imageStore';
import * as api from '../../lib/api/images';

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
    images: [],
    loading: false,
    error: null,
    page: 1,
    total: 0,
    perPage: 40,
    selectedIds: new Set(),
    imageTags: {},
  });
});

describe('fetchImages', () => {
  it('loads images and sets pagination', async () => {
    vi.mocked(api.listImages).mockResolvedValue({ items: [mockImage], total: 1 });
    await useImageStore.getState().fetchImages();
    const state = useImageStore.getState();
    expect(state.images).toHaveLength(1);
    expect(state.total).toBe(1);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets error on failure', async () => {
    vi.mocked(api.listImages).mockRejectedValue(new Error('network fail'));
    await useImageStore.getState().fetchImages();
    const state = useImageStore.getState();
    expect(state.error).toBe('network fail');
    expect(state.loading).toBe(false);
    expect(state.images).toHaveLength(0);
  });

  it('appends images on loadMore', async () => {
    useImageStore.setState({ images: [mockImage], page: 1, total: 2, loading: false });
    const secondImage = { ...mockImage, id: '2' };
    vi.mocked(api.listImages).mockResolvedValue({ items: [secondImage], total: 2 });
    await useImageStore.getState().loadMore();
    const state = useImageStore.getState();
    expect(state.images).toHaveLength(2);
    expect(state.page).toBe(2);
  });
});

describe('searchImages', () => {
  it('calls searchImagesAdvanced with current filter field', async () => {
    useImageStore.setState({ filters: { ...useImageStore.getState().filters, searchField: 'prompt' } });
    vi.mocked(api.searchImagesAdvanced).mockResolvedValue([mockImage]);
    await useImageStore.getState().searchImages('cat');
    expect(api.searchImagesAdvanced).toHaveBeenCalledWith('cat', 'prompt');
    expect(useImageStore.getState().images).toHaveLength(1);
  });

  it('clears results on empty query', async () => {
    await useImageStore.getState().searchImages('  ');
    expect(useImageStore.getState().images).toHaveLength(0);
    expect(api.searchImagesAdvanced).not.toHaveBeenCalled();
  });
});

describe('toggleFavorite (optimistic)', () => {
  it('toggles immediately, then calls API', () => {
    useImageStore.setState({ images: [{ ...mockImage, favorite: false }] });
    vi.mocked(api.toggleFavorite).mockResolvedValue(undefined);
    useImageStore.getState().toggleFavorite('1');
    expect(useImageStore.getState().images[0].favorite).toBe(true);
    expect(api.toggleFavorite).toHaveBeenCalledWith('1');
  });

  it('rolls back on API failure', async () => {
    useImageStore.setState({ images: [{ ...mockImage, favorite: false }] });
    vi.mocked(api.toggleFavorite).mockRejectedValue(new Error('network'));
    useImageStore.getState().toggleFavorite('1');
    // Immediate optimistic update
    expect(useImageStore.getState().images[0].favorite).toBe(true);
    // Wait for rollback
    await vi.waitFor(() => {
      expect(useImageStore.getState().images[0].favorite).toBe(false);
    });
  });

  it('sets error on API failure after rollback', async () => {
    useImageStore.setState({ images: [{ ...mockImage, favorite: false }], error: null });
    vi.mocked(api.toggleFavorite).mockRejectedValue(new Error('fav network error'));
    useImageStore.getState().toggleFavorite('1');
    await vi.waitFor(() => {
      expect(useImageStore.getState().images[0].favorite).toBe(false);
      expect(useImageStore.getState().error).toBe('fav network error');
    });
  });
});

describe('setRating (optimistic)', () => {
  it('updates immediately, then calls API', () => {
    useImageStore.setState({ images: [{ ...mockImage, rating: 3 }] });
    vi.mocked(api.updateRating).mockResolvedValue(undefined);
    useImageStore.getState().setRating('1', 5);
    expect(useImageStore.getState().images[0].rating).toBe(5);
    expect(api.updateRating).toHaveBeenCalledWith('1', 5);
  });

  it('rolls back on API failure', async () => {
    useImageStore.setState({ images: [{ ...mockImage, rating: 3 }] });
    vi.mocked(api.updateRating).mockRejectedValue(new Error('network'));
    useImageStore.getState().setRating('1', 5);
    expect(useImageStore.getState().images[0].rating).toBe(5);
    await vi.waitFor(() => {
      expect(useImageStore.getState().images[0].rating).toBe(3);
    });
  });

  it('sets error on API failure after rollback', async () => {
    useImageStore.setState({ images: [{ ...mockImage, rating: 3 }], error: null });
    vi.mocked(api.updateRating).mockRejectedValue(new Error('rating network error'));
    useImageStore.getState().setRating('1', 5);
    await vi.waitFor(() => {
      expect(useImageStore.getState().images[0].rating).toBe(3);
      expect(useImageStore.getState().error).toBe('rating network error');
    });
  });
});

describe('selection', () => {
  it('toggleSelect adds and removes ids', () => {
    useImageStore.setState({ images: [mockImage] });
    useImageStore.getState().toggleSelect('1');
    expect(useImageStore.getState().selectedIds.has('1')).toBe(true);
    useImageStore.getState().toggleSelect('1');
    expect(useImageStore.getState().selectedIds.has('1')).toBe(false);
  });

  it('selectAll selects all images', () => {
    useImageStore.setState({ images: [mockImage, { ...mockImage, id: '2' }] });
    useImageStore.getState().selectAll();
    expect(useImageStore.getState().selectedIds.size).toBe(2);
  });

  it('clearSelection empties the set', () => {
    useImageStore.setState({ selectedIds: new Set(['1', '2']) });
    useImageStore.getState().clearSelection();
    expect(useImageStore.getState().selectedIds.size).toBe(0);
  });
});

describe('tag operations error handling', () => {
  it('fetchImageTags sets error on failure', async () => {
    vi.mocked(api.getImageTags).mockRejectedValue(new Error('tag fetch failed'));
    await useImageStore.getState().fetchImageTags('img-1');
    expect(useImageStore.getState().error).toBe('tag fetch failed');
  });

  it('addTagToImage sets error on failure', async () => {
    vi.mocked(api.addTagToImage).mockRejectedValue(new Error('add tag failed'));
    await useImageStore.getState().addTagToImage('img-1', 'tag-1');
    expect(useImageStore.getState().error).toBe('add tag failed');
  });

  it('removeTagFromImage sets error on failure', async () => {
    vi.mocked(api.removeTagFromImage).mockRejectedValue(new Error('remove tag failed'));
    await useImageStore.getState().removeTagFromImage('img-1', 'tag-1');
    expect(useImageStore.getState().error).toBe('remove tag failed');
  });
});

describe('filters', () => {
  it('setView updates view filter', () => {
    useImageStore.getState().setView('list');
    expect(useImageStore.getState().filters.view).toBe('list');
  });

  it('setSortBy updates sort filter', () => {
    useImageStore.getState().setSortBy('rating');
    expect(useImageStore.getState().filters.sortBy).toBe('rating');
  });

  it('setModelFilter updates model filter', () => {
    useImageStore.getState().setModelFilter('SDXL');
    expect(useImageStore.getState().filters.modelFilter).toBe('SDXL');
  });
});
