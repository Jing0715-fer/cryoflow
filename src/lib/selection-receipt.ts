/**
 * t562 — the selection receipt brain.
 *
 * The engine already writes the FULL selection story into every native
 * select run's log (engine.ts recordNativeRun → run.out): per-class
 * occupancy with kept/PRUNED verdicts, the input/output particle counts,
 * the mode that decided the keep set, and the result line. Until now that
 * receipt lived behind a raw log tail — the Results tab showed one number
 * ("particles selected N") and the user who wanted the WHY opened the log.
 *
 * This module parses that receipt back into structured data. The log is
 * the primary source (not the output star): the engine computed the
 * breakdown once at run time, so reading the receipt re-derives nothing
 * and can never disagree with what actually ran.
 *
 * Format (engine.ts runSelect2dNative / runSelectNative — both verbs
 * share the family shape):
 *
 *   CryoFlow engine-native select2d 2026-10-03T23:37:59.575Z
 *   source: Class2D 4 — the selection rides the newest settled round, not the finished run
 *   input:  /path/run_it003_data.star (10866 particles)
 *   mode:   manual 3 classes [ (birth selection) ] [ (ignored: 3, 7) ]
 *           | auto — occupancy ≥ 0.5× best
 *           | first-N (no _rlnClassNumber column or classCutoff=0)   ← 1D select only
 *   class occupancy (count · kept):
 *     class 5: 4073 · kept
 *     class 1: 1935 · PRUNED
 *   output: /path/particles_select2d.star (7421 particles)
 *   7,421 of 10,866 particles kept · 3/5 classes (manual 3 classes)
 *
 * Two numeric dialects coexist and BOTH must parse (the t554 lesson —
 * the checker that read "7,421" as "421" was a parse-the-receipt bug):
 * body lines are comma-less (template literals), the result line carries
 * thousands separators (toLocaleString). Every number goes through one
 * comma-stripping reader. The 1D `select` result line says
 * "particles selected · kept N/M classes", the 2D says
 * "particles kept · N/M classes" — the class-count group accepts both.
 *
 * run.out APPENDS per run (recordNativeRun), so a re-run leaves two
 * receipt blocks in one file: the LAST block is the newest run's truth.
 */

export interface SelectionReceiptClass {
  cls: number;
  count: number;
  kept: boolean;
}

export type SelectionModeKind = "manual" | "auto" | "first-n" | "unknown";

export interface SelectionReceipt {
  /** which engine verb wrote this block */
  verb: "select" | "select2d";
  /** ISO timestamp from the header line (null when unparseable) */
  ranAt: string | null;
  ranAtMs: number | null;
  /** the t402b source note's job name (before the engine's " — " copy) */
  source: string | null;
  inputParticles: number | null;
  outputParticles: number | null;
  /** the raw mode line value ("manual 3 classes (birth selection)") */
  mode: string | null;
  modeKind: SelectionModeKind;
  /** "(birth selection)" in the mode — the selection came baked at birth */
  birth: boolean;
  /** classes listed in "(ignored: 3, 7)" — not present in the input */
  ignored: number[];
  /** the result line's numbers */
  kept: number | null;
  total: number | null;
  keptClasses: number | null;
  totalClasses: number | null;
  classes: SelectionReceiptClass[];
}

