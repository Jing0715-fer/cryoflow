#!/usr/bin/env python3
"""t885 local probe — the FOM-threshold face's numbers, verified LOCALLY
before any instrument rides (the t884 lesson: the probe scopes, the
instrument pins).

The design under test (services/mock-cluster/fs/opt/bin/relion_preprocess):
  --minimum_pick_fom filters coords BEFORE the crop (< drops, >= keeps);
  kept rows propagate _rlnAutopickFigureOfMerit into particles.star (#4);
  a filter that refuses every pick is an honest zero (no legacy fallback);
  no threshold + no FOM source = byte-identical to the pre-t885 schema;
  .coord sources (FOM-less) face no filter.

Two parts:
  UNIT — the extract arms run against a HAND-WRITTEN per-mic autopick star
  (coords chosen inside the box-64 safe zone, FOM lanes verbatim), so the
  survival algebra is closed-form and exact. The first cut rode the real
  autopick here and the crop EDGE kept polluting the counts (the detector's
  broad 120-180px window lands picks in the noise plane's edge valleys —
  six re-tunes and a bright rim could not pin every pick inside); the unit
  face does not need the picker at all — extract consumes coords+score,
  wherever they came from.
  LIVE-SCOPE — the real autopick on the 512px sigma-32 blob field (seed
  884, the t884 nine-centers flavor scaled x2), whose numbers Phase C of
  the instrument pins: N=8, 7 box-96-safe, kept-at-0.40 = 4 (general) vs 7
  (trained) — the same coords both lanes, the FOM lane is the only
  difference (t882's law riding into the survival witness).
"""
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RIG = os.path.join(ROOT, "services", "mock-cluster", "fs", "opt", "bin")
sys.path.insert(0, RIG)
os.environ["PATH"] = RIG + os.pathsep + os.environ.get("PATH", "")

import cf_cryo  # noqa: E402
import numpy as np  # noqa: E402

WORK = tempfile.mkdtemp(prefix="t885-probe-")
fails = []


def check(cond, label):
    print(("  ok: " if cond else "  FAIL: ") + label)
    if not cond:
        fails.append(label)


def run(argv):
    return subprocess.run(argv, capture_output=True, text=True,
                          env={**os.environ, "PYTHONPATH": RIG})


# ---- the UNIT mic (the t884-original 256 recipe — pixels to crop, no more) -
NX = NY = 256
BLOBS = [(60, 50), (170, 70), (110, 130), (200, 170), (45, 200),
         (150, 220), (90, 30), (230, 110), (30, 110)]
rng = np.random.default_rng(884)
img = rng.normal(100.0, 14.0, (NY, NX))
yy, xx = np.mgrid[0:NY, 0:NX]
for (cx, cy) in BLOBS:
    r2 = (xx - cx) ** 2 + (yy - cy) ** 2
    img += (-98.0) * np.exp(-r2 / (2 * 16.0 ** 2))
mic_path = os.path.join(WORK, "mic_001.mrc")
cf_cryo.write_mrc(mic_path, NX, NY, 1, img.astype(np.float32), angpix=1.77)

# ---- the HAND-WRITTEN pick stars (coords all box-64 safe, lanes verbatim) --
SAFE_COORDS = [(60, 50), (170, 70), (110, 130), (200, 170), (45, 200)]
assert all(32 <= x < 224 and 32 <= y < 224 for (x, y) in SAFE_COORDS), "unit coords box-64 safe"
GEN_FOMS = ["0.320", "0.370", "0.420", "0.470", "0.520"]
TRN_FOMS = ["0.410", "0.460", "0.510", "0.560", "0.610"]


def write_pick_star(path, foms):
    with open(path, "w") as fh:
        fh.write("data_\n\nloop_\n")
        fh.write("_rlnCoordinateX #1\n_rlnCoordinateY #2\n")
        fh.write("_rlnAutopickFigureOfMerit #3\n_rlnClassNumber #4\n")
        for (x, y), f in zip(SAFE_COORDS, foms):
            fh.write(f"{x}.0\t{y}.0\t{f}\t1\n")


gen_dir = os.path.join(WORK, "gen", "micrographs")
trn_dir = os.path.join(WORK, "trn", "micrographs")
os.makedirs(gen_dir)
os.makedirs(trn_dir)
gen_star = os.path.join(gen_dir, "mic_001_autopick.star")
trn_star = os.path.join(trn_dir, "mic_001_autopick.star")
write_pick_star(gen_star, GEN_FOMS)
write_pick_star(trn_star, TRN_FOMS)

