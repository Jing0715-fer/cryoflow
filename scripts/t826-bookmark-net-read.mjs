#!/usr/bin/env node
/* t826 — the census's bookmark-net leg, read through the ANCHORED
 * instrument (the t825 lesson: the bare read resolves another db file
 * and answers NO ROW with a confident tone — the reader must NAME which
 * world it reads). Explicit DATABASE_URL pin, then the row direct.
 * Prints the count and the names byte-for-byte.
 */
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
const { PrismaClient } = await import("@prisma/client");

const prisma = new PrismaClient();
(async () => {
  const row = await prisma.bookmarkSession.findFirst({
    where: { jobId: "cmuwipe635000refine3d" },
  });
  if (!row) {
    console.error("CENSUS-LEG: NO ROW — net broken");
    process.exit(1);
  }
  const list = (JSON.parse(row.data ?? "[]")).map((e) => e.name);
  console.log(`COUNT: ${list.length}`);
  console.log(`NAMES: ${JSON.stringify(list)}`);
  const canon = ["Centered iso view", "Top-down slice", "Front half clipped"];
  const netZero = list.length === 3 && canon.every((n) => list.includes(n));
  console.log(netZero ? "NET ZERO: trio intact, byte-for-byte" : "NET BROKEN");
  process.exit(netZero ? 0 : 1);
})()
  .catch((e) => {
    console.error("ERR:", e.message.slice(0, 140));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
