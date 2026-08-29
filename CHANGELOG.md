# Changelog

All notable changes to Lumora are documented here.

## v0.10.5 (2026-08-29)

### Fixed
- **引用模式导入的图片无法加载**：base64 读取命令的路径校验由"仅限应用数据目录"放宽为"管理目录内或数据库已登记路径"（引用模式语义：只读用户显式导入过的文件）；同时启用 asset protocol 作为兜底，CSP `img-src` 补 `http://asset.localhost`（Windows 资产协议 scheme）
- **批量格式转换在真实环境必然失败**：前端调用缺少 Rust 端必填参数 `dryRun`，补齐后功能恢复
- **搜索健壮性**：空/纯空白查询不再触发 FTS5 语法错误；含引号、`%`、`_` 等特殊字符的查询转义修复（LIKE 通配符补 `ESCAPE` 子句，查询 `%` 不再匹配全表）
- **备份导出丢数据**：WAL 模式下导出前未 checkpoint，未落盘事务随主文件拷贝丢失；备份导入替换主库后残留旧 `-wal`/`-shm`，重启时旧 WAL 重放到新库造成数据损坏，替换成功后清除 sidecar
- **导入一致性**：复制入库模式重复导入按内容哈希去重（不再堆叠副本）；记录被跳过或事务失败时清理孤儿拷贝文件；目录扫描中单个文件元数据读取失败仅跳过该文件，不再中断整批
- **批量重命名**：冲突解决纳入数据库已注册路径；数据库更新失败时回滚磁盘重命名，不再留下文件与记录不一致
- **前端竞态**：图片列表分页/搜索旧响应覆盖新结果（请求序列令牌）；收藏/评分乐观更新在操作其他图片后失败永不回滚（全局序列号改为按图片隔离）；base64 命令"成功但返回空"时全尺寸图不再卡在空白占位
- **写命令误重试**：批量重命名、导出、设置写入等 9 个命令加入写命令集合（不再自动重试）；嵌入补齐完成后语义缓存正确失效（此前命中最长 30 分钟的过期缓存）
- 浏览器 mock 模式下以图搜图崩溃（mock 返回结构与真实接口对齐）

### Changed
- **网格卡片改用 640px 服务端缩略图**：此前每张卡片加载全尺寸原图，大图库滚动内存与 IPC 开销显著下降；详情弹窗仍加载全尺寸
- **局域网 token 强度**：8 字符（≈47.6 bit）→ 16 字符（≈95.3 bit）；存量用户已持久化的 token 不受影响，仅新安装生效
- MCP `get_image_file`：竖图/长图统一按 1024px 内缩重编码；不可解码文件超过 20 MiB 拒绝返回（内存膨胀防护）
- LAN/MCP 分页计算改饱和乘法，传入超大页码不再触发算术溢出 panic
- 安装钩子移除对通用进程名 `app.exe` 的强杀（Tauri 脚手架遗留，可能误伤用户机器上的无关进程）

### Security
- sidecar 权重加载启用 `torch.load(weights_only=True)`：网络下载的 `.pth` 为 pickle 格式，此前可被篡改权重触发任意代码执行（CWE-502）

### Tests
- Rust 234 → 257 通过（新增图片访问校验、导入/备份一致性、搜索转义、溢出回归）
- 前端 761 通过（新增缩略图加载契约、分页竞态、跨图片回滚、写命令不重试）
- sidecar pytest 12 通过

## v0.10.4 (2026-08-16)

### Fixed
- 自动更新走系统代理：启动时读取 Windows 系统代理（Internet Settings）注入更新请求——此前应用直连 GitHub，在需要代理的网络（如浏览器正常但应用更新失败）无法下载更新包
- 单实例锁：防止多个 Lumora 进程并存互相干扰更新安装（第二实例启动时聚焦已有窗口）
- 发布版文件日志：此前日志插件仅 debug 模式启用，发布版无任何日志；现始终写入 `%APPDATA%\com.lumora.app\logs`
- 安装超时提示：「重启并安装」15 秒无响应时提示安装器可能被拦截或需手动安装，不再无限卡死

## v0.10.3 (2026-08-16)

### Fixed
- 首次启动导入方式弹窗重复出现：冷启动时设置读取未从磁盘水合导致误判"首次使用"（设置已保存仍弹窗）；`get_setting` 读取前强制重载磁盘 + 前端复查一次
- 启动动画移除字标扫光（sheen）——浅色背景下呈现为划过的暗带

