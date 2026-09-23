"""LLM Dashboard backend - FastAPI.

Sources:
- OpenRouter API (prix, contexte, benchmarks, metadata): https://openrouter.ai/api/v1/models
- Cache: TTL-based to avoid hitting OpenRouter rate limits
"""
from __future__ import annotations

import json
import logging
import os
import re
import shutil
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel

DATA_DIR = Path(os.environ.get("LLM_DASH_DATA", Path(__file__).parent / "data"))
# (plugin layout: plugin_api.py lives in dashboard/, so data/ is dashboard/data)
MODELS_FILE = DATA_DIR / "models.json"
BENCHMARKS_FILE = DATA_DIR / "benchmarks.json"
PRICE_HISTORY_FILE = DATA_DIR / "price_history.json"

LANGUAGES_FILE = DATA_DIR / "languages.json"
CACHE_FILE = DATA_DIR / "_openrouter_cache.json"
PROFILES_FILE = DATA_DIR / "profiles.json"
OPENROUTER_URL = "https://openrouter.ai/api/v1/models"
CACHE_TTL = int(os.environ.get("LLM_DASH_CACHE_TTL", 300))

# HuggingFace language resolution (cardData.language). Public API is rate-limited
# per IP (~100 req/min unauthenticated), so we throttle to one request per
# HF_LANGS_MIN_INTERVAL and cache results with a long TTL.
HF_LANGS_CACHE_FILE = DATA_DIR / "_hf_langs_cache.json"
HF_LANGS_TTL = int(os.environ.get("LLM_DASH_HF_LANGS_TTL", 86400))   # 24h
HF_LANGS_MIN_INTERVAL = float(os.environ.get("LLM_DASH_HF_INTERVAL", 0.5))
_last_hf_fetch = {"ts": 0.0}

router = APIRouter()
logger = logging.getLogger("hermes-model-leaderboard")


def _profile_config_files():
    """(profile_name, config.yaml path) for every installed Hermes profile.

    Returns [] when ``hermes_cli`` is not importable (unit tests) — seeding is a
    production-only nicety, never a reason to touch the network in a test."""
    try:
        from hermes_cli import profiles as profiles_mod
        infos = list(profiles_mod.list_profiles())
    except Exception:
        return []
    out = []
    for info in infos:
        name = getattr(info, "name", None)
        path = getattr(info, "path", None)
        if name and path:
            out.append((name, Path(path) / "config.yaml"))
    out.sort(key=lambda kv: (kv[0] != "default", kv[0]))
    return out


def _model_from_config(cfg_path):
    """The main model slug declared by a profile, or None."""
    try:
        import yaml
    except Exception:
        return None
    try:
        data = yaml.safe_load(cfg_path.read_text()) or {}
    except Exception:
        return None
    model = data.get("model")
    if isinstance(model, str) and model.strip():
        return model.strip()
    if isinstance(model, dict):
        for key in ("default", "name", "model", "id"):
            value = model.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def _profile_model_ids():
    """Model slugs declared across the installed profiles ('default' first)."""
    ids = []
    for _name, cfg in _profile_config_files():
        mid = _model_from_config(cfg)
        if mid and mid not in ids:
            ids.append(mid)
    return ids


def _seed_models_from_profiles():
    """First run: start the tracked list from the models the profiles declare.

    Returns None when no profile declares a model (caller falls back to an empty
    list). Network failures degrade to entries marked ``available: False`` so the
    plugin still shows the model instead of an empty page."""
    ids = _profile_model_ids()
    if not ids:
        return None
    now = time.time()
    entries = []
    try:
        or_data = _fetch_openrouter(ids)
    except Exception as e:
        logger.warning(f"Profile seeding could not read OpenRouter: {e}")
        or_data = {}
    for mid in ids:
        entry = {"id": mid, "label": mid.split("/")[-1], "added_at": now,
                 "added_via": "profile-seed"}
        if mid in or_data:
            entry.update(or_data[mid])
            entry["available"] = True
        else:
            entry["available"] = False
        entries.append(entry)
    logger.info(f"Seeded {len(entries)} tracked model(s) from the Hermes profiles")
    return entries


def _load_models():
    if MODELS_FILE.exists():
        try:
            models = json.loads(MODELS_FILE.read_text())
            if models:
                return models
        except Exception:
            pass
    # First run (no file / empty file): seed from the profile-declared models.
    seeded = _seed_models_from_profiles()
    if seeded:
        _save_models(seeded)
        return seeded
    return []

