/**
 * t507-archive-window-bench.ts — The Archive Learns the Window.
 *
 * The jobs inventory CSV spoke created/updated — archive fields, and
 * updatedAt is polling noise (t506's lesson). A machine reader holding
 * only this grid had no honest answer to "when did this step run / how
 * long did it take". t507 appends the window's two columns AT THE END
 * (existing column positions stay stable for scripts already reading
 * the grid): started_at speaks the engine's own stamp (the DTO field
 * verbatim) and duration_ms drinks the SAME walk the bars and the
 * timeline CSV pour from — the floor and the running-stretch live in
 * the well, so the two grids can never disagree about a measurement.
 *
 *   T1  the header   — two new columns ride at the END, the old nine
 *                      intact in order (the archive's contract holds)
 *   T2  provenance   — started_at is the engine's stamp, duration_ms
 *                      is the well's ms, never a guess, one pour
 *   T3  one truth    — both grids drink runs.rows; the archive keeps
 *                      its own csvCell/\r\n dialect
 *   T4  neighbors    — the timeline builder, the map grid, the curve
 *                      grid and the evolved docstrings keep their bytes
 */

import { readFileSync } from "fs";
import path from "path";

const REPO = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(REPO, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${msg}`);
  } else {
    fail += 1;
    console.error(`  FAIL ${msg}`);
  }
};
const section = (s: string) => console.log(`\n${s}`);

const analyticsSrc = read("src/components/workflow/pipeline-analytics.tsx");
const csvBody = analyticsSrc.slice(
  analyticsSrc.indexOf("const exportCsv"),
  analyticsSrc.indexOf("const exportTimelineCsv"),
);
const headerStart = analyticsSrc.indexOf("const header = [", analyticsSrc.indexOf("const exportCsv"));
// +1: indexOf returns the START of "];", and slice drops the end — keep the bracket in the slice
const headerSlice = analyticsSrc.slice(headerStart, analyticsSrc.indexOf("];", headerStart) + 1);
const rowsStart = analyticsSrc.indexOf("const rows = scoped.map");
const rowsSlice = analyticsSrc.slice(rowsStart, analyticsSrc.indexOf("]);", rowsStart));

/* ------------------------------------------------------------------ */
section("T1 — the header (appending keeps the archive's column contract)");

ok(
  /"started_at",\s*\n\s*"duration_ms",\s*\n\s*\]/.test(headerSlice),
  "the window's two columns ride at the END of the header (existing positions stable)",
);
ok(
  headerSlice.indexOf('"updated_at"') < headerSlice.indexOf('"started_at"') &&
    headerSlice.indexOf('"started_at"') < headerSlice.indexOf('"duration_ms"'),
  "started_at sits right after updated_at — archive fields first, window anchor last",
);
ok(
  /"name",\s*\n\s*"type",\s*\n\s*"type_label",\s*\n\s*"workspace",\s*\n\s*"status",\s*\n\s*"progress_pct",\s*\n\s*"result",\s*\n\s*"created_at",\s*\n\s*"updated_at",/.test(
    headerSlice,
  ),
  "the old nine columns intact, in order — the grid scripts already read still reads",
);
ok((headerSlice.match(/"/g) || []).length / 2 === 11, "eleven cells — nine archive + two window");
ok(
  /"name",\s*\n\s*"type",\s*\n\s*"type_label",/.test(headerSlice),
  "the first three archive columns keep their seats (t506's anchor, now ours too)",
);

/* ------------------------------------------------------------------ */
section("T2 — the window's provenance (two fathers, each honest)");

ok(
  /const windowMsByJob = new Map\(runs\.rows\.map\(\(r\) => \[r\.job\.id, r\.ms\]\)\);/.test(csvBody),
  "one lookup keyed by job id over the walk's rows — the value is the WELL's ms",
);
ok(/r\.job\.id, r\.ms/.test(csvBody), "duration drinks r.ms (floored, running stretched) — never raw arithmetic");
ok(
  /j\.startedAt \?\? ""/.test(csvBody),
  "started_at speaks the engine's own stamp verbatim (the DTO field, like created/updated)",
);
ok(
  /windowMsByJob\.get\(j\.id\)\?\.toString\(\) \?\? ""/.test(csvBody),
  "duration_ms reads the lookup with an honest blank when no window exists",
);
ok(
  !/j\.duration/.test(rowsSlice),
  "no raw j.duration in the grid's cells — the measurement lives in the well",
);
ok(
  (csvBody.match(/\?\? ""/g) || []).length === 3,
  "blank grammar census: result, started_at, duration_ms — every null speaks blank, never a guess",
);
ok(
  (analyticsSrc.match(/walkTimeline\(/g) || []).length === 1,
  "exactly ONE walk pour in the component — both grids drink the same memoized walk",
);

/* ------------------------------------------------------------------ */
section("T3 — one truth across the two grids");

ok(/runs\.rows\.map\(\(r\) => \(\{/.test(analyticsSrc), "the timeline handler still drinks runs.rows (t506)");
ok(/r\.job\.status === "running" \? null : r\.end/.test(analyticsSrc), "the live run's open end still rides as null (the builder's business)");
ok(
  /r\.map\(csvCell\)\.join\(","\)\)\.join\("\\r\\n"\)/.test(analyticsSrc),
  "the archive grid keeps its own csvCell + CRLF dialect (no dialect drift)",
);
ok(
  analyticsSrc.indexOf("const wsName") < analyticsSrc.indexOf("const exportCsv"),
  "one workspace-name resolver still serves both grids (lifted to component scope)",
);

/* ------------------------------------------------------------------ */
section("T4 — neighbors (each sibling keeps its own bytes)");

const qcSrc = read("src/lib/qc-report.ts");
ok(
  /const iso = \(ms: number\) => new Date\(ms\)\.toISOString\(\)/.test(qcSrc),
  "the timeline builder's ISO grammar untouched",
);
ok(/the WHOLE window lives here/.test(qcSrc), "the evolved docstring is on record — the timeline grid owns the whole window");
ok(!/not honest windows/.test(qcSrc), "the stale phrase retired (the inventory now carries the window's stamp and length)");
ok(
  /line\(\["job", "main_map", "volumes", "peak_pct", "delta_winner", "shape_r", "thinnest"\]\)/.test(qcSrc),
  "the map inventory grid (t218) keeps its seven columns",
);
ok(/line\(\["job_id", "job", "curve", "verdict"\]\)/.test(qcSrc), "the curve grid keeps its four columns (t498)");
ok(
  /since t507/.test(analyticsSrc) && /started_at\/duration_ms/.test(analyticsSrc),
  "the timeline handler's docstring carries the evolution (same well, two faces)",
);

console.log(`\n=== t507 — archive window: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
