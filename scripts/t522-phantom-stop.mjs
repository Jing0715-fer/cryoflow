/** t522 — the phantom's send-off: QA Refine Live (qa60's pid-1 forever-running
 *  fixture, orphaned by every world it outlived) meets the product's own stop
 *  door. Run via the lib directly — the HTTP wrapper is a shell and the box's
 *  reaper keeps eating the server mid-call; stopRun IS the door's brain. */
const REPO = "/home/z/my-project";
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
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
