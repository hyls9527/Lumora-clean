# Codebase Structure

**Analysis Date:** 2026-06-21

## Directory Layout

```
Lumora-clean/
├── index.html                          # HTML entry point, mounts to <div id="root">
├── package.json                        # Dependencies: React 19, Zustand 5, Tailwind CSS v4, Vite 8
├── tsconfig.json                       # TypeScript project references (app + node)
├── tsconfig.app.json                   # App TS config (paths alias, strict mode)
├── tsconfig.node.json                  # Node/Vite TS config
├── vite.config.ts                      # Vite config: React plugin, Tailwind plugin, @ alias
├── eslint.config.js                    # ESLint flat config (ES10)
├── DESIGN.md                           # Design identity document — must read before UI work
├── CLAUDE.md                           # Project instructions, rules, anti-patterns
├── .claude/
│   └── skills/                         # Project skills (lumora-ui-process, lumora-design-identity)
├── public/                             # Static assets
├── src/
│   ├── main.tsx                        # App entry point: createRoot + StrictMode
│   ├── App.tsx                         # Root component: layout shell, view routing, providers
│   ├── index.css                       # Global styles: Tailwind v4 @theme, fonts, base styles
│   ├── env.d.ts                        # TypeScript ambient declarations (empty Window interface)
│   ├── components/                     # Business components + UI primitives
│   │   ├── ui/                         # shadcn/ui-style primitives (11 files)
│   │   │   ├── badge.tsx               # Badge: variant support (default, secondary, destructive, outline)
│   │   │   ├── button.tsx              # Button: CVA variants (default, destructive, outline, ghost, link) + 6 sizes
│   │   │   ├── card.tsx                # Card: compound component (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction)
│   │   │   ├── dialog.tsx              # Dialog: Radix-based (Root, Trigger, Portal, Overlay, Content, Header, Footer, Title, Description, Close)
│   │   │   ├── dropdown-menu.tsx       # DropdownMenu: custom implementation (no Radix) with Context, click-outside, Escape close
│   │   │   ├── input.tsx              # Input: styled native input with ring focus
│   │   │   ├── scroll-area.tsx         # ScrollArea: styled scrollable container
│   │   │   ├── separator.tsx           # Separator: horizontal/vertical divider
│   │   │   ├── sheet.tsx              # Sheet: slide panel component
│   │   │   ├── skeleton.tsx           # Skeleton: animated pulse loading placeholder
│   │   │   ├── tabs.tsx              # Tabs: Context-based tab switching (Tabs, TabsList, TabsTrigger, TabsContent)
│   │   │   └── tooltip.tsx           # Tooltip: Radix-based (Provider, Root, Trigger, Content)
│   │   ├── Sidebar.tsx                 # Navigation sidebar: logo, search button, nav items, stats, collapse toggle
│   │   ├── DetailPanel.tsx             # Right slide panel: image preview, rating (plum flower), favorite, metadata, tags, analysis, scores, actions
│   │   ├── CommandPalette.tsx          # Cmd+K modal: command search, keyboard shortcuts, image search via API, grouped results
│   │   ├── ImageCard.tsx               # Gallery image card: thumbnail, hover overlay, rating (plum flower), favorite stamp, selection checkbox
│   │   ├── VirtualizedGrid.tsx         # react-window Grid: virtual rendering for 100+ images, delegates to ImageCard cells
│   │   ├── DropZone.tsx                # Full-screen drag-and-drop overlay: file import with simulated progress bar
│   │   ├── ExportDialog.tsx            # Export modal: format selector (radio buttons), quality slider, destination path, progress bar
│   │   ├── TagManager.tsx              # Tag management: create/delete dialog with color picker + TagFilterBar for gallery
│   │   ├── ErrorBoundary.tsx           # Class-based error boundary: catches render errors, shows fallback with retry
│   │   └── PageErrorBoundary.tsx       # Per-page error boundary wrapper: reloads page on error
│   ├── pages/                          # Full page components (one per view)
│   │   ├── GalleryPage.tsx             # Main gallery: masonry/VirtualizedGrid, sort toolbar, tag filters, keyboard nav, onboarding
│   │   ├── DashboardPage.tsx           # Stats dashboard: hero count, directory-style stats, rating distribution bars, formats, top tags
│   │   ├── CurationPage.tsx            # Slide curation: sequential image review, keep/maybe/reject decisions, progress counter
│   │   ├── SettingsPage.tsx            # Tabbed settings: language, theme, grid columns, keyboard shortcuts reference, about info
│   │   └── TrashPage.tsx              # Trash placeholder: empty state with restore UI scaffolding (no actual logic)
│   ├── stores/                         # Zustand global state
│   │   ├── app-store.ts               # Main app state: images, view, selection, rating, favorites, search, sort, tags, filters, CRUD
│   │   └── settings-store.ts          # User settings: language, theme, gridColumns + localStorage persistence
│   ├── lib/                            # Utilities and infrastructure
│   │   ├── utils.ts                   # cn() helper: clsx + tailwind-merge
│   │   ├── i18n.tsx                   # I18nProvider (React Context): locale detection, translation lookup, setLocale
│   │   ├── mock-data.ts              # Mock data generation: Image/Tag types, MOCK_TAGS, generateMockImages(200)
│   │   └── api/                       # API abstraction layer (all mock stubs)
│   │       ├── images.ts             # Image API stubs: getImages, searchImages, updateImageRating, toggleFavorite, deleteImage, importFolder, openFolderDialog
│   │       └── settings.ts           # Settings API stubs: getSetting, setSetting (backed by localStorage)
│   └── i18n/                          # Translation files
│       ├── en.json                    # English translations (211 lines)
│       └── zh.json                    # Chinese translations
```

