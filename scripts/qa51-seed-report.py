#!/usr/bin/env python3
"""Seed full report-fodder into the QA sandbox refine3d workdir (Task 51):
postprocess.star WITH a data_guinier loop + B-factor, and a family of
run_itXXX_half1_model.star files carrying per-iteration resolution —
so the enriched Markdown report exercises all three snapshot sections
(resolution progress / FSC / Guinier).

Extends the Task 50 seed (which only wrote the data_fsc loop):
  data_general : + _rlnBfactorUsedForSharpening = -52.4
  data_guinier : 36 shells, 1/d² 0.001→0.120, ln-amp original declining,
                 sharpened curve tilted up (classic B-weighting look)
  run_it{2,5,8,12,16,20,24,30}_half1_model.star : _rlnCurrentResolution
                 28.50 → 3.18 Å (current = last, best = last here)

Usage: python3 scripts/qa51-seed-report.py [--clean]
  --clean removes every file this seeder wrote (postprocess.star included).
"""
import math
import os
import random
import shutil
import sys

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa_lib import resolve_project, resolve_refine_host

_PROJECT = resolve_project()
_REFINE_JOB, WORKDIR = resolve_refine_host(_PROJECT)
PROJECT = _PROJECT
PP = os.path.join(WORKDIR, "postprocess.star")

F0, F1, N = 0.01, 0.35, 40          # FSC shells (same as Task 50 seed)
G0, G1, GN = 0.001, 0.120, 36       # guinier 1/d² span
ITERS = [(2, 28.50), (5, 12.00), (8, 7.20), (12, 5.40),
         (16, 4.40), (20, 3.90), (24, 3.52), (30, 3.18)]


def fsc_curve(f: float) -> float:
    return 0.97 / (1.0 + math.exp((f - 0.28) / 0.0226)) + 0.005


def build_postprocess() -> str:
    rng = random.Random(42)
    lines = [
        "data_general",
        "",
        "_rlnOptimisationSetOriginalHalfMap            Import/job004/half1_class001_unfil.mrc",
        "_rlnOptimisationSetOriginalHalfMap2           Import/job004/half2_class001_unfil.mrc",
        "_rlnFinalResolution                           3.120000",
        "_rlnBfactorUsedForSharpening                  -52.400000",
        "_rlnUnfilteredMapHalf1                        postprocess_it020_half1_class001.mrc",
        "_rlnMaskName                                  mask_create/mask.mrc",
        "",
        "data_fsc",
        "",
        "loop_",
        "_rlnResolution #1",
        "_rlnAngstromResolution #2",
        "_rlnFourierShellCorrelationCorrected #3",
        "_rlnCorrectedFourierShellCorrelationPhaseRandomizedMaskedMaps #4",
        "_rlnFourierShellCorrelationUnmaskedMaps #5",
        "_rlnFourierShellCorrelationMaskedMaps #6",
    ]
    for i in range(N):
        f = F0 + (F1 - F0) * i / (N - 1)
        c = fsc_curve(f)
        un = min(0.99, c * 1.04 + 0.01 + rng.uniform(-0.004, 0.004))
        ma = min(0.99, c * 1.12 + 0.02 + rng.uniform(-0.004, 0.004))
        ph = max(0.0, 0.008 + 0.06 * f + rng.uniform(-0.003, 0.003))
        ang = 999.0 if i == 0 else (1.0 / f if f > 0 else 999.0)
        lines.append(f"{f:.9f}  {ang:9.6f}  {c:.6f}  {ph:.6f}  {un:.6f}  {ma:.6f}")
    lines += [
        "",
        "data_guinier",
        "",
        "loop_",
        "_rlnResolutionSquared #1",
        "_rlnLogAmplitudesOriginal #2",
        "_rlnInterceptResidual #3",
        "_rlnLogAmplitudesSharpened #4",
        "_rlnLogAmplitudesWeighted #5",
    ]
    for i in range(GN):
        x = G0 + (G1 - G0) * i / (GN - 1)
        orig = 2.20 - 2.80 * x + rng.uniform(-0.01, 0.01)          # gentle falloff
        intercept = 2.20 - 0.35 * x
        sharp = orig + 0.50 + 12.0 * x                              # B-weight tilt
        weighted = (orig + sharp) / 2.0
        lines.append(f"{x:.7f}  {orig:.6f}  {intercept:.6f}  {sharp:.6f}  {weighted:.6f}")
    return "\n".join(lines) + "\n"


def build_iteration(res: float) -> str:
    return (
        "data_model_general\n"
        "\n"
        f"_rlnCurrentResolution   {res:.6f}\n"
        "_rlnSolventMaskFSCVolumeFraction   0.212000\n"
        "\n"
    )


if __name__ == "__main__":
    clean = "--clean" in sys.argv
    if clean:
        n = 0
        if os.path.exists(PP):
            os.remove(PP)
            n += 1
        for it, _ in ITERS:
            p = os.path.join(WORKDIR, f"run_it{it:03d}_half1_model.star")
            if os.path.exists(p):
                os.remove(p)
                n += 1
        print(f"cleaned {n} seeded file(s) from {WORKDIR}")
        sys.exit(0)
    os.makedirs(WORKDIR, exist_ok=True)
    with open(PP, "w") as fh:
        fh.write(build_postprocess())
    for it, res in ITERS:
        with open(os.path.join(WORKDIR, f"run_it{it:03d}_half1_model.star"), "w") as fh:
            fh.write(build_iteration(res))
    print(f"seeded postprocess.star (fsc {N} shells + guinier {GN} pts, B=-52.4) "
          f"+ {len(ITERS)} iteration files (current 3.18 Å) into {WORKDIR}")
