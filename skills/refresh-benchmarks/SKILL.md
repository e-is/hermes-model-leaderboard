---
name: refresh-benchmarks
description: Refresh the curated benchmark indices (SWE-bench Verified, LiveCodeBench) of the tracked models in the Model Leaderboard plugin by reading the public leaderboards.
---

# Refresh the Model Leaderboard benchmark indices

The Model Leaderboard plugin ranks the LLMs a Hermes install can reach. Two of
its columns — **SWE-bench Verified** and **LiveCodeBench** — are *not* available
from any API: no vendor publishes them per model, so they live in a hand-curated
file that goes stale. Your job is to refresh those numbers from the public
leaderboards.

## Where the data lives

```
<plugin dir>/dashboard/data/benchmarks.json
```

Shape (one entry per model, keyed by the OpenRouter model id):

```json
{
  "_description": "...", "_sources": { ... }, "_last_updated": "YYYY-MM-DD",
  "models": {
    "anthropic/claude-sonnet-4.5": { "swebench_verified": 72.7, "livecodebench": null }
  }
}
```

* `speed_tps` — output tokens per second, measured by Artificial Analysis.
* `latency_s` — seconds before the first token, measured by Artificial Analysis.
* `swebench_verified` — % of resolved issues on SWE-bench Verified (0–100).
* `livecodebench` — % pass@1 on LiveCodeBench (0–100), or `null` when unmeasured.
* `null` is meaningful: it means "not published for this model". Never invent a
  value, never carry another model's score over — a wrong number silently
  distorts every ranking that uses it.

## Filling missing Artificial Analysis indices

`intelligence_index`, `coding_index` and `agentic_index` normally come from
OpenRouter (which relays Artificial Analysis). When OpenRouter has none, the
plugin *estimates* them from the model's other indices and shows them as
`~62` — an estimate is better than a 0, but a measured value is better still.
The same `benchmarks.json` entry takes these fields too, and a value written
there overrides both OpenRouter and the estimate:

```json
"poolside/laguna-s-2.1": { "intelligence_index": 31.2, "coding_index": null }
```

Take them from <https://artificialanalysis.ai/models> (same scale as
OpenRouter's: the Intelligence / Coding / Agentic Index of the model page).
Send `"value": null` to remove an override. A model the leaderboard shows as
`n/a` on every index has nothing to estimate from: those are the priority.

## Performance (speed, latency)

`scripts/harvest_aa.py --write` fills `speed_tps` and `latency_s` in the same run as the
intelligence index. It reads the **data API** when a key is configured —
`GET /api/v2/language/models/free` with `x-api-key`, free tier, 100 requests per 24 h, 4 pages
for 766 models, `performance.median_output_tokens_per_second` and
`median_time_to_first_token_seconds` — and falls back to the public page when there is none.
Note the paths: `/api/v2/data/llms/models` is `410 Gone` (v1), `/api/v2/language/models` is Pro
and answers `403` on a free key, and `/api/v2/language/models/free` is the one that works.

Two rules matter:

* the qualifier in a model's name — `(Low)`, `(Max)`, `(Non-reasoning)` — is a reasoning
  **budget**, not a different model, so matching strips it and the two figures are the median
  across the budgets AA publishes;
* the values are **not** committed: AA's data is non-redistributable, so the harvest writes to
  the user's `plugin-data/model-leaderboard/benchmarks.json`, never to `dashboard/data/`.

Only a model with no measurement shows `–` in the table, and its criterion counts as n/a.

## Procedure

1. **List the tracked models** — read `dashboard/data/models.json` (the `id`
   fields) or `GET /api/plugins/model-leaderboard/models`. Refresh only ids that
   are already tracked; the plugin does not score models it does not track.
2. **Collect the scores from the sources named in `_sources`:**
   - SWE-bench Verified: <https://www.swebench.com/> (leaderboard table).
   - LiveCodeBench: <https://livecodebench.github.io/leaderboard.html>.
   Beware of vendor-reported variants: only take the *Verified* subset for
   SWE-bench, and the version the leaderboard labels as such. Reasoning/"thinking"
   modes are usually listed separately from the base model — record the variant
   the tracked id corresponds to, and say so in your summary.
3. **Write the values back**, one field at a time:

   ```
   POST /api/plugins/model-leaderboard/benchmarks
   {"model_id": "anthropic/claude-sonnet-4.5", "field": "swebench_verified", "value": 72.7}
   ```

   The endpoint merges into the existing entry (other fields are preserved) and
   rewrites the file. With no reachable gateway, edit `benchmarks.json` directly
   — the backend re-reads the file on every request, so a plain save is enough:
   keep the surrounding `_description` / `_sources` / `models` keys intact, and
   the file valid JSON.
4. **Stamp the refresh** — set `_last_updated` to today's date (the backend does
   not do it for you). This date is what tells a reader how stale the table is.
5. **Verify** — re-read the file (or `GET /api/plugins/model-leaderboard/benchmarks`)
   and confirm the values landed; the desktop page shows them in the
   "SWE-bench Verified" / "LiveCodeBench" columns after a refresh.

## Reporting

State, per model: the score you wrote, the source you took it from, and which
models you left at `null` because the leaderboard does not publish them. Never
report a value you did not actually read from a leaderboard — "not found" is a
valid, useful answer; a guess is not.
