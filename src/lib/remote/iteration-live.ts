/**
 * CryoFlow — LIVE iteration snapshots for a running REMOTE classification
 * job (t350, the user's 「中间过程的结果没有实时展示，希望每一轮的 2D 分类
 * 的结果图都要能及时在本地客户端中显示出来」).
 *
 * A running class2d/class3d/refine3d writes, on the CLUSTER, one
 * `run_itNNN_data.star` (particle→class assignment) and one
 * `run_itNNN_classes.mrcs` (the class-average stack) PER ITERATION. The
 * local mirror stays empty until the sync-back — so the results tab used to
 * show nothing for the whole run. This module is the live leg:
 *
 *   · remoteLiveIterations() — ONE SSH round that lists the iteration
 *     files and counts class occupancy ON THE CLUSTER with a POSIX awk
 *     (the t346 doctrine: zero star bytes cross the wire). 12s TTL cache
 *     so the UI's poll never storms the login node.
 *   · localIterations() — the same shape answered from the LOCAL mirror
 *     once the sync-back landed (job finished), mtime-cached.
 *   · ensureIterationAssets() — pulls a class-average stack ONCE per
 *     iteration file (a few MB), renders EVERY slice to a small PNG plus
 *     the t354 SHEET (the whole iteration as ONE grid image — the user's
 *     「每一轮的 2D 结果生成一张图片」), keeps the PNGs (KBs each) and
 *     DELETES the stack — the t339 mirror-slimming contract holds: image
 *     stacks never live in the local mirror, only their rendered
 *     thumbnails do.
 *
 * Server-only module (fs, ssh).
 */

import path from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";
import { readMrcHeader, renderClassSheetPng, renderMrcSlicePng } from "@/lib/mrc";
import { DATA_DIR } from "@/lib/paths";
import { getConnection } from "./connections";
import { exec, remoteDownload } from "./ssh";
import type { RemoteConnection } from "./types";

const PREVIEW_DIR = path.join(DATA_DIR, "remote-preview");
/** how long a live snapshot answers from memory before the next SSH round */
const LIVE_TTL_MS = 12_000;
/** a class-average stack is a few MB — 64 MB is a generous ceiling */
const STACK_FETCH_CAP = 64 * 1024 * 1024;
/** the job types whose iterations are worth a live gallery */
export const LIVE_ITERATION_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel"]);

export interface LiveClassEntry {
  cls: number;
  count: number;
  /** share of assigned particles, 0–1 */
  fraction: number;
}

/** one iteration's class-average stack — t354's chips bar consumes this */
export interface StackEntry {
  /** the RELION iteration number (run_it007 → 7) */
  iter: number;
  /** workdir-relative stack file name */
  file: string;
}

export interface IterationsPayload {
  /** true while the numbers came over SSH from the cluster (job running) */
  remote: boolean;
  /** iteration numbers that have a data star on disk, ascending */
  iterations: number[];
  latest: number | null;
  classes: LiveClassEntry[];
  total: number;
  /** newest class-average stack, workdir-relative (render target) */
  classesFile: string | null;
  classesSlices: number | null;
  /** t354 — EVERY iteration that has a class-average stack (or a rendered
   * sheet in the local cache), ascending: one chip, one sheet image each */
  stacks: StackEntry[];
  error?: string;
}

/* ------------------------------------------------------------------ */
/* STAR column helpers (the classes route's dialect, shared shape)     */
/* ------------------------------------------------------------------ */

function labelColumn(lines: string[], label: string): number {
  let inLoop = false;
  let pos = 0;
  for (const raw of lines) {
    const t = raw.trim();
    if (t === "loop_") {
      inLoop = true;
      pos = 0;
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      continue;
    }
    if (!inLoop || !t.startsWith("_")) continue;
    pos++;
    if (t.startsWith(label)) {
      const m = /#\s*(\d+)\s*$/.exec(t) ?? /^\S+\s+(\d+)\s*$/.exec(t);
      return m ? parseInt(m[1], 10) - 1 : pos - 1;
    }
  }
  return -1;
}

function labelLineIndex(lines: string[], label: string): number {
  let inLoop = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "loop_") {
      inLoop = true;
      continue;
    }
    if (t.startsWith("data_")) {
      inLoop = false;
      continue;
    }
    if (!inLoop || !t.startsWith("_")) continue;
    if (t.startsWith(label)) return i;
  }
  return -1;
}

