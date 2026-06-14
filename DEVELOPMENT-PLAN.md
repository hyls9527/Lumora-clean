# Lumora 开发总规划

> 基于 ArcaneCodex V2 完整功能审计（140 命令 / 60 组件 / 7 stores / 22 表）
> 原则：不重复造轮子，不留返工隐患

---

## 总览

| 阶段 | 主题 | 命令数 | 组件数 | 预计工作量 |
|------|------|--------|--------|-----------|
| **P0** | 基础设施 | 0 | 2 | 1 天 |
| **P1** | 数据层 | 0 | 0 | 1 天 |
| **P2** | 图片管理核心 | 16 | 8 | 2 天 |
| **P3** | 搜索 | 5 | 4 | 1 天 |
| **P4** | 标签与组织 | 26 | 6 | 2 天 |
| **P5** | 导入导出 | 14 | 6 | 2 天 |
| **P6** | AI 分析 | 8 | 3 | 2 天 |
| **P7** | 策展与评分 | 18 | 8 | 3 天 |
| **P8** | 重复与变体 | 21 | 5 | 2 天 |
| **P9** | 备份回收设置 | 35 | 8 | 2 天 |
| **P10** | 打磨与发布 | 0 | 5 | 2 天 |
| | **合计** | **140** | **~55** | **~20 天** |

---

## P0: 基础设施（1 天）

**目标：** Tauri 2 集成、项目骨架、构建流水线

### 任务

| # | 任务 | 产出 |
|---|------|------|
| P0-1 | Tauri 2 初始化 | `src-tauri/` 目录、`Cargo.toml`、`tauri.conf.json` |
| P0-2 | Vite + Tauri 联调 | `npm run tauri dev` 能启动 |
| P0-3 | Path alias 配置 | `@/*` → `./src/*`，前后端统一 |
| P0-4 | shadcn/ui 组件库 | 已装 11 个，按需补充 |
| P0-5 | SQLite 连接池 | `src-tauri/src/pool.rs` — r2d2 连接池 |
| P0-6 | 错误处理 | `src-tauri/src/error.rs` — 统一 AppError |
| P0-7 | 前端 ErrorBoundary | `src/components/ErrorBoundary.tsx` |
| P0-8 | 基础 IPC 测试 | `invoke("ping")` 能通 |

### 验收标准

- [ ] `npm run tauri dev` 启动成功
- [ ] 前端能调用 `invoke("ping")` 返回 "pong"
- [ ] `npx tsc --noEmit` 零错误
- [ ] `cargo check` 零错误

---

## P1: 数据层（1 天）

**目标：** SQLite schema、迁移系统、基础 CRUD

### 数据库表（22 张）

| 表名 | 用途 | 关键列 |
|------|------|--------|
| `images` | 图片主表 | id, file_path, file_hash, format, width, height, rating, favorite, llm_json, clip_vector |
| `tags` | 标签 | id, name, parent_id, color |
| `image_tags` | 图片-标签关联 | image_id, tag_id |
| `smart_folders` | 智能文件夹 | id, name, rules_json |
| `smart_folder_images` | 智能文件夹-图片 | folder_id, image_id |
| `collections` | 收藏集 | id, name, type |
| `collection_images` | 收藏集-图片 | collection_id, image_id |
| `weight_profiles` | 评分权重模板 | id, name, weights_json |
| `scoring_rules` | 评分规则 | id, dimension, rule_json |
| `curation_sessions` | 策展会话 | id, source_dir, started_at, completed_at |
| `curation_decisions` | 策展决策 | image_id, session_id, decision, rating |
| `variant_groups` | 变体组 | id, detection_method |
| `variant_group_members` | 变体组成员 | group_id, image_id |
| `trash` | 回收站 | image_id, deleted_at, restored |
| `reject_bin` | 拒绝箱 | image_id, rejected_at |
| `llm_tasks` | LLM 分析队列 | id, image_id, status, priority, error_msg |
| `benchmarks` | 基准测试 | id, timestamp, results_json |
| `app_config` | 应用配置 | key, value |
| `schema_version` | 迁移版本 | version |
| `export_presets` | 导出预设 | id, name, config_json |
| `keybindings` | 快捷键 | action, key |
| `backup_history` | 备份历史 | id, path, timestamp, size_mb |

