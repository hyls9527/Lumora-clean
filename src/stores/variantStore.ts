import { create, type StateCreator } from 'zustand';
import { getVariantGroupImages } from '../lib/api/images';
import type { ImageRecord } from '../types/image';

/** External dependencies consumed by variantStore. */
export interface VariantStoreDeps {
  getVariantGroupImages: (groupId: string) => Promise<ImageRecord[]>;
}

const defaultDeps: VariantStoreDeps = {
  getVariantGroupImages,
};

interface VariantStore {
  variants: ImageRecord[];
  loading: boolean;
  error: string | null;
  currentGroupId: string | null;
  fetchVariants: (groupId: string) => Promise<void>;
  clearVariants: () => void;
}

export function createVariantStore(deps: VariantStoreDeps = defaultDeps): StateCreator<VariantStore, [], []> {
  return (set) => ({
    variants: [],
    loading: false,
    error: null,
    currentGroupId: null,

    fetchVariants: async (groupId: string) => {
      set({ loading: true, error: null });
      try {
        const variants = await deps.getVariantGroupImages(groupId);
        set({ variants, loading: false, currentGroupId: groupId });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : 'Unknown error',
          loading: false,
        });
      }
    },

    clearVariants: () => {
      set({ variants: [], currentGroupId: null, error: null });
    },
  });
}

export const useVariantStore = create<VariantStore>()(createVariantStore(defaultDeps));