star_in = os.path.join(WORK, "mics.star")
with open(star_in, "w") as fh:
    fh.write("data_\n\nloop_\n_rlnMicrographName\n" + mic_path + "\n")


def extract(coord_dir, out, extra="", suffix="_autopick.star", box=64):
    os.makedirs(out, exist_ok=True)
    argv = [
        os.path.join(RIG, "relion_preprocess"),
        "--i", star_in, "--coord_dir", coord_dir,
        "--coord_suffix", suffix,
        "--part_star", os.path.join(out, "particles.star"),
        "--part_dir", out + "/", "--extract", "--extract_size", str(box),
    ] + (extra.split() if extra else [])
    return run(argv)


def star_rows(out):
    p = os.path.join(out, "particles.star")
    if not os.path.exists(p):
        return None, []
    body, data = open(p).read(), []
    in_part = False
    for line in body.splitlines():
        t = line.strip()
        if t.startswith("data_"):
            in_part = t == "data_particles"
            continue
        if in_part and t and t[0].isdigit():
            data.append(t.split("\t"))
    return body, data


print("== UNIT: the closed-form survival arms ==")
# E1 — general source + threshold 0.40: keeps 0.420/0.470/0.520 (3 of 5)
e1 = extract(os.path.join(WORK, "gen"), os.path.join(WORK, "e1"),
             "--minimum_pick_fom 0.4")
check(e1.returncode == 0, f"E1 exits 0 ({e1.returncode}: {e1.stderr.strip()[:80]})")
b1, d1 = star_rows(os.path.join(WORK, "e1"))
check(len(d1) == 3, f"THE SURVIVAL WITNESS (general): 3 of 5 kept at 0.40 (got {len(d1)})")
check([r[3] for r in d1] == ["0.420", "0.470", "0.520"],
      f"the kept rows are the >= 0.40 lane (got {[r[3] for r in d1]})")
check("_rlnAutopickFigureOfMerit #4" in (b1 or ""),
      "the particles star grows the FOM column (#4)")
check("kept 3 of 5" in e1.stdout, "the per-mic print speaks the kept-of-offered clause")

# E2 — trained source + SAME threshold: 5 of 5
e2 = extract(os.path.join(WORK, "trn"), os.path.join(WORK, "e2"),
             "--minimum_pick_fom 0.4")
_, d2 = star_rows(os.path.join(WORK, "e2"))
check(len(d2) == 5, f"THE SURVIVAL WITNESS (trained): 5 of 5 kept at 0.40 (got {len(d2)})")
check([r[3] for r in d2] == TRN_FOMS,
      f"the trained lane passes whole (got {[r[3] for r in d2]})")
check("kept 5 of 5" in e2.stdout, "the trained arm's clause rides too")

# E3 — the boundary: threshold exactly 0.370 keeps the 0.370 row (>= semantics)
e3 = extract(os.path.join(WORK, "gen"), os.path.join(WORK, "e3"),
             "--minimum_pick_fom 0.37")
_, d3 = star_rows(os.path.join(WORK, "e3"))
check(len(d3) == 4 and d3[0][3] == "0.370",
      f"the boundary is inclusive (>=): 4 kept, first 0.370 (got {len(d3)}, {d3[0][3] if d3 else '-'})")

# E4 — no threshold: all 5 kept, the FOM column still propagates
e4 = extract(os.path.join(WORK, "gen"), os.path.join(WORK, "e4"))
_, d4 = star_rows(os.path.join(WORK, "e4"))
check(len(d4) == 5, f"no threshold keeps all 5 (got {len(d4)})")
check("_rlnAutopickFigureOfMerit #4" in (star_rows(os.path.join(WORK, "e4"))[0] or ""),
      "the FOM propagates WITHOUT a threshold too (real RELION's dialect)")

# E5 — the all-refused threshold: 0 particles, honest zero, NO legacy resurrection
e5 = extract(os.path.join(WORK, "gen"), os.path.join(WORK, "e5"),
             "--minimum_pick_fom 0.99")
_, d5 = star_rows(os.path.join(WORK, "e5"))
check(d5 == [], f"the 0.99 threshold keeps NOTHING (got {len(d5) if d5 else 0})")
check("0 REAL crops" in e5.stdout and "below the FOM threshold" in e5.stdout,
      "the honest-zero line speaks the refusal")
check(not os.path.exists(os.path.join(WORK, "e5", "extra", "mic_001_extract.mrcs")),
      "no legacy stack resurrects invented picks for a mic the real path spoke for")
