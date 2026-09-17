# ARCHITECTURE.md — Lumora 系统架构

## 概述

Lumora 是一个 Tauri 2 桌面应用，采用前后端分离架构：
- **前端：** React 19 + TypeScript + Tailwind CSS v4 + Zustand 5
- **后端：** Rust (Tauri commands) + SQLite (rusqlite + FTS5 + sqlite-vec)
- **AI：** Ollama 或 OpenAI 兼容后端（`ai.provider` 嵌入 / `ai.vision_provider` 视觉分析，可独立切换；视觉索引 CLIP 512 维本地生成）

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Gallery  │  │  Search  │  │ Dashboard │  │ Settings │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│         │             │             │             │          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Zustand Stores                           │   │
│  │  imageStore | trashStore | settingsStore | ...        │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Layer (lib/api/)                      │   │
│  │  images.ts | ai.ts | embeddings.ts | semantic.ts      │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Cache Layer (lib/api/semanticCache.ts)    │   │
│  │  Map-based LRU | 30min TTL | 5MB eviction | debounce  │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Hooks                                    │   │
│  │  useOllamaStatus (60s poll) | useKeyboardNav | ...    │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Tauri Invoke Wrapper (lib/tauri.ts)       │   │
│  │  Browser mode: mock data | Tauri mode: real invoke    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ IPC (invoke)
┌─────────────────────────┴───────────────────────────────────┐
│                    Backend (Rust/Tauri)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Tauri Commands                            │   │
│  │  images | ai | embeddings | tags | trash | dashboard  │   │
│  │  export | settings | backup | clip | ollama          │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Database Layer (db/)                      │   │
│  │  SQLite + FTS5 + sqlite-vec | Migrations v1-v6       │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              External Services                         │   │
│  │  Ollama API (localhost:11434)                          │   │
│  │  - nomic-embed-text (embedding)                        │   │
│  │  - llava (image analysis)                              │   │
│  │  - /api/tags (health check, polled by useOllamaStatus) │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## MCP 接入（AI 可访问）

- 端点：`/mcp`（MCP Streamable HTTP），与局域网服务同端口、同 token 鉴权
- 实现：`src-tauri/src/mcp.rs`（rmcp + axum），挂载于 `lan_server::build_router`
- 工具：读取类 `list_images` / `search_images` / `get_image` / `get_image_file` / `list_tags` / `get_stats` / `semantic_search`；管理类 `create_tag` / `add_tag_to_image` / `remove_tag_from_image` / `toggle_favorite` / `move_to_trash` / `restore_from_trash`；评分不开放给 AI
- 客户端配置与说明：`docs/04-deploy/mcp.md`

## 数据模型

### SQLite Schema (v9)

```sql
-- v1: 图片表
CREATE TABLE images (
    id            TEXT PRIMARY KEY,
    file_path     TEXT NOT NULL UNIQUE,
    file_hash     TEXT NOT NULL,
    file_size_kb  INTEGER NOT NULL,
    width         INTEGER,
    height        INTEGER,
    format        TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    imported_at   TEXT NOT NULL DEFAULT (datetime('now')),
    deleted       INTEGER DEFAULT 0,
    rating        INTEGER DEFAULT 0,
    favorite      INTEGER DEFAULT 0,
    metadata_json TEXT,
    deleted_at    TEXT  -- v3
);

-- v2: 标签表
CREATE TABLE tags (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE image_tags (
    image_id TEXT NOT NULL REFERENCES images(id),
    tag_id   TEXT NOT NULL REFERENCES tags(id),
    PRIMARY KEY (image_id, tag_id)
);

-- v4: 嵌入表
CREATE TABLE embeddings (
    image_id     TEXT PRIMARY KEY REFERENCES images(id),
    embedding    BLOB NOT NULL,
    dimensions   INTEGER NOT NULL DEFAULT 512,
    status       TEXT NOT NULL DEFAULT 'embedded',
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE vec_embeddings USING vec0(
    image_id TEXT PRIMARY KEY,
    embedding float[768]
);

-- v5: AI 分析历史
CREATE TABLE analysis_history (
    id           TEXT PRIMARY KEY,
    image_id     TEXT NOT NULL REFERENCES images(id),
    result_json  TEXT NOT NULL,
    analyzed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- v6: 变体组（同 prompt 不同 seed 的图片）
CREATE TABLE IF NOT EXISTS variant_groups (
    id         TEXT PRIMARY KEY,
    prompt     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- images 表新增列（v6 migration）
-- ALTER TABLE images ADD COLUMN variant_group_id TEXT REFERENCES variant_groups(id);

-- v7: 智能收藏（规则驱动的自动分组）
CREATE TABLE IF NOT EXISTS smart_collections (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    rules_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- v8: 审美评分层（夯 / 稳 / 拉）
-- ALTER TABLE images ADD COLUMN hps_score REAL;
-- ALTER TABLE images ADD COLUMN hps_style TEXT;
-- ALTER TABLE images ADD COLUMN aesthetic_score REAL;
-- ALTER TABLE images ADD COLUMN scoring_model TEXT;
-- ALTER TABLE images ADD COLUMN scored_at TEXT;
-- ALTER TABLE images ADD COLUMN score_label TEXT;

-- v9: CLIP 图片嵌入索引（512 维），用于以图搜图。
-- 注意：文本语义索引（V4，768 维，Ollama nomic-embed-text）与 CLIP 视觉索引
-- 是两个独立向量空间 —— 模型输出维度不同，相似度只在同一空间内才有意义。
CREATE TABLE IF NOT EXISTS clip_embeddings (
    image_id     TEXT PRIMARY KEY REFERENCES images(id),
    embedding    BLOB NOT NULL,
    dimensions   INTEGER NOT NULL DEFAULT 512,
    status       TEXT NOT NULL DEFAULT 'embedded' CHECK(status IN ('embedded', 'pending', 'error')),
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings_clip USING vec0(
    image_id TEXT PRIMARY KEY,
    embedding float[512]
);

-- FTS5 全文搜索
CREATE VIRTUAL TABLE images_fts USING fts5(
    file_path,
    metadata_json,
    content='images',
    content_rowid='rowid'
);
```

