/**
 * t505-report-timeline-bench.ts — The Report Learns to Tell Time.
 *
 * The time family's THIRD face: the session report's "Pipeline at a
 * glance" grows the span / heaviest-step / busy lines, and they are
 * the SAME walk the Gantt draws and get_session_timeline quotes —
 * timelineLedger moved the busy/leaders arithmetic into the well, so
 * the report drinks the reading and the builder only speaks.
 *
 *   T1  the ledger      — lib/timeline-walk behavior: the busy sum,
 *                         the leaders' ms-descending copy, the stable
 *                         tie, the chronological rows untouched
 *   T2  the builder     — SessionTimelineGlance in, three lines out,
 *                         honest absence (null / zero runs / no
 *                         heaviest), the snapshot law in the docstring
 *   T3  the tool        — the executor reads the ledger now (t504's
 *                         numbers, one arithmetic), top-3 intact
 *   T4  the dialog      — the report walks at open (now = the act of
 *                         opening), numbers not rows, deps honest
 *   T5  neighbors       — the echo stays a dumb translator (no time
 *                         semantics), the Gantt's face untouched, the
 *                         waiting line never doubles the absentees
 */

import { readFileSync } from "fs";
import path from "path";
import { walkTimeline, timelineLedger } from "../src/lib/timeline-walk";
import { buildSessionReport, type SessionTimelineGlance } from "../src/lib/qc-report";

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

const j = (
  id: string,
  name: string,
  status: string,
  startedAt: string | Date | null,
  duration: number
) => ({ id, name, status, startedAt, duration });

/* ------------------------------------------------------------------ */
section("T1 — the ledger (one reading of the windows: busy + leaders)");

const T0 = 1_700_000_000_000;
const walk = walkTimeline(
  [
    j("a", "Alpha", "completed", new Date(T0).toISOString(), 60_000),
    j("b", "Bravo", "completed", new Date(T0 + 90_000).toISOString(), 300_000),
    j("c", "Charlie", "failed", new Date(T0 + 200_000).toISOString(), 120_000),
    j("d", "Delta", "idle", null, 0),
  ],
  T0 + 1_000_000,
);
const ledger = timelineLedger(walk.rows);
ok(ledger.busyMs === 60_000 + 300_000 + 120_000, "the busy sum reads every window (failed windows too — real time)");
ok(ledger.leaders.length === walk.rows.length, "the leaders carry every row — a copy, not a cut");
ok(ledger.leaders[0]?.job.id === "b", "leaders[0] is the heaviest run (Bravo 300s)");
ok(
  ledger.leaders.map((r) => r.job.id).join(",") === "b,c,a",
  "the leaders' order is ms-descending (300 · 120 · 60)"
);
ok(
  walk.rows.map((r) => r.job.id).join(",") === "a,b,c",
  "the walk's own rows stay chronological — the ledger never rewrites the timeline"
);
const ledger2 = timelineLedger(walk.rows);
ledger2.leaders[0] = ledger2.leaders[1];
ok(ledger.leaders[0]?.job.id === "b", "the leaders are a copy — mutating one reading never leaks into another");
const tied = walkTimeline(
  [
    j("p", "Papa", "completed", new Date(T0).toISOString(), 100_000),
    j("q", "Quebec", "completed", new Date(T0 + 50_000).toISOString(), 100_000),
  ],
  T0 + 500_000,
);
ok(timelineLedger(tied.rows).leaders[0]?.job.id === "p", "equal windows keep their start order — the earlier run wins the tie (stable sort)");
const emptyLedger = timelineLedger(walkTimeline([j("x", "Xray", "idle", null, 0)], T0).rows);
ok(emptyLedger.busyMs === 0 && emptyLedger.leaders.length === 0, "nobody ran: the ledger reads zero, it invents nothing");

/* ------------------------------------------------------------------ */
section("T2 — the builder (the glance speaks the time family)");

