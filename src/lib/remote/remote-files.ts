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
// t367 — the exists-only fast path learned to read MRC headers: a corrupt
// local copy (the zero-header ghost a size-only sync-back once adopted)
// is NOT "already there" — the door re-pulls instead of serving the
// ghost to another download.
import { readMrcHeader } from "@/lib/mrc";
// t387 — the witness ladder heals a poisoned login-node cache before the
// door refuses a right-sized zero-header MRC (the GPU-lane live polls are
// the mid-write readers that planted those pages).
import { witnessMrcHeader } from "./cache-witness";

/** t367 — true when the file at `p` is trustworthy as a cached local copy:
 * non-MRC formats always are (the byte account was their verdict); an
 * MRC/MRCS/MAP must still PARSE — an unparseable header is the ghost
 * shape, whatever its size, and earns a re-pull. */
function localCopyReads(p: string): boolean {
  if (!/\.(mrcs?|map)$/i.test(p)) return true;
  try {
    return readMrcHeader(p) != null;
  } catch {
    return false;
  }
}

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
  /** t464 — honest incompleteness: the enumeration that built this ledger
   * hit the cap (REMOTE_MANIFEST_MAX) and the cluster holds MORE files than
   * the ledger lists. Absent/undefined = the ledger saw the whole workdir
   * (the overwhelmingly common world; also every pre-t464 ledger, which
   * readers treat as complete — the old ledgers were complete unless the
   * silent t460-era cap bit, and nothing can retroactively know that). */
  truncated?: boolean;
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
      ...(manifest.truncated != null ? { truncated: manifest.truncated } : {}),
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
/* t464 — the enumeration grammar: who gets listed, and who admits     */
/* the listing is short                                                */
/* ------------------------------------------------------------------ */

/**
 * t460 closed a truncation bug by raising the sync-back find's cap from
 * 4,000 to 20,000 — but the cap stayed a bare `head -20000` in readdir
 * order, which means a BIGGER world (a real-cluster class2d run with
 * per-micrograph graphs, iter counts in the hundreds) hits the same wall
 * the same way: the FINAL family (run_data / run_model / run_optimiser
 * .star at the workdir root, readdir-order behind hundreds of round
 * files) gets cut again, the ledger again reads a silently incomplete
 * world, and nothing says so.
 *
 * t464 closes it with three moves that keep the one-SSH-round doctrine:
 *
 *   1. THE DOOR LEADS BY NAME, NOT BY LUCK. The enumeration is four
 *      mutually-disjoint find bands — (a) the FINAL family at the workdir
 *      root, pinned by exact name (run_data / run_model / run_optimiser
 *      .star — the files every workdir-derived route reads first);
 *      (b) the root's remaining .star files (the rest of the data spine);
 *      (c) the root's non-star files (note.txt, run.out/err, the class
 *      averages); (d) everything deeper. The t464 field survey found the
 *      real class2d mirror is a FLAT tree — 11.4k files all at depth 1 —
 *      so a bare root-first split would still leave the door racing
 *      thousands of particles_class*.star in readdir order. Any cap now
 *      spends its budget door-first, then spine, then front door, then
 *      deep history — never on readdir luck again.
 *   2. THE CANARY. `head` takes cap+1 lines; the parser counts them. One
 *      line past the cap is the exact, free admission that the world is
 *      bigger than the ledger — no second traversal, no wc -l round.
 *   3. THE FLAG TRAVELS. truncated rides the ledger JSON itself, so the
 *      Files tab (which already reads the manifest) can speak the one
 *      honest sentence the t460 field report lacked.
 *
 * The cap stays a cap (the SSH payload must stay bounded), but it is now
 * tunable for worlds that need more: CF_SYNC_MANIFEST_MAX, same dialect
 * as CF_BROWSER_MAX in browse-caps.ts.
 */

/** Hard ceiling for the sync-back manifest enumeration — files listed in
 * `.cf-remote-manifest.json` (the ledger), not files pulled home (the
 * sync policy's own caps govern that). Default 20,000 ≈ the t460 class2d
 * VDAM world (iter=200 → ~11.5k files) with headroom; CF_SYNC_MANIFEST_MAX
 * re-tunes it for bigger clusters. */
export const REMOTE_MANIFEST_MAX = Math.min(
  500_000,
  Math.max(1_000, Number(process.env.CF_SYNC_MANIFEST_MAX) || 20_000)
);

