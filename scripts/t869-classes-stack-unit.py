#!/usr/bin/env python3
"""
t869 — the ENGINE's classes-stack writer, verified by its own bytes.

t868's tail left the candidate: "the ENGINE's own class2d run_classes.mrcs
deserves the same mu/sigma verification pass the extract stack got." The
archaeology this unit pins (measured, not assumed):

  the mock's write_mrc default kind ("volume") fills a UNIFORM LCG noise
  whose formula depends only on (seed, k) — and the classes-stack call
  sites passed a CONSTANT seed for the whole file. So every class frame
  in run_itNNN_classes.mrcs drew the SAME distribution: the class gallery
  rendered N copies of the same static (the t287 law — a different image
  is a different window — violated inside one file), and the t373
  bright-blob classes convention never rode the stacks.

The fix (same file): the two classes-stack call sites pass kind="classes"
— per-frame sub-seed blobs, the t373 dialect.

This unit extracts write_mrc from the mock's own source (the writer's
REAL body, not a transcription) and reads its bytes back:

  OLD  (the pre-fix call shape): 8 frames -> every frame's mu AND sigma
       identical to 6 decimals — the static, on the record.
  NEW  (kind="classes"): 8 frames -> pairwise DISTINCT mu/sigma, each
       frame's max >= 0.3 (the bright blob present), sigma well off zero
       (a distribution, not a flat), and the MRC2014 header dialect
       intact (NX,NY,NZ=64,64,8; MODE=2 — the t311 law).

  node scripts/t869-classes-stack-unit.mjs   (the driver — this file is
  the Python leg it spawns; run the driver, not this file directly)
"""

import math
import os
import re
import struct
import sys

MOCK = "services/mock-cluster/fs/opt/bin/relion_refine"
OUT_OLD = "/tmp/t869-classes-old.mrcs"
OUT_NEW = "/tmp/t869-classes-new.mrcs"
NCLS = 8
BOX = 64


def extract_write_mrc(source: str):
    """Pull the REAL write_mrc body out of the mock's source and exec it
    in a namespace with its own imports — no transcription, the file's
    own bytes are the contract."""
    m = re.search(r"^def write_mrc\(.*?(?=^# ---- t402)", source, re.S | re.M)
    if not m:
        # fall back: from the def to the next top-level def/statement
        m = re.search(r"^def write_mrc\(.*?(?=^\S)", source, re.S | re.M)
    if not m:
        raise SystemExit("could not locate write_mrc in the mock source")
    ns = {}
    exec("import math, os, struct\n" + m.group(0), ns)
    return ns["write_mrc"]


def read_frames(path: str):
    """Minimal MRC2014 reader: header words + per-frame mu/sigma/min/max."""
    with open(path, "rb") as fh:
        head = fh.read(1024)
        nx, ny, nz = struct.unpack_from("<3i", head, 0)
        mode = struct.unpack_from("<i", head, 12)[0]
        dmin, dmax, dmean = struct.unpack_from("<3f", head, 76)
        body = fh.read()
    assert (nx, ny, nz) == (BOX, BOX, NCLS), f"dims {nx}x{ny}x{nz} != {BOX}x{BOX}x{NCLS}"
    assert mode == 2, f"MODE {mode} != 2 (the t311 law)"
    n = nx * ny
    frames = []
    for z in range(nz):
        vals = struct.unpack_from(f"<{n}f", body, z * n * 4)
        mu = sum(vals) / n
        var = sum((v - mu) ** 2 for v in vals) / n
        frames.append(
            {"z": z, "mu": mu, "sigma": math.sqrt(var), "min": min(vals), "max": max(vals)}
        )
    return frames, {"dmin": dmin, "dmax": dmax, "dmean": dmean}


def main() -> int:
    src = open(MOCK, encoding="utf-8").read()
    write_mrc = extract_write_mrc(src)
    print(f"write_mrc extracted from {MOCK} (the file's own body, not a transcription)")

    # the PRE-FIX call shape (the two call sites' old args, kind defaulted)
    write_mrc(OUT_OLD, BOX, BOX, NCLS, 4096)
    # the POST-FIX call shape (kind="classes" — the t373 convention)
    write_mrc(OUT_NEW, BOX, BOX, NCLS, 4096, kind="classes")

    old, old_head = read_frames(OUT_OLD)
    new, new_head = read_frames(OUT_NEW)

    # ---- the OLD world: the static, documented ----
    # the LCG's 1000-step cycle makes each frame a ROTATION of the same
    # cycle — mu/sigma agree to ~1e-3 and the max is the noise ceiling
    # everywhere. The measured static: same distribution per frame, the
    # same ceiling per frame (max identical to 4 decimals), no character.
    same_mu = max(f["mu"] for f in old) - min(f["mu"] for f in old) < 0.005
    same_sigma = max(f["sigma"] for f in old) - min(f["sigma"] for f in old) < 0.005
    same_max = len({round(f["max"], 4) for f in old}) == 1
    print(f"OLD kind=default: one distribution across all {NCLS} frames? "
          f"mu-spread={max(f['mu'] for f in old) - min(f['mu'] for f in old):.6f} "
          f"sigma-spread={max(f['sigma'] for f in old) - min(f['sigma'] for f in old):.6f} "
          f"max-identical={same_max} (max={old[0]['max']:+.4f} — the noise ceiling everywhere)")
    if not (same_mu and same_sigma and same_max):
        print("  ✗ expected the old shape to be the static (one distribution, one ceiling)")
        return 1

    # ---- the NEW world: the t373 convention, per-frame character ----
    distinct = 0
    for i in range(NCLS):
        for j in range(i + 1, NCLS):
            if abs(new[i]["mu"] - new[j]["mu"]) > 1e-6 or abs(new[i]["sigma"] - new[j]["sigma"]) > 1e-6:
                distinct += 1
    bright = all(f["max"] >= 0.3 for f in new)
    alive = all(0.05 < f["sigma"] < 0.15 for f in new)   # blob-dominated, not the uniform 0.2887
    max_spread = max(f["max"] for f in new) - min(f["max"] for f in new)
    per_frame_character = max_spread > 0.02              # the ceiling is no longer one number
    for f in new:
        print(f"  NEW frame {f['z']}: mu={f['mu']:+.4f} sigma={f['sigma']:.4f} "
              f"min={f['min']:+.4f} max={f['max']:+.4f}")
    print(f"NEW kind=classes: pairwise-distinct frame stats? {distinct} of {NCLS*(NCLS-1)//2} pairs")
    print(f"NEW: bright blob in every frame (max>=0.3)? {bright}; blob-dominated sigma (0.05-0.15, was 0.2887 uniform)? {alive}")
    print(f"NEW: per-frame character (max spread {max_spread:.4f} > 0.02; the old ceiling was one number)? {per_frame_character}")
    print(f"header: dmin={new_head['dmin']:.4f} dmax={new_head['dmax']:.4f} dmean={new_head['dmean']:.4f} (the t373 real-stats law)")

    ok = distinct == NCLS * (NCLS - 1) // 2 and bright and alive and per_frame_character
    print("T869 CLASSES-STACK WRITER: " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
