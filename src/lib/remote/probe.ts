/**
 * CryoFlow — remote cluster environment probe (SERVER ONLY).
 *
 * Answers the questions the user's old terminal session used to answer:
 *   - can I log in?                          (ssh echo)
 *   - which module system is this?           (module --version / Lmod markers)
 *   - which relion versions can I load?      (module avail / spider)
 *   - where does each install live?          (module load X; command -v relion_refine)
 *   - is there mpirun / ctffind / Slurm / GPUs?
 *
 * Everything runs inside `bash -lc` (login shell) because `module` is a shell
 * FUNCTION initialized by /etc/profile.d — a plain exec channel would not
 * have it.
 */

import type { RemoteConnection, RemoteProbe } from "./types";
import { exec, loginShellScript } from "./ssh";

/**
 * The non-relion externals the engine's argv builders resolve (engine.ts
 * externalFor): probe key → the program names that satisfy it on the
 * cluster. Resolved per module AFTER `module load` — PATH is the module's.
 */
const EXT_PROGRAMS: Array<[string, string[]]> = [
  ["motioncor2", ["motioncor2", "MotionCor2"]],
  ["topaz", ["relion_python_topaz", "topaz"]],
  ["modelangelo", ["model_angelo", "modelangelo"]],
  ["dynamight", ["relion_python_dynamight", "dynamight"]],
  ["tomo_denoise", ["relion_python_tomo_denoise"]],
  ["tomo_pick", ["relion_python_tomo_pick"]],
];

/* ------------------------------------------------------------------ */
/* Module list parsing                                                 */
/* ------------------------------------------------------------------ */

/**
 * Extract relion module names from module-tool output. Handles:
 *   - Lmod:  "   relion/4.4.1    relion/5.0.1"  (stderr of `module avail`)
 *   - Lmod spider: "  relion:" / "     relion/5.0.1:"
 *   - Environment Modules: "relion/5.0.1(20240101)" (trailing tags stripped)
 *   - bare names: "relion", "Relion/5.0.1"
 *   - t297 — pre-release / toolchain-suffixed versions: "relion/beta_5.0_gpu_ompi5_cuda118",
 *     "relion/5.0.1_gpu_ompi4_cuda101", "relion/5.0-beta". A version that
 *     starts with a LETTER is only noise when it is a plain word ("relion is",
 *     "relion package") — a beta-prefixed or digit-bearing dotted/underscored
 *     token is a real module name on OpenHPC-style clusters, and the old
 *     /^v?\d/ filter silently DROPPED exactly those (the relion-5-invisible
 *     bug: the module was listed, the parser refused to see it).
 */
const PRE_RELEASE_PREFIX =
  /^(?:beta|alpha|rc|dev|pre|nightly|build|preview|experimental)[._\-]?/i;

export function parseRelionModules(text: string): string[] {
  const found = new Set<string>();
  // token = word characters plus ./-+ in the version part, case-insensitive
  const re = /\b(relion)[/\-]?([A-Za-z0-9._\-+]*)/gi;
  for (const line of text.split(/\r?\n/)) {
    // skip Lmod's decorative header/footer lines
    if (/^[-=]+$/.test(line.trim())) continue;
    for (const m of line.matchAll(re)) {
      const version = (m[2] ?? "").replace(/[:()\s].*$/, "").replace(/[():,]+$/, "");
      // plausibility: keep the digit-led versions, the bare name, and the
      // pre-release / toolchain-suffixed tokens (t297); reject plain prose
      // words ("is", "package", "cuda") — no digit, no separator, no known
      // pre-release prefix.
      const plausible =
        version === "" ||
        /^v?\d/.test(version) ||
        PRE_RELEASE_PREFIX.test(version) ||
        (/\d/.test(version) && /[._\-]/.test(version));
      if (!plausible) continue;
      const name = version === "" ? "relion" : `relion/${version}`;
      found.add(name);
    }
  }
  // "relion" alone is only meaningful when nothing versioned was found
  const versioned = [...found].filter((n) => n.includes("/"));
  return (versioned.length > 0 ? versioned : [...found]).sort((a, b) => {
    // t297 — "beta_5.0_…" must sort as 5.0 (above 4.0): take the FIRST
    // digit-led run as the version key, wherever it sits in the token.
    const va = /(\d+(?:\.\d+)*)/.exec(a)?.[1] ?? "0";
    const vb = /(\d+(?:\.\d+)*)/.exec(b)?.[1] ?? "0";
    return vb.localeCompare(va, undefined, { numeric: true });
  });
}

