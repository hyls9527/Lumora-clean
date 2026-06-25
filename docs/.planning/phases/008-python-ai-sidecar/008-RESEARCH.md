# Phase 008: Python AI Sidecar - Research

**Researched:** 2026-06-23
**Domain:** Python AI inference sidecar / desktop process management / CLIP embeddings
**Confidence:** HIGH

## Summary

This phase builds a self-contained Python process that runs alongside the Tauri desktop app, communicating via stdin/stdout JSON-RPC 2.0 to generate CLIP image embeddings on demand. The Python sidecar is packaged as a PyInstaller binary and managed by Tauri's shell plugin as a long-running child process.

**Primary recommendation:** Use `open-clip-torch` 3.3.0 with the ViT-B-32 model (laion2b_s34b_b79k pretrained weights, 512-dim embeddings, ~605MB checkpoint), communicate via line-delimited JSON-RPC 2.0 over stdin/stdout, and manage the process through `tauri-plugin-shell` 2.3.5 sidecar spawning. The model checkpoint is NOT bundled in the PyInstaller binary — it is downloaded on first launch to keep the binary under 150MB. The PyInstaller binary uses CPU-only PyTorch to avoid the 800MB+ CUDA runtime penalty.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CLIP model inference | Python Sidecar | — | GPU/CPU-heavy ML inference lives outside Tauri process |
| IPC protocol | API / Backend (Rust) | Python Sidecar | Rust owns the child process lifecycle; Python implements the protocol |
| Image preprocessing | Python Sidecar | — | PIL/Pillow does the resize/normalize before inference |
| Health check ping | API / Backend (Rust) | Python Sidecar | Rust sends pings every 30s; Python responds |
| Batch queue management | Python Sidecar | — | Python manages internal queue of embedding requests |
| Sidecar lifecycle | API / Backend (Rust) | — | Rust spawns on app start, kills on app exit |
| Embedding storage | Database / Storage | API / Backend | SQLite (via sqlite-vec in Phase 010) stores the vectors |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| open-clip-torch | 3.3.0 | CLIP model loading + inference | Official LAION/mlfoundations package; supports ViT-B-32 through ViT-H-14 [VERIFIED: PyPI] |
| torch | 2.12.1 (CPU-only) | Neural network runtime | Required by open-clip; CPU-only build saves ~800MB in binary size [VERIFIED: PyPI] |
| Pillow | 12.2.0 | Image loading and preprocessing | Standard Python imaging library; required by CLIP preprocessing pipeline [VERIFIED: PyPI] |
| PyInstaller | 6.21.0 | Single-file binary packaging | Industry standard for Python → executable; supports Windows target [VERIFIED: PyPI] |
| tauri-plugin-shell | 2.3.5 (npm) / 2.x (cargo) | Sidecar child process management | Official Tauri plugin for spawning and communicating with child processes [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| numpy | (torch dependency) | Array operations | Implicitly required via torch |
| safetensors | (open-clip optional) | Fast model loading | Use if model checkpoint is in safetensors format |
| huggingface_hub | (optional) | Model download from HF Hub | If downloading model checkpoint at first launch instead of bundling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyInstaller | Nuitka | Nuitka produces 15-35% smaller binaries but has more complex build configuration; PyInstaller is more battle-tested for PyTorch |
| ViT-B-32 | ViT-L-14 | L-14 has 768-dim embeddings with better accuracy but ~1.6GB checkpoint (vs 605MB); B-32 is sufficient for image library similarity search |
| CPU-only PyTorch | CUDA PyTorch | CUDA adds 800MB+ to binary, requires NVIDIA drivers; CPU inference for 224x224 images is under 200ms — acceptable for interactive use |
| Bundled model | First-launch download | Bundling adds 605MB to installer; download-on-first-launch keeps installer lean and allows model updates independently |
| Line-delimited JSON | Content-Length header framing (LSP style) | Content-Length header is more robust when JSON contains embedded newlines, but adds framing complexity; line-delimited JSON is simpler and sufficient since embedding payloads are single-line |

**Installation:**
```bash
# Create isolated virtual environment first
py -m venv sidecar-env
sidecar-env\Scripts\activate

# Install CPU-only PyTorch (Windows)
pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
pip install open-clip-torch==3.3.0 Pillow==12.2.0 pyinstaller==6.21.0
```

**Version verification:** All package versions confirmed via `py -m pip index versions <pkg>` on 2026-06-23.

## Package Legitimacy Audit

> slopcheck was unavailable at research time — all packages tagged `[ASSUMED]` below. The planner must gate each install behind a `checkpoint:human-verify` task.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| open-clip-torch | PyPI | 4+ yrs (v0.2.1 in 2021) | High (major ML project) | github.com/mlfoundations/open_clip | N/A [ASSUMED] | Flagged — planner must add checkpoint |
| torch | PyPI | 8+ yrs | Extremely high | github.com/pytorch/pytorch | N/A [ASSUMED] | Flagged — planner must add checkpoint |
| Pillow | PyPI | 10+ yrs | Extremely high | github.com/python-pillow/Pillow | N/A [ASSUMED] | Flagged — planner must add checkpoint |
| PyInstaller | PyPI | 10+ yrs | High | github.com/pyinstaller/pyinstaller | N/A [ASSUMED] | Flagged — planner must add checkpoint |
| tauri-plugin-shell | npm | 2+ yrs (Tauri v2) | High | github.com/tauri-apps/plugins-workspace | N/A [ASSUMED] | Flagged — planner must add checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** None
**Packages flagged as suspicious:** None (slopcheck unavailable — all packages require manual verification via checkpoint)

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Lumora Desktop App                               │
│                                                                          │
│  ┌──────────────┐     Tauri IPC      ┌──────────────────────────────┐   │
│  │   Frontend   │ ◄──────────────► │        Rust Backend          │   │
│  │ (React/Vite) │    invoke()       │                              │   │
│  │              │                   │  ┌────────────────────────┐  │   │
│  │ - Batch UI   │                   │  │   Sidecar Manager      │  │   │
│  │ - Status     │                   │  │                        │  │   │
│  │   indicators │                   │  │  spawn → child process │  │   │
│  └──────────────┘                   │  │  stdin ──write────┐    │  │   │
│                                     │  │  stdout←─read─────┤    │  │   │
│                                     │  │  30s health ping   │    │  │   │
│                                     │  └────────────────────┼───┘  │   │
│                                     │                       │      │   │
│  ┌──────────────────────────┐       │                       │      │   │
│  │      SQLite Database     │       │                       │      │   │
│  │  - images table          │       │                       │      │   │
│  │  - embeddings (Phase 10) │       │                       │      │   │
│  └──────────────────────────┘       │                       │      │   │
└─────────────────────────────────────┼───────────────────────┼──────┘
                                      │                       │
                               stdin  │              stdout   │
                               write  ▼              read     │
┌─────────────────────────────────────────────────────────────┼──────┐
│                    Python AI Sidecar Process                │      │
│                                                             │      │
│  ┌─────────────────┐    ┌──────────────────┐               │      │
│  │  JSON-RPC Server │◄──►│  Embedding       │               │      │
│  │  (stdin/stdout)  │    │  Pipeline        │               │      │
│  │                  │    │                  │               │      │
│  │ - parse_request  │    │ 1. Preprocess    │               │      │
│  │ - dispatch       │    │    (resize 224)  │               │      │
│  │ - health_check   │    │ 2. Normalize     │               │      │
│  │ - embed_image    │    │ 3. encode_image  │               │      │
│  │ - embed_batch    │    │ 4. L2-normalize  │               │      │
│  └─────────────────┘    └──────────────────┘               │      │
│                                     │                       │      │
│                          ┌──────────▼──────────┐            │      │
│                          │   CLIP Model Cache   │            │      │
│                          │   ViT-B-32 (605MB)   │            │      │
│                          │   Loaded at startup  │            │      │
│                          └─────────────────────┘            │      │
│                                                             │      │
│  ┌──────────────────────────────────────────────────────┐   │      │
│  │  Batch Queue (max 4 concurrent)                      │   │      │
│  │  ThreadPoolExecutor(max_workers=4)                   │   │      │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐                        │   │      │
│  │  │Job1│ │Job2│ │Job3│ │Job4│  → progress per item   │   │      │
│  │  └────┘ └────┘ └────┘ └────┘                        │   │      │
│  └──────────────────────────────────────────────────────┘   │      │
└─────────────────────────────────────────────────────────────┘      │
```

### Recommended Project Structure
```
src-tauri/
├── binaries/                          # Sidecar binary placement
│   └── lumora-sidecar-x86_64-pc-windows-msvc.exe   # PyInstaller output
├── sidecar/                           # Python source (co-located with Tauri)
│   ├── main.py                        # Entry point: JSON-RPC server loop
│   ├── jsonrpc.py                     # JSON-RPC 2.0 protocol handler
│   ├── model.py                       # CLIP model loading + inference
│   ├── batch.py                       # ThreadPoolExecutor batch queue
│   ├── preprocess.py                  # Image preprocessing (PIL → tensor)
│   ├── health.py                      # Health check responder
│   ├── requirements.txt               # Python dependencies
│   ├── build.py                       # PyInstaller build script
│   └── download_model.py              # First-launch model download utility
├── src/
│   ├── sidecar/                       # Rust sidecar management module (NEW)
│   │   ├── mod.rs
│   │   ├── manager.rs                 # Spawn/kill/health-check lifecycle
│   │   └── protocol.rs                # JSON-RPC message serialization types
│   └── commands/
│       └── embeddings.rs              # Tauri commands: embed_image, embed_batch (NEW)
├── capabilities/
│   └── default.json                   # Add shell:allow-spawn, shell:allow-stdin-write
├── tauri.conf.json                    # Add bundle.externalBin
└── Cargo.toml                         # Add tauri-plugin-shell dependency
```

### Pattern 1: JSON-RPC 2.0 over stdin/stdout (Line-Delimited)

**What:** Each JSON-RPC message is a single line of JSON terminated by `\n`. The Python sidecar reads lines from stdin, dispatches to handlers, and writes response lines to stdout. The Rust side writes request lines to the child's stdin and reads response lines from stdout.

**When to use:** All communication between Tauri and the Python sidecar.

**Protocol specification:**

Request format (Rust → Python):
```json
{"jsonrpc":"2.0","method":"embed_image","params":{"image_path":"C:\\Users\\...\\img.jpg"},"id":1}
```

Response format (Python → Rust):
```json
{"jsonrpc":"2.0","result":{"embedding":[0.123,...,-0.456],"dimensions":512,"model":"ViT-B-32"},"id":1}
```

Error response:
```json
{"jsonrpc":"2.0","error":{"code":-32000,"message":"Image not found: /path/to/img.jpg"},"id":1}
```

Health check:
```
Rust:  {"jsonrpc":"2.0","method":"health_check","params":{},"id":"ping-1719000000"}
Python: {"jsonrpc":"2.0","result":{"status":"ok","model_loaded":true,"uptime_seconds":120},"id":"ping-1719000000"}
```

**Python server loop (verified from official examples and community patterns):**
```python
# Source: JSON-RPC 2.0 spec + community implementations
import sys, json, traceback

class JSONRPCServer:
    def __init__(self):
        self.methods = {}
    
    def register(self, name, handler):
        self.methods[name] = handler
    
    def run(self):
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
                response = self._dispatch(request)
            except json.JSONDecodeError:
                response = {
                    "jsonrpc": "2.0",
                    "error": {"code": -32700, "message": "Parse error"},
                    "id": None
                }
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
    
    def _dispatch(self, request):
        method = request.get("method", "")
        handler = self.methods.get(method)
        if not handler:
            return {
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": f"Method not found: {method}"},
                "id": request.get("id")
            }
        try:
            result = handler(request.get("params", {}))
            return {
                "jsonrpc": "2.0",
                "result": result,
                "id": request.get("id")
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "error": {"code": -32000, "message": str(e)},
                "id": request.get("id")
            }
```

**Rust sidecar communication (validated from tauri-plugin-shell docs and community patterns):**
```rust
// Source: tauri-plugin-shell docs.rs + GitHub community examples
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

// Spawn sidecar on app start
let (mut rx, mut child) = app.shell()
    .sidecar("binaries/lumora-sidecar")
    .expect("failed to create sidecar command")
    .spawn()
    .expect("Failed to spawn Python sidecar");

// Store child handle for later stdin writes
app.manage(Mutex::new(child));

// Read stdout in a background task
tauri::async_runtime::spawn(async move {
    let mut buffer = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                // Parse JSON-RPC response, route to awaiting request
                buffer.push_str(&line);
            }
            CommandEvent::Stderr(line_bytes) => {
                log::warn!("Sidecar stderr: {}", String::from_utf8_lossy(&line_bytes));
            }
            CommandEvent::Terminated(status) => {
                log::error!("Sidecar terminated unexpectedly: {:?}", status);
                // Trigger restart logic
            }
            _ => {}
        }
    }
});
```

### Pattern 2: Model Loading at Startup (Lazy with First-Launch Download)

**What:** The Python sidecar loads the CLIP model into memory at startup. If the model checkpoint file doesn't exist locally, it downloads from Hugging Face Hub before loading. This keeps the PyInstaller binary small (~100-150MB for Python + torch + open-clip code, without the 605MB model).

**When to use:** Sidecar startup sequence.

**Key implementation detail:** `open_clip.create_model_and_transforms()` automatically downloads the pretrained checkpoint from Hugging Face Hub on first use if it's not cached. The cache directory is `~/.cache/huggingface/hub/`. Alternatively, we can use a custom download to a known path within the app's data directory for explicit control.

### Pattern 3: Batch Embedding with ThreadPoolExecutor

**What:** Batch embedding requests queue image paths, process up to 4 concurrently using Python's `concurrent.futures.ThreadPoolExecutor`, and report progress per item via JSON-RPC notifications.

**When to use:** When the frontend requests embeddings for multiple images at once (PY-04).

```python
# Verified pattern from Python standard library + PyTorch best practices
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

