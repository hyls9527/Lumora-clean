/**
 * Auto-updater hook.
 * Checks GitHub Releases for new versions via Tauri updater plugin.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';

interface UpdateInfo {
  version: string;
  body?: string;
}

interface UpdaterState {
  available: boolean;
  checking: boolean;
  installing: boolean;
  downloaded: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export function useUpdater(): UpdaterState {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const updateRef = useRef<Update | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!mountedRef.current) return;
    setChecking(true);
    setError(null);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!mountedRef.current) return;
      if (update) {
        updateRef.current = update;
        setAvailable(true);
        setUpdateInfo({
          version: update.version,
          body: update.body ?? undefined,
        });
      } else {
        setAvailable(false);
        setUpdateInfo(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return;
      setError(err instanceof Error ? err.message : '检查更新失败');
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!updateRef.current || installing) return;
    setInstalling(true);
    setError(null);
    try {
      await updateRef.current.downloadAndInstall();
      if (mountedRef.current) setDownloaded(true);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : '安装更新失败');
      }
    } finally {
      if (mountedRef.current) setInstalling(false);
    }
  }, [installing]);

  // Check on mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return {
    available,
    checking,
    installing,
    downloaded,
    error,
    updateInfo,
    checkForUpdates,
    installUpdate,
  };
}
