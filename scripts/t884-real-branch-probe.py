#!/usr/bin/env python3
"""t884 exploratory probe: the REAL-detection branch under the pick delta.

Writes one synthetic blob-field mic (256x256, dark Gaussians on noise ice),
runs the rig's autopick on it twice (GENERAL vs TRAINED lane), and prints
the per-mic counts + first-row FOMs. The t884 law: SAME count (a model does
not invent blobs it cannot see), the FOM lane shifts 0.32 -> 0.41.
"""
import json
import subprocess
import sys
import os

RIG = "/home/z/my-project/services/mock-cluster/fs/opt/bin"
sys.path.insert(0, RIG)
import cf_cryo  # noqa: E402

import numpy as np  # noqa: E402

NX = NY = 256
rng = np.random.default_rng(884)
img = rng.normal(100.0, 14.0, (NY, NX))  # ice noise
# nine dark Gaussian blobs, deterministic centers, depth ~7 sigma
centers = [(60, 50), (170, 70), (110, 130), (200, 170), (45, 200), (150, 220), (90, 30), (230, 110), (30, 110)]
for (cx, cy) in centers:
    yy, xx = np.mgrid[0:NY, 0:NX]
    r2 = (xx - cx) ** 2 + (yy - cy) ** 2
    img += (-98.0) * np.exp(-r2 / (2 * 16.0 ** 2))  # ~-7 sigma at core
mic = "/tmp/t884-real.mrc"
cf_cryo.write_mrc(mic, NX, NY, 1, img.astype(np.float32), angpix=1.77)

star = "/tmp/t884-real.star"
with open(star, "w") as fh:
    fh.write("data_\n\nloop_\n_rlnMicrographName\n" + mic + "\n")

base_argv = [
    sys.executable, os.path.join(RIG, "relion_autopick"),
    "--i", star, "--pickname", "autopick", "--topaz_extract",
    "--fn_topaz_exe", "/opt/bin/relion_python_topaz", "--particle_diameter", "180",
]
out = {}
for lane, extra in (("gen", []), ("trn", ["--topaz_model", "/tmp/t884.sav"])):
    odir = f"/tmp/t884-real-{lane}/"
    r = subprocess.run(base_argv + ["--odir", odir] + extra, capture_output=True, text=True)
    starf = os.path.join(odir, "micrographs", "t884-real_autopick.star")
    rows = [l.split("\t") for l in open(starf) if l[:1].isdigit()]
    out[lane] = {
        "code": r.returncode,
        "n_rows": len(rows),
        "fom0": rows[0][2] if rows else None,
        "line": [l for l in r.stdout.splitlines() if "REAL dark-blob" in l or "particles picked" in l],
    }
print(json.dumps(out, indent=1))