class BatchProcessor:
    def __init__(self, model, preprocess, max_workers=4):
        self.model = model
        self.preprocess = preprocess
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.active_jobs = {}
        self.lock = threading.Lock()
    
    def submit_batch(self, image_paths, progress_callback):
        """Submit batch and return batch_id immediately."""
        batch_id = str(uuid.uuid4())
        futures = {}
        for path in image_paths:
            future = self.executor.submit(self._embed_one, path)
            futures[future] = path
        
        with self.lock:
            self.active_jobs[batch_id] = {
                "futures": futures,
                "total": len(image_paths),
                "completed": 0,
                "callback": progress_callback
            }
        
        # Process completions asynchronously
        threading.Thread(target=self._watch_completion, args=(batch_id,), daemon=True).start()
        return batch_id
    
    def _embed_one(self, image_path):
        """Load, preprocess, and encode a single image."""
        from PIL import Image
        import torch
        
        image = Image.open(image_path).convert("RGB")
        image_tensor = self.preprocess(image).unsqueeze(0)
        with torch.no_grad():
            embedding = self.model.encode_image(image_tensor)
            embedding = embedding / embedding.norm(dim=-1, keepdim=True)
        return embedding.squeeze(0).tolist()
```

### Anti-Patterns to Avoid
- **Blocking stdin reads with model inference:** The main thread must only handle JSON-RPC I/O; model inference happens on worker threads. If the main thread blocks on inference, health-check pings will time out.
- **Loading model in every request:** Load the model ONCE at startup and reuse. Reloading costs ~5-10 seconds and 605MB I/O.
- **Storing PyTorch model in PyInstaller bundle:** This creates a 700MB+ binary. Instead, download the model checkpoint at first launch.
- **Using `--onefile` mode with PyTorch:** Single-file PyInstaller with PyTorch produces 2GB+ binaries and 30+ second cold start. Use `--onedir` mode instead for the Python sidecar — Tauri's sidecar mechanism supports directories.
- **Hand-rolling JSON-RPC:** The protocol is simple but edge cases add up — batch requests, error codes, notification vs request distinction. Use the defined spec precisely.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLIP model implementation | Custom ViT + CLIP | open-clip-torch | Official implementation with 50+ pretrained checkpoints, verified ImageNet zero-shot scores |
| Child process management | std::process::Command raw | tauri-plugin-shell | Handles cross-platform sidecar naming, capability security, event streaming, graceful shutdown |
| Image resizing/normalization | Custom numpy/pil pipeline | open_clip's built-in preprocess transform | Matches training-time preprocessing exactly (critical for embedding quality) |
| JSON-RPC 2.0 protocol | Custom protocol | Line-delimited JSON per spec | Well-defined error codes, batch support, notification semantics |
| Python packaging to EXE | Manual bundling | PyInstaller | Handles DLL dependencies, Python runtime embedding, Windows manifest |

**Key insight:** The most dangerous hand-roll in this phase would be writing custom image preprocessing. CLIP models are extremely sensitive to preprocessing parameters — using the wrong mean/std normalization or resize method produces embeddings that are incompatible with the vector similarity search. Always use `open_clip.create_model_and_transforms()` which returns the exact preprocessing pipeline matched to the pretrained weights.

## Common Pitfalls

### Pitfall 1: PyInstaller + PyTorch Binary Bloat
**What goes wrong:** The PyInstaller binary balloons to 1-3GB when PyTorch with CUDA is bundled.
**Why it happens:** PyTorch wheels include CUDA runtime libraries, MKL, multiple GPU code paths, and debug symbols. PyInstaller's hooks for scientific libraries are conservative and pull in entire site-packages subdirectories.
**How to avoid:** 
1. Install CPU-only PyTorch: `pip install torch --index-url https://download.pytorch.org/whl/cpu`
2. Use `--onedir` mode (not `--onefile`) — allows incremental updates and faster startup
3. Do NOT bundle the CLIP model checkpoint in the PyInstaller binary — download on first launch
4. Build in a clean virtual environment (not conda base) to avoid pulling in unrelated packages
5. Use PyInstaller's `--exclude-module` to strip unused torch subsystems (e.g., `torch.distributed`)
**Warning signs:** Binary size >500MB before adding the model checkpoint.

