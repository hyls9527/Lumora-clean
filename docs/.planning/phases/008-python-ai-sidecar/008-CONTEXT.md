# Phase 008: Python AI Sidecar — Context

**Gathered:** 2026-06-23
**Status:** Ready for research

<domain>
## Phase Boundary

构建自包含的 Python AI 侧车进程——PyInstaller 打包的独立二进制文件，通过 stdin/stdout JSON-RPC 与 Tauri 通信，按需生成 CLIP embeddings。Python 二进制在 Tauri 应用启动时自动启动，退出时自动终止。

**输入：** 图片文件路径（来自 Rust 后端）
**输出：** CLIP embedding 向量（返回到 Rust 后端供 sqlite-vec 存储）
</domain>

<decisions>
## Locked Decisions (from STATE.md)

- **IPC:** stdin/stdout JSON-RPC between Tauri and Python sidecar
- **CLIP Model:** open-clip-torch (via PyInstaller)
- **Packaging:** PyInstaller single-file binary
- **Health Check:** Tauri pings every 30s, sidecar responds
- **Batch Processing:** Max 4 concurrent, progress per item
- **No bundled Ollama** — CLIP is core, Ollama is optional Phase 11

## Requirements

- **PY-01:** PyInstaller-packaged Python binary with CLIP embedding generation (open-clip-torch)
- **PY-02:** stdin/stdout JSON-RPC communication with Tauri sidecar lifecycle
- **PY-03:** Health check protocol — Tauri pings every 30s, sidecar responds
- **PY-04:** Batch embedding with streaming queue — max 4 concurrent, progress per item

## Success Criteria

1. The app launches the Python sidecar binary on start and terminates it cleanly on exit
2. Sending an image path to the sidecar via JSON-RPC returns a CLIP embedding vector of correct dimensionality
3. Health-check pings every 30 seconds keep the sidecar connection alive and detect unexpected sidecar termination
4. Batch embedding requests process up to 4 images concurrently with per-item progress reported back to the frontend
</decisions>

<code_context>
## Existing Code Insights

### Rust Side (Phase 007 output)
- `src-tauri/` exists with full Tauri v2 scaffold
- `Cargo.toml` — sidecar configuration will be added here
- `tauri.conf.json` — sidecar binaries declared under `bundle.externalBin`
- Python binary will be placed in `src-tauri/binaries/`

### Frontend
- `src/stores/app-store.ts` — embedding status indicators exist (Phase 004)
- `src/components/EmbeddingStatusBadge.tsx` — UI ready to show real data
- API stubs in `src/lib/api/` — `generateEmbeddings()`, `getEmbeddingStatus()`

### Python
- No Python code exists yet — greenfield
- Python 3.x must be available on the system
- Required packages: open-clip-torch, torch, Pillow
- PyInstaller for packaging
</code_context>
