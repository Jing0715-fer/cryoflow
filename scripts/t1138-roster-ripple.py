#!/usr/bin/env python3
"""t1138 ripple — the roster's count pins re-keyed 34/35/37 -> 38.

The 名册涟漪 precedent's shape: when a tool is born, EVERY family pin on
the shelf count re-keys with the birth's provenance named. The debt this
window pays accumulated over four births (t1054's get_fleet_ledger,
t1059's get_fleet_memory, t1087's get_cleanup_history — whose window
cured t503's pin but left these — and t1138's refresh_cluster_twin).

The machine asserts re-key; the message words update their count AND
their stale story ("t530's diagnostics read is the newest birth" is a
lie the moment a newer birth lands) — each replaced by the true roster
word. t479's assert has a NEGATIVE band (no bury/clear/forget verb) that
must survive untouched: only the count literal moves.
"""
import re
import glob

ROSTER_WORD = (
    "t1054's get_fleet_ledger, t1059's get_fleet_memory, "
    "t1087's get_cleanup_history (that window cured t503's pin but left "
    "this one), t1138's refresh_cluster_twin the newest"
)

changed = []
for f in sorted(glob.glob("scripts/t4*.ts") + glob.glob("scripts/t5*.ts")):
    src = open(f).read()
    orig = src

    # machine asserts: any stale count literal re-keys to 38
    src = re.sub(r"AI_TOOLS\.length === \d+", "AI_TOOLS.length === 38", src)
    src = re.sub(
        r"(new Set\(AI_TOOLS\.map\(\(t\) => t\.name\)\)\.size === )\d+",
        r"\g<1>38",
        src,
    )

    # message words: stale counts + stale stories -> the true roster word
    src = src.replace(
        "`F8: 34 unique tools (got ${AI_TOOLS.length})`",
        f"`F8: 38 unique tools — the births since this pin's 34: {ROSTER_WORD} (got ${{AI_TOOLS.length}})`",
    )
    src = src.replace(
        "34 unique tools — t530's diagnostics read is the newest birth "
        "(t530 count-debt, caught by the t547 family run)",
        f"38 unique tools — the births since this pin's 34: {ROSTER_WORD}",
    )
    src = src.replace(
        "35 unique tools — t530's diagnostics read is the newest birth "
        "(t530 count-debt, caught by the t547 family run)",
        f"38 unique tools — the births since this pin's 34/35: {ROSTER_WORD}",
    )
    src = re.sub(
        r"(\d+) unique tools( —)? t530's diagnostics read is the newest birth[^`)\"]*",
        f"38 unique tools — the births since this pin's 34: {ROSTER_WORD}",
        src,
    )
    src = src.replace(
        "AI_TOOLS holds 34 tools — t530's diagnostics read is the newest birth "
        "(t530 count-debt, caught by the t547 family run)",
        f"AI_TOOLS holds 38 tools — the births since this pin's 34: {ROSTER_WORD}",
    )
    src = src.replace(
        "AI_TOOLS still holds 34 tools — t530's diagnostics read is the newest birth "
        "(t530 count-debt, caught by the t547 family run)",
        f"AI_TOOLS still holds 38 tools — the births since this pin's 34: {ROSTER_WORD}",
    )
    src = src.replace(
        "AI_TOOLS holds 37 tools — the cleanup family (get_cleanup_plan, "
        "cleanup_job_files, get_cleanup_history) is the newest birth since "
        "t530's diagnostics read (t503 ran outside the census and owed its "
        "count three tools — the honest re-key)",
        f"AI_TOOLS holds 38 tools — the births since this pin's 37: "
        f"t1138's refresh_cluster_twin the newest (t503's own cure was "
        f"t1087's; this birth re-keys the count honestly)",
    )
    src = re.sub(
        r"AI_TOOLS (still )?holds \d+ tools[^`\"]*",
        f"AI_TOOLS holds 38 tools — the births since this pin's 34: {ROSTER_WORD}",
        src,
    )
    src = re.sub(
        r"the roster holds \d+ tools(?! — the births since this pin's 34: t1054)",
        f"the roster holds 38 tools — the births since this pin's 34: {ROSTER_WORD}",
        src,
    )

    if src != orig:
        open(f, "w").write(src)
        changed.append(f)

for f in changed:
    print("re-keyed:", f)
print(f"{len(changed)} files")
