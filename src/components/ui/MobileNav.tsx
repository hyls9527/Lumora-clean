import { useTranslation } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';
import { type RoutePath, ROUTES } from '../../routes';

interface MobileNavProps {
  activeRoute: string;
  onNavigate: (route: RoutePath) => void;
}

/** 书签式底部导航 — 字标，无 emoji */
const navItems = [
  { key: ROUTES.GALLERY, glyph: '库', i18nKey: 'sidebar.gallery' },
  { key: ROUTES.SEARCH, glyph: '寻', i18nKey: 'sidebar.search' },
  { key: ROUTES.IMPORT, glyph: '入', i18nKey: 'sidebar.import' },
  { key: ROUTES.FAVORITES, glyph: '藏', i18nKey: 'sidebar.favorites' },
  { key: ROUTES.SETTINGS, glyph: '设', i18nKey: 'sidebar.settings' },
];

export function MobileNav({ activeRoute, onNavigate }: MobileNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'stretch',
        height: 56,
        background: tok.bg,
        borderTop: `1px solid ${tok.border}`,
        zIndex: 100,
      }}
      aria-label={t('common.mainNav')}
    >
      {navItems.map((item) => {
        const isActive = activeRoute === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              flex: 1,
              padding: '6px 4px 8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? tok.accent : tok.textMuted,
              transition: 'color 160ms ease-out',
            }}
          >
            {isActive && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '22%',
                  right: '22%',
                  height: 2,
                  background: tok.accent,
                  borderRadius: 1,
                }}
              />
            )}
            <span
              style={{
                fontSize: 14,
                fontFamily: tok.fontDisplay,
                fontWeight: isActive ? 600 : 500,
                lineHeight: 1,
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 3,
                border: isActive ? `1px solid ${tok.border}` : '1px solid transparent',
                background: isActive ? tok.accentSubtle : 'transparent',
              }}
            >
              {item.glyph}
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: tok.fontBody,
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '0.02em',
              }}
            >
              {t(item.i18nKey)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
