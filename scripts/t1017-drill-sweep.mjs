import { PrismaClient } from "@prisma/client";

// t1017 sweep — the drill torn out without a trace (the t681 F leg).
const p = new PrismaClient({ datasources: { db: { url: "file:/home/z/my-project/db/cryoflow.db" } } });
const id = "cmv8nhqxo0000sy8934xli45t";
const DRILL_ID = "t1017drillseat";
const edge = await p.edge.findUnique({ where: { id: "t1017drilledge" } });
if (edge) await p.edge.delete({ where: { id: "t1017drilledge" } });
const job = await p.job.findUnique({ where: { id: DRILL_ID } });
if (job) await p.job.delete({ where: { id: DRILL_ID } });
const after = {
  jobs: await p.job.count({ where: { projectId: id } }),
  edges: await p.edge.count({ where: { projectId: id } }),
};
console.log("swept. world:", JSON.stringify(after));
if (after.jobs !== 22 || after.edges !== 14) {
  console.error("FATAL: world not restored");
  process.exitCode = 1;
}
await p.$disconnect();
