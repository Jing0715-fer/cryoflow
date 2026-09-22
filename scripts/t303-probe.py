#!/usr/bin/env python3
"""t303 probe: plant a slurm-mode witness record (slurmId from argv[1]) and poll the sweep."""
import json, sys, time, urllib.request

ROOT = "/home/z/my-project"
STATE = f"{ROOT}/data/engine-state.json"
BASE = "http://localhost:3000"
SH = {"Origin": BASE, "Content-Type": "application/json"}

def api(path, method="GET", body=None):
    req = urllib.request.Request(BASE + path, method=method,
                                 data=json.dumps(body).encode() if body else None,
                                 headers=SH)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode() or "{}")

slurm_id = sys.argv[1] if len(sys.argv) > 1 else "16"
# the connection must EXIST in the registry (the sweep resolves it) — create
# probeless, delete after
api("/api/remote/connections", "POST", {
    "id": "t303probe-conn", "name": "t303 probe", "host": "127.0.0.1", "port": 3022,
    "username": "cryo", "password": "demo", "authMethod": "password",
    "remoteRoot": "/projects/cryoflow",
})
print("probeless connection created")
job = api("/api/jobs", "POST", {"type": "import", "name": "t303 probe LEDGER", "x": 90, "y": 90})["job"]
jid = job["id"]
print(f"job row: {jid}")

import subprocess
subprocess.run(["node", "-e",
    f"const {{PrismaClient}}=require('@prisma/client');const p=new PrismaClient();"
    f"p.job.update({{where:{{id:'{jid}'}},data:{{status:'running',progress:5,startedAt:new Date()}}}})"
    f".then(()=>p.$disconnect())"], cwd=ROOT, check=True, capture_output=True)

d = json.load(open(STATE))
d[jid] = {
    "jobId": jid, "projectId": "cmu6xtvf70000kl81kxtzbpl4", "type": "import",
    "pid": None, "cmd": "t303 probe",
    "workdir": f"{ROOT}/data/relion/t303probe/wd-1",
    "logFile": f"{ROOT}/data/relion/t303probe/wd-1/run.out",
    "errFile": f"{ROOT}/data/relion/t303probe/wd-1/run.err",
    "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(time.time() - 600)),
    "done": False,
    "remote": {
        "connectionId": "t303probe-conn", "connectionName": "t303 probe",
        "host": "127.0.0.1:3022", "user": "cryo", "module": "", "mode": "slurm",
        "remoteRoot": "/projects/cryoflow",
        "remoteWorkdir": "/projects/cryoflow/t303probe/wd-1",
        "pid": None, "slurmId": slurm_id, "phase": "running",
    },
}
json.dump(d, open(STATE, "w"), indent=2)
print(f"planted {jid} slurmId={slurm_id}")

for i in range(30):
    time.sleep(2)
    jobs = api("/api/jobs")["jobs"]
    row = next((j for j in jobs if j["id"] == jid), None)
    if row and row["status"] != "running":
        print(f"row verdict after ~{(i+1)*2}s: {row['status']} | result: {str(row.get('result'))[:90]}")
        break
else:
    print("row still running after 60s")

d = json.load(open(STATE))
rec = d.get(jid, {})
r = rec.get("remote", {})
print(f"record: done={rec.get('done')} exitCode={rec.get('exitCode')} slurmState={r.get('slurmState')} "
      f"slurmElapsedMs={r.get('slurmElapsedMs')} slurmMaxRssBytes={r.get('slurmMaxRssBytes')}")

# cleanup: record first (t272 order law), then the row, then the connection
d = json.load(open(STATE))
d.pop(jid, None)
json.dump(d, open(STATE, "w"), indent=2)
api(f"/api/jobs/{jid}", "DELETE")
try:
    api("/api/remote/connections/t303probe-conn", "DELETE")
except Exception:
    pass
print("cleaned up")