/**
 * The one-round, door-first enumeration script for a job workdir over SSH.
 * `quotedDir` is the caller's shQuote'd workdir path (the caller owns the
 * quoting; the script only cds into it). Four bands, mutually disjoint by
 * construction (door ⊂ root stars; band b = root stars \ door; band c =
 * root \ stars; band d = depth ≥ 2 — no dedup pass needed): the FINAL
 * family (run_data / run_model / run_optimiser.star, exact names — the
 * t460 field report's door), then the root's remaining stars, then the
 * root's other files, then everything deeper. All bands exclude the
 * ledger itself (.cf-*); the deep band additionally excludes the t385
 * wipe archive (.cryoflow_prev — the WIPE'S OWN PRODUCT, not the job's
 * workdir; it is a root DIRECTORY, so the depth-1 bands cannot reach
 * into it by construction). Emits the t367 line grammar the parser
 * consumes: `rel\tsize\tmtimeEpochFraction`. The caller's head takes
 * cap+1 — the canary line, cut by the shell so no parsing has to guess.
 */
export function manifestFindScript(cap: number, quotedDir: string): string {
  const take = Math.max(1, Math.floor(cap)) + 1;
  return [
    `cd ${quotedDir} 2>/dev/null && {`,
    // band a — the door, pinned by exact name: the FINAL family's three
    // stars lead no matter what readdir says (the t460 field report's
    // failure was exactly these three losing a readdir race)
    "  find . -maxdepth 1 -type f \\\( -name 'run_data.star' -o -name 'run_model.star' -o -name 'run_optimiser.star' \\\) -printf '%P\\t%s\\t%T@\\n' 2>/dev/null;",
    // band b — the root's remaining .star files: the rest of the data
    // spine (postprocess.star, micrographs*.star, per-class particle
    // stars) — the cap spends itself on stars before anything else
    "  find . -maxdepth 1 -type f -name '*.star' -not -name 'run_data.star' -not -name 'run_model.star' -not -name 'run_optimiser.star' -not -name '.cf-*' -printf '%P\\t%s\\t%T@\\n' 2>/dev/null;",
    // band c — the root's non-star files: note.txt, run.out/err (the log
    // trail), the class-average stacks, the front door's binaries
    "  find . -maxdepth 1 -type f -not -name '*.star' -not -name '.cf-*' -printf '%P\\t%s\\t%T@\\n' 2>/dev/null;",
    // band d — everything deeper, find order (nested rounds, per-mic
    // graphs); the wipe archive excluded
    "  find . -mindepth 2 -type f -not -name '.cf-*' -not -path './.cryoflow_prev/*' -printf '%P\\t%s\\t%T@\\n' 2>/dev/null;",
    // cap+1 — the canary: one line MORE than the cap, so the parser can
    // tell “exactly full” from “cut short” without a second round.
    "} | head -" + take,
  ].join("\n");
}

export interface ManifestListing {
  entries: { rel: string; size: number; mtimeSec?: number }[];
  /** true ⇔ the workdir holds MORE files than the cap admitted — the
   * ledger is honest about being short, and the flag rides it home. */
  truncated: boolean;
}

/**
 * Parse the enumeration's stdout into ledger entries, with the canary
 * verdict. Grammar (t367): `rel\tsize\tmtimeSec` — the FIRST tab ends the
 * path (a %P path never contains a tab), the LAST begins the mtime
 * (middle = size). The canary: the caller's head admitted cap+1 raw
 * lines, so MORE raw lines than the cap ⇒ the world is bigger than the
 * ledger; keep the first cap entries and say so.
 */
export function parseManifestListing(stdout: string, cap: number): ManifestListing {
  const lines = stdout.split("\n").filter((l) => l.trim());
  const entries: ManifestListing["entries"] = [];
  for (const line of lines) {
    const t1 = line.indexOf("\t");
    const t2 = line.lastIndexOf("\t");
    if (t1 < 0) continue;
    const rel = line.slice(0, t1).trim();
    // t464 — an EMPTY size field is a corrupted line, not a zero-byte
    // file: Number("") is 0, and adopting it would invent a number the
    // cluster never said (the pre-t464 grammar's silent lie, retired).
    const sizeRaw = (t2 > t1 ? line.slice(t1 + 1, t2) : line.slice(t1 + 1)).trim();
    const size = Number(sizeRaw);
    const mtimeSec = t2 > t1 ? Number(line.slice(t2 + 1).trim().split(/\s+/)[0]) : NaN;
    if (!rel || sizeRaw === "" || !Number.isFinite(size)) continue;
    entries.push({
      rel,
      size,
      ...(Number.isFinite(mtimeSec) && mtimeSec > 0 ? { mtimeSec } : {}),
    });
  }
  const truncated = lines.length > cap;
  return {
    entries: truncated ? entries.slice(0, cap) : entries,
    truncated,
  };
}

