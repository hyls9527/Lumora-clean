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
/** Last rounded percent pushed to the store; Progress fires per chunk. */
let lastProgress = -1;
/**
 * Underlying install() promise. A client-side timeout does not cancel the
 * Rust-side installer — joining this promise prevents spawning a second
 * installer process after "安装无响应".
 */
let installPromise: Promise<void> | null = null;

/** Give up on a download when no progress event arrives within 60s. */
const DOWNLOAD_STALL_TIMEOUT_MS = 60_000;
const DOWNLOAD_WATCHDOG_TICK_MS = 5_000;

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

function releaseHandle(handle: Update | null) {
  if (!handle) return;
  try {
    // close() returns a Promise in production; resolve-wrapping keeps mocks
    // or odd implementations from breaking resource cleanup.
    void Promise.resolve(handle.close()).catch(() => {});
  } catch {
    // never let resource cleanup throw
  }
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  ...initialState,

  checkForUpdates: async () => {
    if (get().checking) return;
    set({ checking: true, error: null });
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        const prev = updateHandle;
        if (prev && prev.version === update.version) {
          // Same version already tracked: keep its handle (and any finished
          // download bound to it), release the duplicate resource.
          releaseHandle(update);
          set({
            available: true,
            dismissed: false,
            hasChecked: true,
            updateInfo: { version: prev.version, body: prev.body ?? undefined },
          });
        } else {
          // New version (or first check this session): the old handle's
          // downloaded state is stale and must not leak into the new one.
          releaseHandle(prev);
          updateHandle = update;
          set({
            available: true,
            dismissed: false,
            hasChecked: true,
            downloading: false,
            downloaded: false,
            downloadProgress: null,
            updateInfo: {
              version: update.version,
              body: update.body ?? undefined,
            },
          });
        }
        // Silent background download (skipped automatically when finished).
        void get().downloadUpdate();
      } else {
        releaseHandle(updateHandle);
        updateHandle = null;
        set({
          available: false,
          updateInfo: null,
          hasChecked: true,
          downloading: false,
          downloaded: false,
          downloadProgress: null,
        });
      }
    } catch (err) {
      // Browser-mock mode has no updater backend; never surface errors there.
      // (Vite's DEV flag, not the hostname — production Tauri webviews run on
      // tauri://localhost / http://tauri.localhost, which a hostname check
      // wrongly swallows on macOS/Linux.)
      if (import.meta.env.DEV) return;
      set({
        // Mark checked so a failed automatic check isn't retried on every
        // mount; the manual check button stays available for explicit retry.
        hasChecked: true,
        error: err instanceof Error ? err.message : '检查更新失败',
      });
    } finally {
      set({ checking: false });
    }
  },

  downloadUpdate: async () => {
    const update = updateHandle;
    // Guard against duplicate downloads (double-mount, rapid re-click,
    // download-after-finished). Retry after an error stays allowed.
    if (!update || get().downloading || get().installing || get().downloaded) return;
    set({ downloading: true, error: null, downloadProgress: null });
    contentLength = null;
    received = 0;
    lastProgress = -1;

    let lastEventAt = Date.now();
    let abandoned = false;
    // Watchdog: system sleep or a dead socket can leave download() pending
    // forever with the UI stuck on "下载中" and no retry button. Abandon the
    // update after the stall timeout; late events from the zombie download
    // are ignored.
    const watchdog = setInterval(() => {
      if (Date.now() - lastEventAt > DOWNLOAD_STALL_TIMEOUT_MS) {
        abandoned = true;
        clearInterval(watchdog);
        set({
          downloading: false,
          error: '下载停滞（网络中断或系统休眠），请重试',
        });
      }
    }, DOWNLOAD_WATCHDOG_TICK_MS);

    try {
      await update.download((event: DownloadEvent) => {
        lastEventAt = Date.now();
        if (abandoned) return;
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? null;
          set({ downloadProgress: event.data.contentLength != null ? 0 : null });
        } else if (event.event === 'Progress') {
          received += event.data.chunkLength;
          const total = contentLength;
          if (total != null && total > 0) {
            const percent = Math.min(100, Math.round((received / total) * 100));
            // Emit only on change: Progress fires per chunk, and a setState
            // per chunk re-renders every subscribed surface needlessly.
            if (percent !== lastProgress) {
              lastProgress = percent;
              set({ downloadProgress: percent });
            }
          }
        } else if (event.event === 'Finished') {
          set({ downloading: false, downloadProgress: 100, downloaded: true });
        }
      });
      clearInterval(watchdog);
      if (abandoned) return; // watchdog already reported the stall
      set({ downloading: false, downloaded: true });
    } catch (err) {
      clearInterval(watchdog);
      if (abandoned) return;
      // Clear the stale percent too — a retry must not display the failed
      // attempt's progress before the next Started event arrives.
      set({ downloading: false, downloadProgress: null, error: err instanceof Error ? err.message : '下载更新失败' });
    }
  },

  installNow: async () => {
    // Join an in-flight install instead of invoking install() again — the
    // client-side timeout below does not cancel the Rust-side installer.
    if (installPromise) {
      await installPromise.catch(() => {});
      return;
    }
    const update = updateHandle;
    if (!update || !get().downloaded || get().installing) return;
    set({ installing: true, error: null });

    // The Rust side hands off to the NSIS installer and exits; if the
    // shell launch is blocked (antivirus, another instance) the promise
    // never settles. Time out and tell the user instead of hanging.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('安装无响应：安装器可能被拦截或需手动安装')),
        15000,
      );
    });

    const underlying = update.install();
    installPromise = underlying
      .then(async () => {
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      })
      .finally(() => {
        installPromise = null;
        set({ installing: false });
      });

    try {
      await Promise.race([installPromise, timeout]);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '重启安装失败' });
    } finally {
      clearTimeout(timer);
    }
  },

  dismiss: () => set({ dismissed: true }),

  reset: () => {
    releaseHandle(updateHandle);
    updateHandle = null;
    contentLength = null;
    received = 0;
    lastProgress = -1;
    installPromise = null;
    set({ ...initialState });
  },
}));
