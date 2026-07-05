import { create } from 'zustand';
import * as api from '../lib/api/images';

interface ImageTagsStore {
  imageTags: Record<string, string[]>;
  error: string | null;
  fetchImageTags: (imageId: string) => Promise<void>;
  addTagToImage: (imageId: string, tagId: string) => Promise<void>;
  removeTagFromImage: (imageId: string, tagId: string) => Promise<void>;
}

export const useImageTagsStore = create<ImageTagsStore>((set) => ({
  imageTags: {},
  error: null,

  fetchImageTags: async (imageId: string) => {
    try {
      const tags = await api.getImageTags(imageId);
      set((s) => ({
        imageTags: { ...s.imageTags, [imageId]: tags.map((t) => t.name) },
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '获取标签失败' });
    }
  },

  addTagToImage: async (imageId: string, tagId: string) => {
    try {
      await api.addTagToImage(imageId, tagId);
      const tags = await api.getImageTags(imageId);
      set((s) => ({
        imageTags: { ...s.imageTags, [imageId]: tags.map((t) => t.name) },
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '添加标签失败' });
    }
  },

  removeTagFromImage: async (imageId: string, tagId: string) => {
    try {
      await api.removeTagFromImage(imageId, tagId);
      const tags = await api.getImageTags(imageId);
      set((s) => ({
        imageTags: { ...s.imageTags, [imageId]: tags.map((t) => t.name) },
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '移除标签失败' });
    }
  },
}));
