import { create, type StateCreator } from 'zustand';
import {
  getSearchSuggestions,
  type SemanticSearchResult,
} from '../lib/api/semantic';
import { searchSemanticCached, invalidateSemanticCache } from '../lib/api/semanticCache';

export type SearchMode = 'exact' | 'semantic';

/** External dependencies consumed by semanticSearchStore. */
export interface SemanticSearchStoreDeps {
  searchSemanticCached: (query: string) => Promise<SemanticSearchResult[]>;
  getSearchSuggestions: (query: string) => Promise<string[]>;
  invalidateSemanticCache: () => void;
}

const defaultDeps: SemanticSearchStoreDeps = {
  searchSemanticCached,
  getSearchSuggestions,
  invalidateSemanticCache,
};

interface SemanticSearchState {
  query: string;
  mode: SearchMode;
  results: SemanticSearchResult[];
  suggestions: string[];
  loading: boolean;
  suggestionsLoading: boolean;
  error: string | null;
  showSuggestions: boolean;
  /** Request tokens: bumped per search/suggestion; stale responses dropped (F-6). */
  _searchSeq: number;
  _suggestSeq: number;

  setQuery: (query: string) => void;
  setMode: (mode: SearchMode) => void;
  search: (query?: string) => Promise<void>;
  fetchSuggestions: (query: string) => Promise<void>;
  clearSuggestions: () => void;
  setShowSuggestions: (show: boolean) => void;
  reset: () => void;
  invalidateCache: () => void;
}

export function createSemanticSearchStore(deps: SemanticSearchStoreDeps = defaultDeps): StateCreator<SemanticSearchState, [], []> {
  return (set, get) => ({
    query: '',
    mode: 'semantic',
    results: [],
    suggestions: [],
    loading: false,
    suggestionsLoading: false,
    error: null,
    showSuggestions: false,
    _searchSeq: 0,
    _suggestSeq: 0,

    setQuery: (query) => set({ query }),

    setMode: (mode) => set({ mode }),

    search: async (queryOverride?: string) => {
      const query = queryOverride ?? get().query;
      if (!query.trim()) {
        set({ results: [], error: null });
        return;
      }
      const seq = get()._searchSeq + 1;
      set({ _searchSeq: seq, loading: true, error: null, showSuggestions: false });
      try {
        const results = await deps.searchSemanticCached(query);
        // A newer query superseded this one — drop the stale response (F-6).
        if (get()._searchSeq !== seq) return;
        set({ results, loading: false });
      } catch (err) {
        if (get()._searchSeq !== seq) return;
        set({
          loading: false,
          error: err instanceof Error ? err.message : '搜索失败',
        });
      }
    },

    fetchSuggestions: async (query) => {
      if (!query.trim()) {
        set({ suggestions: [], suggestionsLoading: false });
        return;
      }
      const seq = get()._suggestSeq + 1;
      set({ _suggestSeq: seq, suggestionsLoading: true });
      try {
        const suggestions = await deps.getSearchSuggestions(query);
        // Drop stale suggestion responses so a slow old query cannot
        // overwrite what the user's current input produced (F-6).
        if (get()._suggestSeq !== seq) return;
        set({ suggestions, suggestionsLoading: false, showSuggestions: suggestions.length > 0 });
      } catch (err) {
        if (get()._suggestSeq !== seq) return;
        set({ suggestionsLoading: false, error: err instanceof Error ? err.message : '获取建议失败' });
      }
    },

    clearSuggestions: () => set({ suggestions: [], showSuggestions: false }),

    setShowSuggestions: (show) => set({ showSuggestions: show }),

    reset: () => {
      deps.invalidateSemanticCache();
      set({
        query: '',
        results: [],
        suggestions: [],
        loading: false,
        suggestionsLoading: false,
        error: null,
        showSuggestions: false,
        _searchSeq: get()._searchSeq + 1,
        _suggestSeq: get()._suggestSeq + 1,
      });
    },

    invalidateCache: () => deps.invalidateSemanticCache(),
  });
}

export const useSemanticSearchStore = create<SemanticSearchState>()(createSemanticSearchStore(defaultDeps));
