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
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";
import { readMrcHeader, readMrcSlice, renderClassSheetPng, renderMrcSlicePng, mrcExpectedBytes, type MrcPolarity } from "@/lib/mrc";
import { DATA_DIR } from "@/lib/paths";
import { getConnection } from "./connections";
import { exec, remoteChunkedDownload } from "./ssh";
import {
  witnessMrcHeader,
  witnessSummary,
  cacheSafeHeaderSniffLine,
  cacheSafeHeaderSniffLineForVar,
  wordsAreHealthy,
  wordsAreZero,
  parseHeaderWords,
} from "./cache-witness";
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
  /**
   * t370 — true when this round's rendered stack had ZERO dynamic range
   * (every sampled slice one flat value — the "black classes" field
   * report; a healthy class average is never flat). Set by the render
   * pass from the pulled bytes and persisted as a `.zerodata` marker in
   * the preview cache, so both gallery legs (live and local) badge the
   * round without re-pulling it. Absent = healthy or never measured.
   */
  zeroData?: boolean;
  /**
   * t370 — the stack's MRC header nz as measured on the cluster (the
   * live leg's od sniff rides the same SSH round as the listing; local
   * and cached rounds may not carry it). 0 = the ZERO-HEADER corruption
   * shape (relion_display's "exceeds stack size 0", the t369 disease);
   * absent = unmeasured — renders exactly as before.
   */
  nz?: number;
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
  /** t358 — the last honest refusal recorded for this payload's
   * classesFile (the galleries show it when cards fail, so a dark grid
   * explains itself: which link of the pull broke). Absent when the last
   * attempt succeeded or nothing was tried. */
  renderError?: string;
  /**
   * t370 — ASSET-level zero-data evidence: the classesFile's RENDERED
   * pixels were all identical (the "black classes" field report — the
   * .zerodata marker the render pass wrote). The gallery unions this
   * with the per-round StackEntry.zeroData flags so the badge lands on
   * the chip whichever layer speaks first. Absent = healthy/unmeasured.
   */
  zeroData?: boolean;
  error?: string;
  /**
   * t397 — the payload's version token (the log lane's ?since= dialect,
   * now on the results lane): a hash of everything the gallery renders.
   * An unmoved run answers {unchanged:true} (~40 bytes) so the client's
   * live poll costs nothing until a round actually lands — the same diet
   * t391 gave the log console and t393 gave the jobs heartbeat.
   */
  version?: string;
}

/**
 * t397 — the iterations version token: everything the gallery renders,
 * hashed. Deliberately EXCLUDES derived fields (latest ← iterations,
 * classesSlices ← classes) so equal content always hashes equal.
 */
export function iterationsVersion(p: IterationsPayload): string {
  const material = [
    `i${p.iterations.join(",")}`,
    `l${p.latest ?? "-"}`,
    `c${p.classes.map((c) => `${c.cls}:${c.count}`).join(",")}`,
    `t${p.total}`,
    `f${p.classesFile ?? "-"}`,
    `s${p.stacks.map((s) => `${s.file};${s.nz ?? "?"};${s.zeroData ? 1 : 0}`).join(",")}`,
    `z${p.zeroData ? 1 : 0}`,
    `e${p.renderError ?? "-"}`,
    `r${p.remote ? 1 : 0}`,
    `x${p.error ?? "-"}`,
  ].join("|");
  let h1 = 0;
  let h2 = 0;
  for (let i = 0; i < material.length; i++) {
    const c = material.charCodeAt(i);
    h1 = (h1 * 33 + c) | 0;
    h2 = (h2 * 31 + c) | 0;
  }
  return `${h1.toString(36)}.${h2.toString(36)}.${material.length}`;
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
 * t397 — the shared LIVE-payload builder: both producers feed the SAME
 * parse so the sweep's prewarm (below) and remoteLiveIterations' own SSH
 * round render byte-identical payloads. Pure — no SSH, no clock.
 */
export function livePayloadFromParts(args: {
  jobId: string;
  dataStarNames: string[];
  stackNames: string[];
  /** workdir file name → sniffed MRC nz (absent = unmeasured) */
  nzByName: Map<string, number>;
  occText: string;
}): IterationsPayload {
  const { jobId, dataStarNames, stackNames, nzByName, occText } = args;
  const iterations = dataStarNames
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

  const classesFile = pickStack(stackNames);
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
    // t370 — the chips carry the sniffed nz (live evidence: 0 = the
    // zero-header disease) and the persisted zero-data verdicts (the
    // renders run in the background pipeline; once a marker lands, every
    // later payload badges that round without re-pulling it)
    stacks: withZeroDataFlags(
      stackEntryList(stackNames).map((s) => {
        const nz = nzByName.get(s.file);
        return nz != null ? { ...s, nz } : s;
      }),
      jobId
    ),
    // t370 — asset-level note for the gallery's chosen classesFile (the
    // .zerodata marker the render pass wrote, when that round was pulled)
    ...(classesFile && stackZeroData(jobId, classesFile) ? { zeroData: true as const } : {}),
  };
  return payload;
}

/**
 * t397 — the SWEEP's live-sections script: the data-star listing, the
 * stack-name listing and the newest data star's occupancy awk, in the
 * exact dialect remoteLiveIterations' own round speaks. Appended by the
 * poll sweep to the ROUNDS listing it already carries — one heartbeat
 * then holds EVERYTHING a live gallery needs, and the gallery's HTTP
 * ticks stop paying SSH rounds of their own (they read the prewarmed
 * cache below). `quotedWorkdir` must already be shell-quoted by the
 * caller (the sweep quotes its own W).
 */
export function liveSectionsScript(quotedWorkdir: string): string {
  const W = quotedWorkdir;
  return [
    'echo "---CF:STARS---"',
    `ls ${W} 2>/dev/null | grep -E '^(run_it|_it)[0-9]+_data\\.star$' || true`,
    'echo "---CF:STACKS---"',
    `ls ${W} 2>/dev/null | grep -E '^(run_it|_it)[0-9]+_(unmasked_)?classes\\.mrcs?$|^run_unmasked_classes\\.mrcs?$' || true`,
    'echo "---CF:OCC---"',
    `DS=$(ls ${W} 2>/dev/null | grep -E '^(run_it|_it)[0-9]+_data\\.star$' | sort | tail -1)`,
    "if [ -n \"$DS\" ]; then",
    // $DS must expand REMOTE-SIDE: the quoted workdir prefix is glued to
    // the bare $DS so bash expands it as the awk file argument
    occupancyAwkFor(`${W}/$DS`),
    "fi",
  ].join("\n");
}