## Directory Purposes

**`src/` (root of source):**
- Purpose: All application source code
- Contains: Entry points (main.tsx, App.tsx), global CSS (index.css), type declarations (env.d.ts)
- Key files: `main.tsx` (entry), `App.tsx` (root component), `index.css` (design system tokens)

**`src/components/ui/`:**
- Purpose: Reusable UI primitives following shadcn/ui conventions
- Contains: 11 component files — Button, Card, Dialog, Badge, Input, Tooltip, DropdownMenu, Tabs, Skeleton, ScrollArea, Sheet, Separator
- Key files: `button.tsx` (CVA variants), `dialog.tsx` (Radix-based, most complex), `card.tsx` (compound pattern)
- Pattern: Each file exports a main component + sub-components + type interfaces
- Dependency: Radix UI (dialog, tooltip), class-variance-authority (button, badge)

**`src/components/` (business components):**
- Purpose: Application-specific components that compose UI primitives and stores
- Contains: 10 files — layout, interaction, and overlay components
- Key files: `Sidebar.tsx` (navigation), `CommandPalette.tsx` (keyboard-driven workflow), `DetailPanel.tsx` (image metadata/actions)
- Pattern: Each component imports `useAppStore()` and/or `useTranslation()` directly

**`src/pages/`:**
- Purpose: Full-page view components, one per navigation item
- Contains: 5 files — GalleryPage, DashboardPage, CurationPage, SettingsPage, TrashPage
- Key files: `GalleryPage.tsx` (most complex — masonry layout, keyboard nav, virtualized grid toggle)
- Pattern: Each page wraps content in `PageErrorBoundary`, imports `useAppStore()` for data, uses `useTranslation()` for text

**`src/stores/`:**
- Purpose: Global state management via Zustand
- Contains: 2 files — app-store.ts (main store), settings-store.ts (preferences)
- Key files: `app-store.ts` (191 lines — images, view, selection, tags, filters, async operations)
- Pattern: Zustand `create<XState>((set, get) => ({...}))` pattern with inline actions

**`src/lib/`:**
- Purpose: Cross-cutting utilities, infrastructure, mock data
- Contains: 3 files + 1 subdirectory (api/)
- Key files: `i18n.tsx` (Context provider + useTranslation hook), `mock-data.ts` (types + generator), `utils.ts` (cn helper)
- Pattern: Pure utility functions or React Context providers

