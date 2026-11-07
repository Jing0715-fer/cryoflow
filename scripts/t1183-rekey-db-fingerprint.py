#!/usr/bin/env python3
"""t1183 — the DB byte-size fingerprint re-key (the t1177 law's own shape):
the t1182 film's mint+teardown churn bloated the live db to 41 pages with
6 freelist; the VACUUM reclaimed them AND the t1177-era 36th page (the
rows stand 15 jobs / 13 completed / 14 edges — the world one page lighter
by honest teardowns). The five units' exact-equality fingerprint follows
the world: 147456 → 143360, the reason named in every message."""
import pathlib, sys

ROOT = pathlib.Path("/home/z/my-project/scripts")
OLD_TAIL = 'a vacuum has nothing to reclaim)'
NEW_TAIL = ('a vacuum has nothing to reclaim; the t1183 re-key: the film\'s '
            'mint+teardown churn bloated the file to 41 pages with 6 freelist — '
            'the VACUUM reclaimed them and the t1177-era 36th page too '
            '(the rows stand 15/13/14 — the world one page lighter by honest '
            'teardowns) — 147456→143360)')

FILES = {
    "t1021-import-fuel-unit.mjs": [(OLD_TAIL + '", dbBytes === 147456', NEW_TAIL + '", dbBytes === 143360')],
    "t1022-fuel-face-unit.mjs": [(OLD_TAIL + '", dbBytes === 147456', NEW_TAIL + '", dbBytes === 143360')],
    "t1024-dialog-fuel-unit.mjs": [(OLD_TAIL + '", dbBytes === 147456', NEW_TAIL + '", dbBytes === 143360')],
    "t1023-watchdog-guard-unit.mjs": [
        ('a vacuum has nothing to reclaim; the page-quantized size held at 36 pages)", dbBytes === 147456',
         NEW_TAIL + '", dbBytes === 143360'),
    ],
    "t1164-takehome-proof-unit.mjs": [
        ('size === "147456"', 'size === "143360"'),
        ("// page-quantized size (the t1021 family's pinned 143360; the t1177\n"
         "// re-key: the ride-churn page split, 35→36 pages, freelist 0 — the same\n"
         "// named cause as the t1021 family's re-key).",
         "// page-quantized size (the t1021 family's pinned 143360; the t1177\n"
         "// re-key: the ride-churn page split, 35→36 pages, freelist 0; the\n"
         "// t1183 re-key: the film's churn bloated the file to 41 pages with 6\n"
         "// freelist — the VACUUM reclaimed them and the t1177-era 36th page —\n"
         "// the fingerprint follows the world, 147456→143360)."),
    ],
}

for name, pairs in FILES.items():
    p = ROOT / name
    text = p.read_text()
    for old, new in pairs:
        n = text.count(old)
        assert n == 1, f"{name}: expected exactly 1 occurrence, got {n}\n---\n{old[:120]}"
        text = text.replace(old, new)
    p.write_text(text)
    print(f"  re-keyed {name}")
print("ALL FIVE RE-KEYED")
