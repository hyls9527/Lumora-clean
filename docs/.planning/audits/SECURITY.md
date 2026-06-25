# Security Audit -- Lumora v0.3 Tauri Backend

**Audit Date:** 2026-06-23
**Auditor:** Automated security review
**Scope:** All implemented phases (007-012), 22 Tauri commands, sidecar lifecycle, Ollama integration
**Methodology:** Code-level verification of 10 specified perspectives against implementation source

---

## Audit Summary

| # | Perspective | Verdict | Severity |
|---|------------|---------|----------|
| 1 | IPC Security | Pass -- all commands exposed but no privilege boundary in a desktop app | Info |
| 2 | Path Traversal | Pass -- write destinations sanitized via `file_name()` extraction | Info |
| 3 | SQL Injection | Pass -- 100% parameterized binds across 6 DB modules | None |
| 4 | Sidecar Process | **Gap** -- no restart on crash; missing binary panics app | Medium |
| 5 | Data Integrity | **Gap** -- no `PRAGMA integrity_check`; mutex blocks UI during import | Low |
| 6 | Settings Validation | Pass -- Rust-side validation on all 7 known keys | None |
| 7 | Error States | **Gap** -- file path leaked in `load_image_base64` error message | Low |
| 8 | CSP | **Gap** -- `asset:` protocol format likely incorrect; `unsafe-inline` for styles | Low |
| 9 | Ollama HTTP | Accepted risk -- plaintext localhost, standard for local AI tools | Low |
| 10 | Disk Full (D-13) | **Gap** -- `AppError::DiskFull` defined but never emitted; Windows check returns hardcoded 1GB | Medium |

**Open issues requiring action:** 5
**Accepted risks:** 1
**No issues:** 4

---

## 1. IPC Security -- PASS (Informational)

### What was checked
- `src-tauri/capabilities/default.json` permissions vs. 22 commands registered in `src-tauri/src/lib.rs:68-97`
- Capability scoping: `shell:allow-spawn`, `shell:allow-stdin-write`, `store:default`, `dialog:default`

### Findings
All 22 `#[tauri::command]` functions are exposed to the frontend with no command-level ACL. In Tauri v2, any function annotated `#[tauri::command]` and listed in `generate_handler![]` is callable from the webview JavaScript. The `capabilities/default.json` controls plugin-level permissions (shell, store, dialog), not individual command access.

**Not a vulnerability in context:** Lumora is a single-user desktop application. The frontend IS the application. There is no untrusted third-party JavaScript or plugin system. The webview sandbox and CSP provide the primary isolation boundary.

The `shell:allow-spawn` permission is broad -- it allows spawning any command, not just the sidecar binary. Consider scoping to `shell:allow-execute` with a named scope in future phases.

### Evidence
- Commands registered: `src-tauri/src/lib.rs:68-97` (22 commands)
- Capabilities: `src-tauri/capabilities/default.json:6-14`

---

## 2. Path Traversal -- PASS

### What was checked
- `src-tauri/src/commands/images.rs:310-475` (`import_images` command)
- `src-tauri/src/filesystem/import.rs:15-145` (`import_single_file` pipeline)
- `src-tauri/src/commands/filesystem.rs:8-19` (`open_folder_dialog`)
- `src-tauri/src/commands/filesystem.rs:23-55` (`open_data_folder`)

### Findings
The import pipeline extracts the filename component via `Path::file_name()` at `filesystem/import.rs:22`:
```rust
let original_name = source_path
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("unknown")
    .to_string();
```
The destination is always constructed as `images_dir.join(&dest_name)` where `images_dir` is `data/images/`. A path like `../../etc/passwd` would be reduced to just `passwd` and copied to `data/images/passwd`.

**Read direction:** The process reads from arbitrary user-supplied source paths (`fs::metadata`, `fs::copy`). In a desktop context the process runs with the user's own OS file permissions -- no privilege escalation is possible.

### Evidence
- Filename sanitization: `src-tauri/src/filesystem/import.rs:22-25`
- Destination construction: `src-tauri/src/filesystem/import.rs:69`

---

## 3. SQL Injection -- PASS

