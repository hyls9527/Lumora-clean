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
npx vitest run              # 745 frontend tests
cd src-tauri && cargo test  # 230 Rust tests
npx tsc --noEmit            # type check
```

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
