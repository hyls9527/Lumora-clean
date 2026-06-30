/**
 * Ollama availability detection hook.
 * Pings localhost:11434/api/tags every 60s.
 * Works in both browser and Tauri modes (direct HTTP, no invoke needed).
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const OLLAMA_BASE = import.meta.env.VITE_OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_URL = `${OLLAMA_BASE}/api/tags`;
const POLL_INTERVAL_MS = 60_000; // 60 seconds
const TIMEOUT_MS = 5_000; // 5 seconds

interface OllamaStatus {
  available: boolean;
  checking: boolean;
  error: string | null;
  recheck: () => void;
}

export function useOllamaStatus(options?: { enabled?: boolean }): OllamaStatus {
  const enabled = options?.enabled ?? true;
  const [available, setAvailable] = useState<boolean>(false); // Fix #5: start false
  const [checking, setChecking] = useState(enabled); // start checking only when enabled
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null); // Fix #1: track controller

  const check = useCallback(async () => {
    if (!mountedRef.current) return;

    // Abort any in-flight request (Fix #1)
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    setChecking(true);
    try {
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const resp = await fetch(OLLAMA_URL, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!mountedRef.current) return;

      if (resp.ok) {
        setAvailable(true);
        setError(null);
      } else {
        setAvailable(false);
        setError(`Ollama returned ${resp.status}`);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // Ignore aborted requests from previous check
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Only show timeout error if this controller wasn't replaced
        if (controllerRef.current === controller) {
          setAvailable(false);
          setError('Ollama 连接超时');
        }
      } else {
        setAvailable(false);
        setError('Ollama 未运行');
      }
    } finally {
      if (mountedRef.current && controllerRef.current === controller) {
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
      // Fix #1: abort in-flight request on unmount
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [check, enabled]);

  return { available, checking, error, recheck: check };
}
