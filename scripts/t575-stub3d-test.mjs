/**
 * t575 — the fake cluster's class3d 3D dialect, pinned at the binary level.
 *
 * The 3D judge (t573) reads per-class VOLUMES (`run_itNNN_classMMM.mrc`);
 * the judge worker (t574) auto-judges completed class3d jobs; but the mock
 * cluster's relion_refine stub never knew class3d existed — `--mode` is
 * passed by nobody, so the default classify2d lane wrote per-class files
 * as 2D (64×64×1, kind="classes"). This suite runs the stub AS A BINARY
 * (the diag-t320 pattern: spawn python, read the MRC headers back) and
 * pins the repaired dialect on both lanes:
 *   • real_mode (readable stacks) — per-class 64³ float32 volumes from
 *     cf_cryo.class_volume, the seed round included, final no-tag aliases
 *     byte-identical to the last round (a real class3d's closing move),
 *     half maps and the classes.mrcs stack untouched;
 *   • legacy (present-but-unreadable stacks → real_mode off; note the
 *     t308 audit HARD-REFUSES missing stacks, so garbage bytes are the
 *     only honest way in) — per-class still 64³, kind="volume";
 *   • class2d byte-stability — the 2D lane's per-class averages, its
 *     classes.mrcs stack, and the absence of extra no-tag aliases are
 *     untouched by the class3d branch (the t574 live-fire's world must
 *     not shift under this window's feet).
 *
 * Usage: node scripts/t575-stub3d-test.mjs
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BIN = join(process.cwd(), "services/mock-cluster/fs/opt/bin/relion_refine");
// a REAL, readable stack from the world's t574-repaired extract inputs —
// readable bytes are what flips real_mode on
const STACK =
  "/home/z/my-project/services/mock-cluster/fs/home/z/my-project/data/relion/" +
  "cmuro2ufe000mn5nb3qkwuy49/extract_uxfic7tb/micrographs/Falcon_2012_06_12-14_33_35_0.mrcs";

let pass = 0, fail = 0;
const check = (name, ok, evidence) => {
  if (ok) { pass++; console.log(`  ✓ ${name}${evidence ? ` — ${evidence}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${evidence ? ` — ${evidence}` : ""}`); }
};

const writeStar = (path, stackRef, rows = 8) => {
  writeFileSync(
    path,
    "\ndata_particles\n\nloop_\n_rlnImageName #1\n_rlnClassNumber #2\n" +
      Array.from({ length: rows }, (_, i) => `${String(i + 1).padStart(6, "0")}@${stackRef}\t${(i % 4) + 1}\n`).join("")
  );
};

const header = (p) => {
  const h = readFileSync(p).subarray(0, 1024);
  return {
    nx: h.readInt32LE(0), ny: h.readInt32LE(4), nz: h.readInt32LE(8),
    mode: h.readInt32LE(12),
  };
};

const runStub = (argv, outdir) => {
  execFileSync("python3", [BIN, ...argv], { timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });
  return outdir;
};

const tmp = mkdtempSync(join(tmpdir(), "t575-stub3d-"));
try {
  check("stub binary exists", existsSync(BIN), BIN);
  check("world stack readable (real_mode's supply)", existsSync(STACK));

  /* ---- lane 1: class3d real_mode — the 3D volume dialect ---- */
  const star1 = join(tmp, "c3d.star");
  writeStar(star1, STACK);
  const out1 = join(tmp, "c3d-real");
  runStub(["--i", star1, "--ref", "/nonexistent/ref.mrc", "--o", join(out1, "run"),
           "--K", "4", "--iter", "2", "--tau2_fudge", "4", "--sym", "C1", "--ctf"], out1);
  for (const c of [1, 2, 3, 4]) {
    const p = join(out1, `run_it002_class${String(c).padStart(3, "0")}.mrc`);
    const h = header(p);
    check(`real it002 class${c} is 64³ float32`, h.nx === 64 && h.ny === 64 && h.nz === 64 && h.mode === 2,
      `${h.nx}x${h.ny}x${h.nz} m${h.mode}`);
    check(`real it002 class${c} byte size exact`, readFileSync(p).length === 1024 + 64 ** 3 * 4);
  }
  const seed = header(join(out1, "run_it000_class002.mrc"));
  check("seed round it000 class002 is 64³", seed.nz === 64 && seed.mode === 2, `${seed.nx}x${seed.ny}x${seed.nz}`);
  for (const c of [1, 2, 3, 4]) {
    const a = readFileSync(join(out1, `run_it002_class${String(c).padStart(3, "0")}.mrc`));
    const b = readFileSync(join(out1, `run_class${String(c).padStart(3, "0")}.mrc`));
    check(`final no-tag alias run_class${c} == it-last volume`, a.equals(b));
  }
  const half = header(join(out1, "run_it002_half1_class001.mrc"));
  check("half maps still 64³ (REFINE_FAMILY_CANDIDATES' ports)", half.nz === 64, `${half.nx}x${half.ny}x${half.nz}`);
  check("classes.mrcs stack still written (gallery compat)", existsSync(join(out1, "run_classes.mrcs")));

  /* ---- lane 2: class3d legacy — present-but-unreadable stacks ---- */
  const ghost = join(tmp, "garbage.mrcs");
  writeFileSync(ghost, Buffer.alloc(4096)); // exists, but no honest MRC header
  const star2 = join(tmp, "c3d-ghost.star");
  writeStar(star2, ghost);
  const out2 = join(tmp, "c3d-legacy");
  runStub(["--i", star2, "--ref", "/nonexistent/ref.mrc", "--o", join(out2, "run"),
           "--K", "3", "--iter", "1"], out2);
  const leg = header(join(out2, "run_it001_class002.mrc"));
  check("legacy class3d per-class is 64³ (kind=volume, honestly 3D)", leg.nz === 64 && leg.mode === 2,
    `${leg.nx}x${leg.ny}x${leg.nz}`);
  check("legacy final alias run_class003 exists", existsSync(join(out2, "run_class003.mrc")));

  /* ---- lane 3: class2d byte-stability — the 2D lane untouched ---- */
  const out3 = join(tmp, "c2d");
  runStub(["--i", star1, "--o", join(out3, "run"), "--K", "4", "--iter", "1"], out3);
  const c2 = header(join(out3, "run_it001_class002.mrc"));
  check("class2d per-class stays 2D (64×64×1)", c2.nx === 64 && c2.ny === 64 && c2.nz === 1,
    `${c2.nx}x${c2.ny}x${c2.nz}`);
  const stack = header(join(out3, "run_classes.mrcs"));
  check("class2d classes.mrcs carries K slices", stack.nz === 4, `nz=${stack.nz}`);
  check("class2d grows NO extra no-tag per-class aliases", !existsSync(join(out3, "run_class002.mrc")));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
