#!/usr/bin/env python3
"""
Aesthetic Judgment Sidecar for Lumora

Engines (all optional, graceful degradation):
  1. improved-aesthetic-predictor (Apache-2.0)
     CLIP ViT-L/14 + MLP -> absolute aesthetic score (0-10), drives the
     夯 / 稳 / 拉 judgment. Weights: sac+logos+ava1-l14-linearMSE.pth.
  2. HPS v2 (Apache-2.0)
     Official checkpoint (xswu/HPSv2 on Hugging Face) + CLIP ViT-H-14, loaded
     directly with open_clip. Raw human-preference logit for a prompt; only
     meaningful when comparing images generated from the same prompt, so it is
     stored raw and never used to fake an absolute tier.

When no engine is usable the sidecar prints a JSON `error` and exits 0, so
the Rust side can leave the image "unscored" instead of failing loudly.

Note: first run downloads the CLIP backbone. The sidecar defaults
HF_ENDPOINT to https://hf-mirror.com (reliable in CN networks); set your own
HF_ENDPOINT to override.
"""

import json
import os
import sys
import urllib.request
from importlib.metadata import version as pkg_version
from pathlib import Path

if os.environ.get("HF_ENDPOINT") is None:
    os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

SIDECAR_VERSION = "1.0.0"
EXPECTED_DEPS = {
    "open-clip-torch": "~=2.30.0",
    "torch": "~=2.5.0",
    "Pillow": "~=11.0",
}

WEIGHTS_FILENAME = "sac+logos+ava1-l14-linearMSE.pth"
WEIGHTS_URL = (
    "https://raw.githubusercontent.com/christophschuhmann/"
    "improved-aesthetic-predictor/main/sac%2Blogos%2Bava1-l14-linearMSE.pth"
)

STYLE_TEXTS = {
    "Animation": "a stylized animation illustration",
    "Concept-art": "a digital concept art illustration",
    "Painting": "a painting",
    "Photo": "a photograph",
}


def _cache_dir() -> Path:
    root = os.environ.get("LUMORA_AESTHETIC_DIR") or str(
        Path.home() / ".cache" / "lumora" / "aesthetic"
    )
    return Path(root)


def _device():
    import torch

    return "cuda" if torch.cuda.is_available() else "cpu"


class _AestheticMLP:
    """CLIP embedding -> aesthetic score MLP (same architecture as the
    improved-aesthetic-predictor repo, so its state dict loads directly)."""

    def __init__(self):
        import torch.nn as nn

        self.layers = nn.Sequential(
            nn.Linear(768, 1024),
            nn.Dropout(0.2),
            nn.Linear(1024, 128),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.Dropout(0.1),
            nn.Linear(64, 16),
            nn.Linear(16, 1),
        )

    def load_state_dict(self, state):
        stripped = {k.replace("layers.", "", 1): v for k, v in state.items()}
        self.layers.load_state_dict(stripped)

    def to(self, device):
        self.layers = self.layers.to(device)
        return self

    def eval(self):
        self.layers.eval()
        return self

    def __call__(self, x):
        return self.layers(x)


# Global model cache: (clip_model, preprocess, mlp)
_aesthetic = None
# Global HPS v2 cache: (clip_model, preprocess, tokenizer)
_hps = None

HPS_REPO = "xswu/HPSv2"
HPS_FILENAME = "HPS_v2_compressed.pt"


def _ensure_weights() -> str:
    cache = _cache_dir()
    cache.mkdir(parents=True, exist_ok=True)
    dest = cache / WEIGHTS_FILENAME
    if not dest.exists():
        tmp = dest.with_suffix(".tmp")
        urllib.request.urlretrieve(WEIGHTS_URL, tmp)
        tmp.replace(dest)
    return str(dest)


def load_aesthetic():
    """Load CLIP ViT-L/14 + the aesthetic MLP. Downloads weights on first use."""
    global _aesthetic
    if _aesthetic is not None:
        return _aesthetic

    import torch
    import open_clip

    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-L-14", pretrained="openai", force_quick_gelu=True
    )
    model = model.to(_device()).eval()

    mlp = _AestheticMLP()
    # weights_only=True: the checkpoint is a plain tensor state dict; refuse
    # pickle object graphs so a tampered download cannot execute code.
    state = torch.load(_ensure_weights(), map_location="cpu", weights_only=True)
    mlp.load_state_dict(state)
    mlp = mlp.to(_device()).eval()

    _aesthetic = (model, preprocess, mlp)
    return _aesthetic


def _image_tensor(preprocess, image_path):
    import torch
    from PIL import Image

    image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0)
    return image.to(_device())


def aesthetic_score(image_path: str) -> float:
    """Absolute 0-10 aesthetic score (clamped)."""
    import torch

    model, preprocess, mlp = load_aesthetic()
    image = _image_tensor(preprocess, image_path)
    with torch.no_grad():
        features = model.encode_image(image)
        features = features / features.norm(dim=-1, keepdim=True)
        score = mlp(features.float()).item()
    return max(0.0, min(10.0, float(score)))


