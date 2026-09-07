/**
 * Test: resumableOptimiser partial-checkpoint guard (the class2d_u8voe932 bug).
 *
 * Real-world failure: a class2d run was killed mid-checkpoint-flush — the
 * workdir kept run_it000_optimiser.star but NOT run_it000_sampling.star.
 * The old resumableOptimiser returned that partial checkpoint, the rerun
 * walked the --continue branch, and RELION aborted:
 *   "ERROR: HealpixSampling::readStar: File run_it000_sampling.star cannot
 *    be read" (exit 1).
 *
 * The fix: only iterations whose FULL companion set (data/model/sampling
 * .star + 3D half maps / 2D class images) exists on disk are resumable,
 * scanning newest → oldest; no complete iteration → fresh start.
 *
 * Run: bun scripts/test-resume-checkpoint.ts
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { resumableOptimiser } from "../src/lib/relion/engine";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.error(`  FAIL  ${name}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
  }
}

function scratch(): string {
  return mkdtempSync(path.join(tmpdir(), "cryoflow-resume-"));
}

/** touch a set of files inside dir (creating parents) */
function touch(dir: string, files: string[]): void {
  for (const f of files) {
    const p = path.join(dir, f);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, "stub");
  }
}

console.log("resumableOptimiser — partial checkpoint guard");

// 1. THE user bug: class2d it000 optimiser-only → NOT resumable → fresh start
{
  const dir = scratch();
  touch(dir, ["run_it000_optimiser.star"]);
  check(
    "class2d partial it000 (optimiser only) → null",
    resumableOptimiser(dir, "class2d"),
    null
  );
  rmSync(dir, { recursive: true, force: true });
}

// 2. class2d complete it000 → resumable
{
  const dir = scratch();
  touch(dir, [
    "run_it000_optimiser.star",
    "run_it000_data.star",
    "run_it000_model.star",
    "run_it000_sampling.star",
    "run_it000_class001.mrc",
  ]);
  const r = resumableOptimiser(dir, "class2d");
  check("class2d complete it000 → it000", r?.iteration ?? null, 0);
  rmSync(dir, { recursive: true, force: true });
}

// 3. newest partial, older complete → falls back to the older one
{
  const dir = scratch();
  const complete = [
    "run_it002_optimiser.star",
    "run_it002_data.star",
    "run_it002_model.star",
    "run_it002_sampling.star",
    "run_it002_class001.mrc",
  ];
  touch(dir, [
    ...complete,
    "run_it007_optimiser.star", // killed mid-flush of it007
  ]);
  const r = resumableOptimiser(dir, "class2d");
  check("partial it007 over complete it002 → it002", r?.iteration ?? null, 2);
  rmSync(dir, { recursive: true, force: true });
}

// 4. refine3d needs the unfiltered halves
{
  const dir = scratch();
  touch(dir, [
    "run_it005_optimiser.star",
    "run_it005_data.star",
    "run_it005_model.star",
    "run_it005_sampling.star",
    // halves missing → partial
  ]);
  check(
    "refine3d missing half maps → null",
    resumableOptimiser(dir, "refine3d"),
    null
  );
  touch(dir, [
    "run_it005_half1_class001_unfil.mrc",
    "run_it005_half2_class001_unfil.mrc",
  ]);
  const r = resumableOptimiser(dir, "refine3d");
  check("refine3d with halves → it005", r?.iteration ?? null, 5);
  rmSync(dir, { recursive: true, force: true });
}

// 5. refine3d resume must NOT be poisoned by another type's requirement —
//    class2d class image is NOT required for refine3d
{
  const dir = scratch();
  touch(dir, [
    "run_it001_optimiser.star",
    "run_it001_data.star",
    "run_it001_model.star",
    "run_it001_sampling.star",
    "run_it001_half1_class001_unfil.mrc",
    "run_it001_half2_class001_unfil.mrc",
  ]);
  const r = resumableOptimiser(dir, "refine3d");
  check("refine3d full set → it001", r?.iteration ?? null, 1);
  rmSync(dir, { recursive: true, force: true });
}

// 6. initialmodel (star-only set)
{
  const dir = scratch();
  touch(dir, [
    "run_it003_optimiser.star",
    "run_it003_data.star",
    "run_it003_model.star",
    "run_it003_sampling.star",
  ]);
  const r = resumableOptimiser(dir, "initialmodel");
  check("initialmodel stars complete → it003", r?.iteration ?? null, 3);
  rmSync(dir, { recursive: true, force: true });
}

// 7. empty / missing workdir → null (no throw)
{
  const dir = scratch();
  check("empty workdir → null", resumableOptimiser(dir, "class2d"), null);
  rmSync(dir, { recursive: true, force: true });
  check(
    "nonexistent workdir → null",
    resumableOptimiser(path.join(scratch(), "nope"), "refine3d"),
    null
  );
}

// 8. no optimiser at all → null
{
  const dir = scratch();
  touch(dir, ["run_it000_data.star", "run_it000_sampling.star"]);
  check("no optimiser.star → null", resumableOptimiser(dir, "class2d"), null);
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
