/**
 * CryoFlow — the login-node cache witness + healer (t384, SERVER ONLY).
 *
 * The field report that broke the t369 verdict: the SAME cluster, the SAME
 * RELION build — a manually launched run leaves healthy class stacks, a
 * cryoflow-launched run leaves right-sized ZERO-HEADER stacks. The one
 * thing cryoflow does that a manual run never does is READ the growing
 * `run_itNNN_classes.mrcs` from the LOGIN NODE while the compute node is
 * still writing it (the t368/t370 live-rounds od sniff, the t350/t356 live
 * stack pulls). On an NFS mount that read can cache the file's first page
 * — the 1024-byte MRC header — as ZEROS in the login node's page cache
 * (the read lands in the window where the writer's `fopen(path,"w")` has
 * truncated the file server-side but the header page has not been flushed
 * yet, or the data pages reached the storage before the header page did).
 * NFS revalidates a cached page against (mtime, size) — mtime has ONE
 * SECOND granularity, and the header page flushing one second later (or
 * within the same second) does not always invalidate what the reader
 * cached. Every later read from the login node — cryoflow's own `cat`
 * pull, `relion_display`, even `md5sum` — then serves the stale ZERO page
 * while the file on the storage may be perfectly healthy. A manual run
 * has no login-node mid-write reader, so its first read is post-run and
 * fresh: that is the whole manual-vs-cryoflow difference.
 *
 * This module is the instrument + the remedy:
 *
 *   · cacheSafeHeaderSniffLine() — a shell fragment for the live sweeps:
 *     the header sniff reads the first 4 KB with O_DIRECT (`dd
 *     iflag=direct`), which BYPASSES the login node's page cache on both
 *     ends — the app can never plant its own poison again, and a settled
 *     round's sniffed header is the STORAGE's truth, not the cache's.
 *     (Graceful fallback to the old buffered `od` where the cluster's
 *     dd/coreutils/filesystem refuses O_DIRECT — the same mid-write
 *     honesty as before, and the witness below still catches the poison.)
 *
 *   · witnessMrcHeader() — the LADDER, for the moment a zero header has
 *     actually been observed: (a) the BUFFERED view (what a normal reader
 *     on the login node sees), (b) the DIRECT view (the same login node,
 *     cache bypassed — the storage's answer through that node's wire).
 *     When they disagree the buffered view was a cache illusion; the
 *     ladder then DROPS the login node's cached pages for that file
 *     (`posix_fadvise(DONTNEED)` via python3) and re-reads buffered —
 *     (c) — so the app heals the very view it is about to render from.
 *     The compute-node view (a third observer) stays the storage
 *     diagnostic's own leg (storage-diag.ts t384).
 */

import { exec, shSingleQuote } from "./ssh";
import type { RemoteConnection } from "./types";

/** The first three int32 words of an MRC header (nx ny nz), or null when
 * the read produced nothing (mid-create, unreadable, or the words are not
 * three plain unsigned integers). */
export interface HeaderWords {
  nx: number;
  ny: number;
  nz: number;
}

/** True when the words are the all-zero shape (the corruption signature
 * as seen through whatever view produced them). */
export function wordsAreZero(w: HeaderWords | null): boolean {
  return w != null && w.nx === 0 && w.ny === 0 && w.nz === 0;
}

/** True when the words are a usable header (not the zero shape). */
export function wordsAreHealthy(w: HeaderWords | null): boolean {
  return w != null && !wordsAreZero(w);
}

/** Parse the od words line (" 100 100 50 ") into {nx,ny,nz}; exported for the bench. */
export function parseHeaderWords(line: string): HeaderWords | null {
  const parts = line.trim().split(/\s+/).filter((t) => /^\d+$/.test(t));
  if (parts.length < 3) return null;
  return { nx: Number(parts[0]), ny: Number(parts[1]), nz: Number(parts[2]) };
}

/* ------------------------------------------------------------------ */
/* The cache-safe sniff fragment (the live sweeps)                     */
/* ------------------------------------------------------------------ */

/**
 * A shell fragment that prints ONE "nx ny nz" line for `file` — the exact
 * dialect the old `od -An -tu4 -j0 -N12 "$f" | tr -s ' \n' ' '` sniff
 * printed — but the bytes come from an O_DIRECT read first (`dd
 * iflag=direct bs=4096 count=1`), which neither consults nor populates
 * the login node's page cache. The buffered `od` runs ONLY when the direct
 * read answers nothing (an old coreutils, a filesystem refusing O_DIRECT,
 * a 0-byte mid-create file): identical output shape, so the existing
 * parsers keep working untouched.
 *
 * Emits an EMPTY line (not "0 0 0") when neither read produced words —
 * the honest mid-create shape the parsers already treat as "undefined".
 */
export function cacheSafeHeaderSniffLine(file: string): string {
  const q = shSingleQuote(file);
  return (
    `__h="$(dd if=${q} iflag=direct bs=4096 count=1 2>/dev/null | od -An -tu4 -j0 -N12 2>/dev/null | tr -s ' \\n' ' ')"; ` +
    `[ -n "$__h" ] || __h="$(od -An -tu4 -j0 -N12 ${q} 2>/dev/null | tr -s ' \\n' ' ')"; ` +
    `printf '%s\\n' "$__h"`
  );
}

/**
 * The same cache-safe sniff for a SHELL VARIABLE reference (the live sweeps
 * walk `for f in run_it???_classes.mrcs …`): pass the quoted ref exactly as
 * it should appear inside `dd if=…` — `'"$f"'` in a TS template literal.
 */
