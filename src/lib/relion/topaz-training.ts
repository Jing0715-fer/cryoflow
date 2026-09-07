/**
 * CryoFlow — Topaz training-log parser (server only).
 *
 * topaz is not installable in this sandbox, and its per-epoch console
 * output shape varies across versions (RELION pipes topaz's stdout into
 * the job's run.out). This parser accepts the three shapes seen in the
 * wild, preferring the most structured one present:
 *
 *   1. CSV table — a header line starting with # (or "epoch") that names
 *      an epoch/it column AND a loss column, followed by numeric rows
 *      (comma/tab/semicolon/pipe separated).
 *   2. Epoch-tagged key=value stream — lines like "## epoch 3" (optionally
 *      carrying loss=/precision=/recall= themselves) followed by
 *      "## training loss: 0.42" / "## test loss: 0.39" style lines that
 *      attach to the last named epoch.
 *   3. Bare loss stream — no epoch markers at all; every line carrying a
 *      loss value becomes the next epoch (0-based), train/test routed by
 *      the line's test/held-out keyword.
 *
 * Precision/recall are parsed alongside loss when present (topaz prints
 * them as key=value pairs on the same lines). Nothing is fabricated: a
 * log with no recognizable progress yields [] and the chart self-hides.
 */

export interface TopazEpoch {
  /** epoch index (explicit from the log, else inferred positionally). */
  it: number;
  trainLoss: number | null;
  testLoss: number | null;
  precision: number | null;
  recall: number | null;
  testPrecision: number | null;
  testRecall: number | null;
}

const NUM = String.raw`([\d.]+(?:[eE][+-]?\d+)?)`;
const EPOCH_WORD = String.raw`(?:epoch|it|iteration)`;
const HEADER_SPLIT = /[,;\t|]+/;

function numOf(label: string, line: string): number | null {
  const m = new RegExp(`${label}\\s*[:=]\\s*${NUM}`, "i").exec(line);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function blankEpoch(it: number): TopazEpoch {
  return {
    it,
    trainLoss: null,
    testLoss: null,
    precision: null,
    recall: null,
    testPrecision: null,
    testRecall: null,
  };
}

/** Pass A: CSV-style table (header names epoch/it + loss columns). */
function parseTable(text: string): TopazEpoch[] | null {
  const lines = text.split(/\r?\n/);
  for (let h = 0; h < lines.length; h++) {
    const line = lines[h].trim();
    if (!line) continue;
    const cols = line
      .replace(/^#+\s*/, "")
      .split(HEADER_SPLIT)
      .map((c) => c.trim().toLowerCase());
    if (cols.length < 2) continue;
    const epochCol = cols.findIndex((c) => /^(it|epoch|iteration)$/.test(c));
    const lossCol = cols.findIndex((c) => c.includes("loss"));
    if (epochCol < 0 || lossCol < 0) continue;
    // looks like a table header — consume numeric rows below it
    const colIndex = (label: string) =>
      cols.findIndex((c) => c.includes(label));
    const testCol = (label: string) => cols.findIndex((c) => c.includes(label));
    const precCol = colIndex("precision");
    const recCol = colIndex("recall");
    const testLossCol = testCol("test") >= 0 ? lossCol : -1; // resolved below

    const epochs: TopazEpoch[] = [];
    let rows = 0;
    for (let r = h + 1; r < lines.length; r++) {
      const raw = lines[r].trim();
      if (!raw) continue;
      const cells = raw.split(HEADER_SPLIT).map((c) => c.trim());
      if (cells.length < cols.length) break;
      if (!cells.every((c) => c === "" || /^[\d.eE+-]+$/.test(c))) break;
      rows += 1;
      const it = Number(cells[epochCol]);
      if (!Number.isFinite(it)) continue;
      const e = blankEpoch(it);
      // a column whose header contains "test" carries the test loss; the
      // remaining loss column (if any) is the train/objective loss
      const testIdx = cols.findIndex((c) => c.includes("test") && c.includes("loss"));
      const trainIdx = cols.findIndex(
        (c, i) => c.includes("loss") && i !== testIdx && !c.includes("test")
      );
      if (testIdx >= 0) {
        const v = Number(cells[testIdx]);
        if (Number.isFinite(v)) e.testLoss = v;
      }
      if (trainIdx >= 0) {
        const v = Number(cells[trainIdx]);
        if (Number.isFinite(v)) e.trainLoss = v;
      }
      if (testLossCol >= 0 && testIdx < 0) {
        // single loss column in a table with a test column named differently
        const v = Number(cells[lossCol]);
        if (Number.isFinite(v)) e.trainLoss = v;
      }
      if (precCol >= 0) {
        const v = Number(cells[precCol]);
        if (Number.isFinite(v)) e.precision = v;
      }
      if (recCol >= 0) {
        const v = Number(cells[recCol]);
        if (Number.isFinite(v)) e.recall = v;
      }
      epochs.push(e);
    }
    if (rows >= 2) return epochs;
  }
  return null;
}

/** Pass B/C: epoch-tagged or bare loss lines. */
function parseStream(text: string): TopazEpoch[] {
  const epochs = new Map<number, TopazEpoch>();
  let cur = -1;
  let inferred = 0;
  let sawExplicit = false;

  const entry = (i: number): TopazEpoch => {
    let e = epochs.get(i);
    if (!e) {
      e = blankEpoch(i);
      epochs.set(i, e);
    }
    return e;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const em = new RegExp(`(?:^|[^a-z])${EPOCH_WORD}\\s*[:=#]?\\s*(\\d+)`, "i").exec(line);
    const isTest = /\btest\b|held[\s-]?out/i.test(line);
    const hasLoss = /loss/i.test(line) && /[\d.]/.test(line);

    if (em) {
      cur = Number(em[1]);
      sawExplicit = true;
    } else if (hasLoss && !sawExplicit) {
      // standalone loss line in an un-marked log → next positional epoch
      cur = inferred++;
    }
    if (cur < 0) continue;
    if (!hasLoss && !/precision|recall/i.test(line)) continue;

    const e = entry(cur);
    const loss = numOf("loss", line);
    const prec = numOf("precision", line);
    const rec = numOf("recall", line);
    if (loss != null) {
      if (isTest) e.testLoss = loss;
      else e.trainLoss = loss;
    }
    if (prec != null) {
      if (isTest) e.testPrecision = prec;
      else e.precision = prec;
    }
    if (rec != null) {
      if (isTest) e.testRecall = rec;
      else e.recall = rec;
    }
  }

  return [...epochs.values()]
    .sort((a, b) => a.it - b.it)
    .filter(
      (e) =>
        e.trainLoss != null ||
        e.testLoss != null ||
        e.precision != null ||
        e.testPrecision != null
    );
}

/**
 * Parse a topaz training log (run.out tail, topaz log file, …) into
 * per-epoch points. Tries the structured table first, then the stream.
 */
export function parseTopazTraining(text: string): TopazEpoch[] {
  if (!text || !/loss/i.test(text)) return [];
  const table = parseTable(text);
  if (table && table.length >= 2) return table;
  return parseStream(text);
}
