"use client";

/**
 * CryoFlow — cryoSPARC-style orientation distribution plot.
 *
 * Ported/inspired by the Mollweide visualizations of
 *   github.com/Jing0715-fer/icosahedral-symmetry-expander (MollweideHeatmap)
 *   github.com/Jing0715-fer/Orient-Rebalancer (MollweidePlot + marginals)
 * — unified into one panel: equal-area Mollweide projection with a log-scaled
 * viridis heat field, marginal rot/tilt histograms, a colorbar, and an
 * optional point-group orbit overlay (expand the observed coverage by the
 * symmetry rotations — a preview of the Symmetry Expansion job).
 *
 * Pure presentational: fed with fib-sphere bins + marginal histograms
 * (computed server-side by summarizeOrientation).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Compass, Globe2, RadioTower, Orbit, TriangleAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mat3, matVec, plotSymmetryMatrices } from "@/lib/symmetry";

export interface FibBin {
  x: number;
  y: number;
  z: number;
  count: number;
}

export interface CryoAngleData {
  bins: FibBin[];
  maxBin: number;
  rotHist: number[];
  tiltHist: number[];
  anisotropy: number;
}

/* ------------------------------------------------------------------ */
/* viridis colormap (data viz standard — piecewise over 6 anchors)     */
/* ------------------------------------------------------------------ */

const VIRIDIS_ANCHORS: Array<[number, number, number]> = [
  [68, 1, 84],
  [72, 40, 120],
  [62, 74, 137],
  [49, 104, 142],
  [38, 130, 142],
  [31, 158, 137],
  [53, 183, 121],
  [109, 205, 89],
  [180, 222, 44],
  [253, 231, 37],
];

