/**
 * Ollama availability detection hook.
 * Uses Rust backend `check_ollama_status` command (avoids CSP issues).
 * Polls every 60s.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '../lib/tauri';

const POLL_INTERVAL_MS = 60_000; // 60 seconds

interface OllamaStatus {
  available: boolean;
  checking: boolean;
  error: string | null;
  recheck: () => void;
}

export function useOllamaStatus(options?: { enabled?: boolean }): OllamaStatus {
  const enabled = options?.enabled ?? true;
  const [available, setAvailable] = useState<boolean>(false);
  const [checking, setChecking] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    if (!mountedRef.current) return;

    setChecking(true);
    try {
      const [ok, err] = await invoke<[boolean, string | null]>('check_ollama_status');
      if (!mountedRef.current) return;
      setAvailable(ok);
      setError(err);
    } catch (err) {
      if (!mountedRef.current) return;
      setAvailable(false);
      setError('Ollama 未运行');
    } finally {
      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setAvailable(false);
      setChecking(false);
      return;
    }

    check();

    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [check, enabled]);

  return { available, checking, error, recheck: check };
}