### 任务

| # | 任务 | 产出 |
|---|------|------|
| P1-1 | Schema 定义 | `src-tauri/src/db/schema.rs` — 所有 CREATE TABLE |
| P1-2 | 迁移系统 | `src-tauri/src/db/migrations.rs` — 版本化迁移 |
| P1-3 | FTS5 虚拟表 | `images_fts` — 中文分词 (jieba-rs) |
| P1-4 | Repository 层 | `src-tauri/src/repository/image.rs` — CRUD 操作 |
| P1-5 | 类型定义 | `src-tauri/src/schema/types.rs` — IPC 契约类型 |

### 验收标准

- [ ] `cargo test --lib` — 迁移测试通过
- [ ] 22 张表全部创建成功
- [ ] FTS5 中文分词正常工作
- [ ] Repository 层 CRUD 测试通过

---

## P2: 图片管理核心（2 天）

**目标：** 图片列表、详情、评分、收藏、删除

### 命令（16 个）

| 命令 | 来源 | 说明 |
|------|------|------|
| `list_images` | image.rs | 分页列表（完整） |
| `list_images_summary` | image.rs | 分页列表（轻量，无 llm_json） |
| `get_image` | image.rs | 单图详情 |
| `update_rating` | image.rs | 设置评分 |
| `toggle_favorite` | image.rs | 切换收藏 |
| `delete_image` | image.rs | 软删除 |
| `batch_delete` | image.rs | 批量删除 |
| `batch_set_rating` | image.rs | 批量评分 |
| `batch_toggle_favorite` | image.rs | 批量收藏 |
| `extract_metadata` | image.rs | 提取 EXIF/生成参数 |
| `update_llm_json` | image.rs | 更新 AI 分析结果 |
| `list_trash` | trash.rs | 回收站列表 |
| `restore_image` | trash.rs | 恢复 |
| `permanently_delete` | trash.rs | 永久删除 |
| `get_library_stats` | stats.rs | 库统计 |
| `get_memory_stats` | stats.rs | 内存统计 |

### 组件（8 个）

| 组件 | shadcn 基础 | 说明 |
|------|------------|------|
| `GalleryPage` | — | 图片网格页面 |
| `ImageGrid` | — | 虚拟化网格（@tanstack/react-virtual） |
| `ImageCard` | Card | 图片卡片（缩略图 + 评分 + 收藏） |
| `DetailPanel` | Sheet | 图片详情侧边栏 |
| `ImageInfoSection` | — | 元数据显示 |
| `RatingStars` | — | 评分星星组件 |
| `BatchToolbar` | — | 批量操作工具栏 |
| `EmptyState` | Card | 空状态 |

### Stores

| Store | 关键状态 |
|-------|---------|
| `useImageStore` | images, selectedIds, detailImage, sortBy, searchQuery |

### 验收标准

- [ ] 图片网格 4 列显示，虚拟化滚动
- [ ] 点击图片打开详情面板
- [ ] 评分/收藏/删除功能正常
- [ ] 批量操作正常
- [ ] 空状态显示正确

---

## P3: 搜索（1 天）

**目标：** 全文搜索、结构化过滤、标签过滤

### 命令（5 个）

| 命令 | 说明 |
|------|------|
| `search_images` | FTS5 全文搜索 |
| `get_filter_tags` | 获取 7 维度标签集 |
| `search_structured` | 结构化 dimension:tag 搜索 |
| `search_natural_language` | 自然语言搜索（需 LLM） |
| `search_semantic` | CLIP 语义搜索（需 CLIP） |

### 组件（4 个）

| 组件 | shadcn 基础 | 说明 |
|------|------------|------|
| `SearchBar` | Input | 搜索框 + 模式切换 |
| `FilterChips` | Badge | 活跃过滤标签 |
| `DimensionGrid` | — | 维度标签网格 |
| `ActiveFilterBar` | — | 过滤状态栏 |

### Stores

| Store | 关键状态 |
|-------|---------|
| `useFilterStore` | filters, dimension, searchMode |

### 验收标准

- [ ] 中文搜索正常（jieba 分词）
- [ ] 结构化过滤（subject:girl）正常
- [ ] 标签点击过滤正常
- [ ] P3 阶段 NL/语义搜索可选（依赖 P6）