## v0.10.2 (2026-08-16)

### Added
- 复制入库导入模式：「设置 → 导入方式」可选**登记引用**（只记录路径，默认）或**复制入库**（图片复制进应用数据目录统一管理）；首次启动弹出选择向导，并明确提示复制入库的图片随卸载删除
- 启动动画重制：以品牌灯笼图标替代十字准线（纯 transform/opacity 动画，≤2s 揭幕；reduced-motion 下静态可见）
- 使用指南与快速上手教程（`docs/06-user-guide/`，README 已加链接）

### Fixed
- `.gitignore` 的 `assets/` 规则未锚定根目录，导致 `src/assets/`（启动图标）无法入库、CI 构建失败风险

### Tests
- 新增导入路径冲突、导入方式设置、首次启动弹窗测试；前端 748、Rust 231

## v0.10.1 (2026-08-15)

### Added
- 多 AI 后端：语义搜索嵌入与视觉分析可在本地 Ollama 与 OpenAI 兼容 API 间切换（设置页「AI 后端」配置 Base URL / Key / 模型；环境变量兜底；分析输出解析兼容 markdown 代码块与夹带文本）
- 视觉分析后端独立于嵌入后端：`ai.vision_provider` 可将图片分析单独路由到 OpenAI 兼容端点（如本地 llama.cpp）；本地回环端点免 API Key，视觉请求超时放宽至 300s
- 启动动画品牌化重设计：十字准线 + 衬线字标逐字落定，揭幕压缩至 ≤2s（纯 transform/opacity 动画，去除逐帧模糊）

### Fixed
- MCP `list_tags` 的用量计数把已删除图片计入（改为 `COUNT(i.id)` 且按 `deleted = 0` 关联）

### Tests
- 为 MCP 全部工具、provider 的 OpenAI 兼容请求/解析、Ollama 视觉分析 mock、sidecar 路径解析补 23 个单元测试，Rust llvm-cov 恢复并超过 77/70/77 门槛

## v0.10.0 (2026-08-14)

### Added
- MCP（Model Context Protocol）接入：内嵌 Streamable HTTP 服务端，位于 `/mcp`，复用局域网 token 鉴权；AI 客户端（Claude、Cursor 等）可浏览、搜索、读取图片，并可管理标签 / 收藏 / 回收站（移入与恢复）；评分保持人工，不向 AI 开放
- 局域网 token 持久化（`settings.json` 中的 `lan_token`），AI 客户端配置跨重启保持有效
- 以图搜图独立 CLIP 视觉索引（迁移 V9）：512 维 CLIP 向量库与 768 维语义索引分离，新增视觉索引缺失统计与一键补齐；CLIP sidecar 支持批量嵌入（单进程一次加载模型）
- 真实环境端到端测试与 10K 性能预算：语义搜索 / 以图搜图真实链路断言 + 10K 语义搜索延迟预算（实测 68ms / 1.5s）

### Fixed
- Windows 下 CLIP / 审美评分 sidecar 无法启动（`os error 193`），统一经 Python 解释器启动（`LUMORA_PYTHON` 可覆盖）
- 以图搜图真实环境维度不匹配（512 维 CLIP 向量查询 768 维索引）
- 跨 prompt 的 HPS 展示误导：仅在同 prompt 变体内展示 HPS，并标注「组内」「仅同 prompt 变体内可比」

### Tests
- 前端 738 → 739 测试；Rust 198 → 201 测试（另 3 个真实环境 E2E 为 `#[ignore]`，本地手动跑）；Python sidecar 12

## v0.9.0 (2026-08-08)

### Added
- 智能收藏（规则自动分组）：模型 / 评分 / 格式 / Prompt / 标签 5 类筛选规则，可组合（AND）实时匹配；列表卡片显示规则摘要与命中数，详情页展示图片网格并支持分页；侧边栏新增"智能收藏"入口
- 数据库迁移 v7：`smart_collections` 表（名称 + 规则 JSON），CRUD 与规则查询命令
- 复刻 Harness 式桌面更新体验：版本说明摘要 + 后台静默下载进度条 + "重启并安装 / 稍后"
- 导入后语义索引补齐提示、以图搜图与语义搜索失败友好提示
- 语义索引完备性：缺失统计 + 一键补齐缺失向量（仪表盘 / 搜索页入口）

