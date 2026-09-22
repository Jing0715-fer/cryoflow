/**
 * CryoFlow — cluster micrograph preview thumbnails (t315, SERVER ONLY).
 *
 * The user's Beijing-shaped report: after a REMOTE import the gallery was
 * BLANK — the star's rows are cluster-absolute (/data06/…), nothing is on
 * this machine, and the outputs/file door only fetches files inside a
 * REMOTE RUN's workdir (the import ran locally, so it has none). The
 * gallery therefore samples FIVE random micrographs and pulls each one's
 * thumbnail over SSH:
 *
 *   remoteClusterSample    the manifest route's one batched SSH round —
 *                          stat + 64-byte header per sampled path (size +
 *                          detector dims for the card, verdicts for the
 *                          caption), all in a single exec.
 *   remotePreviewPng       the thumbnail door — a cached PNG per cluster
 *                          path. Miss: the DECIMATION LADDER (t322) thins
 *                          the pixels ON THE CLUSTER — python3 (pure
 *                          stdlib) decimates both axes (~0.5 MB travels
 *                          for a 64 MB micrograph), GNU dd strided rows
 *                          (~11× less than the whole file) as fallback,
 *                          and only a shell that speaks neither dialect
 *                          falls back to the old whole-file pull (FETCH_CAP
 *                          + its teaching refusal). The bytes render
 *                          locally through the SAME 2–98% stretch pipeline
 *                          as every other thumbnail, the PNG persists in
 *                          the cache, the fetched raw pixels never touch
 *                          disk.
 *
 * t322 — the second half of the user's ticket: every gallery visit used to
 * re-roll the random five, so the PNG cache NEVER hit (five fresh cluster
 * paths each time, five whole-file pulls each time — “每次重新读取”). The
 * manifest route now samples DETERMINISTICALLY (seeded by job id + reroll
 * counter), and the preview responses carry Cache-Control so the browser
 * stops re-asking too.
 *
 * Security: callers must validate the requested path is a row of THEIR OWN
 * star before calling (this module trusts the caller for that gate; it
 * never invents paths).
 */

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { DATA_DIR } from "@/lib/paths";
import { getConnection } from "./connections";
import { exec, remoteDownload, shQuote } from "./ssh";
import { decodeRawVoxels, renderDecimatedPng, renderMrcLargePng, renderMrcSlicePng } from "@/lib/mrc";
import { sniffImageFile, type SniffVerdict } from "@/lib/relion/mrc-sniff";

/** Where thumbnails + transient fetches live (under the app data root). */
const PREVIEW_DIR = path.join(DATA_DIR, "remote-preview");

/**
 * A fetched micrograph is deleted after rendering — this is the ceiling we
 * are willing to pull through the door for ONE thumbnail. t317: 512 MB
 * (summed micrographs are 64–256 MB and always fit; raw frame stacks are
 * GB-scale and honestly over — the over-cap error says what to do instead
 * of silently multi-GB-ing the laptop through a gallery click).
 */
const FETCH_CAP = 512 * 1024 * 1024;

/**
 * t317 — the cache key now names the CONNECTION as well as the path: two
 * clusters can mount the same absolute path with different content, and a
 * project re-bound to a second cluster must never be served the first
 * cluster's cached thumbnails.
 */
function cacheKey(connectionId: string, clusterPath: string): string {
  return createHash("sha1").update(`${connectionId}:${clusterPath}`).digest("hex");
}

/* ------------------------------------------------------------------ */
/* The manifest's sample round                                          */
/* ------------------------------------------------------------------ */

export interface ClusterSampleEntry {
  /** the cluster-absolute path (the preview door's key) */
  path: string;
  name: string;
  /** bytes (0 when the stat failed) */
  size: number;
  nx: number;
  ny: number;
  /** header verdict for the caption ("stack"/"single"/"unknown") */
  kind: string;
}

export interface ClusterSample {
  host: string;
  connectionName: string;
  /** total image rows in the star (t317: the FULL row count, not just the
   *  cluster-absolute subset — the "N micrographs live on …" figure must
   *  not under-report mixed stars). */
  total: number;
  sample: ClusterSampleEntry[];
}

