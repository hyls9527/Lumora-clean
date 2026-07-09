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