### Tests
- 前端 692 → 700 测试；Rust 129 → 137 测试

### AI 原生评分体系（夯 → 拉）
- 三档判断层：improved-aesthetic-predictor 0-10 分档（夯 ≥8.5 / 稳 ≥6.0 / 拉 <6.0），HPS v2 直连官方检查点提供同 prompt 偏好分（Apache-2.0，无 AGPL 依赖）
- 数据库 v8 评分字段（hps_score / hps_style / aesthetic_score / scoring_model / scored_at / score_label）与智能收藏 score 规则
- AI 原生控制：建相册夯/稳/拉、哪些拉了、把拉的移到回收站、补评分（全库回填）、回收建议、这批最夯、同 prompt 变体组最夯、为什么这张图是夯/拉（同类百分位解释）
- 导入后自动评分（上限 50）+ 后台全库回填；模型不可用时优雅降级「未评分」

### 工程化
- CI 新增 Python sidecar 单元测试门禁（12 测试）
- Rust llvm-cov 覆盖率门槛：行 ≥77 / 函数 ≥70 / 区域 ≥77；前端覆盖率门槛保持（70/70/55/70）
- 修复测试副本假覆盖：export/batch_convert 改为真实命令测试；补齐 trash / rename / dashboard / backup / settings / ollama / lan handler / clip 解析 / JPEG/WebP 探测测试

### Tests
- 前端 738 测试；Rust 197 测试；Python sidecar 12 测试；tsc / fmt / clippy 全净

## v0.8.1 (2026-08-02)

### Added
- 品牌启动动画：Logo 丝滑入场（圆环描边 / 高光扫过 / 字标落定 / 淡出揭幕），纯 CSS 实现，尊重系统“减少动态效果”设置
- 无缝加载：路由懒加载块在启动时后台预载，页面切换无“加载中”闪烁；加载占位品牌化

### Fixed
- DashboardPage 测试 teardown 竞态（CI 发布失败根因，mock 改为永不 resolve）
- 版本号统一：tauri.conf.json 0.7.1 → 0.8.1，设置页动态读取后端版本

### Tests
- 前端 672 → 676 测试

## v0.8.0 (2026-08-02)

