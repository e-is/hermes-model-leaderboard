# Hermes Model Leaderboard

A **LLM comparison dashboard** plugin for [Hermes Desktop](https://hermes-agent.nousresearch.com): compare, score and rank LLM models as a full-page `/model-leaderboard` route — prices, benchmarks and OpenRouter news, no configuration needed.

Ported from the reference app `sumaris-agent/docker/llm-dashboard` (live at `http://localhost:3004/`), **first tab only**: authentication, dark-mode toggle and the consumption tab are intentionally out of scope — Hermes Desktop already provides the identity (the plugin runs inside the authenticated desktop context) and the theme (via the standard CSS variables).

## Features

- 📊 **Model comparison** — context window, input/output/cache prices, Artificial Analysis indices (intelligence, coding, agentic, SWE, aider), vision/tools support, open-weights, local VRAM estimate.
- ⭐ **Per-profile scoring** — roles (Architecte, Senior/Junior Coder, Manager, QA… or custom) with 0–5 weights on 12 criteria and instant re-ranking + top-5 cards.
- 📰 **OpenRouter news** — side panel: promotions, price changes (🔻/🔺), new models.
- 🛡️ **Resilience** — 5 min cache, 10 s anti-spam cooldown, stale-on-error fallback on OpenRouter 429s.
- 🔑 **No auth plumbing** — profiles always persist backend-side; the desktop supplies identity.

## Architecture (unified Hermes plugin)

Same conventions as [hermes-kanban-gantt](https://github.com/e-is/hermes-kanban-gantt):

| Reference (docker/llm-dashboard) | This repo |
|:---|:---|
| `backend/main.py` (FastAPI :3004, `/api/*`) | `dashboard/plugin_api.py` — FastAPI **router** mounted at `/api/plugins/hermes-model-leaderboard/` |
| `backend/data/*.json` | `dashboard/data/` (shipped data files) |
| `frontend/src/App.tsx` + components (React 18, Recharts) | `src/` (TSX) → esbuild → `desktop/plugin.js` (artifact committed, SDK/react external, Recharts bundled) |

```
plugin.yaml          unified plugin manifest
__init__.py          no-op register() (capability probe only)
dashboard/           backend — FastAPI router → /api/plugins/hermes-model-leaderboard/
  manifest.json      name/label/version/api pointer
  data/              models, benchmarks, languages, price history
desktop/             BUILD ARTIFACT — renderer loaded uncompiled
src/                 TSX authoring sources (esbuild → desktop/plugin.js)
  core/scoring.ts    pure scoring helpers (unit-tested)
  components/        NewsPanel
  hooks/             useResizable
tests/               pytest backend suite + node unit tests (scoring)
assets/              screenshots
```

## Build & test

```bash
npm install
npm run build                                      # src/ → desktop/plugin.js
node --experimental-strip-types --test tests/unit/ # scoring unit tests
pytest tests/test_backend.py -q                    # backend (11 tests)
```

Deployment: copy the package to `~/.hermes/plugins/hermes-model-leaderboard/` and enable it in `plugins.enabled` (config.yaml) — the desktop lifts `desktop/` at next boot. The desktop half is opt-in: toggle it in **Capabilities → Plugins** (or seed `hermes.desktop.pluginDecisions.v2`).

## TODO / roadmap

- [ ] **Dynamic profile list** — seed profiles from the Hermes installed profiles (bots) instead of the static defaults.
- [ ] **Default weights for new profiles** — all criteria 0 except `intelligence: 5` and price at mid (3).
- [ ] **"Remplissage auto" button** — one click asks the Hermes default model (via the gateway) to propose sensible weights for the selected profile, based on its SOUL.md / skills / role. Never automatic — always user-triggered.
- [ ] **Recharts v3** (2.x is EOL) or native canvas — see the plugin plan note on bundle weight.
- [ ] Consumption tab → separate plugin ([llm-plugin-plan](../sumaris-agent/data/plans/llm-plugin-plan.md)): usage tracking with credits + analytics.

## Reference screenshots

| Models & radar | Profile config |
|:---:|:---:|
| ![models](assets/screenshot-models.png) | ![profile](assets/screenshot-profile-config.png) |

## License

GPL-3.0 — see [LICENSE](LICENSE).
