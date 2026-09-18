"use client";

/**
 * CryoFlow — the density histogram strip, as one shared instrument with
 * two consumers (t284).
 *
 * t283 built the histogram strip inside map-ortho-panel.tsx: the volume's
 * whole density distribution (`format=histogram` — a chunked two-pass
 * server read, cached per map), drawn as log-scaled bars with a σ ruler,
 * the current contour as a cyan cut line, a hover bin readout, and a
 * click that turns the picked density into the isosurface contour.
 *
 * t284 lifts the instrument out of the panel so the QUICK-LOOK dialog
 * (results-view's map/stack dialog — the first glance at ANY image
 * output: a corrected micrograph, a half-map, a movie stack) can speak
 * the same distribution. One drawing truth, two consumers:
 *
 *   - the ortho panel passes `cutSigma` (the live contour, echoing the
 *     embed) and `onPickSigma` (the click→σ→ORTHO_SIGMA_SET loop);
 *   - the quick-look dialog passes neither — the strip is read-only
 *     there (a dialog has no contour context to cut; honest absence),
 *     but the hover readout and the stats row still turn the first
 *     glance quantitative.
 *
 * Default OFF at both call sites: the first look costs one volume walk
 * on the server (O(1) memory, chunked) — the toggle makes that an
 * explicit ask, and the (path, mtime, size) cache makes every later
 * look free.
 */

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";

const HIST_BAR = { light: "rgba(8,145,178,0.62)", dark: "rgba(103,232,249,0.55)" };
const HIST_BAR_HOVER = { light: "rgba(8,145,178,0.9)", dark: "rgba(103,232,249,0.9)" };
const HIST_GRID = { light: "rgba(0,0,0,0.10)", dark: "rgba(255,255,255,0.10)" };
const HIST_TEXT = { light: "rgba(0,0,0,0.45)", dark: "rgba(255,255,255,0.45)" };
const HIST_CUT = { light: "#0891b2", dark: "#22d3ee" };
const HIST_MEAN = { light: "rgba(0,0,0,0.55)", dark: "rgba(255,255,255,0.55)" };

const HIST_PAD_L = 6;
const HIST_PAD_R = 6;
const HIST_PAD_T = 9;
const HIST_PAD_B = 15;

const HIST_SIGMA_TICKS = [-3, -2, -1, 0, 1, 2, 3];

interface HistPayload {
  bins: number[];
  min: number;
  max: number;
  mean: number;
  std: number;
  nFinite: number;
  nTotal: number;
  lo: number;
  hi: number;
}

/** the σ payload the cut line resolves against — structurally the panel's
 *  OrthoSigmaState (kept structural so the strip never imports the
 *  panel: the dependency points the other way) */
export interface HistCutSigma {
  sigma: number;
  sign: 1 | -1;
}

const fmtHist = (v: number) =>
  Math.abs(v) >= 1000 ? v.toLocaleString("en-US") : v.toFixed(4).replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));
const fmtN = (v: number) => v.toLocaleString("en-US");

/**
 * The draw core — one drawing truth, two consumers. σ ruler first (the
 * ticks the stats actually span, μ strongest), then log-scaled bars
 * (cryo-EM histograms are a noise spike with particle tails — linear y
 * flattens everything else into invisibility), then the current contour
 * as a cyan cut line (an off-scale threshold is drawn honestly as a
 * faded arrowhead AT the edge — the σ chip says how far), then the
 * hover bin readout (value, σ offset, count — "numbers, not squints").
 */
