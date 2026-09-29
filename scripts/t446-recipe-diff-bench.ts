/**
 * t446 bench — the recipe diff face: the strip names the keys, the
 * TABLE carries the evidence.
 *
 *   F1 (classification): each changed setting knows what happened to it
 *      — changed (both sides hold a value), added (the recipe gained a
 *      setting after the run), removed (the recipe dropped one the run
 *      ate). An undefined-valued key is ABSENCE under the equal law, so
 *      it classifies like a missing key, never like a value.
 *   F2 (one law, two lenses): paramChanges derives from driftFor — same
 *      keys, same (sorted) order, and it stays null wherever the verdict
 *      is silent (failed, no evidence, equal recipe, mid-churn). The
 *      table cannot contradict the strip because it IS the strip.
 *   F3 (the mono-cell form): numbers/booleans via String, strings raw,
 *      nested shapes via JSON, null as "null", absence as "—" — a value
 *      cell never renders the empty string.
 *   F4 (re-run clears): the refreshed snapshot silences the diff face
 *      with the verdict — the receipt is a debt, not a history.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  driftFor,
  formatParamValue,
  paramChanges,
  type DriftJobLike,
} from "../src/lib/params-drift";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL — ${label}`);
  }
}

/* helpers */
const j = (
  id: string,
  status: string,
  params: Record<string, unknown>,
  ranParams: Record<string, unknown> | null,
): DriftJobLike => ({ id, status, params, ranParams });

/* ================= F1 — classification ================= */
{
  const job = j("a", "completed", { bfactor: 200, angpix: 1.24 }, { bfactor: 150, angpix: 1.24 });
  const rows = paramChanges(job);
  must(rows !== null && rows.length === 1, "F1a one differing key → one row");
  must(
    rows !== null &&
      rows[0].key === "bfactor" &&
      rows[0].kind === "changed" &&
      rows[0].from === 150 &&
      rows[0].to === 200,
    "F1b changed row carries from=ran-with, to=now"
  );

  const added = paramChanges(j("b", "completed", { bfactor: 200, z: 1 }, { bfactor: 200 }));
  must(
    added !== null && added.length === 1 && added[0].key === "z" && added[0].kind === "added",
    "F1c a key the snapshot never held → added"
  );

  const removed = paramChanges(j("c", "completed", { bfactor: 200 }, { bfactor: 200, z: 1 }));
  must(
    removed !== null &&
      removed.length === 1 &&
      removed[0].key === "z" &&
      removed[0].kind === "removed" &&
      removed[0].from === 1,
    "F1d a key the recipe dropped → removed, from keeps the ran-with value"
  );

  // absence is a value: an undefined-valued key behaves like a missing one
  const undefinedSnapshot = paramChanges(
    j("d", "completed", { b: 5, z: 5 }, { b: 5, z: undefined as unknown as number })
  );
  must(
    undefinedSnapshot !== null &&
      undefinedSnapshot.length === 1 &&
      undefinedSnapshot[0].key === "z" &&
      undefinedSnapshot[0].kind === "added",
    "F1e snapshot holding z:undefined ≈ snapshot missing z → the gained z is added"
  );
  const undefinedCurrent = paramChanges(
    j("e", "completed", { b: 5, z: undefined as unknown as number }, { b: 5, z: 1 })
  );
  must(
    undefinedCurrent !== null &&
      undefinedCurrent.length === 1 &&
      undefinedCurrent[0].kind === "removed" &&
      undefinedCurrent[0].from === 1 &&
      undefinedCurrent[0].to === undefined,
    "F1f current holding z:undefined ≈ recipe dropped z → removed"
  );
  // and the absence law end-to-end: an undefined-valued extra key on
    // either side makes NO drift at all (nothing was gained, nothing dropped)
  must(paramChanges(j("p", "completed", { b: 5 }, { b: 5, z: undefined as unknown as number })) === null,
    "F1g z:undefined in the snapshot only ≈ absent — equal recipes, no face");
}

/* ================= F2 — one law, two lenses ================= */
{
  const recipe = { angpix: 1.24, box: 128, do_norm: true, name: "ctf" };
  const drifted = { ...recipe, angpix: 1.4, extra: 7 };
  const job = j("f", "completed", drifted, recipe);

  const rows = paramChanges(job);
  const info = driftFor(job);
  must(
    rows !== null && info !== null &&
      rows.map((r) => r.key).join(",") === info.changedKeys.join(","),
    "F2a rows follow the verdict's keys in its exact (sorted) order"
  );
  must(
    rows !== null && rows.map((r) => r.key).join(",") === [...rows.map((r) => r.key)].sort().join(","),
    "F2b the order is sorted — a stable table"
  );
  must(
    rows !== null && rows.find((r) => r.key === "angpix")?.kind === "changed" &&
      rows.find((r) => r.key === "extra")?.kind === "added",
    "F2c mixed edits classify independently"
  );

  must(paramChanges(j("g", "failed", drifted, recipe)) === null,
    "F2d failed stays silent — no face where the verdict is silent");
  must(paramChanges(j("h", "completed", recipe, null)) === null,
    "F2e no snapshot → no evidence → no face");
  must(paramChanges(j("i", "running", drifted, recipe)) === null,
    "F2f running is mid-churn — the snapshot was just taken");
  must(paramChanges(j("k", "completed", recipe, recipe)) === null,
    "F2g equal recipe → no face");
}

/* ================= F3 — the mono-cell form ================= */
{
  must(formatParamValue(150) === "150", "F3a numbers via String");
  must(formatParamValue(true) === "true", "F3b booleans via String");
  must(formatParamValue("Movies/all/*.mrc") === "Movies/all/*.mrc",
    "F3c strings render raw — paths are not prose");
  must(formatParamValue({ a: 1 }) === '{"a":1}', "F3d objects via JSON (defensive)");
  must(formatParamValue([1, 2]) === "[1,2]", "F3e arrays via JSON (defensive)");
  must(formatParamValue(null) === "null", "F3f null names itself");
  must(formatParamValue(undefined) === "—", "F3g absence renders the em dash, never the empty string");
}

/* ================= F4 — re-run clears ================= */
{
  const recipe = { angpix: 1.24, bfactor: 150 };
  const edited = { ...recipe, bfactor: 200 };
  must(paramChanges(j("l", "completed", edited, recipe)) !== null,
    "F4a edited after the run → the receipt is due");
  // re-run refreshes the snapshot to the current recipe → verdict and
  // face both silence (the debt is paid)
  must(paramChanges(j("m", "completed", edited, edited)) === null,
    "F4b re-run (snapshot = current recipe) → the receipt clears with the verdict");
  // reset nulls the snapshot with the result (evidence hygiene)
  must(paramChanges(j("n", "completed", edited, null)) === null,
    "F4c reset (snapshot = null) → no evidence, no face");
}

/* verdict */
console.log(`t446 recipe-diff bench: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
