#!/usr/bin/env bash
# t528 — rebuild the REAL RELION 5.0.0 of this sandbox, by recipe.
#
# /home/z/relion-build (the REAL RELION + MPI runtime the mock cluster's
# PATH prefers over the stub lane) predates the tracked worklog era and
# died in a sandbox reset (t525 record: "本地 RELION 构建湮灭"). t372 —
# the REAL-RELION full-chain fidelity suite — stays honestly BLOCKED
# until the build exists. This script is the t527 law applied to a
# compiler: 沙箱重置从「资产湮灭」降级为「一条命令的等待」.
#
# Shape (reconstructing the historical layout server.mjs expects):
#   /home/z/relion-build/
#     bin/relion_refine[_mpi] …      the install prefix
#     deps/cmake/   stage 1 — static cmake binary (system has none, sudo sealed)
#     deps/tiff/    stage 2 — libtiff from source (RELION 5.0: find_package(TIFF REQUIRED))
#     deps/mpich/   stage 3 — MPICH from source (RELION 5.0: find_package(MPI REQUIRED))
#     src/          stage 4 — shallow clone of 3dem/relion tag 5.0.0
#     build/                  — cmake build tree (make resumes where it stopped)
#     .stamps/*.done          — stage completion markers (idempotent resume)
#
# Laws baked in:
#   - identity: the final verdict is `relion_refine --version` printing 5.0.0
#     (t372 P0b's exact contract) — a build that cannot answer is not done.
#   - memory gate (build-guard spirit, t461/t524): every make stage checks
#     MemAvailable and waits/refuses rather than blind-grind into an OOM
#     that would take prod :3000 down with it.
#   - politeness: all compiles run nice -n 10 (prod :3000 keeps the box).
#   - single grinder: flock — a second invocation exits 3, never doubles.
#   - logs live OUTSIDE the tree (t503): /tmp/cryoflow-qa/relion-rebuild.log
#
# Usage:  bash scripts/t528-rebuild-relion.sh        # foreground
#         setsid nohup bash scripts/t528-rebuild-relion.sh >> … &   # background
# Re-run freely: finished stages are skipped via stamps; an interrupted
# RELION make resumes from where object files stopped.
set -uo pipefail

PREFIX=/home/z/relion-build
DEPS=$PREFIX/deps
STAMPS=$PREFIX/.stamps
LOGTAG="[relion-rebuild]"
mkdir -p "$STAMPS" /tmp/cryoflow-qa

# single grinder (watchdog single-keeper law)
exec 9>/tmp/cryoflow-qa/relion-rebuild.lock
flock -n 9 || { echo "$LOGTAG another grinder holds the lock — exit 3"; exit 3; }

log() { echo "$LOGTAG $(date '+%H:%M:%S') $*"; }

# ---- memory gate: wait for MemAvailable > floor (KB), max N minutes ----
wait_mem() { # $1 = floor KB, $2 = label
  local floor=${1:-1200000} label=${2:-stage} tries=0
  while :; do
    local avail
    avail=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
    if [ "${avail:-0}" -gt "$floor" ]; then return 0; fi
    tries=$((tries + 1))
    if [ "$tries" -ge 10 ]; then
      log "REFUSE: $label needs ${floor}KB available, only ${avail}KB after 10 min of waiting (build-guard law: never blind-grind into the OOM wall)"
      exit 4
    fi
    log "memory low (${avail}KB < ${floor}KB) — waiting 60s (try $tries/10) before $label"
    sleep 60
  done
}

fetch() { # $1 = url, $2 = out file, $… = fallback urls
  local out=$2 url=$1
  [ -s "$out" ] && { log "cached: $(basename "$out")"; return 0; }
  shift 2
  for u in "$url" "$@"; do
    log "fetching $(basename "$out") from $u …"
    if curl -fL --retry 2 --connect-timeout 20 -o "$out.part" "$u" 2>/dev/null && mv "$out.part" "$out"; then return 0; fi
  done
  log "REFUSE: all mirrors failed for $(basename "$out")"; return 1
}

# ---- stage 1: cmake (static binary, no compile) ----
if [ ! -f "$STAMPS/cmake.done" ]; then
  wait_mem 800000 "cmake stage"
  mkdir -p "$DEPS"
  if fetch https://github.com/Kitware/CMake/releases/download/v3.30.5/cmake-3.30.5-linux-x86_64.tar.gz "$DEPS/cmake.tar.gz"; then
    rm -rf "$DEPS/cmake"
    tar -xzf "$DEPS/cmake.tar.gz" -C "$DEPS" && mv "$DEPS/cmake-3.30.5-linux-x86_64" "$DEPS/cmake"
    "$DEPS/cmake/bin/cmake" --version | head -1
    touch "$STAMPS/cmake.done"; log "stage 1 cmake DONE"
  else
    log "cmake fetch failed — fix mirrors and re-run"; exit 4
  fi
else log "stage 1 cmake: already done"; fi
CMAKE=$DEPS/cmake/bin/cmake

