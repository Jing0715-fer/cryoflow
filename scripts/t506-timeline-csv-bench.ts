/**
 * t506-timeline-csv-bench.ts — The Windows Learn to Leave.
 *
 * The honest windows' MACHINE face: the timeline leaves as a CSV a
 * spreadsheet can drink, from the SAME walk the bars draw and the tool
 * quotes — job inventory CSV speaks created/updated (archive fields,
 * updatedAt is polling noise); this grid speaks windows (start, end,
 * duration, share of the span). Row shape mirrors the agent's per-run
 * roster: two machine readers, one walk, no re-derivations.
 *
 *   T1  the share      — timelineSharePct: ONE arithmetic (tool +
 *                         CSV), zero span shares zero
 *   T2  the grid       — timelineRunsCsv: ten columns, ISO stamps,
 *                         blank ended_at for a live run, fmtDuration's
 *                         human words, RFC 4180, empty → null
 *   T3  the tool       — the executor drinks the well's share now
 *   T4  the bars       — the Gantt's export group grows the third
 *                         button, rows from the walk, workspace names
 *                         from one resolver
 *   T5  neighbors      — the curve grid, the inventory grid and the
 *                         report's time lines all keep their bytes
 */

import { readFileSync } from "fs";
import path from "path";
import { timelineSharePct } from "../src/lib/timeline-walk";
import { timelineRunsCsv, timelineRunsCsvFilename, type TimelineCsvRow } from "../src/lib/qc-report";

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

/* ------------------------------------------------------------------ */
section("T1 — the share (one arithmetic, two machine readers)");

ok(timelineSharePct(60_000, 600_000) === 10, "a tenth of the span shares 10");
ok(timelineSharePct(721_000, 121_342_000) === 0.6, "one decimal on the grid (Math.round ×1000 /10 — the tool's own law)");
ok(timelineSharePct(300_000, 121_342_000) === 0.2, "the rounding is per the tool's own grid (round on the 1000th of a percent)");
ok(timelineSharePct(24_500, 1_000_000) === 2.5, "round-half-up on the 1000th: 24.5 → 25 → 2.5 (not a floor)");
ok(timelineSharePct(60_000, 0) === 0, "zero span shares zero — nobody ran, nothing is a fraction of nothing");
ok(timelineSharePct(121_342_000, 121_342_000) === 100, "the whole span shares 100");

/* ------------------------------------------------------------------ */
section("T2 — the grid (the windows leave as a spreadsheet)");

const SPAN = 600_000;
const rows: TimelineCsvRow[] = [
  {
    jobId: "j1",
    jobName: "Motion Correction, batch 1",
    jobType: "motioncorr",
    workspace: "Main",
    status: "completed",
    startMs: 1_700_000_000_000,
    endMs: 1_700_000_060_000,
    durationMs: 60_000,
    spanMs: SPAN,
  },
  {
    jobId: "j2",
    jobName: "2D Classification \"live\"",
    jobType: "class2d",
    workspace: "Main",
    status: "running",
    startMs: 1_700_000_090_000,
    endMs: null,
    durationMs: 120_000,
    spanMs: SPAN,
  },
];
const csv = timelineRunsCsv(rows)!;
const lines = csv.split("\n");
ok(lines.length === 3, "header + two window rows");
ok(
  lines[0] === "job_id,job,type,workspace,status,started_at,ended_at,duration_ms,duration_human,share_pct",
  "ten columns in the roster's own order: identity → status → window → duration → share"
);
ok(lines[1].startsWith('j1,"Motion Correction, batch 1",'), "a comma-carrying name is quoted, not broken (RFC 4180)");
ok(/\b1,700,000\b/.test(lines[1]) === false, "raw numbers never carry thousands separators");
ok(lines[1].includes("2023-11-14T22:13:20.000Z"), "started_at is an ISO stamp (machine grammar, no locale lies)");
ok(
  lines[2].includes(",120000,2m 0s,20.0") && lines[2].endsWith("20.0"),
  "duration speaks both machine (ms) and human (fmtDuration) words; the share is the well's arithmetic"
);
const runningCells = lines[2].split(",");
const endedAtIdx = 6;
ok(runningCells[endedAtIdx] === "", "a live run's ended_at speaks an empty cell — still open, never a guess");
ok(runningCells[5] === "2023-11-14T22:14:50.000Z", "a live run's started_at still speaks (the window's open end is real)");
ok(lines[1].split(",")[9] === "10.0" || lines[1].endsWith("10.0"), "the completed run's share lands with one decimal");
ok(timelineRunsCsv(null) === null && timelineRunsCsv([]) === null, "empty roster: the builder refuses honestly (no silent empty file)");
ok(/session-timeline-/.test(timelineRunsCsvFilename()) && /\.csv$/.test(timelineRunsCsvFilename()), "the grid travels under the timeline's own flag");

