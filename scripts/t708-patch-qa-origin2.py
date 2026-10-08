#!/usr/bin/env python3
"""t708 — the writers batch extends the door family; the probes learn the
language before the door is live (the t707 both-worlds doctrine, second
verse). Thirteen write routes (POST/PUT/PATCH/DELETE across workflow-import,
pipeline-template, jobs, project, edges, edges/[id], jobs/[id],
subvolume-job, jobs/layout, workspaces, workspaces/[id], custom-template,
hpc/simulate) carry the isLocalRequest gate in source — staged for the next
build day. Every suite that drives those writes with a BARE node-level
fetch would 403 the moment the bundle activates, so each one installs the
shared qa-origin shim (import + one call): harmless today (doorless routes
ignore Origin), required tomorrow.

NOT patched, on purpose:
  - t251/t252 — the doors' own tests; they must speak RAW (bare → 403) and
    carry their metadata explicitly where they probe route-speak.
  - qa_lib.py users — the Python family already sends sec-fetch-site +
    Origin on every call (t251-era global cure).
  - suites whose write calls spread SH/SHJ (Origin + Sec-Fetch already in
    the const) or run inside the page (same-origin by construction).

Idempotent: a file already importing qa-origin.mjs is left untouched."""
import re
import subprocess
from pathlib import Path

ROOT = Path("/home/z/my-project/scripts")
MJS_FILES = [
    # the t25/t26 canvas suites with bare node write-calls
    "t256-map-card.mjs",            # bare DELETE /api/jobs/[id] (cleanup legs)
    "t257-reference-card.mjs",      # bare POST subvolume-job + /api/edges
    "t258-view-in-3d.mjs",          # same shape
    "t260-clip-from-card.mjs",      # same shape
    # the remote family's mkJob/mkEdge helpers (bare by construction)
    "t262-remote-run-e2e.mjs",
    "t263-remote-hardening.mjs",
    "t264-remote-externals.mjs",
    "t265-remote-topaz-train.mjs",
    "t266-topaz-training-curve.mjs",
    "t267-probeless-dispatch.mjs",
    "t268-probe-cost-heartbeat.mjs",
    "t269-time-ledger.mjs",
    "t270-run-resume.mjs",
    "t271-resume-jump.mjs",
    "t272-cross-canvas-resume.mjs",
    "t296-big-map-viewer.mjs",      # bare POST /api/jobs (big-map import)
    "t298-remote-big-map.mjs",      # bare mkJob (run POST already speaks SH)
    # live tools outside the rotation
    "world-hygiene.mjs",            # bare PATCH/DELETE /api/jobs/[id] janitor legs
    "qa61-e2e.mjs",                 # bare POST/PATCH /api/jobs
    "qa77-e2e.mjs",                 # bare POST/DELETE workspaces + jobs
    "qa64-e2e.mjs",                 # safe-add (same family, writes adjacent)
]
SHIM_LINES = [
    'import { installOriginDoor } from "./lib/qa-origin.mjs";',
    "installOriginDoor(); // t708 — the writers batch: 13 write routes reject headerless clients once the door activates (the t707 both-worlds doctrine)",
]


def patch(path: Path) -> str:
    text = path.read_text()
    if "qa-origin.mjs" in text:
        return "already patched"
    stmt = re.search(r"^(import\b|const\b|let\b|var\b|await\b|async function|function\b)", text, re.M)
    if not stmt:
        return "no insertion point"
    at = stmt.start()
    block = "\n".join(SHIM_LINES) + "\n"
    path.write_text(text[:at] + block + text[at:])
    return "patched"


def check(path: Path) -> str:
    r = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    return "ok" if r.returncode == 0 else f"SYNTAX FAIL: {r.stderr.strip()[:200]}"


for name in MJS_FILES:
    p = ROOT / name
    if not p.exists():
        print(f"{name}: MISSING")
        continue
    verdict = patch(p)
    print(f"{name}: {verdict}" + ("" if verdict != "patched" else f" | node --check: {check(p)}"))
