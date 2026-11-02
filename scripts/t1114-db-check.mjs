// t1114 db check — which projects live in the world's DB (TRUST THE COUNT).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const projects = await db.project.findMany({
  select: { id: true, name: true, createdAt: true },
  orderBy: { createdAt: "asc" },
});
for (const p of projects) console.log(p.id, JSON.stringify(p.name), p.createdAt?.toISOString());
const jobCounts = await db.job.groupBy({ by: ["projectId"], _count: true });
for (const j of jobCounts) console.log("jobs:", j.projectId, j._count);
const edges = await db.edge?.groupBy?.({ by: ["projectId"], _count: true }).catch(() => null);
if (edges) for (const e of edges) console.log("edges:", e.projectId, e._count);
await db.$disconnect();
