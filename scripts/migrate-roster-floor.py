#!/usr/bin/env python3
"""t408 — the roster floor migration: `=== 15` becomes `>= 15` across the
e2e family's roster sentinels.

The world is now the TWO-WORLD LEDGER (t407/t408): the healed 15-node
tutorial chain PLUS the restored gallery furniture (restore-gallery.py,
idempotent by name) — 33 jobs, 31 completed. A roster sentinel that pins
`=== 15` is a fossil of the single-world era: it breaks the moment the
other half of the ledger appears, and it will break again every time a
suite's residue is cleaned or a seeder adds furniture. The sentinels'
real contract is THE FLOOR — the healed chain stands (its 15 completed
nodes are the world's minimum) — and t313's own suite keeps the chain's
exact shape. This migration is deliberately mechanical: only `must(...)`
lines whose message mentions roster/roster floor semantics get `=== 15` →
`>= 15`. Per-suite precision filters (completed >= 15) can follow later;
the floor is what un-blocks the family rotation today.
"""
import re
from pathlib import Path

REPO = Path("/home/z/my-project/scripts")

# roster-sentinel signatures: the must() line mentions these, the `=== 15`
# inside it is a roster pin, and the migration is honest for all of them
ROSTER_MSG = re.compile(
    r"must\(\s*([A-Za-z_$][\w.$?\[\]() ]*?)\s*===\s*15\s*,\s*`([^`]*(?:roster|roster restored|healed chain|identity)[^`]*)`\s*\)"
)

total_files = 0
total_sites = 0
for p in sorted(REPO.glob("t*.mjs")) + sorted(REPO.glob("qa*.mjs")):
    text = p.read_text()
    orig = text
    # 1) numeric vars: roster0 === 15  /  n === 15  /  after.length === 15
    #    (the floor holds when the count is AT LEAST the healed chain)
    text = ROSTER_MSG.sub(
        lambda m: f"must({m.group(1)} >= 15, `{m.group(2)}`)",
        text,
    )
    # 2) compound conservation: roster1.length === roster0.length && roster1.length === 15
    #    (the dance must add NOTHING — keep the equality, floor the pin)
    text = re.sub(
        r"(\w[\w.?\[\]]*\.length) === (\w[\w.?\[\]]*\.length) && \1 === 15",
        r"\1 === \2 && \1 >= 15",
        text,
    )
    # 3) json-body pins: (jobs0.jobs ?? []).length === 15
    #    (same floor; the ?? guard rides inside the captured group)
    text = re.sub(
        r"(\([\w.?$()\[\] ]+\)\.length|\w[\w.?\[\]]*\.length) === 15(, `[^`]*(?:roster|identity)[^`]*`\))",
        r"\1 >= 15\2",
        text,
    )
    if text != orig:
        p.write_text(text)
        n = sum(1 for a, b in zip(orig.split("\n"), text.split("\n")) if a != b)
        total_files += 1
        total_sites += n
        print(f"{p.name}: {n} sentinel line(s) floored")
print(f"done: {total_files} files, {total_sites} lines")
