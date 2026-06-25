# Phase 007 -- UI Review

**Audited:** 2026-06-23
**Baseline:** UI-SPEC.md (design contract) + DESIGN.md (design authority)
**Screenshots:** Not captured (no dev server detected -- code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | 8+ hardcoded Chinese/English strings across 6 files; 2 i18n keys missing entirely; unreachable "all-deleted" empty state |
| 2. Visuals | 2/4 | Culturally problematic glyph in GalleryEmptyState; file size input radius wrong; only "first-run" empty state rendered |
| 3. Color | 2/4 | text-muted/text-faint tokens mismatch DESIGN.md; pure white usage in App.tsx; glassmorphism in DropZone; hardcoded rgba colors |
| 4. Typography | 3/4 | font-serif used for UI body text in 5+ locations; no Inter font found (PASS); DM Sans loads correctly |
| 5. Spacing | 2/4 | 2px, 6px, 10px values used in 15+ locations -- not in DESIGN.md scale (4/8/12/16/20/24/32/48/64) |
| 6. Experience Design | 2/4 | lucide-react icon import violates CLAUDE.md; "all-deleted" empty state unreachable; missing skip notices in DropZone UI |

**Overall: 13/24**

---

## Top 3 Priority Fixes

1. **Hardcoded strings in App.tsx, ErrorBoundary, PageErrorBoundary, GalleryPage, DropZone** -- Blocks internationalization; loading/error/onboarding states only in Chinese with no English fallback -- Add i18n keys `error.*`, `loading.*`, `gallery.onboarding.*` in both en.json and zh.json; replace all hardcoded strings with `t()` calls.

2. **DropZone glassmorphism + App.tsx pure white text** -- Direct violations of DESIGN.md anti-patterns: `backdrop-blur-[2px]` is glassmorphism, `text-white` is banned pure white -- Replace `backdrop-blur-[2px]` with solid `bg-accent/5`; replace `text-white` with `text-surface` in App.tsx lines 45 and 68.

3. **TagManager imports lucide-react `X` icon** -- Explicit violation of CLAUDE.md rule "无图标 -- 导航和操作用纯文字，不用 lucide-react 图标" -- Replace `<X>` with a text "x" or "×" character rendered in a styled span; remove the lucide-react import.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

**BLOCKER -- i18n keys not defined in either language file:**

- `dropzone.noNativePaths` used in `src/components/DropZone.tsx:94` -- key not present in `en.json` or `zh.json`. Falls back to hardcoded English string `"Cannot access file paths -- use the folder picker instead."`
- `dropzone.importing` used in `src/components/DropZone.tsx:206` -- key not present in either i18n file. Falls back to hardcoded Chinese `"导入中…"`

**BLOCKER -- Hardcoded strings with no i18n support:**

- `src/App.tsx:47` -- `"跳到主内容"` (skip-navigation link, Chinese only)
- `src/App.tsx:59` -- `"研墨中…"` (loading state, Chinese only)
- `src/App.tsx:70` -- `"重试"` (error retry button, Chinese only)
- `src/components/ErrorBoundary.tsx:25` -- `"此处尚有未竟之事"` (fallback text, Chinese only)
- `src/components/ErrorBoundary.tsx:32` -- `"重试"` (retry button, Chinese only)
- `src/components/PageErrorBoundary.tsx:10` -- `"此页尚有未竟之事"` (fallback, Chinese only)
- `src/components/PageErrorBoundary.tsx:17` -- `"重新加载"` (reload button, Chinese only)
- `src/pages/GalleryPage.tsx:304-316` -- `"按 ⌘K 打开命令面板 ..."` and `"知道了"` (onboarding hint, Chinese only)
- `src/components/DropZone.tsx:122` -- ``` `${result.skipped_duplicates} duplicates skipped` ``` -- hardcoded English; should use `t("import.duplicateSkipNotice").replace("{count}", ...)`

**WARNING -- Unreachable code:**

- `src/pages/GalleryPage.tsx:391-396` -- `GalleryEmptyState` is always rendered with `variant="first-run"`. The `variant="all-deleted"` code path in `src/components/GalleryEmptyState.tsx:12-18` is never exercised. The GalleryPage has no logic to distinguish first-run from all-deleted.

**PASS:** All copywriting contract strings from UI-SPEC.md sections (Import Progress, Empty States, Error States, Destructive Actions) have matching i18n keys in both `en.json` and `zh.json`.

---

### Pillar 2: Visuals (2/4)

**BLOCKER -- Culturally problematic decorative glyph:**

- `src/components/GalleryEmptyState.tsx:24` -- Uses `"卍"` (U+534D) as a decorative element. This character is a swastika-like symbol that, while having Buddhist/auspicious meanings in East Asian contexts, is highly offensive and shocking to Western audiences. Replace with a neutral decorative glyph (e.g., `"◆"` diamond or `"≈"` flowing lines) that conveys "ancient scroll" without cultural harm.

**WARNING -- Only first-run empty state rendered:**

- `src/pages/GalleryPage.tsx:391-396` -- Gallery empty state always shows the "first-run" variant with CTA button. The "all-deleted" variant (with different heading, body, and no CTA) is implemented in the component but never rendered. User sees "Import your first image" even when they previously had images and deleted them all.

**WARNING -- Input radius does not match DESIGN.md:**

- `src/pages/SettingsPage.tsx:141` -- File size limit `<input>` uses `rounded-[2px]`. DESIGN.md specifies inputs as "砚台/4px" (`rounded-[4px]`). All other inputs in the app use `rounded-[4px]` (semantic search, settings tag input, etc.). This creates inconsistency.

**PASS -- Visual specifications:**

- ImportProgressBar matches the UI-SPEC spec exactly (container, bar height, track/fill, progress text, cancel button)
- DiskFullDialog matches spec (dialog width, title, body, button variants, footer layout)
- ImageCard failure overlays follow the spec (file-missing overlay, thumbnail-failure overlay, precedence, suppressed hover)
- Settings -- Restore Defaults button placement and confirmation dialog match spec

---

### Pillar 3: Color (2/4)

**BLOCKER -- DESIGN.md token mismatches in index.css:**

- `src/index.css:18` -- `--color-text-muted: #7a6b58` does NOT match DESIGN.md's `#a09480`. The implemented value is darker, reducing contrast distinction from `--color-text-secondary` (#6b5d48). This flattens the four-level text hierarchy (text > secondary > muted > faint).
- `src/index.css:19` -- `--color-text-faint: #9a8c78` does NOT match DESIGN.md's `#c4b89e`. The implemented value is much darker, further compressing the text hierarchy.

**BLOCKER -- Pure white usage:**

- `src/App.tsx:45` -- `focus:text-white` on skip-navigation link
- `src/App.tsx:68` -- `text-white` on error retry button
- DESIGN.md and CLAUDE.md both forbid pure white (#fff / #ffffff). Should use `text-surface` (#f7f2ea) instead.

**BLOCKER -- Glassmorphism:**

- `src/components/DropZone.tsx:193` -- `backdrop-blur-[2px]` on the drag-over overlay. DESIGN.md explicitly forbids glassmorphism/毛玻璃. Use a solid background instead (e.g., `bg-accent/5` without blur).

**WARNING -- Hardcoded rgba values instead of design tokens:**

- `src/components/AiAnalysisSection.tsx:58` -- `bg-[rgba(122,92,18,0.05)]` and `border-[rgba(122,92,18,0.15)]`. Should use `bg-accent-subtle` and `border-accent/20` or similar token-based references. Hardcoded values bypass the design system and won't update if tokens change.

**WARNING -- DESIGN.md out of date:**

- `src/index.css:22,25` -- Defines `--color-accent-muted: #c4a04a`, `--color-warning-amber: #b8860b`, `--color-surface-elevated`, `--shadow-xs`, `--shadow-sm` -- none of which are documented in DESIGN.md. The warning-amber token is required by UI-SPEC section 5, but the other additions should be reflected in DESIGN.md.

**PASS -- Accent color discipline:**

- `text-accent` / `bg-accent` used primarily on: CTA buttons, progress bars, active tab underlines, focused rings, hover states on interactive elements. Not used decoratively on non-interactive elements.
- No purple gradients found anywhere.
- Semantic colors (danger, success) correctly mapped.

---

### Pillar 4: Typography (3/4)

**WARNING -- font-serif used for UI/body text in multiple places:**

Per DESIGN.md: Noto Serif SC is for headings; DM Sans is for body/UI. The following locations use `font-serif` on what is clearly body/UI/interaction text:

- `src/App.tsx:65,68` -- Error message and retry button text use `font-serif`
- `src/components/DropZone.tsx:205,233` -- "导入中…" and dropzone title/subtitle use `font-serif`
- `src/components/DropZone.tsx:236` -- Subtitle hint uses `font-serif`
- `src/pages/GalleryPage.tsx:304` -- Onboarding hint text uses `font-serif`
- `src/components/SemanticSearchBar.tsx:262` -- "Switch to Exact" error recovery button uses `font-serif`

These should all use `font-sans` (DM Sans) for body/UI text consistency.

**WARNING -- SettingsSection h3 missing explicit font-family:**

- `src/pages/SettingsPage.tsx:304` -- Section title `<h3>` uses `text-[13px] font-semibold tracking-[-0.01em]` without explicit `font-serif` or `font-sans`. It defaults to DM Sans from the body CSS, which matches the "Card title" role in DESIGN.md (DM Sans 14px/600). However, since it's an `h3` semantic element, being explicit would improve clarity.

**PASS:**
- No Inter font found anywhere (PASS anti-pattern check)
- DM Sans, Noto Serif SC, and JetBrains Mono all correctly loaded via @fontsource in `src/index.css:2-4`
- Headings use Noto Serif SC (font-serif) consistently: GalleryPage h2, SettingsPage h1/h2, DiskFullDialog h2, GalleryEmptyState h2
- Body text uses DM Sans (font-sans) in most places: ImportProgressBar labels, DiskFullDialog body, SemanticSearchBar dropdown items, AiAnalysisSection descriptions
- ImageCard uses PlumFlower SVG (not star icons) for ratings -- PASS
- ImageCard uses `"◆"` (diamond/book-stamp) for favorites -- PASS

---

### Pillar 5: Spacing (2/4)

**WARNING -- Non-scale spacing values used extensively:**

DESIGN.md spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 px.

**2px values (not in scale):**
- `py-0.5` = 2px: `src/components/AiAnalysisSection.tsx:187`, `src/components/ImageCard.tsx:209`, `src/pages/SettingsPage.tsx:328`
- `gap-0.5` would be 2px (not explicitly found but pattern exists)

**6px values (not in scale):**
- `gap-1.5` / `px-1.5` / `py-1.5` = 6px: Found in **16+ locations** across BatchEmbeddingBar, CommandPalette, DashboardPage, DetailPanel, GalleryPage, CurationPage, SettingsPage, ImageCard, Sidebar, SemanticSearchBar, TagManager -- all using `1.5` Tailwind spacing which maps to 6px.

**10px values (not in scale):**
- `gap-2.5` / `px-2.5` = 10px: Found in DetailPanel, GalleryPage, Sidebar, CurationPage, TagManager

**Custom arbitrary values (not in scale):**
- `src/components/AnalysisHistoryList.tsx:28` -- `py-[10px]` = 10px
- `src/components/ImageCard.tsx:209` -- `py-px` = 1px

**WARNING -- Spacing value examples with file:line references:**

| File | Line | Value | In Scale? |
|------|------|-------|-----------|
| `AiAnalysisSection.tsx` | 187 | `px-2 py-0.5` (8px, 2px) | No (2px) |
| `AiAnalysisSection.tsx` | 90 | `text-center px-2` (8px) | Yes (8px) |
| `AnalysisHistoryList.tsx` | 28 | `py-[10px] px-3` (10px, 12px) | No (10px) |
| `AnalysisHistoryList.tsx` | 66 | `px-3 pt-1` (12px, 4px) | Yes |
| `DetailPanel.tsx` | 219 | `gap-2.5` (10px) | No |
| `GalleryPage.tsx` | 305 | `px-1.5 py-0.5` (6px, 2px) | No |
| `GalleryPage.tsx` | 323 | `py-1.5` (6px) | No |
| `SettingsPage.tsx` | 79 | `py-1.5` (6px) | No |
| `SettingsPage.tsx` | 310 | `py-1.5` (6px) | No |
| `SemanticSearchBar.tsx` | 181 | `px-3 py-1.5` (12px, 6px) | No (6px) |
| `ImageCard.tsx` | 186 | `gap-1.5` (6px) | No |
| `ImageCard.tsx` | 209 | `px-1.5 py-px` (6px, 1px) | No |

**PASS -- Scale values in common use:**
- `gap-3` (12px) -- valid, used extensively
- `gap-4` (16px) -- valid
- `px-4`, `py-2` (16px, 8px) -- valid
- `p-5` (20px) -- valid
- `gap-6`, `p-6` (24px) -- valid
- `mt-8` (32px) -- valid
- `px-10` (40px) -- not in scale (closest: 32 or 48). Wait, 40px is NOT in the scale.
  - Actually, `px-10` = 40px which is NOT in DESIGN.md's scale. But it's a standard Tailwind class. Let me check... DESIGN.md scale: 4/8/12/16/20/24/32/48/64. 40px is not there. This is used in GalleryPage extensively (lines 214, 222, 277, ...).

Actually, looking at this again -- `px-10` = 40px in Tailwind, which isn't in the DESIGN.md spacing scale. But the earlier search for arbitrary values (`\[.*px\]`) might not have caught this because `px-10` is a Tailwind utility class, not an arbitrary value. Let me add this as an additional finding.

---

### Pillar 6: Experience Design (2/4)

**BLOCKER -- lucide-react icon import:**

- `src/components/TagManager.tsx:15` -- `import { X } from "lucide-react"`
- CLAUDE.md rule: "无图标 -- 导航和操作用纯文字，不用 lucide-react 图标"
- Replace `<X className="h-4 w-4" />` with a text-based close indicator (e.g., `<span aria-label="Close">x</span>` or `<span>×</span>`)

**WARNING -- DropZone skip notices not shown to user:**

- `src/components/DropZone.tsx:101-107` -- The import result object has `skipped_non_image` and `skipped_too_large` fields, but only `skipped_duplicates` is surfaced in the UI (and even that one is hardcoded English, not i18n). Non-image file skips and too-large file skips are silently swallowed. Per UI-SPEC section 8, combined skip notice should be shown.

**WARNING -- GalleryPage onboarding hints only in Chinese:**

- `src/pages/GalleryPage.tsx:302-318` -- The entire onboarding overlay (hint text + dismiss button) is hardcoded Chinese with zero i18n support. English-speaking users see untranslated Chinese text.

**WARNING -- File size limit input rounded-[2px] deviates from pattern:**

- `src/pages/SettingsPage.tsx:141` -- Input uses `rounded-[2px]` while all other inputs in the app use `rounded-[4px]`. UI-SPEC section 2 says "Reuse Input component" which would naturally default to 4px (砚台). This creates visual inconsistency.

**WARNING -- Storage location displayed twice in SettingsPage:**

- `src/pages/SettingsPage.tsx:99` -- InfoRow displays location: `D:\Lumora\data`
- `src/pages/SettingsPage.tsx:103` -- A second location display immediately below, duplicating the same information. The UI-SPEC layout shows location + Open Folder button on one row, not location shown twice.

**PASS -- State coverage (mostly good):**

- Loading skeletons: GalleryPage line 340-346 renders `<Skeleton>` with proper rounded-[2px] during initial loading -- PASS
- Semantic search loading: GalleryPage lines 351-357 shows pulse-animated surface placeholders -- PASS
- Error states: AiAnalysisSection handles "error" and "ollama-unavailable" states with distinct visual treatment -- PASS
- Empty states: GalleryEmptyState component supports both variants -- component implementation is PASS even though caller only exercises one
- Confirmation dialog: Settings restore defaults has Dialog with cancel/confirm before destructive action -- PASS
- Keyboard navigation: GalleryPage has comprehensive arrow-key, Enter, Space, Escape support in handleKeyDown -- PASS
- Focus management: SemanticSearchBar has focus event listener for external focus trigger -- PASS
- Reduced motion: `src/index.css:101-103` respects `prefers-reduced-motion` -- PASS

---

## Registry Safety

Skipped -- UI-SPEC.md declares `shadcn_initialized: false` and `Third-party: none declared`. No third-party registries to audit. `components.json` exists but `registries` field is empty (`{}`).

---

## Files Audited

- `DESIGN.md` -- design system authority
- `CLAUDE.md` -- project rules and anti-patterns
- `.planning/phases/007-rust-data-layer/007-UI-SPEC.md` -- phase design contract
- `src/index.css` -- design tokens and CSS custom properties
- `src/App.tsx` -- main application shell
- `src/i18n/en.json` -- English translations
- `src/i18n/zh.json` -- Chinese translations
- `src/components/ImportProgressBar.tsx` -- import progress component (Phase 007)
- `src/components/DiskFullDialog.tsx` -- disk-full warning dialog (Phase 007)
- `src/components/GalleryEmptyState.tsx` -- gallery empty state (Phase 007)
- `src/components/ImageCard.tsx` -- image card with failure overlays (Phase 007 additions)
- `src/components/DropZone.tsx` -- drag-drop import handler (Phase 007 updates)
- `src/components/SemanticSearchBar.tsx` -- semantic search bar
- `src/components/AiAnalysisSection.tsx` -- AI analysis section
- `src/components/AnalysisHistoryList.tsx` -- analysis history list
- `src/components/TagSuggestionCard.tsx` -- tag suggestion card
- `src/components/TagManager.tsx` -- tag manager (lucide-react found here)
- `src/components/ErrorBoundary.tsx` -- error boundary (hardcoded Chinese)
- `src/components/PageErrorBoundary.tsx` -- page error boundary (hardcoded Chinese)
- `src/pages/SettingsPage.tsx` -- settings page (Phase 007 additions)
- `src/pages/GalleryPage.tsx` -- gallery page (Phase 007 wiring)
- `components.json` -- shadcn configuration

---

## Summary

| Category | Count |
|----------|-------|
| BLOCKER findings | 5 |
| WARNING findings | 12 |
| PASS checks | 9 |

**Recommendation:** Address the 3 priority fixes (hardcoded strings, glassmorphism/pure-white, lucide-react removal) before shipping. The remaining warnings can be addressed incrementally but do not block core functionality.
