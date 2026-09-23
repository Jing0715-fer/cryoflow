/**
 * CryoFlow — the extract frame census (t335), PURE module.
 *
 * Why pure (the t326/t327 recipe): the client, the server and the test
 * suites must share ONE classification, so the verdict the dispatch
 * refuses on is exactly the verdict the suite asserts — no import of the
 * engine (and its Prisma/fs spine) is needed to exercise the census.
 *
 * THE COMPLEMENT (t334's extract-collide.ts refused duplicate rows and
 * extension twins by NAME; this module byte-verifies what names cannot
 * see): a `.mrcs` row whose header says nz>1 is a FRAME STACK, not a
 * micrograph — RELION reads it as an (x,y,1,N) volume (parseMRCHeader:
 * isStack → _nDim = nz) and windows frame 0 of it: garbage particles
 * even when the names never collide. The mixed-import shape (the
 * *_Fractions_DW.mrc* glob sweeping in the corrector's .mrcs aligned
 * movie stacks beside the .mrc sums — the Beijing report's 865 .mrcs +
 * 169 .mrc arithmetic) is invisible to a name-only scan when the stems
 * are distinct. The census samples the .mrcs rows through the supplied
 * sniffer (one SSH round trip on the remote lane, local reads on the
 * local lane): nz>1 → refusal carrying the header's own numbers;
 * single-section → allowed with a note; unverifiable → the note, never
 * a block (the t313 philosophy: a filename smell is a hypothesis, the
 * header is the fact).
 */

import path from "path";
import { spreadSample, type HeaderSniffer, type SniffVerdict } from "./mrc-sniff";

/* ------------------------------------------------------------------ */
/* STAR helpers (shared with the engine's own readers)                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* STAR helpers (shared with the engine's own readers)                  */
/* ------------------------------------------------------------------ */

export interface StarBlock {
  /** "data_xxx" header line. */
  header: string;
  /** All following lines (including loop_/labels/rows). */
  lines: string[];
}

export function parseStarBlocks(text: string): StarBlock[] {
  const blocks: StarBlock[] = [];
  let current: StarBlock | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^data_/.test(line.trim())) {
      current = { header: line.trim(), lines: [] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return blocks;
}

/** Micrograph-name rows from star TEXT (the first column of the micrographs block). */
export function micrographRowsFromContent(text: string): string[] {
  const blocks = parseStarBlocks(text);
  const micBlock = blocks.find(
    (b) => b.header === "data_micrographs" || b.lines.some((l) => l.includes("_rlnMicrographName"))
  );
  if (!micBlock) return [];
  const names: string[] = [];
  for (const line of micBlock.lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t === "loop_" || t.startsWith("_rln") || t.startsWith("data_")) {
      continue;
    }
    const first = t.split(/\s+/)[0];
    if (first) names.push(first);
  }
  return names;
}

/* ------------------------------------------------------------------ */
/* The frame census                                                     */
/* ------------------------------------------------------------------ */

/** What an input gate decided (same shape as the CTF door's verdict). */
export interface GateVerdict {
  /** non-null → refuse the dispatch with this message (the evidence) */
  refusal: string | null;
  /** non-null → allowed, but this honest note rides along (log/receipt) */
  note: string | null;
}

/**
 * Census the extract input star's .mrcs rows by BYTES. `clusterPathOf`
 * maps a star row to a sniffable path (cluster-absolute rows pass
 * through; project-relative rows join the remote project root — or the
 * local project dir on the local lane). A `null` sniffer degrades the
 * byte check to the advisory note. Rows without .mrcs entries return
 * clean silently — a pure .mrc star has nothing to verify here (its
 * name-level geometry is t334's scan).
 */
export async function extractInputGate(
  rows: string[],
  sniff: HeaderSniffer | null,
  clusterPathOf: (row: string) => string
): Promise<GateVerdict> {
  const clean: GateVerdict = { refusal: null, note: null };
  const mrcsRows = rows.filter((r) => /\.mrcs$/i.test(r));
  if (rows.length === 0 || mrcsRows.length === 0) return clean;
  if (!sniff) {
    return {
      refusal: null,
      note:
        `${mrcsRows.length} of ${rows.length} rows are .mrcs stacks and their headers were not verified — if they are ` +
        `multi-frame movie stacks (not summed micrographs) run MotionCorr first and re-import the sums.`,
    };
  }
  const sample = spreadSample(mrcsRows, 16);
  let verdicts: Record<string, SniffVerdict> = {};
  try {
    verdicts = await sniff(sample.map(clusterPathOf));
  } catch {
    verdicts = {};
  }
  const stackRows = sample.filter((r) => verdicts[clusterPathOf(r)]?.kind === "mrc-stack");
  if (stackRows.length > 0) {
    const v = verdicts[clusterPathOf(stackRows[0]!)]!;
    const f = v.facts!;
    return {
      refusal:
        `the input STAR mixes summed micrographs with FRAME STACKS: ${path.basename(stackRows[0]!)}'s header says ` +
        `${f.nz} sections × ${f.nx}×${f.ny} (mode ${f.mode}) — a movie stack, not a micrograph (${stackRows.length} of ` +
        `${sample.length} sampled .mrcs rows verified, ${mrcsRows.length} of ${rows.length} rows carry .mrcs). Extract ` +
        `would read each as an (x,y,1,${f.nz}) volume and window frame 0 of it — garbage particles even when the names ` +
        `never collide. Run MotionCorr on the stacks and import only the summed micrographs (the .mrc files).`,
      note: null,
    };
  }
  const singleRows = sample.filter((r) => verdicts[clusterPathOf(r)]?.kind === "mrc-single");
  if (singleRows.length > 0) {
    const f = verdicts[clusterPathOf(singleRows[0]!)]!.facts!;
    return {
      refusal: null,
      note:
        `${mrcsRows.length} of ${rows.length} rows are .mrcs stacks, but the sampled headers say single-section ` +
        `${f.nx}×${f.ny} (mode ${f.mode}) — legal micrographs, extraction-safe.`,
    };
  }
  return {
    refusal: null,
    note:
      `${mrcsRows.length} of ${rows.length} rows are .mrcs stacks and their headers could not be verified — if they are ` +
      `multi-frame movie stacks run MotionCorr first and re-import the sums.`,
  };
}
