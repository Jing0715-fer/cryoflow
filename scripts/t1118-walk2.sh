#!/usr/bin/env bash
# t1118 walk v2 — bisecting the in-script eval silence.
set -u
N="${1:-3}"
OUT="${2:-/tmp/t1118-walk2.jsonl}"
: > "$OUT"
for i in $(seq 1 "$N"); do
  agent-browser press Tab >/dev/null 2>&1
  sleep 1
  echo "--- stop $i" >> "$OUT"
  agent-browser eval "JSON.stringify({el:document.activeElement.tagName})" >> "$OUT" 2>&1
  echo "" >> "$OUT"
done
echo "done"