**`src/lib/api/`:**
- Purpose: API abstraction layer (all stubs, no real backend)
- Contains: 2 files — images.ts (CRUD stubs), settings.ts (localStorage wrapper)
- Key files: `images.ts` (ImageRecord type + 7 async stub functions)
- Pattern: All functions are async, return empty/noop. Designed as a drop-in replacement point for real backend.

**`src/i18n/`:**
- Purpose: Translation locale files
- Contains: 2 JSON files — en.json (English), zh.json (Chinese)
- Key files: `en.json` (211 lines — sidebar, gallery, detail, curation, dashboard, settings, commandPalette, toolbar, trash, tags, export, dropzone)

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Browser entry — creates React root, renders `<App />` in StrictMode
- `index.html`: HTML shell — contains `<div id="root">` mount point
- `src/App.tsx`: Application entry — provider wrapping, layout shell, view routing

**Configuration:**
- `vite.config.ts`: Vite build config — React + Tailwind plugins, `@` path alias, port 5173
- `tsconfig.json`: TypeScript project references (app + node)
- `package.json`: Dependencies, scripts (dev, build, lint, preview)
- `src/index.css`: Design system tokens — Tailwind v4 `@theme` block

**Core Logic:**
- `src/stores/app-store.ts`: All image management, view switching, filtering, selection
- `src/stores/settings-store.ts`: User preferences with localStorage persistence
- `src/lib/i18n.tsx`: Internationalization system (Context + hook)
- `src/lib/mock-data.ts`: Image type definitions + mock data generator

**Testing:**
- No test files exist in the codebase. No test runner configuration (no jest.config, vitest.config).
- The `package.json` has no test script.

**Design System:**
- `src/index.css`: Color tokens (象牙纸页, 研磨墨, 古铜包浆), shadow tokens (暖棕调), radius tokens, font families
- `DESIGN.md`: Design identity specification (referenced by CLAUDE.md, must read before UI work)
- `CLAUDE.md`: Anti-patterns list (no lucide-react icons, no Inter font, no pill buttons, no pure white/black)

## Naming Conventions

**Files:**
- Component files: PascalCase (`Sidebar.tsx`, `ImageCard.tsx`, `GalleryPage.tsx`)
- Library files: kebab-case (`mock-data.ts`, `app-store.ts`, `settings-store.ts`)
- UI primitives: kebab-case matching shadcn convention (`button.tsx`, `dropdown-menu.tsx`)
- JSON files: short lowercase (`en.json`, `zh.json`)

**Directories:**
- All lowercase: `components/`, `pages/`, `stores/`, `lib/`, `i18n/`, `ui/`, `api/`

**Functions/Methods:**
- camelCase: `loadImages`, `setView`, `toggleFavorite`, `getFilteredImages`
- React components: PascalCase exported named functions: `export function Sidebar()`, `export function GalleryPage()`
- Internal helpers: camelCase at module scope: `recordToImage()`, `getTopTags()`, `parseAspectRatio()`

**Variables:**
- camelCase: `selectedIds`, `activeTagFilters`, `focusedIndex`, `detailImage`
- Constants: UPPER_SNAKE_CASE: `MOCK_TAGS`, `VIRTUALIZE_THRESHOLD`, `TAG_COLORS`, `ACCEPTED_TYPES`, `NAV_ITEMS`
- Type aliases: PascalCase: `View`, `ImageRecord`, `AppState`, `Decision`, `ExportFormat`

**Interfaces/Types:**
- PascalCase: `Image`, `Tag`, `AppState`, `SettingsState`, `ImageRecord`, `Command`
- Props interfaces: Inline in function params or named with suffix: `ImageCardProps`, `ExportDialogProps`, `TagManagerProps`
- Type aliases (union literals): `type View = "gallery" | "curation" | ...`
- Type aliases (object shapes): `type AspectRatio = '1/1' | '4/3' | ...`

## Where to Add New Code

**New Feature (e.g., new image view):**
- Primary code: `src/pages/NewFeaturePage.tsx` — create a new page component
- Tests: No test infrastructure exists. Tests would go in `__tests__/` or co-located `*.test.tsx` files.
- Store changes: Add new state/actions to `src/stores/app-store.ts`
- Navigation: Add new view type to the `View` union in `app-store.ts`, add nav item to `NAV_ITEMS` in `Sidebar.tsx`, add case to `renderPage()` in `App.tsx`
- i18n: Add translation keys to `src/i18n/en.json` and `src/i18n/zh.json`

