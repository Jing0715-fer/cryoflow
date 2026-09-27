#!/usr/bin/env python3
"""t404 — backdate a ghost staging row's startedAt so the sweep's 30-min
fallback (remote-run.ts:6541) flips it honestly within one poll tick.

Context: the dev server restarted BEFORE the staging task's first heartbeat
(STAGING_BEAT_MS = 10s) ever landed, so remote.stagingBeat is null and the
sweep falls back to `ageMs > 30min` — 20+ idle minutes on a box where the
whole staging upload takes 3 seconds. Backdating startedAt reuses the exact
in-tree stale path: no new semantics, the row flips to the honest
"staging interrupted" failure, the record finalizes (done=true, exit -1),
and the healer's re-run resumes staging with the uploaded files skipped.

The engine's readRuns() busts its cache on mtime/size change — external
writers are a sanctioned concept (see engine.ts, the anti-time-travel
contract notes).
"""
import json, sys, time
from pathlib import Path

STATE = Path("/home/z/my-project/data/engine-state.json")
JOB_SUBSTR = sys.argv[1] if len(sys.argv) > 1 else "eje0j6"  # motioncorr id suffix
MINUTES_AGO = float(sys.argv[2]) if len(sys.argv) > 2 else 31.0

raw = STATE.read_text()
d = json.loads(raw)
runs = d.get("runs", d if isinstance(d, dict) else {})
hits = [k for k in runs if JOB_SUBSTR in k]
if not hits:
    sys.exit(f"no run key contains {JOB_SUBSTR!r}")
for k in hits:
    r = runs[k]
    rem = r.get("remote") or {}
    old = r.get("startedAt")
    if rem.get("phase") != "staging" or r.get("done"):
        print(f"{k}: phase={rem.get('phase')} done={r.get('done')} — not a ghost staging row, skip")
        continue
    r["startedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() - MINUTES_AGO * 60))
    print(f"{k}: startedAt {old} -> {r['startedAt']} (ghost staging backdated {MINUTES_AGO}m)")
STATE.write_text(json.dumps(d))
print("ledger written; next sweep tick (driven by any /api/jobs poll) should flip the row")