def _save_models(models):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_FILE.write_text(json.dumps(models, indent=2, ensure_ascii=False))

def _load_price_history():
    if not PRICE_HISTORY_FILE.exists(): return {}
    try: return json.loads(PRICE_HISTORY_FILE.read_text())
    except Exception: return {}


def _record_price_history(model_id: str, prompt_p, completion_p, cache_read_p=None, cache_write_p=None, timestamp=None):
    ts = timestamp or time.time()
    history = _load_price_history()
    model_hist = history.get(model_id, [])
    
    new_entry = {
        "ts": ts,
        "prompt": prompt_p,
        "completion": completion_p,
        "cache_read": cache_read_p,
        "cache_write": cache_write_p
    }
    
    if not model_hist:
        history[model_id] = [new_entry]
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        PRICE_HISTORY_FILE.write_text(json.dumps(history, indent=2, ensure_ascii=False))
        return True, None
    
    last = model_hist[-1]
    # Check if input, output, cache read or cache write changed
    changed = (
        last.get("prompt") != prompt_p or
        last.get("completion") != completion_p or
        last.get("cache_read") != cache_read_p or
        last.get("cache_write") != cache_write_p
    )
    if changed:
        model_hist.append(new_entry)
        history[model_id] = model_hist
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        PRICE_HISTORY_FILE.write_text(json.dumps(history, indent=2, ensure_ascii=False))
        return True, last
    return False, None


def _load_benchmarks():
    if not BENCHMARKS_FILE.exists(): return {}
    return json.loads(BENCHMARKS_FILE.read_text()).get("models", {})

def _load_languages():
    if not LANGUAGES_FILE.exists(): return {}
    return json.loads(LANGUAGES_FILE.read_text()).get("models", {})

def _load_hf_lang_cache():
    if not HF_LANGS_CACHE_FILE.exists(): return {}
    try: return json.loads(HF_LANGS_CACHE_FILE.read_text())
    except Exception: return {}

def _save_hf_lang_cache(cache):
    cache["_last_updated"] = time.time()
    HF_LANGS_CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False))

def _fetch_hf_languages(hf_id: str):
    """Return ISO language codes for a HF model id (cardData.language), or None."""
    global _last_hf_fetch
    # throttle per-IP so we don't trip the public HF rate limit
    wait = HF_LANGS_MIN_INTERVAL - (time.time() - _last_hf_fetch["ts"])
    if wait > 0: time.sleep(wait)
    _last_hf_fetch["ts"] = time.time()
    try:
        r = httpx.get(f"https://huggingface.co/api/models/{hf_id}", timeout=20,
                      headers={"User-Agent": "llm-dashboard/1.0"})
        r.raise_for_status()
        langs = (r.json().get("cardData") or {}).get("language")
    except Exception:
        return None
    if isinstance(langs, str):
        langs = [langs]
    if not isinstance(langs, list):
        return None
    out = []
    for l in langs:
        if isinstance(l, str):
            l = l.strip()
            if l: out.append(l)
    return out or None

def _resolve_full_languages():
    """Merge curated languages.json with HF-resolved languages so every tracked
    model gets its ISO codes. HF results are cached (24h TTL) and only fetched
    once per model that still lacks languages and has a hugging_face_id."""
    curated = _load_languages()
    cache = _load_hf_lang_cache()
    models = _load_models()
    now = time.time()

    changed = False
    for m in models:
        mid = m["id"]
        if curated.get(mid):
            continue  # already curated / resolved
        hf_id = m.get("hugging_face_id")
        if not hf_id:
            continue
        cached = cache.get(hf_id)
        if cached and isinstance(cached, dict) and (now - cached.get("ts", 0) < HF_LANGS_TTL):
            langs = cached.get("langs")
        else:
            langs = _fetch_hf_languages(hf_id)
            cache[hf_id] = {"ts": now, "langs": langs}
            changed = True
        if langs:
            curated[mid] = langs

    if changed:
        _save_hf_lang_cache(cache)
        LANGUAGES_FILE.write_text(json.dumps({"_description": "Langues supportées par modèle (codes ISO 639-1). Curaté manuellement ou résolu via HF cardData.language.", "models": curated}, indent=2, ensure_ascii=False))
    return curated