### What was checked
Every SQL query across 6 database modules: `db/images.rs`, `db/search.rs`, `db/vectors.rs`, `db/analysis.rs`, `db/connection.rs`, plus inline queries in `commands/images.rs` and `commands/analysis.rs`.

### Findings
All queries use `rusqlite::params![]` with positional bind parameters (`?1`, `?2`, ...). No string interpolation, no `format!()` for SQL construction.

**FTS5 MATCH query** (`db/search.rs:44`): `WHERE images_fts MATCH ?1` -- the user search query is passed as a bound parameter, not interpolated. FTS5 tokenizes the input internally with no SQL injection surface.

### Evidence (representative sample)
- `src-tauri/src/db/images.rs:23-44` -- `params![limit, offset]`
- `src-tauri/src/db/search.rs:50-51` -- `params![query, limit, offset]`
- `src-tauri/src/db/vectors.rs:94-95` -- `params![json_vec, limit]`
- `src-tauri/src/db/analysis.rs:13-28` -- `params![entry.image_id, ...]`
- `src-tauri/src/commands/analysis.rs:181-185` -- `params![input.image_id]`

---

## 4. Sidecar Process -- GAP (Medium)

### What was checked
- `src-tauri/src/sidecar/manager.rs` -- full lifecycle management
- `src-tauri/src/lib.rs:34-64` -- spawn and health ping loop

### Findings

**Gap 4a -- No restart on crash.** When the Python sidecar terminates unexpectedly (`CommandEvent::Terminated` at `manager.rs:99-106`), `healthy` is set to `false` and an error is logged. There is no automatic restart. All AI embedding and semantic search features silently stop working until the application is restarted.

```rust
// manager.rs:99-106
CommandEvent::Terminated(status) => {
    *healthy_clone.lock().await = false;
    if status.code == Some(0) {
        log::info!("Sidecar terminated normally");
    } else {
        log::error!("Sidecar terminated unexpectedly: {:?}", status);
    }
    break;  // <-- exits the stdout/stderr reader loop, but spawn() already returned
}
```

**Gap 4b -- Missing binary panics the app.** `lib.rs:35-36`:
```rust
let sidecar_manager = sidecar::SidecarManager::spawn(&app.handle())
    .expect("Failed to spawn Python AI sidecar. Embedding features will be unavailable.");
```
If the sidecar binary is missing or fails to spawn, the entire application panics with a white-screen crash. The comment says "Embedding features will be unavailable" but the `.expect()` kills the whole app.

**Gap 4c -- Health ping does not trigger recovery.** The 30-second health ping loop (`lib.rs:43-64`) logs a warning on failure but takes no action.

**Gap 4d -- `--onefile` vs `--onedir` discrepancy.** `build.py` line 4 claims to use `--onedir` mode (for fast cold start), but line 80 actually passes `--onefile`. `--onefile` causes 30s+ decompression on every launch. This is a performance/reliability issue, not a direct security vulnerability, but delayed sidecar availability widens the window where semantic search is down.

### Recommendation
- Implement automatic sidecar restart with exponential backoff (e.g., 3 attempts, 2s/4s/8s delays)
- Convert the spawn `.expect()` to a graceful fallback: start without sidecar, show "AI features unavailable" UI state
- Fix `build.py` to match the documented intent (`--onedir`) or update the comment
- Add a `sidecar-status` event emitted to the frontend when health changes

---

## 5. Data Integrity -- GAP (Low)

### What was checked
- `src-tauri/src/db/connection.rs:35-46` (`open_database` with PRAGMAs)
- `src-tauri/src/db/migrations.rs:107-112` (`run_migrations`)
- `src-tauri/src/state.rs:4-10` (`AppState` with `Mutex<AppState>`)

### Findings

**Gap 5a -- No `PRAGMA integrity_check` at startup.** If the database file is corrupted on disk (power loss, disk failure), `Connection::open` may succeed but subsequent queries will return `SQLITE_CORRUPT` errors. No integrity verification is performed at startup. Recommendation: add a one-time `PRAGMA quick_check` after opening.

**Gap 5b -- Mutation failure panics the app.** `db::connection::initialize_database()` at `lib.rs:30-31`:
```rust
let app_state = db::connection::initialize_database(&app.handle())
    .expect("Failed to initialize database. The application cannot start.");
```
If migration v8 fails on a schema change in a future version, the user gets a crash with no recovery path. Since migrations are wrapped in transactions by `rusqlite_migration`, a mid-migration crash rolls back cleanly -- but a migration that fails due to a constraint violation or schema conflict leaves the app dead.

