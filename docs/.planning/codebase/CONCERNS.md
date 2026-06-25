# Codebase Concerns

**Analysis Date:** 2026-06-21

---

## Summary

The Lumora project was originally a Tauri + React desktop app. The Tauri/Rust backend was removed (commit `141182b`), leaving a pure Vite + React 19 + TypeScript frontend that relies entirely on mock data with no real persistence. Several cleanup items were missed, and the codebase now has a mix of mock-only functionality, dead code, and a fully simulated feature set.

---

## HIGH Severity

### 1. Undefined `isTauri()` Function -- Runtime ReferenceError

- **Issue:** `isTauri()` is called in 6 places in `src/stores/app-store.ts` (lines 71, 80, 92, 156, 167, 177) but is **never defined or imported** anywhere in the project. It is not a global injected by any Vite plugin, and there is no remaining `@tauri-apps/api` package.
- **Files:** `src/stores/app-store.ts`
- **Impact:** Any code path that evaluates these guards (e.g., `toggleFavorite`, `setRating`, `deleteImage`, `loadImages`, `importFolder`, `openFolderDialog`) will throw a `ReferenceError: isTauri is not defined` at runtime. Currently these paths are unreachable only because the mock data path runs first and the Tauri-guarded branches are inside `if (isTauri())` blocks -- but if `isTauri` is evaluated at all, the error occurs.
- **Fix approach:** Remove all `isTauri()` guard blocks and the Tauri-specific API calls within them. The `loadImages`, `importFolder`, and `openFolderDialog` functions should either be removed or rewritten to use a future backend interface. Alternatively, if a real backend will be reintroduced, define `isTauri` once (e.g., as `const isTauri = () => false` or via a proper feature flag).

### 2. Zero Test Coverage

- **Issue:** No test files exist in `src/`. No vitest.config.ts, jest.config.ts, or any test runner configuration is present. The `package.json` has no test script.
- **Files:** Entire `src/` directory (0 test files)
- **Impact:** All functionality is unverified. Mock data, store logic, component rendering, i18n key resolution, and keyboard handlers have no automated assertions. Any refactoring risks silent breakage.
- **Fix approach:** Add Vitest (already compatible with the Vite ecosystem). Create `vitest.config.ts`. Write at minimum:
  - Unit tests for `src/stores/app-store.ts` (filtering, sorting, selection logic)
  - Unit tests for `src/lib/i18n.tsx` (key resolution, locale switching, fallback)
  - Component smoke tests for major pages and UI components
  - The `src/lib/api/` layer is trivially mockable so integration tests can target store + mock API together.

### 3. All Data is Mock -- No Real Persistence

- **Issue:** The application starts with 200 hardcoded mock images (`generateMockImages(200)`) and all mutations (rating, favorite, delete) operate on in-memory Zustand state only. The settings store persists to `localStorage`, but image data is lost on every page refresh.
- **Files:** `src/stores/app-store.ts` (line 60: `images: generateMockImages(200)`), `src/lib/mock-data.ts`, `src/lib/api/images.ts` (all functions are no-ops returning `[]`, `0`, `null`)
- **Impact:** The application is effectively a demo. No user work survives a browser refresh. Adding a real backend later will require rewriting most of the store layer and API layer since the current mock `Image` type differs from the `ImageRecord` type expected by the API stubs.
- **Fix approach:** Define a backend-agnostic storage interface. Implement `localStorage`-backed persistence as an interim step (serialize the images array to localStorage on mutation). The `recordToImage()` adapter function in `app-store.ts` already exists and can bridge the gap between API types and UI types. Design the API layer with dependency injection so swapping mock/real is a one-line config change.

### 4. `lucide-react` Still Imported Despite Being an Anti-Pattern

