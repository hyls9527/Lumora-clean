---
phase: "010"
plan: "010"
subsystem: "vector-search"
tags: ["sqlite-vec", "vector-search", "KNN", "semantic-search", "embeddings", "tauri", "sidecar"]
requires: ["009-frontend-backend-connection"]
provides: ["semantic-search-endpoint", "vector-storage", "embedding-generation"]
affects: ["commands/images.rs", "db/vectors.rs", "sidecar/manager.rs", "frontend-search-api"]
tech-stack:
  added: ["sqlite-vec v0.1.9", "oneshot response channels"]
  patterns: ["vec0 virtual tables", "JSON-RPC request/response routing", "exhaustive KNN cosine distance"]
key-files:
  created:
    - src-tauri/src/db/vectors.rs
    - .planning/phases/010-vector-search/010-PLAN.md
  modified:
    - src-tauri/Cargo.toml (sqlite-vec dependency)
    - src-tauri/Cargo.lock
    - src-tauri/src/db/migrations.rs (v6 migration)
    - src-tauri/src/db/connection.rs (sqlite3_auto_extension registration)
    - src-tauri/src/db/mod.rs (vectors module)
    - src-tauri/src/sidecar/manager.rs (send_request_and_wait, response routing)
    - src-tauri/src/commands/images.rs (search_semantic, generate_embeddings, count_embeddings)
    - src-tauri/src/lib.rs (new command registrations)
    - src/lib/api/search.ts (Tauri invoke wiring)
    - src/lib/api/embeddings.ts (Tauri invoke wiring)
    - src/stores/embedding-store.ts (real countEmbeddings API)
decisions:
  - Used sqlite-vec vec0 virtual tables instead of raw BLOB storage for vector KNN
  - Implemented oneshot-channel response routing in SidecarManager for synchronous request/response
  - Post-filter soft-deleted images in Rust after KNN (sqlite-vec does not allow WHERE on auxiliary columns in KNN queries)
  - Converted cosine distance to 0-100 similarity score: score = (1 - distance/2) * 100
metrics:
  duration: "~10 minutes"
  completed_date: "2026-06-22"
---

# Phase 010 Plan 010: Vector Search Summary

Integrated sqlite-vec for vector storage and exhaustive KNN search, created semantic search Tauri commands wired to the Python AI sidecar and the existing SemanticSearchBar UI.

## Commits

| Task | Commit  | Description                                              |
| ---- | ------- | -------------------------------------------------------- |
| 1    | 8d98ac8 | feat: add sqlite-vec dependency and v6 embeddings migration |
| 2    | bacb11b | feat: implement vector storage and KNN search via sqlite-vec |
| 3    | 0aaeafd | feat: create semantic search Tauri commands with sidecar response routing |
| 4    | b813b7d | feat: wire frontend SemanticSearchBar to real Tauri backend |

## What Was Built

### VEC-01: sqlite-vec Integration
- Added `sqlite-vec` v0.1.9 crate to Cargo.toml
- Created v6 migration: `embeddings` vec0 virtual table with `float[512]` vector column and `+image_id TEXT` metadata column
- Registered `sqlite3_vec_init` as SQLite auto-extension in `connection.rs` before any database connection opens

### VEC-02: Exhaustive KNN Search
- Created `db/vectors.rs` module with:
  - `store_embedding()` — upserts embeddings (delete then insert)
  - `search_knn()` — MATCH query with cosine distance, post-filters soft-deleted images
  - `count_embeddings()`, `has_embedding()`, `delete_embedding()` helpers
- 7 unit tests: store, count, replace, KNN search, limit, dimension validation, delete
- Cosine distance converted to 0-100 similarity score for frontend display

### VEC-03: Semantic Search Tauri Commands
- `search_semantic` command: text query -> Python sidecar `embed_text` -> sqlite-vec KNN -> results
- `generate_embeddings` command: finds images without embeddings, sends to sidecar via `embed_image`
- `count_embeddings` command: returns total embedding count for frontend polling
- Added `send_request_and_wait()` to SidecarManager with `oneshot` response channels
- Clear error messages when sidecar is not healthy or unavailable

### VEC-04: Frontend Wiring
- Updated `src/lib/api/search.ts`: `searchSemantic()` calls Tauri `invoke("search_semantic")` with browser mock fallback
- Updated `src/lib/api/embeddings.ts`: `generateEmbeddings()` calls Tauri `invoke("generate_embeddings")`
- Updated `embedding-store.ts`: uses real `countEmbeddings()` API instead of mock data
- Added `#[serde(rename_all = "camelCase")]` to Rust `SemanticSearchResult` for frontend compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] sqlite-vec KNN query with JOIN/WHERE on auxiliary columns**
- **Found during:** Task 2 testing
- **Issue:** The initial KNN query used `JOIN images i ON ... WHERE i.is_deleted = 0` alongside `MATCH`, which sqlite-vec rejects with "An illegal WHERE constraint was provided on a vec0 auxiliary column in a KNN query"
- **Fix:** Restructured to run pure KNN query first, then post-filter soft-deleted images in Rust with individual `SELECT is_deleted FROM images WHERE id = ?` checks
- **Files modified:** `src-tauri/src/db/vectors.rs`
- **Commit:** bacb11b

**2. [Rule 3 - Blocking] MutexGuard held across .await in async Tauri commands**
- **Found during:** Task 3 compilation
- **Issue:** `std::sync::MutexGuard<'_, AppState>` is not `Send`, causing `generate_embeddings` future to fail the `Send` bound required by Tauri's async command handler
- **Fix:** Wrapped all `state.lock()` calls in explicit `{ }` blocks to ensure the MutexGuard is dropped before any `.await` point
- **Files modified:** `src-tauri/src/commands/images.rs`
- **Commit:** 0aaeafd

**3. [Rule 2 - Missing Critical Functionality] SidecarManager lacked synchronous request/response**
- **Found during:** Task 3 implementation
- **Issue:** The existing `send_request()` was fire-and-forget — the semantic search command needed to wait for the embedding response from the sidecar
- **Fix:** Added `send_request_and_wait()` method with `oneshot` channels, a `pending` HashMap in SidecarManager, and JSON-RPC response parsing in the stdout reader
- **Files modified:** `src-tauri/src/sidecar/manager.rs`
- **Commit:** 0aaeafd

## Known Stubs

| File | Line | Description |
|------|------|-------------|
| src/lib/api/embeddings.ts | 29 | `getEmbeddingStatus()` always returns `[]` — per-image status not yet implemented in backend |
| src/lib/api/embeddings.ts | 69 | `cancelEmbeddingGeneration()` is a no-op — synchronous single-image processing |

These stubs are intentional and do not block the plan's goals. The plan requires semantic search and embedding generation, both of which are fully functional. Per-image status querying and cancellation are future enhancements.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries were introduced by this plan.

## Test Results

- 7/7 vector storage/KNN unit tests pass
- `cargo check` passes (pre-existing warning only)
- `npx tsc --noEmit` passes

## Self-Check: PASSED

- [x] All 4 task commits exist in git log (8d98ac8, bacb11b, 0aaeafd, b813b7d)
- [x] Created files exist: db/vectors.rs, 010-PLAN.md, 010-SUMMARY.md
- [x] `src-tauri/src/db/vectors.rs` exists on disk
- [x] `cargo check` passes
- [x] `npx tsc --noEmit` passes
- [x] No unexpected file deletions in commits
