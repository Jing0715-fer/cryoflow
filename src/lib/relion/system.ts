/**
 * CryoFlow — RELION 5 environment detection (SERVER ONLY, no "use client").
 *
 * Candidate sources, in order:
 *   a) process.env.RELION_HOME + /bin
 *   b) PATH lookup: `which relion_refine`
 *   c) known install paths (including the sandbox build target /home/z/relion-install/bin)
 *
 * Also probes WSL availability (for Windows hosts running CryoFlow natively) and
 * common external programs (MotionCor2 / ctffind / Gctf / Topaz).
 * Results are cached in-module for 60 seconds.
 */

import { execFile } from "child_process";
import { existsSync, readdirSync } from "fs";
import os from "os";
import path from "path";
import type { SystemStatusClient, WslStatusClient } from "@/lib/types";

/** Full server-side RELION status (same shape as the client mirror). */
export type RelionStatus = SystemStatusClient;

/* ------------------------------------------------------------------ */
/* Small exec helpers                                                   */
/* ------------------------------------------------------------------ */

function execFileAsync(
  file: string,
  args: string[],
  timeout: number
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout, windowsHide: true },
      (error, stdout, stderr) => {
        // resolve in ALL cases — detection must never crash
        resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
        void error;
      }
    );
  });
}

/** `which <name>` → trimmed path or null. */
async function which(name: string, timeout = 2000): Promise<string | null> {
  const { stdout, stderr } = await execFileAsync("which", [name], timeout);
  const out = (stdout || stderr).trim().split("\n")[0] ?? "";
  return out.length > 0 && out.includes("/") ? out : null;
}

/* ------------------------------------------------------------------ */
/* Binary lists                                                         */
/* ------------------------------------------------------------------ */

/** Key RELION binaries we care about (existence is checked inside binDir). */
const CORE_BINARIES = [
  "relion_refine",
  "relion_preprocess",
  "relion_postprocess",
  "relion_mask_create",
  "relion_star_handler",
  "relion_ctf_refine",
  "relion_motion_refine",
  "relion_particle_subtract",
  "relion_run_ctffind",
  "relion_run_motioncorr",
  "relion_tomo_align",
  "relion_tomo_reconstruct_tomogram",
  "relion_tomo_subtomo",
  "relion_tomo_refine_ctf",
  "relion_tomo_reconstruct_particle",
  "relion_align_tiltseries",
];

/** External programs RELION jobs may wrap. */
const EXTERNAL_PROGRAMS = ["motioncor2", "ctffind", "gctf", "topaz"];

/** Candidate install directories (all must be absolute). */
/**
 * Scan the home directory (one level deep into well-known dev roots) for
 * relion-ish install dirs — covers builds like ~/relion5-build-cuda-fixed/bin,
 * ~/myproject/relion5-pkg/bin, ~/src/relion-5.0.1/... without hardcoding.
 */
function searchHomeCandidates(): string[] {
  const home = os.homedir();
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (dir: string) => {
    if (!seen.has(dir)) {
      out.push(dir);
      seen.add(dir);
    }
  };
  try {
    for (const entry of readdirSync(home)) {
      const top = path.join(home, entry);
      if (/relion/i.test(entry)) {
        push(path.join(top, "bin"));
      } else if (/^(myproject|my-project|src|build|builds|code|dev|projects|tools|opt)$/i.test(entry)) {
        try {
          for (const sub of readdirSync(top)) {
            if (/relion/i.test(sub)) push(path.join(top, sub, "bin"));
          }
        } catch {
          // unreadable subdir — skip
        }
      }
    }
  } catch {
    // unreadable home — skip
  }
  return out;
}

function candidateDirs(): string[] {
  const candidates: string[] = [];
  if (process.env.RELION_HOME) {
    candidates.push(path.join(process.env.RELION_HOME, "bin"));
    candidates.push(process.env.RELION_HOME);
  }
  const home = os.homedir();
  candidates.push(
    "/home/z/relion-install/bin",
    "/usr/local/bin",
    "/opt/relion/bin",
    path.join(home, "relion-install/bin"),
    path.join(home, "relion/bin")
  );
  candidates.push(...searchHomeCandidates());
  return candidates;
}

