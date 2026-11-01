/** t523 — stepwise import probe: find where the engine chain dies before
 *  stopRun ever runs. Each step logs, so the last line before silence is the
 *  killer module. */
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
console.log("step0: env set");
const { stopRun } = await import(`${REPO}/src/lib/relion/engine.ts`);
console.log("step1: engine imported, stopRun =", typeof stopRun);
const { db } = await import(`${REPO}/src/lib/db.ts`);
console.log("step2: db imported");
const JOB = "cmur5d96n0019n5w7hrdr03k5";
const r = await stopRun(JOB);
console.log("step3: stop verdict:", JSON.stringify(r));
const row = await db.job.findUnique({ where: { id: JOB } });
console.log("step4: row after stop:", row?.status, row?.progress, "| result:", row?.result?.slice(0, 90));
await db.$disconnect();
process.exit(0);
