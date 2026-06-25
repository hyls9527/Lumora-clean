---
phase: 007-rust-data-layer
plan: 04
subsystem: db
tags: [sqlite, fts5, migrations, schema, models, crud]
requires: [007-03]
provides: [007-05, 007-06, 007-07]
affects: [src-tauri/src/db/, src-tauri/src/state.rs, src-tauri/src/lib.rs]
tech-stack:
  added: []
  upgraded: []
  patterns:
    - "rusqlite_migration versioned chain (v1-v5) with Migrations::new()"
    - "FTS5 external content table with SQLite triggers (delete+insert on UPDATE)"
    - "WAL mode + busy_timeout=5000 + foreign_keys=ON for concurrent reads"
    - "Parameterized SQL via rusqlite::params! (no string interpolation)"
key-files:
  created:
    - src-tauri/src/db/migrations.rs
    - src-tauri/src/db/models.rs
    - src-tauri/src/db/connection.rs
    - src-tauri/src/db/images.rs
    - src-tauri/src/db/search.rs
    - src-tauri/src/db/mod.rs
  modified:
    - src-tauri/src/state.rs (removed in-memory placeholder AppState::new())
    - src-tauri/src/lib.rs (setup closure calls initialize_database())
decisions:
  - "Migration chain uses fn migrations() -> Migrations<'static> instead of const due to rusqlite_migration 2.0.0 Drop impl"
  - "FTS5 triggers follow delete+insert pattern on UPDATE to avoid token leakage"
  - "File-missing status derived at query time (not stored as column) — D-16 startup scan logs count"
  - "favorite/is_deleted stored as INTEGER 0/1, read via row.get::<_, i32>()? != 0"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-06-22"
---

# Phase 007 Plan 04: Database Layer Summary

**One-liner:** SQLite schema with FTS5 triggers, versioned migration chain (v1-v5), WAL-mode connection init, and 10 parameterized CRUD + search query functions — the data foundation for all Phase 7 backend work.

## Execution Summary

Three tasks executed atomically with zero `cargo check` errors:

| Task | Name | Commit | Key Artifacts |
|------|------|--------|---------------|
| 1 | Models + Migration Chain | `1b27354` | 5 structs (ImageRow, TagRow, ImageTagRow, SearchResultRow, NewImage, UpdateImageMeta); 5 versioned migrations (images → tags → FTS5 → thumbnails → sha256+trashed_at) |
| 2 | Connection + WAL + FTS5 Triggers | `6e5bbb6` | `open_database`, `run_migrations`, `setup_fts5_triggers`, `populate_fts_index`, `initialize_database` (with D-16 startup scan); updated state.rs + lib.rs |
| 3 | CRUD + FTS5 Search | `bbc9527` | 9 CRUD query functions + `find_file_missing_images`; `search_images_fts` with BM25 ranking and pagination |

## What Was Built

### Migration Chain (v1-v5)

| Version | Schema Change | Purpose |
|---------|---------------|---------|
| v1 | `CREATE TABLE images` + 2 indexes | Core image storage |
| v2 | `CREATE TABLE tags`, `image_tags` + 2 indexes | Tagging support (many-to-many) |
| v3 | `CREATE VIRTUAL TABLE images_fts USING fts5` | Full-text search on original_name + tags |
| v4 | `ALTER TABLE images ADD COLUMN thumbnail_path` | D-04: separate thumbnail files |
| v5 | `ALTER TABLE images ADD COLUMN sha256_hash`, `trashed_at` + index | D-11 dedup + soft-delete enhancement |

### FTS5 Trigger Strategy

- **INSERT trigger** (`images_fts_ai`): Inserts new row with `GROUP_CONCAT` of tags into FTS index
- **DELETE trigger** (`images_fts_ad`): Uses `'delete'` command to remove from FTS index
- **UPDATE trigger** (`images_fts_au`): Delete+insert pattern — explicitly removes old tokens before inserting new ones, preventing FTS5 token leakage (pitfall documented in RESEARCH.md)

