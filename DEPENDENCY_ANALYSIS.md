# Lumora Dependency Chain Analysis

Generated: 2026-06-30

---

## COMPLETE DEPENDENCY GRAPH

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 6 — UI (React Pages & Components)                             │
│                                                                     │
│  App.tsx ──► useSettingsStore, useCommandStore, useDragDrop          │
│  GalleryPage ──► useImageStore, useTrashStore, ImageCard, DetailModal│
│  FavoritesPage ──► useImageStore (images.filter favorite)            │
│  SearchPage ──► useImageStore, useSemanticSearchStore                │
│  TrashPage ──► useTrashStore                                         │
│  ImportPage ──► useImageStore                                        │
│  DashboardPage ──► getDashboardStats (API), useEmbeddingStore        │
│  ExportPage ──► useImageStore                                        │
│  SettingsPage ──► useSettingsStore                                   │
│  ImageCard ──► useImageStore, useTrashStore, useEmbeddingStore       │
│  AiAnalysisSection ──► useAiAnalysisStore                            │
│  SemanticSearchBar ──► useSemanticSearchStore                        │
└──────────────┬───────────────────────────────────────────────────────┘
               │ reads/writes
┌──────────────▼───────────────────────────────────────────────────────┐
│ Layer 5 — State (Zustand Stores)                                     │
│                                                                     │
│  imageStore ──► lib/api/images.ts, semanticCache.invalidateSemanticCache│
│  semanticSearchStore ──► lib/api/semantic.ts, semanticCache.ts        │
│  aiAnalysisStore ──► lib/api/ai.ts                                   │
│  embeddingStore ──► lib/api/embeddings.ts                            │
│  trashStore ──► lib/api/images.ts                                    │
│  settingsStore ──► invoke (direct)                                   │
│  commandStore ──► (no API deps, pure state)                          │
└──────────────┬───────────────────────────────────────────────────────┘
               │ calls
┌──────────────▼───────────────────────────────────────────────────────┐
│ Layer 4 — Frontend API                                               │
│                                                                     │
│  lib/api/images.ts ──► lib/tauri.ts (invoke)                         │
│  lib/api/semantic.ts ──► lib/tauri.ts (invoke)                       │
│  lib/api/semanticCache.ts ──► lib/tauri.ts (invoke), localStorage    │
│  lib/api/ai.ts ──► lib/tauri.ts (invoke)                             │
│  lib/api/embeddings.ts ──► lib/tauri.ts (invoke)                     │
│  lib/api/clip.ts ──► lib/tauri.ts (invoke)                           │
│  lib/api/batch.ts ──► lib/tauri.ts (invoke)                          │
└──────────────┬───────────────────────────────────────────────────────┘
               │ invoke()
┌──────────────▼───────────────────────────────────────────────────────┐
│ Layer 3 — Tauri Bridge                                               │
│                                                                     │
│  lib/tauri.ts ──► @tauri-apps/api/core (lazy)                        │
│  lib.rs ──► invoke_handler (registers 35 commands)                   │
│    ⚠ clip_embed_image_cmd and clip_embed_text_cmd NOT registered     │
└──────────────┬───────────────────────────────────────────────────────┘
               │ dispatches to
┌──────────────▼───────────────────────────────────────────────────────┐
│ Layer 1 — Rust Commands                                              │
│                                                                     │
│  images.rs ──► DbHandle, error, schema::types, row_to_record (pub)  │
│  tags.rs ──► DbHandle, error, schema::types, create_tag_impl (pub)  │
│  trash.rs ──► DbHandle, error, schema::types, images::row_to_record │
│  embeddings.rs ──► DbHandle, error (own EmbeddingInfo types)         │
│  ai.rs ──► DbHandle, error (own AnalysisResult types), reqwest      │
│  export.rs ──► DbHandle, error, schema::types, images::row_to_record│
│  dashboard.rs ──► DbHandle, error, schema::types, images::row_to_record│
│  settings.rs ──► error, tauri_plugin_store                           │
│  clip.rs ──► error, std::process::Command                            │
└──────────────┬───────────────────────────────────────────────────────┘
               │ uses
