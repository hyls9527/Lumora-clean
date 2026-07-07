# Lumora

Desktop image gallery for AI-generated art. Everything stays on your machine.

## Quick start

```bash
npm ci
npm run dev
```

For search and AI features, install [Ollama](https://ollama.com/download) and pull the models:

```bash
ollama pull nomic-embed-text
ollama pull llava
```

## What it does

Browse, search, and organize images from Stable Diffusion, Midjourney, ComfyUI, and other tools. Filter by model, rating, size, or generation time. Search by text description or visual similarity. Auto-tag and describe images using local AI models.

Import by dragging folders or files into the window. Export with custom filename templates. Soft-delete to trash, restore when needed.

## Keyboard shortcuts

`⌘K` opens the command palette. Arrow keys navigate the gallery. Everything works without a mouse.

## Testing

```bash
npx vitest run              # 340 frontend tests
cd src-tauri && cargo test   # 57 Rust tests
npx tsc --noEmit            # type check
```

## Architecture

Tauri 2 app. React frontend, Rust backend, SQLite database.

```
src/           React + TypeScript + Zustand
src-tauri/     Rust + SQLite + FTS5 + sqlite-vec
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for details.

## License

MIT
