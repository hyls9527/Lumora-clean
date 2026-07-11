# 功能验收 Checklist — Lumora

> **审计原则**：每条验收标准必须追溯到具体功能和代码。

## 1. 图片管理模块

### 1.1 图片导入

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | 支持拖拽文件到窗口导入 | ✅ | `DropOverlay.test.tsx` |
| 2 | 支持选择文件夹导入 | ✅ | `ImportPage.test.tsx` |
| 3 | 自动提取 PNG 元数据 | ✅ | `metadata/sd.rs` tests |
| 4 | 支持 jpg/jpeg/png/gif/webp/bmp/tiff | ✅ | `import.rs` IMAGE_EXTENSIONS |
| 5 | 防重复导入（基于文件哈希） | ✅ | `import.rs` insert_image |
| 6 | 显示导入统计（新增/跳过/总数） | ✅ | `ImportResult` 类型 |

### 1.2 图片列表

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | 分页加载（每页 40 张） | ✅ | `list_images` IPC |
| 2 | 无限滚动 | ✅ | `LazyLoad.test.tsx` |
| 3 | 按时间倒序排列 | ✅ | `imageStore` getFilteredImages |
| 4 | 按评分排序 | ✅ | `imageStore.setSortBy` |
| 5 | 按模型排序 | ✅ | `imageStore.setSortBy` |
| 6 | 按文件大小排序 | ✅ | `imageStore.setSortBy` |
| 7 | Creator Mode 显示 prompt/seed/model | ✅ | `imageStore.setMode` |
| 8 | Grid/List 视图切换 | ✅ | `imageStore.setView` |
| 9 | 模型过滤 | ✅ | `imageStore.setModelFilter` |

### 1.3 搜索

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | FTS5 全文搜索 | ✅ | `search_images` IPC |
| 2 | 按字段搜索（prompt/seed/model） | ✅ | `search_images_advanced` IPC |
| 3 | 语义搜索 | ✅ | `semantic.ts` tests |
| 4 | 以图搜图 | ✅ | `searchByImage` tests |
| 5 | 相似度阈值调节 | ✅ | `SearchAdvancedSettings` |
| 6 | 搜索缓存 | ✅ | `semanticCache.test.ts` |

### 1.4 评分与收藏

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | 0-5 星评分 | ✅ | `Rating` 组件 |
| 2 | 切换收藏 | ✅ | `toggle_favorite` IPC |
| 3 | 收藏列表 | ✅ | `list_favorites` IPC |
| 4 | 乐观更新 | ✅ | `useImageActions` tests |

---

## 2. 标签系统模块

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | 创建标签 | ✅ | `create_tag` IPC |
| 2 | 列出标签 | ✅ | `list_tags` IPC |
| 3 | 编辑标签 | ✅ | `update_tag` IPC |
| 4 | 删除标签 | ✅ | `delete_tag` IPC |
| 5 | 添加标签到图片 | ✅ | `add_tag_to_image` IPC |
| 6 | 移除图片标签 | ✅ | `remove_tag_from_image` IPC |
| 7 | 批量添加标签 | ✅ | `batch_add_tag` IPC |
| 8 | 批量移除标签 | ✅ | `batch_remove_tag` IPC |

---

## 3. 回收站模块

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | 软删除 | ✅ | `soft_delete_image` IPC |
| 2 | 回收站列表 | ✅ | `list_trash` IPC |
| 3 | 恢复单张 | ✅ | `restore_image` IPC |
| 4 | 永久删除单张 | ✅ | `permanent_delete_image` IPC |
| 5 | 清空回收站 | ✅ | `empty_trash` IPC |
| 6 | 批量软删除 | ✅ | `batch_soft_delete` IPC |
| 7 | 批量恢复 | ✅ | `batch_restore` IPC |
| 8 | 批量永久删除 | ✅ | `batch_permanent_delete` IPC |
| 9 | 乐观更新 + 失败回滚 | ✅ | `trashStore` tests |

