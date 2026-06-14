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
  focusedIndex: number
  setFocusedIndex: (i: number) => void
  deleteFocusedImage: () => void
  openFocusedImage: () => void
  getFilteredImages: () => Image[]
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
  focusedIndex: -1,
  setFocusedIndex: (i) => set({ focusedIndex: i }),
  getFilteredImages: () => {
    const s = get()
    if (!s.searchQuery) return s.images
    const q = s.searchQuery.toLowerCase()
    return s.images.filter((img) =>
      img.tags.some((tag) => tag.includes(q)) ||
      img.path.toLowerCase().includes(q) ||
      img.analysis?.generation?.prompt?.toLowerCase().includes(q)
    )
  },
  deleteFocusedImage: () => {
    const s = get()
    const filtered = s.getFilteredImages()
    const img = filtered[s.focusedIndex]
    if (!img) return
    s.deleteImage(img.id)
    const newLen = filtered.length - 1
    if (s.focusedIndex >= newLen && newLen > 0) {
      set({ focusedIndex: newLen - 1 })
    }
  },
  openFocusedImage: () => {
    const s = get()
    const filtered = s.getFilteredImages()
    const img = filtered[s.focusedIndex]
    if (img) set({ detailImage: img })
  },
}))
