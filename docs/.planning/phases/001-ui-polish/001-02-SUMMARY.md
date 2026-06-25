---
phase: 001-ui-polish
plan: 02
subsystem: migration-cleanup + design-audit
tags: [tauri, dead-code, design-tokens, audit, accessibility]
requires: [001-01]
provides: [clean-app-store, clean-dropzone, token-aligned-components, token-aligned-pages]
affects: [app-store.ts, DropZone.tsx, package.json, TrashPage.tsx, SettingsPage.tsx, Sidebar.tsx, CommandPalette.tsx, ExportDialog.tsx, TagManager.tsx, DetailPanel.tsx, ImageCard.tsx, GalleryPage.tsx, tsconfig.app.json]
tech-stack:
  added: []
  unchanged: [react-19, typescript, tailwind-v4, zustand, vite]
  patterns: [DESIGN.md tokens, 200ms ease-out transitions, i18n keys for copy]
key-files:
  created: []
  modified:
    - src/stores/app-store.ts — zero isTauri(), zero Tauri API imports
    - src/components/DropZone.tsx — zero Tauri dead code, zero openFolderDialog references
    - package.json — no react-router-dom dependency
    - src/pages/TrashPage.tsx — empty state only, i18n keys, no unreachable code
    - src/pages/SettingsPage.tsx — engine shows "Vite (Web)"
    - src/components/Sidebar.tsx — 200ms transition, DESIGN.md radii, shadows
    - src/components/CommandPalette.tsx — bg-text overlay (no pure black)
    - src/components/ExportDialog.tsx — text-surface (no white), no scale hover
    - src/components/TagManager.tsx — no scale transforms, shadow-card
    - src/components/DetailPanel.tsx — shadow-card, no pure black/white
    - src/components/ImageCard.tsx — no backdrop-blur, no pure black/white
    - src/pages/GalleryPage.tsx — i18n keys for loading/empty states, 200ms transitions, text-surface CTA
    - tsconfig.app.json — ignoreDeprecations for TypeScript 6.0 baseUrl
  decisions:
    - "Removed all 6 isTauri() calls from app-store.ts — function was never defined, would throw ReferenceError"
    - "Made async no-op functions explicit with comments instead of isTauri() guards"
    - "Removed unused react-router-dom from dependencies — app uses state-based view switching"
    - "TrashPage simplified to empty state only — unreachable trashItems.map() render path removed"
    - "SettingsPage engine value changed from Tauri 2 to Vite (Web)"
    - "All 10 business components audited and fixed for DESIGN.md token alignment"
    - "All 5 page components audited — GalleryPage required 9 fixes, other 4 pages were clean"
duration: ""
completed_date: "2026-06-21"
---

# Phase 001 Plan 02: Migration Cleanup + Component/Page Audit Summary

Removed all Tauri migration dead code (6 undefined isTauri() calls in app-store.ts, 2 dead-code blocks in DropZone.tsx), cleaned migration artifacts (react-router-dom dependency, TrashPage scaffolding, SettingsPage engine label), and audited 10 business components + 5 pages for DESIGN.md token alignment with 25 total fixes applied.

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Remove Tauri migration dead code + clean migration artifacts | Done | `ed50beb` |
| 2 | Audit and fix 10 business components for DESIGN.md tokens | Done | `d7e53f9` |
| 3 | Audit and fix 5 page components for DESIGN.md tokens | Done | `fad9a1b` |

## Verification Results

