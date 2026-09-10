/**
 * CryoFlow — canvas → PNG export (client).
 *
 * Renders the ACTIVE WORKSPACE as a content-fit poster PNG: the workspace
 * world ([data-canvas="workspace"]) is rasterized with its viewport
 * transform overridden so the whole workflow fits with an even margin,
 * independent of the user's current pan/zoom. A footer strip (project ·
 * workspace · job/link counts · date) is composited underneath — the
 * kind of figure you paste into a slide or a progress report.
 *
 * How it works:
 *   1. html-to-image clones the world node with inlined computed styles
 *      into an SVG <foreignObject>, then rasterizes via <img> → canvas.
 *      `options.style` overrides apply to the CLONE only — the live
 *      canvas never flashes.
 *   2. A discarded warm-up capture is made first: the font-embedding
 *      pipeline (CSSOM walk + woff2 inlining) runs on it and caches, so
 *      the real capture has webfonts on the first try.
 *   3. The raw blob is drawn onto a 2D canvas with a footer strip and
 *      re-exported as the final PNG.
 *
 * CSS custom properties (var(--primary) on SVG strokes, Tailwind theme
 * colors) arrive as inline resolved values on the clone — Chrome renders
 * them (incl. oklch) identically inside the <img>-embedded SVG.
 */

import { toBlob } from "html-to-image";
import type { JobDTO, EdgeDTO } from "./types";
import { copyPngToClipboard } from "./chart-export";

export interface CanvasExportMeta {
  projectName: string;
  workspaceName: string;
  /** active-workspace jobs (the render rule: same filter as the canvas) */
  jobs: Pick<JobDTO, "x" | "y">[];
  edges: EdgeDTO[];
  cardW: number;
  cardH: number;
}

/** workspace units of breathing room around the content bbox */
const EXPORT_PAD = 64;
/** footer strip height in output px */
const FOOTER_H = 52;
/** cap the output at ~16 MP (pixelRatio shrinks beyond that) */
const MAX_OUT_PIXELS = 16e6;

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "canvas"
  );
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** First CSS color in a var() chain that resolves to a real color. */
function cssColor(varName: string, fallback: string): string {
  const raw = getComputedStyle(document.body).getPropertyValue(varName).trim();
  return raw || fallback;
}

export interface CanvasExportResult {
  fileName: string;
  width: number;
  height: number;
  bytes: number;
}

/** One poster rasterization, destination-agnostic: blob + geometry + name.
 *  The download and clipboard doors both consume THIS — one raster, two
 *  destinations (same doctrine as the chart domain's chartPngBlob). Throws
 *  with a user-facing message when the canvas is unmounted, empty, or the
 *  raster fails. */
export interface CanvasPng {
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
}

