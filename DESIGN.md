# DESIGN.md — Lumora Visual Identity

> 光之韵律 · AI 创作者的图片管理器
> 
> 这个文件定义了 Lumora 的视觉身份。每次写 UI 代码前必须读这个文件。

## 设计场景

**谁在用，在哪里，什么心情：**

AI 创作者坐在电脑前，面前是 1 万张生成的图片。他需要快速扫描、挑选最好的、丢弃废片。他会长时间盯着屏幕（2-4 小时），所以 UI 必须不累眼。图片是唯一的主角，UI 是隐形的工具。

**结论：** 暖白底色（不刺眼），低密度界面（让图片呼吸），克制的强调色（不抢戏）。

## 色彩系统

### 绝对禁止

- ❌ 纯黑 `#000000` — 用 `#1a1a1a` 代替
- ❌ 纯白 `#ffffff` — 用 `#faf9f7` 代替
- ❌ 紫色渐变 — AI 默认审美，禁止
- ❌ 蓝色链接色 — 用强调色代替
- ❌ 彩虹色 — 单色系统

### 调色板

```css
--color-bg: #faf9f7;           /* 页面底色：暖白 */
--color-surface: #ffffff;       /* 卡片/面板：纯白 */
--color-surface-hover: #f5f4f2; /* 悬停态：微灰 */
--color-border: #eae8e5;        /* 边框：暖灰 */
--color-text: #1a1a1a;          /* 主文字：近黑 */
--color-text-secondary: #4a4a4a;/* 次文字 */
--color-text-muted: #8a8a8a;    /* 弱文字 */
--color-accent: #e8c472;        /* 强调色：金色 */
--color-accent-hover: #d4a84a;  /* 强调色悬停 */
--color-danger: #ef4444;        /* 危险：红 */
--color-success: #22c55e;       /* 成功：绿 */
```

### 强调色使用规则

- 强调色只用于：选中态、进度条、评分星标、品牌标识
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

等宽: 'JetBrains Mono', monospace
  - 用于：代码、尺寸标注、数字
```

### 字体层级

| 角色 | 大小 | 权重 | 行高 | 用途 |
|------|------|------|------|------|
| Display | 28px | 300 | 1.1 | 页面标题 |
| H1 | 22px | 600 | 1.2 | 区域标题 |
| H2 | 16px | 600 | 1.3 | 卡片标题 |
| Body | 14px | 400 | 1.5 | 正文 |
| Small | 12px | 400 | 1.4 | 元数据 |
| Label | 11px | 500 | 1.0 | 大写标签，letter-spacing 0.5px |
| Mono | 12px | 400 | 1.4 | 尺寸、代码 |

## 间距系统

```
4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 px
```

- 组件内间距: 8-12px
- 卡片内边距: 16-20px
- 区域间距: 24-32px
- 页面边距: 24px

## 圆角系统

| 元素 | 圆角 |
|------|------|
| 按钮 | 9999px (pill) |
| 卡片 | 10px |
| 输入框 | 8px |
| 标签 | 6px |
| 图片 | 8px |
| 头像 | 50% (圆形) |

## 阴影系统

```css
--shadow-card: 0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03);
--shadow-card-hover: 0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
--shadow-warm: 0 2px 8px rgba(78,50,23,0.04), 0 0 0 1px rgba(0,0,0,0.03);
```

- 默认态: shadow-card（几乎看不见）
- 悬停态: shadow-card-hover（明显提升）
- 暖色阴影: 用于需要温暖感的元素

## 布局原则

### 侧边栏

- 宽度: 220px
- 背景: surface (#ffffff)
- 右边框: 1px solid border
- 导航项间距: 2px
- Active 态: 黑底白字
- 底部统计: 标签-数值左右布局

### 图片网格

- 列数: 4 列（默认），可切换
- 间距: 10px
- 卡片圆角: 10px
- 悬停: 上浮 1px + 阴影加深 + 底部渐变遮罩

### 头部工具栏

- 高度: 44px
- 背景: surface
- 底部边框: 1px solid border
- 排序按钮: pill 形，active 黑底白字
- 全选按钮: pill 形，透明默认

## 动效规则

- 过渡时间: 150ms ease-out
- 悬停: 背景色变化、阴影变化
- 图片悬停: scale(1.03) + 300ms
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

## AI Slop 测试

如果有人看到这个界面能立刻说"AI 做的"，那就是失败了。

**检查清单：**
- 配色是不是"AI 默认"？（暗色+紫色、暖白+橙色）
- 字体是不是 Inter？
- 布局是不是三等分卡片？
- 有没有一个大胆的设计决策？
