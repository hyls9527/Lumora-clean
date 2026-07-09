# ARCHITECTURE.md — Lumora 系统架构

## 概述

Lumora 是一个 Tauri 2 桌面应用，采用前后端分离架构：
- **前端：** React 19 + TypeScript + Tailwind CSS v4 + Zustand 5
- **后端：** Rust (Tauri commands) + SQLite (rusqlite + FTS5 + sqlite-vec)
- **AI：** Ollama (nomic-embed-text embedding + llava 图片分析)

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

## 数据模型

### SQLite Schema (v6)

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
| `import_database` | `{ source: string }` | `string` | 导入数据库 |

## 测试架构

```
前端测试 (vitest + jsdom)
├── stores/__tests__/
│   ├── imageStore.test.ts         (18 tests)
│   ├── trashStore.test.ts         (15 tests)
│   ├── settingsStore.test.ts      (16 tests)
│   ├── aiAnalysisStore.test.ts    (11 tests)
│   ├── embeddingStore.test.ts     (9 tests)
│   ├── semanticSearchStore.test.ts (12 tests)
│   ├── imageSearchStore.test.ts   (6 tests)
│   ├── imageTagsStore.test.ts     (7 tests)
│   └── smartCollectionStore.test.ts (4 tests)
├── lib/api/__tests__/
│   ├── images.test.ts             (16 tests)
│   ├── semanticCache.test.ts      (8 tests)
│   ├── write-commands.test.ts     (20 tests)
│   ├── type-contract.test.ts      (10 tests)
│   ├── toImageRecord.test.ts      (7 tests)
│   ├── searchByImage.test.ts      (5 tests)
│   └── batchAutoTag.test.ts       (5 tests)
└── components/ui/__tests__/
    ├── ErrorState.test.tsx         (4 tests)
    ├── ImageCard.test.tsx          (12 tests)
    ├── CommandPalette.test.tsx     (9 tests)
    ├── DetailModal.test.tsx        (12 tests)
    ├── design-compliance.test.ts   (16 tests)
    └── accessibility.test.ts       (12 tests)

Rust 测试 (cargo test --lib)
├── commands::images::tests       (10 tests)
├── commands::embeddings::tests   (6 tests)
├── commands::ai::tests           (4 tests)
├── commands::tags::tests         (4 tests)
├── commands::trash::tests        (3 tests)
├── commands::clip::tests         (1 test)
├── db::migrations::tests         (4 tests)
├── metadata::mod::tests          (4 tests)
├── metadata::png::tests          (2 tests)
└── metadata::sd::tests           (6 tests)
```

## 构建产物

构建产物通过 GitHub Actions 自动生成，文件名包含版本号（如 `lumora_0.5.1_x64-setup.exe`）。