┌──────────────▼───────────────────────────────────────────────────────┐
│ Layer 2 — Shared                                                    │
│                                                                     │
│  error.rs ──► (standalone, From impls for rusqlite/io/reqwest/serde)│
│  row_to_record (images.rs) ──► rusqlite::Row → ImageRecord          │
│  row_to_tag (tags.rs, private fn) ──► rusqlite::Row → Tag           │
│  schema::types ──► serde (standalone type definitions)               │
└──────────────┬───────────────────────────────────────────────────────┘
               │ reads/writes
┌──────────────▼───────────────────────────────────────────────────────┐
│ Layer 0 — Database                                                   │
│                                                                     │
│  DbHandle (db/mod.rs) ──► rusqlite::Connection + Mutex               │
│  migrations.rs ──► schema.rs (SQL constants)                         │
│  schema.rs ──► images, image_tags, tags, embeddings,                 │
│               vec_embeddings, analysis_history tables                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## LAYER-BY-LAYER ANALYSIS

### Layer 0 — Database

**Dependencies**: None (foundation layer)

**What depends on it**: Every Rust command module via `DbHandle` state.

**Shared mutable state**:
- Single `Mutex<Connection>` wrapped in `DbHandle` — all commands serialize on this mutex
- WAL mode enabled for read concurrency, but writes are fully serialized

**Implicit coupling**:
- `images.deleted` column (INTEGER 0/1) used as soft-delete flag — referenced by `trash.rs`, `images.rs`, `dashboard.rs`
- `images.deleted_at` added in migration V3 — nullable, only set when `deleted = 1`
- FTS5 virtual table `images_fts` auto-synced via triggers — any direct SQL bypassing ORM would miss FTS updates
- `embeddings` table FK to `images(id)` — but `ON DELETE` not specified, relies on manual cascade in `trash.rs`

**Schema tables and their consumers**:
| Table | Readers | Writers |
|-------|---------|---------|
| `images` | images.rs, trash.rs, dashboard.rs, export.rs | images.rs, trash.rs |
| `tags` | tags.rs, dashboard.rs, export.rs | tags.rs |
| `image_tags` | tags.rs, dashboard.rs, export.rs | tags.rs, trash.rs |
| `embeddings` | embeddings.rs, dashboard.rs | embeddings.rs, trash.rs |
| `vec_embeddings` | embeddings.rs | embeddings.rs, trash.rs |
| `analysis_history` | ai.rs | ai.rs, trash.rs |
| `app_config` | migrations.rs | migrations.rs |

---

### Layer 1 — Rust Commands

#### images.rs
- **Imports**: `error`, `db::DbHandle`, `schema::types` (ImageRecord, PaginatedResult)
- **Exports**: `row_to_record` (pub fn, used by trash.rs, dashboard.rs, export.rs)
- **Commands**: `import_images`, `list_images`, `search_images`, `update_rating`, `toggle_favorite`
- **Internal helpers**: `scan_folder`, `walk_dir`, `file_hash`, `probe_*`, `insert_image`, `load_record`

#### tags.rs
- **Imports**: `error`, `db::DbHandle`, `schema::types` (Tag)
- **Exports**: `create_tag_impl` (pub fn), `add_tag_to_image_impl` (pub fn)
- **Commands**: `create_tag`, `list_tags`, `delete_tag`, `add_tag_to_image`, `remove_tag_from_image`, `get_image_tags`
- **Internal helpers**: `row_to_tag` (private fn)