/**
 * t397 — the sweep's PREWARM write: a heartbeat that just listed a
 * running classification's rounds/stars/occupancy lands its payload in
 * the same LRU the gallery route reads, stamped NOW. The gallery's next
 * tick finds a fresh cache and never queues its own SSH round — the
 * poll sweep becomes the run's ONLY live reader (the t346 doctrine,
 * extended from logs to results).
 */
export function prewarmLiveIterations(jobId: string, payload: IterationsPayload): void {
  liveCache.delete(jobId);
  liveCache.set(jobId, { at: Date.now(), payload });
  while (liveCache.size > 12) {
    const oldest = liveCache.keys().next().value;
    if (oldest == null) break;
    liveCache.delete(oldest);
  }
}

/**
 * Live snapshot of a RUNNING remote job. One SSH exec: iteration file
 * lists + the newest data star's class occupancy (awk, zero bytes over
 * the wire). Cached in-process for LIVE_TTL_MS.
 *
 * t397 — the cache is now normally fed by the SWEEP's prewarm (every
 * heartbeat while a viewer is present), so this function's own SSH round
 * only runs when the sweep is absent (no viewer, a fresh boot, or a
 * forced refresh) — the gallery's ticks read the prewarmed cache and
 * cost zero wire.
 */
export async function remoteLiveIterations(
  jobId: string,
  opts: { force?: boolean } = {}
): Promise<IterationsPayload> {
  const cached = liveCache.get(jobId);
  if (!opts.force && cached && Date.now() - cached.at < LIVE_TTL_MS) {
    // t391 — LRU bump: the job the gallery keeps asking about must not be
    // the one the 12-entry cap evicts
    liveCache.delete(jobId);
    liveCache.set(jobId, cached);
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
    // t370 — the HEADER SNIFF rides the same round: each round stack's
    // size + first three MRC words (nx ny nz via od, squeezed by tr), so
    // the live chips can badge the ZERO-HEADER disease (nz=0) the moment
    // the round settles — the sweep's own sniff (remote-run.ts) speaks
    // the same dialect for its render gates.
    'echo "---CF-HDRS---"',
    // t384 — the sniff is CACHE-SAFE: the header words come from an
    // O_DIRECT read first (dd iflag=direct), which neither consults nor
    // populates the login node's page cache. The old buffered `od` was
    // reading the growing stacks WHILE the compute node wrote them — on
    // NFS that can cache the header page as zeros on the login node, and
    // every later reader there (this pull, relion_display, md5sum) then
    // serves the stale zero page while the file on the storage is healthy
    // (the manual-run-vs-cryoflow difference: nobody od-sniffs a manual
    // run's files mid-write). The buffered od remains only as the
    // fallback for clusters/filesystems that refuse O_DIRECT.
    //
    // t391 — the NEWEST-12 CAP (same shape as the sweep's): the loop used
    // to walk EVERY settled round, and each round costs a stat + an
    // O_DIRECT dd fork — a long classification made every gallery refresh
    // heavier. The chips bar's iterations come from the data-star listing
    // above (uncapped, cheap); this loop only feeds pickStack + the nz
    // badges, and the newest 12 + the final stack cover both.
    `cd ${W} 2>/dev/null && for f in $(ls -1v run_it???_classes.mrcs 2>/dev/null | tail -12) run_unmasked_classes.mrcs; do [ -f "$f" ] && { stat -c '%s %n' "$f"; ${cacheSafeHeaderSniffLineForVar()}; }; done`,
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
  const rest = (sections[1] ?? "").split("---CF-HDRS---");
  const stacks = (rest[0] ?? "")
    .split("\n").map((l) => l.trim()).filter((l) => STACK_NAME_RE.test(l));
  // t370 — parse the od sniff: a "size name" stat line followed by one
  // "nx ny nz" header line per round; only nz rides the payload (the
  // corruption shape the gallery badges is nz=0; a partial/garbage header
  // line — file mid-write — records NOTHING for that round).
  const nzByName = new Map<string, number>();
  {
    const hdrText = (rest[1] ?? "").split("---CF-OCC---")[0] ?? "";
    let curName: string | null = null;
    for (const line of hdrText.split("\n")) {
      const sm = /^(\d+)\s+(\S+)$/.exec(line.trim());
      if (sm && STACK_NAME_RE.test(sm[2])) {
        curName = sm[2];
        continue;
      }
      if (curName != null) {
        const parts = line.trim().split(/\s+/).filter((t) => /^\d+$/.test(t));
        if (parts.length >= 3) {
          nzByName.set(curName, Number(parts[2]));
        }
        curName = null;
      }
    }
  }
  const occText = (rest[1] ?? "").split("---CF-OCC---")[1] ?? "";

  // t397 — the shared builder keeps this round and the sweep's prewarm
  // byte-identical in what they render (one parse, two producers)
  const payload = livePayloadFromParts({ jobId, dataStarNames: dataStars, stackNames: stacks, nzByName, occText });
  payload.version = iterationsVersion(payload);
  // t391 — bounded LRU: the cache held every job's live snapshot forever
  // (one entry per job that ever streamed rounds; payloads carry stack
  // listings + occupancy). Re-insert at the end = most-recently-used, then
  // evict from the front. 12 jobs covers a full active canvas of running
  // classifications with room to spare.
  liveCache.delete(jobId);
  liveCache.set(jobId, { at: Date.now(), payload });
  while (liveCache.size > 12) {
    const oldest = liveCache.keys().next().value;
    if (oldest == null) break;
    liveCache.delete(oldest);
  }
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
      stacks: jobId ? withZeroDataFlags(cached, jobId) : cached,
      ...(cs?.classesFile && jobId && stackZeroData(jobId, cs.classesFile)
        ? { zeroData: true as const }
        : {}),
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
  // t370 — the chosen classesFile's OWN header nz rides its chip too (the
  // header read this leg already pays for classesSlices doubles as the
  // nz evidence; a mirror copy that reads nz=0 is the disease at rest)
  let classesFileNz: number | null = null;
  if (classesFile) {
    const hdr = readMrcHeader(path.join(workdir, classesFile));
    if (hdr) {
      classesSlices = hdr.nz;
      classesFileNz = hdr.nz;
    }
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
  return {
    remote: false,
    iterations,
    latest,
    classes,
    total,
    classesFile,
    classesSlices,
    // t370 — same badge overlay as the live leg (a round the pipeline
    // ever judged all-flat stays badged after the run finishes), the
    // chosen classesFile's own header nz stamps its chip, and the
    // asset-level note speaks for the gallery's grid source
    stacks: jobId
      ? withZeroDataFlags(
          classesFileNz == null
            ? stacks
            : stacks.map((s) => (s.file === classesFile ? { ...s, nz: classesFileNz } : s)),
          jobId
        )
      : stacks,
    ...(classesFile && jobId && stackZeroData(jobId, classesFile) ? { zeroData: true as const } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* class-average rendering — one pull per stack, PNGs stay, stack goes */
/* ------------------------------------------------------------------ */

/** one pulled stack's rendered product: every slice PNG + the t354 sheet.
 * t358 — `failure` rides along when the pull (or the header parse)
 * refused: the routes surface it VERBATIM, so a field report says which
 * link broke instead of the old one-size "may not exist on the cluster". */
export interface IterationAssets {
  slices: number;
  sheet: Buffer | null;
  failure?: StackPullFailure;
}

/** t358 — the honest verdict of a refused stack pull. Every reason maps to
 * a distinct wire-level world the t357 field report collapsed into one
 * opaque 404 ("could not load the sheet … may not exist"). The message is
 * a human sentence safe for the UI; `reason` is the machine handle the
 * tests and the routes key on. */
export interface StackPullFailure {
  reason:
    | "missing" // the cluster itself says the file is not there
    | "over-cap" // the stack is real but above the transfer cap (size named)
    | "stat-failed" // the cluster would not answer the stat
    | "transfer" // the wire broke mid-pull (channel/timeout)
    | "truncated" // bytes verified SHORT after every chunk retry
    | "unreadable" // complete bytes that are not a readable MRC
    | "writing" // t387 — the writer has not finished this round yet (size < the header's own geometry)
    | "no-connection"; // the run's connection was deleted
  message: string;
  /** the cluster-side size when known (over-cap names it in the message) */
  size?: number;
}

/** the LAST verdict per stack — written on every refusal, cleared on every
 * success. The galleries read it through their payload's renderError so a
 * failed grid explains itself without a second request. */
const stackFailures = new Map<string, StackPullFailure>();

function stackKey(jobId: string, stackName: string): string {
  return `${jobId}/${stackName}`;
}

function recordStackFailure(jobId: string, stackName: string, failure: StackPullFailure): void {
  stackFailures.set(stackKey(jobId, stackName), failure);
}

function clearStackFailure(jobId: string, stackName: string): void {
  stackFailures.delete(stackKey(jobId, stackName));
}

/** t358 — the last refusal recorded for this stack (null when the last
 * attempt succeeded, or nothing was tried yet). The /iterations and
 * /classes payloads surface it as `renderError`. */
export function lastStackFailure(jobId: string, stackName: string): StackPullFailure | null {
  return stackFailures.get(stackKey(jobId, stackName)) ?? null;
}

const stackInFlight = new Map<string, Promise<IterationAssets>>();

function liveStackDir(jobId: string, stackName: string, polarity?: MrcPolarity): string {
  // t380 — a pinned negative-stain polarity renders DIFFERENT bytes from
  // the same stack (no auto-flip), so its PNGs live in a suffixed sibling
  // dir: the default "auto" cache stays byte-compatible with everything
  // already on disk, and toggling the import checkbox can never serve a
  // stale wrong-polarity image.
  const suffix = polarity === "negativeStain" ? ".ns" : "";
  return path.join(PREVIEW_DIR, "live", jobId, stackName.replace(/\.mrcs?$/i, "") + suffix);
}

function stackPngPath(jobId: string, stackName: string, slice: number, polarity?: MrcPolarity): string {
  return path.join(liveStackDir(jobId, stackName, polarity), `slice${String(slice).padStart(4, "0")}.png`);
}

function sheetPngPath(jobId: string, stackName: string, polarity?: MrcPolarity): string {
  return path.join(liveStackDir(jobId, stackName, polarity), "sheet.png");
}

/** t356 — the render verdict marker: written after a stack's slices (+ best-
 * effort sheet) are on disk, whatever the sheet's own fate. The proactive
 * pipeline and the view trigger skip stacks whose marker exists — a resume
 * that never re-pays a wire for a round already rendered (and a
 * sheet-render failure never re-downloads a stack whose slices answer). */
function doneMarkerPath(jobId: string, stackName: string, polarity?: MrcPolarity): string {
  return path.join(liveStackDir(jobId, stackName, polarity), ".done");
}

/** True when this stack's render verdict is already on disk. The t356
 * marker is the canonical witness; a sheet.png from a t354/t355-era cache
 * says the same thing (the sheet is rendered AFTER every slice, so its
 * presence means the whole pass ran) — old caches stay valid. */
export function stackRendered(jobId: string, stackName: string, polarity?: MrcPolarity): boolean {
  try {
    if (statSync(doneMarkerPath(jobId, stackName, polarity)).isFile()) return true;
  } catch {
    /* no marker — maybe a legacy cache */
  }
  try {
    return statSync(sheetPngPath(jobId, stackName, polarity)).isFile();
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* t370 — zero-DATA detection (the "black classes" field report)       */
/* ------------------------------------------------------------------ */

/** the per-stack zero-data verdict marker inside the preview cache */
function zeroDataMarkerPath(jobId: string, stackName: string): string {
  return path.join(liveStackDir(jobId, stackName), ".zerodata");
}

/** True when this round's rendered stack was judged ALL-FLAT (t370). */
export function stackZeroData(jobId: string, stackName: string): boolean {
  try {
    return statSync(zeroDataMarkerPath(jobId, stackName)).isFile();
  } catch {
    return false;
  }
}

/** persist/clear the verdict next to the round's rendered PNGs (best-effort) */
function markStackZeroData(jobId: string, stackName: string, flat: boolean): void {
  try {
    if (flat) {
      mkdirSync(liveStackDir(jobId, stackName), { recursive: true });
      writeFileSync(zeroDataMarkerPath(jobId, stackName), "1");
    } else {
      rmSync(zeroDataMarkerPath(jobId, stackName), { force: true });
    }
  } catch {
    /* best-effort — the render itself is the primary product */
  }
}

/** t382 — the per-stack MEASURED nz marker (the render pass parsed this
 * stack's header when it pulled it; the marker lets a completed job's
 * chips bar keep the t370 zero-header badge on measured evidence).
 * 0 is a legitimate verdict — the corruption shape — so the marker is
 * written for EVERY successfully pulled stack, healthy or not. */
function nzMarkerPath(jobId: string, stackName: string): string {
  return path.join(liveStackDir(jobId, stackName), ".nz");
}

/** the measured nz, or null when this stack was never pulled+rendered */
function stackMeasuredNz(jobId: string, stackName: string): number | null {
  try {
    const n = Number(readFileSync(nzMarkerPath(jobId, stackName), "utf8").trim());
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

/** persist the measured nz next to the round's rendered PNGs (best-effort) */
function markStackNz(jobId: string, stackName: string, nz: number): void {
  try {
    mkdirSync(liveStackDir(jobId, stackName), { recursive: true });
    writeFileSync(nzMarkerPath(jobId, stackName), String(nz));
  } catch {
    /* best-effort — the render itself is the primary product */
  }
}

/**
 * t370 — is this MRC stack's data ONE FLAT VALUE in every sampled slice
 * (dynamic range ~0)? The "black classes" field report: a stack whose
 * header parses and whose size is right, but whose pixels are all
 * identical — the render draws a black grid and the user had no word
 * for it. The scan samples three slices (first, middle, last) and the
 * verdict needs ALL of them flat — a healthy class average is never
 * flat, so the common path costs three slice reads. All-NaN slices
 * count as flat too (they render just as black); NaN mixed with real
 * values keeps the stack out of the verdict — the badge only names
 * shapes it is sure of. Exported for the finalize leg's sync-back scan
 * (remote-run.ts judges the SAME shape on the bytes it pulls home).
 */
export function mrcStackDataIsFlat(p: string): boolean {
  let hdr;
  try {
    hdr = readMrcHeader(p);
  } catch {
    return false;
  }
  if (!hdr || hdr.nz < 1) return false;
  const sliceIsFlat = (z: number): boolean => {
    const s = readMrcSlice(p, z, hdr);
    if (!s || s.length === 0) return false; // unreadable is NOT a verdict
    let min = Infinity;
    let max = -Infinity;
    let finite = 0;
    for (let i = 0; i < s.length; i++) {
      const v = s[i];
      if (Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
        finite++;
      }
    }
    if (finite === 0) return true; // all-NaN renders just as black
    return min === max;
  };
  const probes = hdr.nz === 1 ? [0] : [0, Math.floor(hdr.nz / 2), hdr.nz - 1];
  return probes.every(sliceIsFlat);
}

/** overlay the persisted zero-data verdicts onto a chips-bar list.
 * t382 — the overlay now also carries the MEASURED nz: the render pass
 * parsed this stack's header when it pulled it, and the .nz marker
 * persists that number so a COMPLETED job's chips still badge the
 * zero-header disease (nz=0) from measured evidence instead of
 * "unmeasured". A caller-stamped nz (the live od sniff, the local
 * mirror's own header read) always outranks the marker. */
function withZeroDataFlags(entries: StackEntry[], jobId: string): StackEntry[] {
  let any = false;
  const out = entries.map((s) => {
    let next = s;
    if (next.nz == null) {
      const measured = stackMeasuredNz(jobId, s.file);
      if (measured != null) {
        next = { ...next, nz: measured };
        any = true;
      }
    }
    if (!next.zeroData && stackZeroData(jobId, s.file)) {
      next = { ...next, zeroData: true };
      any = true;
    }
    return next;
  });
  return any ? out : entries;
}

/**
 * Pull ONE class-average stack from the cluster, render EVERY slice to a
 * small PNG plus the t354 SHEET (the whole iteration as one grid image),
 * then delete the stack (the t339 slimming contract: rendered thumbnails
 * persist — KBs each — the MB-scale stack does not). Concurrent requests
 * for the same stack share one pull. Returns the slice count and the sheet
 * buffer; on refusal the result carries a `failure` (the honest reason,
 * VERBATIM to the routes — t358). The sheet is best-effort: a stack whose
 * sheet render fails still answers its slices (the per-class grid keeps
 * working).
 *
 * t358 — the pull rides the CHUNKED, byte-verified transport. The t357
 * whole-file `cat` of a real 25–100 MB class-average stack was exactly the
 * t298 loss shape (the receive side silently drops megabytes with exit=0),
 * and three WHOLE-FILE retries just re-rolled the same losing dice — the
 * field report's every-image-dark. The chunked puller never puts more
 * than 8 MB on the wire at once (the proven-safe envelope the sync-back's
 * key-file traffic has always crossed), verifies every chunk's byte
 * account, and retries a failed CHUNK — a mid-stream drop now costs one
 * chunk's re-transfer, not the file's.
 */
export async function ensureIterationAssets(
  connectionId: string,
  remoteWorkdir: string,
  jobId: string,
  stackName: string,
  /**
   * t367 — the MIRROR SELF-HEAL. When the caller knows the run's local
   * mirror holds a copy of this SAME stack (the image/sheet routes' local
   * legs), passing its path here lets a successful cluster pull REPLACE a
   * corrupt mirror copy in place: the field report's ghost (a zero-header
   * leftover from an earlier run, adopted by a size-only sync-back) made
   * every future render answer "could not render" — the mirror is healed
   * the moment the cluster's fresh bytes arrive, so the Files tab, the
   * galleries and every later viewer read clean data. Only an EXISTING
   * corrupt copy is replaced (never introduces a new local file — the
   * sync policy's local-space intent stands).
   *
   * t380 — `polarity` pins the display polarity for every rendered slice
   * and the sheet (the import job's negative-stain checkbox). The PNG
   * cache keys on it ("auto" default keeps the legacy paths).
   */
  opts?: { healMirrorPath?: string; polarity?: MrcPolarity }
): Promise<IterationAssets> {
  const polarity = opts?.polarity;
  const key = `${connectionId}:${remoteWorkdir}/${stackName}:${polarity ?? "auto"}`;
  const existing = stackInFlight.get(key);
  if (existing) return existing;
  const task = (async (): Promise<IterationAssets> => {
    const conn = getConnection(connectionId);
    if (!conn) {
      const failure: StackPullFailure = {
        reason: "no-connection",
        message: `the cluster connection this run dispatched through was deleted — reconnect it to pull ${stackName}`,
      };
      recordStackFailure(jobId, stackName, failure);
      return { slices: 0, sheet: null, failure };
    }
    const clusterPath = `${remoteWorkdir.replace(/\/+$/, "")}/${stackName}`;
    const dir = liveStackDir(jobId, stackName, polarity);
    mkdirSync(dir, { recursive: true });
    const transient = path.join(dir, ".stack.mrcs");
    try {
      // fast path — a previous render already landed its verdict
      if (stackRendered(jobId, stackName, polarity)) {
        let slices = 0;
        try {
          slices = readdirSync(dir).filter((n) => /^slice\d{4}\.png$/.test(n)).length;
        } catch {
          /* fall through to a fresh pull below */
        }
        if (slices > 0) {
          const sheet = readCachedSheetPng(jobId, stackName, polarity);
          return { slices, sheet };
        }
      }
      // t387 — the run's doneness rides the pull (the gate words its
      // verdict for the world that is true: "still writing" while the run
      // lives, "never finished" once it has ended)
      const hdr = await verifiedStackPull(
        conn,
        clusterPath,
        transient,
        getRun(jobId)?.done ?? false
      );
      if (!hdr.ok) {
        recordStackFailure(jobId, stackName, hdr.failure);
        console.log(
          `iteration-live: ${stackName} pull refused (${hdr.failure.reason}) — ${hdr.failure.message}`
        );
        return { slices: 0, sheet: null, failure: hdr.failure };
      }
      // t370 — ZERO-DATA detection at render time: the pulled bytes are
      // on the local disk RIGHT NOW (the finally-clause deletes them), so
      // this is the one moment the stack's dynamic range can be measured
      // for free. An all-flat stack renders as the "black classes" grid —
      // the badge contract (StackEntry.zeroData) needs the verdict
      // PERSISTED (the .zerodata marker), because the galleries answer
      // later from the PNGs alone. A healthy stack costs three slice
      // reads; the verdict never blocks or fails the render.
      let stackFlat = false;
      try {
        stackFlat = mrcStackDataIsFlat(transient);
      } catch {
        stackFlat = false;
      }
      markStackZeroData(jobId, stackName, stackFlat);
      // t382 — the header nz THIS pull parsed persists as the .nz marker:
      // after the run finishes, the chips bar still carries the measured
      // nz (the zero-header badge survives the live phase). 0 is written
      // exactly when the corruption shape was pulled — the badge speaks.
      markStackNz(jobId, stackName, hdr.nz);
      if (stackFlat) {
        console.log(
          `iteration-live: ${stackName} of job ${jobId} came home with ZERO dynamic range — every sampled slice one flat value; the gallery badges this round (t370)`
        );
      }
      for (let z = 0; z < hdr.nz; z++) {
        const png = await renderMrcSlicePng(transient, z, undefined, polarity);
        if (png) {
          try {
            writeFileSync(stackPngPath(jobId, stackName, z, polarity), png);
          } catch {
            /* best-effort cache write */
          }
        }
      }
      // t354 — the whole-iteration sheet, rendered from the transient
      // stack before the finally-clause deletes it
      let sheet: Buffer | null = null;
      try {
        const rendered = await renderClassSheetPng(transient, undefined, polarity);
        if (rendered) {
          sheet = rendered.png;
          writeFileSync(sheetPngPath(jobId, stackName, polarity), rendered.png);
        }
      } catch {
        /* best-effort: slices answered without the sheet */
      }
      // the render verdict — slices are on disk (or the render honestly
      // failed below); either way this round never re-pays the wire
      try {
        writeFileSync(doneMarkerPath(jobId, stackName, polarity), String(hdr.nz));
      } catch {
        /* best-effort marker */
      }
      // t367 — THE MIRROR SELF-HEAL: the pull succeeded against the cluster,
      // so the transient holds GOOD bytes. If the caller named a mirror copy
      // of this same stack and that copy is corrupt (unparseable header —
      // the ghost shape), overwrite it in place: the next local-first render
      // reads clean data, and the Files tab's exists-only fast path stops
      // serving the ghost to downloads.
      if (opts?.healMirrorPath) {
        try {
          const heal = opts.healMirrorPath;
          if (existsSync(heal) && readMrcHeader(heal) == null) {
            copyFileSync(transient, heal);
            console.log(
              `iteration-live: replaced a corrupt local mirror copy of ${stackName} with the fresh cluster bytes (t367)`
            );
          }
        } catch {
          /* best-effort heal — the render already answers from the transient */
        }
      }
      clearStackFailure(jobId, stackName);
      return { slices: hdr.nz, sheet };
    } catch {
      const failure: StackPullFailure = {
        reason: "transfer",
        message: `the pull of ${stackName} failed unexpectedly (see the server log)`,
      };
      recordStackFailure(jobId, stackName, failure);
      return { slices: 0, sheet: null, failure };
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

/* t387 — bytes per voxel by MRC mode, for the gate's size arithmetic (the
 * gate only has the first 12 bytes of the header on the wire — nx ny nz —
 * plus word 3 (mode) when the cluster speaks the wider sniff; RELION's
 * class stacks are mode 2 float32, the table keeps the other honest
 * modes from lying). */
const MODE_BPP: Record<number, number> = { 0: 1, 1: 2, 2: 4, 6: 2 };

/**
 * t387 — is this round's stack FINISHED? One SSH round: the file's stat
 * size plus its header words read O_DIRECT (the storage's own answer — the
 * login node's page cache is neither consulted nor populated). The verdict:
 *
 *   · words healthy AND size == 1024 + bpp·nx·ny·nz → SETTLED (the writer
 *     finished this round: RELION writes the header first and the data
 *     sequentially, so a size that already equals the header's geometry
 *     means every data byte has landed);
 *   · words healthy AND size < that → STILL WRITING — refused before any
 *     body byte is read (no torn pull, no buffered read of a growing
 *     file, no poison planted in the login node's cache);
 *   · words ZERO (through whatever lane answered) → the mid-flight
 *     header-page race or the t384 cache illusion: the WITNESS ladder
 *     runs right here — a healed view re-evaluates against the gate, an
 *     unhealable/absent direct view is an honest "writing" refusal;
 *   · size larger than the geometry or words unparseable → pull anyway
 *     (an extended header or an exotic mode); the exact post-pull shape
 *     check with the REAL parsed header (nsymbt, bpp) is the referee.
 *
 * A wire failure answers ok (fail-open) — the pull itself re-encounters
 * the file and owns that verdict; the gate only refuses what it can PROVE.
 */
async function stackWriteSettledGate(
  conn: RemoteConnection,
  clusterPath: string,
  /** t387 — is the run that owns this file already FINISHED? A short or
   * zero-header file means different things mid-run ("the writer is still
   * inside this round — retry") and after it ("the writer never finished
   * this round — killed / walltime / crash"). The route layer knows; the
   * gate words the verdict honestly for the world that is actually true. */
  runDone: boolean
): Promise<{ ok: true } | { ok: false; failure: StackPullFailure }> {
  const q = shSingleQuote(clusterPath);
  // the sniff is the SHARED cache-safe dialect (t384): O_DIRECT first, the
  // buffered od only as the fallback where the cluster/filesystem refuses
  // direct reads. Command substitution captures its printed words line.
  const script = [
    "set -u",
    `__s=$(stat -c '%s' ${q} 2>/dev/null || echo MISSING)`,
    `__h=$(${cacheSafeHeaderSniffLine(clusterPath)})`,
    // the mode word rides the SAME two-lane dialect as the words: O_DIRECT
    // first, the buffered od as the fallback — on clusters/filesystems that
    // refuse direct reads (common on NFS) the gate must not go blind on the
    // size-vs-geometry check, which is the anti-poison weapon for torn
    // files. A buffered 16-byte header read is the t384-fallback's own
    // trade, already made by the words sniff on those clusters.
    `__m=$(dd if=${q} iflag=direct bs=4096 count=1 2>/dev/null | od -An -tu4 -j12 -N4 2>/dev/null | tr -s ' \\n' ' ')`,
    `[ -n "$__m" ] || __m="$(od -An -tu4 -j12 -N4 ${q} 2>/dev/null | tr -s ' \\n' ' ')"`,
    `printf 'SIZE=%s\\nWORDS=%s\\nMODE=%s\\n' "$__s" "$__h" "$__m"`,
  ].join("\n");
  let res;
  try {
    res = await exec(conn, script, { timeoutMs: 30_000 });
  } catch {
    return { ok: true }; // the wire failed — the pull re-owns the verdict
  }
  if (res.error || res.code !== 0) return { ok: true };
  const grab = (tag: string): string | null => {
    const m = new RegExp(`^${tag}=(.*)$`, "m").exec(res.stdout ?? "");
    return m ? m[1].trim() : null;
  };
  const sizeRaw = grab("SIZE");
  const words = parseHeaderWords(grab("WORDS") ?? "");
  if (sizeRaw == null || sizeRaw === "MISSING" || !/^\d+$/.test(sizeRaw)) {
    return { ok: true }; // absent/stat-failed — the pull's own verdict names it
  }
  const size = Number(sizeRaw);
  const mode = (() => {
    const t = (grab("MODE") ?? "").split(/\s+/).filter((x) => /^\d+$/.test(x));
    return t.length >= 1 ? Number(t[0]) : NaN;
  })();

  const decide = (w: NonNullable<typeof words>): { ok: true } | { ok: false; failure: StackPullFailure } => {
    const bpp = MODE_BPP[mode];
    if (wordsAreZero(w)) {
      // fall through to the witness below (handled by the caller path)
      return { ok: true };
    }
    if (!wordsAreHealthy(w) || !Number.isFinite(bpp)) return { ok: true };
    const expected = 1024 + bpp * w.nx * w.ny * w.nz;
    if (size < expected) {
      return {
        ok: false,
        failure: {
          reason: runDone ? "truncated" : "writing",
          message: runDone
            ? `${clusterPath} is short of its own geometry (${size} bytes on the cluster, its header promises ${expected}) — the writer never finished this round (killed by a walltime, a scancel, or a crash?). The file is INCOMPLETE on the cluster; no partial read was made`
            : `${clusterPath} is still being written (${size} bytes on the cluster, its header promises ${expected}) — ` +
              "this round's class averages are not finished; the next poll re-asks and renders the completed stack (no partial read was made)",
          size,
        },
      };
    }
    return { ok: true };
  };

  if (words != null) {
    if (wordsAreZero(words)) {
      // the zero shape through the answering lane: the t384 ladder — a
      // poisoned buffered view heals (fadvise drop) and the gate
      // re-evaluates on the witness's OWN direct words; a direct view
      // that is ALSO zero separates by SIZE: short of the geometry the
      // writer is still mid-flight (the header page may not have landed
      // even though the file grows); AT full size it is the zero-header
      // disease (cache illusion that could not heal, or real zero bytes
      // on the storage) — "unreadable", with the ladder's own verdict
      // riding the message. Either way no body byte was read.
      const witness = await witnessMrcHeader(conn, clusterPath);
      if (witness?.illusion && witness.healed && witness.direct) {
        return decide(witness.direct);
      }
      if (witness?.direct && wordsAreHealthy(witness.direct)) {
        return decide(witness.direct);
      }
      return {
        ok: false,
        failure: {
          reason: runDone ? "unreadable" : "writing",
          message:
            `${clusterPath} reads a ZERO header right now (witness ladder: ${witnessSummary(witness)}) — ` +
            (runDone
              ? "the run has finished, and this file's header reads zeros through every lane the login node has (the t369 shape: a cache illusion that could not heal, or real zero bytes on the storage)"
              : "the round is still mid-write and its header page has not settled; the next poll re-asks") +
            ". No partial read was made, and the login node's stale pages (if any) were dropped by the ladder",
          size,
        },
      };
    }
    return decide(words);
  }
  // no parseable words at all AND the file is shorter than a header: the
  // writer has not even laid the header down (a 0–1023 byte round file is
  // the fopen-truncate moment) — "writing", not "may be corrupted".
  if (size < 1024) {
    return {
      ok: false,
      failure: {
        reason: runDone ? "truncated" : "writing",
        message:
          `${clusterPath} is only ${size} bytes on the cluster — ${runDone ? "the writer never laid this round's header down (killed / walltime / crash?); the file is INCOMPLETE" : "this round was just created and its header has not landed yet; the next poll re-asks"} ` +
          "(no partial read was made)",
        size,
      },
    };
  }
  return { ok: true };
}

/** The t358 chunked, verdict-carrying pull: stat → 8 MB verified chunks →
 * header parse. Every refusal is a typed reason with a human message (the
 * routes surface it verbatim); the transient partial is always destroyed —
 * a truncated stack must never render. The retry budget lives PER CHUNK
 * inside remoteChunkedDownload (a failed chunk re-pays itself, not the
 * file), so this layer no longer loops.
 *
 * t387 — THE WRITE-SETTLED GATE runs before any body byte crosses the wire
 * (stackWriteSettledGate below): the field report "2D 分类选了 GPU 加速就
 * 输出损坏的 mrcs，不选就正常" is the timing disease this gate exists
 * for. A GPU classification writes each round's stack in a burst of
 * SECONDS — the live gallery's poll asks for the newest round while the
 * writer is still inside it, and a pull that lands in that window (a) can
 * come home torn and (b) READS the growing file through the login node's
 * buffered `cat`, the exact read that plants stale ZERO pages in its NFS
 * cache (t384's verdict) — pages that one-second mtime granularity may
 * never invalidate, so every later reader there (the finalize sync-back,
 * relion_display, md5sum) serves the poison while the file on the storage
 * is healthy. A CPU run's rounds take MINUTES, the poll lands long after
 * each write closed, the cache only ever sees clean pages — that is the
 * whole GPU-vs-CPU asymmetry the user measured. The gate asks the storage
 * itself (O_DIRECT header sniff) whether the round is complete BEFORE the
 * pull: a stack whose size is still short of its own header's geometry is
 * refused as "writing" — no bytes read, no poison planted, the next poll
 * re-asks and gets the finished round. */
async function verifiedStackPull(
  conn: RemoteConnection,
  clusterPath: string,
  transient: string,
  /** t387 — the run's doneness, for the gate's honest verdict wording
   * ("still writing" mid-run vs "never finished" after it). */
  runDone: boolean
): Promise<{ ok: true; nz: number } | { ok: false; failure: StackPullFailure }> {
  // t387 — the pre-pull gate: stat + O_DIRECT header words, one SSH round.
  const gate = await stackWriteSettledGate(conn, clusterPath, runDone);
  if (!gate.ok) return { ok: false, failure: gate.failure };
  const r = await remoteChunkedDownload(conn, clusterPath, transient, {
    maxBytes: STACK_FETCH_CAP,
  });
  if (!r.ok) {
    const reason: StackPullFailure["reason"] =
      r.reason === "absent" ? "missing" : r.reason;
    return {
      ok: false,
      failure: {
        reason,
        message: r.message,
        ...(r.size != null ? { size: r.size } : {}),
      },
    };
  }
  const hdr = readMrcHeader(transient);
  if (hdr) {
    // t387 — the exact-shape check: the landed byte account must equal the
    // header's OWN geometry (1024 + nsymbt + nx·ny·nz·bpp). The parser's
    // tolerance already refuses a short file, but its message names the
    // wrong world ("may be corrupted") for the mid-write shape — and a file
    // that GREW between the gate and the last chunk (the very race the
    // gate narrows) lands here with bytes that match neither world.
    const expected = mrcExpectedBytes(hdr);
    if (r.bytes !== expected) {
      return {
        ok: false,
        failure: {
          reason: r.bytes < expected ? "truncated" : "unreadable",
          message:
            `${clusterPath} changed under the download (${r.bytes} bytes landed, its own header demands ${expected}) — ` +
            (r.bytes < expected
              ? "the round was still being written while it was pulled; ask again now that the write has settled"
              : "the file carries more bytes than its geometry accounts for; re-run the job if this repeats"),
          ...(r.bytes != null ? { size: r.bytes } : {}),
        },
      };
    }
    return { ok: true, nz: hdr.nz };
  }
  // a COMPLETE download whose header cannot be read is one of two very
  // different worlds: the bytes are garbage (the file is bad on the
  // cluster) OR the transient PATH vanished mid-pull (a re-dispatch wipe
  // or a cache clearing deleted the round dir while the fd still wrote
  // into the unlinked inode — the fd's byte account succeeds, the path
  // is gone). Say which one — "the file may be corrupted" is a lie when
  // the cluster file is fine.
  if (!existsSync(transient)) {
    return {
      ok: false,
      failure: {
        reason: "transfer",
        message: `the local render cache was cleared while ${clusterPath} was downloading — ask again (the cluster file is untouched)`,
      },
    };
  }
  // t361/t369 — classify the unreadable header before wording the verdict.
  // A ZERO header on a completely-downloaded, right-sized file is not one
  // corruption among many. t361's wording led with the pre-t360
  // multi-writer leftover and prescribed a re-dispatch; the t369 field
  // report FOLLOWED that remedy — a fresh job id (brand-new workdir: no
  // leftover can exist there), a single MPI universe (one banner), a
  // single-writer t360+ dispatch, even a single-GPU rerun — and it000 was
  // STILL a right-sized zero-header on the cluster, while the same RELION
  // writing to node-local scratch (/ssd_cache) came out healthy. That
  // falsified the leftover-first ordering: a healthy RELION writer NEVER
  // leaves a zero header (the header lands before the slices), and the run
  // continued PAST this file (later iterations in its log, empty stderr)
  // — RELION wrote and closed it believing success. cryoflow's remote
  // legs are strictly read-only while a run is live (the t369 write-path
  // sweep: stat/tail/cat only), so the bytes were lost on the cluster's
  // own write path — between the compute node's writes and the network
  // storage under the workdir. Name the worlds, the mtime test that
  // separates them, and the 60-second storage test that convicts the
  // culprit without RELION in the loop.
  let zeroHeader = false;
  try {
    const fd = openSync(transient, "r");
    try {
      const head = Buffer.alloc(64);
      const got = readSync(fd, head, 0, 64, 0);
      zeroHeader = got >= 64 && head.every((b) => b === 0);
    } finally {
      closeSync(fd);
    }
  } catch {
    /* unreadable even at the fd level — the generic verdict stands */
  }
  if (zeroHeader) {
    const seedNote = /run_it000_classes\.mrcs?$/i.test(clusterPath)
      ? " NOTE: this file is the SEED round (it000) RELION writes at startup — initial random class averages, of no scientific value even when healthy; the rounds that matter are it001+, so check those before declaring the run lost"
      : "";
    // t384 — THE WITNESS LADDER, before the verdict speaks. A zero header
    // read through the login node is no longer auto-convicted as "the file
    // itself is corrupt": cryoflow's own live monitoring (the t368/t370
    // header sniffs) READ these growing files from the login node while
    // the compute node wrote them, and on NFS that can plant stale ZERO
    // pages in the login node's cache — pages that (mtime's one-second
    // granularity) may never revalidate, so every later reader there
    // serves the poison while the file on the storage is healthy. That is
    // also the manual-run difference: nobody sniffs a manual run's files
    // mid-write. The ladder cross-examines the same node's O_DIRECT view
    // and DROPS its cached pages (fadvise) when the two disagree — the
    // pull is retried once on a healed view before anything is refused.
    const witness = await witnessMrcHeader(conn, clusterPath);
    if (witness?.illusion && witness.healed) {
      // the login node's cached lie is gone — the re-pull reads the
      // storage's truth through the now-clean buffered path
      const r2 = await remoteChunkedDownload(conn, clusterPath, transient, {
        maxBytes: STACK_FETCH_CAP,
      });
      if (r2.ok) {
        const hdr2 = readMrcHeader(transient);
        if (hdr2) {
          console.log(
            `iteration-live: ${clusterPath} — the zero header was the LOGIN NODE's cached page, not the file (direct read healthy, stale pages dropped, re-pulled healthy at nz=${hdr2.nz}) (t384)`
          );
          return { ok: true, nz: hdr2.nz };
        }
      }
    }
    const wLine = witnessSummary(witness);
    return {
      ok: false,
      failure: {
        reason: "unreadable",
        message: `${clusterPath} downloaded completely (${r.bytes} bytes — the size is right) but its MRC header read as ZEROS through the login node. t384 witness ladder on this very file: ${wLine}. Three worlds, and the witness separates the first two: (1) A LOGIN-NODE CACHE ILLUSION — the login node's page cache held stale zero pages (planted by a read of the file while the cluster was still writing it; NFS's one-second mtime granularity can keep them "valid" forever). When the witness's DIRECT read says healthy, the FILE IS FINE on the storage: re-open the results to re-pull${
          witness?.illusion
            ? witness.healed
              ? " (the stale pages were dropped and the re-pull still failed — a transient wire; ask again)"
              : " (the drop could not run — python3 missing on the login node; read the file from a compute node or retry after the cache expires)"
            : " (the app drops them first)"
        }, and read it from a compute node (srun) if you want a second opinion. (2) REAL zero bytes on the storage — RELION writes the header FIRST and this run continued past the file (later iterations in its log, empty stderr), so the bytes were lost between the compute node's writes and the storage; the automatic storage diagnostic witnesses THIS file from a compute node too when it fires (t384), and the manual test remains: from a COMPUTE node, head -c 2097152 /dev/urandom > <this directory>/wtest.bin && md5sum it, then md5sum the same path from the login node — a mismatch (or zeros) convicts the write path; hand that file to the storage admin. (3) A leftover from an EARLIER run — only possible in a REUSED workdir: check the file's mtime on the cluster (ls -l) against when this run started; a fresh job id has a brand-new workdir where no leftover can exist.${seedNote}`,
      },
    };
  }
  return {
    ok: false,
    failure: {
      reason: "unreadable",
      message: `${clusterPath} downloaded completely (${r.bytes} bytes) but is not a readable MRC stack — the file may be corrupted on the cluster`,
    },
  };
}

/** A rendered slice PNG from the cache (null = not rendered yet). */
export function readCachedSlicePng(
  jobId: string,
  stackName: string,
  slice: number,
  polarity?: MrcPolarity
): Buffer | null {
  const f = stackPngPath(jobId, stackName, slice, polarity);
  try {
    const st = statSync(f);
    if (!st.isFile() || st.size === 0) return null;
    return readFileSync(f);
  } catch {
    return null;
  }
}

/** t354 — a rendered iteration sheet from the cache (null = not rendered). */
export function readCachedSheetPng(jobId: string, stackName: string, polarity?: MrcPolarity): Buffer | null {
  const f = sheetPngPath(jobId, stackName, polarity);
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
export function cacheSheetPng(jobId: string, stackName: string, png: Buffer, polarity?: MrcPolarity): void {
  try {
    mkdirSync(liveStackDir(jobId, stackName, polarity), { recursive: true });
    writeFileSync(sheetPngPath(jobId, stackName, polarity), png);
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
    let refused = 0;
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
        if (!assets.failure) {
          spent += s.size;
          rendered += 1;
        } else {
          refused += 1; // the reason is already on the server log (ensureIterationAssets) + the failure map the payloads read
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
    if (refused > 0) {
      console.log(
        `iteration-live: ${refused} stack(s) of job ${args.jobId} were refused by the wire (${args.reason}) — the failure map carries the reasons; the sheet route retries on demand`
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
