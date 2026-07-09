# Changelog

All notable changes to Lumora are documented here.

## v0.5.1 (2026-07-07)

### Added
- Dark theme: "暗夜" palette with warm candlelight accents
- `tokens.ts` unified to CSS variables (theme-responsive)
- DESIGN.md documents both light and dark color palettes

### Fixed
- Drag-and-drop import now actually imports files
- Manual import supports selecting individual files, not just folders
- Settings/Export/Import/Search pages no longer center content vertically
- Settings page layout aligned to top
- 18 hardcoded Chinese strings replaced with i18n calls
- Missing i18n keys for backup/export/import buttons
- Database import writes to staging file first (avoids corrupting active WAL)
- TypeScript errors in imageStore tests
- Sidebar navigation labels now use i18n

### Added
- File import button alongside folder import
- Database backup/restore in Settings (export/import SQLite)
- Image loading retry (up to 2 attempts with exponential backoff)
- 29 new tests: ImportPage integration, write commands lifecycle, store coverage
- Rust tests for single-file import (57 total)

### Performance
- LazyLoad placeholder uses actual image height from metadata

## v0.5.0 (2026-07-06)

### Added
- Search by image: pick a reference image to find visually similar results
- Batch AI tag: select multiple images and auto-tag in one action
- Performance budget script (`scripts/perf-budget.mjs`)
- Security audit CI workflow (npm audit + cargo audit weekly scan)
- GitHub Issue template for user feedback

### Fixed
- Circular dependency: `tauri.ts` ↔ `semanticCache.ts` resolved with `onWriteCommand` callback
- Layout shift on page switch (overflow: hidden on main container)
- 3 audit defects repaired

### Changed
- Style tokenization: 258/286 hardcoded values replaced with `tokens.ts`
- i18n completion: 25+ hardcoded Chinese strings replaced with `t()` calls
- Page splitting: SearchPage 611→429 lines, ImportPage 564→393 lines
- Test coverage: 267→311 tests (+44, +16%)
- Knowledge graph auto-update configured

## v0.4.0 (2026-07-05)

### Added
- Responsive layout with `useMediaQuery` hook

### Fixed
- 7 code quality issues from audit
- CLAUDE.md condensed from 3938→1650 bytes

### Changed
- TDD refactor: shared modules extracted, duplication eliminated
- Ponytail audit + UI optimizations

## v0.3.4 (2026-07-04)

Version bump only.

## v0.3.3 (2026-07-04)

### Fixed
- Image preview display
- Ollama detection reliability
- Batch delete confirmation
- Import feedback (loading states)
- Splash screen and app icon
- Updater signing pubkey in tauri.conf.json

## v0.3.2 (2026-07-03)

### Added
- PNG metadata extraction: SD/ComfyUI parameters auto-parsed on import
- Variant tracing (v6 schema): images with same prompt grouped as variants
- Smart collections: auto-grouped images by model, prompt pattern
- Auto-tagging: AI analysis results auto-create and associate tags
- `search_images_advanced`: field-scoped search (seed, prompt, model)

### Fixed
- Silent error swallowing in catch blocks
- FavoritesPage rewritten
- Shared format utility extracted
- OLLAMA_HOST config unified (frontend reads from Rust backend)
- CLIP commands registered in invoke_handler
- Audit corrections: docs accuracy, error handling, transaction safety

### Changed
- ARCHITECTURE.md updated with schema v6, variant groups, new commands

## v0.3.1 (2026-07-02)

### Added
- Semantic search cache with LRU eviction and TTL
- Ollama availability detection in sidebar
- Favorites page with favorite image filtering
- Auto-update via GitHub Releases
- CSP security policy
- Updater signing
- Custom app icons (古卷·灯火 lantern design)

### Fixed
- Cascade delete in `empty_trash`/`batch_permanent_delete`
- Cache race condition
- 8 audit defects
- Vec embeddings dimension mismatch (512→768)
- CSP: added github.com + fonts.googleapis.com
- White screen crash: `useTranslation` infinite loop + Tauri API fallback

### Changed
- Unified error handling with `AppError` enum
- Release workflow with minisign signing (later simplified to unsigned)

## v0.3.0 (2026-07-01)

### Added
- SQLite persistent storage with rusqlite
- Ollama integration (nomic-embed-text embedding + llava vision)
- sqlite-vec vector search
- Tauri commands for all CRUD operations
- Drag-and-drop file import
- Export functionality with format conversion and rename templates
- Embedding status tracking
- Batch embedding generation
- Performance benchmarks (bulk insert 1000 images)
- Windows .msi installer

### Changed
- Frontend API stubs replaced with real Tauri IPC calls
- Mock data removed

## v0.2 (2026-06-28)

### Added
- Embedding status badges on ImageCards
- Embedding detail card in image panel
- Batch embedding generation bar
- Embedding stats row in Dashboard
- Semantic search bar with autocomplete
- Similarity score badges (3 color tiers)
- AI analysis panel with tag suggestions
- Analysis history list
- Color palette extraction display
- i18n for embedding, semantic search, and AI analysis sections

## v0.1-mvp (2026-06-25)

### Added
- Tauri 2 + React 19 + TypeScript foundation
- SQLite database with FTS5 full-text search
- Gallery view with grid/list toggle and column controls
- Image import (folder selection)
- Image detail modal with metadata display
- Rating system (plum-blossom stamps, 0–5)
- Favorites (book collector's seal ◆)
- Tag system with color customization
- Trash with soft delete and restore
- Settings page (language, theme)
- Command palette (⌘K)
- Keyboard navigation (arrow keys, shortcuts)
- Dashboard with statistics overview
- Export with format selection
- Internationalization (Chinese/English)
- Design language: 古卷·灯火 (Ancient Scroll · Lamplight)
