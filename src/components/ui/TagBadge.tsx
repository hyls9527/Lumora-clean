import { t as tok } from '../../lib/tokens';
interface TagBadgeProps {
  name: string;
  color?: string | null;
  onRemove?: () => void;
}

export function TagBadge({ name, color, onRemove }: TagBadgeProps) {
  const bgColor = color ?? tok.border;
  const textColor = color ? tok.text : tok.textSecondary;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10px',
        padding: '2px 6px',
        border: `1px solid ${tok.border}`,
        borderRadius: '4px',
        background: bgColor,
        color: textColor,
        fontFamily: tok.fontBody,
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
            fontSize: '10px',
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
