import { useMemo } from 'react';
import { create, type StateCreator } from 'zustand';
import * as api from '../lib/api/images';

import type { ExportResult } from '../lib/api/images';
import type { ImageRecord } from '../types/image';

export type { ImageRecord } from '../types/image';

/** External dependencies consumed by imageStore. */
export interface ImageStoreDeps {
  listImages: (page: number, perPage: number) => Promise<{ items: ImageRecord[]; total: number }>;
  searchImagesAdvanced: (query: string, field?: string) => Promise<ImageRecord[]>;
  importImages: (folderPath: string) => Promise<api.ImportResult>;
  exportImages: (ids: string[], destDir: string, format: string, renameTemplate?: string) => Promise<ExportResult>;
}

const defaultDeps: ImageStoreDeps = {
  listImages: api.listImages,
  searchImagesAdvanced: api.searchImagesAdvanced,
  importImages: api.importImages,
  exportImages: api.exportImages,
};

interface FilterState {
  mode: 'creator' | 'normal';
  view: 'grid' | 'list';
  sortBy: 'time' | 'rating' | 'model' | 'size';
  modelFilter: string;
  searchQuery: string;
  searchField: string;
  searchMode: 'text' | 'image';
  similarityThreshold: number;
}

export interface ImageStore {
  images: ImageRecord[];
  filters: FilterState;
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  perPage: number;
  fetchImages: (page?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  searchImages: (query: string) => Promise<void>;
  importImages: (folderPath: string) => Promise<api.ImportResult>;
  exportImages: (ids: string[], destDir: string, format: string, renameTemplate?: string) => Promise<ExportResult>;
  setMode: (mode: 'creator' | 'normal') => void;
  setView: (view: 'grid' | 'list') => void;
  setSortBy: (sortBy: 'time' | 'rating' | 'model' | 'size') => void;
  setModelFilter: (filter: string) => void;
  setSearchQuery: (query: string) => void;
  setSearchField: (field: string) => void;
  setSearchMode: (mode: 'text' | 'image') => void;
  setSimilarityThreshold: (threshold: number) => void;
  updateImage: (id: string, updater: (img: ImageRecord) => ImageRecord) => void;
  getFilteredImages: () => ImageRecord[];
  getSearchResults: () => ImageRecord[];
}

export function createImageStore(deps: ImageStoreDeps = defaultDeps): StateCreator<ImageStore, [], []> {
  return (set, get) => ({
    images: [],
    filters: {
      mode: 'creator',
      view: 'grid',
      sortBy: 'time',
      modelFilter: 'all',
      searchQuery: '',
      searchField: 'all',
      searchMode: 'text',
      similarityThreshold: 70,
    },
    loading: false,
    error: null,
    page: 1,
    total: 0,
    perPage: 40,

    fetchImages: async (page?: number) => {
      const { perPage } = get();
      const p = page ?? get().page;
      set({ loading: true, error: null });
      try {
        const result = await deps.listImages(p, perPage);
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

    loadMore: async () => {
      const { page, perPage, images, total, loading } = get();
      if (loading) return;
      if (images.length >= total) return;

      const nextPage = page + 1;
      set({ loading: true });
      try {
        const result = await deps.listImages(nextPage, perPage);
        set({
          images: [...images, ...result.items],
          total: result.total,
          page: nextPage,
          loading: false,
        });
      } catch (err) {
        set({
          loading: false,
          error: err instanceof Error ? err.message : '加载更多失败',
        });
      }
    },

    searchImages: async (query: string) => {
      if (!query.trim()) {
        set({ images: [], loading: false, error: null });
        return;
      }
      const { filters } = get();
      set({ loading: true, error: null });
      try {
        const results = await deps.searchImagesAdvanced(query, filters.searchField);
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
        const result = await deps.importImages(folderPath);
        set((s) => {
          const existingIds = new Set(s.images.map((img) => img.id));
          const newItems = result.items.filter((item) => !existingIds.has(item.id));
          return {
            images: [...newItems, ...s.images],
            total: s.total + newItems.length,
            loading: false,
          };
        });
        return result;
      } catch (err) {
        set({
          loading: false,
          error: err instanceof Error ? err.message : '导入失败',
        });
        throw err;
      }
    },

    exportImages: async (
      ids: string[],
      destDir: string,
      format: string,
      renameTemplate?: string,
    ) => {
      try {
        return await deps.exportImages(ids, destDir, format, renameTemplate);
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '导出失败' });
        throw err;
      }
    },

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

    setSearchField: (searchField) =>
      set((s) => ({ filters: { ...s.filters, searchField } })),

    setSearchMode: (searchMode) =>
      set((s) => ({ filters: { ...s.filters, searchMode } })),

    setSimilarityThreshold: (similarityThreshold) =>
      set((s) => ({ filters: { ...s.filters, similarityThreshold } })),

    updateImage: (id, updater) =>
      set((s) => ({
        images: s.images.map((img) => (img.id === id ? updater(img) : img)),
      })),

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
  });
}

/** Pre-wired store with default (real) API dependencies. */
export const useImageStore = create<ImageStore>()(createImageStore(defaultDeps));

// ---------------------------------------------------------------------------
// Memoized selector hooks
// ---------------------------------------------------------------------------

export function useFilteredImages(): ImageRecord[] {
  const images = useImageStore((s) => s.images);
  const modelFilter = useImageStore((s) => s.filters.modelFilter);
  const sortBy = useImageStore((s) => s.filters.sortBy);

  return useMemo(() => {
    let result = [...images];

    if (modelFilter !== 'all') {
      result = result.filter(
        (img) => img.model.toLowerCase() === modelFilter.toLowerCase(),
      );
    }

    switch (sortBy) {
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
  }, [images, modelFilter, sortBy]);
}

export function useSearchResults(): ImageRecord[] {
  const images = useImageStore((s) => s.images);
  const searchQuery = useImageStore((s) => s.filters.searchQuery);

  return useMemo(() => {
    if (!searchQuery.trim()) return [];

    return images
      .filter((img) =>
        img.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        img.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
      )
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  }, [images, searchQuery]);
}
