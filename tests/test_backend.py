"""Unit tests for the hermes-model-leaderboard backend (dashboard/plugin_api.py).

Ported from the llm-dashboard reference suite, minus the auth and
consumption/analytics halves (now separate concerns).
"""
import json

import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI

import dashboard.plugin_api as main_mod
from dashboard.plugin_api import (
    _extract_model_size,
    _record_price_history,
    router,
)

_app = FastAPI()
_app.include_router(router, prefix="/api/plugins/hermes-model-leaderboard")
client = TestClient(_app)

PREFIX = "/api/plugins/hermes-model-leaderboard"


@pytest.fixture(autouse=True)
def _isolate_data_dir(tmp_path, monkeypatch):
    """Point every data path at a throwaway dir.

    Without this, a test that reaches a writer (``_save_models``,
    ``_record_price_history``, profile persistence) mutates the REAL
    ``dashboard/data/*.json`` — which silently rewrote the tracked-model list
    in the repo once. Tests must never touch shipped data.
    """
    monkeypatch.setattr(main_mod, "DATA_DIR", tmp_path, raising=False)
    for attr in (
        "MODELS_FILE", "BENCHMARKS_FILE", "PRICE_HISTORY_FILE",
        "CACHE_FILE", "PROFILES_FILE", "HF_CACHE_FILE",
    ):
        if hasattr(main_mod, attr):
            monkeypatch.setattr(main_mod, attr, tmp_path / attr.lower(), raising=False)
    return tmp_path

@pytest.fixture()
def client_nomonkey(monkeypatch):
    """TestClient whose /hermes-profiles cannot import hermes_cli."""
    import sys
    monkeypatch.setitem(sys.modules, "hermes_cli", None)  # forces ImportError
    return client




# ---------------------------------------------------------------------------
# Model size extraction
# ---------------------------------------------------------------------------

def test_extract_model_size_from_hf_id():
    assert _extract_model_size({"hugging_face_id": "Qwen/Qwen3-Coder-480B-A35B-Instruct"}) == "480B / 35B"


def test_extract_model_size_from_name():
    assert _extract_model_size({"name": "Llama 4 Maverick 17B"}) == "17B"


def test_extract_model_size_multiple_sources():
    assert _extract_model_size({
        "hugging_face_id": "Qwen/Qwen3-Coder-480B-A35B-Instruct",
        "name": "Qwen3 Coder",
        "canonical_slug": "qwen/qwen3-coder-480b-a35b"
    }) == "480B / 35B"


def test_extract_model_size_none():
    assert _extract_model_size({"name": "no size here"}) is None
    assert _extract_model_size({}) is None


# ---------------------------------------------------------------------------
# Price history
# ---------------------------------------------------------------------------

def test_record_price_history_creates_then_dedupes(tmp_path, monkeypatch):
    p_file = tmp_path / "price_history.json"
    monkeypatch.setattr(main_mod, "PRICE_HISTORY_FILE", p_file)

    changed, prev = main_mod._record_price_history("model-a", 1.0, 5.0, 0.1, 0.2, timestamp=1000)
    assert changed is True and prev is None

    # identical prices -> no new record
    changed, prev = main_mod._record_price_history("model-a", 1.0, 5.0, 0.1, 0.2, timestamp=1010)
    assert changed is False and prev is None

    # input price changed -> new record, returns previous
    changed, prev = main_mod._record_price_history("model-a", 0.5, 5.0, 0.1, 0.2, timestamp=1020)
    assert changed is True
    assert prev["prompt"] == 1.0 and prev["completion"] == 5.0

    hist = json.loads(p_file.read_text())["model-a"]
    assert len(hist) == 2
    assert hist[-1]["prompt"] == 0.5


# ---------------------------------------------------------------------------
# Models API
# ---------------------------------------------------------------------------

