/**
 * t458 bench — the run lens: the storage board's third view.
 *
 *   R1 (runCensus): the whole-board census — heaviest first (the API's
 *      own dialect, dirName tiebreak), every run present even at zero
 *      bytes, orphans riding with the same dignity, share of the walk's
 *      total, topCategory read in the palette's own order (first max
 *      wins), and a zero walk that owes nobody a share.
 *   R2 (whaleLine): the summary block's one sentence — names the
 *      heaviest run in the house byte dialect with its share; silent
 *      (null) when there is no whale to name.
 *   R3 (categoriesOfRun): one run's slices — above zero only, the
 *      palette's own order (comparable rows never jitter), each with
 *      its share of the run's OWN bytes, and the slices reassemble the
 *      run by construction.
 *   R4 (runStackSegments): the row bar — one segment per above-zero
 *      category in palette order, sized against the board's widest run,
 *      and a zero maxBytes that renders nothing at all.
 *   R5 (filesForRun): the ledger — dirName is the filter, an optional
 *      category narrows it further, heaviest first, and the caller's
 *      richer row type rides along untouched (the runsForCategory
 *      generic dialect).
 *   R6 (runLedgerState + runLedgerLine): the three honest states —
 *      rows, unlisted (files on disk but none in the whale ledger —
 *      amber, NEVER an empty-directory claim), empty — and the honesty
 *      line that says whether the ledger is the whole directory or
 *      only its whales.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  categoriesOfRun,
  filesForRun,
  runCensus,
  runLedgerLine,
  runLedgerState,
  runStackSegments,
  whaleLine,
  type RunLensRow,
} from "../src/lib/storage-run-lens";
import type { StorageCategoryId } from "../src/lib/relion/disk-usage";

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

/** fixture builder — categories default to nothing, bytes default to 0 */
function row(
  dirName: string,
  bytes: number,
  files: number,
  categories: Partial<Record<StorageCategoryId, { bytes: number; files: number }>> = {},
  extra: Partial<RunLensRow> = {}
): RunLensRow {
  return {
    jobId: `job-${dirName}`,
    name: `Run ${dirName}`,
    dirName,
    bytes,
    files,
    categories,
    ...extra,
  };
}

/* ================= R1 — the census ================= */
console.log("R1 — runCensus: every run weighed, heaviest first");
{
  const a = row("extract_01", 300, 3, { maps: { bytes: 300, files: 3 } });
  const b = row("import_01", 700, 7, { stacks: { bytes: 700, files: 7 } });
  const orphan = row("shared_assets", 100, 1, { other: { bytes: 100, files: 1 } }, { jobId: null });
  const zero = row("empty_run", 0, 0, {});
  const census = runCensus([a, b, orphan, zero], 1100);

  must(census.length === 4, "R1a a zero-byte run keeps its census entry — the census and the table agree on who exists");
  must(census[0].row.dirName === "import_01" && census[1].row.dirName === "extract_01", "R1b heaviest first (700 → 300)");
  must(census[2].row.dirName === "shared_assets" && census[2].row.jobId === null, "R1c an orphan rides the census with the same dignity");
  must(Math.abs(census[0].share - (700 / 1100) * 100) < 1e-9, "R1d the share is of the walk's total");
  must(census[0].topCategory === "stacks" && census[1].topCategory === "maps", "R1e topCategory names each run's heaviest bucket");
  must(census[3].topCategory === null && census[3].share === 0, "R1f a zero-byte run owns no category and no share");

  const tie = runCensus(
    [row("x_one", 100, 1, { maps: { bytes: 100, files: 1 } }), row("x_two", 100, 1, { maps: { bytes: 100, files: 1 } })],
    200
  );
  must(tie[0].row.dirName === "x_one" && tie[1].row.dirName === "x_two", "R1g the tiebreak is the API's own dialect (dirName asc)");

  const zeroWalk = runCensus([a, b], 0);
  must(zeroWalk[0].share === 0 && zeroWalk[1].share === 0, "R1h a zero walk owes nobody a share (no divide by zero)");
}

/* ================= R2 — the whale line ================= */
console.log("R2 — whaleLine: one sentence, the walk's own voice");
{
  const a = row("import_01", 734_003_200, 7, { stacks: { bytes: 734_003_200, files: 7 } });
  const b = row("extract_01", 300, 3, { maps: { bytes: 300, files: 3 } });
  const census = runCensus([a, b], 734_003_500);
  const line = whaleLine(census, 734_003_500);

  must(line !== null && line.startsWith("The heaviest run — Run import_01 — holds "), "R2a the whale is named first");
  must(line !== null && line.includes("700.0 MB"), "R2b the bytes speak the house dialect (fmtBytes, not a second format)");
  must(line !== null && line.includes("100% of the project"), "R2c the share rounds to the walk's own arithmetic");

  must(whaleLine([], 500) === null, "R2d an empty census says nothing");
  must(whaleLine(census, 0) === null, "R2e a zero walk says nothing");
  must(whaleLine(runCensus([row("x", 0, 0, {})], 0), 0) === null, "R2f a zero-byte whale is never named");
}

