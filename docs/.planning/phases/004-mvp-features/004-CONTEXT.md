# Phase 004: MVP Feature Enhancement

## Domain
Add interactive features to the Lumora MVP that work without the Tauri backend.
Focus on: performance, keyboard navigation, drag-drop, search, tags, export.

## Decisions
- Virtual scrolling for large grids (react-window or similar)
- Keyboard shortcuts (arrow keys, space, delete, etc.)
- Drag-drop import simulation (visual feedback only)
- Search integration with command palette (already exists)
- Tag management UI (create, assign, filter)
- Export UI (format selection, destination)

## Deferred
- Tauri backend integration (needs Rust setup)
- Real image loading (needs filesystem access)
- AI analysis (needs CLIP/LLM)
