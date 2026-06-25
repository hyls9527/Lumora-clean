# Phase 002: 古卷·灯火 — Full UI Rewrite

## Domain
Rewrite Lumora's entire UI from "warm white" to "古卷·灯火" (Ancient Manuscript · Lamplight).
Goal: 8-9/10 design quality. Sacred, poetic, legendary feel.

## Decisions
- Color: ivory paper (#f2ede4) + ground ink (#2a2118) + patina gold (#8b6914)
- Typography: Noto Serif SC (titles) + DM Sans (body)
- Shadows: warm brown tones, not cool gray
- Layout: masonry grid (varying heights), generous margins (40px)
- Sidebar: narrow (200px), gold line decoration, serif nav items
- Rating: dots (●○○○○) not stars
- Favorite: stamp (◆) not heart
- Sort: underline not pill
- Toolbar: text not icons
- Transitions: 200ms ease-out (not 100ms)
- Card radius: 6px (not 12px)
- No image hover scale (too playful)
- Paper texture overlay (SVG noise)

## Deferred
- Tauri backend (Phase 0.2)
- Real image loading (Phase 0.2)
- Virtual scrolling for large grids (Phase 0.3)