function drawHistogramStrip(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: HistPayload,
  opts: { dark: boolean; cutSigma?: HistCutSigma | null; hover: number | null }
) {
  const { dark, cutSigma, hover } = opts;
  const bar = dark ? HIST_BAR.dark : HIST_BAR.light;
  const barHover = dark ? HIST_BAR_HOVER.dark : HIST_BAR_HOVER.light;
  const grid = dark ? HIST_GRID.dark : HIST_GRID.light;
  const text = dark ? HIST_TEXT.dark : HIST_TEXT.light;
  const cut = dark ? HIST_CUT.dark : HIST_CUT.light;
  const meanCol = dark ? HIST_MEAN.dark : HIST_MEAN.light;

  const x0 = HIST_PAD_L;
  const x1 = w - HIST_PAD_R;
  const y0 = HIST_PAD_T;
  const y1 = h - HIST_PAD_B;
  const span = data.hi - data.lo;
  const xOf = (v: number) =>
    span > 0 ? x0 + ((v - data.lo) / span) * (x1 - x0) : (x0 + x1) / 2;

  // σ ruler — the ticks the stats actually span, μ strongest
  ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = 1;
  for (const s of HIST_SIGMA_TICKS) {
    const v = data.mean + s * data.std;
    if (v < data.lo || v > data.hi) continue;
    const gx = xOf(v);
    ctx.strokeStyle = s === 0 ? meanCol : grid;
    ctx.beginPath();
    ctx.moveTo(gx, y0 - 2);
    ctx.lineTo(gx, y1);
    ctx.stroke();
    ctx.fillStyle = text;
    ctx.fillText(s === 0 ? "μ" : `${s > 0 ? "+" : ""}${s}σ`, gx, y1 + 3);
  }

  // bars — log-scaled: log10(1 + c) against the max, so the noise peak
  // and the particle tails share one readable picture
  const bins = data.bins;
  const n = bins.length;
  let maxC = 0;
  for (const c of bins) if (c > maxC) maxC = c;
  if (maxC <= 0) maxC = 1;
  const logMax = Math.log10(1 + maxC);
  const bw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const c = bins[i];
    if (c <= 0) continue;
    const bh = ((y1 - y0) * Math.log10(1 + c)) / logMax;
    ctx.fillStyle = hover === i ? barHover : bar;
    // 1px gap between bars keeps 256 bins legible at strip width
    ctx.fillRect(x0 + i * bw, y1 - bh, Math.max(0.5, bw - 1), bh);
  }

  // the current contour — a cyan cut line; an off-scale threshold is
  // drawn as a faded arrowhead AT the edge (honest: the value lives
  // beyond the visible range, the σ chip says how far)
  if (cutSigma) {
    const v = data.mean + cutSigma.sign * cutSigma.sigma * data.std;
    const cx = Math.min(x1, Math.max(x0, xOf(v)));
    const inside = v >= data.lo && v <= data.hi;
    ctx.strokeStyle = cut;
    ctx.globalAlpha = inside ? 1 : 0.35;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, y0 - 3);
    ctx.lineTo(cx, y1);
    ctx.stroke();
    if (!inside) {
      // arrowhead at the edge, pointing off-scale
      ctx.beginPath();
      const dir = v > data.hi ? 1 : -1;
      ctx.moveTo(cx + 3 * dir, y0 - 1);
      ctx.lineTo(cx - 2 * dir, y0 - 5);
      ctx.lineTo(cx - 2 * dir, y0 + 3);
      ctx.closePath();
      ctx.fillStyle = cut;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // hover readout — value, σ offset and count of the bin under the
  // cursor (top-left, mono, on a translucent backing)
  if (hover !== null && hover >= 0 && hover < n) {
    const binW = span > 0 ? span / n : 0;
    const mid = data.lo + (hover + 0.5) * binW;
    const sOff = data.std > 0 ? (mid - data.mean) / data.std : 0;
    const line = `${mid.toFixed(4)} (${sOff >= 0 ? "+" : ""}${sOff.toFixed(2)}σ) · ${fmtN(data.bins[hover])} vx`;
    ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const tw = ctx.measureText(line).width;
    ctx.fillStyle = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
    ctx.fillRect(x0, y0, tw + 8, 13);
    ctx.fillStyle = dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.8)";
    ctx.fillText(line, x0 + 4, y0 + 2);
  }
}

/**
 * The strip itself: fetch (once per mount — the server cache makes
 * re-opens free), draw, hover, stats row. Interactive (crosshair +
 * click→σ) only when `onPickSigma` is passed; read-only otherwise.
 */