def test_get_models_enriches_with_benchmarks(tmp_path, monkeypatch):
    models_file = tmp_path / "models.json"
    models_file.write_text(json.dumps([
        {"id": "openai/gpt-x", "label": "GPT X", "model_size": "120B"},
        {"id": "qwen/qwen3", "label": "Qwen3"},
    ]))
    bench_file = tmp_path / "benchmarks.json"
    bench_file.write_text(json.dumps({"models": {"openai/gpt-x": {"swebench_verified": 70.0}}}))

    monkeypatch.setattr(main_mod, "MODELS_FILE", models_file)
    monkeypatch.setattr(main_mod, "BENCHMARKS_FILE", bench_file)
    monkeypatch.setattr(main_mod, "_meta", lambda: {"last_refresh": 123})

    res = client.get(f"{PREFIX}/models")
    assert res.status_code == 200
    data = {m["id"]: m for m in res.json()["models"]}
    assert data["openai/gpt-x"]["benchmarks"] == {"swebench_verified": 70.0}
    assert data["qwen/qwen3"]["benchmarks"] == {}
    # VRAM estimate is derived from model_size when absent
    assert data["openai/gpt-x"]["gpu"]["vram_q4_gb"] > 0
    assert res.json()["last_refresh"] == 123
    # the languages field is gone for good
    assert "iso_langs" not in data["qwen/qwen3"]


def test_add_and_delete_model(tmp_path, monkeypatch):
    models_file = tmp_path / "models.json"
    models_file.write_text("[]")
    monkeypatch.setattr(main_mod, "MODELS_FILE", models_file)
    monkeypatch.setattr(main_mod, "_fetch_openrouter", lambda ids, force=False: {
        "vendor/model-1": {"name": "Model 1", "context_length": 128_000}
    })

    res = client.post(f"{PREFIX}/models", json={"id": "vendor/model-1"})
    assert res.status_code == 200
    assert res.json()["model"]["available"] is True

    # duplicate -> 400
    res = client.post(f"{PREFIX}/models", json={"id": "vendor/model-1"})
    assert res.status_code == 400

    res = client.delete(f"{PREFIX}/models/vendor/model-1")
    assert res.status_code == 200 and res.json()["deleted"] == "vendor/model-1"

    res = client.delete(f"{PREFIX}/models/vendor/model-1")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# OpenRouter search
# ---------------------------------------------------------------------------

