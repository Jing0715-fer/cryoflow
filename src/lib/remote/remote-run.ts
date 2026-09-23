/**
 * CryoFlow — remote RELION execution engine (SERVER ONLY).
 *
 * The remote backend: the SAME workflow graph, parameters and argv builder as
 * the local engine (engine.buildArgv is the single source of command truth),
 * executed on an SSH-reachable cluster inside a `module load relion/<ver>`
 * environment. The user's terminal ritual (ssh → module load → run) becomes:
 *
 *   startRemoteJob     resolve inputs → stage them to the cluster (upload,
 *                      STAR-rewrite external paths) → build argv (paths
 *                      translated onto the cluster mirror) → wrapper script
 *                      (module load + setsid + exit-status capture) → the
 *                      cluster pid lands in the run record.
 *   reconcileRemoteJobs  one batched SSH poll per connection per few seconds:
 *                      alive? exit code? log tail → progress; on exit →
 *                      sync-back (download outputs into the LOCAL mirror
 *                      workdir, STAR-rewrite remote paths back — t339: under
 *                      the key-files policy the per-micrograph image
 *                      producers sync METADATA ONLY, their stacks stay on
 *                      the cluster, listed + fetchable on demand) → the
 *                      local collectOutputs/finalize machinery runs
 *                      unchanged → downstream jobs auto-start, on the same
 *                      cluster.
 *   remoteLogTail      live log tail for the log tab (fetched over SSH).
 *   remoteStopRun      kill the cluster-side session (process group).
 *
 * Paths: the local RELION workdir root (data/relion) mirrors onto
 * <remoteRoot>. Files outside it (imported movies on the laptop) stage under
 * <remoteRoot>/_staged/<hash>/ and every STAR reference is rewritten so the
 * cluster sees a consistent tree. The sync-back rewrites them back, so local
 * visualization + downstream LOCAL runs work after completion.
 */

import { createHash } from "crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  statSync,
  writeFileSync,
} from "fs";
import path from "path";
import type { Job, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DATA_DIR, RELION_DIR } from "@/lib/paths";
import {
  buildArgv,
  collectOutputs,
  ctffindInputGate,
  describeExitCode,
  extractInputGate,
  getRun,
  micrographRowsFromContent,
  missingRemoteOutputKeys,
  normalizeClusterHost,
  parseJobParams,
  parseProgressText,
  readRuns,
  REMOTE_OUTPUT_CANDIDATES,
  resolveInputs,
  sameClusterTarget,
  synthesizeTrainingPicks,
  upsertRun,
  updateRun,
  workdirFor,
  type EngineJobRef,
  type RunRecord,
  type UpstreamRef,
  type WaitKind,
} from "@/lib/relion/engine";
import { gpuStrategyFor, slurmHms } from "@/lib/hpc/slurm";
import { nodeUnavailable, parseScontrolNodes, type SlurmNodeUsage } from "@/lib/hpc/slurm-usage";
import { isLogAutopick } from "@/lib/relion/log-autopick";
import { classifyRerunWipe } from "@/lib/hpc/cleanup";
import { describeSyncSkipFile, describeSyncSkips, planSyncBack, type SyncSkip } from "./sync-policy";
// t350 — the cryoSPARC-style per-class star flow (cluster-side split +
// auto-joinstar combine)
import { PER_CLASS_TYPES, splitPerClassStars, combineClassStars } from "./per-class";
import { wipeLocalRunProducts } from "@/lib/relion/run-wipe";
import { describeExtractCollisions, scanExtractCollisions, starIsArraySplittable } from "@/lib/relion/extract-collide";
import {
  PARTICLES_CONSUMER_TYPES,
  particleRefsFromContent,
  particlesRefGate,
  particlesRefGateFromRefs,
  refCandidates,
  type ParticleRefRow,
} from "@/lib/relion/particle-ref-gate";
import { getConnection, loadConnections, patchConnection } from "./connections";
import { writeRemoteManifest, readRemoteManifest } from "./remote-files";
// t367 — the ghost verdicts read MRC headers where the ghosts live: the
// sync-back's "fresh copy" check and the finalize legs parse what they
// are about to trust instead of counting its bytes.
import { readMrcHeader } from "@/lib/mrc";
// t356 — the proactive class-image pipeline: after finalize the run's
// class-average stacks render into the LOCAL preview cache (the user's
// 「下载 mrcs 到本地，再转成图片」 architecture). iteration-live imports
// engine/getRun at function scope only — no cycle at module-eval time.
import { LIVE_ITERATION_TYPES, scheduleRemoteStackRenders } from "./iteration-live";
import {
  deleteRemoteFiles,
  dropRemoteListingCache,
  listRemoteWorkdir,
  pruneRemoteEmptyDirs,
  rewriteManifestAfterCleanup,
} from "./remote-cleanup";
import { probeConnection } from "./probe";
import {
  dropConnection,
  exec,
  loginShellScript,
  remoteDownload,
  remoteMkdir,
  remoteStat,
  remoteUpload,
  shQuote,
  shSingleQuote,
} from "./ssh";
import { remoteHeaderSniffer } from "./sniff";
// t365 — the reference-sampling pre-flight parses probed 1 KB headers with
// the same pure parser the t360 map-import lane uses (cella → Å/px)
import { parseMrcHeaderBytes, type MrcHeader } from "@/lib/mrc";
import type {
  ConnectionRunResume,
  RemoteConnection,
  RemoteConnectionDTO,
  RemoteRunInfo,
  RemoteRunState,
  RemoteRunTarget,
} from "./types";

/* ------------------------------------------------------------------ */
/* Constants + small helpers                                           */
/* ------------------------------------------------------------------ */

/** Engine-native types never run remotely (they are local fs bookkeeping). */
const NATIVE_TYPES = new Set([
  "import", "mapimport", "manualpick", "select", "select2d", "symexpand", "rebalance",
  "cs2star", // t336 — CryoSPARC conversion runs in-process (SSH for the cluster lane)
]);

/** MPI-parallel types (mirrors engine's MPI_PARALLEL_TYPES). */
const MPI_PARALLEL_TYPES = new Set(["class3d", "refine3d"]);

/**
 * t349 — job types whose engine argv names its OWN gpu flag (a flag the
 * dispatch must NOT append `--gpu 0` to). modelangelo drives CUDA through
 * model_angelo's own `-d <gpuId>`; appending relion's `--gpu` onto that
 * argv hands the CLI a flag it does not know, and the run dies at argv
 * parse (the width truth still grants the card: --gres=gpu:1 + t341/t342).
 */
const SELF_GPU_FLAG_TYPES = new Set(["modelangelo"]);

const STAGE_MAP_FILE = path.join(DATA_DIR, "remote-stage-map.json");

export interface RemoteLogPayload {
  text: string;
  totalLines: number;
  truncated: boolean;
  /**
   * t347 — true when this answer carries NO log data of its own (a
   * rate-limited window with nothing cached, the gap before the first
   * heartbeat, or a failed wire with no cache). The UI then KEEPS its
   * previously rendered text and shows a quiet toolbar hint — the old
   * behavior (placeholder/empty text that replaced the console content)
   * made the log visibly blank on every other refresh tick.
   */
  pending?: boolean;
  /** Human note riding a pending answer (toolbar hint — never log content). */
  note?: string;
}

export interface StartRemoteOutcome {
  ok: boolean;
  /** Spawned on the cluster (job is running in the DB). */
  started?: boolean;
  /** Inputs are uploading; the job is pending and flips to running itself. */
  staging?: boolean;
  error?: string;
  waiting?: WaitKind;
  busy?: string;
  busyKind?: "inflight" | "live";
  job?: Job;
  /** True when the error is about the REQUEST (unsupported mode, deleted
   * connection, native type) — the job row must NOT flip to failed. */
  requestError?: boolean;
}

function fail(error: string, requestError = false): StartRemoteOutcome {
  return { ok: false, error, ...(requestError ? { requestError } : {}) };
}

/** True when a job type can execute on a remote cluster (not engine-native). */
export function remoteEligible(type: string): boolean {
  return !NATIVE_TYPES.has(type);
}