/**
 * Stat + header-sniff the sampled paths in ONE SSH exec. Every individual
 * failure degrades to zeros/unknown — the gallery still shows the row, it
 * just shows less about it. Returns null when the whole round failed (dead
 * connection) — the route then answers the honest error.
 *
 * t317 — every echoed line carries the CF| sentinel AND its own path
 * (`CF|<path>|<size>|<b64>`), and parsing maps BY PATH instead of line
 * index: login shells print banner noise (.bashrc lines containing "|" —
 * the t311 ticket proved real clusters do), and one noise line used to
 * shift the whole index alignment (sizes/dims/kind misattributed across
 * all five entries). base64 never contains "|", so the sentinel grammar
 * is unambiguous.
 */
export async function remoteClusterSample(
  connectionId: string,
  samplePaths: string[],
  total: number
): Promise<ClusterSample | null> {
  const conn = getConnection(connectionId);
  if (!conn) return null;
  const script =
    `for f in ${samplePaths.map((p) => shQuote(p)).join(" ")}; do ` +
    `s=$(stat -c %s "$f" 2>/dev/null || echo 0); ` +
    `h=$(head -c 64 "$f" 2>/dev/null | base64 | tr -d '\\n'); ` +
    `echo "CF|$f|$s|$h"; done`;
  let stdout = "";
  try {
    const r = await exec(conn, script, { timeoutMs: 20_000 });
    if (r.error) return null;
    stdout = r.stdout ?? "";
  } catch {
    return null;
  }
  const byPath = new Map<string, string>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith("CF|")) continue; // sentinel — banner noise cannot forge it
    const cells = line.slice(3).split("|");
    if (cells.length >= 2) byPath.set(cells[0], cells.slice(1).join("|"));
  }
  const sample: ClusterSampleEntry[] = samplePaths.map((p) => {
    const line = byPath.get(p) ?? "0|";
    const pipe = line.indexOf("|");
    const size = Number.parseInt(line.slice(0, pipe), 10);
    let nx = 0;
    let ny = 0;
    let kind = "unknown";
    try {
      const b64 = line.slice(pipe + 1).trim();
      if (b64.length > 0) {
        const buf = Buffer.from(b64, "base64");
        if (buf.length >= 16) {
          const verdict: SniffVerdict = sniffImageFile(p, buf);
          if (verdict.kind === "mrc-single" || verdict.kind === "mrc-stack") {
            nx = verdict.facts?.nx ?? 0;
            ny = verdict.facts?.ny ?? 0;
            kind = verdict.kind === "mrc-stack" ? "stack" : "single";
          }
        }
      }
    } catch {
      /* header best-effort */
    }
    return {
      path: p,
      name: path.basename(p),
      size: Number.isFinite(size) ? size : 0,
      nx,
      ny,
      kind,
    };
  });
  return {
    host: conn.host,
    connectionName: conn.name || `${conn.username}@${conn.host}`,
    total,
    sample,
  };
}

/* ------------------------------------------------------------------ */
/* t322 — the decimation ladder (compress on the cluster, render here)  */
/* ------------------------------------------------------------------ */

/** One thinned pixel grid, as it arrived from the cluster. */
export interface DecimatedGrid {
  tier: "python" | "dd";
  /** the FILE's own dims (telemetry + plausibility — not the grid's). */
  fileNx: number;
  fileNy: number;
  fileNz: number;
  mode: number;
  /** the grid: python tier → both axes thinned; dd tier → FULL-width rows
   * (renderDecimatedPng thins the columns locally with the same step
   * math, so every tier renders byte-identical PNGs). */
  grid: { data: Float32Array; width: number; height: number };
  /** payload bytes that actually traveled the wire (base64-decoded). */
  payloadBytes: number;
}