- **Issue:** `lucide-react` is listed as a forbidden dependency in `CLAUDE.md` ("No lucide-react icons") and commit `d9b9af6` was titled "fix: remove lucide icons + add micro-interactions". Yet `lucide-react` remains in `package.json` as a dependency and is actively imported in 4 components.
- **Files:**
  - `src/components/CommandPalette.tsx` (line 22): imports 14 lucide icons
  - `src/components/DetailPanel.tsx` (line 10): imports `X, Copy, Trash2, Tag, Maximize2`
  - `src/components/ExportDialog.tsx` (line 11): imports `Download`
  - `src/components/TagManager.tsx` (line 15): imports `Plus, X, Hash`
- **Impact:** Design inconsistency -- the UI spec mandates pure text + custom SVG for icons (plum flowers, diamond stamps). Lucide icons use a different visual language (stroke-based, geometric) that clashes with the "古卷·灯火" design identity.
- **Fix approach:** Replace each lucide icon with a minimal inline SVG matching the design language. The `PlumFlower` component already demonstrates the pattern. For common actions (close, download, plus, trash), create reusable icon components in `src/components/ui/icons.tsx`. Then remove `lucide-react` from `package.json` and run `npm install` to prune.

---

## MEDIUM Severity

### 5. Duplicated `PlumFlower` Component

- **Issue:** The plum flower rating SVG is implemented identically in two files with minor differences.
- **Files:** `src/components/ImageCard.tsx` (lines 6-29) and `src/components/DetailPanel.tsx` (lines 14-31)
- **Impact:** Code duplication. Any design change to the plum flower rendering requires editing two files. The implementations have started to diverge slightly (ImageCard version has an extra inner circle at line 25).
- **Fix approach:** Extract `PlumFlower` into `src/components/ui/plum-flower.tsx` and import it in both places. Choose the DetailPanel version as canonical since it's cleaner.

### 6. Settings Page Shows Hardcoded Fake Data

- **Issue:** The Settings page displays fabricated information with no connection to reality.
- **Files:** `src/pages/SettingsPage.tsx`
  - Storage database: `"lumora.db"` (line 93) -- no such file exists
  - Storage size: `"24.5 MB"` (line 94) -- hardcoded
  - Storage location: `"D:\\Lumora\\data"` (line 95) -- hardcoded, Windows-only path
  - Engine: `"Tauri 2"` (line 177) -- removed
  - Version: `"0.1.0"` (line 176) -- hardcoded
- **Impact:** Misleading to users. The dark/light theme toggle has no CSS effect (only `light` and `dark` are offered but the Tailwind v4 theme has no dark variant classes). The grid columns setting (3/4/5) is stored but never consumed in `GalleryPage.tsx` (which uses a hardcoded `const COLS = 4`).
- **Fix approach:**
  - Remove storage info section entirely or make it conditional on backend availability.
  - Change "About" engine field to "Vite + React" or remove.
  - Wire the `gridColumns` setting to actually control the `COLS` constant in `GalleryPage.tsx`.
  - Implement a real theme toggle (add dark variant classes to `index.css` or use CSS custom property switching).

### 7. Export Feature is Fully Simulated

- **Issue:** The Export dialog (`src/components/ExportDialog.tsx`) shows a realistic UI with format selection, quality slider, and progress bar, but no actual export occurs. The `handleExport` callback (line 45) runs a `setInterval` that simulates progress for 2.4 seconds then closes the dialog without touching any files.
- **Files:** `src/components/ExportDialog.tsx` (lines 45-67)
- **Impact:** User-facing feature that does nothing. Creates false expectations. The simulation code (`setInterval`, progress state, format/quality state) is non-trivial and adds maintenance burden.
- **Fix approach:** Either implement real client-side export using `<a download>` with canvas conversion, or remove the Export dialog and show a "coming soon" indicator. The simulated progress infrastructure (200+ lines of state management) should not exist for a non-functional feature.

### 8. `ARCHITECTURE.md` is Completely Outdated

