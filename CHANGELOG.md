# Changelog

All notable changes to this plugin are documented here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org/spec/v2.0.0.html).

## [1.0.1] — 2026-10-19

Documentation, screenshots and release tooling. Nothing in the plugin's behaviour changes
between 1.0.0 and this release.

### Added

- `scripts/shots.py` — drives the real desktop over CDP and regenerates every README
  screenshot, the navigation GIF and the MP4 in one run. It clips each capture to the
  plugin's own pane (the sidebar holds private sessions), creates throwaway Hermes
  profiles so the per-profile scoring is visible, edits the criteria dialog and
  photographs the ranking it produces, then puts everything back.
- `scripts/card.py` — the catalogue card: a 2:1 PNG drawn in HTML/CSS (plus inline SVG
  for the Pareto picture) and rasterised with the Chromium Hermes already ships. Four
  variants, `--all` renders each one and a comparison page.
- `scripts/catalog.py` — generates and validates `plugin-catalog/model-leaderboard.yaml`
  from `plugin.yaml`, the git remote and the released commit: exact 40-hex sha, version
  quoting, 2:1 banner, up-to-6 screenshots pinned to that sha, PyYAML *and* ruamel
  round-trips, and the catalog's own validator when a hermes-agent checkout is around.

### Changed

- README: thirteen screenshots and an animated scenario, all re-captured; the per-profile
  story (chips, criteria, the re-ranked table) is now shown rather than described.

### Fixed

- The criteria dialog in the capture run was never closed — Escape is not wired in it —
  so the overlay covered the whole scenario and the animation showed nothing.
- The screencast captured zero frames: CDP screencast frames are events, and the
  read-on-call client never saw them while it slept between actions.

## [1.0.0] — 2026-10-16

First stable release: the `docker/llm-dashboard` web app (FastAPI + React on :3004)
is now a single-install Hermes plugin — a FastAPI router mounted at
`/api/plugins/model-leaderboard/` plus a Desktop renderer at `/model-leaderboard`.

### Added

- **Model comparison** — context window, input/output/cache prices, Artificial
  Analysis indices, curated SWE-bench Verified / LiveCodeBench columns, vision and
  tool support, open-weights, local VRAM estimate, model size.
- **Per-profile scoring** — one chip per installed Hermes profile (`default`
  included), 0–5 weights per criterion, instant re-ranking, top-5 cards, radar, and
  selectable score views (quality / cost with a Pareto frontier) that explain each
  model's rank; every criterion value is shown with its provenance.
- **OpenRouter news** — promotions (with end dates), rolling 1 d / 7 d price
  changes with a configurable threshold, and new models (sort by date or score).
- **Search** — live filter over the tracked table plus untracked models looked up on
  OpenRouter, with a one-click add and an opt-out checkbox.
- **Auto-fill** — proposes weights for a profile through the host LLM facade
  (`ctx.llm.complete_structured`), JSON-schema-validated. Never automatic.
- **Shipped skill** — `skill_view('model-leaderboard:refresh-benchmarks')`, a
  read-only procedure for refreshing the hand-curated benchmark indices from the
  public leaderboards (no API publishes them per model).
- **First-run seeding** from the main model each installed profile declares, then
  persisted; delete `dashboard/data/models.json` to re-seed.
- **Resilience** — 5 min OpenRouter cache with stale-on-error fallback, a real
  cache-bypassing refresh, and a visibility-gated auto-pull (60 s local poll, 10 min
  refetch, only while the page is visible).
- **Native desktop UX** — deletions confirmed with the desktop's shared
  `ConfirmDialog`, full en/fr i18n, styling from the app's CSS variables.

### Changed

- Backend-only profile persistence; no auth plumbing (the desktop supplies identity).
- Profile weights are no longer seeded from a hard-coded "architect" profile: a
  profile with no saved criteria starts from intelligence 5 / price 3, rest 0.

### Removed

- The multilingual criterion and its columns (no automatable source: OpenRouter
  exposes no language field, Hugging Face metadata is empty for the tracked
  open-weights models, and LMArena no longer publishes per-language boards).
- The Aider column (stale source) and the redundant `tools + vision` composite
  criterion (both capabilities are already rated individually).

### Fixed

- **Plugin name alignment** — `plugin.yaml`, `dashboard/manifest.json` and the
  renderer's plugin id must all be `model-leaderboard`. A mismatch sent every API
  call to a namespace that did not exist (`404 Plugin not found`) and left the table
  empty while the backend was serving data all along.
- Double-prefixed API paths (405 on saving criteria), double-encoded request bodies
  (422 when adding a model) — the desktop bridge serializes bodies itself, so callers
  must pass a plain object.
- Refresh no longer blanks the page; load errors are surfaced instead of swallowed.
- Saving the criteria of a never-saved profile 404'd.
- Install-time scanner false positives neutralized in the build (a bundled
  prop-types secret string, a zero-width joiner in an icon).
