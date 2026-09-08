#!/usr/bin/env python3
"""Seed a realistic RELION 5 postprocess.star into the QA sandbox refine3d
workdir so the FSC chart + enriched Markdown report have real-shape data.

Curve model (logistic, anchored to RELION conventions):
  corrected(f)  = 0.97/(1+exp((f-0.28)/0.0226)) + 0.005   → 0.143 at ~3.12 Å
  unmasked(f)   = min(0.99, c*1.04 + 0.01)                 (mask boost)
  masked(f)     = min(0.99, c*1.12 + 0.02)                 (raw, pre-correction)
  phaseRand(f)  = 0.008 + 0.06*f + jitter                  (noise floor)
  reported      = 3.12 Å  (data_general._rlnFinalResolution)
  Nyquist       = 2.857 Å (max freq 0.35 1/Å)

Usage: python3 scripts/qa50-seed-fsc.py [--clean]
  --clean removes the seeded file (post-QA cleanup).
"""
import math
import os
import random
import sys

WORKDIR = "/home/z/my-project/data/relion/cmtrzp5x80002p8uofb9eu5pp/refine3d_a75rvxycc"
TARGET = os.path.join(WORKDIR, "postprocess.star")

F0, F1, N = 0.01, 0.35, 40
NYQ = 1 / F1


def corrected(f: float) -> float:
    return 0.97 / (1.0 + math.exp((f - 0.28) / 0.0226)) + 0.005


def build() -> str:
    rng = random.Random(42)  # deterministic — same seed, same curve
    lines = [
        "data_general",
        "",
        "_rlnOptimisationSetOriginalHalfMap            Import/job004/half1_class001_unfil.mrc",
        "_rlnOptimisationSetOriginalHalfMap2           Import/job004/half2_class001_unfil.mrc",
        "_rlnFinalResolution                           3.120000",
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
        c = corrected(f)
        un = min(0.99, c * 1.04 + 0.01 + rng.uniform(-0.004, 0.004))
        ma = min(0.99, c * 1.12 + 0.02 + rng.uniform(-0.004, 0.004))
        ph = max(0.0, 0.008 + 0.06 * f + rng.uniform(-0.003, 0.003))
        # first shell carries RELION's 999 Å sentinel
        ang = 999.0 if i == 0 else (1.0 / f if f > 0 else 999.0)
        lines.append(
            f"{f:.9f}  {ang:9.6f}  {c:.6f}  {ph:.6f}  {un:.6f}  {ma:.6f}"
        )
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    clean = "--clean" in sys.argv
    if clean:
        if os.path.exists(TARGET):
            os.remove(TARGET)
            print(f"removed {TARGET}")
        else:
            print("nothing to clean")
        sys.exit(0)
    os.makedirs(WORKDIR, exist_ok=True)
    with open(TARGET, "w") as fh:
        fh.write(build())
    print(f"seeded {TARGET} ({N} shells, Nyquist {NYQ:.3f} Å, 0.143 @ ~3.12 Å)")
