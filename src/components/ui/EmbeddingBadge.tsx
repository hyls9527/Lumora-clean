import { useTranslation } from '../../lib/i18n';
import type { EmbeddingStatus } from '../../lib/api/embeddings';

interface EmbeddingBadgeProps {
  status: EmbeddingStatus;
  size?: number;
}

const STATUS_COLORS: Record<EmbeddingStatus, string> = {
  embedded: '#5a8f3c',   // muted green
  pending: '#b8a88a',    // warm gray
  error: '#b05544',      // muted red
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
        color: '#fff',
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
