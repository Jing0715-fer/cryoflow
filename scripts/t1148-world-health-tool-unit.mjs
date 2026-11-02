#!/usr/bin/env node
/**
 * t1148 — THE WORLD-HEALTH-TOOL unit: the health board's AGENT face.
 *
 * The board learned to speak in t1133 (engine + pipeline verdicts) and
 * t1140/t1143 (the jobs' own face). Thirty-three agent tools could read
 * the roster, the box and the time — none could answer "how is the
 * pipeline DOING?" with the board's own words. The cure: a PURE
 * presenter (src/lib/ai/world-health-present.ts — the t530 shape: the
 * bench imports it without dragging the tool executor's world) that
 * feeds the THREE fathers and speaks their rows byte for byte, a well
 * in tools.ts that only feeds (db roster + wires + the polite engine
 * probe), and the prompt's HEALTH LAW (never re-derive a diagnosis from
 * the raw roster).
 *
 * A — the presenter run FOR REAL: the green world, the failure named,
 *     the engine's honest absence (and its provenance words), the pace
 *     judgment riding through, the empty world, the waiting row, the
 *     determinism, the multi-workspace scope note, and the annex
 *     byte-equal to the fathers' own outputs.
 * B — the tools.ts source-pinned: the zero-knob schema, the cousins
 *     named, the case routed, the well's feed (no status counting, no
 *     second formatter, no forced probe), the ISO mapping's honesty.
 * C — the doctrine: the prompt's HEALTH LAW, the pure module's ONE
 *     father imports, the purity law (now rides the input).
 *
 * node scripts/unit-runner.mjs scripts/t1148-world-health-tool-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  worldHealthRows,
  worldJobRows,
  worldVitalsOf,
} from "@/lib/world-vitals";
import {
  presentWorldHealth,
} from "@/lib/ai/world-health-present";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const toolsSrc = readFileSync(join(ROOT, "src/lib/ai/tools.ts"), "utf8");
const promptSrc = readFileSync(join(ROOT, "src/lib/ai/prompt.ts"), "utf8");
const presentSrc = readFileSync(
  join(ROOT, "src/lib/ai/world-health-present.ts"),
  "utf8",
);

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}`);
  }
}

/* ---------- fixtures ---------- */

const NOW = 1_700_000_000_000; // a fixed clock — the unit owns time
const iso = (ms) => new Date(ms).toISOString();
const ENGINE_OK = {
  found: true,
  execution: "native",
  version: "5.0.1",
  path: "/usr/local/bin/relion",
  source: "PATH",
  wsl: { available: false },
  binaries: [{ name: "relion_refine", present: true }],
  externals: [{ name: "ctffind", present: true }],
  checkedAt: iso(NOW - 60_000),
  installs: [],
  selectedId: null,
  autoPicked: false,
};
const completed = (name, minutesAgo, ranMin) => ({
  name,
  status: "completed",
  result: "Done",
  startedAt: iso(NOW - minutesAgo * 60_000 - (ranMin ?? 1) * 60_000),
  updatedAt: iso(NOW - minutesAgo * 60_000),
  duration: (ranMin ?? 1) * 60_000,
});

/* ---------- A — the presenter run FOR REAL ---------- */

console.log("A — the presenter run FOR REAL (the fathers' words, composed)");

// A1 — the green world: every row ok, the counts spoken, the probe fresh.
const green = presentWorldHealth({
  projectName: "Demo",
  jobs: [completed("Motion 1", 5, 1), completed("CTF 1", 4, 1), completed("2D 1", 2, 2)],
  edges: [{ id: "e1" }, { id: "e2" }],
  engine: ENGINE_OK,
  engineProbeFailed: false,
  now: NOW,
  workspaceCount: 1,
});
const g = green.detail;
ok("A1 the green read speaks ok and the world's own counts", green.ok === true &&
  green.summary.includes('Pipeline "Demo": 3 jobs — 3 completed, 0 failed, 0 running, 0 not started.'));
