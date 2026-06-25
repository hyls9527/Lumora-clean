# Changelog

All notable changes to Lumora are documented here.

## [v0.3] — 2026-06-23

Tauri Backend — 从纯前端 SPA 桌面化为完整 Tauri 应用。

### Added
- SQLite 持久化存储（rusqlite + 版本化 schema 迁移链 v1-v7）
- FTS5 全文搜索（中文 jieba 分词）
- Python AI Sidecar（CLIP ViT-B-32 嵌入生成，PyInstaller 打包）
- JSON-RPC 2.0 stdin/stdout 进程间通信
- Tauri IPC invoke() 替换所有 mock API stub
- sqlite-vec 向量存储 + 穷举 KNN 语义搜索
- Ollama 视觉模型集成（自动检测，可选）
- AI 分析：图片描述、标签建议、分析历史
- 原生文件夹选择器导入
- 设置持久化（tauri-plugin-store）
- 缩略图生成（512x512 webp）
- Windows .msi 安装包构建
- GitHub Actions CI 流水线
- 32 项 E2E 冒烟测试脚本

### Architecture
- 20 个 Tauri commands（CRUD、搜索、设置、分析）
- SidecarManager — Python 进程生命周期管理
- 健康检查：30s ping 间隔
- 批量嵌入：4 线程 ThreadPool

### Tests
- Rust: 16 passed
- Python: 36 passed (4 skipped)
- Vector: 7 passed
- TypeScript: 0 errors

## [v0.2] — 2026-06-21

AI-Ready Frontend — AI 功能 UI 层（mock 数据）。

### Added
- 嵌入状态指示器（embedded ✓ / pending ○ / error ✗）
- 语义搜索栏（自然语言查询 + 相似度分数）
- AI 分析面板（描述、标签建议、内容分析、历史）
- 批量嵌入进度条
- API stub 层（完整模拟 AI 后端接口）
- Zustand AI stores（embedding、semantic-search、ai-analysis）

## [v0.1] — 2026-06-21

MVP Frontend — 古卷·灯火图片管理器。

### Added
- 图片网格（虚拟化瀑布流/网格布局）
- 策展流程（keep/maybe/reject）
- 仪表盘（统计概览）
- 设置页面（语言切换、快捷键参考）
- 回收站（软删除）
- ⌘K 命令面板（本地搜索过滤）
- 键盘导航（方向键、Enter、Space、F 收藏）
- 拖放导入 + Toast 通知系统
- 梅花印评分（SVG 18x18）
- 藏书印收藏（◆）
- i18n：中文 + 英文
- DESIGN.md 设计语言规范
- 零 TypeScript 错误、零 ESLint 警告
