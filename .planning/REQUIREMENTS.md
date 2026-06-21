# Requirements: Lumora v0.2

**Defined:** 2026-06-21
**Core Value:** AI-ready frontend — complete UI for semantic understanding, natural language search, and AI-powered analysis

## v0.2 Requirements

### Embedding Panel (EMB)

- [x] **EMB-01**: Gallery ImageCard shows an embedding status indicator (embedded ✓ / pending ○ / error ✗)
- [x] **EMB-02**: DetailPanel shows embedding vector dimensions and generation timestamp when available
- [x] **EMB-03**: Embedding status summary visible in Dashboard statistics
- [x] **EMB-04**: Batch embedding generation trigger UI (select images → "generate embeddings" action)

### Semantic Search (SEM)

- [x] **SEM-01**: Natural language search input — accepts descriptive queries ("sunset over mountains", "portrait with warm lighting")
- [x] **SEM-02**: Search results show similarity scores (0–100%) next to each result
- [x] **SEM-03**: Search suggestions / autocomplete based on common descriptive terms
- [x] **SEM-04**: Empty state for semantic search ("describe what you're looking for...")
- [x] **SEM-05**: Search mode toggle between exact match (current ⌘K) and semantic search

### AI Analysis Panel (AI)

- [ ] **AI-01**: DetailPanel includes an AI Analysis section showing generated image description
- [ ] **AI-02**: Tag suggestion cards — AI-proposed tags with confidence scores, accept/reject buttons
- [ ] **AI-03**: Content analysis display — objects detected, color palette extraction, composition notes
- [ ] **AI-04**: "Analyze with AI" trigger button on DetailPanel for individual images
- [ ] **AI-05**: Analysis history — list of past analysis runs with timestamps and summary results

### Integration (INT)

- [x] **INT-01**: New API stub layer for embedding/search/analysis endpoints (mock data, async pattern matching existing lib/api/)
- [x] **INT-02**: All new UI uses Zustand stores following existing patterns
- [x] **INT-03**: All new text uses i18n (en.json + zh.json)
- [x] **INT-04**: All new components follow DESIGN.md (colors, typography, spacing, transitions, anti-patterns)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Actual CLIP/ONNX model inference | Backend responsibility — UI only |
| Ollama integration / LLM calls | Backend responsibility — UI only |
| Vector database / persistence | Backend responsibility — UI only |
| Real semantic search ranking | Backend responsibility — mock data only |
| ONNX Runtime Web / Transformers.js | Deferred — v0.2 is pure UI readiness |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EMB-01 | Phase 004 | Complete |
| EMB-02 | Phase 004 | Complete |
| EMB-03 | Phase 004 | Complete |
| EMB-04 | Phase 004 | Complete |
| SEM-01 | Phase 005 | Complete |
| SEM-02 | Phase 005 | Complete |
| SEM-03 | Phase 005 | Complete |
| SEM-04 | Phase 005 | Complete |
| SEM-05 | Phase 005 | Complete |
| AI-01 | Phase 006 | Pending |
| AI-02 | Phase 006 | Pending |
| AI-03 | Phase 006 | Pending |
| AI-04 | Phase 006 | Pending |
| AI-05 | Phase 006 | Pending |
| INT-01 | Phase 004 | Complete |
| INT-02 | Phase 004 | Complete |
| INT-03 | Phase 004 | Complete |
| INT-04 | Phase 004 | Complete |

**Coverage:**
- v0.2 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-21 | Roadmap: 2026-06-22*
