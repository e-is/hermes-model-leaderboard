#!/usr/bin/env python3
"""Render the catalogue card for model-leaderboard as a 2:1 PNG.

Same approach as hermes-kanban-gantt's card: the card is DRAWN in HTML/CSS and
rasterised with the Chromium Hermes already ships — no image model, no desktop, no
CDP port, so it runs anywhere and one tweak of the wording or the palette is one line
of code.

    python3 scripts/card.py --variant podium          # -> assets/card-podium.png
    python3 scripts/card.py --all                     # every alternative
    python3 scripts/card.py --variant bars --out /tmp/x.png --scale 1 --keep-html

The alternatives are meant to be compared side by side (see assets/card-alternatives.html,
written by --all): pick one, then it becomes the catalogue card.

Format: the catalogue's entries are 2:1 banners (measured on four of them: 1600x800,
1280x640, 1200x600) — so 1280x640, rendered at 2x and downscaled for crisp text.
"""

from __future__ import annotations

import argparse
import glob
import html as _html
import os
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / "assets"
MANIFEST = REPO / "plugin.yaml"

PACKAGE = "model-leaderboard"

# ── the look (shared by every variant) ───────────────────────────────────────
BG, PANEL, PANEL2, GRID = "#0d1117", "#11161d", "#161b22", "rgba(255,255,255,.035)"
FG, MUTED, BORDER = "#e6edf3", "#8b949e", "#30363d"
BLUE, GREEN, AMBER, PURPLE = "#4a84fe", "#3fb950", "#d29922", "#a371f7"
GOLD, SILVER, BRONZE = "#e8b500", "#b8c2cc", "#c07a3a"
MONO = 'ui-monospace, "JetBrains Mono", "Cascadia Mono", "DejaVu Sans Mono", monospace'
WIDTH, HEIGHT = 1280, 640

TITLE = "model<span class='dash'>-</span>leaderboard"
TAGLINE = "Which model for <b>this</b> profile? Prices, indices, and a rank that answers"
SPECS = [
    "OpenRouter · 23 tracked models",
    "6 score views · Pareto frontier",
    "curated SWE-bench · LiveCodeBench",
    "ctx.llm auto-fill · <span class='hl'>no API keys</span>",
]

# The podium's numbers come from a real capture run (docs/screenshot-en-01-models.png),
# so the card cannot advertise a ranking the plugin does not produce.
PODIUM = [
    ("deepseek-v4-flash-1.1", "90", "$0.15 / $0.60"),
    ("gemini-4-orion", "92", "$2.00 / $10.00"),
    ("gemini-3.8-flash", "88", "$0.82 / $4.13"),
]
BARS = [
    ("gemini-4-orion", 92, "$2.00 / $10.00", "gold"),
    ("deepseek-v4-flash-1.1", 90, "$0.15 / $0.60", "silver"),
    ("gemini-3.8-flash", 88, "$0.82 / $4.13", "bronze"),
    ("gemini-3.7-flash", 87, "$0.75 / $3.75", ""),
    ("glm-5.3", 86, "$0.08 / $1.40", ""),
]

# x = cost ($/M tk, log-ish), y = quality — the Pareto picture, plotted by hand
SCATTER = [
    ("gemini-4-orion", 66, 22, True), ("deepseek-v4-flash-1.1", 20, 30, True),
    ("gemini-3.8-flash", 46, 40, True), ("gemini-3.7-flash", 41, 52, False),
    ("glm-5.3", 12, 58, True), ("claude-opus-5", 88, 78, False),
    ("qwen3-235b-a22b", 30, 66, False), ("kimi-k3", 14, 72, False),
]
FRONTIER = [0.62, 0.34, 0.26, 0.10]   # cost fractions the dashed line passes through


def version() -> str:
    """`version:` from plugin.yaml, so the card cannot drift from the release."""
    try:
        m = re.search(r'^version:\s*["\']?([^"\'\n]+)', MANIFEST.read_text(encoding="utf-8"), re.M)
        return m.group(1).strip() if m else ""
    except OSError:
        return ""


