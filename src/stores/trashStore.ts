import { create, type StateCreator } from 'zustand';
import * as api from '../lib/api/images';

import type { ImageRecord } from '../types/image';

/** External dependencies consumed by trashStore. */
export interface TrashStoreDeps {
  listTrash: (page: number, perPage: number) => Promise<{ items: ImageRecord[]; total: number }>;
  restoreImage: (id: string) => Promise<void>;
  permanentDeleteImage: (id: string) => Promise<void>;
  emptyTrash: () => Promise<number>;
  softDeleteImage: (id: string) => Promise<void>;
  batchSoftDelete: (ids: string[]) => Promise<number>;
}

const defaultDeps: TrashStoreDeps = {
  listTrash: api.listTrash,
  restoreImage: api.restoreImage,
  permanentDeleteImage: api.permanentDeleteImage,
  emptyTrash: api.emptyTrash,
  softDeleteImage: api.softDeleteImage,
  batchSoftDelete: api.batchSoftDelete,
};

interface TrashStore {
  images: ImageRecord[];
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  perPage: number;
  fetchTrash: (page?: number) => Promise<void>;
  restoreImage: (id: string) => Promise<void>;
  permanentDelete: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  softDeleteImage: (id: string) => Promise<void>;
  batchSoftDelete: (ids: string[]) => Promise<number>;
}

export function createTrashStore(deps: TrashStoreDeps = defaultDeps): StateCreator<TrashStore, [], []> {
  return (set, get) => ({
    images: [],
    loading: false,
    error: null,
    page: 1,
    total: 0,
    perPage: 40,

    fetchTrash: async (page?: number) => {
      const { perPage } = get();
      const p = page ?? get().page;
      set({ loading: true, error: null });
      try {
        const result = await deps.listTrash(p, perPage);
        set({
          images: result.items,
          total: result.total,
          page: p,
          loading: false,
        });
      } catch (err) {
        set({
          loading: false,
          error: err instanceof Error ? err.message : '加载回收站失败',
        });
      }
    },

    restoreImage: async (id: string) => {
      const prev = get().images;
      set({ images: prev.filter((img) => img.id !== id), total: get().total - 1 });
      try {
        await deps.restoreImage(id);
      } catch (err) {
        set({ images: prev, total: get().total + 1 });
        set({ error: err instanceof Error ? err.message : '恢复失败' });
      }
    },

    permanentDelete: async (id: string) => {
      const prev = get().images;
      set({ images: prev.filter((img) => img.id !== id), total: get().total - 1 });
      try {
        await deps.permanentDeleteImage(id);
      } catch (err) {
        set({ images: prev, total: get().total + 1 });
        set({ error: err instanceof Error ? err.message : '删除失败' });
      }
    },

    emptyTrash: async () => {
      set({ loading: true, error: null });
      try {
        await deps.emptyTrash();
        set({ images: [], total: 0, loading: false });
      } catch (err) {
        set({
          loading: false,
          error: err instanceof Error ? err.message : '清空回收站失败',
        });
      }
    },

    softDeleteImage: async (id: string) => {
      try {
        await deps.softDeleteImage(id);
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '删除失败' });
      }
    },

    batchSoftDelete: async (ids: string[]) => {
      try {
        const count = await deps.batchSoftDelete(ids);
        return count;
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '批量删除失败' });
        throw err;
      }
    },
  });
}

export const useTrashStore = create<TrashStore>()(createTrashStore(defaultDeps));
