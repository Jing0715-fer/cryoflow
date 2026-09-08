/**
 * CryoFlow — chart snapshots for the Markdown run report (phase 2).
 *
 * Task 50's FSC snapshot proved the pattern: a self-contained SVG with
 * explicit colors rasterizes identically everywhere it is pasted, while
 * scraping the recharts DOM ships class-dependent styles that die the
 * moment the SVG leaves the page. This lib generalizes the scaffold for
 * the report's remaining line charts:
 *
 *   - resolution per iteration (refining jobs — the convergence story)
 *   - Guinier plot (postprocess — the B-factor evidence)
 *
 * Both share one compact `simpleLineChart` engine (linear axes, auto
 * domains, integer/decimal tick ladders, per-series styling, dot+label
 * annotations). The FSC curve keeps its own specialized builder — its
 * reversed log x-axis and criterion reference lines are nothing like
 * these. Rasterization reuses svgToPngDataUrl from fsc-snapshot.
 *
 * Fail-soft contract, same as FSC: builders return null when the data
 * cannot be plotted; the report earns its image or ships an honest gap.
 */

import { svgToPngDataUrl } from "./fsc-snapshot";

export { svgToPngDataUrl };

export const SNAPSHOT_SIZE = { width: 640, height: 280 };

const C = {
  teal: "#14b8a6",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  zinc: "#71717a",
  text: "#18181b",
  muted: "#71717a",
  faint: "#a1a1aa",
  grid: "#e4e4e7",
  gridSoft: "#f4f4f5",
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fx = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "0");

/** linear nice ticks — steps from the 1/2/2.5/5 ladder */
function niceTicks(min: number, max: number, target = 5): number[] {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [min];
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 2.25 ? 2 : norm < 3.75 ? 2.5 : norm < 7.5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step)
    ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/** integer x ticks for iteration axes — 1..N with at most ~7 steps */
function iterationTicks(maxIter: number): number[] {
  const n = Math.max(1, Math.ceil(maxIter));
  if (n <= 8) return Array.from({ length: n }, (_, i) => i + 1);
  const step = n <= 16 ? 2 : n <= 40 ? 5 : 10;
  const ticks: number[] = [];
  for (let v = step; v <= n; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== n) ticks.push(n);
  return ticks;
}

export interface SnapshotSeries {
  label: string;
  color: string;
  dash?: string;
  /** [x, y] pairs, finite only */
  points: [number, number][];
  /** draw a filled dot on the last vertex */
  dotLast?: boolean;
}

export interface SnapshotAnnotation {
  x: number;
  y: number;
  label: string;
  color: string;
}

interface SimpleChartInput {
  title: string;
  xLabel: string;
  yLabel: string;
  series: SnapshotSeries[];
  xTicks?: number[];
  yTicks?: number[];
  xTickFmt?: (v: number) => string;
  yTickFmt?: (v: number) => string;
  annotations?: SnapshotAnnotation[];
  /** one-line note drawn under the title (B-factor, source, …) */
  note?: string;
}

