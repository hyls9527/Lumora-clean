# 功能验收 Checklist — Lumora v0.5.1

## 验收标准

### 1. 图片管理

| # | 验收项 | 验证方式 | 状态 |
|---|--------|---------|------|
| 1.1 | 拖拽文件夹导入图片 | 手动测试 | ✅ |
| 1.2 | 拖拽单文件导入 | 手动测试 | ✅ |
| 1.3 | 支持 png/jpg/jpeg/webp/avif/bmp/gif/tiff | `IMAGE_EXTENSIONS` 常量 | ✅ |
| 1.4 | 重复文件自动跳过 | `file_hash` 去重 | ✅ |
| 1.5 | PNG 元数据自动解析 | `metadata::probe_metadata_from_bytes` | ✅ |
| 1.6 | 图片分页列表 | `list_images` 命令 | ✅ |
| 1.7 | 网格/列表视图切换 | GalleryPage 手动测试 | ✅ |
| 1.8 | 评分 0-5 | `update_rating` 命令 | ✅ |
| 1.9 | 收藏/取消收藏 | `toggle_favorite` 命令 | ✅ |
| 1.10 | 收藏列表 | `list_favorites` 命令 | ✅ |
| 1.11 | 图片导出 | `export_images` 命令 | ✅ |

### 2. 搜索

| # | 验收项 | 验证方式 | 状态 |
|---|--------|---------|------|
| 2.1 | FTS5 全文搜索 | `search_images` 测试 | ✅ |
| 2.2 | 特殊字符转义 | `escape_fts5` 函数 | ✅ |
| 2.3 | 字段范围搜索 | `search_images_advanced` 测试 | ✅ |
| 2.4 | 语义搜索 | `search_semantic_cmd` 测试 | ✅ |
| 2.5 | 视觉相似搜索 | `searchByImage` 测试 | ✅ |
| 2.6 | 搜索缓存 | `semanticCache.test.ts` 8 tests | ✅ |

### 3. 标签

| # | 验收项 | 验证方式 | 状态 |
|---|--------|---------|------|
| 3.1 | 创建标签 | `create_tag` 测试 | ✅ |
| 3.2 | 编辑标签 | `update_tag` 测试 | ✅ |
| 3.3 | 删除标签 | `delete_tag` 测试 | ✅ |
| 3.4 | 图片标签关联 | `add_tag_to_image` 测试 | ✅ |
| 3.5 | 批量标签操作 | `batch_add_tag` 测试 | ✅ |

### 4. 回收站

| # | 验收项 | 验证方式 | 状态 |
|---|--------|---------|------|
| 4.1 | 软删除 | `soft_delete_image` 测试 | ✅ |
| 4.2 | 恢复 | `restore_image` 测试 | ✅ |
| 4.3 | 永久删除级联清理 | `permanent_delete_cascades` 测试 | ✅ |
| 4.4 | 批量操作 | `batch_*` 测试 | ✅ |

### 5. AI

| # | 验收项 | 验证方式 | 状态 |
|---|--------|---------|------|
| 5.1 | Ollama 状态检测 | `useOllamaStatus` 测试 | ✅ |
| 5.2 | 图片分析 | `analyze_image_cmd` 测试 | ✅ |
| 5.3 | 分析历史 | `get_analysis_history_cmd` 测试 | ✅ |
| 5.4 | AI 自动标注 | `apply_ai_tags_cmd` 测试 | ✅ |

### 6. 系统

| # | 验收项 | 验证方式 | 状态 |
|---|--------|---------|------|
| 6.1 | 中英文切换 | i18n 测试 | ✅ |
| 6.2 | 命令面板 ⌘K | CommandPalette 测试 9 tests | ✅ |
| 6.3 | 键盘导航 | useKeyboardNav 测试 11 tests | ✅ |
| 6.4 | 数据库备份/恢复 | backup.ts API | ✅ |
| 6.5 | 自动更新 | useUpdater 测试 6 tests | ✅ |

## 质量门禁

| 检查项 | 命令 | 要求 | 结果 |
|--------|------|------|------|
| 类型检查 | `npx tsc --noEmit` | 零报错 | ✅ |
| 前端测试 | `npx vitest run` | 全部通过 | ✅ 340/340 |
| Rust 测试 | `cargo test --lib` | 全部通过 | ✅ 57/57 |
| 设计合规 | `design-compliance.test.ts` | 全部通过 | ✅ 16/16 |
| 无障碍 | `accessibility.test.ts` | 全部通过 | ✅ 12/12 |
