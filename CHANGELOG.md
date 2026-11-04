## [1.5.0] — 2026-11-04 — a variant without a published index still gets a grade

### Added

- **Inheritance** for the models OpenRouter publishes no index for (58 % of the catalogue:
  `~…-latest` aliases, `-flashx` / `-prime` / `-legal` variants). An exact alias — same input
  price, same context — gives the twin's values verbatim; otherwise the model borrows from a
  published member of its family, interpolated in log-price between two siblings and never
  extrapolated past them. Displayed as `27.8⤵` with a tooltip naming the source, in every
  locale.
- `scripts/harvest_aa.py`: optional harvester of the intelligence index from Artificial
  Analysis. Free Data API first (`ARTIFICIAL_ANALYSIS_API_KEY`), public leaderboard page as a
  no-key fallback; dry run by default; writes to the plugin's own benchmarks.json, never to
  the repository (their data is non-redistributable). 13 unit tests.

### Changed

- `measured()` excludes inherited values from the normalisation scale, as it already did for
  estimates: a borrowed index must not set the 100 % mark the others are graded against.
- The catalogue entry's disclosure names the inheritance and the optional harvester.

### Fixed

- Inheritance read only the catalogue's `pricing` (per token). A tracked record carries
  `prompt_price` (already $/M), so every tracked model looked free: aliases never matched
  and family lookups fell back to the cheapest sibling. Caught by running the resolver on
  the real store — `~z-ai/glm-flash-latest` now gets 27.8/71.5/50.9 from `glm-5.3-flash`
  instead of nothing.
- The harvester leaves alone the models OpenRouter already relays an index for: writing a
  snapshot over the live relay would turn its source from `openrouter` into `manual`.

### Notes

- Artificial Analysis no longer publishes Coding or Agentic indices (both documented as
  always null): the harvester fills intelligence only, the other two come from OpenRouter or
  inheritance.

## [1.4.0] — 2026-11-04 — the cost axis can be read linearly

### Added

- A **Log / Linear** switch on the quality/cost view's X axis (log by default), sitting next
  to the "best trade-offs" hint and remembered per viewer. Linear gets its own round ticks
  (1/2/5 × 10ⁿ): fed the 1-3-10 log ladder, a linear axis bunches most of its labels into the
  first few percent of the width.
- `src/core/axis.ts` — `positionOnAxis` (log and linear share one definition of where a
  value sits), `logTicks`, `linearTicks` — with 10 unit tests.

### Changed

- The axis label no longer says "log scale": the scale is now a choice, and the switch names
  it. Updated in all 17 locale bundles (the switch labels included).

## [1.3.5] — 2026-11-04 — one footer for every news card

### Changed

- A promotion's "Details" link sits on the right, immediately before Follow, as on the
  new-models cards: the two cards are the same object (a candidate with an action), so their
  footers should not put the same link in two different places.

## [1.3.4] — 2026-11-04 — a price change says what changed

### Changed

- Price-change rows date their entry like the new-models rows — the date alone. The
  "Date :" prefix was noise, and the only French left in that row.
- Hovering a change's percentage now shows the prices it was computed from
  (`Price in $1.25/M tk · Price out $2.50/M tk`, labels from the catalogue), with a dotted
  underline as the hint that there is something to hover. `/news` price changes now carry
  `prompt_price` / `completion_price` for it — a percentage alone never told the user what
  they would actually pay.
- The section's empty-state line is no longer hardcoded French; it uses the catalogue.

### Added

- `src/core/news.ts` (`priceChangePrices`) with 4 unit tests, and backend assertions that a
  price change reports the prices it was derived from.

## [1.3.3] — 2026-11-04 — following from the search results

### Changed

- A search hit is offered as **Follow**, like the news panel, not "Add": same action, and
  two names for it made the two lists look like two features.
- Following a hit no longer closes the results. Its row goes away on its own (the list only
  holds untracked models) and the other hits stay, so following two models is one search.
  The results close on the ✕ in their header — or by themselves when nothing is left.
- The results are a table with the tracked table's indicators (intelligence, coding,
  agentic, context, in/out price) and the profile's score, starred ⭐ when the hit would
  make the top 3 — the numbers it keeps once followed.

### Fixed

- `/openrouter/search` returned a thinner model shape than `/news`, so a search hit could
  not be scored or explain its score while the same model scored fine in the news panel.
  The three candidate lists (new models, promotions, search) now share `_candidate_fields()`.

### Added

- `src/core/candidates.ts` — `top3Threshold`, `scoreCandidates`, `untrackedOnly` — the pass
  the news panel, the promotions and the search results each rebuilt by hand, with 11 unit
  tests (`tests/unit/candidates.test.ts`), plus a backend test for the search hit's shape.

## [1.3.2] — 2026-11-04 — the ranking header acts like a control

### Changed

