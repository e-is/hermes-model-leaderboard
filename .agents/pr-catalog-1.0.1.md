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

`sha` is the `v1.0.1` release commit. 

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
  exact-SHA pin at `f9646f9a7d5294a1231fe3e7852d543ee349ca32`, `version: "1.0.1"`, image and screenshots
  pinned to that same commit.

## How to Test

Both catalog CI jobs, reproduced locally before opening:

```bash
# structural
python3 scripts/validate_plugin_catalog.py plugin-catalog/

# pinned-source — the CI validates a CLONE at the pinned sha, without an install
git worktree add --detach /tmp/model-leaderboard-pin f9646f9a7d5294a1231fe3e7852d543ee349ca32
(cd /tmp/model-leaderboard-pin && hermes plugins validate .)
git worktree remove /tmp/model-leaderboard-pin --force
```

Result:

- **structural — green.** `python3 scripts/validate_plugin_catalog.py plugin-catalog/`
  → `OK: 1 file(s) valid` (the new entry is the only file changed).
- **pinned-source — FAILS on the pinned commit, and this PR is therefore HELD.** The
  clone at `f9646f9` validates as:

```
✓ requires_env · ✓ loadable (__init__.py, desktop/plugin.js) · ✓ capability probe
✓ declared tools/hooks/middleware · ✓ security scan · ✓ no core override
✗ desktop surface — prototype patching (50 hits in desktop/plugin.js)
⚠ private core imports — dashboard/plugin_api.py:45 + :804 hermes_cli.profiles,
                        scripts/card.py:351 hermes_cli.browser_runtime.chromium_executable
Validation failed.
```

Both findings are plugin-side, not catalog-side, and each has a known fix on the plugin's
own main:

- the 50 prototype hits are not this plugin's code: they are the internals of the
  bundled charting stack (`Recharts → d3 → lodash`), e.g.
  `Hash.prototype.clear = hashClear;` and `FormatSpecifier.prototype.toString = …`. The
  desktop artifact is rebuilt from sources that already plan to drop Recharts for
  hand-drawn SVG views, which removes the chain from the bundle entirely.
- the two private-core imports reach `hermes_cli.profiles` (the installed-profile list
  behind the "Applies to" chips) and `hermes_cli.browser_runtime` (Chromium lookup in the
  capture tooling). They should go through a public surface instead.

A fresh pin will be generated with
`python3 scripts/catalog.py --tag v<next> --write --pr-body` once that lands, and this PR
updated rather than opened as-is.

## Checklist

- [x] I've read the [Contributing Guide](https://github.com/NousResearch/hermes-agent/blob/main/CONTRIBUTING.md)
- [x] My commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [x] I searched for [existing PRs](https://github.com/NousResearch/hermes-agent/pulls) to make sure this isn't a duplicate
- [x] My PR contains **only** changes related to this fix/feature (one catalog file, no code)
- [x] The pinned sha is reachable on the commits API
- [x] `image` / `screenshots` are on GitHub hosts and pinned to the entry's sha
- [x] `capabilities:` matches what the plugin registers at that commit (one read-only skill; no tools, hooks, middleware or required env)

## Screenshots

![catalogue card](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/f9646f9a7d5294a1231fe3e7852d543ee349ca32/assets/card-podium.png)
