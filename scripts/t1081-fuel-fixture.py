#!/usr/bin/env python3
"""t1081 — the interrupt-door walk's FUEL FIXTURE: real EMPIAR-10017 pixels,
cropped at the deposited coord positions into small particle stacks, fed to
the product through its own door (import Node type = particles — a
first-class workflow: "Particles imports an existing particles .star").

The first walk ride learned the lane laws the honest way: the native lane
refuses cluster-absolute rows (the zero-upload semantics speaking), the
edge layer validates port pairings (import's micrographs out-port is not a
particles socket), and the class2d's resolver accepts import as a particles
producer outright (engine.ts:1682) — so the fuel is a REAL particles star
whose rows point at REAL local stacks, and the class2d rides the legal
particles→particles edge. The walk's subject is the INTERRUPT CONTRACT;
the pixels are the honest carriers, cropped from the same Falcon-II
micrographs the t527 identity law verified.
"""
import os
import sys

ROOT = "/home/z/my-project"
sys.path.insert(0, os.path.join(ROOT, "services/mock-cluster/fs/opt/bin"))
import cf_cryo  # noqa: E402

MICS = os.path.join(ROOT, "home-mics-placeholder")  # replaced below
MIC_DIR = "/home/z/empiar-10017/micrographs"
COORD_DIR = os.path.join(ROOT, "services/mock-cluster/fs/data2/empiar-10017/coords")
OUT = "/tmp/t1081-walk-fuel"
STACK_DIR = os.path.join(OUT, "stacks")
BOX = 128
TARGET = 64
PER_MIC = 6


def main() -> None:
    os.makedirs(STACK_DIR, exist_ok=True)
    mics = sorted(f for f in os.listdir(MIC_DIR) if f.endswith(".mrc"))[:3]
    assert mics, "no mics home"
    rows = []
    angpix = 1.77
    for mic in mics:
        stem = mic[: -len(".mrc")]
        coord = os.path.join(COORD_DIR, f"{stem}.coord")
        if not os.path.exists(coord):
            print(f"skip {stem}: no coord file")
            continue
        loaded = cf_cryo.read_mrc(os.path.join(MIC_DIR, mic))
        if not loaded:
            print(f"skip {stem}: unreadable mrc")
            continue
        nx, ny, nz, vals = loaded
        picks = []
        with open(coord) as fh:
            for line in fh:
                parts = line.strip().split()
                if len(parts) >= 2:
                    try:
                        picks.append((float(parts[0]), float(parts[1])))
                    except ValueError:
                        continue
        picks = picks[:PER_MIC]
        boxes = []
        for cx, cy in picks:
            b = cf_cryo.crop_box(vals, nx, ny, cx, cy, BOX)
            b = cf_cryo.downsample_box(b, TARGET)
            b = cf_cryo.normalize_box(b, int(TARGET * 0.35))
            boxes.append(b)
        if not boxes:
            print(f"skip {stem}: no picks")
            continue
        stack = os.path.join(STACK_DIR, f"{stem}.mrcs")
        import numpy as np
        flat = np.concatenate([np.asarray(b, dtype=np.float32).ravel() for b in boxes]).tolist()
        cf_cryo.write_mrc(stack, TARGET, TARGET, len(boxes), flat, angpix=angpix)
        for i in range(len(boxes)):
            rows.append(f"{i + 1:06d}@{stack}")
        print(f"stacked {stem}: {len(boxes)} particles @ {stack}")
    star = os.path.join(OUT, "particles.star")
    with open(star, "w") as fh:
        fh.write("data_particles\n\nloop_\n_rlnImageName #1\n_rlnOpticsGroup #2\n")
        for r in rows:
            fh.write(f"{r}\t1\n")
    print(f"star: {star} ({len(rows)} rows)")
    assert len(rows) >= 12, "the fuel is too thin for a class2d"


if __name__ == "__main__":
    main()