/**
 * Tier 1 — python3, PURE STDLIB (struct + file seeks, no numpy): parses
 * the MRC header itself, decimates BOTH axes with nearest-neighbour
 * strides, emits a `CFD|PY|…` sentinel line + base64 raw voxels. A
 * ~4096×4096 float32 micrograph's 384-px thumb transfers ~0.5 MB instead
 * of 64 MB. Any bad header / short read prints `CFD|ERR|…` and exits 0
 * (the caller falls to the next tier — an error message on stdout would
 * poison nothing, but the sentinel grammar keeps it unambiguous).
 */
export function buildPythonDecimateCmd(
  clusterPath: string,
  maxW: number,
  sliceSel: "first" | "mid"
): string {
  const script = [
    "import base64, struct, sys",
    "path, maxw, sel = sys.argv[1], int(sys.argv[2]), sys.argv[3]",
    "try:",
    "    f = open(path, 'rb', buffering=0)",
    "    h = f.read(1024)",
    "    if len(h) < 96:",
    "        print('CFD|ERR|short-header'); sys.exit(0)",
    "    nx, ny, nz, mode = struct.unpack('<4i', h[:16])",
    "    ns = struct.unpack('<i', h[92:96])[0]",
    "    bpp = {0: 1, 1: 2, 2: 4, 6: 2}.get(mode, 0)",
    "    ok = bpp and 0 < nx <= 200000 and 0 < ny <= 200000 and 0 < nz <= 100000 and 0 <= ns <= 100000000",
    "    if not ok:",
    "        print('CFD|ERR|bad-header'); sys.exit(0)",
    "    z = (nz // 2) if sel == 'mid' else 0",
    "    if z >= nz: z = nz - 1",
    "    step = -(-nx // maxw)",
    "    if step < 1: step = 1",
    "    w = -(-nx // step)",
    "    hh = -(-ny // step)",
    "    base = 1024 + ns + z * ny * nx * bpp",
    "    out = bytearray()",
    "    for r in range(hh):",
    "        row = r * step",
    "        if row > ny - 1: row = ny - 1",
    "        f.seek(base + row * nx * bpp)",
    "        rb = f.read(nx * bpp)",
    "        if len(rb) < nx * bpp:",
    "            print('CFD|ERR|short-read'); sys.exit(0)",
    "        # every step-TH VOXEL, all of its bytes (a byte-slice rb[::step*bpp]",
    "        # would keep only the first byte of each voxel — mode-2 murder)",
    "        for i in range(0, nx, step):",
    "            o = i * bpp",
    "            out += rb[o:o + bpp]",
    "    print('CFD|PY|%d|%d|%d|%d|%d|%d|%d' % (nx, ny, nz, mode, w, hh, bpp))",
    "    sys.stdout.flush()",
    "    sys.stdout.buffer.write(base64.b64encode(bytes(out)) + b'\\n')",
    "    sys.stdout.buffer.flush()",
    "except Exception:",
    "    print('CFD|ERR|exception')",
  ].join("\n");
  return (
    `python3 - ${shQuote(clusterPath)} ${maxW} ${sliceSel} <<'CFDPY'\n` +
    `${script}\nCFDPY`
  );
}

/** the dd tier refuses to emit more than this (python tier is bounded by
 * maxW² × 4 ≈ 2.4 MB by construction) */
const DD_PAYLOAD_CAP = 48 * 1024 * 1024;

/**
 * Tier 2 — GNU dd strided rows (no python3 on the login node): od reads
 * the header fields, then one `dd iflag=skip_bytes,count_bytes` per kept
 * row (row stride = ceil(nx/maxW), the same step downsample() uses).
 * Full-width rows travel (~11× less than the whole file for a 4096-px
 * micrograph); the columns thin locally at render time. A non-GNU dd
 * (no iflag support) writes nothing — the payload length check fails and
 * the caller falls to the whole-file tier.
 */
