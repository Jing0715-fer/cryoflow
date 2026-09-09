#!/usr/bin/env python3
"""Task 85 — one-command gallery living-instance rebuild (disaster recovery).

Background: the QA matrix anchors on a rich "living instance" (completed
SPA pipeline + seeded fixtures) that used to exist only as accumulated
state in a particular SQLite DB. When the sandbox restored an older
filesystem snapshot, that instance was gone and every seeder that
hardcoded its ids (project/workspace/workdir suffix) stranded with 400s.
This script rebuilds the whole instance idempotently onto whatever
project currently exists, and the seeders now resolve ids at runtime
(scripts/qa_lib.py) — a DB reset is no longer a manual archaeology dig.

What it builds (idempotent by name — safe to re-run):
  1. switches the active project to the first project (the demo)
  2. adopts orphan jobs (workspaceId NULL — the β-Gal seed legacy) into
     the default workspace
  3. creates the QA skeleton chain (11 completed jobs + qa58's
     class2d/select2d pair)
  4. wires the pipeline edges with the app's real port names
  5. flips statuses/results straight in the DB (PATCH only allows idle —
     same approach the engine uses)
  6. registers engine run records (outputs routes refuse jobs without one)
  7. runs the fixture seeder chain: qa58 (class gallery) → qa50/51/52/53
     (refine3d report fodder) → qa67 (orthovol for the 3D lightbox)

Run: python3 scripts/restore-gallery.py
"""
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa_lib import (  # noqa: E402
    api,
    find_by_name,
    job_workdir,
    list_jobs,
    register_engine_state,
    resolve_project,
    resolve_workspace,
)

SCRIPTS = os.path.dirname(os.path.abspath(__file__))


def create_job(jobs, name, jtype, x, y, workspace_id):
    existing = find_by_name(name, jobs)
    if existing:
        print(f"job (existing): {name} [{existing['type']}]")
        return existing
    r = api("/api/jobs", "POST", {"type": jtype, "x": x, "y": y, "workspaceId": workspace_id})
    j = r.get("job") or r
    api(f"/api/jobs/{j['id']}", "PATCH", {"name": name})
    print(f"job (created):  {name} [{jtype}]")
    return j


