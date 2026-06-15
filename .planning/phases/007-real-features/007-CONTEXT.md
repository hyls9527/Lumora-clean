# Phase 007: Real Features

## Domain
Add real functionality to the Lumora MVP:
1. Real image import from filesystem (Tauri dialog + filesystem API)
2. Settings persistence (SQLite app_config table)
3. FTS5 full-text search integration
4. Final verification + screenshots

## Current State
- Frontend connected to Tauri backend via IPC
- 7 Tauri commands implemented
- Error boundaries and loading states added
- Mock data used as fallback in browser preview

## Architecture
```
Frontend (React)
    ↓ invoke()
Tauri IPC
    ↓
Backend (Rust)
    ↓
SQLite Database + Filesystem
```

## Deferred
- CLIP/ONNX integration (v0.2)
- Ollama LLM integration (v0.2)
- Duplicate detection (v0.2)
- Backup/restore (v0.2)
