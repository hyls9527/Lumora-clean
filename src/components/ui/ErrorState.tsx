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
          fontFamily: 'var(--font-display)',
          color: '#8b3030',
          marginBottom: 8,
        }}
      >
        出现错误
      </div>
      <div
        style={{
          fontSize: 12,
          fontFamily: 'var(--font-body)',
          color: '#6b5d48',
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
            fontFamily: 'var(--font-display)',
            color: '#f2ede4',
            background: '#7a5c12',
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
