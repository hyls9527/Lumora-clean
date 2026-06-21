# Lumora

## What This Is

Lumora is an image curation and management tool with an ancient-manuscript aesthetic (古卷·灯火). Browse, search, rate (plum blossom stamps), favorite (diamond ◆), curate, and import image collections — all through a warm, parchment-toned interface.

## Core Value

A calming, beautiful image library that feels like browsing an ancient scroll — fast search, keyboard-driven navigation, and a consistent design language that never breaks.

## Current State

**v0.1 MVP shipped (2026-06-21)**
- Pure Vite + React 19 + TypeScript + Tailwind CSS v4 frontend
- 5 views: Gallery, Curation, Dashboard, Settings, Trash
- ⌘K command palette with local search
- Keyboard navigation throughout gallery
- Drag-and-drop image import with toast notifications
- Toast notification system (info/success/warning, 3s auto-dismiss)
- PlumFlower rating (梅花印 SVG), bookmark favorites (◆)
- i18n: English + Chinese
- DESIGN.md as single source of truth for 古卷·灯火 design language
- Build: zero TS errors, zero ESLint warnings, clean production bundle

## Requirements

### Validated
- ✓ Image gallery with virtualized grid — v0.1
- ✓ Command palette search (⌘K) with local filtering — v0.1
- ✓ Keyboard navigation (arrows, Enter, Space, F favorite) — v0.1
- ✓ Drag-and-drop image import with toast feedback — v0.1
- ✓ Rating (plum blossom 梅花印) and favoriting (◆) — v0.1
- ✓ Curation flow (keep/maybe/reject) — v0.1
- ✓ Settings (language toggle, shortcuts reference) — v0.1
- ✓ Full design system alignment (DESIGN.md) — v0.1
- ✓ Clean build: zero TS errors, zero ESLint warnings — v0.1

### Active
(None — awaiting next milestone definition)

### Out of Scope
- Real backend/persistence — mock data only (deferred to future)
- Tauri integration — removed (deferred to future)
- AI/CLIP/LLM features — v0.2
- Duplicate detection — v0.2
- Backup/restore — v0.2

## Context

- **Tech:** Vite 8 + React 19 + TypeScript 6 + Tailwind CSS v4 + Zustand 5
- **Design:** 古卷·灯火 — ivory #f2ede4, ink #2a2118, patina gold #7a5c12
- **Fonts:** Noto Serif SC (titles), DM Sans (body), JetBrains Mono (code)
- **State:** Zustand stores with mock data, localStorage for settings
- **No backend:** Pure static SPA, deployable to any static host

## Constraints
- **Tech stack:** Vite + React + TypeScript + Tailwind CSS v4
- **Design:** Must follow DESIGN.md — no lucide-react icons, no pure black/white, no hover scale, no pill buttons
- **Performance:** Single-page app, client-side rendering only
- **i18n:** Chinese + English required for all user-facing text

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| DESIGN.md as authoritative spec | Resolved CONTEXT.md vs CLAUDE.md vs external ref conflicts | ✓ Good |
| Remove Tauri/Rust backend | Simplified to pure frontend for v0.1 | ✓ Good |
| State-based view switching (no router) | Simple, no URL routing needed for desktop app | ✓ Good |
| Mock data for all images | No backend available; enables full UI development | — Pending real backend |
| 200ms transitions, 200px sidebar, 3-layer shadows | From DESIGN.md — consistent,克制 aesthetic | ✓ Good |

---
*Last updated: 2026-06-21 after v0.1-mvp milestone*
