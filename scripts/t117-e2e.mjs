// Task 117 QA — the browser-transport layer that closes the qa60/qa61
// intermittent channel (two matrix rounds, same slot #5, order-filed in
// Task 116; forensics live-reproduced the death forms on this box).
//
//   S  STATIC: lib module exports + death-signature machinery; qa60/qa61
//      ride it (zero inline `eval --stdin` left); scope discipline (qa58
//      keeps its inline evalJs); matrix runner carries close --all
//   A  LIVE RECOVERY (production path): healthy eval → `close` kills the
//      transport mid-flight → the SAME evalJs call must detect the death
//      (stderr launch fingerprint), run the close→open→sentinel ladder,
//      retry, and land live app data — stats prove the ladder ran
//   B  DOUBLE DEATH: transport aimed at a dead port → recovery lands an
//      error page (sentinel honestly says "not the app") → the wrapper
//      must throw the TAGGED error instead of serving garbage
//   C  RUNNER: bash syntax + close --all present + suite count intact
//   Z  cleanup
//
// Usage: QA_PHASES=A node scripts/t117-e2e.mjs
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { makeTransport, CRYOFLOW_SENTINEL } from "./lib/browser-transport.mjs";

const B = "http://localhost:3000";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const step = (m) => console.log(m);
const FATAL = (msg) => { console.error(`FATAL: ${msg}`); process.exit(1); };
const must = (cond, label) => { if (!cond) FATAL(label); else step(`  ok: ${label}`); };
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

// ============================================================ phase S
function phaseS() {
  step("== PHASE S: static contracts ==");
  const lib = read("/home/z/my-project/scripts/lib/browser-transport.mjs");
  must(lib.includes("export function makeTransport"), "lib exports makeTransport");
  must(lib.includes("export const CRYOFLOW_SENTINEL"), "lib exports the CryoFlow sentinel");
  must(/launched browser/.test(lib), "death detection reads the stderr relaunch fingerprint");
  must(lib.includes("spawnSync"), "eval probe captures stderr via spawnSync");
  must(/Evaluation error/.test(lib), "page-side evaluation errors are classified (not transport death)");
  must(/evalTimeoutMs = 15_000/.test(lib), "default eval ceiling is 15s (was 120s slow-motion)");

  const qa60 = read("/home/z/my-project/scripts/qa60-e2e.mjs");
  const qa61 = read("/home/z/my-project/scripts/qa61-e2e.mjs");
  for (const [name, src] of [["qa60", qa60], ["qa61", qa61]]) {
    must(!src.includes("eval --stdin"), `${name}: zero inline eval pipes left (single source)`);
    must(src.includes('from "./lib/browser-transport.mjs"'), `${name}: rides the shared transport`);
    must(src.includes("makeTransport({ url: B"), `${name}: transport pointed at the app`);
  }
  must(qa61.includes("currentVp"), "qa61: viewport race healing wired (currentVp)");
  must(qa61.includes("viewport still wrong"), "qa61: race heal failure is logged when it fires");
  must((qa61.match(/await healViewport\(\)/g) || []).length === 3, "qa61: viewport healed at exactly the 3 coordinate interaction points (clickCard + Params + Browse)");
  must(qa61.includes('"phase-B seed"') && qa61.includes("bJobId"), "qa61: the phase-B import seed is tracked and deleted (36-row leak discovered on Task 117 close-out)");

  const qa59 = read("/home/z/my-project/scripts/qa59-e2e.mjs");
  must(qa59.includes("eval --stdin"), "scope discipline: qa59 keeps its inline evalJs (only the filed pair migrated)");

  const runner = read("/home/z/my-project/scripts/run-matrix.sh");
  must(runner.includes("close --all"), "matrix runner releases the browser between suites");
}

// ============================================================ phase A
async function phaseA() {
  step("== PHASE A: live recovery through the production path ==");
  sh(`agent-browser open ${B}`);
  await new Promise((r) => setTimeout(r, 4000));
  const tr = makeTransport({ url: B, log: step });
  const expr = `(() => document.querySelectorAll('div').length)()`;
  const before = Number(tr.evalJs(expr));
  must(before > 50, `healthy eval returns live app data (divs=${before})`);
  must(tr.stats.deaths === 0, "healthy path: zero deaths, zero interference");

  sh("agent-browser close"); // kill the transport mid-suite, like the field failure
  await new Promise((r) => setTimeout(r, 1500));
  const after = Number(tr.evalJs(expr)); // must detect death, recover, retry
  must(after > 50, `post-death eval lands live app data again (divs=${after})`);
  must(tr.stats.deaths >= 1, `death was detected (deaths=${tr.stats.deaths})`);
  must(tr.stats.recoveries >= 1, `recovery ladder ran (recoveries=${tr.stats.recoveries})`);
  must(tr.stats.failures === 0, "no failures leaked on the healthy-recovery path");
  const page = sh(`agent-browser get url`);
  must(page.includes("localhost:3000"), `recovery landed the app url (got ${page})`);
}

// ============================================================ phase B
async function phaseB() {
  step("== PHASE B: double death → tagged error, never garbage ==");
  sh("agent-browser close --all");
  await new Promise((r) => setTimeout(r, 1500));
  const tr = makeTransport({ url: "http://localhost:9", log: step }); // ERR_UNSAFE_PORT
  let threw = null;
  try {
    tr.evalJs(`(() => 1 + 1)()`);
  } catch (e) {
    threw = e;
  }
  must(!!threw, "dead-port transport throws instead of returning error-page data");
  must(/unrecoverable|recovery sentinel/.test(threw?.message || ""), `error is tagged and diagnosable (${(threw?.message || "").slice(0, 80)}...)`);
  must(tr.stats.failures >= 1, `failure recorded (failures=${tr.stats.failures})`);
}

// ============================================================ phase C
function phaseC() {
  step("== PHASE C: runner contract ==");
  sh("bash -n /home/z/my-project/scripts/run-matrix.sh");
  step("  ok: run-matrix.sh syntax valid");
  const runner = read("/home/z/my-project/scripts/run-matrix.sh");
  const n = (runner.match(/scripts\//g) || []).length;
  // 40 explicit entries (qa00 + qa58–qa84 + t85–t100) + comment/glob refs;
  // t101+ ride the glob, so ≥40 is the fleet-shrink invariant
  must(n >= 40, `matrix still lists the fleet (${n} script refs)`);
  // the glob must keep auto-including this very suite
  must(/t1\[0-9\]\[0-9\]-e2e\.mjs/.test(runner), "t1xx glob intact (t117 auto-included)");
}

// ============================================================ main
const phases = { S: phaseS, A: phaseA, B: phaseB, C: phaseC };
const PHASES = (process.env.QA_PHASES || "S,A,B,C").split(",").map((s) => s.trim().toUpperCase());
(async () => {
  try {
    for (const ph of PHASES) await phases[ph]();
    sh("agent-browser close --all");
    step("T117 ALL PASS (transport layer)");
  } catch (e) {
    try { sh("agent-browser close --all"); } catch { /* fine */ }
    FATAL(e.message);
  }
})();