## IPC 契约 (Tauri Commands)

### 图片管理

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `import_images` | `{ path: string }` | `ImportResult` | 导入文件夹/单文件图片 |
| `list_images` | `{ page: number, perPage: number }` | `{ items, total, page, perPage }` | 分页列表 |
| `search_images` | `{ query: string }` | `TauriImageRecord[]` | FTS5 全文搜索 |
| `update_rating` | `{ id: string, rating: number }` | `void` | 更新评分 |
| `toggle_favorite` | `{ id: string }` | `void` | 切换收藏 |
| `get_variant_group_images` | `{ variantGroupId: string }` | `TauriImageRecord[]` | 获取变体组图片 |
| `search_images_advanced` | `{ query: string, field?: string }` | `TauriImageRecord[]` | 字段范围搜索 |
| `list_favorites` | `{}` | `TauriImageRecord[]` | 收藏列表 |
| `rebuild_fts_index` | `{}` | `void` | 重建 FTS5 索引 |

### 标签

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `create_tag` | `{ name: string, color: string? }` | `TagRecord` | 创建标签 |
| `list_tags` | `{}` | `TagRecord[]` | 列出所有标签 |
| `delete_tag` | `{ id: string }` | `void` | 删除标签 |
| `update_tag` | `{ id: string, name?: string, color?: string }` | `void` | 更新标签 |
| `add_tag_to_image` | `{ imageId: string, tagId: string }` | `void` | 添加标签到图片 |
| `remove_tag_from_image` | `{ imageId: string, tagId: string }` | `void` | 移除图片标签 |
| `get_image_tags` | `{ imageId: string }` | `TagRecord[]` | 获取图片标签 |

### 回收站

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `soft_delete_image` | `{ id: string }` | `void` | 软删除 |
| `restore_image` | `{ id: string }` | `void` | 恢复 |
| `permanent_delete_image` | `{ id: string }` | `void` | 永久删除 |
| `list_trash` | `{ page: number, perPage: number }` | `{ items, total, page, perPage }` | 回收站列表 |
| `empty_trash` | `{}` | `number` | 清空回收站 |
| `batch_soft_delete` | `{ ids: string[] }` | `number` | 批量软删除 |
| `batch_restore` | `{ ids: string[] }` | `number` | 批量恢复 |
| `batch_permanent_delete` | `{ ids: string[] }` | `number` | 批量永久删除 |
| `batch_add_tag` | `{ imageIds: string[], tagId: string }` | `number` | 批量添加标签 |
| `batch_remove_tag` | `{ imageIds: string[], tagId: string }` | `number` | 批量移除标签 |

### AI 分析

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `analyze_image_cmd` | `{ imageId, imagePath, model? }` | `AnalysisResult` | AI 分析图片 |
| `get_analysis_result_cmd` | `{ imageId: string }` | `AnalysisResult?` | 获取最新分析 |
| `get_analysis_history_cmd` | `{ imageId: string }` | `AnalysisHistoryItem[]` | 分析历史 |
| `apply_ai_tags_cmd` | `{ imageId: string }` | `number` | AI 自动标注 |