/* ------------------------------------------------------------------ */
section("T3 — the tool (the executor drinks the well's share now)");

const toolsSrc = read("src/lib/ai/tools.ts");
const execBody = toolsSrc.slice(toolsSrc.indexOf("async function getSessionTimeline"));
ok(/timelineSharePct\(r\.ms, walk\.span\)/.test(execBody), "the per-run share comes from the well (t506: one arithmetic)");
ok(!/Math\.round\(\(r\.ms \/ walk\.span\)/.test(execBody), "no hand-rolled share expression left in the executor");
ok(/timelineLedger\(walk\.rows\)/.test(execBody), "the ledger read from t505 is intact (busy + leaders still one well)");

/* ------------------------------------------------------------------ */
section("T4 — the bars (the Gantt's export group grows a third face)");

const analyticsSrc = read("src/components/workflow/pipeline-analytics.tsx");
ok(/const exportTimelineCsv = \(\) => \{/.test(analyticsSrc), "the export handler exists beside the inventory's");
ok(/runs\.rows\.map\(\(r\) => \(\{/.test(analyticsSrc), "the rows come from the walk the bars draw — no second walk, no re-derivation");
ok(/r\.job\.status === "running" \? null : r\.end/.test(analyticsSrc), "the open end rides to the builder as null (the bars' own law)");
ok(/timelineRunsCsv\(rows\)/.test(analyticsSrc) && /timelineRunsCsvFilename\(\)/.test(analyticsSrc), "the bytes leave through the family's builder and its own flag");
ok(/aria-label="Export timeline as CSV"/.test(analyticsSrc), "the third button carries its own name (a door needs a label)");
ok(/const wsName = \(id: string \| null \| undefined\) =>/.test(analyticsSrc.slice(0, analyticsSrc.indexOf("const exportCsv"))), "one workspace-name resolver serves both grids (lifted to component scope)");

/* ------------------------------------------------------------------ */
section("T5 — neighbors (each sibling keeps its own bytes)");

const qcSrc = read("src/lib/qc-report.ts");
ok(/line\(\["job_id", "job", "curve", "verdict"\]\)/.test(qcSrc), "the curve grid keeps its four columns");
ok(/"name",\s*\n\s*"type",\s*\n\s*"type_label",/.test(analyticsSrc), "the job inventory keeps its archive columns (created/updated untouched)");
ok(/wall-clock span across/.test(qcSrc), "the report's time lines (t505) keep their dialect — the paper speaks prose, the grid speaks cells");
const walkSrc = read("src/lib/timeline-walk.ts");
ok(
  /readers — ONE arithmetic, so a/.test(walkSrc) && /spreadsheet and the model/.test(walkSrc),
  "the well's docstring states the share law (same-line phrases, never cross-line)"
);
ok(/export function timelineSharePct/.test(walkSrc), "the share arithmetic lives in the well (twins fork, imports don't)");

console.log(`\n=== t506 — timeline csv: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
