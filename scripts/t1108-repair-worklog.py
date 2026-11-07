#!/usr/bin/env python3
"""t1108 repair: the MultiEdit anchor matched twice and spliced the Task 1108
entry. This script reassembles the entry in the intended order:
  Work Log: window start -> QA -> source reading -> THE RIDE (beats) ->
  WORLD CORRECTED -> BUILD DAY -> Verification chain -> as-left ->
  Stage Summary -> candidates -> receipts -> WORLD NOTE.
Also removes the leaked tool-note strings ("Review the changes ...")."""

from pathlib import Path

P = Path("/home/z/my-project/worklog.md")
s = P.read_text(encoding="utf-8")

# 1. Remove every leaked tool note.
NOTE = "Review the changes and make sure they are as expected. Edit the file again if necessary."
leaks = s.count(NOTE)
s = s.replace(NOTE, "")
print(f"tool notes removed: {leaks}")

# 2. Locate the splice: the source-reading line's tail was replaced by the
# verification-chain + Stage Summary + WORLD NOTE block.
SRC = "the plural quiets to the SINGULAR about the survivor; "
i = s.index(SRC)
j = s.index("- **THE RIDE — the birth, the file, the drill, the quiet")
misplaced = s[i + len(SRC):j]  # "- **Verification chain**..." .. WORLD NOTE end + "\n"
assert misplaced.startswith("- **Verification chain**"), misplaced[:60]
assert "THE WORLD NOTE (as-left)" in misplaced
assert "Stage Summary:" in misplaced
print(f"misplaced block: {len(misplaced)} chars, starts ok")

# 3. Heal the source-reading line and keep the RIDE block where it belongs.
RESTORED = (
    "at M11 the survivor lands the edge → the paragraph quiets entirely → 498; "
    "at M12 the purest flat**.\n"
)
s = s[:i] + SRC + RESTORED + s[j:]

# 4. Append the misplaced block at the entry's end (the file currently ends
# with the BUILD DAY paragraph — the Work Log's last bullet).
s = s.rstrip("\n") + "\n" + misplaced.strip() + "\n"

# 5. Sanity: the entry's internal order.
k_ride = s.index("- **THE RIDE — the birth")
k_build = s.index("- **THE BUILD DAY'S HONEST RUN")
k_ver = s.index("- **Verification chain**: t1052 **25/25**; t1053 **241/241**")
k_stage = s.index("Stage Summary:", k_ver)
k_world = s.index("THE WORLD NOTE (as-left)", k_stage)
assert k_ride < k_build < k_ver < k_stage < k_world, "order broken"
print("order ok: RIDE < BUILD DAY < Verification < Stage Summary < WORLD NOTE")

P.write_text(s, encoding="utf-8")
print(f"written: {len(s)} chars, {s.count(chr(10))} lines")