export function cacheSafeHeaderSniffLineForVar(varRef = '"$f"'): string {
  return (
    `__h="$(dd if=${varRef} iflag=direct bs=4096 count=1 2>/dev/null | od -An -tu4 -j0 -N12 2>/dev/null | tr -s ' \\n' ' ')"; ` +
    `[ -n "$__h" ] || __h="$(od -An -tu4 -j0 -N12 ${varRef} 2>/dev/null | tr -s ' \\n' ' ')"; ` +
    `printf '%s\\n' "$__h"`
  );
}

/* ------------------------------------------------------------------ */
/* The witness ladder (a zero header has been observed)                 */
/* ------------------------------------------------------------------ */

export interface HeaderWitness {
  /** the BUFFERED view — what every normal reader on the login node sees */
  buffered: HeaderWords | null;
  /** the DIRECT (O_DIRECT) view — the storage's answer through the login
   * node's own wire, page cache bypassed. null = direct reads refused. */
  direct: HeaderWords | null;
  /** the buffered view was the zero shape while the direct view was not —
   * the login node's page cache was serving stale zero pages. */
  illusion: boolean;
  /** the ladder DROPPED the login node's cached pages (fadvise) */
  fadviseRan: boolean;
  /** the drop healed the buffered view (it now agrees with the direct one) */
  healed: boolean;
  /** the buffered view AFTER the drop (=== buffered when no drop ran) */
  after: HeaderWords | null;
}

/** python3's fadvise one-liner — the drop-the-pages stick. Single-quoted
 * program (no quotes inside), the path rides argv. */
const FADVISE_PY =
  "python3 -c 'import os,sys; os.posix_fadvise(os.open(sys.argv[1], os.O_RDONLY), 0, 0, os.POSIX_FADV_DONTNEED)'";

/**
 * The ladder's shell script (exported for the t384 verification suite —
 * the test bench runs the EXACT bytes the login node would run).
 */
export function witnessScript(clusterPath: string): string {
  const q = shSingleQuote(clusterPath);
  const odLine = `od -An -tu4 -j0 -N12 ${q} 2>/dev/null | tr -s ' \\n' ' '`;
  const ddLine = `dd if=${q} iflag=direct bs=4096 count=1 2>/dev/null | od -An -tu4 -j0 -N12 2>/dev/null | tr -s ' \\n' ' '`;
  return [
    "set -u",
    `__b="$(${odLine})"`,
    `__d="$(${ddLine})"`,
    `__f="N"; __b2="$__b"`,
    // only when the two views DISAGREE is a drop worth its python3:
    // agreement means either both healthy (nothing to do) or both zero
    // (the cache is not the liar — the deeper diagnostic owns that).
    'if [ -n "$__d" ] && [ "$__d" != "$__b" ]; then',
    `  if ${FADVISE_PY} ${q} >/dev/null 2>&1; then __f="Y"; fi`,
    `  __b2="$(${odLine})"`,
    "fi",
    'printf \'CFW_B=%s\\n\' "$__b"',
    'printf \'CFW_D=%s\\n\' "$__d"',
    'printf \'CFW_FADV=%s\\n\' "$__f"',
    'printf \'CFW_B2=%s\\n\' "$__b2"',
  ].join("\n");
}

/**
 * Cross-examine ONE cluster file's header through the login node: buffered
 * view, direct view, and (when they disagree) the fadvise drop + a fresh
 * buffered read. One SSH round; a wire failure answers null (the caller
 * keeps its previous verdict — a witness that cannot run never convicts).
 */
export async function witnessMrcHeader(
  conn: RemoteConnection,
  clusterPath: string
): Promise<HeaderWitness | null> {
  const script = witnessScript(clusterPath);
  let res;
  try {
    res = await exec(conn, script, { timeoutMs: 30_000 });
  } catch {
    return null;
  }
  if (res.error) return null;
  const grab = (tag: string): HeaderWords | null => {
    const m = new RegExp(`^CFW_${tag}=(.*)$`, "m").exec(res.stdout ?? "");
    return m ? parseHeaderWords(m[1]) : null;
  };
  const buffered = grab("B");
  const direct = grab("D");
  const after = grab("B2");
  if (buffered == null && direct == null) return null;
  const fadviseRan = /^CFW_FADV=Y$/m.test(res.stdout ?? "");
  const illusion = wordsAreZero(buffered) && wordsAreHealthy(direct);
  return {
    buffered,
    direct,
    after,
    illusion,
    fadviseRan,
    healed: illusion && fadviseRan && wordsAreHealthy(after),
  };
}

/** A human one-liner for a witness result (log tails, receipts). */
export function witnessSummary(w: HeaderWitness | null): string {
  if (!w) return "the witness could not run (SSH or shell refused)";
  const fmt = (x: HeaderWords | null) =>
    x == null ? "no-words" : `nx=${x.nx} ny=${x.ny} nz=${x.nz}`;
  if (w.illusion) {
    return `login-node cache ILLUSION — buffered ${fmt(w.buffered)} vs direct ${fmt(w.direct)}${
      w.fadviseRan
        ? w.healed
          ? "; the stale pages were dropped and the buffered view now agrees (healed)"
          : "; the pages were dropped but the buffered view still disagrees"
        : "; the drop could not run (python3 missing on the login node)"
    }`;
  }
  return `buffered ${fmt(w.buffered)}, direct ${fmt(w.direct)} (they agree — the cache is not the liar)`;
}