def _estimate_gpu(model_size_str):
    if not model_size_str: return None
    nums = re.findall(r'(\d+\.?\d*)\s*B', model_size_str)
    if not nums: return None
    param_b = float(nums[-1])
    return {
        "param_count_b": param_b,
        "vram_q4_gb": round(param_b * 0.55 * 1.2, 1),
        "vram_q8_gb": round(param_b * 1.0 * 1.2, 1),
        "vram_fp16_gb": round(param_b * 2.0 * 1.2, 1),
        "fits_64gb": param_b * 0.55 * 1.2 <= 64,
    }


class ModelIn(BaseModel):
    id: str
    label: str | None = None


@router.get("/models")
def get_models():
    models = _load_models()
    benchmarks = _load_benchmarks()
    languages = _load_languages()
    for m in models:
        m["benchmarks"] = benchmarks.get(m["id"], {})
        m["iso_langs"] = languages.get(m["id"], [])
        if "gpu" not in m and m.get("model_size"):
            m["gpu"] = _estimate_gpu(m["model_size"])
    return {"models": models, "last_refresh": _meta().get("last_refresh"), "cache_age_s": _cache_age()}


@router.post("/models")
def add_model(m: ModelIn):
    models = _load_models()
    mid = m.id.strip()
    if any(x["id"] == mid for x in models):
        raise HTTPException(400, f"Modele deja present: {mid}")
    entry = {"id": mid, "label": m.label or mid.split("/")[-1], "added_at": time.time()}
    or_data = _fetch_openrouter([mid])
    if mid in or_data:
        entry.update(or_data[mid])
        entry["available"] = True
    else:
        entry["available"] = False
    models.append(entry)
    _save_models(models)
    return {"model": entry}


@router.delete("/models/{model_id:path}")
def delete_model(model_id: str):
    models = _load_models()
    before = len(models)
    models = [m for m in models if m["id"] != model_id]
    if len(models) == before:
        raise HTTPException(404, f"Modele introuvable: {model_id}")
    _save_models(models)
    return {"deleted": model_id}


def _extract_model_size(raw):
    candidates = []
    for key in ("name", "canonical_slug", "hugging_face_id"):
        source = raw.get(key)
        if not source: continue
        found = re.findall(r'(\d+\.?\d*)\s*([Bb])\b', source)
        for num, unit in found:
            candidates.append(f"{num}{unit.upper()}")
    seen = set(); out = []
    for c in candidates:
        if c not in seen: seen.add(c); out.append(c)
    return " / ".join(out) if out else None


def _get_cached_or_fetch(force=False):
    if not force and CACHE_FILE.exists():
        try:
            cached = json.loads(CACHE_FILE.read_text())
            if time.time() - cached["ts"] < CACHE_TTL:
                return cached["data"]
        except: pass
    r = httpx.get(OPENROUTER_URL, timeout=30)
    r.raise_for_status()
    data = r.json()["data"]
    CACHE_FILE.write_text(json.dumps({"ts": time.time(), "data": data}))
    return data


def _cache_age():
    if not CACHE_FILE.exists(): return None
    try: return time.time() - json.loads(CACHE_FILE.read_text())["ts"]
    except: return None


def _fetch_openrouter(ids):
    try: all_models = _get_cached_or_fetch()
    except Exception as e: raise HTTPException(502, f"OpenRouter inaccessible: {e}")

    out = {}
    for m in all_models:
        if m["id"] not in ids: continue
        p = m.get("pricing", {})
        def _price(k):
            try: return round(float(p.get(k, 0) or 0) * 1_000_000, 4)
            except: return None

        aa = m.get("benchmarks", {}).get("artificial_analysis", {})
        modality = (m.get("architecture") or {}).get("modality") or ""
        has_vision = "image" in modality or "video" in modality
        model_size_str = _extract_model_size(m)

        p_in = _price("prompt")
        p_out = _price("completion")
        p_cache_read = _price("input_cache_read")
        p_cache_write = _price("input_cache_write")
        
        # Record history if prices changed
        _record_price_history(m["id"], p_in, p_out, p_cache_read, p_cache_write)

        arch = m.get("architecture") or {}
        out[m["id"]] = {
            "name": m.get("name"), "context_length": m.get("context_length"),
            "prompt_price": p_in, "completion_price": p_out,
            "cache_read_price": p_cache_read, "cache_write_price": p_cache_write,
            "web_search_price": _price("web_search"),
            "internal_reasoning_price": _price("internal_reasoning"),
            "input_modalities": arch.get("input_modalities") or [],
            "output_modalities": arch.get("output_modalities") or [],
            "created": m.get("created"), "knowledge_cutoff": m.get("knowledge_cutoff"),
            "modality": modality, "has_vision": has_vision,
            "supported_parameters": m.get("supported_parameters", []),
            "description": (m.get("description") or "")[:500],
            "intelligence_index": aa.get("intelligence_index"), "coding_index": aa.get("coding_index"),
            "agentic_index": aa.get("agentic_index"),
            "hugging_face_id": m.get("hugging_face_id") or None,
            "open_weights": bool(m.get("hugging_face_id")),
            "model_size": model_size_str,
            "reasoning": bool(m.get("reasoning")) if m.get("reasoning") else False,
            "gpu": _estimate_gpu(model_size_str),
        }
    return out


