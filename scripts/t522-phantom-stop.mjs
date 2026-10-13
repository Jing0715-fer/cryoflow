/** t522 — the phantom's send-off: QA Refine Live (qa60's pid-1 forever-running
 *  fixture, orphaned by every world it outlived) meets the product's own stop
 *  door. Run via the lib directly — the HTTP wrapper is a shell and the box's
 *  reaper keeps eating the server mid-call; stopRun IS the door's brain. */
const REPO = "/home/z/my-project";
// the t869 armor (the t871 retarget): .env FIRST, the frozen pin as
// fallback, the world NAMED at the gate (the t867 resurrection made
// .env -> db/custom.db the living world; the old cryoflow.db pin is a
// 0-byte corpse — docs/world-db-law.md is the law).
import { readFileSync as __t871EnvRead } from 'node:fs';
process.env.DATABASE_URL = (() => {
  try {
    const m = __t871EnvRead('/home/z/my-project/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) {
      let u = m[1].trim().replace(/^["']|["']$/g, '');
      if (!u.startsWith('file:')) u = 'file:' + u;
      if (/^file:[^/]/.test(u)) u = 'file:/home/z/my-project/prisma/' + u.slice(5);
      return u;
    }
  } catch { /* fall through */ }
  return 'file:/home/z/my-project/db/cryoflow.db';
})();
console.log(`db pin: ${process.env.DATABASE_URL} (the t869 armor: .env-first, frozen fallback)`);

process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;
const { stopRun } = await import(`${REPO}/src/lib/relion/engine.ts`);
const { PrismaClient } = await import(`${REPO}/src/generated/prisma/client.ts`).catch(() => ({})) ?? {};
const JOB = "cmur5d96n0019n5w7hrdr03k5";
const r = await stopRun(JOB);
console.log("stop verdict:", JSON.stringify(r));
const { db } = await import(`${REPO}/src/lib/db.ts`);
const row = await db.job.findUnique({ where: { id: JOB } });
console.log("row after stop:", row?.status, row?.progress, "| result:", row?.result?.slice(0, 90));
await db.$disconnect();
process.exit(0);
