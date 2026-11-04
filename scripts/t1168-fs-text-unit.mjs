// t1168 — THE FS-TEXT UNIT: a head read gets bytes, not files; a row
// count streams chunks, never materializes the text.
//
// The oldest-routes sweep's yield: three request-path readers meant to
// touch a file's HEAD or COUNT its rows, and each reached for
// readFileSync(..., "utf8") — the WHOLE file before the .slice(0, 4000)
// or the .split("\n") could speak. A real Extract's particles.star is
// gigabytes; the import's movies.star is tens of megabytes; the intent
// was a 4 KB probe, the bill was the whole file — on a click path, once
// per .star in the workdir. The class is the sync-read plague (#7) in a
// new coat: not "sync vs async" but "bounded vs unbounded".
//
// THE CURE, one well: src/lib/fs-text.ts (readTextHead — the buffer is
// sized min(size, maxBytes) BEFORE the first read; countRowsContaining —
// a 1 MiB stream with a carry that re-joins the boundary-straddling
// line), wired into the three call sites:
//   - jobs/[id]/particles  findParticlesStar (the head probe, 4 KB);
//   - hpc/sbatch/[id]      the dry-run's micrograph volume (streamed);
//   - relion/star-shape    readStarMoviesShape — the dispatch gate's
//     classification, now a HEAD LADDER (256 KB → 1 MB → 8 MB → whole),
//     escalating on an undecided DIALECT — never on "a table was seen"
//     (the parity law: the bounded read answers exactly what the whole
//     read answered, or it has not answered yet).
// Plus the sweep's smallest cut: ai-verdict's dead `import { db }`.
//
// A — the well's functional face: exact-byte heads, short files, empty
//     files, honest nulls, the boundary-straddling row counted once,
//     the mega-line absorbed (counted once, tail skipped, terminates),
//     the multi-chunk tally exact.
// B — the shape ladder: real stars decide in the first rung; the
//     pathological star (labels beyond 256 KB, optics rows before the
//     movies table) escalates and still answers movies — the parity pin
//     that would have failed a "stop at the first table" ladder.
// C — the source law: the routes name the well and never touch
//     readFileSync / dynamic fs imports; the well itself never
//     whole-reads; the gate's callers ride the cure unforked.
//
// node scripts/unit-runner.mjs scripts/t1168-fs-text-unit.mjs
//

import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROW_CHUNK_BYTES, readTextHead, countRowsContaining } from "@/lib/fs-text";
import { readStarMoviesShape, starMoviesShapeOf } from "@/lib/relion/star-shape";

const here = join(...["/home/z/my-project"]);
const ROOT = here;
const particlesSrc = readFileSync(join(ROOT, "src/app/api/jobs/[id]/particles/route.ts"), "utf8");
const sbatchSrc = readFileSync(join(ROOT, "src/app/api/hpc/sbatch/[id]/route.ts"), "utf8");
const aiVerdictSrc = readFileSync(join(ROOT, "src/app/api/jobs/[id]/ai-verdict/route.ts"), "utf8");
const starShapeSrc = readFileSync(join(ROOT, "src/lib/relion/star-shape.ts"), "utf8");
const fsTextSrc = readFileSync(join(ROOT, "src/lib/fs-text.ts"), "utf8");
const engineSrc = readFileSync(join(ROOT, "src/lib/relion/engine.ts"), "utf8");
const remoteRunSrc = readFileSync(join(ROOT, "src/lib/remote/remote-run.ts"), "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}`);
  }
}

// ---- the tmp world -----------------------------------------------------
const dir = mkdtempSync(join(tmpdir(), "t1168-fs-text-"));

function starMoviesText(rows) {
  const lines = [
    "data_optics",
    "loop_",
    "_rlnOpticsGroup #1",
    "_rlnVoltage #2",
    "1 300",
    "",
    "data_movies",
    "loop_",
    "_rlnMicrographMovieName #60",
  ];
  for (let i = 0; i < rows; i++) {
    lines.push(`Micrographs/mic_${String(i).padStart(6, "0")}.mrc`);
  }
  return lines.join("\n") + "\n";
}

function starMicrographsText(rows) {
  const lines = [
    "data_optics",
    "loop_",
    "_rlnOpticsGroup #1",
    "1",
    "",
    "data_micrographs",
    "loop_",
    "_rlnMicrographName #61",
  ];
  for (let i = 0; i < rows; i++) {
    lines.push(`MotionCorr/job002/mic_${String(i).padStart(6, "0")}.mrc`);
  }
  return lines.join("\n") + "\n";
}

