#!/bin/bash
# dev-server-watchdog.sh — the t404 promotion of the t403 band-aid, v2 (t405),
# cache hygiene v2.1 (t406), the thin-host recycle v3 (t1023), the storm law
# extended to the fat arm v3.2 (t1080).
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
# v3 (t1023) — THE THIN-HOST RECYCLE. The t1022 window's dmesg receipt:
#
#   oom-kill:...,task=next-server (v1,pid=16066 ...) anon-rss:1970692kB
#
# the kernel shot the server at 1.97GB — 630MB BELOW the v2 fixed line
# (2600000KB) that was watching the whole time. The kernel's kill point was
# never a fixed RSS: it is HOST EXHAUSTION — chrome and the suites held the
# rest of the box and the fattest victim died mid-whatever. The t1021 fuel
# law stated the principle on the import route ("the budget reads the
# HOST's own numbers — never a fixed cap"); this version applies it to the
# recycle: the loop now reads MemAvailable from /proc/meminfo (the kernel's
# own honest figure — reclaimable cache already subtracted) and recycles
# when EITHER arm fires:
#
#   the FAT arm (v2's law):             rss >= RSS_RECYCLE_KB
#   the THIN-HOST arm (new):            rss >= RSS_SOFT_KB  AND
#                                       avail <= HOST_FLOOR_KB
#
#   RSS_SOFT_KB (1900000, ~1.81GB) sits BELOW the witnessed kill (1.97GB)
#   and BELOW the born footprint of the default lane (~2.0GB steady, the
#   t524 mem-profile note) — the server at its BORN size already holds half
#   the box, and the t1022 kill happened exactly there.
#   HOST_FLOOR_KB (786432, 768MB) is the runway: a compile burst
#   (~200-400MB) plus a chrome spawn (~600MB) still fit inside it — at
#   avail below the floor the NEXT big allocation is the exact shape that
#   draws the kernel's SIGKILL, so the recycle happens on our schedule
#   first.
#   RECYCLE_COOLDOWN_S (300) is the STORM LAW: a boot younger than the
#   dwell already relieved the host by ~2GB; recycling again inside the
#   dwell is skipped and logged once — if the host is STILL thin five
#   minutes after a 2GB reclaim, the hog is elsewhere and one more
#   scheduled recycle is still ours to take, but never at poll cadence
#   (the t524 boot->recycle->boot shape, forbidden by construction).
#
#   The fire line carries ALL FOUR numbers (rss, avail, and the two
#   thresholds) plus which arm fired — the refusal's words law (t1021)
#   applied to the guardian: the log IS the verdict's receipt.
#
#   The decision lives in ONE pure function — recycle_decision(rss, avail,
#   since_boot) -> "fire <arm> ..." | "skip cooldown ..." | "hold ..." —
#   no probes, no side effects; WATCHDOG_UNIT_MODE=1 hands a caller the
#   constants and the function and exits before the lock and the loop, so
#   the unit rides the REAL arithmetic without ever approaching the kill
#   paths (a sourced unit must not fight the live keeper's flock — the
#   single-keeper law would execute it after 15s).
#
# v3.2 (t1080) — THE STORM LAW COVERS THE FAT ARM. The t1080 window
# witnessed the recycle storm the v2 tuning words had already named but
# the v3 code had only half-coded:
#
#   the t1080 morning: server generations dying at 30-60s of age
#   (PIDs 12336 -> 12669 -> 12849 -> 14001 within minutes), every one
#   mid-compile ("Compiling /api/jobs ..." its last words), zero kernel
#   record — and the watchdog's own fire line confessing: a generation
#   watched at rss=2737152KB, FIVE SECONDS old. The tree's compile burst
#   had grown past the fat line (2.6GB): the burst itself now crosses the
#   threshold, and the fat arm — cooldown-free since v2 — murdered every
#   cold compile mid-flight, booted the next one, murdered it again.
#   The dirty-cache cure could never fire (prewarm / answers warm; the
#   disease moved to the API route), the storm law never applied (it
#   guarded only the thin-host arm), the loop recycled at poll cadence —
#   the exact "recycle growth, not bursts" violation the t405 retune
#   (2.35 -> 2.6) was written to prevent, reborn one era later.
#
#   The cure is ONE guard, the storm law applied where it always
#   belonged: the fat arm now honors the same boot-clock dwell as the
#   thin-host arm. A boot younger than RECYCLE_COOLDOWN_S whose RSS
#   crosses the fat line is a BURST IN FLIGHT — skipped (logged once per
#   episode, the same once-per-episode honesty), never killed mid-compile.
#   If the RSS is still at or above the fat line when the dwell expires,
#   it is STEADY fat — the controlled recycle happens then, on our
#   schedule, at the storm-law cadence (never at poll cadence). The
#   threshold itself does not move: the fat line keeps its meaning
#   (the absolute growth line), only the cadence gets the guard.
#
# THE RENAME LAW (t1023, the t894 lesson applied to this file itself):
# this script is RUNNING somewhere, always. bash reads a script
# incrementally — editing the live inode in place (sed -i, >>, truncate)
# shifts the running reader's offsets and corrupts execution mid-loop.
# To change this file: write a NEW file, `bash -n` it, `mv` it over this
# path (a rename swaps the dirent; the running keeper keeps the OLD inode
# by fd and finishes its loop uncorrupted), then restart the keeper (kill
# the old pid; the new instance's flock retry rides out the dying-keeper
# window, the t531 law). NEVER edit in place.
#
# THE SWAP AMENDMENT (t1023, the inheritance-law witness): killing the
# keeper does NOT free the lock if a PRE-v3.1 boot leaked fd 9 into the
# server tree (the lock rides the OFD shared with node/next-server). If a
# fresh keeper fails its flock against a holder that is not a keeper, the
# leak carrier is the server tree: kill it (pkill -f "next dev";
# pkill -f "next-server") — the lock dies with it and the fresh keeper
# reboots the server itself. Pre-v3.1 keepers can also re-leak on their
# next boot; the swap is not clean until the keeper running the loop is a
# v3.1 one.
#
# Run detached:  (nohup bash scripts/dev-server-watchdog.sh >> /tmp/cryoflow-qa/dev-watchdog.log 2>&1 &)
# Stop with:     kill <keeper pid>   (then relaunch per the line above)
cd "$(dirname "$0")/.." || exit 1
# t503 — logs live OUTSIDE the repo tree (see dev-server.sh's note): an
# in-tree heartbeat fed Next's dev watcher a rebuild fire that ate ~44MB/s
# of RSS until the recycle threshold — the t501 "OOM storms" were this.
QA_LOG_DIR="${CRYOFLOW_QA_LOG_DIR:-/tmp/cryoflow-qa}"
mkdir -p "$QA_LOG_DIR"
LOG="$QA_LOG_DIR/dev-watchdog.log"

