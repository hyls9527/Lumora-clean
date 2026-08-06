import { t as tok } from '../../lib/tokens';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCommandStore } from '../../stores/commandStore';
import { useTranslation } from '../../lib/i18n';
import { registerModal, unregisterModal, isTopModal } from '../../lib/modalStack';
import { parseIntent } from '../../lib/aiControl/parser';
import { capabilities } from '../../lib/aiControl/registry';
import type { RoutePath } from '../../routes';

export function CommandPalette({ navigate }: { navigate: (path: RoutePath) => void }) {
  const { isOpen, close, commands } = useCommandStore();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'command' | 'ai'>('command');
  const [aiInput, setAiInput] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const modalIdRef = useRef<string | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
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
    setAiInput('');
    setAiResult(null);
    setAiError(null);
    setAiRunning(false);
    setSelectedIndex(0);
    close();
  }, [close]);

  const aiIntent = mode === 'ai' ? parseIntent(aiInput, capabilities) : null;

  const runAi = useCallback(async () => {
    if (!aiIntent || aiRunning) return;
    const cap = capabilities.find((c) => c.id === aiIntent.capabilityId);
    if (!cap) return;
    setAiRunning(true);
    setAiError(null);
    setAiResult(null);
    try {
      const message = await cap.execute(aiIntent.params, { navigate });
      setAiResult(message);
      setTimeout(() => resetAndClose(), 1800);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiRunning(false);
    }
  }, [aiIntent, aiRunning, navigate, resetAndClose]);

  useEffect(() => {
    if (isOpen) {
      modalIdRef.current = registerModal();
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      inputRef.current?.focus();
    }
    return () => {
      if (modalIdRef.current) {
        unregisterModal(modalIdRef.current);
        modalIdRef.current = null;
        restoreFocusRef.current?.focus?.();
        restoreFocusRef.current = null;
      }
    };
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
      if (modalIdRef.current && isTopModal(modalIdRef.current)) {
        resetAndClose();
      }
    } else if (e.key === 'Tab') {
      const root = panelRef.current;
      if (!root) return;
      const els = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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

  const inputValue = mode === 'command' ? query : aiInput;
  const onInputChange = (value: string) => {
    if (mode === 'command') setQuery(value);
    else setAiInput(value);
  };

  return (
    <div style={styles.overlay} onClick={resetAndClose}>
      <div
        ref={panelRef}
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Mode tabs */}
        <div style={styles.modeTabs}>
          <button
            type="button"
            onClick={() => setMode('command')}
            style={{
              ...styles.modeTab,
              color: mode === 'command' ? 'var(--color-accent, #7a5c12)' : 'var(--color-text-muted, #a09480)',
              borderBottom: mode === 'command' ? '2px solid var(--color-accent, #7a5c12)' : '2px solid transparent',
            }}
          >
            {t('modeCommand')}
          </button>
          <button
            type="button"
            onClick={() => setMode('ai')}
            style={{
              ...styles.modeTab,
              color: mode === 'ai' ? 'var(--color-accent, #7a5c12)' : 'var(--color-text-muted, #a09480)',
              borderBottom: mode === 'ai' ? '2px solid var(--color-accent, #7a5c12)' : '2px solid transparent',
            }}
          >
            {t('modeAi')}
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={mode === 'command' ? t('placeholder') : t('aiPlaceholder')}
          style={styles.input}
          aria-label={t('ariaLabel')}
        />
        {mode === 'command' ? (
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
        ) : (
          <div style={styles.list}>
            {!aiInput.trim() ? (
              <div style={styles.aiHint}>{t('aiExamples')}</div>
            ) : aiResult ? (
              <div style={styles.aiResult}>{aiResult}</div>
            ) : aiError ? (
              <div style={styles.aiError}>{aiError}</div>
            ) : aiIntent ? (
              <div style={styles.aiCard}>
                <div style={styles.aiCapName}>
                  {capabilities.find((c) => c.id === aiIntent.capabilityId)?.name}
                </div>
                <div style={styles.aiPreview}>{aiIntent.preview}</div>
                <button
                  type="button"
                  onClick={() => void runAi()}
                  disabled={aiRunning}
                  style={styles.aiRun}
                >
                  {aiRunning ? t('aiLoading') : t('aiRun')}
                </button>
              </div>
            ) : (
              <div style={styles.empty}>{t('aiNoMatch')}</div>
            )}
          </div>
        )}
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
  modeTabs: {
    display: 'flex',
    gap: 16,
    padding: '10px 16px 0',
  },
  modeTab: {
    padding: '0 2px 8px',
    fontSize: 11,
    fontFamily: 'inherit',
    fontWeight: 600,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'color 200ms ease-out, border-color 200ms ease-out',
  },
  panel: {
    width: 'min(520px, 90vw)',
    maxHeight: 'min(420px, 80vh)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--color-surface, #f7f2ea)',
    border: `1px solid ${tok.border}`,
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
    borderBottom: `1px solid ${tok.border}`,
    outline: 'none',
    boxSizing: 'border-box',
  },
  aiHint: {
    padding: '20px 16px',
    fontSize: 12,
    lineHeight: 1.7,
    color: 'var(--color-text-muted, #a09480)',
  },
  aiCard: {
    padding: '16px',
  },
  aiCapName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text, #2a2118)',
    marginBottom: 6,
  },
  aiPreview: {
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--color-text-secondary, #6b5d48)',
    marginBottom: 12,
  },
  aiRun: {
    padding: '7px 20px',
    fontSize: 12,
    fontFamily: 'inherit',
    fontWeight: 600,
    color: '#f2ede4',
    background: 'var(--color-accent, #7a5c12)',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  aiResult: {
    padding: '20px 16px',
    fontSize: 13,
    color: 'var(--color-success, #4a7a3a)',
  },
  aiError: {
    padding: '20px 16px',
    fontSize: 13,
    color: 'var(--color-danger, #8b3030)',
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
    border: `1px solid ${tok.border}`,
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