def main():
    project = resolve_project()
    workspace = resolve_workspace(project)
    print(f"project:   {project}\nworkspace: {workspace}")

    # 1. make it the active project (dashboard/roster anchor on ACTIVE)
    api("/api/projects/switch", "POST", {"id": project})

    # 2. adopt orphans — the β-Gal demo seed ships workspaceId NULL jobs
    #    (the "β-Gal zero-workspace seed rule" leftover: a fresh seed should
    #    not manufacture permanent orphan noise in the roster)
    jobs = list_jobs()
    orphans = [j for j in jobs if not j.get("workspaceId")]
    for j in orphans:
        api(f"/api/jobs/{j['id']}", "PATCH", {"workspaceId": workspace})
    if orphans:
        print(f"adopted orphans: {[j['name'] for j in orphans]}")

    # 3. skeleton — name → (type, result, x, y); statuses flipped in step 5.
    #    Result strings follow the engine's own summary grammar so the
    #    pipeline-analytics funnel reads them exactly like real runs.
    skeleton = [
        ("QA Import", "import", "24 micrographs imported", 60, 160),
        ("QA MotionCorr", "motioncorr", "24 micrographs corrected", 300, 160),
        ("QA CtfFind", "ctffind", "24 micrographs with CTF", 540, 160),
        ("QA Auto-pick", "autopick", "3,428 particles picked", 780, 160),
        ("QA Extract", "extract", "3,428 particles extracted", 1020, 160),
        ("QA Particle Select", "select", "1,714 of 3,428 particles selected", 1020, 380),
        ("QA SymExpand", "symexpand", "= 3,428 particles (C2) · 1,714 × 2 symmetry", 300, 380),
        ("QA Rebalance", "rebalance", "1,714 of 3,428 particles kept", 540, 380),
        ("QA Class3D", "class3d", "4 3D classes · 1,714 particles", 160, 560),
        ("QA Refine3D", "refine3d", "Refined to 9.44 Å", 400, 560),
        ("QA Post-process", "postprocess", "Sharpened map · 7.08 Å", 640, 560),
    ]
    created = {}
    jobs = list_jobs()
    for name, jtype, result, x, y in skeleton:
        created[name] = create_job(jobs, name, jtype, x, y, workspace)
        created[name]["_result"] = result

    # 4. qa58 seeds the class2d→select2d pair + the class gallery fixtures
    r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "qa58-seed-gallery.py")],
                       capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        sys.exit(f"qa58 seeder failed: {r.stderr.strip()[:400]}")
    jobs = list_jobs()
    class2d = find_by_name("QA Class2D Source", jobs)
    if class2d is None:
        sys.exit("qa58 chain missing after seeder run")

    # 5. wire the pipeline edges (real port names from src/lib/workflow.ts)
    edges = api("/api/edges")
    edges = edges["edges"] if isinstance(edges, dict) else edges
    have = {(e["fromJobId"], e["toJobId"], e.get("fromPort")) for e in edges}
    J = {k: v["id"] for k, v in created.items()}
    J["QA Class2D Source"] = class2d["id"]
    sel2d = find_by_name("QA Class Select", jobs)
    J["QA Class Select"] = sel2d["id"] if sel2d else None
    wiring = [
        ("QA Import", "micrographs", "QA MotionCorr", "movies"),
        ("QA MotionCorr", "micrographs", "QA CtfFind", "micrographs"),
        ("QA CtfFind", "micrographs", "QA Auto-pick", "micrographs"),
        ("QA Auto-pick", "coords", "QA Extract", "coords"),
        ("QA Extract", "particles", "QA Class2D Source", "particles"),
        ("QA Class2D Source", "classAverages", "QA Class Select", "classes"),
        ("QA Class Select", "particles", "QA Particle Select", "particles"),
        ("QA Particle Select", "particles", "QA Class3D", "particles"),
        ("QA Class3D", "particles", "QA SymExpand", "particles"),
        ("QA SymExpand", "particles", "QA Rebalance", "particles"),
        ("QA Rebalance", "particles", "QA Refine3D", "particles"),
        ("QA Class3D", "model", "QA Refine3D", "reference"),
        ("QA Refine3D", "half1", "QA Post-process", "half1"),
        ("QA Refine3D", "half2", "QA Post-process", "half2"),
    ]
    made = 0
    for f, fp, t, tp in wiring:
        if J[f] is None or J[t] is None:
            continue
        if (J[f], J[t], fp) in have:
            continue
        api("/api/edges", "POST", {
            "fromJobId": J[f], "toJobId": J[t], "fromPort": fp, "toPort": tp,
        })
        made += 1
    print(f"edges: +{made} (total now {len(wiring)})")

    # 6. statuses + results straight in the DB (PATCH only allows idle)
    flip = """
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const spec = JSON.parse(process.argv[1]);
Promise.all(spec.map(([id, result]) =>
  p.job.update({ where: { id }, data: { status: 'completed', progress: 100, result } }),
)).then(() => { console.log('flipped ' + spec.length); return p.$disconnect(); })
  .catch((e) => { console.error(e.message); process.exit(1); });
"""
    spec = [[v["id"], v["_result"]] for v in created.values() if v["id"]]
    r = subprocess.run(["node", "-e", flip, json.dumps(spec)],
                       cwd="/home/z/my-project", capture_output=True, text=True)
    if "flipped" not in r.stdout:
        sys.exit(f"DB flip failed: {r.stderr.strip()[:300]}")
    print(f"status: {r.stdout.strip()} (+ qa58's class2d; select2d stays idle by design)")

    # 7. engine run records + workdirs for every skeleton job
    for v in created.values():
        if not v["id"]:
            continue
        wd = job_workdir(project, v)
        os.makedirs(wd, exist_ok=True)
        if register_engine_state(v["id"], project, v["type"], wd):
            print(f"run record: {v['type']} → {os.path.basename(wd)}")

    # 8. fixture fodder chain (each is a superset of the previous);
    #    qa60 also ships the RUNNING "QA Refine Live" card qa69 anchors on
    for seeder in ("qa58-seed-gallery.py", "qa50-seed-fsc.py", "qa51-seed-report.py",
                   "qa52-seed-report.py", "qa53-seed-topaz.py", "qa60-seed-fsc.py",
                   "qa67-seed-volume.py"):
        r = subprocess.run([sys.executable, os.path.join(SCRIPTS, seeder)],
                           capture_output=True, text=True)
        tail = (r.stdout.strip().splitlines() or [""])[-1]
        print(f"{seeder}: {'ok — ' + tail if r.returncode == 0 else 'FAILED — ' + r.stderr.strip()[:200]}")
        if r.returncode != 0:
            sys.exit(1)

    jobs = list_jobs()
    proj_jobs = [j for j in jobs if j.get("projectId") == project]
    print(f"\nroster: {len(proj_jobs)} jobs in the active project "
          f"({sum(1 for j in proj_jobs if j['status'] == 'completed')} completed)")
    print("gallery living instance restored.")


if __name__ == "__main__":
    main()