const glance: SessionTimelineGlance = {
  runCount: 15,
  spanMs: 121_342_000,
  busyMs: 1_156_000,
  longestName: "2D Classification (tutorial)",
  longestMs: 721_000,
};
const md = buildSessionReport({
  projectName: "beta-gal",
  pipeline: { total: 22, succeeded: 14, running: 1, failed: 0, waiting: 7 },
  mapQc: null,
  mapPending: false,
  mapError: false,
  mapInventory: null,
  sweep: null,
  curves: null,
  curvesPending: false,
  curvesError: false,
  timeline: glance,
});
const glanceStart = md.indexOf("## Pipeline at a glance");
const glanceEnd = md.indexOf("## Map QC");
ok(glanceStart > -1 && glanceEnd > glanceStart, "the glance section bounds exist");
const glanceBody = md.slice(glanceStart, glanceEnd);
ok(glanceBody.includes("- **33h 42m** wall-clock span across **15** runs (first start → last end);"), "the span line: human words, run count, first start → last end");
ok(glanceBody.includes("- heaviest step: **2D Classification (tutorial)** at **12m 1s**;"), "the heaviest line names the step and its honest duration");
ok(glanceBody.includes("- **19m 16s** of measured compute (windows summed — parallel runs double-count)."), "the busy line confesses the overlap (every face that quotes it says so)");
ok(
  glanceBody.indexOf("wall-clock span") < glanceBody.indexOf("heaviest step") &&
    glanceBody.indexOf("heaviest step") < glanceBody.indexOf("measured compute"),
  "the time lines read in order: span → heaviest → busy"
);
ok(!glanceBody.includes("never started") && !glanceBody.includes("neverStarted"), "the waiting line already says who never ran — the time lines never repeat that count");

const mdNoTime = buildSessionReport({
  projectName: "beta-gal",
  pipeline: { total: 22, succeeded: 14, running: 1, failed: 0, waiting: 7 },
  mapQc: null,
  mapPending: false,
  mapError: false,
  mapInventory: null,
  sweep: null,
  curves: null,
  curvesPending: false,
  curvesError: false,
  timeline: null,
});
ok(!mdNoTime.slice(mdNoTime.indexOf("## Pipeline at a glance"), mdNoTime.indexOf("## Map QC")).includes("wall-clock span"), "timeline null: the time lines honest-absent, one word fewer, nothing invented");

const mdZero = buildSessionReport({
  projectName: "beta-gal",
  pipeline: { total: 2, succeeded: 0, running: 0, failed: 0, waiting: 2 },
  mapQc: null,
  mapPending: false,
  mapError: false,
  mapInventory: null,
  sweep: null,
  curves: null,
  curvesPending: false,
  curvesError: false,
  timeline: { runCount: 0, spanMs: 0, busyMs: 0, longestName: null, longestMs: 0 },
});
ok(!mdZero.slice(mdZero.indexOf("## Pipeline at a glance"), mdZero.indexOf("## Map QC")).includes("wall-clock span"), "zero runs: no window exists, the time lines do not invent one");

const mdNoLongest = buildSessionReport({
  projectName: "beta-gal",
  pipeline: { total: 3, succeeded: 1, running: 1, failed: 0, waiting: 1 },
  mapQc: null,
  mapPending: false,
  mapError: false,
  mapInventory: null,
  sweep: null,
  curves: null,
  curvesPending: false,
  curvesError: false,
  timeline: { runCount: 2, spanMs: 300_000, busyMs: 90_000, longestName: null, longestMs: 0 },
});
const noLongestBody = mdNoLongest.slice(mdNoLongest.indexOf("## Pipeline at a glance"), mdNoLongest.indexOf("## Map QC"));
ok(noLongestBody.includes("wall-clock span") && !noLongestBody.includes("heaviest step") && noLongestBody.includes("measured compute"), "no heaviest name: that line stays silent while span and busy still speak");

