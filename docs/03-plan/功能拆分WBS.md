# 功能拆分 WBS — Lumora

> **审计原则**：每个 WBS 条目必须追溯到具体模块、文件、IPC 命令。

## 1. 模块划分

### 1.1 前端模块

| 模块 | 页面/组件 | Store | API | 测试数 |
|------|----------|-------|-----|--------|
| 图片库 | GalleryPage, ImageCard, DetailModal | imageStore | images.ts | 34 |
| 搜索 | SearchPage, SemanticSearchBar | imageSearchStore, semanticSearchStore | semantic.ts | 17 |
| 导入 | ImportPage, DropOverlay | imageStore | images.ts | 5 |
| 导出 | ExportPage | imageStore | images.ts | 0 |
| 标签 | TagManager | imageTagsStore | images.ts | 7 |
| 回收站 | TrashPage | trashStore | images.ts | 15 |
| 仪表盘 | DashboardPage | - | images.ts | 0 |
| 设置 | SettingsPage | settingsStore | settings.ts | 18 |
| 收藏夹 | FavoritesPage | imageStore | images.ts | 3 |
| AI 分析 | AiAnalysisSection, TagSuggestionCard | aiAnalysisStore | ai.ts | 11 |
| 嵌入 | EmbeddingBadge | embeddingStore | embeddings.ts | 9 |
| 命令面板 | CommandPalette | commandStore | - | 9 |
| 侧边栏 | Sidebar | - | - | 5 |

---

### 1.2 后端模块

| 模块 | 命令数 | 文件 | 测试数 |
|------|--------|------|--------|
| 图片管理 | 9 | commands/images/ | 10 |
| 标签 | 7 | commands/tags.rs | 4 |
| 回收站 | 10 | commands/trash.rs | 3 |
| AI 分析 | 4 | commands/ai.rs | 4 |
| 嵌入 | 6 | commands/embeddings.rs | 6 |
| CLIP | 2 | commands/clip.rs | 1 |
| 仪表盘 | 1 | commands/dashboard.rs | 0 |
| 导出 | 1 | commands/export.rs | 0 |
| 设置 | 2 | commands/settings.rs | 0 |
| 备份 | 2 | commands/backup.rs | 0 |
| LAN 服务器 | 1 | lan_server.rs | 2 |
| Ollama | 2 | ollama.rs | 0 |
| 元数据 | - | metadata/ | 12 |
| 数据库 | - | db/ | 4 |

---

## 2. 原子级功能拆分

### 2.1 图片管理

| WBS ID | 功能 | 前端 | 后端 | 依赖 |
|--------|------|------|------|------|
| IMG-001 | 导入文件夹 | ImportPage | import_images | - |
| IMG-002 | 拖拽导入 | DropOverlay | import_images | IMG-001 |
| IMG-003 | 分页列表 | GalleryPage | list_images | - |
| IMG-004 | 无限滚动 | LazyLoad | list_images | IMG-003 |
| IMG-005 | 排序（时间/评分/模型/大小） | imageStore | - | IMG-003 |
| IMG-006 | 模型过滤 | imageStore | - | IMG-003 |
| IMG-007 | Creator Mode | imageStore | - | IMG-003 |
| IMG-008 | Grid/List 视图 | imageStore | - | IMG-003 |
| IMG-009 | 更新评分 | Rating | update_rating | - |
| IMG-010 | 切换收藏 | ImageCard | toggle_favorite | - |
| IMG-011 | 收藏列表 | FavoritesPage | list_favorites | - |
| IMG-012 | 详情弹窗 | DetailModal | - | IMG-003 |
| IMG-013 | 键盘导航 | useKeyboardNav | - | IMG-003 |

---

### 2.2 搜索

| WBS ID | 功能 | 前端 | 后端 | 依赖 |
|--------|------|------|------|------|
| SCH-001 | FTS5 全文搜索 | SearchPage | search_images | - |
| SCH-002 | 高级搜索（按字段） | SearchAdvancedSettings | search_images_advanced | SCH-001 |
| SCH-003 | 语义搜索 | SemanticSearchBar | embed_text_cmd + search_semantic_cmd | - |
| SCH-004 | 以图搜图 | SearchPage | clip_embed_image_cmd + search_semantic_cmd | SCH-003 |
| SCH-005 | 相似度阈值 | SemanticSearchBar | - | SCH-003 |
| SCH-006 | 搜索缓存 | semanticCache | - | SCH-003 |

---

### 2.3 标签

| WBS ID | 功能 | 前端 | 后端 | 依赖 |
|--------|------|------|------|------|
| TAG-001 | 创建标签 | TagManager | create_tag | - |
| TAG-002 | 列出标签 | TagManager | list_tags | - |
| TAG-003 | 编辑标签 | TagManager | update_tag | TAG-001 |
| TAG-004 | 删除标签 | TagManager | delete_tag | TAG-001 |
| TAG-005 | 添加标签到图片 | DetailModal | add_tag_to_image | TAG-001 |
| TAG-006 | 移除图片标签 | DetailModal | remove_tag_from_image | TAG-005 |
| TAG-007 | 批量添加标签 | BatchToolbar | batch_add_tag | TAG-005 |
| TAG-008 | 批量移除标签 | BatchToolbar | batch_remove_tag | TAG-006 |

---

### 2.4 回收站

