<!-- refreshed: 2026-06-21 -->
# Architecture

**Analysis Date:** 2026-06-21

## System Overview

```text
+------------------------------------------------------------------+
|                         App (App.tsx)                             |
|  <ErrorBoundary>  <I18nProvider>  <TooltipProvider>              |
+------------------------------------------------------------------+
|                     |                    |                        |
|              <Sidebar />           <main>                  <DetailPanel />
|              w-[200px]          view-switched            w-[320px] right
|              collapsible        pages inside              slide panel
|              to w-[60px]        renderPage()             conditional
+---------------------+------------------+------------------------+
|  State Management:  |  Global Overlays:|  UI Primitives:        |
|  useAppStore()      |  CommandPalette  |  components/ui/ (11)   |
|  useSettingsStore() |  DropZone        |  shadcn/ui style       |
|  (Zustand)          |  ExportDialog    |  Radix-based Dialog    |
|                     |                  |  Tooltip               |
+---------------------+------------------+------------------------+
        |                     |                     |
        v                     v                     v
  src/stores/           Zustand state          src/components/ui/
  app-store.ts          + mock-data.ts         button, card, dialog,
  settings-store.ts     + lib/api/             badge, input, tooltip,
                        mock stubs             dropdown-menu, tabs,
                                               skeleton, scroll-area,
                                               sheet, separator
```

## View-Based Navigation (No Router)

This project does NOT use react-router-dom for page routing despite having it as a dependency. Instead, it uses a **state-based view switching** approach:

- `useAppStore().view` holds the current view: `"gallery" | "curation" | "dashboard" | "settings" | "trash"`
- `App.tsx` has a `renderPage()` switch statement that renders the corresponding page component
- `Sidebar.tsx` calls `setView(item.id)` on nav clicks
- `CommandPalette.tsx` calls `setView()` for navigation commands

The `react-router-dom` package exists in `package.json` but no `<Router>`, `<Route>`, or `<Link>` components are imported anywhere in the codebase.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `App` | Root wrapper: ErrorBoundary, I18nProvider, TooltipProvider, layout shell | `src/App.tsx` |
| `AppContent` | View routing, loading state, error state, sidebar + main + panels | `src/App.tsx` (lines 15-81) |
| `Sidebar` | Navigation, search trigger, stats display, collapse toggle | `src/components/Sidebar.tsx` |
| `DetailPanel` | Right slide panel: image preview, rating, favorite, metadata, tags, analysis, scores, actions | `src/components/DetailPanel.tsx` |
| `CommandPalette` | Modal overlay: command search, keyboard shortcuts, image search, grouped results | `src/components/CommandPalette.tsx` |
| `ImageCard` | Gallery image card: thumbnail, hover rating/favorite, selection checkbox, plum flower rating SVG | `src/components/ImageCard.tsx` |
| `VirtualizedGrid` | react-window Grid wrapper for 100+ images, delegates to ImageCard per cell | `src/components/VirtualizedGrid.tsx` |
| `DropZone` | Full-screen drag-and-drop import overlay with simulated progress | `src/components/DropZone.tsx` |
| `ExportDialog` | Modal: export format selection, quality slider, destination, simulated progress | `src/components/ExportDialog.tsx` |
| `TagManager` | Modal: create/delete tags, color picker | `src/components/TagManager.tsx` |
| `TagFilterBar` | Gallery filter bar: tag chips with counts, toggle filter, clear all | `src/components/TagManager.tsx` (line 161+) |
| `ErrorBoundary` | Class component: catches render errors, shows fallback UI | `src/components/ErrorBoundary.tsx` |
| `PageErrorBoundary` | Wrapper around ErrorBoundary with page-specific fallback (reload) | `src/components/PageErrorBoundary.tsx` |
| `GalleryPage` | Main view: masonry/VirtualizedGrid, sort toolbar, tag filters, onboarding hint, keyboard nav | `src/pages/GalleryPage.tsx` |
| `DashboardPage` | Stats: total, favorites, ratings, formats, top tags — directory-style layout | `src/pages/DashboardPage.tsx` |
| `CurationPage` | Slide-by-slide curation: keep/maybe/reject decisions, counter stats | `src/pages/CurationPage.tsx` |
| `SettingsPage` | Tabbed settings: language, theme, grid columns, shortcuts reference, about | `src/pages/SettingsPage.tsx` |
| `TrashPage` | Empty-view placeholder for deleted images (no actual restore logic) | `src/pages/TrashPage.tsx` |

