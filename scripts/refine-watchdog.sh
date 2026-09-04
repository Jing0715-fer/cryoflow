#!/bin/bash
# refine3d memory watchdog (4GB no-swap sandbox)
# 1) bias the OOM killer toward RELION ranks (oom_score_adj=800) so the
#    Next.js dev server (the user-facing page) is never the victim
# 2) proactively abort mpirun when MemAvailable < 220MB (before the kernel
#    acts), leaving a flag file for the driver loop
# 3) auto-exit once mpirun is gone
FLAG=/tmp/refine-aborted.flag
LOG=/tmp/refine-watchdog.log
echo "$(date +%T) watchdog start" >> "$LOG"
while true; do
  if ! pgrep -x mpirun >/dev/null 2>&1; then
    sleep 5
    if ! pgrep -x mpirun >/dev/null 2>&1; then
      echo "$(date +%T) mpirun gone → watchdog exit" >> "$LOG"
      exit 0
    fi
  fi
  # bias OOM preference toward relion processes
  for pid in $(pgrep -f "relion_refine|relion_postprocess|relion_mask"); do
    [ -w "/proc/$pid/oom_score_adj" ] && echo 800 > "/proc/$pid/oom_score_adj" 2>/dev/null
  done
  avail=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
  if [ "$avail" -lt 220000 ]; then
    echo "$(date +%T) MemAvailable=${avail}kB < 220MB → aborting mpirun to save the page" >> "$LOG"
    pkill -9 -x mpirun 2>/dev/null
    pkill -9 -f "relion_refine_mpi" 2>/dev/null
    echo "$(date +%T) avail=${avail}" > "$FLAG"
    exit 0
  fi
  echo "$(date +%T) avail=${avail}kB relion_pids=$(pgrep -f relion_refine | wc -l)" >> "$LOG"
  sleep 20
done
