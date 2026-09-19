/**
 * t302 — the runner dies with its children: the orphan root, discipline → code.
 *
 * The story (the t299 window's biggest heist): runSuite's timeout kill reaps
 * a hung SUITE's process group, but nothing reaped the RUNNER itself. A
 * SIGTERM from the 600s tool ceiling (or Ctrl-C) killed the parent while the
 * in-flight suite — detached, its own process group — survived as an ORPHAN
 * that kept rewriting the world: jobs created, records deleted, servers
 * restarted. The t299 window misread its own orphans as a parallel cron
 * window and executed a live connection before decoding the
 * qa-t*-<base36-timestamp> connection ids. Discipline was written into the
 * worklog ("timeout 杀得死父进程，杀不死在飞的孤儿"); t302 turns it into code:
 *
 *   1. GROUP KILL   — SIGTERM/SIGINT/SIGHUP kill the in-flight suite's whole
 *                     tree (process.kill(-pid, SIGKILL)), the timeout kill's
 *                     own law turned outward;
 *   2. TESTIMONY    — the batch key gets an HONEST `interrupted` report entry
 *                     (suites finished so far + the in-flight one marked
 *                     `interrupted`, interruptedAt naming where death landed,
 *                     null = before the first suite): a killed batch leaves
 *                     testimony, not silence — and never a stale prior entry
 *                     standing in for a batch that did not finish;
 *   3. SIGNAL CODES — exit 143 (SIGTERM/SIGHUP) / 130 (SIGINT);
 *   4. SELF-HEALING — re-running the key overwrites the interrupted entry
 *                     with a real verdict (C8's law, interrupted edition).
 *
 * Along the way this suite PINS the t273 C2 fix: the refusal's batch list is
 * asserted self-maintaining (parsed from the runner's source), never the
 * joined literal that broke the moment t26b registered between t26 and t27 —
 * a real-fail that sat in the tree until this window.
 *
 * Phases (no UI, no server rebuild — the runner testing its own death):
 *   A   the demo truth (app alive, roster identity 23)
 *   B   the ledger (source assertions on family-run.mjs + the t273 pin)
 *   C   the live loop:
 *       C0  --batches: eleven batches, zero orphans, t30 registered
 *       C1  SIGTERM during the first breath → exit 143, interrupted entry
 *           with interruptedAt null and an empty suite ledger
 *       C1b SIGINT during the first breath → exit 130, interruptedBy SIGINT
 *       C2  SIGTERM mid-flight → the runner exits 143 AND the in-flight
 *           qa63-smoke process is GONE (the orphan execution, witnessed),
 *           interruptedAt names the suite, its ledger row says interrupted
 *       C3  --summary renders the ⚡ INTERRUPTED line for the killed key
 *       C4  re-running the key to completion OVERWRITES the testimony
 *           (no interrupted flag, pass 1) — the hot path (runSuite's
 *           inFlight tracking) carries a real suite end to end
 *   D   the hygiene: no stray runner/suite processes, roster still 23
 *
 * Isolation: every nested family-run world writes its OWN report via
 * FAMILY_REPORT (t273's law) — this suite never touches the accumulating
 * scripts/.family-report.json.
 */
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const ROOT = "/home/z/my-project";
const FAMILY_RUN = `${ROOT}/scripts/family-run.mjs`;
const T273 = `${ROOT}/scripts/t273-family-report.mjs`;
const SUITE = "qa63-smoke.mjs"; // the kill victim: a sentinel — read-only by design
const TMP = {
  c1: `${ROOT}/scripts/.t302-report-c1.json`,
  c1b: `${ROOT}/scripts/.t302-report-c1b.json`,
  c2: `${ROOT}/scripts/.t302-report-c2.json`,
};

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (cond, timeoutMs, stepMs = 150) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await cond()) return true;
    await sleepMs(stepMs);
  }
  return await cond();
};

