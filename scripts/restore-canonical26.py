#!/usr/bin/env python3
"""Task 181 — canonical-shape restore for the five roster residents the
sandbox rollback lost (disaster recovery, sibling of restore-gallery.py).

Background: the 18:31 window inherited a sandbox rolled back to the Task
172 snapshot — origin/main still held everything (reset --hard restored
the CODE), but every UNTRACKED artifact died with it: the db, .next, and
the whole data/ tree. restore-gallery.py rebuilt the living-instance base
(21 jobs, 16 edges) and qa60-seed-fsc.py re-added the FSC family, but the
Task-180-era world was the canonical 26 (16c/8i/1f/1r) — five residents
and one second workspace short, and t180-e2e.mjs pins the roster at 26.

What this rebuilds (idempotent by name — safe to re-run):
  1. workspace "QA Bench" (the second workspace; one resident lives there)
  2. MotionCorr 002  — FAILED motioncorr in Main (the red card the Task-180
     patrol canvas shows; honest failure: engine record with exitCode 1 and
     a run.err, result text on the row)
  3. QA Set Rate     — idle rebalance in Main
  4. QA Polish Staging — idle postprocess in Main
  5. QA Class Staging  — idle class2d in Main
  6. QA Refine Staging — idle refine3d in QA Bench (the second-workspace
     resident the footer census never counted)

Names with a QA prefix but no fixture-signature collision (the hygiene
signatures are /^T\\d+ /, /^t\\d+ /, /^TL /, /^Deep /, /^QA Esc Import$/,
/^qa\\d+ Host$/, /^QA Overflow$/ — none match). The three "Staging" names
are honest reconstructions: the original cards predate every surviving
record (the world census in the worklog pins the CENSUS 16c/8i/1f/1r, not
each name), so the restore states its uncertainty instead of laundering it.

Idle jobs get NO engine record — they never ran, and the never-run dialect
("No log available (job has not run yet).") is the designed contract. The
failed job DOES get a record: it ran and died, and its Log tab must speak
from run.err, not from the never-run dialect.

Usage: python3 scripts/restore-canonical26.py
"""
import datetime
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa_lib import (  # noqa: E402
    api,
    find_by_name,
    list_jobs,
    read_engine_state,
    resolve_project,
    resolve_workspace,
    write_engine_state,
)

BASE = "http://localhost:3000"
PROJECT = resolve_project()
MAIN_WS = resolve_workspace(PROJECT)


def flip_status(job_id: str, status: str, progress: int, result: str | None = None) -> None:
    mark = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const data = { status: process.argv[2], progress: Number(process.argv[3]) };
if (process.argv[4]) data.result = process.argv[4];
p.job.update({ where: { id: process.argv[1] }, data })
  .then(() => { console.log('flipped'); return p.$disconnect(); })
  .catch((e) => { console.error(e.message); process.exit(1); });
"""
    r = subprocess.run(
        ["node", "-e", mark, job_id, status, str(progress), result or ""],
        cwd="/home/z/my-project", capture_output=True, text=True,
    )
    if "flipped" not in r.stdout:
        sys.exit(f"DB status flip failed for {job_id}: {r.stderr.strip()[:200]}")


def ensure_workspace(name: str) -> str:
    ws = api("/api/workspaces")
    rows = ws["workspaces"] if isinstance(ws, dict) else ws
    hit = next((w for w in rows if w.get("name") == name), None)
    if hit:
        return hit["id"]
    r = api("/api/workspaces", "POST", {"name": name})
    row = r.get("workspace") or r
    print(f"workspace (created): {row['id']} {name}")
    return row["id"]


def ensure_job(name: str, jtype: str, x: int, y: int, ws_id: str, note: str | None = None) -> dict:
    jobs = list_jobs()
    job = find_by_name(name, jobs)
    if job is None:
        body = {"type": jtype, "x": x, "y": y, "workspaceId": ws_id}
        r = api("/api/jobs", "POST", body)
        job = r.get("job") or r
        api(f"/api/jobs/{job['id']}", "PATCH", {"name": name})
        print(f"{jtype} (created): {name} {job['id']}")
    else:
        print(f"{jtype} (existing): {name} {job['id']}")
    if note:
        cur = (job.get("params") or {})
        if isinstance(cur, str):
            try:
                cur = json.loads(cur)
            except Exception:
                cur = {}
        if "note" not in cur:
            api(f"/api/jobs/{job['id']}", "PATCH", {"params": {**cur, "note": note}})
    return job


def register_failed_run(job: dict, jtype: str) -> None:
    """Engine record for a job that RAN and DIED: exitCode 1, done=True (the
    engine's terminal shape for a process it reaped), run.err speaks."""
    state = read_engine_state()
    if state.get(job["id"]):
        print(f"engine record (existing): {job['id'][-8:]}")
        return
    workdir = os.path.join("/home/z/my-project/data/relion", PROJECT, f"{jtype}_{job['id'][-8:]}")
    os.makedirs(workdir, exist_ok=True)
    with open(os.path.join(workdir, "run.err"), "w") as fh:
        fh.write(
            "[MotionCorr2] Aligning micrograph 3/12 (Falcon_20201215_003.hdf)\n"
            "[MotionCorr2] ERROR: patch 3 diverged — cumulative shift > 200 px\n"
            "[MotionCorr2] aborting job with exit code 1\n"
        )
    state[job["id"]] = {
        "jobId": job["id"],
        "projectId": PROJECT,
        "type": jtype,
        "pid": None,
        "cmd": "MotionCor2 -InMovies .. -OutMics .. -Patch 3 3 (failed run)",
        "workdir": workdir,
        "logFile": os.path.join(workdir, "run.out"),
        "errFile": os.path.join(workdir, "run.err"),
        "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "outputs": {},
        "done": True,
        "exitCode": 1,
    }
    write_engine_state(state)
    print(f"engine record (failed run): {job['id'][-8:]} exitCode 1")


def main() -> None:
    bench = ensure_workspace("QA Bench")

    failed = ensure_job("MotionCorr 002", "motioncorr", 1560, 360, MAIN_WS,
                        note="subtomo averaging workflow")
    flip_status(failed["id"], "failed", 34, "MotionCorr2 exited 1 — patch 3 diverged (run.err)")
    register_failed_run(failed, "motioncorr")

    ensure_job("QA Set Rate", "rebalance", 1180, 480, MAIN_WS)
    ensure_job("QA Polish Staging", "postprocess", 940, 300, MAIN_WS)
    ensure_job("QA Class Staging", "class2d", 1720, 210, MAIN_WS)
    ensure_job("QA Refine Staging", "refine3d", 300, 480, bench)

    jobs = list_jobs()
    census: dict[str, int] = {}
    for j in jobs:
        census[j["status"]] = census.get(j["status"], 0) + 1
    print(f"roster: {len(jobs)} jobs  census: {json.dumps(census, sort_keys=True)}")
    if len(jobs) != 26:
        print("NOTE: roster is not 26 — check for probe residue or a partial restore-gallery")


if __name__ == "__main__":
    main()
