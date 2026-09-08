import { create, type StateCreator } from 'zustand';
import { searchByImage, type SemanticSearchResult } from '../lib/api/semantic';

/** External dependencies consumed by imageSearchStore. */
export interface ImageSearchStoreDeps {
  searchByImage: (filePath: string, limit?: number, excludeId?: string) => Promise<SemanticSearchResult[]>;
}

const defaultDeps: ImageSearchStoreDeps = {
  searchByImage,
};

interface ImageSearchState {
  sourceImageId: string | null;
  sourceFilePath: string | null;
  results: SemanticSearchResult[];
  loading: boolean;
  error: string | null;
  /** Request token: bumped per search; stale responses are dropped (F-5). */
  _reqSeq: number;

  search: (imageId: string, filePath: string) => Promise<void>;
  clear: () => void;
  clearSource: () => void;
}

export function createImageSearchStore(deps: ImageSearchStoreDeps = defaultDeps): StateCreator<ImageSearchState, [], []> {
  return (set, get) => ({
    sourceImageId: null,
    sourceFilePath: null,
    results: [],
    loading: false,
    error: null,
    _reqSeq: 0,

    search: async (imageId, filePath) => {
      const seq = get()._reqSeq + 1;
      set({ _reqSeq: seq, sourceImageId: imageId, sourceFilePath: filePath, loading: true, error: null });
      try {
        const results = await deps.searchByImage(filePath, 20, imageId);
        // A newer search superseded this one — drop the stale response
        // instead of overwriting the fresher results (F-5).
        if (get()._reqSeq !== seq) return;
        set({ results, loading: false });
      } catch (e) {
        if (get()._reqSeq !== seq) return;
        set({ error: e instanceof Error ? e.message : '搜索失败', loading: false });
      }
    },

    clear: () => {
      set({ sourceImageId: null, sourceFilePath: null, results: [], error: null, _reqSeq: get()._reqSeq + 1 });
    },

    clearSource: () => {
      set({ sourceImageId: null, sourceFilePath: null });
    },
  });
}

export const useImageSearchStore = create<ImageSearchState>()(createImageSearchStore(defaultDeps));
