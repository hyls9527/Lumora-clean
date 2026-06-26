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
  if (cmd === 'get_embedding_status_cmd')
    return { status: 'pending', dimensions: null, generatedAt: null };
  if (cmd === 'get_analysis_result_cmd')
    return null;
  if (cmd === 'get_analysis_history_cmd')
    return [];
  return null;
}

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
let _realInvoke: InvokeFn | null = null;
let _loadAttempted = false;

/** User-friendly error messages for common Tauri command failures */
const ERROR_MESSAGES: Record<string, string> = {
  'list_images': '加载图片列表失败',
  'import_images': '导入图片失败',
  'search_images': '搜索失败',
  'update_rating': '更新评分失败',
  'toggle_favorite': '更新收藏状态失败',
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
  'generate_embedding': '生成嵌入失败',
  'get_embedding_status_cmd': '获取嵌入状态失败',
  'search_semantic_cmd': '语义搜索失败',
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
    try {
      return await _realInvoke(cmd, args) as T;
    } catch (error) {
      // Log in development
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        console.error(`[invoke] ${cmd} failed:`, error);
      }
      throw wrapError(cmd, error);
    }
  }

  return mockResponse(cmd) as T;
}

export { isTauri as isTauriAvailable };
