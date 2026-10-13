// t636-world-census.mjs — read-only DB world census (Task 636).
// Post-disaster world accounting: which projects exist, how many jobs,
// QA rows, edges — the ledger this window reconciles against.
//
// ⚠ PIN the DB — the t869 armor (the t871 retarget): .env FIRST, the
// frozen corpse pin as fallback, and the world NAMED at the gate. The
// original pin (cryoflow.db absolute) was the t377/t635-era truth: the
// 正统 server drank db/cryoflow.db and .env pointed at an image template.
// The t867 resurrection REVERSED the two worlds — the living data rides
// db/custom.db through .env and cryoflow.db is the frozen 0-byte corpse —
// so a pin that never reads .env now answers from the corpse one layer
// down ("the table main.Project does not exist", the t868 lesson's
// voice). Prisma's own rule: absolute kept, relative resolved from prisma/.
import { readFileSync } from 'node:fs';
const DB_URL = (() => {
  try {
    const m = readFileSync('/home/z/my-project/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) {
      let u = m[1].trim().replace(/^["']|["']$/g, '');
      if (!u.startsWith('file:')) u = 'file:' + u;
      if (/^file:[^/]/.test(u)) u = 'file:/home/z/my-project/prisma/' + u.slice(5);
      return u;
    }
  } catch { /* fall through */ }
  return 'file:/home/z/my-project/db/cryoflow.db';
})();
console.log(`world-census db pin: ${DB_URL} (the t869 armor: .env-first, frozen fallback)`);
process.env.DATABASE_URL = DB_URL;
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
