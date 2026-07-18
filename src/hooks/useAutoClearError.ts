import { useEffect, useRef } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';

type StoreWithError = UseBoundStore<StoreApi<{ error: string | null }>>;

/**
 * Auto-clear a store's error field after `ms` milliseconds.
 * Timer resets when error value changes — no conflicts.
 */
export function useAutoClearError(
  store: StoreWithError,
  ms = 5000,
): void {
  const error = store((s) => s.error);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (error) {
      timerRef.current = setTimeout(() => {
        store.setState({ error: null });
      }, ms);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [error, store, ms]);
}