/** tail() over a local file — bounded read (never loads the whole file). */
function tailText(file: string, maxChars: number): string {
  try {
    const st = statSync(file);
    const bytes = Math.min(st.size, maxChars * 4); // utf8 headroom
    const fd = openSync(file, "r");
    try {
      const buf = Buffer.alloc(bytes);
      const read = readSync(fd, buf, 0, bytes, Math.max(0, st.size - bytes));
      return buf.toString("utf8", 0, read).slice(-maxChars);
    } finally {
      closeSync(fd);
    }
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Remote $HOME expansion + path mapping                               */
/* ------------------------------------------------------------------ */

const homeCache = new Map<string, string>(); // fingerprint → remote home

async function remoteHome(c: RemoteConnection): Promise<string> {
  const key = `${c.id}:${c.username}@${c.host}:${c.port}`;
  const hit = homeCache.get(key);
  if (hit) return hit;
  const r = await exec(c, loginShellScript("echo $HOME"), { timeoutMs: 10_000 });
  const home = r.stdout.trim().split("\n").pop() ?? "";
  if (r.error || !home.startsWith("/")) {
    throw new Error(`could not resolve the cluster home directory: ${r.error ?? r.stderr.trim().slice(0, 200)}`);
  }
  homeCache.set(key, home);
  return home;
}

export async function expandRemotePath(c: RemoteConnection, p: string): Promise<string> {
  if (p === "~") return remoteHome(c);
  if (p.startsWith("~/")) return (await remoteHome(c)) + p.slice(1);
  return p;
}

/** local (under RELION_DIR) → cluster mirror path. */
function mapLocalToRemote(localPath: string, remoteRoot: string): string {
  const norm = localPath.split(path.sep).join("/");
  if (norm === RELION_DIR.split(path.sep).join("/")) return remoteRoot;
  if (norm.startsWith(RELION_DIR.split(path.sep).join("/") + "/")) {
    return remoteRoot.replace(/\/$/, "") + norm.slice(RELION_DIR.length);
  }
  return norm;
}

/** cluster mirror path → local (under RELION_DIR). */
function mapRemoteToLocal(remotePath: string, remoteRoot: string): string {
  const root = remoteRoot.replace(/\/$/, "");
  if (remotePath === root) return RELION_DIR;
  if (remotePath.startsWith(root + "/")) {
    return path.join(RELION_DIR, remotePath.slice(root.length));
  }
  return remotePath;
}

/* ------------------------------------------------------------------ */
/* t343 — the consumption-lane star reader                              */
/* ------------------------------------------------------------------ */

/** One resolved input STAR's read, in the lane the job will consume it in. */
interface StarRead {
  /** the star's text, or null when the lane's own door failed */
  text: string | null;
  /** which copy the job consumes — the SAME lane the staging derives below */
  lane: "cluster" | "local";
  /** the star's cluster-side address (the twin, else the mirror-mapped upload path) */
  clusterHome: string | null;
  /** the address the read attempted — the receipt names it */
  readAt: string;
  /** the cat/read failure's own word, when text is null */
  err: string | null;
}

/**
 * cat a file on the cluster; on failure, the channel's own honest word.
 *
 * t345 — the read that must not lie about a live file. The field report:
 * the gate's own receipt said "particles star unreadable … timeout after
 * 15000ms" while relion itself parsed the very same bytes on the cluster
 * moments later — the wire was slow, the file was fine. A 15s budget for
 * one exec channel (sshd fork + the login shell's profile + a cat off a
 * loaded network filesystem + the transfer back) starves exactly when
 * the login node is busiest, and a pooled connection that silently died
 * hangs its first exec until the budget burns (keepalive needs 4×15s to
 * notice). So: a 90s budget, and ONE redial retry on SSH-level failures
 * — dropConnection forces the next exec onto a fresh TCP+auth wire. A
 * clean "No such file" is the FILE's own verdict; re-dialing cannot
 * change it, so only timeout/channel/socket words earn the second shot.
 */
async function catRemote(conn: RemoteConnection, p: string): Promise<{ text: string | null; err: string | null }> {
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      dropConnection(conn.id); // fresh wire — the next exec re-dials
      await new Promise((r) => setTimeout(r, 500));
    }
    try {
      const cat = await exec(conn, `cat ${shSingleQuote(p)}`, { timeoutMs: 90_000 });
      if (!cat.error && cat.code === 0) return { text: cat.stdout, err: null };
      // the exec channel is a LOGIN shell: the .bashrc noise prints first,
      // the cat's own word lands last — that last line is the honest reason
      // ("cat: /…: No such file or directory"). Keep its TAIL: the reason
      // rides AFTER the path, and the path is already in the note via
      // readAt — a head slice on a deep cluster path cuts the reason off
      // (the t343 field receipt showed exactly that: "…particles.st", 120
      // chars in, no reason in sight).
      const why = (cat.stderr || "").trim().split("\n").pop() ?? "";
      lastErr = cat.error ?? `exit ${cat.code}${why ? `: ${why.slice(-140)}` : ""}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    const sshLevel = /timeout|channel|socket|ECONN|closed/i.test(lastErr ?? "");
    if (!sshLevel) break; // the file's own verdict — a redial cannot change it
  }
  return { text: null, err: lastErr };
}

/**
 * t346 — the star census that never moves the star: ONE awk pass over the
 * file IN PLACE on the cluster returns one line per UNIQUE stack path with
 * that stack's largest image number (`CF_REF\t<path>\t<max>`) plus the
 * total row count. The pre-t346 gate catted the whole particles.star
 * (tens of MB on a real extraction) over the SSH wire to parse it locally
 * — the exact network transfer the "cluster-native" doctrine forbids, and
 * the 15s-timeout class of dispatch stall. The awk program is POSIX
 * (no gawk extensions); its budget and redial ladder mirror catRemote's
 * (90s, one fresh-wire retry on SSH-level failures only).
 */
async function clusterParticleRefCensus(
  conn: RemoteConnection,
  p: string
): Promise<{ rows: ParticleRefRow[] | null; total: number; err: string | null }> {
  // one row per unique ref path → its max image number. `/^[0-9]+@/` is the
  // same shape particleRefsFromContent parses (`^\d{1,9}@\S+`) minus the
  // bound — header lines (_, #, data_, loop_) never start with digits.
  const awk =
    `awk '` +
    `/^[0-9]+@/ { ` +
    `at = index($0, "@"); ` +
    `img = substr($0, 1, at - 1) + 0; ` +
    `ref = substr($0, at + 1); ` +
    `sub(/[ \\t].*$/, "", ref); ` +
    `if (ref != "") { if (!(ref in mx) || img > mx[ref]) mx[ref] = img; n++ } ` +
    `} ` +
    `END { ` +
    `for (r in mx) printf "CF_REF\\t%s\\t%d\\n", r, mx[r]; ` +
    `printf "CF_TOTAL\\t%d\\n", n ` +
    `}' ${shSingleQuote(p)}`;
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      dropConnection(conn.id); // fresh wire — same ladder as catRemote
      await new Promise((r) => setTimeout(r, 500));
    }
    try {
      const res = await exec(conn, awk, { timeoutMs: 90_000 });
      if (!res.error && res.code === 0) {
        const rows: ParticleRefRow[] = [];
        let total = 0;
        for (const line of res.stdout.split("\n")) {
          if (line.startsWith("CF_REF\t")) {
            const seg = line.split("\t");
            const image = Number(seg[2]);
            const ref = (seg[1] ?? "").trim();
            if (ref && Number.isFinite(image) && image > 0) rows.push({ image, ref });
          } else if (line.startsWith("CF_TOTAL\t")) {
            total = Number(line.split("\t")[1]) || 0;
          }
        }
        return { rows, total, err: null };
      }
      const why = (res.stderr || "").trim().split("\n").pop() ?? "";
      lastErr = res.error ?? `exit ${res.code}${why ? `: ${why.slice(-140)}` : ""}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    const sshLevel = /timeout|channel|socket|ECONN|closed/i.test(lastErr ?? "");
    if (!sshLevel) break; // the file's own verdict (missing, unreadable)
  }
  return { rows: null, total: 0, err: lastErr };
}

/* ------------------------------------------------------------------ */
/* t365 — the reference-sampling pre-flight (class3d/refine3d)         */
/* ------------------------------------------------------------------ */

/**
 * The field report (the user's first 3D classification on the cluster):
 * the job cleared the queue, printed its banners, parsed the star — and
 * died at MlModel::initialiseFromImages with
 *   "The reference pixel size is 0.808 A/px, but the pixel size of the
 *    first optics group of the data is 3.232 A/px!
 *    The reference box size is 256 px, but the box size of the first
 *    optics group of the data is 100 px!"
 * — an imported full-resolution cryoSPARC volume meeting 4×-binned
 * particles. 2D classification never sees this door (no reference, no
 * check), which is why the same star sailed through Class2D before it.
 * RELION's only printed advice (--trust_ref_size) resamples the
 * PARTICLES into the reference's fine grid: 6.5× the voxels, none of the
 * detail recovered — a waste bin the user should never be pushed into.
 *
 * 方案 A, automated (the user's own fix, made the default): BEFORE the
 * argv is built, read the reference's MRC header and the star's FIRST
 * optics group IN PLACE on the cluster — one stat + one 1 KB header +
 * one awk pass, zero map bytes over the wire. On a mismatch, prepare a
 * sampling-matched copy ON the cluster with relion_image_handler
 * (--scale <dataPx/refPx>, then --new_box <dataBox>), verify the
 * product's own header, and point --ref there. The original map is
 * never touched; RELION's own check then passes without any flag. When
 * either side cannot be READ, the pre-flight degrades to a note and
 * RELION's own check decides (the t313 rule: honest note, never a block
 * on a guess) — the hard refusals are only the certain queue-wasting
 * deaths: a reference the job could not read at all, and a preparation
 * whose verification failed.
 */

/** job types whose --ref must match the particles' optics sampling */
const REF_SAMPLING_TYPES = new Set(["class3d", "refine3d"]);

/** the decided plan — made before buildArgv, executed after the wipe */
interface RefPrepPlan {
  /** the reference's cluster address (twin or staged upload) */
  src: string;
  /** the prepared copy, inside THIS job's workdir (re-made each dispatch) */
  out: string;
  /** the particles' first optics group — pixel size (Å/px) */
  dataPx: number;
  /** the particles' first optics group — box size (px) */
  dataBox: number;
  /** the reference's own header numbers, for the receipt */
  refPx: number;
  refBox: number;
  /** null when the pixels already agree (only the box pass runs) */
  scale: number | null;
}

/**
 * One exec: a remote MRC's size + its 1024-byte header (the t360 probe
 * shape). size==null means unreadable (missing/permissions); size>0 with
 * header==null means present-but-unparsable — the two verdicts the caller
 * treats very differently.
 */
async function probeRemoteMrcHeader(
  conn: RemoteConnection,
  p: string
): Promise<{ size: number | null; header: MrcHeader | null; err: string | null }> {
  const script =
    `stat -c '%s' ${shQuote(p)} 2>/dev/null; ` +
    `head -c 1024 ${shQuote(p)} 2>/dev/null | base64 | tr -d '\\n'; echo`;
  try {
    const r = await exec(conn, script, { timeoutMs: 30_000 });
    if (r.error) return { size: null, header: null, err: r.error };
    const lines = (r.stdout ?? "").split(/\r?\n/);
    const n = Number(lines[0]);
    const size = Number.isFinite(n) && n > 0 ? n : null;
    const b64 = (lines[1] ?? "").trim();
    let header: MrcHeader | null = null;
    if (b64.length > 0) {
      try {
        header = parseMrcHeaderBytes(Buffer.from(b64, "base64"), size ?? -1);
      } catch {
        header = null;
      }
    }
    return { size, header, err: null };
  } catch (e) {
    return { size: null, header: null, err: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * One awk pass over the star IN PLACE: the FIRST optics group's
 * _rlnImagePixelSize + _rlnImageSize — the exact two numbers RELION's own
 * check quotes back at the user. POSIX awk; only the verdict row crosses
 * the wire. RELION writes its loop headers as `_rlnLabel #col`, so the
 * column index carries a `#` that must be stripped before it is a number.
 */
async function readOpticsSampling(
  conn: RemoteConnection,
  starPath: string
): Promise<{ px: number | null; box: number | null; err: string | null }> {
  const awk =
    `awk '` +
    `BEGIN { inb = 0; ncol = 0; got = 0 } ` +
    `/^data_optics/ { inb = 1; next } ` +
    `inb && /^data_/ { inb = 0 } ` +
    `inb && /^loop_[ \\t]*$/ { next } ` +
    `inb && $1 ~ /^_rln/ { c = $2; sub(/^#/, "", c); i = c + 0; ` +
    `if (i >= 1 && i <= 99) { lbl[i] = $1; if (i > ncol) ncol = i } next } ` +
    `inb && NF > 0 && $1 !~ /^#/ && $1 !~ /^_/ && got == 0 { ` +
    `for (i = 1; i <= NF && i <= ncol; i++) val[lbl[i]] = $i; got = 1 } ` +
    `END { ` +
    `px = val["_rlnImagePixelSize"] + 0; ` +
    `bx = val["_rlnImageSize"] + 0; ` +
    `if (px > 0) printf "CF_PX\\t%.6f\\n", px; ` +
    `if (bx > 0) printf "CF_BOX\\t%d\\n", bx ` +
    `}' ${shQuote(starPath)} 2>/dev/null`;
  try {
    const r = await exec(conn, awk, { timeoutMs: 90_000 });
    if (r.error) return { px: null, box: null, err: r.error };
    let px: number | null = null;
    let box: number | null = null;
    for (const line of (r.stdout ?? "").split("\n")) {
      if (line.startsWith("CF_PX\t")) {
        const v = Number(line.split("\t")[1]);
        if (Number.isFinite(v) && v > 0) px = v;
      } else if (line.startsWith("CF_BOX\t")) {
        const v = Math.round(Number(line.split("\t")[1]));
        if (Number.isFinite(v) && v > 0) box = v;
      }
    }
    return { px, box, err: null };
  } catch (e) {
    return { px: null, box: null, err: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * t343 — read a resolved input STAR from the lane the job will actually
 * consume it in, and ONLY that lane.
 *
 * The t342 reader brute-forced an order — local copy → cluster twin →
 * mirror-mapped → path as-is — because it trusted no single address. But
 * the address IS deterministic, and this file already knows it: the twin
 * map IS the staging's own lane decision (one map, both consumers — a hit
 * means the staging uploads NOTHING and the argv runs against the cluster
 * twin in place; a miss means the LOCAL file is the exact bytes that will
 * upload, and the staging refuses the dispatch when it is missing).
 * Reading in any other order verifies bytes the job never touches, in
 * both directions:
 *
 *   • twin lane, local-first: a STALE local mirror (the sync-back lagged,
 *     died mid-download, or a cleanup swept the mirror tree) would earn a
 *     false "verified" while relion reads the CLUSTER copy — the exact
 *     lie the gates exist to prevent, told about the wrong generation.
 *   • upload lane, cluster-walk: nothing the cluster holds can change the
 *     staging's own "input does not exist locally" refusal one SSH round
 *     trip later — the walk only delayed the same door.
 *
 * So the local mirror is deliberately NOT a candidate in the twin lane,
 * and the cluster is deliberately NOT a candidate in the upload lane.
 * When a lane's own door fails, the receipt names THAT address and the
 * door's own word (the t313 rule: honest note, never a block).
 */
async function readResolvedStarText(
  conn: RemoteConnection,
  starPath: string,
  twins: Map<string, string>,
  remoteRoot: string,
  opts?: { resolveOnly?: boolean }
): Promise<StarRead> {
  const localNorm = starPath.split(path.sep).join("/");
  const mirrorRoot = RELION_DIR.split(path.sep).join("/");
  const twin = twins.get(localNorm);
  const underMirror = localNorm.startsWith(mirrorRoot + "/");
  // the star's cluster-side home either way: the twin when the input runs
  // in place, else the mirror-mapped path the staging's upload rides (the
  // t338 ref resolver anchors star-relative refs on this dir — and with
  // it, the upload lane can finally judge the mock's star-relative dialect
  // too, not just the twin lane)
  const clusterHome = twin ?? (underMirror ? mapLocalToRemote(starPath, remoteRoot) : null);
  if (twin) {
    // THE TWIN LANE — the cluster copy in place is what this job consumes
    // (the staging skip and the argv's twin preference key off this very
    // map entry; an identity entry IS the cluster path already). The
    // local mirror is never consulted here.
    if (opts?.resolveOnly) {
      // t346 — the census lane: resolve WHICH bytes the job consumes
      // without moving them; the cluster-side awk pass reads them there.
      return { text: null, lane: "cluster", clusterHome, readAt: twin, err: null };
    }
    const cat = await catRemote(conn, twin);
    return { text: cat.text, lane: "cluster", clusterHome, readAt: twin, err: cat.err };
  }
  // THE UPLOAD LANE — no twin on this connection: the LOCAL file is the
  // exact bytes the staging uploads next (it refuses the dispatch when
  // they are missing, so no cluster address can rescue this read).
  try {
    return { text: readFileSync(starPath, "utf8"), lane: "local", clusterHome, readAt: starPath, err: null };
  } catch (e) {
    return {
      text: null,
      lane: "local",
      clusterHome,
      readAt: starPath,
      err: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * The lane-honest unreadable sentence — the note names THE door, not a
 * shrug. t345: a TIMEOUT gets its own advice — "re-run the upstream job"
 * sends the user to regenerate a file that is not missing (the field:
 * relion read it fine on the cluster a moment later; only our SSH wire
 * starved). The timeout word names the wire, not the file.
 */
function starUnreadableNote(what: "micrographs" | "particles", rd: StarRead): string {
  if (rd.lane === "cluster") {
    const timedOut = /timeout/i.test(rd.err ?? "");
    return (
      `${what} star unreadable on the cluster — this job reads it in place at ${rd.readAt} ` +
      `(a cluster-native input uploads nothing) and that read failed${rd.err ? `: ${rd.err}` : ""}` +
      (timedOut
        ? `; the read TIMED OUT — the SSH wire was slow (a busy login node or a stale connection), the file was NOT reported missing, and this job may well read it fine on the cluster; simply run again, or check the login node's load`
        : `; if the file is gone, re-run the upstream job to regenerate it`)
    );
  }
  return (
    `${what} star unreadable — the local copy this dispatch would upload (${rd.readAt}) is missing` +
    `${rd.err ? `: ${rd.err.slice(-140)}` : ""}; run the upstream job again`
  );
}

/** The lane suffix for a SUCCESS receipt — WHICH bytes were judged. */
function starLaneSuffix(rd: StarRead): string {
  return rd.lane === "cluster"
    ? ` (the star was read in place on the cluster at ${rd.readAt} — the copy this job consumes; nothing uploads for it)`
    : ` (the star was read from the local copy this dispatch uploads)`;
}

/* ------------------------------------------------------------------ */
/* Stage map (external local files ↔ cluster _staged paths)            */
/* ------------------------------------------------------------------ */

interface StageEntry {
  local: string;
  remote: string;
  at: number;
}
let stageMap: Record<string, StageEntry> | null = null;

function loadStageMap(): Record<string, StageEntry> {
  if (stageMap) return stageMap;
  try {
    if (existsSync(STAGE_MAP_FILE)) {
      stageMap = JSON.parse(readFileSync(STAGE_MAP_FILE, "utf8"));
    }
  } catch {
    /* corrupt → fresh */
  }
  return (stageMap = stageMap ?? {});
}

function saveStageMap(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STAGE_MAP_FILE, JSON.stringify(loadStageMap(), null, 2));
  } catch {
    /* best-effort persistence */
  }
}

function stageEntryFor(localAbs: string): StageEntry | null {
  const norm = localAbs.split(path.sep).join("/");
  const map = loadStageMap();
  for (const e of Object.values(map)) {
    if (e.local === norm) return e;
  }
  return null;
}

function rememberStage(localAbs: string, remote: string): void {
  const map = loadStageMap();
  const key = createHash("sha1").update(localAbs.split(path.sep).join("/")).digest("hex").slice(0, 16);
  map[key] = { local: localAbs.split(path.sep).join("/"), remote, at: Date.now() };
  // cap the map — prune the oldest quarter beyond 4000 entries
  const keys = Object.keys(map);
  if (keys.length > 4000) {
    const sorted = keys.sort((a, b) => map[a].at - map[b].at);
    for (const k of sorted.slice(0, 1000)) delete map[k];
  }
  saveStageMap();
}

/* ------------------------------------------------------------------ */
/* STAR path rewriting                                                 */
/* ------------------------------------------------------------------ */

/**
 * Rewrite a STAR file's path references between the local and cluster views.
 * - prefix map: RELION_DIR ↔ remoteRoot
 * - exact map:  every staged external file (both directions)
 * Returns the rewritten text (unchanged when nothing matches).
 */
export function rewriteStarPaths(
  content: string,
  dir: "to-remote" | "to-local",
  remoteRoot: string
): string {
  let out = content;
  const localRoot = RELION_DIR.split(path.sep).join("/");
  const root = remoteRoot.replace(/\/$/, "");
  if (dir === "to-remote") {
    if (out.includes(localRoot + "/")) out = out.split(localRoot + "/").join(root + "/");
  } else {
    if (out.includes(root + "/")) out = out.split(root + "/").join(localRoot + "/");
  }
  const map = loadStageMap();
  for (const e of Object.values(map)) {
    if (dir === "to-remote" && out.includes(e.local)) {
      out = out.split(e.local).join(e.remote);
    } else if (dir === "to-local" && out.includes(e.remote)) {
      out = out.split(e.remote).join(e.local);
    }
  }
  return out;
}

/**
 * t316 — CLUSTER-NATIVE refs inside a STAR: absolute paths that do NOT exist
 * locally and are not part of the mirror tree. These are the remote-import
 * leg's zero-upload rows (runImportRemoteLeg writes CLUSTER-ABSOLUTE paths
 * into micrographs.star so no movie byte ever leaves the cluster) — plus,
 * in principle, any cluster file a hand-edited STAR names. RELION's
 * pipeliner law is that STAR rows are PROJECT-RELATIVE (its runners build
 * scratch symlinks as `cwd + star-path` — an absolute row concatenates into
 * `<workdir>//data06/...`, the exact string in the user's filename.cpp:610
 * ticket), so these refs must be RE-LINKED project-relative before the STAR
 * rides to the cluster (see planRelinks).
 */
function remoteNativeRefs(content: string): string[] {
  const out = new Set<string>();
  const IMG = /\.(mrc|mrcs|tif|tiff|eer|star|coord|box|sav)$/i;
  const localRoot = RELION_DIR.split(path.sep).join("/");
  for (const raw of content.split(/\r?\n/)) {
    for (const token of raw.trim().split(/\s+/)) {
      let t = token;
      const at = t.lastIndexOf("@");
      if (at >= 0 && at < t.length - 1) t = t.slice(at + 1);
      t = t.replace(/[,;)\]]+$/, "").replace(/^"|"$/g, "");
      if (t.length < 5 || !t.startsWith("/")) continue;
      if (!IMG.test(t)) continue;
      if (t.startsWith(localRoot + "/")) continue; // a local mirror path — the normal staging legs own it
      if (existsSync(t)) continue; // a LOCAL absolute file — refsInStar already collected it
      out.add(t);
    }
  }
  return [...out];
}

/** The relink pass's sanity ceiling (t316): one STAR may name at most this
 * many cluster-native files (a runaway/garbage STAR refuses honestly
 * instead of shipping a symlink farm to the cluster). */
const RELINK_MAX = 20_000;

/**
 * t316 — decide the project-relative name every cluster-native ref will be
 * re-linked as: `<remoteProjectRoot>/micrographs/<linkName>` → the cluster
 * absolute file. Same-target rows across STARs share ONE link (Map), and
 * basename collisions from different directories get a __cfN suffix (the
 * STAR is rewritten in lockstep, so any unique name is correct — this only
 * keeps the directory greppable). RELION then resolves `micrographs/<n>`
 * against its cwd (= remoteWorkdir, two levels inside the project root —
 * the wrapper/sbatch `cd`), exactly the pipeliner convention the LOCAL
 * engine already speaks (projectDirFor + linkDirInto).
 */
function planRelinks(
  refs: string[],
  taken: Map<string, string>
): { links: Array<{ target: string; linkName: string }>; rewrites: Array<{ from: string; to: string }> } {
  const links: Array<{ target: string; linkName: string }> = [];
  const rewrites: Array<{ from: string; to: string }> = [];
  const usedNames = new Set(taken.values());
  for (const abs of refs) {
    const known = taken.get(abs);
    if (known) continue; // already planned — one link serves every STAR
    let name = path.basename(abs).replace(/[^A-Za-z0-9._-]/g, "_");
    if (name.length > 120) name = name.slice(0, 110) + name.slice(name.lastIndexOf("."));
    if (!/[A-Za-z0-9]/.test(name)) name = "cf_link_" + createHash("sha1").update(abs).digest("hex").slice(0, 12);
    let unique = name;
    for (let n = 2; usedNames.has(unique); n++) unique = `${name.replace(/(\.[^.]+)?$/, (ext) => `__cf${n}${ext}`)}`;
    usedNames.add(unique);
    taken.set(abs, unique);
    links.push({ target: abs, linkName: unique });
    rewrites.push({ from: abs, to: `micrographs/${unique}` });
  }
  return { links, rewrites };
}

/**
 * t316 — apply the relink rewrite table to a (already to-remote-rewritten)
 * STAR body: every cluster-absolute ref string is replaced by its
 * `micrographs/<name>` alias. Byte-substring replacement is safe here for
 * the same reason rewriteStarPaths' is: the ref is a full absolute path
 * delimited by whitespace in the STAR grammar.
 */
function applyRelinks(content: string, rewrites: Array<{ from: string; to: string }>): string {
  let out = content;
  for (const r of rewrites) {
    if (out.includes(r.from)) out = out.split(r.from).join(r.to);
  }
  return out;
}

/**
 * File references inside a STAR — ABSOLUTE paths that exist locally, plus
 * RELATIVE (project-relative, the RELION pipeliner convention: the engine
 * runs with cwd = project root, so "micrographs/mic_1.mrc" lives at
 * <RELION_DIR>/<projectId>/micrographs/mic_1.mrc). Strips the "idx@path"
 * convention of rlnImageName. Relative refs are validated against the
 * project root by the caller (it knows the projectId).
 */
function refsInStar(
  content: string,
  projectRootLocal: string
): Array<{ raw: string; kind: "abs" | "rel"; localAbs: string }> {
  const out = new Map<string, { raw: string; kind: "abs" | "rel"; localAbs: string }>();
  const IMG = /\.(mrc|mrcs|tif|tiff|eer|star|coord|box|sav)$/i;
  for (const raw of content.split(/\r?\n/)) {
    for (const token of raw.trim().split(/\s+/)) {
      let t = token;
      const at = t.lastIndexOf("@");
      if (at >= 0 && at < t.length - 1) t = t.slice(at + 1);
      t = t.replace(/[,;)\]]+$/, "").replace(/^"|"$/g, "");
      if (t.length < 5) continue;
      try {
        if (t.startsWith("/")) {
          if (existsSync(t) && statSync(t).isFile()) out.set(t, { raw: t, kind: "abs", localAbs: t });
        } else if (t.includes("/") && IMG.test(t)) {
          // project-relative — resolve against the project root
          const localAbs = path.join(projectRootLocal, t);
          if (existsSync(localAbs) && statSync(localAbs).isFile()) {
            out.set(localAbs, { raw: t, kind: "rel", localAbs });
          }
        }
      } catch {
        /* unreadable → not a local file */
      }
    }
  }
  return [...out.values()];
}

/* ------------------------------------------------------------------ */
/* Input staging (upload + rewrite)                                    */
/* ------------------------------------------------------------------ */

/** Walk a local directory → relative file list (cap for sanity). */
function walkFiles(dir: string, max = 20_000): string[] {
  const out: string[] = [];
  const queue = [dir];
  while (queue.length > 0 && out.length < max) {
    const d = queue.shift() as string;
    let entries: string[] = [];
    try {
      entries = readdirSync(d);
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e);
      try {
        const st = statSync(p);
        if (st.isDirectory()) queue.push(p);
        else if (st.isFile()) out.push(p);
      } catch {
        /* unreadable */
      }
      if (out.length >= max) break;
    }
  }
  return out;
}

/**
 * Upload one local input (file or directory) to the cluster, skipping files
 * whose remote twin already matches (size) — idempotent re-staging. STAR
 * files travel REWRITTEN (their path references translated to-remote).
 */
async function stageFileTree(
  c: RemoteConnection,
  localAbs: string,
  remoteTarget: string
): Promise<number> {
  let uploaded = 0;
  const st = statSync(localAbs);
  if (st.isFile()) {
    let content: Buffer;
    if (/\.star$/i.test(localAbs)) {
      const rewritten = rewriteStarPaths(readFileSync(localAbs, "utf8"), "to-remote", await expandRemotePath(c, c.remoteRoot));
      content = Buffer.from(rewritten, "utf8");
    } else {
      content = readFileSync(localAbs);
    }
    const existing = await remoteStat(c, remoteTarget);
    if (!existing || existing.size !== content.length) {
      const ok = await remoteUpload(c, content, remoteTarget);
      if (!ok) throw new Error(`upload failed: ${remoteTarget}`);
    }
    return content.length;
  }
  // directory: mirror the tree
  for (const f of walkFiles(localAbs)) {
    const rel = path.relative(localAbs, f).split(path.sep).join("/");
    const target = `${remoteTarget.replace(/\/$/, "")}/${rel}`;
    const fst = statSync(f);
    let content: Buffer;
    if (/\.star$/i.test(f)) {
      const rewritten = rewriteStarPaths(readFileSync(f, "utf8"), "to-remote", await expandRemotePath(c, c.remoteRoot));
      content = Buffer.from(rewritten, "utf8");
    } else {
      content = readFileSync(f);
    }
    const existing = await remoteStat(c, target);
    if (!existing || existing.size !== content.length) {
      const ok = await remoteUpload(c, content, target);
      if (!ok) throw new Error(`upload failed: ${target}`);
      uploaded += content.length;
    }
  }
  return uploaded;
}

/**
 * t316 — create the relink symlinks on the cluster: <projectRoot>/micrographs/
 * gains one `ln -sfn <cluster file> <linkName>` per planned link (idempotent
 * — -fn re-points a stale link from an earlier dispatch). Batched SSH (250
 * links per round trip) so a 1034-micrograph import costs a handful of
 * execs, not a thousand.
 */
async function ensureRemoteRelinks(
  c: RemoteConnection,
  remoteProjectRoot: string,
  links: Array<{ target: string; linkName: string }>
): Promise<void> {
  const linkDir = `${remoteProjectRoot.replace(/\/$/, "")}/micrographs`;
  await remoteMkdir(c, linkDir);
  const BATCH = 250;
  for (let i = 0; i < links.length; i += BATCH) {
    const batch = links.slice(i, i + BATCH);
    const script = batch
      .map((l) => `ln -sfn ${shQuote(l.target)} ${shQuote(`${linkDir}/${l.linkName}`)}`)
      .join(" && ");
    const res = await exec(c, script, { timeoutMs: 120_000 });
    if (res.error || (res.code != null && res.code !== 0)) {
      const why = (res.error || res.stderr || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(-1)[0] ?? `ssh exit ${res.code}`;
      throw new Error(
        `could not re-link the cluster's micrographs into ${linkDir} (${why}) — the data paths in the import STAR must stay reachable on the cluster`
      );
    }
  }
}

/**
 * t316 — upload ONE STAR with the relink rewrite applied: the normal
 * to-remote translation first (mirror prefixes, staged externals), then
 * every cluster-absolute ref becomes its `micrographs/<name>` alias, so the
 * copy that lands on the cluster speaks the pipeliner's project-relative
 * dialect. Size-checked against the remote twin exactly like stageFileTree
 * (idempotent re-staging).
 */
async function stageStarWithRelinks(
  c: RemoteConnection,
  localStar: string,
  remoteTarget: string,
  rewrites: Array<{ from: string; to: string }>
): Promise<number> {
  let content = rewriteStarPaths(readFileSync(localStar, "utf8"), "to-remote", await expandRemotePath(c, c.remoteRoot));
  content = applyRelinks(content, rewrites);
  const buf = Buffer.from(content, "utf8");
  const existing = await remoteStat(c, remoteTarget);
  if (!existing || existing.size !== buf.length) {
    const ok = await remoteUpload(c, buf, remoteTarget);
    if (!ok) throw new Error(`upload failed: ${remoteTarget}`);
  }
  return buf.length;
}

/* ------------------------------------------------------------------ */
/* Wrapper script (module load + detached spawn + exit capture)         */
/* ------------------------------------------------------------------ */

function buildWrapperScript(args: {
  conn: RemoteConnection;
  module: string;
  relionHome: string | null;
  ctffind: string | null;
  command: string;
  remoteProjectRoot: string;
  remoteWorkdir: string;
  /** t313 — the CTF gate's "allowed" receipt, echoed into run.out */
  note?: string | null;
}): string {
  const { conn, module: moduleName, relionHome, ctffind, command, remoteProjectRoot, remoteWorkdir, note } = args;
  const L: string[] = [];
  L.push("#!/usr/bin/env bash");
  L.push("# CryoFlow remote run — generated locally, executed on the cluster");
  L.push("# connection: " + `${conn.username}@${conn.host}:${conn.port} · module ${moduleName || "(none)"}`);
  L.push("set -u");
  L.push("# ---- login-shell environment (module is a shell function) ----");
  L.push("source /etc/profile >/dev/null 2>&1 || true");
  L.push('[ -f "$HOME/.bash_profile" ] && . "$HOME/.bash_profile" >/dev/null 2>&1 || true');
  L.push('[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc" >/dev/null 2>&1 || true');
  L.push("");
  L.push("# ---- connection environment lines ----");
  for (const line of conn.envLines) {
    if (line.trim() && !line.trim().startsWith("#")) L.push(line);
  }
  L.push("");
  L.push("# ---- RELION environment (module load, with a PATH fallback) ----");
  if (moduleName) {
    L.push(`module load ${shQuote(moduleName)} 2>/dev/null || module load ${shQuote(moduleName)}`);
  }
  if (relionHome) {
    L.push(`export RELION_HOME=${shQuote(relionHome)}`);
    L.push(`export PATH="$RELION_HOME/bin:$PATH"`);
  }
  if (ctffind) {
    L.push(`export RELION_CTFFIND_EXECUTABLE=${shQuote(ctffind)}`);
  }
  L.push('command -v relion_refine >/dev/null 2>&1 || { echo "CRYOFLOW_ERR: relion_refine not found on PATH after module load" >&2; exit 127; }');
  // t360 — an MPI-wrapped command runs relion_refine_mpi; a module that
  // probed mpirun but ships no MPI relion must refuse HERE (a clear
  // CRYOFLOW_ERR) instead of burning the allocation on mpirun's obscure
  // "command not found" three layers deep in the rank launcher.
  if (command.includes("relion_refine_mpi")) {
    L.push('command -v relion_refine_mpi >/dev/null 2>&1 || { echo "CRYOFLOW_ERR: relion_refine_mpi not found on PATH after module load — this job runs the MPI build (the module has mpirun; its RELION install carries no relion_refine_mpi)" >&2; exit 127; }');
  }
  L.push("");
  L.push("# ---- run ----");
  L.push(`mkdir -p ${shQuote(remoteProjectRoot)}`);
  L.push(`cd ${shQuote(remoteProjectRoot)} || exit 111`);
  L.push(`mkdir -p ${shQuote(remoteWorkdir)}`);
  L.push(`rm -f ${shQuote(remoteWorkdir + "/.cf-exit")}`);
  // the command runs in its own session (setsid) so killing the session id
  // takes down mpirun AND its ranks; the exit status lands in .cf-exit
  L.push(
    `setsid bash -c ${shSingleQuote(`${command}; __rc=$?; echo $__rc > "${remoteWorkdir}/.cf-exit"`)} ` +
      `> ${shQuote(remoteWorkdir + "/run.out")} 2> ${shQuote(remoteWorkdir + "/run.err")} < /dev/null &`
  );
  // record pid + /proc starttime — the poll verifies BOTH so a RECYCLED pid
  // (long-lived cluster, pid wraparound) can never fake "alive"
  L.push(`__p=$!`);
  L.push(
    `echo "$__p $(awk '{print \$22}' /proc/$__p/stat 2>/dev/null)" > ${shQuote(remoteWorkdir + "/.cf-pid")}`
  );
  L.push('echo "CRYOFLOW_PID:$__p"');
  // t313 — the gate's receipt APPENDS (the setsid redirect above truncated
  // run.out at launch, so an earlier echo would be wiped)
  if (note) L.push(`echo ${shQuote("CRYOFLOW_NOTE: " + note)} >> ${shQuote(remoteWorkdir + "/run.out")}`);
  return L.join("\n") + "\n";
}

/* ------------------------------------------------------------------ */
/* startRemoteJob                                                      */
/* ------------------------------------------------------------------ */

/**
 * t306/t307 — the array split's type contract: a type is array-eligible only
 * when its argv takes ONE per-micrograph input STAR (`--i`) and its output
 * shape lets N disjoint shards merge back into exactly what the engine's
 * collectOutputs expects. Each flavor names the argv flag the shard rewrite
 * targets (`outArg`), the canonical output star the merge rebuilds
 * (`outStar`, "" when there is no single star), and the merge DIALECT:
 *
 *   star   — shards write `<OSHARD>/<outStar>`; the last task home keeps the
 *            first shard's file and appends the others' data rows (t306:
 *            motioncorr/ctffind — one output row per micrograph).
 *   rows   — extract: `--part_dir` stays SHARED (per-micrograph particle
 *            stacks never collide — disjoint mic sets), only `--part_star`
 *            is per-shard. Real RELION writes ImageName paths relative to
 *            the STAR'S OWN DIR, so shard rows say `../extra/<mic>_mrcs`;
 *            the merge concatenates block>=2 rows and strips that leading
 *            `../`, leaving `extra/…` — correct relative to the merged star
 *            at the workdir root. A redirected `--part_dir` breaks the
 *            contract and refuses the split BEFORE staging.
 *   coords — autopick writes one coordinate star PER MICROGRAPH at
 *            `<odir>micrographs/<mic>_autopick.star`; disjoint mics mean
 *            zero collisions even in the canonical dir, so the merge is a
 *            file COLLECTION (`cp shard_k/micrographs/*_autopick.star
 *            <W>/micrographs/`) — no star concatenation at all, and the
 *            downstream extract sees byte-identical shapes either way.
 *
 * Anything else (refine3d's global halves, postprocess's single map) would
 * be split in name only — refused honestly instead.
 */
const ARRAY_FLAVORS: Record<
  string,
  { outArg: string; outStar: string; merge: "star" | "rows" | "coords" }
> = {
  motioncorr: { outArg: "--o", outStar: "corrected_micrographs.star", merge: "star" },
  ctffind: { outArg: "--o", outStar: "micrographs_ctf.star", merge: "star" },
  extract: { outArg: "--part_star", outStar: "particles.star", merge: "rows" },
  autopick: { outArg: "--odir", outStar: "", merge: "coords" },
};

/**
 * t306 — the %M concurrency cap baked into `--array=1-N%M`. A real cluster
 * backfills beyond it as slots free; the run dialog exposes ONE knob (the
 * shard count) and this honest default, not a second stepper to misuse.
 */
const ARRAY_CONCURRENCY = 4;

/**
 * t300 — the hostnames the probe's sinfo inventory resolved for ONE
 * partition (from the connection's lastProbe.slurmGpus[].hosts). null =
 * the partition is unknown to the probe (bare API callers, stale probes)
 * — the submission stays partition-level, never a fabricated node.
 */
function connLastPartitionHosts(connId: string, partition: string): string[] | null {
  const groups = getConnection(connId)?.lastProbe?.slurmGpus ?? null;
  if (!groups) return null;
  const g = groups.find((x) => x.partition === partition);
  return g?.hosts && g.hosts.length > 0 ? g.hosts : null;
}

/**
 * t340 — which probe-inventory group lists this host. A usage-list pin
 * whose scontrol round stayed silent (SSH blip, no scontrol) still deserves
 * its own partition from the LAST probe's sinfo hostlists — the fallback
 * ladder for the pin's partition resolution. null = the probe never saw
 * the host (truly unknown — the submission stays bare --nodelist).
 */
function probePartitionOfHost(connId: string, host: string): string | null {
  const groups = getConnection(connId)?.lastProbe?.slurmGpus ?? null;
  if (!groups) return null;
  const g = groups.find((x) => x.hosts?.includes(host));
  return g?.partition ?? null;
}

/**
 * t311 — the GPUs-per-node the probe's sinfo inventory resolved for ONE
 * partition. null = unknown (no probe / stale probe / bare API caller) —
 * the 8-wide cap stands, never a fabricated limit.
 */
function connPartitionGpus(connId: string, partition: string): number | null {
  const groups = getConnection(connId)?.lastProbe?.slurmGpus ?? null;
  if (!groups) return null;
  const g = groups.find((x) => x.partition === partition);
  return typeof g?.gpusPerNode === "number" && g.gpusPerNode > 0 ? g.gpusPerNode : null;
}

/**
 * t367 — the refinement family that earns an explicit `#SBATCH --time`.
 * These runs are multi-hour by construction (a real 20-round 2D
 * classification is ~2h; 3D refinements run days) and the field report
 * showed what the absence of --time costs: the partition's DEFAULT
 * walltime killed the job at ~2h04 — iteration 20's Expectation and
 * Maximization both done, the write phase (classes stack, data star,
 * optimizer) never started, no error line anywhere in run.out because a
 * kill prints nothing. Short jobs (import, ctffind, extract, autopick…)
 * keep the partition default: an explicit max request would only hurt
 * their backfill priority.
 */
const WALLTIME_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel"]);

/** t367 — cap for the auto --time (the partition's own MaxTime, clamped:
 * a day is the longest run the sane user plans; requesting more on a
 * shared GPU partition hurts queue position without helping the run). */
const WALLTIME_AUTO_CAP_MIN = 1440;

/**
 * t367 — Slurm's time grammar to minutes: [[DD-]HH:]MM[:SS], plus the
 * "infinite"/"unlimited" words sinfo prints for uncapped partitions.
 * Null for anything unparseable (the caller omits --time — a monitoring
 * failure never blocks a dispatch).
 */
export function parseSlurmTimeToMinutes(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (!t || t === "infinite" || t === "unlimited" || t === "none" || t === "no") return null;
  let days = 0;
  let rest = t;
  const dash = rest.indexOf("-");
  if (dash >= 0) {
    days = parseInt(rest.slice(0, dash), 10);
    rest = rest.slice(dash + 1);
  }
  if (!/^\d+(:\d+){0,2}$/.test(rest)) return null;
  const parts = rest.split(":").map((p) => parseInt(p, 10));
  let secs = 0;
  if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) secs = parts[0] * 60 + parts[1];
  else secs = parts[0] * 60; // bare minutes
  const minutes = Math.round((days * 86400 + secs) / 60);
  return minutes > 0 ? minutes : null;
}

/**
 * t367/t369 — the walltime this submission requests (min) plus the
 * partition's DEFAULT time (defaultMin), both in minutes (null = unknown
 * / not applicable, and the partition's own default applies, as before
 * t367).
 *
 *   · the connection's explicit slurmTimeMin wins verbatim (the user's
 *     override — they know their partition);
 *   · else, for the refinement family, ONE sinfo round on the login node
 *     asks '%l %L' — the MaxTime (a ceiling the controller always accepts,
 *     clamped to a day) AND the DEFAULT time in the same SSH round. The
 *     partition's DEFAULT (what applies with no --time at all) is often
 *     far below its MaxTime, and that gap is exactly where multi-hour
 *     refinements die mid-write. t369 — the default comes home with the
 *     probe even when the MaxTime is infinite/unparseable, so the
 *     no-limit banner can NAME the very clock that will kill the job
 *     ("this partition's DEFAULT is 2:00:00") instead of warning about
 *     an unknown;
 *   · else (short jobs, unresolved partition, sinfo unavailable) both
 *     null — a monitoring failure never blocks a dispatch.
 */
async function resolveSbatchTimeLimit(
  conn: RemoteConnection,
  jobType: string,
  partition: string | null
): Promise<{ min: number | null; defaultMin: number | null }> {
  if (conn.slurmTimeMin && conn.slurmTimeMin > 0)
    return { min: Math.min(20160, Math.round(conn.slurmTimeMin)), defaultMin: null };
  if (!WALLTIME_TYPES.has(jobType) || !partition) return { min: null, defaultMin: null };
  try {
    const r = await exec(conn, loginShellScript(`sinfo -h -o '%l %L' -p ${shQuote(partition)}`), {
      timeoutMs: 10_000,
    });
    if (r.error || r.code !== 0) return { min: null, defaultMin: null };
    const first = (r.stdout ?? "").trim().split(/\r?\n/)[0] ?? "";
    // "%l %L" → "<MaxTime> <DefaultTime>" (either column may print the
    // word infinite; a missing DefaultTime column degrades to null)
    const cols = first.trim().split(/\s+/);
    const mins = parseSlurmTimeToMinutes(cols[0] ?? "");
    const defMins = parseSlurmTimeToMinutes(cols.length > 1 ? cols[1] : "");
    return {
      min: mins == null ? null : Math.min(mins, WALLTIME_AUTO_CAP_MIN),
      defaultMin: defMins,
    };
  } catch {
    return { min: null, defaultMin: null }; // a monitoring failure never blocks a dispatch
  }
}

/**
 * t297 — the sbatch variant of the run script, modeled on the user's
 * sbatch6gpu.sh submission idiom (OpenHPC + Slurm + Lmod clusters):
 *
 *   #SBATCH --nodes=1
 *   #SBATCH --ntasks=<gpus+1>      ← t349: 1 CPU master + one worker per GPU
 *   #SBATCH --gres=gpu:<gpus>
 *   … mpirun -n <gpus+1> relion_* … one CUDA_VISIBLE_DEVICES per worker rank
 *
 * t311 — NO --mem line, deliberately. The user's cluster REJECTED the
 * memory spec we used to emit (--mem=16+12×gpus G):
 *
 *   sbatch: error: Memory specification can not be satisfied
 *   sbatch: error: Batch job submission failed: Requested node
 *   configuration is not available
 *
 * A node's schedulable RealMemory is invisible from the login node, so any
 * explicit size is a guess the controller may refuse AT SUBMIT TIME. The
 * user's own working script requests no memory — the node/partition
 * defaults apply — and so do we (a commented example stays for clusters
 * that want one).
 *
 * The GPU count is the WIDTH the user chose in the run dialog (1–8) — the
 * same script shape at any width. The output/error land in the workdir's
 * run.out / run.err (the SAME contract as direct mode), so log tailing,
 * progress parsing and the finalize sweep are unchanged. The exit status
 * lands in .cf-exit via the explicit capture + EXIT trap — the completion
 * truth the poll already speaks (a scancel SIGKILL that beats the trap
 * leaves no file → the honest "interrupted remotely" path).
 */
function buildSbatchScript(args: {
  conn: RemoteConnection;
  module: string;
  relionHome: string | null;
  ctffind: string | null;
  command: string;
  gpus: number;
  ntasks: number;
  threads: number;
  jobName: string;
  remoteProjectRoot: string;
  remoteWorkdir: string;
  /**
   * t300 — the partition this submission pins (the run dialog's detected
   * node group). null = the connection's own default (conn.slurmPartition),
   * undefined = neither (the scheduler decides). Already sanitized by the
   * caller ([A-Za-z0-9_.-], ≤64 chars).
   */
  partition?: string | null;
  /**
   * t300 — the exact NODE this submission pins (--nodelist), when the
   * picked partition resolved to a single hostname in the probe's sinfo
   * inventory ("brain2" as partition AND node). null = partition-level
   * only. Sanitized like partition (a hostname is the same charset).
   */
  nodelist?: string | null;
  /**
   * t304 — the pipeline handoff, scheduler-side: "afterok:<id>[:<id>…]"
   * when an upstream job is still in flight on this same connection. The
   * child becomes the SCHEDULER's problem (PENDING until the parents land)
   * instead of a failed RELION command staring at missing inputs;
   * --kill-on-invalid-dep=yes (emitted alongside) keeps a parent's failure
   * from stranding the child in PENDING forever. null = no live upstream.
   */
  dependency?: string | null;
  /**
   * t306 — the array split: when present the script carries
   * `#SBATCH --array=1-N%M`, each SLURM_ARRAY_TASK_ID slices the input STAR
   * round-robin (data-block rows), runs the command on the shard with --o
   * pointed at a per-task subdir, and the LAST task home (the rc-file count
   * gate — nobody else knows who is last) merges the shard output stars
   * into the canonical one and writes .cf-exit: 0 only when every task's rc
   * was 0. The EXIT trap stands down for array tasks (a single shard's
   * failure must not speak the verdict while its siblings still run) — the
   * TERM/INT trap keeps writing 143 (a scancel kills ALL tasks; the first
   * writer wins, the word is the same). null = single job, byte-identical
   * to the pre-t306 contract.
   */
  array?: {
    total: number;
    concurrency: number;
    inputStar: string;
    outStar: string;
    /**
     * t307 — the merge dialect (see ARRAY_FLAVORS): "star" concatenates the
     * shard output stars (t306); "rows" concatenates only the block>=2 data
     * rows AND strips the leading ../ from the ImageName column (extract's
     * shard stars carry shard-relative stack paths; the shared --part_dir
     * makes ../extra/… the honest shape, the strip makes the merged star
     * resolve from the workdir root); "coords" collects the per-micrograph
     * coordinate stars into the canonical micrographs/ dir (autopick — no
     * star concatenation at all).
     */
    merge: "star" | "rows" | "coords";
  } | null;
  /** t313 — the CTF gate's "allowed" receipt (SBATCH --output captures it) */
  note?: string | null;
  /**
   * t342 — true when the command the script will run actually carries
   * --gpu (the GPU is load-bearing): the starved-card refusal and the
   * rank↔GPU coherence ride only those jobs. A CPU job that merely
   * HOLDS a --gres grant (extract shards, LoG picking) is never refused
   * for a busy card it would not have used.
   */
  gpuJob?: boolean;
  /**
   * t342 — the MPI width the argv asked for (null/1 = no rank pile-up
   * possible). When ≥2 the rank count becomes the script's own
   * CF_RANKS variable and the per-rank card launcher
   * (.cf-rank-launch.sh + CF_DEVICE_SET) takes over the binding —
   * clamped at launch to the GPUs the job can actually see — a 1-GPU
   * world must never run two ranks on its single card.
   */
  mpiRanks?: number | null;
  /**
   * t340 — true when the caller resolved NO partition for an explicit
   * node pin (neither scontrol nor the probe knows the node's home): the
   * script then carries the BARE --nodelist and deliberately names no
   * partition — the cluster's default decides. The connection's own
   * default must NOT ride along (a --partition=normal + --nodelist=brain3
   * combo is REFUSED at submit time on real controllers — the node lives
   * in brain, not normal). Callers that DID resolve the pin's partition
   * pass it as `partition` and leave this false — the pin and the group
   * dropdown then land the same composition.
   */
  suppressPartition?: boolean;
  /**
   * t367 — the walltime this submission requests, in minutes (null = the
   * partition's own default applies). Emitted as a visible #SBATCH --time
   * directive + a CRYOFLOW_WALLTIME receipt banner in run.out — the field
   * report's 2h04 2D classification died at the partition's DEFAULT
   * walltime exactly at iteration 20's write phase, and NOTHING in the
   * job's own output named the cause.
   */
  timeLimitMin?: number | null;
  /**
   * t367 — true when the caller WANTS the no-limit warning banner (a
   * refinement-family job whose partition limit could not be resolved:
   * the run is multi-hour by construction and an unknown default walltime
   * is the field report's exact death). Short jobs pass false/absent —
   * their partition default is fine and the banner would only be noise.
   */
  timeLimitWarn?: boolean;
  /**
   * t369 — the partition's DEFAULT time (sinfo %L), when the probe read it
   * and no explicit/auto limit applies. The no-limit banner NAMES the very
   * clock that will kill the job ("this partition's DEFAULT is 2:00:00")
   * instead of warning about an unknown — the field report's runs kept
   * dying at an unnamed default while the banner stayed generic.
   */
  timeLimitDefaultMin?: number | null;
}): string {
  const { conn, module: moduleName, relionHome, ctffind, command, gpus, ntasks, threads, jobName, remoteProjectRoot, remoteWorkdir, partition, nodelist, dependency, array, note, suppressPartition, gpuJob, mpiRanks, timeLimitMin, timeLimitWarn, timeLimitDefaultMin } = args;
  // t332/t340 — the partition this sbatch names:
  //   · an explicit pin whose partition the caller RESOLVED → that
  //     partition (scontrol's own word — the dropdown equivalence);
  //   · an explicit pin whose partition NOBODY knows (suppressPartition,
  //     or the bare-API shape nodelist-without-partition) → NO partition
  //     line: the cluster's default decides, and the connection's own
  //     default must not ride along (a wrong --partition + --nodelist is a
  //     guaranteed submit-time refusal where a missing one merely lets
  //     the default partition speak);
  //   · everything else → the picked partition, else the connection's
  //     default (the pre-t340 behavior, unchanged).
  const effectivePartition =
    suppressPartition || (nodelist && partition == null)
      ? null
      : (partition ?? conn.slurmPartition ?? null);
  const L: string[] = [];
  L.push("#!/bin/bash");
  L.push("# CryoFlow Slurm submission — generated locally, submitted on the cluster");
  L.push("# connection: " + `${conn.username}@${conn.host}:${conn.port} · module ${moduleName || "(none)"} · ${gpus > 0 ? `${gpus} GPU(s)` : "CPU"}${effectivePartition ? ` · partition ${effectivePartition}` : ""}${nodelist ? ` · node ${nodelist}` : ""}${array ? ` · array 1-${array.total}%${array.concurrency}` : ""}`);
  L.push(`#SBATCH --job-name=${jobName}`);
  if (effectivePartition) L.push(`#SBATCH --partition=${effectivePartition}`);
  if (nodelist) L.push(`#SBATCH --nodelist=${nodelist}`);
  if (dependency) {
    L.push(`#SBATCH --dependency=${dependency}`);
    L.push("#SBATCH --kill-on-invalid-dep=yes");
  }
  // t306 — the array directive: N shards, at most M running at once (the
  // scheduler backfills as slots free). Rides AFTER the dependency so an
  // array child of a live upstream orders the WHOLE fan-out behind it.
  if (array) {
    L.push(`#SBATCH --array=1-${array.total}%${array.concurrency}`);
  }
  L.push("#SBATCH --nodes=1");
  L.push(`#SBATCH --ntasks=${Math.max(1, ntasks)}`);
  L.push(`#SBATCH --cpus-per-task=${Math.max(1, threads)}`);
  if (gpus > 0) L.push(`#SBATCH --gres=gpu:${gpus}`);
  // t367 — the walltime receipt, IN THE SCRIPT (visible in .cf-sbatch.sh
  // and echoed into run.out below): the field report's run died at the
  // partition's DEFAULT walltime with zero explanation in the job's own
  // output. Either we requested a limit (name it — the user can compare it
  // against the run's expected duration), or we deliberately did not (say
  // THAT too: a multi-hour refinement on a default-limited partition is
  // the exact t367 landmine).
  if (timeLimitMin && timeLimitMin > 0) {
    L.push(`#SBATCH --time=${slurmHms(timeLimitMin)}`);
  }
  // t311 — memory left to the cluster's node defaults (see the doc above:
  // an explicit --mem the controller can't satisfy is refused at submit
  // time — "Memory specification can not be satisfied"). Example for
  // clusters that want a pinned size:
  // #SBATCH --mem=64G
  L.push(`#SBATCH --output=${remoteWorkdir}/run.out`);
  L.push(`#SBATCH --error=${remoteWorkdir}/run.err`);
  L.push("");
  L.push("# ---- login-shell environment (module is a shell function) ----");
  L.push("source /etc/profile >/dev/null 2>&1 || true");
  L.push('[ -f "$HOME/.bash_profile" ] && . "$HOME/.bash_profile" >/dev/null 2>&1 || true');
  L.push('[ -f "$HOME/.bashrc" ] && . "$HOME/.bashrc" >/dev/null 2>&1 || true');
  L.push("");
  L.push("# ---- connection environment lines ----");
  for (const line of conn.envLines) {
    if (line.trim() && !line.trim().startsWith("#")) L.push(line);
  }
  L.push("");
  L.push("# ---- RELION environment (module load, with a PATH fallback) ----");
  if (moduleName) {
    L.push(`module load ${shQuote(moduleName)} 2>/dev/null || module load ${shQuote(moduleName)}`);
  }
  if (relionHome) {
    L.push(`export RELION_HOME=${shQuote(relionHome)}`);
    L.push('export PATH="$RELION_HOME/bin:$PATH"');
  }
  if (ctffind) {
    L.push(`export RELION_CTFFIND_EXECUTABLE=${shQuote(ctffind)}`);
  }
  L.push('command -v relion_refine >/dev/null 2>&1 || { echo "CRYOFLOW_ERR: relion_refine not found on PATH after module load" >&2; exit 127; }');
  // t360 — the MPI lane runs relion_refine_mpi (the serial binary under
  // mpirun is N independent runs shredding the same outputs); a module
  // that probed mpirun but ships no MPI relion must refuse HERE, before
  // the allocation burns a second on a guaranteed launcher failure.
  if (command.includes("relion_refine_mpi")) {
    L.push('command -v relion_refine_mpi >/dev/null 2>&1 || { echo "CRYOFLOW_ERR: relion_refine_mpi not found on PATH after module load — this job runs the MPI build (the module has mpirun; its RELION install carries no relion_refine_mpi)" >&2; exit 127; }');
  }
  L.push("");
  // t341 — pin the ranks to the GPUs the scheduler actually GRANTED. On
  // cgroup-isolated clusters slurmd already exports CUDA_VISIBLE_DEVICES
  // (nothing to do); on clusters that grant --gres GPUs WITHOUT device
  // cgroups every card on the node stays visible, and RELION's logical
  // "--gpu 0:1:…" then addresses PHYSICAL devices 0..N-1 — cards the
  // scheduler may have handed to another job (the field report: a 2D
  // classification dead 30s in, CUDA out-of-memory, no error tail — the
  // allocator lost a card someone else's run owned). Slurm ≥ 20.11 with
  // GresAutoDetect exports GPU_DEVICE_ORDINAL naming the granted set;
  // older controllers may set SLURM_JOB_GPUS instead. Only an UNSET
  // CUDA_VISIBLE_DEVICES is patched — never fight the cluster's own
  // isolation — and the pin is a no-op wherever neither variable exists.
  if (gpus > 0) {
    L.push("# ---- t341: pin to the granted GPUs (no-op where cgroups isolate) ----");
    L.push('if [ -z "${CUDA_VISIBLE_DEVICES:-}" ]; then');
    L.push('  if [ -n "${GPU_DEVICE_ORDINAL:-}" ]; then');
    L.push('    export CUDA_VISIBLE_DEVICES="${GPU_DEVICE_ORDINAL}"');
    L.push('  elif [ -n "${SLURM_JOB_GPUS:-}" ]; then');
    L.push('    export CUDA_VISIBLE_DEVICES="${SLURM_JOB_GPUS}"');
    L.push("  fi");
    L.push("fi");
    L.push("");
  }
  // ---- t345 — one rank, one card: pinned per rank, not parsed by RELION --
  // History: t342 clamped the rank count to nvidia-smi's card count and
  // handed RELION its own colon list (--gpu 0:1:…). Two field runs since
  // — mpirun -n 2, then a six-rank class2d — put EVERY rank on device 0
  // anyway: six identical "Will distribute threads over devices 0"
  // banners, the shared card bled 156 → 40 → 37 → 34 MB free and the
  // allocator died in setupTunableSizedObjects (custom_allocator.cuh:436).
  // The node had cards to spare — no clamp fired; RELION's --gpu colon
  // grammar simply did not survive contact with that build. The t345
  // contract stops hoping a parser splits our ranks: the script writes a
  // tiny per-rank launcher (.cf-rank-launch.sh) that hands each MPI rank
  // its OWN CUDA_VISIBLE_DEVICES — one entry of the job's device set, by
  // rank index — and relion runs "--gpu 0" inside a world with exactly
  // one visible card. Piling N ranks onto one card becomes physically
  // impossible: the driver hides the other cards.
  //
  // The device set's truth, in order:
  //   · CUDA_VISIBLE_DEVICES set (cgroup-isolated clusters, or the t341
  //     pin above) → exactly those entries, as granted — never widened;
  //   · else nvidia-smi's own index list, QUIETEST-CARD-FIRST (free
  //     memory descending — a shared node's card 0 is everyone's default
  //     and the starved one; the idle cards earn the ranks);
  //   · nvidia-smi answers nothing and no CVD → the BLIND case: ONE rank
  //     (a pile-up needs ≥2) with a note naming the blindness.
  // The rank count clamps to the visible set — t342's blade, now measured
  // against the CUDA-visible world instead of the node's physical
  // inventory (a cgroup grant of one card runs one rank even on an
  // 8-GPU node: nvidia-smi counts hardware, CUDA_VISIBLE_DEVICES counts
  // what THIS job may touch). The starved-card refusal (t342) stays,
  // checking exactly the cards the launcher will pin.
  if (gpuJob) {
    if (mpiRanks && mpiRanks > 1) {
      // t349 — CF_RANKS counts the MASTER TOO (width + 1): rank 0 is the
      // CPU master, ranks 1..N-1 the workers, one per card. Every clamp
      // and receipt below speaks WORKERS (CF_RANKS - 1), because the
      // master needs no card — only the workers' pile-ups ever OOMed.
      L.push("# ---- t345/t349: 1 CPU master + one worker per card — the device set + the clamp ----");
      L.push(`CF_RANKS=${mpiRanks}`);
      L.push('if [ -n "${CUDA_VISIBLE_DEVICES:-}" ]; then');
      L.push('  CF_DEVICE_SET="$(echo "$CUDA_VISIBLE_DEVICES" | tr -d " ")"');
      L.push("else");
      L.push('  CF_DEVICE_SET="$(nvidia-smi --query-gpu=index,memory.free --format=csv,noheader,nounits 2>/dev/null | sort -s -t, -k2 -nr | cut -d, -f1 | paste -sd, -)"');
      L.push('  if [ -z "$CF_DEVICE_SET" ]; then');
      L.push('    CF_DEVICE_SET="$(nvidia-smi -L 2>/dev/null | grep "^GPU " | awk \'{print $2}\' | tr -d : | paste -sd, -)"');
      L.push("  fi");
      L.push("fi");
      // "none"/empty is CUDA's own word for NO device — count it as such
      L.push('case "$CF_DEVICE_SET" in ""|none|NONE) CF_DEVICE_SET="" ;; esac');
      L.push("CF_VISIBLE=0");
      L.push('[ -n "$CF_DEVICE_SET" ] && CF_VISIBLE=$(echo "$CF_DEVICE_SET" | tr "," "\n" | grep -c .)');
      L.push('if [ "$CF_VISIBLE" -ge 1 ] && [ "$CF_VISIBLE" -lt "$((CF_RANKS - 1))" ]; then');
      L.push('  echo "CRYOFLOW_NOTE: this job asked for $((CF_RANKS - 1)) GPU worker(s) plus 1 CPU master but only $CF_VISIBLE GPU(s) are visible to it${CUDA_VISIBLE_DEVICES:+ (CUDA_VISIBLE_DEVICES=$CUDA_VISIBLE_DEVICES)} — clamping to $CF_VISIBLE worker(s) + the master (two workers on one card exhaust its memory and hang the first Expectation step)"');
      L.push("  CF_RANKS=$((CF_VISIBLE + 1))");
      L.push("fi");
      L.push('if [ "$CF_VISIBLE" -eq 0 ]; then');
      L.push('  echo "CRYOFLOW_NOTE: this job cannot see any GPU from inside the allocation (no CUDA_VISIBLE_DEVICES, and nvidia-smi answered nothing) — running ONE rank instead of $CF_RANKS (1 master + $((CF_RANKS - 1)) workers): a pile-up needs two workers on one card, and that is the exact OOM this guard exists for. Give the compute image nvidia-smi (or a CUDA_VISIBLE_DEVICES grant) to use the full width (t345)"');
      L.push("  CF_RANKS=1");
      L.push("fi");
      // the runtime truth the ranks read (post-clamp rank count + device
      // set), written NEXT TO the launcher — a rank never depends on
      // mpirun's environment forwarding (OpenMPI/MPICH forward by
      // default, but a site wrapper with an env allowlist would silently
      // strip CF_* and every rank would see every card again).
      //
      // t346 — the file now also carries the batch shell's FULL exported
      // environment (`export -p`): PRRTE (OpenMPI 5 — the user's cluster
      // runs prterun) does NOT guarantee environment forwarding to a
      // non-MPI app like this launcher. A stripped rank used to lose
      // PATH/RELION_*/LD_LIBRARY_PATH from `module load`, and `exec
      // relion_refine …` died "command not found" before the first banner
      // — the field shape: log silent, then failed, cards idle. The dump
      // is taken AFTER module load + the t341 pin, and the launcher's own
      // per-rank CUDA_VISIBLE_DEVICES override lands AFTER the source, so
      // last-write-wins is the rank's own card. bash's `export -p` emits
      // `declare -x` lines — valid bash, and the launcher IS bash.
      L.push(`export -p > ${shQuote(remoteWorkdir + "/.cf-rank-env")}`);
      L.push(`{ echo "CF_RANKS_NOW=$CF_RANKS"; echo "CF_DEVICE_SET=$CF_DEVICE_SET"; } >> ${shQuote(remoteWorkdir + "/.cf-rank-env")}`);
      L.push("");
      // the launcher itself — static content, regenerated every dispatch
      // (the t333 wipe sweeps the old copy; a re-run rewrites it)
      L.push(`cat > ${shQuote(remoteWorkdir + "/.cf-rank-launch.sh")} <<'CF_LAUNCH_EOF'`);
      L.push("#!/bin/bash");
      L.push('# t345 — the per-rank card pin. RELION\'s --gpu colon grammar did not');
      L.push("# split ranks in the field (every rank landed on device 0); this");
      L.push("# launcher hands each MPI rank its OWN CUDA_VISIBLE_DEVICES — one");
      L.push("# entry of the job's device set, by rank index — and the relion argv");
      L.push("# runs \"--gpu 0\" inside a world with exactly one visible card.");
      // t346 — ${0%/*} is PURE BASH: under a stripped environment (PRRTE's
      // non-forwarding world, the mpi-strip-env mock) there is no PATH and
      // `dirname` would die before the env dump restores the world. mpirun
      // launches the absolute path from our argv, so $0 always carries its
      // directory.
      L.push('case "$0" in */*) CF_LAUNCH_DIR="${0%/*}" ;; *) CF_LAUNCH_DIR="." ;; esac');
      L.push('if [ -f "$CF_LAUNCH_DIR/.cf-rank-env" ]; then');
      L.push('  . "$CF_LAUNCH_DIR/.cf-rank-env"');
      L.push("fi");
      L.push('R="${OMPI_COMM_WORLD_RANK:-${PMIX_RANK:-${PMI_RANK:-${SLURM_PROCID:-}}}}"');
      L.push('RANKS_NOW="${CF_RANKS_NOW:-1}"');
      L.push('if [ -z "$R" ] && [ "$RANKS_NOW" -ge 2 ]; then');
      L.push('  echo "CRYOFLOW_ERR: the rank launcher could not read its MPI rank index (tried OMPI_COMM_WORLD_RANK, PMIX_RANK, PMI_RANK, SLURM_PROCID) — refusing to guess: every rank guessing 0 is exactly how they pile onto one card (t345)" >&2');
      L.push("  exit 97");
      L.push("fi");
      L.push('if [ "$RANKS_NOW" -ge 2 ] && [ "${R:-0}" -ge 1 ]; then');
      // t349 — worker ranks are 1..N-1 (rank 0 is RELION's CPU master,
      // which never touches a card: data I/O, batch dispatch, the
      // Maximization step). Worker r pins to the (r-1)-th entry of the
      // quietest-first device set — one worker per card, every card
      // earns a worker (the old n = width lane left the master's card
      // idle: a 4-card job computed with 3).
      L.push('  DEV="$(echo "${CF_DEVICE_SET:-}" | tr -d " " | cut -d, -f${R})"');
      L.push('  if [ -z "$DEV" ]; then');
      L.push('    echo "CRYOFLOW_ERR: the device set \"${CF_DEVICE_SET:-}\" names no card for worker rank ${R:-0} — refusing to run unpinned (unpinned ranks pile onto card 0, t345)" >&2');
      L.push("    exit 96");
      L.push("  fi");
      L.push('  export CUDA_VISIBLE_DEVICES="$DEV"');
      L.push('  echo "CRYOFLOW_RANK_BIND: rank ${R:-0} -> CUDA_VISIBLE_DEVICES=$DEV (worker — one worker per card, t349)"');
      L.push('elif [ "$RANKS_NOW" -ge 2 ]; then');
      L.push('  echo "CRYOFLOW_RANK_BIND: rank 0 (RELION master — CPU-only: batch dispatch + class reconstruction) -> no card pin; the workers own the cards (t349)"');
      L.push("else");
      L.push('  echo "CRYOFLOW_RANK_BIND: rank ${R:-0} -> CUDA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES:-<as the node left it>} (single rank, t345)"');
      L.push("fi");
      // t346 — resolve the binary through the RESTORED environment: a
      // rank whose PATH was stripped (PRRTE non-forwarding) still finds
      // relion via the .cf-rank-env dump; an already-absolute $1 passes
      // through command -v verbatim; a genuinely missing binary keeps its
      // original name in the exec's own error (the honest verdict).
      L.push('if [ "$#" -gt 0 ]; then');
      L.push('  __cfbin="$(command -v -- "$1" 2>/dev/null || true)"');
      L.push('  [ -n "$__cfbin" ] && set -- "$__cfbin" "${@:2}"');
      L.push("fi");
      L.push('exec "$@"');
      L.push("CF_LAUNCH_EOF");
      L.push(`chmod +x ${shQuote(remoteWorkdir + "/.cf-rank-launch.sh")}`);
      L.push("");
    } else {
      // ---- t349 — single-rank GPU jobs: the quietest card, and array
      // shards ROTATE. The t345 launcher owns the multi-rank case; the
      // single-rank case used to run `--gpu 0` against whatever the node
      // looked like — physical device 0 on clusters that grant --gres
      // without device cgroups (exactly the field shape: concurrent array
      // shards of one motioncorr all landing on card 0 while five cards
      // idle). Two honest pins, both UNDER an unset-CVD guard so a
      // cgroup-isolated cluster (or the t341 grant pin above, which runs
      // FIRST) is never fought:
      //   · an ARRAY task rotates: CUDA_VISIBLE_DEVICES = task_id % visible
      //     cards — the %M concurrency cap spreads shards across cards
      //     instead of stacking them;
      //   · a lone single-GPU job takes the QUIETEST card (free memory
      //     descending) — device 0 is everyone's default and the starved
      //     one on a shared node.
      // nvidia-smi absent → numbers fail their guards → no pin (t313
      // fail-open: the job runs as the node left it, exactly as before).
      L.push("# ---- t349: single-rank GPU pin — array shards rotate, loners take the quietest card ----");
      L.push('if [ -z "${CUDA_VISIBLE_DEVICES:-}" ]; then');
      L.push('  if [ -n "${SLURM_ARRAY_TASK_ID:-}" ]; then');
      L.push('    CF_NGPU="$(nvidia-smi -L 2>/dev/null | grep -c "^GPU ")"');
      L.push('    case "$CF_NGPU" in ""|*[!0-9]*) CF_NGPU=0 ;; esac');
      L.push('    if [ "$CF_NGPU" -ge 2 ]; then');
      L.push('      export CUDA_VISIBLE_DEVICES="$(( 10#${SLURM_ARRAY_TASK_ID} % CF_NGPU ))"');
      L.push('      echo "CRYOFLOW_NOTE: array task ${SLURM_ARRAY_TASK_ID} pinned to GPU $CUDA_VISIBLE_DEVICES of $CF_NGPU visible — rotating concurrent shards across cards so they do not pile onto device 0 (t349)"');
      L.push("    fi");
      L.push("  else");
      L.push('    CF_QUIET="$(nvidia-smi --query-gpu=index,memory.free --format=csv,noheader,nounits 2>/dev/null | sort -s -t, -k2 -nr | head -1 | cut -d, -f1 | tr -d " ")"');
      L.push('    case "$CF_QUIET" in');
      L.push('      ""|*[!0-9]*)');
      L.push("        ;;");
      L.push("      *)");
      L.push('        export CUDA_VISIBLE_DEVICES="$CF_QUIET"');
      L.push('        echo "CRYOFLOW_NOTE: single-GPU job with no CUDA_VISIBLE_DEVICES grant — pinned to GPU $CF_QUIET, the quietest card by free memory (device 0 is everyone\'s default and the first to starve, t349)"');
      L.push("        ;;");
      L.push("    esac");
      L.push("  fi");
      L.push("fi");
      L.push("");
    }
    L.push("# ---- t342/t345: the starved-card refusal (fail in one second, not an hour) ----");
    L.push("if command -v nvidia-smi >/dev/null 2>&1; then");
    // t349 — the cards that matter are the WORKERS' (the first
    // CF_RANKS-1 entries of the device set; the master is unpinned).
    // A single-rank job keeps checking its one card.
    L.push('  CF_WORKERS=$(( ${CF_RANKS:-1} - 1 )); [ "$CF_WORKERS" -lt 1 ] && CF_WORKERS=1');
    L.push('  CF_CHECK_IDS=""');
    L.push('  if [ -n "${CF_DEVICE_SET:-}" ]; then');
    L.push('    CF_CHECK_IDS="$(echo "$CF_DEVICE_SET" | cut -d, -f1-$CF_WORKERS)"');
    L.push('  elif [ -n "${CUDA_VISIBLE_DEVICES:-}" ]; then');
    L.push('    CF_CHECK_IDS="$(echo "$CUDA_VISIBLE_DEVICES" | tr -d " " | cut -d, -f1-$CF_WORKERS)"');
    L.push("  else");
    L.push('    CF_CHECK_IDS="$(seq -s, 0 $(( CF_WORKERS - 1 )) )"');
    L.push("  fi");
    L.push('  CF_FREE_MB="$(nvidia-smi --id="$CF_CHECK_IDS" --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | sort -n | head -1 | tr -d " ")"');
    L.push('  case "$CF_FREE_MB" in');
    L.push('    ""|*[!0-9]*)');
    L.push("      ;;");
    L.push("    *)");
    L.push('      if [ "$CF_FREE_MB" -lt 1000 ]; then');
    L.push('        echo "CRYOFLOW_ERR: only ${CF_FREE_MB} MB free on the GPU(s) this job would use (${CF_CHECK_IDS}) — another process is holding the card(s):"');
    L.push('        nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv 2>/dev/null || true');
    L.push('        echo "CRYOFLOW_ERR: refusing to launch — RELION would print \\"WARNING: Ignoring required free GPU memory\\" and stall at its first Expectation step. Kill or scancel the holder PIDs above (squeue -u $USER finds Slurm-owned ones), or pick a quieter partition, then re-run (t342)"');
    L.push(`        mkdir -p ${shQuote(remoteWorkdir)} 2>/dev/null || true`);
    L.push(`        echo 98 > ${shQuote(remoteWorkdir + "/.cf-exit")}`);
    L.push("        exit 98");
    L.push('      elif [ "$CF_FREE_MB" -lt 2000 ]; then');
    L.push('        echo "CRYOFLOW_NOTE: only ${CF_FREE_MB} MB free on the GPU(s) this job will use (${CF_CHECK_IDS}) — the card is shared; RELION may run slow (the dispatch refuses below 1000 MB)"');
    L.push("      fi");
    L.push("      ;;");
    L.push("  esac");
    L.push("fi");
    L.push("");
    // t348 — the multi-rank log, explained AT the confusion. The field
    // report: a healthy 6-rank 2D classification's run.out read as 「几个
    // GPU 重复执行了同一个任务」 — six copies of every banner interleaved
    // into one file. That is the MPI shape, not duplication: N independent
    // processes each print their OWN copy of every RELION banner/report
    // (noise spectra, accuracy estimates, "Expectation iteration 1 of 20"),
    // while the WORK is split — the Expectation step divides the particles
    // across ranks, the Maximization step divides the classes. The per-rank
    // "mapped to device 0" is equally normal since t345: each rank's
    // private CUDA_VISIBLE_DEVICES world holds exactly one card, so 0 IS
    // its own card (the RANK_BIND receipts above name the physical truth).
    // One echo, printed only when ≥2 ranks are really starting (after the
    // starved-card gate, with the post-clamp count) — every future run
    // self-documents instead of earning a ticket.
    if (mpiRanks && mpiRanks > 1) {
      L.push('if [ "${CF_RANKS:-1}" -ge 2 ]; then');
      L.push(
        `  echo "CRYOFLOW_NOTE: starting $CF_RANKS MPI ranks — 1 CPU master (data I/O, particle-batch dispatch, class reconstruction) plus $((CF_RANKS - 1)) workers, ONE WORKER PER CARD (RELION's own np = nGPU + 1 layout, t349). Every rank prints its OWN copy of the RELION banners and reports into this log; the work is SPLIT across the workers (particles in the Expectation step, classes in the Maximization step), NOT repeated. Each worker's 'device 0' is that worker's own card inside its private CUDA_VISIBLE_DEVICES world — the CRYOFLOW_RANK_BIND receipts name the physical cards (t348)"`
      );
      L.push("fi");
      L.push("");
    }
  }
  L.push("# ---- run ----");
  // t313 — the CTF gate's receipt lands at the TOP of run.out (SBATCH
  // --output captures the whole script's stdout)
  if (note) L.push(`echo ${shQuote("CRYOFLOW_NOTE: " + note)}`);
  // t367 — the walltime receipt, the same way: run.out's first lines tell
  // the user what the clock allows BEFORE two hours of silence end in a
  // kill. The absent-limit wording names the risk explicitly — a
  // multi-hour refinement under an unknown default is the field report's
  // exact death.
  if (timeLimitMin && timeLimitMin > 0) {
    L.push(
      `echo ${shQuote(
        `CRYOFLOW_WALLTIME: this submission requested --time=${slurmHms(timeLimitMin)} (t367) — the scheduler kills the job when it expires; compare it against the run's expected duration before worrying about a stall`
      )}`
    );
  } else if (timeLimitWarn) {
    // t369 — name the actual default when the probe read it: an unnamed
    // clock the user cannot see is the t367 landmine all over again.
    L.push(
      `echo ${shQuote(
        timeLimitDefaultMin && timeLimitDefaultMin > 0
          ? `CRYOFLOW_WALLTIME: this submission requested NO explicit time limit — this partition's DEFAULT is ${slurmHms(timeLimitDefaultMin)} (sinfo), and the scheduler kills the job the moment it expires. A multi-hour run needs a longer limit: set one in the connection's Slurm settings (t367)`
          : "CRYOFLOW_WALLTIME: this submission requested NO explicit time limit — the partition's DEFAULT walltime applies. If this run is multi-hour, a short default can kill it before its final outputs are written (set a time limit in the connection's Slurm settings, t367)"
      )}`
    );
  }
  L.push(`mkdir -p ${shQuote(remoteProjectRoot)}`);
  // t316 — the RELION process runs from the PROJECT ROOT, exactly like the
  // direct-mode wrapper above and the LOCAL engine (projectDirFor). The old
  // `cd remoteWorkdir` made cwd == the --o directory, and RELION's runners
  // build their scratch symlinks as `cwd + star-row` → `fn_out + star-row`
  // — with cwd == fn_out both concatenations are the SAME string, a
  // self-referencing symlink (the user's ticket: "Failed to make a symlink
  // from X to X", filename.cpp:610, from == to verbatim). From the project
  // root the two sides diverge (cwd row resolves through
  // <projectRoot>/micrographs re-links; fn_out row lands in the workdir's
  // mirror tree) — the pipeliner dialect, everywhere.
  L.push(`cd ${shQuote(remoteProjectRoot)} || exit 111`);
  L.push(`rm -f ${shQuote(remoteWorkdir + "/.cf-exit")}`);
  // Exit-status contract (the poll's completion truth):
  //   - natural completion: the explicit capture below writes the TRUE
  //     status (0 included) — the last word;
  //   - scancel's SIGTERM: the TERM/INT trap writes 143 (cancelled), and
  //     the EXIT trap only speaks when rc != 0 — a TERM'ed bash otherwise
  //     runs its EXIT trap with a stale $? == 0, which would forge a
  //     success line for a job the user just killed (observed on GNU bash:
  //     `bash -c 'trap "echo $?" EXIT; sleep N'` + kill → writes 0);
  //   - SIGKILL / node loss: nothing is written → VANISHED → the honest
  //     "interrupted remotely" path.
  //   t306 — array tasks: the EXIT trap STANDS DOWN (one shard's failure
  //     must not speak the verdict while its siblings still run — the
  //     count gate below owns the word); the TERM/INT trap keeps writing
  //     143 (a scancel hits ALL tasks; first writer wins, same word).
  L.push(`trap 'echo 143 > ${shQuote(remoteWorkdir + "/.cf-exit")} 2>/dev/null; exit 143' TERM INT`);
  L.push(
    `trap '__rc=$?; [ "$__rc" -eq 0 ] || [ -n "${"${"}SLURM_ARRAY_TASK_ID:-}" ] || echo "$__rc" > ${shQuote(remoteWorkdir + "/.cf-exit")} 2>/dev/null' EXIT`
  );
  L.push(`set +e`);
  // t306 — the array branch: each task slices its shard out of the input
  // star (round-robin over the data-block rows — the optics block and the
  // comments pass through untouched), runs the command with $SHARD as the
  // input and $OSHARD as its own output subdir, appends its rc, and the
  // LAST task home (the rc-file count gate) merges the shard output stars
  // into the canonical one before writing .cf-exit. The RCF's name carries
  // SLURM_ARRAY_JOB_ID so a re-run never reads a previous submission's
  // tally, and the merge is tolerated-missing (a failed shard's star is
  // simply absent — the verdict says FAILED anyway).
  if (array) {
    const N = array.total;
    const W = remoteWorkdir;
    L.push(`if [ -n "${"${"}SLURM_ARRAY_TASK_ID:-}" ]; then`);
    L.push(`  SHARD="${W}/.cf-shard-$SLURM_ARRAY_TASK_ID.star"`);
    L.push(`  RCF="${W}/.cf-array-rc-$SLURM_ARRAY_JOB_ID"`);
    L.push(`  OSHARD="${W}/shard_$SLURM_ARRAY_TASK_ID"`);
    L.push(`  mkdir -p "$OSHARD" || exit 111`);
    L.push(`  awk -v s="$SLURM_ARRAY_TASK_ID" -v n=${N} '`);
    L.push(`    /^data_/{block++; print; next}`);
    L.push(`    /^loop_/{print; next}`);
    L.push(`    /^_/{print; next}`);
    L.push(`    block>=2 && NF>0 && $1 !~ /^#/{ if(idx % n == s-1) print; idx++; next }`);
    L.push(`    { if(block<2) print }`);
    // t334 — the slice failure is no longer a silent whole-STAR copy: the
    // old `|| cp` fallback handed EVERY row to EVERY shard whenever the awk
    // could not read its input, and N shards then wrote the same per-mic
    // outputs into the shared tree at the same moment — the concurrent-
    // writer collision behind image.h:1534. An unreadable star is a task
    // failure that SPEAKS: the rc lands in the tally file (the count gate
    // turns it into .cf-exit=111) and the reason lands in run.err.
    L.push(
      `  ' ${shQuote(array.inputStar)} > "$SHARD" 2>/dev/null || { echo "CRYOFLOW_ERR: could not slice the input STAR for shard $SLURM_ARRAY_TASK_ID — ${shQuote(array.inputStar)} unreadable on this node" >&2; echo "$SLURM_ARRAY_TASK_ID 111" >> "$RCF"; exit 111; }`
    );
    L.push(`  ${command}`);
    L.push(`  __rc=$?`);
    L.push(`  echo "$SLURM_ARRAY_TASK_ID $__rc" >> "$RCF"`);
    L.push(`  __done="$(wc -l < "$RCF" 2>/dev/null || true)"`);
    L.push(`  if [ "${"${__done:-0}"}" -ge ${N} ]; then`);
    // t307 — the count gate can fire in MORE THAN ONE task: two shards can
    // append their rc and read the tally within the same breath, and two
    // concurrent merges interleave their cp/append/mv until the canonical
    // star lands TORN (observed live: a headerless 4-row fragment). Serialize
    // the merge with flock — auto-released if a merger dies — and the loser
    // finds .cf-exit already spoken and stands down. A login node without
    // flock degrades to the old race (honest best effort, not a deadlock).
    L.push(`    __locked=0`);
    L.push(`    if command -v flock >/dev/null 2>&1; then`);
    L.push(`      exec 9>>${shQuote(W + "/.cf-merge.lock")}`);
    L.push(`      flock 9`);
    L.push(`      __locked=1`);
    L.push(`    fi`);
    L.push(`    if [ "$__locked" = "0" ] || [ -z "$(cat ${shQuote(W + "/.cf-exit")} 2>/dev/null)" ]; then`);
    if (array.merge === "coords") {
      // t307 — autopick's canonical output is the micrographs/ COORD DIR,
      // not a star: every shard's per-micrograph coordinate stars move home
      // (names are per-micrograph, shards are disjoint, so nothing can
      // overwrite anything). collectOutputs globs exactly these.
      L.push(`    mkdir -p ${shQuote(W + "/micrographs")}`);
      L.push(`    for __k in $(seq 1 ${N}); do`);
      L.push(`      [ -d "${W}/shard_$__k/micrographs" ] && cp "${W}/shard_$__k"/micrographs/*_autopick.star "${W}/micrographs/" 2>/dev/null || true`);
      L.push(`    done`);
    } else {
      // star (t306) / rows (t307): concatenate the shard stars into the
      // canonical one. rows differs twice — the FIRST donor contributes its
      // structure plus its own rewritten rows (its rows carry ../ paths
      // too), and every appended donor contributes ONLY block>=2 rows (the
      // optics block must never duplicate). The rewrite itself: ImageName =
      // <idx>@<path>; when <path> starts with ../, drop it (the shared
      // --part_dir put every stack in the canonical extra/ tree, so
      // extra/… is the honest path relative to the merged star's dir).
      // FS=OFS=tab: touching $1 makes awk rebuild $0 — without it the
      // STAR's tab-separated columns would come back space-separated.
      const rowsRewrite = `i=index($1,"@"); if(i>0 && substr($1,i+1,3)=="../") $1=substr($1,1,i) substr($1,i+4)`;
      if (array.merge === "rows") {
        L.push(`    __merged="${W}/${array.outStar}"`);
        L.push(`    __have=0`);
        L.push(`    for __k in $(seq 1 ${N}); do`);
        L.push(`      __f="${W}/shard_$__k/${array.outStar}"`);
        L.push(`      [ -f "$__f" ] || continue`);
        L.push(`      if [ "$__have" = "0" ]; then`);
        L.push(`        awk 'BEGIN{FS=OFS="\\t"}`);
        L.push(`          /^data_/{block++; print; next}`);
        L.push(`          /^loop_/{print; next}`);
        L.push(`          /^_/{print; next}`);
        L.push(`          /^#/{print; next}`);
        L.push(`          block>=2 && NF>0{ ${rowsRewrite}; print; next }`);
        L.push(`          {print}' "$__f" > "$__merged.cf-merge"`);
        L.push(`        __have=1`);
        L.push(`      else`);
        L.push(`        awk 'BEGIN{FS=OFS="\\t"}`);
        L.push(`          /^data_/{block++; next}`);
        L.push(`          /^loop_/{next}`);
        L.push(`          /^_/{next}`);
        L.push(`          /^#/{next}`);
        L.push(`          block>=2 && NF>0{ ${rowsRewrite}; print; next }`);
        L.push(`          {next}' "$__f" >> "$__merged.cf-merge" 2>/dev/null || true`);
        L.push(`      fi`);
        L.push(`    done`);
        L.push(`    [ "$__have" = "1" ] && mv "$__merged.cf-merge" "$__merged"`);
      } else {
        L.push(`    __merged="${W}/${array.outStar}"`);
        L.push(`    __have=0`);
        L.push(`    for __k in $(seq 1 ${N}); do`);
        L.push(`      __f="${W}/shard_$__k/${array.outStar}"`);
        L.push(`      [ -f "$__f" ] || continue`);
        L.push(`      if [ "$__have" = "0" ]; then`);
        L.push(`        cp "$__f" "$__merged.cf-merge"`);
        L.push(`        __have=1`);
        L.push(`      else`);
        L.push(`        awk '!/^data_/ && !/^loop_/ && !/^_/ && !/^#/ && NF>0' "$__f" >> "$__merged.cf-merge" 2>/dev/null || true`);
        L.push(`      fi`);
        L.push(`    done`);
        L.push(`    [ "$__have" = "1" ] && mv "$__merged.cf-merge" "$__merged"`);
      }
    }
    L.push(`      __bad="$(awk '$2!=0{print $2; exit}' "$RCF" 2>/dev/null || true)"`);
    L.push(`      echo "${"${__bad:-0}"}" > ${shQuote(W + "/.cf-exit")}`);
    L.push(`    fi`);
    L.push(`    rm -f "$RCF" "${W}"/.cf-shard-*.star "${W}/.cf-merge.lock"`);
    L.push(`    [ "$__locked" = "1" ] && exec 9>&-`);
    L.push(`  fi`);
    L.push(`  exit "$__rc"`);
    L.push(`fi`);
  }
  L.push(command);
  L.push(`__rc=$?`);
  L.push(`echo "$__rc" > ${shQuote(remoteWorkdir + "/.cf-exit")}`);
  L.push(`exit $__rc`);
  return L.join("\n") + "\n";
}

/** A staging heartbeat older than this means the upload task is gone. */
const STAGING_BEAT_STALE_MS = 120_000;

/**
 * Staging beat interval. 10s suits a real cluster (staging minutes, stale
 * window 2min); a fast LOCAL rig stages in under one interval, so the beat
 * would never land (t268's first run) — deployments and test rigs tune it
 * with CF_STAGING_BEAT_MS without touching the ledger's stale math (any
 * interval well under STAGING_BEAT_STALE_MS is safe).
 */
const STAGING_BEAT_MS = Math.max(500, Number(process.env.CF_STAGING_BEAT_MS) || 10_000);

/**
 * Staging heartbeat — the background staging task has no supervisor (it is
 * void-spawned), so it touches the ledger every STAGING_BEAT_MS while alive.
 * The poll sweep reads the beat to distinguish "still uploading" from "the
 * task vanished without a trace" (a hung SSH exec used to strand the row in
 * pending until the 30min fallback). Returns a stop() that is idempotent.
 */
function startStagingBeat(jobId: string): () => void {
  const beat = setInterval(() => {
    updateRun(jobId, (rec) =>
      rec.remote && rec.remote.phase === "staging" && !rec.done
        ? { ...rec, remote: { ...rec.remote, stagingBeat: Date.now() } }
        : null
    );
  }, STAGING_BEAT_MS);
  beat.unref?.();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(beat);
  };
}