def shell(body: str, *, extra_css: str = "") -> str:
    specs = "<br>\n      ".join(SPECS)
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>model-leaderboard catalogue card</title><style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  html,body {{ width:{WIDTH}px; height:{HEIGHT}px; }}
  body {{
    background:{BG}; color:{FG}; font-family:{MONO}; overflow:hidden;
    background-image:
      linear-gradient(to right, {GRID} 1px, transparent 1px),
      linear-gradient(to bottom, {GRID} 1px, transparent 1px);
    background-size:40px 40px, 40px 40px;
  }}
  .card {{ position:relative; width:{WIDTH}px; height:{HEIGHT}px; padding:44px 56px 0; }}
  .cmd {{ font-size:15px; color:{MUTED}; }}
  .cmd b {{ color:{GREEN}; font-weight:600; }}
  h1 {{ font-size:64px; line-height:1.04; font-weight:700; letter-spacing:-1.5px; color:#dfe6ee; margin-top:10px; }}
  h1 .dash {{ color:{BLUE}; }}
  .tag {{ margin-top:10px; font-size:19px; color:{MUTED}; }}
  .tag b {{ color:{FG}; font-weight:600; }}
  .specs {{ position:absolute; top:46px; right:56px; text-align:right; font-size:13.5px;
            color:{MUTED}; line-height:1.9; white-space:nowrap; }}
  .specs .hl {{ color:{BLUE}; }}
  .ver {{ position:absolute; top:14px; right:56px; font-size:12px; color:#6e7681; letter-spacing:.5px; }}
  {extra_css}
</style></head>
<body><div class="card">
  <div class="ver">v{version()}</div>
  <div class="cmd">$ hermes plugins install <b>{PACKAGE}</b></div>
  <h1>{TITLE}</h1>
  <div class="tag">{TAGLINE}</div>
  <div class="specs">
      {specs}
  </div>
  {body}
</div></body></html>
"""


# ── variant 1: the podium, gold medal on the top step ───────────────────────
PODIUM_CSS = f"""
  /* Each step is absolutely placed: a flex row with per-item heights kept getting
     squeezed, and a catalogue card is not the place to debug the cross axis. */
  .podium {{ position:absolute; left:56px; right:56px; bottom:0; height:320px; }}
  .step {{ position:absolute; bottom:0; width:236px; border:1px solid {BORDER}; border-bottom:none;
           border-radius:10px 10px 0 0; background:linear-gradient(180deg, {PANEL2}, {PANEL});
           display:flex; flex-direction:column; align-items:center;
           padding:52px 14px 0; box-shadow:0 -10px 30px rgba(0,0,0,.35) inset; }}
  .step.one {{ left:465px; height:300px; border-color:{GOLD}55; background:linear-gradient(180deg, #1d1a10, {PANEL}); }}
  .step.two {{ left:207px; height:216px; }}
  .step.three {{ left:723px; height:150px; }}
  .name {{ font-size:15.5px; color:{FG}; font-weight:600; text-align:center; line-height:1.25; }}
  .score {{ margin-top:7px; font-size:26px; font-weight:700; color:{FG}; }}
  .score span {{ font-size:13px; color:{MUTED}; font-weight:400; }}
  .price {{ margin-top:5px; font-size:12.5px; color:{MUTED}; }}
  .medal {{ position:absolute; top:-34px; left:50%; transform:translateX(-50%);
            width:58px; height:58px; border-radius:50%;
            background:radial-gradient(circle at 34% 28%, #fff6c2, {GOLD} 58%, #7a5a00);
            border:2px solid #f7dc7a; display:flex; align-items:center; justify-content:center;
            font-size:23px; font-weight:700; color:#3a2c00;
            box-shadow:0 8px 22px rgba(232,181,0,.42); }}
  .ribbon {{ position:absolute; top:-58px; left:50%; width:26px; height:30px; transform:translateX(-50%); }}
  .ribbon::before, .ribbon::after {{ content:''; position:absolute; top:0; width:12px; height:28px;
            background:linear-gradient(180deg, {BLUE}, #2b5fd0); }}
  .ribbon::before {{ left:0; transform:skewX(-14deg); }}
  .ribbon::after {{ right:0; transform:skewX(14deg); }}
  .podium-note {{ position:absolute; left:56px; bottom:330px; font-size:12.5px; color:{MUTED}; }}
"""


def podium_body() -> str:
    order = [("two", PODIUM[0]), ("one", PODIUM[1]), ("three", PODIUM[2])]
    steps = []
    for cls, (name, score, price) in order:
        medal = ('<div class="ribbon"></div><div class="medal">1</div>' if cls == "one"
                 else f'<div class="medal" style="background:radial-gradient(circle at 34% 28%,#fff,'
                      f'{"#b8c2cc" if cls == "two" else "#c07a3a"} 58%,#4b4b4b);'
                      f'border-color:{"#d8dee4" if cls == "two" else "#d59a5e"};color:#2b2b2b">'
                      f'{"2" if cls == "two" else "3"}</div>')
        steps.append(f"""
      <div class="step {cls}">
        {medal}
        <div class="name">{_html.escape(name)}</div>
        <div class="score">{score}<span>/100</span></div>
        <div class="price">{price} · $/M tk</div>
      </div>""")
    return f"""<div class="podium-note">Ranking — profile <b>default</b>, weights tuned in the criteria dialog</div>
  <div class="podium">{''.join(steps)}</div>"""


# ── variant 2: ranked rows with medals and score bars ───────────────────────
BARS_CSS = f"""
  .rows {{ position:absolute; left:56px; right:56px; bottom:18px; }}
  .row {{ display:grid; grid-template-columns:46px 300px 1fr 150px; align-items:center;
          height:54px; border-bottom:1px solid {BORDER}; }}
  .row:last-child {{ border-bottom:none; }}
  .disc {{ width:30px; height:30px; border-radius:50%; display:flex; align-items:center;
           justify-content:center; font-size:14px; font-weight:700; color:#2b2b2b;
           background:{SILVER}; }}
  .disc.gold {{ background:radial-gradient(circle at 34% 28%, #fff6c2, {GOLD} 60%, #7a5a00);
                color:#3a2c00; width:38px; height:38px; font-size:16px;
                box-shadow:0 6px 18px rgba(232,181,0,.4); }}
  .disc.silver {{ background:radial-gradient(circle at 34% 28%, #fff, {SILVER} 60%, #6b737b); }}
  .disc.bronze {{ background:radial-gradient(circle at 34% 28%, #f6d3ae, {BRONZE} 60%, #6d4118); color:#2b1a08; }}
  .disc.plain {{ background:{PANEL2}; color:{MUTED}; border:1px solid {BORDER}; font-weight:400; }}
  .label {{ font-size:15.5px; color:{FG}; }}
  .label small {{ display:block; font-size:12px; color:{MUTED}; margin-top:2px; }}
  .track {{ position:relative; height:16px; border-radius:4px; background:{PANEL}; margin:0 18px; }}
  .fill {{ position:absolute; left:0; top:0; bottom:0; border-radius:4px;
           background:linear-gradient(90deg, {BLUE}, {PURPLE}); }}
  .score {{ text-align:right; font-size:17px; font-weight:600; color:{FG}; }}
  .score span {{ font-size:12px; color:{MUTED}; font-weight:400; }}
  .price {{ grid-column:4; text-align:right; font-size:12px; color:{MUTED}; margin-top:-14px; }}
"""


def bars_body() -> str:
    rows = []
    for i, (name, score, price, medal) in enumerate(BARS, start=1):
        cls = medal or "plain"
        rows.append(f"""
      <div class="row">
        <div class="disc {cls}">{i}</div>
        <div class="label">{_html.escape(name)}<small>{price} · $/M tk</small></div>
        <div class="track"><span class="fill" style="width:{score}%"></span></div>
        <div class="score">{score}<span>/100</span></div>
      </div>""")
    return f"""<div class="rows">{''.join(rows)}</div>"""


# ── variant 3: the quality / cost scatter with its Pareto frontier ──────────
SCATTER_CSS = f"""
  .plot {{ position:absolute; left:56px; right:56px; bottom:18px; height:268px;
           border:1px solid {BORDER}; border-radius:10px; background:{PANEL}; }}
  .axis {{ position:absolute; font-size:12.5px; color:{MUTED}; }}
  .dot {{ position:absolute; width:12px; height:12px; border-radius:50%;
          background:{BLUE}; box-shadow:0 0 0 4px rgba(74,132,254,.16); transform:translate(-50%,-50%); }}
  .dot.front {{ background:{GOLD}; box-shadow:0 0 0 5px rgba(232,181,0,.2); width:15px; height:15px; }}
  .tag {{ position:absolute; font-size:11.5px; color:{FG}; transform:translate(-50%,-50%);
          white-space:nowrap; background:{BG}; padding:1px 5px; border-radius:4px; border:1px solid {BORDER}; }}
  .dash {{ position:absolute; height:2px; border-top:2px dashed {GOLD}99; transform-origin:left center; }}
  .legend {{ position:absolute; right:12px; top:10px; font-size:12px; color:{MUTED}; text-align:right; }}
  .legend b {{ color:{GOLD}; }}
"""


def scatter_body() -> str:
    dots = []
    for name, x, y, front in SCATTER:
        # a label above a high dot would leave the plot box and sit over the tagline:
        # the top-most points get theirs below instead
        below = y >= 78
        pos = f"top:{100 - y + 6}%" if below else f"bottom:{y + 7}%"
        dots.append(f'<div class="dot{" front" if front else ""}" style="left:{x}%;bottom:{y}%"></div>')
        dots.append(f'<div class="tag" style="left:{x}%;{pos}">{_html.escape(name)}</div>')
    # the frontier: one straight-lit segment per pair (kept simple on purpose — the
    # card is a poster, the plugin draws the real line)
    lines = []
    pts = [(0, 8, 62), (62, 34, 26), (26, 10, 10)]
    for x1, y1, x2 in pts:
        lines.append(f'<div class="dash" style="left:{x1}%;bottom:{y1}%;width:{max(4, x2 - x1)}%"></div>')
    return f"""<div class="plot">
    <div class="legend">◆ <b>best trade-offs</b> (Pareto)<br>◆ dominated</div>
    <div class="axis" style="left:12px; top:8px">quality (0–100)</div>
    <div class="axis" style="right:12px; bottom:8px">weighted cost ($/M tk, log)</div>
    {''.join(dots)}
  </div>"""


VARIANTS = {
    "podium": (PODIUM_CSS, podium_body, "Three-step podium, gold medal on the top step (the ask)"),
    "podium-light": (PODIUM_CSS, podium_body, "The same podium on a light background"),
    "bars": (BARS_CSS, bars_body, "Ranked rows with gold/silver/bronze discs and score bars"),
    "scatter": (SCATTER_CSS, scatter_body, "The Quality / cost view: Pareto frontier on a log cost axis"),
}

#: Palette swap for the `-light` variants: same drawing, catalogue-friendly colours.
LIGHT = {
    BG: "#f6f7f9", PANEL: "#ffffff", PANEL2: "#eef1f5", GRID: "rgba(0,0,0,.035)",
    FG: "#1f2328", MUTED: "#59636e", BORDER: "#d8dee4", "#dfe6ee": "#1f2328",
    "#1d1a10": "#fdf3d8", "#3a2c00": "#5a4400",
}


def lighten(page: str) -> str:
    for dark, light in LIGHT.items():
        page = page.replace(dark, light)
    return page


def find_chrome() -> str:
    """Hermes ships a Chromium; fall back to the system's."""
    cands: list[str] = [os.environ.get("HERMES_CHROME", ""), os.environ.get("CHROME_PATH", "")]
    try:
        sys.path.insert(0, str(Path.home() / ".hermes" / "hermes-agent"))
        from hermes_cli.browser_runtime import chromium_executable  # type: ignore
        cands.append(chromium_executable(allow_override=False) or "")
    except Exception:
        pass
    cands += sorted(glob.glob(str(Path.home() / ".hermes" / "tools" / "chromium-*" / "chrome-linux64" / "chrome")))
    cands += ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]
    for c in cands:
        if c and os.access(c, os.X_OK):
            return c
    raise SystemExit("card: no Chromium found — set HERMES_CHROME to one")


def render(variant: str, out: Path, scale: int, keep_html: bool) -> Path:
    css, body, _desc = VARIANTS[variant]
    page = shell(body(), extra_css=css)
    chrome = find_chrome()
    html_path = out.with_suffix(".html")
    html_path.parent.mkdir(parents=True, exist_ok=True)
    html_path.write_text(lighten(page) if variant.endswith("-light") else page, encoding="utf-8")

    raw = html_path.with_name(html_path.stem + f"@{scale}x.png")
    # The headless viewport comes out SHORTER than --window-size (measured: 497 CSS px
    # for a 640px window — the missing strip cut the bottom steps off the podium), so
    # ask for a taller window and keep the top-left WIDTH*HEIGHT of the result.
    win_h = HEIGHT + 260
    subprocess.run([chrome, "--headless=new", "--no-sandbox", "--hide-scrollbars",
                    f"--force-device-scale-factor={scale}", f"--window-size={WIDTH},{win_h}",
                    f"--screenshot={raw}", f"file://{html_path}"],
                   check=True, capture_output=True, timeout=180)

    try:
        from PIL import Image
        resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS", 1)
        im = Image.open(raw).convert("RGB")
        im = im.crop((0, 0, min(im.width, WIDTH * scale), min(im.height, HEIGHT * scale)))
        im.resize((WIDTH, HEIGHT), resample).save(out, "PNG", optimize=True)
        raw.unlink()
    except ImportError:
        # No PIL: there is no way to crop, so render again at 1x with a window tall
        # enough for the viewport to cover the whole card.
        print("card: no PIL — re-rendering at scale 1 (window padded for the viewport)")
        subprocess.run([chrome, "--headless=new", "--no-sandbox", "--hide-scrollbars",
                        "--force-device-scale-factor=1", f"--window-size={WIDTH},{win_h}",
                        f"--screenshot={out}", f"file://{html_path}"],
                       check=True, capture_output=True, timeout=180)
        raw.unlink(missing_ok=True)
    if not keep_html:
        html_path.unlink(missing_ok=True)
    return out


def write_gallery(paths: dict[str, Path]) -> Path:
    """A one-page comparison of the alternatives, for picking one."""
    cards = "\n".join(
        f'<figure><img src="{p.name}" alt="{v}"><figcaption><b>{v}</b> — {VARIANTS[v][2]}</figcaption></figure>'
        for v, p in paths.items())
    page = ASSETS / "card-alternatives.html"
    page.write_text(f"""<!doctype html>
<html><head><meta charset="utf-8"><title>model-leaderboard — catalogue card alternatives</title>
<style>
  body {{ background:#0d1117; color:#e6edf3; font-family:{MONO}; margin:0; padding:32px; }}
  h1 {{ font-size:20px; font-weight:600; margin-bottom:6px; }}
  p {{ color:#8b949e; font-size:13px; margin-bottom:24px; }}
  figure {{ margin:0 0 32px; }}
  img {{ width:100%; max-width:1024px; border:1px solid #30363d; border-radius:10px; display:block; }}
  figcaption {{ font-size:13px; color:#8b949e; margin-top:8px; }}
  figcaption b {{ color:#e6edf3; }}
</style></head>
<body>
  <h1>model-leaderboard — catalogue card alternatives</h1>
  <p>Generated by <code>python3 scripts/card.py --all</code>. Pick one; it becomes the catalogue card.</p>
  {cards}
</body></html>
""", encoding="utf-8")
    return page


def main() -> int:
    ap = argparse.ArgumentParser(description="Render the model-leaderboard catalogue card (2:1 PNG).")
    ap.add_argument("--variant", choices=sorted(VARIANTS), default="podium")
    ap.add_argument("--all", action="store_true", help="render every alternative + the comparison page")
    ap.add_argument("--out", help="output PNG (single variant)")
    ap.add_argument("--scale", type=int, default=2)
    ap.add_argument("--keep-html", action="store_true", help="keep the HTML source next to the PNG")
    args = ap.parse_args()

    if args.all:
        made = {v: render(v, ASSETS / f"card-{v}.png", args.scale, args.keep_html) for v in VARIANTS}
        page = write_gallery(made)
        for v, p in made.items():
            print(f"card: {p.relative_to(REPO)}  — {VARIANTS[v][2]}")
        print(f"card: {page.relative_to(REPO)}  (compare them in a browser)")
        return 0

    out = Path(args.out) if args.out else ASSETS / f"card-{args.variant}.png"
    path = render(args.variant, out, args.scale, args.keep_html)
    print(f"card: {path.relative_to(REPO) if str(path).startswith(str(REPO)) else path}  "
          f"({WIDTH}x{HEIGHT}, scale {args.scale}, variant {args.variant})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