/** occupancy of a data star's particle loop — the classes route's count,
 * extracted so the live and local legs speak the same numbers. */
export function countClassOccupancy(text: string): {
  counts: Array<[number, number]>;
  total: number;
} {
  const lines = text.split("\n");
  const classCol = labelColumn(lines, "_rlnClassNumber");
  if (classCol < 0) return { counts: [], total: 0 };
  const counts = new Map<number, number>();
  let total = 0;
  const headerEnd = labelLineIndex(lines, "_rlnClassNumber");
  for (let r = headerEnd + 1; r < lines.length; r++) {
    const t = lines[r].trim();
    if (t === "loop_" || t.startsWith("data_")) break;
    if (!t || t.startsWith("#") || t.startsWith("_")) continue;
    const cells = t.split(/\s+/);
    if (cells.length <= classCol) continue;
    const cls = parseInt(cells[classCol], 10);
    if (Number.isFinite(cls) && cls > 0) {
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
      total++;
    }
  }
  return { counts: [...counts.entries()], total };
}

/* ------------------------------------------------------------------ */
/* iteration file naming                                               */
/* ------------------------------------------------------------------ */

const DATA_STAR_RE = /^(?:run_it|_it)(\d+)_data\.star$/i;
/** a per-iteration class-average stack — the ONLY file names the image
 * route will ever render (its own containment: no ../, no absolute). */
export const STACK_NAME_RE = /^(?:run_it|_it)(\d+)_(?:unmasked_)?classes\.mrcs?$/i;

function stackIteration(name: string): number | null {
  const m = STACK_NAME_RE.exec(name);
  return m ? Number(m[1]) : null;
}

/** prefer the final unmasked stack (RELION 5), else the newest per-iteration */
function pickStack(names: string[]): string | null {
  let best: string | null = null;
  let bestIter = -1;
  for (const n of names) {
    const it = stackIteration(n);
    if (it == null) continue;
    const unmasked = /unmasked/i.test(n);
    const rank = unmasked ? 1_000_000 + it : it;
    if (rank > bestIter) {
      bestIter = rank;
      best = n;
    }
  }
  return best;
}

/** t354 — the chips bar's list: one entry per iteration (the unmasked
 * variant wins a same-iteration tie, mirroring pickStack's preference),
 * ascending by iteration number. */
function stackEntryList(names: string[]): StackEntry[] {
  const byIter = new Map<number, StackEntry>();
  for (const n of names) {
    const it = stackIteration(n);
    if (it == null) continue;
    const prev = byIter.get(it);
    // unmasked outranks plain — same rank math as pickStack
    const rank = (s: string) => (/unmasked/i.test(s) ? 1 : 0);
    if (!prev || rank(n) > rank(prev.file)) byIter.set(it, { iter: it, file: n });
  }
  return [...byIter.values()].sort((a, b) => a.iter - b.iter);
}

/* ------------------------------------------------------------------ */
/* the LIVE leg — one SSH round, awk on the cluster                    */
/* ------------------------------------------------------------------ */

const liveCache = new Map<string, { at: number; payload: IterationsPayload }>();

function shSingleQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * The occupancy awk, POSIX — runs ON THE CLUSTER against the newest
 * data star. The `_rlnClassNumber` column index comes from the loop's own
 * header (`#N` suffix or header order), the count from the data rows of
 * THAT loop only (the optics block above never inflates a class).
 */
function occupancyAwkFor(dsPath: string): string {
  return [
    "awk '",
    "  /^data_(particles)?[ \t]*$/ { inpar=1; next }",
    "  inpar && /^loop_/ { inloop=1; next }",
    "  inpar && /^_/ {",
    "    if ($0 ~ /^_rlnClassNumber/) {",
    "      n = $0; sub(/^.*#/, \"\", n); sub(/[^0-9].*$/, \"\", n)",
    "      clscol = (n ~ /^[0-9]+$/) ? n + 0 : hdr + 1",
    "    }",
    "    hdr++",
    "    next",
    "  }",
    "  inloop && !/^_/ && !/^#/ && NF >= 1 {",
    "    if (clscol && NF >= clscol) { c = $clscol + 0; if (c > 0) { cnt[c]++; total++ } }",
    "    next",
    "  }",
    "  END {",
    "    printf \"TOTAL %d\\n\", total + 0",
    "    for (k in cnt) printf \"CLS %d %d\\n\", k, cnt[k]",
    "  }",
    ` ' ${dsPath}`,
  ].join("\n");
}

