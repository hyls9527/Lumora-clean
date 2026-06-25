# Phase 007: Rust Data Layer - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

构建 Lumora 的持久化本地存储层——SQLite 数据库、FTS5 全文搜索、版本化 Schema 迁移、文件系统操作（批量导入、文件夹扫描）、缩略图生成、设置持久化。这是 Lumora 从纯前端 SPA 到 Tauri 桌面应用的第一步，`src-tauri/` 从零搭建。

**输入：** 用户在文件系统中选择的图片文件/文件夹
**输出：** 持久化的图片库——图片副本、缩略图、元数据、全文搜索索引、用户设置——全部在应用重启后保持
</domain>

<decisions>
## Implementation Decisions

### 缩略图生成

- **D-01:** 导入时立刻生成缩略图，不延迟。好处：画廊打开就是完整的，无需等待。
- **D-02:** 轻量级缩略图（~20KB/张 512px webp）。详情面板显示原图，缩略图只需满足网格浏览清晰度。
- **D-03:** 缩略图生成失败 → 在画廊标记该图片失败状态，提供"重新生成"按钮供用户手动重试。
- **D-04:** 缩略图存为单独文件（`thumbnails/` 子目录），不嵌入数据库。原图文件本身也独立存放——不存在"只备份一个文件"的优势场景。
- **D-05:** 批量导入显示整体进度（"正在处理 12/50"），不逐张展示。
- **D-06:** BMP/TIFF 在导入时自动转 PNG 保存——浏览器不能原生显示这两种格式。
- **D-07:** 全格式支持导入：JPG、PNG、WebP、GIF、SVG、BMP、TIFF。

### 文件管理

- **D-08:** 导入图片复制到 Lumora 数据夹（非引用原始路径）。原始文件删除/移动不影响 Lumora。
- **D-09:** 文件大小上限由用户在设置中自行调整。默认值由 Claude 自行决定。
- **D-10:** 删除为软删除（进回收站）。永久删除/清空回收站时，原图+缩略图+数据库记录一起清理。
- **D-11:** 重复图片（内容完全一致的文件）：跳过并提示"已跳过 X 张重复图片"。
- **D-12:** 同名文件冲突：自动加序号（`IMG_0001.jpg` → `IMG_0001_2.jpg`）。
- **D-13:** 磁盘空间耗尽：弹窗警告，询问用户保留已成功的图片还是全部回滚。
- **D-14:** 文件夹导入递归所有子文件夹。
- **D-15:** 非图片文件和快捷方式：跳过并在导入完成后告知统计信息。

### 数据完整性

- **D-16:** 每次启动扫描检查文件是否存在，缺失的图片在画廊打"文件缺失"标记。
- **D-17:** 数据库升级到一半崩溃（断电等）→ 自动修复能力由 Claude 根据 SQLite 最佳实践设计。

### Settings 持久化

- **D-18:** 首次启动自动迁移浏览器 localStorage 中的旧设置（语言、主题、网格列数）到新存储。用户无感升级。
- **D-19:** 设置存储结构预留后续项（缩略图质量、并发数、AI 超时等），避免后续 Phase 改数据库结构。
- **D-20:** 需要"恢复默认设置"功能，放置在设置页面底部。
- **D-21:** 设置值需要范围验证（如网格列数 1-10，文件上限 1-500MB）。

### 数据目录 & 生命周期

- **D-22:** 数据（数据库+图片+缩略图）放在 Lumora 安装目录旁边——便携式设计，拷贝整个文件夹即可迁移到另一台电脑。
- **D-23:** 卸载 Lumora 时询问用户是否保留数据文件。

### 前端代码清理

- **D-24:** Phase 7 修复现有代码中断连的 `isTauri()` 调用（`app-store.ts` 6 处 + `DropZone.tsx` 2 处）。不等 Phase 9。

### Claude's Discretion

以下领域由 Claude（planner/researcher/executor）根据最佳实践自行决策：

- **数据库 Schema 设计** — 表结构、列类型、索引策略、外键约束、FTS5 内容同步机制（触发器 vs 应用层）
- **Tauri 命令接口设计** — Rust 命令函数签名如何映射到 `src/lib/api/images.ts` 现有 API 桩；一次性全部替换还是先核心 CRUD
- **数据库迁移执行时机** — 应用启动时阻塞运行 vs 延迟运行；迁移失败的回滚/恢复策略
- **首次使用体验** — 空数据库时画廊显示什么（引导页 vs 空状态+导入按钮）
- **写入权限备选** — 安装目录无写入权限时的降级方案（自动切到用户数据目录）
- **日志文件** — 位置、级别、大小上限、自动清理策略
- **备份入口** — 设置页是否需要"打开数据文件夹"按钮
- **大图库性能** — 哪些操作必须在后台线程执行（缩略图生成、启动扫描、FTS5 批量索引）；分页策略（已有 react-window 虚拟滚动）
- **文件大小默认上限** — 初始值（建议 200MB）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目核心
- `CLAUDE.md` — 项目级指令：三层设计架构、Commands、设计语言规则
- `DESIGN.md` — 古卷·灯火设计系统：色彩/字体/间距/反模式
- `.planning/ROADMAP.md` — Phase 007 目标、成功标准（SC1-SC5）、依赖关系
- `.planning/REQUIREMENTS.md` — RDL-01 至 RDL-05 需求定义
- `.planning/STATE.md` — 项目状态：已锁定决策（IPC 方式、向量存储、Ollama 策略、迁移工具、打包目标）

