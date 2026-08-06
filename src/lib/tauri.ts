/**
 * Safe Tauri invoke wrapper.
 * Returns mock data in browser. Delegates to real API in Tauri webview.
 * NEVER imports @tauri-apps/api at module level — only via dynamic import when isTauri=true.
 */

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const WRITE_COMMANDS = new Set([
  'import_images', 'update_rating', 'toggle_favorite',
  'soft_delete_image', 'restore_image', 'permanent_delete_image',
  'empty_trash', 'create_tag', 'delete_tag', 'update_tag',
  'add_tag_to_image', 'remove_tag_from_image',
  'batch_soft_delete', 'batch_restore', 'batch_permanent_delete',
  'batch_add_tag', 'batch_remove_tag',
  'generate_embedding', 'generate_embedding_for_image_cmd',
  'analyze_image_cmd', 'apply_ai_tags_cmd',
  'rebuild_fts_index',
  'import_database',
  'batch_convert',
  'score_missing_cmd',
]);

/** Registered callbacks invoked after write commands. */
const writeListeners: Array<() => void> = [];

/** Register a callback to be invoked after any write command completes. */
export function onWriteCommand(cb: () => void): () => void {
  writeListeners.push(cb);
  return () => {
    const idx = writeListeners.indexOf(cb);
    if (idx >= 0) writeListeners.splice(idx, 1);
  };
}

function notifyWriteListeners() {
  for (const cb of writeListeners) {
    Promise.resolve().then(cb);
  }
}

function mockResponse(cmd: string): unknown {
  if (['list_images', 'list_images_filtered', 'list_trash'].includes(cmd))
    return { items: [], total: 0, page: 1, perPage: 40 };
  if (cmd === 'batch_rename')
    return { items: [], renamed: 0, skipped: 0, errors: 0 };
  if (cmd === 'import_images')
    return { items: [], imported: 0, skipped: 0, totalScanned: 0 };
  if (['list_tags', 'search_images', 'get_image_tags', 'list_favorites'].includes(cmd))
    return [];
  if (cmd === 'get_dashboard_stats')
    return { totalImages: 0, totalSizeKb: 0, formatCounts: [], ratingCounts: [], topTags: [], recentImports: [] };
  if (cmd === 'export_images')
    return { successCount: 0, failCount: 0, targetDir: '' };
  if (cmd === 'batch_convert')
    return { items: [], converted: 0, skipped: 0, failed: 0 };
  if (cmd === 'get_embedding_status_cmd')
    return { status: 'pending', dimensions: null, generatedAt: null };
  if (cmd === 'get_analysis_result_cmd')
    return null;
  if (cmd === 'is_directory')
    return false;
  if (cmd === 'get_analysis_history_cmd')
    return [];
  if (
    cmd === 'search_images_advanced' ||
    cmd === 'search_semantic_cmd' ||
    cmd === 'get_variant_group_images' ||
    cmd === 'embed_text_cmd' ||
    cmd === 'clip_embed_image_cmd' ||
    cmd === 'clip_embed_text_cmd'
  )
    return [];
  if (cmd === 'get_embedding_stats_cmd')
    return { embedded: 0, pending: 0, error: 0, total: 0, missing: 0 };
  if (cmd === 'embed_missing_cmd')
    return { processed: 0, remaining: 0 };
  if (cmd === 'score_missing_cmd')
    return { processed: 0, remaining: 0 };
  if (cmd === 'get_lan_info')
    return { ip: '127.0.0.1', port: 8079, token: 'mock-token' };
  if (cmd === 'get_app_version') return '0.8.0';
  if (cmd === 'create_tag')
    return { id: 'mock-tag', name: '', color: null, createdAt: '' };
  if (cmd === 'apply_ai_tags_cmd')
    return 0;
  if (cmd === 'export_database' || cmd === 'import_database')
    return '';
  if (cmd === 'get_ollama_host')
    return 'http://localhost:11434';
  if (cmd === 'check_ollama_status')
    return [false, 'Ollama 未运行'];
  return null;
}

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
let _realInvoke: InvokeFn | null = null;
let _loadAttempted = false;

