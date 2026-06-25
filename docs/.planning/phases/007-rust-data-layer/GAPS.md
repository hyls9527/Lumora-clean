# Phase 007 GAPS.md

**Generated:** 2026-06-22
**Status:** ALL FIXED — 4 BLOCKERS resolved, 4 WARNINGS resolved
**Fixes applied:** 2026-06-22

---

## Gap #1 [BLOCKER] -- Missing VALIDATION.md (Nyquist Gate)

**Category:** Nyquist compliance (Dimension 8 Check 8e)
**Affected plans:** All (phase-level)

**Description:**
The file 007-VALIDATION.md was not produced during the research phase.
RESEARCH.md contains a Validation Architecture section (lines 929-974) with
a per-requirement test map, but this was not extracted into the standalone
file required by the Nyquist pipeline.

**Impact if unfixed:**
The Nyquist gate will block execution. Tests may not be properly set up.

**Recommended fix:**
Create .planning/phases/007-rust-data-layer/007-VALIDATION.md containing:
1. Test framework: cargo test
2. Per-requirement automated test commands (12 tests mapped in RESEARCH.md)
3. Sampling rate: per task commit, per wave merge
4. Wave 0 gap status: 8 items listed in RESEARCH.md
The content already exists in RESEARCH.md -- it just needs extraction.

---

## Gap #2 [BLOCKER] -- D-16 Startup File Scan Not Wired

**Category:** Decision coverage
**Affected plans:** 04 (database layer), 07 (filesystem)
**Relevant decision:** D-16

**Description:**
The infrastructure for D-16 exists but the startup invocation is missing:
- find_file_missing_images() query function exists (Plan 04 Task 3)
- File-missing UI overlay exists (Plan 08 Task 2B)
- But NO task calls the query at startup, checks file existence on disk,
  and updates the database

Without the startup scan, the "file missing" markers on ImageCards will
never activate because the data to drive them is never collected.

**Impact if unfixed:**
Users won't know which images have become unavailable until they try to
open one and see a broken image.

**Recommended fix (Option A, preferred):**
Add to Plan 04 Task 2 (db/connection.rs initialize_database):
After database init and FTS5 triggers are set up, add a startup scan:
1. Query all non-deleted images (id, file_path)
2. For each, check std::fs::metadata(path).is_ok()
3. If missing, update the image record with a status flag
4. Log the count of missing files found

**Recommended fix (Option B):**
Add a new task to Plan 07 that implements run_startup_scan() in
filesystem/scanner.rs, called during lib.rs setup after DB init.

---

## Gap #3 [BLOCKER] -- MaxFileSizeMB Setting Does Not Reach Import Pipeline

**Category:** Cross-plan data contract
**Affected plans:** 06 (settings commands), 07 (import pipeline)
**Relevant decision:** D-09

**Description:**
- Plan 06 stores maxFileSizeMB in tauri-plugin-store via set_setting
- Plan 08 provides UI to change it (default 200MB, range 1-500)
- Plan 07 import pipeline reads max_file_size_mb from AppConfig
- AppConfig is initialized to 200MB and NEVER updated

When the user changes the setting to 50MB, AppConfig still has 200MB.
The import_images command reads from AppConfig, so the 50MB limit is
silently ignored.

**Impact if unfixed:**
Users' file size limit setting is silently ignored. Files they wanted to
skip will still be imported. This is a data integrity / UX failure.

**Recommended fix:**
In Plan 07 Task 3, before the import loop starts, read maxFileSizeMB
from tauri-plugin-store:
```
use tauri_plugin_store::StoreExt;
let max_mb = app.store("settings.json")
    .and_then(|s| s.get("maxFileSizeMB"))
    .and_then(|v| v.as_str().map(|s| s.parse::<u64>().ok()))
    .flatten()
    .unwrap_or(200);
let max_bytes = max_mb * 1024 * 1024;
```
Then pass max_bytes to import_single_file() instead of app_state.config.

---

## Gap #4 [BLOCKER] -- Invalid i18n Key: common.cancel

**Category:** Task completeness
**Affected plan:** 08 (UI elements)
**Affected task:** Task 1 Part C

**Description:**
Plan 08 uses t("common.cancel") in the restore defaults confirmation
dialog, but no "common" section exists in the i18n locale files. The
existing cancel keys are under "export.cancel" and "embedding.cancel".

**Impact if unfixed:**
The dialog will show "common.cancel" as raw text instead of a translation.

**Recommended fix (Option A):**
Add a "common" section to Plan 08 Task 1 i18n additions:
  en.json: "common": { "cancel": "Cancel" }
  zh.json: "common": { "cancel": "取消" }

**Recommended fix (Option B):**
Change the dialog code to use t("export.cancel") instead.

---

## Warning #1 -- Plan 05-07 File Coordination Undocumented

**Category:** Dependency correctness
**Affected plans:** 05, 07
**Severity:** WARNING

**Description:**
Both plans modify commands/images.rs. Plan 05 creates import_images;
Plan 07 extends it. Neither explicitly states they modify the same file.

**Recommended fix:**
Add to Plan 07 Task 3 action: "IMPORTANT: This modifies commands/images.rs
as written by Plan 05 Task 3. Insert the import pipeline between the
is_supported_image check and the image_dimensions call."

---

## Warning #2 -- Open Questions Lacks (RESOLVED) Marker

**Category:** Research resolution
**File:** 007-RESEARCH.md, line 881
**Severity:** WARNING

**Description:**
Section heading lacks "(RESOLVED)" suffix. All 5 questions have
recommendations but formal markers are absent.

**Recommended fix:**
Change "## Open Questions" to "## Open Questions (RESOLVED)".

---

## Warning #3 -- Plan 08 Wave Assignment Suboptimal

**Category:** Dependency correctness
**Affected plan:** 08
**Severity:** WARNING

**Description:**
Plan 08 is wave 5 but only depends on Plan 02 (wave 1). Could be wave 2.

**Recommended fix:**
Change plan 08 to wave: 2, depends_on: [007-02].

---

## Warning #4 -- Plan 03 Has 26 Files Modified

**Category:** Scope sanity
**Affected plan:** 03
**Severity:** WARNING

**Description:**
26 files exceeds the 15-file threshold. Acceptable as greenfield scaffold.

**Recommended fix:**
No change required. Executor should create files in logical batches.

---

## Summary

| Gap | Severity | Plans | Effort |
|-----|----------|-------|--------|
| #1: Missing VALIDATION.md | BLOCKER | Phase | Low |
| #2: D-16 startup scan unwired | BLOCKER | 04,07 | Medium |
| #3: MaxFileSizeMB sync | BLOCKER | 06,07 | Low |
| #4: Invalid i18n key | BLOCKER | 08 | Low |
| W1: Plan 05-07 coordination | WARNING | 05,07 | Low |
| W2: Open Questions marker | WARNING | RESEARCH | Low |
| W3: Plan 08 wave | WARNING | 08 | Low |
| W4: Plan 03 file count | WARNING | 03 | None |

**Total estimated fix time:** ~30 minutes for all blockers + warnings.
