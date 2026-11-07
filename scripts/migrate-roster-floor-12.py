#!/usr/bin/env python3
"""t619 — the roster floor's second migration: the 15-era floors become 12.

t618's hand-repair of t278/t279 named the pattern (roster-sentinel lines,
`>= 15` propped by store-orphan residue jobs the cold boots pruned) and
filed the ~94 dormant suites for a scripted codemod lane, citing the t408
precedent (migrate-roster-floor.py: scripted + verifiable). This is that
lane. The canonical world is now the 12-job sole-workspace EMPIAR ledger
(measured live this window: 12 jobs, 11 completed), so the floor contracts
migrate in TWO honest tiers:

  - total-roster floors    `>= 15` -> `>= 12`  (the t278/t618 precedent verbatim)
  - completed-count floors `>= 15` -> `>= 11`  (today's honest completed minimum:
                              12 jobs minus the 1 live card; a floor is the
                              world's minimum that holds TODAY, and 11 is
                              what the canonical world honestly supports)

EXPLICIT EXCLUSIONS (the script's honesty list):
  - t313-demo-chain-resurrect.mjs, qa-t531-old-world-seed.mjs: seed/restore
    TOOLS that build their own 15-node world — their `>= 15` pins describe
    the world THEY seed, and migrating them would make the tools lie about
    their own product.
  - t141-e2e.mjs (betaSec clock floor — seconds, not roster) and
    t291-ortho-hist-footer.mjs:265 (cyan-pixel column count): excluded
    automatically by the roster-word filter (roster/identity/intact/
    restored/healed) and the no-comment rule.
  - t278/t279 teaching comment lines: excluded by the same two filters.
  - `=== 15` pins everywhere (t599 wire counts, t507 timeline rows): NOT
    touched — t408 already floored the roster ones; what remains pins
    other worlds entirely.

Every migrated line must still mention a roster word; every remaining
`>= 15` after the run must be on the exclusion list (the script prints
the audit for both).
"""
import re
import sys
from pathlib import Path

REPO = Path("/home/z/my-project/scripts")

# a line migrates only if it carries a roster-word (the t408 precision
# filter, re-derived this window from all 125 live `>= 15` lines)
ROSTER_WORD = re.compile(r"roster|identity|intact|restored|healed", re.I)
CODE_15 = re.compile(r">=\s?15\b")
UNI_15 = re.compile(r"≥\s?15\b")

# seed/restore tools whose `>= 15` describes their OWN seeded world
TOOL_EXCLUDE = {
    "t313-demo-chain-resurrect.mjs",
    "qa-t531-old-world-seed.mjs",
}

# message-text phrases that also carry the old floor number; each is only
# applied to lines already proven to be roster sentinels
MSG_PHRASES_TOTAL = [
    ("identity 15", "identity 12"),
    ("identity (15)", "identity (12)"),
    ("canonical 15", "canonical 12"),
    ("restored to 15", "restored to 12"),
    ("still 15", "still 12"),
    ("roster 15", "roster 12"),
    ("at 15 jobs", "at 12 jobs"),
]
MSG_PHRASES_COMPLETED = [
    ("15 completed", "11 completed"),
]


def floor_val(line: str):
    """12 for total-roster floors, 11 for completed-count floors."""
    return 11 if "completed" in line else 12


def migrate_line(line: str):
    orig = line
    val = floor_val(line)
    line = CODE_15.sub(f">= {val}", line)
    line = UNI_15.sub(f"≥ {val}", line)
    for old, new in MSG_PHRASES_TOTAL:
        line = line.replace(old, new)
    if val == 11:
        for old, new in MSG_PHRASES_COMPLETED:
            line = line.replace(old, new)
    return line if line != orig else None


def main():
    dry = "--dry-run" in sys.argv
    changed_files, changed_lines = 0, 0
    skipped = []
    for p in sorted(REPO.glob("t*.mjs")) + sorted(REPO.glob("qa*.mjs")):
        if p.name in TOOL_EXCLUDE:
            continue
        text = p.read_text()
        lines = text.split("\n")
        out, touched = [], False
        for i, line in enumerate(lines):
            if CODE_15.search(line) or UNI_15.search(line):
                stripped = line.lstrip()
                if stripped.startswith("//") or not ROSTER_WORD.search(line):
                    skipped.append(f"{p.name}:{i+1} (filter: comment/no-roster-word)")
                    out.append(line)
                    continue
                new = migrate_line(line)
                if new is None:
                    out.append(line)
                    continue
                if dry:
                    print(f"DRY {p.name}:{i+1}\n  - {line.strip()}\n  + {new.strip()}")
                out.append(new)
                changed_lines += 1
                touched = True
            else:
                out.append(line)
        if touched:
            changed_files += 1
            if not dry:
                p.write_text("\n".join(out))
    mode = "DRY-RUN" if dry else "APPLIED"
    print(f"\n{mode}: {changed_files} files, {changed_lines} lines migrated")
    print(f"filter-skipped lines (left alone): {len(skipped)}")
    for s in skipped:
        print(f"  {s}")
    if not dry:
        print("\n== AUDIT: every `>= 15` / `≥ 15` still standing after the run ==")
    for p in sorted(REPO.glob("t*.mjs")) + sorted(REPO.glob("qa*.mjs")):
        for i, line in enumerate(p.read_text().split("\n")):
            if CODE_15.search(line) or UNI_15.search(line):
                tag = "EXCLUDED-TOOL" if p.name in TOOL_EXCLUDE else "CHECK"
                print(f"  [{tag}] {p.name}:{i+1}: {line.strip()[:110]}")


if __name__ == "__main__":
    main()
