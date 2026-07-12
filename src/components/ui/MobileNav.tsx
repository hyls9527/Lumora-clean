import { useTranslation } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';

interface MobileNavProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
}

const navItems = [
  { key: '/gallery', icon: '🖼️', i18nKey: 'sidebar.gallery' },
  { key: '/search', icon: '🔍', i18nKey: 'sidebar.search' },
  { key: '/import', icon: '📥', i18nKey: 'sidebar.import' },
  { key: '/favorites', icon: '⭐', i18nKey: 'sidebar.favorites' },
  { key: '/settings', icon: '⚙️', i18nKey: 'sidebar.settings' },
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
        alignItems: 'center',
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
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? tok.accent : tok.textSecondary,
              transition: 'color 200ms',
            }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontFamily: tok.fontBody,
                fontWeight: isActive ? 600 : 400,
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
