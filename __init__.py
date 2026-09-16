"""Hermes LLM Dashboard — unified plugin package.

Port of the sumaris-agent ``docker/hermes-model-leaderboard`` fullstack app (FastAPI +
React/Vite served on :3004) as a unified Hermes plugin:

- ``dashboard/``  — FastAPI backend (OpenRouter models cache, profiles,
  consumption analytics, news), mounted at ``/api/plugins/hermes-model-leaderboard/``.
- ``desktop/``    — Hermes Desktop renderer (full page ``/hermes-model-leaderboard``).

Status: SKELETON — porting in progress. See README.md for the plan.
"""


def register(ctx) -> None:
    """No-op registration for the capability probe.

    Real surfaces: dashboard API router + desktop renderer. No core agent
    tools/hooks/middleware are registered.
    """
    return None
