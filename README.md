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
npx vitest run              # 765 frontend tests
cd src-tauri && cargo test  # 262 Rust tests (259 passed, 3 ignored — need local Ollama)
npx tsc --noEmit            # type check
```

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
