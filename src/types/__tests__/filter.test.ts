import { describe, it, expect } from 'vitest';
import { hasActiveFilters, countActiveFilters, type FilterCriteria } from '../filter';

describe('FilterCriteria helpers', () => {
  describe('hasActiveFilters', () => {
    it('returns false for empty criteria', () => {
      expect(hasActiveFilters({})).toBe(false);
    });

    it('returns true when model is set', () => {
      expect(hasActiveFilters({ model: 'sd1.5' })).toBe(true);
    });

    it('returns true when rating range is set', () => {
      expect(hasActiveFilters({ ratingMin: 3 })).toBe(true);
      expect(hasActiveFilters({ ratingMax: 5 })).toBe(true);
    });

    it('returns true when favorite is set', () => {
      expect(hasActiveFilters({ favorite: true })).toBe(true);
    });

    it('treats favorite=false as inactive (backend ignores it)', () => {
      expect(hasActiveFilters({ favorite: false })).toBe(false);
    });

    it('returns true when format is set', () => {
      expect(hasActiveFilters({ format: 'png' })).toBe(true);
    });

    it('returns true when date range is set', () => {
      expect(hasActiveFilters({ dateFrom: '2025-01-01' })).toBe(true);
      expect(hasActiveFilters({ dateTo: '2025-12-31' })).toBe(true);
    });

    it('returns true when generation parameters are set', () => {
      expect(hasActiveFilters({ seed: 1 })).toBe(true);
      expect(hasActiveFilters({ steps: 30 })).toBe(true);
      expect(hasActiveFilters({ cfgMin: 7 })).toBe(true);
      expect(hasActiveFilters({ cfgMax: 9 })).toBe(true);
      expect(hasActiveFilters({ sampler: 'Euler a' })).toBe(true);
    });
  });

  describe('countActiveFilters', () => {
    it('returns 0 for empty criteria', () => {
      expect(countActiveFilters({})).toBe(0);
    });

    it('counts model as 1', () => {
      expect(countActiveFilters({ model: 'sd1.5' })).toBe(1);
    });

    it('counts rating range as 1 (not 2)', () => {
      expect(countActiveFilters({ ratingMin: 3, ratingMax: 5 })).toBe(1);
    });

    it('counts multiple independent filters', () => {
      const criteria: FilterCriteria = {
        model: 'sd1.5',
        ratingMin: 3,
        favorite: true,
        format: 'png',
        dateFrom: '2025-01-01',
      };
      expect(countActiveFilters(criteria)).toBe(5);
    });

    it('counts cfg range as 1 (not 2)', () => {
      expect(countActiveFilters({ cfgMin: 7, cfgMax: 9 })).toBe(1);
    });

    it('counts each generation parameter as 1', () => {
      expect(countActiveFilters({ seed: 1 })).toBe(1);
      expect(countActiveFilters({ steps: 30 })).toBe(1);
      expect(countActiveFilters({ sampler: 'Euler a' })).toBe(1);
    });

    it('does not count favorite=false', () => {
      expect(countActiveFilters({ favorite: false })).toBe(0);
    });
  });
});
