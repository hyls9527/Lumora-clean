import { create } from 'zustand';
import * as api from '../lib/api/images';

export interface ImageRecord {
  id: string;
  filePath: string;
  fileName: string;
  fileSizeKb: number;
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'webp' | 'avif';
  createdAt: string;
  rating: number;        // 0-5
  favorite: boolean;
  model: string;
  prompt: string;
  tags: string[];
  similarity?: number;   // 0-100, used by search
  deleted?: boolean;
  deletedAt?: string;
}

interface FilterState {
  mode: 'creator' | 'normal';
  view: 'grid' | 'list';
  sortBy: 'time' | 'rating' | 'model' | 'size';
  modelFilter: string;
  searchQuery: string;
  searchMode: 'text' | 'image';
  similarityThreshold: number;
}

interface ImageStore {
  images: ImageRecord[];
  filters: FilterState;
  selectedIds: Set<string>;
  loading: boolean;
  error: string | null;
  // Pagination
  page: number;
  total: number;
  perPage: number;
  // Async actions
  fetchImages: (page?: number) => Promise<void>;
  searchImages: (query: string) => Promise<void>;
  importImages: (folderPath: string) => Promise<void>;
  // Sync actions
  setMode: (mode: 'creator' | 'normal') => void;
  setView: (view: 'grid' | 'list') => void;
  setSortBy: (sortBy: 'time' | 'rating' | 'model' | 'size') => void;
  setModelFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  setSearchMode: (mode: 'text' | 'image') => void;
  setSimilarityThreshold: (threshold: number) => void;
  toggleFavorite: (id: string) => void;
  setRating: (id: string, rating: number) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  // Tag actions
  fetchImageTags: (imageId: string) => Promise<void>;
  addTagToImage: (imageId: string, tagId: string) => Promise<void>;
  removeTagFromImage: (imageId: string, tagId: string) => Promise<void>;
  imageTags: Record<string, string[]>;
  // Derived
  getFilteredImages: () => ImageRecord[];
  getSearchResults: () => ImageRecord[];
}

export const useImageStore = create<ImageStore>((set, get) => ({
  images: [],
  imageTags: {},
  filters: {
    mode: 'creator',
    view: 'grid',
    sortBy: 'time',
    modelFilter: 'all',
    searchQuery: '',
    searchMode: 'text',
    similarityThreshold: 70,
  },
  selectedIds: new Set<string>(),
  loading: false,
  error: null,
  page: 1,
  total: 0,
  perPage: 40,
  // ---------------------------------------------------------------------------
  // Async actions
  // ---------------------------------------------------------------------------

  fetchImages: async (page?: number) => {
    const { perPage } = get();
    const p = page ?? get().page;
    set({ loading: true, error: null });
    try {
      const result = await api.listImages(p, perPage);
      set({
        images: result.items,
        total: result.total,
        page: p,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : '加载失败',
      });
    }
  },

  searchImages: async (query: string) => {
    if (!query.trim()) {
      set({ images: [], loading: false, error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const results = await api.searchImages(query);
      set({ images: results, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : '搜索失败',
      });
    }
  },

  importImages: async (folderPath: string) => {
    set({ loading: true, error: null });
    try {
      const imported = await api.importImages(folderPath);
      set((s) => ({
        images: [...imported, ...s.images],
        total: s.total + imported.length,
        loading: false,
      }));
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : '导入失败',
      });
    }
  },

  // ---------------------------------------------------------------------------
  // Sync actions
  // ---------------------------------------------------------------------------

  setMode: (mode) =>
    set((s) => ({ filters: { ...s.filters, mode } })),

  setView: (view) =>
    set((s) => ({ filters: { ...s.filters, view } })),

  setSortBy: (sortBy) =>
    set((s) => ({ filters: { ...s.filters, sortBy } })),

  setModelFilter: (modelFilter) =>
    set((s) => ({ filters: { ...s.filters, modelFilter } })),

  setSearchQuery: (searchQuery) =>
    set((s) => ({ filters: { ...s.filters, searchQuery } })),

  setSearchMode: (searchMode) =>
    set((s) => ({ filters: { ...s.filters, searchMode } })),

  setSimilarityThreshold: (similarityThreshold) =>
    set((s) => ({ filters: { ...s.filters, similarityThreshold } })),

  toggleFavorite: (id) => {
    // 乐观更新
    set((s) => ({
      images: s.images.map((img) =>
        img.id === id ? { ...img, favorite: !img.favorite } : img,
      ),
    }));
    api.toggleFavorite(id).catch(() => {
      // 回滚
      set((s) => ({
        images: s.images.map((img) =>
          img.id === id ? { ...img, favorite: !img.favorite } : img,
        ),
      }));
    });
  },

  setRating: (id, rating) => {
    const prev = get().images.find((img) => img.id === id)?.rating;
    set((s) => ({
      images: s.images.map((img) =>
        img.id === id ? { ...img, rating } : img,
      ),
    }));
    api.updateRating(id, rating).catch(() => {
      if (prev !== undefined) {
        set((s) => ({
          images: s.images.map((img) =>
            img.id === id ? { ...img, rating: prev } : img,
          ),
        }));
      }
    });
  },

  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  selectAll: () =>
    set((s) => ({
      selectedIds: new Set(s.images.map((img) => img.id)),
    })),

  clearSelection: () => set({ selectedIds: new Set() }),

  fetchImageTags: async (imageId: string) => {
    try {
      const tags = await api.getImageTags(imageId);
      set((s) => ({
        imageTags: { ...s.imageTags, [imageId]: tags.map((t) => t.name) },
      }));
    } catch {
      // silent
    }
  },

  addTagToImage: async (imageId: string, tagId: string) => {
    try {
      await api.addTagToImage(imageId, tagId);
      // refresh image tags
      const tags = await api.getImageTags(imageId);
      set((s) => ({
        imageTags: { ...s.imageTags, [imageId]: tags.map((t) => t.name) },
      }));
    } catch {
      // silent
    }
  },

  removeTagFromImage: async (imageId: string, tagId: string) => {
    try {
      await api.removeTagFromImage(imageId, tagId);
      const tags = await api.getImageTags(imageId);
      set((s) => ({
        imageTags: { ...s.imageTags, [imageId]: tags.map((t) => t.name) },
      }));
    } catch {
      // silent
    }
  },

  getFilteredImages: () => {
    const { images, filters } = get();
    let result = [...images];

    if (filters.modelFilter !== 'all') {
      result = result.filter(
        (img) => img.model.toLowerCase() === filters.modelFilter.toLowerCase(),
      );
    }

    switch (filters.sortBy) {
      case 'time':
        result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'model':
        result.sort((a, b) => a.model.localeCompare(b.model));
        break;
      case 'size':
        result.sort((a, b) => b.fileSizeKb - a.fileSizeKb);
        break;
    }

    return result;
  },

  getSearchResults: () => {
    const { images, filters } = get();
    if (!filters.searchQuery.trim()) return [];
    return images
      .filter((img) =>
        img.prompt.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        img.tags.some((t) => t.toLowerCase().includes(filters.searchQuery.toLowerCase())),
      )
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  },
}));
