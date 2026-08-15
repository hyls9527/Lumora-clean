# Lumora 项目事实（agent 速查）

供 Hermes / Codex / Claude Code 在本项目工作时快速定位，细节以源文件为准。

- 文档入口：先读 `ARCHITECTURE.md`（代码地图 / 数据模型 / IPC / 测试结构），再看 `DESIGN.md`、`CLAUDE.md`。
- 分支：`main` 公开且受保护。
- CI：GitHub Actions（frontend + rust）。
- 发版：GitHub Releases 自动更新，`minisign` 签名。
- CSP：`self` + `localhost:*` + `github.com` + `fonts.googleapis.com`。
- Ollama：host 由环境变量 `OLLAMA_HOST` 指定（默认 `localhost:11434`）。

## CI / 发布速查（v0.10.1 排障沉淀，先读再动手）

- **平台差异**：本地 Windows 全绿 ≠ CI 绿。`reqwest` 的 native-tls 在 Linux 编译 `openssl-sys` 需要系统 `libssl-dev + pkg-config`（ci.yml / release.yml 的 apt 步骤已加）；只有 Rust cache miss 全量编译时才暴露，cache 命中会被掩盖。
- **测试跨平台铁律**：Rust 测试断言命令/路径/环境行为时，必须同时覆盖 unix 与 windows 分支。教训：`sidecar_command_targets_the_script` 曾只按 Windows 的 `python <script>` 包装断言 `args.len()==1`，Linux 直接执行脚本 args 为空 → CI panic（现改为 program+args 任一含脚本名）。
- **CI 排障通道**：网络受限时 Actions 日志网页不可读。ci.yml / release.yml 的 Rust tests 失败会自动把错误摘要写入 check-run annotation——优先从 API 读 `GET /repos/{owner}/{repo}/check-runs/{id}/annotations`，不要猜。
- **发布签名前提**：tauri v2 必须 `tauri.conf.json` 的 `bundle.createUpdaterArtifacts = true` 才会生成 `.sig` 文件（注意不是 v1 的 `bundle.updater.active`——v2 的 bundle 无 `updater` 字段，写了会报 unknown field）。发布后必须验证：release 资产含 `.sig`、`latest.json` 的 signature 非空（v0.8.1~v0.10.1 曾长期缺失该配置，自动更新签名验证静默失效；updater-json job 现已加签名空检查，签名缺失会阻断发布）。
- **网络特性**：gh-proxy.com 只放行 git 协议与间歇性 API（共享账号池，限流频繁）；直连 `api.github.com` / `github.com`（带 `HKCU:\Environment` 的 `GITHUB_TOKEN`）可用时**优先直连**——自己的 token 配额独立。直连失败不一定是永久性的，可重试。
