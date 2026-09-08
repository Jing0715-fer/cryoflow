#!/usr/bin/env python3
"""Seed the Topaz-training section's fodder into the QA sandbox refine3d
workdir (Task 53): the Task 52 superset (postprocess.star + iterations +
micrographs_ctf.star + run_data.star) PLUS a topaz_training.txt log the
topaz-training route picks up via its workdir scan (name matches
/training/i + .txt). 30 epochs of a converging run with a deliberate
late overfitting signature: test loss bottoms at epoch ~24 then climbs
while train loss keeps falling.

Deterministic RNG (seed 53) so e2e assertions can hardcode values.

Usage: python3 scripts/qa53-seed-topaz.py [--clean]
  --clean removes the topaz log and delegates to the Task 52 cleaner
  (which covers every earlier seeded artifact).
"""
import math
import os
import random
import sys

WORKDIR = "/home/z/my-project/data/relion/cmtrzp5x80002p8uofb9eu5pp/refine3d_a75rvxycc"
TOPAZ = os.path.join(WORKDIR, "topaz_training.txt")
EPOCHS = 30


def build_topaz() -> str:
    rng = random.Random(53)
    lines = ["epoch,train_loss,test_loss,precision,recall"]
    for e in range(1, EPOCHS + 1):
        # train: exponential decay 2.71 -> ~0.32
        train = 0.32 + 2.39 * math.exp(-0.42 * (e - 1)) + rng.uniform(-0.012, 0.012)
        # test: tracks train until epoch 24, then climbs (overfitting)
        floor = 0.41
        decay = 2.30 * math.exp(-0.46 * (e - 1))
        rise = 0.028 * max(0, e - 24) ** 1.6
        test = floor + decay + rise + rng.uniform(-0.014, 0.014)
        # picker quality climbs toward ~0.87 precision / ~0.84 recall
        prec = 0.87 - 0.46 * math.exp(-0.35 * (e - 1)) + rng.uniform(-0.008, 0.008)
        rec = 0.84 - 0.45 * math.exp(-0.33 * (e - 1)) + rng.uniform(-0.008, 0.008)
        lines.append(
            f"{e},{train:.4f},{test:.4f},{prec:.4f},{rec:.4f}"
        )
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    if "--clean" in sys.argv:
        removed = 0
        if os.path.exists(TOPAZ):
            os.remove(TOPAZ)
            removed += 1
        print(f"qa53 removed {removed} topaz log(s)")
        os.system("python3 /home/z/my-project/scripts/qa52-seed-report.py --clean")
        sys.exit(0)
    os.system("python3 /home/z/my-project/scripts/qa52-seed-report.py")
    os.makedirs(WORKDIR, exist_ok=True)
    with open(TOPAZ, "w") as fh:
        fh.write(build_topaz())
    print(f"qa53 seeded topaz_training.txt ({EPOCHS} epochs, overfit-after-24) into {WORKDIR}")
