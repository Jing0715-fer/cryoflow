#!/usr/bin/env bash
# t1121 — the probe's second voice: the live ride. Chain: home → 3D
# Classification 1 card (JS click, first-round law) → Enlarge Class 1 map
# → View in 3D (Mol*) → settle → expand the ortho strip → real-mouse
# hover a tile → read the probe chip's TWO lines (value@addr + the patch
# voice med/z/n). Fast-in-fast-out: the watchdog recycle clock owns the
# window (t1120 verdict), so every step echoes and aborts on loss.
set -u
set +H

step() { echo "== $1"; }

step "open home"
agent-browser open http://localhost:3000/ 2>&1 | tail -1
sleep 3

step "click 3D Classification 1 card"
agent-browser eval "(function(){var cards=document.querySelectorAll('[data-card-btn]');var c3=null;for(var i=0;i<cards.length;i++){if((cards[i].textContent||'').indexOf('3D Classification 1')>=0){c3=cards[i];break}}if(!c3)return 'NO CARD';c3.click();return 'CARD CLICKED'})()" 2>&1 | tail -1
sleep 3

step "click Enlarge Class 1 map"
agent-browser eval "(function(){var ds=document.querySelectorAll('[role=dialog]');var last=ds[ds.length-1];if(!last)return 'NO DIALOG';var bs=last.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].getAttribute('aria-label')||'').indexOf('Enlarge Class 1 map')>=0){bs[i].click();return 'ENLARGE CLICKED'}}return 'NO ENLARGE'})()" 2>&1 | tail -1
sleep 3

step "click View in 3D"
agent-browser eval "(function(){var ds=document.querySelectorAll('[role=dialog]');var last=ds[ds.length-1];if(!last)return 'NO DIALOG';var bs=last.querySelectorAll('button');for(var i=0;i<bs.length;i++){if((bs[i].textContent||'').indexOf('View in 3D')>=0){bs[i].click();return 'V3 CLICKED'}}return 'NO V3'})()" 2>&1 | tail -1
sleep 9

step "dialog state + find the ortho strip trigger"
agent-browser eval "(function(){var ds=document.querySelectorAll('[role=dialog]');var last=ds[ds.length-1];if(!last)return 'NO DIALOG';var bs=last.querySelectorAll('button');var out='DIALOGS='+ds.length;for(var i=0;i<bs.length;i++){var t=(bs[i].textContent||'').trim();if(/slice|ortho/i.test(t)||bs[i].getAttribute('aria-expanded')!==null){out=out+' :: ['+i+']'+t.slice(0,28)+' exp='+bs[i].getAttribute('aria-expanded')}}return out})()" 2>&1 | tail -1
