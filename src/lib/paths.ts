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

/**
 * RELION job workdir root — THE single name for <DATA_DIR>/relion.
 *
 * Task 184: the HPC layer used to re-derive its own copies of DATA_DIR and
 * the relion root from process.cwd() (slurm.ts, sbatch route), ignoring the
 * CRYOFLOW_DATA_DIR override the run engine honors — caught red-handed:
 * GET /api/hpc/profiles answered localRoot=".next/standalone/data/relion"
 * on a server whose env carried CRYOFLOW_DATA_DIR=/home/z/my-project/data.
 * Two names for one directory coincide only while the start-prod.sh symlink
 * ritual holds; the override must be honored by EVERY consumer or by none.
 * From here on the literal join(DATA_DIR, "relion") lives ONLY in this
 * file — every workdir consumer imports RELION_DIR.
 */
export const RELION_DIR = path.join(DATA_DIR, "relion");