- **Issue:** `C:\Users\Admin\Desktop\Vibe coding\Lumora-clean\ARCHITECTURE.md` describes a Tauri 2 + Rust + SQLite architecture with Clean Architecture layers (`Commands → Domain ← Infra`), Rust type sharing, FTS5 search, ONNX CLIP embedding, and a `src-tauri/` directory. None of this exists. The file is 420 lines of obsolete documentation.
- **Impact:** Misleads developers about project structure. References to `cargo check`, `cargo test`, `rusqlite`, `jieba-rs` are meaningless. The architecture principles section (3.1-3.4) is now largely inapplicable.
- **Fix approach:** Rewrite to reflect the current pure-frontend architecture, or move to `.planning/archive/` and create a lightweight replacement.

### 9. `react-router-dom` is an Unused Dependency

- **Issue:** `react-router-dom@^7.17.0` is listed in `package.json` dependencies but is never imported anywhere in `src/`. The app uses a Zustand-based `view` state machine (`"gallery" | "curation" | "dashboard" | "trash" | "settings"`) for navigation instead of URL routing.
- **Files:** `package.json` (line 24), entire `src/` (0 imports)
- **Impact:** Adds unnecessary bundle weight (~30KB gzipped). Increases `node_modules` size and install time. May cause confusion about the intended routing approach if a developer tries to use it.
- **Fix approach:** Remove `react-router-dom` from `package.json` dependencies. If URL-based routing is desired later, re-add it with a deliberate migration plan.

### 10. Dead Tauri Code Blocks in DropZone

- **Issue:** `src/components/DropZone.tsx` contains two `if (false)` blocks explicitly commented as `// Tauri removed` (lines 127, 139). These blocks call `openFolderDialog()` which itself is a dead code path.
- **Files:** `src/components/DropZone.tsx` (lines 127-130, 138-141)
- **Impact:** Dead code that confuses readers. The `openFolderDialog` function is imported from the store but never actually called because the guards evaluate to `false`.
- **Fix approach:** Remove the `if (false)` blocks and the `openFolderDialog` import. The current drop-to-import behavior (simulating import progress) is the only active path and should be the sole logic.

### 11. Button Component Uses shadcn Default Tokens Not Matching Design System

- **Issue:** `src/components/ui/button.tsx` uses shadcn boilerplate CSS classes (`bg-primary`, `text-primary-foreground`, `bg-destructive`, `ring-offset-background`) that reference Tailwind v4 theme variables that do not exist in the Lumora design system defined in `src/index.css`. The Lumora theme defines tokens like `--color-accent`, `--color-text`, `--color-surface`, `--color-danger`, etc.
- **Files:** `src/components/ui/button.tsx` (lines 7-31)
- **Impact:** Buttons rendered with this component will have no styling from these classes since the CSS variables they reference are not defined. The `Button` component is used in `TagManager.tsx` (line 77, 147) which means the tag creation and close buttons may appear unstyled. The `cn()` utility will still apply any passed `className` prop, so inline-styled buttons work.
- **Fix approach:** Rewrite `buttonVariants` to use Lumora design tokens: `bg-accent` instead of `bg-primary`, `text-surface` instead of `text-primary-foreground`, `bg-danger/10` instead of `bg-destructive/90`, etc. Update the `cva` variants to match the 4px-radius "方章按钮" convention.

### 12. No Error Logging or Monitoring

- **Issue:** Error handling is limited to `console.error()` calls and a class-based `ErrorBoundary` that shows a "retry" button. There is no structured logging, no error aggregation, and no way to debug production issues.
- **Files:** `src/stores/app-store.ts` (console.error at lines 73, 82, 94, 162, 171, 184), `src/components/ErrorBoundary.tsx`
- **Impact:** Errors in production are invisible. The `ErrorBoundary` in `src/components/ErrorBoundary.tsx` catches render errors but does not log the error or its component stack (the `componentDidCatch` lifecycle method is not implemented).
- **Fix approach:** Add `componentDidCatch(error: Error, errorInfo: React.ErrorInfo)` to `ErrorBoundary` that logs the error details. Consider adding a lightweight logging utility that can be toggled between console and a future remote service.

---

## LOW Severity

### 13. `serve.py` -- Python Script in a JS Project

