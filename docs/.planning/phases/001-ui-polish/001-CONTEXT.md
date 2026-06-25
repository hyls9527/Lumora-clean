# Phase 001: UI Polish - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

## Phase Boundary

Align all frontend components with the 古卷·灯火 design language as defined in DESIGN.md. Fix design system deviations, eliminate anti-patterns, clean up Tauri migration debt, and ensure visual consistency across the full component tree.

DESIGN.md is the single authoritative design specification. All previous CONTEXT.md decisions that conflict with DESIGN.md are superseded.

## Implementation Decisions

### Design Specification Authority
- **D-01:** DESIGN.md is the sole authoritative design spec. All values (transitions, spacing, shadows, radii) flow from DESIGN.md — not from prior CONTEXT.md or external references.
- **D-02:** Transition timing: 200ms ease-out on all interactive elements. Never 100ms.
- **D-03:** Sidebar width: 200px (matching DESIGN.md "书脊" specification).
- **D-04:** Shadow system: DESIGN.md 3-layer system (shadow-card → shadow-card-hover → shadow-elevated). No 4-layer "Notion-style" system — that reference file does not exist.

### Anti-Pattern Cleanup
- **D-05:** Replace all lucide-react icons in DetailPanel.tsx with plain text labels: X→关闭, Copy→复制路径, Trash2→删除, Tag→标签, Maximize2→全屏. DESIGN.md explicitly bans lucide-react icons for navigation and actions.
- **D-06:** Remove `hover:scale-[1.02]` from ImageCard.tsx. Replace with shadow-deepening only (shadow-card → shadow-card-hover on hover). DESIGN.md explicitly bans image hover scale.
- **D-07:** Extract PlumFlower SVG into a shared component at `src/components/ui/plum-flower.tsx`. Both DetailPanel.tsx and ImageCard.tsx currently have independent, diverging copies.

### Component Alignment Approach
- **D-08:** Audit depth: visual consistency check — verify each component uses correct design tokens (colors, fonts, spacing, radii, shadows). Fix obvious deviations. Not pixel-precise measurement.
- **D-09:** Audit scope: full tree (11 UI primitives + 10 business components + 5 pages).
- **D-10:** UI primitives (shadcn/ui base): keep as-is with minimal tweaks. Fix only specific deviations from DESIGN.md values. They are mostly correct (Button has 4px radius, Card has 2px radius, CVA variants in place).
- **D-11:** Spacing: when auditing, if a spacing value clearly falls outside DESIGN.md scale (4/8/12/16/20/24/32/48/64), correct to nearest scale value. Not a systematic replace-all.

### Migration Debt Cleanup
- **D-12:** Remove ALL `isTauri()` calls from app-store.ts (6 references) and DropZone.tsx. This function is never defined — code paths would throw ReferenceError at runtime. Delete Tauri-only conditional branches, keep only the mock/fallback path.
- **D-13:** Clean up other migration artifacts: remove unused `react-router-dom` dependency, remove fake progress bar logic from DropZone, remove TrashPage placeholder scaffolding, remove fake "实验性功能" labels from SettingsPage.

### Claude's Discretion
None — all areas discussed and decided by user.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `DESIGN.md` — Complete design identity: colors, typography, spacing, shadows, radii, transitions, component specs, anti-patterns. THE authoritative source.
- `CLAUDE.md` — Project rules, anti-patterns list, accessibility requirements, design language summary.
- `src/index.css` — Tailwind v4 `@theme` block with all CSS custom properties implementing DESIGN.md tokens.

### Codebase Knowledge
- `.planning/codebase/CONVENTIONS.md` — Naming, component patterns, Zustand patterns, styling approach, TypeScript conventions, import order, i18n usage.
- `.planning/codebase/STRUCTURE.md` — Full directory tree, file responsibilities, import dependency graph, where to add new code.
- `.planning/codebase/STACK.md` — Technology stack: React 19, Zustand 5, Tailwind CSS v4, Vite 8, Radix UI, CVA.

## Existing Code Insights

### Reusable Assets
- **11 shadcn/ui primitives** (`src/components/ui/`): Button (CVA variants), Card (compound pattern), Dialog (Radix-based), Badge, Input, Tooltip, DropdownMenu, Tabs, Skeleton, ScrollArea, Sheet, Separator.
- **cn() utility** (`src/lib/utils.ts`): clsx + tailwind-merge for conditional class merging.
- **CVA pattern** (`class-variance-authority`): Used in Button and Badge for variant-based styling.

### Established Patterns
- **Named exports**: All components use named function exports. Only App.tsx uses default export.
- **Zustand stores**: `useAppStore()` for image data/view state, `useSettingsStore()` for preferences. Direct store imports in components — no prop drilling.
- **i18n**: `useTranslation()` hook with dot-notation keys (`t("section.key")`). Two locales: en, zh.
- **PageErrorBoundary**: Every page wraps content in `PageErrorBoundary` which delegates to the class-based `ErrorBoundary`.
- **Props interfaces**: `ComponentNameProps` pattern with inline destructured typing.
- **State-based view switching**: `useAppStore().view` drives which page renders in App.tsx. No URL routing despite react-router-dom being installed.

### Integration Points
- **App.tsx**: Root layout shell + `renderPage()` view switch. Sidebar, DetailPanel, CommandPalette are siblings of the page area.
- **Sidebar.tsx**: Navigation items in `NAV_ITEMS` constant. Add new views here + in the `View` union type in app-store.ts.
- **src/index.css**: All design tokens live in the `@theme` block. Component styles reference these tokens via Tailwind utility classes.

## Specific Ideas

- PlumFlower shared component should support a `size` prop (at minimum 18x18 for cards, larger for detail panel).
- Text labels replacing lucide-react icons should use the existing `ActionButton` pattern from DetailPanel.tsx.
- Shadow tokens from DESIGN.md are already defined in `src/index.css` `@theme` block — components should use Tailwind shadow classes that map to these tokens.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 001-UI Polish*
*Context gathered: 2026-06-21*
