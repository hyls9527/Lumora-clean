---
phase: 007
slug: rust-data-layer
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-22
---

# Phase 007 — UI Design Contract

> Visual and interaction contract for NEW UI elements introduced by the Rust Data Layer. This is primarily a backend phase; existing pages are not redesigned. Only additive elements are specified.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (custom Radix UI components, shadcn-style) |
| Preset | not applicable — DESIGN.md is the sole design authority |
| Component library | @radix-ui/react-dialog (dialog, sheet, dropdown-menu, scroll-area, tabs) |
| Icon library | none — pure text and custom SVG (plum-flower) per DESIGN.md anti-patterns |
| Font | DM Sans (body/UI) + Noto Serif SC (headings) + JetBrains Mono (mono) |

---

## Spacing Scale

Inherited from DESIGN.md — no additions.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none

---

## Typography

Reuses DESIGN.md scale. New elements mapped to existing roles:

| Role | Size | Weight | Line Height | Font | Usage in Phase 007 |
|------|------|--------|-------------|------|---------------------|
| Body | 14px | 400 | 1.5 | DM Sans | Dialog body, settings descriptions, progress labels |
| Label | 12px | 400 | 1.4 | DM Sans | Settings section labels, status marker text |
| Small | 12px | 400 | 1.4 | DM Sans | Progress "n/total" counters, duplicate skip notice |
| Caption | 10px | 500 | 1.3 | DM Sans | Card status overlays, range validation hints |
| Heading H2 | 18px | 600 | 1.2 | Noto Serif SC | Empty state heading, dialog titles |
| Heading H3 | 16px | 600 | 1.2 | Noto Serif SC | Settings section headings (existing pattern) |
| Card Title | 14px | 600 | 1.4 | DM Sans | Existing — unchanged |
| Mono | 11px | 400 | 1.4 | JetBrains Mono | File size values, numeric inputs, "X MB" displays |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #f2ede4 (--color-bg) | Page background, empty state background |
| Secondary (30%) | #f7f2ea (--color-surface) | Cards, dialog surfaces, settings sections, progress bar track |
| Accent (10%) | #7a5c12 (--color-accent) | Progress bar fill, CTA buttons, range slider thumb, focused rings |
| Destructive | #8b3030 (--color-danger) | Delete confirmation text, error status markers, danger button backgrounds |
| Success | #4a7a3a (--color-success) | Success toast text, file-found status |

Accent reserved for: primary CTA buttons ("导入图片", "开始导入"), progress bar fill, range input slider thumb, active tab underline, focused input rings, selected grid toggle states. Never used for decorative elements, hover effects on non-interactive elements, or text color.

---

## Copywriting Contract

### Primary CTA
| Element | Copy (zh) | Copy (en) |
|---------|-----------|-----------|
| Empty state import | 导入第一张图片 | Import First Image |
| Settings — restore defaults | 恢复默认设置 | Restore Defaults |
| Disk-full dialog — keep partial | 保留已导入 | Keep Imported |
| Disk-full dialog — rollback | 全部回滚 | Rollback All |
| File missing — reposition | 重新定位… | Relocate… |
| Thumbnail failed — retry | 重新生成 | Regenerate |

### Empty State (First-Run / No Database)
| Element | Copy (zh) | Copy (en) |
|---------|-----------|-----------|
| Heading | 你的书阁还是空的 | Your Library is Empty |
| Body | 导入你的第一张图像，开始构建属于你的古卷 | Import your first image to begin building your scroll |
| CTA | 导入图片 | Import Images |

### Empty State (Gallery — All Deleted)
| Element | Copy (zh) | Copy (en) |
|---------|-----------|-----------|
| Heading | 暂无图片 | No Images |
| Body | 回收站中没有可恢复的图片。导入新图片或从回收站恢复。 | No images to restore. Import new images or recover from trash. |

