---
phase: 008
plan: "008-04"
subsystem: "python-ai-sidecar"
tags: ["batch", "concurrency", "thread-safety", "progress", "jsonrpc"]
requires: ["008-01", "008-03"]
provides: ["batch-embedding-handler"]
affects: ["sidecar/batch.py", "sidecar/main.py", "sidecar/tests/test_batch.py"]
tech-stack:
  added: []
  patterns: ["ThreadPoolExecutor", "threading.Lock", "JSON-RPC-notifications"]
key-files:
  created:
    - sidecar/batch.py
    - sidecar/tests/test_batch.py
  modified:
    - sidecar/main.py
decisions:
  - "ThreadPoolExecutor with max 4 workers for concurrent embedding"
  - "threading.Lock serializes model access (CLIP is not thread-safe)"
  - "JSON-RPC notifications (no id field) for per-item progress"
  - "Error isolation: one failed image does not kill the entire batch"
  - "handler receives model tuple from main.py, uses model.generate_embedding internally"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-06-23"
---

# Phase 008 Plan 04: Batch Embedding Summary

**One-liner:** ThreadPoolExecutor-based batch image embedding with thread-safe model access, per-item progress notifications, and error isolation — 10 tests pass without PyTorch.

## Overview

Created `sidecar/batch.py` implementing concurrent batch image embedding using Python's `concurrent.futures.ThreadPoolExecutor` with a configurable pool of 4 workers. Thread safety is ensured via a module-level `threading.Lock` that serializes access to the shared CLIP model (which is not inherently thread-safe).

The handler is registered in `main.py` as `batch_embed` and produces structured results with embeddings, errors, and counts.

## Architecture

```
main.py                          batch.py
  |                                |
  |-- create_batch_handler() ------+
  |   (model, write_fn)            |
  |                                |
  server.register("batch_embed")   handler(params)
                                     |
                                     +-- ThreadPoolExecutor(max_workers=4)
                                     |     |
                                     |     +-- process_one(image_path)
                                     |           |
                                     |           +-- acquire _model_lock
                                     |           +-- model.generate_embedding()
                                     |           +-- release _model_lock
                                     |           +-- return (path, emb, is_error=False)
                                     |           OR
                                     |           +-- catch exception
                                     |           +-- return (path, error_dict, is_error=True)
                                     |
                                     +-- as_completed() yields results
                                     +-- _notify_progress() per item (JSON-RPC notification)
                                     +-- return {embeddings, errors, total, succeeded, failed}
```

## Key Design Decisions

1. **ThreadPoolExecutor (4 workers):** Balances concurrency with resource constraints. CLIP inference is CPU/GPU-bound; more threads would not improve throughput.

2. **threading.Lock for model access:** CLIP models (PyTorch) are not thread-safe by default. The lock ensures only one thread calls `generate_embedding()` at a time, preventing race conditions and crashes.

3. **Error isolation:** Each `process_one()` call wraps the entire operation in try/except. A single corrupt image or filesystem error does not affect other images in the batch.

4. **JSON-RPC notifications:** Progress updates use the JSON-RPC notification protocol (no `id` field), which means the server does not produce a response for them. This allows real-time progress reporting without interfering with the request/response flow.

5. **File validation before locking:** File existence and size checks happen before acquiring the model lock, so a missing file doesn't block model access for valid images.

## Test Coverage

| Test | Category |
|------|----------|
| Empty images list | Edge case |
| Missing images key | Robustness |
| Non-list images param | Input validation |
| Single image succeeds | Happy path |
| 3 images, progress notifications | Concurrency + progress |
| 1 failure, 2 succeed | Error isolation |
| All 3 fail | Full failure handling |
| Large file rejection (>50MB) | Size validation |
| Default write_fn (stdout) | Integration |
| Handler returns callable | Factory contract |
| Real batch (skipped) | Real PyTorch |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] batch.py imports generate_embedding locally, not at module level**
- **Found during:** Task 2 (test run)
- **Issue:** Tests used `patch("batch.generate_embedding")` but batch.py does `from model import generate_embedding` inside `process_one()`, so the attribute doesn't exist on the batch module
- **Fix:** Changed all patches to target `model.generate_embedding` instead
- **Files modified:** sidecar/tests/test_batch.py
- **Commit:** 44138af

**2. [Rule 1 - Bug] Windows file locking on tempfile causing PermissionError**
- **Found during:** Task 2 (test_write_fn_defaults_to_stdout)
- **Issue:** `tempfile.NamedTemporaryFile` holds file handle open on Windows, preventing deletion
- **Fix:** Switched to `tmp_path` fixture (pytest-managed temp directory) and explicitly close PIL images
- **Files modified:** sidecar/tests/test_batch.py
- **Commit:** 44138af

## Verification

```bash
cd sidecar && py -m pytest tests/test_batch.py -v
# Result: 10 passed, 1 skipped in 0.13s

cd sidecar && py -m pytest tests/ -v
# Result: 36 passed, 4 skipped in 0.48s
```

## Self-Check: PASSED

- [x] sidecar/batch.py exists
- [x] sidecar/main.py updated with batch_embed registration
- [x] sidecar/tests/test_batch.py exists
- [x] Commit 44138af verified in git log
- [x] Full test suite: 36 passed, 4 skipped
