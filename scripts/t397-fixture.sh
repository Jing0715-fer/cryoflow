#!/usr/bin/env bash
# t397 — live fixture: a completed refine3d on the mock cluster with REAL
# RELION root-level rounds (gold-standard naming per ml_optimiser.cpp), a
# complete round it024, the newest complete it025, and a torn it026.
set -euo pipefail
cd /home/z/cryoflow

PROJ="cmuiel2yy0000od0tsk2jmn8f"
JOBID="cmuiel2z9t397refine3dx"   # last 8 = efine3dx -> workdir suffix
JOB8="${JOBID: -8}"
FS="services/mock-cluster/fs"
WD="$FS/projects/cryoflow/$PROJ/refine3d_$JOB8"
CONNID="conn-mock-t397"

echo "workdir: $WD"
mkdir -p "$WD"

# --- gold-standard rounds (real RELION 5 naming, workdir ROOT) -------------
for it in 024 025; do
  : > "$WD/run_it${it}_optimiser.star"
  : > "$WD/run_it${it}_data.star"
  : > "$WD/run_it${it}_sampling.star"
  : > "$WD/run_it${it}_half1_model.star"
  : > "$WD/run_it${it}_half2_model.star"
  printf 'MRC' > "$WD/run_it${it}_half1_class001.mrc"
  printf 'MRC' > "$WD/run_it${it}_half2_class001.mrc"
done
# torn newest (flush died mid-write: optimiser without its siblings)
: > "$WD/run_it026_optimiser.star"
# the run's witnesses
: > "$WD/run.out"; : > "$WD/run.err"

# --- connection registry (MERGE — never clobber a real registry) -----------
python3 - "$CONNID" <<'PY'
import json, os, sys
conn_id = sys.argv[1]
entry = {
    "id": conn_id,
    "name": "Mock Cluster",
    "host": "127.0.0.1",
    "port": 3022,
    "username": "cryo",
    "authMethod": "password",
    "privateKeyPath": None,
    "passphrase": None,
    "password": "demo",
    "remoteRoot": "/projects/cryoflow",
    "defaultModule": "relion/5.0.1",
    "envLines": [],
    "useSlurm": False,
    "maxFileMb": 512,
    "maxTotalMb": 4096,
    "lastProbe": None,
}
try:
    existing = json.load(open("data/remote-connections.json"))
    if not isinstance(existing, list):
        existing = []
except Exception:
    existing = []
existing = [c for c in existing if c.get("id") != conn_id]
existing.append(entry)
json.dump(existing, open("data/remote-connections.json", "w"), indent=2)
print("connections:", [c["id"] for c in existing])
PY

# --- project remote binding ---------------------------------------------------
python3 - "$PROJ" "$CONNID" <<'PY'
import json, sys
proj, conn = sys.argv[1], sys.argv[2]
with open("data/projects.json") as f: doc = json.load(f)
doc["projects"][proj]["remote"] = {"connectionId": conn}
with open("data/projects.json", "w") as f: json.dump(doc, f, indent=2)
print("projects.json:", doc["projects"][proj])
PY

# --- job row -------------------------------------------------------------------
python3 - "$PROJ" "$JOBID" <<'PY'
import sqlite3, sys, time
proj, job = sys.argv[1], sys.argv[2]
con = sqlite3.connect("db/cryoflow.db")
cur = con.cursor()
cur.execute("DELETE FROM Job WHERE id=?", (job,))
# the first draft of this fixture wrote ISO-string datetimes (Prisma P2023
# poison — its findMany dies on the whole table); purge any residue
cur.execute("DELETE FROM Job WHERE id=?", ("cfixture01refine3dxx",))
cur.execute("DELETE FROM Job WHERE typeof(createdAt) != 'integer' OR typeof(updatedAt) != 'integer'")
now = int(time.time() * 1000)
ws = con.execute("SELECT id FROM Workspace ORDER BY createdAt LIMIT 1").fetchone()
cur.execute(
    "INSERT INTO Job (id, projectId, workspaceId, type, name, x, y, status, progress, params, result, startedAt, duration, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    (job, proj, ws[0] if ws else None, "refine3d", "Refine 3D t397", 600, 300, "completed", 1.0,
     "{}",
     "REAL: 3D refinement finished · 1234 particles", now - 3600000, 3600000, now - 7200000, now - 3600000))
con.commit()
print("job row:", cur.execute("SELECT id,status FROM Job WHERE id=?", (job,)).fetchone())
PY

# --- engine-state.json run record (remote lane, completed) --------------------
cat > data/engine-state.json <<EOF
{
  "$JOBID": {
    "jobId": "$JOBID",
    "projectId": "$PROJ",
    "type": "refine3d",
    "pid": null,
    "cmd": "relion_refine --continue ... --o /projects/cryoflow/$PROJ/refine3d_$JOB8/run",
    "workdir": "data/relion/$PROJ/refine3d_$JOB8",
    "logFile": "data/relion/$PROJ/refine3d_$JOB8/run.out",
    "errFile": "data/relion/$PROJ/refine3d_$JOB8/run.err",
    "startedAt": "2025-09-26T10:00:00.000Z",
    "outputs": {},
    "done": true,
    "exitCode": 0,
    "result": "REAL: 3D refinement finished",
    "remote": {
      "connectionId": "$CONNID",
      "connectionName": "Mock Cluster",
      "host": "127.0.0.1:3022",
      "user": "cryo",
      "module": "relion/5.0.1",
      "mode": "direct",
      "remoteRoot": "/projects/cryoflow",
      "remoteWorkdir": "/projects/cryoflow/$PROJ/refine3d_$JOB8",
      "pid": null,
      "slurmId": null
    }
  }
}
EOF
# local mirror dir so the UI's outputs walk doesn't complain
mkdir -p "data/relion/$PROJ/refine3d_$JOB8"

echo
echo "=== probe continue-sources:"
curl -s -H "Origin: http://localhost:3000" \
  "http://localhost:3000/api/jobs/$JOBID/continue-sources" | python3 -m json.tool
