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
 *  - ONE INSTRUMENT, MANY MOUTHS (t1165) — the world's durability
 *    verdict is NOT re-derived here: readWorldDurability spawns the
 *    probe instrument itself (scripts/world-snapshot.mjs probe, the
 *    t1162 doorbell) and quotes its machine JSON verbatim. A second
 *    verdict ladder in the product would drift from the instrument the
 *    cron family rides — the doorbell law's jurisdictions hold because
 *    there is exactly ONE probe. A mute instrument is an honest face
 *    ({ ok: false, why }), never a guessed verdict.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { relativeAgeWord } from "@/lib/world-durability-words";
import { isThreadComm, oomCombatantsWord, oomInvokersWord, oomLeakWord, oomTempoWord } from "@/lib/pressure-words";

export { oomCombatantsWord, oomInvokersWord, oomLeakWord, oomTempoWord, isThreadComm }; // t880/t881/t882 — the words live in ONE client-safe birthplace (pressure-words.ts); the lib re-exports so the seat's import surface and the presenter stay put

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
/* Memory pressure (t879) — the OOM war's ledger                       */
/* ------------------------------------------------------------------ */

/**
 * t879 — the box's own testimony about its memory wars, read from the
 * kernel ring (dmesg) and /proc/self/status. The evidence-from-bytes law
 * (the module header's) gains one clause: the KERNEL's ring is bytes —
 * past kills, not a live process walk (the "no process sniffing" law
 * stays intact; nothing here enumerates running processes). On the 4GB
 * box the dev lane, the browser and the platform fight for the same
 * RAM and the kernel kills the biggest resident (the whale law, t1170);
 * today's witness campaign watched it nine times — a diagnosis no
 * memory-lane bar could name. The face answers: how many kills this
 * boot, who died last (and how big), who held the allocator's rope, who
 * dies MOST (t881 — the combatants histogram: the war has regulars),
 * and what THIS server itself parks in RSS — plus the war's deeper
 * rows (t882): who HOLDS the rope most (the invokers histogram — the
 * t881 window's own tail showed the whale invoking its own execution),
 * and whether the whale's recent deaths form a rising curve (a leak
 * signature, the machine's own numbers, never a guessed curve). Every
 * field degrades to
 * null — an unreadable ring (EPERM, no dmesg) is SAID, not guessed.
 */

export interface OomVictim {
  /** the killed process's comm name ("next-server", "chrome", ...) — VERBATIM:
   *  the kernel caps comm at 15 visible chars, so "next-server (v1" (the eaten
   *  closing paren) is the machine's dialect, not a parser bug (t881). */
  comm: string;
  /** the victim's anon-rss at kill time, in MB */
  rssMb: number;
}

/** t881 — the war's COMBATANTS: each distinct victim comm with its kill count
 *  (the histogram behind "who dies most"), rssMb = that comm's most recent
 *  death size. Sorted kills-desc, ties broken by recency (most recent first). */
export interface OomCombatant {
  comm: string;
  kills: number;
  rssMb: number;
}

/** t882 — the rope's holders: each distinct invoker comm with the count of
 *  "X invoked oom-killer" lines it wrote (the histogram behind "who HOLDS
 *  the rope most"). Sorted invocations-desc, ties broken by recency. The
 *  kernel's own stewards (kthreadd, oom-reaper) never tally — the same
 *  filter the last-invoker clause already speaks. */
export interface OomInvoker {
  comm: string;
  invocations: number;
}

/** t882 — the leak signature: the war's top combatant's LAST THREE deaths,
 *  chronological (ring order), carried only when each is strictly greater
 *  than its predecessor — the machine wrote a rising curve (the t881
 *  witness: 2770→2845→2951MB across the whale's 70 deaths); anything else
 *  is weather and stays null, never a guessed curve. */
export interface OomTrend {
  comm: string;
  sizes: number[];
}

