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

/**
 * Persistent app data directory.
 *
 * CRYOFLOW_DATA_DIR (Task 183): an ABSOLUTE override that decouples the
 * running server from its cwd. The standalone server chdirs into
 * .next/standalone at boot, so DATA_DIR resolves through
 * .next/standalone/data — a symlink start-prod.sh repairs — and EVERY
 * `next build` DELETES .next/standalone for its first seconds, taking the
 * cwd and the symlink with it. The convicted boot-race (instrumented
 * 2026-09-14): a polling client's reconcile during that window read
 * fileExists=false → readRuns()={ } → every running row flipped to
 * "stale running state (no engine record)". With the override, the
 * server's file view survives any build. Without it (user machines, dev)
 * the cwd default behaves exactly as before.
 */
export const DATA_DIR = process.env.CRYOFLOW_DATA_DIR
  ? process.env.CRYOFLOW_DATA_DIR
  : path.join(PROJECT_ROOT, "data");
