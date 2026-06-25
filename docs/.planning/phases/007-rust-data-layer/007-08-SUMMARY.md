---
phase: 007-rust-data-layer
plan: 08
subsystem: ui-elements
tags: [ui, i18n, settings, gallery, image-card, import, error-states]
requires:
  - 007-02 (isTauri utility, @tauri-apps/api installed)
provides:
  - ImportProgressBar component
  - DiskFullDialog component
  - GalleryEmptyState component
  - SettingsPage file size limit + restore defaults + open folder
  - ImageCard thumbnail failure + file missing overlays
  - 20+ new i18n keys (EN + ZH)
affects:
  - src/pages/SettingsPage.tsx
  - src/pages/GalleryPage.tsx
  - src/components/ImageCard.tsx
tech-stack:
  added: []
  patterns:
    - "Reused BatchEmbeddingBar visual pattern for ImportProgressBar"
    - "Dialog/Button from existing Radix UI component library"
    - "i18n interpolation via .replace() pattern matching existing code"
key-files:
  created:
    - src/components/ImportProgressBar.tsx
    - src/components/DiskFullDialog.tsx
    - src/components/GalleryEmptyState.tsx
  modified:
    - src/i18n/en.json
    - src/i18n/zh.json
    - src/stores/settings-store.ts
    - src/pages/SettingsPage.tsx
    - src/components/ImageCard.tsx
    - src/pages/GalleryPage.tsx
    - src/index.css
decisions:
  - "SettingsSection description prop made optional (File Size Limit section has its own inline description paragraph)"
  - "ImportProgressBar placed after BatchEmbeddingBar in GalleryPage toolbar area"
  - "GalleryEmptyState replaces legacy inline empty state; semantic search empty state preserved"
  - "Failure overlays suppress hover overlay + selection/favorite/rating interactions but allow detail panel open"
  - "All Phase 9 wiring (Tauri commands, events) deferred; components accept props and render correctly with defaults"
metrics:
  duration: 292s
  completed_date: 2026-06-22
---

# Plan 007-08: UI Elements Summary

One-liner: Added 3 new UI components (ImportProgressBar, DiskFullDialog, GalleryEmptyState), updated SettingsPage with file size limit and restore defaults, added ImageCard failure overlays, and added 20+ i18n keys in English and Chinese — all following 古卷·灯火 design system rules.

## Execution Summary

Executed all 3 tasks atomically with zero type errors. All new UI follows DESIGN.md color/typography/spacing rules (DM Sans for body, Noto Serif SC for headings, 200ms transitions, 4px/2px radii, no lucide-react icons, no pure black/white).

### Task 1: i18n Keys + Settings Store + SettingsPage

- Added `common`, `import`, `settings.data`, and `imageCard` i18n sections to both `en.json` and `zh.json` (20+ keys)
- `settings-store.ts`: Added `maxFileSizeMB` (default 200, clamped 1-500), `setMaxFileSizeMB`, `resetDefaults`, updated `loadSettings`
- `SettingsPage.tsx`: Added File Size Limit number input with range validation (blur clamping), Restore Defaults button with confirmation dialog, Open Folder button in Storage section
- Made `SettingsSection` description prop optional for sections with inline descriptions

### Task 2: ImportProgressBar + ImageCard Overlays

- `ImportProgressBar.tsx`: Reuses `BatchEmbeddingBar` visual pattern — progress bar track/fill with `bg-accent`, progress text with `tabular-nums`, cancel button
- `ImageCard.tsx`: Added `isThumbnailFailed` and `isFileMissing` optional props (default `false`). File-missing overlay (danger red) takes precedence over thumbnail-failure overlay (warning amber). Both suppress hover overlay, selection checkbox, favorite stamp, and rating row. Detail panel click-through preserved.
- `index.css`: Added `--color-warning-amber: #b8860b` to `@theme` block

### Task 3: DiskFullDialog + GalleryEmptyState + GalleryPage Integration

- `DiskFullDialog.tsx`: Reuses `Dialog`/`DialogContent` from Radix UI. Shows title (Noto Serif SC), body (DM Sans), Keep Imported (destructive) and Rollback All (outline) buttons. Interpolates `{kept}` and `{remaining}` counts.
- `GalleryEmptyState.tsx`: Two variants — `first-run` (import CTA) and `all-deleted` (no CTA). Decorative 卍 scroll motif, localized heading/body.
- `GalleryPage.tsx`: Added `importProgress` state (null by default). ImportProgressBar renders after BatchEmbeddingBar when import is active. Legacy inline empty state replaced with GalleryEmptyState.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Implementation Notes

1. **SettingsSection description prop**: Made optional (from required `string` to `string | undefined`). Required because the File Size Limit SettingsSection has its own inline description paragraph rather than using the built-in description prop. This is a minor API relaxation, not a behavioral deviation.

## Known Stubs

All stubs below are intentional Phase 9 wiring points per the plan's scope:

| Stub | File | Line | Phase 9 Action |
|------|------|------|----------------|
| `importProgress` state defaults to `null` | GalleryPage.tsx | ~84 | Wire to Tauri import progress events |
| Open Folder button no-op | SettingsPage.tsx | ~98 | Wire to `invoke("open_data_folder")` |
| Relocate button no-op | ImageCard.tsx | ~80 | Wire to `invoke("relocate_file", { id })` |
| Regenerate button no-op | ImageCard.tsx | ~97 | Wire to `invoke("regenerate_thumbnail", { id })` |
| `isThumbnailFailed` defaults to `false` | ImageCard.tsx | ~20 | Populate from Tauri IPC image metadata |
| `isFileMissing` defaults to `false` | ImageCard.tsx | ~20 | Populate from Tauri IPC image metadata |
| `addToast` skip notices not called | GalleryPage.tsx | — | Call after import completes with skip counts |
| DiskFullDialog not triggered | — | — | Trigger from Tauri disk-space event during import |

## Verification Results

- [x] `npx tsc --noEmit` — zero errors
- [x] `en.json` — valid JSON, all new keys present
- [x] `zh.json` — valid JSON, all new keys present
- [x] ImportProgressBar renders with progress bar, text, and cancel button
- [x] SettingsPage has file size limit input (1-500, default 200) with range clamping
- [x] SettingsPage has restore defaults button that opens confirmation dialog
- [x] SettingsPage storage section has open folder button
- [x] ImageCard has thumbnail failure overlay (warning-amber, Regenerate button)
- [x] ImageCard has file missing overlay (danger, Relocate button)
- [x] File missing overlay takes precedence over thumbnail failure
- [x] DiskFullDialog renders with Keep Imported / Rollback All buttons
- [x] GalleryEmptyState renders with scroll motif, heading, body, CTA
- [x] GalleryPage integrates ImportProgressBar in toolbar area
- [x] GalleryPage shows GalleryEmptyState when images array is empty
- [x] Settings store has maxFileSizeMB and resetDefaults
- [x] All new UI follows DESIGN.md (DM Sans/Noto Serif SC, warm colors, 200ms transitions, 4px/2px radii)
- [x] No lucide-react icons used in new components

## Commits

| Hash | Message |
|------|---------|
| `03d6ac9` | feat(007-08): add i18n keys, update settings store and SettingsPage |
| `0e433af` | feat(007-08): create ImportProgressBar and add failure overlays to ImageCard |
| `0dea996` | feat(007-08): create DiskFullDialog, GalleryEmptyState, update GalleryPage |

## Self-Check: PASSED

All 10 created/modified files confirmed present. All 3 commit hashes confirmed in git log.
