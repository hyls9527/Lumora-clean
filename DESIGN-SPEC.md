# Lumora Design Spec — Warm White

> 参考: ElevenLabs warm white aesthetic
> 图片是主角，UI 不能抢戏

## Color Palette

```css
@theme {
  --color-bg: #faf9f7;
  --color-surface: #ffffff;
  --color-surface-hover: #f5f4f2;
  --color-surface-warm: rgba(245, 242, 239, 0.8);
  --color-border: #e8e6e3;
  --color-border-subtle: rgba(0, 0, 0, 0.04);
  --color-text: #1a1a1a;
  --color-text-secondary: #555555;
  --color-text-muted: #999999;
  --color-accent: #e8c472;
  --color-accent-hover: #d4a84a;
  --color-accent-text: #1a1a1a;
  --color-danger: #ef4444;
  --color-success: #22c55e;
  --color-warning: #f59e0b;
}
```

## Typography

- **Font:** Inter (already installed)
- **Weights:** 300 (display), 400 (body), 500 (emphasis), 600 (strong)
- **H1:** 32px, weight 300, line-height 1.1, letter-spacing -0.6px
- **H2:** 24px, weight 400, line-height 1.2
- **H3:** 18px, weight 500, line-height 1.3
- **Body:** 14px, weight 400, line-height 1.5
- **Small:** 12px, weight 400, color muted
- **Label:** 11px, weight 500, text-transform uppercase, letter-spacing 0.5px

## Spacing Scale

4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64px

## Border Radius

- Buttons: 9999px (pill)
- Cards: 12px
- Inputs: 10px
- Tags: 8px
- Small elements: 6px

## Shadows

```css
--shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04);
--shadow-card-hover: 0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06);
--shadow-warm: rgba(78, 50, 23, 0.04) 0px 6px 16px;
```

## Components

### Sidebar
- Background: #ffffff
- Border-right: 1px solid #e8e6e3
- Nav items: 8px radius, hover bg #f5f4f2
- Active nav: bg #1a1a1a, text #fff
- Brand: gold icon + bold text

### Image Grid
- 4 columns (not 5)
- Gap: 12px
- Card radius: 12px
- Card shadow: --shadow-card
- Hover: lift -2px + --shadow-card-hover
- Selected: 2px gold outline

### Buttons
- Primary: bg #1a1a1a, text #fff, pill shape
- Secondary: bg transparent, border #ddd, pill shape
- Sort active: bg #1a1a1a, text #fff
- Sort inactive: bg transparent, border #ddd, text #888

### Detail Panel
- Background: #ffffff
- Border-left: 1px solid #e8e6e3
- Score bars: gold accent
- Tags: pill shape, bg #f5f4f2

### Dashboard Cards
- Background: #ffffff
- Border: 1px solid #e8e6e3
- Radius: 12px
- Shadow: --shadow-card

### Settings
- Tabs: pill shape, active = black bg
- Content: white cards on #faf9f7 bg
