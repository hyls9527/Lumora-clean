# Requirements: Lumora v0.3

**Defined:** 2026-06-22
**Core Value:** Real backend — from mock data to persistent storage, real AI inference, and desktop packaging

## v0.3 Requirements

### Rust Data Layer (RDL)

- [ ] **RDL-01**: SQLite database with versioned schema migration chain (rusqlite_migration)
- [ ] **RDL-02**: Image CRUD Tauri commands — import, list (pagination), update metadata, soft delete
- [ ] **RDL-03**: FTS5 full-text search on image paths and tags
- [ ] **RDL-04**: Settings persistence via tauri-plugin-store
- [ ] **RDL-05**: File system operations — recursive folder scan, thumbnail generation (512x512 webp)

### Python AI Sidecar (PY)

- [ ] **PY-01**: PyInstaller-packaged Python binary with CLIP embedding generation (open-clip-torch)
- [ ] **PY-02**: stdin/stdout JSON-RPC communication with Tauri sidecar lifecycle
- [ ] **PY-03**: Health check protocol — Tauri pings every 30s, sidecar responds
- [ ] **PY-04**: Batch embedding with streaming queue — max 4 concurrent, progress per item

### Frontend-Backend Connection (FBC)

- [ ] **FBC-01**: Replace all mock API stubs with Tauri IPC invoke() calls
- [ ] **FBC-02**: Real file import via native folder picker dialog (tauri-plugin-dialog)
- [ ] **FBC-03**: Settings read/write via Tauri store commands
- [ ] **FBC-04**: Image loading states — skeleton → real data, error fallback with retry

### Vector Search (VEC)

- [ ] **VEC-01**: sqlite-vec integration with abstracted backend trait
- [ ] **VEC-02**: Exhaustive KNN search on embedding vectors
- [ ] **VEC-03**: Semantic search Tauri command wired to existing SemanticSearchBar UI
- [ ] **VEC-04**: Embedding generation trigger from UI → Python sidecar → store in sqlite-vec

### AI Analysis (OLL)

- [ ] **OLL-01**: Ollama availability detection — health check at localhost:11434
- [ ] **OLL-02**: Image description generation via Ollama vision model
- [ ] **OLL-03**: Tag suggestion generation via Ollama
- [ ] **OLL-04**: Degraded UI when Ollama unavailable — clear messaging, install link
- [ ] **OLL-05**: Analysis history persistence in SQLite

### Packaging & Verification (PKG)

- [ ] **PKG-01**: Tauri production build — single installer (Windows .msi)
- [ ] **PKG-02**: Python sidecar bundled in installer via PyInstaller
- [ ] **PKG-03**: GitHub Actions CI — build + test on Windows
- [ ] **PKG-04**: End-to-end smoke test — install, launch, import, search, analyze

## Out of Scope

| Feature | Reason |
|---------|--------|
| macOS/Linux production builds | Windows first |
| HNSW ANN in sqlite-vec | Exhaustive KNN sufficient for now |
| Bundled Ollama | Too large (+3GB), user installs separately |
| Cloud sync | Local-first desktop app |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RDL-01 | 007 — Rust Data Layer | Pending |
| RDL-02 | 007 — Rust Data Layer | Pending |
| RDL-03 | 007 — Rust Data Layer | Pending |
| RDL-04 | 007 — Rust Data Layer | Pending |
| RDL-05 | 007 — Rust Data Layer | Pending |
| PY-01 | 008 — Python AI Sidecar | Pending |
| PY-02 | 008 — Python AI Sidecar | Pending |
| PY-03 | 008 — Python AI Sidecar | Pending |
| PY-04 | 008 — Python AI Sidecar | Pending |
| FBC-01 | 009 — Frontend-Backend Connection | Pending |
| FBC-02 | 009 — Frontend-Backend Connection | Pending |
| FBC-03 | 009 — Frontend-Backend Connection | Pending |
| FBC-04 | 009 — Frontend-Backend Connection | Pending |
| VEC-01 | 010 — Vector Search | Pending |
| VEC-02 | 010 — Vector Search | Pending |
| VEC-03 | 010 — Vector Search | Pending |
| VEC-04 | 010 — Vector Search | Pending |
| OLL-01 | 011 — AI Analysis | Pending |
| OLL-02 | 011 — AI Analysis | Pending |
| OLL-03 | 011 — AI Analysis | Pending |
| OLL-04 | 011 — AI Analysis | Pending |
| OLL-05 | 011 — AI Analysis | Pending |
| PKG-01 | 012 — Packaging & Verification | Pending |
| PKG-02 | 012 — Packaging & Verification | Pending |
| PKG-03 | 012 — Packaging & Verification | Pending |
| PKG-04 | 012 — Packaging & Verification | Pending |

**Coverage:**
- v0.3 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-22*
*Traceability updated: 2026-06-25 — Development progress reset to 0*
