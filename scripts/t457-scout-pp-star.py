#!/usr/bin/env python3
"""t457 scout — verify the mock postprocess.star's physics and crossings."""
import sys

STAR = "/home/z/my-project/services/mock-cluster/fs/projects/cryoflow/cmukrk2yy0000rjobryvy0pzu/postprocess_f05kmjc8/postprocess.star"

blocks: dict[str, list[list[float]]] = {}
current = None
with open(STAR) as fh:
    for line in fh:
        t = line.strip()
        if t.startswith("data_"):
            current = t.split()[0]
            blocks[current] = []
            continue
        if current is None or not t or t.startswith(("#", "_", "loop_")):
            continue
        cells = t.split()
        vals = []
        ok = True
        for c in cells:
            try:
                vals.append(float(c))
            except ValueError:
                ok = False
        if ok:
            blocks[current].append(vals)

rows = blocks.get("data_fsc", [])
grows = blocks.get("data_guinier", [])
print(f"blocks: {[(k, len(v), len(v[0]) if v else 0) for k, v in blocks.items()]}")

print(f"shells: {len(rows)}")
if not rows:
    sys.exit("no rows parsed")
last = rows[-1]
print(f"last freq: {last[0]:.6f} -> res {1/last[0]:.3f} A  (2x angpix=3.54 -> Nyquist 7.08 A)")

def crossing(col, th):
    for k in range(1, len(rows)):
        a, b = rows[k - 1], rows[k]
        if a[col] >= th and b[col] < th:
            denom = a[col] - b[col]
            if denom <= 0:
                continue
            t = (a[col] - th) / denom
            f = a[0] + t * (b[0] - a[0])
            return round(1 / f, 3)
    return None

print(f"corrected@0.143 : {crossing(2, 0.143)}")
print(f"unmasked@0.143  : {crossing(3, 0.143)}")
print(f"masked@0.143    : {crossing(4, 0.143)}")
print(f"corrected@0.5   : {crossing(2, 0.5)}")
print(f"unmasked@0.5    : {crossing(3, 0.5)}")
beyond = [r[5] for r in rows if r[0] > 0.095]
print(f"phaseRand max beyond 9.5 A: {max(beyond) if beyond else 'n/a'}")
tail = rows[-3:]
for r in tail:
    print("tail shell:", [round(x, 4) for x in r])
print("reported FinalResolution: 6.514 -> 1/6.514 = %.4f 1/A" % (1 / 6.514))
if grows:
    print(f"guinier shells: {len(grows)}, cols: {len(grows[0])}")
    print("guinier first:", [round(x, 5) for x in grows[0]])
    print("guinier last :", [round(x, 5) for x in grows[-1]])
