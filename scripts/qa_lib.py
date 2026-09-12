#!/usr/bin/env python3
"""Shared discovery helpers for QA seeders — the Task 85 disaster-recovery
lesson: the gallery living instance used to anchor on hardcoded DB ids
(PROJECT/WORKSPACE/workdir suffixes), so a DB reset stranded every seeder
with HTTP 400. All id constants now resolve at runtime, env-overridable:

  QA_PROJECT    project id      (default: first project = the living demo)
  QA_WORKSPACE  workspace id    (default: first workspace of that project)
  QA_REFINE     refine3d host job name for the report-fodder seeders
                (default "QA Refine3D" — created by restore-gallery.py)

Import as:  from qa_lib import resolve_project, resolve_workspace, ...
(seeders live in the same scripts/ directory; run with cwd=scripts or
`python3 scripts/<seeder>.py` — sys.path manipulation below covers both).
"""
import json
import os
import sys
import urllib.request

BASE = os.environ.get("QA_BASE", "http://localhost:3000")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def api(path, method="GET", body=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        headers={"Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
        return json.loads(data) if data else {}


def list_jobs():
    d = api("/api/jobs")
    return d["jobs"] if isinstance(d, dict) else d


def resolve_project():
    pid = os.environ.get("QA_PROJECT")
    if pid:
        return pid
    projects = api("/api/projects")["projects"]
    if not projects:
        raise SystemExit("qa_lib: no projects exist — create one first")
    return projects[0]["id"]


def resolve_workspace(project_id):
    wid = os.environ.get("QA_WORKSPACE")
    if wid:
        return wid
    ws = api("/api/workspaces")
    ws_list = ws["workspaces"] if isinstance(ws, dict) else ws
    if not ws_list:
        api("/api/workspaces", "POST", {"name": "Main"})
        ws = api("/api/workspaces")
        ws_list = ws["workspaces"] if isinstance(ws, dict) else ws
    return ws_list[0]["id"]


def find_by_name(name, jobs=None):
    jobs = jobs if jobs is not None else list_jobs()
    return next((j for j in jobs if j.get("name") == name), None)


def job_workdir(project_id, job):
    """Canonical engine workdir for a job — data/relion/<project>/<type>_<id8>."""
    return os.path.join(
        "/home/z/my-project/data/relion", project_id, f"{job['type']}_{job['id'][-8:]}"
    )


def read_engine_state():
    path = "/home/z/my-project/data/engine-state.json"
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_engine_state(state):
    path = "/home/z/my-project/data/engine-state.json"
    with open(path, "w") as f:
        json.dump(state, f, indent=2)


def register_engine_state(job_id, project_id, jtype, workdir, cmd="qa-fixture (restore-gallery.py)"):
    """Register a completed run record — idempotent, never overwrites a real
    dispatch record (those come from the engine itself)."""
    import datetime

    state = read_engine_state()
    if state.get(job_id):
        return False
    state[job_id] = {
        "jobId": job_id,
        "projectId": project_id,
        "type": jtype,
        "pid": None,
        "cmd": cmd,
        "workdir": workdir,
        "logFile": os.path.join(workdir, "run.out"),
        "errFile": os.path.join(workdir, "run.err"),
        "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "outputs": {},
        "done": True,
        "exitCode": 0,
    }
    write_engine_state(state)
    return True


# ---------------------------------------------------------------------------
# Task 161 — THE CLEANUP-RADIUS PROTOCOL (the shared-workdir house rules).
#
# A seeder's --clean may remove ONLY what it seeded: its own files always,
# and the engine-state entry ONLY when the workdir holds no foreign files.
# The entry is the workdir's REGISTRATION — /api/jobs/[id]/outputs resolves
# run.workdir through it and then readdirSyncs the disk — so popping the
# entry while the job row lives orphans every tenant file on disk (outputs
# returns workdir:null, files:[]). qa67/qa68's orthovol.mrc died exactly
# this way: qa58/qa59's cleanup popped the QA Class2D Source entry while
# qa67-seed-volume.py's volume still lived in that workdir, and the pair
# survived full matrices ONLY because qa66's self-seed happened to re-
# register the entry in between (Task 160's qa68 flash failure was the
# same chain without qa66).
#
# The two coherent teardown shapes:
#   - TENANT-AWARE (qa58-seed-gallery.py): the job row STAYS on the canvas,
#     so the entry pops only when no foreign files remain — a living job
#     keeps its registration, and outputs lists what is really on disk.
#   - ROOT (qa60-seed-fsc.py --clean, qa62-offline-clean.py): the job ROW
#     is deleted too, so the entry must go with it — a dead root cannot
#     keep a registration, and tenant assets under it (qa64's run_it016
#     checkpoint) are moot because their consumers self-seed (qa64 runs
#     qa60-seed-fsc.py before anything else).
#
# New seeders with tenants under their workdir MUST take the tenant-aware
# shape; new seeders that own the whole job take whichever shape matches
# whether the row survives the clean. When in doubt: the radius of a
# cleanup is the radius of its seed, and a registration outlives only
# what it truthfully describes.
# ---------------------------------------------------------------------------


def resolve_refine_host(project_id):
    """The report-fodder seeders (qa50-53) anchor on one refine3d host job."""
    name = os.environ.get("QA_REFINE", "QA Refine3D")
    job = find_by_name(name)
    if job is None:
        raise SystemExit(
            f"qa_lib: refine3d host '{name}' missing — run scripts/restore-gallery.py first"
        )
    if job.get("type") != "refine3d":
        raise SystemExit(f"qa_lib: job '{name}' has type '{job['type']}', expected refine3d")
    return job, job_workdir(project_id, job)