def _meta():
    f = DATA_DIR / "_meta.json"
    return json.loads(f.read_text()) if f.exists() else {}


@router.post("/refresh")
def refresh(force: bool = False, payload: dict = Body(default={})):
    # `force` bypasses the 5-min OpenRouter cache. Accept it as a query param
    # (?force=true) or in the JSON body — the desktop bridge sets the body, and
    # without it the button just re-merged the cached payload (looked like a
    # no-op).
    models = _load_models()
    ids = [m["id"] for m in models]
    if not ids: return {"refreshed": 0}
    force = force or bool((payload or {}).get("force"))
    if force: CACHE_FILE.unlink(missing_ok=True)
    or_data = _fetch_openrouter(ids)
    now = time.time()
    for m in models:
        if m["id"] in or_data:
            m.update(or_data[m["id"]]); m["available"] = True; m["last_updated"] = now
        else: m["available"] = False
    _save_models(models)
    (DATA_DIR / "_meta.json").write_text(json.dumps({"last_refresh": now}))
    # Resolve languages from HuggingFace for any tracked model still missing them
    resolved = 0
    try:
        resolved = sum(1 for v in _resolve_full_languages().values() if v)
    except Exception as e:
        logger.warning(f"HuggingFace language resolution failed: {e}", exc_info=True)
    return {"refreshed": len(or_data), "missing": [i for i in ids if i not in or_data], "langs_resolved": resolved}


@router.get("/openrouter/search")
def search_openrouter(q: str = ""):
    all_models = _get_cached_or_fetch()
    ql = q.lower()
    results = []
    for m in all_models:
        if ql and ql not in m["id"].lower() and ql not in (m.get("name") or "").lower():
            continue
        modality = (m.get("architecture") or {}).get("modality") or ""
        results.append({
            "id": m["id"], "name": m.get("name"),
            "context_length": m.get("context_length"),
            "prompt_price": round(float(m.get("pricing", {}).get("prompt") or 0) * 1e6, 4),
            "completion_price": round(float(m.get("pricing", {}).get("completion") or 0) * 1e6, 4),
            "open_weights": bool(m.get("hugging_face_id")),
            "model_size": _extract_model_size(m),
            "has_vision": "image" in modality or "video" in modality,
        })
    return {"results": results[:40], "total": len(results), "cache_age_s": _cache_age()}


