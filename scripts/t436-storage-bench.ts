/**
 * t436 bench — the project storage overview's arithmetic.
 *
 *   C1 (classifyStorageFile): the extension lens — maps (.mrc/.map plus
 *      the .mrc.gz/.map.gz double extensions, which the naive last-segment
 *      reader would drop into `other`), stacks (.mrcs), tables (.star),
 *      logs (.out/.err/.log/.txt), plots (.eps/.png/...), and the honest
 *      `other` for everything unnamed (including dotfiles, where the
 *      "extension" is the whole name).
 *   C2 (fmtBytes): the cleanup dialog's dialect, lifted verbatim — one
 *      byte formatter per app (1024 base, B / 1-decimal KB·MB / 2-decimal GB).
 *   C3 (walkDirUsage): a real temp tree — nested aggregation, the symlink
 *      honesty law (a link is LISTED at 0 bytes and NEVER followed, so a
 *      link to the biggest stack must not double it), the empty-dir and
 *      never-ran laws (exists true with zeros / exists false), the
 *      truncation law (an injected small cap floors the numbers and flags
 *      truncated), and the depth cap (nested work excluded at maxDepth 0).
 *
 * World contract: pure fs inside a scratch dir under .qa-logs (removed on
 * exit); no DB, no network, no server.
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
  STORAGE_CATEGORIES,
  classifyStorageFile,
  fmtBytes,
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

/* ------------------------------------------------------------------ */
/* C1 — the extension lens                                              */
/* ------------------------------------------------------------------ */

{
  console.log("C1 — classifyStorageFile (the extension lens)");
  const cases: Array<[string, ReturnType<typeof classifyStorageFile>]> = [
    ["run.out", "logs"],
    ["run.err", "logs"],
    ["job.log", "logs"],
    ["note.txt", "logs"],
    ["refine_half1_class001.mrc", "maps"],
    ["sharpened.MRC", "maps"], // case-blind
    ["initial_model.map", "maps"],
    ["postprocess.mrc.gz", "maps"], // the double-extension trap
    ["half1.map.gz", "maps"],
    ["particles.mrcs", "stacks"],
    ["movies.mrcs", "stacks"],
    ["particles_star", "other"], // no extension → honest other
    ["run_data.star", "tables"],
    ["postprocess.star", "tables"],
    ["plot.eps", "plots"],
    ["thumb.png", "plots"],
    ["report.pdf", "plots"],
    ["icon.svg", "plots"],
    ["Makefile", "other"],
    [".star", "other"], // a dotfile's "extension" is its whole name — lens stays honest
    ["deep/nested/file.mrcs", "stacks"], // relative paths work too
  ];
  for (const [input, want] of cases) {
    must(classifyStorageFile(input) === want, `C1 ${input} → ${want}`);
  }
  must(STORAGE_CATEGORIES.length === 6, "C1 six categories on the legend");
}

/* ------------------------------------------------------------------ */
/* C2 — the byte formatter                                              */
/* ------------------------------------------------------------------ */

{
  console.log("C2 — fmtBytes (the cleanup dialog's dialect, verbatim)");
  must(fmtBytes(0) === "0 B", "C2.1 zero");
  must(fmtBytes(1023) === "1023 B", "C2.2 just under");
  must(fmtBytes(1024) === "1.0 KB", "C2.3 kilobyte boundary");
  must(fmtBytes(1536) === "1.5 KB", "C2.4 one decimal");
  must(fmtBytes(1024 * 1024) === "1.0 MB", "C2.5 megabyte boundary");
  must(fmtBytes(1.5 * 1024 * 1024 * 1024) === "1.50 GB", "C2.6 two decimals in GB");
}

/* ------------------------------------------------------------------ */
/* C3 — the walk (a real scratch tree)                                  */
/* ------------------------------------------------------------------ */

const scratch = mkdtempSync(path.join(tmpdir(), "t436-walk-"));
try {
  console.log("C3 — walkDirUsage (a real tree, the honesty laws)");
  const runA = path.join(scratch, "run_a");
  const nested = path.join(runA, "extra");
  mkdirSync(nested, { recursive: true });
  writeFileSync(path.join(runA, "particles.mrcs"), Buffer.alloc(3000, 1));
  writeFileSync(path.join(runA, "run.out"), Buffer.alloc(100, 1));
  writeFileSync(path.join(runA, "postprocess.star"), Buffer.alloc(200, 1));
  writeFileSync(path.join(runA, "thumb.png"), Buffer.alloc(50, 1));
  writeFileSync(path.join(nested, "deep.mrc"), Buffer.alloc(4000, 1));
  // the door: a symlink to the biggest stack — listed at 0, never followed
  symlinkSync(path.join(runA, "particles.mrcs"), path.join(nested, "stack-link"));

  const usage = walkDirUsage(runA);
  must(usage.exists === true, "C3.1 the tree exists");
  must(usage.bytes === 7350, `C3.2 nested aggregation = 7350 (got ${usage.bytes})`);
  must(usage.files === 6, `C3.3 five files + one link = 6 (got ${usage.files})`);
  must(usage.categories.stacks.bytes === 3000, "C3.4 stacks hold the .mrcs");
  must(usage.categories.maps.bytes === 4000, "C3.5 maps hold the nested .mrc");
  must(usage.categories.tables.bytes === 200, "C3.6 tables hold the .star");
  must(usage.categories.logs.bytes === 100, "C3.7 logs hold the .out");
  must(usage.categories.plots.bytes === 50, "C3.8 plots hold the .png");
  must(
    usage.categories.other.bytes === 0 && usage.categories.other.files === 1,
    "C3.9 the link rides other at 0 bytes"
  );
  must(usage.truncated === false, "C3.10 an uncapped walk never lies truncated");

  const emptyRun = path.join(scratch, "empty_run");
  mkdirSync(emptyRun);
  const empty = walkDirUsage(emptyRun);
  must(empty.exists === true && empty.bytes === 0 && empty.files === 0, "C3.11 empty dir: exists, zeros");

  const ghost = walkDirUsage(path.join(scratch, "never_ran"));
  must(ghost.exists === false && ghost.bytes === 0, "C3.12 never-ran dir: honest absence");

  // truncation: cap 3 over a 4-file dir — numbers are floors, flag is up
  const capped = path.join(scratch, "capped");
  mkdirSync(capped);
  writeFileSync(path.join(capped, "a1.star"), Buffer.alloc(1, 1));
  writeFileSync(path.join(capped, "a2.star"), Buffer.alloc(2, 1));
  writeFileSync(path.join(capped, "a3.star"), Buffer.alloc(4, 1));
  writeFileSync(path.join(capped, "a4.star"), Buffer.alloc(8, 1));
  const cut = walkDirUsage(capped, { maxEntries: 3 });
  must(cut.truncated === true, "C3.13 the cap raises the flag");
  must(cut.files === 3, `C3.14 exactly 3 entries walked (got ${cut.files})`);
  // the FLOOR property, not a readdir order (ext4 hash order is not ours
  // to pin): some strict subset of the whole — positive, less than 15
  must(cut.bytes > 0 && cut.bytes < 15, `C3.15 a floor, not the total (got ${cut.bytes})`);

  // depth cap: maxDepth 0 keeps the walk out of nested dirs
  const shallow = walkDirUsage(runA, { maxDepth: 0 });
  must(shallow.bytes === 3350, `C3.16 nested .mrc excluded at maxDepth 0 (got ${shallow.bytes})`);
  must(shallow.categories.maps.bytes === 0, "C3.17 the nested map is not counted");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ */

console.log(`\nt436: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