/** User-friendly error messages for common Tauri command failures */
const ERROR_MESSAGES: Record<string, string> = {
  'score_missing_cmd': '审美评审失败',
  'list_images': '加载图片列表失败',
  'list_images_filtered': '加载图片列表失败',
  'batch_rename': '批量重命名失败',
  'import_images': '导入图片失败',
  'search_images': '搜索失败',
  'update_rating': '更新评分失败',
  'toggle_favorite': '更新收藏状态失败',
  'list_favorites': '加载收藏失败',
  'soft_delete_image': '删除图片失败',
  'restore_image': '恢复图片失败',
  'permanent_delete_image': '永久删除失败',
  'list_trash': '加载回收站失败',
  'empty_trash': '清空回收站失败',
  'create_tag': '创建标签失败',
  'delete_tag': '删除标签失败',
  'add_tag_to_image': '添加标签失败',
  'remove_tag_from_image': '移除标签失败',
  'get_dashboard_stats': '加载统计数据失败',
  'export_images': '导出图片失败',
  'batch_convert': '批量格式转换失败',
  'generate_embedding': '生成嵌入失败',
  'get_embedding_status_cmd': '获取嵌入状态失败',
  'search_semantic_cmd': '语义搜索失败',
  'embed_text_cmd': '语义搜索失败（嵌入服务不可用）',
  'clip_embed_image_cmd': '以图搜图失败（CLIP 不可用）',
  'analyze_image_cmd': 'AI 分析失败',
  'get_analysis_result_cmd': '获取分析结果失败',
  'get_analysis_history_cmd': '获取分析历史失败',
};

/** Wrap error with user-friendly message */
function wrapError(cmd: string, error: unknown): Error {
  const message = ERROR_MESSAGES[cmd] ?? `操作失败: ${cmd}`;
  const detail = error instanceof Error ? error.message : String(error);
  const wrapped = new Error(`${message}: ${detail}`);
  // Store original error for debugging (using Object.assign to avoid type issues)
  Object.assign(wrapped, { cause: error });
  return wrapped;
}

/** Retry config for read operations (write operations are never retried). */
const READ_RETRY_MAX = 3;
const READ_RETRY_BASE_DELAY_MS = 200;

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt a read invoke with retries on failure.
 * Only read commands are retried; write commands are passed through immediately.
 */
async function invokeWithRetry<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  maxRetries: number,
  baseDelayMs: number,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await _realInvoke!(cmd, args) as T;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * 2 ** attempt;
        // Log in development
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          console.warn(
            `[invoke] ${cmd} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
            error,
          );
        }
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

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

  if (_realInvoke) {
    const isWrite = WRITE_COMMANDS.has(cmd);

    try {
      const result = isWrite
        ? (await _realInvoke(cmd, args) as T)
        : await invokeWithRetry<T>(cmd, args ?? {}, READ_RETRY_MAX, READ_RETRY_BASE_DELAY_MS);

      if (isWrite) {
        // Fire-and-forget: don't block or alter return value
        Promise.resolve().then(() => notifyWriteListeners());
      }
      return result;
    } catch (error) {
      // Log in development
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.error(`[invoke] ${cmd} failed:`, error);
      }
      throw wrapError(cmd, error);
    }
  }

  const result = mockResponse(cmd) as T;
  if (WRITE_COMMANDS.has(cmd)) {
    Promise.resolve().then(() => notifyWriteListeners());
  }
  return result;
}

export { isTauri as isTauriAvailable };

/** Convert a local file path to a loadable URL via Tauri's asset protocol. */
export async function convertFileSrc(filePath: string): Promise<string> {
  if (!isTauri) return filePath;
  try {
    const mod = await import(/* @vite-ignore */ '@tauri-apps/api/core');
    return mod.convertFileSrc(filePath);
  } catch {
    return filePath;
  }
}
