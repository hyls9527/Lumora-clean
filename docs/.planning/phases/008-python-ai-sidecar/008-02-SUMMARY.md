---
phase: 008-python-ai-sidecar
plan: 02
subsystem: sidecar
tags: [tauri-plugin-shell, json-rpc, rust, sidecar, ipc, process-management]

# Dependency graph
requires:
  - phase: 008-python-ai-sidecar
    plan: 01
    provides: Python sidecar modules (jsonrpc, model, health, main) — IPC contract consumer
provides:
  - Tauri-side sidecar process lifecycle management (spawn, health-check, shutdown)
  - JSON-RPC 2.0 protocol types with serde Serialize/Deserialize
  - tauri-plugin-shell dependency and capability configuration
  - Sidecar binary declaration in tauri.conf.json externalBin
affects: [009-embedding-commands, 010-sqlite-vec, 012-packaging]

# Tech tracking
tech-stack:
  added: [tauri-plugin-shell 2.3.5, tokio 1 (sync+time features)]
  patterns: [SidecarManager lifecycle, tokio::sync::Mutex for async state, Tauri v2 sidecar spawning]

key-files:
  created:
    - src-tauri/src/sidecar/mod.rs
    - src-tauri/src/sidecar/manager.rs
    - src-tauri/src/sidecar/protocol.rs
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/tauri.conf.json
    - src-tauri/capabilities/default.json
    - src-tauri/src/lib.rs

key-decisions:
  - "tauri-plugin-shell v2 for sidecar spawning — uses ShellExt::sidecar() not std::process::Command"
  - "tokio::sync::Mutex for Tauri managed state — required because SidecarManager::send_request() is async and std::sync::MutexGuard is not Send"
  - "SidecarManager::spawn() returns immediately — model loading happens asynchronously; readiness detected via stderr '[sidecar] ready' signal"
  - "Health ping every 30 seconds with unique ping-{timestamp} IDs per PY-03 spec"
  - "externalBin path: 'binaries/lumora-sidecar' without extension or target triple — Tauri v2 appends -x86_64-pc-windows-msvc.exe at runtime"

patterns-established:
  - "SidecarManager: Arc<TokioMutex<CommandChild>> + Arc<TokioMutex<bool>> pattern for shared async state"
  - "Background stdout/stderr reader spawned via tauri::async_runtime::spawn"
  - "Tauri setup closure: DB init first, then sidecar spawn, then health ping loop"

requirements-completed: [PY-02, PY-03]

# Metrics
duration: 10min
completed: 2026-06-23
---

# Phase 008 Plan 02: Tauri Sidecar Integration Summary

**Tauri v2 integration with tauri-plugin-shell for Python AI sidecar lifecycle — JSON-RPC protocol types, SidecarManager with spawn/health/shutdown, 30s health pings, and capability-based security configuration.**

## Performance

- **Duration:** ~10 min (overlapping with Plan 01)
- **Started:** 2026-06-22T18:32:32Z
- **Completed:** 2026-06-22T18:42:32Z
- **Tasks:** 3 (1 config, 1 TDD with RED/GREEN, 1 implementation)
- **Files created:** 3 Rust modules, 1 placeholder binary
- **Files modified:** 4 config/code files

## Accomplishments
- tauri-plugin-shell dependency added to Cargo.toml and registered in lib.rs plugin chain
- Capability-based security: shell:allow-spawn and shell:allow-stdin-write permissions in default.json
- Sidecar binary declared in tauri.conf.json bundle.externalBin (no extension, Tauri auto-appends target triple)
- JSON-RPC 2.0 protocol types (JsonRpcRequest, JsonRpcResponse, HealthStatus, EmbeddingResult) with serde — 5/5 unit tests pass
- SidecarManager: spawn() with stdout/stderr reader, is_healthy() via "[sidecar] ready" signal, send_request() writing JSON-RPC lines to stdin, shutdown() via child.kill()
- Full Tauri lifecycle integration: sidecar spawns in setup after DB init, managed as Tauri state, 30s health ping loop

## Task Commits

1. **Task 1: Config changes** — `5946ce0` (chore)
2. **Task 2: Protocol types** — `97887ad` (test RED), `628ea5a` (feat GREEN)
3. **Task 3: SidecarManager + lib.rs** — `8fc2cbc` (feat)

## Files Created/Modified
- `src-tauri/src/sidecar/mod.rs` — Module root re-exporting SidecarManager and protocol types
- `src-tauri/src/sidecar/protocol.rs` — JsonRpcRequest, JsonRpcResponse, JsonRpcError, HealthStatus, EmbeddingResult with serde + 5 tests
- `src-tauri/src/sidecar/manager.rs` — SidecarManager with spawn(), is_healthy(), send_request(), shutdown()
- `src-tauri/Cargo.toml` — Added tauri-plugin-shell and tokio dependencies
- `src-tauri/tauri.conf.json` — Added bundle.externalBin and shell plugin config
- `src-tauri/capabilities/default.json` — Added shell:allow-spawn and shell:allow-stdin-write
- `src-tauri/src/lib.rs` — Added mod sidecar, shell plugin registration, sidecar spawn in setup, managed state, 30s health ping loop
- `src-tauri/binaries/lumora-sidecar-x86_64-pc-windows-msvc.exe` — Placeholder binary for Tauri build script (replaced by PyInstaller in Phase 012)

