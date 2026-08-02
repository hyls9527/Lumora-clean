import { create } from 'zustand';
import type { FilterCriteria } from '../types/filter';

interface FilterStore {
  criteria: FilterCriteria;
  setCriteria: (criteria: FilterCriteria) => void;
  updateCriteria: (partial: Partial<FilterCriteria>) => void;
  clearFilters: () => void;
  toggleFavorite: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  criteria: {},

  setCriteria: (criteria) => set({ criteria }),

  updateCriteria: (partial) =>
    set((state) => ({
      criteria: { ...state.criteria, ...partial },
    })),

  clearFilters: () => set({ criteria: {} }),

  toggleFavorite: () =>
    set((state) => ({
      criteria: {
        ...state.criteria,
        favorite: state.criteria.favorite ? undefined : true,
      },
    })),
}));
