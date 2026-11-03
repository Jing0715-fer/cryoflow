/**
 * The particles star's PURE reader (t1101 — the #8 deep band's second
 * seat): the text→shape halves of /api/jobs/[id]/particles, extracted
 * from the route so the whole decode can ride the statcache with its
 * parse.
 *
 * The t904 cure cached the PARSE (13k rows of text re-split per request);
 * the decode that followed was still paid IN FULL on every page fetch —
 * and its rows→records pass is just as pure as the parse it fed from:
 * image-name forms, mic relativization, coordinate/fom/res reads — every
 * bit of it a function of (star text, workdir). Only the stack OWNERSHIP
 * walk (existsSync on stack files, the upstream BFS, the DB) touches the
 * world outside the text — that half stays per-request in the route (the
 * t904 policy line, unchanged: FS state is the mtime key's blind spot).
 *
 * The laws:
 *   - PURE and node-runnable: no fs, no db, no clock — text and strings
 *     in, records out; the same bytes answer the same, every time;
 *   - the shapes are the route's own historic shapes, moved verbatim
 *     (the split is a refactor — the unit pins byte-parity with the old
 *     inline mapping);
 *   - the honest silences stay: an unparseable _rlnImageName cell skips
 *     its row (the route's empty-decoded door keeps the 400).
 */

import path from "path";

/** One raw data_particles row: the split cells + the frozen label→column
 * map (the first row's order freezes the mapping — the CTF route's own
 * approach). */
export interface ParticleStarRow {
  cells: string[];
  labels: Record<string, number>;
}

/** The data_optics scalars the route has always surfaced. */
export interface ParticlesOptics {
  pixelSize: number | null;
  voltage: number | null;
  cs: number | null;
  q0: number | null;
  boxSize: number | null;
}

/** The pure decode's row: everything the text alone can answer. The
 * stack OWNERSHIP (ownerJobId + workdir-relative stackRel) is the
 * route's per-request pass — it needs the filesystem. stackRaw carries
 * the untouched _rlnImageName stack string so the route's absent-stack
 * fallback keeps its historic bytes (relativize of the RAW form). */
export interface DecodedParticleRow {
  mic: string;
  name: string;
  stackAbs: string;
  stackRaw: string;
  idx1: number;
  x: number;
  y: number;
  fom: number | null;
  maxRes: number | null;
}

/**
 * Block-aware parser: reads data_optics scalars + the data_particles loop
 * into flat row records. Reuses the label-column mapping approach used by
 * the CTF route (first row freezes the column order). Moved verbatim from
 * the route (t904 — pure text→shape so the call site can ride the file
 * compute cache under the route's own particles compute id).
 */