@router.get("/news")
def get_news():
    """
    Retourne :
    1. new_models : Les modèles récemment ajoutés au catalogue OpenRouter (triés par date de création décroissante).
    2. price_changes : Les modèles de la liste suivie ou du catalogue ayant eu des variations de prix enregistrées.
    3. promotions : Les modèles bénéficiant de réductions / remises notables.
    """
    all_models = _get_cached_or_fetch()
    tracked_models = _load_models()
    tracked_ids = set(m["id"] for m in tracked_models)
    price_history = _load_price_history()
    
    # 1. New models (top 30 recent models from catalog)
    sorted_by_created = sorted(
        [m for m in all_models if m.get("created")],
        key=lambda x: x.get("created") or 0,
        reverse=True
    )
    
    new_models = []
    for m in sorted_by_created[:120]:
        p = m.get("pricing", {})
        def _pr(k):
            try: return round(float(p.get(k, 0) or 0) * 1e6, 4)
            except: return None
        aa = m.get("benchmarks", {}).get("artificial_analysis", {})
        modality = (m.get("architecture") or {}).get("modality") or ""
        new_models.append({
            "id": m["id"],
            "name": m.get("name") or m["id"],
            "created": m.get("created"),
            "context_length": m.get("context_length"),
            "prompt_price": _pr("prompt"),
            "completion_price": _pr("completion"),
            "cache_read_price": _pr("input_cache_read"),
            "has_vision": "image" in modality or "video" in modality,
            "open_weights": bool(m.get("hugging_face_id")),
            "supported_parameters": m.get("supported_parameters", []),
            "intelligence_index": aa.get("intelligence_index"),
            "coding_index": aa.get("coding_index"),
            "agentic_index": aa.get("agentic_index"),
            "is_tracked": m["id"] in tracked_ids,
        })
        
    # 2. Price changes from history — rolling 24h and 7d variations
    def _pct(old, new):
        if old is None or old <= 0 or new is None:
            return None
        return round(((new - old) / old) * 100, 1)

    price_changes = []
    for mid, hist in price_history.items():
        if len(hist) < 2:
            continue
        curr = hist[-1]
        curr_ts = curr.get("ts") or 0
        p_now_in = curr.get("prompt")
        p_now_out = curr.get("completion")

        def _ref_point(window_s):
            best = None
            for point in hist[:-1]:
                ts = point.get("ts") or 0
                if ts <= curr_ts - window_s and (best is None or ts >= (best.get("ts") or 0)):
                    best = point
            return best

        ref_1d = _ref_point(86400)
        ref_7d = _ref_point(7 * 86400)

        pct_1d = _pct(ref_1d.get("prompt"), p_now_in) if ref_1d else None
        pct_7d = _pct(ref_7d.get("prompt"), p_now_in) if ref_7d else None
        if pct_1d is None and ref_1d:
            pct_1d = _pct(ref_1d.get("completion"), p_now_out)
        if pct_7d is None and ref_7d:
            pct_7d = _pct(ref_7d.get("completion"), p_now_out)

        if pct_1d is None and pct_7d is None:
            continue

        price_changes.append({
            "id": mid,
            "changed_at": curr_ts,
            "percent_1d": pct_1d,
            "percent_7d": pct_7d,
            "percent_change": pct_1d if pct_1d is not None else pct_7d,
            "is_tracked": mid in tracked_ids,
        })

    price_changes.sort(key=lambda x: x.get("changed_at") or 0, reverse=True)
    
    # 3. Promotions : curated or detected from description/discounted models enriched with model details
    promo_defs = [
        {"id": "google/gemini-3.7-flash", "name": "Gemini 3.7 Flash", "discount_text": "-75%", "details": "Promotion OpenRouter limitée à $0.375 / $1.875 par M tk", "ends_at": "2026-09-30"},
        {"id": "upstage/solar-pro4", "name": "Solar Pro 4", "discount_text": "-90%", "details": "$0.03 in / $0.12 out par M tk (524K ctx)", "ends_at": "2026-10-15"},
        {"id": "inclusionai/ling-3.0-flash", "name": "Ling-3.0-flash", "discount_text": "-65%", "details": "$0.021 in / $0.063 out par M tk (124B MoE)", "ends_at": "2026-10-01"},
        {"id": "bytedance/seedance-2.0-mini", "name": "Seedance 2.0 Mini", "discount_text": "-60%", "details": "Génération vidéo ByteDance à $0.01345/s", "ends_at": "2026-09-20"},
        {"id": "poolside/laguna-s-2.1", "name": "Laguna S 2.1", "discount_text": "-10%", "details": "Modèle agentic coding Poolside à $0.09 in / $0.18 out", "ends_at": "2026-10-31"},
        {"id": "openai/gpt-5.6-sol", "name": "GPT-5.6 Sol", "discount_text": "-50%", "details": "$2 in / $10 out par M tk", "ends_at": "2026-09-25"},
    ]
    _now_ts = time.time()
    promo_defs = [p for p in promo_defs
                  if not p.get("ends_at")
                  or time.mktime(time.strptime(p["ends_at"], "%Y-%m-%d")) >= _now_ts]
    
    catalog_map = {m["id"]: m for m in all_models}
    promotions = []
    for p in promo_defs:
        raw = catalog_map.get(p["id"], {})
        pricing = raw.get("pricing", {})
        def _pr_promo(k):
            try: return round(float(pricing.get(k, 0) or 0) * 1e6, 4)
            except: return None
        aa = raw.get("benchmarks", {}).get("artificial_analysis", {})
        modality = (raw.get("architecture") or {}).get("modality") or ""
        promotions.append({
            "id": p["id"],
            "name": p["name"],
            "discount_text": p["discount_text"],
            "details": p["details"],
            "ends_at": p.get("ends_at"),
            "context_length": raw.get("context_length"),
            "prompt_price": _pr_promo("prompt"),
            "completion_price": _pr_promo("completion"),
            "cache_read_price": _pr_promo("input_cache_read"),
            "has_vision": "image" in modality or "video" in modality,
            "open_weights": bool(raw.get("hugging_face_id")),
            "supported_parameters": raw.get("supported_parameters", []),
            "intelligence_index": aa.get("intelligence_index"),
            "coding_index": aa.get("coding_index"),
            "agentic_index": aa.get("agentic_index"),
            "is_tracked": p["id"] in tracked_ids,
        })
    
    return {
        "new_models": new_models,
        "price_changes": price_changes,
        "promotions": promotions,
    }


