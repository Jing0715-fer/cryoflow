/**
 * CryoFlow — fs-text (t1168): the bounded text reads, ONE well.
 *
 * WHY THIS EXISTS (the oldest-routes sweep's yield): three request-path
 * readers meant to touch a file's HEAD or COUNT its rows, and each reached
 * for `readFileSync(..., "utf8")` — which reads the WHOLE file before the
 * `.slice(0, 4000)` or the `.split("\n")` could speak. A real Extract's
 * particles.star is gigabytes; the import's movies.star is tens of
 * megabytes; the intent was a 4 KB probe, the bill was the whole file —
 * on a click path, once per `.star` in the workdir. The class is the
 * sync-read plague (#7) in a new coat: not "sync vs async" but "bounded
 * vs unbounded".
 *
 * THE LAW: a reader that wants a head gets BYTES, not files; a counter
 * that wants a row count streams chunks and never materializes the text.
 * Both answers are honest null on an unreadable file (the caller keeps
 * its own refusal wording), and both cost a fixed buffer whatever the
 * file weighs.
 *
 * Callers (duty split, no drift):
 *   - jobs/[id]/particles  findParticlesStar — the fallback scans every
 *     `.star` in a workdir testing `_rlnImageName` in the head (4 KB);
 *   - hpc/sbatch/[id]      the dry-run's micrograph volume (rows naming
 *     `.mrc` in the import's movies.star);
 *   - relion/star-shape    readStarMoviesShape — the dispatch gate's
 *     classification, now a head ladder (see that file's comment).
 */

import { closeSync, fstatSync, openSync, readSync } from "node:fs";

/** The streaming row counter's stride (and its carry cap): 1 MiB. */
export const ROW_CHUNK_BYTES = 1 << 20;

export interface TextHead {
  /** Up to `maxBytes` bytes of the file, decoded utf8. */
  text: string;
  /** true when the file holds MORE bytes than were returned. */
  truncated: boolean;
}

/**
 * Read AT MOST `maxBytes` bytes from `file` — never the whole file
 * (the buffer is sized `min(size, maxBytes)` before the first read).
 * `maxBytes = Infinity` is the ladder's last rung: the whole file,
 * but only when the caller has proven it must. Honest null on any
 * read failure — the caller's refusal wording stays its own.
 */
export function readTextHead(file: string, maxBytes: number): TextHead | null {
  // Infinity IS the ladder's last rung (the whole file, only when proven
  // necessary) — only NaN and negatives refuse.
  if (Number.isNaN(maxBytes) || maxBytes < 0) return null;
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const st = fstatSync(fd);
    const want = Math.min(st.size, maxBytes);
    const buf = Buffer.allocUnsafe(want);
    let got = 0;
    while (got < want) {
      const n = readSync(fd, buf, got, want - got, got);
      if (n <= 0) break;
      got += n;
    }
    return { text: buf.toString("utf8", 0, got), truncated: st.size > maxBytes };
  } catch {
    return null;
  } finally {
    try {
      closeSync(fd);
    } catch {
      /* already closed */
    }
  }
}

/**
 * Count the lines of `file` that CONTAIN `needle` — streamed, not
 * materialized. One 1 MiB buffer walks the file; only the line fragment
 * straddling a chunk boundary is carried (a star row is < 1 KB, the
 * carry cap absorbs a pathological mega-line instead of holding it:
 * such a row is counted ONCE, from the megabyte already seen, and its
 * tail is skipped until the next newline — memory stays fixed even for
 * a single-line gigabyte). The needle must be ASCII (".mrc", "_rln…"):
 * a chunk boundary can split a multi-byte utf8 char, but never an ASCII
 * run, and the carry re-joins the split line before the test. Honest
 * null on an unreadable file.
 */
export function countRowsContaining(file: string, needle: string): number | null {
  if (!needle) return null;
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const buf = Buffer.allocUnsafe(ROW_CHUNK_BYTES);
    let carry = "";
    let inMega = false; // inside an absorbed mega-line — skip until its \n
    let count = 0;
    for (;;) {
      const n = readSync(fd, buf, 0, ROW_CHUNK_BYTES, null);
      if (n <= 0) break;
      let s = carry + buf.toString("utf8", 0, n);
      if (inMega) {
        const idx = s.indexOf("\n");
        if (idx === -1) {
          carry = "";
          continue; // the whole chunk is still the mega-line's tail
        }
        inMega = false;
        s = s.slice(idx + 1); // normal lines resume after the mega's newline
      }
      const lines = s.split("\n");
      carry = lines.pop() ?? "";
      if (carry.length > ROW_CHUNK_BYTES) {
        // the carry ran past the cap: a single "line" wider than a chunk.
        // Counted once from what was seen; the tail is absorbed (the
        // inMega state skips fragments until the line's own newline).
        if (carry.includes(needle)) count += 1;
        inMega = true;
        carry = "";
      }
      for (const line of lines) {
        if (line.includes(needle)) count += 1;
      }
    }
    if (!inMega && carry.includes(needle)) count += 1; // the final line, \n-terminated or not
    return count;
  } catch {
    return null;
  } finally {
    try {
      closeSync(fd);
    } catch {
      /* already closed */
    }
  }
}
