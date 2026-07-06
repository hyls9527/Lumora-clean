import { t } from '../../lib/tokens';
/** Plum-blossom stamp SVG for rating display (梅花印) */
export function PlumStamp({ filled }: { filled: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Five-petal plum blossom */}
      <circle cx="9" cy="5" r="3" fill={filled ? t.accent : t.textFaint} />
      <circle cx="5.5" cy="8.5" r="3" fill={filled ? t.accent : t.textFaint} />
      <circle cx="12.5" cy="8.5" r="3" fill={filled ? t.accent : t.textFaint} />
      <circle cx="6.5" cy="13" r="3" fill={filled ? t.accent : t.textFaint} />
      <circle cx="11.5" cy="13" r="3" fill={filled ? t.accent : t.textFaint} />
      <circle cx="9" cy="9.5" r="1.5" fill={filled ? t.bg : '#ebe5d8'} />
    </svg>
  );
}

export function Rating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i + 1)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: onChange ? 'pointer' : 'default',
            display: 'inline-flex',
            transition: 'opacity 200ms',
            opacity: i < value ? 1 : 0.5,
          }}
          aria-label={`${i + 1} 梅花印`}
        >
          <PlumStamp filled={i < value} />
        </button>
      ))}
    </div>
  );
}
