#!/usr/bin/env python3
"""t204 — sync the front-wave roster oracle 26 -> 21.

The sandbox filesystem was RESET at 05:56 (the .next/dev appearance, the
BUILD_ID's disappearance and the zeroed db/custom.db are one event — the
restore-gallery rebuild then shipped 21 jobs: 3 demo + 11 skeleton +
2 qa58 + 5 qa60). The previous 26 carried five legacy jobs (4 idle +
1 failed per t182's census) that lived only in the old filesystem and
left no seeder behind — unrestorable. Per the t202 doctrine the front-
wave oracles follow the world, so every roster assertion moves 26 -> 21
and t182's census moves 16c/8i/1f/1r -> 16c/4i/0f/1r (21 = 16+4+0+1).
Scratch-world assertions (t182 B14's 3/1/2) are probe-built and stay.
"""
import re, sys

BASE = "/home/z/my-project/scripts/"

# (file, old, new, expected_count)
EDITS = [
    # --- pattern A: the S1/Z roster one-liner (12 probes) ---
    ("t188-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t191-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t194-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t194-e2e.mjs", " *   S — baseline world (roster 26, trio registry, 2 GPU racers)",
     " *   S — baseline world (roster 21, trio registry, 2 GPU racers)", 1),
    ("t187-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t181-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t186-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t189-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t184-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t184-e2e.mjs", " *   S  baseline world (roster 26, profiles reachable, expected root",
     " *   S  baseline world (roster 21, profiles reachable, expected root", 1),
    ("t190-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t180-e2e.mjs", 'must(roster0.length === 26, `S1 roster 26 jobs (${roster0.length})`);',
     'must(roster0.length === 21, `S1 roster 21 jobs (${roster0.length})`);', 1),
    ("t180-e2e.mjs", 'must((await roster()).length === 26, "B3 the rejected batch landed nothing (roster 26)");',
     'must((await roster()).length === 21, "B3 the rejected batch landed nothing (roster 21)");', 1),
    ("t180-e2e.mjs", 'must((await roster()).length === 26, "B6 diamond cleanup restores the roster");',
     'must((await roster()).length === 21, "B6 diamond cleanup restores the roster");', 1),
    ("t180-e2e.mjs", 'must((await roster()).length === 26, "B11 edge-test cleanup restores the roster");',
     'must((await roster()).length === 21, "B11 edge-test cleanup restores the roster");', 1),
    ("t180-e2e.mjs", 'must((await roster()).length === 26, "B20 shelf-test cleanup restores the roster");',
     'must((await roster()).length === 21, "B20 shelf-test cleanup restores the roster");', 1),
    ("t178-e2e.mjs", 'must(roster0.length === 26, `S1 roster 26 jobs (${roster0.length})`);',
     'must(roster0.length === 21, `S1 roster 21 jobs (${roster0.length})`);', 1),
    ("t179-e2e.mjs", 'must(roster0.length === 26, `S1 roster 26 jobs (${roster0.length})`);',
     'must(roster0.length === 21, `S1 roster 21 jobs (${roster0.length})`);', 1),
    ("t185-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t185-e2e.mjs", 'must(jobsZ.length === 26, `Z3 roster identity (${jobsZ.length})`);',
     'must(jobsZ.length === 21, `Z3 roster identity (${jobsZ.length})`);', 1),
    ("t185-e2e.mjs", " *   S  baseline world (roster 26, registry = built-in trio, no",
     " *   S  baseline world (roster 21, registry = built-in trio, no", 1),
    # --- the front waves of THIS round (t202/t203) ---
    ("t202-e2e.mjs", 'must(roster1.length === roster0.length && roster1.length === 26, `Z1 roster identity (${roster1.length} == ${roster0.length}, canonical 26)`);',
     'must(roster1.length === roster0.length && roster1.length === 21, `Z1 roster identity (${roster1.length} == ${roster0.length}, canonical 21)`);', 1),
    ("t203-e2e.mjs", 'must(roster1.length === roster0.length && roster1.length === 26, `Z1 roster identity (${roster1.length}, canonical 26)`);',
     'must(roster1.length === roster0.length && roster1.length === 21, `Z1 roster identity (${roster1.length}, canonical 21)`);', 1),
    # --- t182: the clone census's own dialect ---
    ("t182-e2e.mjs", " *            pinned against the canonical source's REAL 16c/8i/1f/1r",
     " *            pinned against the canonical source's REAL 16c/4i/0f/1r", 1),
    ("t182-e2e.mjs", " * every clone deleted, canonical 26 untouched, feed wire still numeric.",
     " * every clone deleted, canonical 21 untouched, feed wire still numeric.", 1),
    ("t182-e2e.mjs", 'must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);',
     'must(jobs0.length === 21, `S1 roster 21 jobs (${jobs0.length})`);', 1),
    ("t182-e2e.mjs", "byStatus2.completed === 16 && byStatus2.idle === 8 && byStatus2.failed === 1 && byStatus2.running === 1,",
     "byStatus2.completed === 16 && byStatus2.idle === 4 && byStatus2.failed === 0 && byStatus2.running === 1,", 1),
    ("t182-e2e.mjs", '`S2 canonical census 16c/8i/1f/1r (${JSON.stringify(byStatus2)})`',
     '`S2 canonical census 16c/4i/0f/1r (${JSON.stringify(byStatus2)})`', 1),
    ("t182-e2e.mjs", 'must(SOURCE.stats?.total === 26, `S4 project stats carry 26 total (${SOURCE.stats?.total})`);',
     'must(SOURCE.stats?.total === 21, `S4 project stats carry 21 total (${SOURCE.stats?.total})`);', 1),
    ("t182-e2e.mjs", 'must(cnt?.jobs === 26 && cnt?.edges === 16 && cnt?.workspaces === 2,',
     'must(cnt?.jobs === 21 && cnt?.edges === 15 && cnt?.workspaces === 1,', 1),
    ("t182-e2e.mjs", 'must(cloneList.length === 26, `B5 clone roster 26 (${cloneList.length})`);',
     'must(cloneList.length === 21, `B5 clone roster 21 (${cloneList.length})`);', 1),
    ("t182-e2e.mjs", 'must(paramsMatch && sourceByName.size === 26, "B9 params carried field-for-field (26/26)");',
     'must(paramsMatch && sourceByName.size === 21, "B9 params carried field-for-field (21/21)");', 1),
    ("t182-e2e.mjs", "// the canonical 26 stays read-only here). NOTE: POST /api/projects seeds",
     "// the canonical 21 stays read-only here). NOTE: POST /api/projects seeds", 1),
    ("t182-e2e.mjs", 'must(!!cloneRow && cloneRow.stats?.total === 26, "B25 clone visible in the project list with 26 total");',
     'must(!!cloneRow && cloneRow.stats?.total === 21, "B25 clone visible in the project list with 21 total");', 1),
    ("t182-e2e.mjs", 'must(jobsZ.length === 26, `Z2 roster 26 (${jobsZ.length})`);',
     'must(jobsZ.length === 21, `Z2 roster 21 (${jobsZ.length})`);', 1),
    ("t182-e2e.mjs", '`Z3 census intact 16c/8i/1f/1r (${JSON.stringify(zStatus)})`',
     '`Z3 census intact 16c/4i/0f/1r (${JSON.stringify(zStatus)})`', 1),
]

failed = []
for fname, old, new, want in EDITS:
    path = BASE + fname
    src = open(path, encoding="utf-8").read()
    n = src.count(old)
    if n != want:
        failed.append(f"{fname}: expected {want}x, found {n}x: {old[:60]}...")
        continue
    open(path, "w", encoding="utf-8").write(src.replace(old, new))

if failed:
    print("FAILED:")
    for f in failed:
        print(" -", f)
    sys.exit(1)
print(f"OK — {len(EDITS)} replacements across {len(set(e[0] for e in EDITS))} files")