ok("A1 the green summary claims green and points at the annex", green.summary.includes("The board is green — every row speaks ok.") &&
  green.summary.includes("The annex is the health board's own rows byte for byte"));
ok("A1 the verdicts all ok and the jobs' face speaks Fresh + Marathon",
  g.verdicts.every((r) => r.ok) &&
    g.jobs.some((r) => r.key === "fresh-completion") &&
    g.jobs.some((r) => r.key === "marathon"));
ok("A1 the engine row rides the father's own words (native, fresh probe)",
  g.verdicts.some((r) => r.key === "engine" && r.detail === "RELION 5.0.1 · native") &&
    g.engineProbe === "fresh");

// A2 — the failure named in the run's own words.
const failed = presentWorldHealth({
  projectName: "Demo",
  jobs: [
    completed("Motion 1", 30, 1),
    { name: "2D 1", status: "failed", result: "Killed — host OOM under the census load", startedAt: iso(NOW - 20 * 60_000), updatedAt: iso(NOW - 10 * 60_000), duration: null },
  ],
  edges: [{ id: "e1" }],
  engine: ENGINE_OK,
  now: NOW,
});
ok("A2 the failures verdict counts and the last-failure row NAMES the run",
  failed.detail.verdicts.some((r) => r.key === "failures" && !r.ok && r.detail.includes("1 failed job")) &&
    failed.detail.jobs.some((r) => r.key === "last-failure" && r.detail.includes("2D 1 — Killed — host OOM")));
ok("A2 the summary names both warn rows (Failures, Last failure)",
  failed.summary.includes("The board speaks 2 warn rows: Failures, Last failure."));

// A3 — the engine's honest absence (the probe THREW — provenance said).
const noProbe = presentWorldHealth({
  projectName: "Demo",
  jobs: [completed("Motion 1", 5, 1)],
  edges: [{ id: "e1" }],
  engine: null,
  engineProbeFailed: true,
  now: NOW,
});
ok("A3 the engine row is the father's own absence face, verbatim",
  noProbe.detail.verdicts.some((r) => r.key === "engine" &&
    r.detail === "the engine status hasn't arrived yet — the page is still reading it"));
ok("A3 the provenance line names the thrown probe and the summary names Engine",
  noProbe.detail.engineProbe === "failed" &&
    noProbe.summary.includes("The engine probe itself threw on the server — the Engine row is the board's own honest-absence face, not a verdict.") &&
    noProbe.summary.includes("Engine"));

// A4 — a null engine WITHOUT a thrown probe is 'absent' (the total shape).
const absent = presentWorldHealth({
  projectName: "Demo",
  jobs: [completed("Motion 1", 5, 1)],
  edges: [{ id: "e1" }],
  engine: null,
  now: NOW,
});
ok("A4 the absent engine's provenance word is the honest 'absent'", absent.detail.engineProbe === "absent");

// A5 — the pace judgment rides through (the completions' own median).
const slow = presentWorldHealth({
  projectName: "Demo",
  jobs: [
    completed("Motion 1", 40, 1),
    completed("CTF 1", 30, 1),
    completed("2D 1", 20, 1),
    { name: "3D 1", status: "running", result: null, startedAt: iso(NOW - 5 * 60_000), updatedAt: iso(NOW - 60_000), duration: null },
  ],
  edges: [{ id: "e1" }],
  engine: ENGINE_OK,
  now: NOW,
});
ok("A5 the oldest running is judged by the world's own pace (warn face through)",
  slow.detail.jobs.some((r) => r.key === "oldest-running" && r.ok === false &&
    r.detail.includes("outlasted the usual run (median")) &&
  slow.summary.includes("Working now"));

