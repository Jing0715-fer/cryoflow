/**
 * CryoFlow — RELION environment detection (SERVER ONLY, no "use client").
 *
 * Scans the host (and WSL distros when present) for EVERY RELION install,
 * probes each version, and composes the status around the SELECTED install:
 *   - full detection SNAPSHOT persists in data/relion-snapshot.json so a
 *     restart / cold WSL never blanks the environment: the saved status is
 *     served instantly (fromCache) and re-verified in the background
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
 * Fresh results are cached in-module for 60 s; beyond that (and on cold
 * start) the caller is served the last known status while a background
 * probe re-verifies (stale-while-revalidate). `force` bypasses everything.
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
  /** Restored from the saved last detection — the fresh probe could not
   *  re-verify it this round (e.g. WSL was cold). Re-detect re-verifies. */
  cached?: boolean;
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

/* ------------------------------------------------------------------ */
/* Detection snapshot persistence (data/relion-snapshot.json)           */
/* ------------------------------------------------------------------ */

const SNAPSHOT_FILE = path.join(DATA_DIR, "relion-snapshot.json");

/** Saved record of one full detection — installs, selection, verified
 *  binaries, WSL probe. Survives dev-server restarts and cold WSL VMs so
 *  the app NEVER re-detects from scratch just because it was reopened. */
interface Snapshot {
  savedAt: string;
  status: RelionStatus;
}

/** Validate + revive one persisted install record (corrupt entries drop). */
function snapshotInstallFrom(raw: unknown): RelionInstall | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  const dir = typeof r.path === "string" ? r.path : "";
  const execution = r.execution === "native" || r.execution === "wsl" ? r.execution : null;
  if (!id || !dir || !execution) return null;
  return {
    id,
    version: typeof r.version === "string" ? r.version : null,
    path: dir,
    relionHome: typeof r.relionHome === "string" ? r.relionHome : dir.replace(/\/bin\/?$/, ""),
    source: typeof r.source === "string" && r.source ? r.source : "saved detection",
    execution,
    distro: typeof r.distro === "string" ? r.distro : null,
    mpirunPath: typeof r.mpirunPath === "string" ? r.mpirunPath : null,
    mpiBinary: r.mpiBinary === true,
    ctffindPath: typeof r.ctffindPath === "string" ? r.ctffindPath : null,
  };
}

/** Read the saved detection, defensively (a corrupt file degrades to null). */
function readSnapshot(): Snapshot | null {
  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as {
      savedAt?: unknown;
      status?: unknown;
    };
    if (typeof parsed.status !== "object" || parsed.status === null) return null;
    const s = parsed.status as Record<string, unknown>;
    if (typeof s.found !== "boolean" || !Array.isArray(s.installs)) return null;
    const installs = (s.installs as unknown[])
      .map(snapshotInstallFrom)
      .filter((i): i is RelionInstall => i !== null)
      .slice(0, 16);
    if (installs.length === 0) return null;
    const w = typeof s.wsl === "object" && s.wsl !== null ? (s.wsl as Record<string, unknown>) : {};
    const wsl: WslStatusClient = {
      available: w.available === true,
      unavailableReason:
        w.unavailableReason === "no-wsl" || w.unavailableReason === "no-distro"
          ? w.unavailableReason
          : null,
      relionPath: typeof w.relionPath === "string" ? w.relionPath : null,
      relionHome: typeof w.relionHome === "string" ? w.relionHome : null,
      version: typeof w.version === "string" ? w.version : null,
      source: typeof w.source === "string" ? w.source : null,
      distro: typeof w.distro === "string" ? w.distro : null,
      note: typeof w.note === "string" ? w.note : "",
      mpirunPath: typeof w.mpirunPath === "string" ? w.mpirunPath : null,
      mpiBinary: w.mpiBinary === true,
      ctffindPath: typeof w.ctffindPath === "string" ? w.ctffindPath : null,
    };
    const list = (v: unknown): { name: string; present: boolean }[] =>
      Array.isArray(v)
        ? (v as unknown[]).flatMap((e) => {
            if (typeof e !== "object" || e === null) return [];
            const r = e as Record<string, unknown>;
            return typeof r.name === "string" ? [{ name: r.name, present: r.present === true }] : [];
          })
        : [];
    const status: RelionStatus = {
      found: s.found,
      execution: s.execution === "native" || s.execution === "wsl" ? s.execution : null,
      version: typeof s.version === "string" ? s.version : null,
      path: typeof s.path === "string" ? s.path : null,
      source: typeof s.source === "string" ? s.source : null,
      wsl,
      binaries: list(s.binaries),
      externals: list(s.externals),
      checkedAt: typeof s.checkedAt === "string" ? s.checkedAt : new Date(0).toISOString(),
      installs,
      selectedId: typeof s.selectedId === "string" ? s.selectedId : null,
      autoPicked: s.autoPicked === true,
    };
    return {
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : status.checkedAt,
      status,
    };
  } catch {
    return null;
  }
}