**Gap 5c -- Mutex blocks all DB access during import.** `AppState` wraps the single `Connection` behind `std::sync::Mutex<AppState>`. The `import_images` command acquires this mutex inside `spawn_blocking` and holds it for the ENTIRE import (file copy, format conversion, hash computation, thumbnail generation). During a large import, all other Tauri commands that need the database (`list_images`, `search_images`, `update_image`, etc.) will block until the import completes.

### Recommendation
- Add `PRAGMA quick_check` at startup (fast, O(1) for WAL databases)
- Consider a connection pool or read-only replica connections for queries during long-running operations
- Add a `connection healthy` check in the health ping loop

---

## 6. Settings Validation -- PASS

### What was checked
- `src-tauri/src/commands/settings.rs:31-91` (`validate_setting`)
- `src-tauri/src/commands/settings.rs:127-139` (`set_setting`)
- `src-tauri/src/commands/settings.rs:180-231` (`migrate_legacy_settings`)

### Findings
All 7 known setting keys have Rust-side validation BEFORE writing to the store:
- `language`: enum check ("en" | "zh")
- `theme`: enum check ("light" | "dark")
- `gridColumns`: integer range 1-10
- `maxFileSizeMB`: integer range 1-500
- `thumbnailQuality`: integer range 1-100 (reserved, not yet used)
- `maxConcurrency`: integer range 1-16 (reserved, not yet used)
- `aiTimeout`: integer range 5000-120000 (reserved, not yet used)

Unknown keys are allowed with a warning (extensibility pattern). The `migrate_legacy_settings` command validates migrated values through the same `validate_setting` function (`settings.rs:209`).

The frontend `settings-store.ts` also clamps `maxFileSizeMB` client-side at line 106-107, providing defense-in-depth.

### Evidence
- `src-tauri/src/commands/settings.rs:31-91` -- full validation logic
- `src-tauri/src/commands/settings.rs:128-129` -- validate before set
- `src-tauri/src/commands/settings.rs:209` -- validate before migration write

---

## 7. Error States -- GAP (Low)

### What was checked
All error format strings across commands, filesystem, imaging, and Ollama modules.

### Findings

**Gap 7a -- File path exposed in `load_image_base64` error.**
`src-tauri/src/commands/analysis.rs:110`:
```rust
.map_err(|e| format!("Failed to read image file '{}': {}", file_path, e))?;
```
The full `file_path` (e.g., `C:\Users\Admin\AppData\Local\Lumora\data\images\photo.jpg`) is included in the error string returned to the frontend. In a desktop app where the user owns the data, this is low severity, but it leaks the internal storage layout.

**Gap 7b -- `std::io::Error` may include paths.**
`filesystem/import.rs:37` and `filesystem/import.rs:85` pass raw `std::io::Error` into error strings:
```rust
error: Some(format!("Cannot read file: {}", e)),
error: Some(format!("File copy failed: {}", e)),
```
`std::io::Error` Display implementation can include the file path in its message depending on the OS and error type.

**Gap 7c -- `AppError` serialization to frontend.**
The `AppError` enum derives `Serialize` (`images.rs:15`), meaning the full error message (including `Database("...")` with raw SQLite error text) is serialized to JSON and sent to the frontend. SQLite errors can contain schema details and column names.

### Recommendation
- Sanitize file paths in error messages: show only the filename, not the full path
- Consider a separate `UserFacingError` type that strips internal details before returning to the frontend

---

## 8. CSP -- GAP (Low)

### What was checked
- `src-tauri/tauri.conf.json:25-27` (CSP directive)

### Findings

**Current CSP:**
```
default-src 'self'; img-src 'self' asset: https://asset.localhost; style-src 'self' 'unsafe-inline'
```

