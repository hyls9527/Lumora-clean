# Phase 009: Frontend-Backend Connection — Context

**Created:** 2026-06-23
**Status:** Ready for execution (research+plan deferred — straightforward integration)

## Phase Boundary

Connect the existing Lumora UI (React frontend) to the Phase 007 Rust backend via Tauri IPC. Replace all mock API stubs with real `invoke()` calls. Transform Lumora from a mock-data demo into a working desktop app.

## Requirements

- **FBC-01:** Replace all mock API stubs with Tauri IPC invoke() calls
- **FBC-02:** Real file import via native folder picker dialog (tauri-plugin-dialog)
- **FBC-03:** Settings read/write via Tauri store commands
- **FBC-04:** Image loading states — skeleton → real data, error fallback with retry

## Key Integration Points

All Phase 9 placeholder comments (`// Phase 9: invoke(...)`) are in:
- `src/stores/app-store.ts` — 6 actions with isTauri() gating
- `src/components/DropZone.tsx` — isTauri() import placeholder
- `src/stores/settings-store.ts` — localStorage-based, needs Tauri store migration

Tauri commands (all implemented in Phase 007):
- `list_images`, `import_images`, `update_image`, `delete_image`, `search_images`, `get_image_count`
- `get_setting`, `set_setting`, `migrate_legacy_settings`, `reset_settings`
- `open_folder_dialog`

## Approach

Direct execution — no research or detailed planning needed. The work is:
1. Replace Zustand store mock data with Tauri IPC calls
2. Wire up settings to tauri-plugin-store
3. Add loading/error states
4. Verify type-check and E2E behavior
