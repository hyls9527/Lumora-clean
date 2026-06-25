---
phase: 001-ui-polish
plan: 01
type: execute
subsystem: UI primitives + design token alignment
tags: [lucide-removal, hover-scale, plum-flower, design-tokens, audit]
depends_on: []
completed: 2026-06-21
total_tasks: 3
total_files: 13
summary: "Eliminated lucide-react icons from DetailPanel and hover:scale from ImageCard; extracted PlumFlower into a shared UI primitive; audited all 12 shadcn/ui primitives to use DESIGN.md tokens, radii, shadows, and 200ms ease-out transitions exclusively."

tech-stack:
  added: []
  patterns:
    - "Shared SVG component with size prop (plum-flower.tsx)"
    - "Text-based action labels replacing icon libraries"
    - "DESIGN.md-only Tailwind token mapping (no shadcn generics)"

key-files:
  created:
    - src/components/ui/plum-flower.tsx
  modified:
    - src/components/DetailPanel.tsx
    - src/components/ImageCard.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/button.tsx
    - src/components/ui/card.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/input.tsx
    - src/components/ui/sheet.tsx
    - src/components/ui/skeleton.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/tooltip.tsx
  unaffected:
    - src/components/ui/scroll-area.tsx
    - src/components/ui/separator.tsx

decisions:
  - "D-01 affirmed: DESIGN.md is sole design authority — all values now flow from it"
  - "D-05 implemented: lucide-react icons replaced with Chinese text labels"
  - "D-06 implemented: all hover:scale transforms removed from ImageCard"
  - "D-07 implemented: PlumFlower extracted to shared component"
  - "D-08/D-09/D-10/D-11: 12 UI primitives audited — 10 modified, 2 already correct"

commits:
  - "2627460: feat(001-01): create shared PlumFlower component, remove lucide-react icons from DetailPanel"
  - "30193f0: feat(001-01): wire ImageCard to shared PlumFlower, remove all hover:scale transforms"
  - "17c4e58: refactor(001-01): audit and fix 10 UI primitives for DESIGN.md token alignment"
---

# Phase 001 Plan 01: Anti-Pattern Cleanup + UI Primitives Audit Summary

Extracted shared PlumFlower SVG component from duplicated inline definitions in DetailPanel and ImageCard, replaced all lucide-react icons with Chinese text labels, removed all hover:scale transforms from ImageCard, and aligned 10 of 12 UI primitives to use DESIGN.md tokens exclusively.

## Deviations from Plan

None — plan executed exactly as written. All token replacements, radius corrections, shadow fixes, and transition normalizations applied per the exact per-file instructions in PLAN.md.

## Verification Results

| Check | Result |
|-------|--------|
| lucide-react in DetailPanel.tsx | 0 matches |
| hover:scale in ImageCard.tsx | 0 matches |
| Inline PlumFlower in DetailPanel | 0 |
| Inline PlumFlower in ImageCard | 0 |
| Shared PlumFlower export | 1 |
| tsc --noEmit | 0 errors |
| npm run build | Built in 747ms |
| Shadcn generic tokens across all 12 primitives | 0 matches |
| Wrong durations (duration-300, duration-500, transition-colors) | 0 matches |
| Overlays using bg-black/80 | 0 matches |

## Token Replacement Summary

| Shadcn Token | DESIGN.md Replacement |
|---|---|
| bg-background, bg-card, bg-popover | bg-surface |
| bg-muted | bg-bg |
| bg-primary text-primary-foreground | bg-text text-surface |
| bg-secondary text-secondary-foreground | bg-surface text-text |
| bg-destructive text-destructive-foreground | bg-danger text-surface |
| text-foreground, text-card-foreground, text-popover-foreground | text-text |
| text-muted-foreground | text-text-muted |
| border-input | border-border |
| ring-ring | ring-accent/30 |
| ring-offset-background | ring-offset-surface |
| shadow-md, shadow-lg | shadow-elevated |
| bg-black/80 (overlays) | bg-text/80 |
| transition-colors | transition-all duration-200 ease-out |
| duration-300, duration-500 | duration-200 |
| ease-in-out | ease-out |

## Self-Check: PASSED

- All 13 files exist on disk
- All 3 commits (2627460, 30193f0, 17c4e58) present in git log
- TypeScript compiles with zero errors
- Vite production build succeeds
