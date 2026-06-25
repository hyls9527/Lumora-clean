# CLAUDE.md — Lumora

Vite + React 19 + TypeScript + Tailwind CSS v4 前端应用。

## 三层设计架构（必须遵循）

| 层    | 文件                         | 作用                     |
| ---- | -------------------------- | ---------------------- |
| 组件基座 | `src/components/ui/*`      | shadcn/ui 风格组件         |
| 设计身份 | `DESIGN.md`                | 色彩/字体/间距/反模式，每次写 UI 前读 |
| 设计过程 | Skill: `lumora-ui-process` | 强制结构化流程，防止 AI 默认审美     |

## Commands

| Task       | Command                                    | Location      |
| ---------- | ------------------------------------------ | ------------- |
| Dev        | `npm run dev`                              | Lumora-clean/ |
| Build      | `node node_modules/vite/bin/vite.js build` | Lumora-clean/ |
| Type check | `npx tsc --noEmit`                         | Lumora-clean/ |

## Rules

- **读 DESIGN.md** — 写 UI 前必须读
- **无图标** — 导航和操作用纯文字，不用 lucide-react 图标
- **DM Sans 字体** — 不用 Inter
- **暖白色系** — 不用纯黑/纯白
- **金色强调** — 不用紫色
- **方章按钮** — 所有按钮 4px 圆角
- **纸页卡片** — 所有卡片 2px 圆角
- **200ms 过渡** — 所有交互元素
- **评分用梅花印** — 不用星星
- **收藏用藏书印 ◆** — 不用红心

## Design Language: 古卷·灯火

- 高级、克制、安静、宏大、神圣、怀旧、诗意、传说感
- 色彩：象牙纸页 #f2ede4 + 研磨墨 #2a2118 + 古铜包浆 #7a5c12
- 字体：Noto Serif SC（标题）+ DM Sans（正文）
- 阴影：暖棕调 rgba(78,50,23,...)
- 评分：梅花印 SVG 18x18
- 收藏：藏书印 ◆

## Accessibility

- 所有图片必须有描述性 alt 文本
- 按钮必须有 accessible name（文字或 aria-label）
- 使用 semantic HTML（nav, main, aside, h1-h6）
- 支持键盘导航
- 颜色对比度符合 WCAG AA

## Anti-Patterns (禁止)

- ❌ lucide-react 图标
- ❌ Inter 字体
- ❌ pill 按钮 (9999px)
- ❌ 纯黑 #000 / 纯白 #fff
- ❌ 紫色渐变
- ❌ 毛玻璃 glassmorphism
- ❌ 100ms 过渡
- ❌ 星星评分
- ❌ 红心收藏
