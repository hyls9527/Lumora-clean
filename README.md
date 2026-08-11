# Lumora

Desktop image gallery for your generated artwork. Local, fast, private.

## What it does

Organize images from Stable Diffusion, Midjourney, ComfyUI, and similar tools. Search by text or visual similarity. Auto-tag and describe images. Rate, favorite, tag, and export with custom filename templates.

Import by dragging folders or files into the window. Soft-delete to trash, restore when needed. Back up your entire library from Settings.

## Quick start

```bash
npm ci
npm run dev
```

For search and image analysis, install [Ollama](https://ollama.com/download) and pull the models:

```bash
ollama pull nomic-embed-text
ollama pull llava
```

## Keyboard shortcuts

`⌘K` opens the command palette. Arrow keys navigate the gallery and sidebar. All operations support keyboard shortcuts.

## Testing

```bash
npx vitest run              # 660 frontend tests
cd src-tauri && cargo test   # 124 Rust tests
npx tsc --noEmit            # type check
```

## Architecture

Tauri 2 app. React frontend, Rust backend, SQLite database.

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
