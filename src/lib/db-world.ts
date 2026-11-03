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
import path from "node:path";

export const RUNTIME_DB_BASELINE = path.join(process.cwd(), "db", "cryoflow.db");

export function templateWorldWarnOf(
  url: string | undefined,
  opts?: { production?: boolean }
): string | null {
  // the guard never sings in production (the dev lesson stays a dev voice)
  if (opts?.production) return null;
  // the honest absence: an unset URL is prisma's own business, not a
  // template-world misread — silence until there is a world to misread
  if (!url) return null;
  // the runtime world's test: the file part (query params stripped) must
  // END at the runtime world's name — 'cryoflow.db-wal', 'cryoflow.db.bak',
  // or any other look-alike is NOT the world and earns the warn (the
  // hardened shape: t1114's quick `includes` let look-alikes pass silently)
  const filePart = url.split("?")[0] ?? "";
  const isRuntime = /(^|[/=:])cryoflow\.db$/.test(filePart);
  if (isRuntime) return null;
  return (
    `[db] the db url points at "${url}" — that is the TEMPLATE world, ` +
    `not the runtime one (dev-server.sh L82 exports file:${RUNTIME_DB_BASELINE}). ` +
    `Reads here will not see the live project, jobs, edges, or fleet ring.`
  );
}
