// t1013 — read-only probe: the link world (ORIGINALS with linkCount, their copies)
//usage: node scripts/t1013-link-probe.cjs
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const jobs = await p.job.findMany({ select: { id: true, name: true, status: true, linkedJobId: true } });
  const jmap = new Map(jobs.map((j) => [j.id, j]));
  const byOrig = new Map();
  for (const j of jobs) if (j.linkedJobId) byOrig.set(j.linkedJobId, (byOrig.get(j.linkedJobId) ?? 0) + 1);
  console.log('total jobs:', jobs.length, '| link relations:', [...byOrig.values()].reduce((a, b) => a + b, 0));
  for (const [orig, n] of byOrig) {
    const j = jmap.get(orig);
    console.log('ORIGINAL linkCount=' + n, orig, JSON.stringify(j?.name), j?.status);
  }
  const copies = jobs.filter((j) => j.linkedJobId);
  console.log('copies:', copies.map((c) => `${c.name}(${c.status})`).join(', ') || 'none');
  await p.$disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
