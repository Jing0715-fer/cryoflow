import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const job = await db.job.findUnique({ where: { id: "cmukrkgky000orjobb2ni5fj3" } });
if (!job) { console.log("NOT FOUND"); process.exit(0); }
console.log({ id: job.id, type: job.type, status: job.status, linkedJobId: job.linkedJobId, name: job.name });
const eff = job.linkedJobId ? await db.job.findUnique({ where: { id: job.linkedJobId } }) : null;
console.log("effective:", eff ? { id: eff.id, type: eff.type, status: eff.status } : null);
await db.$disconnect();
