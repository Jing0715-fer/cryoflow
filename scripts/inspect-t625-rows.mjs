import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const m = readFileSync("/home/z/my-project/.env", "utf8").match(/^DATABASE_URL=(.+)$/m);
const db = new PrismaClient({ datasources: { db: { url: m ? m[1].trim() : "file:/home/z/my-project/db/cryoflow.db" } } });
const proj = await db.project.findFirst({ where: { name: "t625 accounting backfill" } });
const jobs = await db.job.findMany({ where: { projectId: proj.id }, orderBy: { createdAt: "asc" } });
for (const j of jobs) {
  console.log(j.name.slice(4, 30).padEnd(26), "|", j.status.padEnd(9), "| createdAt", j.createdAt.toISOString().slice(11, 19), "| updatedAt", j.updatedAt.toISOString().slice(11, 19));
}
await db.$disconnect();
