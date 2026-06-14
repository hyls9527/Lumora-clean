# Lumora — 架构设计文档

> 光之韵律 · AI 创作者的图片管理器

**版本:** 1.0.0
**日期:** 2026-06-13
**状态:** Draft → 待审批

---

## 1. 项目定位

**一句话：** 本地优先、隐私至上的 AI 图片管理桌面应用，服务于 AI 创作者（Stable Diffusion / Midjourney / ComfyUI 用户）。

**核心价值：** 管理器才是最难做的。先把管理器做到极致，AI 和创作工具是锦上添花。

**目标用户：**
- 主力：AI 图片创作者（拥有 1 万 - 10 万张生成图片）
- 次要：摄影师、设计师、数字收藏家

**竞品差异：**
- vs Eagle：更强的 AI 搜索和元数据提取
- vs Pixea：跨平台 + 开源
- vs ArcaneCodex：从零开始，干净架构，不背技术债

---

## 2. 技术栈

| 层 | 选型 | 版本 | 理由 |
|---|------|------|------|
| 桌面框架 | Tauri 2 | 2.11+ | 2-10MB 包体、Windows WebView2 优秀、Rust 性能 |
| 前端 | React 18 + TypeScript | 18.3+ | 生态最大、虚拟化库成熟 |
| 构建 | Vite | 5.x | 快速 HMR、ESBuild |
| 样式 | Tailwind CSS | 3.x | 原子化 CSS、设计系统友好 |
| 状态管理 | Zustand | 5.x | 轻量、TypeScript 友好 |
| 数据库 | SQLite | 3.x (via rusqlite) | 单文件、零配置、嵌入式 |
| 搜索 | SQLite FTS5 | 内置 | 与主 DB 同源、零一致性成本 |
| 中文分词 | jieba-rs | — | FTS5 tokenizer 扩展 |
| CLIP | ONNX Runtime (ort crate) | 2.0+ | 本地推理、GPU 加速 |
| LLM | Ollama (可选) | — | 自动 GPU、结构化输出 |
| 测试前端 | Vitest | 2.x | 快速、兼容 Jest API |
| 测试后端 | cargo test + proptest | — | 标准 Rust 测试 |
| E2E | Playwright | 1.x | 跨浏览器、Tauri WebView 支持 |

**不使用：**
- ~~Tantivy~~ — FTS5 替代，减少一个存储引擎
- ~~ONNX 进程外~~ — Ollama 不支持 CLIP，必须用 ort 进程内
- ~~Electron~~ — 包体太大

---

## 3. 架构原则

### 3.1 依赖规则（Clean Architecture）

```
Commands → Domain ← Infra
  (薄)      (纯)     (IO)
```

- **依赖向内指**：Commands 依赖 Domain，Infra 依赖 Domain，Domain 不依赖任何外部
- **Domain 是纯函数**：无 IO、无 Tauri、无 SQL、无网络
- **Commands 是适配器**：只做参数校验 + 调用 Domain/Infra
- **Infra 是实现细节**：数据库、搜索、AI、文件系统

### 3.2 深模块优先（Software Design Philosophy）

> "Deep modules: powerful functionality behind a simple interface"

- 不追求文件行数最少，追求**接口最简单**
- 一个文件做一件事，接口 ≤5 个公共函数
- 反对 classitis：不拆 10 个 50 行的浅模块，宁可 1 个 400 行的深模块
- 行数上限：**500 行**，但以职责划分为准，不以行数为准

### 3.3 数据优先（DDIA）

> "Data outlives code."

- SQLite 单文件 = 备份、迁移、恢复最简
- FTS5 与主 DB 同源 = 零一致性成本
- Schema 迁移必须向前兼容
- 所有写操作必须在事务内

### 3.4 集成点隔离（Release It!）

> "Integration points are the number-one killer."

- 每个外部调用（Ollama、ComfyUI、文件系统）必须有超时
- AI 推理失败 ≠ 应用崩溃，必须有降级路径
- 连接池有上限，不能无限增长

---

## 4. 项目结构

