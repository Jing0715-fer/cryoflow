/**
 * t273 — the family runner's batches become first-class, and its verdicts
 * become a FILE (the t270/t271/t272 leftover, three windows standing).
 *
 * The story: "the 600s tool ceiling is a batch boundary" used to live only in
 * the agent's memory — the t26 batch grew to 12 suites and HAD to be split at
 * the decade boundary, but the split was manual (`--filter t26`, `--filter
 * t27`), a substring coupled to batch naming. And every window's worklog
 * hand-copied per-batch pass counts and wall times from terminal scrollback.
 *
 * t273 makes the law executable:
 *   - BATCHES: the decade boundary IS the batch boundary (qa / t21 / t22 /
 *     t24 / t25 / t26 / t27), coverage-checked — a roster suite that matches
 *     NO batch is a loud ORPHAN, not a silent skip
 *   - --batch <name>: run one first-class batch (no substring coupling)
 *   - --report: every run MERGES one JSON entry per batch key into
 *     scripts/.family-report.json (batch keys replace; adhoc:<filter> keys
 *     are their own world) — after the seven foreground batches the file IS
 *     the family truth
 *   - --summary: speaks the accumulated report (per batch + TOTAL) — the
 *     worklog's regression lines are machine-copyable from here on
 *   - the health guard: a batch whose last recorded wall time approached the
 *     600s tool ceiling warns BEFORE burning the time — the runner remembers
 *     what the agent used to
 *
 * Phases (no UI, no server rebuild — this is the runner testing itself):
 *   B  the ledger (source assertions on family-run.mjs)
 *   C  the live loop:
 *      C1  --batches: seven batches, full coverage, zero orphans
 *      C2  --batch nosuch: exit 2, names the available batches
 *      C3  --reset: the report file is gone
 *      C4  --summary on an empty report: honest "no family report yet"
 *      C5  --batch t22 for REAL: verdict 0, report entry t22 (pass 2, two
 *          suites, attempts 1, wallMs > 0, ISO lastRun)
 *      C6  --summary now speaks t22 + a TOTAL row
 *      C7  --filter qa00: the report carries BOTH keys (merged, not overwritten)
 *      C8  the health guard, witnessed live: a fake 580s wall on a key,
 *          re-run the key, the ⚠ names the ceiling — and the real run's
 *          report overwrites the fake (self-healing scratch data)
 *   D  the report file is --reset (scratch data, scratched)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";

const ROOT = "/home/z/my-project";
const FAMILY_RUN = `${ROOT}/scripts/family-run.mjs`;
// The ISOLATED report path (t273's own lesson, learned live): this suite
// spawns REAL family-run children, and without an override every nested run
// reads, merges into, and --resets the OUTER family batch's accumulating
// report — the t27 family batch's file was wiped to a single entry by its
// own member. The FAMILY_REPORT env var gives every nested world its own
// file; the outer truth stays whole.
const REPORT_FILE = "/tmp/t273-family-report.json";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const run = (args) =>
  spawnSync("node", [FAMILY_RUN, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 300_000,
    env: { ...process.env, FAMILY_REPORT: REPORT_FILE }, // the isolation law: nested worlds write their own file
  });

// ---- Phase B: the ledger ----------------------------------------------------
console.log("== PHASE B: the ledger ==");
const src = readFileSync(FAMILY_RUN, "utf8");

must(
  src.includes("const BATCHES = [") && src.includes('const batchOf = (file) => BATCHES.find'),
  "batches are a first-class registry (BATCHES + batchOf), not a substring habit"
);
must(
  ['"qa"', '"t21"', '"t22"', '"t24"', '"t25"', '"t26"', '"t27"'].every((n) => src.includes(n)),
  "the seven decade batches are registered (qa + the t-chronicle)"
);
must(
  src.includes('const batch = BATCHES.find((b) => b.name === batchArg);') &&
    src.includes("process.exit(2);"),
  "an unknown --batch name exits 2 and names the available batches"
);
must(
  src.includes("const orphans = FAMILY.filter((f) => batchOf(f) === null);") &&
    src.includes("ORPHANS"),
  "--batches coverage-checks the roster: a suite matching NO batch is a loud ORPHAN"
);
must(
  src.includes('process.env.FAMILY_REPORT || path.join(SCRIPTS, ".family-report.json")') &&
    src.includes("const readReport = ") &&
    src.includes("const writeReport = "),
  "the report path is FAMILY_REPORT-overridable (nested worlds stay isolated)"
);
must(
  src.includes("report.batches[reportKey] = {") && src.includes("const report = readReport();"),
  "each run MERGES its batch key into the accumulated report (batch keys replace, others survive)"
);
must(
  src.includes("const runSuiteMs = new Map();") &&
    src.includes("runSuiteMs.set(file, first.ms);") &&
    src.includes("runSuiteMs.set(file, solo.ms);"),
  "the deciding attempt's wall time is recorded for every verdict (PASS and heard paths)"
);
must(
  src.includes("attempts: verdict === \"pass\" ? 1 : verdict === \"skipped-server\" ? 0 : 2"),
  "attempts speak the law's vocabulary (1 = first-try, 2 = heard, 0 = skipped)"
);
must(
  src.includes("priorBatch?.wallMs > 550_000") && src.includes("600s tool ceiling"),
  "the batch health guard warns before a batch burns time near the 600s ceiling"
);
must(
  src.includes('args.includes("--summary")') && src.includes("no family report yet"),
  "--summary speaks the accumulated report (and honestly when there is none)"
);
must(
  src.includes('args.includes("--reset")') && src.includes("rmSync(REPORT_FILE"),
  "--reset scratches the scratch data"
);

// ---- Phase C: the live loop -------------------------------------------------
console.log("== PHASE C: the live loop ==");

// C1 — the registry, witnessed: seven batches, full coverage, no orphans
const c1 = run(["--batches"]);
must(c1.status === 0, `--batches exits 0 (got ${c1.status})`);
must(
  ["qa", "t21", "t22", "t24", "t25", "t26", "t27"].every((b) => c1.stdout.includes(b)),
  "all seven batches are listed with their members"
);
// the roster GROWS (t273 itself just joined) — the coverage line must be
// asserted against the roster's CURRENT size, parsed from the same output,
// never a literal (the "50 suites" literal FAILED the moment t273 joined,
// taking the whole suite down with it)
const declared = Number(c1.stdout.match(/over (\d+) suites/)?.[1] ?? NaN);
const covered = Number(c1.stdout.match(/every one of the (\d+) suites belongs/)?.[1] ?? NaN);
must(
  Number.isInteger(declared) && declared === covered,
  `the coverage line certifies the roster (declared ${declared}, covered ${covered})`
);
must(!c1.stdout.includes("ORPHANS"), "zero orphans (the decade registry is complete)");

// C2 — an unknown batch is refused, loudly and helpfully
const c2 = run(["--batch", "nosuch"]);
must(c2.status === 2, `--batch nosuch exits 2 (got ${c2.status})`);
must(
  c2.stdout.includes('no batch named "nosuch"') && c2.stdout.includes("qa, t21, t22, t24, t25, t26, t27"),
  "the refusal names the batches that DO exist"
);

// C3 — reset: the report is scratch data, scratched
run(["--reset"]);
must(!existsSync(REPORT_FILE), "--reset removes the report file");

// C4 — an empty report is spoken honestly
const c4 = run(["--summary"]);
must(c4.status === 0, `--summary on an empty report exits 0 (got ${c4.status})`);
must(c4.stdout.includes("no family report yet"), 'the empty report says "no family report yet"');

// C5 — a REAL batch run: the report lands with the law's own vocabulary
const c5 = run(["--batch", "t22"]);
must(c5.status === 0, `--batch t22 exits 0 (got ${c5.status}: ${(c5.stderr ?? "").slice(0, 80)})`);
must(
  c5.stdout.includes('batch "t22"'),
  'the run banner names its batch key ("t22")'
);
const rep5 = JSON.parse(readFileSync(REPORT_FILE, "utf8"));
const t22 = rep5.batches?.t22 ?? null;
must(
  !!t22 && t22.pass === 2 && t22.soloRecovery === 0 && t22.realFail === 0,
  `the report entry t22 speaks the verdict (pass ${t22?.pass}, solo ${t22?.soloRecovery}, fail ${t22?.realFail})`
);
must(
  Array.isArray(t22?.suites) && t22.suites.length === 2 &&
    t22.suites.every((s) => s.verdict === "pass" && s.attempts === 1 && s.ms > 0),
  `the per-suite ledger carries verdict/attempts/ms (${t22?.suites?.map((s) => s.name).join(", ")})`
);
must(
  typeof t22?.wallMs === "number" && t22.wallMs > 0 && !Number.isNaN(Date.parse(t22?.lastRun ?? "")),
  `the batch entry timestamps itself (wallMs ${t22?.wallMs}, lastRun ${t22?.lastRun})`
);

// C6 — the summary speaks the accumulated truth
const c6 = run(["--summary"]);
must(
  c6.status === 0 && c6.stdout.includes("t22") && c6.stdout.includes("TOTAL"),
  "--summary lists the t22 batch row and a TOTAL row"
);

// C7 — the merge: an adhoc run joins the report, the batch entry survives
const c7 = run(["--filter", "qa00"]);
must(c7.status === 0, `--filter qa00 exits 0 (got ${c7.status})`);
const rep7 = JSON.parse(readFileSync(REPORT_FILE, "utf8"));
must(
  Object.keys(rep7.batches).includes("t22") && Object.keys(rep7.batches).includes("adhoc:qa00"),
  `the report carries BOTH keys after the adhoc run (${Object.keys(rep7.batches).join(", ")})`
);
must(
  rep7.batches.t22.pass === 2 && rep7.batches["adhoc:qa00"].pass === 1,
  "the batch entry was NOT overwritten by the adhoc entry (merge, not clobber)"
);

// C8 — the health guard, witnessed live: a fake 580s wall on the adhoc key,
//      re-run the key, the ⚠ names the ceiling — and the REAL run overwrites
//      the fake (the scratch data heals itself)
const rep8 = JSON.parse(readFileSync(REPORT_FILE, "utf8"));
rep8.batches["adhoc:qa00"].wallMs = 580_000;
writeFileSync(REPORT_FILE, `${JSON.stringify(rep8, null, 2)}\n`);
const c8 = run(["--filter", "qa00"]);
must(
  c8.status === 0 && c8.stdout.includes("600s tool ceiling"),
  "the guard warns BEFORE the run when the key's last wall time nears the ceiling"
);
const rep8b = JSON.parse(readFileSync(REPORT_FILE, "utf8"));
must(
  rep8b.batches["adhoc:qa00"].wallMs < 100_000,
  `the real run's report overwrote the fake wall (${rep8b.batches["adhoc:qa00"].wallMs}ms) — scratch data heals`
);

// ---- Phase D: the scratch is scratched --------------------------------------
console.log("== PHASE D: scratch ==");
run(["--reset"]);
must(!existsSync(REPORT_FILE), "the report file is reset (scratch data leaves no litter)");

console.log(fail === 0 ? "\nt273: ALL PASS" : `\nt273: ${fail} FAIL`);
process.exitCode = fail === 0 ? 0 : 1;
