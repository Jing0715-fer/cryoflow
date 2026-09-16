#!/usr/bin/env node
// family-run.mjs — the family batch runner: serial by law, solo-retry for the transient.
//
// WHY THIS EXISTS (the qa49 precedent, twice-observed): suites run back-to-back
// compete for resources (browser processes, port 3000, playwright workers) and a
// suite can FAIL in the batch while passing SOLO. A batch FAIL is not a verdict
// until a solo re-run has heard the case. This script makes that law executable:
//
//   1. SERIAL — suites run one at a time, never in parallel (spawnSync).
//   2. SOLO RETRY — a FAIL gets a 4s breath, then one solo re-run:
//        solo PASS  → SOLO-RECOVERY (transient, the qa49 signature)
//        solo FAIL  → REAL-FAIL (a verdict, needs a human)
//   3. EXIT CODE — 0 iff zero REAL-FAILs (SOLO-RECOVERY is honest but not a blocker).
//
// The FAMILY roster is an audited membership list (29 suites as of Task 251) —
// it is written here EXPLICITLY, not discovered by glob: diag-*/probe scripts and
// one-off hearings are not family. When a new suite joins the family, add it here.
//
// Usage:
//   node scripts/family-run.mjs                 # the whole family, serial
//   node scripts/family-run.mjs --filter t249   # only suites whose name contains "t249"
//   node scripts/family-run.mjs --list          # print the roster, run nothing
//
// Self-test hook (the runner testing its own retry law):
//   FAMILY_DRILL=t249 node scripts/family-run.mjs --filter t249
//     Forces the FIRST run of the named suite to report failure (exit 1 is
//     overridden to 1 — the transient is simulated), so the solo-retry path
//     executes for real: the solo re-run is a genuine run, and the suite should
//     come back SOLO-RECOVERY. Drill mode never fabricates the final verdict —
//     it only drills the first attempt.
//
// Per-suite timeout: 240s (t223 carries 155 assertions; the slowest family member).

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = path.join(ROOT, "scripts");

// ---- the audited family roster (Task 250) ---------------------------------
// Order matters only for readability: qa sentinels first, then the t-chronicle.
const FAMILY = [
  "qa00-data-view.mjs", // the data-view sentinel
  "qa63-smoke.mjs", // the smoke sentinel
  "qa47-e2e.mjs",
  "qa49-e2e.mjs", // the suite whose transient named the law
  "qa50-e2e.mjs",
  "qa51-e2e.mjs",
  "qa55-e2e.mjs",
  "qa57-e2e.mjs",
  "qa58-e2e.mjs",
  "qa84-e2e.mjs",
  "t210-e2e.mjs", // 151 assertions — the heaviest
  "t212-e2e.mjs",
  "t213-e2e.mjs",
  "t214-e2e.mjs",
  "t215-e2e.mjs",
  "t218-e2e.mjs",
  "t219-e2e.mjs",
  "t221-e2e.mjs",
  "t223-e2e.mjs", // 155 assertions — the other heavy
  "t241-run-echo.mjs",
  "t242-e2e.mjs",
  "t243-e2e.mjs",
  "t244-e2e.mjs",
  "t245-e2e.mjs",
  "t246-e2e.mjs",
  "t247-e2e.mjs",
  "t248-e2e.mjs",
  "t249-e2e.mjs",
  "t251-hardening-gates.mjs",
];

// ---- CLI -------------------------------------------------------------------
const args = process.argv.slice(2);
const flagOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
if (args.includes("--help") || args.includes("-h")) {
  console.log(
    "usage: node scripts/family-run.mjs [--filter <substring>] [--list]\n" +
      "  FAMILY_DRILL=<suite>  drill the solo-retry path (first attempt of <suite> fails)",
  );
  process.exit(0);
}
const filter = flagOf("--filter");
if (args.includes("--list")) {
  console.log(`FAMILY ROSTER — ${FAMILY.length} suites (serial by law, solo-retry for the transient):`);
  for (const s of FAMILY) console.log(`  ${s}`);
  process.exit(0);
}

// ---- paint -----------------------------------------------------------------
const C = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};
const NO_COLOR = process.env.NO_COLOR || !process.stdout.isTTY;
const paint = NO_COLOR ? { green: (s) => s, yellow: (s) => s, red: (s) => s, dim: (s) => s, bold: (s) => s } : C;

// ---- the law, executable ---------------------------------------------------
const SUITE_TIMEOUT = 240_000;
const SOLO_BREATH_MS = 4_000;
const TAIL = 8; // failure transcript lines shown per attempt

