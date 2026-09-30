/**
 * t504-session-timeline-bench.ts — The Canvas Learns to Tell Time.
 *
 * The time dimension's AGENT face: get_session_timeline reads the same
 * honest windows the analytics Gantt draws (Task 123's arithmetic,
 * now lifted into lib/timeline-walk — one well, two walkers), so a
 * time question answered by the model can never disagree with the
 * bars about when anything ran.
 *
 *   T1  the well        — lib/timeline-walk behavior: honest windows,
 *                         the floor, the running stretch, the two-gated
 *                         predicate, the sort law, the honest absentees
 *   T2  one well        — the Gantt drinks the well, inline twins dead,
 *                         display dialect (ticks) stays display-side
 *   T3  tool shape      — the 25th tool, zero knobs, description laws
 *   T4  walk law        — executor drinks the well, reads not
 *                         arithmetic, the inspector's own human words,
 *                         ISO-only absolute stamps, honest lines
 *   T5  neighbors       — the map keeps its own dialect (no time twins
 *                         in get_workflow_state), the read family
 *                         alive, the engine's write-side floor alive
 */

import { readFileSync } from "fs";
import path from "path";
import { AI_TOOLS } from "../src/lib/ai/tools";
import { walkTimeline, TIMELINE_RUN_STATUSES, TIMELINE_MIN_WINDOW_MS } from "../src/lib/timeline-walk";
import { fmtDuration } from "../src/lib/duration";

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

/** Synthetic job factory — the shape both walkers pass (a JobDTO and a
 *  prisma row are structural superset citizens of it). */
const j = (
  id: string,
  name: string,
  status: string,
  startedAt: string | Date | null,
  duration: number
) => ({ id, name, status, startedAt, duration });

/* ------------------------------------------------------------------ */
section("T1 — the well (lib/timeline-walk: honest windows, two walkers)");

const T0 = 1_700_000_000_000;
const completedRow = walkTimeline([j("a", "Alpha", "completed", new Date(T0).toISOString(), 65_000)], T0 + 500_000).rows[0];
ok(completedRow != null && completedRow.start === T0 && completedRow.end === T0 + 65_000,
  "a completed run's window is [startedAt → startedAt+duration] — the engine's own truth");
ok(completedRow != null && completedRow.ms === 65_000, "ms is the window's honest width");

const floored = walkTimeline([j("b", "Beta", "completed", new Date(T0).toISOString(), 0)], T0 + 500_000).rows[0];
ok(floored != null && floored.ms === TIMELINE_MIN_WINDOW_MS,
  "a zero-duration write still gets the engine's own 1000ms floor (never a zero window)");

const runStart = T0 + 100_000;
const stretched = walkTimeline([j("c", "Gamma", "running", new Date(runStart).toISOString(), 8_000)], runStart + 60_000).rows[0];
ok(stretched != null && stretched.end === runStart + 60_000 && stretched.ms === 60_000,
  "a live run stretches to now — the window has no end yet, the caller's clock pins it");

const earlyNow = walkTimeline([j("d", "Delta", "running", new Date(runStart).toISOString(), 8_000)], runStart - 5_000).rows[0];
ok(earlyNow != null && earlyNow.end === runStart + TIMELINE_MIN_WINDOW_MS,
  "a live run never dips below start+1000 even when now is behind");

const mixed = walkTimeline(
  [
    j("idle1", "Idle Seed", "idle", null, 8_000),
    j("idle2", "Idle Stamped", "idle", new Date(T0 + 1).toISOString(), 8_000),
    j("f1", "Failer", "failed", new Date(T0 + 10_000).toISOString(), 30_000),
  ],
  T0 + 900_000
);
ok(mixed.rows.length === 1 && mixed.rows[0].job.id === "f1",
  "the predicate is two-gated: a run needs startedAt AND a run status (idle stays off the bars even stamped)");
ok(mixed.neverStarted === 1, "the honest absentee counts only the never-started (an idle without startedAt)");
ok(mixed.rows[0].ms === 30_000, "a failed run keeps its window — time spent failing is real time");

