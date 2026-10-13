/**
 * t774-canon-reset — the ceremony's seeder-lane finishing move: the
 * t773 window left an idle select2d sibling ("2D Class Selection 2")
 * standing on the canvas as its gallery activation stage. The t773
 * ledger itself pre-announced the ceremony's contract: the seeder
 * resets the world to canon (17 jobs / 18 edges), and the activation
 * door re-opens by palette-add + wire-drag when the build-day batch
 * needs it. This script deletes that sibling HARD (Prisma delete, no
 * tombstone) — the API DELETE would bury it into the graveyard drawer
 * and pollute the t769 activation verdict's "8 graves, all known
 * types" premise. Edges cascade via the schema's onDelete: Cascade.
 *
 * Idempotent: if the sibling is already gone (re-run, or a future
 * seeder absorbs it), exit 0 with a no-op note.
 */
import { PrismaClient } from "@prisma/client";

// FOSSIL LAW (the t871 fossilization): the line below was qa-t635's binding
// law — "the QA world lives in db/cryoflow.db" — TRUE until the t867
// resurrection reversed the two worlds (the living data now rides .env →
// db/custom.db; cryoflow.db is the 0-byte corpse). Kept for the record;
// the armor beneath is the living law. docs/world-db-law.md is the canon.
// the t869 armor (the t871 retarget): .env FIRST, the frozen pin as
// fallback, the world NAMED at the gate (the t867 resurrection made
// .env -> db/custom.db the living world; the old cryoflow.db pin is a
// 0-byte corpse — docs/world-db-law.md is the law).
import { readFileSync as __t871EnvRead } from 'node:fs';
process.env.DATABASE_URL = (() => {
  try {
    const m = __t871EnvRead('/home/z/my-project/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) {
      let u = m[1].trim().replace(/^["']|["']$/g, '');
      if (!u.startsWith('file:')) u = 'file:' + u;
      if (/^file:[^/]/.test(u)) u = 'file:/home/z/my-project/prisma/' + u.slice(5);
      return u;
    }
  } catch { /* fall through */ }
  return 'file:/home/z/my-project/db/cryoflow.db';
})();
console.log(`db pin: ${process.env.DATABASE_URL} (the t869 armor: .env-first, frozen fallback)`);


const prisma = new PrismaClient();
const SIBLING_ID = "cmv0qhdnb00qvone3j55uyf8w";

try {
  const existing = await prisma.job.findUnique({ where: { id: SIBLING_ID } });
  if (!existing) {
    console.log("canon reset: sibling already absent — no-op");
  } else {
    const edges = await prisma.edge.count({
      where: { OR: [{ fromJobId: SIBLING_ID }, { toJobId: SIBLING_ID }] },
    });
    await prisma.job.delete({ where: { id: SIBLING_ID } });
    console.log(`canon reset: deleted idle sibling "${existing.name}" (${SIBLING_ID}) + ${edges} cascade edge(s)`);
  }
  const QA_WS = "cmuwipe6350000demoprojectws";
  const total = await prisma.job.count({ where: { workspaceId: QA_WS } });
  const edgesTotal = await prisma.edge.count({
    where: { OR: [{ fromJob: { workspaceId: QA_WS } }, { toJob: { workspaceId: QA_WS } }] },
  });
  console.log(`canon reset done: QA world = ${total} jobs / ${edgesTotal} edges`);
  if (total !== 17 || edgesTotal !== 18) {
    console.log(`WARNING: canon is 17 jobs / 18 edges — QA world reads ${total}/${edgesTotal}`);
    process.exitCode = 2;
  }
} finally {
  await prisma.$disconnect();
}