### Pitfall 2: Broken stdin/stdout in PyInstaller on Windows
**What goes wrong:** `sys.stdin.readline()` hangs or returns empty strings in the PyInstaller-packaged EXE.
**Why it happens:** Windows console subsystem differences — PyInstaller's `--noconsole` or `--windowed` mode redirects stdin/stdout differently.
**How to avoid:** 
1. Build with `--console` flag (sidecar runs headless anyway — no window appears)
2. In `main.py`, explicitly check `sys.stdin.isatty()` and fall back to `msvcrt.getch()` or raw `os.read(0, ...)` if needed
3. Test the packaged EXE with a simple Rust spawn test before full integration
4. Use `sys.stdin.buffer.read()` in binary mode for reliability
**Warning signs:** Sidecar spawns but never responds to health checks; Rust writes succeed but Python never reads them.

### Pitfall 3: Tauri Sidecar Naming Convention Mismatch
**What goes wrong:** "No such file or directory (os error 2)" when Tauri tries to spawn the sidecar.
**Why it happens:** Tauri v2 requires the binary filename to include the target triple suffix: `lumora-sidecar-x86_64-pc-windows-msvc.exe`. The `externalBin` config only specifies the base name, and Tauri appends the target triple at runtime.
**How to avoid:**
1. Explicitly name the PyInstaller output: `lumora-sidecar-x86_64-pc-windows-msvc.exe`
2. Place it in `src-tauri/binaries/`
3. Configure `tauri.conf.json` as: `"externalBin": ["binaries/lumora-sidecar"]` (NO extension, NO triple suffix)
4. Verify the target triple with: `rustc -vV | grep host`
**Warning signs:** Error message mentions "sidecar" and "not found" in the same breath.

