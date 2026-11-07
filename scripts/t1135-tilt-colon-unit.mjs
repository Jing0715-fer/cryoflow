#!/usr/bin/env node
// t1135-tilt-colon-unit.mjs — the classification family's books speak valid
// floats, the census's 73rd instrument.
//
// THE WEIGH (this window's decision record, evidence-first): t1133 healed
// the class2d signal and t1134 sealed the autopick's retirement word; the
// standing candidate was the DOWNSTREAM CASCADE WEIGH — select2d → select →
// initialmodel → class3d → refine3d → postprocess all ran in the seed era
// (10-17 15:25-15:31 UTC) and every one of them consumed the class2d
// outputs that t1132/t1133 later healed. The question: do the downstream
// engines' artifacts carry seed-era derivations a re-run would heal?
// THE EVIDENCE, three legs:
//   (1) THE TIMELINE — all nine downstream jobs stopped in the seed era;
//   (2) THE MAPS — relion_refine's volumes are write_mrc(seed) (deterministic
//       synthetic, seed = f(iter, class)); relion_postprocess reads the REAL
//       half-map header (dims/angpix) but writes a deterministic interior
//       blob + LCG texture; relion_mask_create writes the geometry contract.
//       A downstream ride would rewrite IDENTICAL bytes — nothing healable,
//       the t1134 NO-GO shape exactly;
//   (3) THE BOOKS — the weigh's walk found the REAL defect: every
//       run_data.star the classification family ever wrote carries a
//       MALFORMED _rlnAngleTilt — `90.0.2`, a float with two dots, on every
//       row. 121360 corrupt floats across five workdirs (refine3d 79408,
//       class2d 19776, initialmodel 19392, class3d 2688, select 96 — the
//       select book is the app-side pass-through, the corruption rides it).
//
// THE ROOT CAUSE: the f-string lost its colon —
//   f"...\\t{90.0 - p}.2\\t..."   (the literal ".2" glued after the value)
// where the author's own ".2" was a precision SPEC: {90.0 - p:.2f}. The
// corruption speaks from BOTH lanes (the it000 seed-round writer and the
// per-iteration classification writer). The product's readers are lenient
// (parseFloat("90.0.2") === 90.0) so the UI never showed it — but the books
// are the provenance artifacts, and a strict reader (real RELION's star
// parser) refuses the whole file on exactly this shape.
//
// THE CURE (services/mock-cluster/fs/opt/bin/relion_refine): both writer
// sites now carry the colon ({90.0 - p:.2f}); and per the t1134 family law
// (THE FALLBACK SAYS ITS NAME) the classification family's summary words now
// name the volume maps' contract — "the volume maps are this stub's own
// deterministic contract (seed-written; not derived from the particles,
// t1135)" — the 2D class averages may be pixel-derived in real mode, the
// VOLUMES never are, and the words now say so on both lanes (fresh + continue).
//
// THE INSTRUMENT (real engine e2e at unit level, the t1134 shape): a
// fabricated micro-world whose input star resolves (the merge-integrity
// audit accepts star-dir/cwd), the engine invoked as a subprocess — the
// books walked STRICTLY (every _rlnAngleTilt cell must match
// ^-?\\d+(\\.\\d+)?$ — the corrupt two-dot shape fails on sight), both
// writer sites exercised (the it000 book AND the per-iteration book), the
// lane word and the map-contract word pinned from stdout, and the books'
// determinism law pinned (same inputs → byte-identical books).

import { spawnSync } from "child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, dirname, resolve } from "path";

const REPO = resolve(dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "..");
const ENGINE = join(REPO, "services/mock-cluster/fs/opt/bin/relion_refine");

let n = 0, fail = 0;
function must(cond, name) {
  n++;
  if (cond) console.log(`  ok ${n} — ${name}`);
  else { fail++; console.log(`  FAIL ${n} — ${name}`); }
}

const ROWS = 8;

function writeFixture(dir) {
  // the stack file exists (the merge-integrity audit resolves it) but its
  // bytes are not readable crops — the real-mode lane fails its box walk and
  // the legacy lane speaks its name; the tilt writer is shared by BOTH lanes
  writeFileSync(join(dir, "part.mrcs"), "NOT-AN-MRC — the fixture's own bytes");
  const lines = ["data_particles", "", "loop_",
    "_rlnImageName #1", "_rlnOpticsGroup #2"];
  for (let p = 1; p <= ROWS; p++) {
    lines.push(`00000${p}@part.mrcs\t1`);
  }
  writeFileSync(join(dir, "in.star"), lines.join("\n") + "\n");
}

