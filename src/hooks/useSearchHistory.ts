import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'lumora:search-history';
const MAX_HISTORY = 20;

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, MAX_HISTORY));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save history to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage errors
    }
  }, [history]);

  const addHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      // Remove duplicates and add to top
      const filtered = prev.filter((item) => item !== trimmed);
      return [trimmed, ...filtered].slice(0, MAX_HISTORY);
    });
  }, []);

  const removeHistory = useCallback((query: string) => {
    setHistory((prev) => prev.filter((item) => item !== query));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    addHistory,
    removeHistory,
    clearHistory,
  };
}