- **Issue:** `serve.py` is a Python HTTP server script for serving the `dist` directory with no-cache headers. It's unrelated to the main build toolchain.
- **Files:** `C:\Users\Admin\Desktop\Vibe coding\Lumora-clean\serve.py`
- **Impact:** Minor. No impact on the application itself. Requires Python to be installed for the workflow it supports.
- **Fix approach:** Remove or move to a `scripts/` directory with documentation.

### 14. `env.d.ts` is Empty

- **Issue:** `src/env.d.ts` contains only `interface Window {}`. It provides no type declarations for the environment.
- **Files:** `src/env.d.ts`
- **Impact:** Minor. If the `isTauri` function or other globals were declared here, it would at least prevent the TypeScript error for the undefined function. Currently offers no value.
- **Fix approach:** Either populate with relevant type declarations (import.meta.env, Vite client types are already included via tsconfig) or remove the file. The Vite client types (`"types": ["vite/client"]` in tsconfig.app.json) already cover the standard env.

### 15. Production Build Has Minification Disabled

- **Issue:** `vite.config.ts` sets `build: { minify: false }`.
- **Files:** `C:\Users\Admin\Desktop\Vibe coding\Lumora-clean\vite.config.ts` (line 19)
- **Impact:** Production bundles will be significantly larger than necessary. The `react-window` and `lucide-react` libraries alone will add considerable weight without minification.
- **Fix approach:** Remove `minify: false` or change to `minify: 'esbuild'` (default). If this was set for debugging, consider using source maps instead (`build: { sourcemap: true }`).

### 16. `components.json` Icon Library Conflict

- **Issue:** `components.json` specifies `"iconLibrary": "lucide"` (line 13), which contradicts the CLAUDE.md anti-pattern of "No lucide-react icons".
- **Files:** `C:\Users\Admin\Desktop\Vibe coding\Lumora-clean\components.json`
- **Impact:** Minor. This file is primarily used by the shadcn CLI for code generation. If the shadcn CLI is run, it may generate components that import from lucide-react.
- **Fix approach:** Change to `"iconLibrary": "none"` or remove the field. This prevents accidental lucide-react reintroduction.

### 17. `check-garbage.sh` -- Bash Script on Windows Project

- **Issue:** `check-garbage.sh` is a bash script that detects accidental shell error output in source files. It's a development utility, not a build artifact.
- **Files:** `C:\Users\Admin\Desktop\Vibe coding\Lumora-clean\check-garbage.sh`
- **Impact:** Minor. Acts as a linting utility. On Windows, requires Git Bash or WSL.
- **Fix approach:** Keep or move to `scripts/`. No action required unless it causes confusion.

### 18. Trash Page is a Placeholder

- **Issue:** `src/pages/TrashPage.tsx` declares `trashItems` as an empty hardcoded array (line 9). The UI is fully built with restore and empty-trash buttons, but there is no deleted-items state in the store -- `deleteImage` in the store permanently removes the image without archiving to trash.
- **Files:** `src/pages/TrashPage.tsx`, `src/stores/app-store.ts`
- **Impact:** The trash feature is non-functional. Deleted images are gone forever with no recovery path. The trash page always shows "回收站空空如也" (empty).
- **Fix approach:** Add a `deletedImages` array to the app store. Modify `deleteImage` to move images there instead of filtering them out. Add a `restoreImage` and `emptyTrash` action. Wire the TrashPage to the store.

### 19. Tailwind v4 Dark Theme Not Implemented

- **Issue:** Settings page offers a "light/dark" theme toggle, but `src/index.css` defines only light-mode colors. There are no `@media (prefers-color-scheme: dark)` overrides and no `.dark` class-based variants.
- **Files:** `src/index.css`, `src/pages/SettingsPage.tsx`, `src/stores/settings-store.ts`
- **Impact:** The theme toggle has no visual effect. The setting is persisted to localStorage but never consumed by any CSS.
- **Fix approach:** Add dark-mode color overrides in `index.css` using a `.dark` class on `<html>`. Apply the class based on the `theme` setting from `settings-store`. This is a straightforward CSS + one-line JS addition.

