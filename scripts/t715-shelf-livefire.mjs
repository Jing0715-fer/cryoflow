// t715-shelf-livefire.mjs — the PresetShelf row shape against the REAL
// world DB (db/cryoflow.db), staged-world style: the route itself wakes
// on build day, but the schema + regenerated client can be proven NOW.
// Writes a two-preset shelf, reads it back, asserts the round-trip,
// then deletes the row (GET on a missing row must answer synced:false —
// the fresh-server baseline the reconcile law depends on). Clean exit:
// the world is byte-identical to before the probe.
import { PrismaClient } from "@prisma/client";

let pass = 0, fail = 0;
const must = (c, m) => { if (c) { pass++; console.log(`  ok: ${m}`); } else { fail++; console.log(`  FAIL: ${m}`); } };

process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
const db = new PrismaClient();

const SHELF_ID = "user-param-presets";
const shelf = [
  { id: "upp-livefire-a", type: "ctffind", name: "Live-fire A", params: { box: 256, resMax: 8 }, createdAt: 1700000000000 },
  { id: "upp-livefire-b", type: "class2d", name: "Live-fire B", params: { K: 16, fast: true }, createdAt: 1700000000001 },
];

try {
  // baseline: no shelf row
  await db.presetShelf.deleteMany({ where: { id: SHELF_ID } });
  const none = await db.presetShelf.findUnique({ where: { id: SHELF_ID } });
  must(none === null, "baseline: no shelf row (fresh-server state)");

  // PUT shape: upsert whole collection
  await db.presetShelf.upsert({
    where: { id: SHELF_ID },
    update: { data: JSON.stringify(shelf) },
    create: { id: SHELF_ID, data: JSON.stringify(shelf) },
  });
  const row = await db.presetShelf.findUnique({ where: { id: SHELF_ID } });
  must(row !== null, "upsert created the shelf row");
  const parsed = JSON.parse(row.data);
  must(Array.isArray(parsed) && parsed.length === 2, "row reads back as a 2-preset array");
  must(parsed[0].id === "upp-livefire-a" && parsed[0].params.box === 256 && parsed[0].params.fast === undefined, "entry A round-trips with scalar params intact");
  must(parsed[1].params.K === 16 && parsed[1].params.fast === true, "entry B round-trips (number + boolean)");
  must(row.updatedAt instanceof Date, "updatedAt is a real timestamp (the wall's freshness dialect can read it)");

  // empty PUT keeps the row (the synced flag)
  await db.presetShelf.upsert({
    where: { id: SHELF_ID },
    update: { data: JSON.stringify([]) },
    create: { id: SHELF_ID, data: JSON.stringify([]) },
  });
  const emptied = await db.presetShelf.findUnique({ where: { id: SHELF_ID } });
  must(emptied !== null && JSON.parse(emptied.data).length === 0, "empty PUT keeps the row (synced flag survives the deletion)");

  console.log(`\nlive-fire: ${pass} pass / ${fail} fail`);
} catch (e) {
  console.log("LIVE-FIRE ERROR:", e.message.slice(0, 200));
  fail++;
} finally {
  await db.presetShelf.deleteMany({ where: { id: SHELF_ID } });
  const after = await db.presetShelf.findUnique({ where: { id: SHELF_ID } });
  must(after === null, "clean exit: the world is byte-identical to before the probe");
  await db.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}
