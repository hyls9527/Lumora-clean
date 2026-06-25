---
phase: "010"
plan: "010"
type: "feature"
autonomous: true
wave: 1
depends_on: ["009-frontend-backend-connection"]
requirements: ["VEC-01", "VEC-02", "VEC-03", "VEC-04"]
---

# Phase 010 Plan: Vector Search

**Objective:** Integrate sqlite-vec for vector storage and KNN search, create semantic search Tauri command, and wire to the existing SemanticSearchBar UI.

## Context

This plan builds on:
- Phase 007: Rust Data Layer (rusqlite, migrations, FTS5 search)
- Phase 008: Python AI Sidecar (embedding generation)
- Phase 009: Frontend-Backend Connection (Tauri IPC wiring)
- Phase 005: SemanticSearchBar UI component

## Tasks

### Task 1: Add sqlite-vec dependency and v6 migration
- Add `sqlite-vec` to Cargo.toml
- Create migration v6: `embeddings` vec0 virtual table with `float[512]` embedding and `image_id` metadata
- Register sqlite3_vec_init as auto-extension in connection.rs

### Task 2: Implement vector storage and KNN search
- Create `src-tauri/src/db/vectors.rs` with store_embedding(), search_knn(), helpers
- Use sqlite-vec vec0 virtual table for KNN with cosine distance
- 7 unit tests for storage, search, replace, delete, validation

### Task 3: Create semantic search Tauri command
- Add search_semantic command: text query -> sidecar embedding -> KNN
- Add generate_embeddings command: trigger sidecar embedding generation
- Add count_embeddings command for frontend polling
- Add send_request_and_wait with oneshot channels to SidecarManager

### Task 4: Wire frontend SemanticSearchBar to real backend
- Update search.ts to call Tauri invoke("search_semantic")
- Update embeddings.ts to call Tauri invoke("generate_embeddings")
- Update embedding-store.ts to use real countEmbeddings API
- camelCase serialization on Rust SemanticSearchResult

## Verification
- `cargo check` passes
- `npx tsc --noEmit` passes
- 7 unit tests for vector storage/KNN pass
