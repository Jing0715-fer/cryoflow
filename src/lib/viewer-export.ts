/**
 * CryoFlow — Mol* 3D viewer → PNG export (client).
 *
 * Captures the live WebGL canvas (mol* keeps `preserveDrawingBuffer: true`
 * by default, so `toDataURL`/`drawImage` see the current frame at any time)
 * and composites it into a presentation-ready figure:
 *
 *   1. opaque background plate — the WebGL context runs with alpha, the
 *      visible "background" is actually the page behind it; we fill the
 *      export with the viewer container's computed background so the
 *      figure matches what the user sees in BOTH themes.
 *   2. the DOM/SVG overlays (clip wireframe, control bar) are NOT part of
 *      the canvas — by design the export is the clean density figure.
 *   3. footer strip (same visual language as canvas-export.ts): CryoFlow —
 *      <map name> · contour σ level · date, painted beneath the capture —
 *      plus an optional LEGEND line: one color chip + label per overlaid
 *      comparison map, so multi-map figures are self-describing without
 *      the reader needing the app.
 *
 * The backing store is CSS-size × devicePixelRatio × mol* pixelScale; the
 * capture flow briefly doubles the plugin's pixelScale (2× supersampling,
 * see captureView in molstar-embed.tsx) so figures stay razor-sharp even
 * on dpr-1 displays — the footer scales itself off the same ratio.
 */

export interface ViewerExportOptions {
  /** the onscreen WebGL canvas (plugin.canvas3d.canvas) */
  canvas: HTMLCanvasElement;
  /** computed background color of the viewer container (theme-aware) */
  background: string;
  /** map file name for the footer title + download file name */
  mapName: string;
  /** custom figure caption — replaces the default "CryoFlow — <mapName>"
   *  title when non-empty (publication figure captions live here) */
  caption?: string;
  /** current contour level in σ (footer meta) */
  sigma: number;
  /** figure annotations beyond the contour level — the slice/clip state
   *  the view is showing ("slice Y 50%", "clip X 60% · flip", …). Joined
   *  into the footer meta so the exported figure documents HOW it was
   *  cut, not just WHAT threshold it used. */
  annotations?: string[];
  /** color legend for overlaid comparison maps (Layers panel state) —
   *  painted as a second footer line of chips + labels */
  legend?: Array<{ color: string; label: string }>;
}

export interface ViewerExportResult {
  fileName: string;
  width: number;
  height: number;
  bytes: number;
}

/** Everything the footer painter needs — positions in backing-store px,
 *  fonts/margins scaled by `scale` (backing / CSS px ratio). */
export interface FigureFooterSpec {
  /** total figure width in backing px */
  width: number;
  /** plate height in backing px — the footer strip starts at this y */
  plateHeight: number;
  /** footer strip height in backing px (already legend-extended + scaled) */
  footerH: number;
  /** backing / CSS px ratio for font + margin scaling */
  scale: number;
  title: string;
  meta: string;
  legend: Array<{ color: string; label: string }>;
}

/** footer strip height in CSS px (scaled by device ratio at paint time) */
const FOOTER_H = 44;
/** extra footer height when a legend line is present (CSS px) */
const LEGEND_H = 22;

/** footer strip height in backing px for a given scale + legend presence —
 *  the video compositor sizes its canvas with the same math as the PNG one */
export function figureFooterHeightPx(scale: number, legendCount: number): number {
  return Math.round((FOOTER_H + (legendCount > 0 ? LEGEND_H : 0)) * scale);
}

/** paint the figure footer strip (card plate + hairline + title/meta line
 *  + optional legend row) onto a 2d context — shared verbatim by the
 *  static PNG compositor and the turntable video compositor so every
 *  sink renders the pixel-identical footer */