### 20. Grid Columns Setting Not Wired to Gallery

- **Issue:** The settings store saves `gridColumns` (3/4/5) to localStorage, but `GalleryPage.tsx` uses a hardcoded `const COLS = 4` (line 14).
- **Files:** `src/pages/GalleryPage.tsx` (line 14), `src/stores/settings-store.ts` (lines 7, 41-43)
- **Impact:** The grid columns setting has no effect. Users can change it in Settings but the gallery always renders 4 columns.
- **Fix approach:** Import `useSettingsStore` in `GalleryPage.tsx` and use `gridColumns` instead of the `COLS` constant.

### 21. Hardcoded Chinese Text Outside i18n

- **Issue:** Several components contain hardcoded Chinese strings that bypass the i18n system.
- **Files:**
  - `src/App.tsx` (line 46): `"跳到主内容"` (skip navigation link)
  - `src/App.tsx` (line 58): `"研墨中…"` (loading text)
  - `src/App.tsx` (line 69): `"重试"` (retry button)
  - `src/pages/GalleryPage.tsx` (lines 224-235): onboarding message, button text
  - `src/pages/GalleryPage.tsx` (lines 254-265): empty state text
  - `src/pages/CurationPage.tsx` (lines 102-106): empty state text
  - `src/pages/DashboardPage.tsx` (lines 55-59): empty state text
  - `src/pages/TrashPage.tsx` (lines 40-44): empty state text
  - `src/components/ErrorBoundary.tsx` (lines 24-32): error fallback text
  - `src/components/PageErrorBoundary.tsx` (lines 10-18): error fallback text
- **Impact:** These strings are not translatable. The i18n JSON files (`en.json`, `zh.json`) already contain keys for some of these (e.g., `loading.grinding`, `error.blocked`, `gallery.empty.title`) but they are not being used in these locations.
- **Fix approach:** Replace all hardcoded strings with `t()` calls using existing i18n keys where available, and add new keys where missing (e.g., `aria.skipToMain`, `error.retry`, `onboarding.*`, `empty.*`).

---

## Architecture Concerns

### Mock Data Dependency

- **Description:** The entire application is built around a synchronous `generateMockImages(200)` call at store initialization. The `Image` type in `mock-data.ts` includes analysis/score fields that are AI-generated in the mock but would need a real backend to produce. The API layer (`src/lib/api/images.ts`) defines a different `ImageRecord` type that was the Tauri IPC contract -- these two types are incompatible without the `recordToImage()` adapter.
- **Risk:** Adding a real backend requires reconciling two type systems (mock `Image` vs API `ImageRecord`), rewriting the store initialization to be async, and deciding what to do with analysis/score data that depends on AI.
- **Mitigation:** The `recordToImage()` function in `app-store.ts` already shows how to bridge types. Follow this pattern when introducing a real backend.

### No Backend Abstraction Layer

- **Description:** The app store (`app-store.ts`) directly imports from both `mock-data.ts` and `api/images.ts`, mixing concerns. There is no dependency injection or adapter pattern that would allow swapping between mock and real data sources without changing store code.
- **Risk:** When a real backend is added, the store will need significant refactoring. The current pattern of `if (isTauri())` guards is broken (see item 1).
- **Mitigation:** Introduce a `DataSource` interface with `getImages`, `updateRating`, `toggleFavorite`, `deleteImage` methods. Implement `MockDataSource` and (later) `BackendDataSource`.

### React 19 + Vite 8 + TypeScript 6 -- Bleeding Edge Stack

- **Description:** The project uses very recent versions: React 19.2.6, Vite 8.0.12, TypeScript 6.0.2, Tailwind CSS 4.3.1. These are all major version bumps with breaking changes from their predecessors.
- **Risk:** Community resources, StackOverflow answers, and library compatibility are limited for these versions. The `@types/react-window` package may not align perfectly with `react-window` v2 API.
- **Mitigation:** Keep dependencies version-pinned. Monitor for regressions when updating.

