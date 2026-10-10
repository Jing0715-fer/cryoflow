#!/usr/bin/env python3
"""t410 — purge incomplete remote fixtures from engine-state.json.

A record whose remote lacks ANY of the RemoteRunInfo required four
(host/user/connectionName/remoteWorkdir) was not written by a real
dispatch — it is a QA fixture that outlived its suite (t294/t295 died
before their finally-restore). The run record itself (pid/cmd/workdir/
log ledger) stays; only the outlaw remote block is stripped.
"""
import json, shutil, sys

STATE = "/home/z/my-project/data/engine-state.json"
BACKUP = STATE + ".bak-t410"
REQUIRED = ("host", "user", "connectionName", "remoteWorkdir")

shutil.copy2(STATE, BACKUP)

state = json.load(open(STATE))
runs = state.get("runs", state)

purged = []
for jid, rec in runs.items():
    rem = (rec or {}).get("remote")
    if isinstance(rem, dict) and any(not rem.get(k) for k in REQUIRED):
        del rec["remote"]
        purged.append(jid)

json.dump(state, open(STATE, "w"), indent=1)
print(f"backup: {BACKUP}")
print(f"purged remote from {len(purged)} records:")
for j in purged:
    print("  -", j)
