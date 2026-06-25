# Coding Conventions

**Analysis Date:** 2026-06-21

## Naming Patterns

**Files:**
- PascalCase for React components: `Sidebar.tsx`, `ImageCard.tsx`, `GalleryPage.tsx`, `ErrorBoundary.tsx`
- kebab-case for non-component modules: `app-store.ts`, `settings-store.ts`, `mock-data.ts`, `utils.ts`
- Index/pages suffix for page components: `GalleryPage.tsx`, `DashboardPage.tsx`

**Functions:**
- camelCase: `useTranslation()`, `getFilteredImages()`, `handleKeyDown()`, `toggleFavorite()`
- Named function exports (not default exports) for components: `export function Sidebar()`
- Only `App.tsx` uses default export
- Arrow functions for inline handlers: `onClick={() => setView(item.id)}`
- Helper functions defined at module scope: `function parseAspectRatio(ar: string): number`
- Sub-components defined as functions in the same file: `function StatRow()`, `function SectionLabel()`

**Variables:**
- camelCase: `filteredImages`, `focusedIndex`, `selectedIds`, `isLoading`
- Constant primitives at module scope in UPPER_SNAKE_CASE: `NAV_ITEMS`, `COLS`, `GAP`, `VIRTUALIZE_THRESHOLD`

**Types/Interfaces:**
- PascalCase: `ImageCardProps`, `AppState`, `I18nContextValue`, `SettingsState`
- Props interfaces follow `ComponentNameProps` pattern: `interface ImageCardProps { image: Image; focused?: boolean }`
- State interfaces follow `ComponentNameState` pattern (for class-based ErrorBoundary): `AppState`, `SettingsState`
- Inline prop types via destructured object type literals for sub-components — see `StatRow` in `src/components/Sidebar.tsx:157-165`
- String literal unions for enums: `type View = "gallery" | "curation" | "dashboard" | "trash" | "settings"`

## Component Patterns

**Function Components:**
All components (except `ErrorBoundary`) use React 19 function components with named exports:

```typescript
// src/components/Sidebar.tsx - standard pattern
export function Sidebar() {
  const { t } = useTranslation()
  const { view, setView } = useAppStore()
  return ( /* JSX */ )
}
```

**Props Definition:**
Interfaces defined above the component, or inline for small helpers:

```typescript
// src/components/ImageCard.tsx - external interface
interface ImageCardProps {
  image: Image
  focused?: boolean
}
export function ImageCard({ image, focused }: ImageCardProps) { ... }

// src/components/Sidebar.tsx - inline type for sub-components
function StatRow({ label, value, icon }: {
  label: string
  value: number
  icon?: React.ReactNode
}) { ... }
```

**Sub-Components:**
Helper components defined in the same file, not exported. Used extensively:
- `src/components/Sidebar.tsx`: `StatRow` (line 157)
- `src/components/ImageCard.tsx`: `PlumFlower` (line 6)
- `src/components/DetailPanel.tsx`: `SectionLabel`, `InfoRow`, `ScoreBar`, `ActionButton`

**Forward Refs (shadcn/ui pattern):**
Used only for base UI components. See `src/components/ui/button.tsx`:

```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"
```

**Variant Pattern (CVA):**
`class-variance-authority` for component variants. See `src/components/ui/button.tsx:6-32` for the `buttonVariants` definition with `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` variants and `sm`, `lg`, `icon` sizes.

**Class Component Exception:**
`src/components/ErrorBoundary.tsx` is a class component (React design requirement for `getDerivedStateFromError`).

**No Default Exports (except App):**
All components use named exports. Do NOT use `export default function`. The only exception is `src/App.tsx`.

## State Management

**Zustand Stores:**
Two stores, domain-separated:

| Store | File | Purpose |
|-------|------|---------|
| `useAppStore` | `src/stores/app-store.ts` | Images, views, filtering, selection |
| `useSettingsStore` | `src/stores/settings-store.ts` | Language, theme, grid layout |

**Store creation pattern:**

```typescript
// Interface first, then create
interface AppState {
  images: Image[]
  view: View
  setView: (v: View) => void
  // ...
}

export const useAppStore = create<AppState>((set, get) => ({
  images: generateMockImages(200),
  view: "gallery",
  setView: (v) => set({ view: v }),
  // ...
}))
```

**Immutable updates:** All state updates use functional `set()`:
```typescript
toggleSelect: (id) =>
  set((s) => {
    const n = new Set(s.selectedIds)
    n.has(id) ? n.delete(id) : n.add(id)
    return { selectedIds: n }
  })
```

**Async actions:** Async functions that set `isLoading`/`error` state:
```typescript
loadImages: async () => {
  set({ isLoading: true, error: null })
  try {
    const records = await getImages(500, 0)
    set({ images: records.map(recordToImage), isLoading: false })
  } catch (err) {
    console.error("loadImages failed:", err)
    set({ error: String(err), isLoading: false })
  }
}
```