## Decisions Made
- Used tokio::sync::Mutex for Tauri managed state (not std::sync::Mutex as originally specified) — necessary because SidecarManager::send_request() is async and std::sync::MutexGuard is not Send
- Health ping uses unique ping-{unix_timestamp} IDs for request tracking
- SidecarManager::spawn() does NOT block — model loading happens asynchronously; readiness detected via stderr signal
- Placeholder binary created in binaries/ to satisfy Tauri build script — will be replaced by real PyInstaller binary in Phase 012

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added tokio dependency to Cargo.toml**
- **Found during:** Task 3 — cargo check failed with "cannot find module or crate tokio"
- **Issue:** manager.rs uses `tokio::sync::Mutex` and lib.rs uses `tokio::time::interval` but tokio not in Cargo.toml
- **Fix:** Added `tokio = { version = "1", features = ["sync", "time"] }` to [dependencies]
- **Files modified:** src-tauri/Cargo.toml
- **Verification:** cargo check passes
- **Committed in:** 8fc2cbc (Task 3 commit)

**2. [Rule 1 - Bug] Fixed std::sync::MutexGuard Send issue in health ping loop**
- **Found during:** Task 3 — cargo check failed: "future cannot be sent between threads safely"
- **Issue:** std::sync::MutexGuard<'_, SidecarManager> is not Send; cannot be held across .await boundary in tauri::async_runtime::spawn
- **Fix:** Switched Tauri managed state from std::sync::Mutex to tokio::sync::Mutex for SidecarManager
- **Files modified:** src-tauri/src/lib.rs
- **Verification:** cargo check passes; health ping loop compiles correctly
- **Committed in:** 8fc2cbc (Task 3 commit)

**3. [Rule 1 - Bug] Fixed variable shadowing issue in lib.rs**
- **Found during:** Task 3 implementation
- **Issue:** Local variable `let sidecar = sidecar::SidecarManager::spawn(...)` shadowed the `mod sidecar` — caused resolution ambiguity in health ping closure
- **Fix:** Renamed local variable to `sidecar_manager`; used `crate::sidecar::` prefix in closure
- **Files modified:** src-tauri/src/lib.rs
- **Verification:** cargo check passes
- **Committed in:** 8fc2cbc (Task 3 commit)

**4. [Rule 3 - Blocking] Created placeholder sidecar binary**
- **Found during:** Task 2 GREEN phase — Tauri build script errored "resource path doesn't exist"
- **Issue:** tauri.conf.json externalBin requires the binary to exist at build time; PyInstaller binary not yet built (Phase 012)
- **Fix:** Created placeholder file at binaries/lumora-sidecar-x86_64-pc-windows-msvc.exe
- **Files modified:** src-tauri/binaries/ (new)
- **Verification:** cargo check passes; placeholder will be replaced by real PyInstaller binary
- **Committed in:** 628ea5a (Task 2 GREEN commit)

**5. [Rule 3 - Blocking] Added manager.rs stub for compilation**
- **Found during:** Task 2 GREEN phase
- **Issue:** mod.rs declares `pub mod manager;` and `pub use manager::SidecarManager;` before manager.rs exists
- **Fix:** Created placeholder manager.rs; temporarily commented SidecarManager re-export until Task 3
- **Files modified:** src-tauri/src/sidecar/manager.rs, src-tauri/src/sidecar/mod.rs
- **Verification:** cargo check passes
- **Committed in:** 628ea5a (Task 2 GREEN commit, resolved in 8fc2cbc Task 3)

---

**Total deviations:** 5 auto-fixed (2 bugs, 3 blocking)
**Impact on plan:** All fixes necessary for compilation correctness. The tokio::sync::Mutex change is a design improvement — the plan's std::sync::Mutex approach does not work with async Rust.

## Issues Encountered
- Tauri build script requires the externalBin file to exist at compile time — worked around with placeholder binary. Real binary will be produced by Phase 012 PyInstaller build.
- Unused import warnings for EmbeddingResult, HealthStatus, JsonRpcResponse — these types are exported for Phase 009 (embedding commands). Warnings are acceptable per plan specification.

## Next Phase Readiness
- SidecarManager fully integrated into Tauri lifecycle — ready for Phase 009 Tauri commands (embed_image, get_embedding_status)
- Protocol types define the exact JSON-RPC contract between Rust and Python
- Health ping infrastructure ready — will detect sidecar crashes and report status to frontend
- Placeholder binary in place — Phase 012 will replace with real PyInstaller output

---
*Phase: 008-python-ai-sidecar*
*Plan: 02*
*Completed: 2026-06-23*
