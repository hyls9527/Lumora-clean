/**
 * Semantic search cache layer.
 *
 * Patterns applied from lru-cache (npm, 40M+/week):
 * - Map-based LRU with O(1) operations
 * - TTL-based expiry (configurable)
 * - Size-aware eviction (byte tracking, no JSON.stringify per write)
 * - Query normalization (lowercase, trim, collapse whitespace)
 * - Debounced persistence (batch rapid writes)
 */

import { invoke } from '../tauri';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CachedEntry {
  results: { id: string; similarity: number }[];
  /** Insertion/update timestamp */
  ts: number;
  /** Estimated byte size of serialized entry */
  bytes: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_KEY = 'lumora:semantic-cache';
const CACHE_VALID_KEY = 'lumora:semantic-cache-valid';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_ENTRIES = 200;

// ---------------------------------------------------------------------------
// In-memory LRU (Map-based, O(1) operations)
// ---------------------------------------------------------------------------

let cache = new Map<string, CachedEntry>();
let totalBytes = 0;
let hydrated = false;

/** Normalize query: lowercase, trim, collapse whitespace. */
function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Estimate serialized byte size of an entry (avoids JSON.stringify). */
function estimateBytes(key: string, results: { id: string; similarity: number }[]): number {
  let size = key.length + 6; // "key":{...}
  for (const r of results) {
    size += 14 + r.id.length + 4; // {"id":"...","similarity":NN},
  }
  return size;
}

/** Evict oldest entries until under limits. Uses Map insertion order. */
function evict(): void {
  const keys = Array.from(cache.keys());
  for (const key of keys) {
    if (totalBytes <= MAX_BYTES && cache.size <= MAX_ENTRIES) break;
    if (cache.size <= 1) break;
    const entry = cache.get(key);
    if (entry) {
      cache.delete(key);
      totalBytes -= entry.bytes;
    }
  }
}

/** Check if an entry is expired. */
function isExpired(entry: CachedEntry): boolean {
  return Date.now() - entry.ts > TTL_MS;
}

// ---------------------------------------------------------------------------
// Persistence (localStorage, debounced)
// ---------------------------------------------------------------------------

/** Hydrate in-memory cache from localStorage (once). */
function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedEntry>;
    const keys = Object.keys(parsed);
    for (const key of keys) {
      const entry = parsed[key];
      if (!isExpired(entry)) {
        cache.set(key, entry);
        totalBytes += entry.bytes;
      }
    }
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

/** Persist current cache to localStorage (debounced 300ms). */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const obj: Record<string, CachedEntry> = {};
      cache.forEach((entry, key) => { obj[key] = entry; });
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch {
      // Storage full — evict half and retry
      const keys = Array.from(cache.keys());
      const half = Math.floor(keys.length / 2);
      for (let i = 0; i < half; i++) {
        const entry = cache.get(keys[i]);
        if (entry) totalBytes -= entry.bytes;
        cache.delete(keys[i]);
      }
      try {
        const obj: Record<string, CachedEntry> = {};
        cache.forEach((entry, key) => { obj[key] = entry; });
        localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }
    }
  }, 300);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get cached results. Returns null if missing or expired. */
export function getCachedResult(query: string): { id: string; similarity: number }[] | null {
  hydrate();
  const key = normalizeQuery(query);
  const entry = cache.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    cache.delete(key);
    totalBytes -= entry.bytes;
    persist();
    return null;
  }
  // LRU: delete + re-insert to move to end (most recently used)
  cache.delete(key);
  cache.set(key, entry);
  return entry.results;
}

/** Store results in cache. */
export function setCachedResult(
  query: string,
  results: { id: string; similarity: number }[],
): void {
  hydrate();
  const key = normalizeQuery(query);
  const bytes = estimateBytes(key, results);

  // Remove old entry if exists
  const old = cache.get(key);
  if (old) {
    totalBytes -= old.bytes;
    cache.delete(key);
  }

  cache.set(key, { results, ts: Date.now(), bytes });
  totalBytes += bytes;
  evict();
  persist();
  // Re-validate after writing (undo invalidation from import/delete)
  localStorage.setItem(CACHE_VALID_KEY, 'true');
}

/** Check if cache is globally valid (not invalidated). */
export function isCacheValid(): boolean {
  return localStorage.getItem(CACHE_VALID_KEY) !== 'false';
}

/** Invalidate entire cache (e.g., after image import). */
export function invalidateSemanticCache(): void {
  cache.clear();
  totalBytes = 0;
  localStorage.removeItem(CACHE_KEY);
  localStorage.setItem(CACHE_VALID_KEY, 'false');
}

/** Cache stats for debugging/UI. */
export function getCacheStats(): { entries: number; bytes: number; maxBytes: number } {
  hydrate();
  return { entries: cache.size, bytes: totalBytes, maxBytes: MAX_BYTES };
}

// ---------------------------------------------------------------------------
// Search with caching
// ---------------------------------------------------------------------------

/** Perform semantic search with caching. */
export async function searchSemanticCached(
  query: string,
  limit?: number,
): Promise<{ id: string; similarity: number }[]> {
  if (!query.trim()) return [];

  // 1. Check cache (O(1) Map lookup)
  const cached = getCachedResult(query);
  if (cached !== null && isCacheValid()) {
    return cached;
  }

  // 2. Cache miss — run two-step pipeline
  const embedding = await invoke<number[]>('embed_text_cmd', { text: query });
  const rawResults = await invoke<Array<{ id: string; similarity: number }>>(
    'search_semantic_cmd',
    { queryEmbedding: embedding, limit: limit ?? 20 },
  );

  const results = rawResults ?? [];
  const normalized = results.map(r => ({
    id: r.id,
    similarity: Math.round(r.similarity * 100),
  }));

  // 3. Store in cache
  setCachedResult(query, normalized);

  return normalized;
}
