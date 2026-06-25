/**
 * Safe Tauri invoke wrapper.
 * Returns mock data in browser. Delegates to real API in Tauri webview.
 * NEVER imports @tauri-apps/api at module level — only via dynamic import when isTauri=true.
 */

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function mockResponse(cmd: string): unknown {
  if (['list_images', 'list_trash', 'import_images'].includes(cmd))
    return { items: [], total: 0, page: 1, perPage: 40 };
  if (['list_tags', 'search_images', 'get_image_tags'].includes(cmd))
    return [];
  if (cmd === 'get_dashboard_stats')
    return { totalImages: 0, totalSizeKb: 0, formatCounts: [], ratingCounts: [], topTags: [], recentImports: [] };
  if (cmd === 'export_images')
    return { successCount: 0, failCount: 0, targetDir: '' };
  return null;
}

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
let _realInvoke: InvokeFn | null = null;
let _loadAttempted = false;

/** Drop-in replacement for `invoke` from `@tauri-apps/api/core` */
export async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // In Tauri context, lazily load the real invoke
  if (isTauri && !_loadAttempted) {
    _loadAttempted = true;
    try {
      const mod = await import(/* @vite-ignore */ '@tauri-apps/api/core');
      _realInvoke = mod.invoke as InvokeFn;
    } catch {
      // Failed to load — will use mock
    }
  }
  if (_realInvoke) return _realInvoke(cmd, args) as Promise<T>;
  return mockResponse(cmd) as T;
}

export { isTauri as isTauriAvailable };
