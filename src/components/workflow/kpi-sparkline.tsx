"use client";

import * as React from "react";

/**
 * CryoFlow — KPI sparkline (Dashboard KPI band + project cards).
 *
 * A hand-rolled SVG polyline: recharts would drag in a full surface +
 * tooltip machinery for what is a 84×26 decorative trend hint, and the
 * KPI cards need the spark to inherit the card's tone class (currentColor)
 * so it recolors with the light/dark theme for free.
 *
 * Design notes:
 *  • values are cumulative counts (monotonic) — the y-scale spans
 *    [min − pad, max + pad] so a flat series still renders a line
 *    (not a squashed zero-width path);
 *  • the area fill is a 12% currentColor wash — enough to read as
 *    "volume under trend" without fighting the card's number;
 *  • the last point gets a dot: the eye lands on "where we are now";
 *  • decorative by default (aria-hidden) — the card's numeric value + label
 *    carry the semantics, so screen readers skip the picture;
 *  • honest degradation: fewer than 2 points renders nothing (a trend
 *    with one sample is not a trend).
 *
 * Hover (v2): when `days` labels are provided the spark becomes pointer-
 * interactive — a crosshair + magnified dot follows the pointer and a small
 * inverted chip shows "Sep 3 · 24 (+3)" (date · cumulative · delta vs the
 * previous day). Still decorative for assistive tech; the hover layer is
 * pure affordance for pointer users.
 *
 * Touch (v3): a tap fires pointerdown but NO pointermove, so the hover
 * layer above never engaged on touch screens. pointerdown now also samples
 * the tapped x (same pointFromEvent); touch/pen taps auto-dismiss after
 * ~2.6 s because pointerleave never fires for a lifted finger — mouse
 * hover keeps the live-follow + leave semantics unchanged.
 */

export function KpiSparkline({
  values,
  days,
  unit = "",
  width = 84,
  height = 24,
  strokeWidth = 1.5,
  className = "",
}: {
  values: number[];
  /** date labels aligned with `values` ("2026-09-01") — enables the hover layer */
  days?: string[];
  /** noun for the tooltip value ("job", "project") — plain number when omitted */
  unit?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** extra classes for the line (color tone) — area always follows currentColor */
  className?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  // touch/pen taps must self-dismiss (pointerleave never fires for a
  // lifted finger); mouse hover dismisses via onPointerLeave instead
  const dismissTimer = React.useRef<number | null>(null);
  const armDismiss = () => {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    dismissTimer.current = window.setTimeout(() => setHover(null), 2600);
  };
  React.useEffect(
    () => () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    },
    [],
  );

  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  // flat series (e.g. all zeros): pad enough to draw a mid-height baseline
  const pad = span > 0 ? span * 0.08 : Math.max(1, max * 0.1) || 1;
  const lo = min - pad;
  const hi = max + pad;
  const range = hi - lo || 1;

  const step = width / (values.length - 1);
  const y = (v: number) => height - 2 - ((v - lo) / range) * (height - 4);

  let line = "";
  values.forEach((v, i) => {
    line += `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`;
  });
  const area = `${line}L${width},${height}L0,${height}Z`;

  const lastX = width;
  const lastY = y(values[values.length - 1]);

  const interactive = Array.isArray(days) && days.length === values.length;
  const idx = interactive ? hover : null;
  const hoverX = idx != null ? idx * step : 0;

  const fmtDay = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  };
  const fmtVal = (v: number) => `${v.toLocaleString()}${unit ? ` ${unit}` : ""}`;

  const pointFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const ratio = (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(values.length - 1, Math.round(ratio * (values.length - 1))));
  };

  return (
    <span className={`relative inline-block${interactive ? " pointer-events-auto" : ""}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        aria-hidden="true"
        className={`shrink-0 overflow-visible${interactive ? " cursor-crosshair" : ""}`}
        onPointerMove={
          interactive
            ? (e) => {
                const i = pointFromEvent(e);
                if (i != null) setHover(i);
              }
            : undefined
        }
        onPointerDown={
          interactive
            ? (e) => {
                const i = pointFromEvent(e);
                if (i != null) setHover(i);
                if (e.pointerType !== "mouse") armDismiss();
              }
            : undefined
        }
        onPointerLeave={interactive ? () => setHover(null) : undefined}
      >
        {/* area fill follows the line's color at 12% — using fill via CSS
            var keeps the wash light in both themes */}
        <path d={area} className={className} style={{ fill: "currentColor", opacity: 0.12, strokeWidth: 0 }} />
        <path
          d={line}
          fill="none"
          className={className}
          style={{ stroke: "currentColor", strokeWidth, strokeLinejoin: "round", strokeLinecap: "round" }}
        />
        <circle
          cx={lastX}
          cy={lastY}
          r={2.2}
          className={className}
          style={{ fill: "currentColor", stroke: "none" }}
        />
        {/* hover layer: crosshair + magnified point (pointer users only) */}
        {idx != null && (
          <g style={{ pointerEvents: "none" }}>
            <line
              x1={hoverX}
              y1={0}
              x2={hoverX}
              y2={height}
              style={{ stroke: "currentColor", strokeWidth: 1, opacity: 0.4, strokeDasharray: "2 2" }}
            />
            <circle
              cx={hoverX}
              cy={y(values[idx])}
              r={3.4}
              style={{ fill: "currentColor" }}
              className={className}
            />
            <circle
              cx={hoverX}
              cy={y(values[idx])}
              r={3.4}
              fill="none"
              style={{ stroke: "var(--card)", strokeWidth: 1.5 }}
            />
          </g>
        )}
      </svg>
      {/* hover chip — FIXED at the spark's top-right (right-aligned to the
          container) instead of tracking the pointer X: an 84px spark is far
          narrower than the chip (~110px), so a tracking chip would spill
          past the card's overflow-hidden edge at the rightmost points. The
          crosshair + magnified dot inside the svg carry the positional
          read; the chip only renders the hovered day's value. */}
      {idx != null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full right-0 z-30 mb-1 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-tight text-background shadow-md"
        >
          <span className="opacity-70">{fmtDay(days![idx])}</span>
          {" · "}
          {fmtVal(values[idx])}
          {idx > 0 && values[idx] !== values[idx - 1] && (
            <span className="opacity-70">
              {" "}
              ({values[idx] > values[idx - 1] ? "+" : ""}
              {values[idx] - values[idx - 1]})
            </span>
          )}
        </span>
      )}
    </span>
  );
}
