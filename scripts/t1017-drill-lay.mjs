import { PrismaClient } from "@prisma/client";

// t1017 drill — the t681 pattern: a DB-direct seat wired from the
// project's current latest finisher (Import Movies 1), laid BEFORE the
// page so the pace route's project walk finds a 2-step chain. Swept by
// the sibling sweep script after the ride.
const p = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/cryoflow.db" } } });
const id = "cmv8nhqxo0000sy8934xli45t";
const DRILL_ID = "t1017drillseat";

// the world gate: 22 jobs, 14 edges — as-left of every recent window
const before = {
  jobs: await p.job.count({ where: { projectId: id } }),
  edges: await p.edge.count({ where: { projectId: id } }),
};
if (before.jobs !== 22 || before.edges !== 14) {
  console.error(`FATAL: world gate — jobs ${before.jobs} (want 22), edges ${before.edges} (want 14)`);
  await p.$disconnect();
  process.exit(1);
}

const anchor = await p.job.findUnique({ where: { id: "cmv8ogdtr000jsy89z8c3d7qf" } });
// find Import Movies 1 by NAME (the by-name law — ids drift across rebuilds)
const finisher = await p.job.findFirst({ where: { projectId: id, name: "Import Movies 1" } });
if (!finisher || !finisher.startedAt) {
  console.error("FATAL: the anchor finisher (Import Movies 1, started) not found");
  await p.$disconnect();
  process.exit(1);
}
const finEnd = new Date(finisher.startedAt).getTime() + Math.max(1000, finisher.duration);

const start = new Date(finEnd + 2000);
await p.job.create({
  data: {
    id: DRILL_ID,
    projectId: id,
    workspaceId: finisher.workspaceId,
    type: "postprocess",
    name: "t1017 drill seat",
    x: finisher.x + 260,
    y: finisher.y,
    status: "completed",
    progress: 100,
    duration: 8000,
    startedAt: start,
    params: "{}",
  },
});
await p.edge.create({
  data: { id: "t1017drilledge", projectId: id, fromJobId: finisher.id, toJobId: DRILL_ID },
});
console.log("drill laid:", DRILL_ID, "wired from", finisher.name, "| drill start", start.toISOString(), "| dur 8000ms");
const after = {
  jobs: await p.job.count({ where: { projectId: id } }),
  edges: await p.edge.count({ where: { projectId: id } }),
};
console.log("world now:", JSON.stringify(after), "(23/15 during the ride)");
await p.$disconnect();
