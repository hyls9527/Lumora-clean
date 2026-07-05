/**
 * Semantic search cache — Map-based LRU with TTL + localStorage persistence.
 * ponytail: dropped byte tracking & storage-full recovery (count-based eviction covers it).
 */

import { invoke } from '../tauri';

interface CachedEntry {
  results: { id: string; similarity: number }[];
  ts: number;
}

const CACHE_KEY = 'lumora:semantic-cache';
const CACHE_VALID_KEY = 'lumora:semantic-cache-valid';
const TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_ENTRIES = 200;

let cache = new Map<string, CachedEntry>();
let hydrated = false;

function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ');
}

function isExpired(entry: CachedEntry): boolean {
  return Date.now() - entry.ts > TTL_MS;
}

// --- Persistence (debounced) ---

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedEntry>;
    for (const [key, entry] of Object.entries(parsed)) {
      if (!isExpired(entry)) cache.set(key, entry);
    }
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

function persist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const obj: Record<string, CachedEntry> = {};
      cache.forEach((entry, key) => { obj[key] = entry; });
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch {
      localStorage.removeItem(CACHE_KEY);
    }
  }, 300);
}

// --- Public API ---

export function getCachedResult(query: string): { id: string; similarity: number }[] | null {
  hydrate();
  const key = normalizeQuery(query);
  const entry = cache.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    cache.delete(key);
    persist();
    return null;
  }
  // LRU: move to end
  cache.delete(key);
  cache.set(key, entry);
  return entry.results;
}

export function setCachedResult(
  query: string,
  results: { id: string; similarity: number }[],
): void {
  hydrate();
  const key = normalizeQuery(query);
  cache.set(key, { results, ts: Date.now() });

  // Evict oldest if over limit
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
    else break;
  }

  persist();
  localStorage.setItem(CACHE_VALID_KEY, 'true');
}

export function isCacheValid(): boolean {
  return localStorage.getItem(CACHE_VALID_KEY) !== 'false';
}

export function invalidateSemanticCache(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  cache.clear();
  localStorage.removeItem(CACHE_KEY);
  localStorage.setItem(CACHE_VALID_KEY, 'false');
}

/** Semantic search with caching. */
export async function searchSemanticCached(
  query: string,
  limit?: number,
): Promise<{ id: string; similarity: number }[]> {
  if (!query.trim()) return [];

  const cached = getCachedResult(query);
  if (cached !== null && isCacheValid()) return cached;

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

  setCachedResult(query, normalized);
  return normalized;
}
