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
 */
export function parseRelionModules(text: string): string[] {
  const found = new Set<string>();
  // token = word characters plus ./-+ in the version part, case-insensitive
  const re = /\b(relion)[/\-]?([A-Za-z0-9._\-+]*)/gi;
  for (const line of text.split(/\r?\n/)) {
    // skip Lmod's decorative header/footer lines
    if (/^[-=]+$/.test(line.trim())) continue;
    for (const m of line.matchAll(re)) {
      const version = (m[2] ?? "").replace(/[:()\s].*$/, "").replace(/[():,]+$/, "");
      // a "version" that starts with a letter and is a common word is noise
      // (e.g. "relion is" from whatis output) — keep only plausible versions
      const plausible =
        version === "" || /^v?\d/.test(version) || /^[\d.]/.test(version);
      if (!plausible) continue;
      const name = version === "" ? "relion" : `relion/${version}`;
      found.add(name);
    }
  }
  // "relion" alone is only meaningful when nothing versioned was found
  const versioned = [...found].filter((n) => n.includes("/"));
  return (versioned.length > 0 ? versioned : [...found]).sort((a, b) => {
    const va = /(\d+(?:\.\d+)*)/.exec(a)?.[1] ?? "0";
    const vb = /(\d+(?:\.\d+)*)/.exec(b)?.[1] ?? "0";
    return vb.localeCompare(va, undefined, { numeric: true });
  });
}

/* ------------------------------------------------------------------ */
/* The probe                                                           */
/* ------------------------------------------------------------------ */

/**
 * Probe a connection: reachability, module system, relion modules and their
 * install roots, MPI/ctffind availability, Slurm, GPUs. Never throws — a
 * failed probe returns { ok: false, error } so the UI can render the reason.
 */
export async function probeConnection(c: RemoteConnection): Promise<RemoteProbe> {
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
  };

  try {
    // ---- reachability + identity ------------------------------------
    const who = await exec(c, loginShellScript("echo \"$USER@$(hostname)\"; uname -a"), { timeoutMs: 12_000 });
    if (who.error) return { ...base, error: who.error };
    if (who.code !== 0) return { ...base, error: `login shell failed (exit ${who.code}): ${who.stderr.trim().slice(0, 200)}` };
    base.uname = who.stdout.trim().split("\n").slice(-1)[0] ?? null;

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
      const list = await exec(
        c,
        loginShellScript(
          "module avail relion 2>&1 || true; " +
            "module spider relion 2>&1 || true; " +
            "module whatis relion 2>&1 || true"
        ),
        { timeoutMs: 20_000 }
      );
      const modules = parseRelionModules(list.stdout + "\n" + list.stderr);
      base.relionModules = modules;

      // ---- per-module install roots + toolchain facts -----------------
      // one login shell per module keeps the env deterministic
      const homes: Record<string, string> = {};
      const mpi: Record<string, boolean> = {};
      const ctffind: Record<string, string> = {};
      const externals: Record<string, Record<string, string>> = {};
      for (const m of modules.slice(0, 8)) {
        const q = m.replace(/'/g, "'\\''");
        const detail = await exec(
          c,
          loginShellScript(
            `module load '${q}' 2>/dev/null || module load ${q}; ` +
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
        if (detail.code === 0 || detail.stdout.trim()) {
          const lines = detail.stdout.trim().split("\n").map((l) => l.trim());
          const relionPath = lines.find((l) => l.startsWith("/") && l.includes("relion_refine"));
          const homeLine = lines.find((l) => l.startsWith("RELION_HOME="));
          if (relionPath || homeLine) {
            homes[m] = homeLine ? homeLine.slice("RELION_HOME=".length) : dirnameOf(dirnameOf(relionPath ?? ""));
          }
          mpi[m] = lines.some((l) => /mpirun$/.test(l));
          const ctf = lines.find((l) => /ctffind\d*$/.test(l) && l.startsWith("/"));
          if (ctf) ctffind[m] = ctf;
          // externals: exact-basename match, first per key wins
          const ext: Record<string, string> = {};
          for (const l of lines) {
            if (!l.startsWith("/")) continue;
            const bn = l.split("/").pop() ?? "";
            for (const [key, names] of EXT_PROGRAMS) {
              if (ext[key]) continue;
              if (names.includes(bn)) ext[key] = l;
            }
          }
          if (Object.keys(ext).length > 0) externals[m] = ext;
        }
      }
      base.relionHomes = homes;
      base.relionMpi = mpi;
      base.relionCtffind = ctffind;
      base.externals = externals;
    }

    // ---- Slurm + GPUs (non-fatal) ------------------------------------
    const extras = await exec(
      c,
      loginShellScript(
        "command -v sbatch >/dev/null && command -v squeue >/dev/null && echo SLURM=yes || echo SLURM=no; " +
          "(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -8) || true"
      ),
      { timeoutMs: 12_000 }
    );
    const extraLines = extras.stdout.trim().split("\n").map((l) => l.trim());
    base.slurm = extraLines.some((l) => l === "SLURM=yes");
    base.gpus = extraLines
      .filter((l) => l && !l.startsWith("SLURM="))
      .slice(0, 8);

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
