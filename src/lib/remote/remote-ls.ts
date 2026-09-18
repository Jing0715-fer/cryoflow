/**
 * CryoFlow — remote directory listing primitives (SERVER ONLY).
 *
 * t300 — the shared leg behind TWO doors:
 *
 *   /api/remote/connections/[id]/browse   the remote twin of /api/fs/browse
 *                                         (the import browser on a remote
 *                                         project browses the CLUSTER)
 *   engine runImportNative                the remote-project import branch
 *                                         (validate + enumerate the cluster
 *                                         path, write micrographs.star with
 *                                         CLUSTER-absolute paths — the data
 *         `                                 never leaves the cluster)
 *
 * One SSH round-trip per listing: GNU `find -L -printf '%y|%s|%f\n'`
 * (follows symlinks — a linked /data → /data2 behaves like the folder a
 * browser user expects), with an `ls -la` parse fallback for findutils
 * without -printf (BSD world). Entries are capped at MAX_ENTRIES; the
 * ABSOLUTE paths are RECONSTRUCTED server-side (dir + "/" + basename) so a
 * path-rewriting mock or a chrooted exec channel can never leak its own
 * filesystem layout into a STAR file or a picked param.
 *
 * Paths travel to the cluster SINGLE-QUOTED (shSingleQuote): shell
 * metacharacters in a pasted path are inert. Control characters are the
 * caller's business (the route rejects them; the engine's params can never
 * carry them through the JSON round-trip un-encoded).
 */

import type { RemoteConnection } from "./types";
import { getConnection } from "./connections";
import { exec, loginShellScript, shSingleQuote } from "./ssh";

/** Micrograph/movie extensions (mirrors the local browser's MIC_RE). */
export const REMOTE_MIC_RE = /\.(mrc|mrcs|tif|tiff|eer)$/i;

export const REMOTE_MAX_ENTRIES = 400;

export interface RemoteListEntry {
  name: string;
  dir: boolean;
  size?: number;
  img?: boolean;
  /** reconstructed cluster-absolute path (files only) */
  abs?: string;
}

export interface RemoteListResult {
  entries: RemoteListEntry[];
  /** the listed path was not a directory (honest 400 material). */
  notDir: boolean;
  /** find -printf unsupported — the listing came from the ls fallback. */
  findUnsupported: boolean;
  /** more than REMOTE_MAX_ENTRIES matched (entries truncated). */
  truncated: boolean;
  /** total entries before the cap (== entries.length when not truncated). */
  total: number;
}

/** Parse the find `y|size|name` line protocol into entries. */
function parseFindLines(lines: string[], dir: string, filesOnly: boolean): RemoteListEntry[] {
  const out: RemoteListEntry[] = [];
  for (const line of lines) {
    const s1 = line.indexOf("|");
    if (s1 < 0) continue;
    const s2 = line.indexOf("|", s1 + 1);
    if (s2 < 0) continue;
    const y = line.slice(0, s1);
    const size = Number(line.slice(s1 + 1, s2));
    const name = line.slice(s2 + 1);
    if (!name || name === "." || name === "..") continue;
    const isDir = y === "d";
    if (filesOnly && !/^[fd]$/.test(y)) continue; // pattern view: real files only
    if (!/^[fdl]$/.test(y)) continue; // defensive: a mangled line never becomes an entry
    out.push({
      name,
      dir: isDir,
      ...(isDir
        ? {}
        : {
            size: Number.isFinite(size) ? size : 0,
            img: REMOTE_MIC_RE.test(name),
            abs: `${dir.replace(/\/$/, "")}/${name}`,
          }),
    });
  }
  return out;
}

/** `ls -la` fallback: perms nlink owner group size date name → entries. */
function parseLsLa(text: string, dir: string): RemoteListEntry[] {
  const out: RemoteListEntry[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (!line || /^(total |d.* \.$|d.* \.\.$)/.test(line.trim())) continue;
    const m = /^([dl-])[rwxsStT-]{9,}\s+\d+\s+\S+\s+\S+\s+(\d+)\s+.{12}\s+(.+)$/.exec(line);
    if (!m) continue;
    const name = m[3].trim();
    if (!name || name === "." || name === "..") continue;
    const isDir = m[1] === "d";
    out.push({
      name,
      dir: isDir,
      ...(isDir
        ? {}
        : {
            size: Number(m[2]) || 0,
            img: REMOTE_MIC_RE.test(name),
            abs: `${dir.replace(/\/$/, "")}/${name}`,
          }),
    });
  }
  return out;
}

