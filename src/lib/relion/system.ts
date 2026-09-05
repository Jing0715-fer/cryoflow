/**
 * CryoFlow — RELION environment detection (SERVER ONLY, no "use client").
 *
 * Scans the host (and WSL distros when present) for EVERY RELION install,
 * probes each version, and composes the status around the SELECTED install:
 *   - selection persists in data/relion-select.json ({ installId })
 *   - missing/stale selection → auto-pick by priority (RELION_HOME > PATH >
 *     known path > home scan > WSL bridge)
 *   - POST /api/system/select switches the active install at runtime
 *
 * Candidate sources per native install:
 *   a) process.env.RELION_HOME + /bin
 *   b) PATH lookup: `which relion_refine`
 *   c) known install paths (incl. the sandbox build target /home/z/relion-install/bin)
 *   d) home-directory scan (one level into well-known dev roots)
 * WSL installs: login-shell PATH, $RELION_HOME, filesystem search — ALL hits.
 * Results are cached in-module for 60 seconds.
 */

import { execFile } from "child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { DATA_DIR } from "@/lib/paths";
import type { SystemStatusClient, WslStatusClient } from "@/lib/types";

/** Full server-side RELION status (same shape as the client mirror). */
export type RelionStatus = SystemStatusClient;

/** Bundled dependency stack (sandbox / engine-relion-env parity). */
const DEPS_CTFFIND = "/home/z/relion-build/deps/ctffind/bin/ctffind";

/** Resolve the ctffind executable a NATIVE install would use (PATH → bin dir → bundled deps). */
async function resolveNativeCtffind(binDir: string): Promise<string | null> {
  const onPath = await which("ctffind", 2000);
  if (onPath) return onPath;
  if (existsSync(path.join(binDir, "ctffind"))) return path.join(binDir, "ctffind");
  if (existsSync(DEPS_CTFFIND)) return DEPS_CTFFIND;
  return null;
}

/** One discovered RELION install (native or inside a WSL distro). */
export interface RelionInstall {
  /** Stable selection key: "n:<binDir>" | "w:<distro>:<binDir>". */
  id: string;
  /** Parsed RELION version (null when unparseable). */
  version: string | null;
  /** bin dir (host path for native, distro-internal path for WSL). */
  path: string;
  /** Install root (parent of bin/). */
  relionHome: string;
  /** How this install was discovered. */
  source: string;
  /** "native": this process spawns the binaries directly. "wsl": bridge. */
  execution: "native" | "wsl";
  /** WSL distro name (WSL installs only). */
  distro: string | null;
  /** mpirun path (distro-internal for WSL installs; null → serial only). */
  mpirunPath: string | null;
  /** relion_refine_mpi present (MPI-capable install). */
  mpiBinary: boolean;
  /** ctffind path (null → CTF estimation jobs cannot run on this install). */
  ctffindPath: string | null;
}

/* ------------------------------------------------------------------ */
/* Selection persistence (data/relion-select.json)                      */
/* ------------------------------------------------------------------ */

const SELECT_FILE = path.join(DATA_DIR, "relion-select.json");

function readSelectedId(): string | null {
  try {
    const parsed = JSON.parse(readFileSync(SELECT_FILE, "utf8")) as {
      installId?: unknown;
    };
    return typeof parsed.installId === "string" && parsed.installId.length > 0
      ? parsed.installId
      : null;
  } catch {
    return null;
  }
}

function writeSelectedId(id: string | null): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(SELECT_FILE, JSON.stringify({ installId: id }, null, 2));
  } catch {
    /* best effort — auto-pick still works without persistence */
  }
}

/** Auto-pick the default install by priority when nothing is selected. */
function pickDefaultInstall(installs: RelionInstall[]): RelionInstall | null {
  if (installs.length === 0) return null;
  const by = (fn: (i: RelionInstall) => boolean) => installs.find(fn) ?? null;
  return (
    by((i) => i.execution === "native" && i.source === "RELION_HOME") ??
    by((i) => i.execution === "native" && i.source === "PATH") ??
    by((i) => i.execution === "native" && i.source === "known-path") ??
    by((i) => i.execution === "native") ??
    installs[0]
  );
}

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

