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

* `swebench_verified` — % of resolved issues on SWE-bench Verified (0–100).
* `livecodebench` — % pass@1 on LiveCodeBench (0–100), or `null` when unmeasured.
* `null` is meaningful: it means "not published for this model". Never invent a
  value, never carry another model's score over — a wrong number silently
  distorts every ranking that uses it.

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
