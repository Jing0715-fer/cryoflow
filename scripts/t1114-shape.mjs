// t1114 — inspect the surviving world's shape (3 jobs / 2 edges).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const PID = "cmvbiz7y20000sr99qukrvfvq";
const jobs = await db.job.findMany({
  where: { projectId: PID },
  select: { id: true, name: true, type: true, status: true, progress: true, createdAt: true },
  orderBy: { createdAt: "asc" },
});
for (const j of jobs) console.log(j.id, JSON.stringify(j.name), j.type, j.status, j.progress, j.createdAt?.toISOString());
const edges = await db.edge.findMany({ where: { projectId: PID } });
for (const e of edges) console.log("edge:", JSON.stringify(e).slice(0, 220));
const ws = await db.workspace?.findMany?.({ where: { projectId: PID }, select: { id: true, name: true } }).catch(() => []);
for (const w of ws ?? []) console.log("workspace:", w.id, w.name);
await db.$disconnect();
