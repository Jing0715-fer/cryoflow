/**
 * t508-sweep-tool-bench.ts — The Sweep Learns to Answer.
 *
 * The sweep verdict is the Session QC report's last family without an
 * AGENT face: the paper binds it verbatim (t197), the CSV export speaks
 * raw minutes, but the model could only guess which profile won. t508
 * hands the client's last race to the executor (session memory rides
 * every chat request, boundary-guarded) and the tool words the answer
 * through the paper's OWN builder — byte for byte, never a paraphrase,
 * never an invented winner.
 *
 *   T1  the guard   — parseSweepSnapshot: shape, dangling bestId,
 *                     oversized roster, junk → honest null
 *   T2  the tool    — no race says the report's empty-state dialect;
 *                     a race returns the report's own md bytes
 *   T3  the wire    — panel rides lastSweep, route parses, agent
 *                     guards into ctx (one testimony, three hops)
 *   T4  the catalog — roster entry, zero knobs, description laws
 *   T5  neighbors   — the paper's sweep section and its siblings
 *                     keep their bytes
 */

import { readFileSync } from "fs";
import path from "path";
import { executeAiTool, type AgentCtx } from "../src/lib/ai/tools";
import { parseSweepSnapshot, buildSweepReport, type SweepRow } from "../src/lib/qc-report";

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

const prof = (id: string, name: string): SweepRow["p"] => ({
  id,
  name,
  gpuModel: "A100",
  gpusPerNode: 4,
  nodes: 2,
  arrayConcurrency: 2,
  gpuSpeedup: 3,
});
const RACE: SweepRow[] = [
  { p: prof("a", "Base GPU"), r: { makespanMin: 120, gpuUtilization: 0.8, avgWaitMin: 12, totalGpuHours: 40 } },
  { p: prof("b", "Turbo GPU"), r: { makespanMin: 90, gpuUtilization: 0.9, avgWaitMin: 8, totalGpuHours: 55 } },
  { p: prof("c", "Broken queue"), err: "sim refused" },
];

/* ------------------------------------------------------------------ */
section("T1 — the guard (parseSweepSnapshot: honest null, never a half verdict)");

ok(parseSweepSnapshot(null) === null, "null → null");
ok(parseSweepSnapshot("race") === null, "a string is not a race → null");
ok(parseSweepSnapshot({ rows: [], bestId: null }) === null, "zero contestants → null (a race with nobody is not a race)");
ok(parseSweepSnapshot({ rows: Array.from({ length: 65 }, (_, i) => ({ p: prof(`p${i}`, `P${i}`) })), bestId: null }) === null,
  "65 rows → refused, not truncated (dropping contestants changes the verdict)");
ok(parseSweepSnapshot({ rows: [{ p: { id: "a" } }], bestId: null }) === null, "a profile missing its fields → null");
ok(
  parseSweepSnapshot({ rows: [{ p: prof("a", "Base"), r: { makespanMin: NaN, gpuUtilization: 1, avgWaitMin: 1, totalGpuHours: 1 } }], bestId: null }) === null,
  "a NaN measurement → null (a verdict built on NaN is a guess)",
);
ok(
  parseSweepSnapshot({ rows: RACE, bestId: "missing" }) === null,
  "a dangling bestId → null (the winner must be a contestant — a dangling id would flip the md into its none-finished branch)",
);
ok(
  parseSweepSnapshot({ rows: RACE, bestId: "b", junk: "strip me" })?.rows.length === 3,
  "a well-formed race passes and rides clean (unknown fields never enter the ctx)",
);
const guarded = parseSweepSnapshot({ rows: [{ p: prof("c", "Broken queue"), r: { makespanMin: 1, gpuUtilization: 0.5, avgWaitMin: 1, totalGpuHours: 1 }, err: 42 }], bestId: null });
ok(guarded === null, "a non-string err → null");
const failedRow = parseSweepSnapshot({ rows: [{ p: prof("c", "Broken queue"), err: "sim refused" }], bestId: null });
ok(failedRow !== null && failedRow.rows[0].r === undefined && failedRow.rows[0].err === "sim refused",
  "a failed profile (err, no r) is a legal contestant");

/* ------------------------------------------------------------------ */
section("T2 — the tool (the report's own words, byte for byte)");

const emptyCtx: AgentCtx = { projectId: "p", sweep: null };
const emptyAwaited = await executeAiTool("get_sweep_verdict", {}, emptyCtx);
ok(emptyAwaited.ok === true, "no race is not a failure — the tool speaks");
ok(
  (emptyAwaited as { summary: string }).summary.startsWith("No scheduling sweep has run in this session yet — open the HPC queue panel and run Compare profiles"),
  "the no-race dialect IS the report's empty-state sentence (one race, one sentence, two faces)",
);

