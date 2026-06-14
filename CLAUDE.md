# CLAUDE.md — Lumora

Tauri 2 + React 19 + Rust 桌面图片管理器。

## 三层设计架构（必须遵循）

| 层 | 文件 | 作用 |
|---|------|------|
| 组件基座 | `src/components/ui/*` (shadcn/ui) | 用 shadcn 组件，不自己写 |
| 设计身份 | `DESIGN.md` | 色彩/字体/间距/反模式，每次写 UI 前读 |
| 设计过程 | Skill: `lumora-ui-process` | 强制结构化流程，防止 AI 默认审美 |

## Commands

| Task | Command | Location |
|------|---------|----------|
| Dev | `npm run dev` | `Lumora/` |
| Build | `node node_modules/vite/bin/vite.js build` | `Lumora/` |
| Type check | `npx tsc --noEmit` | `Lumora/` |
| Add component | `npx shadcn@latest add <name>` | `Lumora/` |

## Rules

- **读 DESIGN.md** — 写 UI 前必须读
- **用 shadcn/ui** — 不自己写按钮/卡片/对话框
- **DM Sans 字体** — 不用 Inter
- **暖白色系** — 不用纯黑/纯白
- **金色强调** — 不用紫色
- **pill 按钮** — 所有按钮 9999px 圆角
- **10px 卡片圆角** — 所有卡片
- **150ms 过渡** — 所有交互元素
