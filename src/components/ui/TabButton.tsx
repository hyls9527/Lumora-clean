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
      className="tab-underline"
      aria-pressed={active}
      style={{
        color: active ? color : t.textSecondary,
        borderBottom: `2px solid ${active ? color : 'transparent'}`,
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  );
}
