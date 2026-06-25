---
phase: 009
plan: 009-frontend-backend-connection
type: auto
autonomous: true
wave: 1
depends_on: [007-rust-data-layer, 008-python-ai-sidecar]
requirements: [FBC-01, FBC-02, FBC-03, FBC-04]
---

# Phase 009: Frontend-Backend Connection

## Objective
Replace all mock API stubs with real Tauri IPC invoke() calls. The Rust backend (Phase 007) is fully implemented with all Tauri commands. The frontend has isTauri() gating patterns with "Phase 9" placeholder comments ready to be filled in.

## Requirements
- **FBC-01**: Replace all mock API stubs with Tauri IPC invoke() calls
- **FBC-02**: Real file import via native folder picker dialog
- **FBC-03**: Settings read/write via Tauri store commands
- **FBC-04**: Image loading states — skeleton → real data, error fallback with retry

## Context
- `src/stores/app-store.ts` — contains Phase 9 placeholders in isTauri() branches
- `src/stores/settings-store.ts` — localStorage-based, needs Tauri store migration
- `src/components/DropZone.tsx` — has Phase 9 placeholder for file import
- `src/lib/api/images.ts` — mock API definitions (reference for types)
- `src/lib/tauri.ts` — isTauri() utility
- `src/App.tsx` — main app entry, already has loading/error states

## Tauri Commands Available (Phase 007, registered in lib.rs)
```
list_images(limit, offset) → Vec<ImageRecord>
import_images(paths) → ImportResult
update_image(id, payload) → ()
delete_image(id) → ()
search_images(query, limit, offset) → Vec<SearchResult>
get_image_count() → u32
get_setting(key) → String
set_setting(key, value) → ()
migrate_legacy_settings() → Json
reset_settings() → ()
open_folder_dialog() → Option<String>
```

## Backend ↔ Frontend Type Mapping
Rust ImageRecord (snake_case) maps to frontend Image (camelCase):
- `file_path` → `path`
- `file_size` (bytes) → `sizeKb` (÷1024)
- `thumbnail_path` → `thumbnail` (via convertFileSrc)
- `created_at` → `createdAt`
- `aspectRatio` → computed from width/height
- `analysis`, `score` → undefined (not from basic listing)

## Tasks

### Task 1: Update app-store.ts — replace mock data with Tauri IPC
**Type:** auto
**Files:** `src/stores/app-store.ts`
**Actions:**
- Add `convertFileSrc` import from `@tauri-apps/api/core` (dynamically imported inside isTauri branches)
- `loadImages()`: invoke `list_images` instead of generateMockImages(200), convert results
- `toggleFavorite(id)`: invoke `update_image` with `{ favorite: boolean }` payload
- `setRating(id, r)`: invoke `update_image` with `{ rating: number }` payload
- `deleteImage(id)`: invoke `delete_image`
- `importFolder(folderPath)`: invoke `import_images` with `{ paths: [folderPath] }`
- `openFolderDialog()`: invoke `open_folder_dialog`, then `import_images` with the selected path
- Add loading/error state management (set isLoading true before, false after, error on failure)
- In browser mode (not Tauri): keep existing mock behavior for dev
- Dynamic import pattern: `const { invoke } = await import('@tauri-apps/api/core')`

### Task 2: Update settings-store.ts — Tauri plugin-store
**Type:** auto
**Files:** `src/stores/settings-store.ts`
**Actions:**
- Replace imports from `@/lib/api/settings` (mock localStorage) with direct logic
- `getSetting()`: use `invoke("get_setting", { key })` when isTauri(), localStorage fallback
- `setSetting()`: use `invoke("set_setting", { key, value })` when isTauri(), localStorage fallback
- `loadSettings()`: call `invoke("migrate_legacy_settings", { oldSettings })` on first Tauri launch
- Fall back to localStorage in browser mode
- Dynamic import pattern for invoke

### Task 3: Update DropZone.tsx — real file import
**Type:** auto  
**Files:** `src/components/DropZone.tsx`
**Actions:**
- Fill in the isTauri() placeholder in handleFiles()
- When files are dropped: collect native file paths from Tauri webview drag event
- Invoke `import_images` with the selected file paths
- Handle ImportResult (progress, duplicates, errors)
- The mock import still runs in browser mode — keep existing behavior
- In Tauri mode: skip the mock import, use real import instead
- Listen for `import-progress` events and update a local progress state

### Task 4: Loading/error states (FBC-04)
**Type:** auto
**Files:** `src/pages/GalleryPage.tsx`, `src/App.tsx`
**Actions:**
- Verify loading state in GalleryPage shows properly while data fetches (already has isLoading check)
- Verify error state in App.tsx shows retry button (already has error boundary)
- Enhance GalleryPage with skeleton loading using existing Skeleton component
- Ensure the Skeleton component is used for gallery card placeholders during loading
- The `importFolder` and `openFolderDialog` functions should set loading state

## Verification
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Browser dev mode (`npm run dev`) still works with mock data
- [ ] All isTauri() branches are complete — no Phase 9 comments remain
- [ ] Dynamic imports prevent bundling errors in non-Tauri builds

## Threat Model
No new security surface introduced. Existing IPC commands are already registered in the Rust backend with input validation. The frontend changes only wire existing commands to UI actions.