const drill = process.env.FAMILY_DRILL || null;

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- environment guards (the OOM-adaptation law) ---------------------------
// The box is a 4GB OOM-prone cage (87 kernel kills and counting). A 28-suite
// batch pressures it: the standalone server holds ~2.7GB, each suite births a
// chromium, and the OOM killer does not care WHO it reaps — the second family
// run (Task 250) was murdered mid-batch along with the watchdog and the server.
// So the runner now guards the ENVIRONMENT, not just the verdicts:
//   1. MEM GATE    — before each suite, if MemAvailable < 500MB, wait for it to
//                    recover (15s polls, max 8). Running on the edge only
//                    manufactures fake FAILs and invites the killer.
//   2. SERVER GATE — before each suite, the server must answer; if it died
//                    (OOM), wait for the watchdog to resurrect it (20 polls).
//                    A suite run against a dead server is not a verdict — it's
//                    noise; SKIPPED(SERVER) keeps that noise out of REAL-FAIL.
//   3. BREATH      — 3s between suites: let chromium fully exit and the heap
//                    settle before the next suite spikes it again.
const MEM_FLOOR_KB = 500_000;
const memAvailableKb = () => {
  try {
    const line = readFileSync("/proc/meminfo", "utf8").split("\n").find((l) => l.startsWith("MemAvailable:"));
    return Number(line?.match(/\d+/)?.[0] ?? 0);
  } catch {
    return Number.MAX_SAFE_INTEGER; // if we cannot read it, don't block on it
  }
};
const serverUp = () => {
  try {
    const res = spawnSync("curl", ["-s", "-o", "/dev/null", "--max-time", "3", "http://localhost:3000/"]);
    return res.status === 0;
  } catch {
    return false;
  }
};
async function waitEnvironment(file) {
  for (let i = 0; i < 8 && memAvailableKb() < MEM_FLOOR_KB; i++) {
    if (i === 0) console.log(paint.yellow(`  … ${file}: MemAvailable ${(memAvailableKb() / 1024).toFixed(0)}MB < ${MEM_FLOOR_KB / 1024}MB — waiting for the heap to settle`));
    await sleepMs(15_000);
  }
  for (let i = 0; i < 20 && !serverUp(); i++) {
    if (i === 0) console.log(paint.yellow(`  … ${file}: server down — waiting for the watchdog to resurrect it`));
    await sleepMs(3_000);
  }
  return serverUp();
}

// ASYNC SPAWN WITH GROUP KILL — the pipe-trap lesson, learned live in the first
// family run: a suite's browser grandchildren inherit the stdio pipes, so when
// the suite hangs, a plain child.kill() takes the node process but leaves the
// browser holding the pipe open — and an await on that pipe hangs the runner
// PAST ITS OWN TIMEOUT (observed: qa49's solo re-run froze the whole batch at
// 09:23, the 240s ceiling never fired). Root fix in two halves:
//   detached: true  — the child becomes a process-group leader, so
//                     process.kill(-pid, SIGKILL) takes the WHOLE tree
//                     (node, the agent-browser CLI, the browser) at once;
//   stream destroy  — killing the tree releases the pipe, so 'close' fires and
//                     the await returns. The 240s ceiling becomes a real
//                     ceiling, not a suggestion.
async function runSuite(file) {
  const t0 = Date.now();
  const child = spawn("node", [path.join(SCRIPTS, file)], {
    cwd: ROOT,
    detached: true, // its own process group — the group kill depends on this
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = [];
  child.stdout.on("data", (d) => chunks.push(d));
  child.stderr.on("data", (d) => chunks.push(d));
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      process.kill(-child.pid, "SIGKILL"); // the whole tree, not just node
    } catch {
      /* the group is already gone */
    }
    child.stdout.destroy(); // release the pipe so 'close' can fire
    child.stderr.destroy();
  }, SUITE_TIMEOUT);
  const exitCode = await new Promise((resolve) => {
    child.on("close", (c) => resolve(c ?? 1));
    child.on("error", () => resolve(1));
  });
  clearTimeout(timer);
  // drill: the named suite's FIRST attempt is forced to fail (the simulated transient)
  if (drill && file.startsWith(drill) && !runSuite.drilled) {
    runSuite.drilled = true;
    return { code: 1, ms: Date.now() - t0, timedOut: false, out: Buffer.concat(chunks).toString("utf8") };
  }
  return { code: exitCode ?? 1, ms: Date.now() - t0, timedOut, out: Buffer.concat(chunks).toString("utf8") };
}

