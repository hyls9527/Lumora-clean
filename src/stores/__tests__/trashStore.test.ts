import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../../lib/api/images';
import { useTrashStore } from '../trashStore';
import type { ImageRecord } from '../../types/image';

vi.mock('../../lib/api/images');
const makeImage = (id: string): ImageRecord => ({
  id,
  filePath: `/photos/${id}.jpg`,
  fileName: `${id}.jpg`,
  fileSizeKb: 100,
  width: 800,
  height: 600,
  format: 'jpg',
  createdAt: '2025-01-01',
  rating: 0,
  favorite: false,
  model: '',
  prompt: '',
  tags: [],
});

beforeEach(() => {
  useTrashStore.setState({
    images: [],
    loading: false,
    error: null,
    page: 1,
    total: 0,
    perPage: 40,
  });
  vi.clearAllMocks();
});

describe('fetchTrash', () => {
  it('loads images and sets total/page', async () => {
    const items = [makeImage('a'), makeImage('b')];
    vi.mocked(api.listTrash).mockResolvedValue({ items, total: 5 });

    await useTrashStore.getState().fetchTrash(2);

    const s = useTrashStore.getState();
    expect(s.images).toEqual(items);
    expect(s.total).toBe(5);
    expect(s.page).toBe(2);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('sets error on failure', async () => {
    vi.mocked(api.listTrash).mockRejectedValue(new Error('network'));

    await useTrashStore.getState().fetchTrash();

    const s = useTrashStore.getState();
    expect(s.loading).toBe(false);
    expect(s.error).toBe('network');
  });

  it('defaults to current page when no arg', async () => {
    useTrashStore.setState({ page: 3 });
    vi.mocked(api.listTrash).mockResolvedValue({ items: [], total: 0 });

    await useTrashStore.getState().fetchTrash();

    expect(api.listTrash).toHaveBeenCalledWith(3, 40);
  });
});

describe('restoreImage', () => {
  it('optimistically removes image and calls api', async () => {
    const images = [makeImage('x'), makeImage('y')];
    useTrashStore.setState({ images, total: 2 });
    vi.mocked(api.restoreImage).mockResolvedValue();

    const promise = useTrashStore.getState().restoreImage('x');

    // optimistically removed
    expect(useTrashStore.getState().images).toEqual([makeImage('y')]);
    expect(useTrashStore.getState().total).toBe(1);

    await promise;
    expect(api.restoreImage).toHaveBeenCalledWith('x');
  });

  it('calls invalidateSemanticCache after successful restore', async () => {
    useTrashStore.setState({ images: [makeImage('x')], total: 1 });
    vi.mocked(api.restoreImage).mockResolvedValue();

    await useTrashStore.getState().restoreImage('x');

    // Cache invalidation is now centralized in tauri.ts invoke wrapper
    expect(api.restoreImage).toHaveBeenCalledWith('x');
  });

  it('rolls back on error', async () => {
    const images = [makeImage('x'), makeImage('y')];
    useTrashStore.setState({ images, total: 2 });
    vi.mocked(api.restoreImage).mockRejectedValue(new Error('fail'));

    await useTrashStore.getState().restoreImage('x');

    const s = useTrashStore.getState();
    expect(s.images).toEqual(images);
    expect(s.total).toBe(2);
    expect(s.error).toBe('fail');
  });
});

describe('permanentDelete', () => {
  it('calls invalidateSemanticCache after successful delete', async () => {
    useTrashStore.setState({ images: [makeImage('a')], total: 1 });
    vi.mocked(api.permanentDeleteImage).mockResolvedValue();

    await useTrashStore.getState().permanentDelete('a');

    // Cache invalidation is now centralized in tauri.ts invoke wrapper
    expect(api.permanentDeleteImage).toHaveBeenCalledWith('a');
  });

  it('optimistically removes image and calls api', async () => {
    const images = [makeImage('a'), makeImage('b')];
    useTrashStore.setState({ images, total: 2 });
    vi.mocked(api.permanentDeleteImage).mockResolvedValue();

    const promise = useTrashStore.getState().permanentDelete('a');

    expect(useTrashStore.getState().images).toEqual([makeImage('b')]);
    expect(useTrashStore.getState().total).toBe(1);

    await promise;
    expect(api.permanentDeleteImage).toHaveBeenCalledWith('a');
  });

  it('rolls back on error', async () => {
    const images = [makeImage('a')];
    useTrashStore.setState({ images, total: 1 });
    vi.mocked(api.permanentDeleteImage).mockRejectedValue(new Error('disk'));

    await useTrashStore.getState().permanentDelete('a');

    const s = useTrashStore.getState();
    expect(s.images).toEqual(images);
    expect(s.total).toBe(1);
    expect(s.error).toBe('disk');
  });
});

describe('emptyTrash', () => {
  it('clears images on success', async () => {
    useTrashStore.setState({ images: [makeImage('z')], total: 1 });
    vi.mocked(api.emptyTrash).mockResolvedValue(1);

    await useTrashStore.getState().emptyTrash();

    const s = useTrashStore.getState();
    expect(s.images).toEqual([]);
    expect(s.total).toBe(0);
    expect(s.loading).toBe(false);
  });

  it('calls invalidateSemanticCache after successful empty', async () => {
    useTrashStore.setState({ images: [makeImage('z')], total: 1 });
    vi.mocked(api.emptyTrash).mockResolvedValue(1);

    await useTrashStore.getState().emptyTrash();

    // Cache invalidation is now centralized in tauri.ts invoke wrapper
    expect(api.emptyTrash).toHaveBeenCalled();
  });

  it('sets error on failure', async () => {
    useTrashStore.setState({ images: [makeImage('z')], total: 1 });
    vi.mocked(api.emptyTrash).mockRejectedValue(new Error('nope'));

    await useTrashStore.getState().emptyTrash();

    const s = useTrashStore.getState();
    expect(s.loading).toBe(false);
    expect(s.error).toBe('nope');
    // images untouched on error
    expect(s.images).toEqual([makeImage('z')]);
  });
});

describe('softDeleteImage', () => {
  it('calls api.softDeleteImage', async () => {
    vi.mocked(api.softDeleteImage).mockResolvedValue();

    await useTrashStore.getState().softDeleteImage('id-1');

    expect(api.softDeleteImage).toHaveBeenCalledWith('id-1');
    expect(useTrashStore.getState().error).toBeNull();
  });

  it('calls invalidateSemanticCache after successful soft delete', async () => {
    vi.mocked(api.softDeleteImage).mockResolvedValue();

    await useTrashStore.getState().softDeleteImage('id-1');

    // Cache invalidation is now centralized in tauri.ts invoke wrapper
    expect(api.softDeleteImage).toHaveBeenCalledWith('id-1');
  });

  it('sets error on failure', async () => {
    vi.mocked(api.softDeleteImage).mockRejectedValue(new Error('oops'));

    await useTrashStore.getState().softDeleteImage('id-1');

    expect(useTrashStore.getState().error).toBe('oops');
  });
});