export interface MemoryPressure {
  /** kernel-ring OOM kills since boot; null = the ring was unreadable */
  oomKills: number | null;
  /** the most recent victim the kernel named */
  lastVictim: OomVictim | null;
  /** the process that held the allocator's rope at the last kill */
  lastInvoker: string | null;
  /** t881 — the combatants histogram (who dies most), kills-desc order */
  victims: OomCombatant[];
  /** t882 — the invokers histogram (who HOLDS the rope most), invocations-desc order */
  invokers: OomInvoker[];
  /** t882 — the top combatant's rising death curve, when the last three
   *  deaths strictly rise; null = no leak signature in the ring (weather) */
  trend: OomTrend | null;
  /** THIS server's own resident set (VmRSS, MB) — the lane's footprint */
  selfRssMb: number | null;
  /** this boot's uptime in hours (/proc/uptime); null = unreadable — the tempo word's denominator */
  uptimeHours: number | null;
}


const OOM_KILL_RE = /Out of memory:\s+Killed process\s+\d+\s+\((.*)\) total-vm:[^\n]*?anon-rss:(\d+)kB/i;
const OOM_INVOKER_RE = /^(?:\[?\s*[\d:.]+\]?\s+)?(\S+)\s+invoked oom-killer/;

/** Parse a kernel ring dump (dmesg) into the OOM ledger. Pure — the seat
 *  rides fixtures, the reader rides the real ring. The kill regex anchors on
 *  `) total-vm:` so the kernel's 15-char truncated comm ("next-server (v1",
 *  the eaten paren) is quoted VERBATIM — the t881 fixture-truth law. */
export function parseOomRing(text: string): {
  oomKills: number;
  lastVictim: OomVictim | null;
  lastInvoker: string | null;
  victims: OomCombatant[];
  invokers: OomInvoker[];
  trend: OomTrend | null;
} {
  const lines = text.split("\n");
  const killIdxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/Out of memory:\s+Killed process/i.test(lines[i])) killIdxs.push(i);
  }
  // t881 — the combatants histogram: every kill line joins its comm's tally;
  // t882 — the tally also keeps the chronological size history (ring order)
  // so the leak word can quote the whale's own growth curve.
  const tally = new Map<string, { kills: number; rssMb: number; lastIdx: number; sizes: number[] }>();
  for (const idx of killIdxs) {
    const m = lines[idx].match(OOM_KILL_RE);
    if (!m) continue;
    const prev = tally.get(m[1]);
    tally.set(m[1], {
      kills: (prev?.kills ?? 0) + 1,
      rssMb: Math.round(Number(m[2]) / 1024),
      lastIdx: idx,
      sizes: [...(prev?.sizes ?? []), Math.round(Number(m[2]) / 1024)],
    });
  }
  const victims: OomCombatant[] = [...tally.entries()]
    .map(([comm, t]) => ({ comm, kills: t.kills, rssMb: t.rssMb }))
    .sort((a, b) => b.kills - a.kills || tally.get(b.comm)!.lastIdx - tally.get(a.comm)!.lastIdx);
  // t882 — the invokers histogram: EVERY "X invoked oom-killer" line tallies
  // (the rope's regulars), the kernel's own stewards filtered like the
  // last-invoker clause does.
  const rope = new Map<string, { invocations: number; lastIdx: number }>();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(OOM_INVOKER_RE);
    if (m && !/^(kthreadd|oom-reaper)$/.test(m[1])) {
      const prev = rope.get(m[1]);
      rope.set(m[1], { invocations: (prev?.invocations ?? 0) + 1, lastIdx: i });
    }
  }
  const invokers: OomInvoker[] = [...rope.entries()]
    .map(([comm, r]) => ({ comm, invocations: r.invocations }))
    .sort((a, b) => b.invocations - a.invocations || rope.get(b.comm)!.lastIdx - rope.get(a.comm)!.lastIdx);
  // t882 — the leak signature: the war's TOP combatant (the whale), when its
  // last three deaths strictly rise — the curve the machine itself wrote.
  const whale = tally.get(victims[0]?.comm ?? "");
  let trend: OomTrend | null = null;
  if (whale && whale.sizes.length >= 3) {
    const tail = whale.sizes.slice(-3);
    if (tail[0] < tail[1] && tail[1] < tail[2]) trend = { comm: victims[0]!.comm, sizes: tail };
  }
  let lastVictim: OomVictim | null = null;
  if (killIdxs.length > 0) {
    const m = lines[killIdxs[killIdxs.length - 1]].match(OOM_KILL_RE);
    if (m) {
      lastVictim = { comm: m[1], rssMb: Math.round(Number(m[2]) / 1024) };
    }
  }
  // the invoker: the closest "X invoked oom-killer" line AT OR ABOVE the
  // last kill (the allocator that tripped the killer) — fall back to the
  // ring's tail when no kill line exists (an invocation can race the dump)
  const from = killIdxs.length > 0 ? killIdxs[killIdxs.length - 1] : lines.length - 1;
  let lastInvoker: string | null = null;
  for (let i = from; i >= 0; i--) {
    const m = lines[i].match(OOM_INVOKER_RE);
    if (m && !/^(kthreadd|oom-reaper)$/.test(m[1])) {
      lastInvoker = m[1];
      break;
    }
  }
  return { oomKills: killIdxs.length, lastVictim, lastInvoker, victims, invokers, trend };
}

