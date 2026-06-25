# Technology Stack

**Analysis Date:** 2026-06-21

## Languages

**Primary:**
- TypeScript ~6.0.2 - All application code (`src/` directory)
- HTML - Single entry point (`index.html`)
- CSS - Tailwind CSS v4 with custom `@theme` tokens (`src/index.css`)

**Not Present:**
- Rust - Tauri/Rust backend was removed (commit `141182b`). No `src-tauri/` directory exists.
- No backend language. This is a pure frontend SPA.

## Runtime

**Development:**
- Node.js (version not pinned; no `.nvmrc` or `.node-version` file found)
- Vite 8.0.12 dev server on port 5173

**Production:**
- Static HTML/CSS/JS bundle produced by Vite
- No server-side rendering — client-side React 19 rendering only
- Deployment target: any static file host

**Package Manager:**
- npm (lockfile: `package-lock.json` present)
- `package.json` declares `"type": "module"` (ESM)

## Frameworks

**Core:**
| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.6 | UI framework |
| react-dom | ^19.2.6 | React DOM rendering |
| react-router-dom | ^7.17.0 | Client-side routing (view switching, no URL routes) |
| zustand | ^5.0.14 | Global state management |
| react-window | ^2.2.7 | Virtualized list rendering for image grids |

**Styling:**
| Package | Version | Purpose |
|---------|---------|---------|
| tailwindcss | ^4.3.1 | Utility-first CSS framework (v4 with CSS-first config) |
| @tailwindcss/vite | ^4.3.1 | Tailwind v4 Vite integration plugin |
| @radix-ui/react-dialog | ^1.1.17 | Accessible dialog/modal primitive |
| @radix-ui/react-tooltip | ^1.2.10 | Accessible tooltip primitive |
| class-variance-authority | ^0.7.1 | Variant-based component styling |
| clsx | ^2.1.1 | Conditional class name joining |
| tailwind-merge | ^3.6.0 | Tailwind class conflict resolution |
| lucide-react | ^1.18.0 | Icon library (installed but not used per DESIGN.md anti-patterns) |

**Fonts:**
| Package | Version | Purpose |
|---------|---------|---------|
| @fontsource-variable/dm-sans | ^5.2.8 | Body text font (DM Sans variable) |
| @fontsource/noto-serif-sc | ^5.2.9 | Chinese serif display/title font |
| @fontsource/jetbrains-mono | ^5.2.8 | Monospace font for code/technical text |

**Testing:**
No test framework or test files are configured. No vitest, jest, or testing-library packages are present in `package.json`. No `*.test.*` or `*.spec.*` files exist.

**Build/Dev:**
| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^8.0.12 | Build tool and dev server |
| @vitejs/plugin-react | ^6.0.1 | React Fast Refresh and JSX transform |
| typescript | ~6.0.2 | Type checking and compilation |
| eslint | ^10.3.0 | Static analysis and linting |
| typescript-eslint | ^8.59.2 | TypeScript ESLint integration |
| @eslint/js | ^10.0.1 | ESLint base rules |
| eslint-plugin-react-hooks | ^7.1.1 | React Hooks rules |
| eslint-plugin-react-refresh | ^0.5.2 | Vite HMR compatibility rules |
| globals | ^17.6.0 | Browser global definitions for ESLint |

## Configuration

**TypeScript:**
- Root config: `tsconfig.json` (project references only)
- App config: `tsconfig.app.json` — target ES2023, bundler module resolution, `@/*` path alias to `./src/*`
- Node config: `tsconfig.node.json` — for `vite.config.ts` only
- Strict mode: **NOT enabled** — `strict`, `noImplicitAny`, `strictNullChecks` are all absent
- Enabled checks: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`

**Vite:**
- Config: `vite.config.ts`
- Plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`
- Path alias: `@` → `./src` (configured in both Vite and TypeScript)
- Dev server: port 5173, `host: true` (accessible on network)
- Build: `minify: false` (unminified production builds)
- Build command: `tsc -b && vite build`

**ESLint:**
- Config: `eslint.config.js` (flat config format)
- Extends: `@eslint/js` recommended, `typescript-eslint` recommended, `react-hooks` recommended, `react-refresh` Vite rules
- Target files: `**/*.{ts,tsx}`
- Ignores: `dist/`

**Tailwind CSS v4:**
- CSS-first configuration via `@theme` block in `src/index.css`
- No `tailwind.config.ts` file — Tailwind v4 uses pure CSS configuration
- Custom design tokens defined for colors, shadows, border radii, and font families
- shadcn/ui components.json references this config (`"tailwind": { "config": "", "css": "src/index.css" }`)

**shadcn/ui Configuration:**
- File: `components.json`
- Style: `base-nova`, base color: `neutral`
- Aliases: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`
- Icon library: `lucide` (configured but not used per project anti-patterns)

## Key Dependencies

**Critical:**
- `react` ^19.2.6 — Core UI framework
- `zustand` ^5.0.14 — All application state flows through two stores (`app-store.ts`, `settings-store.ts`)
- `react-window` ^2.2.7 — Virtualized rendering for gallery grid (performance-critical for 10k+ images)
- `tailwindcss` ^4.3.1 — All styling; design tokens are entirely in the CSS `@theme` block

**Infrastructure:**
- `@radix-ui/react-dialog` and `@radix-ui/react-tooltip` — Two Radix primitives used for accessible overlay components
- `react-router-dom` ^7.17.0 — View switching (not URL-based routing; current implementation uses a single `view` state to render different page components)

## Platform Requirements

**Development:**
- Node.js with npm
- Port 5173 available
- Browser with ES2023 support (all modern browsers)

**Production:**
- Any static file host (Netlify, Vercel, GitHub Pages, S3 + CloudFront, etc.)
- No server required — the built output is pure static HTML/CSS/JS
- No environment variables required at runtime

---

*Stack analysis: 2026-06-21*
