/**
 * CryoFlow — RELION STAR file parser (server + preview friendly).
 *
 * Handles the subset of the STAR format RELION 5 actually writes:
 *  - `data_<name>` blocks
 *  - `loop_` sections with `_rlnColumn #n` headers and whitespace-separated
 *    rows (values may be single- or double-quoted — quotes are stripped)
 *  - `#` comments (including the `#1` column index suffixes)
 *  - key-value pairs outside loops (`_rlnFinalResolution   7.08`)
 *
 * Rows are reconstructed greedily: tokens accumulate until a full row of
 * `columns.length` values is available, so multi-line rows parse too.
 */

export interface StarLoop {
  columns: string[];
  rows: string[][];
}

export interface StarBlock {
  /** block name without the `data_` prefix */
  name: string;
  /** non-loop key-value pairs */
  pairs: Record<string, string>;
  /** the (single) loop section of the block, if any */
  loop?: StarLoop;
}

export interface StarFile {
  blocks: StarBlock[];
}

/** Parse STAR text into blocks. `maxRows` caps stored rows per loop. */
export function parseStar(text: string, maxRows = 20_000): StarFile {
  const file: StarFile = { blocks: [] };
  let block: StarBlock | null = null;
  let inLoop = false;
  let headerPhase = false;
  let columns: string[] = [];
  let rows: string[][] = [];
  let pending: string[] = [];

  const flushLoop = () => {
    if (block && inLoop && columns.length > 0) {
      block.loop = { columns, rows };
    }
    inLoop = false;
    headerPhase = false;
    columns = [];
    rows = [];
    pending = [];
  };

  const flushBlock = () => {
    flushLoop();
    block = null;
  };

  const pushRowTokens = (tokens: string[]) => {
    pending.push(...tokens);
    while (pending.length >= columns.length && columns.length > 0) {
      const row = pending.slice(0, columns.length);
      pending = pending.slice(columns.length);
      if (rows.length < maxRows) rows.push(row);
    }
  };

  const lines = text.split("\n");
  for (const rawLine of lines) {
    // line-quote continuation state
    let quote: string | null = null;
    let cur = "";
    const tokens: string[] = [];

    const endToken = () => {
      if (cur.length > 0) {
        tokens.push(cur);
        cur = "";
      }
    };

    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i];
      if (quote) {
        if (ch === quote) quote = null;
        else cur += ch;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "#") {
        // comment to end of line (only outside quotes)
        break;
      }
      if (ch === " " || ch === "\t" || ch === "\r") {
        endToken();
        continue;
      }
      cur += ch;
    }
    // NOTE: multi-line quoted values are rare in RELION; when a quote is
    // still open we simply drop the continuation (values stay usable).
    endToken();
    if (tokens.length === 0) continue;

    const head = tokens[0];
    if (head.startsWith("data_")) {
      flushBlock();
      block = { name: head.slice(5), pairs: {} };
      file.blocks.push(block);
      continue;
    }
    if (head === "loop_") {
      flushLoop();
      inLoop = true;
      headerPhase = true;
      continue;
    }
    if (head === "stop_") {
      flushLoop();
      continue;
    }
    if (!block) {
      block = { name: "", pairs: {} };
      file.blocks.push(block);
    }
    if (inLoop) {
      if (headerPhase && head.startsWith("_")) {
        columns.push(head);
        continue;
      }
      headerPhase = false;
      pushRowTokens(tokens);
    } else if (head.startsWith("_")) {
      block.pairs[head] = tokens.slice(1).join(" ");
    }
  }
  flushBlock();
  return file;
}

/** The loop with the most rows across all blocks (RELION's "main" table). */
export function biggestLoop(file: StarFile): StarLoop | null {
  let best: StarLoop | null = null;
  for (const b of file.blocks) {
    if (b.loop && b.loop.columns.length > 0 && (!best || b.loop.rows.length > best.rows.length)) {
      best = b.loop;
    }
  }
  return best;
}

/** Look up a non-loop pair value (e.g. `_rlnFinalResolution`). */
export function findPair(file: StarFile, key: string): string | null {
  for (const b of file.blocks) {
    if (b.pairs[key] !== undefined) return b.pairs[key];
  }
  return null;
}

export interface FscData {
  /** resolution in Angstrom (converted from 1/Å when necessary) */
  resolution: number[];
  correlation: number[];
  /** which correlation column was used */
  correlationColumn: string;
}

/**
 * Extract an FSC curve from a loop: needs a resolution column
 * (`_rlnAngstromResolution` preferred, `_rlnResolution` accepted) and a
 * correlation column (`_rlnFourierShellCorrelation*`). Resolution values
 * ≤ 1 are treated as spatial frequency (1/Å) and inverted to Å.
 */
export function extractFsc(loop: StarLoop): FscData | null {
  const cols = loop.columns;
  const resIdx =
    cols.indexOf("_rlnAngstromResolution") >= 0
      ? cols.indexOf("_rlnAngstromResolution")
      : cols.indexOf("_rlnResolution");
  if (resIdx < 0) return null;

  let corrIdx = cols.indexOf("_rlnFourierShellCorrelation");
  if (corrIdx < 0) corrIdx = cols.indexOf("_rlnFourierShellCorrelationCorrected");
  if (corrIdx < 0) {
    corrIdx = cols.findIndex((c) => c.startsWith("_rlnFourierShellCorrelation"));
  }
  if (corrIdx < 0) return null;

  const resolution: number[] = [];
  const correlation: number[] = [];
  const resIsFrequency =
    resIdx === cols.indexOf("_rlnResolution") &&
    loop.rows.some((r) => {
      const v = parseFloat(r[resIdx]);
      return Number.isFinite(v) && v > 0 && v <= 1;
    });

  for (const row of loop.rows) {
    const r = parseFloat(row[resIdx]);
    const c = parseFloat(row[corrIdx]);
    if (!Number.isFinite(r) || !Number.isFinite(c) || r === 0) continue;
    resolution.push(resIsFrequency ? 1 / r : r);
    correlation.push(c);
  }
  if (resolution.length < 2) return null;
  return { resolution, correlation, correlationColumn: cols[corrIdx] };
}

/**
 * Resolution (Å) where the FSC curve first drops to `threshold`
 * (linear interpolation between shells; assumes ascending frequency =
 * descending Å within the table). Returns null when no crossing exists.
 */
export function fscResolutionAtThreshold(fsc: FscData, threshold = 0.143): number | null {
  const { resolution, correlation } = fsc;
  for (let i = 0; i < resolution.length - 1; i++) {
    const c0 = correlation[i];
    const c1 = correlation[i + 1];
    const r0 = resolution[i];
    const r1 = resolution[i + 1];
    if (c0 >= threshold && c1 < threshold && c0 !== c1) {
      const t = (c0 - threshold) / (c0 - c1);
      const res = r0 + t * (r1 - r0);
      return Math.round(res * 100) / 100;
    }
  }
  return null;
}
