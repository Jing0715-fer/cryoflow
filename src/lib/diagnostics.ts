/**
 * CryoFlow — system diagnostics facts (t530).
 *
 * The campaign's numbers lived in ops scripts and worklog prose: the
 * watchdog's recycle line (t524), the build guard's GO lines (t525),
 * the provenance stamp of the running build (t525/t529). This module is
 * their PRODUCT mouth: one reader that turns /proc, statfs, the built
 * stamp and the world's census into a single payload the diagnostics
 * dialog (and any local consumer) can render.
 *
 * Laws this module obeys:
 *  - COMPOSERS ARE PURE — every verdict function takes injected numbers
 *    and returns bytes; the fs/prisma readers are thin adapters around
 *    them (t529 law: the bench tests the logic, not the world).
 *  - EVIDENCE FROM BYTES — memory from /proc/meminfo, disk from statfs,
 *    provenance from the .built-at-commit stamp; never process sniffing
 *    (t528/t529 identity law, third appearance).
 *  - HONEST NULLS — a reader that cannot read returns null and the UI
 *    speaks the annihilation out loud; it never invents a number.
 *  - THE GUARD'S DOOR — /api/diagnostics is a sensitive read surface
 *    (it reveals host memory topology); the route speaks through
 *    isLocalRequest exactly like /api/system (t259 law).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Canonical lines — the campaign's numbers, now product constants     */
/* ------------------------------------------------------------------ */

/**
 * The three memory lines the campaign has already litigated, in MB:
 *  - guardAvailable (2600): below this the build guard refuses a rebuild
 *    (t525 — available 865MB was the first NO-GO's honest verdict).
 *  - guardBuffCache (1450): below this the page cache is COLLAPSED — the
 *    t461 21-loss profile; a build started here dies mid-grind (the line
 *    is 1450, not 1500: node_modules' own cache ceiling is ~1.44-1.46GB).
 *  - recycle (2600): where the DEV watchdog recycles next-server BEFORE
 *    the kernel's OOM draw (t524). NOTE the category: it polices one
 *    process's RSS on the dev lane — it must never be compared against
 *    the box's MemAvailable; it appears in the legend for exactly that
 *    teaching reason.
 */
export const MEMORY_LINES = {
  guardAvailable: 2600,
  guardBuffCache: 1450,
  recycle: 2600,
} as const;

export type MemoryLaneVerdict = "go" | "nogo";
export type CacheLaneVerdict = "warm" | "collapsed";
/** Overall health: danger < watch < healthy. */
export type MemoryVerdict = "danger" | "watch" | "healthy";

export interface MemoryNumbers {
  memTotalMb: number;
  memAvailableMb: number;
  buffCacheMb: number;
  swapTotalMb: number;
}

export interface MemoryLanes extends MemoryNumbers {
  availableLane: MemoryLaneVerdict;
  cacheLane: CacheLaneVerdict;
  verdict: MemoryVerdict;
  verdictReason: string;
}

/**
 * The pure verdict. Two lanes, each with its own canonical line:
 *  - available lane: >= 2600 is "go" (the build guard would open).
 *  - cache lane: >= 1450 is "warm" (no collapse profile).
 * The overall verdict is the WORST of the readings:
 *  - danger: available below the collapse neighborhood (1450) — the
 *    OOM-storm territory where the kernel picks victims (t461 profile).
 *  - watch: available below the guard's GO line, OR the page cache
 *    collapsed — builds are refused, interactive use still fine.
 *  - healthy: both lanes read green.
 */
export function composeMemoryLanes(
  m: MemoryNumbers,
  lines: { guardAvailable: number; guardBuffCache: number } = MEMORY_LINES
): MemoryLanes {
  const availableLane: MemoryLaneVerdict = m.memAvailableMb >= lines.guardAvailable ? "go" : "nogo";
  const cacheLane: CacheLaneVerdict = m.buffCacheMb >= lines.guardBuffCache ? "warm" : "collapsed";
  let verdict: MemoryVerdict;
  let verdictReason: string;
  if (m.memAvailableMb < lines.guardBuffCache) {
    verdict = "danger";
    verdictReason =
      "Available memory is below the collapse neighborhood — the kernel is close to picking victims (the t461 OOM-storm profile). Stop heavy lanes before anything else.";
  } else if (m.memAvailableMb < lines.guardAvailable || cacheLane === "collapsed") {
    verdict = "watch";
    verdictReason =
      "Interactive use is fine, but a rebuild would be refused here: the build guard needs " +
      `${lines.guardAvailable}MB available and ${lines.guardBuffCache}MB page cache before it says GO.`;
  } else {
    verdict = "healthy";
    verdictReason = "Both lanes read green — the build guard would open a rebuild window on this box.";
  }
  return { ...m, availableLane, cacheLane, verdict, verdictReason };
}

export interface ParsedMeminfo {
  memTotalMb: number;
  memAvailableMb: number;
  buffCacheMb: number;
  swapTotalMb: number;
}

/** Parse /proc/meminfo bytes into MB numbers (buff/cache = Buffers + Cached + SReclaimable, free(1) semantics). */
export function parseMeminfo(text: string): ParsedMeminfo {
  const kb = (key: string): number => {
    const match = text.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"));
    return match ? Number(match[1]) : 0;
  };
  const toMb = (v: number) => Math.round(v / 1024);
  const buffers = kb("Buffers");
  const cached = kb("Cached");
  const sreclaimable = kb("SReclaimable");
  return {
    memTotalMb: toMb(kb("MemTotal")),
    memAvailableMb: toMb(kb("MemAvailable")),
    buffCacheMb: toMb(buffers + cached + sreclaimable),
    swapTotalMb: toMb(kb("SwapTotal")),
  };
}

