"""Shared plugin-context handle.

Why this module exists
----------------------
The desktop renderer and the FastAPI backend of this plugin are loaded through
two different code paths:

* ``__init__.py`` is imported by the plugin loader, which calls ``register(ctx)``
  and hands it a :class:`hermes_cli.plugins.PluginContext` (``ctx.llm``, skills,
  ...).
* ``dashboard/plugin_api.py`` is mounted by the gateway with
  ``importlib.util.spec_from_file_location`` — a *separate module object*, with no
  access to the package that ``__init__`` belongs to.

So the router cannot simply ``from . import _ctx``. Instead both sides load *this*
module under one fixed key in ``sys.modules``: the first import executes it, the
second gets the very same instance back, and ``get_llm()`` then reaches the same
PluginLlm facade the host built for us.

Nothing here touches agent internals: the context stays host-owned and every LLM
call stays routed through ``ctx.llm`` (host-owned auth, timeouts, audit log).
"""
from __future__ import annotations

import importlib.util
import pathlib
import sys
from typing import Any, Optional

#: Fixed key so both loaders share one instance (see module docstring).
_MODULE_NAME = "hermes_model_leaderboard_shared_ctx"

_context: Any = None


def set_context(ctx: Any) -> None:
    """Remember the host context handed to ``register(ctx)``."""
    global _context
    _context = ctx


def get_context() -> Any:
    """The host :class:`PluginContext`, or ``None`` outside a plugin load."""
    return _context


def get_llm() -> Optional[Any]:
    """The host-owned ``ctx.llm`` facade, or ``None`` when unavailable.

    ``None`` means the process serving this router never ran ``register(ctx)``
    (bare ``uvicorn`` run of ``plugin_api`` for local debugging, …). Callers must
    treat it as "no LLM available" rather than reaching for agent internals.
    """
    if _context is None:
        return None
    return getattr(_context, "llm", None)


def load(root: pathlib.Path) -> Optional[Any]:
    """Import this module under the shared key and return it.

    ``root`` is the plugin directory (the one holding ``plugin_ctx.py``); callers
    pass their own resolved location so both ``__init__.py`` and
    ``dashboard/plugin_api.py`` find the same file. Returns ``None`` if the module
    cannot be loaded — the caller then degrades (no LLM, no shared state) instead
    of raising during plugin discovery.
    """
    existing = sys.modules.get(_MODULE_NAME)
    if existing is not None:
        return existing
    path = pathlib.Path(root) / "plugin_ctx.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location(_MODULE_NAME, path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    sys.modules[_MODULE_NAME] = module
    try:
        spec.loader.exec_module(module)
    except Exception:  # pragma: no cover — defensive: never break plugin load
        sys.modules.pop(_MODULE_NAME, None)
        return None
    return module


__all__ = ["load", "set_context", "get_context", "get_llm"]
