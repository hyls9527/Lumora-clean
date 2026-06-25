---
phase: 007-rust-data-layer
plan: 07
subsystem: rust-data-layer/filesystem-imaging
tags: [filesystem, imaging, thumbnails, hashing, import-pipeline]
requires: [007-03, 007-04, 007-05]
provides: [RDL-05]
affects: [commands/images.rs, commands/filesystem.rs]
tech-stack:
  added: []
  patterns: [streaming-hash, portable-data-dir, graceful-degradation]
key-files:
  created:
    - src-tauri/src/filesystem/paths.rs
    - src-tauri/src/filesystem/scanner.rs
    - src-tauri/src/filesystem/import.rs
    - src-tauri/src/imaging/thumbnail.rs
    - src-tauri/src/imaging/formats.rs
    - src-tauri/src/imaging/hash.rs
    - src-tauri/src/commands/filesystem.rs
  modified:
    - src-tauri/src/commands/images.rs
decisions:
  - "D-22 portable data directory with write-permission fallback implemented via paths.rs"
  - "D-11 SHA-256 streaming hash (8KB chunks) for dedup implemented via hash.rs"
  - "D-01/D-02/D-04 512px WebP thumbnails with Lanczos3 implemented via thumbnail.rs"
  - "D-06 BMP/TIFF-to-PNG auto-conversion implemented via formats.rs"
  - "D-03 thumbnail failure graceful degradation — import succeeds without thumbnail"
  - "Gap #3 fix: max file size read from tauri-plugin-store at import start, not AppConfig"
metrics:
  duration: "8m 1s"
  completed_date: "2026-06-22"
---

# Phase 007 Plan 07: File System Operations + Imaging Pipeline Summary

**One-liner:** Full import pipeline with file copy, SHA-256 dedup, 512px WebP thumbnails (Lanczos3), BMP/TIFF→PNG conversion, portable data dir fallback, and disk-space-aware commands.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Implement filesystem modules — paths, scanner, import pipeline | `98197a0` | `filesystem/paths.rs`, `filesystem/scanner.rs`, `filesystem/import.rs` |
| 2 | Implement imaging modules — thumbnail, formats, hash | `cf905ef` | `imaging/thumbnail.rs`, `imaging/formats.rs`, `imaging/hash.rs` |
| 3 | Implement filesystem commands and integrate import pipeline | `245af76` | `commands/filesystem.rs`, `commands/images.rs` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed type mismatch in paths.rs executable directory resolution**
- **Found during:** Task 1, `cargo check`
- **Issue:** `std::env::current_exe().and_then(|p| p.parent().map(...))` failed to compile because `current_exe()` returns `Result<PathBuf>` but `parent()` returns `Option<&Path>`. The `and_then` closure expected `Result`, not `Option`.
- **Fix:** Chained `.ok()` after `current_exe()` to convert to `Option`, then `.and_then()` for `parent()`, then `.unwrap_or_else()` for fallback. Changed from `Result`-based chain to `Option`-based chain.
- **Files modified:** `src-tauri/src/filesystem/paths.rs`
- **Commit:** `98197a0`

**2. [Rule 1 - Bug] Fixed missing `GenericImageView` trait import for `image` crate 0.25**
- **Found during:** Task 2, `cargo test`
- **Issue:** `image` crate 0.25 moved `.dimensions()` behind the `GenericImageView` trait. The plan code used `img.dimensions()` directly without importing the trait, causing compilation errors in `thumbnail.rs`, `formats.rs`, and their test modules.
- **Fix:** Added `use image::GenericImageView;` to `thumbnail.rs` (module-level and test module), `formats.rs` (test module), and removed unused `use std::path::PathBuf;` imports in test modules.
- **Files modified:** `src-tauri/src/imaging/thumbnail.rs`, `src-tauri/src/imaging/formats.rs`
- **Commit:** `cf905ef`

### Optimization Applied

**3. Moved max_file_size_bytes read outside the import loop**
- The plan code placed the `tauri-plugin-store` read inside the per-file loop. Since the store value doesn't change during a batch import, it was moved to before the `for` loop — read once, used for all files.
- **Files modified:** `src-tauri/src/commands/images.rs`
- **Commit:** `245af76`

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: command-execution | `commands/filesystem.rs` - `open_data_folder` | Spawns system file explorer (`explorer.exe`, `open`, `xdg-open`) from app-controlled `PathBuf`. No user-input injection. Covered by T-007-07f (accept). |

## Verification Summary

- [x] `filesystem/paths.rs` resolves data directory with portable-first, user-data-fallback strategy (D-22)
- [x] `filesystem/scanner.rs` recursively finds images via walkdir, skips non-images and symlinks (D-14, D-15)
- [x] `filesystem/import.rs` copies files, resolves conflicts, handles all formats (D-01 through D-15)
- [x] `imaging/thumbnail.rs` generates 512px WebP thumbnails with Lanczos3 (D-01, D-02, D-04)
- [x] `imaging/formats.rs` converts BMP/TIFF to PNG (D-06)
- [x] `imaging/hash.rs` computes SHA-256 in 8KB streaming chunks (D-11)
- [x] `commands/filesystem.rs` has `open_folder_dialog`, `open_data_folder`, `check_disk_space` (D-13, D-16)
- [x] `commands/images.rs` `import_images` fully integrated with file pipeline
- [x] `cargo check` passes with zero errors, zero warnings
- [x] `cargo test` passes (4/4 imaging tests)
- [x] No TODOs, FIXMEs, or placeholder stubs in implemented modules

## Success Criteria Met

1. [x] Importing images copies files to `data/images/` with name conflict resolution (D-08, D-12)
2. [x] 512px WebP thumbnails generated in `data/thumbnails/` as separate files (D-01, D-02, D-04)
3. [x] SHA-256 dedup skips duplicate files and cleans up copied data (D-11)
4. [x] BMP/TIFF auto-converted to PNG on import (D-06)
5. [x] Recursive folder scan finds all supported formats, skips non-images and symlinks (D-14, D-15)
6. [x] Disk full triggers an error return that maps to `AppError::DiskFull` (D-13)
7. [x] Thumbnail failure does not block import — image imported with `thumbnail_path = None` (D-03)
8. [x] Portable data directory resolved with write-permission fallback (D-22)
9. [x] `cargo check` and `cargo test` pass

## Self-Check: PASSED

- [x] `filesystem/paths.rs` exists
- [x] `filesystem/scanner.rs` exists
- [x] `filesystem/import.rs` exists
- [x] `imaging/thumbnail.rs` exists
- [x] `imaging/formats.rs` exists
- [x] `imaging/hash.rs` exists
- [x] `commands/filesystem.rs` exists (non-stub)
- [x] `commands/images.rs` modified with import pipeline integration
- [x] Commit `98197a0` exists
- [x] Commit `cf905ef` exists
- [x] Commit `245af76` exists