export function buildDdDecimateCmd(
  clusterPath: string,
  maxW: number,
  sliceSel: "first" | "mid"
): string {
  const F = shQuote(clusterPath);
  return [
    "F=" + F,
    `NX=$(od -An -tu4 -j0 -N4 ${F} 2>/dev/null | tr -d ' \n')`,
    `NY=$(od -An -tu4 -j4 -N4 ${F} 2>/dev/null | tr -d ' \n')`,
    `NZ=$(od -An -tu4 -j8 -N4 ${F} 2>/dev/null | tr -d ' \n')`,
    `MODE=$(od -An -tu4 -j12 -N4 ${F} 2>/dev/null | tr -d ' \n')`,
    `NS=$(od -An -tu4 -j92 -N4 ${F} 2>/dev/null | tr -d ' \n')`,
    `if [ -z "$NX" ] || [ -z "$NY" ] || [ -z "$NZ" ] || [ -z "$MODE" ] || [ -z "$NS" ]; then echo "CFD|ERR|bad-header"; exit 0; fi`,
    `if [ "$NX" -le 0 ] || [ "$NY" -le 0 ] || [ "$NZ" -le 0 ] || [ "$NS" -lt 0 ] || [ "$NX" -gt 200000 ] || [ "$NY" -gt 200000 ] || [ "$NZ" -gt 100000 ] || [ "$NS" -gt 100000000 ]; then echo "CFD|ERR|bad-header"; exit 0; fi`,
    `case "$MODE" in 0) BPP=1 ;; 1|6) BPP=2 ;; 2) BPP=4 ;; *) echo "CFD|ERR|bad-header"; exit 0 ;; esac`,
    `STEP=$(( (NX + ${maxW} - 1) / ${maxW} ))`,
    `[ "$STEP" -lt 1 ] && STEP=1`,
    `ROWS=$(( (NY + STEP - 1) / STEP ))`,
    `RB=$(( NX * BPP ))`,
    sliceSel === "mid" ? `Z=$(( NZ / 2 ))` : `Z=0`,
    `[ "$Z" -ge "$NZ" ] && Z=$(( NZ - 1 ))`,
    `BASE=$(( 1024 + NS + Z * NY * NX * BPP ))`,
    // a pathological width would make the row payload huge — refuse and
    // let the whole-file tier's own cap + teaching answer instead
    `if [ $(( ROWS * RB )) -gt ${DD_PAYLOAD_CAP} ]; then echo "CFD|ERR|too-big"; exit 0; fi`,
    `echo "CFD|DD|$NX|$NY|$NZ|$MODE|$ROWS|$RB"`,
    "{ I=0",
    `while [ "$I" -lt "$ROWS" ]; do`,
    `  R=$(( I * STEP )); [ "$R" -ge "$NY" ] && R=$(( NY - 1 ))`,
    `  dd if="$F" bs=65536 iflag=skip_bytes,count_bytes skip=$(( BASE + R * RB )) count="$RB" status=none 2>/dev/null`,
    `  I=$(( I + 1 ))`,
    `done; } | base64 | tr -d '\n'`,
    `echo`,
  ].join("\n");
}

/**
 * Parse a ladder tier's stdout: the `CFD|…` sentinel line + base64
 * payload. Banner noise BEFORE the sentinel is skipped (t317 doctrine);
 * the payload is sliced to its EXPECTED length so trailing noise (a
 * login shell's logout banner) cannot poison the decode. Any mismatch →
 * null (the caller falls to the next tier).
 */
