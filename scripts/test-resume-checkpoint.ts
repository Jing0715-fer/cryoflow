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
 * The fix: only iterations whose FULL companion set (the files RELION's
 * --continue actually READS BACK) exists on disk are resumable, scanning
 * newest → oldest; no complete iteration → fresh start.
 *
 * t395 — the fixtures speak REAL RELION 5 naming, verified against the
 * source (ml_model.cpp / ml_optimiser.cpp):
 *   · class2d keeps ALL class averages in ONE stack run_itNNN_classes.mrcs
 *     (a per-class run_itNNN_class001.mrc does NOT exist in the 2D world —
 *     the t394 law demanded it and every class2d round was judged
 *     incomplete: the local auto-resume silently never resumed class2d);
 *   · VDAM (--grad) adds the moment stacks _1moment.mrcs / _2moment.mrcs;
 *   · gold-standard (refine3d/multibody) writes HALF model stars
 *     run_itNNN_half{1,2}_model.star and the FILTERED half refs
 *     run_itNNN_half{1,2}_class001.mrc (multibody: _body001) — the _unfil
 *     halves are never reloaded by --continue;
 *   · initialmodel (3D grad) reloads run_itNNN_class001.mrc + the 3D
 *     moment maps _1moment001.mrc / _2moment001.mrc.
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

console.log("resumableOptimiser — partial checkpoint guard (t395 real naming)");

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

// 2. class2d complete it000 (EM: the classes STACK) → resumable
{
  const dir = scratch();
  touch(dir, [
    "run_it000_optimiser.star",
    "run_it000_data.star",
    "run_it000_model.star",
    "run_it000_sampling.star",
    "run_it000_classes.mrcs",
  ]);
  const r = resumableOptimiser(dir, "class2d");
  check("class2d complete it000 (classes.mrcs stack) → it000", r?.iteration ?? null, 0);
  rmSync(dir, { recursive: true, force: true });
}

// 2b. THE t394 BUG, reversed: the per-class file the old law demanded does
//     not exist in a 2D workdir — the stack is the law now
{
  const dir = scratch();
  touch(dir, [
    "run_it000_optimiser.star",
    "run_it000_data.star",
    "run_it000_model.star",
    "run_it000_sampling.star",
    // no classes.mrcs — a torn flush → NOT resumable
  ]);
  check(
    "class2d without the classes stack → null (the t394 law's class001.mrc was a 2D-void filename)",
    resumableOptimiser(dir, "class2d"),
    null
  );
  rmSync(dir, { recursive: true, force: true });
}

// 2c. VDAM class2d: the moment stacks join the reload set
{
  const dir = scratch();
  const base = [
    "run_it010_optimiser.star",
    "run_it010_data.star",
    "run_it010_model.star",
    "run_it010_sampling.star",
    "run_it010_classes.mrcs",
  ];
  touch(dir, base);
  touch(dir, ["run_it010_1moment.mrcs"]); // 2moment died mid-flush
  check("VDAM class2d missing _2moment → null", resumableOptimiser(dir, "class2d"), null);
  touch(dir, ["run_it010_2moment.mrcs"]);
  const r = resumableOptimiser(dir, "class2d");
  check("VDAM class2d with both moments → it010", r?.iteration ?? null, 10);
  rmSync(dir, { recursive: true, force: true });
}

// 3. newest partial, older complete → falls back to the older one
{
  const dir = scratch();
  touch(dir, [
    "run_it002_optimiser.star",
    "run_it002_data.star",
    "run_it002_model.star",
    "run_it002_sampling.star",
    "run_it002_classes.mrcs",
    "run_it007_optimiser.star", // killed mid-flush of it007
  ]);
  const r = resumableOptimiser(dir, "class2d");
  check("partial it007 over complete it002 → it002", r?.iteration ?? null, 2);
  rmSync(dir, { recursive: true, force: true });
}