/* ------------------------------------------------------------------ */
/* Per-module detail probe (shared by the sweep + the verify door)      */
/* ------------------------------------------------------------------ */

/** What a single `module load X` reveals about one relion install. */
export interface ModuleDetail {
  /** Install root (…/bin contains relion_refine) — null when unresolved. */
  home: string | null;
  mpi: boolean;
  ctffind: string | null;
  /** external (non-relion) programs: key → absolute cluster path. */
  externals: Record<string, string>;
  /** Exit status of the (second) `module load` attempt — null when the first attempt succeeded. t297: a NON-ZERO rc means the module itself refused to load, even when a stale environment still puts relion_refine on PATH (the false-positive the verify door must not forge). */
  loadRc: number | null;
  /** First line of `module load` failure output when the load itself failed. */
  loadError: string | null;
}

/**
 * t297 — load ONE module in a login shell and inventory what it puts on
 * PATH (relion_refine / mpirun / ctffind / the externals). Extracted from
 * the probe loop so the verify-module door (POST …/verify-module) can run
 * the EXACT same ceremony for a name the user typed by hand — a beta or
 * hidden module (relion/beta_5.0_gpu_ompi5_cuda118) is provable without
 * `module avail` ever listing it.
 */
export async function probeModuleDetail(
  c: RemoteConnection,
  moduleName: string
): Promise<ModuleDetail> {
  const q = moduleName.replace(/'/g, "'\\''");
  const detail = await exec(
    c,
    loginShellScript(
      // t297 — the load's own verdict rides stdout (CF_LOAD_RC): the first
      // attempt is quiet; a failing second attempt echoes its rc + stderr so
      // the verify door can refuse a module that never loaded — even when a
      // stale PATH still offers relion_refine (the false positive)
      `module load '${q}' 2>/dev/null || { module load ${q}; echo "CF_LOAD_RC=$?"; }; ` +
        "command -v relion_refine 2>/dev/null; " +
        "command -v mpirun 2>/dev/null; " +
        "command -v ctffind 2>/dev/null || command -v ctffind4 2>/dev/null; " +
        // t264: inventory the NON-relion externals per module — the
        // argv a cluster run builds must reference cluster paths
        // (engine.ts externalFor consumes this map; local disk is
        // never consulted for a remote command)
        "command -v motioncor2 2>/dev/null; command -v MotionCor2 2>/dev/null; " +
        "command -v relion_python_topaz 2>/dev/null; command -v topaz 2>/dev/null; " +
        "command -v model_angelo 2>/dev/null; command -v modelangelo 2>/dev/null; " +
        "command -v relion_python_dynamight 2>/dev/null; command -v dynamight 2>/dev/null; " +
        "command -v relion_python_tomo_denoise 2>/dev/null; " +
        "command -v relion_python_tomo_pick 2>/dev/null; " +
        "echo RELION_HOME=$(dirname $(dirname $(command -v relion_refine 2>/dev/null || echo /bin/true)))"
    ),
    { timeoutMs: 15_000 }
  );
  const lines = detail.stdout.trim().split("\n").map((l) => l.trim());
  const rcLine = lines.find((l) => /^CF_LOAD_RC=\d+$/.test(l));
  const loadRc = rcLine ? Number(rcLine.slice("CF_LOAD_RC=".length)) : null;
  const relionPath = lines.find((l) => l.startsWith("/") && l.includes("relion_refine"));
  const homeLine = lines.find((l) => l.startsWith("RELION_HOME="));
  const home = relionPath || homeLine
    ? homeLine
      ? homeLine.slice("RELION_HOME=".length)
      : dirnameOf(dirnameOf(relionPath ?? ""))
    : null;
  const externals: Record<string, string> = {};
  for (const l of lines) {
    if (!l.startsWith("/")) continue;
    const bn = l.split("/").pop() ?? "";
    for (const [key, names] of EXT_PROGRAMS) {
      if (externals[key]) continue;
      if (names.includes(bn)) externals[key] = l;
    }
  }
  let loadError: string | null = null;
  if (loadRc != null && loadRc !== 0) {
    const errFirst = detail.stderr.trim().split("\n").find((l) => l.trim() && !/^\s*$/.test(l));
    loadError = errFirst?.trim().slice(0, 300) ?? null;
  } else if (!relionPath && !homeLine) {
    const errFirst = detail.stderr.trim().split("\n").find((l) => l.trim() && !/^\s*$/.test(l));
    loadError = errFirst?.trim().slice(0, 300) ?? null;
  }
  return {
    home,
    mpi: lines.some((l) => /mpirun$/.test(l)),
    ctffind: lines.find((l) => /ctffind\d*$/.test(l) && l.startsWith("/")) ?? null,
    externals,
    loadRc,
    loadError,
  };
}

/* ------------------------------------------------------------------ */
/* The probe                                                           */
/* ------------------------------------------------------------------ */

/**
 * Probe a connection: reachability, module system, relion modules and their
 * install roots, MPI/ctffind availability, Slurm, GPUs. Never throws — a
 * failed probe returns { ok: false, error } so the UI can render the reason.
 *
 * t268: the public entry wraps the inner probe with a wall-clock timer —
 * `durationMs` rides every probe result (ok or failed), because the probe is
 * load-bearing (t267: the dispatch runs it itself) and a slow cluster's
 * dispatch latency should be VISIBLE (dialog, ledger) instead of just felt.
 */
export async function probeConnection(c: RemoteConnection): Promise<RemoteProbe> {
  const t0 = Date.now();
  const probe = await probeConnectionInner(c);
  return { ...probe, durationMs: Date.now() - t0 };
}

async function probeConnectionInner(c: RemoteConnection): Promise<RemoteProbe> {
  const base: RemoteProbe = {
    ok: false,
    checkedAt: new Date().toISOString(),
    uname: null,
    moduleSystem: "none",
    relionModules: [],
    relionHomes: {},
    relionMpi: {},
    relionCtffind: {},
    externals: {},
    slurm: false,
    gpus: [],
    slurmGpus: [],
    homeDir: null,
  };

  try {
    // ---- reachability + identity ------------------------------------
    // t289 — $HOME rides the identity round-trip (one SSH exec, one line
    // more): the dialog shows the remote root RESOLVED (~/cryoflow →
    // /home/cryo/cryoflow) without a second login.
    const who = await exec(
      c,
      loginShellScript('echo "$USER@$(hostname)"; echo "CF_HOME=$HOME"; uname -a'),
      { timeoutMs: 12_000 }
    );
    if (who.error) return { ...base, error: who.error };
    if (who.code !== 0) return { ...base, error: `login shell failed (exit ${who.code}): ${who.stderr.trim().slice(0, 200)}` };
    const homeLine = who.stdout.split("\n").find((l) => l.startsWith("CF_HOME="));
    const homeVal = homeLine ? homeLine.slice("CF_HOME=".length).trim() : "";
    if (homeVal.startsWith("/")) base.homeDir = homeVal;
    base.uname = who.stdout.trim().split("\n").filter((l) => !l.startsWith("CF_HOME=")).slice(-1)[0] ?? null;

    // ---- module system ----------------------------------------------
    const mod = await exec(
      c,
      loginShellScript(
        // module is a shell function — `type module` tells us it exists and
        // which flavor; module --version prints "Modules Release ..." (Tcl) or
        // Lmod's version line
        "type module 2>/dev/null | head -1; " +
          "module --version 2>&1 | head -2"
      ),
      { timeoutMs: 12_000 }
    );
    const modText = (mod.stdout + "\n" + mod.stderr).toLowerCase();
    if (modText.includes("lmod") || modText.includes("lua")) base.moduleSystem = "lmod";
    else if (modText.includes("modules release") || modText.includes("environment modules")) base.moduleSystem = "envmodules";
    else if (modText.includes("module is a function") || modText.includes("module is /")) {
      base.moduleSystem = modText.includes("lmod") ? "lmod" : "envmodules";
    } else {
      base.moduleSystem = "none";
    }

    // ---- relion module list -----------------------------------------
    if (base.moduleSystem !== "none") {
      // t297 — hidden modules: beta installs are frequently Lmod-hidden
      // (`module load` works, `module avail` stays silent). Ask for them
      // explicitly — --show_hidden is Lmod ≥7, -d is its short form, and
      // Environment Modules 4.4+ speaks --show_hidden too; unknown-flag
      // errors are harmless (|| true + prose the parser ignores).
      const list = await exec(
        c,
        loginShellScript(
          "module avail relion 2>&1 || true; " +
            "module avail --show_hidden relion 2>&1 || module avail -d relion 2>&1 || true; " +
            "module spider relion 2>&1 || true; " +
            "module whatis relion 2>&1 || true"
        ),
        { timeoutMs: 20_000 }
      );
      const modules = parseRelionModules(list.stdout + "\n" + list.stderr);
      base.relionModules = modules;

      // ---- per-module install roots + toolchain facts -----------------
      // one login shell per module keeps the env deterministic (the shared
      // probeModuleDetail, t297 — the verify door runs the same ceremony)
      const homes: Record<string, string> = {};
      const mpi: Record<string, boolean> = {};
      const ctffind: Record<string, string> = {};
      const externals: Record<string, Record<string, string>> = {};
      for (const m of modules.slice(0, 8)) {
        const detail = await probeModuleDetail(c, m);
        if (detail.home) homes[m] = detail.home;
        mpi[m] = detail.mpi;
        if (detail.ctffind) ctffind[m] = detail.ctffind;
        if (Object.keys(detail.externals).length > 0) externals[m] = detail.externals;
      }
      base.relionHomes = homes;
      base.relionMpi = mpi;
      base.relionCtffind = ctffind;
      base.externals = externals;
    }

    // ---- Slurm + GPUs (non-fatal) ------------------------------------
    // t297 — login nodes of real clusters have NO GPUs (the batch nodes
    // own them), so `nvidia-smi` on the login node answers nothing and the
    // old probe reported "no GPUs" for perfectly GPU-rich clusters. When
    // Slurm is present, sinfo is the honest inventory: %P partition, %G
    // GRES (gpu[:model]:count), %D node count, %T state — aggregated per
    // partition into what the run dialog's GPU picker can actually ask for.
    // t300 adds %N (the hostlist): the node NAMES the run dialog offers as
    // the submit target ("brain2 · 8 GPU/node"), not just the count.
    const extras = await exec(
      c,
      loginShellScript(
        "command -v sbatch >/dev/null && command -v squeue >/dev/null && echo SLURM=yes || echo SLURM=no; " +
          "(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -8) || true; " +
          "if command -v sinfo >/dev/null 2>&1; then echo CF_SINFO; sinfo -h -o '%P|%G|%D|%T|%N' 2>/dev/null; echo CF_SINFO_END; fi"
      ),
      { timeoutMs: 12_000 }
    );
    const extraLines = extras.stdout.trim().split("\n").map((l) => l.trim());
    base.slurm = extraLines.some((l) => l === "SLURM=yes");
    base.gpus = extraLines
      .filter((l) => l && !l.startsWith("SLURM=") && !l.startsWith("CF_SINFO") && !l.includes("|"))
      .slice(0, 8);
    // the sinfo block sits between the two sentinels (absent when sinfo
    // isn't installed — CPU-only workstations keep slurmGpus empty)
    const sinfoBlock = (() => {
      const i = extras.stdout.indexOf("CF_SINFO\n");
      if (i < 0) return "";
      const rest = extras.stdout.slice(i + "CF_SINFO\n".length);
      const j = rest.indexOf("CF_SINFO_END");
      return j >= 0 ? rest.slice(0, j) : rest;
    })();
    base.slurmGpus = parseSlurmGpus(sinfoBlock);

    base.ok = true;
    // honest completeness note: a cluster without ANY relion module still
    // probes ok=true — the error string only appears for unreachable hosts
    if (base.moduleSystem !== "none" && base.relionModules.length === 0) {
      base.error = "no relion modules found — check `module avail` on the cluster, or install RELION there";
    }
    return base;
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

function dirnameOf(p: string): string {
  const parts = p.split("/").filter(Boolean);
  parts.pop();
  return "/" + parts.join("/");
}

/* ------------------------------------------------------------------ */
/* Slurm GPU inventory parsing (t297, hosts t300)                      */
/* ------------------------------------------------------------------ */

/**
 * t300 — expand a Slurm hostlist expression into node names:
 * "brain2" → [brain2]; "node[01-04]" → node01..node04 (zero-padding
 * preserved); "gpu[1,3-5]" → gpu1,gpu3,gpu4,gpu5; "a[1-9:2]" → a1,a3,a5,
 * a7,a9 (step). Comma-separated lists concatenate. A truncated spec
 * ("node[1-99...]" — sinfo abbreviates at width) is kept as-given: an
 * honest partial list beats a fabricated complete one. "(null)"/empty
 * answers an empty list.
 */
export function expandHostlist(spec: string): string[] {
  const out: string[] = [];
  const s = (spec ?? "").trim();
  if (!s || s === "(null)") return out;
  // split on commas OUTSIDE brackets
  const items: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "[") depth += 1;
    if (ch === "]") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      items.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) items.push(cur);
  for (const item of items) {
    const m = /^([^\[\]]*)\[([^\[\]]+)\](.*)$/.exec(item);
    if (!m) {
      if (item) out.push(item);
      continue;
    }
    const [, prefix, rangesRaw, suffix] = m;
    if (/\.\.$/.test(rangesRaw)) {
      // sinfo truncation ("node[1-99...]") — keep the literal form
      out.push(item);
      continue;
    }
    for (const range of rangesRaw.split(",")) {
      const rm = /^(\d+)-(\d+)(?::(\d+))?$/.exec(range);
      if (rm) {
        const start = Number(rm[1]);
        const end = Number(rm[2]);
        const step = Math.max(1, Number(rm[3] ?? 1) || 1);
        const width = rm[1].length;
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 4096) continue;
        for (let n = start; n <= end; n += step) {
          out.push(prefix + String(n).padStart(width, "0") + suffix);
        }
      } else if (/^\d+$/.test(range)) {
        // single number inside a bracket list — pad to the widest sibling
        const first = rangesRaw.split(",")[0] ?? "";
        const width = /^\d+$/.test(first) && first.length > range.length ? first.length : range.length;
        out.push(prefix + range.padStart(width, "0") + suffix);
      } else if (range) {
        out.push(prefix + range + suffix);
      }
    }
  }
  return out;
}

