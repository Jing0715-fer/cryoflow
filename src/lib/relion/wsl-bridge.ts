/**
 * CryoFlow — WSL execution bridge (SERVER ONLY).
 *
 * When the Next.js app runs natively on Windows while RELION lives inside a
 * WSL distro, the host cannot spawn distro-internal binaries directly
 * (spawn("/home/user/relion/bin/relion_refine") → ENOENT). This bridge:
 *
 *   1. translates Windows ↔ WSL paths (drive letters ↔ /mnt/<drive>, and
 *      \\wsl.localhost\<distro>\ UNC ↔ distro-absolute),
 *   2. wraps a full Linux argv into a single `wsl.exe -d <distro> -e bash -c`
 *      invocation (cd into the translated workdir, export RELION_HOME /
 *      PATH / RELION_CTFFIND_EXECUTABLE, exec the command with sh-safe
 *      quoting),
 *   3. resolves the WSL-side toolchain discovered by the system probe
 *      (mpirun, relion_refine_mpi, ctffind) so MPI jobs and CTF estimation
 *      work exactly like the sandbox's MPICH build.
 *
 * Pure path helpers are exported for reuse (import folder normalization,
 * manualpick star-path resolution, stop-tree pkill patterns).
 */

import type { RelionStatus } from "./system";

/** Toolchain facts the engine needs when relaying jobs into WSL. */
export interface WslBridge {
  /** Distro name (null → WSL default distro). */
  distro: string | null;
  /** RELION bin dir INSIDE the distro (e.g. /home/user/relion/bin). */
  binDir: string;
  /** RELION install root inside the distro. */
  relionHome: string;
  /** mpirun path inside the distro (null → serial binaries only). */
  mpirun: string | null;
  /** ctffind path inside the distro (null → CTF jobs cannot run). */
  ctffind: string | null;
  /** relion_refine_mpi exists in the distro bin dir. */
  hasMpiBinary: boolean;
}

/**
 * Active bridge for a detected status, or null when jobs run natively
 * (host install / server inside the distro fs / nothing found).
 */
export function bridgeFromStatus(status: RelionStatus): WslBridge | null {
  if (status.execution !== "wsl") return null;
  if (!status.wsl.available || !status.wsl.relionPath) return null;
  return {
    distro: status.wsl.distro,
    binDir: status.wsl.relionPath,
    relionHome:
      status.wsl.relionHome ?? status.wsl.relionPath.replace(/\/bin\/?$/, ""),
    mpirun: status.wsl.mpirunPath ?? null,
    ctffind: status.wsl.ctffindPath ?? null,
    hasMpiBinary: status.wsl.mpiBinary ?? false,
  };
}

/* ------------------------------------------------------------------ */
/* Path translation                                                     */
/* ------------------------------------------------------------------ */

/** Matches Windows drive paths (C:\x / C:/x) and UNC paths (\\wsl$\…, \\server\…). */
export function isWindowsPath(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p) || /^\\\\/.test(p);
}

/** Host (Windows) path → WSL-side path. POSIX paths pass through unchanged. */
export function hostToWsl(p: string): string {
  // \\wsl.localhost\Debian\home\x → /home/x   (also \\wsl$\Debian\…)
  const unc = p.match(/^\\\\wsl(?:\.localhost|\$)\\[^\\]+\\(.*)$/i);
  if (unc) return "/" + unc[1].replace(/\\/g, "/");
  const drive = p.match(/^([A-Za-z]):[\\/](.*)$/);
  if (drive) return `/mnt/${drive[1].toLowerCase()}/${drive[2].replace(/\\/g, "/")}`;
  return p;
}

/**
 * WSL-side path → a path this Node process can open.
 *  - /mnt/c/… → C:\…  (Windows drive content)
 *  - other absolute distro paths → \\wsl.localhost\<distro>\… UNC (needs distro)
 * POSIX hosts get the path back unchanged.
 */
export function wslToHost(p: string, distro: string | null): string {
  const mnt = p.match(/^\/mnt\/([A-Za-z])\/(.*)$/);
  if (mnt) return `${mnt[1].toUpperCase()}:\\${mnt[2].replace(/\//g, "\\")}`;
  if (p.startsWith("/") && distro) {
    return `\\\\wsl.localhost\\${distro}\\${p.slice(1).replace(/\//g, "\\")}`;
  }
  return p;
}

