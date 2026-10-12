#!/usr/bin/env python3
"""t874 guard propagator — inserts the retirement guard after the BASE const
in each of the 14 remaining walk instruments (the audit's WALKS minus the
five already guarded). Idempotent: skips files that already carry the guard."""
import pathlib, re, sys

ROOT = pathlib.Path("/home/z/my-project/scripts")
GUARDED_ALREADY = {"t651-e2e.mjs", "t652-e2e.mjs", "t660-e2e.mjs", "t665-e2e.mjs", "t680-judge-storm.mjs"}
PIN_RE = re.compile(r"cmuwipe[0-9a-z]*")

GUARD = """{cid} = "{pid}";

// t874 — the retirement audit's guard: the pinned world ({pid}) predates the
// snapshot restore; absent from the roster, the ride retires honestly
// (exit 3 = RETIRED — distinct from the exit-1 red — the t874 receipt
// shots-qa/t874-e2e-retirement.json holds the census).
{{
  const _r = await fetch(`$ {{BASE}}/api/jobs/{pid}`, {{ headers: {{ Origin: BASE, Referer: `$ {{BASE}}/` }} }}).catch(() => null);
  if (!_r || !_r.ok) {{
    console.error(`RETIRED (the t874 audit): the pinned world {pid} is gone from the roster — exit 3, retired not red.`);
    process.exit(3);
  }}
}}"""

patched, skipped = [], []
for f in sorted(ROOT.glob("*.mjs")):
    if f.name in GUARDED_ALREADY or f.name == "t874-e2e-retirement-audit.mjs":
        continue
    txt = f.read_text()
    if "RETIRED (the t874 audit)" in txt:
        skipped.append(f.name)
        continue
    if "cmuwipe" not in txt:
        continue
    ids = sorted(set(PIN_RE.findall(txt)))
    if not ids:
        continue
    pid = ids[0]
    m = re.search(r'^const BASE = "http://localhost:3000";$', txt, re.M)
    if not m:
        print(f"NO BASE ANCHOR: {f.name}", file=sys.stderr)
        continue
    guard_block = (
        "\n\n// t874 — the retirement audit's guard: the pinned world ({pid}) predates the\n"
        "// snapshot restore; absent from the roster, the ride retires honestly\n"
        "// (exit 3 = RETIRED — distinct from the exit-1 red — the t874 receipt\n"
        "// shots-qa/t874-e2e-retirement.json holds the census).\n"
        "{{\n"
        "  const _r = await fetch(`${{BASE}}/api/jobs/{pid}`, {{ headers: {{ Origin: BASE, Referer: `${{BASE}}/` }} }}).catch(() => null);\n"
        "  if (!_r || !_r.ok) {{\n"
        "    console.error(`RETIRED (the t874 audit): the pinned world {pid} is gone from the roster — exit 3, retired not red.`);\n"
        "    process.exit(3);\n"
        "  }}\n"
        "}}"
    ).format(pid=pid)
    end = m.end()
    txt2 = txt[:end] + guard_block + txt[end:]
    f.write_text(txt2)
    patched.append((f.name, pid))

for name, pid in patched:
    print(f"patched {name} (guard pid {pid})")
print(f"{len(patched)} patched, {len(skipped)} already guarded: {skipped}")