```
lumora/
├── src/                          # 前端 (React + TypeScript)
│   ├── App.tsx                   # 路由 + 布局
│   ├── main.tsx                  # 入口
│   ├── lib/
│   │   ├── api/                  # Tauri IPC 调用层
│   │   │   ├── images.ts         # 图片相关 API
│   │   │   ├── search.ts         # 搜索 API
│   │   │   ├── tags.ts           # 标签 API
│   │   │   ├── export.ts         # 导出 API
│   │   │   └── settings.ts       # 设置 API
│   │   ├── hooks/                # 自定义 hooks
│   │   └── utils/                # 工具函数
│   ├── stores/                   # Zustand 状态管理
│   │   ├── imageStore.ts
│   │   ├── filterStore.ts
│   │   ├── uiStore.ts
│   │   └── settingsStore.ts
│   ├── features/                 # 功能模块
│   │   ├── gallery/              # 图库
│   │   ├── import/               # 导入
│   │   ├── search/               # 搜索
│   │   ├── tags/                 # 标签
│   │   ├── export/               # 导出
│   │   ├── settings/             # 设置
│   │   └── dashboard/            # 仪表盘
│   ├── components/               # 共享组件
│   └── i18n/                     # 国际化
│       ├── en.json
│       ├── zh.json
│       └── ja.json
│
├── src-tauri/                    # 后端 (Rust)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── lib.rs                # 入口 + 组装 (≤200 行)
│   │   ├── state.rs              # AppState 定义
│   │   │
│   │   ├── domain/               # 纯业务逻辑 (无 IO)
│   │   │   ├── mod.rs
│   │   │   ├── image.rs          # Image 实体 + 规则
│   │   │   ├── tag.rs            # 标签规则
│   │   │   ├── search.rs         # 搜索逻辑
│   │   │   └── export.rs         # 导出逻辑
│   │   │
│   │   ├── infra/                # 基础设施实现
│   │   │   ├── mod.rs
│   │   │   ├── db.rs             # SQLite 连接池 + 迁移
│   │   │   ├── search.rs         # FTS5 索引 + jieba 分词
│   │   │   ├── clip.rs           # ONNX CLIP 实现
│   │   │   ├── ollama.rs         # Ollama LLM 实现 (可选)
│   │   │   ├── fs.rs             # 文件系统操作
│   │   │   └── thumbnail.rs      # 缩略图生成
│   │   │
│   │   ├── commands/             # Tauri 命令层 (薄适配器)
│   │   │   ├── mod.rs            # 命令注册
│   │   │   ├── images.rs         # 图片命令
│   │   │   ├── search.rs         # 搜索命令
│   │   │   ├── tags.rs           # 标签命令
│   │   │   ├── export.rs         # 导出命令
│   │   │   ├── import.rs         # 导入命令
│   │   │   └── settings.rs       # 设置命令
│   │   │
│   │   └── schema/               # 共享类型定义
│   │       └── types.rs          # IPC 契约类型
│   │
│   └── tests/                    # Rust 测试
│       ├── integration/
│       └── fixtures/
│
├── tests/                        # 前端测试
│   ├── unit/
│   └── e2e/
│
├── scoring-engine/               # 评分引擎 (独立 crate，后续阶段)
├── ARCHITECTURE.md               # 本文件
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── tailwind.config.ts
└── CLAUDE.md                     # Claude Code 工作指南
```

---

## 5. 数据模型

### 5.1 SQLite Schema (核心表)

