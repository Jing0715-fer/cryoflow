#!/usr/bin/env python3
"""
t693 — the API door census: which routes carry the same-origin guard.

The t251/t259 door sweeps were REACTIVE (a route got its door when a
probe or feature touched it — t266's own commit calls topaz-training
'the t251-class sibling that missed the door sweep'). This census is the
proactive full-family sweep: 88 routes, guard adoption, and a triage of
the unguarded by threat model:

  - workdir/file-derived READS  -> FINDING (the #5 class, needs the door)
  - world-shaping JSON writes   -> CANDIDATE (the t259 profiles-class;
                                   request.json() is a parser, not a firewall)
  - DB-only reads / low-stakes  -> exempt (documented residual)

Re-run after the build-day door batch: expect guarded 64 -> 67+.
Read-only evidence tool (the t692 census's sibling).
"""
import re
import subprocess
from pathlib import Path

ROOT = Path("/home/z/my-project")
API = ROOT / "src/app/api"

FS_PAT = re.compile(r"readFile|readdir|fs\.|workdir|path\.join|spawnSync|execSync|createReadStream")
VERB_PAT = re.compile(r"export async function (GET|POST|PATCH|DELETE)")

routes = sorted(API.rglob("route.ts"))
guarded, unguarded = [], []
for r in routes:
    s = r.read_text()
    (guarded if "isLocalRequest" in s else unguarded).append(r)

print(f"routes: {len(routes)} total | {len(guarded)} guarded | {len(unguarded)} unguarded\n")

findings, candidates, exempt = [], [], []
for r in unguarded:
    rel = str(r.relative_to(ROOT))
    s = r.read_text()
    # the .star shape trap: exclude .startedAt (t693's own regex lesson)
    s_scan = s.replace(".startedAt", "")
    verbs = ",".join(VERB_PAT.findall(s_scan))
    fs_hits = len(FS_PAT.findall(s_scan))
    if "GET" in verbs and fs_hits >= 2:
        findings.append((rel, verbs, fs_hits))
    elif "POST" in verbs or "PATCH" in verbs or "DELETE" in verbs:
        candidates.append((rel, verbs, fs_hits))
    else:
        exempt.append((rel, verbs, fs_hits))

print("FINDINGS (workdir-derived reads without the door):")
for rel, verbs, n in findings:
    print(f"  {rel}  verbs={verbs} fs-refs={n}")
print("\nCANDIDATES (world-shaping writes — judge per route against the t259 criterion):")
for rel, verbs, n in candidates:
    print(f"  {rel}  verbs={verbs} fs-refs={n}")
print("\nEXEMPT (DB-only reads / documented residual):")
for rel, verbs, n in exempt:
    print(f"  {rel}  verbs={verbs} fs-refs={n}")
