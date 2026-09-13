import { t as tok } from '../../lib/tokens';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="empty-state" role="alert">
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 4,
          border: `1px solid rgba(139, 48, 48, 0.2)`,
          background: tok.dangerBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          color: tok.danger,
          fontFamily: tok.fontDisplay,
        }}
        aria-hidden
      >
        !
      </div>
      <p className="empty-state__title" style={{ color: tok.danger }}>
        出现错误
      </p>
      <p className="empty-state__desc">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--accent" onClick={onRetry} style={{ marginTop: 4 }}>
          重试
        </button>
      )}
    </div>
  );
}