---

## Performance Notes

### `build.minify: false` -- Unminified Production Builds

- **Issue:** As noted in item 15, production builds are unminified. With `lucide-react` (still a dependency, ~900KB uncompressed) and `react-window`, the production bundle could be several megabytes.

### Virtualization Works Correctly

- **Positive:** The `VirtualizedGrid` component in `src/components/VirtualizedGrid.tsx` correctly uses `react-window`'s `Grid` component with `overscanCount={2}`. The threshold (`VIRTUALIZE_THRESHOLD = 100`) is appropriate. This is well-implemented.

### No Image Optimization

- **Issue:** Mock images use inline SVG data URIs as thumbnails (`placeholderSvg` in `mock-data.ts`). When real images are introduced, there is no resizing, format conversion, or lazy loading beyond the native `loading="lazy"` on `<img>` tags.
- **Impact:** Loading thousands of full-resolution images in the gallery will cause performance degradation.
- **Fix approach:** Generate actual thumbnails (either server-side or via Canvas API). Consider progressive loading with blur-up placeholders.

---

## Accessibility Audit

### Strengths (well-implemented)
- Semantic HTML: `<nav>`, `<main>`, `<aside>`, `<h1>`-`<h6>`
- ARIA labels on interactive elements (`aria-label` on buttons, `aria-selected` on tabs)
- Keyboard navigation: full arrow key support in gallery and command palette
- Skip navigation link with `sr-only` + `focus:not-sr-only`
- Focus-visible styles defined in `index.css`
- Respects `prefers-reduced-motion`

### Gaps
- **Image alt text** in `ImageCard.tsx` (line 61): `alt={`${image.format} image - ${image.tags.join(", ")}`}` -- functional but could be more descriptive for screen reader users
- **CurationPage** (line 66): `alt={`Curation image ${currentIndex + 1} of ${images.length}`}` -- generic
- **No landmark roles** beyond `<nav>`, `<main>`, `<aside>` -- could benefit from `<header>`, `<footer>`, `<section>` with `aria-labelledby`
- **CommandPalette** (line 270): The overlay backdrop has no `aria-label` or `role="presentation"`

---

## Dependencies at Risk

| Package | Risk | Impact | Recommendation |
|---------|------|--------|----------------|
| `lucide-react@^1.18.0` | Anti-pattern per design spec; should be removed | Bundle size, design inconsistency | Remove after replacing all icon imports |
| `react-router-dom@^7.17.0` | Completely unused | Bundle bloat | Remove immediately |
| `react-window@^2.2.7` | v2 API, `@types/react-window` may be for v1 | Type mismatches possible | Verify types align; pin version |
| `typescript@~6.0.2` | Bleeding edge, ecosystem support limited | Build tooling compatibility | Monitor; be prepared to downgrade to 5.x |
| `vite@^8.0.12` | Bleeding edge | Plugin compatibility | Monitor; test plugin updates |

---

## Migration Debt: Remaining Tauri Cleanup

Despite the "remove Tauri/Rust backend" commit (`141182b`), the following Tauri artifacts remain:

| Artifact | Location | Status |
|----------|----------|--------|
| `isTauri()` calls (6x) | `src/stores/app-store.ts` | Undefined function -- dead code |
| `if (false) { // Tauri removed }` (2x) | `src/components/DropZone.tsx` lines 127, 139 | Dead code |
| `Tauri 2` engine label | `src/pages/SettingsPage.tsx` line 177 | Misleading UI |
| `recordToImage()` adapter | `src/stores/app-store.ts` lines 7-22 | Unused (loadImages is never called without Tauri) |
| `ImageRecord` type | `src/lib/api/images.ts` | Unused Tauri type contract |
| Tauri imports in planning docs | `.planning/phases/005-*`, `006-*`, `007-*` | Historical only -- acceptable |
| `ARCHITECTURE.md` full Tauri architecture | Project root | Outdated documentation |

---

*Concerns audit: 2026-06-21*
