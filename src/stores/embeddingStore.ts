import { create, type StateCreator } from 'zustand';
import {
  getEmbeddingStatus,
  getEmbeddingStats,
  generateEmbeddings,
  type EmbeddingInfo,
  type EmbeddingStats,
} from '../lib/api/embeddings';

import type { ImageRecord } from '../types/image';

/** External dependencies consumed by embeddingStore. */
export interface EmbeddingStoreDeps {
  getEmbeddingStatus: (imageId: string) => Promise<EmbeddingInfo>;
  getEmbeddingStats: () => Promise<EmbeddingStats>;
  generateEmbeddings: (images: ImageRecord[]) => Promise<void>;
}

const defaultDeps: EmbeddingStoreDeps = {
  getEmbeddingStatus,
  getEmbeddingStats,
  generateEmbeddings,
};

interface EmbeddingStore {
  statusMap: Record<string, EmbeddingInfo>;
  stats: EmbeddingStats | null;
  statsLoading: boolean;
  generating: boolean;
  error: string | null;
  fetchStatus: (imageId: string) => Promise<void>;
  fetchStatuses: (imageIds: string[]) => Promise<void>;
  fetchStats: () => Promise<void>;
  generate: (images: ImageRecord[]) => Promise<void>;
}

export function createEmbeddingStore(deps: EmbeddingStoreDeps = defaultDeps): StateCreator<EmbeddingStore, [], []> {
  return (set, get) => ({
    statusMap: {},
    stats: null,
    statsLoading: false,
    generating: false,
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
  });
}

export const useEmbeddingStore = create<EmbeddingStore>()(createEmbeddingStore(defaultDeps));
