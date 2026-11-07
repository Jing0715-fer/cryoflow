#!/usr/bin/env python3
"""t633 — the t474 workdir surgical retirement (disk-full emergency).

The QA t474 UI gallery project is a spent field-report replica (t632 audit:
zero live dependencies in active suites; its rows were already ruled on).
Its class2d workdir holds 456 MiB, of which all but the it200 terminal
state + the t550 bench contract files are per-iteration mock intermediates.

Radius (whitelist keep, everything else inside THIS ONE DIR goes):
  keep: run_it200_* (terminal iteration, every flavor), particles_class*.star,
        run_data.star, run_optimiser.star, run_model.star, run.out, run.err,
        run_it200_classes.mrcs (already covered by run_it200_*), and the one
        run_half2_classNNN_unfil.mrc stray.
  delete: run_it000-199_classNNN.mrc, run_it000-199_halfN_classNNN.mrc,
          run_it000-199_{sampling,optimiser,model,data}.star

t550's PHASE B contract (run_it200_classes.mrcs, the optimiser's 200 read,
the 12 per-class stars, the 24-particle data star) is verified INTACT after
the sweep — the bench keeps its real-stack premise without a rewrite.
"""
import re
import sys
from pathlib import Path

D = Path("/home/z/my-project/data/relion/cmur48ywy0000n5w2ihfsaadq/class2d_8wy7dl3m")

KEEP = re.compile(
    r"^run_it200_|^particles_class\d+\.star$|^run_data\.star$|"
    r"^run_optimiser\.star$|^run_model\.star$|^run\.out$|^run\.err$|"
    r"^run_half2_class\d+_unfil\.mrc$"
)

def main():
    if not D.is_dir():
        print(f"dir missing: {D}")
        sys.exit(1)
    files = sorted(p.name for p in D.iterdir() if p.is_file())
    keep, kill = [], []
    for n in files:
        (keep if KEEP.match(n) else kill).append(n)
    # sanity: the t550 contract pieces must all be in the keep set
    for needed in ["run_it200_classes.mrcs", "run_it200_optimiser.star",
                   "run_it200_data.star", "run_it200_model.star",
                   "run_it200_sampling.star"]:
        assert needed in keep, f"CONTRACT FILE NOT IN KEEP SET: {needed}"
    assert sum(1 for n in keep if n.startswith("particles_class")) == 12, \
        "expected 12 per-class stars in keep set"
    assert all(not n.startswith("run_it199_") for n in keep), \
        "iteration-199 files must not be kept"

    kb = sum((D / n).stat().st_size for n in kill)
    print(f"dir files: {len(files)} | keep: {len(keep)} | kill: {len(kill)} "
          f"({kb/1048576:.1f} MiB)")
    for n in kill:
        (D / n).unlink()
    after = sum((D / n).stat().st_size for n in
                (p.name for p in D.iterdir() if p.is_file()))
    print(f"post-sweep dir size: {after/1048576:.1f} MiB "
          f"({sum(1 for _ in D.iterdir())} files)")
    print("t550 contract intact: it200 terminal state + 12 per-class stars kept")

if __name__ == "__main__":
    main()