const raceCtx: AgentCtx = { projectId: "p", sweep: parseSweepSnapshot({ rows: RACE, bestId: "b" }) };
const racedAwaited = (await executeAiTool("get_sweep_verdict", {}, raceCtx)) as {
  ok: boolean;
  summary: string;
  detail?: { sweep_report_md?: string };
};
ok(racedAwaited.ok === true, "a race on record answers");
ok(
  racedAwaited.detail?.sweep_report_md === buildSweepReport(RACE, "b"),
  "the annex is the report's OWN builder output — byte for byte, never a paraphrase",
);
ok(
  racedAwaited.summary.includes("winner: Turbo GPU") && racedAwaited.summary.includes("2 measured, 1 failed"),
  "the summary is a locator (counts + winner name), never a re-derived verdict sentence",
);
const noWinnerCtx: AgentCtx = { projectId: "p", sweep: parseSweepSnapshot({ rows: RACE, bestId: null }) };
const noWinnerAwaited = await executeAiTool("get_sweep_verdict", {}, noWinnerCtx);
ok(!noWinnerAwaited.summary.includes("winner:"), "a race with no winner bound speaks no winner (never invents)");

/* ------------------------------------------------------------------ */
section("T3 — the wire (one testimony, three hops)");

const routeSrc = read("src/app/api/ai/chat/route.ts");
ok(/sweep\?: unknown/.test(routeSrc), "the route's body type carries the sweep field");
ok(/sweep: body\.sweep,/.test(routeSrc), "the route hands the testimony to the agent unchanged");
const agentSrc = read("src/lib/ai/agent.ts");
ok(/sweep\?: unknown;/.test(agentSrc), "the agent's input accepts the testimony");
ok(/parseSweepSnapshot\(input\.sweep\)/.test(agentSrc), "the ctx build boundary-guards it (off-shape → null)");
ok(
  /sweep: parseSweepSnapshot\(input\.sweep\)/.test(agentSrc),
  "the ctx carries the guarded snapshot, not the raw wire",
);
const panelSrc = read("src/components/ai/assistant-panel.tsx");
ok(/sweep: useWorkflowStore\.getState\(\)\.lastSweep,/.test(panelSrc), "the panel rides the store's freshest race on every request");

/* ------------------------------------------------------------------ */
section("T4 — the catalog (roster entry, zero knobs, description laws)");

const toolsSrc = read("src/lib/ai/tools.ts");
ok(/name: "get_sweep_verdict",/.test(toolsSrc), "the roster names the tool");
ok(
  toolsSrc.indexOf('name: "get_sweep_verdict"') > toolsSrc.indexOf('name: "get_session_timeline"'),
  "the sweep tool sits beside the other read-tools (timeline, then sweep)",
);
ok(
  /never invents a winner/.test(toolsSrc),
  "the description states the honesty law (never invents a winner)",
);
ok(
  /Session memory, not a database/.test(toolsSrc),
  "the description states the memory law (a race is session state, a reload is a new session)",
);
ok(/function getSweepVerdict\(ctx: AgentCtx\): AiToolResult/.test(toolsSrc), "the handler is a pure read (no db, no fs)");
ok(
  !/prisma|await db\./.test(toolsSrc.slice(toolsSrc.indexOf("function getSweepVerdict"), toolsSrc.indexOf("async function getSessionTimeline"))),
  "the sweep executor touches no database — the client's testimony is the only source",
);
ok(
  /sweep\??: SessionSweepState \| null/.test(toolsSrc),
  "AgentCtx carries the guarded snapshot (the type says what the tool may quote)",
);

/* ------------------------------------------------------------------ */
section("T5 — neighbors (each sibling keeps its own bytes)");

const qcSrc = read("src/lib/qc-report.ts");
ok(/lines\.push\("# HPC sweep — cluster profile comparison", ""\);/.test(qcSrc), "the paper's sweep section keeps its own builder");
ok(/No sweep raced this session — open the HPC queue panel and run \*Compare profiles\*/.test(qcSrc), "the report's empty state keeps its sentence (the tool's no-race dialect echoes it)");
ok(/export const parseSweepSnapshot/.test(qcSrc), "the boundary guard lives beside the type it guards");
ok(/sweep: lastSweep \? buildSweepReport\(lastSweep\.rows, lastSweep\.bestId\) : null,/.test(read("src/components/workflow/session-report-dialog.tsx")),
  "the report's sweep binding untouched (the paper still binds the store's race verbatim)");
ok(/name: "get_session_timeline",/.test(toolsSrc) && /name: "get_map_landscape",/.test(toolsSrc), "the t501/t504 tools keep their seats");

console.log(`\n=== t508 — sweep tool: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