/** shared scaffold for the report's linear-axis line charts */
function simpleLineChart(input: SimpleChartInput): {
  svg: string;
  width: number;
  height: number;
} | null {
  const { width: W, height: H } = SNAPSHOT_SIZE;
  const M = { t: input.note ? 44 : 30, r: 16, b: 36, l: 52 };
  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;

  const verts = input.series.flatMap((s) => s.points);
  if (verts.length < 2) return null;
  const xs = verts.map((p) => p[0]);
  const ys = verts.map((p) => p[1]);
  let xMin = Math.min(...xs);
  let xMax = Math.max(...xs);
  if (!(xMax > xMin)) {
    xMin -= 0.5;
    xMax += 0.5;
  }
  // 2 % horizontal padding so end-point dots and annotation labels breathe
  // instead of sitting on the plot frame
  const xPad = (xMax - xMin) * 0.02;
  xMin -= xPad;
  xMax += xPad;
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.08 || 0.5;
  yMin -= yPad;
  yMax += yPad;

  const px = (x: number) => M.l + ((x - xMin) / (xMax - xMin)) * pw;
  const py = (y: number) => M.t + (1 - (y - yMin) / (yMax - yMin)) * ph;

  const parts: string[] = [];
  const title = input.title.length > 52 ? input.title.slice(0, 51) + "…" : input.title;
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(
    `<text x="${M.l}" y="17" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="${C.text}">${esc(title)}</text>`
  );
  if (input.note)
    parts.push(
      `<text x="${M.l}" y="32" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.faint}">${esc(input.note)}</text>`
    );

  // y grid + ticks
  for (const v of input.yTicks ?? niceTicks(yMin, yMax, 5)) {
    const y = py(v);
    parts.push(
      `<line x1="${M.l}" y1="${fx(y)}" x2="${W - M.r}" y2="${fx(y)}" stroke="${C.grid}" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${M.l - 6}" y="${fx(y + 3)}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${(input.yTickFmt ?? ((t: number) => t.toPrecision(3)))(v)}</text>`
    );
  }

  // x grid + ticks
  for (const v of input.xTicks ?? niceTicks(xMin, xMax, 6)) {
    const x = px(v);
    parts.push(
      `<line x1="${fx(x)}" y1="${M.t}" x2="${fx(x)}" y2="${H - M.b}" stroke="${C.gridSoft}" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${fx(x)}" y="${H - M.b + 13}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${(input.xTickFmt ?? ((t: number) => String(t)))(v)}</text>`
    );
  }

  // axis labels
  parts.push(
    `<text x="${W - M.r}" y="${H - 8}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.muted}">${esc(input.xLabel)}</text>`
  );
  parts.push(
    `<text x="13" y="${fx(M.t + ph / 2)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.muted}" transform="rotate(-90 13 ${fx(M.t + ph / 2)})">${esc(input.yLabel)}</text>`
  );

  // series
  for (const s of input.series) {
    if (s.points.length < 2) continue;
    const d = s.points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${fx(px(p[0]))} ${fx(py(p[1]))}`)
      .join(" ");
    parts.push(
      `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2"${
        s.dash ? ` stroke-dasharray="${s.dash}"` : ""
      } stroke-linejoin="round" stroke-linecap="round"/>`
    );
    if (s.dotLast) {
      const [lx, ly] = s.points[s.points.length - 1];
      parts.push(
        `<circle cx="${fx(px(lx))}" cy="${fx(py(ly))}" r="3.5" fill="${s.color}" stroke="#ffffff" stroke-width="1.25"/>`
      );
    }
  }

  // annotations — dot + label, clamped inside the plot
  for (const a of input.annotations ?? []) {
    const cx = Math.max(M.l + 26, Math.min(W - M.r - 26, px(a.x)));
    const cy = py(a.y);
    parts.push(
      `<circle cx="${fx(px(a.x))}" cy="${fx(cy)}" r="4" fill="${a.color}" stroke="#ffffff" stroke-width="1.5"/>`
    );
    parts.push(
      `<text x="${fx(cx)}" y="${fx(cy - 9)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="600" fill="${a.color}">${esc(a.label)}</text>`
    );
  }

  // legend — right-aligned row above the plot
  const legend = input.series.filter((s) => s.points.length >= 2);
  if (legend.length > 0) {
    const swW = 16;
    const gapX = 14;
    let curX = W - M.r;
    for (let i = legend.length - 1; i >= 0; i--) {
      const item = legend[i];
      const tw = item.label.length * 5.2;
      parts.push(
        `<text x="${fx(curX)}" y="16" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${esc(item.label)}</text>`
      );
      curX -= tw + 6;
      parts.push(
        `<line x1="${fx(curX - swW)}" y1="13" x2="${fx(curX)}" y2="13" stroke="${item.color}" stroke-width="2"${
          item.dash ? ` stroke-dasharray="${item.dash}"` : ""
        }/>`
      );
      curX -= swW + gapX;
    }
  }

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`,
    width: W,
    height: H,
  };
}

/* ------------------------------------------------------------------ */
/* resolution per iteration                                            */
/* ------------------------------------------------------------------ */

export interface ResolutionSnapshotPoint {
  iteration: number;
  resolution: number;
}

/** Resolution-vs-iteration convergence chart. The last point is pinned
 *  "current"; when the best (lowest) value sits elsewhere in the run it
 *  gets its own violet marker — RELION's smoothed estimate often disagrees
 *  with the raw last iteration. */
export function buildResolutionSvg(input: {
  title: string;
  points: ResolutionSnapshotPoint[];
}): { svg: string; width: number; height: number } | null {
  const pts = input.points
    .filter((p) => Number.isFinite(p.iteration) && Number.isFinite(p.resolution))
    .sort((a, b) => a.iteration - b.iteration);
  if (pts.length < 2) return null;
  const series: [number, number][] = pts.map((p) => [p.iteration, p.resolution]);
  const maxIter = pts[pts.length - 1].iteration;
  const best = pts.reduce((m, p) => (p.resolution < m.resolution ? p : m), pts[0]);
  const last = pts[pts.length - 1];
  const annotations: SnapshotAnnotation[] = [];
  if (best !== last && best.resolution < last.resolution)
    annotations.push({ x: best.iteration, y: best.resolution, label: `best ${best.resolution.toFixed(2)} Å`, color: C.violet });
  annotations.push({ x: last.iteration, y: last.resolution, label: `current ${last.resolution.toFixed(2)} Å`, color: C.amber });
  const yMin = Math.min(...series.map((p) => p[1]));
  return simpleLineChart({
    title: `${input.title} — resolution per iteration`,
    xLabel: "iteration",
    yLabel: "resolution (Å)",
    series: [{ label: "_rlnCurrentResolution", color: C.teal, points: series, dotLast: true }],
    xTicks: iterationTicks(maxIter),
    yTicks: niceTicks(yMin * 0.97, Math.max(...series.map((p) => p[1])) * 1.03, 5).map((v) =>
      Number(v.toFixed(2))
    ),
    xTickFmt: (v) => String(v),
    yTickFmt: (v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1)),
    annotations,
  });
}

/** Markdown table for resolution progress; long runs are sampled to ~24
 *  rows (always keeping the first and the latest iteration). */
export function resolutionTableMarkdown(points: ResolutionSnapshotPoint[]): string | null {
  const pts = points
    .filter((p) => Number.isFinite(p.iteration) && Number.isFinite(p.resolution))
    .sort((a, b) => a.iteration - b.iteration);
  if (pts.length === 0) return null;
  let rows = pts;
  if (pts.length > 24) {
    const k = Math.ceil(pts.length / 24);
    rows = pts.filter((p, i) => i % k === 0 || i === pts.length - 1);
  }
  const lines = rows.map((p) => `| ${p.iteration} | ${p.resolution.toFixed(2)} |`);
  return ["| Iteration | Resolution (Å) |", "| ---: | ---: |", ...lines].join("\n");
}

/* ------------------------------------------------------------------ */
/* Guinier plot                                                        */
/* ------------------------------------------------------------------ */

export interface GuinierSnapshotPoint {
  /** 1/d² in Å⁻² */
  x: number;
  lnAmp: number | null;
  lnAmpSharpened?: number | null;
}

/** Guinier plot: ln(amplitude) vs 1/d². The straight falloff validates
 *  the applied B-factor (annotated when known); the sharpened curve rides
 *  along when RELION wrote it. */
export function buildGuinierSvg(input: {
  title: string;
  points: GuinierSnapshotPoint[];
  bfactor: number | null;
}): { svg: string; width: number; height: number } | null {
  const usable = input.points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.lnAmp as number)
  );
  if (usable.length < 4) return null;
  const orig: [number, number][] = usable.map((p) => [p.x, p.lnAmp as number]);
  const sharpPts = usable.filter((p) => Number.isFinite(p.lnAmpSharpened as number));
  const series: SnapshotSeries[] = [
    { label: "original (masked)", color: C.teal, points: orig, dotLast: true },
  ];
  if (sharpPts.length >= 4)
    series.push({
      label: "sharpened",
      color: C.amber,
      points: sharpPts.map((p) => [p.x, p.lnAmpSharpened as number]),
      dotLast: true,
    });
  const allY = series.flatMap((s) => s.points.map((p) => p[1]));
  const yMin = Math.min(...allY);
  const yMax = Math.max(...allY);
  const span = yMax - yMin || 1;
  return simpleLineChart({
    title: `${input.title} — Guinier plot`,
    note: input.bfactor != null ? `applied B-factor: ${input.bfactor.toFixed(1)} Å²` : undefined,
    xLabel: "1/d² (Å⁻²)",
    yLabel: "ln(amplitude)",
    series,
    xTicks: niceTicks(Math.min(...orig.map((p) => p[0])), Math.max(...orig.map((p) => p[0])), 5).map(
      (v) => Number(v.toFixed(3))
    ),
    yTicks: niceTicks(yMin - span * 0.05, yMax + span * 0.05, 5).map((v) => Number(v.toFixed(2))),
    xTickFmt: (v) => v.toFixed(3),
    yTickFmt: (v) => v.toFixed(1),
  });
}

/** Markdown table for the Guinier data (sharpened column only when the
 *  source carried it). */
export function guinierTableMarkdown(points: GuinierSnapshotPoint[]): string | null {
  const usable = points.filter(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.lnAmp as number)
  );
  if (usable.length === 0) return null;
  const hasSharp = usable.some((p) => Number.isFinite(p.lnAmpSharpened as number));
  const head = hasSharp
    ? "| 1/d² (Å⁻²) | ln amplitude | after sharpening |"
    : "| 1/d² (Å⁻²) | ln amplitude |";
  const sep = hasSharp ? "| ---: | ---: | ---: |" : "| ---: | ---: |";
  const lines = usable.map((p) =>
    hasSharp
      ? `| ${p.x.toFixed(4)} | ${(p.lnAmp as number).toFixed(3)} | ${Number.isFinite(p.lnAmpSharpened as number) ? (p.lnAmpSharpened as number).toFixed(3) : "—"} |`
      : `| ${p.x.toFixed(4)} | ${(p.lnAmp as number).toFixed(3)} |`
  );
  return [head, sep, ...lines].join("\n");
}