@router.get("/benchmarks")
def get_benchmarks(): return _load_benchmarks()


@router.post("/benchmarks")
def update_benchmarks(data: dict):
    mid, field, value = data.get("model_id"), data.get("field"), data.get("value")
    if not mid or not field: raise HTTPException(400, "model_id and field required")
    allb = _load_benchmarks()
    allb.setdefault(mid, {})[field] = value
    full = {"_description": "Scores curates manuellement.", "_last_updated": "2026-08-21",
            "_sources": BENCHMARKS_FILE.exists() and json.loads(BENCHMARKS_FILE.read_text()).get("_sources", {}),
            "models": allb}
    BENCHMARKS_FILE.write_text(json.dumps(full, indent=2, ensure_ascii=False))
    return {"updated": mid, field: value}





# Profile persistence (backend-side; the plugin runs inside the
# authenticated Hermes context — no anonymous/local fallback).


class ProfileIn(BaseModel):
    id: str
    name: str
    weights: dict[str, int | float] = {}




# -----------------------------------------------------------------------------
# Profiles (weights per team role)
# -----------------------------------------------------------------------------

DEFAULT_PROFILES = {
    "architecte": {"id": "architecte", "name": "Architecte", "weights": {
        "intelligence": 5, "coding": 4, "context": 3, "price_in": 2, "price_out": 2,
        "has_vision": 1, "agentic": 0, "tools": 0, "open_weights": 0, "fits_64gb": 0, "cache_read": 0}},
    "senior-coder": {"id": "senior-coder", "name": "Senior Coder", "weights": {
        "coding": 5, "agentic": 5, "price_out": 3, "context": 3, "has_vision": 2,
        "intelligence": 2, "price_in": 0, "tools": 0, "open_weights": 0, "fits_64gb": 0, "cache_read": 0}},
    "junior-coder": {"id": "junior-coder", "name": "Junior Coder", "weights": {
        "price_out": 5, "open_weights": 4, "price_in": 3, "fits_64gb": 3, "tools": 2,
        "coding": 2, "intelligence": 0, "agentic": 0, "context": 0, "has_vision": 0, "cache_read": 0}},
    "manager": {"id": "manager", "name": "Manager", "weights": {
        "price_in": 5, "intelligence": 4, "price_out": 3, "tools": 3, "context": 3,
        "coding": 0, "agentic": 0, "has_vision": 0, "open_weights": 0, "fits_64gb": 0, "cache_read": 0}},
    "qa": {"id": "qa", "name": "QA", "weights": {
        "tools_vision": 5, "coding": 4, "price_out": 4, "intelligence": 3, "context": 2,
        "agentic": 1, "price_in": 0, "open_weights": 0, "fits_64gb": 0, "cache_read": 0}},
}


def _load_profiles():
    if not PROFILES_FILE.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        PROFILES_FILE.write_text(json.dumps(DEFAULT_PROFILES, indent=2, ensure_ascii=False))
        return json.loads(json.dumps(DEFAULT_PROFILES))
    try:
        data = json.loads(PROFILES_FILE.read_text())
        if not data or not isinstance(data, dict):
            PROFILES_FILE.write_text(json.dumps(DEFAULT_PROFILES, indent=2, ensure_ascii=False))
            return json.loads(json.dumps(DEFAULT_PROFILES))
        return data
    except Exception:
        return json.loads(json.dumps(DEFAULT_PROFILES))


