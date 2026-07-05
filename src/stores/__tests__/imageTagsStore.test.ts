import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/api/images', () => ({
  getImageTags: vi.fn(),
  addTagToImage: vi.fn(),
  removeTagFromImage: vi.fn(),
}));

import { useImageTagsStore } from '../imageTagsStore';
import * as api from '../../lib/api/images';

beforeEach(() => {
  vi.clearAllMocks();
  useImageTagsStore.setState({
    imageTags: {},
    error: null,
  });
});

describe('fetchImageTags', () => {
  it('fetches and stores tags for an image', async () => {
    vi.mocked(api.getImageTags).mockResolvedValue([
      { id: 't1', name: 'landscape', color: null, createdAt: '2024-01-01T00:00:00Z' },
      { id: 't2', name: 'sunset', color: null, createdAt: '2024-01-01T00:00:00Z' },
    ]);

    await useImageTagsStore.getState().fetchImageTags('img-1');

    expect(useImageTagsStore.getState().imageTags['img-1']).toEqual(['landscape', 'sunset']);
    expect(api.getImageTags).toHaveBeenCalledWith('img-1');
  });

  it('sets error on failure', async () => {
    vi.mocked(api.getImageTags).mockRejectedValue(new Error('tag fetch failed'));

    await useImageTagsStore.getState().fetchImageTags('img-1');

    expect(useImageTagsStore.getState().error).toBe('tag fetch failed');
  });

  it('preserves existing tags for other images', async () => {
    useImageTagsStore.setState({ imageTags: { 'img-0': ['old'] } });
    vi.mocked(api.getImageTags).mockResolvedValue([{ id: 't1', name: 'new', color: null, createdAt: '2024-01-01T00:00:00Z' }]);

    await useImageTagsStore.getState().fetchImageTags('img-1');

    expect(useImageTagsStore.getState().imageTags['img-0']).toEqual(['old']);
    expect(useImageTagsStore.getState().imageTags['img-1']).toEqual(['new']);
  });
});

describe('addTagToImage', () => {
  it('adds tag and refreshes tag list', async () => {
    vi.mocked(api.addTagToImage).mockResolvedValue(undefined);
    vi.mocked(api.getImageTags).mockResolvedValue([{ id: 't1', name: 'added', color: null, createdAt: '2024-01-01T00:00:00Z' }]);

    await useImageTagsStore.getState().addTagToImage('img-1', 't1');

    expect(api.addTagToImage).toHaveBeenCalledWith('img-1', 't1');
    expect(useImageTagsStore.getState().imageTags['img-1']).toEqual(['added']);
  });

  it('sets error on failure', async () => {
    vi.mocked(api.addTagToImage).mockRejectedValue(new Error('add tag failed'));

    await useImageTagsStore.getState().addTagToImage('img-1', 't1');

    expect(useImageTagsStore.getState().error).toBe('add tag failed');
  });
});

describe('removeTagFromImage', () => {
  it('removes tag and refreshes tag list', async () => {
    vi.mocked(api.removeTagFromImage).mockResolvedValue(undefined);
    vi.mocked(api.getImageTags).mockResolvedValue([]);

    await useImageTagsStore.getState().removeTagFromImage('img-1', 't1');

    expect(api.removeTagFromImage).toHaveBeenCalledWith('img-1', 't1');
    expect(useImageTagsStore.getState().imageTags['img-1']).toEqual([]);
  });

  it('sets error on failure', async () => {
    vi.mocked(api.removeTagFromImage).mockRejectedValue(new Error('remove tag failed'));

    await useImageTagsStore.getState().removeTagFromImage('img-1', 't1');

    expect(useImageTagsStore.getState().error).toBe('remove tag failed');
  });
});
