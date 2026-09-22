"""One-off fixup for worklog.md after the Task 283 window:
1. drop the stale in-progress bullets dangling at the tail
2. restore the "[min,max]" text the bash-heredoc path mangled ("in,max]")
"""
import re

P = "/home/z/my-project/worklog.md"
s = open(P, encoding="utf-8").read()

# 1) the final section ends with the leftovers line mentioning Topaz; cut
#    everything after the LAST such leftovers line's paragraph end
end_marker = "产品功能候选：Topaz wrapper 深化"
idx = s.rfind(end_marker)
assert idx != -1, "final section leftovers line not found"
tail = s[idx + len(end_marker):]
# keep only whitespace-type trailing newlines from the marker onward
s = s[: idx + len(end_marker)] + "\n"

# 2) restore the mangled "[min,max]" (both directions it appears in)
bad = "已知 in,max]"
good = "已知 \x5bmin,max\x5d"
n1 = s.count(bad)
s = s.replace(bad, good)
bad2 = "已知 in,max\x5d 上分箱"
good2 = "已知 \x5bmin,max\x5d 上分箱"
n2 = s.count(bad2)
s = s.replace(bad2, good2)

open(P, "w", encoding="utf-8").write(s)
print(f"trailing stale bullets removed; fixed {n1} mangled range text(s), {n2} legacy variant")
print("tail now ends with:", repr(s[-80:]))
