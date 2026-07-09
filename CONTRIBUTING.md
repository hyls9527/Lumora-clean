# Contributing to Lumora

## 开发流程

1. 从 `main` 创建 feature 分支：`git checkout -b feature/xxx`
2. 提交遵循 [Conventional Commits](https://www.conventionalcommits.org/)：
   - `feat:` 新功能
   - `fix:` 修复
   - `refactor:` 重构
   - `test:` 测试
   - `docs:` 文档
3. 提交 PR，通过 CI 后合并

## 代码规范

### 前端 (React + TypeScript)

- TypeScript strict mode，零 `as any`
- 所有组件遵循 `DESIGN.md` 设计语言
- 写 UI 前必须读 `DESIGN.md` 和 `CLAUDE.md`
- i18n：所有用户可见文本必须有中英文

### 后端 (Rust)

- Domain 层尽量减少外部依赖（数据结构优先使用标准库类型）
- Commands 层保持薄适配器模式（复杂逻辑下沉到 Domain 层）
- 每个模块文件保持合理长度（超过 500 行考虑拆分）
- 所有写操作在事务内
- Clippy 零警告

### Python Sidecar

- JSON line-delimited 协议（stdin/stdout）
- pytest 测试覆盖

## 代码审查清单

- [ ] 架构门禁通过（Domain 零外部依赖、Commands 薄适配器）
- [ ] 测试覆盖新代码
- [ ] 无安全漏洞（hardcoded secrets、SQL injection、XSS）
- [ ] 接口注释完整
- [ ] i18n 键值正确
- [ ] 遵循 DESIGN.md（无 lucide 图标、无纯黑白、无 pill 按钮）

## 设计语言：古卷·灯火

所有 UI 变更必须遵循 `docs/DESIGN.md`。违反以下任何一条即拒绝合并：

- ❌ lucide-react 图标
- ❌ Inter 字体
- ❌ pill 按钮 (9999px)
- ❌ 纯黑 #000 / 纯白 #fff
- ❌ 紫色渐变
- ❌ 毛玻璃 glassmorphism
- ❌ 100ms 过渡
- ❌ 星星评分
- ❌ 红心收藏

## 架构原则

详见 `docs/ARCHITECTURE.md`：

- **Clean Architecture**：Commands → Domain ← Infra
- **深模块优先**：接口简单 > 文件数少
- **数据优先**：SQLite 单文件，FTS5 同源
- **集成点隔离**：外部调用（Ollama）有超时和错误处理
