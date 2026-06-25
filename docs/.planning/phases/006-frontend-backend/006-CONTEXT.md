# Phase 006: Frontend-Backend Integration

## Domain
Connect the React frontend to the Tauri Rust backend via IPC.
Replace mock data with real database queries and filesystem operations.

## Current State
- Frontend: React 19 + TypeScript + Tailwind CSS v4 + Zustand 5
- Backend: Tauri 2 + Rust + rusqlite (SQLite)
- API Layer: src/lib/api/images.ts (getImageCount, getImages, importFolder)
- Store: src/stores/app-store.ts (mock data generation)

## Architecture
```
Frontend (React)
    ↓ invoke()
Tauri IPC
    ↓
Backend (Rust)
    ↓
SQLite Database
```

## Deferred
- CLIP/ONNX integration (v0.2)
- Ollama LLM integration (v0.2)
- Real-time search (FTS5)
