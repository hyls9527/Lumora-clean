# Roadmap: Lumora

## Overview

v0.1 delivered the 古卷·灯火 image library — gallery, curation, command palette, keyboard navigation, and rating/favoriting. v0.2 builds the AI-ready frontend: embedding status indicators, natural language semantic search, and an AI analysis panel. All AI data is mocked via API stubs. No backend, no model inference — pure frontend UI readiness for future API integration.

## Milestones

- ✅ **v0.1 MVP Frontend** — Phases 001-003 (shipped 2026-06-21)
- 🚧 **v0.2 AI-Ready Frontend** — Phases 004-006 (current)

## Phases

- [x] **Phase 004: Embedding Foundation & AI Infrastructure** — API stub layer, Zustand AI stores, embedding status UI
- [x] **Phase 005: Semantic Search UI** — Natural language search with similarity scores
- [ ] **Phase 006: AI Analysis Panel** — Image descriptions, tag suggestions, analysis history

## Phase Details

<details>
<summary>✅ v0.1 MVP Frontend (Phases 001-003) — SHIPPED 2026-06-21</summary>

### Phase 001: UI Polish
**Goal**: Clean anti-patterns and audit all UI primitives for DESIGN.md compliance
**Plans**: 2 plans

Plans:
- [x] 001-01 — Anti-pattern cleanup (lucide icons, hover:scale, PlumFlower extraction) + 12 UI primitives audit
- [x] 001-02 — Migration debt cleanup (Tauri, react-router-dom, TrashPage) + 10 business + 5 pages audit

### Phase 002: Feature Completion
**Goal**: Complete command palette search, toast notifications, DropZone rewrite, and keyboard shortcuts
**Plans**: 3 plans

Plans:
- [x] 002-01 — CommandPalette: local search filtering, 150ms debounce, text-only commands, themed empty state
- [x] 002-02 — Toast notification system + DropZone rewrite (no fake progress, SVG support, toast + auto-navigate)
- [x] 002-03 — Keyboard shortcuts: SettingsPage reference completion + F key favorite handler

### Phase 003: Build & Verify
**Goal**: Zero TypeScript errors, zero ESLint warnings, clean production build, visual spot-check all pages
**Plans**: 1 plan

Plans:
- [x] 003-01 — Fix 25 ESLint errors + 2 warnings across 10 files, verify clean tsc/build/lint, visual spot-check all 5 pages

</details>

### 🚧 v0.2 AI-Ready Frontend (Current)

**Milestone Goal:** Build all frontend UI for three AI capabilities (semantic embeddings, natural language search, LLM analysis) — backend-free, ready for future API integration.

#### Phase 004: Embedding Foundation & AI Infrastructure
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
- [x] 004-01-PLAN.md — API stubs, Zustand embedding store, i18n keys (INT-01, INT-02, INT-03)
- [x] 004-02-PLAN.md — EmbeddingStatusBadge, ImageCard integration, EmbeddingDetailCard, DetailPanel integration, Dashboard stats (EMB-01, EMB-02, EMB-03, INT-04)
- [x] 004-03-PLAN.md — BatchEmbeddingBar, GalleryPage integration with progress feedback (EMB-04, INT-04)

**UI hint**: yes

#### Phase 005: Semantic Search UI
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
- [x] 005-01-PLAN.md — API stubs (searchSemantic, getSearchSuggestions), Zustand semantic search store, i18n keys (SEM-01, SEM-03)
- [x] 005-02-PLAN.md — SimilarityScore badge component, SemanticSearchBar (input + mode toggle + autocomplete dropdown) (SEM-01, SEM-02, SEM-03, SEM-04, SEM-05)
- [x] 005-03-PLAN.md — GalleryPage integration (search bar + filtering + empty state + shortcut), ImageCard integration (similarity score badge) (SEM-01, SEM-02, SEM-05)
**UI hint**: yes

#### Phase 006: AI Analysis Panel
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
- [x] 006-01-PLAN.md — API stubs (analyzeImage, getAnalysisResult, getAnalysisHistory), Zustand ai-analysis-store, i18n keys (AI-01 through AI-05 data layer)
- [ ] 006-02-PLAN.md — TagSuggestionCard, ColorPaletteStrip, AnalysisHistoryList sub-components (AI-02, AI-03, AI-05)
- [ ] 006-03-PLAN.md — AiAnalysisSection container + DetailPanel integration (AI-01, AI-04)

**UI hint**: yes

## Progress

**Execution Order:** Phases execute in numeric order: 004 → 005 → 006 (006 can start after 004)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 001. UI Polish | v0.1 | 2/2 | Complete | 2026-06-20 |
| 002. Feature Completion | v0.1 | 3/3 | Complete | 2026-06-20 |
| 003. Build & Verify | v0.1 | 1/1 | Complete | 2026-06-21 |
| 004. Embedding Foundation | v0.2 | 3/3 | Complete   | 2026-06-21 |
| 005. Semantic Search | v0.2 | 3/3 | Complete   | 2026-06-21 |
| 006. AI Analysis Panel | v0.2 | 1/3 | In Progress|  |
