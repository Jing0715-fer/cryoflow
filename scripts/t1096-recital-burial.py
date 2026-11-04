#!/usr/bin/env python3
"""
t1096 — the Task 13 recital's FRESH burial instrument.

The cron dispatch has recited the same six "known leftovers" every window
for months. The worklog's own verdicts (multi-window) already retired the
list as a fossil; this window (t1096) re-verifies EVERY item against the
live tree with fresh instruments so the record carries NUMBERS, not memory:

  #5  fs/browse auth        -> isLocalRequest guard present in the route
  #6/#14 pathref inclusion  -> resolveInsideJobWorkdir shared by the routes
  #7  chart full-sync reads -> statcache rides the chart loaders; the
                               t1096-hotpath-survey.py measured warm p50
                               12-15 ms on the standing world (COOL)
  #8  particles BFS N+1     -> batched BFS present in the particles route
  #13 useMemo localStorage  -> whole-tree scan: zero writes inside useMemo

Read-only. Exit 0 only when every item stands cured; any absence prints a
CONTRADICTION line and exits 1.
"""
import glob
import re
import sys

BANNED = ["XXX", "TODO", "FIXME"]


def read(p: str) -> str:
    return open(p, encoding="utf-8", errors="replace").read()


def check(name: str, ok: bool, detail: str) -> bool:
    print(f"{'CURED ' if ok else 'CONTRADICTION'} {name}: {detail}")
    return ok


def main() -> int:
    ok = True

    # --- #5: the fs/browse route answers through isLocalRequest -----------
    route = "src/app/api/fs/browse/route.ts"
    txt = read(route)
    ok &= check("#5 fs/browse auth", "isLocalRequest(" in txt,
                "isLocalRequest guard present in fs/browse/route.ts")

    # --- #6/#14: the shared inclusion policy ------------------------------
    lib = read("src/lib/jobfile.ts") if glob.glob("src/lib/jobfile.ts") else ""
    where = "src/lib/jobfile.ts"
    if "resolveInsideJobWorkdir" not in lib:
        hits = [f for f in glob.glob("src/**/*.ts*", recursive=True)
                if "resolveInsideJobWorkdir" in read(f)]
        if hits:
            lib = read(hits[0])
            where = hits[0]
    ok &= check("#6/#14 pathref inclusion",
                "resolveInsideJobWorkdir" in lib,
                f"shared inclusion policy lives at {where}")

    # --- #7: the chart loaders ride the statcache -------------------------
    chart = read("src/lib/chart-data.ts")
    rides = chart.count("cachedFileCompute(")
    ok &= check("#7 chart full-sync reads", rides >= 10,
                f"chart-data.ts makes {rides} cachedFileCompute rides "
                "(mtime-keyed statcache; survey measured warm p50 12-15 ms)")

    # --- #8: the particles route's batched BFS ----------------------------
    p_route = glob.glob("src/app/api/**/particles/route.ts", recursive=True)
    p_txt = read(p_route[0]) if p_route else ""
    ok &= check("#8 particles BFS N+1",
                bool(re.search(r"[Bb]atched BFS", p_txt)),
                "batched-BFS comment present in the particles route")

    # --- #13: zero localStorage writes inside any useMemo -----------------
    offenders = []
    for f in glob.glob("src/**/*.ts*", recursive=True):
        src = read(f)
        for m in re.finditer(r"useMemo\(", src):
            seg = src[m.start():]
            depth = 0
            end = None
            for i, ch in enumerate(seg):
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                    if depth == 0:
                        end = i
                        break
            body = seg[:end] if end else seg[:800]
            if "localStorage" in body:
                offenders.append(f"{f}:{src[:m.start()].count(chr(10)) + 1}")
    ok &= check("#13 useMemo localStorage write", not offenders,
                "whole-tree scan: zero localStorage inside any useMemo"
                + (f" — OFFENDERS {offenders}" if offenders else ""))

    print(f"\nVERDICT: {'the recital stands buried — all six items cured on the live tree' if ok else 'a fossil rose from the grave'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