/** Persist the latest detection (never the fromCache marker itself). */
function writeSnapshot(status: RelionStatus): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const persist = { ...status };
    delete persist.fromCache;
    writeFileSync(
      SNAPSHOT_FILE,
      JSON.stringify({ savedAt: new Date().toISOString(), status: persist }, null, 2)
    );
  } catch {
    /* best effort — detection still works without persistence */
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
  //    Retry once with a long timeout — the first wsl.exe call may be
  //    cold-booting the VM (10–30 s after a reboot / idle auto-shutdown),
  //    which regularly made single-shot probes report "no distro".
  let sanity = await wslBash(
    wslPath,
    'echo "ok-${WSL_DISTRO_NAME:-unknown}"',
    false,
    8000
  );
  if (!sanity.startsWith("ok-")) {
    sanity = await wslBash(
      wslPath,
      'echo "ok-${WSL_DISTRO_NAME:-unknown}"',
      false,
      25000
    );
  }
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
    // each statement MUST end with ";" before "done" — without it the final
    // "done" is eaten by echo as a plain word, bash reports "unexpected end
    // of file", and the whole filesystem search silently returns nothing
    'test -x "$d/relion_refine" -o -x "$d/relion_refine_mpi" && echo "$d";',
    "done; true",
  ].join(" ");
  const hits = await wslBash(wslPath, searchScript, false, 15000);
  for (const line of hits.split("\n")) {
    const t = line.trim();
    if (t.startsWith("/") && found.size < 12) addHit(t, "filesystem search");
  }
  // probe-script breakage must never be silent again: bash syntax errors
  // land in stderr, wslBash returns it, and the "/"-filter above would drop
  // it — log it so dev.log shows WHY the search found nothing
  if (hits && !hits.split("\n").some((l) => l.trim().startsWith("/"))) {
    if (/syntax error|not found|permission denied/i.test(hits)) {
      console.error("relion/system: WSL filesystem-search probe failed:", hits.slice(0, 300));
    }
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
      // the bin-dir fallback must PRINT the path (test -x alone is silent →
      // ctffind living only in RELION's bin dir was reported as missing)
      `echo C:$(command -v ctffind 2>/dev/null || { test -x '${q}'/ctffind && printf '%s' '${q}/ctffind'; } || true)`,
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
/* Main entry point — snapshot persistence + stale-while-revalidate     */
/* ------------------------------------------------------------------ */

let cache: { at: number; status: RelionStatus } | null = null;
const CACHE_MS = 60_000;
/** One shared in-flight full probe (force calls + background refresh). */
let probeLock: Promise<RelionStatus> | null = null;
/** Background re-verification kicked by the stale-while-revalidate path. */
let bgRefresh: Promise<void> | null = null;

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

/** WSL block for a CACHED install: the distro did not respond this round, so
 *  the save-time verification is shown with an explicit restoration note. */
function wslStatusFromCached(
  install: RelionInstall,
  probe: WslProbe
): WslStatusClient {
  const reason = !probe.available
    ? probe.unavailableReason === "no-wsl"
      ? "wsl.exe is no longer resolvable on this host."
      : "WSL did not respond during this check (the distro may be cold — the first call boots it, which can take 10–30 s)."
    : "WSL responded, but this install was not re-discovered this round.";
  return {
    available: true,
    unavailableReason: null,
    relionPath: install.path,
    relionHome: install.relionHome,
    version: install.version,
    source: install.source,
    distro: install.distro,
    note: [
      `Restored from the saved last detection (data/relion-snapshot.json). ${reason}`,
      "It stays selectable and jobs still dispatch to it — the WSL bridge boots the distro on demand. Press Re-detect once WSL is running to re-verify.",
    ].join("\n"),
    mpirunPath: install.mpirunPath,
    mpiBinary: install.mpiBinary,
    ctffindPath: install.ctffindPath,
  };
}

/** Partial binary/external truth for a CACHED install whose save-time
 *  verification block belongs to a DIFFERENT install: entries derivable from
 *  the install record itself (discovery required relion_refine[_mpi]; the
 *  MPI/ctffind columns were recorded) are shown, the rest stay unchecked. */
function cachedInstallBinaries(install: RelionInstall): {
  binaries: RelionStatus["binaries"];
  externals: RelionStatus["externals"];
} {
  const b = new Map(CORE_BINARIES.map((name) => [name, false]));
  b.set("relion_refine", true); // discovery itself required it (or _mpi)
  const e = new Map(EXTERNAL_PROGRAMS.map((name) => [name, false]));
  if (install.ctffindPath) e.set("ctffind", true);
  return {
    binaries: CORE_BINARIES.map((name) => ({ name, present: b.get(name) ?? false })),
    externals: EXTERNAL_PROGRAMS.map((name) => ({ name, present: e.get(name) ?? false })),
  };
}

/** Run the FULL host + WSL probe, merge with the saved snapshot, persist. */
async function runProbe(): Promise<RelionStatus> {
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

  // ---- merge with the SAVED last detection --------------------------------
  // A failed WSL probe (cold VM) must never blank the environment: installs
  // saved earlier are restored (flagged `cached`) when they cannot be
  // disproved this round. Native ones re-verify on disk; WSL ones survive
  // exactly as long as the distro is unreachable — once it responds again,
  // anything it does not re-report is dropped for good.
  const snap = readSnapshot();
  const installs: RelionInstall[] = [...nativeInstalls, ...wslInstalls];
  const freshIds = new Set(installs.map((i) => i.id));
  let restored = 0;
  if (snap) {
    for (const old of snap.status.installs) {
      if (freshIds.has(old.id)) continue;
      const keep =
        old.execution === "native"
          ? isValidBinDir(old.path) // host fs visible → verify on disk
          : !wslProbe.available; // distro unreachable → cannot disprove
      if (keep) {
        installs.push({ ...old, cached: true });
        restored++;
      }
    }
  }
  if (restored > 0) {
    console.info(
      `[relion] fresh probe missed ${restored} install(s) — restored from the saved snapshot (marked cached)`
    );
  }

  // ---- order + selection ---------------------------------------------------
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
  }

  // ---- top-level status mirrors the SELECTED install ------------------------
  const found = selected !== null;
  const execution: RelionStatus["execution"] = selected?.execution ?? null;
  const wsl =
    selected && selected.cached && selected.execution === "wsl"
      ? wslStatusFromCached(selected, wslProbe)
      : wslStatusFrom(
          wslProbe,
          selected && selected.execution === "wsl" ? selected : null
        );

  let binaries: RelionStatus["binaries"];
  let externals: RelionStatus["externals"];

  // per-install blocks for a RESTORED selection come from the snapshot (they
  // were verified inside the distro at save time) — but only when the
  // snapshot's selection is the same install, else stay honestly unverified
  const snapBlocks =
    snap && selected && selected.cached && snap.status.selectedId === selected.id
      ? snap.status
      : null;

  if (selected && selected.execution === "wsl") {
    if (selected.cached && snapBlocks) {
      // WSL did not respond — restore the save-time verification blocks
      binaries = snapBlocks.binaries;
      externals = snapBlocks.externals;
    } else if (selected.cached) {
      // different install than the snapshot's save-time selection — derive
      // what the install record itself proves
      const partial = cachedInstallBinaries(selected);
      binaries = partial.binaries;
      externals = partial.externals;
    } else {
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
      // ctffind: the selected install may resolve a bundled deps copy
      // (resolveNativeCtffind: PATH → bin dir → deps) that the engine
      // actually passes to CTF jobs — the panel must not contradict it
      if (!present && name === "ctffind" && selected?.ctffindPath) {
        present = true;
      }
      externals.push({ name, present });
    }
  }

  const source = selected
    ? (selected.execution === "wsl"
        ? selected.distro
          ? `WSL (${selected.distro}) · ${selected.source}`
          : `WSL · ${selected.source}`
        : selected.source) + (selected.cached ? " · saved" : "")
    : null;

  const status: RelionStatus = {
    found,
    execution,
    version: selected?.version ?? null,
    path: selected?.path ?? null,
    source,
    wsl,
    binaries,
    externals,
    checkedAt: new Date().toISOString(),
    // multi-install surface (all versions found + the active one)
    installs,
    selectedId: selected?.id ?? null,
    autoPicked,
  };

  writeSnapshot(status);
  cache = { at: Date.now(), status };
  return status;
}

