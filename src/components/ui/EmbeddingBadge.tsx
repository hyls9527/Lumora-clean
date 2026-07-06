import { useTranslation } from '../../lib/i18n';
import type { EmbeddingStatus } from '../../lib/api/embeddings';
import { t as tok } from '../../lib/tokens';

interface EmbeddingBadgeProps {
  status: EmbeddingStatus;
  size?: number;
}

const STATUS_COLORS: Record<EmbeddingStatus, string> = {
  embedded: tok.success,   // success
  pending: tok.textMuted,    // muted
  error: tok.danger,      // danger
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
        color: tok.bg,
        fontSize: size * 0.6,
        lineHeight: 1,
        fontFamily: tok.fontBody,
        transition: 'background-color 200ms ease-out',
        flexShrink: 0,
      }}
    >
      {symbol}
    </span>
  );
}
