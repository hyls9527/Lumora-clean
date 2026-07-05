import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/api/images', () => ({
  listImages: vi.fn(),
  searchImagesAdvanced: vi.fn(),
  importImages: vi.fn(),
  exportImages: vi.fn(),
}));

import { useImageStore } from '../imageStore';
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
