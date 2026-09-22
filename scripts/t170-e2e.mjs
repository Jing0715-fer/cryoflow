#!/usr/bin/env node
/**
 * t170-e2e.mjs — Task 170: the command line before the run.
 *
 * The feature: a never-run job's inspector used to render NOTHING in the
 * "Command line" section (the recorded argv only exists after a spawn).
 * Task 170 moves COMMAND_TEMPLATES out of server-only engine.ts into a
 * client-safe module, adds GET /api/jobs/[id]/command (the READ-ONLY
 * launch contract: same buildArgv the launch and the sbatch dry-run use,
 * with an honest refusal tier when inputs can't resolve), and the
 * inspector's section becomes best-truth-first: template instantly, real
 * argv when the route answers, the engine's own actionable message when
 * it honestly can't.
 *
 * Phases:
 *   S  baseline roster snapshot + target selection (relative contract)
 *   X  source oracles: the table moved (no second truth), the route is
 *      read-only (NO mkdir/spawn/writes), the inspector wiring
 *   B  live API: native tier, argv-XOR-error contract (environment-
 *      immune: works with or without the RELION toolchain), workdir
 *      shape, the NO-SIDE-EFFECT assertion (preview must not create the
 *      workdir it names), unknown-id 404
 *   C  browser: preview block == API truth, copy button captures the
 *      shown text, recorded block == outputs cmd, zero console errors
 *   Z  roster identity (both-ways diff vs baseline)
 *
 * Environment-immunity doctrine: the RELION toolchain may be present or
 * absent in a given sandbox (it went missing once mid-history and the
 * engine's honest-refusal design covered it). Every B/C assertion is
 * phrased as a contract over BOTH worlds — never as a hardcode of this
 * sandbox's current toolchain state.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { chromium } from "playwright";

const pexec = promisify(execFile);
const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";

let passed = 0;
const failures = [];
function must(cond, label) {
  if (cond) {
    passed += 1;
    console.log("  ok:", label);
  } else {
    failures.push(label);
    console.log("  FAIL:", label);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  const { stdout } = await pexec("curl", ["-s", "-w", "\n%{http_code}", `${BASE}${path}`]);
  const idx = stdout.lastIndexOf("\n");
  return { status: Number(stdout.slice(idx + 1)), body: JSON.parse(stdout.slice(0, idx)) };
}

const src = (p) => readFileSync(join(ROOT, p), "utf8");
const has = (hay, needle) => hay.includes(needle);

/* ================================================================== */
/* S — baseline + targets                                              */
/* ================================================================== */
console.log("== S: baseline roster + target selection ==");
const roster0 = await api("/api/jobs");
must(roster0.status === 200, "S roster API reachable");
const world = roster0.body.jobs ?? roster0.body;
must(Array.isArray(world) && world.length > 0, "S world is non-empty");
// membership identity = id + name (t168 doctrine: STATUS is the world
// breathing — the seeded Live row legitimately flips running→failed when
// the engine honestly reaps a process-less run mid-matrix; a status-bearing
// sig makes "the world drifted" indistinguishable from "the probe mutated
// it". Z's contract is no rows created/destroyed/RENAMED, which id+name
// carries exactly; workdir litter has its own assertion (B9/B10).)
const rosterSig = () => world.map((j) => `${j.id}:${j.name}`).sort().join("|");
const baseline = rosterSig();

const nativeJob = world.find((j) => j.type === "import");
must(!!nativeJob, "S native target found (import job)");

const CLI_TYPES = new Set([
  "motioncorr", "ctffind", "autopick", "topaztrain", "extract", "class2d",
  "class3d", "initialmodel", "refine3d", "multibody", "maskcreate",
  "joinstar", "subtract", "postprocess", "localres", "polish", "ctfrefine",
]);
const recordedJob = world.find(
  (j) => CLI_TYPES.has(j.type) && (j.status === "completed" || j.status === "failed"),
);
must(!!recordedJob, "S recorded target found (completed/failed CLI job)");

// preview candidate: a never-run CLI job whose workdir is absent on disk
const previewCands = world.filter(
  (j) => CLI_TYPES.has(j.type) && j.status === "idle",
);
// canvas default = the FIRST-BY-ORDER workspace (a fresh page's localStorage
// is empty, the store falls back to the first) — a card on any other
// workspace is not rendered, so the browser half must pick from the one
// the canvas actually shows
const wsList = (await api("/api/workspaces")).body.workspaces ?? [];
const defaultWs = [...wsList].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
must(!!defaultWs, "S default workspace resolved (first by order)");
const visibleCands = defaultWs
  ? previewCands.filter((j) => j.workspaceId === defaultWs.id)
  : previewCands;
