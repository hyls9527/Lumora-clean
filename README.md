# Lumora

**Local-first AI image gallery for your generated artwork.** Fast, private, free.

[![CI](https://github.com/hyls9527/Lumora-clean/actions/workflows/ci.yml/badge.svg)](https://github.com/hyls9527/Lumora-clean/actions/workflows/ci.yml)
[![Release](https://github.com/hyls9527/Lumora-clean/actions/workflows/release.yml/badge.svg)](https://github.com/hyls9527/Lumora-clean/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## What it does

Organize images from Stable Diffusion, Midjourney, ComfyUI, and similar tools — everything stays on your machine.

- **Semantic search** — find images by describing them, on a local Ollama or any OpenAI-compatible backend
- **Visual search** — CLIP-based similarity: "more like this", no text needed
- **AI analysis** — auto-tag, describe, and score (ratings stay human-only)
- **Organize** — smart collections, tags, favorites, ratings, trash with restore
- **Export** — custom filename templates, batch convert (jpg / webp / avif)
- **AI agents welcome** — built-in MCP endpoint for browsing, searching, and managing tags / favorites / trash
- **Auto-updates** — minisign-signed GitHub Releases

## Quick start

```bash
npm ci
npm run dev
```

For local AI features, install [Ollama](https://ollama.com/download) and pull the models:

```bash
ollama pull nomic-embed-text
ollama pull llava
```

Prefer an OpenAI-compatible API (OpenAI, DeepSeek, Azure, local vLLM / llama.cpp)?
Configure it in **Settings → AI backend** — the embedding and vision providers switch independently.

## Keyboard shortcuts

`⌘K` opens the command palette; arrow keys navigate the gallery and sidebar; every operation has a shortcut.

## Testing

```bash
npx vitest run --coverage   # 972 frontend tests, coverage gate 80% stmts/lines
cd src-tauri && cargo test  # 272 Rust tests (269 passed, 3 ignored — need local Ollama)
npx tsc --noEmit            # type check
npx playwright test         # E2E + page-load budget (<2s) + scroll baseline
node scripts/perf-budget.mjs  # bundle / binary / dependency budgets
```

### Latency and disaster-recovery drills

```bash
# API P95 budget (300ms) on a seeded 10k-image library
cd src-tauri && cargo test --lib perf_bench -- --ignored --nocapture

# RTO/RPO drill: snapshot → total loss → restore → integrity_check
node scripts/restore-drill.mjs
```

## Quality gates

Every gate below fails the build, not just a report:

| Gate | Budget | Where |
|---|---|---|
| Frontend coverage | ≥80% statements / lines | `vitest.config.ts` thresholds + CI |
| Rust coverage | ≥80% lines / functions / regions | `cargo llvm-cov --fail-under-*` in CI |
| Page load (TC-PERF-001) | <2s to an interactive shell | `tests/e2e/perf-load.spec.ts` |
| Scroll frame rate (TC-PERF-002) | p95 ≥30fps on 10k images | `tests/e2e/perf-scroll.spec.ts` |
| API latency | p95 <300ms across 9 read paths | `src-tauri/src/perf_bench.rs` |
| High/critical advisories | 0 (npm) | `.github/workflows/security-audit.yml` |
| Bundle / binary size | 0.5MiB frontend, 30MB binary | `scripts/perf-budget.mjs` |
| RPO | snapshot every 10 min, 6 retained | `src-tauri/src/auto_backup.rs` |

Crashes are counted, not guessed: a Rust panic hook appends to `crash.log` and the
frontend records one crash per broken session, so the crash rate is readable from
**Settings → Data Backup → Stability**. See
[docs/05-qa/14-商业级交付验收矩阵.md](docs/05-qa/14-商业级交付验收矩阵.md) for the
per-criterion evidence and the known environment limits.

## Documentation

- [📘 快速上手教程](docs/06-user-guide/教程-快速上手.md) — 10 分钟从安装到会用
- [📖 使用指南](docs/06-user-guide/使用指南.md) — 完整功能参考（搜索/AI 分析/智能收藏/导出模板）
- [🏗 Architecture](ARCHITECTURE.md) — 系统架构与数据模型

## Architecture

Tauri 2 app: React frontend, Rust backend, SQLite database.

```
src/           React + TypeScript + Zustand
src-tauri/     Rust + SQLite + FTS5 + sqlite-vec
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for details.

## AI access (MCP)

The app exposes an MCP endpoint at `http://127.0.0.1:{port}/mcp` so AI agents can
browse, search and organize (tags/favorites/trash) your library. Rating/scoring
stays human-only. See [`docs/04-deploy/mcp.md`](docs/04-deploy/mcp.md).

## License

MIT
