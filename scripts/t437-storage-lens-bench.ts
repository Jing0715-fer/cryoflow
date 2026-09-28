/**
 * t437 bench — the storage lens drill-down's arithmetic.
 *
 *   C1 (TopFilesCollector): the heaviest-K-per-category collector — the
 *      true top K survives the PERIODIC trim (a later big file beats the
 *      kept floor), 0-byte entries never count (a counted link is not a
 *      whale), categories keep separate buckets, the flat snapshot is
 *      heaviest-first and stable across calls, and the K is injectable
 *      so the bench can drill the trim law without 24+ files at default K.
 *   C2 (walkDirUsage + onFile): the listener observes, never participates —
 *      identical totals with and without it; every REGULAR file reported
 *      with its project-relative path, size and category; symlinks are
 *      NOT reported (they carry no bytes); a truncated walk reports only
 *      the entries it actually walked.
 *
 * World contract: pure fs inside a scratch dir under tmpdir (removed on
 * exit); no DB, no network, no server — the route's job-metadata join is
 * thin mapping, covered by tsc and the live QA.
 */

import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import path from "path";
import {
  TopFilesCollector,
  type StorageFileRow,
} from "../src/lib/relion/disk-usage";
import { walkDirUsage } from "../src/lib/relion/disk-walk";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL ${label}`);
  }
}

const row = (
  path: string,
  bytes: number,
  category: StorageFileRow["category"],
  dirName = "run_a"
): StorageFileRow => ({ path, bytes, category, dirName });

/* ------------------------------------------------------------------ */
/* C1 — the heaviest-K collector                                         */
/* ------------------------------------------------------------------ */

{
  console.log("C1 — TopFilesCollector (heaviest K per category)");

  // k=3, 12 ascending map files → periodic trims fire (>3K=9), yet the
  // true top 3 must survive: 1200, 1100, 1000
  const c = new TopFilesCollector(3);
  for (let i = 1; i <= 12; i++) {
    c.add(row(`f${i}.mrc`, i * 100, "maps"));
  }
  let snap = c.snapshot();
  must(snap.length === 3, `C1.1 trimmed to K=3 (got ${snap.length})`);
  must(
    snap.map((r) => r.bytes).join(",") === "1200,1100,1000",
    `C1.2 the true top 3 survived the trims (got ${snap.map((r) => r.bytes).join(",")})`
  );

  // a later BIG file beats the kept floor — the trim must not fossilize
  c.add(row("whale.mrc", 99_000, "maps"));
  snap = c.snapshot();
  must(snap[0].bytes === 99_000, "C1.3 a later whale wins the lens");

  // 0-byte entries are never whales (counted links ride at 0)
  c.add(row("link.mrc", 0, "maps"));
  must(!c.snapshot().some((r) => r.bytes === 0), "C1.4 zero-byte rows excluded");

  // categories keep separate buckets; the flat snapshot is heaviest-first.
  // maps still holds only K=3 rows — the whale displaced 1000, not joined it
  c.add(row("particles.mrcs", 5_000, "stacks"));
  c.add(row("run.out", 10, "logs"));
  snap = c.snapshot();
  must(
    snap.map((r) => r.bytes).join(",") === "99000,5000,1200,1100,10",
    `C1.5 flat snapshot heaviest-first across buckets (got ${snap.map((r) => r.bytes).join(",")})`
  );
  must(
    snap.filter((r) => r.category === "maps").length === 3 &&
      snap.filter((r) => r.category === "stacks").length === 1 &&
      snap.filter((r) => r.category === "logs").length === 1,
    "C1.6 buckets stay separate in the flat list"
  );

  // snapshot is stable across calls (sort-in-place must not shrink buckets)
  const first = c.snapshot().map((r) => r.path).join("|");
  const second = c.snapshot().map((r) => r.path).join("|");
  must(first === second, "C1.7 snapshot is stable across calls");

  // the default K=8: ten files → exactly 8, the top 8
  const d = new TopFilesCollector();
  for (let i = 1; i <= 10; i++) d.add(row(`g${i}.mrc`, i, "maps"));
  const dSnap = d.snapshot();
  must(dSnap.length === 8, `C1.8 default K=8 (got ${dSnap.length})`);
  must(dSnap[0].bytes === 10 && dSnap[7].bytes === 3, "C1.9 the top 8, heaviest first");

  // an empty collector answers honestly
  must(new TopFilesCollector().snapshot().length === 0, "C1.10 empty collector, empty snapshot");
}

/* ------------------------------------------------------------------ */
/* C2 — the walk's onFile listener                                       */
/* ------------------------------------------------------------------ */

const scratch = mkdtempSync(path.join(tmpdir(), "t437-lens-"));
try {
  console.log("C2 — walkDirUsage onFile (the listener observes, never participates)");
  const runA = path.join(scratch, "run_a");
  const nested = path.join(runA, "extra");
  mkdirSync(nested, { recursive: true });
  writeFileSync(path.join(runA, "particles.mrcs"), Buffer.alloc(3000, 1));
  writeFileSync(path.join(runA, "run.out"), Buffer.alloc(100, 1));
  writeFileSync(path.join(runA, "postprocess.star"), Buffer.alloc(200, 1));
  writeFileSync(path.join(nested, "deep.mrc"), Buffer.alloc(4000, 1));
  // the door: a link at 0 bytes — listed, never followed, never REPORTED
  symlinkSync(path.join(runA, "particles.mrcs"), path.join(nested, "stack-link"));

  const seen: StorageFileRow[] = [];
  const withListener = walkDirUsage(runA, {
    onFile: (f) =>
      seen.push(
        row(`run_a/${f.relPath}`, f.bytes, f.category)
      ),
  });
  const silent = walkDirUsage(runA);

  must(
    withListener.bytes === silent.bytes && withListener.files === silent.files,
    "C2.1 identical totals with and without the listener"
  );
  must(silent.files === 5, `C2.2 four files + one link = 5 entries (got ${silent.files})`);
  must(seen.length === 4, `C2.3 the link is NOT reported (got ${seen.length} files)`);

  const byPath = new Map(seen.map((r) => [r.path, r]));
  must(
    byPath.get("run_a/particles.mrcs")?.bytes === 3000 &&
      byPath.get("run_a/particles.mrcs")?.category === "stacks",
    "C2.4 the .mrcs with its size and category"
  );
  must(
    byPath.get("run_a/extra/deep.mrc")?.bytes === 4000 &&
      byPath.get("run_a/extra/deep.mrc")?.category === "maps",
    "C2.5 the nested map carries its nesting in the path"
  );
  must(
    byPath.get("run_a/run.out")?.category === "logs" &&
      byPath.get("run_a/postprocess.star")?.category === "tables",
    "C2.6 the lens agrees with the walk's own classification"
  );
  must(byPath.size === 4, "C2.7 every regular file reported exactly once");

  // truncation: the listener only hears what the walk actually walked
  seen.length = 0;
  const cappedDir = path.join(scratch, "capped");
  mkdirSync(cappedDir);
  writeFileSync(path.join(cappedDir, "a1.star"), Buffer.alloc(1, 1));
  writeFileSync(path.join(cappedDir, "a2.star"), Buffer.alloc(2, 1));
  writeFileSync(path.join(cappedDir, "a3.star"), Buffer.alloc(4, 1));
  writeFileSync(path.join(cappedDir, "a4.star"), Buffer.alloc(8, 1));
  const cut = walkDirUsage(cappedDir, {
    maxEntries: 3,
    onFile: (f) => seen.push(row(`capped/${f.relPath}`, f.bytes, f.category)),
  });
  must(cut.truncated === true, "C2.8 the cap raises the flag");
  must(seen.length === 3, `C2.9 the listener heard exactly the walked 3 (got ${seen.length})`);
  must(
    cut.bytes === seen.reduce((acc, r) => acc + r.bytes, 0),
    "C2.10 listener sizes sum to the walked total — no side channel"
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ */

console.log(`\nt437: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
