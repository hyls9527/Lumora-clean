import { create } from 'zustand';
import {
  getSearchSuggestions,
  type SemanticSearchResult,
} from '../lib/api/semantic';
import { searchSemanticCached, invalidateSemanticCache } from '../lib/api/semanticCache';

export type SearchMode = 'exact' | 'semantic';

interface SemanticSearchState {
  query: string;
  mode: SearchMode;
  results: SemanticSearchResult[];
  suggestions: string[];
  loading: boolean;
  suggestionsLoading: boolean;
  error: string | null;
  showSuggestions: boolean;

  // Actions
  setQuery: (query: string) => void;
  setMode: (mode: SearchMode) => void;
  search: (query?: string) => Promise<void>;
  fetchSuggestions: (query: string) => Promise<void>;
  clearSuggestions: () => void;
  setShowSuggestions: (show: boolean) => void;
  reset: () => void;
  invalidateCache: () => void;
}

export const useSemanticSearchStore = create<SemanticSearchState>((set, get) => ({
  query: '',
  mode: 'semantic',
  results: [],
  suggestions: [],
  loading: false,
  suggestionsLoading: false,
  error: null,
  showSuggestions: false,

  setQuery: (query) => set({ query }),

  setMode: (mode) => set({ mode }),

  search: async (queryOverride?: string) => {
    const query = queryOverride ?? get().query;
    if (!query.trim()) {
      set({ results: [], error: null });
      return;
    }
    set({ loading: true, error: null, showSuggestions: false });
    try {
      const results = await searchSemanticCached(query);
      set({ results, loading: false });
    } catch (err) {
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
    set({ suggestionsLoading: true });
    try {
      const suggestions = await getSearchSuggestions(query);
      set({ suggestions, suggestionsLoading: false, showSuggestions: suggestions.length > 0 });
    } catch {
      set({ suggestionsLoading: false });
    }
  },

  clearSuggestions: () => set({ suggestions: [], showSuggestions: false }),

  setShowSuggestions: (show) => set({ showSuggestions: show }),

  reset: () => {
    invalidateSemanticCache();
    set({
      query: '',
      results: [],
      suggestions: [],
      loading: false,
      suggestionsLoading: false,
      error: null,
      showSuggestions: false,
    });
  },

  invalidateCache: () => invalidateSemanticCache(),
}));