/**
 * Live snapshot of a RUNNING remote job. One SSH exec: iteration file
 * lists + the newest data star's class occupancy (awk, zero bytes over
 * the wire). Cached in-process for LIVE_TTL_MS.
 */
export async function remoteLiveIterations(
  jobId: string,
  opts: { force?: boolean } = {}
): Promise<IterationsPayload> {
  const cached = liveCache.get(jobId);
  if (!opts.force && cached && Date.now() - cached.at < LIVE_TTL_MS) {
    return cached.payload;
  }
  const run = getRun(jobId);
  const r = run?.remote;
  if (!run || !r) {
    return { remote: true, iterations: [], latest: null, classes: [], total: 0, classesFile: null, classesSlices: null, stacks: [], error: "no remote run record" };
  }
  const conn: RemoteConnection | null = getConnection(r.connectionId);
  if (!conn) {
    return { remote: true, iterations: [], latest: null, classes: [], total: 0, classesFile: null, classesSlices: null, stacks: [], error: "the cluster connection for this run was deleted — reconnect it to see live results" };
  }
  const W = shSingleQuote(r.remoteWorkdir);
  const script = [
    "set -u",
    `ls ${W} 2>/dev/null | grep -E '^(run_it|_it)[0-9]+_data\\.star$' || true`,
    'echo "---CF-STACKS---"',
    `ls ${W} 2>/dev/null | grep -E '^(run_it|_it)[0-9]+_(unmasked_)?classes\\.mrcs$' || true`,
    'echo "---CF-OCC---"',
    `DS=$(ls ${W} 2>/dev/null | grep -E '^(run_it|_it)[0-9]+_data\\.star$' | sort | tail -1)`,
    'if [ -n "$DS" ]; then',
    // $DS must expand REMOTE-SIDE: the quoted workdir prefix is glued to
    // the bare $DS so bash expands it as the awk file argument
    occupancyAwkFor(`${W}/$DS`),
    'fi',
  ].join("\n");
  const res = await exec(conn, script, { timeoutMs: 25_000 });
  if (res.error) {
    return { remote: true, iterations: [], latest: null, classes: [], total: 0, classesFile: null, classesSlices: null, stacks: [], error: `SSH to ${conn.host} failed (${res.error})` };
  }
  const sections = res.stdout.split("---CF-STACKS---");
  const dataStars = (sections[0] ?? "")
    .split("\n").map((l) => l.trim()).filter((l) => DATA_STAR_RE.test(l));
  const rest = (sections[1] ?? "").split("---CF-OCC---");
  const stacks = (rest[0] ?? "")
    .split("\n").map((l) => l.trim()).filter((l) => STACK_NAME_RE.test(l));
  const occText = rest[1] ?? "";

  const iterations = dataStars
    .map((n) => Number(DATA_STAR_RE.exec(n)?.[1] ?? NaN))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const latest = iterations.length > 0 ? iterations[iterations.length - 1] : null;

  const counts = new Map<number, number>();
  let total = 0;
  for (const line of occText.split("\n")) {
    const t = line.trim();
    const tm = /^CLS (\d+) (\d+)$/.exec(t);
    if (tm) {
      counts.set(Number(tm[1]), Number(tm[2]));
      continue;
    }
    const tot = /^TOTAL (\d+)$/.exec(t);
    if (tot) total = Number(tot[1]);
  }
  const classes: LiveClassEntry[] = [...counts.entries()]
    .map(([cls, count]) => ({ cls, count, fraction: total > 0 ? count / total : 0 }))
    .sort((a, b) => a.cls - b.cls);

  const classesFile = pickStack(stacks);
  let classesSlices: number | null = null;
  // slice count is only needed for the gallery; derive it lazily from the
  // class count when the stack exists but was not pulled yet (rendering
  // verifies against the real header)
  if (classesFile && classes.length > 0) {
    classesSlices = classes[classes.length - 1].cls;
  }

  const payload: IterationsPayload = {
    remote: true,
    iterations,
    latest,
    classes,
    total,
    classesFile,
    classesSlices,
    stacks: stackEntryList(stacks),
  };
  liveCache.set(jobId, { at: Date.now(), payload });
  return payload;
}

