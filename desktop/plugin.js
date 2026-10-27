/*
 * Hermes Model Leaderboard — desktop renderer (BUILD ARTIFACT).
 * Source of truth: src/ — run `npm run build` after editing.
 */

// src/main.tsx
import {
  host,
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA
} from "@hermes/plugin-sdk";

// src/LeaderboardPage.tsx
import { useEffect as useEffect3, useMemo as useMemo3, useState as useState5 } from "react";

// src/components/charts.tsx
import { useEffect, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function useMeasure() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}
function niceTicks(max, count = 4) {
  if (!isFinite(max) || max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out = [];
  for (let v = 0; v <= max + step * 1e-3; v += step) out.push(Number(v.toFixed(6)));
  if (out[out.length - 1] < max) out.push(max);
  return out;
}
var axisText = (x, y, text, anchor = "middle", size = 10) => /* @__PURE__ */ jsx("text", { x, y, fontSize: size, fill: "var(--ui-text-tertiary)", textAnchor: anchor, children: text });
function BarsVertical({ data, valueKey, color, height = 250, format, formatTick }) {
  const [ref, width] = useMeasure();
  const pad = { l: 46, r: 8, t: 10, b: 62 };
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = Math.max(0, height - pad.t - pad.b);
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const ticks = niceTicks(Math.max(1e-9, ...values));
  const top = ticks[ticks.length - 1] || 1;
  const y = (v) => pad.t + ih - v / top * ih;
  const slot = data.length ? iw / data.length : iw;
  const bw = Math.max(2, Math.min(48, slot * 0.72));
  return /* @__PURE__ */ jsx("div", { ref, style: { width: "100%", height }, children: width > 0 && /* @__PURE__ */ jsxs("svg", { width, height, role: "img", children: [
    ticks.map((t) => /* @__PURE__ */ jsxs("g", { children: [
      /* @__PURE__ */ jsx("line", { x1: pad.l, x2: width - pad.r, y1: y(t), y2: y(t), stroke: "var(--ui-stroke-tertiary)", strokeDasharray: t === 0 ? void 0 : "2 3" }),
      axisText(pad.l - 6, y(t) + 3, formatTick ?? format ? (formatTick ?? format)(t) : String(t), "end")
    ] }, t)),
    data.map((d, i) => {
      const v = values[i];
      const cx = pad.l + slot * i + slot / 2;
      return /* @__PURE__ */ jsxs("g", { children: [
        /* @__PURE__ */ jsx("rect", { x: cx - bw / 2, y: y(v), width: bw, height: Math.max(1, pad.t + ih - y(v)), rx: 2, fill: color, children: /* @__PURE__ */ jsx("title", { children: `${d.label}: ${format ? format(v) : v}` }) }),
        /* @__PURE__ */ jsx(
          "text",
          {
            x: cx,
            y: pad.t + ih + 10,
            fontSize: Math.min(10, Math.max(8, slot / 4.5)),
            fill: "var(--ui-text-tertiary)",
            textAnchor: "end",
            transform: `rotate(-38 ${cx} ${pad.t + ih + 10})`,
            children: d.label ?? ""
          }
        )
      ] }, d.id ?? d.label ?? i);
    })
  ] }) });
}
function BarsHorizontal({ data, valueKey, color, height = 300, labelWidth = 140, format }) {
  const [ref, width] = useMeasure();
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const top = Math.max(1e-9, ...values);
  const iw = Math.max(0, width - labelWidth - 56);
  const row = data.length ? Math.min(28, (height - 8) / data.length) : 26;
  const bh = Math.max(4, row * 0.62);
  const drawn = Math.max(height, data.length ? row * data.length + 8 : height);
  return /* @__PURE__ */ jsx("div", { ref, style: { width: "100%", minHeight: height }, children: width > 0 && /* @__PURE__ */ jsx("svg", { width, height: drawn, role: "img", children: data.map((d, i) => {
    const v = values[i];
    const yTop = i * row + 4;
    return /* @__PURE__ */ jsxs("g", { children: [
      axisText(labelWidth - 8, yTop + bh / 2 + 4, String(d.label ?? ""), "end", 10),
      /* @__PURE__ */ jsx("rect", { x: labelWidth, y: yTop, width: Math.max(1, v / top * iw), height: bh, rx: 2, fill: color, children: /* @__PURE__ */ jsx("title", { children: `${d.label}: ${format ? format(v) : v}` }) }),
      axisText(labelWidth + Math.max(1, v / top * iw) + 6, yTop + bh / 2 + 4, format ? format(v) : String(v), "start", 10)
    ] }, d.id ?? d.label ?? i);
  }) }) });
}
function RadarChart({ axes, series, size = 450 }) {
  const [ref, width] = useMeasure();
  const side = Math.max(220, Math.min(size, width || size));
  const cx = side / 2;
  const cy = side / 2;
  const r = side / 2 - 54;
  const n = axes.length;
  const angle = (i) => Math.PI * 2 * i / n - Math.PI / 2;
  const at = (i, value) => {
    const t = Math.max(0, Math.min(100, value)) / 100;
    return [cx + Math.cos(angle(i)) * r * t, cy + Math.sin(angle(i)) * r * t];
  };
  const ring = (t) => axes.map((_, i) => at(i, t * 100).join(",")).join(" ");
  return /* @__PURE__ */ jsx("div", { ref, style: { width: "100%", display: "flex", justifyContent: "center" }, children: width > 0 && /* @__PURE__ */ jsxs("svg", { width: side, height: side, role: "img", children: [
    [0.25, 0.5, 0.75, 1].map((t) => /* @__PURE__ */ jsx("polygon", { points: ring(t), fill: "none", stroke: "var(--ui-stroke-tertiary)" }, t)),
    axes.map((a, i) => {
      const [x, y] = at(i, 100);
      const [lx, ly] = [cx + Math.cos(angle(i)) * (r + 14), cy + Math.sin(angle(i)) * (r + 14)];
      const anchor = Math.abs(lx - cx) < 6 ? "middle" : lx > cx ? "start" : "end";
      return /* @__PURE__ */ jsxs("g", { children: [
        /* @__PURE__ */ jsx("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: "var(--ui-stroke-tertiary)" }),
        axisText(lx, ly + 3, a, anchor, 10)
      ] }, a);
    }),
    series.map((s) => /* @__PURE__ */ jsx(
      "polygon",
      {
        points: s.values.map((v, i) => at(i, v).join(",")).join(" "),
        fill: s.color,
        fillOpacity: 0.12,
        stroke: s.color,
        strokeWidth: 1.5,
        children: /* @__PURE__ */ jsx("title", { children: s.label })
      },
      s.label
    ))
  ] }) });
}
function ScatterLog({ points, lo, hi, ticks, formatX, xLabel, yLabel, height = 400 }) {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState(null);
  const pad = { l: 52, r: 24, t: 26, b: 44 };
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = Math.max(0, height - pad.t - pad.b);
  const l0 = Math.log10(Math.max(lo, 1e-9));
  const l1 = Math.log10(Math.max(hi, lo * 1.0001));
  const px = (v) => pad.l + (Math.log10(Math.max(v, lo)) - l0) / (l1 - l0) * iw;
  const py = (v) => pad.t + ih - Math.max(0, Math.min(100, v)) / 100 * ih;
  const front = points.filter((p) => p.frontier).sort((a, b) => a.x - b.x);
  return /* @__PURE__ */ jsxs("div", { ref, style: { width: "100%", height, position: "relative" }, children: [
    width > 0 && /* @__PURE__ */ jsxs(
      "svg",
      {
        width,
        height,
        role: "img",
        onMouseLeave: () => setHover(null),
        children: [
          [0, 25, 50, 75, 100].map((t) => /* @__PURE__ */ jsxs("g", { children: [
            /* @__PURE__ */ jsx("line", { x1: pad.l, x2: width - pad.r, y1: py(t), y2: py(t), stroke: "var(--ui-stroke-tertiary)", strokeDasharray: "3 3" }),
            axisText(pad.l - 8, py(t) + 3, String(t), "end")
          ] }, t)),
          ticks.map((t) => /* @__PURE__ */ jsxs("g", { children: [
            /* @__PURE__ */ jsx("line", { x1: px(t), x2: px(t), y1: pad.t, y2: pad.t + ih, stroke: "var(--ui-stroke-tertiary)", strokeDasharray: "3 3" }),
            axisText(px(t), pad.t + ih + 15, formatX(t), "middle")
          ] }, t)),
          /* @__PURE__ */ jsx("line", { x1: pad.l, x2: width - pad.r, y1: pad.t + ih, y2: pad.t + ih, stroke: "var(--ui-stroke-secondary)" }),
          /* @__PURE__ */ jsx("line", { x1: pad.l, x2: pad.l, y1: pad.t, y2: pad.t + ih, stroke: "var(--ui-stroke-secondary)" }),
          axisText(width / 2, height - 6, xLabel, "middle", 11),
          /* @__PURE__ */ jsx(
            "text",
            {
              x: 12,
              y: pad.t + ih / 2,
              fontSize: 11,
              fill: "var(--ui-text-secondary)",
              textAnchor: "middle",
              transform: `rotate(-90 12 ${pad.t + ih / 2})`,
              children: yLabel
            }
          ),
          front.length > 1 && /* @__PURE__ */ jsx(
            "polyline",
            {
              points: front.map((p) => `${px(p.x)},${py(p.y)}`).join(" "),
              fill: "none",
              stroke: "var(--ui-orange)",
              strokeDasharray: "4 3",
              strokeWidth: 1.5
            }
          ),
          points.map((p) => {
            const x = px(p.x);
            const y = py(p.y);
            return /* @__PURE__ */ jsxs("g", { children: [
              /* @__PURE__ */ jsx(
                "circle",
                {
                  cx: x,
                  cy: y,
                  r: p.frontier ? 6 : 4.5,
                  fill: p.frontier ? "var(--ui-orange)" : "var(--ui-text-quaternary)",
                  onMouseEnter: () => setHover({ p, x, y })
                }
              ),
              axisText(x, y - 10, p.label, "middle", p.frontier ? 11 : 10)
            ] }, p.id);
          })
        ]
      }
    ),
    hover && /* @__PURE__ */ jsx("div", { style: {
      position: "absolute",
      left: Math.min(hover.x + 12, Math.max(0, width - 200)),
      top: Math.max(0, hover.y - 10),
      pointerEvents: "none",
      background: "var(--ui-bg-editor)",
      border: "1px solid var(--ui-stroke-tertiary)",
      borderRadius: 6,
      padding: "6px 10px",
      fontSize: 12,
      zIndex: 2,
      maxWidth: 220
    }, children: hover.p.title })
  ] });
}

// src/components/NewsPanel.tsx
import { useState as useState3 } from "react";

// src/hooks/useResizable.ts
import { useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";
function useResizable(opts) {
  const { initial, min, max, storageKey } = opts;
  const [width, setWidth] = useState2(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const v = parseInt(saved, 10);
        if (!isNaN(v) && v >= min && v <= max) return v;
      }
    }
    return initial;
  });
  const dragging = useRef2(false);
  const startX = useRef2(0);
  const startWidth = useRef2(0);
  useEffect2(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      e.preventDefault();
      const delta = e.clientX - startX.current;
      const next = Math.min(max, Math.max(min, startWidth.current - delta));
      setWidth(next);
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (storageKey) {
          setWidth((w) => {
            localStorage.setItem(storageKey, String(w));
            return w;
          });
        }
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [max, min, storageKey]);
  const onMouseDown = (e) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  return { width, onMouseDown };
}

// src/components/NewsPanel.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var money = (v) => typeof v === "number" ? "$" + String(+v.toFixed(5)) : "";
function promoLine(t, d) {
  if (!d || typeof d !== "object") return "";
  const inPrice = money(d.price_in), outPrice = money(d.price_out);
  switch (d.code) {
    case "limited_promo":
      return t.news.promo.limited(inPrice, outPrice);
    case "price_with_context":
      return t.news.promo.priceWithContext(inPrice, outPrice, fmtShortCtx(d.context_tokens));
    case "price_with_params":
      return t.news.promo.priceWithParams(inPrice, outPrice, d.moe_params || "");
    case "video_rate":
      return t.news.promo.videoRate(d.vendor || "", money(d.rate_per_second));
    case "agentic_model":
      return t.news.promo.agenticModel(d.vendor || "", inPrice, outPrice);
    case "price":
      return t.news.promo.price(inPrice, outPrice);
    default:
      return inPrice && outPrice ? t.news.promo.price(inPrice, outPrice) : "";
  }
}
function fmtShortCtx(n) {
  if (typeof n !== "number" || !n) return "";
  if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}
function NewsPanel(props) {
  const {
    news,
    loading,
    onClose,
    processedPromotions,
    processedNewModels,
    newsVisibleLimit,
    setNewsVisibleLimit,
    newsSortBy,
    setNewsSortBy,
    newsTimeWindow,
    setNewsTimeWindow,
    addModel,
    trackedIds,
    profileName,
    t,
    fmtDate: fmtDate2,
    fmtCtx: fmtCtx2,
    fmtPrice: fmtPrice2
  } = props;
  const { width, onMouseDown } = useResizable({
    initial: 360,
    min: 280,
    max: 600,
    storageKey: "llm-dash-news-width"
  });
  const isTracked = (id) => trackedIds.has(id);
  const [priceThreshold, setPriceThreshold] = useState3(5);
  const [priceDays, setPriceDays] = useState3(7);
  const _nowSec = Date.now() / 1e3;
  const filteredPriceChanges = (news?.price_changes || []).filter((pc) => {
    const withinWindow = (pc.changed_at || 0) >= _nowSec - priceDays * 86400;
    const v1 = Math.abs(pc.percent_1d ?? 0);
    const v7 = Math.abs(pc.percent_7d ?? 0);
    return withinWindow && (v1 >= priceThreshold || v7 >= priceThreshold);
  });
  return /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsxs2(
      "div",
      {
        onMouseDown,
        className: "news-drag-handle",
        style: {
          width: 10,
          flexShrink: 0,
          cursor: "col-resize",
          alignSelf: "stretch",
          // No negative margins: the parent's gap:10 provides the spacing
          zIndex: 10,
          position: "relative",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center"
        },
        children: [
          /* @__PURE__ */ jsx2("span", { className: "news-sash-hairline" }),
          /* @__PURE__ */ jsx2("span", { className: "news-sash-hover-band" })
        ]
      }
    ),
    /* @__PURE__ */ jsxs2(
      "div",
      {
        style: {
          width,
          background: "var(--ui-bg-editor)",
          border: "1px solid var(--ui-stroke-tertiary)",
          borderRadius: "var(--radius-lg)",
          padding: 16,
          boxShadow: "var(--shadow-sm)",
          flexShrink: 0,
          marginLeft: -10,
          // No own scroll, no fixed height: the panel stretches to the height of
          // the main column (the flex container uses alignItems: 'flex-start',
          // so we opt back into stretching with alignSelf) and the page scrolls
          // as one — no double scrollbar.
          alignSelf: "stretch"
        },
        children: [
          /* @__PURE__ */ jsxs2("div", { style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            borderBottom: "1px solid var(--ui-stroke-tertiary)",
            paddingBottom: 8,
            position: "sticky",
            top: -16,
            background: "var(--ui-bg-editor)",
            paddingTop: 4,
            zIndex: 1
          }, children: [
            /* @__PURE__ */ jsx2("h3", { style: { margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 6, color: "var(--ui-text-primary)" }, children: t.news.title }),
            /* @__PURE__ */ jsx2("button", { onClick: onClose, style: { background: "none", border: "none", cursor: "pointer", color: "var(--ui-text-tertiary)", fontSize: 14 }, title: t.news.hidePanel, children: "✕" })
          ] }),
          loading ? /* @__PURE__ */ jsx2("p", { style: { fontSize: 13, color: "var(--ui-text-tertiary)" }, children: t.news.loading }) : !news ? /* @__PURE__ */ jsx2("p", { style: { fontSize: 13, color: "var(--ui-text-tertiary)" }, children: t.news.none }) : /* @__PURE__ */ jsxs2("div", { style: { display: "flex", flexDirection: "column", gap: 20 }, children: [
            processedPromotions.length > 0 && /* @__PURE__ */ jsxs2("div", { children: [
              /* @__PURE__ */ jsx2("div", { style: { fontSize: 12, fontWeight: 700, color: "var(--ui-red)", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }, children: t.news.promos }),
              /* @__PURE__ */ jsx2("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: processedPromotions.map((p) => /* @__PURE__ */ jsxs2("div", { style: {
                background: p._isChallenger ? "color-mix(in srgb, var(--ui-yellow) 8%, var(--ui-bg-editor))" : "color-mix(in srgb, var(--ui-red) 4%, var(--ui-bg-editor))",
                border: p._isChallenger ? "1px solid var(--ui-yellow)" : "1px solid color-mix(in srgb, var(--ui-red) 8%, transparent)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px",
                fontSize: 12
              }, children: [
                /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" }, children: [
                  /* @__PURE__ */ jsxs2("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsx2("b", { children: p.name }),
                    /* @__PURE__ */ jsxs2("span", { style: { background: "var(--ui-red)", color: "var(--ui-bg-editor)", padding: "1px 5px", borderRadius: 3, fontWeight: 700, fontSize: 10 }, children: [
                      "🔻 ",
                      p.discount_pct != null ? t.news.promo.discount(p.discount_pct) : "🔻"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs2("div", { style: { textAlign: "right" }, children: [
                    /* @__PURE__ */ jsx2("span", { style: { fontWeight: 800, color: p._isChallenger ? "var(--ui-orange)" : "var(--ui-text-secondary)", fontSize: 12 }, children: p._roundedScore > 0 ? `${p._roundedScore}/100` : "–" }),
                    p._isChallenger && /* @__PURE__ */ jsx2("div", { style: { fontSize: 9, background: "var(--ui-orange)", color: "var(--ui-bg-editor)", padding: "1px 4px", borderRadius: 3, fontWeight: 700, marginTop: 1 }, children: t.news.top3 })
                  ] })
                ] }),
                promoLine(t, p.detail) ? /* @__PURE__ */ jsx2("div", { style: { fontSize: 11, color: "var(--ui-text-tertiary)", marginTop: 4 }, children: promoLine(t, p.detail) }) : null,
                p.ends_at ? /* @__PURE__ */ jsx2("div", { style: { fontSize: 10, color: p._isChallenger ? "var(--ui-orange)" : "var(--ui-text-tertiary)", marginTop: 2 }, children: t.news.until(p.ends_at) }) : null,
                /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }, children: [
                  /* @__PURE__ */ jsxs2(
                    "a",
                    {
                      href: `https://openrouter.ai/${p.id}`,
                      target: "_blank",
                      rel: "noreferrer",
                      style: { fontSize: 11, color: "var(--ui-accent-secondary)", textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 2 },
                      children: [
                        t.news.details,
                        " ↗"
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx2(
                    "button",
                    {
                      onClick: () => addModel(p.id),
                      disabled: isTracked(p.id),
                      style: {
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 4,
                        cursor: isTracked(p.id) ? "default" : "pointer",
                        fontWeight: 600,
                        background: isTracked(p.id) ? "var(--ui-bg-tertiary)" : p._isChallenger ? "var(--ui-orange)" : "var(--ui-bg-editor)",
                        border: isTracked(p.id) ? "1px solid var(--ui-stroke-secondary)" : p._isChallenger ? "1px solid var(--ui-orange)" : "1px solid var(--ui-red)",
                        color: isTracked(p.id) ? "var(--ui-text-quaternary)" : p._isChallenger ? "var(--ui-bg-editor)" : "var(--ui-red)",
                        boxShadow: !isTracked(p.id) && p._isChallenger ? "0 1px 4px color-mix(in srgb, var(--ui-orange) 40%, transparent)" : "none"
                      },
                      children: isTracked(p.id) ? t.news.tracked : t.news.follow
                    }
                  )
                ] })
              ] }, p.id)) })
            ] }),
            news.price_changes && news.price_changes.length > 0 && /* @__PURE__ */ jsxs2("div", { children: [
              /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
                /* @__PURE__ */ jsx2("div", { style: { fontSize: 12, fontWeight: 700, color: "var(--ui-blue)", textTransform: "uppercase" }, children: t.news.priceChanges }),
                /* @__PURE__ */ jsxs2("label", { style: { fontSize: 10, color: "var(--ui-text-tertiary)", display: "flex", alignItems: "center", gap: 4 }, children: [
                  t.news.threshold,
                  /* @__PURE__ */ jsxs2(
                    "select",
                    {
                      value: priceThreshold,
                      onChange: (e) => setPriceThreshold(Number(e.target.value)),
                      style: { fontSize: 10, padding: "1px 3px", borderRadius: 4, border: "1px solid var(--ui-stroke-secondary)" },
                      children: [
                        /* @__PURE__ */ jsx2("option", { value: 1, children: "1%" }),
                        /* @__PURE__ */ jsx2("option", { value: 5, children: "5%" }),
                        /* @__PURE__ */ jsx2("option", { value: 10, children: "10%" }),
                        /* @__PURE__ */ jsx2("option", { value: 25, children: "25%" })
                      ]
                    }
                  ),
                  t.news.thresholdUnit
                ] })
              ] }),
              /* @__PURE__ */ jsxs2("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
                filteredPriceChanges.map((pc) => {
                  const v1 = pc.percent_1d;
                  const v7 = pc.percent_7d;
                  const pick = v1 != null && Math.abs(v1) >= priceThreshold ? { v: v1, lbl: "24h" } : { v: v7, lbl: "7j" };
                  return /* @__PURE__ */ jsxs2("div", { style: { background: "var(--ui-bg-tertiary)", border: "1px solid color-mix(in srgb, var(--ui-blue) 10%, transparent)", borderRadius: "var(--radius-sm)", padding: "8px 10px", fontSize: 12 }, children: [
                    /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                      /* @__PURE__ */ jsx2("b", { children: pc.id.split("/").pop() }),
                      /* @__PURE__ */ jsxs2("span", { style: { color: pick.v <= 0 ? "var(--ui-green)" : "var(--ui-red)", fontWeight: 700, fontSize: 11 }, children: [
                        pick.v <= 0 ? `🔻 ${pick.v}%` : `🔺 +${pick.v}%`,
                        " (",
                        pick.lbl,
                        ")"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }, children: [
                      /* @__PURE__ */ jsxs2("span", { style: { fontSize: 10, color: "var(--ui-text-tertiary)" }, children: [
                        "Date : ",
                        fmtDate2(pc.changed_at)
                      ] }),
                      /* @__PURE__ */ jsxs2(
                        "a",
                        {
                          href: `https://openrouter.ai/${pc.id}`,
                          target: "_blank",
                          rel: "noreferrer",
                          style: { fontSize: 11, color: "var(--ui-blue)", textDecoration: "underline" },
                          children: [
                            t.news.details,
                            " ↗"
                          ]
                        }
                      )
                    ] })
                  ] }, pc.id);
                }),
                filteredPriceChanges.length === 0 && /* @__PURE__ */ jsxs2("div", { style: { fontSize: 11, color: "var(--ui-text-tertiary)" }, children: [
                  "Aucune variation ≥ ",
                  priceThreshold,
                  "% sur ",
                  priceDays,
                  " derniers jours."
                ] }),
                priceDays < 90 && /* @__PURE__ */ jsxs2("button", { onClick: () => setPriceDays((prev) => prev + 7), style: {
                  marginTop: 4,
                  padding: "6px 10px",
                  background: "var(--ui-bg-tertiary)",
                  border: "1px solid var(--ui-stroke-secondary)",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--ui-text-secondary)"
                }, children: [
                  "➕ Afficher plus (",
                  priceDays + 7,
                  " derniers jours)"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs2("div", { children: [
              /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }, children: [
                /* @__PURE__ */ jsx2("div", { style: { fontSize: 12, fontWeight: 700, color: "var(--ui-green)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }, children: t.news.newModelsHeading(profileName) }),
                /* @__PURE__ */ jsx2("span", { style: { fontSize: 11, color: "var(--ui-text-tertiary)" }, children: t.news.nModels(processedNewModels.length) })
              ] }),
              /* @__PURE__ */ jsxs2("div", { style: { background: "var(--ui-row-hover-background)", borderRadius: "var(--radius-sm)", padding: 6, marginBottom: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 11, border: "1px solid var(--ui-stroke-tertiary)" }, children: [
                /* @__PURE__ */ jsxs2("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
                  /* @__PURE__ */ jsx2("span", { style: { color: "var(--ui-text-secondary)", fontWeight: 600 }, children: t.news.windowLabel }),
                  /* @__PURE__ */ jsxs2(
                    "select",
                    {
                      value: newsTimeWindow,
                      onChange: (e) => {
                        setNewsTimeWindow(e.target.value);
                        setNewsVisibleLimit(() => 8);
                      },
                      style: { fontSize: 11, padding: "2px 4px", borderRadius: 4, border: "1px solid var(--ui-stroke-secondary)" },
                      children: [
                        /* @__PURE__ */ jsx2("option", { value: "1m", children: t.news.windowOpts["1m"] }),
                        /* @__PURE__ */ jsx2("option", { value: "2m", children: t.news.windowOpts["2m"] }),
                        /* @__PURE__ */ jsx2("option", { value: "3m", children: t.news.windowOpts["3m"] }),
                        /* @__PURE__ */ jsx2("option", { value: "6m", children: t.news.windowOpts["6m"] }),
                        /* @__PURE__ */ jsx2("option", { value: "1y", children: t.news.windowOpts["1y"] }),
                        /* @__PURE__ */ jsx2("option", { value: "all", children: t.news.windowOpts["all"] })
                      ]
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs2("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
                  /* @__PURE__ */ jsx2("span", { style: { color: "var(--ui-text-secondary)", fontWeight: 600 }, children: t.news.sortBy }),
                  /* @__PURE__ */ jsxs2("div", { style: { display: "flex", gap: 4 }, children: [
                    /* @__PURE__ */ jsx2("button", { onClick: () => setNewsSortBy("date"), style: {
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--ui-stroke-secondary)",
                      background: newsSortBy === "date" ? "var(--ui-green)" : "var(--ui-bg-editor)",
                      color: newsSortBy === "date" ? "var(--ui-bg-editor)" : "var(--ui-text-secondary)",
                      fontWeight: newsSortBy === "date" ? 700 : 500,
                      cursor: "pointer",
                      fontSize: 10
                    }, children: t.news.sortDate }),
                    /* @__PURE__ */ jsx2("button", { onClick: () => setNewsSortBy("score"), style: {
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--ui-stroke-secondary)",
                      background: newsSortBy === "score" ? "var(--ui-orange)" : "var(--ui-bg-editor)",
                      color: newsSortBy === "score" ? "var(--ui-bg-editor)" : "var(--ui-text-secondary)",
                      fontWeight: newsSortBy === "score" ? 700 : 500,
                      cursor: "pointer",
                      fontSize: 10
                    }, children: t.news.sortScore })
                  ] })
                ] })
              ] }),
              processedNewModels.length === 0 ? /* @__PURE__ */ jsx2("p", { style: { fontSize: 11, color: "var(--ui-text-tertiary)", fontStyle: "italic" }, children: t.news.noNewModels }) : /* @__PURE__ */ jsxs2("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
                processedNewModels.slice(0, newsVisibleLimit).map((nm) => /* @__PURE__ */ jsxs2("div", { style: {
                  background: nm._isChallenger ? "color-mix(in srgb, var(--ui-yellow) 8%, var(--ui-bg-editor))" : "var(--ui-row-hover-background)",
                  border: nm._isChallenger ? "1px solid var(--ui-yellow)" : "1px solid var(--ui-stroke-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 10px",
                  fontSize: 12
                }, children: [
                  /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" }, children: [
                    /* @__PURE__ */ jsxs2("div", { children: [
                      /* @__PURE__ */ jsx2("b", { children: nm.name || nm.id.split("/").pop() }),
                      /* @__PURE__ */ jsxs2("div", { style: { fontSize: 10, color: "var(--ui-text-tertiary)" }, children: [
                        fmtDate2(nm.created),
                        " · ",
                        fmtCtx2(nm.context_length),
                        " ctx"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs2("div", { style: { textAlign: "right" }, children: [
                      /* @__PURE__ */ jsx2("span", { style: { fontWeight: 800, color: nm._isChallenger ? "var(--ui-orange)" : "var(--ui-text-secondary)", fontSize: 12 }, children: nm._roundedScore > 0 ? `${nm._roundedScore}/100` : "–" }),
                      nm._isChallenger && /* @__PURE__ */ jsx2("div", { style: { fontSize: 9, background: "var(--ui-orange)", color: "var(--ui-bg-editor)", padding: "1px 4px", borderRadius: 3, fontWeight: 700, marginTop: 1 }, children: "🔥 Top 3 !" })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs2("div", { style: { fontSize: 11, color: "var(--ui-text-tertiary)", marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                    /* @__PURE__ */ jsxs2("span", { children: [
                      fmtPrice2(nm.prompt_price),
                      " / ",
                      fmtPrice2(nm.completion_price)
                    ] }),
                    /* @__PURE__ */ jsxs2("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                      /* @__PURE__ */ jsxs2(
                        "a",
                        {
                          href: `https://openrouter.ai/${nm.id}`,
                          target: "_blank",
                          rel: "noreferrer",
                          style: { fontSize: 11, color: "var(--ui-accent-secondary)", textDecoration: "underline" },
                          children: [
                            t.news.details,
                            " ↗"
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsx2(
                        "button",
                        {
                          onClick: () => addModel(nm.id),
                          disabled: isTracked(nm.id),
                          style: {
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 4,
                            cursor: isTracked(nm.id) ? "default" : "pointer",
                            fontWeight: 600,
                            background: isTracked(nm.id) ? "var(--ui-bg-tertiary)" : nm._isChallenger ? "var(--ui-orange)" : "var(--ui-bg-editor)",
                            border: isTracked(nm.id) ? "1px solid var(--ui-stroke-secondary)" : nm._isChallenger ? "1px solid var(--ui-orange)" : "1px solid var(--ui-accent-secondary)",
                            color: isTracked(nm.id) ? "var(--ui-text-quaternary)" : nm._isChallenger ? "var(--ui-bg-editor)" : "var(--ui-accent-secondary)",
                            boxShadow: !isTracked(nm.id) && nm._isChallenger ? "0 1px 4px color-mix(in srgb, var(--ui-orange) 40%, transparent)" : "none"
                          },
                          children: isTracked(nm.id) ? t.news.tracked : t.news.follow
                        }
                      )
                    ] })
                  ] })
                ] }, nm.id)),
                newsVisibleLimit < processedNewModels.length && /* @__PURE__ */ jsxs2("button", { onClick: () => setNewsVisibleLimit((prev) => prev + 10), style: {
                  marginTop: 4,
                  padding: "6px 10px",
                  background: "var(--ui-bg-tertiary)",
                  border: "1px solid var(--ui-stroke-secondary)",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--ui-text-secondary)"
                }, children: [
                  "➕ Afficher plus (",
                  processedNewModels.length - newsVisibleLimit,
                  " restants)"
                ] })
              ] })
            ] })
          ] })
        ]
      }
    )
  ] });
}

// src/LeaderboardPage.tsx
import { ConfirmDialog } from "@hermes/plugin-sdk";

// src/doors.ts
var restFn = null;
function setRest(fn) {
  restFn = fn;
}
function api(path, opts) {
  if (restFn) return restFn(path, opts);
  return fetch(`/api${path}`, opts).then((r) => {
    if (!r.ok) return r.json().then((e) => {
      throw new Error(e.detail || `HTTP ${r.status}`);
    });
    return r.json();
  });
}

// src/i18n.ts
import { useMemo } from "react";
import { usePluginI18n } from "@hermes/plugin-sdk";