const tieT = new Date(T0 + 77_000).toISOString();
const sorted = walkTimeline(
  [
    j("s2", "zeta", "completed", tieT, 5_000),
    j("s1", "alpha", "completed", tieT, 5_000),
    j("s3", "mid", "completed", new Date(T0 + 90_000).toISOString(), 5_000),
    j("s0", "first", "completed", new Date(T0 + 1_000).toISOString(), 5_000),
  ],
  T0 + 900_000
);
ok(sorted.rows.map((r) => r.job.id).join(",") === "s0,s1,s2,s3",
  "the sort law: start ascending, the name breaking ties — the bars' own order");

const empty = walkTimeline([], T0);
ok(empty.rows.length === 0 && empty.t0 === 0 && empty.span === 0 && empty.neverStarted === 0,
  "an empty roster walks to an empty timeline (t0 and span stay zero, never NaN)");

const spanned = walkTimeline(
  [
    j("w1", "Early", "completed", new Date(T0).toISOString(), 10_000),
    j("w2", "Late", "completed", new Date(T0 + 120_000).toISOString(), 40_000),
  ],
  T0 + 900_000
);
ok(spanned.t0 === T0 && spanned.span === 160_000,
  "the span is first start → last end (the axis the bars draw)");

const dateRow = walkTimeline([j("d1", "DateRow", "completed", new Date(T0 + 5_000), 20_000)], T0 + 900_000).rows[0];
ok(dateRow != null && dateRow.start === T0 + 5_000,
  "a Date startedAt (the server rows' dialect) walks the same window as an ISO string");

ok(TIMELINE_RUN_STATUSES.join(",") === "completed,failed,running" && TIMELINE_MIN_WINDOW_MS === 1000,
  "the well's constants carry the predicate and the floor in one place");

/* ------------------------------------------------------------------ */
section("T2 — one well (the Gantt drinks it, twins stay dead)");

const compSrc = read("src/components/workflow/pipeline-analytics.tsx");
ok(/import \{ walkTimeline \} from "@\/lib\/timeline-walk"/.test(compSrc),
  "the Gantt imports the well (change of address, not a rewrite)");