const tail = (out, n = TAIL) =>
  out
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .slice(-n)
    .map((l) => `      │ ${l}`)
    .join("\n");

const roster = filter ? FAMILY.filter((f) => f.includes(filter)) : FAMILY;
if (roster.length === 0) {
  console.log(paint.red(`no family member matches --filter ${filter}`));
  process.exit(2);
}

console.log(
  paint.bold(`\nFAMILY RUN — ${roster.length} suite${roster.length === 1 ? "" : "s"}`) +
    paint.dim(` · serial by law · solo-retry for the transient · timeout ${SUITE_TIMEOUT / 1000}s`) +
    (drill ? paint.yellow(` · DRILL=${drill} (first attempt of the drilled suite is forced to fail)`) : "") +
    "\n",
);

const verdicts = { PASS: [], "SOLO-RECOVERY": [], "REAL-FAIL": [], "SKIPPED(SERVER)": [] };
const t0 = Date.now();

for (const file of roster) {
  if (!existsSync(path.join(SCRIPTS, file))) {
    verdicts["REAL-FAIL"].push(file);
    console.log(paint.red(`  ✗ ${file.padEnd(22)} MISSING — roster names a file that is not on disk`));
    continue;
  }
  const first = await (async () => {
    await sleepMs(3_000); // the inter-suite breath
    if (!(await waitEnvironment(file))) {
      verdicts["SKIPPED(SERVER)"].push(file);
      console.log(paint.yellow(`  ⊘ SKIPPED(SERVER) ${file.padEnd(22)} — the box could not host a verdict`));
      return null;
    }
    return runSuite(file);
  })();
  if (!first) continue;
  const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

  if (first.code === 0) {
    verdicts.PASS.push(file);
    console.log(
      `  ${paint.green("✓ PASS")}         ${file.padEnd(22)} ${paint.dim(secs(first.ms))}`,
    );
    continue;
  }

  // first attempt failed — was it the timeout?
  if (first.timedOut) {
    console.log(paint.red(`  ✗ TIMEOUT       ${file.padEnd(22)} ${secs(first.ms)} — killed at ${SUITE_TIMEOUT / 1000}s`));
  } else {
    console.log(paint.yellow(`  … FAIL          ${file.padEnd(22)} ${secs(first.ms)} — solo re-run after ${SOLO_BREATH_MS / 1000}s breath`));
    if (first.out.trim()) console.log(paint.dim(tail(first.out)));
  }

  await sleepMs(SOLO_BREATH_MS); // the breath: let resources settle
  const envOk = await waitEnvironment(file); // the solo run deserves the same guarantees
  const solo = envOk ? await runSuite(file) : { code: 1, timedOut: false, ms: 0, out: "" };

  if (solo.code === 0 && envOk) {
    verdicts["SOLO-RECOVERY"].push(file);
    console.log(`  ${paint.yellow("↻ SOLO-RECOVERY")} ${file.padEnd(22)} ${paint.dim(`solo ${secs(solo.ms)} — the transient, caught in the act`)}`);
  } else {
    verdicts["REAL-FAIL"].push(file);
    console.log(paint.red(`  ✗ REAL-FAIL     ${file.padEnd(22)} solo ${secs(solo.ms)} — a verdict, needs a human`));
    if (first.out.trim()) console.log(paint.dim(`      first attempt:\n${tail(first.out)}`));
    if (solo.out.trim()) console.log(paint.dim(`      solo re-run:\n${tail(solo.out)}`));
  }
}

// ---- the summary ------------------------------------------------------------
const wall = ((Date.now() - t0) / 1000).toFixed(1);
const { PASS, "SOLO-RECOVERY": soloRec, "REAL-FAIL": realFail } = verdicts;
const line = paint.dim("─".repeat(72));
console.log(`\n${line}`);
console.log(
  `  ${paint.bold("FAMILY VERDICT")}` +
    `  ${paint.green(`pass ${PASS.length}`)}` +
    `  ${paint.yellow(`solo-recovery ${soloRec.length}`)}` +
    `  ${paint.red(`real-fail ${realFail.length}`)}` +
    paint.dim(`  · wall ${wall}s`),
);
if (soloRec.length) console.log(`  ${paint.yellow("transients heard:")} ${soloRec.join(", ")}`);
if (realFail.length) console.log(`  ${paint.red("real failures:")} ${realFail.join(", ")}`);
console.log(line);

process.exit(realFail.length > 0 ? 1 : 0);
