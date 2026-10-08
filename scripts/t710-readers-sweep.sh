#!/usr/bin/env bash
# t710 — the five collection read-halves' activation verdict, pre-written.
#
# The t708 writers-sweep pattern applied to the t710 reader doors:
# five stateless GET probes x bare/Origin columns. Today (staged, frozen
# bundle without the doors) both columns answer route-speak 200 with
# IDENTICAL bodies and zero 403 — the staged-perfect snapshot. On
# activation day (next build) the verdict is a diff read, no judgment
# call: the bare column flips to 403 while the Origin column stays 200.
# The flip IS the verdict.
set -u
B="${B:-http://localhost:3000}"
pass=0; fail=0

probe() { # name path
  local name="$1" path="$2"
  local bare origin
  bare=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$B$path")
  origin=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Origin: $B" "$B$path")
  # staged expectation: bare==origin (both 200/4xx route-speak, zero 403)
  if [ "$bare" != "403" ] && [ "$origin" != "403" ]; then
    echo "  ok   $name  bare=$bare origin=$origin (route-speak, door dormant)"
    pass=$((pass+1))
  else
    echo "  FAIL $name  bare=$bare origin=$origin — 403 on the FROZEN bundle means the door jumped the staged lane"
    fail=$((fail+1))
  fi
}

echo "== t710 readers sweep — five collection GETs, staged dual-column =="
probe "GET /api/jobs (roster)"            "/api/jobs"
probe "GET /api/edges (active project)"   "/api/edges"
probe "GET /api/project (active)"         "/api/project"
probe "GET /api/workspaces (list)"        "/api/workspaces"
probe "GET /api/custom-template (list)"   "/api/custom-template"

echo "== $pass ok / $fail fail =="
[ "$fail" -eq 0 ]
