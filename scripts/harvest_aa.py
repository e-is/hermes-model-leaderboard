#!/usr/bin/env python3
"""Harvest the Artificial Analysis intelligence index into benchmarks.json.

Why
---
OpenRouter relays the Artificial Analysis indices for roughly 42 % of its catalogue
(192 of 453 models when this was written). The rest — aliases such as
``~z-ai/glm-flash-latest``, variants such as ``glm-5.3-flashx`` — arrive with no
intelligence grade at all, and the table shows ``…``. The backend can borrow from an
exact alias or a published sibling (see ``_inheritance`` in ``dashboard/plugin_api.py``),
but for a model that is genuinely new there is nothing to borrow: the value has to come
from the source.

Artificial Analysis publishes it on https://artificialanalysis.ai/leaderboards/models.
The public API (``/api/v2/data/llms/models``) answers 401 without a key, but the page
embeds the whole dataset in its Next.js payload, so this script reads the page.

It is deterministic: the payload is parsed with a brace-balanced scan (no model, no
text heuristics) and a match requires the same normalised model name. The page format
can change, which is why this runs on demand (or from a cron) and never at page load.

What it writes
--------------
``benchmarks.json`` under ``models.<openrouter id>.intelligence_index``, which the
backend's precedence reads as the "manual" source — it wins over OpenRouter and over
inheritance. Entries that already carry the field are left alone (a value someone typed
or a previous harvest is not overwritten silently).

Usage
-----
    python3 scripts/harvest_aa.py --dry-run
    python3 scripts/harvest_aa.py --write
    python3 scripts/harvest_aa.py --write --store ~/.hermes/plugin-data/model-leaderboard
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

#: The free API (an account key, x-api-key, 100–1000 requests/day depending on the doc
#: generation you read — one request per run either way). Preferred over the page: JSON,
#: stable field names, and `model_creator` to disambiguate two models with one name.
API_URL = "https://artificialanalysis.ai/api/v2/data/llms/models"
INTEL_FIELD = "artificial_analysis_intelligence_index"
#: Fallback when no key is configured: the public leaderboard embeds the same values.
PAGE_URL = "https://artificialanalysis.ai/leaderboards/models"
OPENROUTER_URL = "https://openrouter.ai/api/v1/models"
USER_AGENT = "hermes-model-leaderboard-harvester/1.0 (+https://github.com/e-is/hermes-model-leaderboard)"
FIELD = "intelligence_index"


# ---- fetching ------------------------------------------------------------------------

def fetch(url: str, timeout: int = 40, headers: dict | None = None) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def entries_from_api(payload: dict) -> list[dict]:
    """The free API's rows → the same shape the page parser returns.

    `artificial_analysis_coding_index` / `..._agentic_index` are documented as always
    null ("AA no longer publishes a Coding Index or an Agentic Index"): this source can
    only fill the intelligence index, and the backend's inheritance covers the rest.
    """
    out = []
    for model in payload.get("data") or []:
        evaluations = model.get("evaluations") or {}
        creator = (model.get("model_creator") or {}).get("slug") or ""
        out.append({
            "slug": model.get("slug") or "",
            "name": model.get("name") or "",
            "creator": creator,
            FIELD: evaluations.get(INTEL_FIELD),
        })
    return out


# ---- parsing -------------------------------------------------------------------------

def rsc_payload(html: str) -> str:
    """Concatenate the Next.js flight chunks the page streams in ``self.__next_f``."""
    chunks = re.findall(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', html)
    return "".join(json.loads(chunk) for chunk in chunks)


def _object_around(text: str, index: int) -> str:
    """The JSON object containing ``text[index]``, by balanced-brace scan."""
    depth = 0
    start = 0
    i = index
    while i > 0:
        i -= 1
        if text[i] == "}":
            depth += 1
        elif text[i] == "{":
            if depth == 0:
                start = i
                break
            depth -= 1
    depth = 0
    in_string = False
    escaped = False
    j = start
    while j < len(text):
        char = text[j]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
        else:
            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return text[start : j + 1]
        j += 1
    return ""


def extract_models(html: str) -> list[dict]:
    """Every model object carrying an intelligence index, in page order."""
    payload = rsc_payload(html)
    out: list[dict] = []
    seen: set[str] = set()
    # The page spells it in camelCase; entries_from_api() maps the API's field name onto
    # FIELD, so parsing and matching agree on one internal key.
    for match in re.finditer('"intelligenceIndex"', payload):
        chunk = _object_around(payload, match.start())
        if not chunk:
            continue
        try:
            model = json.loads(chunk)
        except json.JSONDecodeError:
            continue
        value = model.get("intelligenceIndex")
        name = model.get("slug") or model.get("name") or ""
        if not name or name in seen or not isinstance(value, (int, float)):
            continue
        seen.add(name)
        # Same internal shape as entries_from_api(), so matching has one input format.
        out.append({
            "slug": model.get("slug") or "",
            "name": model.get("name") or "",
            "shortName": model.get("shortName") or "",
            "creator": "",
            FIELD: value,
        })
    return out


def normalise(name: str) -> str:
    """'GLM-5.3-Flash' and 'z-ai/ glm 5.3 flash' both → 'glm53flash'."""
    ascii_name = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", ascii_name.lower())


def match(entries: list[dict], openrouter_ids: list[str]) -> dict[str, float]:
    """Artificial Analysis entries → {openrouter id: intelligence index}.

    Exact normalised name only: a fuzzy match on a leaderboard would be a guess, and a
    wrong index is worse than a missing one. Both the slug and the display name are
    tried, because AA writes one as 'glm-5-3-flash' and the other as 'GLM 5.3 Flash'.
    """
    by_name: dict[str, list[str]] = {}
    for model_id in openrouter_ids:
        by_name.setdefault(normalise(model_id.split("/")[-1]), []).append(model_id)
        by_name.setdefault(normalise(model_id), []).append(model_id)
    matches: dict[str, float] = {}
    for entry in entries:
        value = entry.get(FIELD)
        if not isinstance(value, (int, float)):
            continue
        keys = {normalise(entry.get("slug") or ""), normalise(entry.get("name") or ""),
                normalise(entry.get("shortName") or "")}
        creator = entry.get("creator") or ""
        if creator:
            # 'z-ai' + 'glm-5-3-flash' → the same key as the OpenRouter id.
            keys.add(normalise(f"{creator}/{entry.get('slug') or ''}"))
        keys.discard("")
        for key in keys:
            for model_id in by_name.get(key, []):
                matches.setdefault(model_id, round(float(value), 2))
    return matches


# ---- merging -------------------------------------------------------------------------

def merge(benchmarks: dict, matches: dict[str, float], source_url: str = PAGE_URL):
    """Add the harvested values, never overwriting one that is already there.

    Returns (updated, added, kept) where `kept` are the ids that already had a value.
    """
    models = benchmarks.setdefault("models", {})
    added, kept = [], []
    for model_id, value in sorted(matches.items()):
        entry = models.setdefault(model_id, {})
        if isinstance(entry.get(FIELD), (int, float)):
            kept.append(model_id)
            continue
        entry[FIELD] = value
        added.append(model_id)
    benchmarks["_sources"] = {**(benchmarks.get("_sources") or {}),
                              FIELD: f"{source_url} — public leaderboard (page payload)"}
    benchmarks["_last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return benchmarks, added, kept


def openrouter_catalogue(store: Path) -> tuple[list[str], set[str]]:
    """(all ids, ids OpenRouter already relays an intelligence index for).

    The second set matters: writing a harvested value for those would shadow the live
    relay with a snapshot, and turn its source from "openrouter" into "manual" — a
    regression, even when the numbers agree today.
    """
    cache = store / "_openrouter_cache.json"
    data = json.loads(cache.read_text()).get("data") if cache.exists() else None
    if not data:
        data = json.loads(fetch(OPENROUTER_URL)).get("data") or []
    ids = [m["id"] for m in data if m.get("id")]
    relayed = {m["id"] for m in data
               if isinstance(((m.get("benchmarks") or {}).get("artificial_analysis") or {})
                             .get("intelligence_index"), (int, float))}
    return ids, relayed


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Harvest the Artificial Analysis intelligence index.")
    parser.add_argument("--store", type=Path,
                        default=Path.home() / ".hermes" / "plugin-data" / "model-leaderboard",
                        help="plugin data directory (holds benchmarks.json and the OpenRouter cache)")
    parser.add_argument("--write", action="store_true", help="update benchmarks.json")
    parser.add_argument("--dry-run", action="store_true",
                        help="show what would change and write nothing (the default)")
    parser.add_argument("--url", default=PAGE_URL, help="page to read when no API key is set")
    parser.add_argument("--api-key", default=os.environ.get("ARTIFICIAL_ANALYSIS_API_KEY"),
                        help="free AA API key (default: $ARTIFICIAL_ANALYSIS_API_KEY); "
                             "without one, the public page is parsed instead")
    args = parser.parse_args(argv)

    if args.api_key:
        entries = entries_from_api(json.loads(fetch(API_URL, headers={"x-api-key": args.api_key})))
        source = API_URL
    else:
        print("no AA API key: falling back to the public page (brittle, please prefer the "
              "free key — attribution to artificialanalysis.ai is required either way)",
              file=sys.stderr)
        entries = extract_models(fetch(args.url))
        source = args.url
    if not entries:
        print(f"no model found from {source} — layout/API changed or key rejected", file=sys.stderr)
        return 2

    ids, relayed = openrouter_catalogue(args.store)
    matches = {k: v for k, v in match(entries, ids).items() if k not in relayed}
    if relayed:
        print(f"{len(relayed)} models already relayed by OpenRouter are left alone")
    benchmarks_file = args.store / "benchmarks.json"
    benchmarks = json.loads(benchmarks_file.read_text()) if benchmarks_file.exists() else {}
    benchmarks, added, kept = merge(benchmarks, matches, source_url=source)

    print(f"{len(entries)} models on the page, {len(matches)} matched to OpenRouter, "
          f"{len(added)} to add, {len(kept)} already known")
    for model_id in added[:20]:
        print(f"  + {model_id:<36} {matches[model_id]}")
    if len(added) > 20:
        print(f"  … and {len(added) - 20} more")

    if not args.write or args.dry_run:
        print("dry run — nothing written (use --write)")
        return 0
    args.store.mkdir(parents=True, exist_ok=True)
    benchmarks_file.write_text(json.dumps(benchmarks, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {benchmarks_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
