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
 *                          path. Miss: remoteDownload the whole file into
 *                          the cache dir (64 MB is one cluster-LAN pull),
 *                          renderMrcSlicePng it (2–98% contrast stretch,
 *                          same pipeline as every local thumbnail), write
 *                          the PNG, DELETE the fetched .mrc — the cache
 *                          holds kilobyte-scale PNGs, not the data itself.
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
import { renderMrcLargePng, renderMrcSlicePng } from "@/lib/mrc";
import { sniffImageFile, type SniffVerdict } from "@/lib/relion/mrc-sniff";

/** Where thumbnails + transient fetches live (under the app data root). */
const PREVIEW_DIR = path.join(DATA_DIR, "remote-preview");

/** A fetched micrograph is deleted after rendering — this is the ceiling we
 *  are willing to pull through the door (a sum image is ~64–256 MB). */
const FETCH_CAP = 2 * 1024 * 1024 * 1024;

function cacheKey(clusterPath: string): string {
  return createHash("sha1").update(clusterPath).digest("hex");
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
  /** total image rows in the star (the "N micrographs live on …" figure) */
  total: number;
  sample: ClusterSampleEntry[];
}

/**
 * Stat + header-sniff the sampled paths in ONE SSH exec. Every individual
 * failure degrades to zeros/unknown — the gallery still shows the row, it
 * just shows less about it. Returns null when the whole round failed (dead
 * connection) — the route then answers the honest error.
 */
export async function remoteClusterSample(
  connectionId: string,
  rows: string[],
  samplePaths: string[]
): Promise<ClusterSample | null> {
  const conn = getConnection(connectionId);
  if (!conn) return null;
  const script =
    `for f in ${samplePaths.map((p) => shQuote(p)).join(" ")}; do ` +
    `s=$(stat -c %s "$f" 2>/dev/null || echo 0); ` +
    `h=$(head -c 64 "$f" 2>/dev/null | base64 | tr -d '\\n'); ` +
    `echo "$s|$h"; done`;
  let stdout = "";
  try {
    const r = await exec(conn, script, { timeoutMs: 20_000 });
    if (r.error) return null;
    stdout = r.stdout ?? "";
  } catch {
    return null;
  }
  const lines = stdout.split(/\r?\n/).filter((l) => l.includes("|"));
  const sample: ClusterSampleEntry[] = samplePaths.map((p, i) => {
    const line = lines[i] ?? "|";
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
    total: rows.length,
    sample,
  };
}

/* ------------------------------------------------------------------ */
/* The thumbnail door                                                   */
/* ------------------------------------------------------------------ */

export type RemotePreviewResult =
  | { ok: true; png: Buffer }
  | { ok: false; error: string; status: number };

const rendering = new Map<string, Promise<RemotePreviewResult>>();

/**
 * The cached PNG for one cluster-absolute micrograph path. Concurrent
 * requests for the same path share one pull+render (the gallery fires five
 * at once). The rendered PNG persists; the fetched .mrc does not. `scale`
 * mirrors the outputs/file door: "thumb" (grid) vs "large" (the lightbox's
 * full contrast-stretched view) — separate cache files, a large request
 * after a thumb re-pulls (the .mrc is transient by design).
 */
export async function remotePreviewPng(
  connectionId: string,
  clusterPath: string,
  scale: "thumb" | "large" = "thumb"
): Promise<RemotePreviewResult> {
  const suffix = scale === "large" ? ".large" : "";
  const cached = path.join(PREVIEW_DIR, `${cacheKey(clusterPath)}${suffix}.png`);
  try {
    if (existsSync(cached)) {
      const png = await readCachedPng(cached);
      if (png) return { ok: true, png };
    }
  } catch {
    /* fall through to a fresh render */
  }
  const existing = rendering.get(`${scale}:${clusterPath}`);
  if (existing) return existing;
  const task = (async (): Promise<RemotePreviewResult> => {
    const conn = getConnection(connectionId);
    if (!conn) {
      return { ok: false, error: "cluster connection not found — it may have been deleted", status: 404 };
    }
    mkdirSync(PREVIEW_DIR, { recursive: true });
    const mrc = path.join(PREVIEW_DIR, `${cacheKey(clusterPath)}.mrc`);
    try {
      const got = await remoteDownload(conn, clusterPath, mrc, FETCH_CAP);
      if (got == null) {
        return { ok: false, error: `could not fetch ${clusterPath} from ${conn.host}`, status: 404 };
      }
      if (got < 0) {
        return { ok: false, error: `${clusterPath} is larger than the preview fetch cap`, status: 400 };
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
      return { ok: true, png };
    } finally {
      try {
        if (existsSync(mrc)) rmSync(mrc, { force: true });
      } catch {
        /* transient fetch cleanup — best-effort */
      }
    }
  })();
  rendering.set(`${scale}:${clusterPath}`, task);
  try {
    return await task;
  } finally {
    rendering.delete(`${scale}:${clusterPath}`);
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