## Pattern Overview

**Overall:** State-based SPA (no URL routing), Zustand global state, shadcn/ui component primitives, React Context for i18n.

**Key Characteristics:**
- Single-page app with client-side view switching via Zustand store
- Two Zustand stores: `app-store` (images, selection, view, tags) and `settings-store` (language, theme, grid)
- All API calls are mock stubs (`src/lib/api/`) — the Tauri backend was removed
- Design system implemented in `src/index.css` via Tailwind CSS v4 `@theme` block
- Placed the project skills directory at `.claude/skills/` — UI process skill + design identity skill
- 11 shadcn/ui-style primitives in `components/ui/` — most are standard templates, some customized (card, dropdown-menu)
- Business components override UI primitives with project-specific Tailwind classes for the design system

## Layers

### Presentation Layer (Pages + Business Components)
- Purpose: Full page views rendered inside `<main>` based on `view` state
- Location: `src/pages/` (5 pages) + `src/components/` (11 business components)
- Contains: All visual rendering, user interaction handlers
- Depends on: Zustand stores, UI primitives, i18n context, mock-data types
- Used by: `AppContent` in `App.tsx`

### State Management Layer
- Purpose: Global application state, all mutation logic
- Location: `src/stores/` (app-store.ts, settings-store.ts)
- Contains: Zustand stores with state, actions, async operations
- Depends on: mock-data types, API stubs
- Used by: All pages and business components

### Data / API Layer
- Purpose: Data access and external API abstraction (currently all stubs)
- Location: `src/lib/api/` (images.ts, settings.ts)
- Contains: Async functions returning mock/stub data
- Depends on: localStorage (settings), nothing (images — all noop)
- Used by: app-store.ts (indirectly, via `isTauri()` checks)

### Utility / Infra Layer
- Purpose: Shared utilities, i18n, mock data generation
- Location: `src/lib/` (utils.ts, i18n.tsx, mock-data.ts)
- Contains: cn() helper, I18nProvider Context, mock image generation
- Depends on: clsx, tailwind-merge, i18n JSON files
- Used by: Everything

### UI Primitive Layer
- Purpose: Reusable, composable, unstyled/styled base components (shadcn/ui pattern)
- Location: `src/components/ui/` (11 files)
- Contains: Button, Card, Dialog, Badge, Input, Tooltip, DropdownMenu, Tabs, Skeleton, ScrollArea, Sheet, Separator
- Depends on: @radix-ui/react-dialog, @radix-ui/react-tooltip, class-variance-authority
- Used by: Pages and business components

### Design Identity Layer
- Purpose: Global theme tokens, fonts, scrollbar, selection, focus styles
- Location: `src/index.css`
- Contains: Tailwind CSS v4 `@theme` block with custom colors, shadows, radii, fonts

## Data Flow

### Primary Request Path (App Load)

1. `src/main.tsx:6` — `createRoot` renders `<App />` inside `<StrictMode>`
2. `src/App.tsx:83-92` — `App` wraps `AppContent` in ErrorBoundary > I18nProvider > TooltipProvider
3. `src/App.tsx:18-20` — `AppContent` calls `loadImages()` on mount via `useEffect`
4. `src/stores/app-store.ts:155-165` — `loadImages()` checks `isTauri()` (always false now), otherwise noop. Initial state uses `generateMockImages(200)` from `src/lib/mock-data.ts:93`
5. `src/App.tsx:22-36` — `renderPage()` switches on `view` state, renders the active page
6. Pages read `useAppStore()` via Zustand selectors, render filtered/sorted images

