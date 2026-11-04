"""
Unit tests for scripts/harvest_aa.py — the Artificial Analysis harvester.

The page payload is parsed mechanically (balanced-brace scan of the Next.js flight
chunks), so its parsing and matching rules can be tested without the network.

Run: env -u PYTHONPATH ~/.hermes/cache/scratch/lb-venv/bin/python -m pytest tests/test_harvest_aa.py -q
"""
import importlib.util
import json
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "harvest_aa.py"
spec = importlib.util.spec_from_file_location("harvest_aa", SCRIPT)
assert spec is not None and spec.loader is not None
harvest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(harvest)


def page(models: list[dict]) -> str:
    """An HTML page shaped like Artificial Analysis': one flight chunk per model."""
    chunks = []
    for model in models:
        escaped = json.dumps(json.dumps(model, ensure_ascii=False))
        chunks.append(f'self.__next_f.push([1,{escaped}])')
    return "<html><script>" + "".join(chunks) + "</script></html>"


GLM_FLASH = {"slug": "glm-5-3-flash", "name": "GLM 5.3 Flash", "shortName": "GLM 5.3 Flash",
             "modelCreatorName": "Z.ai", "intelligenceIndex": 27.803889160883,
             "contextWindowTokens": 1048576, "price1mInputTokens": 0.0269,
             "scores": {"gpqa-diamond": 0.82}}
GLM_BASE = {"slug": "glm-5-3", "name": "GLM 5.3", "intelligenceIndex": 31.653381843882}
NO_INDEX = {"slug": "some-model", "name": "Some Model"}


# ---- parsing -------------------------------------------------------------------------

def test_extract_models_reads_the_flight_payload():
    entries = harvest.extract_models(page([GLM_FLASH, GLM_BASE, NO_INDEX]))
    assert [e["slug"] for e in entries] == ["glm-5-3-flash", "glm-5-3"]
    assert entries[0][harvest.FIELD] == pytest.approx(27.803889160883)
    assert entries[0]["name"] == "GLM 5.3 Flash"
    assert entries[0]["shortName"] == "GLM 5.3 Flash"


def test_object_scan_returns_the_whole_object():
    """The scan must not stop at the first brace: fields after the index come too."""
    payload = harvest.rsc_payload(page([GLM_FLASH]))
    chunk = json.loads(harvest._object_around(payload, payload.find('"intelligenceIndex"')))
    assert chunk["contextWindowTokens"] == 1048576
    assert chunk["scores"]["gpqa-diamond"] == 0.82


def test_extract_models_drops_entries_without_an_index_and_duplicates():
    twice = page([GLM_FLASH, GLM_FLASH, NO_INDEX])
    assert len(harvest.extract_models(twice)) == 1


def test_extract_models_ignores_a_broken_payload():
    assert harvest.extract_models("<html>nothing here</html>") == []
    assert harvest.extract_models("") == []


# ---- matching ------------------------------------------------------------------------

def test_normalise_bridges_artificial_analysis_and_openrouter_names():
    assert harvest.normalise("GLM-5.3-Flash") == harvest.normalise("glm-5.3-flash")
    assert harvest.normalise("z-ai/glm-5.3-flash") == "zaiglm53flash"  # vendor kept


def test_match_uses_the_slug_the_name_or_the_short_name():
    ids = ["z-ai/glm-5.3-flash", "z-ai/glm-5.3", "other/model"]
    matches = harvest.match(harvest.extract_models(page([GLM_FLASH, GLM_BASE])), ids)
    assert matches == {"z-ai/glm-5.3-flash": 27.8, "z-ai/glm-5.3": 31.65}


def test_match_is_exact_and_never_guesses():
    # 'glm-5-3-flashx' normalises to 'glm53flashx': no entry matches, so nothing is written.
    ids = ["z-ai/glm-5.3-flashx"]
    assert harvest.match(harvest.extract_models(page([GLM_FLASH])), ids) == {}


# ---- merging -------------------------------------------------------------------------

def test_merge_adds_values_and_leaves_existing_ones_alone():
    benchmarks = {"models": {"z-ai/glm-5.3": {"intelligence_index": 99.0}}}
    updated, added, kept = harvest.merge(
        benchmarks, {"z-ai/glm-5.3": 31.65, "z-ai/glm-5.3-flash": 27.8})
    assert added == ["z-ai/glm-5.3-flash"]
    assert kept == ["z-ai/glm-5.3"]
    assert updated["models"]["z-ai/glm-5.3"]["intelligence_index"] == 99.0  # user's value kept
    assert updated["models"]["z-ai/glm-5.3-flash"]["intelligence_index"] == 27.8
    assert "artificialanalysis" in updated["_sources"]["intelligence_index"]
    assert updated["_last_updated"].endswith("Z")


