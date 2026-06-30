import { create } from 'zustand';
import * as api from '../lib/api/images';
import type { ImageRecord } from '../types/image';

interface TrashStore {
  images: ImageRecord[];
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  perPage: number;
  // Async actions
  fetchTrash: (page?: number) => Promise<void>;
  restoreImage: (id: string) => Promise<void>;
  permanentDelete: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  softDeleteImage: (id: string) => Promise<void>;
}

export const useTrashStore = create<TrashStore>((set, get) => ({
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
      const result = await api.listTrash(p, perPage);
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
    // Optimistic: remove from list
    const prev = get().images;
    set({ images: prev.filter((img) => img.id !== id), total: get().total - 1 });
    try {
      await api.restoreImage(id);
    } catch (err) {
      // Rollback
      set({ images: prev, total: get().total + 1 });
      set({ error: err instanceof Error ? err.message : '恢复失败' });
    }
  },

  permanentDelete: async (id: string) => {
    const prev = get().images;
    set({ images: prev.filter((img) => img.id !== id), total: get().total - 1 });
    try {
      await api.permanentDeleteImage(id);
    } catch (err) {
      set({ images: prev, total: get().total + 1 });
      set({ error: err instanceof Error ? err.message : '删除失败' });
    }
  },

  emptyTrash: async () => {
    set({ loading: true, error: null });
    try {
      await api.emptyTrash();
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
      await api.softDeleteImage(id);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '删除失败' });
    }
  },
}));