/**
 * A row flip that survives SQLITE_BUSY. The finalize write races every
 * other engine write (the poll sweep, the transition sweep, a UI patch) —
 * losing the race used to strand the row non-terminal FOREVER with the
 * record already done (no self-heal path). Retry with backoff; if all
 * attempts fail, the orphan sweep in reconcileRemoteJobs heals the row
 * from the record truth on a later tick.
 */
async function updateJobWithRetry(
  id: string,
  data: Prisma.JobUpdateInput,
  attempts = 3
): Promise<Job | null> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await db.job.update({ where: { id }, data });
    } catch (e) {
      if (i === attempts) {
        console.error(
          `remote-run: row flip failed ${attempts}x for ${id} — the orphan sweep will heal it:`,
          e instanceof Error ? e.message : e
        );
        return null;
      }
      await new Promise((r) => setTimeout(r, 200 * i));
    }
  }
  return null;
}

/**
 * t324 — how long a cluster-side output probe's "found nothing" verdict
 * stays authoritative. The pending-retry sweep re-attempts waiting
 * consumers every ~20s; without this stamp every attempt would re-probe a
 * workdir whose files genuinely are not there — a per-round SSH tax for
 * one honest negative. A probe that FOUND twins needs no stamp (its keys
 * leave the missing-worklist), and a probe that could not run at all
 * (SSH error) never stamps (the next attempt retries for real).
 */
const OUTPUT_PROBE_FRESH_MS = 10 * 60_000;

/**
 * t324 — probe the CLUSTER for a run's chainable outputs that the
 * sync-back left behind. One SSH round per record: exact names with
 * `[ -e ]`, globs with `ls | sort | tail -n 1` (RELION zero-pads it###, so
 * a lexicographic sort is numeric up to 999 iterations). Found twins are
 * returned AND (by default) persisted into the record's remoteOutputs —
 * verified cluster paths that resolveInputs' remote flavor and the
 * dispatch's twin map both chain off, with no re-upload and no local copy.
 *
 * `opts.outputs` overrides the locally-collected outputs the worklist is
 * diffed against (finalize passes the just-collected map before the record
 * carries it); `opts.persist=false` leaves persistence to the caller.
 */
async function probeRemoteOutputs(
  conn: RemoteConnection,
  rec: RunRecord,
  opts?: { outputs?: Record<string, string>; persist?: boolean }
): Promise<{ probed: boolean; twins: Record<string, string> }> {
  const r = rec.remote;
  if (!r) return { probed: false, twins: {} };
  const effectiveOutputs = opts?.outputs ?? rec.outputs;
  const missing = missingRemoteOutputKeys(rec.type, effectiveOutputs, r.remoteOutputs);
  if (missing.length === 0) return { probed: false, twins: {} };
  const wanted = (REMOTE_OUTPUT_CANDIDATES[rec.type] ?? []).filter((c) => missing.includes(c.key));
  if (wanted.length === 0) return { probed: false, twins: {} };
  const W = shQuote(r.remoteWorkdir);
  // exit 3 = the workdir could not even be entered (permissions, a transient
  // mount, the dir moved): NOT a "verified absent" verdict — an unstamped
  // negative so the next attempt retries for real instead of waiting out
  // the 10-minute freshness window (t324-a, review finding).
  const parts: string[] = [`cd ${W} 2>/dev/null || exit 3`];
  for (const c of wanted) {
    for (const name of c.exact ?? []) {
      parts.push(
        `if [ -e ${shQuote(name)} ]; then printf 'CF_TWIN\\t%s\\t%s\\n' ${shQuote(c.key)} ${shQuote(name)}; fi`
      );
    }
    if (c.glob) {
      // first hit per key wins (exact names are emitted BEFORE globs, so a
      // canonical name beats a globbed sibling); "latest" picks the highest
      // iteration, "first" any match (per-mic coords: any one is chainable).
      // LC_ALL=C pins byte order — a locale-aware sort on an exotic cluster
      // shell must never reorder the iteration picks (t324-a).
      const tail = c.pick === "first" ? "head -n 1" : "LC_ALL=C sort | tail -n 1";
      parts.push(
        `f=$(ls ${c.glob} 2>/dev/null | ${tail}); [ -n "$f" ] && printf 'CF_TWIN\\t%s\\t%s\\n' ${shQuote(c.key)} "$f" || true`
      );
    }
  }
  const twins: Record<string, string> = {};
  let ran = false;
  try {
    const res = await exec(conn, parts.join("\n"), { timeoutMs: 15_000 });
    if (!res.error && res.code === 0) {
      ran = true;
      for (const line of res.stdout.split("\n")) {
        if (!line.startsWith("CF_TWIN\t")) continue;
        const seg = line.split("\t");
        const key = seg[1];
        const rel = (seg[2] ?? "").trim();
        if (!key || !rel || twins[key]) continue;
        twins[key] = `${r.remoteWorkdir.replace(/\/+$/, "")}/${rel}`;
      }
    }
  } catch {
    /* best-effort: the waiting message keeps its old shape, unstamped */
  }
  if (ran && opts?.persist !== false) {
    const foundAny = Object.keys(twins).length > 0;
    updateRun(rec.jobId, (cur) =>
      cur.remote && cur.startedAt === rec.startedAt
        ? {
            ...cur,
            remote: {
              ...cur.remote,
              ...(foundAny ? { remoteOutputs: { ...(cur.remote.remoteOutputs ?? {}), ...twins } } : {}),
              outputProbeAt: Date.now(),
              // t328 — WHAT the probe verified absent, per key: the pending
              // dialect reports the outcome instead of re-promising a probe
              // that already ran. Found keys leave the absent list (a later
              // probe can still re-find what an earlier one missed).
              outputProbeAbsent: foundAny
                ? (cur.remote.outputProbeAbsent ?? []).filter((k) => !twins[k])
                : missing,
            },
          }
        : null
    );
  }
  if (ran && Object.keys(twins).length > 0) {
    console.log(
      `remote-run: probed ${conn.host}:${r.remoteWorkdir} — ${Object.keys(twins).join(", ")} verified on the cluster (t324)`
    );
  }
  if (ran && Object.keys(twins).length === 0) {
    // t328 — the honest negative gets a log line too: a field diagnosis
    // reading "probed, not there" beats one where the probe is invisible.
    console.log(
      `remote-run: probed ${conn.host}:${r.remoteWorkdir} — ${missing.join(", ")} verified ABSENT on the cluster (t328)`
    );
  }
  return { probed: ran, twins };
}

/**
 * t335 — the win32-mangled orphan mop (field repair).
 *
 * The field report: on a Windows host the remote argv's FILE-valued output
 * slot (--part_star, refine-family --o …) was built with path.win32.join,
 * so `--part_star /data03/…/extract_x/particles.star` left the host as
 * `\data03\…\extract_x\particles.star`. A Linux cluster reads no directory
 * separator in that string — RELION wrote ONE literal file of that whole
 * name into the process CWD, which is the remote PROJECT ROOT (both the
 * direct wrapper and the sbatch script `cd` there). The job itself
 * succeeded (exit 0, all .mrcs stacks in place via the safe --part_dir
 * concat), but the star never reached the workdir and every downstream
 * consumer — 2D classification — starved on it.
 *
 * The mop moves such orphans home: every project-root entry whose name
 * starts with a single `\` and de-mangles (all `\` → `/`) to a path UNDER
 * this project root is mv'd to that path (parents created; an existing
 * destination is never overwritten — a re-run's fresh product outranks
 * the orphan). One SSH round, strictly POSIX, idempotent, never throws:
 * the caller's own probes and runs remain the source of truth.
 *
 * Callers: the t324 heal branch (BEFORE the upstream probes, so the probe
 * can vouch for the moved file and the chain continues without a re-run)
 * and the spawn task (before staging/wipe, so re-runs sweep the junk).
 */
async function mopWin32MangledOrphans(
  conn: RemoteConnection,
  remoteProjectRoot: string
): Promise<{ moved: string[]; failed: string[] }> {
  const root = remoteProjectRoot.replace(/\/+$/, "");
  if (!root.startsWith("/")) return { moved: [], failed: [] };
  // POSIX sh throughout (the exec channel is the login shell, not
  // necessarily bash). The root rides as a properly quoted shell VARIABLE
  // (never inlined into the case pattern — a user-configured remoteRoot
  // with $ or backticks must not expand); in a case pattern the quoted
  // "$R" is literal and the bare /* is the glob. `ls -A` names one per
  // line — a mangled RELION output name never contains a newline, and
  // anything that does simply fails the prefix check and is left alone.
  const script = [
    `R=${shQuote(root)}`,
    `cd "$R" 2>/dev/null || exit 0`,
    `ls -A | grep '^\\\\' | while IFS= read -r name; do`,
    `  posix=$(printf '%s' "$name" | tr '\\\\' '/')`,
    `  case "$posix" in`,
    `    "$R"/*)`,
    `      if [ ! -e "$posix" ]; then`,
    `        if mkdir -p "$(dirname "$posix")" && mv -- "$name" "$posix"; then`,
    `          printf 'CF_MOP\\t%s\\n' "$posix"`,
    `        else`,
    `          printf 'CF_MOP_FAIL\\t%s\\n' "$posix"`,
    `        fi`,
    `      fi`,
    `      ;;`,
    `  esac`,
    `done`,
    `exit 0`,
  ].join("\n");
  const moved: string[] = [];
  const failed: string[] = [];
  try {
    const res = await exec(conn, script, { timeoutMs: 20_000 });
    if (!res.error && res.code === 0) {
      for (const line of res.stdout.split("\n")) {
        if (line.startsWith("CF_MOP\t")) {
          const dest = line.slice("CF_MOP\t".length).trim();
          if (dest) moved.push(dest);
        } else if (line.startsWith("CF_MOP_FAIL\t")) {
          const dest = line.slice("CF_MOP_FAIL\t".length).trim();
          if (dest) failed.push(dest);
        }
      }
    }
  } catch {
    /* best-effort — the probes/runs still speak for what they can see */
  }
  return { moved, failed };
}

