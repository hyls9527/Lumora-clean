import { create } from 'zustand';
import { invoke } from '../lib/tauri';

// ponytail: SmartCollectionRule + CRUD methods removed — no UI calls them.
// Add back when a collection editor UI exists.
export interface SmartCollection {
  id: string;
  name: string;
  // rules + logic omitted until UI exists
}

interface SmartCollectionState {
  collections: SmartCollection[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
}

export const useSmartCollectionStore = create<SmartCollectionState>((set) => ({
  collections: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true });
    try {
      const raw = await invoke<string | null>('get_setting', { key: 'smart_collections' });
      if (raw) {
        const parsed = JSON.parse(raw) as SmartCollection[];
        set({ collections: parsed, loading: false });
      } else {
        set({ collections: [], loading: false });
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '加载智能集合失败' });
    }
  },
}));