---

## P4: 标签与组织（2 天）

**目标：** 标签 CRUD、层级树、智能文件夹、收藏集

### 命令（26 个）

| 模块 | 命令数 | 说明 |
|------|--------|------|
| tags.rs | 15 | CRUD、合并、重命名、颜色、树、图片关联 |
| smart_folders.rs | 4 | CRUD、规则测试、图片计数 |
| collections.rs | 7 | CRUD、添加/移除图片、列表 |

### 组件（6 个）

| 组件 | 说明 |
|------|------|
| `TagPanel` | 标签管理面板 |
| `TagTree` | 层级标签树 |
| `RuleBuilder` | 智能文件夹规则构建器 |
| `CollectionPanel` | 收藏集面板 |
| `TagSuggestion` | AI 标签建议 |
| `TagBadge` | 标签徽章 |

### 验收标准

- [ ] 标签 CRUD 正常
- [ ] 标签树层级显示正确
- [ ] 智能文件夹规则编辑和测试正常
- [ ] 收藏集管理正常

---

## P5: 导入导出（2 天）

**目标：** 文件夹/文件/剪贴板导入，批量导出

### 命令（14 个）

| 模块 | 命令数 | 说明 |
|------|--------|------|
| import.rs | 5 | 文件夹、文件、剪贴板、取消、进度 |
| export.rs | 9 | 批量导出、预览、预设、按文件夹/标签导出、CLIP 嵌入 |

### 组件（6 个）

| 组件 | 说明 |
|------|------|
| `ImportButton` | 导入触发按钮 |
| `DropZone` | 拖放区域 |
| `ImportProgress` | 导入进度条 |
| `ExportDialog` | 导出对话框 |
| `ExportPreview` | 导出预览 |
| `RenameTemplateEditor` | 重命名模板编辑器 |

### 验收标准

- [ ] 文件夹导入正常（进度显示）
- [ ] 拖放导入正常
- [ ] 剪贴板导入正常
- [ ] 批量导出正常（格式转换）
- [ ] 导出预览准确

---

## P6: AI 分析（2 天）

**目标：** LLM 分析队列、CLIP 嵌入、语义搜索

### 命令（8 个）

| 命令 | 说明 |
|------|------|
| `analyze_image` | LLM 分析单图 |
| `prioritize_image` | 设置优先级 |
| `pause_queue` / `resume_queue` | 暂停/恢复队列 |
| `get_queue_status` | 队列状态 |
| `retry_failed_tasks` | 重试失败 |
| `re_analyze_all` / `re_analyze_selected` | 重新分析 |
| `embed_image` / `embed_batch` / `embed_unindexed` | CLIP 嵌入 |
| `get_clip_status` | CLIP 状态 |

### 组件（3 个）

| 组件 | 说明 |
|------|------|
| `AnalysisPanel` | 分析控制面板 |
| `QueueBar` | 队列状态栏 |
| `SpeedProfileSettings` | 速度配置 |

### 验收标准

- [ ] LLM 分析队列正常工作
- [ ] 暂停/恢复/重试正常
- [ ] CLIP 嵌入正常
- [ ] 语义搜索正常

---

## P7: 策展与评分（3 天）

**目标：** 6 维评分、权重模板、策展会话、决策记录

### 命令（18 个）

| 模块 | 命令数 | 说明 |
|------|--------|------|
| curation.rs | 18 | 评分、权重、会话、决策、校准、基准 |

### 组件（8 个）

| 组件 | 说明 |
|------|------|
| `CurationPage` | 策展主页面 |
| `CurationLayout` | 策展布局（D/B/C 模式） |
| `ScoreBreakdown` | 6 维评分分解 |
| `CurationToolbar` | Keep/Maybe/Reject 工具栏 |
| `WeightTemplateEditor` | 权重编辑器 |
| `CalibrationSandbox` | 校准沙箱 |
| `BenchmarkPanel` | 基准测试面板 |
| `SessionHistory` | 会话历史 |

### Stores

| Store | 关键状态 |
|-------|---------|
| `useCurationStore` | currentSession, decisions, scores, aiWeight |

### 验收标准

- [ ] 6 维评分计算正确
- [ ] 权重模板编辑正常
- [ ] Keep/Maybe/Reject 决策记录正常
- [ ] 会话历史查看正常