// A6 — the empty world is a world too (the fathers' own absences).
const empty = presentWorldHealth({
  projectName: "Fresh",
  jobs: [],
  edges: [],
  engine: ENGINE_OK,
  now: NOW,
});
ok("A6 the empty summary speaks is-empty and the rows speak the fathers' absences",
  empty.summary.startsWith('Pipeline "Fresh" is empty (0 jobs).') &&
    empty.detail.verdicts.some((r) => r.key === "pipeline" && r.detail === "an empty canvas — nothing to wire yet") &&
    empty.detail.verdicts.some((r) => r.key === "failures" && r.detail === "no failed jobs in this workspace") &&
    empty.detail.jobs.length === 0);

// A7 — the waiting row is a fact (ok:true), never a verdict.
const waiting = presentWorldHealth({
  projectName: "Demo",
  jobs: [
    completed("Motion 1", 40, 1),
    { name: "CTF 1", status: "pending", result: null, startedAt: null, updatedAt: iso(NOW - 3 * 60_000), duration: null },
  ],
  edges: [{ id: "e1" }],
  engine: ENGINE_OK,
  now: NOW,
});
ok("A7 the oldest waiting speaks its patience as a fact (ok:true)",
  waiting.detail.jobs.some((r) => r.key === "oldest-pending" && r.ok === true &&
    r.detail.includes("the oldest waited")));

// A8 — the wsl + cached engine rides the father's bridge words.
const wsl = presentWorldHealth({
  projectName: "Demo",
  jobs: [completed("Motion 1", 5, 1)],
  edges: [{ id: "e1" }],
  engine: { ...ENGINE_OK, execution: "wsl", fromCache: true },
  now: NOW,
});
ok("A8 the wsl bridge and the cached probe ride the father's own words",
  wsl.detail.verdicts.some((r) => r.key === "engine" && r.detail === "RELION 5.0.1 · WSL bridge · cached probe (re-verifying)") &&
    wsl.detail.engineProbe === "cached");

// A9 — determinism: the same input speaks the same words, byte for byte.
const again = presentWorldHealth({
  projectName: "Demo",
  jobs: [completed("Motion 1", 5, 1), completed("CTF 1", 4, 1), completed("2D 1", 2, 2)],
  edges: [{ id: "e1" }, { id: "e2" }],
  engine: ENGINE_OK,
  engineProbeFailed: false,
  now: NOW,
  workspaceCount: 1,
});
ok("A9 the read is deterministic (the same world, the same bytes)",
  JSON.stringify(green) === JSON.stringify(again));

// A10 — the multi-workspace scope note: said aloud, then silent.
const multi = presentWorldHealth({
  projectName: "Wide",
  jobs: [completed("Motion 1", 5, 1)],
  edges: [{ id: "e1" }],
  engine: ENGINE_OK,
  now: NOW,
  workspaceCount: 3,
});
ok("A10 the multi-workspace read says its scope aloud (summary + annex)",
  multi.summary.includes("3 workspaces' jobs in one read") &&
    multi.detail.scope.includes("3 workspaces") &&
    !green.summary.includes("workspaces' jobs"));

// A11 — the annex IS the fathers' output (the composition's own pin).
// The raw call feeds the SAME roster the green read was given (the
// t1147 lesson: a fixture must model the world it hunts).
const greenRoster = [
  completed("Motion 1", 5, 1),
  completed("CTF 1", 4, 1),
  completed("2D 1", 2, 2),
];
const greenEdges = [{ id: "e1" }, { id: "e2" }];
const rawVerdicts = worldHealthRows(worldVitalsOf(greenRoster, greenEdges), ENGINE_OK);
const rawJobs = worldJobRows(greenRoster, NOW);
ok("A11 the annex's rows are the fathers' own outputs byte for byte",
  JSON.stringify(green.detail.verdicts) === JSON.stringify(rawVerdicts.map((r) => ({ key: r.key, label: r.label, ok: r.ok, detail: r.detail }))) &&
    JSON.stringify(green.detail.jobs) === JSON.stringify(rawJobs.map((r) => ({ key: r.key, label: r.label, ok: r.ok, detail: r.detail }))));

/* ---------- B — the tools.ts source-pinned ---------- */

console.log("B — the well and the schema, source-pinned (the file's own bytes)");

