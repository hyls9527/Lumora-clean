# Phase 012 Context: Packaging & Verification

## Overview

Phase 012 is the final v0.3 milestone phase. It packages Lumora as a Windows .msi installer, sets up CI for automated builds, and provides an end-to-end smoke test to validate the complete application.

## Architecture

```
[GitHub Actions CI]
    │
    ├── typecheck job → npx tsc --noEmit
    ├── test job     → cargo test --workspace
    └── build job    → npm ci → npm run build → cargo tauri build --bundles msi
                           │
                           ▼
                    [MSI Installer]
                           │
                    ┌──────┴──────┐
                    │  Lumora.exe │  lumora-sidecar-x86_64-pc-windows-msvc.exe
                    │  (Tauri)    │  (PyInstaller Python AI)
                    └─────────────┘
```

## Dependencies

- **Phase 008:** Python AI sidecar (build.py, PyInstaller config)
- **Phase 009:** Frontend-backend connection (Tauri invoke commands)
- **Phase 010:** Vector search (sqlite-vec, KNN)
- **Phase 011:** AI analysis (Ollama integration)

## Key Decisions

1. **MSI-only for v0.3:** Windows .msi installer first, macOS/Linux deferred
2. **Sidecar binary naming:** Tauri external binary convention — base name in config, target triple appended at build time (`lumora-sidecar` → `lumora-sidecar-x86_64-pc-windows-msvc.exe`)
3. **Sidecar build as manual step:** PyTorch CPU wheels too large/difficult for CI; documented as manual prerequisite
4. **CI parallel jobs:** TypeScript check and Rust tests run in parallel, MSI build depends on both
5. **Rust toolchain pinned:** 1.77.2 in Cargo.toml `rust-version` field, matched in CI
6. **WiX auto-generation:** Tauri v2 generates WiX source from config; no custom .wxs template needed for basic MSI

## Manual Steps (Pre-Build)

1. **Python sidecar build** (requires Python 3.10-3.13 + PyTorch 2.12.1 + PyInstaller):
   ```bash
   cd src-tauri/sidecar
   python build.py
   ```
   Output: `src-tauri/binaries/lumora-sidecar-x86_64-pc-windows-msvc.exe`

2. **Full Tauri build:**
   ```bash
   npm ci
   npm run build
   cargo tauri build --bundles msi
   ```
   Output: `src-tauri/target/release/bundle/msi/Lumora_0.3.0_x64_en-US.msi`