export function parseDecimateResponse(stdout: string): DecimatedGrid | null {
  const lines = stdout.split(/\r?\n/);
  let idx = -1;
  let hdr = "";
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("CFD|")) {
      idx = i;
      hdr = lines[i];
      break;
    }
  }
  if (idx < 0) return null;
  const cells = hdr.split("|");
  if (cells[1] === "ERR") return null;
  const body = lines.slice(idx + 1).join("");

  // python tier: CFD|PY|nx|ny|nz|mode|w|h|bpp → w×h both-thinned voxels
  if (cells[1] === "PY") {
    const [nx, ny, nz, mode, w, h, bpp] = cells.slice(2).map(Number);
    if (![nx, ny, nz, mode, w, h, bpp].every((v) => Number.isFinite(v) && v > 0)) return null;
    const expectBytes = w * h * bpp;
    if (expectBytes > 64 * 1024 * 1024) return null;
    const expectChars = 4 * Math.ceil(expectBytes / 3);
    const payload = body.replace(/[^A-Za-z0-9+/=]/g, "").slice(0, expectChars);
    if (payload.length < expectChars) return null;
    const raw = Buffer.from(payload, "base64");
    if (raw.length !== expectBytes) return null;
    return {
      tier: "python",
      fileNx: nx,
      fileNy: ny,
      fileNz: nz,
      mode,
      grid: { data: decodeRawVoxels(raw, mode, w * h), width: w, height: h },
      payloadBytes: raw.length,
    };
  }

  // dd tier: CFD|DD|nx|ny|nz|mode|rows|rowbytes → rows FULL-width rows
  if (cells[1] === "DD") {
    const [nx, ny, nz, mode, rows, rb] = cells.slice(2).map(Number);
    if (![nx, ny, nz, mode, rows, rb].every((v) => Number.isFinite(v) && v > 0)) return null;
    const expectBytes = rows * rb;
    if (expectBytes > DD_PAYLOAD_CAP) return null;
    const expectChars = 4 * Math.ceil(expectBytes / 3);
    const payload = body.replace(/[^A-Za-z0-9+/=]/g, "").slice(0, expectChars);
    if (payload.length < expectChars) return null;
    const raw = Buffer.from(payload, "base64");
    if (raw.length !== expectBytes) return null;
    return {
      tier: "dd",
      fileNx: nx,
      fileNy: ny,
      fileNz: nz,
      mode,
      grid: { data: decodeRawVoxels(raw, mode, nx * rows), width: nx, height: rows },
      payloadBytes: raw.length,
    };
  }
  return null;
}

/** Run one ladder tier; null on any exec error (dead connection, timeout). */
async function execOrNone(conn: NonNullable<ReturnType<typeof getConnection>>, cmd: string): Promise<string | null> {
  try {
    const r = await exec(conn, cmd, { timeoutMs: 45_000 });
    if (r.error) return null;
    return r.stdout;
  } catch {
    return null;
  }
}

/**
 * The ladder: python3 first (smallest transfer), GNU dd strided rows
 * second, null when neither dialect served — the caller then falls back
 * to the whole-file pull. Both scripts are cluster-side pure: no uploads,
 * no temp files, nothing left behind.
 */
export async function remoteDecimatedFetch(
  connectionId: string,
  clusterPath: string,
  maxW: number,
  sliceSel: "first" | "mid"
): Promise<DecimatedGrid | null> {
  const conn = getConnection(connectionId);
  if (!conn) return null;
  const py = parseDecimateResponse(
    (await execOrNone(conn, buildPythonDecimateCmd(clusterPath, maxW, sliceSel))) ?? ""
  );
  if (py) return py;
  const dd = parseDecimateResponse(
    (await execOrNone(conn, buildDdDecimateCmd(clusterPath, maxW, sliceSel))) ?? ""
  );
  if (dd) return dd;
  return null;
}

/* ------------------------------------------------------------------ */
/* The thumbnail door                                                   */
/* ------------------------------------------------------------------ */

export type RemotePreviewResult =
  | { ok: true; png: Buffer; tier: "cache" | "python" | "dd" | "full"; fetchedBytes?: number }
  | { ok: false; error: string; status: number };

const rendering = new Map<string, Promise<RemotePreviewResult>>();

/**
 * The cached PNG for one cluster-absolute micrograph path. Concurrent
 * requests for the same path+scale share one pull+render (the gallery fires
 * five at once). The rendered PNG persists; the fetched .mrc does not. `scale`
 * mirrors the outputs/file door: "thumb" (grid) vs "large" (the lightbox's
 * full contrast-stretched view) — separate cache files, a large request
 * after a thumb re-pulls (the .mrc is transient by design).
 *
 * t317 — three keying fixes: (a) the in-flight key AND the cache hash name
 * the CONNECTION (a re-bound project must not collide with another
 * cluster's identical path, in memory or on disk); (b) the transient .mrc
 * carries the SCALE in its filename — thumb and large used to download to
 * the SAME file and the first finisher's finally-rmSync deleted it under
 * the second's render ("could not render this MRC file" under a concurrent
 * thumb+lightbox); each scale now owns its own transient copy (worst case
 * one extra 64 MB pull, correctness over cleverness).
 */
