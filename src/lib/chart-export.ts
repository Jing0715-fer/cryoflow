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

/** Rasterize the chart's own <svg> to a 2× PNG. Returns false when the
 *  root carries no SVG (chart still loading) so the caller can toast an
 *  honest miss instead of silently writing a blank file. */
export async function exportChartPng(
  root: HTMLElement | null,
  filename: string,
  background = getComputedStyle(document.body).backgroundColor || "#09090b",
): Promise<boolean> {
  // the chart's DRAWING SURFACE, not the first svg — every chart header
  // carries 14px icon svgs that would otherwise rasterize into a 651-byte
  // "success". Biggest area wins (recharts surface, or the hand-rolled
  // polar heatmap), with a 40px floor so icons never qualify.
  const svgs = root ? Array.from(root.querySelectorAll("svg")) : [];
  const svg = svgs
    .map((s) => ({ s, r: s.getBoundingClientRect() }))
    .filter((x) => x.r.width >= 40 && x.r.height >= 40)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0]?.s;
  if (!(svg instanceof SVGSVGElement)) return false;
  const rect = svg.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;

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
  if (!ctx) return false;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) return false;
  downloadBlob(blob, `${filename}.png`);
  return true;
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
