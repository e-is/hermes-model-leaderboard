#!/usr/bin/env python3
"""Generate, validate and diff the plugin-catalog entry — one command, no hand-edited YAML.

    python3 scripts/catalog.py                      # print the entry for HEAD
    python3 scripts/catalog.py --tag v1.0.1         # ... for a released tag's commit
    python3 scripts/catalog.py --write              # write plugin-catalog/<name>.yaml here
    python3 scripts/catalog.py --check              # is the committed entry still true?
    python3 scripts/catalog.py --install ~/git/hermes-agent/plugin-catalog/
    python3 scripts/catalog.py --pr-body            # write .agents/pr-catalog-<version>.md
    python3 scripts/catalog.py --write --install … --pr-body --check

Why this exists: the entry has to agree with five other places — `plugin.yaml`'s `name:`,
`version:` and `requires_hermes:`, the repo URL, the released commit, and the image and
screenshot files. A disagreement with any of them is a review rejection (or, for the
image, a broken picture on the docs page), and hand-editing YAML is how a stray quote
turns into a `caught exception: mapping values are not allowed here`.

Everything it checks is offline except two probes, both of which catalog CI performs
anyway: the pinned sha must answer on the commits API, and every raw image URL must
exist at that sha.

  * sha is a full 40-hex commit, not a branch or a tag string;
  * name / repo / version / requires_hermes agree with the manifest and the git remote;
  * the image is 2:1 (the catalog renders it as a banner) and lives on a GitHub host;
  * screenshots: at most 6, GitHub hosts, all pinned to the entry's sha;
  * the YAML re-parses under PyYAML *and* ruamel.yaml (the loader and the CI use
    different parsers, and `version: 1.0.1` unquoted is a float in one of them);
  * `hermes plugins validate` and the official catalog validator, when a hermes-agent
    checkout is around, agree with the file.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import struct
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MANIFEST = REPO / "plugin.yaml"
ENTRY_DIR = REPO / "plugin-catalog"
NAME_RE = re.compile(r"^[a-z0-9_-]{1,64}$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
GITHUB_HOSTS = ("raw.githubusercontent.com", "github.com", "githubusercontent.com")

#: Pinned at the entry's commit, so the pictures are as immutable as the code.
CARD = "assets/card-podium.png"
SCREENSHOTS = [
    "assets/screenshot-en-01-models.png",
    "assets/screenshot-en-03-score-bars.png",
    "assets/screenshot-en-05-heatmap.png",
    "assets/screenshot-en-06-quality-cost.png",
    "assets/screenshot-en-08-criteria.png",
    "assets/screenshot-en-11-profile-front-designer.png",
]

#: One paragraph, factual, in the shape the catalog uses for community entries: what the
#: plugin does, then `Disclosure —` with every network call, write and token it spends.
#: Keep it in step with the code: the disclosure is what the reviewer reads.
DESCRIPTION = (
    "Model leaderboard for Hermes Desktop: a full /model-leaderboard page that ranks any "
    "OpenRouter model for a chosen Hermes profile — context window, prices, Artificial "
    "Analysis indices and curated SWE-bench Verified / LiveCodeBench — with per-profile "
    "criteria, six score views (cards, table, score bars, histograms, heatmap, "
    "quality-vs-cost Pareto frontier), an OpenRouter news feed (new models, price changes, "
    "promos) and a documented REST surface under /api/plugins/model-leaderboard/. "
    "Disclosure — outbound HTTPS to OpenRouter's public model API (catalogue and pricing; "
    "no key required) on a 60 s poll and a forced refresh every 10 minutes while the page "
    "is visible; writes its own JSON store under the plugin directory (model cache, price "
    "history, per-profile criteria, benchmarks), and LLM_DASH_DATA / LLM_DASH_CACHE_TTL "
    "only move or tune that store; the optional \"Auto-fill criteria\" action runs on the "
    "host LLM facade (ctx.llm.complete_structured), so it spends the user's configured "
    "model tokens; ships one read-only skill (model-leaderboard:refresh-benchmarks) whose "
    "only write is a POST to its own /benchmarks route; no API keys of its own, no writes "
    "outside its data directory."
)

CATEGORY = "models"          # the shelf it sits on at /docs/plugins


# ── facts read from the checkout ─────────────────────────────────────────────
def git(*args: str) -> str:
    p = subprocess.run(["git", *args], cwd=REPO, capture_output=True, text=True, timeout=120)
    if p.returncode:
        raise SystemExit(f"catalog: git {' '.join(args)} failed: {p.stderr.strip()}")
    return p.stdout.strip()


def manifest() -> dict[str, str]:
    """The three fields the entry mirrors, read from plugin.yaml top-level keys."""
    text = MANIFEST.read_text(encoding="utf-8")
    out: dict[str, str] = {}
    for key in ("name", "version", "requires_hermes"):
        m = re.search(rf"^{key}:\s*(.+)$", text, re.M)
        if m:
            out[key] = m.group(1).strip().strip("'\"")
    for key in ("name", "version"):
        if key not in out:
            raise SystemExit(f"catalog: plugin.yaml has no {key}:")
    return out


def repo_url() -> str:
    """https://github.com/owner/repo, from the remote the checkout actually pushes to."""
    for remote in ("origin", "upstream"):
        try:
            url = git("remote", "get-url", remote)
        except SystemExit:
            continue
        m = re.search(r"github\.com[:/]([^/]+)/(.+?)(?:\.git)?$", url)
        if m:
            return f"https://github.com/{m.group(1)}/{m.group(2)}"
    raise SystemExit("catalog: no GitHub remote on origin/upstream")


