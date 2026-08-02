/**
 * Lumora design tokens — single source of truth.
 * Derived from DESIGN.md "古卷·灯火" palette.
 *
 * All color values use CSS custom properties so they automatically
 * respond to [data-theme="dark"] overrides in index.css.
 *
 * Usage:
 *   import { t } from '../lib/tokens';
 *   style={{ color: t.text, border: `1px solid ${t.border}` }}
 */

// ── Colors ──────────────────────────────────────────
export const t = {
  // Backgrounds
  bg: 'var(--color-bg)',
  bgAlt: 'var(--color-bg-alt)',
  surface: 'var(--color-surface)',
  surfaceHover: 'var(--color-surface-hover)',

  // Borders
  border: 'var(--color-border)',
  borderSubtle: 'var(--color-border-subtle)',

  // Text
  text: 'var(--color-text)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  textFaint: 'var(--color-text-faint)',

  // Accent
  accent: 'var(--color-accent)',
  accentHover: 'var(--color-accent-hover)',
  accentSubtle: 'var(--color-accent-subtle)',

  // Semantic
  danger: 'var(--color-danger)',
  dangerBg: 'var(--color-danger-bg)',
  success: 'var(--color-success)',

  // Shadows
  shadow: 'var(--shadow-card)',
  shadowHover: 'var(--shadow-card-hover)',
  shadowElevated: 'var(--shadow-elevated)',

  // Typography
  fontDisplay: 'var(--font-display)',
  fontBody: 'var(--font-body)',

  // Transitions
  transition: '200ms ease-out',
} as const;

// ── Shared style objects (for reuse) ────────────────
export const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: t.fontDisplay,
  color: t.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 2,
};

export const valueStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: t.fontBody,
  color: t.text,
};

// ── Common UI pattern presets ─────────────────────

/** Small colored dot (status indicator, badge marker) */
export const dotStyle = (color: string): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: color,
  flexShrink: 0,
});

/** Base accent button — subtle outline variant */
export const accentBtnStyle: React.CSSProperties = {
  fontSize: 12,
  fontFamily: t.fontBody,
  color: t.accent,
  background: t.accentSubtle,
  border: `1px solid ${t.accent}`,
  borderRadius: 4,
  padding: '6px 14px',
  cursor: 'pointer',
  transition: t.transition,
};

/** Base text nav button — underline-active variant */
export const navTabStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 11,
  fontFamily: t.fontDisplay,
  color: active ? t.accent : t.textSecondary,
  background: 'none',
  border: 'none',
  padding: '0 0 2px',
  borderBottom: `2px solid ${active ? t.accent : 'transparent'}`,
  cursor: 'pointer',
  transition: t.transition,
});

/** Close button (✕) — positioned absolute top-right */
export const closeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  color: t.textMuted,
  padding: 4,
  lineHeight: 1,
};

/** Page title (h2) style — responsive */
export const pageTitleStyle = (isMobile?: boolean): React.CSSProperties => ({
  fontSize: isMobile ? 18 : 20,
  fontWeight: 600,
  fontFamily: t.fontDisplay,
  color: t.text,
  margin: 0,
});

/** Sidebar / toolbar separator line */
export const separatorStyle: React.CSSProperties = {
  width: 1,
  height: 14,
  background: 'rgba(139,115,75,0.15)',
  margin: '0 4px',
};