**Gap 8a -- `asset:` protocol format may be incorrect.** Tauri v2 uses `asset://localhost` as the default asset protocol URL, not `asset:` and not `https://asset.localhost`. The current CSP allows `asset:` (bare scheme) and `https://asset.localhost` (which is an external HTTPS URL, not the Tauri asset protocol). This means:
- `asset:` without `//` is valid CSP syntax but may not match Tauri's actual asset URLs
- `https://asset.localhost` would resolve to an external DNS name `asset.localhost` if the frontend tried to load it -- but since images are loaded via `convertFileSrc()`, this likely works by coincidence or not at all

**Gap 8b -- `'unsafe-inline'` for styles.** Required by Tailwind CSS's JIT mode (which can inject inline styles). This weakens CSP against style-based exfiltration attacks. In practice, a desktop Tauri app has minimal XSS surface since there is no user-generated HTML rendering, but it is worth noting.

**Gap 8c -- No `connect-src` directive.** `default-src 'self'` restricts `connect-src` to `'self'` by fallback. The Rust backend makes HTTP calls to Ollama (localhost:11434), not the frontend JavaScript, so this is not currently a functional issue. If future phases add frontend-to-Ollama calls, `connect-src http://localhost:11434` will be needed.

### Recommendation
- Verify the correct Tauri v2 asset protocol: test with `asset://localhost` in the CSP
- Consider `style-src 'self'` only in production builds (Tailwind purges inline styles at build time)
- Add explicit `script-src 'self'` for clarity even though `default-src` covers it

---

## 9. Ollama HTTP -- ACCEPTED RISK (Low)

### What was checked
- `src-tauri/src/ollama/client.rs:11` -- `const OLLAMA_BASE: &str = "http://localhost:11434"`
- Full HTTP request/response flow

### Findings
The Ollama client communicates exclusively with `http://localhost:11434` using plaintext HTTP. This is standard practice for local AI inference tools (Ollama, llama.cpp, vLLM all default to HTTP on localhost).

**Risk analysis:**
- **Localhost MITM:** If another process binds port 11434 before Ollama starts, it could intercept image data. This requires a malicious local process with the ability to bind privileged or semi-privileged ports. On Windows, any process can bind to port 11434.
- **No authentication:** Ollama's default configuration has no auth. The connection is trusted solely by virtue of being on localhost.
- **Data exposure:** Base64-encoded images are sent in HTTP POST bodies. A local packet sniffer could capture this traffic.

**Accepted rationale:** These risks are inherent to all local AI tools in the ecosystem. The threat model for a single-user desktop application does not require authenticated localhost connections. The reqwest client has a 60-second timeout configured (line 14).

---

## 10. Disk Full (D-13) -- GAP (Medium)

### What was checked
- `src-tauri/src/commands/filesystem.rs:65-116` (`check_disk_space` command, disk space helpers)
- `src-tauri/src/filesystem/import.rs:15-145` (`import_single_file` error handling)
- `src-tauri/src/commands/images.rs:29-30` (`AppError::DiskFull` variant)

### Findings

**Gap 10a -- `AppError::DiskFull` is defined but NEVER emitted.**
The error variant exists (`images.rs:29-30`):
```rust
#[error("Disk full: {0}")]
DiskFull(String),
```
But no code path in the entire codebase returns `Err(AppError::DiskFull(...))`. A grep for `DiskFull` across `src-tauri/src/` confirms it only appears in the enum definition and the `#[error]` attribute.

**Gap 10b -- `check_disk_space` on Windows returns a hardcoded 1GB.**
`filesystem.rs:92-102`:
```rust
#[cfg(target_os = "windows")]
fn get_available_space(path: &std::path::Path) -> u64 {
    use std::os::windows::fs::MetadataExt;
    if let Ok(metadata) = std::fs::metadata(path) {
        let _ = metadata.file_size(); // reads file size, discards it
    }
    // Return 1GB as safe default (actual check happens at write time)
    1024 * 1024 * 1024
}
```
This function always returns 1,073,741,824 (1GB) regardless of actual available disk space. The imported `MetadataExt` is used only to call `file_size()` whose return value is discarded. The comment correctly states that the actual check happens at write time, but the pre-check is useless on Windows.

**Gap 10c -- Disk-full errors caught as generic "File copy failed".**
When `fs::copy` or `File::create` fails due to "No space left on device" (`filesystem/import.rs:84-93`), the error is wrapped as:
```rust
error: Some(format!("File copy failed: {}", e)),
```
The `AppError::DiskFull` variant is never used, so the frontend cannot distinguish "disk full" from "permission denied" or "path too long". The `ImportResult.errors` field will contain generic messages.