### Query Functions (all parameterized via `rusqlite::params!`)

| Function | SQL Pattern | Maps To |
|----------|------------|---------|
| `list_images` | SELECT … WHERE is_deleted=0 ORDER BY created_at DESC LIMIT ? OFFSET ? | Gallery grid |
| `get_image_count` | SELECT COUNT(*) WHERE is_deleted=0 | Pagination total |
| `insert_image` | INSERT INTO images … VALUES (?) | Import |
| `set_image_rating` | UPDATE images SET rating=? WHERE id=? | Rating |
| `set_image_favorite` | UPDATE images SET favorite=? WHERE id=? | Favorite toggle |
| `soft_delete_image` | UPDATE images SET is_deleted=1, deleted_at=datetime('now') WHERE id=? | Trash |
| `permanent_delete_image` | DELETE FROM images WHERE id=? | Empty trash |
| `is_duplicate` | SELECT COUNT(*) WHERE sha256_hash=? AND is_deleted=0 | D-11 dedup |
| `get_image_by_id` | SELECT … WHERE id=? | Detail view |
| `find_file_missing_images` | SELECT … WHERE is_deleted=0 | D-16 startup scan |
| `search_images_fts` | JOIN images_fts MATCH ? ORDER BY rank LIMIT ? OFFSET ? | Search |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] const not supported for Migrations in rusqlite_migration 2.0.0**
- **Found during:** Task 1
- **Issue:** `pub const MIGRATIONS: Migrations<'_> = Migrations::from_slice(&[...])` failed with E0493 — M has a Drop implementation that cannot be evaluated at compile-time
- **Fix:** Changed to function-based pattern: `pub fn migrations() -> Migrations<'static> { Migrations::new(vec![...]) }`. Functionally identical — `run_migrations` calls `migrations().to_latest(conn)`
- **Files modified:** `src-tauri/src/db/migrations.rs`
- **Commit:** `1b27354`

None other — plan executed exactly as written beyond this API compatibility fix.

## Verification Results

| Check | Status |
|-------|--------|
| `cargo check` — zero errors | PASSED |
| 5 migrations (v1-v5) defined | PASSED |
| 6 model structs (ImageRow, TagRow, ImageTagRow, SearchResultRow, NewImage, UpdateImageMeta) | PASSED |
| 5 connection functions (open, migrate, triggers, populate, initialize) | PASSED |
| D-16 startup file scan in initialize_database | PASSED |
| 10 query functions with parameterized SQL | PASSED |
| FTS5 search with BM25 ranking + pagination | PASSED |
| WAL mode + busy_timeout=5000 + foreign_keys=ON | PASSED |
| state.rs clean (no in-memory placeholder) | PASSED |
| lib.rs setup calls initialize_database() | PASSED |

## Requirement Traceability

| Req ID | Description | Met By |
|--------|-------------|--------|
| RDL-01 | SQLite database with versioned schema migration chain | migrations.rs (v1-v5), migration runner in connection.rs |

## Deferred Items

None — all plan items completed. Remaining untracked files in `src-tauri/src/` (commands/, filesystem/, imaging/, main.rs) belong to future plans (05, 06, 07).

## Self-Check: PASSED

- [x] `src-tauri/src/db/migrations.rs` exists — FOUND
- [x] `src-tauri/src/db/models.rs` exists — FOUND
- [x] `src-tauri/src/db/connection.rs` exists — FOUND
- [x] `src-tauri/src/db/images.rs` exists — FOUND
- [x] `src-tauri/src/db/search.rs` exists — FOUND
- [x] `src-tauri/src/db/mod.rs` exists — FOUND
- [x] Commit `1b27354` exists — FOUND (models + migrations)
- [x] Commit `6e5bbb6` exists — FOUND (connection + state + lib)
- [x] Commit `bbc9527` exists — FOUND (images + search)
- [x] `cargo check` passes with zero errors — CONFIRMED