// src/locales/en.ts
var en = {
  title: "LLM Model Leaderboard",
  subtitle: "OpenRouter data — prices, benchmarks and news",
  refresh: "Refresh",
  nVisible: (n, extra) => `${n} visible${extra}`,
  nHidden: (n) => ` (+${n} hidden)`,
  appliesTo: "Applies to",
  editCriteria: "Edit scoring criteria",
  trackingProfile: "Tracking profile",
  loading: "Loading…",
  loadError: "Could not load the tracked models",
  retry: "Retry",
  searchPlaceholder: "Search a model…",
  search: "Search",
  searchUntracked: "Search untracked models",
  tableTitle: "Tracked models",
  results: (n) => `Results (${n})`,
  alreadyTracked: "Tracked",
  add: "Add",
  show: "Show",
  hide: "Hide",
  removeModel: "Remove model",
  suppressShort: "Del?",
  clickToShow: "Click to show",
  clickToHide: "Click to hide",
  criteriaWeights: "Criteria weights:",
  totalWeights: "Total weights:",
  resetAllTitle: "Reset every profile and criterion to its default value",
  resetDefaults: "🔄 Reset defaults",
  cancel: "Cancel",
  confirmDeleteTitle: "Remove this model?",
  confirmDeleteBody: (name) => `“${name}” will be removed from the tracked models. The data stays untouched on OpenRouter.`,
  confirmDeleteOk: "Remove",
  updatedAgo: (m) => m < 1 ? "updated just now" : `updated ${m} min ago`,
  ranking: (name) => `🏆 Ranking — ${name}`,
  customCriteria: "Custom criteria",
  table: {
    model: "Model",
    context: "Context",
    priceIn: "Input $/M tk",
    priceOut: "Output $/M tk",
    priceCache: "Cache read",
    intel: "Intel.",
    coding: "Coding",
    agentic: "Agentic",
    swe: "SWE",
    vision: "Vision",
    open: "Open",
    size: "Size",
    gpuOk: "GPU OK",
    tools: "Tools",
    score: "Score"
  },
  views: {
    label: "View:",
    names: { classic: "Cards", stacked: "Score bars", columns: "Histograms", heatmap: "Heatmap", duel: "Duel", value: "Quality / cost" },
    hint: {
      classic: "Top 5 with price and context.",
      stacked: "Each segment = points earned on one criterion (weight × grade).",
      columns: "One bar per criterion: height = grade, width = weight.",
      heatmap: "Grade 0–100 per criterion, heaviest criteria first. Click a column to sort.",
      duel: "Pick two models and compare them criterion by criterion.",
      value: "Quality (non-price criteria) against weighted cost; the dashed line links the best trade-offs."
    },
    short: {
      intelligence: "Intelligence",
      coding: "Coding",
      agentic: "Agentic",
      price_in: "Price in",
      price_out: "Price out",
      cache_read: "Cache price",
      context: "Context",
      tools: "Tools",
      has_vision: "Vision",
      open_weights: "Open weights",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Model",
    score: "Score",
    weight: "weight",
    grade: "grade",
    points: "pts",
    na: "n/a",
    noCriteria: "No criterion is weighted for this profile — edit the scoring criteria.",
    needTwo: "Track at least two available models to compare them.",
    showAll: (n) => `Show all (${n})`,
    showLess: "Show less",
    strength: "Strength",
    weakness: "Weakness",
    missingData: "Missing data counts as 0",
    winsOn: (n) => `ahead on ${n} criteri${n > 1 ? "a" : "on"}`,
    versus: "vs",
    axisQuality: "Quality",
    axisCost: "Cost $/M tk",
    axisCostShort: "Weighted cost ($/M tk, log scale)",
    axisQualityShort: "Quality (0–100)",
    free: "free",
    frontier: "Best trade-offs",
    frontierHint: "no other model is both cheaper and better (Pareto frontier).",
    others: "Dominated",
    valueRead: "Top-left is best: low cost, high quality.",
    fieldName: { intelligence_index: "Intelligence", coding_index: "Coding", agentic_index: "Agentic" },
    estimatedHint: (from, r2, n) => `Estimated from ${from} — linear fit on ${n} OpenRouter models (R² ${r2}). Click a heatmap cell to enter the real value.`,
    manualHint: "Value entered manually (overrides OpenRouter).",
    naHint: "No data: not published, and no other index to estimate it from.",
    editHint: "Click to enter the value (empty = back to OpenRouter / estimate).",
    rawIndex: "raw index",
    hasEstimates: "Some grades are estimated (~)",
    noQuality: "This profile only weights prices — add a quality criterion (intelligence, coding…) to plot quality against cost."
  },
  news: {
    title: "📰 News & Updates",
    hidePanel: "Hide panel",
    loading: "Loading news…",
    none: "No news available.",
    promos: "ONGOING PROMOS",
    priceChanges: "PRICE CHANGES",
    newModels: "NEW MODELS",
    newModelsHeading: (p) => `🚀 New models (${p})`,
    nModels: (n) => `${n} model${n > 1 ? "s" : ""}`,
    details: "Details",
    follow: "Follow",
    tracked: "Tracked",
    top3: "🔥 Top 3!",
    until: (d) => `⏳ Until ${d}`,
    threshold: "Threshold ≥",
    thresholdUnit: "/ 1d or 7d",
    windowLabel: "Window:",
    windowOpts: { "1m": "1 month (default)", "2m": "2 months", "3m": "3 months", "6m": "6 months", "1y": "1 year", "all": "All" },
    sortBy: "Sort by:",
    sortDate: "📅 Date",
    sortScore: "⭐ Score",
    noNewModels: "No new model in this period.",
    open: "News",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Limited OpenRouter promotion: ${i} / ${o} per M tk`,
      price: (i, o) => `${i} in / ${o} out per M tk`,
      priceWithContext: (i, o, c) => `${i} in / ${o} out per M tk (${c} ctx)`,
      priceWithParams: (i, o, p) => `${i} in / ${o} out per M tk (${p} MoE)`,
      videoRate: (v, r) => `${v} video generation at ${r}/s`,
      agenticModel: (v, i, o) => `${v} agentic coding model at ${i} in / ${o} out`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Tracking profile: ${name}`,
    autoFill: "✨ Auto-fill",
    autoFillHint: "Ask the Hermes default model to propose weights for this profile",
    autoFillRunning: "Asking the model…",
    autoFillDone: "Criteria proposed by the model — review and save.",
    autoFillFailed: "Auto-fill failed",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    delete: "Delete profile",
    deleteConfirm: (name) => `Delete the '${name}' tracking profile?`,
    reset: "Reset all profiles and criteria to default values?",
    needId: "Please provide an identifier for the profile",
    displayName: "Display name:",
    displayNamePlaceholder: "e.g. DevOps Specialist",
    saveError: "Error while saving the profile",
    close: "Close"
  },
  criteria: {
    intelligence: "Intelligence",
    coding: "Coding",
    agentic: "Agentic",
    price_in: "Price ↓ input",
    price_out: "Price ↓ output",
    cache_read: "Price ↓ cache",
    context: "Context window",
    tools: "Tool calls",
    has_vision: "Vision",
    open_weights: "Open weights",
    fits_64gb: "Local VRAM ≤ 64GB",
    d_intelligence: "Global reasoning and knowledge depth",
    d_coding: "Code generation quality",
    d_agentic: "Agentic capabilities (multi-step autonomy)",
    d_price_in: "Importance of cheap input tokens",
    d_price_out: "Importance of cheap output tokens",
    d_cache_read: "Importance of cheap cached input",
    d_context: "Ability to process very long contexts (close to 1M+ tokens)",
    d_tools: "Native function/tool calling (API, Bash, etc.)",
    d_has_vision: "Ability to process images, screenshots",
    d_open_weights: "Open weights, self-hostable",
    d_fits_64gb: "Feasibility of local execution on a standard GPU (≤ 64GB)"
  }
};

// src/locales/fr.ts
var fr = {
  title: "LLM Model Leaderboard",
  subtitle: "Données OpenRouter — prix, benchmarks et actualités",
  refresh: "Rafraîchir",
  nVisible: (n, extra) => `${n} visibles${extra}`,
  nHidden: (n) => ` (+${n} masqués)`,
  appliesTo: "S’applique à",
  editCriteria: "Modifier les critères de notation",
  trackingProfile: "Profil de suivi",
  loading: "Chargement…",
  loadError: "Impossible de charger les modèles suivis",
  retry: "Réessayer",
  searchPlaceholder: "Rechercher un modèle…",
  search: "Chercher",
  searchUntracked: "Rechercher dans les modèles non suivis",
  tableTitle: "Modèles suivis",
  results: (n) => `Résultats (${n})`,
  alreadyTracked: "Déjà suivi",
  add: "Ajouter",
  show: "Afficher",
  hide: "Masquer",
  removeModel: "Supprimer le modèle",
  suppressShort: "Suppr?",
  clickToShow: "Cliquer pour afficher",
  clickToHide: "Cliquer pour masquer",
  criteriaWeights: "Pondération des critères :",
  totalWeights: "Poids total :",
  resetAllTitle: "Réinitialise tous les profils et critères aux valeurs d'origine par défaut",
  resetDefaults: "🔄 Réinitialiser défauts",
  cancel: "Annuler",
  confirmDeleteTitle: "Supprimer ce modèle ?",
  confirmDeleteBody: (name) => `« ${name} » sera retiré des modèles suivis. Les données OpenRouter ne sont pas modifiées.`,
  confirmDeleteOk: "Supprimer",
  updatedAgo: (m) => m < 1 ? "mis à jour à l'instant" : `mis à jour il y a ${m} min`,
  ranking: (name) => `🏆 Classement ${name}`,
  customCriteria: "Critères personnalisés",
  table: {
    model: "Modèle",
    context: "Contexte",
    priceIn: "Prix Input ($/M tk)",
    priceOut: "Prix Output ($/M tk)",
    priceCache: "Prix Cache Read",
    intel: "Intel.",
    coding: "Coding",
    agentic: "Agentic",
    swe: "SWE",
    vision: "Vision",
    open: "Open",
    size: "Taille",
    gpuOk: "GPU OK",
    tools: "Tools",
    score: "Score"
  },
  views: {
    label: "Affichage :",
    names: { classic: "Cartes", stacked: "Barres de score", columns: "Histogrammes", heatmap: "Heatmap", duel: "Duel", value: "Qualité / coût" },
    hint: {
      classic: "Top 5 avec prix et contexte.",
      stacked: "Chaque segment = points gagnés sur un critère (poids × note).",
      columns: "Une barre par critère : hauteur = note, largeur = poids.",
      heatmap: "Note 0–100 par critère, critères les plus lourds d’abord. Cliquer une colonne pour trier.",
      duel: "Choisir deux modèles et les comparer critère par critère.",
      value: "Qualité (critères hors prix) face au coût pondéré ; la ligne pointillée relie les meilleurs compromis."
    },
    short: {
      intelligence: "Intelligence",
      coding: "Code",
      agentic: "Agentique",
      price_in: "Prix entrée",
      price_out: "Prix sortie",
      cache_read: "Prix cache",
      context: "Contexte",
      tools: "Outils",
      has_vision: "Vision",
      open_weights: "Poids ouverts",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Modèle",
    score: "Score",
    weight: "poids",
    grade: "note",
    points: "pts",
    na: "n/d",
    noCriteria: "Aucun critère n’est pondéré pour ce profil — modifiez les critères de notation.",
    needTwo: "Suivez au moins deux modèles disponibles pour les comparer.",
    showAll: (n) => `Tout afficher (${n})`,
    showLess: "Réduire",
    strength: "Atout",
    weakness: "Faiblesse",
    missingData: "Donnée manquante comptée 0",
    winsOn: (n) => `devant sur ${n} critère${n > 1 ? "s" : ""}`,
    versus: "vs",
    axisQuality: "Qualité",
    axisCost: "Coût $/M tk",
    axisCostShort: "Coût pondéré ($/M tk, échelle log)",
    axisQualityShort: "Qualité (0–100)",
    free: "gratuit",
    frontier: "Meilleurs compromis",
    frontierHint: "aucun autre modèle n’est à la fois moins cher et meilleur (frontière de Pareto).",
    others: "Dominés",
    valueRead: "Le meilleur est en haut à gauche : coût bas, qualité haute.",
    fieldName: { intelligence_index: "Intelligence", coding_index: "Code", agentic_index: "Agentique" },
    estimatedHint: (from, r2, n) => `Estimé depuis ${from} — régression sur ${n} modèles OpenRouter (R² ${r2}). Cliquer une cellule de la heatmap pour saisir la vraie valeur.`,
    manualHint: "Valeur saisie manuellement (prime sur OpenRouter).",
    naHint: "Aucune donnée : non publiée, et aucun autre indice pour l’estimer.",
    editHint: "Cliquer pour saisir la valeur (vide = retour à OpenRouter / estimation).",
    rawIndex: "indice brut",
    hasEstimates: "Certaines notes sont estimées (~)",
    noQuality: "Ce profil ne pondère que les prix — ajoutez un critère de qualité (intelligence, code…) pour comparer qualité et coût."
  },
  news: {
    title: "📰 Actualités & Nouveautés",
    hidePanel: "Masquer le volet",
    loading: "Chargement des actualités…",
    none: "Aucune actualité disponible.",
    promos: "🏷️ Promos en cours",
    priceChanges: "📉 Changements de tarifs",
    newModels: "NOUVEAUX MODÈLES",
    newModelsHeading: (p) => `🚀 Nouveautés (${p})`,
    nModels: (n) => `${n} modèle${n > 1 ? "s" : ""}`,
    details: "Détails",
    follow: "➕ Suivre",
    tracked: "Déjà suivi",
    top3: "🔥 Top 3 !",
    until: (d) => `⏳ Jusqu'au ${d}`,
    threshold: "Seuil ≥",
    thresholdUnit: "/ 1j ou 7j",
    windowLabel: "Fenêtre :",
    windowOpts: { "1m": "1 mois (défaut)", "2m": "2 mois", "3m": "3 mois", "6m": "6 mois", "1y": "1 an", "all": "Tout" },
    sortBy: "Trier par :",
    sortDate: "📅 Date",
    sortScore: "⭐ Score",
    noNewModels: "Aucune nouveauté sur cette période.",
    open: "Actualités",
    promo: {
      discount: (pct) => `-${pct} %`,
      limited: (i, o) => `Promotion OpenRouter limitée : ${i} / ${o} par M tk`,
      price: (i, o) => `${i} in / ${o} out par M tk`,
      priceWithContext: (i, o, c) => `${i} in / ${o} out par M tk (${c} ctx)`,
      priceWithParams: (i, o, p) => `${i} in / ${o} out par M tk (${p} MoE)`,
      videoRate: (v, r) => `Génération vidéo ${v} à ${r}/s`,
      agenticModel: (v, i, o) => `Modèle agentic coding ${v} à ${i} in / ${o} out`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Profil de suivi : ${name}`,
    autoFill: "✨ Remplissage auto",
    autoFillHint: "Demander au modèle par défaut Hermes de proposer les critères pour ce profil",
    autoFillRunning: "Question au modèle…",
    autoFillDone: "Critères proposés par le modèle — vérifiez puis enregistrez.",
    autoFillFailed: "Échec du remplissage auto",
    save: "Enregistrer",
    saving: "Enregistrement…",
    cancel: "Annuler",
    delete: "Supprimer le profil",
    deleteConfirm: (name) => `Supprimer le profil de suivi '${name}' ?`,
    reset: "Réinitialiser tous les profils et critères aux valeurs par défaut ?",
    needId: "Veuillez renseigner un identifiant pour le profil",
    saveError: "Erreur lors de la sauvegarde du profil",
    displayName: "Nom affiché :",
    displayNamePlaceholder: "ex : spécialiste DevOps",
    close: "Fermer"
  },
  criteria: {
    intelligence: "Intelligence",
    coding: "Génération de code",
    agentic: "Capacités agentiques",
    price_in: "Prix↓input",
    price_out: "Prix↓output",
    cache_read: "Prix↓cache",
    context: "Contexte",
    tools: "Support Tool Calls",
    has_vision: "Support Vision (Multimodal)",
    open_weights: "Open-weights (Poids ouverts)",
    fits_64gb: "Local VRAM ≤ 64GB",
    d_intelligence: "Intelligence globale",
    d_coding: "Génération de code",
    d_agentic: "Capacités agentiques",
    d_price_in: "Importance d’un prix bas des tokens d’entrée",
    d_price_out: "Importance d’un prix bas des tokens de sortie",
    d_cache_read: "Importance d’un prix bas du cache en lecture",
    d_context: "Capacité à traiter de très longs contextes (à 1M+ tokens)",
    d_tools: "Appel natif de fonctions et outils externes (API, Bash, etc.)",
    d_has_vision: "Capacité à traiter les images, captures d’écran et diagrammes",
    d_open_weights: "Poids ouverts, auto-hébergeable",
    d_fits_64gb: "Faisabilité d’exécution locale sur GPU standard (≤ 64GB)"
  }
};

// src/locales/zh.ts
var zh = {
  title: "LLM 模型排行榜",
  subtitle: "OpenRouter 数据 — 价格、基准与资讯",
  refresh: "刷新",
  nVisible: (n, extra) => `${n} 个可见${extra}`,
  nHidden: (n) => `（另隐藏 ${n} 个）`,
  appliesTo: "适用于",
  editCriteria: "编辑评分标准",
  trackingProfile: "跟踪配置",
  loading: "加载中…",
  loadError: "无法加载已跟踪的模型",
  retry: "重试",
  searchPlaceholder: "搜索模型…",
  search: "搜索",
  searchUntracked: "搜索未跟踪的模型",
  tableTitle: "已跟踪的模型",
  results: (n) => `结果（${n}）`,
  alreadyTracked: "已跟踪",
  add: "添加",
  show: "显示",
  hide: "隐藏",
  removeModel: "移除模型",
  suppressShort: "删",
  clickToShow: "点击显示",
  clickToHide: "点击隐藏",
  criteriaWeights: "评分标准权重：",
  totalWeights: "权重合计：",
  resetAllTitle: "将所有配置和评分标准恢复为默认值",
  resetDefaults: "🔄 恢复默认",
  cancel: "取消",
  confirmDeleteTitle: "移除此模型？",
  confirmDeleteBody: (name) => `“${name}” 将从已跟踪模型中移除。OpenRouter 上的数据不受影响。`,
  confirmDeleteOk: "移除",
  updatedAgo: (m) => m < 1 ? "刚刚更新" : `${m} 分钟前更新`,
  ranking: (name) => `🏆 排名 — ${name}`,
  customCriteria: "自定义标准",
  table: {
    model: "模型",
    context: "上下文",
    priceIn: "输入 $/百万",
    priceOut: "输出 $/百万",
    priceCache: "缓存读取",
    intel: "智能",
    coding: "编程",
    agentic: "智能体",
    swe: "SWE",
    vision: "视觉",
    open: "开放",
    size: "规模",
    gpuOk: "GPU 可用",
    tools: "工具",
    score: "得分"
  },
  views: {
    label: "视图：",
    names: { classic: "卡片", stacked: "得分条", columns: "直方图", heatmap: "热力图", duel: "两两对比", value: "质量 / 成本" },
    hint: {
      classic: "前 5 名及其价格与上下文。",
      stacked: "每段 = 该项标准获得的分数（权重 × 评分）。",
      columns: "每项标准一根柱：高度 = 评分，宽度 = 权重。",
      heatmap: "每项标准的 0–100 分，权重最高的在前。点击列可排序。",
      duel: "选择两个模型，逐项标准进行比较。",
      value: "质量（非价格标准）与加权成本；虚线连接最佳折中点。"
    },
    short: {
      intelligence: "智能",
      coding: "编程",
      agentic: "智能体",
      price_in: "输入价格",
      price_out: "输出价格",
      cache_read: "缓存价格",
      context: "上下文",
      tools: "工具",
      has_vision: "视觉",
      open_weights: "开放权重",
      fits_64gb: "显存 ≤ 64G"
    },
    model: "模型",
    score: "得分",
    weight: "权重",
    grade: "评分",
    points: "分",
    na: "无",
    noCriteria: "该配置未设置任何标准权重 — 请编辑评分标准。",
    needTwo: "至少跟踪两个可用模型才能比较。",
    showAll: (n) => `显示全部（${n}）`,
    showLess: "收起",
    strength: "优势",
    weakness: "劣势",
    missingData: "缺少数据按 0 计",
    winsOn: (n) => `在 ${n} 项标准上领先`,
    versus: "对比",
    axisQuality: "质量",
    axisCost: "成本 $/百万",
    axisCostShort: "加权成本（$/百万，对数刻度）",
    axisQualityShort: "质量（0–100）",
    free: "免费",
    frontier: "最佳折中",
    frontierHint: "没有其他模型在更便宜的同时又更好（帕累托前沿）。",
    others: "被支配",
    valueRead: "左上方最佳：成本低、质量高。",
    fieldName: { intelligence_index: "智能", coding_index: "编程", agentic_index: "智能体" },
    estimatedHint: (from, r2, n) => `由 ${from} 估算 — 基于 ${n} 个 OpenRouter 模型的线性拟合（R² ${r2}）。点击热力图单元格可填入真实值。`,
    manualHint: "手动输入的值（优先于 OpenRouter）。",
    naHint: "无数据：未公布，也没有其他可用来估算的指数。",
    editHint: "点击输入数值（留空则回到 OpenRouter / 估算值）。",
    rawIndex: "原始指数",
    hasEstimates: "部分评分为估算值（~）",
    noQuality: "该配置只对价格加权 — 请添加一项质量类标准（智能、编程…）才能画出质量与成本的关系。"
  },
  news: {
    title: "📰 资讯与更新",
    hidePanel: "隐藏面板",
    loading: "正在加载资讯…",
    none: "暂无资讯。",
    promos: "进行中的优惠",
    priceChanges: "价格变动",
    newModels: "新模型",
    newModelsHeading: (p) => `🚀 新模型（${p}）`,
    nModels: (n) => `${n} 个模型`,
    details: "详情",
    follow: "跟踪",
    tracked: "已跟踪",
    top3: "🔥 前三！",
    until: (d) => `⏳ 截止 ${d}`,
    threshold: "阈值 ≥",
    thresholdUnit: "/ 1 天或 7 天",
    windowLabel: "时间范围：",
    windowOpts: { "1m": "1 个月（默认）", "2m": "2 个月", "3m": "3 个月", "6m": "6 个月", "1y": "1 年", "all": "全部" },
    sortBy: "排序：",
    sortDate: "📅 日期",
    sortScore: "⭐ 得分",
    noNewModels: "该时间段内没有新模型。",
    open: "资讯",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `OpenRouter 限时优惠：每百万 token ${i} / ${o}`,
      price: (i, o) => `每百万 token ${i} 输入 / ${o} 输出`,
      priceWithContext: (i, o, c) => `每百万 token ${i} 输入 / ${o} 输出（上下文 ${c}）`,
      priceWithParams: (i, o, p) => `每百万 token ${i} 输入 / ${o} 输出（${p} MoE）`,
      videoRate: (v, r) => `${v} 视频生成 ${r}/秒`,
      agenticModel: (v, i, o) => `${v} 智能体编码模型 ${i} 输入 / ${o} 输出`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ 跟踪配置：${name}`,
    autoFill: "✨ 自动填充",
    autoFillHint: "让 Hermes 默认模型为该配置推荐权重",
    autoFillRunning: "正在询问模型…",
    autoFillDone: "模型已推荐标准 — 请检查后保存。",
    autoFillFailed: "自动填充失败",
    save: "保存",
    saving: "保存中…",
    cancel: "取消",
    delete: "删除配置",
    deleteConfirm: (name) => `删除“${name}”跟踪配置？`,
    reset: "将所有配置和评分标准恢复为默认值？",
    needId: "请为该配置提供一个标识符",
    displayName: "显示名称：",
    displayNamePlaceholder: "例如：DevOps 专家",
    saveError: "保存配置时出错",
    close: "关闭"
  },
  criteria: {
    intelligence: "智能",
    coding: "编程",
    agentic: "智能体",
    price_in: "价格 ↓ 输入",
    price_out: "价格 ↓ 输出",
    cache_read: "价格 ↓ 缓存",
    context: "上下文窗口",
    tools: "工具调用",
    has_vision: "视觉",
    open_weights: "开放权重",
    fits_64gb: "本地显存 ≤ 64GB",
    d_intelligence: "整体推理与知识深度",
    d_coding: "代码生成质量",
    d_agentic: "智能体能力（多步自主）",
    d_price_in: "低输入 token 价格的重要性",
    d_price_out: "低输出 token 价格的重要性",
    d_cache_read: "低缓存读取价格的重要性",
    d_context: "处理超长上下文的能力（接近 1M+ token）",
    d_tools: "原生函数/工具调用（API、Bash 等）",
    d_has_vision: "处理图像、截图的能力",
    d_open_weights: "开放权重，可自托管",
    d_fits_64gb: "在普通 GPU（≤ 64GB）上本地运行的可行性"
  }
};

// src/locales/zh-hant.ts
var zhHant = {
  title: "LLM 模型排行榜",
  subtitle: "OpenRouter 資料 — 價格、基準與新聞",
  refresh: "重新整理",
  nVisible: (n, extra) => `${n} 個可見${extra}`,
  nHidden: (n) => `（另隱藏 ${n} 個）`,
  appliesTo: "適用於",
  editCriteria: "編輯評分標準",
  trackingProfile: "追蹤設定檔",
  loading: "載入中…",
  loadError: "無法載入已追蹤的模型",
  retry: "重試",
  searchPlaceholder: "搜尋模型…",
  search: "搜尋",
  searchUntracked: "搜尋未追蹤的模型",
  tableTitle: "已追蹤的模型",
  results: (n) => `結果（${n}）`,
  alreadyTracked: "已追蹤",
  add: "新增",
  show: "顯示",
  hide: "隱藏",
  removeModel: "移除模型",
  suppressShort: "刪",
  clickToShow: "點擊顯示",
  clickToHide: "點擊隱藏",
  criteriaWeights: "評分標準權重：",
  totalWeights: "權重合計：",
  resetAllTitle: "將所有設定檔和評分標準還原為預設值",
  resetDefaults: "🔄 還原預設",
  cancel: "取消",
  confirmDeleteTitle: "移除此模型？",
  confirmDeleteBody: (name) => `“${name}” 將從已追蹤的模型中移除。OpenRouter 上的資料不受影響。`,
  confirmDeleteOk: "移除",
  updatedAgo: (m) => m < 1 ? "剛剛更新" : `${m} 分鐘前更新`,
  ranking: (name) => `🏆 排名 — ${name}`,
  customCriteria: "自訂標準",
  table: {
    model: "模型",
    context: "上下文",
    priceIn: "輸入 $/M tk",
    priceOut: "輸出 $/M tk",
    priceCache: "快取讀取",
    intel: "智能",
    coding: "程式",
    agentic: "代理",
    swe: "SWE",
    vision: "視覺",
    open: "開放",
    size: "規模",
    gpuOk: "GPU 可用",
    tools: "工具",
    score: "分數"
  },
  views: {
    label: "檢視：",
    names: { classic: "卡片", stacked: "分數長條", columns: "直方圖", heatmap: "熱圖", duel: "兩兩對決", value: "品質 / 成本" },
    hint: {
      classic: "前 5 名及其價格與上下文。",
      stacked: "每一段 = 該項標準獲得的分數（權重 × 評分）。",
      columns: "每項標準一根長條：高度 = 評分，寬度 = 權重。",
      heatmap: "每項標準的 0–100 分，權重最高的排在前面。點擊欄位可排序。",
      duel: "選擇兩個模型，逐項標準進行比較。",
      value: "品質（非價格標準）對比加權成本；虛線連接最佳折衷點。"
    },
    short: {
      intelligence: "智能",
      coding: "程式",
      agentic: "代理",
      price_in: "輸入價格",
      price_out: "輸出價格",
      cache_read: "快取價格",
      context: "上下文",
      tools: "工具",
      has_vision: "視覺",
      open_weights: "開放權重",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "模型",
    score: "分數",
    weight: "權重",
    grade: "評分",
    points: "分",
    na: "無資料",
    noCriteria: "此設定檔未設定任何標準權重 — 請編輯評分標準。",
    needTwo: "至少追蹤兩個可用模型才能比較。",
    showAll: (n) => `顯示全部（${n}）`,
    showLess: "收合",
    strength: "優勢",
    weakness: "劣勢",
    missingData: "缺少資料以 0 計",
    winsOn: (n) => `在 ${n} 項標準上領先`,
    versus: "對比",
    axisQuality: "品質",
    axisCost: "成本 $/M tk",
    axisCostShort: "加權成本（$/M tk，對數刻度）",
    axisQualityShort: "品質（0–100）",
    free: "免費",
    frontier: "最佳折衷",
    frontierHint: "沒有其他模型同時更便宜又更好（帕雷托前緣）。",
    others: "被支配",
    valueRead: "左上方最佳：成本低、品質高。",
    fieldName: { intelligence_index: "智能", coding_index: "程式", agentic_index: "代理" },
    estimatedHint: (from, r2, n) => `由 ${from} 估算 — 以 ${n} 個 OpenRouter 模型進行線性擬合（R² ${r2}）。點擊熱圖儲存格可填入實際值。`,
    manualHint: "手動輸入的值（優先於 OpenRouter）。",
    naHint: "無資料：未公布，也沒有其他可用來估算的指數。",
    editHint: "點擊輸入數值（留空則回到 OpenRouter / 估算值）。",
    rawIndex: "原始指數",
    hasEstimates: "部分評分為估算值（~）",
    noQuality: "此設定檔只對價格加權 — 請新增一項品質類標準（智能、程式…）才能畫出品質與成本的關係。"
  },
  news: {
    title: "📰 新聞與更新",
    hidePanel: "隱藏面板",
    loading: "正在載入新聞…",
    none: "目前沒有新聞。",
    promos: "進行中的優惠",
    priceChanges: "價格變動",
    newModels: "新模型",
    newModelsHeading: (p) => `🚀 新模型（${p}）`,
    nModels: (n) => `${n} 個模型`,
    details: "詳情",
    follow: "追蹤",
    tracked: "已追蹤",
    top3: "🔥 前三名！",
    until: (d) => `⏳ 截止 ${d}`,
    threshold: "門檻 ≥",
    thresholdUnit: "/ 1 天或 7 天",
    windowLabel: "時間範圍：",
    windowOpts: { "1m": "1 個月（預設）", "2m": "2 個月", "3m": "3 個月", "6m": "6 個月", "1y": "1 年", "all": "全部" },
    sortBy: "排序：",
    sortDate: "📅 日期",
    sortScore: "⭐ 分數",
    noNewModels: "此期間沒有新模型。",
    open: "新聞",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `OpenRouter 限時優惠：每 M tk ${i} / ${o}`,
      price: (i, o) => `每 M tk ${i} 輸入 / ${o} 輸出`,
      priceWithContext: (i, o, c) => `每 M tk ${i} 輸入 / ${o} 輸出（上下文 ${c}）`,
      priceWithParams: (i, o, p) => `每 M tk ${i} 輸入 / ${o} 輸出（${p} MoE）`,
      videoRate: (v, r) => `${v} 影片生成 ${r}/秒`,
      agenticModel: (v, i, o) => `${v} 代理程式撰寫模型 ${i} 輸入 / ${o} 輸出`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ 追蹤設定檔：${name}`,
    autoFill: "✨ 自動填入",
    autoFillHint: "請 Hermes 預設模型為此設定檔建議權重",
    autoFillRunning: "正在詢問模型…",
    autoFillDone: "模型已建議標準 — 請檢查後儲存。",
    autoFillFailed: "自動填入失敗",
    save: "儲存",
    saving: "儲存中…",
    cancel: "取消",
    delete: "刪除設定檔",
    deleteConfirm: (name) => `要刪除「${name}」追蹤設定檔嗎？`,
    reset: "要將所有設定檔和評分標準還原為預設值嗎？",
    needId: "請為此設定檔提供一個識別碼",
    displayName: "顯示名稱：",
    displayNamePlaceholder: "例如：DevOps 專家",
    saveError: "儲存設定檔時發生錯誤",
    close: "關閉"
  },
  criteria: {
    intelligence: "智能",
    coding: "程式",
    agentic: "代理",
    price_in: "價格 ↓ 輸入",
    price_out: "價格 ↓ 輸出",
    cache_read: "價格 ↓ 快取",
    context: "上下文視窗",
    tools: "工具呼叫",
    has_vision: "視覺",
    open_weights: "開放權重",
    fits_64gb: "本機 VRAM ≤ 64GB",
    d_intelligence: "整體推理與知識深度",
    d_coding: "程式碼生成品質",
    d_agentic: "代理能力（多步驟自主）",
    d_price_in: "輸入 token 價格便宜的重要性",
    d_price_out: "輸出 token 價格便宜的重要性",
    d_cache_read: "快取輸入價格便宜的重要性",
    d_context: "處理超長上下文的能力（接近 1M+ token）",
    d_tools: "原生函式／工具呼叫（API、Bash 等）",
    d_has_vision: "處理影像、螢幕截圖的能力",
    d_open_weights: "開放權重，可自行架設",
    d_fits_64gb: "在一般 GPU（≤ 64GB）上本機執行的可行性"
  }
};

// src/locales/af.ts
var af = {
  title: "LLM-modelranglys",
  subtitle: "OpenRouter-data — pryse, maatstawwe en nuus",
  refresh: "Verfris",
  nVisible: (n, extra) => `${n} sigbaar${extra}`,
  nHidden: (n) => ` (+${n} verborge)`,
  appliesTo: "Geld vir",
  editCriteria: "Wysig beoordelingskriteria",
  trackingProfile: "Volgprofiel",
  loading: "Laai tans…",
  loadError: "Kon nie die gevolgde modelle laai nie",
  retry: "Probeer weer",
  searchPlaceholder: "Soek 'n model…",
  search: "Soek",
  searchUntracked: "Soek modelle wat nie gevolg word nie",
  tableTitle: "Gevolgde modelle",
  results: (n) => `Resultate (${n})`,
  alreadyTracked: "Gevolg",
  add: "Voeg by",
  show: "Wys",
  hide: "Versteek",
  removeModel: "Verwyder model",
  suppressShort: "Wis?",
  clickToShow: "Klik om te wys",
  clickToHide: "Klik om te versteek",
  criteriaWeights: "Kriteriagewigte:",
  totalWeights: "Totale gewigte:",
  resetAllTitle: "Herstel elke profiel en kriterium na sy verstekwaarde",
  resetDefaults: "🔄 Herstel verstekke",
  cancel: "Kanselleer",
  confirmDeleteTitle: "Verwyder hierdie model?",
  confirmDeleteBody: (name) => `“${name}” sal uit die gevolgde modelle verwyder word. Die data op OpenRouter bly onveranderd.`,
  confirmDeleteOk: "Verwyder",
  updatedAgo: (m) => m < 1 ? "pas opgedateer" : `bygewerk ${m} min gelede`,
  ranking: (name) => `🏆 Ranglys — ${name}`,
  customCriteria: "Pasgemaakte kriteria",
  table: {
    model: "Model",
    context: "Konteks",
    priceIn: "Inset $/M tk",
    priceOut: "Uitset $/M tk",
    priceCache: "Lees uit kas",
    intel: "Intellig.",
    coding: "Kodering",
    agentic: "Agenties",
    swe: "SWE",
    vision: "Visie",
    open: "Oop",
    size: "Grootte",
    gpuOk: "GPU OK",
    tools: "Gereedskap",
    score: "Punte"
  },
  views: {
    label: "Aansig:",
    names: { classic: "Kaarte", stacked: "Puntbalke", columns: "Histogramme", heatmap: "Hittekaart", duel: "Tweestryd", value: "Kwaliteit / koste" },
    hint: {
      classic: "Top 5 met prys en konteks.",
      stacked: "Elke segment = punte verdien op een kriterium (gewig × graad).",
      columns: "Een balk per kriterium: hoogte = graad, breedte = gewig.",
      heatmap: "Graad 0–100 per kriterium, swaarste kriteria eerste. Klik op 'n kolom om te sorteer.",
      duel: "Kies twee modelle en vergelyk hulle kriterium vir kriterium.",
      value: "Kwaliteit (nie-pryskriteria) teen geweegde koste; die stippellyn verbind die beste kompromieë."
    },
    short: {
      intelligence: "Intelligensie",
      coding: "Kodering",
      agentic: "Agenties",
      price_in: "Prys in",
      price_out: "Prys uit",
      cache_read: "Kasprys",
      context: "Konteks",
      tools: "Gereedskap",
      has_vision: "Visie",
      open_weights: "Oop gewigte",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Model",
    score: "Punte",
    weight: "gewig",
    grade: "graad",
    points: "pte",
    na: "n.v.t.",
    noCriteria: "Geen kriterium is vir hierdie profiel geweeg nie — wysig die beoordelingskriteria.",
    needTwo: "Volg ten minste twee beskikbare modelle om hulle te vergelyk.",
    showAll: (n) => `Wys alles (${n})`,
    showLess: "Wys minder",
    strength: "Sterkte",
    weakness: "Swakheid",
    missingData: "Ontbrekende data tel as 0",
    winsOn: (n) => `voor op ${n} kriterium${n > 1 ? "s" : ""}`,
    versus: "vs",
    axisQuality: "Kwaliteit",
    axisCost: "Koste $/M tk",
    axisCostShort: "Geweegde koste ($/M tk, logskaal)",
    axisQualityShort: "Kwaliteit (0–100)",
    free: "gratis",
    frontier: "Beste kompromieë",
    frontierHint: "geen ander model is tegelyk goedkoper en beter nie (Pareto-grens).",
    others: "Oorheers",
    valueRead: "Links bo is die beste: lae koste, hoë kwaliteit.",
    fieldName: { intelligence_index: "Intelligensie", coding_index: "Kodering", agentic_index: "Agenties" },
    estimatedHint: (from, r2, n) => `Geskat uit ${from} — liniêre passing op ${n} OpenRouter-modelle (R² ${r2}). Klik op 'n hittekaartsel om die werklike waarde in te voer.`,
    manualHint: "Waarde handmatig ingevoer (oorheers OpenRouter).",
    naHint: "Geen data: nie gepubliseer nie, en geen ander indeks om dit uit te skat nie.",
    editHint: "Klik om die waarde in te voer (leeg = terug na OpenRouter / skatting).",
    rawIndex: "rou indeks",
    hasEstimates: "Sommige grade is geskat (~)",
    noQuality: "Hierdie profiel weeg net pryse — voeg 'n kwaliteitskriterium by (intelligensie, kodering…) om kwaliteit teen koste te teken."
  },
  news: {
    title: "📰 Nuus en opdaterings",
    hidePanel: "Versteek paneel",
    loading: "Laai nuus…",
    none: "Geen nuus beskikbaar nie.",
    promos: "LOPENDE PROMOSIES",
    priceChanges: "PRYSVERANDERINGS",
    newModels: "NUWE MODELLE",
    newModelsHeading: (p) => `🚀 Nuwe modelle (${p})`,
    nModels: (n) => `${n} model${n > 1 ? "le" : ""}`,
    details: "Besonderhede",
    follow: "Volg",
    tracked: "Gevolg",
    top3: "🔥 Top 3!",
    until: (d) => `⏳ Tot ${d}`,
    threshold: "Drempel ≥",
    thresholdUnit: "/ 1 d of 7 d",
    windowLabel: "Venster:",
    windowOpts: { "1m": "1 maand (verstek)", "2m": "2 maande", "3m": "3 maande", "6m": "6 maande", "1y": "1 jaar", "all": "Alles" },
    sortBy: "Sorteer volgens:",
    sortDate: "📅 Datum",
    sortScore: "⭐ Punte",
    noNewModels: "Geen nuwe model in hierdie tydperk nie.",
    open: "Nuus",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Beperkte OpenRouter-promosie: ${i} / ${o} per M tk`,
      price: (i, o) => `${i} in / ${o} uit per M tk`,
      priceWithContext: (i, o, c) => `${i} in / ${o} uit per M tk (${c} konteks)`,
      priceWithParams: (i, o, p) => `${i} in / ${o} uit per M tk (${p} MoE)`,
      videoRate: (v, r) => `${v} videogenerering teen ${r}/s`,
      agenticModel: (v, i, o) => `${v} agentiese koderingsmodel teen ${i} in / ${o} uit`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Volgprofiel: ${name}`,
    autoFill: "✨ Outomaties invul",
    autoFillHint: "Vra die Hermes-verstekmodel om gewigte vir hierdie profiel voor te stel",
    autoFillRunning: "Vra die model…",
    autoFillDone: "Kriteria deur die model voorgestel — hersien en stoor.",
    autoFillFailed: "Outomatiese invul het misluk",
    save: "Stoor",
    saving: "Stoor tans…",
    cancel: "Kanselleer",
    delete: "Verwyder profiel",
    deleteConfirm: (name) => `Verwyder die volgprofiel '${name}'?`,
    reset: "Herstel alle profiele en kriteria na verstekwaardes?",
    needId: "Verskaf asseblief 'n identifiseerder vir die profiel",
    displayName: "Vertoonnaam:",
    displayNamePlaceholder: "bv. DevOps-spesialis",
    saveError: "Fout tydens die stoor van die profiel",
    close: "Sluit"
  },
  criteria: {
    intelligence: "Intelligensie",
    coding: "Kodering",
    agentic: "Agenties",
    price_in: "Prys ↓ inset",
    price_out: "Prys ↓ uitset",
    cache_read: "Prys ↓ kas",
    context: "Konteksvenster",
    tools: "Gereedskapoproepe",
    has_vision: "Visie",
    open_weights: "Oop gewigte",
    fits_64gb: "Plaaslike VRAM ≤ 64GB",
    d_intelligence: "Globale redenering en kennisdiepte",
    d_coding: "Gehalte van kodegenerering",
    d_agentic: "Agentiese vermoëns (meerstap-outonomie)",
    d_price_in: "Belangrikheid van goedkoop inset-tokens",
    d_price_out: "Belangrikheid van goedkoop uitset-tokens",
    d_cache_read: "Belangrikheid van goedkoop gekaste inset",
    d_context: "Vermoë om baie lang kontekste te verwerk (na aan 1M+ tokens)",
    d_tools: "Inheemse funksie-/gereedskapoproepe (API, Bash, ens.)",
    d_has_vision: "Vermoë om beelde en skermskote te verwerk",
    d_open_weights: "Oop gewigte, self huisvesbaar",
    d_fits_64gb: "Uitvoerbaarheid van plaaslike uitvoering op 'n standaard GPU (≤ 64GB)"
  }
};

// src/locales/ar.ts
var ar = {
  title: "لوحة صدارة نماذج LLM",
  subtitle: "بيانات OpenRouter — الأسعار والمعايير والأخبار",
  refresh: "تحديث",
  nVisible: (n, extra) => `${n} ظاهر${extra}`,
  nHidden: (n) => ` (+${n} مخفي)`,
  appliesTo: "تنطبق على",
  editCriteria: "تعديل معايير التقييم",
  trackingProfile: "ملف التتبّع",
  loading: "جارٍ التحميل…",
  loadError: "تعذّر تحميل النماذج المتتبَّعة",
  retry: "إعادة المحاولة",
  searchPlaceholder: "ابحث عن نموذج…",
  search: "بحث",
  searchUntracked: "البحث في النماذج غير المتتبَّعة",
  tableTitle: "النماذج المتتبَّعة",
  results: (n) => `النتائج (${n})`,
  alreadyTracked: "متتبَّع",
  add: "إضافة",
  show: "إظهار",
  hide: "إخفاء",
  removeModel: "إزالة النموذج",
  suppressShort: "حذف؟",
  clickToShow: "انقر للإظهار",
  clickToHide: "انقر للإخفاء",
  criteriaWeights: "أوزان المعايير:",
  totalWeights: "مجموع الأوزان:",
  resetAllTitle: "إعادة كل ملف ومعيار إلى قيمته الافتراضية",
  resetDefaults: "🔄 القيم الافتراضية",
  cancel: "إلغاء",
  confirmDeleteTitle: "إزالة هذا النموذج؟",
  confirmDeleteBody: (name) => `ستتم إزالة «${name}» من النماذج المتتبَّعة. تبقى البيانات كما هي على OpenRouter.`,
  confirmDeleteOk: "إزالة",
  updatedAgo: (m) => m < 1 ? "حُدِّث للتو" : `حُدِّث قبل ${m} دقيقة`,
  ranking: (name) => `🏆 الترتيب — ${name}`,
  customCriteria: "معايير مخصّصة",
  table: {
    model: "النموذج",
    context: "السياق",
    priceIn: "المدخل $/M tk",
    priceOut: "المخرج $/M tk",
    priceCache: "قراءة الذاكرة المؤقتة",
    intel: "الذكاء",
    coding: "البرمجة",
    agentic: "وكيلي",
    swe: "SWE",
    vision: "الصور",
    open: "مفتوح",
    size: "الحجم",
    gpuOk: "GPU OK",
    tools: "الأدوات",
    score: "النقاط"
  },
  views: {
    label: "العرض:",
    names: { classic: "بطاقات", stacked: "أشرطة النقاط", columns: "مدرّجات", heatmap: "خريطة حرارية", duel: "مبارزة", value: "الجودة / التكلفة" },
    hint: {
      classic: "أفضل 5 مع السعر والسياق.",
      stacked: "كل مقطع = نقاط مكتسبة على معيار واحد (الوزن × التقدير).",
      columns: "شريط لكل معيار: الارتفاع = التقدير، العرض = الوزن.",
      heatmap: "تقدير من 0 إلى 100 لكل معيار، الأثقل أولاً. انقر على عمود للترتيب.",
      duel: "اختر نموذجين وقارنهما معيارًا بمعيار.",
      value: "الجودة (المعايير غير السعرية) مقابل التكلفة الموزونة؛ يربط الخط المتقطّع أفضل المقايضات."
    },
    short: {
      intelligence: "الذكاء",
      coding: "البرمجة",
      agentic: "وكيلي",
      price_in: "سعر المدخل",
      price_out: "سعر المخرج",
      cache_read: "سعر الذاكرة",
      context: "السياق",
      tools: "الأدوات",
      has_vision: "الصور",
      open_weights: "أوزان مفتوحة",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "النموذج",
    score: "النقاط",
    weight: "الوزن",
    grade: "التقدير",
    points: "نقطة",
    na: "غ/م",
    noCriteria: "لا يوجد معيار موزون لهذا الملف — عدّل معايير التقييم.",
    needTwo: "تبّع نموذجين متاحين على الأقل لمقارنتهما.",
    showAll: (n) => `إظهار الكل (${n})`,
    showLess: "إظهار أقل",
    strength: "القوة",
    weakness: "الضعف",
    missingData: "البيانات الناقصة تُحتسب صفرًا",
    winsOn: (n) => `متقدّم في ${n} معيار`,
    versus: "مقابل",
    axisQuality: "الجودة",
    axisCost: "التكلفة $/M tk",
    axisCostShort: "التكلفة الموزونة ($/M tk، مقياس لوغاريتمي)",
    axisQualityShort: "الجودة (0–100)",
    free: "مجاني",
    frontier: "أفضل المقايضات",
    frontierHint: "لا يوجد نموذج آخر أرخص وأفضل في الوقت نفسه (حد باريتو).",
    others: "مُهيمَن عليه",
    valueRead: "أعلى اليسار هو الأفضل: تكلفة منخفضة وجودة عالية.",
    fieldName: { intelligence_index: "الذكاء", coding_index: "البرمجة", agentic_index: "وكيلي" },
    estimatedHint: (from, r2, n) => `مقدَّر من ${from} — ملاءمة خطية على ${n} نموذجًا من OpenRouter (R² ${r2}). انقر على خلية في الخريطة الحرارية لإدخال القيمة الحقيقية.`,
    manualHint: "قيمة مُدخلة يدويًا (تتجاوز OpenRouter).",
    naHint: "لا بيانات: غير منشورة، ولا يوجد مؤشر آخر للتقدير.",
    editHint: "انقر لإدخال القيمة (فارغ = العودة إلى OpenRouter / التقدير).",
    rawIndex: "المؤشر الخام",
    hasEstimates: "بعض التقديرات مقدَّرة (~)",
    noQuality: "هذا الملف يوزن الأسعار فقط — أضف معيار جودة (الذكاء، البرمجة…) لرسم الجودة مقابل التكلفة."
  },
  news: {
    title: "📰 أخبار وتحديثات",
    hidePanel: "إخفاء اللوحة",
    loading: "جارٍ تحميل الأخبار…",
    none: "لا توجد أخبار متاحة.",
    promos: "عروض جارية",
    priceChanges: "تغيّرات الأسعار",
    newModels: "نماذج جديدة",
    newModelsHeading: (p) => `🚀 نماذج جديدة (${p})`,
    nModels: (n) => `${n} نموذج`,
    details: "التفاصيل",
    follow: "متابعة",
    tracked: "متتبَّع",
    top3: "🔥 أفضل 3!",
    until: (d) => `⏳ حتى ${d}`,
    threshold: "الحد ≥",
    thresholdUnit: "/ 1d أو 7d",
    windowLabel: "الفترة:",
    windowOpts: { "1m": "شهر واحد (افتراضي)", "2m": "شهران", "3m": "3 أشهر", "6m": "6 أشهر", "1y": "سنة واحدة", "all": "الكل" },
    sortBy: "الترتيب حسب:",
    sortDate: "📅 التاريخ",
    sortScore: "⭐ النقاط",
    noNewModels: "لا نماذج جديدة في هذه الفترة.",
    open: "الأخبار",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `عرض محدود على OpenRouter: ${i} / ${o} لكل M tk`,
      price: (i, o) => `${i} مدخل / ${o} مخرج لكل M tk`,
      priceWithContext: (i, o, c) => `${i} مدخل / ${o} مخرج لكل M tk (سياق ${c})`,
      priceWithParams: (i, o, p) => `${i} مدخل / ${o} مخرج لكل M tk (${p} MoE)`,
      videoRate: (v, r) => `${v} لتوليد الفيديو بـ ${r}/s`,
      agenticModel: (v, i, o) => `${v} نموذج برمجة وكيلي بـ ${i} مدخل / ${o} مخرج`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ ملف التتبّع: ${name}`,
    autoFill: "✨ تعبئة تلقائية",
    autoFillHint: "اطلب من نموذج Hermes الافتراضي اقتراح أوزان لهذا الملف",
    autoFillRunning: "جارٍ سؤال النموذج…",
    autoFillDone: "معايير مقترحة من النموذج — راجعها ثم احفظ.",
    autoFillFailed: "فشلت التعبئة التلقائية",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    delete: "حذف الملف",
    deleteConfirm: (name) => `حذف ملف التتبّع «${name}»؟`,
    reset: "إعادة كل الملفات والمعايير إلى القيم الافتراضية؟",
    needId: "يرجى تقديم معرّف للملف",
    displayName: "الاسم المعروض:",
    displayNamePlaceholder: "مثال: متخصّص DevOps",
    saveError: "خطأ أثناء حفظ الملف",
    close: "إغلاق"
  },
  criteria: {
    intelligence: "الذكاء",
    coding: "البرمجة",
    agentic: "القدرات الوكيلية",
    price_in: "السعر ↓ المدخل",
    price_out: "السعر ↓ المخرج",
    cache_read: "السعر ↓ الذاكرة المؤقتة",
    context: "نافذة السياق",
    tools: "استدعاءات الأدوات",
    has_vision: "الصور",
    open_weights: "أوزان مفتوحة",
    fits_64gb: "VRAM محلي ≤ 64GB",
    d_intelligence: "التفكير العام وعمق المعرفة",
    d_coding: "جودة توليد الشيفرة",
    d_agentic: "القدرات الوكيلية (استقلالية متعددة الخطوات)",
    d_price_in: "أهمية رخص رموز الإدخال",
    d_price_out: "أهمية رخص رموز الإخراج",
    d_cache_read: "أهمية رخص الإدخال المخزَّن مؤقتًا",
    d_context: "القدرة على معالجة سياقات طويلة جدًا (قريبة من 1M+ رمز)",
    d_tools: "استدعاء الدوال/الأدوات أصليًا (API، Bash، إلخ)",
    d_has_vision: "القدرة على معالجة الصور ولقطات الشاشة",
    d_open_weights: "أوزان مفتوحة، قابلة للاستضافة الذاتية",
    d_fits_64gb: "إمكانية التشغيل المحلي على GPU عادي (≤ 64GB)"
  }
};

// src/locales/de.ts
var de = {
  title: "LLM-Modell-Leaderboard",
  subtitle: "OpenRouter-Daten — Preise, Benchmarks und Neuigkeiten",
  refresh: "Aktualisieren",
  nVisible: (n, extra) => `${n} sichtbar${extra}`,
  nHidden: (n) => ` (+${n} ausgeblendet)`,
  appliesTo: "Gilt für",
  editCriteria: "Bewertungskriterien bearbeiten",
  trackingProfile: "Tracking-Profil",
  loading: "Wird geladen…",
  loadError: "Die verfolgten Modelle konnten nicht geladen werden",
  retry: "Erneut versuchen",
  searchPlaceholder: "Modell suchen…",
  search: "Suchen",
  searchUntracked: "Nicht verfolgte Modelle durchsuchen",
  tableTitle: "Verfolgte Modelle",
  results: (n) => `Ergebnisse (${n})`,
  alreadyTracked: "Verfolgt",
  add: "Hinzufügen",
  show: "Anzeigen",
  hide: "Ausblenden",
  removeModel: "Modell entfernen",
  suppressShort: "Löschen?",
  clickToShow: "Zum Anzeigen klicken",
  clickToHide: "Zum Ausblenden klicken",
  criteriaWeights: "Kriteriengewichtung:",
  totalWeights: "Gesamtgewichtung:",
  resetAllTitle: "Alle Profile und Kriterien auf ihre Standardwerte zurücksetzen",
  resetDefaults: "🔄 Standardwerte",
  cancel: "Abbrechen",
  confirmDeleteTitle: "Dieses Modell entfernen?",
  confirmDeleteBody: (name) => `„${name}“ wird aus den verfolgten Modellen entfernt. Die Daten auf OpenRouter bleiben unverändert.`,
  confirmDeleteOk: "Entfernen",
  updatedAgo: (m) => m < 1 ? "gerade aktualisiert" : `vor ${m} Min. aktualisiert`,
  ranking: (name) => `🏆 Rangliste — ${name}`,
  customCriteria: "Eigene Kriterien",
  table: {
    model: "Modell",
    context: "Kontext",
    priceIn: "Eingabe $/M tk",
    priceOut: "Ausgabe $/M tk",
    priceCache: "Cache lesen",
    intel: "Intell.",
    coding: "Code",
    agentic: "Agentisch",
    swe: "SWE",
    vision: "Bilder",
    open: "Offen",
    size: "Größe",
    gpuOk: "GPU OK",
    tools: "Werkzeuge",
    score: "Punkte"
  },
  views: {
    label: "Ansicht:",
    names: { classic: "Karten", stacked: "Score-Balken", columns: "Histogramme", heatmap: "Heatmap", duel: "Duell", value: "Qualität / Kosten" },
    hint: {
      classic: "Top 5 mit Preis und Kontext.",
      stacked: "Jedes Segment = Punkte auf einem Kriterium (Gewicht × Note).",
      columns: "Ein Balken pro Kriterium: Höhe = Note, Breite = Gewicht.",
      heatmap: "Note 0–100 pro Kriterium, schwerste Kriterien zuerst. Spalte anklicken zum Sortieren.",
      duel: "Zwei Modelle wählen und Kriterium für Kriterium vergleichen.",
      value: "Qualität (Kriterien außer Preis) gegen gewichtete Kosten; die gestrichelte Linie verbindet die besten Kompromisse."
    },
    short: {
      intelligence: "Intelligenz",
      coding: "Code",
      agentic: "Agentisch",
      price_in: "Preis Input",
      price_out: "Preis Output",
      cache_read: "Preis Cache",
      context: "Kontext",
      tools: "Werkzeuge",
      has_vision: "Bild",
      open_weights: "Offene Gewichte",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Modell",
    score: "Punkte",
    weight: "Gewicht",
    grade: "Note",
    points: "Pkt.",
    na: "k. A.",
    noCriteria: "Für dieses Profil ist kein Kriterium gewichtet — bearbeiten Sie die Bewertungskriterien.",
    needTwo: "Verfolgen Sie mindestens zwei verfügbare Modelle, um sie zu vergleichen.",
    showAll: (n) => `Alle anzeigen (${n})`,
    showLess: "Weniger anzeigen",
    strength: "Stärke",
    weakness: "Schwäche",
    missingData: "Fehlende Daten zählen als 0",
    winsOn: (n) => `vorn bei ${n} Kriteri${n > 1 ? "en" : "um"}`,
    versus: "vs",
    axisQuality: "Qualität",
    axisCost: "Kosten $/M tk",
    axisCostShort: "Gewichtete Kosten ($/M tk, log. Skala)",
    axisQualityShort: "Qualität (0–100)",
    free: "kostenlos",
    frontier: "Beste Kompromisse",
    frontierHint: "kein anderes Modell ist zugleich günstiger und besser (Pareto-Grenze).",
    others: "Dominiert",
    valueRead: "Oben links ist am besten: niedrige Kosten, hohe Qualität.",
    fieldName: { intelligence_index: "Intelligenz", coding_index: "Code", agentic_index: "Agentisch" },
    estimatedHint: (from, r2, n) => `Geschätzt aus ${from} — lineare Regression über ${n} OpenRouter-Modelle (R² ${r2}). Heatmap-Zelle anklicken, um den echten Wert einzugeben.`,
    manualHint: "Manuell eingegebener Wert (hat Vorrang vor OpenRouter).",
    naHint: "Keine Daten: nicht veröffentlicht und kein anderer Index zur Schätzung.",
    editHint: "Anklicken, um den Wert einzugeben (leer = zurück zu OpenRouter / Schätzung).",
    rawIndex: "Rohindex",
    hasEstimates: "Einige Noten sind geschätzt (~)",
    noQuality: "Dieses Profil gewichtet nur Preise — fügen Sie ein Qualitätskriterium hinzu (Intelligenz, Code…), um Qualität gegen Kosten aufzutragen."
  },
  news: {
    title: "📰 Neuigkeiten & Updates",
    hidePanel: "Bereich ausblenden",
    loading: "Neuigkeiten werden geladen…",
    none: "Keine Neuigkeiten verfügbar.",
    promos: "LAUFENDE AKTIONEN",
    priceChanges: "PREISÄNDERUNGEN",
    newModels: "NEUE MODELLE",
    newModelsHeading: (p) => `🚀 Neue Modelle (${p})`,
    nModels: (n) => `${n} Modell${n > 1 ? "e" : ""}`,
    details: "Einzelheiten",
    follow: "Folgen",
    tracked: "Verfolgt",
    top3: "🔥 Top 3!",
    until: (d) => `⏳ Bis ${d}`,
    threshold: "Schwelle ≥",
    thresholdUnit: "/ 1 T oder 7 T",
    windowLabel: "Zeitraum:",
    windowOpts: { "1m": "1 Monat (Standard)", "2m": "2 Monate", "3m": "3 Monate", "6m": "6 Monate", "1y": "1 Jahr", "all": "Gesamt" },
    sortBy: "Sortieren nach:",
    sortDate: "📅 Datum",
    sortScore: "⭐ Punkte",
    noNewModels: "Keine neuen Modelle in diesem Zeitraum.",
    open: "Neuigkeiten",
    promo: {
      discount: (pct) => `-${pct} %`,
      limited: (i, o) => `Begrenzte OpenRouter-Aktion: ${i} / ${o} pro M tk`,
      price: (i, o) => `${i} Eingabe / ${o} Ausgabe pro M tk`,
      priceWithContext: (i, o, c) => `${i} Eingabe / ${o} Ausgabe pro M tk (${c} Kontext)`,
      priceWithParams: (i, o, p) => `${i} Eingabe / ${o} Ausgabe pro M tk (${p} MoE)`,
      videoRate: (v, r) => `${v} Videogenerierung zu ${r}/s`,
      agenticModel: (v, i, o) => `${v} Agentic-Coding-Modell zu ${i} Eingabe / ${o} Ausgabe`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Tracking-Profil: ${name}`,
    autoFill: "✨ Automatisch ausfüllen",
    autoFillHint: "Das Standardmodell von Hermes bitten, Gewichtungen für dieses Profil vorzuschlagen",
    autoFillRunning: "Modell wird gefragt…",
    autoFillDone: "Vom Modell vorgeschlagene Kriterien — prüfen und speichern.",
    autoFillFailed: "Automatisches Ausfüllen fehlgeschlagen",
    save: "Speichern",
    saving: "Wird gespeichert…",
    cancel: "Abbrechen",
    delete: "Profil löschen",
    deleteConfirm: (name) => `Das Tracking-Profil „${name}“ löschen?`,
    reset: "Alle Profile und Kriterien auf die Standardwerte zurücksetzen?",
    needId: "Bitte geben Sie eine Kennung für das Profil an",
    displayName: "Anzeigename:",
    displayNamePlaceholder: "z. B. DevOps-Spezialist",
    saveError: "Fehler beim Speichern des Profils",
    close: "Schließen"
  },
  criteria: {
    intelligence: "Intelligenz",
    coding: "Codeerzeugung",
    agentic: "Agentische Fähigkeiten",
    price_in: "Preis ↓ Eingabe",
    price_out: "Preis ↓ Ausgabe",
    cache_read: "Preis ↓ Cache",
    context: "Kontextfenster",
    tools: "Tool-Aufrufe",
    has_vision: "Bildverständnis",
    open_weights: "Offene Gewichte",
    fits_64gb: "Lokaler VRAM ≤ 64GB",
    d_intelligence: "Globale Denkfähigkeit und Wissenstiefe",
    d_coding: "Qualität der Codeerzeugung",
    d_agentic: "Agentische Fähigkeiten (mehrstufige Autonomie)",
    d_price_in: "Bedeutung günstiger Input-Tokens",
    d_price_out: "Bedeutung günstiger Output-Tokens",
    d_cache_read: "Bedeutung günstiger gecachter Eingaben",
    d_context: "Fähigkeit, sehr lange Kontexte zu verarbeiten (nahe 1M+ Tokens)",
    d_tools: "Nativer Funktions-/Tool-Aufruf (API, Bash usw.)",
    d_has_vision: "Fähigkeit, Bilder und Screenshots zu verarbeiten",
    d_open_weights: "Offene Gewichte, selbst hostbar",
    d_fits_64gb: "Machbarkeit lokaler Ausführung auf einer Standard-GPU (≤ 64GB)"
  }
};

// src/locales/es.ts
var es = {
  title: "Clasificación de modelos LLM",
  subtitle: "Datos de OpenRouter — precios, benchmarks y noticias",
  refresh: "Actualizar",
  nVisible: (n, extra) => `${n} visibles${extra}`,
  nHidden: (n) => ` (+${n} ocultos)`,
  appliesTo: "Se aplica a",
  editCriteria: "Editar los criterios de puntuación",
  trackingProfile: "Perfil de seguimiento",
  loading: "Cargando…",
  loadError: "No se han podido cargar los modelos seguidos",
  retry: "Reintentar",
  searchPlaceholder: "Buscar un modelo…",
  search: "Buscar",
  searchUntracked: "Buscar modelos no seguidos",
  tableTitle: "Modelos seguidos",
  results: (n) => `Resultados (${n})`,
  alreadyTracked: "Seguido",
  add: "Añadir",
  show: "Mostrar",
  hide: "Ocultar",
  removeModel: "Quitar modelo",
  suppressShort: "¿Borrar?",
  clickToShow: "Clic para mostrar",
  clickToHide: "Clic para ocultar",
  criteriaWeights: "Pesos de los criterios:",
  totalWeights: "Peso total:",
  resetAllTitle: "Restablecer todos los perfiles y criterios a su valor por defecto",
  resetDefaults: "🔄 Restablecer",
  cancel: "Cancelar",
  confirmDeleteTitle: "¿Quitar este modelo?",
  confirmDeleteBody: (name) => `“${name}” se quitará de los modelos seguidos. Los datos no se modifican en OpenRouter.`,
  confirmDeleteOk: "Quitar",
  updatedAgo: (m) => m < 1 ? "actualizado justo ahora" : `actualizado hace ${m} min`,
  ranking: (name) => `🏆 Clasificación — ${name}`,
  customCriteria: "Criterios personalizados",
  table: {
    model: "Modelo",
    context: "Contexto",
    priceIn: "Entrada $/M tk",
    priceOut: "Salida $/M tk",
    priceCache: "Lectura de caché",
    intel: "Intel.",
    coding: "Código",
    agentic: "Agéntico",
    swe: "SWE",
    vision: "Visión",
    open: "Abierto",
    size: "Tamaño",
    gpuOk: "GPU OK",
    tools: "Herramientas",
    score: "Puntos"
  },
  views: {
    label: "Vista:",
    names: { classic: "Tarjetas", stacked: "Barras de puntos", columns: "Histogramas", heatmap: "Mapa de calor", duel: "Duelo", value: "Calidad / coste" },
    hint: {
      classic: "Los 5 mejores con precio y contexto.",
      stacked: "Cada segmento = puntos obtenidos en un criterio (peso × nota).",
      columns: "Una barra por criterio: altura = nota, anchura = peso.",
      heatmap: "Nota de 0 a 100 por criterio, primero los criterios con más peso. Haz clic en una columna para ordenar.",
      duel: "Elige dos modelos y compáralos criterio por criterio.",
      value: "Calidad (criterios distintos del precio) frente al coste ponderado; la línea discontinua une las mejores relaciones calidad/precio."
    },
    short: {
      intelligence: "Inteligencia",
      coding: "Código",
      agentic: "Agéntico",
      price_in: "Precio entrada",
      price_out: "Precio salida",
      cache_read: "Precio caché",
      context: "Contexto",
      tools: "Herramientas",
      has_vision: "Visión",
      open_weights: "Pesos abiertos",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Modelo",
    score: "Puntos",
    weight: "peso",
    grade: "nota",
    points: "pts",
    na: "n/d",
    noCriteria: "Ningún criterio tiene peso en este perfil — edita los criterios de puntuación.",
    needTwo: "Sigue al menos dos modelos disponibles para poder compararlos.",
    showAll: (n) => `Mostrar todo (${n})`,
    showLess: "Mostrar menos",
    strength: "Punto fuerte",
    weakness: "Punto débil",
    missingData: "Los datos que faltan cuentan como 0",
    winsOn: (n) => `por delante en ${n} criterio${n > 1 ? "s" : ""}`,
    versus: "vs",
    axisQuality: "Calidad",
    axisCost: "Coste $/M tk",
    axisCostShort: "Coste ponderado ($/M tk, escala logarítmica)",
    axisQualityShort: "Calidad (0–100)",
    free: "gratis",
    frontier: "Mejores relaciones",
    frontierHint: "ningún otro modelo es a la vez más barato y mejor (frontera de Pareto).",
    others: "Dominados",
    valueRead: "Arriba a la izquierda es mejor: coste bajo, calidad alta.",
    fieldName: { intelligence_index: "Inteligencia", coding_index: "Código", agentic_index: "Agéntico" },
    estimatedHint: (from, r2, n) => `Estimado a partir de ${from} — ajuste lineal sobre ${n} modelos de OpenRouter (R² ${r2}). Haz clic en una celda del mapa de calor para introducir el valor real.`,
    manualHint: "Valor introducido manualmente (sustituye a OpenRouter).",
    naHint: "Sin datos: no se publica y no hay otro índice del que estimarlo.",
    editHint: "Haz clic para introducir el valor (vacío = volver a OpenRouter / a la estimación).",
    rawIndex: "índice bruto",
    hasEstimates: "Algunas notas son estimadas (~)",
    noQuality: "Este perfil solo pondera precios — añade un criterio de calidad (inteligencia, código…) para representar la calidad frente al coste."
  },
  news: {
    title: "📰 Noticias y novedades",
    hidePanel: "Ocultar el panel",
    loading: "Cargando noticias…",
    none: "No hay noticias disponibles.",
    promos: "PROMOCIONES ACTIVAS",
    priceChanges: "CAMBIOS DE PRECIO",
    newModels: "NUEVOS MODELOS",
    newModelsHeading: (p) => `🚀 Nuevos modelos (${p})`,
    nModels: (n) => `${n} modelo${n > 1 ? "s" : ""}`,
    details: "Detalles",
    follow: "Seguir",
    tracked: "Seguido",
    top3: "🔥 ¡Top 3!",
    until: (d) => `⏳ Hasta el ${d}`,
    threshold: "Umbral ≥",
    thresholdUnit: "/ 1d o 7d",
    windowLabel: "Periodo:",
    windowOpts: { "1m": "1 mes (por defecto)", "2m": "2 meses", "3m": "3 meses", "6m": "6 meses", "1y": "1 año", "all": "Todo" },
    sortBy: "Ordenar por:",
    sortDate: "📅 Fecha",
    sortScore: "⭐ Puntuación",
    noNewModels: "Ningún modelo nuevo en este periodo.",
    open: "Noticias",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Promoción limitada de OpenRouter: ${i} / ${o} por M tk`,
      price: (i, o) => `${i} entrada / ${o} salida por M tk`,
      priceWithContext: (i, o, c) => `${i} entrada / ${o} salida por M tk (${c} ctx)`,
      priceWithParams: (i, o, p) => `${i} entrada / ${o} salida por M tk (${p} MoE)`,
      videoRate: (v, r) => `${v} generación de vídeo a ${r}/s`,
      agenticModel: (v, i, o) => `${v} modelo de código agéntico a ${i} entrada / ${o} salida`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Perfil de seguimiento: ${name}`,
    autoFill: "✨ Autorrellenar",
    autoFillHint: "Pedir al modelo por defecto de Hermes que proponga pesos para este perfil",
    autoFillRunning: "Consultando al modelo…",
    autoFillDone: "Criterios propuestos por el modelo — revísalos y guarda.",
    autoFillFailed: "Error al autorrellenar",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    delete: "Eliminar el perfil",
    deleteConfirm: (name) => `¿Eliminar el perfil de seguimiento «${name}»?`,
    reset: "¿Restablecer todos los perfiles y criterios a sus valores por defecto?",
    needId: "Indica un identificador para el perfil",
    displayName: "Nombre visible:",
    displayNamePlaceholder: "p. ej. Especialista DevOps",
    saveError: "Error al guardar el perfil",
    close: "Cerrar"
  },
  criteria: {
    intelligence: "Inteligencia",
    coding: "Código",
    agentic: "Agéntico",
    price_in: "Precio ↓ entrada",
    price_out: "Precio ↓ salida",
    cache_read: "Precio ↓ caché",
    context: "Ventana de contexto",
    tools: "Llamadas a herramientas",
    has_vision: "Visión",
    open_weights: "Pesos abiertos",
    fits_64gb: "VRAM local ≤ 64GB",
    d_intelligence: "Razonamiento global y profundidad de conocimiento",
    d_coding: "Calidad de generación de código",
    d_agentic: "Capacidades agénticas (autonomía multipaso)",
    d_price_in: "Importancia de unos tokens de entrada baratos",
    d_price_out: "Importancia de unos tokens de salida baratos",
    d_cache_read: "Importancia de una entrada en caché barata",
    d_context: "Capacidad de procesar contextos muy largos (cerca de 1M+ tokens)",
    d_tools: "Llamada nativa a funciones/herramientas (API, Bash, etc.)",
    d_has_vision: "Capacidad de procesar imágenes y capturas de pantalla",
    d_open_weights: "Pesos abiertos, se puede autoalojar",
    d_fits_64gb: "Viabilidad de ejecución local en una GPU estándar (≤ 64GB)"
  }
};

// src/locales/ga.ts
var ga = {
  title: "Clár ceannais samhlacha LLM",
  subtitle: "Sonraí OpenRouter — praghsanna, tagarmharcanna agus nuacht",
  refresh: "Athnuaigh",
  nVisible: (n, extra) => `${n} le feiceáil${extra}`,
  nHidden: (n) => ` (+${n} i bhfolach)`,
  appliesTo: "Baineann le",
  editCriteria: "Cuir critéir scórála in eagar",
  trackingProfile: "Próifíl rianaithe",
  loading: "Á lódáil…",
  loadError: "Níorbh fhéidir na samhlacha rianaithe a lódáil",
  retry: "Bain triail eile as",
  searchPlaceholder: "Cuardaigh samhail…",
  search: "Cuardaigh",
  searchUntracked: "Cuardaigh samhlacha nach bhfuil rianaithe",
  tableTitle: "Samhlacha rianaithe",
  results: (n) => `Torthaí (${n})`,
  alreadyTracked: "Rianaithe",
  add: "Cuir leis",
  show: "Taispeáin",
  hide: "Folaigh",
  removeModel: "Bain an tsamhail",
  suppressShort: "Scrios?",
  clickToShow: "Cliceáil le taispeáint",
  clickToHide: "Cliceáil lena fholú",
  criteriaWeights: "Ualú critéar:",
  totalWeights: "Iomlán na n-ualach:",
  resetAllTitle: "Athshocraigh gach próifíl agus critéar go dtí a luach réamhshocraithe",
  resetDefaults: "🔄 Athshocraigh réamhshocruithe",
  cancel: "Cealaigh",
  confirmDeleteTitle: "Bain an tsamhail seo?",
  confirmDeleteBody: (name) => `Bainfear “${name}” de na samhlacha rianaithe. Fanfaidh na sonraí ar OpenRouter gan athrú.`,
  confirmDeleteOk: "Bain",
  updatedAgo: (m) => m < 1 ? "nuashonraithe díreach anois" : `nuashonraithe ${m} nóim ó shin`,
  ranking: (name) => `🏆 Rangú — ${name}`,
  customCriteria: "Critéir shaincheaptha",
  table: {
    model: "Samhail",
    context: "Comhthéacs",
    priceIn: "Ionchur $/M tk",
    priceOut: "Aschur $/M tk",
    priceCache: "Léamh taisce",
    intel: "Intel.",
    coding: "Códú",
    agentic: "Gníomhaíoch",
    swe: "SWE",
    vision: "Radharc",
    open: "Oscailte",
    size: "Méid",
    gpuOk: "GPU OK",
    tools: "Uirlisí",
    score: "Scór"
  },
  views: {
    label: "Amharc:",
    names: { classic: "Cártaí", stacked: "Barraí scóir", columns: "Histeagraim", heatmap: "Léarscáil teasa", duel: "Comhrac", value: "Cáilíocht / costas" },
    hint: {
      classic: "Barr 5 le praghas agus comhthéacs.",
      stacked: "Gach mír = pointí a thuilltear ar chritéar amháin (ualú × grád).",
      columns: "Barra amháin in aghaidh an chritéir: airde = grád, leithead = ualú.",
      heatmap: "Grád 0–100 in aghaidh an chritéir, na critéir is troime ar dtús. Cliceáil ar cholún le sórtáil.",
      duel: "Roghnaigh dhá shamhail agus cuir i gcomparáid iad critéar ar chritéar.",
      value: "Cáilíocht (critéir seachas praghas) i gcoinne costais ualaithe; nascann an líne bhriste na comhréitigh is fearr."
    },
    short: {
      intelligence: "Intleacht",
      coding: "Códú",
      agentic: "Gníomhaíoch",
      price_in: "Praghas ionchuir",
      price_out: "Praghas aschuir",
      cache_read: "Praghas taisce",
      context: "Comhthéacs",
      tools: "Uirlisí",
      has_vision: "Radharc",
      open_weights: "Ualaí oscailte",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Samhail",
    score: "Scór",
    weight: "ualú",
    grade: "grád",
    points: "pt",
    na: "n/b",
    noCriteria: "Níl aon chritéar ualaithe don phróifíl seo — cuir na critéir scórála in eagar.",
    needTwo: "Rianaigh ar a laghad dhá shamhail atá ar fáil le hiad a chur i gcomparáid.",
    showAll: (n) => `Taispeáin uile (${n})`,
    showLess: "Taispeáin níos lú",
    strength: "Neart",
    weakness: "Laige",
    missingData: "Ríomhtar sonraí atá ar iarraidh mar 0",
    winsOn: (n) => `chun tosaigh ar ${n} gcritéar`,
    versus: "vs",
    axisQuality: "Cáilíocht",
    axisCost: "Costas $/M tk",
    axisCostShort: "Costas ualaithe ($/M tk, scála log)",
    axisQualityShort: "Cáilíocht (0–100)",
    free: "saor in aisce",
    frontier: "Na comhréitigh is fearr",
    frontierHint: "níl aon samhail eile atá níos saoire agus níos fearr ag an am céanna (teorainn Pareto).",
    others: "Faoi cheannas",
    valueRead: "Is fearr an chúinne uachtarach clé: costas íseal, cáilíocht ard.",
    fieldName: { intelligence_index: "Intleacht", coding_index: "Códú", agentic_index: "Gníomhaíoch" },
    estimatedHint: (from, r2, n) => `Measta ó ${from} — feistiú líneach ar ${n} samhail OpenRouter (R² ${r2}). Cliceáil ar chill den léarscáil teasa le luach fíor a chur isteach.`,
    manualHint: "Luach curtha isteach de láimh (sáraíonn sé OpenRouter).",
    naHint: "Gan sonraí: níl sé foilsithe, agus níl aon innéacs eile le meastachán a dhéanamh air.",
    editHint: "Cliceáil le luach a chur isteach (folamh = ar ais go OpenRouter / meastachán).",
    rawIndex: "amh-innéacs",
    hasEstimates: "Tá roinnt grád measta (~)",
    noQuality: "Ní chuireann an phróifíl seo ualú ach ar phraghsanna — cuir critéar cáilíochta leis (intleacht, códú…) chun cáilíocht a phlótáil i gcoinne costais."
  },
  news: {
    title: "📰 Nuacht agus nuashonruithe",
    hidePanel: "Folaigh an painéal",
    loading: "Nuacht á lódáil…",
    none: "Níl aon nuacht ar fáil.",
    promos: "FÓGRAÍ REATHA",
    priceChanges: "ATHRAITHE PRAGHAS",
    newModels: "SAMHLACHA NUA",
    newModelsHeading: (p) => `🚀 Samhlacha nua (${p})`,
    nModels: (n) => `${n} ${n > 1 ? "samhlacha" : "samhail"}`,
    details: "Sonraí",
    follow: "Lean",
    tracked: "Rianaithe",
    top3: "🔥 Barr 3!",
    until: (d) => `⏳ Go dtí ${d}`,
    threshold: "Tairseach ≥",
    thresholdUnit: "/ 1 lá nó 7 lá",
    windowLabel: "Tréimhse:",
    windowOpts: { "1m": "1 mhí (réamhshocrú)", "2m": "2 mhí", "3m": "3 mhí", "6m": "6 mhí", "1y": "1 bhliain", "all": "Uile" },
    sortBy: "Sórtáil de réir:",
    sortDate: "📅 Dáta",
    sortScore: "⭐ Scór",
    noNewModels: "Níl aon samhail nua sa tréimhse seo.",
    open: "Nuacht",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Tairiscint theoranta OpenRouter: ${i} / ${o} in aghaidh M tk`,
      price: (i, o) => `${i} ionchur / ${o} aschur in aghaidh M tk`,
      priceWithContext: (i, o, c) => `${i} ionchur / ${o} aschur in aghaidh M tk (${c} comhthéacs)`,
      priceWithParams: (i, o, p) => `${i} ionchur / ${o} aschur in aghaidh M tk (${p} MoE)`,
      videoRate: (v, r) => `${v} giniúint físe ag ${r}/s`,
      agenticModel: (v, i, o) => `${v} samhail chódaithe ghníomhaíoch ag ${i} ionchur / ${o} aschur`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Próifíl rianaithe: ${name}`,
    autoFill: "✨ Líon go huathoibríoch",
    autoFillHint: "Iarr ar mhúnla réamhshocraithe Hermes ualaí a mholadh don phróifíl seo",
    autoFillRunning: "Múnla á fhiafraí…",
    autoFillDone: "Critéir mholta ag an múnla — déan athbhreithniú agus sábháil.",
    autoFillFailed: "Theip ar an líonadh uathoibríoch",
    save: "Sábháil",
    saving: "Á shábháil…",
    cancel: "Cealaigh",
    delete: "Scrios an phróifíl",
    deleteConfirm: (name) => `Scrios an phróifíl rianaithe '${name}'?`,
    reset: "Athshocraigh gach próifíl agus critéar go dtí na luachanna réamhshocraithe?",
    needId: "Tabhair aitheantóir don phróifíl, le do thoil",
    displayName: "Ainm taispeána:",
    displayNamePlaceholder: "m.sh. Speisialtóir DevOps",
    saveError: "Earráid agus an phróifíl á sábháil",
    close: "Dún"
  },
  criteria: {
    intelligence: "Intleacht",
    coding: "Códú",
    agentic: "Gníomhaíocht",
    price_in: "Praghas ↓ ionchur",
    price_out: "Praghas ↓ aschur",
    cache_read: "Praghas ↓ taisce",
    context: "Fuinneog comhthéacs",
    tools: "Glaonna uirlise",
    has_vision: "Radharc",
    open_weights: "Ualaí oscailte",
    fits_64gb: "VRAM áitiúil ≤ 64GB",
    d_intelligence: "Réasúnaíocht dhomhanda agus doimhneacht eolais",
    d_coding: "Cáilíocht na giniúna cóid",
    d_agentic: "Cumais ghníomhaíocha (neamhspleáchas ilchéime)",
    d_price_in: "Tábhacht tokens ionchuir saoire",
    d_price_out: "Tábhacht tokens aschuir saoire",
    d_cache_read: "Tábhacht ionchuir thaiscthe shaor",
    d_context: "Cumas comhthéacsanna an-fhada a phróiseáil (gar do 1M+ tokens)",
    d_tools: "Glao feidhme/uirlise dúchasach (API, Bash, srl.)",
    d_has_vision: "Cumas íomhánna agus seatghrianghraif a phróiseáil",
    d_open_weights: "Ualaí oscailte, féinóstáilte",
    d_fits_64gb: "Indéantacht rith áitiúil ar GPU caighdeánach (≤ 64GB)"
  }
};

// src/locales/hu.ts
var hu = {
  title: "LLM-modell ranglista",
  subtitle: "OpenRouter-adatok — árak, benchmarkok és hírek",
  refresh: "Frissítés",
  nVisible: (n, extra) => `${n} látható${extra}`,
  nHidden: (n) => ` (+${n} rejtett)`,
  appliesTo: "Érvényes erre",
  editCriteria: "Pontozási szempontok szerkesztése",
  trackingProfile: "Követett profil",
  loading: "Betöltés…",
  loadError: "A követett modellek betöltése nem sikerült",
  retry: "Újra",
  searchPlaceholder: "Modell keresése…",
  search: "Keresés",
  searchUntracked: "Nem követett modellek keresése",
  tableTitle: "Követett modellek",
  results: (n) => `Találatok (${n})`,
  alreadyTracked: "Követve",
  add: "Hozzáadás",
  show: "Mutat",
  hide: "Elrejtés",
  removeModel: "Modell eltávolítása",
  suppressShort: "Törlés?",
  clickToShow: "Kattints a megjelenítéshez",
  clickToHide: "Kattints az elrejtéshez",
  criteriaWeights: "Szempontok súlyai:",
  totalWeights: "Összes súly:",
  resetAllTitle: "Minden profil és szempont visszaállítása az alapértékre",
  resetDefaults: "🔄 Alapértékek visszaállítása",
  cancel: "Mégse",
  confirmDeleteTitle: "Eltávolítod ezt a modellt?",
  confirmDeleteBody: (name) => `A(z) „${name}” eltávolításra kerül a követett modellek közül. Az adatok érintetlenek maradnak az OpenRouteren.`,
  confirmDeleteOk: "Eltávolítás",
  updatedAgo: (m) => m < 1 ? "most frissült" : `${m} perccel ezelőtt frissült`,
  ranking: (name) => `🏆 Ranglista — ${name}`,
  customCriteria: "Egyéni szempontok",
  table: {
    model: "Modell",
    context: "Kontextus",
    priceIn: "Bemenet $/M tk",
    priceOut: "Kimenet $/M tk",
    priceCache: "Gyorsítótár-olvasás",
    intel: "Intell.",
    coding: "Kódolás",
    agentic: "Ügynök",
    swe: "SWE",
    vision: "Látás",
    open: "Nyílt",
    size: "Méret",
    gpuOk: "GPU OK",
    tools: "Eszközök",
    score: "Pontszám"
  },
  views: {
    label: "Nézet:",
    names: { classic: "Kártyák", stacked: "Pontsávok", columns: "Hisztogramok", heatmap: "Hőtérkép", duel: "Párbaj", value: "Minőség / költség" },
    hint: {
      classic: "Top 5 árral és kontextussal.",
      stacked: "Minden szegmens = egy szemponton szerzett pont (súly × osztályzat).",
      columns: "Egy sáv szempontonként: magasság = osztályzat, szélesség = súly.",
      heatmap: "0–100 osztályzat szempontonként, a legnagyobb súlyúak elöl. Kattints egy oszlopra a rendezéshez.",
      duel: "Válassz két modellt, és hasonlítsd össze őket szempontról szempontra.",
      value: "Minőség (nem ár jellegű szempontok) a súlyozott költség függvényében; a szaggatott vonal a legjobb kompromisszumokat köti össze."
    },
    short: {
      intelligence: "Intelligencia",
      coding: "Kódolás",
      agentic: "Ügynök",
      price_in: "Bemeneti ár",
      price_out: "Kimeneti ár",
      cache_read: "Gyorsítótár ára",
      context: "Kontextus",
      tools: "Eszközök",
      has_vision: "Látás",
      open_weights: "Nyílt súlyok",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Modell",
    score: "Pontszám",
    weight: "súly",
    grade: "osztályzat",
    points: "pont",
    na: "nincs",
    noCriteria: "Ebben a profilban egyetlen szempont sincs súlyozva — szerkeszd a pontozási szempontokat.",
    needTwo: "Az összehasonlításhoz legalább két elérhető modellt kövess.",
    showAll: (n) => `Összes megjelenítése (${n})`,
    showLess: "Kevesebb megjelenítése",
    strength: "Erősség",
    weakness: "Gyengeség",
    missingData: "A hiányzó adat 0-nak számít",
    winsOn: (n) => `${n} szempontban vezet`,
    versus: "vs",
    axisQuality: "Minőség",
    axisCost: "Költség $/M tk",
    axisCostShort: "Súlyozott költség ($/M tk, logaritmikus skála)",
    axisQualityShort: "Minőség (0–100)",
    free: "ingyenes",
    frontier: "Legjobb kompromisszumok",
    frontierHint: "nincs más modell, amely egyszerre olcsóbb és jobb lenne (Pareto-front).",
    others: "Dominált",
    valueRead: "A bal felső a legjobb: alacsony költség, magas minőség.",
    fieldName: { intelligence_index: "Intelligencia", coding_index: "Kódolás", agentic_index: "Ügynök" },
    estimatedHint: (from, r2, n) => `A(z) ${from} alapján becsülve — lineáris illesztés ${n} OpenRouter-modellen (R² ${r2}). Kattints egy hőtérkép-cellára a valós érték megadásához.`,
    manualHint: "Kézzel megadott érték (felülírja az OpenRoutert).",
    naHint: "Nincs adat: nem publikált, és nincs más index, amiből becsülni lehetne.",
    editHint: "Kattints az érték megadásához (üres = vissza az OpenRouterre / becslésre).",
    rawIndex: "nyers index",
    hasEstimates: "Néhány osztályzat becsült (~)",
    noQuality: "Ez a profil csak árakat súlyoz — adj hozzá egy minőség szempontot (intelligencia, kódolás…), hogy a minőséget a költség függvényében ábrázolhasd."
  },
  news: {
    title: "📰 Hírek és frissítések",
    hidePanel: "Panel elrejtése",
    loading: "Hírek betöltése…",
    none: "Nincs elérhető hír.",
    promos: "AKTÍV AKCIÓK",
    priceChanges: "ÁRVÁLTOZÁSOK",
    newModels: "ÚJ MODELLEK",
    newModelsHeading: (p) => `🚀 Új modellek (${p})`,
    nModels: (n) => `${n} modell`,
    details: "Részletek",
    follow: "Követés",
    tracked: "Követve",
    top3: "🔥 Legjobb 3!",
    until: (d) => `⏳ ${d} időpontig`,
    threshold: "Küszöb ≥",
    thresholdUnit: "/ 1 nap vagy 7 nap",
    windowLabel: "Időszak:",
    windowOpts: { "1m": "1 hónap (alapértelmezett)", "2m": "2 hónap", "3m": "3 hónap", "6m": "6 hónap", "1y": "1 év", "all": "Összes" },
    sortBy: "Rendezés:",
    sortDate: "📅 Dátum",
    sortScore: "⭐ Pontszám",
    noNewModels: "Ebben az időszakban nincs új modell.",
    open: "Hírek",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Korlátozott OpenRouter-akció: ${i} / ${o} M tk-onként`,
      price: (i, o) => `${i} bemenet / ${o} kimenet M tk-onként`,
      priceWithContext: (i, o, c) => `${i} bemenet / ${o} kimenet M tk-onként (${c} kontextus)`,
      priceWithParams: (i, o, p) => `${i} bemenet / ${o} kimenet M tk-onként (${p} MoE)`,
      videoRate: (v, r) => `${v} videógenerálás ${r}/mp áron`,
      agenticModel: (v, i, o) => `${v} ügynök kódoló modell ${i} bemenet / ${o} kimenet áron`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Követési profil: ${name}`,
    autoFill: "✨ Automatikus kitöltés",
    autoFillHint: "Kérd meg a Hermes alapértelmezett modelljét, hogy súlyokat javasoljon ehhez a profilhoz",
    autoFillRunning: "A modell válaszol…",
    autoFillDone: "A modell által javasolt szempontok — nézd át és mentsd el.",
    autoFillFailed: "Az automatikus kitöltés nem sikerült",
    save: "Mentés",
    saving: "Mentés…",
    cancel: "Mégse",
    delete: "Profil törlése",
    deleteConfirm: (name) => `Törlöd a(z) '${name}' követési profilt?`,
    reset: "Minden profil és szempont visszaállítása az alapértékekre?",
    needId: "Adj meg egy azonosítót a profilhoz",
    displayName: "Megjelenített név:",
    displayNamePlaceholder: "pl. DevOps-specialista",
    saveError: "Hiba a profil mentése közben",
    close: "Bezárás"
  },
  criteria: {
    intelligence: "Intelligencia",
    coding: "Kódolás",
    agentic: "Ügynök",
    price_in: "Ár ↓ bemenet",
    price_out: "Ár ↓ kimenet",
    cache_read: "Ár ↓ gyorsítótár",
    context: "Kontextusablak",
    tools: "Eszközhívások",
    has_vision: "Látás",
    open_weights: "Nyílt súlyok",
    fits_64gb: "Helyi VRAM ≤ 64GB",
    d_intelligence: "Általános érvelés és tudásmélység",
    d_coding: "Kódgenerálás minősége",
    d_agentic: "Ügynökképességek (többlépéses autonómia)",
    d_price_in: "Az olcsó bemeneti tokenek fontossága",
    d_price_out: "Az olcsó kimeneti tokenek fontossága",
    d_cache_read: "Az olcsó gyorsítótárazott bemenet fontossága",
    d_context: "Nagyon hosszú kontextusok feldolgozása (közel 1M+ token)",
    d_tools: "Natív függvény-/eszközhívás (API, Bash stb.)",
    d_has_vision: "Képek és képernyőképek feldolgozása",
    d_open_weights: "Nyílt súlyok, saját üzemeltetés",
    d_fits_64gb: "Helyi futtatás lehetősége szabványos GPU-n (≤ 64GB)"
  }
};

// src/locales/it.ts
var it = {
  title: "Classifica dei modelli LLM",
  subtitle: "Dati OpenRouter — prezzi, benchmark e notizie",
  refresh: "Aggiorna",
  nVisible: (n, extra) => `${n} visibili${extra}`,
  nHidden: (n) => ` (+${n} nascosti)`,
  appliesTo: "Si applica a",
  editCriteria: "Modifica i criteri di valutazione",
  trackingProfile: "Profilo di monitoraggio",
  loading: "Caricamento…",
  loadError: "Impossibile caricare i modelli monitorati",
  retry: "Riprova",
  searchPlaceholder: "Cerca un modello…",
  search: "Cerca",
  searchUntracked: "Cerca tra i modelli non monitorati",
  tableTitle: "Modelli monitorati",
  results: (n) => `Risultati (${n})`,
  alreadyTracked: "Monitorato",
  add: "Aggiungi",
  show: "Mostra",
  hide: "Nascondi",
  removeModel: "Rimuovi modello",
  suppressShort: "Elim.?",
  clickToShow: "Clicca per mostrare",
  clickToHide: "Clicca per nascondere",
  criteriaWeights: "Pesi dei criteri:",
  totalWeights: "Peso totale:",
  resetAllTitle: "Ripristina tutti i profili e i criteri ai valori predefiniti",
  resetDefaults: "🔄 Ripristina predefiniti",
  cancel: "Annulla",
  confirmDeleteTitle: "Rimuovere questo modello?",
  confirmDeleteBody: (name) => `«${name}» sarà rimosso dai modelli monitorati. I dati su OpenRouter restano invariati.`,
  confirmDeleteOk: "Rimuovi",
  updatedAgo: (m) => m < 1 ? "aggiornato ora" : `aggiornato ${m} min fa`,
  ranking: (name) => `🏆 Classifica — ${name}`,
  customCriteria: "Criteri personalizzati",
  table: {
    model: "Modello",
    context: "Contesto",
    priceIn: "Ingresso $/M tk",
    priceOut: "Uscita $/M tk",
    priceCache: "Lettura cache",
    intel: "Intell.",
    coding: "Codice",
    agentic: "Agentico",
    swe: "SWE",
    vision: "Visione",
    open: "Aperto",
    size: "Dimensione",
    gpuOk: "GPU OK",
    tools: "Strumenti",
    score: "Punteggio"
  },
  views: {
    label: "Vista:",
    names: { classic: "Schede", stacked: "Barre di punteggio", columns: "Istogrammi", heatmap: "Mappa di calore", duel: "Duello", value: "Qualità / costo" },
    hint: {
      classic: "Top 5 con prezzo e contesto.",
      stacked: "Ogni segmento = punti ottenuti su un criterio (peso × voto).",
      columns: "Una barra per criterio: altezza = voto, larghezza = peso.",
      heatmap: "Voto 0–100 per criterio, criteri più pesanti per primi. Clicca una colonna per ordinare.",
      duel: "Scegli due modelli e confrontali criterio per criterio.",
      value: "Qualità (criteri diversi dal prezzo) rispetto al costo ponderato; la linea tratteggiata collega i migliori compromessi."
    },
    short: {
      intelligence: "Intelligenza",
      coding: "Codice",
      agentic: "Agentico",
      price_in: "Prezzo input",
      price_out: "Prezzo output",
      cache_read: "Prezzo cache",
      context: "Contesto",
      tools: "Strumenti",
      has_vision: "Visione",
      open_weights: "Pesi aperti",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Modello",
    score: "Punteggio",
    weight: "peso",
    grade: "voto",
    points: "pti",
    na: "n/d",
    noCriteria: "Nessun criterio è ponderato per questo profilo — modifica i criteri di valutazione.",
    needTwo: "Monitora almeno due modelli disponibili per confrontarli.",
    showAll: (n) => `Mostra tutto (${n})`,
    showLess: "Mostra meno",
    strength: "Punto di forza",
    weakness: "Debolezza",
    missingData: "I dati mancanti valgono 0",
    winsOn: (n) => `avanti su ${n} criter${n > 1 ? "i" : "io"}`,
    versus: "vs",
    axisQuality: "Qualità",
    axisCost: "Costo $/M tk",
    axisCostShort: "Costo ponderato ($/M tk, scala log)",
    axisQualityShort: "Qualità (0–100)",
    free: "gratuito",
    frontier: "Migliori compromessi",
    frontierHint: "nessun altro modello è insieme più economico e migliore (frontiera di Pareto).",
    others: "Dominati",
    valueRead: "In alto a sinistra è meglio: costo basso, qualità alta.",
    fieldName: { intelligence_index: "Intelligenza", coding_index: "Codice", agentic_index: "Agentico" },
    estimatedHint: (from, r2, n) => `Stimato da ${from} — regressione lineare su ${n} modelli OpenRouter (R² ${r2}). Clicca una cella della mappa di calore per inserire il valore reale.`,
    manualHint: "Valore inserito manualmente (prevale su OpenRouter).",
    naHint: "Nessun dato: non pubblicato e nessun altro indice per stimarlo.",
    editHint: "Clicca per inserire il valore (vuoto = torna a OpenRouter / stima).",
    rawIndex: "indice grezzo",
    hasEstimates: "Alcuni voti sono stimati (~)",
    noQuality: "Questo profilo pondera solo i prezzi — aggiungi un criterio di qualità (intelligenza, codice…) per tracciare qualità e costo."
  },
  news: {
    title: "📰 Notizie e aggiornamenti",
    hidePanel: "Nascondi pannello",
    loading: "Caricamento notizie…",
    none: "Nessuna notizia disponibile.",
    promos: "PROMOZIONI IN CORSO",
    priceChanges: "VARIAZIONI DI PREZZO",
    newModels: "NUOVI MODELLI",
    newModelsHeading: (p) => `🚀 Nuovi modelli (${p})`,
    nModels: (n) => `${n} modell${n > 1 ? "i" : "o"}`,
    details: "Dettagli",
    follow: "Segui",
    tracked: "Monitorato",
    top3: "🔥 Top 3!",
    until: (d) => `⏳ Fino al ${d}`,
    threshold: "Soglia ≥",
    thresholdUnit: "/ 1g o 7g",
    windowLabel: "Intervallo:",
    windowOpts: { "1m": "1 mese (predefinito)", "2m": "2 mesi", "3m": "3 mesi", "6m": "6 mesi", "1y": "1 anno", "all": "Tutto" },
    sortBy: "Ordina per:",
    sortDate: "📅 Data",
    sortScore: "⭐ Punteggio",
    noNewModels: "Nessun nuovo modello in questo periodo.",
    open: "Notizie",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Promozione OpenRouter limitata: ${i} / ${o} per M tk`,
      price: (i, o) => `${i} input / ${o} output per M tk`,
      priceWithContext: (i, o, c) => `${i} input / ${o} output per M tk (${c} ctx)`,
      priceWithParams: (i, o, p) => `${i} input / ${o} output per M tk (${p} MoE)`,
      videoRate: (v, r) => `Generazione video ${v} a ${r}/s`,
      agenticModel: (v, i, o) => `Modello agentic coding ${v} a ${i} input / ${o} output`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Profilo di monitoraggio: ${name}`,
    autoFill: "✨ Compilazione automatica",
    autoFillHint: "Chiedi al modello predefinito di Hermes di proporre i pesi per questo profilo",
    autoFillRunning: "Domanda al modello…",
    autoFillDone: "Criteri proposti dal modello — verifica e salva.",
    autoFillFailed: "Compilazione automatica non riuscita",
    save: "Salva",
    saving: "Salvataggio…",
    cancel: "Annulla",
    delete: "Elimina profilo",
    deleteConfirm: (name) => `Eliminare il profilo di monitoraggio '${name}'?`,
    reset: "Ripristinare tutti i profili e i criteri ai valori predefiniti?",
    needId: "Inserisci un identificatore per il profilo",
    displayName: "Nome visualizzato:",
    displayNamePlaceholder: "es. specialista DevOps",
    saveError: "Errore durante il salvataggio del profilo",
    close: "Chiudi"
  },
  criteria: {
    intelligence: "Intelligenza",
    coding: "Generazione di codice",
    agentic: "Capacità agentiche",
    price_in: "Prezzo ↓ input",
    price_out: "Prezzo ↓ output",
    cache_read: "Prezzo ↓ cache",
    context: "Finestra di contesto",
    tools: "Chiamate agli strumenti",
    has_vision: "Visione",
    open_weights: "Pesi aperti",
    fits_64gb: "VRAM locale ≤ 64GB",
    d_intelligence: "Capacità di ragionamento e profondità di conoscenza",
    d_coding: "Qualità della generazione di codice",
    d_agentic: "Capacità agentiche (autonomia multi-step)",
    d_price_in: "Importanza di token di input economici",
    d_price_out: "Importanza di token di output economici",
    d_cache_read: "Importanza di input in cache economici",
    d_context: "Capacità di elaborare contesti molto lunghi (vicini a 1M+ token)",
    d_tools: "Chiamata nativa di funzioni/strumenti (API, Bash, ecc.)",
    d_has_vision: "Capacità di elaborare immagini e screenshot",
    d_open_weights: "Pesi aperti, self-hostable",
    d_fits_64gb: "Fattibilità di esecuzione locale su GPU standard (≤ 64GB)"
  }
};

// src/locales/ja.ts
var ja = {
  title: "LLM モデルリーダーボード",
  subtitle: "OpenRouter データ — 価格・ベンチマーク・ニュース",
  refresh: "更新",
  nVisible: (n, extra) => `${n} 件表示${extra}`,
  nHidden: (n) => `（他 ${n} 件非表示）`,
  appliesTo: "適用対象",
  editCriteria: "評価基準を編集",
  trackingProfile: "トラッキングプロファイル",
  loading: "読み込み中…",
  loadError: "追跡中のモデルを読み込めませんでした",
  retry: "再試行",
  searchPlaceholder: "モデルを検索…",
  search: "検索",
  searchUntracked: "未追跡のモデルを検索",
  tableTitle: "追跡中のモデル",
  results: (n) => `結果 (${n})`,
  alreadyTracked: "追跡中",
  add: "追加",
  show: "表示",
  hide: "非表示",
  removeModel: "モデルを削除",
  suppressShort: "削除?",
  clickToShow: "クリックして表示",
  clickToHide: "クリックして非表示",
  criteriaWeights: "評価基準の重み:",
  totalWeights: "重みの合計:",
  resetAllTitle: "すべてのプロファイルと評価基準を既定値に戻す",
  resetDefaults: "🔄 既定値に戻す",
  cancel: "キャンセル",
  confirmDeleteTitle: "このモデルを削除しますか?",
  confirmDeleteBody: (name) => `「${name}」を追跡中のモデルから削除します。OpenRouter 上のデータは変更されません。`,
  confirmDeleteOk: "削除",
  updatedAgo: (m) => m < 1 ? "たった今更新" : `${m} 分前に更新`,
  ranking: (name) => `🏆 ランキング — ${name}`,
  customCriteria: "カスタム評価基準",
  table: {
    model: "モデル",
    context: "コンテキスト",
    priceIn: "入力 $/M tk",
    priceOut: "出力 $/M tk",
    priceCache: "キャッシュ読み取り",
    intel: "知能",
    coding: "コーディング",
    agentic: "エージェント",
    swe: "SWE",
    vision: "画像",
    open: "オープン",
    size: "サイズ",
    gpuOk: "GPU OK",
    tools: "ツール",
    score: "スコア"
  },
  views: {
    label: "表示:",
    names: { classic: "カード", stacked: "スコアバー", columns: "ヒストグラム", heatmap: "ヒートマップ", duel: "対決", value: "品質 / コスト" },
    hint: {
      classic: "価格とコンテキスト付きのトップ5。",
      stacked: "各セグメント = 1 つの基準で獲得したポイント（重み × 評価）。",
      columns: "基準ごとに 1 本のバー:高さ = 評価、幅 = 重み。",
      heatmap: "基準ごとの 0〜100 の評価、重い基準が先頭。列をクリックすると並べ替えます。",
      duel: "2 つのモデルを選び、基準ごとに比較します。",
      value: "品質（価格以外の基準）と加重コストの関係。破線が最良のトレードオフを結びます。"
    },
    short: {
      intelligence: "知能",
      coding: "コーディング",
      agentic: "エージェント",
      price_in: "入力価格",
      price_out: "出力価格",
      cache_read: "キャッシュ価格",
      context: "コンテキスト",
      tools: "ツール",
      has_vision: "画像",
      open_weights: "オープンウェイト",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "モデル",
    score: "スコア",
    weight: "重み",
    grade: "評価",
    points: "点",
    na: "なし",
    noCriteria: "このプロファイルでは重み付けされた基準がありません — 評価基準を編集してください。",
    needTwo: "比較するには利用可能なモデルを 2 つ以上追跡してください。",
    showAll: (n) => `すべて表示 (${n})`,
    showLess: "折りたたむ",
    strength: "強み",
    weakness: "弱み",
    missingData: "欠損データは 0 として扱います",
    winsOn: (n) => `${n} 項目でリード`,
    versus: "vs",
    axisQuality: "品質",
    axisCost: "コスト $/M tk",
    axisCostShort: "加重コスト（$/M tk、対数スケール）",
    axisQualityShort: "品質 (0–100)",
    free: "無料",
    frontier: "最良のトレードオフ",
    frontierHint: "より安くかつ高品質なモデルは他にありません（パレートフロント）。",
    others: "劣後",
    valueRead: "左上が最良:低コスト・高品質。",
    fieldName: { intelligence_index: "知能", coding_index: "コーディング", agentic_index: "エージェント" },
    estimatedHint: (from, r2, n) => `${from} から推定 — OpenRouter の ${n} モデルに対する線形近似（R² ${r2}）。ヒートマップのセルをクリックすると実値を入力できます。`,
    manualHint: "手動で入力した値（OpenRouter より優先）。",
    naHint: "データなし:未公開で、推定に使える他の指標もありません。",
    editHint: "クリックして値を入力（空欄 = OpenRouter / 推定値に戻す）。",
    rawIndex: "生の指標",
    hasEstimates: "一部の評価は推定値です (~)",
    noQuality: "このプロファイルは価格のみを重み付けしています — 品質とコストを比較するには品質基準（知能、コーディングなど）を追加してください。"
  },
  news: {
    title: "📰 ニュース & アップデート",
    hidePanel: "パネルを隠す",
    loading: "ニュースを読み込み中…",
    none: "ニュースはありません。",
    promos: "開催中のプロモ",
    priceChanges: "価格変更",
    newModels: "新着モデル",
    newModelsHeading: (p) => `🚀 新着モデル (${p})`,
    nModels: (n) => `${n} モデル`,
    details: "詳細",
    follow: "フォロー",
    tracked: "追跡中",
    top3: "🔥 トップ3!",
    until: (d) => `⏳ ${d} まで`,
    threshold: "しきい値 ≥",
    thresholdUnit: "/ 1d または 7d",
    windowLabel: "期間:",
    windowOpts: { "1m": "1 か月（既定）", "2m": "2 か月", "3m": "3 か月", "6m": "6 か月", "1y": "1 年", "all": "すべて" },
    sortBy: "並べ替え:",
    sortDate: "📅 日付",
    sortScore: "⭐ スコア",
    noNewModels: "この期間に新着モデルはありません。",
    open: "ニュース",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `OpenRouter 期間限定プロモ:${i} / ${o} / M tk`,
      price: (i, o) => `入力 ${i} / 出力 ${o} / M tk`,
      priceWithContext: (i, o, c) => `入力 ${i} / 出力 ${o} / M tk（コンテキスト ${c}）`,
      priceWithParams: (i, o, p) => `入力 ${i} / 出力 ${o} / M tk（${p} MoE）`,
      videoRate: (v, r) => `${v} の動画生成が ${r}/秒`,
      agenticModel: (v, i, o) => `${v} エージェント型コーディングモデル:入力 ${i} / 出力 ${o}`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ トラッキングプロファイル:${name}`,
    autoFill: "✨ 自動入力",
    autoFillHint: "Hermes の既定モデルにこのプロファイルの重みを提案させる",
    autoFillRunning: "モデルに問い合わせ中…",
    autoFillDone: "モデルが提案した基準です — 確認して保存してください。",
    autoFillFailed: "自動入力に失敗しました",
    save: "保存",
    saving: "保存中…",
    cancel: "キャンセル",
    delete: "プロファイルを削除",
    deleteConfirm: (name) => `トラッキングプロファイル「${name}」を削除しますか?`,
    reset: "すべてのプロファイルと評価基準を既定値に戻しますか?",
    needId: "プロファイルの識別子を入力してください",
    displayName: "表示名:",
    displayNamePlaceholder: "例:DevOps スペシャリスト",
    saveError: "プロファイルの保存中にエラーが発生しました",
    close: "閉じる"
  },
  criteria: {
    intelligence: "知能",
    coding: "コーディング",
    agentic: "エージェント能力",
    price_in: "価格 ↓ 入力",
    price_out: "価格 ↓ 出力",
    cache_read: "価格 ↓ キャッシュ",
    context: "コンテキストウィンドウ",
    tools: "ツール呼び出し",
    has_vision: "画像理解",
    open_weights: "オープンウェイト",
    fits_64gb: "ローカル VRAM ≤ 64GB",
    d_intelligence: "汎用的な推論力と知識の深さ",
    d_coding: "コード生成の品質",
    d_agentic: "エージェント能力（多段階の自律性）",
    d_price_in: "入力トークンの安さの重要度",
    d_price_out: "出力トークンの安さの重要度",
    d_cache_read: "キャッシュ入力の安さの重要度",
    d_context: "非常に長いコンテキストを処理できるか（1M+ トークン近く）",
    d_tools: "ネイティブな関数/ツール呼び出し（API、Bash など）",
    d_has_vision: "画像やスクリーンショットを処理できるか",
    d_open_weights: "オープンウェイトで自己ホスト可能",
    d_fits_64gb: "標準的な GPU でのローカル実行の実現性（≤ 64GB）"
  }
};

// src/locales/ko.ts
var ko = {
  title: "LLM 모델 리더보드",
  subtitle: "OpenRouter 데이터 — 가격, 벤치마크, 뉴스",
  refresh: "새로 고침",
  nVisible: (n, extra) => `${n}개 표시${extra}`,
  nHidden: (n) => ` (+${n}개 숨김)`,
  appliesTo: "적용 대상",
  editCriteria: "평가 기준 편집",
  trackingProfile: "추적 프로필",
  loading: "불러오는 중…",
  loadError: "추적 중인 모델을 불러올 수 없습니다",
  retry: "다시 시도",
  searchPlaceholder: "모델 검색…",
  search: "검색",
  searchUntracked: "추적하지 않은 모델 검색",
  tableTitle: "추적 중인 모델",
  results: (n) => `결과 (${n})`,
  alreadyTracked: "추적 중",
  add: "추가",
  show: "표시",
  hide: "숨기기",
  removeModel: "모델 제거",
  suppressShort: "삭제",
  clickToShow: "클릭하여 표시",
  clickToHide: "클릭하여 숨기기",
  criteriaWeights: "기준 가중치:",
  totalWeights: "가중치 합계:",
  resetAllTitle: "모든 프로필과 기준을 기본값으로 초기화",
  resetDefaults: "🔄 기본값 복원",
  cancel: "취소",
  confirmDeleteTitle: "이 모델을 제거할까요?",
  confirmDeleteBody: (name) => `“${name}”(이)가 추적 중인 모델에서 제거됩니다. OpenRouter의 데이터는 그대로 유지됩니다.`,
  confirmDeleteOk: "제거",
  updatedAgo: (m) => m < 1 ? "방금 업데이트됨" : `${m}분 전 업데이트됨`,
  ranking: (name) => `🏆 순위 — ${name}`,
  customCriteria: "사용자 지정 기준",
  table: {
    model: "모델",
    context: "컨텍스트",
    priceIn: "입력 $/M tk",
    priceOut: "출력 $/M tk",
    priceCache: "캐시 읽기",
    intel: "지능",
    coding: "코딩",
    agentic: "에이전트",
    swe: "SWE",
    vision: "비전",
    open: "개방",
    size: "크기",
    gpuOk: "GPU 지원",
    tools: "도구",
    score: "점수"
  },
  views: {
    label: "보기:",
    names: { classic: "카드", stacked: "점수 막대", columns: "히스토그램", heatmap: "히트맵", duel: "1:1 비교", value: "품질 / 비용" },
    hint: {
      classic: "가격과 컨텍스트를 포함한 상위 5개.",
      stacked: "각 구간 = 한 기준에서 얻은 점수(가중치 × 등급).",
      columns: "기준마다 막대 하나: 높이 = 등급, 너비 = 가중치.",
      heatmap: "기준별 0–100 등급, 가중치가 큰 기준부터. 열을 클릭하면 정렬됩니다.",
      duel: "두 모델을 골라 기준별로 비교합니다.",
      value: "품질(비가격 기준) 대비 가중 비용. 점선은 최적의 절충점을 연결합니다."
    },
    short: {
      intelligence: "지능",
      coding: "코딩",
      agentic: "에이전트",
      price_in: "입력 가격",
      price_out: "출력 가격",
      cache_read: "캐시 가격",
      context: "컨텍스트",
      tools: "도구",
      has_vision: "비전",
      open_weights: "개방 가중치",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "모델",
    score: "점수",
    weight: "가중치",
    grade: "등급",
    points: "점",
    na: "해당 없음",
    noCriteria: "이 프로필에는 가중치가 지정된 기준이 없습니다 — 평가 기준을 편집하세요.",
    needTwo: "비교하려면 사용 가능한 모델을 최소 두 개 추적해야 합니다.",
    showAll: (n) => `모두 표시 (${n})`,
    showLess: "간단히 보기",
    strength: "강점",
    weakness: "약점",
    missingData: "누락된 데이터는 0으로 계산",
    winsOn: (n) => `${n}개 기준에서 앞섬`,
    versus: "대",
    axisQuality: "품질",
    axisCost: "비용 $/M tk",
    axisCostShort: "가중 비용($/M tk, 로그 스케일)",
    axisQualityShort: "품질(0–100)",
    free: "무료",
    frontier: "최적의 절충",
    frontierHint: "더 저렴하면서 동시에 더 나은 모델이 없습니다(파레토 프론티어).",
    others: "열위",
    valueRead: "왼쪽 위가 최적: 비용은 낮고 품질은 높습니다.",
    fieldName: { intelligence_index: "지능", coding_index: "코딩", agentic_index: "에이전트" },
    estimatedHint: (from, r2, n) => `${from}에서 추정 — OpenRouter 모델 ${n}개에 대한 선형 적합(R² ${r2}). 히트맵 셀을 클릭해 실제 값을 입력하세요.`,
    manualHint: "직접 입력한 값(OpenRouter보다 우선).",
    naHint: "데이터 없음: 공개되지 않았고, 추정에 쓸 다른 지수도 없습니다.",
    editHint: "클릭하여 값을 입력하세요(비우면 OpenRouter / 추정치로 돌아갑니다).",
    rawIndex: "원시 지수",
    hasEstimates: "일부 등급은 추정치입니다(~)",
    noQuality: "이 프로필은 가격에만 가중치를 둡니다 — 품질과 비용을 함께 그리려면 품질 기준(지능, 코딩…)을 추가하세요."
  },
  news: {
    title: "📰 뉴스 및 업데이트",
    hidePanel: "패널 숨기기",
    loading: "뉴스를 불러오는 중…",
    none: "표시할 뉴스가 없습니다.",
    promos: "진행 중인 프로모션",
    priceChanges: "가격 변동",
    newModels: "새 모델",
    newModelsHeading: (p) => `🚀 새 모델 (${p})`,
    nModels: (n) => `모델 ${n}개`,
    details: "상세",
    follow: "팔로우",
    tracked: "추적 중",
    top3: "🔥 상위 3개!",
    until: (d) => `⏳ ${d}까지`,
    threshold: "임계값 ≥",
    thresholdUnit: "/ 1일 또는 7일",
    windowLabel: "기간:",
    windowOpts: { "1m": "1개월(기본)", "2m": "2개월", "3m": "3개월", "6m": "6개월", "1y": "1년", "all": "전체" },
    sortBy: "정렬:",
    sortDate: "📅 날짜",
    sortScore: "⭐ 점수",
    noNewModels: "이 기간에는 새 모델이 없습니다.",
    open: "뉴스",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `OpenRouter 한정 프로모션: M tk당 ${i} / ${o}`,
      price: (i, o) => `M tk당 ${i} 입력 / ${o} 출력`,
      priceWithContext: (i, o, c) => `M tk당 ${i} 입력 / ${o} 출력(컨텍스트 ${c})`,
      priceWithParams: (i, o, p) => `M tk당 ${i} 입력 / ${o} 출력(${p} MoE)`,
      videoRate: (v, r) => `${v} 영상 생성 초당 ${r}`,
      agenticModel: (v, i, o) => `${v} 에이전트 코딩 모델 ${i} 입력 / ${o} 출력`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ 추적 프로필: ${name}`,
    autoFill: "✨ 자동 채우기",
    autoFillHint: "Hermes 기본 모델에 이 프로필의 가중치를 제안하도록 요청합니다",
    autoFillRunning: "모델에 요청하는 중…",
    autoFillDone: "모델이 제안한 기준입니다 — 검토 후 저장하세요.",
    autoFillFailed: "자동 채우기 실패",
    save: "저장",
    saving: "저장 중…",
    cancel: "취소",
    delete: "프로필 삭제",
    deleteConfirm: (name) => `‘${name}’ 추적 프로필을 삭제할까요?`,
    reset: "모든 프로필과 기준을 기본값으로 초기화할까요?",
    needId: "프로필 식별자를 입력하세요",
    displayName: "표시 이름:",
    displayNamePlaceholder: "예: DevOps 전문가",
    saveError: "프로필을 저장하는 중 오류가 발생했습니다",
    close: "닫기"
  },
  criteria: {
    intelligence: "지능",
    coding: "코딩",
    agentic: "에이전트",
    price_in: "가격 ↓ 입력",
    price_out: "가격 ↓ 출력",
    cache_read: "가격 ↓ 캐시",
    context: "컨텍스트 창",
    tools: "도구 호출",
    has_vision: "비전",
    open_weights: "개방 가중치",
    fits_64gb: "로컬 VRAM ≤ 64GB",
    d_intelligence: "전반적인 추론 및 지식 깊이",
    d_coding: "코드 생성 품질",
    d_agentic: "에이전트 역량(다단계 자율성)",
    d_price_in: "저렴한 입력 토큰의 중요도",
    d_price_out: "저렴한 출력 토큰의 중요도",
    d_cache_read: "저렴한 캐시 입력의 중요도",
    d_context: "매우 긴 컨텍스트 처리 능력(1M+ 토큰에 근접)",
    d_tools: "네이티브 함수/도구 호출(API, Bash 등)",
    d_has_vision: "이미지, 스크린샷 처리 능력",
    d_open_weights: "개방 가중치, 자체 호스팅 가능",
    d_fits_64gb: "일반 GPU(≤ 64GB)에서 로컬 실행 가능성"
  }
};

// src/locales/pt.ts
var pt = {
  title: "Classificação de modelos LLM",
  subtitle: "Dados do OpenRouter — preços, benchmarks e notícias",
  refresh: "Atualizar",
  nVisible: (n, extra) => `${n} visíveis${extra}`,
  nHidden: (n) => ` (+${n} ocultos)`,
  appliesTo: "Aplica-se a",
  editCriteria: "Editar os critérios de pontuação",
  trackingProfile: "Perfil de monitorização",
  loading: "A carregar…",
  loadError: "Não foi possível carregar os modelos monitorizados",
  retry: "Tentar novamente",
  searchPlaceholder: "Procurar um modelo…",
  search: "Procurar",
  searchUntracked: "Procurar modelos não monitorizados",
  tableTitle: "Modelos monitorizados",
  results: (n) => `Resultados (${n})`,
  alreadyTracked: "Monitorizado",
  add: "Adicionar",
  show: "Mostrar",
  hide: "Ocultar",
  removeModel: "Remover modelo",
  suppressShort: "Eliminar?",
  clickToShow: "Clique para mostrar",
  clickToHide: "Clique para ocultar",
  criteriaWeights: "Pesos dos critérios:",
  totalWeights: "Peso total:",
  resetAllTitle: "Repor todos os perfis e critérios no valor predefinido",
  resetDefaults: "🔄 Repor predefinições",
  cancel: "Cancelar",
  confirmDeleteTitle: "Remover este modelo?",
  confirmDeleteBody: (name) => `“${name}” será removido dos modelos monitorizados. Os dados permanecem intactos no OpenRouter.`,
  confirmDeleteOk: "Remover",
  updatedAgo: (m) => m < 1 ? "atualizado agora mesmo" : `atualizado há ${m} min`,
  ranking: (name) => `🏆 Classificação — ${name}`,
  customCriteria: "Critérios personalizados",
  table: {
    model: "Modelo",
    context: "Contexto",
    priceIn: "Entrada $/M tk",
    priceOut: "Saída $/M tk",
    priceCache: "Leitura de cache",
    intel: "Intel.",
    coding: "Código",
    agentic: "Agéntico",
    swe: "SWE",
    vision: "Visão",
    open: "Aberto",
    size: "Tamanho",
    gpuOk: "GPU OK",
    tools: "Ferramentas",
    score: "Pontuação"
  },
  views: {
    label: "Vista:",
    names: { classic: "Cartões", stacked: "Barras de pontuação", columns: "Histogramas", heatmap: "Mapa de calor", duel: "Duelo", value: "Qualidade / custo" },
    hint: {
      classic: "Os 5 melhores com preço e contexto.",
      stacked: "Cada segmento = pontos obtidos num critério (peso × nota).",
      columns: "Uma barra por critério: altura = nota, largura = peso.",
      heatmap: "Nota de 0 a 100 por critério, primeiro os critérios com mais peso. Clique numa coluna para ordenar.",
      duel: "Escolha dois modelos e compare-os critério a critério.",
      value: "Qualidade (critérios que não o preço) face ao custo ponderado; a linha tracejada liga as melhores relações qualidade/preço."
    },
    short: {
      intelligence: "Inteligência",
      coding: "Código",
      agentic: "Agéntico",
      price_in: "Preço entrada",
      price_out: "Preço saída",
      cache_read: "Preço cache",
      context: "Contexto",
      tools: "Ferramentas",
      has_vision: "Visão",
      open_weights: "Pesos abertos",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Modelo",
    score: "Pontuação",
    weight: "peso",
    grade: "nota",
    points: "pts",
    na: "n/d",
    noCriteria: "Nenhum critério tem peso neste perfil — edite os critérios de pontuação.",
    needTwo: "Monitorize pelo menos dois modelos disponíveis para os comparar.",
    showAll: (n) => `Mostrar tudo (${n})`,
    showLess: "Mostrar menos",
    strength: "Ponto forte",
    weakness: "Ponto fraco",
    missingData: "Os dados em falta contam como 0",
    winsOn: (n) => `à frente em ${n} critério${n > 1 ? "s" : ""}`,
    versus: "vs",
    axisQuality: "Qualidade",
    axisCost: "Custo $/M tk",
    axisCostShort: "Custo ponderado ($/M tk, escala logarítmica)",
    axisQualityShort: "Qualidade (0–100)",
    free: "grátis",
    frontier: "Melhores relações",
    frontierHint: "nenhum outro modelo é simultaneamente mais barato e melhor (fronteira de Pareto).",
    others: "Dominados",
    valueRead: "Em cima à esquerda é melhor: custo baixo, qualidade alta.",
    fieldName: { intelligence_index: "Inteligência", coding_index: "Código", agentic_index: "Agéntico" },
    estimatedHint: (from, r2, n) => `Estimado a partir de ${from} — ajuste linear sobre ${n} modelos do OpenRouter (R² ${r2}). Clique numa célula do mapa de calor para introduzir o valor real.`,
    manualHint: "Valor introduzido manualmente (substitui o OpenRouter).",
    naHint: "Sem dados: não é publicado e não há outro índice de onde o estimar.",
    editHint: "Clique para introduzir o valor (vazio = voltar ao OpenRouter / à estimativa).",
    rawIndex: "índice bruto",
    hasEstimates: "Algumas notas são estimadas (~)",
    noQuality: "Este perfil apenas pondera preços — adicione um critério de qualidade (inteligência, código…) para representar a qualidade face ao custo."
  },
  news: {
    title: "📰 Notícias e novidades",
    hidePanel: "Ocultar o painel",
    loading: "A carregar notícias…",
    none: "Não há notícias disponíveis.",
    promos: "PROMOÇÕES ATIVAS",
    priceChanges: "ALTERAÇÕES DE PREÇO",
    newModels: "NOVOS MODELOS",
    newModelsHeading: (p) => `🚀 Novos modelos (${p})`,
    nModels: (n) => `${n} modelo${n > 1 ? "s" : ""}`,
    details: "Detalhes",
    follow: "Seguir",
    tracked: "Monitorizado",
    top3: "🔥 Top 3!",
    until: (d) => `⏳ Até ${d}`,
    threshold: "Limiar ≥",
    thresholdUnit: "/ 1d ou 7d",
    windowLabel: "Período:",
    windowOpts: { "1m": "1 mês (predefinido)", "2m": "2 meses", "3m": "3 meses", "6m": "6 meses", "1y": "1 ano", "all": "Tudo" },
    sortBy: "Ordenar por:",
    sortDate: "📅 Data",
    sortScore: "⭐ Pontuação",
    noNewModels: "Nenhum modelo novo neste período.",
    open: "Notícias",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Promoção limitada do OpenRouter: ${i} / ${o} por M tk`,
      price: (i, o) => `${i} entrada / ${o} saída por M tk`,
      priceWithContext: (i, o, c) => `${i} entrada / ${o} saída por M tk (${c} ctx)`,
      priceWithParams: (i, o, p) => `${i} entrada / ${o} saída por M tk (${p} MoE)`,
      videoRate: (v, r) => `${v} geração de vídeo a ${r}/s`,
      agenticModel: (v, i, o) => `${v} modelo de código agéntico a ${i} entrada / ${o} saída`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Perfil de monitorização: ${name}`,
    autoFill: "✨ Preencher automaticamente",
    autoFillHint: "Pedir ao modelo predefinido do Hermes que proponha pesos para este perfil",
    autoFillRunning: "A consultar o modelo…",
    autoFillDone: "Critérios propostos pelo modelo — reveja-os e guarde.",
    autoFillFailed: "Falha no preenchimento automático",
    save: "Guardar",
    saving: "A guardar…",
    cancel: "Cancelar",
    delete: "Eliminar o perfil",
    deleteConfirm: (name) => `Eliminar o perfil de monitorização «${name}»?`,
    reset: "Repor todos os perfis e critérios nos valores predefinidos?",
    needId: "Indique um identificador para o perfil",
    displayName: "Nome apresentado:",
    displayNamePlaceholder: "p. ex. Especialista DevOps",
    saveError: "Erro ao guardar o perfil",
    close: "Fechar"
  },
  criteria: {
    intelligence: "Inteligência",
    coding: "Código",
    agentic: "Agéntico",
    price_in: "Preço ↓ entrada",
    price_out: "Preço ↓ saída",
    cache_read: "Preço ↓ cache",
    context: "Janela de contexto",
    tools: "Chamadas a ferramentas",
    has_vision: "Visão",
    open_weights: "Pesos abertos",
    fits_64gb: "VRAM local ≤ 64GB",
    d_intelligence: "Raciocínio global e profundidade de conhecimento",
    d_coding: "Qualidade da geração de código",
    d_agentic: "Capacidades agénticas (autonomia em vários passos)",
    d_price_in: "Importância de tokens de entrada baratos",
    d_price_out: "Importância de tokens de saída baratos",
    d_cache_read: "Importância de uma entrada em cache barata",
    d_context: "Capacidade de processar contextos muito longos (perto de 1M+ tokens)",
    d_tools: "Chamada nativa de funções/ferramentas (API, Bash, etc.)",
    d_has_vision: "Capacidade de processar imagens e capturas de ecrã",
    d_open_weights: "Pesos abertos, possibilidade de auto-alojamento",
    d_fits_64gb: "Viabilidade de execução local numa GPU padrão (≤ 64GB)"
  }
};

// src/locales/ru.ts
var ru = {
  title: "Рейтинг LLM-моделей",
  subtitle: "Данные OpenRouter — цены, бенчмарки и новости",
  refresh: "Обновить",
  nVisible: (n, extra) => `${n} видно${extra}`,
  nHidden: (n) => ` (+${n} скрыто)`,
  appliesTo: "Применяется к",
  editCriteria: "Изменить критерии оценки",
  trackingProfile: "Профиль отслеживания",
  loading: "Загрузка…",
  loadError: "Не удалось загрузить отслеживаемые модели",
  retry: "Повторить",
  searchPlaceholder: "Поиск модели…",
  search: "Поиск",
  searchUntracked: "Поиск неотслеживаемых моделей",
  tableTitle: "Отслеживаемые модели",
  results: (n) => `Результаты (${n})`,
  alreadyTracked: "Отслеживается",
  add: "Добавить",
  show: "Показать",
  hide: "Скрыть",
  removeModel: "Удалить модель",
  suppressShort: "Удал.?",
  clickToShow: "Нажмите, чтобы показать",
  clickToHide: "Нажмите, чтобы скрыть",
  criteriaWeights: "Веса критериев:",
  totalWeights: "Сумма весов:",
  resetAllTitle: "Сбросить все профили и критерии к значениям по умолчанию",
  resetDefaults: "🔄 По умолчанию",
  cancel: "Отмена",
  confirmDeleteTitle: "Удалить эту модель?",
  confirmDeleteBody: (name) => `«${name}» будет удалена из отслеживаемых моделей. Данные на OpenRouter останутся без изменений.`,
  confirmDeleteOk: "Удалить",
  updatedAgo: (m) => m < 1 ? "обновлено только что" : `обновлено ${m} мин назад`,
  ranking: (name) => `🏆 Рейтинг — ${name}`,
  customCriteria: "Свои критерии",
  table: {
    model: "Модель",
    context: "Контекст",
    priceIn: "Ввод $/M tk",
    priceOut: "Вывод $/M tk",
    priceCache: "Чтение кэша",
    intel: "Интел.",
    coding: "Кодинг",
    agentic: "Агентные",
    swe: "SWE",
    vision: "Изображения",
    open: "Открытые",
    size: "Размер",
    gpuOk: "GPU OK",
    tools: "Инструменты",
    score: "Балл"
  },
  views: {
    label: "Вид:",
    names: { classic: "Карточки", stacked: "Полосы баллов", columns: "Гистограммы", heatmap: "Тепловая карта", duel: "Дуэль", value: "Качество / стоимость" },
    hint: {
      classic: "Топ-5 с ценой и контекстом.",
      stacked: "Каждый сегмент — баллы, набранные по одному критерию (вес × оценка).",
      columns: "Одна полоса на критерий: высота = оценка, ширина = вес.",
      heatmap: "Оценка 0–100 по каждому критерию, самые важные критерии первыми. Нажмите на столбец, чтобы отсортировать.",
      duel: "Выберите две модели и сравните их критерий за критерием.",
      value: "Качество (критерии, не связанные с ценой) против взвешенной стоимости; пунктирная линия соединяет лучшие компромиссы."
    },
    short: {
      intelligence: "Интеллект",
      coding: "Кодинг",
      agentic: "Агентные",
      price_in: "Цена ввода",
      price_out: "Цена вывода",
      cache_read: "Цена кэша",
      context: "Контекст",
      tools: "Инструменты",
      has_vision: "Изображения",
      open_weights: "Открытые веса",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Модель",
    score: "Балл",
    weight: "вес",
    grade: "оценка",
    points: "бал.",
    na: "н/д",
    noCriteria: "Для этого профиля не задано ни одного веса критерия — измените критерии оценки.",
    needTwo: "Отслеживайте как минимум две доступные модели, чтобы сравнить их.",
    showAll: (n) => `Показать все (${n})`,
    showLess: "Показать меньше",
    strength: "Сильная сторона",
    weakness: "Слабая сторона",
    missingData: "Отсутствующие данные считаются за 0",
    winsOn: (n) => `впереди по ${n} критериям`,
    versus: "против",
    axisQuality: "Качество",
    axisCost: "Стоимость $/M tk",
    axisCostShort: "Взвешенная стоимость ($/M tk, лог. шкала)",
    axisQualityShort: "Качество (0–100)",
    free: "бесплатно",
    frontier: "Лучшие компромиссы",
    frontierHint: "ни одна другая модель не дешевле и не лучше одновременно (граница Парето).",
    others: "Доминируемые",
    valueRead: "Лучше всего — вверху слева: низкая стоимость, высокое качество.",
    fieldName: { intelligence_index: "Интеллект", coding_index: "Кодинг", agentic_index: "Агентные" },
    estimatedHint: (from, r2, n) => `Оценено по ${from} — линейная аппроксимация на ${n} моделях OpenRouter (R² ${r2}). Нажмите на ячейку тепловой карты, чтобы ввести реальное значение.`,
    manualHint: "Значение введено вручную (переопределяет OpenRouter).",
    naHint: "Нет данных: не опубликовано, и нет другого индекса для оценки.",
    editHint: "Нажмите, чтобы ввести значение (пусто = вернуться к OpenRouter / оценке).",
    rawIndex: "сырой индекс",
    hasEstimates: "Некоторые оценки приблизительны (~)",
    noQuality: "В этом профиле учитываются только цены — добавьте критерий качества (интеллект, кодинг…), чтобы построить график качество/стоимость."
  },
  news: {
    title: "📰 Новости и обновления",
    hidePanel: "Скрыть панель",
    loading: "Загрузка новостей…",
    none: "Новостей нет.",
    promos: "АКТИВНЫЕ АКЦИИ",
    priceChanges: "ИЗМЕНЕНИЯ ЦЕН",
    newModels: "НОВЫЕ МОДЕЛИ",
    newModelsHeading: (p) => `🚀 Новые модели (${p})`,
    nModels: (n) => `${n} модел${n % 10 === 1 && n % 100 !== 11 ? "ь" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "и" : "ей"}`,
    details: "Подробнее",
    follow: "Перейти",
    tracked: "Отслеживается",
    top3: "🔥 Топ-3!",
    until: (d) => `⏳ До ${d}`,
    threshold: "Порог ≥",
    thresholdUnit: "/ 1d или 7d",
    windowLabel: "Период:",
    windowOpts: { "1m": "1 месяц (по умолчанию)", "2m": "2 месяца", "3m": "3 месяца", "6m": "6 месяцев", "1y": "1 год", "all": "Все" },
    sortBy: "Сортировать по:",
    sortDate: "📅 Дата",
    sortScore: "⭐ Балл",
    noNewModels: "За этот период новых моделей нет.",
    open: "Новости",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Ограниченная акция OpenRouter: ${i} / ${o} за M tk`,
      price: (i, o) => `${i} ввод / ${o} вывод за M tk`,
      priceWithContext: (i, o, c) => `${i} ввод / ${o} вывод за M tk (${c} контекст)`,
      priceWithParams: (i, o, p) => `${i} ввод / ${o} вывод за M tk (${p} MoE)`,
      videoRate: (v, r) => `Генерация видео ${v} по ${r}/с`,
      agenticModel: (v, i, o) => `Агентная модель ${v} для кода: ${i} ввод / ${o} вывод`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Профиль отслеживания: ${name}`,
    autoFill: "✨ Автозаполнение",
    autoFillHint: "Попросить модель Hermes по умолчанию предложить веса для этого профиля",
    autoFillRunning: "Запрос к модели…",
    autoFillDone: "Критерии предложены моделью — проверьте и сохраните.",
    autoFillFailed: "Не удалось выполнить автозаполнение",
    save: "Сохранить",
    saving: "Сохранение…",
    cancel: "Отмена",
    delete: "Удалить профиль",
    deleteConfirm: (name) => `Удалить профиль отслеживания «${name}»?`,
    reset: "Сбросить все профили и критерии к значениям по умолчанию?",
    needId: "Укажите идентификатор профиля",
    displayName: "Отображаемое имя:",
    displayNamePlaceholder: "например, DevOps-специалист",
    saveError: "Ошибка при сохранении профиля",
    close: "Закрыть"
  },
  criteria: {
    intelligence: "Интеллект",
    coding: "Кодинг",
    agentic: "Агентные",
    price_in: "Цена ↓ ввод",
    price_out: "Цена ↓ вывод",
    cache_read: "Цена ↓ кэш",
    context: "Окно контекста",
    tools: "Вызовы инструментов",
    has_vision: "Изображения",
    open_weights: "Открытые веса",
    fits_64gb: "Локальная VRAM ≤ 64GB",
    d_intelligence: "Общая глубина рассуждений и знаний",
    d_coding: "Качество генерации кода",
    d_agentic: "Агентные возможности (многошаговая автономность)",
    d_price_in: "Важность дешёвых входных токенов",
    d_price_out: "Важность дешёвых выходных токенов",
    d_cache_read: "Важность дешёвого кэшированного ввода",
    d_context: "Способность обрабатывать очень длинные контексты (близко к 1M+ токенов)",
    d_tools: "Нативный вызов функций/инструментов (API, Bash и т. д.)",
    d_has_vision: "Способность обрабатывать изображения, скриншоты",
    d_open_weights: "Открытые веса, возможность самостоятельного хостинга",
    d_fits_64gb: "Возможность локального запуска на обычной GPU (≤ 64GB)"
  }
};

// src/locales/tr.ts
var tr = {
  title: "LLM Model Lider Tablosu",
  subtitle: "OpenRouter verileri — fiyatlar, karşılaştırmalar ve haberler",
  refresh: "Yenile",
  nVisible: (n, extra) => `${n} görünür${extra}`,
  nHidden: (n) => ` (+${n} gizli)`,
  appliesTo: "Şunun için geçerli",
  editCriteria: "Puanlama ölçütlerini düzenle",
  trackingProfile: "İzlenen profil",
  loading: "Yükleniyor…",
  loadError: "İzlenen modeller yüklenemedi",
  retry: "Yeniden dene",
  searchPlaceholder: "Model ara…",
  search: "Ara",
  searchUntracked: "İzlenmeyen modellerde ara",
  tableTitle: "İzlenen modeller",
  results: (n) => `Sonuçlar (${n})`,
  alreadyTracked: "İzleniyor",
  add: "Ekle",
  show: "Göster",
  hide: "Gizle",
  removeModel: "Modeli kaldır",
  suppressShort: "Sil?",
  clickToShow: "Göstermek için tıkla",
  clickToHide: "Gizlemek için tıkla",
  criteriaWeights: "Ölçüt ağırlıkları:",
  totalWeights: "Toplam ağırlık:",
  resetAllTitle: "Tüm profilleri ve ölçütleri varsayılan değerine sıfırla",
  resetDefaults: "🔄 Varsayılanlara sıfırla",
  cancel: "İptal",
  confirmDeleteTitle: "Bu model kaldırılsın mı?",
  confirmDeleteBody: (name) => `“${name}” izlenen modellerden kaldırılacak. Veriler OpenRouter'da değişmeden kalır.`,
  confirmDeleteOk: "Kaldır",
  updatedAgo: (m) => m < 1 ? "az önce güncellendi" : `${m} dk önce güncellendi`,
  ranking: (name) => `🏆 Sıralama — ${name}`,
  customCriteria: "Özel ölçütler",
  table: {
    model: "Model",
    context: "Bağlam",
    priceIn: "Giriş $/M tk",
    priceOut: "Çıkış $/M tk",
    priceCache: "Önbellek okuma",
    intel: "Zeka",
    coding: "Kodlama",
    agentic: "Ajan",
    swe: "SWE",
    vision: "Görsel",
    open: "Açık",
    size: "Boyut",
    gpuOk: "GPU OK",
    tools: "Araçlar",
    score: "Puan"
  },
  views: {
    label: "Görünüm:",
    names: { classic: "Kartlar", stacked: "Puan çubukları", columns: "Histogramlar", heatmap: "Isı haritası", duel: "Düello", value: "Kalite / maliyet" },
    hint: {
      classic: "Fiyat ve bağlamla birlikte ilk 5.",
      stacked: "Her segment = bir ölçütten kazanılan puan (ağırlık × not).",
      columns: "Ölçüt başına bir çubuk: yükseklik = not, genişlik = ağırlık.",
      heatmap: "Ölçüt başına 0–100 notu, en ağır ölçütler önce. Sıralamak için bir sütuna tıkla.",
      duel: "İki model seç ve ölçüt ölçüt karşılaştır.",
      value: "Kalite (fiyat dışı ölçütler) ağırlıklı maliyete karşı; kesikli çizgi en iyi dengeleri birleştirir."
    },
    short: {
      intelligence: "Zeka",
      coding: "Kodlama",
      agentic: "Ajan",
      price_in: "Giriş fiyatı",
      price_out: "Çıkış fiyatı",
      cache_read: "Önbellek fiyatı",
      context: "Bağlam",
      tools: "Araçlar",
      has_vision: "Görsel",
      open_weights: "Açık ağırlıklar",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Model",
    score: "Puan",
    weight: "ağırlık",
    grade: "not",
    points: "puan",
    na: "yok",
    noCriteria: "Bu profilde hiçbir ölçüt ağırlıklı değil — puanlama ölçütlerini düzenleyin.",
    needTwo: "Karşılaştırmak için en az iki kullanılabilir modeli izleyin.",
    showAll: (n) => `Tümünü göster (${n})`,
    showLess: "Daha az göster",
    strength: "Güçlü yön",
    weakness: "Zayıf yön",
    missingData: "Eksik veri 0 olarak sayılır",
    winsOn: (n) => `${n} ölçütte önde`,
    versus: "vs",
    axisQuality: "Kalite",
    axisCost: "Maliyet $/M tk",
    axisCostShort: "Ağırlıklı maliyet ($/M tk, logaritmik ölçek)",
    axisQualityShort: "Kalite (0–100)",
    free: "ücretsiz",
    frontier: "En iyi dengeler",
    frontierHint: "aynı anda hem daha ucuz hem daha iyi olan başka model yok (Pareto sınırı).",
    others: "Baskın",
    valueRead: "Sol üst en iyisidir: düşük maliyet, yüksek kalite.",
    fieldName: { intelligence_index: "Zeka", coding_index: "Kodlama", agentic_index: "Ajan" },
    estimatedHint: (from, r2, n) => `${from} temel alınarak tahmin edildi — ${n} OpenRouter modelinde doğrusal uyum (R² ${r2}). Gerçek değeri girmek için bir ısı haritası hücresine tıkla.`,
    manualHint: "Değer elle girildi (OpenRouter'ı geçersiz kılar).",
    naHint: "Veri yok: yayımlanmamış ve tahmin için başka dizin yok.",
    editHint: "Değeri girmek için tıkla (boş = OpenRouter / tahmine dön).",
    rawIndex: "ham dizin",
    hasEstimates: "Bazı notlar tahminidir (~)",
    noQuality: "Bu profil yalnızca fiyatları ağırlıklandırır — kaliteyi maliyete göre çizmek için bir kalite ölçütü (zeka, kodlama…) ekleyin."
  },
  news: {
    title: "📰 Haberler ve Güncellemeler",
    hidePanel: "Paneli gizle",
    loading: "Haberler yükleniyor…",
    none: "Haber yok.",
    promos: "SÜREN KAMPANYALAR",
    priceChanges: "FİYAT DEĞİŞİKLİKLERİ",
    newModels: "YENİ MODELLER",
    newModelsHeading: (p) => `🚀 Yeni modeller (${p})`,
    nModels: (n) => `${n} model`,
    details: "Ayrıntılar",
    follow: "Takip et",
    tracked: "İzleniyor",
    top3: "🔥 İlk 3!",
    until: (d) => `⏳ ${d} tarihine kadar`,
    threshold: "Eşik ≥",
    thresholdUnit: "/ 1g veya 7g",
    windowLabel: "Dönem:",
    windowOpts: { "1m": "1 ay (varsayılan)", "2m": "2 ay", "3m": "3 ay", "6m": "6 ay", "1y": "1 yıl", "all": "Tümü" },
    sortBy: "Sırala:",
    sortDate: "📅 Tarih",
    sortScore: "⭐ Puan",
    noNewModels: "Bu dönemde yeni model yok.",
    open: "Haberler",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Sınırlı OpenRouter kampanyası: M tk başına ${i} / ${o}`,
      price: (i, o) => `M tk başına ${i} giriş / ${o} çıkış`,
      priceWithContext: (i, o, c) => `M tk başına ${i} giriş / ${o} çıkış (${c} bağlam)`,
      priceWithParams: (i, o, p) => `M tk başına ${i} giriş / ${o} çıkış (${p} MoE)`,
      videoRate: (v, r) => `${v} video üretimi ${r}/sn`,
      agenticModel: (v, i, o) => `${v} ajan kodlama modeli, giriş ${i} / çıkış ${o}`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ İzleme profili: ${name}`,
    autoFill: "✨ Otomatik doldur",
    autoFillHint: "Hermes varsayılan modelinden bu profil için ağırlık önermesini iste",
    autoFillRunning: "Modelden yanıt bekleniyor…",
    autoFillDone: "Ölçütler model tarafından önerildi — gözden geçirip kaydet.",
    autoFillFailed: "Otomatik doldurma başarısız",
    save: "Kaydet",
    saving: "Kaydediliyor…",
    cancel: "İptal",
    delete: "Profili sil",
    deleteConfirm: (name) => `'${name}' izleme profili silinsin mi?`,
    reset: "Tüm profiller ve ölçütler varsayılan değerlere sıfırlansın mı?",
    needId: "Lütfen profil için bir tanımlayıcı gir",
    displayName: "Görünen ad:",
    displayNamePlaceholder: "örn. DevOps Uzmanı",
    saveError: "Profil kaydedilirken hata oluştu",
    close: "Kapat"
  },
  criteria: {
    intelligence: "Zeka",
    coding: "Kodlama",
    agentic: "Ajan",
    price_in: "Fiyat ↓ giriş",
    price_out: "Fiyat ↓ çıkış",
    cache_read: "Fiyat ↓ önbellek",
    context: "Bağlam penceresi",
    tools: "Araç çağrıları",
    has_vision: "Görsel",
    open_weights: "Açık ağırlıklar",
    fits_64gb: "Yerel VRAM ≤ 64GB",
    d_intelligence: "Genel akıl yürütme ve bilgi derinliği",
    d_coding: "Kod üretim kalitesi",
    d_agentic: "Ajan yetenekleri (çok adımlı özerklik)",
    d_price_in: "Ucuz giriş tokenlarının önemi",
    d_price_out: "Ucuz çıkış tokenlarının önemi",
    d_cache_read: "Ucuz önbelleklenmiş girişin önemi",
    d_context: "Çok uzun bağlamları işleyebilme (1M+ tokena yakın)",
    d_tools: "Yerleşik fonksiyon/araç çağırma (API, Bash vb.)",
    d_has_vision: "Görüntüleri ve ekran görüntülerini işleyebilme",
    d_open_weights: "Açık ağırlıklar, kendi sunucunda barındırılabilir",
    d_fits_64gb: "Standart bir GPU üzerinde yerel çalıştırma olanağı (≤ 64GB)"
  }
};

// src/locales/uk.ts
var uk = {
  title: "Рейтинг LLM-моделей",
  subtitle: "Дані OpenRouter — ціни, бенчмарки та новини",
  refresh: "Оновити",
  nVisible: (n, extra) => `${n} видно${extra}`,
  nHidden: (n) => ` (+${n} приховано)`,
  appliesTo: "Застосовується до",
  editCriteria: "Змінити критерії оцінювання",
  trackingProfile: "Профіль відстеження",
  loading: "Завантаження…",
  loadError: "Не вдалося завантажити відстежувані моделі",
  retry: "Повторити",
  searchPlaceholder: "Пошук моделі…",
  search: "Пошук",
  searchUntracked: "Пошук невідстежуваних моделей",
  tableTitle: "Відстежувані моделі",
  results: (n) => `Результати (${n})`,
  alreadyTracked: "Відстежується",
  add: "Додати",
  show: "Показати",
  hide: "Приховати",
  removeModel: "Видалити модель",
  suppressShort: "Вил.?",
  clickToShow: "Натисніть, щоб показати",
  clickToHide: "Натисніть, щоб приховати",
  criteriaWeights: "Вага критеріїв:",
  totalWeights: "Сума ваг:",
  resetAllTitle: "Скинути всі профілі та критерії до значень за замовчуванням",
  resetDefaults: "🔄 За замовчуванням",
  cancel: "Скасувати",
  confirmDeleteTitle: "Видалити цю модель?",
  confirmDeleteBody: (name) => `«${name}» буде видалено з відстежуваних моделей. Дані на OpenRouter залишаться без змін.`,
  confirmDeleteOk: "Видалити",
  updatedAgo: (m) => m < 1 ? "щойно оновлено" : `оновлено ${m} хв тому`,
  ranking: (name) => `🏆 Рейтинг — ${name}`,
  customCriteria: "Власні критерії",
  table: {
    model: "Модель",
    context: "Контекст",
    priceIn: "Ввід $/M tk",
    priceOut: "Вивід $/M tk",
    priceCache: "Читання кешу",
    intel: "Інтел.",
    coding: "Кодування",
    agentic: "Агентність",
    swe: "SWE",
    vision: "Зображення",
    open: "Відкриті",
    size: "Розмір",
    gpuOk: "GPU OK",
    tools: "Інструменти",
    score: "Бал"
  },
  views: {
    label: "Вигляд:",
    names: { classic: "Картки", stacked: "Смуги балів", columns: "Гістограми", heatmap: "Теплова карта", duel: "Двобій", value: "Якість / вартість" },
    hint: {
      classic: "Топ-5 з ціною та контекстом.",
      stacked: "Кожен сегмент — бали, отримані за одним критерієм (вага × оцінка).",
      columns: "Одна смуга на критерій: висота = оцінка, ширина = вага.",
      heatmap: "Оцінка 0–100 за кожним критерієм, найважливіші критерії першими. Натисніть на стовпець, щоб відсортувати.",
      duel: "Виберіть дві моделі та порівняйте їх критерій за критерієм.",
      value: "Якість (критерії, не пов’язані з ціною) проти зваженої вартості; пунктирна лінія з’єднує найкращі компроміси."
    },
    short: {
      intelligence: "Інтелект",
      coding: "Кодування",
      agentic: "Агентність",
      price_in: "Ціна вводу",
      price_out: "Ціна виводу",
      cache_read: "Ціна кешу",
      context: "Контекст",
      tools: "Інструменти",
      has_vision: "Зображення",
      open_weights: "Відкриті ваги",
      fits_64gb: "VRAM ≤ 64G"
    },
    model: "Модель",
    score: "Бал",
    weight: "вага",
    grade: "оцінка",
    points: "бал.",
    na: "н/д",
    noCriteria: "Для цього профілю не задано жодної ваги критерію — змініть критерії оцінювання.",
    needTwo: "Відстежуйте щонайменше дві доступні моделі, щоб порівняти їх.",
    showAll: (n) => `Показати всі (${n})`,
    showLess: "Показати менше",
    strength: "Сильна сторона",
    weakness: "Слабка сторона",
    missingData: "Відсутні дані враховуються як 0",
    winsOn: (n) => `попереду за ${n} критеріями`,
    versus: "проти",
    axisQuality: "Якість",
    axisCost: "Вартість $/M tk",
    axisCostShort: "Зважена вартість ($/M tk, лог. шкала)",
    axisQualityShort: "Якість (0–100)",
    free: "безкоштовно",
    frontier: "Найкращі компроміси",
    frontierHint: "жодна інша модель не є одночасно дешевшою та кращою (межа Парето).",
    others: "Доміновані",
    valueRead: "Найкраще — угорі ліворуч: низька вартість, висока якість.",
    fieldName: { intelligence_index: "Інтелект", coding_index: "Кодування", agentic_index: "Агентність" },
    estimatedHint: (from, r2, n) => `Оцінено за ${from} — лінійна апроксимація на ${n} моделях OpenRouter (R² ${r2}). Натисніть на клітинку теплової карти, щоб ввести реальне значення.`,
    manualHint: "Значення введено вручну (перевизначає OpenRouter).",
    naHint: "Немає даних: не опубліковано, і немає іншого індексу для оцінки.",
    editHint: "Натисніть, щоб ввести значення (порожньо = повернутися до OpenRouter / оцінки).",
    rawIndex: "сирий індекс",
    hasEstimates: "Деякі оцінки приблизні (~)",
    noQuality: "У цьому профілі враховуються лише ціни — додайте критерій якості (інтелект, кодування…), щоб побудувати графік якість/вартість."
  },
  news: {
    title: "📰 Новини та оновлення",
    hidePanel: "Приховати панель",
    loading: "Завантаження новин…",
    none: "Новин немає.",
    promos: "АКТИВНІ АКЦІЇ",
    priceChanges: "ЗМІНИ ЦІН",
    newModels: "НОВІ МОДЕЛІ",
    newModelsHeading: (p) => `🚀 Нові моделі (${p})`,
    nModels: (n) => `${n} модел${n % 10 === 1 && n % 100 !== 11 ? "ь" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "і" : "ей"}`,
    details: "Деталі",
    follow: "Перейти",
    tracked: "Відстежується",
    top3: "🔥 Топ-3!",
    until: (d) => `⏳ До ${d}`,
    threshold: "Поріг ≥",
    thresholdUnit: "/ 1d чи 7d",
    windowLabel: "Період:",
    windowOpts: { "1m": "1 місяць (за замовчуванням)", "2m": "2 місяці", "3m": "3 місяці", "6m": "6 місяців", "1y": "1 рік", "all": "Усі" },
    sortBy: "Сортувати за:",
    sortDate: "📅 Дата",
    sortScore: "⭐ Бал",
    noNewModels: "За цей період нових моделей немає.",
    open: "Новини",
    promo: {
      discount: (pct) => `-${pct}%`,
      limited: (i, o) => `Обмежена акція OpenRouter: ${i} / ${o} за M tk`,
      price: (i, o) => `${i} ввід / ${o} вивід за M tk`,
      priceWithContext: (i, o, c) => `${i} ввід / ${o} вивід за M tk (${c} контекст)`,
      priceWithParams: (i, o, p) => `${i} ввід / ${o} вивід за M tk (${p} MoE)`,
      videoRate: (v, r) => `Генерація відео ${v} за ${r}/с`,
      agenticModel: (v, i, o) => `Агентна модель ${v} для коду: ${i} ввід / ${o} вивід`
    }
  },
  modal: {
    configTitle: (name) => `⚙️ Профіль відстеження: ${name}`,
    autoFill: "✨ Автозаповнення",
    autoFillHint: "Попросити модель Hermes за замовчуванням запропонувати ваги для цього профілю",
    autoFillRunning: "Запит до моделі…",
    autoFillDone: "Критерії запропоновано моделлю — перегляньте та збережіть.",
    autoFillFailed: "Не вдалося виконати автозаповнення",
    save: "Зберегти",
    saving: "Збереження…",
    cancel: "Скасувати",
    delete: "Видалити профіль",
    deleteConfirm: (name) => `Видалити профіль відстеження «${name}»?`,
    reset: "Скинути всі профілі та критерії до значень за замовчуванням?",
    needId: "Укажіть ідентифікатор профілю",
    displayName: "Відображуване ім’я:",
    displayNamePlaceholder: "напр. DevOps-спеціаліст",
    saveError: "Помилка під час збереження профілю",
    close: "Закрити"
  },
  criteria: {
    intelligence: "Інтелект",
    coding: "Кодування",
    agentic: "Агентність",
    price_in: "Ціна ↓ ввід",
    price_out: "Ціна ↓ вивід",
    cache_read: "Ціна ↓ кеш",
    context: "Вікно контексту",
    tools: "Виклики інструментів",
    has_vision: "Зображення",
    open_weights: "Відкриті ваги",
    fits_64gb: "Локальна VRAM ≤ 64GB",
    d_intelligence: "Загальна глибина міркувань і знань",
    d_coding: "Якість генерації коду",
    d_agentic: "Агентні можливості (багатокрокова автономність)",
    d_price_in: "Важливість дешевих вхідних токенів",
    d_price_out: "Важливість дешевих вихідних токенів",
    d_cache_read: "Важливість дешевого кешованого вводу",
    d_context: "Здатність обробляти дуже довгі контексти (близько до 1M+ токенів)",
    d_tools: "Нативний виклик функцій/інструментів (API, Bash тощо)",
    d_has_vision: "Здатність обробляти зображення, скриншоти",
    d_open_weights: "Відкриті ваги, можливість самостійного хостингу",
    d_fits_64gb: "Можливість локального запуску на звичайній GPU (≤ 64GB)"
  }
};

// src/i18n.ts
var ID = "model-leaderboard";
var LOCALES = {
  en,
  fr,
  zh,
  af,
  ar,
  de,
  es,
  ga,
  hu,
  it,
  ja,
  ko,
  pt,
  ru,
  tr,
  uk,
  "zh-hant": zhHant
};
function bindI18n(t, template, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(template)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out[key] = typeof value === "function" ? (...args) => t(path, ...args) : value && typeof value === "object" ? bindI18n(t, value, path) : t(path);
  }
  return out;
}
function useLeaderboardI18n() {
  const t = usePluginI18n(ID);
  return useMemo(() => bindI18n(t, LOCALES.en), [t]);
}

// src/core/scoring.ts
var CRITERIA_KEYS = [
  "intelligence",
  "coding",
  "agentic",
  "price_in",
  "price_out",
  "cache_read",
  "context",
  "tools",
  "has_vision",
  "open_weights",
  "fits_64gb"
];
function criterionValues(m, maxes) {
  const ratio = (v, max) => v == null ? null : Math.min(1, v / (max || 1));
  const cheap = (v, max) => max > 0 ? 1 - Math.min(1, (v ?? 0) / max) : 1;
  return {
    intelligence: ratio(m.intelligence_index, maxes.maxIntel),
    coding: ratio(m.coding_index, maxes.maxCoding),
    agentic: ratio(m.agentic_index, maxes.maxAgentic),
    price_in: cheap(m.prompt_price, maxes.maxPrice),
    price_out: cheap(m.completion_price, maxes.maxPrice),
    cache_read: cheap(m.cache_read_price, maxes.maxPriceCache || 1),
    context: maxes.maxCtx > 0 ? Math.min(1, (m.context_length ?? 0) / maxes.maxCtx) : 0,
    tools: (m.supported_parameters || []).includes("tools") ? 1 : 0,
    has_vision: m.has_vision ? 1 : 0,
    open_weights: m.open_weights ? 1 : 0,
    fits_64gb: m.gpu?.fits_64gb ? 1 : 0
  };
}
function scoreBreakdown(m, weights, maxes) {
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  if (totalWeight <= 0) return [];
  const values = criterionValues(m, maxes);
  return CRITERIA_KEYS.filter((key) => (weights[key] ?? 0) > 0).map((key) => {
    const weight = weights[key];
    const v = values[key];
    const maxPoints = weight / totalWeight * 100;
    return { key, weight, note: v == null ? null : v * 100, points: (v ?? 0) * maxPoints, maxPoints };
  });
}
function computeGenericScore(m, weights, maxes) {
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  if (totalWeight <= 0) return 0;
  const values = criterionValues(m, maxes);
  const weighted = CRITERIA_KEYS.reduce((sum, key) => sum + (values[key] ?? 0) * Math.max(0, weights[key] ?? 0), 0);
  return Math.max(0, Math.min(100, weighted / totalWeight * 100));
}
function paretoFrontier(points) {
  const byCost = [...points].sort((a, b) => a.cost - b.cost || b.quality - a.quality);
  const out = [];
  let best = -Infinity;
  for (const p of byCost) {
    if (p.quality > best) {
      out.push(p);
      best = p.quality;
    }
  }
  return out;
}

// src/components/ScoreViews.tsx
import { useMemo as useMemo2, useState as useState4 } from "react";
import { Fragment as Fragment2, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var SCORE_VIEWS = ["classic", "stacked", "columns", "heatmap", "duel", "value"];
var CRITERION_COLORS = {
  intelligence: "#7c5cff",
  coding: "#4f8ff7",
  agentic: "#22b8cf",
  price_in: "#2fb36d",
  price_out: "#79c752",
  cache_read: "#b5c934",
  context: "#f5a524",
  tools: "#f07b3f",
  has_vision: "#e64980",
  open_weights: "#12a594",
  fits_64gb: "#8a8f98"
};
var INDEX_FIELD = {
  intelligence: "intelligence_index",
  coding: "coding_index",
  agentic: "agentic_index"
};
var medal = (rank) => rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
var r0 = (v) => Math.round(v);
var DRAW_PTS = 0.5;
var r1 = (v) => Math.round(v * 10) / 10;
function useBreakdowns(models, weights, maxes) {
  return useMemo2(() => {
    const out = {};
    for (const m of models) out[m.id] = scoreBreakdown(m, weights, maxes);
    return out;
  }, [models, weights, maxes]);
}
function tip(t, meta, c, m) {
  const grade = c.note == null ? t.views.na : `${r0(c.note)}/100`;
  const line = `${meta.icon} ${meta.label} — ${t.views.weight} ×${c.weight} · ${t.views.grade} ${grade} → +${r1(c.points)} / ${r1(c.maxPoints)} ${t.views.points}`;
  const field = INDEX_FIELD[c.key];
  const src = field && m?.sources?.[field];
  if (src === "estimated") {
    const e = m.estimates?.[field];
    return `${line}
~ ${e ? t.views.estimatedHint(t.views.fieldName[e.from] ?? e.from, e.r2, e.n) : ""}`;
  }
  if (src === "manual") return `${line}
✎ ${t.views.manualHint}`;
  return line;
}
function gradeBg(note) {
  if (note == null) return "transparent";
  return `color-mix(in srgb, var(--ui-green) ${Math.round(8 + note * 0.5)}%, transparent)`;
}
var box = {
  padding: 12,
  background: "var(--ui-bg-editor)",
  borderRadius: 8,
  border: "1px solid var(--ui-stroke-tertiary)"
};
function Legend({ parts, metaOf }) {
  return /* @__PURE__ */ jsx3("div", { style: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10, fontSize: 11, color: "var(--ui-text-secondary)" }, children: parts.map((c) => /* @__PURE__ */ jsxs3("span", { style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
    /* @__PURE__ */ jsx3("span", { style: { width: 10, height: 10, borderRadius: 2, background: CRITERION_COLORS[c.key] } }),
    metaOf(c.key).icon,
    " ",
    metaOf(c.key).label,
    /* @__PURE__ */ jsxs3("b", { style: { color: "var(--ui-text-primary)" }, children: [
      "×",
      c.weight
    ] })
  ] }, c.key)) });
}
function StackedView({ models, breakdowns, metaOf, icon, t }) {
  const [showAll, setShowAll] = useState4(false);
  const list = showAll ? models : models.slice(0, 8);
  const parts = breakdowns[models[0]?.id] ?? [];
  return /* @__PURE__ */ jsxs3("div", { style: box, children: [
    /* @__PURE__ */ jsx3(Legend, { parts, metaOf }),
    /* @__PURE__ */ jsx3("div", { style: { display: "grid", gridTemplateColumns: "34px minmax(120px, 220px) 1fr 44px", gap: "6px 10px", alignItems: "center" }, children: list.map((m) => /* @__PURE__ */ jsxs3(Row, { children: [
      /* @__PURE__ */ jsx3("span", { style: { fontSize: 13, textAlign: "center" }, children: medal(m._rank) }),
      /* @__PURE__ */ jsxs3("span", { style: { fontSize: 12, fontWeight: m._rank <= 3 ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, title: m.id, children: [
        icon(m.id),
        " ",
        m.label
      ] }),
      /* @__PURE__ */ jsx3("div", { style: { display: "flex", height: 18, borderRadius: 4, overflow: "hidden", background: "var(--ui-bg-tertiary)" }, children: (breakdowns[m.id] ?? []).map((c) => /* @__PURE__ */ jsx3(
        "div",
        {
          title: tip(t, metaOf(c.key), c, m),
          style: {
            width: `${c.points}%`,
            background: CRITERION_COLORS[c.key],
            borderRight: c.points > 0 ? "1px solid var(--ui-bg-editor)" : void 0
          }
        },
        c.key
      )) }),
      /* @__PURE__ */ jsx3("b", { style: { fontSize: 13, textAlign: "right", color: m._rank <= 3 ? "var(--ui-orange)" : "var(--ui-text-primary)" }, children: r0(m._score) })
    ] }, m.id)) }),
    models.length > 8 && /* @__PURE__ */ jsx3("button", { onClick: () => setShowAll((v) => !v), style: linkBtn, children: showAll ? t.views.showLess : t.views.showAll(models.length) })
  ] });
}
function ColumnsView({ models, breakdowns, metaOf, icon, t }) {
  return /* @__PURE__ */ jsx3("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }, children: models.slice(0, 6).map((m) => {
    const parts = breakdowns[m.id] ?? [];
    const graded = parts.filter((c) => c.note != null);
    const best = graded.reduce((a, c) => !a || (c.note ?? 0) > (a.note ?? 0) ? c : a, null);
    const worst = graded.reduce((a, c) => !a || (c.note ?? 0) < (a.note ?? 0) ? c : a, null);
    return /* @__PURE__ */ jsxs3("div", { style: { ...box, border: m._rank === 1 ? "2px solid var(--ui-orange)" : box.border }, children: [
      /* @__PURE__ */ jsxs3("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }, children: [
        /* @__PURE__ */ jsxs3("span", { style: { fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, title: m.id, children: [
          medal(m._rank),
          " ",
          icon(m.id),
          " ",
          m.label
        ] }),
        /* @__PURE__ */ jsx3("span", { style: { fontSize: 18, fontWeight: 800, color: "var(--ui-orange)" }, children: r0(m._score) })
      ] }),
      /* @__PURE__ */ jsxs3("div", { style: { position: "relative", display: "flex", alignItems: "flex-end", gap: 3, height: 96, marginTop: 10, borderBottom: "1px solid var(--ui-stroke-secondary)" }, children: [
        [25, 50, 75].map((g) => /* @__PURE__ */ jsx3("div", { style: { position: "absolute", left: 0, right: 0, bottom: `${g}%`, borderTop: "1px dashed var(--ui-stroke-tertiary)" } }, g)),
        parts.map((c) => /* @__PURE__ */ jsx3(
          "div",
          {
            title: tip(t, metaOf(c.key), c, m),
            style: {
              flex: `${c.weight} 1 0`,
              height: c.note == null ? "100%" : `${Math.max(2, c.note)}%`,
              background: c.note == null ? "transparent" : CRITERION_COLORS[c.key],
              border: c.note == null ? `1px dashed ${CRITERION_COLORS[c.key]}` : void 0,
              borderRadius: "3px 3px 0 0",
              position: "relative",
              zIndex: 1
            }
          },
          c.key
        ))
      ] }),
      /* @__PURE__ */ jsx3("div", { style: { display: "flex", gap: 3, marginTop: 3 }, children: parts.map((c) => /* @__PURE__ */ jsx3("span", { title: metaOf(c.key).label, style: { flex: `${c.weight} 1 0`, textAlign: "center", fontSize: 11, overflow: "hidden" }, children: metaOf(c.key).icon }, c.key)) }),
      /* @__PURE__ */ jsxs3("div", { style: { marginTop: 8, fontSize: 11, color: "var(--ui-text-tertiary)", display: "grid", gap: 2 }, children: [
        best && /* @__PURE__ */ jsxs3("span", { children: [
          "💪 ",
          t.views.strength,
          " : ",
          metaOf(best.key).label,
          " ",
          r0(best.note ?? 0)
        ] }),
        worst && worst !== best && /* @__PURE__ */ jsxs3("span", { children: [
          "⚠️ ",
          t.views.weakness,
          " : ",
          metaOf(worst.key).label,
          " ",
          r0(worst.note ?? 0)
        ] }),
        parts.some((c) => c.note == null) && /* @__PURE__ */ jsxs3("span", { children: [
          "❔ ",
          t.views.missingData
        ] }),
        parts.some((c) => INDEX_FIELD[c.key] && m.sources?.[INDEX_FIELD[c.key]] === "estimated") && /* @__PURE__ */ jsxs3("span", { children: [
          "~ ",
          t.views.hasEstimates
        ] })
      ] })
    ] }, m.id);
  }) });
}
function HeatmapView({ models, breakdowns, metaOf, icon, t, onSetIndex }) {
  const [sortKey, setSortKey] = useState4(null);
  const [editing, setEditing] = useState4(null);
  const commit = (raw) => {
    if (!editing || !onSetIndex) return;
    const v = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (v !== null && !Number.isFinite(v)) return;
    onSetIndex(editing.id, editing.field, v).finally(() => setEditing(null));
  };
  const columns = [...breakdowns[models[0]?.id] ?? []].sort((a, b) => b.weight - a.weight);
  const noteOf = (id, key) => breakdowns[id]?.find((c) => c.key === key)?.note ?? null;
  const rows = sortKey ? [...models].sort((a, b) => (noteOf(b.id, sortKey) ?? -1) - (noteOf(a.id, sortKey) ?? -1)) : models;
  const th = { padding: "6px 4px", fontSize: 11, fontWeight: 600, color: "var(--ui-text-secondary)", cursor: "pointer", userSelect: "none", verticalAlign: "bottom" };
  return /* @__PURE__ */ jsx3("div", { style: { ...box, overflowX: "auto", padding: 0 }, children: /* @__PURE__ */ jsxs3("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 }, children: [
    /* @__PURE__ */ jsx3("thead", { children: /* @__PURE__ */ jsxs3("tr", { style: { background: "var(--ui-bg-tertiary)" }, children: [
      /* @__PURE__ */ jsxs3("th", { style: { ...th, textAlign: "left", paddingLeft: 10 }, onClick: () => setSortKey(null), children: [
        t.views.model,
        sortKey ? "" : " ↓"
      ] }),
      columns.map((c) => /* @__PURE__ */ jsxs3("th", { style: { ...th, textAlign: "center", minWidth: 58 }, onClick: () => setSortKey(c.key), title: metaOf(c.key).label, children: [
        /* @__PURE__ */ jsx3("div", { style: { fontSize: 14 }, children: metaOf(c.key).icon }),
        /* @__PURE__ */ jsxs3("div", { style: { whiteSpace: "nowrap" }, children: [
          metaOf(c.key).label,
          sortKey === c.key ? " ↓" : ""
        ] }),
        /* @__PURE__ */ jsxs3("div", { style: { display: "inline-block", marginTop: 2, padding: "0 5px", borderRadius: 999, background: CRITERION_COLORS[c.key], color: "#fff", fontWeight: 700 }, children: [
          "×",
          c.weight
        ] })
      ] }, c.key)),
      /* @__PURE__ */ jsx3("th", { style: { ...th, textAlign: "right", paddingRight: 10 }, onClick: () => setSortKey(null), children: t.views.score })
    ] }) }),
    /* @__PURE__ */ jsx3("tbody", { children: rows.map((m) => /* @__PURE__ */ jsxs3("tr", { style: { borderTop: "1px solid var(--ui-stroke-tertiary)" }, children: [
      /* @__PURE__ */ jsxs3("td", { style: { padding: "5px 10px", whiteSpace: "nowrap", fontWeight: m._rank <= 3 ? 700 : 500 }, title: m.id, children: [
        medal(m._rank),
        " ",
        icon(m.id),
        " ",
        m.label
      ] }),
      columns.map((col) => {
        const c = breakdowns[m.id]?.find((x) => x.key === col.key);
        const note = c?.note ?? null;
        const field = INDEX_FIELD[col.key];
        const src = field ? m.sources?.[field] : void 0;
        const editable = !!(field && onSetIndex);
        if (editing && field && editing.id === m.id && editing.field === field) {
          return /* @__PURE__ */ jsx3("td", { style: { padding: 2, textAlign: "center" }, children: /* @__PURE__ */ jsx3(
            "input",
            {
              autoFocus: true,
              type: "text",
              inputMode: "decimal",
              defaultValue: src === "manual" ? String(m[field]) : "",
              placeholder: m[field] != null ? String(m[field]) : t.views.rawIndex,
              onKeyDown: (e) => {
                if (e.key === "Enter") commit(e.target.value);
                if (e.key === "Escape") setEditing(null);
              },
              onBlur: () => setEditing(null),
              style: { width: 56, fontSize: 12, padding: "2px 4px", textAlign: "center" }
            }
          ) }, col.key);
        }
        return /* @__PURE__ */ jsxs3(
          "td",
          {
            title: (c ? tip(t, metaOf(col.key), c, m) : "") + (editable ? `
${t.views.editHint}` : ""),
            onClick: editable ? () => setEditing({ id: m.id, field }) : void 0,
            style: {
              textAlign: "center",
              padding: "5px 4px",
              background: gradeBg(note),
              color: note == null || src === "estimated" ? "var(--ui-text-tertiary)" : "var(--ui-text-primary)",
              fontStyle: note == null || src === "estimated" ? "italic" : void 0,
              cursor: editable ? "pointer" : void 0
            },
            children: [
              note == null ? t.views.na : `${src === "estimated" ? "~" : ""}${r0(note)}`,
              src === "manual" && /* @__PURE__ */ jsx3("sup", { style: { fontSize: 9 }, children: "✎" })
            ]
          },
          col.key
        );
      }),
      /* @__PURE__ */ jsxs3("td", { style: { padding: "5px 10px", textAlign: "right", whiteSpace: "nowrap" }, children: [
        /* @__PURE__ */ jsx3("span", { style: { display: "inline-block", width: 50, height: 6, marginRight: 6, borderRadius: 3, background: "var(--ui-bg-tertiary)", verticalAlign: "middle", overflow: "hidden" }, children: /* @__PURE__ */ jsx3("span", { style: { display: "block", width: `${m._score}%`, height: "100%", background: "var(--ui-orange)" } }) }),
        /* @__PURE__ */ jsx3("b", { children: r0(m._score) })
      ] })
    ] }, m.id)) })
  ] }) });
}
function DuelView({ models, breakdowns, metaOf, icon, t }) {
  const [aId, setA] = useState4(null);
  const [bId, setB] = useState4(null);
  const a = models.find((m) => m.id === aId) ?? models[0];
  const b = models.find((m) => m.id === bId && m.id !== a?.id) ?? models.find((m) => m.id !== a?.id);
  if (!a || !b) return /* @__PURE__ */ jsx3("div", { style: box, children: t.views.needTwo });
  const pa = breakdowns[a.id] ?? [];
  const pb = breakdowns[b.id] ?? [];
  const winsA = pa.filter((c, i) => c.points - (pb[i]?.points ?? 0) >= DRAW_PTS).length;
  const winsB = pb.filter((c, i) => c.points - (pa[i]?.points ?? 0) >= DRAW_PTS).length;
  const select = (value, onChange, exclude) => /* @__PURE__ */ jsx3("select", { value, onChange: (e) => onChange(e.target.value), style: { padding: "4px 6px", borderRadius: 6, border: "1px solid var(--ui-stroke-secondary)", background: "var(--ui-bg-editor)", color: "var(--ui-text-primary)", fontSize: 12, maxWidth: 220 }, children: models.filter((m) => m.id !== exclude).map((m) => /* @__PURE__ */ jsxs3("option", { value: m.id, children: [
    "#",
    m._rank,
    " ",
    m.label
  ] }, m.id)) });
  const bar = (c, win, dir) => /* @__PURE__ */ jsxs3("div", { style: { display: "flex", justifyContent: dir === "left" ? "flex-end" : "flex-start", alignItems: "center", gap: 6 }, children: [
    dir === "left" && /* @__PURE__ */ jsx3("span", { style: { fontSize: 11, color: "var(--ui-text-tertiary)" }, children: c?.note == null ? t.views.na : r0(c.note) }),
    /* @__PURE__ */ jsx3("div", { style: { width: "70%", display: "flex", justifyContent: dir === "left" ? "flex-end" : "flex-start", height: 14, background: "var(--ui-bg-tertiary)", borderRadius: 3, overflow: "hidden" }, children: /* @__PURE__ */ jsx3("div", { style: { width: `${c?.note ?? 0}%`, background: c ? win ? CRITERION_COLORS[c.key] : `color-mix(in srgb, ${CRITERION_COLORS[c.key]} 30%, transparent)` : void 0 } }) }),
    dir === "right" && /* @__PURE__ */ jsx3("span", { style: { fontSize: 11, color: "var(--ui-text-tertiary)" }, children: c?.note == null ? t.views.na : r0(c.note) })
  ] });
  return /* @__PURE__ */ jsxs3("div", { style: box, children: [
    /* @__PURE__ */ jsxs3("div", { style: { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", marginBottom: 12 }, children: [
      /* @__PURE__ */ jsxs3("div", { style: { textAlign: "right" }, children: [
        select(a.id, setA, b.id),
        /* @__PURE__ */ jsxs3("div", { style: { fontSize: 22, fontWeight: 800, color: a._score >= b._score ? "var(--ui-orange)" : "var(--ui-text-secondary)" }, children: [
          icon(a.id),
          " ",
          r0(a._score)
        ] }),
        /* @__PURE__ */ jsx3("div", { style: { fontSize: 11, color: "var(--ui-text-tertiary)" }, children: t.views.winsOn(winsA) })
      ] }),
      /* @__PURE__ */ jsx3("div", { style: { fontWeight: 800, color: "var(--ui-text-tertiary)" }, children: t.views.versus }),
      /* @__PURE__ */ jsxs3("div", { children: [
        select(b.id, setB, a.id),
        /* @__PURE__ */ jsxs3("div", { style: { fontSize: 22, fontWeight: 800, color: b._score > a._score ? "var(--ui-orange)" : "var(--ui-text-secondary)" }, children: [
          r0(b._score),
          " ",
          icon(b.id)
        ] }),
        /* @__PURE__ */ jsx3("div", { style: { fontSize: 11, color: "var(--ui-text-tertiary)" }, children: t.views.winsOn(winsB) })
      ] })
    ] }),
    /* @__PURE__ */ jsx3("div", { style: { display: "grid", gridTemplateColumns: "1fr 150px 1fr", gap: "6px 8px", alignItems: "center" }, children: pa.map((ca, i) => {
      const cb = pb[i];
      const diff = ca.points - (cb?.points ?? 0);
      return /* @__PURE__ */ jsxs3(Row, { children: [
        bar(ca, diff >= DRAW_PTS, "left"),
        /* @__PURE__ */ jsxs3("div", { style: { textAlign: "center", fontSize: 11 }, title: `${tip(t, metaOf(ca.key), ca)}
${cb ? tip(t, metaOf(ca.key), cb) : ""}`, children: [
          /* @__PURE__ */ jsxs3("div", { style: { fontWeight: 600 }, children: [
            metaOf(ca.key).icon,
            " ",
            metaOf(ca.key).label,
            " ",
            /* @__PURE__ */ jsxs3("span", { style: { color: "var(--ui-text-tertiary)" }, children: [
              "×",
              ca.weight
            ] })
          ] }),
          /* @__PURE__ */ jsx3("div", { style: { color: Math.abs(diff) < DRAW_PTS ? "var(--ui-text-quaternary)" : "var(--ui-text-secondary)" }, children: Math.abs(diff) < DRAW_PTS ? "=" : `${diff > 0 ? "◀" : ""} ${r1(Math.abs(diff))} ${t.views.points} ${diff < 0 ? "▶" : ""}` })
        ] }),
        bar(cb, diff <= -DRAW_PTS, "right")
      ] }, ca.key);
    }) })
  ] });
}
var PRICE_KEYS = ["price_in", "price_out", "cache_read"];
var COST_FLOOR = 0.01;
var COST_TICKS = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100];
function ValueView({ models, weights, maxes, metaOf, t }) {
  const priceW = {};
  for (const k of PRICE_KEYS) if ((weights[k] ?? 0) > 0) priceW[k] = weights[k];
  if (!Object.keys(priceW).length) {
    priceW.price_in = 1;
    priceW.price_out = 1;
  }
  const priceTotal = Object.values(priceW).reduce((a, b) => a + b, 0);
  const qualityW = {};
  for (const [k, w] of Object.entries(weights)) if (w > 0 && !PRICE_KEYS.includes(k)) qualityW[k] = w;
  const qualityKeys = Object.keys(qualityW);
  if (!qualityKeys.length) return /* @__PURE__ */ jsx3("div", { style: { ...box, fontSize: 12, color: "var(--ui-text-tertiary)" }, children: t.views.noQuality });
  const priceOf = (m, k) => k === "price_in" ? m.prompt_price : k === "price_out" ? m.completion_price : m.cache_read_price ?? m.prompt_price;
  const points = models.map((m) => {
    const rawCost = Object.entries(priceW).reduce((sum, [k, w]) => sum + (priceOf(m, k) ?? 0) * w, 0) / priceTotal;
    return {
      id: m.id,
      label: m.label,
      rank: m._rank,
      score: m._score,
      rawCost,
      cost: Math.max(COST_FLOOR, rawCost),
      quality: computeGenericScore(m, qualityW, maxes)
    };
  });
  const frontier = paretoFrontier(points);
  const onFrontier = new Set(frontier.map((p) => p.id));
  const costs = points.map((p) => p.cost);
  const lo = Math.max(COST_FLOOR, ...COST_TICKS.filter((v) => v <= Math.min(...costs)));
  const hi = Math.min(...COST_TICKS.filter((v) => v >= Math.max(...costs)), COST_TICKS[COST_TICKS.length - 1]);
  const ticks = COST_TICKS.filter((v) => v >= lo && v <= hi);
  const fmtCost = (v) => v <= COST_FLOOR ? t.views.free : `$${v < 1 ? v.toFixed(2) : v.toFixed(1)}`;
  const qualityLabel = `${t.views.axisQuality} — ${qualityKeys.map((k) => `${metaOf(k).label} ×${qualityW[k]}`).join(", ")}`;
  const costLabel = `${t.views.axisCost} — ${Object.entries(priceW).map(([k, w]) => `${metaOf(k).label} ×${w}`).join(", ")}`;
  const pointTitle = (p) => {
    return /* @__PURE__ */ jsxs3("div", { style: { padding: "2px 4px", fontSize: 12, minWidth: 150 }, children: [
      /* @__PURE__ */ jsxs3("b", { children: [
        medal(p.rank),
        " ",
        p.label
      ] }),
      /* @__PURE__ */ jsxs3("div", { children: [
        t.views.axisQuality,
        " : ",
        r0(p.quality),
        "/100"
      ] }),
      /* @__PURE__ */ jsxs3("div", { children: [
        t.views.axisCost,
        " : ",
        fmtCost(p.rawCost),
        "/M tk"
      ] }),
      /* @__PURE__ */ jsxs3("div", { children: [
        t.views.score,
        " : ",
        r0(p.score)
      ] }),
      onFrontier.has(p.id) && /* @__PURE__ */ jsxs3("div", { style: { color: "var(--ui-orange)" }, children: [
        "★ ",
        t.views.frontier
      ] })
    ] });
  };
  const scatterPoints = points.map((p) => ({
    id: p.id,
    label: p.label,
    x: p.cost,
    y: p.quality,
    frontier: onFrontier.has(p.id),
    title: pointTitle(p)
  }));
  return /* @__PURE__ */ jsxs3("div", { style: box, children: [
    /* @__PURE__ */ jsxs3("div", { style: { fontSize: 11, color: "var(--ui-text-tertiary)", marginBottom: 6, display: "grid", gap: 2 }, children: [
      /* @__PURE__ */ jsxs3("span", { children: [
        "↖ ",
        t.views.valueRead
      ] }),
      /* @__PURE__ */ jsxs3("span", { children: [
        "↑ ",
        qualityLabel
      ] }),
      /* @__PURE__ */ jsxs3("span", { children: [
        "→ ",
        costLabel
      ] })
    ] }),
    /* @__PURE__ */ jsx3(
      ScatterLog,
      {
        points: scatterPoints,
        lo,
        hi,
        ticks,
        formatX: fmtCost,
        xLabel: t.views.axisCostShort,
        yLabel: t.views.axisQualityShort,
        height: 400
      }
    ),
    /* @__PURE__ */ jsxs3("div", { style: { fontSize: 12, marginTop: 4 }, children: [
      /* @__PURE__ */ jsxs3("b", { style: { color: "var(--ui-orange)" }, children: [
        "★ ",
        t.views.frontier
      ] }),
      /* @__PURE__ */ jsxs3("span", { style: { color: "var(--ui-text-tertiary)" }, children: [
        " — ",
        t.views.frontierHint
      ] }),
      /* @__PURE__ */ jsx3("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }, children: frontier.map((p) => /* @__PURE__ */ jsxs3("span", { style: { padding: "2px 8px", borderRadius: 999, border: "1px solid var(--ui-orange)", fontSize: 11 }, children: [
        p.label,
        " · ",
        r0(p.quality),
        " · ",
        fmtCost(p.rawCost)
      ] }, p.id)) })
    ] })
  ] });
}
function Row({ children }) {
  return /* @__PURE__ */ jsx3(Fragment2, { children });
}
var linkBtn = { marginTop: 8, border: "none", background: "transparent", color: "var(--ui-accent)", cursor: "pointer", fontSize: 12, padding: 0 };
function ScoreView({ view, models, weights, maxes, criteria, icon, t, onSetIndex }) {
  const breakdowns = useBreakdowns(models, weights, maxes);
  const metaOf = (k) => criteria.find((c) => c.key === k) ?? { key: k, label: k, icon: "•" };
  if (!models.length) return null;
  if (!(breakdowns[models[0].id] ?? []).length) return /* @__PURE__ */ jsx3("div", { style: { ...box, fontSize: 12, color: "var(--ui-text-tertiary)" }, children: t.views.noCriteria });
  const args = { models, breakdowns, metaOf, icon, t, onSetIndex };
  if (view === "stacked") return /* @__PURE__ */ jsx3(StackedView, { ...args });
  if (view === "columns") return /* @__PURE__ */ jsx3(ColumnsView, { ...args });
  if (view === "heatmap") return /* @__PURE__ */ jsx3(HeatmapView, { ...args });
  if (view === "value") return /* @__PURE__ */ jsx3(ValueView, { ...args, weights, maxes });
  return /* @__PURE__ */ jsx3(DuelView, { ...args });
}

