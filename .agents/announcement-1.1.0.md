# Which model should *this* profile use? Meet `model-leaderboard` 🏆

**TL;DR** — a Hermes Desktop plugin that ranks every OpenRouter model **for your agent
profiles**, using *your* priorities, not a generic average. One page, six views, a Pareto
frontier, and a news feed for price drops. No API keys, no accounts, nothing leaves your
machine except the public model list it fetches.

```
hermes plugins install e-is/hermes-model-leaderboard
```

*(catalog listing is in review — [PR #144037](https://github.com/NousResearch/hermes-agent/pull/144037) — so use the `owner/repo` form above for now)*

---

## The pain, as I lived it

I don't run *one* agent. I run several profiles: a front-end designer, a reviewer, a backend
worker, a cheap bulk-text grunt. They want different models, and every leaderboard I opened
answered a different question:

- "which model is smartest on average?" — but my reviewer doesn't need to write React, it
  needs to hold a 200k-token diff in its head;
- "which model is cheapest?" — but the cheapest one might be the reason my designer keeps
  returning hallucinated CSS;
- "state of the art for coding" — at 30× the price of the model that was *good enough* for
  the job, and the honest answer is that nobody can tell the difference in the output.

So the ritual was: Artificial Analysis open in one tab, OpenRouter pricing in another,
SWE-bench Verified and LiveCodeBench in two more, then squint at four tables, pick a name I
recognised, and hope. The data was all there. The missing piece was somewhere that **my
priorities decide the ranking, per profile**.

That's the whole idea of this plugin.

## What it does

- **Per-profile scoring.** The chip row is your installed Hermes profiles. Each one keeps its
  own criteria weights (0–5) over ten things that actually differ between models:
  intelligence, coding, agentic/tool use, price in / out / cached, context window, native
  tool calling, vision, open weights. Pick "reviewer" and the same 23 models re-rank
  themselves for a reviewer's job.
- **Six ways to look at the answer** — cards, a sortable table, score bars, histograms, a
  heatmap (click a grade to see where the number came from), and quality vs cost.
- **The Pareto frontier**, which is the view I use most: the models nothing is both cheaper
  *and* better than. If a model isn't on that line, something else beats it on price or on
  quality — and now you can see which.
- **Add any model.** The tracked list is whatever you want: search OpenRouter, add it, it
  appears with prices, context, and the published indices.
- **News panel** — newly added models, price changes, and current promotions, so you notice
  when your daily driver drops 75 %.
- **Auto-fill criteria.** Hit the button and it asks the host LLM (`ctx.llm`, your configured
  model) to propose weights for a profile from its name. I used it to bootstrap "front-end
  designer" and then nudged the sliders.
- **No API key, no signup, no telemetry.** It reads OpenRouter's public model list, caches it
  locally, and stores your profiles and criteria in its own data directory.

## Screenshots

All of these are pinned to the `v1.1.0` release commit, so they show exactly what you install.

![catalogue card](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/card-podium.png)

| Tracked models | Score bars |
|:---:|:---:|
| ![tracked models](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-01-models.png) | ![score bars](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-03-score-bars.png) |
| **Histograms** (grade × weight) | **Heatmap** (grades 0–100, provenance on click) |
| ![histograms](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-04-histograms.png) | ![heatmap](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-05-heatmap.png) |
| **Quality / cost** (the Pareto frontier) | **The table** (every tracked model) |
| ![quality vs cost](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-06-quality-cost.png) | ![table](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-02-models-table.png) |
| **Criteria for one profile** | **…and the same models, re-weighted** |
| ![criteria](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-08-criteria.png) | ![criteria edited](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-09-criteria-edited.png) |

**Scoring is per profile** — here the same models are ranked for two different jobs. Move a
slider and the page re-ranks live:

| Front-end designer (coding 5, vision 5) | Reviewer (intelligence 5, context 5) |
|:---:|:---:|
| ![front-designer](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-11-profile-front-designer.png) | ![reviewer](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/screenshot-en-12-profile-reviewer.png) |

And the whole scenario, including the criteria dialog being edited and applied:

![navigation scenario](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/animations/model-leaderboard.gif)

## Install

```bash
# while the catalog entry is in review (PR #144037)
hermes plugins install e-is/hermes-model-leaderboard

# once it is listed
hermes plugins install model-leaderboard
```

Then open **Model Leaderboard** from the Desktop sidebar. First load pulls the public model
list; after that it refreshes on its own while the page is open.

## Links

- Repo: <https://github.com/e-is/hermes-model-leaderboard> (GPL-3.0)
- Release: <https://github.com/e-is/hermes-model-leaderboard/releases/tag/v1.1.0>
- Catalog PR (awaiting review): <https://github.com/NousResearch/hermes-agent/pull/144037>
- Issues and ideas are welcome on the repo — including "these weights are wrong for a
  reviewer", which is a perfectly good bug report.

## Honest limits

- **It does not benchmark anything itself.** It curates published indices (SWE-bench
  Verified, LiveCodeBench, Artificial Analysis) next to live OpenRouter prices. If the
  published numbers are off for your workload, the ranking inherits that.
- **The weights are judgement, not science.** They encode what *you* say matters. That is the
  point — but a 5 means "important to me", not "measurably better".
- **Prices move.** The news panel exists precisely because they do.
- **Auto-fill spends your tokens** — it runs on your configured host model, once, when you
  press the button.
- Ported from the `llm-dashboard` web app we ran internally; the catalogue card follows
  the approach used by [hermes-kanban-gantt](https://github.com/e-is/hermes-kanban-gantt),
  and the charts are hand-drawn SVG — the plugin ships no runtime dependency at all.

If you try it: the thing I'd most like to hear is **which profiles you made and what you set
the weights to**.
