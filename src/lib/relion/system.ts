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
import { existsSync } from "fs";
import os from "os";
import path from "path";
import type { SystemStatusClient } from "@/lib/types";

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
  const { stdout, stderr } = await execFileAsync(
    path.join(binDir, "relion_refine"),
    ["--version"],
    8000
  );
  const text = `${stdout}\n${stderr}`;
  // "RELION version: 5.0.1-commit-d476e6" / "RELION v4.0" / "RELION 3.1.2"
  const match = text.match(/RELION\s*(?:version)?[:\s]*v?(\d+\.\d+(?:\.\d+)?)/i);
  if (match) return match[1];
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
/* ------------------------------------------------------------------ */

async function probeWsl(): Promise<RelionStatus["wsl"]> {
  const wslPath = (await which("wsl.exe", 2000)) ?? (await which("wsl", 2000));
  if (!wslPath) {
    return {
      available: false,
      relionPath: null,
      note: "WSL is not available on this host — RELION must be installed natively (or set RELION_HOME).",
    };
  }
  const { stdout } = await execFileAsync(wslPath, ["-e", "which", "relion_refine"], 8000);
  const relionPath = stdout.trim().length > 0 ? stdout.trim() : null;
  return {
    available: true,
    relionPath,
    note: relionPath
      ? `RELION detected inside WSL at ${relionPath}. Run jobs through the WSL bridge (wsl -e <cmd>).`
      : "WSL is available but RELION was not found inside it (wsl -e which relion_refine).",
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
