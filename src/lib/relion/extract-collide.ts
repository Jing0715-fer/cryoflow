/**
 * CryoFlow — pre-dispatch collision scan for particle extraction (t334).
 *
 * The field report this module exists for: a copied extraction job died
 * 83% through 1034 micrographs at relion_preprocess's image.h:1534 —
 * "write: target and source objects have different size". The write is
 * the PER-MICROGRAPH particle stack: RELION composes
 *
 *     stack = --part_dir + <micrograph name minus its extension> + ".mrcs"
 *
 * (preprocessing.cpp: fn_output_img_root = fn_part_dir +
 * fn_post.withoutExtension(), then + ".mrcs"), the FIRST particle of a
 * micrograph replaces that path blindly, and every later particle
 * APPENDS — the append reads the file already on disk and REFUSES when
 * its dimensions differ. One run has one box size, so a mid-run size
 * clash always means the stack path was occupied by another writer:
 *
 *   - the SAME micrograph listed twice in the input STAR — in an array
 *     split (the round-robin slices by ROW) the two copies land in
 *     different shards and two processes write the same .mrcs at the
 *     same moment, racing overwrites against appends until a header
 *     read catches the file mid-rewrite (the exact Beijing crash shape;
 *     single-process it "only" duplicates the particles in the output
 *     star — a silent data-integrity bug this scan also kills);
 *
 *   - TWO DIFFERENT micrograph names that compose the SAME stack path —
 *     RELION strips the extension and appends ".mrcs", so "X.mrc" and
 *     "X.mrcs" (and extensionless "X", and "X.tif"…) ALL write
 *     "<part_dir>X.mrcs". A dataset holding both a .mrc and its .mrcs
 *     twin under one base name — the user's *_Fractions_DW files come
 *     in both extensions across sessions — collides by construction.
 *
 * The scan is PURE (the t326/t327/t320 zero-import recipe: client,
 * server and test share one classification) and deliberately
 * conservative: it only speaks when it can name the colliding rows, and
 * it returns null for a STAR with no _rlnMicrographName column at all
 * (not an extraction-shaped input — the caller degrades honestly).
 */

export interface ExtractStackClash {
  /** The stack path RELION would write, relative to --part_dir
   * (e.g. "micrographs/20241031_..._Fractions_DW"). */
  stack: string;
  /** The distinct micrograph names that all compose this stack. */
  names: string[];
}

export interface ExtractCollisionReport {
  /** Data rows scanned across every loop carrying _rlnMicrographName. */
  rows: number;
  /** Micrograph names listed more than once (deduped, first-seen order). */
  duplicates: string[];
  /** Groups of DISTINCT names that compose the same stack path. */
  clashes: ExtractStackClash[];
}

/**
 * Strip RELION's pipeliner prefix ("<Type>/jobNNN/") and the final
 * extension — the two transformations preprocessing.cpp applies when it
 * composes the per-micrograph stack path (decomposePipelineFileName +
 * withoutExtension). "MotionCor/job002/micrographs/foo.mrc" and
 * "micrographs/foo.mrcs" both key to "micrographs/foo".
 */
const PIPELINE_JOB_PREFIX_RE = /^(?:[A-Za-z0-9_.\-]+\/)?job\d{3,}\//;

export function extractStackKey(micName: string): string {
  let n = micName;
  const m = PIPELINE_JOB_PREFIX_RE.exec(n);
  if (m) n = n.slice(m[0].length);
  const slash = n.lastIndexOf("/");
  const dot = n.lastIndexOf(".");
  // a trailing dot belongs to no segment; a dot before the last slash is
  // part of a directory name, not an extension
  if (dot > slash + 1) n = n.slice(0, dot);
  return n;
}

/** Quote-aware line tokenizer — the same semantics as the platform's
 * other STAR readers (quotes strip, `#` ends the line). */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let quote: string | null = null;
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "#") break;
    if (ch === " " || ch === "\t" || ch === "\r") {
      if (cur.length > 0) {
        tokens.push(cur);
        cur = "";
      }
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) tokens.push(cur);
  return tokens;
}

/**
 * Scan a micrographs/particles STAR for names that would collide on the
 * same per-micrograph particle stack. Returns null when the STAR carries
 * no _rlnMicrographName column (not extraction-shaped — the caller
 * skips the guard, exactly like the CTF byte-gate skips a cluster-only
 * twin).
 */
