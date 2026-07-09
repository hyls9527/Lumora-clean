import { useTranslation } from '../../lib/i18n';
import { t as tokens } from '../../lib/tokens';

interface BatchToolbarProps {
  count: number;
  onDelete: () => void;
  onAiTag: () => void;
  onEmbed: () => void;
  onCancel: () => void;
  deleting: boolean;
  tagging: boolean;
  embedding: boolean;
}

export function BatchToolbar({ count, onDelete, onAiTag, onEmbed, onCancel, deleting, tagging, embedding }: BatchToolbarProps) {
  const { t } = useTranslation('batch');
  if (count === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        background: tokens.text,
        color: tokens.bg,
        borderRadius: 8,
        boxShadow: 'rgba(0,0,0,0.25) 0px 8px 32px',
        animation: 'slideUp 200ms ease-out',
        fontFamily: tokens.fontBody,
      }}
    >
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
      <span style={{ fontSize: 13, fontWeight: 500 }}>
        {t('selected', { count })}
      </span>
      <span style={{ width: 1, height: 20, background: 'rgba(242,237,228,0.2)' }} />
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        style={{
          fontSize: 12, fontFamily: tokens.fontDisplay, color: tokens.bg,
          background: tokens.danger, border: 'none', padding: '6px 16px',
          borderRadius: 4, cursor: deleting ? 'not-allowed' : 'pointer',
          opacity: deleting ? 0.5 : 1, transition: 'background 200ms',
        }}
      >
        {deleting ? t('deleting') : t('delete')}
      </button>
      <button
        type="button"
        onClick={onAiTag}
        disabled={tagging}
        style={{
          fontSize: 12, fontFamily: tokens.fontDisplay, color: tokens.bg,
          background: tokens.accent, border: 'none', padding: '6px 16px',
          borderRadius: 4, cursor: tagging ? 'not-allowed' : 'pointer',
          opacity: tagging ? 0.5 : 1, transition: 'background 200ms',
        }}
      >
        {tagging ? t('tagging') : t('aiTag')}
      </button>
      <button
        type="button"
        onClick={onEmbed}
        disabled={embedding}
        style={{
          fontSize: 12, fontFamily: tokens.fontDisplay, color: tokens.bg,
          background: tokens.success, border: 'none', padding: '6px 16px',
          borderRadius: 4, cursor: embedding ? 'not-allowed' : 'pointer',
          opacity: embedding ? 0.5 : 1, transition: 'background 200ms',
        }}
      >
        {embedding ? t('embedding') : t('embed')}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          fontSize: 12, fontFamily: tokens.fontDisplay, color: tokens.bg,
          background: 'rgba(242,237,228,0.1)', border: 'none',
          padding: '6px 16px', borderRadius: 4, cursor: 'pointer',
          transition: 'background 200ms',
        }}
      >
        {t('cancel')}
      </button>
    </div>
  );
}