/** Scan the home directory (one level deep into well-known dev roots). */
function searchHomeCandidates(): { dir: string; source: string }[] {
  const home = os.homedir();
  const out: { dir: string; source: string }[] = [];
  const seen = new Set<string>();
  const push = (dir: string) => {
    if (!seen.has(dir)) {
      out.push({ dir, source: "home scan" });
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

interface NativeCandidate {
  dir: string;
  source: string;
}

function candidateDirs(): NativeCandidate[] {
  const candidates: NativeCandidate[] = [];
  if (process.env.RELION_HOME) {
    candidates.push({ dir: path.join(process.env.RELION_HOME, "bin"), source: "RELION_HOME" });
    candidates.push({ dir: process.env.RELION_HOME, source: "RELION_HOME" });
  }
  const home = os.homedir();
  for (const dir of [
    "/home/z/relion-install/bin",
    "/usr/local/bin",
    "/opt/relion/bin",
    path.join(home, "relion-install/bin"),
    path.join(home, "relion/bin"),
  ]) {
    candidates.push({ dir, source: "known-path" });
  }
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

/** Canonical path for dedupe (realpath when resolvable, else as-is). */
function canonical(dir: string): string {
  try {
    return realpathSync(dir);
  } catch {
    return dir;
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

/** Locate wsl.exe — on Windows hosts it is always resolvable through PATH. */
async function locateWslExe(): Promise<string | null> {
  if (process.platform === "win32") return "wsl.exe";
  return (await which("wsl.exe", 2000)) ?? (await which("wsl", 2000));
}

/**
 * Verify RELION binaries + external programs INSIDE the WSL distro (one bash
 * call per list). The host filesystem cannot see WSL-side paths, so
 * existsSync-based checks would report everything as missing.
 */
async function probeWslBinaries(
  wslPath: string,
  binDir: string,
  bins: string[],
  exts: string[]
): Promise<{ bins: Set<string>; exts: Set<string> }> {
  const present = { bins: new Set<string>(), exts: new Set<string>() };
  const q = binDir.replace(/'/g, `'\\''`);
  const script = [
    // NOTE: $b/$e must stay OUTSIDE the single-quoted path — inside single
    // quotes bash never expands them and every check would fail silently.
    `for b in ${bins.join(" ")}; do test -x '${q}'/"$b" && echo "B:$b"; done`,
    `for e in ${exts.join(" ")}; do { command -v "$e" >/dev/null 2>&1 || test -x '${q}'/"$e"; } && echo "E:$e"; done`,
  ].join("; ");
  const { stdout } = await execFileAsync(
    wslPath,
    ["-e", "bash", "-lc", script],
    15000
  );
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (t.startsWith("B:")) present.bins.add(t.slice(2));
    else if (t.startsWith("E:")) present.exts.add(t.slice(2));
  }
  return present;
}

/** One WSL distro's full probe: distro name + every RELION install found. */
interface WslProbe {
  available: boolean;
  unavailableReason: "no-wsl" | "no-distro" | null;
  distro: string | null;
  installs: RelionInstall[];
  /** Guidance note when the distro is up but no RELION was found. */
  note: string;
}

async function probeWsl(): Promise<WslProbe> {
  const empty = (reason: "no-wsl" | "no-distro", note: string): WslProbe => ({
    available: false,
    unavailableReason: reason,
    distro: null,
    installs: [],
    note,
  });

  // 0. locate wsl.exe — on Windows hosts it is always resolvable through PATH
  const wslPath = await locateWslExe();
  if (!wslPath) {
    return empty(
      "no-wsl",
      "WSL is not installed on this host (no wsl.exe) — install RELION natively or point RELION_HOME at an existing install."
    );
  }

  // 1. WSL sanity + distro name (ASCII-safe: echo from inside the distro).
  const sanity = await wslBash(
    wslPath,
    'echo "ok-${WSL_DISTRO_NAME:-unknown}"',
    false,
    8000
  );
  if (!sanity.startsWith("ok-")) {
    return empty(
      "no-distro",
      "WSL is installed but no distro responded (run `wsl --list --verbose`; if none is registered, `wsl --install -d Ubuntu` and re-detect)."
    );
  }
  const distro = sanity.slice(3) || null;

  // Collect EVERY install: login-shell PATH, $RELION_HOME, filesystem search.
  const found = new Map<string, { source: string }>(); // binDir → source
  const addHit = (dir: string, source: string) => {
    const d = dir.replace(/\/+$/, "");
    if (d.endsWith("/bin") && !found.has(d)) found.set(d, { source });
  };

  // 2a. login-shell PATH — picks up "export PATH=...:$PATH" from ~/.bashrc
  const loginHit = await wslBash(
    wslPath,
    "command -v relion_refine || command -v relion_refine_mpi || true",
    true,
    8000
  );
  if (loginHit.startsWith("/")) {
    addHit(path.posix.dirname(loginHit.split("\n")[0]), "login-shell PATH");
  }

  // 2b. $RELION_HOME env (loaded by the same login shell)
  const relionHome = await wslBash(
    wslPath,
    'printf "%s" "$RELION_HOME"',
    true,
    4000
  );
  if (relionHome.startsWith("/")) {
    const cand = relionHome.replace(/\/+$/, "").endsWith("/bin")
      ? relionHome.replace(/\/+$/, "")
      : `${relionHome.replace(/\/+$/, "")}/bin`;
    const ok = await wslBash(
      wslPath,
      `test -x '${cand.replace(/'/g, `'\\''`)}/relion_refine' -o -x '${cand.replace(/'/g, `'\\''`)}/relion_refine_mpi' && echo yes || true`,
      false,
      4000
    );
    if (ok.startsWith("yes")) addHit(cand, "RELION_HOME env");
  }

  // 2c. filesystem search across common install layouts — ALL hits (≤8)
  const searchScript = [
    "for d in",
    '"$HOME"/relion*/bin "$HOME"/myproject/relion*/bin "$HOME"/my-project/relion*/bin',
    '"$HOME"/src/relion*/bin "$HOME"/build/relion*/bin "$HOME"/builds/relion*/bin',
    '"$HOME"/code/relion*/bin "$HOME"/tools/relion*/bin',
    "/usr/local/relion*/bin /opt/relion*/bin /opt/relion*/*/bin",
    "/home/*/relion*/bin /home/*/myproject/relion*/bin /home/*/my-project/relion*/bin",
    "/home/*/src/relion*/bin /home/*/relion-build/*/bin",
    "; do",
    'test -x "$d/relion_refine" -o -x "$d/relion_refine_mpi" && echo "$d"',
    "done; true",
  ].join(" ");
  const hits = await wslBash(wslPath, searchScript, false, 15000);
  for (const line of hits.split("\n")) {
    const t = line.trim();
    if (t.startsWith("/") && found.size < 12) addHit(t, "filesystem search");
  }

  // 3. none found → honest, actionable guidance (NOT "WSL unavailable")
  if (found.size === 0) {
    const note = [
      `WSL distro "${distro ?? "default"}" is up, but RELION is not on its PATH and no common install layout matched.`,
      "If RELION IS installed inside WSL, expose it one of these ways, then press Re-detect:",
      'A) echo \'export PATH=/path/to/relion/bin:$PATH\' >> ~/.bashrc   (login-shell probe picks this up)',
      "B) sudo ln -sf /path/to/relion/bin/relion* /usr/local/bin/",
      "C) echo 'export RELION_HOME=/path/to/relion' >> ~/.bashrc",
      "Searched automatically: ~/relion*/bin, ~/myproject/relion*/bin, ~/my-project/relion*/bin, ~/src|build|code/relion*/bin, /usr/local/relion*/bin, /opt/relion*/bin",
    ].join("\n");
    return { available: true, unavailableReason: null, distro, installs: [], note };
  }

  // 4. build one install entry per binDir — version + tools, one call each
  const installs: RelionInstall[] = [];
  for (const [binDir, meta] of [...found.entries()].slice(0, 8)) {
    // version probe inside the distro
    const versionOut = await wslBash(
      wslPath,
      `"${binDir}/relion_refine" --version 2>&1 || "${binDir}/relion_refine_mpi" --version 2>&1 || true`,
      false,
      10000
    );
    const vMatch = versionOut.match(
      /RELION\s*(?:version)?[:\s]*v?(\d+\.\d+(?:\.\d+)?)/i
    );

    // toolchain probe (login shell so ~/.bashrc MPI builds count)
    const q = binDir.replace(/'/g, `'\\''`);
    const toolsScript = [
      `echo M:$(command -v mpirun 2>/dev/null || command -v mpiexec 2>/dev/null || true)`,
      `echo B:$(test -x '${q}'/relion_refine_mpi && echo yes || echo no)`,
      `echo C:$(command -v ctffind 2>/dev/null || test -x '${q}'/ctffind 2>/dev/null || true)`,
    ].join("; ");
    const toolsOut = await wslBash(wslPath, toolsScript, true, 8000);
    let mpirunPath: string | null = null;
    let mpiBinary = false;
    let ctffindPath: string | null = null;
    for (const line of toolsOut.split("\n")) {
      const t = line.trim();
      if (t.startsWith("M:")) {
        const v = t.slice(2).trim();
        mpirunPath = v.startsWith("/") ? v.split("\n")[0] : null;
      } else if (t.startsWith("B:")) {
        mpiBinary = t.slice(2).trim() === "yes";
      } else if (t.startsWith("C:")) {
        const v = t.slice(2).trim();
        ctffindPath = v.startsWith("/") ? v.split("\n")[0] : null;
      }
    }

    installs.push({
      id: `w:${distro ?? "default"}:${binDir}`,
      version: vMatch ? vMatch[1] : null,
      path: binDir,
      relionHome: binDir.replace(/\/bin\/?$/, ""),
      source: meta.source,
      // When the server itself runs inside the distro's filesystem the path
      // is directly spawnable → native; otherwise the WSL bridge executes it.
      execution: isValidBinDir(binDir) ? "native" : "wsl",
      distro,
      mpirunPath,
      mpiBinary,
      ctffindPath,
    });
  }

  return {
    available: true,
    unavailableReason: null,
    distro,
    installs,
    note: "",
  };
}

/* ------------------------------------------------------------------ */
/* Main entry point (60s in-module cache)                               */
/* ------------------------------------------------------------------ */

let cache: { at: number; status: RelionStatus } | null = null;
const CACHE_MS = 60_000;

/** Compose the WslStatusClient the UI/bridge expect from a WSL probe. */
function wslStatusFrom(
  probe: WslProbe,
  selected: RelionInstall | null
): WslStatusClient {
  if (!probe.available) {
    return {
      available: false,
      unavailableReason: probe.unavailableReason,
      relionPath: null,
      relionHome: null,
      version: null,
      source: null,
      distro: null,
      note: probe.note,
    };
  }
  // mirror the SELECTED WSL install when one is active (bridge correctness),
  // otherwise the first discovery (UI guidance only)
  const install = selected ?? probe.installs[0] ?? null;
  if (!install) {
    return {
      available: true,
      unavailableReason: null,
      relionPath: null,
      relionHome: null,
      version: null,
      source: null,
      distro: probe.distro,
      note: probe.note,
    };
  }
  const note =
    install.source === "login-shell PATH"
      ? `RELION ${install.version ?? "?"} detected inside WSL (${install.distro ?? "default"}) at ${install.path} — on the distro's login-shell PATH.`
      : `RELION ${install.version ?? "?"} found inside WSL (${install.distro ?? "default"}) at ${install.path} via ${install.source} — not on the default PATH. For shell convenience add it to ~/.bashrc (option A in guidance below). The dashboard surfaces this install directly.`;
  return {
    available: true,
    unavailableReason: null,
    relionPath: install.path,
    relionHome: install.relionHome,
    version: install.version,
    source: install.source,
    distro: install.distro,
    note,
    mpirunPath: install.mpirunPath,
    mpiBinary: install.mpiBinary,
    ctffindPath: install.ctffindPath,
  };
}

export async function detectRelion(force = false): Promise<RelionStatus> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.status;
  }

  // ---- native installs (every valid candidate, deduped) ------------------
  const nativeCandidates = candidateDirs();
  const nativeMap = new Map<string, NativeCandidate>(); // canonical → candidate
  const onPath = await which("relion_refine", 3000);
  if (onPath && isValidBinDir(path.dirname(onPath))) {
    nativeMap.set(canonical(path.dirname(onPath)), {
      dir: path.dirname(onPath),
      source: "PATH",
    });
  }
  for (const cand of nativeCandidates) {
    if (isValidBinDir(cand.dir)) {
      const key = canonical(cand.dir);
      // PATH and RELION_HOME outrank scan hits for the same physical dir
      if (!nativeMap.has(key)) nativeMap.set(key, cand);
    }
  }

  const nativeInstalls: RelionInstall[] = [];
  for (const cand of nativeMap.values()) {
    const version = await probeVersion(cand.dir);
    nativeInstalls.push({
      id: `n:${cand.dir}`,
      version,
      path: cand.dir,
      relionHome: cand.dir.replace(/\/bin\/?$/, ""),
      source: cand.source,
      execution: "native",
      distro: null,
      mpirunPath: null,
      mpiBinary: existsSync(path.join(cand.dir, "relion_refine_mpi")),
      ctffindPath: await resolveNativeCtffind(cand.dir),
    });
  }

  // ---- WSL installs -------------------------------------------------------
  const wslProbe = await probeWsl();
  const wslInstalls = wslProbe.installs;

  // ---- order + selection ---------------------------------------------------
  const installs = [...nativeInstalls, ...wslInstalls];
  const persisted = readSelectedId();
  let selected =
    installs.find((i) => i.id === persisted) ?? null;
  let autoPicked = false;
  if (!selected) {
    selected = pickDefaultInstall(installs);
    if (selected) {
      autoPicked = true;
      writeSelectedId(selected.id);
    }
  } else if (selected.execution === "wsl" && !wslProbe.available) {
    // stale WSL selection (distro gone) → fall back to auto-pick
    selected = pickDefaultInstall(installs);
    autoPicked = true;
    writeSelectedId(selected?.id ?? null);
  }

  // ---- top-level status mirrors the SELECTED install ------------------------
  const found = selected !== null;
  const execution: RelionStatus["execution"] = selected?.execution ?? null;
  const wsl = wslStatusFrom(
    wslProbe,
    selected && selected.execution === "wsl" ? selected : null
  );

  let binaries: RelionStatus["binaries"];
  let externals: RelionStatus["externals"];

  if (selected && selected.execution === "wsl") {
    // binaries verified INSIDE the distro (host existsSync can't see them)
    const wslPath = await locateWslExe();
    if (wslPath) {
      const inWsl = await probeWslBinaries(
        wslPath,
        selected.path,
        CORE_BINARIES,
        EXTERNAL_PROGRAMS
      );
      binaries = CORE_BINARIES.map((name) => ({ name, present: inWsl.bins.has(name) }));
      externals = EXTERNAL_PROGRAMS.map((name) => ({ name, present: inWsl.exts.has(name) }));
    } else {
      binaries = CORE_BINARIES.map((name) => ({ name, present: false }));
      externals = EXTERNAL_PROGRAMS.map((name) => ({ name, present: false }));
    }
  } else {
    const dir = selected?.path ?? null;
    binaries = CORE_BINARIES.map((name) => ({
      name,
      present: dir ? existsSync(path.join(dir, name)) : false,
    }));
    externals = [];
    for (const name of EXTERNAL_PROGRAMS) {
      let present = (await which(name, 2000)) !== null;
      if (!present && dir) {
        present = existsSync(path.join(dir, name));
      }
      externals.push({ name, present });
    }
  }

  const status: RelionStatus = {
    found,
    execution,
    version: selected?.version ?? null,
    path: selected?.path ?? null,
    source: selected
      ? selected.execution === "wsl"
        ? selected.distro
          ? `WSL (${selected.distro}) · ${selected.source}`
          : `WSL · ${selected.source}`
        : selected.source
      : null,
    wsl,
    binaries,
    externals,
    checkedAt: new Date().toISOString(),
    // multi-install surface (all versions found + the active one)
    installs,
    selectedId: selected?.id ?? null,
    autoPicked,
  };

  cache = { at: Date.now(), status };
  return status;
}

/**
 * Switch the active RELION install. Validates against a fresh probe, persists
 * the choice (survives restarts), and refreshes the cache. Returns the new
 * status. Selecting an unknown id → HTTP-level callers report 404 upstream.
 */
export async function selectRelionInstall(
  installId: string
): Promise<{ ok: boolean; status: RelionStatus }> {
  const status = await detectRelion(true);
  const target = status.installs.find((i) => i.id === installId);
  if (!target) {
    return { ok: false, status };
  }
  if (status.selectedId === installId) {
    return { ok: true, status };
  }
  writeSelectedId(installId);
  const refreshed = await detectRelion(true);
  return { ok: true, status: refreshed };
}