/** one comma-tolerant reader for EVERY number the receipt carries */
function receiptNumber(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function modeKindOf(mode: string): SelectionModeKind {
  if (/^manual/.test(mode)) return "manual";
  if (/^auto/.test(mode)) return "auto";
  if (/^first-N/.test(mode)) return "first-n";
  return "unknown";
}

function ignoredOf(mode: string): number[] {
  const m = /\(ignored:\s*([^)]+)\)/.exec(mode);
  if (!m) return [];
  return m[1]
    .split(/[,;\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** the receipt blocks are delimited by the engine's header line */
const HEADER_RE = /^CryoFlow engine-native (select2d|select) (.+)$/gm;

/**
 * Parse the NEWEST receipt block out of a native select run's log text.
 * Returns null when the log carries no complete receipt (a header line
 * without its result line is a torn write — refuse to half-read it).
 */
export function parseSelectionReceipt(logText: string): SelectionReceipt | null {
  if (!logText) return null;

  // ---- find the LAST receipt block ------------------------------------
  const starts: { verb: "select" | "select2d"; at: number; stamp: string }[] = [];
  HEADER_RE.lastIndex = 0;
  for (let m; (m = HEADER_RE.exec(logText)) !== null; ) {
    starts.push({
      verb: m[1] === "select2d" ? "select2d" : "select",
      at: m.index,
      stamp: m[2].trim(),
    });
  }
  if (starts.length === 0) return null;
  const head = starts[starts.length - 1];
  const block = logText.slice(head.at);

  // ---- receipt lines ---------------------------------------------------
  const ranAtMs = Number.isFinite(Date.parse(head.stamp)) ? Date.parse(head.stamp) : null;

  // "source: Class2D 4 — the selection rides the newest settled round, …"
  let source: string | null = null;
  const sourceM = /^source:\s+(.+)$/m.exec(block);
  if (sourceM) {
    const raw = sourceM[1].trim();
    const cut = raw.indexOf(" — ");
    source = (cut >= 0 ? raw.slice(0, cut) : raw).trim() || null;
  }

  // "input:  /path/run_it003_data.star (10866 particles)"
  const inputM = /^input:\s+.*\(([\d,]+) particles\)/m.exec(block);
  const inputParticles = inputM ? receiptNumber(inputM[1]) : null;

  // "output: /path/particles_select2d.star (7421 particles)"
  const outputM = /^output:\s+.*\(([\d,]+) particles\)/m.exec(block);
  const outputParticles = outputM ? receiptNumber(outputM[1]) : null;

  // "mode:   manual 3 classes (birth selection) (ignored: 3, 7)"
  let mode: string | null = null;
  const modeM = /^mode:\s+(.+)$/m.exec(block);
  if (modeM) mode = modeM[1].trim();

  // "  class 5: 4073 · kept" / "  class 1: 1935 · PRUNED"
  const classes: SelectionReceiptClass[] = [];
  const classRe = /^\s+class (\d+): ([\d,]+) · (kept|PRUNED)\.?$/gm;
  for (let c; (c = classRe.exec(block)) !== null; ) {
    const cls = parseInt(c[1], 10);
    const count = receiptNumber(c[2]);
    if (!Number.isFinite(cls) || cls <= 0 || count === null) continue;
    classes.push({ cls, count, kept: c[3] === "kept" });
  }

  // "7,421 of 10,866 particles kept · 3/5 classes (manual 3 classes)"
  // "168 of 240 particles selected · kept 2/8 classes (auto — …)"  ← 1D
  let kept: number | null = null;
  let total: number | null = null;
  let keptClasses: number | null = null;
  let totalClasses: number | null = null;
  const resultM =
    /([\d,]+)\s+of\s+([\d,]+)\s+particles\s+(?:kept|selected)(?:\s+·\s+(?:kept\s+)?(\d+)\/(\d+)\s+classes)?/.exec(
      block
    );
  if (resultM) {
    kept = receiptNumber(resultM[1]);
    total = receiptNumber(resultM[2]);
    keptClasses = resultM[3] != null ? parseInt(resultM[3], 10) : null;
    totalClasses = resultM[4] != null ? parseInt(resultM[4], 10) : null;
  }

  // torn write guard: a receipt without its result line is not a receipt
  if (kept == null || total == null) return null;

  return {
    verb: head.verb,
    ranAt: ranAtMs != null ? head.stamp : null,
    ranAtMs,
    source,
    inputParticles,
    outputParticles,
    mode,
    modeKind: mode ? modeKindOf(mode) : "unknown",
    birth: mode ? /birth selection/.test(mode) : false,
    ignored: mode ? ignoredOf(mode) : [],
    kept,
    total,
    keptClasses,
    totalClasses,
    classes,
  };
}
