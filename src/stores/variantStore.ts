import { create } from 'zustand';
import { getVariantGroupImages } from '../lib/api/images';
import type { ImageRecord } from '../types/image';

interface VariantStore {
  variants: ImageRecord[];
  loading: boolean;
  error: string | null;
  currentGroupId: string | null;
  fetchVariants: (groupId: string) => Promise<void>;
  clearVariants: () => void;
}

export const useVariantStore = create<VariantStore>((set) => ({
  variants: [],
  loading: false,
  error: null,
  currentGroupId: null,

  fetchVariants: async (groupId: string) => {
    set({ loading: true, error: null });
    try {
      const variants = await getVariantGroupImages(groupId);
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
}));