**Optimistic updates with rollback:** `toggleFavorite` updates local state immediately, fires API call, and rolls back on failure:
```typescript
toggleFavorite: (id) => {
  set((s) => ({ images: s.images.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)) }))
  if (isTauri()) {
    toggleImageFavorite(Number(id)).catch((err) => {
      console.error("toggleImageFavorite failed:", err)
      set((s) => ({ images: s.images.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)) }))
    })
  }
}
```

## Styling Approach

**Framework:** Tailwind CSS v4 via `@tailwindcss/vite` plugin (`vite.config.ts`).

**Class Merging:**
Always use `cn()` from `src/lib/utils.ts` for conditional class merging. This combines `clsx` and `tailwind-merge`:

```typescript
import { cn } from "@/lib/utils"

// Usage
className={cn(
  "base-classes",
  isActive && "active-classes",
  variant === "danger" && "danger-classes"
)}
```

No separate CSS files; no CSS modules; no styled-components. All styling via Tailwind utility classes in JSX.

**DESIGN.md Tokens:**
CSS custom properties defined in global stylesheet. Reference them via Tailwind classes that map to the design token system. Key tokens:

| CSS Variable | Design Meaning | Value |
|---|---|---|
| `--color-bg` | Page background | `#f2ede4` |
| `--color-surface` | Card/surface | `#f7f2ea` |
| `--color-text` | Primary text | `#2a2118` |
| `--color-text-secondary` | Secondary text | `#6b5d48` |
| `--color-text-muted` | Muted text | `#a09480` |
| `--color-accent` | Accent color | `#7a5c12` |
| `--color-border` | Border | `rgba(139,115,75,0.10)` |

The tailwind config maps these to utility classes: `bg-bg`, `bg-surface`, `bg-surface-hover`, `text-text`, `text-text-muted`, `bg-accent`, `border-border`, etc.

## TypeScript Patterns

**Configuration** (`tsconfig.app.json`):
- Target: `es2023`
- JSX: `react-jsx` (React 19 automatic)
- Mode: `moduleResolution: "bundler"` with `module: "esnext"`
- Strict: Notable settings — `noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true`, `noFallthroughCasesInSwitch: true`
- No `strict: true` in tsconfig (but useful individual strictness flags)
- Path alias: `@/*` maps to `./src/*`

**Type vs Interface:**
- `interface` for component props and state contracts: `interface ImageCardProps`, `interface AppState`
- `type` for unions, literal types, and aliases: `type View = "gallery" | "curation" | ...`, `type Locale = "en" | "zh"`
- Mixed approach within same file — see `src/stores/app-store.ts` where `type View` coexists with `interface AppState`

**Explicit typing:** Functions that accept parameters define inline types:
```typescript
function recordToImage(r: ImageRecord): Image { ... }
function getTopTags(images: { tags: string[] }[]): [string, number][] { ... }
```

**Global declarations:** `src/env.d.ts` contains only `interface Window {}` — a stub for extension.

**Generic constraints:** `src/components/ui/button.tsx` uses `VariantProps<typeof buttonVariants>` for extracting variant types from CVA definitions.

## Import Organization

**Observed order (top-to-bottom):**
1. React and React hooks
2. Third-party library imports (`zustand`, `lucide-react`)
3. Path alias imports (`@/lib/i18n`, `@/stores/app-store`, `@/lib/utils`, `@/components/*`)
4. Relative imports (`../lib/mock-data`, `./ErrorBoundary`)

**Example from `src/pages/DashboardPage.tsx`:**
```typescript
import { useAppStore } from "@/stores/app-store"       // store
import { useTranslation } from "@/lib/i18n"             // lib
import { cn } from "@/lib/utils"                        // utility
import { PageErrorBoundary } from "@/components/PageErrorBoundary"  // component
```

**Example from `src/components/Sidebar.tsx`:**
```typescript
import { useTranslation } from "@/lib/i18n"
import { useAppStore } from "@/stores/app-store"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
```

**No import sorting tool** (no prettier, no eslint-plugin-import). Order is slightly inconsistent across files — some put React first, others last. New code should put React first, then third-party, then `@/` aliases, then relative imports.

## i18n Usage Pattern

**File:** `src/lib/i18n.tsx`

**Architecture:** React Context-based provider. Two JSON translation files at `src/i18n/en.json` and `src/i18n/zh.json`.

**Provider:** `I18nProvider` wraps the app in `src/App.tsx:86`.

**Consumption pattern:**
```typescript
import { useTranslation } from "@/lib/i18n"

export function MyComponent() {
  const { t, locale, setLocale } = useTranslation()
  return <span>{t("sidebar.gallery")}</span>
}
```

**Key format:** Dot-notation with sections: `"sidebar.gallery"`, `"dashboard.avgRating"`, `"gallery.sort.date"`.

