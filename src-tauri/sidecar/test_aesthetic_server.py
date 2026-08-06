"""Unit tests for aesthetic_server.py (no model downloads, no torch needed)."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import aesthetic_server as a  # noqa: E402


def test_score_image_both_engines(monkeypatch, tmp_path):
    img = tmp_path / "x.png"
    img.write_bytes(b"fake")

    monkeypatch.setattr(a, "hps_score", lambda _p, _pr: 27.3)
    monkeypatch.setattr(a, "aesthetic_score", lambda _p: 8.7)
    monkeypatch.setattr(a, "classify_style", lambda _p: "Photo")

    result = a.score_image(str(img), "a scenic landscape")

    assert result["hps_score"] == 27.3
    assert result["hps_style"] == "Photo"
    assert result["aesthetic_score"] == 8.7
    assert result["scoring_model"] == (
        "hpsv2:v2.0+improved-aesthetic-predictor:l14-linearMSE"
    )
    assert result["error"] is None


def test_score_image_aesthetic_only(monkeypatch, tmp_path):
    img = tmp_path / "x.png"
    img.write_bytes(b"fake")

    monkeypatch.setattr(a, "hps_score", lambda _p, _pr: None)
    monkeypatch.setattr(a, "aesthetic_score", lambda _p: 6.2)
    monkeypatch.setattr(a, "classify_style", lambda _p: "Painting")

    result = a.score_image(str(img), "a scenic landscape")

    assert result["hps_score"] is None
    assert result["aesthetic_score"] == 6.2
    assert result["scoring_model"] == "improved-aesthetic-predictor:l14-linearMSE"
    assert result["error"] is None


def test_score_image_graceful_degradation(monkeypatch, tmp_path):
    img = tmp_path / "x.png"
    img.write_bytes(b"fake")

    monkeypatch.setattr(a, "hps_score", lambda _p, _pr: None)

    def boom(_p):
        raise RuntimeError("no model installed")

    monkeypatch.setattr(a, "aesthetic_score", boom)
    monkeypatch.setattr(a, "classify_style", boom)

    result = a.score_image(str(img), "a scenic landscape")

    assert result["aesthetic_score"] is None
    assert result["hps_score"] is None
    assert result["scoring_model"] is None
    assert result["error"] is not None
    assert "aesthetic" in result["error"]


def test_score_image_hps_error_keeps_aesthetic(monkeypatch, tmp_path):
    img = tmp_path / "x.png"
    img.write_bytes(b"fake")

    def boom(_p, _pr):
        raise RuntimeError("hps broken")

    monkeypatch.setattr(a, "hps_score", boom)
    monkeypatch.setattr(a, "aesthetic_score", lambda _p: 5.0)
    monkeypatch.setattr(a, "classify_style", lambda _p: "Photo")

    result = a.score_image(str(img), "a scenic landscape")

    assert result["hps_score"] is None
    assert result["aesthetic_score"] == 5.0
    assert result["error"] is None
    assert "improved-aesthetic-predictor" in result["scoring_model"]


def test_hps_score_requires_prompt(monkeypatch):
    called = []

    def fake_load():
        called.append(1)
        raise AssertionError("load_hps must not be called without a prompt")

    monkeypatch.setattr(a, "load_hps", fake_load)
    assert a.hps_score("x.png", "   ") is None
    assert called == []


def test_mlp_state_dict_prefix_stripped():
    class FakeLayers:
        def __init__(self):
            self.received = None

        def load_state_dict(self, state):
            self.received = state

    mlp = a._AestheticMLP.__new__(a._AestheticMLP)
    mlp.layers = FakeLayers()
    mlp.load_state_dict({"layers.0.weight": 1, "layers.7.bias": 2})
    assert mlp.layers.received == {"0.weight": 1, "7.bias": 2}


def test_ensure_hps_weights_uses_cache(monkeypatch, tmp_path):
    (tmp_path / "hps").mkdir(parents=True)
    target = tmp_path / "hps" / a.HPS_FILENAME
    target.write_bytes(b"cached")
    monkeypatch.setattr(a, "_cache_dir", lambda: tmp_path)
    assert a._ensure_hps_weights() == str(target)


def test_main_score_image_prints_json(monkeypatch, capsys):
    monkeypatch.setattr(
        a,
        "score_image",
        lambda _p, _pr: {"aesthetic_score": 4.9, "hps_score": None, "error": None},
    )
    monkeypatch.setattr(sys, "argv", ["aesthetic_server.py", "score-image", "x.png", "p"])
    a.main()
    out = capsys.readouterr().out
    payload = json.loads(out)
    assert payload["aesthetic_score"] == 4.9


def test_main_score_image_exception_prints_error_and_exits_zero(monkeypatch, capsys):
    def boom(_p, _pr):
        raise RuntimeError("boom")

    monkeypatch.setattr(a, "score_image", boom)
    monkeypatch.setattr(sys, "argv", ["aesthetic_server.py", "score-image", "x.png", "p"])
    with pytest.raises(SystemExit) as exc:
        a.main()
    assert exc.value.code == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["error"] == "boom"


def test_main_unknown_command_exits_nonzero(monkeypatch, capsys):
    monkeypatch.setattr(sys, "argv", ["aesthetic_server.py", "bogus"])
    with pytest.raises(SystemExit) as exc:
        a.main()
    assert exc.value.code == 1
    assert '"error"' in capsys.readouterr().out


def test_main_version_prints_sidecar_version(monkeypatch, capsys):
    monkeypatch.setattr(a, "_get_dep_versions", lambda: {"torch": "2.5.0"})
    monkeypatch.setattr(sys, "argv", ["aesthetic_server.py", "version"])
    a.main()
    payload = json.loads(capsys.readouterr().out)
    assert payload["sidecar_version"] == a.SIDECAR_VERSION


def test_json_contract_field_names(monkeypatch, tmp_path):
    img = tmp_path / "x.png"
    img.write_bytes(b"fake")
    monkeypatch.setattr(a, "hps_score", lambda _p, _pr: 27.3)
    monkeypatch.setattr(a, "aesthetic_score", lambda _p: 8.7)
    monkeypatch.setattr(a, "classify_style", lambda _p: "Photo")

    result = a.score_image(str(img), "p")
    assert set(result) == {
        "hps_score",
        "hps_style",
        "aesthetic_score",
        "scoring_model",
        "error",
    }
    json.dumps(result)  # must be JSON-serializable