try {
  console.log("A — the well's functional face (readTextHead)");
  {
    const p = join(dir, "exact.bin");
    writeFileSync(p, "0123456789".repeat(10), "utf8"); // 100 bytes
    const h = readTextHead(p, 10);
    ok("A1 exact-byte head: 10 of 100 bytes", h !== null && h.text.length === 10 && h.text === "0123456789");
    ok("A2 the head knows it truncated", h !== null && h.truncated === true);
  }
  {
    const p = join(dir, "short.txt");
    writeFileSync(p, "tiny", "utf8");
    const h = readTextHead(p, 100);
    ok("A3 short file: whole content, not truncated", h !== null && h.text === "tiny" && h.truncated === false);
  }
  {
    const p = join(dir, "empty.txt");
    writeFileSync(p, "", "utf8");
    const h = readTextHead(p, 4000);
    ok("A4 empty file: empty text, not truncated", h !== null && h.text === "" && h.truncated === false);
  }
  {
    const h = readTextHead(join(dir, "no-such-file.txt"), 4000);
    ok("A5 unreadable file: honest null", h === null);
  }
  {
    const p = join(dir, "big3mb.bin");
    writeFileSync(p, "x".repeat(3 * 1024 * 1024), "utf8");
    const h = readTextHead(p, 4000);
    ok("A6 the particles probe's own numbers: 4000 of 3 MB", h !== null && h.text.length === 4000 && h.truncated === true);
  }
  {
    const p = join(dir, "ladder.bin");
    writeFileSync(p, "y".repeat(64), "utf8");
    const h = readTextHead(p, Number.POSITIVE_INFINITY);
    ok("A7 the Infinity rung reads the whole file, untruncated", h !== null && h.text.length === 64 && h.truncated === false);
  }

  console.log("A — the well's functional face (countRowsContaining)");
  {
    const p = join(dir, "small.txt");
    const lines = [];
    for (let i = 0; i < 20; i++) lines.push(i % 4 === 0 ? `mic_${i}.mrc` : `mic_${i}.txt`);
    writeFileSync(p, lines.join("\n") + "\n", "utf8");
    ok("A8 small file: 5 of 20 lines name .mrc", countRowsContaining(p, ".mrc") === 5);
  }
  {
    const p = join(dir, "chunked.star");
    const lines = [];
    let tally = 0;
    for (let i = 0; i < 50000; i++) {
      const hit = i % 97 === 0;
      if (hit) tally += 1;
      lines.push(`row_${String(i).padStart(6, "0")} ${hit ? "Micrographs/mic.mrc" : "Micrographs/mic.tif"} pad_${"p".repeat(24)}`);
    }
    writeFileSync(p, lines.join("\n") + "\n", "utf8");
    const n = countRowsContaining(p, ".mrc");
    ok(`A9 multi-chunk tally exact (${tally} in ~3 MB, boundary-straddling rows included)`, n === tally);
  }
  {
    const p = join(dir, "straddle.txt");
    // the needle's line straddles the chunk boundary exactly: "a.m" ends
    // chunk 1, "rc\n" opens chunk 2 — the carry must re-join it.
    writeFileSync(p, "z".repeat(ROW_CHUNK_BYTES - 4) + "\n" + "a.mrc\n", "utf8");
    ok("A10 the boundary-straddling row counts exactly once", countRowsContaining(p, ".mrc") === 1);
  }
  {
    const p = join(dir, "unterminated.txt");
    writeFileSync(p, "one.mrc\ntwo.mrc", "utf8"); // final line carries no \n
    ok("A11 the final unterminated line counts", countRowsContaining(p, ".mrc") === 2);
  }
  {
    const p = join(dir, "mega.txt");
    // a single 2 MB "line" (no \n) whose needle sits in the SEEN part, a
    // second needle in the ABSORBED tail: counted once, tail skipped, and
    // the counter terminates (no infinite loop on the mega-line).
    writeFileSync(p, ".mrc" + "q".repeat(ROW_CHUNK_BYTES) + ".mrc" + "q".repeat(ROW_CHUNK_BYTES - 4) + "\n", "utf8");
    ok("A12 the mega-line counts once and terminates", countRowsContaining(p, ".mrc") === 1);
  }
  {
    const p = join(dir, "mega-tail.txt");
    writeFileSync(p, ".mrc" + "q".repeat(ROW_CHUNK_BYTES * 2) + "\n" + "tail.mrc\n", "utf8");
    ok("A13 the line after a mega-line still counts", countRowsContaining(p, ".mrc") === 2);
  }
  {
    const p = join(dir, "none.txt");
    writeFileSync(p, "", "utf8");
    ok("A14 empty file: zero rows", countRowsContaining(p, ".mrc") === 0);
  }
  {
    ok("A15 unreadable file: honest null", countRowsContaining(join(dir, "no-such.star"), ".mrc") === null);
  }
  {
    const p = join(dir, "small.txt");
    ok("A16 an empty needle refuses (null, not a crash)", countRowsContaining(p, "") === null);
  }

  console.log("B — the shape ladder (readStarMoviesShape)");
  {
    const p = join(dir, "movies.star");
    writeFileSync(p, starMoviesText(50), "utf8");
    const s = readStarMoviesShape(p);
    ok("B1 a real movies star: data_movies, movies", s !== null && s.table === "data_movies" && s.dialect === "movies");
  }
  {
    const p = join(dir, "movies-huge.star");
    writeFileSync(p, starMoviesText(60000), "utf8"); // ~4 MB of rows behind a 1 KB head
    const s = readStarMoviesShape(p);
    ok("B2 a 4 MB movies star: the head answers, dialect movies", s !== null && s.table === "data_movies" && s.dialect === "movies");
  }
  {
    const p = join(dir, "micrographs.star");
    writeFileSync(p, starMicrographsText(50), "utf8");
    const s = readStarMoviesShape(p);
    ok("B3 the micrographs dialect: data_micrographs, micrographs", s !== null && s.table === "data_micrographs" && s.dialect === "micrographs");
  }
  {
    const p = join(dir, "other.star");
    writeFileSync(p, "data_general\nloop_\n_rlnVoltage #1\n300\n", "utf8");
    const s = readStarMoviesShape(p);
    ok("B4 a star with no mic column: final { data_general, null } — the refusal's own words", s !== null && s.table === "data_general" && s.dialect === null);
  }
  {
    // THE PARITY PIN: data_optics first (table seen in the first rung!),
    // then 400 KB of optics ROWS (no labels), then data_movies' label —
    // the movies table lives beyond the 256 KB rung. A ladder that stops
    // at "a table was seen" would answer { data_optics, null } and the
    // gate would refuse a dispatch the whole-read allowed. The dialect
    // ladder escalates and answers movies.
    const p = join(dir, "movies-deep.star");
    const lines = [
      "data_optics",
      "loop_",
      "_rlnOpticsGroup #1",
      "_rlnVoltage #2",
    ];
    for (let i = 0; i < 9000; i++) lines.push(`1 300 optics_row_${i} ${"pad".repeat(10)}`);
    lines.push("data_movies", "loop_", "_rlnMicrographMovieName #60", "Micrographs/mic_000000.mrc");
    writeFileSync(p, lines.join("\n") + "\n", "utf8");
    const s = readStarMoviesShape(p);
    ok("B5 the deep movies table: the ladder escalates past data_optics and answers movies", s !== null && s.table === "data_movies" && s.dialect === "movies");
  }
  {
    // the whole-read parity on the SAME file, via the pure classifier —
    // the ladder must answer what the whole text answers.
    const p = join(dir, "movies-deep.star");
    const whole = starMoviesShapeOf(readFileSync(p, "utf8"));
    const s = readStarMoviesShape(p);
    ok("B6 ladder parity with the whole-read on the deep star", s !== null && whole !== null && s.table === whole.table && s.dialect === whole.dialect);
  }
  {
    ok("B7 an unreadable star: honest null (not a verdict)", readStarMoviesShape(join(dir, "no-such.star")) === null);
  }

  console.log("C — the source law (the routes name the well)");
  {
    ok("C1 particles route: readFileSync is gone", !particlesSrc.includes("readFileSync"));
    ok("C2 particles route: the head probe rides the well", particlesSrc.includes("readTextHead(p, 4000)") && particlesSrc.includes('from "@/lib/fs-text"'));
    ok("C3 sbatch route: the dynamic fs import is gone", !sbatchSrc.includes('await import("fs")'));
    ok("C4 sbatch route: readFileSync is gone", !sbatchSrc.includes("readFileSync"));
    ok("C5 sbatch route: the streamed counter rides the well", sbatchSrc.includes("countRowsContaining(star") && sbatchSrc.includes('from "@/lib/fs-text"'));
    ok("C6 ai-verdict route: the dead db import is gone", !aiVerdictSrc.includes('from "@/lib/db"'));
    ok("C7 star-shape: readFileSync is gone (the ladder reads heads)", !starShapeSrc.includes("readFileSync"));
    ok("C8 star-shape: the ladder escalates on the DIALECT, never on a seen table", starShapeSrc.includes("shape.dialect !== null") && starShapeSrc.includes("SHAPE_HEAD_LADDER"));
    ok("C9 the well itself never whole-reads (no readFileSync import; readSync + the min-size buffer)", !/\breadFileSync\b/.test(fsTextSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")) && fsTextSrc.includes("Math.min(st.size, maxBytes)") && fsTextSrc.includes("readSync("));
    ok("C10 the well's two verbs and the exported stride", fsTextSrc.includes("export function readTextHead") && fsTextSrc.includes("export function countRowsContaining") && fsTextSrc.includes("export const ROW_CHUNK_BYTES"));
    ok("C11 the dispatch gate rides the cure unforked (engine.ts)", engineSrc.includes('readStarMoviesShape(inputs.micrographs_star)') && engineSrc.includes('from "./star-shape"'));
    ok("C12 the remote lane rides the cure unforked (remote-run.ts)", remoteRunSrc.includes("readStarMoviesShape(localStar)") && remoteRunSrc.includes('from "@/lib/relion/star-shape"'));
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\nt1168 fs-text unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