export async function startRemoteJob(args: {
  job: Job;
  upstream: UpstreamRef[];
  target: RemoteRunTarget;
}): Promise<StartRemoteOutcome> {
  const { job, upstream, target } = args;

  // t297 — slurm mode is WIRED: the sbatch6gpu.sh pattern at a chosen GPU
  // width. The one honest pre-condition: the cluster must actually offer a
  // Slurm client (the probe looked for sbatch + squeue on the login node).
  const isSlurm = target.mode === "slurm";
  let gpuWidth = isSlurm
    ? Math.max(1, Math.min(8, Math.round(Number(target.gpus ?? 6)) || 6))
    : 0;
  // t306 — the array split width: 0 = no split (the single-job contract,
  // byte-identical submissions). 2..64 after the clamp; the route already
  // dropped sub-2 values, this is the second gate on the engine side.
  const shardTotal =
    isSlurm && Number(target.shards) >= 2 ? Math.min(64, Math.round(Number(target.shards))) : 0;
  // t320 — the pick METHOD decides GPUs for Auto-picking. RELION's
  // autopicker.cpp read() refuses --gpu on the Laplacian-of-Gaussian
  // picker OUTRIGHT (do_gpu && do_LoG → REPORT_ERROR — the user's
  // real-cluster receipt: the job died before touching a micrograph), so
  // a LoG Auto-picking dispatch carries NO --gpu, requests NO --gres and
  // records gpusRequested: 0 no matter what width the dialog offered.
  // References (template matching) and Topaz (the CNN wrapper) keep the
  // GPU path untouched.
  const logPick = isLogAutopick(job.type, job.params);
  // t311/t337 — the GPU-width clamp moved BELOW the connection gates (it
  // now consults the node pin's live scontrol word and the connection's
  // default partition too — see the t337 pre-flight block). The t311
  // behavior (picked partition's probe inventory caps the width) survives
  // as the fallback arm there.
  // t300 — the partition (detected node group) this sbatch pins. The run
  // route already sanitized the raw body; this is the second gate on the
  // engine side (bare API callers get the same clamps, never a raw string
  // into the script — #SBATCH --partition is a shell-facing line).
  const partitionOverride =
    isSlurm && typeof target.partition === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(target.partition)
      ? target.partition
      : null;
  // t337 — the width gate runs below (after the connection gates: the
  // pre-flight needs `conn` for its SSH round).
  // t300 — the NODE pin: a user picking a group the probe resolved to
  // exactly ONE hostname ("brain2", "normal"…) asked for THAT node, not
  // merely its partition — a partition can outlive its hostlist (nodes
  // added later would silently widen the pick). Only a single resolved
  // host pins (--nodelist); multi-host groups stay partition-level (a
  // 1-node sbatch pinning 4 nodes would request the whole group).
  const partitionHosts =
    partitionOverride != null
      ? connLastPartitionHosts(target.connectionId, partitionOverride)
      : null;
  // the pin rides ONLY a hostname-shaped single host (expandHostlist's
  // grammar cannot emit metacharacters, but the second gate is cheap and
  // #SBATCH --nodelist is a shell-facing line like --partition)
  const derivedNodePin =
    partitionHosts && partitionHosts.length === 1 && /^[A-Za-z0-9_.-]{1,64}$/.test(partitionHosts[0])
      ? partitionHosts[0]
      : null;
  // t332 — the user's OWN node pick, straight from the live usage list
  // (the run dialog's ClusterUsagePanel rows): an explicit --nodelist that
  // rides even when the node sits in a MULTI-host group ("node03" out of
  // gpu's eight — the t300 derivation could never express that). Validated
  // like partition (a hostname is the same charset); anything else degrades
  // to the derived pin. The explicit pick WINS over the derivation — the
  // user's later, more specific choice speaks.
  const explicitNode =
    isSlurm &&
    typeof target.nodelist === "string" &&
    /^[A-Za-z0-9_.-]{1,64}$/.test(target.nodelist)
      ? target.nodelist
      : null;
  const nodelistPin = explicitNode ?? derivedNodePin;

  if (NATIVE_TYPES.has(job.type)) {
    return fail(
      `"${job.type}" runs locally in milliseconds (no cluster needed) — its outputs stage to the cluster automatically when a remote job needs them`,
      true
    );
  }

  // t306/t307 — the array gate: shards only mean something for the flavors
  // whose argv takes ONE per-micrograph input star and whose output shape the
  // last task can merge back (ARRAY_FLAVORS — star concat, rows concat with
  // the ../ strip, or a per-micrograph coords collection). Anything else is
  // refused BEFORE staging — a silently un-split run would be a lie with
  // extra steps, and a split refine3d would break global alignment stats.
  if (shardTotal >= 2 && !ARRAY_FLAVORS[job.type]) {
    return fail(
      `"${job.type}" cannot ride an array split (only ${Object.keys(ARRAY_FLAVORS).join(" / ")} ride one today) — submit it without the split`,
      true
    );
  }

  let conn = getConnection(target.connectionId);
  if (!conn) {
    return fail("cluster connection not found — it may have been deleted (re-open Remote cluster and re-save)", true);
  }
  if (!conn.host || !conn.username) {
    return fail("connection has no host/username — open Remote cluster and complete the form", true);
  }

  const moduleName = target.module ?? conn.defaultModule ?? "";

  // t297 — sbatch needs the Slurm client the probe looked for; a cluster
  // that never probed (bare API) gets the same honest door the module probe
  // has — never a blind spawn that fails five minutes later at submit time.
  if (isSlurm && conn.lastProbe && !conn.lastProbe.slurm) {
    return fail(
      `the probe saw no Slurm client (sbatch/squeue) on ${conn.host} — re-test the connection, or run direct (nohup) mode`,
      true
    );
  }


  // ---- liveness pre-check (precise, async — isRunAlive only guesses) ----
  const prev = getRun(job.id);
  // marker for the anti-ghost re-check below: if a CONCURRENT dispatch
  // lands a record while we await, its startedAt differs from the one we
  // verified here (t262's ghost-dispatch finding, hardened t263).
  const prevStartedAt = prev?.startedAt ?? null;
  if (prev?.remote && prev.done === false) {
    // poll the PREVIOUS run's OWN connection — checking a record from
    // cluster A against cluster B reads the wrong filesystem and would
    // report a live run VANISHED (the ghost-dispatch door t262 caught:
    // the record-side staging phase short-circuits first, but a RUNNING
    // record must be witnessed on its own cluster, not the new target).
    const prevConn =
      prev.remote.connectionId === conn.id ? conn : getConnection(prev.remote.connectionId);
    if (prevConn) {
      const alive = await pollOneRemote(prevConn, prev);
      if (alive === "alive" || alive === "unknown" || alive === "busy" || alive === "staging") {
        return {
          ok: false,
          busy:
            alive === "staging"
              ? `inputs are still staging to ${prevConn.host} — the run starts by itself`
              : `remote run still active on ${prev.remote.host}${prev.remote.pid != null ? ` (cluster pid ${prev.remote.pid})` : ""}`,
          busyKind: "live",
          job,
        };
      }
    }
    // else: the previous connection is gone — the sweep already failed that
    // row and the record can no longer be verified; safe to replace.
    // Dead + finalized by the poll above? pollOneRemote only INSPECTS; the
    // sweep finalizes. A dead-but-unfinalized record is safe to replace.
  }

  // ---- t337 — the node-pin pre-flight (the user's live receipt) --------
  // The user's controller refused a pinned submission at submit time:
  //
  //   sbatch: error: Batch job submission failed: Requested node
  //   configuration is not available
  //
  // …with no word about WHY. Three compositions produce exactly that
  // verdict, and the engine could compose all three before t337:
  //   (a) --gres=gpu:W with W beyond the PINNED node's own GPUs (the
  //       t311 clamp only spoke for the picked PARTITION — the t332
  //       explicit pin suppresses the partition, and nothing clamped
  //       against the node itself);
  //   (b) a node that is DOWN/DRAIN at submit time (the usage list's
  //       rows refuse the click, but the state can age between pick and
  //       submit — the panel polls every 30s);
  //   (c) a node scontrol does not know (stale list, renamed host).
  // ONE extra SSH round (`scontrol show node <pin> -o`, the same pure
  // parser the usage route rides) settles all three BEFORE a byte
  // stages, and the refusal teaches the fix instead of quoting Slurm's
  // one-liner. A probe that cannot RUN (SSH blip, no scontrol) degrades
  // to the old behavior — a monitoring failure never blocks a dispatch
  // (the usage panel's own doctrine); the residual window is covered by
  // the sbatch-refusal translation below.
  let nodeLive: SlurmNodeUsage | null = null;
  let nodeProbeRan = false;
  if (isSlurm && nodelistPin) {
    try {
      const r = await exec(conn, loginShellScript(`scontrol show node ${shQuote(nodelistPin)} -o`), {
        timeoutMs: 10_000,
      });
      // 127 = no scontrol on the login node — degrade, don't guess
      nodeProbeRan = !r.error && r.code !== 127;
      if (nodeProbeRan) {
        nodeLive = parseScontrolNodes(r.stdout).find((n) => n.node === nodelistPin) ?? null;
      }
    } catch {
      /* SSH blip — the old behavior stands */
    }
  }
  if (isSlurm && nodelistPin && nodeProbeRan) {
    if (!nodeLive) {
      return fail(
        `node ${nodelistPin} is not known to Slurm on ${conn.host} — scontrol lists no such node (the usage list may be stale). Refresh the node usage list and pick a live node, or click the pinned row again to release the pin and let Slurm choose.`,
        true
      );
    }
    if (nodeUnavailable(nodeLive)) {
      return fail(
        `node ${nodelistPin} is ${nodeLive.state} on ${conn.host} right now — the scheduler refuses new work on it, and a pinned submission would be refused at submit time. Pick another node in the live usage list (Run on cluster → the node table), or click the pinned row again to release the pin and let Slurm choose.`,
        true
      );
    }
    // a node with NO GPUs cannot host a job whose sbatch will request
    // --gres — the width truth the spawn's own gresWidth arithmetic
    // derives, computed here so the refusal lands BEFORE staging (the
    // dialog's ask line names the same contradiction client-side; this
    // is the server's gate for bare API callers and stale dialogs)
    if (nodeLive.gpuTotal === 0) {
      const earlyParams = parseJobParams(job.params);
      const earlyStrategy = gpuStrategyFor(job.type, {
        micrographs: 10,
        particles: Number(earlyParams.particles ?? 5000) || 5000,
        gpus: gpuWidth,
        logAutopick: logPick,
      });
      const earlyMpi = moduleName ? conn.lastProbe?.relionMpi?.[moduleName] ?? false : false;
      const gresWouldBe =
        earlyStrategy.mode === "multi-gpu" && earlyMpi ? gpuWidth : earlyStrategy.gpus > 0 ? 1 : 0;
      if (gresWouldBe > 0) {
        return fail(
          `node ${nodelistPin} has no GPUs (scontrol says Gres=(null)) — this job would request ${gresWouldBe} GPU${gresWouldBe > 1 ? "s" : ""} there and the submission would be refused. Click the pinned row again to release the pin, or pick a GPU node from the usage list.`,
          true
        );
      }
    }
  }

  // t340 — the CONTRADICTION gate: a picked partition the pinned node does
  // not live in is a submit-time refusal on real controllers (the UI's
  // mismatch guard releases the pin client-side, but the API door can still
  // compose the pair). scontrol's own word decides; a silent probe degrades
  // to the old behavior (the sbatch-refusal translation catches the rest).
  if (
    isSlurm &&
    nodelistPin &&
    nodeProbeRan &&
    nodeLive &&
    nodeLive.partitions.length > 0 &&
    partitionOverride != null &&
    !nodeLive.partitions.includes(partitionOverride)
  ) {
    return fail(
      `node ${nodelistPin} lives in partition${nodeLive.partitions.length > 1 ? "s" : ""} ${nodeLive.partitions.join(", ")} — not ${partitionOverride}. A --partition=${partitionOverride} + --nodelist=${nodelistPin} combination is refused at submit time by the scheduler. Pick the node's own group in the Node/partition dropdown, or release the pin and let the group speak.`,
      true
    );
  }

  // ---- t340 — the pin's OWN partition (the field report that convicted
  // the t332 doctrine) -----------------------------------------------
  // 「从node使用情况列表选择node时报错，但是从node的下拉菜单选择node时
  // 可以正常运行」 — the two channels built DIFFERENT sbatch lines for the
  // SAME node: the dropdown carried --partition=<group> (+ --nodelist when
  // single-host), while the usage-list pin SUPPRESSED --partition entirely
  // (t332: "the node's own partition is where it lands"). With no
  // --partition the controller falls back to the cluster's DEFAULT
  // partition — and a GPU node that does not live there is refused at
  // submit time: "Requested node configuration is not available", the
  // user's exact receipt. Resolve the pin's partition from the freshest
  // word available — the pre-flight's own scontrol row (Partitions=), then
  // the probe inventory group that lists the host — and carry it in the
  // sbatch so the pin and the dropdown land the SAME composition. Only a
  // node NEITHER source knows keeps the bare --nodelist (the connection's
  // default must NOT ride along: a wrong partition is a guaranteed
  // refusal where a missing one merely lets the default decide).
  const pinPartition =
    explicitNode && partitionOverride == null
      ? (nodeLive?.partitions?.[0] ?? probePartitionOfHost(target.connectionId, explicitNode) ?? null)
      : null;

  // ---- t311/t337 — the GPU-width clamp (server-side, bare-API proof) --
  // Priority: the PINNED node's own live scontrol word (most specific),
  // else the partition the script will ACTUALLY carry — picked, the pin's
  // own (t340), or the connection's default (t337: the old gate keyed only
  // on the PICKED partition, so "auto" + width 6 rode --partition=normal
  // (5 GPUs/node) straight into the controller's submit-time refusal — the
  // exact hole the user's receipt walked through). No inventory → the
  // 8-wide cap stands, never a fabricated limit.
  if (isSlurm) {
    if (nodeLive && nodeLive.gpuTotal > 0) {
      if (gpuWidth > nodeLive.gpuTotal) {
        console.warn(
          `remote-run: clamping GPU width ${gpuWidth} → ${nodeLive.gpuTotal} (node ${nodelistPin} offers ${nodeLive.gpuTotal} GPU(s) per its live scontrol row — the pin is more specific than any partition)`
        );
        gpuWidth = nodeLive.gpuTotal;
      }
    } else {
      const clampPartition =
        nodelistPin && partitionOverride == null
          ? pinPartition // t340 — the pin's own resolved partition, when known
          : (partitionOverride ?? conn.slurmPartition ?? null);
      if (clampPartition != null) {
        const gpusPerNode = connPartitionGpus(target.connectionId, clampPartition);
        if (gpusPerNode != null && gpuWidth > gpusPerNode) {
          console.warn(
            `remote-run: clamping GPU width ${gpuWidth} → ${gpusPerNode} (partition ${clampPartition} offers ${gpusPerNode}/node per the last probe)`
          );
          gpuWidth = gpusPerNode;
        }
      }
    }
  }

  // t324 — resolve inputs (same semantics as the local engine) -------------
  // t325 — the gate is cluster IDENTITY: `conn`'s host:port rides the opts
  // so a re-created connection to the SAME cluster still accepts the
  // upstream record's twins (connection drift used to strand remote chains
  // with the generic "Waiting for upstream output" message forever).
  const connHostPort = `${conn.host}:${conn.port}`;
  const params = parseJobParams(job.params);
  let resolved = resolveInputs(job.type, upstream, params, {
    remote: true,
    connectionId: target.connectionId,
    host: connHostPort,
  });
  if (resolved.missing) {
    // t324 — the LAZY HEAL: records finalized under pre-t324 code (or whose
    // probe-relevant keys went missing later) can still be recovered — one
    // batched probe over the lineage's completed remote records from THIS
    // connection, then re-resolve. The heal patches each record's twins in
    // place (memoized by the outputProbeAt stamp), so the first consumer
    // pays the SSH round and every later attempt reads the ledger.
    // t325 — "from THIS connection" means the same CLUSTER (connection or
    // host), not the bare connectionId: a re-created connection to the
    // same host must still heal the old records — their workdirs and files
    // sit on that very host.
    const runsNow = readRuns();
    const healable = upstream.filter((u) => {
      const st = runsNow[u.id];
      if (!st?.remote || !st.done || st.exitCode !== 0) return false;
      if (!sameClusterTarget(st.remote, { connectionId: target.connectionId, host: connHostPort })) {
        return false;
      }
      if (
        st.remote.outputProbeAt != null &&
        Date.now() - st.remote.outputProbeAt < OUTPUT_PROBE_FRESH_MS
      ) {
        return false;
      }
      return missingRemoteOutputKeys(st.type, st.outputs, st.remote.remoteOutputs).length > 0;
    });
    if (healable.length > 0) {
      console.log(
        `remote-run: probing ${healable.length} upstream record(s) on ${conn.host} for outputs the sync-back left behind (t324 heal)`
      );
      // t335 — mop win32-mangled orphans BEFORE the probes: the heal looks
      // for exact names INSIDE the upstream workdir, but a Windows-host
      // dispatch built with path.win32 left its output as ONE literal
      // whole-path filename in the PROJECT ROOT (particles.star as
      // "\data03\…\extract_x\particles.star"). Moved home first, the probe
      // below can vouch for it — and the chain continues without paying
      // for the upstream again. Best-effort: a mop that cannot run leaves
      // the probes exactly as honest as they were.
      try {
        const mopRoot = `${(await expandRemotePath(conn, conn.remoteRoot || "~/cryoflow")).replace(/\/+$/, "")}/${job.projectId}`;
        const mop = await mopWin32MangledOrphans(conn, mopRoot);
        if (mop.moved.length > 0) {
          console.log(
            `remote-run: moved ${mop.moved.length} win32-mangled orphan file(s) home on ${conn.host} (t335) — ${mop.moved
              .map((m) => m.slice(mopRoot.length + 1))
              .slice(0, 5)
              .join(", ")}${mop.moved.length > 5 ? ", …" : ""}`
          );
        }
        if (mop.failed.length > 0) {
          console.log(`remote-run: mop could NOT move ${mop.failed.length} orphan(s) on ${conn.host}: ${mop.failed.join(", ")}`);
        }
      } catch {
        /* best-effort mop — the probes below still speak for what they can see */
      }
      // t328 — probe outcomes are INFORMATION the waiting message owes the
      // user: a probe that ran and found nothing is now persisted on the
      // record (outputProbeAbsent) and the engine's dialect reports it; but
      // a probe that could not RUN at all (SSH blip, unenterable workdir)
      // leaves no stamp and no trace — without this flag the row would keep
      // saying "the dispatch probes the upstream's workdir" as if the probe
      // had never happened, the exact zero-new-information loop the field
      // receipt carried for days.
      let probeUnreachable = false;
      for (const u of healable) {
        const st = runsNow[u.id];
        if (!st) continue;
        const pr = await probeRemoteOutputs(conn, st);
        if (!pr.probed) probeUnreachable = true;
      }
      resolved = resolveInputs(job.type, upstream, params, {
        remote: true,
        connectionId: target.connectionId,
        host: connHostPort,
      });
      if (resolved.missing && probeUnreachable) {
        resolved = {
          ...resolved,
          missing: `${resolved.missing} — the cluster could not be reached to check just now; the retry heartbeat tries again by itself`,
        };
      }
    }
  }
  if (resolved.missing) {
    return { ok: false, error: resolved.missing, ...(resolved.wait ? { waiting: resolved.wait } : {}) };
  }

  // ---- t324-a — topaztrain's dispatch-time synthesis READS its stars ----
  // The picks-index synthesis (t265) reads train_picks + micrographs_star
  // FROM THE LOCAL DISK; a twin-resolved input (cluster-only, no local
  // copy) would skip the synthesis and hand RELION the raw per-mic coords
  // star as --topaz_train_picks — the exact failure the synthesis exists
  // to prevent, spawning a doomed run. PENDING with the remediation
  // instead: raising the sync caps + re-running the upstream lands the
  // local copy, and the ~20s retry picks the job up by itself.
  if (job.type === "topaztrain") {
    const unreadable = ["train_picks", "micrographs_star"].filter(
      (k) => resolved.inputs[k] && !existsSync(resolved.inputs[k])
    );
    if (unreadable.length > 0) {
      return {
        ok: false,
        error: `Topaz training builds its picks index from the input stars on THIS machine, but ${unreadable.join(", ")} stayed on the cluster (no local copy) — raise the connection's sync caps and re-run the upstream to bring them home; this job then starts automatically`,
        waiting: "not-ready",
      };
    }
  }

  // ---- t313 — the byte-verified CTF door (before any staging) -----------
  // The Beijing ticket, round two: the t312 refusal judged by FILENAME and
  // blocked the user's REAL motion-corrected micrographs (MotionCor2 keeps
  // the movie's basename — *_Fractions_DW.mrc outputs are summed images).
  // The gate now smells the RESOLVED star's rows only to find candidates,
  // then reads the flagged files' own MRC headers over SSH (one round
  // trip, spread sample): NZ>1 = a verified frame stack → the honest
  // requestError refusal, now carrying the header's numbers as evidence;
  // NZ=1 = verified micrographs → through (the note rides the submitted
  // script's log so the receipt is visible in the Log tab); unverifiable
  // → through with the advisory note. A wiring mistake must not flip the
  // job row to failed; a filename smell must not block real data.
  let ctffindGateNote: string | null = null;
  if (job.type === "ctffind" && resolved.inputs.micrographs_star) {
    // t324-a — a twin-resolved star (the sync-back left no local copy)
    // cannot be read by the local half of the gate: the byte-verified NZ
    // door degrades to its OWN advisory dialect — "unverifiable → through
    // with the note" — never to silence. The cluster's own ctffind still
    // speaks if a raw stack slips through.
    if (existsSync(resolved.inputs.micrographs_star)) {
      const gate = await ctffindInputGate(
        resolved.inputs.micrographs_star,
        remoteHeaderSniffer(conn)
      );
      if (gate.refusal) {
        return fail(gate.refusal, true);
      }
      ctffindGateNote = gate.note;
    } else {
      ctffindGateNote =
        "micrographs star consumed in place from the cluster (no local copy was synced) — the local MRC byte check (NZ) did not run";
    }
  }

  // ---- t334 — the extraction collision scan (before any staging) ---------
  // The Beijing field report: a copied extraction job died 83% through
  // 1034 micrographs at relion_preprocess's image.h:1534 ("write: target
  // and source objects have different size"). RELION writes ONE .mrcs
  // stack per micrograph — part_dir + the mic name minus extension +
  // ".mrcs" — the first particle replaces that path blindly and every
  // later particle APPENDS, checking the file on disk. The input STAR's
  // row geometry decides whether those paths are UNIQUE: the same mic
  // listed twice means two array shards write the same stack at the same
  // moment (overwrites race appends until a header read catches the file
  // mid-rewrite), and two names sharing an extension-stripped key
  // ("X.mrc" + "X.mrcs" — the user's *_Fractions_DW dataset holds both
  // extensions) compose the SAME stack by construction. Both are
  // knowable HERE, from the star text, before one byte is staged — the
  // t320 doctrine: refuse the trap, don't submit into it. A twin-resolved
  // star (cluster-only) skips the scan with a console note, exactly like
  // the CTF gate's own degradation — never a silent guarantee.
  let extractStarText: string | null = null;
  if (job.type === "extract" && resolved.inputs.micrographs_star) {
    if (existsSync(resolved.inputs.micrographs_star)) {
      try {
        extractStarText = readFileSync(resolved.inputs.micrographs_star, "utf8");
        const report = scanExtractCollisions(extractStarText);
        if (report && (report.duplicates.length > 0 || report.clashes.length > 0)) {
          return fail(
            `the micrographs STAR would collide inside the extraction: ${describeExtractCollisions(report)} — RELION names each particle stack after the micrograph (extension swapped to .mrcs), so these rows write the same file (the mid-run "write: target and source objects have different size" crash). De-duplicate the rows or rename the colliding files on the cluster, then run again`,
            true
          );
        }
      } catch {
        /* unreadable star → the cluster reports the real problem */
      }
    } else {
      console.log(
        `remote-run: extract collision scan skipped — the micrographs star stayed on the cluster (no local copy was synced)`
      );
    }
  }

  // ---- t267: a never-probed connection must not dispatch blind ----------
  // The UI dialog can't reach this state (its module list IS lastProbe),
  // but the bare API can: without lastProbe the argv below would be built
  // from NULL externals/ctffind/relionHome, and externalFor would fall
  // back to the LOCAL PATH — an honest-but-misleading LOCAL error for a
  // CLUSTER command (t266's unprobed-dispatch finding, now closed at the
  // product layer). The probe is load-bearing, so the dispatch performs
  // it itself: probe now, persist exactly like the Test route does, and
  // re-read the connection; a failed probe degrades to an honest error
  // naming the door, never to a local-path guess.
  if (!conn.lastProbe) {
    try {
      const probe = await probeConnection(conn);
      patchConnection(conn.id, { lastProbe: probe });
      if (probe.ok) {
        conn = getConnection(conn.id) ?? conn; // re-read with the fresh truth
        // t268: the ceremony's cost is part of the dispatch's latency —
        // say it out loud (probe.durationMs rides the persisted record too).
        console.log(
          `remote-run: auto-probed ${conn.host}:${conn.port} in ${probe.durationMs ?? "?"}ms — the dispatch ran the ceremony itself (t267/t268)`
        );
      } else {
        const why = probe.error?.split("\n")[0]?.trim() || "probe failed";
        return fail(
          `the connection has never been probed and probing just failed (${why}) — open Remote clusters and run Test first`,
          true
        );
      }
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      return fail(
        `the connection has never been probed and probing just failed (${why.split("\n")[0]}) — open Remote clusters and run Test first`,
        true
      );
    }
  }
  const relionHomeFromProbe = moduleName ? conn.lastProbe?.relionHomes?.[moduleName] ?? null : null;

  // ---- remote roots ------------------------------------------------------
  let remoteRoot: string;
  try {
    remoteRoot = await expandRemotePath(conn, conn.remoteRoot || "~/cryoflow");
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
  const jobRef: EngineJobRef = { id: job.id, projectId: job.projectId, type: job.type, params };
  const localWorkdir = workdirFor(jobRef);
  const remoteProjectRoot = `${remoteRoot.replace(/\/$/, "")}/${job.projectId}`;
  const remoteWorkdir = `${remoteProjectRoot}/${job.type}_${job.id.slice(-8)}`;

  // ---- upstream remote twins (t324/t325) --------------------------------
  // local path → the verified cluster twin (plus identity entries for
  // outputs that never came home). HOISTED above both star gates (t342):
  // the extract census below and the particles-ref gate further down
  // both need the twin map to read a star whose local copy is missing —
  // the staging planner after them keeps using the same map.
  const runs = readRuns();
  const upstreamRemoteTwins = new Map<string, string>();
  for (const up of upstream) {
    const rec = runs[up.id];
    if (!rec?.remote?.remoteOutputs) continue;
    // t343 — the PAIR entries (local mirror path → cluster twin) earn the
    // same-cluster gate the identity entries have carried since t325, and
    // the whole upstream is gated in one place. The hole: a pair built
    // from an upstream that ran on a DIFFERENT cluster made the staging
    // below SKIP the upload and point this cluster's argv at a path only
    // the OTHER cluster can reach — relion dies "file not found" over a
    // local mirror that sat ready to upload. The resolver itself was
    // always gated (its case T checks the same identity); only this map's
    // pairs missed it. Gated, such an upstream takes the UPLOAD lane —
    // the one copy this connection can actually reach. (Two front-ends
    // of one shared filesystem lose the in-place pass this way — the
    // safe direction: bytes upload, the run still completes.)
    if (!sameClusterTarget(rec.remote, { connectionId: conn.id, host: connHostPort })) continue;
    for (const [key, localTw] of Object.entries(rec.outputs)) {
      const remoteTw = rec.remote.remoteOutputs[key];
      if (remoteTw && localTw) upstreamRemoteTwins.set(localTw.split(path.sep).join("/"), remoteTw);
    }
    // t324 — outputs that never came home: the verified cluster twin
    // satisfies the requirement by ITSELF (identity entry — both the
    // staging skip below and the argv's twin preference key off this map,
    // so a twin-resolved input uploads nothing and runs against the
    // cluster copy in place). Same cluster only (t325: connection OR
    // host — a re-created connection to the same host still holds these
    // paths; a genuinely different cluster does not).
    for (const remoteTw of Object.values(rec.remote.remoteOutputs)) {
      const norm = remoteTw.split(path.sep).join("/");
      if (!upstreamRemoteTwins.has(norm)) upstreamRemoteTwins.set(norm, remoteTw);
    }
  }

  // ---- t335 — the extract frame census + the twin-star closure ---------
  // The parallel t334 scan refuses duplicate rows and extension twins when
  // a LOCAL star copy exists — but a twin-resolved star (the sync-back left
  // no local copy) made that scan SKIP with a console note, the same t324-a
  // blind spot the CTF gate once had. This block closes it: the star is
  // cat'd in place over SSH, the t334 collision scan runs on the cluster's
  // own text, and the .mrcs rows are BYTE-verified through the header
  // sniffer — nz>1 is a movie stack, not a micrograph (RELION reads an
  // .mrcs row as an (x,y,1,N) volume and windows frame 0: garbage
  // particles even when the names never collide — the mixed-import shape
  // the name-only scan cannot see). Verified singles pass with a note;
  // everything unverifiable degrades to the note, never a block.
  let extractGateNote: string | null = null;
  if (job.type === "extract" && resolved.inputs.micrographs_star) {
    const starPath = resolved.inputs.micrographs_star;
    // t335/t343 — the lane-aware read: the cluster twin when the input
    // runs in place (the copy THIS job consumes — even when a stale
    // local mirror also exists), the local copy when the staging uploads
    // it. The collision scan + the frame census both judge those bytes.
    const starRd = await readResolvedStarText(conn, starPath, upstreamRemoteTwins, remoteRoot);
    const starText = starRd.text;
    if (starText !== null && starRd.lane === "cluster") {
      console.log(
        `remote-run: extract star read in place over SSH (${starRd.readAt}) — the collision scan + the frame census ran on the cluster's own bytes, the copy this job consumes (t335/t343)`
      );
    }
    if (starText === null) {
      extractGateNote =
        `${starUnreadableNote("micrographs", starRd)} — the collision scan and the frame-stack census did not run`;
      console.log("remote-run: extract frame census — star unreadable, census skipped (t335/t343)");
    } else {
      // the collision scan on whatever text we now hold (the t334 wording
      // verbatim — a twin-resolved star earns the SAME refusal, not a
      // softer one)
      const report = scanExtractCollisions(starText);
      if (report && (report.duplicates.length > 0 || report.clashes.length > 0)) {
        return fail(
          `the micrographs STAR would collide inside the extraction: ${describeExtractCollisions(report)} — RELION names each particle stack after the micrograph (extension swapped to .mrcs), so these rows write the same file (the mid-run "write: target and source objects have different size" crash). De-duplicate the rows or rename the colliding files on the cluster, then run again`,
          true
        );
      }
      // the frame census — only when .mrcs rows exist (a pure .mrc star
      // has nothing to byte-verify)
      const rows = micrographRowsFromContent(starText);
      if (rows.some((r) => /\.mrcs$/i.test(r))) {
        const gate = await extractInputGate(
          rows,
          remoteHeaderSniffer(conn),
          (row) => (row.startsWith("/") ? row : `${remoteProjectRoot}/${row.replace(/^\.?\//, "")}`)
        );
        if (gate.refusal) {
          console.log(
            `remote-run: extract frame census REFUSED before staging — ${rows.length} row(s) censused, ${gate.refusal.split(" — ")[0]} (t335)`
          );
          return fail(gate.refusal, true);
        }
        extractGateNote = gate.note + starLaneSuffix(starRd);
      }
    }
  }

  // ---- topaztrain: build the coordinate_files index HERE (t265) ----------
  // --topaz_train_picks must be the data_coordinate_files INDEX star, and
  // the engine's synthesis reads the resolved inputs from a DISK. At
  // dispatch time those inputs are still LOCAL paths (the cluster hasn't
  // seen them yet), so the index is synthesized now, into the job's local
  // workdir, and stages below like any other input — its per-mic star
  // references ride the same mirror mapping. buildArgv's cluster-side
  // re-synthesis then degrades to a pass-through by design: its
  // readFileSync of a cluster path cannot succeed, and the staged file is
  // already index-format, exactly what RELION's trainTopaz reads.
  const resolvedInputs: Record<string, string> = { ...resolved.inputs };
  if (
    job.type === "topaztrain" &&
    resolvedInputs.train_picks &&
    resolvedInputs.micrographs_star &&
    existsSync(resolvedInputs.train_picks)
  ) {
    const synth = synthesizeTrainingPicks(
      resolvedInputs.train_picks,
      resolvedInputs.micrographs_star,
      localWorkdir
    );
    if (synth !== resolvedInputs.train_picks) resolvedInputs.train_picks = synth;
  }

  const remoteState: RemoteRunState = {
    connectionId: conn.id,
    connectionName: conn.name,
    host: `${conn.host}:${conn.port}`,
    user: conn.username,
    module: moduleName,
    mode: isSlurm ? "slurm" : "direct",
    remoteRoot,
    remoteWorkdir,
    pid: null,
    slurmId: null,
    ...(isSlurm ? { gpusRequested: logPick ? 0 : gpuWidth } : {}),
    // t340 — the partition the sbatch will actually name: the picked group,
    // else the pin's own resolved home (the inspector's strip says where
    // the job really landed either way).
    ...(isSlurm
      ? { partition: partitionOverride ?? pinPartition ?? undefined }
      : {}),
    phase: "staging",
  };

  // ---- plan the input staging -------------------------------------------
  // upstream remote outputs (same cluster tree) pass through untouched;
  // everything else uploads (STARs rewritten, external files staged).
  // (the upstream twin map lives ABOVE the star gates now — t342)
  const uploads: Array<{ key: string; local: string; remote: string; external: boolean }> = [];

  // ---- t350 — per-class selection (the cryoSPARC-style flow) ------------
  // params.classStarSelection = { jobId, classes: [3, 7] } — the user picked
  // classes in a FINISHED upstream classification's gallery. The per-class
  // stars already sit on the cluster (finalize split them there), so the
  // swap is a TWIN REGISTRATION, not an upload: resolved.inputs.particles_
  // star is re-pointed at the upstream class star's cluster path and the
  // twin map carries it past the staging loop (zero bytes cross the wire —
  // the mrcs stacks those rows reference live in the same cluster tree the
  // upstream classification itself read from).
  // Multi-class merges happen cluster-side right before the argv build
  // (the auto-joinstar: one awk over files that share a filesystem).
  let classStarTwinPaths: string[] = [];
  if (
    resolved.inputs.particles_star &&
    params.classStarSelection &&
    typeof params.classStarSelection === "object"
  ) {
    const sel = params.classStarSelection as { jobId?: unknown; classes?: unknown };
    const selJobId = typeof sel.jobId === "string" ? sel.jobId : "";
    const selClasses = Array.isArray(sel.classes)
      ? sel.classes.map((c) => Number(c)).filter((c) => Number.isInteger(c) && c > 0)
      : [];
    const upRec = selJobId ? getRun(selJobId) : null;
    const upRemote = upRec?.remote;
    if (!upRec || !upRemote || !upRemote.remoteWorkdir) {
      return fail(
        "the class-selection source job has no cluster record — re-create this job from the class gallery of a finished classification",
        true
      );
    }
    if (selClasses.length === 0) {
      return fail("class selection is empty — pick at least one class in the gallery", true);
    }
    const upWd = upRemote.remoteWorkdir.replace(/\/+$/, "");
    classStarTwinPaths = selClasses.map((c) => {
      const name = `particles_class${String(c).padStart(3, "0")}.star`;
      return `${upWd}/${name}`;
    });
    // verify the stars exist on the cluster BEFORE promising them (one
    // batched stat round; the upstream may predate the split feature —
    // its data star can still be split by re-running, or the classes
    // picked may outrank the class count). An SSH FAILURE is its own
    // honest verdict — never "does not have" (a dead wire is not an
    // absent file; the retry heartbeat re-attempts by itself).
    const statRes = await (async () => {
      const checks = classStarTwinPaths
        .map((p, i) => `if [ -f ${shQuote(p)} ]; then echo "OK ${i}"; fi`)
        .join("; ");
      return exec(conn, checks, { timeoutMs: 15_000 });
    })();
    if (statRes.error) {
      return {
        ok: false,
        error: `could not reach ${conn.host} to verify the selected class stars (${statRes.error}) — the run retries automatically when the cluster answers`,
        waiting: "not-ready" as const,
      };
    }
    const idxOk = new Set(
      statRes.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^OK \d+$/.test(l))
        .map((l) => Number(l.slice(3)))
    );
    const missing = selClasses.filter((_, i) => !idxOk.has(i));
    if (missing.length > 0) {
      return fail(
        `the cluster does not have per-class star(s) for class(es) ${missing.join(", ")} in the source job — they may have been picked from a run that predates the per-class split (re-run the classification, or pick fewer classes)`,
        true
      );
    }
    // re-point the resolved input at the FIRST class star's cluster world:
    // the twin map key is the LOCAL mirror path (present or not — a twin
    // hit skips both the upload and the existence check)
    const localAnchor = path.join(
      RELION_DIR,
      job.projectId,
      path.basename(upWd),
      path.basename(classStarTwinPaths[0])
    );
    const anchorNorm = localAnchor.split(path.sep).join("/");
    resolved.inputs.particles_star = localAnchor;
    resolvedInputs.particles_star = localAnchor;
    upstreamRemoteTwins.set(anchorNorm, classStarTwinPaths[0]);
    console.log(
      `remote-run: "${job.name}" consumes ${selClasses.length} per-class star(s) from ${path.basename(upWd)} (classes ${selClasses.join(", ")}) — cluster-side, no upload (t350)`
    );
  }

  // ---- t338 — the particle-star ↔ stack consistency gate (consumers) ----
  // The field report: a 2D classification died ~1 min into relion_refine
  // with readMRC: "Image number 341 exceeds stack size 340" (rwMRC.h) —
  // the upstream extraction had COMPLETED (exit 0) yet its particles.star
  // references more images than the stack holds. That is the t334
  // collision's SILENT variant: same-stem rows in the extraction's INPUT
  // star ("X.mrc" + "X.mrcs") compose the SAME stack path; RELION's first
  // particle per micrograph replaces the path blindly and the later
  // writer's boxes append behind — so writer A's 341 images get truncated
  // to 1 by writer B's first box, B appends its own 2..340, and the merged
  // star still numbers A's rows up to 341. Extract "succeeds"; the poison
  // surfaces downstream, ~20 GPU-minutes in. The t334/t335 blades refuse
  // such INPUTS at extraction dispatch — this gate guards the OTHER side:
  // a star already poisoned by an OLDER dispatch (the user's database:
  // extract COMPLETED, star lying) is refused before this job burns queue
  // + GPU time, with the exact numbers RELION would die on. Unverifiable
  // refs degrade to the receipt note, never a block (the t313 rule).
  let particlesGateNote: string | null = null;
  if (PARTICLES_CONSUMER_TYPES.has(job.type) && resolved.inputs.particles_star) {
    const starPathLocal = resolved.inputs.particles_star;
    // t338/t343 — the lane-aware read (ONE address, not a candidate walk):
    // the cluster twin when this job runs against the cluster copy in
    // place — even when a stale local mirror also exists (the mirror's
    // bytes are never consumed and must not be judged) — else the local
    // copy the staging uploads. The stack-size check judges exactly the
    // bytes relion will read.
    //
    // t346 — the cluster lane no longer cats the star home to parse it
    // locally (tens of MB over the wire = the dispatch stall + the very
    // network transfer the cluster-native doctrine forbids): a CENSUS awk
    // pass runs on the cluster and only the verdict rows (one per unique
    // stack path) cross the wire. The upload lane still reads the local
    // bytes it is about to upload (no SSH at all).
    const laneProbe = await readResolvedStarText(conn, starPathLocal, upstreamRemoteTwins, remoteRoot, {
      resolveOnly: true,
    });
    if (laneProbe.lane === "cluster" && laneProbe.clusterHome) {
      // the star's CLUSTER-side home anchors star-relative refs for the
      // census's candidate grammar (same anchor the text lane uses)
      const clusterStar = laneProbe.clusterHome;
      const starDir = clusterStar.slice(0, clusterStar.lastIndexOf("/"));
      const census = await clusterParticleRefCensus(conn, clusterStar);
      if (census.rows != null) {
        if (census.rows.length > 0) {
          const gate = await particlesRefGateFromRefs(
            census.rows,
            remoteHeaderSniffer(conn),
            (ref) => refCandidates(ref, remoteProjectRoot, starDir || remoteProjectRoot),
            { totalRefs: census.total }
          );
          if (gate.refusal) {
            console.log(
              `remote-run: particle-ref gate REFUSED before staging (cluster census) — ${gate.refusal.split(" — ")[0]} (t338/t346)`
            );
            return fail(gate.refusal, true);
          }
          particlesGateNote =
            gate.note +
            ` (the star was censed IN PLACE on the cluster at ${clusterStar} — zero star bytes crossed the wire)`;
        }
        // rows.length === 0 → not a particles-star shape (or every ref
        // unparseable) — the same clean pass the text lane grants
      } else {
        // the census could not run: a missing file is the file's own
        // verdict (same word catRemote would speak — the t343 contract
        // tail rides along so the receipt keeps teaching); anything else
        // is a wire/tool failure — the check "did not run", never a block
        const missing = /No such file|no such file|not found|cannot open|can't open/i.test(census.err ?? "");
        particlesGateNote = missing
          ? `particles star unreadable on the cluster — this job reads it in place at ${clusterStar} and that read failed: ${census.err}; if the file is gone, re-run the upstream job to regenerate it — the stack-size consistency check did not run`
          : `the stack-size consistency check did not run (the in-place census on ${clusterStar} failed${census.err ? `: ${census.err}` : ""}) — the SSH wire may be slow; run again or check the login node's load`;
      }
    } else {
      const starRd = await readResolvedStarText(conn, starPathLocal, upstreamRemoteTwins, remoteRoot);
      const starText = starRd.text;
      if (starText == null) {
        particlesGateNote =
          `${starUnreadableNote("particles", starRd)} — the stack-size consistency check did not run`;
      } else if (particleRefsFromContent(starText).length > 0) {
        // the star's CLUSTER-side home anchors star-relative refs (RELION's
        // star grammar resolves them against the process CWD — the project
        // root — while the mock's own dialect writes star-relative refs).
        // One formula both lanes share: the twin when the input runs in
        // place, else the mirror-mapped path the staging's upload rides —
        // the upload lane earns its star-dir candidates too (t343; it used
        // to anchor on the project root alone and could not judge the
        // star-relative dialect at all)
        const clusterStar = starRd.clusterHome;
        const starDir = clusterStar ? clusterStar.slice(0, clusterStar.lastIndexOf("/")) : null;
        const gate = await particlesRefGate(
          starPathLocal,
          starText,
          remoteHeaderSniffer(conn),
          (ref) => refCandidates(ref, remoteProjectRoot, starDir ?? remoteProjectRoot)
        );
        if (gate.refusal) {
          console.log(
            `remote-run: particle-ref gate REFUSED before staging — ${gate.refusal.split(" — ")[0]} (t338)`
          );
          return fail(gate.refusal, true);
        }
        particlesGateNote = gate.note + starLaneSuffix(starRd);
      }
    }
  }

  let needsStaging = false;
  for (const [key, localRaw] of Object.entries(resolvedInputs)) {
    const local = localRaw.split(path.sep).join("/");
    const twin = upstreamRemoteTwins.get(local);
    if (twin) continue; // already on the cluster (upstream ran there)
    if (!existsSync(localRaw)) {
      return fail(`input "${key}" does not exist locally: ${local} — run the upstream job first`);
    }
    const underMirror = local.startsWith(RELION_DIR.split(path.sep).join("/"));
    if (underMirror) {
      uploads.push({ key, local: localRaw, remote: mapLocalToRemote(localRaw, remoteRoot), external: false });
    } else {
      const hash = createHash("sha1").update(local).digest("hex").slice(0, 16);
      const remote = `${remoteRoot.replace(/\/$/, "")}/_staged/${hash}/${path.basename(localRaw)}`;
      uploads.push({ key, local: localRaw, remote, external: true });
    }
    needsStaging = true;
  }

  // STARs also reference files beyond the resolved inputs (the import case:
  // micrographs.star → the movie files, referenced ABSOLUTELY or PROJECT-
  // RELATIVELY) — stage those references too. Relative refs resolve against
  // the project root and upload to the SAME relative location on the cluster
  // (the wrapper cds into the remote project root, exactly like the local
  // engine's cwd contract).
  if (needsStaging) {
    const projectRootLocal = path.join(RELION_DIR, job.projectId);
    const projectRootRemote = `${remoteRoot.replace(/\/$/, "")}/${job.projectId}`;
    const seenRefs = new Set(uploads.map((u) => `${u.local}|${u.remote}`));
    for (const u of uploads) {
      if (!/\.star$/i.test(u.local) || u.external) continue;
      try {
        const refs = refsInStar(readFileSync(u.local, "utf8"), projectRootLocal);
        for (const ref of refs) {
          const refNorm = ref.localAbs.split(path.sep).join("/");
          if (upstreamRemoteTwins.has(refNorm)) continue;
          let remote: string;
          if (ref.kind === "rel") {
            remote = `${projectRootRemote}/${ref.raw}`;
          } else {
            const underMirror = refNorm.startsWith(RELION_DIR.split(path.sep).join("/"));
            remote = underMirror
              ? mapLocalToRemote(ref.localAbs, remoteRoot)
              : `${remoteRoot.replace(/\/$/, "")}/_staged/${createHash("sha1").update(refNorm).digest("hex").slice(0, 16)}/${path.basename(ref.localAbs)}`;
          }
          const dedupe = `${ref.localAbs}|${remote}`;
          if (seenRefs.has(dedupe)) continue;
          seenRefs.add(dedupe);
          uploads.push({
            key: `${u.key}:ref`,
            local: ref.localAbs,
            remote,
            external: ref.kind === "abs" && !refNorm.startsWith(RELION_DIR.split(path.sep).join("/")),
          });
          needsStaging = true;
        }
      } catch {
        /* unreadable star → the cluster will report the real problem */
      }
    }
  }

  // ---- t316 — the relink pass (cluster-native refs → project-relative) ----
  // runImportRemoteLeg's zero-upload design writes CLUSTER-ABSOLUTE rows into
  // micrographs.star (not one movie byte leaves the cluster) — but RELION's
  // pipeliner law is that STAR rows are PROJECT-RELATIVE: its runners build
  // scratch symlinks as `cwd + star-path`, so an absolute row concatenates
  // into `<workdir>//data06/...` and relion_run_ctffind dies inside
  // filename.cpp's symlink (the user's ticket, from==to the same string).
  // The fix mirrors the LOCAL engine's own convention (projectDirFor +
  // linkDirInto: star rows say `micrographs/<name>`): every cluster-native
  // ref gets a symlink at <remoteProjectRoot>/micrographs/<linkName> → its
  // cluster file, and every uploaded STAR is rewritten to the alias. RELION
  // runs with cwd = remoteWorkdir (two levels inside the project root), so
  // `micrographs/<name>` resolves; the data still never moves.
  const relinkRewrites: Array<{ from: string; to: string }> = [];
  let relinkLinks: Array<{ target: string; linkName: string }> = [];
  {
    const takenNames = new Map<string, string>(); // one link serves every STAR
    for (const u of uploads) {
      if (!/\.star$/i.test(u.local) || u.external) continue;
      try {
        const natives = remoteNativeRefs(readFileSync(u.local, "utf8"));
        if (natives.length === 0) continue;
        if (natives.length > RELINK_MAX) {
          return fail(
            `the input STAR names ${natives.length.toLocaleString()} cluster-side files — over the ${RELINK_MAX.toLocaleString()}-link ceiling (a runaway STAR, or an import wider than the door accepts) — re-import a narrower set`,
          );
        }
        const plan = planRelinks(natives, takenNames);
        relinkLinks = relinkLinks.concat(plan.links);
        relinkRewrites.push(...plan.rewrites);
      } catch {
        /* unreadable star → the cluster will report the real problem */
      }
    }
  }

  // ---- anti-ghost re-check (the dispatch race, t263) ---------------------
  // The pre-check above ran before several awaits (remote-root expansion).
  // A CONCURRENT dispatch — the dialog vs the auto-start passthrough — may
  // have landed a live record in that window; proceeding would clobber its
  // record (upsertRun overwrites by jobId) and swallow its fresh
  // "pending (staging)" row. Re-verify at the last serial point: any live
  // remote record we did NOT verify ourselves means someone else is
  // dispatching this job right now.
  {
    const inFlight = getRun(job.id);
    if (inFlight?.remote && inFlight.done === false && inFlight.startedAt !== prevStartedAt) {
      return {
        ok: false,
        busy: `a run for this job is already in flight on ${inFlight.remote.connectionName}${
          inFlight.remote.phase === "staging" ? " (inputs still staging)" : ""
        }`,
        busyKind: "live",
        job,
      };
    }
  }

  // ---- build the record + DB state --------------------------------------
  const startedAtMs = Date.now();
  // t323-a (review) + t333 — the re-run's stale GENERATION, local mirror:
  // the t318 pre-submit clear wipes the CLUSTER's run.out/run.err, but the
  // LOCAL mirror of a previous dispatch holds more than stale logs — the
  // sync-back's product copies (run_data.star, run_classes.mrcs, …) and
  // the old run.out/run.err itself. Left in place, finalize would read
  // the OLD run's stderr (the t323-a ghost-log) and the Files tab would
  // list files the new run never made. One walk + the shared fresh-start
  // classifier (t333): products, iterations, scratch and logs die; the
  // ledger manifest SURVIVES (the cluster-side wipe prunes it
  // entry-by-entry — deleting it here would blank the Files tab while
  // the cluster still holds the old outputs). Best-effort: a wipe
  // failure degrades silently, never a dispatch refusal (t323-a doctrine).
  try {
    const wipedMirror = wipeLocalRunProducts(localWorkdir);
    if (wipedMirror && wipedMirror.wiped.length > 0) {
      console.log(
        `remote-run: re-dispatch of "${job.name}" cleared ${wipedMirror.wiped.length} stale file(s) from the local mirror (t333)`
      );
    }
  } catch {
    /* never a dispatch refusal over a stale mirror */
  }
  const pendingPatch = needsStaging
    ? { status: "pending" as const, progress: 0, result: `Staging inputs to ${conn.host}${moduleName ? ` (${moduleName})` : ""}…` }
    : { status: "running" as const, progress: 0, result: null };
  const jobRow = await db.job.update({
    where: { id: job.id },
    data: { ...pendingPatch, startedAt: new Date(startedAtMs), duration: 60_000 },
  });

  const record: RunRecord = {
    jobId: job.id,
    projectId: job.projectId,
    type: job.type,
    pid: null,
    cmd: "(staging)",
    workdir: localWorkdir,
    logFile: path.join(localWorkdir, "run.out"),
    errFile: path.join(localWorkdir, "run.err"),
    startedAt: new Date(startedAtMs).toISOString(),
    outputs: {},
    done: false,
    exitCode: null,
    remote: remoteState,
  };
  upsertRun(job.id, record);

  // ---- the actual work (staging + spawn) --------------------------------
  // the heartbeat runs for the WHOLE task (staging phase only — the updateRun
  // guard no-ops once the phase flips) and is stopped on both exits.
  const stopBeat = startStagingBeat(job.id);
  // t341 — the ghost-sbatch fence (review C1, TEST 4's live proof): the
  // spawn is a void background task, and a reset/delete that lands while
  // it uploads used to be IGNORED — the task submitted its sbatch anyway
  // and then flipped the freshly-reset row BACK to running (no record,
  // no poller: a ghost). The run record is the single source of "this
  // dispatch is still wanted": reset/delete clear it, a concurrent
  // re-dispatch replaces it (different startedAt), the sweep can
  // finalize it (done). Every phase transition below re-checks this
  // predicate; a cancelled dispatch dies quietly — no submit, no row
  // write — and a cancellation detected AFTER the submit kills what it
  // submitted before standing down.
  const dispatchCancelled = (): boolean => {
    const rec = getRun(job.id);
    return !rec || rec.startedAt !== record.startedAt || rec.done;
  };
  const spawn = async (): Promise<void> => {
    try {
      // t335 — mop win32-mangled orphans out of the project root BEFORE
      // anything else touches the tree: a previous Windows-host dispatch
      // may have left whole-path literal filenames there (the misplaced
      // particles.star family). Moving them home lets the fresh-start
      // wipe below classify them with the stale products they are —
      // otherwise the junk lingers in the project root forever. Runs on
      // every dispatch (one SSH round, idempotent, usually a no-op).
      try {
        const mop = await mopWin32MangledOrphans(conn, remoteProjectRoot);
        if (mop.moved.length > 0) {
          console.log(
            `remote-run: moved ${mop.moved.length} win32-mangled orphan file(s) home on ${conn.host} (t335) — ${mop.moved
              .map((m) => m.slice(remoteProjectRoot.length + 1))
              .slice(0, 5)
              .join(", ")}${mop.moved.length > 5 ? ", …" : ""}`
          );
        }
        if (mop.failed.length > 0) {
          console.log(`remote-run: mop could NOT move ${mop.failed.length} orphan(s) on ${conn.host}: ${mop.failed.join(", ")}`);
        }
      } catch {
        /* best-effort mop — never a dispatch refusal over junk hygiene */
      }
      console.log(
        `remote-run: task alive — staging ${uploads.length} input file(s) for "${job.name}" to ${conn.host} (module ${moduleName || "none"})`
      );
      let stagedBytes = 0;
      // t269 — the staging leg's wall-clock cost: the ledger's first entry,
      // set when staging hands off to the spawn (visible in the inspector's
      // remote strip once the run is terminal).
      const stagedT0 = Date.now();
      // t316 — the relink pass rides FIRST: the symlinks must exist before
      // any rewritten STAR could be read on the other side (and before the
      // run starts). ln -sfn is idempotent, so a re-dispatch re-points.
      if (relinkLinks.length > 0) {
        console.log(
          `remote-run: relinking ${relinkLinks.length} cluster-native ref(s) under ${remoteProjectRoot}/micrographs — STAR rows ride project-relative (the RELION pipeliner law, t316)`
        );
        await ensureRemoteRelinks(conn, remoteProjectRoot, relinkLinks);
      }
      for (const u of uploads) {
        stagedBytes +=
          /\.star$/i.test(u.local) && !u.external && relinkRewrites.length > 0
            ? await stageStarWithRelinks(conn, u.local, u.remote, relinkRewrites)
            : await stageFileTree(conn, u.local, u.remote);
        if (u.external) rememberStage(u.local, u.remote);
        await updateRun(job.id, (rec) =>
          rec.remote && rec.startedAt === record.startedAt
            ? { ...rec, remote: { ...rec.remote, stagedBytes } }
            : null
        );
        // t341 — a reset/delete during the upload stops burning the wire:
        // GB-scale staging must not keep pushing into a workdir the user
        // just abandoned (and must never reach the submit below)
        if (dispatchCancelled()) {
          stopBeat();
          console.log(
            `remote-run: dispatch of "${job.name}" cancelled mid-staging (reset or delete) — upload stopped after ${stagedBytes} byte(s), nothing submitted (t341)`
          );
          return;
        }
      }
      const stagedMs = Date.now() - stagedT0;

      // ---- argv (cluster paths, cluster binary dir) ---------------------
      const relionHome = relionHomeFromProbe;
      const binDir = relionHome ? `${relionHome.replace(/\/$/, "")}/bin` : "<RELION_BIN>";
      const inputs: Record<string, string> = {};
      for (const [key, localRaw] of Object.entries(resolvedInputs)) {
        const local = localRaw.split(path.sep).join("/");
        inputs[key] = upstreamRemoteTwins.get(local) ?? (uploads.find((u) => u.key === key)?.remote ?? local);
      }

      // ---- t350 — the auto-joinstar path decision (multi-class selection) --
      // The single-class case resolved above points --i straight at the
      // class star's cluster twin. TWO OR MORE classes merge cluster-side
      // into <this workdir>/combined_input.star. Here we only DECIDE the
      // path (the argv needs the string); the merge itself runs AFTER the
      // pre-run wipe below — a .star in the workdir is exactly what the
      // fresh-run wipe classifies as a previous generation's product, and
      // merging before it handed RELION a freshly deleted input.
      let classStarCombine: { paths: string[]; out: string } | null = null;
      if (classStarTwinPaths.length >= 2 && inputs.particles_star) {
        classStarCombine = {
          paths: classStarTwinPaths,
          out: `${remoteWorkdir.replace(/\/+$/, "")}/combined_input.star`,
        };
        inputs.particles_star = classStarCombine.out;
      }

      // ---- t365 — the reference-sampling pre-flight (class3d/refine3d) --
      // Read the reference's own header and the particles' first optics
      // group IN PLACE (one stat + 1 KB + one awk — zero map bytes over
      // the wire). A mismatch prepares a sampling-matched copy ON the
      // cluster (the plan executes POST-wipe below, the t350 merge's own
      // ordering law: a file the wipe would kill cannot precede it); the
      // argv's --ref points at the prepared copy. Anything unreadable
      // degrades to a note — RELION's own check decides — except the two
      // certain deaths: a reference the job cannot read at all, and (in
      // the execution block) a preparation that fails its own header
      // verification.
      let refPrepare: RefPrepPlan | null = null;
      let refPrepNote: string | null = null;
      if (REF_SAMPLING_TYPES.has(job.type) && inputs.model_mrc && inputs.particles_star) {
        const refLocal = String(resolvedInputs.model_mrc ?? "").split(path.sep).join("/");
        const refCluster =
          upstreamRemoteTwins.get(refLocal) ??
          uploads.find((u) => u.key === "model_mrc")?.remote ??
          null;
        if (refCluster == null) {
          throw new Error(
            `the reference map has no cluster address — staging carried neither an upload nor a twin for ${resolvedInputs.model_mrc} to ${conn.host}; re-wire the reference input or re-run the upstream import (t365)`
          );
        }
        const starLocal = String(resolvedInputs.particles_star ?? "").split(path.sep).join("/");
        const opticsStar = classStarCombine
          ? classStarCombine.paths[0]
          : upstreamRemoteTwins.get(starLocal) ??
            uploads.find((u) => u.key === "particles_star")?.remote ??
            null;
        const userDrives = /--trust_ref_size|--ref_angpix/.test(String(params.extraArgs ?? ""));
        if (userDrives) {
          refPrepNote =
            "reference sampling pre-flight skipped — the extra args carry --trust_ref_size/--ref_angpix, you drive (t365)";
        } else {
          const probe = await probeRemoteMrcHeader(conn, refCluster);
          const optics = opticsStar
            ? await readOpticsSampling(conn, opticsStar)
            : { px: null, box: null, err: "the particles star has no cluster address" };
          if (probe.err) {
            refPrepNote = `reference sampling pre-flight did not run (the cluster probe of ${refCluster} failed: ${probe.err}) — RELION's own check decides (t365)`;
          } else if (probe.size == null) {
            throw new Error(
              `the reference map is not readable on ${conn.host} at ${refCluster} — relion would die reading --ref; re-wire the reference input or re-run the upstream import (t365)`
            );
          } else if (probe.header == null) {
            refPrepNote = `reference sampling pre-flight did not run (the map's 1024-byte header at ${refCluster} did not parse) — RELION's own check decides (t365)`;
          } else if (optics.px == null || optics.box == null) {
            refPrepNote =
              optics.err != null
                ? `reference sampling pre-flight did not run (the optics read of ${opticsStar} failed: ${optics.err}) — RELION's own check decides (t365)`
                : `reference sampling pre-flight did not run (no _rlnImagePixelSize/_rlnImageSize in the first optics group of ${opticsStar}) — RELION's own check decides (t365)`;
          } else {
            const h = probe.header;
            const refPx = h.cella[0] > 0 && h.nx > 0 ? h.cella[0] / h.nx : 0;
            const refBox = h.nx;
            const cubic = h.nx === h.ny && h.ny === h.nz;
            const iso =
              h.cella[0] > 0 && h.cella[1] > 0 && h.cella[2] > 0 &&
              Math.abs(h.cella[1] / h.ny - refPx) <= 0.01 * refPx &&
              Math.abs(h.cella[2] / h.nz - refPx) <= 0.01 * refPx;
            const pxOk = refPx > 0 && Math.abs(refPx - optics.px) / optics.px <= 0.005;
            const boxOk = refBox === optics.box;
            if (!cubic || !iso || refPx <= 0) {
              refPrepNote = `reference sampling pre-flight did not run (the map at ${refCluster} is ${
                !cubic ? `non-cubic (${h.nx}×${h.ny}×${h.nz})` : refPx <= 0 ? "missing cell sizes in its header" : "anisotropic in its header"
              }) — RELION's own check decides (t365)`;
            } else if (pxOk && boxOk) {
              refPrepNote = `reference verified in place — ${refBox}³ @ ${refPx.toFixed(4)} Å/px matches the particles' first optics group (t365)`;
            } else {
              // 方案 A: bring the REFERENCE to the particles' sampling —
              // the binned data keeps its honest footprint, the fine map
              // is downscaled (or, when the ref is coarser, interpolated
              // up) exactly as far as the job's own numbers demand
              const f = optics.px / refPx;
              const scale = pxOk
                ? null
                : Math.abs(f - Math.round(f)) <= 0.02
                  ? Math.round(f)
                  : Number(f.toFixed(4));
              const base =
                refCluster.slice(refCluster.lastIndexOf("/") + 1).replace(/\.(mrc|map)$/i, "") ||
                "reference";
              const pxTag = String(Number(optics.px.toFixed(4))).replace(".", "p");
              const out = `${remoteWorkdir.replace(/\/+$/, "")}/${base}_cf_${optics.box}box_${pxTag}.mrc`;
              refPrepare = { src: refCluster, out, dataPx: optics.px, dataBox: optics.box, refPx, refBox, scale };
              inputs.model_mrc = out;
              console.log(
                `remote-run: reference sampling mismatch on "${job.name}" — the map is ${refBox}³ @ ${refPx.toFixed(4)} Å/px, the particles' first optics group is ${optics.box} px @ ${optics.px} Å/px — preparing ${base} ON the cluster (t365)`
              );
            }
          }
        }
      }

      const built = await buildArgv({
        binDir,
        workdir: remoteWorkdir,
        inputs,
        job: jobRef,
        upstream,
        bridge: null,
        ctffindExe: moduleName ? conn.lastProbe?.relionCtffind?.[moduleName] ?? null : null,
        // t264: the cluster's OWN externals (probed after module load) —
        // a cluster argv must never resolve motioncor2/topaz on the LOCAL disk
        externals: moduleName ? conn.lastProbe?.externals?.[moduleName] ?? null : null,
      } as Parameters<typeof buildArgv>[0]);
      if ("error" in built) throw new Error(built.error);
      let argv = built as string[];

      // t335 — belt & suspenders: a Windows host's path.win32 (path.join,
      // path.resolve …) mangles any cluster-POSIX path a code path routes
      // through it into \data03\… — a single leading backslash, no drive
      // letter. The remote lane has no wsl-bridge translate to restore it
      // (the local bridged lane's wrapWslCommand does this for its own
      // world), so restore it HERE on the final argv the cluster script
      // will carry — whatever future leak feeds it. No legitimate argv
      // item starts with a lone backslash: flags start with --, values
      // are POSIX paths / numbers / C1-D2-style tokens, and Windows drive
      // paths (C:\) or UNC (\\…) forms never belong in a cluster argv.
      argv = argv.map((a) =>
        a.startsWith("\\") && !a.startsWith("\\\\") ? a.replace(/\\/g, "/") : a
      );

      // strip the placeholder prefix → bare names resolved by module PATH
      if (argv[0].startsWith("<RELION_BIN>/")) argv[0] = argv[0].slice("<RELION_BIN>/".length);

      // ---- GPU adaptation (cluster GPUs are probed, not assumed) --------
      // t297 — slurm mode: the GPUs live on the COMPUTE node the scheduler
      // grants, so the login-node nvidia-smi result is irrelevant — a GPU
      // strategy > 0 gets its flags, and the MPI width is the USER-chosen
      // gpuWidth (the sbatch6gpu.sh idiom: one rank per GPU). The multi-GPU
      // TYPE SET follows the scheduler-aware strategy (hpc/slurm.ts's
      // MULTI_GPU_TYPES — class2d/class3d/refine3d/initialmodel/multibody:
      // relion_refine_mpi splits particles across ranks), NOT the local
      // engine's narrower set (which mirrors sandbox constraints). Direct
      // mode keeps the probe-driven behavior untouched.
      const strategy = gpuStrategyFor(job.type, {
        micrographs: 10,
        particles: Number(params.particles ?? 5000) || 5000,
        ...(isSlurm ? { gpus: gpuWidth } : {}),
        // t320 — the LoG picker's CPU-only contract rides the strategy:
        // gpus → 0, so hasGpu/gresWidth below go quiet on their own
        logAutopick: logPick,
      });
      const multiGpuType = strategy.mode === "multi-gpu";
      const mpiParallelType = isSlurm ? multiGpuType : MPI_PARALLEL_TYPES.has(job.type);
      const hasGpu = isSlurm
        ? strategy.gpus > 0
        : (conn.lastProbe?.gpus?.length ?? 0) > 0;
      const mpiAvailable = moduleName ? conn.lastProbe?.relionMpi?.[moduleName] ?? false : false;

      let ntasks = 1;
      if (mpiParallelType && mpiAvailable) {
        // t360 — THE multi-writer fix. The argv names the SERIAL
        // relion_refine (buildArgv's dialect); under mpirun that is N
        // INDEPENDENT full refinements — the field report's exact shape:
        // six duplicated log streams (every process a printing
        // "master"), six uncoordinated truncate/write cycles shredding
        // every run_itNNN_classes.mrcs into right-sized zero-header
        // stacks not even Chimera can open, and a clean exit 0 because
        // every copy finished its own run. One MPI universe is the only
        // honest shape under mpirun: rank 0 the sole printing master,
        // workers silent, each file written once. The probe's mpirun
        // sighting (relionMpi) plus the script preflight's
        // relion_refine_mpi check guarantee the binary exists before
        // the first rank lands.
        if (/(^|\/)relion_refine$/i.test(argv[0])) {
          argv[0] = argv[0].replace(/relion_refine$/i, "relion_refine_mpi");
        }
        // t349 — RELION's own recommended width: one DEDICATED MASTER
        // (rank 0, CPU-only: data I/O, particle-batch dispatch, the
        // Maximization step's class reconstructions) plus one WORKER per
        // card (the Expectation step — ~85-90% of the runtime — is where
        // the GPUs earn their keep). The old lane ran n = width: rank 0
        // WAS the master and held a card slot it never touched (a RELION
        // master does no particle GPU work), so a 4-card job really
        // computed with 3. n = width + 1 puts a working rank on every
        // card — the user's own "mpirun -np 5 … --gpu 0:1:2:3" idiom,
        // made robust by the t345 launcher. Width 1 keeps the classic
        // single process: there is no split to make on one card.
        const nranks = isSlurm
          ? (gpuWidth >= 2 ? gpuWidth + 1 : 1)
          : job.type === "refine3d" ? 3 : 2;
        ntasks = nranks;
        argv = ["mpirun", "-n", String(nranks), ...argv];
        if (hasGpu && nranks > 1) argv.push("--gpu", Array.from({ length: nranks }, (_, i) => i).join(":"));
        else if (hasGpu) argv.push("--gpu", "0");
      } else {
        if (mpiParallelType) {
          // sequential fallback — mirrors the engine's no-mpirun path
          const splitIdx = argv.indexOf("--split_random_halves");
          if (splitIdx !== -1) {
            argv.splice(splitIdx, 1);
            argv.push("--debug_split_random_half", "1");
          }
          if (!argv.includes("--j")) {
            argv.push("--j", String(Math.max(1, Math.round(Number(params.threads ?? 4) || 4))));
          }
        }
        // t349 — SELF_GPU_FLAG_TYPES name their own gpu flag in the engine
        // argv (modelangelo's `-d`); the relion-style append would be a flag
        // that CLI has never heard of and the run dies at argv parse.
        if (
          hasGpu &&
          strategy.gpus > 0 &&
          !argv.includes("--gpu") &&
          !SELF_GPU_FLAG_TYPES.has(job.type)
        ) {
          argv.push("--gpu", "0");
        }
      }
      // t320 — belt-and-braces: a LoG Auto-picking argv must NEVER carry
      // --gpu, whatever future code path grows an append above (RELION's
      // autopicker.cpp dies at argv-parse on do_gpu && do_LoG — before the
      // first micrograph). The strategy zeroes gpus so the appends above
      // already stay quiet; this splice is the invariant itself, enforced
      // on the FINAL argv the script will carry.
      if (logPick) {
        const gi = argv.indexOf("--gpu");
        if (gi !== -1) argv.splice(gi, 2);
      }
      // slurm mode: the --gres width follows what the argv actually uses —
      // MPI rank count for MPI jobs, one GPU for single-GPU jobs, none for
      // CPU jobs (a CPU job that requests GPUs starves the GPU queue).
      const gresWidth = isSlurm
        ? mpiParallelType && mpiAvailable
          ? gpuWidth
          : hasGpu && strategy.gpus > 0
            ? 1
            : 0
        : 0;

      // t342/t345/t349 — the slurm MPI lane's rank count becomes the
      // SCRIPT's own variable (CF_RANKS = width + 1: the dedicated CPU
      // master rides along), clamped at launch to one worker per visible
      // GPU (see buildSbatchScript's t345/t349 block). t345: the
      // mpirun TARGET becomes the per-rank card launcher the script
      // writes (.cf-rank-launch.sh) — each WORKER rank gets its OWN
      // CUDA_VISIBLE_DEVICES and relion runs "--gpu 0" inside a
      // one-card world; rank 0 (the master) stays unpinned, exactly
      // RELION's recommended master+slaves shape (np = nGPU + 1). The
      // colon list ("--gpu 0:1:…") is RETIRED on this lane: two field
      // runs put every rank on device 0 through it (RELION builds
      // differ in how they parse it; the driver does not). Direct mode
      // keeps its literal — the login node's world is the probe's
      // world, no launcher lives there. A single-rank job never
      // pile-ups, so it keeps its literal too.
      const slurmMpiGpu = isSlurm && mpiParallelType && mpiAvailable && hasGpu && ntasks > 1;
      if (slurmMpiGpu) {
        const ni = argv.indexOf("-n");
        if (ni !== -1) {
          argv[ni + 1] = '"$CF_RANKS"';
          // the launcher rides BETWEEN mpirun's -n value and the relion
          // argv: mpirun -n "$CF_RANKS" <launcher> relion_refine …
          argv.splice(ni + 2, 0, `${remoteWorkdir}/.cf-rank-launch.sh`);
        }
        const gi = argv.indexOf("--gpu");
        if (gi !== -1) argv[gi + 1] = "0"; // this rank's own one visible card
      }
      // t342 — pre-quoted shell variable references ("$CF_RANKS" …) pass
      // the quoting maps untouched; every other token keeps its literal
      const shQuoteOrVar = (a: string) =>
        /^"\$[A-Za-z_][A-Za-z0-9_]*"$/.test(a) ? a : shQuote(a);

      // t306 — the array rewrite: the shard task sees $SHARD (its slice of
      // the input star) and $OSHARD (its own output subdir) — the two argv
      // slots are swapped for raw shell refs the script defines per task;
      // every other arg keeps its quoted literal. A rewrite that cannot
      // name its targets (no --i star, --o not the workdir root) refuses
      // the split honestly instead of submitting a script that would slice
      // the wrong file.
      let command: string;
      let arrayPlan: {
        total: number;
        concurrency: number;
        inputStar: string;
        outStar: string;
        merge: "star" | "rows" | "coords";
      } | null = null;
      if (shardTotal >= 2) {
        const flavor = ARRAY_FLAVORS[job.type];
        const ii = argv.indexOf("--i");
        const oi = flavor ? argv.indexOf(flavor.outArg) : -1;
        const inputStar = ii >= 0 ? String(argv[ii + 1] ?? "") : "";
        const outArg = oi >= 0 ? String(argv[oi + 1] ?? "") : "";
        // t307 — the expected output value per flavor: FILE-valued flags
        // (--part_star) point at the canonical star itself; DIR-valued
        // flags (--o, --odir) point at the workdir root and the canonical
        // star is whatever the binary writes INTO it. Keyed on the flag
        // kind, NOT on outStar being non-empty — t306's family regression
        // caught the first draft keying on outStar, which broke
        // motioncorr/ctffind (outStar names the MERGE's file, the --o
        // value stays the workdir root). extract's rows merge ALSO demands
        // the shared --part_dir: the ../ strip is only honest when every
        // shard's stacks land in the SAME canonical extra/ tree.
        const wantOut =
          flavor && flavor.outArg === "--part_star"
            ? remoteWorkdir + "/" + flavor.outStar
            : remoteWorkdir + "/";
        const pdi = flavor?.merge === "rows" ? argv.indexOf("--part_dir") : -1;
        const partDirOk = pdi < 0 || String(argv[pdi + 1] ?? "") === remoteWorkdir + "/";
        if (
          !flavor ||
          !inputStar.endsWith(".star") ||
          oi < 0 ||
          outArg !== wantOut ||
          !partDirOk
        ) {
          // inside the spawn task the honest exit is a THROWN error (the
          // catch below marks the record + row failed with this message) —
          // a return here could not reach the caller.
          throw new Error(
            `array split unavailable for "${job.type}": the command does not take one input STAR + an output the last task can merge (the shard slicing would target the wrong file)`
          );
        }
        // t334 — the slicer's block contract: the awk passes EVERY row of
        // data blocks BEFORE the second `data_` block to EVERY shard (how
        // the optics block reaches all shards) and round-robin splits the
        // rows of block ≥ 2. A single-block STAR (a hand-made list, an
        // old-dialect import) therefore hands EVERY micrograph to EVERY
        // shard — N processes writing the same per-mic outputs into the
        // shared tree at the same moment, the concurrent-writer collision
        // behind image.h:1534. Readable locally → refuse the split before
        // staging; twin-only → degrade with a note (the pre-t334 world).
        {
          const starText =
            extractStarText ??
            (resolved.inputs.micrographs_star && existsSync(resolved.inputs.micrographs_star)
              ? (() => {
                  try {
                    return readFileSync(resolved.inputs.micrographs_star, "utf8");
                  } catch {
                    return null;
                  }
                })()
              : null);
          if (starText != null) {
            const verdict = starIsArraySplittable(starText);
            if (!verdict.ok) {
              throw new Error(
                `array split unavailable for "${job.type}": the input STAR has a single data block (no separate optics block — ${verdict.dataRows} row(s) in ${verdict.blocks} block), so the round-robin slice would hand EVERY row to EVERY shard and the shards would write the same files at the same time — run with the Array split at 1 (a single job) instead`
              );
            }
          } else {
            console.log(
              `remote-run: array split block-check skipped — the input star stayed on the cluster (no local copy was synced)`
            );
          }
        }
        arrayPlan = {
          total: shardTotal,
          concurrency: ARRAY_CONCURRENCY,
          inputStar,
          outStar: flavor.outStar,
          merge: flavor.merge,
        };
        const outVal =
          flavor.outStar && flavor.outArg === "--part_star"
            ? `"$OSHARD/${flavor.outStar}"`
            : '"$OSHARD/"';
        command = argv
          .map((a, k) => (k === ii + 1 ? '"$SHARD"' : k === oi + 1 ? outVal : shQuoteOrVar(a)))
          .join(" ");
      } else {
        command = argv.map(shQuoteOrVar).join(" ");
      }
      const threads = Math.max(1, Math.min(32, Math.round(Number(params.threads ?? 4) || 4)));
      const jobName = `cf_${job.type}_${job.id.slice(-8)}`;

      await remoteMkdir(conn, remoteWorkdir);

      // ---- t341 — the stale-run reaper, scheduler-side -------------------
      // The ghost-sbatch race (review C1) and every un-witnessed death
      // before it can leave Slurm jobs that STILL own this workdir: a
      // PENDING duplicate, a requeued straggler, or a RUNNING rank pair
      // holding GPU memory the next dispatch then dies on (the field
      // report: 2D classification dead 30s in, CUDA out-of-memory, no
      // error tail — the allocator lost the race for a card someone
      // else's stale run still held). This job's sbatch name is unique
      // per job id (cf_<type>_<id8>), so scancel -n names EXACTLY this
      // workdir's stale submissions — the scheduler kills them wherever
      // they sit, BEFORE the wipe below reclaims the directory and the
      // fresh submission claims it. Best-effort hygiene: a refusal (no
      // matching job, an ancient scancel without -n) never blocks the
      // dispatch.
      if (isSlurm) {
        try {
          await exec(
            conn,
            `scancel -n ${shQuote(jobName)} 2>/dev/null || true`,
            { timeoutMs: 15_000 }
          );
        } catch {
          /* the reaper is hygiene, never a gate */
        }
      }

      // ---- t333 — the re-run's stale PRODUCTS on the cluster -------------
      // The workdir is STABLE across dispatches (<root>/<type>_<jobid8>)
      // and the previous generation's outputs survive in it. RELION writes
      // into whatever sits at its output paths — the field report: a
      // re-run of an extraction with a changed box size died at
      // image.h:1534 ("write: target and source objects have different
      // size") because the old .mrcs stacks were still there; a NEW job
      // (empty workdir) sailed. A fresh start now gets a fresh directory:
      // one LIVE listing (bypass the cache) → the shared fresh-start
      // classifier (the t331 keep-set's fresh-run dialect: input links,
      // note.txt, the manifest and anything UNRECOGNIZED survive;
      // products, ALL iterations, .cf-* scratch and the logs die) →
      // batched rm → empty-dir prune → the ledger pruned locally. A
      // listing failure degrades to a warn-and-proceed (the pre-t333
      // world — the submit re-tests the wire); an rm failure REFUSES the
      // dispatch: proceeding into stale files is the exact crash this
      // blade exists to kill.
      //
      // t344 — the rm's own budget: the second field report refused the
      // re-run with "batch 1: SSH failed (timeout after 30000ms)" on a
      // login node that had answered the LISTING one round earlier inside
      // 25s — the wire was fine, the deletion was merely SLOW (a loaded
      // head unlinking hundreds of stacks on network storage). The wipe
      // now carries a 3-minute-per-batch budget plus one fresh-wire
      // retry (deleteRemoteFiles's ladder: an SSH-level death re-dials
      // the pooled connection before re-running the idempotent rm -f).
      {
        const WIPE_RM_TIMEOUT_MS = 180_000;
        const wipeListing = await listRemoteWorkdir(conn, remoteWorkdir, {
          bypassCache: true,
          // t341 — read LIVE, don't PUBLISH: this listing photographs the
          // workdir mid-dispatch (pre-run and post-wipe states differ by
          // design); caching it would serve the cleanup plan a snapshot
          // the run already outgrew (the review's "plan is empty for 10s"
          // finding — a fresh dispatch's bypass listing used to land in
          // the shared cache and mute the plan GET for a whole TTL)
          publish: false,
        });
        if (!wipeListing.ok) {
          console.warn(
            `remote-run: could not list ${remoteWorkdir} for the pre-run wipe (${wipeListing.error ?? "unknown"}) — proceeding without it (a stale-file collision may fail the job, as before t333)`
          );
        } else if (wipeListing.entries.length > 0) {
          const { wipe: wipeRels } = classifyRerunWipe(wipeListing.entries);
          if (wipeRels.length > 0) {
            const rm = await deleteRemoteFiles(conn, remoteWorkdir, wipeRels, {
              timeoutMs: WIPE_RM_TIMEOUT_MS,
              retries: 1,
            });
            if (rm.errors.length > 0) {
              throw new Error(
                `could not clear the previous run's files on ${conn.host} (${rm.errors[0]}) — a re-run into stale outputs is refused (RELION would die writing into them). ` +
                  `The wipe waited out a ${Math.round(WIPE_RM_TIMEOUT_MS / 1000)}s budget per batch and retried once on a fresh connection; if it still fails, the login node is too slow or down right now — ssh in by hand and try again in a moment`
              );
            }
            await pruneRemoteEmptyDirs(conn, remoteWorkdir);
            dropRemoteListingCache(conn.id, remoteWorkdir);
            rewriteManifestAfterCleanup(localWorkdir, wipeRels);
            console.log(
              `remote-run: fresh dispatch of "${job.name}" cleared ${rm.deleted} stale product file(s) from ${remoteWorkdir} (t333)`
            );
          }
        }
      }

      // t318 — the re-run's ghost, blade 1: the workdir is STABLE across
      // dispatches (<root>/<type>_<jobid8>) and the PREVIOUS run's verdict
      // artifacts survive in it (the script's own `rm -f .cf-exit` runs
      // only when the job STARTS — seconds behind profile+module load, or
      // a whole queue wait). The poll reads .cf-exit EXISTENCE as the
      // verdict, so a stale file would forge the old verdict onto the new
      // dispatch (the t318 ticket: a re-run after a failed CTF finalized
      // "exit 1" while the fresh job was still loading modules — an empty
      // evidence tail, run.out "download failed" because the file GREW
      // during the sync's byte-account, and the real run kept going
      // unwatched). Clear the old verdict + logs BEFORE submission, and
      // stamp the CLUSTER's own clock as the dispatch fence (blade 2 —
      // aliveCheckScript refuses any .cf-exit older than it, for whatever
      // a future race leaks past this rm).
      const clearW = shQuote(remoteWorkdir);
      let fenceEpoch: number | null = null;
      try {
        const clearRes = await exec(
          conn,
          `rm -f ${clearW}/.cf-exit ${clearW}/.cf-pid ${clearW}/run.out ${clearW}/run.err ` +
            `${clearW}/.cf-array-rc-* ${clearW}/.cf-shard-*.star ${clearW}/.cf-merge.lock; date +%s`,
          { timeoutMs: 15_000 }
        );
        const t = clearRes.stdout.trim().split(/\r?\n/).pop() ?? "";
        if (/^\d{9,12}$/.test(t)) fenceEpoch = Number(t);
      } catch {
        /* the sweep's fence stays absent → the poll falls back to the
           pre-t318 contract (trust any .cf-exit) — never a dispatch
           refusal over a cleanup hiccup */
      }

      // ---- t365 — the reference auto-prepare, POST-wipe ------------------
      // The plan was decided before the argv build; the work happens HERE
      // (after the fresh-run wipe + the t318 clear, before any submission
      // door — the t350 merge's own ordering law: what the wipe would
      // classify as stale cannot precede it). Every step is verified by
      // the product's OWN header — the plan's arithmetic starts the work,
      // the header finishes the sentence. relion_image_handler's --scale
      // direction is a build dialect this code does not assume: one
      // inversion retry when the box moved the wrong way, then honesty.
      if (refPrepare) {
        const ih =
          binDir && binDir !== "<RELION_BIN>" ? `${binDir}/relion_image_handler` : "relion_image_handler";
        const q = (s: string) => shQuote(s);
        const runIH = async (args: string): Promise<string | null> => {
          try {
            const r = await exec(conn, `${q(ih)} ${args}`, { timeoutMs: 300_000 });
            if (r.error == null && (r.code == null || r.code === 0)) return null;
            return (
              (r.error ?? r.stderr ?? `ssh exit ${r.code}`).split("\n").filter(Boolean).slice(-1)[0] ??
              "no word from the cluster"
            );
          } catch (e) {
            return e instanceof Error ? e.message : String(e);
          }
        };
        const rmRemote = async (p: string): Promise<void> => {
          try {
            await exec(conn, `rm -f ${q(p)}`, { timeoutMs: 30_000 });
          } catch {
            /* idempotent hygiene — a failed rm surfaces at the next door */
          }
        };
        const wantBox = refPrepare.dataBox;
        const manual =
          `prepare the reference by hand (ssh to ${conn.host}: ${ih} --i ${refPrepare.src} --o <out>.mrc ` +
          `--scale ${refPrepare.refPx > 0 ? (refPrepare.dataPx / refPrepare.refPx).toFixed(4) : "?"}${wantBox ? ` --new_box ${wantBox}` : ""}), ` +
          `import that map, and wire it as the reference — or pass --trust_ref_size yourself`;
        const mismatchSentence = `${refPrepare.refBox}³ @ ${refPrepare.refPx.toFixed(4)} Å/px vs the particles' ${refPrepare.dataBox} px @ ${refPrepare.dataPx} Å/px`;
        let cur = refPrepare.src;
        let didScale = false;
        const scaleTmp = `${refPrepare.out}.cf-scale.mrc`;
        if (refPrepare.scale != null) {
          let attempt = refPrepare.scale;
          for (let tries = 0; ; tries++) {
            await rmRemote(scaleTmp);
            const why = await runIH(`--i ${q(refPrepare.src)} --o ${q(scaleTmp)} --scale ${attempt}`);
            if (why) {
              throw new Error(
                `relion_image_handler --scale ${attempt} failed on ${conn.host} (${why}) — the reference/particles sampling mismatch (${mismatchSentence}) is certain to fail RELION's own check at start — ${manual} (t365)`
              );
            }
            const scaled = await probeRemoteMrcHeader(conn, scaleTmp);
            if (scaled.header == null) {
              throw new Error(
                `the scaled reference at ${scaleTmp} did not verify (no MRC header came back) — ${manual} (t365)`
              );
            }
            const movedRight = attempt > 1 ? scaled.header.nx < refPrepare.refBox : scaled.header.nx > refPrepare.refBox;
            if (movedRight) break;
            if (tries === 0 && attempt !== 1) {
              // this build's --scale runs the other direction — one retry, inverted
              attempt = Number((1 / attempt).toFixed(4));
              continue;
            }
            throw new Error(
              `relion_image_handler --scale ${attempt} turned ${refPrepare.refBox}³ into ${scaled.header.nx}³ — neither direction matched (~${Math.max(1, Math.round(refPrepare.refBox / (refPrepare.dataPx / refPrepare.refPx)))}³ wanted) — ${manual} (t365)`
            );
          }
          cur = scaleTmp;
          didScale = true;
        }
        // the box pass — decided by the ACTUAL header, not the plan's arithmetic
        const midProbe = didScale
          ? await probeRemoteMrcHeader(conn, scaleTmp)
          : await probeRemoteMrcHeader(conn, refPrepare.src);
        const midBox = midProbe.header;
        if (
          midBox == null ||
          midBox.nx !== wantBox ||
          midBox.ny !== wantBox ||
          midBox.nz !== wantBox
        ) {
          const why = await runIH(`--i ${q(cur)} --o ${q(refPrepare.out)} --new_box ${wantBox}`);
          if (why) {
            throw new Error(
              `relion_image_handler --new_box ${wantBox} failed on ${conn.host} (${why}) — ${manual} (t365)`
            );
          }
          if (didScale) await rmRemote(scaleTmp);
        } else if (didScale) {
          // the scale pass alone landed the box — promote the temp to the argv's address
          try {
            const mv = await exec(conn, `mv -f ${q(scaleTmp)} ${q(refPrepare.out)}`, { timeoutMs: 60_000 });
            if (mv.error || (mv.code != null && mv.code !== 0)) {
              throw new Error(`could not move the prepared reference to ${refPrepare.out} (${mv.error ?? `ssh exit ${mv.code}`}) — ${manual} (t365)`);
            }
          } catch (e) {
            throw e instanceof Error && e.message.startsWith("could not move")
              ? e
              : new Error(`could not move the prepared reference to ${refPrepare.out} (${e instanceof Error ? e.message : String(e)}) — ${manual} (t365)`);
          }
        }
        // the FINAL verify: the product's own header must speak the data's sampling
        const finalProbe = await probeRemoteMrcHeader(conn, refPrepare.out);
        const fh = finalProbe.header;
        const finalPx = fh && fh.nx > 0 && fh.cella[0] > 0 ? fh.cella[0] / fh.nx : 0;
        if (
          fh == null ||
          fh.nx !== wantBox ||
          fh.ny !== wantBox ||
          fh.nz !== wantBox ||
          finalPx <= 0 ||
          Math.abs(finalPx - refPrepare.dataPx) / refPrepare.dataPx > 0.005
        ) {
          throw new Error(
            `the prepared reference at ${refPrepare.out} did not verify (got ${fh ? `${fh.nx}³ @ ${finalPx.toFixed(4)} Å/px` : "no MRC header"}, wanted ${wantBox}³ @ ${refPrepare.dataPx} Å/px) — ${manual} (t365)`
          );
        }
        const outName = refPrepare.out.slice(refPrepare.out.lastIndexOf("/") + 1);
        const steps = [
          refPrepare.scale != null ? `--scale ${refPrepare.scale}` : null,
          `--new_box ${wantBox}`,
        ]
          .filter(Boolean)
          .join(" then ");
        refPrepNote =
          `reference auto-prepared ON the cluster (t365): the imported map was ${mismatchSentence} — ` +
          `relion_image_handler ${steps} wrote ${outName} into this workdir (verified ${fh.nx}³ @ ${finalPx.toFixed(4)} Å/px by its own header); ` +
          `--ref points there, the original map is untouched, zero map bytes crossed the wire`;
        console.log(
          `remote-run: reference auto-prepared on ${conn.host} — ${refPrepare.refBox}³ @ ${refPrepare.refPx.toFixed(4)} → ${fh.nx}³ @ ${finalPx.toFixed(4)} Å/px (${outName}), the original map untouched (t365)`
        );
      }

      if (isSlurm) {
        // ---- t350 — the auto-joinstar merge, POST-wipe --------------------
        // The path decision happened at the argv build; the merge itself
        // lives HERE (after the fresh-run wipe + the t318 clear, before any
        // submission door) so the combined star cannot be wiped by the very
        // dispatch that just wrote it. One awk over stars that share the
        // cluster filesystem — no queue wait, no manual joinstar node (the
        // column headers must match, which the per-class stars of one
        // classification always do; a cross-layout mix refuses honestly).
        if (classStarCombine) {
          const merged = await combineClassStars(conn, classStarCombine.paths, classStarCombine.out);
          if (!merged.ok) {
            throw new Error(`auto-joinstar failed: ${merged.error ?? "no verdict"}`);
          }
          console.log(
            `remote-run: auto-joinstar merged ${classStarCombine.paths.length} class stars into ${classStarCombine.out} (${merged.rows} particles, t350)`
          );
        }

        // ---- t297: the sbatch door (sbatch6gpu.sh pattern) ---------------
        // t341 — the LAST fence before the scheduler hears about us: a
        // reset/delete that landed while the script uploaded must not
        // become a ghost sbatch into a workdir nobody owns anymore
        // (review C1's exact shape: submit after reset → row flipped
        // back to running with no record → a re-run double-writes).
        if (dispatchCancelled()) {
          stopBeat();
          console.log(
            `remote-run: dispatch of "${job.name}" cancelled before sbatch (reset or delete) — nothing submitted (t341)`
          );
          return;
        }
        // t304 — the pipeline handoff: upstream jobs still in flight on THIS
        // connection contribute their slurmIds to --dependency=afterok, so
        // the scheduler orders the pipeline (the child sits PENDING — the
        // sweep already speaks that word — instead of failing on inputs that
        // are not there yet). A finished parent's outputs are already synced
        // and staged; a failed one is the user's override. Staging-phase
        // parents have no scheduler id yet and cannot ride this door.
        const depIds: string[] = [];
        const parentIds = (
          await db.edge.findMany({ where: { toJobId: job.id }, select: { fromJobId: true } })
        ).map((e) => e.fromJobId);
        if (parentIds.length) {
          const runs = readRuns();
          for (const pid of parentIds) {
            const pr = runs[pid];
            if (
              pr?.remote && !pr.done && pr.remote.connectionId === conn.id &&
              pr.remote.slurmId != null
            )
              depIds.push(pr.remote.slurmId);
          }
        }
        const dependency = depIds.length ? `afterok:${depIds.join(":")}` : null;
        // t367 — the walltime this submission asks for. The refinement
        // family (multi-hour by construction) resolves the partition's own
        // MaxTime — the ceiling the controller always accepts — so the run
        // gets the partition's FULL allowance instead of its (often far
        // shorter) DEFAULT. The field report: a 20-round 2D classification
        // died at ~2h04, iteration 20's write phase never started, zero
        // error lines — the partition default killed it and nothing named
        // the cause. An explicit conn.slurmTimeMin wins; a partition that
        // cannot be resolved (bare node pin) degrades to the warn banner.
        const walltimePartition =
          partitionOverride ?? pinPartition ?? (explicitNode ? null : (conn.slurmPartition ?? null));
        const walltime = await resolveSbatchTimeLimit(conn, job.type, walltimePartition);
        const timeLimitMin = walltime.min;
        const timeLimitWarn = !timeLimitMin && WALLTIME_TYPES.has(job.type);
        // t369 — the partition's own DEFAULT time, when the probe read it:
        // the no-limit banner names the clock instead of gesturing at it.
        const timeLimitDefaultMin = walltime.defaultMin;
        if (timeLimitMin) {
          console.log(
            `remote-run: "${job.name}" requests --time=${slurmHms(timeLimitMin)} on ${conn.host}${walltimePartition ? ` (${walltimePartition})` : ""} (t367)`
          );
        } else if (timeLimitWarn) {
          console.log(
            `remote-run: no walltime resolved for "${job.name}" on ${conn.host} — the partition default${timeLimitDefaultMin ? ` (${slurmHms(timeLimitDefaultMin)})` : ""} applies (t367/t369)`
          );
        }
        const script = buildSbatchScript({
          conn,
          module: moduleName,
          relionHome,
          ctffind: moduleName ? conn.lastProbe?.relionCtffind?.[moduleName] ?? null : null,
          command,
          gpus: gresWidth,
          ntasks,
          threads,
          jobName,
          remoteProjectRoot,
          remoteWorkdir,
          // t340 — the pin's OWN resolved partition rides along (scontrol's
          // word for where that node lives), so the usage-list pin and the
          // group dropdown land the SAME composition. suppressPartition is
          // the honest residual: nobody knows the node's home → bare
          // --nodelist, no partition line, the default decides.
          partition: partitionOverride ?? pinPartition,
          ...(explicitNode && partitionOverride == null && pinPartition == null
            ? { suppressPartition: true }
            : {}),
          nodelist: nodelistPin,
          dependency,
          array: arrayPlan,
          note: [ctffindGateNote, extractGateNote, particlesGateNote, refPrepNote].filter(Boolean).join(" · ") || null,
          // t367 — the resolved walltime (+ the no-limit warning flag for
          // refinement-family jobs that could not resolve one)
          timeLimitMin,
          ...(timeLimitWarn ? { timeLimitWarn: true } : {}),
          ...(timeLimitDefaultMin != null ? { timeLimitDefaultMin } : {}),
          // t342/t345 — the starved-card refusal + the rank clamp ride only
          // jobs whose argv truly uses the GPU; the MPI width feeds the
          // script's own CF_RANKS clamp + per-rank launcher variables.
          // t349 — SELF_GPU_FLAG_TYPES use the GPU through their OWN flag
          // (modelangelo's `-d`): no `--gpu` token in the argv, but the card
          // is just as load-bearing — they earn the same pin + refusal.
          gpuJob:
            hasGpu &&
            strategy.gpus > 0 &&
            (argv.includes("--gpu") || SELF_GPU_FLAG_TYPES.has(job.type)),
          mpiRanks: slurmMpiGpu ? ntasks : null,
        });
        const scriptPath = `${remoteWorkdir}/.cf-sbatch.sh`;
        const upOk = await remoteUpload(conn, script, scriptPath);
        if (!upOk) throw new Error(`could not upload the sbatch script to ${scriptPath}`);
        const subRes = await exec(conn, `sbatch ${shQuote(scriptPath)}`, { timeoutMs: 30_000 });
        const idMatch = /Submitted batch job (\d+)/.exec(subRes.stdout);
        if (!idMatch) {
          // t311 — the exec channel is a LOGIN shell (bash -lc), so the
          // user's own ~/.bashrc noise rides stderr alongside Slurm's
          // verdict (observed live: "/data2/home/…/.bashrc: line 35: …:
          // No such file or directory" printed BEFORE the real errors, and
          // it reads like the submission failed because of it). Split the
          // streams: Slurm's own lines are the answer; the rest is named
          // for what it is so the user fixes their .bashrc, not us.
          const errLines = (subRes.stderr || "")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          const slurmLines = errLines.filter((l) => /^sbatch:|^slurm/i.test(l));
          const noiseLines = errLines.filter((l) => !slurmLines.includes(l));
          const why = (
            slurmLines.join(" · ") ||
            errLines.join(" · ") ||
            (subRes.stdout || "").trim() ||
            subRes.error ||
            `ssh exit ${subRes.code}`
          ).slice(0, 400);
          // t337 — the controller's one-liner TRANSLATED: "Requested node
          // configuration is not available" names no cause, and the user's
          // receipt was exactly that silence. Say what THIS submission
          // asked for (the pin, the partition, the GPU width the script
          // actually carries) and the three moves that fix it. The pre-
          // flight above closes the knowable cases; this covers the drift
          // window (a node that went down between the pre-flight read and
          // the controller's own decision) and foreign compositions the
          // app did not build.
          // t340 — the translation mirrors the builder's resolution: the
          // pin's own partition when it was resolved, nothing when it was
          // not (the default decided), the picked/connection default
          // otherwise.
          const effectivePartition =
            nodelistPin && partitionOverride == null
              ? pinPartition
              : (partitionOverride ?? conn.slurmPartition ?? null);
          const composition = [
            nodelistPin ? `node ${nodelistPin}` : null,
            effectivePartition ? `partition ${effectivePartition}` : null,
            gresWidth > 0 ? `${gresWidth} GPU(s)` : "no GPUs",
          ]
            .filter(Boolean)
            .join(" · ");
          // t340 — a composition with NO partition is its own diagnosis:
          // the submission named none, so the cluster's DEFAULT
          // partition decided, and the node/width must live THERE. The
          // pre-flight resolves the pin's own partition now, so this
          // residual names the two honest leftovers — a node neither
          // scontrol nor the probe knows, or the bare-API shape.
          const noPartitionNote =
            nodelistPin != null && effectivePartition == null
              ? " The submission named no partition (the node's home is unknown to scontrol and the probe), so the cluster's DEFAULT partition decided — pick the node's group in the run dialog's Node/partition dropdown to name it."
              : "";
          const cfgHelp = /node configuration is not available/i.test(why)
            ? ` — what was requested: ${composition}. No node on the cluster can satisfy that combination right now (a pinned node may be down, drained, or narrower than the GPU width, or it may not live in the partition the request landed on). Pick a different node in the live usage list, click the pinned row again to release the pin, or lower the GPU width.${noPartitionNote}`
            : "";
          const noiseNote =
            noiseLines.length > 0
              ? ` · login-shell noise from the cluster (your ~/.bashrc, not the submission): ${noiseLines.join(" · ").slice(0, 200)}`
              : "";
          throw new Error(`sbatch refused the submission: ${why}${cfgHelp}${noiseNote}`);
        }
        const slurmId = idMatch[1];

        // t341 — cancelled BETWEEN the pre-check and the controller's
        // answer? The sbatch exists now; kill it before standing down —
        // an orphaned PENDING/RUNNING job in a workdir whose owner row
        // says idle is exactly the ghost this fence exists for.
        if (dispatchCancelled()) {
          try {
            await exec(conn, `scancel ${shQuote(slurmId)} 2>/dev/null || true`, { timeoutMs: 15_000 });
          } catch {
            /* best effort — the orphan sweep reconciles the rest */
          }
          stopBeat();
          console.log(
            `remote-run: dispatch of "${job.name}" was cancelled as sbatch ${slurmId} landed — scancel'd, the row stays untouched (t341)`
          );
          return;
        }

        await updateRun(job.id, (rec) =>
          rec.startedAt === record.startedAt && rec.remote
            ? {
                ...rec,
                cmd: command,
                remote: {
                  ...rec.remote,
                  slurmId,
                  slurmState: "PENDING",
                  ...(depIds.length ? { slurmDependsOn: depIds } : {}),
                  ...(arrayPlan ? { slurmArray: { total: arrayPlan.total, concurrency: arrayPlan.concurrency } } : {}),
                  // t318 — the dispatch fence (cluster clock) rides the
                  // record the moment the submission owns the workdir.
                  ...(fenceEpoch != null ? { dispatchedAtEpoch: fenceEpoch } : {}),
                  phase: "running",
                  stagedBytes,
                  stagedMs,
                },
              }
            : null
        );
        // t341 — the flip is CONDITIONAL: only a row still in its dispatch
        // lifecycle (pending=staging / running=sync spawn) may be told the
        // submission landed. A row the user reset to idle (or deleted and
        // restored, or that a cancel path already failed) must stay as the
        // user left it — the old unconditional update was the ghost's
        // second face (the row flipped BACK to running with no record).
        await db.job.updateMany({
          where: { id: job.id, status: { in: ["pending", "running"] } },
          data: { status: "running", progress: 0, result: null, startedAt: new Date(startedAtMs) },
        });
        stopBeat();
        console.log(
          `remote-run: ${job.type} "${job.name}" submitted to Slurm on ${conn.name} (job ${slurmId}, ${gresWidth > 0 ? `${gresWidth} GPU(s)` : "CPU"}${(partitionOverride ?? pinPartition) ? ` · partition ${partitionOverride ?? pinPartition}` : ""}${nodelistPin ? ` · node ${nodelistPin}` : ""}${depIds.length ? ` · afterok ${depIds.join(",")}` : ""}${arrayPlan ? ` · array 1-${arrayPlan.total}%${arrayPlan.concurrency}` : ""}, module ${moduleName || "none"})`
        );
      } else {
        // ---- direct mode: the setsid wrapper (unchanged contract) --------
        const wrapper = buildWrapperScript({
          conn,
          module: moduleName,
          relionHome,
          ctffind: moduleName ? conn.lastProbe?.relionCtffind?.[moduleName] ?? null : null,
          command,
          remoteProjectRoot,
          remoteWorkdir,
          note: [ctffindGateNote, extractGateNote, particlesGateNote, refPrepNote].filter(Boolean).join(" · ") || null,
        });

        const wrapperPath = `${remoteWorkdir}/.cf-run.sh`;
        const upOk = await remoteUpload(conn, wrapper, wrapperPath);
        if (!upOk) throw new Error(`could not upload the run script to ${wrapperPath}`);

        // t341 — the direct lane's own pre-spawn fence (the slurm lane
        // checks at its own door above)
        if (dispatchCancelled()) {
          stopBeat();
          console.log(
            `remote-run: dispatch of "${job.name}" cancelled before spawn (reset or delete) — nothing launched (t341)`
          );
          return;
        }

        const runRes = await exec(conn, `bash ${shQuote(wrapperPath)}`, { timeoutMs: 30_000 });
        const pidMatch = /CRYOFLOW_PID:(\d+)/.exec(runRes.stdout);
        if (!pidMatch) {
          const why =
            runRes.stderr.trim().slice(0, 400) ||
            runRes.stdout.trim().slice(0, 400) ||
            runRes.error ||
            `ssh exit ${runRes.code}`;
          throw new Error(`the cluster refused to start the job: ${why}`);
        }
        const pid = Number(pidMatch[1]);

        // t341 — cancelled as the wrapper answered? Kill the process
        // group (the wrapper setsid's, so -PID is the group) before
        // standing down — a live cluster process whose owner row says
        // idle is the direct-mode ghost.
        if (dispatchCancelled()) {
          try {
            await exec(
              conn,
              `kill -TERM -- -${pid} 2>/dev/null; sleep 1; kill -KILL -- -${pid} 2>/dev/null; true`,
              { timeoutMs: 15_000 }
            );
          } catch {
            /* best effort — the orphan sweep reconciles the rest */
          }
          stopBeat();
          console.log(
            `remote-run: dispatch of "${job.name}" was cancelled as cluster pid ${pid} spawned — killed, the row stays untouched (t341)`
          );
          return;
        }

        await updateRun(job.id, (rec) =>
          rec.startedAt === record.startedAt && rec.remote
            ? {
                ...rec,
                pid,
                cmd: command,
                remote: {
                  ...rec.remote,
                  pid,
                  // t318 — same fence for the direct wrapper's world.
                  ...(fenceEpoch != null ? { dispatchedAtEpoch: fenceEpoch } : {}),
                  phase: "running",
                  stagedBytes,
                  stagedMs,
                },
              }
            : null
        );
        // t341 — same conditional flip as the slurm lane above
        await db.job.updateMany({
          where: { id: job.id, status: { in: ["pending", "running"] } },
          data: { status: "running", progress: 0, result: null, startedAt: new Date(startedAtMs) },
        });
        stopBeat();
        console.log(
          `remote-run: ${job.type} "${job.name}" spawned on ${conn.name} (pid ${pid}, module ${moduleName || "none"})`
        );
      }
    } catch (e) {
      stopBeat();
      const msg = e instanceof Error ? e.message : String(e);
      // t341 — a CANCELLED dispatch's failure is not the row's business:
      // the user reset/deleted it mid-staging and the row already says
      // so — writing "remote run failed" over their reset (or a delete's
      // successor) was the ghost race's failure-path twin. Only a live
      // dispatch of ours may fail the row.
      if (dispatchCancelled()) {
        console.log(
          `remote-run: cancelled dispatch of "${job.name}" failed during staging (${msg}) — the row stays untouched (t341)`
        );
        return;
      }
      // finalize the record (done=true) — a !done record would otherwise be
      // polled by the heal path forever with no pid and no exit file
      await updateRun(job.id, (rec) =>
        rec.startedAt === record.startedAt && rec.remote
          ? {
              ...rec,
              done: true,
              exitCode: -1,
              result: `remote run failed: ${msg}`.slice(0, 900),
              remote: { ...rec.remote, note: msg.slice(0, 300) },
            }
          : null
      );
      await updateJobWithRetry(job.id, {
        status: "failed",
        progress: 0,
        result: `remote run failed: ${msg}`.slice(0, 900),
      });
      console.error(`remote-run: ${job.type} "${job.name}" failed to start:`, msg);
    }
  };

  if (needsStaging) {
    // background: the route already answered "pending (staging)" — this task
    // uploads (possibly GBs) and flips the DB itself when the spawn lands
    void spawn();
    return { ok: true, staging: true, job: jobRow };
  }
  await spawn();
  const finalRow = await db.job.findUnique({ where: { id: job.id } });
  if (finalRow && finalRow.status === "failed") {
    const rec = getRun(job.id);
    return fail(rec?.result?.replace(/^remote run failed: /, "") ?? "remote spawn failed");
  }
  return { ok: true, started: true, job: finalRow ?? jobRow };
}

