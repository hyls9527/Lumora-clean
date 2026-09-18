import { create, type StateCreator } from 'zustand';
import {
  getEmbeddingStatus,
  getEmbeddingStats,
  getClipEmbeddingStats,
  generateEmbeddings,
  type EmbeddingInfo,
  type EmbeddingStats,
  type ClipEmbeddingStats,
} from '../lib/api/embeddings';
import { startEmbedMissingJob, startEmbedClipMissingJob } from '../lib/api/jobs';

import type { ImageRecord } from '../types/image';

/** External dependencies consumed by embeddingStore. */
export interface EmbeddingStoreDeps {
  getEmbeddingStatus: (imageId: string) => Promise<EmbeddingInfo>;
  getEmbeddingStats: () => Promise<EmbeddingStats>;
  getClipEmbeddingStats: () => Promise<ClipEmbeddingStats>;
  generateEmbeddings: (images: ImageRecord[]) => Promise<void>;
  /**
   * Starts the backend backfill job. The loop itself lives in Rust now (see
   * `src-tauri/src/commands/job_commands.rs`): it keeps running across page
   * changes and can be cancelled, neither of which a store loop could do.
   */
  startEmbedMissingJob: () => Promise<{ id: number; kind: string; isNew: boolean }>;
  startEmbedClipMissingJob: () => Promise<{ id: number; kind: string; isNew: boolean }>;
}

const defaultDeps: EmbeddingStoreDeps = {
  getEmbeddingStatus,
  getEmbeddingStats,
  getClipEmbeddingStats,
  generateEmbeddings,
  startEmbedMissingJob,
  startEmbedClipMissingJob,
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
  /** Start the text-embedding backfill job for whatever is still missing. */
  fillMissing: () => Promise<void>;
  /** Start the CLIP visual-index backfill job. */
  fillClipMissing: () => Promise<void>;
  /** Start both backfills; they run concurrently in the backend. */
  fillAllMissing: () => Promise<void>;
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

    // The backfill used to be a `for(;;)` loop here, which meant the user could
    // not stop it, could not see real progress, and lost the remaining work by
    // navigating. It now runs as a backend job: this method only asks for it.
    fillMissing: async () => {
      set({ filling: true, error: null });
      try {
        await deps.startEmbedMissingJob();
        // The job reports its own progress; keep the fill indicator in sync for
        // as long as it runs so the existing spinner/branch logic still works.
        await get().fetchStats();
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '补齐嵌入失败' });
      } finally {
        set({ filling: false, fillProgress: null });
      }
    },

    fillClipMissing: async () => {
      set({ clipFilling: true, error: null });
      try {
        await deps.startEmbedClipMissingJob();
        await get().fetchClipStats();
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '补齐视觉索引失败' });
      } finally {
        set({ clipFilling: false, clipFillProgress: null });
      }
    },

    fillAllMissing: async () => {
      // Both jobs run concurrently in the backend; awaiting them in sequence here
      // would only serialize the two *start* calls.
      await Promise.all([get().fillMissing(), get().fillClipMissing()]);
    },
  });
}

export const useEmbeddingStore = create<EmbeddingStore>()(createEmbeddingStore(defaultDeps));
