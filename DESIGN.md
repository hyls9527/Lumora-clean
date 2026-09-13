# DESIGN.md — 古卷·灯火 · 灯箱

> **核心规范**：Lumora 只为 AI 生图创作者而做，打破常规——不是更好看的图库，
> 是另一种图库。详见 `docs/CORE-PRINCIPLE.md`。

## Design Direction

高级、克制、安静、宏大、神圣、怀旧、诗意、传说感。

**灯箱隐喻（v3）**：界面像展墙一样消失，图片是唯一主角。
- 默认极简：卡片只有图；模型/评分/操作在 hover / 键盘聚焦时浮现
- 元数据进「边注」：详情灯箱里侧栏是边注，不是 SaaS 面板
- 灯只在确认时亮：收藏 / 评分 / 启动；平时全灭
- 动效三套且仅此三套：启动灯火初燃、确认灯影、灯箱升起
- 纸只在承字处；图片区无框展台

## Color Palette

### 古卷·灯火（亮色）

```css
/* 象牙纸页 */
--color-bg: #f4f0e8;
--color-bg-alt: #ebe4d6;

/* 卡片/面板 — 承托纸 */
--color-surface: #faf7f1;
--color-surface-hover: #f3eee4;

/* 边框 — whisper weight */
--color-border: rgba(122, 92, 40, 0.14);
--color-border-subtle: rgba(122, 92, 40, 0.07);

/* 文字 — 研磨过的墨 */
--color-text: #241c12;
--color-text-secondary: #5c5040;
--color-text-muted: #8a7c66;
--color-text-faint: #b5a88e;

/* 强调 — 古铜包浆 */
--color-accent: #7a5a10;
--color-accent-hover: #8f6c18;
--color-accent-subtle: rgba(122, 90, 16, 0.08);

/* 语义色 */
--color-danger: #8b3030;
--color-success: #3f6e32;
```

### 暗夜（暗色）

```css
--color-bg: #181410;
--color-bg-alt: #1e1a15;
--color-surface: #252019;
--color-surface-hover: #2d271f;
--color-border: rgba(210, 190, 150, 0.12);
--color-border-subtle: rgba(210, 190, 150, 0.06);
--color-text: #ebe4d4;
--color-text-secondary: #b3a48a;
--color-text-muted: #7a6a52;
--color-text-faint: #524a3c;
--color-accent: #c9a038;
--color-accent-hover: #d8b048;
--color-accent-subtle: rgba(201, 160, 56, 0.12);
--color-danger: #c85050;
--color-success: #6a9a50;
```

## Shadows

```css
--shadow-card: 0 0 0 1px rgba(122, 92, 40, 0.10), 0 1px 2px rgba(60, 40, 16, 0.04);
--shadow-card-hover: 0 0 0 1px rgba(122, 92, 40, 0.16), 0 6px 20px rgba(60, 40, 16, 0.08);
--shadow-elevated: 0 0 0 1px rgba(122, 92, 40, 0.14), 0 12px 40px rgba(40, 28, 12, 0.14);
--shadow-print: 0 1px 2px rgba(60, 40, 16, 0.06), 0 4px 14px rgba(60, 40, 16, 0.05);
--shadow-print-hover: 0 2px 4px rgba(60, 40, 16, 0.08), 0 10px 28px rgba(60, 40, 16, 0.10);
```

## Typography

| 元素 | 字体 | 大小 | 权重 | 字距 |
|------|------|------|------|------|
| Display | Noto Serif SC | 36px | 600 | -0.02em |
| H1 | Noto Serif SC | 20px | 600 | 0 |
| H2 | Noto Serif SC | 16px | 600 | 0.01em |
| Body | DM Sans | 13px | 400 | 0 |
| Small | DM Sans | 12px | 400 | 0 |
| Label | DM Sans | 10px | 500 | 0.06em uppercase |
| Mono | JetBrains Mono | 11px | 400 | 0 |

## Spacing Scale

4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 72 px

## Border Radius

| 元素 | 现实对应 | 圆角 |
|------|----------|------|
| 印样 / 卡片 | 照片纸边 | 2px |
| 按钮 | 方章 | 4px |
| 输入框 | 砚台 | 4px |
| 标签 | 批注 | 3px |
| 弹窗 | 卷轴/灯箱 | 6px |

## Transitions & Motion — 仅三套

| 场景 | 时长 | 曲线 |
|------|------|------|
| 颜色/边框 | 160ms | ease-out |
| 确认灯影（收藏/评分） | 480ms | ease-out |
| 灯箱升起 / 弹窗 | 280ms | cubic-bezier(0.2, 0.7, 0.25, 1) |
| 启动 | 700–1100ms 阶梯 | 同上 |
| 页面切换 | 200ms 淡入 | ease-out |

### 禁止
- ❌ 卡片错落入场（列表每次重播）
- ❌ 工具条下沉表演
- ❌ hover 时图片 scale
- ❌ bounce / spring / 弹性
- ❌ 100ms
- ❌ 到处泛光

### 原则
- `prefers-reduced-motion` 全关非必要动画
- 图片是主体；动效只做**启动、确认、灯箱进出**

## Components

### 侧边栏 — 书脊
- 208px；字标 + 书签线；无图标库
- Active：左侧 2px 古铜竖线 + 微亮
- 分组 dotted；底部搜索 ⌘K、Ollama 点

### 图库印样 — Lightbox Plate（默认极简）
- **默认：只有图**，2px 圆角，轻 shadow-print，无正文区
- 收藏已标：左上角小 ◆（墨色，非金色）
- 评分 > 0：右上角梅花小印（静止墨色）
- **Hover / focus-visible**：底部半透明墨条浮现——模型名 + ◆ + 评分 + ✕
- Prompt / 标签不进网格；只在灯箱边注
- 键盘聚焦与 hover 同等

### 灯箱 — Detail
- 遮罩暖墨；大图居中；右侧 280px「边注」
- 边注：模型、尺寸、评分、prompt、标签、参数（等宽）
- 进场 paperRise；关闭 fade

### 仪表盘 — 藏书目录
- 标签左 + dotted + 数值右；无 SaaS stat cards

### 弹窗 — 卷轴
- surface + elevated；6px 圆角

### 输入 — 砚台
- 4px；focus accent 描边 + 微圈

## Anti-Patterns (禁止)

- ❌ Inter / 纯黑纯白 / 星星 / 红心 / pill / 毛玻璃 / lucide
- ❌ emoji 导航
- ❌ 卡片常驻正文（模型+prompt+标签堆叠）
- ❌ 错落入场、到处光晕
- ❌ 紫色渐变
