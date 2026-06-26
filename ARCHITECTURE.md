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
│  │  export | settings                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Database Layer (db/)                      │   │
│  │  SQLite + FTS5 + sqlite-vec | Migrations v1-v5       │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              External Services                         │   │
│  │  Ollama API (localhost:11434)                          │   │
│  │  - nomic-embed-text (embedding)                        │   │
│  │  - llava (image analysis)                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 数据模型

### SQLite Schema (v5)

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
| `import_images` | `{ path: string }` | `TauriImageRecord[]` | 导入文件夹图片 |
| `list_images` | `{ page: number, perPage: number }` | `{ items, total, page, perPage }` | 分页列表 |
| `search_images` | `{ query: string }` | `TauriImageRecord[]` | FTS5 全文搜索 |
| `update_rating` | `{ id: string, rating: number }` | `void` | 更新评分 |
| `toggle_favorite` | `{ id: string }` | `void` | 切换收藏 |

### 标签

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `create_tag` | `{ name: string, color: string? }` | `TagRecord` | 创建标签 |
| `list_tags` | `{}` | `TagRecord[]` | 列出所有标签 |
| `delete_tag` | `{ id: string }` | `void` | 删除标签 |
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

### AI 分析

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `analyze_image_cmd` | `{ imageId, imagePath, model? }` | `AnalysisResult` | AI 分析图片 |
| `get_analysis_result_cmd` | `{ imageId: string }` | `AnalysisResult?` | 获取最新分析 |
| `get_analysis_history_cmd` | `{ imageId: string }` | `AnalysisHistoryItem[]` | 分析历史 |

### 嵌入与语义搜索

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `generate_embedding` | `{ imageId, embedding: number[] }` | `void` | 存储嵌入 |
| `get_embedding_status_cmd` | `{ imageId: string }` | `EmbeddingInfo?` | 嵌入状态 |
| `search_semantic_cmd` | `{ queryEmbedding: number[], limit? }` | `SemanticSearchResult[]` | 语义搜索 |
| `get_embedding_stats_cmd` | `{}` | `EmbeddingStats` | 嵌入统计 |
| `embed_text_cmd` | `{ text: string, model? }` | `number[]` | 文本→向量 |
| `generate_embedding_for_image_cmd` | `{ imageId, description, model? }` | `void` | 生成图片嵌入 |

### 其他

| Command | 参数 | 返回值 | 说明 |
|---------|------|--------|------|
| `get_dashboard_stats` | `{}` | `DashboardStats` | 仪表盘统计 |
| `export_images` | `{ ids, destDir, format, renameTemplate? }` | `ExportResult` | 导出图片 |
| `get_setting` | `{ key: string }` | `string?` | 获取设置 |
| `set_setting` | `{ key: string, value: string }` | `void` | 设置值 |

## 测试架构

```
前端测试 (vitest + jsdom)
├── stores/__tests__/
│   ├── imageStore.test.ts        (30 tests)
│   ├── trashStore.test.ts        (11 tests)
│   ├── settingsStore.test.ts     (13 tests)
│   ├── aiAnalysisStore.test.ts   (11 tests)
│   ├── embeddingStore.test.ts    (7 tests)
│   └── semanticSearchStore.test.ts (11 tests)
├── lib/api/__tests__/
│   └── images.test.ts            (15 tests)
└── components/ui/__tests__/
    ├── ErrorState.test.tsx        (4 tests)
    ├── ImageCard.test.tsx         (10 tests)
    ├── CommandPalette.test.tsx    (9 tests)
    ├── DetailModal.test.tsx       (10 tests)
    ├── design-compliance.test.ts  (16 tests)
    └── accessibility.test.ts      (12 tests)

Rust 测试 (cargo test --lib)
├── commands::images::tests       (5 tests)
├── commands::embeddings::tests   (6 tests)
├── commands::ai::tests           (4 tests)
└── db::migrations::tests         (3 tests)
```

## 构建产物

- `lumora_0.1.0_x64_en-US.msi` — Windows MSI 安装包
- `lumora_0.1.0_x64-setup.exe` — Windows NSIS 安装包
