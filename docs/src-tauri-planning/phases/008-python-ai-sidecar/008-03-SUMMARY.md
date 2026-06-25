---
phase: 008
plan: "008-03"
subsystem: "python-ai-sidecar"
tags: ["testing", "pytest", "mock", "conftest", "jsonrpc", "health", "model"]
requires: ["008-01", "008-02"]
provides: ["pytest-test-suite"]
affects: ["sidecar/tests/"]
tech-stack:
  added: ["pytest-9.1.1", "Pillow-12.2.0"]
  patterns: ["pytest-fixtures", "sys.modules-mocking", "threading.Lock"]
key-files:
  created:
    - sidecar/tests/__init__.py
    - sidecar/tests/conftest.py
    - sidecar/tests/test_jsonrpc.py
    - sidecar/tests/test_health.py
    - sidecar/tests/test_model.py
  modified: []
decisions:
  - "Use pytest over standalone scripts for structured test organization"
  - "Mock torch/open_clip at sys.modules level to avoid PyTorch dependency"
  - "Use @pytest.mark.skip for real-model tests that require multi-GB downloads"
  - "Install Pillow as lightweight test dependency (no CUDA required)"
metrics:
  duration: "~30 minutes"
  completed_date: "2026-06-23"
---

# Phase 008 Plan 03: Python Tests Summary

**One-liner:** Pytest test suite with sys.modules-level mocking for JSON-RPC server, health handler, and CLIP model — 26 tests pass without PyTorch.

## Overview

Converted existing standalone test scripts into a structured pytest test suite under `sidecar/tests/`. Created a shared `conftest.py` with `MockModel`, `MockPreprocess`, `MockTensor` classes and a `mock_torch_modules` fixture that injects mock `torch` and `open_clip` modules into `sys.modules` before any test imports `model.py`.

## Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| JSON-RPC server | 9 | All pass |
| Health handler | 9 | All pass |
| Model / Preprocess | 8 (4 mock, 4 skipped) | Mock pass, Real skip |
| **Total** | **26** | **26 pass, 3 skip** |

### JSON-RPC Tests (test_jsonrpc.py)
- Valid request dispatch, parse error, method-not-found, handler exception
- Notification (no-id) yields no response
- Whitespace line skipping, multiple requests in sequence
- Empty params defaults, method overwrite on re-register

### Health Tests (test_health.py)
- Status 'ok', model_loaded true/false
- Uptime non-negative, numeric, increases over time
- Params ignored, factory returns callable, independent instances

### Model Tests (test_model.py)
- Import verification (load_model, generate_embedding callable)
- Mock-based: load_model tuple shape, FileNotFoundError, large file rejection, embedding list output
- Skipped: real model loading, eval mode, real embedding dimensions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] model.py module-level imports block testing without PyTorch**
- **Found during:** Task 1 (initial test run)
- **Issue:** `import torch` and `from PIL import Image` at module level in model.py prevented any import in test environment
- **Fix:** Created `mock_torch_modules` fixture in conftest.py that injects mock torch and open_clip into sys.modules before model.py import. Also installed Pillow for PIL support. Added cleanup to remove cached model/preprocess modules between tests for isolation.
- **Files modified:** sidecar/tests/conftest.py
- **Commit:** f6cf912

**2. [Rule 1 - Bug] Mock open_clip returned 2-tuple instead of 3-tuple**
- **Found during:** Task 1 (test_load_model_with_mock_patch)
- **Issue:** model.py destructures `open_clip.create_model_and_transforms()` as `(model, _, preprocess)` expecting 3 values, but mock returned 2
- **Fix:** Changed mock to return `(model, None, preprocess)` — a 3-tuple
- **Files modified:** sidecar/tests/conftest.py
- **Commit:** f6cf912

**3. [Rule 1 - Bug] Cached model.py module caused cross-test pollution**
- **Found during:** Task 1 (test_load_model_with_mock_patch)
- **Issue:** model.py was cached in sys.modules between tests, causing stale mock references
- **Fix:** Fixture now removes model and preprocess from sys.modules before each test, forcing fresh import
- **Files modified:** sidecar/tests/conftest.py
- **Commit:** f6cf912

## Verification

```bash
cd sidecar && py -m pytest tests/ -v
# Result: 26 passed, 3 skipped in 0.41s
```

## Self-Check: PASSED

- [x] sidecar/tests/__init__.py exists
- [x] sidecar/tests/conftest.py exists
- [x] sidecar/tests/test_jsonrpc.py exists
- [x] sidecar/tests/test_health.py exists
- [x] sidecar/tests/test_model.py exists
- [x] Commit f6cf912 verified in git log