export function scanExtractCollisions(text: string): ExtractCollisionReport | null {
  const counts = new Map<string, number>();
  const order: string[] = [];
  let sawColumn = false;

  let inLoop = false;
  let headerPhase = false;
  let columns: string[] = [];
  let micIdx = -1;
  let pending: string[] = [];

  const flushLoop = () => {
    inLoop = false;
    headerPhase = false;
    columns = [];
    micIdx = -1;
    pending = [];
  };

  for (const rawLine of text.split("\n")) {
    const tokens = tokenize(rawLine);
    if (tokens.length === 0) continue;
    const head = tokens[0];
    if (head.startsWith("data_")) {
      flushLoop();
      continue;
    }
    if (!inLoop) {
      if (head === "loop_") {
        inLoop = true;
        headerPhase = true;
      }
      continue;
    }
    if (headerPhase) {
      if (head.startsWith("_")) {
        // "_rlnMicrographName #1" — the column name rides before the space
        columns.push(head);
        if (head === "_rlnMicrographName") micIdx = columns.length - 1;
        continue;
      }
      headerPhase = false; // first non-column line: data rows begin
    }
    if (micIdx >= 0 && !head.startsWith("_")) {
      const name = tokens[micIdx];
      if (name != null && name.length > 0) {
        sawColumn = true;
        const n = counts.get(name) ?? 0;
        counts.set(name, n + 1);
        if (n === 0) order.push(name);
      }
    }
  }
  if (!sawColumn) return null;

  const duplicates = order.filter((n) => (counts.get(n) ?? 0) > 1);
  const byKey = new Map<string, string[]>();
  for (const n of order) {
    const key = extractStackKey(n);
    const group = byKey.get(key);
    if (group) group.push(n);
    else byKey.set(key, [n]);
  }
  const clashes: ExtractStackClash[] = [];
  for (const [key, names] of byKey) {
    if (names.length > 1) clashes.push({ stack: key, names });
  }
  return {
    rows: order.reduce((acc, n) => acc + (counts.get(n) ?? 0), 0),
    duplicates,
    clashes,
  };
}

/** Render the first few collision names for an error message (the
 * dispatch refuses naming the files, never a bare count). */
export function describeExtractCollisions(
  report: ExtractCollisionReport,
  cap = 3
): string {
  const parts: string[] = [];
  if (report.duplicates.length > 0) {
    parts.push(
      `listed twice: ${report.duplicates.slice(0, cap).join(", ")}${report.duplicates.length > cap ? ` (+${report.duplicates.length - cap} more)` : ""}`
    );
  }
  if (report.clashes.length > 0) {
    for (const c of report.clashes.slice(0, cap)) {
      parts.push(`${c.names.join(" + ")} → one stack ${c.stack}.mrcs`);
    }
    if (report.clashes.length > cap) parts.push(`(+${report.clashes.length - cap} more stack clashes)`);
  }
  return parts.join("; ");
}

/* ------------------------------------------------------------------ */
/* t334 — is a STAR splittable by the array shard slicer?              */
/* ------------------------------------------------------------------ */

export interface StarSplitVerdict {
  /** true when the round-robin slice is safe to submit */
  ok: boolean;
  /** number of `data_` block headers in the STAR */
  blocks: number;
  /** data rows inside loops (column defs and headers excluded) */
  dataRows: number;
}

/**
 * The sbatch array slicer passes EVERY row of data blocks BEFORE the
 * second `data_` block to EVERY shard (that is how the optics block
 * reaches all shards) and round-robin splits the rows of block ≥ 2. A
 * STAR with a SINGLE data block therefore hands EVERY row to EVERY
 * shard — N processes extracting/correcting the same micrographs into
 * the same shared output tree, which is precisely the concurrent-writer
 * collision behind image.h:1534. RELION 5's optics-group stars (the
 * import leg's and RELION's own writers) always carry two blocks; a
 * hand-made or old-dialect STAR may not. ok = at least two blocks, or a
 * STAR with no data rows at all (nothing to double).
 */
export function starIsArraySplittable(text: string): StarSplitVerdict {
  let blocks = 0;
  let dataRows = 0;
  let inLoop = false;
  let headerPhase = false;
  for (const rawLine of text.split("\n")) {
    const tokens = tokenize(rawLine);
    if (tokens.length === 0) continue;
    const head = tokens[0];
    if (head.startsWith("data_")) {
      blocks += 1;
      inLoop = false;
      headerPhase = false;
      continue;
    }
    if (head === "loop_") {
      inLoop = true;
      headerPhase = true;
      continue;
    }
    if (!inLoop) continue;
    if (headerPhase) {
      if (head.startsWith("_")) continue; // column definition
      headerPhase = false; // first data row
    }
    if (!head.startsWith("_")) dataRows += 1;
  }
  return { ok: blocks >= 2 || dataRows === 0, blocks, dataRows };
}
