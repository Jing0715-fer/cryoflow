#!/usr/bin/env bash
# t1121 — the probe's second voice: the SECOND live ride (photo pass).
# The first ride took the chip's text proof (both lines live); this ride
# takes the PHOTO. Same chain, tight sleeps, echo+abort per step — the
# watchdog window is ~5 minutes (t1120 verdict), the chain needs ~60s.
set -u
set +H

say() { echo "== $1"; }
die() { echo "ABORT: $1"; exit 1; }

say "open home"
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 3

say "locate + scroll the card into view"
POS=$(agent-browser eval "(function(){var cs=document.querySelectorAll('[data-card-btn]');for(var i=0;i<cs.length;i++){if((cs[i].textContent||'').indexOf('3D Classification 1')>=0){var r=cs[i].getBoundingClientRect();return Math.round(r.x+r.width/2)+' '+Math.round(r.y+r.height/2)}}return 'NONE'})()" 2>/dev/null | tail -1 | tr -d '"')
echo "card at: $POS"
case "$POS" in NONE|"") die "card not found";; esac
CX=${POS% *}; CY=${POS#* }

# if the card is below the fold, scroll the canvas container (window
# scroll is inert here — the flow lives in overflow panes)
if [ "$CY" -gt 690 ] || [ "$CY" -lt 30 ]; then
  say "scrolling container by $((CY-300))"
  agent-browser eval "(function(){var els=document.querySelectorAll('main, [class*=overflow], body *');for(var i=els.length-1;i>=0;i--){var e=els[i];if(e.scrollHeight>e.clientHeight+50&&e.clientHeight>300){e.scrollTop+=$((CY-300));return 'SC '+e.scrollTop}}return 'NO SC'})()" 2>&1 | tail -1
  sleep 1
  POS=$(agent-browser eval "(function(){var cs=document.querySelectorAll('[data-card-btn]');for(var i=0;i<cs.length;i++){if((cs[i].textContent||'').indexOf('3D Classification 1')>=0){var r=cs[i].getBoundingClientRect();return Math.round(r.x+r.width/2)+' '+Math.round(r.y+r.height/2)}}return 'NONE'})()" 2>/dev/null | tail -1 | tr -d '"')
  CX=${POS% *}; CY=${POS#* }
  echo "card now at: $CX,$CY"
fi

say "real-mouse click the card ($CX,$CY)"
agent-browser mouse move "$CX" "$CY" >/dev/null 2>&1
sleep 0.5
agent-browser mouse down >/dev/null 2>&1
sleep 0.3
agent-browser mouse up >/dev/null 2>&1
sleep 3
D=$(agent-browser eval "(function(){return document.querySelectorAll('[role=dialog]').length})()" 2>/dev/null | tail -1 | tr -d '"')
[ "$D" = "1" ] || die "inspector did not open (D=$D)"
echo "inspector open"

say "Enlarge Class 1 map"
agent-browser eval "(function(){var last=document.querySelectorAll('[role=dialog]')[0];var bs=last.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].getAttribute('aria-label')||'').indexOf('Enlarge Class 1 map')>=0){bs[i].click();return 'OK'}}return 'NO'})()" 2>&1 | tail -1
sleep 3

say "View in 3D"
agent-browser eval "(function(){var ds=document.querySelectorAll('[role=dialog]');var last=ds[ds.length-1];var bs=last.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').indexOf('View in 3D')>=0){bs[i].click();return 'OK'}}return 'NO'})()" 2>&1 | tail -1
sleep 8
D=$(agent-browser eval "(function(){return document.querySelectorAll('[role=dialog]').length})()" 2>/dev/null | tail -1 | tr -d '"')
[ "$D" -ge 2 ] || die "Mol* dialog did not open (D=$D)"
echo "Mol* open"

say "expand the ortho strip"
agent-browser eval "(function(){var ds=document.querySelectorAll('[role=dialog]');var last=ds[ds.length-1];var bs=last.querySelectorAll('button');for(var i=0;i<bs.length;i++){if(bs[i].getAttribute('aria-expanded')==='false'&&(bs[i].textContent||'').indexOf('Orthogonal slices')>=0){bs[i].click();return 'OK'}}return 'NO'})()" 2>&1 | tail -1
sleep 2

say "scroll tiles into view"
agent-browser eval "(function(){var ds=document.querySelectorAll('[role=dialog]');var last=ds[ds.length-1];var els=[];var all=last.querySelectorAll('*');for(var i=0;i<all.length;i++){var e=all[i];if(e.scrollHeight>e.clientHeight+30&&e.clientHeight>150){els.push(e)}}if(els.length){els[els.length-1].scrollTop+=60;return 'SC'}return 'NO'})()" 2>&1 | tail -1
sleep 1

say "find the first visible tile"
ZT=$(agent-browser eval "(function(){var ds=document.querySelectorAll('[role=dialog]');if(ds.length<1)return 'NONE';var last=ds[ds.length-1];var imgs=last.querySelectorAll('img');for(var i=0;i<imgs.length;i++){var s=imgs[i].src||'';if(s.indexOf('format=png')<0)continue;var r=imgs[i].getBoundingClientRect();if(r.width>80&&r.y>0&&r.y<980){return Math.round(r.x+r.width*0.3)+' '+Math.round(r.y+r.height*0.35)}}return 'NONE'})()" 2>/dev/null | tail -1 | tr -d '"')
echo "tile hover point: $ZT"
case "$ZT" in NONE|"") die "z tile not visible";; esac
HX=${ZT% *}; HY=${ZT#* }

say "hover ($HX,$HY) — the probe chase"
agent-browser mouse move $((HX-40)) $((HY-30)) >/dev/null 2>&1
agent-browser mouse move "$HX" "$HY" >/dev/null 2>&1
sleep 0.5
agent-browser mouse move $((HX+8)) $((HY+5)) >/dev/null 2>&1
sleep 1.5

say "PHOTO first (the window may close any second)"
agent-browser screenshot shots-qa/t1121-probe-patch.png 2>&1 | tail -1

say "chip proof (the text receipt — lives even if the shot missed)"
agent-browser eval "(function(){var ds=document.querySelectorAll('[role=dialog]');var last=ds[ds.length-1];var chip=last.querySelector('[data-canvas-ui=ortho-probe-readout]');if(!chip)return 'NO CHIP';var p=chip.querySelector('[data-ortho-probe-patch]');return 'CHIP: '+chip.textContent+(p?' | PATCH: '+p.textContent:' | NO PATCH')})()" 2>&1 | tail -1
echo "done"