SILENT_ZOMBIE_S="${WATCHDOG_ZOMBIE_S:-240}"       # silent + process present => corpse. 240s: must cover a COLD webpack compile of the home graph (~45s warm cache, minutes truly cold — the zombie it exists for was 8 HOURS stale, so a generous grace costs nothing)
# t405, retuned once live: the kernel's OOM kill landed at anon-rss 2.84GB
# (chrome-headless was allocating; the kernel shoots the fattest victim) —
# 2.6GB lost ONE race to a compile burst while chrome held 600MB (the 2.84GB
# kill); retuned 2.35 -> 2.6: the compile BURST itself spikes to ~2.2GB+
# within 33s and a 2.35 threshold murders every cold compile mid-flight — recycle growth, not bursts.
# t1080 — the burst outgrew the line (witnessed 2737152KB at 5s of age) and
# the line also sat BELOW the tree's measured steady state (2613212KB after
# a completed walk — every idle generation would have been recycled at dwell
# expiry). v3.2's answer is twofold: the cooldown guard (bursts inside the
# dwell are growth in flight, never killed mid-compile) AND the line
# re-seated at 2650000KB — just above the measured steady state, still
# below the kernel's host-starved kill zone (2722164 / 2734924 witnessed).
# The host-starved case stays the THIN-HOST arm's business (soft 1.9GB +
# floor 768MB), which keeps its own cooldown.
RSS_RECYCLE_KB="${WATCHDOG_RECYCLE_KB:-2650000}"
# t1023 — the thin-host arm's two thresholds and the storm dwell (see the
# v3 header for the witnesses and the arithmetic).
RSS_SOFT_KB="${WATCHDOG_RECYCLE_SOFT_KB:-1900000}"
HOST_FLOOR_KB="${WATCHDOG_HOST_FLOOR_KB:-786432}"
RECYCLE_COOLDOWN_S="${WATCHDOG_RECYCLE_COOLDOWN_S:-300}"