### Added
- 高级筛选面板：模型 / 评分区间 / 仅收藏 / 格式 / 日期范围组合筛选（后端 `list_images_filtered`）
- 变体对比视图：同 prompt 不同 seed 的图片 2-N 张并排对比（VariantCompareModal）
- 图片信息增强：DetailModal 展示完整 SD 参数（Steps / CFG / Sampler / Seed / Negative Prompt）
- 键盘快捷键帮助面板（ShortcutsPanel）与 ⌘R 画廊刷新命令
- 离线提示（OfflineBanner）与错误恢复：图片加载指数退避重试、网络状态监听
- 批量重命名（模板 + 实时预览 + 冲突解析）与批量格式转换（7 种目标格式）
- 路由统一（`routes.ts` + `useRouter`）、LoadingPage、store 依赖注入重构
- CI 质量门禁：vitest 覆盖率（语句/分支/行 ≥70%、函数 ≥55%）、`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`perf-budget.mjs`

### Fixed
- **P1**：生产数据库打开路径未执行迁移（仅测试路径执行），全新安装会缺少数据表
- Esc 弹窗栈：多弹窗叠加时按一次 Esc 只关闭最上层；弹窗焦点陷阱与关闭后焦点还原
- ⌘R 刷新在已处于画廊页时失效（同值导航不触发重载）
- 拖拽文件夹到窗口无法导入（扩展名过滤丢弃文件夹路径）；根路径文件不再误扫整个磁盘
- ConvertDialog / RenameDialog 执行失败静默无提示；硬编码英文文案迁移至 i18n
- `favorite=false` 前后端语义不一致；评分/日期范围颠倒时静默返回空结果（改为显式报错）
- 日期筛选结束日不包含当天（`date(created_at)` 整天含入）
- 重命名/导出文件名未过滤 Windows 非法字符与路径穿越
- 图片 base64 加载 MIME 兜底（jpg/jpeg/tiff 归一、无扩展名安全回退）
- migrations 测试对全局 sqlite-vec 注册的顺序依赖
- **高级筛选面板实际接线**（此前 FilterPanel 未挂载、筛选条件不生效；现接入 imageStore → `list_images_filtered`）
- 文件夹导入不再跟随符号链接（防止链接循环导致无限递归）
- 导入文件哈希改为内容哈希（路径+大小指纹 → 前 64KB 内容），去重语义与文档一致
- 导入时间戳元数据读取失败不再 panic（回退当前时间）
- LAN 服务器：端口绑定竞态消除（一次绑定复用）、token 恒定时间比较、后台线程错误日志化而非静默 panic

### Tests
- 前端 605 → **669** 测试；Rust 107 → **128** 测试；`tsc --noEmit` 0 错误
- 新增：弹窗栈/焦点、路由刷新、拖拽路径、MIME、i18n 键对齐、离线长操作、筛选范围校验、迁移执行、ErrorBoundary 懒加载失败、useMediaQuery

## v0.7.1 (2026-07-15)

### Fixed
- Image display: Tauri asset protocol not registered — added base64 fallback command
- useImageSrc now tries `get_image_base64_cmd` first, falls back to `convertFileSrc`

### Added
- VariantGroup component: display image variants in DetailModal
- i18n strings for variants section (en/zh)

## v0.7.0

### Added
- Mobile navigation: MobileNav component for mobile devices
- Search suggestions: SearchSuggestions component with keyboard navigation
- Search history: useSearchHistory hook with localStorage persistence
- Touch gesture support: useTouchGesture hook (swipe, long press, double tap)
- Toast notifications: global notification system (success/error/warning/info)
- Error retry: withRetry utility with exponential backoff
- Performance monitoring: usePerformanceMonitor hook
- AI analysis: AiAnalysisSection integrated into DetailModal

### Improved
- Mobile responsiveness: conditional rendering of Sidebar/MobileNav
- Search UX: integrated search history and suggestions
- Code splitting: GalleryPage lazy loading
- Performance monitoring: GalleryPage and SearchPage render tracking
- Test coverage: 350 → 445 tests

### Fixed
- Sidebar search button onClick handler
- Cascade delete documentation
- Mutex usage documentation

### Removed
- 16 redundant documentation files
- Over-engineered documents (market analysis, strategy, etc.)
- VirtualGrid: not compatible with masonry layout (kept as utility)

## v0.6.0 (2026-07-10)

### Added
- LAN web server for mobile browsing (axum, port 8079)
- Batch embedding generation UI
- Export template variables: {model} {prompt} {seed} {width} {height} {format}
- Bidirectional LazyLoad for 10K+ image performance
- Sidebar keyboard navigation (ArrowUp/Down/Home/End)
- Release workflow: version sync check, test gate, signature download

### Fixed
- UI centering caused by #root flex centering
- Sidebar width: explicit 220px when expanded
- LAN server crash: Tokio runtime in synchronous setup
- Page transition animation removed (too much movement)

### Removed
- smartCollectionStore stub (no CRUD, no UI)
- 5 unused i18n keys, smartCollections section
- Dead Rust code: probe_metadata, read_text_chunks, MAX_READ
- app_dir field from ServerState (never read)
- images.rs split: 1195 lines → import(590) + search(260) + ops(370)

## v0.5.1 (2026-07-07)

### Added
- Dark theme: "暗夜" palette with warm candlelight accents
- `tokens.ts` unified to CSS variables (theme-responsive)
- DESIGN.md documents both light and dark color palettes

### Fixed
- Drag-and-drop import now actually imports files
- Manual import supports selecting individual files, not just folders
- Settings/Export/Import/Search pages no longer center content vertically
- Settings page layout aligned to top
- 18 hardcoded Chinese strings replaced with i18n calls
- Missing i18n keys for backup/export/import buttons
- Database import writes to staging file first (avoids corrupting active WAL)
- TypeScript errors in imageStore tests
- Sidebar navigation labels now use i18n

### Added
- File import button alongside folder import
- Database backup/restore in Settings (export/import SQLite)
- Image loading retry (up to 2 attempts with exponential backoff)
- 29 new tests: ImportPage integration, write commands lifecycle, store coverage
- Rust tests for single-file import (57 total)

### Performance
- LazyLoad placeholder uses actual image height from metadata

## v0.5.0 (2026-07-06)

### Added
- Search by image: pick a reference image to find visually similar results
- Batch AI tag: select multiple images and auto-tag in one action
- Performance budget script (`scripts/perf-budget.mjs`)
- Security audit CI workflow (npm audit + cargo audit weekly scan)
- GitHub Issue template for user feedback

### Fixed
- Circular dependency: `tauri.ts` ↔ `semanticCache.ts` resolved with `onWriteCommand` callback
- Layout shift on page switch (overflow: hidden on main container)
- 3 audit defects repaired

### Changed
- Style tokenization: 258/286 hardcoded values replaced with `tokens.ts`
- i18n completion: 25+ hardcoded Chinese strings replaced with `t()` calls
- Page splitting: SearchPage 611→429 lines, ImportPage 564→393 lines
- Test coverage: 267→311 tests (+44, +16%)
- Knowledge graph auto-update configured

## v0.4.0 (2026-07-05)

### Added
- Responsive layout with `useMediaQuery` hook

### Fixed
- 7 code quality issues from audit
- CLAUDE.md condensed from 3938→1650 bytes

### Changed
- TDD refactor: shared modules extracted, duplication eliminated
- Ponytail audit + UI optimizations

## v0.3.4 (2026-07-04)

Version bump only.

## v0.3.3 (2026-07-04)

### Fixed
- Image preview display
- Ollama detection reliability
- Batch delete confirmation
- Import feedback (loading states)
- Splash screen and app icon
- Updater signing pubkey in tauri.conf.json

## v0.3.2 (2026-07-03)

### Added
- PNG metadata extraction: SD/ComfyUI parameters auto-parsed on import
- Variant tracing (v6 schema): images with same prompt grouped as variants
- Smart collections: auto-grouped images by model, prompt pattern
- Auto-tagging: AI analysis results auto-create and associate tags
- `search_images_advanced`: field-scoped search (seed, prompt, model)

### Fixed
- Silent error swallowing in catch blocks
- FavoritesPage rewritten
- Shared format utility extracted
- OLLAMA_HOST config unified (frontend reads from Rust backend)
- CLIP commands registered in invoke_handler
- Audit corrections: docs accuracy, error handling, transaction safety

### Changed
- ARCHITECTURE.md updated with schema v6, variant groups, new commands

## v0.3.1 (2026-07-02)

### Added
- Semantic search cache with LRU eviction and TTL
- Ollama availability detection in sidebar
- Favorites page with favorite image filtering
- Auto-update via GitHub Releases
- CSP security policy
- Updater signing
- Custom app icons (古卷·灯火 lantern design)

### Fixed
- Cascade delete in `empty_trash`/`batch_permanent_delete`
- Cache race condition
- 8 audit defects
- Vec embeddings dimension mismatch (512→768)
- CSP: added github.com + fonts.googleapis.com
- White screen crash: `useTranslation` infinite loop + Tauri API fallback

### Changed
- Unified error handling with `AppError` enum
- Release workflow with minisign signing (later simplified to unsigned)

## v0.3.0 (2026-07-01)

### Added
- SQLite persistent storage with rusqlite
- Ollama integration (nomic-embed-text embedding + llava vision)
- sqlite-vec vector search
- Tauri commands for all CRUD operations
- Drag-and-drop file import
- Export functionality with format conversion and rename templates
- Embedding status tracking
- Batch embedding generation
- Performance benchmarks (bulk insert 1000 images)
- Windows .msi installer

### Changed
- Frontend API stubs replaced with real Tauri IPC calls
- Mock data removed

## v0.2 (2026-06-28)

### Added
- Embedding status badges on ImageCards
- Embedding detail card in image panel
- Batch embedding generation bar
- Embedding stats row in Dashboard
- Semantic search bar with autocomplete
- Similarity score badges (3 color tiers)
- AI analysis panel with tag suggestions
- Analysis history list
- Color palette extraction display
- i18n for embedding, semantic search, and AI analysis sections

## v0.1-mvp (2026-06-25)

### Added
- Tauri 2 + React 19 + TypeScript foundation
- SQLite database with FTS5 full-text search
- Gallery view with grid/list toggle and column controls
- Image import (folder selection)
- Image detail modal with metadata display
- Rating system (plum-blossom stamps, 0–5)
- Favorites (book collector's seal ◆)
- Tag system with color customization
- Trash with soft delete and restore
- Settings page (language, theme)
- Command palette (⌘K)
- Keyboard navigation (arrow keys, shortcuts)
- Dashboard with statistics overview
- Export with format selection
- Internationalization (Chinese/English)
- Design language: 古卷·灯火 (Ancient Scroll · Lamplight)
