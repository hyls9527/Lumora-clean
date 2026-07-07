import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('../../tauri', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
  isTauriAvailable: true,
}));

import {
  importImages,
  listImages,
  searchImages,
  searchImagesAdvanced,
  updateRating,
  toggleFavorite,
  softDeleteImage,
  restoreImage,
  permanentDeleteImage,
  listFavorites,
  listTrash,
  emptyTrash,
  exportImages,
  type TauriImageRecord,
} from '../images';

const SAMPLE_RAW: TauriImageRecord = {
  id: 'img-1',
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
  metadataJson: '{"model":"sdxl","prompt":"a cat","tags":["animal"]}',
};

describe('Core write commands — full lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Import ──
  describe('import', () => {
    it('importImages sends path and returns mapped result', async () => {
      mockInvoke.mockResolvedValue({
        items: [SAMPLE_RAW],
        imported: 1,
        skipped: 0,
        totalScanned: 1,
      });

      const result = await importImages('/photos');
      expect(mockInvoke).toHaveBeenCalledWith('import_images', { path: '/photos' });
      expect(result.imported).toBe(1);
      expect(result.items[0].id).toBe('img-1');
      expect(result.items[0].model).toBe('sdxl');
    });

    it('importImages handles empty folder', async () => {
      mockInvoke.mockResolvedValue({
        items: [],
        imported: 0,
        skipped: 0,
        totalScanned: 0,
      });

      const result = await importImages('/empty');
      expect(result.imported).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('importImages propagates errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Folder not found'));
      await expect(importImages('/bad')).rejects.toThrow('Folder not found');
    });
  });

  // ── List ──
  describe('list', () => {
    it('listImages sends pagination params', async () => {
      mockInvoke.mockResolvedValue({
        items: [SAMPLE_RAW],
        total: 1,
        page: 1,
        perPage: 40,
      });

      const result = await listImages(1, 40);
      expect(mockInvoke).toHaveBeenCalledWith('list_images', { page: 1, perPage: 40 });
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('img-1');
    });

    it('listImages handles page 2', async () => {
      mockInvoke.mockResolvedValue({
        items: [],
        total: 1,
        page: 2,
        perPage: 40,
      });

      const result = await listImages(2, 40);
      expect(result.items).toEqual([]);
    });
  });

  // ── Search ──
  describe('search', () => {
    it('searchImages sends query', async () => {
      mockInvoke.mockResolvedValue([SAMPLE_RAW]);

      const results = await searchImages('cat');
      expect(mockInvoke).toHaveBeenCalledWith('search_images', { query: 'cat' });
      expect(results).toHaveLength(1);
    });

    it('searchImagesAdvanced sends query and field', async () => {
      mockInvoke.mockResolvedValue([SAMPLE_RAW]);

      const results = await searchImagesAdvanced('cat', 'prompt');
      expect(mockInvoke).toHaveBeenCalledWith('search_images_advanced', { query: 'cat', field: 'prompt' });
      expect(results).toHaveLength(1);
    });

    it('searchImagesAdvanced handles empty results', async () => {
      mockInvoke.mockResolvedValue([]);
      const results = await searchImagesAdvanced('nonexistent', 'all');
      expect(results).toEqual([]);
    });
  });

  // ── Rating ──
  describe('rating', () => {
    it('updateRating sends id and rating', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await updateRating('img-1', 4);
      expect(mockInvoke).toHaveBeenCalledWith('update_rating', { id: 'img-1', rating: 4 });
    });

    it('updateRating accepts 0 (clear rating)', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await updateRating('img-1', 0);
      expect(mockInvoke).toHaveBeenCalledWith('update_rating', { id: 'img-1', rating: 0 });
    });
  });

  // ── Favorite ──
  describe('favorite', () => {
    it('toggleFavorite sends id', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await toggleFavorite('img-1');
      expect(mockInvoke).toHaveBeenCalledWith('toggle_favorite', { id: 'img-1' });
    });

    it('listFavorites returns mapped results', async () => {
      mockInvoke.mockResolvedValue([{ ...SAMPLE_RAW, favorite: true }]);

      const results = await listFavorites();
      expect(mockInvoke).toHaveBeenCalledWith('list_favorites');
      expect(results).toHaveLength(1);
      expect(results[0].favorite).toBe(true);
    });
  });

  // ── Delete / Restore / Permanent Delete ──
  describe('trash lifecycle', () => {
    it('softDeleteImage sends id', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await softDeleteImage('img-1');
      expect(mockInvoke).toHaveBeenCalledWith('soft_delete_image', { id: 'img-1' });
    });

    it('restoreImage sends id', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await restoreImage('img-1');
      expect(mockInvoke).toHaveBeenCalledWith('restore_image', { id: 'img-1' });
    });

    it('permanentDeleteImage sends id', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await permanentDeleteImage('img-1');
      expect(mockInvoke).toHaveBeenCalledWith('permanent_delete_image', { id: 'img-1' });
    });

    it('listTrash sends pagination params', async () => {
      mockInvoke.mockResolvedValue({
        items: [{ ...SAMPLE_RAW, deleted: true, deletedAt: '2024-06-01' }],
        total: 1,
        page: 1,
        perPage: 40,
      });

      const result = await listTrash(1, 40);
      expect(mockInvoke).toHaveBeenCalledWith('list_trash', { page: 1, perPage: 40 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('img-1');
    });

    it('emptyTrash sends no params', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await emptyTrash();
      expect(mockInvoke).toHaveBeenCalledWith('empty_trash');
    });
  });

  // ── Export ──
  describe('export', () => {
    it('exportImages sends ids, destDir, format', async () => {
      mockInvoke.mockResolvedValue({ success: 2, failed: 0 });

      const result = await exportImages(['img-1', 'img-2'], '/output', 'png');
      expect(mockInvoke).toHaveBeenCalledWith('export_images', {
        ids: ['img-1', 'img-2'],
        destDir: '/output',
        format: 'png',
        renameTemplate: undefined,
      });
      expect(result.success).toBe(2);
    });

    it('exportImages with rename template', async () => {
      mockInvoke.mockResolvedValue({ success: 1, failed: 0 });

      await exportImages(['img-1'], '/output', 'jpg', '{prompt}_{seed}');
      expect(mockInvoke).toHaveBeenCalledWith('export_images', {
        ids: ['img-1'],
        destDir: '/output',
        format: 'jpg',
        renameTemplate: '{prompt}_{seed}',
      });
    });
  });

  // ── Full lifecycle: import → rate → favorite → delete → restore → permanent delete ──
  describe('full lifecycle', () => {
    it('import → rate → favorite → soft delete → restore → permanent delete', async () => {
      // 1. Import
      mockInvoke.mockResolvedValue({
        items: [SAMPLE_RAW],
        imported: 1,
        skipped: 0,
        totalScanned: 1,
      });
      const imported = await importImages('/photos');
      expect(imported.items[0].id).toBe('img-1');

      // 2. Rate
      mockInvoke.mockResolvedValue(undefined);
      await updateRating('img-1', 5);
      expect(mockInvoke).toHaveBeenCalledWith('update_rating', { id: 'img-1', rating: 5 });

      // 3. Favorite
      await toggleFavorite('img-1');
      expect(mockInvoke).toHaveBeenCalledWith('toggle_favorite', { id: 'img-1' });

      // 4. Soft delete
      await softDeleteImage('img-1');
      expect(mockInvoke).toHaveBeenCalledWith('soft_delete_image', { id: 'img-1' });

      // 5. Restore
      await restoreImage('img-1');
      expect(mockInvoke).toHaveBeenCalledWith('restore_image', { id: 'img-1' });

      // 6. Permanent delete
      await permanentDeleteImage('img-1');
      expect(mockInvoke).toHaveBeenCalledWith('permanent_delete_image', { id: 'img-1' });

      // Verify all 6 calls were made
      expect(mockInvoke).toHaveBeenCalledTimes(6);
    });
  });
});