#### trash.rs
- **Imports**: `error`, `db::DbHandle`, `schema::types` (PaginatedResult), `super::images::row_to_record`
- **Exports**: None (all internal)
- **Commands**: `soft_delete_image`, `restore_image`, `permanent_delete_image`, `list_trash`, `empty_trash`, `batch_soft_delete`, `batch_restore`, `batch_permanent_delete`, `batch_add_tag`, `batch_remove_tag`
- **Internal helpers**: `permanent_delete_tx` (used by permanent_delete_image + empty_trash + batch_permanent_delete), `permanent_delete_impl`

#### embeddings.rs
- **Imports**: `db::DbHandle`, `error`
- **Exports**: `upsert_embedding` (pub fn), `get_embedding_status_db`, `search_semantic_db`, `get_embedding_stats_db`
- **Commands**: `generate_embedding`, `get_embedding_status_cmd`, `search_semantic_cmd`, `get_embedding_stats_cmd`, `embed_text_cmd`, `generate_embedding_for_image_cmd`
- **External calls**: `http://localhost:11434/api/embed` (Ollama)

#### ai.rs
- **Imports**: `db::DbHandle`, `error`
- **Exports**: `store_analysis` (pub fn), `get_latest_analysis`, `get_analysis_history_db`
- **Commands**: `analyze_image_cmd`, `get_analysis_result_cmd`, `get_analysis_history_cmd`
- **External calls**: `http://localhost:11434/api/tags`, `http://localhost:11434/api/chat` (Ollama)

#### export.rs
- **Imports**: `error`, `db::DbHandle`, `schema::types` (ExportResult), `crate::commands::images::row_to_record`
- **Commands**: `export_images`

#### dashboard.rs
- **Imports**: `db::DbHandle`, `error`, `schema::types` (DashboardStats, etc.), `crate::commands::images::row_to_record`
- **Commands**: `get_dashboard_stats`

#### settings.rs
- **Imports**: `error`, `tauri_plugin_store::StoreExt`
- **Commands**: `get_setting`, `set_setting`
- **Note**: Uses Tauri plugin store (settings.json), NOT SQLite

#### clip.rs
- **Imports**: `error`
- **Exports**: `clip_embed_image`, `clip_embed_text` (pub fns)
- **Commands**: `clip_embed_image_cmd`, `clip_embed_text_cmd`
- **⚠ CRITICAL**: These commands are NOT registered in `lib.rs` invoke_handler!

---

### Layer 2 — Shared

**error.rs**:
- Used by all Rust command modules
- `AppError` enum with `Db`, `Io`, `NotFound`, `InvalidInput`, `External`, `Lock` variants
- `From` impls for `rusqlite::Error`, `std::io::Error`, `reqwest::Error`, `serde_json::Error`, `String`
- `AppResult<T> = Result<T, AppError>`

**row_to_record** (images.rs):
- `pub fn row_to_record` — converts `rusqlite::Row` → `ImageRecord`
- Used by: trash.rs, dashboard.rs, export.rs (cross-module dependency)
- If signature changes, 3 other modules break

**row_to_tag** (tags.rs):
- `fn row_to_tag` — private, only used within tags.rs
- NOT shared, safe

**schema::types**:
- Pure data types with serde derives
- Used by all command modules for return types

---

### Layer 3 — Tauri Bridge

**lib.rs**:
- Registers 35 commands in `invoke_handler`
- Manages `DbHandle` as Tauri managed state
- Plugins: `tauri_plugin_store`, `tauri_plugin_dialog`, `tauri_plugin_updater`, `tauri_plugin_log`

**lib/tauri.ts**:
- Lazy-loads `@tauri-apps/api/core` only when `__TAURI_INTERNALS__` detected
- Returns mock data in browser mode
- Wraps errors with Chinese user-friendly messages
- All frontend API modules go through this single `invoke` function

**tauri.conf.json CSP**:
```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' asset: https://asset.localhost;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' http://localhost:11434 https://github.com ipc: tauri:
```

---

### Layer 4 — Frontend API