// spawn the runner as a LIVE child (async — we need to signal it mid-run)
const spawnRunner = (args, reportPath) => {
  const proc = spawn("node", [FAMILY_RUN, ...args], {
    cwd: ROOT,
    env: { ...process.env, FAMILY_REPORT: reportPath }, // the isolation law
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = [];
  proc.stdout.on("data", (d) => chunks.push(d));
  proc.stderr.on("data", (d) => chunks.push(d));
  const done = Promise.race([
    new Promise((resolve) => proc.on("close", (c) => resolve({ code: c, timedOut: false }))),
    new Promise((resolve) => setTimeout(() => resolve({ code: null, timedOut: true }), 30_000)),
  ]);
  return { proc, pid: proc.pid, out: () => Buffer.concat(chunks).toString("utf8"), done };
};

const psLines = () => {
  const r = spawnSync("ps", ["-eo", "pid,args"], { encoding: "utf8" });
  return (r.stdout ?? "").split("\n");
};
// the OUTER runner (when this suite runs inside a batch, the batch's own
// family-run IS our parent) is not a stray — exclude it from the hygiene scan
const OUTER_PID = process.ppid;
const runnerAlive = () =>
  psLines().some(
    (l) => /node .*scripts\/family-run\.mjs/.test(l) && !l.trim().startsWith(`${OUTER_PID} `),
  );
const victimAlive = () => psLines().some((l) => new RegExp(`node .*scripts/${SUITE}`).test(l));
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

// ---- Phase A: the demo truth ------------------------------------------------
console.log("== PHASE A: the demo truth ==");
const health = await fetch("http://localhost:3000/", { method: "GET" }).catch(() => null);
must(health?.status === 200, `the app answers GET / with 200 (got ${health?.status ?? "none"})`);
const jobs = await fetch("http://localhost:3000/api/jobs").then((r) => r.json()).catch(() => null);
must(jobs?.jobs?.length === 23, `the roster is intact at 23 jobs (got ${jobs?.jobs?.length ?? "none"})`);

// ---- Phase B: the ledger ----------------------------------------------------
console.log("== PHASE B: the ledger ==");
const src = readFileSync(FAMILY_RUN, "utf8");

must(
  ['process.on("SIGTERM"', 'process.on("SIGINT"', 'process.on("SIGHUP"'].every((s) => src.includes(s)),
  "the runner registers all three death signals (SIGTERM / SIGINT / SIGHUP)",
);
must(
  src.includes('process.kill(-flight.pid, "SIGKILL")'),
  "the death path takes the in-flight suite's WHOLE group (the timeout kill's own law, turned outward)",
);
must(
  src.includes("let dying = false;") && src.includes("if (dying) return;"),
  "a second signal adds nothing (the dying guard)",
);
must(
  src.includes("let inFlight = null;") &&
    src.includes("inFlight = { file, pid: child.pid") &&
    src.includes("inFlight = null; // the suite is done"),
  "the in-flight suite is tracked (file + pid + pipes + startedAt) and cleared when it closes",
);
must(
  src.includes("interrupted: true,") &&
    src.includes("interruptedBy: sig,") &&
    src.includes("interruptedAt: flight ? flight.file : null,"),
  "the interrupted report entry carries the three testimony fields (flag / signal / where death landed)",
);
must(
  src.includes('const code = sig === "SIGINT" ? 130 : 143;'),
  "the exit codes speak the signal dialect (143 SIGTERM/SIGHUP, 130 SIGINT)",
);
must(
  src.includes("setTimeout(() => process.exit(code), 150);"),
  "death flushes the pipe before exiting (a 150ms beat — process.exit truncates pending writes)",
);
must(
  src.includes("signals          SIGTERM/SIGINT/SIGHUP") && src.includes("dies with its children (exit 143/130)"),
  "--help speaks the death law",
);
must(src.includes('{ name: "t30", match: /^t30/ },'), "the t30 decade is registered in BATCHES");
must(src.includes('"t302-family-suicide.mjs",'), "t302 itself is on the family roster");
must(src.includes("INTERRUPTED by"), "--summary renders interrupted batches (the ⚡ line)");
must(
  src.includes("suites: interruptedSuites(flight?.file ?? null"),
  "the interrupted entry reuses the report's own ledger vocabulary (verdict/attempts/ms)",
);

// the t273 pin — the volatile literal is gone, the self-maintaining parse is in
const t273src = readFileSync(T273, "utf8");
must(
  !t273src.includes('"qa, t21, t22, t24, t25, t26, t27"'),
  "t273's C2 no longer hunts the joined batch-list literal (the t26b breakage, pinned dead)",
);
must(
  t273src.includes('matchAll(/name: "([^"]+)"/g)'),
  "t273's C2 parses the batch names from the runner's source (self-maintaining)",
);

// ---- Phase C: the live loop -------------------------------------------------
console.log("== PHASE C: the live loop ==");

// C0 — the registry, witnessed
const c0 = spawnSync("node", [FAMILY_RUN, "--batches"], { cwd: ROOT, encoding: "utf8" });
must(c0.status === 0, `--batches exits 0 (got ${c0.status})`);
must(!c0.stdout.includes("ORPHANS"), "zero orphans (t30 registered on arrival)");
must(c0.stdout.includes("t30") && c0.stdout.includes("t302-family-suicide.mjs"), "t30 lists its one member (t302)");
const declared = Number(c0.stdout.match(/over (\d+) suites/)?.[1] ?? NaN);
const covered = Number(c0.stdout.match(/every one of the (\d+) suites belongs/)?.[1] ?? NaN);
must(
  Number.isInteger(declared) && declared === covered,
  `the coverage line certifies the roster (declared ${declared}, covered ${covered})`,
);

// C1 — SIGTERM during the first breath: death before any suite spawned
const c1 = spawnRunner(["--filter", SUITE], TMP.c1);
await sleepMs(1200); // inside the 3s inter-suite breath — no suite in flight yet
process.kill(c1.pid, "SIGTERM");
const c1done = await c1.done;
must(c1done.code === 143, `SIGTERM during the breath exits 143 (got ${c1done.code})`);
must(
  c1.out().includes("the runner dies with its children") && c1.out().includes("marked interrupted"),
  "the death speech names the law and the testimony",
);
const rep1 = readJson(TMP.c1);
const e1 = rep1?.batches?.[`adhoc:${SUITE}`] ?? null;
must(!!e1, "the interrupted entry exists for the adhoc key");
must(
  !!e1 && e1.interrupted === true && e1.interruptedBy === "SIGTERM" && e1.interruptedAt === null,
  "interruptedAt is null — death came before the first suite spawned",
);
must(
  !!e1 && Array.isArray(e1.suites) && e1.suites.length === 0 && e1.pass === 0 && e1.realFail === 0,
  "the suite ledger is honestly empty (nothing ran, nothing passed, nothing failed)",
);

// C1b — SIGINT during the breath: the other dialect
const c1b = spawnRunner(["--filter", SUITE], TMP.c1b);
await sleepMs(1200);
process.kill(c1b.pid, "SIGINT");
const c1bdone = await c1b.done;
must(c1bdone.code === 130, `SIGINT during the breath exits 130 (got ${c1bdone.code})`);
const rep1b = readJson(TMP.c1b);
must(
  rep1b?.batches?.[`adhoc:${SUITE}`]?.interruptedBy === "SIGINT",
  "the entry records WHICH signal landed (interruptedBy SIGINT)",
);

// C2 — SIGTERM mid-flight: the orphan execution, witnessed
const c2 = spawnRunner(["--filter", SUITE], TMP.c2);
const appeared = await pollUntil(victimAlive, 45_000);
must(appeared, "the in-flight suite (qa63-smoke) appeared as a live process");
if (appeared) {
  process.kill(c2.pid, "SIGTERM"); // the tool-ceiling moment, reproduced
  const c2done = await c2.done;
  must(c2done.code === 143, `the runner exits 143 after the mid-flight SIGTERM (got ${c2done.code})`);
  const orphanGone = await pollUntil(() => !victimAlive(), 8_000);
  must(orphanGone, "the in-flight suite is DEAD — no orphan outlives the runner");
  must(!runnerAlive(), "no family-run process outlives the moment either");
  must(
    c2.out().includes(`killing the in-flight suite's whole group: ${SUITE}`),
    "the death speech names the suite it took with it",
  );
  const rep2 = readJson(TMP.c2);
  const e2 = rep2?.batches?.[`adhoc:${SUITE}`] ?? null;
  must(
    !!e2 && e2.interrupted === true && e2.interruptedAt === SUITE,
    `interruptedAt names the suite that was mid-flight (${e2?.interruptedAt})`,
  );
  must(
    !!e2 && Array.isArray(e2.suites) && e2.suites.length === 1 &&
      e2.suites[0].name === SUITE && e2.suites[0].verdict === "interrupted" &&
      e2.suites[0].attempts === 1 && e2.suites[0].ms > 0,
    `the suite's ledger row says interrupted (attempts 1, ms ${e2?.suites?.[0]?.ms})`,
  );

  // C3 — the summary speaks the interruption
  const c3 = spawnSync("node", [FAMILY_RUN, "--summary"], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, FAMILY_REPORT: TMP.c2 }, timeout: 20_000,
  });
  must(
    c3.status === 0 && c3.stdout.includes("⚡ INTERRUPTED by SIGTERM") && c3.stdout.includes(`at ${SUITE}`),
    "--summary renders the ⚡ INTERRUPTED line for the killed key",
  );
  must(c3.stdout.includes("re-run the key to overwrite"), "the summary points at the self-healing path");

  // C4 — the re-run overwrites the testimony with a real verdict (and the
  //      hot path — runSuite's inFlight tracking — carries a real suite)
  const c4 = spawnSync("node", [FAMILY_RUN, "--filter", SUITE], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, FAMILY_REPORT: TMP.c2 }, timeout: 220_000,
  });
  must(c4.status === 0, `the re-run completes green (exit ${c4.status})`);
  const rep4 = readJson(TMP.c2);
  const e4 = rep4?.batches?.[`adhoc:${SUITE}`] ?? null;
  must(
    !!e4 && e4.interrupted === undefined && e4.pass === 1 && e4.realFail === 0,
    "the interrupted entry is OVERWRITTEN by the real verdict (no testimony haunts the accumulator)",
  );
  must(
    !!e4 && Array.isArray(e4.suites) && e4.suites.length === 1 &&
      e4.suites[0].verdict === "pass" && e4.suites[0].attempts === 1 && e4.suites[0].ms > 0,
    `the re-run's ledger row is a first-try pass (ms ${e4?.suites?.[0]?.ms})`,
  );
} else {
  try { process.kill(c2.pid, "SIGKILL"); } catch { /* already gone */ }
  fail++; // counted by the must above
}

// ---- Phase D: the hygiene ---------------------------------------------------
console.log("== PHASE D: the hygiene ==");
await pollUntil(() => !runnerAlive() && !victimAlive(), 8_000);
must(!runnerAlive(), "no family-run process is left behind");
must(!victimAlive(), `no ${SUITE} process is left behind`);
const jobsD = await fetch("http://localhost:3000/api/jobs").then((r) => r.json()).catch(() => null);
must(jobsD?.jobs?.length === 23, `the roster survived the executions untouched (got ${jobsD?.jobs?.length ?? "none"})`);

// ---- finally: the scratch is scratched --------------------------------------
for (const p of Object.values(TMP)) {
  try { rmSync(p, { force: true }); } catch { /* already gone */ }
}
console.log(fail === 0 ? "\nt302: ALL PASS" : `\nt302: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;
