#!/usr/bin/env python3
"""
t692 — the key-numbers strip ALIVENESS census across the demo world.

The user's ask (output-summary.ts L4): 「每一步的UI界面结果中都要突出 particles
的数量，这个信息很关键」. t609's resurrection pilot found the strip DEAD for the
demo world's canonical extract job: the seeded world's workdir says
`extract.star` (qa-t531-old-world-seed's dialect) while summarizeOutputs'
extract branch asks for `particles.star` (the real-RELION + remote-lane name).

This census asks, for EVERY job in the world: does the outputs endpoint hand
the strip a summary (the strip is ALIVE), and if not — which file dialect does
the lib's branch expect vs which file actually sits in the workdir? The
verdicts price the build-day fix batch (lib filename tolerance).

Read-only: API + filesystem. Re-runnable evidence.
"""
import json
import subprocess
import os

BASE = "http://localhost:3000"
ROOT = "/home/z/my-project"
HDR = f"-H \"Origin: {BASE}\""


def curl_json(path):
    out = subprocess.run(
        ["curl", "-s", "-H", f"Origin: {BASE}", f"{BASE}{path}"],
        capture_output=True, text=True,
    ).stdout
    try:
        return json.loads(out)
    except Exception:
        return {"_unparsable": out[:120]}


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout.strip()


jobs = curl_json("/api/jobs")
jobs = jobs.get("jobs", jobs) if isinstance(jobs, dict) else jobs
print(f"world: {len(jobs)} jobs\n")

rows = []
for j in sorted(jobs, key=lambda x: (x.get("type", ""), x.get("id", ""))):
    jid, jtype, jstatus = j["id"], j.get("type"), j.get("status")
    r = curl_json(f"/api/jobs/{jid}/outputs")
    if "error" in r:
        rows.append((jtype, jstatus, jid, "OUTPUTS-ERROR", r["error"][:40], ""))
        continue
    summary = r.get("summary")
    stats = (summary or {}).get("stats") or []
    workdir = r.get("workdir") or ""
    listing = sh(f"ls {workdir} 2>/dev/null") if workdir and os.path.isdir(workdir) else ""
    files_n = len(r.get("files") or [])
    if stats:
        kv = ", ".join(f"{s.get('key')}={s.get('value')}" for s in stats)
        verdict = f"ALIVE ({kv})"
    elif jstatus != "completed":
        verdict = "n/a (not completed)"
    elif summary is not None and len(stats) == 0:
        verdict = "EMPTY-SUMMARY"
    else:
        verdict = "DEAD (summary null)"
    rows.append((jtype, jstatus, jid, verdict, f"walk-files={files_n}", listing))

for jtype, jstatus, jid, verdict, note, listing in rows:
    print(f"[{jtype:>10} | {jstatus:>9}] {jid[:26]:<26} {verdict}  {note}")
    if listing:
        print(f"{'':<24}workdir: {listing.replace(chr(10), ' · ')}")

alive = sum(1 for r in rows if r[3].startswith("ALIVE"))
dead = sum(1 for r in rows if r[3].startswith("DEAD"))
empty = sum(1 for r in rows if r[3].startswith("EMPTY"))
done = sum(1 for r in rows if r[1] == "completed")
print(f"\nverdict: {alive} alive / {dead} dead / {empty} empty-summary / {done} completed of {len(jobs)} jobs")
