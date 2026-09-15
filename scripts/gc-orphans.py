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
    stale — the live roster is the only source of truth);
  - anything NOT under data/relion/<project>/ (no glob escapes upward);
  - the quarantine itself (no recursive self-collection).

Usage:
  python3 scripts/gc-orphans.py            # dry-run: print, touch nothing
  python3 scripts/gc-orphans.py --apply    # quarantine + prune (reversible)
"""
import json
import os
import shutil
import sys
import time
import urllib.request

BASE = "http://localhost:3000"
PROJECT_ROOT = "/home/z/my-project/data/relion"
STATE_PATH = "/home/z/my-project/data/engine-state.json"
QUARANTINE = "/home/z/my-project/.qa-logs/gc-quarantine"


def http_json(path):
    req = urllib.request.Request(
        BASE + path, headers={"Origin": BASE, "sec-fetch-site": "same-origin"}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)


def main():
    apply_mode = "--apply" in sys.argv
    live = http_json("/api/jobs")["jobs"]
    live_ids = {j["id"] for j in live}
    live_tails = {j["id"][-8:] for j in live}
    projects = {j["projectId"] for j in live}

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