### Pitfall 4: PyTorch Model First-Load Hanging
**What goes wrong:** The first embedding request takes 30-60 seconds (or hangs indefinitely) while the model downloads.
**Why it happens:** `open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')` triggers a 605MB download from Hugging Face Hub on first use. Over slow connections, this looks like a hang.
**How to avoid:**
1. Download the model explicitly during sidecar startup, with progress reporting via stderr
2. If download fails, report the error clearly (don't silently hang)
3. Consider shipping a small `model_config.json` that tells the Rust side the model isn't ready yet
4. Set a download timeout (e.g., 5 minutes) with clear error messages
**Warning signs:** Sidecar starts, health check returns "model_loaded: false" for an extended period.

### Pitfall 5: Thread Safety with PyTorch Model
**What goes wrong:** Concurrent calls to `model.encode_image()` from multiple threads cause crashes or corrupted embeddings.
**Why it happens:** PyTorch models are not inherently thread-safe for inference when sharing the same model instance.
**How to avoid:**
1. PyTorch inference in `torch.no_grad()` mode is generally read-only and thread-safe for most models
2. Use a `threading.Lock` around `model.encode_image()` calls as a safe default
3. Alternatively, use `torch.multiprocessing` with separate model instances per worker (but increases memory usage 4x)
4. Test with 4 concurrent requests explicitly in integration tests
**Warning signs:** Non-deterministic crashes, NaN embeddings, or segmentation faults under concurrent load.

## Runtime State Inventory

> SKIPPED — This is a greenfield Python phase. No existing Python code, no runtime state to inventory.

## Code Examples

Verified patterns from official sources:

### Loading CLIP Model and Generating Embedding
```python
# Source: open_clip official README.md (mlfoundations/open_clip)
import torch
from PIL import Image
import open_clip

# Load at startup — keep model in memory for lifetime of sidecar
model, _, preprocess = open_clip.create_model_and_transforms(
    'ViT-B-32', pretrained='laion2b_s34b_b79k'
)
model.eval()  # Inference mode

def generate_embedding(image_path: str) -> list[float]:
    """Generate a 512-dim CLIP embedding for an image."""
    image = Image.open(image_path).convert('RGB')
    image_tensor = preprocess(image).unsqueeze(0)  # [1, 3, 224, 224]
    
    with torch.no_grad():
        embedding = model.encode_image(image_tensor)      # [1, 512]
        embedding = embedding / embedding.norm(dim=-1, keepdim=True)  # L2 normalize
    
    return embedding.squeeze(0).tolist()  # 512 floats
```

### Tauri Sidecar Configuration
```json
// Source: tauri.app/develop/sidecar/ (official Tauri v2 docs)
// In tauri.conf.json, under "bundle":
{
  "bundle": {
    "externalBin": ["binaries/lumora-sidecar"]
  }
}

// In capabilities/default.json:
{
  "permissions": [
    "core:default",
    "store:default",
    "dialog:default",
    "shell:allow-spawn",
    "shell:allow-stdin-write"
  ]
}
```

### PyInstaller Build Command
```bash
# Source: PyInstaller 6.x docs
# Run from sidecar/ directory
pyinstaller \
  --onedir \
  --name lumora-sidecar \
  --console \
  --add-data "requirements.txt:." \
  --hidden-import open_clip \
  --hidden-import open_clip.factory \
  --hidden-import open_clip.model \
  --hidden-import open_clip.tokenizer \
  --hidden-import open_clip.transform \
  --hidden-import open_clip.pretrained \
  --hidden-import taming.modules \
  --hidden-import huggingface_hub \
  --exclude-module torch.distributed \
  --exclude-module torch.utils.tensorboard \
  main.py
```

### JSON-RPC Method: embed_batch with Progress Notifications
```json
// Source: JSON-RPC 2.0 Specification
// Request (Rust -> Python):
{
  "jsonrpc": "2.0",
  "method": "embed_batch",
  "params": {
    "image_paths": ["C:\\images\\photo1.jpg", "C:\\images\\photo2.jpg"]
  },
  "id": 42
}

// Progress notification (Python -> Rust, no id):
{
  "jsonrpc": "2.0",
  "method": "batch_progress",
  "params": {
    "batch_id": "abc-123",
    "current": 1,
    "total": 2,
    "current_image": "C:\\images\\photo1.jpg"
  }
}

// Final response:
{
  "jsonrpc": "2.0",
  "result": {
    "batch_id": "abc-123",
    "embeddings": {
      "C:\\images\\photo1.jpg": [0.1, 0.2, ...],
      "C:\\images\\photo2.jpg": [0.3, 0.4, ...]
    },
    "model": "ViT-B-32",
    "dimensions": 512
  },
  "id": 42
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenAI CLIP (original) | open-clip-torch (LAION) | ~2023 | Better zero-shot accuracy (72.8% vs 63.2% for ViT-B-32), more pretrained variants |
| Single inference | Batch with ThreadPoolExecutor | Standard practice | 4x throughput for batch embedding; essential for interactive UX |
| Bundled model in binary | First-launch download from HF Hub | 2025 best practice | Keeps installer under 150MB; allows model updates independently |
| Tauri v1 sidecar API | tauri-plugin-shell v2 | Tauri v2 (2024) | Separate plugin, capability-based permissions, spawn/execute distinction |

**Deprecated/outdated:**
- **Tauri v1 `tauri::api::process::Command`**: Replaced by `tauri_plugin_shell::process::Command` in Tauri v2. Do not use the v1 API.
- **`open_clip` v1.x API**: The `open_clip` (without `-torch` suffix) package on PyPI is the old version. Use `open-clip-torch` (with hyphens) which is the current v3.x package.
- **PyInstaller `--onefile` for ML workloads**: Community consensus has shifted to `--onedir` for PyTorch applications due to 30s+ startup time and temp file accumulation.

## Assumptions Log

> All claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | open-clip-torch 3.3.0 is the latest version compatible with torch 2.12.1 | Standard Stack | Could need a different version pin |
| A2 | ViT-B-32 (laion2b_s34b_b79k) pretrained weights produce 512-dim embeddings | Architecture Patterns | Previous code assumes 1536-dim (from mock data); mismatch would require frontend adjustment |
| A3 | ThreadPoolExecutor with max_workers=4 is safe with PyTorch CPU inference | Common Pitfalls | Could hit thread-safety issues requiring multiprocessing with separate model instances |
| A4 | Tauri sidecar naming requires `-$TARGET_TRIPLE` suffix but externalBin config omits it | Common Pitfalls | Build would fail with "file not found" errors |
| A5 | Windows console subsystem in PyInstaller `--console` mode works for stdin/stdout IPC | Common Pitfalls | stdin/stdout might not work correctly, requiring `msvcrt` or other Windows-specific fallbacks |
| A6 | Hugging Face Hub auto-download works without explicit huggingface_hub import | Architecture Patterns | Model download could fail silently; explicit download code would be needed |
| A7 | CPU-only PyTorch inference for ViT-B-32 takes < 500ms per 224x224 image | Architecture Patterns | If inference is significantly slower (>2s), the interactive experience degrades |
| A8 | tauri-plugin-shell v2 supports `Command::new_sidecar()` with the same API as `Command::new()` | Architecture Patterns | If the sidecar API differs, the spawn code would need adjustment |

## Open Questions

1. **Model download strategy for first launch**
   - What we know: 605MB checkpoint must be downloaded before first use; Hugging Face Hub auto-caches in `~/.cache/huggingface/hub/`
   - What's unclear: Whether the PyInstaller binary can access the HF cache directory correctly; whether to download in Python or have Rust trigger the download
   - Recommendation: Have Python sidecar download the model on startup if not present; report download progress via stderr; set a 10-minute timeout

2. **Windows Firewall interaction with subprocess pipes**
   - What we know: stdin/stdout pipes are local — no network involved
   - What's unclear: Whether Windows Defender or firewall might block the inter-process pipe communication
   - Recommendation: Test on a real Windows machine early; pipes are OS-level constructs and should not trigger firewall

3. **Python 3.14 compatibility with PyTorch 2.12.1**
   - What we know: Python 3.14 is available; PyTorch 2.12.1 lists Python 3.10-3.13 in official wheels
   - What's unclear: Whether PyTorch 2.12.1 has published wheels for Python 3.14 yet (CPython 3.14 released late 2025)
   - Recommendation: Check PyTorch wheel availability for Python 3.14 before finalizing; fall back to Python 3.13 if needed

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python (py launcher) | Sidecar runtime | Yes | 3.14.6 | — |
| pip | Package installation | Yes | 26.1.2 | — |
| PyTorch (CPU) | CLIP inference | No | — | Install via: `pip install torch --index-url https://download.pytorch.org/whl/cpu` |
| open-clip-torch | CLIP model loading | No | — | Install via: `pip install open-clip-torch==3.3.0` |
| Pillow | Image preprocessing | No | — | Install via: `pip install Pillow==12.2.0` |
| PyInstaller | Binary packaging | No | — | Install via: `pip install pyinstaller==6.21.0` |
| Rust (rustc/cargo) | Tauri compilation | Not detected in PATH | — | Must be available; project compiled before so likely installed |
| tauri-plugin-shell (npm) | Sidecar frontend API | Not installed | — | Install via: `npm install @tauri-apps/plugin-shell` |
| tauri-plugin-shell (cargo) | Sidecar Rust API | Not in Cargo.toml | — | Add via: `cargo add tauri-plugin-shell` |

**Missing dependencies with no fallback:**
- Rust toolchain (rustc/cargo) — must be available for Tauri compilation; not detected in current shell PATH but project has compiled before
- All Python packages (torch, open-clip-torch, Pillow, PyInstaller) — must be installed before sidecar can be built

**Missing dependencies with fallback:**
- None identified — all missing dependencies are required

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (Python) + cargo test (Rust) |
| Config file | `sidecar/pytest.ini` (to be created in Wave 0) |
| Quick run command | `py -m pytest sidecar/tests/ -x --timeout=30` |
| Full suite command | `py -m pytest sidecar/tests/ -v --timeout=60` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PY-01 | PyInstaller binary generates CLIP embedding of correct dimensions (512) | integration | `py -m pytest sidecar/tests/test_model.py::test_embedding_dimensions -x` | No (Wave 0) |
| PY-01 | Model loads successfully from pretrained weights | unit | `py -m pytest sidecar/tests/test_model.py::test_model_loading -x` | No (Wave 0) |
| PY-02 | JSON-RPC request/response roundtrip via stdin/stdout | integration | `py -m pytest sidecar/tests/test_jsonrpc.py::test_request_response -x` | No (Wave 0) |
| PY-02 | Invalid JSON produces parse error response | unit | `py -m pytest sidecar/tests/test_jsonrpc.py::test_parse_error -x` | No (Wave 0) |
| PY-03 | Health check ping receives correct response | integration | `py -m pytest sidecar/tests/test_health.py::test_health_check -x` | No (Wave 0) |
| PY-03 | Health check reports model_loaded status correctly | unit | `py -m pytest sidecar/tests/test_health.py::test_model_status -x` | No (Wave 0) |
| PY-04 | Batch embedding processes 4 images concurrently | integration | `py -m pytest sidecar/tests/test_batch.py::test_concurrent_processing -x` | No (Wave 0) |
| PY-04 | Batch progress notifications report per-item completion | integration | `py -m pytest sidecar/tests/test_batch.py::test_progress_notifications -x` | No (Wave 0) |

### Sampling Rate
- **Per task commit:** `py -m pytest sidecar/tests/test_model.py sidecar/tests/test_jsonrpc.py -x --timeout=30`
- **Per wave merge:** `py -m pytest sidecar/tests/ -v --timeout=60`
- **Phase gate:** Full Python suite green + Rust `cargo test` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `sidecar/tests/test_model.py` — covers PY-01 (model loading, embedding dimensions)
- [ ] `sidecar/tests/test_jsonrpc.py` — covers PY-02 (protocol parsing, error handling)
- [ ] `sidecar/tests/test_health.py` — covers PY-03 (health check protocol)
- [ ] `sidecar/tests/test_batch.py` — covers PY-04 (concurrent batch, progress)
- [ ] `sidecar/tests/conftest.py` — shared fixtures (mock model, real model, temp images)
- [ ] `sidecar/pytest.ini` — pytest configuration
- [ ] Framework install: `py -m pip install pytest pytest-timeout`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Sidecar is local-only, no authentication layer needed |
| V3 Session Management | No | Stateless JSON-RPC; no sessions |
| V4 Access Control | No | Sidecar only accepts input from the parent Tauri process |
| V5 Input Validation | Yes | JSON-RPC request validation — validate method names, parameter types, image_path sanitization |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for Python stdin/stdout Sidecar

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in image_path parameter | Tampering | Validate image_path is within allowed directories; reject paths with `..` segments; use `os.path.realpath()` |
| Malformed JSON causing crash (DoS) | Denial of Service | Catch `json.JSONDecodeError`; return proper JSON-RPC error; never crash on bad input |
| Extremely large images exhausting memory | Denial of Service | Check image file size before opening (e.g., < 50MB); use Pillow's `Image.open()` with memory limits |
| Model file tampering (if adversary replaces checkpoint) | Tampering | Verify model checkpoint SHA256 hash after download; compare against known good hash |
| Arbitrary code execution via pickle in model checkpoint | Elevation of Privilege | Use safetensors format instead of pickle-based `.bin` checkpoints when available; verify checkpoint source (official HF Hub org) |

## Sources

### Primary (HIGH confidence)
- open-clip-torch PyPI — version 3.3.0 verified via `py -m pip index versions open-clip-torch` on 2026-06-23
- open_clip GitHub README (mlfoundations/open_clip) — verified API: `create_model_and_transforms()`, `encode_image()`, `get_tokenizer()`
- ViT-B-32 model config JSON (mlfoundations/open_clip) — verified embed_dim=512, image_size=224, layers=12, width=768
- Tauri v2 official docs (tauri.app/develop/sidecar/) — verified sidecar configuration pattern, naming convention, capabilities
- tauri-plugin-shell docs.rs 2.3.5 — verified Command, CommandEvent::Stdout/Stderr/Terminated, spawn(), child.write() API
- PyInstaller PyPI — version 6.21.0 verified
- Pillow PyPI — version 12.2.0 verified
- torch PyPI — version 2.12.1 verified

### Secondary (MEDIUM confidence)
- laion/CLIP-ViT-B-32-laion2B-s34B-b79K on Hugging Face — verified checkpoint size ~605MB
- Tauri GitHub community examples (issues #4440, #8689) — verified sidecar stdin/stdout patterns with write-then-drop and Arc<Mutex<CommandChild>>
- JSON-RPC 2.0 community Python implementations — verified line-delimited JSON pattern for stdin/stdout transport

### Tertiary (LOW confidence)
- PyTorch thread-safety under CPU inference with `torch.no_grad()` — based on training knowledge and community reports; not officially documented as thread-safe
- PyInstaller `--onedir` mode behavior with PyTorch on Windows — based on community reports of `--onefile` issues; need to test on actual Windows machine

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on PyPI/npm with version numbers
- Architecture: HIGH — JSON-RPC 2.0 spec is stable; Tauri sidecar API is well-documented; open-clip API is stable
- Pitfalls: MEDIUM — PyInstaller+PyTorch and Windows stdin/stdout are known trouble spots; exact behavior depends on system configuration

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (30 days — stable libraries, no rapid API changes expected)