/* ================= R3 — one run, broken down ================= */
console.log("R3 — categoriesOfRun: the palette's own order, the run's own total");
{
  const job = row("post_01", 1000, 10, {
    maps: { bytes: 600, files: 4 },
    tables: { bytes: 300, files: 5 },
    logs: { bytes: 100, files: 1 },
    stacks: { bytes: 0, files: 0 },
  });
  const slices = categoriesOfRun(job);

  must(slices.length === 3, "R3a a zero category is not a slice");
  must(
    slices.map((s) => s.id).join(",") === "maps,tables,logs",
    "R3b the palette's own order (maps → tables → logs), never size order"
  );
  must(Math.abs(slices[0].share - 60) < 1e-9 && Math.abs(slices[1].share - 30) < 1e-9, "R3c the shares are of the run's OWN bytes");
  must(
    Math.abs(slices.reduce((acc, s) => acc + s.bytes, 0) - 1000) < 1e-9,
    "R3d the slices reassemble the run by construction"
  );
  must(slices[0].files === 4 && slices[2].files === 1, "R3e the file counts ride each slice");

  const empty = categoriesOfRun(row("x", 0, 0, {}));
  must(empty.length === 0 && categoriesOfRun(job).every((s) => s.share >= 0), "R3f an empty run breaks into nothing");
}

/* ================= R4 — the row bar ================= */
console.log("R4 — runStackSegments: colored by where the bytes live");
{
  const cats = {
    maps: { bytes: 200, files: 2 },
    stacks: { bytes: 600, files: 6 },
    logs: { bytes: 200, files: 2 },
  };
  const segs = runStackSegments(cats, 1000);

  must(segs.length === 3, "R4a one segment per above-zero category");
  must(segs.map((s) => s.id).join(",") === "maps,stacks,logs", "R4b palette order again — maps first because the palette says so, not the bytes");
  must(Math.abs(segs[0].pct - 20) < 1e-9 && Math.abs(segs[1].pct - 60) < 1e-9, "R4c each segment is a share of the board's widest run");
  must(runStackSegments(cats, 0).length === 0, "R4d a zero maxBytes renders nothing (no divide by zero)");
  must(runStackSegments({}, 1000).length === 0, "R4e an empty run owns no segments");
  must(
    Math.abs(runStackSegments(cats, 1000).reduce((acc, s) => acc + s.pct, 0) - 100) < 1e-9,
    "R4f the segments reassemble the widest run's full bar"
  );
}

/* ================= R5 — the file ledger ================= */
console.log("R5 — filesForRun: dirName is the filter, bytes stay the order");
{
  const files = [
    { path: "extract_01/big.mrcs", bytes: 500, category: "stacks" as const, dirName: "extract_01", jobId: "j1", jobName: "Extract" },
    { path: "import_01/movie.tif", bytes: 900, category: "other" as const, dirName: "import_01" },
    { path: "extract_01/refine.mrc", bytes: 300, category: "maps" as const, dirName: "extract_01", jobId: "j1", jobName: "Extract" },
    { path: "extract_01/small.mrc", bytes: 700, category: "maps" as const, dirName: "extract_01", jobId: "j1", jobName: "Extract" },
    { path: "other_run/x.star", bytes: 10, category: "tables" as const, dirName: "other_run" },
  ];

  const mine = filesForRun(files, "extract_01");
  must(mine.length === 3, "R5a only this run's rows survive the dirName filter");
  must(mine[0].bytes === 700 && mine[1].bytes === 500 && mine[2].bytes === 300, "R5b heaviest first, restated so the contract survives route reshuffles");

  const maps = filesForRun(files, "extract_01", "maps");
  must(maps.length === 2 && maps[0].bytes === 700, "R5c a category narrows the scope further");

  must(filesForRun(files, "no_such_run").length === 0, "R5d an unknown run owns no rows");

  const withMeta = filesForRun(files, "extract_01")[1];
  must(withMeta.jobId === "j1" && withMeta.jobName === "Extract" && withMeta.path === "extract_01/big.mrcs", "R5e the caller's richer row type rides along untouched (the generic dialect)");
}

/* ================= R6 — the ledger's honesty ================= */
console.log("R6 — runLedgerState + runLedgerLine: three states, no lies");
{
  must(runLedgerState({ files: 5 }, 3) === "ledger", "R6a rows on screen are the ledger state");
  must(runLedgerState({ files: 5 }, 0) === "unlisted", "R6b files on disk but none in the ledger — unlisted, NEVER an empty-directory claim");
  must(runLedgerState({ files: 0 }, 0) === "empty", "R6c a zero-file directory may be called empty");

  const full = runLedgerLine(3, 3);
  must(full.includes("all 3 files on disk made the ledger"), "R6d a complete ledger says it is complete");
  const partial = runLedgerLine(3, 50);
  must(partial.includes("the heaviest 3 of 50 files") && partial.includes("keeps only each category's whales"), "R6e a partial ledger names both numbers — silent partialness would read as the whole directory");
  must(runLedgerLine(0, 0).includes("no files"), "R6f a zero-disk line defers to the empty state's own copy");

  const one = runLedgerLine(1, 1);
  must(!one.includes("file s") && one.includes("1 file"), "R6g the singular file speaks the singular (no '1 files')");
}

/* ================= verdict ================= */
console.log(`\nt458 run-lens bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