export function drawFigureFooter(ctx: CanvasRenderingContext2D, spec: FigureFooterSpec): void {
  const { width, plateHeight, footerH, scale } = spec;
  const legend = spec.legend.filter((l) => l.label);

  // footer plate + hairline
  ctx.fillStyle = cssColor("--card", "#ffffff");
  ctx.fillRect(0, plateHeight, width, footerH);
  ctx.fillStyle = cssColor("--border", "#e5e7eb");
  ctx.fillRect(0, plateHeight, width, Math.max(1, scale));

  ctx.textBaseline = "middle";
  ctx.fillStyle = cssColor("--foreground", "#0f172a");
  ctx.font = `600 ${13 * scale}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textRendering = "geometricPrecision";
  ctx.fillText(spec.title, 16 * scale, plateHeight + footerH * 0.5 - (legend.length ? (LEGEND_H * scale) / 2 : 0));
  const titleW = ctx.measureText(spec.title).width;
  ctx.fillStyle = cssColor("--muted-foreground", "#64748b");
  ctx.font = `400 ${11 * scale}px ui-sans-serif, system-ui, sans-serif`;
  // inline after the title; when the annotated meta would overflow the
  // right edge, right-align it instead (small canvases + long clip chains)
  const metaX = 16 * scale + titleW + 12 * scale;
  const metaW = ctx.measureText(spec.meta).width;
  const margin = 16 * scale;
  const metaY = plateHeight + footerH * 0.5 + scale - (legend.length ? (LEGEND_H * scale) / 2 : 0);
  const inline = metaX + metaW <= width - margin;
  ctx.fillText(spec.meta, inline ? metaX : width - margin - metaW, metaY);

  // ---- legend line: one chip + label per overlaid map -------------------
  // Truncates with an ellipsis chip-label when the row would overflow —
  // a legend that overflows the figure is worse than a short one.
  if (legend.length) {
    const legendY = plateHeight + (FOOTER_H + LEGEND_H * 0.5) * scale;
    const chip = 9 * scale;
    const gapChip = 4 * scale;
    const gapGroup = 14 * scale;
    ctx.font = `500 ${10 * scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    let x = 16 * scale;
    const rightEdge = width - 16 * scale;
    for (let i = 0; i < legend.length; i++) {
      const item = legend[i];
      const last = i === legend.length - 1;
      const labelW = ctx.measureText(item.label).width;
      const groupW = chip + gapChip + labelW;
      const needsEllipsis =
        !last && x + groupW + gapGroup + ctx.measureText("…").width > rightEdge;
      if (x + (needsEllipsis ? ctx.measureText("…").width : groupW) > rightEdge) {
        ctx.fillStyle = cssColor("--muted-foreground", "#64748b");
        ctx.fillText("…", x, legendY);
        break;
      }
      // chip (rounded square in the map's own color) + label
      const r = 2 * scale;
      const cy = legendY - chip / 2;
      ctx.fillStyle = item.color || cssColor("--primary", "#0d9488");
      ctx.beginPath();
      ctx.roundRect(x, cy, chip, chip, r);
      ctx.fill();
      ctx.fillStyle = cssColor("--muted-foreground", "#64748b");
      ctx.fillText(item.label, x + chip + gapChip, legendY);
      if (needsEllipsis) {
        ctx.fillText("…", x + groupW, legendY);
        break;
      }
      x += groupW + gapGroup;
    }
  }
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "map"
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

/** footer title + meta line — shared by the static PNG compositor and the
 *  turntable video compositor so both sinks label figures identically */
export function figureTitleMeta(opts: Pick<ViewerExportOptions, "mapName" | "caption" | "sigma" | "annotations">): {
  title: string;
  meta: string;
} {
  const title = opts.caption?.trim() ? opts.caption.trim() : `CryoFlow — ${opts.mapName}`;
  const notes = (opts.annotations ?? []).filter(Boolean);
  const meta = [`contour ${opts.sigma.toFixed(2)} σ`, ...notes, new Date().toLocaleDateString()].join(" · ");
  return { title, meta };
}

/** composed figure before any sink (download / clipboard) */
interface ComposedFigure {
  blob: Blob;
  width: number;
  height: number;
}

/** compose the presentation figure (plate + footer) without any sink —
 *  shared by the download and clipboard-copy paths */
async function composeViewerFigure(opts: ViewerExportOptions): Promise<ComposedFigure> {
  const { canvas } = opts;
  if (!canvas.width || !canvas.height) {
    throw new Error("The 3D view is not rendered yet — wait for the map and retry.");
  }

  // ---- capture plate: background + WebGL frame ----------------------------
  // background FIRST (a 2D canvas starts fully transparent — an undrawn
  // region reads as black in most viewers; see canvas-export.ts #27)
  const plate = document.createElement("canvas");
  plate.width = canvas.width;
  plate.height = canvas.height;
  const ctx = plate.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  ctx.fillStyle = opts.background || cssColor("--background", "#ffffff");
  ctx.fillRect(0, 0, plate.width, plate.height);
  ctx.drawImage(canvas, 0, 0);

  // ---- composite: plate + footer strip ------------------------------------
  const px = canvas.width; // backing-store px are already HiDPI-supersampled

  // footer scale: match the capture's device pixel ratio (backing / CSS size)
  const scale = px / Math.max(1, canvas.clientWidth || px);
  const legend = (opts.legend ?? []).filter((l) => l.label);
  const footerH = figureFooterHeightPx(scale, legend.length);

  const out = document.createElement("canvas");
  out.width = px;
  out.height = canvas.height + footerH;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas 2D context unavailable.");

  octx.drawImage(plate, 0, 0);
  const { title, meta } = figureTitleMeta(opts);
  drawFigureFooter(octx, {
    width: out.width,
    plateHeight: canvas.height,
    footerH,
    scale,
    title,
    meta,
    legend,
  });

  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/png"));
  if (!blob) throw new Error("PNG encoding failed.");
  return { blob, width: out.width, height: out.height };
}

export async function exportViewerPng(opts: ViewerExportOptions): Promise<ViewerExportResult> {
  const { blob, width, height } = await composeViewerFigure(opts);

  const fileName = `cryoflow-map-${slug(opts.mapName)}-${timestamp()}.png`;
  downloadViewerBlob(blob, fileName);

  return { fileName, width, height, bytes: blob.size };
}

/** download any produced blob (PNG figure, WebM turntable clip, …) via a
 *  transient anchor — the one sink every capture path shares */
export function downloadViewerBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** file-name slug + timestamp helpers shared by viewer export sinks
 *  (turntable clips name themselves the same way as PNG figures) */
export function viewerFileSlug(s: string): string {
  return slug(s);
}

export function viewerFileTimestamp(): string {
  return timestamp();
}

/** true when the async-clipboard API can take a PNG in this browser */
export function canCopyImageToClipboard(): boolean {
  return (
    typeof window !== "undefined" &&
    !!navigator.clipboard?.write &&
    typeof window.ClipboardItem !== "undefined"
  );
}

/** copy the composed figure to the system clipboard as image/png — slides
 *  straight into slides, docs and chats; throws when the context refuses
 *  (permission / unfocused window), which callers surface as a toast */
export async function copyViewerPng(opts: ViewerExportOptions): Promise<{ width: number; height: number; bytes: number }> {
  const { blob, width, height } = await composeViewerFigure(opts);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  return { width, height, bytes: blob.size };
}