/* ------------------------------------------------------------------ */
/* the LOCAL leg — the mirror after the sync-back                      */
/* ------------------------------------------------------------------ */

/** t354 — stacks the local cache has already rendered for this job (the
 * sheet/slice PNGs under PREVIEW_DIR/live/<jobId>/). The sync-back's
 * slimming excludes the per-iteration stacks, so once a run finishes the
 * CACHE is where its history lives — the chips bar must still show every
 * round the user watched (and any round they click later can be re-pulled
 * on demand by the sheet route when the run record is remote). */
function cachedStackEntries(jobId: string): StackEntry[] {
  const dir = path.join(PREVIEW_DIR, "live", jobId);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  // cache dirs are keyed by the stack BASE name (run_it007_classes) — the
  // .mrcs reconstruction passes STACK_NAME_RE and lands on the same dir
  // for either extension (liveStackDir strips both identically)
  return stackEntryList(names.map((n) => `${n}.mrcs`).filter((f) => STACK_NAME_RE.test(f)));
}

export function localIterations(workdir: string, jobId?: string): IterationsPayload {
  if (!existsSync(workdir)) {
    // honest shape: no occupancy data without the mirror — only the chips
    // (cached sheets) are viewable for a run whose mirror never landed
    const cached = jobId ? cachedStackEntries(jobId) : [];
    return {
      remote: false,
      iterations: [],
      latest: null,
      classes: [],
      total: 0,
      classesFile: null,
      classesSlices: null,
      stacks: cached,
    };
  }
  const names = readdirSync(workdir);
  const iterations = names
    .map((n) => {
      const m = DATA_STAR_RE.exec(n);
      return m ? Number(m[1]) : NaN;
    })
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const latest = iterations.length > 0 ? iterations[iterations.length - 1] : null;

  let classes: LiveClassEntry[] = [];
  let total = 0;
  let classesFile: string | null = pickStack(names);
  let classesSlices: number | null = null;
  if (classesFile) {
    const hdr = readMrcHeader(path.join(workdir, classesFile));
    if (hdr) classesSlices = hdr.nz;
  }
  const finalStar = latest != null
    ? names.find((n) => DATA_STAR_RE.test(n) && Number(DATA_STAR_RE.exec(n)?.[1]) === latest)
    : null;
  if (finalStar) {
    const counted = cachedFileCompute(path.join(workdir, finalStar), "live-iterations:occupancy", (text) =>
      countClassOccupancy(text)
    );
    if (counted) {
      total = counted.total;
      classes = counted.counts
        .map(([cls, count]) => ({ cls, count, fraction: total > 0 ? count / total : 0 }))
        .sort((a, b) => a.cls - b.cls);
    }
  }
  // t354 — the chips list unions the mirror's stacks with the cache's
  // (the mirror holds what the sync-back kept, the cache holds every
  // stack the live leg ever pulled — both are viewable)
  const mirrorStacks = stackEntryList(names);
  const cached = jobId ? cachedStackEntries(jobId) : [];
  const seen = new Set(mirrorStacks.map((s) => s.iter));
  const stacks = [...mirrorStacks, ...cached.filter((s) => !seen.has(s.iter))]
    .sort((a, b) => a.iter - b.iter);
  return { remote: false, iterations, latest, classes, total, classesFile, classesSlices, stacks };
}

/* ------------------------------------------------------------------ */
/* class-average rendering — one pull per stack, PNGs stay, stack goes */
/* ------------------------------------------------------------------ */

/** one pulled stack's rendered product: every slice PNG + the t354 sheet */
export interface IterationAssets {
  slices: number;
  sheet: Buffer | null;
}

const stackInFlight = new Map<string, Promise<IterationAssets | null>>();

function liveStackDir(jobId: string, stackName: string): string {
  return path.join(PREVIEW_DIR, "live", jobId, stackName.replace(/\.mrcs?$/i, ""));
}