def classify_style(image_path: str):
    """Zero-shot classify the image into HPS benchmark styles."""
    import torch
    import open_clip

    model, preprocess, _ = load_aesthetic()
    image = _image_tensor(preprocess, image_path)
    texts = list(STYLE_TEXTS.values())
    tokenizer = open_clip.get_tokenizer("ViT-L-14")
    tokens = tokenizer(texts).to(_device())

    with torch.no_grad():
        image_feat = model.encode_image(image)
        image_feat = image_feat / image_feat.norm(dim=-1, keepdim=True)
        text_feat = model.encode_text(tokens)
        text_feat = text_feat / text_feat.norm(dim=-1, keepdim=True)
        sims = (image_feat @ text_feat.T)[0]
        idx = int(sims.argmax().item())
    return list(STYLE_TEXTS.keys())[idx]


def _ensure_hps_weights() -> str:
    cache = _cache_dir() / "hps"
    for path in cache.rglob(HPS_FILENAME):
        if path.is_file():
            return str(path)
    from huggingface_hub import hf_hub_download

    return hf_hub_download(HPS_REPO, HPS_FILENAME, cache_dir=str(cache))


def load_hps():
    """Load HPS v2: CLIP ViT-H-14 + the official preference checkpoint."""
    global _hps
    if _hps is not None:
        return _hps

    import torch
    import open_clip

    # Random init is fine: the checkpoint below replaces every weight.
    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-H-14", pretrained=None
    )
    checkpoint = torch.load(
        _ensure_hps_weights(), map_location="cpu", weights_only=True
    )
    model.load_state_dict(checkpoint["state_dict"])
    model = model.to(_device()).eval()
    tokenizer = open_clip.get_tokenizer("ViT-H-14")

    _hps = (model, preprocess, tokenizer)
    return _hps


def hps_score(image_path: str, prompt: str):
    """Raw HPS v2 preference logit for a prompt; None when unavailable."""
    if not prompt or not prompt.strip():
        return None

    import torch
    from PIL import Image

    model, preprocess, tokenizer = load_hps()
    image = preprocess(Image.open(image_path).convert("RGB")).unsqueeze(0).to(_device())
    text = tokenizer([prompt]).to(_device())
    with torch.no_grad():
        image_features = model.encode_image(image)
        text_features = model.encode_text(text)
        logits = image_features @ text_features.T
        return float(torch.diagonal(logits)[0].item())


def score_image(image_path: str, prompt: str) -> dict:
    result = {
        "hps_score": None,
        "hps_style": None,
        "aesthetic_score": None,
        "scoring_model": None,
        "error": None,
    }
    errors = []
    engines = []

    try:
        hps = hps_score(image_path, prompt)
        if hps is not None:
            result["hps_score"] = round(hps, 4)
            engines.append("hpsv2:v2.0")
    except Exception as exc:
        errors.append(f"hpsv2: {exc}")

    try:
        result["aesthetic_score"] = round(aesthetic_score(image_path), 4)
        result["hps_style"] = classify_style(image_path)
        engines.append("improved-aesthetic-predictor:l14-linearMSE")
    except Exception as exc:
        errors.append(f"aesthetic: {exc}")

    if engines:
        result["scoring_model"] = "+".join(engines)
    elif errors:
        result["error"] = "; ".join(errors)
    return result


def _get_dep_versions() -> dict:
    versions = {}
    for pkg in EXPECTED_DEPS:
        try:
            versions[pkg] = pkg_version(pkg)
        except Exception:
            versions[pkg] = "not-installed"
    return versions


def _health() -> dict:
    deps = _get_dep_versions()
    usable = deps.get("open-clip-torch", "not-installed") != "not-installed"
    return {
        "status": "ok" if usable else "unhealthy",
        "sidecar_version": SIDECAR_VERSION,
        "dependencies": deps,
        "expected_dependencies": EXPECTED_DEPS,
    }


def main():
    if len(sys.argv) > 1:
        command = sys.argv[1]
        try:
            if command == "score-image" and len(sys.argv) >= 3:
                image_path = sys.argv[2]
                prompt = sys.argv[3] if len(sys.argv) > 3 else ""
                print(json.dumps(score_image(image_path, prompt)))
            elif command == "health":
                print(json.dumps(_health()))
            elif command == "version":
                print(
                    json.dumps(
                        {
                            "sidecar_version": SIDECAR_VERSION,
                            "dependencies": _get_dep_versions(),
                        }
                    )
                )
            else:
                print(json.dumps({"error": "Unknown command"}))
                sys.exit(1)
        except Exception as exc:
            print(json.dumps({"error": str(exc)}))
            sys.exit(0)
    else:
        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                command = request.get("command")
                if command == "score-image":
                    print(
                        json.dumps(
                            score_image(
                                request.get("image_path", ""),
                                request.get("prompt", "") or "",
                            )
                        ),
                        flush=True,
                    )
                else:
                    print(json.dumps({"error": f"Unknown command: {command}"}), flush=True)
            except Exception as exc:
                print(json.dumps({"error": str(exc)}), flush=True)


if __name__ == "__main__":
    main()