export async function remotePreviewPng(
  connectionId: string,
  clusterPath: string,
  scale: "thumb" | "large" = "thumb"
): Promise<RemotePreviewResult> {
  const suffix = scale === "large" ? ".large" : "";
  const key = cacheKey(connectionId, clusterPath);
  const cached = path.join(PREVIEW_DIR, `${key}${suffix}.png`);
  try {
    if (existsSync(cached)) {
      const png = await readCachedPng(cached);
      if (png) return { ok: true, png, tier: "cache" };
    }
  } catch {
    /* fall through to a fresh render */
  }
  const inFlightKey = `${connectionId}:${scale}:${clusterPath}`;
  const existing = rendering.get(inFlightKey);
  if (existing) return existing;
  const task = (async (): Promise<RemotePreviewResult> => {
    const conn = getConnection(connectionId);
    if (!conn) {
      return { ok: false, error: "cluster connection not found — it may have been deleted", status: 404 };
    }
    mkdirSync(PREVIEW_DIR, { recursive: true });

    // t322 — tiers 1–2: decimate ON THE CLUSTER, transfer the thin pixels,
    // render locally through the same stretch pipeline. The step math
    // mirrors downsample() exactly, so the PNG is byte-identical to a
    // whole-file render — only the wire bill shrinks (the user's “在集群
    // 上先压缩再传回本地” ask).
    const maxW = scale === "large" ? 768 : 384;
    const sliceSel = scale === "large" ? "first" : "mid";
    const dec = await remoteDecimatedFetch(connectionId, clusterPath, maxW, sliceSel);
    if (dec) {
      const png = await renderDecimatedPng(dec.grid.data, dec.grid.width, dec.grid.height, maxW);
      if (png) {
        try {
          writeFileSync(cached, png);
        } catch {
          /* cache write is best-effort — the bytes still serve */
        }
        return { ok: true, png, tier: dec.tier, fetchedBytes: dec.payloadBytes };
      }
      // a payload that cannot render (a header lying about its dims)
      // falls through to the whole-file tier — the full render referees
    }

    // tier 3 — the whole-file pull (FETCH_CAP + teaching refusal): the
    // last resort for shells that speak neither dialect of the ladder.
    // scale-suffixed: the thumb and large legs never share a transient file
    const mrc = path.join(PREVIEW_DIR, `${key}.${scale}.mrc`);
    try {
      const got = await remoteDownload(conn, clusterPath, mrc, FETCH_CAP);
      if (got == null) {
        return { ok: false, error: `could not fetch ${clusterPath} from ${conn.host}`, status: 404 };
      }
      if (got < 0) {
        return {
          ok: false,
          error: `${clusterPath} is larger than the 512 MB preview fetch cap — a raw frame stack does not preview as one image; import its MotionCor2 summed micrographs instead`,
          status: 400,
        };
      }
      const png =
        scale === "large"
          ? await renderMrcLargePng(mrc, 0, undefined)
          : await renderMrcSlicePng(mrc, undefined, undefined);
      if (!png) {
        return { ok: false, error: "could not render this MRC file", status: 400 };
      }
      try {
        writeFileSync(cached, png);
      } catch {
        /* cache write is best-effort — the bytes still serve */
      }
      return { ok: true, png, tier: "full", fetchedBytes: got };
    } finally {
      try {
        if (existsSync(mrc)) rmSync(mrc, { force: true });
      } catch {
        /* transient fetch cleanup — best-effort */
      }
    }
  })();
  rendering.set(inFlightKey, task);
  try {
    return await task;
  } finally {
    rendering.delete(inFlightKey);
  }
}

/** Read the CACHED png file bytes (no re-render). */
async function readCachedPng(file: string): Promise<Buffer | null> {
  try {
    const st = statSync(file);
    if (!st.isFile() || st.size === 0) return null;
    return readFileSync(file);
  } catch {
    return null;
  }
}
