#!/usr/bin/env python3
"""t628 — the workdir fossil census (READ-ONLY instrument, zero deletion).

The t628 audit convicted a quiet leak: the jobs POST route assigns every
create to the ACTIVE project (the request's projectId is ignored), and the
DELETE route cascades DB rows + edges but leaves the job's workdir on disk
and — worse — every HISTORICAL deletion did the same. Tonight's census:
112 unregistered workdirs under EMPIAR, 292 under the demo project —
hundreds of directories the engine-state registry no longer names.

This script is the cleanup lane's CAMERA, not its shovel: it inventories
every workdir under data/relion/<projectId>/ whose id suffix no
engine-state entry answers to, and for each reports
  - the on-disk bytes (du-style sum of the tree)
  - the newest mtime inside (age of the youngest file)
  - TENANT SIGNALS: files that look like another feature's property
    (t161's cleanup-radius doctrine lives in qa_lib.py — a workdir hosting
    tenants must never be blanket-deleted; the future shovel must honor
    the radius per directory)
  - whether a like-named job row still exists (suffix match against the DB
    — a registered job whose entry was popped is a DIFFERENT disease)

Output: a per-project JSON report + a console summary. Exit 0 always —
a census never fails the world it measures.

Run: python3 scripts/census-workdir-fossils.py [--json PATH]
"""
import json
import os
import sys
import time

BASE = "/home/z/my-project"
RELION = os.path.join(BASE, "data", "relion")
STATE = os.path.join(BASE, "data", "engine-state.json")

# t161 tenant signals — filenames another feature owns. A workdir holding
# any of these needs the radius honored (the entry pop / dir removal must
# be adjudicated with the tenant's owner suite, not blanket-deleted).
TENANT_SIGNALS = {
    "orthovol.mrc",           # qa67-seed-volume.py
    "_fixtures",              # fixture trees (dir)
    ".cf-remote-manifest.json",  # remote outputs ledger (t367/t626 family)
}


def load_state():
    try:
        with open(STATE) as f:
            state = json.load(f)
    except Exception:
        return {}
    return state if isinstance(state, dict) else {}


def dir_stats(path):
    total = 0
    newest = 0
    tenants = []
    files = 0
    for root, _dirs, names in os.walk(path):
        for n in names:
            p = os.path.join(root, n)
            try:
                st = os.stat(p)
            except OSError:
                continue
            total += st.st_size
            files += 1
            newest = max(newest, st.st_mtime)
            if n in TENANT_SIGNALS:
                tenants.append(os.path.relpath(p, path))
    return {"bytes": total, "files": files, "newest_mtime": newest, "tenants": tenants}


def main():
    json_out = None
    if "--json" in sys.argv:
        json_out = sys.argv[sys.argv.index("--json") + 1]
    state = load_state()
    reg_ids = set(state.keys())
    report = {}
    grand_bytes = 0
    grand_dirs = 0
    for proj in sorted(os.listdir(RELION) if os.path.isdir(RELION) else []):
        base = os.path.join(RELION, proj)
        if not os.path.isdir(base):
            continue
        fossils = []
        for d in sorted(os.listdir(base)):
            wdir = os.path.join(base, d)
            if not os.path.isdir(wdir):
                continue
            suffix = d.split("_", 1)[-1] if "_" in d else d
            if suffix == "_fixtures" or d == "_fixtures":
                continue  # fixture tree, not a job workdir
            if any(rid.endswith(suffix) for rid in reg_ids):
                continue  # registered — alive or at least named by the ledger
            st = dir_stats(wdir)
            st["dir"] = d
            st["age_days"] = round((time.time() - st["newest_mtime"]) / 86400, 1) if st["newest_mtime"] else None
            fossils.append(st)
        proj_bytes = sum(f["bytes"] for f in fossils)
        grand_bytes += proj_bytes
        grand_dirs += len(fossils)
        report[proj] = {
            "fossil_dirs": len(fossils),
            "bytes": proj_bytes,
            "with_tenants": sum(1 for f in fossils if f["tenants"]),
            "entries": fossils,
        }
        print(
            f"{proj[-6:]}: {len(fossils)} fossil dirs, "
            f"{proj_bytes / 1024 / 1024:.1f} MiB, "
            f"{report[proj]['with_tenants']} host tenant signals"
        )
    print(f"TOTAL: {grand_dirs} fossil dirs, {grand_bytes / 1024 / 1024:.1f} MiB across all projects")
    if json_out:
        with open(json_out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"report: {json_out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