**Gap 10d -- No pre-import total-size estimation.** The documented approach in `filesystem.rs:68-69` says "Before import: estimate total bytes needed (sum of source file sizes)" but the `import_images` command does not implement this pre-check.

### Recommendation
- Use `GetDiskFreeSpaceExW` (Windows API via `windows-sys` crate) for accurate available space
- In `import_single_file`, check for OS error code 112 ("No space left on device") and return `AppError::DiskFull`
- Add a total-size pre-check in `import_images` before starting the import loop

---

## Additional Observations

### A. Sidecar binary not present in repository
The `src-tauri/binaries/` directory is empty (`src-tauri/bundle/binaries` is referenced via `externalBin` in `tauri.conf.json` line 50). The sidecar binary must be built manually (per `v0.3-MILESTONE-COMPLETION.md` "Manual Steps Required"). This is a known deployment requirement, not a defect.

### B. `_migrated` flag double-bookkeeping
The settings migration uses two independent flags:
- Frontend: `localStorage.getItem("lumora_migrated_to_tauri")` (`settings-store.ts:56`)
- Backend: `store.has("_migrated")` (`settings.rs:189`)

These are consistent in practice (both set during migration), but a failure mode exists: if the store write succeeds but the localStorage write fails (or vice versa), the migration could be skipped or duplicated. Both paths are idempotency-safe (backend checks `_migrated` before writing; frontend sets `lumora_migrated_to_tauri` after successful invoke), so at worst the migration is attempted twice.

### C. `regenerate_thumbnail` and `relocate_file` are stubs
Both commands (`images.rs:709-725`) return `Ok(())` without performing any operation. The frontend can invoke them, but they silently succeed with no effect. This is documented as "Stub for Plan 07" but could confuse the UI if it calls these expecting real behavior.

### D. No input length limits on `search_images` query
The FTS5 search query (`images.rs:272`) accepts an unbounded string. While FTS5 tokenizes the input safely, very long query strings (megabytes) could cause excessive CPU usage in the FTS5 tokenizer. Consider a reasonable length cap (e.g., 1000 characters).

### E. `generate_embeddings` only processes 1 image
The command (`images.rs:634-636`) only generates embeddings for the FIRST image in the queue, not the full batch:
```rust
// For now, generate the first image's embedding as a demonstration.
let first_id = image_ids[0].clone();
```
The comment says "Full batch processing will be implemented in a future plan." This is a feature gap, not a security issue, but it means the "Generate All Embeddings" promise is misleading.

---

## Risk Matrix

| Risk | Likelihood | Impact | Severity |
|------|-----------|--------|----------|
| Sidecar crash without restart | Medium -- Python processes can crash | Medium -- AI features unusable | Medium |
| Missing sidecar binary panics app | High -- fresh install won't have it | High -- app won't start | **High** |
| Disk full not distinguished from other errors | Low -- disk full is rare on modern SSDs | Medium -- user doesn't know why import failed | Medium |
| CSP misconfiguration | Low -- unlikely to be exploited in webview | Low -- Tauri's webview is isolated | Low |
| File path in error messages | Medium -- errors are visible in UI | Low -- user owns the data | Low |
| Mutex blocks UI during import | High -- every large import triggers this | Low -- temporary unresponsiveness | Low |

---

## Recommendations Prioritized

1. **CRITICAL:** Remove `.expect()` on sidecar spawn -- degrade gracefully if binary missing
2. **HIGH:** Implement sidecar auto-restart with backoff
3. **HIGH:** Fix `AppError::DiskFull` to be actually emitted on OS error 112
4. **MEDIUM:** Use `GetDiskFreeSpaceExW` on Windows for accurate disk space
5. **MEDIUM:** Add `PRAGMA quick_check` at database startup
6. **LOW:** Sanitize file paths in user-facing error messages
7. **LOW:** Verify and correct CSP `asset:` protocol format
8. **LOW:** Add query length limit to `search_images`
9. **LOW:** Fix `build.py` `--onefile`/`--onedir` discrepancy or update documentation
