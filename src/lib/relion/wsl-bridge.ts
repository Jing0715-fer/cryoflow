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
 * Wrap a Linux argv into one wsl.exe invocation. Windows-style path ARGUMENTS
 * (drive letters — workdir/input/output paths built on the host) are
 * translated to /mnt/<drive>/…; arguments that are already POSIX (binaries,
 * mpirun, ctffind) pass through untouched.
 *
 * The script `cd`s into the translated workdir (fails hard with exit 111 when
 * impossible), exports the RELION environment, then execs the command — so
 * wsl.exe's exit code + stdio are exactly the Linux command's.
 */
export function wrapWslCommand(
  argv: string[],
  hostCwd: string,
  bridge: WslBridge
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
  ];
  if (bridge.ctffind) {
    exports.push(`export RELION_CTFFIND_EXECUTABLE=${shq(bridge.ctffind)}`);
  }
  const script = [
    ...exports,
    `exec ${argv.map((a) => shq(translate(a))).join(" ")}`,
  ].join("; ");

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
