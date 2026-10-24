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

`sha` is the `v1.2.0` release commit. Re-pin from 404e0926 (v1.1.0) to the v1.2.0 commit: the three blocking findings and both recommendations from the review are addressed — details in the comment below.

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

- `plugin-catalog/model-leaderboard.yaml` (+37/-0): new catalog entry,
  exact-SHA pin at `516e2f8d4dd0790f2c486d1fe0b444de5c2b3c10`, `version: "1.2.0"`, image and screenshots
  pinned to that same commit.

## How to Test

Both catalog CI jobs, reproduced locally before opening:

```bash
# structural
python3 scripts/validate_plugin_catalog.py plugin-catalog/

# pinned-source — the CI validates a CLONE at the pinned sha, without an install
git worktree add --detach /tmp/model-leaderboard-pin 516e2f8d4dd0790f2c486d1fe0b444de5c2b3c10
(cd /tmp/model-leaderboard-pin && hermes plugins validate .)
git worktree remove /tmp/model-leaderboard-pin --force
```

Result:

- **structural — green.** `python3 scripts/validate_plugin_catalog.py plugin-catalog/`
  → `OK: 802 file(s) valid`.
- **pinned-source — green, and now CLEAN** (no findings at all, the private-import
  warning included):

```
✓ desktop surface — stays inside the plugin SDK surface
Validation passed.
```

The delta from `404e0926` is the three blocking fixes and the two recommendations; the
entry's disclosure now names the OpenRouter and Hugging Face calls and the profile
config reads.

## Checklist

- [x] I've read the [Contributing Guide](https://github.com/NousResearch/hermes-agent/blob/main/CONTRIBUTING.md)
- [x] My commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [x] I searched for [existing PRs](https://github.com/NousResearch/hermes-agent/pulls) to make sure this isn't a duplicate
- [x] My PR contains **only** changes related to this fix/feature (one catalog file, no code)
- [x] The pinned sha is reachable on the commits API
- [x] `image` / `screenshots` are on GitHub hosts and pinned to the entry's sha
- [x] `capabilities:` matches what the plugin registers at that commit (one read-only skill; no tools, hooks, middleware or required env)

## Screenshots

![catalogue card](https://raw.githubusercontent.com/e-is/hermes-model-leaderboard/516e2f8d4dd0790f2c486d1fe0b444de5c2b3c10/assets/card-podium.png)