export function parseParticlesStarText(text: string): {
  optics: ParticlesOptics;
  rows: ParticleStarRow[];
} {
  const lines = text.split(/\r?\n/);

  const optics: ParticlesOptics = {
    pixelSize: null,
    voltage: null,
    cs: null,
    q0: null,
    boxSize: null,
  };

  // --- data_optics scalars (single-row loop) ---
  let inOptics = false;
  let opticsLabels: Record<string, number> | null = null;
  let opticsDone = false;

  // --- data_particles rows ---
  const rows: ParticleStarRow[] = [];
  let inParticles = false;
  let labels: Record<string, number> | null = null;

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;

    if (t.startsWith("data_")) {
      const block = t.slice(5).trim();
      inOptics = block === "optics";
      inParticles = block === "particles";
      opticsLabels = null;
      labels = null;
      if (inParticles) opticsDone = true;
      continue;
    }
    if (t.startsWith("#") || t === "loop_") continue;

    if (inOptics && !opticsDone) {
      if (t.startsWith("_")) {
        opticsLabels ??= {};
        const m = t.match(/^(\S+)\s+#(\d+)$/);
        if (m) opticsLabels[m[1]] = Number(m[2]) - 1;
      } else if (opticsLabels) {
        const cells = t.split(/\s+/);
        const num = (label: string) => {
          const i = opticsLabels![label];
          if (i == null || i >= cells.length) return null;
          const v = parseFloat(cells[i]);
          return Number.isFinite(v) ? v : null;
        };
        optics.pixelSize = num("_rlnImagePixelSize") ?? optics.pixelSize;
        optics.voltage = num("_rlnVoltage") ?? optics.voltage;
        optics.cs = num("_rlnSphericalAberration") ?? optics.cs;
        optics.q0 = num("_rlnAmplitudeContrast") ?? optics.q0;
        optics.boxSize = num("_rlnImageSize") ?? optics.boxSize;
      }
      continue;
    }

    if (inParticles) {
      if (t.startsWith("_")) {
        labels ??= {};
        const m = t.match(/^(\S+)\s+#(\d+)$/);
        if (m) labels[m[1]] = Number(m[2]) - 1;
      } else if (labels) {
        const cells = t.split(/\s+/);
        if (cells.length >= Object.keys(labels).length) rows.push({ cells, labels });
      }
    }
  }
  return { optics, rows };
}

/**
 * Decode an _rlnImageName cell → { stack, idx (1-based) }.
 * RELION 5 writes "00000007@/abs/path/stack.mrcs" (index first); some
 * tools write "stack.mrcs@00000007". Handle both. Moved verbatim.
 */
export function parseImageName(v: string): { stack: string; idx: number } | null {
  const at = v.lastIndexOf("@");
  if (at < 0) return null;
  const head = v.slice(0, at).replace(/^\.?\//, "");
  const tail = v.slice(at + 1);
  // index-first form: head is digits, tail is the stack path
  if (/^\d+$/.test(head) && tail.length > 0) {
    const idx = parseInt(head, 10);
    if (Number.isFinite(idx) && idx > 0) return { stack: tail, idx };
  }
  // path-first form: tail is digits
  const idx = parseInt(tail, 10);
  if (/^\d+$/.test(tail) && head.length > 0 && Number.isFinite(idx) && idx > 0) {
    return { stack: head, idx };
  }
  return null;
}

/** Absolutize-then-relativize: only paths inside workdir stay relative,
 * others are kept as written (the file route will reject them). Moved
 * verbatim from the route. */
export function relativizePath(workdir: string, p: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(workdir, p.replace(/^\.?\//, ""));
  if (abs === workdir) return ".";
  if (abs.startsWith(workdir + path.sep)) return path.relative(workdir, abs);
  // outside the workdir — keep as-is (the file route will reject it)
  return p.replace(/^\.?\//, "");
}

const cellNum = (c: string | undefined): number | null => {
  if (c == null) return null;
  const v = parseFloat(c);
  return Number.isFinite(v) ? v : null;
};

/**
 * The PURE decode: rows → typed records, every field a function of the
 * text (t1101's split — the per-row half of the old inline loop). The
 * caller adds the stack ownership (ownerJobId/stackRel) per-request over
 * the DISTINCT stacks — one existsSync per stack, not per row (the t904
 * memo's law, unchanged). Unparseable image-name cells skip their row.
 */
export function decodeParticlesRows(
  rows: readonly ParticleStarRow[],
  workdir: string
): DecodedParticleRow[] {
  const decoded: DecodedParticleRow[] = [];
  for (const r of rows) {
    const imgCell = r.cells[r.labels["_rlnImageName"]];
    const parsed = imgCell ? parseImageName(imgCell) : null;
    if (!parsed) continue;
    const micCell = r.cells[r.labels["_rlnMicrographName"]] ?? "";
    const mic = relativizePath(workdir, micCell);
    const stackAbs = path.isAbsolute(parsed.stack)
      ? parsed.stack
      : path.resolve(workdir, parsed.stack.replace(/^\.?\//, ""));
    decoded.push({
      mic,
      name: path.basename(mic),
      stackAbs,
      stackRaw: parsed.stack,
      idx1: parsed.idx,
      x: cellNum(r.cells[r.labels["_rlnCoordinateX"]]) ?? 0,
      y: cellNum(r.cells[r.labels["_rlnCoordinateY"]]) ?? 0,
      fom: cellNum(r.cells[r.labels["_rlnCtfFigureOfMerit"]]),
      maxRes: cellNum(r.cells[r.labels["_rlnCtfMaxResolution"]]),
    });
  }
  return decoded;
}

