/**
 * CryoFlow — unified job-file path containment (SERVER ONLY).
 *
 * The outputs/file and outputs/star routes previously enforced two
 * DIFFERENT policies: the star route required the file's REALPATH to stay
 * inside the job workdir (rejecting engine-created cross-job symlinks),
 * while the file route only checked LEXICAL containment and then followed
 * whatever realpath the file had — a manually planted symlink inside a
 * workdir could escape the project tree entirely.
 *
 * The unified policy, enforced by resolveInsideJobWorkdir():
 *  1. `rel` must be relative, non-empty, contain no ".." segments and no
 *     NUL bytes (lexical traversal is impossible after this);
 *  2. the resolved path must stay lexically inside the job workdir;
 *  3. the file's REALPATH must stay inside the app data tree
 *     (<repo>/data — engine-created symlinks always point at project-level
 *     files inside it) or inside the workdir itself (covers exotic workdir
 *     mounts). Links pointing outside — /etc/passwd & friends — are refused.
 *
 * The .pathref escape hatch (import sources on other drives / UNC shares)
 * is deliberately NOT part of this helper: markers are engine-written
 * dotfiles validated by readPathrefTarget, and only the file route follows
 * them — after the containment check has accepted the marker itself.
 */

import { realpathSync } from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/paths";

let dataRealCache: string | null | undefined;

/** Realpath of the app data tree, resolved lazily and cached. */
function dataReal(): string | null {
  if (dataRealCache !== undefined) return dataRealCache;
  try {
    dataRealCache = realpathSync(DATA_DIR);
  } catch {
    dataRealCache = null;
  }
  return dataRealCache;
}

export type JobFileResolution =
  | { abs: string; real: string; name: string }
  | { error: string; status: number };

/**
 * Resolve `rel` inside the job workdir under the unified containment
 * policy (see module doc). Returns { error, status } on rejection and
 * { abs, real, name } — absolute, realpathed and basename — on success.
 */
export function resolveInsideJobWorkdir(workdir: string, rel: string): JobFileResolution {
  if (
    !rel ||
    rel.startsWith("/") ||
    rel.startsWith("\\") ||
    rel.includes("\0") ||
    rel.split("/").includes("..")
  ) {
    return { error: "Invalid path", status: 400 };
  }
  const abs = path.resolve(workdir, rel);
  if (abs !== workdir && !abs.startsWith(workdir + path.sep)) {
    return { error: "Path escapes the job directory", status: 400 };
  }
  let real: string;
  try {
    real = realpathSync(abs);
  } catch {
    return { error: "File not found", status: 404 };
  }

  // common case first: the file really lives inside the data tree
  const root = dataReal();
  if (root && (real === root || real.startsWith(root + path.sep))) {
    return { abs, real, name: path.basename(real) };
  }
  // exotic setups: workdir outside <repo>/data — containment falls back to
  // the workdir's own realpath (symlinks may not leave it)
  try {
    const wdReal = realpathSync(workdir);
    if (real === wdReal || real.startsWith(wdReal + path.sep)) {
      return { abs, real, name: path.basename(real) };
    }
  } catch {
    /* workdir vanished mid-request — fall through to the refusal */
  }
  return { error: "Path escapes the job directory", status: 400 };
}
