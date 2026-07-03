import { create } from 'zustand';
import {
  getEmbeddingStatus,
  getEmbeddingStats,
  generateEmbeddings,
  type EmbeddingInfo,
  type EmbeddingStats,
} from '../lib/api/embeddings';
import type { ImageRecord } from './imageStore';

interface EmbeddingStore {
  /** Per-image embedding info, keyed by imageId */
  statusMap: Record<string, EmbeddingInfo>;
  /** Global stats */
  stats: EmbeddingStats | null;
  statsLoading: boolean;
  /** Generating flag */
  generating: boolean;
  /** Error message */
  error: string | null;
  // Actions
  fetchStatus: (imageId: string) => Promise<void>;
  fetchStatuses: (imageIds: string[]) => Promise<void>;
  fetchStats: () => Promise<void>;
  generate: (images: ImageRecord[]) => Promise<void>;
}

export const useEmbeddingStore = create<EmbeddingStore>((set, get) => ({
  statusMap: {},
  stats: null,
  statsLoading: false,
  generating: false,
  error: null,

  fetchStatus: async (imageId: string) => {
    try {
      const info = await getEmbeddingStatus(imageId);
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
        const batchResults = await Promise.all(batch.map(getEmbeddingStatus));
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
      const stats = await getEmbeddingStats();
      set({ stats, statsLoading: false });
    } catch (err) {
      set({ statsLoading: false, error: err instanceof Error ? err.message : '获取统计失败' });
    }
  },

  generate: async (images: ImageRecord[]) => {
    const prevStats = get().stats;
    set({ generating: true });
    try {
      await generateEmbeddings(images);
      // Refresh statuses for generated images
      await get().fetchStatuses(images.map((img) => img.id));
      // Refresh global stats
      await get().fetchStats();
    } catch (err) {
      // restore stats on error
      set({ stats: prevStats, error: err instanceof Error ? err.message : '生成嵌入失败' });
    } finally {
      set({ generating: false });
    }
  },
}));
