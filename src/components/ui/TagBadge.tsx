import { t as tok } from '../../lib/tokens';

interface TagBadgeProps {
  name: string;
  color?: string | null;
  onRemove?: () => void;
}

export function TagBadge({ name, color, onRemove }: TagBadgeProps) {
  const bgColor = color ?? tok.accentSubtle;
  const textColor = color ? tok.text : tok.textSecondary;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        padding: '2px 6px',
        border: `1px solid ${color ?? tok.border}`,
        borderRadius: 3,
        background: bgColor,
        color: textColor,
        fontFamily: tok.fontBody,
        transition: 'opacity 160ms ease-out',
        lineHeight: 1.5,
        letterSpacing: '0.02em',
        maxWidth: 120,
        overflow: 'hidden',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
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
            fontSize: 11,
            color: textColor,
            opacity: 0.55,
            lineHeight: 1,
            transition: 'opacity 160ms ease-out',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '0.55';
          }}
          aria-label={`移除标签 ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
