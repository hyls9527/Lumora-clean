# CHANGELOG

## v0.3.1 — 2026-06-29

### ⚡ 性能优化

- **语义搜索缓存** — Map-based LRU, O(1) 查找, 30min TTL, 查询规范化, 5MB 驱逐
- **批量持久化** — 300ms debounce, 避免同步 localStorage 写入阻塞主线程
- **缓存失效** — 图片导入后自动清空语义搜索缓存

### 🎯 核心功能

- **Ollama 可用性检测** — Sidebar 绿点/红点状态指示器, 60s 轮询, 可点击重试
- **收藏页面** — 新增 /favorites 路由, 过滤 favorite=true 图片, 复用 GalleryPage 结构
- **依赖链深度调查** — 识别 6 层架构 7 条依赖链, 跨层风险矩阵

### 🐛 Bug 修复

- **GalleryPage loadMore** — 修复 `loadMore` 未解构导致的 TypeScript 错误
- **FK CASCADE** — `permanent_delete_image` 现在级联删除 image_tags, embeddings, analysis_history
- **死路由清理** — 移除 Sidebar 中 4 个未实现路由 (/normal, /curation, /favorites*, /prompts)
- **项目 TS 错误清零** — 从 1 个降至 0 个

### 🧪 测试

- **TypeScript**: 176 测试全绿 (+17 新增)
- **Rust**: 29 测试全绿 (+9 新增, 原 20)
- 新增: semanticCache (8), useOllamaStatus (5), FavoritesPage (4)
- 新增 Rust: trash 级联删除 (3), tags (3), images 搜索/分页 (3)

### 📦 新增文件

- `src/lib/api/semanticCache.ts` — 语义搜索缓存层
- `src/hooks/useOllamaStatus.ts` — Ollama 状态检测 hook
- `src/features/favorites/FavoritesPage.tsx` — 收藏页面

### 🏗️ 内部改进

- 提取 `permanent_delete_impl` 内部函数, 可测试
- 提取 `create_tag_impl`, `add_tag_to_image_impl` 内部函数
- ARCHITECTURE.md 补充 Cache Layer + Hooks 层

---

## v0.3.0 — 2026-06-27

### 🎯 核心功能

- **图库管理** — 图片导入、分页浏览、网格/列表视图
- **AI 分析** — Ollama 集成，图片描述、标签、物体识别
- **语义搜索** — Ollama embedding + sqlite-vec 向量搜索
- **标签系统** — 创建、删除、图片关联
- **回收站** — 软删除、恢复、永久删除
- **导出功能** — 批量导出、格式转换
- **设置管理** — 主题、语言、偏好设置
- **仪表盘** — 图片统计、AI 分析概览

### 🧪 测试

- 179 测试全绿（20 Rust + 159 TypeScript）
- 前端组件测试（ImageCard、CommandPalette、DetailModal）
- UI 一致性测试（DESIGN.md 合规）
- 可访问性测试（ARIA、键盘导航、对比度）
- 设计合规测试（反模式检查）

### 🏗️ 基础设施

- **Tauri 2** — 桌面应用框架
- **SQLite + FTS5 + sqlite-vec** — 数据库 + 全文搜索 + 向量搜索
- **Ollama** — AI 推理（nomic-embed-text + llava）
- **CLIP sidecar** — Python CLIP embedding（待网络环境改善）
- **ErrorBoundary** — 全局错误捕获
- **统一错误消息** — wrapError + ERROR_MESSAGES map

### 🎨 设计语言：古卷·灯火

- 象牙纸页 `#f2ede4` + 研磨墨 `#2a2118` + 古铜包浆 `#7a5c12`
- Noto Serif SC（标题）+ DM Sans（正文）
- 梅花印评分（不用星星）
- 藏书印收藏（不用红心）
- 200ms 过渡动画
- 2px 圆角卡片 + 4px 圆角按钮

### ♿ 可访问性

- ARIA 标签（26 个）
- 键盘导航支持（5 个组件）
- 颜色对比度 WCAG AA
- 语义化 HTML

### ⚡ 性能优化

- React.memo 防止不必要重渲染
- LazyLoad 懒加载组件
- IntersectionObserver 可视区域检测

### 📦 构建产物

- `lumora_0.3.0_x64_en-US.msi` — Windows MSI 安装包
- `lumora_0.3.0_x64-setup.exe` — Windows NSIS 安装包

### 📚 文档

- README.md — 项目介绍、技术栈、里程碑
- ARCHITECTURE.md — 系统架构、数据模型、IPC 契约
- DESIGN.md — 设计语言规范
- CLAUDE.md — AI 编码助手工作规则

---

## v0.2.0 — 2026-06-21

### 🎯 核心功能

- **AI-Ready Frontend** — 嵌入状态、语义搜索 UI、AI 分析面板
- **Mock 数据** — 前端开发用 mock 数据

---

## v0.1.0 — 2026-06-21

### 🎯 核心功能

- **MVP Frontend** — 图库、策展、命令面板、键盘导航、评分收藏
- **设计稿** — 静态 HTML 高保真原型
