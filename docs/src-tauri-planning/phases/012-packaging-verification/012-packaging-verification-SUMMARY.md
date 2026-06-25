---
phase: "012"
plan: "012"
subsystem: "packaging"
tags: ["ci", "msi", "tauri", "github-actions", "smoke-test", "release"]
requires: ["008-python-ai-sidecar", "009-frontend-backend-connection", "010-vector-search", "011-ai-analysis"]
provides: ["windows-msi-installer", "ci-workflow", "smoke-test-script"]
affects: []
tech-stack:
  added: ["GitHub Actions", "PowerShell"]
  patterns: ["Tauri v2 MSI bundling", "WiX auto-generation", "CI parallel jobs"]
key-files:
  created:
    - ".github/workflows/build.yml"
    - "scripts/smoke-test.ps1"
    - ".planning/phases/012-packaging-verification/012-PLAN.md"
    - ".planning/phases/012-packaging-verification/012-CONTEXT.md"
  modified:
    - "src-tauri/tauri.conf.json"
    - "src-tauri/src/sidecar/mod.rs"
decisions:
  - "MSI-only Windows installer for v0.3; macOS/Linux deferred"
  - "Sidecar build as manual pre-build step (PyTorch too large for CI)"
  - "CI parallel jobs: typecheck + test run concurrently, build depends on both"
  - "Rust toolchain pinned to 1.77.2 in CI"
metrics:
  duration: "5m 19s"
  completed_at: "2026-06-22T19:37:53Z"
---

# Phase 012 Plan 012: Packaging & Verification Summary

Lumora ships as a single Windows .msi installer with CI-verified builds, automated smoke testing, and documented release procedures.

## Tasks Completed

### Task 1: Finalize Tauri build configuration — COMMITTED (`90e5ced`)

- Changed `bundle.targets` from string `"msi"` to array `["msi"]`
- Added `bundle.windows.wix` section with `en-US` language, empty banner/dialog paths
- Added `bundle.windows.nsis` section with `currentUser` install mode
- Removed unused `JsonRpcResponse` re-export from `sidecar/mod.rs` — zero build warnings
- `cargo check` passes clean

**Files:** `src-tauri/tauri.conf.json (+11/-1)`, `src-tauri/src/sidecar/mod.rs (+1/-1)`

### Task 2: GitHub Actions CI workflow — COMMITTED (`3bb9869`)

- Created `.github/workflows/build.yml` with three jobs:
  - **typecheck** — `npx tsc --noEmit` as fast smoke gate (Windows runner, Node 22)
  - **test** — `cargo test --workspace` with Rust 1.77.2 and rust-cache
  - **build** — `npm ci` + `npm run build` + `cargo tauri build --bundles msi`, uploads MSI artifact
- Sidecar build step commented out with documentation (requires PyTorch + PyInstaller)
- Triggers: push/PR to main, manual workflow_dispatch
- Artifact retention: 30 days

**Files:** `.github/workflows/build.yml (+124 lines)`

### Task 3: E2E smoke test script — COMMITTED (`c28db4e`)

- Created `scripts/smoke-test.ps1` (302 lines) with:
  - **Automated checks:** binary presence (main + sidecar + MSI), version consistency across tauri.conf.json/Cargo.toml/package.json, build artifacts, quick-launch test with database verification
  - **Manual checklist** (`-Manual` flag): 7 sections, 32 items covering installation, first launch, image import, search, AI analysis, settings, and edge cases
  - **Quick mode** (`-Quick` flag): binary-only checks, no app launch
  - Colored pass/fail/skip output with exit codes

**Files:** `scripts/smoke-test.ps1 (+302 lines)`

### Task 4: Build verification — VERIFIED (no code changes)

| Check | Result |
|-------|--------|
| `cargo check` | 0 errors, 0 warnings |
| `npx tsc --noEmit` | 0 errors |
| `cargo test` | 16 passed, 0 failed |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| File | Line | Description | Resolution |
|------|------|-------------|------------|
| `.github/workflows/build.yml` | 100-112 | Sidecar build step commented out | Intentional — requires Python 3.10-3.13 + PyTorch 2.12.1 + PyInstaller. Documented as manual pre-build step in CONTEXT.md. |

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. The CI workflow reads source only; the smoke test is a local verification script.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `.github/workflows/build.yml` | EXISTS |
| `scripts/smoke-test.ps1` | EXISTS |
| `src-tauri/tauri.conf.json` | MODIFIED (commit `90e5ced`) |
| `src-tauri/src/sidecar/mod.rs` | MODIFIED (commit `90e5ced`) |
| `.planning/phases/012-packaging-verification/012-PLAN.md` | EXISTS |
| `.planning/phases/012-packaging-verification/012-CONTEXT.md` | EXISTS |
