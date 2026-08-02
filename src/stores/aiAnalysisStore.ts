import { create, type StateCreator } from 'zustand';
import type { AnalysisResult, AnalysisHistoryItem } from '../lib/api/ai';
import * as aiApi from '../lib/api/ai';

/** External dependencies consumed by aiAnalysisStore. */
export interface AiAnalysisStoreDeps {
  analyzeImage: (imageId: string, imagePath?: string, model?: string) => Promise<AnalysisResult>;
  getAnalysisResult: (imageId: string) => Promise<AnalysisResult | null>;
  getAnalysisHistory: (imageId: string) => Promise<AnalysisHistoryItem[]>;
}

const defaultDeps: AiAnalysisStoreDeps = {
  analyzeImage: aiApi.analyzeImage,
  getAnalysisResult: aiApi.getAnalysisResult,
  getAnalysisHistory: aiApi.getAnalysisHistory,
};

interface AiAnalysisState {
  results: Record<string, AnalysisResult>;
  history: Record<string, AnalysisHistoryItem[]>;
  analyzingId: string | null;
  acceptedTags: Record<string, string[]>;
  rejectedTags: Record<string, string[]>;
  error: string | null;

  analyze: (imageId: string) => Promise<void>;
  loadResult: (imageId: string) => void;
  loadHistory: (imageId: string) => void;
  acceptTag: (imageId: string, tagName: string) => void;
  rejectTag: (imageId: string, tagName: string) => void;
  clearResult: (imageId: string) => void;
}

export function createAiAnalysisStore(deps: AiAnalysisStoreDeps = defaultDeps): StateCreator<AiAnalysisState, [], []> {
  return (set, get) => ({
    results: {},
    history: {},
    analyzingId: null,
    acceptedTags: {},
    rejectedTags: {},
    error: null,

    analyze: async (imageId: string) => {
      set({ analyzingId: imageId, error: null });
      try {
        const result = await deps.analyzeImage(imageId);
        set((s) => ({
          results: { ...s.results, [imageId]: result },
          analyzingId: null,
        }));
        get().loadHistory(imageId);
      } catch (err) {
        set({
          analyzingId: null,
          error: err instanceof Error ? err.message : '分析失败',
        });
      }
    },

    loadResult: async (imageId: string) => {
      try {
        const result = await deps.getAnalysisResult(imageId);
        if (result) {
          set((s) => ({ results: { ...s.results, [imageId]: result } }));
        }
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '加载分析结果失败' });
      }
    },

    loadHistory: async (imageId: string) => {
      try {
        const items = await deps.getAnalysisHistory(imageId);
        set((s) => ({ history: { ...s.history, [imageId]: items } }));
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '加载分析历史失败' });
      }
    },

    acceptTag: (imageId: string, tagName: string) => {
      set((s) => {
        const existing = s.acceptedTags[imageId] ?? [];
        if (existing.includes(tagName)) return s;
        return {
          acceptedTags: {
            ...s.acceptedTags,
            [imageId]: [...existing, tagName],
          },
        };
      });
    },

    rejectTag: (imageId: string, tagName: string) => {
      set((s) => {
        const existing = s.rejectedTags[imageId] ?? [];
        if (existing.includes(tagName)) return s;
        return {
          rejectedTags: {
            ...s.rejectedTags,
            [imageId]: [...existing, tagName],
          },
        };
      });
    },

    clearResult: (imageId: string) => {
      set((s) => {
        const results = { ...s.results };
        delete results[imageId];
        return { results };
      });
    },
  });
}

export const useAiAnalysisStore = create<AiAnalysisState>()(createAiAnalysisStore(defaultDeps));