// src/LeaderboardPage.tsx
import { Fragment as Fragment3, jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var AVAILABLE_CRITERIA = [
  { key: "intelligence", icon: "🧠" },
  { key: "coding", icon: "💻" },
  { key: "agentic", icon: "🤖" },
  { key: "price_in", icon: "📥" },
  { key: "price_out", icon: "📤" },
  { key: "cache_read", icon: "⚡" },
  { key: "context", icon: "📚" },
  { key: "tools", icon: "🛠️" },
  { key: "has_vision", icon: "👁️" },
  { key: "open_weights", icon: "🔓" },
  { key: "fits_64gb", icon: "🖥️" }
];
var DEFAULT_PROFILES = {
  architect: {
    id: "architect",
    name: "Architecte",
    weights: { intelligence: 5, coding: 4, context: 3, price_in: 2, price_out: 2, has_vision: 1 }
  },
  "senior-coder": {
    id: "senior-coder",
    name: "Senior Coder",
    weights: { coding: 5, agentic: 5, price_out: 3, context: 3, has_vision: 2, intelligence: 2 }
  },
  "junior-coder": {
    id: "junior-coder",
    name: "Junior Coder",
    weights: { price_out: 5, open_weights: 4, price_in: 3, fits_64gb: 3, tools: 2, coding: 2 }
  },
  manager: {
    id: "manager",
    name: "Manager",
    weights: { price_in: 5, intelligence: 4, price_out: 3, tools: 3, context: 3 }
  },
  qa: {
    id: "qa",
    name: "QA",
    weights: { coding: 4, price_out: 4, intelligence: 3, context: 2, agentic: 1 }
  }
};
function fmtPrice(v) {
  if (v == null) return "…";
  if (v === 0) return "$0";
  return "$" + v.toFixed(2) + "/M tk";
}
function SourcedIdx({ m, field, t }) {
  const v = m[field];
  const src = m.sources?.[field];
  if (v == null) return /* @__PURE__ */ jsx4("span", { title: t.views.naHint, children: "…" });
  if (src === "estimated") {
    const e = m.estimates?.[field];
    return /* @__PURE__ */ jsxs4("i", { style: { color: "var(--ui-text-tertiary)" }, title: e ? t.views.estimatedHint(t.views.fieldName[e.from] ?? e.from, e.r2, e.n) : "", children: [
      "~",
      v.toFixed(1)
    ] });
  }
  if (src === "manual") return /* @__PURE__ */ jsxs4("span", { title: t.views.manualHint, children: [
    v.toFixed(1),
    /* @__PURE__ */ jsx4("sup", { style: { fontSize: 9 }, children: "✎" })
  ] });
  return /* @__PURE__ */ jsx4(Fragment3, { children: v.toFixed(1) });
}
function measured(m, field) {
  return m.sources?.[field] === "estimated" ? 0 : m[field] || 0;
}
function fmtCtx(v) {
  if (!v) return "?";
  if (v >= 1e6) {
    const millions = v / 1e6;
    return v % 1e6 === 0 ? `${millions}M` : `+${Math.floor(millions)}M`;
  }
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
  return `${v}`;
}
function buildModelTooltip(m) {
  const inMod = m.input_modalities && m.input_modalities.length > 0 ? m.input_modalities.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ") : m.has_vision ? "Text, Image" : "Text";
  const outMod = m.output_modalities && m.output_modalities.length > 0 ? m.output_modalities.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ") : "Text";
  const lines = [
    `Modèle : ${m.label || m.name || m.id}`,
    `Contexte max : ${(m.context_length || 0).toLocaleString()} tokens (${fmtCtx(m.context_length)})`,
    `Prix Input : ${fmtPrice(m.prompt_price)}`,
    `Prix Output : ${fmtPrice(m.completion_price)}`
  ];
  if (m.cache_read_price != null) lines.push(`Cache Read : ${fmtPrice(m.cache_read_price)}`);
  if (m.cache_write_price != null) lines.push(`Cache Write : ${fmtPrice(m.cache_write_price)}`);
  if (m.web_search_price != null) lines.push(`Web Search : $${m.web_search_price}/1k req`);
  if (m.internal_reasoning_price != null) lines.push(`Reasoning Tokens : ${fmtPrice(m.internal_reasoning_price)}`);
  lines.push(`Modalités : Input: [${inMod}] → Output: [${outMod}]`);
  return lines.join("\n");
}
function fmtDate(ts) {
  if (!ts) return "–";
  return new Date(ts * 1e3).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}
var providerIcons = {
  anthropic: "🅐",
  openai: "🅞",
  google: "🅖",
  deepseek: "🅓",
  qwen: "🅠",
  moonshotai: "🌙",
  mistralai: "Ⓜ",
  meta: "⬡",
  nvidia: "🅝",
  amazon: "🅐",
  cohere: "🅒",
  xai: "✕"
};
function providerIcon(id) {
  for (const [k, v] of Object.entries(providerIcons)) if (id.split("/")[0].includes(k)) return v;
  return "🤖";
}
function providerName(id) {
  const p = id.split("/")[0];
  for (const k of Object.keys(providerIcons)) if (p.includes(k)) return k.charAt(0).toUpperCase() + k.slice(1);
  return p;
}
var colors = [
  "var(--ui-purple)",
  "#82ca9d",
  "#ffc658",
  "var(--ui-orange)",
  "#00C49F",
  "#0088FE",
  "#FFBB28",
  "#FF8042",
  "#a4de6c",
  "#d0ed57",
  "#83a6ed",
  "#8dd1e1",
  "var(--ui-red)",
  "#ba68c8",
  "#4db6ac",
  "#795548"
];
var S = {
  wrap: { fontFamily: "var(--dt-font-sans)", color: "var(--ui-text-primary)", padding: "8px 14px" },
  flexRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  gap: { display: "flex", gap: 8, alignItems: "center" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { textAlign: "left", padding: "6px 8px", background: "var(--ui-bg-tertiary)", borderBottom: "2px solid var(--ui-stroke-primary)", whiteSpace: "nowrap", color: "var(--ui-text-secondary)", fontWeight: 700 },
  trEven: { background: "var(--ui-bg-editor)" },
  trOdd: { background: "var(--ui-row-hover-background)" },
  td: { padding: "5px 8px", borderBottom: "1px solid var(--ui-stroke-tertiary)" },
  searchRow: { padding: "6px 10px", borderBottom: "1px solid var(--ui-stroke-tertiary)", fontSize: 13 },
  tabBtn: (active) => ({
    padding: "8px 18px",
    border: "none",
    borderBottom: active ? "3px solid var(--ui-accent)" : "3px solid transparent",
    background: "none",
    fontWeight: active ? 700 : 500,
    color: active ? "var(--ui-accent-secondary)" : "var(--ui-text-tertiary)",
    cursor: "pointer",
    fontSize: 15
  }),
  card: {
    background: "var(--ui-bg-editor)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
    border: "1px solid var(--ui-stroke-tertiary)",
    flex: 1,
    minWidth: 200,
    boxShadow: "var(--shadow-sm)"
  },
  iconBtn: {
    padding: "5px 8px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--ui-stroke-secondary)",
    background: "var(--ui-bg-editor)",
    color: "var(--ui-text-secondary)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    transition: "all 0.15s ease"
  }
};
function App() {
  const i18n = useLeaderboardI18n();
  const [hermesProfiles, setHermesProfiles] = useState5([]);
  const [serverProfiles, setServerProfiles] = useState5(DEFAULT_PROFILES);
  const [selectedProfileId, setSelectedProfileId] = useState5("default");
  const [editingProfile, setEditingProfile] = useState5(null);
  const [isNewProfile, setIsNewProfile] = useState5(false);
  const [modalOpen, setModalOpen] = useState5(false);
  const [savingProfile, setSavingProfile] = useState5(false);
  const [models, setModels] = useState5([]);
  const [hiddenIds, setHiddenIds] = useState5(/* @__PURE__ */ new Set());
  const [radarHidden, setRadarHidden] = useState5(/* @__PURE__ */ new Set());
  const [loading, setLoading] = useState5(true);
  const [q, setQ] = useState5("");
  const [searchRes, setSearchRes] = useState5([]);
  const [adding, setAdding] = useState5(false);
  const [searchUntracked, setSearchUntracked] = useState5(true);
  const [pendingDelete, setPendingDelete] = useState5(null);
  const [sortCol, setSortCol] = useState5(null);
  const [sortAsc, setSortAsc] = useState5(true);
  const [scoreView, setScoreViewState] = useState5(() => {
    try {
      const v = localStorage.getItem("llm-dash-score-view");
      return v && SCORE_VIEWS.includes(v) ? v : "classic";
    } catch {
      return "classic";
    }
  });
  const setScoreView = (v) => {
    setScoreViewState(v);
    try {
      localStorage.setItem("llm-dash-score-view", v);
    } catch {
    }
  };
  const [showNews, setShowNews] = useState5(true);
  const [news, setNews] = useState5(null);
  const [loadingNews, setLoadingNews] = useState5(false);
  const [newsSortBy, setNewsSortBy] = useState5("date");
  const [newsTimeWindow, setNewsTimeWindow] = useState5("1m");
  const [newsVisibleLimit, setNewsVisibleLimit] = useState5(8);
  useEffect3(() => {
    const raw = localStorage.getItem("llm-dash-hidden");
    if (raw) setHiddenIds(new Set(JSON.parse(raw)));
    const rawRadar = localStorage.getItem("llm-dash-radar-hidden");
    if (rawRadar) setRadarHidden(new Set(JSON.parse(rawRadar)));
    const rawProfile = localStorage.getItem("llm-dash-profile");
    if (rawProfile) setSelectedProfileId(rawProfile);
    const rawNews = localStorage.getItem("llm-dash-show-news");
    if (rawNews !== null) setShowNews(rawNews === "true");
  }, []);
  const fetchProfiles = () => {
    api("/profiles").then((data) => {
      if (data.profiles && Object.keys(data.profiles).length > 0) {
        setServerProfiles(data.profiles);
      }
    }).catch(() => {
    });
  };
  useEffect3(() => {
    fetchProfiles();
  }, []);
  const effectiveProfiles = serverProfiles;
  const defaultWeights = {
    intelligence: 5,
    coding: 0,
    agentic: 0,
    price_in: 3,
    price_out: 3,
    cache_read: 0,
    context: 0,
    tools: 0,
    has_vision: 0,
    open_weights: 0,
    fits_64gb: 0
  };
  const currentProfile = useMemo3(() => {
    return effectiveProfiles[selectedProfileId] || {
      id: selectedProfileId,
      name: selectedProfileId,
      weights: { ...defaultWeights }
    };
  }, [effectiveProfiles, selectedProfileId]);
  const toggleNews = () => {
    setShowNews((prev) => {
      const next = !prev;
      localStorage.setItem("llm-dash-show-news", String(next));
      return next;
    });
  };
  const toggleHidden = (id) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("llm-dash-hidden", JSON.stringify([...next]));
      return next;
    });
  };
  const toggleRadar = (label) => {
    setRadarHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem("llm-dash-radar-hidden", JSON.stringify([...next]));
      return next;
    });
  };
  const [lastRefresh, setLastRefresh] = useState5(null);
  const [loadError, setLoadError] = useState5(null);
  const applyModels = (d) => {
    setModels(Array.isArray(d?.models) ? d.models : []);
    setLastRefresh(d?.last_refresh ?? null);
    setLoadError(null);
  };
  const fetchModels = () => {
    setLoading(true);
    api("/models").then(applyModels).catch((err) => setLoadError(err?.message || String(err))).finally(() => setLoading(false));
  };
  useEffect3(() => {
    fetchModels();
  }, []);
  useEffect3(() => {
    const uiPoll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api("/models").then(applyModels).catch(() => void 0);
      api("/news").then((d) => setNews(d)).catch(() => void 0);
    }, 6e4);
    const dataPull = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api("/refresh", { method: "POST", body: {} }).then(() => Promise.all([
        api("/models").then(applyModels),
        api("/news").then((d) => setNews(d))
      ])).catch(() => void 0);
    }, 10 * 6e4);
    return () => {
      clearInterval(uiPoll);
      clearInterval(dataPull);
    };
  }, []);
  useEffect3(() => {
    api("/hermes-profiles").then((d) => setHermesProfiles(d.profiles || ["default"])).catch(() => setHermesProfiles(["default"]));
  }, []);
  const fetchNews = () => {
    setLoadingNews(true);
    api("/news").then((d) => setNews(d)).catch(() => void 0).finally(() => setLoadingNews(false));
  };
  useEffect3(() => {
    fetchNews();
  }, []);
  const refresh = () => {
    setLoading(true);
    api("/refresh", { method: "POST", body: { force: true } }).then(() => api("/models")).then(applyModels).then(() => fetchNews()).catch((err) => {
      console.error("[leaderboard] refresh failed:", err);
      setLoadError(err?.message || String(err));
    }).finally(() => setLoading(false));
  };
  const addModel = (id) => {
    setAdding(true);
    api("/models", { method: "POST", body: { id } }).then(() => {
      fetchModels();
      fetchNews();
      setQ("");
      setSearchRes([]);
    }).finally(() => setAdding(false));
  };
  const removeModel = (id) => setPendingDelete(id);
  const setIndexOverride = (modelId, field, value) => api("/benchmarks", { method: "POST", body: { model_id: modelId, field, value } }).then(() => api("/models")).then(applyModels).catch((err) => setLoadError(err?.message || String(err)));
  const confirmRemove = async () => {
    const id = pendingDelete;
    if (!id) return;
    await api(`/models/${encodeURIComponent(id)}`, { method: "DELETE" });
    fetchModels();
    fetchNews();
  };
  const search = () => {
    if (!searchUntracked || !q.trim()) {
      setSearchRes([]);
      return;
    }
    api(`/openrouter/search?q=${encodeURIComponent(q)}`).then((d) => setSearchRes(d.results || []));
  };
  const openEditModal = () => {
    setEditingProfile(JSON.parse(JSON.stringify(currentProfile)));
    setIsNewProfile(false);
    setModalOpen(true);
  };
  const openCreateModal = () => {
    setEditingProfile({
      id: "",
      name: "",
      weights: {
        intelligence: 3,
        coding: 3,
        agentic: 3,
        price_in: 2,
        price_out: 2,
        context: 2,
        tools: 2,
        has_vision: 1,
        open_weights: 0,
        fits_64gb: 0,
        cache_read: 0
      }
    });
    setIsNewProfile(true);
    setModalOpen(true);
  };
  const resetToDefaultProfiles = () => {
    if (!confirm(i18n.modal.reset)) return;
    setSelectedProfileId("default");
    localStorage.setItem("llm-dash-profile", "default");
    setModalOpen(false);
  };
  const [autoFilling, setAutoFilling] = useState5(false);
  const [autoFillMsg, setAutoFillMsg] = useState5("");
  const autoFillCriteria = () => {
    if (!editingProfile || autoFilling) return;
    setAutoFilling(true);
    setAutoFillMsg(i18n.modal.autoFillRunning);
    api("/auto-fill", { method: "POST", body: { profile_id: editingProfile.id, profile_name: editingProfile.name } }).then((d) => {
      const w = d && d.weights ? d.weights : {};
      setEditingProfile((prev) => prev ? { ...prev, weights: { ...prev.weights, ...w } } : prev);
      setAutoFillMsg(i18n.modal.autoFillDone);
    }).catch((err) => {
      setAutoFillMsg(`${i18n.modal.autoFillFailed}: ${err && err.message ? err.message : err}`);
    }).finally(() => setAutoFilling(false));
  };
  const saveProfileConfig = () => {
    if (!editingProfile) return;
    const id = editingProfile.id.trim().toLowerCase();
    if (!id) {
      alert(i18n.modal.needId);
      return;
    }
    setSavingProfile(true);
    const method = isNewProfile ? "POST" : "PUT";
    const url = isNewProfile ? "/profiles" : `/profiles/${encodeURIComponent(id)}`;
    const createOn404 = (err) => !isNewProfile && /\b404\b/.test(String(err?.message || "")) ? api("/profiles", { method: "POST", body: editingProfile }) : Promise.reject(err);
    api(url, {
      method,
      body: editingProfile
    }).catch(createOn404).then((data) => {
      if (data.profile) {
        setServerProfiles((prev) => ({ ...prev, [data.profile.id]: data.profile }));
        setSelectedProfileId(data.profile.id);
        localStorage.setItem("llm-dash-profile", data.profile.id);
      }
      setModalOpen(false);
    }).catch((err) => {
      alert(err.message || i18n.modal.saveError);
    }).finally(() => setSavingProfile(false));
  };
  const deleteCurrentProfile = () => {
    if (!editingProfile || isNewProfile) return;
    const pid = editingProfile.id;
    if (!confirm(i18n.modal.deleteConfirm(editingProfile.name))) return;
    setSavingProfile(true);
    const ignoreMissing = (err) => /\b404\b/.test(String(err?.message || "")) ? Promise.resolve() : Promise.reject(err);
    api(`/profiles/${encodeURIComponent(pid)}`, { method: "DELETE" }).catch(ignoreMissing).then(() => {
      setServerProfiles((prev) => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
      const remaining = Object.keys(effectiveProfiles).filter((k) => k !== pid);
      const nextId = remaining[0] || "default";
      setSelectedProfileId(nextId);
      localStorage.setItem("llm-dash-profile", nextId);
      setModalOpen(false);
    }).catch((err) => alert(err.message || i18n.modal.saveError)).finally(() => setSavingProfile(false));
  };
  const sortFns = {
    label: (a, b) => a.label.localeCompare(b.label),
    context_length: (a, b) => (a.context_length || 0) - (b.context_length || 0),
    prompt_price: (a, b) => (a.prompt_price ?? Infinity) - (b.prompt_price ?? Infinity),
    completion_price: (a, b) => (a.completion_price ?? Infinity) - (b.completion_price ?? Infinity),
    cache_read_price: (a, b) => (a.cache_read_price ?? Infinity) - (b.cache_read_price ?? Infinity),
    intelligence_index: (a, b) => (a.intelligence_index ?? -1) - (b.intelligence_index ?? -1),
    coding_index: (a, b) => (a.coding_index ?? -1) - (b.coding_index ?? -1),
    agentic_index: (a, b) => (a.agentic_index ?? -1) - (b.agentic_index ?? -1),
    open_weights: (a, b) => (a.open_weights ? 1 : 0) - (b.open_weights ? 1 : 0),
    tools: (a, b) => ((a.supported_parameters || []).includes("tools") ? 1 : 0) - ((b.supported_parameters || []).includes("tools") ? 1 : 0),
    has_vision: (a, b) => (a.has_vision ? 1 : 0) - (b.has_vision ? 1 : 0)
  };
  const toggleSort = (col) => {
    if (sortCol === col) setSortAsc((prev) => !prev);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
  };
  const sortArrow = (col) => sortCol === col ? sortAsc ? " ↑" : " ↓" : " ↕";
  const visible = models.filter((m) => !hiddenIds.has(m.id));
  const hidden = models.filter((m) => hiddenIds.has(m.id));
  const active = visible.filter((m) => m.available);
  const maxes = useMemo3(() => ({
    maxCtx: Math.max(1, ...models.map((m) => m.context_length || 0)),
    maxPrice: Math.max(0.01, ...models.flatMap((m) => [m.prompt_price || 0, m.completion_price || 0])),
    maxPriceIn: Math.max(0.01, ...models.map((m) => m.prompt_price || 0)),
    maxPriceOut: Math.max(0.01, ...models.map((m) => m.completion_price || 0)),
    maxPriceCache: Math.max(0.01, ...models.map((m) => m.cache_read_price || 0)),
    // Index maxima from MEASURED values only: an estimate must not set the
    // 100 % mark that every other model is graded against.
    maxIntel: Math.max(1, ...models.map((m) => measured(m, "intelligence_index"))),
    maxCoding: Math.max(1, ...models.map((m) => measured(m, "coding_index"))),
    maxAgentic: Math.max(1, ...models.map((m) => measured(m, "agentic_index")))
  }), [models]);
  const scoredModels = useMemo3(() => {
    const withScores = active.map((m) => ({
      ...m,
      _score: Math.round(computeGenericScore(m, currentProfile.weights, maxes) * 100) / 100
    }));
    withScores.sort((a, b) => b._score - a._score);
    withScores.forEach((m, i) => {
      m._rank = i + 1;
    });
    return withScores;
  }, [active, currentProfile, maxes]);
  const top3Threshold = useMemo3(() => {
    if (scoredModels.length < 3) return 0;
    const rank3Score = Math.round(scoredModels[2]._score);
    const rank4Score = scoredModels.length >= 4 ? Math.round(scoredModels[3]._score) : rank3Score;
    return Math.min(rank3Score, rank4Score);
  }, [scoredModels]);
  const scoreMap = {};
  scoredModels.forEach((m) => {
    scoreMap[m.id] = m._score;
  });
  const sortedModels = useMemo3(() => {
    if (sortCol && sortFns[sortCol]) {
      const sorted = [...models].sort(sortFns[sortCol]);
      return sortAsc ? sorted : sorted.reverse();
    }
    return [...models].sort((a, b) => (scoreMap[b.id] ?? 0) - (scoreMap[a.id] ?? 0));
  }, [models, sortCol, sortAsc, scoreMap]);
  const processedNewModels = useMemo3(() => {
    if (!news?.new_models) return [];
    const nowTs = Math.floor(Date.now() / 1e3);
    const windowDays = newsTimeWindow === "1m" ? 30 : newsTimeWindow === "2m" ? 60 : newsTimeWindow === "3m" ? 90 : newsTimeWindow === "6m" ? 180 : newsTimeWindow === "1y" ? 365 : 99999;
    const minCreated = nowTs - windowDays * 86400;
    const list = news.new_models.filter((nm) => (nm.created || 0) >= minCreated).map((nm) => {
      const rawScore = computeGenericScore(nm, currentProfile.weights, maxes);
      const roundedScore = Math.round(rawScore);
      const isChallenger = roundedScore > 0 && top3Threshold > 0 && roundedScore >= top3Threshold;
      return {
        ...nm,
        _score: rawScore,
        _roundedScore: roundedScore,
        _isChallenger: isChallenger
      };
    });
    if (newsSortBy === "score") {
      list.sort((a, b) => b._score - a._score);
    } else {
      list.sort((a, b) => (b.created || 0) - (a.created || 0));
    }
    return list;
  }, [news?.new_models, newsTimeWindow, newsSortBy, currentProfile, maxes, top3Threshold]);
  const processedPromotions = useMemo3(() => {
    if (!news?.promotions) return [];
    return news.promotions.map((p) => {
      const rawScore = computeGenericScore(p, currentProfile.weights, maxes);
      const roundedScore = Math.round(rawScore);
      const isChallenger = roundedScore > 0 && top3Threshold > 0 && roundedScore >= top3Threshold;
      return {
        ...p,
        _score: rawScore,
        _roundedScore: roundedScore,
        _isChallenger: isChallenger
      };
    });
  }, [news?.promotions, currentProfile, maxes, top3Threshold]);
  const radarData = useMemo3(() => {
    if (active.length < 2) return [];
    const short = i18n.views.short;
    const criteriaDefinitions = AVAILABLE_CRITERIA.map((c) => ({ key: c.key, label: short[c.key], getValue: (m) => (criterionValues(m, maxes)[c.key] ?? 0) * 100 }));
    const activeCriteria = criteriaDefinitions.filter((c) => (currentProfile.weights[c.key] ?? 0) > 0);
    const finalCriteria = activeCriteria.length > 0 ? activeCriteria : criteriaDefinitions.slice(0, 5);
    return finalCriteria.map((crit) => {
      const entry = { label: crit.label };
      for (const m of active) {
        entry[m.label] = crit.getValue(m);
      }
      return entry;
    });
  }, [active, maxes, currentProfile.weights, i18n]);
  const allLabels = active.map((m) => m.label);
  const colorByLabel = {};
  allLabels.forEach((l, i) => {
    colorByLabel[l] = i;
  });
  const activeLabels = allLabels.filter((l) => !radarHidden.has(l));
  const byPriceIn = [...active].sort((a, b) => (a.prompt_price ?? 0) - (b.prompt_price ?? 0));
  const byPriceOut = [...active].sort((a, b) => (a.completion_price ?? 0) - (b.completion_price ?? 0));
  const byCtx = [...active].sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0));
  return /* @__PURE__ */ jsxs4("div", { style: S.wrap, children: [
    /* @__PURE__ */ jsx4("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }, children: /* @__PURE__ */ jsxs4("div", { children: [
      /* @__PURE__ */ jsx4("h1", { style: { marginBottom: 4, marginTop: 0, color: "var(--ui-text-primary)", fontSize: 15, fontWeight: 650, letterSpacing: "-0.01em" }, children: i18n.title }),
      /* @__PURE__ */ jsx4("p", { style: { color: "var(--ui-text-tertiary)", fontSize: 13, marginTop: 0 }, children: i18n.subtitle })
    ] }) }),
    /* @__PURE__ */ jsxs4("div", { style: { display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }, children: [
      /* @__PURE__ */ jsx4("span", { style: { fontSize: 12, fontWeight: 500, color: "var(--ui-text-secondary)" }, children: i18n.appliesTo }),
      /* @__PURE__ */ jsx4("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children: (hermesProfiles.length ? hermesProfiles : ["default"]).map((name) => {
        const active2 = name === selectedProfileId;
        return /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: () => {
              setSelectedProfileId(name);
              localStorage.setItem("llm-dash-profile", name);
              setSortCol(null);
            },
            style: {
              borderRadius: 999,
              padding: "4px 12px",
              cursor: "pointer",
              fontSize: 12,
              border: `1px solid ${active2 ? "var(--ui-stroke-secondary)" : "var(--ui-stroke-tertiary)"}`,
              background: active2 ? "var(--ui-bg-tertiary)" : "var(--ui-bg-editor)",
              color: active2 ? "var(--ui-text-primary)" : "var(--ui-text-tertiary)"
            },
            children: name
          },
          name
        );
      }) })
    ] }),
    /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: 10, alignItems: "flex-start" }, children: [
      /* @__PURE__ */ jsxs4("div", { style: { flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ jsx4("div", { style: { ...S.flexRow, marginBottom: 16 }, children: !showNews && /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: toggleNews,
            style: {
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--ui-accent-secondary)",
              background: "var(--ui-bg-editor)",
              color: "var(--ui-accent-secondary)",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer"
            },
            children: `📰 ${i18n.news.open} ▶`
          }
        ) }),
        loadError && /* @__PURE__ */ jsxs4("div", { role: "alert", style: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 12, borderRadius: 6, border: "1px solid var(--ui-red)", background: "color-mix(in srgb, var(--ui-red) 8%, transparent)", fontSize: 12 }, children: [
          /* @__PURE__ */ jsxs4("span", { style: { flex: 1 }, children: [
            /* @__PURE__ */ jsx4("b", { children: i18n.loadError }),
            " — ",
            loadError
          ] }),
          /* @__PURE__ */ jsx4("button", { onClick: fetchModels, style: { padding: "4px 10px", borderRadius: 4, border: "1px solid var(--ui-stroke-secondary)", background: "var(--ui-bg-editor)", cursor: "pointer" }, children: i18n.retry })
        ] }),
        loading ? /* @__PURE__ */ jsx4("p", { children: i18n.loading }) : /* @__PURE__ */ jsxs4(Fragment3, { children: [
          /* @__PURE__ */ jsxs4("div", { style: { marginBottom: 24, padding: 16, background: "var(--ui-row-hover-background)", borderRadius: 8, border: "1px solid var(--ui-stroke-tertiary)" }, children: [
            /* @__PURE__ */ jsxs4("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
              /* @__PURE__ */ jsx4("h3", { style: { margin: 0, color: "var(--ui-text-primary)" }, children: i18n.ranking(currentProfile.name) }),
              /* @__PURE__ */ jsxs4("span", { style: { display: "flex", gap: 10, alignItems: "center" }, children: [
                /* @__PURE__ */ jsx4("span", { style: { fontSize: 12, color: "var(--ui-text-tertiary)" }, children: i18n.customCriteria }),
                /* @__PURE__ */ jsx4(
                  "button",
                  {
                    onClick: openEditModal,
                    style: { border: "none", background: "transparent", color: "var(--ui-accent)", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 },
                    children: i18n.editCriteria
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxs4("div", { role: "tablist", "aria-label": i18n.views.label, style: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 10 }, children: [
              /* @__PURE__ */ jsx4("span", { style: { fontSize: 12, color: "var(--ui-text-tertiary)", marginRight: 4 }, children: i18n.views.label }),
              SCORE_VIEWS.map((v) => /* @__PURE__ */ jsx4(
                "button",
                {
                  role: "tab",
                  "aria-selected": scoreView === v,
                  onClick: () => setScoreView(v),
                  title: i18n.views.hint[v],
                  style: {
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    cursor: "pointer",
                    border: `1px solid ${scoreView === v ? "var(--ui-accent)" : "var(--ui-stroke-tertiary)"}`,
                    background: scoreView === v ? "color-mix(in srgb, var(--ui-accent) 12%, var(--ui-bg-editor))" : "var(--ui-bg-editor)",
                    color: scoreView === v ? "var(--ui-text-primary)" : "var(--ui-text-secondary)",
                    fontWeight: scoreView === v ? 650 : 500
                  },
                  children: i18n.views.names[v]
                },
                v
              )),
              /* @__PURE__ */ jsx4("span", { style: { fontSize: 11, color: "var(--ui-text-quaternary)", marginLeft: 6 }, children: i18n.views.hint[scoreView] })
            ] }),
            scoreView !== "classic" ? /* @__PURE__ */ jsx4(
              ScoreView,
              {
                view: scoreView,
                models: scoredModels,
                weights: currentProfile.weights,
                maxes,
                criteria: AVAILABLE_CRITERIA.map((c) => ({ key: c.key, icon: c.icon, label: i18n.views.short[c.key] })),
                icon: providerIcon,
                t: i18n,
                onSetIndex: setIndexOverride
              }
            ) : /* @__PURE__ */ jsx4("div", { style: { display: "flex", gap: 16, flexWrap: "wrap" }, children: scoredModels.slice(0, 5).map((m) => /* @__PURE__ */ jsxs4(
              "div",
              {
                title: buildModelTooltip(m),
                style: {
                  flex: 1,
                  minWidth: 160,
                  padding: 10,
                  background: m._rank === 1 ? "color-mix(in srgb, var(--ui-orange) 10%, var(--ui-bg-editor))" : m._rank === 2 ? "var(--ui-row-hover-background)" : "var(--ui-bg-editor)",
                  borderRadius: 6,
                  border: m._rank <= 3 ? "2px solid var(--ui-orange)" : "1px solid var(--ui-stroke-tertiary)",
                  cursor: "help",
                  transition: "transform 0.1s ease",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
                },
                children: [
                  /* @__PURE__ */ jsxs4("div", { style: { fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
                    /* @__PURE__ */ jsxs4("span", { children: [
                      m._rank === 1 ? "🥇" : m._rank === 2 ? "🥈" : m._rank === 3 ? "🥉" : `#${m._rank}`,
                      " ",
                      providerIcon(m.id),
                      " ",
                      m.label
                    ] }),
                    /* @__PURE__ */ jsx4("span", { style: { fontSize: 10, background: "var(--ui-bg-tertiary)", padding: "1px 4px", borderRadius: 3, color: "var(--ui-text-secondary)" }, children: fmtCtx(m.context_length) })
                  ] }),
                  /* @__PURE__ */ jsxs4("div", { style: { fontSize: 18, fontWeight: 800, color: "var(--ui-orange)", marginTop: 2 }, children: [
                    m._score.toFixed(0),
                    "/100"
                  ] }),
                  /* @__PURE__ */ jsxs4("div", { style: { fontSize: 11, color: "var(--ui-text-tertiary)", marginTop: 2, display: "flex", justifyContent: "space-between" }, children: [
                    /* @__PURE__ */ jsxs4("span", { children: [
                      "in:",
                      fmtPrice(m.prompt_price)
                    ] }),
                    /* @__PURE__ */ jsxs4("span", { children: [
                      "out:",
                      fmtPrice(m.completion_price)
                    ] })
                  ] })
                ]
              },
              m.id
            )) })
          ] }),
          /* @__PURE__ */ jsx4("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 10, background: "transparent" }, children: /* @__PURE__ */ jsxs4("div", { style: S.gap, children: [
            /* @__PURE__ */ jsx4(
              "input",
              {
                placeholder: i18n.searchPlaceholder,
                value: q,
                onChange: (e) => setQ(e.target.value),
                onKeyDown: (e) => e.key === "Enter" && search(),
                style: { width: 220, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--ui-stroke-secondary)", fontSize: 13 }
              }
            ),
            /* @__PURE__ */ jsx4(
              "button",
              {
                onClick: search,
                disabled: adding,
                style: { padding: "6px 12px", borderRadius: 6, border: "1px solid var(--ui-stroke-secondary)", background: "var(--ui-bg-editor)", cursor: "pointer", fontWeight: 600 },
                children: i18n.search
              }
            ),
            /* @__PURE__ */ jsxs4("label", { style: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ui-text-secondary)", cursor: "pointer" }, children: [
              /* @__PURE__ */ jsx4(
                "input",
                {
                  type: "checkbox",
                  checked: searchUntracked,
                  onChange: (e) => {
                    setSearchUntracked(e.target.checked);
                    if (!e.target.checked) setSearchRes([]);
                  }
                }
              ),
              i18n.searchUntracked
            ] }),
            /* @__PURE__ */ jsx4("span", { style: { color: "var(--ui-text-tertiary)", fontSize: 13 }, children: i18n.nVisible(visible.length, hidden.length > 0 ? i18n.nHidden(hidden.length) : "") }),
            /* @__PURE__ */ jsx4(
              "button",
              {
                onClick: refresh,
                title: i18n.refresh,
                style: { marginLeft: "auto", padding: "4px 8px", border: "none", background: "transparent", color: "var(--ui-text-secondary)", cursor: "pointer", fontSize: 16, lineHeight: 1 },
                children: "↻"
              }
            ),
            lastRefresh ? /* @__PURE__ */ jsx4("span", { style: { fontSize: 11, color: "var(--ui-text-quaternary)" }, children: i18n.updatedAgo(Math.max(0, Math.round((Date.now() / 1e3 - lastRefresh) / 60))) }) : null
          ] }) }),
          searchUntracked && searchRes.length > 0 && /* @__PURE__ */ jsxs4("div", { style: { background: "var(--ui-row-hover-background)", borderRadius: 8, padding: 12, marginBottom: 12, border: "1px solid var(--ui-stroke-tertiary)" }, children: [
            /* @__PURE__ */ jsx4("div", { style: { marginBottom: 6, fontSize: 12, fontWeight: 700, color: "var(--ui-text-secondary)" }, children: i18n.results(searchRes.filter((sr) => !models.some((m) => m.id === sr.id)).length) }),
            searchRes.filter((sr) => !models.some((m) => m.id === sr.id)).map((s, i) => /* @__PURE__ */ jsxs4("div", { style: { ...S.searchRow, background: i % 2 === 0 ? "var(--ui-bg-editor)" : "var(--ui-row-hover-background)", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
              /* @__PURE__ */ jsxs4("div", { children: [
                /* @__PURE__ */ jsx4("b", { children: s.name || s.id }),
                /* @__PURE__ */ jsxs4("span", { style: { color: "var(--ui-text-tertiary)", marginLeft: 8 }, children: [
                  fmtPrice(s.prompt_price),
                  " in / ",
                  fmtPrice(s.completion_price),
                  " out · ctx: ",
                  (s.context_length || 0).toLocaleString()
                ] }),
                s.has_vision && /* @__PURE__ */ jsx4("span", { style: { marginLeft: 6, background: "color-mix(in srgb, var(--ui-blue) 8%, transparent)", color: "var(--ui-blue)", padding: "1px 5px", borderRadius: 3, fontSize: 10 }, children: "👁" }),
                s.open_weights && /* @__PURE__ */ jsx4("span", { style: { marginLeft: 4, background: "color-mix(in srgb, var(--ui-green) 12%, transparent)", color: "var(--ui-green)", padding: "1px 5px", borderRadius: 3, fontSize: 10 }, children: "open" }),
                s.model_size && /* @__PURE__ */ jsx4("span", { style: { marginLeft: 4, color: "var(--ui-text-tertiary)", fontSize: 11 }, children: s.model_size })
              ] }),
              /* @__PURE__ */ jsx4("button", { onClick: () => addModel(s.id), disabled: adding, style: { minWidth: 100, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--ui-stroke-secondary)", cursor: "pointer" }, children: i18n.add })
            ] }, s.id))
          ] }),
          /* @__PURE__ */ jsx4("h3", { style: { margin: "0 0 8px 0", color: "var(--ui-text-primary)", fontSize: 15, fontWeight: 650 }, children: i18n.tableTitle }),
          /* @__PURE__ */ jsx4("div", { style: { overflowX: "auto", marginBottom: 24, border: "1px solid var(--ui-stroke-tertiary)", borderRadius: 8 }, children: /* @__PURE__ */ jsxs4("table", { style: S.table, children: [
            /* @__PURE__ */ jsx4("thead", { children: /* @__PURE__ */ jsxs4("tr", { children: [
              /* @__PURE__ */ jsx4("th", { style: S.th }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, cursor: "pointer", userSelect: "none" }, onClick: () => toggleSort("label"), children: [
                i18n.table.model,
                sortArrow("label")
              ] }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "center", cursor: "pointer" }, onClick: () => toggleSort("context_length"), children: [
                i18n.table.context,
                sortArrow("context_length")
              ] }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "right", cursor: "pointer" }, onClick: () => toggleSort("prompt_price"), children: [
                "$ in",
                sortArrow("prompt_price")
              ] }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "right", cursor: "pointer" }, onClick: () => toggleSort("completion_price"), children: [
                "$ out",
                sortArrow("completion_price")
              ] }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "right", cursor: "pointer" }, onClick: () => toggleSort("cache_read_price"), children: [
                "$ cache",
                sortArrow("cache_read_price")
              ] }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "center", cursor: "pointer" }, onClick: () => toggleSort("intelligence_index"), children: [
                "Intel.",
                sortArrow("intelligence_index")
              ] }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "center", cursor: "pointer" }, onClick: () => toggleSort("coding_index"), children: [
                "Coding",
                sortArrow("coding_index")
              ] }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "center", cursor: "pointer" }, onClick: () => toggleSort("agentic_index"), children: [
                "Agentic",
                sortArrow("agentic_index")
              ] }),
              /* @__PURE__ */ jsx4("th", { style: { ...S.th, textAlign: "center" }, children: "SWE" }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "center", cursor: "pointer" }, onClick: () => toggleSort("has_vision"), children: [
                "Vision",
                sortArrow("has_vision")
              ] }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "center", cursor: "pointer" }, onClick: () => toggleSort("open_weights"), children: [
                "Open",
                sortArrow("open_weights")
              ] }),
              /* @__PURE__ */ jsx4("th", { style: { ...S.th, textAlign: "center" }, children: "Taille" }),
              /* @__PURE__ */ jsx4("th", { style: { ...S.th, textAlign: "center" }, children: "GPU Q4" }),
              /* @__PURE__ */ jsxs4("th", { style: { ...S.th, textAlign: "center", cursor: "pointer" }, onClick: () => toggleSort("tools"), children: [
                "Tools",
                sortArrow("tools")
              ] }),
              /* @__PURE__ */ jsx4("th", { style: { ...S.th, textAlign: "center" }, title: `Score ${currentProfile.name}`, children: "⭐" }),
              /* @__PURE__ */ jsx4("th", { style: S.th })
            ] }) }),
            /* @__PURE__ */ jsx4("tbody", { children: sortedModels.filter((m) => {
              const qL = q.trim().toLowerCase();
              return !qL || (m.label + " " + m.id).toLowerCase().includes(qL);
            }).map((m, i) => {
              const sc = scoreMap[m.id];
              const rank = scoredModels.findIndex((sm) => sm.id === m.id);
              const rankStr = rank >= 0 ? `#${rank + 1}` : "-";
              const top3 = rank >= 0 && rank < 3;
              return /* @__PURE__ */ jsxs4("tr", { style: { ...i % 2 === 0 ? S.trEven : S.trOdd, opacity: hiddenIds.has(m.id) ? 0.35 : m.available ? 1 : 0.4 }, children: [
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center", fontSize: 16 }, title: providerName(m.id), children: providerIcon(m.id) }),
                /* @__PURE__ */ jsxs4("td", { style: S.td, children: [
                  /* @__PURE__ */ jsx4("b", { children: m.label }),
                  /* @__PURE__ */ jsx4("div", { style: { fontSize: 10, color: "var(--ui-text-tertiary)" }, children: m.id })
                ] }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "right" }, title: `${(m.context_length || 0).toLocaleString()} tokens`, children: fmtCtx(m.context_length) }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "right" }, children: fmtPrice(m.prompt_price) }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "right" }, children: fmtPrice(m.completion_price) }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "right", color: m.cache_read_price ? "var(--ui-blue)" : "var(--ui-text-quaternary)" }, children: m.cache_read_price != null ? fmtPrice(m.cache_read_price) : "–" }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center" }, children: /* @__PURE__ */ jsx4(SourcedIdx, { m, field: "intelligence_index", t: i18n }) }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center" }, children: /* @__PURE__ */ jsx4(SourcedIdx, { m, field: "coding_index", t: i18n }) }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center" }, children: /* @__PURE__ */ jsx4(SourcedIdx, { m, field: "agentic_index", t: i18n }) }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center" }, children: m.benchmarks?.swebench_verified != null ? m.benchmarks.swebench_verified + "%" : "…" }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center" }, children: m.has_vision ? "👁" : "" }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center" }, children: m.open_weights ? "✅" : "❌" }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center", fontSize: 11 }, children: m.model_size || "?" }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center", fontSize: 11 }, children: m.gpu ? /* @__PURE__ */ jsxs4("span", { title: `Q8: ${m.gpu.vram_q8_gb}GB, FP16: ${m.gpu.vram_fp16_gb}GB`, children: [
                  m.gpu.vram_q4_gb,
                  "GB",
                  m.gpu.fits_64gb ? " ✓" : ""
                ] }) : "-" }),
                /* @__PURE__ */ jsx4("td", { style: { ...S.td, textAlign: "center" }, children: (m.supported_parameters || []).includes("tools") ? "✅" : "❌" }),
                /* @__PURE__ */ jsxs4("td", { style: { ...S.td, textAlign: "center", fontWeight: 700, background: top3 ? "color-mix(in srgb, var(--ui-orange) 10%, transparent)" : void 0 }, children: [
                  /* @__PURE__ */ jsxs4("span", { title: `Score ${currentProfile.name}: ${sc}`, style: { color: top3 ? "var(--ui-orange)" : sc > 50 ? "var(--ui-green)" : "var(--ui-text-tertiary)" }, children: [
                    rankStr,
                    top3 && /* @__PURE__ */ jsx4("span", { style: { fontSize: 10, marginLeft: 2 }, children: "🥇" })
                  ] }),
                  /* @__PURE__ */ jsx4("div", { style: { fontSize: 10, color: "var(--ui-text-quaternary)" }, children: sc != null ? `${Math.round(sc)}` : "" })
                ] }),
                /* @__PURE__ */ jsxs4("td", { style: { ...S.td, whiteSpace: "nowrap", textAlign: "right" }, children: [
                  /* @__PURE__ */ jsx4(
                    "button",
                    {
                      onClick: () => toggleHidden(m.id),
                      title: hiddenIds.has(m.id) ? i18n.show : i18n.hide,
                      style: { background: "none", border: "none", cursor: "pointer", opacity: 0.6, fontSize: 13, marginRight: 4 },
                      children: hiddenIds.has(m.id) ? "👁" : "🙈"
                    }
                  ),
                  /* @__PURE__ */ jsx4(
                    "button",
                    {
                      onClick: () => removeModel(m.id),
                      title: i18n.removeModel,
                      style: { background: "none", border: "none", cursor: "pointer", opacity: 0.4, fontSize: 12 },
                      children: "✕"
                    }
                  )
                ] })
              ] }, m.id);
            }) })
          ] }) }),
          active.length >= 2 && /* @__PURE__ */ jsxs4(Fragment3, { children: [
            /* @__PURE__ */ jsx4("h2", { style: { marginTop: 32, color: "var(--ui-text-primary)" }, children: "Prix ($ / million tokens)" }),
            /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ jsxs4("div", { style: { flex: 1, minWidth: 360 }, children: [
                /* @__PURE__ */ jsx4("h3", { style: { fontSize: 14, color: "var(--ui-text-tertiary)" }, children: "Input (moins cher d'abord)" }),
                /* @__PURE__ */ jsx4(BarsVertical, { data: byPriceIn, valueKey: "prompt_price", color: "var(--ui-purple)", format: fmtPrice, formatTick: (v) => "$" + v.toFixed(2) })
              ] }),
              /* @__PURE__ */ jsxs4("div", { style: { flex: 1, minWidth: 360 }, children: [
                /* @__PURE__ */ jsx4("h3", { style: { fontSize: 14, color: "var(--ui-text-tertiary)" }, children: "Output (moins cher d'abord)" }),
                /* @__PURE__ */ jsx4(BarsVertical, { data: byPriceOut, valueKey: "completion_price", color: "#82ca9d", format: fmtPrice, formatTick: (v) => "$" + v.toFixed(2) })
              ] })
            ] }),
            /* @__PURE__ */ jsx4("h2", { style: { marginTop: 32, color: "var(--ui-text-primary)" }, children: "Benchmarks Intelligence (Artificial Analysis)" }),
            /* @__PURE__ */ jsx4("div", { style: { display: "flex", gap: 24, flexWrap: "wrap" }, children: [
              { k: "intelligence_index", label: "Intelligence", color: "var(--ui-purple)" },
              { k: "coding_index", label: "Coding", color: "#82ca9d" },
              { k: "agentic_index", label: "Agentic", color: "var(--ui-orange)" }
            ].map((bm) => {
              const sorted = [...active].filter((m) => m[bm.k] != null).sort((a, b) => (b[bm.k] ?? 0) - (a[bm.k] ?? 0));
              return /* @__PURE__ */ jsxs4("div", { style: { flex: 1, minWidth: 260 }, children: [
                /* @__PURE__ */ jsx4("h3", { style: { fontSize: 14, color: "var(--ui-text-tertiary)" }, children: bm.label }),
                /* @__PURE__ */ jsx4(BarsVertical, { data: sorted, valueKey: bm.k, color: bm.color })
              ] }, bm.k);
            }) }),
            /* @__PURE__ */ jsx4("h2", { style: { marginTop: 32, color: "var(--ui-text-primary)" }, children: "Contexte (tokens)" }),
            /* @__PURE__ */ jsx4(
              BarsHorizontal,
              {
                data: byCtx,
                valueKey: "context_length",
                color: "#ffc658",
                height: 300,
                format: (v) => v >= 1e3 ? (v / 1e3).toFixed(0) + "k" : String(v)
              }
            ),
            /* @__PURE__ */ jsxs4("h2", { style: { marginTop: 32, color: "var(--ui-text-primary)" }, children: [
              "Radar comparatif (",
              currentProfile.name,
              ") (0–100)"
            ] }),
            /* @__PURE__ */ jsx4(
              RadarChart,
              {
                axes: radarData.map((d) => String(d.label)),
                series: activeLabels.map((label) => ({
                  label,
                  color: colors[(colorByLabel[label] ?? 0) % colors.length],
                  values: radarData.map((d) => Number(d[label]) || 0)
                }))
              }
            ),
            /* @__PURE__ */ jsx4("div", { style: { display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 12 }, children: allLabels.map((label) => {
              const ci2 = colorByLabel[label] ?? 0;
              const hiddenR = radarHidden.has(label);
              return /* @__PURE__ */ jsxs4(
                "span",
                {
                  onClick: () => toggleRadar(label),
                  title: hiddenR ? i18n.clickToShow : i18n.clickToHide,
                  style: { display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, userSelect: "none", opacity: hiddenR ? 0.35 : 1, textDecoration: hiddenR ? "line-through" : "none", padding: "2px 5px", borderRadius: 4, background: hiddenR ? "transparent" : `color-mix(in srgb, ${colors[ci2 % colors.length]} 10%, transparent)` },
                  children: [
                    /* @__PURE__ */ jsx4("span", { style: { display: "inline-block", width: 9, height: 9, background: colors[ci2 % colors.length], borderRadius: 2 } }),
                    label
                  ]
                },
                label
              );
            }) })
          ] })
        ] })
      ] }),
      showNews && /* @__PURE__ */ jsx4(
        NewsPanel,
        {
          news,
          loading: loadingNews,
          onClose: toggleNews,
          processedPromotions,
          processedNewModels,
          newsVisibleLimit,
          setNewsVisibleLimit,
          newsSortBy,
          setNewsSortBy,
          newsTimeWindow,
          setNewsTimeWindow,
          addModel,
          trackedIds: new Set(models.filter((m) => m.available).map((m) => m.id)),
          profileName: currentProfile.name,
          t: i18n,
          fmtDate,
          fmtCtx,
          fmtPrice
        }
      )
    ] }),
    modalOpen && editingProfile && /* @__PURE__ */ jsx4("div", { style: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(15, 23, 42, 0.65)",
      backdropFilter: "blur(4px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1e3,
      padding: 16
    }, children: /* @__PURE__ */ jsxs4("div", { style: {
      background: "var(--ui-bg-editor)",
      borderRadius: 12,
      width: "100%",
      maxWidth: 620,
      maxHeight: "90vh",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      border: "1px solid var(--ui-stroke-tertiary)",
      overflow: "hidden"
    }, children: [
      /* @__PURE__ */ jsxs4("div", { style: {
        padding: "16px 20px",
        borderBottom: "1px solid var(--ui-stroke-tertiary)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "var(--ui-row-hover-background)"
      }, children: [
        /* @__PURE__ */ jsxs4("div", { style: { display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }, children: [
          /* @__PURE__ */ jsx4("h3", { style: { margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ui-text-primary)" }, children: i18n.modal.configTitle(editingProfile.name) }),
          /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: 10, alignItems: "center" }, children: [
            /* @__PURE__ */ jsx4(
              "button",
              {
                onClick: autoFillCriteria,
                disabled: autoFilling,
                title: i18n.modal.autoFillHint,
                style: { padding: "4px 10px", borderRadius: 6, border: "1px solid var(--ui-accent-secondary)", background: "transparent", color: "var(--ui-accent)", cursor: autoFilling ? "wait" : "pointer", fontSize: 12, fontWeight: 600 },
                children: i18n.modal.autoFill
              }
            ),
            autoFillMsg ? /* @__PURE__ */ jsx4("span", { style: { fontSize: 12, color: "var(--ui-text-tertiary)" }, children: autoFillMsg }) : null
          ] })
        ] }),
        /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: () => setModalOpen(false),
            style: { background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--ui-text-quaternary)" },
            children: "✕"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs4("div", { style: { padding: "16px 20px", overflowY: "auto", flex: 1 }, children: [
        /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: 12, marginBottom: 16 }, children: [
          /* @__PURE__ */ jsxs4("div", { style: { flex: 1 }, children: [
            /* @__PURE__ */ jsx4("label", { style: { display: "block", fontSize: 12, fontWeight: 700, color: "var(--ui-text-secondary)", marginBottom: 4 }, children: "Identifiant technique :" }),
            /* @__PURE__ */ jsx4(
              "input",
              {
                type: "text",
                value: editingProfile.id,
                disabled: !isNewProfile,
                placeholder: "ex: devops, data-engineer",
                onChange: (e) => setEditingProfile({ ...editingProfile, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }),
                style: {
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--ui-stroke-secondary)",
                  background: isNewProfile ? "var(--ui-bg-editor)" : "var(--ui-bg-tertiary)",
                  fontSize: 13,
                  boxSizing: "border-box"
                }
              }
            )
          ] }),
          /* @__PURE__ */ jsxs4("div", { style: { flex: 1.5 }, children: [
            /* @__PURE__ */ jsx4("label", { style: { display: "block", fontSize: 12, fontWeight: 700, color: "var(--ui-text-secondary)", marginBottom: 4 }, children: i18n.modal.displayName }),
            /* @__PURE__ */ jsx4(
              "input",
              {
                type: "text",
                value: editingProfile.name,
                placeholder: i18n.modal.displayNamePlaceholder,
                onChange: (e) => setEditingProfile({ ...editingProfile, name: e.target.value }),
                style: {
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--ui-stroke-secondary)",
                  fontSize: 13,
                  boxSizing: "border-box"
                }
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs4("div", { style: { borderTop: "1px solid var(--ui-stroke-tertiary)", paddingTop: 12 }, children: [
          /* @__PURE__ */ jsxs4("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, children: [
            /* @__PURE__ */ jsx4("span", { style: { fontSize: 13, fontWeight: 700, color: "var(--ui-text-primary)" }, children: i18n.criteriaWeights }),
            /* @__PURE__ */ jsxs4("span", { style: { fontSize: 11, color: "var(--ui-text-tertiary)" }, children: [
              i18n.totalWeights,
              " ",
              /* @__PURE__ */ jsx4("b", { children: Object.values(editingProfile.weights).reduce((a, b) => a + (b || 0), 0) })
            ] })
          ] }),
          /* @__PURE__ */ jsx4("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: AVAILABLE_CRITERIA.map((crit) => {
            const currentWeight = editingProfile.weights[crit.key] ?? 0;
            return /* @__PURE__ */ jsxs4(
              "div",
              {
                style: {
                  background: currentWeight > 0 ? "var(--ui-row-hover-background)" : "var(--ui-bg-editor)",
                  border: `1px solid ${currentWeight > 0 ? "var(--ui-stroke-secondary)" : "var(--ui-bg-tertiary)"}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "all 0.15s ease"
                },
                children: [
                  /* @__PURE__ */ jsx4("div", { style: { width: 28, fontSize: 18, textAlign: "center" }, children: crit.icon }),
                  /* @__PURE__ */ jsxs4("div", { style: { flex: 1, minWidth: 0 }, children: [
                    /* @__PURE__ */ jsxs4("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                      /* @__PURE__ */ jsx4("span", { style: { fontWeight: currentWeight > 0 ? 700 : 500, fontSize: 13, color: currentWeight > 0 ? "var(--ui-text-primary)" : "var(--ui-text-tertiary)" }, children: i18n.criteria[crit.key] }),
                      /* @__PURE__ */ jsxs4("span", { style: {
                        fontWeight: 800,
                        fontSize: 12,
                        background: currentWeight === 0 ? "var(--ui-bg-tertiary)" : currentWeight >= 4 ? "var(--ui-accent-secondary)" : "var(--ui-stroke-tertiary)",
                        color: currentWeight >= 4 ? "var(--ui-bg-editor)" : currentWeight === 0 ? "var(--ui-text-quaternary)" : "var(--ui-text-secondary)",
                        padding: "2px 8px",
                        borderRadius: 12
                      }, children: [
                        currentWeight,
                        " / 5"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx4("div", { style: { fontSize: 11, color: "var(--ui-text-tertiary)", marginTop: 2, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }, children: i18n.criteria["d_" + crit.key] }),
                    /* @__PURE__ */ jsx4(
                      "input",
                      {
                        type: "range",
                        min: 0,
                        max: 5,
                        step: 1,
                        value: currentWeight,
                        onChange: (e) => {
                          const val = parseInt(e.target.value, 10);
                          setEditingProfile({
                            ...editingProfile,
                            weights: {
                              ...editingProfile.weights,
                              [crit.key]: val
                            }
                          });
                        },
                        style: {
                          width: "100%",
                          marginTop: 6,
                          cursor: "pointer",
                          accentColor: "var(--ui-accent-secondary)"
                        }
                      }
                    )
                  ] })
                ]
              },
              crit.key
            );
          }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs4("div", { style: {
        padding: "14px 20px",
        borderTop: "1px solid var(--ui-stroke-tertiary)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "var(--ui-row-hover-background)"
      }, children: [
        /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: 8 }, children: [
          !isNewProfile && /* @__PURE__ */ jsx4(
            "button",
            {
              onClick: deleteCurrentProfile,
              disabled: savingProfile,
              style: {
                background: "none",
                border: "1px solid color-mix(in srgb, var(--ui-red) 12%, transparent)",
                color: "var(--ui-red)",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              },
              children: i18n.modal.delete
            }
          ),
          /* @__PURE__ */ jsx4(
            "button",
            {
              onClick: resetToDefaultProfiles,
              title: i18n.resetAllTitle,
              style: {
                background: "none",
                border: "1px solid var(--ui-stroke-secondary)",
                color: "var(--ui-text-tertiary)",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer"
              },
              children: i18n.resetDefaults
            }
          )
        ] }),
        /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: 10 }, children: [
          /* @__PURE__ */ jsx4(
            "button",
            {
              onClick: () => setModalOpen(false),
              disabled: savingProfile,
              style: {
                background: "var(--ui-bg-editor)",
                border: "1px solid var(--ui-stroke-secondary)",
                borderRadius: 6,
                padding: "7px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                color: "var(--ui-text-secondary)"
              },
              children: i18n.modal.cancel
            }
          ),
          /* @__PURE__ */ jsx4(
            "button",
            {
              onClick: saveProfileConfig,
              disabled: savingProfile,
              style: {
                background: "var(--ui-accent-secondary)",
                border: "none",
                borderRadius: 6,
                padding: "7px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                color: "var(--ui-bg-editor)",
                boxShadow: "0 1px 3px rgba(118, 36, 244, 0.4)"
              },
              children: savingProfile ? i18n.modal.saving : i18n.modal.save
            }
          )
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx4(
      ConfirmDialog,
      {
        open: pendingDelete !== null,
        onClose: () => setPendingDelete(null),
        onConfirm: confirmRemove,
        title: i18n.confirmDeleteTitle,
        description: i18n.confirmDeleteBody(pendingDelete || ""),
        confirmLabel: i18n.confirmDeleteOk,
        cancelLabel: i18n.cancel,
        destructive: true
      }
    )
  ] });
}

// src/main.tsx
import { jsx as jsx5 } from "react/jsx-runtime";
var plugin = {
  id: "model-leaderboard",
  name: "LLM Model Leaderboard",
  defaultEnabled: true,
  register(ctx) {
    setRest((path, opts) => ctx.rest(path, opts));
    if (ctx.i18n && typeof ctx.i18n.register === "function") {
      ctx.i18n.register(LOCALES);
    }
    ctx.registerMany([
      {
        id: "page",
        area: ROUTES_AREA,
        data: { path: "/model-leaderboard" },
        render: () => /* @__PURE__ */ jsx5(App, {})
      },
      {
        id: "nav",
        area: SIDEBAR_NAV_AREA,
        order: 75,
        data: { path: "/model-leaderboard", label: "Model Leaderboard", codicon: "graph" }
      },
      {
        id: "open",
        area: PALETTE_AREA,
        data: {
          id: "model-leaderboard.open",
          label: "LLM Model Leaderboard : open the leaderboard",
          keywords: ["llm", "leaderboard", "model", "benchmark", "pricing"],
          run: () => host.navigate("/model-leaderboard")
        }
      }
    ]);
  }
};
var main_default = plugin;
export {
  main_default as default
};
