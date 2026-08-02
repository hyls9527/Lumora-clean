import { create, type StateCreator } from 'zustand';
import * as api from '../lib/api/images';
import type { TagRecord } from '../lib/api/images';

/** External dependencies consumed by imageTagsStore. */
export interface ImageTagsStoreDeps {
  getImageTags: (imageId: string) => Promise<TagRecord[]>;
  addTagToImage: (imageId: string, tagId: string) => Promise<void>;
  removeTagFromImage: (imageId: string, tagId: string) => Promise<void>;
}

const defaultDeps: ImageTagsStoreDeps = {
  getImageTags: api.getImageTags,
  addTagToImage: api.addTagToImage,
  removeTagFromImage: api.removeTagFromImage,
};

interface ImageTagsStore {
  imageTags: Record<string, string[]>;
  error: string | null;
  fetchImageTags: (imageId: string) => Promise<void>;
  addTagToImage: (imageId: string, tagId: string) => Promise<void>;
  removeTagFromImage: (imageId: string, tagId: string) => Promise<void>;
}

export function createImageTagsStore(deps: ImageTagsStoreDeps = defaultDeps): StateCreator<ImageTagsStore, [], []> {
  return (set) => ({
    imageTags: {},
    error: null,

    fetchImageTags: async (imageId: string) => {
      try {
        const tags = await deps.getImageTags(imageId);
        set((s) => ({
          imageTags: { ...s.imageTags, [imageId]: tags.map((t) => t.name) },
        }));
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '获取标签失败' });
      }
    },

    addTagToImage: async (imageId: string, tagId: string) => {
      try {
        await deps.addTagToImage(imageId, tagId);
        const tags = await deps.getImageTags(imageId);
        set((s) => ({
          imageTags: { ...s.imageTags, [imageId]: tags.map((t) => t.name) },
        }));
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '添加标签失败' });
      }
    },

    removeTagFromImage: async (imageId: string, tagId: string) => {
      try {
        await deps.removeTagFromImage(imageId, tagId);
        const tags = await deps.getImageTags(imageId);
        set((s) => ({
          imageTags: { ...s.imageTags, [imageId]: tags.map((t) => t.name) },
        }));
      } catch (err) {
        set({ error: err instanceof Error ? err.message : '移除标签失败' });
      }
    },
  });
}

export const useImageTagsStore = create<ImageTagsStore>()(createImageTagsStore(defaultDeps));