/* ------------------------------------------------------------------ */
/* Polling (batched per connection)                                    */
/* ------------------------------------------------------------------ */

type PollVerdict = "alive" | "exit" | "vanished" | "unknown" | "busy" | "staging";

/** Inspect ONE record (used by the pre-spawn guard). */
async function pollOneRemote(conn: RemoteConnection, rec: RunRecord): Promise<PollVerdict> {
  const r = rec.remote;
  if (!r) return "unknown";
  if (r.phase === "staging") return "staging";
  // t318 — the fence rides here too: the pre-spawn guard asks "is the
  // cluster still busy with this workdir?" and a stale .cf-exit from a
  // PREVIOUS dispatch must answer through the same gated door as the
  // sweep (stale → the ladder: squeue/sacct say whether anything is live).
  const script = aliveCheckScript(r.remoteWorkdir, r.slurmId, r.dispatchedAtEpoch);
  const res = await exec(conn, script, { timeoutMs: 10_000 });
  if (res.error) return res.error === "busy" ? "busy" : "unknown";
  if (/^EXIT:/m.test(res.stdout)) return "exit";
  if (/^ALIVE/m.test(res.stdout)) return "alive";
  // t299 — the scheduler's terminal verdict is an exit: the script only
  // emits SACCT: for accounting words that ended the run, so the pre-spawn
  // guard can treat the record as finished (the sweep does the finalize)
  if (/^SACCT:/m.test(res.stdout)) return "exit";
  if (/^VANISHED/m.test(res.stdout)) return "vanished";
  return "unknown";
}

