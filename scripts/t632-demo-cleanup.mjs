// t632 — the demo archaeology ruling executed: 20 QA rows in the demo
// project + 2 QA rows in the QA t474 UI gallery project go home through
// the product door. Premises verified this window:
//   - qa63's host dependency is SELF-SUFFICIENT (Task 86 find-or-create
//     seeds the host into the ACTIVE project; take-home proved the full
//     loop seed→delete→world-restored), so the demo copies are not load-
//     bearing
//   - all 22 rows are no-workdir, zero tenant signals (pre-delete audit)
// The product door (DELETE /api/jobs/[id]) cascades edges, refuses
// linked-copy originals with 409, and stops live runs first.
// Enumeration is prisma-side on purpose: the jobs GET returns only the
// ACTIVE project (t628's landing-fiction ruling — the API deliberately
// has no per-project enumeration), while DELETE is id-addressed and
// project-agnostic. qa77 precedent: enumerate via prisma, delete through
// the product door.
// t641 — pin the repo's own live DB before the client is constructed
// (t377 poison law: a bare client eats the sandbox TEMPLATE URL from .env)
import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.DATABASE_URL = `file:${path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")}/db/cryoflow.db`;
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BASE = "http://127.0.0.1:3000";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jget(path) {
  const r = await fetch(BASE + path, { headers: SH });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
}
async function jdel(id) {
  const r = await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

async function main() {
  // 1. collect the condemned rows (QA-prefixed names in demo + t474),
  //    enumerated prisma-side (see header note)
  const demo = await db.project.findFirst({ where: { name: { contains: "demo" } } });
  const t474 = await db.project.findFirst({ where: { name: { contains: "t474" } } });
  if (!demo || !t474) throw new Error(`projects missing: demo=${!!demo} t474=${!!t474}`);

  const condemned = [];
  for (const [label, proj] of [["demo", demo], ["t474", t474]]) {
    const jobs = await db.job.findMany({
      where: { projectId: proj.id, name: { startsWith: "QA " } },
      select: { id: true, name: true, status: true },
    });
    console.log(`${label} "${proj.name}": ${jobs.length} QA rows`);
    for (const j of jobs) condemned.push({ label, ...j });
  }
  console.log(`condemned total: ${condemned.length}`);
  if (condemned.length === 0) { console.log("NOTHING TO DO"); return; }

  // 2. delete through the product door, one row at a time
  let ok = 0, refused = 0, gone = 0;
  for (const row of condemned) {
    const res = await jdel(row.id);
    if (res.ok) { ok++; console.log(`  deleted [${row.label}] "${row.name}" (${row.status})`); }
    else if (res.status === 404) { gone++; console.log(`  already gone "${row.name}"`); }
    else { refused++; console.log(`  REFUSED ${res.status} "${row.name}": ${JSON.stringify(res.body).slice(0, 120)}`); }
    await sleep(120);
  }
  console.log(`\nresult: deleted=${ok} refused=${refused} alreadyGone=${gone}`);

  // 3. verify: no QA rows remain in either project (prisma-side)
  for (const [label, proj] of [["demo", demo], ["t474", t474]]) {
    const jobs = await db.job.findMany({
      where: { projectId: proj.id },
      select: { id: true, name: true },
    });
    const left = jobs.filter((j) => (j.name ?? "").startsWith("QA "));
    console.log(`verify ${label}: ${jobs.length} jobs, ${left.length} QA rows remaining${left.length ? ` -> ${left.map((x) => x.name).join(", ")}` : ""}`);
  }
  // active world untouched
  const active = await jget("/api/jobs");
  const ajobs = (active.jobs ?? []).filter((j) => (j.name ?? "").startsWith("QA "));
  console.log(`verify active: ${(active.jobs ?? []).length} jobs, ${ajobs.length} QA rows (expect 12 / 0)`);
}

main()
  .catch(async (e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
