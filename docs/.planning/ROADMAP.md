# Roadmap: Lumora

## Overview

v0.1 delivered the 古卷·灯火 image library — gallery, curation, command palette, keyboard navigation, and rating/favoriting. v0.2 built the AI-ready frontend: embedding status indicators, natural language semantic search, and an AI analysis panel — all with mocked AI data. v0.3 replaces every mock with real persistence, real AI inference via Python sidecar, and desktop packaging — transforming Lumora from a pure frontend SPA into a complete Tauri desktop application.

## Milestones

- 📋 **v0.1 MVP Frontend** — Phases 001-003 (not started)
- 📋 **v0.2 AI-Ready Frontend** — Phases 004-006 (not started)
- 📋 **v0.3 Tauri Backend** — Phases 007-012 (not started)

## Phases

- [ ] **Phase 004: Embedding Foundation & AI Infrastructure** — API stub layer, Zustand AI stores, embedding status UI
- [ ] **Phase 005: Semantic Search UI** — Natural language search with similarity scores
- [ ] **Phase 006: AI Analysis Panel** — Image descriptions, tag suggestions, analysis history
- [ ] **Phase 007: Rust Data Layer** — SQLite + FTS5 + CRUD + versioned schema migrations
- [ ] **Phase 008: Python AI Sidecar** — PyInstaller binary + JSON-RPC + CLIP embeddings
- [ ] **Phase 009: Frontend-Backend Connection** — Replace mock API stubs with Tauri IPC invoke()
- [ ] **Phase 010: Vector Search** — sqlite-vec + exhaustive KNN wired to SemanticSearchBar
- [ ] **Phase 011: AI Analysis** — Ollama detection + description/tags + degraded UI
- [ ] **Phase 012: Packaging & Verification** — Windows .msi installer + CI + smoke test

## Phase Details

<details>
<summary>✅ v0.1 MVP Frontend (Phases 001-003) — SHIPPED 2026-06-21</summary>

### Phase 001: UI Polish
**Goal**: Clean anti-patterns and audit all UI primitives for DESIGN.md compliance
**Plans**: 2 plans

Plans:
- [ ] 001-01 — Anti-pattern cleanup (lucide icons, hover:scale, PlumFlower extraction) + 12 UI primitives audit
- [ ] 001-02 — Migration debt cleanup (Tauri, react-router-dom, TrashPage) + 10 business + 5 pages audit

### Phase 002: Feature Completion
**Goal**: Complete command palette search, toast notifications, DropZone rewrite, and keyboard shortcuts
**Plans**: 3 plans

Plans:
- [ ] 002-01 — CommandPalette: local search filtering, 150ms debounce, text-only commands, themed empty state
- [ ] 002-02 — Toast notification system + DropZone rewrite (no fake progress, SVG support, toast + auto-navigate)
- [ ] 002-03 — Keyboard shortcuts: SettingsPage reference completion + F key favorite handler

### Phase 003: Build & Verify
**Goal**: Zero TypeScript errors, zero ESLint warnings, clean production build, visual spot-check all pages
**Plans**: 1 plan

Plans:
- [ ] 003-01 — Fix 25 ESLint errors + 2 warnings across 10 files, verify clean tsc/build/lint, visual spot-check all 5 pages

</details>

<details>
<summary>✅ v0.2 AI-Ready Frontend (Phases 004-006) — SHIPPED 2026-06-21</summary>

### Phase 004: Embedding Foundation & AI Infrastructure
**Goal**: AI data infrastructure is in place, and users can see embedding status throughout the app (cards, detail panel, dashboard)
**Depends on**: v0.1 complete (Phase 003)
**Requirements**: INT-01, INT-02, INT-03, INT-04, EMB-01, EMB-02, EMB-03, EMB-04
**Success Criteria** (what must be TRUE):
  1. User can see embedding status indicators (embedded ✓ / pending ○ / error ✗) on image cards in the gallery
  2. User can view embedding vector dimensions and generation timestamp in the DetailPanel when available
  3. User can see embedding coverage statistics (embedded count / total) on the Dashboard
  4. User can select multiple gallery images and trigger batch embedding generation, observing progress feedback
  5. All new UI text is available in both English and Chinese, and all new components follow DESIGN.md color/typography/spacing rules
