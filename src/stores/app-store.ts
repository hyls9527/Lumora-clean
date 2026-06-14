import { create } from "zustand"
import { type Image, generateMockImages } from "../lib/mock-data"

type View = "gallery" | "curation" | "dashboard" | "trash" | "settings"

interface AppState {
  images: Image[]
  view: View
  setView: (v: View) => void
  selectedIds: Set<string>
  toggleSelect: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  toggleFavorite: (id: string) => void
  setRating: (id: string, r: number) => void
  deleteImage: (id: string) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  sortBy: "date" | "rating" | "size"
  setSortBy: (s: "date" | "rating" | "size") => void
  detailImage: Image | null
  setDetailImage: (img: Image | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  images: generateMockImages(200),
  view: "gallery",
  setView: (v) => set({ view: v }),
  selectedIds: new Set(),
  toggleSelect: (id) => set((s) => { const n = new Set(s.selectedIds); n.has(id) ? n.delete(id) : n.add(id); return { selectedIds: n } }),
  selectAll: () => set((s) => ({ selectedIds: new Set(s.images.map((i) => i.id)) })),
  clearSelection: () => set({ selectedIds: new Set() }),
  toggleFavorite: (id) => set((s) => ({ images: s.images.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)) })),
  setRating: (id, r) => set((s) => ({ images: s.images.map((i) => (i.id === id ? { ...i, rating: r } : i)) })),
  deleteImage: (id) => set((s) => ({ images: s.images.filter((i) => i.id !== id), selectedIds: (() => { const n = new Set(s.selectedIds); n.delete(id); return n })() })),
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
  sortBy: "date",
  setSortBy: (s) => set({ sortBy: s }),
  detailImage: null,
  setDetailImage: (img) => set({ detailImage: img }),
}))
