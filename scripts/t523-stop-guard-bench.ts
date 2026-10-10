/** t523 — the stop door learns the past tense + the init guard.
 *
 *  qa60's forever-running fixture left a record with pid 1 and done=true.
 *  stopRun ignored `done`, saw /proc/1 alive (init ALWAYS is), and built the
 *  kill tree as [1, ...descendantsOf(1)] — the whole container. One stop
 *  click took the dev server, the mock cluster and a running regression
 *  batch with it; this bench's own probe died by its own sword (the t523
 *  live proof). Two laws now stand:
 *    LAW 1 — a finished record (done=true) is the past tense: the door
 *            refuses honestly and touches no process.
 *    LAW 2 — pid ≤ 1 is nobody's RELION process: init resolves to "no pid".
 *
 *  The nail: the SURVIVOR assertions — after every ghost stop the bench
 *  asserts (a) it is still alive to assert anything, and (b) an unrelated
 *  sibling sleep process is still alive. Before the fix this file killed
 *  itself mid-run.
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// the in-process door key (t523): teach node the product's two import
// dialects (the @/ alias + extensionless relatives) BEFORE the engine import.
// Bun reads tsconfig paths natively and has no module.register — the hook is
// a node-only key, so the registration rides a guarded dynamic import and
// the bench runs green under both runners.
try {
  const { register } = await import("node:module");
  if (typeof register === "function") {
    register(pathToFileURL(new URL("./ts-alias-hook.mjs", import.meta.url).pathname));
  }
} catch {
  // bun (or another runtime with native path-alias eyes) — no key needed
}

const REPO = "/home/z/my-project";
const STATE = `${REPO}/data/engine-state.json`;
const GHOST = "t523-ghost-job";

const must = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exit(1);
  }
  console.log(`PASS ${msg}`);
};

function injectRecord(rec: Record<string, unknown>) {
  const raw = JSON.parse(readFileSync(STATE, "utf8"));
  raw[GHOST] = { jobId: GHOST, projectId: "t523-probe-project", type: "refine3d", ...rec };
  writeFileSync(STATE, JSON.stringify(raw, null, 2));
}

function ejectRecord() {
  const raw = JSON.parse(readFileSync(STATE, "utf8"));
  delete raw[GHOST];
  writeFileSync(STATE, JSON.stringify(raw, null, 2));
}

// an unrelated sibling process that must survive every ghost stop —
// the canary that used to die with the whole container
const survivor = spawn("sleep", ["120"]);

const { stopRun } = await import(`${REPO}/src/lib/relion/engine.ts`);

try {
  // ---- A: done=true + pid 1 (the exact qa60 ghost) → honest refusal, no kills
  injectRecord({ pid: 1, done: true, cmd: "qa-fixture (qa60)", workdir: "/tmp/t523-nowhere" });
  let r = await stopRun(GHOST);
  must(r.stopped === false, "A1: the finished record is refused, not acted on");
  must(r.message.includes("already ended"), "A2: the refusal names the past tense (the record's own testimony)");
  must(survivor.pid != null && spawnSync("kill", ["-0", String(survivor.pid)]).status === 0, "A3: the canary sibling was never touched");

  // ---- B: done=false + pid 1 → the init guard resolves to "no pid"
  injectRecord({ pid: 1, done: false, cmd: "qa-fixture (undone ghost)", workdir: "/tmp/t523-nowhere" });
  r = await stopRun(GHOST);
  must(r.stopped === false && r.message.includes("no live process"), "B1: init is never a job's process (pid ≤ 1 guard)");
  must(spawnSync("kill", ["-0", String(survivor.pid)]).status === 0, "B2: the canary still breathes");

  // ---- C: done=true + a plausible-but-dead pid → past tense wins before the tree
  injectRecord({ pid: 999999, done: true, cmd: "relion_refine", workdir: "/tmp/t523-nowhere" });
  r = await stopRun(GHOST);
  must(r.stopped === false && r.message.includes("already ended"), "C1: done=true refuses even with a real-shaped pid");

  // ---- D: done=false + dead pid → the honest no-process verdict
  injectRecord({ pid: 999999, done: false, cmd: "relion_refine", workdir: "/tmp/t523-nowhere" });
  r = await stopRun(GHOST);
  must(r.stopped === false && r.message.includes("no live process"), "D1: a dead pid is 'no live process', not a tree");

  // ---- E: the REAL tree-kill path still works (done=false + a genuine child)
  const victim = spawn("sleep", ["300"]);
  injectRecord({ pid: victim.pid, done: false, cmd: "relion_refine (t523 victim)", workdir: "/tmp/t523-victim-workdir" });
  r = await stopRun(GHOST);
  must(r.stopped === true, "E1: a genuine live record is stopped for real");
  must(spawnSync("kill", ["-0", String(victim.pid)]).status !== 0, "E2: the victim process actually died");
  must(spawnSync("kill", ["-0", String(survivor.pid)]).status === 0, "E3: the kill stayed inside the victim's tree — the canary never flinched");
  victim.kill("SIGKILL");
} finally {
  ejectRecord();
  survivor.kill("SIGKILL");
}

// the ultimate survivor assertion — reaching this line at all is LAW 1+2
// working: before the fix this bench died at its first ghost stop.
console.log("SURVIVOR: the bench itself outlived every ghost stop");
console.log("t523 stop-guard bench: all green");