**images.ts**:
- Imports: `lib/tauri.ts` (invoke), `stores/imageStore` (ImageRecord type)
- Handles: images CRUD, tags CRUD, trash CRUD, dashboard stats, export
- Converts Tauri camelCase → frontend ImageRecord via `toImageRecord()`
- Also exports `TagRecord`, `DashboardStats`, `ExportResult` types

**semantic.ts**:
- Imports: `lib/tauri.ts` (invoke)
- Two-step pipeline: `embed_text_cmd` → `search_semantic_cmd`
- Converts similarity from 0-1 to 0-100

**semanticCache.ts**:
- Imports: `lib/tauri.ts` (invoke)
- In-memory Map-based LRU cache with localStorage persistence
- TTL: 30 minutes, max 5MB, max 200 entries
- `CACHE_VALID_KEY = 'lumora:semantic-cache-valid'` — global validity flag
- Debounced persistence (300ms)

**ai.ts**:
- Imports: `lib/tauri.ts` (invoke)
- snake_case → camelCase conversion for Rust responses
- Handles: analyze_image_cmd, get_analysis_result_cmd, get_analysis_history_cmd

**embeddings.ts**:
- Imports: `lib/tauri.ts` (invoke)
- Mock fallback for browser mode
- Handles: get_embedding_status_cmd, get_embedding_stats_cmd, generate_embedding

**clip.ts**:
- Imports: `lib/tauri.ts` (invoke)
- Falls back to Ollama if CLIP sidecar fails
- ⚠ Calls `clip_embed_image_cmd` / `clip_embed_text_cmd` which aren't registered

**batch.ts**:
- Imports: `lib/tauri.ts` (invoke)
- Handles: batch_soft_delete, batch_restore, batch_permanent_delete, batch_add_tag, batch_remove_tag

---

### Layer 5 — State (Zustand Stores)

| Store | Imports from API | Used by Pages |
|-------|-----------------|---------------|
| `imageStore` | images.ts, semanticCache.invalidateSemanticCache | Gallery, Favorites, Search, Import, Export |
| `semanticSearchStore` | semantic.ts, semanticCache.ts | Search |
| `aiAnalysisStore` | ai.ts | DetailModal (AiAnalysisSection) |
| `embeddingStore` | embeddings.ts | Dashboard, ImageCard |
| `trashStore` | images.ts | Trash, Gallery (softDelete) |
| `settingsStore` | invoke (direct) | Settings, App |
| `commandStore` | none | App, CommandPalette |

---

### Layer 6 — UI Pages & Components

| Page/Component | Stores Used | API Calls |
|---------------|-------------|-----------|
| App.tsx | settingsStore, commandStore | — |
| GalleryPage | imageStore, trashStore | — |
| FavoritesPage | imageStore | — |
| SearchPage | imageStore, semanticSearchStore | — |
| TrashPage | trashStore | — |
| ImportPage | imageStore | — |
| DashboardPage | embeddingStore | getDashboardStats (direct API) |
| ExportPage | imageStore | — |
| SettingsPage | settingsStore | — |
| ImageCard | imageStore, trashStore, embeddingStore | — |
| AiAnalysisSection | aiAnalysisStore | — |
| SemanticSearchBar | semanticSearchStore | — |

---

## RISK ANALYSIS

### RISK 1: Shared Helper Functions (Rust)

| Helper | Defined In | Used By | Risk |
|--------|-----------|---------|------|
| `row_to_record` | images.rs (pub) | trash.rs, dashboard.rs, export.rs | ⚠ RISKY — Signature change breaks 3 modules |
| `permanent_delete_tx` | trash.rs (private) | trash.rs only | ✅ SAFE — private, single module |
| `permanent_delete_impl` | trash.rs (private) | trash.rs only | ✅ SAFE — private, single module |
| `create_tag_impl` | tags.rs (pub) | tags.rs (tests + command) | ✅ SAFE — only used internally |
| `add_tag_to_image_impl` | tags.rs (pub) | Not used externally | ✅ SAFE — dead code, unused export |

