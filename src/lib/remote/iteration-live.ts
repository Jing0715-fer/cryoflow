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
import { exec, remoteDownload, remoteStat } from "./ssh";
import type { RemoteConnection } from "./types";

const PREVIEW_DIR = path.join(DATA_DIR, "remote-preview");
/** how long a live snapshot answers from memory before the next SSH round */
const LIVE_TTL_MS = 12_000;
/** a class-average stack is a few MB — but a REAL 2D run with 100–200
 * classes at a 300–400 px box writes 100–200 MB stacks (t355: the old 64 MB
 * ceiling refused those pulls with a 404 that said "may not exist", while
 * the stack sat healthy on the cluster). 256 MB covers a 200-class 400-px
 * run; anything bigger is a genuinely unusual run. */
const STACK_FETCH_CAP = 256 * 1024 * 1024;
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
 * route will ever render (its own containment: no ../, no absolute).
 * t356 — RELION 5's FINAL unmasked stack (`run_unmasked_classes.mrcs`,
 * no iteration number) joins the whitelist: the classes route prefers it
 * as the selection gallery's source, so the image route must accept it
 * too. stackIteration() answers null for it (it has no round number),
 * which keeps it OUT of the chips bar — chips are per-round by design. */
export const STACK_NAME_RE =
  /^(?:(?:run_it|_it)(\d+)_(?:unmasked_)?classes|run_unmasked_classes)\.mrcs?$/i;

function stackIteration(name: string): number | null {
  const m = STACK_NAME_RE.exec(name);
  return m && m[1] != null ? Number(m[1]) : null;
}

/** prefer the final unmasked stack (RELION 5), else the newest per-iteration
 * — the SAME preference the classes route's pickStackName speaks, so both
 * galleries agree on which stack is "the" class averages of a run. */
