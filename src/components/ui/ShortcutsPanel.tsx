import { useEffect, useRef } from 'react';
import { t as tok } from '../../lib/tokens';
import { useTranslation } from '../../lib/i18n';

export interface ShortcutItem {
  action: string;
  key: string;
}

export interface ShortcutGroup {
  heading: string;
  items: ShortcutItem[];
}

interface ShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ShortcutGroup[];
}

export function ShortcutsPanel({ isOpen, onClose, groups }: ShortcutsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('shortcutsPanel');

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.header}>
          <h2 style={styles.title}>{t('title')}</h2>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeBtn}
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>

        <div style={styles.body}>
          {groups.map((group, gi) => (
            <div key={group.heading} style={gi > 0 ? { marginTop: 20 } : undefined}>
              <h3 style={styles.groupHeading}>{group.heading}</h3>
              <div style={styles.groupCard}>
                {group.items.map((item, ii) => (
                  <div
                    key={item.action}
                    style={{
                      ...styles.row,
                      borderBottom:
                        ii < group.items.length - 1
                          ? `1px solid ${tok.borderSubtle}`
                          : 'none',
                    }}
                  >
                    <span style={styles.actionLabel}>{item.action}</span>
                    <kbd style={styles.kbd}>{item.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(42, 33, 24, 0.5)',
  },
  panel: {
    width: 'min(440px, 90vw)',
    maxHeight: 'min(560px, 85vh)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-surface, #f7f2ea)',
    border: `1px solid ${tok.border}`,
    borderRadius: 8,
    boxShadow: 'rgba(78,50,23,0.14) 0px 10px 40px, rgba(78,50,23,0.06) 0px 2px 8px',
    overflow: 'hidden',
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
    outline: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: `1px solid ${tok.border}`,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: 'var(--font-display, "DM Serif Display", serif)',
    color: 'var(--color-text, #2a2118)',
    margin: 0,
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    padding: 0,
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--color-text-secondary, #6b5d48)',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'background 200ms ease-out',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px 20px',
  },
  groupHeading: {
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-display, "DM Serif Display", serif)',
    color: 'var(--color-text-muted, #a09480)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginTop: 0,
    marginBottom: 8,
  },
  groupCard: {
    background: 'var(--color-bg-alt, #ebe5d8)',
    borderRadius: 6,
    border: `1px solid ${tok.borderSubtle}`,
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
    color: 'var(--color-text, #2a2118)',
  },
  kbd: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    color: 'var(--color-text-secondary, #6b5d48)',
    background: 'var(--color-surface, #f7f2ea)',
    border: `1px solid ${tok.border}`,
    borderRadius: 3,
    lineHeight: '18px',
  },
};