const mdOne = buildSessionReport({
  projectName: "beta-gal",
  pipeline: { total: 1, succeeded: 1, running: 0, failed: 0, waiting: 0 },
  mapQc: null,
  mapPending: false,
  mapError: false,
  mapInventory: null,
  sweep: null,
  curves: null,
  curvesPending: false,
  curvesError: false,
  timeline: { runCount: 1, spanMs: 721_000, busyMs: 721_000, longestName: "Solo", longestMs: 721_000 },
});
ok(mdOne.includes("across **1** run (first start"), "one run reads singular — a report that says '1 runs' lies by grammar");

const walkSrc = read("src/lib/timeline-walk.ts");
const qcSrc = read("src/lib/qc-report.ts");
ok(qcSrc.includes('import { fmtDuration } from "@/lib/duration"'), "the human words are the inspector's own fmtDuration — same dialect, three faces now");
ok(/snapshot reading/.test(qcSrc) && /opening the report/.test(qcSrc), "the snapshot law is in the docstring (same line): the time lines are stamped by the act of opening");
ok(qcSrc.includes("mdCell(timeline.longestName)"), "the heaviest name goes through mdCell — a job name never breaks the line");

/* ------------------------------------------------------------------ */
section("T3 — the tool (the executor reads the ledger now)");

const toolsSrc = read("src/lib/ai/tools.ts");
const execBody = toolsSrc.slice(toolsSrc.indexOf("async function getSessionTimeline"));
ok(/timelineLedger\(walk\.rows\)/.test(execBody), "the executor drinks the ledger (t505: one arithmetic for tool and report)");
ok(!/\.reduce\(/.test(execBody), "no hand-rolled busy sum left in the executor");
ok(/leaders\s*\n?\s*\.slice\(0, 3\)|const longest = leaders[\s\S]{0,40}\.slice\(0, 3\)/.test(execBody), "the longest read is still a top-3, now cut from the ledger's order");
ok(!/\[\.\.\.walk\.rows\]\s*\n?\s*\.sort\(\(a, b\) => b\.ms - a\.ms\)/.test(execBody), "the private sort is gone — the ledger owns the leaders' order");

/* ------------------------------------------------------------------ */
section("T4 — the dialog (the report walks at open; numbers, not rows)");

const dialogSrc = read("src/components/workflow/session-report-dialog.tsx");
ok(/walkTimeline\(jobs, Date\.now\(\)\)/.test(dialogSrc), "the report's now is the act of opening — the same law, a third clock");
ok(/timelineLedger\(walk\.rows\)/.test(dialogSrc), "the busy/leaders arithmetic comes from the well, never re-rolled");
ok(/if \(walk\.rows\.length === 0\) return null;/.test(dialogSrc), "nobody ran: the reading is null and the builder honest-absents the lines");
ok(/timeline: timelineGlance,/.test(dialogSrc), "the glance rides into buildSessionReport as its own slot");
ok(/curvesError,timelineGlance\]/.test(dialogSrc.replace(/\s+/g, "")), "the memo's deps carry the reading (a stale glance is a stale clock)");

/* ------------------------------------------------------------------ */
section("T5 — neighbors (the echo stays dumb, the Gantt keeps its face)");

const htmlSrc = read("src/lib/report-html.ts");
ok(!/timeline|wall-clock|SessionTimelineGlance/.test(htmlSrc), "the echo is a dumb translator — md in, HTML out, no time semantics of its own");
const analyticsSrc = read("src/components/workflow/pipeline-analytics.tsx");
ok(/walkTimeline\(/.test(analyticsSrc) && !/timelineLedger/.test(analyticsSrc), "the Gantt drinks the walk, not the ledger — the bars never needed the leaders");
ok(/export function timelineLedger/.test(walkSrc), "the ledger lives in the well (twins fork, imports don't)");
ok(
  /parallel runs double-count/.test(walkSrc) && /leaders\[0\] is the heaviest/.test(walkSrc),
  "the well's docstring states the busy confession and the leaders' law (same line)"
);
ok(walkSrc.indexOf("export function timelineLedger") > walkSrc.indexOf("export function walkTimeline"), "the ledger follows the walk in the file — the reading comes after the thing it reads");

console.log(`\n=== t505 — report timeline: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