### 嵌入与语义搜索

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `generate_embedding` | `{ imageId, embedding: number[] }` | `void` | 存储嵌入 |
| `get_embedding_status_cmd` | `{ imageId: string }` | `EmbeddingInfo?` | 嵌入状态 |
| `search_semantic_cmd` | `{ queryEmbedding: number[], limit? }` | `SemanticSearchResult[]` | 语义搜索 |
| `get_embedding_stats_cmd` | `{}` | `EmbeddingStats` | 嵌入统计 |
| `embed_text_cmd` | `{ text: string, model? }` | `number[]` | 文本→向量 |
| `generate_embedding_for_image_cmd` | `{ imageId, description, model? }` | `void` | 生成图片嵌入 |
| `clip_embed_image_cmd` | `{ imagePath: string }` | `number[]` | CLIP 图片嵌入 |
| `clip_embed_text_cmd` | `{ text: string }` | `number[]` | CLIP 文本嵌入 |

### 其他

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `get_dashboard_stats` | `{}` | `DashboardStats` | 仪表盘统计 |
| `export_images` | `{ ids, destDir, format, renameTemplate? }` | `ExportResult` | 导出图片 |
| `get_setting` | `{ key: string }` | `string?` | 获取设置 |
| `set_setting` | `{ key: string, value: string }` | `void` | 设置值 |
| `check_ollama_status` | `{}` | `[boolean, string?]` | Ollama 状态检查 |
| `get_ollama_host` | `{}` | `string` | 获取 Ollama 地址 |
| `export_database` | `{ destination: string }` | `string` | 导出数据库 |
| `import_database` | `{ source: string }` | `string` | 导入数据库（活动连接内 Online Backup，不换文件） |
| `get_crash_stats` | `{}` | `{ panics, logPath }` | 本次运行的 panic 计数与 crash.log 位置 |
| `get_backup_status` | `{}` | `{ snapshots, directory, intervalSeconds, retain, lastError, newest }` | 自动快照状态（RPO） |
| `create_backup_now` | `{}` | `string` | 立即写一份快照 |

## 测试与度量架构

```
前端 (vitest + jsdom)     113 个测试文件 / 972 个用例    覆盖率门禁 80%（实测 87.8% 语句、81.4% 分支）
├── src/**/__tests__/      stores · lib/api · lib/aiControl · components/ui · features/*
├── src/lib/__tests__/     reliability.test.ts（会话/崩溃计数）、tauri.test.ts（invoke 契约）
└── src/features/settings/ HealthPanel 备份/稳定性面板

Rust (cargo test --lib)   272 个用例（269 通过 / 3 ignored，ignored 需本地 Ollama）
├── commands::*/tests      图片·标签·回收站·嵌入·AI·导出·备份·智能收藏
├── auto_backup::tests     快照完整性 / WAL 未 checkpoint 数据 / 保留策略 / RTO 演练
├── crash_log::tests       panic hook 记录 JSON 行 / 超大日志轮转
├── sidecar::tests         超时杀进程树 / 输出捕获 / 非零退出码
└── perf_bench             10k 图库 9 条读路径 p50/p95/p99（--ignored 显式运行）

E2E (Playwright)          core（导航/首启/主题/命令面板/语义搜索）
├── perf-load.spec.ts      TC-PERF-001 页面加载 <2s（跑生产构建，串行，避免争用）
└── perf-scroll.spec.ts    TC-PERF-002 10k 图片虚拟滚动 p95 ≥30fps
```

## 可靠性设施

| 设施 | 位置 | 作用 |
|---|---|---|
| 崩溃采集 | `src-tauri/src/crash_log.rs` | panic hook 写 `crash.log`（JSON 行，1MiB 后保留最新一半），`get_crash_stats` 暴露计数 |
| 会话/崩溃率 | `src/lib/reliability.ts` | 每次启动计一个会话，会话内首次异常才计一次崩溃 → 崩溃率可算 |
| 自动快照 | `src-tauri/src/auto_backup.rs` | 每 10 分钟一次、保留 6 份，走 SQLite Online Backup API（RPO <15min） |
| sidecar 看护 | `src-tauri/src/sidecar.rs` | 所有 Python sidecar 调用带超时，超时杀整棵进程树 |
| 恢复演练 | `scripts/restore-drill.mjs` | 全损 → 快照恢复 → `integrity_check`，输出 RTO 实测 |

验收对照与证据：`docs/05-qa/14-商业级交付验收矩阵.md`。

## 构建产物

构建产物通过 GitHub Actions 自动生成，文件名包含版本号（如 `lumora_0.5.1_x64-setup.exe`）。
