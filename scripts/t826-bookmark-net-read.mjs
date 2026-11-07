#!/usr/bin/env node
/* t826 — the census's bookmark-net leg, read through the ANCHORED
 * instrument (the t825 lesson: the bare read resolves another db file
 * and answers NO ROW with a confident tone — the reader must NAME which
 * world it reads). Explicit DATABASE_URL pin, then the row direct.
 * Prints the count and the names byte-for-byte.
 *
 * t861 — THE PIN CORRECTED (the t859 jurisprudence's second bite in the
 * census legs): the script pinned the OLD world's jobId literal
 * (`cmuwipe635000refine3d`) and answered NO ROW — net broken — against
 * the RESTORED world, where the healers' canonical chain rides a new id
 * (`cmv2fdgqs000un852z4dopelj`) and the trio sits byte-for-byte intact.
 * The literal was world-state, not law: a fair-weather pin that died
 * with the restore and cried breakage at an intact net. The INVARIANT
 * the census actually means is the NET's own: the canonical saved-view
 * trio ("Centered iso view" / "Top-down slice" / "Front half clipped")
 * exists byte-for-byte on SOME bookmark row. The row's jobId is
 * provenance now — printed, never gated on.
 */
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
const { PrismaClient } = await import("@prisma/client");

const canon = ["Centered iso view", "Top-down slice", "Front half clipped"];
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.bookmarkSession.findMany({
    select: { jobId: true, data: true },
  });
  if (rows.length === 0) {
    console.error("CENSUS-LEG: NO ROWS — net broken (zero bookmark rows)");
    process.exit(1);
  }
  const parsed = rows.map((r) => {
    let names = [];
    try {
      names = (JSON.parse(r.data ?? "[]")).map((e) => e.name);
    } catch {
      names = []; // a corrupt row is an absent tenant, recorded below
    }
    return { jobId: r.jobId, names };
  });
  const holder = parsed.find(
    (r) => r.names.length === 3 && canon.every((n) => r.names.includes(n))
  );
  console.log(`ROWS: ${rows.length} (jobIds: ${parsed.map((r) => r.jobId).join(", ")})`);
  if (!holder) {
    console.error(
      `CENSUS-LEG: NET BROKEN — the trio holds no row byte-for-byte (row tenants: ${parsed
        .map((r) => `${r.jobId}:${JSON.stringify(r.names)}`)
        .join(" | ")})`
    );
    process.exit(1);
  }
  console.log(`HOLDER: ${holder.jobId} (provenance — the world-state id, not the pin)`);
  console.log(`COUNT: ${holder.names.length}`);
  console.log(`NAMES: ${JSON.stringify(holder.names)}`);
  console.log("NET ZERO: trio intact, byte-for-byte, on a live row");
  process.exit(0);
})()
  .catch((e) => {
    console.error("ERR:", e.message.slice(0, 140));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