```sql
-- 图片表
CREATE TABLE images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,
    file_size_kb INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    format TEXT NOT NULL,          -- 'png', 'jpg', 'webp', 'avif'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    rating INTEGER DEFAULT 0,      -- 0-5
    favorite INTEGER DEFAULT 0,
    llm_json TEXT,                 -- AI 分析结果 JSON
    clip_vector BLOB,              -- CLIP 嵌入向量 (512 * f32)
    metadata_json TEXT              -- EXIF/生成参数 JSON
);

-- 标签表
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    parent_id INTEGER REFERENCES tags(id),
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 图片-标签关联表
CREATE TABLE image_tags (
    image_id INTEGER NOT NULL REFERENCES images(id),
    tag_id INTEGER NOT NULL REFERENCES tags(id),
    PRIMARY KEY (image_id, tag_id)
);

-- 应用配置表
CREATE TABLE app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- FTS5 虚拟表
CREATE VIRTUAL TABLE images_fts USING fts5(
    file_path,
    metadata_json,
    llm_json,
    content='images',
    content_rowid='id'
);

-- 索引
CREATE INDEX idx_images_file_hash ON images(file_hash);
CREATE INDEX idx_images_rating ON images(rating) WHERE deleted = 0;
CREATE INDEX idx_images_created ON images(created_at) WHERE deleted = 0;
CREATE INDEX idx_image_tags_tag ON image_tags(tag_id);
```

### 5.2 Schema 迁移策略

- 版本号存储在 `app_config` 表的 `schema_version` 键
- 启动时检查版本号，按序执行迁移脚本
- 每个迁移必须是**向前兼容的**（expand-contract 模式）
- 迁移失败 = 回滚 + 错误提示，不启动应用

---

## 6. IPC 契约

### 6.1 命令命名规范

```
#[tauri::command]
async fn command_name(request: CommandRequest) -> Result<CommandResponse, String>
```

- 所有命令参数包装在 `request` 结构体中
- 所有命令返回 `Result<T, String>`
- 错误信息用户友好（中文），日志包含技术细节

### 6.2 类型共享

Rust 端定义类型 → 导出 JSON Schema → 生成 TypeScript 类型

```rust
// schema/types.rs
#[derive(Serialize, Deserialize, JsonSchema)]
pub struct ImageRecord {
    pub id: i64,
    pub file_path: String,
    pub file_hash: String,
    pub file_size_kb: i64,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub format: String,
    pub created_at: String,
    pub rating: i32,
    pub favorite: bool,
    pub llm_json: Option<String>,
    pub metadata_json: Option<String>,
}
```

构建时自动生成 `src/lib/api/types.ts`，消除 TypeScript 类型错误。

---

## 7. MVP 范围 (v0.1)

### 7.1 功能清单

| 功能 | 优先级 | 描述 |
|------|--------|------|
| 文件夹导入 | P0 | 递归扫描、格式检测、缩略图生成 |
| 图片网格 | P0 | 虚拟化瀑布流/网格布局 |
| 图片详情 | P0 | 侧边栏展示元数据、生成参数 |
| 搜索 | P0 | FTS5 全文搜索 + 结构化过滤 |
| 标签 | P0 | CRUD + 图片关联 + 标签树 |
| 导出 | P0 | 格式选择、范围选择、重命名模板 |
| 评分 | P1 | 1-5 星评分 + 收藏 |
| 设置 | P1 | 主题、语言、快捷键 |
| 仪表盘 | P1 | 统计概览 |
| 拖放导入 | P1 | 拖拽文件/文件夹到窗口 |
| 回收站 | P1 | 软删除 + 30 天保留 |

### 7.2 不在 MVP 范围

| 功能 | 原因 | 计划版本 |
|------|------|----------|
| AI 分析 (CLIP/LLM) | 需要 ONNX 集成，复杂度高 | v0.2 |
| 语义搜索 | 依赖 CLIP | v0.2 |
| 策展/评分系统 | 依赖 AI 分析 | v0.3 |
| 重复检测 | 需要感知哈希 | v0.3 |
| 变体管理 | 依赖 AI 分析 | v0.3 |
| 备份/恢复 | 非核心功能 | v0.4 |
| ComfyUI 集成 | 非核心功能 | v0.5 |

---

## 8. 验收标准

### 8.1 代码质量门禁

| 检查 | 命令 | 标准 |
|------|------|------|
| TypeScript 编译 | `npx tsc --noEmit` | 0 errors |
| 前端测试 | `npx vitest run` | 全部通过 |
| Rust 编译 | `cargo check` | 0 errors |
| Rust 测试 | `cargo test --lib` | 全部通过 |
| Clippy | `cargo clippy -- -D warnings` | 0 warnings |
| 格式化 | `cargo fmt --check` + `prettier --check src/` | 0 diff |

