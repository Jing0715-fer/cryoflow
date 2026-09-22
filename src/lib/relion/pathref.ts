/**
 * CryoFlow — pathref markers for UNLINKABLE import sources (SERVER ONLY).
 *
 * importFileSet() links every selected micrograph into the project tree
 * (hardlink → file symlink → absolute STAR path). On a Windows host without
 * symlink rights, sources on another drive or on a \\wsl.localhost UNC share
 * can end up in the third bucket: the STAR file references them by absolute
 * path (translated for the WSL bridge, so RELION itself reads them fine) —
 * but the job's micrographs/ directory stays empty, so the gallery and the
 * Files tab look like "nothing was actually imported".
 *
 * A pathref marker is a tiny dotfile (micrographs/.<name>.mrc.pathref) whose
 * content is the HOST-side absolute path of the source file. The
 * micrographs manifest + outputs/file routes follow these markers to stat
 * headers and render PNG previews straight from the source location, so an
 * "imported by absolute path" file set is visually identical to a linked one.
 *
 * Markers are written ONLY by the engine (no API writes into workdirs), and
 * every reader validates that the target looks like an absolute path to an
 * existing regular file before opening it.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";

/** Marker filename for a micrograph base name (dotfile → hidden in Files tab walks). */
export function pathrefFor(base: string): string {
  return `.${base}.pathref`;
}

/** True when `rel` (a workdir-relative path) points at a pathref marker. */
export function isPathrefPath(rel: string): boolean {
  return path.basename(rel).endsWith(".pathref");
}

/**
 * Write a marker (best-effort, idempotent). Returns false when the marker
 * could not be written — the caller keeps going; only previews degrade.
 */
export function writePathrefMarker(dir: string, base: string, absTarget: string): boolean {
  try {
    const file = path.join(dir, pathrefFor(base));
    // only (re)write when the target actually changed — hardlink imports
    // don't produce markers at all, this is the unlinked-only path
    writeFileSync(file, absTarget + "\n", "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Read + validate a marker's target. Returns the absolute host path, or null
 * when the marker is missing/corrupt or its target is not an existing file.
 */
export function readPathrefTarget(file: string): string | null {
  try {
    if (!existsSync(file)) return null;
    const raw = readFileSync(file, "utf8").trim();
    if (!raw || raw.includes("\n") || raw.length > 4096) return null;
    // absolute POSIX or Windows drive/UNC path only — anything else is garbage
    if (!raw.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(raw) && !raw.startsWith("\\\\")) {
      return null;
    }
    const st = statSync(raw);
    return st.isFile() ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a micrograph listed in micrographs.star against the job's
 * micrographs/ directory: either the linked file itself, or the source
 * location recorded in its pathref marker.
 * Returns the entry the outputs/file route should serve (workdir-relative)
 * plus the absolute path to open, or null when neither exists.
 */
export function resolveMicrographEntry(
  micDir: string,
  base: string
): { rel: string; abs: string; via: "linked" | "pathref" } | null {
  const direct = path.join(micDir, base);
  if (existsSync(direct)) {
    try {
      if (statSync(direct).isFile()) {
        return { rel: `micrographs/${base}`, abs: direct, via: "linked" };
      }
    } catch {
      /* fall through to the marker */
    }
  }
  const marker = path.join(micDir, pathrefFor(base));
  const target = readPathrefTarget(marker);
  if (target) {
    return { rel: `micrographs/${pathrefFor(base)}`, abs: target, via: "pathref" };
  }
  return null;
}