/**
 * Aggregate `sinfo -h -o '%P|%G|%D|%T|%N'` lines into a per-partition GPU
 * inventory (the t297 grammar + the t300 hostlist tail; the 4-field form
 * parses identically — hosts simply absent). GRES grammar: `gpu`, `gpu:N`,
 * `gpu:MODEL:N`, comma-separated for mixed nodes; `(null)` = no GRES. Lines
 * repeat per state (idle/mix/…) so node counts are summed per partition;
 * the GPU-per-node figure is the max seen (a partition is homogeneous on
 * most clusters). The default partition marker (`gpu*`) is stripped from
 * the name. Host names merge + dedupe across the state lines, capped at
 * 64 (a partition far wider than that does not fit in a dropdown anyway).
 */
export function parseSlurmGpus(sinfoText: string): NonNullable<RemoteProbe["slurmGpus"]> {
  const byPart = new Map<
    string,
    { nodes: number; gpusPerNode: number; model?: string; hosts: Set<string> }
  >();
  for (const raw of sinfoText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes("|")) continue;
    const fields = line.split("|").map((s) => (s ?? "").trim());
    const [partRaw, gres, nodesRaw, , hostRaw] = fields;
    const partition = (partRaw ?? "").replace(/\*$/, "").trim();
    if (!partition) continue;
    const nodes = Number(nodesRaw);
    if (!Number.isFinite(nodes) || nodes <= 0) continue;
    // GPU count out of the GRES field — sum every gpu entry's count
    let gpus = 0;
    let model: string | undefined;
    if (gres && gres !== "(null)") {
      for (const entry of gres.split(",")) {
        const parts = entry.trim().split(":");
        if (parts[0] !== "gpu") continue;
        const count = Number(parts[parts.length - 1]);
        gpus += Number.isFinite(count) && parts.length > 1 ? count : 1;
        if (parts.length === 3) model = parts[1];
      }
    }
    const cur = byPart.get(partition) ?? { nodes: 0, gpusPerNode: 0, hosts: new Set<string>() };
    cur.nodes += nodes;
    cur.gpusPerNode = Math.max(cur.gpusPerNode, gpus);
    if (model && !cur.model) cur.model = model;
    for (const h of expandHostlist(hostRaw ?? "")) cur.hosts.add(h);
    byPart.set(partition, cur);
  }
  const out: NonNullable<RemoteProbe["slurmGpus"]> = [];
  for (const [partition, v] of [...byPart.entries()].sort(
    (a, b) => b[1].gpusPerNode - a[1].gpusPerNode || a[0].localeCompare(b[0])
  )) {
    if (v.gpusPerNode <= 0) continue; // CPU partitions are not GPU inventory
    const hosts = [...v.hosts].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 64);
    out.push({
      partition,
      nodes: v.nodes,
      gpusPerNode: v.gpusPerNode,
      gpuTotal: v.nodes * v.gpusPerNode,
      ...(v.model ? { model: v.model } : {}),
      ...(hosts.length > 0 ? { hosts } : {}),
    });
  }
  return out;
}
