# Lumora 项目事实（agent 速查）

供 Hermes / Codex / Claude Code 在本项目工作时快速定位，细节以源文件为准。

- 文档入口：先读 `ARCHITECTURE.md`（代码地图 / 数据模型 / IPC / 测试结构），再看 `DESIGN.md`、`CLAUDE.md`。
- 分支：`main` 公开且受保护。
- CI：GitHub Actions（frontend + rust）。
- 发版：GitHub Releases 自动更新，`minisign` 签名。
- CSP：`self` + `localhost:*` + `github.com` + `fonts.googleapis.com`。
- Ollama：host 由环境变量 `OLLAMA_HOST` 指定（默认 `localhost:11434`）。
