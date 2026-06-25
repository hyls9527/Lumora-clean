# Phase 007: Rust Data Layer — Validation Architecture

**Generated:** 2026-06-22
**Source:** Extracted from RESEARCH.md Validation Architecture section (lines 929-974)
**Nyquist Gate:** ENABLED

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | cargo test (Rust built-in) |
| Config file | None — see Wave 0 gaps |
| Quick run command | `cargo test` (all tests) |
| Full suite command | `cargo test -- --nocapture` |
| Frontend check | `npx tsc --noEmit` (Phase gate only) |

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RDL-01 | Schema migration chain applies correctly | unit | `cargo test db::migrations::test_migrations_apply` | ❌ Wave 0 |
| RDL-01 | Migration rollback on crash | integration | `cargo test db::migrations::test_atomic_migration` | ❌ Wave 0 |
| RDL-02 | Import image stores record in DB | integration | `cargo test commands::images::test_import_image` | ❌ Wave 0 |
| RDL-02 | List images with pagination | unit | `cargo test commands::images::test_list_images_pagination` | ❌ Wave 0 |
| RDL-02 | Soft delete sets is_deleted flag | unit | `cargo test commands::images::test_soft_delete` | ❌ Wave 0 |
| RDL-03 | FTS5 search returns ranked results | integration | `cargo test db::search::test_fts5_search_relevance` | ❌ Wave 0 |
| RDL-03 | FTS5 content sync on image update | integration | `cargo test db::search::test_fts5_sync_on_update` | ❌ Wave 0 |
| RDL-04 | Settings persist across app restart | integration | `cargo test commands::settings::test_settings_persistence` | ❌ Wave 0 |
| RDL-04 | Settings restore defaults | unit | `cargo test commands::settings::test_reset_defaults` | ❌ Wave 0 |
| RDL-05 | Recursive folder scan finds all images | unit | `cargo test filesystem::scanner::test_recursive_scan` | ❌ Wave 0 |
| RDL-05 | Thumbnail generation creates 512px webp | unit | `cargo test imaging::thumbnail::test_generate_thumbnail` | ❌ Wave 0 |
| RDL-05 | BMP/TIFF converted to PNG on import | unit | `cargo test imaging::formats::test_bmp_to_png_conversion` | ❌ Wave 0 |

---

## Sampling Rate

- **Per task commit:** `cargo test` (quick — Rust tests run fast with in-memory SQLite)
- **Per wave merge:** `cargo test` (full suite)
- **Phase gate:** Full suite green + `npx tsc --noEmit` green for frontend changes, before `/gsd-verify-work`

---

## Wave 0 Gaps

- [ ] `src-tauri/Cargo.toml` — Add `[dev-dependencies]` for test helpers (e.g., `tempfile`)
- [ ] `src-tauri/tests/` — Integration test directory
- [ ] `src-tauri/src/db/migrations.rs` — Unit tests verifying migration chain
- [ ] `src-tauri/src/db/search.rs` — Unit tests for FTS5 queries
- [ ] `src-tauri/src/imaging/thumbnail.rs` — Unit test with a small test image
- [ ] `src-tauri/src/filesystem/scanner.rs` — Unit test with temp directory structure
- [ ] Each module should have `#[cfg(test)] mod tests { ... }` for inline unit tests
- [ ] Test helper: create in-memory SQLite with full schema for test isolation

---

## Security Validation

See RESEARCH.md Security Domain section for:
- ASVS category applicability (V4 Access Control, V5 Input Validation, V6 Cryptography, V7 Error Handling)
- Known threat patterns for Tauri + SQLite (path traversal, SQL injection, large file DoS, symlink attacks, race conditions, data directory permissions)
- STRIDE threat registers in each PLAN.md (007-04 through 007-08)

---
*Validation architecture: 2026-06-22*