### User Interaction Flow (Gallery Click)

1. User clicks an image card
2. `ImageCard.tsx:55` — `onClick` calls `setDetailImage(image)` from `useAppStore`
3. `src/stores/app-store.ts:104` — `detailImage` state is set
4. `src/App.tsx:77` — `{detailImage && <DetailPanel />}` renders the right panel
5. `DetailPanel.tsx:35` — reads `detailImage` from store, renders metadata, tags, scores

### Keyboard Navigation Flow (Gallery)

1. `GalleryPage.tsx:130-133` — `window.addEventListener("keydown", handleKeyDown)`
2. Arrow keys move `focusedIndex`, Enter opens detail, Space toggles select, Delete removes
3. `FocusedIndex` stored in `app-store.ts:106`, components react to changes

### Command Palette Flow (Cmd+K)

1. `CommandPalette.tsx:148-164` — global `keydown` listener intercepts `Ctrl/Cmd+K`
2. Palette toggles visibility (`open` state)
3. Commands defined as a `useMemo` array (`CommandPalette.tsx:77-94`) covering navigation, import/export, selection, sort
4. Each command dispatches to store actions or `window.dispatchEvent()` for cross-component communication
5. Search debounce (300ms) queries `searchImages()` from API stubs (`src/lib/api/images.ts:36`)

### Cross-Component Communication Pattern

Several components use `window.dispatchEvent()` as an event bus for decoupled communication:

| Event Name | Dispatcher | Listener |
|------------|-----------|----------|
| `open-command-palette` | Sidebar search button | CommandPalette |
| `open-import` | Gallery empty state button | DropZone |
| `export-selected` | Gallery toolbar, CommandPalette | GalleryPage (sets exportOpen) |
| `add-tag-selected` | CommandPalette | (unused — no listener found) |

**State Management:**
- Zustand is the single source of truth for application state
- `useAppStore()` is directly imported and used by: App.tsx, Sidebar, DetailPanel, CommandPalette, ImageCard, DropZone, ExportDialog, TagManager, GalleryPage, DashboardPage, CurationPage
- `useSettingsStore()` is used by: SettingsPage
- No React Context for app state — only for i18n and tooltip
- State mutations are optimistic (local state updates immediately, Tauri API calls fire-and-forget)

## Key Abstractions

### Image Type
- Purpose: Core data model representing an image asset
- Defined in: `src/lib/mock-data.ts:31-52`
- Fields: id, path, thumbnail, width, height, sizeKb, format, rating, favorite, tags, createdAt, aspectRatio, analysis (optional), score (optional)
- The `analysis` field has a nested structure: subject, style, composition, visual, generation (with prompt, model, sampler, steps, cfg_scale)
- The `score` field is a flat object: composition, technical, subject, style, color, novelty (all numbers)

### ImageRecord (API Type)
- Purpose: Database record shape for Tauri backend
- Defined in: `src/lib/api/images.ts:2-14`
- Mirrors Image but with snake_case keys (file_path, file_name, file_size, created_at)
- Conversion function `recordToImage()` in `app-store.ts:7-21`

### App Store (useAppStore)
- Purpose: Central application state and mutations
- Defined in: `src/stores/app-store.ts:24-57` (interface), `src/stores/app-store.ts:59-191` (implementation)
- Key state: images[], view, selectedIds, searchQuery, sortBy, detailImage, focusedIndex, tags[], activeTagFilters, isLoading, error
- Key actions: setView, toggleSelect, toggleFavorite, setRating, deleteImage, loadImages, getFilteredImages

