# Phase 005: Tauri Backend Integration

## Domain
Initialize Tauri 2 in the Lumora project and set up the Rust backend.
This is the foundation for real image loading, SQLite database, and file system access.

## Decisions
- Use Tauri 2 (not Electron) for small bundle size (2-10MB)
- SQLite via rusqlite for local-first data storage
- FTS5 for full-text search
- Clean Architecture: Commands → Domain ← Infra
- Domain layer has zero external dependencies
- All Tauri IPC commands return `Result<T, String>`

## Architecture (from ARCHITECTURE.md)
```
Commands → Domain ← Infra
  (薄)      (纯)     (IO)
```

## Deferred
- CLIP/ONNX integration (v0.2)
- Ollama LLM integration (v0.2)
- Tantivy search (using FTS5 instead)
- Electron (bundle too large)
