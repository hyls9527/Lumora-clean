import { useTranslation } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';

export type ImportMode = 'reference' | 'copy';

/**
 * First-launch dialog: pick how imports store images before any import
 * happens. Shown once — the choice is persisted as settings `store_mode`.
 */
export function FirstRunModal({
  open,
  onChoose,
}: {
  open: boolean;
  onChoose: (mode: ImportMode) => void;
}) {
  const { t } = useTranslation('firstRun');
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(26, 22, 18, 0.45)',
      }}
    >
      <div
        style={{
          width: 460,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          background: 'var(--color-bg)',
          borderRadius: 10,
          padding: 28,
          fontFamily: 'var(--font-body)',
        }}
      >
        <h2
          style={{
            margin: '0 0 6px',
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          {t('title')}
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: tok.textMuted }}>{t('subtitle')}</p>

        <button
          type="button"
          onClick={() => onChoose('reference')}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: 'var(--color-bg-alt)',
            border: '1px solid var(--color-border, rgba(139, 115, 75, 0.2))',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 10,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          <strong style={{ display: 'block', fontSize: 14, color: 'var(--color-text)' }}>
            {t('referenceTitle')}
          </strong>
          <span style={{ fontSize: 12, color: tok.textMuted }}>{t('referenceDesc')}</span>
        </button>

        <button
          type="button"
          onClick={() => onChoose('copy')}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: 'var(--color-bg-alt)',
            border: '1px solid var(--color-border, rgba(139, 115, 75, 0.2))',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 14,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          <strong style={{ display: 'block', fontSize: 14, color: 'var(--color-text)' }}>
            {t('copyTitle')}
          </strong>
          <span style={{ fontSize: 12, color: tok.textMuted }}>{t('copyDesc')}</span>
        </button>

        <p
          style={{
            margin: '0 0 18px',
            fontSize: 11,
            lineHeight: 1.6,
            color: tok.textMuted,
            fontFamily: 'var(--font-body)',
          }}
        >
          {t('uninstallWarning')}
        </p>

        <button
          type="button"
          onClick={() => onChoose('reference')}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 6,
            border: 'none',
            background: tok.accent,
            color: tok.bg,
            fontSize: 14,
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('confirm')}
        </button>
        <p style={{ margin: '10px 0 0', fontSize: 11, textAlign: 'center', color: tok.textMuted }}>
          {t('changeLater')}
        </p>
      </div>
    </div>
  );
}
