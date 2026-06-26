import { useState, useEffect, useRef, useCallback } from 'react';
import { useCommandStore } from '../../stores/commandStore';
import { useTranslation } from '../../lib/i18n';

export function CommandPalette() {
  const { isOpen, close, commands } = useCommandStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('commandPalette');

  const filtered = commands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q)
    );
  });

  const navigationCmds = filtered.filter((c) => c.section === 'navigation');
  const actionCmds = filtered.filter((c) => c.section === 'action');

  const resetAndClose = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    close();
  }, [close]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[selectedIndex]?.action();
      resetAndClose();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      resetAndClose();
    }
  };

  const renderSection = (label: string, items: typeof filtered) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div style={styles.sectionLabel}>{label}</div>
        {items.map((cmd) => {
          const idx = filtered.indexOf(cmd);
          return (
            <button
              key={cmd.id}
              type="button"
              style={{
                ...styles.item,
                background: idx === selectedIndex ? 'var(--color-surface-hover)' : 'transparent',
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => {
                cmd.action();
                resetAndClose();
              }}
            >
              <span style={styles.itemName}>{cmd.name}</span>
              <span style={styles.itemRight}>
                {cmd.shortcut && <kbd style={styles.kbd}>{cmd.shortcut}</kbd>}
                {cmd.description && <span style={styles.itemDesc}>{cmd.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={resetAndClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholder')}
          style={styles.input}
          aria-label={t('ariaLabel')}
        />
        <div ref={listRef} style={styles.list} role="listbox">
          {filtered.length === 0 ? (
            <div style={styles.empty}>{t('noResults')}</div>
          ) : (
            <>
              {renderSection(t('sectionNavigation'), navigationCmds)}
              {renderSection(t('sectionAction'), actionCmds)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
    background: 'rgba(42, 33, 24, 0.5)',
  },
  panel: {
    width: 520,
    maxHeight: 420,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-surface, #f7f2ea)',
    border: '1px solid rgba(139, 115, 75, 0.10)',
    borderRadius: 6,
    boxShadow: 'rgba(78,50,23,0.12) 0px 8px 32px, rgba(78,50,23,0.06) 0px 2px 8px',
    overflow: 'hidden',
    fontFamily: 'var(--font-body, "DM Sans", sans-serif)',
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '14px 16px',
    fontSize: 14,
    fontFamily: 'inherit',
    color: 'var(--color-text, #2a2118)',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(139, 115, 75, 0.10)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  sectionLabel: {
    padding: '8px 16px 4px',
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--color-text-muted, #a09480)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '8px 16px',
    fontSize: 13,
    fontFamily: 'inherit',
    color: 'var(--color-text, #2a2118)',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 200ms ease-out',
    boxSizing: 'border-box',
  },
  itemName: {
    fontWeight: 500,
  },
  itemRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  itemDesc: {
    fontSize: 11,
    color: 'var(--color-text-muted, #a09480)',
  },
  kbd: {
    display: 'inline-block',
    padding: '2px 6px',
    fontSize: 10,
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
    color: 'var(--color-text-secondary, #6b5d48)',
    background: 'var(--color-bg-alt, #ebe5d8)',
    border: '1px solid rgba(139, 115, 75, 0.10)',
    borderRadius: 3,
    lineHeight: '16px',
  },
  empty: {
    padding: '24px 16px',
    fontSize: 13,
    color: 'var(--color-text-muted, #a09480)',
    textAlign: 'center',
  },
};
