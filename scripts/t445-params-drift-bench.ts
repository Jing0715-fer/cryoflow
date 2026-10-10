/**
 * t445 bench — recipe drift: the self-edit half of "is this result
 * current?".
 *
 *   E1 (order-insensitive equality): key order never matters, values
 *      compare strictly (1 vs "1" is a different recipe), added/removed
 *      keys count, nested objects compare recursively, arrays
 *      element-wise.
 *   E2 (the verdict law): completed + evidence + a differing recipe —
 *      and ONLY that. failed stays silent (its status already says
 *      "re-run me"); running/pending are mid-churn (the snapshot was
 *      just taken); idle has no result; ranParams null is NO EVIDENCE
 *      (the demo world and every pre-t445 result stay badge-free).
 *   E3 (changed-keys arithmetic): an edited key, an added key, a
 *      removed key each name themselves; sorted; a key flipped to
 *      undefined counts as removed (absence is a value).
 *   E4 (re-run clears): the snapshot refreshed to the current recipe
 *      silences the verdict — the badge is a debt, not a history.
 *   E5 (the spoken form): one sentence true in every scenario —
 *      "recipe changed since this run" — with the 1/N setting grammar
 *      and a sorted, comma-joined key list.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  describeDrift,
  driftFor,
  findDriftedJobs,
  paramsEqual,
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

const RECIPE = { angpix: 1.24, box: 128, do_norm: true, name: "ctf" };

/* ================= E1 — order-insensitive equality ================= */
{
  must(paramsEqual(RECIPE, { box: 128, name: "ctf", angpix: 1.24, do_norm: true }),
    "E1a same map, different key order → equal");
  must(!paramsEqual(RECIPE, { ...RECIPE, angpix: 1.25 }),
    "E1b a changed value is a different recipe");
  must(!paramsEqual(RECIPE, { ...RECIPE, angpix: "1.24" }),
    "E1c number vs string of the same digits is a DIFFERENT recipe (strict)");
  must(!paramsEqual(RECIPE, { box: 128, do_norm: true, name: "ctf" }),
    "E1d a removed key is a different recipe");
  must(!paramsEqual(RECIPE, { ...RECIPE, extra: 4 }),
    "E1e an added key is a different recipe");
  must(paramsEqual({ a: { b: 1, c: [1, { d: 2 }] } }, { a: { c: [1, { d: 2 }], b: 1 } }),
    "E1f nested objects + arrays compare recursively, order-free");
  must(!paramsEqual({ a: { b: 1 } }, { a: { b: 2 } }),
    "E1g a nested difference is still a difference");
}

/* ============ E2 — the verdict law (status × evidence × diff) ============ */
{
  must(driftFor(j("a", "completed", { ...RECIPE, box: 256 }, RECIPE)) !== null,
    "E2a completed + edited after run → drifted");
  must(driftFor(j("b", "completed", RECIPE, RECIPE)) === null,
    "E2b completed + recipe matches snapshot → current");
  must(driftFor(j("c", "completed", { ...RECIPE, box: 256 }, null)) === null,
    "E2c ranParams null is NO EVIDENCE — no verdict (pre-t445 results stay quiet)");
  must(driftFor(j("d", "failed", { ...RECIPE, box: 256 }, RECIPE)) === null,
    "E2d failed stays silent — the status already says re-run me");
  must(driftFor(j("e", "running", { ...RECIPE, box: 256 }, RECIPE)) === null,
    "E2e running is mid-churn — the snapshot was just taken");
  must(driftFor(j("f", "pending", { ...RECIPE, box: 256 }, RECIPE)) === null,
    "E2f pending is mid-churn too");
  must(driftFor(j("g", "idle", { ...RECIPE, box: 256 }, RECIPE)) === null,
    "E2g idle has no result for a recipe to answer for");
}

/* ================ E3 — changed-keys arithmetic ================ */
{
  const one = driftFor(j("a", "completed", { ...RECIPE, box: 96 }, RECIPE));
  must(one !== null && one.changedKeys.length === 1 && one.changedKeys[0] === "box",
    "E3a an edited key names itself");
  const added = driftFor(j("b", "completed", { ...RECIPE, newknob: 7 }, RECIPE));
  must(added !== null && added.changedKeys.length === 1 && added.changedKeys[0] === "newknob",
    "E3b an added key names itself");
  const { name: _omit, ...currentNoName } = RECIPE;
  const removed = driftFor(j("c", "completed", currentNoName, RECIPE));
  must(removed !== null && removed.changedKeys.length === 1 && removed.changedKeys[0] === "name",
    "E3c a removed key names itself");
  const flipUndefined = driftFor(
    j("d", "completed", { ...RECIPE, do_norm: undefined as unknown as boolean }, RECIPE),
  );
  must(flipUndefined !== null && flipUndefined.changedKeys.includes("do_norm"),
    "E3d a key flipped to undefined counts as removed (absence is a value)");
  const many = driftFor(j("e", "completed", { ...RECIPE, box: 96, angpix: 1.0, name: "x" }, RECIPE));
  must(many !== null &&
    JSON.stringify(many.changedKeys) === JSON.stringify(["angpix", "box", "name"]),
    "E3e many changes sort alphabetically");
}

/* ================= E4 — re-run clears ================= */
{
  const edited = { ...RECIPE, box: 256 };
  must(driftFor(j("a", "completed", edited, RECIPE)) !== null,
    "E4a edited after the run → the badge is on");
  must(driftFor(j("a", "completed", edited, edited)) === null,
    "E4b re-run refreshed the snapshot → the badge is a debt paid, not a history");
  const report = findDriftedJobs([
    j("a", "completed", edited, edited),
    j("b", "completed", RECIPE, null),
    j("c", "completed", { ...RECIPE, do_norm: false }, RECIPE),
  ]);
  must(report.size === 1 && report.has("c"),
    "E4c the report holds exactly the drifted ones");
}

/* ================= E5 — the spoken form ================= */
{
  const d1 = describeDrift({ changedKeys: ["box"] });
  must(d1.short === "Recipe changed since this run",
    "E5a the short line is the always-true sentence");
  must(d1.long.includes("1 setting changed") && d1.long.includes("Re-run"),
    "E5b singular grammar + the re-run duty");
  const d3 = describeDrift({ changedKeys: ["angpix", "box", "name"] });
  must(d3.long.includes("3 settings changed"),
    "E5c plural grammar");
  must(d3.keys === "angpix, box, name",
    "E5d the key list rides along, comma-joined");
}

const total = pass + fail;
console.log(`t445 params-drift bench: ${pass} passed, ${fail} failed (${total} total)`);
if (fail > 0) process.exit(1);
