/**
 * Ollama availability detection hook.
 * Reads OLLAMA_HOST from Rust backend (single config source).
 * Pings /api/tags every 60s via direct HTTP.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '../lib/tauri';

const DEFAULT_HOST = 'http://localhost:11434';
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
  const [available, setAvailable] = useState<boolean>(false);
  const [checking, setChecking] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const hostRef = useRef<string>(DEFAULT_HOST);

  // Fetch Ollama host from Rust backend once on mount
  useEffect(() => {
    invoke<string>('get_ollama_host')
      .then((host) => {
        if (mountedRef.current) {
          hostRef.current = host || DEFAULT_HOST;
        }
      })
      .catch(() => {
        // Browser mode or invoke failed — use default
        hostRef.current = DEFAULT_HOST;
      });
  }, []);

  const check = useCallback(async () => {
    if (!mountedRef.current) return;

    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    setChecking(true);
    try {
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const url = `${hostRef.current}/api/tags`;

      const resp = await fetch(url, {
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
      if (err instanceof DOMException && err.name === 'AbortError') {
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
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [check, enabled]);

  return { available, checking, error, recheck: check };
}
