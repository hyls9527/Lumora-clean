# Testing Patterns

**Analysis Date:** 2026-06-21

## Current State: No Test Infrastructure

**This project has no tests.** There are no test files in the `src/` directory, no test framework configured, and no test scripts in `package.json`.

## Test Framework

**Runner:** None configured. No `vitest`, `jest`, `mocha`, or any other test runner in `package.json` dependencies.

**Assertion Library:** None installed.

**End-to-End:** None (no Playwright, no Cypress).

## Test Scripts

**`package.json` scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  }
}
```

No `test`, `test:watch`, or `test:coverage` scripts exist. The build step includes `tsc -b` for type checking, and `eslint .` for linting. These serve as the only code quality gates.

## Existing Test Files

**None.** Searched for `*.test.*` and `*.spec.*` across the entire project — the only results are inside `node_modules/` (zod, gensync, json-schema-traverse), none in the `src/` directory.

## Coverage

**No coverage configuration.** No coverage thresholds, no coverage reports, no instrumentation tool.

## Linting as Quality Gate

The project uses ESLint as its primary code quality tool. Configuration in `eslint.config.js`:

```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
```

Key lint rules enforced:
- `js.configs.recommended` — basic JS best practices
- `tseslint.configs.recommended` — TypeScript rules
- `reactHooks.configs.flat.recommended` — Rules of Hooks (no conditional hooks, etc.)
- `reactRefresh.configs.vite` — HMR safety rules

## TypeScript as Quality Gate

`tsconfig.app.json` enforces through the compiler:
- `noUnusedLocals: true` — no unused variables
- `noUnusedParameters: true` — no unused function parameters
- `noFallthroughCasesInSwitch: true` — switch/case safety
- `erasableSyntaxOnly: true` — prevent runtime-impacting type-only syntax
- `skipLibCheck: true` — skips library type checking for faster builds

## What Should Be Tested First (Priority Order)

### High Priority

1. **Store logic** (`src/stores/app-store.ts`, `src/stores/settings-store.ts`)
   - State update functions (toggleSelect, setRating, toggleFavorite, deleteImage)
   - Filtering logic (getFilteredImages with tag filters and search)
   - Sort logic
   - Async action flows (loadImages, importFolder)
   - Optimistic update and rollback patterns

2. **i18n** (`src/lib/i18n.tsx`)
   - Translation key resolution (dot-notation parsing)
   - Locale detection and fallback
   - Missing key fallback behavior

3. **Utility functions** (`src/lib/utils.ts`)
   - `cn()` class merging behavior

### Medium Priority

4. **Component rendering** (pages and major components)
   - `GalleryPage` — empty state, loading state, populated state, keyboard navigation
   - `DashboardPage` — empty state (no images), populated stats calculation
   - `Sidebar` — navigation, mobile collapse, stats display
   - `DetailPanel` — rating interaction, favorite toggle, null state (no detailImage)
   - `ImageCard` — hover states, selection toggle, favorite toggle, rating interaction

5. **Data transformation** (recordToImage, getTopTags)
   - `src/stores/app-store.ts`: `recordToImage()` function
   - `src/pages/DashboardPage.tsx`: `getTopTags()` function
   - `src/pages/GalleryPage.tsx`: `parseAspectRatio()` function

### Lower Priority

6. **UI components** (`src/components/ui/*`)
   - Button variants render correctly
   - Card sub-components compose correctly
   - Dialog open/close behavior

7. **Error boundaries** (`src/components/ErrorBoundary.tsx`, `src/components/PageErrorBoundary.tsx`)
   - Fallback UI renders on error
   - Children render when no error

8. **Keyboard navigation** (`src/pages/GalleryPage.tsx`)
   - Arrow key navigation
   - Enter to open, Space to select, Delete to remove
   - Escape to clear selection

## Recommended Test Setup

To add testing to this project, here is a Vitest + React Testing Library setup that matches the existing stack:

**Dependencies to add:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Configuration file** (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

**Setup file** (`src/test-setup.ts`):
```typescript
import '@testing-library/jest-dom/vitest'
```

**Scripts to add to `package.json`:**
```json
{
  "test": "vitest",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

## Test File Conventions (Recommended)

**Location:** Co-locate tests with source files. Use `*.test.ts` or `*.test.tsx` extensions.

```
src/
  lib/
    utils.test.ts          # Tests for cn()
  stores/
    app-store.test.ts      # Tests for app store
    settings-store.test.ts # Tests for settings store
  components/
    ImageCard.test.tsx     # Tests for ImageCard
    Sidebar.test.tsx       # Tests for Sidebar
  pages/
    GalleryPage.test.tsx   # Tests for GalleryPage
    DashboardPage.test.tsx # Tests for DashboardPage
```

**Naming:** `describe('ComponentName', () => { it('does something', () => { ... }) })` — match the file name in the top-level describe block.

**Test structure pattern** (suggested for this project):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  beforeEach(() => {
    // Reset stores, clear mocks
  })

  describe('rendering', () => {
    it('renders the component', () => {
      render(<MyComponent />)
      expect(screen.getByText('Expected Text')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('handles button click', async () => {
      const user = userEvent.setup()
      render(<MyComponent />)
      await user.click(screen.getByRole('button', { name: 'Click Me' }))
      // assert state change
    })
  })
})
```

**Store testing pattern** (suggested):
```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('useAppStore', () => {
  beforeEach(() => {
    const { getState } = useAppStore
    // Reset store to initial state
    getState().images = []
    getState().selectedIds = new Set()
  })

  it('toggles selection on and off', () => {
    const { getState } = useAppStore
    getState().toggleSelect('img-1')
    expect(getState().selectedIds.has('img-1')).toBe(true)
    getState().toggleSelect('img-1')
    expect(getState().selectedIds.has('img-1')).toBe(false)
  })
})
```

## Testing Gaps Summary

| Area | Gap | Risk |
|------|-----|------|
| Store logic | No tests for any state mutation or async action | Regressions in core data handling |
| i18n | No tests for key resolution or locale switching | UI text could silently break |
| Component rendering | No tests for any component | Visual regressions undetected |
| Error boundaries | No tests for error capture and fallback | Crashes present broken UI to user |
| Keyboard navigation | No tests for arrow key, Enter, Space, Delete | Accessibility regressions |
| Empty/loading states | No tests for zero-state UIs | Blank screens when data is missing |
| Utility functions | No tests for `cn()` or helpers | Class merging bugs in production builds |
| TypeScript | `tsc -b` only — no runtime type validation | Type mismatches at runtime possible |

---

*Testing analysis: 2026-06-21*
