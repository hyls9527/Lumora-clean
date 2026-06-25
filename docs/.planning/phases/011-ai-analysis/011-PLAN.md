---
phase: "011"
plan: "011"
type: "feature"
autonomous: true
wave: 1
depends_on: ["006", "007"]
requirements:
  - OLL-01
  - OLL-02
  - OLL-03
  - OLL-04
  - OLL-05
---

# Phase 011: AI Analysis

When Ollama is available, Lumora generates AI-powered image descriptions and tag suggestions. When unavailable, the UI guides users to install it.

## Requirements

- **OLL-01:** Ollama availability detection — health check at localhost:11434
- **OLL-02:** Image description generation via Ollama vision model
- **OLL-03:** Tag suggestion generation via Ollama
- **OLL-04:** Degraded UI when Ollama unavailable — clear messaging, install link
- **OLL-05:** Analysis history persistence in SQLite

## Tasks

### Task 1: Ollama health check + analysis infrastructure
- Add `reqwest` to Cargo.toml
- Create `src-tauri/src/ollama/` module — `mod.rs`, `client.rs`
- `check_ollama()` — GET http://localhost:11434/api/tags, returns available models
- Add `check_ollama` Tauri command
- Create migration v7: `analysis_history` table (image_id, description, tags_json, model_used, created_at)

### Task 2: Image description and tag suggestion commands
- `analyze_image` Tauri command — sends image to Ollama vision model, gets description
- `suggest_tags` Tauri command — sends image info to Ollama, gets tag suggestions
- Store results in analysis_history table
- If Ollama unavailable: return clear error
- Support minicpm-v, llava, or any vision model the user has installed

### Task 3: Frontend wiring — real AI analysis
- Update `ai-analysis-store.ts` — wire to Tauri IPC
- Replace mock stubs in API layer with real invoke() calls
- Handle: loading state, analysis in progress, results display, error state
- Degraded UI per OLL-04: when Ollama not detected, show install message with link

### Task 4: Analysis history persistence + UI
- Wire analysis history loading from SQLite
- Update AnalysisHistoryList to show real history
- Add re-analyze button

## Success Criteria

- `cargo check` passes after Rust changes
- `npx tsc --noEmit` passes after frontend changes
- reqwest with `rustls-tls` feature (no OpenSSL dependency on Windows)
- When Ollama is running: AI analysis produces descriptions and tags
- When Ollama is not running: UI shows install guidance with link to ollama.com
- Analysis results persist across app restarts via SQLite
