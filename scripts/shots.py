#!/usr/bin/env python3
"""Capture the Model Leaderboard plugin running in the real desktop, and animate it.

Drives Hermes Desktop over CDP (Chrome DevTools Protocol) — the only harness that
renders the REAL component tree, theme and CSS. Nothing is stubbed here: the numbers
in the screenshots are the plugin's own, fetched from OpenRouter by the app.

Before it touches the UI it makes the run deterministic and private:

  1. the app must expose a CDP page target (see LAUNCH below);
  2. the UI language must be English (the README screenshots are "-en-");
  3. the active gateway must be « This device », so the captures show the LOCAL
     install and none of the team's remote data;
  4. the shell's Pinned and Sessions sections are collapsed and the sidebar is
     dragged narrow, so no session title can end up in a screenshot;
  5. the plugin's own persisted state (score view, selected profile, hidden models,
     news panel) is reset, so the run never inherits the last session's layout.

Then it walks the scenario, writing PNGs into assets/ and a GIF/MP4 into
assets/animations/ (ffmpeg, palettegen/paletteuse).

LAUNCH — the debug port is gated: a packaged build never opens it by itself, and on
Wayland the app re-execs itself with --ozone-platform, which would leave the port on
a windowless supervisor, so pass the platform flag yourself:

    pkill -f 'release/linux-unpacked/Hermes'
    ~/.hermes/hermes-agent/apps/desktop/release/linux-unpacked/Hermes \
        --ozone-platform=wayland --remote-debugging-port=9222

The plugin must be enabled (`hermes plugins enable model-leaderboard`) and the app
must have been STARTED after that: it registers desktop plugins at boot only — a
`hermes gateway restart` alone will not add the sidebar entry.

Usage:  python3 scripts/shots.py [--port 9222] [--no-gif] [--keep-open]
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

try:
    import websockets
except ImportError:  # pragma: no cover
    sys.exit("need the `websockets` package (present in the Hermes runtime)")

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "assets"
ANIM = ASSETS / "animations"
FRAMES = REPO / ".agents" / "shot-frames"

SIDEBAR_LABEL = "Model Leaderboard"
PLUGIN = "model-leaderboard"
SIDEBAR_W = 232          # px — what the shell's sidebar is dragged to for a capture
MAX_FRAMES = 110         # frames kept for the animation (GIF length and weight)
ANIM_FPS = 10            # playback rate of the assembled GIF/MP4
ANIM_WIDTH = 1024         # GIF width (1280 made a 2.8 MB file GitHub renders slowly)
RESTORE: dict = {}       # shell state the run must put back (mode, sidebar width)
PANE: dict | None = None  # clip rect of the plugin's own scroll pane (see pane_clip)

#: JS that finds the plugin page's scroll container — the pane that holds the plugin's
#: chrome. Captures are clipped to it so the shell's sidebar (the user's session
#: titles, pinned runs, token totals) never ends up in a README screenshot.
_PANE_JS = """(() => {
  const h1 = [...document.querySelectorAll('h1')].find(e => e.textContent.trim() === 'LLM Model Leaderboard');
  if (!h1) return null;
  let el = h1, pane = null;
  while (el) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if ((st.overflowY === 'auto' || st.overflow === 'auto') && r.height > 300 && r.x > 100) { pane = el; break; }
    el = el.parentElement;
  }
  if (!pane) return null;
  const r = pane.getBoundingClientRect();
  const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
  return JSON.stringify({
    x, y,
    width: Math.round(Math.min(r.width, window.innerWidth - x)),
    height: Math.round(Math.min(r.height, window.innerHeight - y)),
  });
})()"""

#: The criteria dialog is the only place with a range input, which makes it the
#: reliable handle for "is it open" — queries built on its title text matched a
#: wrapper with a nonsense rect (y = -420) and reported plenty of nothing.
_MODAL_OPEN_JS = "(() => !!document.querySelector('input[type=range]'))()"

#: Read every weight slider with the text of its row (criterion name + description).
_MODAL_READ_JS = """(() => {
  const rows = [...document.querySelectorAll('input[type=range]')].map(el => {
    let row = el, text = '';
    for (let i = 0; i < 4 && row; i++) {
      row = row.parentElement;
      if (row && row.textContent) { text = row.textContent.trim().replace(/\\s+/g, ' '); break; }
    }
    return { label: text.slice(0, 60), value: Number(el.value) };
  });
  return JSON.stringify(rows);
})()"""

#: Close the dialog by its own ✕ (Escape is not wired: it left the overlay up).
_MODAL_CLOSE_JS = """(() => {
  const r = document.querySelector('input[type=range]');
  if (!r) return 'already closed';
  let el = r;
  while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement;
  const btns = el ? [...el.querySelectorAll('button')] : [];
  const x = btns.find(b => b.textContent.trim() === '\\u2715')
         || btns.find(b => /^(cancel|annuler)$/i.test(b.textContent.trim()));
  if (!x) return 'no close button: ' + btns.map(b => b.textContent.trim().slice(0, 12)).join('|');
  x.click();
  return 'clicked';
})()"""

#: Weights the scenario demonstrates with — a coding-heavy, price-aware profile, so
#: the re-ranking is obvious (cheap coding models climb, pricey ones drop). Keys are
#: regexes matched against the dialog row's text (criterion name + description).
DEMO_WEIGHTS = {"Coding": 5, "Agentic": 4, "input tokens": 5, "output tokens": 4, "Context window": 4}

# The score views, in the order the scenario walks them. Keys are the plugin's own
# ScoreViewId values, labels are what the buttons read in English.
VIEWS = (
    ("classic", "Cards", "models"),
    ("stacked", "Score bars", "score-bars"),
    ("columns", "Histograms", "histograms"),
    ("heatmap", "Heatmap", "heatmap"),
    ("value", "Quality / cost", "quality-cost"),
)

# localStorage keys the plugin persists (src/LeaderboardPage.tsx) — cleared so a run
# never inherits the previous one's profile, view, hidden models or panel state.
STATE_KEYS = ("llm-dash-score-view", "llm-dash-hidden", "llm-dash-radar-hidden",
              "llm-dash-profile", "llm-dash-show-news")


class Dead(Exception):
    """Something the script cannot work around — stop and tell the human."""


# ── CDP plumbing ────────────────────────────────────────────────────────────
class Desktop:
    def __init__(self, port: int):
        self.port = port
        self.ws = None
        self._id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._pump: asyncio.Task | None = None
        self.frames: list[bytes] = []
        self.screencasting = False

    @staticmethod
    def page_target(port: int) -> dict:
        try:
            targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=8))
        except Exception as exc:
            raise Dead(
                f"no CDP listener on {port} ({exc}).\n"
                "Launch the desktop with the platform flag AND the debug port:\n"
                "  pkill -f 'release/linux-unpacked/Hermes'\n"
                "  ~/.hermes/hermes-agent/apps/desktop/release/linux-unpacked/Hermes \\\n"
                f"      --ozone-platform=wayland --remote-debugging-port={port}"
            ) from exc
        page = next((t for t in targets
                     if t.get("type") == "page" and "devtools" not in (t.get("url") or "").lower()), None)
        if not page:
            raise Dead(
                f"the port answers but lists no page target ({len(targets)} targets).\n"
                "On Wayland this means the debug port landed on the supervisor process while the\n"
                "UI lives in the re-exec child: relaunch passing --ozone-platform=wayland yourself."
            )
        return page

    async def open(self):
        page = self.page_target(self.port)
        self.ws = await websockets.connect(page["webSocketDebuggerUrl"], max_size=128 * 1024 * 1024)
        # One reader for the whole session: CDP screencast frames are EVENTS, and an
        # inline read-on-call client only sees them while a command is in flight. The
        # first animation attempt captured 0 frames that way — it slept between actions
        # while Chrome sat waiting for the ack that never came.
        self._pump = asyncio.create_task(self._read_loop())
        await self.call("Page.enable")
        await self.call("Runtime.enable")
        return page

    async def _read_loop(self):
        """Pump the socket: ack every screencast frame, resolve every pending call."""
        while True:
            try:
                msg = json.loads(await self.ws.recv())
            except Exception:
                return
            if msg.get("method") == "Page.screencastFrame":
                self.frames.append(base64.b64decode(msg["params"]["data"]))
                try:
                    await self.ws.send(json.dumps({
                        "id": 0, "method": "Page.screencastFrameAck",
                        "params": {"sessionId": msg["params"]["sessionId"]}}))
                except Exception:
                    pass
                continue
            fut = self._pending.pop(msg.get("id"), None)
            if fut is not None and not fut.done():
                if "error" in msg:
                    fut.set_exception(Dead(f"{msg.get('method', 'call')}: {msg['error'].get('message')}"))
                else:
                    fut.set_result(msg.get("result", {}))

    async def call(self, method: str, params: dict | None = None, *, timeout: float = 120.0) -> dict:
        if self.ws is None:
            raise Dead("CDP socket is not open")
        self._id += 1
        mid = self._id
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[mid] = fut
        await self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(mid, None)
            raise Dead(f"{method}: no answer within {timeout:.0f}s")

    async def close(self):
        if self._pump is not None:
            self._pump.cancel()
            self._pump = None
        if self.ws is not None:
            await self.ws.close()

    async def ev(self, expression: str):
        res = await self.call("Runtime.evaluate",
                              {"expression": expression, "returnByValue": True, "awaitPromise": True})
        out = res.get("result") or {}
        if out.get("subtype") == "error":
            raise Dead(out.get("description", "javascript error"))
        return out.get("value")

    async def click_text(self, text: str, *, exact: bool = True, scope: str = "button") -> bool:
        """Click the first element of `scope` carrying that text."""
        js = f"""(() => {{
          const want = {json.dumps(text)};
          const nodes = [...document.querySelectorAll({json.dumps(scope)})];
          const hit = nodes.find(e => {{
            const t = e.textContent.trim();
            return {'t === want' if exact else 't.includes(want)'};
          }});
          if (!hit) return false;
          hit.click();
          return true;
        }})()"""
        return bool(await self.ev(js))

    async def click_xy(self, x: float, y: float):
        """Real mouse events at viewport coordinates (the shell's sidebar ignores .click())."""
        for kind in ("mousePressed", "mouseReleased"):
            await self.call("Input.dispatchMouseEvent",
                            {"type": kind, "x": x, "y": y, "button": "left", "clickCount": 1})

    async def shot(self, name: str, *, clip: dict | None = None, full_page: bool = False):
        params: dict = {"format": "png", "captureBeyondViewport": False}
        rect = clip or (None if full_page else PANE)
        if rect:
            params["clip"] = {**rect, "scale": 1}
        res = await self.call("Page.captureScreenshot", params)
        if "data" not in res:  # a frame can be missed mid-navigation: retry once
            await asyncio.sleep(0.8)
            res = await self.call("Page.captureScreenshot", params)
        if "data" not in res:
            raise Dead(f"the desktop returned no frame for {name}")
        ASSETS.mkdir(parents=True, exist_ok=True)
        path = ASSETS / f"{name}.png"
        path.write_bytes(base64.b64decode(res["data"]))
        print(f"  ✓ {path.relative_to(REPO)}  ({path.stat().st_size // 1024} kB)")
        return path

    async def start_screencast(self, quality: int = 80):
        shutil.rmtree(FRAMES, ignore_errors=True)
        FRAMES.mkdir(parents=True, exist_ok=True)
        # No maxWidth: a downscaled frame would need the crop rect scaled too, and the
        # animation is re-cropped to the plugin pane afterwards anyway (see encode_animation).
        await self.call("Page.startScreencast",
                        {"format": "jpeg", "quality": quality, "everyNthFrame": 1})
        self.screencasting = True

    async def stop_screencast(self, keep_frames: int = MAX_FRAMES):
        """Stop the cast and write the frames, subsampled to `keep_frames`.

        The pump acks every frame, so Chrome streams at its own rate (2189 frames for a
        30 s scenario on the first try — a 4-minute, 2.8 MB GIF that nobody watches).
        Sampling here keeps the pacing deterministic whatever the compositor does;
        `encode_animation` then plays the result back at ANIM_FPS.
        """
        if not self.screencasting:
            return
        await self.call("Page.stopScreencast")
        self.screencasting = False
        step = max(1, len(self.frames) // max(1, keep_frames))
        kept = self.frames[::step]
        for i, data in enumerate(kept):
            (FRAMES / f"frame-{i:05d}.jpg").write_bytes(data)
        print(f"  {len(self.frames)} frames captured, {len(kept)} kept (every {step})")


# ── pre-flight ──────────────────────────────────────────────────────────────
async def ensure_english(ui: Desktop):
    """The README screenshots are English; the app follows its own locale."""
    probe = await ui.ev("""(() => {
      const txt = document.body.innerText;
      return { fr: /Nouvelle session|Paramètres|Épinglées|Réglages|Aucun modèle/.test(txt),
               en: /New session|Settings|Pinned|No model/.test(txt) };
    })()""")
    if probe.get("en") and not probe.get("fr"):
        print("  language: English ✓")
        return
    raise Dead("the shell is not in English — set Settings → Appearance → Language to English, then rerun")


async def ensure_local_gateway(ui: Desktop):
    """Plugin API calls follow the app's ACTIVE gateway — the team's data lives on the
    remote one, so the captures must run on « This device »."""
    conn = ""
    for _ in range(20):
        conn = str(await ui.ev("""(async () => {
          try { const c = await window.hermesDesktop.getConnection(); return c.mode + ' ' + c.baseUrl; }
          catch (e) { return 'ERR ' + e.message; }
        })()""") or "")
        if conn and not conn.startswith("ERR"):
            break
        await asyncio.sleep(3)
    print(f"  connection: {conn}")
    if conn.startswith("ERR"):
        raise Dead(f"the desktop never reported its connection ({conn})")
    if not conn.startswith("local"):
        # The chip's own text contains "This device", so a text search clicks the chip
        # instead of the menu item: use coordinates, then prove the switch took.
        box = await ui.ev("""(() => {
          const c = [...document.querySelectorAll('button')].find(e =>
            /registered gateways|connexions/i.test(e.getAttribute('aria-label') || ''));
          if (!c) return null;
          const r = c.getBoundingClientRect();
          return JSON.stringify([Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]);
        })()""")
        if not box or box == "null":
            raise Dead("the app is not on « This device » and the gateway chip was not found — switch by hand, then rerun")
        await ui.click_xy(*json.loads(box))
        item = None
        for _ in range(8):
            await asyncio.sleep(0.5)
            item = await ui.ev("""(() => {
              const it = [...document.querySelectorAll('[role=menuitemradio],[role=menuitem]')]
                .find(e => /this device|cet appareil/i.test(e.textContent.trim()));
              if (!it) return null;
              const r = it.getBoundingClientRect();
              return JSON.stringify([Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]);
            })()""")
            if item and item != "null":
                break
        if not item or item == "null":
            raise Dead("no « This device » entry in the gateway menu — pick it by hand, then rerun")
        await ui.click_xy(*json.loads(item))
        await asyncio.sleep(4)
        confirm = await ui.ev("""(() => {
          const d = [...document.querySelectorAll('[role=alertdialog],[role=dialog]')]
            .filter(e => e.getBoundingClientRect().width > 100).pop();
          if (!d) return null;
          const b = [...d.querySelectorAll('button')]
            .find(e => /switch|basculer|confirm|confirmer/i.test(e.textContent.trim()));
          if (!b) return null;
          const r = b.getBoundingClientRect();
          return JSON.stringify([Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]);
        })()""")
        if confirm and confirm != "null":
            await ui.click_xy(*json.loads(confirm))
            await asyncio.sleep(9)
        after = str(await ui.ev("""(async () => {
          try { const c = await window.hermesDesktop.getConnection(); return c.mode + ' ' + c.baseUrl; }
          catch (e) { return 'ERR'; }
        })()""") or "")
        print(f"  connection now: {after}")
        if not after.startswith("local"):
            raise Dead(f"still not on « This device » ({after}) — switch it by hand, then rerun")
    # Pinned to the local connection: this is the route the plugin's own calls use.
    models = await ui.ev("""(async () => {
      try { const r = await window.hermesDesktop.api({ path: '/api/plugins/model-leaderboard/models', connectionId: 'local' });
            return ((r || {}).models || []).length; } catch (e) { return 'error: ' + e.message; }
    })()""")
    print(f"  local gateway models: {models}")
    if not isinstance(models, int) or models <= 0:
        raise Dead(f"the local gateway returned no tracked model ({models}) — check `hermes gateway restart`, "
                   "then the plugin's data file (dashboard/data/models.json)")


async def reset_view_state(ui: Desktop):
    """Put the plugin page back to its default surface before capturing.

    Every key below survives a reload, so a capture run inherits whatever the last
    session left: another score view, a non-default profile, hidden models, or the
    news panel closed. The news panel is forced ON — it is part of the story.
    """
    await ui.ev(f"""(() => {{
      {json.dumps(list(STATE_KEYS))}.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('llm-dash-show-news', 'true');
      localStorage.setItem('llm-dash-profile', 'default');
      localStorage.setItem('llm-dash-score-view', 'classic');
      return true;
    }})()""")
    await ui.call("Page.reload", {"ignoreCache": False})
    await asyncio.sleep(10)


async def collapse_private_sections(ui: Desktop):
    """Hide the user's own sessions before anything is captured."""
    for label in ("Pinned", "Sessions", "Épinglées"):
        state = await ui.ev(f"""(() => {{
          const want = {json.dumps(label)}.toLowerCase();
          const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim().toLowerCase() === want);
          if (!b) return 'absent';
          const open = b.getAttribute('aria-expanded') !== 'false';
          if (open) b.click();
          return open ? 'collapsed' : 'already collapsed';
        }})()""")
        if state != "absent":
            print(f"  {label}: {state}")
    await asyncio.sleep(0.6)


async def resize_sidebar(ui: Desktop, target: int = SIDEBAR_W):
    """Drag the shell's sidebar sash in, the way a user would.

    The sidebar owns a third of the frame otherwise, and nothing it shows is the
    subject. The width is the shell's own persisted layout, so the run puts it back
    at the end — hence the printed before/after.
    """
    box = await ui.ev("""(() => {
      const s = [...document.querySelectorAll('[role=separator]')].find(e => {
        const r = e.getBoundingClientRect();
        return /col-resize/.test(getComputedStyle(e).cursor) && r.x < 600 && r.height > 400;
      });
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
                              before: Math.round(r.x) });
    })()""")
    if not box:
        print("  ! sidebar sash not found — leaving the sidebar alone")
        return None
    b = json.loads(box)
    if abs(b["before"] - target) < 4:
        print(f"  sidebar: already {b['before']}px")
        return b["before"]
    await ui.call("Input.dispatchMouseEvent", {"type": "mousePressed", "x": b["x"], "y": b["y"],
                                               "button": "left", "clickCount": 1})
    for i in range(1, 9):
        x = round(b["x"] + (target - b["before"]) * i / 8)
        await ui.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": b["y"], "button": "left"})
        await asyncio.sleep(0.03)
    await ui.call("Input.dispatchMouseEvent", {"type": "mouseReleased",
                                               "x": round(b["x"] + (target - b["before"])), "y": b["y"],
                                               "button": "left", "clickCount": 1})
    await asyncio.sleep(0.5)
    after = await ui.ev("""(() => {
      const s = [...document.querySelectorAll('[role=separator]')].find(e => {
        const r = e.getBoundingClientRect();
        return /col-resize/.test(getComputedStyle(e).cursor) && r.x < 600 && r.height > 400;
      });
      return s ? Math.round(s.getBoundingClientRect().x) : null;
    })()""")
    print(f"  sidebar: {b['before']}px -> {after}px")
    return b["before"]


async def open_plugin(ui: Desktop):
    """Open the plugin surface with a REAL pointer click, then wait until it has data.

    The shell's sidebar ignores synthetic clicks, and the old habit of checking only
    that the entry EXISTS would happily photograph an unopened page. So: coordinates,
    then wait for the plugin's own table to carry rows.
    """
    box = await ui.ev(f"""(() => {{
      const span = [...document.querySelectorAll('span')].find(s => s.textContent.trim() === {json.dumps(SIDEBAR_LABEL)});
      const btn = span && span.closest('button');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return JSON.stringify({{ x: r.left + r.width / 2, y: r.top + r.height / 2 }});
    }})()""")
    if not box or box == "null":
        raise Dead(f"the « {SIDEBAR_LABEL} » entry is missing from the sidebar — "
                   "was the app started after `hermes plugins enable model-leaderboard`?")
    b = json.loads(box)
    await ui.click_xy(b["x"], b["y"])
    for _ in range(20):
        await asyncio.sleep(1.5)
        rows = await ui.ev("(() => document.querySelectorAll('table tbody tr').length)()")
        if isinstance(rows, int) and rows > 0:
            print(f"  plugin surface mounted ({rows} rows)")
            return
    raise Dead(f"« {SIDEBAR_LABEL} » was clicked but no model row ever appeared")


async def pane_clip(ui: Desktop) -> dict | None:
    """Measure the plugin's own scroll pane and remember it as the capture frame.

    Everything is clipped to it: the shell's sidebar is the user's private surface
    (session titles, pinned runs, spend) and has no business in a README image.
    """
    global PANE
    box = await ui.ev(_PANE_JS)
    if not box or box == "null":
        print("  ! plugin pane not found — falling back to full-window captures")
        PANE = None
        return None
    PANE = json.loads(box)
    RESTORE["viewport"] = await ui.ev("(() => JSON.stringify([window.innerWidth, window.innerHeight]))()")
    print(f"  pane: {PANE['width']}x{PANE['height']} at ({PANE['x']},{PANE['y']})")
    return PANE


async def scroll_pane(ui: Desktop, top: int):
    """Scroll the plugin pane the way a user would (its own scroll container)."""
    await ui.ev(f"""(() => {{
      const h1 = [...document.querySelectorAll('h1')].find(e => e.textContent.trim() === 'LLM Model Leaderboard');
      let el = h1, pane = null;
      while (el) {{
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if ((st.overflowY === 'auto' || st.overflow === 'auto') && r.height > 300 && r.x > 100) {{ pane = el; break; }}
        el = el.parentElement;
      }}
      if (!pane) return null;
      pane.scrollTo({{ top: {top}, behavior: 'instant' }});
      return pane.scrollTop;
    }})()""")
    await asyncio.sleep(1.2)


async def select_profile(ui: Desktop, profile: str = "default"):
    """Make sure the scoring chip is on `default` — the profile every install has."""
    chip = await ui.ev("""(() => {
      const b = [...document.querySelectorAll('button')].find(e => /^default$/.test(e.textContent.trim()));
      return b ? 'default' : '';
    })()""")
    if chip:
        print("  profile chip: default")
        return
    clicked = await ui.click_text(profile, scope="button")
    print(f"  profile chip: {profile if clicked else 'not found'}")


async def set_view(ui: Desktop, label: str) -> bool:
    ok = await ui.click_text(label)
    await asyncio.sleep(1.6)
    return ok


async def open_criteria(ui: Desktop) -> bool:
    """Open the tracking-profile dialog and wait until its weight sliders are up."""
    ok = await ui.click_text("Edit scoring criteria", scope="button,a")
    if not ok:
        return False
    for _ in range(10):
        await asyncio.sleep(0.6)
        if await ui.ev(_MODAL_OPEN_JS):
            return True
    return False


async def close_criteria(ui: Desktop) -> bool:
    """Close the dialog by its own ✕, and PROVE it closed.

    Escape does nothing here — the dialog listens to nothing — and a run that assumed
    it did left the overlay covering every later frame of the animation.
    """
    clicked = await ui.ev(_MODAL_CLOSE_JS)
    for _ in range(8):
        await asyncio.sleep(0.5)
        if not await ui.ev(_MODAL_OPEN_JS):
            return True
    print(f"  ! the criteria dialog is still open (close click: {clicked})")
    return False


async def read_weights(ui: Desktop):
    """`[{label, value}]` for the dialog's weight sliders, in the order shown."""
    raw = await ui.ev(_MODAL_READ_JS)
    return json.loads(raw) if raw and raw != "null" else []


async def set_weights(ui: Desktop, wanted: dict) -> list:
    """Move sliders by label, the React way (native setter + input event).

    Setting `input.value` alone is invisible to React: the controlled component keeps
    its own state and repaints the old value back. The native setter bypasses the
    instance's property, and the bubbling events make React's onChange fire.
    """
    raw = await ui.ev("""(() => {
      const wanted = %s;
      const out = [];
      const inputs = [...document.querySelectorAll('input[type=range]')];
      for (const el of inputs) {
        // the row's text (criterion name + description) is the only stable handle
        let row = el, text = '';
        for (let i = 0; i < 4 && row; i++) { row = row.parentElement; if (row && row.textContent) { text = row.textContent; break; } }
        const key = Object.keys(wanted).find(k => new RegExp(k, 'i').test(text));
        if (!key) continue;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, String(wanted[key]));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        out.push([key, el.value]);
      }
      return JSON.stringify(out);
    })()""" % json.dumps(wanted))
    return json.loads(raw) if raw and raw != "null" else []


async def set_weights_by_index(ui: Desktop, values: list) -> list:
    """Set the sliders by position — how the run puts the profile back as it found it."""
    raw = await ui.ev("""(() => {
      const vals = %s;
      const out = [];
      [...document.querySelectorAll('input[type=range]')].forEach((el, i) => {
        if (i >= vals.length) return;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, String(vals[i]));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        out.push(el.value);
      });
      return JSON.stringify(out);
    })()""" % json.dumps(values))
    return json.loads(raw) if raw and raw != "null" else []


async def save_criteria(ui: Desktop) -> bool:
    """Press Save (the dialog's primary action) and wait for it to close."""
    saved = await ui.ev("""(() => {
      const r = document.querySelector('input[type=range]');
      if (!r) return 'no dialog';
      let el = r;
      while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement;
      const btns = el ? [...el.querySelectorAll('button')] : [];
      const save = btns.find(b => /^(save|enregistrer)$/i.test(b.textContent.trim()));
      if (!save) return 'no save button: ' + btns.map(b => b.textContent.trim().slice(0, 14)).join('|');
      save.click();
      return 'clicked';
    })()""")
    for _ in range(14):
        await asyncio.sleep(0.6)
        if not await ui.ev(_MODAL_OPEN_JS):
            return True
    print(f"  ! the dialog did not close after Save ({saved})")
    return False


# ── the scenario ────────────────────────────────────────────────────────────
async def run_scenario(ui: Desktop, *, make_gif: bool):
    print("scenario")
    # Cards first: the top of the page (title, chips, selector, top-5 cards)…
    if not await set_view(ui, "Cards"):
        print("  ! the Cards view button was not found — the page may not be the leaderboard")
        return
    await ui.shot("screenshot-en-01-models")
    # …then the same view scrolled to the tracked-models table (the page is taller
    # than the pane, so one still can never show both).
    await scroll_pane(ui, 430)
    await ui.shot("screenshot-en-02-models-table")
    await scroll_pane(ui, 0)

    # The other score views, in the order the selector offers them.
    for idx, (_view, label, slug) in enumerate(VIEWS[1:], start=3):
        if not await set_view(ui, label):
            print(f"  ! view button {label!r} not found — skipping")
            continue
        await ui.shot(f"screenshot-en-{idx:02d}-{slug}")

    # The tracking-profile dialog: shown as it is, then actually USED — a few weights
    # move, Save re-ranks the page on the spot, and the run keeps the original values
    # so it can hand the profile back untouched (see restore_profile).
    if await open_criteria(ui):
        await ui.shot("screenshot-en-08-criteria")
        original = await read_weights(ui)
        RESTORE["weights"] = [w["value"] for w in original]
        print("  weights before: " + ", ".join(f"{w['label'][:14]}={w['value']}" for w in original[:6]))
        moved = await set_weights(ui, DEMO_WEIGHTS)
        print(f"  weights moved: {moved}")
        await asyncio.sleep(1.5)
        await ui.shot("screenshot-en-09-criteria-edited")
        if await save_criteria(ui):
            await asyncio.sleep(2.5)
            await scroll_pane(ui, 430)
            await ui.shot("screenshot-en-10-ranking-after")
            await scroll_pane(ui, 0)
    else:
        print("  ! « Edit scoring criteria » not found — skipping the dialog shots")

    # The animation, LAST: Page.captureScreenshot returns no frame while a screencast
    # runs, so every still above has to be taken first. The pacing is deliberate: an
    # animation that clicks through the views faster than the eye reads them shows
    # nothing, and the dialog step must be given time to open, move and close.
    if make_gif:
        await set_view(ui, "Cards")
        await ui.start_screencast()
        await asyncio.sleep(1.6)
        for _view, label, _slug in VIEWS[1:]:
            await set_view(ui, label)
            await asyncio.sleep(1.8)
        await set_view(ui, "Cards")
        await asyncio.sleep(1.8)
        await scroll_pane(ui, 430)
        await asyncio.sleep(1.6)
        await scroll_pane(ui, 0)
        await asyncio.sleep(1.2)
        if await open_criteria(ui):
            await asyncio.sleep(1.8)
            if RESTORE.get("weights"):
                # back to the profile's own values: the sliders move, Save re-ranks
                # live — and the profile ends up exactly as the run found it
                await set_weights_by_index(ui, RESTORE["weights"])
            await asyncio.sleep(2.4)
            await save_criteria(ui)
            await asyncio.sleep(1.8)
            await scroll_pane(ui, 430)
            await asyncio.sleep(2.2)
            await scroll_pane(ui, 0)
            await asyncio.sleep(1.2)
        await ui.stop_screencast()
        await asyncio.sleep(0.4)

    # Leave the page on the default view, at the top.
    await scroll_pane(ui, 0)
    await set_view(ui, "Cards")
    await asyncio.sleep(0.6)


def encode_animation():
    """Assemble the frames into a GIF/MP4 — cropped to the plugin pane.

    Page.startScreencast has no clip option: it records the whole window, sidebar
    included — and the sidebar carries the user's own sessions. So the frames are
    cropped to the same rect the stills use (scaled, because the screencast frame is
    not necessarily 1:1 with CSS pixels).
    """
    frames = sorted(FRAMES.glob("frame-*.jpg"))
    if not frames:
        print("  no frames — no animation produced")
        return
    crop = None
    if PANE and RESTORE.get("viewport"):
        vw, vh = json.loads(RESTORE["viewport"])
        size = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                               "-show_entries", "stream=width,height", "-of", "csv=p=0", str(frames[0])],
                              capture_output=True, text=True).stdout.strip().split(",")
        try:
            fw = int(size[0])
        except (ValueError, IndexError):
            fw = vw
        k = fw / vw if vw else 1.0
        crop = "crop={}:{}:{}:{}".format(
            max(2, round(PANE["width"] * k) // 2 * 2), max(2, round(PANE["height"] * k) // 2 * 2),
            round(PANE["x"] * k), round(PANE["y"] * k))
        print(f"  crop: {crop} (frame {fw}px vs viewport {vw}px)")
    ANIM.mkdir(parents=True, exist_ok=True)
    gif = ANIM / f"{PLUGIN}.gif"
    mp4 = ANIM / f"{PLUGIN}.mp4"
    palette = FRAMES / "palette.png"
    pattern = str(FRAMES / "frame-%05d.jpg")
    scale = f"scale={ANIM_WIDTH}:-2:flags=lanczos"
    pre = f"{crop}," if crop else ""
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(ANIM_FPS), "-i", pattern,
                    "-vf", f"{pre}{scale},palettegen=max_colors=128:stats_mode=diff", str(palette)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(ANIM_FPS), "-i", pattern,
                    "-i", str(palette), "-lavfi", f"{pre}{scale}[x];[x][1:v]paletteuse", str(gif)], check=True)
    print(f"  ✓ {gif.relative_to(REPO)}  ({gif.stat().st_size // 1024} kB, {len(frames)} frames, {ANIM_FPS} fps)")
    # MP4 as well: easier to review than a GIF, and what a release page embeds.
    try:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(ANIM_FPS), "-i", pattern,
                        "-vf", f"{pre}scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264",
                        "-pix_fmt", "yuv420p", "-crf", "20", str(mp4)], check=True)
        print(f"  ✓ {mp4.relative_to(REPO)}  ({mp4.stat().st_size // 1024} kB)")
    except subprocess.CalledProcessError as exc:
        print(f"  (no MP4: {exc})")


