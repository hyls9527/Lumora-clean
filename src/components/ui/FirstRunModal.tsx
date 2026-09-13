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
        background: 'rgba(36, 28, 18, 0.52)',
        animation: 'fadeIn 200ms ease-out',
      }}
    >
      <div
        className="modal-panel"
        style={{
          width: 460,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
          overflowY: 'auto',
          padding: 28,
          fontFamily: tok.fontBody,
        }}
      >
        <h2
          style={{
            margin: '0 0 6px',
            fontFamily: tok.fontDisplay,
            fontSize: 20,
            fontWeight: 600,
            color: tok.text,
            letterSpacing: '0.01em',
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
            background: tok.bgAlt,
            border: `1px solid ${tok.border}`,
            borderRadius: 6,
            padding: '14px 16px',
            marginBottom: 10,
            cursor: 'pointer',
            fontFamily: tok.fontBody,
            transition: 'border-color 160ms ease-out, background 160ms ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = tok.accent;
            e.currentTarget.style.background = tok.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = tok.border;
            e.currentTarget.style.background = tok.bgAlt;
          }}
        >
          <strong style={{ display: 'block', fontSize: 14, color: tok.text, marginBottom: 4 }}>
            {t('referenceTitle')}
          </strong>
          <span style={{ fontSize: 12, color: tok.textMuted, lineHeight: 1.5 }}>
            {t('referenceDesc')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChoose('copy')}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            background: tok.bgAlt,
            border: `1px solid ${tok.border}`,
            borderRadius: 6,
            padding: '14px 16px',
            marginBottom: 14,
            cursor: 'pointer',
            fontFamily: tok.fontBody,
            transition: 'border-color 160ms ease-out, background 160ms ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = tok.accent;
            e.currentTarget.style.background = tok.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = tok.border;
            e.currentTarget.style.background = tok.bgAlt;
          }}
        >
          <strong style={{ display: 'block', fontSize: 14, color: tok.text, marginBottom: 4 }}>
            {t('copyTitle')}
          </strong>
          <span style={{ fontSize: 12, color: tok.textMuted, lineHeight: 1.5 }}>
            {t('copyDesc')}
          </span>
        </button>

        <p
          style={{
            margin: '0 0 18px',
            fontSize: 11,
            lineHeight: 1.6,
            color: tok.textMuted,
            fontFamily: tok.fontBody,
          }}
        >
          {t('uninstallWarning')}
        </p>

        <button
          type="button"
          onClick={() => onChoose('reference')}
          className="btn btn--accent"
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 4,
            fontSize: 14,
            fontFamily: tok.fontDisplay,
            fontWeight: 600,
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
