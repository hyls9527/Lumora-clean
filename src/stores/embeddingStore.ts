import { create, type StateCreator } from 'zustand';
import {
  getEmbeddingStatus,
  getEmbeddingStats,
  getClipEmbeddingStats,
  generateEmbeddings,
  embedMissing,
  embedClipMissing,
  type EmbeddingInfo,
  type EmbeddingStats,
  type ClipEmbeddingStats,
} from '../lib/api/embeddings';

import type { ImageRecord } from '../types/image';

/** External dependencies consumed by embeddingStore. */
export interface EmbeddingStoreDeps {
  getEmbeddingStatus: (imageId: string) => Promise<EmbeddingInfo>;
  getEmbeddingStats: () => Promise<EmbeddingStats>;
  getClipEmbeddingStats: () => Promise<ClipEmbeddingStats>;
  generateEmbeddings: (images: ImageRecord[]) => Promise<void>;
  embedMissing: (limit: number) => Promise<{ processed: number; remaining: number }>;
  embedClipMissing: (limit: number) => Promise<{ processed: number; remaining: number }>;
}

const defaultDeps: EmbeddingStoreDeps = {
  getEmbeddingStatus,
  getEmbeddingStats,
  getClipEmbeddingStats,
  generateEmbeddings,
  embedMissing,
  embedClipMissing,
};

interface EmbeddingStore {
  statusMap: Record<string, EmbeddingInfo>;
  stats: EmbeddingStats | null;
  clipStats: ClipEmbeddingStats | null;
  statsLoading: boolean;
  generating: boolean;
  filling: boolean;
  clipFilling: boolean;
  fillProgress: { processed: number; remaining: number } | null;
  clipFillProgress: { processed: number; remaining: number } | null;
  error: string | null;
  fetchStatus: (imageId: string) => Promise<void>;
  fetchStatuses: (imageIds: string[]) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchClipStats: () => Promise<void>;
  generate: (images: ImageRecord[]) => Promise<void>;
  fillMissing: (limit?: number) => Promise<void>;
  fillClipMissing: (limit?: number) => Promise<void>;
  fillAllMissing: (limit?: number) => Promise<void>;
}

export function createEmbeddingStore(deps: EmbeddingStoreDeps = defaultDeps): StateCreator<EmbeddingStore, [], []> {
  return (set, get) => ({
    statusMap: {},
    stats: null,
    clipStats: null,
    statsLoading: false,
    generating: false,
    filling: false,
    clipFilling: false,
    fillProgress: null,
    clipFillProgress: null,
    error: null,

    fetchStatus: async (imageId: string) => {
      try {
        const info = await deps.getEmbeddingStatus(imageId);
        set((s) => ({ statusMap: { ...s.statusMap, [imageId]: info } }));
      } catch {
        // Individual status fetch is non-critical, silent
      }
    },

    fetchStatuses: async (imageIds: string[]) => {
      if (imageIds.length === 0) return;
      const BATCH = 10;
      try {
        const results: EmbeddingInfo[] = [];
        for (let i = 0; i < imageIds.length; i += BATCH) {
          const batch = imageIds.slice(i, i + BATCH);
          const batchResults = await Promise.all(batch.map(deps.getEmbeddingStatus));
          results.push(...batchResults);
        }
        set((s) => {
          const next = { ...s.statusMap };
          imageIds.forEach((id, i) => {
            next[id] = results[i];
          });
          return { statusMap: next };
        });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '获取嵌入状态失败' });
      }
    },

    fetchStats: async () => {
      set({ statsLoading: true });
      try {
        const stats = await deps.getEmbeddingStats();
        set({ stats, statsLoading: false });
      } catch (err) {
        set({ statsLoading: false, error: err instanceof Error ? err.message : '获取统计失败' });
      }
    },

    fetchClipStats: async () => {
      try {
        const clipStats = await deps.getClipEmbeddingStats();
        set({ clipStats });
      } catch {
        // Non-critical: image-to-image index stats can lag without blocking UI.
      }
    },

    generate: async (images: ImageRecord[]) => {
      const prevStats = get().stats;
      set({ generating: true });
      try {
        await deps.generateEmbeddings(images);
        await get().fetchStatuses(images.map((img) => img.id));
        await get().fetchStats();
      } catch (err) {
        set({ stats: prevStats, error: err instanceof Error ? err.message : '生成嵌入失败' });
      } finally {
        set({ generating: false });
      }
    },

    fillMissing: async (limit = 10) => {
      set({ filling: true, error: null });
      try {
        for (;;) {
          const result = await deps.embedMissing(limit);
          const stats = await deps.getEmbeddingStats();
          set({
            fillProgress: { processed: result.processed, remaining: result.remaining },
            stats,
          });
          if (result.remaining <= 0) break;
        }
        set({ fillProgress: null });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '补齐嵌入失败' });
      } finally {
        set({ filling: false });
      }
    },

    fillClipMissing: async (limit = 10) => {
      set({ clipFilling: true, error: null });
      try {
        for (;;) {
          const result = await deps.embedClipMissing(limit);
          const clipStats = await deps.getClipEmbeddingStats();
          set({
            clipFillProgress: { processed: result.processed, remaining: result.remaining },
            clipStats,
          });
          if (result.remaining <= 0) break;
        }
        set({ clipFillProgress: null });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '补齐视觉索引失败' });
      } finally {
        set({ clipFilling: false });
      }
    },

    fillAllMissing: async (limit = 10) => {
      await get().fillMissing(limit);
      await get().fillClipMissing(limit);
    },
  });
}

export const useEmbeddingStore = create<EmbeddingStore>()(createEmbeddingStore(defaultDeps));
