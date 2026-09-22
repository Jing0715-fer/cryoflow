#!/usr/bin/env python3
"""Seed full report-fodder into the QA sandbox refine3d workdir (Task 52):
the Task 51 superset (postprocess.star with fsc+guinier+B-factor, the
run_itXXX_half1_model.star family) PLUS the two phase-3 sources:

  micrographs_ctf.star : data_optics loop (parser must NOT leak its row)
                         + data_micrographs loop with 48 micrographs —
                         defocus U/V in Ångström (route converts to µm),
                         FOM spread across the app's three health buckets,
                         6 astigmatism outliers for the dot-size encoding
  run_data.star        : 900 particles, 65% concentrated in two lobes
                         (rot 15-85°/195-265° × tilt 25-60°), 10% in a
                         third lobe, 25% uniform → anisotropy ≈ ×9-10,
                         safely above the >6 anisotropic verdict threshold

Deterministic RNG (seeds 42/52) so e2e assertions can hardcode values.

Usage: python3 scripts/qa52-seed-report.py [--clean]
  --clean removes every file this seeder wrote (also covers the Task 50/51
  artifacts, so phase B's honest-gap run is fully isolated).
"""
import math
import os
import random
import sys

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa_lib import resolve_project, resolve_refine_host

_PROJECT = resolve_project()
_REFINE_JOB, WORKDIR = resolve_refine_host(_PROJECT)
PROJECT = _PROJECT
PP = os.path.join(WORKDIR, "postprocess.star")
CTF = os.path.join(WORKDIR, "micrographs_ctf.star")
DATA = os.path.join(WORKDIR, "run_data.star")

F0, F1, N = 0.01, 0.35, 40          # FSC shells (same as Task 50 seed)
G0, G1, GN = 0.001, 0.120, 36       # guinier 1/d² span
ITERS = [(2, 28.50), (5, 12.00), (8, 7.20), (12, 5.40),
         (16, 4.40), (20, 3.90), (24, 3.52), (30, 3.18)]
NMIC = 48                            # micrographs in micrographs_ctf.star
NPART = 900                          # particles in run_data.star


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


def build_ctf() -> str:
    """RELION-5 style micrographs_ctf.star. The optics loop deliberately
    shares the file — the route's block-aware parser must freeze its column
    map per loop so the optics row never leaks into the micrograph table."""
    rng = random.Random(52)
    lines = [
        "data_optics",
        "",
        "loop_",
        "_rlnOpticsGroupNumber #1",
        "_rlnVoltage #2",
        "_rlnSphericalAberration #3",
        "_rlnAmplitudeContrast #4",
        "_rlnOpticsGroupName #5",
        "1  300.000000  2.700000  0.100000  opticsGroup1",
        "",
        "data_micrographs",
        "",
        "loop_",
        "_rlnMicrographName #1",
        "_rlnMicrographMetadata #2",
        "_rlnDefocusU #3",
        "_rlnDefocusV #4",
        "_rlnDefocusAngle #5",
        "_rlnCtfAstigmatism #6",
        "_rlnCtfFigureOfMerit #7",
        "_rlnCtfMaxResolution #8",
    ]
    for i in range(NMIC):
        name = f"MotionCorr/job002/mic_{i + 1:04d}.mrc"
        u = rng.uniform(12000, 21000)                     # Å — route → µm
        if i % 8 == 5:                                    # 6 astig outliers
            astig = rng.uniform(1200, 2500)
        else:
            astig = rng.uniform(100, 600)
        v = u + astig
        angle = rng.uniform(0, 180)
        bucket = i % 8
        if bucket in (0, 4):                              # healthy greens
            fom = rng.uniform(0.10, 0.28)
        elif bucket in (1, 2, 6):                         # ambers
            fom = rng.uniform(0.050, 0.099)
        else:                                             # roses
            fom = rng.uniform(0.02, 0.049)
        maxres = 3.4 + (0.28 - fom) * 40.0 + rng.uniform(-0.4, 0.4)
        lines.append(
            f"{name}  ctf_{i + 1:04d}.mrc  {u:.3f}  {v:.3f}  {angle:.3f}  "
            f"{astig:.3f}  {fom:.6f}  {maxres:.3f}"
        )
    return "\n".join(lines) + "\n"


def build_run_data() -> str:
    """Final data star: 900 particles, bimodal orientation distribution.
    Lobes land in few (rot, tilt) cells so max/mean-over-occupied clearly
    exceeds the ×6 anisotropy threshold regardless of uniform jitter."""
    rng = random.Random(52)
    lines = [
        "data_particles",
        "",
        "loop_",
        "_rlnImageName #1",
        "_rlnMicrographName #2",
        "_rlnDefocusU #3",
        "_rlnDefocusV #4",
        "_rlnAngleRot #5",
        "_rlnAngleTilt #6",
        "_rlnAnglePsi #7",
        "_rlnClassNumber #8",
        "_rlnLogLikeliContribution #9",
        "_rlnNormCorrection #10",
        "_rlnMaxValueProbDistribution #11",
    ]
    for i in range(NPART):
        roll = i / NPART
        if roll < 0.325:                                  # lobe A
            rot, tilt = rng.uniform(15, 85), rng.uniform(25, 60)
        elif roll < 0.65:                                 # lobe B
            rot, tilt = rng.uniform(195, 265), rng.uniform(25, 60)
        elif roll < 0.75:                                 # small lobe C
            rot, tilt = rng.uniform(300, 345), rng.uniform(120, 150)
        else:                                             # uniform background
            rot, tilt = rng.uniform(0, 360), rng.uniform(0, 180)
        psi = rng.uniform(0, 360)
        u = rng.uniform(12000, 21000)
        v = u + rng.uniform(100, 800)
        lines.append(
            f"{i + 1:06d}@particles.mrcs  mic_{(i % NMIC) + 1:04d}.mrc  "
            f"{u:.3f}  {v:.3f}  {rot:.3f}  {tilt:.3f}  {psi:.3f}  1  "
            f"{rng.uniform(0.5, 2.0):.6f}  {rng.uniform(0.9, 1.1):.6f}  "
            f"{rng.uniform(0.2, 0.9):.6f}"
        )
    return "\n".join(lines) + "\n"


SEEDED = [PP, CTF, DATA] + [
    os.path.join(WORKDIR, f"run_it{it:03d}_half1_model.star") for it, _ in ITERS
]


if __name__ == "__main__":
    if "--clean" in sys.argv:
        n = 0
        for p in SEEDED:
            if os.path.exists(p):
                os.remove(p)
                n += 1
        print(f"cleaned {n} seeded file(s) from {WORKDIR}")
        sys.exit(0)
    os.makedirs(WORKDIR, exist_ok=True)
    with open(PP, "w") as fh:
        fh.write(build_postprocess())
    with open(CTF, "w") as fh:
        fh.write(build_ctf())
    with open(DATA, "w") as fh:
        fh.write(build_run_data())
    for it, res in ITERS:
        with open(os.path.join(WORKDIR, f"run_it{it:03d}_half1_model.star"), "w") as fh:
            fh.write(build_iteration(res))
    print(f"seeded postprocess.star (fsc {N} + guinier {GN}, B=-52.4) + "
          f"micrographs_ctf.star ({NMIC} mics, FOM 3-bucket) + run_data.star "
          f"({NPART} particles, bimodal) + {len(ITERS)} iteration files into {WORKDIR}")
