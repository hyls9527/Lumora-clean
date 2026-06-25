import { create } from 'zustand';
import type { AnalysisResult, AnalysisHistoryItem } from '../lib/api/ai';
import * as aiApi from '../lib/api/ai';

interface AiAnalysisState {
  /** Currently displayed result per image */
  results: Record<string, AnalysisResult>;
  /** Analysis history per image */
  history: Record<string, AnalysisHistoryItem[]>;
  /** Which image is currently being analyzed */
  analyzingId: string | null;
  /** Accepted tag names per image */
  acceptedTags: Record<string, string[]>;
  /** Rejected tag names per image */
  rejectedTags: Record<string, string[]>;
  /** Error message */
  error: string | null;

  // Actions
  analyze: (imageId: string) => Promise<void>;
  loadResult: (imageId: string) => void;
  loadHistory: (imageId: string) => void;
  acceptTag: (imageId: string, tagName: string) => void;
  rejectTag: (imageId: string, tagName: string) => void;
  clearResult: (imageId: string) => void;
}

export const useAiAnalysisStore = create<AiAnalysisState>((set, get) => ({
  results: {},
  history: {},
  analyzingId: null,
  acceptedTags: {},
  rejectedTags: {},
  error: null,

  analyze: async (imageId: string) => {
    set({ analyzingId: imageId, error: null });
    try {
      const result = await aiApi.analyzeImage(imageId);
      set((s) => ({
        results: { ...s.results, [imageId]: result },
        analyzingId: null,
      }));
      // Also refresh history
      get().loadHistory(imageId);
    } catch (err) {
      set({
        analyzingId: null,
        error: err instanceof Error ? err.message : '分析失败',
      });
    }
  },

  loadResult: (imageId: string) => {
    const result = aiApi.getAnalysisResult(imageId);
    if (result) {
      set((s) => ({ results: { ...s.results, [imageId]: result } }));
    }
  },

  loadHistory: (imageId: string) => {
    const items = aiApi.getAnalysisHistory(imageId);
    set((s) => ({ history: { ...s.history, [imageId]: items } }));
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
}));
