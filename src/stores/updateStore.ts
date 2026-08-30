/**
 * Global updater state (singleton).
 *
 * Both the sidebar UpdateBanner and the Settings "About" section render
 * update progress. State must be global so that exactly one check and one
 * download run per session and every surface shows identical progress —
 * previously each consumer held its own hook state and called
 * update.download() independently, downloading the installer twice with
 * divergent progress display.
 */

import { create } from 'zustand';
import type { Update, DownloadEvent } from '@tauri-apps/plugin-updater';

export interface UpdateInfo {
  version: string;
  body?: string;
}

/** Non-reactive per-session handles kept outside the store. */
let updateHandle: Update | null = null;
let contentLength: number | null = null;
let received = 0;

export interface UpdateState {
  available: boolean;
  checking: boolean;
  downloading: boolean;
  downloadProgress: number | null;
  installing: boolean;
  downloaded: boolean;
  dismissed: boolean;
  error: string | null;
  updateInfo: UpdateInfo | null;
  /** True once a check has completed; used to skip duplicate mount-time checks. */
  hasChecked: boolean;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installNow: () => Promise<void>;
  dismiss: () => void;
  /** Test-only: restore pristine state between tests. */
  reset: () => void;
}

const initialState = {
  available: false,
  checking: false,
  downloading: false,
  downloadProgress: null as number | null,
  installing: false,
  downloaded: false,
  dismissed: false,
  error: null as string | null,
  updateInfo: null as UpdateInfo | null,
  hasChecked: false,
};

export const useUpdateStore = create<UpdateState>((set, get) => ({
  ...initialState,

  checkForUpdates: async () => {
    if (get().checking) return;
    set({ checking: true, error: null });
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        updateHandle = update;
        set({
          available: true,
          dismissed: false,
          hasChecked: true,
          updateInfo: {
            version: update.version,
            body: update.body ?? undefined,
          },
        });
        // Silent background download once a new version is found.
        void get().downloadUpdate();
      } else {
        updateHandle = null;
        set({ available: false, updateInfo: null, hasChecked: true });
      }
    } catch (err) {
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') return;
      set({ error: err instanceof Error ? err.message : '检查更新失败' });
    } finally {
      set({ checking: false });
    }
  },

  downloadUpdate: async () => {
    const update = updateHandle;
    // Guard against duplicate downloads (double-mount, rapid re-click,
    // download-after-finished). Retry after an error stays allowed.
    if (!update || get().downloading || get().installing || get().downloaded) return;
    set({ downloading: true, error: null });
    contentLength = null;
    received = 0;
    try {
      await update.download((event: DownloadEvent) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? null;
          set({ downloadProgress: event.data.contentLength != null ? 0 : null });
        } else if (event.event === 'Progress') {
          received += event.data.chunkLength;
          const total = contentLength;
          if (total != null && total > 0) {
            const percent = Math.min(100, (received / total) * 100);
            set({ downloadProgress: Math.round(percent) });
          }
        } else if (event.event === 'Finished') {
          set({ downloading: false, downloadProgress: 100, downloaded: true });
        }
      });
      set({ downloading: false, downloaded: true });
    } catch (err) {
      set({ downloading: false, error: err instanceof Error ? err.message : '下载更新失败' });
    }
  },

  installNow: async () => {
    const update = updateHandle;
    if (!update || !get().downloaded || get().installing) return;
    set({ installing: true, error: null });
    try {
      // The Rust side hands off to the NSIS installer and exits; if the
      // shell launch is blocked (antivirus, another instance) the promise
      // never settles. Time out and tell the user instead of hanging.
      const TIMEOUT_MS = 15000;
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('安装无响应：安装器可能被拦截或需手动安装')), TIMEOUT_MS),
      );
      await Promise.race([update.install(), timeout]);
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '重启安装失败' });
    } finally {
      set({ installing: false });
    }
  },

  dismiss: () => set({ dismissed: true }),

  reset: () => {
    updateHandle = null;
    contentLength = null;
    received = 0;
    set({ ...initialState });
  },
}));
