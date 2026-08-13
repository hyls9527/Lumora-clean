#!/usr/bin/env python3
"""
CLIP Embedding Sidecar for Lumora
Generates high-quality image embeddings using OpenCLIP.
"""

import sys
import json
import base64
import io
from importlib.metadata import version as pkg_version
from pathlib import Path

import open_clip
import torch
from PIL import Image

# ── Version lock — pinned in requirements.txt ──────────────────────────
SIDECAR_VERSION = "1.0.0"
EXPECTED_DEPS = {
    "open-clip-torch": "~=2.30.0",
    "torch":            "~=2.5.0",
    "Pillow":           "~=11.0",
}


def _get_dep_versions() -> dict[str, str]:
    """Return installed versions of key dependencies (best-effort)."""
    versions = {}
    for pkg in EXPECTED_DEPS:
        try:
            versions[pkg] = pkg_version(pkg)
        except Exception:
            versions[pkg] = "unknown"
    return versions


# Global model cache
_model = None
_preprocess = None
_device = "cpu"


def load_model():
    """Load CLIP model (ViT-B-32, laion2b_s34b_b79k)."""
    global _model, _preprocess, _device

    if _model is not None:
        return

    _device = "cuda" if torch.cuda.is_available() else "cpu"
    _model, _, _preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="laion2b_s34b_b79k"
    )
    _model = _model.to(_device)
    _model.eval()


def embed_image(image_path: str) -> list[float]:
    """Generate embedding for an image file."""
    load_model()

    image = Image.open(image_path).convert("RGB")
    image_tensor = _preprocess(image).unsqueeze(0).to(_device)

    with torch.no_grad():
        features = _model.encode_image(image_tensor)
        features = features / features.norm(dim=-1, keepdim=True)

    return features[0].cpu().numpy().tolist()


def embed_text(text: str) -> list[float]:
    """Generate embedding for text."""
    load_model()

    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    tokens = tokenizer([text]).to(_device)

    with torch.no_grad():
        features = _model.encode_text(tokens)
        features = features / features.norm(dim=-1, keepdim=True)

    return features[0].cpu().numpy().tolist()


def embed_images(paths: list[str]) -> list:
    """Generate embeddings for several images with one model load.

    Failed images yield ``None`` (caller records them as errored) rather than
    aborting the whole batch.
    """
    load_model()
    results = []
    for path in paths:
        try:
            results.append(embed_image(path))
        except Exception:
            results.append(None)
    return results


def _health_check() -> dict:
    """
    Perform a real health check:
    1. Load the model (downloads weights on first call).
    2. Run a tiny text embedding to verify inference works.
    Returns a detailed status dict.
    """
    try:
        load_model()

        # Quick smoke test: embed a single word to confirm the pipeline works
        tokenizer = open_clip.get_tokenizer("ViT-B-32")
        tokens = tokenizer(["healthcheck"]).to(_device)
        with torch.no_grad():
            vec = _model.encode_text(tokens)
            vec = vec / vec.norm(dim=-1, keepdim=True)
        shape = list(vec.shape)

        return {
            "status": "ok",
            "sidecar_version": SIDECAR_VERSION,
            "device": _device,
            "model": "ViT-B-32",
            "pretrained": "laion2b_s34b_b79k",
            "embedding_dim": shape[-1] if len(shape) >= 2 else shape[0],
            "dependencies": _get_dep_versions(),
            "expected_dependencies": EXPECTED_DEPS,
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "error": str(exc),
            "sidecar_version": SIDECAR_VERSION,
            "dependencies": _get_dep_versions(),
        }


def _print_version():
    """Print sidecar and dependency version info."""
    info = {
        "sidecar_version": SIDECAR_VERSION,
        "dependencies": _get_dep_versions(),
        "expected_dependencies": EXPECTED_DEPS,
    }
    print(json.dumps(info))


def main():
    """CLI entry point. Reads JSON from stdin, writes JSON to stdout."""
    # Handle CLI args for direct invocation
    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "embed-image" and len(sys.argv) > 2:
            image_path = sys.argv[2]
            embedding = embed_image(image_path)
            print(json.dumps({"embedding": embedding}))

        elif command == "embed-images" and len(sys.argv) > 2:
            paths = sys.argv[2:]
            embeddings = embed_images(paths)
            print(json.dumps({"embeddings": embeddings}))

        elif command == "embed-text" and len(sys.argv) > 2:
            text = sys.argv[2]
            embedding = embed_text(text)
            print(json.dumps({"embedding": embedding}))

        elif command == "health":
            result = _health_check()
            print(json.dumps(result))

        elif command == "version":
            _print_version()

        else:
            print(json.dumps({"error": "Unknown command"}))
            sys.exit(1)

    else:
        # Read from stdin (for sidecar mode)
        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                command = request.get("command")

                if command == "embed-image":
                    image_path = request.get("image_path")
                    embedding = embed_image(image_path)
                    print(json.dumps({"embedding": embedding}), flush=True)

                elif command == "embed-images":
                    paths = request.get("paths") or []
                    embeddings = embed_images(paths)
                    print(json.dumps({"embeddings": embeddings}), flush=True)

                elif command == "embed-text":
                    text = request.get("text")
                    embedding = embed_text(text)
                    print(json.dumps({"embedding": embedding}), flush=True)

                elif command == "health":
                    result = _health_check()
                    print(json.dumps(result), flush=True)

                elif command == "version":
                    _print_version()
                    # _print_version already flushes via print

                else:
                    print(json.dumps({"error": f"Unknown command: {command}"}), flush=True)

            except Exception as e:
                print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
