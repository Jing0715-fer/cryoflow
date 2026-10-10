#!/usr/bin/env python3
"""Resolve worklog.md rebase conflict: keep BOTH sides (t402b entry from HEAD + 409 entry from 422beff), ledger follows git order."""
import io

PATH = "/home/z/my-project/worklog.md"

with io.open(PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find conflict markers by content (robust against line drift)
start = end = mid = None
for i, ln in enumerate(lines):
    if ln.startswith("<<<<<<< HEAD"):
        start = i
    elif ln.startswith("=======") and start is not None and mid is None:
        mid = i
    elif ln.startswith(">>>>>>> 422beff") and start is not None:
        end = i
        break

assert start is not None and mid is not None and end is not None, (
    f"conflict markers not found: start={start} mid={mid} end={end}")

head_side = lines[start + 1 : mid]          # t402b entry
local_side = lines[mid + 1 : end]           # 409 in-progress entry

# Trim trailing blank lines of each side, rejoin with the ledger's '---' separator
while head_side and head_side[-1].strip() == "":
    head_side.pop()
while local_side and local_side[0].strip() == "":
    local_side.pop(0)

merged = head_side + ["\n", "---\n", "\n"] + local_side

new_lines = lines[:start] + merged + lines[end + 1 :]

with io.open(PATH, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print(f"resolved: kept t402b ({len(head_side)} lines) + 409 ({len(local_side)} lines) with --- separator")
print("remaining markers:", sum(1 for ln in new_lines if ln.startswith(("<<<<<<<", ">>>>>>>")) or ln.strip() == "======="))