### RISK 2: Frontend Stores Sharing Data

| Shared Data | Writer | Readers | Risk |
|-------------|--------|---------|------|
| `imageStore.images` | imageStore (fetch, import) | GalleryPage, FavoritesPage, SearchPage, ExportPage | ⚠ RISKY — FavoritesPage filters from same array; stale if GalleryPage hasn't loaded |
| `imageStore.toggleFavorite` | GalleryPage, FavoritesPage (via ImageCard) | Both pages observe same images[] | ⚠ RISKY — Optimistic update on Gallery affects Favorites and vice versa |
| `imageStore.setRating` | GalleryPage, FavoritesPage (via ImageCard) | Both pages observe same images[] | ⚠ RISKY — Same as above |
| `trashStore.softDeleteImage` | GalleryPage (via ImageCard) | TrashPage (separate store fetch) | ✅ SAFE — Different stores, different fetches |
| `embeddingStore.statusMap` | embeddingStore | DashboardPage, ImageCard | ✅ SAFE — Read-only, fetch-on-demand |

### RISK 3: Semantic Cache Invalidation During In-Flight Search

**Scenario**: `invalidateSemanticCache()` is called (e.g., after image import) while `searchSemanticCached()` has an in-flight `invoke('embed_text_cmd')` call.

**Analysis**:
1. `invalidateSemanticCache()` clears the in-memory `Map` and sets `CACHE_VALID_KEY = 'false'`
2. An in-flight search that already got cache miss will proceed to call `embed_text_cmd` + `search_semantic_cmd`
3. After getting results, `setCachedResult()` is called, which:
   - Sets `CACHE_VALID_KEY = 'true'` (re-validates the cache)
   - Stores the results in the now-empty cache

**Risk**: ⚠ RISKY — The re-validated cache contains results from a query that may have been computed against stale data (before new images were imported). The `setCachedResult` at line 176 of semanticCache.ts unconditionally sets `CACHE_VALID_KEY = 'true'`, which re-enables the cache even though it was just invalidated. A search that started before the import but finishes after will:
1. Store results that don't include the newly imported images
2. Re-enable the cache flag, making subsequent searches return stale cached results

**Mitigation needed**: Check `isCacheValid()` in `setCachedResult` before re-enabling, or use a generation counter.

### RISK 4: Trash Cascade Delete vs Embedding Generation

**Scenario**: User triggers `empty_trash` while `generate_embedding_for_image_cmd` is running for an image about to be deleted.

**Analysis**:
1. Both commands acquire the same `Mutex<Connection>` via `db.conn().lock()`
2. They are **mutually exclusive** — one blocks until the other releases the lock
3. `permanent_delete_tx` deletes from: `image_tags`, `analysis_history`, `vec_embeddings`, `embeddings`, `images`
4. If embedding generation acquires lock first: it writes embedding, then trash deletes everything
5. If trash acquires lock first: it deletes the image, then embedding generation fails with FK violation or "image not found"

**Risk**: ✅ SAFE (data integrity) — The Mutex serializes access, preventing concurrent write corruption. However:
- ⚠ RISKY (UX) — If embedding runs first then trash deletes, the embedding work is wasted
- ⚠ RISKY (error handling) — `generate_embedding_for_image_cmd` will return an error after the image is deleted, but the error may not be surfaced cleanly to the user (it will be an `AppError::External` or `AppError::Db`)

### RISK 5: CSP Policy

**CSP Analysis**:
```
connect-src 'self' http://localhost:11434 https://github.com ipc: tauri:
```

| Resource | Allowed? | Notes |
|----------|----------|-------|
| Tauri IPC (`ipc:`, `tauri:`) | ✅ YES | Required for commands |
| Ollama API (`http://localhost:11434`) | ✅ YES | Required for AI/embedding |
| Google Fonts CSS | ✅ YES (style-src) | `https://fonts.googleapis.com` |
| Google Fonts files | ✅ YES (font-src) | `https://fonts.gstatic.com` |
| Asset protocol (`asset:`, `https://asset.localhost`) | ✅ YES | For local file serving |
| GitHub updater | ✅ YES | `https://github.com` |
| `'unsafe-inline'` for styles | ⚠ Present | Required for inline styles (all components use `style={}`) |

