/** t523 — stepwise import probe: find where the engine chain dies before
 *  stopRun ever runs. Each step logs, so the last line before silence is the
 *  killer module. */
const REPO = "/home/z/my-project";
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
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
