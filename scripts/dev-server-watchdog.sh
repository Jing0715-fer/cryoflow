#!/bin/bash
# dev-server-watchdog.sh — the t404 promotion of the t403 band-aid, v2 (t405), cache hygiene v2.1 (t406).
#
# /tmp/revive.sh (Task 403) kept the DEV server alive through the sandbox
# patrol's reaping sprees, but it lived in /tmp with a 90-minute window
# (360 x 15s) — it expired mid-window-404 and the server died with no
# guardian (witnessed: three ECONNREFUSED crashes in a row while the t313
# suite waited). This is the same doctrine, promoted: in-tree, no expiry.
#
# v2 (t405) — the death certificate finally arrived: DMESG. The t403/t404
# "patrol kills background node processes in ~10 minutes, silently" profile
# is mostly the KERNEL OOM KILLER wearing a mask:
#
#   [14484.507628] oom-kill:constraint=CONSTRAINT_NONE,...,task=next-server
#   [14484.507663] Out of memory: Killed process 13329 (next-server (v1)
#     total-vm:65612712kB, anon-rss:2995464kB
#
# 4GB box, NO swap, the webpack lane's next-server boots at ~1.9GB RSS and
# grows with every route compile the suites trigger — the kernel executes it
# at ~3GB anon, mid-whatever-it-was-doing. Every silent background death in
# the t403/t404 windows (healer x2, supervisor bash, dev-server-watchdog
# itself, agent-browser's chrome) fits the same signature. So the watchdog's
# job changes from "resurrect after an unexplained death" to three things:
#
#   1. RESURRECT — the v1 law, unchanged: health check on / (bare curl),
#      boot with the hardened env (DEV_HEAP_MB=1280 t407 + --webpack, node not bun).
#   2. EXECUTE THE ZOMBIE — v1's pgrep gate has a blind spot, witnessed twice
#      on day one: a "next dev" process that EXISTS but lost the .next/dev/lock
#      war never listens, and every watchdog instance sees "process present"
#      and never reboots (an 8-hour stale witness before this version). If /
#      stays silent for SILENT_ZOMBIE_S with a process present, the process is
#      not mid-boot (warm-cache boot answers in ~30-45s) — it is a corpse.
#      Kill it, boot fresh.
#   3. CONTROLLED RECYCLE — beat the kernel to the draw. When next-server's
#      RSS crosses RSS_RECYCLE_KB (2.6GB, ~400MB before the historical OOM
#      point), kill + reboot ON OUR SCHEDULE instead of the kernel's. A
#      controlled 30-45s gap between suites beats a random SIGKILL mid-goto.
#      A freshly booted server also gets PRE-WARMED (GET / polled until it
#      answers) so a suite's first goto lands on a compiled route.
#
#   plus: SINGLE-KEEPER — multiple watchdog instances fight each other's
#   boots (witnessed: four instances, one lock war, one 000-port deadlock).
#   A second instance exits at startup.
#
# v2.1 (t406) — CACHE HYGIENE. The t406 window witnessed a NEW death spiral
# the v2 loop was blind to: boot -> "Ready in 1.3s" -> "Compiling /" ->
# process gone, NO kernel record, twelve boots in a row all identical
# (09:09-09:28Z). The signature matches t405's already-solved mystery: the
# kernel OOM kill of a compile worker leaves the .next webpack cache CORRUPT
# (tombstone: .next.corrupt-t405), and every subsequent boot reads the dirty
# cache and the compile worker crashes itself silently. v2 rebooted forever
# into the same wall. The fix: count CONSECUTIVE boot failures (prewarm
# unanswered); at DIRTY_CACHE_STREAK in a row, quarantine .next (mv, never
# rm — it is a diagnostic asset) and let the next boot cold-compile clean,
# the exact move that un-stuck t405 ("three boots of incremental warmth,
# ~210s, cold compile done"). Old quarantines beyond the newest two are
# reaped so the hygiene itself cannot fill the disk (each .next ~330MB).
#
# Run detached:  (nohup bash scripts/dev-server-watchdog.sh >> /tmp/cryoflow-qa/dev-watchdog.log 2>&1 &)
# Stop with:     pkill -f dev-server-watchdog
cd "$(dirname "$0")/.." || exit 1
# t503 — logs live OUTSIDE the repo tree (see dev-server.sh's note): an
# in-tree heartbeat fed Next's dev watcher a rebuild fire that ate ~44MB/s
# of RSS until the recycle threshold — the t501 "OOM storms" were this.
QA_LOG_DIR="${CRYOFLOW_QA_LOG_DIR:-/tmp/cryoflow-qa}"
mkdir -p "$QA_LOG_DIR"
LOG="$QA_LOG_DIR/dev-watchdog.log"

# single-keeper, kernel edition (t405): the first pgrep-count guard (loose
# pattern) matched its own launcher's command string; the anchored rewrite
# still counted 2 — the $() fork's transient copy inherits the parent's
# cmdline and the snapshot caught it. Cmdline heuristics are a mug's game:
# an flock on a lockfile is atomic, held by exactly one live process, and
# the kernel releases it at process death. Two keepers are now impossible
# by construction, not by pattern-matching.
exec 9>>"$QA_LOG_DIR/dev-watchdog.lock"
if ! flock -n 9; then
  echo "[$(date -u +%H:%M:%SZ)] another watchdog holds the lock — exiting (single-keeper law)" >> "$LOG"
  exit 0
