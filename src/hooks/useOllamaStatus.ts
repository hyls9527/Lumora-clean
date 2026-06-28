/**
 * Ollama availability detection hook.
 * Pings localhost:11434/api/tags every 60s.
 * Works in both browser and Tauri modes (direct HTTP, no invoke needed).
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const OLLAMA_URL = 'http://localhost:11434/api/tags';
const POLL_INTERVAL_MS = 60_000; // 60 seconds
const TIMEOUT_MS = 5_000; // 5 seconds

interface OllamaStatus {
  available: boolean;
  checking: boolean;
  error: string | null;
  recheck: () => void;
}

export function useOllamaStatus(): OllamaStatus {
  const [available, setAvailable] = useState<boolean>(true); // Assume available until proven otherwise
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    if (!mountedRef.current) return;
    setChecking(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const resp = await fetch(OLLAMA_URL, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (resp.ok) {
        setAvailable(true);
        setError(null);
      } else {
        setAvailable(false);
        setError(`Ollama returned ${resp.status}`);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setAvailable(false);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Ollama 连接超时');
      } else {
        setError('Ollama 未运行');
      }
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    check(); // Initial check

    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [check]);

  return { available, checking, error, recheck: check };
}
