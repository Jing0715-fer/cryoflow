#!/usr/bin/env python3
"""Task 218 — the fossil GC: quarantine, don't vaporize.

Background (t217's autopsy): the L2 job-wipe drill rebuilt every Job with a
BRAND-NEW id. The old ids' engine-state entries and their workdirs survived
as UNCLAIMED FOSSILS — reachable by nothing, trusted by nothing, but still
on disk and still inside engine-state.json (37 entries for 21 live jobs).
The cleanup-radius protocol (Task 161) only lets a seeder remove what IT
seeded; a GC that reaches across workdirs needs its own doctrine, so this
tool adds the QUARANTINE clause: nothing is ever deleted outright —
dead entries leave engine-state, orphan workdirs MOVE into a timestamped
quarantine under .qa-logs/. Every GC run is therefore reversible by hand:
put the directory back, re-merge the backup json.

What it collects:
  1. DEAD engine-state entries — jobId no longer in the live roster.
  2. ORPHAN workdirs — data/relion/<project>/<type>_<id8> whose id8 tail
     matches no live job (the engine-state workdir grammar, section 161).

What it refuses to touch:
  - anything whose id8 tail belongs to a LIVE job (even if the entry looks
    stale — the DB roster is the only source of truth);
  - anything NOT under data/relion/<project>/ (no glob escapes upward);
  - the quarantine itself (no recursive self-collection).

t871 — the roster truth moved UP one layer: the old reader judged "dead"
against /api/jobs, which is ACTIVE-POINTER-SCOPED (the old-world manifest's
own warning: it "lies when another world is active"). Every restore that
re-seeds a NON-active project (t521's Tutorial fixtures) re-added its state
entries and the camera immediately slandered them as dead — and one
`--apply` away lay a live project's state. The judge is now the DB roster
(ALL projects, the same table the jobs sweep reads); the API read stays
only as a fallback when the DB file is absent. Same asymmetry fixed in the
dir scan: a non-active project's workdirs are now enumerated too (they
were invisible before, an orphan-blind spot), while the _fixtures/
micrographs seed-property blessing (t869) rides unchanged.

Usage:
  python3 scripts/gc-orphans.py            # dry-run: print, touch nothing
  python3 scripts/gc-orphans.py --apply    # quarantine + prune (reversible)
"""
import json
import os
import shutil
import sqlite3
import sys
import time
import urllib.request

BASE = "http://localhost:3000"
PROJECT_ROOT = "/home/z/my-project/data/relion"
STATE_PATH = "/home/z/my-project/data/engine-state.json"
QUARANTINE = "/home/z/my-project/.qa-logs/gc-quarantine"
# t377's law, applied to the tools: the shell env's DATABASE_URL is the
# tool sandbox's TEMPLATE (custom.db) — hard-pin the canonical world db.
DB_PATH = "/home/z/my-project/db/cryoflow.db"


def http_json(path):
    req = urllib.request.Request(
        BASE + path, headers={"Origin": BASE, "sec-fetch-site": "same-origin"}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def db_roster():
    """ALL jobs across ALL projects, straight from the world's own table.

    Returns ({id: projectId} mapping, sorted) — the same ids/tails the
    engine-state entries and workdir tails must answer to, without the
    active pointer's scoping. Falls back to the scoped /api/jobs view
    ONLY if the DB file is absent (an honest downgrade, printed).
    """
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH)
        try:
            rows = conn.execute("SELECT id, projectId FROM Job").fetchall()
        finally:
            conn.close()
        return {jid: pid for jid, pid in rows}, "db"
    live = http_json("/api/jobs")["jobs"]
    print("  (note: DB roster absent — fell back to the ACTIVE-SCOPED api view;")
    print("   non-active projects' entries will read dead — re-run on the db world)")
    return {j["id"]: j["projectId"] for j in live}, "api"


def main():
    apply_mode = "--apply" in sys.argv
    roster, roster_src = db_roster()
    live_ids = set(roster)
    live_tails = {jid[-8:] for jid in live_ids}
    projects = set(roster.values())
    print(f"  roster source: {roster_src} ({len(live_ids)} jobs, "
          f"{len(projects)} projects)")

    state = {}
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH) as f:
            state = json.load(f)

    dead_entries = {jid: e for jid, e in state.items() if jid not in live_ids}

    orphan_dirs = []
    for proj in sorted(os.listdir(PROJECT_ROOT)):
        pdir = os.path.join(PROJECT_ROOT, proj)
        if not os.path.isdir(pdir) or proj not in projects:
            continue  # never enumerate projects the roster doesn't speak of
        for d in sorted(os.listdir(pdir)):
            full = os.path.join(pdir, d)
            if not os.path.isdir(full) or "_" not in d:
                continue
            # t869 — the seed's own property is not a workdir: _fixtures is
            # the seed plan's fixture tree (the t532 map-inventory law reads
            # class00N.mrc from it) and micrographs is the seed's EMPIAR
            # hard-link source. Neither answers to the <type>_<id8> grammar
            # and neither is a fossil.
            if d in ("_fixtures", "micrographs"):
                continue
            tail = d.rsplit("_", 1)[-1]
            if tail not in live_tails:
                orphan_dirs.append(full)

    print(f"live jobs: {len(live_ids)} | engine-state entries: {len(state)} "
          f"| dead entries: {len(dead_entries)} | orphan workdirs: {len(orphan_dirs)}")
    for jid, e in sorted(dead_entries.items()):
        print(f"  [state-dead] {jid}  {e.get('workdir', '?')}")
    for d in orphan_dirs:
        print(f"  [dir-orphan] {d}")

    if not apply_mode:
        total = sum(
            os.path.getsize(os.path.join(r, f))
            for d in orphan_dirs for r, _, fs in os.walk(d) for f in fs
        )
        print(f"\ndry-run — nothing touched. reclaimable: ~{total // 1024} KiB "
              f"on disk, {len(dead_entries)} state entries.")
        return

    stamp = time.strftime("%Y%m%d-%H%M%S")
    qdir = os.path.join(QUARANTINE, stamp)
    os.makedirs(qdir, exist_ok=True)

    # 1. engine-state: back up the WHOLE file first, then prune.
    backup = os.path.join(qdir, "engine-state.backup.json")
    shutil.copy2(STATE_PATH, backup)
    kept = {jid: e for jid, e in state.items() if jid in live_ids}
    with open(STATE_PATH, "w") as f:
        json.dump(kept, f, indent=2)
    print(f"\nstate: {len(state)} -> {len(kept)} entries "
          f"(backup: {backup})")

    # 2. orphan workdirs: MOVE (never delete) into quarantine.
    moved = 0
    for d in orphan_dirs:
        dest = os.path.join(qdir, os.path.basename(d))
        shutil.move(d, dest)
        moved += 1
    print(f"workdirs: {moved} moved to {qdir}")
    print("quarantine is reversible by hand — restore a dir, re-merge the "
          "backup json. After probes stay green, the quarantine may be "
          "deleted wholesale.")


if __name__ == "__main__":
    main()
