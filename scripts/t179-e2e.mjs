/* t179 — the pipeline earns its replay script.
 *
 * The per-job launch contract (Task 170: /api/jobs/[id]/command) answered
 * "what will launching THIS run?" — but the project-level artifact, the
 * one a builder user actually walks away with, never existed: the JSON
 * export is CryoFlow-internal (graph + params), the report is per-run.
 * Task 179 adds
 *   GET /api/projects/[id]/pipeline-script
 *     — ONE shell script: Kahn topological order over the project's
 *       edges (createdAt tie-break → deterministic), per step the SAME
 *       three honest tiers the preview speaks (native comment block /
 *       real argv via buildArgv / canonical template + reason), replay
 *       semantics by status (done+idle live, run/wait/fail commented),
 *       set -eu, ONE clock read for the whole artifact.
 *   PipelineScriptDialog + palette row (preview before download —
 *       the sbatch dialog's family pattern).
 *   shellJoin moved into pipeline-script.ts — one quoting implementation,
 *       two consumers (preview + script cannot drift apart).
 *
 * Assertions: S baseline · X source oracles · B live API contract
 * (topo order over the real edges, census math, environment-immune
 * CLI-tier invariant, determinism, READ-ONLY dir-listing identity) ·
 * M/D the palette→dialog flow on mobile + desktop · Z roster identity.
 */
import { chromium } from "playwright";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");

let pass = 0;
const failures = [];
function must(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}
function section(name) {
  console.log(`== ${name} ==`);
}

const browser = await chromium.launch();
const consoleErrors = [];
const failedUrls = [];
function trackConsole(pageRef, label) {
  pageRef.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ label, text: msg.text() });
  });
  pageRef.on("requestfailed", (req) => {
    failedUrls.push({ label, url: req.url() });
  });
  pageRef.on("response", (res) => {
    if (res.status() >= 400) failedUrls.push({ label, url: res.url(), status: res.status() });
  });
}

/* ================= S — baseline ================= */
section("S: baseline world");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
const roster0 = jobs0.map((j) => ({ id: j.id, name: j.name }));
must(roster0.length === 26, `S1 roster 26 jobs (${roster0.length})`);
const projectId = jobs0[0]?.projectId ?? "";
must(!!projectId, "S2 projectId resolvable");
const nativeJob = jobs0.find((j) => j.type === "import" && j.status === "completed");
must(!!nativeJob, "S3 native target found (completed import)");
const cliDone = jobs0.find((j) => !["import","manualpick","select","select2d","symexpand","rebalance"].includes(j.type) && j.status === "completed");
must(!!cliDone, "S4 completed CLI target found");
const failedJob = jobs0.find((j) => j.status === "failed");
const runningJob = jobs0.find((j) => j.status === "running");
must(!!failedJob && !!runningJob, "S5 failed + running targets found");

// read-only witness: the project's relion dir listing must survive the
// whole probe untouched (an export that litters disk is a leak with a
// download button — the command route's contract, project-wide).
const projDir = path.resolve("data/relion", projectId);
const listingBefore = readdirSync(projDir).sort().join("|");

