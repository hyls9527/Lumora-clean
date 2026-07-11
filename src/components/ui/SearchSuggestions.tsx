import { useState, useEffect, useRef, useCallback } from 'react';
import { t as tok } from '../../lib/tokens';

interface SearchSuggestionsProps {
  query: string;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  visible: boolean;
}

export function SearchSuggestions({
  query,
  suggestions,
  onSelect,
  visible,
}: SearchSuggestionsProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            onSelect(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedIndex(-1);
          break;
      }
    },
    [visible, suggestions, selectedIndex, onSelect]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && containerRef.current) {
      const items = containerRef.current.querySelectorAll('[data-suggestion]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  // Filter suggestions based on query
  const filtered = query
    ? suggestions.filter((s) =>
        s.toLowerCase().includes(query.toLowerCase())
      )
    : suggestions;

  if (filtered.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Search suggestions"
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 10,
        maxHeight: 300,
        overflowY: 'auto',
        background: tok.surface,
        border: `1px solid ${tok.border}`,
        borderRadius: 4,
        boxShadow: tok.shadow,
        marginTop: 4,
      }}
    >
      {filtered.map((suggestion, index) => (
        <div
          key={suggestion}
          data-suggestion
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => onSelect(suggestion)}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            background:
              index === selectedIndex
                ? tok.surfaceHover
                : 'transparent',
            transition: 'background 200ms',
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span style={{ fontSize: 13, fontFamily: tok.fontBody, color: tok.text }}>
            {suggestion}
          </span>
        </div>
      ))}
    </div>
  );
}