### 8.2 架构门禁

| 检查 | 标准 | 验证方法 |
|------|------|----------|
| Domain 层零外部依赖 | `domain/` 不 import tauri/sqlite/ort | grep 检查 |
| Commands 层薄适配器 | 每个命令函数 ≤30 行 | 代码审查 |
| 文件行数 | 每个模块文件 ≤500 行 | `wc -l` |
| 接口简洁性 | 每个模块 ≤5 个 pub 函数 | 代码审查 |
| 无 `.lock().unwrap()` | 非测试代码零调用 | grep 检查 |
| 无 `as any` | TypeScript 零类型断言 | grep 检查 |

### 8.3 功能验收标准 (MVP)

| 功能 | 验收条件 |
|------|----------|
| 文件夹导入 | 选择文件夹 → 扫描 → 显示进度 → 完成后图库有图片 |
| 图片网格 | 1000 张图片流畅滚动 (60fps)、缩略图正确显示 |
| 图片详情 | 点击图片 → 侧边栏显示路径/大小/尺寸/格式/元数据 |
| 搜索 | 输入关键词 → 100ms 内返回结果、支持中文 |
| 标签 | 创建标签 → 关联图片 → 按标签过滤 → 删除标签 |
| 导出 | 选择图片 → 选择格式/目标 → 导出成功 |
| 评分 | 点击星级 → 评分保存 → 按评分排序 |
| 设置 | 切换主题/语言 → 立即生效 → 重启后保持 |
| 仪表盘 | 显示总图片数/存储占用/格式分布 |
| 拖放导入 | 拖拽文件到窗口 → 自动导入 |
| 回收站 | 删除图片 → 进入回收站 → 恢复/永久删除 |

### 8.4 性能基准

| 指标 | 目标 | 测试方法 |
|------|------|----------|
| 冷启动时间 | ≤2s (1000 张图) | 计时 |
| 图片网格渲染 | ≤500ms (1000 张) | Performance API |
| 搜索延迟 | ≤100ms (10000 张) | 计时 |
| 导入速度 | ≥50 张/秒 (含缩略图) | 计时 |
| 内存占用 | ≤200MB (10000 张) | 任务管理器 |
| 安装包大小 | ≤20MB | 文件大小 |

---

## 9. 开发工作流

### 9.1 Git 规范

- 分支：`main` (稳定) + `dev` (开发) + `feature/*` (功能)
- 提交：Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`)
- PR：每个功能一个 PR，通过 CI 后合并

### 9.2 测试策略

- **Domain 层**：100% 单元测试覆盖（纯函数，最容易测）
- **Infra 层**：集成测试（需要真实 SQLite/文件系统）
- **Commands 层**：通过 Tauri mock 测试
- **前端**：组件测试 (Vitest + Testing Library) + E2E (Playwright)

### 9.3 代码审查

每次 PR 必须检查：
- [ ] 架构门禁通过
- [ ] 测试覆盖新代码
- [ ] 无安全漏洞 (hardcoded secrets, SQL injection, XSS)
- [ ] 接口注释完整
- [ ] i18n 键值正确

---

## 10. 里程碑路线图

| 版本 | 主题 | 核心功能 | 预计时间 |
|------|------|----------|----------|
| **v0.1** | 管理器 MVP | 导入/图库/搜索/标签/导出 | — |
| **v0.2** | AI 增强 | CLIP 嵌入 + 语义搜索 + Ollama 分析 | — |
| **v0.3** | 策展 | 评分/重复检测/变体管理 | — |
| **v0.4** | 健壮性 | 备份/恢复/性能优化/错误恢复 | — |
| **v0.5** | 生态 | ComfyUI 集成/Prompt 管理/训练数据导出 | — |
| **v1.0** | 发布 | 完整功能 + 文档 + 安装包 | — |

---

*本文档是 Lumora 的架构基线。所有实现必须遵循本文档定义的结构、原则和验收标准。*
