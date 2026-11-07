#!/usr/bin/env python3
"""402-recovery — migrate the roster sentinel 23 → 15 across the family.

The accumulated 23-node demo canvas died with the old DB; the healer
(scripts/demo-chain-resurrect.mjs, generalized this window) bootstraps the
15-node tutorial chain from ANY fresh seed. The sentinels promise the
world's CURRENT shape, not a fossil (t313's own doctrine) — so the count
rides again. Only roster-context 23s are touched: a line must contain
"roster" (any case, including roster0/names) AND a standalone 23.
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/z/my-project/scripts")
changed = []
for f in sorted(ROOT.glob("*.mjs")):
    lines = f.read_text(encoding="utf-8").splitlines(keepends=True)
    out = []
    touched = 0
    for line in lines:
        if re.search(r"roster", line, re.I) and re.search(r"(?<![\w.-])23(?![\w.-])", line):
            new = re.sub(r"(?<![\w.-])23(?![\w.-])", "15", line)
            if new != line:
                touched += 1
                line = new
        out.append(line)
    if touched:
        f.write_text("".join(out), encoding="utf-8")
        changed.append((f.name, touched))

for name, n in changed:
    print(f"  {name}: {n} line(s)")
print(f"TOTAL: {len(changed)} files, {sum(n for _, n in changed)} lines migrated")