**Plans**: 3 plans

Plans:
- [ ] 004-01-PLAN.md — API stubs, Zustand embedding store, i18n keys (INT-01, INT-02, INT-03)
- [ ] 004-02-PLAN.md — EmbeddingStatusBadge, ImageCard integration, EmbeddingDetailCard, DetailPanel integration, Dashboard stats (EMB-01, EMB-02, EMB-03, INT-04)
- [ ] 004-03-PLAN.md — BatchEmbeddingBar, GalleryPage integration with progress feedback (EMB-04, INT-04)

**UI hint**: yes

### Phase 005: Semantic Search UI
**Goal**: Users can search images using natural language descriptions and see relevance-ranked results with similarity scores
**Depends on**: Phase 004 (needs API stubs and embedding data flow)
**Requirements**: SEM-01, SEM-02, SEM-03, SEM-04, SEM-05
**Success Criteria** (what must be TRUE):
  1. User can type a natural language query ("sunset over mountains") into the semantic search input and see matching results
  2. User can see similarity scores (0-100%) displayed next to each search result
  3. User can toggle between exact-match search (current ⌘K behavior) and semantic search modes
  4. User sees descriptive search suggestions / autocomplete when typing in the semantic search field
  5. User sees a helpful empty state prompt ("describe what you're looking for...") when the semantic search field is empty
**Plans**: 3 plans

Plans:
- [ ] 005-01-PLAN.md — API stubs (searchSemantic, getSearchSuggestions), Zustand semantic search store, i18n keys (SEM-01, SEM-03)
- [ ] 005-02-PLAN.md — SimilarityScore badge component, SemanticSearchBar (input + mode toggle + autocomplete dropdown) (SEM-01, SEM-02, SEM-03, SEM-04, SEM-05)
- [ ] 005-03-PLAN.md — GalleryPage integration (search bar + filtering + empty state + shortcut), ImageCard integration (similarity score badge) (SEM-01, SEM-02, SEM-05)
**UI hint**: yes

### Phase 006: AI Analysis Panel
**Goal**: Users can view AI-generated image descriptions, manage AI-proposed tags with confidence scores, and browse analysis history
**Depends on**: Phase 004 (needs API stubs and embedding data flow; can run parallel to Phase 005)
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05
**Success Criteria** (what must be TRUE):
  1. User can view an AI-generated image description in the DetailPanel AI Analysis section
  2. User can see AI-proposed tag suggestions with confidence scores and accept or reject each individual tag
  3. User can see content analysis results (detected objects, color palette, composition notes) for an image in the DetailPanel
  4. User can trigger AI analysis for a specific image via an "Analyze with AI" button in the DetailPanel
  5. User can browse a history of past analysis runs with timestamps and summary results in the DetailPanel
**Plans**: 3 plans

Plans:
- [ ] 006-01-PLAN.md — API stubs (analyzeImage, getAnalysisResult, getAnalysisHistory), Zustand ai-analysis-store, i18n keys (AI-01 through AI-05 data layer)
- [ ] 006-02-PLAN.md — TagSuggestionCard, ColorPaletteStrip, AnalysisHistoryList sub-components (AI-02, AI-03, AI-05)
- [ ] 006-03-PLAN.md — AiAnalysisSection container + DetailPanel integration (AI-01, AI-04)

**UI hint**: yes

</details>

### 📋 v0.3 Tauri Backend (Planned)

**Milestone Goal:** Replace every mock with real infrastructure — SQLite persistence, Python CLIP embeddings, Ollama AI analysis, sqlite-vec semantic search, and a single Windows .msi installer. Transform Lumora from a pure frontend SPA into a complete Tauri desktop application.

**Architecture:**
```
Tauri v2 shell
├── React 19 frontend (existing Lumora UI)
├── Rust backend (SQLite + FTS5 + rusqlite + sqlite-vec)
└── Python AI sidecar (PyInstaller, stdin/stdout JSON-RPC)
```

