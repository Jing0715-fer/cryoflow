/**
 * t441 bench — the storage board's clean bridge and the lens's second view.
 *
 *   S1 (isCleanableStatus): the door mirrors the SERVER's own live-run
 *      law — running/pending refused, everything else opens the dialog
 *      and lets the planner speak. The door never invents a stricter rule.
 *   S2 (walkDelta): the freed-bytes story belongs to the WALK. Only a
 *      positive before→after difference is claimed; an unknown "before"
 *      and a walk that grew both claim nothing.
 *   S3 (formatCleanReceipt): the receipt names the run, the bytes, and
 *      WHICH walk it compared against — a stale snapshot cannot quietly
 *      inflate the claim; a zero delta says "unchanged" honestly.
 *   S4 (runsForCategory): the feeding-runs view — who holds this
 *      category's bytes. Heaviest first, dirName tiebreak (the API's own
 *      dialect), zero-holders filtered, orphans riding along (the shared
 *      asset store is often exactly the whale), extra row fields passed
 *      through untouched.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  formatCleanReceipt,
  isCleanableStatus,
  runsForCategory,
  walkDelta,
  type CategoryRunRow,
} from "../src/lib/storage-clean";

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

/* ================= S1 — the door's pre-filter ================= */
console.log("S1 — isCleanableStatus: the door mirrors the server, no stricter");
{
  must(isCleanableStatus("completed"), "S1a a completed run cleans");
  must(isCleanableStatus("failed"), "S1b a failed run cleans (its junk counts too)");
  must(!isCleanableStatus("running"), "S1c a live run is refused");
  must(!isCleanableStatus("pending"), "S1d a queued run is refused");
  must(isCleanableStatus("waiting"), "S1e unknown future statuses are the planner's call, not the door's");
}

/* ================= S2 — the walk's own account ================= */
console.log("S2 — walkDelta: only an honest shrinkage is a claim");
{
  must(walkDelta(null, 100) === 0, "S2a no before-walk, no claim");
  must(walkDelta(500, 700) === 0, "S2b the disk grew — the walk owes nobody a story");
  must(walkDelta(500, 500) === 0, "S2c unchanged is unchanged");
  must(Math.abs(walkDelta(500, 435.7) - 64.3) < 1e-9, "S2d the shrink is the claim (float within epsilon — 500-435.7 is not exactly 64.3)");
  must(walkDelta(1_000_000, 0) === 1_000_000, "S2e a whole-walk disappearance claims itself");
  must(walkDelta(101, 100) === 1, "S2f a single byte is worth claiming");
}

/* ================= S3 — the receipt's wording ================= */
console.log("S3 — formatCleanReceipt: the line names its evidence");
{
  const withTime = formatCleanReceipt("Motion Correction 1", 64 * 1024 * 1024, "20:41:02");
  must(withTime.startsWith("Cleaned Motion Correction 1 — "), "S3a the run is named first");
  must(withTime.includes("64.0 MB"), "S3b the bytes speak the house dialect");
  must(withTime.includes("the 20:41:02 walk"), "S3c the compared walk is named by its fetch time");
  must(
    !formatCleanReceipt("Import 1", 0, "20:41:02").includes("MB"),
    "S3d a zero delta claims no bytes at all",
  );
  must(
    formatCleanReceipt("Import 1", 0, "20:41:02").includes("unchanged"),
    "S3e an unchanged walk says so, honestly",
  );
}

/* ================= S4 — the feeding-runs view ================= */
console.log("S4 — runsForCategory: who feeds the whale");
{
  type Row = CategoryRunRow<"maps" | "stacks"> & { name: string };
  const r = (dirName: string, name: string, maps: number, files: number): Row => ({
    jobId: name === "shared" ? null : `${name}-id`,
    dirName,
    name,
    categories: { maps: { bytes: maps, files } },
  });
  const rows = [
    r("Import", "Import 1", 24 * 1024 * 1024, 24),
    r("MotionCorr/job002", "Motion Correction 2", 0, 0),
    r("InitialModel/job007", "Initial Model 1", 700 * 1024 * 1024, 14),
    r("micrographs", "shared", 721 * 1024 * 1024, 4623),
    r("Class2D/job004", "2D Classification 1", 700 * 1024 * 1024, 20),
  ];

  const fed = runsForCategory(rows, "maps");
  must(fed.length === 4, "S4a the zero-holder is filtered out");
  must(fed[0].dirName === "micrographs" && fed[0].catBytes === 721 * 1024 * 1024, "S4b heaviest first — the shared store leads");
  must(
    fed[1].dirName === "Class2D/job004" && fed[2].dirName === "InitialModel/job007",
    "S4c the 700MB tie breaks by dirName, the API's own dialect",
  );
  must(fed[0].jobId === null, "S4d the orphan rides along — the caller renders its amber honesty");
  must(fed[0].catFiles === 4623 && fed[0].name === "shared", "S4e catFiles + the row's own fields pass through untouched");
  must(runsForCategory([], "maps").length === 0, "S4f an empty world feeds nothing");

  const stacks = runsForCategory(rows, "stacks");
  must(stacks.length === 0, "S4g a category nobody holds comes back empty");
}

/* ---------------- verdict ---------------- */
console.log(`\nt441 storage-clean bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