function stackPngPath(jobId: string, stackName: string, slice: number): string {
  return path.join(liveStackDir(jobId, stackName), `slice${String(slice).padStart(4, "0")}.png`);
}

function sheetPngPath(jobId: string, stackName: string): string {
  return path.join(liveStackDir(jobId, stackName), "sheet.png");
}

/**
 * Pull ONE class-average stack from the cluster, render EVERY slice to a
 * small PNG plus the t354 SHEET (the whole iteration as one grid image),
 * then delete the stack (the t339 slimming contract: rendered thumbnails
 * persist — KBs each — the MB-scale stack does not). Concurrent requests
 * for the same stack share one pull. Returns the slice count and the sheet
 * buffer, or null when the pull/render failed (the route answers an
 * honest error). The sheet is best-effort: a stack whose sheet render
 * fails still answers its slices (the per-class grid keeps working).
 */
export async function ensureIterationAssets(
  connectionId: string,
  remoteWorkdir: string,
  jobId: string,
  stackName: string
): Promise<IterationAssets | null> {
  const key = `${connectionId}:${remoteWorkdir}/${stackName}`;
  const existing = stackInFlight.get(key);
  if (existing) return existing;
  const task = (async (): Promise<IterationAssets | null> => {
    const conn = getConnection(connectionId);
    if (!conn) return null;
    const clusterPath = `${remoteWorkdir.replace(/\/+$/, "")}/${stackName}`;
    const dir = liveStackDir(jobId, stackName);
    mkdirSync(dir, { recursive: true });
    const transient = path.join(dir, ".stack.mrcs");
    try {
      const got = await remoteDownload(conn, clusterPath, transient, STACK_FETCH_CAP);
      if (got == null || got < 0) return null;
      const hdr = readMrcHeader(transient);
      if (!hdr) return null;
      for (let z = 0; z < hdr.nz; z++) {
        const png = await renderMrcSlicePng(transient, z);
        if (png) {
          try {
            writeFileSync(stackPngPath(jobId, stackName, z), png);
          } catch {
            /* best-effort cache write */
          }
        }
      }
      // t354 — the whole-iteration sheet, rendered from the transient
      // stack before the finally-clause deletes it
      let sheet: Buffer | null = null;
      try {
        const rendered = await renderClassSheetPng(transient);
        if (rendered) {
          sheet = rendered.png;
          writeFileSync(sheetPngPath(jobId, stackName), rendered.png);
        }
      } catch {
        /* best-effort: slices answered without the sheet */
      }
      return { slices: hdr.nz, sheet };
    } catch {
      return null;
    } finally {
      try {
        if (existsSync(transient)) rmSync(transient, { force: true });
      } catch {
        /* best-effort */
      }
    }
  })();
  stackInFlight.set(key, task);
  try {
    return await task;
  } finally {
    stackInFlight.delete(key);
  }
}

/** A rendered slice PNG from the cache (null = not rendered yet). */
export function readCachedSlicePng(jobId: string, stackName: string, slice: number): Buffer | null {
  const f = stackPngPath(jobId, stackName, slice);
  try {
    const st = statSync(f);
    if (!st.isFile() || st.size === 0) return null;
    return readFileSync(f);
  } catch {
    return null;
  }
}

/** t354 — a rendered iteration sheet from the cache (null = not rendered). */
export function readCachedSheetPng(jobId: string, stackName: string): Buffer | null {
  const f = sheetPngPath(jobId, stackName);
  try {
    const st = statSync(f);
    if (!st.isFile() || st.size === 0) return null;
    return readFileSync(f);
  } catch {
    return null;
  }
}

/** t354 — persist a locally-rendered sheet under the live leg's key. The
 * mirror can lose its per-iteration products (a re-dispatch wipes them —
 * t333); a sheet the user once viewed survives that wipe in the cache,
 * so the chips bar keeps the round and the sheet keeps answering. */
export function cacheSheetPng(jobId: string, stackName: string, png: Buffer): void {
  try {
    mkdirSync(liveStackDir(jobId, stackName), { recursive: true });
    writeFileSync(sheetPngPath(jobId, stackName), png);
  } catch {
    /* best-effort cache write */
  }
}

/** True when the local mirror already holds this stack (finished jobs). */
export function localStackExists(workdir: string, stackName: string): boolean {
  return existsSync(path.join(workdir, stackName));
}