| WBS ID | 功能 | 前端 | 后端 | 依赖 |
|--------|------|------|------|------|
| TRASH-001 | 软删除 | ImageCard | soft_delete_image | - |
| TRASH-002 | 回收站列表 | TrashPage | list_trash | - |
| TRASH-003 | 恢复单张 | TrashPage | restore_image | TRASH-002 |
| TRASH-004 | 永久删除单张 | TrashPage | permanent_delete_image | TRASH-002 |
| TRASH-005 | 清空回收站 | TrashPage | empty_trash | TRASH-002 |
| TRASH-006 | 批量软删除 | BatchToolbar | batch_soft_delete | TRASH-001 |
| TRASH-007 | 批量恢复 | BatchToolbar | batch_restore | TRASH-003 |
| TRASH-008 | 批量永久删除 | BatchToolbar | batch_permanent_delete | TRASH-004 |

---

### 2.5 AI 分析

| WBS ID | 功能 | 前端 | 后端 | 依赖 |
|--------|------|------|------|------|
| AI-001 | AI 分析图片 | AiAnalysisSection | analyze_image_cmd | - |
| AI-002 | 获取分析结果 | AiAnalysisSection | get_analysis_result_cmd | AI-001 |
| AI-003 | 分析历史 | AnalysisHistoryList | get_analysis_history_cmd | AI-001 |
| AI-004 | 标签建议 | TagSuggestionCard | apply_ai_tags_cmd | AI-001 |
| AI-005 | 批量自动标签 | aiApi | batchAutoTag | AI-001 |
| AI-006 | Ollama 状态检查 | useOllamaStatus | check_ollama_status | - |

---

### 2.6 嵌入与语义搜索

| WBS ID | 功能 | 前端 | 后端 | 依赖 |
|--------|------|------|------|------|
| EMB-001 | 生成嵌入 | embeddingStore | generate_embedding_for_image_cmd | - |
| EMB-002 | 批量生成嵌入 | embeddingStore | generate_embedding_for_image_cmd | EMB-001 |
| EMB-003 | 嵌入状态查询 | EmbeddingBadge | get_embedding_status_cmd | - |
| EMB-004 | 嵌入统计 | DashboardPage | get_embedding_stats_cmd | - |
| EMB-005 | 语义搜索 | SemanticSearchBar | embed_text_cmd + search_semantic_cmd | EMB-001 |
| EMB-006 | CLIP 图片嵌入 | searchByImage | clip_embed_image_cmd | - |
| EMB-007 | CLIP 文本嵌入 | - | clip_embed_text_cmd | - |

---

### 2.7 导出

| WBS ID | 功能 | 前端 | 后端 | 依赖 |
|--------|------|------|------|------|
| EXP-001 | 批量导出 | ExportPage | export_images | - |
| EXP-002 | 模板命名 | ExportPage | - | EXP-001 |

---

### 2.8 设置与系统

| WBS ID | 功能 | 前端 | 后端 | 依赖 |
|--------|------|------|------|------|
| SYS-001 | 键值设置 | settingsStore | get_setting, set_setting | - |
| SYS-002 | 数据库备份 | SettingsPage | export_database | - |
| SYS-003 | 数据库恢复 | SettingsPage | import_database | SYS-002 |
| SYS-004 | LAN 服务器 | SettingsPage | get_lan_info | - |
| SYS-005 | 命令面板 | CommandPalette | - | - |
| SYS-006 | 国际化 | i18n | - | - |
| SYS-007 | 暗色主题 | tokens.ts | - | - |
| SYS-008 | 自动更新 | UpdateBanner | tauri-plugin-updater | - |

---

## 3. WBS 依赖图

```
IMG-001 (导入) ──→ IMG-002 (拖拽导入)
IMG-003 (列表) ──→ IMG-004 (无限滚动)
               ──→ IMG-005 (排序)
               ──→ IMG-006 (过滤)
               ──→ IMG-007 (Creator Mode)
               ──→ IMG-008 (视图切换)
               ──→ IMG-012 (详情弹窗)
               ──→ IMG-013 (键盘导航)

TAG-001 (创建) ──→ TAG-003 (编辑)
               ──→ TAG-004 (删除)
               ──→ TAG-005 (添加到图片)
TAG-005 ────────→ TAG-006 (移除)
               ──→ TAG-007 (批量添加)
TAG-006 ────────→ TAG-008 (批量移除)

TRASH-001 (软删除) ──→ TRASH-006 (批量软删除)
TRASH-002 (列表) ──→ TRASH-003 (恢复)
                 ──→ TRASH-004 (永久删除)
                 ──→ TRASH-005 (清空)
TRASH-003 ────────→ TRASH-007 (批量恢复)
TRASH-004 ────────→ TRASH-008 (批量永久删除)

AI-001 (分析) ──→ AI-002 (获取结果)
              ──→ AI-003 (历史)
              ──→ AI-004 (标签建议)
              ──→ AI-005 (批量标签)

EMB-001 (生成嵌入) ──→ EMB-002 (批量生成)
                  ──→ EMB-005 (语义搜索)
```

---

## 4. WBS 统计

| 分类 | WBS 数量 |
|------|----------|
| 图片管理 | 13 |
| 搜索 | 6 |
| 标签 | 8 |
| 回收站 | 8 |
| AI 分析 | 6 |
| 嵌入 | 7 |
| 导出 | 2 |
| 设置与系统 | 8 |
| **总计** | **58** |

---

*文档生成时间：基于 commit 69983af6*
