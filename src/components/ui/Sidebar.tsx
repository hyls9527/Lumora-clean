import type { ReactNode } from 'react';
import { useOllamaStatus } from '../../hooks/useOllamaStatus';
import { usePerformanceMonitor } from '../../hooks/usePerformance';
import { t } from '../../lib/i18n';
import { UpdateBanner } from './UpdateBanner';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { t as tok, dotStyle } from '../../lib/tokens';
import { sidebarRoutes, type RoutePath } from '../../routes';

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: RoutePath) => void;
  onSearch: () => void;
}

export function Sidebar({ activeRoute, onNavigate, onSearch }: SidebarProps) {
  const { available, checking, error, recheck } = useOllamaStatus();
  const isCollapsed = useIsMobile();

  usePerformanceMonitor('Sidebar');


  return (
    <aside
      role="navigation"
      aria-label={t("common.mainNav")}
      className="app-sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
        borderRight: `1px solid ${tok.border}`,
        width: isCollapsed ? '56px' : '220px',
        transition: 'width 200ms ease-out',
      }}
    >
      {/* Logo */}
      <div style={{ padding: isCollapsed ? '20px 16px 16px' : '32px 24px 24px' }}>
        <h1
          style={{
            fontSize: isCollapsed ? 20 : 28,
            fontWeight: 700,
            fontFamily: tok.fontDisplay,
            color: tok.accent,
            lineHeight: 1,
            margin: 0,
            textAlign: 'center',
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
          padding: isCollapsed ? '0 8px' : '0 12px',
        }}
        aria-label={t("common.mainNav")}
        onKeyDown={(e) => {
          const buttons = Array.from(e.currentTarget.querySelectorAll('button'));
          const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
          if (idx === -1) return;

          let next = -1;
          if (e.key === 'ArrowDown') next = (idx + 1) % buttons.length;
          else if (e.key === 'ArrowUp') next = (idx - 1 + buttons.length) % buttons.length;
          else if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = buttons.length - 1;

          if (next !== -1) {
            e.preventDefault();
            (buttons[next] as HTMLButtonElement).focus();
          }
        }}
      >
        {sidebarRoutes.map((item) => {
          const isActive = activeRoute === item.path;
          return (
            <NavButton
              key={item.path}
              active={isActive}
              onClick={() => onNavigate(item.path as RoutePath)}
              collapsed={isCollapsed}
            >
              {t(item.i18nKey)}
            </NavButton>
          );
        })}
      </nav>



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
            fontFamily: tok.fontBody,
            color: tok.danger,
            background: 'rgba(139, 48, 48, 0.06)',
            border: '1px solid rgba(139, 48, 48, 0.12)',
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'background 200ms',
          }}
        >
          <span style={dotStyle(tok.danger)} />
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
            fontFamily: tok.fontBody,
            color: tok.success,
          }}
        >
          <span style={dotStyle(tok.success)} />
          Ollama 在线
        </div>
      )}

      {/* Search button */}
      <div style={{ padding: isCollapsed ? '0 8px 16px' : '0 12px 24px' }}>
        <button
          type="button"
          onClick={onSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: isCollapsed ? '8px' : '10px 12px',
            fontSize: isCollapsed ? 14 : 11,
            fontFamily: tok.fontDisplay,
            color: tok.textSecondary,
            background: 'none',
            border: `1px solid ${tok.border}`,
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'color 200ms, border-color 200ms',
          }}
          aria-label="搜索 ⌘K"
          title={isCollapsed ? '搜索 ⌘K' : undefined}
        >
          {isCollapsed ? '⌕' : '搜索 ⌘K'}
        </button>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  onClick,
  children,
  collapsed,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? String(children) : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 8px' : '10px 12px',
        fontSize: collapsed ? 0 : 11,
        fontWeight: active ? 700 : 500,
        fontFamily: tok.fontDisplay,
        color: active ? tok.text : tok.textSecondary,
        background: 'none',
        border: 'none',
        borderLeft: collapsed ? 'none' : `3px solid ${active ? tok.accent : 'transparent'}`,
        borderBottom: collapsed ? `2px solid ${active ? tok.accent : 'transparent'}` : 'none',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'color 200ms, border-color 200ms',
        textAlign: collapsed ? 'center' : 'left',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {collapsed ? String(children).charAt(0) : children}
    </button>
  );
}
