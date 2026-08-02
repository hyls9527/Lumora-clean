/**
 * Online/offline status detection hook.
 * Tracks navigator.onLine and listens for 'online'/'offline' window events.
 */

import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  /** Force re-check navigator.onLine (useful after wake-from-sleep). */
  recheck: () => void;
}

export function useOnlineStatus(options?: { enabled?: boolean }): OnlineStatus {
  const enabled = options?.enabled ?? true;
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true; // SSR-safe default
  });

  const recheck = useCallback(() => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync initial state (belt-and-suspenders with useState initializer)
    recheck();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, recheck]);

  return { isOnline, recheck };
}
