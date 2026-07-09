# Lumora 软件工程计划 (SE-PLAN)

## 1. 概要需求 (High-Level Requirements)
**愿景**: 打造一个基于 AI 辅助的图片管理工具。
**核心价值**:
- **语义搜索**: 通过向量嵌入检索图片内容。
- **本地优先**: 数据存储于本地，依托本地 Ollama 运行 AI 模型。
- **精心设计的美学**: 遵循"古卷·灯火"设计语言。

## 2. 详细设计概要
- **前端**: React 19 + Zustand 5 + Tailwind CSS v4
- **后端**: Rust (Tauri 2) + SQLite (FTS5 + sqlite-vec)
- **IPC**: Tauri Command 模式，严格分层。

## 3. 开发计划 (Development Plan)
| 阶段 | 核心产出 | 验收标准 |
| :--- | :--- | :--- |
| **Phase 1: 基础架构** | 数据库 Schema, Tauri IPC 骨架 | `cargo check` 通过 |
| **Phase 2: 核心功能** | 图片导入, 列表展示, 标签系统 | 全部单元测试通过 |
| **Phase 3: AI 集成** | 嵌入生成, 语义搜索, Ollama 交互 | 端到端功能可用 |
| **Phase 4: 体验优化** | 仪表盘, 导出, 快捷键, 动效 | 视觉走查通过 |

## 4. 迭代规范
- **TDD**: 先写失败测试 -> 实现 -> 重构。
- **代码审查**: 合并前必须通过 `tsc` + `cargo check` + `vitest`。
- **版本号**: 遵循 Semver (v0.x.y)。

## 5. 部署架构
- **CI**: GitHub Actions (ubuntu-latest 上运行测试)。
- **Release**: GitHub Actions (Windows/Linux/macOS 三平台构建)。
- **产物**: MSI + EXE (Windows), AppImage + DEB (Linux), DMG (macOS)。
- **签名**: tauri.conf.json 配置了 minisign 公钥，updater JSON 当前使用空签名。
- **自动更新**: 集成 tauri-plugin-updater，通过 GitHub Releases 分发。
- **环境变量**:
  - `OLLAMA_HOST`: Ollama 服务地址 (默认 `localhost:11434`)。