### Settings Store (useSettingsStore)
- Purpose: User preferences persisted to localStorage
- Defined in: `src/stores/settings-store.ts:4-12` (interface), `src/stores/settings-store.ts:14-45` (implementation)
- State: language, theme, gridColumns
- Actions: loadSettings, setLanguage, setTheme, setGridColumns

### I18n Provider
- Purpose: Internationalization via React Context
- Defined in: `src/lib/i18n.tsx`
- Locale detection: localStorage then navigator.language
- Translation function `t()` supports dot-notation nested key lookup
- Translation files: `src/i18n/en.json` (211 lines), `src/i18n/zh.json`

### PlumFlower SVG
- Purpose: Rating display component (梅花印 — plum blossom stamp)
- Defined in: `src/components/DetailPanel.tsx:14-31` and duplicated in `src/components/ImageCard.tsx:6-29`
- 5-petal flower with central circle, uses CSS variable `var(--color-accent)` for filled state
- Pattern: Inline SVG, 18x18 viewBox, rotates ellipse petals at 0, 72, 144, 216, 288 degrees

### cn() Utility
- Purpose: Class name merging with Tailwind conflict resolution
- Defined in: `src/lib/utils.ts:4-6`
- Composes: clsx + tailwind-merge
- Pattern: `cn("base classes", conditional && "conditional classes", className)`

## Entry Points

### HTML Entry
- Location: `index.html` (root of project)
- Mounts to: `<div id="root"></div>`
- Script: `src/main.tsx`

### Application Entry
- Location: `src/main.tsx`
- Triggers: Browser DOM ready
- Responsibilities: Render `<App />` in StrictMode

## Architectural Constraints

- **Threading:** Single-threaded browser event loop. No Web Workers. All async operations are Promises that resolve immediately (mock stubs) or access localStorage synchronously.
- **Global state:** Two Zustand singletons (`useAppStore`, `useSettingsStore`) accessible from any component. Both use `create()` at module level — state is created eagerly on import.
- **Circular imports:** Not detected. All imports follow a tree structure: components -> stores -> lib. No components import each other except through the App.tsx composition layer.
- **CSS approach:** Tailwind CSS v4 with `@theme` block in `src/index.css`. No CSS modules, no styled-components, no separate CSS files per component. All styles are inline Tailwind classes or global theme tokens.
- **Tauri dependency:** The codebase retains Tauri-related conditional logic but the Tauri backend was removed (commit `141182b`). The `isTauri()` function (imported from `@tauri-apps/api/core`) is referenced but does not exist. All `isTauri()` branches are effectively dead code.
- **No URL state:** View selection does not affect the URL. Bookmarking, back/forward, and deep-linking do not work because there are no routes.

## Anti-Patterns

### Missing isTauri() Import

**What happens:** `app-store.ts` and `DropZone.tsx` call `isTauri()` to gate backend operations, but `isTauri` is never imported — it is referenced as a bare function call that will throw `ReferenceError: isTauri is not defined` at runtime.
**Why it's wrong:** The Tauri backend was removed but the guard pattern was not cleaned up — references in `src/stores/app-store.ts:71,80,92,156,167,177` and `src/components/DropZone.tsx:127,139` are broken.
**Do this instead:** Either remove all `isTauri()` branches, or import and implement a detection function that reliably returns `false`. The gallery currently works only because the Zustand initializer sets `images` to `generateMockImages(200)` and `loadImages()` `return`s early when `isTauri()` evaluates to falsy.

### handleClick Dead Code

**What happens:** `DropZone.tsx:138-143` — `handleClick` has a branch:
```
if (false) { // Tauri removed
  openFolderDialog()
}
```
The entire function body is unreachable dead code. The handler is assigned to `onClick` on the drop zone div but does nothing.
**Why it's wrong:** Literal dead code. The comment "Tauri removed" signals intent but the cleanup is incomplete.
**Do this instead:** Remove the `handleClick` callback entirely, or wrap with a proper feature flag that can be toggled.

### Duplicated PlumFlower Component