#### Phase 007: Rust Data Layer
**Goal**: Lumora has persistent local storage — image metadata survives restarts, FTS5 powers full-text search, and schema migrations keep the database versioned
**Depends on**: v0.2 complete (Phase 006)
**Requirements**: RDL-01, RDL-02, RDL-03, RDL-04, RDL-05
**Success Criteria** (what must be TRUE):
  1. User imports an image and it persists across app restarts — metadata and file path survive process termination
  2. User searches by filename or tag and receives FTS5-ranked results, not mock filtering
  3. User changes a setting in the UI, closes the app, reopens — the setting value is preserved
  4. The database schema can be migrated forward to a newer version without data loss when the app updates
  5. Imported images have thumbnails (512x512 webp) generated and displayed automatically in the gallery
**Plans**: 8 plans

Plans:
- [ ] 007-01-PLAN.md — Environment provisioning: install Rust, MSVC Build Tools, tauri-cli (checkpoint)
- [ ] 007-02-PLAN.md — Frontend isTauri cleanup: fix dead calls, create detection utility, add @tauri-apps/api (D-24)
- [ ] 007-03-PLAN.md — Tauri bootstrap: cargo tauri init, Cargo.toml, config, module stubs (checkpoint for 14 crates)
- [ ] 007-04-PLAN.md — Database layer: SQLite schema v1-v5, FTS5 triggers, models, WAL mode (RDL-01)
- [ ] 007-05-PLAN.md — Tauri commands: image CRUD + FTS5 search commands (RDL-02, RDL-03)
- [ ] 007-06-PLAN.md — Settings persistence: plugin-store commands, localStorage migration (RDL-04)
- [ ] 007-07-PLAN.md — File system + imaging: import pipeline, thumbnails, dedup, folder scan (RDL-05)
- [ ] 007-08-PLAN.md — UI elements: progress bar, settings fields, failure markers, dialogs, empty states

#### Phase 008: Python AI Sidecar
**Goal**: A self-contained Python binary launches alongside the app, communicates via stdin/stdout JSON-RPC, and generates CLIP embeddings on demand
**Depends on**: Nothing (parallel with Phase 007 — no shared code)
**Requirements**: PY-01, PY-02, PY-03, PY-04
**Success Criteria** (what must be TRUE):
  1. The app launches the Python sidecar binary on start and terminates it cleanly on exit
  2. Sending an image path to the sidecar via JSON-RPC returns a CLIP embedding vector of correct dimensionality
  3. Health-check pings every 30 seconds keep the sidecar connection alive and detect unexpected sidecar termination
  4. Batch embedding requests process up to 4 images concurrently with per-item progress reported back to the frontend
**Plans**: 5 plans

Plans:
- [ ] 008-01-PLAN.md — Python sidecar core: JSON-RPC server, CLIP model loading, health check, main entry point (PY-01, PY-02, PY-03)
- [ ] 008-02-PLAN.md — Tauri sidecar integration: tauri-plugin-shell, Rust SidecarManager, 30s health pings (PY-02, PY-03)
- [ ] 008-03-PLAN.md — Python test suite: pytest config, fixtures, unit tests for JSON-RPC/model/health (PY-01, PY-02, PY-03)
- [ ] 008-04-PLAN.md — Batch embedding: ThreadPoolExecutor, progress notifications, error isolation (PY-04)
- [ ] 008-05-PLAN.md — PyInstaller build + E2E verification: requirements.txt, build.py, binary verification (PY-01, PY-02)

#### Phase 009: Frontend-Backend Connection
**Goal**: The existing Lumora UI reads and writes real data — no mock API stubs remain, every data path goes through Tauri IPC to the Rust backend
**Depends on**: Phase 007 AND Phase 008 (connection needs both sides built)
**Requirements**: FBC-01, FBC-02, FBC-03, FBC-04
**Success Criteria** (what must be TRUE):
  1. Image gallery displays real imported images from SQLite — gallery is not empty on first open after import
  2. Clicking "Import" opens the native file/folder picker dialog, and selected images appear in the gallery
  3. Settings changed in the UI persist across app restarts via Tauri plugin-store read/write commands
  4. Loading states show skeleton placeholders while data fetches, with an error state and retry button on failure
