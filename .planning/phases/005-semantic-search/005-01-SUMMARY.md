---
phase: 005-semantic-search
plan: 01
subsystem: search
tags: [api-stubs, zustand-store, i18n, search-data-layer]
requires: []
provides:
  - semantic-search-api
  - semantic-search-store
  - semantic-search-i18n
affects:
  - src/lib/api/search.ts
  - src/stores/semantic-search-store.ts
  - src/i18n/en.json
  - src/i18n/zh.json
tech-stack:
  added: []
  patterns:
    - Mock API stub pattern (matching embeddings.ts)
    - Zustand create<State>((set, get) => ...) pattern
    - Dot-notation i18n keys with literal {n} placeholders
key-files:
  created:
    - src/lib/api/search.ts
    - src/stores/semantic-search-store.ts
  modified:
    - src/i18n/en.json
    - src/i18n/zh.json
decisions:
  - "Store debounce left to UI layer (SemanticSearchBar), not built into store"
  - "score.label and results.count use literal {n} replacement (matching embedding.batch.progress pattern from Phase 004)"
  - "loadSuggestions failures degrade gracefully (clear suggestions, don't set error) — search still works without autocomplete"
  - "i18n section placed after commandPalette for logical grouping near other search/UI sections"
metrics:
  duration: 103s
  completed: "2026-06-21T18:20:38Z"
---

# Phase 005 Plan 01: Semantic Search Data Layer Summary

**One-liner:** Typed API stubs, reactive Zustand store with debounce-ready querying, and 20 i18n keys across EN/ZH — the complete semantic search data layer for Phase 005 UI work.

## What Was Built

### Task 1: Semantic Search API Stubs (`src/lib/api/search.ts`)

Created typed async mock functions following the `embeddings.ts` pattern:

- **`searchSemantic(query)`** — Generates 5-15 deduplicated results with `imageId` and `score` (25-85). Sorted descending by score. Returns `[]` for empty queries. Simulated 200-600ms latency.
- **`getSearchSuggestions(query)`** — Prefix-matches against 15 hardcoded English terms. Returns matching terms + 3 fixed `tryDescribing` examples. Returns empty for queries < 2 chars. Simulated 100ms latency.
- **Types exported:** `SemanticSearchResult`, `SearchSuggestions`

### Task 2: Semantic Search Zustand Store (`src/stores/semantic-search-store.ts`)

Created reactive store following the `embedding-store.ts` pattern:

- **State:** `query`, `searchMode` ('exact' | 'semantic'), `results`, `suggestions`, `tryDescribing`, `isSearching`, `isLoadingSuggestions`, `error`
- **Getters:** `getScore(imageId)` returns score or null, `hasResults()` returns boolean
- **Actions:** `setQuery`, `setSearchMode`, `search`, `loadSuggestions`, `clearSearch`
- **Debounce left to UI layer** (SemanticSearchBar will handle)
- **Graceful degradation:** `loadSuggestions` failures clear suggestions silently — search still works
- **Empty query short-circuit:** Both `search` and `loadSuggestions` skip API calls for empty/short queries

### Task 3: i18n Keys (en.json + zh.json)

Added `semanticSearch` section with 20 keys in both locales, matching the 005-UI-SPEC.md copywriting contract:

| Category | Keys | Purpose |
|----------|------|---------|
| Input | `placeholder`, `clear`, `searching` | Search bar UI |
| Mode | `mode.exact`, `mode.semantic`, `mode.exactHint`, `mode.semanticHint` | Exact/semantic toggle |
| Score | `score.label`, `score.tooltip` | Similarity score display |
| Suggestions | `suggestions.heading`, `tryDescribing`, `noSuggestions`, `loadingFailed` | Autocomplete panel |
| Empty | `empty.heading`, `empty.body`, `empty.action`, `empty.noEmbeddingsNote` | Zero results state |
| Error | `error.unavailable`, `error.switchToExact` | Error recovery |
| Results | `results.count` | Result count display |

## Verification Results

- [x] `src/lib/api/search.ts` exports `searchSemantic`, `getSearchSuggestions`, `SemanticSearchResult`, `SearchSuggestions`
- [x] `src/stores/semantic-search-store.ts` exports `useSemanticSearchStore`
- [x] Both `en.json` and `zh.json` contain complete `semanticSearch` section, valid JSON
- [x] `npx tsc --noEmit` passes with zero errors

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | fbcb0b4 | feat(005-semantic-search): create semantic search API stubs |
| 2 | 119e130 | feat(005-semantic-search): create semantic search Zustand store |
| 3 | 6c7a5b8 | feat(005-semantic-search): add semanticSearch i18n keys for EN and ZH |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

No new threat surface beyond what the plan's threat model anticipated (T-005-01, T-005-02, T-005-SC all accept dispositions for mock data only).

## Self-Check

- [x] `src/lib/api/search.ts` exists
- [x] `src/stores/semantic-search-store.ts` exists
- [x] Commits fbcb0b4, 119e130, 6c7a5b8 verified in git log
- [x] Both i18n files contain `semanticSearch` section with valid JSON
- [x] Type check passes with zero errors
