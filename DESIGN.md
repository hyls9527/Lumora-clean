# DESIGN.md — 古卷·灯火

## Design Direction

高级、克制、安静、宏大、神圣、怀旧、诗意、传说感。

## Color Palette

```css
/* 象牙纸页 */
--color-bg: #f2ede4;
--color-bg-alt: #ebe5d8;

/* 卡片/面板 */
--color-surface: #f7f2ea;
--color-surface-hover: #f0ebe0;

/* 边框 — whisper weight */
--color-border: rgba(139, 115, 75, 0.10);
--color-border-subtle: rgba(139, 115, 75, 0.05);

/* 文字 — 研磨过的墨 */
--color-text: #2a2118;
--color-text-secondary: #6b5d48;
--color-text-muted: #a09480;
--color-text-faint: #c4b89e;

/* 强调 — 古铜包浆 */
--color-accent: #7a5c12;
--color-accent-hover: #8b6914;
--color-accent-subtle: rgba(139, 105, 20, 0.06);

/* 语义色 */
--color-danger: #8b3030;
--color-success: #4a7a3a;
```

## Shadows

```css
--shadow-card: rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px;
--shadow-card-hover: rgba(139,115,75,0.14) 0px 0px 0px 1px, rgba(78,50,23,0.08) 0px 4px 16px, rgba(78,50,23,0.04) 0px 1px 4px;
--shadow-elevated: rgba(139,115,75,0.12) 0px 0px 0px 1px, rgba(78,50,23,0.12) 0px 8px 32px, rgba(78,50,23,0.06) 0px 2px 8px;
```

## Typography

| 元素 | 字体 | 大小 | 权重 |
|------|------|------|------|
| Display | Noto Serif SC | 32px | 300 |
| H1 | Noto Serif SC | 24px | 600 |
| H2 | Noto Serif SC | 18px | 600 |
| Card title | DM Sans | 14px | 600 |
| Body | DM Sans | 14px | 400 |
| Small | DM Sans | 12px | 400 |
| Label | DM Sans | 10px | 500 |
| Mono | JetBrains Mono | 11px | 400 |

## Spacing Scale

4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 px

## Border Radius (Material Logic)

| 元素 | 现实对应 | 圆角 |
|------|----------|------|
| 卡片 | 纸页 | 2px |
| 按钮 | 方章 | 4px |
| 输入框 | 砚台 | 4px |
| 标签 | 批注标签 | 4px |
| 弹窗 | 卷轴 | 6px |

## Transitions

- 默认：200ms ease-out
- 不用 bounce/elastic/spring
- 不用 100ms（太快）
- 图片不做 scale 缩放（太活泼）

## Components

### 侧边栏 — 书脊
- 宽度：200px
- 导航：dot + 纯文字
- Active：gold left bar + 加粗
- 统计：dotted separator

### 图片卡片 — 书页
- 圆角：2px
- 阴影：shadow-card → shadow-card-hover
- 评分：梅花印 SVG 18x18
- 收藏：藏书印 ◆

### 排序按钮 — 下划线
- Active：border-b-2 + accent color
- 不用 pill/按钮样式

### 仪表盘 — 藏书目录
- 目录式：标签左 + 数值右 + dotted 连接
- 不用 SaaS 风格 stat cards

## Anti-Patterns (禁止)

- ❌ Inter 字体
- ❌ 纯黑/纯白
- ❌ 星星评分
- ❌ 红心收藏
- ❌ pill 按钮 (9999px)
- ❌ 100ms 过渡
- ❌ 图片 hover scale
- ❌ 紫色渐变
- ❌ 毛玻璃
- ❌ lucide-react 图标