/** POSIX-style separators + forward slashes (for STAR files / argv). */
export function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Join a binary name onto an install bin dir WITHOUT path.join. binDir can
 * be a distro-internal POSIX path (/home/u/relion/bin) when jobs run through
 * the WSL bridge — on a Windows host path.win32.join normalizes that into
 * \home\u\relion\bin\… (the leading "/" is read as the current drive's root
 * and every "/" becomes "\"), the bridge cannot recognize the mangled form,
 * bash execs a path that does not exist inside the distro and the job dies
 * instantly with no outputs (surfacing as "interrupted (exit unknown)").
 * Plain "/" concat is correct for POSIX dirs and equally valid for native
 * Windows dirs (fs + spawn accept forward slashes on every platform).
 */
export function binJoin(binDir: string, name: string): string {
  return `${binDir.replace(/[\\/]+$/, "")}/${name}`;
}

/** sh single-quote (safe inside a bash -c script). */
export function shq(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/* ------------------------------------------------------------------ */
/* Command wrapping                                                     */
/* ------------------------------------------------------------------ */

export interface WrappedCommand {
  /** Host-side executable (always wsl.exe). */
  file: string;
  /** argv for spawn(). */
  args: string[];
  /** Human-readable form stored in run records / shown in the log panel. */
  display: string;
}

/**
 * t427 — the tracked-run file contract (the immortality quartet).
 *
 * `out`/`err` are the log files as before. `exit` is the SENTINEL the
 * distro-side wrapper writes when the command finishes (`run.exit`), and
 * `pid` is the wrapper's distro-side pid (`run.pid`) — together they let a
 * RESTARTED server learn the truth about a run whose host-side wsl.exe
 * relay died with the old server instance (see wrapWslCommand).
 */
export interface WslRunFiles {
  out: string;
  err: string;
  /** Sentinel file receiving the command's final exit code. */
  exit: string;
  /** File receiving the distro-side wrapper pid (for kill -0 probes). */
  pid: string;
}

/**
 * Wrap a Linux argv into one wsl.exe invocation. Windows-style path ARGUMENTS
 * (drive letters — workdir/input/output paths built on the host) are
 * translated to /mnt/<drive>/…; arguments that are already POSIX (binaries,
 * mpirun, ctffind) pass through untouched.
 *
 * LOG REDIRECTION (the Windows log fix): when `logFiles` is given, the whole
 * script runs inside a bash block whose stdout/stderr are redirected to the
 * WSL-translated run.out/run.err — the SAME physical files the Windows host
 * reads for the Log tab, progress parsing and failure diagnostics. This
 * removes all dependence on wsl.exe's stdio handle relay, which does NOT
 * reliably forward inherited file handles to the Linux process in detached
 * + windowsHide mode (observed live: run.out/run.err stuck at 0 bytes while
 * the job happily wrote its outputs). Linux-side `>>` opens the file through
 * drvfs, so every write lands on the Windows filesystem immediately.
 *
 * t427 — THE IMMORTAL WRAPPER (the service-restart death fix). The old
 * script was the distro command ITSELF, tied to the wsl.exe session: when
 * the host-side service died (dev-server restart, Ctrl-C on the console,
 * crash), WSL tore the session down and took the RELION tree with it —
 * the user's field report: 「服务重启或死掉后，relion中运行的任务也会
 * 一起死掉」. The new shape separates the RELAY from the RUN:
 *
 *   outer bash  (session-bound, dies with wsl.exe — fine, it is only a
 *                poll loop that relays the true exit code while it lives)
 *   inner bash  (setsid → its OWN session inside the distro; survives the
 *                death of wsl.exe, the outer bash and the whole host-side
 *                service; writes run.pid at birth and run.exit at death
 *                through an EXIT trap, so every ending — success, crash,
 *                cd failure — leaves the sentinel behind)
 *
 * A restarted server reads run.exit (finalized) or probes run.pid inside
 * the distro (still running → keep showing progress) — see
 * reconcileRealJobs' bridged branch. `setsid` lives in util-linux (every
 * mainstream WSL distro ships it); when absent the wrapper degrades to
 * the old session-bound behavior — the exit-code relay still works, only
 * the immortality is lost.
 */
export function wrapWslCommand(
  argv: string[],
  hostCwd: string,
  bridge: WslBridge,
  logFiles?: WslRunFiles
): WrappedCommand {
  const wslCwd = hostToWsl(hostCwd);
  const translate = (a: string) => {
    if (isWindowsPath(a)) return hostToWsl(a);
    // Defense in depth: path.win32.join mangles distro-internal POSIX
    // paths into \home\u\… (single leading backslash, no drive letter) —
    // restore the POSIX separators so an exec target leaked in through
    // any future code path still resolves inside the distro.
    if (a.startsWith("\\") && !a.startsWith("\\\\")) return toPosix(a);
    return a;
  };
  const exports: string[] = [
    `cd ${shq(wslCwd)} || exit 111`,
    `export RELION_HOME=${shq(bridge.relionHome)}`,
    `export PATH=${shq(bridge.binDir)}:"$PATH"`,
    // OpenMPI 4+ REFUSES to run as root: a WSL distro whose default user is
    // root makes every MPI job (class2d/class3d/refine3d/multibody/…) die at
    // launch with "…set OMPI_ALLOW_RUN_AS_ROOT=1… and OMPI_ALLOW_RUN_AS_ROOT
    // _CONFIRM=1…" and exit 1. These two opt-ins are the upstream-sanctioned
    // override; MPICH (the sandbox toolchain) ignores them — harmless there.
    // Non-root users never hit the check, so the variables are inert.
    `export OMPI_ALLOW_RUN_AS_ROOT=1`,
    `export OMPI_ALLOW_RUN_AS_ROOT_CONFIRM=1`,
    `export OMPI_MCA_btl='self,tcp'`,
  ];
  if (bridge.ctffind) {
    exports.push(`export RELION_CTFFIND_EXECUTABLE=${shq(bridge.ctffind)}`);
  }
  const cmdline = argv.map((a) => shq(translate(a))).join(" ");

  let script: string;
  if (logFiles) {
    const out = shq(hostToWsl(logFiles.out));
    const err = shq(hostToWsl(logFiles.err));
    const exit = shq(hostToWsl(logFiles.exit));
    const pidf = shq(hostToWsl(logFiles.pid));
    // INNER: own session (via setsid), pid + sentinel always recorded.
    // The EXIT trap makes the sentinel universal — the natural end (cmd's
    // own code), a cd failure (111) and any explicit exit all leave
    // run.exit behind; only SIGKILL can skip it (the outer death-watch
    // and the reconcile interrupt path cover that).
    const inner = [
      `echo $$ > ${pidf}`,
      `trap 'c=$?; echo $c > ${exit}.tmp && mv ${exit}.tmp ${exit}' EXIT`,
      `{ ${exports.join("; ")}; ${cmdline}; } >> ${out} 2>> ${err}`,
    ].join("\n");
    // OUTER: session-bound relay — spawn the inner, then poll the
    // sentinel (never the inner's pid from the child table: setsid orphans
    // it, but run.pid + kill -0 works across sessions). While wsl.exe
    // lives, the true exit code still reaches the host exit handler
    // exactly as before; when it dies, the inner carries on and a
    // restarted server takes over from the sentinel.
    //
    // The waits counter bounds the pathological case: a workdir so broken
    // that the inner could write NEITHER its pid NOR the sentinel (both
    // files live there). Without it the poll loop would spin forever —
    // instead the relay exits 125 after ~15s and the job fails honestly.
    script = [
      `rm -f ${exit} ${exit}.tmp ${pidf}`,
      `waits=0`,
      `if command -v setsid >/dev/null 2>&1; then`,
      `  setsid bash -c ${shq(inner)} </dev/null >/dev/null 2>&1 &`,
      `else`,
      `  bash -c ${shq(inner)} </dev/null >/dev/null 2>&1 &`,
      `fi`,
      `while [ ! -f ${exit} ]; do`,
      `  if [ -f ${pidf} ]; then`,
      `    p=$(cat ${pidf} 2>/dev/null)`,
      `    if [ -n "$p" ] && ! kill -0 "$p" 2>/dev/null; then`,
      `      sleep 1`,
      `      [ -f ${exit} ] || exit 137`,
      `    fi`,
      `  elif [ "$waits" -ge 15 ]; then`,
      `    exit 125`,
      `  fi`,
      `  waits=$((waits+1))`,
      `  sleep 1`,
      `done`,
      `exit $(cat ${exit})`,
    ].join("\n");
  } else {
    script = [...exports, `exec ${cmdline}`].join("; ");
  }

  const args: string[] = [];
  if (bridge.distro) args.push("-d", bridge.distro);
  args.push("-e", "bash", "-c", script);
  const display = `wsl${bridge.distro ? ` -d ${bridge.distro}` : ""} -- bash -c ${script}`;
  return { file: "wsl.exe", args, display };
}

/**
 * Best-effort stop command for processes the bridge left inside the distro:
 * pkill -f matches the RELION argv (which always embeds the translated
 * workdir via --o / --i), so this reaches mpirun and every rank.
 *
 * Takes the distro NAME (not a full bridge) so the engine can stop a run
 * from its RECORD alone — the wrapped command embeds "wsl -d <distro>" —
 * without depending on the live detection state (which may be mid-refresh
 * or failed exactly when a stop is needed).
 */
export function wslStopArgs(workdir: string, distro: string | null): string[] {
  const pattern = hostToWsl(workdir);
  const args: string[] = [];
  if (distro) args.push("-d", distro);
  args.push("-e", "pkill", "-f", "--", pattern);
  return args;
}
