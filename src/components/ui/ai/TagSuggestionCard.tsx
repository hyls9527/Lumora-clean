import { useTranslation } from '../../../lib/i18n';
import type { AnalysisTag } from '../../../lib/api/ai';
import { t as tok } from '../../../lib/tokens';

interface TagSuggestionCardProps {
  tag: AnalysisTag;
  accepted: boolean;
  rejected: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function TagSuggestionCard({
  tag,
  accepted,
  rejected,
  onAccept,
  onReject,
}: TagSuggestionCardProps) {
  const { t } = useTranslation('aiAnalysis');

  const confidencePercent = Math.round(tag.confidence * 100);

  if (rejected) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          border: '1px solid rgba(139, 115, 75, 0.10)',
          borderRadius: 4,
          background: 'rgba(139, 115, 75, 0.03)',
          opacity: 0.45,
          transition: 'opacity 200ms',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontFamily: tok.fontBody,
            color: tok.textMuted,
            textDecoration: 'line-through',
          }}
        >
          {tag.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: tok.fontBody,
            color: tok.textFaint,
          }}
        >
          {t('rejected')}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        border: `1px solid ${accepted ? 'rgba(74, 122, 58, 0.25)' : tok.border}`,
        borderRadius: 4,
        background: accepted ? 'rgba(74, 122, 58, 0.06)' : 'rgba(139, 115, 75, 0.04)',
        transition: 'background 200ms, border-color 200ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontFamily: tok.fontBody,
            color: tok.text,
            fontWeight: 500,
          }}
        >
          {tag.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            color: tok.textMuted,
          }}
        >
          {confidencePercent}%
        </span>
      </div>

      {!accepted && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={onAccept}
            style={{
              background: 'none',
              border: '1px solid rgba(74, 122, 58, 0.25)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 10,
              fontFamily: tok.fontBody,
              color: tok.success,
              cursor: 'pointer',
              transition: 'background 200ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(74, 122, 58, 0.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'none';
            }}
            aria-label={t('acceptTag', { name: tag.name })}
          >
            {t('accept')}
          </button>
          <button
            type="button"
            onClick={onReject}
            style={{
              background: 'none',
              border: '1px solid rgba(139, 48, 48, 0.20)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 10,
              fontFamily: tok.fontBody,
              color: tok.danger,
              cursor: 'pointer',
              transition: 'background 200ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(139, 48, 48, 0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'none';
            }}
            aria-label={t('rejectTag', { name: tag.name })}
          >
            {t('reject')}
          </button>
        </div>
      )}

      {accepted && (
        <span
          style={{
            fontSize: 10,
            fontFamily: tok.fontBody,
            color: tok.success,
          }}
        >
          {t('accepted')}
        </span>
      )}
    </div>
  );
}