**Plans**: 8 plans

Plans:
- [ ] 007-01-PLAN.md — Environment provisioning: install Rust, MSVC Build Tools, tauri-cli (checkpoint)
- [ ] 007-02-PLAN.md — Frontend isTauri cleanup: fix dead calls, create detection utility, add @tauri-apps/api (D-24)
- [ ] 007-03-PLAN.md — Tauri bootstrap: cargo tauri init, Cargo.toml, config, module stubs (checkpoint for 14 crates)
- [ ] 007-04-PLAN.md — Database layer: SQLite schema v1-v5, FTS5 triggers, models, WAL mode (RDL-01)
- [ ] 007-05-PLAN.md — Tauri commands: image CRUD + FTS5 search commands (RDL-02, RDL-03)
- [ ] 007-06-PLAN.md — Settings persistence: plugin-store commands, localStorage migration (RDL-04)
- [ ] 007-07-PLAN.md — File system + imaging: import pipeline, thumbnails, dedup, folder scan (RDL-05)
- [ ] 007-08-PLAN.md — UI elements: progress bar, settings fields, failure markers, dialogs, empty states
**UI hint**: yes

#### Phase 010: Vector Search
**Goal**: Users can search images by semantic meaning — natural language queries return visually similar results ranked by vector distance
**Depends on**: Phase 008 AND Phase 009 (semantic search needs embeddings + IPC wired)
**Requirements**: VEC-01, VEC-02, VEC-03, VEC-04
**Success Criteria** (what must be TRUE):
  1. An image imported into Lumora automatically gets a CLIP embedding generated via the sidecar and stored in sqlite-vec
  2. Typing a natural language query into the SemanticSearchBar returns images ranked by vector similarity
  3. KNN search results are ordered by cosine distance, with the most similar image appearing first
  4. If embedding generation fails for an image, it still appears in the gallery but shows an embedding-error status badge with a retry option
**Plans**: 8 plans

Plans:
- [ ] 007-01-PLAN.md — Environment provisioning: install Rust, MSVC Build Tools, tauri-cli (checkpoint)
- [ ] 007-02-PLAN.md — Frontend isTauri cleanup: fix dead calls, create detection utility, add @tauri-apps/api (D-24)
- [ ] 007-03-PLAN.md — Tauri bootstrap: cargo tauri init, Cargo.toml, config, module stubs (checkpoint for 14 crates)
- [ ] 007-04-PLAN.md — Database layer: SQLite schema v1-v5, FTS5 triggers, models, WAL mode (RDL-01)
- [ ] 007-05-PLAN.md — Tauri commands: image CRUD + FTS5 search commands (RDL-02, RDL-03)
- [ ] 007-06-PLAN.md — Settings persistence: plugin-store commands, localStorage migration (RDL-04)
- [ ] 007-07-PLAN.md — File system + imaging: import pipeline, thumbnails, dedup, folder scan (RDL-05)
- [ ] 007-08-PLAN.md — UI elements: progress bar, settings fields, failure markers, dialogs, empty states

#### Phase 011: AI Analysis
**Goal**: When Ollama is available, Lumora generates AI-powered image descriptions and tag suggestions; when unavailable, the UI guides users to install it
**Depends on**: Phase 008 AND Phase 009 (AI analysis needs sidecar + IPC wired)
**Requirements**: OLL-01, OLL-02, OLL-03, OLL-04, OLL-05
**Success Criteria** (what must be TRUE):
  1. The app detects whether Ollama is reachable at localhost:11434 and shows a clear availability indicator in the UI
  2. A user can trigger AI analysis on an image and receive a natural language description from a vision model
  3. The user receives AI-suggested tags with confidence scores and can accept or reject each individually
  4. When Ollama is not available, the AI analysis section shows clear messaging with installation instructions and a direct link
  5. All analysis results (descriptions, tags, timestamps) persist in SQLite and are restored across app restarts
**Plans**: 8 plans

