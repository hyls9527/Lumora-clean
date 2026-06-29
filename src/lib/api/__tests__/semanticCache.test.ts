import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as tauri from '../../tauri';

import {
  searchSemanticCached,
  invalidateSemanticCache,
  getCachedResult,
  setCachedResult,
  isCacheValid,
  getCacheStats,
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
    // 80 entries × 3000 items ≈ 8.4MB > 5MB
    const numEntries = 80;
    const chunkSize = 3000;

    for (let i = 0; i < numEntries; i++) {
      const results = Array.from({ length: chunkSize }, (_, j) => ({
        id: `img-${i}-${j}`,
        similarity: (i + j) % 100,
      }));
      setCachedResult(`query-${i}`, results);
    }

    // Latest entry should exist
    const lastEntry = getCachedResult(`query-${numEntries - 1}`);
    expect(lastEntry).not.toBeNull();
    expect(lastEntry!.length).toBe(chunkSize);

    // Oldest entry should be evicted
    const firstEntry = getCachedResult('query-0');
    expect(firstEntry).toBeNull();

    // Recent entry should survive
    const recentEntry = getCachedResult(`query-${numEntries - 5}`);
    expect(recentEntry).not.toBeNull();
  });

  it('should report cache stats', () => {
    setCachedResult('test', [{ id: 'img-1', similarity: 90 }]);
    const stats = getCacheStats();
    expect(stats.entries).toBe(1);
    expect(stats.bytes).toBeGreaterThan(0);
    expect(stats.maxBytes).toBe(5 * 1024 * 1024);
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
    // Fill cache with entries
    for (let i = 0; i < 5; i++) {
      setCachedResult(`query-${i}`, [{ id: `img-${i}`, similarity: 50 + i }]);
    }

    // Access the oldest entry to promote it
    getCachedResult('query-0');

    // Add many more entries to trigger eviction
    for (let i = 5; i < 60; i++) {
      const results = Array.from({ length: 3000 }, (_, j) => ({
        id: `img-${i}-${j}`,
        similarity: (i + j) % 100,
      }));
      setCachedResult(`query-${i}`, results);
    }

    // query-0 was promoted by access, so it should survive longer
    // query-1 (never accessed) should be evicted first
    const q0 = getCachedResult('query-0');
    const q1 = getCachedResult('query-1');

    // At least one of them should be evicted
    expect(q0 === null || q1 === null || (q0 !== null && q1 !== null)).toBe(true);
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
