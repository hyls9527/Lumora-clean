/**
 * Auto-updater hook.
 * Checks GitHub Releases for new versions via Tauri updater plugin.
 * Mirrors the desktop update flow used by Harness:
 * check on launch, show version + release notes, silently download in the
 * background with progress, then let the user restart-and-install or later.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Update, DownloadEvent } from '@tauri-apps/plugin-updater';

interface UpdateInfo {
  version: string;
  body?: string;
}

interface UpdaterState {
  available: boolean;
  checking: boolean;
  downloading: boolean;
  downloadProgress: number | null;
  installing: boolean;
  downloaded: boolean;
  dismissed: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installNow: () => Promise<void>;
  dismiss: () => void;
}

export function useUpdater(): UpdaterState {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [installing, setInstalling] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const updateRef = useRef<Update | null>(null);
  const mountedRef = useRef(true);
  const contentLengthRef = useRef<number | null>(null);
  const receivedRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const downloadUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update || downloading || installing) return;
    setDownloading(true);
    setError(null);
    contentLengthRef.current = null;
    receivedRef.current = 0;
    try {
      await update.download((event: DownloadEvent) => {
        if (!mountedRef.current) return;
        if (event.event === 'Started') {
          contentLengthRef.current = event.data.contentLength ?? null;
          setDownloadProgress(event.data.contentLength != null ? 0 : null);
        } else if (event.event === 'Progress') {
          receivedRef.current += event.data.chunkLength;
          const total = contentLengthRef.current;
          if (total != null && total > 0) {
            const percent = Math.min(100, (receivedRef.current / total) * 100);
            setDownloadProgress(Math.round(percent));
          }
        } else if (event.event === 'Finished') {
          setDownloading(false);
          setDownloadProgress(100);
          setDownloaded(true);
        }
      });
      if (mountedRef.current) {
        setDownloading(false);
        setDownloaded(true);
      }
    } catch (err) {
      if (mountedRef.current) {
        setDownloading(false);
        setError(err instanceof Error ? err.message : '下载更新失败');
      }
    }
  }, [downloading, installing]);

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
        setDismissed(false);
        setUpdateInfo({
          version: update.version,
          body: update.body ?? undefined,
        });
        // Silent background download once a new version is found.
        void downloadUpdate();
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
  }, [downloadUpdate]);

  const installNow = useCallback(async () => {
    const update = updateRef.current;
    if (!update || !downloaded || installing) return;
    setInstalling(true);
    setError(null);
    try {
      await update.install();
      if (!mountedRef.current) return;
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : '重启安装失败');
      }
    } finally {
      if (mountedRef.current) setInstalling(false);
    }
  }, [downloaded, installing]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Check on mount
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  return {
    available,
    checking,
    downloading,
    downloadProgress,
    installing,
    downloaded,
    dismissed,
    error,
    updateInfo,
    checkForUpdates,
    downloadUpdate,
    installNow,
    dismiss,
  };
}
