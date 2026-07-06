import type { SemanticSearchResult } from '../../lib/api/semantic';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useImageSearchStore } from '../imageSearchStore';

vi.mock('../../lib/api/semantic', () => ({
  searchByImage: vi.fn(),
}));

import { searchByImage } from '../../lib/api/semantic';
const mockSearchByImage = vi.mocked(searchByImage);

describe('useImageSearchStore', () => {
  beforeEach(() => {
    useImageSearchStore.setState({
      sourceImageId: null,
      sourceFilePath: null,
      results: [],
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('should have initial state', () => {
    const state = useImageSearchStore.getState();
    expect(state.sourceImageId).toBeNull();
    expect(state.sourceFilePath).toBeNull();
    expect(state.results).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should search by image and store results', async () => {
    mockSearchByImage.mockResolvedValue([
      { id: 'img-2', similarity: 85 },
      { id: 'img-3', similarity: 72 },
    ]);

    await useImageSearchStore.getState().search('img-1', '/path/to/image.png');

    const state = useImageSearchStore.getState();
    expect(state.sourceImageId).toBe('img-1');
    expect(state.sourceFilePath).toBe('/path/to/image.png');
    expect(state.results).toEqual([
      { id: 'img-2', similarity: 85 },
      { id: 'img-3', similarity: 72 },
    ]);
    expect(state.loading).toBe(false);
  });

  it('should call searchByImage with file path and exclude id', async () => {
    mockSearchByImage.mockResolvedValue([]);

    await useImageSearchStore.getState().search('img-1', '/path/to/image.png');

    expect(mockSearchByImage).toHaveBeenCalledWith('/path/to/image.png', 20, 'img-1');
  });

  it('should set loading during search', async () => {
    let resolveSearch!: (v: SemanticSearchResult[]) => void;
    mockSearchByImage.mockReturnValue(new Promise((r) => { resolveSearch = r; }));

    const searchPromise = useImageSearchStore.getState().search('img-1', '/path.png');
    expect(useImageSearchStore.getState().loading).toBe(true);

    resolveSearch!([]);
    await searchPromise;
    expect(useImageSearchStore.getState().loading).toBe(false);
  });

  it('should set error on failure', async () => {
    mockSearchByImage.mockRejectedValue(new Error('CLIP not available'));

    await useImageSearchStore.getState().search('img-1', '/path.png');

    expect(useImageSearchStore.getState().error).toBe('CLIP not available');
    expect(useImageSearchStore.getState().loading).toBe(false);
  });

  it('should clear state', () => {
    useImageSearchStore.setState({
      sourceImageId: 'img-1',
      sourceFilePath: '/path.png',
      results: [{ id: 'img-2', similarity: 85 }],
    });

    useImageSearchStore.getState().clear();

    const state = useImageSearchStore.getState();
    expect(state.sourceImageId).toBeNull();
    expect(state.results).toEqual([]);
  });
});
