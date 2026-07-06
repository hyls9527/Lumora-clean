import { t } from '../../lib/tokens';
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontFamily: t.fontDisplay,
          color: t.danger,
          marginBottom: 8,
        }}
      >
        出现错误
      </div>
      <div
        style={{
          fontSize: 12,
          fontFamily: t.fontBody,
          color: t.textSecondary,
          marginBottom: 16,
          maxWidth: 400,
          lineHeight: 1.6,
        }}
      >
        {message}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '8px 20px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: t.fontDisplay,
            color: t.bg,
            background: t.accent,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'background 200ms',
          }}
        >
          重试
        </button>
      )}
    </div>
  );
}
