# Lumora — 光之韵律

[![CI](https://github.com/hyls9527/Lumora-clean/actions/workflows/ci.yml/badge.svg)](https://github.com/hyls9527/Lumora-clean/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.0-blue)](CHANGELOG.md)

> AI 创作者的图片管理器 · 古卷·灯火设计语言

Lumora 是一个本地优先、隐私至上的 AI 图片管理桌面应用，服务于 AI 创作者（Stable Diffusion / Midjourney / ComfyUI 用户）。

![Lumora 演示](media/lumora-showcase.gif)

## 项目结构

```
Lumora-clean/
├── src/                          # 前端源码
│   ├── components/ui/            # UI 组件（ImageCard, DetailModal, CommandPalette 等）
│   ├── features/                 # 页面模块（gallery, search, dashboard, import, export, settings, trash, tags）
│   ├── stores/                   # Zustand 状态管理（imageStore, trashStore, settingsStore 等）
│   ├── lib/api/                  # API 层（images.ts, ai.ts, embeddings.ts, semantic.ts）
│   ├── hooks/                    # 自定义 hooks（useKeyboardNav）
│   └── lib/tauri.ts              # Tauri invoke 包装器（浏览器/Tauri 双模式）
├── src-tauri/                    # Rust 后端
│   ├── src/commands/             # Tauri commands（images, ai, embeddings, tags, trash, dashboard, export, settings）
│   ├── src/db/                   # 数据库层（migrations, schema）
│   └── src/schema/               # 类型定义
├── tests/                        # 骨架测试
└── docs/                         # 文档
```

## 技术栈

| 层 | 选型 |
|---|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19 + TypeScript + Tailwind CSS v4 |
| 状态管理 | Zustand 5 |
| 数据库 | SQLite (rusqlite) + FTS5 + sqlite-vec |
| AI 推理 | Ollama（nomic-embed-text embedding + llava 图片分析） |
| 打包 | Windows .msi + .exe |

## 设计语言：古卷·灯火

高级、克制、安静、宏大、神圣、怀旧、诗意、传说感。

- **色彩：** 象牙纸页 `#f2ede4` + 研磨墨 `#2a2118` + 古铜包浆 `#7a5c12`
- **字体：** Noto Serif SC（标题）+ DM Sans（正文）
- **评分：** 梅花印 SVG（不用星星）
- **收藏：** 藏书印 ◆（不用红心）

详见 [`DESIGN.md`](DESIGN.md)。

## 里程碑

| 版本 | 状态 | 内容 |
|------|------|------|
| **v0.1** MVP Frontend | ✅ shipped | 图库、策展、命令面板、键盘导航、评分收藏 |
| **v0.2** AI-Ready Frontend | ✅ shipped | 嵌入状态、语义搜索 UI、AI 分析面板 |
| **v0.3** Tauri Backend | ✅ shipped | SQLite 持久化、Ollama 集成、sqlite-vec、Windows .msi |

## 测试

```bash
# 前端测试（159 个）
npx vitest run

# Rust 测试（18 个）
cd src-tauri && cargo test --lib

# TypeScript 类型检查
npx tsc --noEmit
```

**当前状态：177 测试全绿（18 Rust + 159 TypeScript）**

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
cargo tauri build
```

### Ollama 配置

语义搜索和 AI 分析需要 Ollama：

```bash
# 安装 Ollama
# https://ollama.com/download

# 拉取 embedding 模型
ollama pull nomic-embed-text

# 拉取视觉模型（用于图片分析）
ollama pull llava
```

## 文档索引

| 文档 | 用途 |
|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统架构、数据模型、IPC 契约 |
| [DESIGN.md](DESIGN.md) | 设计语言规范 |
| [CLAUDE.md](CLAUDE.md) | AI 编码助手工作规则 |

## License

MIT