// 4. refine3d GOLD: the half model stars + the FILTERED half refs
{
  const dir = scratch();
  touch(dir, [
    "run_it005_optimiser.star",
    "run_it005_data.star",
    "run_it005_sampling.star",
    // the half model stars are missing → partial
  ]);
  check(
    "refine3d gold missing the half model stars → null",
    resumableOptimiser(dir, "refine3d"),
    null
  );
  touch(dir, [
    "run_it005_half1_model.star",
    "run_it005_half2_model.star",
    "run_it005_half1_class001.mrc",
    "run_it005_half2_class001.mrc",
  ]);
  const r = resumableOptimiser(dir, "refine3d");
  check("refine3d gold with both half model stars + half refs → it005", r?.iteration ?? null, 5);
  rmSync(dir, { recursive: true, force: true });
}

// 4b. the t394 witness (the _unfil halves) is NOT the reload set: a round
//     with the _unfil halves but NO half model star is NOT resumable
{
  const dir = scratch();
  touch(dir, [
    "run_it005_optimiser.star",
    "run_it005_data.star",
    "run_it005_sampling.star",
    "run_it005_half1_class001_unfil.mrc",
    "run_it005_half2_class001_unfil.mrc",
  ]);
  check(
    "refine3d with only the _unfil halves (never reloaded by --continue) → null",
    resumableOptimiser(dir, "refine3d"),
    null
  );
  rmSync(dir, { recursive: true, force: true });
}

// 4c. refine3d PLAIN (K>1 classic / join-phase iteration): model.star + class001.mrc
{
  const dir = scratch();
  touch(dir, [
    "run_it004_optimiser.star",
    "run_it004_data.star",
    "run_it004_model.star",
    "run_it004_sampling.star",
    "run_it004_class001.mrc",
  ]);
  const r = resumableOptimiser(dir, "refine3d");
  check("refine3d plain (join-phase) full set → it004", r?.iteration ?? null, 4);
  rmSync(dir, { recursive: true, force: true });
}

// 4d. class3d (3D, K classes, never gold): model.star + class001.mrc
{
  const dir = scratch();
  touch(dir, [
    "run_it006_optimiser.star",
    "run_it006_data.star",
    "run_it006_model.star",
    "run_it006_sampling.star",
    "run_it006_class001.mrc",
    "run_it006_class004.mrc",
  ]);
  const r = resumableOptimiser(dir, "class3d");
  check("class3d with the per-class refs → it006", r?.iteration ?? null, 6);
  rmSync(dir, { recursive: true, force: true });
}

// 4e. multibody GOLD: per-BODY half refs
{
  const dir = scratch();
  touch(dir, [
    "run_it008_optimiser.star",
    "run_it008_data.star",
    "run_it008_sampling.star",
    "run_it008_half1_model.star",
    "run_it008_half2_model.star",
    "run_it008_half1_body001.mrc",
    "run_it008_half2_body001.mrc",
  ]);
  const r = resumableOptimiser(dir, "multibody");
  check("multibody gold with the half BODY refs → it008", r?.iteration ?? null, 8);
  rmSync(dir, { recursive: true, force: true });
}

// 5. initialmodel (3D grad): the class ref + the 3D moment maps
{
  const dir = scratch();
  touch(dir, [
    "run_it003_optimiser.star",
    "run_it003_data.star",
    "run_it003_model.star",
    "run_it003_sampling.star",
    // the t394 law said star-only; the class001.mrc IS reloaded → null
  ]);
  check(
    "initialmodel without the class ref → null (the t394 star-only law offered a crash)",
    resumableOptimiser(dir, "initialmodel"),
    null
  );
  touch(dir, [
    "run_it003_class001.mrc",
    "run_it003_1moment001.mrc",
    "run_it003_2moment001.mrc",
  ]);
  const r = resumableOptimiser(dir, "initialmodel");
  check("initialmodel with the class ref + moments → it003", r?.iteration ?? null, 3);
  rmSync(dir, { recursive: true, force: true });
}

// 6. empty / missing workdir → null (no throw)
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

// 7. no optimiser at all → null
{
  const dir = scratch();
  touch(dir, ["run_it000_data.star", "run_it000_sampling.star", "run_it000_classes.mrcs"]);
  check("no optimiser.star → null", resumableOptimiser(dir, "class2d"), null);
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