/**
 * The alive-check snippet shared by the single poll + the batch sweep:
 * EXIT:<code> when the wrapper wrote its exit file; for DIRECT runs ALIVE
 * only when the recorded pid AND its /proc starttime (field 22) still match
 * (recycled pids can never fake liveness), VANISHED otherwise; for SLURM
 * runs (t297) the scheduler is the witness — squeue still knowing the job
 * means queued/running/completing, and the state word rides the line
 * (ALIVE:PENDING / ALIVE:RUNNING) so the UI can say "queued" honestly.
 * t299 — squeue purges finished jobs almost immediately, so a vanished
 * .cf-exit (NFS lag, node gone mid-write) used to fall straight through to
 * VANISHED and age into a false "interrupted remotely" failure. The third
 * witness closes that hole: sacct serves the controller's OWN terminal
 * verdict (COMPLETED/FAILED/CANCELLED/TIMEOUT/…) from the accounting
 * ledger — terminal words ride out as SACCT:<state>|<exit>:<sig> for the
 * sweep to map onto the exit contract, in-flight words (rare accounting
 * lag) stay ALIVE, and an empty verdict (no accounting row either) is the
 * only thing still allowed to mean VANISHED.
 */

/**
 * t303 — the scheduler's stopwatch dialect: Elapsed as sacct prints it
 * ([[DD-]hh:]mm:ss — under an hour it is mm:ss, over a day it carries the
 * day prefix) → ms. Anything else stays null: an unparseable column is
 * silence, never a guess.
 */
function parseSlurmElapsed(s?: string): number | null {
  if (!s) return null;
  const t = s.trim();
  let days = 0;
  let rest = t;
  const dm = /^(\d+)-(.*)$/.exec(t);
  if (dm) {
    days = Number(dm[1]);
    rest = dm[2];
  }
  const p = rest.split(":").map(Number);
  if (p.length < 2 || p.length > 3 || p.some((n) => !Number.isFinite(n))) return null;
  const [h, m, sec = 0] = p.length === 3 ? p : [0, p[0], p[1]];
  return ((days * 24 + h) * 3600 + m * 60 + sec) * 1000;
}

/**
 * t303 — the scheduler's meter dialect: MaxRSS as sacct prints it (a number
 * with an optional K/M/G/T suffix, bare = KiB) → bytes. Empty (the common
 * case when accounting TRES usage is off) stays null.
 */
function parseSlurmMaxRss(s?: string): number | null {
  if (!s) return null;
  const m = /^([\d.]+)([KMGT])?$/.exec(s.trim());
  if (!m) return null;
  const mult = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }[m[2] ?? "K"] ?? 1024;
  return Math.round(Number(m[1]) * mult);
}

/**
 * t303 — one terminal accounting row ("STATE|exit:sig|Elapsed|MaxRSS", real
 * sacct's "CANCELLED by <uid>" tolerated) → its parts. The Elapsed/MaxRSS
 * columns are optional: a ledger that never served them parses the same
 * three-lead row it always did.
 */
function parseSacctRow(raw: string): {
  word: string;
  exitNum: number;
  sigNum: number;
  elapsedMs: number | null;
  maxRssBytes: number | null;
} | null {
  const m = /^([A-Z_]+)(?:\s+by\s+\d+)?\|(\d+):(\d+)(?:\|([^|]*)\|([^|]*))?/.exec(raw.trim());
  if (!m) return null;
  return {
    word: m[1],
    exitNum: Number(m[2]),
    sigNum: Number(m[3]),
    elapsedMs: parseSlurmElapsed(m[4]),
    maxRssBytes: parseSlurmMaxRss(m[5]),
  };
}

/**
 * t303 — the ledger's stopwatch + meter onto the record. Fired from BOTH
 * exit paths (the wrapper's EXIT with the sacct line riding along, and the
 * SACCT-fallback verdict itself); never overwrites a done record, and only
 * writes when there is something new to say (the state word moved, or a
 * column the record does not carry yet).
 */
function persistSacctTestimony(
  e: BatchEntry,
  row: NonNullable<ReturnType<typeof parseSacctRow>>,
  includeWord: boolean
): void {
  if (e.remote.slurmId == null) return;
  const patch: Partial<RemoteRunState> = {};
  if (includeWord && e.remote.slurmState !== row.word) patch.slurmState = row.word;
  if (row.elapsedMs != null && e.remote.slurmElapsedMs == null) patch.slurmElapsedMs = row.elapsedMs;
  if (row.maxRssBytes != null && e.remote.slurmMaxRssBytes == null) patch.slurmMaxRssBytes = row.maxRssBytes;
  if (Object.keys(patch).length === 0) return;
  Object.assign(e.remote, patch);
  updateRun(e.job.id, (rec) =>
    rec.remote && !rec.done ? { ...rec, remote: { ...rec.remote, ...patch } } : null
  );
}

/**
 * t305 — does the ledger's terminal word tell the SAME story as the
 * wrapper's exit? The mapping is the fallback's OWN exit contract
 * (CANCELLED→143, TIMEOUT→124, exit/sig otherwise): agreement means the
 * scheduler's word may decorate the record (and the strip's
 * '· Slurm COMPLETED' finally speaks on the happy path — t299's terminal
 * word used to be fallback-only, nearly dead code). A disagreement (a
 * scancel landing in the script's final breath, a wrapper that survived a
 * TIMEOUT kill) keeps the word silent: the wrapper's exit is the verdict,
 * the word is vocabulary, and the strip never renders a contradiction.
 */
