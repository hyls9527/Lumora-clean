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
  /** Request token: bumped per fetch; stale responses are dropped (F-16). */
  _seq: number;
  fetchVariants: (groupId: string) => Promise<void>;
  clearVariants: () => void;
}

export function createVariantStore(deps: VariantStoreDeps = defaultDeps): StateCreator<VariantStore, [], []> {
  return (set, get) => ({
    variants: [],
    loading: false,
    error: null,
    currentGroupId: null,
    _seq: 0,

    fetchVariants: async (groupId: string) => {
      const seq = get()._seq + 1;
      set({ _seq: seq, loading: true, error: null });
      try {
        const variants = await deps.getVariantGroupImages(groupId);
        // A newer group's request superseded this one — drop the stale
        // response so a slow group A cannot overwrite group B (F-16).
        if (get()._seq !== seq) return;
        set({ variants, loading: false, currentGroupId: groupId });
      } catch (err) {
        if (get()._seq !== seq) return;
        set({
          error: err instanceof Error ? err.message : 'Unknown error',
          loading: false,
        });
      }
    },

    clearVariants: () => {
      set({ variants: [], currentGroupId: null, error: null, _seq: get()._seq + 1 });
    },
  });
}

export const useVariantStore = create<VariantStore>()(createVariantStore(defaultDeps));
