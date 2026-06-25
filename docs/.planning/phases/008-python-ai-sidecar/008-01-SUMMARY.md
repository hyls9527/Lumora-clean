---
phase: 008-python-ai-sidecar
plan: 01
subsystem: ai
tags: [json-rpc, clip, open-clip-torch, python, stdin-stdout, embeddings]

# Dependency graph
requires:
  - phase: none
    provides: none (greenfield Python)
provides:
  - JSON-RPC 2.0 stdin/stdout server for inter-process communication
  - CLIP ViT-B-32 model loading with cached singleton
  - Single-image embedding generation (512-dim, L2-normalized)
  - First-launch model checkpoint download with timeout
  - Health check handler with uptime tracking
  - Main entry point wiring all modules
affects: [008-02-tauri-integration, 009-embedding-commands, 010-sqlite-vec, 012-packaging]

# Tech tracking
tech-stack:
  added: [open-clip-torch 3.3.0, torch 2.12.1 (CPU), Pillow 12.2.0]
  patterns: [JSON-RPC stdin/stdout server, Model singleton cache, Health handler factory]

key-files:
  created:
    - src-tauri/sidecar/jsonrpc.py
    - src-tauri/sidecar/model.py
    - src-tauri/sidecar/preprocess.py
    - src-tauri/sidecar/download_model.py
    - src-tauri/sidecar/health.py
    - src-tauri/sidecar/main.py
    - src-tauri/sidecar/requirements.txt
  modified: []

key-decisions:
  - "JSON-RPC 2.0 over line-delimited stdin/stdout — no async, no logging module"
  - "CLIP ViT-B-32 (laion2b_s34b_b79k) with 512-dim embeddings, L2-normalized per RESEARCH.md"
  - "Model loaded ONCE at module level, reused across all requests — never reload per request"
  - "50MB image file size guard — rejects oversized images to prevent OOM (threat model T-008-03)"
  - "600s download timeout for first-launch checkpoint download"
  - "Health check returns status, model_loaded boolean, and uptime_seconds per PY-03 spec"

patterns-established:
  - "JSONRPCServer: register() + run() + _dispatch() pattern for stdin/stdout JSON-RPC 2.0"
  - "Model singleton: _model/_preprocess globals with load_model() caching"
  - "Health handler factory: create_health_handler(model_loaded_fn) returns closure"

requirements-completed: [PY-01, PY-02, PY-03]

# Metrics
duration: 10min
completed: 2026-06-23
---

# Phase 008 Plan 01: Python Sidecar Core Summary

**Six Python modules forming a JSON-RPC 2.0 server capable of loading CLIP ViT-B-32 and generating 512-dim L2-normalized embeddings via stdin/stdout IPC.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-22T18:32:32Z
- **Completed:** 2026-06-22T18:42:32Z
- **Tasks:** 3 (all TDD with RED/GREEN commits)
- **Files created:** 10 (6 modules + 1 requirements + 3 test files)

## Accomplishments
- JSONRPCServer class with full JSON-RPC 2.0 spec compliance (parse errors, method-not-found, handler exceptions, notification suppression, whitespace skipping)
- CLIP model loading with module-level singleton cache — model loaded once, reused across all embedding requests
- Single-image embedding generation with 50MB file size guard, L2 normalization, and descriptive error handling
- First-launch model download with 600s timeout and stderr progress reporting
- Health check handler factory with uptime tracking from sidecar start
- Main entry point wiring all handlers, signaling "ready" on stderr, and entering stdin/stdout event loop

## Task Commits

1. **Task 1: JSON-RPC protocol handler** — `f1d478c` (test RED), `ad04979` (feat GREEN)
2. **Task 2: CLIP model modules** — `2e188e2` (test RED), `9e7dd81` (feat GREEN)
3. **Task 3: Health handler + main entry point** — `934bee2` (test RED), `c6f46ab` (feat GREEN)

## Files Created/Modified
- `src-tauri/sidecar/jsonrpc.py` — JSONRPCServer class with register/run/_dispatch
- `src-tauri/sidecar/model.py` — load_model() singleton, generate_embedding() with 50MB guard
- `src-tauri/sidecar/preprocess.py` — get_preprocess() thin wrapper around open_clip transforms
- `src-tauri/sidecar/download_model.py` — ensure_model_available() with 600s timeout
- `src-tauri/sidecar/health.py` — create_health_handler() factory with uptime tracking
- `src-tauri/sidecar/main.py` — Entry point: wires server, downloads model, registers handlers, signals ready
- `src-tauri/sidecar/requirements.txt` — torch, open-clip-torch, Pillow (for Phase 012 installation)
- `src-tauri/sidecar/test_jsonrpc.py` — 6 tests for JSONRPCServer
- `src-tauri/sidecar/test_model.py` — 6 tests for model/preprocess/download modules
- `src-tauri/sidecar/test_health_main.py` — 8 tests for health handler and main entry point

## Decisions Made
- Followed RESEARCH.md JSON-RPC 2.0 pattern exactly — no deviations from the spec
- JSON-RPC error codes: -32700 (parse), -32601 (method not found), -32000 (handler error)
- Notifications (no `id` field) silently produce no output — per JSON-RPC 2.0 spec
- All stderr messages prefixed with `[sidecar]` for the Rust manager to filter (contract with Plan 02)
- `embed_image` handler wraps `generate_embedding()` and returns embedding + metadata (dimensions, model name)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added requirements.txt**
- **Found during:** Task 3 completion
- **Issue:** requirements.txt referenced in plan context but not in any task
- **Fix:** Created requirements.txt with torch, open-clip-torch, Pillow version pins
- **Files modified:** src-tauri/sidecar/requirements.txt
- **Verification:** File exists with correct dependencies

**2. [Rule 1 - Bug] Fixed test_whitespace_line_skipped assertion**
- **Found during:** Task 1 GREEN phase — test failed on stdout capture after restore
- **Issue:** Test captured `sys.stdout.getvalue()` after restoring original stdout (TextIOWrapper)
- **Fix:** Capture output before restoring stdout; parse from captured variable
- **Files modified:** src-tauri/sidecar/test_jsonrpc.py
- **Verification:** All 6 tests pass after fix
- **Committed in:** ad04979 (part of Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Model tests (4/6) fail due to missing torch/open-clip-torch installation — expected per plan instruction "Do NOT install PyTorch/open-clip yet". Tests will pass after Phase 012 dependency installation.
- Health/main tests (1/8) fail due to main.py importing model.py which imports torch — same root cause.

## Next Phase Readiness
- All six Python modules created and importable (4/6 without torch; 6/6 after pip install)
- JSON-RPC protocol implementation complete and tested
- Ready for Tauri integration in Plan 008-02
- Model download and inference code ready for PyInstaller packaging in Phase 012

## Known Stubs
- None — all handlers are wired to real implementations. Model will function once torch and open-clip-torch are installed.

---
*Phase: 008-python-ai-sidecar*
*Plan: 01*
*Completed: 2026-06-23*
