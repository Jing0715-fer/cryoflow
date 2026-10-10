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

// qa-t635's own binding law (line 36): the QA world lives in db/cryoflow.db
// — the standalone server's .next/standalone/.env says the same. The repo-root
// .env still points at db/custom.db (a stale Oct-8 world, 21 jobs/15 edges),
// so an env-following PrismaClient would read the WRONG world — pin the
// seeder lane's file, exactly as the seeder does.
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";

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
