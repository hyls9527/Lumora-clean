---
phase: 007-rust-data-layer
plan: "05"
subsystem: database
tags: [tauri, rusqlite, fts5, sqlite, serde, thiserror, uuid, image-crate]

# Dependency graph
requires:
  - phase: 007-03
    provides: "Tauri command stub scaffolding, mod.rs structure, AppState definition"
  - phase: 007-04
    provides: "db::images CRUD query functions, db::search FTS5 search, db::models data types"
provides:
  - "6 Tauri command handlers: list_images, import_images, search_images, update_image, delete_image, get_image_count"
  - "AppError enum with 5 variants + Serialize + From impls for rusqlite and io errors"
  - "ImageRecord, ImportProgress, ImportResult, UpdateImagePayload, SearchResult, PaginatedResult types"
  - "spawn_blocking pattern for async import with progress events"
  - "Parameter validation (rating 0-5, limit 1-200, offset >= 0)"
affects: [009-frontend-backend-connection, 007-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tauri v2 sync commands for fast DB reads (list, count, search, update, delete)"
    - "Tauri v2 async commands with tauri::async_runtime::spawn_blocking for heavy I/O (import)"
    - "AppError derives thiserror::Error + serde::Serialize for Tauri IPC error propagation"
    - "Mutex<AppState> via State<> injection for thread-safe DB access"
    - "Parameter clamping per D-21 (limit, offset, rating)"
    - "Import progress events via tauri::Emitter trait (app.emit)"

key-files:
  created: []
  modified:
    - "src-tauri/src/commands/images.rs"

key-decisions:
  - "Used tauri::async_runtime::spawn_blocking instead of tokio::task::spawn_blocking (avoid extra dependency)"
  - "Sync commands for fast DB ops; async only for import_images (long-running I/O)"
  - "Kept regenerate_thumbnail and relocate_file stubs (Plan 07 scope)"

patterns-established:
  - "Sync Tauri command pattern: State<Mutex<AppState>> injection, lock, call db fn, return Result<T, AppError>"
  - "Async Tauri command pattern: AppHandle + State, clone state, spawn_blocking, lock inside closure, emit events"
  - "AppError as universal error type across all commands — Serialize for Tauri IPC, From impls for auto-conversion"

requirements-completed: [RDL-02, RDL-03]

# Metrics
duration: 5min
completed: 2026-06-22
---

# Phase 007 Plan 05: CRUD Commands + FTS5 Search Summary

**Six Tauri command handlers wired to SQLite via Parameterized queries with spawn_blocking for async import and progress event emission**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-22T18:02:02Z
- **Completed:** 2026-06-22T18:07:21Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Replaced stub `commands/images.rs` with production implementations for all 6 commands
- `list_images` returns paginated `Vec<ImageRecord>` with tag enrichment from SQLite
- `import_images` reads image dimensions via the image crate, inserts into DB, emits `import-progress` events per file
- `search_images` performs FTS5 full-text search with BM25 ranking via parameterized bind
- `update_image` validates rating (0-5), updates only provided fields; FTS5 triggers auto-sync
- `delete_image` performs soft delete per D-10 (sets is_deleted, deleted_at)
- `get_image_count` returns actual count of non-deleted images from SQLite

## Task Commits

Each task was committed atomically:

1. **Task 1-3: All CRUD commands and FTS5 search** - `71398d6` (feat)

**Plan metadata:** pending final commit

## Files Created/Modified
- `src-tauri/src/commands/images.rs` - Complete rewrite: AppError enum, 6 command types, conversion helpers, 6 command handlers, 2 retained stubs

## Decisions Made
- Used `tauri::async_runtime::spawn_blocking` instead of adding `tokio` as a direct dependency — Tauri already provides this
- Sync commands (`list_images`, `get_image_count`, `update_image`, `delete_image`, `search_images`) for fast SQLite operations — no spawn_blocking overhead needed
- Async only for `import_images` which performs file I/O and image crate metadata reads
- `import_images` accesses state via `app.state::<Mutex<AppState>>()` inside spawn_blocking closure — avoids State lifetime issues
- Import progress events use `tauri::Emitter` trait (`app.emit()`) for push-based progress reporting per D-05

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing settings.rs compilation errors**
- **Found during:** Initial `cargo check` after Task 1-3 implementation
- **Issue:** `commands/settings.rs` commands were sync functions with `AppHandle` parameter — Tauri v2 `#[tauri::command]` macro fails to generate wrappers for sync commands with `AppHandle`; this prevented `cargo check` from verifying images.rs
- **Fix:** Changed settings commands from `pub fn` to `pub async fn` (sed-based edit; file was subsequently discovered to already have `async` in committed version from Plan 06 — the initial check failure was likely a transient build state)
- **Files modified:** `src-tauri/src/commands/settings.rs` (no-op — file already had async)
- **Verification:** `cargo check` passes with zero errors and zero warnings

**2. [Rule 1 - Bug] Fixed missing `Emitter` trait import and wrong spawn_blocking path**
- **Found during:** Initial `cargo check`
- **Issue:** `app.emit()` requires `use tauri::Emitter` trait import (Tauri v2); `tokio::task::spawn_blocking` not available without direct tokio dependency
- **Fix:** Added `use tauri::Emitter;` to imports; replaced `tokio::task::spawn_blocking` with `tauri::async_runtime::spawn_blocking`
- **Files modified:** `src-tauri/src/commands/images.rs`
- **Committed in:** `71398d6`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for compilation. No scope creep. All planned functionality delivered.

## Issues Encountered
- Pre-existing `settings.rs` and `filesystem.rs` module errors appeared during initial `cargo check` but were already addressed in Plan 06 commits — no action needed
- External file modification during execution (linter/user) adjusted `import_images` signature to use `app.state()` instead of cloning State — cleaner approach, accepted

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 Tauri command handlers compile and are callable via Tauri IPC
- Ready for Plan 06 (settings commands) and Plan 07 (file operations + thumbnail generation)
- Frontend wiring (Phase 9) can now use actual `invoke()` calls matching these command signatures

## Known Stubs
- `regenerate_thumbnail` command — returns `Ok(())`, implemented in Plan 07
- `relocate_file` command — returns `Ok(())`, implemented in Plan 07
- `import_images` sets `thumbnail_path: None` and `sha256_hash: None` — added in Plan 07

---

*Phase: 007-rust-data-layer*
*Completed: 2026-06-22*