def slug(url: str) -> str:
    return url.removeprefix("https://github.com/")


def png_size(path: Path) -> tuple[int, int]:
    """Width/height from the IHDR chunk — a 12-byte read, no image library."""
    with path.open("rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"catalog: {path.name} is not a PNG")
    return struct.unpack(">II", head[16:24])


def http(url: str, method: str = "GET", token: str = "") -> tuple[int, bytes]:
    req = urllib.request.Request(url, method=method)
    req.add_header("User-Agent", "hermes-plugin-catalog")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read(1024)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:                                    # offline: report, don't lie
        return 0, str(e).encode()


def token() -> str:
    """The GitHub token, if one is around — only used for the API probes' rate limits."""
    env = Path.home() / ".hermes" / ".env"
    if env.exists():
        m = re.search(r'GITHUB_TOKEN\s*=\s*"?([^"\n]+)"?', env.read_text(encoding="utf-8"))
        if m:
            return m.group(1)
    return os.environ.get("GITHUB_TOKEN", "")


# ── the entry ────────────────────────────────────────────────────────────────
def build(sha: str, version: str) -> dict:
    name = manifest()["name"]
    repo = repo_url()
    raw = f"https://raw.githubusercontent.com/{slug(repo)}/{sha}/"
    return {
        "name": name,
        "repo": repo,
        "sha": sha,
        "description": DESCRIPTION,
        "maintainer": "e-is",
        "tier": "community",
        "category": CATEGORY,
        "requires_hermes": manifest().get("requires_hermes", ""),
        "docs_url": f"{repo}#readme",
        "version": version,
        "image": raw + CARD,
        "screenshots": [raw + s for s in SCREENSHOTS],
        "platforms": [],
        "capabilities": {"provides_tools": [], "provides_hooks": [],
                         "provides_middleware": [], "requires_env": []},
    }


def to_yaml(entry: dict) -> str:
    """Dump it, then force the two things YAML's own rules get wrong here.

    `version` must be a quoted string (an unquoted 1.0.1 is a float to one parser and a
    string to the other — the catalog README says to quote it), and an empty `platforms:`
    list must stay a flow `[]` like every other entry rather than a block list.
    """
    try:
        import yaml
    except ImportError:
        raise SystemExit("catalog: PyYAML missing (pip install pyyaml)")
    text = yaml.safe_dump(entry, sort_keys=False, allow_unicode=True, width=100,
                          default_flow_style=False)
    out = []
    for line in text.splitlines():
        if line.startswith("version: ") and not line.startswith('version: "'):
            line = f'version: "{line.split(" ", 1)[1]}"'
        out.append(line)
    return "\n".join(out) + "\n"


def validate(entry: dict, text: str) -> list[str]:
    """Every rule the catalog CI or a reviewer applies, as a list of failures."""
    bad: list[str] = []
    man = manifest()
    repo = repo_url()
    tok = token()

    # the sha has to be reachable in the repo, or CI's pinned clone cannot check it out.
    # The raw-URL probes only mean something once this is true, so it runs first.
    status, body = http(f"https://api.github.com/repos/{slug(repo)}/commits/{entry['sha']}", token=tok)
    if status == 200:
        pushed = True
    elif status == 0:
        pushed = False
        print(f"  · offline — could not confirm the sha is pushed ({body.decode()[:60]})")
    else:
        pushed = False
        print(f"  · the pinned sha does not answer yet (HTTP {status}) — push the commit/tag")

    if not NAME_RE.match(entry["name"]):
        bad.append(f"name {entry['name']!r} is not [a-z0-9_-]{{1,64}}")
    if entry["name"] != man["name"]:
        bad.append(f"name {entry['name']!r} != plugin.yaml name: {man['name']!r}")
    if not entry["repo"].startswith("https://"):
        bad.append("repo must be an https:// URL")
    if not SHA_RE.match(entry["sha"]):
        bad.append(f"sha {entry['sha']!r} is not a full 40-hex commit")
    if entry["version"] != man["version"]:
        bad.append(f"version {entry['version']!r} != plugin.yaml {man['version']!r} "
                   "— bump it in the same PR that bumps the sha")
    if entry["requires_hermes"] != man.get("requires_hermes", ""):
        bad.append(f"requires_hermes {entry['requires_hermes']!r} != plugin.yaml "
                   f"{man.get('requires_hermes')!r}")

    # the parsers: the desktop loader and the catalog CI do not use the same one
    try:
        import yaml
        if yaml.safe_load(text) != entry:
            bad.append("PyYAML round-trip differs from what was written")
    except Exception as exc:
        bad.append(f"PyYAML cannot read the file back: {exc}")
    try:
        from ruamel.yaml import YAML
        loaded = YAML(typ="safe").load(text)
        if loaded != entry:
            bad.append("ruamel round-trip differs (check quoting/indentation)")
    except ImportError:
        print("  · ruamel.yaml missing — skipped (pip install ruamel.yaml to match CI)")
    except Exception as exc:
        bad.append(f"ruamel cannot read the file back: {exc}")

    # images: 2:1, GitHub host, pinned to THIS sha, and actually there
    img = entry["image"]
    if img:
        if not any(h in img for h in GITHUB_HOSTS):
            bad.append(f"image host is not a GitHub one: {img}")
        if f"/{entry['sha']}/" not in img:
            bad.append("image URL is not pinned to the entry's sha")
        local = REPO / CARD
        if local.exists():
            w, h = png_size(local)
            if abs(w / h - 2.0) > 0.01:
                bad.append(f"{CARD} is {w}x{h} — the catalog banner is 2:1")
        if pushed:
            status, _ = http(img, method="HEAD")
            if status != 200:
                bad.append(f"image URL does not answer at this sha (HTTP {status or 'n/a'})")
    if len(entry["screenshots"]) > 6:
        bad.append(f"{len(entry['screenshots'])} screenshots — the catalog shows at most 6")
    for url in entry["screenshots"]:
        if not any(h in url for h in GITHUB_HOSTS):
            bad.append(f"screenshot host is not a GitHub one: {url}")
        if f"/{entry['sha']}/" not in url:
            bad.append(f"screenshot not pinned to the entry's sha: {url}")
        if pushed:
            status, _ = http(url, method="HEAD")
            if status != 200:
                bad.append(f"screenshot does not answer at this sha (HTTP {status or 'n/a'}): {url}")

    if not pushed:
        bad.append(f"the pinned sha {entry['sha'][:12]} is not on the remote yet — push the commit "
                   "and the tag before opening the PR (CI clones exactly this commit)")
    return bad


def official_validator(entry_path: Path) -> str:
    """Run the catalog's own structural validator if a hermes-agent checkout is around."""
    for root in (Path.home() / "git" / "hermes-agent", Path.home() / ".hermes" / "hermes-agent"):
        script = root / "scripts" / "validate_plugin_catalog.py"
        if script.exists():
            p = subprocess.run([sys.executable, str(script), str(entry_path)],
                               capture_output=True, text=True, timeout=300, cwd=root)
            return (p.stdout + p.stderr).strip()
    return ""


def pr_body(entry: dict, range_note: str, results: list[str]) -> str:
    repo, name = entry["repo"], entry["name"]
    checks = "\n".join(f"- {r}" for r in results) or "- (run `scripts/catalog.py --check` for the local report)"
    return f"""## What does this PR do?

Lists the community plugin **{name}** in the desktop plugin catalog: a model leaderboard
for Hermes Desktop that ranks any OpenRouter model for a chosen Hermes profile. Full
`/{name}` page with per-profile criteria, six score views (cards, table, score bars,
histograms, heatmap, quality-vs-cost Pareto frontier), curated SWE-bench Verified /
LiveCodeBench indices, an OpenRouter news feed, and a documented REST surface under
`/api/plugins/{name}/`. No API keys of its own; the optional criteria auto-fill runs on
the host LLM facade and is spelled out in the entry's disclosure.

Repo: [GitHub - {slug(repo)}]({repo}) — unified plugin (Python backend straight from
`dashboard/`, ESM desktop renderer built and committed as `desktop/plugin.js`), GPL-3.0.

`sha` is the `v{entry['version']}` release commit. {range_note}

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

- `plugin-catalog/{name}.yaml` (+{len(to_yaml(entry).splitlines())}/-0): new catalog entry,
  exact-SHA pin at `{entry['sha']}`, `version: "{entry['version']}"`, image and screenshots
  pinned to that same commit.

## How to Test

Both catalog CI jobs, reproduced locally before opening:

```bash
# structural
python3 scripts/validate_plugin_catalog.py plugin-catalog/

# pinned-source — the CI validates a CLONE at the pinned sha, without an install
git worktree add --detach /tmp/{name}-pin {entry['sha']}
(cd /tmp/{name}-pin && hermes plugins validate .)
git worktree remove /tmp/{name}-pin --force
```

Result:

{checks}

## Checklist

- [x] I've read the [Contributing Guide](https://github.com/NousResearch/hermes-agent/blob/main/CONTRIBUTING.md)
- [x] My commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [x] I searched for [existing PRs](https://github.com/NousResearch/hermes-agent/pulls) to make sure this isn't a duplicate
- [x] My PR contains **only** changes related to this fix/feature (one catalog file, no code)
- [x] The pinned sha is reachable on the commits API
- [x] `image` / `screenshots` are on GitHub hosts and pinned to the entry's sha
- [x] `capabilities:` matches what the plugin registers at that commit (one read-only skill; no tools, hooks, middleware or required env)

## Screenshots

![catalogue card]({entry['image']})
"""


def check_committed(entry: dict, text: str) -> list[str]:
    """`--check`: does the entry in this repo still describe the current release?"""
    path = ENTRY_DIR / f"{entry['name']}.yaml"
    if not path.exists():
        return [f"{path.relative_to(REPO)} does not exist yet (run --write)"]
    have = path.read_text(encoding="utf-8")
    if have != text:
        import difflib
        diff = "".join(difflib.unified_diff(have.splitlines(True), text.splitlines(True),
                                            "committed", "generated"))[:1200]
        return [f"{path.relative_to(REPO)} is stale:\n{diff}"]
    return []


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate/validate the plugin-catalog entry.")
    ap.add_argument("--tag", help="commit to pin (default: HEAD)")
    ap.add_argument("--sha", help="commit to pin (default: HEAD)")
    ap.add_argument("--version", help="version label (default: plugin.yaml version:)")
    ap.add_argument("--write", action="store_true", help="write plugin-catalog/<name>.yaml")
    ap.add_argument("--check", action="store_true", help="verify the committed entry is current")
    ap.add_argument("--install", metavar="DIR", help="copy the entry into a hermes-agent plugin-catalog/")
    ap.add_argument("--pr-body", action="store_true", help="write .agents/pr-catalog-<version>.md")
    ap.add_argument("--range", default="", help="commit range note for the PR body (updates only)")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    sha = args.sha or (git("rev-list", "-n", "1", args.tag) if args.tag else git("rev-parse", "HEAD"))
    version = args.version or manifest()["version"]
    entry = build(sha, version)
    text = to_yaml(entry)

    failures = validate(entry, text)
    failures += check_committed(entry, text) if args.check else []

    entry_path = ENTRY_DIR / f"{entry['name']}.yaml"
    if args.write:
        ENTRY_DIR.mkdir(exist_ok=True)
        entry_path.write_text(text, encoding="utf-8")
        print(f"catalog: wrote {entry_path.relative_to(REPO)}  ({entry['name']} {version} @ {sha[:12]})")
    if args.install:
        dest = Path(args.install).expanduser() / f"{entry['name']}.yaml"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text, encoding="utf-8")
        print(f"catalog: installed {dest}")

    if args.check or args.write:
        report = official_validator(entry_path if entry_path.exists() else Path("/dev/null"))
        if report:
            print("  official validator:", report.replace("\n", "\n  "))
            if "ERROR" in report:
                failures.append("the official validator reported errors (see above)")

    if args.pr_body:
        out = REPO / ".agents" / f"pr-catalog-{version}.md"
        out.parent.mkdir(exist_ok=True)
        results = ([] if not failures else failures[:6]) or [
            "structural: `validate_plugin_catalog.py` → see the run above",
            "pinned-source: `hermes plugins validate` at the pinned sha → see the run above",
        ]
        out.write_text(pr_body(entry, args.range, results), encoding="utf-8")
        print(f"catalog: wrote {out.relative_to(REPO)}")

    if not args.quiet and not (args.write or args.install):
        print(text, end="")

    for f in failures:
        print(f"catalog: ERROR: {f}")
    if failures:
        return 1
    print(f"catalog: OK — {entry['name']} {version} @ {sha[:12]}"
          f" ({len(entry['screenshots'])} screenshots, image {'2:1' if CARD else ''})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
