/**
 * t496 — the walk learns to run: the curve verdicts' probes go
 * parallel. The landscape walk (measureOwnerPeaks) had always fired
 * its owner probes with Promise.all, but the curve walk (t490) probed
 * one chart route at a time — a live stopwatch in the t495 window
 * caught the paper's verdicts held hostage for 19.5 seconds over ~20
 * sequential round trips while the reader stared at "still reading".
 * Now the probes fan out and the slowest one sets the bill, not the
 * sum.
 *
 *   T1 the fan-out   — probes flatten from the same walk order, fire
 *                      through Promise.all; no `await fetch` survives
 *                      inside a for loop
 *   T2 the order law — order survives for FREE (Promise.all indexes
 *                      answers by their probes); no sort, no index
 *                      baggage, the merge reads the walk's own order
 *   T3 the contracts — abort rides every fetch and the caller still
 *                      checks the signal; wounded merge and honest
 *                      skip are byte-preserved; the empty roster
 *                      returns before the fan-out
 *   T4 the rider     — the t495 teal chips gained a focus-visible face
 *                      (keyboard users get the same arrival the hover
 *                      users always had); the report's violet grammar
 *                      untouched
 *   T5 the neighbors — the landscape walk's own parallelism untouched;
 *                      the caller effect's pending doctrine unchanged
 */

import { readFileSync } from "fs";

const REPO = "/home/z/my-project";
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

let pass = 0;
let fail = 0;
function ok(cond: unknown, label: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
function section(t: string): void {
  console.log(`\n== ${t}`);
}

const read = (p: string): string => readFileSync(`${REPO}/${p}`, "utf8");
const dialogSrc = read("src/components/workflow/session-report-dialog.tsx");
const panelSrc = read("src/components/ai/assistant-panel.tsx");

const walkSrc = dialogSrc.slice(dialogSrc.indexOf("async function measureCurveVerdicts"), dialogSrc.indexOf("export default function SessionReportDialog"));

// ---------------------------------------------------------------- T1
section("T1 the fan-out — probes flatten, Promise.all fires, no sequential await");
ok(/const probes: \{ job: \{ id: string; name: string; type: string \}; kind: CurveKind \}\[\] = \[\];/.test(walkSrc), "probes flatten from the walk order (job loop + kind loop, one construction)");
ok(/for \(const kind of kinds\) probes\.push\(\{ job, kind \}\);/.test(walkSrc), "every (job, kind) pair becomes a probe");
ok(/await Promise\.all\(\s*\n\s*probes\.map\(async \(\{ job, kind \}\) =>/.test(walkSrc), "the probes fire through Promise.all (the map walk's own grammar)");
ok(!/for \(const kind of kinds\) \{[\s\S]*?await fetch/.test(walkSrc), "no `await fetch` survives inside the kind loop (the sequential walk is gone)");
ok(/fetch\(`\/api\/jobs\/\$\{job\.id\}\/\$\{CURVE_ROUTE_SEGMENT\[kind\]\}`, \{ signal \}\)/.test(walkSrc), "every probe still rides the same route segment and the SAME abort signal");

// ---------------------------------------------------------------- T2
section("T2 the order law — order survives for free, no sort, no index baggage");
ok(/index/.test(walkSrc) === false, "no index field baggage (a fake sort would be a lie — Promise.all already indexes answers by their probes)");
ok(/for \(const a of answers\) \{/.test(walkSrc), "the merge reads the answers in Promise.all's own order (the walk's order, never the network's completion order)");
ok(/Order survives the fan-out/.test(dialogSrc.slice(dialogSrc.indexOf("/** t490"), dialogSrc.indexOf("async function measureCurveVerdicts"))), "the order law is written where the next reader will find it (the walk's own docstring)");

// ---------------------------------------------------------------- T3
section("T3 the contracts — abort, wounded, honest skip, empty roster");
ok(/if \(signal\.aborted\) return null;/.test(walkSrc), "an aborted probe returns null (no partial state pretends to be an answer)");
ok(/if \(!a\) continue; \/\/ aborted — the caller checks the signal and discards/.test(walkSrc), "the merge skips aborted answers (the caller owns the abort verdict)");
ok(/if \(a\.failed\) \{\s*\n\s*wounded = true;/.test(walkSrc), "a refused route still marks the walk wounded (t211's doctrine byte-preserved)");
ok(/if \(a\.verdict\) rows\.push\(/.test(walkSrc), "an honest skip still skips (no verdict → no row, never a filler)");
ok(/if \(probes\.length === 0\) return \{ rows: \[\], wounded: false \};/.test(walkSrc), "an empty roster returns before the fan-out (no probes, no promise)");
ok(/curveVerdictOf\(kind, d\)/.test(walkSrc), "the wording stays one-fathered (curveVerdictOf words every answer before it travels)");

// ---------------------------------------------------------------- T4
section("T4 the rider — the teal chips learned to be seen by keyboard");
ok(/focus-visible:bg-teal-500\/15 focus-visible:outline-none/.test(panelSrc), "the prose chips carry a focus-visible face (keyboard arrival = hover arrival, the door-family consistency law)");
ok(/hover:bg-teal-500\/10/.test(panelSrc), "the hover face is untouched");

// ---------------------------------------------------------------- T5
section("T5 the neighbors — the landscape precedent and the caller keep their own grammar");
ok(/await Promise\.all\(\s*\n\s*owners\.map/.test(dialogSrc.slice(dialogSrc.indexOf("async function measureOwnerPeaks"), dialogSrc.indexOf("/** t490", dialogSrc.indexOf("async function measureOwnerPeaks")))), "the landscape walk's own parallelism untouched (it was the precedent, not the patient — measureOwnerPeaks keeps its Promise.all)");
ok(/const \{ rows, wounded \} = await measureCurveVerdicts\(done, ctrl\.signal\);/.test(dialogSrc), "the caller's call site unchanged");
ok(/if \(ctrl\.signal\.aborted\) return;\s*\n\s*setCurves\(rows\);/.test(dialogSrc), "the caller still checks the signal before setState (the abort contract's other half)");
ok(/setCurvesPending\(true\);/.test(dialogSrc) && /setCurvesPending\(false\);/.test(dialogSrc), "the pending doctrine unchanged (still reading → settled, never before its time)");

console.log(`\n----\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
