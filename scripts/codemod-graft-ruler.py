#!/usr/bin/env python3
"""t864 codemod — graft the shared ruler onto the seven census instruments.

Mechanical, self-verifying: each file gets
  1. the inline `const nameOf = (el) => { ... };` (inside its MEASURE
     eval-string) replaced by `' + NAMEOF + '` — string-concatenation
     injection of scripts/shared-ruler.mjs's canonical source;
  2. an import line for { NAMEOF, NAMEOF_LAW } after the last import;
  3. (the receipt `ruler: NAMEOF_LAW,` field is a HAND edit afterwards —
     this codemod does not touch receipt assembly.)

Asserts exactly ONE nameOf occurrence per file (t186's job-id Map nameOf is
NOT this ruler and is not in the carrier list). Idempotence guard: a file
already importing shared-ruler is left untouched.
"""
import re
import sys
import pathlib

FILES = [
    "scripts/t843-a11y-rewitness.mjs",
    "scripts/t844-a11y-fragile-pair.mjs",
    "scripts/t846-a11y-maintenance.mjs",
    "scripts/t857-drift-ledger-probe.mjs",
    "scripts/t860-ride-variance-probe.mjs",
    "scripts/t862-overlay-a11y.mjs",
    "scripts/t863-job-panel-a11y.mjs",
]

NAMEOF_RE = re.compile(r"const nameOf = \(el\) => \{.*?return \"\"; \};")
IMPORT_LINE = 'import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";'

failures = 0
for path in FILES:
    p = pathlib.Path(path)
    src = p.read_text()
    if IMPORT_LINE in src:
        print(f"skip (already grafted): {path}")
        continue
    hits = NAMEOF_RE.findall(src)
    if len(hits) != 1:
        print(f"FAIL {path}: {len(hits)} nameOf occurrences (expected 1)")
        failures += 1
        continue
    src = NAMEOF_RE.sub("' + NAMEOF + '", src, count=1)
    lines = src.split("\n")
    last_import = max(i for i, l in enumerate(lines) if l.startswith("import "))
    lines.insert(last_import + 1, IMPORT_LINE)
    p.write_text("\n".join(lines))
    print(f"grafted {path}")

sys.exit(1 if failures else 0)