/** Thin adapter: read this host's memory lanes. Null when /proc is not readable. */
export function readMemoryLanes(): MemoryLanes | null {
  try {
    return composeMemoryLanes(parseMeminfo(readFileSync("/proc/meminfo", "utf8")));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Disk                                                               */
/* ------------------------------------------------------------------ */

export interface DiskVitals {
  totalMb: number;
  freeMb: number;
  usedPct: number;
}

export interface StatfsLike {
  bsize: number;
  blocks: number;
  bavail: number;
}

/** Pure: turn a statfs triple into disk vitals (MB, usedPct of the whole fs). */
export function composeDiskVitals(stat: StatfsLike): DiskVitals {
  const totalMb = Math.round((stat.blocks * stat.bsize) / (1024 * 1024));
  const freeMb = Math.round((stat.bavail * stat.bsize) / (1024 * 1024));
  const usedPct = stat.blocks > 0 ? Math.round(((stat.blocks - stat.bavail) / stat.blocks) * 100) : 0;
  return { totalMb, freeMb, usedPct };
}

export async function readDiskVitals(root = process.cwd()): Promise<DiskVitals | null> {
  try {
    const { statfs } = await import("node:fs/promises");
    return composeDiskVitals(await statfs(root));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Build provenance                                                   */
/* ------------------------------------------------------------------ */

export interface BuildProvenance {
  /** Short sha the running build was compiled from — null when unmarked. */
  commit: string | null;
  /** True when the running server is the standalone lane (prod). */
  standalone: boolean;
}

/**
 * The provenance stamp t525's recipe writes at build time
 * (.next/.built-at-commit). The prod lane runs with the project root as
 * cwd, so a relative read lands on the tree's stamp.
 */
export function readBuildProvenance(root = process.cwd()): BuildProvenance {
  try {
    const stamp = join(root, ".next", ".built-at-commit");
    const commit = existsSync(stamp) ? readFileSync(stamp, "utf8").trim() || null : null;
    const standalone = existsSync(join(root, ".next", "standalone", "server.js"));
    return { commit, standalone };
  } catch {
    return { commit: null, standalone: false };
  }
}

/* ------------------------------------------------------------------ */
/* World census                                                       */
/* ------------------------------------------------------------------ */

export interface WorldCensus {
  projects: number;
  jobs: number;
  runningJobs: number;
}

export async function readWorldCensus(): Promise<WorldCensus> {
  const { db } = await import("@/lib/db");
  const [projects, jobs, runningJobs] = await Promise.all([
    db.project.count(),
    db.job.count(),
    db.job.count({ where: { status: "running" } }),
  ]);
  return { projects, jobs, runningJobs };
}

/* ------------------------------------------------------------------ */
/* The one payload                                                    */
/* ------------------------------------------------------------------ */

export interface DiagnosticsPayload {
  memory: MemoryLanes | null;
  disk: DiskVitals | null;
  provenance: BuildProvenance;
  world: WorldCensus | null;
  generatedAt: string;
}

export async function readDiagnostics(): Promise<DiagnosticsPayload> {
  const [memory, disk, world] = await Promise.all([
    Promise.resolve(readMemoryLanes()),
    readDiskVitals(),
    readWorldCensus().catch(() => null),
  ]);
  return {
    memory,
    disk,
    provenance: readBuildProvenance(),
    world,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* The AI tool's face — a pure presenter over the same well            */
/* ------------------------------------------------------------------ */

/** Structural twin of the AI layer's AiToolResult — declared locally so
 *  this pure module stays import-light (the bench's node lane must not
 *  drag the whole tool world in just to test the summary). */
export interface DiagnosticsToolResult {
  ok: boolean;
  summary: string;
  detail?: unknown;
}

/**
 * t530 — the BOX's agent face. PURE presenter over the diagnostics
 * payload (the bench fixtures numbers, not hosts): the well is
 * readDiagnostics — the EXACT bytes the /api/diagnostics route serves
 * and the System diagnostics dialog renders (three cups, one well).
 * The summary is a LOCATOR of the numbers a decision needs (can a
 * rebuild start? is the page cache warm? what's running?); the annex
 * is the payload verbatim. Honest nulls ride through: a lane that
 * could not be read is SAID, not guessed.
 */
export function presentSystemDiagnostics(payload: DiagnosticsPayload | null): DiagnosticsToolResult {
  if (!payload) {
    return {
      ok: false,
      summary:
        "The diagnostics read itself failed — no payload came back to quote. The header's System diagnostics button (or the palette row) shows what the panel itself reports.",
    };
  }
  const m = payload.memory;
  const d = payload.disk;
  const w = payload.world;
  const memoryLine = m
    ? `available ${m.memAvailableMb}MB (guard GO line ${m.availableLane === "go" ? "passed" : "NOT passed"}) · page cache ${m.buffCacheMb}MB (${m.cacheLane}) · verdict ${m.verdict}`
    : "memory lanes unreadable on this host";
  const diskLine = d ? `disk ${d.usedPct}% used, ${d.freeMb}MB free` : "disk unreadable";
  const worldLine = w
    ? `${w.projects} projects · ${w.jobs} jobs · ${w.runningJobs} running`
    : "census unreadable";
  const buildLine = payload.provenance.commit
    ? `running build ${payload.provenance.commit}${payload.provenance.standalone ? " (standalone lane)" : ""}`
    : "running build carries no provenance stamp (dev or legacy lane)";
  return {
    ok: true,
    summary: `The box: ${memoryLine}. ${diskLine}. ${worldLine}. ${buildLine}.`,
    detail: payload,
  };
}
