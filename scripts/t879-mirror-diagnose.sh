#!/bin/bash
# t879-mirror-diagnose.sh — round 2. The eval's fetch must stash its
# result on window (the daemon's eval does not await promises), and the
# API bodies must be read while the call's own server lives. One call,
# one server lifetime, every mouth interrogated.
set -u
cd /home/z/my-project
ORIGIN="http://127.0.0.1:3000"

pkill -f dev-server-watchdog 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f next-server 2>/dev/null
sleep 2
agent-browser open about:blank > /dev/null 2>&1 || true

bash dev-server.sh > /tmp/t879-diag-server.log 2>&1 &
for _ in $(seq 1 45); do
  sleep 3
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -H "Origin: $ORIGIN" $ORIGIN/api/projects 2>/dev/null)
  [ "$code" = "200" ] && break
done
[ "$code" = "200" ] || { echo "[diag] FATAL — lane never came up"; exit 1; }
echo "[diag] lane up"

echo "[diag] --- /api/workspaces body:"
curl -s -m 60 -H "Origin: $ORIGIN" $ORIGIN/api/workspaces | head -c 300; echo
echo "[diag] --- /api/jobs body head:"
curl -s -m 60 -H "Origin: $ORIGIN" $ORIGIN/api/jobs | head -c 200; echo

echo "[diag] navigating the canvas"
agent-browser eval "location.assign('$ORIGIN'); 'nav'" > /dev/null 2>&1 || true
sleep 30

echo "[diag] --- page's own fetch (stashed on window):"
timeout 25 agent-browser eval "(async()=>{try{const r=await fetch('/api/workspaces'); const b=await r.text(); window.__f='ws '+r.status+' len='+b.length+' '+b.slice(0,100)}catch(e){window.__f='ERR '+e.message}})(); 'started'" 2>/dev/null | tail -1
sleep 6
timeout 25 agent-browser eval "window.__f || 'pending'" 2>/dev/null | tail -1

echo "[diag] --- page's jobs fetch:"
timeout 25 agent-browser eval "(async()=>{try{const r=await fetch('/api/jobs'); const b=await r.text(); window.__j='jobs '+r.status+' len='+b.length+' '+(b.match(/\"name\":\"[^\"]{0,20}/)||[''])[0]}catch(e){window.__j='ERR '+e.message}})(); 'started'" 2>/dev/null | tail -1
sleep 6
timeout 25 agent-browser eval "window.__j || 'pending'" 2>/dev/null | tail -1

echo "[diag] --- the mirror + workspace combo:"
timeout 25 agent-browser eval "(document.body.innerText.match(/\d+ jobs [^\n]*edges[^\n]*/)||[''])[0]" 2>/dev/null | tail -1
timeout 25 agent-browser eval "var el=document.querySelector('select,[role=combobox]'); el? (el.value||el.textContent||'').slice(0,80) : 'no-el'" 2>/dev/null | tail -1
