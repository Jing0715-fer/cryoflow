#!/usr/bin/env python3
"""Task 30 E2E fixture — QA MultiSelect project with a 4-job wired chain."""
import json
import urllib.request

BASE = "http://localhost:3000"


def api(path, method="GET", body=None):
    req = urllib.request.Request(
        BASE + path,
        method=method,
        headers={"Content-Type": "application/json"},
        data=json.dumps(body).encode() if body else None,
    )
    with urllib.request.urlopen(req) as r:
        data = r.read()
        return json.loads(data) if data else {}


# 1. project (idempotent — reuse when the name already exists)
existing = api("/api/projects")["projects"]
pid = next((p["id"] for p in existing if p["name"] == "QA MultiSelect"), None)
if pid:
    print("project (existing):", pid)
else:
    proj = api("/api/projects", "POST", {"name": "QA MultiSelect", "mode": "spa"})
    pid = proj["project"]["id"] if "project" in proj else proj["id"]
    print("project:", pid)

# 2. workspaces — create one if the fresh project has none
api("/api/projects/switch", "POST", {"id": pid})
ws = api("/api/workspaces")
ws_list = ws["workspaces"] if isinstance(ws, dict) else ws
if not ws_list:
    api("/api/workspaces", "POST", {"name": "Main"})
    ws = api("/api/workspaces")
    ws_list = ws["workspaces"] if isinstance(ws, dict) else ws
wid = ws_list[0]["id"]
print("workspace:", wid)

# 3. four jobs, deliberately misaligned (x/y scattered)
types = [
    ("import", 100, 300),
    ("motioncorr", 460, 520),
    ("ctffind", 820, 260),
    ("autopick", 1180, 480),
]
job_ids = []
for t, x, y in types:
    r = api("/api/jobs", "POST", {"type": t, "x": x, "y": y, "workspaceId": wid})
    j = r["job"]
    job_ids.append(j["id"])
    print("job:", t, j["id"], x, y)

# 4. internal edges (port names from workflow.ts: import.out=micrographs,
#    motioncorr.in=movies / out=micrographs, ctffind.in=micrographs)
edge_specs = [
    (job_ids[0], job_ids[1], "micrographs", "movies"),
    (job_ids[1], job_ids[2], "micrographs", "micrographs"),
]
for f, t, fp, tp in edge_specs:
    r = api("/api/edges", "POST", {"fromJobId": f, "toJobId": t, "fromPort": fp, "toPort": tp})
    print("edge:", r["edge"]["id"])

print(json.dumps({"projectId": pid, "workspaceId": wid, "jobIds": job_ids}))
