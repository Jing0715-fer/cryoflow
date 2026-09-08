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
 *      <map name> · contour σ level · date, painted beneath the capture.
 *
 * The backing store is CSS-size × devicePixelRatio, so on HiDPI screens
 * the export is naturally supersampled — no manual pixelRatio work needed
 * (unlike html-to-image, which must invent its own).
 */

export interface ViewerExportOptions {
  /** the onscreen WebGL canvas (plugin.canvas3d.canvas) */
  canvas: HTMLCanvasElement;
  /** computed background color of the viewer container (theme-aware) */
  background: string;
  /** map file name for the footer title + download file name */
  mapName: string;
  /** current contour level in σ (footer meta) */
  sigma: number;
}

export interface ViewerExportResult {
  fileName: string;
  width: number;
  height: number;
  bytes: number;
}

/** footer strip height in CSS px (scaled by device ratio at paint time) */
const FOOTER_H = 44;

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

export async function exportViewerPng(opts: ViewerExportOptions): Promise<ViewerExportResult> {
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
  const footerH = Math.round(FOOTER_H * scale);

  const out = document.createElement("canvas");
  out.width = px;
  out.height = canvas.height + footerH;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas 2D context unavailable.");

  octx.drawImage(plate, 0, 0);

  // footer plate + hairline
  octx.fillStyle = cssColor("--card", opts.background || "#ffffff");
  octx.fillRect(0, canvas.height, out.width, footerH);
  octx.fillStyle = cssColor("--border", "#e5e7eb");
  octx.fillRect(0, canvas.height, out.width, Math.max(1, scale));

  const title = `CryoFlow — ${opts.mapName}`;
  const meta = `contour ${opts.sigma.toFixed(2)} σ · ${new Date().toLocaleDateString()}`;
  octx.textBaseline = "middle";
  octx.fillStyle = cssColor("--foreground", "#0f172a");
  octx.font = `600 ${13 * scale}px ui-sans-serif, system-ui, sans-serif`;
  octx.textRendering = "geometricPrecision";
  octx.fillText(title, 16 * scale, canvas.height + footerH * 0.5);
  const titleW = octx.measureText(title).width;
  octx.fillStyle = cssColor("--muted-foreground", "#64748b");
  octx.font = `400 ${11 * scale}px ui-sans-serif, system-ui, sans-serif`;
  octx.fillText(meta, 16 * scale + titleW + 12 * scale, canvas.height + footerH * 0.5 + scale);

  const blob = await new Promise<Blob | null>((res) => out.toBlob(res, "image/png"));
  if (!blob) throw new Error("PNG encoding failed.");

  const fileName = `cryoflow-map-${slug(opts.mapName)}-${timestamp()}.png`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return { fileName, width: out.width, height: out.height, bytes: blob.size };
}
