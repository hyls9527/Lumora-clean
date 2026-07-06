import { t } from '../../lib/tokens';
/**
 * SimilarityBadge — displays a 0–100% similarity score.
 * Uses the project's warm design language: no icons, 4px radius, 200ms transitions.
 */
interface SimilarityBadgeProps {
  /** Similarity score 0-100 */
  value: number;
}

export function SimilarityBadge({ value }: SimilarityBadgeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const isHigh = clamped >= 90;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 600,
        fontFamily: t.fontBody,
        color: t.bg,
        background: isHigh ? t.success : t.accent,
        borderRadius: 4,
        lineHeight: 1.2,
        transition: 'background 200ms, color 200ms',
      }}
    >
      {clamped}%
    </span>
  );
}
