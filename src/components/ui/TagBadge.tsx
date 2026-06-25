interface TagBadgeProps {
  name: string;
  color?: string | null;
  onRemove?: () => void;
}

export function TagBadge({ name, color, onRemove }: TagBadgeProps) {
  const bgColor = color ?? 'rgba(139, 115, 75, 0.10)';
  const textColor = color ? '#2a2118' : '#6b5d48';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '9px',
        padding: '1px 6px',
        border: '1px solid rgba(139, 115, 75, 0.10)',
        borderRadius: '2px',
        background: bgColor,
        color: textColor,
        fontFamily: 'var(--font-body)',
        transition: 'opacity 200ms',
        lineHeight: 1.6,
      }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontSize: '9px',
            color: textColor,
            opacity: 0.6,
            lineHeight: 1,
            transition: 'opacity 200ms',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '0.6';
          }}
          aria-label={`移除标签 ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
