import { existsSync, readdirSync, statSync } from "fs";
import path from "path";

/**
 * CryoFlow — wildcard path expansion (RELION import style).
 *
 * RELION's Import job accepts a file-name pattern with `*` wildcards
 * (e.g. `Movies/FoilHole_*_movies.mrcs`, `/data/*.tiff`). This module expands
 * such patterns against the real filesystem, shared by:
 *   - the engine's native import job (writes the micrographs.star), and
 *   - GET /api/fs/browse (pattern preview in the file browser dialog).
 *
 * Semantics (deliberately RELION-simple, no regex):
 *   - `*`  matches any run of characters WITHIN one path segment
 *   - `?`  matches exactly one character within one segment
 *   - everything before the first wildcard segment must exist literally
 *     (the "static prefix" — e.g. `/home/user/movies` in
 *     `/home/user/movies/*.tiff`)
 *   - matches are FILES; intermediate segments match DIRECTORIES only
 *   - matching is case-insensitive on Windows hosts (NTFS is case-preserving)
 *
 * Works for POSIX paths, Windows drive paths (C:\data\*.mrc) and UNC paths
 * (\\wsl.localhost\Debian\home\…\*.mrc) — separators are normalised before
 * splitting, and results come back as platform-resolved absolute paths.
 */

const MIC_RE = /\.(mrc|mrcs|tif|tiff|eer)$/i;
export { MIC_RE };

/** Hard cap on expanded matches — protect the Node event loop on huge shoots. */
export const MATCH_CAP = 4000;

export function hasWildcard(p: string): boolean {
  return /[*?]/.test(p);
}

export interface PatternResult {
  /** Directory the literal (wildcard-free) prefix points at. */
  baseDir: string;
  /** Platform absolute paths of matched FILES (sorted, capped at `cap`). */
  files: string[];
  /** Total matches BEFORE the cap (for honest UI counts). */
  total: number;
}

/** Translate one wildcard segment into a RegExp source. */
function segmentRegex(seg: string, caseInsensitive: boolean): RegExp {
  let src = "";
  for (const ch of seg) {
    if (ch === "*") src += "[^/]*";
    else if (ch === "?") src += "[^/]";
    else src += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${src}$`, caseInsensitive ? "i" : "");
}

/**
 * Normalise any path form (POSIX / C:\ / UNC) into forward-slash segments.
 * UNC `\\wsl.localhost\D\…` becomes `//wsl.localhost/D/…` so the leading `//`
 * marker survives splitting and path.resolve round-trips it.
 */
function toPosix(p: string): string {
  let s = p.trim().replace(/\//g, "/").replace(/\\/g, "/");
  s = s.replace(/\/{2,}/g, (m, off: number) => (off === 0 ? "//" : "/"));
  return s;
}

/**
 * Expand a wildcard pattern into matched files.
 *
 * `toHost` lets callers translate user-facing paths first (e.g. the engine's
 * /mnt/c → C:\ and distro → \\wsl.localhost conversions on Windows hosts).
 * Returns `{ error }` when the static prefix doesn't exist / isn't readable.
 */
export function expandPattern(
  raw: string,
  toHost: (p: string) => string = (p) => p,
  cap: number = MATCH_CAP
): PatternResult | { error: string } {
  if (!hasWildcard(raw)) return { error: "Pattern contains no * or ? wildcards" };

  const posix = toPosix(toHost(raw));
  const segments = posix.split("/").filter((s) => s.length > 0);
  const caseInsensitive = process.platform === "win32" || /^\/\/[^/]+\//.test(posix) || /^[A-Za-z]:/.test(posix);

  // static prefix = everything before the first wildcard segment
  let firstWild = segments.findIndex((s) => hasWildcard(s));
  if (firstWild < 0) return { error: "Pattern contains no * or ? wildcards" };

  const prefixSegs = segments.slice(0, firstWild);
  // rebuild base preserving the UNC `//` marker or drive-letter root
  let base: string;
  if (posix.startsWith("//")) {
    // UNC (\\wsl.localhost\D\…) — keep the leading // so path.resolve
    // round-trips it as a UNC path on Windows hosts
    base = "//" + prefixSegs.map((s) => decodeSeg(s)).join("/");
  } else {
    base = prefixSegs.map((s) => decodeSeg(s)).join("/");
    if (/^[A-Za-z]:$/.test(base)) base += "/";
    else if (posix.startsWith("/") && !base.startsWith("/")) base = "/" + base;
  }
  const baseDir = path.resolve(base === "" ? process.cwd() : base);
  try {
    if (!statSync(baseDir).isDirectory()) {
      return { error: `Pattern base is not a folder: ${baseDir}` };
    }
  } catch {
    return { error: `Pattern base folder not accessible: ${baseDir}` };
  }

  const wildSegs = segments.slice(firstWild);
  let frontier: string[] = [baseDir]; // absolute dirs to expand from
  let files: string[] = [];

  for (let i = 0; i < wildSegs.length; i++) {
    const seg = decodeSeg(wildSegs[i]);
    const isLast = i === wildSegs.length - 1;
    const next: string[] = [];
    if (!hasWildcard(seg)) {
      // literal segment inside the wildcard region
      for (const dir of frontier) {
        const cand = path.join(dir, seg);
        try {
          const st = statSync(cand);
          if (isLast) {
            if (st.isFile()) next.push(cand);
          } else if (st.isDirectory()) next.push(cand);
        } catch {
          /* dead branch */
        }
      }
    } else {
      const re = segmentRegex(seg, caseInsensitive);
      for (const dir of frontier) {
        let names: string[];
        try {
          names = readdirSync(dir);
        } catch {
          continue; // unreadable folder — skip honestly
        }
        for (const name of names) {
          if (!re.test(name)) continue;
          const cand = path.join(dir, name);
          try {
            const st = statSync(cand);
            if (isLast) {
              if (st.isFile()) next.push(cand);
            } else if (st.isDirectory()) next.push(cand);
          } catch {
            /* broken link */
          }
        }
      }
    }
    frontier = next;
    if (isLast) files = next;
    if (frontier.length === 0) break;
  }

  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const total = files.length;
  if (files.length > cap) files = files.slice(0, cap);
  return { baseDir, files, total };
}

/** %-decode a segment defensively (URL-encoded paths pasted by users). */
function decodeSeg(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/** Count image files among a list of paths (mrc/mrcs/tif/tiff/eer). */
export function countImages(files: string[]): number {
  return files.reduce((n, f) => (MIC_RE.test(path.basename(f)) ? n + 1 : n), 0);
}

/**
 * Normalise a user-provided path (typed or pasted) into a form THIS Node
 * process can stat: /mnt/c/… → C:\… on a Windows host; other POSIX paths on
 * a Windows host with a known distro become \\wsl.localhost\<distro>\… UNC
 * (only when the literal path doesn't exist locally).
 */
export function userPathToHost(raw: string, distro: string | null): string {
  let p = raw.trim();
  if (process.platform === "win32" || distro) {
    const mnt = p.match(/^\/mnt\/([A-Za-z])\/(.*)$/);
    if (mnt) {
      p = `${mnt[1].toUpperCase()}:\\${mnt[2].replace(/\//g, "\\")}`;
    } else if (p.startsWith("/") && distro && !existsSync(p)) {
      p = `\\\\wsl.localhost\\${distro}\\${p.slice(1).replace(/\//g, "\\")}`;
    }
  }
  return p;
}