# ---- stage 2: libtiff (REQUIRED by RELION 5.0, absent on the box) ----
if [ ! -f "$STAMPS/tiff.done" ]; then
  wait_mem 1200000 "libtiff stage"
  if fetch https://download.osgeo.org/libtiff/tiff-4.6.0.tar.gz "$DEPS/tiff.tar.gz"; then
    rm -rf "$DEPS/tiff-src"; tar -xzf "$DEPS/tiff.tar.gz" -C "$DEPS" && mv "$DEPS/tiff-4.6.0" "$DEPS/tiff-src"
    mkdir -p "$DEPS/tiff-src/build"
    (cd "$DEPS/tiff-src/build" && nice -n 10 "$CMAKE" .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$DEPS/tiff" -Dtiff-tests=OFF -Dtiff-docs=OFF -Dtiff-tools=OFF -Dtiff-contrib=OFF > /tmp/cryoflow-qa/tiff-cmake.log 2>&1 \
      && nice -n 10 make -j2 >> /tmp/cryoflow-qa/tiff-cmake.log 2>&1 \
      && make install >> /tmp/cryoflow-qa/tiff-cmake.log 2>&1) || { log "libtiff build FAILED — see /tmp/cryoflow-qa/tiff-cmake.log"; exit 4; }
    ls "$DEPS/tiff/lib/" >/dev/null 2>&1 && touch "$STAMPS/tiff.done" && log "stage 2 libtiff DONE"
  else
    log "tiff fetch failed — fix mirrors and re-run"; exit 4
  fi
else log "stage 2 libtiff: already done"; fi

# ---- stage 3: MPICH (REQUIRED by RELION 5.0; ch3:tcp — no ucx/ofi deps) ----
if [ ! -f "$STAMPS/mpich.done" ]; then
  wait_mem 1400000 "mpich stage"
  if fetch https://www.mpich.org/static/downloads/4.2.2/mpich-4.2.2.tar.gz "$DEPS/mpich.tar.gz" \
           https://github.com/pmodels/mpich/releases/download/v4.2.2/mpich-4.2.2.tar.gz; then
    rm -rf "$DEPS/mpich-src"; tar -xzf "$DEPS/mpich.tar.gz" -C "$DEPS" && mv "$DEPS/mpich-4.2.2" "$DEPS/mpich-src"
    log "configuring MPICH (default ch4:ofi with embedded libfabric; ch3 was removed in MPICH 4.x — t528 live-caught) — ~5-20 min …"
    (cd "$DEPS/mpich-src" && nice -n 10 ./configure --prefix="$DEPS/mpich" --disable-fortran \
        > /tmp/cryoflow-qa/mpich-build.log 2>&1 \
      && nice -n 10 make -j2 >> /tmp/cryoflow-qa/mpich-build.log 2>&1 \
      && make install >> /tmp/cryoflow-qa/mpich-build.log 2>&1) || { log "MPICH build FAILED — see /tmp/cryoflow-qa/mpich-build.log"; exit 4; }
    "$DEPS/mpich/bin/mpicc" --version | head -1
    touch "$STAMPS/mpich.done"; log "stage 3 MPICH DONE"
  else
    log "mpich fetch failed — fix mirrors and re-run"; exit 4
  fi
else log "stage 3 MPICH: already done"; fi

# ---- stage 4: RELION 5.0.0 (the heavy one — resumable via make) ----
if [ ! -f "$STAMPS/relion.done" ]; then
  wait_mem 1400000 "relion clone/configure"
  if [ ! -d "$PREFIX/src/relion" ]; then
    mkdir -p "$PREFIX/src"
    git clone --depth 1 --branch 5.0.0 https://github.com/3dem/relion.git "$PREFIX/src/relion" || { log "relion clone FAILED"; exit 4; }
  fi
  mkdir -p "$PREFIX/build"
  log "configuring RELION (GUI=OFF CUDA=OFF, double-prec CPU — the user's flavor) …"
  (cd "$PREFIX/build" \
    && PATH="$DEPS/mpich/bin:$PATH" nice -n 10 "$CMAKE" ../src/relion \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_INSTALL_PREFIX="$PREFIX" \
        -DCMAKE_PREFIX_PATH="$DEPS/tiff;$DEPS/mpich" \
        -DGUI=OFF -DCUDA=OFF -DALTCPU=OFF -DMKLFFT=OFF \
        > /tmp/cryoflow-qa/relion-cmake.log 2>&1) || { log "RELION cmake FAILED — see /tmp/cryoflow-qa/relion-cmake.log (TIFF/MPI found? GUI=OFF?)"; exit 4; }
  touch "$STAMPS/relion-configure.done"; log "RELION configure DONE — now the long grind (-j1, memory-gated) …"
  wait_mem 1400000 "relion make"
  if nice -n 10 make -j1 -C "$PREFIX/build" >> /tmp/cryoflow-qa/relion-build.log 2>&1 \
     && make -C "$PREFIX/build" install >> /tmp/cryoflow-qa/relion-build.log 2>&1; then
    touch "$STAMPS/relion.done"; log "stage 4 RELION DONE"
  else
    log "RELION make interrupted or FAILED — re-run this script to resume (make continues from built objects); see /tmp/cryoflow-qa/relion-build.log"
    exit 4
  fi
else log "stage 4 RELION: already done"; fi

# ---- identity verdict: the exact contract t372 P0 enforces ----
VER=$("$PREFIX/bin/relion_refine" --version 2>&1 | head -1)
log "identity: $PREFIX/bin/relion_refine → $VER"
if echo "$VER" | rg -q "5\.0\.0"; then
  log "ALL STAGES DONE — REAL RELION 5.0.0 stands at $PREFIX; t372 may grade the real world (rerun scripts/t372-empiar-chain.mjs)"
else
  log "VERDICT REFUSED: version probe did not print 5.0.0 — inspect /tmp/cryoflow-qa/relion-build.log"
  exit 4
fi