export async function canvasPngBlob(meta: CanvasExportMeta): Promise<CanvasPng> {
  const world = document.querySelector<HTMLElement>('[data-canvas="workspace"]');
  const section = document.querySelector<HTMLElement>('[data-canvas="viewport"]');
  if (!world) throw new Error("Canvas is not mounted yet — open the Workflow view and retry.");
  if (meta.jobs.length === 0) throw new Error("Nothing to export — the canvas is empty.");

  // content bbox in workspace coordinates (same shape as the canvas' own
  // fit logic: cards only — wires live between them and stay inside)
  const minX = Math.min(...meta.jobs.map((j) => j.x)) - EXPORT_PAD;
  const minY = Math.min(...meta.jobs.map((j) => j.y)) - EXPORT_PAD;
  const maxX = Math.max(...meta.jobs.map((j) => j.x + meta.cardW)) + EXPORT_PAD;
  const maxY = Math.max(...meta.jobs.map((j) => j.y + meta.cardH)) + EXPORT_PAD;
  const bw = Math.ceil(maxX - minX);
  const bh = Math.ceil(maxY - minY);

  // pixel budget → pixelRatio (device pixel ratio for crisp text, capped)
  const dpr = window.devicePixelRatio || 1;
  const pixelRatio = Math.min(dpr * 2, Math.max(1, Math.sqrt(MAX_OUT_PIXELS / (bw * bh))));

  const background = section
    ? getComputedStyle(section).backgroundColor
    : cssColor("--background", "#ffffff");

  const capture = () =>
    toBlob(world, {
      width: bw,
      height: bh,
      pixelRatio,
      backgroundColor: background || "#ffffff",
      // clone-only overrides: undo the live viewport transform and give the
      // 0×0 world real dimensions so the foreignObject has content size
      style: {
        transform: `translate(${-minX}px, ${-minY}px)`,
        transformOrigin: "0 0",
        width: `${bw}px`,
        height: `${bh}px`,
        margin: "0",
      },
    });

  // warm-up: populates html-to-image's embedded-font cache (first capture
  // can otherwise miss webfonts); the blob itself is discarded
  const warm = await capture();
  void warm;

  const raw = await capture();
  if (!raw) throw new Error("Rasterization failed — try zooming to fit and export again.");

  // ---- composite: raster + footer strip ----------------------------------
  const img = await createImageBitmap(raw);
  const outW = img.width;
  const outH = img.height + Math.round(FOOTER_H * pixelRatio);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  // the capture itself (must precede the footer plate — canvas starts
  // transparent and an undrawn region reads as black in most viewers)
  ctx.drawImage(img, 0, 0);

  // footer plate + hairline
  ctx.fillStyle = cssColor("--card", background || "#ffffff");
  ctx.fillRect(0, img.height, outW, outH - img.height);
  ctx.fillStyle = cssColor("--border", "#e5e7eb");
  ctx.fillRect(0, img.height, outW, Math.max(1, pixelRatio));

  // footer text
  const title = `CryoFlow — ${meta.projectName}`;
  const meta_ = `${meta.workspaceName} · ${meta.jobs.length} job${meta.jobs.length === 1 ? "" : "s"} · ${meta.edges.length} link${meta.edges.length === 1 ? "" : "s"} · ${new Date().toLocaleDateString()}`;
  const fontScale = pixelRatio;
  ctx.textBaseline = "middle";
  ctx.fillStyle = cssColor("--foreground", "#0f172a");
  ctx.font = `600 ${13 * fontScale}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textRendering = "geometricPrecision";
  ctx.fillText(title, 16 * fontScale, img.height + FOOTER_H * pixelRatio * 0.5);
  const titleW = ctx.measureText(title).width;
  ctx.fillStyle = cssColor("--muted-foreground", "#64748b");
  ctx.font = `400 ${11 * fontScale}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(meta_, 16 * fontScale + titleW + 12 * fontScale, img.height + FOOTER_H * pixelRatio * 0.5 + 1 * fontScale);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("PNG encoding failed.");

  const fileName = `cryoflow-${slug(meta.projectName)}-${slug(meta.workspaceName)}-${timestamp()}.png`;
  return { blob, width: outW, height: outH, fileName };
}

/**
 * Export the canvas as a poster PNG download. Returns the result for the
 * caller's success toast; throws with a user-facing message on failure.
 */
export async function exportCanvasPng(meta: CanvasExportMeta): Promise<CanvasExportResult> {
  const png = await canvasPngBlob(meta);

  const url = URL.createObjectURL(png.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = png.fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return { fileName: png.fileName, width: png.width, height: png.height, bytes: png.blob.size };
}

/** The clipboard twin of the poster download: SAME raster (canvasPngBlob),
 *  different destination. Resolves false when the browser refuses the
 *  clipboard write (permission-locked / API absent) so the caller can toast
 *  one honest failure pointing at the download door — identical contract to
 *  the chart domain's copy buttons. Throws the same user-facing messages as
 *  the download door for unmounted/empty/failed rasters. */
export async function copyCanvasPng(meta: CanvasExportMeta): Promise<boolean> {
  const png = await canvasPngBlob(meta);
  return copyPngToClipboard(png.blob);
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