async def restore_profile(ui: Desktop):
    """Put the tracking profile's weights back the way the run found them.

    The scenario saves real changes (that is the point: the ranking has to move), so
    the profile must be handed back untouched — same values, same order.
    """
    if not RESTORE.get("weights"):
        return
    if await open_criteria(ui):
        await set_weights_by_index(ui, RESTORE["weights"])
        await asyncio.sleep(1.0)
        if await save_criteria(ui):
            print("  profile weights restored")
        await asyncio.sleep(1.0)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=int(os.environ.get("HERMES_CDP_PORT", "9222")))
    ap.add_argument("--no-gif", action="store_true")
    ap.add_argument("--keep-open", action="store_true", help="leave the plugin page open at the end")
    args = ap.parse_args()

    ui = Desktop(args.port)
    page = await ui.open()
    print(f"attached: {page.get('title')} ({args.port})")
    try:
        await ensure_english(ui)
        await ensure_local_gateway(ui)
        await collapse_private_sections(ui)
        RESTORE["sidebar"] = await resize_sidebar(ui)
        await reset_view_state(ui)
        await open_plugin(ui)
        await select_profile(ui)
        await pane_clip(ui)
        await run_scenario(ui, make_gif=not args.no_gif)
    finally:
        if ui.screencasting:
            await ui.stop_screencast()
            ui.screencasting = False
        # Put the shell back the way the run found it.
        try:
            if RESTORE.get("sidebar"):
                await resize_sidebar(ui, int(RESTORE["sidebar"]))
        except Exception as exc:
            print(f"  ! could not restore the sidebar: {exc}")
        try:
            await restore_profile(ui)
        except Exception as exc:
            print(f"  ! could not restore the profile weights: {exc}")
        if not args.no_gif:
            try:
                encode_animation()
            except Exception as exc:
                print(f"  ! animation not encoded: {exc}")
        if not args.keep_open:
            await ui.close()
    print("done")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Dead as exc:
        print(f"\nSTOP: {exc}\n", file=sys.stderr)
        sys.exit(1)
