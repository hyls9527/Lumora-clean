import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API module
vi.mock('../../lib/api/images', () => ({
  getVariantGroupImages: vi.fn(),
}));

import { useVariantStore } from '../variantStore';
import { getVariantGroupImages } from '../../lib/api/images';
import type { ImageRecord } from '../../types/image';

const mockGetVariantGroupImages = vi.mocked(getVariantGroupImages);

const SAMPLE_IMAGE: ImageRecord = {
  id: '1',
  filePath: '/photos/test.png',
  fileName: 'test.png',
  fileSizeKb: 1024,
  width: 512,
  height: 512,
  format: 'png',
  createdAt: '2024-01-01T00:00:00Z',
  rating: 3,
  favorite: false,
  model: 'dall-e',
  prompt: 'a cat',
  tags: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useVariantStore.setState({
    variants: [],
    loading: false,
    error: null,
    currentGroupId: null,
  });
});

describe('variantStore', () => {
  it('has initial state', () => {
    const state = useVariantStore.getState();
    expect(state.variants).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.currentGroupId).toBeNull();
  });

  it('fetchVariants sets loading and calls API', async () => {
    mockGetVariantGroupImages.mockResolvedValue([SAMPLE_IMAGE]);

    const promise = useVariantStore.getState().fetchVariants('group-1');
    expect(useVariantStore.getState().loading).toBe(true);

    await promise;
    expect(mockGetVariantGroupImages).toHaveBeenCalledWith('group-1');
    expect(useVariantStore.getState().variants).toHaveLength(1);
    expect(useVariantStore.getState().loading).toBe(false);
    expect(useVariantStore.getState().currentGroupId).toBe('group-1');
  });

  it('fetchVariants handles errors', async () => {
    mockGetVariantGroupImages.mockRejectedValue(new Error('Network error'));

    await useVariantStore.getState().fetchVariants('group-1');
    expect(useVariantStore.getState().error).toBe('Network error');
    expect(useVariantStore.getState().loading).toBe(false);
  });

  it('clearVariants resets state', () => {
    useVariantStore.setState({
      variants: [SAMPLE_IMAGE],
      currentGroupId: 'group-1',
    });

    useVariantStore.getState().clearVariants();
    expect(useVariantStore.getState().variants).toEqual([]);
    expect(useVariantStore.getState().currentGroupId).toBeNull();
  });
});
