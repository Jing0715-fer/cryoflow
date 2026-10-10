#!/bin/bash
# t367 — minimal one-lifetime warm: root + the routes the ghost-job browser
# flow touches (browser closed), then the browser diag. The 40-chunk warm
# FILLS Turbopack's in-memory cache (~3GB steady) and the next compile
# OOMs — the browser lazy-loads its own chunks against whatever headroom
# is left.
set -u
pkill -f "agent-browser" 2>/dev/null
pkill -f "next dev -p 3005" 2>/dev/null
sleep 2
bash /home/z/cryoflow/scripts/dev-server-3005.sh
B=http://localhost:3005
H="-H Origin:$B -H Referer:$B/"
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 $B/api/jobs $H)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "server up (jobs $code)"
GID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/t367-state.json','utf8')).ghostId)")
# small routes FIRST (fresh server = max headroom per spike)
for r in "/api/activity" "/api/activity/recent" "/api/hpc/profiles" "/api/views/gallery" "/api/edges" "/api/projects"; do
  curl -s -o /dev/null --max-time 150 $H "$B$r" -w "$r %{http_code}\n"; sleep 6
done
for r in "/api/jobs/$GID/fsc" "/api/jobs/$GID/topaz-training" "/api/jobs/$GID/classes?iter=4" "/api/jobs/$GID/outputs" "/api/jobs/$GID/iterations" "/api/jobs/$GID/iterations/sheet?file=run_it004_classes.mrcs"; do
  curl -s -o /dev/null --max-time 150 $H "$B$r" -w "$(echo $r | sed "s/$GID/<id>/") %{http_code}\n"; sleep 6
done
free -m | head -2
# SSR shell LAST (the biggest compile gets the remaining headroom)
curl -s $B/ --max-time 240 -o /tmp/t367-page.html -w "root %{http_code} %{time_total}s\n"
free -m | head -2
cd /home/z/cryoflow && node scripts/diag-t367-browser.mjs
