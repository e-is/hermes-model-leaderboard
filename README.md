# Hermes Model Leaderboard

> 🚧 **SKELETON — porting in progress.** Reference implementation (to port):
> `sumaris-agent/docker/llm-dashboard` — live at `http://localhost:3004/`.

A **LLM comparison dashboard** plugin for [Hermes Desktop](https://hermes-agent.nousresearch.com): compare, score and track LLM models — prices, benchmarks, OpenRouter news and API consumption — as a full-page `/model-leaderboard` route.

## Features (from the reference app)

- 📊 **Model comparison** — context window, input/output/cache prices, Artificial Analysis indices (intelligence, coding, agentic), vision/tools support, open-weights, local VRAM estimate.
- ⭐ **Per-profile scoring** — team roles (Architect, Senior Coder, Junior Coder, Manager, QA… or custom) with 0–5 weights on 12 criteria, sliders + instant re-ranking, and an adaptive **radar** chart.
- 🔐 **Persisted profiles** — backend-side when authenticated, localStorage when anonymous, reset to defaults.
- 📰 **OpenRouter news** — collapsible side panel: promotions, price changes (🔻/🔺), new models with automatic **challenger 🔥 Top 3** detection for your profile.
- 📈 **Consumption & costs** — remaining credits, daily stacked histograms ($ and tokens) with day totals on hover, period + API-key filters.
- 🛡️ **Resilience** — 5 min cache, 10 s anti-spam cooldown, stale-on-error fallback on OpenRouter 429s.

## Porting plan (sumaris-app → unified Hermes plugin)

| Reference (docker/hermes-model-leaderboard) | Target (this repo) |
|:---|:---|
| `backend/main.py` (FastAPI, :3004, `/api/*`) | `dashboard/plugin_api.py` — FastAPI **router** mounted at `/api/plugins/hermes-model-leaderboard/` |
| `backend/data/*.json` | `dashboard/data/` (shipped data files) |
| `frontend/src/App.tsx` + components (React 18, Recharts) | `src/` (TSX, esbuild → `desktop/plugin.js`), Recharts bundled |
| `frontend/src/hooks/useResizable.ts` | `src/hooks/` |
| Docker compose, ports 3001/3004 | none — the desktop's `hermes serve` mounts the backend |

Follows the same unified-plugin conventions as [hermes-kanban-gantt](https://github.com/e-is/hermes-kanban-gantt):
`plugin.yaml` + `__init__.py` (capability probe) + `dashboard/` (backend,
`/api/plugins/hermes-model-leaderboard/`) + `desktop/plugin.js` (renderer, loaded
uncompiled) — authored in `src/` (TSX) and bundled with esbuild.

## Layout

```
plugin.yaml          unified plugin manifest
__init__.py          no-op register() (capability probe only)
dashboard/           backend — FastAPI router → /api/plugins/hermes-model-leaderboard/
  manifest.json      name/label/version/api pointer
desktop/             BUILD ARTIFACT — renderer loaded uncompiled
src/                 TSX authoring sources (esbuild → desktop/plugin.js)
tests/               pytest backend suite + UI smoke tests
assets/              screenshots from the reference app
```

## Reference screenshots

| Models & radar | Profile config | Consumption |
|:---:|:---:|:---:|
| ![models](https://raw.githubusercontent.com/e-is/hermes-hermes-model-leaderboard/main/assets/screenshot-models.png) | ![profile](https://raw.githubusercontent.com/e-is/hermes-hermes-model-leaderboard/main/assets/screenshot-profile-config.png) | ![consumption](https://raw.githubusercontent.com/e-is/hermes-hermes-model-leaderboard/main/assets/screenshot-consumption.png) |

## License

TBD (same as the reference implementation).