**Potential issue**: The CSP does NOT include `https://fonts.googleapis.com` in `connect-src`. Google Fonts CSS is loaded via `<link>` tags which uses `style-src`, but if any JS code tries to `fetch()` from Google Fonts, it would be blocked. This is likely fine since fonts are loaded via CSS `@import` or `<link>`.

**Verdict**: ✅ SAFE — CSP covers all needed resources.

### RISK 6: clip.rs Commands Not Registered

**Finding**: `clip_embed_image_cmd` and `clip_embed_text_cmd` are defined in `clip.rs` but NOT registered in `lib.rs` invoke_handler.

**Impact**: `lib/api/clip.ts` calls `invoke('clip_embed_image_cmd')` and `invoke('clip_embed_text_cmd')` — these will silently fail (Tauri returns error for unknown commands). The `clip.ts` frontend has fallback to Ollama `embed_text_cmd`, so it won't crash, but CLIP embeddings will never work.

**Risk**: ⚠ RISKY — Dead code path, CLIP feature is non-functional

### RISK 7: DB FK Without ON DELETE CASCADE

**Finding**: The `embeddings` table has `image_id TEXT PRIMARY KEY REFERENCES images(id)` but no `ON DELETE CASCADE`. Same for `analysis_history` and `image_tags`.

**Impact**: `trash.rs::permanent_delete_tx` manually cascades deletes in the correct order. But if any new code deletes from `images` without going through `permanent_delete_tx`, orphaned rows will remain.

**Risk**: ⚠ RISKY — Convention-based cascade, not enforced by DB constraints. Safe as long as all deletes go through `permanent_delete_tx`.

### RISK 8: Optimistic Updates Without Cross-Store Sync

**Scenario**: User favorites an image in GalleryPage, then navigates to FavoritesPage.

**Analysis**:
- `imageStore.toggleFavorite` does optimistic update on `images[]`
- FavoritesPage reads from the same `imageStore.images` and filters for `favorite === true`
- Since both use the same Zustand store, the optimistic update is immediately visible

**Risk**: ✅ SAFE — Same store, same state. Cross-page consistency is maintained by Zustand's single-source-of-truth pattern.

### RISK 9: Window.__droppedPaths Global State

**Finding**: `App.tsx` line 68 sets `window.__droppedPaths` for ImportPage to pick up.

**Risk**: ⚠ RISKY — Implicit coupling via window global. Not type-checked, fragile. If ImportPage is lazy-loaded and the `useEffect` that reads this runs before the state is set, drops could be lost.

---

## COMPLETE DEPENDENCY GRAPH (EDGES)