### Import Progress
| Element | Copy (zh) | Copy (en) |
|---------|-----------|-----------|
| Progress label | 正在处理 {current}/{total} | Processing {current}/{total} |
| Completion toast | 成功导入 {count} 张图片 | Imported {count} images |
| Duplicate skip notice | 已跳过 {count} 张重复图片 | Skipped {count} duplicate images |
| Non-image skip notice | 已跳过 {count} 个非图片文件 | Skipped {count} non-image files |

### Error States
| Element | Copy (zh) | Copy (en) |
|---------|-----------|-----------|
| Thumbnail failure badge | 缩略图失败 | Thumbnail Failed |
| File missing badge | 文件缺失 | File Missing |
| Disk full dialog — heading | 磁盘空间不足 | Disk Space Full |
| Disk full dialog — body | 存储空间不足以完成导入。已成功导入 {kept} 张图片，{remaining} 张待导入。是否保留已导入的图片？ | Not enough disk space to complete import. {kept} images imported successfully, {remaining} remaining. Keep imported images? |
| Range validation — below min | 最小值为 1 MB | Minimum is 1 MB |
| Range validation — above max | 最大值为 500 MB | Maximum is 500 MB |

### Destructive Actions
| Action | Confirmation (zh) | Confirmation (en) | Approach |
|--------|-------------------|-------------------|----------|
| 恢复默认设置 | 这将重置所有设置为默认值。你的图片和标签不会受影响。 | This will reset all settings to defaults. Your images and tags will not be affected. | Dialog with Cancel + Confirm buttons |
| 卸载 — 删除数据 | 此操作不可撤销。所有图片、缩略图和标签将被永久删除。 | This cannot be undone. All images, thumbnails, and tags will be permanently deleted. | Dialog with "保留数据" (Keep Data) + "全部删除" (Delete All) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none — project uses custom components | not applicable |
| Third-party | none declared | not applicable |

---

## Phase 007 — New UI Elements Specification

### 1. Import Progress Bar (D-05)

**Where:** GalleryPage toolbar area, replacing BatchEmbeddingBar position when import is active.
**When visible:** During batch folder import only (not single-file drag-drop).

```
┌──────────────────────────────────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  正在处理 12/50       取消      │
└──────────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Container | `flex items-center gap-3 px-4 py-2 bg-surface border-b border-border-subtle` |
| Bar height | `h-1.5` (6px) |
| Bar track | `flex-1 rounded-[2px] bg-accent/20 overflow-hidden` |
| Bar fill | `h-full rounded-[2px] bg-accent transition-all duration-200 ease-out` |
| Progress text | `font-sans text-[12px] text-text-muted tabular-nums whitespace-nowrap` |
| Cancel button | `text-[12px] text-text-muted hover:text-text-secondary transition-all duration-200 ease-out font-sans whitespace-nowrap` |
| Cancel copy | `取消` / `Cancel` |

**Pattern established by:** `BatchEmbeddingBar.tsx` (Phase 004) — reuse identical visual treatment, only change the data source (import progress vs embedding progress).

### 2. Settings — File Size Limit (D-09, D-21)

**Where:** SettingsPage > General tab, new `SettingsSection` card below existing Storage section.

```
┌──────────────────────────────────────────────┐
│  文件大小上限                                    │
│  导入时跳过大于此值的图片                            │
│                                              │
│  ┌─────────┐                                 │
│  │   200    │  MB                             │
│  └─────────┘                                 │
│  1 – 500 MB                                  │
└──────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Section card | Reuse `SettingsSection` component (Card, p-5, rounded-[2px], shadow-card) |
| Section title | `text-[13px] font-semibold tracking-[-0.01em]` |
| Section description | `text-[12px] text-text-muted mt-0.5` |
| Number input | Reuse `Input` component with `type="number"`, `min={1}`, `max={500}`, width `w-20` |
| Input suffix label | `text-[12px] text-text-muted ml-2` reading "MB" |
| Range hint | `text-[10px] text-text-faint mt-1` reading "1 – 500 MB" |
| Default value | `200` (MB) per Claude's discretion in CONTEXT.md |
| Validation | On blur: clamp to [1, 500], show red hint `text-[10px] text-danger` if out of range |
| Unit conversion | Store in MB, display in MB. No GB conversion needed (500 MB max is clear in MB). |

