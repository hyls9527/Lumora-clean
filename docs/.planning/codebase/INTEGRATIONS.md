# External Integrations

**Analysis Date:** 2026-06-21

## Architecture Level: Pure Client-Side SPA

Lumora is currently a **pure frontend application** with no backend, no external API calls, and no authentication layer. The Tauri/Rust backend was removed (commit `141182b`), leaving only the React frontend. All API functions in `src/lib/api/` are stubs that return empty data or interact with browser `localStorage`.

There are **no environment variables** (no `.env` files present), no API keys, and no external service connections.

## Data Storage

**Primary: In-Memory (Zustand)**
- All application data is held in Zustand store instances
- Image data is generated from mock functions (`src/lib/mock-data.ts`)
- Data is **not persisted** across page reloads (except settings)

**Settings Persistence: localStorage**
- File: `src/lib/api/settings.ts`
- Keys: `language`, `theme`, `gridColumns`
- Dedicated store: `src/stores/settings-store.ts` wraps localStorage reads/writes
- i18n locale also uses localStorage with key `lumora-locale` (`src/lib/i18n.tsx`, line 18)

**Mock Data Generation:**
- File: `src/lib/mock-data.ts`
- `generateMockImages(200)` creates 200 placeholder images with random metadata
- Images use inline SVG data URIs as thumbnails (no actual image files)
- No database, no IndexedDB, no file system access in current state

**No Caching Layer:**
- Data is computed fresh on each load from mock data
- No service worker, no HTTP cache strategy needed (no network requests)

## API & Data Layer

### Image API (Stub)
- File: `src/lib/api/images.ts`
- All functions are no-op stubs:
  - `getImages(limit, offset)` — returns empty `[]`
  - `importFolder(path)` — returns `0`
  - `updateImageRating(id, rating)` — void
  - `toggleImageFavorite(id)` — returns `false`
  - `deleteImage(id)` — void
  - `searchImages(query)` — returns empty `[]`
  - `openFolderDialog()` — returns `null`
- These were designed to call Tauri IPC commands. Since Tauri is removed, they are dead code.

### Settings API (localStorage)
- File: `src/lib/api/settings.ts`
- `getSetting(key)` — reads from `localStorage.getItem(key)`
- `setSetting(key, value)` — writes to `localStorage.setItem(key, value)`
- This is the **only functional persistence layer** in the current codebase.

### Tauri Integration Guards (Orphaned)
- The `app-store.ts` file calls an undefined function `isTauri()` at lines 71, 80, 92, 156, 167, 177
- `isTauri()` is not defined anywhere in `src/` — it was likely meant to come from `@tauri-apps/api` or a custom utility at `src/lib/tauri.ts`
- Because TypeScript strict mode is not enabled (`noImplicitAny` is off), these undefined function calls do not cause compile errors
- At runtime in a browser, calling `isTauri()` will throw a `ReferenceError`
- All Tauri-gated code paths are execution-guarded: calls like `toggleImageFavorite(Number(id))` are not reached without Tauri, but the initial mock data flow does not trigger these paths

## State Management

### Zustand Stores

**Main Store: `src/stores/app-store.ts`**
- Initialized with 200 mock images
- Manages: image list, view state, selection, search, sort, filters, tags, detail panel, focused index, import/load actions
- Single `create<AppState>()` call — no middleware, no persistence plugin
- Actions use optimistic updates: UI updates immediately, then API call fires (but API is stub so no rollback needed)

**Settings Store: `src/stores/settings-store.ts`**
- Manages: language (`"en" | "zh"`), theme (`"light" | "dark"`), gridColumns (`number`)
- Persists settings to localStorage on every change
- `loadSettings()` reads from localStorage (called in `App.tsx` via `useAppStore`'s `loadImages` effect — note: settings are NOT loaded in `App.tsx`)

### i18n
- File: `src/lib/i18n.tsx`
- Custom React Context implementation (no third-party i18n library)
- Translation files: `src/i18n/en.json` and `src/i18n/zh.json`
- Locale detection: checks `localStorage.getItem("lumora-locale")`, falls back to `navigator.language`
- Dot-notation key resolution (e.g., `"sidebar.subtitle"`)
- Provider: `<I18nProvider>` wraps the app in `App.tsx`
- Consumer: `useTranslation()` hook returns `{ locale, setLocale, t }`

## Font Loading

**Strategy: Dual approach — npm packages + Google Fonts CDN**

**npm `@fontsource` packages (CSS imports in `src/index.css`):**
```css
@import "@fontsource-variable/dm-sans";
@import "@fontsource/jetbrains-mono";
@import "@fontsource/noto-serif-sc";
```
These are bundled with the app — no runtime network dependency for fonts.

**Google Fonts CDN (in `index.html`):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet" />
```
This loads as a fallback/redundant source. The `@fontsource` imports should take priority.

**Font Family Configuration (CSS custom properties):**
```css
--font-serif: 'Noto Serif SC', 'Georgia', serif;
--font-sans: 'DM Sans', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, monospace;
```

## Authentication & Identity

**None.** No auth provider, no login, no user accounts. The application runs entirely client-side with no concept of users.

## Monitoring & Observability

**Error Tracking:**
- `console.error()` in catch blocks throughout the codebase
- `ErrorBoundary` component at `src/components/ErrorBoundary.tsx` — catches React render errors, displays fallback UI
- `PageErrorBoundary` component at `src/components/PageErrorBoundary.tsx` — page-level error boundary
- No external error tracking service (Sentry, LogRocket, etc.)

**Logs:**
- Browser `console` only
- No structured logging, no log levels, no log aggregation

## CI/CD & Deployment

**Hosting:**
- Not configured. No deployment scripts, no CD configuration found.
- Build output: `dist/` directory (Vite default)

**CI Pipeline:**
- None detected. No `.github/workflows/`, `.gitlab-ci.yml`, or other CI config files.

## Environment Configuration

**Required env vars:**
- None. The application requires zero environment variables to build or run.

**Build-time configuration:**
- All configuration is in source files (Vite config, TypeScript config, ESLint config)
- No `.env` files exist

## Webhooks & Callbacks

**Incoming:**
- None. The application is a static SPA with no server endpoints.

**Outgoing:**
- None. No network requests are made at runtime (no fetch, no axios, no WebSocket).

## External Service Dependencies at Runtime

**None.** The application should function fully offline after the initial page load. The only optional runtime network dependency is the Google Fonts CDN in `index.html`, which is redundant with the bundled `@fontsource` packages.

---

*Integration audit: 2026-06-21*
