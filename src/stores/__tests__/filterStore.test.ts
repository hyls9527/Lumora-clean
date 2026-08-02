import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from '../filterStore';

beforeEach(() => {
  useFilterStore.setState({ criteria: {} });
});

describe('filterStore', () => {
  it('has empty initial criteria', () => {
    expect(useFilterStore.getState().criteria).toEqual({});
  });

  it('setCriteria replaces all criteria', () => {
    useFilterStore.getState().setCriteria({ model: 'sd1.5', favorite: true });
    expect(useFilterStore.getState().criteria).toEqual({ model: 'sd1.5', favorite: true });
  });

  it('updateCriteria merges partial criteria', () => {
    useFilterStore.getState().setCriteria({ model: 'sd1.5' });
    useFilterStore.getState().updateCriteria({ favorite: true });
    expect(useFilterStore.getState().criteria).toEqual({ model: 'sd1.5', favorite: true });
  });

  it('updateCriteria overwrites existing fields', () => {
    useFilterStore.getState().setCriteria({ model: 'sd1.5' });
    useFilterStore.getState().updateCriteria({ model: 'flux' });
    expect(useFilterStore.getState().criteria.model).toBe('flux');
  });

  it('clearFilters resets to empty', () => {
    useFilterStore.getState().setCriteria({ model: 'sd1.5', favorite: true, ratingMin: 3 });
    useFilterStore.getState().clearFilters();
    expect(useFilterStore.getState().criteria).toEqual({});
  });

  it('toggleFavorite sets favorite to true when not set', () => {
    useFilterStore.getState().toggleFavorite();
    expect(useFilterStore.getState().criteria.favorite).toBe(true);
  });

  it('toggleFavorite removes favorite when already true', () => {
    useFilterStore.getState().setCriteria({ favorite: true });
    useFilterStore.getState().toggleFavorite();
    expect(useFilterStore.getState().criteria.favorite).toBeUndefined();
  });

  it('toggleFavorite preserves other criteria', () => {
    useFilterStore.getState().setCriteria({ model: 'sd1.5' });
    useFilterStore.getState().toggleFavorite();
    expect(useFilterStore.getState().criteria.model).toBe('sd1.5');
    expect(useFilterStore.getState().criteria.favorite).toBe(true);
  });
});
