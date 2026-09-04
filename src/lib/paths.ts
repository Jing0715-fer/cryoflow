/**
 * CryoFlow — portable project paths (SERVER ONLY).
 *
 * The engine and project meta previously hardcoded "/home/z/my-project/data",
 * which only exists in the build sandbox. On a user machine (Windows/macOS/
 * arbitrary Linux checkout) the data directory must resolve relative to the
 * Next.js server process cwd — i.e. <repo>/data — so run records, RELION job
 * workdirs and projects.json live next to the code they belong to.
 */

import path from "path";

/** Repository root (cwd of the Next.js dev server process). */
export const PROJECT_ROOT = process.cwd();

/** Persistent app data directory (<repo>/data). */
export const DATA_DIR = path.join(PROJECT_ROOT, "data");
