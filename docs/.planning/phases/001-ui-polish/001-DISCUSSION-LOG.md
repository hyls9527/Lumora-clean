# Phase 001: UI Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 001-ui-polish
**Areas discussed:** 设计规范权威源, 反模式清理, 组件对齐方式, 迁移残留

---

## 设计规范权威源

| Option | Description | Selected |
|--------|-------------|----------|
| 200ms | 与 DESIGN.md 和 CLAUDE.md 一致——古卷·灯火的克制节奏 | ✓ |
| 150ms | 折中——比 100ms 沉稳，比 200ms 轻快 | |
| 保持 100ms | 保留旧 CONTEXT.md 的决定 | |

**User's choice:** 200ms（推荐）— DESIGN.md 为权威规范源
**Notes:** DESIGN.md 明确写「不用 100ms（太快）」

| Option | Description | Selected |
|--------|-------------|----------|
| 200px | 与 DESIGN.md「书脊」概念一致——窄而克制 | ✓ |
| 220px | 折中 | |
| 保持 240px | 保留旧 CONTEXT.md 的决定 | |

**User's choice:** 200px（推荐）

| Option | Description | Selected |
|--------|-------------|----------|
| DESIGN.md 3 层 | shadow-card、shadow-card-hover、shadow-elevated | ✓ |
| 扩展为 4 层 | 在 3 层基础上加一层 | |
| 重定义全部 | 不沿用现有 3 层 | |

**User's choice:** DESIGN.md 3 层（推荐）
**Notes:** 旧 CONTEXT.md 引用的 warm-white-design-system.md 和 lumora-development skill 均不存在

---

## 反模式清理

| Option | Description | Selected |
|--------|-------------|----------|
| 纯文字标签 | 完全符合 DESIGN.md 禁令。X→关闭、Copy→复制路径 等 | ✓ |
| Unicode 符号 + 文字 | 跨平台渲染不一致 | |
| 自定义 SVG 图标 | 更精致但更费时 | |

**User's choice:** 纯文字标签（推荐）
**Notes:** DetailPanel.tsx 中 5 个 lucide-react 图标（X, Copy, Trash2, Tag, Maximize2）全部替换

| Option | Description | Selected |
|--------|-------------|----------|
| 仅阴影加深 | hover 时 shadow-card → shadow-card-hover，不做变形 | ✓ |
| 阴影 + 边框亮起 | accent 色边框出现 | |
| 无 hover 效果 | 完全静态 | |

**User's choice:** 仅阴影加深（推荐）
**Notes:** 移除 ImageCard.tsx 中的 `hover:scale-[1.02]`

| Option | Description | Selected |
|--------|-------------|----------|
| 提取为共享组件 | 创建 `@/components/ui/plum-flower.tsx` | ✓ |
| 保留各副本 | 两处可能有不同的呈现需求 | |

**User's choice:** 提取为共享组件（推荐）
**Notes:** DetailPanel.tsx 和 ImageCard.tsx 中独立的 PlumFlower 实现有差异

---

## 组件对齐方式

| Option | Description | Selected |
|--------|-------------|----------|
| 视觉一致性 | 检查设计 token 使用是否正确，修复明显偏差 | ✓ |
| 像素精确审计 | 逐组件逐像素对比 DESIGN.md | |
| 仅修复反模式 | 只清理明确违反禁令的项目 | |

**User's choice:** 视觉一致性（推荐）

| Option | Description | Selected |
|--------|-------------|----------|
| 全量审计 | 11 UI 基座 + 10 业务组件 + 5 页面 | ✓ |
| 业务组件优先 | 只审计业务组件和页面 | |
| 用户可见优先 | 只审计高频可见区域 | |

**User's choice:** 全量审计（推荐）

| Option | Description | Selected |
|--------|-------------|----------|
| 保持 + 微调 | shadcn/ui 基座基本正确，只修复不符合 DESIGN.md 的偏差 | ✓ |
| 不改 UI 基座 | 只改业务组件和页面 | |
| 重做 UI 基座 | 完全按 DESIGN.md 重写 | |

**User's choice:** 保持 + 微调（推荐）

| Option | Description | Selected |
|--------|-------------|----------|
| 就近修正 | 看到明显偏离尺度时修正到最近的标准值 | ✓ |
| 严格对齐 | 全部替换为非标准间距 | |
| 不改间距 | 只修复颜色/字体/圆角/阴影 | |

**User's choice:** 就近修正（推荐）

---

## 迁移残留

| Option | Description | Selected |
|--------|-------------|----------|
| 全部清除 | 删除所有 isTauri() 调用和 Tauri-only 代码路径 | ✓ |
| 定义 isTauri() 返回 false | 保留代码路径但不删除 | |
| 留给 Phase 002 | 迁移残留不属于 UI 打磨范畴 | |

**User's choice:** 全部清除（推荐）
**Notes:** app-store.ts 中 6 处 isTauri() 调用从未定义，会抛 ReferenceError

| Option | Description | Selected |
|--------|-------------|----------|
| 全清 | 删无用依赖、假进度条、占位页面、假标签 | ✓ |
| 只清死代码 | 占位页面和假数据保留 | |
| 留到 Phase 002 | 代码清理留给 Feature Completion | |

**User's choice:** 全清（推荐）
**Notes:** react-router-dom 未使用、DropZone 模拟进度条、TrashPage 空占位、settings-store 假标签全部清理

---

## Claude's Discretion

None — all areas discussed and decided by user.

## Deferred Ideas

None — discussion stayed within phase scope.