ok(!/start \+ Math\.max\(1000/.test(compSrc) && !/Math\.max\(now, start \+ 1000\)/.test(compSrc),
  "the inline twin arithmetic is gone from the component (twins fork, imports don't)");
ok(/walkTimeline\(scoped, now\)/.test(compSrc), "the walk call passes the ticker's own clock");
ok(/niceStepMs\(/.test(compSrc), "the ticks stay display-side (the well carries data, not pixels)");
ok(/const neverRan = walk\.neverStarted;/.test(compSrc),
  "the footer's absentee count drinks the well too (never a private twin)");

const wellSrc = read("src/lib/timeline-walk.ts");
ok(!/^\s*import /.test(wellSrc), "the well is import-free (client and server drink the same file)");
ok(/startedAt, startedAt \+ duration\] is the honest window/.test(wellSrc),
  "the well's docstring states the honest-window law (same line)");
ok(/updatedAt is NOT a window/.test(wellSrc),
  "the well's docstring disowns updatedAt as a window (same line)");
ok(/start ascending, name breaking ties/.test(wellSrc),
  "the well's docstring states the sort law (same line)");

/* ------------------------------------------------------------------ */
section("T3 — tool shape (the 25th tool, zero knobs)");

ok(AI_TOOLS.length === 31, `AI_TOOLS holds 31 tools — t517's cleanup plan is the newest birth (got ${AI_TOOLS.length})`);
const tool = AI_TOOLS.find((t) => t.name === "get_session_timeline") as
  | (typeof AI_TOOLS[number] & { description: string })
  | undefined;
ok(tool != null, "get_session_timeline is in the catalog");
const schema = tool?.parameters as {
  type: string;
  properties: Record<string, unknown>;
  additionalProperties: boolean;
} | null;
ok(schema?.type === "object" && schema.additionalProperties === false,
  "schema: object, additionalProperties:false — zero knobs (a walk is a walk)");
ok(Object.keys(schema?.properties ?? {}).length === 0, "no properties — the session's time is one read, not a filtered one");

const desc = tool?.description ?? "";
ok(/THE tool for/.test(desc), "the description names its THE-tool question");
ok(/a time question is a READ/.test(desc), "the description carries the read-not-arithmetic law");
ok(/updatedAt is NOT a window/.test(desc), "the description disowns updatedAt (same line as the law)");
ok(/honest window/.test(desc), "the description carries the honest-window phrase");
ok(/never arithmetic from receipts/.test(desc), "the description closes the receipts loophole");

const toolsSrc = read("src/lib/ai/tools.ts");
ok(/case "get_session_timeline":\s*\n\s*return await getSessionTimeline\(ctx\);/.test(toolsSrc),
  "the dispatch wires the tool to its executor");

/* ------------------------------------------------------------------ */
section("T4 — walk law (the executor reads the well, never receipts)");

const execBody = toolsSrc.slice(toolsSrc.indexOf("async function getSessionTimeline"));
ok(/walkTimeline\(/.test(execBody), "the executor drinks the well (no private window arithmetic)");
ok(/from "@\/lib\/duration"/.test(toolsSrc) && /fmtDuration/.test(execBody),
  "the human words are the inspector's own fmtDuration (same dialect, two faces)");
ok(!/toLocaleTimeString/.test(toolsSrc),
  "ISO-only absolute stamps — a server clock's locale never lies about time zones");
ok(/toISOString\(\)/.test(execBody), "the executor stamps ISO");
ok(/\.slice\(0, 3\)/.test(execBody), "the longest read is a top-3 (the '哪一步最耗时' answer pre-computed)");
// t505 — the reduce moved into the well (timelineLedger): the report's
// glance drinks the same arithmetic, so the executor now reads the
// ledger instead of hand-summing. Same numbers, one arithmetic.
ok(/timelineLedger\(walk\.rows\)/.test(execBody), "the busy total and the leaders are the well's ledger read (t505: one arithmetic, the report drinks it too)");
ok(!/\.reduce\(/.test(execBody), "no hand-rolled sum left behind — the ledger owns the reduce now");
ok(/timelineSharePct\(r\.ms, walk\.span\)/.test(execBody), "each run's share of the span is the well's own arithmetic (t506: the CSV drinks the same share)");
ok(/parallel runs double-count/.test(execBody), "the busy line confesses the overlap (an honest sum says so)");
ok(/counted, not invented/.test(execBody), "the absentees line keeps the honest-accounting phrase");
ok(/time spent failing is real time/.test(execBody), "the failed line keeps the real-time phrase");
ok(/const runRows = walk\.rows\.map\(/.test(execBody),
  "the runs travel in the walk's own order (chronological — no re-sort, no dialect fork)");
ok(/endedAt: r\.job\.status === "running" \? null : iso\(r\.end\)/.test(execBody),
  "a live run's endedAt stays null (the window is open, the data says so)");

/* ------------------------------------------------------------------ */
section("T5 — neighbors (each face keeps its own dialect)");

const stateBody = toolsSrc.slice(toolsSrc.indexOf("async function getWorkflowState"));
ok(!/duration/.test(stateBody.split("async function ")[1] ?? ""),
  "get_workflow_state keeps the canvas map's dialect (no time fields — the timeline tool is the time read)");
ok(AI_TOOLS.some((t) => t.name === "get_map_landscape"), "t501's landscape read stays in the catalog");
ok(AI_TOOLS.some((t) => t.name === "get_curve_verdicts"), "t503's verdicts read stays in the catalog");
ok(AI_TOOLS.some((t) => t.name === "get_funnel_chain"), "the funnel ledger read stays in the catalog");

ok(fmtDuration(9_000) === "9s" && fmtDuration(161_000) === "2m 41s" && fmtDuration(0) === "—",
  "fmtDuration's dialect is untouched (behavior unchanged by construction)");

const engineSrc = read("src/lib/relion/engine.ts");
ok(/duration: Math\.max\(1000, elapsed\)/.test(engineSrc),
  "the engine's write-side floor is alive (the well's read-side floor mirrors it)");

/* ------------------------------------------------------------------ */
console.log(`\n=== t504 — session timeline: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