```
# Layer 0 → Layer 1 (DB → Commands)
DbHandle ──[SAFE]──► images.rs, tags.rs, trash.rs, embeddings.rs, ai.rs, export.rs, dashboard.rs
schema::* ──[SAFE]──► migrations.rs
schema::types ──[SAFE]──► images.rs, tags.rs, trash.rs, export.rs, dashboard.rs

# Layer 1 → Layer 1 (Cross-module Rust)
images::row_to_record ──[RISKY: signature change]──► trash.rs, dashboard.rs, export.rs
images::load_record ──[SAFE: private]──► images.rs only
tags::create_tag_impl ──[SAFE: pub but unused externally]──► tags.rs only
tags::add_tag_to_image_impl ──[SAFE: pub but unused externally]──► dead code

# Layer 1 → Layer 2 (Commands → Shared)
All commands ──[SAFE]──► error.rs (AppError, AppResult)

# Layer 1 → Layer 0 (Commands → DB, implicit via DbHandle)
trash::permanent_delete_tx ──[SAFE: manual cascade]──► images, image_tags, embeddings, vec_embeddings, analysis_history
embeddings::upsert_embedding ──[SAFE]──► embeddings, vec_embeddings

# Layer 3 → Layer 1 (Bridge → Commands)
lib.rs invoke_handler ──[SAFE]──► 35 registered commands
lib.rs ──[RISKY: missing clip commands]──► clip.rs NOT registered

# Layer 3 → Layer 3 (Bridge internal)
lib/tauri.ts ──[SAFE]──► @tauri-apps/api/core (lazy)

# Layer 4 → Layer 3 (API → Bridge)
images.ts, semantic.ts, semanticCache.ts, ai.ts, embeddings.ts, clip.ts, batch.ts ──[SAFE]──► lib/tauri.ts

# Layer 5 → Layer 4 (Stores → API)
imageStore ──[SAFE]──► images.ts
imageStore ──[RISKY: cross-module call]──► semanticCache.invalidateSemanticCache
semanticSearchStore ──[SAFE]──► semantic.ts, semanticCache.ts
aiAnalysisStore ──[SAFE]──► ai.ts
embeddingStore ──[SAFE]──► embeddings.ts
trashStore ──[SAFE]──► images.ts (trash API functions)
settingsStore ──[SAFE]──► invoke (direct)

# Layer 6 → Layer 5 (UI → Stores)
GalleryPage ──[SAFE]──► imageStore, trashStore
FavoritesPage ──[RISKY: same images[] as Gallery]──► imageStore
SearchPage ──[SAFE]──► imageStore, semanticSearchStore
TrashPage ──[SAFE]──► trashStore
ImportPage ──[SAFE]──► imageStore
DashboardPage ──[SAFE]──► embeddingStore, getDashboardStats API
ExportPage ──[SAFE]──► imageStore
SettingsPage ──[SAFE]──► settingsStore
ImageCard ──[RISKY: 3 stores]──► imageStore, trashStore, embeddingStore
AiAnalysisSection ──[SAFE]──► aiAnalysisStore

# Shared mutable state
SQLite DB ──[SAFE: Mutex serialized]──► all Rust commands
imageStore.images[] ──[RISKY: shared across Gallery, Favorites, Search, Export]──► 4+ pages
localStorage semanticCache ──[RISKY: stale after invalidation race]──► semanticSearchStore
window.__droppedPaths ──[RISKY: implicit global]──► App.tsx → ImportPage
```

---

## SUMMARY OF FINDINGS

### Critical Issues (2)
1. **clip.rs commands not registered** — `clip_embed_image_cmd` and `clip_embed_text_cmd` are dead code; frontend fallback masks the failure
2. **Semantic cache re-validation race** — `setCachedResult()` unconditionally sets `CACHE_VALID_KEY = 'true'` after invalidation, potentially serving stale results

### Moderate Risks (4)
3. **row_to_record cross-module dependency** — Signature change in images.rs breaks trash.rs, dashboard.rs, export.rs
4. **Manual cascade delete** — No `ON DELETE CASCADE` in DB schema; relies on `permanent_delete_tx` convention
5. **Trash vs embeddings race** — Mutex prevents corruption but wastes work; error UX is poor
6. **window.__droppedPaths** — Implicit global state for drag-drop, not type-safe

### Safe Patterns (7)
7. All commands serialize on single Mutex — no concurrent write corruption
8. Zustand stores provide single-source-of-truth — cross-page consistency is maintained
9. CSP policy covers all needed resources (Ollama, fonts, assets, GitHub)
10. `permanent_delete_tx` is private — no external callers can bypass cascade
11. `create_tag_impl` / `add_tag_to_image_impl` — pub but not actually used externally
12. Frontend API layer cleanly separates Tauri invocation from store logic
13. Mock fallback in `lib/tauri.ts` allows browser-mode development
