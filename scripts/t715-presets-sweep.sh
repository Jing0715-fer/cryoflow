#!/usr/bin/env bash
# t715 — the presets-shelf activation verdict, pre-written.
#
# The t710 readers-sweep pattern applied to the t715 shelf: two probes
# (GET /api/param-presets, PUT /api/param-presets) x bare/Origin columns.
# Today (staged: the frozen bundle predates the route) BOTH columns
# answer 404 route-absence — the staged-perfect snapshot. On activation
# day (next build) the verdict is a diff read, no judgment call:
#   bare column  404 -> 403  (the door wakes; a blind probe is refused)
#   Origin column 404 -> 200 (GET) / 400 (PUT with no body — route-speak,
#                             not door-speak: the door let it through)
# The flip IS the verdict. PUT's Origin column asserting 400-and-not-403
# is deliberate: an empty body fails the parse gate AFTER the door, which
# proves BOTH layers in one column.
set -u
B="${B:-http://localhost:3000}"
pass=0; fail=0

staged() { # name expected_note bare origin
  local name="$1" note="$2" bare="$3" origin="$4"
  if [ "$bare" != "403" ] && [ "$origin" != "403" ]; then
    echo "  ok   $name  bare=$bare origin=$origin ($note — door dormant)"
    pass=$((pass+1))
  else
    echo "  FAIL $name  bare=$bare origin=$origin — 403 on the FROZEN bundle means the door jumped the staged lane"
    fail=$((fail+1))
  fi
}

echo "== t715 presets-shelf sweep — staged dual-column =="
bare_get=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$B/api/param-presets")
origin_get=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Origin: $B" "$B/api/param-presets")
staged "GET /api/param-presets" "route-absent" "$bare_get" "$origin_get"

bare_put=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X PUT "$B/api/param-presets")
origin_put=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X PUT -H "Origin: $B" "$B/api/param-presets")
staged "PUT /api/param-presets" "route-absent" "$bare_put" "$origin_put"

echo "== $pass ok / $fail fail =="
[ "$fail" -eq 0 ]
