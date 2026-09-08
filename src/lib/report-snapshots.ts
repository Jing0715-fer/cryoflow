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

/* ------------------------------------------------------------------ */
/* CTF fit quality — defocus scatter + FOM histogram                   */
/* ------------------------------------------------------------------ */

export interface CtfSnapshotMicrograph {
  name: string;
  /** µm */
  defocusU: number;
  /** µm */
  defocusV: number;
  /** µm */
  astigmatism: number;
  /** ctffind figure of merit 0–1 */
  fom: number;
  /** Å */
  maxResolution: number;
}

/** CTF quality snapshot, mirroring the in-app CtfQualityChart semantics on
 *  a wide canvas: LEFT — defocus U vs V square plot (shared domain so the
 *  dashed diagonal is geometrically true; off-diagonal distance IS the
 *  astigmatism, dot size encodes it); RIGHT — FOM health histogram with
 *  the app's emerald/amber/rose buckets, so "how many micrographs are
 *  healthy" reads at a glance. Fail-soft: needs ≥3 usable points. */
export function buildCtfScatterSvg(input: {
  title: string;
  micrographs: CtfSnapshotMicrograph[];
}): { svg: string; width: number; height: number } | null {
  const pts = input.micrographs.filter(
    (m) => Number.isFinite(m.defocusU) && Number.isFinite(m.defocusV)
  );
  if (pts.length < 3) return null;

  const W = 640;
  const H = 320;
  const title = input.title.length > 52 ? input.title.slice(0, 51) + "…" : input.title;
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(
    `<text x="54" y="17" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="${C.text}">${esc(title)} — CTF fit quality</text>`
  );
  parts.push(
    `<text x="54" y="32" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.faint}">${pts.length} micrographs · dot size encodes astigmatism · dashed diagonal = zero astigmatism</text>`
  );

  // LEFT square: U vs V. Shared domain over both axes keeps the diagonal
  // at exactly 45° — the plot area is square to match.
  const M = { t: 46, b: 40, l: 54, r: 18 };
  const ph = H - M.t - M.b; // square side
  const pw = ph;
  const all = pts.flatMap((p) => [p.defocusU, p.defocusV]);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const pad = Math.max((hi - lo) * 0.06, 0.05);
  lo -= pad;
  hi += pad;
  const px = (v: number) => M.l + ((v - lo) / (hi - lo)) * pw;
  const py = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * ph;

  for (const v of niceTicks(lo, hi, 5)) {
    parts.push(
      `<line x1="${M.l}" y1="${fx(py(v))}" x2="${M.l + pw}" y2="${fx(py(v))}" stroke="${C.grid}" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${M.l - 6}" y="${fx(py(v) + 3)}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${v.toFixed(1)}</text>`
    );
    parts.push(
      `<line x1="${fx(px(v))}" y1="${M.t}" x2="${fx(px(v))}" y2="${M.t + ph}" stroke="${C.gridSoft}" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${fx(px(v))}" y="${M.t + ph + 13}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${v.toFixed(1)}</text>`
    );
  }
  // dashed zero-astigmatism diagonal (amber, as in the app)
  parts.push(
    `<line x1="${fx(px(lo))}" y1="${fx(py(lo))}" x2="${fx(px(hi))}" y2="${fx(py(hi))}" stroke="${C.amber}" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.75"/>`
  );
  // dots — radius scales with astigmatism (clamped), app's ZAxis mirror
  const astigMax = Math.max(...pts.map((p) => p.astigmatism), 1e-6);
  for (const p of pts) {
    const r = 2.2 + 4.5 * Math.min(1, p.astigmatism / astigMax);
    parts.push(
      `<circle cx="${fx(px(p.defocusU))}" cy="${fx(py(p.defocusV))}" r="${r.toFixed(2)}" fill="${C.teal}" fill-opacity="0.7" stroke="${C.teal}" stroke-width="1"/>`
    );
  }
  parts.push(
    `<text x="${M.l + pw}" y="${H - 8}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.muted}">defocus U (µm)</text>`
  );
  parts.push(
    `<text x="13" y="${fx(M.t + ph / 2)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.muted}" transform="rotate(-90 13 ${fx(M.t + ph / 2)})">defocus V (µm)</text>`
  );

  // RIGHT panel: FOM health histogram (same buckets as the app's fomTone)
  const hx0 = M.l + pw + 34;
  const hx1 = W - M.r;
  const foms = pts.map((p) => p.fom).filter((f) => Number.isFinite(f) && f > 0);
  const hy0 = M.t;
  const hy1 = M.t + ph;
  if (foms.length >= 3) {
    const fMax = Math.max(0.3, Math.max(...foms) * 1.05);
    const BINS = 12;
    const bw = (hx1 - hx0) / BINS;
    const counts = new Array<number>(BINS).fill(0);
    for (const f of foms) {
      const b = Math.min(BINS - 1, Math.max(0, Math.floor((f / fMax) * BINS)));
      counts[b]++;
    }
    const cMax = Math.max(...counts, 1);
    const fomTone = (center: number) =>
      center >= 0.1 ? "#059669" : center >= 0.05 ? "#d97706" : "#e11d48";
    for (const v of [0, Math.round(cMax / 2), cMax]) {
      const y = hy1 - (v / cMax) * (hy1 - hy0);
      parts.push(
        `<line x1="${hx0}" y1="${fx(y)}" x2="${hx1}" y2="${fx(y)}" stroke="${C.grid}" stroke-width="1"/>`
      );
      parts.push(
        `<text x="${hx0 - 6}" y="${fx(y + 3)}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${v}</text>`
      );
    }
    counts.forEach((c, i) => {
      if (c === 0) return;
      const h = (c / cMax) * (hy1 - hy0);
      const center = ((i + 0.5) / BINS) * fMax;
      parts.push(
        `<rect x="${fx(hx0 + i * bw + 1)}" y="${fx(hy1 - h)}" width="${fx(Math.max(1, bw - 2))}" height="${fx(h)}" fill="${fomTone(center)}" fill-opacity="0.82"/>`
      );
    });
    for (const v of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]) {
      if (v > fMax) break;
      parts.push(
        `<text x="${fx(hx0 + (v / fMax) * (hx1 - hx0))}" y="${hy1 + 13}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${v.toFixed(2)}</text>`
      );
    }
    parts.push(
      `<text x="${hx1}" y="${hy1 + 27}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.muted}">figure of merit (green ≥ 0.10 · amber ≥ 0.05 · red below)</text>`
    );
    parts.push(
      `<text x="${hx0}" y="17" text-anchor="start" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="600" fill="${C.text}">FOM health</text>`
    );
  } else {
    parts.push(
      `<text x="${fx((hx0 + hx1) / 2)}" y="${fx((hy0 + hy1) / 2)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.faint}">no FOM column in source star</text>`
    );
  }

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`,
    width: W,
    height: H,
  };
}

/** Markdown table for per-micrograph CTF fits; long lists are sampled to
 *  ~24 rows (always keeping the first and the last). */
export function ctfTableMarkdown(micrographs: CtfSnapshotMicrograph[]): string | null {
  const pts = micrographs.filter(
    (m) => Number.isFinite(m.defocusU) && Number.isFinite(m.defocusV)
  );
  if (pts.length === 0) return null;
  let rows = pts;
  if (pts.length > 24) {
    const k = Math.ceil(pts.length / 24);
    rows = pts.filter((p, i) => i % k === 0 || i === pts.length - 1);
  }
  const lines = rows.map((m) => {
    const defocus = ((m.defocusU + m.defocusV) / 2).toFixed(2);
    const astig = Number.isFinite(m.astigmatism) ? m.astigmatism.toFixed(2) : "—";
    const fom = Number.isFinite(m.fom) && m.fom > 0 ? m.fom.toFixed(3) : "—";
    const fit =
      Number.isFinite(m.maxResolution) && m.maxResolution > 0 ? m.maxResolution.toFixed(1) : "—";
    return `| ${m.name} | ${defocus} | ${astig} | ${fom} | ${fit} |`;
  });
  return ["| Micrograph | Defocus (µm) | Astig (µm) | FOM | Fit (Å) |", "| --- | ---: | ---: | ---: | ---: |", ...lines].join(
    "\n"
  );
}

/* ------------------------------------------------------------------ */
/* Angular distribution — polar sector heatmap                         */
/* ------------------------------------------------------------------ */

export interface AngDistSnapshot {
  title: string;
  /** row-major cells[rotIdx * tiltBins + tiltIdx] */
  cells: number[];
  rotBins: number;
  tiltBins: number;
  total: number;
  max: number;
  occupied: number;
  /** concentration factor = max / mean over occupied cells */
  anisotropy: number;
  symmetry: string | null;
  iteration: number | null;
  starFile: string | null;
}

const ANGDIST_TEAL = "#0d9488"; // teal-600, same as the in-app polar heatmap

/** Angular-distribution polar heatmap for the report — a standalone-SVG
 *  replica of the in-app AngularDistributionChart: radius = tilt θ
 *  (0° centre → 180° edge), sweep = rot φ, sqrt opacity scale so faint
 *  bins stay visible, tilt rings + rot spokes, right-hand legend column
 *  with the isotropy verdict. Everything uses explicit colors so the PNG
 *  looks identical wherever it is pasted. Fail-soft on empty/degenerate
 *  grids. */
export function buildAngdistHeatmapSvg(
  input: AngDistSnapshot
): { svg: string; width: number; height: number } | null {
  const { rotBins, tiltBins, cells, max, total } = input;
  if (!(total > 0) || !(max > 0) || cells.length < rotBins * tiltBins) return null;

  const W = 640;
  const H = 320;
  const CX = 172;
  const CY = 182;
  const MAX_R = 118;
  const parts: string[] = [];

  const sectorPath = (rotIdx: number, tiltIdx: number): string => {
    const padAngle = ((Math.PI * 2) / rotBins) * 0.06;
    const padR = 0.6;
    const r0 = (tiltIdx / tiltBins) * MAX_R + (tiltIdx === 0 ? 0 : padR);
    const r1 = ((tiltIdx + 1) / tiltBins) * MAX_R - padR;
    const a0 = (rotIdx / rotBins) * Math.PI * 2 - Math.PI / 2 + padAngle;
    const a1 = ((rotIdx + 1) / rotBins) * Math.PI * 2 - Math.PI / 2 - padAngle;
    const x = (r: number, a: number) => (CX + r * Math.cos(a)).toFixed(2);
    const y = (r: number, a: number) => (CY + r * Math.sin(a)).toFixed(2);
    return [
      `M ${x(r1, a0)} ${y(r1, a0)}`,
      `A ${r1.toFixed(2)} ${r1.toFixed(2)} 0 0 1 ${x(r1, a1)} ${y(r1, a1)}`,
      `L ${x(r0, a1)} ${y(r0, a1)}`,
      `A ${r0.toFixed(2)} ${r0.toFixed(2)} 0 0 0 ${x(r0, a0)} ${y(r0, a0)}`,
      "Z",
    ].join(" ");
  };

  const title = input.title.length > 52 ? input.title.slice(0, 51) + "…" : input.title;
  const iterLabel = input.iteration != null ? `iteration ${input.iteration}` : "final";
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(
    `<text x="20" y="17" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="${C.text}">${esc(title)} — orientation distribution</text>`
  );
  parts.push(
    `<text x="20" y="32" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.faint}">${total.toLocaleString("en-US")} particles binned · source ${esc(input.starFile ?? "?")} (${iterLabel})</text>`
  );

  // tilt rings (labels are painted AFTER the heat cells so hot lobes can't
  // bury them — see ringLabels below)
  const ringLabels: string[] = [];
  for (const deg of [30, 60, 90, 120, 150]) {
    const r = (deg / 180) * MAX_R;
    parts.push(
      `<circle cx="${CX}" cy="${CY}" r="${r.toFixed(2)}" fill="none" stroke="${C.faint}" stroke-width="0.6" stroke-dasharray="2 3" opacity="0.55"/>`
    );
    const a = -Math.PI / 4;
    ringLabels.push(
      `<text x="${fx(CX + (r + 3) * Math.cos(a))}" y="${fx(CY + (r + 3) * Math.sin(a))}" text-anchor="start" dominant-baseline="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="7" font-weight="600" fill="${C.muted}" stroke="#ffffff" stroke-width="2.5" paint-order="stroke">${deg}°</text>`
    );
  }
  // rot spokes
  for (const deg of [0, 90, 180, 270]) {
    const a = (deg / 360) * Math.PI * 2 - Math.PI / 2;
    parts.push(
      `<line x1="${CX}" y1="${CY}" x2="${fx(CX + MAX_R * Math.cos(a))}" y2="${fx(CY + MAX_R * Math.sin(a))}" stroke="${C.faint}" stroke-width="0.6" opacity="0.55"/>`
    );
  }
  // heat cells — sqrt scale, zero cells stay empty (as in the app)
  for (let idx = 0; idx < rotBins * tiltBins; idx++) {
    const count = cells[idx];
    if (count === 0) continue;
    const rotIdx = Math.floor(idx / tiltBins);
    const tiltIdx = idx % tiltBins;
    const t = Math.sqrt(count / max);
    const opacity = 0.12 + 0.83 * t;
    parts.push(
      `<path d="${sectorPath(rotIdx, tiltIdx)}" fill="${ANGDIST_TEAL}" fill-opacity="${opacity.toFixed(3)}"/>`
    );
  }
  // outer circle + rot labels + centre marker
  parts.push(
    `<circle cx="${CX}" cy="${CY}" r="${MAX_R}" fill="none" stroke="${C.muted}" stroke-width="0.9" opacity="0.7"/>`
  );
  for (const deg of [0, 90, 180, 270]) {
    const a = (deg / 360) * Math.PI * 2 - Math.PI / 2;
    const lx = CX + (MAX_R + 14) * Math.cos(a);
    const ly = CY + (MAX_R + 14) * Math.sin(a);
    parts.push(
      `<text x="${fx(lx)}" y="${fx(ly)}" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="8" fill="${C.muted}">rot ${deg}°</text>`
    );
  }
  parts.push(`<circle cx="${CX}" cy="${CY}" r="1.4" fill="${C.muted}"/>`);
  // ring labels ride on top of the heat cells, with a white halo
  parts.push(...ringLabels);

  // right column — legend + verdict (app-mirroring, explicit colors)
  const rx = 336;
  const rw = W - rx - 20;
  parts.push(
    `<text x="${rx}" y="66" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="600" fill="${C.text}">particles per bin</text>`
  );
  parts.push(
    `<text x="${W - 20}" y="66" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.muted}">0 → ${max.toLocaleString("en-US")}</text>`
  );
  parts.push(
    `<defs><linearGradient id="ag-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${ANGDIST_TEAL}" stop-opacity="0.12"/><stop offset="0.45" stop-color="${ANGDIST_TEAL}" stop-opacity="0.4"/><stop offset="1" stop-color="${ANGDIST_TEAL}" stop-opacity="0.95"/></linearGradient></defs>`
  );
  parts.push(
    `<rect x="${rx}" y="74" width="${rw}" height="10" rx="5" fill="url(#ag-grad)" stroke="${C.grid}"/>`
  );
  parts.push(
    `<text x="${rx}" y="98" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.faint}">radius = tilt θ (0°–180°) · sweep = rot φ · sqrt colour scale</text>`
  );

  const anisotropic = input.anisotropy > 6;
  const verdictLines = anisotropic
    ? [
        `anisotropic views — concentration ×${input.anisotropy.toFixed(1)}.`,
        "Preferred orientation can bias the map",
        "along the missing directions.",
      ]
    : [
        `isotropic coverage — concentration ×${input.anisotropy.toFixed(1)},`,
        `${input.occupied}/${rotBins * tiltBins} bins populated.`,
        "Orientations sample the sphere evenly.",
      ];
  const boxTop = 116;
  const boxH = 64;
  parts.push(
    `<rect x="${rx}" y="${boxTop}" width="${rw}" height="${boxH}" rx="6" fill="${anisotropic ? "#fffbeb" : "#ecfdf5"}" stroke="${anisotropic ? "#f59e0b66" : "#10b98166"}"/>`
  );
  verdictLines.forEach((line, i) => {
    parts.push(
      `<text x="${rx + 8}" y="${boxTop + 16 + i * 15}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" font-weight="${i === 0 ? 600 : 400}" fill="${anisotropic ? "#92400e" : "#065f46"}">${esc(line)}</text>`
    );
  });
  // stats block under the verdict
  const stats: string[] = [
    `hottest bin: ${max.toLocaleString("en-US")} particles`,
    `bins populated: ${input.occupied} / ${rotBins * tiltBins}`,
  ];
  if (input.symmetry) stats.push(`point-group symmetry: ${input.symmetry}`);
  stats.forEach((line, i) => {
    parts.push(
      `<text x="${rx}" y="${boxTop + boxH + 18 + i * 14}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${esc(line)}</text>`
    );
  });

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`,
    width: W,
    height: H,
  };
}

/** Key/value Markdown table summarizing the orientation distribution —
 *  the 288-cell grid itself lives in the PNG, the table keeps the numbers
 *  citable. */
export function angdistSummaryMarkdown(input: AngDistSnapshot): string {
  const anisotropic = input.anisotropy > 6;
  const iterLabel = input.iteration != null ? `iteration ${input.iteration}` : "final";
  const rows: [string, string][] = [
    ["Particles binned", input.total.toLocaleString("en-US")],
    ["Bins populated", `${input.occupied} / ${input.rotBins * input.tiltBins}`],
    ["Hottest bin", `${input.max.toLocaleString("en-US")} particles`],
    [
      "Concentration",
      `×${input.anisotropy.toFixed(1)} — ${anisotropic ? "anisotropic (preferred-orientation risk)" : "isotropic coverage"}`,
    ],
    ["Symmetry", input.symmetry ?? "—"],
    ["Source", `\`${input.starFile ?? "?"}\` (${iterLabel})`],
  ];
  return ["| Field | Value |", "| --- | --- |", ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join(
    "\n"
  );
}
