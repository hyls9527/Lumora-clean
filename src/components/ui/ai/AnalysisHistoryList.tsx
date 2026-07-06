import type { AnalysisHistoryItem } from '../../../lib/api/ai';
import { useTranslation } from '../../../lib/i18n';
import { t as tok } from '../../../lib/tokens';

interface AnalysisHistoryListProps {
  items: AnalysisHistoryItem[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AnalysisHistoryList({ items }: AnalysisHistoryListProps) {
  const { t } = useTranslation('aiAnalysis');

  if (items.length === 0) return null;

  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontFamily: tok.fontDisplay,
          color: tok.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 6,
        }}
      >
        {t('history')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '4px 0',
              borderBottom: `1px dotted ${tok.border}`,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontFamily: tok.fontBody,
                color: tok.textSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 160,
              }}
            >
              {item.result.description.slice(0, 30)}
              {item.result.description.length > 30 ? '…' : ''}
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                color: tok.textMuted,
                flexShrink: 0,
                marginLeft: 8,
              }}
            >
              {formatDateTime(item.analyzedAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