**What happens:** The `PlumFlower` SVG component is defined in two files: `src/components/DetailPanel.tsx:14-31` and `src/components/ImageCard.tsx:6-29`. Both copies are nearly identical but with slight differences (ImageCard version has an extra overlapping circle at line 25).
**Why it's wrong:** If the plum flower design changes, both copies must be updated. They are already diverging.
**Do this instead:** Extract to `src/components/ui/plum-flower.tsx` and import in both places.

### Simulated Progress with setInterval

**What happens:** Both `DropZone.tsx` (lines 95-115) and `ExportDialog.tsx` (lines 52-66) use `setInterval` to simulate import/export progress. The intervals tick at hardcoded rates (200ms, 120ms) and update progress state without performing any actual work.
**Why it's wrong:** These are UI-only simulations. When real backend operations are added, this pattern must be replaced with actual progress events. The `setInterval`/`clearInterval` cleanup via `useEffect` return is fragile — if the component unmounts quickly, the interval could reference stale state.
**Do this instead:** When a real backend exists, use actual progress callbacks or WebSocket events. Remove the simulation intervals entirely.

### Mock Data Hardcoded to 200

**What happens:** `app-store.ts:60` initializes `images` to `generateMockImages(200)`. The 200 is hardcoded and cannot be changed without editing source code.
**Why it's wrong:** Development and testing flexibility is limited. The mock count is also not configurable from settings.
**Do this instead:** Make the mock count configurable via an environment variable or settings store, with a reasonable default.

### react-router-dom Unused

**What happens:** `react-router-dom` v7.17.0 is listed in `package.json` dependencies but never imported anywhere in the codebase. The app uses state-based view switching instead.
**Why it's wrong:** Dead dependency adds to bundle size and install time with zero benefit.
**Do this instead:** Remove from package.json, or adopt it for proper URL-based routing if deep-linking is desired.

## Error Handling

**Strategy:** Dual-layer error boundary + inline error state.

**Patterns:**
- **Top-level ErrorBoundary** (`src/components/ErrorBoundary.tsx`): Class component wrapping the entire app in `App.tsx:84`. Catches any unhandled render error and shows a "此处尚有未竟之事" fallback with a retry button that resets state.
- **Page-level PageErrorBoundary** (`src/components/PageErrorBoundary.tsx`): Wraps each page inside `<ErrorBoundary>` with a page-specific fallback that reloads the window.
- **Store-level error state:** `app-store.ts` has `error: string | null` state and `isLoading: boolean`. `App.tsx:62-72` renders error message + retry button when `error` is set.
- **API error handling:** All async operations in the store use try/catch with `console.error` logging and state rollback (e.g., `toggleFavorite` reverts the optimistic update on failure).
- **No global error boundary for async errors:** Zustand async operations that throw will only catch in the store's own try/catch. React render errors bubble to ErrorBoundary.

## Cross-Cutting Concerns

**Logging:** `console.error()` only — used in store catch blocks. No structured logging library.

**Validation:** Minimal. Tag names are trimmed and checked for duplicates in `TagManager.tsx:44-49`. No form validation libraries (zod, yup) are used.

**Authentication:** Not applicable — pure frontend, no auth.

**Accessibility:**
- `<a>` skip-to-content link in `App.tsx:42-46` with `sr-only` class
- `aria-label` on `<aside>`, `<nav>`, `<main>`, buttons throughout
- `role="main"`, `role="button"` on interactive elements
- Keyboard navigation in GalleryPage (arrow keys, Enter, Space, Delete, Escape) and CommandPalette (arrow keys, Enter, Escape)
- `kbd` elements for keyboard shortcut hints
- Images have descriptive alt text via template literals
- Focus-visible styles defined in `index.css:88-92`
- `prefers-reduced-motion` media query in `index.css:100-102`
- Semantic HTML: `<aside>`, `<nav>`, `<main>`, `<h1>`-`<h6>`

---

*Architecture analysis: 2026-06-21*