silent_since=""
boot_fail_streak=0
DIRTY_CACHE_STREAK="${WATCHDOG_DIRTY_STREAK:-3}"
skip_logged=0

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
  last_boot_ts=$(date +%s)
  skip_logged=0
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
  # v3.1 — THE INHERITANCE LAW: fd 9 (the single-keeper lock) has no
  # close-on-exec; without 9>&- the boot child inherits it and passes it
  # down the WHOLE server tree (dev-server.sh -> node next dev ->
  # next-server), so the flock rides the guarded process for its lifetime.
  # Witnessed live (t1023): the 11:17 boot leaked the lock into the server
  # tree; the keeper swap at 11:25 then deadlocked twice — the fresh
  # keeper's flock failed 15s straight against a lock held by node 23072,
  # and the world stood unguarded. The lock NEVER reaches the guarded
  # tree again.
  bash scripts/dev-server.sh 9>&- >> "$LOG" 2>&1
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

host_avail_kb() {
  # t1023 — the HOST's own number: MemAvailable already subtracts what the
  # kernel knows it cannot reclaim, the same figure the OOM killer's own
  # arithmetic reads. No free/awk parsing drama, one source of truth.
  awk '/^MemAvailable:/{print $2; exit}' /proc/meminfo 2>/dev/null || echo 0
}

recycle_decision() {
  # t1023 — the pure decision: (rss_kb, avail_kb, seconds_since_boot) ->
  # one line: "fire fat ..." | "skip cooldown fat ..." | "fire thin-host ..."
  # | "skip cooldown ..." | "hold ...". No probes, no side effects — the
  # unit rides this directly (WATCHDOG_UNIT_MODE=1), the loop rides it
  # every poll.
  # v3.2 — the storm law covers the fat arm: a boot inside the dwell whose
  # RSS crosses the fat line is a compile burst in flight (the t1080
  # witness: 2737152KB at 5s of age, every generation murdered mid-compile
  # at poll cadence) — skipped, never killed mid-compile; at dwell expiry
  # it is steady fat and the controlled recycle happens then.
  local rss="$1" avail="$2" since_boot="$3"
  if [ "$rss" -ge "$RSS_RECYCLE_KB" ]; then
    if [ "$since_boot" -lt "$RECYCLE_COOLDOWN_S" ]; then
      echo "skip cooldown fat rss=${rss}KB avail=${avail}KB since_boot=${since_boot}s"
      return 1
    fi
    echo "fire fat rss=${rss}KB avail=${avail}KB"
    return 0
  fi
  if [ "$rss" -ge "$RSS_SOFT_KB" ] && [ "$avail" -le "$HOST_FLOOR_KB" ]; then
    if [ "$since_boot" -lt "$RECYCLE_COOLDOWN_S" ]; then
      echo "skip cooldown rss=${rss}KB avail=${avail}KB since_boot=${since_boot}s"
      return 1
    fi
    echo "fire thin-host rss=${rss}KB avail=${avail}KB"
    return 0
  fi
  echo "hold rss=${rss}KB avail=${avail}KB"
  return 1
}