/** A bin dir is valid when it exists and contains relion_refine (or _mpi). */
function isValidBinDir(dir: string): boolean {
  try {
    return (
      existsSync(path.join(dir, "relion_refine")) ||
      existsSync(path.join(dir, "relion_refine_mpi"))
    );
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Version probing                                                      */
/* ------------------------------------------------------------------ */

async function probeVersion(binDir: string): Promise<string | null> {
  // try both the non-MPI and MPI refine binaries (builds may ship either)
  for (const exe of ["relion_refine", "relion_refine_mpi"]) {
    const exePath = path.join(binDir, exe);
    if (!existsSync(exePath)) continue;
    const { stdout, stderr } = await execFileAsync(exePath, ["--version"], 8000);
    const text = `${stdout}\n${stderr}`;
    // "RELION version: 5.0.1-commit-d476e6" / "RELION v4.0" / "RELION 3.1.2"
    const match = text.match(/RELION\s*(?:version)?[:\s]*v?(\d+\.\d+(?:\.\d+)?)/i);
    if (match) return match[1];
    break; // ran but unparseable — fall through to inference
  }
  // Fall back: presence of the tomo toolchain implies RELION 5.x
  if (
    existsSync(path.join(binDir, "relion_tomo_align")) &&
    existsSync(path.join(binDir, "relion_tomo_reconstruct_tomogram"))
  ) {
    return "5.x (inferred)";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* WSL detection (never crashes when wsl.exe is absent)                 */
/*                                                                      */
/* Three discovery stages inside the default distro:                    */
/*   1. login-shell PATH   (bash -lc → sources ~/.profile + ~/.bashrc,  */
/*                          so "export PATH=..." in .bashrc works)      */
/*   2. $RELION_HOME env   (bash -lc 'echo $RELION_HOME')               */
/*   3. filesystem search  (common install layouts, incl. build dirs    */
/*                          like ~/relion5-build-cuda-fixed/bin)        */
/* Stage 1 also means the honest "not on PATH" answer distinguishes     */
/* WSL itself from RELION-on-PATH — no more false "WSL unavailable".    */
/* ------------------------------------------------------------------ */

/** Run a shell snippet inside the WSL default distro (login shell when login). */
async function wslBash(
  wslPath: string,
  snippet: string,
  login: boolean,
  timeout: number
): Promise<string> {
  const args = login
    ? ["-e", "bash", "-lc", snippet]
    : ["-e", "bash", "-c", snippet];
  const { stdout, stderr } = await execFileAsync(wslPath, args, timeout);
  return stdout.trim() || stderr.trim();
}

async function probeWsl(): Promise<WslStatusClient> {
  const unavailable = (
    reason: "no-wsl" | "no-distro",
    note: string
  ): WslStatusClient => ({
    available: false,
    unavailableReason: reason,
    relionPath: null,
    relionHome: null,
    version: null,
    source: null,
    distro: null,
    note,
  });

  // 0. locate wsl.exe — on Windows hosts it is always resolvable through PATH
  let wslPath: string | null;
  if (process.platform === "win32") {
    wslPath = "wsl.exe";
  } else {
    wslPath = (await which("wsl.exe", 2000)) ?? (await which("wsl", 2000));
  }
  if (!wslPath) {
    return unavailable(
      "no-wsl",
      "WSL is not installed on this host (no wsl.exe) — install RELION natively or point RELION_HOME at an existing install."
    );
  }

  // 1. WSL sanity + distro name (ASCII-safe: echo from inside the distro;
  //    `wsl --list` output is UTF-16LE on Windows and unusable here).
  const sanity = await wslBash(
    wslPath,
    'echo "ok-${WSL_DISTRO_NAME:-unknown}"',
    false,
    8000
  );
  if (!sanity.startsWith("ok-")) {
    return unavailable(
      "no-distro",
      "WSL is installed but no distro responded (run `wsl --list --verbose`; if none is registered, `wsl --install -d Ubuntu` and re-detect)."
    );
  }
  const distro = sanity.slice(3) || null;

  // 2a. login-shell PATH — picks up "export PATH=...:$PATH" from ~/.bashrc
  //     (the most common way RELION builds get exposed).
  const loginHit = await wslBash(
    wslPath,
    "command -v relion_refine || command -v relion_refine_mpi || true",
    true,
    8000
  );
  let binDir = loginHit ? path.posix.dirname(loginHit.split("\n")[0]) : null;
  let source = binDir ? "login-shell PATH" : null;

  // 2b. $RELION_HOME env (loaded by the same login shell)
  if (!binDir) {
    const relionHome = await wslBash(
      wslPath,
      'printf "%s" "$RELION_HOME"',
      true,
      4000
    );
    if (relionHome && relionHome.startsWith("/")) {
      const cand = relionHome.replace(/\/+$/, "").endsWith("/bin")
        ? relionHome.replace(/\/+$/, "")
        : `${relionHome.replace(/\/+$/, "")}/bin`;
      const ok = await wslBash(
        wslPath,
        `test -x '${cand}/relion_refine' -o -x '${cand}/relion_refine_mpi' && echo yes || true`,
        false,
        4000
      );
      if (ok.startsWith("yes")) {
        binDir = cand;
        source = "RELION_HOME env";
      }
    }
  }

  // 2c. filesystem search across common install layouts (bounded, one call)
  if (!binDir) {
    const searchScript = [
      "for d in",
      '"$HOME"/relion*/bin "$HOME"/myproject/relion*/bin "$HOME"/my-project/relion*/bin',
      '"$HOME"/src/relion*/bin "$HOME"/build/relion*/bin "$HOME"/builds/relion*/bin',
      '"$HOME"/code/relion*/bin "$HOME"/tools/relion*/bin',
      "/usr/local/relion*/bin /opt/relion*/bin /opt/relion*/*/bin",
      "/home/*/relion*/bin /home/*/myproject/relion*/bin /home/*/my-project/relion*/bin",
      "/home/*/src/relion*/bin /home/*/relion-build/*/bin",
      "; do",
      'test -x "$d/relion_refine" -o -x "$d/relion_refine_mpi" && { echo "$d"; exit 0; }',
      "done; true",
    ].join(" ");
    const hit = await wslBash(wslPath, searchScript, false, 15000);
    if (hit.startsWith("/")) {
      binDir = hit.split("\n")[0];
      source = "filesystem search";
    }
  }

  // 3. not found anywhere → honest, actionable guidance (NOT "WSL unavailable")
  if (!binDir) {
    const note = [
      `WSL distro "${distro ?? "default"}" is up, but RELION is not on its PATH and no common install layout matched.`,
      "If RELION IS installed inside WSL, expose it one of these ways, then press Re-detect:",
      'A) echo \'export PATH=/path/to/relion/bin:$PATH\' >> ~/.bashrc   (login-shell probe picks this up)',
      "B) sudo ln -sf /path/to/relion/bin/relion* /usr/local/bin/",
      "C) echo 'export RELION_HOME=/path/to/relion' >> ~/.bashrc",
      "Searched automatically: ~/relion*/bin, ~/myproject/relion*/bin, ~/my-project/relion*/bin, ~/src|build|code/relion*/bin, /usr/local/relion*/bin, /opt/relion*/bin",
    ].join("\n");
    return {
      available: true,
      unavailableReason: null,
      relionPath: null,
      relionHome: null,
      version: null,
      source: null,
      distro,
      note,
    };
  }

  // 4. found → version probe inside the distro
  const versionOut = await wslBash(
    wslPath,
    `"${binDir}/relion_refine" --version 2>&1 || "${binDir}/relion_refine_mpi" --version 2>&1 || true`,
    false,
    10000
  );
  const vMatch = versionOut.match(
    /RELION\s*(?:version)?[:\s]*v?(\d+\.\d+(?:\.\d+)?)/i
  );
  const version = vMatch ? vMatch[1] : null;
  const relionHome = binDir.replace(/\/bin\/?$/, "");

  const note =
    source === "login-shell PATH"
      ? `RELION ${version ?? "?"} detected inside WSL (${distro ?? "default"}) at ${binDir} — via login-shell PATH. Jobs can run through the WSL bridge.`
      : `RELION ${version ?? "?"} found inside WSL (${distro ?? "default"}) at ${binDir} via ${source} — not on the default PATH. Jobs can still use it; for shell convenience add it to ~/.bashrc (option A in guidance below).`;

  return {
    available: true,
    unavailableReason: null,
    relionPath: binDir,
    relionHome,
    version,
    source,
    distro,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* Main entry point (60s in-module cache)                               */
/* ------------------------------------------------------------------ */

let cache: { at: number; status: RelionStatus } | null = null;
const CACHE_MS = 60_000;

export async function detectRelion(force = false): Promise<RelionStatus> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.status;
  }

  // ---- locate a bin dir -------------------------------------------------
  let pathFound: string | null = null;
  let source: string | null = null;

  if (process.env.RELION_HOME) {
    const dir = path.join(process.env.RELION_HOME, "bin");
    if (isValidBinDir(dir)) {
      pathFound = dir;
      source = "RELION_HOME";
    }
  }

  if (!pathFound) {
    const onPath = await which("relion_refine", 3000);
    if (onPath) {
      const dir = path.dirname(onPath);
      if (isValidBinDir(dir)) {
        pathFound = dir;
        source = "PATH";
      }
    }
  }

  if (!pathFound) {
    for (const dir of candidateDirs()) {
      if (isValidBinDir(dir)) {
        pathFound = dir;
        source = "known-path";
        break;
      }
    }
  }

  // ---- version ----------------------------------------------------------
  let version: string | null = null;
  if (pathFound) {
    version = await probeVersion(pathFound);
  }

  // ---- binaries + externals ----------------------------------------------
  const binaries = CORE_BINARIES.map((name) => ({
    name,
    present: pathFound ? existsSync(path.join(pathFound, name)) : false,
  }));

  const externals: RelionStatus["externals"] = [];
  for (const name of EXTERNAL_PROGRAMS) {
    let present = (await which(name, 2000)) !== null;
    if (!present && pathFound) {
      present = existsSync(path.join(pathFound, name));
    }
    externals.push({ name, present });
  }

  // ---- WSL ---------------------------------------------------------------
  const wsl = await probeWsl();

  const status: RelionStatus = {
    found: pathFound !== null,
    version,
    path: pathFound,
    source,
    wsl,
    binaries,
    externals,
    checkedAt: new Date().toISOString(),
  };

  cache = { at: Date.now(), status };
  return status;
}
