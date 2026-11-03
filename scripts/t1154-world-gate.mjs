// t1154 bed rolls — world gate check (db counts, byte-for-byte)
import { PrismaClient } from '@prisma/client';

const p = new PrismaClient({
  datasources: { db: { url: 'file:/home/z/my-project/db/cryoflow.db' } },
});

const jobs = await p.job.count();
const done = await p.job.count({ where: { status: 'completed' } });
const edges = await p.edge.count();
console.log(`WORLD_GATE jobs=${jobs} done=${done} edges=${edges}`);
await p.$disconnect();
