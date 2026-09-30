/**
 * t497 — the landscape learns to run: the map walk's candidates go
 * parallel. t496 taught the verdict probes to fan out; this window
 * copies that homework onto the OTHER sequential walk —
 * walkVolumeOwners probed /outputs one candidate at a time (up to
 * MAP_BRIEF_CAP round trips) and the map inventory could not settle
 * until the sum had been paid. Now the slowest candidate sets the
 * bill, not the sum.
 *
 *   T1 the fan-out   — one probe per candidate, fired through
 *                      Promise.all; no `await fetch` survives inside
 *                      a for loop over the walk
 *   T2 the order law — the merge reads the answers in Promise.all's
 *                      own order (the walk's order, never the
 *                      network's completion order); no re-sort, no
 *                      index baggage
 *   T3 the contracts — abort rides every fetch; no-volume and
 *                      unreadable candidates still skip; the
 *                      MAP_BRIEF_CAP cap survives the rewrite
 *   T4 the caller    — the effect's call site, abort check and
 *                      pending doctrine unchanged (the walk changed
 *                      its gait, not its handshake)
 *   T5 the neighbors — measureOwnerPeaks and measureCurveVerdicts
 *                      keep their own parallel grammar (the
 *                      precedent and the t496 patient, not patients
 *                      today)
 */

import { readFileSync } from "fs";

/* t503 — the checkout moves between sandbox resets (my-project era ->
 * cryoflow home); resolve the repo root from THIS file, not a
 * hardcoded absolute path that rots the bench the moment the tree moves. */
const REPO = (await import("node:path")).default.resolve(
  (await import("node:url")).fileURLToPath(new URL(".", import.meta.url)),
  "..",
);
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

const walkStart = dialogSrc.indexOf("async function walkVolumeOwners");
const walkSrc = dialogSrc.slice(
  dialogSrc.lastIndexOf("/**", walkStart),
  dialogSrc.indexOf("/** Profile the brief's maps", walkStart),
);

// ---------------------------------------------------------------- T1
section("T1 the fan-out — one probe per candidate, Promise.all fires");
ok(/await Promise\.all\(\s*\n\s*jobIds\.slice\(0, MAP_BRIEF_CAP\)\.map\(async \(jobId\) =>/.test(walkSrc), "the candidates fan out through Promise.all (the t496 grammar, same father)");
ok(!/for \(const jobId of jobIds[\s\S]*?await fetch/.test(walkSrc), "no `await fetch` survives inside a for loop over the walk (the sequential gait is gone)");
ok(/fetch\(`\/api\/jobs\/\$\{jobId\}\/outputs`, \{ signal \}\)/.test(walkSrc), "every probe still rides the same /outputs route and the SAME abort signal");
ok(walkSrc.split("walk learned to run").length >= 2, "the rewrite is recorded in the walk's own docstring (t497)");

// ---------------------------------------------------------------- T2
section("T2 the order law — the merge reads the walk's own order");
ok(/answers\.filter\(\(a\): a is MapOwner => a !== null\)/.test(walkSrc), "the merge filters the answers in Promise.all's own order (the walk's order, never the network's completion order)");
ok(!/\.sort\(\(a, b\) => a\.index - b\.index\)/.test(walkSrc) && !/index:/.test(walkSrc), "no index field baggage (a fake re-sort would be a lie — Promise.all already indexes answers by their probes)");
ok(/Order survives/.test(walkSrc) && /fan-out for free/.test(walkSrc), "the order law is written where the next reader will find it (the walk's own docstring)");

// ---------------------------------------------------------------- T3
section("T3 the contracts — abort, honest skip, the cap");
ok(/if \(signal\.aborted\) return null;/.test(walkSrc), "an aborted probe returns null (no partial state pretends to be an answer)");
ok(/if \(volumes\.length === 0\) return null;/.test(walkSrc), "a candidate with no volume still skips (the continue's honest heir)");
ok(/this candidate's outputs are unreadable — the walk goes on/.test(walkSrc), "an unreadable candidate still skips (the catch's honest heir)");
ok(/jobIds\.slice\(0, MAP_BRIEF_CAP\)/.test(walkSrc), "the MAP_BRIEF_CAP cap survives the rewrite (24 candidates max, the same budget)");
ok(/const owner: MapOwner = \{/.test(walkSrc) && /volumeCount: volumes\.length,/.test(walkSrc), "the MapOwner construction is byte-identical (same main, same overlays, same count)");

// ---------------------------------------------------------------- T4
section("T4 the caller — same handshake, new gait");
ok(/const owners = await walkVolumeOwners\(doneIds, ctrl\.signal\);/.test(dialogSrc), "the caller's call site unchanged");
ok(/if \(ctrl\.signal\.aborted\) return;\s*\n\s*\/\/ the inventory is a fact of the WALK/.test(dialogSrc), "the caller still checks the signal before setState (the abort contract's other half)");
ok(/setMapPending\(true\);/.test(dialogSrc) && /setMapPending\(false\);/.test(dialogSrc), "the pending doctrine unchanged (still reading → settled, never before its time)");

// ---------------------------------------------------------------- T5
section("T5 the neighbors — the precedent and the t496 patient keep their own grammar");
const peaksStart = dialogSrc.indexOf("async function measureOwnerPeaks");
ok(/await Promise\.all\(\s*\n\s*owners\.map/.test(dialogSrc.slice(peaksStart, dialogSrc.indexOf("/** t490", peaksStart))), "measureOwnerPeaks keeps its Promise.all (it was the precedent, not the patient)");
const curveStart = dialogSrc.indexOf("async function measureCurveVerdicts");
ok(/await Promise\.all\(\s*\n\s*probes\.map/.test(dialogSrc.slice(curveStart, dialogSrc.indexOf("export default function SessionReportDialog", curveStart))), "measureCurveVerdicts keeps its t496 fan-out (the sibling walk untouched)");

console.log(`\n----\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
