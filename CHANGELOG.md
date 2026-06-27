# CHANGELOG

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
