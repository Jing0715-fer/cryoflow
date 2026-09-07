"use client";

/**
 * CryoFlow — KPI sparkline (Dashboard KPI band).
 *
 * A hand-rolled SVG polyline: recharts would drag in a full surface +
 * tooltip machinery for what is a 76×26 decorative trend hint, and the
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
 *  • decorative only (aria-hidden) — the card's numeric value + label
 *    carry the semantics, so screen readers skip the picture;
 *  • honest degradation: fewer than 2 points renders nothing (a trend
 *    with one sample is not a trend).
 */

export function KpiSparkline({
  values,
  width = 84,
  height = 24,
  strokeWidth = 1.5,
  className = "",
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  /** extra classes for the line (color tone) — area always follows currentColor */
  className?: string;
}) {
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

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className="shrink-0 overflow-visible"
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
    </svg>
  );
}
