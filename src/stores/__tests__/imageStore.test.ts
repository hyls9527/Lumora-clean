import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/api/images', () => ({
  listImages: vi.fn(),
  listImagesFiltered: vi.fn(),
  searchImagesAdvanced: vi.fn(),
  importImages: vi.fn(),
  exportImages: vi.fn(),
}));

import { useImageStore } from '../imageStore';
import { useFilterStore } from '../filterStore';
import * as api from '../../lib/api/images';
import type { ImageRecord } from '../../types/image';

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
  useFilterStore.setState({ criteria: {} });
  useImageStore.setState({
    images: [],
    loading: false,
    error: null,
    page: 1,
    total: 0,
    perPage: 40,
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

  it('routes through listImagesFiltered when filters are active', async () => {
    useFilterStore.setState({ criteria: { model: 'sd1.5' } });
    vi.mocked(api.listImagesFiltered).mockResolvedValue({ items: [mockImage], total: 1 });

    await useImageStore.getState().fetchImages(1);

    expect(api.listImagesFiltered).toHaveBeenCalledWith(1, 40, { model: 'sd1.5' });
    expect(api.listImages).not.toHaveBeenCalled();
    expect(useImageStore.getState().images).toHaveLength(1);
  });

  it('uses plain listImages when no filters are active', async () => {
    vi.mocked(api.listImages).mockResolvedValue({ items: [mockImage], total: 1 });

    await useImageStore.getState().fetchImages(1);

    expect(api.listImagesFiltered).not.toHaveBeenCalled();
    expect(api.listImages).toHaveBeenCalledWith(1, 40);
  });

  it('loadMore keeps using the filtered path with active criteria', async () => {
    useFilterStore.setState({ criteria: { format: 'png' } });
    useImageStore.setState({ images: [mockImage], page: 1, total: 2, loading: false });
    vi.mocked(api.listImagesFiltered).mockResolvedValue({
      items: [{ ...mockImage, id: '2' }],
      total: 2,
    });

    await useImageStore.getState().loadMore();

    expect(api.listImagesFiltered).toHaveBeenCalledWith(2, 40, { format: 'png' });
    expect(useImageStore.getState().images).toHaveLength(2);
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

describe('list request races', () => {
  it('discards a stale loadMore response when a newer fetchImages is in flight', async () => {
    useImageStore.setState({ images: [mockImage], page: 1, total: 3, loading: false });

    let resolveLoadMore!: (v: { items: ImageRecord[]; total: number }) => void;
    vi.mocked(api.listImages).mockImplementation((page: number) => {
      if (page === 2) {
        return new Promise((resolve) => { resolveLoadMore = resolve; });
      }
      return Promise.resolve({ items: [{ ...mockImage, id: 'fresh' }], total: 1 });
    });

    const loadMorePromise = useImageStore.getState().loadMore();
    const fetchPromise = useImageStore.getState().fetchImages(1);

    resolveLoadMore({ items: [{ ...mockImage, id: 'stale-page2' }], total: 3 });
    await Promise.all([loadMorePromise, fetchPromise]);

    const state = useImageStore.getState();
    // The late page-2 response belongs to the pre-filter list and must be dropped
    expect(state.images.map((i) => i.id)).toEqual(['fresh']);
    expect(state.page).toBe(1);
    expect(state.total).toBe(1);
    expect(state.loading).toBe(false);
  });

  it('lets the newer fetchImages win when two fetches overlap', async () => {
    let resolveFirst!: (v: { items: ImageRecord[]; total: number }) => void;
    vi.mocked(api.listImages).mockImplementation((page: number) => {
      if (page === 1) {
        return new Promise((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve({ items: [{ ...mockImage, id: 'page2' }], total: 2 });
    });

    const first = useImageStore.getState().fetchImages(1);
    const second = useImageStore.getState().fetchImages(2);

    resolveFirst({ items: [{ ...mockImage, id: 'stale-page1' }], total: 9 });
    await Promise.all([first, second]);

    const state = useImageStore.getState();
    expect(state.images.map((i) => i.id)).toEqual(['page2']);
    expect(state.page).toBe(2);
  });

  it('loadMore appends onto the current list, not a stale snapshot', async () => {
    useImageStore.setState({ images: [mockImage], page: 1, total: 2, loading: false });
    // Simulate an optimistic update landing while loadMore is in flight
    vi.mocked(api.listImages).mockImplementation(
      () => new Promise((resolve) =>
        setTimeout(() => resolve({ items: [{ ...mockImage, id: '2' }], total: 3 }), 0),
      ),
    );

    const promise = useImageStore.getState().loadMore();
    useImageStore.getState().updateImage('1', (img) => ({ ...img, favorite: true }));
    await promise;

    const state = useImageStore.getState();
    expect(state.images.map((i) => i.id)).toEqual(['1', '2']);
    expect(state.images[0].favorite).toBe(true);
  });
});

describe('searchImages pagination', () => {
  it('resets page/total so loadMore cannot append paginated items onto search results', async () => {
    useImageStore.setState({ images: [mockImage], page: 1, total: 100 });
    vi.mocked(api.searchImagesAdvanced).mockResolvedValue([{ ...mockImage, id: 's1' }]);

    await useImageStore.getState().searchImages('cat');

    const state = useImageStore.getState();
    expect(state.images.map((i) => i.id)).toEqual(['s1']);
    expect(state.total).toBe(1);
    expect(state.page).toBe(1);

    // loadMore must be a no-op: images.length >= total
    vi.mocked(api.listImages).mockResolvedValue({ items: [{ ...mockImage, id: 'p2' }], total: 100 });
    await useImageStore.getState().loadMore();
    expect(useImageStore.getState().images.map((i) => i.id)).toEqual(['s1']);
  });

  it('clears pagination state on empty query', async () => {
    useImageStore.setState({ images: [mockImage], page: 3, total: 120 });
    await useImageStore.getState().searchImages('   ');

    const state = useImageStore.getState();
    expect(state.images).toEqual([]);
    expect(state.page).toBe(1);
    expect(state.total).toBe(0);
    expect(state.loading).toBe(false);
  });

  it('a completed search result is not overwritten by an earlier stale fetch', async () => {
    let resolveFetch!: (v: { items: ImageRecord[]; total: number }) => void;
    vi.mocked(api.listImages).mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    );
    vi.mocked(api.searchImagesAdvanced).mockResolvedValue([{ ...mockImage, id: 'search-hit' }]);

    const fetchPromise = useImageStore.getState().fetchImages(1);
    await useImageStore.getState().searchImages('cat');
    resolveFetch({ items: [{ ...mockImage, id: 'stale' }], total: 5 });
    await fetchPromise;

    expect(useImageStore.getState().images.map((i) => i.id)).toEqual(['search-hit']);
  });
});

describe('updateImage', () => {
  it('updates the matching image by id', () => {
    useImageStore.setState({
      images: [
        mockImage,
        { ...mockImage, id: '2', rating: 0, favorite: false },
      ],
    });

    useImageStore.getState().updateImage('2', (img) => ({
      ...img,
      favorite: true,
      rating: 5,
    }));

    const { images } = useImageStore.getState();
    expect(images[0].favorite).toBe(false); // id '1' unchanged
    expect(images[0].rating).toBe(0);
    expect(images[1].favorite).toBe(true);
    expect(images[1].rating).toBe(5);
  });

  it('does nothing when id does not match any image', () => {
    useImageStore.setState({ images: [mockImage] });

    useImageStore.getState().updateImage('nonexistent', (img) => ({
      ...img,
      favorite: true,
    }));

    expect(useImageStore.getState().images[0].favorite).toBe(false);
  });

  it('passes the correct image to the updater function', () => {
    useImageStore.setState({ images: [mockImage] });
    const updater = vi.fn((img: ImageRecord) => ({ ...img, rating: 3 }));

    useImageStore.getState().updateImage('1', updater);

    expect(updater).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', rating: 0 }),
    );
    expect(useImageStore.getState().images[0].rating).toBe(3);
  });

  it('supports multiple sequential updates on the same image', () => {
    useImageStore.setState({ images: [mockImage] });
    const { updateImage } = useImageStore.getState();

    updateImage('1', (img) => ({ ...img, rating: 1 }));
    updateImage('1', (img) => ({ ...img, rating: 3 }));
    updateImage('1', (img) => ({ ...img, favorite: true }));

    const img = useImageStore.getState().images[0];
    expect(img.rating).toBe(3);
    expect(img.favorite).toBe(true);
  });

  it('preserves other images when updating one', () => {
    const img1 = { ...mockImage, id: '1', rating: 0 };
    const img2 = { ...mockImage, id: '2', rating: 2 };
    const img3 = { ...mockImage, id: '3', rating: 4 };
    useImageStore.setState({ images: [img1, img2, img3] });

    useImageStore.getState().updateImage('2', (img) => ({ ...img, rating: 5 }));

    const { images } = useImageStore.getState();
    expect(images[0].rating).toBe(0);
    expect(images[1].rating).toBe(5);
    expect(images[2].rating).toBe(4);
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

describe('importImages', () => {
  it('calls api.importImages and prepends new images', async () => {
    const newImage = { ...mockImage, id: 'new-1' };
    vi.mocked(api.importImages).mockResolvedValue({
      items: [newImage],
      imported: 1,
      skipped: 0,
      totalScanned: 1,
    });

    const result = await useImageStore.getState().importImages('/photos');
    expect(api.importImages).toHaveBeenCalledWith('/photos');
    expect(result.imported).toBe(1);
    expect(useImageStore.getState().images[0].id).toBe('new-1');
    expect(useImageStore.getState().total).toBe(1);
  });

  it('sets loading state during import', async () => {
    let resolvePromise: (value: any) => void;
    vi.mocked(api.importImages).mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

    const importPromise = useImageStore.getState().importImages('/photos');
    expect(useImageStore.getState().loading).toBe(true);

    resolvePromise!({ items: [], imported: 0, skipped: 0, totalScanned: 0 });
    await importPromise;
    expect(useImageStore.getState().loading).toBe(false);
  });

  it('sets error on failure', async () => {
    vi.mocked(api.importImages).mockRejectedValue(new Error('Import failed'));

    await expect(useImageStore.getState().importImages('/bad')).rejects.toThrow('Import failed');
    expect(useImageStore.getState().error).toBe('Import failed');
    expect(useImageStore.getState().loading).toBe(false);
  });
});

describe('exportImages', () => {
  it('calls api.exportImages with correct params', async () => {
    vi.mocked(api.exportImages).mockResolvedValue({ success: 2, failed: 0, destDir: "/output" });

    const result = await useImageStore.getState().exportImages(['1', '2'], '/output', 'png');
    expect(api.exportImages).toHaveBeenCalledWith(['1', '2'], '/output', 'png', undefined);
    expect(result.success).toBe(2);
  });

  it('sets error on failure', async () => {
    vi.mocked(api.exportImages).mockRejectedValue(new Error('Export failed'));

    await expect(useImageStore.getState().exportImages(['1'], '/output', 'png')).rejects.toThrow('Export failed');
    expect(useImageStore.getState().error).toBe('Export failed');
  });
});
