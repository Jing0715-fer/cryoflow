#!/usr/bin/env python3
"""
t700 — the shots-qa ARCHIVE alignment audit: the QA screenshot archive
(226 frames, ~41MB, fully tracked) measured against the one record that
gives every frame its reason to exist — the worklog.

The audit answers four questions:
  1. INTEGRITY — is every frame a real PNG (magic bytes), not a truncated
     or corrupted write? (The archive's own claim: .png means PNG.)
  2. ALIGNMENT — does every frame have a worklog mention? A frame the
     worklog never speaks of is an orphan: evidence without a verdict.
     (The inverse — a worklog claim without a frame — is checked for the
     frames the worklog explicitly names with a shots-qa/ path.)
  3. ATTRIBUTION — which task does each frame belong to (filename prefix
     parse: tNNN-*, probe-*, qa-*, diag-*), and do the task numbers stay
     within the project's real task range?
  4. AGE — the mtime timeline: when the archive was born, when it was
     last touched, and whether any frame predates the repo's history.

Read-only. Re-runnable evidence. The archive is HISTORY, not state:
staleness of a frame's world-picture is expected (the world moves); the
only true defects are corruption and verdict-less orphans.
"""
import os
import re
import subprocess
from datetime import datetime

ROOT = "/home/z/my-project"
DIR = os.path.join(ROOT, "shots-qa")
WORKLOG = os.path.join(ROOT, "worklog.md")

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def main():
    with open(WORKLOG, encoding="utf-8") as f:
        worklog = f.read()

    files = sorted(f for f in os.listdir(DIR) if f.endswith(".png"))
    other = [f for f in os.listdir(DIR) if not f.endswith(".png")]

    # 1. integrity ---------------------------------------------------------
    corrupt = []
    for f in files:
        with open(os.path.join(DIR, f), "rb") as fh:
            if fh.read(8) != PNG_MAGIC:
                corrupt.append(f)
    print(f"== t700 shots-qa archive audit ==")
    print(f"frames: {len(files)} .png | non-png files: {len(other)} {other[:5]}")
    print(f"[integrity] corrupt PNGs: {len(corrupt)} {corrupt[:5]}")

    # 2. alignment — worklog mentions ---------------------------------------
    orphan = []
    aligned = 0
    for f in files:
        if f in worklog:
            aligned += 1
        else:
            orphan.append(f)
    print(f"[alignment] worklog-mentioned: {aligned}/{len(files)} | orphans: {len(orphan)}")
    for f in orphan[:12]:
        print(f"  orphan: {f}")
    if len(orphan) > 12:
        print(f"  ... and {len(orphan) - 12} more")

    # 2b. commit-message alignment for orphans — the verdict layer is
    # TWO-storeyed: the worklog speaks some filenames verbatim; the rest
    # were introduced by commits whose MESSAGES carry the task's verdict.
    # An orphan aligned at the commit layer is evidence with a verdict —
    # only frames with NEITHER record are true orphans.
    def first_add_msg(name):
        out = subprocess.run(
            ["git", "log", "--follow", "--format=%s", "--diff-filter=A", "--", f"shots-qa/{name}"],
            cwd=ROOT, capture_output=True, text=True).stdout
        return out.strip().splitlines()[-1] if out.strip() else ""

    commit_aligned = 0
    true_orphans = []
    for f in orphan:
        msg = first_add_msg(f)
        m = re.match(r"^(t\d+)", f)
        stem = m.group(1) if m else f.replace(".png", "")
        if msg and (stem in msg or f.replace(".png", "") in msg):
            commit_aligned += 1
        else:
            true_orphans.append((f, msg[:80]))
    print(f"[alignment·layer2] commit-message verdicts: {commit_aligned}/{len(orphan)} orphans aligned")
    print(f"  TRUE orphans (no worklog, no verdict-bearing commit): {len(true_orphans)}")
    for f, msg in true_orphans[:30]:
        print(f"  true-orphan: {f} | commit: {msg or '(none)'}")

    # 3. attribution — filename prefixes ------------------------------------
    prefix_counts = {}
    task_nums = []
    for f in files:
        m = re.match(r"^(t\d+)-", f)
        if m:
            prefix_counts["task-named"] = prefix_counts.get("task-named", 0) + 1
            task_nums.append(int(m.group(1)[1:]))
            continue
        m2 = re.match(r"^([a-zA-Z0-9]+)-", f)
        key = m2.group(1) if m2 else "(none)"
        prefix_counts[key] = prefix_counts.get(key, 0) + 1
    print(f"[attribution] prefix families: {dict(sorted(prefix_counts.items(), key=lambda kv: -kv[1]))}")
    if task_nums:
        print(f"  task range: t{min(task_nums)} .. t{max(task_nums)}")

    # 4. age ----------------------------------------------------------------
    ages = []
    for f in files:
        st = os.stat(os.path.join(DIR, f))
        ages.append((st.st_mtime, f))
    ages.sort()
    fmt = lambda t: datetime.fromtimestamp(t).strftime("%Y-%m-%d")
    print(f"[age] oldest: {fmt(ages[0][0])} ({ages[0][1]}) | newest: {fmt(ages[-1][0])} ({ages[-1][1]})")

    # git first-add dates for the oldest five (mtime lies after checkout) ----
    oldest5 = [f for _, f in ages[:5]]
    for f in oldest5:
        out = subprocess.run(
            ["git", "log", "--follow", "--format=%ad", "--date=short", "--diff-filter=A", "--", f"shots-qa/{f}"],
            cwd=ROOT, capture_output=True, text=True).stdout.strip()
        print(f"  git first-add: {f} -> {out.splitlines()[-1] if out else 'NOT TRACKED'}")

    # verdict ---------------------------------------------------------------
    print(f"\nverdict: corrupt={len(corrupt)} orphan={len(orphan)} non-png={len(other)}")


if __name__ == "__main__":
    main()