**Fallback behavior:**
- Language detection: `localStorage.getItem("lumora-locale")` then `navigator.language`
- Missing keys return the key string itself (line 39 of `i18n.tsx`: `return typeof result === "string" ? result : key`)
- Only two locales: `"en"` and `"zh"`

**When adding new translations:**
1. Add keys to `src/i18n/en.json` (English)
2. Add matching keys to `src/i18n/zh.json` (Chinese)
3. Use `t("section.key")` in components

## Design System Conventions (from CLAUDE.md and DESIGN.md)

**Fonts:**
| Role | Font | CSS Class |
|------|------|-----------|
| Headings (display, h1, h2) | Noto Serif SC | `font-serif` |
| Body/UI | DM Sans | `font-sans` |
| Mono | JetBrains Mono | `font-mono` |

**Border Radius (Material Logic):**
| Element | Radius | Tailwind |
|---------|--------|----------|
| Cards | 2px | `rounded-[2px]` |
| Buttons | 4px | `rounded-[4px]` |
| Inputs | 4px | `rounded-[4px]` |
| Tags/Badges | 4px | `rounded-[4px]` |
| Dialogs | 6px | `rounded-[6px]` |

**Typography Scale:**
| Role | Font | Size | Weight |
|------|------|------|--------|
| Display | Noto Serif SC | 32px | 300 |
| H1 | Noto Serif SC | 24px | 600 |
| H2 | Noto Serif SC | 18px | 600 |
| Card title | DM Sans | 14px | 600 |
| Body | DM Sans | 14px | 400 |
| Small | DM Sans | 12px | 400 |
| Label | DM Sans | 10px | 500 |
| Mono | JetBrains Mono | 11px | 400 |

**Transitions:** Always `200ms ease-out`. Never `100ms`, never `bounce`/`elastic`/`spring`.

**Shadows:** Warm brown tones — `rgba(139,115,75,...)` and `rgba(78,50,23,...)`.

**Rating:** Plum flower SVG (`PlumFlower` component, 18x18). Never stars.

**Favorite:** Diamond stamp `◆`. Never hearts.

**Sort buttons:** Underline style — `border-b-2 border-accent` for active state. Never pill buttons.

**Dashboard:** Directory-style layout — label left, value right, dotted connector. Never SaaS stat cards.

**Anti-Patterns (NEVER use):**
- lucide-react icons for navigation/actions (CLAUDE.md rule; note: `DetailPanel.tsx` uses lucide-react which contradicts this rule)
- Inter font
- Pill buttons (`rounded-full` or `9999px`)
- Pure black `#000` / pure white `#fff`
- Purple gradients
- Glassmorphism
- 100ms transitions
- Star ratings
- Heart favorites
- Image hover scale (CLAUDE.md says this, but `ImageCard.tsx:48` uses `hover:scale-[1.02]`)

## Error Handling Patterns

**ErrorBoundary (class component):**
`src/components/ErrorBoundary.tsx` — class component at app root wrapping `src/App.tsx:85`. Catches render errors, shows fallback UI with retry button.

**PageErrorBoundary (wrapper):**
`src/components/PageErrorBoundary.tsx` — uses ErrorBoundary with a localized Chinese fallback. Each page wraps its content:

```typescript
// src/pages/DashboardPage.tsx:43
return (
  <PageErrorBoundary>
    <div className="flex-1 h-full overflow-y-auto">
      {/* page content */}
    </div>
  </PageErrorBoundary>
)
```

**Async error handling in stores:**
Pattern of `try/catch` with `isLoading`/`error` state:

```typescript
// src/stores/app-store.ts
loadImages: async () => {
  set({ isLoading: true, error: null })
  try {
    const records = await getImages(500, 0)
    set({ images: records.map(recordToImage), isLoading: false })
  } catch (err) {
    console.error("loadImages failed:", err)
    set({ error: String(err), isLoading: false })
  }
}
```

**UI error display:** `src/App.tsx:61-72` shows error state with retry button when `error` is set in the store.

**No logging framework:** Uses `console.error()` directly. No structured logging, no log levels, no log aggregation.

## Comments

**Style:** Minimal. Code is self-documenting.

**JSX section markers:** Brief Chinese or English labels:
```jsx
{/* Navigation */}
{/* Logo */}
{/* Selection checkbox */}
{/* Favorite stamp */}
```

**No JSDoc/TSDoc:** No `@param`, `@returns`, or `@description` annotations on any function.

**When to comment:** Only when the intent would be unclear from the code alone. If a comment is needed, use Chinese for UI-related, English for logic-related.

## Module Design

**Exports:** Named exports throughout. Barrel files not used. Each module exports exactly what it provides.

**File organization within modules:**
- Interfaces/types at top
- Constants at top (after imports)
- Main export function
- Helper functions below

**No index.ts barrels:** Each import targets a specific file — `@/components/Sidebar`, `@/lib/utils`, `@/stores/app-store`.

---

*Convention analysis: 2026-06-21*