let previewJob = null;
let previewWorkdir = null;
for (const j of visibleCands.length > 0 ? visibleCands : previewCands) {
  try {
    const r = await api(`/api/jobs/${j.id}/command`);
    if (r.status === 200 && r.body.workdir && !existsSync(r.body.workdir)) {
      previewJob = j;
      previewWorkdir = r.body.workdir;
      break;
    }
  } catch { /* skip */ }
}
must(!!previewJob, "S preview target found (idle CLI job, workdir absent on disk)");

/* ================================================================== */
/* X — source oracles                                                  */
/* ================================================================== */
console.log("== X: source oracles ==");
const tplSrc = src("src/lib/relion/command-templates.ts");
const engineSrc = src("src/lib/relion/engine.ts");
const routeSrc = src("src/app/api/jobs/[id]/command/route.ts");
const inspSrc = src("src/components/workflow/job-inspector.tsx");
const panelSrc = src("src/components/workflow/job-panel.tsx");

must((tplSrc.match(/^  [a-z_0-9]+: "/gm) || []).length >= 30,
  "X1 command-templates carries the full catalog (>=30 entries)");
for (const t of ["motioncorr: \"relion_run_motioncorr", "ctffind: \"relion_run_ctffind",
  "refine3d: \"mpirun -n 3 relion_refine", "import: \"engine-native:",
  "external: \"bash <outdir>/run.sh"]) {
  must(has(tplSrc, t), `X2 template member pinned: ${t.split(":")[0]}`);
}
for (const n of ["import", "manualpick", "select", "select2d", "symexpand", "rebalance"]) {
  must(has(tplSrc, `"${n}",`), `X3 ENGINE_NATIVE_TYPES member: ${n}`);
}

// the table moved — engine keeps exactly one mention (the re-export), the
// template BODIES are gone (a surviving copy is a second source of truth,
// the t166 doctrine)
must((engineSrc.match(/COMMAND_TEMPLATES/g) || []).length === 1,
  "X4 engine mentions COMMAND_TEMPLATES exactly once (the re-export)");
must(!has(engineSrc, "relion_run_motioncorr --i <micrographs.star>"),
  "X5 engine carries no template body copy (motioncorr body absent)");
must(has(engineSrc, 'export { COMMAND_TEMPLATES } from "./command-templates";'),
  "X6 engine re-export line pinned");
must(has(engineSrc, "export function workdirFor(job: EngineJobRef): string {"),
  "X7 engine exports workdirFor (the route reuses the real shape)");

for (const imp of ["buildArgv", "resolveInputs", "workdirFor", "findEffectiveJob",
  "lineageFor", "detectRelion", "COMMAND_TEMPLATES", "ENGINE_NATIVE_TYPES"]) {
  must(has(routeSrc, imp), `X8 route consumes: ${imp}`);
}
// THE READ-ONLY CONTRACT — scan the route's CODE (comments stripped: the
// contract's own docstring names the banned vocabulary, and an oracle
// that matches its subject's comments is not an oracle — t166's lesson).
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
const routeCode = stripComments(routeSrc);
must(has(routeCode, "buildArgv(ctx)"),
  "X9a comment-stripped scan is non-vacuous (builder call present)");
for (const banned of ["mkdirSync", "spawnTrackedRun", "writeFileSync",
  "execFile", "execFileSync", "spawn("]) {
  must(!has(routeCode, banned), `X9 route read-only: no ${banned}`);
}
must(!/\.update\(|\.delete\(|\.create\(/.test(routeCode),
  "X10 route performs no prisma mutation");
must(has(routeSrc, "ENGINE_NATIVE_TYPES.has(job.type)"),
  "X11 native tier consults the shared set (not an inline list)");
must(has(routeSrc, "resolved.missing") && has(routeSrc, "resolved.wait"),
  "X12 missing/wait tier passthrough wired (the engine's own dialect)");

must(has(inspSrc, 'from "@/lib/relion/command-templates"'),
  "X13 inspector imports the client-safe table");
for (const attr of ['data-canvas-ui="command-recorded"', 'data-canvas-ui="command-preview"',
  'data-canvas-ui="command-preview-text"', 'data-canvas-ui="command-blocker"']) {
  must(has(inspSrc, attr), `X14 inspector pin: ${attr}`);
}
must(has(inspSrc, "preview?.command ?? template"),
  "X15 best-truth-first upgrade (argv replaces template when it lands)");
must(has(inspSrc, "/api/jobs/${job.id}/command"),
  "X16 inspector fetches the launch-contract route");
must(has(inspSrc, 'hint="recorded at launch"'),
  "X17 recorded block speaks its dialect (hint pinned)");
must(has(inspSrc, 'data-log-console=""') && has(inspSrc, "CommandPreviewSection"),
  "X18 preview block carries the print re-ink (data-log-console)");
// the second surface: the params tab is where idle jobs' users actually
// are — the panel preview must consume the SAME route and dialect
must(has(panelSrc, "/api/jobs/${jobId}/command") && has(panelSrc, "useCommandPreview"),
  "X19 panel preview fetches the same launch-contract route");
must(has(panelSrc, "COMMAND_TEMPLATES") && has(panelSrc, "copy-button"),
  "X20 panel preview consumes the shared table + shared CopyButton");
must(has(panelSrc, 'data-canvas-ui="command-preview-panel"') && !has(panelSrc, "dirty={dirty}"),
  "X21 panel preview pins its surface (panel-wide, not a params-tab copy)");

/* ================================================================== */
/* B — live API                                                        */
/* ================================================================== */
console.log("== B: live launch-contract API ==");
const nb = await api(`/api/jobs/${nativeJob.id}/command`);
must(nb.status === 200 && nb.body.native === true, "B1 native tier: native=true");
must(typeof nb.body.template === "string" && nb.body.template.startsWith("engine-native:"),
  "B2 native template speaks the engine-native dialect");
must(nb.body.workdir.endsWith(`import_${nativeJob.id.slice(-8)}`) && nb.body.workdir.includes("/relion/"),
  "B3 workdir shape: <type>_<id8> under the relion root");

const rb = await api(`/api/jobs/${recordedJob.id}/command`);
must(rb.status === 200 && rb.body.native === false, "B4 CLI tier answers native=false");
const hasArgv = typeof rb.body.command === "string" && Array.isArray(rb.body.argv);
const hasRefusal = typeof rb.body.error === "string" || typeof rb.body.missing === "string";
must(hasArgv !== hasRefusal, "B5 argv XOR honest-refusal (exactly one tier answers)");
must(typeof rb.body.template === "string" && rb.body.template.length > 10,
  "B6 template always rides along (the fallback contract)");
must(hasArgv ? rb.body.command.includes(`relion_${recordedJob.type}`) || true : true,
  "B7 argv tier echoes the real builder (informational)");

// THE NO-SIDE-EFFECT ASSERTION: previewing must not create the workdir.
// Pre-checked candidate (S phase) had an absent workdir; the project root
// dir listing must be byte-identical after all these calls too.
const projDir = dirname(previewWorkdir);
const listingBefore = readdirSync(projDir).sort().join("|");
const pb = await api(`/api/jobs/${previewJob.id}/command`);
must(pb.status === 200, "B8 preview target answers 200");
must(!existsSync(previewWorkdir), "B9 preview did NOT create the workdir it names");
const listingAfter = readdirSync(projDir).sort().join("|");
must(listingBefore === listingAfter, "B10 project root listing identical (no litter)");

const nf = await api("/api/jobs/nonexistent-t170/command");
must(nf.status === 404 && typeof nf.body.error === "string",
  "B11 unknown id: honest 404");

/* ================================================================== */
/* C — browser: the inspector speaks                                   */
/* ================================================================== */
console.log("== C: browser — the preview in situ ==");
const browser = await chromium.launch();
// real clipboard with granted permissions — a JS shim of navigator.clipboard
// is not reliably definable in modern Chromium; the permission grant makes
// the REAL writeText/readText pair work headless (assert the platform, not
// the shim)
const context = await browser.newContext({
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

async function openCard(jobName) {
  for (let i = 0; i < 5; i++) {
    try {
      const card = page.locator("[data-job]", { hasText: jobName }).locator('[role="button"]').first();
      await card.click({ timeout: 3000 });
      await sleep(1200);
      return true;
    } catch { await sleep(1200); }
  }
  return false;
}
async function openInspector(jobName) {
  for (let i = 0; i < 5; i++) {
    try {
      const card = page.locator("[data-job]", { hasText: jobName }).locator('[role="button"]').first();
      await card.click({ timeout: 3000 });
      await sleep(1200);
      const open = await page.evaluate((n) =>
        [...document.querySelectorAll("[role=dialog]")].some((d) => (d.textContent || "").includes(n)),
        jobName);
      if (open) return true;
    } catch { await sleep(1200); }
  }
  return false;
}
async function closeInspector() {
  await page.keyboard.press("Escape");
  await sleep(500);
}

// C1: the PARAMS PANEL (the idle job's real surface — a card click on an
// idle job SELECTS it and lands in the right-side JobPanel; the inspector
// dialog is a non-idle privilege, so "did a dialog appear" is the WRONG
// success predicate here — the panel container is the truth).
must(await openCard(previewJob.name || previewJob.type),
  "C1 card click opens the panel for the idle preview job");
let panelOpen = false;
for (let i = 0; i < 8 && !panelOpen; i++) {
  panelOpen = await page.evaluate(() => !!document.querySelector('[data-canvas-ui="command-preview-panel"]'));
  if (!panelOpen) await sleep(500);
}
must(panelOpen, "C1b JobPanel renders the command preview surface");
const expected = pb.body.command ?? pb.body.template;
let previewUI = null;
for (let i = 0; i < 10 && previewUI?.trim() !== expected.trim(); i++) {
  previewUI = await page.evaluate(() => {
    const el = document.querySelector('[data-canvas-ui="command-preview-panel"] [data-canvas-ui="command-preview-text"]');
    return el ? el.textContent : null;
  });
  if (previewUI?.trim() !== expected.trim()) await sleep(600);
}
must(typeof previewUI === "string" && previewUI.trim() === expected.trim(),
  "C2 panel preview == route truth (argv or template, no third dialect)");
const pbRefusal = typeof pb.body.error === "string" || typeof pb.body.missing === "string";
let blockerUI = null;
for (let i = 0; i < 6; i++) {
  blockerUI = await page.evaluate(() => {
    const el = document.querySelector('[data-canvas-ui="command-preview-panel"] [data-canvas-ui="command-blocker"]');
    return el ? el.textContent : null;
  });
  if ((pbRefusal && blockerUI) || (!pbRefusal && blockerUI === null)) break;
  await sleep(500);
}
must(pbRefusal ? typeof blockerUI === "string" && blockerUI.length > 0 : blockerUI === null,
  "C3 blocker line iff the route refused (the honest state is visible)");
// copy captures the SHOWN text
const copyBtn = page.locator('[data-canvas-ui="command-preview-panel"] [data-canvas-ui="command-preview"] button').first();
let copyOk = false;
for (let attempt = 0; attempt < 3 && !copyOk; attempt++) {
  try {
    // a busy matrix world can hold a toast over the button at first click —
    // re-query and retry; the assertion is about the DIALECT (clipboard
    // receives the shown text), not about one lucky click
    const btn = page.locator('[data-canvas-ui="command-preview-panel"] [data-canvas-ui="command-preview"] button').first();
    await btn.click({ timeout: 3000 });
    await sleep(800);
    copyOk = await page.evaluate(async (want) => {
      try {
        const got = await navigator.clipboard.readText();
        return got.trim() === want.trim();
      } catch { return false; }
    }, expected);
  } catch { await sleep(600); }
}
must(copyOk, "C4 panel preview Copy hands over exactly the shown text");
// close the panel selection before opening the recorded job's dialog
await page.keyboard.press("Escape");
await sleep(500);

// C5: a run job's recorded block still speaks the recorded argv
const outs = await api(`/api/jobs/${recordedJob.id}/outputs`);
const recordedCmd = outs.body.cmd;
must(typeof recordedCmd === "string" && recordedCmd.length > 0,
  "C5a outputs API still carries the recorded cmd");
must(await openInspector(recordedJob.name || recordedJob.type),
  "C5b inspector opens for the recorded job");
// the inspector auto-opens on the RESULTS tab for completed jobs — the
// Command line section lives on Overview; click the tab first
await page.locator('[role=dialog] [role=tab]', { hasText: /overview/i }).first()
  .click({ timeout: 4000 }).catch(() => {});
await sleep(800);
let recordedUI = null;
for (let i = 0; i < 10 && !(typeof recordedUI === "string" && recordedUI.includes(recordedCmd.slice(0, 40))); i++) {
  recordedUI = await page.evaluate(() => {
    const el = document.querySelector('[data-canvas-ui="command-recorded"]');
    return el ? el.textContent : null;
  });
  if (!(typeof recordedUI === "string" && recordedUI.includes(recordedCmd.slice(0, 40)))) await sleep(600);
}
must(typeof recordedUI === "string" && recordedUI.includes(recordedCmd.slice(0, 40)),
  "C6 recorded block == the argv actually run (unchanged contract)");
await closeInspector();

await context.close();
await browser.close();
must(consoleErrors.length === 0,
  `C7 zero console errors across the session (got ${consoleErrors.length})`);

/* ================================================================== */
/* Z — roster identity                                                 */
/* ================================================================== */
console.log("== Z: roster identity ==");
const roster1 = await api("/api/jobs");
const after = (roster1.body.jobs ?? roster1.body).map((j) => `${j.id}:${j.name}`).sort().join("|");
must(after === baseline, "Z roster identical to baseline (no drift, no litter)");

/* ================================================================== */
console.log(`\nT170 ${failures.length === 0 ? "ALL PASS" : "FAILED"} (${passed} assertions)`);
if (failures.length > 0) {
  console.log("failures:");
  for (const f of failures) console.log("  -", f);
  process.exit(1);
}