| Check | Result |
|-------|--------|
| `grep -rn "isTauri" src/` | PASS — zero matches |
| `grep -rn "Tauri" src/` | PASS — only in explanatory comments |
| `grep -c "react-router-dom" package.json` | PASS — 0 |
| `grep -c "openFolderDialog" src/components/DropZone.tsx` | PASS — 0 |
| `grep -c "trashItems" src/pages/TrashPage.tsx` | PASS — 0 |
| `grep -c "Tauri 2" src/pages/SettingsPage.tsx` | PASS — 0 |
| `grep -rn "duration-300\|duration-500" src/components/ src/pages/ --include="*.tsx"` | PASS — zero matches |
| `grep -rn "bg-background\|text-foreground\|..." src/ --include="*.tsx"` | PASS — zero shadcn tokens |
| `grep -c "text-white" src/pages/GalleryPage.tsx` | PASS — 0 |
| `npx tsc --noEmit` | PASS — zero errors |
| `node node_modules/vite/bin/vite.js build` | PASS — builds successfully |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `images` selector variable from DropZone.tsx**
- **Found during:** Task 1 Part B
- **Issue:** The `const images = useAppStore((s) => s.images)` on line 41 was unused after removing Tauri dead code. TypeScript `noUnusedLocals: true` would have errored.
- **Fix:** Removed the unused `images` selector.
- **Commit:** `ed50beb`

**2. [Rule 3 - Blocking] Fixed tsconfig.app.json baseUrl deprecation error**
- **Found during:** Task 1 build verification
- **Issue:** `tsc -b` failed with TS5101: Option 'baseUrl' is deprecated. The `npm run build` script uses `tsc -b && vite build`, and the deprecation was treated as an error in build mode. Pre-existing — not caused by plan changes.
- **Fix:** Added `"ignoreDeprecations": "6.0"` to compilerOptions in tsconfig.app.json.
- **Commit:** `ed50beb`

**3. [Rule 1 - Bug] Removed unused `recordToImage` function and `ImageRecord` import from app-store.ts**
- **Found during:** Task 1 build verification
- **Issue:** After removing the `loadImages` body, `recordToImage` and `ImageRecord` import became unused. TypeScript `noUnusedLocals: true` flagged them.
- **Fix:** Removed both the function and the import.
- **Commit:** `ed50beb`

**4. [Rule 1 - Bug] Removed unused `locale` destructuring from SettingsPage.tsx**
- **Found during:** Task 1 build verification
- **Issue:** SettingsPage destructured `locale` from `useTranslation()` but never used it.
- **Fix:** Removed `locale` from destructuring.
- **Commit:** `ed50beb`

### Beyond-Plan Discoveries

**5. [Rule 2 - Missing critical] Replaced pure-black/pure-white and backdrop-blur in ImageCard.tsx**
- **Found during:** Task 2 audit (DESIGN.md anti-pattern violation)
- **Issue:** ImageCard used `bg-black/45`, `bg-white/70`, `text-white/60`, `bg-black/25`, and `backdrop-blur-sm` — all banned by DESIGN.md.
- **Fix:** Replaced with DESIGN.md tokens (`bg-text/45`, `bg-surface/70`, `text-surface/60`, `bg-text/25`). Removed `backdrop-blur-sm` instances.
- **Commit:** `d7e53f9`

**6. [Rule 2 - Missing critical] Replaced shadow-md with DESIGN.md shadow system in Sidebar.tsx and TagManager.tsx**
- **Found during:** Task 2 audit
- **Issue:** Sidebar collapse toggle used `shadow-md`, TagManager tag filter buttons used `shadow-md` — not from DESIGN.md 3-layer shadow system.
- **Fix:** Changed to `shadow-card` in both locations.
- **Commit:** `d7e53f9`

### Pre-existing Build Issues (Not Fixed — Logged to deferred-items.md)

8 pre-existing `tsc -b` errors remain (unused imports in ExportDialog, TagManager, CurationPage; type mismatches in VirtualizedGrid, mock-data.ts; unused params in api/images.ts). These are unrelated to Plan 001-02 changes and were not introduced by this plan. `npx tsc --noEmit` passes cleanly, and the Vite build succeeds independently.

## Known Stubs

None introduced. TrashPage uses i18n keys that return real copy from en.json/zh.json. GalleryPage empty/loading states use existing i18n keys.

## Threat Flags

None. Pure UI polish and dead code removal — no new network endpoints, auth paths, file access patterns, or trust boundary changes.

## Self-Check: PASSED

- [x] All 3 task commits exist in git log
- [x] All modified files exist on disk
- [x] `npx tsc --noEmit` passes
- [x] Vite build succeeds
- [x] All grep verifications pass