function wordAgreesWithExit(
  row: NonNullable<ReturnType<typeof parseSacctRow>>,
  exitCode: number
): boolean {
  const mapped =
    row.word === "CANCELLED"
      ? 143
      : row.word === "TIMEOUT"
        ? 124
        : row.exitNum !== 0
          ? row.exitNum
          : row.sigNum !== 0
            ? 128 + row.sigNum
            : 0;
  return mapped === exitCode;
}

function aliveCheckScript(
  remoteWorkdir: string,
  slurmId?: string | null,
  /**
   * t318 — the dispatch fence (cluster-clock epoch seconds, see
   * RemoteRunState.dispatchedAtEpoch). When present, an existing .cf-exit
   * is only TRUSTED as this dispatch's verdict when its mtime is ≥
   * fence−2s; an older file is the PREVIOUS run's leftover and the check
   * falls through to the honest ladder (ALIVE / SACCT / VANISHED)
   * instead of forging the old verdict onto the fresh dispatch.
   * Undefined (legacy records) → trust any .cf-exit, the pre-t318
   * contract.
   */
  fenceEpoch?: number
): string {
  const W = shQuote(remoteWorkdir);
  const EXIT = shQuote(remoteWorkdir + "/.cf-exit");
  // the stale gate: __ex starts as "the exit file exists" and is demoted
  // to 0 when the file predates this dispatch. stat's failure (vanished
  // between -f and stat) reads as 0 → demoted → the ladder speaks — a
  // vanished exit file was never a verdict anyway. The 2s grace absorbs
  // filesystem mtime granularity against the fence captured moments
  // before submission.
  const staleGate =
    fenceEpoch != null && Number.isFinite(fenceEpoch)
      ? `__ex=0; [ -f ${EXIT} ] && __ex=1; ` +
        `[ "$__ex" = "1" ] && [ "$(stat -c %Y ${EXIT} 2>/dev/null || echo 0)" -lt ${Math.max(0, Math.floor(fenceEpoch) - 2)} ] && __ex=0; `
      : `__ex=0; [ -f ${EXIT} ] && __ex=1; `;
  if (slurmId) {
    const J = shQuote(String(Number(slurmId)));
    // t303 — the query grew the scheduler's stopwatch and meter (Elapsed,
    // MaxRSS); both branches speak the same 4-column grammar so the verdict
    // and its ledger line arrive in ONE SSH round trip. A TEMPLATE literal —
    // the first draft used a plain string and ${J} shipped LITERALLY into
    // the shell script, where set -u doomed every $() to an empty verdict
    // (VANISHED for jobs the ledger knew all about — the t302 suite's live
    // C-phase caught what the source assertions could not).
    const AC = `sacct -j ${J} -n -P -o State,ExitCode,Elapsed,MaxRSS 2>/dev/null | head -1`;
    // t318 — the ladder (squeue → sacct) now serves BOTH the no-exit-file
    // case AND the stale-exit case: a .cf-exit older than the fence is the
    // previous run's ghost and must not speak for this dispatch.
    const ladder =
      `__st="$(squeue -j ${J} -h -o %T 2>/dev/null | head -1)"; ` +
      `if [ -n "$__st" ]; then echo "ALIVE:$__st"; ` +
      `else __ac="$(${AC})"; ` +
      `case "$__ac" in ` +
      `PENDING*|RUNNING*|COMPLETING*) echo "ALIVE:${"${"}__ac%%|*}" ;; ` +
      `COMPLETED*|FAILED*|CANCELLED*|TIMEOUT*|NODE_FAIL*|BOOT_FAIL*|OUT_OF_*|PREEMPTED*|DEADLINE*|SPECIAL_EXIT*) echo "SACCT:$__ac" ;; ` +
      `*) echo VANISHED ;; esac; fi`;
    return (
      staleGate +
      `if [ "$__ex" = "1" ]; then echo "EXIT:$(cat ${EXIT} 2>/dev/null)"; ` +
      // t303 — the wrapper's exit usually wins the race, but the ledger's
      // stopwatch rides ALONG: a terminal accounting row (and only a
      // terminal one — accounting lag must never fake a verdict) is echoed
      // as a second line for the block parser to stow.
      `__ac="$(${AC})"; case "$__ac" in ` +
      `COMPLETED*|FAILED*|CANCELLED*|TIMEOUT*|NODE_FAIL*|BOOT_FAIL*|OUT_OF_*|PREEMPTED*|DEADLINE*|SPECIAL_EXIT*) echo "SACCT:$__ac" ;; esac; ` +
      `else ${ladder}; fi`
    );
  }
  return (
    staleGate +
    `__ps="$(cat ${W}/.cf-pid 2>/dev/null)"; __p="${'${'}__ps%% *}"; __st="${'${'}__ps##* }"; ` +
    `if [ "$__ex" = "1" ]; then echo "EXIT:$(cat ${EXIT} 2>/dev/null)"; ` +
    `elif [ -n "$__p" ] && [ -r "/proc/$__p/stat" ] && [ "$(awk '{print \$22}' /proc/$__p/stat 2>/dev/null)" = "$__st" ] && kill -0 "$__p" >/dev/null 2>&1; then echo ALIVE; ` +
    `else echo VANISHED; fi`
  );
}

/** Per-connection poll throttle state (survives within one server process). */
const pollState = new Map<string, { at: number; inflight: boolean; lastMs: number }>();

/**
 * t346 — how long a single sweep's SSH round trip may take. Was 15s: the
 * t345 field ticket proved a mere `cat` on the user's login node can exceed
 * that (exec = sshd fork + shell + slow /data03), so the sweep itself timed
 * out whenever the login node hiccuped — and with it every UI request that
 * awaited it. 45s with the route's bounded wait (the GET never blocks on
 * the sweep longer than POLL_SWEEP_WAIT_MS) covers the slowest login node
 * without stacking round trips (the inflight guard does that).
 */
const POLL_SWEEP_TIMEOUT_MS = 45_000;

/**
 * t346 — the VANISHED flip's streak requirement. The ladder's empty
 * squeue+sacct snapshot used to speak ALONE after the 120s age gate: one
 * wire blink, one slow scheduler, one accounting purge — and a RUNNING
 * job's row died as "interrupted remotely (node reboot or hard kill)"
 * while the cluster process was fine. The flip now needs N CONSECUTIVE
 * VANISHED verdicts; any ALIVE/EXIT/SACCT word resets the streak. Env
 * knobs exist for the E2E suites (small values) — production keeps the
 * defaults.
 */
const VANISH_STREAK_N = Math.max(1, Number(process.env.CF_VANISH_STREAK) || 3);
const VANISH_AGE_MS = Math.max(1_000, Number(process.env.CF_VANISH_AGE_MS) || 120_000);

interface BatchEntry {
  job: Job;
  rec: RunRecord;
  /** non-null by construction (entries are filtered on rec.remote) */
  remote: RemoteRunState;
}

/**
 * The remote poll sweep — the twin of reconcileRealJobs. Called by the jobs
 * GET route on every poll tick: one batched SSH round trip per connection
 * covers ALL of its running jobs (state + log tail), then completions
 * finalize (sync-back → collectOutputs → DB flip → downstream auto-start).
 *
 * Records for jobs whose DB row is no longer "running" still get finalized
 * (sync-back + done flag) — the heal path for stop/restart races.
 */
export async function reconcileRemoteJobs(jobs: Job[]): Promise<Job[]> {
  const runs = readRuns();
  const active: BatchEntry[] = [];
  const heal: BatchEntry[] = [];
  const stagingEntries: BatchEntry[] = [];
  const orphans: Array<{ job: Job; rec: RunRecord }> = [];
  const out = [...jobs];
  for (const job of jobs) {
    const rec = runs[job.id];
    if (!rec?.remote) continue;
    if (rec.done) {
      // ORPHAN: the record finalized but the row never reached a terminal
      // state — the finalize flip was swallowed (SQLITE_BUSY, a crash
      // between record and row, t262 finding #2). The RECORD is the truth;
      // re-apply it below (no SSH needed). The status guard keeps a live
      // user re-run safe: only a non-terminal row may be healed.
      if (job.status === "running" || job.status === "pending") orphans.push({ job, rec });
      continue;
    }
    const entry: BatchEntry = { job, rec, remote: rec.remote };
    if (rec.remote.phase === "staging") {
      // staging records are owned by their background task — an SSH
      // alive-check would read no pid and report VANISHED for a HEALTHY
      // upload (finalize-killing legitimate staging > 2min). They are
      // judged ledger-side by the heartbeat windows below.
      stagingEntries.push(entry);
      continue;
    }
    if (job.status === "running" || job.status === "pending") active.push(entry);
    else heal.push(entry);
  }

  // ---- orphan heal (ledger-side, no SSH) --------------------------------
  for (const { job, rec } of orphans) {
    const result = rec.result ?? (rec.exitCode === 0 ? "REMOTE run completed" : "remote run failed");
    const patch: Prisma.JobUpdateInput =
      rec.exitCode === 0
        ? {
            status: "completed",
            progress: 100,
            result,
            duration: Math.max(500, Date.now() - new Date(rec.startedAt).getTime()),
          }
        : { status: "failed", progress: 0, result };
    // conditional flip — only a non-terminal row may be healed (a fresh
    // dispatch that already re-owned the row must never be reverted)
    const flipped = await db.job
      .updateMany({ where: { id: job.id, status: { in: ["running", "pending"] } }, data: patch })
      .catch(() => null);
    if (flipped && flipped.count > 0) {
      const healed = await db.job.findUnique({ where: { id: job.id } });
      if (healed) replace(out, healed);
      console.log(
        `remote-run: healed orphan row for "${job.name}" (record said ${
          rec.exitCode === 0 ? "completed" : `exit ${rec.exitCode}`
        }, row was stuck ${job.status})`
      );
    }
  }

  // ---- staging heartbeat windows (ledger-side, no SSH) ------------------
  // Two honest ways to be stale:
  //  - heartbeat older than 2min  → the task vanished mid-flight (its
  //    catch never ran — a hung SSH exec, or the process died quietly)
  //  - no heartbeat at all + older than 30min → pre-heartbeat ledger or a
  //    server restart before the first beat (the old fallback, kept)
  for (const e of stagingEntries) {
    if (e.job.status !== "pending" && e.job.status !== "idle") continue;
    const ageMs = Date.now() - new Date(e.rec.startedAt).getTime();
    const beatAge = e.remote.stagingBeat != null ? Date.now() - e.remote.stagingBeat : null;
    const stale = beatAge != null ? beatAge > STAGING_BEAT_STALE_MS : ageMs > 30 * 60_000;
    if (!stale) continue;
    const msg =
      "staging to the cluster was interrupted (the upload task vanished or the server restarted) — re-run to continue where it left off (uploaded files are skipped)";
    const flipped = await db.job
      .updateMany({
        where: { id: e.job.id, status: { in: ["pending", "idle"] } },
        data: { status: "failed", progress: 0, result: msg },
      })
      .catch(() => null);
    if (flipped && flipped.count > 0) {
      const healed = await db.job.findUnique({ where: { id: e.job.id } });
      if (healed) replace(out, healed);
      // finalize the record too so the liveness guard stops seeing a
      // ghost staging run — but only if the task has not JUST flipped it
      updateRun(e.job.id, (rec) =>
        rec.remote && !rec.done && rec.remote.phase === "staging"
          ? { ...rec, done: true, exitCode: -1, result: msg, remote: { ...rec.remote, note: "staging interrupted" } }
          : null
      );
      console.log(
        `remote-run: staging for "${e.job.name}" went stale (heartbeat ${
          beatAge == null ? "absent" : `${Math.round(beatAge / 1000)}s old`
        }) — row failed honestly`
      );
    }
  }

  if (active.length === 0 && heal.length === 0) return out;

  // group by connection — t325-a (M2): resolve DEAD ids to a live
  // HOST-MATCHED connection BEFORE grouping. The old shape failed a
  // RUNNING row the moment its connection was deleted ("re-add it and
  // re-run") — but delete + re-create on the SAME host is exactly the
  // t325 drift scenario, and the failure finalized the record at
  // exitCode -1, PERMANENTLY disqualifying the heal (which requires
  // exit 0). Cluster identity is (connectionId, host) everywhere the
  // doctrine speaks — the sweep now polls through the re-created
  // connection and the run keeps its life.
  const byConn = new Map<string, { conn: RemoteConnection | null; entries: BatchEntry[] }>();
  for (const e of [...active, ...heal]) {
    let conn: RemoteConnection | null = getConnection(e.remote.connectionId);
    if (!conn) {
      // t325-a — the host-matched fallback (same normalization as
      // sameClusterTarget: case / trailing FQDN dot never blocks a
      // genuine re-creation; an alias still fails closed).
      const wanted = normalizeClusterHost(e.remote.host);
      if (wanted) {
        conn =
          loadConnections().find(
            (c) => normalizeClusterHost(`${c.host}:${c.port}`) === wanted
          ) ?? null;
      }
      if (conn) {
        console.log(
          `remote-run: sweep for "${e.job.name}" on ${e.remote.host} falls back to the re-created connection "${conn.name}" (t325-a — the run keeps its life)`
        );
      }
    }
    const key = conn ? conn.id : e.remote.connectionId;
    const bucket = byConn.get(key) ?? { conn, entries: [] };
    bucket.entries.push(e);
    byConn.set(key, bucket);
  }

  for (const [connId, { conn, entries }] of byConn) {
    if (!conn) {
      for (const e of entries) {
        if (e.job.status !== "running") continue;
        const patch = {
          status: "failed" as const,
          progress: 0,
          result: "the cluster connection for this run was deleted — re-add it and re-run",
        };
        const updated = await updateJobWithRetry(e.job.id, patch);
        if (updated) replace(out, updated);
        updateRun(e.job.id, (rec) => (rec.remote ? { ...rec, done: true, exitCode: -1, result: patch.result } : null));
      }
      continue;
    }

    // throttle: skip this connection entirely on a sub-4s tick or while a
    // poll is still in flight (slow SSH must never stack round trips).
    // t346 — ADAPTIVE: a sweep that took T seconds buys the next one
    // max(4s, 1.5×T) of quiet — a login node that answers in 12s must not
    // be poked every 4s (each poke = an sshd fork it pays for).
    const st = pollState.get(connId) ?? { at: 0, inflight: false, lastMs: 0 };
    const quietFor = Math.min(30_000, Math.max(4_000, Math.round(st.lastMs * 1.5)));
    if (st.inflight || Date.now() - st.at < quietFor) continue;
    const sweepT0 = Date.now();
    pollState.set(connId, { at: sweepT0, inflight: true, lastMs: st.lastMs });

    try {
      const scriptLines: string[] = ["set -u"];
      for (const e of entries) {
        const r = e.remote;
        const W = shQuote(r.remoteWorkdir);
        scriptLines.push(`echo "===CF:START:${e.job.id}"`);
        // t318 — the dispatch fence: a .cf-exit older than this dispatch
        // is the previous run's ghost (re-runs reuse the workdir; the new
        // script's own rm runs only when the job starts) — never a verdict.
        scriptLines.push(aliveCheckScript(r.remoteWorkdir, r.slurmId, r.dispatchedAtEpoch));
        // t346 — ONE heartbeat carries EVERYTHING the UI needs: state,
        // run.out line count, run.out tail AND run.err tail. The log tab's
        // 1.5s polling used to pay its own SSH exec PER POLL (up to 512KB
        // each) — serialized behind this very sweep on the same wire; the
        // wire saturated, the log tab starved, the UI felt stuck. The
        // sweep is the ONLY reader now; the log route serves from the
        // record's cache (remoteLogTail) and never touches SSH again.
        scriptLines.push(`echo "---CF:LINES---"`);
        scriptLines.push(`wc -l < ${W}/run.out 2>/dev/null || echo 0`);
        scriptLines.push(`echo "---LOG---"`);
        scriptLines.push(`tail -c 4096 ${W}/run.out 2>/dev/null`);
        scriptLines.push(`echo "---CF:ERR---"`);
        scriptLines.push(`tail -c 2048 ${W}/run.err 2>/dev/null`);
        // t368 — the LIVE ROUNDS listing: a running classification streams
        // its per-round class stacks home WHILE it runs (the user's
        // 「运行过程中实时传回中间结果」— the old shape only transferred
        // everything at finalize). One stat line per round (bytes, mtime,
        // name) rides the heartbeat the sweep already pays; the
        // generation + settle gates in the ALIVE branch below decide what
        // streams. stat -c is GNU coreutils — every Slurm login node has it.
        if (e.job.status === "running" && LIVE_ITERATION_TYPES.has(e.job.type)) {
          scriptLines.push(`echo "---CF:ROUNDS---"`);
          scriptLines.push(
            `cd ${W} 2>/dev/null && for f in run_it???_classes.mrcs run_unmasked_classes.mrcs; do [ -f "$f" ] && stat -c '%s %Y %n' "$f"; done`
          );
        }
        scriptLines.push(`echo "===CF:END:${e.job.id}"`);
      }
      const res = await exec(conn, scriptLines.join("\n"), { timeoutMs: POLL_SWEEP_TIMEOUT_MS });
      if (res.error) {
        // busy / timeout / network: the CLUSTER process is unaffected — keep
        // everything running and retry next tick
        continue;
      }
      // parse per-job blocks. t303 — the status is still the FIRST line,
      // but a terminal sacct row may now ride as a SECOND line (the EXIT
      // branch's ledger enrichment) — stow it as b.sacct before the tails.
      // t368 — a running classification's block may also end with a
      // ---CF:ROUNDS--- stat listing (see the script build above).
      const blocks = new Map<
        string,
        {
          status: string;
          sacct?: string;
          log: string;
          errTail: string;
          totalLines: number;
          rounds: { file: string; size: number; mtime: number }[];
        }
      >();
      const re = /===CF:START:([\w-]+)\n([\s\S]*?)===CF:END:\1/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(res.stdout)) !== null) {
        const body = m[2];
        const nl = body.indexOf("\n");
        const status = body.slice(0, nl).trim();
        const rest = body.slice(nl + 1);
        const nl2 = rest.indexOf("\n");
        const line2 = (nl2 >= 0 ? rest.slice(0, nl2) : rest).trim();
        const sacct = line2.startsWith("SACCT:") ? line2.slice("SACCT:".length) : undefined;
        const afterStatus = sacct !== undefined && nl2 >= 0 ? rest.slice(nl2 + 1) : rest;
        const linesM = afterStatus.indexOf("---CF:LINES---");
        const logM = afterStatus.indexOf("---LOG---");
        const errM = afterStatus.indexOf("---CF:ERR---");
        const roundsM = afterStatus.indexOf("---CF:ROUNDS---");
        const totalLines =
          linesM >= 0 && logM > linesM
            ? Number(afterStatus.slice(linesM + 15, logM).trim().split("\n")[0]) || 0
            : 0;
        const log = logM >= 0 ? afterStatus.slice(logM + 8, errM >= 0 ? errM : undefined) : "";
        // t368 — the rounds listing sits AFTER the err tail; cap the tail
        // slice there so the stat lines never ride into errTail
        const errTail =
          errM >= 0 ? afterStatus.slice(errM + 11, roundsM >= 0 ? roundsM : undefined) : "";
        const rounds: { file: string; size: number; mtime: number }[] = [];
        if (roundsM >= 0) {
          for (const line of afterStatus.slice(roundsM + 15).split("\n")) {
            const rm =
              /^(\d+)\s+(\d+)\s+(run_it\d{3}_classes\.mrcs|run_unmasked_classes\.mrcs)$/.exec(
                line.trim()
              );
            if (rm) rounds.push({ size: Number(rm[1]), mtime: Number(rm[2]), file: rm[3] });
          }
        }
        blocks.set(m[1], {
          status,
          sacct,
          log: log.replace(/\n$/, ""),
          errTail: errTail.replace(/\n$/, ""),
          totalLines,
          rounds,
        });
      }

      for (const e of entries) {
        const b = blocks.get(e.job.id);
        if (!b) continue;
        const ageMs = Date.now() - new Date(e.rec.startedAt).getTime();
        // t346 — the heartbeat's payload lands on the record BEFORE the
        // verdict switch (every verdict's consumer — progress parse,
        // finalize's log tail, the cache-first log route — reads the same
        // one-write snapshot; unchanged content skips the ledger write)
        if (
          e.remote.logTailOut !== b.log ||
          e.remote.logTailErr !== b.errTail ||
          e.remote.logTotalLines !== b.totalLines
        ) {
          updateRun(e.job.id, (rec) =>
            rec.remote && !rec.done && rec.startedAt === e.rec.startedAt
              ? {
                  ...rec,
                  remote: {
                    ...rec.remote,
                    logTailOut: b.log,
                    logTailErr: b.errTail,
                    logTotalLines: b.totalLines,
                    logTailAt: Date.now(),
                  },
                }
              : null
          );
        }
        if (/^ALIVE/.test(b.status)) {
          // t297 — slurm records speak their scheduler state (ALIVE:PENDING /
          // ALIVE:RUNNING): persist it for the inspector's strip so "queued"
          // and "running" are two honest words, not one merged guess.
          const slurmState = b.status.startsWith("ALIVE:") ? b.status.slice("ALIVE:".length) : null;
          if (slurmState && e.remote.slurmId != null && e.remote.slurmState !== slurmState) {
            e.remote.slurmState = slurmState;
            updateRun(e.job.id, (rec) =>
              rec.remote && !rec.done
                ? { ...rec, remote: { ...rec.remote, slurmState } }
                : null
            );
          }
          // t346 — the ladder spoke ALIVE: the run is provably live; any
          // earlier VANISHED streak was the wire lying
          if (e.remote.vanishedStreak) {
            e.remote.vanishedStreak = 0;
            updateRun(e.job.id, (rec) =>
              rec.remote && !rec.done ? { ...rec, remote: { ...rec.remote, vanishedStreak: 0 } } : null
            );
          }
          if (e.job.status !== "running") continue; // heal path: still alive, nothing to do
          const progress = parseProgressText(e.job.type, b.log, parseJobParams(e.job.params));
          // t319 — the monotonic contract: a running job's progress NEVER
          // regresses. The remote sweep reads a 4096-byte SLIDING window of
          // run.out; whenever the window holds no parsable signal (mid-bar
          // silence, a slow SSH round, log rotation lag) the old code fell
          // back to the DB's dispatch-time 0 — the user's 99% → 0% → 99%
          // oscillation on the real cluster. Parsed beats stored, stored
          // beats null; the updateMany is status-guarded so it can never
          // touch a row a concurrent finalize already completed.
          if (progress != null) {
            const next = Math.max(e.job.progress, progress);
            if (next !== e.job.progress) {
              await db.job
                .updateMany({ where: { id: e.job.id, status: "running" }, data: { progress: next } })
                .catch(() => null);
              replace(out, { ...e.job, progress: next });
            }
          }
          // t368 — LIVE ROUND STREAMING: the heartbeat just carried this
          // run's class-stack stat lines. Rounds the CURRENT generation
          // wrote (mtime ≥ the dispatch fence, 90s clock-skew grace — the
          // t367 leftover lesson) and that have SETTLED (mtime ≥ 60s ago:
          // a stack listed mid-write would pull truncated bytes and flash
          // a false "unreadable" verdict) go straight to the render
          // scheduler: each is pulled once, converted to per-class PNGs +
          // the sheet in the local preview cache, and both galleries
          // answer from local bytes WHILE the run continues — the rounds
          // arrive during the run, not as one finalize-time batch. Already
          // rendered rounds skip for free (the .done marker); a pipeline
          // still in flight absorbs the re-schedule; the 2 GiB budget and
          // the on-demand door below it keep the wire bounded.
          if (b.rounds.length > 0) {
            const fence = e.remote.dispatchedAtEpoch ?? 0;
            const fenceSec = fence > 1e12 ? Math.floor(fence / 1000) : fence;
            const nowSec = Math.floor(Date.now() / 1000);
            const streamable = b.rounds
              .filter((x) => x.mtime + 90 >= fenceSec && x.mtime + 60 <= nowSec)
              .map((x) => ({ file: x.file, size: x.size }));
            if (streamable.length > 0) {
              scheduleRemoteStackRenders({
                jobId: e.job.id,
                connectionId: conn.id,
                remoteWorkdir: e.remote.remoteWorkdir,
                files: streamable,
                reason: "live-sweep",
              });
            }
          }
          continue;
        }
        const exitMatch = /^EXIT:\s*(-?\d+)/.exec(b.status);
        if (exitMatch) {
          const exitCode = Number(exitMatch[1]);
          // t303 — the wrapper's verdict wins, the ledger's stopwatch rides:
          // a terminal SACCT line on the EXIT block enriches the record
          // (Elapsed/MaxRSS) without touching the verdict.
          // t305 — AND the word can finally speak: when the ledger's terminal
          // word agrees with the wrapper's exit (the fallback's own mapping
          // equals the exit code), the record carries the scheduler's word
          // too — the strip's '· Slurm COMPLETED' is no longer fallback-only.
          // A disagreement keeps the old silence and says so out loud.
          const witness = b.sacct ? parseSacctRow(b.sacct) : null;
          let agreed = false;
          if (witness) {
            agreed = wordAgreesWithExit(witness, exitCode);
            if (!agreed) {
              console.log(
                `remote-run: the ledger says ${witness.word} but the wrapper exited ${exitCode} for "${e.job.name}" — the word stays silent (the verdict is the wrapper's)`
              );
            }
          }
          if (witness) persistSacctTestimony(e, witness, agreed);
          const updated = await finalizeRemoteRun(e.job, e.rec, exitCode, b.log, conn);
          if (updated) replace(out, updated);
          continue;
        }
        // t299 — the accounting fallback: squeue went silent AND the exit
        // file never landed, but the scheduler's ledger still knows the
        // truth. Map the terminal word onto the SAME exit contract the
        // wrapper would have written, so finalize (sync-back → outputs →
        // DB flip) runs the one honest path instead of the false
        // "interrupted remotely" tombstone.
        const witness = b.status.startsWith("SACCT:") ? parseSacctRow(b.status.slice("SACCT:".length)) : null;
        if (witness) {
          const { word, exitNum, sigNum } = witness;
          // CANCELLED is the stop contract (t297's TERM trap writes 143 —
          // the scheduler's own accounting must speak the same word); a
          // signal death with a clean exit rides 128+sig; TIMEOUT killed
          // by the walltime limit is a failure even when the step itself
          // exited 0 (timeout(1)'s 124, the batch world's shared idiom)
          const mapped =
            word === "CANCELLED" ? 143 : exitNum !== 0 ? exitNum : sigNum !== 0 ? 128 + sigNum : 0;
          const exitCode = word === "TIMEOUT" && mapped === 0 ? 124 : mapped;
          persistSacctTestimony(e, witness, true);
          const updated = await finalizeRemoteRun(e.job, e.rec, exitCode, b.log, conn);
          if (updated) replace(out, updated);
          continue;
        }
        if (b.status === "VANISHED" && ageMs > VANISH_AGE_MS) {
          // no pid, no exit file, older than the startup grace window — the
          // node rebooted or someone killed the session without a trace.
          // t346 — but the ladder's silence is only PROOF once it repeats:
          // a slow scheduler, an accounting purge or a wire blink can make
          // ONE snapshot come back empty while the job is alive. The flip
          // now needs VANISH_STREAK_N consecutive VANISHED verdicts; any
          // ALIVE/EXIT/SACCT word resets the count (and an SSH-level sweep
          // failure leaves it untouched — unknown is not evidence).
          const streak = (e.remote.vanishedStreak ?? 0) + 1;
          if (streak < VANISH_STREAK_N) {
            e.remote.vanishedStreak = streak;
            updateRun(e.job.id, (rec) =>
              rec.remote && !rec.done && rec.startedAt === e.rec.startedAt
                ? { ...rec, remote: { ...rec.remote, vanishedStreak: streak } }
                : null
            );
            continue;
          }
          if (e.job.status === "running") {
            const patch = {
              status: "failed" as const,
              progress: 0,
              result: `interrupted remotely (no exit status — node reboot or hard kill; ${VANISH_STREAK_N} consecutive checks saw no trace of it); re-run${
                ["class2d", "class3d", "refine3d", "initialmodel", "multibody"].includes(e.job.type)
                  ? " resumes from the last synced checkpoint"
                  : ""
              }`,
            };
            const updated = await updateJobWithRetry(e.job.id, patch);
            updateRun(e.job.id, (rec) => (rec.remote ? { ...rec, done: true, exitCode: -1, result: patch.result } : null));
            if (updated) replace(out, updated);
          } else {
            // heal path: the DB row already left "running" (stopped by the
            // user / failed earlier) but the record never finalized (a
            // SIGKILL'd wrapper cannot write its exit file) — finalize the
            // RECORD so the liveness guard stops reporting a ghost run
            updateRun(
              e.job.id,
              (rec) =>
                rec.remote && !rec.done
                  ? { ...rec, done: true, exitCode: rec.exitCode ?? 137, result: rec.result ?? "stopped/interrupted remotely" }
                  : null
            );
          }
        }
      }
    } finally {
      pollState.set(connId, { at: Date.now(), inflight: false, lastMs: Date.now() - sweepT0 });
    }
  }
  return out;
}

function replace(list: Job[], job: Job): void {
  const i = list.findIndex((j) => j.id === job.id);
  if (i >= 0) list[i] = job;
}

/* ------------------------------------------------------------------ */
/* Finalize (sync-back + outputs + DB)                                 */
/* ------------------------------------------------------------------ */