function sortEntries(entries: RemoteListEntry[]): RemoteListEntry[] {
  return entries.sort((a, b) =>
    a.dir === b.dir ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.dir ? -1 : 1
  );
}

/**
 * List ONE level of a cluster directory — or, with `glob`, the files in it
 * matching a wildcard pattern (RELION "File name pattern" mode: the glob is
 * matched by find -name, never by an unquoted shell expansion).
 */
export async function listRemoteDir(
  connId: string,
  dir: string,
  glob: string | null
): Promise<RemoteListResult> {
  const conn = getConnection(connId);
  if (!conn) throw new Error("connection-gone");
  const q = shSingleQuote(dir);
  const finder =
    glob != null
      ? `find -L ${q} -maxdepth 1 -mindepth 1 -name ${shSingleQuote(glob)} -printf '%y|%s|%f\\n' 2>/dev/null`
      : `find -L ${q} -maxdepth 1 -mindepth 1 -printf '%y|%s|%f\\n' 2>/dev/null`;
  const script = [
    `if ! test -d ${q}; then echo __CF_NOTDIR__; exit 0; fi`,
    `${finder} | head -${REMOTE_MAX_ENTRIES + 1}`,
    `__rc=$?`,
    // probe the -printf support itself: a find that rejects the predicate
    // prints nothing (stderr was swallowed) — distinguish via a canary line
    `if ! find -L / -maxdepth 0 -printf 'd|0|/\\n' 2>/dev/null | head -1 | grep -q '^d|'; then echo __CF_NO_PRINTF__; fi`,
    `exit 0`,
  ].join("\n");
  const r = await exec(conn, loginShellScript(script), { timeoutMs: 20_000 });
  if (r.error) {
    throw new Error(`SSH listing failed: ${r.error}`);
  }
  const lines = (r.stdout ?? "")
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter(Boolean)
    .filter((l) => l !== "__CF_NOTDIR__" && l !== "__CF_NO_PRINTF__");
  const notDir = (r.stdout ?? "").includes("__CF_NOTDIR__");
  const findUnsupported = (r.stdout ?? "").includes("__CF_NO_PRINTF__");
  let entries = findUnsupported
    ? parseLsLa(lines.join("\n"), dir).filter((e) => (glob != null ? !e.dir : true))
    : parseFindLines(lines, dir, glob != null);
  const total = entries.length;
  const truncated = entries.length > REMOTE_MAX_ENTRIES;
  if (truncated) entries = entries.slice(0, REMOTE_MAX_ENTRIES);
  if (glob == null) entries = sortEntries(entries);
  return { entries, notDir, findUnsupported, truncated, total };
}

/**
 * Stat a hand-picked list of cluster files (the import job's multi-select
 * shape). One SSH round-trip; the ANSWER is sizes keyed by the REQUESTED
 * order (paths are echoed back only as MISSING markers — reconstructed
 * paths are the caller's truth, never the exec channel's echo).
 */
export async function statRemoteFiles(
  conn: RemoteConnection,
  files: string[]
): Promise<{ sizes: Array<number | null>; missing: string[] }> {
  const sizes: Array<number | null> = [];
  const missing: string[] = [];
  // batch in groups of 200 (argv length sanity on long picks)
  for (let base = 0; base < files.length; base += 200) {
    const batch = files.slice(base, base + 200);
    const script = [
      "for f in " + batch.map((f) => shSingleQuote(f)).join(" ") + "; do",
      '  if test -f "$f"; then stat -c \'%s\' "$f"; else echo "__CF_MISSING__"; fi',
      "done",
    ].join("\n");
    const r = await exec(conn, loginShellScript(script), { timeoutMs: 20_000 });
    if (r.error) throw new Error(`SSH stat failed: ${r.error}`);
    const lines = (r.stdout ?? "").split("\n").map((l) => l.replace(/\r$/, "")).filter(Boolean);
    for (let i = 0; i < batch.length; i++) {
      const line = lines[i];
      if (line === undefined || line === "__CF_MISSING__") {
        sizes.push(null);
        missing.push(batch[i]);
      } else {
        const n = Number(line);
        sizes.push(Number.isFinite(n) ? n : null);
        if (!Number.isFinite(n)) missing.push(batch[i]);
      }
    }
  }
  return { sizes, missing };
}
