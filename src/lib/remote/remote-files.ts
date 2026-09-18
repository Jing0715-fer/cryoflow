/**
 * CryoFlow — remote file manifest + on-demand fetch (SERVER ONLY).
 *
 * t289 — "results live on the cluster, the laptop borrows them". The
 * key-files sync policy leaves bulky outputs (maps, particle stacks,
 * micrographs) on the cluster at finalize; THIS module is the other half:
 *
 *   writeRemoteManifest  finalize's ledger — every file the cluster's
 *                        workdir holds (path + size), dropped into the LOCAL
 *                        mirror as `.cf-remote-manifest.json` (a dotfile:
 *                        the outputs walk skips it, the sync-back find skips
 *                        it — it is bookkeeping, not data).
 *   readRemoteManifest   the outputs listing merges manifest entries that
 *                        are not (yet) local, marked `remote: true` — the
 *                        user SEES what the cluster holds without paying a
 *                        byte for it.
 *   fetchRemoteFileIntoWorkdir  the lazy leg. A single explicit user action
 *                        (preview / download / View in 3D) pulls exactly one
 *                        file over SSH into the local mirror — after which
 *                        every existing viewer (PNG render, histogram, Mol*,
 *                        STAR tables, downstream local runs) works on it
 *                        unchanged. STAR files are rewritten to-local with
 *                        the same rules the sync-back uses, so a fetched
 *                        particle star is immediately usable downstream.
 *
 * Deliberately NOT a cache: a fetched file lands at its real workdir path.
 * "Download on click" is what the user asked for — the file becomes local
 * data, not an evictable thumbnail.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import path from "path";
import type { RemoteRunState } from "./types";
import { getConnection } from "./connections";
import { remoteDownload, remoteStat } from "./ssh";
import { rewriteStarPaths } from "./remote-run";

/** Hard ceiling for a single on-demand fetch (32 GB) — the click is the
 * user's explicit intent, but infinity is not a policy. */
const FETCH_CAP_BYTES = 32 * 1024 * 1024 * 1024;

export const REMOTE_MANIFEST_NAME = ".cf-remote-manifest.json";

export interface RemoteManifestEntry {
  /** path relative to the job workdir (posix separators) */
  path: string;
  size: number;
}

export interface RemoteManifest {
  version: 1;
  connectionId: string;
  remoteWorkdir: string;
  writtenAt: string;
  files: RemoteManifestEntry[];
}

export function remoteManifestPath(workdir: string): string {
  return path.join(workdir, REMOTE_MANIFEST_NAME);
}

/** Read the finalize-time ledger (null when the run never finalized or the
 * file is unreadable — callers treat that as "nothing remote to say"). */