- Opening the scoring criteria is a filled primary button (the desktop's own `--theme-primary`),
  not an underlined link: it is the one control of the ranking header that changes the ranking.
- The score views are a segmented control — the same chrome as the desktop's `SegmentedControl`
  and the gantt plugin's toggle: a `--ui-bg-tertiary` track with the active option raised on
  `--ui-bg-editor`, so it follows the theme instead of inventing colours. Six pills with borders
  read as six separate buttons, which is not what a mutually-exclusive choice is.
- Model search is live: untracked models appear while you type (300 ms debounce, one request per
  burst, late answers dropped), the tracked table filters on the same debounced term, and the
  Search button and its "search untracked" checkbox are gone: what they asked the user to
  do, the debounce now does on its own.

### Fixed

- The curated promotions carried fixed end dates, so the section silently emptied (and
  `test_news_shape` failed) once the last one passed. Their window is now relative to the run.

# Changelog

All notable changes to this plugin are documented here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[SemVer](https://semver.org/spec/v2.0.0.html).

## [1.3.1] — 2026-10-30 — the French bundle stops reading like English

Twenty-three of the 182 keys in `fr` were byte-identical to `en`: not a parity
failure, so the test had nothing to say about them, and a French reader saw
`Coding`, `Tools`, `Heatmap`, `Score` and `Local VRAM ≤ 64GB` in an otherwise
French page. Ten of them are translated here — the title, the table's
`Coding`/`Agentic`/`Open`/`Tools`/`Score` columns, the heatmap view name, the
score label, the news sort chip and the local-VRAM criterion.

The thirteen that stay identical are correct as they are: `SWE`, `GPU`, `Intel.`,
`VRAM ≤ 64G`, `pts`, `vs`, `📅 Date`, and the four keys whose French word is the
English one — `Vision`, `Duel`, `Intelligence`.

## [1.3.0] — 2026-10-27 — the page speaks the 16 desktop languages

### Changed

- **The news API no longer ships finished sentences.** Promotions used to carry
  `details` / `discount_text` prose written in one language; they now carry the figures
  and a `code` (`limited_promo`, `price_with_context`, `price_with_params`, `video_rate`,
  `agentic_model`, `price`) plus `discount_pct` as a number. The renderer composes the
  sentence from its i18n catalogue, so a promotion reads in the UI's language — an
  unknown `code` still renders as a plain price line instead of leaking raw JSON.
- Criteria labels and descriptions, the display-name label/placeholder, the news button
  and the total-weights readout were still hardcoded in the renderer (some of it French):
  they now resolve through the catalogue, and `AVAILABLE_CRITERIA` keeps only key + icon.

### Added

- **Chinese (`zh`) bundle**, at parity with `en`/`fr` (the desktop bundles en, zh,
  zh-hant, ja, ar, ru, fr, de, es, so a bundle for any of those is selectable).
  The three catalogues are key-for-key identical.
- **i18n bundles for the 16 Hermes desktop locales** (af, ar, de, es, fr, ga, hu, it,
  ja, ko, pt, ru, tr, uk, zh, zh-hant), at key parity with the English bundle, plus a
  parity test (`tests/unit/i18n-parity.test.ts`) that fails on any missing/extra key,
  value-kind or function-arity drift, and on empty strings.

## [1.0.2] — 2026-10-19

Saving the criteria of a Hermes profile that had never been saved — the exact shape of
"Profile introuvable: architect" in the criteria dialog.

### Fixed

- Saving the criteria dialog of a Hermes profile the store does not hold yet (`architect`,
  `manager`, …) no longer fails when the gateway runs a plugin backend older than 1.0.1:
  the PUT answers 404 there, and the page now falls back to the create route instead of
  showing the error. The save is persisted either way.
- Deleting the criteria of such a profile treats the same 404 as "nothing stored" rather
  than as an error.
- The seeded architect profile is keyed `architect` (its display name stays "Architecte"),
  not `architecte`. The chips themselves come from the gateway's own profile list, so the
  old key was never shown — it was an orphan entry that could not score anything, and
  `architect` fell back to the generic weights. A store written under the old id is renamed
  on read, so weights entered then still apply.

## [1.1.0] — 2026-10-24

No visible change to the page: the charts are drawn by hand instead of by Recharts, and
saving a profile that was never saved no longer 404s.

### Changed

- `src/components/charts.tsx` — bars (vertical and horizontal), a radar and the
  quality/cost scatter with its log axis, sized by a `ResizeObserver` that replaces
  `ResponsiveContainer`. Plain SVG, theme tokens, no dependency.
- The desktop bundle drops from 1,072,563 to 143,187 bytes: Recharts, d3 and lodash are
  no longer in it, and `package.json` has no runtime dependency left.

### Fixed

- Saving the criteria of a profile the plugin had no entry for answered
  `404 Profil introuvable` instead of creating it (`PUT /profiles/<id>` now upserts).
- `plugin.yaml` and `dashboard/manifest.json` disagreed on the version (1.0.2 vs 1.0.1);
  both say 1.1.0 now.

### Removed

- the `recharts` dependency, whose bundled internals matched the plugin catalog's
  textual "prototype patching" rule (50 hits) and blocked the catalog submission.

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
