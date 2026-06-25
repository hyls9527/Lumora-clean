---
phase: 009
plan: 009-frontend-backend-connection
subsystem: frontend-ipc
tags: [tauri, ipc, frontend-backend, store-migration]
requires: [007-rust-data-layer]
provides: [real-ipc-calls, tauri-store-settings, native-file-import]
affects: [app-store, settings-store, dropzone, gallery-page, settings-page]
tech-stack:
  added: []
  patterns: [dynamic-import-ipc, optimistic-ui-with-revert, snake-to-camel-conversion, skeleton-loading-grid]
key-files:
  created: []
  modified:
    - src/stores/app-store.ts
    - src/stores/settings-store.ts
    - src/components/DropZone.tsx
    - src/pages/GalleryPage.tsx
    - src/App.tsx
    - src/pages/SettingsPage.tsx
decisions:
  - Dynamic import of @tauri-apps/api/core inside isTauri() guards to avoid bundling errors in non-Tauri builds
  - Optimistic UI updates with revert pattern for toggleFavorite (fire-and-forget with undo on failure)
  - Snake_case to camelCase conversion function between Rust ImageRecord and frontend Image type
  - localStorage fallback for all settings in browser dev mode
  - Import reloads full image list after completion instead of incrementally merging results
metrics:
  duration: "~5 minutes"
  completed-date: "2026-06-22"
---

# Phase 009 Plan 009: Frontend-Backend Connection Summary

**One-liner:** Replaced all mock API stubs with real Tauri IPC invoke() calls using dynamic import guards, wired settings to plugin-store, and replaced simple loading text with skeleton grid.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Update app-store.ts | [9a92fd4] | loadImages, toggleFavorite, setRating, deleteImage, importFolder, openFolderDialog all call Tauri IPC via dynamic import. Added ImageRecord-to-Image conversion and computeAspectRatio helper. |
| 2 | Update settings-store.ts | [b8f5a1e] | readSetting/writeSetting use get_setting/set_setting IPC. loadSettings migrates localStorage to Tauri store on first launch. Removed dependency on @/lib/api/settings. |
| 3 | Update DropZone.tsx | [bee0895] | Tauri mode collects native file paths from drag events, calls import_images, handles ImportResult (imported/skipped/errors). Shows importing spinner overlay. Browser mode unchanged. |
| 4 | Loading/error states | [9fe3f14] + [d6acb09] | GalleryPage: skeleton card grid (12 varied-ratio placeholders) during load. App.tsx: error retry calls loadImages() instead of page reload. Wired GalleryEmptyState onImportClick and SettingsPage open_data_folder. |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

These backend commands exist as stubs returning `Ok(())` — their frontend wiring is deferred to future plans:

| Stub | File:Line | Backend Command | Status |
|------|-----------|-----------------|--------|
| File relocation UI | `src/components/ImageCard.tsx:69` | `relocate_file` | Stub in Phase 007 — returns Ok(()) with no implementation |
| Thumbnail regeneration UI | `src/components/ImageCard.tsx:89` | `regenerate_thumbnail` | Stub in Phase 007 — returns Ok(()) with no implementation |

## Design Decisions

1. **Dynamic import pattern:** `const { invoke, convertFileSrc } = await import("@tauri-apps/api/core")` inside isTauri() guards. This prevents Vite from failing to resolve `@tauri-apps/api/core` in browser-only dev builds.

2. **Optimistic UI with revert:** toggleFavorite updates Zustand state immediately, then fires invoke in background. On failure, it reverts the optimistic update. setRating and deleteImage are fire-and-forget since their UI state is simpler.

3. **Data refresh after import:** Both `importFolder` and `openFolderDialog` reload the full image list via `list_images` after import completes, ensuring the gallery shows all images including newly imported ones without manual merging.

4. **Skeleton loading:** GalleryPage now shows 12 skeleton cards (3 aspect ratio variants) instead of plain text, providing visual continuity between loading and loaded states.

## Verification

- [x] `npx tsc --noEmit` passes with zero errors
- [x] All core Phase 9 placeholders in app-store, settings-store, DropZone are wired
- [x] Dynamic imports prevent bundling errors in non-Tauri builds
- [x] Browser dev mode intact — all Tauri calls guarded by isTauri()

## Self-Check: PASSED
- SUMMARY.md: exists
- All 5 commits verified: 9a92fd4, b8f5a1e, bee0895, 9fe3f14, d6acb09
- All 6 modified files exist on disk
