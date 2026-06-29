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
  downloaded: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export function useUpdater(): UpdaterState {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const updateRef = useRef<Update | null>(null);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
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
      // Silently fail in dev mode or network issues
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        // Dev mode — expected
      } else {
        setError(err instanceof Error ? err.message : '检查更新失败');
      }
    } finally {
      setChecking(false);
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!updateRef.current) {
      setError('没有可用的更新');
      return;
    }
    try {
      await updateRef.current.downloadAndInstall();
      setDownloaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '安装更新失败');
    }
  }, []);

  // Check on mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return {
    available,
    checking,
    downloaded,
    error,
    updateInfo,
    checkForUpdates,
    installUpdate,
  };
}