function pickStack(names: string[]): string | null {
  let best: string | null = null;
  let bestIter = -1;
  for (const n of names) {
    if (/^run_unmasked_classes\.mrcs?$/i.test(n)) return n;
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
    // t356 — RELION 5's FINAL unmasked stack (no round number) joins the
    // listing: pickStack prefers it as the run's class averages, so the
    // listing must be able to SEE it (the old grep dropped it and the
    // preference was dead code)
    `ls ${W} 2>/dev/null | grep -E '^(run_it|_it)[0-9]+_(unmasked_)?classes\\.mrcs?$|^run_unmasked_classes\\.mrcs?$' || true`,
    'echo "---CF-OCC---"',
    `DS=$(ls ${W} 2>/dev/null | grep -E '^(run_it|_it)[0-9]+_data\\.star$' | sort | tail -1)`,
    'if [ -n "$DS" ]; then',
    // $DS must expand REMOTE-SIDE: the quoted workdir prefix is glued to
    // the bare $DS so bash expands it as the awk file argument
    occupancyAwkFor(`${W}/$DS`),
    'fi',
  ].join("\n");
  const res = await exec(conn, script, { timeoutMs: 45_000 });
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
    const cs = jobId ? cachedStackState(jobId) : null;
    return {
      remote: false,
      iterations: [],
      latest: null,
      classes: [],
      total: 0,
      classesFile: cs?.classesFile ?? null,
      classesSlices: cs?.classesSlices ?? null,
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
  // t356 — the RENDER-CACHE fallback: a remote run's class-average stacks
  // stay on the cluster (the key-files caps — a real 100-class 360-px
  // stack is 25–100 MB), but the t356 finalize pipeline already pulled
  // them once and rendered every slice + sheet into the preview cache.
  // The Results grid then answers 100% locally — zero SSH, zero lazy
  // fetch, the「download the mrcs, convert to images locally」architecture
  // the user asked for: after finalize the images ARE local.
  if (!classesFile && jobId) {
    const cs = cachedStackState(jobId);
    if (cs) {
      classesFile = cs.classesFile;
      classesSlices = cs.classesSlices;
    }
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

/** t356 — the render verdict marker: written after a stack's slices (+ best-
 * effort sheet) are on disk, whatever the sheet's own fate. The proactive
 * pipeline and the view trigger skip stacks whose marker exists — a resume
 * that never re-pays a wire for a round already rendered (and a
 * sheet-render failure never re-downloads a stack whose slices answer). */
function doneMarkerPath(jobId: string, stackName: string): string {
  return path.join(liveStackDir(jobId, stackName), ".done");
}

/** True when this stack's render verdict is already on disk. The t356
 * marker is the canonical witness; a sheet.png from a t354/t355-era cache
 * says the same thing (the sheet is rendered AFTER every slice, so its
 * presence means the whole pass ran) — old caches stay valid. */
export function stackRendered(jobId: string, stackName: string): boolean {
  try {
    if (statSync(doneMarkerPath(jobId, stackName)).isFile()) return true;
  } catch {
    /* no marker — maybe a legacy cache */
  }
  try {
    return statSync(sheetPngPath(jobId, stackName)).isFile();
  } catch {
    return false;
  }
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
 *
 * t356 — the pull is BYTE-VERIFIED with retries, the t298 doctrine the
 * /outputs/file lazy fetch has always spoken: the bun+ssh2 receive side
 * can silently truncate a large `cat` mid-stream while reporting success
 * (the t298 exam caught 1.6–48 MB lost per 64 MB transfer), and a real
 * 100-class 360-px stack is 25–100 MB — exactly the shape that truncates.
 * The old single-shot pull rendered readMrcHeader's refusal as a bare 404
 * ("could not fetch … may not exist") while the stack sat healthy on the
 * cluster — the field report's exact symptom. Up to three attempts now:
 * stat → pull → verify landed === expected; a mismatch destroys the
 * partial and retries (a stack still being written by a RUNNING job
 * naturally fails this until its round completes — the next ask retries).
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
      // fast path — a previous render already landed its verdict
      if (stackRendered(jobId, stackName)) {
        let slices = 0;
        try {
          slices = readdirSync(dir).filter((n) => /^slice\d{4}\.png$/.test(n)).length;
        } catch {
          /* fall through to a fresh pull below */
        }
        if (slices > 0) {
          const sheet = readCachedSheetPng(jobId, stackName);
          return { slices, sheet };
        }
      }
      const hdr = await verifiedStackPull(conn, clusterPath, transient);
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
      // the render verdict — slices are on disk (or the render honestly
      // failed below); either way this round never re-pays the wire
      try {
        writeFileSync(doneMarkerPath(jobId, stackName), String(hdr.nz));
      } catch {
        /* best-effort marker */
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

/** The t298-verified pull loop shared by every iteration-stack fetch:
 * stat → cat → byte-count verdict, up to three attempts with a breath
 * between. Returns the parsed header of the COMPLETE local file, or null
 * (the partial is destroyed — a truncated stack must never render). */
async function verifiedStackPull(
  conn: RemoteConnection,
  clusterPath: string,
  transient: string,
  attempts = 3
): Promise<{ nz: number } | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 300));
    const st = await remoteStat(conn, clusterPath);
    if (st == null) return null; // not on the cluster — an honest miss
    if (st.size > STACK_FETCH_CAP) return null; // over the cap — refused
    const written = await remoteDownload(conn, clusterPath, transient, STACK_FETCH_CAP);
    if (written == null) continue; // transfer error — retry on a fresh channel
    if (written === -1) return null; // grew past the cap mid-pull — refuse
    let landed = -1;
    try {
      landed = statSync(transient).size;
    } catch {
      landed = -1;
    }
    if (landed !== st.size) continue; // truncated (or still growing) — retry
    const hdr = readMrcHeader(transient);
    if (hdr) return hdr;
    return null; // complete bytes that are not a readable MRC — a verdict, not a flake
  }
  try {
    if (existsSync(transient)) rmSync(transient, { force: true });
  } catch {
    /* best-effort */
  }
  return null;
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

/* ------------------------------------------------------------------ */
/* t356 — the PROACTIVE render pipeline (the user's architecture:       */
/* download the cluster's mrcs locally, convert to images locally)      */
/* ------------------------------------------------------------------ */

/** how many bytes the background pipeline may spend on ONE run's stacks.
 * A real 20-round 100-class 360-px run writes ~20 × 50 MB ≈ 1 GB; 2 GiB
 * covers it with headroom, and anything past that falls back to the
 * on-demand sheet route (every chip stays clickable — the oldest rounds
 * just wait for a click instead of arriving on their own). */
const RENDER_PIPELINE_TOTAL_CAP = 2 * 1024 * 1024 * 1024;

const pipelineInFlight = new Map<string, Promise<void>>();

export interface ScheduledStackFile {
  /** workdir-relative stack file name (run_it007_classes.mrcs …) */
  file: string;
  /** bytes on the cluster (the budget's unit) */
  size: number;
}

/**
 * t356 — the user's architecture, made real: 「把 cluster 的 mrcs 结果文件
 *下载到本地，之后将 mrcs 文件转换成图片」. When a remote classification
 * run finishes, the finalize leg hands the run's class-average stacks
 * (named in the sync-back manifest — zero extra SSH) to THIS scheduler:
 * each stack is downloaded to a transient file, converted to per-class
 * PNGs + the t354 sheet in the LOCAL preview cache, then the MB-scale
 * stack is deleted (the t339 slimming contract keeps holding). After the
 * pipeline, both galleries answer from local bytes — no wire, no lazy
 * fetch, no "the image may not exist" roulette.
 *
 *   · newest rounds first (the rounds the user picks classes from); older
 *     rounds keep the on-demand door if the total cap stops the queue
 *   · already-rendered rounds skip for free (the .done marker — restarts
 *     and re-schedules resume instead of re-paying the wire)
 *   · fire-and-forget: the finalize sweep is NEVER blocked (transfers
 *     ride the same direct pooled channels remoteDownload always used,
 *     parallel to the serialized exec queue)
 *   · one pipeline per job at a time; a second schedule while running is
 *     absorbed (the in-flight pass already covers the union)
 */
export function scheduleRemoteStackRenders(args: {
  jobId: string;
  connectionId: string;
  remoteWorkdir: string;
  files: ScheduledStackFile[];
  reason: string;
}): void {
  const stacks = args.files
    .filter((f) => STACK_NAME_RE.test(f.file))
    // newest first: the final unmasked stack (RELION 5) leads, then the
    // highest iterations — the picking surface arrives before the history
    .sort((a, b) => stackRank(b.file) - stackRank(a.file));
  if (stacks.length === 0) return;
  if (pipelineInFlight.has(args.jobId)) return;
  const task = (async () => {
    let spent = 0;
    let rendered = 0;
    for (const s of stacks) {
      if (stackRendered(args.jobId, s.file)) continue;
      if (spent + s.size > RENDER_PIPELINE_TOTAL_CAP) continue; // over the run budget — the lazy door stays open for this round
      try {
        const assets = await ensureIterationAssets(
          args.connectionId,
          args.remoteWorkdir,
          args.jobId,
          s.file
        );
        if (assets) {
          spent += s.size;
          rendered += 1;
        }
      } catch {
        /* one round's failure never stops the queue */
      }
    }
    if (rendered > 0) {
      console.log(
        `iteration-live: rendered ${rendered} class-average stack(s) of job ${args.jobId} into the local preview cache (${args.reason})`
      );
    }
  })()
    .catch(() => undefined)
    .finally(() => pipelineInFlight.delete(args.jobId));
  pipelineInFlight.set(args.jobId, task);
}

/** the newest-first ordering key: the final unmasked stack outranks every
 * round, then higher iteration numbers win. */
function stackRank(name: string): number {
  if (/^run_unmasked_classes\.mrcs?$/i.test(name)) return 2_000_000_000;
  const it = stackIteration(name);
  return it ?? -1;
}

/** t356 — what the local preview cache already holds for a job, in the
 * classes route's shape: the newest rendered stack's name + its slice
 * count (counted from the slice PNGs on disk). Null when nothing has
 * been rendered yet. Both galleries use this as the zero-SSH answer
 * once the pipeline ran. */
export function cachedStackState(
  jobId: string
): { classesFile: string; classesSlices: number } | null {
  const dir = path.join(PREVIEW_DIR, "live", jobId);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  // only RENDERED stacks count (a dir without the verdict marker could be
  // a half-written render from a crashed pass)
  const rendered = names
    .map((n) => `${n}.mrcs`)
    .filter((f) => STACK_NAME_RE.test(f) && stackRendered(jobId, f));
  const picked = pickStack(rendered);
  if (!picked) return null;
  let slices = 0;
  try {
    slices = readdirSync(path.join(dir, picked.replace(/\.mrcs?$/i, ""))).filter((n) =>
      /^slice\d{4}\.png$/.test(n)
    ).length;
  } catch {
    slices = 0;
  }
  if (slices <= 0) return null;
  return { classesFile: picked, classesSlices: slices };
}