const schemaStart = toolsSrc.indexOf('name: "get_world_health"');
const schemaEnd = toolsSrc.indexOf('name: "get_continue_sources"', schemaStart);
const schemaSlice = schemaStart > -1 && schemaEnd > schemaStart ? toolsSrc.slice(schemaStart, schemaEnd) : "";
const wellStart = toolsSrc.indexOf("async function getWorldHealth");
const wellEnd = toolsSrc.indexOf("/* ---- get_continue_sources", wellStart);
const wellSlice = wellStart > -1 && wellEnd > wellStart ? toolsSrc.slice(wellStart, wellEnd) : "";

ok("B1 the tool is registered with ZERO knobs (the walk is the board's walk)",
  schemaSlice.length > 0 &&
    schemaSlice.includes('parameters: { type: "object", properties: {}, additionalProperties: false }') &&
    !schemaSlice.includes("required:"));
ok("B2 the description names its cousins and its own cup",
  schemaSlice.includes("get_workflow_state") && schemaSlice.includes("get_system_diagnostics") &&
    schemaSlice.includes("get_session_timeline") && schemaSlice.includes("THE tool for") &&
    schemaSlice.includes("byte for byte, never a re-derivation"));
ok("B3 the switch routes the read to its well",
  toolsSrc.includes('case "get_world_health":') &&
    toolsSrc.includes("return await getWorldHealth(ctx);"));
ok("B4 the well drinks the PURE presenter (the t530 shape — the bench's lane stays clean)",
  toolsSrc.includes('import { presentWorldHealth, type WorldHealthToolResult } from "@/lib/ai/world-health-present";'));
ok("B5 the well guards the project with the house line",
  wellSlice.includes("getActiveProject()") && wellSlice.includes('"No active project"'));
ok("B6 the probe is the POLITE read (never forced — the Re-detect button's job)",
  wellSlice.includes("await detectRelion()") && !wellSlice.includes("detectRelion(true)"));
ok("B7 the roster mapping is honest (ISO stamps, the null startedAt survives)",
  (wellSlice.match(/toISOString\(\)/g) || []).length === 2 &&
    wellSlice.includes("j.startedAt ? j.startedAt.toISOString() : null"));
ok("B8 the well's clock is the read's own now (the annex's readAt means something)",
  wellSlice.includes("now: Date.now()"));
ok("B9 the scope is computed from the roster's own workspaces (never guessed)",
  wellSlice.includes('new Set(jobs.map((j) => j.workspaceId ?? "null")).size'));

/* ---------- C — the doctrine + the purity laws ---------- */

console.log("C — the doctrine source-pinned, the fathers' exclusivity");

ok("C1 the prompt's HEALTH LAW names the tool and the re-derivation refusal",
  promptSrc.includes("17. THE HEALTH LAW") &&
    promptSrc.includes("get_world_health FIRST") &&
    promptSrc.includes("NEVER re-derive a diagnosis"));
ok("C2 the law draws the cousin lines (one job's story, the box's memory)",
  promptSrc.includes("One job's story stays with inspect_job") &&
    promptSrc.includes("get_system_diagnostics"));
ok("C3 the presenter imports the THREE fathers (the one-father law at the door)",
  presentSrc.includes("worldVitalsOf") && presentSrc.includes("worldHealthRows") &&
    presentSrc.includes("worldJobRows"));
ok("C4 the presenter is pure — the clock rides the input (never Date.now())",
  !/\bDate\.now\(\)/.test(presentSrc.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")) &&
    presentSrc.includes("now: number"));
ok("C5 the well feeds, never computes — no status counting, no second formatter inside",
  !/status === "/.test(wellSlice) && !wellSlice.includes("worldAgeWords") &&
    !wellSlice.includes("clockWordsOf") && !wellSlice.includes("durationMsOf") &&
    !wellSlice.includes(".sort("));

/* ---------- receipt ---------- */
console.log(`\nWORLD-HEALTH-TOOL-UNIT t1148: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
