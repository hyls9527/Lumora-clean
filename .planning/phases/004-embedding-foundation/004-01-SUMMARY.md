---
phase: 004-embedding-foundation
plan: 01
type: execute
subsystem: data-layer
tags:
  - api-stubs
  - zustand-store
  - i18n
  - embedding
requires: []
provides:
  - embedding-api-stubs
  - embedding-store
  - embedding-i18n-keys
affects:
  - "plan 004-02 (EmbeddingStatusPanel)"
  - "plan 004-03 (BatchGenerationUI)"
tech-stack:
  added: []
  patterns:
    - async-stub
    - zustand-create
    - setInterval-progress
key-files:
  created:
    - src/lib/api/embeddings.ts
    - src/stores/embedding-store.ts
  modified:
    - src/i18n/en.json
    - src/i18n/zh.json
decisions:
  - "Seeded pseudo-random status distribution: i % 100 < 70 = embedded, 70-94 = pending, 95+ = error"
  - "Batch progress simulation at 200ms intervals, incrementing 1-5 per tick, matching DropZone pattern"
metrics:
  duration: "96 seconds"
  completed_date: "2026-06-21T17:56:10Z"
---

# Phase 4 Plan 1: Embedding Data Layer

Establishment of the data layer for embedding functionality: typed API stubs, reactive Zustand state store with mock statuses for 200 images, and 22 i18n translation keys across English and Chinese locales.

## Execution Summary

Three autonomous tasks executed without checkpoint interruptions. All tasks passed TypeScript validation with zero errors. The data layer follows existing project conventions — async stub pattern from `src/lib/api/images.ts`, Zustand `create<State>` pattern from `src/stores/app-store.ts`, and dot-notation i18n key structure from existing locale files.

## Tasks Completed

### Task 1: Embedding API Stubs
- **Commit:** `4dcf6e9`
- **File:** `src/lib/api/embeddings.ts` (created, 29 lines)
- **Exports:** `EmbeddingStatus` type, `BatchGenerationState` type, `getEmbeddingStatus`, `generateEmbeddings`, `cancelEmbeddingGeneration`
- **Pattern:** All functions are `async`, take typed parameters, return typed promises. Follows the existing `src/lib/api/images.ts` mock pattern with the `// Mock API` header comment.
- **Verification:** `npx tsc --noEmit` passed with zero errors from this file.

### Task 2: Embedding Zustand Store
- **Commit:** `9752eb4`
- **File:** `src/stores/embedding-store.ts` (created, 168 lines)
- **Exports:** `useEmbeddingStore`
- **State initialized with:** 200 mock embedding statuses via `generateMockEmbeddingStatuses(200)` — ~140 embedded, ~50 pending, ~10 error using deterministic `i % 100` bucket distribution.
- **Getters:** `getStatus(imageId)` returns status or pending default; `embeddedCount()`, `pendingCount()`, `errorCount()` compute from the statuses Map.
- **Actions:** `loadStatuses()` calls API stub and handles results; `generateEmbeddings(ids)` starts 200ms setInterval simulated progress (1-5 increment per tick); `cancelGeneration()` clears interval, calls API stub, resets batch state.
- **Verification:** `npx tsc --noEmit` passed with zero errors from this file.

### Task 3: Embedding i18n Keys
- **Commit:** `71ab9c6`
- **File:** `src/i18n/en.json` (modified, +36 lines), `src/i18n/zh.json` (modified, +36 lines)
- **Keys added:** 22 keys under new top-level `embedding` section — `generate`, `cancel`, `status.embedded/pending/error`, `detail.sectionLabel/dimensions/model/generated/notGenerated/failed/retry`, `dashboard.label/emptyTitle/emptyBody`, `batch.progress`, `toast.failed/tryAgain/success`, `tooltip.embedded/pending/error`
- **Both files pass `JSON.parse()` validation.** Chinese translations use correct CJK characters.
- **Verification:** `npx tsc --noEmit` passed with zero errors project-wide.

## Success Criteria Confirmation

1. `src/lib/api/embeddings.ts` exists with 3 typed async stub functions and 2 exported types -- PASSED
2. `src/stores/embedding-store.ts` exists with `useEmbeddingStore` export, mock status data for 200 images, and batch generation with simulated progress -- PASSED
3. EN and ZH i18n files contain 22 embedding keys each under `embedding.*` -- PASSED
4. Full project type-checks with zero errors: `npx tsc --noEmit` -- PASSED

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

All implementations are intentional stubs per the v0.2 AI-Ready Frontend approach:
- `src/lib/api/embeddings.ts` — All three async functions are pure stubs returning mock data or empty results. Real backend integration deferred to post-v0.2.
- `src/stores/embedding-store.ts` — Store initializes from `generateMockEmbeddingStatuses(200)` locally rather than calling the API. `loadStatuses()` is wired but the stub always returns `[]`, so the mock initializer is the effective source of truth.

## Threat Flags

None. All data is client-side mock data with no network boundary, no PII, no user-provided input, and no new npm packages introduced.

## Self-Check: PASSED

- `src/lib/api/embeddings.ts` -- FOUND
- `src/stores/embedding-store.ts` -- FOUND
- `.planning/phases/004-embedding-foundation/004-01-SUMMARY.md` -- FOUND
- Commit `4dcf6e9` -- FOUND
- Commit `9752eb4` -- FOUND
- Commit `71ab9c6` -- FOUND

## Requirements Satisfied

- INT-01: API stubs for embedding operations
- INT-02: Zustand store providing reactive embedding status
- INT-03: i18n keys supporting EN/ZH text for embedding UI