**New Component (business):**
- Implementation: `src/components/NewComponent.tsx`
- Import pattern: `import { useAppStore } from "@/stores/app-store"` and `import { useTranslation } from "@/lib/i18n"`
- Export pattern: Named export: `export function NewComponent() { ... }`
- Wrap in PageErrorBoundary if it is a full page, otherwise trust parent error boundary

**New UI Primitive:**
- Implementation: `src/components/ui/new-component.tsx`
- Follow shadcn/ui patterns: CSS-based variants using `cn()` utility and optionally `cva()` from class-variance-authority
- Use `@radix-ui/react-*` for complex interactive components (dialog, tooltip, etc.)
- Export named components + type interfaces

**Utilities:**
- Shared helpers: `src/lib/utils.ts` (add to existing file) or new file in `src/lib/`
- API stubs: `src/lib/api/new-service.ts`
- Mock data: `src/lib/mock-data.ts` or new file

**New Translation Key:**
- Add to `src/i18n/en.json` and `src/i18n/zh.json` under the appropriate section
- Usage: `const { t } = useTranslation()` then `t("section.key")` with dot notation

**New Store:**
- Create `src/stores/new-store.ts`
- Pattern: `import { create } from "zustand"` then `export const useNewStore = create<NewState>((set, get) => ({...}))`

## Import Dependency Graph

```
main.tsx
  └── App.tsx
        ├── components/ErrorBoundary
        ├── lib/i18n (I18nProvider, useTranslation)
        ├── components/ui/tooltip (TooltipProvider)
        ├── components/Sidebar
        │     ├── stores/app-store
        │     └── lib/i18n
        ├── components/DetailPanel
        │     ├── stores/app-store
        │     ├── lib/i18n
        │     └── components/ui/badge
        ├── components/CommandPalette
        │     ├── stores/app-store
        │     ├── lib/i18n
        │     └── lib/api/images
        ├── pages/GalleryPage
        │     ├── stores/app-store
        │     ├── lib/i18n
        │     ├── components/ImageCard
        │     │     ├── stores/app-store
        │     │     └── lib/mock-data (Image type)
        │     ├── components/VirtualizedGrid
        │     │     ├── components/ImageCard
        │     │     └── lib/mock-data (Image type)
        │     ├── components/TagManager (TagFilterBar)
        │     │     ├── stores/app-store
        │     │     ├── lib/i18n
        │     │     └── components/ui/*
        │     ├── components/ExportDialog
        │     │     ├── stores/app-store
        │     │     ├── lib/i18n
        │     │     └── components/ui/dialog
        │     ├── components/DropZone
        │     │     ├── stores/app-store
        │     │     ├── lib/i18n
        │     │     └── lib/mock-data (Image type)
        │     └── components/PageErrorBoundary
        │           └── components/ErrorBoundary
        ├── pages/DashboardPage
        │     ├── stores/app-store
        │     ├── lib/i18n
        │     └── components/PageErrorBoundary
        ├── pages/CurationPage
        │     ├── stores/app-store
        │     ├── lib/i18n
        │     └── components/PageErrorBoundary
        ├── pages/SettingsPage
        │     ├── stores/settings-store
        │     ├── lib/i18n
        │     ├── components/PageErrorBoundary
        │     └── components/ui/card
        └── pages/TrashPage
              ├── lib/i18n
              ├── components/PageErrorBoundary
              └── components/ui/card
```

## Special Directories

**`.claude/skills/`:**
- Purpose: Project-specific Claude skills (lumora-ui-process, lumora-design-identity)
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: Planning artifacts — phase plans, codebase maps
- Generated: Yes (by `/gsd-*` commands)
- Committed: Yes

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in `.gitignore`)

**`public/`:**
- Purpose: Static assets served at root path
- Generated: No
- Committed: Yes (typically contains favicon, etc.)

---

*Structure analysis: 2026-06-21*
