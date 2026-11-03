#!/usr/bin/env python3
"""Offline cleanup for the qa60/qa62 FSC seed — no server needed (the
sandbox reaps server processes at tool-call boundaries in the short cron
windows, so the seed's API-based --clean path is unavailable).
Does exactly what seed --clean does:
  1. remove the seeded star files (4 completed + live checkpoint)
  2. pop the 5 QA engine-state entries
  3. delete the QA Refine Live job row via Prisma (the API DELETE also
     clears its run record — we pop it in step 2 anyway)
The four completed QA fixture jobs stay on the canvas (prior rounds'
hygiene: completed fixtures remain, only stars/state are removed).
Task 161 note — this is the ROOT teardown shape (qa_lib.py doctrine):
the live job ROW is deleted here, so popping its entry is coherent (a
dead root keeps no registration); tenant assets under the live workdir
(qa64's run_it016 checkpoint) are moot because qa64 self-seeds."""
import json, os, subprocess, sys

STATE = "/home/z/my-project/data/engine-state.json"
PROJECT = "cmtrzp5x80002p8uofb9eu5pp"
SPECS = [  # (name, jtype) — same as the seed's SPECS + LIVE
    ("QA Post 300", "postprocess"), ("QA Post 320", "postprocess"),
    ("QA Post 385", "postprocess"), ("QA Refine 410", "refine3d"),
]
LIVE = ("QA Refine Live", "refine3d")
LIVE_CHECKPOINT = "run_it014_half1_model.star"

state = json.load(open(STATE))
removed_files = 0

def workdir_for(job_id, jtype):
    return f"/home/z/my-project/data/relion/{PROJECT}/{jtype}_{job_id[-8:]}"

# map job names → ids straight from the DB (offline)
q = subprocess.run(
    ["node", "-e", """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.job.findMany({ where: { projectId: process.argv[1] }, select: { id: true, name: true, type: true } })
  .then(rows => { console.log(JSON.stringify(rows)); return p.$disconnect(); });
""", PROJECT],
    capture_output=True, text=True, cwd="/home/z/my-project",
)
if q.returncode != 0:
    sys.exit(f"prisma listing failed: {q.stderr[:300]}")
rows = json.loads(q.stdout)
by_name = {r["name"]: r for r in rows}

for name, jtype in SPECS + [LIVE]:
    job = by_name.get(name)
    if not job:
        continue
    wd = workdir_for(job["id"], jtype)
    fnames = [LIVE_CHECKPOINT] if name == LIVE[0] else (
        ["postprocess.star"] if jtype == "postprocess" else ["run_half1_model.star"])
    for fn in fnames:
        fp = os.path.join(wd, fn)
        if os.path.exists(fp):
            os.remove(fp); removed_files += 1
    if state.pop(job["id"], None) is not None:
        pass  # popped

with open(STATE, "w") as f:
    json.dump(state, f, indent=2)

# delete the live job row
live = by_name.get(LIVE[0])
deleted = False
if live:
    d = subprocess.run(
        ["node", "-e", """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.job.delete({ where: { id: process.argv[1] } })
  .then(() => { console.log('deleted'); return p.$disconnect(); })
  .catch(e => { console.error(e.message); process.exit(1); });
""", live["id"]],
        capture_output=True, text=True, cwd="/home/z/my-project",
    )
    deleted = "deleted" in d.stdout

print(f"files removed: {removed_files}")
print(f"state entries now: {len(state)}")
print(f"live job deleted: {deleted}")
