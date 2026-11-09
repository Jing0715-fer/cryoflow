#!/usr/bin/env bash
# t897 — the clobber watcher: every 2s, log the live registry's shape
# (mtime, size, total records, live-record count) to a CSV. The census's
# stale-writer disease (the ride at 20:22:32 and the second ride both
# reduced data/engine-state.json to the 15 fossil records, 0 live) gets
# ONE correlated receipt: the watcher's log line whose second flips is the
# clobber moment; the census's own stdout timeline (which seat was in
# flight) names the seat. Orphan-launched; kill by pattern
# 't897-clobber-watch'.
LOG=/home/z/my-project/.qa-logs/clobber-watch.csv
STATE=/home/z/my-project/data/engine-state.json
echo "ts,mtime,size,total,live_cmw2l,live_other" >> "$LOG"
while true; do
  if [ -f "$STATE" ]; then
    MT=$(stat -c '%Y' "$STATE")
    SZ=$(stat -c '%s' "$STATE")
    COUNTS=$(python3 - "$STATE" <<'PYEOF'
import json,sys
try:
    d=json.load(open(sys.argv[1]))
    ks=list(d.keys())
    live2l=sum(1 for k in ks if k.startswith('cmw2l5'))
    liveoth=sum(1 for k in ks if not k.startswith('cmw2l5') and not k.startswith('cmw5n'))
    print(f"{len(ks)},{live2l},{liveoth}")
except Exception as e:
    print("err,0,0")
PYEOF
)
    echo "$(date +%s),$MT,$SZ,$COUNTS" >> "$LOG"
  fi
  sleep 2
done