try {
  const libSrc = src("src/lib/relion/pipeline-script.ts");
  const routeSrc = src("src/app/api/projects/[id]/pipeline-script/route.ts");
  const cmdRouteSrc = src("src/app/api/jobs/[id]/command/route.ts");
  const paletteSrc = src("src/components/workflow/command-palette.tsx");
  const dlgSrc = src("src/components/workflow/pipeline-script-dialog.tsx");

  /* ================= X — source oracles ================= */
  section("X: source oracles");
  const has = (s, needle) => s.includes(needle);
  must(has(libSrc, 'import { COMMAND_TEMPLATES, ENGINE_NATIVE_TYPES } from "./command-templates"'),
    "X1 the shared tables are imported (no second copy of the catalog)");
  must(!has(libSrc, "relion_run_motioncorr --i") && !has(libSrc, "mpirun -n 2 relion_refine"),
    "X2 no template body copy in the lib (t166 doctrine: one source of truth)");
  must(has(libSrc, "export async function buildPipelineScript") &&
       has(libSrc, "function topoOrder") && has(libSrc, "export function shellJoin"),
    "X3 builder + topo + shellJoin exported");
  must(has(cmdRouteSrc, 'import { shellJoin } from "@/lib/relion/pipeline-script"'),
    "X4 the command route consumes the shared shellJoin (one quoting rule, two consumers)");
  must(!/function shellJoin/.test(cmdRouteSrc),
    "X5 the command route no longer carries its own quoting copy");
  // THE READ-ONLY CONTRACT — comment-stripped scan (t170's method: the
  // contract's own docstring names the banned vocabulary; an oracle that
  // matches its subject's comments is not an oracle).
  const stripComments = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const libCode = stripComments(libSrc);
  const routeCode = stripComments(routeSrc);
  for (const banned of ["mkdirSync", "writeFileSync", "spawn(", "execFile", "spawnTrackedRun"]) {
    must(!has(libCode, banned) && !has(routeCode, banned),
      `X6 read-only: no ${banned} (lib + route, comment-stripped)`);
  }
  must(!/\.update\(|\.delete\(|\.create\(/.test(routeCode),
    "X7 route performs no prisma mutation");
  must(has(libCode, 'push("set -eu")'),
    "X8 the script stops at its first failure (set -eu emitted)");
  for (const m of ["done", "idle", "run", "wait", "fail", "native"]) {
    must(has(libCode, `"${m}"`), `X9 marker dialect member: ${m}`);
  }
  must(has(libCode, "new Date().toISOString()") &&
       (libCode.match(/new Date\(\)/g) || []).length === 1,
    "X10 ONE clock read — the header and generatedAt share one instant");
  must(has(paletteSrc, "Export pipeline as shell script") && has(paletteSrc, "FileTerminal"),
    "X11 palette row pinned (label + icon)");
  for (const pin of ['data-canvas-ui="pipeline-script-dialog"', 'data-canvas-ui="pipeline-script-pre"',
    'data-canvas-ui="pipeline-script-copy"', 'data-canvas-ui="pipeline-script-download"',
    'data-canvas-ui="pipeline-script-stats"']) {
    must(has(dlgSrc, pin), `X12 dialog pin: ${pin}`);
  }
  must(has(dlgSrc, "/api/projects/${projectId}/pipeline-script"),
    "X13 dialog fetches the project-level route");

  /* ================= B — live API contract ================= */
  section("B: live pipeline-script API");
  const api = async (p) => {
    const r = await fetch(BASE + p);
    let body = null;
    try { body = await r.json(); } catch { /* non-JSON */ }
    return { status: r.status, body };
  };
  const d1 = await api(`/api/projects/${projectId}/pipeline-script`);
  must(d1.status === 200 && d1.body?.script, "B1 200 with a script body");
  const P = d1.body;
  must(P.projectName && typeof P.projectName === "string" && P.projectName.length > 0,
    `B2 projectName rides along (${P.projectName})`);
  must(P.script.startsWith("#!/bin/sh"), "B3 the script is a sh script (shebang first line)");
  must(P.script.includes(`CryoFlow pipeline replay — ${P.projectName}`),
    "B4 header names the project");
  must(P.script.includes("set -eu"), "B5 set -eu present in the emitted text");
  must(P.stats.jobs === P.steps.length && P.steps.length === roster0.length,
    `B6 census: stats.jobs ${P.stats.jobs} == steps ${P.steps.length} == roster ${roster0.length}`);
  const sum = P.stats.done + P.stats.idle + P.stats.run + P.stats.wait + P.stats.fail + P.stats.native;
  must(sum === P.stats.jobs, `B7 marker census sums to jobs (${sum})`);
  // marker lines: exactly one per step, at the step's recorded line
  const lines = P.script.split("\n");
  const markerLines = P.steps.map((s) => lines[s.line]);
  must(markerLines.every((l) => /^# \[(done|idle|run|wait|fail|native)\] /.test(l)),
    "B8 every step's recorded line is its marker line (unambiguous block parse)");
  must(new Set(markerLines).size === markerLines.length,
    "B9 marker lines are unique (one block per step)");
  const nativeSteps = P.steps.filter((s) => s.marker === "native");
  must(nativeSteps.length === P.stats.native && nativeSteps.length > 0 &&
       nativeSteps.every((s) => s.command === "") &&
       nativeSteps.every((s) => lines[s.line + 1]?.startsWith("#          workdir:")),
    `B10 native steps are comment-only with a workdir line (${nativeSteps.length} steps)`);
  must(nativeSteps.some((s) => lines[s.line].includes("(import)") || lines[s.line].includes("(select") || lines[s.line].includes("(symexpand") || lines[s.line].includes("(rebalance")),
    "B11 a known native type appears as a native step");
  // THE ENVIRONMENT-IMMUNE CLI-TIER INVARIANT: live commands exist iff
  // RELION is detected AND the step is done/idle; otherwise the reason
  // rides along. The probe branches on the API's own relion verdict so it
  // passes with or without the toolchain (t170's environment immunity).
  const cliSteps = P.steps.filter((s) => s.marker !== "native");
  const liveSteps = cliSteps.filter((s) => s.command !== "");
  if (P.relion.found) {
    must(liveSteps.every((s) => s.marker === "done" || s.marker === "idle") &&
         cliSteps.filter((s) => s.marker === "done" || s.marker === "idle").every((s) => s.command !== ""),
      "B12 RELION present: done/idle CLI steps carry live commands, blocked ones don't");
  } else {
    must(liveSteps.length === 0 &&
         cliSteps.every((s) => typeof s.note === "string" && s.note.length > 0),
      `B12 RELION absent: every CLI step is a commented template with its reason (${cliSteps.length} steps, 0 live)`);
    must(cliSteps.some((s) => lines[s.line + 3]?.includes("relion_") || lines[s.line + 2]?.includes("relion_") || lines[s.line + 4]?.includes("relion_")),
      "B13 the canonical template line rides under the reason (the fallback contract)");
  }
  // status semantics
  const failStep = P.steps.find((s) => s.marker === "fail");
  must(!!failedJob && !!failStep && failStep.jobId === failedJob.id &&
       /run\.err/.test(failStep.note ?? ""),
    "B14 the failed job exports as [fail] with an inspect note");
  const runStep = P.steps.find((s) => s.marker === "run");
  must(!!runningJob && !!runStep && runStep.jobId === runningJob.id &&
       (runStep.note ?? "").includes("race a live run"),
    "B15 the running job exports as [run] (never raced)");
  // topological order over the REAL edges, by recorded line numbers
  const edgesBody = await (await fetch(BASE + "/api/edges")).json();
  const edges = edgesBody.edges ?? [];
  const byId = new Map(P.steps.map((s) => [s.jobId, s]));
  let violations = 0, checked = 0;
  for (const e of edges) {
    const a = byId.get(e.fromJobId), b = byId.get(e.toJobId);
    if (!a || !b) continue; // cross-project / dangling edge
    checked++;
    if (!(a.line < b.line)) violations++;
  }
  must(checked > 0 && violations === 0,
    `B16 topological order: ${checked} edges, every parent's block above its child`);
  // determinism: two exports differ ONLY in the timestamp (one clock read
  // for the whole artifact — the header and generatedAt share the instant)
  const d2 = await api(`/api/projects/${projectId}/pipeline-script`);
  const strip = (d) => d.body.script.split(d.body.generatedAt).join("TS");
  must(d2.status === 200 && strip(d1) === strip(d2),
    "B17 deterministic: two exports differ only in the timestamp");
  must(P.script.includes(P.generatedAt),
    "B18 the header instant and the generatedAt field are the SAME read");
  // read-only: the project dir listing is identical after all of the above
  const listingAfter = readdirSync(projDir).sort().join("|");
  must(listingBefore === listingAfter, "B19 read-only: project dir listing unchanged");
  // honest 404
  const nf = await api("/api/projects/nonexistent-id/pipeline-script");
  must(nf.status === 404, "B20 unknown project → 404");

  /* ================= M — mobile flow (390×844) ================= */
  section("M: mobile palette → dialog");
  const mpage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  trackConsole(mpage, "mobile");
  await mpage.goto(BASE, { waitUntil: "networkidle" });
  await mpage.waitForTimeout(800);
  await mpage.click('[aria-label="Open command palette (Ctrl+K)"]');
  await mpage.waitForTimeout(400);
  await mpage.keyboard.type("pipeline script");
  await mpage.waitForTimeout(400);
  const rowM = mpage.getByText("Export pipeline as shell script").first();
  must(await rowM.isVisible(), "M1 palette row findable by search on mobile");
  await rowM.click();
  await mpage.waitForTimeout(1200);
  const dlgM = mpage.locator('[data-canvas-ui="pipeline-script-dialog"]');
  must(await dlgM.isVisible(), "M2 dialog opens (palette handed off)");
  const preM = mpage.locator('[data-canvas-ui="pipeline-script-pre"]');
  must(await preM.isVisible() && ((await preM.textContent()) ?? "").includes("#!/bin/sh"),
    "M3 pre carries the script");
  const dlgBoxM = await dlgM.boundingBox();
  must(dlgBoxM && dlgBoxM.x >= 0 && dlgBoxM.x + dlgBoxM.width <= 390.5,
    `M4 dialog stays inside the 390 viewport (x=${dlgBoxM?.x?.toFixed(0)}, w=${dlgBoxM?.width?.toFixed(0)})`);
  const statsM = mpage.locator('[data-canvas-ui="pipeline-script-stats"]');
  must(await statsM.isVisible() && ((await statsM.textContent()) ?? "").includes("steps"),
    "M5 stats chips visible (census readable before download)");
  await mpage.keyboard.press("Escape");
  await mpage.waitForTimeout(400);
  must(!(await dlgM.isVisible().catch(() => false)), "M6 Escape closes the dialog");
  const mConsole = consoleErrors.filter((e) => e.label === "mobile");
  must(mConsole.length === 0, `M7 mobile console clean (${mConsole.length})`);
  await mpage.close();

  /* ================= D — desktop flow (1440×900) ================= */
  section("D: desktop palette → dialog → download");
  const dpage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  trackConsole(dpage, "desktop");
  await dpage.goto(BASE, { waitUntil: "networkidle" });
  await dpage.waitForTimeout(800);
  await dpage.keyboard.press("Control+k");
  await dpage.waitForTimeout(400);
  await dpage.keyboard.type("pipeline script");
  await dpage.waitForTimeout(400);
  const rowD = dpage.getByText("Export pipeline as shell script").first();
  must(await rowD.isVisible(), "D1 palette row findable by search on desktop");
  await rowD.click();
  await dpage.waitForTimeout(1200);
  const dlgD = dpage.locator('[data-canvas-ui="pipeline-script-dialog"]');
  must(await dlgD.isVisible(), "D2 dialog opens via palette hand-off");
  const preD = dpage.locator('[data-canvas-ui="pipeline-script-pre"]');
  const preText = (await preD.textContent()) ?? "";
  must(preText.includes("#!/bin/sh") && preText.includes(`CryoFlow pipeline replay — ${P.projectName}`),
    "D3 pre carries the real script (shebang + project header)");
  const dlBtn = dpage.locator('[data-canvas-ui="pipeline-script-download"]');
  must(await dlBtn.isEnabled(), "D4 download armed (script present)");
  const downloadPromise = dpage.waitForEvent("download", { timeout: 8000 });
  await dlBtn.click();
  let download = null;
  try { download = await downloadPromise; } catch { /* timing */ }
  must(!!download && download.suggestedFilename() === `cryoflow-pipeline-${P.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}.sh`,
    `D5 download fires with the slug filename (${download?.suggestedFilename?.() ?? "none"})`);
  const copyBtn = dpage.locator('[data-canvas-ui="pipeline-script-copy"]');
  must(await copyBtn.isEnabled(), "D6 copy armed");
  await dpage.keyboard.press("Escape");
  await dpage.waitForTimeout(400);
  must(!(await dlgD.isVisible().catch(() => false)), "D7 Escape closes the dialog");
  const dConsole = consoleErrors.filter((e) => e.label === "desktop");
  must(dConsole.length === 0, `D8 desktop console clean (${dConsole.length})`);
  await dpage.close();

  /* ================= Z — roster identity ================= */
  section("Z: roster identity + read-only proof");
  const after = await (await fetch(BASE + "/api/jobs")).json();
  const afterList = Array.isArray(after) ? after : after.jobs ?? [];
  must(afterList.length === roster0.length, `Z1 roster size unchanged (${afterList.length})`);
  const afterIds = new Set(afterList.map((j) => j.id));
  must(roster0.every((j) => afterIds.has(j.id)), "Z2 roster identity — no job created or deleted");
  must(readdirSync(projDir).sort().join("|") === listingBefore,
    "Z3 project dir listing still identical (no workdir litter)");
  const failed4xx = failedUrls.filter((u) => (u.status ?? 0) >= 500 || (u.status === 404 && !u.url.includes("pipeline-script") && !u.url.includes("/log")));
  must(failed4xx.length === 0, `Z4 no unexpected 5xx/404 traffic (${failed4xx.length})`);
} finally {
  await browser.close();
}

console.log(
  failures.length === 0
    ? `\nT179 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT179 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);
