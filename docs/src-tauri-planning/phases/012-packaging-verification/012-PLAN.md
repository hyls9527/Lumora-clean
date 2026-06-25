---
phase: "012"
plan: "012"
type: "feature"
autonomous: true
wave: 1
depends_on: ["008", "009", "010", "011"]
requirements:
  - PKG-01
  - PKG-02
  - PKG-03
  - PKG-04
---

# Phase 012: Packaging & Verification

Lumora ships as a single Windows .msi installer with CI-verified builds. The Python AI sidecar is bundled via PyInstaller, and an end-to-end smoke test validates the complete pipeline.

## Requirements

- **PKG-01:** Tauri production build — single installer (Windows .msi)
- **PKG-02:** Python sidecar bundled in installer via PyInstaller
- **PKG-03:** GitHub Actions CI — build + test on Windows
- **PKG-04:** End-to-end smoke test — install, launch, import, search, analyze

## Tasks

### Task 1: Finalize Tauri build configuration
- Verify tauri.conf.json bundle section: Windows .msi, icon paths, WiX config
- Add bundle.windows.wix configuration with en-US language
- Add bundle.windows.nsis installMode setting
- Clean Rust build warnings (unused JsonRpcResponse re-export)
- `cargo check` passes with zero warnings

### Task 2: GitHub Actions CI workflow
- Create `.github/workflows/build.yml`
- Windows runner, install Node.js 22 + Rust 1.77.2
- TypeScript check job (`npx tsc --noEmit`) as fast smoke gate
- Rust test job (`cargo test --workspace`)
- Build job: frontend (`npm ci` + `npm run build`), Rust (`cargo tauri build --bundles msi`)
- Upload .msi as artifact with 30-day retention
- Sidecar build step placeholder (commented, requires PyTorch + PyInstaller)

### Task 3: E2E smoke test script
- Create `scripts/smoke-test.ps1`
- Automated checks: binary presence, version consistency, build artifacts, quick-launch
- Manual test checklist: 7 sections, 32 items covering install, launch, import, search, AI, settings, edge cases
- Supports `-Quick` (binary-only) and `-Manual` (checklist output) flags

### Task 4: Build verification
- `cargo check`: 0 errors, 0 warnings
- `npx tsc --noEmit`: 0 errors
- `cargo test`: 16 tests passed, 0 failed

## Success Criteria

- `cargo check` passes with zero warnings
- `npx tsc --noEmit` passes with zero errors
- `cargo test` passes all 16 tests
- GitHub Actions workflow publishes MSI artifact on push to main
- Smoke test script validates binary, database, and sidecar presence
- Release process documented for version consistency across configs
