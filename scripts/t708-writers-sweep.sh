#!/usr/bin/env bash
# t708 — the writers-batch sweep. Stateless probes only (invalid bodies /
# fake ids): zero state change in EITHER world. Today (doorless bundle) every
# row must be ROUTE-SPEAK (400/404/200) — a 403 here means the door went live
# EARLY or something else is wrong. After the build-day build, the bare
# column flips to 403 (door speaks first) while the Origin column keeps
# speaking route-speak. That flip IS the activation verdict.
B="http://localhost:3000"
probe() {
  local label="$1"; shift
  local bare_code origin_code
  bare_code=$(curl -s -o /dev/null -w "%{http_code}" "$@" 2>/dev/null)
  origin_code=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: ${B}" -H "Sec-Fetch-Site: same-origin" "$@" 2>/dev/null)
  printf "%-42s bare=%s  origin=%s\n" "$label" "$bare_code" "$origin_code"
}
echo "== t708 writers sweep — $(date -u +%H:%M:%SZ) =="
probe "POST /api/jobs (bad type)"        -X POST "$B/api/jobs" -H "Content-Type: application/json" -d '{"type":"__nope__"}'
probe "POST /api/edges (missing ids)"    -X POST "$B/api/edges" -H "Content-Type: application/json" -d '{}'
probe "PATCH /api/jobs/fake-id"          -X PATCH "$B/api/jobs/t708-fake-id" -H "Content-Type: application/json" -d '{}'
probe "DELETE /api/edges/fake-id"        -X DELETE "$B/api/edges/t708-fake-id"
probe "POST /api/jobs/layout (empty)"    -X POST "$B/api/jobs/layout" -H "Content-Type: application/json" -d '{}'
probe "POST /api/workspaces (bad name)"  -X POST "$B/api/workspaces" -H "Content-Type: application/json" -d '{"name":""}'
probe "PATCH /api/workspaces/fake-id"    -X PATCH "$B/api/workspaces/t708-fake-id" -H "Content-Type: application/json" -d '{"name":"x"}'
probe "DELETE /api/workspaces/fake-id"   -X DELETE "$B/api/workspaces/t708-fake-id"
probe "POST /api/workflow-import (empty)" -X POST "$B/api/workflow-import" -H "Content-Type: application/json" -d '{}'
probe "POST /api/pipeline-template (bad ov)" -X POST "$B/api/pipeline-template" -H "Content-Type: application/json" -d '{"overrides":{"symmetry":"__nope__"}}'
probe "POST /api/custom-template (empty)" -X POST "$B/api/custom-template" -H "Content-Type: application/json" -d '{}'
probe "PATCH /api/custom-template (no id)" -X PATCH "$B/api/custom-template" -H "Content-Type: application/json" -d '{"name":"x"}'
probe "PUT /api/custom-template (no id)"  -X PUT "$B/api/custom-template" -H "Content-Type: application/json" -d '{}'
probe "DELETE /api/custom-template (no q)" -X DELETE "$B/api/custom-template"
probe "POST /api/hpc/simulate (real)"     -X POST "$B/api/hpc/simulate" -H "Content-Type: application/json" -d '{}'
probe "POST subvolume-job fake-id (bad json)" -X POST "$B/api/jobs/t708-fake-id/outputs/subvolume-job" -H "Content-Type: application/json" -d 'not-json'
probe "POST /api/project (symmetry leg)"  -X POST "$B/api/project"