check("0 particles across 1 micrographs" in e5.stdout,
      "the done line carries the honest zero")

# E6 — .coord source (FOM-less) + threshold: NO filter (nothing to compare)
coord_dir = os.path.join(WORK, "coords")
os.makedirs(coord_dir, exist_ok=True)
with open(os.path.join(coord_dir, "mic_001.coord"), "w") as fh:
    for (x, y) in [(60, 50), (170, 70), (110, 130)]:
        fh.write(f"{x} {y}\n")
e6 = extract(coord_dir, os.path.join(WORK, "e6"), "--minimum_pick_fom 0.4",
             suffix=".coord")
_, d6 = star_rows(os.path.join(WORK, "e6"))
check(len(d6) == 3, f"the .coord source faces no filter (3 kept, got {len(d6)})")
check("_rlnAutopickFigureOfMerit" not in (star_rows(os.path.join(WORK, "e6"))[0] or ""),
      "a FOM-less source writes no FOM column (byte-identical schema)")

print("== LIVE-SCOPE: the real autopick's numbers (what Phase C pins) ==")
# the 512px sigma-32 blob field (t884's seed + nine-centers flavor, scaled x2)
NX2 = NY2 = 512
BLOBS2 = [(120, 100), (340, 140), (220, 260), (400, 340), (90, 400),
          (300, 440), (180, 60), (460, 220), (60, 220)]
rng2 = np.random.default_rng(884)
img2 = rng2.normal(100.0, 14.0, (NY2, NX2))
yy2, xx2 = np.mgrid[0:NY2, 0:NX2]
for (cx, cy) in BLOBS2:
    r2 = (xx2 - cx) ** 2 + (yy2 - cy) ** 2
    img2 += (-98.0) * np.exp(-r2 / (2 * 32.0 ** 2))
mic2 = os.path.join(WORK, "live_001.mrc")
cf_cryo.write_mrc(mic2, NX2, NY2, 1, img2.astype(np.float32), angpix=1.77)
star2 = os.path.join(WORK, "live.star")
with open(star2, "w") as fh:
    fh.write("data_\n\nloop_\n_rlnMicrographName\n" + mic2 + "\n")
with open("/tmp/t885-probe.sav", "wb") as fh:
    fh.write(b"probe-model-bytes")

safe96 = lambda x, y: 48 <= x < 464 and 48 <= y < 464  # noqa: E731
lane_rows = {}
for lane, extra in (("gen", []), ("trn", ["--topaz_model", "/tmp/t885-probe.sav"])):
    od = os.path.join(WORK, "live-" + lane)
    os.makedirs(od, exist_ok=True)
    r = run([os.path.join(RIG, "relion_autopick"), "--i", star2,
             "--pickname", "autopick", "--topaz_extract",
             "--fn_topaz_exe", os.path.join(RIG, "relion_python_topaz"),
             "--particle_diameter", "180", "--odir", od + "/"] + extra)
    check(r.returncode == 0, f"the live-scope {lane} arm exits 0")
    rows = [l.split("\t") for l in
            open(os.path.join(od, "micrographs", "live_001_autopick.star"))
            if l.strip() and l.strip()[0].isdigit()]
    lane_rows[lane] = rows
    N = len(rows)
    check(N == 8, f"the {lane} lane detects N = 8 on the live field (got {N})")
    foms = [float(r0[2]) for r0 in rows]
    want = [0.32 + 0.05 * (k % 5) for k in range(N)] if lane == "gen" else \
           [0.41 + 0.05 * (k % 5) for k in range(N)]
    check(all(abs(a - b) < 1e-9 for a, b in zip(foms, want)),
          f"the {lane} FOM lane rides the formula (got {foms})")
    kept = sum(1 for r0 in rows if float(r0[2]) >= 0.4 and safe96(float(r0[0]), float(r0[1])))
    if lane == "gen":
        check(kept == 4, f"the live-scope general kept-at-0.40 = 4 (got {kept})")
    else:
        check(kept == 7, f"the live-scope trained kept-at-0.40 = 7 (got {kept})")

check([r0[0] for r0 in lane_rows["gen"]] == [r0[0] for r0 in lane_rows["trn"]],
      "both lanes ride the SAME coords (t882's law into the survival witness)")

print()
print("t885-probe: " + ("ALL PASS" if not fails else f"{len(fails)} FAIL"))
sys.exit(0 if not fails else 1)