/** Read this host's pressure ledger: the kernel ring (best-effort, 3s cap)
 *  plus THIS process's own VmRSS. Null when the ring is not ours to read. */
export function readMemoryPressure(): MemoryPressure | null {
  let ledger: ReturnType<typeof parseOomRing>;
  try {
    const ring = spawnSync("dmesg", [], {
      timeout: 3000,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    if (ring.status !== 0 || !ring.stdout) return null;
    ledger = parseOomRing(ring.stdout);
  } catch {
    return null;
  }
  let selfRssMb: number | null = null;
  let uptimeHours: number | null = null;
  try {
    const status = readFileSync("/proc/self/status", "utf8");
    const m = status.match(/^VmRSS:\s+(\d+)\s+kB/m);
    if (m) selfRssMb = Math.round(Number(m[1]) / 1024);
  } catch {
    /* the honest absence — /proc/self always exists on linux, but say it */
  }
  try {
    const up = readFileSync("/proc/uptime", "utf8").trim().split(/\s+/)[0];
    const secs = Number(up);
    if (Number.isFinite(secs) && secs > 0) uptimeHours = secs / 3600;
  } catch {
    /* the honest absence — /proc/uptime exists on linux, but say it */
  }
  return { ...ledger, selfRssMb, uptimeHours };
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
 * its launch cwd — BUT Next's standalone server.js calls
 * process.chdir(__dirname) at boot, so the running server's cwd is
 * .next/standalone, two levels below the stamp. The reader therefore
 * walks UP (bounded) from cwd looking for the stamp — the tree's stamp
 * is the authoritative one regardless of which lane launched.
 */
export function readBuildProvenance(root = process.cwd()): BuildProvenance {
  try {
    let dir = root;
    let stamp: string | null = null;
    for (let hop = 0; hop < 4; hop++) {
      const candidate = join(dir, ".next", ".built-at-commit");
      if (existsSync(candidate)) {
        stamp = readFileSync(candidate, "utf8").trim() || null;
        break;
      }
      const parent = join(dir, "..");
      if (parent === dir) break; // filesystem root — stop walking
      dir = parent;
    }
    // standalone layout probe at the FOUND root (or the original root when
    // no stamp exists — a dev lane keeps its own honest false)
    const base = stamp !== null ? dir : root;
    const standalone = existsSync(join(base, ".next", "standalone", "server.js"));
    return { commit: stamp, standalone };
  } catch {
    return { commit: null, standalone: false };
  }
}

/* ------------------------------------------------------------------ */
/* World durability — the probe's product face (t1165)                */
/* ------------------------------------------------------------------ */

/**
 * The world-snapshot probe's verdict, quoted verbatim. The ok face is
 * the probe's own machine JSON (the t1162 verdict ladder); the
 * mute face says WHY the instrument was silent — the card speaks the
 * reason instead of inventing a verdict (honest-nulls law, extended
 * from null to a worded absence).
 */
export type WorldDurability =
  | {
      ok: true;
      verdict: string;
      red: boolean;
      snapshotJobs: number | null;
      liveJobs: number | null;
      snapshotHead: string | null;
      treeHead: string | null;
      exportedAt: string | null;
      probedAt: string;
    }
  | { ok: false; why: string };

/** The seven verdicts the probe ladder speaks, in ladder order — the words live in ONE birthplace (world-durability-words.ts, client-safe; this server module re-speaks them verbatim when quoting the probe). */
export { WORLD_DURABILITY_VERDICTS } from "@/lib/world-durability-words";

/**
 * Parse the probe's stdout into the ok face. The instrument's contract
 * (t1162): ONE machine-JSON line on stdout — take the LAST non-empty
 * line (a chatty future stays parseable), JSON.parse it, and shape-
 * check the named fields; anything else is null (the caller words the
 * mute). A nonzero exit is NOT a mute by itself — the probe exits 1 on
 * doctor-RED verdicts while still speaking valid JSON; the verdict
 * rides and red tells the story.
 */
export function parseProbeStdout(stdout: string): Extract<WorldDurability, { ok: true }> | null {
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.verdict !== "string" || p.verdict.length === 0) return null;
  if (typeof p.red !== "boolean") return null;
  if (typeof p.probedAt !== "string" || p.probedAt.length === 0) return null;
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  return {
    ok: true,
    verdict: p.verdict,
    red: p.red,
    snapshotJobs: numOrNull(p.snapshotJobs),
    liveJobs: numOrNull(p.liveJobs),
    snapshotHead: strOrNull(p.snapshotHead),
    treeHead: strOrNull(p.treeHead),
    exportedAt: strOrNull(p.exportedAt),
    probedAt: p.probedAt,
  };
}

/** Module-level memo — the cwd never changes mid-process. */
let probeScriptPath: string | null | undefined;

/**
 * Locate scripts/world-snapshot.mjs by walking up from cwd (the dev
 * lane lands on the first step; the prod standalone lane lives two
 * steps down inside .next/standalone and the walk reaches it). Cache
 * the miss too — a lane without the instrument stays without it.
 */
export function findProbeScript(): string | null {
  if (probeScriptPath !== undefined) return probeScriptPath;
  probeScriptPath = null;
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "scripts", "world-snapshot.mjs");
    if (existsSync(candidate)) {
      probeScriptPath = candidate;
      break;
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return probeScriptPath;
}

/** The probe's spawn budget — a diagnostics read must not hang the dialog. */
export const PROBE_TIMEOUT_MS = 10_000;

/**
 * Run the REAL probe instrument and quote its verdict (read-only — the
 * probe is count+head, the doorbell's own cheapness; this reader never
 * exports, restores or vacuums). spawnSync argv-direct: code through a
 * shell is code the shell edits first (the t1164 pin). A mute returns
 * the worded absence: instrument missing / spawn error / timeout /
 * unparseable stdout — each said, never guessed.
 */
export function readWorldDurability(): WorldDurability {
  const script = findProbeScript();
  if (!script) {
    return {
      ok: false,
      why: "the probe instrument (scripts/world-snapshot.mjs) was not found on this lane",
    };
  }
  const res = spawnSync(process.execPath, [script, "probe"], {
    encoding: "utf8",
    timeout: PROBE_TIMEOUT_MS,
  });
  if (res.error) {
    const word =
      res.error instanceof Error && res.error.message.includes("ETIMEDOUT")
        ? `the probe did not answer within ${Math.round(PROBE_TIMEOUT_MS / 1000)}s`
        : `the probe could not run: ${res.error.message}`;
    return { ok: false, why: word };
  }
  const face = parseProbeStdout(res.stdout ?? "");
  if (face) return face;
  const tail = (res.stderr ?? "").trim().split("\n").filter(Boolean).pop();
  return {
    ok: false,
    why: tail
      ? `the probe's answer was unreadable (${tail.slice(0, 120)})`
      : "the probe's answer was unreadable (no machine line on stdout)",
  };
}

/**
 * The age word and the verdict's prose live in ONE birthplace
 * (world-durability-words.ts — the client-safe module the dialog
 * renders from); the presenter imports the age word from there. The
 * bench imports the words module directly.
 */

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
  /** t1165 — the probe's verdict, quoted from the ONE instrument. */
  durability: WorldDurability | null;
  /** t879 — the OOM war's ledger (kernel ring + self VmRSS); null = the ring was not ours to read. */
  pressure: MemoryPressure | null;
  generatedAt: string;
}

export async function readDiagnostics(): Promise<DiagnosticsPayload> {
  const [memory, disk, world, pressure] = await Promise.all([
    Promise.resolve(readMemoryLanes()),
    readDiskVitals(),
    readWorldCensus().catch(() => null),
    Promise.resolve(readMemoryPressure()),
  ]);
  let durability: WorldDurability | null = null;
  try {
    durability = readWorldDurability();
  } catch {
    durability = null; // the guard's catch — the card speaks the honest absence
  }
  return {
    memory,
    disk,
    provenance: readBuildProvenance(),
    world,
    durability,
    pressure,
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
  const dur = payload.durability;
  const memoryLine = m
    ? `available ${m.memAvailableMb}MB (guard GO line ${m.availableLane === "go" ? "passed" : "NOT passed"}) · page cache ${m.buffCacheMb}MB (${m.cacheLane}) · verdict ${m.verdict}`
    : "memory lanes unreadable on this host";
  const diskLine = d ? `disk ${d.usedPct}% used, ${d.freeMb}MB free` : "disk unreadable";
  const worldLine = w
    ? `${w.projects} projects · ${w.jobs} jobs · ${w.runningJobs} running`
    : "census unreadable";
  const durLine = dur
    ? dur.ok
      ? `world durability ${dur.verdict} (${dur.red ? "doctor-RED" : "not red"}), snapshot ${dur.snapshotJobs ?? "?"} · live ${dur.liveJobs ?? "?"}${relativeAgeWord(dur.exportedAt) ? `, exported ${relativeAgeWord(dur.exportedAt)}` : ""}`
      : `world durability unreadable (${dur.why})`
    : "world durability unreadable";
  const buildLine = payload.provenance.commit
    ? `running build ${payload.provenance.commit}${payload.provenance.standalone ? " (standalone lane)" : ""}`
    : "running build carries no provenance stamp (dev or legacy lane)";
  const p = payload.pressure;
  const tempo = p ? oomTempoWord(p.oomKills ?? null, p.uptimeHours ?? null) : null;
  const tempoClause = tempo ? ` (${tempo})` : "";
  // t881 — the combatants clause: only when the histogram says something the
  // last-victim clause doesn't already say (more than one distinct comm, or
  // the top comm died more than once — a single ×1 victim is already named)
  const victims = p?.victims;
  const combatants = victims?.length ? oomCombatantsWord(victims) : null;
  const combatantsClause =
    combatants && victims && (victims.length > 1 || (victims[0]?.kills ?? 0) > 1)
      ? `; the war's combatants: ${combatants}`
      : "";
  // t882 — the rope's holders: same information rule as the combatants (one
  // distinct invoker who fired once is already named by the invoked-by clause)
  const ropeHolders = p?.invokers;
  const invokersWord = ropeHolders?.length ? oomInvokersWord(ropeHolders) : null;
  const invokersClause =
    invokersWord && ropeHolders && (ropeHolders.length > 1 || (ropeHolders[0]?.invocations ?? 0) > 1)
      ? `; the rope's holders: ${invokersWord}`
      : "";
  // t882 — the leak signature: rare and loud, it always speaks when the
  // parser saw a rising curve (weather stays silent, never a guessed clause)
  const leakWord = p?.trend ? oomLeakWord(p.trend) : null;
  const leakClause = leakWord ? `; ${leakWord}` : "";
  const pressureLine = p
    ? (p.oomKills ?? 0) > 0
      ? `the kernel ring carries ${p.oomKills} OOM kill${p.oomKills === 1 ? "" : "s"} this boot — the last victim ${p.lastVictim ? `${p.lastVictim.comm} at ${p.lastVictim.rssMb}MB` : "unnamed"}${p.lastInvoker ? ` (invoked by ${p.lastInvoker})` : ""}${tempoClause}${combatantsClause}${invokersClause}${leakClause}${p.selfRssMb != null ? `; this server parks at ${p.selfRssMb}MB` : ""}`
      : `no OOM kill in the kernel ring this boot${p.selfRssMb != null ? `; this server parks at ${p.selfRssMb}MB` : ""}`
    : "the kernel ring was not ours to read (pressure unknown)";
  return {
    ok: true,
    summary: `The box: ${memoryLine}. ${diskLine}. ${worldLine}. ${durLine}. ${buildLine}. ${pressureLine}.`,
    detail: payload,
  };
}