async function finalizeRemoteRun(
  job: Job,
  rec: RunRecord,
  exitCode: number,
  remoteLogTail: string,
  conn: RemoteConnection
): Promise<Job | null> {
  const r = rec.remote;
  if (!r) return null; // defensive: entries are pre-filtered on rec.remote
  const localWorkdir = rec.workdir;
  // t350 — per-class stars BEFORE the sync-back: a finished class2d/class3d
  // splits its final data star into particles_classNNN.star ON THE CLUSTER
  // (one awk round), so the .star key-file policy carries every class star
  // home with the rest of the metadata — the cryoSPARC-style flow (skip the
  // subset-selection step; pick classes straight from the gallery).
  // Best-effort by design: a split that cannot run leaves the run EXACTLY
  // as finished as it was (the stars are a convenience, never a verdict).
  let perClassFiles: string[] = [];
  if (exitCode === 0 && PER_CLASS_TYPES.has(job.type)) {
    try {
      const split = await splitPerClassStars(conn, r.remoteWorkdir, job.type);
      if (split.ok && split.files.length > 0) {
        perClassFiles = split.files;
      } else if (split.error) {
        console.log(`per-class: split skipped for "${job.name}" — ${split.error}`);
      }
    } catch (e) {
      console.log(`per-class: split failed for "${job.name}" — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // t269 — the sync-back leg's wall-clock cost: the ledger's second entry,
  // set at finalize (the run itself is already over; this is the wait the
  // user still feels before the results appear).
  const syncT0 = Date.now();
  // t339 — the job's TYPE rides along: the pure planner keeps the bulk
  // producers' image stacks on the cluster under key-files (the local
  // mirror is for metadata; the images wait for an explicit fetch).
  const sync = await syncBackWorkdir(
    conn,
    r,
    localWorkdir,
    job.type,
    // t367 — the generation gate's reference: this DISPATCH's startedAt.
    // Files older than it are the previous run's leftovers (the pre-run
    // wipe's silent degrade) and never graduate as this run's outputs.
    Date.parse(rec.startedAt)
  );
  const syncMs = Date.now() - syncT0;

  let outputs: Record<string, string> = {};
  let result: string;
  if (exitCode === 0) {
    const collected = collectOutputs(job.type, localWorkdir);
    outputs = collected.outputs;
    // t350 — the per-class stars land on the record under their own dynamic
    // keys (particles_class001 …): a downstream job created from the class
    // gallery points at these. Only stars that actually came home are
    // recorded (the twin block below then verifies + registers the cluster
    // twin for each, exactly like every other output key).
    for (const name of perClassFiles) {
      const local = path.join(localWorkdir, name);
      const key = name.replace(/\.star$/, "");
      if (existsSync(local)) outputs[key] = local;
    }
    const origin = `${r.user}@${r.host.split(":")[0]}${r.module ? ` · ${r.module}` : ""}`;
    const perClassNote =
      perClassFiles.length > 0 && Object.keys(outputs).some((k) => k.startsWith("particles_class"))
        ? ` · ${perClassFiles.length} per-class star(s) — pick classes from the gallery for the next step`
        : "";
    // t367 — the sync receipt rides the SUCCESS result too: a stale-generation
    // gate that fired (an earlier run's leftovers refused adoption) or a
    // policy/caps skip is part of what this run's outputs MEAN. Without it,
    // a user whose final classes stack is a refused leftover would see
    // "exited 0" and a gallery that honestly refuses — with no sentence
    // anywhere connecting the two.
    const syncNoteSuffix = sync.note ? ` — ${sync.note}` : "";
    result =
      collected.outputs && Object.keys(collected.outputs).length > 0
        ? `REMOTE[${origin}]: ${collected.result.replace(/^REAL: /, "")}${perClassNote}${syncNoteSuffix}`
        : `REMOTE[${origin}]: exited 0 but no expected outputs appeared — check the log tab${perClassNote}${syncNoteSuffix}`;
  } else {
    let logTailText = remoteLogTail;
    // t323 — the rescue arm now reads the LOCAL run.err's own content, not
    // the merged tail: the old `!errTail.trim()` condition included the
    // run.out fallback, so a run with a non-empty run.out NEVER fetched the
    // cluster's run.err — a mid-run RelionError (printed to stderr, which
    // sbatch --error / the direct 2> redirect own) stayed invisible in the
    // receipt, the Log tab's evidence round never ran, and the failure
    // diagnosis scanned a log half. The receipt must see both streams.
    const localErrTail = tailText(path.join(localWorkdir, "run.err"), 400);
    let errTail = localErrTail || logTailText.slice(-400);
    // t323-a (review) — the SIGNATURE decision reads stderr at the rescue's
    // own width (2048), not the display tail's 400: a mid-run RelionError's
    // head ("in: x.cpp, line N" / "ERROR:") can sit past the last 400 chars
    // once the backtrace stacks up below it — the verdict would call a
    // genuine RELION error a silent external kill over the very frames the
    // tail still shows. Display keeps the compact tail; the verdict reads
    // the same evidence the rescue would fetch.
    let errEvidence = tailText(path.join(localWorkdir, "run.err"), 2048);
    // t318 — evidence rescue: a failed run's receipt must never be
    // tail-less while the cluster still holds a log. The poll's tail can
    // legitimately come up empty (the verdict raced the log's flush, or a
    // sync raced a still-growing file into "download failed") — one final
    // SSH round for the last bytes of run.out + run.err mends the receipt
    // with the ground truth. A run that truly printed nothing gets the
    // honest note below instead of a mystery. t323 — the trigger is now
    // "no LOCAL stderr content" (missing file, empty file, or a sync that
    // never brought it home): whenever stderr is unaccounted for, the
    // cluster gets the last word — run.out alone is NOT evidence that
    // run.err is empty.
    if (!localErrTail.trim()) {
      try {
        const W = shQuote(r.remoteWorkdir);
        const evid = await exec(
          conn,
          `tail -c 4096 ${W}/run.out 2>/dev/null; echo ---CF-EVID---; tail -c 2048 ${W}/run.err 2>/dev/null`,
          { timeoutMs: 15_000 }
        );
        if (!evid.error) {
          const parts = evid.stdout.split("---CF-EVID---");
          const outT = (parts[0] ?? "").replace(/\n$/, "");
          const errT = (parts[1] ?? "").replace(/^\n/, "").trimEnd();
          const joined = errT ? `${outT}\n----- stderr -----\n${errT}` : outT;
          if (joined.trim()) {
            logTailText = outT;
            errTail = joined;
            // the rescue only fires when the local copy is empty, so the
            // cluster's 2048 bytes can only WIDEN the evidence window
            if (errT && errT.length > errEvidence.length) errEvidence = errT;
          }
        }
      } catch {
        /* the honest note below speaks for a log we cannot reach */
      }
    }
    // t312/t313 — the ctffind all-failed signature gets a COMPACT
    // diagnosis in the result strip itself (the Log tab carries the full
    // hint via log-diagnosis). t312 blamed raw movie stacks first and was
    // WRONG for the Beijing data (the inputs were motion-corrected
    // *_Fractions_DW.mrc micrographs); the all-at-once refusal means the
    // INPUTS or the ctffind build were rejected outright, and the honest
    // diagnosis orders the suspects by likelihood. The hint replaces two
    // of the tail's warning-noise lines — diagnosis beats repetition.
    const ctfNoFit =
      job.type === "ctffind" &&
      /failed to estimate CTF parameters for any micrograph|cannot get CTF values for/i.test(
        `${errTail}\n${logTailText}`
      );
    const tailLines = errTail.trim()
      ? errTail.trim().split("\n").slice(ctfNoFit ? -2 : -4)
      : [];
    // t315 — the all-failed signature gets an ACTIVE diagnosis, not just a
    // checklist: the warnings name the files, so SSH-stat the FIRST one on
    // the login node and let the verdict split the suspects in two. Readable
    // there → the bytes are fine where SSH lands and the failure happened
    // where the job RAN (the classic: microscope data disks like /data06 are
    // mounted on login nodes only — compute nodes see every ctffind open
    // fail instantly, ~199 files die in seconds); unreadable there → the
    // cluster itself lost the file. An SSH hiccup degrades to the static
    // checklist — the check teaches, it never blocks the finalize.
    let ctfProbeNote = "";
    if (ctfNoFit) {
      let micPath = /cannot get CTF values for (\S+\.mrc[a-z]*)/i.exec(errTail)?.[1]
        ?? /cannot get CTF values for (\S+\.mrc[a-z]*)/i.exec(logTailText)?.[1]
        ?? null;
      // t317 — the relink pass (t316, parallel window) uploads riding stars
      // with PROJECT-RELATIVE rows, so the failure lines now name rows like
      // micrographs/xxx.mrc. A relative row resolves against the run's
      // remote PROJECT ROOT (the sbatch's cwd dialect — dirname of the
      // workdir), never against the SSH home. Probe the resolved spelling
      // first; a verbatim relative probe used to answer CF_UNREADABLE for
      // files that are perfectly fine — the WRONG story ("the cluster lost
      // them, re-import") for every relinked all-failed run.
      if (micPath && !micPath.startsWith("/") && r.remoteWorkdir) {
        const projectRoot = r.remoteWorkdir.slice(0, r.remoteWorkdir.lastIndexOf("/"));
        if (projectRoot) {
          const resolved = `${projectRoot}/${micPath.replace(/^\.\//, "")}`;
          micPath = resolved;
        }
      }
      if (micPath) {
        try {
          const st = await exec(
            conn,
            `if [ -r ${shQuote(micPath)} ]; then echo CF_READABLE; else echo CF_UNREADABLE; fi`,
            { timeoutMs: 10_000 }
          );
          if (st.stdout.includes("CF_READABLE")) {
            const dir = micPath.slice(0, micPath.lastIndexOf("/"));
            ctfProbeNote = `Verified: ${path.basename(micPath)} IS readable on the login node — the failure happened where the job RAN. If this went through Slurm, the compute node may not mount ${dir} (microscope data disks are often login-node-only) — try direct mode, or copy the data to a cluster-wide path`;
          } else if (st.stdout.includes("CF_UNREADABLE")) {
            ctfProbeNote = `Verified: the cluster itself CANNOT read ${micPath} right now — moved, deleted or permissions changed since the import. Re-import the micrographs`;
          }
        } catch {
          /* the probe is a bonus — the static diagnosis below still speaks */
        }
      }
    }
    // t318 — the no-evidence verdict must SAY so: after the rescue above,
    // an empty tail means run.out AND run.err hold not one byte on the
    // cluster (the wrapper died before exec, or the output never flushed).
    // "exit 1" alone would send the user hunting a log that does not exist.
    const emptyLogNote = tailLines.length === 0
      ? "run.out and run.err are EMPTY on the cluster — the wrapper exited before RELION printed anything (module/env failure or an instant crash); inspect the job directory there"
      : "";
    // t323 — the silent-death verdict: exit 1 with NO error signature in
    // EITHER stream is not "RELION reported an error". Verified against
    // RELION master: every in-code death path PRINTS — a RelionError puts
    // "ERROR: …" + "in: … .cpp, line N" + a backtrace on stderr (the
    // t320 receipt was exactly that shape), and the pipeline_control exit
    // wrapper writes "exiting with an error/abort" to stdout. A mid-run
    // exit 1 whose logs end on a live progress bar means the process was
    // killed from OUTSIDE (the login node's CPU-job reaper harvesting a
    // multi-hour direct-mode run, the OOM killer, a walltime) or died a
    // hard crash the harness never narrated. The user's 576-micrograph
    // LoG run (ETA 3.82 hrs, dead at 0.31, run.err empty) was this shape;
    // the old label sent them hunting a RELION error that does not exist.
    // Grounded on BOTH streams because the rescue above already fetched
    // the cluster's run.err when the local copy was empty.
    const evidence = `${logTailText}\n${errEvidence.length > 0 ? errEvidence : errTail}`;
    const hasErrorSignature =
      /^ERROR\b/im.test(evidence) ||
      /in: \S+\.cpp,? line \d+/i.test(evidence) ||
      /exiting with an (error|abort)/i.test(evidence) ||
      /CRYOFLOW_ERR|Segmentation fault|core dumped|\bKilled\b|MPI_ABORT|Traceback \(most recent call last\)/i.test(evidence);
    const silentDeath = exitCode === 1 && !hasErrorSignature && tailLines.length > 0;
    const meaning = silentDeath
      ? "RELION printed no error — the run ended silently mid-job"
      : describeExitCode(exitCode);
    // t341 — the note used to be one string tuned for DIRECT-mode deaths,
    // so a Slurm job that died silently was told "multi-hour jobs belong
    // in Slurm mode" — advice for a lane it was already in (the field
    // report's exact receipt). Split by the record's own mode: the Slurm
    // suspects are the node's OOM killer, a walltime, or a scancel, and
    // the receipt points at sacct + the diagnosis strip instead of the
    // login-node reaper story.
    const silentDeathNote = silentDeath
      ? r.mode === "slurm"
        ? `no error text in the visible run.out/run.err tails: an external kill is the usual cause — the node's OOM killer, a walltime, or a scancel (check the cluster's own record: sacct -j ${r.slurmId ?? "<jobid>"} names the state; the failure diagnosis below matches the full run.out for known signatures like a CUDA out-of-memory). t367: if sacct says TIMEOUT, the job hit its walltime — a run killed DURING its final write phase leaves right-sized but corrupt/unwritten output files, so re-dispatch rather than trusting the half-written products; request a longer limit (the connection's Slurm time-limit setting, or ask the admin for the partition's ceiling)`
        : "no error text in the visible run.out/run.err tails (the rescue fetched the cluster's copy when the local one was empty): an external kill is the usual cause — the login node's CPU-job reaper (long direct-mode runs), the OOM killer, or a walltime. Multi-hour jobs belong in Slurm mode; sacct -j <jobid> and the job directory hold the cluster's own record"
      : "";
    result = [
      `REMOTE[${r.user}@${r.host.split(":")[0]}]: exit ${exitCode}${meaning ? ` (${meaning})` : ""}`,
      silentDeathNote,
      tailLines.join(" "),
      emptyLogNote,
      ...(ctfNoFit
        ? [
            ctfProbeNote ||
              "CTF diagnosis: ctffind rejected EVERY micrograph at once — inputs rejected outright, not bad fits. Check the MRCs are single-section (NZ>1 = raw frame stacks → MotionCorr first; .eer is always raw), that this ctffind build reads the file mode (float16/mode-12 needs a recent ctffind — the cluster's bundled 4.1 may predate it), and the Import pixel size — the job dir's .ctf/log files carry the literal per-file error",
          ]
        : []),
      sync.note,
    ]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 1400);
  }

  // remote twins for the outputs (downstream remote jobs consume these
  // without any re-upload). t311 — the twin map must only name files that
  // ACTUALLY exist on the cluster: collectOutputs can mint outputs the
  // cluster never held (live: refine3d's sequential-mode half maps are
  // synthesized LOCALLY during finalize — mapping them onto cluster paths
  // told every downstream dispatch "already staged, skip the upload" and
  // MaskCreate starved). One batched stat round settles the truth.
  const remoteOutputs: Record<string, string> = {};
  const twinCandidates = Object.entries(outputs).map(([k, v]) => ({
    key: k,
    local: v,
    remote: mapLocalToRemote(v, r.remoteRoot),
  }));
  if (twinCandidates.length > 0) {
    // t341 — the echo payload is the INDEX, never the path: a login shell
    // (or a test rig) that rewrites path-shaped strings inside the command
    // used to break the round-trip ("OK /projects/…" came back translated,
    // the ok-set never matched, and every run finalized with EMPTY twins —
    // downstream dispatches re-uploaded inputs the cluster already held).
    // t324's lazy probe already speaks key-payload dialect (CF_TWIN\tkey);
    // this closes the same hole on the finalize leg. An index also keeps
    // the script short at any path length.
    const statScript = twinCandidates
      .map((c, i) => `if [ -e ${shQuote(c.remote)} ]; then echo "OK ${i}"; fi`)
      .join("; ");
    const stat = await exec(conn, statScript, { timeoutMs: 20_000 });
    const okIdx = new Set(
      stat.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^OK \d+$/.test(l))
        .map((l) => Number(l.slice(3)))
    );
    for (let i = 0; i < twinCandidates.length; i++) {
      if (okIdx.has(i)) remoteOutputs[twinCandidates[i].key] = twinCandidates[i].remote;
    }
  }

  // t324 — keys the sync-back left behind: the file may still sit on the
  // cluster it was computed on. Probe the run dir for the type's chainable
  // output candidates and record VERIFIED twins for anything found — the
  // downstream remote consumers chain off them in place, and the receipt
  // says where the file lives instead of pretending it never existed
  // ("exited 0 but no expected outputs appeared" was a lie by omission:
  // the outputs appeared, they just stayed). One extra SSH round, only
  // when a key is genuinely missing.
  let outputProbedAt: number | undefined;
  let outputProbeAbsent: string[] | undefined;
  let stayNote = "";
  const finalizeMissing = missingRemoteOutputKeys(job.type, outputs, remoteOutputs);
  if (exitCode === 0 && finalizeMissing.length > 0) {
    const probe = await probeRemoteOutputs(conn, rec, { outputs, persist: false });
    for (const [k, v] of Object.entries(probe.twins)) {
      if (!remoteOutputs[k]) remoteOutputs[k] = v;
    }
    if (probe.probed) {
      outputProbedAt = Date.now();
      // t328 — the same verdict the lazy heal persists: keys this probe
      // checked and did NOT find, so a downstream consumer's waiting
      // message can say "checked, not there" instead of re-promising the
      // probe (the finalize leg is the FIRST probe a record ever gets —
      // its negative is exactly the one the dialect must own up to).
      outputProbeAbsent = finalizeMissing.filter((k) => !remoteOutputs[k]);
    }
    // keys whose ONLY account is the verified cluster twin (the local
    // sync-back left them behind) — the receipt must say so
    const remoteOnly = Object.keys(remoteOutputs)
      .filter((k) => !outputs[k] || !existsSync(outputs[k]))
      // speak FILE names, not record keys ("particles.star", not "particles_star")
      .map((k) => k.replace(/_star$/, ".star").replace(/_mrc$/, ".mrc").replace(/_/g, " "));
    if (remoteOnly.length > 0) {
      stayNote =
        Object.keys(outputs).length === 0
          ? `${remoteOnly.join(", ")} stayed on the cluster (verified there) — downstream cluster jobs chain off the cluster copy in place; raise the connection's sync caps to bring it home`
          : ` — ${remoteOnly.join(", ")} stayed on the cluster (verified there; downstream cluster jobs chain off the cluster copy — raise the sync caps to pull it home)`;
    }
  }
  if (stayNote) {
    result = stayNote.startsWith(" — ")
      ? `${result}${stayNote}`
      : `REMOTE[${r.user}@${r.host.split(":")[0]}]: ${stayNote}`;
  }

  updateRun(job.id, (cur) =>
    cur.startedAt === rec.startedAt && cur.remote
      ? {
          ...cur,
          done: true,
          exitCode,
          outputs,
          result,
          remote: {
            ...cur.remote,
            remoteOutputs,
            ...(outputProbedAt != null
              ? { outputProbeAt: outputProbedAt, outputProbeAbsent: outputProbeAbsent ?? [] }
              : {}),
            syncedFiles: sync.files,
            syncedBytes: sync.bytes,
            skippedFiles: sync.skipped.slice(0, 50),
            syncMs,
            ...(sync.note ? { note: sync.note } : {}),
          },
        }
      : null
  );

  const patch =
    exitCode === 0
      ? {
          status: "completed" as const,
          progress: 100,
          result,
          duration: Math.max(500, Date.now() - new Date(rec.startedAt).getTime()),
        }
      : { status: "failed" as const, progress: 0, result };
  // SQLITE_BUSY-safe flip (t262 finding #2): a swallowed flip used to leave
  // the row non-terminal forever — the orphan sweep now backs this up too.
  const updated = await updateJobWithRetry(job.id, patch);
  if (updated && exitCode === 0) {
    // downstream auto-start — same cluster (the trigger's remote target
    // passes through so a remote pipeline stays remote)
    void import("@/lib/relion/dispatch")
      .then((m) => m.autoStartPendingDownstream(job.id))
      .catch((e) => console.error("remote-run: downstream auto-start failed:", e));
  }
  // t356 — the PROACTIVE class-image pipeline (the user's architecture:
  // download the cluster's mrcs result files locally, convert to images
  // locally). The sync-back's key-files caps leave a real run's class-
  // average stacks (25–100 MB each) ON the cluster, and the old lazy
  // door made every gallery image a fresh SSH roulette. After finalize,
  // the manifest's stack names go to the render scheduler: each stack is
  // pulled once (byte-verified), converted to per-class PNGs + the
  // per-round sheet in the LOCAL preview cache, then deleted — both
  // galleries answer from local bytes afterwards. Fire-and-forget: the
  // sweep is never blocked (transfers ride direct pooled channels), one
  // pipeline per job, already-rendered rounds skip for free. Runs for
  // failed exits too — the rounds a killed run DID finish are exactly
  // what the user needs to judge a re-run.
  if (LIVE_ITERATION_TYPES.has(job.type)) {
    const stackManifest = readRemoteManifest(localWorkdir);
    if (stackManifest) {
      scheduleRemoteStackRenders({
        jobId: job.id,
        connectionId: r.connectionId,
        remoteWorkdir: r.remoteWorkdir,
        files: stackManifest.files.map((f) => ({ file: f.path, size: f.size })),
        reason: "finalize",
      });
    }
  }
  if (updated) console.log(`remote-run: ${job.type} "${job.name}" exit ${exitCode} (${sync.files} files synced, ${sync.skipped.length} skipped)`);
  return updated;
}

interface SyncResult {
  files: number;
  bytes: number;
  skipped: string[];
  note?: string;
}

/**
 * Download the cluster workdir into the local mirror (bounded by the
 * connection's caps AND — since t289 — its sync policy). STAR files are
 * rewritten to-local so downstream LOCAL jobs and the results viewers work
 * unchanged. `.cf-*` control files stay remote-only. The FULL remote
 * listing lands in `.cf-remote-manifest.json` so the outputs view can show
 * what stayed behind. Returns counts + the skipped list for the UI.
 *
 * t339 — WHAT comes home is decided by the pure planner (sync-policy.ts):
 * under key-files, the per-micrograph image producers (extract, motioncorr,
 * polish — the cleanup planner's BULK_TYPES) sync TEXT ONLY; their image
 * stacks stay on the cluster WHATEVER THEIR SIZE (the 865-under-the-cap
 * loophole this ticket closed — per-file judgment cannot see an aggregate),
 * listed in the manifest + Results and fetchable on demand. Other types
 * keep the t289 doctrine: text always, binaries under keyFileMb (class
 * averages still come home — the class gallery reads their headers
 * locally). "everything" keeps meaning everything under the caps.
 */
/** t367 — does the local file at `p` read as a sane MRC-family binary?
 * Non-MRC files are "fresh" by definition (text and other formats have no
 * cheap honesty check — the byte account remains their verdict). An MRC/
 * MRCS/MAP whose header cannot be parsed (the zero-header ghost shape) is
 * NEVER fresh, whatever its size: re-pull. */
function localMrcReads(p: string): boolean {
  if (!/\.(mrcs?|map)$/i.test(p)) return true;
  try {
    return readMrcHeader(p) != null;
  } catch {
    return false;
  }
}

async function syncBackWorkdir(
  conn: RemoteConnection,
  r: RemoteRunState,
  localWorkdir: string,
  jobType?: string,
  /**
   * t367 — the generation gate: the dispatch's startedAt in epoch ms. Any
   * cluster-side file whose mtime PREDATES this moment (minus a clock-skew
   * grace) is a PREVIOUS run's leftover — the pre-run wipe's silent
   * degrade (a t344 SSH timeout leaves "proceeding without it") — and is
   * never adopted as this run's output. The field report: a corrupt,
   * zero-header run_it020_classes.mrcs from the pre-t360 multi-writer era
   * survived the wipe while the re-run (killed at its final write phase
   * by the partition's default walltime) never wrote its own it020 — the
   * sync-back then faithfully pulled the leftover home as "this run's
   * classes", and every viewer answered "could not render". Absent =
   * legacy caller, no gate (the pre-t367 behavior).
   */
  notBeforeMs?: number
): Promise<SyncResult> {
  const res: SyncResult = { files: 0, bytes: 0, skipped: [] };
  // t369 — files whose download completed with a clean byte account but
  // whose MRC header still cannot be read: the cluster's OWN corruption
  // (right-sized zero-header — the storage write-path loss), named in the
  // receipt so "exited 0" and a gallery that refuses to render are one
  // sentence, not two mysteries.
  const corruptPulled: string[] = [];
  const W = shQuote(r.remoteWorkdir);
  // t367 — %T@ (mtime, epoch seconds with fraction) rides every line: the
  // generation gate needs it and the find costs the same SSH round.
  const manifest = await exec(
    conn,
    `cd ${W} 2>/dev/null && find . -type f -not -name '.cf-*' -printf '%P\\t%s\\t%T@\\n' 2>/dev/null | head -4000`,
    { timeoutMs: 15_000 }
  );
  if (manifest.error || manifest.code !== 0) {
    res.note = "sync-back failed (workdir unreadable over SSH) — outputs remain on the cluster";
    return res;
  }
  // t289/t339 — the policy context the PURE planner speaks (key-files gates
  // binaries at keyFileMb for result types and syncs bulk producers'
  // images NEVER; everything keeps the pre-t289 behavior — caps only).
  const policyCtx = {
    policy: conn.syncPolicy === "everything" ? ("everything" as const) : ("key-files" as const),
    jobType,
    keyFileMb: conn.keyFileMb,
    maxFileMb: conn.maxFileMb,
    maxTotalMb: conn.maxTotalMb,
    remoteWorkdir: r.remoteWorkdir,
  };
  const capPerFile = conn.maxFileMb * 1024 * 1024;
  // t367 — lines are "rel\tsize\tmtimeSec" (%P\t%s\t%T@); a %P path never
  // contains a tab, so the FIRST tab ends the path and the LAST begins the
  // mtime (middle = size).
  const entries: { rel: string; size: number; mtimeSec?: number }[] = [];
  for (const line of manifest.stdout.trim().split("\n")) {
    if (!line.trim()) continue;
    const t1 = line.indexOf("\t");
    const t2 = line.lastIndexOf("\t");
    if (t1 < 0) continue;
    const rel = line.slice(0, t1).trim();
    const size = Number(t2 > t1 ? line.slice(t1 + 1, t2).trim() : line.slice(t1 + 1).trim());
    const mtimeSec = t2 > t1 ? Number(line.slice(t2 + 1).trim().split(/\s+/)[0]) : NaN;
    if (!rel || !Number.isFinite(size)) continue;
    entries.push({
      rel,
      size,
      ...(Number.isFinite(mtimeSec) && mtimeSec > 0 ? { mtimeSec } : {}),
    });
  }
  // t367 — THE GENERATION GATE, before the planner ever sees caps: a file
  // that predates the dispatch is the previous run's, whatever its size or
  // policy class. 90s of grace absorbs app↔cluster clock skew; stale
  // leftovers are hours-to-days old, nowhere near the line.
  const staleGateMs =
    typeof notBeforeMs === "number" && Number.isFinite(notBeforeMs) && notBeforeMs > 0
      ? notBeforeMs - 90_000
      : null;
  const freshEntries: typeof entries = [];
  const staleSkips: SyncSkip[] = [];
  if (staleGateMs != null) {
    for (const e of entries) {
      if (typeof e.mtimeSec === "number" && e.mtimeSec * 1000 < staleGateMs) {
        staleSkips.push({ ...e, why: "stale-generation" });
      } else {
        freshEntries.push(e);
      }
    }
  }
  const gatedEntries = staleGateMs != null ? freshEntries : entries;
  // t289 — the ledger FIRST: even a sync that dies mid-way leaves the
  // outputs view knowing what the cluster holds (sizes included). t367 —
  // the manifest still lists EVERYTHING (stale leftovers included): the
  // Files tab speaks the cluster's truth, the gate only refuses to PULL
  // them home as this run's outputs.
  writeRemoteManifest(localWorkdir, {
    connectionId: r.connectionId,
    remoteWorkdir: r.remoteWorkdir,
    files: entries.map((e) => ({ path: e.rel, size: e.size })),
  });
  // t339 — the plan (WHAT comes home) comes from the pure planner; the
  // loop below only executes it. The planner's skip list is the pre-download
  // truth; the loop appends the download-time verdicts (failed / grew) so
  // the note speaks every file that stayed, with its own why. t367 — the
  // stale-generation verdicts lead the skip list.
  const plan = planSyncBack(gatedEntries, policyCtx);
  const skips: SyncSkip[] = [...staleSkips, ...plan.skip];
  for (const { rel, size } of plan.take) {
    const localPath = path.join(localWorkdir, rel);
    // fresh copy already there? skip (idempotent re-finalize). t367 — a
    // same-SIZE local file is no longer enough for MRC-family outputs: a
    // corrupt local copy of the SAME size (the field report's ghost — a
    // zero-header leftover from the multi-writer era) would pass the size
    // check and keep serving "could not render" forever. A binary whose
    // header cannot be parsed is NEVER fresh — re-pull it.
    try {
      if (existsSync(localPath) && statSync(localPath).size === size && localMrcReads(localPath)) {
        res.files += 1;
        continue;
      }
    } catch {
      /* re-download */
    }
    const written = await remoteDownload(conn, `${r.remoteWorkdir}/${rel}`, localPath, capPerFile);
    if (written == null) {
      skips.push({ rel, size, why: "download-failed" });
      continue;
    }
    if (written === -1) {
      skips.push({ rel, size, why: "grew-mid-download" });
      continue;
    }
    res.bytes += written;
    res.files += 1;
    // t369 — a completed download that still fails the MRC header check is
    // NOT a transfer failure (the byte account above is clean): the bytes
    // on the cluster are the corrupt ones. Keep the file (it IS the
    // cluster's truth and the gallery's on-demand legs speak about it)
    // but record it for the receipt.
    if (/\.(mrcs?|map)$/i.test(rel) && !localMrcReads(localPath)) {
      corruptPulled.push(rel);
    }
    // STAR rewrite to-local (in place)
    if (/\.star$/i.test(localPath)) {
      try {
        const text = readFileSync(localPath, "utf8");
        const rewritten = rewriteStarPaths(text, "to-local", r.remoteRoot);
        if (rewritten !== text) writeFileSync(localPath, rewritten);
      } catch {
        /* best-effort */
      }
    }
  }
  // the skip list rides the record (per-file lines, the same strings the
  // pre-t339 dialect embedded); the note is the planner's own rendering —
  // the metadata-only class leads with the POLICY, not with caps.
  res.skipped = skips.map((s) => describeSyncSkipFile(s, policyCtx));
  const noteParts: string[] = [];
  const note = describeSyncSkips(skips, policyCtx);
  if (note) noteParts.push(note);
  if (corruptPulled.length > 0) {
    const shown =
      corruptPulled.slice(0, 3).join(", ") +
      (corruptPulled.length > 3 ? ` +${corruptPulled.length - 3} more` : "");
    noteParts.push(
      `${corruptPulled.length} file(s) downloaded completely but read as CORRUPT MRCs on the cluster itself (${shown}) — right-sized zero-header bytes: this run's writes never durably reached the storage under the workdir. Run the 60-second write test (2 MB of urandom from a compute node, md5sum from the login node) before re-running anything (t369)`
    );
  }
  if (noteParts.length > 0) res.note = noteParts.join(" — ");
  return res;
}

/* ------------------------------------------------------------------ */
/* Log tail + stop + DTO enrichment                                    */
/* ------------------------------------------------------------------ */

/**
 * t346 — how often the log route may fall back to its OWN SSH fetch for one
 * job. The UI polls the log tab every 1.5s while a run is live; before t346
 * every one of those polls paid a full SSH exec (up to 512KB) serialized on
 * the cluster's single wire — the wire saturated, the log tab starved and
 * the whole UI felt stuck. The sweep now carries the tails on its
 * heartbeat; this fallback exists only for the gap BEFORE the first sweep
 * lands (or when no sweep runs at all — e.g. the record's connection was
 * just re-created) and must never see the UI's cadence.
 */
const LOG_FETCH_MIN_MS = 10_000;
const logFetchAt = new Map<string, number>();
/**
 * t347 — the last FULL-log answer per job. Full mode never touches the
 * heartbeat's tail cache, and the UI polls it every 5s — faster than the
 * 10s wire budget — so every rate-limited tick used to answer with an
 * EMPTY string, blanking the whole console on alternate refreshes (the
 * user's 「文字总是在刷新的过程中消失」). The cache serves those
 * in-between ticks; each real fetch refreshes it.
 */
const logFullCache = new Map<string, { payload: RemoteLogPayload; at: number }>();
const LOG_FULL_CACHE_MS = 30_000;

/** The sweep-carry + on-demand log read, shaped exactly like getLogTail's. */
function shapeRemoteLog(
  out: string,
  err: string,
  totalLines: number,
  full: boolean
): RemoteLogPayload {
  let text = out;
  if (err.trim().length > 0) text += "\n----- stderr -----\n" + err;
  // collapse \r-updated lines like getLogTail does
  const lines = text
    .split("\n")
    .map((line) => {
      const idx = line.lastIndexOf("\r");
      return (idx >= 0 ? line.slice(idx + 1) : line).replace(/\s+$/, "");
    });
  const tail = full ? lines : lines.slice(-600);
  return {
    text: tail.join("\n"),
    totalLines,
    truncated: totalLines > tail.length,
  };
}

export async function remoteLogTail(jobId: string, opts: { full?: boolean }): Promise<RemoteLogPayload | null> {
  const rec = getRun(jobId);
  if (!rec?.remote) return null;
  const conn = getConnection(rec.remote.connectionId);
  if (!conn) return { text: "(the connection for this run was deleted — logs stay on the cluster)", totalLines: 0, truncated: false };
  const r = rec.remote;

  // t346 — CACHE-FIRST (tail mode): the poll sweep already carries the
  // run.out/run.err tails on its heartbeat (one exec per connection per
  // few seconds, batched over ALL its jobs). The UI's 1.5s cadence reads
  // the record — zero SSH, zero wire bytes, instant response. A STALE
  // cache (>15s old) on a still-live run falls through to the rate-limited
  // fetch below: the sweep is the normal refresher, but a log tab must
  // never freeze just because nobody polled /api/jobs for a while (the
  // detached-view case — the 10s rate limiter keeps the wire cost bounded
  // even here).
  if (!opts.full && typeof r.logTailAt === "number") {
    const staleMs = Date.now() - r.logTailAt;
    if (rec.done || staleMs <= 15_000) {
      return shapeRemoteLog(r.logTailOut ?? "", r.logTailErr ?? "", r.logTotalLines ?? 0, false);
    }
  }

  // no cache yet (or full mode): ONE on-demand fetch per window per job —
  // the rate limiter is the UI's protection, not the wire's generosity
  const now = Date.now();
  if (now - (logFetchAt.get(jobId) ?? 0) < LOG_FETCH_MIN_MS) {
    if (!opts.full && typeof r.logTailAt === "number") {
      return shapeRemoteLog(r.logTailOut ?? "", r.logTailErr ?? "", r.logTotalLines ?? 0, false);
    }
    if (opts.full) {
      // t347 — the full-mode cache answers the in-between ticks: a finished
      // run's log is static (cache forever); a live run's refreshes on every
      // real fetch. Never an empty-string answer that blanks the console.
      const c = logFullCache.get(jobId);
      if (c && (rec.done || now - c.at <= LOG_FULL_CACHE_MS)) {
        return c.payload;
      }
    }
    // rate-limited with nothing to serve: pending, not blank — the UI keeps
    // its previous content and shows a quiet hint
    return {
      text: "",
      totalLines: 0,
      truncated: false,
      pending: true,
      note: "waiting for the next fetch window (the heartbeat refreshes the log)",
    };
  }
  logFetchAt.set(jobId, now);

  const capOut = opts.full ? 8 * 1024 * 1024 : 96 * 1024;
  const capErr = opts.full ? 1024 * 1024 : 16 * 1024;
  const W = shQuote(r.remoteWorkdir);
  const res = await exec(
    conn,
    `wc -l < ${W}/run.out 2>/dev/null || echo 0; echo ---CF-SPLIT---; tail -c ${capOut} ${W}/run.out 2>/dev/null; echo ---CF-SPLIT---; tail -c ${capErr} ${W}/run.err 2>/dev/null`,
    { timeoutMs: 30_000 }
  );
  if (res.error) {
    // t346 — the wire's failure is not the log's failure: the cached
    // heartbeat (if any) still serves; a run with neither cache nor wire
    // gets the honest retry word, and the UI keeps its last content
    if (!opts.full && typeof r.logTailAt === "number") {
      return shapeRemoteLog(r.logTailOut ?? "", r.logTailErr ?? "", r.logTotalLines ?? 0, !!opts.full);
    }
    if (opts.full) {
      const c = logFullCache.get(jobId);
      if (c) return c.payload; // stale full text beats a blank console
    }
    // t347 — pending + note instead of a placeholder that replaced the
    // console: the run itself is unaffected, the next heartbeat retries
    return {
      text: "",
      totalLines: 0,
      truncated: false,
      pending: true,
      note: `log fetch failed: ${res.error} — retrying on the next heartbeat; the run itself is unaffected`,
    };
  }
  const parts = res.stdout.split("---CF-SPLIT---");
  const totalLines = Number((parts[0] ?? "0").trim()) || 0;
  const out = (parts[1] ?? "").replace(/^\n/, "");
  const err = (parts[2] ?? "").replace(/^\n/, "");
  // a successful TAIL fetch also seeds the cache — the sweep overwrites it
  // on its next heartbeat with the same shape
  if (!opts.full) {
    updateRun(jobId, (cur) =>
      cur.remote && !cur.done && cur.remote.connectionId === r.connectionId
        ? {
            ...cur,
            remote: {
              ...cur.remote,
              logTailOut: out,
              logTailErr: err,
              logTotalLines: totalLines,
              logTailAt: Date.now(),
            },
          }
        : null
    );
  }
  const payload = shapeRemoteLog(out, err, totalLines, !!opts.full);
  if (opts.full) {
    // t347 — remember the full answer for the rate-limited ticks that follow
    logFullCache.set(jobId, { payload, at: Date.now() });
  }
  return payload;
}

/** Kill the cluster-side session — the stop route's branch.
 *  t297: slurm records die by scancel (the scheduler owns the tree on the
 *  compute node; a login-node kill could never reach it). */
export async function remoteStopRun(jobId: string): Promise<{ stopped: boolean; message: string }> {
  const rec = getRun(jobId);
  if (!rec?.remote) return { stopped: false, message: "not a remote run" };
  const conn = getConnection(rec.remote.connectionId);
  if (!conn) return { stopped: false, message: "the connection for this run was deleted — kill the process on the cluster manually" };
  const r = rec.remote;
  if (r.mode === "slurm" && r.slurmId) {
    const res = await exec(conn, `scancel ${shQuote(String(Number(r.slurmId)))}`, { timeoutMs: 15_000 });
    const ok = res.code === 0 && !res.error;
    return {
      stopped: ok,
      message: ok
        ? `sent scancel to Slurm job ${r.slurmId} — the scheduler tears the process tree down on the compute node`
        : `scancel ${r.slurmId} failed${res.stderr.trim() ? `: ${res.stderr.trim().slice(0, 200)}` : " (already finished?)"}`,
    };
  }
  const W = shQuote(rec.remote.remoteWorkdir);
  const res = await exec(
    conn,
    `P=$(cat ${W}/.cf-pid 2>/dev/null); ` +
      `if [ -n "$P" ]; then kill -- -$P 2>/dev/null; kill $P 2>/dev/null; sleep 1; kill -9 -- -$P 2>/dev/null; kill -9 $P 2>/dev/null; echo KILLED; ` +
      `else echo NOPID; fi`,
    { timeoutMs: 15_000 }
  );
  const killed = /KILLED/.test(res.stdout);
  return {
    stopped: killed,
    message: killed
      ? `sent SIGTERM+SIGKILL to the cluster-side session (pid group ${rec.remote.pid})`
      : "no live cluster pid found (already exited?)",
  };
}

/** DTO enrichment: what the UI knows about a job's remote execution. */
export function remoteInfoFor(jobId: string): RemoteRunInfo | null {
  const rec = readRuns()[jobId];
  if (!rec?.remote) return null;
  const r = rec.remote;
  return {
    connectionId: r.connectionId,
    connectionName: r.connectionName,
    host: r.host,
    user: r.user,
    module: r.module,
    mode: r.mode,
    remoteWorkdir: r.remoteWorkdir,
    ...(r.pid != null ? { pid: r.pid } : {}),
    ...(r.slurmId != null ? { slurmId: r.slurmId } : {}),
    ...(r.slurmState ? { slurmState: r.slurmState } : {}),
    ...(r.gpusRequested != null ? { gpusRequested: r.gpusRequested } : {}),
    ...(r.partition ? { partition: r.partition } : {}),
    // t303 — the scheduler's stopwatch + meter ride the DTO so the
    // inspector's terminal strip can speak the ledger's own numbers.
    ...(r.slurmElapsedMs != null ? { slurmElapsedMs: r.slurmElapsedMs } : {}),
    ...(r.slurmMaxRssBytes != null ? { slurmMaxRssBytes: r.slurmMaxRssBytes } : {}),
    ...(r.slurmDependsOn?.length ? { slurmDependsOn: r.slurmDependsOn } : {}),
    ...(r.slurmArray ? { slurmArray: r.slurmArray } : {}),
    phase: r.phase,
    ...(r.stagedBytes != null ? { stagedBytes: r.stagedBytes } : {}),
    // t269 — the time ledger rides the DTO so the inspector's remote strip
    // can speak it once the run is terminal.
    ...(r.stagedMs != null ? { stagedMs: r.stagedMs } : {}),
    ...(r.syncMs != null ? { syncMs: r.syncMs } : {}),
    ...(r.syncedFiles != null ? { syncedFiles: r.syncedFiles } : {}),
    ...(r.syncedBytes != null ? { syncedBytes: r.syncedBytes } : {}),
    ...(r.note ? { note: r.note } : {}),
  };
}

/**
 * t270 — the connection's run résumé: one aggregation over the run records
 * for the cluster manager's résumé card ("what has this cluster done for
 * me"). A record counts when it IS a remote run dispatched through this
 * connection; status derives from done/exitCode the same way the stop route
 * writes them (137 = stopped by user → failed bucket). recent keeps the ≤3
 * newest entries, newest first — the reading line under the summary.
 * t295 — opts.all is the PANORAMA variant: recent then holds EVERY entry
 * (newest first, same shape) for the card's expand — the reading line and
 * the panorama are the same aggregate at two apertures, never two truths.
 * A connection with zero runs yields an all-zero resume (total 0) — the
 * route omits the field entirely for that case, so "no résumé" stays honest.
 */
export async function connectionRunResume(
  connectionId: string,
  opts?: { all?: boolean }
): Promise<ConnectionRunResume> {
  const resume: ConnectionRunResume = { total: 0, completed: 0, failed: 0, lastRunAt: null, recent: [] };
  const runs = readRuns();
  for (const rec of Object.values(runs)) {
    if (rec.remote?.connectionId !== connectionId) continue;
    resume.total += 1;
    if (rec.done) {
      if (rec.exitCode === 0) resume.completed += 1;
      else resume.failed += 1;
    }
    if (!resume.lastRunAt || rec.startedAt > resume.lastRunAt) resume.lastRunAt = rec.startedAt;
    const r = rec.remote;
    resume.recent.push({
      jobId: rec.jobId,
      jobType: rec.type,
      done: rec.done,
      exitCode: rec.exitCode,
      startedAt: rec.startedAt,
      ...(r.stagedMs != null ? { stagedMs: r.stagedMs } : {}),
      ...(r.syncMs != null ? { syncMs: r.syncMs } : {}),
      ...(r.syncedFiles != null ? { syncedFiles: r.syncedFiles } : {}),
      ...(r.syncedBytes != null ? { syncedBytes: r.syncedBytes } : {}),
    });
  }
  resume.recent.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  resume.recent = resume.recent.slice(0, opts?.all ? undefined : 3);
  // t272 — existence is the doorway's truth: the résumé is GLOBAL (records +
  // connections), the job is per-project. For every rendered entry (the ≤3
  // reading line, or the whole panorama under opts.all) the server says
  // whether the job still exists anywhere, and under which project's canvas
  // it lives — the UI can then speak THREE honest states
  // (jumpable / another canvas / gone) instead of one merged guess.
  for (const e of resume.recent) {
    const row = await db.job.findUnique({
      where: { id: e.jobId },
      select: { id: true, project: { select: { name: true } } },
    });
    if (row) {
      e.exists = true;
      if (row.project?.name) e.projectName = row.project.name;
    } else {
      e.exists = false;
    }
  }
  return resume;
}

/**
 * Project a connection DTO with its résumé attached (omitted at zero runs).
 * Shared by every route that returns a connection body — the dialog upserts
 * whole rows, so ANY layer returning a bare DTO would erase the history the
 * list view already showed.
 */
export async function withRunResume(dto: RemoteConnectionDTO): Promise<RemoteConnectionDTO> {
  const resume = await connectionRunResume(dto.id);
  return resume.total > 0 ? { ...dto, resume } : dto;
}
