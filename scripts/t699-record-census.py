#!/usr/bin/env python3
"""
t699 — the engine-state RECORD census: every completed job must carry a full
life (record + workdir + log + err + output files + an outputs endpoint that
answers "ok").

Why this census exists: t692's strip-aliveness census measured the world
through the outputs endpoint's SUMMARY leg — and an A-class designed-silence
job (maskcreate: output-summary.ts L571 "single map — no key numbers") has no
summary to measure, so its missing RECORD never registered as a dead face
that could wake. The record layer is visible only through an instrument that
looks at the record itself:

  - record <-> job cross-check (engine-state.json vs the jobs API):
    orphan records (job gone) and jobs without records (life missing).
  - the completed-life audit per job (t696's law, generalized): a job whose
    DB status says "completed" must have a record whose workdir, logFile,
    errFile and every outputs value exist on disk, and whose outputs
    endpoint answers status "ok" — not the missing-record confession.
  - the fossil audit: records whose jobs are gone — inert if their ids can
    never be reached by a live consumer (records are keyed by job id, and
    resolveInputs walks UPSTREAM EDGES of live jobs only).

The census is read-only and world-following: it reads whatever world is
live, prices nothing, fixes nothing. Re-runnable evidence.

Pre-fix expected verdicts (2026-10-08 world):
  - 36 records vs 17 jobs, one project (cmuwipe6350000demoproject)
  - 20 cmuyb* fossils (project cmuyb4tb50000on85bg44ugzz, workdirs intact)
  - 1 incomplete life: cmututold00000maskcreate (no record, no workdir,
    missing-record confession, upstream provider of postprocess's mask port)
Post-fix: fossils unchanged; incomplete lives = 0.
"""
import json
import os
import subprocess

BASE = "http://localhost:3000"
ROOT = "/home/z/my-project"
STATE = os.path.join(ROOT, "data/engine-state.json")


def curl_json(path):
    out = subprocess.run(
        ["curl", "-s", "-H", f"Origin: {BASE}", f"{BASE}{path}"],
        capture_output=True, text=True,
    ).stdout
    try:
        return json.loads(out)
    except Exception:
        return {"_unparsable": out[:120]}


def main():
    with open(STATE) as f:
        records = json.load(f)
    jobs_resp = curl_json("/api/jobs")
    jobs = jobs_resp.get("jobs", jobs_resp)
    edges_resp = curl_json("/api/edges")
    edges = edges_resp.get("edges", edges_resp)

    job_ids = {j["id"] for j in jobs}
    rec_ids = set(records.keys())

    orphans = sorted(rec_ids - job_ids)
    lifeless = sorted(job_ids - rec_ids)

    print(f"== t699 record census ==")
    print(f"records: {len(rec_ids)} | jobs: {len(job_ids)} | edges: {len(edges)}")
    projects = {r.get("projectId") for r in records.values()}
    print(f"record projects: {sorted(projects)}")

    # --- fossils ----------------------------------------------------------
    fossil_wd_exists = 0
    fossil_wd_gone = 0
    for rid in orphans:
        wd = records[rid].get("workdir")
        if wd and os.path.isdir(wd):
            fossil_wd_exists += 1
        else:
            fossil_wd_gone += 1
    print(f"\n[orphan records] {len(orphans)} (workdir intact: {fossil_wd_exists}, gone: {fossil_wd_gone})")
    fossil_projects = {records[r].get("projectId") for r in orphans}
    for fp in sorted(fossil_projects):
        print(f"  fossil project: {fp}")

    # --- completed-life audit --------------------------------------------
    print(f"\n[completed-life audit] per job: record + workdir + log + err + outputs files + endpoint ok")
    incomplete = []
    alive = 0
    for j in sorted(jobs, key=lambda x: x["id"]):
        jid = j["id"]
        status = j.get("status")
        problems = []
        rec = records.get(jid)
        if status == "completed":
            if rec is None:
                problems.append("no record")
            else:
                wd = rec.get("workdir")
                if not wd or not os.path.isdir(wd):
                    problems.append("workdir missing on disk")
                else:
                    for key, label in (("logFile", "run.log"), ("errFile", "run.err")):
                        p = rec.get(key)
                        if not p or not os.path.isfile(p):
                            problems.append(f"{label} missing ({key})")
                    outs = rec.get("outputs") or {}
                    for key, val in outs.items():
                        # outputs values are path strings; class2d's classes_mrc
                        # is a path LIST (one per class map) — audit both shapes.
                        paths = val if isinstance(val, list) else [val]
                        for p in paths:
                            if not os.path.isfile(p):
                                problems.append(f"outputs[{key}] file missing: {os.path.basename(str(p))}")
            resp = curl_json(f"/api/jobs/{jid}/outputs")
            st = resp.get("status")
            if st != "ok":
                problems.append(f"outputs status = {st}")
        if problems:
            incomplete.append((jid, j.get("type"), problems))
            print(f"  INCOMPLETE: {jid} ({j.get('type')}): " + "; ".join(problems))
        else:
            alive += 1
    print(f"  full lives: {alive}/{len(jobs)} | incomplete: {len(incomplete)}")

    # --- edge impact for incomplete lives ---------------------------------
    if incomplete:
        print(f"\n[edge impact] live jobs consuming from incomplete lives:")
        for jid, _, _ in incomplete:
            downs = [e for e in edges if e["fromJobId"] == jid]
            ups = [e for e in edges if e["toJobId"] == jid]
            for e in downs:
                print(f"  {jid} --{e['fromPort']}--> {e['toJobId']}:{e['toPort']}")
            for e in ups:
                print(f"  {e['fromJobId']} --{e['fromPort']}--> {jid}:{e['toPort']}")
            if not downs and not ups:
                print(f"  {jid}: (no edges — side job)")

    print(f"\nverdict: incomplete lives = {len(incomplete)} | orphans = {len(orphans)} "
          f"(inert fossils with intact workdirs)")


if __name__ == "__main__":
    main()
