import { useTranslation } from '../../lib/i18n';
import type { EmbeddingStatus } from '../../lib/api/embeddings';

interface EmbeddingBadgeProps {
  status: EmbeddingStatus;
  size?: number;
}

const STATUS_COLORS: Record<EmbeddingStatus, string> = {
  embedded: '#4a7a3a',   // success
  pending: '#a09480',    // muted
  error: '#8b3030',      // danger
};

export function EmbeddingBadge({ status, size = 12 }: EmbeddingBadgeProps) {
  const { t } = useTranslation('embedding');

  const symbol = status === 'embedded' ? '✓' : status === 'pending' ? '○' : '✗';
  const label =
    status === 'embedded'
      ? t('statusEmbedded')
      : status === 'pending'
        ? t('statusPending')
        : t('statusError');

  return (
    <span
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: STATUS_COLORS[status],
        color: '#f2ede4',
        fontSize: size * 0.6,
        lineHeight: 1,
        fontFamily: 'var(--font-body)',
        transition: 'background-color 200ms ease-out',
        flexShrink: 0,
      }}
    >
      {symbol}
    </span>
  );
}