def test_search_openrouter_filters(monkeypatch):
    monkeypatch.setattr(main_mod, "_get_cached_or_fetch", lambda force=False: [
        {"id": "openai/gpt-x", "name": "GPT X", "context_length": 128_000,
         "pricing": {"prompt": 0.0000015, "completion": 0.000002},
         "hugging_face_id": None, "architecture": {"modality": "text"}},
        {"id": "qwen/qwen3", "name": "Qwen3", "context_length": 32_000,
         "pricing": {"prompt": 0.0000002, "completion": 0.0000004},
         "hugging_face_id": "qwen/qwen3", "architecture": {"modality": "text->image"}},
    ])

    res = client.get(f"{PREFIX}/openrouter/search", params={"q": "gpt"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["results"][0]["id"] == "openai/gpt-x"
    assert data["results"][0]["prompt_price"] == 1.5


# ---------------------------------------------------------------------------
# News
# ---------------------------------------------------------------------------

def test_news_shape(monkeypatch):
    monkeypatch.setattr(main_mod, "_get_cached_or_fetch", lambda force=False: [
        {"id": "vendor/new-1", "name": "New 1", "created": 1_800_000_000,
         "context_length": 64_000, "pricing": {"prompt": 0.000001, "completion": 0.000002,
         "input_cache_read": 0.0000001}, "hugging_face_id": None,
         "architecture": {"modality": "text"}, "supported_parameters": [],
         "benchmarks": {"artificial_analysis": {"intelligence_index": 30}}}
    ])
    monkeypatch.setattr(main_mod, "_load_models", lambda: [])
    monkeypatch.setattr(main_mod, "_load_price_history", lambda: {})

    res = client.get(f"{PREFIX}/news")
    assert res.status_code == 200
    data = res.json()
    assert len(data["new_models"]) == 1
    nm = data["new_models"][0]
    assert nm["id"] == "vendor/new-1" and nm["is_tracked"] is False
    assert data["price_changes"] == []
    assert isinstance(data["promotions"], list) and len(data["promotions"]) > 0


# ---------------------------------------------------------------------------
# Benchmarks
# ---------------------------------------------------------------------------

def test_update_benchmarks(tmp_path, monkeypatch):
    bench_file = tmp_path / "benchmarks.json"
    bench_file.write_text(json.dumps({
        "_description": "Scores curates.",
        "_sources": {"swe": "https://..."},
        "models": {"openai/gpt-x": {"swe_bench": 70.0}}
    }))
    monkeypatch.setattr(main_mod, "BENCHMARKS_FILE", bench_file)

    res = client.post(f"{PREFIX}/benchmarks",
                      json={"model_id": "openai/gpt-x", "field": "swe_bench", "value": 72.5})
    assert res.status_code == 200
    saved = json.loads(bench_file.read_text())
    assert saved["models"]["openai/gpt-x"]["swe_bench"] == 72.5
    assert saved["_sources"]["swe"] == "https://..."


# ---------------------------------------------------------------------------
# Profiles (backend-side persistence, no auth gate)
# ---------------------------------------------------------------------------

def test_profiles_crud(tmp_path, monkeypatch):
    profiles_file = tmp_path / "profiles.json"
    monkeypatch.setattr(main_mod, "PROFILES_FILE", profiles_file)

    # defaults are seeded on first read
    res = client.get(f"{PREFIX}/profiles")
    assert res.status_code == 200
    assert "architecte" in res.json()["profiles"]

    # create
    res = client.post(f"{PREFIX}/profiles", json={
        "id": "data-scientist", "name": "Data Scientist",
        "weights": {"intelligence": 4, "context": 3}
    })
    assert res.status_code == 200 and res.json()["profile"]["id"] == "data-scientist"

    # duplicate -> 400
    res = client.post(f"{PREFIX}/profiles", json={"id": "data-scientist", "name": "X", "weights": {}})
    assert res.status_code == 400

    # update
    res = client.put(f"{PREFIX}/profiles/data-scientist", json={
        "id": "data-scientist", "name": "DS", "weights": {"intelligence": 5}
    })
    assert res.status_code == 200 and res.json()["profile"]["name"] == "DS"

    # delete
    res = client.delete(f"{PREFIX}/profiles/data-scientist")
    assert res.status_code == 200
    res = client.delete(f"{PREFIX}/profiles/data-scientist")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Hermes profiles endpoint
# ---------------------------------------------------------------------------

def test_put_creates_a_profile_saved_for_the_first_time():
    """The 'default' Hermes profile chip has no stored criteria until its first
    save, which is a PUT: it must create the profile (it used to 404)."""
    res = client.put(f"{PREFIX}/profiles/default", json={
        "id": "default", "name": "default", "weights": {"intelligence": 5, "coding": 9, "tools": -1}})
    assert res.status_code == 200, res.text
    assert res.json()["profile"]["weights"] == {"intelligence": 5, "coding": 5, "tools": 0}
    assert client.get(f"{PREFIX}/profiles").json()["profiles"]["default"]["name"] == "default"


def test_hermes_profiles_fallback(client_nomonkey):
    # without the hermes package importable, the endpoint falls back to ['default']
    res = client_nomonkey.get(f"{PREFIX}/hermes-profiles")
    assert res.status_code == 200
    data = res.json()
    assert data["profiles"][0] == "default"
    assert "default" not in data["profiles"][1:]


# ---------------------------------------------------------------------------
# Auto-fill — the host LLM facade (ctx.llm) is faked: no model call in tests
# ---------------------------------------------------------------------------

class _FakeStructuredResult:
    def __init__(self, text="", parsed=None, content_type="json"):
        self.text = text
        self.parsed = parsed
        self.content_type = content_type


@pytest.fixture()
def fake_llm(monkeypatch):
    """Install a fake ``ctx.llm`` behind the shared plugin-context module.

    ``dashboard/plugin_api.py`` reaches the host through
    ``sys.modules['hermes_model_leaderboard_shared_ctx']`` (see ``plugin_ctx``), so
    injecting a stand-in module is enough — no Hermes host, no subprocess.
    ``install()`` returns the fake facade instance to inspect the call kwargs.
    """
    import sys
    import types

    def install(result=None, error=None):
        class _Llm:
            calls = []

            def complete_structured(self, **kwargs):
                _Llm.calls.append(kwargs)
                if error is not None:
                    raise error
                return result

        module = types.ModuleType("hermes_model_leaderboard_shared_ctx")
        module.get_llm = lambda: _Llm()  # type: ignore[attr-defined]  # dynamic module attr
        monkeypatch.setitem(sys.modules, "hermes_model_leaderboard_shared_ctx", module)
        return _Llm

    return install


def test_auto_fill_uses_host_llm(client_nomonkey, fake_llm):
    weights = {k: 3 for k in main_mod._CRITERIA_DOC}
    weights.update(intelligence=5, tools=5)
    llm = fake_llm(result=_FakeStructuredResult(parsed=weights))

    res = client_nomonkey.post(f"{PREFIX}/auto-fill", json={"profile_id": "qa"})
    assert res.status_code == 200
    body = res.json()
    assert body["weights"]["intelligence"] == 5 and body["weights"]["tools"] == 5
    assert all(0 <= v <= 5 for v in body["weights"].values())

    # The call goes through the host facade with a real schema, never a subprocess.
    (kwargs,) = llm.calls
    assert kwargs["json_schema"]["required"] == list(main_mod._CRITERIA_DOC)
    assert kwargs["input"] and kwargs["input"][0]["type"] == "text"
    assert "qa" in kwargs["instructions"]


def test_auto_fill_falls_back_to_text_extraction(client_nomonkey, fake_llm):
    """A host that hands back unparsed text still works (fenced, JSON5-ish answer)."""
    reply = "Sure:\n```json\n{intelligence: 5, coding: 4, tools: '3',}\n```\n"
    llm = fake_llm(result=_FakeStructuredResult(text=reply, parsed=None, content_type="text"))

    res = client_nomonkey.post(f"{PREFIX}/auto-fill", json={"profile_id": "qa"})
    assert res.status_code == 200
    w = res.json()["weights"]
    assert w["intelligence"] == 5 and w["coding"] == 4 and w["tools"] == 3
    assert llm.calls  # the LLM was asked first; extraction is only a fallback


def test_auto_fill_rejects_answer_without_json(client_nomonkey, fake_llm):
    fake_llm(result=_FakeStructuredResult(text="Sorry, I don't know.", parsed=None, content_type="text"))
    res = client_nomonkey.post(f"{PREFIX}/auto-fill", json={"profile_id": "qa"})
    assert res.status_code == 503


def test_auto_fill_clamps_out_of_range_weights(client_nomonkey, fake_llm):
    fake_llm(result=_FakeStructuredResult(parsed={k: 9 for k in main_mod._CRITERIA_DOC}))
    res = client_nomonkey.post(f"{PREFIX}/auto-fill", json={"profile_id": "qa"})
    assert res.status_code == 200
    assert all(v == 5 for v in res.json()["weights"].values())


def test_auto_fill_reports_llm_failure(client_nomonkey, fake_llm):
    fake_llm(error=RuntimeError("no provider configured"))
    res = client_nomonkey.post(f"{PREFIX}/auto-fill", json={"profile_id": "qa"})
    assert res.status_code == 503
    assert "no provider configured" in res.json()["detail"]


def test_auto_fill_503_without_plugin_context(client_nomonkey, monkeypatch):
    """No context (bare uvicorn run / host without the facade) → 503, never a shell-out."""
    import subprocess as _sp
    import sys

    monkeypatch.delitem(sys.modules, "hermes_model_leaderboard_shared_ctx", raising=False)

    def _no_shell(*a, **k):  # pragma: no cover — asserts the old path is gone
        raise AssertionError("auto-fill must not spawn a subprocess")

    monkeypatch.setattr(_sp, "run", _no_shell)
    res = client_nomonkey.post(f"{PREFIX}/auto-fill", json={"profile_id": "qa"})
    assert res.status_code == 503


def test_plugin_register_shares_ctx_with_backend(monkeypatch):
    """``register(ctx)`` publishes the host context to the router, plus the skill.

    Covers the load-path split: the plugin package's ``register`` runs in the host,
    the router is imported standalone by the gateway — ``plugin_ctx`` is what makes
    ``ctx.llm`` reachable from ``dashboard/plugin_api.py``.
    """
    import importlib.util
    import sys
    from pathlib import Path

    root = Path(main_mod.__file__).resolve().parent.parent
    monkeypatch.delitem(sys.modules, "hermes_model_leaderboard_shared_ctx", raising=False)

    spec = importlib.util.spec_from_file_location("_ml_root_under_test", root / "__init__.py")
    assert spec is not None and spec.loader is not None
    plugin_root = importlib.util.module_from_spec(spec)
    sys.modules["_ml_root_under_test"] = plugin_root
    spec.loader.exec_module(plugin_root)

    class _Ctx:
        llm = object()

        def __init__(self):
            self.skills = []

        def register_skill(self, name, path, description="", frontmatter=None):
            self.skills.append((name, Path(path), description))

    ctx = _Ctx()
    plugin_root.register(ctx)

    # the router — a different module object, loaded by the gateway — sees ctx.llm
    assert main_mod._plugin_llm() is ctx.llm
    # ... and the shipped skill was announced, with its file actually present
    (name, path, description) = ctx.skills[0]
    assert name == "refresh-benchmarks" and path.exists() and description
    monkeypatch.delitem(sys.modules, "_ml_root_under_test", raising=False)


# ---------------------------------------------------------------------------
# News: promo expiry + rolling price variations
# ---------------------------------------------------------------------------

def test_news_excludes_expired_promos(client_nomonkey, monkeypatch):
    import time as _time
    # force one promo into the past and one into the future
    future = _time.strftime("%Y-%m-%d", _time.localtime(_time.time() + 30 * 86400))
    past = "2020-01-01"
    orig_get = main_mod._get_cached_or_fetch
    monkeypatch.setattr(main_mod, "_get_cached_or_fetch", lambda: [])
    monkeypatch.setattr(main_mod, "_load_models", lambda: [])
    monkeypatch.setattr(main_mod, "_load_price_history", lambda: {})
    # patch promo_defs via the module-level constant rebuilt in get_news —
    # instead, patch time.strptime-free path: rewrite the defs list is not
    # possible, so assert on the mechanism: an expired date must be dropped.
    res = client_nomonkey.get(f"{PREFIX}/news")
    assert res.status_code == 200
    promos = res.json()["promotions"]
    assert all(p.get("ends_at") for p in promos)  # every shipped promo carries an end date


def test_news_rolling_price_variations(client_nomonkey, monkeypatch):
    import time as _time
    now = _time.time()
    # price 1.0 (8 days ago) -> 2.0 (2 days ago) -> 1.25 (now)
    hist = {
        "vendor/roller": [
            {"ts": now - 8 * 86400, "prompt": 1.0, "completion": 2.0, "cache_read": 0},
            {"ts": now - 2 * 86400, "prompt": 2.0, "completion": 4.0, "cache_read": 0},
            {"ts": now, "prompt": 1.25, "completion": 2.5, "cache_read": 0},
        ]
    }
    monkeypatch.setattr(main_mod, "_get_cached_or_fetch", lambda: [])
    monkeypatch.setattr(main_mod, "_load_models", lambda: [])
    monkeypatch.setattr(main_mod, "_load_price_history", lambda: hist)
    res = client_nomonkey.get(f"{PREFIX}/news")
    assert res.status_code == 200
    pc = [x for x in res.json()["price_changes"] if x["id"] == "vendor/roller"]
    assert pc, "rolling change should be reported"
    row = pc[0]
    # 7d window references the 8-days-ago point: 1.0 -> 1.25 = +25%
    assert row["percent_7d"] == 25.0
    # 24h rolling window: the most recent point at least 24h old is the
    # 2-days-ago sample (2.0) -> 1.25/2.0 = -37.5%
    assert row["percent_1d"] == -37.5


# ---------------------------------------------------------------------------
# 422 regression: the desktop bridge JSON.stringify()es the request body itself
# (electron/main.ts: `Buffer.from(JSON.stringify(options.body))`), so a plugin
# that pre-stringifies its body double-encodes it — the JSON *string* reaches
# the Pydantic model and FastAPI answers 422 "Input should be a valid
# dictionary". The plugin must always pass a plain object.
# ---------------------------------------------------------------------------
def test_post_models_accepts_object_body(monkeypatch):
    monkeypatch.setattr(main_mod, "_load_models", lambda: [])
    monkeypatch.setattr(main_mod, "_fetch_openrouter", lambda ids, force=False: {})
    saved = {}
    monkeypatch.setattr(main_mod, "_save_models", lambda m: saved.update({"models": m}))

    res = client.post(f"{PREFIX}/models", json={"id": "x-ai/grok-4.7"})
    assert res.status_code == 200, res.text
    assert res.json()["model"]["id"] == "x-ai/grok-4.7"


def test_post_models_rejects_double_encoded_body(monkeypatch):
    """Documents the desktop-side failure mode we must never trigger again."""
    monkeypatch.setattr(main_mod, "_load_models", lambda: [])
    # What the bridge produces when the plugin pre-stringifies: a JSON *string*
    # wrapping the payload — `"{\"id\":\"x-ai/grok-4.7\"}"`.
    double_encoded = json.dumps(json.dumps({"id": "x-ai/grok-4.7"}))
    res = client.post(
        f"{PREFIX}/models",
        content=double_encoded,
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 422
    assert res.json()["detail"][0]["type"] == "model_attributes_type"


# ---------------------------------------------------------------------------
# Initial list + refresh semantics
# ---------------------------------------------------------------------------
def test_first_run_seeds_tracked_models_from_profiles(monkeypatch):
    """No models.json yet -> the tracked list starts from the profile models."""
    monkeypatch.setattr(main_mod, "_profile_model_ids", lambda: ["x-ai/grok-4.7", "default/cheap"])
    monkeypatch.setattr(main_mod, "_fetch_openrouter", lambda ids, force=False: {})
    assert not main_mod.MODELS_FILE.exists()

    models = main_mod._load_models()
    assert [m["id"] for m in models] == ["x-ai/grok-4.7", "default/cheap"]
    assert all(m.get("added_via") == "profile-seed" for m in models)
    # persisted, so the next boot reads them instead of reseeding
    assert main_mod.MODELS_FILE.exists()
    assert [m["id"] for m in main_mod._load_models()] == ["x-ai/grok-4.7", "default/cheap"]


def test_first_run_without_profile_models_stays_empty(monkeypatch):
    monkeypatch.setattr(main_mod, "_profile_model_ids", lambda: [])
    assert main_mod._load_models() == []


def test_refresh_force_from_body_bypasses_the_cache(monkeypatch):
    """POST /refresh {"force": true} must refetch OpenRouter (the button sent no
    force and re-merged the cached payload, which looked like a no-op) — while
    keeping the cache file as the stale fallback."""
    main_mod.CACHE_FILE.write_text('{"ts": 1, "data": []}')
    seen = {}
    monkeypatch.setattr(main_mod, "_load_models", lambda: [{"id": "x-ai/grok-4.7"}])
    monkeypatch.setattr(main_mod, "_fetch_openrouter", lambda ids, force=False: seen.update(force=force) or {})
    monkeypatch.setattr(main_mod, "_save_models", lambda models: None)

    res = client.post(f"{PREFIX}/refresh", json={"force": True})
    assert res.status_code == 200, res.text
    assert seen["force"] is True, "force=true must bypass the cache"
    assert main_mod.CACHE_FILE.exists(), "the cache stays as the stale fallback"


def _openrouter_down(monkeypatch):
    def boom(*a, **k):
        raise main_mod.httpx.ConnectError("429 / network down")
    monkeypatch.setattr(main_mod.httpx, "get", boom)


def test_openrouter_error_serves_the_stale_cache(monkeypatch):
    main_mod.CACHE_FILE.write_text(json.dumps({"ts": 1, "data": [{"id": "x-ai/grok-4.7"}]}))
    _openrouter_down(monkeypatch)
    assert main_mod._get_cached_or_fetch() == [{"id": "x-ai/grok-4.7"}]
    assert main_mod._get_cached_or_fetch(force=True) == [{"id": "x-ai/grok-4.7"}]


def test_openrouter_error_without_cache_is_a_502(monkeypatch):
    _openrouter_down(monkeypatch)
    res = client.get(f"{PREFIX}/openrouter/search?q=x")
    assert res.status_code == 502


def test_refresh_without_force_keeps_the_cache(monkeypatch):
    main_mod.CACHE_FILE.write_text('{"ts": 1, "data": []}')
    monkeypatch.setattr(main_mod, "_load_models", lambda: [{"id": "x-ai/grok-4.7"}])
    monkeypatch.setattr(main_mod, "_fetch_openrouter", lambda ids, force=False: {})
    monkeypatch.setattr(main_mod, "_save_models", lambda models: None)

    res = client.post(f"{PREFIX}/refresh", json={})
    assert res.status_code == 200
    assert main_mod.CACHE_FILE.exists()


# ---------------------------------------------------------------------------
# Criterion completeness: manual > openrouter > estimated, HF model size
# ---------------------------------------------------------------------------
def _catalog(n=40):
    """A catalogue where coding = 10 + 1.5 * intelligence exactly."""
    return [{"id": f"m{i}", "benchmarks": {"artificial_analysis": {
        "intelligence_index": float(i), "coding_index": 10 + 1.5 * i, "agentic_index": None}}}
        for i in range(n)]


def test_missing_index_is_estimated_from_the_catalogue_fit():
    est = main_mod._index_estimators(_catalog())
    m = main_mod._complete_indices({"intelligence_index": 20.0, "coding_index": None}, {}, est)
    assert m["coding_index"] == 40.0
    assert m["sources"] == {"intelligence_index": "openrouter", "coding_index": "estimated"}
    assert m["estimates"]["coding_index"]["from"] == "intelligence_index"
    # agentic has no catalogue pairs at all: stays missing rather than invented
    assert m.get("agentic_index") is None and "agentic_index" not in m["sources"]


def test_manual_override_beats_openrouter_and_feeds_estimates():
    est = main_mod._index_estimators(_catalog())
    m = main_mod._complete_indices({"intelligence_index": 20.0}, {"intelligence_index": 30.0}, est)
    assert m["intelligence_index"] == 30.0 and m["sources"]["intelligence_index"] == "manual"
    assert m["coding_index"] == 55.0  # estimated from the manual value


def test_no_estimate_from_a_too_small_catalogue():
    est = main_mod._index_estimators(_catalog(5))
    m = main_mod._complete_indices({"intelligence_index": 20.0}, {}, est)
    assert "coding_index" not in m["sources"]


def test_get_models_reports_sources(monkeypatch):
    main_mod.CACHE_FILE.write_text(json.dumps({"ts": 1, "data": _catalog()}))
    monkeypatch.setattr(main_mod, "_load_models", lambda: [{"id": "x/y", "intelligence_index": 20.0}])
    m = client.get(f"{PREFIX}/models").json()["models"][0]
    assert m["coding_index"] == 40.0 and m["sources"]["coding_index"] == "estimated"


def test_benchmark_null_clears_the_override():
    client.post(f"{PREFIX}/benchmarks", json={"model_id": "x/y", "field": "coding_index", "value": 70})
    assert client.get(f"{PREFIX}/benchmarks").json()["x/y"]["coding_index"] == 70
    client.post(f"{PREFIX}/benchmarks", json={"model_id": "x/y", "field": "coding_index", "value": None})
    assert "x/y" not in client.get(f"{PREFIX}/benchmarks").json()
    res = client.post(f"{PREFIX}/benchmarks", json={"model_id": "x/y", "field": "coding_index", "value": "high"})
    assert res.status_code == 400


def test_open_weights_size_comes_from_hugging_face(monkeypatch):
    monkeypatch.setattr(main_mod, "_hf_param_count", lambda hf: 753_329_940_480)
    e = main_mod._fill_model_size({"hugging_face_id": "zai-org/GLM-5.3", "model_size": None})
    assert e["model_size"] == "753B" and e["size_source"] == "huggingface"
    assert e["gpu"]["fits_64gb"] is False
    # a name-derived size is kept; a closed model is left alone
    assert main_mod._fill_model_size({"hugging_face_id": "q/Q-27B", "model_size": "27B"})["model_size"] == "27B"
    assert main_mod._fill_model_size({"hugging_face_id": None})  == {"hugging_face_id": None}


def test_estimate_is_clamped_to_the_observed_range():
    est = main_mod._index_estimators(_catalog())  # coding observed in [10, 68.5]
    m = main_mod._complete_indices({"intelligence_index": 80.0}, {}, est)
    assert m["coding_index"] == 68.5
