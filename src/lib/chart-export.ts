"use client";

/**
 * Per-chart data export — CSV rows + PNG snapshot, shared by every results
 * chart. One pipeline so all exports agree on naming, quoting and toast
 * feedback; each chart only supplies its data getter and a DOM root.
 *
 * CSV: the chart's own processed rows (what the curve draws IS what the
 * file holds — no re-derivation, no second truth).
 * PNG: the chart's rendered SVG serialized onto a 2× canvas. Recharts
 * paints geometry with attributes but text/line styling rides on CSS
 * classes and custom properties that die in a serialized <svg>, so the
 * clone gets computed stroke/fill/font inlined element-by-element before
 * rasterizing (bounded walk — chart SVGs are small).
 */

/** Trigger a client-side download for an in-memory blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke on the next tick — Chrome keeps the download alive once the
  // navigation has started, and a same-tick revoke can race it
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type CsvCell = string | number | null | undefined;
export type CsvRow = Record<string, CsvCell>;

/** RFC-4180-ish CSV: quote anything holding a comma/quote/newline, double
 *  the embedded quotes, empty string for nullish cells. */
export function rowsToCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v: CsvCell): string => {
    if (v == null) return "";
    const s = typeof v === "number" ? String(v) : v;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [keys.join(",")];
  for (const r of rows) lines.push(keys.map((k) => cell(r[k])).join(","));
  return lines.join("\n") + "\n";
}

export function downloadCsv(filename: string, rows: CsvRow[]): boolean {
  if (rows.length === 0) return false;
  const csv = rowsToCsv(rows);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
  return true;
}

/** Inline the computed paint that a serialized <svg> would otherwise lose:
 *  stroke/fill (custom properties), font-family/size/weight, opacity. */
function inlineComputed(clone: SVGElement, source: Element): void {
  const cs = window.getComputedStyle(source);
  for (const prop of [
    "stroke",
    "fill",
    "stroke-width",
    "font-family",
    "font-size",
    "font-weight",
    "opacity",
    "stroke-dasharray",
  ] as const) {
    const v = cs.getPropertyValue(prop);
    // `fill: none` / transparent must survive too — only skip empties
    if (v && v !== "") clone.style.setProperty(prop, v);
  }
  const srcKids = source.children;
  const cloneKids = clone.children;
  for (let i = 0; i < srcKids.length && i < cloneKids.length; i++) {
    if (cloneKids[i] instanceof SVGElement && srcKids[i] instanceof Element) {
      inlineComputed(cloneKids[i] as SVGElement, srcKids[i]);
    }
  }
}

/** Rasterize the chart's own <svg> to a 2× PNG blob, or null when the
 *  root carries no SVG (chart still loading) so the caller can toast an
 *  honest miss instead of silently producing a blank artifact. Shared by
 *  the download button and the copy-to-clipboard button — one raster,
 *  two destinations. */
export async function chartPngBlob(
  root: HTMLElement | null,
  background = getComputedStyle(document.body).backgroundColor || "#09090b",
): Promise<Blob | null> {
  // the chart's DRAWING SURFACE, not the first svg — every chart header
  // carries 14px icon svgs that would otherwise rasterize into a 651-byte
  // "success". Biggest area wins (recharts surface, or the hand-rolled
  // polar heatmap), with a 40px floor so icons never qualify.
  const svgs = root ? Array.from(root.querySelectorAll("svg")) : [];
  const svg = svgs
    .map((s) => ({ s, r: s.getBoundingClientRect() }))
    .filter((x) => x.r.width >= 40 && x.r.height >= 40)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]?.s;
  if (!(svg instanceof SVGSVGElement)) return null;
  const rect = svg.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return null;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));
  clone.style.setProperty("background", background);
  inlineComputed(clone, svg);

  const xml = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("svg raster failed"));
    img.src = url;
  });

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
}

/** Rasterize the chart's own <svg> to a 2× PNG and hand it to the browser
 *  as a download. Thin wrapper over chartPngBlob — returns false when the
 *  chart has not rendered yet so the caller can toast an honest miss. */
export async function exportChartPng(
  root: HTMLElement | null,
  filename: string,
): Promise<boolean> {
  const blob = await chartPngBlob(root);
  if (!blob) return false;
  downloadBlob(blob, `${filename}.png`);
  return true;
}

/** The PASTE dialect of the chart's rows. CSV quotes, TSV doesn't —
 *  spreadsheets split pasted text on tabs natively, so the honest move is
 *  tabs + replacing the two row-breaking characters (tab/newline) with a
 *  space rather than inventing a quoting scheme no paste target parses.
 *  No trailing newline either: a pasted selection should not mint an
 *  empty last row in the sheet. */
export function rowsToTsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v: CsvCell): string => {
    if (v == null) return "";
    return (typeof v === "number" ? String(v) : v).replace(/[\t\n]+/g, " ");
  };
  return [keys.join("\t"), ...rows.map((r) => keys.map((k) => cell(r[k])).join("\t"))].join("\n");
}

/** Clipboard write is a PERMISSION, not a right: the API can be absent
 *  (insecure context), unsupported (no ClipboardItem), or denied by the
 *  browser. All three collapse into `false` so the caller toasts one
 *  honest failure and points at the download button instead. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyPngToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Slug a chart/job name into a filename fragment: lowercase, spaces and
 *  slashes to dashes, drop everything else unsafe. */
export function fileSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
