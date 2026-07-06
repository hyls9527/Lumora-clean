/**
 * Lumora design tokens — single source of truth.
 * Derived from DESIGN.md "古卷·灯火" palette.
 *
 * Usage:
 *   import { t } from '../lib/tokens';
 *   style={{ color: t.text, border: `1px solid ${t.border}` }}
 */

// ── Colors ──────────────────────────────────────────
export const t = {
  // Backgrounds
  bg: '#f2ede4',
  bgAlt: '#ebe5d8',
  surface: 'var(--color-surface)',
  surfaceHover: 'var(--color-surface-hover)',

  // Borders
  border: 'rgba(139, 115, 75, 0.10)',
  borderSubtle: 'rgba(139, 115, 75, 0.05)',

  // Text
  text: '#2a2118',
  textSecondary: '#6b5d48',
  textMuted: '#a09480',
  textFaint: '#c4b89e',

  // Accent
  accent: '#7a5c12',
  accentHover: '#8b6914',
  accentSubtle: 'rgba(139, 105, 20, 0.06)',

  // Semantic
  danger: '#8b3030',
  dangerBg: 'rgba(179, 58, 58, 0.2)',
  success: '#4a7a3a',

  // Shadows
  shadow: 'rgba(139,115,75,0.08) 0px 0px 0px 1px, rgba(78,50,23,0.04) 0px 1px 3px',
  shadowHover: 'rgba(139,115,75,0.14) 0px 0px 0px 1px, rgba(78,50,23,0.08) 0px 4px 16px, rgba(78,50,23,0.04) 0px 1px 4px',
  shadowElevated: 'rgba(139,115,75,0.12) 0px 0px 0px 1px, rgba(78,50,23,0.12) 0px 8px 32px, rgba(78,50,23,0.06) 0px 2px 8px',

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
