import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tauri module BEFORE importing anything that uses it
const mockInvoke = vi.fn();
vi.mock('../../tauri', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  isTauriAvailable: true,
}));

import {
  importImages,
  listImages,
  searchImages,
  updateRating,
  toggleFavorite,
  softDeleteImage,
  restoreImage,
  permanentDeleteImage,
  listTrash,
  emptyTrash,
  toImageRecord,
  type TauriImageRecord,
} from '../images';

const SAMPLE_RAW: TauriImageRecord = {
  id: '1',
  filePath: '/photos/test.png',
  fileHash: 'abc123',
  fileSizeKb: 1024,
  width: 512,
  height: 512,
  format: 'png',
  createdAt: '2024-01-01T00:00:00Z',
  importedAt: '2024-01-02T00:00:00Z',
  deleted: false,
  deletedAt: null,
  rating: 3,
  favorite: false,
  metadataJson: '{"model":"dall-e","prompt":"a cat","tags":["animal"]}',
};

const SAMPLE_IMPORT_RESULT = {
  items: [SAMPLE_RAW],
  imported: 1,
  skipped: 0,
  totalScanned: 1,
};

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('toImageRecord', () => {
  it('maps snake_case Tauri fields to camelCase', () => {
    const record = toImageRecord(SAMPLE_RAW);
    expect(record.id).toBe('1');
    expect(record.filePath).toBe('/photos/test.png');
    expect(record.fileSizeKb).toBe(1024);
    expect(record.format).toBe('png');
  });
});

describe('API calls', () => {
  it('importImages → import_images', async () => {
    mockInvoke.mockResolvedValue(SAMPLE_IMPORT_RESULT);
    const result = await importImages('/photos');
    expect(mockInvoke).toHaveBeenCalledWith('import_images', { path: '/photos' });
    expect(result.imported).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('1');
  });

  it('listImages → list_images', async () => {
    mockInvoke.mockResolvedValue({ items: [SAMPLE_RAW], total: 1, page: 1, perPage: 40 });
    const result = await listImages(1, 40);
    expect(mockInvoke).toHaveBeenCalledWith('list_images', { page: 1, perPage: 40 });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('searchImages → search_images', async () => {
    mockInvoke.mockResolvedValue([SAMPLE_RAW]);
    await searchImages('cat');
    expect(mockInvoke).toHaveBeenCalledWith('search_images', { query: 'cat' });
  });

  it('updateRating → update_rating', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await updateRating('1', 5);
    expect(mockInvoke).toHaveBeenCalledWith('update_rating', { id: '1', rating: 5 });
  });

  it('toggleFavorite → toggle_favorite', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await toggleFavorite('1');
    expect(mockInvoke).toHaveBeenCalledWith('toggle_favorite', { id: '1' });
  });

  it('softDeleteImage → soft_delete_image', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await softDeleteImage('1');
    expect(mockInvoke).toHaveBeenCalledWith('soft_delete_image', { id: '1' });
  });

  it('restoreImage → restore_image', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await restoreImage('1');
    expect(mockInvoke).toHaveBeenCalledWith('restore_image', { id: '1' });
  });

  it('permanentDeleteImage → permanent_delete_image', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await permanentDeleteImage('1');
    expect(mockInvoke).toHaveBeenCalledWith('permanent_delete_image', { id: '1' });
  });

  it('listTrash → list_trash', async () => {
    mockInvoke.mockResolvedValue({ items: [SAMPLE_RAW], total: 1, page: 1, perPage: 40 });
    const result = await listTrash(1, 40);
    expect(mockInvoke).toHaveBeenCalledWith('list_trash', { page: 1, perPage: 40 });
    expect(result.total).toBe(1);
  });

  it('emptyTrash → empty_trash', async () => {
    mockInvoke.mockResolvedValue(3);
    const result = await emptyTrash();
    expect(mockInvoke).toHaveBeenCalledWith('empty_trash');
    expect(result).toBe(3);
  });
});

describe('toImageRecord transform', () => {
  it('extracts model/prompt/tags from metadataJson', async () => {
    mockInvoke.mockResolvedValue(SAMPLE_IMPORT_RESULT);
    const result = await importImages('/x');
    const record = result.items[0];
    expect(record.model).toBe('dall-e');
    expect(record.prompt).toBe('a cat');
    expect(record.tags).toEqual(['animal']);
  });

  it('metadataJson null → empty model/prompt/tags', async () => {
    const raw: TauriImageRecord = { ...SAMPLE_RAW, metadataJson: null };
    mockInvoke.mockResolvedValue({ items: [raw], imported: 1, skipped: 0, totalScanned: 1 });
    const result = await importImages('/x');
    const record = result.items[0];
    expect(record.model).toBe('');
    expect(record.prompt).toBe('');
    expect(record.tags).toEqual([]);
  });

  it('invalid metadataJson → empty model/prompt/tags', async () => {
    const raw: TauriImageRecord = { ...SAMPLE_RAW, metadataJson: 'not-json{' };
    mockInvoke.mockResolvedValue({ items: [raw], imported: 1, skipped: 0, totalScanned: 1 });
    const result = await importImages('/x');
    const record = result.items[0];
    expect(record.model).toBe('');
    expect(record.prompt).toBe('');
    expect(record.tags).toEqual([]);
  });

  it('extracts fileName from filePath', async () => {
    mockInvoke.mockResolvedValue(SAMPLE_IMPORT_RESULT);
    const result = await importImages('/x');
    const record = result.items[0];
    expect(record.fileName).toBe('test.png');
  });

  it('width/height default to 0 when null', async () => {
    const raw: TauriImageRecord = { ...SAMPLE_RAW, width: null, height: null };
    mockInvoke.mockResolvedValue({ items: [raw], imported: 1, skipped: 0, totalScanned: 1 });
    const result = await importImages('/x');
    const record = result.items[0];
    expect(record.width).toBe(0);
    expect(record.height).toBe(0);
  });
});
