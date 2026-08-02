# 错误恢复 — 自动重试 + 离线提示

> **v0.8.0** | P2 | 预估 1 天

## 目标

1. 图片加载失败自动重试（增强现有机制）
2. 所有读操作 API 调用统一重试
3. 离线状态检测 + 全局提示

## 设计

### 模块一：`src/lib/tauri.ts` — invoke 层加重试

现有 `invoke()` 包装加读操作重试逻辑：

```ts
// 读操作命令列表（只对这些命令重试，写命令不重试）
const READ_COMMANDS = [
  'list_images', 'list_images_filtered', 'search_images',
  'search_images_advanced', 'list_favorites', 'get_variant_group_images',
  'get_image_base64_cmd', 'get_thumbnail_base64_cmd',
  'get_dashboard_stats', 'list_trash', 'list_tags', 'get_image_tags',
  'get_setting', 'get_analysis_result_cmd', 'get_analysis_history_cmd',
  'get_embedding_status_cmd', 'get_embedding_stats_cmd',
  'check_ollama_status', 'get_lan_info',
];

async function invokeWithRetry<T>(cmd: string, args?: Record<string, unknown>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await actualInvoke<T>(cmd, args);
    } catch (err) {
      if (attempt < maxRetries && READ_COMMANDS.includes(cmd)) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000); // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw wrapError(cmd, err);
    }
  }
  throw new Error('unreachable');
}
```

- 读命令：最多重试 2 次（共 3 次尝试），指数退避 1s/2s/4s
- 写命令（update_rating, toggle_favorite, import_images, batch_rename 等）：不重试

### 模块二：`src/hooks/useImageSrc.ts` — 指数退避增强

将现有线性延迟（1s, 2s）改为指数退避（1s, 2s, 4s）：

```ts
const RETRY_DELAY_MS = 1000;
// 改为: delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1)
// attempt=1: 1s, attempt=2: 2s, attempt=3: 4s
```

同时增加 `onError` 回调，供调用方展示 fallback UI。

### 模块三：离线检测 + 提示

**`src/hooks/useOnlineStatus.ts`**:

```ts
function useOnlineStatus(): { online: boolean; checking: boolean } {
  const [online, setOnline] = useState(navigator.onLine);
  // 监听 window online/offline 事件
  // 不主动 ping 后端 — API 调用失败时由调用方触发连通性检查
  // 返回 online + checking 状态
}
```

检测策略：
- **被动检测**：`window.online` / `window.offline` 事件
- **按需检测**：API 调用失败时，调用方可调用 `checkConnectivity()` 确认是否真正离线
- **不主动 ping**：避免定时请求开销

**`src/components/ui/OfflineBanner.tsx`**:

全局顶部 banner，监听 `useOnlineStatus`：
- 离线时：显示「网络连接已断开」黄色横幅
- 恢复时：3s 后自动消失
- 固定在页面顶部，z-index 高于导航

### 边界情况

| 场景 | 处理 |
|------|------|
| 网络短暂波动 | 重试 2 次（共 3 次），大多数瞬时故障可恢复 |
| 后端服务不可用（Ollama 挂了） | 重试耗尽后抛出正常错误，不特殊处理 |
| 写操作失败 | 不重试，立即抛出（防止重复扣减、重复导入） |
| 离线时用户操作 | 离线 banner 提示，操作失败抛出正常错误 |
| 重复性 4xx/5xx | 重试无意义但仍会重试（与读操作一致） |

## 执行计划（三路并行）

```
Phase 1 ─────────────────────────────────────
  Agent A: src/lib/tauri.ts — invoke 加读操作重试 + 测试
  Agent B: src/hooks/useImageSrc.ts — 指数退避 + 测试
  Agent C: src/hooks/useOnlineStatus.ts + OfflineBanner.tsx + 测试

Phase 2 (全部完成后) ─────────────────────────
  全量测试 + 集成验证
```