def _save_profiles(profiles_dict):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROFILES_FILE.write_text(json.dumps(profiles_dict, indent=2, ensure_ascii=False))


def compute_generic_score(model: dict, weights: dict, maxes: dict) -> float:
    total_weight = sum(w for w in weights.values() if w > 0)
    if total_weight <= 0:
        return 0.0

    max_intel = maxes.get("maxIntel", 1.0) or 1.0
    max_coding = maxes.get("maxCoding", 1.0) or 1.0
    max_agentic = maxes.get("maxAgentic", 1.0) or 1.0
    max_price = maxes.get("maxPrice", 1.0) or 1.0
    max_price_cache = maxes.get("maxPriceCache", 1.0) or 1.0
    max_ctx = maxes.get("maxCtx", 1.0) or 1.0

    intel = (model.get("intelligence_index") or 0.0) / max_intel
    coding = (model.get("coding_index") or 0.0) / max_coding
    agentic = (model.get("agentic_index") or 0.0) / max_agentic

    prompt_price = model.get("prompt_price") or 0.0
    completion_price = model.get("completion_price") or 0.0
    cache_read_price = model.get("cache_read_price") or 0.0
    ctx_length = model.get("context_length") or 0.0

    p_in = 1.0 - min(1.0, prompt_price / max_price) if max_price > 0 else 1.0
    p_out = 1.0 - min(1.0, completion_price / max_price) if max_price > 0 else 1.0
    p_cache = 1.0 - min(1.0, cache_read_price / max_price_cache) if max_price_cache > 0 else 1.0
    ctx = min(1.0, ctx_length / max_ctx) if max_ctx > 0 else 0.0

    has_v = 1.0 if model.get("has_vision") else 0.0
    has_t = 1.0 if "tools" in (model.get("supported_parameters") or []) else 0.0
    is_open = 1.0 if model.get("open_weights") else 0.0
    fits_64 = 1.0 if (model.get("gpu") and model["gpu"].get("fits_64gb")) else 0.0
    tools_vision = has_t * has_v

    values = {
        "intelligence": intel, "coding": coding, "agentic": agentic,
        "price_in": p_in, "price_out": p_out, "cache_read": p_cache, "context": ctx,
        "tools": has_t, "has_vision": has_v, "open_weights": is_open,
        "fits_64gb": fits_64, "tools_vision": tools_vision,
    }

    weighted_sum = sum(values.get(k, 0.0) * w for k, w in weights.items() if w > 0)
    score = (weighted_sum / total_weight) * 100.0
    return max(0.0, min(100.0, score))


@router.get("/hermes-profiles")
def hermes_profiles():
    """List the Hermes profiles installed on this instance ('default' first).

    Reuses the same source as the gateway's /api/profiles (hermes_cli.profiles);
    falls back to ['default'] when the hermes package is not importable (tests)."""
    try:
        from hermes_cli import profiles as profiles_mod
        infos = [(info.name, getattr(info, "path", None)) for info in profiles_mod.list_profiles()]
        names = [n for n, _ in infos if n]
    except Exception:
        names = []
    if "default" in names:
        names.remove("default")
    return {"profiles": ["default"] + sorted(names)}


_CRITERIA_DOC = {
    "intelligence": "global reasoning and knowledge depth",
    "coding": "code generation quality",
    "agentic": "multi-step autonomy and tool use",
    "price_in": "importance of cheap INPUT tokens",
    "price_out": "importance of cheap OUTPUT tokens",
    "cache_read": "importance of cheap cached input",
    "context": "ability to handle very long contexts (1M+ tokens)",
    "tools": "native tool/function calling support",
    "has_vision": "image / screenshot understanding",
    "open_weights": "preference for open-weights, self-hostable models",
    "fits_64gb": "runnable locally on a 64GB GPU",
    "tools_vision": "combined tools + vision (browser QA)",
    "languages": "multilingual coverage",
}