Plans:
- [ ] 007-01-PLAN.md — Environment provisioning: install Rust, MSVC Build Tools, tauri-cli (checkpoint)
- [ ] 007-02-PLAN.md — Frontend isTauri cleanup: fix dead calls, create detection utility, add @tauri-apps/api (D-24)
- [ ] 007-03-PLAN.md — Tauri bootstrap: cargo tauri init, Cargo.toml, config, module stubs (checkpoint for 14 crates)
- [ ] 007-04-PLAN.md — Database layer: SQLite schema v1-v5, FTS5 triggers, models, WAL mode (RDL-01)
- [ ] 007-05-PLAN.md — Tauri commands: image CRUD + FTS5 search commands (RDL-02, RDL-03)
- [ ] 007-06-PLAN.md — Settings persistence: plugin-store commands, localStorage migration (RDL-04)
- [ ] 007-07-PLAN.md — File system + imaging: import pipeline, thumbnails, dedup, folder scan (RDL-05)
- [ ] 007-08-PLAN.md — UI elements: progress bar, settings fields, failure markers, dialogs, empty states
**UI hint**: yes

#### Phase 012: Packaging & Verification
**Goal**: Lumora ships as a single Windows .msi installer with CI-verified builds — user runs one installer and gets everything
**Depends on**: Phase 007, Phase 008, Phase 009, Phase 010, Phase 011 (packaging wraps everything)
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04
**Success Criteria** (what must be TRUE):
  1. Running the .msi installer produces a launchable Lumora desktop application with no additional setup required
  2. The installed app successfully imports images, performs FTS5 search, semantic search, and AI analysis end-to-end
  3. CI builds the full application on every push to main and fails if the build breaks
  4. The Python sidecar is bundled inside the installer — no separate Python installation needed by the user
**Plans**: 8 plans

Plans:
- [ ] 007-01-PLAN.md — Environment provisioning: install Rust, MSVC Build Tools, tauri-cli (checkpoint)
- [ ] 007-02-PLAN.md — Frontend isTauri cleanup: fix dead calls, create detection utility, add @tauri-apps/api (D-24)
- [ ] 007-03-PLAN.md — Tauri bootstrap: cargo tauri init, Cargo.toml, config, module stubs (checkpoint for 14 crates)
- [ ] 007-04-PLAN.md — Database layer: SQLite schema v1-v5, FTS5 triggers, models, WAL mode (RDL-01)
- [ ] 007-05-PLAN.md — Tauri commands: image CRUD + FTS5 search commands (RDL-02, RDL-03)
- [ ] 007-06-PLAN.md — Settings persistence: plugin-store commands, localStorage migration (RDL-04)
- [ ] 007-07-PLAN.md — File system + imaging: import pipeline, thumbnails, dedup, folder scan (RDL-05)
- [ ] 007-08-PLAN.md — UI elements: progress bar, settings fields, failure markers, dialogs, empty states

## Progress

**Execution Order:** Phases execute in numeric order. 007 and 008 can run in parallel. 009 requires both 007 and 008. 010 and 011 require 008 and 009 (can run in parallel thereafter). 012 requires all preceding phases.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 001. UI Polish | v0.1 | 0/2 | Not started |  |
| 002. Feature Completion | v0.1 | 0/3 | Not started |  |
| 003. Build & Verify | v0.1 | 0/1 | Not started |  |
| 004. Embedding Foundation | v0.2 | 0/3 | Not started |  |
| 005. Semantic Search | v0.2 | 0/3 | Not started |  |
| 006. AI Analysis Panel | v0.2 | 0/3 | Not started |  |
| 007. Rust Data Layer | v0.3 | 0/8 | Not started |  |
| 008. Python AI Sidecar | v0.3 | 0/5 | Not started |  |
| 009. Frontend-Backend Connection | v0.3 | 0/1 | Not started |  |
| 010. Vector Search | v0.3 | 0/1 | Not started |  |
| 011. AI Analysis | v0.3 | 0/1 | Not started |  |
| 012. Packaging & Verification | v0.3 | 0/1 | Not started |  |