def test_merge_starts_an_empty_store():
    updated, added, kept = harvest.merge({}, {"z-ai/glm-5.3-flash": 27.8})
    assert added == ["z-ai/glm-5.3-flash"] and kept == []
    assert updated["models"]["z-ai/glm-5.3-flash"] == {"intelligence_index": 27.8}


# ---- free API ------------------------------------------------------------------------

API_PAYLOAD = {
    "status": 200,
    "data": [
        {"id": "uuid-1", "name": "GLM 5.3 Flash", "slug": "glm-5-3-flash",
         "model_creator": {"id": "uuid-c", "name": "Z.ai", "slug": "z-ai"},
         "evaluations": {"artificial_analysis_intelligence_index": 27.803889160883,
                         "artificial_analysis_coding_index": None,
                         "artificial_analysis_agentic_index": None},
         "pricing": {"price_1m_input_tokens": 0.0269, "price_1m_output_tokens": 0.0996}},
        {"id": "uuid-2", "name": "Unscored", "slug": "unscored",
         "model_creator": {"slug": "acme"},
         "evaluations": {"artificial_analysis_intelligence_index": None}},
    ],
}


def test_entries_from_api_reads_the_free_payload():
    entries = harvest.entries_from_api(API_PAYLOAD)
    assert len(entries) == 2
    assert entries[0]["creator"] == "z-ai"
    assert entries[0][harvest.FIELD] == pytest.approx(27.803889160883)
    # AA no longer publishes coding/agentic indices; the API says so with nulls.
    assert entries[1][harvest.FIELD] is None


def test_api_entry_with_no_index_is_not_a_match():
    entries = harvest.entries_from_api(API_PAYLOAD)
    assert harvest.match(entries, ["acme/unscored"]) == {}
    assert harvest.match(entries, ["z-ai/glm-5.3-flash"]) == {"z-ai/glm-5.3-flash": 27.8}


def test_match_uses_the_creator_when_two_vendors_share_a_name():
    entries = harvest.entries_from_api(API_PAYLOAD)
    ids = ["z-ai/glm-5.3-flash", "other/glm-5.3-flash"]
    # The vendor-aware key matches both (the name part is identical), so both are filled:
    # that is the honest answer — the same model name under two vendors is the same model.
    assert sorted(harvest.match(entries, ids)) == ["other/glm-5.3-flash", "z-ai/glm-5.3-flash"]


def test_end_to_end_merge_from_api_payload():
    entries = harvest.entries_from_api(API_PAYLOAD)
    matches = harvest.match(entries, ["z-ai/glm-5.3-flash", "z-ai/glm-5.3-flashx"])
    updated, added, kept = harvest.merge({}, matches, source_url=harvest.API_URL)
    assert added == ["z-ai/glm-5.3-flash"]
    assert updated["models"]["z-ai/glm-5.3-flash"][harvest.FIELD] == 27.8
    assert "api/v2/data/llms/models" in updated["_sources"][harvest.FIELD]


def test_relayed_models_are_not_shadowed(monkeypatch, tmp_path):
    """A model OpenRouter already scores must not be rewritten from a snapshot."""
    store = tmp_path
    (store / "_openrouter_cache.json").write_text(json.dumps({"data": [
        {"id": "z-ai/glm-5.3-flash", "benchmarks": {"artificial_analysis": {"intelligence_index": 27.8}}},
        {"id": "z-ai/glm-5.3-flashx", "benchmarks": {}},
    ]}))
    ids, relayed = harvest.openrouter_catalogue(store)
    assert ids == ["z-ai/glm-5.3-flash", "z-ai/glm-5.3-flashx"]
    assert relayed == {"z-ai/glm-5.3-flash"}
    entries = harvest.entries_from_api({"data": [
        {"slug": "glm-5-3-flash", "name": "GLM 5.3 Flash", "model_creator": {"slug": "z-ai"},
         "evaluations": {"artificial_analysis_intelligence_index": 27.8}},
        {"slug": "glm-5-3-flashx", "name": "GLM 5.3 FlashX", "model_creator": {"slug": "z-ai"},
         "evaluations": {"artificial_analysis_intelligence_index": 29.0}},
    ]})
    matches = {k: v for k, v in harvest.match(entries, ids).items() if k not in relayed}
    assert matches == {"z-ai/glm-5.3-flashx": 29.0}
