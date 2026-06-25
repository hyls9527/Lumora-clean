import type { ReactNode } from 'react';

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
}

interface NavItem {
  key: string;
  label: string;
}

const navItems: NavItem[] = [
  { key: '/gallery', label: '创作者图库' },
  { key: '/normal', label: '普通图库' },
  { key: '/curation', label: '策展' },
  { key: '/dashboard', label: '仪表盘' },
  { key: '/import', label: '导入管理' },
  { key: '/search', label: '语义搜索' },
  { key: '/favorites', label: '收藏' },
  { key: '/prompts', label: '提示词库' },
  { key: '/tags', label: '标签' },
  { key: '/settings', label: '设置' },
  { key: '/trash', label: '回收站' },
];

export function Sidebar({ activeRoute, onNavigate }: SidebarProps) {
  return (
    <aside
      role="navigation"
      aria-label="主导航"
      style={{
        width: 200,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        borderRight: '1px solid rgba(139, 115, 75, 0.10)',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '32px 24px 24px' }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            fontFamily: 'var(--font-display)',
            color: '#7a5c12',
            lineHeight: 1,
            margin: 0,
          }}
        >
          L
        </h1>
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '0 12px',
        }}
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const isActive = activeRoute === item.key;
          return (
            <NavButton
              key={item.key}
              active={isActive}
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
            </NavButton>
          );
        })}
      </nav>

      {/* Search button */}
      <div style={{ padding: '0 12px 24px' }}>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '10px 12px',
            fontSize: 11,
            fontFamily: 'var(--font-display)',
            color: '#6b5d48',
            background: 'none',
            border: '1px solid rgba(139, 115, 75, 0.10)',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'color 200ms, border-color 200ms',
          }}
          aria-label="搜索"
        >
          搜索 ⌘K
        </button>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 12px',
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        fontFamily: 'var(--font-display)',
        color: active ? '#2a2118' : '#6b5d48',
        background: 'none',
        border: 'none',
        borderLeft: `3px solid ${active ? '#7a5c12' : 'transparent'}`,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'color 200ms, border-color 200ms',
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  );
}