export function readRemoteManifest(workdir: string): RemoteManifest | null {
  try {
    const raw = readFileSync(remoteManifestPath(workdir), "utf8");
    const parsed = JSON.parse(raw) as RemoteManifest;
    if (!parsed || !Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Atomically write the ledger (best-effort: a manifest failure must never
 * fail a finalize that already synced real data). */
export function writeRemoteManifest(
  workdir: string,
  manifest: Omit<RemoteManifest, "version" | "writtenAt"> & { writtenAt?: string }
): void {
  try {
    mkdirSync(workdir, { recursive: true });
    const full: RemoteManifest = {
      version: 1,
      writtenAt: manifest.writtenAt ?? new Date().toISOString(),
      connectionId: manifest.connectionId,
      remoteWorkdir: manifest.remoteWorkdir,
      files: manifest.files,
    };
    writeFileSync(remoteManifestPath(workdir), JSON.stringify(full, null, 2));
  } catch {
    /* best-effort bookkeeping */
  }
}

/** Is this relative path recorded in the manifest? (lexical check only —
 * the fetch itself stat-verifies over SSH before pulling). */
export function manifestHas(manifest: RemoteManifest | null, rel: string): boolean {
  return manifest?.files.some((f) => f.path === rel) ?? false;
}

/* ------------------------------------------------------------------ */
/* On-demand fetch                                                     */
/* ------------------------------------------------------------------ */

export type RemoteFetchResult =
  | { ok: true; bytes: number }
  | { ok: false; error: string; status: number };

/** In-flight dedup: a gallery preview and its Mol* sibling may both ask for
 * the same map within one paint — one SSH pull, both callers wait on it. */
const inFlight = new Map<string, Promise<RemoteFetchResult>>();

function safeRel(rel: string): string | null {
  if (
    !rel ||
    rel.startsWith("/") ||
    rel.startsWith("\\") ||
    rel.includes("\0") ||
    rel.split("/").includes("..")
  ) {
    return null;
  }
  return rel;
}

/**
 * Pull one file from the cluster's workdir into the local mirror. Verified
 * over SSH before the pull (remoteStat), capped at FETCH_CAP_BYTES, STAR
 * files rewritten to-local — the lazy twin of the sync-back's per-file leg.
 * t298 — a FAILED pull leaves NO partial file behind: a half-written map on
 * disk would graduate the tile to "local" and feed every viewer garbage
 * (the listing walks the workdir, the header reads what is there).
 */
async function fetchIntoWorkdir(
  workdir: string,
  remote: RemoteRunState,
  rel: string
): Promise<RemoteFetchResult> {
  const clean = safeRel(rel);
  if (!clean) return { ok: false, error: "Invalid path", status: 400 };
  const conn = getConnection(remote.connectionId);
  if (!conn) {
    return {
      ok: false,
      error: "The cluster connection for this run was deleted — the file stays on the cluster",
      status: 404,
    };
  }
  const remotePath = `${remote.remoteWorkdir}/${clean}`;
  // existence + size over SSH (a directory or a vanished path answers
  // null — remoteStat's `stat -c` cannot tell them apart, but a directory
  // then fails the cat below and lands in the 502 branch honestly)
  const st = await remoteStat(conn, remotePath);
  if (st == null) {
    return { ok: false, error: "File not found on the cluster", status: 404 };
  }
  if (st.size > FETCH_CAP_BYTES) {
    return {
      ok: false,
      error: `File is ${(st.size / 1024 / 1024 / 1024).toFixed(1)} GB — above the 32 GB on-demand fetch ceiling`,
      status: 413,
    };
  }
  const localPath = path.join(workdir, clean);
  // t298 — the byte-count verdict. The SSH layer (ssh2's channel buffers,
  // the Bun client's quirks under load) can silently truncate a big `cat`
  // mid-stream while still reporting success — the t298 probe caught the
  // mock losing 1.6–48 MB per 64 MB transfer with exit=0. A landed file is
  // only believed when its byte count MATCHES the pre-pull remoteStat; a
  // short read gets up to two honest retries, then the partial is destroyed and the
  // door refuses (502) — feeding a viewer a truncated map is the one thing
  // this door must never do.
  const expected = st.size;
  let written: number | null = null;
  let landed = -1;
  // five attempts, a breath between: a load spike (a Mol* parse churning
  // the box) can squeeze several transfers in a row — the bun+ssh2 receive side stalls in quantized 5 MiB stops under load (the t298 exam), and each retry rides a fresh exec channel
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 250));
    written = await remoteDownload(conn, remotePath, localPath, FETCH_CAP_BYTES);
    if (written == null || written < 0) break;
    try {
      landed = statSync(localPath).size;
    } catch {
      landed = -1;
    }
    if (landed === expected) break;
  }
  if (written == null || written < 0 || landed !== expected) {
    // t298 — no tombstones: a failed pull must not leave a partial file at
    // the real workdir path (the fast-path and the listing would believe it)
    try { rmSync(localPath, { force: true }); } catch { /* best effort */ }
    if (written != null && written >= 0) {
      return {
        ok: false,
        error: `Fetch from the cluster came up short (${landed} of ${expected} bytes, retried once) — refused rather than served truncated`,
        status: 502,
      };
    }
    return { ok: false, error: "Fetch from the cluster failed (SSH transfer error)", status: 502 };
  }
  // STAR rewrite to-local — the same contract the sync-back applies, so a
  // fetched particle star feeds downstream LOCAL runs and local viewers.
  if (/\.star$/i.test(localPath)) {
    try {
      const text = readFileSync(localPath, "utf8");
      const rewritten = rewriteStarPaths(text, "to-local", remote.remoteRoot);
      if (rewritten !== text) writeFileSync(localPath, rewritten);
    } catch {
      /* best-effort */
    }
  }
  return { ok: true, bytes: written };
}

/**
 * Public door (dedup-wrapped): fetch `rel` into the local mirror of a remote
 * run. Idempotent — if the file already exists locally the answer is an
 * immediate ok (0 bytes pulled).
 *
 * t298 — the in-flight check comes FIRST: the fast-path's existsSync can
 * otherwise see the file a concurrent download has just CREATED (empty, then
 * growing) and stream it as if complete — the second caller of a gallery +
 * Mol* race served a truncated map. Only when NO pull is in flight does a
 * landed file mean a COMPLETE file (remoteDownload resolves after the write
 * stream flushes).
 */
export async function fetchRemoteFileIntoWorkdir(
  run: { workdir: string; remote?: RemoteRunState },
  rel: string
): Promise<RemoteFetchResult> {
  const remote = run.remote;
  if (!remote) return { ok: false, error: "Not a remote run", status: 400 };
  const localPath = path.join(run.workdir, rel);
  const key = `${remote.remoteWorkdir}::${rel}`;
  let p = inFlight.get(key);
  if (!p) {
    if (existsSync(localPath)) return { ok: true, bytes: 0 };
    p = fetchIntoWorkdir(run.workdir, remote, rel).finally(() => inFlight.delete(key));
    inFlight.set(key, p);
  }
  const res = await p;
  // the in-flight twin may have finished while a second caller raced the
  // existsSync above — an ok is an ok either way
  if (!res.ok && existsSync(localPath)) return { ok: true, bytes: 0 };
  return res;
}