export function DensityHistogramStrip({
  jobId,
  path,
  cutSigma = null,
  onPickSigma,
  uiPrefix = "hist",
  ariaLabel = "The file's density histogram with the σ ruler",
  interactiveTitle,
}: {
  jobId: string;
  path: string;
  /** the live contour (σ units + sign) — draws the cyan cut line; the
   *  quick-look dialog passes none (nothing to cut there) */
  cutSigma?: HistCutSigma | null;
  /** when passed, the strip is interactive: a click turns the picked
   *  density into σ (sign follows the clicked side of the mean, clamped
   *  to the slider's own bounds) and hands it to the caller */
  onPickSigma?: (sigma: number, sign: 1 | -1) => void;
  /** data-canvas-ui prefix: "ortho-hist" in the panel, "quick-hist" in
   *  the dialog — the hooks stay machine-findable per consumer */
  uiPrefix?: string;
  ariaLabel?: string;
  /** the canvas title when interactive (the read-only strip titles itself) */
  interactiveTitle?: string;
}) {
  const [data, setData] = useState<HistPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "err">("loading");
  const [hover, setHover] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();

  // one fetch per strip mount — the server caches the histogram per
  // (path, mtime, size), so re-opening the strip is free
  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setData(null);
    fetch(
      `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=histogram`,
      { cache: "no-store" }
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const d = await r.json();
        if (
          !d ||
          !Array.isArray(d.bins) ||
          d.bins.length === 0 ||
          typeof d.mean !== "number" || !Number.isFinite(d.mean) ||
          typeof d.std !== "number" || !Number.isFinite(d.std) ||
          typeof d.lo !== "number" || typeof d.hi !== "number"
        ) {
          throw new Error("bad payload");
        }
        if (cancelled) return;
        setData(d as HistPayload);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("err");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, path]);

  // the draw — data, contour, hover and theme all repaint the strip
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || state !== "ready" || !data) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dark = resolvedTheme === "dark";

    const w = cv.clientWidth || 1;
    const h = cv.clientHeight || 1;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    drawHistogramStrip(ctx, w, h, data, { dark, cutSigma, hover });
  }, [data, state, cutSigma, hover, resolvedTheme]);

  const binAt = (clientX: number) => {
    const cv = canvasRef.current;
    if (!cv || !data) return null;
    const rect = cv.getBoundingClientRect();
    const x0 = HIST_PAD_L;
    const x1 = rect.width - HIST_PAD_R;
    const frac = (clientX - rect.left - x0) / (x1 - x0);
    const n = data.bins.length;
    const idx = Math.trunc(frac * n);
    if (!Number.isFinite(idx) || idx < 0 || idx >= n) return null;
    return idx;
  };

  return (
    <div
      data-canvas-ui={uiPrefix}
      data-hist-state={state}
      className="rounded-md border border-border/60 bg-background/40 px-2 pb-1.5 pt-1.5"
    >
      {state === "ready" && data ? (
        <>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={ariaLabel}
            title={onPickSigma ? interactiveTitle : "The density distribution — hover to read bins"}
            className={(onPickSigma ? "h-24 w-full cursor-crosshair" : "h-24 w-full cursor-default") + " select-none"}
            onPointerMove={(e) => setHover(binAt(e.clientX))}
            onPointerLeave={() => setHover(null)}
            onClick={(e) => {
              if (!onPickSigma) return; // read-only strip: a click is just a click
              // the pick: clicked density → σ (sign follows the clicked
              // side of the mean) → the caller commits it
              const cv = canvasRef.current;
              if (!cv || !data || data.std <= 0) return;
              const rect = cv.getBoundingClientRect();
              const x0 = HIST_PAD_L;
              const x1 = rect.width - HIST_PAD_R;
              const frac = (e.clientX - rect.left - x0) / (x1 - x0);
              if (!Number.isFinite(frac)) return;
              const v = data.lo + Math.min(1, Math.max(0, frac)) * (data.hi - data.lo);
              const raw = (v - data.mean) / data.std;
              const sign: 1 | -1 = raw < 0 ? -1 : 1;
              const sigma = Math.min(10, Math.max(0.05, Math.abs(raw)));
              onPickSigma(sigma, sign);
            }}
          />
          <div
            data-canvas-ui={`${uiPrefix}-stats`}
            data-hist-mean={data.mean.toFixed(6)}
            data-hist-std={data.std.toFixed(6)}
            data-hist-n={String(data.nFinite)}
            data-hist-lo={data.lo.toFixed(6)}
            data-hist-hi={data.hi.toFixed(6)}
            className="flex items-baseline justify-between gap-2 font-mono text-[9px] tabular-nums text-muted-foreground"
          >
            <span className="truncate">
              n {fmtN(data.nFinite)} · μ {fmtHist(data.mean)} · σ {fmtHist(data.std)}
            </span>
            <span className="truncate text-right">
              min {fmtHist(data.min)} · max {fmtHist(data.max)} · log count
            </span>
          </div>
        </>
      ) : state === "err" ? (
        <div className="flex h-24 items-center justify-center text-[10px] text-muted-foreground">
          The density histogram is unavailable for this file.
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          counting voxels…
        </div>
      )}
    </div>
  );
}

/**
 * The quick-look dialog's histogram section (t284): a toggle (default
 * OFF — the first look is an explicit ask) plus the read-only strip.
 * Mount with key={path} so a new file resets the toggle.
 */
export function QuickHistSection({ jobId, path }: { jobId: string; path: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOn((o) => !o)}
          aria-pressed={on}
          data-canvas-ui="quick-hist-toggle"
          className="flex items-center gap-1.5 rounded-md border border-border/70 bg-background/60 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground aria-pressed:border-cyan-700/60 aria-pressed:bg-cyan-950/30 aria-pressed:text-cyan-700 dark:aria-pressed:text-cyan-300"
          title="Count every voxel and draw the density distribution (a chunked two-pass server read — the first look walks the file, the server cache makes the rest free)"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3 w-3"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="1" y="10" width="2" height="5" rx="0.5" />
            <rect x="4" y="6" width="2" height="9" rx="0.5" />
            <rect x="7" y="1" width="2" height="14" rx="0.5" />
            <rect x="10" y="8" width="2" height="7" rx="0.5" />
            <rect x="13" y="12" width="2" height="3" rx="0.5" />
          </svg>
          Histogram
        </button>
        <span className="text-[10px] text-muted-foreground">
          {on ? "whole-file density distribution" : "where does the density live?"}
        </span>
      </div>
      {on && (
        <DensityHistogramStrip
          jobId={jobId}
          path={path}
          uiPrefix="quick-hist"
          ariaLabel="The file's density histogram with the σ ruler"
        />
      )}
    </div>
  );
}
