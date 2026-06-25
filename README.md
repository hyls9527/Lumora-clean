# Lumora — 光之韵律

> AI 创作者的图片管理器 · 古卷·灯火设计语言

Lumora 是一个本地优先、隐私至上的 AI 图片管理桌面应用，服务于 AI 创作者（Stable Diffusion / Midjourney / ComfyUI 用户）。

## 项目结构

```
lumora-secondary-pages/
├── pages/                  # 前端 UI 设计稿（静态 HTML 高保真原型）
│   ├── gallery.html        # 创作者图库
│   ├── curation.html       # 策展
│   ├── dashboard.html      # 仪表盘
│   ├── settings.html       # 设置
│   ├── search.html         # 搜索
│   ├── artwork-detail.html # 作品详情
│   ├── prompts.html        # Prompts 管理
│   ├── favorites.html      # 收藏
│   ├── trash.html          # 回收站
│   ├── import.html         # 导入
│   └── normal-gallery.html # 标准图库
├── assets/                 # 设计稿图片资源
├── docs/                   # 项目文档
│   ├── ARCHITECTURE.md     # 架构设计（技术栈、数据模型、IPC 契约）
│   ├── DESIGN.md           # 设计语言规范（色彩、字体、圆角、阴影）
│   ├── CLAUDE.md           # Claude Code 工作指南
│   ├── README.md           # 文档索引
│   └── .planning/          # 里程碑、阶段计划、需求、审计
├── lumora-secondary-pages.design  # 设计工具源文件
└── orchestration-summary.json     # 页面编排元数据
```

## 技术栈

| 层 | 选型 |
|---|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19 + TypeScript + Tailwind CSS v4 |
| 状态管理 | Zustand 5 |
| 数据库 | SQLite (rusqlite) + FTS5 + sqlite-vec |
| AI 推理 | Python sidecar (CLIP via open-clip-torch) + Ollama (可选) |
| 打包 | Windows .msi (PyInstaller for Python sidecar) |

## 设计语言：古卷·灯火

高级、克制、安静、宏大、神圣、怀旧、诗意、传说感。

- **色彩：** 象牙纸页 `#f2ede4` + 研磨墨 `#2a2118` + 古铜包浆 `#7a5c12`
- **字体：** Noto Serif SC（标题）+ DM Sans（正文）
- **评分：** 梅花印 SVG（不用星星）
- **收藏：** 藏书印 ◆（不用红心）

详见 [`docs/DESIGN.md`](docs/DESIGN.md)。

## 里程碑

| 版本 | 状态 | 内容 |
|------|------|------|
| **v0.1** MVP Frontend | ✅ shipped 2026-06-21 | 图库、策展、命令面板、键盘导航、评分收藏 |
| **v0.2** AI-Ready Frontend | ✅ shipped 2026-06-21 | 嵌入状态、语义搜索 UI、AI 分析面板（mock 数据） |
| **v0.3** Tauri Backend | ✅ completed 2026-06-23 | SQLite 持久化、Python CLIP、Ollama 分析、sqlite-vec、Windows .msi |

详见 [`docs/.planning/ROADMAP.md`](docs/.planning/ROADMAP.md)。

## 开发

```bash
# 安装依赖
npm ci

# 开发服务器
npm run dev

# TypeScript 类型检查
npx tsc --noEmit

# 生产构建
npm run build

# Tauri 桌面构建
cargo tauri build --bundles msi
```

### Python Sidecar 构建

```bash
cd src-tauri/sidecar
pip install -r requirements.txt
python build.py
```

## 文档索引

| 文档 | 用途 |
|------|------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构、数据模型、IPC 契约、验收标准 |
| [DESIGN.md](docs/DESIGN.md) | 设计语言规范 |
| [CLAUDE.md](docs/CLAUDE.md) | AI 编码助手工作规则 |
| [REQUIREMENTS.md](docs/.planning/REQUIREMENTS.md) | v0.3 需求追踪矩阵 |
| [ROADMAP.md](docs/.planning/ROADMAP.md) | 里程碑路线图 |
| [SECURITY.md](docs/.planning/audits/SECURITY.md) | 安全审计 |
| [UI-REVIEW.md](docs/.planning/audits/UI-REVIEW.md) | UI 审计 |

## License

MIT
