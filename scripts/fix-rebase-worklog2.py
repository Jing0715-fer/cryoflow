#!/usr/bin/env python3
"""Resolve ec57f6a conflict: keep HEAD side (t402b + 409 context) but take ec57f6a's completed header line for Task 409."""
import io

PATH = "/home/z/my-project/worklog.md"
with io.open(PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

start = end = mid = None
for i, ln in enumerate(lines):
    if ln.startswith("<<<<<<< HEAD"):
        start = i
    elif ln.startswith("=======") and start is not None and mid is None:
        mid = i
    elif ln.startswith(">>>>>>> ec57f6a") and start is not None:
        end = i
        break
assert start is not None and mid is not None and end is not None

head_side = lines[start + 1 : mid]   # t402b entry + --- + 409 in-progress header
local_side = lines[mid + 1 : end]    # 409 completed header (single line)

# Replace the last line of HEAD side (409 in-progress header) with the completed header
assert head_side[-1].startswith("Task ID: 409 (进行时"), head_side[-1][:60]
head_side[-1] = local_side[0]

new_lines = lines[:start] + head_side + lines[end + 1 :]
with io.open(PATH, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

leftover = sum(1 for ln in new_lines if ln.startswith(("<<<<<<<", ">>>>>>>")) or ln.strip() == "=======")
print(f"resolved: 409 header -> completed; leftover markers = {leftover}")
