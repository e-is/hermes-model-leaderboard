#!/usr/bin/env python3
"""Render the catalogue card for model-leaderboard as a 2:1 PNG.

Same approach as hermes-kanban-gantt's card: the card is DRAWN in HTML/CSS (plus a
little inline SVG for the plot) and rasterised with the Chromium Hermes already ships —
no image model, no desktop, no CDP port, so it runs anywhere and a tweak of the wording
or the palette is one line of code.

    python3 scripts/card.py --variant podium          # -> assets/card-podium.png
    python3 scripts/card.py --all                     # every alternative + a comparison page
    python3 scripts/card.py --variant bars --out /tmp/x.png --scale 1 --keep-html

`podium` is the card that ships: the three-step podium on the left, the quality / cost
Pareto picture on the right. The other variants stay available as alternatives.

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
BLUE, GREEN, PURPLE = "#4a84fe", "#3fb950", "#a371f7"
GOLD, SILVER, BRONZE = "#e8b500", "#b8c2cc", "#c07a3a"
MONO = 'ui-monospace, "JetBrains Mono", "Cascadia Mono", "DejaVu Sans Mono", monospace'
WIDTH, HEIGHT = 1280, 640

TITLE = "model<span class='dash'>-</span>leaderboard"
TAGLINE = "Which model for <b class='hi'>this profile</b>? Prices, indices, and a rank that answers"
SPECS = [
    "track any OpenRouter model — add your own",
    "6 score views · Pareto frontier",
    "curated SWE-bench · LiveCodeBench",
    "news panel · new models, price drops &amp; promos",
]

# The podium's numbers come from a real capture run (assets/screenshot-en-01-models.png),
# so the card cannot advertise a ranking the plugin does not produce.
PODIUM = [
    ("deepseek-v4-flash-1.1", "90", "$0.15 / $0.60"),
    ("gemini-4-orion", "92", "$2.00 / $10.00"),
    ("gemini-3.8-flash", "88", "$0.82 / $4.13"),
]
#: The unit lives in the podium note, not on every step: at 176px wide the price line
#: wrapped, and "… · $/M tk" landing on a second line reads as a defect.
PRICE_UNIT = "$/M tokens · in / out"

BARS = [
    ("gemini-4-orion", 92, "$2.00 / $10.00", "gold"),
    ("deepseek-v4-flash-1.1", 90, "$0.15 / $0.60", "silver"),
    ("gemini-3.8-flash", 88, "$0.82 / $4.13", "bronze"),
    ("gemini-3.7-flash", 87, "$0.75 / $3.75", ""),
    ("glm-5.3", 86, "$0.08 / $1.40", ""),
]

#: The plot is ZOOMED on purpose: the frontier models all live in the top band, and a
#: 0–100 quality axis spent half the box on empty space below the dashed line.
POINTS = [  # (name, cost %, quality %, on the frontier)
    ("glm-5.3", 10, 71, True),
    ("gemini-3.8-flash", 46, 86, True),
    ("gemini-4-orion", 74, 95, True),
    # Deliberate filler BELOW the line — without dominated models a "frontier" is just a
    # line through every dot, and the picture says nothing.
    ("kimi-k3", 8, 58, False),
    ("deepseek-v4-flash-1.1", 20, 63, False),
    ("mistral-large-3", 54, 77, False),
    ("claude-opus-5", 96, 85, False),
]
Y_MIN, Y_MAX = 50, 100      # the quality window the card shows (zoom)
X_MIN, X_MAX = 0, 100       # the cost window


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
  h1 {{ font-size:56px; line-height:1.04; font-weight:700; letter-spacing:-1.2px; color:#dfe6ee; margin-top:8px; }}
  h1 .dash {{ color:{BLUE}; }}
  .tag {{ margin-top:9px; font-size:18px; color:{MUTED}; }}
  .tag b {{ color:{FG}; font-weight:600; }}
  .tag b.hi {{ color:{BLUE}; font-weight:700; }}   /* the phrase the card is about */
  .specs {{ position:absolute; top:46px; right:56px; text-align:right; font-size:13px;
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


# ── the podium ──────────────────────────────────────────────────────────────
#: Each step is absolutely placed: a flex row with per-item heights kept getting
#: squeezed, and a catalogue card is not the place to debug the cross axis. Borders are
#: 2px and lightened on purpose — at 1px the steps read as shading, not as steps.
PODIUM_CSS = f"""
  .podium {{ position:absolute; left:56px; bottom:0; width:604px; height:344px; }}
  .plinth {{ position:absolute; left:0; width:604px; bottom:0; height:3px;
             background:linear-gradient(90deg, transparent, {BORDER} 14%, {BORDER} 86%, transparent); }}
  .step {{ position:absolute; bottom:0; width:176px; border:2px solid #4a5461; border-bottom:none;
           border-radius:12px 12px 0 0; background:linear-gradient(180deg, #1d242e, #121821);
           display:flex; flex-direction:column; align-items:center;
           padding:50px 10px 0;
           box-shadow:0 -12px 34px rgba(0,0,0,.45) inset, 0 0 0 1px rgba(255,255,255,.05); }}
  .step.one {{ left:198px; height:300px; border-color:{GOLD};
               background:linear-gradient(180deg, #2c2413, #17130a);
               box-shadow:0 -12px 34px rgba(0,0,0,.4) inset, 0 0 30px rgba(232,181,0,.25); }}
  .step.two {{ left:0; height:222px; }}
  .step.three {{ left:396px; height:158px; }}
  .name {{ font-size:13.5px; color:{FG}; font-weight:600; text-align:center; line-height:1.25; }}
  .score {{ margin-top:6px; font-size:24px; font-weight:700; color:{FG}; }}
  .score span {{ font-size:12px; color:{MUTED}; font-weight:400; }}
  .price {{ margin-top:4px; font-size:11.5px; color:{MUTED}; }}
  .medal {{ position:absolute; top:-30px; left:50%; transform:translateX(-50%);
            width:52px; height:52px; border-radius:50%;
            background:radial-gradient(circle at 34% 28%, #fff6c2, {GOLD} 58%, #7a5a00);
            border:2px solid #f7dc7a; display:flex; align-items:center; justify-content:center;
            font-size:21px; font-weight:700; color:#3a2c00; box-shadow:0 8px 22px rgba(232,181,0,.45); }}
  .ribbon {{ position:absolute; top:-52px; left:50%; width:24px; height:28px; transform:translateX(-50%); }}
  .ribbon::before, .ribbon::after {{ content:''; position:absolute; top:0; width:11px; height:26px;
            background:linear-gradient(180deg, {BLUE}, #2b5fd0); }}
  .ribbon::before {{ left:0; transform:skewX(-14deg); }}
  .ribbon::after {{ right:0; transform:skewX(14deg); }}
  .podium-note {{ position:absolute; left:56px; bottom:352px; font-size:12.5px; color:{MUTED}; }}
"""
# NOTE: `.podium-note` is a SIBLING of `.podium`, so its containing block is the card's
# padding box — `left:0` put it flush against the trimmed edge (the first letter was cut).
# 56px is the card margin the headline and the install line use.


def podium_body() -> str:
    order = [("two", PODIUM[0]), ("one", PODIUM[1]), ("three", PODIUM[2])]
    steps = []
    for cls, (name, score, price) in order:
        if cls == "one":
            medal = '<div class="ribbon"></div><div class="medal">1</div>'
        else:
            shell_c = SILVER if cls == "two" else BRONZE
            edge = "#d8dee4" if cls == "two" else "#d59a5e"
            medal = (f'<div class="medal" style="background:radial-gradient(circle at 34% 28%,#fff,'
                     f'{shell_c} 58%,#4b4b4b); border-color:{edge}; color:#2b2b2b">'
                     f'{"2" if cls == "two" else "3"}</div>')
        steps.append(f"""
      <div class="step {cls}">
        {medal}
        <div class="name">{_html.escape(name)}</div>
        <div class="score">{score}<span>/100</span></div>
        <div class="price">{price}</div>
      </div>""")
    return (f'<div class="podium-note">Ranking — profile <b>default</b> · {PRICE_UNIT}</div>\n'
            f'  <div class="podium"><div class="plinth"></div>{"".join(steps)}</div>')


# ── the quality / cost picture ──────────────────────────────────────────────
PLOT_CSS = f"""
  .plot {{ position:absolute; border:1px solid {BORDER}; border-radius:10px; background:{PANEL}; }}
  .plot svg {{ display:block; }}
  .legend {{ position:absolute; right:12px; top:9px; font-size:11px; color:{MUTED}; text-align:right; }}
  .legend b {{ color:{GOLD}; }}
  .axis {{ position:absolute; font-size:11.5px; color:{MUTED}; }}
"""


def plot_body(*, left: int, right: int, bottom: int, height: int) -> str:
    """The scatter and its dashed Pareto frontier, drawn as inline SVG.

    SVG rather than absolutely-positioned divs: the frontier is a sloped dashed line, and
    a dashed border on a rotated div stretches its dashes with the box. Here the geometry
    is computed in pixels from the box size the caller asked for, over the zoomed
    Y_MIN..Y_MAX / X_MIN..X_MAX window.
    """
    width = WIDTH - left - right
    pad_l, pad_r, pad_t, pad_b = 56, 22, 34, 32
    inner_w, inner_h = width - pad_l - pad_r, height - pad_t - pad_b

    def px(cost: float, qual: float) -> tuple[float, float]:
        return (pad_l + (cost - X_MIN) / (X_MAX - X_MIN) * inner_w,
                height - pad_b - (qual - Y_MIN) / (Y_MAX - Y_MIN) * inner_h)

    frontier = sorted(((n, *px(c, q)) for n, c, q, on in POINTS if on), key=lambda t: t[1])
    dominated = [(n, *px(c, q)) for n, c, q, on in POINTS if not on]

    grid = "".join(
        f'<line x1="{pad_l}" y1="{height - pad_b - i * inner_h / 3:.1f}" x2="{width - pad_r}" '
        f'y2="{height - pad_b - i * inner_h / 3:.1f}" stroke="{BORDER}" stroke-width="1" '
        f'stroke-dasharray="2 6" opacity=".5"/>' for i in range(1, 3))
    line = " ".join(f"{x:.1f},{y:.1f}" for _n, x, y in frontier)

    dots = "".join(
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="10" fill="{GOLD}" opacity=".14"/>'
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="{GOLD}"/>' for _n, x, y in frontier)
    dots += "".join(
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="{MUTED}" opacity=".85"/>'
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="8" fill="none" stroke="{MUTED}" '
        f'stroke-width="1" opacity=".35"/>' for _n, x, y in dominated)

    def label(name: str, x: float, y: float, *, big: bool) -> str:
        # frontier names sit UNDER their dot: above it, the dashed line to the next point
        # crosses the text (the line climbs to the right). The filler names go under theirs
        # too, pushed to the side that has room, so no two labels collide.
        if big:
            dy, anchor, dx = (26, "middle", 0)
            size, colour = 13.5, FG
        else:
            dy, size, colour = 20, 11.5, MUTED
            anchor, dx = ("end", -10) if x > width / 2 else ("start", 10)
        return (f'<text x="{x + dx:.1f}" y="{y + dy:.1f}" fill="{colour}" font-size="{size}" '
                f'font-family="{MONO}" text-anchor="{anchor}">{_html.escape(name)}</text>')

    labels = "".join(label(n, x, y, big=True) for n, x, y in frontier)
    labels += "".join(label(n, x, y, big=False) for n, x, y in dominated)

    return f"""<div class="plot" style="left:{left}px;right:{right}px;bottom:{bottom}px;height:{height}px">
    <div class="legend">◆ <b>frontier (Pareto)</b> · ◇ dominated</div>
    <div class="axis" style="left:12px; top:8px">quality ({Y_MIN}–{Y_MAX})</div>
    <div class="axis" style="right:12px; bottom:6px">weighted cost ($/M tokens, log)</div>
    <svg width="{width}" height="{height}">
      {grid}
      <polyline points="{line}" fill="none" stroke="{GOLD}" stroke-width="2.5" stroke-dasharray="8 6"/>
      {dots}
      {labels}
    </svg>
  </div>"""


# ── the ranked-rows alternative ─────────────────────────────────────────────
BARS_CSS = f"""
  .rows {{ position:absolute; left:56px; right:56px; bottom:18px; }}
  .row {{ display:grid; grid-template-columns:46px 300px 1fr 150px; align-items:center;
          height:54px; border-bottom:1px solid {BORDER}; }}
  .row:last-child {{ border-bottom:none; }}
  .disc {{ width:30px; height:30px; border-radius:50%; display:flex; align-items:center;
           justify-content:center; font-size:14px; font-weight:700; color:#2b2b2b; background:{SILVER}; }}
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
"""


def bars_body() -> str:
    rows = []
    for i, (name, score, price, medal) in enumerate(BARS, start=1):
        rows.append(f"""
      <div class="row">
        <div class="disc {medal or 'plain'}">{i}</div>
        <div class="label">{_html.escape(name)}<small>{price} · $/M tk</small></div>
        <div class="track"><span class="fill" style="width:{score}%"></span></div>
        <div class="score">{score}<span>/100</span></div>
      </div>""")
    return f"""<div class="rows">{''.join(rows)}</div>"""


# ── assembling the variants ─────────────────────────────────────────────────
def podium_card_body() -> str:
    """The shipped card: podium on the left, the Pareto picture on the right."""
    return podium_body() + plot_body(left=700, right=48, bottom=26, height=318)


def scatter_card_body() -> str:
    """The plot alone, full width."""
    return plot_body(left=56, right=56, bottom=18, height=300)


VARIANTS = {
    "podium": (PODIUM_CSS + PLOT_CSS, podium_card_body,
               "Podium on the left, quality / cost Pareto on the right (the card)"),
    "podium-light": (PODIUM_CSS + PLOT_CSS, podium_card_body,
                     "The same card on a light background"),
    "bars": (BARS_CSS, bars_body, "Ranked rows with gold/silver/bronze discs and score bars"),
    "scatter": (PLOT_CSS, scatter_card_body, "The Quality / cost view alone, full width"),
}

#: Palette swap for the `-light` variants: same drawing, catalogue-friendly colours.
LIGHT = {
    BG: "#f6f7f9", PANEL: "#ffffff", PANEL2: "#eef1f5", GRID: "rgba(0,0,0,.035)",
    FG: "#1f2328", MUTED: "#59636e", BORDER: "#d8dee4", "#dfe6ee": "#1f2328",
    "#1d242e": "#ffffff", "#121821": "#eef1f5", "#4a5461": "#c8d0d9",
    "#2c2413": "#fdf3d8", "#17130a": "#fbf1d6", "#3a2c00": "#5a4400",
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
    # The headless viewport comes out SHORTER than --window-size (measured: 497 CSS px for
    # a 640px window — the missing strip cut the bottom step off the podium), so ask for a
    # taller window and keep the top-left WIDTH*HEIGHT of the result.
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
        # No PIL: there is no way to crop, so render again at 1x with a window tall enough
        # for the viewport to cover the whole card.
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