### 3. Settings — Restore Defaults Button (D-20)

**Where:** SettingsPage > General tab, at bottom of content area, separated by margin.

```
┌──────────────────────────────────────────────┐
│                                              │
│          [ 恢复默认设置 ]                       │
│                                              │
└──────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Button variant | `outline` — `border border-border bg-surface hover:bg-surface-hover text-text-secondary` |
| Button size | `h-9 px-3` (Button sm) |
| Text | `text-[12px] font-medium font-sans` |
| Placement | Centered below all settings sections, `mt-8 mb-4` |
| Confirmation | Dialog (see Destructive Actions in Copywriting) — NOT a silent action |
| Dialog width | `max-w-[380px]` |
| Confirm button | `destructive` variant — `bg-danger text-surface hover:bg-danger/90` |
| Cancel button | `ghost` variant — `hover:bg-surface-hover text-text-secondary` |

### 4. Settings — Open Data Folder Button (Claude's discretion)

**Where:** SettingsPage > General tab, inside Storage section card.

```
┌──────────────────────────────────────────────┐
│  存储                                         │
│  数据库：lumora.db                             │
│  大小：24.5 MB                                │
│  位置：D:\Lumora\data                         │
│                                   [打开文件夹] │
└──────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| Button variant | `link` — `text-accent underline-offset-4 hover:underline` |
| Text | `text-[11px] font-sans` |
| Copy | `打开文件夹` / `Open Folder` |
| Placement | Right-aligned within Storage SettingsSection, adjacent to the location row |
| Action | Opens the data folder in system file explorer (Tauri command) |

### 5. Gallery — Thumbnail Failure Marker (D-03)

**Where:** ImageCard overlay, top-left corner, above the selection checkbox.

```
┌──────────────────┐
│ ⚠ 缩略图失败      │  ← semi-transparent overlay
│ [重新生成]        │
│                  │
│   (no thumbnail)  │
│                  │
│                  │
└──────────────────┘
```

| Property | Value |
|----------|-------|
| Overlay | Absolute positioned, inset-0, `bg-text/15` with center content |
| Icon | `⚠` character (text, no icon library) at `text-[20px] text-warning` |
| Warning color | `#b8860b` (dark goldenrod) — defined as `--color-warning` token if not already present, or use `text-accent/80` |
| Label | `font-sans text-[10px] font-medium text-text-secondary mt-1` reading "缩略图失败" / "Thumbnail Failed" |
| Retry button | `font-sans text-[10px] text-accent hover:underline mt-1 cursor-pointer` reading "重新生成" / "Regenerate" |
| Click action | Triggers single-image thumbnail regeneration (Tauri command) |
| Interaction with hover overlay | Failure overlay REPLACES the standard hover overlay — the card's hover state is suppressed entirely. Only the failure state is shown. |

### 6. Gallery — File Missing Marker (D-16)

**Where:** ImageCard overlay. Takes precedence over thumbnail failure marker (a missing file also has no thumbnail, but the corrective action is different).

```
┌──────────────────┐
│ ⚠ 文件缺失        │
│ [重新定位…]       │
│                  │
│   (placeholder)   │
│                  │
│                  │
└──────────────────┘
```

| Property | Value |
|----------|-------|
| Overlay | Same as thumbnail failure — `bg-text/15`, centered content |
| Icon | `⚠` character at `text-[20px] text-danger` |
| Label | `font-sans text-[10px] font-medium text-danger mt-1` reading "文件缺失" / "File Missing" |
| Action button | `font-sans text-[10px] text-accent hover:underline mt-1 cursor-pointer` reading "重新定位…" / "Relocate…" |
| Click action | Opens native file picker to locate the missing file at its last known path |
| Precedence | File missing > thumbnail failure. If both conditions are true, show ONLY the file missing marker. |
| Note | Cards with this marker have their rating/favorite/selection interactions disabled — the image is not viewable. |