# t1023 — the unit's seat: WATCHDOG_UNIT_MODE=1 hands the caller the
# constants and the pure decision function and EXITS before the lock and
# the loop — a sourced unit never fights the live keeper's flock (the
# single-keeper law would execute it after 15s) and never approaches the
# kill paths. The verdict is unambiguous: sourced -> return from the file;
# executed -> exit quietly.
if [ "${WATCHDOG_UNIT_MODE:-0}" = "1" ]; then
  if [ "${BASH_SOURCE[0]}" != "$0" ]; then
    return 0
  fi
  exit 0
fi

# single-keeper, kernel edition (t405): the first pgrep-count guard (loose
# pattern) matched its own launcher's command string; the anchored rewrite
# still counted 2 — the $() fork's transient copy inherits the parent's
# cmdline and the snapshot caught it. Cmdline heuristics are a mug's game:
# an flock on a lockfile is atomic, held by exactly one live process, and
# the kernel releases it at process death. Two keepers are now impossible
# by construction, not by pattern-matching.
exec 9>>"$QA_LOG_DIR/dev-watchdog.lock"
# t531 — the flock race law finally coded (t524 witness, pool item ⑤):
# dev-server.sh's pkill path calls ensure_watchdog immediately after the
# kill. If a DYING keeper still holds fd 9 (SIGTERM delivered, teardown in
# flight — the kernel releases the lock only at process death), the fresh
# instance's non-blocking flock fails and it exits: the old keeper finishes
# dying, and the world is left with NO guardian — the exact "watchdog
# 竞态补岗" hole the t524 window had to patch by re-invoking dev-server.sh
# by hand. Remedy: bounded retry, 6 × 2.5s ≈ 15s — far longer than any
# teardown, far shorter than an unguarded gap that matters. A lock still
# held after 15s belongs to a LIVE keeper and the single-keeper law stands
# (the retry then never loops forever against a healthy peer).
lock_ok=0
for _ in 1 2 3 4 5 6; do
  if flock -n 9; then lock_ok=1; break; fi
  sleep 2.5
done
if [ "$lock_ok" = 0 ]; then
  echo "[$(date -u +%H:%M:%SZ)] lock held through 15s of retries — a live keeper holds it, exiting (single-keeper law)" >> "$LOG"
  exit 0
fi

# t1023 — the boot clock: seeded from the RUNNING server's own elapsed
# seconds (a keeper starting next to a just-booted server inherits the
# cooldown — the relief already happened, whoever performed it), updated
# on every boot() this keeper performs.
last_boot_ts=0
_seed_pid=$(pgrep -f 'next-server' 2>/dev/null | head -1)
if [ -n "$_seed_pid" ]; then
  _etimes=$(ps -o etimes= -p "$_seed_pid" 2>/dev/null | tr -d ' ')
  case "$_etimes" in
    *[0-9]*) last_boot_ts=$(( $(date +%s) - _etimes )) ;;
  esac
fi

while true; do
  if curl -s -o /dev/null --max-time 3 http://localhost:3000/; then
    silent_since=""
    rss=$(next_server_rss_kb)
    avail=$(host_avail_kb)
    since_boot=$(( $(date +%s) - last_boot_ts ))
    decision=$(recycle_decision "$rss" "$avail" "$since_boot")
    case "$decision" in
      fire*)
        echo "[$(date -u +%H:%M:%SZ)] recycle: ${decision} — thresholds fat>=${RSS_RECYCLE_KB}KB soft>=${RSS_SOFT_KB}KB floor<=${HOST_FLOOR_KB}KB — controlled recycle before the kernel OOM does it" >> "$LOG"
        pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null
        sleep 2
        boot
        ;;
      skip*)
        # the storm law's honest silence: the skip speaks ONCE per episode,
        # with its numbers — a line per poll would be the t503 heartbeat
        # again
        if [ "$skip_logged" = 0 ]; then
          echo "[$(date -u +%H:%M:%SZ)] recycle: ${decision} — the boot clock guards the storm" >> "$LOG"
          skip_logged=1
        fi
        ;;
      *)
        skip_logged=0
        ;;
    esac
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
