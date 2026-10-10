/**
 * CryoFlow — the loser's list (t452), PURE module.
 *
 * t439 built the A/B verdict and it has spoken names ever since: the
 * biggest regressions list names the micrographs that got WORSE from run
 * A to run B. Four windows of leftovers (t439 → t451) carried the same
 * sentence — 「把输家微图喂给 exclude 清单」门 — and this module is the
 * brain that door runs on: parse a baked name list, filter a micrographs
 * STAR by it, and speak the receipt.
 *
 * Why pure (the t326/t327 recipe, ninth life): the engine, the compare
 * dialog and the bench must share ONE name law — the list the dialog
 * bakes is byte-for-byte the list the engine filters by, and the bench
 * asserts it without importing the engine's fs/Prisma spine. The only
 * dependency is extract-gate's STAR block parser (itself pure since
 * t335), so the same law runs on the server, in the browser and in the
 * suite.
 *
 * The name law has one nuance learned from the mock's own STARs: a
 * micrograph row may name its file by ABSOLUTE path (/data/.../x.mrc)
 * in one run and by BARE FILENAME (x.mrc) in another — the per-micrograph
 * compare joins on whatever the rows say, but the exclusion must not
 * miss a row just because its path prefix drifted. So matching is
 * exact-first, basename-second: an excluded full path kills its exact
 * twin AND the row whose basename agrees; an excluded bare name kills
 * the same two shapes. Neither law ever kills a DIFFERENT file that
 * merely shares a directory.
 */

import { parseStarBlocks, type StarBlock } from "./relion/extract-gate";

/**
 * Parse the baked exclusion list. One name per line, comma- or
 * semicolon-separated — the compare dialog bakes a comma list into the
 * single-line param, a hand-edited one may use newlines; both are the
 * same law. Whitespace is trimmed, empties are dropped, duplicates are
 * collapsed (the first occurrence wins — a list is a set, not a log).
 */
export function parseExcludeNames(raw: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const piece of raw.split(/[\n,;]+/)) {
    const name = piece.trim();
    if (!name) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

/** Last path segment of a STAR name (both slash dialects). */
export function baseNameOf(name: string): string {
  const idx = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
  return idx >= 0 ? name.slice(idx + 1) : name;
}

/** The filter's own census — every count the receipt and the log speak. */
export interface ExcludeFilterReport {
  /** The filtered STAR text (blocks kept verbatim, excluded rows gone). */
  text: string;
  /** Data rows seen in micrograph-name-bearing blocks. */
  total: number;
  /** Rows written through. */
  kept: number;
  /** Rows dropped because their name matched the list. */
  dropped: number;
  /** Excluded names that matched NOTHING — the receipt names them so a
   *  stale or misspelled list can never lie by omission. */
  missing: string[];
}

/**
 * Column index of `label` in a block's loop header (−1 when absent).
 * The column IS the count of label lines before it — the engine keeps
 * its own labelColumn because it lives with the CLI spine; this one
 * lives with the STAR text alone and counts the same way.
 */
function columnOf(lines: string[], headerEnd: number, label: string): number {
  if (headerEnd < 0) return -1;
  let col = 0;
  for (let i = 0; i < headerEnd && i < lines.length; i++) {
    const t = lines[i]?.trim() ?? "";
    if (t === "" || t === "loop_" || t.startsWith("#")) continue;
    if (t.startsWith("_")) {
      const first = t.split(/\s+/)[0];
      if (first === label) return col;
      col++;
    }
  }
  return -1;
}

/**
 * Filter a micrographs STAR: every data row whose _rlnMicrographName
 * matches an excluded name (exact or basename law) is dropped; blocks
 * without a micrograph-name column ride through untouched (optics
 * blocks, model blocks — a filter is not an editor). Non-loop scalar
 * rows inside a matching block are kept: only the loop's data rows
 * answer to the list.
 */
export function filterMicrographStar(
  starText: string,
  excludedNames: string[],
): ExcludeFilterReport {
  const excluded = new Set(excludedNames);
  const excludedBasenames = new Set(excludedNames.map(baseNameOf));
  const blocks = parseStarBlocks(starText);
  const outLines: string[] = [];
  let total = 0;
  let kept = 0;
  const matchedNames = new Set<string>();

  for (const block of blocks) {
    outLines.push(block.header);
    const lines = block.lines;
    const micCol = columnOf(lines, loopHeaderEnd(lines), "_rlnMicrographName");
    if (micCol < 0) {
      for (const l of lines) outLines.push(l);
      outLines.push("");
      continue;
    }
    for (const l of lines) {
      const t = l.trim();
      // loop scaffolding and scalars ride through verbatim
      if (!t || t === "loop_" || t.startsWith("_rln") || t.startsWith("_") || t.startsWith("#")) {
        outLines.push(l);
        continue;
      }
      total++;
      const name = t.split(/\s+/)[micCol] ?? "";
      const hit =
        excluded.has(name) ||
        excludedBasenames.has(baseNameOf(name));
      if (hit) {
        matchedNames.add(name);
        continue;
      }
      outLines.push(l);
      kept++;
    }
    outLines.push("");
  }

  const dropped = total - kept;
  const matchedBasenames = new Set([...matchedNames].map(baseNameOf));
  const missing = excludedNames.filter(
    (n) => !matchedNames.has(n) && !matchedBasenames.has(baseNameOf(n)),
  );
  return { text: outLines.join("\n"), total, kept, dropped, missing };
}

/** Index just past the loop header (first data row) in a block's lines. */
function loopHeaderEnd(lines: string[]): number {
  let sawLoop = false;
  let i = 0;
  for (; i < lines.length; i++) {
    const t = lines[i]?.trim() ?? "";
    if (t === "loop_") {
      sawLoop = true;
      continue;
    }
    if (!sawLoop) {
      if (t === "" || t.startsWith("#")) continue;
      // a scalar line before any loop_ — there is no loop in this block
      return -1;
    }
    if (t === "" || t.startsWith("_rln") || t.startsWith("_") || t.startsWith("#")) continue;
    break; // first data row
  }
  return sawLoop ? i : -1;
}

/* ------------------------------------------------------------------ */
/* The receipt                                                          */
/* ------------------------------------------------------------------ */

/**
 * The exclude door's spoken plan — the one sentence the dialog's
 * contract line and the store's receipt share. `excluded` is the baked
 * count; `adopted` is how many of run A's downstream wires the combo
 * re-parents onto the new exclude job.
 */
export function describeExcludeDoor(excluded: number, adopted: number, nameB: string): string {
  const wires = adopted === 1 ? "1 downstream wire" : `${adopted} downstream wires`;
  return (
    `Mints an Exclude Micrographs job consuming ${nameB} with ${excluded} name${excluded === 1 ? "" : "s"} baked in, and re-wires ${wires} to consume the filtered list — results stay until re-run.`
  );
}
