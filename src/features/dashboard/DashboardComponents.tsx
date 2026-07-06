import { t as tok } from '../../lib/tokens';

/** Dotted separator row for directory-style layout */
export function DotRow({
  label,
  value,
  indent = 0,
}: {
  label: string;
  value: React.ReactNode;
  indent?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        paddingLeft: indent * 16,
        fontFamily: tok.fontBody,
        fontSize: 13,
        lineHeight: 1.8,
      }}
    >
      <span style={{ color: tok.textSecondary, whiteSpace: 'nowrap' }}>{label}</span>
      <span
        style={{
          flex: 1,
          borderBottom: `1px dotted ${tok.border}`,
          minWidth: 20,
          marginBottom: 4,
        }}
      />
      <span style={{ color: tok.text, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

/** Section title for dashboard cards */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        marginBottom: 16,
        fontFamily: tok.fontDisplay,
        color: tok.textSecondary,
      }}
    >
      {children}
    </h3>
  );
}

/** Format ISO timestamp to relative time */
export function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}