### Phase 7 上游依赖
- Phase 006: AI Analysis Panel（最后完成的前端 Phase）— 输出 AI-SPEC.md，定义了新的 Zustand store 和 UI 组件

### 代码库映射
- `.planning/codebase/ARCHITECTURE.md` — 组件职责、数据流、状态管理、入口点、反模式（特别是 isTauri 断连调用和死代码）
- `.planning/codebase/STACK.md` — 技术栈：Vite+React19+TS+TailwindCSSv4+Zustand，无后端
- `.planning/codebase/INTEGRATIONS.md` — 当前纯前端，无外部服务依赖，API 层为空桩

### 前端集成点（planner 必须了解）
- `src/lib/api/images.ts` — 现有 API 桩定义（getImages, importFolder, searchImages, deleteImage 等）
- `src/lib/api/settings.ts` — 现有 localStorage 设置读写
- `src/stores/app-store.ts` — 主 Zustand store（isTauri 断连调用所在）
- `src/stores/settings-store.ts` — 设置 store
- `src/lib/mock-data.ts` — Image 类型定义和模拟数据生成
- `src/components/DropZone.tsx` — 拖拽导入组件（含断连 isTauri 调用）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Image 类型 (`src/lib/mock-data.ts:31-52`)**: 前端核心数据模型——id, path, thumbnail, width, height, sizeKb, format, rating, favorite, tags[], createdAt, aspectRatio, analysis, score。Rust 端数据库 Schema 应与此结构对齐。
- **ImageRecord 类型 (`src/lib/api/images.ts:2-14`)**: 已定义 snake_case 数据库记录形状——说明前端团队已考虑后端对接。
- **recordToImage() (`src/stores/app-store.ts:7-21`)**: 现有 snake_case → camelCase 转换函数，可直接复用。
- **PlumFlower SVG**: 评分组件在 DetailPanel 和 ImageCard 中各有一份——Phase 7 后端不影响其展示逻辑。

### Established Patterns
- **Zustand 单例模式**: 两个全局 store（app-store, settings-store），所有组件直接引用——Tauri IPC 接入后 store 的 action 实现需要改写。
- **乐观更新**: 前端先更新 UI，再调 API——Rust 命令失败时需回滚前端状态。
- **window.dispatchEvent 事件总线**: 跨组件通信的临时方案——Tauri 接入后可逐步替换为 store 驱动。
- **错误处理**: `console.error()` + 内联错误状态 + ErrorBoundary——Rust 端错误需映射为前端可读的消息。

### Integration Points
- **`src/stores/app-store.ts`**: 所有图片 CRUD 操作（loadImages, toggleFavorite, setRating, deleteImage 等）——Phase 7 需为这些操作构建 Tauri 命令，Phase 9 完成前端连接。
- **`src/lib/api/images.ts`**: API 桩层——Tauri 命令的函数签名应与此文件接口对齐。
- **`src/lib/api/settings.ts`**: 设置读写——需迁移到 tauri-plugin-store 或自定义 SQLite 方案。
- **`src/components/DropZone.tsx`**: 导入入口——`handleClick` 和进度模拟逻辑需替换为真实 Tauri 文件对话框和实际导入进度。

</code_context>

<specifics>
## Specific Ideas

- 用户期望便携式体验——整个 Lumora 文件夹（应用+数据）拷贝到另一台电脑就能用
- 卸载时尊重用户选择——询问是否保留数据，而非强制删除或强制保留
- 所有用户可见的错误需要有可操作的建议（"文件缺失——点击重新定位"而非只显示错误代码）
- 设置页面应保持简洁，新增设置项（如文件大小上限）遵循现有布局风格

</specifics>

<deferred>
## Deferred Ideas

- **安装流程设计** → Phase 12（打包与验证）
- **卸载清理完整性** → Phase 12（由 Phase 7 的数据目录决策影响）
- **数据目录手动配置 UI** → 后续 Phase（当前便携式设计满足需求）
- **数据库手动备份/导出功能** → 后续 Phase
- **重复图片的哈希值去重细节** → Claude 自行选择（SHA-256、感知哈希等）

</deferred>

---

*Phase: 007-Rust-Data-Layer*
*Context gathered: 2026-06-22*
