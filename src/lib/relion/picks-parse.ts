/**
 * CryoFlow — the Picks plane's pure star parsers (SERVER SAFE, no I/O).
 *
 * t957 — extracted verbatim from the picks route (and denoise-pairs'
 * micrograph-rows reader) so the statcache riders' computes are
 * live-importable by the census instruments — the t956 outputs-list
 * precedent: the pure well lives in the lib, the route owns the I/O.
 *
 * The star-reading doctrine every parser here follows: columns are read
 * BY LABEL out of the data_micrographs block, never by position — the
 * optics sibling's columns must not shadow the names.
 *
 * Every function here is pure (text → shape) and returns SHARED shapes
 * when ridden through cachedFileCompute — consumers read, none mutate.
 */

/** `micrographs/mic_001.mrc` / `mic_001.mrcs` → `mic_001` — the identity
 *  the per-micrograph coord stars speak (`mic_001_autopick.star`). */
export function bareMicName(cell: string): string {
  const base = cell.replace(/^\.?\//, "").split("/").pop() ?? cell;
  return base.replace(/\.(mrc|mrcs|tif|tiff)$/i, "");
}

/**
 * The pure manualpick.star parse (text → picks grouped per micrograph):
 * the picks route's statcache rider compute. Columns X, Y, mic-name;
 * comment/label/optics rows skipped.
 */
export function parseManualpickStarText(text: string): Map<string, [number, number][]> {
  const perMic = new Map<string, [number, number][]>();
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith("#") || t.startsWith("_") || t === "loop_" || t.startsWith("data_")) continue;
    const cells = t.split(/\s+/);
    if (cells.length < 3) continue;
    const x = parseFloat(cells[0]);
    const y = parseFloat(cells[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const mic = cells[2].replace(/^\.?\//, "");
    let arr = perMic.get(mic);
    if (!arr) {
      arr = [];
      perMic.set(mic, arr);
    }
    arr.push([x, y]);
  }
  return perMic;
}

/**
 * The pure per-file autopick coord-star parse (text → shape): the picks
 * route's statcache rider compute. Returns null when the text is not a
 * coord star (no _rlnCoordinateX), lacks the X/Y labels, or carries zero
 * finite picks — the caller skips nulls. Each file's header declares its
 * own column order (RELION 5 writes X, Y, FOM, class — but the loop is
 * read by label, not by position, so a file without the FOM column
 * still parses with honest null FOMs).
 */
export function parseAutopickCoordText(
  text: string
): { picks: [number, number][]; foms: (number | null)[] } | null {
  if (!text.includes("_rlnCoordinateX")) return null; // not a coord star
  // column order from the label block
  const labels = new Map<string, number>();
  const rows: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t || t === "loop_" || t.startsWith("data_")) continue;
    if (t.startsWith("#")) continue;
    if (t.startsWith("_")) {
      const m = t.match(/^(\S+)\s+#(\d+)$/);
      if (m) labels.set(m[1], Number(m[2]) - 1);
      continue;
    }
    rows.push(t.split(/\s+/));
  }
  const ix = labels.get("_rlnCoordinateX");
  const iy = labels.get("_rlnCoordinateY");
  if (ix == null || iy == null) return null;
  const ifom = labels.get("_rlnAutopickFigureOfMerit");
  const picks: [number, number][] = [];
  const foms: (number | null)[] = [];
  for (const cells of rows) {
    const x = parseFloat(cells[ix]);
    const y = parseFloat(cells[iy]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    picks.push([x, y]);
    if (ifom != null && cells[ifom] != null) {
      const v = parseFloat(cells[ifom]);
      foms.push(Number.isFinite(v) ? v : null);
    } else {
      foms.push(null);
    }
  }
  if (picks.length === 0) return null;
  return { picks, foms };
}

/**
 * The pure catalogue-star parse (text → bare mic names): the picks
 * route's statcache rider compute. Reads _rlnMicrographName (or the
 * NoDW twin) BY LABEL out of the data_micrographs block; the column
 * number MUST be captured from group 2 — a bare #\d+ yields
 * Number(undefined) = NaN and every row is silently dropped (the t433
 * live-QA lesson, caught by the empty-law surgery probe).
 */
export function parseCatalogMicNamesText(text: string): string[] {
  const names: string[] = [];
  const labels = new Map<string, number>();
  let inLoop = false;
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith("data_")) {
      // the micrographs block follows its optics sibling — reset
      // the label map so optics columns cannot shadow mic names
      inLoop = t.startsWith("data_micrographs");
      if (inLoop) labels.clear();
      continue;
    }
    if (t === "loop_") continue;
    if (t.startsWith("_")) {
      if (inLoop) {
        const m = t.match(/^(\S+)\s+#(\d+)$/);
        if (m) labels.set(m[1], Number(m[2]) - 1);
      }
      continue;
    }
    if (t.startsWith("#")) continue;
    const ix =
      labels.get("_rlnMicrographName") ??
      labels.get("_rlnMicrographNameNoDW");
    if (ix == null) continue;
    const cell = t.split(/\s+/)[ix];
    if (cell) names.push(bareMicName(cell));
  }
  return names;
}

/**
 * The pure text→names parse for denoise-pairs' micrograph-rows reader:
 * the statcache rider compute. Only the data_micrographs block speaks —
 * the optics sibling's columns must not shadow the names.
 */
export function parseMicrographRowsText(text: string): string[] {
  let inMic = false;
  let inLoop = false;
  let col = -1;
  const names: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) continue;
    if (t.startsWith("data_")) {
      inMic = t === "data_micrographs";
      inLoop = false;
      col = -1;
      continue;
    }
    if (!inMic) continue;
    if (t === "loop_") {
      inLoop = true;
      continue;
    }
    if (t.startsWith("_rln")) {
      if (inLoop && col < 0) {
        const m = /^(_rln\S+)(?:\s+#(\d+))?\s*$/.exec(t);
        if (m && m[1] === "_rlnMicrographName")
          col = m[2] ? parseInt(m[2], 10) - 1 : 0;
      }
      continue;
    }
    if (t.startsWith("#")) continue;
    if (!inLoop || col < 0) continue;
    const cells = t.split(/\s+/);
    if (cells[col]) names.push(cells[col]);
  }
  return names;
}