fi

SILENT_ZOMBIE_S="${WATCHDOG_ZOMBIE_S:-240}"       # silent + process present => corpse. 240s: must cover a COLD webpack compile of the home graph (~45s warm cache, minutes truly cold — the zombie it exists for was 8 HOURS stale, so a generous grace costs nothing)
# t405, retuned once live: the kernel's OOM kill landed at anon-rss 2.84GB
# (chrome-headless was allocating; the kernel shoots the fattest victim) —
# 2.6GB lost ONE race to a compile burst while chrome held 600MB (the 2.84GB
# kill); retuned 2.35 -> 2.6: the compile BURST itself spikes to ~2.2GB+
# within 33s and a 2.35 threshold murders every cold compile mid-flight — recycle growth, not bursts.
RSS_RECYCLE_KB="${WATCHDOG_RECYCLE_KB:-2600000}"

silent_since=""
boot_fail_streak=0
DIRTY_CACHE_STREAK="${WATCHDOG_DIRTY_STREAK:-3}"

prewarm() {
  # a fresh boot's home route compiles on first hit (~30-45s warm cache);
  # poll it now so a suite's first goto lands on a compiled route
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14; do
    if curl -s -o /dev/null --max-time 5 http://localhost:3000/; then
      echo "[$(date -u +%H:%M:%SZ)] prewarm: / answers (attempt $i)" >> "$LOG"
      return 0
    fi
    sleep 5
  done
  echo "[$(date -u +%H:%M:%SZ)] prewarm: / still silent after 70s (slow compile? flap window?)" >> "$LOG"
  return 1
}

boot() {
  echo "[$(date -u +%H:%M:%SZ)] server down, no next dev process — booting with hardened env" >> "$LOG"
  # t524 — boot the DEFAULT lane, not the webpack escape hatch. t416's
  # DEV_HEAP_MB=1792 + --webpack predates the t461 verdict ("QA runs on the
  # dev lane, the verified recipe") and the t524 mem-profile verdict: on
  # today's tree the webpack lane is BORN at ~2.5GB RSS — 100MB under this
  # watchdog's own recycle line, a recycle storm by construction (boot ->
  # 2.5GB -> recycle -> boot ...) — while the turbopack default (896 heap)
  # is born at ~2.0GB steady state and compiles routes normally (live
  # witness this window: born 2.0GB, zero growth over 45s of traffic).
  # The default lane is the single source of truth; the watchdog boots it.
  bash scripts/dev-server.sh >> "$LOG" 2>&1
  if prewarm; then
    boot_fail_streak=0
    return 0
  fi
  # v2.1 — the dirty-cache verdict: prewarm just failed. A WARM boot answers
  # in ~30-45s and a cold clean boot in ~210s; failing the 70s prewarm window
  # on the FIRST miss is normal (cold), but missing it DIRTY_CACHE_STREAK
  # times IN A ROW means every boot dies mid-compile — the OOM-corrupted
  # cache signature. Quarantine and let the next boot compile clean.
  boot_fail_streak=$((boot_fail_streak + 1))
  if [ "$boot_fail_streak" -ge "$DIRTY_CACHE_STREAK" ]; then
    if [ -d .next ]; then
      echo "[$(date -u +%H:%M:%SZ)] boot failed $boot_fail_streak times in a row — OOM-corrupted-cache signature, quarantining .next (v2.1 cache hygiene)" >> "$LOG"
      ts=$(date +%Y%m%d-%H%M%S)
      mv .next ".next.corrupt-$ts" 2>/dev/null
      # keep only the two newest quarantines — the hygiene must not fill the disk
      ls -1dt .next.corrupt-* 2>/dev/null | tail -n +3 | while read -r old; do
        echo "[$(date -u +%H:%M:%SZ)] reaping old quarantine $old" >> "$LOG"
        rm -rf "$old"
      done
    fi
    boot_fail_streak=0
  fi
  return 1
}

next_server_rss_kb() {
  # max RSS across next-server workers (the kernel's OOM victim is the worker,
  # not the launcher — witness: "task=next-server")
  local p max=0 r
  for p in $(pgrep -f 'next-server' 2>/dev/null); do
    r=$(ps -o rss= -p "$p" 2>/dev/null | tr -d ' ')
    [ -n "$r" ] && [ "$r" -gt "$max" ] && max=$r
  done
  echo "$max"
}

while true; do
  if curl -s -o /dev/null --max-time 3 http://localhost:3000/; then
    silent_since=""
    rss=$(next_server_rss_kb)
    if [ "$rss" -ge "$RSS_RECYCLE_KB" ]; then
      echo "[$(date -u +%H:%M:%SZ)] next-server RSS ${rss}KB >= ${RSS_RECYCLE_KB}KB — controlled recycle before the kernel OOM does it" >> "$LOG"
      pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
      sleep 2
      boot
    fi
  else
    now=$(date +%s)
    if pgrep -f "next dev" > /dev/null; then
      if [ -z "$silent_since" ]; then silent_since=$now; fi
      dt=$((now - silent_since))
      if [ "$dt" -ge "$SILENT_ZOMBIE_S" ]; then
        echo "[$(date -u +%H:%M:%SZ)] silent ${dt}s with process present — lock-dead zombie, executing" >> "$LOG"
        pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
        sleep 2
        silent_since=""
        boot
      fi
    else
      silent_since=""
      boot
    fi
  fi
  sleep 10
done