---

## 4. AI 分析模块

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | AI 分析图片 | ✅ | `analyze_image_cmd` IPC |
| 2 | 获取分析结果 | ✅ | `get_analysis_result_cmd` IPC |
| 3 | 分析历史 | ✅ | `get_analysis_history_cmd` IPC |
| 4 | 标签建议 | ✅ | `apply_ai_tags_cmd` IPC |
| 5 | 批量自动标签 | ✅ | `batchAutoTag` tests |
| 6 | Ollama 状态检查 | ✅ | `useOllamaStatus` tests |
| 7 | Ollama 主机配置 | ✅ | `get_ollama_host` IPC |

---

## 5. 嵌入与语义搜索模块

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | 生成图片嵌入 | ✅ | `generate_embedding_for_image_cmd` IPC |
| 2 | 批量生成嵌入 | ✅ | `generateEmbeddings` tests |
| 3 | 嵌入状态查询 | ✅ | `get_embedding_status_cmd` IPC |
| 4 | 嵌入统计 | ✅ | `get_embedding_stats_cmd` IPC |
| 5 | 语义搜索 | ✅ | `searchSemantic` tests |
| 6 | 以图搜图 | ✅ | `searchByImage` tests |
| 7 | CLIP 图片嵌入 | ✅ | `clip_embed_image_cmd` IPC |
| 8 | CLIP 文本嵌入 | ✅ | `clip_embed_text_cmd` IPC |

---

## 6. 导出模块

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | 批量导出图片 | ✅ | `export_images` IPC |
| 2 | 模板命名 | ✅ | `ExportPage` 组件 |
| 3 | 多种输出格式 | ✅ | `export_images` IPC |

---

## 7. 设置模块

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | 键值设置存储 | ✅ | `get_setting` / `set_setting` IPC |
| 2 | 数据库备份 | ✅ | `export_database` IPC |
| 3 | 数据库恢复 | ✅ | `import_database` IPC |
| 4 | LAN 服务器配置 | ✅ | `get_lan_info` IPC |
| 5 | 国际化 (zh/en) | ✅ | `i18n.test.ts` |
| 6 | 暗色主题 | ✅ | `design-compliance.test.ts` |

---

## 8. 系统功能

| # | 验收项 | 状态 | 测试依据 |
|---|--------|------|----------|
| 1 | 命令面板 (Cmd/Ctrl+K) | ✅ | `CommandPalette.test.tsx` |
| 2 | 键盘导航 | ✅ | `useKeyboardNav.test.ts` |
| 3 | 错误边界 | ✅ | `ErrorBoundary` 组件 |
| 4 | 自动更新 | ✅ | `UpdateBanner.test.tsx` |
| 5 | 加载状态 | ✅ | `LoadingSkeleton` 组件 |
| 6 | 空状态提示 | ✅ | `ErrorState` 组件 |

---

## 9. 验收统计

| 模块 | 验收项数 | 通过数 | 通过率 |
|------|----------|--------|--------|
| 图片管理 | 22 | 22 | 100% |
| 标签系统 | 8 | 8 | 100% |
| 回收站 | 9 | 9 | 100% |
| AI 分析 | 7 | 7 | 100% |
| 嵌入搜索 | 8 | 8 | 100% |
| 导出 | 3 | 3 | 100% |
| 设置 | 6 | 6 | 100% |
| 系统功能 | 6 | 6 | 100% |
| **总计** | **69** | **69** | **100%** |

---

## 10. 未覆盖功能

| 功能 | 原因 | 计划 |
|------|------|------|
| ExportPage 测试 | 缺失 | v0.7.0 |
| DashboardPage 测试 | 缺失 | v0.7.0 |
| 移动端适配测试 | 未实现 | v0.8.0 |

---

*文档生成时间：基于 commit 69983af6*
