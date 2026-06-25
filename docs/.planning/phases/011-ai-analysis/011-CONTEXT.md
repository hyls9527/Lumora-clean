# Phase 011 Context: AI Analysis

## Overview

Phase 011 integrates Ollama-based AI analysis into the Lumora image library. The frontend AI analysis panel was built in Phase 006 with mock data. Phase 011 replaces the mocks with real Ollama-powered image description, tag suggestion, and composition analysis.

## Architecture

```
[Frontend]                    [Tauri/Backend]              [Ollama]
AiAnalysisSection  ─invoke→   analyze_image    ─POST→     /api/generate
                              check_ollama     ─GET→      /api/tags
AnalysisHistoryList ─invoke→  get_analysis_history ─SQL→  analysis_history table
```

## Dependencies

- **Phase 006:** AI analysis panel components (AiAnalysisSection, TagSuggestionCard, AnalysisHistoryList)
- **Phase 007:** Rust Data Layer (database connection, migrations framework, command registration)

## Design Decisions

1. **reqwest with rustls-tls:** Avoids OpenSSL compilation on Windows
2. **No chrono dependency:** Custom ISO 8601 formatter to avoid pulling heavy date crates
3. **Vision model auto-detection:** Checks installed models against known vision model prefixes
4. **Browser fallback:** Mock data preserved for `vite dev` without Tauri
5. **Progress bar UX:** Caps at 90% during real analysis to signal network latency
