"""Hermes Model Leaderboard — unified plugin package.

Ranking of the LLM models a Hermes install can reach (OpenRouter prices/context,
curated benchmark indices), scored against per-profile weightings.

- ``dashboard/``  — FastAPI backend (OpenRouter models cache, profiles, curated
  benchmarks, news), mounted by the gateway at
  ``/api/plugins/model-leaderboard/``.
- ``desktop/``    — Hermes Desktop renderer (full page ``/model-leaderboard``).
- ``skills/``     — read-only skills shipped with the plugin, resolvable with
  ``skill_view('model-leaderboard:<name>')``.

The renderer is the plugin; ``dashboard/manifest.json`` and ``plugin.yaml`` must
agree on the name (``model-leaderboard``) — that name is both the desktop
namespace the renderer's ``ctx.rest`` scopes to and the path the gateway mounts
the router under. A mismatch 404s every API call.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger("hermes-model-leaderboard")

_ROOT = Path(__file__).resolve().parent

#: ``sys.modules`` key under which ``plugin_ctx.py`` is loaded. The literal is
#: duplicated in ``plugin_ctx.py`` (``_MODULE_NAME``) on purpose — see
#: :func:`_shared_ctx`.
_SHARED_CTX_MODULE = "hermes_model_leaderboard_shared_ctx"

#: Skill shipped with the plugin (read-only, resolved as ``model-leaderboard:<name>``).
_SKILLS = (
    (
        "refresh-benchmarks",
        _ROOT / "skills" / "refresh-benchmarks" / "SKILL.md",
        "Refresh the curated benchmark indices (SWE-bench Verified, LiveCodeBench) "
        "of the tracked models by browsing the public leaderboards.",
    ),
)


def _shared_ctx():
    """The ``plugin_ctx`` module shared with ``dashboard/plugin_api.py`` (or None).

    Loaded by path under the fixed ``sys.modules`` key that ``plugin_ctx`` also uses
    (duplicated literal on purpose: this package must not depend on the plugin
    directory being importable), so the backend router — which the gateway imports
    standalone, with no link to this package — reaches the very same instance.
    """
    try:
        import importlib.util
        import sys

        existing = sys.modules.get(_SHARED_CTX_MODULE)
        if existing is not None:
            return existing
        spec = importlib.util.spec_from_file_location(_SHARED_CTX_MODULE, _ROOT / "plugin_ctx.py")
        if spec is None or spec.loader is None:
            return None
        module = importlib.util.module_from_spec(spec)
        sys.modules[_SHARED_CTX_MODULE] = module
        spec.loader.exec_module(module)
        return module
    except Exception:  # pragma: no cover — defensive
        logger.warning("model-leaderboard: unable to load the shared context module", exc_info=True)
        return None


def _register_skills(ctx) -> None:
    for name, path, description in _SKILLS:
        if not path.exists():  # pragma: no cover — packaging accident
            logger.warning("model-leaderboard: skill file missing at %s", path)
            continue
        try:
            ctx.register_skill(name, path, description=description)
        except Exception as exc:
            # Already registered (hot reload) or an older host without plugin skills:
            # never fatal, the plugin's real surfaces are the router + renderer.
            logger.debug("model-leaderboard: skill %r not registered (%s)", name, exc)


def register(ctx) -> None:
    """Expose the host context to the backend router and publish the plugin's skills.

    No core agent tools/hooks/middleware are registered: the plugin's surfaces are
    the dashboard API router and the desktop renderer. ``ctx.llm`` is consumed
    *by the router* (the ``/auto-fill`` endpoint) — the context is stashed in
    ``plugin_ctx`` so the separately-imported router reaches it.
    """
    shared = _shared_ctx()
    if shared is not None:
        shared.set_context(ctx)
    _register_skills(ctx)
    return None
