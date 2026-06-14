# DESIGN.md — Lumora Visual Identity

> 古卷·灯火 — AI 创作者的图片管理器
>
> 这个文件定义了 Lumora 的视觉身份。每次写 UI 代码前必须读这个文件。

## 设计哲学：古卷·灯火

灵感来自深夜书房：象牙色旧纸、研磨墨迹、铜器包浆。界面应像一盏暖灯下的古卷——不刺眼、不喧哗，让图片成为唯一的主角。

**核心原则：**
- 纸页象牙底，墨迹暖棕字，包浆金色点缀
- 阴影用暖棕，不用冷灰
- 过渡从容（200ms），不急促
- 圆角克制（卡片 6px），不圆滑

## 设计场景

**谁在用，在哪里，什么心情：**

AI 创作者坐在电脑前，面前是 1 万张生成的图片。他需要快速扫描、挑选最好的、丢弃废片。他会长时间盯着屏幕（2-4 小时），所以 UI 必须不累眼。图片是唯一的主角，UI 是隐形的工具。

**结论：** 象牙纸页底色（不刺眼），低密度界面（让图片呼吸），克制的强调色（不抢戏）。

## 色彩系统

### 绝对禁止

- ❌ 纯黑 `#000000` — 用 `#2a2118` 代替
- ❌ 纯白 `#ffffff` — 用 `#f7f2ea` 代替
- ❌ 紫色渐变 — AI 默认审美，禁止
- ❌ 蓝色链接色 — 用强调色代替
- ❌ 彩虹色 — 单色系统
- ❌ 冷灰阴影 — 用暖棕 `rgba(78,50,23,...)`

### 调色板

```css
--color-bg: #f2ede4;                      /* 页面底色：象牙纸页 */
--color-bg-alt: #ebe5d8;                  /* 替代底色 */
--color-surface: #f7f2ea;                 /* 卡片/面板：高光纸页 */
--color-surface-hover: #f0ebe0;           /* 悬停态 */
--color-surface-elevated: #f7f2ea;        /* 浮层 */
--color-border: rgba(139,115,75,0.10);    /* 边框：淡铜 */
--color-border-subtle: rgba(139,115,75,0.05);
--color-text: #2a2118;                    /* 主文字：研磨墨 */
--color-text-secondary: #6b5d48;          /* 次文字：旧墨 */
--color-text-muted: #a09480;              /* 弱文字 */
--color-text-faint: #c4b89e;              /* 极弱文字 */
--color-accent: #8b6914;                  /* 强调色：古铜包浆 */
--color-accent-hover: #a07818;            /* 强调色悬停 */
--color-accent-subtle: rgba(139,105,20,0.06);
--color-accent-muted: #c4a04a;            /* 弱强调 */
--color-danger: #8b3030;                  /* 危险：暗红 */
--color-success: #4a7a3a;                 /* 成功：苔绿 */
```

### 强调色使用规则

- 强调色只用于：选中态、进度条、评分点、品牌标识
- 强调色面积 ≤ 5% — 不能大面积使用
- 不用于：背景、边框、文字

## 字体系统

### 绝对禁止

- ❌ Inter — AI 默认字体，太平庸
- ❌ Roboto — Google 默认
- ❌ Arial — 无个性
- ❌ Space Grotesk — 已经泛滥

### 字体选择

```
主字体: 'DM Sans', system-ui, sans-serif
  - 几何无衬线，温暖但不圆滑
  - Google Fonts 免费
  - 支持 300-700 权重

标题字体: 'Noto Serif SC', 'Georgia', serif
  - 中文衬线，古卷气质
  - 用于：页面标题、区域标题、品牌文字

等宽: 'JetBrains Mono', monospace
  - 用于：代码、尺寸标注、数字
```

### 字体层级

