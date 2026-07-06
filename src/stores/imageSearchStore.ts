import { create } from 'zustand';
import { searchByImage, type SemanticSearchResult } from '../lib/api/semantic';

interface ImageSearchState {
  sourceImageId: string | null;
  sourceFilePath: string | null;
  results: SemanticSearchResult[];
  loading: boolean;
  error: string | null;

  search: (imageId: string, filePath: string) => Promise<void>;
  clear: () => void;
  clearSource: () => void;
}

export const useImageSearchStore = create<ImageSearchState>((set) => ({
  sourceImageId: null,
  sourceFilePath: null,
  results: [],
  loading: false,
  error: null,

  search: async (imageId, filePath) => {
    set({ sourceImageId: imageId, sourceFilePath: filePath, loading: true, error: null });
    try {
      const results = await searchByImage(filePath, 20, imageId);
      set({ results, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : '搜索失败', loading: false });
    }
  },

  clear: () => {
    set({ sourceImageId: null, sourceFilePath: null, results: [], error: null });
  },

  clearSource: () => {
    set({ sourceImageId: null, sourceFilePath: null });
  },
}));
