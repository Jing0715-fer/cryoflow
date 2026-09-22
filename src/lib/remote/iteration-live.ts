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
 *   · ensureClassStackPngs() — pulls the newest class-average stack ONCE
 *     per iteration (a few MB), renders EVERY slice to a small PNG, keeps
 *     the PNGs (KBs each) and DELETES the stack — the t339 mirror-slimming
 *     contract holds: image stacks never live in the local mirror, only
 *     their rendered thumbnails do.
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
import { readMrcHeader, renderMrcSlicePng } from "@/lib/mrc";
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
    return { remote: true, iterations: [], latest: null, classes: [], total: 0, classesFile: null, classesSlices: null, error: "no remote run record" };
  }
  const conn: RemoteConnection | null = getConnection(r.connectionId);
  if (!conn) {
    return { remote: true, iterations: [], latest: null, classes: [], total: 0, classesFile: null, classesSlices: null, error: "the cluster connection for this run was deleted — reconnect it to see live results" };
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
    return { remote: true, iterations: [], latest: null, classes: [], total: 0, classesFile: null, classesSlices: null, error: `SSH to ${conn.host} failed (${res.error})` };
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
  };
  liveCache.set(jobId, { at: Date.now(), payload });
  return payload;
}

/* ------------------------------------------------------------------ */
/* the LOCAL leg — the mirror after the sync-back                      */
/* ------------------------------------------------------------------ */

export function localIterations(workdir: string): IterationsPayload {
  if (!existsSync(workdir)) {
    return { remote: false, iterations: [], latest: null, classes: [], total: 0, classesFile: null, classesSlices: null };
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
  return { remote: false, iterations, latest, classes, total, classesFile, classesSlices };
}

/* ------------------------------------------------------------------ */
/* class-average rendering — one pull per stack, PNGs stay, stack goes */
/* ------------------------------------------------------------------ */

const stackInFlight = new Map<string, Promise<number | null>>();

function liveStackDir(jobId: string, stackName: string): string {
  return path.join(PREVIEW_DIR, "live", jobId, stackName.replace(/\.mrcs?$/i, ""));
}

function stackPngPath(jobId: string, stackName: string, slice: number): string {
  return path.join(liveStackDir(jobId, stackName), `slice${String(slice).padStart(4, "0")}.png`);
}

/**
 * Pull ONE class-average stack from the cluster, render EVERY slice to a
 * small PNG, then delete the stack (the t339 slimming contract: rendered
 * thumbnails persist — KBs each — the MB-scale stack does not). Concurrent
 * requests for the same stack share one pull. Returns the slice count, or
 * null when the pull/render failed (the route answers an honest error).
 */
export async function ensureClassStackPngs(
  connectionId: string,
  remoteWorkdir: string,
  jobId: string,
  stackName: string
): Promise<number | null> {
  const key = `${connectionId}:${remoteWorkdir}/${stackName}`;
  const existing = stackInFlight.get(key);
  if (existing) return existing;
  const task = (async (): Promise<number | null> => {
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
      return hdr.nz;
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

/** True when the local mirror already holds this stack (finished jobs). */
export function localStackExists(workdir: string, stackName: string): boolean {
  return existsSync(path.join(workdir, stackName));
}
