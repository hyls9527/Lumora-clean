import { useState, useCallback, useRef, useEffect } from 'react';
import { useSemanticSearchStore, type SearchMode } from '../../stores/semanticSearchStore';
import { useTranslation } from '../../lib/i18n';
import { t as tok } from '../../lib/tokens';

export function SemanticSearchBar() {
  const { t } = useTranslation('search');
  const {
    query,
    mode,
    suggestions,
    showSuggestions,
    loading,
    setQuery,
    setMode,
    search,
    fetchSuggestions,
    clearSuggestions,
    setShowSuggestions,
  } = useSemanticSearchStore();

  const [inputValue, setInputValue] = useState(query);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowSuggestions]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      setQuery(val);

      // Debounced suggestions
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        if (mode === 'semantic' && val.trim()) {
          fetchSuggestions(val);
        } else {
          clearSuggestions();
        }
      }, 200);
      setDebounceTimer(timer);
    },
    [mode, debounceTimer, setQuery, fetchSuggestions, clearSuggestions],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        setShowSuggestions(false);
        search();
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    [search, setShowSuggestions],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setInputValue(suggestion);
      setQuery(suggestion);
      setShowSuggestions(false);
      search(suggestion);
    },
    [setQuery, setShowSuggestions, search],
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    setQuery('');
    clearSuggestions();
  }, [setQuery, clearSuggestions]);

  const handleModeSwitch = useCallback(
    (newMode: SearchMode) => {
      setMode(newMode);
      clearSuggestions();
      if (newMode === 'exact') {
        setShowSuggestions(false);
      }
    },
    [setMode, clearSuggestions, setShowSuggestions],
  );

  return (
    <section aria-label={t('searchInput')} style={{ marginBottom: 24 }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
        <ModeButton
          active={mode === 'exact'}
          onClick={() => handleModeSwitch('exact')}
          label={t('exactMatch')}
        />
        <ModeButton
          active={mode === 'semantic'}
          onClick={() => handleModeSwitch('semantic')}
          label={t('semanticMode')}
        />
      </div>

      {/* Search input with suggestions */}
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (mode === 'semantic' && inputValue.trim() && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={mode === 'semantic' ? t('describeContent') : t('exactMatchPlaceholder')}
            aria-label={mode === 'semantic' ? t('semanticSearchInput') : t('exactMatchInput')}
            style={{
              width: '100%',
              padding: '14px 110px 14px 20px',
              fontSize: 15,
              fontFamily: tok.fontBody,
              color: tok.text,
              background: 'var(--color-surface)',
              border: '1px solid rgba(139, 115, 75, 0.10)',
              borderRadius: 4,
              outline: 'none',
              transition: 'border-color 200ms, box-shadow 200ms',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  width: 32,
                  height: 32,
                  fontSize: 16,
                  color: tok.textSecondary,
                  background: 'none',
                  border: '1px solid rgba(139, 115, 75, 0.10)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'color 200ms, border-color 200ms',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label={t('clearSearch')}
              >
                ×
              </button>
            )}
            <button
              type="button"
              onClick={() => search()}
              disabled={loading}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: tok.fontDisplay,
                color: tok.bg,
                background: loading ? tok.textMuted : tok.accent,
                border: 'none',
                borderRadius: 4,
                cursor: loading ? 'wait' : 'pointer',
                transition: 'background 200ms',
              }}
              aria-label={t('search')}
            >
              {loading ? t('searching') : t('search')}
            </button>
          </div>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'var(--color-surface)',
              border: '1px solid rgba(139, 115, 75, 0.10)',
              borderRadius: 4,
              boxShadow:
                'rgba(139,115,75,0.12) 0px 0px 0px 1px, rgba(78,50,23,0.12) 0px 8px 32px',
              zIndex: 50,
              overflow: 'hidden',
              animation: 'fadeIn 200ms ease-out',
            }}
          >
            {suggestions.map((s, i) => (
              <div
                key={s}
                role="option"
                tabIndex={0}
                onClick={() => handleSuggestionClick(s)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSuggestionClick(s);
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: 13,
                  fontFamily: tok.fontBody,
                  color: tok.text,
                  cursor: 'pointer',
                  borderBottom:
                    i < suggestions.length - 1
                      ? '1px solid rgba(139, 115, 75, 0.05)'
                      : 'none',
                  transition: 'background 200ms',
                  background: 'transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Empty state hint */}
      {!inputValue && mode === 'semantic' && (
        <p
          style={{
            fontSize: 12,
            color: tok.textMuted,
            fontFamily: tok.fontBody,
            marginTop: 12,
            textAlign: 'center',
            transition: 'opacity 200ms',
          }}
        >
          {t('describeHint')}
        </p>
      )}
    </section>
  );
}

/* --- Sub-components --- */

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0 0 8px',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: tok.fontDisplay,
        color: active ? tok.accent : tok.textSecondary,
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${active ? tok.accent : 'transparent'}`,
        cursor: 'pointer',
        transition: 'color 200ms, border-color 200ms',
        marginRight: 24,
      }}
    >
      {label}
    </button>
  );
}
