## What does this PR do?

Lists the community plugin **model-leaderboard** in the desktop plugin catalog: a model leaderboard
for Hermes Desktop that ranks any OpenRouter model for a chosen Hermes profile. Full
`/model-leaderboard` page with per-profile criteria, six score views (cards, table, score bars,
histograms, heatmap, quality-vs-cost Pareto frontier), curated SWE-bench Verified /
LiveCodeBench indices, an OpenRouter news feed, and a documented REST surface under
`/api/plugins/model-leaderboard/`. No API keys of its own; the optional criteria auto-fill runs on
the host LLM facade and is spelled out in the entry's disclosure.

Repo: [GitHub - e-is/hermes-model-leaderboard](https://github.com/e-is/hermes-model-leaderboard) — unified plugin (Python backend straight from
`dashboard/`, ESM desktop renderer built and committed as `desktop/plugin.js`), GPL-3.0.

`sha` is the `v1.1.0` release commit. First listing: the entry pins the v1.1.0 release commit — the chart conversion that makes the desktop bundle pass the surface lint.

## Related Issue

N/A

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 🔒 Security fix (undisclosed vulnerabilities in [SECURITY.md](https://github.com/NousResearch/hermes-agent/blob/main/SECURITY.md) §3.1 scope go to [Security Advisories](https://github.com/NousResearch/hermes-agent/security/advisories/new) first, not a public PR)
- [x] 📝 Documentation update
- [ ] ✅ Tests (adding or improving test coverage)
- [ ] ♻️ Refactor (no behavior change)
- [ ] 🎯 New skill (bundled or hub)

## Changes Made

- `plugin-catalog/model-leaderboard.yaml` (+35/-0): new catalog entry,
  exact-SHA pin at `404e0926726d756570f0009753dfba9513d83d6e`, `version: "1.1.0"`, image and screenshots
  pinned to that same commit.

## How to Test

Both catalog CI jobs, reproduced locally before opening:

```bash
# structural
python3 scripts/validate_plugin_catalog.py plugin-catalog/

# pinned-source — the CI validates a CLONE at the pinned sha, without an install
git worktree add --detach /tmp/model-leaderboard-pin 404e0926726d756570f0009753dfba9513d83d6e
(cd /tmp/model-leaderboard-pin && hermes plugins validate .)
git worktree remove /tmp/model-leaderboard-pin --force
```

Result:

- **structural — green.** `python3 scripts/validate_plugin_catalog.py plugin-catalog/` on
  the whole directory → `OK: 802 file(s) valid` (the new entry is the only file this PR
  touches).
- **pinned-source — green.** In a detached worktree at the pinned sha, with no package
  install:

```
✓ manifest · ✓ manifest fields · ✓ requires_hermes · ✓ loadable (__init__.py, desktop/plugin.js)
✓ capability probe (register() ran in isolation) · ✓ declared tools/hooks/middleware
✓ security scan — safe · ✓ no core override
✓ desktop surface — stays inside the plugin SDK surface
Validation passed.
```

One warning remains, and it predates this pin:

```
⚠ private core imports (catalog rule 9: public surfaces only): dashboard/plugin_api.py:45
  and :810 hermes_cli.profiles; scripts/card.py:351 hermes_cli.browser_runtime.chromium_executable
```

Those two read the installed Hermes profiles (the "Applies to" chips) and locate a Chromium
for the capture tooling. They are on the list for a follow-up; say the word and I will
either route them through a public surface or drop them, in a re-pin PR of their own.

For reference, the previous pin could not pass this job: `desktop/plugin.js` carried a
bundled charting stack (Recharts → d3 → lodash, 1,072,563 bytes) whose library-internal
prototype assignments matched the surface lint's prototype-patching rule 50 times. The
charts are now drawn by hand in SVG, the bundle is 143,187 bytes and that check is clean.

## Checklist

- [x] I've read the [Contributing Guide](https://github.com/NousResearch/hermes-agent/blob/main/CONTRIBUTING.md)
- [x] My commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [x] I searched for [existing PRs](https://github.com/NousResearch/hermes-agent/pulls) to make sure this isn't a duplicate
- [x] My PR contains **only** changes related to this fix/feature (one catalog file, no code)
- [x] The pinned sha is reachable on the commits API
- [x] `image` / `screenshots` are on GitHub hosts and pinned to the entry's sha
- [x] `capabilities:` matches what the plugin registers at that commit (one read-only skill; no tools, hooks, middleware or required env)

## Screenshots

![catalogue card](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/404e0926726d756570f0009753dfba9513d83d6e/assets/card-podium.png)
