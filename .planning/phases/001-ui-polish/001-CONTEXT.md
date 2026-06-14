# Phase 001: UI Polish — Context

## Domain
Align all frontend components with the warm-white-design-system.md reference. This phase fixes design system deviations and polishes component quality.

## Decisions
- Shadow system upgraded from 2-layer to 4-layer Notion-style
- Transition timing changed from 150ms to 100ms (Linear-style)
- Sidebar width: 220px → 240px
- Image grid gap: 10px → 12px minimum
- Card padding: 16px → 24px minimum
- Add command palette (⌘K) with search functionality
- Add keyboard navigation for gallery

## Code Context
- **index.css**: `src/index.css` — @theme tokens, global styles
- **Sidebar**: `src/components/Sidebar.tsx` — 124 lines, navigation + stats
- **ImageCard**: `src/components/ImageCard.tsx` — 128 lines, thumbnail + hover
- **DetailPanel**: `src/components/DetailPanel.tsx` — 268 lines, right panel
- **GalleryPage**: `src/pages/GalleryPage.tsx` — 116 lines, grid layout
- **DashboardPage**: `src/pages/DashboardPage.tsx` — 213 lines, stats
- **app-store.ts**: `src/stores/app-store.ts` — 42 lines, Zustand store
- **DESIGN.md**: Project root — visual identity spec (outdated values)

## Specifics
- Reference values in `references/warm-white-design-system.md` (lumora-development skill)
- Use 4-layer shadows from the reference, not the 2-layer in DESIGN.md
- Use 100ms transitions, not 150ms
- Command palette: dialog with search input, filtered results, keyboard navigation
- Gallery keyboard: arrow keys navigate images, Enter opens detail, Space selects

## Deferred
- Tauri backend integration (Phase 0.2)
- Virtual scrolling (Phase 002)
- Drag-drop import (Phase 002)
- i18n new keys (will add as needed)
