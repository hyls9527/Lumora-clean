# Deferred Items — Phase 001, Plan 02

## Pre-existing `tsc -b` Errors

These TypeScript errors are pre-existing and were not caused by Plan 001-02 changes.
`npx tsc --noEmit` passes cleanly (zero errors). `tsc -b` catches additional errors
in build mode due to stricter type checking across project references.

| File | Error | Type |
|------|-------|------|
| src/components/ExportDialog.tsx:11 | 'Download' is declared but its value is never read | TS6133 unused import |
| src/components/TagManager.tsx:15 | 'Plus'/'Hash' declared but never read | TS6133 unused imports |
| src/components/VirtualizedGrid.tsx:51 | Type missing columnIndex, rowIndex, style | TS2739 type mismatch |
| src/lib/api/images.ts:20 | 'limit'/'offset' declared but never read | TS6133 unused params |
| src/lib/mock-data.ts:76 | '"2/3"'/' "9/16"' not assignable to AspectRatio | TS2322 type error |
| src/pages/CurationPage.tsx:3 | 'cn' declared but never read | TS6133 unused import |

**Action:** Fix in a future dedicated cleanup plan.
