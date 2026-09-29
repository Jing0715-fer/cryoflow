import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const all = await db.job.findMany({ select: { id: true, type: true, status: true, name: true, linkedJobId: true } });
for (const j of all.filter(x => ["class3d","class2d","refine3d"].includes(x.type ?? ""))) console.log(j);
console.log("total jobs:", all.length);
await db.$disconnect();