@router.post("/auto-fill")
def auto_fill(payload: dict = Body(default={})):
    """Ask the Hermes DEFAULT model to propose 0-5 weights for a tracking profile.

    The plugin builds an English prompt explaining every criterion; the model
    must answer with a strict JSON object. Best-effort: errors are returned as
    HTTP 503 with a `detail` message."""
    import json as _json
    import re as _re
    import shutil as _shutil
    import subprocess as _subprocess

    profile_id = (payload.get("profile_id") or "default").strip()
    profile_name = (payload.get("profile_name") or profile_id).strip()

    criteria_lines = "\n".join(f"- {k}: {v}" for k, v in _CRITERIA_DOC.items())
    prompt = (
        "You are configuring the LLM scoring weights for an AI agent profile "
        f"named '{profile_name}' (id: {profile_id}) in a team of Hermes agents.\n"
        "Each criterion is an importance weight from 0 (ignore) to 5 (critical) "
        "used to rank LLM models for this profile's daily work.\n\n"
        "Criteria:\n" + criteria_lines + "\n\n"
        "Think about what matters for this profile (its role, its tasks, whether "
        "it is price-sensitive, needs vision, long context, etc.) and choose "
        "sensible integer weights. A typical profile has 2-4 criteria above 3.\n"
        "Answer with ONLY a JSON object mapping each criterion name to its "
        "integer weight. No markdown, no explanation."
    )

    hermes_exe = _shutil.which("hermes") or str(Path.home() / ".local" / "bin" / "hermes")
    try:
        proc = _subprocess.run(
            [hermes_exe, "-z", prompt],
            capture_output=True, text=True, timeout=180,
            env={**os.environ, "NO_COLOR": "1", "TERM": "dumb"},
        )
        out = (proc.stdout or "") + "\n" + (proc.stderr or "")
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="hermes CLI not found")
    except _subprocess.TimeoutExpired:
        raise HTTPException(status_code=503, detail="model timeout (>180s)")

    # extract the last JSON object from the answer
    weights = None

    def _try_parse(txt):
        txt = txt.strip()
        try:
            return _json.loads(txt)
        except Exception:
            pass
        # Models often answer JSON5-ish (unquoted keys, single quotes, trailing commas)
        fixed = _re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*):", r'\1"\2"\3:', txt)
        fixed = fixed.replace("'", '"')
        fixed = _re.sub(r",\s*([}\]])", r"\1", fixed)
        try:
            return _json.loads(fixed)
        except Exception:
            return None

    for m in _re.finditer(r"\{[^{}]*\}", out, flags=_re.S):
        cand = _try_parse(m.group(0))
        if isinstance(cand, dict) and any(k in cand for k in _CRITERIA_DOC):
            weights = cand
    if not weights:
        raise HTTPException(status_code=503, detail="model answer did not contain criteria JSON")

    clean = {}
    for k, doc in _CRITERIA_DOC.items():
        try:
            v = int(weights.get(k, 0))
        except (TypeError, ValueError):
            v = 0
        clean[k] = max(0, min(5, v))
    return {"weights": clean, "profile_id": profile_id}


@router.get("/profiles")
def get_profiles():
    return {"profiles": _load_profiles()}


@router.post("/profiles")
def create_profile(p: ProfileIn):
    profiles = _load_profiles()
    pid = p.id.strip().lower()
    if not pid:
        raise HTTPException(400, "L'identifiant du profil est obligatoire")
    if pid in profiles:
        raise HTTPException(400, f"Le profil {pid} existe deja")
    profiles[pid] = {
        "id": pid,
        "name": p.name.strip() or pid,
        "weights": {k: int(v) for k, v in p.weights.items()}
    }
    _save_profiles(profiles)
    return {"status": "ok", "profile": profiles[pid]}


@router.put("/profiles/{profile_id}")
def update_profile(profile_id: str, p: ProfileIn):
    profiles = _load_profiles()
    pid = profile_id.strip().lower()
    if pid not in profiles:
        raise HTTPException(404, f"Profil introuvable : {pid}")
    profiles[pid]["name"] = p.name.strip() or profiles[pid]["name"]
    profiles[pid]["weights"] = {k: int(v) for k, v in p.weights.items()}
    _save_profiles(profiles)
    return {"status": "ok", "profile": profiles[pid]}


@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: str):
    profiles = _load_profiles()
    pid = profile_id.strip().lower()
    if pid not in profiles:
        raise HTTPException(404, f"Profil introuvable : {pid}")
    del profiles[pid]
    _save_profiles(profiles)
    return {"status": "ok", "deleted": pid}