| 角色 | 大小 | 权重 | 行高 | 字体 | 用途 |
|------|------|------|------|------|------|
| Display | 28px | 300 | 1.1 | Noto Serif SC | 页面标题 |
| H1 | 22px | 600 | 1.2 | Noto Serif SC | 区域标题 |
| H2 | 16px | 600 | 1.3 | DM Sans | 卡片标题 |
| Body | 14px | 400 | 1.6 | DM Sans | 正文 |
| Small | 12px | 400 | 1.4 | DM Sans | 元数据 |
| Label | 11px | 500 | 1.0 | DM Sans | 大写标签，letter-spacing 0.5px |
| Mono | 12px | 400 | 1.4 | JetBrains Mono | 尺寸、代码 |

## 间距系统

```
4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 px
```

- 组件内间距: 8-12px
- 卡片内边距: 24-32px
- 区域间距: 24-32px
- 页面边距: 24px

## 圆角系统

| 元素 | 圆角 |
|------|------|
| 按钮 | 9999px (pill) |
| 卡片 | 6px |
| 输入框 | 6px |
| 标签 | 4px |
| 图片 | 6px |
| 头像 | 50% (圆形) |

## 阴影系统

```css
--shadow-xs: 0 1px 2px rgba(78,50,23,0.04);
--shadow-sm:
  rgba(139,115,75,0.08) 0px 0px 0px 1px,
  rgba(78,50,23,0.03) 0px 1px 2px;
--shadow-card:
  rgba(139,115,75,0.08) 0px 0px 0px 1px,
  rgba(78,50,23,0.04) 0px 1px 3px;
--shadow-card-hover:
  rgba(139,115,75,0.14) 0px 0px 0px 1px,
  rgba(78,50,23,0.08) 0px 4px 16px,
  rgba(78,50,23,0.04) 0px 1px 4px;
--shadow-elevated:
  rgba(139,115,75,0.12) 0px 0px 0px 1px,
  rgba(78,50,23,0.12) 0px 8px 32px,
  rgba(78,50,23,0.06) 0px 2px 8px;
```

- 默认态: shadow-card（几乎看不见）
- 悬停态: shadow-card-hover（明显提升）
- 全部暖棕调，不用冷灰

## 特殊元素

- **评分**: 圆点（dots），不用星标
- **收藏**: 印章（stamp），不用心形
- **纸纹**: body::before SVG fractalNoise 覆盖层

## 布局原则

### 侧边栏

- 宽度: 240px
- 背景: surface (#f7f2ea)
- 右边框: 1px solid border
- 导航项间距: 2px
- Active 态: 金色底深色字
- 底部统计: 标签-数值左右布局

### 图片网格

- 列数: 4 列（默认），可切换
- 间距: 12px
- 卡片圆角: 6px
- 悬停: 上浮 1px + 阴影加深 + 底部渐变遮罩

### 头部工具栏

- 高度: 44px
- 背景: surface
- 底部边框: 1px solid border
- 排序按钮: pill 形，active 金色底
- 全选按钮: pill 形，透明默认

## 动效规则

- 过渡时间: 200ms ease-out
- 悬停: 背景色变化、阴影变化
- 图片悬停: scale(1.03) + 500ms cubic-bezier(0.16, 1, 0.3, 1)
- 不使用: bounce、elastic、入场动画

## 绝对禁止清单

1. ❌ 紫色渐变背景
2. ❌ Glassmorphism（毛玻璃）
3. ❌ 三等分卡片网格
4. ❌ 居中 hero + 大标题 + CTA
5. ❌ 侧边条纹边框（border-left 彩色）
6. ❌ 渐变文字（background-clip: text）
7. ❌ 弹窗作为第一反应（先考虑内联方案）
8. ❌ Inter / Roboto / Arial 字体
9. ❌ 纯黑 #000 / 纯白 #fff
10. ❌ 装饰性 SVG 插图
11. ❌ 冷灰阴影 rgba(0,0,0,...)
12. ❌ 100ms 过渡（太急促）

## AI Slop 测试

如果有人看到这个界面能立刻说"AI 做的"，那就是失败了。

**检查清单：**
- 配色是不是"AI 默认"？（暗色+紫色、暖白+橙色）
- 字体是不是 Inter？
- 布局是不是三等分卡片？
- 阴影是不是冷灰？
- 有没有一个大胆的设计决策？
