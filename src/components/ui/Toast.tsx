import { useToastStore, type ToastType } from '../../stores/toastStore';
import { t as tok } from '../../lib/tokens';

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
};

const COLORS: Record<ToastType, { bg: string; text: string }> = {
  success: { bg: 'rgba(74, 122, 58, 0.1)', text: tok.success },
  error: { bg: 'rgba(139, 48, 48, 0.1)', text: tok.danger },
  warning: { bg: 'rgba(122, 92, 18, 0.1)', text: tok.accent },
  info: { bg: 'rgba(58, 58, 58, 0.1)', text: tok.textSecondary },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: COLORS[toast.type].bg,
            border: `1px solid ${COLORS[toast.type].text}`,
            borderRadius: 4,
            boxShadow: tok.shadow,
            animation: 'slideUp 200ms ease-out',
          }}
        >
          <span
            style={{
              fontSize: 16,
              color: COLORS[toast.type].text,
              flexShrink: 0,
            }}
          >
            {ICONS[toast.type]}
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: tok.fontBody,
              color: tok.text,
            }}
          >
            {toast.message}
          </span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: tok.textMuted,
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
