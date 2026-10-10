// t636-world-census.mjs — read-only DB world census (Task 636).
// Post-disaster world accounting: which projects exist, how many jobs,
// QA rows, edges — the ledger this window reconciles against.
//
// ⚠ PIN the DB explicitly: the repo .env points at the IMAGE TEMPLATE
// (db/custom.db) while the正统 server drinks db/cryoflow.db via the
// dev-server.sh HARD-override (the t377/t635 poisoning lesson). Any
// script that trusts .env sees the wrong world — the seeder family
// pins absolute paths for exactly this reason.
process.env.DATABASE_URL = 'file:/home/z/my-project/db/cryoflow.db';
const { PrismaClient } = await import('@prisma/client');

const db = new PrismaClient();

const projects = await db.project.findMany({
  select: {
    id: true, name: true, createdAt: true,
    _count: { select: { jobs: true } },
  },
  orderBy: { createdAt: 'asc' },
});

let totalEdges = await db.edge.count();
let totalJobs = 0;
let qaRows = 0;

for (const p of projects) {
  totalJobs += p._count.jobs;
  const qa = await db.job.count({ where: { projectId: p.id, name: { startsWith: 'QA ' } } });
  qaRows += qa;
  const statuses = {};
  const jobs = await db.job.findMany({ where: { projectId: p.id }, select: { status: true } });
  for (const j of jobs) statuses[j.status] = (statuses[j.status] || 0) + 1;
  const statusStr = Object.entries(statuses).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`${p.id}  ${p.name}  jobs=${p._count.jobs}  (${statusStr})  qa=${qa}`);
}

console.log(`---`);
console.log(`projects=${projects.length} jobs=${totalJobs} edges=${totalEdges} qaRows=${qaRows}`);

// workdir presence for the biggest project (workdir = data/relion/<projectId>/<suffix==jobId>)
import { existsSync, readdirSync } from 'node:fs';
const relionRoot = '/home/z/my-project/data/relion';
if (existsSync(relionRoot)) {
  for (const pid of readdirSync(relionRoot)) {
    const n = readdirSync(`${relionRoot}/${pid}`).length;
    console.log(`workdir ${pid}: ${n} job dirs`);
  }
} else {
  console.log('workdir root MISSING: data/relion');
}

await db.$disconnect();
