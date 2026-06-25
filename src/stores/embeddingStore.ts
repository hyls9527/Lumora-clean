import { create } from 'zustand';
import {
  getEmbeddingStatus,
  getEmbeddingStats,
  generateEmbeddings,
  type EmbeddingInfo,
  type EmbeddingStats,
} from '../lib/api/embeddings';

interface EmbeddingStore {
  /** Per-image embedding info, keyed by imageId */
  statusMap: Record<string, EmbeddingInfo>;
  /** Global stats */
  stats: EmbeddingStats | null;
  statsLoading: boolean;
  /** Generating flag */
  generating: boolean;
  // Actions
  fetchStatus: (imageId: string) => Promise<void>;
  fetchStatuses: (imageIds: string[]) => Promise<void>;
  fetchStats: () => Promise<void>;
  generate: (imageIds: string[]) => Promise<void>;
}

export const useEmbeddingStore = create<EmbeddingStore>((set, get) => ({
  statusMap: {},
  stats: null,
  statsLoading: false,
  generating: false,

  fetchStatus: async (imageId: string) => {
    const info = await getEmbeddingStatus(imageId);
    set((s) => ({ statusMap: { ...s.statusMap, [imageId]: info } }));
  },

  fetchStatuses: async (imageIds: string[]) => {
    if (imageIds.length === 0) return;
    const results = await Promise.all(imageIds.map(getEmbeddingStatus));
    set((s) => {
      const next = { ...s.statusMap };
      imageIds.forEach((id, i) => {
        next[id] = results[i];
      });
      return { statusMap: next };
    });
  },

  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const stats = await getEmbeddingStats();
      set({ stats, statsLoading: false });
    } catch {
      set({ statsLoading: false });
    }
  },

  generate: async (imageIds: string[]) => {
    const prevStats = get().stats;
    set({ generating: true });
    try {
      await generateEmbeddings(imageIds);
      // Refresh statuses for generated images
      await get().fetchStatuses(imageIds);
      // Refresh global stats
      await get().fetchStats();
    } catch {
      // restore stats on error
      set({ stats: prevStats });
    } finally {
      set({ generating: false });
    }
  },
}));