### 7. Disk Full Warning Dialog (D-13)

**Where:** Overlay dialog, triggered during batch import when disk space is insufficient.

| Property | Value |
|----------|-------|
| Dialog component | Reuse `Dialog` + `DialogContent` from `ui/dialog.tsx` |
| Dialog width | `max-w-[400px]` |
| Styling | `rounded-[6px] bg-surface shadow-elevated border border-border p-6` |
| Title | `font-serif text-[16px] font-semibold text-text` — "磁盘空间不足" / "Disk Space Full" |
| Body | `font-sans text-[14px] text-text-secondary leading-relaxed` |
| Button — Keep | `destructive` variant — `bg-danger text-surface hover:bg-danger/90` — "保留已导入" / "Keep Imported" |
| Button — Rollback | `outline` variant — `border border-border bg-surface hover:bg-surface-hover` — "全部回滚" / "Rollback All" |
| Footer | `DialogFooter` with `justify-end gap-2 pt-4 border-t border-border-subtle` |

### 8. Duplicate / Non-Image Skip Notice (D-11, D-15)

**Where:** Toast notification after import completes.

| Property | Value |
|----------|-------|
| Toast type | `warning` (from existing toast-store.ts) |
| Duplicate copy | "已跳过 {count} 张重复图片" / "Skipped {count} duplicate images" |
| Non-image copy | "已跳过 {count} 个非图片文件" / "Skipped {count} non-image files" |
| Dismissal | Auto-dismiss after 5 seconds (vs 3 seconds for normal toasts — user needs more time to read skip counts) |
| Multiple notices | If both duplicates AND non-images were skipped, show a SINGLE combined toast: "已跳过 {dup} 张重复图片和 {non} 个非图片文件" |

### 9. Range Input Styling (for file size slider, if slider is used)

If a range slider is chosen over a number input for file size limit, use the pattern established in ExportDialog.tsx:

| Property | Value |
|----------|-------|
| Track | `w-full h-1.5 rounded-[2px] bg-bg-alt cursor-pointer` |
| Thumb | `w-3.5 h-3.5 rounded-full bg-accent border-2 border-surface shadow-[0_1px_3px_rgba(78,50,23,0.15)]` |
| Value display | `font-mono text-[11px] text-text-muted tabular-nums` |

Based on D-21 requiring range validation "1-500MB", a number input with explicit min/max is preferred over a slider (precision at 500-item range). The number input (Element 2 above) is the primary specification. This slider spec is provided only as a fallback if the planner chooses a slider approach.

---

## Interaction Contracts

### Transition Duration
All interactive elements: **200ms ease-out** per DESIGN.md. No exceptions.

### Validation Feedback
- Range validation (file size): on blur, not on keystroke. Prevents mid-typing false errors.
- Zero-second delay for displaying the validation hint after blur.

### Dialog Behavior
- All dialogs close on Escape key (existing Radix DialogPrimitive behavior).
- All dialogs close on overlay click (existing Radix DialogPrimitive behavior).
- Destructive dialog confirm buttons use `danger` variant styling, not `accent`.

### Progress Bar Animation
- Bar fill uses CSS `transition: width 200ms ease-out` — smooth step transitions between percentage updates.
- No pulse/shimmer animation on the bar itself — the moving fill is sufficient feedback.

### Status Markers on Image Cards
- File-missing and thumbnail-failure markers suppress the standard hover overlay.
- Marked cards have reduced interactions: no rating, no favorite, no selection checkbox.
- Detail panel can still open (to show metadata), but the image display area shows the appropriate error state.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
