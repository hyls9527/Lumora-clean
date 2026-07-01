import { create } from 'zustand';
import { invoke } from '../lib/tauri';

export interface SmartCollectionRule {
  field: 'model' | 'seed' | 'prompt' | 'rating' | 'format' | 'tag';
  op: 'equals' | 'contains' | 'gte' | 'lte' | 'in';
  value: string | number | string[];
}

export interface SmartCollection {
  id: string;
  name: string;
  rules: SmartCollectionRule[];
  logic: 'AND' | 'OR';
}

interface SmartCollectionState {
  collections: SmartCollection[];
  loading: boolean;
  load: () => Promise<void>;
  addCollection: (name: string, rules: SmartCollectionRule[], logic: 'AND' | 'OR') => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  updateCollection: (id: string, updates: Partial<SmartCollection>) => Promise<void>;
}

export const useSmartCollectionStore = create<SmartCollectionState>((set, get) => ({
  collections: [],
  loading: false,

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
    } catch {
      set({ loading: false });
    }
  },

  addCollection: async (name, rules, logic) => {
    const id = crypto.randomUUID();
    const newCollection: SmartCollection = { id, name, rules, logic };
    const updated = [...get().collections, newCollection];
    set({ collections: updated });
    await invoke('set_setting', { key: 'smart_collections', value: JSON.stringify(updated) });
  },

  removeCollection: async (id) => {
    const updated = get().collections.filter((c) => c.id !== id);
    set({ collections: updated });
    await invoke('set_setting', { key: 'smart_collections', value: JSON.stringify(updated) });
  },

  updateCollection: async (id, updates) => {
    const updated = get().collections.map((c) => (c.id === id ? { ...c, ...updates } : c));
    set({ collections: updated });
    await invoke('set_setting', { key: 'smart_collections', value: JSON.stringify(updated) });
  },
}));