/** One shared full probe (dedups concurrent force calls + background refresh). */
function fullProbe(): Promise<RelionStatus> {
  if (!probeLock) {
    probeLock = runProbe()
      .catch((err) => {
        // probe crashed — never take the app down with it: fall back to the
        // last in-memory status, else the saved snapshot, else rethrow
        if (cache) return cache.status;
        const snap = readSnapshot();
        if (snap) {
          const status: RelionStatus = { ...snap.status, fromCache: true };
          cache = { at: Date.now(), status };
          return status;
        }
        throw err;
      })
      .finally(() => {
        probeLock = null;
      });
  }
  return probeLock;
}

/** Fire-and-forget background re-verification (stale-while-revalidate). */
function kickBackgroundRefresh(): void {
  if (bgRefresh) return;
  bgRefresh = (async () => {
    try {
      await fullProbe();
    } catch (err) {
      console.error("[relion] background re-detect failed:", err);
    } finally {
      bgRefresh = null;
    }
  })();
}

export async function detectRelion(force = false): Promise<RelionStatus> {
  if (!force) {
    // Serve instantly from the in-module cache …
    if (cache) {
      if (Date.now() - cache.at < CACHE_MS) return cache.status;
      // … or STALE, while a background probe re-verifies — callers never wait.
      kickBackgroundRefresh();
      return cache.status;
    }
    // Cold start (server restart / first import): the SAVED detection
    // answers immediately — no re-detect needed just because the app was
    // reopened; the background probe refreshes it in place.
    const snap = readSnapshot();
    if (snap) {
      const status: RelionStatus = { ...snap.status, fromCache: true };
      cache = { at: Date.now(), status };
      kickBackgroundRefresh();
      return status;
    }
  }
  // force (Re-detect button / install switch) or nothing ever detected yet
  return fullProbe();
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