/**
 * The outputs route's honest one-liner for a file listing that is short
 * somewhere. Three independent facts, one sentence — priority is the
 * depth of the incompleteness: the LOCAL walk missing files on THIS
 * machine outranks the LEDGER being short on the cluster, which outranks
 * the display cap that only limits how many remote cards are drawn.
 * Undefined = nothing is short; no note is honest noise.
 */
export function describeListingNote(facts: {
  localTruncated: boolean;
  ledgerTruncated: boolean;
  displayTruncated: boolean;
  count: number;
}): string | undefined {
  const { localTruncated, ledgerTruncated, displayTruncated, count } = facts;
  if (localTruncated) return `Listing truncated at ${count} files`;
  if (ledgerTruncated)
    return `Listing shows ${count} files — the cluster holds more than the manifest's cap (the final star family is pinned first)`;
  if (displayTruncated) return `Listing truncated at ${count} files (remote manifest capped)`;
  return undefined;
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
  // t387 — the byte account is clean, but an MRC-family file whose header
  // still cannot be read is the poisoned-cache shape (right-sized
  // zero-header): the login node's page cache can serve stale ZERO pages
  // for a file that was read while the run was still writing it — the
  // exact pages the GPU lane's fast live polls planted. The WITNESS LADDER
  // cross-examines this very file (buffered vs O_DIRECT on the login
  // node), drops the stale pages when the two disagree, and the re-pull
  // lands the storage's truth. Only a still-unreadable re-pull keeps the
  // honest refusal — and it names the real world instead of a transfer
  // error that did not happen.
  if (/\.(mrcs?|map)$/i.test(localPath) && !localCopyReads(localPath)) {
    const witness = await witnessMrcHeader(conn, remotePath);
    if (witness?.illusion && witness.healed) {
      const again = await remoteDownload(conn, remotePath, localPath, FETCH_CAP_BYTES);
      if (again != null && again >= 0 && localCopyReads(localPath)) {
        return { ok: true, bytes: again };
      }
    }
    try { rmSync(localPath, { force: true }); } catch { /* best effort */ }
    return {
      ok: false,
      error:
        `${remotePath} downloaded completely (${expected} bytes) but its MRC header read as ZEROS through the login node, ` +
        `and it stayed that way after the witness ladder dropped the node's stale cache pages (${witness ? "ladder ran" : "ladder could not run"}) — ` +
        "either the bytes are really zero on the storage or the login node cannot drop its cache (no python3). Read the file from a compute node (srun) for a second opinion before blaming the transfer",
      status: 502,
    };
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
    // t367 — existence alone is no longer enough for MRC-family files: a
    // corrupt leftover with the right name would serve its bytes to every
    // download forever (the field report's ghost came home through exactly
    // this door). An unreadable MRC re-pulls — remoteDownload truncates and
    // rewrites, so the ghost dies on the first fetch after the fix.
    let fresh = false;
    try {
      fresh = existsSync(localPath) && statSync(localPath).size > 0 && localCopyReads(localPath);
    } catch {
      fresh = false;
    }
    if (fresh) return { ok: true, bytes: 0 };
    p = fetchIntoWorkdir(run.workdir, remote, rel).finally(() => inFlight.delete(key));
    inFlight.set(key, p);
  }
  const res = await p;
  // the in-flight twin may have finished while a second caller raced the
  // freshness check above — an ok is an ok either way. t367 — but a FAILED
  // pull only falls back to the local bytes when they READ: serving the
  // ghost's bytes because the wire hiccuped would dress corruption as a
  // download.
  if (!res.ok && existsSync(localPath) && localCopyReads(localPath)) {
    return { ok: true, bytes: 0 };
  }
  return res;
}
