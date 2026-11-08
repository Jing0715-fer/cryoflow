// t1115 — THE TWO-DB TRAP'S ONE HOME (the t1114 law as a pure well).
//
// The runtime world lives at db/cryoflow.db (dev-server.sh L82's own law —
// it exports DATABASE_URL before spawning next); .env's db/custom.db is
// only the TEMPLATE the seed was born from. Any process that imports the
// db singleton WITHOUT dev-server.sh's env silently lands on the template
// and reads a world that is not the world — the t1114 window mourned a
// "reset" that never happened and swept 3.1 GB of live workdirs on the
// strength of that misread. The verdict lives here ONCE (zero prisma,
// zero IO beyond the path text); src/lib/db.ts says it out loud at import
// time, dev-only, so the misread dies at the moment it is born.
//
// t891 — THE CWD TRAP'S THIRD FACE, named where future readers look first
// (the t890 window's autopsy, in this file's own tongue): the baseline
// above is CWD-RELATIVE BY CONSTRUCTION — `path.join(process.cwd(), ...)`
// — and the standalone launcher chdirs into .next/standalone (its t312
// note), so a bare `node .next/standalone/server.js` boots with a baseline
// that points at a world that does not exist: dev never saw the trap
// because the dev server's CWD IS the repo root. The failure mode is the
// honest one (a loud 500, "Unable to open the database file" — never a
// wrong world, the t1166 law holding at a new depth); the cure lives at
// the SANCTIONED launcher: scripts/prod-3001.sh pins CRYOFLOW_DB_URL (the
// ONE knob src/lib/db.ts honors first) beside its DATABASE_URL line, the
// dev-server.sh law carried across. A launch method that moves the world
// under the app is not the app's bug to swallow — it is the launcher's
// contract to pin.
//
// t875 — THE LANE LAW MERGE (two lineages, two eras, one truth): t1115's
// baseline named cryoflow.db and called .env's custom.db the template —
// true in the lineage that WROTE it, and a lie in the lineage whose
// platform .env names custom.db as the legal lane (the t872 ruling: the
// platform owns .env). The merged law reads the OWNER: a URL that agrees
// with .env's own DATABASE_URL is the platform's chosen world — the
// warning only sings when a process lands on a world its OWN .env does
// not name (the real t1114 disease: two different worlds in one box).
// The cryoflow.db baseline keeps its innocence (their era's shape); the
// .env line is read lazily, zero-IO at import (the well stays pure).
import path from "node:path";
import { readFileSync } from "node:fs";

export const RUNTIME_DB_BASELINE = path.join(process.cwd(), "db", "cryoflow.db");

/** the platform's own tongue (t872): .env's DATABASE_URL, read once, lazily,
 *  cached — a .env-less process simply has no owner's line */
let envLane: string | null | undefined;
function envLaneOf(): string | null {
  if (envLane === undefined) {
    try {
      envLane =
        readFileSync(path.join(process.cwd(), ".env"), "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim() ?? null;
    } catch {
      envLane = null;
    }
  }
  return envLane;
}

export function templateWorldWarnOf(
  url: string | undefined,
  opts?: { production?: boolean }
): string | null {
  // the guard never sings in production (the dev lesson stays a dev voice)
  if (opts?.production) return null;
  // the honest absence: an unset URL is prisma's own business, not a
  // template-world misread — silence until there is a world to misread
  if (!url) return null;
  const filePart = url.split("?")[0] ?? "";
  // the runtime world's test, era one (t1115): the file part must END at
  // the runtime world's name — 'cryoflow.db-wal', 'cryoflow.db.bak', or
  // any other look-alike is NOT the baseline world
  const isBaseline = /(^|[/=:])cryoflow\.db$/.test(filePart);
  if (isBaseline) return null;
  // the lane law, era two (t872): the URL the platform's own .env names is
  // the OWNER'S world — the live project, jobs and edges live wherever the
  // owner pointed (the t875 merge's own witness: the healed 16-job world
  // sat in custom.db while this warning called it a template). Only a
  // world NEITHER the baseline NOR the owner's tongue names is a misread.
  const envLane = envLaneOf();
  if (envLane && (envLane.split("?")[0] ?? "") === filePart) return null;
  return (
    `[db] the db url points at "${url}" — that is NEITHER the baseline world ` +
    `(db/cryoflow.db) NOR the lane the platform's .env names${envLane ? ` (${envLane})` : ""} — ` +
    `the t1114 misread shape: this process may be reading a world that is not the world.`
  );
}
