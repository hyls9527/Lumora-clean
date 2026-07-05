import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as tauri from '../../tauri';

import {
  searchSemanticCached,
  invalidateSemanticCache,
  getCachedResult,
  setCachedResult,
  isCacheValid,
} from '../semanticCache';

describe('SemanticSearchCache', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // Force re-hydrate by invalidating the hydrated flag
    invalidateSemanticCache();
  });

  it('should return cached results for same query without calling invoke', async () => {
    const cachedResults = [
      { id: 'img-1', similarity: 95 },
      { id: 'img-2', similarity: 88 },
    ];
    setCachedResult('sunset beach', cachedResults);

    const spy = vi.spyOn(tauri, 'invoke');
    const results = await searchSemanticCached('sunset beach');

    expect(results).toEqual(cachedResults);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should normalize queries (case, whitespace)', async () => {
    const cachedResults = [{ id: 'img-1', similarity: 95 }];
    setCachedResult('  Sunset  Beach  ', cachedResults);

    // Same query with different casing/whitespace should hit cache
    const spy = vi.spyOn(tauri, 'invoke');
    const results = await searchSemanticCached('sunset beach');
    expect(results).toEqual(cachedResults);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should clear cache when invalidated', async () => {
    setCachedResult('query-a', [{ id: 'img-1', similarity: 90 }]);
    setCachedResult('query-b', [{ id: 'img-2', similarity: 80 }]);

    expect(isCacheValid()).toBe(true);

    invalidateSemanticCache();

    expect(getCachedResult('query-a')).toBeNull();
    expect(getCachedResult('query-b')).toBeNull();
    expect(isCacheValid()).toBe(false);
  });

  it('should invoke search pipeline on cache miss', async () => {
    const mockEmbedding = [0.1, 0.2, 0.3];
    const mockResults = [{ id: 'img-3', similarity: 0.75 }];

    const spy = vi.spyOn(tauri, 'invoke');
    spy.mockImplementation(async (cmd: string) => {
      if (cmd === 'embed_text_cmd') return mockEmbedding;
      if (cmd === 'search_semantic_cmd') return mockResults;
      return null;
    });

    const results = await searchSemanticCached('mountain landscape');

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 'embed_text_cmd', { text: 'mountain landscape' });
    expect(spy).toHaveBeenNthCalledWith(2, 'search_semantic_cmd', {
      queryEmbedding: mockEmbedding,
      limit: 20,
    });
    expect(results).toEqual([{ id: 'img-3', similarity: 75 }]);
    expect(getCachedResult('mountain landscape')).toEqual([{ id: 'img-3', similarity: 75 }]);
  });

  it('should evict oldest entries when cache exceeds size limit', () => {
    // Exceed MAX_ENTRIES (200) to trigger count-based eviction
    const numEntries = 210;

    for (let i = 0; i < numEntries; i++) {
      setCachedResult(`query-${i}`, [{ id: `img-${i}`, similarity: 50 + (i % 50) }]);
    }

    // Latest entry should exist
    const lastEntry = getCachedResult(`query-${numEntries - 1}`);
    expect(lastEntry).not.toBeNull();

    // Oldest entry should be evicted
    const firstEntry = getCachedResult('query-0');
    expect(firstEntry).toBeNull();
  });

  it('should expire entries after TTL', () => {
    // Use fake timers to simulate time passing
    vi.useFakeTimers();

    setCachedResult('old-query', [{ id: 'img-1', similarity: 90 }]);
    expect(getCachedResult('old-query')).not.toBeNull();

    // Advance time past TTL (30 minutes + 1 second)
    vi.advanceTimersByTime(30 * 60 * 1000 + 1000);

    expect(getCachedResult('old-query')).toBeNull();

    vi.useRealTimers();
  });

  it('should LRU-promote accessed entries', () => {
    // Fill cache to exactly MAX_ENTRIES (no eviction yet)
    for (let i = 0; i < 200; i++) {
      setCachedResult(`query-${i}`, [{ id: `img-${i}`, similarity: 50 + (i % 50) }]);
    }

    // query-0 is the oldest. Promote it by accessing (moves to end of Map).
    expect(getCachedResult('query-0')).not.toBeNull();

    // Add one more to trigger eviction of 1 entry
    setCachedResult('trigger', [{ id: 'img-trigger', similarity: 99 }]);

    // query-0 was promoted to end, so it survives. query-1 (now oldest) is evicted.
    expect(getCachedResult('query-0')).not.toBeNull();
    expect(getCachedResult('query-1')).toBeNull();
  });
});

describe('Debounce persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should write to localStorage after 300ms debounce', async () => {
    setCachedResult('test-query', [
      { id: 'img-1', similarity: 90 },
    ]);

    // Before 300ms — localStorage should NOT have the cache yet
    const before = localStorage.getItem('lumora:semantic-cache');
    expect(before).toBeNull();

    // Advance past debounce
    vi.advanceTimersByTime(350);

    // Now localStorage should have the cache
    const after = localStorage.getItem('lumora:semantic-cache');
    expect(after).not.toBeNull();
    expect(after).toContain('test-query');
  });
});