---

## P8: 重复与变体（2 天）

**目标：** 感知哈希去重、变体组检测、批量操作

### 命令（21 个）

| 模块 | 命令数 | 说明 |
|------|--------|------|
| dedup.rs | 8 | 精确/近似重复、生成批次、批量操作 |
| variants.rs | 10 | 变体检测、分组管理、封面选择 |
| compare.rs | 3 | 像素差异、SSIM、元数据对比 |

### 组件（5 个）

| 组件 | 说明 |
|------|------|
| `DuplicateFinder` | 重复检测面板 |
| `VariantGroupPanel` | 变体组面板 |
| `CompareView` | 图片对比视图 |
| `DiffOverlay` | 差异叠加 |
| `BatchMarkDialog` | 批量标记对话框 |

### 验收标准

- [ ] 重复检测正常
- [ ] 变体组创建/管理正常
- [ ] 图片对比正常

---

## P9: 备份回收设置（2 天）

**目标：** 备份/恢复、回收站、设置面板

### 命令（35 个）

| 模块 | 命令数 | 说明 |
|------|--------|------|
| backup.rs | 7 | 创建/恢复/列表/删除/配置 |
| trash.rs | 9 | 回收站 + 拒绝箱 |
| misc.rs | 19 | 设置、快捷键、LLM 配置、GPU、更新检查 |

### 组件（8 个）

| 组件 | 说明 |
|------|------|
| `SettingsPage` | 设置主页面 |
| `ThemeSettings` | 主题设置 |
| `LanguageSettings` | 语言设置 |
| `GPUSettings` | GPU 设置 |
| `KeybindingSettings` | 快捷键设置 |
| `BackupSettings` | 备份设置 |
| `TrashPage` | 回收站页面 |
| `UpdateBanner` | 更新提示 |

### 验收标准

- [ ] 备份/恢复正常
- [ ] 回收站/拒绝箱正常
- [ ] 设置面板所有选项正常
- [ ] i18n 中英文切换正常

---

## P10: 打磨与发布（2 天）

**目标：** 仪表盘、性能优化、测试、构建

### 组件（5 个）

| 组件 | 说明 |
|------|------|
| `DashboardPage` | 仪表盘主页面 |
| `LibraryDashboard` | 库统计 |
| `CoverageBar` | 分析覆盖率 |
| `FormatChart` | 格式分布图 |
| `RatingChart` | 评分分布图 |

### 任务

| # | 任务 | 说明 |
|---|------|------|
| P10-1 | 前端测试 | Vitest + Testing Library，目标 70%+ |
| P10-2 | 后端测试 | cargo test，目标 80%+ |
| P10-3 | E2E 测试 | Playwright 关键路径 |
| P10-4 | 性能优化 | 虚拟化、懒加载、缓存 |
| P10-5 | Tauri 构建 | `tauri build` 生成安装包 |
| P10-6 | CI/CD | GitHub Actions 自动测试+构建 |

### 验收标准

- [ ] 前端覆盖率 ≥ 70%
- [ ] 后端覆盖率 ≥ 80%
- [ ] E2E 关键路径通过
- [ ] `tauri build` 成功生成安装包
- [ ] CI 绿色

---

## 技术栈确认

| 层 | 选型 | 状态 |
|---|------|------|
| 框架 | Tauri 2 | P0 集成 |
| 前端 | React 19 + TypeScript | ✅ 已有 |
| UI 库 | shadcn/ui (Radix + Tailwind) | ✅ 已装 11 组件 |
| 状态管理 | Zustand | ✅ 已有 |
| 数据库 | SQLite + FTS5 + jieba-rs | P1 集成 |
| 字体 | DM Sans + JetBrains Mono | ✅ 已装 |
| 国际化 | 自研 i18n (en/zh) | ✅ 已有 |
| 测试 | Vitest + cargo test + Playwright | P10 集成 |
| CI | GitHub Actions | P10 集成 |

## 执行顺序

```
P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10
 基础  数据  图片  搜索  标签  导入  AI   策展  重复  设置  发布
```

每个阶段：写 PLAN → Claude Code 执行 → Hermes 验证 → commit → 下一阶段

---

*本文档是 Lumora 的开发基线。所有实现必须遵循此规划。*