function walkTiltColumn(starPath) {
  // returns { rows, bad } — bad = cells that are NOT strict floats
  const text = readFileSync(starPath, "utf8");
  const out = { rows: 0, bad: [] };
  let inLoop = false, tiltCol = -1, cols = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("_rln")) {
      if (/_rlnAngleTilt\b/.test(line)) tiltCol = cols;
      cols++;
      continue;
    }
    if (line === "loop_") { inLoop = true; cols = 0; continue; }
    if (!inLoop || !line || line.startsWith("data_") || line.startsWith("#")) continue;
    const cells = line.split(/\s+/);
    if (cells.length < 2 || !cells[0].includes("@")) continue;
    out.rows++;
    if (tiltCol >= 0) {
      const cell = cells[tiltCol];
      if (!/^-?\d+(\.\d+)?$/.test(cell)) out.bad.push(cell);
    }
  }
  return out;
}

const world = mkdtempSync(join(tmpdir(), "t1135-tilt-"));
try {
  // ---- band A: the fresh classification lane (both writer sites) ----------
  writeFixture(world);
  const outA = join(world, "outA");
  mkdirSync(outA, { recursive: true });
  const runA = spawnSync("python3", [ENGINE,
    "--i", "in.star", "--o", "outA/run", "--K", "3", "--iter", "2"],
    { cwd: world, encoding: "utf8" });

  must(runA.status === 0, `the engine runs the fixture world (exit ${runA.status})`);
  must(/legacy synthetic classes/.test(runA.stdout ?? ""),
    "the lane's own word speaks (legacy synthetic classes — the fixture's bytes are not readable crops)");
  must(/seed-written.*t1135|t1135.*seed-written/.test(runA.stdout ?? "") &&
       /every map is this stub's own seed-written contract \(not derived from the particles\)/.test(runA.stdout ?? ""),
    "the summary names the maps' contract with the lane's precision (the legacy lane: every map seed-written, t1135 writer + t1136 the precise split)");

  const bookA = join(world, "outA", "run_data.star");
  const it000A = join(world, "outA", "run_it000_data.star");
  must(existsSync(bookA) && existsSync(it000A),
    "both books exist (the per-iteration book AND the it000 seed-round book)");

  const walkA = walkTiltColumn(bookA);
  must(walkA.rows === ROWS && walkA.bad.length === 0,
    `the per-iteration book's tilt column is strictly clean (${walkA.rows}/${ROWS} rows, ${walkA.bad.length} malformed cells${walkA.bad.length ? ": " + walkA.bad.slice(0, 3).join(",") : ""})`);

  const walkIt0 = walkTiltColumn(it000A);
  must(walkIt0.rows === ROWS && walkIt0.bad.length === 0,
    `the it000 book's tilt column is strictly clean (the seed-round writer's cure, ${walkIt0.bad.length} malformed cells)`);

  // ---- band B: the books' determinism law ---------------------------------
  const outB = join(world, "outB");
  mkdirSync(outB, { recursive: true });
  spawnSync("python3", [ENGINE,
    "--i", "in.star", "--o", "outB/run", "--K", "3", "--iter", "2"],
    { cwd: world, encoding: "utf8" });
  const same = existsSync(join(world, "outB", "run_data.star")) &&
    readFileSync(join(world, "outB", "run_data.star")).equals(readFileSync(bookA));
  must(same, "the books' determinism law holds (two runs, byte-identical run_data.star)");

  // ---- band C: the source's own two sites ---------------------------------
  const src = readFileSync(ENGINE, "utf8");
  const cured = (src.match(/90\.0 - p:\.2f/g) ?? []).length;
  const corrupt = (src.match(/90\.0 - p\}\.2/g) ?? []).length;
  must(cured === 2 && corrupt === 0,
    `the source wears the colon on BOTH writer sites and zero corrupt sites (${cured} cured, ${corrupt} corrupt)`);
} finally {
  rmSync(world, { recursive: true, force: true });
}

console.log(`\n${n}/${n - fail} green${fail === 0 ? " — the books speak valid floats." : ` — ${fail} FAIL(S).`}`);
process.exit(fail === 0 ? 0 : 1);
