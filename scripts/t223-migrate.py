#!/usr/bin/env python3
"""t223 probe migration — 4 wire assertions learn the Shape column.

t222's lesson enforced: batch patches are followed by per-file syntax
checks (node --check) and the first live probe run. The edits are done
by BYTE extraction (rendered tool output swallows bracket-dense code —
the t221 lesson, third time on the record), never by retyping long
strings from the display.
"""
import re, sys, pathlib

def patch(path, subs):
    p = pathlib.Path(path)
    src = p.read_text(encoding="utf-8")
    orig = src
    for pat, rep, tag in subs:
        new, n = re.subn(pat, rep, src, flags=re.S)
        if n != 1:
            print(f"FAIL {path} [{tag}]: {n} matches (expected 1)")
            return False
        src = new
        print(f"  ok {path} [{tag}]")
    if src != orig:
        p.write_text(src, encoding="utf-8")
    return True

# --- t215: D7/D8 learn the eighth cell (empty text — a picture speaks not)
ok = patch("scripts/t215-e2e.mjs", [
    (r"must\(JSON\.stringify\(cellsW\) === JSON\.stringify\(\[host\.name, \"orthovol\", \"4\", peakH, \"\+0\.0\", rWinner, wWinner\]\), `D7 ([^`]*)`\);",
     'must(cellsW.length === 8 && cellsW[7] === "" && JSON.stringify(cellsW.slice(0, 7)) === JSON.stringify([host.name, "orthovol", "4", peakH, "+0.0", rWinner, wWinner]), `D7 \\1 — plus the wire\'s eighth cell, a PICTURE whose text is empty (t223)`);',
     "D7"),
    (r"must\(JSON\.stringify\(cellsS\) === JSON\.stringify\(\[second\.name, \"orthovol\", \"1\", peakS, deltaS, rSecond, wSecond\]\), `D8 ([^`]*)`\);",
     'must(cellsS.length === 8 && cellsS[7] === "" && JSON.stringify(cellsS.slice(0, 7)) === JSON.stringify([second.name, "orthovol", "1", peakS, deltaS, rSecond, wSecond]), `D8 \\1 — plus the empty picture cell (t223)`);',
     "D8"),
])

# --- t221: R1 head octet + R6 Weakest is no longer last-child
ok2 = patch("scripts/t221-e2e.mjs", [
    (r"must\(JSON\.stringify\(headCells\) === JSON\.stringify\(\[\"Job\", \"Main map\", \"Volumes\", \"Peak\", \"Δ winner\", \"Agreement r\", \"Weakest\"\]\),\n  `R1 ([^`]*)`\);",
     'must(JSON.stringify(headCells) === JSON.stringify(["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest", "Shape"]),\n  `R1 \\1 — plus the wire\'s Shape, the picture column (t223: RENDERED, never written)`);',
     "R1"),
    (r'const wCells = \(await page\.locator\("\[data-report-body\] tr\[data-owner-door\] td:last-child"\)\.allTextContents\(\)\)\.map\(\(c\) => c\.trim\(\)\);',
     'const wCells = (await page.locator("[data-report-body] tr[data-owner-door] td:nth-child(7)").allTextContents()).map((c) => c.trim()); // t223: Weakest is column 7 — the wire\'s eighth cell is the picture',
     "R6"),
])

sys.exit(0 if (ok and ok2) else 1)
