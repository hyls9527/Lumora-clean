import { t } from '../../lib/tokens';
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}

export function TabButton({ active, onClick, children, color = t.accent }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11,
        fontFamily: t.fontDisplay,
        color: active ? color : t.textSecondary,
        background: 'none',
        border: 'none',
        padding: '0 0 2px',
        borderBottom: `2px solid ${active ? color : 'transparent'}`,
        cursor: 'pointer',
        transition: 'color 200ms, border-color 200ms',
      }}
    >
      {children}
    </button>
  );
}
