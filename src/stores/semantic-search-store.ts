import { create } from "zustand"
import {
  searchSemantic,
  getSearchSuggestions,
} from "@/lib/api/search"

interface SemanticSearchState {
  query: string
  searchMode: 'exact' | 'semantic'
  results: Array<{ imageId: string; score: number }>
  suggestions: string[]
  tryDescribing: string[]
  isSearching: boolean
  isLoadingSuggestions: boolean
  error: string | null

  // Getters
  getScore: (imageId: string) => number | null
  hasResults: () => boolean

  // Actions
  setQuery: (q: string) => void
  setSearchMode: (mode: 'exact' | 'semantic') => void
  search: (query: string) => Promise<void>
  loadSuggestions: (query: string) => Promise<void>
  clearSearch: () => void
}

export const useSemanticSearchStore = create<SemanticSearchState>((set, get) => ({
  query: "",
  searchMode: "exact",
  results: [],
  suggestions: [],
  tryDescribing: [],
  isSearching: false,
  isLoadingSuggestions: false,
  error: null,

  getScore: (imageId) => {
    const result = get().results.find((r) => r.imageId === imageId)
    return result ? result.score : null
  },

  hasResults: () => {
    return get().results.length > 0
  },

  setQuery: (q) => {
    set({ query: q })
  },

  setSearchMode: (mode) => {
    set({ searchMode: mode, results: [], error: null })
  },

  search: async (query) => {
    if (!query) {
      set({ results: [], isSearching: false })
      return
    }

    set({ isSearching: true, error: null })

    try {
      const data = await searchSemantic(query)
      set({ results: data, isSearching: false })
    } catch (err) {
      console.error("search failed:", err)
      set({ error: String(err), isSearching: false, results: [] })
    }
  },

  loadSuggestions: async (query) => {
    if (!query || query.length < 2) {
      set({ suggestions: [], tryDescribing: [], isLoadingSuggestions: false })
      return
    }

    set({ isLoadingSuggestions: true })

    try {
      const data = await getSearchSuggestions(query)
      set({
        suggestions: data.suggestions,
        tryDescribing: data.tryDescribing,
        isLoadingSuggestions: false,
      })
    } catch (err) {
      console.error("loadSuggestions failed:", err)
      set({ isLoadingSuggestions: false })
    }
  },

  clearSearch: () => {
    set({
      query: "",
      results: [],
      suggestions: [],
      tryDescribing: [],
      error: null,
      isSearching: false,
    })
  },
}))
