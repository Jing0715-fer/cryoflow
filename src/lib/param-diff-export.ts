/**
 * Launch-parameter diff export — the t1031 seat of the t1019/t1028/t1029/
 * t1030 grammar chain. The FSC compare dialog's Parameters table (the
 * paper: one Parameter column, one column per selected job, the rows
 * classified changed → partial → same, the "differences only" toggle
 * filtering what the reader sees) could not leave as bytes — the reader
 * could screenshot nothing and copy nothing machine-shaped. The builder
 * below is the diff table's ONE father: the CSV's cells speak the paper's
 * own words and the row keys are the paper's OWN head words (the t1019
 * grammar — the CSV header is the truth on camera).
 *
 * The door-facing laws this builder carries:
 *   • the t1029 one-grammar law — the CSV speaks the paper's words AND
 *     the paper's cells, cell for cell: the — travels (an absent side
 *     renders — and exports —), booleans travel their true/false words,
 *     numbers travel their own digits, objects travel their JSON word.
 *   • the t1029 name-address law's diff-table shape — the identity
 *     column speaks the KEY (the paper's own machine word, the one the
 *     rendered cell carries in its title): the humanized display word
 *     ("particle diameter") is the paper's reading voice, not the row's
 *     address, and the params record the diff was computed FROM answers
 *     to the camelCase key. Column HEADS collide too (two runs can share
 *     a display name — every re-run of a node keeps its label), so a
 *     colliding head speaks the fuller address the paper's own tooltip
 *     prints — `name (type)` — and a still-colliding head takes the
 *     machine's ordinal (` #2`, ` #3` — the second job that answers to
 *     this name), each word deterministic and parse-back-able.
 *   • the t1030 view-mirror law — the door exports the rows the section
 *     SPEAKS: the filtered table exports the filter's answer, and the
 *     all-identical prose (the toggle hides there) exports the full
 *     side-by-side. No kind column joins the file — the paper prints the
 *     kind as the row's paint and the counts badge's arithmetic, never
 *     as a cell.
 *   • the display-economy law (born this seat) — truncation does not
 *     travel: the paper's cell clips a long value at 24 glyphs with "…",
 *     but the ellipsis is the paper's WIDTH economy, not the value's
 *     word — the CSV speaks the value the cell MEANS, the full string,
 *     never the clipped one (the — travels because it MEANS absent; a
 *     … would only mean "narrow column").
 */

import type { CsvRow } from "@/lib/chart-export";

/** the identity column's head word — the paper's own (the rendered
 *  table's sr-only th speaks "Parameter"; the CSV carries it verbatim). */
export const PARAM_DIFF_HEAD = "Parameter";

/** one diff row — the shape classifyParamRows emits (structural: the
 *  kind tag rides along but the export never reads it — the view-mirror
 *  law exports what the section speaks, no columns the paper does not
 *  print). */
export interface ParamDiffExportRow {
  key: string;
  /** per-job raw values, aligned with the jobs order; undefined = absent */
  values: (unknown | undefined)[];
}

/** minimal job shape — the compare dialog's picked jobs (the params
 *  record itself stays behind; only the naming faces reach the file). */
export interface ParamDiffExportJob {
  name: string;
  type: string;
}

/** the value cell's word — one formula, two surfaces (the t215
 *  pctNumAt precedent): the rendered cell and the CSV cell pour from
 *  this well. undefined AND null speak the paper's absent word —; a
 *  boolean speaks its own word; a number speaks its digits (the
 *  integer/decimal split in the display layer collapses to String here
 *  — the same word both ways); a string speaks ITSELF, untruncated
 *  (the display-economy law); anything else speaks its JSON word — the
 *  same word the display layer would clip, minus the clipping. */
export const paramDiffValueCell = (v: unknown): string => {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return JSON.stringify(v) ?? String(v);
};

/** the head words — Parameter + one column per selected job, each job
 *  head the name the paper prints when it can and the fuller address
 *  when it must (the name-address law's head shape: bare name →
 *  `name (type)` → `name (type) #n`). */
export const paramDiffHead = (
  jobs: ReadonlyArray<ParamDiffExportJob>
): string[] => {
  const bare = new Map<string, number>();
  for (const j of jobs) bare.set(j.name, (bare.get(j.name) ?? 0) + 1);
  const typed = new Map<string, number>();
  return jobs.map((j) => {
    if ((bare.get(j.name) ?? 0) <= 1) return j.name;
    const full = `${j.name} (${j.type})`;
    const n = (typed.get(full) ?? 0) + 1;
    typed.set(full, n);
    return n === 1 ? full : `${full} #${n}`;
  });
};

/** the diff table's rows — the viewed classification in, the paper's
 *  own cells out. Null for an empty view (the doors' hasRows keeps the
 *  honest disabled face — a zero-row file helps nobody). The keys are
 *  the paper's own head words: PARAM_DIFF_HEAD for the identity column,
 *  one job word per selected job, IN THE PAPER'S ORDER (pick order). */
export const paramDiffRows = (
  jobs: ReadonlyArray<ParamDiffExportJob>,
  rows: ReadonlyArray<ParamDiffExportRow> | null
): CsvRow[] | null => {
  if (!rows || rows.length === 0 || jobs.length === 0) return null;
  const head = paramDiffHead(jobs);
  return rows.map((r) => {
    const row: CsvRow = { [PARAM_DIFF_HEAD]: r.key };
    jobs.forEach((_, i) => {
      row[head[i]] = paramDiffValueCell(r.values[i]);
    });
    return row;
  });
};
