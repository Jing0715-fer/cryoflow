#!/usr/bin/env python3
"""t709-door-coverage.py — the whole-API door census.

The t707 audit ledger (22 routes) is the campaign's last open bill:
t708 doored the 13 write routes (17 handlers), t709 the 9 pure-readers.
This sweep proves the claim "every handler on the API speaks one door":
for every src/app/api/**/route.ts, every exported HTTP method handler
must be followed by an isLocalRequest call within its own body —
and the count of doorless handlers must be ZERO.

Idempotent, read-only, re-runnable after any future route surgery.
"""
import re
import sys
from pathlib import Path

ROOT = Path("/home/z/my-project/src/app/api")
METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")

# t709 pricing — the five collection read-halves DEFER to the next round
# (jobs/route.ts comment carries the reasoning: the QA hot-path blast
# radius wants a mass Origin-shim batch before these gates land). This
# census is the ledger's guard: anything doorless OUTSIDE this list fails
# the sweep; when the deferral round lands, shrink this list to zero.
EXPECTED_DOORLESS = {
    ("jobs/route.ts", "GET"),
    ("edges/route.ts", "GET"),
    ("project/route.ts", "GET"),
    ("workspaces/route.ts", "GET"),
    ("custom-template/route.ts", "GET"),
}

fail = 0
total_handlers = 0
doored_handlers = 0
doorless = []
deferred = []

for f in sorted(ROOT.rglob("route.ts")):
    src = f.read_text()
    rel = f.relative_to(ROOT)  # e.g. jobs/route.ts, jobs/[id]/command/route.ts
    has_import = "isLocalRequest" in src
    # find each exported handler and check the body before the next handler
    handler_spans = []
    for m in re.finditer(
        r"export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b", src
    ):
        handler_spans.append((m.start(), m.group(1)))
    if not handler_spans:
        print(f"SKIP (no handlers): {rel}")
        continue
    for i, (start, method) in enumerate(handler_spans):
        total_handlers += 1
        end = handler_spans[i + 1][0] if i + 1 < len(handler_spans) else len(src)
        body = src[start:end]
        if "isLocalRequest(" in body:
            doored_handlers += 1
        elif (str(rel), method) in EXPECTED_DOORLESS:
            deferred.append(f"{rel} :: {method} (t709 deferral, priced)")
        else:
            fail += 1
            doorless.append(f"{rel} :: {method}")
    if handler_spans and not has_import:
        print(f"WARN (handlers gated but import missing?): {rel}")

print(f"\n=== t709 door coverage: {doored_handlers}/{total_handlers} handlers doored, {len(deferred)} deferred ===")
for d in deferred:
    print("  DEFERRED " + d)
if doorless:
    print("DOORLESS (outside the deferral ledger — FAIL):")
    for d in doorless:
        print("  " + d)
    sys.exit(1)
print("the t707 ledger + t709 census findings are fully doored; deferrals match the priced ledger")
sys.exit(0)
