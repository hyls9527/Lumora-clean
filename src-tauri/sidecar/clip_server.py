#!/usr/bin/env python3
"""
CLIP Embedding Sidecar for Lumora
Generates high-quality image embeddings using OpenCLIP.
"""

import sys
import json
import base64
import io
from pathlib import Path

import open_clip
import torch
from PIL import Image


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


def main():
    """CLI entry point. Reads JSON from stdin, writes JSON to stdout."""
    # Handle CLI args for direct invocation
    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == "embed-image" and len(sys.argv) > 2:
            image_path = sys.argv[2]
            embedding = embed_image(image_path)
            print(json.dumps({"embedding": embedding}))

        elif command == "embed-text" and len(sys.argv) > 2:
            text = sys.argv[2]
            embedding = embed_text(text)
            print(json.dumps({"embedding": embedding}))

        elif command == "health":
            print(json.dumps({"status": "ok"}))

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

                elif command == "embed-text":
                    text = request.get("text")
                    embedding = embed_text(text)
                    print(json.dumps({"embedding": embedding}), flush=True)

                elif command == "health":
                    print(json.dumps({"status": "ok"}), flush=True)

                else:
                    print(json.dumps({"error": f"Unknown command: {command}"}), flush=True)

            except Exception as e:
                print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
