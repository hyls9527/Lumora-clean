import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useOllamaStatus } from '../../hooks/useOllamaStatus';
import { useSmartCollectionStore } from '../../stores/smartCollectionStore';
import { useTranslation } from '../../lib/i18n';
import { UpdateBanner } from './UpdateBanner';

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
  { key: '/favorites', label: '收藏' },
  { key: '/dashboard', label: '仪表盘' },
  { key: '/import', label: '导入管理' },
  { key: '/search', label: '语义搜索' },
  { key: '/tags', label: '标签' },
  { key: '/export', label: '导出' },
  { key: '/settings', label: '设置' },
  { key: '/trash', label: '回收站' },
];

export function Sidebar({ activeRoute, onNavigate }: SidebarProps) {
  const { available, checking, error, recheck } = useOllamaStatus();
  const { collections, load } = useSmartCollectionStore();
  const { t } = useTranslation('smartCollections');

  useEffect(() => { void load(); }, [load]);

  return (
    <aside
      role="navigation"
      aria-label="主导航"
      className="app-sidebar"
      style={{
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
        aria-label="主导航"
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

      {/* Smart Collections */}
      {collections.length > 0 && (
        <div style={{ padding: '12px 12px 0' }}>
          <p
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-body)',
              color: '#a09480',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '0 0 6px',
            }}
          >
            {t('title')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {collections.map((col) => (
              <NavButton
                key={col.id}
                active={activeRoute === `/smart/${col.id}`}
                onClick={() => onNavigate(`/smart/${col.id}`)}
              >
                {col.name}
              </NavButton>
            ))}
          </div>
        </div>
      )}

      {/* Auto-update banner */}
      <UpdateBanner />

      {/* Ollama status */}
      {!available && !checking && (
        <button
          type="button"
          onClick={recheck}
          title={error ?? 'Ollama 未连接'}
          aria-label="Ollama 状态：离线，点击重试"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            margin: '0 12px 8px',
            padding: '6px 10px',
            fontSize: 10,
            fontFamily: 'var(--font-body)',
            color: '#8b3030',
            background: 'rgba(139, 48, 48, 0.06)',
            border: '1px solid rgba(139, 48, 48, 0.12)',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'background 200ms',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#8b3030',
              flexShrink: 0,
            }}
          />
          Ollama 离线
        </button>
      )}
      {available && !checking && (
        <div
          role="status"
          aria-label="Ollama 状态：在线"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            margin: '0 12px 8px',
            padding: '6px 10px',
            fontSize: 10,
            fontFamily: 'var(--font-body)',
            color: '#4a7a3a',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4a7a3a',
              flexShrink: 0,
            }}
          />
          Ollama 在线
        </div>
      )}

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
          aria-label="搜索 ⌘K"
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
