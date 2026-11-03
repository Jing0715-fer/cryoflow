import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const projects = await db.project.findMany({
  include: { jobs: { select: { id: true, name: true, type: true, status: true, workspaceId: true } } },
  orderBy: { name: 'asc' },
});
for (const p of projects) {
  console.log(`${p.name} (${p.id.slice(0,10)}): ${p.jobs.length} jobs`);
  for (const j of p.jobs) console.log(`   - ${j.name} | ${j.type} | ${j.status} | ws=${(j.workspaceId ?? 'NULL').slice(0,10)}`);
}
await db.$disconnect();