function viridis(t: number): string {
  const tc = Math.max(0, Math.min(1, t));
  const scaled = tc * (VIRIDIS_ANCHORS.length - 1);
  const i = Math.min(VIRIDIS_ANCHORS.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = VIRIDIS_ANCHORS[i];
  const b = VIRIDIS_ANCHORS[i + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r},${g},${bl})`;
}

/* ------------------------------------------------------------------ */
/* Mollweide projection (Newton iteration — ported)                   */
/* ------------------------------------------------------------------ */

function mollweideTheta(lat: number): number {
  let theta = lat;
  for (let i = 0; i < 6; i++) {
    const f = 2 * theta + Math.sin(2 * theta) - Math.PI * Math.sin(lat);
    const fp = 2 + 2 * Math.cos(2 * theta);
    if (Math.abs(fp) < 1e-9) break;
    theta -= f / fp;
  }
  return theta;
}

/** Project a unit vector → Mollweide (x,y) normalized to [-1,1]×[-0.5,0.5]. */
function projectUnit(v: { x: number; y: number; z: number }): { x: number; y: number } {
  const lon = Math.atan2(v.y, v.x); // -pi..pi
  const lat = Math.asin(Math.max(-1, Math.min(1, v.z))); // -pi/2..pi/2
  const theta = mollweideTheta(lat);
  const x = ((2 * Math.sqrt(2)) / Math.PI) * lon * Math.cos(theta);
  const y = Math.sqrt(2) * Math.sin(theta);
  return { x, y };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface HoverInfo {
  rot: number;
  tilt: number;
  count: number;
}

export function CryoSparcAnglePlot({
  data,
  total,
  symmetry,
  iterationLabel,
  running,
  className,
  compact,
}: {
  data: CryoAngleData;
  total: number;
  symmetry?: string | null;
  iterationLabel?: string;
  running?: boolean;
  className?: string;
  /** compact = no outer section chrome (used inside report views) */
  compact?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 420, h: 300 });
  const [expandSym, setExpandSym] = useState(false);
  const [hovered, setHovered] = useState<HoverInfo | null>(null);

  const symMats = useMemo<Mat3[] | null>(
    () => (symmetry ? plotSymmetryMatrices(symmetry) : null),
    [symmetry]
  );

  /** Expanded view: rotate every occupied bin through the group operations
   *  and re-accumulate onto the nearest fib centers (client-side orbit). */
  const effective = useMemo(() => {
    if (!expandSym || !symMats) return data;
    const centers = data.bins.map((b) => [b.x, b.y, b.z] as [number, number, number]);
    const counts = new Array<number>(centers.length).fill(0);
    for (const bin of data.bins) {
      if (bin.count <= 0) continue;
      const v: [number, number, number] = [bin.x, bin.y, bin.z];
      for (const m of symMats) {
        const rv = matVec(m, v);
        // nearest fib center
        let best = -Infinity;
        let bi = 0;
        for (let i = 0; i < centers.length; i++) {
          const d = rv[0] * centers[i][0] + rv[1] * centers[i][1] + rv[2] * centers[i][2];
          if (d > best) {
            best = d;
            bi = i;
          }
        }
        counts[bi] += bin.count;
      }
    }
    const maxBin = counts.reduce((m, c) => Math.max(m, c), 0);
    return { ...data, bins: centers.map((c, i) => ({ x: c[0], y: c[1], z: c[2], count: counts[i] })), maxBin };
  }, [data, expandSym, symMats]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.max(300, e.contentRect.width);
        // layout: [tilt-hist 56][plot w'×h' (2:1)][gap][colorbar 62]; rot hist below
        const plotW = w - 56 - 14 - 62;
        const plotH = plotW / 2;
        setSize({ w, h: Math.round(plotH + 84) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const { w, h } = size;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // ---- layout -------------------------------------------------------
    const pad = 10;
    const histL = 56; // tilt marginal strip
    const cbW = 13;
    const cbZone = 62; // colorbar + labels
    const plotW = w - histL - 14 - cbZone;
    const plotH = plotW / 2;
    const cx = histL + plotW / 2;
    const cy = pad + plotH / 2;
    const rx = plotW / 2;
    const ry = plotH / 2;
    const rotHistH = 44;
    const rotHistY = pad + plotH + 8;

    const grid = "rgba(125,130,140,0.30)";
    const gridSoft = "rgba(125,130,140,0.14)";
    const label = "rgba(125,130,140,0.85)";

    // ---- heat field (drawn first, clipped to the ellipse) -------------
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();

    // log color domain over occupied bins
    let mnLog = Infinity;
    let mxLog = 0;
    for (const b of effective.bins) {
      if (b.count > 0) {
        const lg = Math.log10(b.count + 1);
        if (lg < mnLog) mnLog = lg;
        if (lg > mxLog) mxLog = lg;
      }
    }
    if (mnLog === Infinity) mnLog = 0;

    const N = effective.bins.length || 1;
    const rBin = Math.sqrt((rx * ry) / (Math.PI * N));
    for (const b of effective.bins) {
      if (b.count <= 0) continue;
      const p = projectUnit(b);
      const sx = cx + p.x * rx;
      const sy = cy - p.y * ry;
      const t = mxLog > mnLog ? (Math.log10(b.count + 1) - mnLog) / (mxLog - mnLog) : 0.5;
      ctx.fillStyle = viridis(t);
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.6, rBin), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ---- graticule ------------------------------------------------------
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = gridSoft;
    ctx.lineWidth = 1;
    // parallels
    for (let lat = -60; lat <= 60; lat += 30) {
      if (lat === 0) continue;
      const latR = (lat * Math.PI) / 180;
      ctx.beginPath();
      for (let lon = -180; lon <= 180; lon += 4) {
        const lonR = (lon * Math.PI) / 180;
        const theta = mollweideTheta(latR);
        const x = ((2 * Math.sqrt(2)) / Math.PI) * lonR * Math.cos(theta) * rx;
        const y = Math.sqrt(2) * Math.sin(theta) * ry;
        if (lon === -180) ctx.moveTo(x, -y);
        else ctx.lineTo(x, -y);
      }
      ctx.stroke();
    }
    // meridians
    for (let lon = -150; lon <= 150; lon += 30) {
      if (lon === 0) continue;
      const lonR = (lon * Math.PI) / 180;
      ctx.beginPath();
      for (let lat = -90; lat <= 90; lat += 3) {
        const latR = (lat * Math.PI) / 180;
        const theta = mollweideTheta(latR);
        const x = ((2 * Math.sqrt(2)) / Math.PI) * lonR * Math.cos(theta) * rx;
        const y = Math.sqrt(2) * Math.sin(theta) * ry;
        if (lat === -90) ctx.moveTo(x, -y);
        else ctx.lineTo(x, -y);
      }
      ctx.stroke();
    }
    // equator + central meridian
    ctx.strokeStyle = grid;
    ctx.beginPath();
    ctx.moveTo(-rx, 0);
    ctx.lineTo(rx, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -ry);
    ctx.lineTo(0, ry);
    ctx.stroke();
    // outer ellipse
    ctx.strokeStyle = "rgba(125,130,140,0.55)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // ---- axis labels ------------------------------------------------------
    ctx.fillStyle = label;
    ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("0°", cx, h - 1);
    ctx.textAlign = "left";
    ctx.fillText("180°", histL + 2, cy - 3);
    ctx.textAlign = "right";
    ctx.fillText("0°", histL + plotW - 4, cy - 3);
    ctx.fillText("360°", histL + plotW, cy - 3);
    // poles
    ctx.textAlign = "center";
    ctx.fillText("tilt 0°", cx, cy - ry - 1);
    ctx.fillText("tilt 180°", cx, cy + ry + 9);

    // ---- tilt marginal histogram (left strip, horizontal bars) ----------
    const tiltHist = effective.tiltHist;
    const tiltMax = Math.max(1, ...tiltHist);
    const stripX0 = 4;
    const stripX1 = histL - 8;
    for (let i = 0; i < tiltHist.length; i++) {
      const c = tiltHist[i];
      if (c <= 0) continue;
      const yTop = cy - ry + (i / tiltHist.length) * 2 * ry;
      const yH = (2 * ry) / tiltHist.length - 0.5;
      const bw = ((stripX1 - stripX0) * c) / tiltMax;
      const t = mxLog > mnLog ? (Math.log10(c + 1) - mnLog) / (mxLog - mnLog) : 0.5;
      ctx.fillStyle = viridis(Math.max(0.12, t));
      ctx.fillRect(stripX1 - bw, yTop, bw, Math.max(0.8, yH));
    }
    ctx.strokeStyle = grid;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(stripX1, cy - ry);
    ctx.lineTo(stripX1, cy + ry);
    ctx.stroke();
    ctx.fillStyle = label;
    ctx.font = "8.5px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("tilt", stripX0, cy - ry - 1);

    // ---- rot marginal histogram (bottom strip, vertical bars) -----------
    const rotHist = effective.rotHist;
    const rotMax = Math.max(1, ...rotHist);
    for (let i = 0; i < rotHist.length; i++) {
      const c = rotHist[i];
      if (c <= 0) continue;
      const x0 = histL + (i / rotHist.length) * plotW;
      const bw = plotW / rotHist.length - 0.5;
      const bh = (rotHistH * c) / rotMax;
      const t = mxLog > mnLog ? (Math.log10(c + 1) - mnLog) / (mxLog - mnLog) : 0.5;
      ctx.fillStyle = viridis(Math.max(0.12, t));
      ctx.fillRect(x0, rotHistY + rotHistH - bh, Math.max(0.8, bw), bh);
    }
    ctx.strokeStyle = grid;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(histL, rotHistY + rotHistH);
    ctx.lineTo(histL + plotW, rotHistY + rotHistH);
    ctx.stroke();
    // rot tick labels
    ctx.fillStyle = label;
    ctx.font = "8.5px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const deg of [0, 90, 180, 270, 360]) {
      const x = histL + (deg / 360) * plotW;
      ctx.fillText(`${deg}`, x, rotHistY + rotHistH + 10);
    }
    ctx.textAlign = "left";
    ctx.fillText("rot φ", histL + 4, rotHistY + 3);

    // ---- colorbar ---------------------------------------------------------
    const cbX = histL + plotW + 14;
    const cbY = cy - ry;
    const cbH = 2 * ry;
    const steps = 72;
    for (let i = 0; i < steps; i++) {
      const t = 1 - i / (steps - 1);
      ctx.fillStyle = viridis(t);
      ctx.fillRect(cbX, cbY + (i / steps) * cbH, cbW, cbH / steps + 1);
    }
    ctx.strokeStyle = "rgba(125,130,140,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cbX, cbY, cbW, cbH);
    ctx.fillStyle = label;
    ctx.font = "9px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    const fmt = (lg: number) => {
      const val = Math.pow(10, lg) - 1;
      return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val >= 10 ? String(Math.round(val)) : val.toFixed(1);
    };
    ctx.fillText(fmt(mxLog), cbX + cbW + 4, cbY + 7);
    ctx.fillText(fmt((mxLog + mnLog) / 2), cbX + cbW + 4, cbY + cbH / 2 + 3);
    ctx.fillText(fmt(mnLog), cbX + cbW + 4, cbY + cbH - 1);

    // store layout for hover hit-testing
    hoverLayout.current = { cx, cy, rx, ry, rBin: Math.max(1.6, rBin), bins: effective.bins };
  }, [effective, size]);

  const hoverLayout = useRef<{ cx: number; cy: number; rx: number; ry: number; rBin: number; bins: FibBin[] } | null>(null);

  useEffect(() => {
    draw();
  }, [draw]);

  const onMove = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const layout = hoverLayout.current;
    const canvas = canvasRef.current;
    if (!layout || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    let best: HoverInfo | null = null;
    let bestD = Infinity;
    for (const b of layout.bins) {
      if (b.count <= 0) continue;
      const p = projectUnit(b);
      const sx = layout.cx + p.x * layout.rx;
      const sy = layout.cy - p.y * layout.ry;
      const d = (mx - sx) * (mx - sx) + (my - sy) * (my - sy);
      const r = layout.rBin + 3;
      if (d < r * r && d < bestD) {
        bestD = d;
        const rot = (((Math.atan2(b.y, b.x) * 180) / Math.PI) + 360) % 360;
        const tilt = (Math.acos(Math.max(-1, Math.min(1, b.z))) * 180) / Math.PI;
        best = { rot, tilt, count: b.count };
      }
    }
    setHovered(best);
  };

  const occupied = data.bins.filter((b) => b.count > 0).length;
  const anisotropic = data.anisotropy > 2.5;
  const iterLabel = iterationLabel ?? "";

  const body = (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Mollweide projection of ${total.toLocaleString()} particle orientations${symmetry ? `, ${symmetry} symmetry` : ""}`}
        className="block select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHovered(null)}
      />
      {hovered ? (
        <div
          role="status"
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[10px] font-medium tabular-nums text-popover-foreground shadow-md"
        >
          rot {hovered.rot.toFixed(0)}° · tilt {hovered.tilt.toFixed(0)}°
          <span className="ml-1.5 text-teal-600 dark:text-teal-400">
            {hovered.count} ({((hovered.count / Math.max(1, total)) * 100).toFixed(1)}%)
          </span>
        </div>
      ) : null}
    </div>
  );

  if (compact) return body;

  const expandedLabel = expandSym && symMats ? ` · orbit ×${symMats.length}` : "";

  return (
    <section
      aria-label="Orientation distribution (cryoSPARC style)"
      className="rounded-lg border border-teal-600/25 bg-gradient-to-b from-teal-600/5 to-transparent p-3"
    >
      {/* header row */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Globe2 className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          Orientation distribution · Mollweide
        </span>
        {running ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-teal-600/30 bg-teal-600/10 px-1.5 py-px text-[10px] font-medium text-teal-700 dark:text-teal-300">
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-500" />
            </span>
            live
          </span>
        ) : null}
        {symMats ? (
          <button
            type="button"
            onClick={() => setExpandSym((v) => !v)}
            aria-pressed={expandSym}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium transition-colors",
              expandSym
                ? "border-teal-600/60 bg-teal-600/15 text-teal-700 dark:text-teal-300"
                : "border-border/60 bg-muted/40 text-muted-foreground hover:border-teal-600/40 hover:text-teal-700 dark:hover:text-teal-300"
            )}
          >
            <Orbit className="h-3 w-3" aria-hidden="true" />
            {expandSym ? `${symmetry} orbit on` : `apply ${symmetry}`}
          </button>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
          <RadioTower className="h-3 w-3" aria-hidden="true" />
          {total.toLocaleString()} particles{iterLabel ? ` · ${iterLabel}` : ""}
        </span>
      </div>

      {body}

      {/* legend + verdict */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Compass className="h-3 w-3" aria-hidden="true" />
          equal-area projection · log colour scale
        </span>
        <span className="tabular-nums">
          {occupied}/{data.bins.length} bins populated{expandedLabel}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 font-medium",
            anisotropic ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
          )}
        >
          {anisotropic ? (
            <>
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
              anisotropic — resolution ratio {data.anisotropy.toFixed(2)}×
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              near-isotropic — resolution ratio {data.anisotropy.toFixed(2)}×
            </>
          )}
        </span>
      </div>
    </section>
  );
}
