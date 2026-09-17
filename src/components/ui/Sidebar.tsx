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

/** 藏书区 / 工具区 / 系统区 — 侧栏分组 */
const GROUP_BREAKS = new Set([
  '/gallery', // after favorites/collections → tools
  '/import',
]);

export function Sidebar({ activeRoute, onNavigate, onSearch }: SidebarProps) {
  const { available, checking, error, recheck } = useOllamaStatus();
  const isCollapsed = useIsMobile();

  usePerformanceMonitor('Sidebar');

  return (
    <aside
      role="navigation"
      aria-label={t('common.mainNav')}
      className="app-sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: isCollapsed ? '56px' : '208px',
      }}
    >
      {/* Logo — 书脊题签 */}
      <div
        style={{
          padding: isCollapsed ? '20px 12px 18px' : '28px 20px 22px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCollapsed ? 'center' : 'flex-start',
          gap: 10,
          borderBottom: `1px solid ${tok.borderSubtle}`,
        }}
      >
        <div
          style={{
            width: isCollapsed ? 28 : 32,
            height: isCollapsed ? 28 : 32,
            borderRadius: 3,
            border: `1px solid ${tok.border}`,
            background: tok.accentSubtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: isCollapsed ? 15 : 17,
              fontWeight: 600,
              fontFamily: tok.fontDisplay,
              color: tok.accent,
              lineHeight: 1,
            }}
          >
            灯
          </span>
        </div>
        {!isCollapsed && (
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                fontFamily: tok.fontDisplay,
                color: tok.text,
                letterSpacing: '0.04em',
                lineHeight: 1.2,
              }}
            >
              Lumora
            </div>
            <div
              style={{
                fontSize: 10,
                fontFamily: tok.fontBody,
                color: tok.textMuted,
                letterSpacing: '0.08em',
                marginTop: 3,
              }}
            >
              古卷 · 灯火
            </div>
          </div>
        )}
      </div>

      {/* Navigation — 书签 */}
      <nav
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: isCollapsed ? '12px 8px' : '14px 10px',
          overflowY: 'auto',
        }}
        aria-label={t('common.mainNav')}
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
        {sidebarRoutes.map((item, index) => {
          const isActive = activeRoute === item.path;
          const showBreak = !isCollapsed && index > 0 && GROUP_BREAKS.has(item.path);
          return (
            <div key={item.path}>
              {showBreak && (
                <div
                  aria-hidden
                  style={{
                    margin: '10px 8px 10px',
                    borderBottom: `1px dotted ${tok.border}`,
                  }}
                />
              )}
              <NavButton
                active={isActive}
                onClick={() => onNavigate(item.path as RoutePath)}
                collapsed={isCollapsed}
              >
                {t(item.i18nKey)}
              </NavButton>
            </div>
          );
        })}
      </nav>

      {/* Auto-update banner */}
      <UpdateBanner />

      {/* Ollama status */}
      {!isCollapsed && !available && !checking && (
        <button
          type="button"
          onClick={recheck}
          title={error ?? 'Ollama 未连接'}
          aria-label="Ollama 状态：离线，点击重试"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '0 12px 6px',
            padding: '7px 10px',
            fontSize: 11,
            fontFamily: tok.fontBody,
            color: tok.danger,
            background: tok.dangerBg,
            border: `1px solid rgba(139, 48, 48, 0.16)`,
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'background 200ms',
            textAlign: 'left',
          }}
        >
          <span style={dotStyle(tok.danger)} />
          Ollama 离线
        </button>
      )}
      {!isCollapsed && available && !checking && (
        <div
          role="status"
          aria-label="Ollama 状态：在线"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '0 12px 6px',
            padding: '7px 10px',
            fontSize: 11,
            fontFamily: tok.fontBody,
            color: tok.textMuted,
          }}
        >
          <span style={dotStyle(tok.success)} />
          Ollama 在线
        </div>
      )}

      {/* Search — 命令入口 */}
      <div
        style={{
          padding: isCollapsed ? '0 8px 16px' : '0 12px 18px',
          borderTop: `1px solid ${tok.borderSubtle}`,
          paddingTop: isCollapsed ? 12 : 14,
        }}
      >
        <button
          type="button"
          onClick={onSearch}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            width: '100%',
            padding: isCollapsed ? '9px 8px' : '9px 12px',
            fontSize: isCollapsed ? 14 : 11,
            fontFamily: tok.fontBody,
            color: tok.textMuted,
            background: tok.surface,
            border: `1px solid ${tok.border}`,
            borderRadius: 4,
            cursor: 'pointer',
            transition: 'color 160ms, border-color 160ms, background 160ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = tok.textSecondary;
            e.currentTarget.style.borderColor = tok.textFaint;
            e.currentTarget.style.background = tok.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = tok.textMuted;
            e.currentTarget.style.borderColor = tok.border;
            e.currentTarget.style.background = tok.surface;
          }}
          aria-label="搜索 ⌘K"
          title={isCollapsed ? '搜索 ⌘K' : undefined}
        >
          {isCollapsed ? (
            <span style={{ fontFamily: tok.fontDisplay, lineHeight: 1 }}>⌕</span>
          ) : (
            <>
              <span style={{ letterSpacing: '0.04em' }}>搜索</span>
              <span
                style={{
                  fontSize: 10,
                  color: tok.textFaint,
                  letterSpacing: '0.04em',
                  fontFamily: tok.fontBody,
                }}
              >
                ⌘K
              </span>
            </>
          )}
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
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        width: '100%',
        padding: collapsed ? '10px 8px' : '9px 12px',
        fontSize: collapsed ? 0 : 12,
        fontWeight: active ? 600 : 400,
        fontFamily: tok.fontBody,
        color: active ? tok.text : tok.textSecondary,
        background: active ? tok.accentSubtle : 'transparent',
        border: 'none',
        borderRadius: 3,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        transition: 'color 160ms ease-out, background 160ms ease-out',
        textAlign: collapsed ? 'center' : 'left',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = tok.surfaceHover;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Active: 左侧书签竖线 */}
      {!collapsed && active && (
        <span
          aria-hidden
          className="anim-bookmark"
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 2,
            borderRadius: 1,
            background: tok.accent,
          }}
        />
      )}
      {collapsed ? (
        <span
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontFamily: tok.fontDisplay,
            fontWeight: active ? 600 : 500,
            color: active ? tok.accent : tok.textSecondary,
            border: active ? `1px solid ${tok.accent}` : `1px solid transparent`,
            borderRadius: 3,
            background: active ? tok.accentSubtle : 'transparent',
          }}
        >
          {String(children).charAt(0)}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
